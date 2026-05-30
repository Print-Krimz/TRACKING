# 🏢 RBAC Resume Applicant Tracking & Recruitment System (ATS)

An enterprise-grade, highly interactive **Applicant Tracking System (ATS)** and **Recruitment Management Platform** designed to streamline talent acquisition, screen resumes securely, eliminate hiring bias, manage client-side manpower deployments, and automate administrative overhead.

Built with a high-performance **FastAPI** backend, a responsive **React 18 & Vite** frontend, and powered by **Google Gemini AI**, the platform offers a robust Role-Based Access Control (RBAC) security paradigm, strict GDPR compliance via automated client/server PII scrubbing, and real-time background scheduling.

---

## 🚀 Key System Features

### 1. 🔐 Role-Based Access Control (RBAC)
The system enforces strict permission-level restrictions across 5 distinct roles:
*   **Candidate / Applicant**: Upload resumes, manage personal digital "201 file" documents, view open jobs, apply to positions, track application pipelines, and communicate with recruiters.
*   **Interviewer**: View assigned candidates, review scheduled interview calendars, and record detailed interview feedback.
*   **Recruiter**: Full access to the job lifecycle (create, edit, publish), candidate match rankings, talent pool rescans, scheduled reports, and manpower placements.
*   **Admin & Control Panel Admin**: Complete system access including user lifecycle management (archive, restore, delete), role adjustments, and complete audit logging of system-wide changes.

### 2. 🧠 Google Gemini AI Matching & Resume Parsing
*   **Automatic Parsing**: Real-time structured skill extraction and experience-years deduction on resume uploads (`PDF` & `DOCX`).
*   **Resume Screening & Feedback**: Leverages `gemini-flash-latest` to evaluate resumes against custom job specifications, assigning a 1–10 match score and returning a structured JSON breakdown of specific **Strengths**, **Weaknesses**, and **Actionable Recommendations**.
*   **Smart Quiz Generation & Scoring**: Generates technical qualifying quizzes automatically based on mandatory job criteria and logs full result breakdowns.

### 3. 🛡️ GDPR Compliance & Bias-Free Screening
*   **PII Anonymization Service**: High-fidelity personal identity scrubbers (`anonymization_service.py` on backend, `anonymize.js` on frontend) run *before* the resume is sent to LLMs or made available for general screening.
*   **Pseudonym Generation**: Replaces names, emails, phones, and links with temporary aesthetic identifiers (e.g., `Anonymized Candidate #1034`) to support unbiased, credential-focused screening.

### 4. 💼 Manpower Deployment & ERP Integration
*   **Placement Tracking**: Links successful candidates directly with registered corporate clients (`Clients` table) for contractual placement.
*   **Contract End Alerts**: Tracks deployment timelines, active statuses, and end dates.
*   **Daily Alert Scheduler**: Features an automated, non-blocking background job running daily at `00:15 UTC` to notify recruiters and auto-terminate expired placements.

### 5. 📊 Automated Scheduled Reports
*   **Dynamic Document Generation**: Compiles application pipelines, interview status summaries, and deployment metrics.
*   **Flexible Exports**: Generates premium formats: **Excel worksheets (`.xlsx`)** via `openpyxl` and **PDF dossiers** via `reportlab`.
*   **Delivery Cadence**: Configurable delivery options (daily, weekly, monthly, or on-demand) with email notifications.

---

## 🛠️ Technology Stack & Dependencies

### Backend (Python 3.10+)
*   **Web Framework**: `FastAPI` (Asynchronous ASGI server via `Uvicorn`)
*   **ORM Layer**: `SQLModel` (Combines the strengths of `SQLAlchemy` and `Pydantic` for unified schema definition and verification)
*   **Database Client**: `psycopg2-binary` (PostgreSQL driver)
*   **AI Integration**: `google-generativeai` (Google Gemini SDK)
*   **File Parsing**: `PyPDF2` & `python-docx`
*   **Security & Hashing**: `python-jose` (JWT signatures) & `passlib` with `bcrypt` (password encryption)
*   **Reporting Tools**: `openpyxl` (Excel generation) & `reportlab` (PDF generation)

### Frontend (React 18 & Vite)
*   **Development Server**: `Vite` (Ultra-fast HMR bundler)
*   **Navigation & State**: `React Router DOM v6` (Role-based private routes)
*   **HTTP Client**: `Axios`
*   **Visual Assets & Icons**: `Lucide React`
*   **Data Visualization**: `Recharts` (Dashboard charts and metrics tracking)

---

## 📁 System Architecture & Directory Structure

