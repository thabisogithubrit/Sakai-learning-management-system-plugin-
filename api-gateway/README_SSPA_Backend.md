# SSPA API Gateway Backend

## 1. Project Overview

The **SSPA API Gateway Backend** is the FastAPI backend for the **Sakai Student Success and Predictive Analytics (SSPA)** system. It connects Sakai-derived academic and engagement data stored in PostgreSQL with dashboards for Students, Lecturers, Academic Advisors, and Administrators.

The backend provides:

- Role-based access for Student, Lecturer, Advisor, and Admin users.
- Static demo-password authentication with bearer tokens.
- API rate limiting to reduce brute-force and abuse risk.
- Sakai raw-data access through PostgreSQL.
- Lecturer, Student, Advisor, Admin, Notification, Intervention, ETL, Feature Store, Predictive Analytics, and Report Export APIs.
- Predictive model training using a Random Forest classifier.
- Risk prediction storage in PostgreSQL.
- Automatic lecturer alerts for high-risk student-course predictions.
- Advisor alerts for escalated intervention cases.
- CSV report exports for lecturer-facing reporting.

The system is designed as an **early-warning support tool**, not a final academic decision system. It estimates whether a student may be at risk of not qualifying for an exam based on coursework and engagement evidence, then routes alerts to responsible staff for review and intervention.

---

## 2. System Purpose

SSPA supports early academic intervention by helping lecturers and advisors identify students who may need support before they miss the exam qualification threshold.

The backend answers questions such as:

- Which students are enrolled in a lecturer's course?
- Which students have low coursework or weak engagement patterns?
- Which students have been predicted as HIGH, MODERATE, ON_TRACK, or UNKNOWN risk?
- Which lecturer is responsible for a course?
- Which intervention cases are open, completed, or escalated?
- Which advisor alerts should be visible?
- Which reports can be exported?

The backend does not automatically decide that a student has failed. It only provides a risk estimate and evidence for lecturer review.

---

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Backend framework | FastAPI |
| ASGI server | Uvicorn |
| Database | PostgreSQL |
| Database driver | psycopg2 / psycopg2-binary |
| ML algorithm | RandomForestClassifier |
| ML libraries | pandas, numpy, scikit-learn, joblib |
| Authentication | Static demo passwords + bearer token |
| Rate limiting | Custom in-memory middleware |
| Reports | CSV streaming response |
| API documentation | FastAPI Swagger UI |

---

## 4. Backend Architecture

The backend follows a layered architecture:

```text
Routers  ->  Services  ->  Repositories  ->  PostgreSQL
```

### 4.1 Routers

Routers define HTTP endpoints and call the service layer.

Example router files:

```text
app/routers/health.py
app/routers/me.py
app/routers/lecturer.py
app/routers/student.py
app/routers/advisor.py
app/routers/intervention.py
app/routers/notification.py
app/routers/etl.py
app/routers/feature_store.py
app/routers/predictive.py
app/routers/faculty_admin.py
app/routers/reports.py
```

### 4.2 Services

Services contain workflow and business logic.

Example service files:

```text
app/services/lecturer_service.py
app/services/student_service.py
app/services/advisor_service.py
app/services/intervention_service.py
app/services/notification_service.py
app/services/etl_service.py
app/services/feature_store_service.py
app/services/predictive_service.py
app/services/faculty_admin_service.py
```

### 4.3 Repositories

Repositories contain SQL and database-specific logic.

Example repository files:

```text
app/repositories/lecturer_repository.py
app/repositories/student_repository.py
app/repositories/advisor_repository.py
app/repositories/intervention_repository.py
app/repositories/notification_repository.py
app/repositories/etl_repository.py
app/repositories/feature_store_repository.py
app/repositories/predictive_repository.py
app/repositories/faculty_admin_repository.py
```

### 4.4 Core Utilities

Core backend files:

```text
app/core/auth.py
app/core/db.py
app/core/rate_limit.py
app/core/session.py
```

---

## 5. Expected Project Structure

```text
api-gateway/
├── app/
│   ├── core/
│   │   ├── auth.py
│   │   ├── db.py
│   │   ├── rate_limit.py
│   │   └── session.py
│   ├── ml/
│   │   ├── predictive_trainer.py
│   │   └── models/
│   ├── repositories/
│   ├── routers/
│   ├── schemas/
│   └── main.py
├── scripts/
│   └── train_model_now.py
├── requirements.txt
├── requirements_predictive.txt
└── README.md
```

