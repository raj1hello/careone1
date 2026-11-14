# CareOne Database Design

## Normalized Entity-Relationship Diagram

```
users (1) ──┬── (0..1) patients ──┬── (*) appointments
            │                     ├── (*) consultations
            │                     ├── (*) prescriptions ──< (*) prescription_items
            │                     ├── (*) medical_records
            │                     ├── (*) admissions >── (0..1) beds
            │                     ├── (*) medicine_orders ──< (*) medicine_order_items >── medicines
            │                     ├── (*) medicine_reminders
            │                     ├── (*) payments
            │                     └── (*) emergency_requests
            ├── (0..1) doctors >── (0..1) hospitals
            ├── (0..1) hospitals ──< (*) hospital_staff
            └── (0..1) pharmacies ──< (*) medicines
```

## Key Relational Constraints & Indexes

- **Referential Integrity**: `PRAGMA foreign_keys = ON` enforced on all connections.
- **Unique Constraints**: `users(email)`, `patients(mrn)`, `doctors(license_no)`, `hospitals(registration_no)`, `pharmacies(license_no)`, `beds(hospital_id, bed_number)`, `consultations(room_code)`, `payments(transaction_id, invoice_number)`.
- **Check Constraints**: Role enums, verification statuses, bed statuses, non-negative medicine stock (`stock_quantity >= 0`), and order item quantities (`quantity > 0`).
- **Transactional Atomicity**:
  - Hospital admission + bed allocation runs inside a single SQLite transaction.
  - Hospital discharge + bed release + medical record publication + invoice generation runs atomically.
  - Pharmacy order verification + stock deduction validates and decrements inventory atomically.
