# SSPA – Sakai Student Success and Predictive Analytics

## Project Summary

**SSPA (Sakai Student Success and Predictive Analytics)** is an early-warning academic support system built to help identify students who may be at risk of not qualifying for examinations. The system uses Sakai-derived academic and engagement data, processes it through a backend API Gateway, applies a Random Forest predictive model, and displays the results through role-based dashboards.

The system is designed to support lecturers, academic advisors, students, and administrators by providing risk predictions, alerts, interventions, and report exports. SSPA does **not** make final academic decisions. It provides decision-support evidence so that lecturers and advisors can review students and intervene early.

---

## Main Purpose

The purpose of SSPA is to answer important academic support questions such as:

- Which students are at risk in a course?
- Which students have weak coursework or low engagement patterns?
- Which lecturers are responsible for the affected courses?
- Which intervention cases are open, in progress, completed, or escalated?
- Which alerts should be shown to lecturers, students, or advisors?
- Which reports can be exported for review?

The system helps institutions move from manual, reactive student support to a more data-driven and proactive support process.

---

## Key Features

### Role-Based Dashboards

SSPA supports four main user roles:

| Role | Main Purpose |
|---|---|
| **Student** | View personal risk status, alerts, academic information, and support information |
| **Lecturer** | View assigned courses, students, predictions, alerts, and interventions |
| **Advisor** | View escalated intervention cases and advisor alerts |
| **Admin** | Monitor backend modules, ETL, feature store, predictive model, and system health |

Each role has its own dashboard and access level. Backend role checks are enforced using bearer-token authentication.

---

### Predictive Analytics

The backend uses a **Random Forest classifier** to estimate whether a student may be at risk of not qualifying for an exam.

The model uses student-course evidence such as:

- Average score so far
- Assessment count
- Missed assessment count
- Submission count
- Login count
- Resource activity count
- Days since last login
- Course engagement ratio
- Course performance gap

The prediction output includes:

```text
student_number
course_code
risk_probability
predicted_risk_label
recommended_action
generated_at
```

Risk labels include:

```text
UNKNOWN
ON_TRACK
MODERATE
HIGH
```

A risk percentage is **not a mark**. It is the model's estimated probability that the student may be at risk.

Example alert message:

```text
Student s202408093 has been identified as high risk in course JMS1115.
Risk probability: 86.0%.
Please review the student profile and create an intervention if needed.
```

---

### Alerts and Notifications

SSPA supports automated alerts for academic risk and intervention escalation.

Typical alert routing:

- High-risk prediction → Lecturer alert
- Escalated intervention case → Advisor alert
- Student-related notifications → Student alert
- System issues or monitoring items → Admin alert

Lecturer alerts are routed using lecturer-course allocation data. Advisor alerts are created when intervention cases are escalated.

---

### Intervention Management

Lecturers can create and manage interventions for students who are identified as at risk.

Intervention status flow:

```text
TRIGGERED -> IN_PROGRESS -> COMPLETED
```

A case may also be escalated:

```text
TRIGGERED / IN_PROGRESS -> ESCALATED
```

When an intervention is escalated, the system creates an advisor alert for further academic support.

---

### Reports and Exports

The system supports CSV report exports for Lecturer and Advisor use.

Example report types:

- At-Risk Students
- Course Summary
- Interventions

Export buttons are shown only where they are relevant, especially on Lecturer and Advisor dashboards.

---

## Technology Stack

### Frontend

| Area | Technology |
|---|---|
| UI framework | React |
| Build tool | Vite |
| Language | JavaScript |
| Styling | CSS |
| Routing | React Router |
| API calls | Fetch API / Axios |
| Demo session storage | LocalStorage |

### Backend

| Area | Technology |
|---|---|
| Backend framework | FastAPI |
| ASGI server | Uvicorn |
| Database | PostgreSQL |
| Database driver | psycopg2 / psycopg2-binary |
| ML algorithm | RandomForestClassifier |
| ML libraries | pandas, numpy, scikit-learn, joblib |
| Authentication | Demo role passwords + bearer token |
| Rate limiting | Custom in-memory middleware |
| Reports | CSV streaming responses |
| API documentation | FastAPI Swagger UI |

---

## High-Level Architecture

