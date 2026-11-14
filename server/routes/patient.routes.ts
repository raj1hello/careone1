import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database.ts';
import { logAudit, requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();

const updateProfileSchema = z.object({
  full_name: z.string().min(2).max(120).optional(),
  phone: z.string().max(30).optional(),
  dob: z.string().max(30).optional(),
  gender: z.string().max(30).optional(),
  blood_group: z.string().max(10).optional(),
  address: z.string().max(300).optional(),
  emergency_contact_name: z.string().max(120).optional(),
  emergency_contact_phone: z.string().max(30).optional(),
  allergies: z.string().max(500).optional(),
  chronic_conditions: z.string().max(500).optional(),
  insurance_provider: z.string().max(120).optional(),
  insurance_policy_no: z.string().max(100).optional(),
  height_cm: z.coerce.number().min(30).max(260).optional().nullable(),
  weight_kg: z.coerce.number().min(1).max(400).optional().nullable(),
});

const reminderSchema = z.object({
  medicine_name: z.string().min(2).max(160),
  dosage: z.string().min(1).max(80),
  schedule_time: z.string().min(3).max(20),
  frequency: z.string().min(2).max(60).default('Daily'),
});

router.get('/dashboard', requireAuth, requireRole('patient'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const patient = db
    .prepare(
      `SELECT p.*, u.full_name, u.email, u.phone
       FROM patients p
       JOIN users u ON p.user_id = u.id
       WHERE p.user_id = ?`
    )
    .get(req.user!.id) as Record<string, unknown> | undefined;

  if (!patient) {
    res.status(404).json({ error: 'Patient profile not found.' });
    return;
  }

  const patientId = Number(patient.id);

  const upcomingAppointments = db
    .prepare(
      `SELECT a.*, du.full_name as doctor_name, d.specialization, d.consultation_fee, h.name as hospital_name, c.room_code
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.id
       JOIN users du ON d.user_id = du.id
       LEFT JOIN hospitals h ON a.hospital_id = h.id
       LEFT JOIN consultations c ON c.appointment_id = a.id
       WHERE a.patient_id = ? AND a.status IN ('pending', 'accepted', 'rescheduled')
       ORDER BY a.appointment_date ASC, a.time_slot ASC`
    )
    .all(patientId);

  const activePrescriptions = db
    .prepare(
      `SELECT rx.*, du.full_name as doctor_name, d.specialization
       FROM prescriptions rx
       JOIN doctors d ON rx.doctor_id = d.id
       JOIN users du ON d.user_id = du.id
       WHERE rx.patient_id = ?
       ORDER BY rx.created_at DESC
       LIMIT 5`
    )
    .all(patientId) as Array<Record<string, unknown>>;

  for (const rx of activePrescriptions) {
    rx.items = db
      .prepare('SELECT * FROM prescription_items WHERE prescription_id = ?')
      .all(rx.id);
  }

  const reminders = db
    .prepare('SELECT * FROM medicine_reminders WHERE patient_id = ? ORDER BY schedule_time ASC')
    .all(patientId);

  const recentOrders = db
    .prepare(
      `SELECT mo.*, ph.name as pharmacy_name
       FROM medicine_orders mo
       JOIN pharmacies ph ON mo.pharmacy_id = ph.id
       WHERE mo.patient_id = ?
       ORDER BY mo.created_at DESC
       LIMIT 5`
    )
    .all(patientId);

  const admissions = db
    .prepare(
      `SELECT adm.*, h.name as hospital_name, b.bed_number, b.ward_name, b.bed_type
       FROM admissions adm
       JOIN hospitals h ON adm.hospital_id = h.id
       LEFT JOIN beds b ON adm.bed_id = b.id
       WHERE adm.patient_id = ?
       ORDER BY adm.admitted_at DESC`
    )
    .all(patientId);

  const stats = {
    upcoming_appointments: upcomingAppointments.length,
    active_prescriptions: activePrescriptions.filter((r) => r.status === 'active').length,
    medical_records_count: (
      db.prepare('SELECT COUNT(*) as cnt FROM medical_records WHERE patient_id = ?').get(patientId) as { cnt: number }
    ).cnt,
    pending_orders: (
      db
        .prepare(
          "SELECT COUNT(*) as cnt FROM medicine_orders WHERE patient_id = ? AND status NOT IN ('delivered', 'cancelled', 'rejected')"
        )
        .get(patientId) as { cnt: number }
    ).cnt,
  };

  res.json({
    patient,
    stats,
    upcomingAppointments,
    activePrescriptions,
    reminders,
    recentOrders,
    admissions,
  });
});

router.put('/profile', requireAuth, requireRole('patient'), (req: AuthenticatedRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid profile data', details: parsed.error.flatten() });
    return;
  }

  const db = getDb();
  const data = parsed.data;
  const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(req.user!.id) as
    | { id: number }
    | undefined;
  if (!patient) {
    res.status(404).json({ error: 'Patient record not found.' });
    return;
  }

  db.transaction(() => {
    if (data.full_name || data.phone !== undefined) {
      db.prepare(
        `UPDATE users SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone), updated_at = datetime('now') WHERE id = ?`
      ).run(data.full_name ?? null, data.phone ?? null, req.user!.id);
    }

    db.prepare(
      `UPDATE patients SET
        dob = COALESCE(?, dob),
        gender = COALESCE(?, gender),
        blood_group = COALESCE(?, blood_group),
        address = COALESCE(?, address),
        emergency_contact_name = COALESCE(?, emergency_contact_name),
        emergency_contact_phone = COALESCE(?, emergency_contact_phone),
        allergies = COALESCE(?, allergies),
        chronic_conditions = COALESCE(?, chronic_conditions),
        insurance_provider = COALESCE(?, insurance_provider),
        insurance_policy_no = COALESCE(?, insurance_policy_no),
        height_cm = COALESCE(?, height_cm),
        weight_kg = COALESCE(?, weight_kg)
       WHERE id = ?`
    ).run(
      data.dob ?? null,
      data.gender ?? null,
      data.blood_group ?? null,
      data.address ?? null,
      data.emergency_contact_name ?? null,
      data.emergency_contact_phone ?? null,
      data.allergies ?? null,
      data.chronic_conditions ?? null,
      data.insurance_provider ?? null,
      data.insurance_policy_no ?? null,
      data.height_cm ?? null,
      data.weight_kg ?? null,
      patient.id
    );
  })();

  logAudit({
    actorUserId: req.user!.id,
    actorRole: req.user!.role,
    action: 'PATIENT_PROFILE_UPDATED',
    resourceType: 'patients',
    resourceId: patient.id,
    ipAddress: req.ip,
  });

  const updated = db
    .prepare(
      `SELECT p.*, u.full_name, u.email, u.phone FROM patients p JOIN users u ON p.user_id = u.id WHERE p.id = ?`
    )
    .get(patient.id);
  res.json({ patient: updated });
});

