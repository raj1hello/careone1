# CareOne Security Architecture

1. **Authentication & Token Lifecycle**:
   - Passwords hashed with `bcryptjs` (cost factor 10).
   - Short-lived JWT access tokens (`30m`) + rotated refresh tokens (`7d`) stored as SHA-256 hashes in `refresh_tokens`.
2. **Role-Based Access Control (RBAC)**:
   - `requireAuth` and `requireRole(...)` middleware protect every role-specific route.
3. **IDOR Prevention**:
   - Patients can only read/write resources matching their own `patient_id`.
   - Doctors accessing `/api/doctors/patients/:patientId/history` or issuing prescriptions pass `doctorHasPatientAccess(doctorId, patientId)` verifying an active appointment or hospital admission relationship.
   - Unauthorized attempts are logged to `audit_logs` and return HTTP `403`.
4. **Input & File Upload Validation**:
   - All request bodies validated via `zod` schemas.
   - Medical record uploads enforce MIME allowlist (`application/pdf`, `image/png`, `image/jpeg`, `text/plain`) and a 5 MB payload cap.
5. **Rate Limiting & Audit Logging**:
   - `express-rate-limit` on `/api/auth/*` and `/api/*`.
   - Security-sensitive operations write entries to `audit_logs`.
