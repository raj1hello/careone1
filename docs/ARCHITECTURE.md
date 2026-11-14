# CareOne System Architecture

## 1. Architectural Overview

CareOne is organized as a modular full-stack web application:

- **Frontend (`/src`)**: React 19 + Vite + Tailwind CSS v4 + React Router + Zustand + Axios.
  - `src/services/api.ts`: Centralized Axios client with JWT bearer injection and automatic refresh-token rotation on `401`.
  - `src/store/authStore.ts`: Global authentication and role context state.
  - `src/components/PortalLayout.tsx`: Responsive Midnight Clinical Observatory shell with live notification polling.
  - `src/components/VidDocRoom.tsx`: WebRTC peer connection paired with `/ws/signaling` WebSocket server.
  - `src/pages/*`: Landing page, Auth portal, and dedicated role dashboards (`PatientPortal`, `DoctorPortal`, `HospitalPortal`, `PharmacyPortal`).
- **Backend (`/server` & `/server.ts`)**: Express + TypeScript + `better-sqlite3` + `ws` WebSocket signaling.
  - `server/config/env.ts`: Environment variable loader.
  - `server/db/database.ts`, `schema.ts`, `seed.ts`: Normalized relational SQL engine with foreign keys, constraints, indexes, and transactional seeding.
  - `server/middleware/auth.ts`: JWT verification, RBAC guards, IDOR relationship checks, rate limiters, and audit logger.
  - `server/routes/*`: 14 domain-separated REST routers.

## 2. Cross-Portal Data Flows

1. **Outpatient & VidDoc Pipeline**: Patient searches verified doctors -> Books slot -> Doctor accepts (auto-creates `consultations` room code) -> WebRTC consultation & vitals capture -> Doctor issues digital prescription -> Patient orders medicines -> Pharmacy verifies Rx and atomically decrements stock -> Patient completes checkout.
2. **Hospital Inpatient & Emergency Pipeline**: Patient triggers emergency request or arrives at hospital registration -> Hospital dispatches ambulance unit/ETA -> Hospital registers patient (duplicate-safe) -> Hospital allocates available General/Private/ICU bed -> Discharge releases bed, auto-publishes discharge summary to `medical_records`, and generates billing invoice.
