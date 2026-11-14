import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database.ts';
import {
  createNotification,
  doctorHasPatientAccess,
  logAudit,
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';

const router = Router();

const createRxSchema = z.object({
  patient_id: z.coerce.number().int().positive(),
  consultation_id: z.coerce.number().int().positive().optional().nullable(),
  appointment_id: z.coerce.number().int().positive().optional().nullable(),
  diagnosis: z.string().min(2).max(500),
  notes: z.string().max(1000).optional().default(''),
  valid_days: z.coerce.number().int().min(1).max(365).default(30),
  items: z
    .array(
      z.object({
        medicine_name: z.string().min(2).max(160),
        generic_name: z.string().max(160).optional().default(''),
        dosage: z.string().min(1).max(80),
        frequency: z.string().min(1).max(80),
        duration_days: z.coerce.number().int().min(1).max(365),
        instructions: z.string().max(300).optional().default(''),
      })
    )
    .min(1),
});

router.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = req.user!;
  let prescriptions: Array<Record<string, any>> = [];

  if (user.role === 'patient') {
    const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(user.id) as { id: number } | undefined;
    if (!patient) return void res.json({ prescriptions: [] });
    prescriptions = db
      .prepare(
        `SELECT rx.*, du.full_name as doctor_name, d.specialization, d.license_no
         FROM prescriptions rx
         JOIN doctors d ON rx.doctor_id = d.id
         JOIN users du ON d.user_id = du.id
         WHERE rx.patient_id = ?
         ORDER BY rx.created_at DESC`
      )
      .all(patient.id) as Array<Record<string, any>>;
  } else if (user.role === 'doctor') {
    const doctor = db.prepare('SELECT id FROM doctors WHERE user_id = ?').get(user.id) as { id: number } | undefined;
    if (!doctor) return void res.json({ prescriptions: [] });
    prescriptions = db
      .prepare(
        `SELECT rx.*, pu.full_name as patient_name, p.mrn
         FROM prescriptions rx
         JOIN patients p ON rx.patient_id = p.id
         JOIN users pu ON p.user_id = pu.id
         WHERE rx.doctor_id = ?
         ORDER BY rx.created_at DESC`
      )
      .all(doctor.id) as Array<Record<string, any>>;
  } else {
    res.status(403).json({ error: 'Not authorized to list prescriptions.' });
    return;
  }

  for (const rx of prescriptions) {
    rx.items = db.prepare('SELECT * FROM prescription_items WHERE prescription_id = ?').all(rx.id);
  }

  res.json({ prescriptions });
});

router.post('/', requireAuth, requireRole('doctor'), (req: AuthenticatedRequest, res) => {
  const parsed = createRxSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid prescription data', details: parsed.error.flatten() });
    return;
  }

  const db = getDb();
  const doctor = db.prepare('SELECT id FROM doctors WHERE user_id = ?').get(req.user!.id) as { id: number } | undefined;
  if (!doctor) {
    res.status(404).json({ error: 'Doctor profile not found.' });
    return;
  }

  const d = parsed.data;
  if (!doctorHasPatientAccess(doctor.id, d.patient_id)) {
    res.status(403).json({ error: 'Access denied: Patient does not have an active clinical relationship with you.' });
    return;
  }

  const validUntil = new Date(Date.now() + d.valid_days * 86400 * 1000).toISOString().slice(0, 10);

  const rxId = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO prescriptions (consultation_id, appointment_id, patient_id, doctor_id, diagnosis, notes, valid_until, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`
      )
      .run(
        d.consultation_id ?? null,
        d.appointment_id ?? null,
        d.patient_id,
        doctor.id,
        d.diagnosis,
        d.notes,
        validUntil
      );
    const id = Number(info.lastInsertRowid);

    const insertItem = db.prepare(
      `INSERT INTO prescription_items (prescription_id, medicine_name, generic_name, dosage, frequency, duration_days, instructions)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const item of d.items) {
      insertItem.run(
        id,
        item.medicine_name,
        item.generic_name,
        item.dosage,
        item.frequency,
        item.duration_days,
        item.instructions
      );
    }
    return id;
  })();

  const patient = db.prepare('SELECT user_id FROM patients WHERE id = ?').get(d.patient_id) as { user_id: number };
  createNotification({
    userId: patient.user_id,
    title: 'New Digital Prescription Issued',
    message: `${req.user!.full_name} issued Digital Rx #${rxId} for ${d.diagnosis}. You can now order prescribed medicines.`,
    category: 'prescription',
    actionUrl: '/patient/prescriptions',
  });

  logAudit({
    actorUserId: req.user!.id,
    actorRole: req.user!.role,
    action: 'PRESCRIPTION_CREATED',
    resourceType: 'prescriptions',
    resourceId: rxId,
    ipAddress: req.ip,
  });

  const created = db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(rxId) as Record<string, any>;
  created.items = db.prepare('SELECT * FROM prescription_items WHERE prescription_id = ?').all(rxId);
  res.status(201).json({ prescription: created });
});

export default router;