// Medicine Reminders
router.get('/reminders', requireAuth, requireRole('patient'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(req.user!.id) as { id: number } | undefined;
  if (!patient) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }
  const reminders = db
    .prepare('SELECT * FROM medicine_reminders WHERE patient_id = ? ORDER BY schedule_time ASC')
    .all(patient.id);
  res.json({ reminders });
});

router.post('/reminders', requireAuth, requireRole('patient'), (req: AuthenticatedRequest, res) => {
  const parsed = reminderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid reminder fields', details: parsed.error.flatten() });
    return;
  }
  const db = getDb();
  const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(req.user!.id) as { id: number } | undefined;
  if (!patient) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }

  const info = db
    .prepare(
      `INSERT INTO medicine_reminders (patient_id, medicine_name, dosage, schedule_time, frequency)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      patient.id,
      parsed.data.medicine_name,
      parsed.data.dosage,
      parsed.data.schedule_time,
      parsed.data.frequency
    );

  const created = db.prepare('SELECT * FROM medicine_reminders WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ reminder: created });
});

router.patch('/reminders/:id/taken', requireAuth, requireRole('patient'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(req.user!.id) as { id: number } | undefined;
  if (!patient) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }
  const rem = db
    .prepare('SELECT * FROM medicine_reminders WHERE id = ? AND patient_id = ?')
    .get(Number(req.params.id), patient.id);
  if (!rem) {
    res.status(404).json({ error: 'Reminder not found.' });
    return;
  }
  db.prepare(`UPDATE medicine_reminders SET last_taken_at = datetime('now') WHERE id = ?`).run(Number(req.params.id));
  const updated = db.prepare('SELECT * FROM medicine_reminders WHERE id = ?').get(Number(req.params.id));
  res.json({ reminder: updated });
});

router.delete('/reminders/:id', requireAuth, requireRole('patient'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(req.user!.id) as { id: number } | undefined;
  if (!patient) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }
  const result = db
    .prepare('DELETE FROM medicine_reminders WHERE id = ? AND patient_id = ?')
    .run(Number(req.params.id), patient.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Reminder not found.' });
    return;
  }
  res.json({ deleted: true });
});

// Financial Assistance Information
router.get('/financial-assistance', requireAuth, (_req, res) => {
  const db = getDb();
  const programs = db.prepare('SELECT * FROM financial_assistance_programs ORDER BY id ASC').all();
  res.json({ programs });
});

export default router;
