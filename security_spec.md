# CareOne Firestore Security Specification

## 1. Core Data Invariants
1. **Verified Identity Mandate**: Every create/update/delete operation requires an authenticated user with `request.auth.token.email_verified == true`.
2. **Role & Profile Isolation**:
   - `/users/{userId}` holds private account identity and email/phone PII; only the owner (or verified admin) can read or write it, and `role` cannot be escalated or changed after creation.
   - `/patients/{patientId}` holds clinical profile PII (`mrn`, `dob`, `allergies`, `chronicConditions`); strictly owner-only read/write.
   - `/doctors/{doctorId}` contains professional directory fields without personal email/phone PII. Newly registered doctors MUST have `verificationStatus == 'pending'`. Unverified doctors are hidden from public/patient discovery (`verificationStatus == 'verified'` required for non-owner, non-affiliating-hospital reads).
3. **Appointment Integrity**:
   - Only the patient (`patientUid == request.auth.uid`) can create an appointment, initial `status` MUST be `'pending'`, and the referenced doctor MUST already exist and have `verificationStatus == 'verified'`.
   - Terminal appointment states (`completed`, `cancelled`, `rejected`) are permanently locked against client mutations.
4. **Private VidDoc Consultations**:
   - Only the assigned `patientUid`, `doctorUid`, or affiliated `hospitalId` can read a consultation.
   - Only `doctorUid` can edit `clinicalNotes`, `vitals`, `aiSummary`, `summaryApprovedByDoctor`, `followUpDate`, or mark the consultation `ended`.
   - `patientUid` can only toggle live room presence (`patientPresent`) and `recordingConsent`.
5. **Doctor-Authorized Prescriptions & Day-Wise Medicine Courses**:
   - Only the prescribing doctor (`doctorUid == request.auth.uid`) can create or finalize a prescription, and once `status == 'authorized'` it is immutable.
   - Medicine courses (`/medicine_courses/{courseId}`) MUST reference an existing/batched prescription via `existsAfter` and are created atomically with their `/doses/{doseId}` subcollection secured by a Parent Master Gate (`getAfter` on create, `get` on read/update).
   - Patients can ONLY update dose `status` (`taken`, `skipped`, `pending`) on their own courses.
6. **Zero-Trust Medical Records**:
   - Medical records are readable only by `patientUid` or doctors explicitly listed in `sharedWithDoctorUids` (bounded array `<= 25`).
7. **Server Timestamps & Bounded Payloads**:
   - Every `create` requires `createdAt == request.time && updatedAt == request.time`; every `update` requires `updatedAt == request.time` and immutable `createdAt`.
   - Every string field has strict `.size()` bounds and every document path uses `isValidId()` matching `^[a-zA-Z0-9_\-]+$`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unverified Doctor Self-Verification (Create)**: Doctor registers with `verificationStatus: 'verified'` instead of `'pending'`. -> `PERMISSION_DENIED`.
2. **Unverified Doctor Booking**: Patient attempts to create an `/appointments/{id}` targeting a doctor whose `verificationStatus == 'pending'`. -> `PERMISSION_DENIED`.
3. **Cross-Patient Medical Record Scrape**: Random signed-in Doctor attempts `list` or `get` on `/medical_records` where their UID is not in `sharedWithDoctorUids`. -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on User Profile**: User tries updating `/users/{uid}` with an extra ghost key `{ isAdmin: true, fullName: 'X', updatedAt: serverTimestamp() }`. -> `PERMISSION_DENIED`.
5. **Client Timestamp Forgery**: Client submits `createdAt: new Date('2020-01-01')` instead of `serverTimestamp()` on appointment creation. -> `PERMISSION_DENIED`.
6. **Patient Modifying Doctor Clinical Notes / AI Summary**: Patient in a VidDoc room attempts `update` on `/consultations/{id}` changing `clinicalNotes` or `summaryApprovedByDoctor`. -> `PERMISSION_DENIED`.
7. **Mutating Authorized Prescription**: Doctor or Patient attempts to alter `items` or `diagnosis` on a prescription where `status == 'authorized'`. -> `PERMISSION_DENIED`.
8. **Patient Self-Prescribing**: Patient creates a document in `/prescriptions` with `doctorUid` set to a doctor's UID while authenticated as the patient. -> `PERMISSION_DENIED`.
9. **Orphaned Medicine Course Dose**: Attacker tries to create `/medicine_courses/fake_course/doses/d1` without a valid parent `medicine_courses/fake_course` document. -> `PERMISSION_DENIED`.
10. **PII Blanket Read on `/patients`**: Authenticated non-owner user attempts `get` on `/patients/{otherPatientUid}`. -> `PERMISSION_DENIED`.
11. **1MB String Exhaustion Attack**: User submits a 10,000-character string in `reason` (limit 600) or oversized `appointmentId` > 128 chars. -> `PERMISSION_DENIED`.
12. **Email Spoofing Without Verification**: Unverified auth token (`email_verified: false`) matching admin email attempts privileged update on `/doctors/{id}`. -> `PERMISSION_DENIED`.
