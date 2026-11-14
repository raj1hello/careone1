import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import Database from 'better-sqlite3';
import { setDbForTesting } from '../db/database.ts';
import { initializeSchema } from '../db/schema.ts';
import { seedDatabaseIfEmpty } from '../db/seed.ts';
import { createApp } from '../../server.ts';

let server: http.Server;
let baseUrl = '';
let db: Database.Database;

async function api(
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {}
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

before(async () => {
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initializeSchema(db);
  seedDatabaseIfEmpty(db);
  setDbForTesting(db);

  const app = createApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  db.close();
});

describe('CareOne Backend API, Security & Cross-Portal Workflows', () => {
  let patientToken = '';
  let doctorToken = '';
  let doctor2Token = '';
  let hospitalToken = '';
  let pharmacyToken = '';

  it('1. Rejects unauthenticated requests to protected endpoints', async () => {
    const res = await api('/api/patient/dashboard');
    assert.equal(res.status, 401);
  });

  it('2. Authenticates seeded roles and supports JWT refresh rotation', async () => {
    const pLogin = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'patient@careone.health', password: 'CareOne@2026' },
    });
    assert.equal(pLogin.status, 200);
    assert.ok(pLogin.data.accessToken);
    assert.ok(pLogin.data.refreshToken);
    assert.equal(pLogin.data.user.role, 'patient');
    patientToken = pLogin.data.accessToken;

    // Refresh token rotation
    const refreshRes = await api('/api/auth/refresh', {
      method: 'POST',
      body: { refreshToken: pLogin.data.refreshToken },
    });
    assert.equal(refreshRes.status, 200);
    assert.ok(refreshRes.data.accessToken);

    // Reusing old refresh token must fail
    const reuseRes = await api('/api/auth/refresh', {
      method: 'POST',
      body: { refreshToken: pLogin.data.refreshToken },
    });
    assert.equal(reuseRes.status, 401);

    const dLogin = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'doctor@careone.health', password: 'CareOne@2026' },
    });
    assert.equal(dLogin.status, 200);
    doctorToken = dLogin.data.accessToken;

    const d2Login = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'dr.iyer@careone.health', password: 'CareOne@2026' },
    });
    assert.equal(d2Login.status, 200);
    doctor2Token = d2Login.data.accessToken;

    const hLogin = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'hospital@careone.health', password: 'CareOne@2026' },
    });
    assert.equal(hLogin.status, 200);
    hospitalToken = hLogin.data.accessToken;

    const phLogin = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'pharmacy@careone.health', password: 'CareOne@2026' },
    });
    assert.equal(phLogin.status, 200);
    pharmacyToken = phLogin.data.accessToken;
  });

  it('3. Enforces RBAC and prevents IDOR on patient medical history', async () => {
    const forbiddenHosp = await api('/api/hospitals/dashboard', { token: patientToken });
    assert.equal(forbiddenHosp.status, 403);

    const forbiddenPharm = await api('/api/pharmacies/dashboard', { token: doctorToken });
    assert.equal(forbiddenPharm.status, 403);

    // Dr. Ananya Iyer (doctor2) has NO relationship with Patient #1 (Aarav Sharma)
    const idorAttempt = await api('/api/doctors/patients/1/history', { token: doctor2Token });
    assert.equal(idorAttempt.status, 403);

    // Dr. Elena Vance (doctor1) HAS appointments with Patient #1
    const authorizedHistory = await api('/api/doctors/patients/1/history', { token: doctorToken });
    assert.equal(authorizedHistory.status, 200);
    assert.equal(authorizedHistory.data.patient.mrn, 'MRN-2026-1042');
  });

  it('4. Executes full Patient -> Doctor -> Consultation -> Prescription -> Pharmacy -> Payment workflow', async () => {
    // Patient searches verified doctors
    const docsRes = await api('/api/doctors?specialization=Cardiology');
    assert.equal(docsRes.status, 200);
    assert.ok(docsRes.data.doctors.length >= 1);
    const doctorId = docsRes.data.doctors[0].id;

    // Patient books an appointment
    const bookRes = await api('/api/appointments', {
      method: 'POST',
      token: patientToken,
      body: {
        doctor_id: doctorId,
        appointment_date: '2026-11-20',
        time_slot: '11:30',
        mode: 'video',
        reason: 'Follow-up cardiac lipid evaluation',
      },
    });
    assert.equal(bookRes.status, 201);
    const apptId = bookRes.data.appointment.id;

    // Doctor accepts appointment -> auto-creates consultation room
    const acceptRes = await api(`/api/appointments/${apptId}/status`, {
      method: 'PATCH',
      token: doctorToken,
      body: { status: 'accepted' },
    });
    assert.equal(acceptRes.status, 200);
    assert.ok(acceptRes.data.appointment.room_code);
    const consultId = acceptRes.data.appointment.consultation_id;

    // Doctor updates consultation notes & vitals
    const consultRes = await api(`/api/consultations/${consultId}`, {
      method: 'PATCH',
      token: doctorToken,
      body: {
        status: 'active',
        clinical_notes: 'BP controlled on Telmisartan 40mg. Continue therapy.',
        vitals: { bp: '124/78 mmHg', hr: '70 bpm', spo2: '99%' },
      },
    });
    assert.equal(consultRes.status, 200);

    // Doctor issues digital prescription
    const rxRes = await api('/api/prescriptions', {
      method: 'POST',
      token: doctorToken,
      body: {
        patient_id: 1,
        consultation_id: consultId,
        appointment_id: apptId,
        diagnosis: 'Controlled Essential Hypertension',
        notes: 'Continue morning dose.',
        items: [
          {
            medicine_name: 'Telmisartan 40mg',
            dosage: '40mg',
            frequency: 'Once daily',
            duration_days: 30,
          },
        ],
      },
    });
    assert.equal(rxRes.status, 201);
    const rxId = rxRes.data.prescription.id;

    // Patient views pharmacy catalog and places order linked to digital prescription
    const catRes = await api('/api/pharmacies/catalog?search=Telmisartan');
    assert.equal(catRes.status, 200);
    const med = catRes.data.medicines[0];
    const initialStock = med.stock_quantity;

    const orderRes = await api('/api/orders', {
      method: 'POST',
      token: patientToken,
      body: {
        pharmacy_id: med.pharmacy_id,
        prescription_id: rxId,
        delivery_address: '704 Seaface Residency, Mumbai',
        items: [{ medicine_id: med.id, quantity: 2 }],
      },
    });
    assert.equal(orderRes.status, 201);
    const orderId = orderRes.data.order.id;

    // Pharmacy verifies order -> stock atomically decrements
    const verifyRes = await api(`/api/pharmacies/orders/${orderId}/status`, {
      method: 'PATCH',
      token: pharmacyToken,
      body: { status: 'verified' },
    });
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.data.order.status, 'verified');

    const catAfter = await api('/api/pharmacies/catalog?search=Telmisartan');
    assert.equal(catAfter.data.medicines[0].stock_quantity, initialStock - 2);

    // Patient completes checkout payment
    const payRes = await api('/api/payments/checkout', {
      method: 'POST',
      token: patientToken,
      body: {
        reference_type: 'medicine_order',
        reference_id: orderId,
        payment_method: 'razorpay_sandbox',
      },
    });
    assert.equal(payRes.status, 201);
    assert.equal(payRes.data.payment.status, 'paid');
  });

  it('5. Executes Hospital Bed Allocation, Admission, Discharge & Emergency Dispatch workflow', async () => {
    const dashBefore = await api('/api/hospitals/dashboard', { token: hospitalToken });
    assert.equal(dashBefore.status, 200);

    // Verify pending doctor (Dr. Kavya Mehta)
    const pendingDoc = dashBefore.data.doctors.find((d: any) => d.verification_status === 'pending');
    assert.ok(pendingDoc);
    const verifyDocRes = await api(`/api/hospitals/doctors/${pendingDoc.id}/verify`, {
      method: 'PATCH',
      token: hospitalToken,
      body: { status: 'verified' },
    });
    assert.equal(verifyDocRes.status, 200);
    assert.equal(verifyDocRes.data.doctor.verification_status, 'verified');

    // Admit patient to an available ICU bed
    const availBed = dashBefore.data.beds.find((b: any) => b.bed_type === 'icu' && b.status === 'available');
    assert.ok(availBed);

    const admitRes = await api('/api/hospitals/admissions', {
      method: 'POST',
      token: hospitalToken,
      body: {
        patient_id: 1,
        bed_id: availBed.id,
        admission_type: 'inpatient',
        diagnosis: 'Telemetry observation overnight',
      },
    });
    assert.equal(admitRes.status, 201);
    const admissionId = admitRes.data.admission.id;

    // Discharge patient -> releases bed, publishes discharge summary to patient records, creates invoice
    const dischargeRes = await api(`/api/hospitals/admissions/${admissionId}/discharge`, {
      method: 'POST',
      token: hospitalToken,
      body: {
        discharge_summary: 'Overnight cardiac telemetry stable. Cleared for home discharge.',
        total_billed_amount: 16500,
        insurance_covered_amount: 12000,
      },
    });
    assert.equal(dischargeRes.status, 200);
    assert.equal(dischargeRes.data.admission.status, 'discharged');

    // Verify bed released back to available
    const dashAfter = await api('/api/hospitals/dashboard', { token: hospitalToken });
    const releasedBed = dashAfter.data.beds.find((b: any) => b.id === availBed.id);
    assert.equal(releasedBed.status, 'available');

    // Patient requests emergency ambulance -> Hospital dispatches
    const emgRes = await api('/api/emergency', {
      method: 'POST',
      token: patientToken,
      body: {
        emergency_type: 'Severe Hypertension Spike',
        severity: 'high',
        pickup_location: 'Prabhadevi Seaface, Mumbai',
        contact_phone: '+91-9819011223',
      },
    });
    assert.equal(emgRes.status, 201);
    const emgId = emgRes.data.request.id;

    const dispatchRes = await api(`/api/emergency/${emgId}/status`, {
      method: 'PATCH',
      token: hospitalToken,
      body: { status: 'dispatched', ambulance_unit: 'ALS-MUM-07', eta_minutes: 8 },
    });
    assert.equal(dispatchRes.status, 200);
    assert.equal(dispatchRes.data.request.ambulance_unit, 'ALS-MUM-07');
  });

  it('6. Rejects invalid file MIME uploads on medical records', async () => {
    const badUpload = await api('/api/records', {
      method: 'POST',
      token: patientToken,
      body: {
        record_type: 'lab_report',
        title: 'Invalid Executable',
        file_name: 'payload.exe',
        file_mime: 'application/x-msdownload',
      },
    });
    assert.equal(badUpload.status, 400);
  });

  it('7. Enforces patient RBAC, schema validation, and non-mock contract on /api/ai endpoints', async () => {
    const unauthStatus = await api('/api/ai/status');
    assert.equal(unauthStatus.status, 401);

    const doctorForbidden = await api('/api/ai/status', { token: doctorToken });
    assert.equal(doctorForbidden.status, 403);

    const patientStatus = await api('/api/ai/status', { token: patientToken });
    assert.equal(patientStatus.status, 200);
    assert.equal(patientStatus.data.provider, 'gemini');
    assert.equal(patientStatus.data.endpoint, '/api/ai/assistant');

    const badPayload = await api('/api/ai/assistant', {
      method: 'POST',
      token: patientToken,
      body: { messages: [] },
    });
    assert.equal(badPayload.status, 400);

    // Without GEMINI_API_KEY configured in test env, backend must return 503 instead of mocked AI responses
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const noKeyRes = await api('/api/ai/assistant', {
        method: 'POST',
        token: patientToken,
        body: { messages: [{ role: 'user', content: 'I have a headache.' }] },
      });
      assert.equal(noKeyRes.status, 503);
      assert.equal(noKeyRes.data.configured, false);
      assert.equal(noKeyRes.data.endpoint, '/api/ai/assistant');
      assert.ok(noKeyRes.data.error);
    } finally {
      if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
    }
  });

  it('8. Supports Hospital doctor onboarding, bed transfers, billing CRUD, facility resources, and emergency assignments', async () => {
    // 1. Add affiliated doctor
    const addDocRes = await api('/api/hospitals/doctors', {
      method: 'POST',
      token: hospitalToken,
      body: {
        full_name: 'Dr. Rohan Deshmukh',
        email: 'rohan.deshmukh@careone.health',
        phone: '+91-9820012345',
        license_no: 'MH-MED-99210',
        specialization: 'Orthopedics',
        qualification: 'MS Orthopedics',
        experience_years: 9,
        consultation_fee: 1100,
      },
    });
    assert.equal(addDocRes.status, 201);
    assert.equal(addDocRes.data.doctor.verification_status, 'verified');
    const newDoctorId = addDocRes.data.doctor.id;

    // 2. Admit OPD patient then transfer/assign to an available bed
    const dash = await api('/api/hospitals/dashboard', { token: hospitalToken });
    const availBeds = dash.data.beds.filter((b: any) => b.status === 'available');
    assert.ok(availBeds.length >= 2);
    const bedA = availBeds[0];
    const bedB = availBeds[1];

    const admitRes = await api('/api/hospitals/admissions', {
      method: 'POST',
      token: hospitalToken,
      body: {
        patient_id: 1,
        attending_doctor_id: newDoctorId,
        bed_id: bedA.id,
        admission_type: 'inpatient',
        diagnosis: 'Post-arthroscopy monitoring',
      },
    });
    assert.equal(admitRes.status, 201);
    const admId = admitRes.data.admission.id;

    const transferRes = await api(`/api/hospitals/admissions/${admId}/transfer-bed`, {
      method: 'PATCH',
      token: hospitalToken,
      body: { bed_id: bedB.id },
    });
    assert.equal(transferRes.status, 200);
    assert.equal(transferRes.data.admission.bed_id, bedB.id);

    // 3. Create hospital bill & mark paid
    const billRes = await api('/api/hospitals/bills', {
      method: 'POST',
      token: hospitalToken,
      body: {
        admission_id: admId,
        gross_amount: 5500,
        insurance_covered: 2000,
        status: 'pending',
        payment_method: 'hospital_billing',
      },
    });
    assert.equal(billRes.status, 201);
    assert.equal(billRes.data.payment.amount, 3500);
    assert.equal(billRes.data.payment.status, 'pending');

    const markPaidRes = await api(`/api/hospitals/bills/${billRes.data.payment.id}/status`, {
      method: 'PATCH',
      token: hospitalToken,
      body: { status: 'paid' },
    });
    assert.equal(markPaidRes.status, 200);
    assert.equal(markPaidRes.data.payment.status, 'paid');

    // 4. Create & update facility resource
    const resCreate = await api('/api/hospitals/resources', {
      method: 'POST',
      token: hospitalToken,
      body: {
        resource_type: 'operation_theatre',
        name: 'Modular Orthopedic OT-3',
        department: 'Orthopedics',
        location: 'Block B · Level 3',
        status: 'operational',
        notes: 'Laminar airflow verified',
      },
    });
    assert.equal(resCreate.status, 201);
    const resourceId = resCreate.data.resource.id;

    const resPatch = await api(`/api/hospitals/resources/${resourceId}`, {
      method: 'PATCH',
      token: hospitalToken,
      body: { status: 'in_use' },
    });
    assert.equal(resPatch.status, 200);
    assert.equal(resPatch.data.resource.status, 'in_use');

    // 5. Assign emergency doctor, department & reserve bedA (now freed after transfer)
    const emgCreate = await api('/api/emergency', {
      method: 'POST',
      token: patientToken,
      body: {
        emergency_type: 'Acute Fracture Trauma',
        severity: 'high',
        pickup_location: 'Bandra West, Mumbai',
        contact_phone: '+91-9819099887',
      },
    });
    assert.equal(emgCreate.status, 201);

    const emgAssign = await api(`/api/emergency/${emgCreate.data.request.id}/status`, {
      method: 'PATCH',
      token: hospitalToken,
      body: {
        status: 'dispatched',
        ambulance_unit: 'ALS-MUM-11',
        eta_minutes: 6,
        assigned_doctor_id: newDoctorId,
        department: 'Orthopedics',
        bed_id: bedA.id,
      },
    });
    assert.equal(emgAssign.status, 200);
    assert.equal(emgAssign.data.request.assigned_doctor_id, newDoctorId);
    assert.equal(emgAssign.data.request.bed_id, bedA.id);

    const dashAfter = await api('/api/hospitals/dashboard', { token: hospitalToken });
    const reservedBedA = dashAfter.data.beds.find((b: any) => b.id === bedA.id);
    assert.equal(reservedBedA.status, 'reserved');
  });
});