---

## 6. Prerequisites

Install or prepare:

- Python 3.11 or later
- Docker Desktop
- PostgreSQL running inside Docker
- PowerShell
- Existing PostgreSQL container named `sspa-postgres`
- Database named `AnalyticalDataStore`
- Database user named `SakaiLMSPlugin`

Check the database:

```powershell
docker exec sspa-postgres psql -U SakaiLMSPlugin -d AnalyticalDataStore -c "SELECT current_database(), current_user;"
```

---

## 7. Installation

From the backend folder:

```powershell
cd C:\SAKAILMSPLUGIN\api-gateway
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Recommended `requirements.txt`:

```text
fastapi==0.115.0
uvicorn[standard]==0.30.6
pydantic==2.8.2
psycopg2-binary
python-dotenv
pandas
numpy
scikit-learn
joblib
```

---

## 8. Running the Backend

```powershell
cd C:\SAKAILMSPLUGIN\api-gateway
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --log-level debug
```

Backend URL:

```text
http://localhost:8000
```

Swagger UI:

```text
http://localhost:8000/docs
```

---

## 9. Health Checks

Main health endpoint:

```powershell
Invoke-RestMethod -Method GET -Uri "http://localhost:8000/health"
```

Reports health endpoint:

```powershell
Invoke-RestMethod -Method GET -Uri "http://localhost:8000/reports/health"
```

---

## 10. Authentication

The backend uses static role passwords for demonstration. In production, these should be replaced by real Sakai or institutional authentication.

Demo passwords:

| Role | Password |
|---|---|
| Student | Student@123 |
| Lecturer | Lecturer@123 |
| Advisor | Advisor@123 |
| Admin | Admin@123 |

Login endpoint:

```text
POST /me/simulate-login
```

### Admin login example

```powershell
$body = @{
  role = "ADMIN"
  password = "Admin@123"
} | ConvertTo-Json

$login = Invoke-RestMethod -Method POST `
  -Uri "http://localhost:8000/me/simulate-login" `
  -ContentType "application/json" `
  -Body $body

$headers = @{
  Authorization = "Bearer $($login.access_token)"
}
```

### Lecturer login example

```powershell
$body = @{
  role = "LECTURER"
  password = "Lecturer@123"
  lecturer_number = "199611855"
} | ConvertTo-Json

$login = Invoke-RestMethod -Method POST `
  -Uri "http://localhost:8000/me/simulate-login" `
  -ContentType "application/json" `
  -Body $body
```

### Student login example

```powershell
$body = @{
  role = "STUDENT"
  password = "Student@123"
  student_number = "s202100055"
} | ConvertTo-Json

$login = Invoke-RestMethod -Method POST `
  -Uri "http://localhost:8000/me/simulate-login" `
  -ContentType "application/json" `
  -Body $body
```

### Advisor login example

```powershell
$body = @{
  role = "ADVISOR"
  password = "Advisor@123"
} | ConvertTo-Json

$login = Invoke-RestMethod -Method POST `
  -Uri "http://localhost:8000/me/simulate-login" `
  -ContentType "application/json" `
  -Body $body
```

---

## 11. Bearer Token Usage

Protected endpoints require this header:

```text
Authorization: Bearer <access_token>
```

Example:

```powershell
Invoke-RestMethod -Method GET `
  -Uri "http://localhost:8000/etl/health" `
  -Headers $headers
```

Development note:

```text
Tokens are currently stored in memory. If the backend restarts, browser tokens become invalid and users must login again.
```

---

## 12. Role-Based Access Control

Typical access rules:

| Module | Allowed Roles |
|---|---|
| Student dashboard | STUDENT, ADVISOR, ADMIN |
| Lecturer dashboard | LECTURER, ADMIN |
| Advisor dashboard | ADVISOR, ADMIN |
| Admin dashboard | ADMIN |
| Predictive training | ADMIN |
| ETL monitoring | ADMIN |
| Feature Store refresh | ADMIN |
| Notifications | STUDENT, LECTURER, ADVISOR, ADMIN |
| Interventions | STUDENT, LECTURER, ADVISOR, ADMIN |
| Reports | LECTURER, ADVISOR, ADMIN depending on scope |

---

## 13. Rate Limiting

The backend includes custom rate limiting in:

```text
app/core/rate_limit.py
```

Purpose:

- Reduce brute-force login attempts.
- Protect backend APIs from repeated rapid requests.
- Support security requirements for sensitive student data.

Correct FastAPI registration:

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

## 14. Database Schemas

The backend uses these schemas:

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

---

## 15. Lecturer Course Allocation Import

The table `sakai_raw.lecturer_course_allocation` maps lecturers to course codes. It is used to route model-generated alerts to the correct lecturer.

Target structure:

```sql
CREATE TABLE sakai_raw.lecturer_course_allocation (
    lecturer_number TEXT NOT NULL,
    course_code TEXT NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (lecturer_number, course_code)
);
```

### Copy CSV into Docker

```powershell
docker exec sspa-postgres mkdir -p /tmp/sakai_import