```text
React Frontend
      |
      v
FastAPI API Gateway
      |
      v
Service Layer
      |
      v
Repository Layer
      |
      v
PostgreSQL Database
      |
      v
Feature Store + Predictive Model
```

Backend layering:

```text
Routers -> Services -> Repositories -> PostgreSQL
```

The frontend communicates with the backend through HTTP API endpoints. The backend retrieves data from PostgreSQL, applies business logic, trains or reads predictive model outputs, and returns role-specific responses to the frontend.

---

## Main Project Structure

```text
SAKAILMSPLUGIN/
├── api-gateway/
│   ├── app/
│   │   ├── core/
│   │   ├── ml/
│   │   ├── repositories/
│   │   ├── routers/
│   │   ├── schemas/
│   │   └── main.py
│   ├── scripts/
│   ├── requirements.txt
│   └── README.md
│
├── frontend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── admin/
│   │   │   ├── advisor/
│   │   │   ├── home/
│   │   │   ├── lecturer/
│   │   │   ├── shared/
│   │   │   └── student/
│   │   ├── services/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

---

## Backend Modules

Important backend modules include:

```text
health
me
lecturer
student
advisor
intervention
notification
etl
feature_store
predictive
faculty_admin
reports
```

Important backend folders include:

```text
app/routers
app/services
app/repositories
app/core
app/ml
```

---

## Database Overview

The backend uses PostgreSQL with several logical schemas:

```text
sakai_raw
feature_store
predictive
notification
intervention
```

Important tables include:

```text
sakai_raw.student_memberships
sakai_raw.gradebook_scores
sakai_raw.test_attempts
sakai_raw.assignment_submissions
sakai_raw.logins_daily
sakai_raw.resources_daily
sakai_raw.lecturer_course_allocation

feature_store.student_course_features
feature_store.model_training_dataset

predictive.model_run
predictive.student_risk_prediction

notification.alert

intervention.case
intervention.case_status_history
```

The `sakai_raw.lecturer_course_allocation` table is important because it maps lecturers to courses and allows prediction alerts to be routed to the correct lecturer.

---

## Prerequisites

Before running the project, install or prepare:

- Python 3.11 or later
- Node.js and npm
- Docker Desktop
- PostgreSQL running in Docker
- PowerShell or terminal
- Existing PostgreSQL container named:

```text
sspa-postgres
```

Expected database:

```text
Database: AnalyticalDataStore
User: SakaiLMSPlugin
```

Check the database:

```powershell
docker exec sspa-postgres psql -U SakaiLMSPlugin -d AnalyticalDataStore -c "SELECT current_database(), current_user;"
```

---

## Running the Backend

Open PowerShell and run:

```powershell
cd C:\SAKAILMSPLUGIN\api-gateway
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --log-level debug
```

Backend URL:

```text
http://localhost:8000
```

Swagger API documentation:

```text
http://localhost:8000/docs
```

Health check:

```powershell
Invoke-RestMethod -Method GET -Uri "http://localhost:8000/health"
```

Reports health check:

```powershell
Invoke-RestMethod -Method GET -Uri "http://localhost:8000/reports/health"
```

---

## Running the Frontend

Open another PowerShell window and run:

```powershell
cd C:\SAKAILMSPLUGIN\frontend
npm install
npm run dev
```

The frontend will usually run at:

```text
http://localhost:5173
```

Build for production:

```powershell
npm run build
```

Preview production build:

```powershell
npm run preview
```

---

## Authentication

The project uses static demo passwords for demonstration.

| Role | Password |
|---|---|
| STUDENT | Student@123 |
| LECTURER | Lecturer@123 |
| ADVISOR | Advisor@123 |
| ADMIN | Admin@123 |

Login endpoint:

```text
POST /me/simulate-login
```

After login, the backend returns a bearer token. The frontend stores the token and sends it with protected API requests:

```text
Authorization: Bearer <access_token>
```

Frontend localStorage keys include:

```text
sspa_access_token
sspa_session
sspa_role
sspa_token_expires_at
```

---

## Useful API Endpoints

```text
GET  /health
GET  /reports/health
POST /me/simulate-login
GET  /me/roles
POST /predictive/train
GET  /predictive/train/status/{job_id}
GET  /reports/lecturer/export.csv
```

The full list of available endpoints can be viewed in Swagger UI:

```text
http://localhost:8000/docs
```

---

## Training the Predictive Model

Login as Admin first, then call:

```powershell
Invoke-RestMethod -Method POST `
  -Uri "http://localhost:8000/predictive/train" `
  -Headers $headers
