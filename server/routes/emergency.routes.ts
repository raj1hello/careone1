import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database.ts';
import {
  createNotification,
  logAudit,
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';

const router = Router();

const emergencySchema = z.object({
  hospital_id: z.coerce.number().int().positive().optional().nullable(),
  emergency_type: z.string().min(2).max(120),
  severity: z.enum(['critical', 'high', 'moderate']).default('high'),
  pickup_location: z.string().min(4).max(300),
  contact_phone: z.string().min(6).max(30),
  description: z.string().max(1000).optional().default(''),
});

router.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = req.user!;

  if (user.role === 'patient') {
    const rows = db
      .prepare(
        `SELECT e.*, h.name as hospital_name, h.emergency_phone
         FROM emergency_requests e
         LEFT JOIN hospitals h ON e.hospital_id = h.id
         WHERE e.requester_user_id = ?
         ORDER BY e.created_at DESC`
      )
      .all(user.id);
    return void res.json({ requests: rows });
  }

  if (user.role === 'hospital' || user.role === 'admin') {
    const hospital =
      user.role === 'hospital'
        ? (db.prepare('SELECT id FROM hospitals WHERE user_id = ?').get(user.id) as { id: number } | undefined)
        : undefined;
    const rows = hospital
      ? db
          .prepare(
            `SELECT e.*, u.full_name as requester_name, p.mrn
             FROM emergency_requests e
             JOIN users u ON e.requester_user_id = u.id
             LEFT JOIN patients p ON e.patient_id = p.id
             WHERE e.hospital_id = ? OR e.hospital_id IS NULL
             ORDER BY e.created_at DESC`
          )
          .all(hospital.id)
      : db.prepare('SELECT * FROM emergency_requests ORDER BY created_at DESC').all();
    return void res.json({ requests: rows });
  }

  res.status(403).json({ error: 'Not authorized to view emergency queue.' });
});

router.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const parsed = emergencySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid emergency request payload', details: parsed.error.flatten() });
    return;
  }

  const db = getDb();
  const d = parsed.data;
  const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(req.user!.id) as { id: number } | undefined;

  let targetHospitalId = d.hospital_id ?? null;
  let targetHospitalUserId: number | null = null;
  if (!targetHospitalId) {
    const firstHosp = db
      .prepare("SELECT id, user_id FROM hospitals WHERE verification_status = 'verified' ORDER BY id ASC LIMIT 1")
      .get() as { id: number; user_id: number } | undefined;
    if (firstHosp) {
      targetHospitalId = firstHosp.id;
      targetHospitalUserId = firstHosp.user_id;
    }
  } else {
    const h = db.prepare('SELECT user_id FROM hospitals WHERE id = ?').get(targetHospitalId) as
      | { user_id: number }
      | undefined;
    if (h) targetHospitalUserId = h.user_id;
  }

  const info = db
    .prepare(
      `INSERT INTO emergency_requests (patient_id, requester_user_id, hospital_id, emergency_type, severity, pickup_location, contact_phone, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'requested')`
    )
    .run(
      patient?.id ?? null,
      req.user!.id,
      targetHospitalId,
      d.emergency_type,
      d.severity,
      d.pickup_location,
      d.contact_phone,
      d.description
    );

  if (targetHospitalUserId) {
    createNotification({
      userId: targetHospitalUserId,
      title: `EMERGENCY DISPATCH ALERT (${d.severity.toUpperCase()})`,
      message: `${d.emergency_type} at ${d.pickup_location}. Contact: ${d.contact_phone}`,
      category: 'emergency',
      actionUrl: '/hospital/emergency',
    });
  }

  logAudit({
    actorUserId: req.user!.id,
    actorRole: req.user!.role,
    action: 'EMERGENCY_REQUESTED',
    resourceType: 'emergency_requests',
    resourceId: info.lastInsertRowid.toString(),
    ipAddress: req.ip,
  });

  const created = db.prepare('SELECT * FROM emergency_requests WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ request: created });
});

router.patch('/:id/status', requireAuth, requireRole('hospital', 'admin'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    status: z.enum(['dispatched', 'en_route', 'arrived', 'admitted', 'resolved']),
    ambulance_unit: z.string().max(40).optional(),
    eta_minutes: z.coerce.number().int().min(0).max(240).optional().nullable(),
    assigned_doctor_id: z.coerce.number().int().positive().optional().nullable(),
    department: z.string().max(120).optional(),
    bed_id: z.coerce.number().int().positive().optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid emergency dispatch update' });
    return;
  }

  const db = getDb();
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM emergency_requests WHERE id = ?').get(id) as Record<string, any> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Emergency request not found.' });
    return;
  }

  db.transaction(() => {
    db.prepare(
      `UPDATE emergency_requests
       SET status = ?,
           ambulance_unit = COALESCE(?, ambulance_unit),
           eta_minutes = COALESCE(?, eta_minutes),
           assigned_doctor_id = COALESCE(?, assigned_doctor_id),
           department = COALESCE(?, department),
           bed_id = COALESCE(?, bed_id),
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      parsed.data.status,
      parsed.data.ambulance_unit ?? null,
      parsed.data.eta_minutes ?? null,
      parsed.data.assigned_doctor_id ?? null,
      parsed.data.department ?? null,
      parsed.data.bed_id ?? null,
      id
    );

    if (parsed.data.bed_id) {
      db.prepare("UPDATE beds SET status = 'reserved' WHERE id = ? AND status = 'available'").run(parsed.data.bed_id);
    }
  })();

  createNotification({
    userId: Number(existing.requester_user_id),
    title: `Ambulance Update: ${parsed.data.status.toUpperCase()}`,
    message: `Emergency #${id} status is now ${parsed.data.status}${parsed.data.ambulance_unit ? ` (Unit ${parsed.data.ambulance_unit})` : ''}${parsed.data.eta_minutes ? `, ETA ${parsed.data.eta_minutes} min` : ''}.`,
    category: 'emergency',
    actionUrl: '/patient/emergency',
  });

  const updated = db.prepare('SELECT * FROM emergency_requests WHERE id = ?').get(id);
  res.json({ request: updated });
});

export default router;
