import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  assignCourseToFaculty,
  getFacultyAdminDashboard,
  getFacultyAdmins,
  getFacultyStudentProfile,
  getUnmappedCourses,
  simulateFacultyAdminLogin,
} from "../../services/facultyAdminApi";
import "./FacultyAdminDashboardPage.css";

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

function getRiskLabel(student) {
  if (Number(student.high_risk_courses || 0) > 0) return "HIGH";
  if (Number(student.moderate_risk_courses || 0) > 0) return "MODERATE";
  return "ON_TRACK";
}

function getRiskClass(value) {
  const text = String(value || "").toLowerCase();

  if (text.includes("high")) return "high";
  if (text.includes("moderate")) return "moderate";
  if (text.includes("track")) return "on-track";

  return "unknown";
}

function getPriorityClass(priority) {
  return String(priority || "").toLowerCase();
}

export default function FacultyAdminDashboardPage() {
  const navigate = useNavigate();

  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("sspa_session"));
    } catch {
      return null;
    }
  });

  const [facultyAdmins, setFacultyAdmins] = useState([]);
  const [selectedAdminIdentifier, setSelectedAdminIdentifier] = useState("");

  const [dashboard, setDashboard] = useState(null);
  const [activeView, setActiveView] = useState("students");
  const [selectedStudentNumber, setSelectedStudentNumber] = useState("");
  const [studentProfile, setStudentProfile] = useState(null);
  const [studentSearch, setStudentSearch] = useState("");

  const [unmappedCourses, setUnmappedCourses] = useState([]);
  const [loadingUnmapped, setLoadingUnmapped] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [message, setMessage] = useState("");

  const isFacultyAdmin = session?.role === "FACULTY_ADMIN";
  const adminIdentifier = session?.admin_identifier;

  function loadAdmins() {
    getFacultyAdmins()
      .then((data) => {
        setFacultyAdmins(data || []);
        if ((data || []).length > 0) {
          setSelectedAdminIdentifier(data[0].admin_identifier);
        }
      })
      .catch((err) => setMessage(err.message || "Failed to load faculty admins"));
  }

  function loadDashboard() {
    if (!adminIdentifier) return;

    setLoading(true);
    setMessage("");

    getFacultyAdminDashboard(adminIdentifier)
      .then((data) => setDashboard(data || {}))
      .catch((err) => {
        setDashboard({});
        setMessage(err.message || "Failed to load faculty admin dashboard");
      })
      .finally(() => setLoading(false));
  }

  function loadUnmappedCourses() {
    setLoadingUnmapped(true);
    setMessage("");

    getUnmappedCourses()
      .then((data) => setUnmappedCourses(data || []))
      .catch((err) => setMessage(err.message || "Failed to load unmapped courses"))
      .finally(() => setLoadingUnmapped(false));
  }

  useEffect(() => {
    if (!isFacultyAdmin) {
      loadAdmins();
      return;
    }

    loadDashboard();
  }, [isFacultyAdmin, adminIdentifier]);

  useEffect(() => {
    if (activeView === "mapping") {
      loadUnmappedCourses();
    }
  }, [activeView]);

  async function handleLogin(event) {
    event.preventDefault();

    if (!selectedAdminIdentifier) return;

    setLoadingLogin(true);
    setMessage("");

    try {
      const result = await simulateFacultyAdminLogin(selectedAdminIdentifier);
      localStorage.setItem("sspa_session", JSON.stringify(result.session));
      setSession(result.session);
    } catch (err) {
      setMessage(err.message || "Failed to login as faculty admin");
    } finally {
      setLoadingLogin(false);
    }
  }

  function logout() {
    localStorage.removeItem("sspa_session");
    setSession(null);
    setDashboard(null);
    setStudentProfile(null);
    setSelectedStudentNumber("");
    navigate("/");
  }

  function openStudentProfile(studentNumber) {
    if (!studentNumber || !adminIdentifier) return;

    setSelectedStudentNumber(studentNumber);
    setActiveView("profile");
    setLoadingStudent(true);
    setMessage("");

    getFacultyStudentProfile(adminIdentifier, studentNumber)
      .then((data) => setStudentProfile(data || null))
      .catch((err) => {
        setStudentProfile(null);
        setMessage(err.message || "Failed to load student profile");
      })
      .finally(() => setLoadingStudent(false));
  }

  async function handleAssignToMyFaculty(courseCode) {
    if (!session?.faculty_id || !courseCode) return;

    setMessage("");

    try {
      await assignCourseToFaculty({
        course_code: courseCode,
        faculty_id: session.faculty_id,
        assigned_by: session.admin_identifier,
        notes: `Assigned from ${session.faculty_name} dashboard`,
      });

      setMessage(`${courseCode} assigned to ${session.faculty_name}.`);
      await loadUnmappedCourses();
      await loadDashboard();
    } catch (err) {
      setMessage(err.message || "Failed to assign course to faculty");
    }
  }

  const summary = dashboard?.summary || {};
  const courses = dashboard?.courses || [];
  const students = dashboard?.students || [];
  const interventions = dashboard?.interventions || [];
  const alerts = dashboard?.alerts || [];

  const filteredStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();

    if (!term) return students;

    return students.filter((student) =>
      String(student.student_number || "").toLowerCase().includes(term)
    );
  }, [students, studentSearch]);

  if (!isFacultyAdmin) {
    return (
      <main className="faculty-admin-login-page">
        <section className="faculty-admin-login-card">
          <div className="faculty-admin-login-logo">
            <span className="material-symbols-rounded">account_balance</span>
          </div>

          <h1>Faculty Admin Access</h1>
          <p>
            Select a faculty admin account to simulate faculty-scoped access.
            Each admin only sees students and courses mapped to their faculty.
          </p>

          {message && <div className="faculty-admin-message">{message}</div>}

          <form onSubmit={handleLogin}>
            <label>Faculty Admin</label>
            <select
              value={selectedAdminIdentifier}
              onChange={(event) => setSelectedAdminIdentifier(event.target.value)}
              required
            >
              {facultyAdmins.map((admin) => (
                <option key={admin.admin_identifier} value={admin.admin_identifier}>
                  {admin.faculty_name} — {admin.display_name}
                </option>
              ))}
            </select>

            <button type="submit" disabled={loadingLogin || !selectedAdminIdentifier}>
              {loadingLogin ? "Opening..." : "Open Faculty Dashboard"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <div className="faculty-admin-dashboard-shell">
      <aside className="faculty-admin-sidebar">
        <div className="faculty-admin-sidebar-brand">
          <div className="faculty-admin-sidebar-logo">
            <span className="material-symbols-rounded">account_balance</span>
          </div>

          <div>
            <h2>SSPA</h2>
            <p>NUL Analytics System</p>
          </div>
        </div>

        <div className="faculty-admin-sidebar-profile">
          <div className="faculty-admin-profile-avatar">
            <span className="material-symbols-rounded">admin_panel_settings</span>
          </div>

          <div>
            <h3>{session.faculty_name}</h3>
            <p>{session.admin_identifier}</p>
          </div>
        </div>

        <p className="faculty-admin-sidebar-title">Navigation</p>

        <nav className="faculty-admin-sidebar-nav">
          <button
            type="button"
            className={activeView === "students" ? "active" : ""}
            onClick={() => setActiveView("students")}
          >
            <span className="material-symbols-rounded">groups</span>
            Faculty Students
          </button>

          <button
            type="button"
            className={activeView === "courses" ? "active" : ""}
            onClick={() => setActiveView("courses")}
          >
            <span className="material-symbols-rounded">menu_book</span>
            Faculty Courses
          </button>

          <button
            type="button"
            className={activeView === "interventions" ? "active" : ""}
            onClick={() => setActiveView("interventions")}
          >
            <span className="material-symbols-rounded">assignment_ind</span>
            Interventions
          </button>

          <button
            type="button"
            className={activeView === "alerts" ? "active" : ""}
            onClick={() => setActiveView("alerts")}
          >
            <span className="material-symbols-rounded">notifications</span>
            Alerts
          </button>

          <button
            type="button"
            className={activeView === "mapping" ? "active" : ""}
            onClick={() => setActiveView("mapping")}
          >
            <span className="material-symbols-rounded">hub</span>
            Course Mapping
          </button>
        </nav>

        <button className="faculty-admin-sidebar-logout" onClick={logout}>
          <span className="material-symbols-rounded">logout</span>
          Logout
        </button>
      </aside>

      <main className="faculty-admin-main">
        <header className="faculty-admin-topbar">
          <div>
            <h1>{session.faculty_name} Dashboard</h1>
            <p>
              Faculty-scoped monitoring for students, courses, interventions,
              and alerts.
            </p>
          </div>

          <button type="button" onClick={loadDashboard} disabled={loading}>
            <span className="material-symbols-rounded">sync</span>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </header>

        {message && <div className="faculty-admin-message">{message}</div>}

        <section className="faculty-admin-metrics-grid">
          <article className="faculty-admin-metric-card blue">
            <div>
              <span>Faculty Students</span>
              <strong>{formatNumber(summary.total_students)}</strong>
            </div>
            <span className="material-symbols-rounded">groups</span>
          </article>

          <article className="faculty-admin-metric-card green">
            <div>
              <span>Assigned Courses</span>
              <strong>{formatNumber(summary.assigned_courses)}</strong>
            </div>
            <span className="material-symbols-rounded">menu_book</span>
          </article>

          <article className="faculty-admin-metric-card red">
            <div>
              <span>High-Risk Students</span>
              <strong>{formatNumber(summary.high_risk_students)}</strong>
            </div>
            <span className="material-symbols-rounded">priority_high</span>
          </article>

          <article className="faculty-admin-metric-card amber">
            <div>
              <span>Follow-ups Due</span>
              <strong>{formatNumber(summary.follow_up_due_cases)}</strong>
            </div>
            <span className="material-symbols-rounded">event_upcoming</span>
          </article>
        </section>

        {activeView === "students" && (
          <section className="faculty-admin-panel">
            <div className="faculty-admin-panel-header split">
              <div>
                <h2>Faculty Students</h2>
                <p>Only students with courses mapped to {session.faculty_name}.</p>
              </div>

              <input
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder="Search student number"
              />
            </div>

            <div className="faculty-admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Risk</th>
                    <th>Courses</th>
                    <th>Avg Score</th>
                    <th>Activity</th>
                    <th>Last Login</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan="7">No students found for this faculty.</td>
                    </tr>
                  )}

                  {filteredStudents.map((student) => {
                    const riskLabel = getRiskLabel(student);

                    return (
                      <tr key={student.student_number}>
                        <td>
                          <strong>{student.student_number}</strong>
                          <small>Faculty student</small>
                        </td>

                        <td>
                          <span className={`faculty-admin-risk-pill ${getRiskClass(riskLabel)}`}>
                            {riskLabel}
                          </span>
                        </td>

                        <td>{formatNumber(student.course_count)}</td>
                        <td>{formatPercent(student.avg_assessment_percent)}</td>
                        <td>{formatNumber(student.total_activity_count)}</td>
                        <td>
                          {student.days_since_last_login === null ||
                          student.days_since_last_login === undefined
                            ? "N/A"
                            : `${student.days_since_last_login} days ago`}
                        </td>

                        <td>
                          <button
                            type="button"
                            className="faculty-admin-table-action"
                            onClick={() => openStudentProfile(student.student_number)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeView === "courses" && (
          <section className="faculty-admin-panel">
            <div className="faculty-admin-panel-header">
              <div>
                <h2>Faculty Courses</h2>
                <p>Course scope comes from faculty.course_faculty_allocation.</p>
              </div>
            </div>

            <div className="faculty-admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Students</th>
                    <th>Avg Score</th>
                    <th>High Risk</th>
                    <th>Moderate</th>
                    <th>Last Feature Refresh</th>
                  </tr>
                </thead>

                <tbody>
                  {courses.length === 0 && (
                    <tr>
                      <td colSpan="6">
                        No courses are mapped to this faculty yet. Open Course Mapping.
                      </td>
                    </tr>
                  )}

                  {courses.map((course) => (
                    <tr key={course.course_code}>
                      <td>
                        <strong>{course.course_code}</strong>
                        <small>{course.course_title || "N/A"}</small>
                      </td>
                      <td>{formatNumber(course.student_count)}</td>
                      <td>{formatPercent(course.avg_assessment_percent)}</td>
                      <td>{formatNumber(course.high_risk_rows)}</td>
                      <td>{formatNumber(course.moderate_risk_rows)}</td>
                      <td>{formatDateTime(course.last_feature_refresh)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeView === "interventions" && (
          <section className="faculty-admin-panel">
            <div className="faculty-admin-panel-header">
              <div>
                <h2>Faculty Intervention Cases</h2>
                <p>Only intervention cases for courses under {session.faculty_name}.</p>
              </div>
            </div>

            <div className="faculty-admin-case-list">
              {interventions.length === 0 && (
                <div className="faculty-admin-empty-state">
                  No intervention cases found for this faculty.
                </div>
              )}

              {interventions.map((caseItem) => (
                <article
                  className={`faculty-admin-case-card ${getPriorityClass(caseItem.priority)}`}
                  key={caseItem.case_id}
                >
                  <div>
                    <strong>{caseItem.student_number}</strong>
                    <small>{caseItem.course_code} · {caseItem.reason}</small>
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

        {activeView === "alerts" && (
          <section className="faculty-admin-panel">
            <div className="faculty-admin-panel-header">
              <div>
                <h2>Faculty Alerts</h2>
                <p>Alerts connected to courses under {session.faculty_name}.</p>
              </div>
            </div>

            <div className="faculty-admin-alert-list">
              {alerts.length === 0 && (
                <div className="faculty-admin-empty-state">
                  No active alerts found for this faculty.
                </div>
              )}

              {alerts.map((alert) => (
                <article
                  key={alert.alert_id}
                  className={`faculty-admin-alert-card ${String(alert.severity || "").toLowerCase()}`}
                >
                  <div>
                    <strong>{alert.title}</strong>
                    <p>{alert.message}</p>
                    <small>
                      {alert.alert_type} · {alert.course_code || "No course"} · {formatDateTime(alert.created_at)}
                    </small>
                  </div>

                  <span>{alert.status}</span>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeView === "mapping" && (
          <section className="faculty-admin-panel">
            <div className="faculty-admin-panel-header">
              <div>
                <h2>Course Mapping</h2>
                <p>
                  Assign unmapped course codes to {session.faculty_name}. This is what
                  controls which students the faculty admin can see.
                </p>
              </div>

              <button type="button" onClick={loadUnmappedCourses} disabled={loadingUnmapped}>
                {loadingUnmapped ? "Loading..." : "Refresh Unmapped"}
              </button>
            </div>

            <div className="faculty-admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Title</th>
                    <th>Students</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {unmappedCourses.length === 0 && (
                    <tr>
                      <td colSpan="4">No unmapped courses found.</td>
                    </tr>
                  )}

                  {unmappedCourses.map((course) => (
                    <tr key={course.course_code}>
                      <td>
                        <strong>{course.course_code}</strong>
                      </td>
                      <td>{course.course_title || "N/A"}</td>
                      <td>{formatNumber(course.student_count)}</td>
                      <td>
                        <button
                          type="button"
                          className="faculty-admin-table-action"
                          onClick={() => handleAssignToMyFaculty(course.course_code)}
                        >
                          Assign to my faculty
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeView === "profile" && (
          <section className="faculty-admin-panel">
            <div className="faculty-admin-panel-header">
              <div>
                <h2>Student Faculty Profile</h2>
                <p>
                  Student {selectedStudentNumber} scoped to {session.faculty_name} only.
                </p>
              </div>
            </div>

            {loadingStudent && (
              <div className="faculty-admin-empty-state">Loading student profile...</div>
            )}

            {!loadingStudent && studentProfile && (
              <>
                <div className="faculty-admin-profile-summary">
                  <div>
                    <span>Student Number</span>
                    <strong>{studentProfile.student_number}</strong>
                  </div>

                  <div>
                    <span>Faculty Courses</span>
                    <strong>{formatNumber(studentProfile.features?.length)}</strong>
                  </div>

                  <div>
                    <span>Interventions</span>
                    <strong>{formatNumber(studentProfile.interventions?.length)}</strong>
                  </div>

                  <div>
                    <span>Alerts</span>
                    <strong>{formatNumber(studentProfile.alerts?.length)}</strong>
                  </div>
                </div>

                <h3 className="faculty-admin-section-title">Course Risk Profile</h3>

                <div className="faculty-admin-table-wrap compact">
                  <table>
                    <thead>
                      <tr>
                        <th>Course</th>
                        <th>Risk</th>
                        <th>Avg Score</th>
                        <th>Assessments</th>
                        <th>Activity</th>
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
                            <span className={`faculty-admin-risk-pill ${getRiskClass(feature.current_risk_level)}`}>
                              {feature.current_risk_level}
                            </span>
                          </td>
                          <td>{formatPercent(feature.avg_assessment_percent)}</td>
                          <td>{formatNumber(feature.total_assessment_records)}</td>
                          <td>{formatNumber(feature.total_activity_count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
