import type Database from 'better-sqlite3';

export function initializeSchema(db: Database.Database): void {
  db.exec(`
    -- 1. ACCOUNTS & SECURITY
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'hospital', 'pharmacy', 'admin')),
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      is_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      actor_role TEXT NOT NULL DEFAULT 'anonymous',
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL DEFAULT '',
      ip_address TEXT NOT NULL DEFAULT '',
      details_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);

    -- 2. PATIENTS
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      mrn TEXT NOT NULL UNIQUE,
      dob TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL DEFAULT 'Unspecified',
      blood_group TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      emergency_contact_name TEXT NOT NULL DEFAULT '',
      emergency_contact_phone TEXT NOT NULL DEFAULT '',
      allergies TEXT NOT NULL DEFAULT 'None reported',
      chronic_conditions TEXT NOT NULL DEFAULT 'None reported',
      insurance_provider TEXT NOT NULL DEFAULT '',
      insurance_policy_no TEXT NOT NULL DEFAULT '',
      height_cm REAL,
      weight_kg REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_patients_mrn ON patients(mrn);

    -- 3. HOSPITALS & STAFF
    CREATE TABLE IF NOT EXISTS hospitals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      registration_no TEXT NOT NULL UNIQUE,
      verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT '',
      emergency_phone TEXT NOT NULL DEFAULT '',
      departments_json TEXT NOT NULL DEFAULT '[]',
      facilities_json TEXT NOT NULL DEFAULT '[]',
      branch_code TEXT NOT NULL DEFAULT 'MAIN',
      total_beds_capacity INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_hospitals_status ON hospitals(verification_status);

    CREATE TABLE IF NOT EXISTS hospital_staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      role_title TEXT NOT NULL,
      department TEXT NOT NULL,
      staff_role TEXT NOT NULL CHECK (staff_role IN ('admin', 'nurse', 'coordinator', 'billing', 'doctor', 'technician')),
      shift_schedule TEXT NOT NULL DEFAULT 'Day (08:00 - 16:00)',
      phone TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_hospital_staff_hospital ON hospital_staff(hospital_id);

    -- 4. DOCTORS
    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL,
      license_no TEXT NOT NULL UNIQUE,
      verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
      specialization TEXT NOT NULL,
      qualification TEXT NOT NULL,
      experience_years INTEGER NOT NULL DEFAULT 0,
      consultation_fee REAL NOT NULL DEFAULT 500,
      bio TEXT NOT NULL DEFAULT '',
      available_days_json TEXT NOT NULL DEFAULT '["Mon","Tue","Wed","Thu","Fri"]',
      slot_start_time TEXT NOT NULL DEFAULT '09:00',
      slot_end_time TEXT NOT NULL DEFAULT '17:00',
      is_available_for_video INTEGER NOT NULL DEFAULT 1,
      rating REAL NOT NULL DEFAULT 4.8,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_doctors_spec ON doctors(specialization);
    CREATE INDEX IF NOT EXISTS idx_doctors_hospital ON doctors(hospital_id);
    CREATE INDEX IF NOT EXISTS idx_doctors_status ON doctors(verification_status);

    -- 5. PHARMACIES
    CREATE TABLE IF NOT EXISTS pharmacies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      license_no TEXT NOT NULL UNIQUE,
      verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      operating_hours TEXT NOT NULL DEFAULT '08:00 - 22:00',
      is_24x7 INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 6. APPOINTMENTS
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL,
      appointment_date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'in_person' CHECK (mode IN ('in_person', 'video')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'rescheduled', 'completed', 'cancelled')),
      reason TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);

    -- 7. CONSULTATIONS (VIDDOC & CLINICAL NOTES)
    CREATE TABLE IF NOT EXISTS consultations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
      patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      room_code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended')),
      started_at TEXT,
      ended_at TEXT,
      chief_complaint TEXT NOT NULL DEFAULT '',
      clinical_notes TEXT NOT NULL DEFAULT '',
      vitals_json TEXT NOT NULL DEFAULT '{}',
      follow_up_date TEXT NOT NULL DEFAULT '',
      follow_up_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_consultations_room ON consultations(room_code);

    -- 8. PRESCRIPTIONS
    CREATE TABLE IF NOT EXISTS prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consultation_id INTEGER REFERENCES consultations(id) ON DELETE SET NULL,
      appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
      patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      diagnosis TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      valid_until TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dispensed', 'expired')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
    CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor ON prescriptions(doctor_id);

    CREATE TABLE IF NOT EXISTS prescription_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prescription_id INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
      medicine_name TEXT NOT NULL,
      generic_name TEXT NOT NULL DEFAULT '',
      dosage TEXT NOT NULL,
      frequency TEXT NOT NULL,
      duration_days INTEGER NOT NULL DEFAULT 5,
      instructions TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_rx_items_rx ON prescription_items(prescription_id);

    -- 9. MEDICAL RECORDS
    CREATE TABLE IF NOT EXISTS medical_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      uploaded_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL,
      doctor_id INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
      record_type TEXT NOT NULL CHECK (record_type IN ('lab_report', 'imaging', 'discharge_summary', 'clinical_note', 'vaccination')),
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL DEFAULT '',
      file_mime TEXT NOT NULL DEFAULT '',
      file_size_bytes INTEGER NOT NULL DEFAULT 0,
      file_data_url TEXT NOT NULL DEFAULT '',
      record_date TEXT NOT NULL DEFAULT (date('now')),
      is_confidential INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_records_patient ON medical_records(patient_id);

    -- 10. BEDS
    CREATE TABLE IF NOT EXISTS beds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
      ward_name TEXT NOT NULL,
      bed_number TEXT NOT NULL,
      bed_type TEXT NOT NULL CHECK (bed_type IN ('general', 'private', 'icu', 'emergency')),
      daily_rate REAL NOT NULL DEFAULT 1500,
      status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
      current_patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(hospital_id, bed_number)
    );

    CREATE INDEX IF NOT EXISTS idx_beds_hospital_status ON beds(hospital_id, status);

    -- 11. ADMISSIONS (OPD & INPATIENT)
    CREATE TABLE IF NOT EXISTS admissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
      patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      attending_doctor_id INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
      bed_id INTEGER REFERENCES beds(id) ON DELETE SET NULL,
      admission_type TEXT NOT NULL DEFAULT 'inpatient' CHECK (admission_type IN ('opd', 'inpatient', 'emergency')),
      status TEXT NOT NULL DEFAULT 'admitted' CHECK (status IN ('admitted', 'discharged', 'transferred')),
      diagnosis TEXT NOT NULL DEFAULT '',
      admitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      discharged_at TEXT,
      discharge_summary TEXT NOT NULL DEFAULT '',
      total_billed_amount REAL NOT NULL DEFAULT 0,
      insurance_covered_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_admissions_hospital ON admissions(hospital_id);
    CREATE INDEX IF NOT EXISTS idx_admissions_patient ON admissions(patient_id);

    -- 12. MEDICINES (PHARMACY INVENTORY)
    CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      generic_name TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'General',
      manufacturer TEXT NOT NULL DEFAULT '',
      batch_number TEXT NOT NULL DEFAULT '',
      unit_price REAL NOT NULL DEFAULT 0,
      stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
      reorder_level INTEGER NOT NULL DEFAULT 20,
      expiry_date TEXT NOT NULL,
      requires_prescription INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_medicines_pharmacy ON medicines(pharmacy_id);
    CREATE INDEX IF NOT EXISTS idx_medicines_expiry ON medicines(expiry_date);

    -- 13. MEDICINE ORDERS
    CREATE TABLE IF NOT EXISTS medicine_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
      prescription_id INTEGER REFERENCES prescriptions(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'preparing', 'dispatched', 'delivered', 'cancelled')),
      delivery_address TEXT NOT NULL,
      total_amount REAL NOT NULL DEFAULT 0,
      rejection_reason TEXT NOT NULL DEFAULT '',
      payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_orders_patient ON medicine_orders(patient_id);
    CREATE INDEX IF NOT EXISTS idx_orders_pharmacy ON medicine_orders(pharmacy_id);

    CREATE TABLE IF NOT EXISTS medicine_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES medicine_orders(id) ON DELETE CASCADE,
      medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
      medicine_name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_order_items_order ON medicine_order_items(order_id);

    -- 14. MEDICINE REMINDERS
    CREATE TABLE IF NOT EXISTS medicine_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      medicine_name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      schedule_time TEXT NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'Daily',
      is_active INTEGER NOT NULL DEFAULT 1,
      last_taken_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 15. PAYMENTS & INVOICES
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      reference_type TEXT NOT NULL CHECK (reference_type IN ('appointment', 'admission', 'medicine_order')),
      reference_id INTEGER NOT NULL,
      amount REAL NOT NULL CHECK (amount >= 0),
      currency TEXT NOT NULL DEFAULT 'INR',
      payment_method TEXT NOT NULL DEFAULT 'razorpay_sandbox',
      transaction_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
      invoice_number TEXT NOT NULL UNIQUE,
      breakdown_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments(patient_id);

    -- 16. NOTIFICATIONS
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'system' CHECK (category IN ('appointment', 'prescription', 'order', 'hospital', 'emergency', 'system')),
      is_read INTEGER NOT NULL DEFAULT 0,
      action_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

    -- 17. EMERGENCY & AMBULANCE REQUESTS
    CREATE TABLE IF NOT EXISTS emergency_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
      requester_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL,
      emergency_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'high' CHECK (severity IN ('critical', 'high', 'moderate')),
      pickup_location TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'dispatched', 'en_route', 'arrived', 'admitted', 'resolved')),
      ambulance_unit TEXT NOT NULL DEFAULT '',
      eta_minutes INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_emergency_status ON emergency_requests(status);

    -- 18. FINANCIAL ASSISTANCE PROGRAMS
    CREATE TABLE IF NOT EXISTS financial_assistance_programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      provider TEXT NOT NULL,
      coverage_limit TEXT NOT NULL,
      eligibility_criteria TEXT NOT NULL,
      application_url TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'Government & Public'
    );

    -- 19. HOSPITAL RESOURCES (Equipment, Labs, OTs, Wards, Facilities)
    CREATE TABLE IF NOT EXISTS hospital_resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
      resource_type TEXT NOT NULL CHECK (resource_type IN ('ward', 'room', 'equipment', 'laboratory', 'operation_theatre', 'facility')),
      name TEXT NOT NULL,
      department TEXT NOT NULL DEFAULT 'General',
      location TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'operational' CHECK (status IN ('operational', 'in_use', 'maintenance')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_hospital_resources_hosp ON hospital_resources(hospital_id);
  `);

  // Safe additive migrations for existing SQLite files
  const emgCols = db.prepare('PRAGMA table_info(emergency_requests)').all() as Array<{ name: string }>;
  const colNames = new Set(emgCols.map((c) => c.name));
  if (!colNames.has('assigned_doctor_id')) {
    db.exec('ALTER TABLE emergency_requests ADD COLUMN assigned_doctor_id INTEGER REFERENCES doctors(id) ON DELETE SET NULL');
  }
  if (!colNames.has('department')) {
    db.exec("ALTER TABLE emergency_requests ADD COLUMN department TEXT NOT NULL DEFAULT 'Emergency Medicine'");
  }
  if (!colNames.has('bed_id')) {
    db.exec('ALTER TABLE emergency_requests ADD COLUMN bed_id INTEGER REFERENCES beds(id) ON DELETE SET NULL');
  }
}