```

Check latest model runs:

```powershell
docker exec sspa-postgres psql -U SakaiLMSPlugin -d AnalyticalDataStore -c "SELECT run_id, model_name, algorithm, status, total_labelled_rows, train_rows, test_rows, prediction_rows_generated, accuracy, precision_score, recall_score, f1_score, roc_auc_score, created_at FROM predictive.model_run ORDER BY created_at DESC LIMIT 5;"
```

Check prediction distribution:

```powershell
docker exec sspa-postgres psql -U SakaiLMSPlugin -d AnalyticalDataStore -c "SELECT predicted_risk_label, COUNT(*) FROM predictive.student_risk_prediction GROUP BY predicted_risk_label ORDER BY predicted_risk_label;"
```

Check latest predictions:

```powershell
docker exec sspa-postgres psql -U SakaiLMSPlugin -d AnalyticalDataStore -c "SELECT student_number, course_code, risk_probability, predicted_risk_label, generated_at FROM predictive.student_risk_prediction ORDER BY generated_at DESC LIMIT 20;"
```

---

## Report Export Example

```powershell
Invoke-WebRequest `
  -Uri "http://localhost:8000/reports/lecturer/export.csv?lecturer_number=xxxx&course_code=xxxx&report_type=at-risk-students" `
  -Headers $headers `
  -OutFile ".\lecturer_report.csv"
```

---

## Common Troubleshooting

### Missing bearer token

Error:

```text
{"detail":"Missing bearer token"}
```

Fix: Login first and pass:

```text
Authorization: Bearer <token>
```

---

### Invalid or expired token

Cause: Tokens are currently stored in memory. If the backend restarts, old browser tokens become invalid.

Fix: Login again or clear browser storage:

```javascript
localStorage.clear();
sessionStorage.clear();
location.href = "/";
```

---

### Reports endpoint not found

If `/reports/health` returns `404`, register the reports router in `api-gateway/app/main.py`:

```python
from app.routers import reports

app.include_router(reports.router)
```

---

### Rate limit middleware error

Error:

```text
TypeError: rate_limit_middleware() got an unexpected keyword argument 'app'
```

Fix: Register it using FastAPI middleware syntax:

```python
@app.middleware("http")
async def apply_rate_limit(request, call_next):
    return await rate_limit_middleware(request, call_next)
```

Do not register it using:

```python
app.add_middleware(rate_limit_middleware)
```

---

### Frontend export error

Error:

```text
reportExportApi.js: url is not defined
```

Fix: Check `src/services/reportExportApi.js` and remove any unused code outside the `downloadReportCsv` function.

---

### CSV encoding error

Error example:

```text
invalid byte sequence for encoding "UTF8"
```

Fix: Clean the CSV file and save it as UTF-8 before importing it into PostgreSQL.

---

## Security Notes

This project currently uses demo authentication for academic demonstration. In production, the following improvements are required:

- Replace static demo passwords with real institutional authentication
- Store password hashes securely in the backend
- Use HTTPS
- Persist token hashes in a database with expiry and revocation fields
- Enforce role-based access in the backend
- Avoid storing sensitive credentials in frontend code
- Protect report exports with strict authorization
- Keep student data visible only to authorized users
- Apply rate limiting to login and sensitive API routes

The frontend may control navigation, but the backend must always enforce access control.

---

## Development Workflow

Recommended development and testing order:

```text
1. Start PostgreSQL container.
2. Confirm database connection.
3. Start FastAPI backend.
4. Confirm /health.
5. Confirm /reports/health.
6. Start React frontend.
7. Login using a demo role.
8. Check dashboards.
9. Refresh feature store if needed.
10. Train predictive model as Admin.
11. Verify predictions in PostgreSQL.
12. Verify lecturer alerts.
13. Test interventions and escalation.
14. Test advisor alerts.
15. Test report exports.
```

---

## Important Disclaimer

SSPA is an early-warning and decision-support system. It should not be used as an automatic final academic decision tool.

A `HIGH` risk label means the student should be reviewed and supported. It does not mean the student has failed or will definitely fail to qualify for the exam. Lecturers and advisors must review the evidence before taking action.

---

