import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./PredictiveAnalyticsPage.css";

const API_BASE_URL = "http://localhost:8000";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
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

function formatNumber(value) {
  const numberValue = Number(value || 0);
  return numberValue.toLocaleString();
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    return "N/A";
  }

  if (numberValue <= 1) {
    return `${Math.round(numberValue * 100)}%`;
  }

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

function getRiskClass(value) {
  const text = String(value || "").toLowerCase();

  if (text.includes("high") || text.includes("risk") || text === "1") {
    return "high";
  }

  if (text.includes("moderate") || text.includes("medium")) {
    return "moderate";
  }

  if (text.includes("low") || text.includes("track") || text === "0") {
    return "on-track";
  }

  return "unknown";
}

function getPredictionLabel(row) {
  if (row.predicted_risk_label) return row.predicted_risk_label;
  if (row.risk_label) return row.risk_label;
  if (row.current_risk_level) return row.current_risk_level;

  if (row.predicted_at_risk === 1 || row.predicted_at_risk === true) {
    return "HIGH RISK";
  }

  if (row.predicted_at_risk === 0 || row.predicted_at_risk === false) {
    return "ON TRACK";
  }

  return "UNKNOWN";
}

function getOverviewValue(summary, names, fallback = 0) {
  for (const name of names) {
    if (summary?.[name] !== undefined && summary?.[name] !== null) {
      return summary[name];
    }
  }

  return fallback;
}

