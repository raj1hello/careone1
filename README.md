# CareOne — Integrated Healthcare Management Platform

**Tagline:** One Platform. Connected Healthcare. Better Care.

CareOne connects four major healthcare stakeholders — **Patients**, **Doctors**, **Hospitals**, and **Pharmacies** — through one unified, relational clinical platform.

## Runtime Architecture Note

In the active Node.js/TypeScript runtime (`port 3000`), CareOne executes a unified **Express + TypeScript + SQLite (`better-sqlite3`) + WebSocket signaling** backend serving the **React 19 + Vite + Tailwind CSS v4 + Axios + Zustand** frontend.

## Seeded Clinical Demo Accounts

All seeded accounts use password: `CareOne@2026`

- **Patient:** `patient@careone.health` (Aarav Sharma, `MRN-2026-1042`)
- **Doctor:** `doctor@careone.health` (Dr. Elena Vance, Cardiology — Verified)
- **Hospital:** `hospital@careone.health` (Apex Central Clinical Hospital — Verified)
- **Pharmacy:** `pharmacy@careone.health` (CareOne Central Apothecary — Verified)
- **Admin:** `admin@careone.health`

## Scripts

- `npm run dev` — Starts full-stack Express + Vite + WebRTC signaling server on port 3000
- `npm run test:backend` — Runs automated backend API, RBAC, IDOR, and cross-portal workflow tests
- `npm run build` — Produces production Vite frontend bundle
- `npm run lint` — Runs TypeScript type-checking (`tsc --noEmit`)

## Documentation

- [System Architecture](docs/ARCHITECTURE.md)
- [Database Design & ER Diagram](docs/DATABASE_DESIGN.md)
- [API Documentation](docs/API_DOCUMENTATION.md)
- [Security & Access Control](docs/SECURITY.md)
- [Development Progress](docs/DEVELOPMENT_PROGRESS.md)
- [Known Limitations & Pending External Integrations](docs/KNOWN_LIMITATIONS.md)
