import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
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

// Public hospital directory
router.get('/', (_req, res) => {
  const db = getDb();
  const hospitals = db
    .prepare(
      `SELECT h.*,
        (SELECT COUNT(*) FROM beds b WHERE b.hospital_id = h.id) as total_beds,
        (SELECT COUNT(*) FROM beds b WHERE b.hospital_id = h.id AND b.status = 'available') as available_beds
       FROM hospitals h
       ORDER BY h.verification_status DESC, h.name ASC`
    )
    .all();
  res.json({ hospitals });
});

function getHospitalForUser(userId: number) {
  const db = getDb();
  return db.prepare('SELECT * FROM hospitals WHERE user_id = ?').get(userId) as
    | Record<string, any>
    | undefined;
}

// Hospital Full Operational Dashboard
router.get('/dashboard', requireAuth, requireRole('hospital'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const hospital = getHospitalForUser(req.user!.id);
  if (!hospital) {
    res.status(404).json({ error: 'Hospital profile not found.' });
    return;
  }

  const hospitalId = Number(hospital.id);

  const beds = db
    .prepare(
      `SELECT b.*, pu.full_name as patient_name, p.mrn as patient_mrn
       FROM beds b
       LEFT JOIN patients p ON b.current_patient_id = p.id
       LEFT JOIN users pu ON p.user_id = pu.id
       WHERE b.hospital_id = ?
       ORDER BY b.bed_type ASC, b.bed_number ASC`
    )
    .all(hospitalId);

  const admissions = db
    .prepare(
      `SELECT adm.*, pu.full_name as patient_name, p.mrn, p.blood_group, p.insurance_provider,
              du.full_name as doctor_name, COALESCE(d.specialization, 'General Medicine') as department,
              b.bed_number, b.ward_name, b.bed_type
       FROM admissions adm
       JOIN patients p ON adm.patient_id = p.id
       JOIN users pu ON p.user_id = pu.id
       LEFT JOIN doctors d ON adm.attending_doctor_id = d.id
       LEFT JOIN users du ON d.user_id = du.id
       LEFT JOIN beds b ON adm.bed_id = b.id
       WHERE adm.hospital_id = ?
       ORDER BY adm.admitted_at DESC`
    )
    .all(hospitalId);

  const doctors = db
    .prepare(
      `SELECT d.*, u.full_name, u.email, u.phone
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       WHERE d.hospital_id = ?
       ORDER BY d.verification_status ASC, u.full_name ASC`
    )
    .all(hospitalId);

  const staff = db
    .prepare('SELECT * FROM hospital_staff WHERE hospital_id = ? ORDER BY created_at DESC')
    .all(hospitalId);

  const appointments = db
    .prepare(
      `SELECT a.*, pu.full_name as patient_name, p.mrn, du.full_name as doctor_name, d.specialization
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN users pu ON p.user_id = pu.id
       JOIN doctors d ON a.doctor_id = d.id
       JOIN users du ON d.user_id = du.id
       WHERE a.hospital_id = ?
       ORDER BY a.appointment_date DESC, a.time_slot ASC
       LIMIT 100`
    )
    .all(hospitalId);

  const emergencies = db
    .prepare(
      `SELECT e.*, pu.full_name as patient_name, p.mrn,
              du.full_name as assigned_doctor_name, b.bed_number
       FROM emergency_requests e
       LEFT JOIN patients p ON e.patient_id = p.id
       LEFT JOIN users pu ON p.user_id = pu.id
       LEFT JOIN doctors d ON e.assigned_doctor_id = d.id
       LEFT JOIN users du ON d.user_id = du.id
       LEFT JOIN beds b ON e.bed_id = b.id
       WHERE e.hospital_id = ? OR e.hospital_id IS NULL
       ORDER BY e.created_at DESC
       LIMIT 50`
    )
    .all(hospitalId);

  const patients = db
    .prepare(
      `SELECT DISTINCT p.id, p.mrn, p.dob, p.gender, p.blood_group, p.insurance_provider, p.insurance_policy_no,
              u.full_name, u.email, u.phone
       FROM patients p
       JOIN users u ON p.user_id = u.id
       ORDER BY u.full_name ASC`
    )
    .all();

  const resources = db
    .prepare('SELECT * FROM hospital_resources WHERE hospital_id = ? ORDER BY resource_type ASC, name ASC')
    .all(hospitalId);

  const hospitalPayments = db
    .prepare(
      `SELECT pay.*, pu.full_name as patient_name, p.mrn,
              CASE
                WHEN pay.reference_type = 'admission' THEN COALESCE(adm_doc.specialization, 'Hospital Care')
                WHEN pay.reference_type = 'appointment' THEN COALESCE(appt_doc.specialization, 'Outpatient')
                ELSE 'Hospital Services'
              END as department
       FROM payments pay
       JOIN patients p ON pay.patient_id = p.id
       JOIN users pu ON p.user_id = pu.id
       LEFT JOIN admissions adm ON pay.reference_type = 'admission' AND pay.reference_id = adm.id
       LEFT JOIN doctors adm_doc ON adm.attending_doctor_id = adm_doc.id
       LEFT JOIN appointments appt ON pay.reference_type = 'appointment' AND pay.reference_id = appt.id
       LEFT JOIN doctors appt_doc ON appt.doctor_id = appt_doc.id
       WHERE adm.hospital_id = ? OR appt.hospital_id = ?
       ORDER BY pay.created_at DESC`
    )
    .all(hospitalId, hospitalId) as any[];

  const todayIso = new Date().toISOString().slice(0, 10);

  const bedStats = {
    total: beds.length,
    available: beds.filter((b: any) => b.status === 'available').length,
    occupied: beds.filter((b: any) => b.status === 'occupied').length,
    maintenance: beds.filter((b: any) => b.status === 'maintenance').length,
    reserved: beds.filter((b: any) => b.status === 'reserved').length,
    icu_available: beds.filter((b: any) => b.bed_type === 'icu' && b.status === 'available').length,
    icu_total: beds.filter((b: any) => b.bed_type === 'icu').length,
  };

  const revenueTotal = admissions.reduce(
    (sum: number, a: any) => sum + Number(a.total_billed_amount || 0),
    0
  );
  const insuranceCovered = admissions.reduce(
    (sum: number, a: any) => sum + Number(a.insurance_covered_amount || 0),
    0
  );
  const collectedRevenue = hospitalPayments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const pendingPaymentsTotal = hospitalPayments
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const todayCollectedRevenue = hospitalPayments
    .filter((p) => p.status === 'paid' && String(p.created_at || '').slice(0, 10) === todayIso)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const uniquePatientIds = new Set<number>();
  admissions.forEach((a: any) => uniquePatientIds.add(Number(a.patient_id)));
  appointments.forEach((a: any) => uniquePatientIds.add(Number(a.patient_id)));

  res.json({
    hospital,
    stats: {
      ...bedStats,
      total_patients: uniquePatientIds.size || patients.length,
      active_inpatients: admissions.filter((a: any) => a.status === 'admitted' && a.admission_type !== 'opd').length,
      opd_visits: admissions.filter((a: any) => a.admission_type === 'opd').length,
      pending_doctor_verifications: doctors.filter((d: any) => d.verification_status === 'pending').length,
      verified_doctors: doctors.filter((d: any) => d.verification_status === 'verified').length,
      today_appointments: appointments.filter((a: any) => a.appointment_date === todayIso).length,
      today_admissions: admissions.filter((a: any) => String(a.admitted_at || '').slice(0, 10) === todayIso).length,
      today_discharges: admissions.filter((a: any) => String(a.discharged_at || '').slice(0, 10) === todayIso).length,
      active_emergencies: emergencies.filter((e: any) => e.status !== 'resolved').length,
      revenue_total: revenueTotal,
      insurance_covered: insuranceCovered,
      collected_revenue: collectedRevenue,
      pending_payments_total: pendingPaymentsTotal,
      today_collected_revenue: todayCollectedRevenue,
    },
    beds,
    admissions,
    doctors,
    staff,
    appointments,
    emergencies,
    patients,
    resources,
    payments: hospitalPayments,
  });
});

