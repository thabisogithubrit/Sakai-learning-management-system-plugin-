import { useEffect, useMemo, useState } from "react";
import {
  getLayer1ETLOverview,
  refreshLayer1ETLMonitoring,
} from "../../services/etlApi";
import "./Layer1ETLDashboardPage.css";

function formatNumber(value) {
  const numberValue = Number(value || 0);

  return numberValue.toLocaleString();
}

function formatDate(value) {
  if (!value) {
    return "N/A";
  }

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function normalizeJsonArray(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function Layer1ETLDashboardPage() {
  const [overview, setOverview] = useState(null);
  const [activeTab, setActiveTab] = useState("tables");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  function loadOverview() {
    setLoading(true);
    setMessage("");

    getLayer1ETLOverview()
      .then((data) => setOverview(data))
      .catch((err) => setMessage(err.message || "Failed to load ETL overview"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadOverview();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setMessage("");

    try {
      const data = await refreshLayer1ETLMonitoring();
      setOverview(data);
      setMessage("Layer 1 ETL monitoring refreshed successfully.");
    } catch (err) {
      setMessage(err.message || "Failed to refresh Layer 1 ETL monitoring");
    } finally {
      setRefreshing(false);
    }
  }

  const summary = overview?.summary || {};
  const tableProfiles = overview?.table_profiles || [];
  const qualityChecks = overview?.quality_checks || [];
  const recentRuns = overview?.recent_runs || [];

  const failedChecks = useMemo(() => {
    return qualityChecks.filter((check) =>
      ["WARNING", "FAIL"].includes(check.status)
    );
  }, [qualityChecks]);

  if (loading) {
    return (
      <main className="layer1-page">
        <div className="layer1-loading">
          <span className="material-symbols-rounded">progress_activity</span>
          Loading Layer 1 ETL dashboard...
        </div>
      </main>
    );
  }

  return (
    <main className="layer1-page">
      <header className="layer1-header">
        <div>
          <span className="layer1-eyebrow">ETL Module</span>
          <h1>Layer 1 ETL — Raw Data Monitoring</h1>
          <p>
            Tracks Sakai raw tables, schema readiness, import runs, and data
            quality issues before the feature store transforms data for model
            training.
          </p>
        </div>

        <button type="button" onClick={handleRefresh} disabled={refreshing}>
          <span className="material-symbols-rounded">sync</span>
          {refreshing ? "Refreshing..." : "Refresh Monitoring"}
        </button>
      </header>

      {message && <div className="layer1-message">{message}</div>}

      <section className="layer1-metrics-grid">
        <article className="layer1-metric-card blue">
          <div>
            <span>Raw Tables</span>
            <strong>{formatNumber(summary.total_raw_tables)}</strong>
          </div>
          <span className="material-symbols-rounded">database</span>
        </article>

        <article className="layer1-metric-card green">
          <div>
            <span>Total Raw Rows</span>
            <strong>{formatNumber(summary.total_raw_rows)}</strong>
          </div>
          <span className="material-symbols-rounded">table_rows</span>
        </article>

        <article className="layer1-metric-card amber">
          <div>
            <span>Quality Issues</span>
            <strong>{formatNumber(summary.active_quality_issues)}</strong>
          </div>
          <span className="material-symbols-rounded">warning</span>
        </article>

        <article className="layer1-metric-card red">
          <div>
            <span>Column Mismatches</span>
            <strong>{formatNumber(summary.column_mismatch_tables)}</strong>
          </div>
          <span className="material-symbols-rounded">schema</span>
        </article>
      </section>

      <section className="layer1-status-strip">
        <div>
          <span>Ready tables</span>
          <strong>{formatNumber(summary.ready_tables)}</strong>
        </div>

        <div>
          <span>Empty tables</span>
          <strong>{formatNumber(summary.empty_tables)}</strong>
        </div>

        <div>
          <span>Missing tables</span>
          <strong>{formatNumber(summary.missing_tables)}</strong>
        </div>

        <div>
          <span>Last profile refresh</span>
          <strong>{formatDate(summary.last_profile_refresh)}</strong>
        </div>
      </section>

      <section className="layer1-tabs">
        <button
          type="button"
          className={activeTab === "tables" ? "active" : ""}
          onClick={() => setActiveTab("tables")}
        >
          Raw Table Status
        </button>

        <button
          type="button"
          className={activeTab === "quality" ? "active" : ""}
          onClick={() => setActiveTab("quality")}
        >
          Data Quality Checks
          {failedChecks.length > 0 && <span>{failedChecks.length}</span>}
        </button>

        <button
          type="button"
          className={activeTab === "runs" ? "active" : ""}
          onClick={() => setActiveTab("runs")}
        >
          Refresh Runs
        </button>
      </section>

      {activeTab === "tables" && (
        <section className="layer1-panel">
          <div className="layer1-panel-header">
            <div>
              <h2>Sakai Raw Table Profiles</h2>
              <p>
                Confirms whether each raw table exists, has rows, and matches
                expected CSV columns.
              </p>
            </div>
          </div>

          <div className="layer1-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Status</th>
                  <th>Rows</th>
                  <th>Columns</th>
                  <th>Column Status</th>
                  <th>Missing</th>
                  <th>Extra</th>
                  <th>Checked</th>
                </tr>
              </thead>

              <tbody>
                {tableProfiles.map((profile) => {
                  const missing = normalizeJsonArray(
                    profile.missing_expected_columns
                  );
                  const extra = normalizeJsonArray(profile.extra_columns);

                  return (
                    <tr key={`${profile.schema_name}.${profile.table_name}`}>
                      <td>
                        <strong>{profile.table_name}</strong>
                        <small>{profile.schema_name}</small>
                      </td>
                      <td>
                        <span
                          className={`layer1-pill ${String(
                            profile.status || ""
                          ).toLowerCase()}`}
                        >
                          {profile.status}
                        </span>
                      </td>
                      <td>{formatNumber(profile.row_count)}</td>
                      <td>{formatNumber(profile.column_count)}</td>
                      <td>{profile.column_status}</td>
                      <td>{missing.length === 0 ? "None" : missing.join(", ")}</td>
                      <td>{extra.length === 0 ? "None" : extra.join(", ")}</td>
                      <td>{formatDate(profile.last_checked_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "quality" && (
        <section className="layer1-panel">
          <div className="layer1-panel-header">
            <div>
              <h2>Data Quality Checks</h2>
              <p>
                Checks for invalid IDs, invalid numeric values, duplicates, and
                relationship gaps between raw Sakai tables.
              </p>
            </div>
          </div>

          <div className="layer1-quality-list">
            {qualityChecks.map((check) => (
              <article
                key={check.check_key}
                className={`layer1-quality-card ${String(
                  check.severity || ""
                ).toLowerCase()}`}
              >
                <div>
                  <strong>{check.check_name}</strong>
                  <p>{check.result_summary}</p>
                  <small>
                    {check.check_category} · {check.affected_table || "N/A"} ·{" "}
                    {formatDate(check.checked_at)}
                  </small>
                </div>

                <div>
                  <span
                    className={`layer1-pill ${String(
                      check.status || ""
                    ).toLowerCase()}`}
                  >
                    {check.status}
                  </span>
                  <strong>{formatNumber(check.affected_rows)}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === "runs" && (
        <section className="layer1-panel">
          <div className="layer1-panel-header">
            <div>
              <h2>Layer 1 Refresh Runs</h2>
              <p>
                Each refresh records an ETL monitoring run, even if the raw data
                was imported manually in pgAdmin or Docker.
              </p>
            </div>
          </div>

          <div className="layer1-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Run Name</th>
                  <th>Status</th>
                  <th>Triggered By</th>
                  <th>Started</th>
                  <th>Finished</th>
                  <th>Notes</th>
                </tr>
              </thead>

              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.run_id}>
                    <td>
                      <strong>{run.run_name}</strong>
                      <small>{run.run_id}</small>
                    </td>
                    <td>
                      <span
                        className={`layer1-pill ${String(
                          run.status || ""
                        ).toLowerCase()}`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td>{run.triggered_by}</td>
                    <td>{formatDate(run.started_at)}</td>
                    <td>{formatDate(run.finished_at)}</td>
                    <td>{run.notes || "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
