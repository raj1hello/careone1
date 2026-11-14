import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { getDb } from '../db/database.ts';
import { ENV } from '../config/env.ts';
import {
  authLimiter,
  hashToken,
  logAudit,
  requireAuth,
  signAccessToken,
  signRefreshToken,
  type AuthenticatedRequest,
  type UserRole,
} from '../middleware/auth.ts';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(2).max(120),
  phone: z.string().min(6).max(30).optional().default(''),
  role: z.enum(['patient', 'doctor', 'hospital', 'pharmacy']),
  // Patient fields
  dob: z.string().optional(),
  gender: z.string().optional(),
  blood_group: z.string().optional(),
  address: z.string().optional(),
  // Doctor fields
  license_no: z.string().optional(),
  specialization: z.string().optional(),
  qualification: z.string().optional(),
  experience_years: z.coerce.number().int().min(0).max(70).optional(),
  consultation_fee: z.coerce.number().min(0).optional(),
  hospital_id: z.coerce.number().int().positive().optional().nullable(),
  // Hospital / Pharmacy fields
  organization_name: z.string().optional(),
  registration_no: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function buildUserContext(userId: number, role: UserRole) {
  const db = getDb();
  const user = db
    .prepare(
      'SELECT id, email, role, full_name, phone, is_active, is_verified, created_at FROM users WHERE id = ?'
    )
    .get(userId) as Record<string, unknown> | undefined;

  if (!user) return null;

  let profile: Record<string, unknown> | null = null;
  if (role === 'patient') {
    profile = db.prepare('SELECT * FROM patients WHERE user_id = ?').get(userId) as Record<string, unknown> | null;
  } else if (role === 'doctor') {
    profile = db
      .prepare(
        `SELECT d.*, h.name as hospital_name
         FROM doctors d
         LEFT JOIN hospitals h ON d.hospital_id = h.id
         WHERE d.user_id = ?`
      )
      .get(userId) as Record<string, unknown> | null;
  } else if (role === 'hospital') {
    profile = db.prepare('SELECT * FROM hospitals WHERE user_id = ?').get(userId) as Record<string, unknown> | null;
  } else if (role === 'pharmacy') {
    profile = db.prepare('SELECT * FROM pharmacies WHERE user_id = ?').get(userId) as Record<string, unknown> | null;
  }

  return { user, profile };
}