docker cp "C:\SAKAILMSPLUGIN\sakai_exports\2025_26 Lecturer Course Allocation.csv" "sspa-postgres:/tmp/sakai_import/lecturer_course_allocation.csv"

docker exec sspa-postgres head -n 1 /tmp/sakai_import/lecturer_course_allocation.csv
```

If the first row looks like this, the CSV has no header:

```text
202110001,GES2414
```

### Drop, recreate, and import

```powershell
@'
BEGIN;

DROP TABLE IF EXISTS sakai_raw.lecturer_course_allocation;

CREATE SCHEMA IF NOT EXISTS sakai_raw;

CREATE TABLE sakai_raw.lecturer_course_allocation (
    lecturer_number TEXT NOT NULL,
    course_code TEXT NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (lecturer_number, course_code)
);

CREATE TEMP TABLE tmp_lecturer_course_allocation (
    lecturer_number TEXT,
    course_code TEXT
);

COPY tmp_lecturer_course_allocation (
    lecturer_number,
    course_code
)
FROM '/tmp/sakai_import/lecturer_course_allocation.csv'
WITH (
    FORMAT csv,
    HEADER false,
    ENCODING 'UTF8'
);

INSERT INTO sakai_raw.lecturer_course_allocation (
    lecturer_number,
    course_code,
    ingested_at
)
SELECT DISTINCT ON (
    TRIM(lecturer_number),
    TRIM(course_code)
)
    TRIM(lecturer_number) AS lecturer_number,
    TRIM(course_code) AS course_code,
    now() AS ingested_at
FROM tmp_lecturer_course_allocation
WHERE NULLIF(TRIM(lecturer_number), '') IS NOT NULL
  AND NULLIF(TRIM(course_code), '') IS NOT NULL
ORDER BY
    TRIM(lecturer_number),
    TRIM(course_code);

COMMIT;
'@ | docker exec -i sspa-postgres psql -U SakaiLMSPlugin -d AnalyticalDataStore -v ON_ERROR_STOP=1
```

### Verify import

```powershell
docker exec sspa-postgres psql -U SakaiLMSPlugin -d AnalyticalDataStore -c "SELECT COUNT(*) FROM sakai_raw.lecturer_course_allocation;"
```

---

## 16. Predictive Model

The model is a supervised binary classifier.

```text
Algorithm: RandomForestClassifier
Input X: student-course features
Target y: exam non-qualification risk label
Output: risk probability and risk label
```

### 16.1 What the model predicts

The model predicts whether a student may be at risk of not qualifying for the exam.

It does not decide that the student failed. It is an early-warning system.

### 16.2 Features

Features are input evidence from Sakai:

```text
avg_score_so_far
assessment_count
missed_assessment_count
submission_count
login_count
resource_count
days_since_last_login
course_engagement_ratio
course_performance_gap
```

Feature sources include:

```text
sakai_raw.gradebook_scores
sakai_raw.test_attempts
sakai_raw.assignment_submissions
sakai_raw.logins_daily
sakai_raw.resources_daily
sakai_raw.student_memberships
```

### 16.3 Target label

The target is separate from the features:

```text
target_at_risk = 1 if student is below the exam qualification threshold
target_at_risk = 0 if student is not below the threshold
```

The threshold is based on the 40% coursework/exam qualification rule.

### 16.4 Risk probability

Random Forest uses many decision trees. If 86 out of 100 trees vote that the student is at risk, the risk probability is 86%.

Recommended risk bands:

```text
UNKNOWN    = insufficient assessment evidence
ON_TRACK   = risk probability below 50%
MODERATE   = risk probability from 50% to 74%
HIGH       = risk probability 75% or above with enough assessment evidence
```

Recommended safeguard:

```text
Only create lecturer alerts for HIGH risk cases with enough assessment evidence.
```

---

## 17. Training the Model

Login as Admin:

```powershell
$body = @{
  role = "ADMIN"
  password = "Admin@123"
} | ConvertTo-Json

