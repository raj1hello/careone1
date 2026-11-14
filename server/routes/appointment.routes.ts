import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { getDb } from '../db/database.ts';
import {
  createNotification,
  logAudit,
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';

const router = Router();

const bookSchema = z.object({
  doctor_id: z.coerce.number().int().positive(),
  appointment_date: z.string().min(8).max(20),
  time_slot: z.string().min(3).max(20),
  mode: z.enum(['in_person', 'video']).default('in_person'),
  reason: z.string().min(2).max(500),
});

const rescheduleSchema = z.object({
  appointment_date: z.string().min(8).max(20),
  time_slot: z.string().min(3).max(20),
});

// List appointments scoped strictly to the authenticated user's role
router.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = req.user!;

  if (user.role === 'patient') {
    const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(user.id) as { id: number } | undefined;
    if (!patient) return void res.json({ appointments: [] });
    const rows = db
      .prepare(
        `SELECT a.*, du.full_name as doctor_name, d.specialization, d.consultation_fee,
                h.name as hospital_name, c.id as consultation_id, c.room_code, c.status as consultation_status
         FROM appointments a
         JOIN doctors d ON a.doctor_id = d.id
         JOIN users du ON d.user_id = du.id
         LEFT JOIN hospitals h ON a.hospital_id = h.id
         LEFT JOIN consultations c ON c.appointment_id = a.id
         WHERE a.patient_id = ?
         ORDER BY a.appointment_date DESC, a.time_slot ASC`
      )
      .all(patient.id);
    return void res.json({ appointments: rows });
  }

  if (user.role === 'doctor') {
    const doctor = db.prepare('SELECT id FROM doctors WHERE user_id = ?').get(user.id) as { id: number } | undefined;
    if (!doctor) return void res.json({ appointments: [] });
    const rows = db
      .prepare(
        `SELECT a.*, pu.full_name as patient_name, p.mrn, p.blood_group, p.allergies,
                h.name as hospital_name, c.id as consultation_id, c.room_code, c.status as consultation_status
         FROM appointments a
         JOIN patients p ON a.patient_id = p.id
         JOIN users pu ON p.user_id = pu.id
         LEFT JOIN hospitals h ON a.hospital_id = h.id
         LEFT JOIN consultations c ON c.appointment_id = a.id
         WHERE a.doctor_id = ?
         ORDER BY a.appointment_date DESC, a.time_slot ASC`
      )
      .all(doctor.id);
    return void res.json({ appointments: rows });
  }

  if (user.role === 'hospital') {
    const hospital = db.prepare('SELECT id FROM hospitals WHERE user_id = ?').get(user.id) as { id: number } | undefined;
    if (!hospital) return void res.json({ appointments: [] });
    const rows = db
      .prepare(
        `SELECT a.*, pu.full_name as patient_name, p.mrn, du.full_name as doctor_name, d.specialization
         FROM appointments a
         JOIN patients p ON a.patient_id = p.id
         JOIN users pu ON p.user_id = pu.id
         JOIN doctors d ON a.doctor_id = d.id
         JOIN users du ON d.user_id = du.id
         WHERE a.hospital_id = ?
         ORDER BY a.appointment_date DESC, a.time_slot ASC`
      )
      .all(hospital.id);
    return void res.json({ appointments: rows });
  }

  res.status(403).json({ error: 'Not authorized to view appointments.' });
});

// Patient books an appointment
router.post('/', requireAuth, requireRole('patient'), (req: AuthenticatedRequest, res) => {
  const parsed = bookSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid appointment details', details: parsed.error.flatten() });
    return;
  }

  const db = getDb();
  const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(req.user!.id) as { id: number } | undefined;
  if (!patient) {
    res.status(404).json({ error: 'Patient profile not found.' });
    return;
  }

  const doctor = db
    .prepare('SELECT d.*, u.id as doc_user_id, u.full_name as doc_name FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = ?')
    .get(parsed.data.doctor_id) as Record<string, any> | undefined;
  if (!doctor) {
    res.status(404).json({ error: 'Selected doctor not found.' });
    return;
  }

  // Prevent double booking at exact same slot
  const conflict = db
    .prepare(
      `SELECT id FROM appointments
       WHERE doctor_id = ? AND appointment_date = ? AND time_slot = ? AND status IN ('pending', 'accepted', 'rescheduled')`
    )
    .get(doctor.id, parsed.data.appointment_date, parsed.data.time_slot);
  if (conflict) {
    res.status(409).json({ error: 'This time slot is already booked with the doctor. Please pick another slot.' });
    return;
  }

  const info = db
    .prepare(
      `INSERT INTO appointments (patient_id, doctor_id, hospital_id, appointment_date, time_slot, mode, status, reason)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
    )
    .run(
      patient.id,
      doctor.id,
      doctor.hospital_id ?? null,
      parsed.data.appointment_date,
      parsed.data.time_slot,
      parsed.data.mode,
      parsed.data.reason
    );

  createNotification({
    userId: Number(doctor.doc_user_id),
    title: 'New Appointment Request',
    message: `${req.user!.full_name} requested a ${parsed.data.mode === 'video' ? 'VidDoc' : 'clinic'} slot on ${parsed.data.appointment_date} at ${parsed.data.time_slot}.`,
    category: 'appointment',
    actionUrl: '/doctor/appointments',
  });

  logAudit({
    actorUserId: req.user!.id,
    actorRole: req.user!.role,
    action: 'APPOINTMENT_BOOKED',
    resourceType: 'appointments',
    resourceId: info.lastInsertRowid.toString(),
    ipAddress: req.ip,
  });

  const created = db.prepare('SELECT * FROM appointments WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ appointment: created });
});

// Patient reschedules appointment
router.patch('/:id/reschedule', requireAuth, requireRole('patient'), (req: AuthenticatedRequest, res) => {
  const parsed = rescheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid date or time slot.' });
    return;
  }

  const db = getDb();
  const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(req.user!.id) as { id: number } | undefined;
  if (!patient) return void res.status(404).json({ error: 'Patient not found.' });

  const appt = db
    .prepare('SELECT * FROM appointments WHERE id = ? AND patient_id = ?')
    .get(Number(req.params.id), patient.id) as Record<string, any> | undefined;
  if (!appt) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }
  if (appt.status === 'completed' || appt.status === 'cancelled') {
    res.status(400).json({ error: 'Cannot reschedule a completed or cancelled appointment.' });
    return;
  }

  db.prepare(
    `UPDATE appointments SET appointment_date = ?, time_slot = ?, status = 'rescheduled', updated_at = datetime('now') WHERE id = ?`
  ).run(parsed.data.appointment_date, parsed.data.time_slot, appt.id);

  const doctor = db.prepare('SELECT user_id FROM doctors WHERE id = ?').get(appt.doctor_id) as { user_id: number };
  createNotification({
    userId: doctor.user_id,
    title: 'Appointment Rescheduled',
    message: `${req.user!.full_name} rescheduled appointment #${appt.id} to ${parsed.data.appointment_date} at ${parsed.data.time_slot}.`,
    category: 'appointment',
    actionUrl: '/doctor/appointments',
  });

  const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appt.id);
  res.json({ appointment: updated });
});