// Update Hospital Profile & Departments
router.put('/profile', requireAuth, requireRole('hospital'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    name: z.string().min(2).max(160).optional(),
    phone: z.string().max(30).optional(),
    emergency_phone: z.string().max(30).optional(),
    address: z.string().max(300).optional(),
    city: z.string().max(80).optional(),
    state: z.string().max(80).optional(),
    branch_code: z.string().max(30).optional(),
    departments: z.array(z.string()).optional(),
    facilities: z.array(z.string()).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid hospital update', details: parsed.error.flatten() });
    return;
  }

  const hospital = getHospitalForUser(req.user!.id);
  if (!hospital) {
    res.status(404).json({ error: 'Hospital not found.' });
    return;
  }

  const d = parsed.data;
  const db = getDb();
  db.prepare(
    `UPDATE hospitals SET
      name = COALESCE(?, name),
      phone = COALESCE(?, phone),
      emergency_phone = COALESCE(?, emergency_phone),
      address = COALESCE(?, address),
      city = COALESCE(?, city),
      state = COALESCE(?, state),
      branch_code = COALESCE(?, branch_code),
      departments_json = COALESCE(?, departments_json),
      facilities_json = COALESCE(?, facilities_json)
     WHERE id = ?`
  ).run(
    d.name ?? null,
    d.phone ?? null,
    d.emergency_phone ?? null,
    d.address ?? null,
    d.city ?? null,
    d.state ?? null,
    d.branch_code ?? null,
    d.departments ? JSON.stringify(d.departments) : null,
    d.facilities ? JSON.stringify(d.facilities) : null,
    hospital.id
  );

  const updated = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(hospital.id);
  res.json({ hospital: updated });
});

