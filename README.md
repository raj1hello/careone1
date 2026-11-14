# CareOne --- Integrated Healthcare Management Platform

**One Platform. Connected Healthcare. Better Care.**

CareOne is an integrated healthcare management and patient assistance
platform designed to connect patients, doctors, hospitals, and
pharmacies through one centralized digital ecosystem.

The platform provides dedicated role-based portals and workflows for
managing appointments, consultations, prescriptions, medicines, hospital
operations, and related healthcare services.

> **Project status:** Local development and integration testing. Some
> capabilities, including production-grade live video consultations and
> real ambulance-provider tracking, require additional external
> integrations and verification.

------------------------------------------------------------------------

## Table of Contents

-   [Overview](#overview)
-   [Problem Statement](#problem-statement)
-   [Objectives](#objectives)
-   [Core Portals](#core-portals)
    -   [Patient Portal](#1-patient-portal)
    -   [Doctor Portal](#2-doctor-portal)
    -   [Hospital Portal](#3-hospital-portal)
    -   [Pharmacy Portal](#4-pharmacy-portal)
-   [How CareOne Works](#how-careone-works)
-   [Technology Stack](#technology-stack)
-   [Architecture](#architecture)
-   [Security and Access Control](#security-and-access-control)
-   [Project Structure](#project-structure)
-   [Local Setup](#local-setup)
-   [Environment Configuration](#environment-configuration)
-   [Running the Application](#running-the-application)
-   [Testing and Verification](#testing-and-verification)
-   [Current Limitations](#current-limitations)
-   [Future Scope](#future-scope)
-   [Contributing](#contributing)
-   [Disclaimer](#disclaimer)

------------------------------------------------------------------------

## Overview

Healthcare services are often spread across disconnected systems.
Patients may need separate platforms for finding doctors, booking
appointments, accessing prescriptions, ordering medicines, and managing
medical information. Healthcare providers also face operational
challenges when appointments, patient records, admissions, inventory,
and billing are managed through separate workflows.

CareOne aims to reduce this fragmentation by bringing essential
healthcare workflows into one platform.

The application has four distinct portals:

  -----------------------------------------------------------------------
  Portal                              Primary purpose
  ----------------------------------- -----------------------------------
  Patient                             Access healthcare services and
                                      manage personal healthcare activity

  Doctor                              Manage appointments, authorized
                                      patient information, consultations,
                                      and prescriptions

  Hospital                            Manage patient registration,
                                      admissions, beds, departments, and
                                      billing workflows

  Pharmacy                            Manage medicine inventory,
                                      prescriptions, and medicine orders
  -----------------------------------------------------------------------

Each role receives a dedicated dashboard and access to the functions
relevant to that role.

## Problem Statement

Disconnected healthcare workflows can create communication gaps,
administrative overhead, and inconvenience for patients and service
providers. CareOne addresses this problem by providing a shared digital
platform with role-specific workflows and controlled access to
information.

## Objectives

-   Bring patients and healthcare service providers into one digital
    ecosystem.
-   Make doctor discovery and appointment workflows easier to manage.
-   Support appointment-based online consultation workflows.
-   Organize digital prescriptions and medicine-order workflows.
-   Provide hospital administration features for admissions and bed
    management.
-   Support pharmacy inventory and order processing.
-   Apply authentication and role-based access controls.
-   Build a modular foundation that can be extended with additional
    healthcare integrations.

------------------------------------------------------------------------

## Core Portals

### 1. Patient Portal

The Patient Portal provides a personalized interface for accessing and
managing healthcare services.

Key areas include:

-   **Health Overview:** View available appointment, prescription,
    reminder, order, and payment information.
-   **Find Doctors:** Discover doctors through the available doctor
    listing.
-   **Appointments:** Request and manage appointments.
-   **VidDoc:** Access appointment-based consultation room workflows.
-   **Emergency Assistance:** Submit emergency assistance requests and
    share browser geolocation when permission is granted.
-   **Prescriptions:** Access prescriptions issued by authorized
    doctors.
-   **Medicine Orders:** Place and view medicine orders through
    connected pharmacy workflows.
-   **Medical Records:** Access available patient medical information.
-   **Medicine Reminders:** Create and manage medication reminders.
-   **Payments:** Access supported payment-related workflows.
-   **Financial Assistance:** Access the financial assistance section.
-   **Notifications and Profile:** View relevant notifications and
    manage account information.

### 2. Doctor Portal

The Doctor Portal supports doctors with consultation and patient-care
workflows.

Key areas include:

-   Appointment and consultation request management.
-   Access to authorized patient information.
-   Appointment-based VidDoc room access.
-   Digital prescription creation.
-   Follow-up management.
-   Notifications and professional profile management.

### 3. Hospital Portal

The Hospital Portal provides administrative workflows for hospital
operations.

Key areas include:

-   Patient registration.
-   Patient admissions and discharges.
-   Bed management and availability.
-   Department management.
-   Doctor and staff information.
-   Billing workflows.
-   Insurance-related information.
-   Operational statistics and analytics.

### 4. Pharmacy Portal

The Pharmacy Portal supports medicine and order management.

Key areas include:

-   Medicine catalog and inventory management.
-   Stock quantity monitoring.
-   Low-stock visibility.
-   Prescription verification workflows.
-   Medicine order processing.
-   Order fulfillment status management.
-   Pharmacy profile and notifications.

------------------------------------------------------------------------

## How CareOne Works

A typical connected workflow may look like this:

1.  A patient creates an account and signs in.
2.  The patient discovers a doctor and requests an appointment.
3.  The doctor reviews and manages the appointment request.
4.  The consultation takes place through the supported consultation
    workflow.
5.  The doctor issues a digital prescription.
6.  The patient accesses the prescription from the Patient Portal.
7.  The patient can place a medicine order through the pharmacy
    workflow.
8.  The pharmacy processes the order and updates its status.
9.  Relevant updates are made available through the platform.

The exact steps available depend on the implemented module and its
integrations.

------------------------------------------------------------------------

## Technology Stack

The project uses the following technologies, based on the current
development setup.

### Frontend

-   **React** --- Component-based user interface.
-   **Vite** --- Frontend development server and build tooling.
-   **Tailwind CSS v4** --- Utility-first styling and design system.
-   **Axios** --- HTTP communication with backend APIs.
-   **Zustand** --- Client-side state management where used.
-   **React Router** --- Client-side routing where configured.

### Backend

-   **Python** --- Backend programming language.
-   **Django** --- Backend web framework.
-   **Django REST Framework** --- REST API development.
-   **JWT authentication** --- Token-based authentication.

### Database

-   **SQLite** --- Current local development database.
-   **PostgreSQL** --- Intended database option for a future deployment
    environment; compatibility should be verified by running migrations
    and tests against an actual PostgreSQL instance.

### Integrations and Supporting Technologies

-   **Razorpay** --- Payment workflow integration.
-   **Browser Geolocation API** --- Permission-based location capture
    for emergency requests.
-   **WebRTC** --- Intended technology for real-time audio/video
    consultation media.
-   **STUN/TURN infrastructure** --- Required for reliable real-world
    WebRTC connectivity across networks.
-   **Redis and Celery** --- Planned supporting infrastructure for
    asynchronous jobs where required.

------------------------------------------------------------------------

## Architecture

CareOne follows a modular full-stack architecture.

``` text
                         CAREONE
                            |
             +--------------+--------------+
             |                             |
        React Frontend                 User Roles
             |                  Patient / Doctor /
        React Router             Hospital / Pharmacy
             |
        Axios API Client
             |
       Django REST APIs
             |
     Authentication & RBAC
             |
       Django Application
             |
          Django ORM
             |
       SQLite Database
             |
    Future PostgreSQL Setup

External integrations:
- Razorpay payment services
- Browser Geolocation API
- WebRTC media infrastructure (pending full integration)
- Notification providers (as configured)
```

The frontend is responsible for presentation, navigation, forms, and API
communication. The Django backend handles business logic,
authentication, authorization, validation, and data access. The database
stores application records through Django ORM models.

------------------------------------------------------------------------

## Security and Access Control

CareOne is designed with role-based access and protected API workflows.

Security measures reported in the project include:

-   JWT-based authentication.
-   Authenticated API endpoints.
-   Role-specific access controls.
-   User-scoped querysets for applicable resources.
-   Backend validation of incoming data.
-   Database relationships and integrity constraints.
-   Razorpay HMAC SHA256 payment signature verification.
-   Browser permission-based geolocation.
-   File upload size and format validation.

Security testing and hardening are ongoing. A successful local test
suite does not replace independent security assessment or
production-readiness testing.

**Important:** Never commit passwords, JWT tokens, payment secrets,
database credentials, or private environment files to version control.

------------------------------------------------------------------------

## Project Structure

The high-level project structure is expected to resemble the following.
The exact filenames and module layout may differ in the working
repository.

``` text
CareOne/
├── backend/
│   ├── manage.py
│   ├── careone_project/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── ...
│   ├── accounts/
│   ├── patients/
│   ├── doctors/
│   ├── hospitals/
│   ├── pharmacies/
│   ├── core/
│   └── requirements.txt
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── dashboards/
│       ├── services/
│       ├── store/
│       ├── routes/
│       ├── index.css
│       └── main.jsx
│
├── docs/
│   ├── LOCAL_COMPLETION_REPORT.md
│   ├── LIVE_END_TO_END_TEST_REPORT.md
│   ├── FINAL_SECURITY_AUDIT.md
│   ├── EVIDENCE_BASED_FINAL_VERIFICATION.md
│   ├── FRONTEND_UI_IMPLEMENTATION_REPORT.md
│   └── FRONTEND_VISUAL_FIX_REPORT.md
│
└── README.md
```

------------------------------------------------------------------------

## Local Setup

### Prerequisites

Install the following before running the project:

-   Python (a version supported by the project's installed Django
    dependencies).
-   Node.js and npm.
-   Git (optional, for version control).
-   A code editor such as Visual Studio Code.

### 1. Clone the repository

If the project is hosted in a Git repository:

``` bash
git clone <YOUR_REPOSITORY_URL>
cd CareOne
```

If you already have the project folder, open that folder in your
terminal or editor.

### 2. Backend setup

Open a terminal:

``` powershell
cd backend
```

Create a virtual environment if one does not already exist:

``` powershell
python -m venv venv
```

Activate it on Windows PowerShell:

``` powershell
.\venv\Scripts\Activate.ps1
```

Install dependencies:

``` powershell
pip install -r requirements.txt
```

Configure the backend environment variables as required by the project.

Apply database migrations:

``` powershell
python manage.py migrate
```

Optionally create a Django admin user:

``` powershell
python manage.py createsuperuser
```

### 3. Frontend setup

Open a second terminal:

``` powershell
cd frontend
```

Install dependencies:

``` powershell
npm install
```

------------------------------------------------------------------------

## Environment Configuration

Use the project's existing environment-variable names and settings. Do
not assume that example names below match every current implementation.

A typical backend `.env` configuration may contain:

``` env
DJANGO_SECRET_KEY=replace_with_a_secure_secret
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost

# Configure only if supported by the current settings:
DATABASE_URL=sqlite:///db.sqlite3

# Payment credentials must remain server-side:
RAZORPAY_KEY_ID=your_test_key_id
RAZORPAY_KEY_SECRET=your_test_key_secret
```

A typical frontend environment file may contain:

``` env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Check the actual backend settings and frontend API client before adding
or renaming variables.

**Never place private payment secrets or Django secret keys in frontend
variables.** Variables prefixed with `VITE_` are exposed to the browser
bundle.

Keep `.env` files out of Git. Use an `.env.example` file containing
placeholder values if you need to document required configuration.

------------------------------------------------------------------------

## Running the Application

Run the backend and frontend in two separate terminals.

### Terminal 1 --- Django Backend

``` powershell
cd backend
.\venv\Scripts\Activate.ps1
python manage.py runserver
```

Backend development server:

-   http://127.0.0.1:8000/

Django Admin:

-   http://127.0.0.1:8000/admin/

### Terminal 2 --- React Frontend

``` powershell
cd frontend
npm run dev
```

Frontend development server:

-   http://localhost:5173/

Keep both terminals running while using the local application.

The root backend URL may return a 404 if no homepage route is
configured. This does not necessarily mean that the backend server is
unavailable. Use the API routes defined in the Django URL configuration.

------------------------------------------------------------------------

## Testing and Verification

Run the frontend production build:

``` powershell
cd frontend
npm run build
```

Run Django tests:

``` powershell
cd backend
.\venv\Scripts\Activate.ps1
python manage.py test
```

Recommended manual checks:

-   Register and sign in with each of the four roles.
-   Confirm that each role reaches its correct dashboard.
-   Test every sidebar navigation item.
-   Verify protected routes and role restrictions.
-   Check appointment and prescription workflows.
-   Test medicine ordering and pharmacy fulfillment.
-   Test emergency location permission and denial states.
-   Verify payment signature handling in the configured test
    environment.
-   Check responsive layouts on desktop, tablet, and mobile.
-   Inspect browser and backend logs for errors.

Previously shared project reports describe successful local backend
tests and frontend builds. Always run the commands against the current
codebase and use their latest output as the source of truth.

------------------------------------------------------------------------

## Current Limitations

CareOne is under active development. The following limitations must be
considered before production use:

1.  **VidDoc:** Appointment-based room authorization has been reported.
    Complete multi-user WebRTC media streaming, signaling, and
    production STUN/TURN configuration still require implementation and
    testing.
2.  **Emergency services:** Browser geolocation can provide coordinates
    with user permission. Real ambulance dispatch and live
    provider-based tracking require an external service integration.
3.  **File security:** Basic file size and format validation have been
    reported. Production-grade content inspection, malware scanning,
    private storage, and access controls require further hardening.
4.  **PostgreSQL:** The application has a PostgreSQL-oriented
    configuration, but actual PostgreSQL migrations and integration
    tests must be performed before claiming verified compatibility.
5.  **Notifications:** External SMS, email, and push notification
    providers require appropriate service configuration and credentials.
6.  **Production security:** Independent penetration testing, deployment
    hardening, monitoring, backups, and privacy/compliance reviews
    remain necessary.

Do not use the local development server as a production deployment
server.

------------------------------------------------------------------------

## Future Scope

Potential future improvements include:

-   Fully integrated real-time video consultations.
-   Verified ambulance dispatch and live GPS tracking.
-   Diagnostic laboratory and test-report integrations.
-   Secure electronic health record interoperability.
-   AI-assisted healthcare navigation and administrative assistance.
-   Secure cloud document storage.
-   SMS, email, and push notification services.
-   Production PostgreSQL deployment.
-   Advanced hospital and pharmacy analytics.
-   Insurance provider integrations.
-   Multilingual and accessibility enhancements.

These are planned opportunities and should not be represented as
currently implemented unless verified in the application.

------------------------------------------------------------------------

## Contributing

Contributions and improvements are welcome.

Suggested workflow:

1.  Review the existing architecture and documentation.
2.  Create a separate branch for your changes.
3.  Keep frontend and backend responsibilities clearly separated.
4.  Preserve authentication and role-based access controls.
5.  Add or update tests for changed functionality.
6.  Run backend tests and the frontend build.
7.  Document new environment variables and integrations.
8.  Submit changes for review.

Never commit credentials, tokens, patient information, or other
sensitive data.

------------------------------------------------------------------------

## Disclaimer

CareOne is a software development project intended to demonstrate
integrated healthcare management workflows. It is not a substitute for
professional medical advice, diagnosis, treatment, emergency services,
or a verified clinical information system.

Emergency requests submitted through the application should not be
assumed to have reached an ambulance provider unless a real provider
integration confirms dispatch. Likewise, consultation room authorization
should not be confused with a completed live video consultation.

Healthcare data, payment processing, privacy, security, and regulatory
requirements must be independently assessed before real-world
deployment.

------------------------------------------------------------------------

## Project Vision

CareOne aims to make healthcare more connected by bringing patients,
doctors, hospitals, and pharmacies into one coordinated digital
ecosystem.

**One Platform. Connected Healthcare. Better Care.**