// Patient cancels appointment
router.patch('/:id/cancel', requireAuth, requireRole('patient'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(req.user!.id) as { id: number } | undefined;
  if (!patient) return void res.status(404).json({ error: 'Patient not found.' });

  const appt = db
    .prepare('SELECT * FROM appointments WHERE id = ? AND patient_id = ?')
    .get(Number(req.params.id), patient.id) as Record<string, any> | undefined;
  if (!appt) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }

  db.prepare(`UPDATE appointments SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(appt.id);
  const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appt.id);
  res.json({ appointment: updated });
});

// Doctor accepts / rejects / completes appointment (automatically provisions VidDoc consultation room on accept)
router.patch('/:id/status', requireAuth, requireRole('doctor'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    status: z.enum(['accepted', 'rejected', 'completed']),
    notes: z.string().max(500).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Status must be accepted, rejected, or completed.' });
    return;
  }

  const db = getDb();
  const doctor = db.prepare('SELECT id FROM doctors WHERE user_id = ?').get(req.user!.id) as { id: number } | undefined;
  if (!doctor) return void res.status(404).json({ error: 'Doctor profile not found.' });

  const appt = db
    .prepare('SELECT * FROM appointments WHERE id = ? AND doctor_id = ?')
    .get(Number(req.params.id), doctor.id) as Record<string, any> | undefined;
  if (!appt) {
    res.status(404).json({ error: 'Appointment not found for this doctor.' });
    return;
  }

  let roomCode: string | null = null;
  db.transaction(() => {
    db.prepare(
      `UPDATE appointments SET status = ?, notes = COALESCE(?, notes), updated_at = datetime('now') WHERE id = ?`
    ).run(parsed.data.status, parsed.data.notes ?? null, appt.id);

    if (parsed.data.status === 'accepted') {
      const existingConsult = db
        .prepare('SELECT id, room_code FROM consultations WHERE appointment_id = ?')
        .get(appt.id) as { id: number; room_code: string } | undefined;
      if (!existingConsult) {
        roomCode = `VID-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${appt.id}`;
        db.prepare(
          `INSERT INTO consultations (appointment_id, patient_id, doctor_id, room_code, status, chief_complaint)
           VALUES (?, ?, ?, ?, 'scheduled', ?)`
        ).run(appt.id, appt.patient_id, appt.doctor_id, roomCode, appt.reason || '');
      } else {
        roomCode = existingConsult.room_code;
      }
    }
  })();

  const patient = db.prepare('SELECT user_id FROM patients WHERE id = ?').get(appt.patient_id) as { user_id: number };
  createNotification({
    userId: patient.user_id,
    title: `Appointment ${parsed.data.status.toUpperCase()}`,
    message:
      parsed.data.status === 'accepted'
        ? `${req.user!.full_name} accepted your appointment (${appt.appointment_date} ${appt.time_slot}).${roomCode ? ` Room: ${roomCode}` : ''}`
        : `${req.user!.full_name} marked your appointment as ${parsed.data.status}.`,
    category: 'appointment',
    actionUrl: '/patient/consultations',
  });

  logAudit({
    actorUserId: req.user!.id,
    actorRole: req.user!.role,
    action: `APPOINTMENT_${parsed.data.status.toUpperCase()}`,
    resourceType: 'appointments',
    resourceId: appt.id,
    ipAddress: req.ip,
  });

  const updated = db
    .prepare(
      `SELECT a.*, c.id as consultation_id, c.room_code
       FROM appointments a
       LEFT JOIN consultations c ON c.appointment_id = a.id
       WHERE a.id = ?`
    )
    .get(appt.id);
  res.json({ appointment: updated });
});

export default router;
