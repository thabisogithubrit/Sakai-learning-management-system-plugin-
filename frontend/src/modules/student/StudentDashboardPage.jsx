import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStudentDashboard } from "../../services/studentApi";
import { getStudentInterventionCases } from "../../services/interventionApi";
import { getUnreadAlertCount } from "../../services/notificationApi";
import AlertsPage from "../shared/AlertsPage";
import "./StudentDashboardPage.css";

function getRiskLevelFromScore(score) {
  if (score === null || score === undefined) return "unknown";

  const value = Number(score);

  if (Number.isNaN(value)) return "unknown";
  if (value < 50) return "high";
  if (value < 65) return "moderate";

  return "on-track";
}

function formatScore(score) {
  if (score === null || score === undefined) return "N/A";

  const value = Number(score);

  if (Number.isNaN(value)) return "N/A";

  return `${Math.round(value)}%`;
}

function getStudentName(profile) {
  if (!profile) return "Student";

  const firstName = profile.first_name || "";
  const lastName = profile.last_name || "";
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || profile.student_number || "Student";
}

function sourceMatches(score, sourceName) {
  return String(score.source || "").toLowerCase() === sourceName.toLowerCase();
}

function formatDate(value) {
  if (!value) return "N/A";

  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function formatPoints(score) {
  const earned = score.points_earned || "N/A";
  const possible = score.points_possible || "N/A";

  return `${earned} / ${possible}`;
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

export default function StudentDashboardPage() {
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState("overview");
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);

  const [dashboard, setDashboard] = useState(null);
  const [activeCourse, setActiveCourse] = useState("");
  const [activeSource, setActiveSource] = useState("Gradebook");
  const [assessmentCourseFilter, setAssessmentCourseFilter] = useState("ALL");
  const [assessmentSourceFilter, setAssessmentSourceFilter] = useState("ALL");
  const [selectedScore, setSelectedScore] = useState(null);

  const [interventionCases, setInterventionCases] = useState([]);
  const [loadingInterventions, setLoadingInterventions] = useState(false);
  const [interventionError, setInterventionError] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const session = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("sspa_session"));
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!session?.student_number) {
      setUnreadAlertCount(0);
      return;
    }

    let mounted = true;

    getUnreadAlertCount("STUDENT", String(session.student_number))
      .then((data) => {
        if (mounted) setUnreadAlertCount(extractUnreadAlertCount(data));
      })
      .catch(() => {
        if (mounted) setUnreadAlertCount(0);
      });

    return () => {
      mounted = false;
    };
  }, [session?.student_number, activeView]);

  useEffect(() => {
    if (!session || session.role !== "STUDENT" || !session.student_number) {
      navigate("/");
      return;
    }

    setLoading(true);
    setError("");

    getStudentDashboard(session.student_number)
      .then((data) => {
        setDashboard(data);

        if (data?.courses?.length > 0) {
          setActiveCourse(data.courses[0].course_code);
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load student dashboard");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [navigate, session]);

  useEffect(() => {
    if (!session?.student_number) return;

    setLoadingInterventions(true);
    setInterventionError("");

    getStudentInterventionCases(session.student_number)
      .then((cases) => {
        setInterventionCases(cases || []);
      })
      .catch((err) => {
        setInterventionError(err.message || "Failed to load interventions");
      })
      .finally(() => {
        setLoadingInterventions(false);
      });
  }, [session?.student_number]);

  const profile = dashboard?.profile || session?.profile || null;
  const courses = dashboard?.courses || [];

  const activity = dashboard?.activity || {
    login_count: 0,
    resource_count: 0,
    total_activity: 0,
  };

  const recentScores = dashboard?.recent_scores || [];

  const activeCourseData =
    courses.find((course) => course.course_code === activeCourse) || null;

  const activeCourseScores = recentScores.filter(
    (score) => score.course_code === activeCourse
  );

  const gradebookScores = activeCourseScores.filter((score) =>
    sourceMatches(score, "Gradebook")
  );

  const testScores = activeCourseScores.filter((score) =>
    sourceMatches(score, "Test")
  );

  const assignmentScores = activeCourseScores.filter((score) =>
    sourceMatches(score, "Assignment")
  );

  const selectedSourceScores =
    activeSource === "Gradebook"
      ? gradebookScores
      : activeSource === "Test"
      ? testScores
      : assignmentScores;

  const assessmentSummary = useMemo(() => {
    const scoredAssessments = recentScores.filter(
      (score) =>
        score.percent_score !== null &&
        score.percent_score !== undefined &&
        !Number.isNaN(Number(score.percent_score))
    );

    const averageScore =
      scoredAssessments.length === 0
        ? null
        : scoredAssessments.reduce(
            (sum, score) => sum + Number(score.percent_score),
            0
          ) / scoredAssessments.length;

    return {
      total: recentScores.length,
      gradebook: recentScores.filter((score) =>
        sourceMatches(score, "Gradebook")
      ).length,
      tests: recentScores.filter((score) => sourceMatches(score, "Test"))
        .length,
      assignments: recentScores.filter((score) =>
        sourceMatches(score, "Assignment")
      ).length,
      averageScore,
    };
  }, [recentScores]);

  const filteredAssessments = useMemo(() => {
    return recentScores.filter((score) => {
      const matchesCourse =
        assessmentCourseFilter === "ALL" ||
        score.course_code === assessmentCourseFilter;

      const matchesSource =
        assessmentSourceFilter === "ALL" ||
        sourceMatches(score, assessmentSourceFilter);

      return matchesCourse && matchesSource;
    });
  }, [recentScores, assessmentCourseFilter, assessmentSourceFilter]);

  const summary = useMemo(() => {
    const scoredCourses = courses.filter(
      (course) =>
        course.avg_score !== null &&
        course.avg_score !== undefined &&
        !Number.isNaN(Number(course.avg_score))
    );

    const averageScore =
      scoredCourses.length === 0
        ? null
        : scoredCourses.reduce(
            (sum, course) => sum + Number(course.avg_score),
            0
          ) / scoredCourses.length;

    const moderate = courses.filter(
      (course) => getRiskLevelFromScore(course.avg_score) === "moderate"
    ).length;

    const highRisk = courses.filter(
      (course) => getRiskLevelFromScore(course.avg_score) === "high"
    ).length;

    return {
      totalCourses: courses.length,
      averageScore,
      moderate,
      highRisk,
    };
  }, [courses]);

  const interventionSummary = useMemo(() => {
    return interventionCases.reduce(
      (summaryData, caseItem) => {
        summaryData.total += 1;

        if (caseItem.status === "OPEN") summaryData.open += 1;
        if (caseItem.status === "IN_PROGRESS") summaryData.inProgress += 1;
        if (caseItem.status === "ESCALATED") summaryData.escalated += 1;

        if (caseItem.status === "RESOLVED" || caseItem.status === "CLOSED") {
          summaryData.resolved += 1;
        }

        return summaryData;
      },
      {
        total: 0,
        open: 0,
        inProgress: 0,
        escalated: 0,
        resolved: 0,
      }
    );
  }, [interventionCases]);

  function logout() {
    localStorage.removeItem("sspa_session");
    navigate("/");
  }

  function getPageTitle() {
    if (activeView === "assessments") return "My Assessments";
    if (activeView === "interventions") return "My Interventions";
    if (activeView === "alerts") return "My Alerts";

    return "Student Dashboard";
  }

  if (loading) {
    return (
      <div className="student-loading-page">
        <span className="material-symbols-rounded">progress_activity</span>
        Loading student dashboard...
      </div>
    );
  }

  return (
    <div className="student-dashboard-shell">
      <aside className="student-sidebar">
        <div className="student-sidebar-brand">
          <div className="student-sidebar-logo">
            <span className="material-symbols-rounded">school</span>
          </div>

          <div>
            <h2>SSPA</h2>
            <p>NUL Analytics System</p>
          </div>
        </div>

        <div className="student-sidebar-profile">
          <div className="student-profile-avatar">
            <span className="material-symbols-rounded">person</span>
          </div>

          <div>
            <h3>{getStudentName(profile)}</h3>
            <p>{session?.student_number}</p>
          </div>
        </div>

        <p className="student-sidebar-title">Navigation</p>

        <nav className="student-sidebar-nav">
          <button
            className={activeView === "overview" ? "active" : ""}
            type="button"
            onClick={() => setActiveView("overview")}
          >
            <span className="material-symbols-rounded">dashboard</span>
            My Overview
          </button>

          <button
            className={activeView === "assessments" ? "active" : ""}
            type="button"
            onClick={() => setActiveView("assessments")}
          >
            <span className="material-symbols-rounded">assignment</span>
            My Assessments
          </button>

          <button
            className={activeView === "interventions" ? "active" : ""}
            type="button"
            onClick={() => setActiveView("interventions")}
          >
            <span className="material-symbols-rounded">assignment_ind</span>
            My Interventions
          </button>

          <button
            className={activeView === "alerts" ? "active" : ""}
            type="button"
            onClick={() => setActiveView("alerts")}
          >
            <span className="material-symbols-rounded">notifications</span>
            <span className="sidebar-link-text">My Alerts</span>
            {unreadAlertCount > 0 && (
              <span className="sidebar-alert-badge">
                {formatBadgeCount(unreadAlertCount)}
              </span>
            )}
          </button>
        </nav>

        <button className="student-sidebar-logout" onClick={logout}>
          <span className="material-symbols-rounded">logout</span>
          Logout
        </button>
      </aside>

      <main className="student-main">
        <header className="student-topbar">
          <div>
            <h1>{getPageTitle()}</h1>
            <p>
              {getStudentName(profile)} · {summary.totalCourses} enrolled
              course(s)
            </p>
          </div>

          <div className="student-active-course-box">
            <label>Active course</label>

            <select
              value={activeCourse}
              onChange={(event) => {
                setActiveCourse(event.target.value);
                setSelectedScore(null);
                setActiveSource("Gradebook");
              }}
            >
              {courses.map((course) => (
                <option key={course.site_id} value={course.course_code}>
                  {course.course_code}
                </option>
              ))}
            </select>
          </div>
        </header>

        {error && <div className="student-dashboard-error">{error}</div>}

        {activeView === "overview" && (
          <>
            <section className="student-metrics-grid">
              <article className="student-metric-card blue">
                <div>
                  <span>My Courses</span>
                  <strong>{summary.totalCourses}</strong>
                </div>
                <span className="material-symbols-rounded">menu_book</span>
              </article>

              <article className="student-metric-card green">
                <div>
                  <span>Average Score</span>
                  <strong>{formatScore(summary.averageScore)}</strong>
                </div>
                <span className="material-symbols-rounded">check_circle</span>
              </article>

              <article className="student-metric-card amber">
                <div>
                  <span>Moderate Courses</span>
                  <strong>{summary.moderate}</strong>
                </div>
                <span className="material-symbols-rounded">warning</span>
              </article>

              <article className="student-metric-card red">
                <div>
                  <span>High Risk Courses</span>
                  <strong>{summary.highRisk}</strong>
                </div>
                <span className="material-symbols-rounded">
                  notifications_active
                </span>
              </article>
            </section>

            <section className="student-dashboard-grid">
              <article className="student-panel student-course-panel">
                <div className="student-panel-header">
                  <div>
                    <h2>My Course Portfolio</h2>
                    <p>Courses linked to your Sakai membership records.</p>
                  </div>
                </div>

                <div className="student-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Course</th>
                        <th>Avg Score</th>
                        <th>Assessments</th>
                        <th>Risk</th>
                      </tr>
                    </thead>

                    <tbody>
                      {courses.map((course) => {
                        const risk = getRiskLevelFromScore(course.avg_score);

                        return (
                          <tr
                            key={course.site_id}
                            className={
                              activeCourse === course.course_code
                                ? "student-selected-row"
                                : ""
                            }
                            onClick={() => {
                              setActiveCourse(course.course_code);
                              setSelectedScore(null);
                              setActiveSource("Gradebook");
                            }}
                          >
                            <td>
                              <strong>{course.course_code}</strong>
                              <small>{course.course_title}</small>
                            </td>
                            <td>{formatScore(course.avg_score)}</td>
                            <td>{course.assessment_count}</td>
                            <td>
                              <span className={`student-risk-pill ${risk}`}>
                                {risk}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </article>

              <section className="student-right-column">
                <article className="student-panel student-performance-panel">
                  <div className="student-panel-header split">
                    <div>
                      <h2>My Performance — {activeCourse || "No Course"}</h2>
                      <p>
                        Assessment records are separated by Gradebook, Tests,
                        and Assignments.
                      </p>
                    </div>

                    <div className="student-panel-actions">
                      <button
                        type="button"
                        onClick={() => setActiveView("assessments")}
                      >
                        View assessments
                      </button>
                      <button type="button">View recommendations</button>
                    </div>
                  </div>

                  {!activeCourseData && (
                    <div className="student-empty-state">
                      No active course selected.
                    </div>
                  )}

                  {activeCourseData && (
                    <>
                      <div className="student-course-summary">
                        <div>
                          <span>Course</span>
                          <strong>{activeCourseData.course_code}</strong>
                        </div>

                        <div>
                          <span>Average Score</span>
                          <strong>
                            {formatScore(activeCourseData.avg_score)}
                          </strong>
                        </div>

                        <div>
                          <span>Assessments</span>
                          <strong>{activeCourseData.assessment_count}</strong>
                        </div>

                        <div>
                          <span>Resources</span>
                          <strong>{activeCourseData.resource_count}</strong>
                        </div>
                      </div>

                      <div className="student-source-tabs">
                        <button
                          type="button"
                          className={
                            activeSource === "Gradebook" ? "active" : ""
                          }
                          onClick={() => setActiveSource("Gradebook")}
                        >
                          <span className="material-symbols-rounded">grade</span>
                          Gradebook
                          <strong>{gradebookScores.length}</strong>
                        </button>

                        <button
                          type="button"
                          className={activeSource === "Test" ? "active" : ""}
                          onClick={() => setActiveSource("Test")}
                        >
                          <span className="material-symbols-rounded">quiz</span>
                          Tests
                          <strong>{testScores.length}</strong>
                        </button>

                        <button
                          type="button"
                          className={
                            activeSource === "Assignment" ? "active" : ""
                          }
                          onClick={() => setActiveSource("Assignment")}
                        >
                          <span className="material-symbols-rounded">
                            assignment
                          </span>
                          Assignments
                          <strong>{assignmentScores.length}</strong>
                        </button>
                      </div>

                      <div className="student-score-grid">
                        {selectedSourceScores.length === 0 && (
                          <div className="student-empty-state wide">
                            No {activeSource.toLowerCase()} records found for
                            this course.
                          </div>
                        )}

                        {selectedSourceScores.map((score, index) => {
                          const risk = getRiskLevelFromScore(
                            score.percent_score
                          );

                          return (
                            <button
                              type="button"
                              key={`${score.site_id}-${score.item_title}-${score.source}-${index}`}
                              className={`student-score-card ${risk}`}
                              onClick={() => setSelectedScore(score)}
                            >
                              <small>{score.item_title || score.source}</small>
                              <strong>{formatScore(score.percent_score)}</strong>
                              <span>{score.source}</span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </article>

                <article className="student-panel student-profile-panel">
                  <div className="student-panel-header">
                    <h2>Student Profile</h2>
                    <p>
                      Identity details from Sakai student membership records.
                    </p>
                  </div>

                  <div className="student-profile-grid">
                    <div>
                      <span>Student Number</span>
                      <strong>
                        {profile?.student_number || session?.student_number}
                      </strong>
                    </div>

                    <div>
                      <span>Name</span>
                      <strong>{getStudentName(profile)}</strong>
                    </div>

                    <div>
                      <span>Email</span>
                      <strong>{profile?.email || "N/A"}</strong>
                    </div>
                  </div>
                </article>

                <article className="student-panel student-engagement-panel">
                  <div className="student-panel-header">
                    <h2>My Engagement</h2>
                    <p>
                      Activity from Sakai login and resource usage records.
                    </p>
                  </div>

                  <div className="student-engagement-grid">
                    <div>
                      <span>Logins</span>
                      <strong>{activity.login_count}</strong>
                    </div>

                    <div>
                      <span>Resource Actions</span>
                      <strong>{activity.resource_count}</strong>
                    </div>

                    <div>
                      <span>Total Activity</span>
                      <strong>{activity.total_activity}</strong>
                    </div>
                  </div>
                </article>
              </section>
            </section>
          </>
        )}

        {activeView === "assessments" && (
          <>
            <section className="student-metrics-grid">
              <article className="student-metric-card blue">
                <div>
                  <span>Total Assessments</span>
                  <strong>{assessmentSummary.total}</strong>
                </div>
                <span className="material-symbols-rounded">assignment</span>
              </article>

              <article className="student-metric-card green">
                <div>
                  <span>Average Assessment Score</span>
                  <strong>{formatScore(assessmentSummary.averageScore)}</strong>
                </div>
                <span className="material-symbols-rounded">query_stats</span>
              </article>

              <article className="student-metric-card amber">
                <div>
                  <span>Tests / Quizzes</span>
                  <strong>{assessmentSummary.tests}</strong>
                </div>
                <span className="material-symbols-rounded">quiz</span>
              </article>

              <article className="student-metric-card red">
                <div>
                  <span>Assignments</span>
                  <strong>{assessmentSummary.assignments}</strong>
                </div>
                <span className="material-symbols-rounded">edit_note</span>
              </article>
            </section>

            <section className="student-assessments-page">
              <article className="student-panel student-assessments-panel">
                <div className="student-panel-header split">
                  <div>
                    <h2>My Assessments</h2>
                    <p>
                      Detailed records from Gradebook, Tests, Quizzes, and
                      Assignments.
                    </p>
                  </div>

                  <div className="student-assessment-filters">
                    <select
                      value={assessmentCourseFilter}
                      onChange={(event) =>
                        setAssessmentCourseFilter(event.target.value)
                      }
                    >
                      <option value="ALL">All courses</option>
                      {courses.map((course) => (
                        <option
                          key={course.site_id}
                          value={course.course_code}
                        >
                          {course.course_code}
                        </option>
                      ))}
                    </select>

                    <select
                      value={assessmentSourceFilter}
                      onChange={(event) =>
                        setAssessmentSourceFilter(event.target.value)
                      }
                    >
                      <option value="ALL">All types</option>
                      <option value="Gradebook">Gradebook</option>
                      <option value="Test">Tests / Quizzes</option>
                      <option value="Assignment">Assignments</option>
                    </select>
                  </div>
                </div>

                {filteredAssessments.length === 0 && (
                  <div className="student-empty-state">
                    No assessment records found for the selected filters.
                  </div>
                )}

                {filteredAssessments.length > 0 && (
                  <div className="student-assessment-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Course</th>
                          <th>Type</th>
                          <th>Assessment</th>
                          <th>Score</th>
                          <th>Points</th>
                          <th>Date</th>
                          <th>Risk</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredAssessments.map((score, index) => {
                          const risk = getRiskLevelFromScore(
                            score.percent_score
                          );

                          return (
                            <tr
                              key={`${score.site_id}-${score.item_title}-${score.source}-${index}`}
                              onClick={() => setSelectedScore(score)}
                            >
                              <td>
                                <strong>{score.course_code}</strong>
                                <small>{score.site_id}</small>
                              </td>
                              <td>
                                <span className="student-assessment-source">
                                  {score.source}
                                </span>
                              </td>
                              <td>
                                <strong>
                                  {score.item_title || "Untitled assessment"}
                                </strong>
                              </td>
                              <td>{formatScore(score.percent_score)}</td>
                              <td>{formatPoints(score)}</td>
                              <td>{formatDate(score.recorded_at)}</td>
                              <td>
                                <span className={`student-risk-pill ${risk}`}>
                                  {risk}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            </section>
          </>
        )}

        {activeView === "interventions" && (
          <>
            <section className="student-metrics-grid">
              <article className="student-metric-card blue">
                <div>
                  <span>Total Interventions</span>
                  <strong>{interventionSummary.total}</strong>
                </div>
                <span className="material-symbols-rounded">assignment_ind</span>
              </article>

              <article className="student-metric-card amber">
                <div>
                  <span>Open</span>
                  <strong>{interventionSummary.open}</strong>
                </div>
                <span className="material-symbols-rounded">pending_actions</span>
              </article>

              <article className="student-metric-card red">
                <div>
                  <span>Escalated</span>
                  <strong>{interventionSummary.escalated}</strong>
                </div>
                <span className="material-symbols-rounded">priority_high</span>
              </article>

              <article className="student-metric-card green">
                <div>
                  <span>Resolved / Closed</span>
                  <strong>{interventionSummary.resolved}</strong>
                </div>
                <span className="material-symbols-rounded">task_alt</span>
              </article>
            </section>

            <section className="student-interventions-page">
              <article className="student-panel student-intervention-panel">
                <div className="student-panel-header">
                  <h2>My Interventions</h2>
                  <p>
                    These are support cases created by your lecturer. You can
                    view the reason, status, priority, and follow-up date.
                  </p>
                </div>

                {interventionError && (
                  <div className="student-dashboard-error">
                    {interventionError}
                  </div>
                )}

                {loadingInterventions && (
                  <div className="student-empty-state">
                    Loading intervention cases...
                  </div>
                )}

                {!loadingInterventions && interventionCases.length === 0 && (
                  <div className="student-empty-state">
                    No intervention cases have been created for you.
                  </div>
                )}

                {!loadingInterventions && interventionCases.length > 0 && (
                  <div className="student-intervention-list">
                    {interventionCases.map((caseItem) => (
                      <article
                        key={caseItem.case_id}
                        className={`student-intervention-card ${String(
                          caseItem.priority || ""
                        ).toLowerCase()}`}
                      >
                        <div>
                          <strong>{caseItem.reason}</strong>
                          <small>
                            {caseItem.course_code} · Created by{" "}
                            {caseItem.created_by_role?.toLowerCase()}{" "}
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
                )}
              </article>
            </section>
          </>
        )}

        {activeView === "alerts" && (
          <AlertsPage
            recipientRole="STUDENT"
            recipientIdentifier={session?.student_number}
          />
        )}
      </main>

      {selectedScore && (
        <div
          className="student-modal-backdrop"
          onClick={() => setSelectedScore(null)}
        >
          <section
            className="student-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="student-modal-header">
              <div>
                <h2>{selectedScore.item_title || selectedScore.source}</h2>
                <p>{selectedScore.course_code}</p>
              </div>

              <button type="button" onClick={() => setSelectedScore(null)}>
                <span className="material-symbols-rounded">close</span>
              </button>
            </header>

            <div className="student-modal-body">
              <div className="student-summary-grid">
                <div>
                  <span>Course</span>
                  <strong>{selectedScore.course_code}</strong>
                </div>

                <div>
                  <span>Source</span>
                  <strong>{selectedScore.source}</strong>
                </div>

                <div>
                  <span>Percent Score</span>
                  <strong>{formatScore(selectedScore.percent_score)}</strong>
                </div>

                <div>
                  <span>Points Earned</span>
                  <strong>{selectedScore.points_earned || "N/A"}</strong>
                </div>

                <div>
                  <span>Points Possible</span>
                  <strong>{selectedScore.points_possible || "N/A"}</strong>
                </div>

                <div>
                  <span>Recorded At</span>
                  <strong>{formatDate(selectedScore.recorded_at)}</strong>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}