// Verify or Reject Affiliated Doctor
router.patch('/doctors/:doctorId/verify', requireAuth, requireRole('hospital', 'admin'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    status: z.enum(['verified', 'rejected']),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Status must be verified or rejected.' });
    return;
  }

  const db = getDb();
  const doctorId = Number(req.params.doctorId);
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(doctorId) as Record<string, any> | undefined;
  if (!doctor) {
    res.status(404).json({ error: 'Doctor not found.' });
    return;
  }

  if (req.user!.role === 'hospital') {
    const hospital = getHospitalForUser(req.user!.id);
    if (!hospital || doctor.hospital_id !== hospital.id) {
      res.status(403).json({ error: 'Cannot verify a doctor outside your hospital.' });
      return;
    }
  }

  db.transaction(() => {
    db.prepare('UPDATE doctors SET verification_status = ? WHERE id = ?').run(parsed.data.status, doctorId);
    if (parsed.data.status === 'verified') {
      db.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(doctor.user_id);
    }
  })();

  createNotification({
    userId: Number(doctor.user_id),
    title: `Credential Verification ${parsed.data.status === 'verified' ? 'Approved' : 'Updated'}`,
    message: `Your medical credentials and hospital affiliation status is now ${parsed.data.status}.`,
    category: 'hospital',
    actionUrl: '/doctor',
  });

  logAudit({
    actorUserId: req.user!.id,
    actorRole: req.user!.role,
    action: `DOCTOR_${parsed.data.status.toUpperCase()}`,
    resourceType: 'doctors',
    resourceId: doctorId,
    ipAddress: req.ip,
  });

  const updated = db
    .prepare('SELECT d.*, u.full_name, u.email FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = ?')
    .get(doctorId);
  res.json({ doctor: updated });
});

// Staff Management
router.post('/staff', requireAuth, requireRole('hospital'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    full_name: z.string().min(2).max(120),
    role_title: z.string().min(2).max(120),
    department: z.string().min(2).max(120),
    staff_role: z.enum(['admin', 'nurse', 'coordinator', 'billing', 'doctor', 'technician']),
    shift_schedule: z.string().min(2).max(120),
    phone: z.string().max(30).optional().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid staff details', details: parsed.error.flatten() });
    return;
  }

  const hospital = getHospitalForUser(req.user!.id);
  if (!hospital) {
    res.status(404).json({ error: 'Hospital not found.' });
    return;
  }

  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO hospital_staff (hospital_id, full_name, role_title, department, staff_role, shift_schedule, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      hospital.id,
      parsed.data.full_name,
      parsed.data.role_title,
      parsed.data.department,
      parsed.data.staff_role,
      parsed.data.shift_schedule,
      parsed.data.phone
    );

  const staff = db.prepare('SELECT * FROM hospital_staff WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ staff });
});