$login = Invoke-RestMethod -Method POST `
  -Uri "http://localhost:8000/me/simulate-login" `
  -ContentType "application/json" `
  -Body $body

$headers = @{
  Authorization = "Bearer $($login.access_token)"
}
```

Start training:

```powershell
Invoke-RestMethod -Method POST `
  -Uri "http://localhost:8000/predictive/train" `
  -Headers $headers
```

If background training is enabled, poll job status:

```powershell
Invoke-RestMethod -Method GET `
  -Uri "http://localhost:8000/predictive/train/status/<job_id>" `
  -Headers $headers
```

Verify latest model run:

```powershell
docker exec sspa-postgres psql -U SakaiLMSPlugin -d AnalyticalDataStore -c "SELECT run_id, model_name, algorithm, status, total_labelled_rows, train_rows, test_rows, prediction_rows_generated, accuracy, precision_score, recall_score, f1_score, roc_auc_score, created_at FROM predictive.model_run ORDER BY created_at DESC LIMIT 5;"
```

Check prediction distribution:

```powershell
docker exec sspa-postgres psql -U SakaiLMSPlugin -d AnalyticalDataStore -c "SELECT predicted_risk_label, COUNT(*) FROM predictive.student_risk_prediction GROUP BY predicted_risk_label ORDER BY predicted_risk_label;"
```

---

## 18. Notifications and Alert Routing

### 18.1 Lecturer alerts from predictions

Prediction alerts are created from:

```text
predictive.student_risk_prediction
```

They are routed using:

```text
sakai_raw.lecturer_course_allocation
```

Typical lecturer alert:

```text
recipient_role = LECTURER
recipient_identifier = <lecturer_number>
alert_type = AT_RISK_STUDENT
source_module = PREDICTIVE
created_by_role = SYSTEM
created_by_identifier = PREDICTIVE_ENGINE
```

### 18.2 Advisor alerts from escalated cases

When intervention status becomes `ESCALATED`, the backend creates an advisor alert:

```text
recipient_role = ADVISOR
recipient_identifier = ACADEMIC_ADVISOR
alert_type = ESCALATED_INTERVENTION
source_module = INTERVENTION
```

### 18.3 Dismiss predictive alerts during development

```powershell
docker exec sspa-postgres psql -U SakaiLMSPlugin -d AnalyticalDataStore -c "UPDATE notification.alert SET status = 'DISMISSED' WHERE source_module = 'PREDICTIVE' AND alert_type = 'AT_RISK_STUDENT';"
```

---

## 19. Interventions

Intervention cases are stored in:

```text
intervention.case
```

Typical statuses:

```text
TRIGGERED
IN_PROGRESS
COMPLETED
ESCALATED
```

A lecturer can create an intervention for a student. If the case needs higher-level support, it can be escalated to an advisor. The escalation triggers an advisor notification.

---

## 20. Reports and Exports

Reports router:

```text
app/routers/reports.py
```

Health check:

```powershell
Invoke-RestMethod -Method GET -Uri "http://localhost:8000/reports/health"
```

Export example:

```powershell
Invoke-WebRequest `
  -Uri "http://localhost:8000/reports/lecturer/export.csv?lecturer_number=199611855&course_code=M1506&report_type=at-risk-students" `
  -Headers $headers `
  -OutFile ".\lecturer_report.csv"
