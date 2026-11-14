# CareOne REST API Documentation

All protected routes require `Authorization: Bearer <accessToken>`.

## Authentication (`/api/auth`)
- `POST /api/auth/register` — Register Patient, Doctor, Hospital, or Pharmacy account.
- `POST /api/auth/login` — Authenticate and receive JWT access + refresh tokens.
- `POST /api/auth/refresh` — Rotate refresh token and issue fresh access token.
- `POST /api/auth/logout` — Revoke refresh token.
- `GET /api/auth/me` — Fetch authenticated user and role profile.

## Patient Portal (`/api/patient`, `/api/records`, `/api/orders`, `/api/payments`)
- `GET /api/patient/dashboard` — Patient stats, upcoming appointments, Rx, reminders, orders, admissions.
- `PUT /api/patient/profile` — Update health info, allergies, chronic conditions, insurance.
- `GET|POST /api/patient/reminders`, `PATCH /api/patient/reminders/:id/taken`, `DELETE /api/patient/reminders/:id`
- `GET /api/patient/financial-assistance` — Verified financial aid programs.
- `GET|POST /api/records` — List authorized medical records or upload validated PDF/PNG/JPEG/TXT records.
- `GET|POST /api/orders`, `PATCH /api/orders/:id/cancel` — Medicine order placement and tracking.
- `GET /api/payments`, `POST /api/payments/checkout` — Process payment & generate invoice.

## Doctor Portal (`/api/doctors`, `/api/appointments`, `/api/consultations`, `/api/prescriptions`)
- `GET /api/doctors` — Public verified doctor discovery with specialization, hospital, video, and text filters.
- `GET /api/doctors/dashboard`, `PUT /api/doctors/profile`
- `GET /api/doctors/patients/:patientId/history` — IDOR-protected patient clinical history.
- `GET|POST /api/appointments`, `PATCH /api/appointments/:id/status`, `PATCH /api/appointments/:id/reschedule`, `PATCH /api/appointments/:id/cancel`
- `GET /api/consultations`, `GET /api/consultations/:roomCode`, `PATCH /api/consultations/:id`
- `GET|POST /api/prescriptions` — Issue multi-item digital prescriptions.

## Hospital Portal (`/api/hospitals`, `/api/emergency`)
- `GET /api/hospitals`, `GET /api/hospitals/dashboard`, `PUT /api/hospitals/profile`
- `PATCH /api/hospitals/doctors/:doctorId/verify` — Verify/reject affiliated doctors.
- `POST /api/hospitals/staff` — Manage staff rosters.
- `POST /api/hospitals/beds`, `PATCH /api/hospitals/beds/:bedId`
- `POST /api/hospitals/patients/register` — Duplicate-safe patient registration.
- `POST /api/hospitals/admissions`, `POST /api/hospitals/admissions/:id/discharge`
- `GET|POST /api/emergency`, `PATCH /api/emergency/:id/status`

## Pharmacy Portal (`/api/pharmacies`)
- `GET /api/pharmacies`, `GET /api/pharmacies/catalog`, `GET /api/pharmacies/dashboard`
- `POST /api/pharmacies/medicines`, `PATCH /api/pharmacies/medicines/:id`
- `PATCH /api/pharmacies/orders/:orderId/status` — Verify Rx, deduct stock atomically, progress fulfillment.