// Bed Management (Create Bed, Update Status)
router.post('/beds', requireAuth, requireRole('hospital'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    ward_name: z.string().min(2).max(120),
    bed_number: z.string().min(1).max(30),
    bed_type: z.enum(['general', 'private', 'icu', 'emergency']),
    daily_rate: z.coerce.number().min(0),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid bed fields', details: parsed.error.flatten() });
    return;
  }

  const hospital = getHospitalForUser(req.user!.id);
  if (!hospital) {
    res.status(404).json({ error: 'Hospital not found.' });
    return;
  }

  const db = getDb();
  try {
    const info = db
      .prepare(
        `INSERT INTO beds (hospital_id, ward_name, bed_number, bed_type, daily_rate, status)
         VALUES (?, ?, ?, ?, ?, 'available')`
      )
      .run(
        hospital.id,
        parsed.data.ward_name,
        parsed.data.bed_number.toUpperCase(),
        parsed.data.bed_type,
        parsed.data.daily_rate
      );
    const bed = db.prepare('SELECT * FROM beds WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ bed });
  } catch {
    res.status(409).json({ error: 'A bed with this bed number already exists in your hospital.' });
  }
});

router.patch('/beds/:bedId', requireAuth, requireRole('hospital'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    status: z.enum(['available', 'maintenance', 'reserved']),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid bed status.' });
    return;
  }

  const hospital = getHospitalForUser(req.user!.id);
  if (!hospital) {
    res.status(404).json({ error: 'Hospital not found.' });
    return;
  }

  const db = getDb();
  const bed = db
    .prepare('SELECT * FROM beds WHERE id = ? AND hospital_id = ?')
    .get(Number(req.params.bedId), hospital.id) as Record<string, any> | undefined;
  if (!bed) {
    res.status(404).json({ error: 'Bed not found.' });
    return;
  }
  if (bed.status === 'occupied') {
    res.status(400).json({ error: 'Cannot change status of an occupied bed. Discharge the patient first.' });
    return;
  }

  db.prepare('UPDATE beds SET status = ? WHERE id = ?').run(parsed.data.status, bed.id);
  const updated = db.prepare('SELECT * FROM beds WHERE id = ?').get(bed.id);
  res.json({ bed: updated });
});

