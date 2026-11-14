import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { ENV } from '../config/env.ts';
import { getDb } from '../db/database.ts';

export type UserRole = 'patient' | 'doctor' | 'hospital' | 'pharmacy' | 'admin';

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
  full_name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function signAccessToken(user: AuthUser): string {
  const options: jwt.SignOptions = {
    expiresIn: ENV.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
    },
    ENV.JWT_SECRET,
    options
  );
}

export function signRefreshToken(user: AuthUser): string {
  const options: jwt.SignOptions = {
    expiresIn: `${ENV.REFRESH_TOKEN_TTL_DAYS}d` as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      jti: crypto.randomUUID(),
    },
    ENV.JWT_REFRESH_SECRET,
    options
  );
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = header.slice('Bearer '.length).trim();
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

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}`,
      });
      return;
    }
    next();
  };
}

export function logAudit(params: {
  actorUserId?: number | null;
  actorRole?: string;
  action: string;
  resourceType: string;
  resourceId?: string | number;
  ipAddress?: string;
  details?: Record<string, unknown>;
}) {
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO audit_logs (actor_user_id, actor_role, action, resource_type, resource_id, ip_address, details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      params.actorUserId ?? null,
      params.actorRole ?? 'anonymous',
      params.action,
      params.resourceType,
      String(params.resourceId ?? ''),
      params.ipAddress ?? '',
      JSON.stringify(params.details ?? {})
    );
  } catch {
    // Audit logging should never crash request flow if DB is closing in tests
  }
}

export function createNotification(params: {
  userId: number;
  title: string;
  message: string;
  category: 'appointment' | 'prescription' | 'order' | 'hospital' | 'emergency' | 'system';
  actionUrl?: string;
}) {
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO notifications (user_id, title, message, category, action_url)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      params.userId,
      params.title,
      params.message,
      params.category,
      params.actionUrl || ''
    );
  } catch {
    // Safe non-blocking notification helper
  }
}

/**
 * Checks whether a doctor has legitimate clinical relationship with a patient
 * (via appointment, consultation, prescription, or hospital admission) to prevent IDOR.
 */
export function doctorHasPatientAccess(doctorId: number, patientId: number): boolean {
  const db = getDb();
  const appt = db
    .prepare(
      `SELECT 1 FROM appointments WHERE doctor_id = ? AND patient_id = ? LIMIT 1`
    )
    .get(doctorId, patientId);
  if (appt) return true;

  const adm = db
    .prepare(
      `SELECT 1 FROM admissions WHERE attending_doctor_id = ? AND patient_id = ? LIMIT 1`
    )
    .get(doctorId, patientId);
  if (adm) return true;

  const docHospital = db
    .prepare(`SELECT hospital_id FROM doctors WHERE id = ?`)
    .get(doctorId) as { hospital_id: number | null } | undefined;

  if (docHospital?.hospital_id) {
    const hospAdm = db
      .prepare(
        `SELECT 1 FROM admissions WHERE hospital_id = ? AND patient_id = ? AND status = 'admitted' LIMIT 1`
      )
      .get(docHospital.hospital_id, patientId);
    if (hospAdm) return true;
  }

  return false;
}

function getRateLimitKey(req: Request): string {
  const forwarded = req.headers.forwarded;
  if (typeof forwarded === 'string') {
    const match = forwarded.match(/for=(?:"?\[?([^;\s",]+)\]?"?)/i);
    if (match?.[1]) {
      const cleaned = match[1].replace(/:\d+$/, '');
      return ipKeyGenerator(cleaned);
    }
  }
  return ipKeyGenerator(req.ip || req.socket.remoteAddress || '127.0.0.1');
}

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getRateLimitKey,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getRateLimitKey,
  message: { error: 'Rate limit exceeded. Please slow down requests.' },
});
