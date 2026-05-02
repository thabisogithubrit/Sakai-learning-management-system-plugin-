$ErrorActionPreference = "Stop"

# ============================================================
# SSPA Scheduled Model Retraining
# Schedule: Every 3 weeks
# Purpose:
#   Refreshes the feature store, trains the Random Forest model,
#   saves evaluation metrics, confusion matrix, feature importance,
#   and student-course risk predictions.
# ============================================================

$ProjectRoot = "C:\SAKAILMSPLUGIN"
$LogFolder = Join-Path $ProjectRoot "model_training_logs"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$LogFile = Join-Path $LogFolder "model_retraining_$Timestamp.log"

$BackendBaseUrl = "http://localhost:8000"

function Write-Log {
    param([string]$Message)

    $Line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $Message"
    Write-Host $Line
    Add-Content -Path $LogFile -Value $Line
}

function Invoke-ApiJson {
    param(
        [string]$Method,
        [string]$Url
    )

    try {
        if ($Method -eq "POST") {
            return Invoke-RestMethod -Method POST -Uri $Url
        }

        return Invoke-RestMethod -Method GET -Uri $Url
    }
    catch {
        Write-Log "API request failed: $Url"

        if ($_.Exception.Response) {
            $Reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $ResponseBody = $Reader.ReadToEnd()
            Write-Log "Response body: $ResponseBody"
        }
        else {
            Write-Log "Error: $($_.Exception.Message)"
        }

        throw
    }
}

New-Item -ItemType Directory -Force -Path $LogFolder | Out-Null

Write-Log "============================================================"
Write-Log "Starting scheduled SSPA predictive model retraining"
Write-Log "Backend URL: $BackendBaseUrl"
Write-Log "Schedule policy: every 3 weeks"
Write-Log "============================================================"

Write-Log "Checking backend health..."
$Health = Invoke-ApiJson -Method "GET" -Url "$BackendBaseUrl/health"
Write-Log "Backend health response:"
Write-Log ($Health | ConvertTo-Json -Depth 10)

Write-Log "Checking predictive training diagnostics before retraining..."
$DiagnosticsBefore = Invoke-ApiJson -Method "GET" -Url "$BackendBaseUrl/predictive/diagnostics"
Write-Log ($DiagnosticsBefore | ConvertTo-Json -Depth 10)

if ([int]$DiagnosticsBefore.training_rows -le 0) {
    throw "Cannot train: training_rows is 0."
}

if ([int]$DiagnosticsBefore.at_risk_rows -le 0) {
    throw "Cannot train: at_risk_rows is 0."
}

if ([int]$DiagnosticsBefore.not_at_risk_rows -le 0) {
    throw "Cannot train: not_at_risk_rows is 0."
}

Write-Log "Starting model training..."
$TrainResult = Invoke-ApiJson -Method "POST" -Url "$BackendBaseUrl/predictive/train"
Write-Log "Training result:"
Write-Log ($TrainResult | ConvertTo-Json -Depth 20)

Write-Log "Fetching latest evaluation after retraining..."
$Evaluation = Invoke-ApiJson -Method "GET" -Url "$BackendBaseUrl/predictive/evaluation/latest"
Write-Log "Latest evaluation:"
Write-Log ($Evaluation | ConvertTo-Json -Depth 20)

Write-Log "Fetching report-ready testing table..."
$TestingTable = Invoke-ApiJson -Method "GET" -Url "$BackendBaseUrl/predictive/report-ready-testing-table"
Write-Log "Report-ready testing table:"
Write-Log ($TestingTable | ConvertTo-Json -Depth 20)

Write-Log "Scheduled model retraining completed successfully."
Write-Log "============================================================"