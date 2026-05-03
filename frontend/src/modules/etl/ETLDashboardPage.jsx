import { useEffect, useMemo, useState } from "react";
import {
  getFeatureCatalog,
  getFeatureRefreshLogs,
  getFeatureStoreCourses,
  getFeatureStoreOverview,
  getStudentCourseFeatures,
  getTrainingDataset,
  logTrainingExport,
  refreshFeatureStore,
} from "../../services/featureStoreApi";
import "./ETLDashboardPage.css";

function formatNumber(value) {
  if (value === null || value === undefined) return "0";

  const number = Number(value);

  if (Number.isNaN(number)) return String(value);

  return number.toLocaleString();
}

function formatPercent(value) {
  if (value === null || value === undefined) return "N/A";

  const number = Number(value);

  if (Number.isNaN(number)) return "N/A";

  return `${Math.round(number * 100)}%`;
}

function formatDate(value) {
  if (!value) return "N/A";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatScore(value) {
  if (value === null || value === undefined) return "N/A";

  const number = Number(value);

  if (Number.isNaN(number)) return "N/A";

  return `${Math.round(number)}%`;
}

export default function ETLDashboardPage() {
  const [activeTab, setActiveTab] = useState("overview");

  const [overview, setOverview] = useState(null);
  const [features, setFeatures] = useState({ rows: [], total_count: 0 });
  const [trainingDataset, setTrainingDataset] = useState({
    rows: [],
    total_count: 0,
  });
  const [courses, setCourses] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [refreshLogs, setRefreshLogs] = useState([]);

  const [riskFilter, setRiskFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [studentFilter, setStudentFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  function loadOverview() {
    return getFeatureStoreOverview().then((data) => {
      setOverview(data);
    });
  }

  function loadFeatureRows() {
    return getStudentCourseFeatures({
      risk_level: riskFilter,
      course_code: courseFilter,
      student_number: studentFilter,
      limit: 100,
      offset: 0,
    }).then((data) => {
      setFeatures(data || { rows: [], total_count: 0 });
    });
  }

  function loadTrainingRows() {
    return getTrainingDataset({
      limit: 100,
      offset: 0,
    }).then((data) => {
      setTrainingDataset(data || { rows: [], total_count: 0 });
    });
  }

  function loadAll() {
    setLoading(true);
    setMessage("");

    Promise.all([
      loadOverview(),
      loadFeatureRows(),
      loadTrainingRows(),
      getFeatureStoreCourses().then((data) => setCourses(data || [])),
      getFeatureCatalog().then((data) => setCatalog(data || [])),
      getFeatureRefreshLogs(20).then((data) => setRefreshLogs(data || [])),
    ])
      .catch((err) => {
        setMessage(err.message || "Failed to load ETL feature store data");
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    loadFeatureRows().catch((err) => {
      setMessage(err.message || "Failed to load feature rows");
    });
  }, [riskFilter, courseFilter, studentFilter]);

  async function handleRefresh() {
    setRefreshing(true);
    setMessage("");

    try {
      await refreshFeatureStore();
      await loadAll();
      setMessage("Feature store refreshed successfully.");
    } catch (err) {
      setMessage(err.message || "Feature refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleExportLog() {
    setMessage("");

    try {
      await logTrainingExport(
        "FRONTEND",
        "Training dataset export/check requested from ETL dashboard"
      );
      await loadAll();
      setMessage("Training export log created successfully.");
    } catch (err) {
      setMessage(err.message || "Failed to log training export.");
    }
  }

  const overviewData = overview?.overview || {};
  const trainingSummary = overview?.training_summary || {};
  const riskDistribution = overview?.risk_distribution || [];
  const qualitySummary = overview?.quality_summary || [];
  const courseSummary = overview?.course_summary || [];
  const latestRefresh = overview?.latest_refresh || {};

  const targetBalanceText = useMemo(() => {
    const atRisk = Number(trainingSummary.at_risk_rows || 0);
    const notAtRisk = Number(trainingSummary.not_at_risk_rows || 0);
    const total = atRisk + notAtRisk;

    if (total === 0) return "No labels yet";

    return `${formatNumber(atRisk)} at risk / ${formatNumber(
      notAtRisk
    )} not at risk`;
  }, [trainingSummary]);

  return (
    <main className="etl-page">
      <aside className="etl-sidebar">
        <div className="etl-brand">
          <div className="etl-logo">
            <span className="material-symbols-rounded">schema</span>
          </div>

          <div>
            <h2>SSPA</h2>
            <p>Layer 2 ETL</p>
          </div>
        </div>

        <p className="etl-sidebar-title">Feature Store</p>

        <nav className="etl-nav">
          <button
            type="button"
            className={activeTab === "overview" ? "active" : ""}
            onClick={() => setActiveTab("overview")}
          >
            <span className="material-symbols-rounded">dashboard</span>
            Overview
          </button>

          <button
            type="button"
            className={activeTab === "features" ? "active" : ""}
            onClick={() => setActiveTab("features")}
          >
            <span className="material-symbols-rounded">table_view</span>
            Student Features
          </button>

          <button
            type="button"
            className={activeTab === "training" ? "active" : ""}
            onClick={() => setActiveTab("training")}
          >
            <span className="material-symbols-rounded">model_training</span>
            Training Dataset
          </button>

          <button
            type="button"
            className={activeTab === "quality" ? "active" : ""}
            onClick={() => setActiveTab("quality")}
          >
            <span className="material-symbols-rounded">fact_check</span>
            Quality Checks
          </button>

          <button
            type="button"
            className={activeTab === "catalog" ? "active" : ""}
            onClick={() => setActiveTab("catalog")}
          >
            <span className="material-symbols-rounded">list_alt</span>
            Feature Catalog
          </button>
        </nav>
      </aside>

      <section className="etl-main">
        <header className="etl-topbar">
          <div>
            <h1>Feature Store ETL</h1>
            <p>
              Transform Sakai raw tables into machine-learning-ready student
              course features.
            </p>
          </div>

          <div className="etl-actions">
            <button type="button" onClick={handleExportLog}>
              Log Training Export
            </button>

            <button type="button" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? "Refreshing..." : "Refresh Features"}
            </button>
          </div>
        </header>

        {message && <div className="etl-message">{message}</div>}

        {loading && <div className="etl-empty">Loading feature store...</div>}

        {!loading && (
          <>
            {activeTab === "overview" && (
              <>
                <section className="etl-metrics-grid">
                  <article className="etl-metric-card blue">
                    <div>
                      <span>Feature Rows</span>
                      <strong>
                        {formatNumber(overviewData.total_feature_rows)}
                      </strong>
                    </div>
                    <span className="material-symbols-rounded">dataset</span>
                  </article>

                  <article className="etl-metric-card green">
                    <div>
                      <span>Training Rows</span>
                      <strong>{formatNumber(overviewData.training_rows)}</strong>
                    </div>
                    <span className="material-symbols-rounded">
                      model_training
                    </span>
                  </article>

                  <article className="etl-metric-card amber">
                    <div>
                      <span>Model Eligible</span>
                      <strong>
                        {formatNumber(overviewData.model_eligible_rows)}
                      </strong>
                    </div>
                    <span className="material-symbols-rounded">
                      rule_settings
                    </span>
                  </article>

                  <article className="etl-metric-card red">
                    <div>
                      <span>High Risk Rows</span>
                      <strong>{formatNumber(overviewData.high_risk_rows)}</strong>
                    </div>
                    <span className="material-symbols-rounded">warning</span>
                  </article>
                </section>

                <section className="etl-grid">
                  <article className="etl-panel">
                    <div className="etl-panel-header">
                      <h2>Latest Refresh</h2>
                      <p>Status of the latest feature generation run.</p>
                    </div>

                    <div className="etl-summary-grid">
                      <div>
                        <span>Status</span>
                        <strong>{latestRefresh.status || "N/A"}</strong>
                      </div>

                      <div>
                        <span>Rows Generated</span>
                        <strong>{formatNumber(latestRefresh.rows_generated)}</strong>
                      </div>

                      <div>
                        <span>Started</span>
                        <strong>{formatDate(latestRefresh.started_at)}</strong>
                      </div>

                      <div>
                        <span>Finished</span>
                        <strong>{formatDate(latestRefresh.finished_at)}</strong>
                      </div>
                    </div>

                    {latestRefresh.error_message && (
                      <div className="etl-error-box">
                        {latestRefresh.error_message}
                      </div>
                    )}
                  </article>

                  <article className="etl-panel">
                    <div className="etl-panel-header">
                      <h2>Training Target Balance</h2>
                      <p>Balance of the model target labels.</p>
                    </div>

                    <div className="etl-summary-grid">
                      <div>
                        <span>Training Rows</span>
                        <strong>{formatNumber(trainingSummary.training_rows)}</strong>
                      </div>

                      <div>
                        <span>At Risk</span>
                        <strong>{formatNumber(trainingSummary.at_risk_rows)}</strong>
                      </div>

                      <div>
                        <span>Not At Risk</span>
                        <strong>
                          {formatNumber(trainingSummary.not_at_risk_rows)}
                        </strong>
                      </div>

                      <div>
                        <span>At Risk Rate</span>
                        <strong>{formatPercent(trainingSummary.at_risk_rate)}</strong>
                      </div>
                    </div>

                    <p className="etl-muted">{targetBalanceText}</p>
                  </article>
                </section>

                <section className="etl-panel">
                  <div className="etl-panel-header">
                    <h2>Risk Distribution</h2>
                    <p>Current risk classification after feature generation.</p>
                  </div>

                  <div className="etl-pill-row">
                    {riskDistribution.map((risk) => (
                      <span
                        key={risk.current_risk_level}
                        className={`etl-risk-pill ${String(
                          risk.current_risk_level || ""
                        ).toLowerCase()}`}
                      >
                        {risk.current_risk_level}:{" "}
                        {formatNumber(risk.row_count)}
                      </span>
                    ))}
                  </div>
                </section>

                <section className="etl-panel">
                  <div className="etl-panel-header">
                    <h2>Top Course Feature Summary</h2>
                    <p>Courses with generated student-course features.</p>
                  </div>

                  <div className="etl-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Course</th>
                          <th>Students</th>
                          <th>Avg Assessment</th>
                          <th>High</th>
                          <th>Moderate</th>
                          <th>Eligible</th>
                        </tr>
                      </thead>

                      <tbody>
                        {courseSummary.map((course) => (
                          <tr key={course.course_code}>
                            <td>
                              <strong>{course.course_code}</strong>
                              <small>{course.course_title || "N/A"}</small>
                            </td>
                            <td>{formatNumber(course.student_count)}</td>
                            <td>{formatScore(course.avg_assessment_percent)}</td>
                            <td>{formatNumber(course.high_risk_count)}</td>
                            <td>{formatNumber(course.moderate_risk_count)}</td>
                            <td>{formatNumber(course.model_eligible_count)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {activeTab === "features" && (
              <section className="etl-panel etl-fill-panel">
                <div className="etl-panel-header split">
                  <div>
                    <h2>Student-Course Features</h2>
                    <p>
                      Aggregated features generated from Sakai raw assessment
                      and engagement tables.
                    </p>
                  </div>

                  <div className="etl-filters">
                    <select
                      value={riskFilter}
                      onChange={(event) => setRiskFilter(event.target.value)}
                    >
                      <option value="">All risks</option>
                      <option value="HIGH">High</option>
                      <option value="MODERATE">Moderate</option>
                      <option value="ON_TRACK">On track</option>
                      <option value="UNKNOWN">Unknown</option>
                    </select>

                    <select
                      value={courseFilter}
                      onChange={(event) => setCourseFilter(event.target.value)}
                    >
                      <option value="">All courses</option>
                      {courses.map((course) => (
                        <option
                          key={course.course_code}
                          value={course.course_code}
                        >
                          {course.course_code}
                        </option>
                      ))}
                    </select>

                    <input
                      value={studentFilter}
                      onChange={(event) => setStudentFilter(event.target.value)}
                      placeholder="Student number"
                    />
                  </div>
                </div>

                <p className="etl-muted">
                  Showing {formatNumber(features.rows?.length || 0)} of{" "}
                  {formatNumber(features.total_count)} feature rows.
                </p>

                <div className="etl-table-wrap large">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Course</th>
                        <th>Avg Assessment</th>
                        <th>Assessments</th>
                        <th>Missing</th>
                        <th>Activity</th>
                        <th>Target</th>
                        <th>Risk</th>
                        <th>Eligible</th>
                      </tr>
                    </thead>

                    <tbody>
                      {features.rows?.map((row) => (
                        <tr key={`${row.student_number}-${row.site_id}`}>
                          <td>{row.student_number}</td>
                          <td>
                            <strong>{row.course_code}</strong>
                            <small>{row.site_id}</small>
                          </td>
                          <td>{formatScore(row.avg_assessment_percent)}</td>
                          <td>{formatNumber(row.total_assessment_records)}</td>
                          <td>{formatNumber(row.missing_assessment_estimate)}</td>
                          <td>{formatNumber(row.total_activity_count)}</td>
                          <td>
                            {row.target_at_risk === null
                              ? "N/A"
                              : row.target_at_risk === 1
                              ? "At risk"
                              : "Not at risk"}
                          </td>
                          <td>
                            <span
                              className={`etl-risk-pill ${String(
                                row.current_risk_level || ""
                              ).toLowerCase()}`}
                            >
                              {row.current_risk_level}
                            </span>
                          </td>
                          <td>{row.model_eligible ? "Yes" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab === "training" && (
              <section className="etl-panel etl-fill-panel">
                <div className="etl-panel-header">
                  <h2>Model Training Dataset</h2>
                  <p>
                    ML-ready rows where a target label is available. This is the
                    dataset the predictive module should train from.
                  </p>
                </div>

                <div className="etl-summary-grid">
                  <div>
                    <span>Total Training Rows</span>
                    <strong>{formatNumber(trainingDataset.total_count)}</strong>
                  </div>

                  <div>
                    <span>At Risk Rows</span>
                    <strong>{formatNumber(trainingSummary.at_risk_rows)}</strong>
                  </div>

                  <div>
                    <span>Not At Risk Rows</span>
                    <strong>
                      {formatNumber(trainingSummary.not_at_risk_rows)}
                    </strong>
                  </div>

                  <div>
                    <span>At Risk Rate</span>
                    <strong>{formatPercent(trainingSummary.at_risk_rate)}</strong>
                  </div>
                </div>

                <div className="etl-table-wrap large">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Course</th>
                        <th>Avg Assessment</th>
                        <th>Gradebook</th>
                        <th>Tests</th>
                        <th>Assignments</th>
                        <th>Activity</th>
                        <th>Coursework</th>
                        <th>Target</th>
                      </tr>
                    </thead>

                    <tbody>
                      {trainingDataset.rows?.map((row) => (
                        <tr key={`${row.student_number}-${row.site_id}`}>
                          <td>{row.student_number}</td>
                          <td>{row.course_code}</td>
                          <td>{formatScore(row.avg_assessment_percent)}</td>
                          <td>{formatScore(row.avg_gradebook_percent)}</td>
                          <td>{formatScore(row.avg_test_percent)}</td>
                          <td>{formatScore(row.avg_assignment_percent)}</td>
                          <td>{formatNumber(row.total_activity_count)}</td>
                          <td>{formatScore(row.coursework_percent)}</td>
                          <td>
                            <span
                              className={
                                row.target_at_risk === 1
                                  ? "etl-target-risk"
                                  : "etl-target-safe"
                              }
                            >
                              {row.target_at_risk === 1
                                ? "At risk"
                                : "Not at risk"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab === "quality" && (
              <>
                <section className="etl-panel">
                  <div className="etl-panel-header">
                    <h2>Data Quality Checks</h2>
                    <p>
                      These checks show whether the generated features are ready
                      for dashboards and model training.
                    </p>
                  </div>

                  <div className="etl-quality-grid">
                    {qualitySummary.map((item) => (
                      <article
                        key={item.check_code}
                        className={`etl-quality-card ${String(
                          item.severity || ""
                        ).toLowerCase()}`}
                      >
                        <span>{item.severity}</span>
                        <strong>{item.check_name}</strong>
                        <p>{formatNumber(item.affected_rows)} affected rows</p>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="etl-panel">
                  <div className="etl-panel-header">
                    <h2>Refresh Logs</h2>
                    <p>Recent feature generation runs.</p>
                  </div>

                  <div className="etl-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Rows</th>
                          <th>Started</th>
                          <th>Finished</th>
                          <th>Error</th>
                        </tr>
                      </thead>

                      <tbody>
                        {refreshLogs.map((log) => (
                          <tr key={log.refresh_id}>
                            <td>{log.status}</td>
                            <td>{formatNumber(log.rows_generated)}</td>
                            <td>{formatDate(log.started_at)}</td>
                            <td>{formatDate(log.finished_at)}</td>
                            <td>{log.error_message || "None"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {activeTab === "catalog" && (
              <section className="etl-panel etl-fill-panel">
                <div className="etl-panel-header">
                  <h2>Feature Catalog</h2>
                  <p>
                    Definitions of the training features produced by layer 2
                    ETL.
                  </p>
                </div>

                <div className="etl-table-wrap large">
                  <table>
                    <thead>
                      <tr>
                        <th>Feature</th>
                        <th>Group</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th>Training</th>
                      </tr>
                    </thead>

                    <tbody>
                      {catalog.map((feature) => (
                        <tr key={feature.feature_name}>
                          <td>
                            <strong>{feature.feature_name}</strong>
                          </td>
                          <td>{feature.feature_group}</td>
                          <td>{feature.data_type}</td>
                          <td>{feature.description}</td>
                          <td>{feature.used_for_training ? "Yes" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}
