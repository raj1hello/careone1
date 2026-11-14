import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { getDb } from '../db/database.ts';
import { ENV } from '../config/env.ts';
import { logAudit, requireAuth, type AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();

const checkoutSchema = z.object({
  reference_type: z.enum(['appointment', 'admission', 'medicine_order']),
  reference_id: z.coerce.number().int().positive(),
  payment_method: z.enum(['razorpay_sandbox', 'upi', 'card', 'insurance']).default('razorpay_sandbox'),
});

router.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = req.user!;

  if (user.role === 'patient') {
    const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(user.id) as { id: number } | undefined;
    if (!patient) return void res.json({ payments: [] });
    const payments = db
      .prepare('SELECT * FROM payments WHERE patient_id = ? ORDER BY created_at DESC')
      .all(patient.id);
    return void res.json({ payments, gateway_mode: ENV.RAZORPAY_KEY_ID ? 'live' : 'razorpay_sandbox' });
  }

  if (user.role === 'hospital') {
    const hospital = db.prepare('SELECT id FROM hospitals WHERE user_id = ?').get(user.id) as { id: number } | undefined;
    if (!hospital) return void res.json({ payments: [] });
    const payments = db
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
      .all(hospital.id, hospital.id);
    return void res.json({ payments, gateway_mode: ENV.RAZORPAY_KEY_ID ? 'live' : 'razorpay_sandbox' });
  }

  res.status(403).json({ error: 'Not authorized to view payment ledger.' });
});

router.post('/checkout', requireAuth, (req: AuthenticatedRequest, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid checkout request', details: parsed.error.flatten() });
    return;
  }

  const db = getDb();
  const user = req.user!;
  const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(user.id) as { id: number } | undefined;
  if (!patient) {
    res.status(403).json({ error: 'Only patients can initiate checkout for their bills.' });
    return;
  }

  const d = parsed.data;
  let amount = 0;

  if (d.reference_type === 'medicine_order') {
    const order = db
      .prepare('SELECT * FROM medicine_orders WHERE id = ? AND patient_id = ?')
      .get(d.reference_id, patient.id) as Record<string, any> | undefined;
    if (!order) return void res.status(404).json({ error: 'Order not found.' });
    if (order.payment_status === 'paid') return void res.status(400).json({ error: 'Order already paid.' });
    amount = Number(order.total_amount);
  } else if (d.reference_type === 'appointment') {
    const appt = db
      .prepare(
        `SELECT a.*, doc.consultation_fee
         FROM appointments a
         JOIN doctors doc ON a.doctor_id = doc.id
         WHERE a.id = ? AND a.patient_id = ?`
      )
      .get(d.reference_id, patient.id) as Record<string, any> | undefined;
    if (!appt) return void res.status(404).json({ error: 'Appointment not found.' });
    amount = Number(appt.consultation_fee);
  } else if (d.reference_type === 'admission') {
    const adm = db
      .prepare('SELECT * FROM admissions WHERE id = ? AND patient_id = ?')
      .get(d.reference_id, patient.id) as Record<string, any> | undefined;
    if (!adm) return void res.status(404).json({ error: 'Admission invoice not found.' });
    amount = Math.max(0, Number(adm.total_billed_amount) - Number(adm.insurance_covered_amount));
  }

  const txnId = `pay_CARE_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const invNo = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  const payment = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO payments (payer_user_id, patient_id, reference_type, reference_id, amount, currency, payment_method, transaction_id, status, invoice_number, breakdown_json)
         VALUES (?, ?, ?, ?, ?, 'INR', ?, ?, 'paid', ?, ?)`
      )
      .run(
        user.id,
        patient.id,
        d.reference_type,
        d.reference_id,
        amount,
        d.payment_method,
        txnId,
        invNo,
        JSON.stringify({ total: amount, mode: ENV.RAZORPAY_KEY_ID ? 'razorpay_live' : 'razorpay_sandbox' })
      );

    if (d.reference_type === 'medicine_order') {
      db.prepare(`UPDATE medicine_orders SET payment_status = 'paid', updated_at = datetime('now') WHERE id = ?`).run(
        d.reference_id
      );
    }

    return db.prepare('SELECT * FROM payments WHERE id = ?').get(info.lastInsertRowid);
  })();

  logAudit({
    actorUserId: user.id,
    actorRole: user.role,
    action: 'PAYMENT_PROCESSED',
    resourceType: 'payments',
    resourceId: (payment as any).id,
    ipAddress: req.ip,
    details: { reference_type: d.reference_type, reference_id: d.reference_id, amount },
  });

  res.status(201).json({
    payment,
    gateway_mode: ENV.RAZORPAY_KEY_ID ? 'live' : 'razorpay_sandbox',
  });
});

export default router;