export default function PredictiveAnalyticsPage() {
  const navigate = useNavigate();

  const [overview, setOverview] = useState(null);
  const [activeTab, setActiveTab] = useState("predictions");
  const [loading, setLoading] = useState(true);
  const [runningAction, setRunningAction] = useState("");
  const [message, setMessage] = useState("");

  function loadOverview() {
    setLoading(true);
    setMessage("");

    apiRequest("/predictive/overview")
      .then((data) => {
        setOverview(data || {});
      })
      .catch((err) => {
        setMessage(err.message || "Failed to load predictive analytics overview");
        setOverview({});
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    loadOverview();
  }, []);

  async function runAction(actionName, path) {
    setRunningAction(actionName);
    setMessage("");

    try {
      await apiRequest(path, {
        method: "POST",
      });

      setMessage(`${actionName} completed successfully.`);
      loadOverview();
    } catch (err) {
      setMessage(err.message || `${actionName} failed`);
    } finally {
      setRunningAction("");
    }
  }

  const summary = overview?.summary || overview || {};

  const modelRuns = useMemo(() => {
    return normalizeArray(
      overview?.model_runs ||
        overview?.recent_model_runs ||
        overview?.training_runs ||
        overview?.models
    );
  }, [overview]);

  const predictions = useMemo(() => {
    return normalizeArray(
      overview?.predictions ||
        overview?.recent_predictions ||
        overview?.latest_predictions ||
        overview?.student_predictions
    );
  }, [overview]);

  const featureImportance = useMemo(() => {
    return normalizeArray(
      overview?.feature_importance ||
        overview?.features ||
        overview?.top_features
    );
  }, [overview]);

  const trainingRows = getOverviewValue(summary, [
    "training_rows",
    "model_training_rows",
    "total_training_rows",
  ]);

  const atRiskRows = getOverviewValue(summary, [
    "at_risk_rows",
    "risk_rows",
    "positive_rows",
  ]);

  const notAtRiskRows = getOverviewValue(summary, [
    "not_at_risk_rows",
    "not_risk_rows",
    "negative_rows",
  ]);

  const latestAccuracy = getOverviewValue(summary, [
    "latest_accuracy",
    "accuracy",
    "model_accuracy",
  ], null);

  const totalPredictions = getOverviewValue(summary, [
    "total_predictions",
    "prediction_rows",
    "predictions_generated",
  ], predictions.length);

  const highRiskPredictions = getOverviewValue(summary, [
    "high_risk_predictions",
    "predicted_high_risk",
    "risk_predictions",
  ]);

  const latestModelStatus = getOverviewValue(summary, [
    "latest_model_status",
    "model_status",
    "status",
  ], "UNKNOWN");

  function logout() {
    localStorage.removeItem("sspa_session");
    navigate("/");
  }

  if (loading) {
    return (
      <div className="predictive-dashboard-shell">
        <aside className="predictive-sidebar">
          <div className="predictive-sidebar-brand">
            <div className="predictive-sidebar-logo">
              <span className="material-symbols-rounded">analytics</span>
            </div>

            <div>
              <h2>SSPA</h2>
              <p>NUL Analytics System</p>
            </div>
          </div>
        </aside>

        <main className="predictive-page">
          <div className="predictive-loading">
            <span className="material-symbols-rounded">progress_activity</span>
            Loading predictive analytics dashboard...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="predictive-dashboard-shell">
      <aside className="predictive-sidebar">
        <div className="predictive-sidebar-brand">
          <div className="predictive-sidebar-logo">
            <span className="material-symbols-rounded">analytics</span>
          </div>

          <div>
            <h2>SSPA</h2>
            <p>NUL Analytics System</p>
          </div>
        </div>

        <div className="predictive-sidebar-profile">
          <div className="predictive-profile-avatar">
            <span className="material-symbols-rounded">psychology</span>
          </div>

          <div>
            <h3>Predictive Analytics</h3>
            <p>Risk Model</p>
          </div>
        </div>

        <p className="predictive-sidebar-title">Navigation</p>

        <nav className="predictive-sidebar-nav">
          <button
            type="button"
            className={activeTab === "predictions" ? "active" : ""}
            onClick={() => setActiveTab("predictions")}
          >
            <span className="material-symbols-rounded">monitoring</span>
            Predictions
          </button>

          <button
            type="button"
            className={activeTab === "models" ? "active" : ""}
            onClick={() => setActiveTab("models")}
          >
            <span className="material-symbols-rounded">model_training</span>
            Model Runs
          </button>

          <button
            type="button"
            className={activeTab === "features" ? "active" : ""}
            onClick={() => setActiveTab("features")}
          >
            <span className="material-symbols-rounded">schema</span>
            Feature Importance
          </button>

          <button type="button" onClick={() => navigate("/etl/dashboard")}>
            <span className="material-symbols-rounded">hub</span>
            Feature Store
          </button>

          <button type="button" onClick={() => navigate("/etl/layer1")}>
            <span className="material-symbols-rounded">database</span>
            Layer 1 ETL
          </button>
        </nav>

        <button className="predictive-sidebar-logout" onClick={logout}>
          <span className="material-symbols-rounded">logout</span>
          Logout
        </button>
      </aside>

      <main className="predictive-page">
        <header className="predictive-header">
          <div>
            <span className="predictive-eyebrow">Predictive Analytics</span>
            <h1>Student Risk Prediction Dashboard</h1>
            <p>
              Uses the Layer 2 Feature Store training dataset to train a risk
              model and generate student-course risk predictions.
            </p>
          </div>

          <div className="predictive-header-actions">
            <button
              type="button"
              onClick={() => runAction("Feature refresh", "/feature-store/refresh")}
              disabled={Boolean(runningAction)}
            >
              <span className="material-symbols-rounded">sync</span>
              Refresh Features
            </button>

            <button
              type="button"
              onClick={() => runAction("Model training", "/predictive/train")}
              disabled={Boolean(runningAction)}
            >
              <span className="material-symbols-rounded">model_training</span>
              {runningAction === "Model training" ? "Training..." : "Train Model"}
            </button>

            <button
              type="button"
              onClick={() =>
                runAction("Prediction generation", "/predictive/generate-predictions")
              }
              disabled={Boolean(runningAction)}
            >
              <span className="material-symbols-rounded">online_prediction</span>
              Generate Predictions
            </button>
          </div>
        </header>

        {message && <div className="predictive-message">{message}</div>}

        <section className="predictive-metrics-grid">
          <article className="predictive-metric-card blue">
            <div>
              <span>Training Rows</span>
              <strong>{formatNumber(trainingRows)}</strong>
            </div>
            <span className="material-symbols-rounded">dataset</span>
          </article>

          <article className="predictive-metric-card green">
            <div>
              <span>Latest Accuracy</span>
              <strong>{formatPercent(latestAccuracy)}</strong>
            </div>
            <span className="material-symbols-rounded">query_stats</span>
          </article>

          <article className="predictive-metric-card amber">
            <div>
              <span>Predictions</span>
              <strong>{formatNumber(totalPredictions)}</strong>
            </div>
            <span className="material-symbols-rounded">online_prediction</span>
          </article>

          <article className="predictive-metric-card red">
            <div>
              <span>High Risk</span>
              <strong>{formatNumber(highRiskPredictions)}</strong>
            </div>
            <span className="material-symbols-rounded">priority_high</span>
          </article>
        </section>

        <section className="predictive-status-strip">
          <div>
            <span>At-risk training rows</span>
            <strong>{formatNumber(atRiskRows)}</strong>
          </div>

          <div>
            <span>Not-at-risk training rows</span>
            <strong>{formatNumber(notAtRiskRows)}</strong>
          </div>

          <div>
            <span>Latest model status</span>
            <strong>{latestModelStatus}</strong>
          </div>

          <div>
            <span>Last refreshed</span>
            <strong>
              {formatDate(
                summary.last_refreshed_at ||
                  summary.last_training_at ||
                  summary.generated_at
              )}
            </strong>
          </div>
        </section>

        <section className="predictive-tabs">
          <button
            type="button"
            className={activeTab === "predictions" ? "active" : ""}
            onClick={() => setActiveTab("predictions")}
          >
            Predictions
          </button>

          <button
            type="button"
            className={activeTab === "models" ? "active" : ""}
            onClick={() => setActiveTab("models")}
          >
            Model Runs
          </button>

          <button
            type="button"
            className={activeTab === "features" ? "active" : ""}
            onClick={() => setActiveTab("features")}
          >
            Feature Importance
          </button>
        </section>

        {activeTab === "predictions" && (
          <section className="predictive-panel">
            <div className="predictive-panel-header">
              <div>
                <h2>Latest Student-Course Predictions</h2>
                <p>
                  These rows represent predicted risk per student and course.
                </p>
              </div>

              <button type="button" onClick={loadOverview}>
                Refresh
              </button>
            </div>

            <div className="predictive-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Course</th>
                    <th>Risk</th>
                    <th>Probability</th>
                    <th>Model</th>
                    <th>Generated</th>
                  </tr>
                </thead>

                <tbody>
                  {predictions.length === 0 && (
                    <tr>
                      <td colSpan="6">
                        No predictions found. Refresh features, train the
                        model, then generate predictions.
                      </td>
                    </tr>
                  )}

                  {predictions.map((row, index) => {
                    const riskLabel = getPredictionLabel(row);
                    const riskClass = getRiskClass(riskLabel);

                    return (
                      <tr key={row.prediction_id || `${row.student_number}-${row.course_code}-${index}`}>
                        <td>
                          <strong>{row.student_number || "N/A"}</strong>
                          <small>{row.site_id || ""}</small>
                        </td>

                        <td>
                          <strong>{row.course_code || "N/A"}</strong>
                          <small>{row.course_title || ""}</small>
                        </td>

                        <td>
                          <span className={`predictive-risk-pill ${riskClass}`}>
                            {riskLabel}
                          </span>
                        </td>

                        <td>
                          {formatPercent(
                            row.risk_probability ||
                              row.predicted_probability ||
                              row.probability
                          )}
                        </td>

                        <td>{row.model_name || row.model_version || "N/A"}</td>

                        <td>
                          {formatDate(
                            row.generated_at ||
                              row.predicted_at ||
                              row.created_at
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === "models" && (
          <section className="predictive-panel">
            <div className="predictive-panel-header">
              <div>
                <h2>Model Training Runs</h2>
                <p>
                  Shows model training history, accuracy, and dataset size.
                </p>
              </div>
            </div>

            <div className="predictive-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Run</th>
                    <th>Status</th>
                    <th>Algorithm</th>
                    <th>Accuracy</th>
                    <th>Training Rows</th>
                    <th>Started</th>
                    <th>Finished</th>
                  </tr>
                </thead>

                <tbody>
                  {modelRuns.length === 0 && (
                    <tr>
                      <td colSpan="7">
                        No model training runs found. Click Train Model.
                      </td>
                    </tr>
                  )}

                  {modelRuns.map((run, index) => (
                    <tr key={run.run_id || run.model_id || index}>
                      <td>
                        <strong>
                          {run.run_name ||
                            run.model_name ||
                            run.model_version ||
                            `Run ${index + 1}`}
                        </strong>
                        <small>{run.run_id || run.model_id || ""}</small>
                      </td>

                      <td>
                        <span
                          className={`predictive-status-pill ${String(
                            run.status || ""
                          ).toLowerCase()}`}
                        >
                          {run.status || "UNKNOWN"}
                        </span>
                      </td>

                      <td>{run.algorithm || run.model_type || "Random Forest"}</td>

                      <td>
                        {formatPercent(
                          run.accuracy ||
                            run.test_accuracy ||
                            run.validation_accuracy
                        )}
                      </td>

                      <td>
                        {formatNumber(
                          run.training_rows ||
                            run.train_rows ||
                            run.dataset_rows
                        )}
                      </td>

                      <td>{formatDate(run.started_at || run.created_at)}</td>
                      <td>{formatDate(run.finished_at || run.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === "features" && (
          <section className="predictive-panel">
            <div className="predictive-panel-header">
              <div>
                <h2>Feature Importance</h2>
                <p>
                  Shows which training features are most useful to the current
                  model.
                </p>
              </div>
            </div>

            <div className="predictive-feature-list">
              {featureImportance.length === 0 && (
                <div className="predictive-empty-state">
                  No feature importance records found yet. Train the model
                  first.
                </div>
              )}

              {featureImportance.map((feature, index) => {
                const importance = Number(
                  feature.importance ||
                    feature.feature_importance ||
                    feature.score ||
                    0
                );

                return (
                  <article
                    key={feature.feature_name || feature.name || index}
                    className="predictive-feature-card"
                  >
                    <div>
                      <strong>
                        {feature.feature_name || feature.name || `Feature ${index + 1}`}
                      </strong>
                      <small>
                        Rank {feature.rank || index + 1}
                      </small>
                    </div>

                    <div className="predictive-feature-bar">
                      <span
                        style={{
                          width: `${Math.max(
                            3,
                            Math.min(100, importance <= 1 ? importance * 100 : importance)
                          )}%`,
                        }}
                      />
                    </div>

                    <strong>{formatPercent(importance)}</strong>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}