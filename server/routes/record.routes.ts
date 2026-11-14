import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database.ts';
import {
  doctorHasPatientAccess,
  logAudit,
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';

const router = Router();

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/plain',
  'application/json',
  '',
]);

const MAX_DATA_URL_BYTES = 5 * 1024 * 1024; // 5 MB

const createRecordSchema = z.object({
  patient_id: z.coerce.number().int().positive().optional(),
  record_type: z.enum(['lab_report', 'imaging', 'discharge_summary', 'clinical_note', 'vaccination']),
  title: z.string().min(2).max(200),
  summary: z.string().max(4000).optional().default(''),
  record_date: z.string().optional(),
  file_name: z.string().max(200).optional().default(''),
  file_mime: z.string().max(100).optional().default(''),
  file_size_bytes: z.coerce.number().int().min(0).max(MAX_DATA_URL_BYTES).optional().default(0),
  file_data_url: z.string().optional().default(''),
});

router.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = req.user!;

  if (user.role === 'patient') {
    const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(user.id) as { id: number } | undefined;
    if (!patient) return void res.json({ records: [] });
    const records = db
      .prepare(
        `SELECT r.*, h.name as hospital_name, du.full_name as doctor_name
         FROM medical_records r
         LEFT JOIN hospitals h ON r.hospital_id = h.id
         LEFT JOIN doctors d ON r.doctor_id = d.id
         LEFT JOIN users du ON d.user_id = du.id
         WHERE r.patient_id = ?
         ORDER BY r.record_date DESC, r.created_at DESC`
      )
      .all(patient.id);
    return void res.json({ records });
  }

  if (user.role === 'doctor') {
    const doctor = db.prepare('SELECT id FROM doctors WHERE user_id = ?').get(user.id) as { id: number } | undefined;
    if (!doctor) return void res.json({ records: [] });
    const patientId = req.query.patient_id ? Number(req.query.patient_id) : null;
    if (!patientId) {
      res.status(400).json({ error: 'patient_id query parameter is required for doctors.' });
      return;
    }
    if (!doctorHasPatientAccess(doctor.id, patientId)) {
      res.status(403).json({ error: 'Access denied to this patient medical records.' });
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
    return void res.json({ records });
  }

  if (user.role === 'hospital') {
    const hospital = db.prepare('SELECT id FROM hospitals WHERE user_id = ?').get(user.id) as { id: number } | undefined;
    if (!hospital) return void res.json({ records: [] });
    const records = db
      .prepare(
        `SELECT r.*, pu.full_name as patient_name, p.mrn
         FROM medical_records r
         JOIN patients p ON r.patient_id = p.id
         JOIN users pu ON p.user_id = pu.id
         WHERE r.hospital_id = ?
         ORDER BY r.record_date DESC`
      )
      .all(hospital.id);
    return void res.json({ records });
  }

  res.status(403).json({ error: 'Role not permitted to access medical records.' });
});

router.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const parsed = createRecordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid medical record payload', details: parsed.error.flatten() });
    return;
  }

  const d = parsed.data;
  if (!ALLOWED_MIMES.has(d.file_mime)) {
    res.status(400).json({ error: 'Unsupported file MIME type. Allowed: PDF, PNG, JPEG, TXT.' });
    return;
  }
  if (d.file_data_url && d.file_data_url.length > MAX_DATA_URL_BYTES * 1.4) {
    res.status(400).json({ error: 'Uploaded file exceeds 5 MB limit.' });
    return;
  }

  const db = getDb();
  const user = req.user!;
  let targetPatientId: number;
  let hospitalId: number | null = null;
  let doctorId: number | null = null;

  if (user.role === 'patient') {
    const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(user.id) as { id: number } | undefined;
    if (!patient) return void res.status(404).json({ error: 'Patient profile not found.' });
    targetPatientId = patient.id;
  } else if (user.role === 'doctor') {
    const doctor = db.prepare('SELECT id, hospital_id FROM doctors WHERE user_id = ?').get(user.id) as
      | { id: number; hospital_id: number | null }
      | undefined;
    if (!doctor || !d.patient_id) {
      res.status(400).json({ error: 'patient_id is required.' });
      return;
    }
    if (!doctorHasPatientAccess(doctor.id, d.patient_id)) {
      res.status(403).json({ error: 'Cannot upload records for an unauthorized patient.' });
      return;
    }
    targetPatientId = d.patient_id;
    doctorId = doctor.id;
    hospitalId = doctor.hospital_id;
  } else if (user.role === 'hospital') {
    const hospital = db.prepare('SELECT id FROM hospitals WHERE user_id = ?').get(user.id) as { id: number } | undefined;
    if (!hospital || !d.patient_id) {
      res.status(400).json({ error: 'patient_id is required.' });
      return;
    }
    targetPatientId = d.patient_id;
    hospitalId = hospital.id;
  } else {
    res.status(403).json({ error: 'Role not permitted to upload medical records.' });
    return;
  }

  const safeFileName = d.file_name.replace(/[^a-zA-Z0-9._-]/g, '_');

  const info = db
    .prepare(
      `INSERT INTO medical_records (patient_id, uploaded_by_user_id, hospital_id, doctor_id, record_type, title, summary, file_name, file_mime, file_size_bytes, file_data_url, record_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, date('now')))`
    )
    .run(
      targetPatientId,
      user.id,
      hospitalId,
      doctorId,
      d.record_type,
      d.title,
      d.summary,
      safeFileName,
      d.file_mime,
      d.file_size_bytes,
      d.file_data_url,
      d.record_date ?? null
    );

  logAudit({
    actorUserId: user.id,
    actorRole: user.role,
    action: 'MEDICAL_RECORD_UPLOADED',
    resourceType: 'medical_records',
    resourceId: info.lastInsertRowid.toString(),
    ipAddress: req.ip,
  });

  const record = db.prepare('SELECT * FROM medical_records WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ record });
});

export default router;
