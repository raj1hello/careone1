import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database.ts';
import {
  doctorHasPatientAccess,
  logAudit,
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';

const router = Router();

const updateDoctorProfileSchema = z.object({
  full_name: z.string().min(2).max(120).optional(),
  phone: z.string().max(30).optional(),
  hospital_id: z.coerce.number().int().positive().optional().nullable(),
  specialization: z.string().min(2).max(120).optional(),
  qualification: z.string().min(2).max(200).optional(),
  experience_years: z.coerce.number().int().min(0).max(70).optional(),
  consultation_fee: z.coerce.number().min(0).optional(),
  bio: z.string().max(1000).optional(),
  available_days: z.array(z.string()).optional(),
  slot_start_time: z.string().max(10).optional(),
  slot_end_time: z.string().max(10).optional(),
  is_available_for_video: z.boolean().optional(),
});

// Public / Patient doctor discovery & filtering
router.get('/', (req, res) => {
  const { specialization, hospital_id, search, video_only, verified_only } = req.query as Record<string, string>;
  const db = getDb();

  let sql = `
    SELECT d.id, d.user_id, d.hospital_id, d.license_no, d.verification_status, d.specialization,
           d.qualification, d.experience_years, d.consultation_fee, d.bio, d.available_days_json,
           d.slot_start_time, d.slot_end_time, d.is_available_for_video, d.rating,
           u.full_name, u.email, u.phone,
           h.name as hospital_name, h.city as hospital_city
    FROM doctors d
    JOIN users u ON d.user_id = u.id
    LEFT JOIN hospitals h ON d.hospital_id = h.id
    WHERE u.is_active = 1
  `;
  const params: unknown[] = [];

  if (verified_only !== 'false') {
    sql += ` AND d.verification_status = 'verified'`;
  }
  if (specialization && specialization !== 'all') {
    sql += ` AND LOWER(d.specialization) LIKE LOWER(?)`;
    params.push(`%${specialization}%`);
  }
  if (hospital_id && hospital_id !== 'all') {
    sql += ` AND d.hospital_id = ?`;
    params.push(Number(hospital_id));
  }
  if (video_only === 'true') {
    sql += ` AND d.is_available_for_video = 1`;
  }
  if (search) {
    sql += ` AND (LOWER(u.full_name) LIKE LOWER(?) OR LOWER(d.specialization) LIKE LOWER(?) OR LOWER(COALESCE(h.name, '')) LIKE LOWER(?))`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  sql += ` ORDER BY d.rating DESC, d.experience_years DESC`;

  const doctors = db.prepare(sql).all(...params);
  res.json({ doctors });
});

// Doctor Dashboard
router.get('/dashboard', requireAuth, requireRole('doctor'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const doctor = db
    .prepare(
      `SELECT d.*, u.full_name, u.email, u.phone, h.name as hospital_name, h.city as hospital_city
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       LEFT JOIN hospitals h ON d.hospital_id = h.id
       WHERE d.user_id = ?`
    )
    .get(req.user!.id) as Record<string, unknown> | undefined;

  if (!doctor) {
    res.status(404).json({ error: 'Doctor profile not found.' });
    return;
  }

  const doctorId = Number(doctor.id);

  const appointments = db
    .prepare(
      `SELECT a.*, pu.full_name as patient_name, p.mrn, p.blood_group, p.gender, p.dob, p.allergies,
              c.id as consultation_id, c.room_code, c.status as consultation_status
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN users pu ON p.user_id = pu.id
       LEFT JOIN consultations c ON c.appointment_id = a.id
       WHERE a.doctor_id = ?
       ORDER BY a.appointment_date DESC, a.time_slot ASC`
    )
    .all(doctorId);

  const prescriptions = db
    .prepare(
      `SELECT rx.*, pu.full_name as patient_name, p.mrn
       FROM prescriptions rx
       JOIN patients p ON rx.patient_id = p.id
       JOIN users pu ON p.user_id = pu.id
       WHERE rx.doctor_id = ?
       ORDER BY rx.created_at DESC
       LIMIT 15`
    )
    .all(doctorId) as Array<Record<string, unknown>>;

  for (const rx of prescriptions) {
    rx.items = db.prepare('SELECT * FROM prescription_items WHERE prescription_id = ?').all(rx.id);
  }

  const stats = {
    pending_requests: appointments.filter((a: any) => a.status === 'pending').length,
    todays_confirmed: appointments.filter((a: any) => a.status === 'accepted').length,
    completed_consultations: appointments.filter((a: any) => a.status === 'completed').length,
    total_prescriptions: (
      db.prepare('SELECT COUNT(*) as cnt FROM prescriptions WHERE doctor_id = ?').get(doctorId) as { cnt: number }
    ).cnt,
  };

  res.json({
    doctor,
    stats,
    appointments,
    prescriptions,
  });
});

// Update Doctor Profile & Availability Schedule
router.put('/profile', requireAuth, requireRole('doctor'), (req: AuthenticatedRequest, res) => {
  const parsed = updateDoctorProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid doctor profile update', details: parsed.error.flatten() });
    return;
  }

  const db = getDb();
  const data = parsed.data;
  const doctor = db.prepare('SELECT id FROM doctors WHERE user_id = ?').get(req.user!.id) as { id: number } | undefined;
  if (!doctor) {
    res.status(404).json({ error: 'Doctor profile not found.' });
    return;
  }

  db.transaction(() => {
    if (data.full_name || data.phone !== undefined) {
      db.prepare(
        `UPDATE users SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone), updated_at = datetime('now') WHERE id = ?`
      ).run(data.full_name ?? null, data.phone ?? null, req.user!.id);
    }

    db.prepare(
      `UPDATE doctors SET
        hospital_id = COALESCE(?, hospital_id),
        specialization = COALESCE(?, specialization),
        qualification = COALESCE(?, qualification),
        experience_years = COALESCE(?, experience_years),
        consultation_fee = COALESCE(?, consultation_fee),
        bio = COALESCE(?, bio),
        available_days_json = COALESCE(?, available_days_json),
        slot_start_time = COALESCE(?, slot_start_time),
        slot_end_time = COALESCE(?, slot_end_time),
        is_available_for_video = COALESCE(?, is_available_for_video)
       WHERE id = ?`
    ).run(
      data.hospital_id === undefined ? null : data.hospital_id,
      data.specialization ?? null,
      data.qualification ?? null,
      data.experience_years ?? null,
      data.consultation_fee ?? null,
      data.bio ?? null,
      data.available_days ? JSON.stringify(data.available_days) : null,
      data.slot_start_time ?? null,
      data.slot_end_time ?? null,
      data.is_available_for_video !== undefined ? (data.is_available_for_video ? 1 : 0) : null,
      doctor.id
    );
  })();

  logAudit({
    actorUserId: req.user!.id,
    actorRole: req.user!.role,
    action: 'DOCTOR_PROFILE_UPDATED',
    resourceType: 'doctors',
    resourceId: doctor.id,
    ipAddress: req.ip,
  });

  const updated = db
    .prepare(
      `SELECT d.*, u.full_name, u.email, u.phone, h.name as hospital_name
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       LEFT JOIN hospitals h ON d.hospital_id = h.id
       WHERE d.id = ?`
    )
    .get(doctor.id);
  res.json({ doctor: updated });
});

// Authorized Patient Medical History for Doctor (IDOR Protected)
router.get('/patients/:patientId/history', requireAuth, requireRole('doctor'), (req: AuthenticatedRequest, res) => {
  const patientId = Number(req.params.patientId);
  const db = getDb();

  const doctor = db.prepare('SELECT id FROM doctors WHERE user_id = ?').get(req.user!.id) as { id: number } | undefined;
  if (!doctor) {
    res.status(404).json({ error: 'Doctor profile not found.' });
    return;
  }

  if (!doctorHasPatientAccess(doctor.id, patientId)) {
    logAudit({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'UNAUTHORIZED_PATIENT_HISTORY_ATTEMPT',
      resourceType: 'patients',
      resourceId: patientId,
      ipAddress: req.ip,
    });
    res.status(403).json({ error: 'Access denied: No authorized clinical relationship with this patient.' });
    return;
  }

  const patient = db
    .prepare(
      `SELECT p.*, u.full_name, u.email, u.phone
       FROM patients p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = ?`
    )
    .get(patientId);

  if (!patient) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }

  const records = db
    .prepare(
      `SELECT r.*, h.name as hospital_name
       FROM medical_records r
       LEFT JOIN hospitals h ON r.hospital_id = h.id
       WHERE r.patient_id = ?
       ORDER BY r.record_date DESC`
    )
    .all(patientId);

  const prescriptions = db
    .prepare(
      `SELECT rx.*, du.full_name as doctor_name
       FROM prescriptions rx
       JOIN doctors d ON rx.doctor_id = d.id
       JOIN users du ON d.user_id = du.id
       WHERE rx.patient_id = ?
       ORDER BY rx.created_at DESC`
    )
    .all(patientId) as Array<Record<string, unknown>>;

  for (const rx of prescriptions) {
    rx.items = db.prepare('SELECT * FROM prescription_items WHERE prescription_id = ?').all(rx.id);
  }

  const consultations = db
    .prepare(
      `SELECT c.*, du.full_name as doctor_name
       FROM consultations c
       JOIN doctors d ON c.doctor_id = d.id
       JOIN users du ON d.user_id = du.id
       WHERE c.patient_id = ?
       ORDER BY c.created_at DESC`
    )
    .all(patientId);

  logAudit({
    actorUserId: req.user!.id,
    actorRole: req.user!.role,
    action: 'DOCTOR_VIEWED_PATIENT_HISTORY',
    resourceType: 'patients',
    resourceId: patientId,
    ipAddress: req.ip,
  });

  res.json({ patient, records, prescriptions, consultations });
});

export default router;
