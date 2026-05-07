# System Diagrams - RBAC Resume Application

Reference basis: `backend/main.py`, `backend/routes/resume_routes.py`, `backend/models/controllers/resume_controller.py`, `backend/routes/application_routes.py`, `backend/models/application.py`, `frontend/src/pages/RecruiterDashboard.jsx`.

---

## 1) Process Visualization - End-to-End Application Processing (Non-Flowchart)

```mermaid
stateDiagram-v2
    [*] --> Login
    Login --> Authenticated: valid credentials
    Login --> AccessDenied: invalid credentials
    AccessDenied --> [*]

    Authenticated --> ApplicantLane: role = Applicant
    Authenticated --> RecruiterLane: role = Recruiter
    Authenticated --> AdminLane: role = Admin

    state ApplicantLane {
      [*] --> SubmitResume
      SubmitResume --> ResumeValidated: valid PDF/DOCX/text
      SubmitResume --> ResumeRejected: invalid input
      ResumeRejected --> SubmitResume
      ResumeValidated --> ApplyToOpenJob
      ApplyToOpenJob --> ApplicationCreated: quiz passed + checks passed
      ApplyToOpenJob --> ApplicationBlocked: duplicate/closed/failed quiz
      ApplicationBlocked --> [*]
    }

    ApplicationCreated --> RecruiterLane

    state RecruiterLane {
      [*] --> ReviewApplication
      ReviewApplication --> AnalyzeResume: analysis requested
      AnalyzeResume --> AnonymizePII
      AnonymizePII --> GeminiAssessment
      GeminiAssessment --> ReviewApplication
      ReviewApplication --> Screening
      Screening --> Interview
      Interview --> Offer
      Offer --> Deployed
      Offer --> Hired
      Screening --> Rejected
      Screening --> Withdrawn
      Interview --> Rejected
      Interview --> Withdrawn
      Deployed --> Finalized
      Hired --> Finalized
      Rejected --> Finalized
      Withdrawn --> Finalized
    }

    state AdminLane {
      [*] --> ManageUsers
      ManageUsers --> ManageRoles
      ManageRoles --> ViewAuditLogs
      ViewAuditLogs --> ViewSystemStats
      ViewSystemStats --> [*]
    }

    Finalized --> DashboardUpdated
    DashboardUpdated --> [*]
```

Legend:
- Applicant lane: resume/application intake and validation
- Recruiter lane: analysis, pipeline progression, and outcome handling
- Admin lane: user/role control, audit logs, and system stats
- `AnalyzeResume -> AnonymizePII -> GeminiAssessment`: AI evaluation sequence
- `Finalized`: terminal business outcomes (`hired`, `deployed`, `rejected`, `withdrawn`)

Annotation:
- This keeps the workflow as a visual process map without using the traditional flowchart symbol style.

---

## 2) Context Flow Diagram (CFD) - System in Its Environment

```mermaid
flowchart LR
    APP[Applicant / Candidate]
    REC[Recruiter]
    INT[Interviewer]
    ADM[Admin]
    AI[Gemini AI Service]
    DB[(PostgreSQL Database)]
    NOTIF[Notification Channel]
    SYS[[RBAC Resume Application System]]

    APP -->|Register, login, resume upload, quiz answers, job applications| SYS
    SYS -->|Application status, interview timeline, messages| APP

    REC -->|Create/manage jobs, request AI analysis, update status, shortlist| SYS
    SYS -->|Candidate pipeline, match insights, analytics data| REC

    INT -->|Interview outcome notes| SYS
    SYS -->|Interview assignments and schedules| INT

    ADM -->|User/role management actions, policy updates| SYS
    SYS -->|Audit logs, system stats, governance views| ADM

    SYS -->|Anonymized resume text + analysis prompts| AI
    AI -->|Resume score, strengths, weaknesses, recommendations| SYS

    SYS <--> |Users, resumes, jobs, applications, interviews, notifications| DB
    SYS -->|In-app alerts, interview invites, workflow updates| NOTIF

    classDef entity fill:#fde68a,stroke:#92400e,color:#0f172a,stroke-width:1px;
    classDef system fill:#bfdbfe,stroke:#1d4ed8,color:#0f172a,stroke-width:2px;
    classDef external fill:#ddd6fe,stroke:#5b21b6,color:#0f172a,stroke-width:1px;
    classDef datastore fill:#bbf7d0,stroke:#166534,color:#0f172a,stroke-width:1px;

    class APP,REC,INT,ADM entity;
    class SYS system;
    class AI,NOTIF external;
    class DB datastore;
```

Legend:
- Yellow: human external entities
- Blue: target system boundary/core process
- Purple: external services/channels
- Green cylinder: database/data store
- Arrows: data flow direction (input/output)

Annotation:
- Data to Gemini is anonymized before analysis, while complete system records remain in PostgreSQL.

---

## 3) Cumulative Flow Diagram (CFD) - Workflow Progress Over Time

```mermaid
%%{init: {'theme':'base','themeVariables': {'xyChart': {'plotColorPalette': '#60A5FA, #F59E0B, #10B981'}}}}%%
xychart-beta
    title "Cumulative Flow - Hiring Pipeline Throughput"
    x-axis ["W1","W2","W3","W4","W5","W6","W7","W8"]
    y-axis "Cumulative Item Count" 0 --> 80
    line [14,22,33,43,54,60,66,72]
    line [3,8,15,24,34,45,56,65]
    line [0,2,6,12,20,31,43,58]
```

Legend:
- Blue line (`To Do`): applications entering queue (mapped from early-stage intake like `received`)
- Orange line (`In Progress`): active processing (`screening`, `interview`, `offer`)
- Green line (`Completed`): final outcomes (`hired`, `rejected`, `withdrawn`, `deployed`)

Annotation:
- If the gap between `To Do` and `In Progress` widens quickly, intake is outpacing active processing.
- If `In Progress` grows faster than `Completed`, a downstream bottleneck likely exists.
- Replace weekly values with live counts from your analytics endpoints for production reporting.