// Register New Patient at Hospital Desk (Avoids duplicates by email)
router.post('/patients/register', requireAuth, requireRole('hospital'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    full_name: z.string().min(2).max(120),
    email: z.string().email(),
    phone: z.string().max(30).optional().default(''),
    dob: z.string().optional().default(''),
    gender: z.string().optional().default('Unspecified'),
    blood_group: z.string().optional().default(''),
    insurance_provider: z.string().optional().default(''),
    insurance_policy_no: z.string().optional().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid patient details', details: parsed.error.flatten() });
    return;
  }

  const db = getDb();
  const d = parsed.data;
  const existingUser = db.prepare('SELECT id, role FROM users WHERE email = ?').get(d.email.toLowerCase()) as
    | { id: number; role: string }
    | undefined;

  if (existingUser) {
    const existingPatient = db
      .prepare('SELECT p.*, u.full_name, u.email, u.phone FROM patients p JOIN users u ON p.user_id = u.id WHERE p.user_id = ?')
      .get(existingUser.id);
    if (existingPatient) {
      res.status(200).json({ patient: existingPatient, existing: true });
      return;
    }
    res.status(409).json({ error: 'Email already registered under a non-patient role.' });
    return;
  }

  const tempPasswordHash = bcrypt.hashSync(crypto.randomBytes(12).toString('hex'), 10);
  const patient = db.transaction(() => {
    const userRes = db
      .prepare(
        `INSERT INTO users (email, password_hash, role, full_name, phone, is_active, is_verified)
         VALUES (?, ?, 'patient', ?, ?, 1, 1)`
      )
      .run(d.email.toLowerCase(), tempPasswordHash, d.full_name, d.phone);

    const userId = Number(userRes.lastInsertRowid);
    const mrn = `MRN-${new Date().getFullYear()}-${String(1000 + userId).padStart(4, '0')}`;
    const patRes = db
      .prepare(
        `INSERT INTO patients (user_id, mrn, dob, gender, blood_group, insurance_provider, insurance_policy_no)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(userId, mrn, d.dob, d.gender, d.blood_group, d.insurance_provider, d.insurance_policy_no);

    return db
      .prepare('SELECT p.*, u.full_name, u.email, u.phone FROM patients p JOIN users u ON p.user_id = u.id WHERE p.id = ?')
      .get(patRes.lastInsertRowid);
  })();

  res.status(201).json({ patient, existing: false });
});

// Admit Patient & Allocate Bed (Transactional)
router.post('/admissions', requireAuth, requireRole('hospital'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    patient_id: z.coerce.number().int().positive(),
    attending_doctor_id: z.coerce.number().int().positive().optional().nullable(),
    bed_id: z.coerce.number().int().positive().optional().nullable(),
    admission_type: z.enum(['opd', 'inpatient', 'emergency']),
    diagnosis: z.string().min(2).max(500),
    initial_bill: z.coerce.number().min(0).optional().default(0),
    insurance_covered: z.coerce.number().min(0).optional().default(0),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid admission payload', details: parsed.error.flatten() });
    return;
  }

  const hospital = getHospitalForUser(req.user!.id);
  if (!hospital) {
    res.status(404).json({ error: 'Hospital not found.' });
    return;
  }

  const db = getDb();
  const d = parsed.data;
  const patient = db.prepare('SELECT p.*, u.id as user_id FROM patients p JOIN users u ON p.user_id = u.id WHERE p.id = ?').get(d.patient_id) as
    | Record<string, any>
    | undefined;
  if (!patient) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }

  try {
    const admission = db.transaction(() => {
      if (d.bed_id) {
        const bed = db
          .prepare('SELECT * FROM beds WHERE id = ? AND hospital_id = ?')
          .get(d.bed_id, hospital.id) as Record<string, any> | undefined;
        if (!bed) {
          throw new Error('BED_NOT_FOUND');
        }
        if (bed.status !== 'available' && bed.status !== 'reserved') {
          throw new Error('BED_UNAVAILABLE');
        }
        db.prepare("UPDATE beds SET status = 'occupied', current_patient_id = ? WHERE id = ?").run(
          d.patient_id,
          d.bed_id
        );
      }

      const info = db
        .prepare(
          `INSERT INTO admissions (hospital_id, patient_id, attending_doctor_id, bed_id, admission_type, status, diagnosis, total_billed_amount, insurance_covered_amount)
           VALUES (?, ?, ?, ?, ?, 'admitted', ?, ?, ?)`
        )
        .run(
          hospital.id,
          d.patient_id,
          d.attending_doctor_id ?? null,
          d.bed_id ?? null,
          d.admission_type,
          d.diagnosis,
          d.initial_bill,
          d.insurance_covered
        );

      return db.prepare('SELECT * FROM admissions WHERE id = ?').get(info.lastInsertRowid);
    })();

    createNotification({
      userId: Number(patient.user_id),
      title: `Hospital Admission Registered`,
      message: `You have been registered for ${d.admission_type.toUpperCase()} care at ${hospital.name}.`,
      category: 'hospital',
      actionUrl: '/patient',
    });

    logAudit({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'PATIENT_ADMITTED',
      resourceType: 'admissions',
      resourceId: (admission as any).id,
      ipAddress: req.ip,
      details: { patient_id: d.patient_id, bed_id: d.bed_id },
    });

    res.status(201).json({ admission });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'BED_NOT_FOUND') {
      res.status(404).json({ error: 'Selected bed not found in your hospital.' });
      return;
    }
    if (msg === 'BED_UNAVAILABLE') {
      res.status(409).json({ error: 'Selected bed is already occupied or in maintenance.' });
      return;
    }
    res.status(500).json({ error: 'Failed to create admission.' });
  }
});

// Discharge Patient, Release Bed, Generate Summary & Invoice
router.post('/admissions/:id/discharge', requireAuth, requireRole('hospital'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    discharge_summary: z.string().min(5).max(3000),
    total_billed_amount: z.coerce.number().min(0),
    insurance_covered_amount: z.coerce.number().min(0).default(0),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid discharge payload', details: parsed.error.flatten() });
    return;
  }

  const hospital = getHospitalForUser(req.user!.id);
  if (!hospital) {
    res.status(404).json({ error: 'Hospital not found.' });
    return;
  }

  const db = getDb();
  const admId = Number(req.params.id);
  const adm = db
    .prepare('SELECT * FROM admissions WHERE id = ? AND hospital_id = ?')
    .get(admId, hospital.id) as Record<string, any> | undefined;

  if (!adm) {
    res.status(404).json({ error: 'Admission record not found.' });
    return;
  }
  if (adm.status === 'discharged') {
    res.status(400).json({ error: 'Patient is already discharged.' });
    return;
  }

  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(adm.patient_id) as Record<string, any>;

  db.transaction(() => {
    db.prepare(
      `UPDATE admissions
       SET status = 'discharged',
           discharged_at = datetime('now'),
           discharge_summary = ?,
           total_billed_amount = ?,
           insurance_covered_amount = ?
       WHERE id = ?`
    ).run(
      parsed.data.discharge_summary,
      parsed.data.total_billed_amount,
      parsed.data.insurance_covered_amount,
      admId
    );

    if (adm.bed_id) {
      db.prepare("UPDATE beds SET status = 'available', current_patient_id = NULL WHERE id = ?").run(adm.bed_id);
    }

    // Automatically publish Discharge Summary to patient's medical records
    db.prepare(
      `INSERT INTO medical_records (patient_id, uploaded_by_user_id, hospital_id, doctor_id, record_type, title, summary, record_date)
       VALUES (?, ?, ?, ?, 'discharge_summary', ?, ?, date('now'))`
    ).run(
      adm.patient_id,
      req.user!.id,
      hospital.id,
      adm.attending_doctor_id ?? null,
      `Discharge Summary — ${hospital.name}`,
      parsed.data.discharge_summary
    );

    // Create Pending Invoice if net payable > 0
    const netAmount = Math.max(0, parsed.data.total_billed_amount - parsed.data.insurance_covered_amount);
    const invNo = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const txnId = `bill_HOSP_${admId}_${Date.now()}`;
    db.prepare(
      `INSERT INTO payments (payer_user_id, patient_id, reference_type, reference_id, amount, currency, payment_method, transaction_id, status, invoice_number, breakdown_json)
       VALUES (?, ?, 'admission', ?, ?, 'INR', 'hospital_billing', ?, ?, ?, ?)`
    ).run(
      patient.user_id,
      adm.patient_id,
      admId,
      netAmount,
      txnId,
      netAmount === 0 ? 'paid' : 'pending',
      invNo,
      JSON.stringify({
        gross_bill: parsed.data.total_billed_amount,
        insurance_covered: parsed.data.insurance_covered_amount,
        net_payable: netAmount,
      })
    );
  })();

  createNotification({
    userId: Number(patient.user_id),
    title: 'Hospital Discharge Summary Ready',
    message: `Your discharge summary and billing invoice from ${hospital.name} are now available in your portal.`,
    category: 'hospital',
    actionUrl: '/patient/records',
  });

  logAudit({
    actorUserId: req.user!.id,
    actorRole: req.user!.role,
    action: 'PATIENT_DISCHARGED',
    resourceType: 'admissions',
    resourceId: admId,
    ipAddress: req.ip,
  });

  const updated = db.prepare('SELECT * FROM admissions WHERE id = ?').get(admId);
  res.json({ admission: updated });
});

// Add / Onboard Affiliated Doctor
router.post('/doctors', requireAuth, requireRole('hospital'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    full_name: z.string().min(2).max(120),
    email: z.string().email(),
    phone: z.string().max(30).optional().default(''),
    license_no: z.string().min(3).max(60),
    specialization: z.string().min(2).max(120),
    qualification: z.string().min(2).max(160),
    experience_years: z.coerce.number().int().min(0).max(70).default(1),
    consultation_fee: z.coerce.number().min(0).default(800),
    slot_start_time: z.string().default('09:00'),
    slot_end_time: z.string().default('17:00'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid doctor profile details', details: parsed.error.flatten() });
    return;
  }

  const hospital = getHospitalForUser(req.user!.id);
  if (!hospital) {
    res.status(404).json({ error: 'Hospital not found.' });
    return;
  }

  const db = getDb();
  const d = parsed.data;
  const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(d.email.toLowerCase());
  if (existingEmail) {
    res.status(409).json({ error: 'A user with this email already exists.' });
    return;
  }

  const tempHash = bcrypt.hashSync(crypto.randomBytes(12).toString('hex'), 10);
  try {
    const doctor = db.transaction(() => {
      const userRes = db
        .prepare(
          `INSERT INTO users (email, password_hash, role, full_name, phone, is_active, is_verified)
           VALUES (?, ?, 'doctor', ?, ?, 1, 1)`
        )
        .run(d.email.toLowerCase(), tempHash, d.full_name, d.phone);

      const docRes = db
        .prepare(
          `INSERT INTO doctors (user_id, hospital_id, license_no, verification_status, specialization, qualification, experience_years, consultation_fee, slot_start_time, slot_end_time)
           VALUES (?, ?, ?, 'verified', ?, ?, ?, ?, ?, ?)`
        )
        .run(
          userRes.lastInsertRowid,
          hospital.id,
          d.license_no.toUpperCase(),
          d.specialization,
          d.qualification,
          d.experience_years,
          d.consultation_fee,
          d.slot_start_time,
          d.slot_end_time
        );

      return db
        .prepare('SELECT d.*, u.full_name, u.email, u.phone FROM doctors d JOIN users u ON d.user_id = u.id WHERE d.id = ?')
        .get(docRes.lastInsertRowid);
    })();
    res.status(201).json({ doctor });
  } catch {
    res.status(409).json({ error: 'Doctor license number already registered.' });
  }
});

// Allocate or Transfer Bed for an Active Admission
router.patch('/admissions/:id/transfer-bed', requireAuth, requireRole('hospital'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    bed_id: z.coerce.number().int().positive(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid target bed_id required.' });
    return;
  }

  const hospital = getHospitalForUser(req.user!.id);
  if (!hospital) {
    res.status(404).json({ error: 'Hospital not found.' });
    return;
  }

  const db = getDb();
  const admId = Number(req.params.id);
  const adm = db
    .prepare('SELECT * FROM admissions WHERE id = ? AND hospital_id = ?')
    .get(admId, hospital.id) as Record<string, any> | undefined;

  if (!adm || adm.status !== 'admitted') {
    res.status(404).json({ error: 'Active admission not found.' });
    return;
  }

  const targetBed = db
    .prepare('SELECT * FROM beds WHERE id = ? AND hospital_id = ?')
    .get(parsed.data.bed_id, hospital.id) as Record<string, any> | undefined;

  if (!targetBed) {
    res.status(404).json({ error: 'Target bed not found.' });
    return;
  }
  if (targetBed.status !== 'available' && targetBed.status !== 'reserved') {
    res.status(409).json({ error: 'Target bed is not available for transfer.' });
    return;
  }

  db.transaction(() => {
    if (adm.bed_id) {
      db.prepare("UPDATE beds SET status = 'available', current_patient_id = NULL WHERE id = ?").run(adm.bed_id);
    }
    db.prepare("UPDATE beds SET status = 'occupied', current_patient_id = ? WHERE id = ?").run(
      adm.patient_id,
      targetBed.id
    );
    db.prepare('UPDATE admissions SET bed_id = ? WHERE id = ?').run(targetBed.id, admId);
  })();

  const updated = db.prepare('SELECT * FROM admissions WHERE id = ?').get(admId);
  res.json({ admission: updated });
});

// Create Hospital Bill / Invoice
router.post('/bills', requireAuth, requireRole('hospital'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    admission_id: z.coerce.number().int().positive(),
    gross_amount: z.coerce.number().min(1),
    insurance_covered: z.coerce.number().min(0).default(0),
    status: z.enum(['pending', 'paid']).default('pending'),
    payment_method: z.enum(['hospital_billing', 'card', 'upi', 'insurance', 'razorpay_sandbox']).default('hospital_billing'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid bill details', details: parsed.error.flatten() });
    return;
  }

  const hospital = getHospitalForUser(req.user!.id);
  if (!hospital) {
    res.status(404).json({ error: 'Hospital not found.' });
    return;
  }

  const db = getDb();
  const d = parsed.data;
  const adm = db
    .prepare('SELECT * FROM admissions WHERE id = ? AND hospital_id = ?')
    .get(d.admission_id, hospital.id) as Record<string, any> | undefined;

  if (!adm) {
    res.status(404).json({ error: 'Admission not found for this hospital.' });
    return;
  }

  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(adm.patient_id) as Record<string, any>;
  const netAmount = Math.max(0, d.gross_amount - d.insurance_covered);
  const invNo = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const txnId = `bill_HOSP_${adm.id}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const payment = db.transaction(() => {
    db.prepare(
      `UPDATE admissions
       SET total_billed_amount = total_billed_amount + ?,
           insurance_covered_amount = insurance_covered_amount + ?
       WHERE id = ?`
    ).run(d.gross_amount, d.insurance_covered, adm.id);

    const info = db
      .prepare(
        `INSERT INTO payments (payer_user_id, patient_id, reference_type, reference_id, amount, currency, payment_method, transaction_id, status, invoice_number, breakdown_json)
         VALUES (?, ?, 'admission', ?, ?, 'INR', ?, ?, ?, ?, ?)`
      )
      .run(
        patient.user_id,
        adm.patient_id,
        adm.id,
        netAmount,
        d.payment_method,
        txnId,
        netAmount === 0 ? 'paid' : d.status,
        invNo,
        JSON.stringify({
          gross_bill: d.gross_amount,
          insurance_covered: d.insurance_covered,
          net_payable: netAmount,
        })
      );
    return db.prepare('SELECT * FROM payments WHERE id = ?').get(info.lastInsertRowid);
  })();

  res.status(201).json({ payment });
});

router.patch('/bills/:id/status', requireAuth, requireRole('hospital'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({ status: z.enum(['paid', 'pending', 'refunded']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const hospital = getHospitalForUser(req.user!.id);
  if (!hospital) {
    res.status(404).json({ error: 'Hospital not found.' });
    return;
  }

  const db = getDb();
  const billId = Number(req.params.id);
  const bill = db
    .prepare(
      `SELECT pay.*
       FROM payments pay
       LEFT JOIN admissions adm ON pay.reference_type = 'admission' AND pay.reference_id = adm.id
       LEFT JOIN appointments appt ON pay.reference_type = 'appointment' AND pay.reference_id = appt.id
       WHERE pay.id = ? AND (adm.hospital_id = ? OR appt.hospital_id = ?)`
    )
    .get(billId, hospital.id, hospital.id) as Record<string, any> | undefined;

  if (!bill) {
    res.status(404).json({ error: 'Invoice not found for your hospital.' });
    return;
  }

  db.prepare('UPDATE payments SET status = ? WHERE id = ?').run(parsed.data.status, billId);
  const updated = db.prepare('SELECT * FROM payments WHERE id = ?').get(billId);
  res.json({ payment: updated });
});

// Facility Resources CRUD (Equipment, Labs, Operation Theatres, Rooms)
router.post('/resources', requireAuth, requireRole('hospital'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    resource_type: z.enum(['ward', 'room', 'equipment', 'laboratory', 'operation_theatre', 'facility']),
    name: z.string().min(2).max(160),
    department: z.string().min(2).max(120),
    location: z.string().max(160).optional().default(''),
    status: z.enum(['operational', 'in_use', 'maintenance']).default('operational'),
    notes: z.string().max(500).optional().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid facility resource details', details: parsed.error.flatten() });
    return;
  }

  const hospital = getHospitalForUser(req.user!.id);
  if (!hospital) {
    res.status(404).json({ error: 'Hospital not found.' });
    return;
  }

  const db = getDb();
  const d = parsed.data;
  const info = db
    .prepare(
      `INSERT INTO hospital_resources (hospital_id, resource_type, name, department, location, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(hospital.id, d.resource_type, d.name, d.department, d.location, d.status, d.notes);

  const resource = db.prepare('SELECT * FROM hospital_resources WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ resource });
});

router.patch('/resources/:id', requireAuth, requireRole('hospital'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    status: z.enum(['operational', 'in_use', 'maintenance']),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid resource status' });
    return;
  }

  const hospital = getHospitalForUser(req.user!.id);
  if (!hospital) {
    res.status(404).json({ error: 'Hospital not found.' });
    return;
  }

  const db = getDb();
  const id = Number(req.params.id);
  const existing = db
    .prepare('SELECT * FROM hospital_resources WHERE id = ? AND hospital_id = ?')
    .get(id, hospital.id);
  if (!existing) {
    res.status(404).json({ error: 'Resource not found.' });
    return;
  }

  db.prepare('UPDATE hospital_resources SET status = ? WHERE id = ?').run(parsed.data.status, id);
  const updated = db.prepare('SELECT * FROM hospital_resources WHERE id = ?').get(id);
  res.json({ resource: updated });
});

export default router;