router.post('/register', authLimiter, (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;
  const db = getDb();

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(data.email);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const passwordHash = bcrypt.hashSync(data.password, 10);

  try {
    const createdUserId = db.transaction(() => {
      const isVerified = data.role === 'patient' ? 1 : 0;
      const userRes = db
        .prepare(
          `INSERT INTO users (email, password_hash, role, full_name, phone, is_active, is_verified)
           VALUES (?, ?, ?, ?, ?, 1, ?)`
        )
        .run(data.email.toLowerCase(), passwordHash, data.role, data.full_name, data.phone || '', isVerified);

      const userId = Number(userRes.lastInsertRowid);

      if (data.role === 'patient') {
        const mrn = `MRN-${new Date().getFullYear()}-${String(1000 + userId).padStart(4, '0')}`;
        db.prepare(
          `INSERT INTO patients (user_id, mrn, dob, gender, blood_group, address)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
          userId,
          mrn,
          data.dob || '',
          data.gender || 'Unspecified',
          data.blood_group || '',
          data.address || ''
        );
      } else if (data.role === 'doctor') {
        const licenseNo = data.license_no?.trim() || `MCI-REG-${userId}-${Date.now().toString().slice(-4)}`;
        db.prepare(
          `INSERT INTO doctors (user_id, hospital_id, license_no, verification_status, specialization, qualification, experience_years, consultation_fee)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`
        ).run(
          userId,
          data.hospital_id ?? null,
          licenseNo,
          data.specialization || 'General Medicine',
          data.qualification || 'MBBS, MD',
          data.experience_years ?? 1,
          data.consultation_fee ?? 600
        );
      } else if (data.role === 'hospital') {
        const regNo = data.registration_no?.trim() || `HOSP-REG-${userId}-${Date.now().toString().slice(-4)}`;
        db.prepare(
          `INSERT INTO hospitals (user_id, name, registration_no, verification_status, email, phone, address, city, state, departments_json, facilities_json)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          userId,
          data.organization_name || data.full_name,
          regNo,
          data.email.toLowerCase(),
          data.phone || '',
          data.address || '',
          data.city || '',
          data.state || '',
          JSON.stringify(['General Medicine', 'Emergency Medicine']),
          JSON.stringify(['OPD Clinic', '24x7 Triage'])
        );
      } else if (data.role === 'pharmacy') {
        const licenseNo = data.license_no?.trim() || data.registration_no?.trim() || `PHARM-REG-${userId}-${Date.now().toString().slice(-4)}`;
        db.prepare(
          `INSERT INTO pharmacies (user_id, name, license_no, verification_status, phone, address, city)
           VALUES (?, ?, ?, 'pending', ?, ?, ?)`
        ).run(
          userId,
          data.organization_name || data.full_name,
          licenseNo,
          data.phone || '',
          data.address || '',
          data.city || ''
        );
      }

      return userId;
    })();

    const authUser = {
      id: createdUserId,
      email: data.email.toLowerCase(),
      role: data.role as UserRole,
      full_name: data.full_name,
    };

    const accessToken = signAccessToken(authUser);
    const refreshToken = signRefreshToken(authUser);
    const expiresAt = new Date(Date.now() + ENV.REFRESH_TOKEN_TTL_DAYS * 86400 * 1000).toISOString();

    db.prepare(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`
    ).run(createdUserId, hashToken(refreshToken), expiresAt);

    logAudit({
      actorUserId: createdUserId,
      actorRole: data.role,
      action: 'USER_REGISTERED',
      resourceType: 'users',
      resourceId: createdUserId,
      ipAddress: req.ip,
    });

    const context = buildUserContext(createdUserId, data.role);
    res.status(201).json({
      accessToken,
      refreshToken,
      ...context,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Registration error';
    if (msg.includes('UNIQUE')) {
      res.status(409).json({ error: 'Duplicate license, registration number, or email.' });
      return;
    }
    res.status(500).json({ error: 'Failed to register user.' });
  }
});

router.post('/login', authLimiter, (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid email and password are required.' });
    return;
  }

  const db = getDb();
  const userRow = db
    .prepare('SELECT id, email, password_hash, role, full_name, is_active FROM users WHERE email = ?')
    .get(parsed.data.email.toLowerCase()) as
    | {
        id: number;
        email: string;
        password_hash: string;
        role: UserRole;
        full_name: string;
        is_active: number;
      }
    | undefined;

  if (!userRow || !bcrypt.compareSync(parsed.data.password, userRow.password_hash)) {
    logAudit({
      action: 'LOGIN_FAILED',
      resourceType: 'users',
      ipAddress: req.ip,
      details: { email: parsed.data.email.toLowerCase() },
    });
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  if (!userRow.is_active) {
    res.status(403).json({ error: 'This account has been deactivated.' });
    return;
  }

  const authUser = {
    id: userRow.id,
    email: userRow.email,
    role: userRow.role,
    full_name: userRow.full_name,
  };

  const accessToken = signAccessToken(authUser);
  const refreshToken = signRefreshToken(authUser);
  const expiresAt = new Date(Date.now() + ENV.REFRESH_TOKEN_TTL_DAYS * 86400 * 1000).toISOString();

  db.prepare(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`).run(
    userRow.id,
    hashToken(refreshToken),
    expiresAt
  );

  logAudit({
    actorUserId: userRow.id,
    actorRole: userRow.role,
    action: 'USER_LOGGED_IN',
    resourceType: 'users',
    resourceId: userRow.id,
    ipAddress: req.ip,
  });

  const context = buildUserContext(userRow.id, userRow.role);
  res.json({
    accessToken,
    refreshToken,
    ...context,
  });
});

router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token is required.' });
    return;
  }

  try {
    const payload = jwt.verify(refreshToken, ENV.JWT_REFRESH_SECRET) as unknown as {
      sub: number;
      role: UserRole;
    };

    const db = getDb();
    const tokenHash = hashToken(refreshToken);
    const stored = db
      .prepare(
        `SELECT id, user_id, expires_at, revoked FROM refresh_tokens WHERE token_hash = ?`
      )
      .get(tokenHash) as
      | { id: number; user_id: number; expires_at: string; revoked: number }
      | undefined;

    if (!stored || stored.revoked || new Date(stored.expires_at) < new Date()) {
      res.status(401).json({ error: 'Refresh token expired or revoked.' });
      return;
    }

    const userRow = db
      .prepare('SELECT id, email, role, full_name, is_active FROM users WHERE id = ?')
      .get(payload.sub) as
      | { id: number; email: string; role: UserRole; full_name: string; is_active: number }
      | undefined;

    if (!userRow || !userRow.is_active) {
      res.status(401).json({ error: 'User not active.' });
      return;
    }

    // Rotate refresh token
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(stored.id);

    const authUser = {
      id: userRow.id,
      email: userRow.email,
      role: userRow.role,
      full_name: userRow.full_name,
    };
    const newAccessToken = signAccessToken(authUser);
    const newRefreshToken = signRefreshToken(authUser);
    const expiresAt = new Date(Date.now() + ENV.REFRESH_TOKEN_TTL_DAYS * 86400 * 1000).toISOString();

    db.prepare(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`).run(
      userRow.id,
      hashToken(newRefreshToken),
      expiresAt
    );

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token.' });
  }
});

router.post('/logout', (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (refreshToken) {
    const db = getDb();
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').run(hashToken(refreshToken));
  }
  res.json({ message: 'Logged out successfully.' });
});

router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const context = buildUserContext(req.user!.id, req.user!.role);
  if (!context) {
    res.status(404).json({ error: 'User context not found.' });
    return;
  }
  res.json(context);
});

export default router;
