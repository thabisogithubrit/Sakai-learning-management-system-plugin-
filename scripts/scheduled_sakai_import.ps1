$ErrorActionPreference = "Stop"

# ============================================================
# SSPA Scheduled Sakai CSV Import
# Purpose:
#   Automatically imports exported Sakai CSV files into sakai_raw,
#   refreshes the feature store, updates faculty mappings, and
#   prepares data for predictive analytics.
# ============================================================

$ProjectRoot = "C:\SAKAILMSPLUGIN"
$SourceFolder = Join-Path $ProjectRoot "sakai_exports"
$LogFolder = Join-Path $ProjectRoot "etl_logs"

$ContainerName = "sspa-postgres"
$DbUser = "SakaiLMSPlugin"
$DbName = "AnalyticalDataStore"
$ContainerImportFolder = "/tmp/sakai_import"

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$LogFile = Join-Path $LogFolder "scheduled_sakai_import_$Timestamp.log"

$TableMap = [ordered]@{
    "assignments.csv"                     = "assignments"
    "assignment_submissions.csv"          = "assignment_submissions"
    "coursework_threshold_candidates.csv" = "coursework_threshold_candidates"
    "gradebook_items.csv"                 = "gradebook_items"
    "gradebook_scores.csv"                = "gradebook_scores"
    "lecturer_course_allocation.csv"      = "lecturer_course_allocation"
    "logins_daily.csv"                    = "logins_daily"
    "resources_daily.csv"                 = "resources_daily"
    "sites.csv"                          = "sites"
    "student_memberships.csv"             = "student_memberships"
    "terminal_outcome_candidates.csv"     = "terminal_outcome_candidates"
    "test_attempts.csv"                   = "test_attempts"
    "tests.csv"                          = "tests"
}

function Write-Log {
    param([string]$Message)

    $Line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $Message"
    Write-Host $Line
    Add-Content -Path $LogFile -Value $Line
}

function Quote-PgIdentifier {
    param([string]$Name)

    return '"' + $Name.Replace('"', '""') + '"'
}

function Invoke-DbSql {
    param([string]$Sql)

    docker exec -i $ContainerName psql `
        -U $DbUser `
        -d $DbName `
        -v "ON_ERROR_STOP=1" `
        -c "$Sql"

    if ($LASTEXITCODE -ne 0) {
        throw "Database SQL command failed."
    }
}

function Assert-DockerContainerRunning {
    $Running = docker ps --format "{{.Names}}" | Select-String -Pattern "^$ContainerName$"

    if (-not $Running) {
        throw "Docker container '$ContainerName' is not running. Start PostgreSQL first."
    }
}

function Get-CsvHeaderColumns {
    param([string]$CsvPath)

    $HeaderLine = Get-Content -Path $CsvPath -TotalCount 1

    if (-not $HeaderLine) {
        throw "CSV file has no header: $CsvPath"
    }

    $HeaderLine = $HeaderLine.Trim([char]0xFEFF)

    $Columns = $HeaderLine.Split(",") |
        ForEach-Object { $_.Trim().Trim('"') } |
        Where-Object { $_ -ne "" }

    if ($Columns.Count -eq 0) {
        throw "No columns detected in CSV header: $CsvPath"
    }

    return $Columns
}

# ============================================================
# Start
# ============================================================

New-Item -ItemType Directory -Force -Path $LogFolder | Out-Null

Write-Log "============================================================"
Write-Log "Starting scheduled Sakai CSV ETL import"
Write-Log "Source folder: $SourceFolder"
Write-Log "PostgreSQL container: $ContainerName"
Write-Log "Database: $DbName"
Write-Log "============================================================"

if (-not (Test-Path $SourceFolder)) {
    New-Item -ItemType Directory -Force -Path $SourceFolder | Out-Null
    Write-Log "Created missing source folder: $SourceFolder"
    Write-Log "Place Sakai CSV exports in this folder and run the task again."
    exit 0
}

Assert-DockerContainerRunning

docker exec $ContainerName sh -c "mkdir -p $ContainerImportFolder"

if ($LASTEXITCODE -ne 0) {
    throw "Failed to create import folder inside PostgreSQL container."
}

$ImportedTables = 0
$SkippedFiles = 0

foreach ($FileName in $TableMap.Keys) {
    $TableName = $TableMap[$FileName]
    $LocalFile = Join-Path $SourceFolder $FileName

    if (-not (Test-Path $LocalFile)) {
        Write-Log "SKIPPED: $FileName not found."
        $SkippedFiles++
        continue
    }

    Write-Log "Preparing import: $FileName -> sakai_raw.$TableName"

    $Columns = Get-CsvHeaderColumns -CsvPath $LocalFile
    $ColumnSql = ($Columns | ForEach-Object { Quote-PgIdentifier $_ }) -join ", "

    $QuotedTable = Quote-PgIdentifier $TableName
    $ContainerFile = "$ContainerImportFolder/$FileName"

    docker cp "$LocalFile" "${ContainerName}:$ContainerFile"

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to copy $FileName into container."
    }

    $CsvOptions = "WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '`"', ESCAPE '`"', NULL '')"

    $ImportSql = @"
BEGIN;
TRUNCATE TABLE sakai_raw.$QuotedTable;
COPY sakai_raw.$QuotedTable ($ColumnSql)
FROM '$ContainerFile'
$CsvOptions;
COMMIT;
"@

    Invoke-DbSql -Sql $ImportSql

    $CountSql = "SELECT COUNT(*) AS row_count FROM sakai_raw.$QuotedTable;"
    Invoke-DbSql -Sql $CountSql

    Write-Log "SUCCESS: Imported $FileName into sakai_raw.$TableName"
    $ImportedTables++
}

Write-Log "Imported tables: $ImportedTables"
Write-Log "Skipped files: $SkippedFiles"

Write-Log "Refreshing feature store..."
Invoke-DbSql -Sql "SELECT feature_store.refresh_student_course_features();"

Write-Log "Refreshing predictive training diagnostics..."
Invoke-DbSql -Sql "SELECT * FROM predictive.training_dataset_diagnostics;"

Write-Log "Refreshing faculty course auto-mapping if function exists..."
try {
    Invoke-DbSql -Sql "SELECT faculty.refresh_course_faculty_auto_mapping();"
    Write-Log "Faculty auto-mapping refreshed."
}
catch {
    Write-Log "Faculty auto-mapping skipped or unavailable: $($_.Exception.Message)"
}

Write-Log "Scheduled Sakai CSV ETL import completed successfully."
Write-Log "============================================================"