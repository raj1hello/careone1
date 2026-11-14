import bcrypt from 'bcryptjs';
import type Database from 'better-sqlite3';

export function seedDatabaseIfEmpty(db: Database.Database): void {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
  if (existing.cnt > 0) {
    return;
  }

  const passwordHash = bcrypt.hashSync('CareOne@2026', 10);

  const tx = db.transaction(() => {
    const insertUser = db.prepare(
      `INSERT INTO users (email, password_hash, role, full_name, phone, is_active, is_verified)
       VALUES (?, ?, ?, ?, ?, 1, 1)`
    );

    // 1. Admin
    const adminRes = insertUser.run('admin@careone.health', passwordHash, 'admin', 'CareOne Platform Admin', '+91-9800000001');

    // 2. Hospital User & Profile
    const hospUserRes = insertUser.run('hospital@careone.health', passwordHash, 'hospital', 'Apex Central Clinical Hospital', '+91-22-48001000');
    const hospRes = db
      .prepare(
        `INSERT INTO hospitals (user_id, name, registration_no, verification_status, email, phone, address, city, state, emergency_phone, departments_json, facilities_json, branch_code, total_beds_capacity)
         VALUES (?, ?, ?, 'verified', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        hospUserRes.lastInsertRowid,
        'Apex Central Clinical Hospital',
        'HOSP-MH-2026-001',
        'hospital@careone.health',
        '+91-22-48001000',
        '42 Marine Clinical Plaza, Worli',
        'Mumbai',
        'Maharashtra',
        '+91-22-48001911',
        JSON.stringify(['Cardiology', 'Pulmonology', 'Neurology', 'Emergency Medicine', 'Internal Medicine', 'Orthopedics']),
        JSON.stringify(['24x7 Cardiac Cath Lab', '3T MRI & CT Diagnostics', 'Level-1 Trauma Center', 'Negative Pressure ICU', 'Telemedicine Command']),
        'MUM-HQ',
        120
      );
    const hospitalId = Number(hospRes.lastInsertRowid);

    // Second Hospital
    const hosp2UserRes = insertUser.run('metro@careone.health', passwordHash, 'hospital', 'Metro LifeSciences Medical Center', '+91-80-41002000');
    const hosp2Res = db
      .prepare(
        `INSERT INTO hospitals (user_id, name, registration_no, verification_status, email, phone, address, city, state, emergency_phone, departments_json, facilities_json, branch_code, total_beds_capacity)
         VALUES (?, ?, ?, 'verified', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        hosp2UserRes.lastInsertRowid,
        'Metro LifeSciences Medical Center',
        'HOSP-KA-2026-014',
        'metro@careone.health',
        '+91-80-41002000',
        '18 Residency Road, Indiranagar',
        'Bengaluru',
        'Karnataka',
        '+91-80-41002911',
        JSON.stringify(['General Medicine', 'Endocrinology', 'Pediatrics', 'Surgical ICU']),
        JSON.stringify(['Robotic Surgery Suite', '24x7 Pharmacy', 'Dialysis Unit']),
        'BLR-01',
        85
      );
    const hospital2Id = Number(hosp2Res.lastInsertRowid);

    // Hospital Staff
    const insertStaff = db.prepare(
      `INSERT INTO hospital_staff (hospital_id, full_name, role_title, department, staff_role, shift_schedule, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    insertStaff.run(hospitalId, 'Meera Deshmukh', 'Chief Nursing Officer', 'Critical Care ICU', 'nurse', 'Morning (07:00 - 15:00)', '+91-9820100111');
    insertStaff.run(hospitalId, 'Vikram Nair', 'Bed & Admission Coordinator', 'Admissions & OPD', 'coordinator', 'Morning (08:00 - 16:00)', '+91-9820100222');
    insertStaff.run(hospitalId, 'Sunita Kulkarni', 'Senior Billing Officer', 'Revenue & Insurance', 'billing', 'Day (09:00 - 17:00)', '+91-9820100333');
    insertStaff.run(hospitalId, 'Arjun Verma', 'Emergency Triage Lead', 'Emergency Medicine', 'nurse', 'Night (20:00 - 04:00)', '+91-9820100444');

    // 3. Doctors
    const doc1User = insertUser.run('doctor@careone.health', passwordHash, 'doctor', 'Dr. Elena Vance', '+91-9820200101');
    const doc1Res = db
      .prepare(
        `INSERT INTO doctors (user_id, hospital_id, license_no, verification_status, specialization, qualification, experience_years, consultation_fee, bio, available_days_json, slot_start_time, slot_end_time, is_available_for_video, rating)
         VALUES (?, ?, ?, 'verified', ?, ?, ?, ?, ?, ?, ?, ?, 1, 4.9)`
      )
      .run(
        doc1User.lastInsertRowid,
        hospitalId,
        'MCI-MH-44910',
        'Cardiology',
        'MD, DM (Interventional Cardiology)',
        14,
        1200,
        'Senior Consultant Cardiologist specializing in preventive lipidology, arrhythmia telemetry, and acute coronary care.',
        JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']),
        '09:00',
        '17:00'
      );
    const doctor1Id = Number(doc1Res.lastInsertRowid);

    const doc2User = insertUser.run('dr.patel@careone.health', passwordHash, 'doctor', 'Dr. Rohan Patel', '+91-9820200102');
    const doc2Res = db
      .prepare(
        `INSERT INTO doctors (user_id, hospital_id, license_no, verification_status, specialization, qualification, experience_years, consultation_fee, bio, available_days_json, slot_start_time, slot_end_time, is_available_for_video, rating)
         VALUES (?, ?, ?, 'verified', ?, ?, ?, ?, ?, ?, ?, ?, 1, 4.8)`
      )
      .run(
        doc2User.lastInsertRowid,
        hospitalId,
        'MCI-MH-51029',
        'Pulmonology',
        'MD (Pulmonary & Critical Care)',
        11,
        950,
        'Focused on respiratory diagnostics, post-viral recovery, sleep apnea, and ICU ventilator management.',
        JSON.stringify(['Mon', 'Wed', 'Thu', 'Fri']),
        '10:00',
        '18:00'
      );
    const doctor2Id = Number(doc2Res.lastInsertRowid);

    const doc3User = insertUser.run('dr.iyer@careone.health', passwordHash, 'doctor', 'Dr. Ananya Iyer', '+91-9845020103');
    db.prepare(
      `INSERT INTO doctors (user_id, hospital_id, license_no, verification_status, specialization, qualification, experience_years, consultation_fee, bio, available_days_json, slot_start_time, slot_end_time, is_available_for_video, rating)
       VALUES (?, ?, ?, 'verified', ?, ?, ?, ?, ?, ?, ?, ?, 1, 4.9)`
    ).run(
      doc3User.lastInsertRowid,
      hospital2Id,
      'KMC-KA-33891',
      'Internal Medicine',
      'MD (General Medicine), FACP',
      16,
      800,
      'Comprehensive adult primary care, metabolic syndrome, hypertension, and chronic multi-morbidity coordination.',
      JSON.stringify(['Mon', 'Tue', 'Thu', 'Fri', 'Sat']),
      '08:30',
      '16:30'
    );

    // Pending doctor awaiting hospital verification
    const doc4User = insertUser.run('dr.mehta@careone.health', passwordHash, 'doctor', 'Dr. Kavya Mehta', '+91-9820200199');
    db.prepare(
      `INSERT INTO doctors (user_id, hospital_id, license_no, verification_status, specialization, qualification, experience_years, consultation_fee, bio, available_days_json, slot_start_time, slot_end_time, is_available_for_video, rating)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, 1, 4.7)`
    ).run(
      doc4User.lastInsertRowid,
      hospitalId,
      'MCI-MH-67210',
      'Neurology',
      'MD, DM (Neurology)',
      7,
      1100,
      'Stroke triage, migraine therapeutics, and clinical neurophysiology specialist.',
      JSON.stringify(['Tue', 'Wed', 'Thu', 'Fri']),
      '11:00',
      '19:00'
    );

    // 4. Patients
    const pat1User = insertUser.run('patient@careone.health', passwordHash, 'patient', 'Aarav Sharma', '+91-9819011223');
    const pat1Res = db
      .prepare(
        `INSERT INTO patients (user_id, mrn, dob, gender, blood_group, address, emergency_contact_name, emergency_contact_phone, allergies, chronic_conditions, insurance_provider, insurance_policy_no, height_cm, weight_kg)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        pat1User.lastInsertRowid,
        'MRN-2026-1042',
        '1991-06-18',
        'Male',
        'O+',
        '704 Seaface Residency, Prabhadevi, Mumbai 400025',
        'Neha Sharma',
        '+91-9819011299',
        'Penicillin (mild rash)',
        'Mild Essential Hypertension',
        'Star Clinical Shield',
        'SCS-992014-IN',
        176,
        74.5
      );
    const patient1Id = Number(pat1Res.lastInsertRowid);

    const pat2User = insertUser.run('priya.menon@careone.health', passwordHash, 'patient', 'Priya Menon', '+91-9820055443');
    const pat2Res = db
      .prepare(
        `INSERT INTO patients (user_id, mrn, dob, gender, blood_group, address, emergency_contact_name, emergency_contact_phone, allergies, chronic_conditions, insurance_provider, insurance_policy_no, height_cm, weight_kg)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        pat2User.lastInsertRowid,
        'MRN-2026-1088',
        '1984-11-02',
        'Female',
        'A+',
        '12 Pali Hill Crescent, Bandra West, Mumbai 400050',
        'Karthik Menon',
        '+91-9820055400',
        'Sulfa drugs',
        'Asthma (Well-controlled)',
        'HDFC Ergo Health',
        'HEH-441029',
        163,
        61.0
      );
    const patient2Id = Number(pat2Res.lastInsertRowid);

    // 5. Pharmacies
    const pharm1User = insertUser.run('pharmacy@careone.health', passwordHash, 'pharmacy', 'CareOne Central Apothecary', '+91-22-48003000');
    const pharm1Res = db
      .prepare(
        `INSERT INTO pharmacies (user_id, name, license_no, verification_status, phone, address, city, operating_hours, is_24x7)
         VALUES (?, ?, ?, 'verified', ?, ?, ?, ?, 1)`
      )
      .run(
        pharm1User.lastInsertRowid,
        'CareOne Central Apothecary',
        'PHARM-MH-2026-009',
        '+91-22-48003000',
        'Ground Floor, Marine Clinical Plaza, Worli',
        'Mumbai',
        '24 Hours',
      );
    const pharmacy1Id = Number(pharm1Res.lastInsertRowid);

    const pharm2User = insertUser.run('apollo.rx@careone.health', passwordHash, 'pharmacy', 'Vanguard Clinical Pharmacy', '+91-80-41003500');
    db.prepare(
      `INSERT INTO pharmacies (user_id, name, license_no, verification_status, phone, address, city, operating_hours, is_24x7)
       VALUES (?, ?, ?, 'verified', ?, ?, ?, ?, 0)`
    ).run(
      pharm2User.lastInsertRowid,
      'Vanguard Clinical Pharmacy',
      'PHARM-KA-2026-031',
      '+91-80-41003500',
      '22 Residency Road, Indiranagar',
      'Bengaluru',
      '07:00 - 23:00'
    );

    // 6. Pharmacy Medicines (including low-stock and near-expiry for real alerts!)
    const insertMed = db.prepare(
      `INSERT INTO medicines (pharmacy_id, name, generic_name, category, manufacturer, batch_number, unit_price, stock_quantity, reorder_level, expiry_date, requires_prescription)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const med1 = insertMed.run(pharmacy1Id, 'Telmisartan 40mg', 'Telmisartan', 'Cardiovascular', 'Sun Clinical', 'B-TEL-901', 145, 240, 40, '2027-08-30', 1);
    const med2 = insertMed.run(pharmacy1Id, 'Atorvastatin 20mg', 'Atorvastatin Calcium', 'Cardiovascular', 'Cipla Med', 'B-ATO-442', 190, 180, 35, '2027-05-15', 1);
    const med3 = insertMed.run(pharmacy1Id, 'Budesonide Inhaler 200mcg', 'Budesonide', 'Respiratory', 'AstraMed', 'B-BUD-112', 420, 12, 20, '2027-02-10', 1); // Low stock!
    const med4 = insertMed.run(pharmacy1Id, 'Paracetamol 650mg', 'Acetaminophen', 'Analgesic & Antipyretic', 'GSK Care', 'B-PCM-778', 35, 520, 100, '2028-01-20', 0);
    const med5 = insertMed.run(pharmacy1Id, 'Azithromycin 500mg', 'Azithromycin', 'Antibiotic', 'Dr. Reddy Labs', 'B-AZM-310', 120, 14, 25, '2026-12-05', 1); // Low stock & Expiring soon!
    insertMed.run(pharmacy1Id, 'Metformin SR 500mg', 'Metformin Hydrochloride', 'Endocrinology', 'USV Pharma', 'B-MET-509', 88, 310, 50, '2027-11-12', 1);
    insertMed.run(pharmacy1Id, 'Electrolyte ORS Sachet Pack', 'Oral Rehydration Salts', 'Hydration & OTC', 'FDC Care', 'B-ORS-102', 65, 95, 30, '2027-09-01', 0);

    // 7. Hospital Beds (General, Private, ICU, Emergency)
    const insertBed = db.prepare(
      `INSERT INTO beds (hospital_id, ward_name, bed_number, bed_type, daily_rate, status, current_patient_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const bed1 = insertBed.run(hospitalId, 'Cardiac Telemetry Ward A', 'GW-101', 'general', 2500, 'available', null);
    insertBed.run(hospitalId, 'Cardiac Telemetry Ward A', 'GW-102', 'general', 2500, 'available', null);
    insertBed.run(hospitalId, 'General Medical Ward B', 'GW-103', 'general', 2200, 'maintenance', null);
    const bed4 = insertBed.run(hospitalId, 'Executive Suites Wing', 'PV-201', 'private', 6500, 'occupied', patient2Id);
    insertBed.run(hospitalId, 'Executive Suites Wing', 'PV-202', 'private', 6500, 'available', null);
    insertBed.run(hospitalId, 'Intensive Care Unit 1', 'ICU-01', 'icu', 14000, 'available', null);
    insertBed.run(hospitalId, 'Intensive Care Unit 1', 'ICU-02', 'icu', 14000, 'available', null);
    insertBed.run(hospitalId, 'Emergency Triage Bay', 'ER-01', 'emergency', 4500, 'available', null);
    insertBed.run(hospitalId, 'Emergency Triage Bay', 'ER-02', 'emergency', 4500, 'available', null);
    void bed1;

    // 8. Hospital Admission for Priya Menon
    db.prepare(
      `INSERT INTO admissions (hospital_id, patient_id, attending_doctor_id, bed_id, admission_type, status, diagnosis, admitted_at, total_billed_amount, insurance_covered_amount)
       VALUES (?, ?, ?, ?, 'inpatient', 'admitted', ?, datetime('now', '-2 days'), 19500, 15000)`
    ).run(
      hospitalId,
      patient2Id,
      doctor2Id,
      bed4.lastInsertRowid,
      'Acute Bronchial Exacerbation — Nebulization & Monitoring'
    );

    // 9. Appointments & Consultations
    const appt1 = db
      .prepare(
        `INSERT INTO appointments (patient_id, doctor_id, hospital_id, appointment_date, time_slot, mode, status, reason)
         VALUES (?, ?, ?, date('now'), '10:30', 'video', 'accepted', 'Routine blood pressure review and lipid panel follow-up')`
      )
      .run(patient1Id, doctor1Id, hospitalId);

    const consult1 = db
      .prepare(
        `INSERT INTO consultations (appointment_id, patient_id, doctor_id, room_code, status, chief_complaint, clinical_notes, vitals_json, follow_up_date, follow_up_notes)
         VALUES (?, ?, ?, ?, 'scheduled', ?, ?, ?, date('now', '+14 days'), ?)`
      )
      .run(
        appt1.lastInsertRowid,
        patient1Id,
        doctor1Id,
        'VID-CARE-1042',
        'Intermittent morning headaches; home BP averaging 136/86 mmHg.',
        'Patient adherent to low-sodium diet. Review fasting lipid panel during VidDoc session.',
        JSON.stringify({ bp: '136/86 mmHg', hr: '74 bpm', spo2: '99%', temp: '98.4 F' }),
        'Repeat fasting lipid profile and home BP log in 2 weeks.'
      );

    // Completed past appointment + consultation + digital prescription
    const appt2 = db
      .prepare(
        `INSERT INTO appointments (patient_id, doctor_id, hospital_id, appointment_date, time_slot, mode, status, reason)
         VALUES (?, ?, ?, date('now', '-7 days'), '15:00', 'in_person', 'completed', 'Annual preventive cardiovascular assessment')`
      )
      .run(patient1Id, doctor1Id, hospitalId);

    const consult2 = db
      .prepare(
        `INSERT INTO consultations (appointment_id, patient_id, doctor_id, room_code, status, started_at, ended_at, chief_complaint, clinical_notes, vitals_json, follow_up_date, follow_up_notes)
         VALUES (?, ?, ?, ?, 'ended', datetime('now', '-7 days'), datetime('now', '-7 days', '+25 minutes'), ?, ?, ?, date('now', '+7 days'), ?)`
      )
      .run(
        appt2.lastInsertRowid,
        patient1Id,
        doctor1Id,
        'VID-CARE-0991',
        'Baseline ECG & cardiovascular risk stratification.',
        'Normal sinus rhythm on 12-lead ECG. LDL slightly elevated at 138 mg/dL. Initiating low-dose statin & ARB.',
        JSON.stringify({ bp: '138/88 mmHg', hr: '76 bpm', spo2: '98%', temp: '98.6 F' }),
        'Telemedicine follow-up to evaluate tolerance.'
      );

    // Pending appointment for Doctor Portal approval testing
    db.prepare(
      `INSERT INTO appointments (patient_id, doctor_id, hospital_id, appointment_date, time_slot, mode, status, reason)
       VALUES (?, ?, ?, date('now', '+1 day'), '14:00', 'video', 'pending', 'Pulmonary spirometry report interpretation')`
    ).run(patient1Id, doctor2Id, hospitalId);

    // 10. Digital Prescription
    const rxRes = db
      .prepare(
        `INSERT INTO prescriptions (consultation_id, appointment_id, patient_id, doctor_id, diagnosis, notes, valid_until, status)
         VALUES (?, ?, ?, ?, ?, ?, date('now', '+30 days'), 'active')`
      )
      .run(
        consult2.lastInsertRowid,
        appt2.lastInsertRowid,
        patient1Id,
        doctor1Id,
        'Essential Hypertension (Stage 1) & Borderline Hyperlipidemia',
        'Take morning blood pressure reading prior to Telmisartan dose. Avoid grapefruit with Atorvastatin.',
      );
    const rxId = Number(rxRes.lastInsertRowid);

    const insertRxItem = db.prepare(
      `INSERT INTO prescription_items (prescription_id, medicine_name, generic_name, dosage, frequency, duration_days, instructions)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    insertRxItem.run(rxId, 'Telmisartan 40mg', 'Telmisartan', '1 tablet (40mg)', 'Once daily (Morning)', 30, 'Take with water after breakfast');
    insertRxItem.run(rxId, 'Atorvastatin 20mg', 'Atorvastatin Calcium', '1 tablet (20mg)', 'Once daily (Bedtime)', 30, 'Take at night');

    // 11. Medical Records
    const insertRec = db.prepare(
      `INSERT INTO medical_records (patient_id, uploaded_by_user_id, hospital_id, doctor_id, record_type, title, summary, file_name, file_mime, file_size_bytes, record_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertRec.run(
      patient1Id,
      Number(doc1User.lastInsertRowid),
      hospitalId,
      doctor1Id,
      'lab_report',
      'Comprehensive Metabolic & Lipid Panel',
      'Total Cholesterol: 212 mg/dL, LDL: 138 mg/dL, HDL: 48 mg/dL, HbA1c: 5.5%, Creatinine: 0.92 mg/dL.',
      'lipid_metabolic_panel_mrn1042.pdf',
      'application/pdf',
      245120,
      '2026-11-05'
    );
    insertRec.run(
      patient1Id,
      Number(doc1User.lastInsertRowid),
      hospitalId,
      doctor1Id,
      'imaging',
      '12-Lead Resting Electrocardiogram',
      'Normal sinus rhythm at 74 bpm. No ST-T wave abnormalities or chamber hypertrophy.',
      'ecg_resting_12lead.png',
      'image/png',
      182400,
      '2026-11-07'
    );

    // 12. Medicine Reminders
    const insertRem = db.prepare(
      `INSERT INTO medicine_reminders (patient_id, medicine_name, dosage, schedule_time, frequency, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`
    );
    insertRem.run(patient1Id, 'Telmisartan 40mg', '1 tablet', '08:00', 'Daily');
    insertRem.run(patient1Id, 'Atorvastatin 20mg', '1 tablet', '22:00', 'Daily');

    // 13. Medicine Order (Sample verified/preparing order)
    const ordRes = db
      .prepare(
        `INSERT INTO medicine_orders (patient_id, pharmacy_id, prescription_id, status, delivery_address, total_amount, payment_status)
         VALUES (?, ?, ?, 'preparing', ?, ?, 'paid')`
      )
      .run(
        patient1Id,
        pharmacy1Id,
        rxId,
        '704 Seaface Residency, Prabhadevi, Mumbai 400025',
        335
      );
    db.prepare(
      `INSERT INTO medicine_order_items (order_id, medicine_id, medicine_name, quantity, unit_price, subtotal)
       VALUES (?, ?, ?, 1, 145, 145), (?, ?, ?, 1, 190, 190)`
    ).run(ordRes.lastInsertRowid, med1.lastInsertRowid, 'Telmisartan 40mg', ordRes.lastInsertRowid, med2.lastInsertRowid, 'Atorvastatin 20mg');

    // 14. Payments & Invoices
    db.prepare(
      `INSERT INTO payments (payer_user_id, patient_id, reference_type, reference_id, amount, currency, payment_method, transaction_id, status, invoice_number, breakdown_json)
       VALUES (?, ?, 'appointment', ?, 1200, 'INR', 'razorpay_sandbox', 'pay_CARE_991001', 'paid', 'INV-2026-0001', ?)`
    ).run(pat1User.lastInsertRowid, patient1Id, appt2.lastInsertRowid, JSON.stringify({ consultation: 1200, platform_fee: 0 }));

    db.prepare(
      `INSERT INTO payments (payer_user_id, patient_id, reference_type, reference_id, amount, currency, payment_method, transaction_id, status, invoice_number, breakdown_json)
       VALUES (?, ?, 'medicine_order', ?, 335, 'INR', 'razorpay_sandbox', 'pay_CARE_991002', 'paid', 'INV-2026-0002', ?)`
    ).run(pat1User.lastInsertRowid, patient1Id, ordRes.lastInsertRowid, JSON.stringify({ subtotal: 335, delivery: 0 }));

    // 15. Notifications
    const insertNotif = db.prepare(
      `INSERT INTO notifications (user_id, title, message, category, is_read, action_url)
       VALUES (?, ?, ?, ?, 0, ?)`
    );
    insertNotif.run(pat1User.lastInsertRowid, 'VidDoc Appointment Confirmed', 'Dr. Elena Vance confirmed your video consultation today at 10:30 (Room VID-CARE-1042).', 'appointment', '/patient/consultations');
    insertNotif.run(pat1User.lastInsertRowid, 'Prescription Order Preparing', 'CareOne Central Apothecary verified Rx #' + rxId + ' and is preparing your medications.', 'order', '/patient/orders');
    insertNotif.run(doc1User.lastInsertRowid, 'Upcoming VidDoc Session', 'Patient Aarav Sharma (MRN-2026-1042) is scheduled for 10:30 video consultation.', 'appointment', '/doctor/consultations');
    insertNotif.run(hospUserRes.lastInsertRowid, 'Doctor Verification Pending', 'Dr. Kavya Mehta (Neurology, MCI-MH-67210) requested hospital affiliation verification.', 'hospital', '/hospital/staff');
    insertNotif.run(pharm1User.lastInsertRowid, 'Inventory Stock Alert', 'Budesonide Inhaler 200mcg (12 left) and Azithromycin 500mg (14 left) are below reorder threshold.', 'order', '/pharmacy/inventory');

    // 16. Emergency Request
    db.prepare(
      `INSERT INTO emergency_requests (patient_id, requester_user_id, hospital_id, emergency_type, severity, pickup_location, contact_phone, description, status, ambulance_unit, eta_minutes)
       VALUES (?, ?, ?, 'Cardiac Chest Pain Triage', 'critical', '14 Worli Sea Face Promenade, Mumbai', '+91-9820055443', 'Acute substernal tightness, EMS ALS unit dispatched.', 'en_route', 'ALS-MUM-04', 6)`
    ).run(patient2Id, pat2User.lastInsertRowid, hospitalId);

    // 17. Financial Assistance Programs
    const insertProg = db.prepare(
      `INSERT INTO financial_assistance_programs (title, provider, coverage_limit, eligibility_criteria, application_url, category)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    insertProg.run('Ayushman Bharat PM-JAY Clinical Shield', 'National Health Authority', 'Up to INR 5,00,000 / year', 'Eligible families for secondary & tertiary hospitalization across empaneled CareOne hospitals.', 'https://pmjay.gov.in', 'Government & Public');
    insertProg.run('CareOne Cardiac & Chronic Care Subsidy', 'CareOne Foundation & Partner Hospitals', 'Up to 40% fee waiver on diagnostics & generic meds', 'Patients with chronic hypertension, diabetes, or cardiac care under household income threshold.', '', 'Hospital Financial Aid');
    insertProg.run('Emergency Trauma Cashless Stabilization', 'State Trauma Network', 'First 48 hours stabilization covered', 'Immediate emergency admission at any verified CareOne Level-1 Trauma facility.', '', 'Emergency Relief');

    // 18. Hospital Resources (Labs, OTs, Equipment, Rooms)
    const insertResource = db.prepare(
      `INSERT INTO hospital_resources (hospital_id, resource_type, name, department, location, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    insertResource.run(hospitalId, 'equipment', '3T MRI Diagnostic Scanner', 'Neurology', 'Diagnostic Wing B1', 'operational', 'Calibrated and active for scheduled & emergency scans');
    insertResource.run(hospitalId, 'equipment', 'Biplane Cardiac Cath Lab', 'Cardiology', '2nd Floor Cath Suite', 'in_use', 'Interventional angiography schedule active');
    insertResource.run(hospitalId, 'laboratory', 'Central Hematology & Biochemistry Lab', 'Internal Medicine', '1st Floor Lab Block', 'operational', '24x7 automated analyzer online');
    insertResource.run(hospitalId, 'operation_theatre', 'Modular Operation Theatre 01', 'Orthopedics', '3rd Floor Surgical Wing', 'operational', 'HEPA laminar flow verified');
    insertResource.run(hospitalId, 'operation_theatre', 'Hybrid Cardiothoracic OT 02', 'Cardiology', '3rd Floor Surgical Wing', 'maintenance', 'Scheduled sterile HVAC filter check');
    insertResource.run(hospitalId, 'room', 'Negative Pressure Isolation Suite', 'Pulmonology', 'ICU Wing North', 'operational', 'Ready for respiratory isolation');

    // Completed prior hospital admission + paid settlement for realistic billing/analytics history
    const pastAdm = db
      .prepare(
        `INSERT INTO admissions (hospital_id, patient_id, attending_doctor_id, bed_id, admission_type, status, diagnosis, admitted_at, discharged_at, discharge_summary, total_billed_amount, insurance_covered_amount)
         VALUES (?, ?, ?, NULL, 'opd', 'discharged', ?, datetime('now', '-5 days'), datetime('now', '-5 days', '+3 hours'), ?, 4500, 3000)`
      )
      .run(
        hospitalId,
        patient1Id,
        doctor1Id,
        'Outpatient Echocardiography & Lipid Workup',
        'Outpatient echo normal LV systolic function (EF 62%). Advised lifestyle & statin follow-up.'
      );
    db.prepare(
      `INSERT INTO payments (payer_user_id, patient_id, reference_type, reference_id, amount, currency, payment_method, transaction_id, status, invoice_number, breakdown_json, created_at)
       VALUES (?, ?, 'admission', ?, 1500, 'INR', 'card', 'pay_CARE_884100', 'paid', 'INV-2026-0000', ?, datetime('now', '-5 days'))`
    ).run(
      pat1User.lastInsertRowid,
      patient1Id,
      pastAdm.lastInsertRowid,
      JSON.stringify({ gross_bill: 4500, insurance_covered: 3000, net_payable: 1500 })
    );

    // 19. Initial Audit Log
    db.prepare(
      `INSERT INTO audit_logs (actor_user_id, actor_role, action, resource_type, resource_id, details_json)
       VALUES (?, 'admin', 'SYSTEM_SEED_INITIALIZED', 'database', 'careone', ?)`
    ).run(adminRes.lastInsertRowid, JSON.stringify({ seeded_modules: 17, med3_id: med3.lastInsertRowid, med5_id: med5.lastInsertRowid }));
  });

  tx();
}