```

---

## 21. Common Errors and Fixes

### Missing bearer token

Error:

```text
{"detail":"Missing bearer token"}
```

Fix: login first and pass `Authorization: Bearer <token>`.

---

### Invalid or expired token

Cause: backend restarted and cleared the in-memory token store.

Fix: login again.

Browser reset:

```javascript
localStorage.removeItem("sspa_access_token");
localStorage.removeItem("sspa_token_type");
localStorage.removeItem("sspa_session");
localStorage.removeItem("sspa_role");
location.reload();
```

---

### rate_limit_middleware unexpected keyword argument app

Error:

```text
TypeError: rate_limit_middleware() got an unexpected keyword argument 'app'
```

Fix: use `@app.middleware("http")`, not `app.add_middleware(rate_limit_middleware)`.

---

### prediction timestamp column error

Error:

```text
column p.created_at does not exist
```

Fix:

```sql
p.generated_at AS prediction_created_at
```

The prediction table uses `generated_at`, not `created_at`.

---

### CSV invalid byte sequence

Error:

```text
invalid byte sequence for encoding "UTF8": 0xa0
```

Cause: CSV contains non-breaking spaces or bad Excel characters.

Fix: clean the CSV and save as UTF-8 before import.

---

### report export endpoint not found

Check:

```powershell
Invoke-RestMethod -Method GET -Uri "http://localhost:8000/reports/health"
```

If it returns 404, register the reports router in `app/main.py`:

```python
from app.routers import reports
app.include_router(reports.router)
```

---

### alert_type_check failure

Error:

```text
violates check constraint "alert_type_check"
```

Fix: include required alert types in the database constraint:

```sql
ALTER TABLE notification.alert
DROP CONSTRAINT IF EXISTS alert_type_check;

ALTER TABLE notification.alert
ADD CONSTRAINT alert_type_check
CHECK (
    alert_type IN (
        'AT_RISK_STUDENT',
        'LOW_ENGAGEMENT',
        'MISSED_ASSESSMENT',
        'INTERVENTION_CREATED',
        'INTERVENTION_STARTED',
        'INTERVENTION_COMPLETED',
        'ESCALATED_INTERVENTION',
        'GENERAL_NOTIFICATION',
        'SYSTEM_ALERT'
    )
);
```

---

## 22. Security Notes

The backend supports the following security principles:

1. Passwords should never be stored in plain text.
2. Tokens should not be stored in plain text.
3. Protected APIs require bearer tokens.
4. APIs enforce role-based access.
5. Login and API calls are rate-limited.
6. Student data is routed only to authorized users.
7. Lecturer alerts are routed by course allocation.
8. Advisor alerts are created only for escalated intervention cases.
9. Report exports are protected by role checks.

Current development limitation:

```text
Tokens are stored in memory. In production, token hashes should be persisted in a database table with expiry time.
```

Recommended production token table:

```text
auth.session_token
```

Recommended stored fields:

```text
token_hash
user_id
role
expires_at
created_at
revoked_at
```

---

## 23. Development Workflow

Recommended workflow:

```text
1. Start PostgreSQL container.
2. Confirm database is reachable.
3. Activate Python virtual environment.
4. Start FastAPI backend.
5. Confirm /health.
6. Confirm /reports/health.
7. Login as Admin.
8. Check ETL and Feature Store.
9. Train predictive model.
10. Verify predictions.
11. Verify lecturer alerts.
12. Test frontend dashboards.
```

---

## 24. Useful Commands

Start backend:

```powershell
cd C:\SAKAILMSPLUGIN\api-gateway
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --log-level debug
```

Check raw tables:

```powershell
docker exec sspa-postgres psql -U SakaiLMSPlugin -d AnalyticalDataStore -c "\dt sakai_raw.*"
```

Check prediction table:

```powershell
docker exec sspa-postgres psql -U SakaiLMSPlugin -d AnalyticalDataStore -c "\d predictive.student_risk_prediction"
```

Check latest predictions:

```powershell
docker exec sspa-postgres psql -U SakaiLMSPlugin -d AnalyticalDataStore -c "SELECT student_number, course_code, risk_probability, predicted_risk_label, generated_at FROM predictive.student_risk_prediction ORDER BY generated_at DESC LIMIT 20;"
```

Check notifications:

```powershell
docker exec sspa-postgres psql -U SakaiLMSPlugin -d AnalyticalDataStore -c "SELECT recipient_role, recipient_identifier, alert_type, severity, status, COUNT(*) FROM notification.alert GROUP BY recipient_role, recipient_identifier, alert_type, severity, status ORDER BY COUNT(*) DESC LIMIT 20;"
```

Check lecturer allocation:

```powershell
docker exec sspa-postgres psql -U SakaiLMSPlugin -d AnalyticalDataStore -c "SELECT lecturer_number, course_code, ingested_at FROM sakai_raw.lecturer_course_allocation ORDER BY lecturer_number, course_code LIMIT 20;"
```

---

## 25. Important Disclaimer

SSPA is an early-warning and decision-support system. It should not be used as an automatic final academic decision tool.

Predictions should be reviewed by lecturers or advisors before intervention. A HIGH risk label means that the student should be reviewed and supported, not that the student has failed or definitely will not qualify for the exam.
