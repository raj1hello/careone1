import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };
import { ENV } from '../config/env.ts';
import { getDb } from '../db/database.ts';
import type { AuthUser, UserRole } from './auth.ts';

const FIREBASE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedCerts: Record<string, string> = {};
let certsExpiresAt = 0;

async function getFirebasePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now < certsExpiresAt && Object.keys(cachedCerts).length > 0) {
    return cachedCerts;
  }

  const res = await fetch(FIREBASE_CERTS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Firebase public keys (${res.status})`);
  }

  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;

  cachedCerts = (await res.json()) as Record<string, string>;
  certsExpiresAt = now + maxAgeSec * 1000;
  return cachedCerts;
}

export interface FirebaseDecodedUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

export interface FirebaseAuthenticatedRequest extends Request {
  firebaseUser?: FirebaseDecodedUser;
  user?: AuthUser;
}

export async function verifyFirebaseIdToken(token: string): Promise<FirebaseDecodedUser> {
  const decodedComplete = jwt.decode(token, { complete: true });
  const kid = decodedComplete?.header?.kid;
  if (!kid || decodedComplete?.header?.alg !== 'RS256') {
    throw new Error('Not a valid Firebase RS256 ID token');
  }

  const certs = await getFirebasePublicCerts();
  const cert = certs[kid];
  if (!cert) {
    throw new Error('Firebase signing key ID not recognized');
  }

  const projectId = firebaseConfig.projectId;
  const payload = jwt.verify(token, cert, {
    algorithms: ['RS256'],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
  }) as jwt.JwtPayload;

  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Firebase ID token missing subject UID');
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : '',
    emailVerified: Boolean(payload.email_verified),
    name: typeof payload.name === 'string' ? payload.name : undefined,
  };
}

/**
 * Verifies Firebase Auth ID tokens (production client flow) and supports
 * local HS256 CareOne JWTs for unit/integration tests.
 */
export async function requireFirebaseOrAppAuth(
  req: FirebaseAuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  const decodedHeader = jwt.decode(token, { complete: true })?.header;

  // 1. Firebase RS256 ID Token path
  if (decodedHeader?.alg === 'RS256') {
    try {
      const fbUser = await verifyFirebaseIdToken(token);
      req.firebaseUser = fbUser;
      next();
      return;
    } catch {
      res.status(401).json({ error: 'Invalid or expired Firebase authentication token' });
      return;
    }
  }

  // 2. Fallback HS256 JWT path (used by automated API test suite)
  try {
    const payload = jwt.verify(token, ENV.JWT_SECRET) as unknown as {
      sub: number;
      email: string;
      role: UserRole;
      full_name: string;
    };

    const db = getDb();
    const userRow = db
      .prepare('SELECT id, email, role, full_name, is_active FROM users WHERE id = ?')
      .get(payload.sub) as
      | { id: number; email: string; role: UserRole; full_name: string; is_active: number }
      | undefined;

    if (!userRow || !userRow.is_active) {
      res.status(401).json({ error: 'Account inactive or not found' });
      return;
    }

    req.user = {
      id: userRow.id,
      email: userRow.email,
      role: userRow.role,
      full_name: userRow.full_name,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}