```text
APPLICANT/
├── SYSTEM_ERD.md            # Database Entity Relationship Diagram (Mermaid)
├── SYSTEM_ERD_VISUAL.html   # Interactive visual interface for database schema
├── backend/
│   ├── main.py              # FastAPI Application entrypoint & Lifecycle Schedulers
│   ├── database.py          # PostgreSQL connections, Session, & DB Schema Migrator
│   ├── dependencies.py      # Auth handlers, Token verifiers, and CORS configurations
│   ├── models/              # SQLModel schema classes (User, Job, Document, etc.)
│   ├── routes/              # Route controllers (Auth, Jobs, Matching, Deployments, Admin)
│   ├── schemas/             # Pydantic validation models
│   ├── services/            # Core business logic services
│   │   ├── anonymization_service.py  # GDPR PII Scrubbing and Candidate Anonymizer
│   │   ├── gemini_service.py         # Google Gemini Pro/Flash SDK configurations
│   │   ├── matching_service.py       # Candidate job-fit criteria calculations
│   │   └── deployment_contract_alert_service.py  # Placements & alert triggers
│   └── tests/               # Backend testing suites
└── frontend/
    ├── src/
    │   ├── main.jsx         # React application shell mounting point
    │   ├── App.jsx          # Route declarations & Role-based authentication rules
    │   ├── components/      # Reusable components (ResumeDrawer, Upload, Primitives)
    │   ├── context/         # AuthContext handling JWT states and permissions
    │   ├── pages/           # Page modules (RecruiterDashboard, AdminPanel, Reports)
    │   └── utils/           # Frontend GDPR/anonymize tools & testing units
```

---

## ⚙️ Local Development Setup

### 📦 1. Backend Configuration

1. **Navigate to the Backend Directory**:
    ```bash
    cd backend
    ```

2. **Establish a Python Virtual Environment**:
    ```bash
    python -m venv venv
    venv\Scripts\activate      # On Windows
    source venv/bin/activate   # On macOS/Linux
    ```

3. **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

4. **Setup Environment Variables**:
    Create a `.env` file based on `.env.example`:
    ```ini
    DATABASE_URL=postgresql://postgres:password@localhost:5432/resume_db
    SECRET_KEY=your_generated_cryptographic_secret_key
    GEMINI_API_KEY=AIzaSy...your-actual-gemini-key
    ACCESS_TOKEN_EXPIRE_MINUTES=30
    ```

5. **Run the Development Server**:
    ```bash
    uvicorn main:app --reload
    ```
    *   The server will start at `http://localhost:8000`.
    *   Access the **Interactive API Swagger Docs** at `http://localhost:8000/docs`.

> [!NOTE]
> On startup, the application's ASGI lifecycle manager automatically runs database schema upgrades, seeds roles/permissions, and migrates legacy data (e.g. converting draft jobs to open status). No manual migration commands are required!

---

### 🎨 2. Frontend Configuration

1. **Navigate to the Frontend Directory**:
    ```bash
    cd frontend
    ```

2. **Install Packages**:
    ```bash
    npm install
    ```

3. **Start the Vite Web Server**:
    ```bash
    npm run dev
    ```
    *   The application will run locally at `http://localhost:5173`.
    *   It contains theme controls, defaulting to a dark mode.

---

## ⚙️ Advanced ASGI Lifespan Schedulers

Inside `backend/main.py`, the system establishes three background task loops to manage operations seamlessly:

| Scheduler | Frequency | Target |
|---|---|---|
| **Contract Alert Scheduler** | Daily at `00:15 UTC` | Inspects active deployments, writes alerts for contracts expiring in 30/15/7/1 days, and marks expired deployments as `COMPLETED`. |
| **Automation Job Scheduler** | Every `30 seconds` | Drains the `automation_job` queue, retries failed automations, and logs execution latency. |
| **Report Schedule Scheduler** | Every `60 seconds` | Scans `report_schedule`, matches the cadence (daily, weekly, monthly), compiles Excel/PDF outputs, and flags notifications. |

---

## 🛡️ GDPR PII Scrubbing System in Detail

Candidate data is anonymized using specific regex boundaries and contextual replacements:
1. **Name Redaction**: Replaces Candidate names with matching pseudonyms.
2. **Contact Filtering**: Clears out telephone formats, physical locations, and email signatures.
3. **Link Redaction**: Masks personal LinkedIn URLs, portfolios, and Github references.

*Example Scrubbing Flow:*
```text
Original: "Jane Doe, Software Engineer based in Berlin - email: jane.doe@web.com, phone: +49 123456"
Anonymized: "[CANDIDATE_NAME], Software Engineer based in [LOCATION] - email: [EMAIL], phone: [PHONE]"
```
This ensures complete protection of private records while retaining raw qualification metadata for AI matching.

---

## 📊 Database Schema (ERD)

The relational schema is meticulously managed. You can review:
*   [SYSTEM_ERD.md](file:///c:/Users/cnico/OneDrive/Desktop/APPLICANT/SYSTEM_ERD.md): Contains the complete diagram details utilizing Mermaid syntax.
*   [SYSTEM_ERD_VISUAL.html](file:///c:/Users/cnico/OneDrive/Desktop/APPLICANT/SYSTEM_ERD_VISUAL.html): A visual dashboard to inspect tables, relations, fields, and constraints.
