import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAdvisorDashboard,
  getAdvisorStudentProfile,
} from "../../services/advisorApi";
import { getUnreadAlertCount } from "../../services/notificationApi";
import { downloadReportCsv } from "../../services/reportExportApi";
import "./AdvisorDashboardPage.css";

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "N/A";

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) return "N/A";

  return `${Math.round(numericValue)}%`;
}

function formatDate(value) {
  if (!value) return "N/A";

  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function formatDateTime(value) {
  if (!value) return "N/A";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function getPriorityClass(priority) {
  return String(priority || "").toLowerCase();
}

function getRiskClass(risk) {
  const value = String(risk || "").toLowerCase();

  if (value.includes("high")) return "high";
  if (value.includes("moderate")) return "moderate";
  if (value.includes("track")) return "on-track";

  return "unknown";
}

function extractUnreadAlertCount(data) {
  if (typeof data === "number") return data;

  if (!data || typeof data !== "object") return 0;

  return Number(
    data.unread_count ??
      data.unread ??
      data.count ??
      data.total_unread ??
      0
  );
}

function formatBadgeCount(value) {
  const count = Number(value || 0);

  if (count > 99) return "99+";

  return String(count);
}

export default function AdvisorDashboardPage() {
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState(null);
  const [activeView, setActiveView] = useState("escalated");
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);
  const [selectedStudentNumber, setSelectedStudentNumber] = useState("");
  const [studentProfile, setStudentProfile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [exportingReport, setExportingReport] = useState("");
  const [message, setMessage] = useState("");
  const [exportMessage, setExportMessage] = useState("");

  const session = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("sspa_session"));
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!session || session.role !== "ADVISOR") {
      setUnreadAlertCount(0);
      return;
    }

    let mounted = true;
    const advisorIdentifier =
      session.advisor_identifier ||
      session.advisor_number ||
      session.user_id ||
      "ACADEMIC_ADVISOR";

    getUnreadAlertCount("ADVISOR", String(advisorIdentifier))
      .then((data) => {
        if (mounted) setUnreadAlertCount(extractUnreadAlertCount(data));
      })
      .catch(() => {
        if (mounted) setUnreadAlertCount(0);
      });

    return () => {
      mounted = false;
    };
  }, [session, activeView]);

  function loadDashboard() {
    setLoading(true);
    setMessage("");

    getAdvisorDashboard()
      .then((data) => setDashboard(data || {}))
      .catch((err) => {
        setDashboard({});
        setMessage(err.message || "Failed to load advisor dashboard");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!session || session.role !== "ADVISOR") {
      navigate("/");
      return;
    }

    loadDashboard();
  }, [navigate, session]);

  function logout() {
    localStorage.removeItem("sspa_session");
    navigate("/");
  }

  async function handleDownloadReport(reportType) {
    const configs = {
      atRisk: {
        path: "/reports/at-risk-students.csv",
        filename: "sspa_advisor_at_risk_students.csv",
        params: {},
        success: "At-risk students CSV downloaded.",
      },
      courseSummary: {
        path: "/reports/course-summary.csv",
        filename: "sspa_advisor_course_summary.csv",
        params: {},
        success: "Course summary CSV downloaded.",
      },
      interventions: {
        path: "/reports/interventions.csv",
        filename: "sspa_advisor_interventions.csv",
        params: {},
        success: "Interventions CSV downloaded.",
      },
    };

    const config = configs[reportType];

    if (!config) return;

    setExportingReport(reportType);
    setExportMessage("");

    try {
      await downloadReportCsv(config.path, config.filename, config.params);
      setExportMessage(config.success);
    } catch (err) {
      setExportMessage(err.message || "Failed to download report.");
    } finally {
      setExportingReport("");
    }
  }

  function openStudentProfile(studentNumber) {
    if (!studentNumber) return;

    setSelectedStudentNumber(studentNumber);
    setActiveView("profile");
    setLoadingStudent(true);
    setMessage("");

    getAdvisorStudentProfile(studentNumber)
      .then((data) => setStudentProfile(data || null))
      .catch((err) => {
        setStudentProfile(null);
        setMessage(err.message || "Failed to load student profile");
      })
      .finally(() => setLoadingStudent(false));
  }

  const summary = dashboard?.summary || {};
  const escalatedCases = dashboard?.escalated_cases || [];
  const followUpCases = dashboard?.follow_up_cases || [];
  const highRiskStudents = dashboard?.high_risk_students || [];
  const advisorAlerts = dashboard?.advisor_alerts || [];

  const displayedAdvisorAlertCount = Math.max(
    unreadAlertCount,
    advisorAlerts.filter(
      (alert) => String(alert.status || "") !== "DISMISSED"
    ).length
  );

  const activeCases = useMemo(() => {
    if (activeView === "followups") return followUpCases;
    return escalatedCases;
  }, [activeView, escalatedCases, followUpCases]);

  if (loading) {
    return (
      <div className="advisor-dashboard-shell">
        <aside className="advisor-sidebar">
          <div className="advisor-sidebar-brand">
            <div className="advisor-sidebar-logo">
              <span className="material-symbols-rounded">supervisor_account</span>
            </div>

            <div>
              <h2>SSPA</h2>
              <p>NUL Analytics System</p>
            </div>
          </div>
        </aside>

        <main className="advisor-main">
          <div className="advisor-loading-page">
            <span className="material-symbols-rounded">progress_activity</span>
            Loading advisor dashboard...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="advisor-dashboard-shell">
      <aside className="advisor-sidebar">
        <div className="advisor-sidebar-brand">
          <div className="advisor-sidebar-logo">
            <span className="material-symbols-rounded">supervisor_account</span>
          </div>

          <div>
            <h2>SSPA</h2>
            <p>NUL Analytics System</p>
          </div>
        </div>

        <div className="advisor-sidebar-profile">
          <div className="advisor-profile-avatar">
            <span className="material-symbols-rounded">person_search</span>
          </div>

          <div>
            <h3>Academic Advisor</h3>
            <p>Support Escalation</p>
          </div>
        </div>

        <p className="advisor-sidebar-title">Navigation</p>

        <nav className="advisor-sidebar-nav">
          <button
            type="button"
            className={activeView === "escalated" ? "active" : ""}
            onClick={() => setActiveView("escalated")}
          >
            <span className="material-symbols-rounded">priority_high</span>
            Escalated Cases
          </button>

          <button
            type="button"
            className={activeView === "followups" ? "active" : ""}
            onClick={() => setActiveView("followups")}
          >
            <span className="material-symbols-rounded">event_upcoming</span>
            Follow-up Queue
          </button>

          <button
            type="button"
            className={activeView === "risk" ? "active" : ""}
            onClick={() => setActiveView("risk")}
          >
            <span className="material-symbols-rounded">monitoring</span>
            High-Risk Students
          </button>

          <button
            type="button"
            className={activeView === "alerts" ? "active" : ""}
            onClick={() => setActiveView("alerts")}
          >
            <span className="material-symbols-rounded">notifications</span>
            <span className="sidebar-link-text">Advisor Alerts</span>
            {displayedAdvisorAlertCount > 0 && (
              <span className="sidebar-alert-badge">
                {formatBadgeCount(displayedAdvisorAlertCount)}
              </span>
            )}
          </button>
        </nav>

        <button className="advisor-sidebar-logout" onClick={logout}>
          <span className="material-symbols-rounded">logout</span>
          Logout
        </button>
      </aside>

      <main className="advisor-main">
        <header className="advisor-topbar">
          <div>
            <h1>
              {activeView === "followups"
                ? "Follow-up Queue"
                : activeView === "risk"
                ? "High-Risk Students"
                : activeView === "alerts"
                ? "Advisor Alerts"
                : activeView === "profile"
                ? "Student Support Profile"
                : "Advisor Dashboard"}
            </h1>
            <p>
              Escalated support, follow-up tracking, and high-risk monitoring
              from processed system data.
            </p>
          </div>

          <button type="button" onClick={loadDashboard}>
            <span className="material-symbols-rounded">sync</span>
            Refresh
          </button>
        </header>

        {message && <div className="advisor-dashboard-message">{message}</div>}

        <section className="advisor-export-panel" aria-label="Advisor data export controls">
          <div>
            <h2>Data Exports</h2>
            <p>Download CSV evidence for at-risk students, course summaries, and intervention cases.</p>
          </div>

          <div className="advisor-export-actions">
            <button
              type="button"
              onClick={() => handleDownloadReport("atRisk")}
              disabled={Boolean(exportingReport)}
            >
              <span className="material-symbols-rounded">download</span>
              {exportingReport === "atRisk" ? "Exporting..." : "Export At-Risk Students"}
            </button>

            <button
              type="button"
              onClick={() => handleDownloadReport("courseSummary")}
              disabled={Boolean(exportingReport)}
            >
              <span className="material-symbols-rounded">description</span>
              {exportingReport === "courseSummary" ? "Exporting..." : "Export Course Summary"}
            </button>

            <button
              type="button"
              onClick={() => handleDownloadReport("interventions")}
              disabled={Boolean(exportingReport)}
            >
              <span className="material-symbols-rounded">assignment</span>
              {exportingReport === "interventions" ? "Exporting..." : "Export Interventions"}
            </button>
          </div>
        </section>

        {exportMessage && (
          <div className="advisor-export-message">{exportMessage}</div>
        )}

        <section className="advisor-metrics-grid">
          <article className="advisor-metric-card red">
            <div>
              <span>Escalated Cases</span>
              <strong>{formatNumber(summary.escalated_cases)}</strong>
            </div>
            <span className="material-symbols-rounded">priority_high</span>
          </article>

          <article className="advisor-metric-card amber">
            <div>
              <span>Follow-ups Due</span>
              <strong>{formatNumber(summary.follow_up_due_cases)}</strong>
            </div>
            <span className="material-symbols-rounded">event_upcoming</span>
          </article>

          <article className="advisor-metric-card blue">
            <div>
              <span>High-Risk Students</span>
              <strong>{formatNumber(summary.high_risk_students)}</strong>
            </div>
            <span className="material-symbols-rounded">monitoring</span>
          </article>

          <article className="advisor-metric-card green">
            <div>
              <span>Resolved / Closed</span>
              <strong>{formatNumber(summary.resolved_cases)}</strong>
            </div>
            <span className="material-symbols-rounded">task_alt</span>
          </article>
        </section>

        {(activeView === "escalated" || activeView === "followups") && (
          <section className="advisor-panel">
            <div className="advisor-panel-header">
              <div>
                <h2>
                  {activeView === "followups"
                    ? "Cases Needing Follow-up"
                    : "Escalated / High Priority Cases"}
                </h2>
                <p>
                  Advisor work starts from escalated, urgent, high priority, or
                  follow-up cases.
                </p>
              </div>
            </div>

            <div className="advisor-case-list">
              {activeCases.length === 0 && (
                <div className="advisor-empty-state">
                  No cases found for this section.
                </div>
              )}

              {activeCases.map((caseItem) => (
                <article
                  key={caseItem.case_id}
                  className={`advisor-case-card ${getPriorityClass(
                    caseItem.priority
                  )}`}
                >
                  <div>
                    <strong>{caseItem.student_number}</strong>
                    <small>
                      {caseItem.course_code} · {caseItem.reason}
                    </small>
                  </div>

                  <div>
                    <span>{caseItem.status}</span>
                    <small>{caseItem.priority}</small>
                  </div>

                  <div>
                    <span>{formatDate(caseItem.follow_up_date)}</span>
                    <small>{caseItem.note_count || 0} note(s)</small>
                  </div>

                  <button
                    type="button"
                    onClick={() => openStudentProfile(caseItem.student_number)}
                  >
                    View Student
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeView === "risk" && (
          <section className="advisor-panel">
            <div className="advisor-panel-header">
              <div>
                <h2>High-Risk Student Watchlist</h2>
                <p>
                  Built from the feature store, not from slow live raw-table
                  scans.
                </p>
              </div>
            </div>

            <div className="advisor-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Course</th>
                    <th>Risk</th>
                    <th>Avg Score</th>
                    <th>Assessments</th>
                    <th>Activity</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {highRiskStudents.length === 0 && (
                    <tr>
                      <td colSpan="7">No high-risk students found.</td>
                    </tr>
                  )}

                  {highRiskStudents.map((student, index) => (
                    <tr
                      key={`${student.student_number}-${student.course_code}-${index}`}
                    >
                      <td>
                        <strong>{student.student_number}</strong>
                        <small>{student.site_id}</small>
                      </td>

                      <td>
                        <strong>{student.course_code}</strong>
                        <small>{student.course_title || "N/A"}</small>
                      </td>

                      <td>
                        <span
                          className={`advisor-risk-pill ${getRiskClass(
                            student.current_risk_level
                          )}`}
                        >
                          {student.current_risk_level}
                        </span>
                      </td>

                      <td>{formatPercent(student.avg_assessment_percent)}</td>
                      <td>{formatNumber(student.total_assessment_records)}</td>
                      <td>{formatNumber(student.total_activity_count)}</td>

                      <td>
                        <button
                          type="button"
                          className="advisor-table-action"
                          onClick={() =>
                            openStudentProfile(student.student_number)
                          }
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeView === "alerts" && (
          <section className="advisor-panel">
            <div className="advisor-panel-header">
              <div>
                <h2>Advisor Alerts</h2>
                <p>Unread or active alerts assigned to the advisor role.</p>
              </div>
            </div>

            <div className="advisor-alert-list">
              {advisorAlerts.length === 0 && (
                <div className="advisor-empty-state">
                  No advisor alerts found.
                </div>
              )}

              {advisorAlerts.map((alert) => (
                <article
                  key={alert.alert_id}
                  className={`advisor-alert-card ${String(
                    alert.severity || ""
                  ).toLowerCase()}`}
                >
                  <div>
                    <strong>{alert.title}</strong>
                    <p>{alert.message}</p>
                    <small>
                      {alert.alert_type} · {alert.course_code || "No course"} ·{" "}
                      {formatDateTime(alert.created_at)}
                    </small>
                  </div>

                  <span>{alert.status}</span>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeView === "profile" && (
          <section className="advisor-profile-layout">
            <article className="advisor-panel">
              <div className="advisor-panel-header">
                <div>
                  <h2>Student Support Profile</h2>
                  <p>
                    Student {selectedStudentNumber} across feature store,
                    interventions, and alerts.
                  </p>
                </div>
              </div>

              {loadingStudent && (
                <div className="advisor-empty-state">
                  Loading student support profile...
                </div>
              )}

              {!loadingStudent && !studentProfile && (
                <div className="advisor-empty-state">
                  No student profile loaded.
                </div>
              )}

              {!loadingStudent && studentProfile && (
                <>
                  <div className="advisor-profile-summary">
                    <div>
                      <span>Student Number</span>
                      <strong>{studentProfile.student_number}</strong>
                    </div>

                    <div>
                      <span>Courses Found</span>
                      <strong>{studentProfile.features?.length || 0}</strong>
                    </div>

                    <div>
                      <span>Intervention Cases</span>
                      <strong>{studentProfile.cases?.length || 0}</strong>
                    </div>

                    <div>
                      <span>Alerts</span>
                      <strong>{studentProfile.alerts?.length || 0}</strong>
                    </div>
                  </div>

                  <h3 className="advisor-section-title">Course Risk Profile</h3>

                  <div className="advisor-table-wrap compact">
                    <table>
                      <thead>
                        <tr>
                          <th>Course</th>
                          <th>Risk</th>
                          <th>Avg Score</th>
                          <th>Activity</th>
                          <th>Missing</th>
                        </tr>
                      </thead>

                      <tbody>
                        {(studentProfile.features || []).map((feature) => (
                          <tr key={feature.site_id}>
                            <td>
                              <strong>{feature.course_code}</strong>
                              <small>{feature.course_title || "N/A"}</small>
                            </td>

                            <td>
                              <span
                                className={`advisor-risk-pill ${getRiskClass(
                                  feature.current_risk_level
                                )}`}
                              >
                                {feature.current_risk_level}
                              </span>
                            </td>

                            <td>{formatPercent(feature.avg_assessment_percent)}</td>
                            <td>{formatNumber(feature.total_activity_count)}</td>
                            <td>
                              {formatNumber(feature.missing_assessment_estimate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <h3 className="advisor-section-title">Intervention History</h3>

                  <div className="advisor-case-list compact">
                    {(studentProfile.cases || []).length === 0 && (
                      <div className="advisor-empty-state">
                        No intervention cases for this student.
                      </div>
                    )}

                    {(studentProfile.cases || []).map((caseItem) => (
                      <article
                        key={caseItem.case_id}
                        className={`advisor-case-card ${getPriorityClass(
                          caseItem.priority
                        )}`}
                      >
                        <div>
                          <strong>{caseItem.reason}</strong>
                          <small>
                            {caseItem.course_code} · Created by{" "}
                            {caseItem.created_by_role}{" "}
                            {caseItem.created_by_identifier}
                          </small>
                        </div>

                        <div>
                          <span>{caseItem.status}</span>
                          <small>{caseItem.priority}</small>
                        </div>

                        <div>
                          <span>{formatDate(caseItem.follow_up_date)}</span>
                          <small>{caseItem.note_count || 0} note(s)</small>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </article>
          </section>
        )}
      </main>
    </div>
  );
}