import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database.ts';
import { logAudit, requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();

router.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = req.user!;

  if (user.role === 'patient') {
    const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(user.id) as { id: number } | undefined;
    if (!patient) return void res.json({ consultations: [] });
    const rows = db
      .prepare(
        `SELECT c.*, a.appointment_date, a.time_slot, a.mode, du.full_name as doctor_name, d.specialization
         FROM consultations c
         JOIN appointments a ON c.appointment_id = a.id
         JOIN doctors d ON c.doctor_id = d.id
         JOIN users du ON d.user_id = du.id
         WHERE c.patient_id = ?
         ORDER BY a.appointment_date DESC, c.created_at DESC`
      )
      .all(patient.id);
    return void res.json({ consultations: rows });
  }

  if (user.role === 'doctor') {
    const doctor = db.prepare('SELECT id FROM doctors WHERE user_id = ?').get(user.id) as { id: number } | undefined;
    if (!doctor) return void res.json({ consultations: [] });
    const rows = db
      .prepare(
        `SELECT c.*, a.appointment_date, a.time_slot, a.mode, pu.full_name as patient_name, p.mrn
         FROM consultations c
         JOIN appointments a ON c.appointment_id = a.id
         JOIN patients p ON c.patient_id = p.id
         JOIN users pu ON p.user_id = pu.id
         WHERE c.doctor_id = ?
         ORDER BY a.appointment_date DESC, c.created_at DESC`
      )
      .all(doctor.id);
    return void res.json({ consultations: rows });
  }

  res.status(403).json({ error: 'Only patients and doctors can access consultations.' });
});

router.get('/:roomCode', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const consult = db
    .prepare(
      `SELECT c.*, a.appointment_date, a.time_slot, a.mode,
              pu.full_name as patient_name, p.mrn, p.user_id as patient_user_id, p.blood_group, p.allergies,
              du.full_name as doctor_name, d.specialization, d.user_id as doctor_user_id
       FROM consultations c
       JOIN appointments a ON c.appointment_id = a.id
       JOIN patients p ON c.patient_id = p.id
       JOIN users pu ON p.user_id = pu.id
       JOIN doctors d ON c.doctor_id = d.id
       JOIN users du ON d.user_id = du.id
       WHERE c.room_code = ?`
    )
    .get(req.params.roomCode) as Record<string, any> | undefined;

  if (!consult) {
    res.status(404).json({ error: 'Consultation room not found.' });
    return;
  }

  if (req.user!.id !== consult.patient_user_id && req.user!.id !== consult.doctor_user_id) {
    res.status(403).json({ error: 'Unauthorized to access this consultation room.' });
    return;
  }

  res.json({ consultation: consult });
});

router.patch('/:id', requireAuth, requireRole('doctor'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    status: z.enum(['scheduled', 'active', 'ended']).optional(),
    chief_complaint: z.string().max(1000).optional(),
    clinical_notes: z.string().max(4000).optional(),
    vitals: z
      .object({
        bp: z.string().optional(),
        hr: z.string().optional(),
        spo2: z.string().optional(),
        temp: z.string().optional(),
      })
      .optional(),
    follow_up_date: z.string().max(30).optional(),
    follow_up_notes: z.string().max(1000).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid consultation payload', details: parsed.error.flatten() });
    return;
  }

  const db = getDb();
  const doctor = db.prepare('SELECT id FROM doctors WHERE user_id = ?').get(req.user!.id) as { id: number } | undefined;
  if (!doctor) return void res.status(404).json({ error: 'Doctor profile not found.' });

  const consult = db
    .prepare('SELECT * FROM consultations WHERE id = ? AND doctor_id = ?')
    .get(Number(req.params.id), doctor.id) as Record<string, any> | undefined;
  if (!consult) {
    res.status(404).json({ error: 'Consultation not found.' });
    return;
  }

  const d = parsed.data;
  db.transaction(() => {
    db.prepare(
      `UPDATE consultations SET
        status = COALESCE(?, status),
        started_at = CASE WHEN ? = 'active' AND started_at IS NULL THEN datetime('now') ELSE started_at END,
        ended_at = CASE WHEN ? = 'ended' THEN datetime('now') ELSE ended_at END,
        chief_complaint = COALESCE(?, chief_complaint),
        clinical_notes = COALESCE(?, clinical_notes),
        vitals_json = COALESCE(?, vitals_json),
        follow_up_date = COALESCE(?, follow_up_date),
        follow_up_notes = COALESCE(?, follow_up_notes)
       WHERE id = ?`
    ).run(
      d.status ?? null,
      d.status ?? null,
      d.status ?? null,
      d.chief_complaint ?? null,
      d.clinical_notes ?? null,
      d.vitals ? JSON.stringify(d.vitals) : null,
      d.follow_up_date ?? null,
      d.follow_up_notes ?? null,
      consult.id
    );

    if (d.status === 'ended') {
      db.prepare(`UPDATE appointments SET status = 'completed', updated_at = datetime('now') WHERE id = ?`).run(
        consult.appointment_id
      );
    }
  })();

  logAudit({
    actorUserId: req.user!.id,
    actorRole: req.user!.role,
    action: 'CONSULTATION_UPDATED',
    resourceType: 'consultations',
    resourceId: consult.id,
    ipAddress: req.ip,
  });

  const updated = db.prepare('SELECT * FROM consultations WHERE id = ?').get(consult.id);
  res.json({ consultation: updated });
});

export default router;
