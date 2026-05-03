import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboardPage.css";

const API_BASE_URL = "http://localhost:8000";

const FEATURE_STORE_OVERVIEW_ENDPOINTS = [
  "/feature-store/overview",
  "/etl/feature-store/overview",
  "/etl/dashboard/overview",
];

const FEATURE_STORE_REFRESH_ENDPOINTS = [
  "/feature-store/refresh",
  "/etl/feature-store/refresh",
  "/etl/dashboard/refresh",
];

function getSessionHeaders() {
  try {
    const session = JSON.parse(localStorage.getItem("sspa_session"));
    const accessToken = localStorage.getItem("sspa_access_token");

    const headers = {};

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    if (!session) {
      return headers;
    }

    return {
      ...headers,
      "X-Role": session.role || "",
      "X-User-Id":
        session.user_id ||
        session.userId ||
        session.lecturer_number ||
        session.student_number ||
        "",
      "X-Lecturer-Number": session.lecturer_number || "",
      "X-Student-Number": session.student_number || "",
      "X-Display-Name": session.display_name || session.displayName || "",
    };
  } catch {
    const accessToken = localStorage.getItem("sspa_access_token");
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...getSessionHeaders(),
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();

  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      data?.detail ||
      data?.message ||
      `Request failed with status ${response.status}`;

    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  return data;
}

async function apiRequestFirst(paths, options = {}) {
  const candidates = Array.isArray(paths) ? paths : [paths];
  let lastError = null;

  for (const path of candidates) {
    try {
      return await apiRequest(path, options);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Request failed");
}

function formatNumber(value) {
  const numberValue = Number(value || 0);
  return numberValue.toLocaleString();
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "N/A";

  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return "N/A";

  if (numberValue <= 1) return `${Math.round(numberValue * 100)}%`;
  return `${Math.round(numberValue)}%`;
}

function formatDate(value) {
  if (!value) return "N/A";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (value.items && Array.isArray(value.items)) return value.items;
  if (value.rows && Array.isArray(value.rows)) return value.rows;
  if (value.data && Array.isArray(value.data)) return value.data;
  return [];
}

function getValue(source, keys, fallback = 0) {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null) {
      return source[key];
    }
  }

  return fallback;
}

function getModuleStatus(error, data) {
  if (error) return "ERROR";
  if (!data) return "UNKNOWN";
  return "ONLINE";
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [runningAction, setRunningAction] = useState("");
  const [message, setMessage] = useState("");

  const [layer1, setLayer1] = useState(null);
  const [featureStore, setFeatureStore] = useState(null);
  const [predictive, setPredictive] = useState(null);
  const [alerts, setAlerts] = useState([]);

  const [errors, setErrors] = useState({});

  const session = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("sspa_session"));
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!session || session.role !== "ADMIN") {
      navigate("/");
      return;
    }

    loadAdminDashboard();
  }, [navigate, session]);

  async function loadAdminDashboard() {
    setLoading(true);
    setMessage("");

    const nextErrors = {};

    const [layer1Result, featureResult, predictiveResult, alertsResult] =
      await Promise.allSettled([
        apiRequest("/etl/layer1/overview"),
        apiRequestFirst(FEATURE_STORE_OVERVIEW_ENDPOINTS),
        apiRequest("/predictive/overview"),
        apiRequest("/notifications/alerts"),
      ]);

    if (layer1Result.status === "fulfilled") {
      setLayer1(layer1Result.value || {});
    } else {
      nextErrors.layer1 = layer1Result.reason?.message || "Layer 1 ETL failed";
      setLayer1(null);
    }

    if (featureResult.status === "fulfilled") {
      setFeatureStore(featureResult.value || {});
    } else {
      nextErrors.featureStore =
        featureResult.reason?.message || "Feature Store failed";
      setFeatureStore(null);
    }

    if (predictiveResult.status === "fulfilled") {
      setPredictive(predictiveResult.value || {});
    } else {
      nextErrors.predictive =
        predictiveResult.reason?.message || "Predictive module failed";
      setPredictive(null);
    }

    if (alertsResult.status === "fulfilled") {
      setAlerts(normalizeArray(alertsResult.value));
    } else {
      nextErrors.alerts = alertsResult.reason?.message || "Alerts failed";
      setAlerts([]);
    }

    setErrors(nextErrors);
    setLoading(false);
  }

  async function runAction(actionName, path) {
    setRunningAction(actionName);
    setMessage("");

    try {
      await apiRequestFirst(path, { method: "POST" });
      setMessage(`${actionName} completed successfully.`);
      await loadAdminDashboard();
    } catch (err) {
      setMessage(err.message || `${actionName} failed`);
    } finally {
      setRunningAction("");
    }
  }

  function logout() {
    localStorage.removeItem("sspa_session");
    localStorage.removeItem("sspa_access_token");
    localStorage.removeItem("sspa_token_expires_at");
    navigate("/");
  }

  const layer1Summary = layer1?.summary || layer1 || {};
  const featureSummary = featureStore?.summary || featureStore || {};
  const predictiveSummary = predictive?.summary || predictive || {};

  const rawTables = getValue(layer1Summary, ["total_raw_tables", "raw_tables"]);
  const rawRows = getValue(layer1Summary, ["total_raw_rows", "raw_rows"]);
  const qualityIssues = getValue(layer1Summary, ["active_quality_issues", "quality_issues"]);
  const columnMismatches = getValue(layer1Summary, ["column_mismatch_tables", "column_mismatches"]);

  const featureRows = getValue(featureSummary, ["feature_rows", "student_course_feature_rows", "total_feature_rows"]);
  const trainingRows = getValue(featureSummary, ["training_rows", "model_training_rows", "total_training_rows"]);
  const eligibleRows = getValue(featureSummary, ["model_eligible_rows", "eligible_rows"]);

  const latestAccuracy = getValue(predictiveSummary, ["latest_accuracy", "accuracy", "model_accuracy"], null);
  const totalPredictions = getValue(predictiveSummary, ["total_predictions", "prediction_rows", "predictions_generated"]);
  const highRiskPredictions = getValue(predictiveSummary, ["high_risk_predictions", "predicted_high_risk", "risk_predictions"]);

  const unreadAlerts = alerts.filter((alert) => alert.status === "UNREAD").length;
  const criticalAlerts = alerts.filter((alert) => alert.severity === "CRITICAL").length;

  const modules = [
    {
      key: "layer1",
      name: "Layer 1 ETL",
      description: "Raw Sakai table monitoring, row counts, column checks, and data quality checks.",
      status: getModuleStatus(errors.layer1, layer1),
      route: "/etl/layer1",
      error: errors.layer1,
    },
    {
      key: "featureStore",
      name: "Layer 2 Feature Store",
      description: "Transforms raw data into student-course features and model-training datasets.",
      status: getModuleStatus(errors.featureStore, featureStore),
      route: "/etl/dashboard",
      error: errors.featureStore,
    },
    {
      key: "predictive",
      name: "Predictive Analytics",
      description: "Trains the model and stores student-course risk predictions.",
      status: getModuleStatus(errors.predictive, predictive),
      route: "/predictive-analytics",
      error: errors.predictive,
    },
    {
      key: "alerts",
      name: "Alerts & Notifications",
      description: "Tracks unread, read, dismissed, critical, and intervention-triggered alerts.",
      status: getModuleStatus(errors.alerts, alerts),
      route: null,
      error: errors.alerts,
    },
  ];

  const pageTitle =
    activeView === "overview"
      ? "Admin Dashboard"
      : activeView === "pipeline"
      ? "Data Pipeline Control"
      : activeView === "modules"
      ? "System Modules"
      : "System Alerts";

  if (loading) {
    return (
      <div className="admin-dashboard-shell">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-brand">
            <div className="admin-sidebar-logo">
              <span className="material-symbols-rounded">admin_panel_settings</span>
            </div>
            <div>
              <h2>SSPA</h2>
              <p>NUL Analytics System</p>
            </div>
          </div>
        </aside>

        <main className="admin-main">
          <div className="admin-loading">
            <span className="material-symbols-rounded">progress_activity</span>
            Loading admin dashboard...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <div className="admin-sidebar-logo">
            <span className="material-symbols-rounded">admin_panel_settings</span>
          </div>

          <div>
            <h2>SSPA</h2>
            <p>NUL Analytics System</p>
          </div>
        </div>

        <div className="admin-sidebar-profile">
          <div className="admin-profile-avatar">
            <span className="material-symbols-rounded">shield_person</span>
          </div>

          <div>
            <h3>Administrator</h3>
            <p>{session?.display_name || "System Admin"}</p>
          </div>
        </div>

        <p className="admin-sidebar-title">Navigation</p>

        <nav className="admin-sidebar-nav">
          <button
            type="button"
            className={activeView === "overview" ? "active" : ""}
            onClick={() => setActiveView("overview")}
          >
            <span className="material-symbols-rounded">dashboard</span>
            Overview
          </button>

          <button
            type="button"
            className={activeView === "pipeline" ? "active" : ""}
            onClick={() => setActiveView("pipeline")}
          >
            <span className="material-symbols-rounded">hub</span>
            Data Pipeline
          </button>

          <button
            type="button"
            className={activeView === "modules" ? "active" : ""}
            onClick={() => setActiveView("modules")}
          >
            <span className="material-symbols-rounded">widgets</span>
            Modules
          </button>

          <button
            type="button"
            className={activeView === "alerts" ? "active" : ""}
            onClick={() => setActiveView("alerts")}
          >
            <span className="material-symbols-rounded">notifications</span>
            System Alerts
            {unreadAlerts > 0 && <em>{unreadAlerts}</em>}
          </button>
        </nav>

        <button className="admin-sidebar-logout" onClick={logout}>
          <span className="material-symbols-rounded">logout</span>
          Logout
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="admin-eyebrow">Admin Console</span>
            <h1>{pageTitle}</h1>
            <p>
              Central control panel for ETL health, feature-store readiness,
              predictive analytics, notifications, and user-facing dashboards.
            </p>
          </div>

          <div className="admin-topbar-actions">
            <button type="button" onClick={loadAdminDashboard} disabled={Boolean(runningAction)}>
              <span className="material-symbols-rounded">refresh</span>
              Refresh
            </button>

            <button type="button" onClick={() => navigate("/")}>
              <span className="material-symbols-rounded">home</span>
              Home
            </button>
          </div>
        </header>

        {message && <div className="admin-message">{message}</div>}

        {activeView === "overview" && (
          <>
            <section className="admin-metrics-grid">
              <article className="admin-metric-card blue">
                <div>
                  <span>Raw Rows</span>
                  <strong>{formatNumber(rawRows)}</strong>
                </div>
                <span className="material-symbols-rounded">database</span>
              </article>

              <article className="admin-metric-card green">
                <div>
                  <span>Training Rows</span>
                  <strong>{formatNumber(trainingRows)}</strong>
                </div>
                <span className="material-symbols-rounded">dataset</span>
              </article>

              <article className="admin-metric-card amber">
                <div>
                  <span>Predictions</span>
                  <strong>{formatNumber(totalPredictions)}</strong>
                </div>
                <span className="material-symbols-rounded">online_prediction</span>
              </article>

              <article className="admin-metric-card red">
                <div>
                  <span>Unread Alerts</span>
                  <strong>{formatNumber(unreadAlerts)}</strong>
                </div>
                <span className="material-symbols-rounded">notifications_active</span>
              </article>
            </section>

            <section className="admin-dashboard-grid">
              <article className="admin-panel">
                <div className="admin-panel-header">
                  <div>
                    <h2>System Readiness</h2>
                    <p>Quick view of all critical SSPA modules.</p>
                  </div>
                </div>

                <div className="admin-module-list">
                  {modules.map((module) => (
                    <article key={module.key} className={`admin-module-card ${module.status.toLowerCase()}`}>
                      <div>
                        <strong>{module.name}</strong>
                        <small>{module.description}</small>
                        {module.error && <small className="admin-module-error">{module.error}</small>}
                      </div>

                      <span>{module.status}</span>

                      {module.route && (
                        <button type="button" onClick={() => navigate(module.route)}>
                          Open
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </article>

              <article className="admin-panel">
                <div className="admin-panel-header">
                  <div>
                    <h2>Quick Actions</h2>
                    <p>Run the most important pipeline and model operations.</p>
                  </div>
                </div>

                <div className="admin-action-grid">
                  <button
                    type="button"
                    onClick={() => runAction("Layer 1 ETL monitoring refresh", "/etl/layer1/refresh")}
                    disabled={Boolean(runningAction)}
                  >
                    <span className="material-symbols-rounded">sync</span>
                    Refresh Layer 1 ETL
                  </button>

                  <button
                    type="button"
                    onClick={() => runAction("Feature store refresh", FEATURE_STORE_REFRESH_ENDPOINTS)}
                    disabled={Boolean(runningAction)}
                  >
                    <span className="material-symbols-rounded">schema</span>
                    Refresh Feature Store
                  </button>

                  <button
                    type="button"
                    onClick={() => runAction("Model training", "/predictive/train")}
                    disabled={Boolean(runningAction)}
                  >
                    <span className="material-symbols-rounded">model_training</span>
                    Train Predictive Model
                  </button>

                  <button
                    type="button"
                    onClick={() => runAction("Prediction generation", "/predictive/generate-predictions")}
                    disabled={Boolean(runningAction)}
                  >
                    <span className="material-symbols-rounded">online_prediction</span>
                    Generate Predictions
                  </button>
                </div>
              </article>
            </section>
          </>
        )}

        {activeView === "pipeline" && (
          <>
            <section className="admin-metrics-grid">
              <article className="admin-metric-card blue">
                <div>
                  <span>Raw Tables</span>
                  <strong>{formatNumber(rawTables)}</strong>
                </div>
                <span className="material-symbols-rounded">table_rows</span>
              </article>

              <article className="admin-metric-card green">
                <div>
                  <span>Feature Rows</span>
                  <strong>{formatNumber(featureRows)}</strong>
                </div>
                <span className="material-symbols-rounded">schema</span>
              </article>

              <article className="admin-metric-card amber">
                <div>
                  <span>Quality Issues</span>
                  <strong>{formatNumber(qualityIssues)}</strong>
                </div>
                <span className="material-symbols-rounded">warning</span>
              </article>

              <article className="admin-metric-card red">
                <div>
                  <span>Column Mismatches</span>
                  <strong>{formatNumber(columnMismatches)}</strong>
                </div>
                <span className="material-symbols-rounded">schema</span>
              </article>
            </section>

            <section className="admin-pipeline-grid">
              <article className="admin-panel">
                <div className="admin-panel-header">
                  <h2>Pipeline Flow</h2>
                  <p>Correct flow from raw Sakai data to predictions.</p>
                </div>

                <div className="admin-flow">
                  <div>
                    <span>1</span>
                    <strong>sakai_raw</strong>
                    <small>CSV/imported Sakai raw data</small>
                  </div>

                  <span className="admin-flow-arrow">→</span>

                  <div>
                    <span>2</span>
                    <strong>feature_store</strong>
                    <small>Student-course features and training data</small>
                  </div>

                  <span className="admin-flow-arrow">→</span>

                  <div>
                    <span>3</span>
                    <strong>predictive</strong>
                    <small>Model runs and risk predictions</small>
                  </div>
                </div>
              </article>

              <article className="admin-panel">
                <div className="admin-panel-header">
                  <h2>Training Dataset Health</h2>
                  <p>These numbers tell whether the model has enough data.</p>
                </div>

                <div className="admin-status-grid">
                  <div>
                    <span>Model eligible rows</span>
                    <strong>{formatNumber(eligibleRows)}</strong>
                  </div>

                  <div>
                    <span>Training rows</span>
                    <strong>{formatNumber(trainingRows)}</strong>
                  </div>

                  <div>
                    <span>Latest accuracy</span>
                    <strong>{formatPercent(latestAccuracy)}</strong>
                  </div>

                  <div>
                    <span>High-risk predictions</span>
                    <strong>{formatNumber(highRiskPredictions)}</strong>
                  </div>
                </div>
              </article>
            </section>
          </>
        )}

        {activeView === "modules" && (
          <section className="admin-panel admin-full-panel">
            <div className="admin-panel-header">
              <div>
                <h2>System Modules</h2>
                <p>Open any major SSPA module from one admin view.</p>
              </div>
            </div>

            <div className="admin-module-grid">
              <button type="button" onClick={() => navigate("/etl/layer1")}>
                <span className="material-symbols-rounded">database</span>
                <strong>Layer 1 ETL</strong>
                <small>Raw data monitoring</small>
              </button>

              <button type="button" onClick={() => navigate("/etl/dashboard")}>
                <span className="material-symbols-rounded">schema</span>
                <strong>Layer 2 ETL</strong>
                <small>Feature store</small>
              </button>

              <button type="button" onClick={() => navigate("/predictive-analytics")}>
                <span className="material-symbols-rounded">analytics</span>
                <strong>Predictive Analytics</strong>
                <small>Risk model</small>
              </button>

              <button type="button" onClick={() => navigate("/lecturer/dashboard")}>
                <span className="material-symbols-rounded">person</span>
                <strong>Lecturer Dashboard</strong>
                <small>Course-level monitoring</small>
              </button>

              <button type="button" onClick={() => navigate("/student/dashboard")}>
                <span className="material-symbols-rounded">school</span>
                <strong>Student Dashboard</strong>
                <small>Student self-view</small>
              </button>

              <button type="button" onClick={() => navigate("/advisor/dashboard")}>
                <span className="material-symbols-rounded">supervisor_account</span>
                <strong>Advisor Dashboard</strong>
                <small>Advisory view</small>
              </button>
            </div>
          </section>
        )}

        {activeView === "alerts" && (
          <section className="admin-panel admin-full-panel">
            <div className="admin-panel-header">
              <div>
                <h2>System Alerts</h2>
                <p>Global alert records from the notification schema.</p>
              </div>
            </div>

            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Recipient</th>
                    <th>Title</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Course</th>
                    <th>Created</th>
                  </tr>
                </thead>

                <tbody>
                  {alerts.length === 0 && (
                    <tr>
                      <td colSpan="6">No alerts found.</td>
                    </tr>
                  )}

                  {alerts.map((alert) => (
                    <tr key={alert.alert_id}>
                      <td>
                        <strong>{alert.recipient_role}</strong>
                        <small>{alert.recipient_identifier}</small>
                      </td>
                      <td>
                        <strong>{alert.title}</strong>
                        <small>{alert.message}</small>
                      </td>
                      <td>
                        <span className={`admin-pill ${String(alert.severity || "").toLowerCase()}`}>
                          {alert.severity}
                        </span>
                      </td>
                      <td>{alert.status}</td>
                      <td>{alert.course_code || "N/A"}</td>
                      <td>{formatDate(alert.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
