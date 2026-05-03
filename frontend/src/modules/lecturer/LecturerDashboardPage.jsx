import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../../services/apiClient";
import {
  createInterventionCase,
  getInterventionCases,
  updateInterventionStatus,
} from "../../services/interventionApi";
import { getUnreadAlertCount } from "../../services/notificationApi";
import { downloadReportCsv } from "../../services/reportExportApi";
import AlertsPage from "../shared/AlertsPage";
import "./LecturerDashboardPage.css";


function getRiskLevel(student) {
  if (student.avg_score === null || student.avg_score === undefined) {
    return "unknown";
  }

  const score = Number(student.avg_score);

  if (Number.isNaN(score)) {
    return "unknown";
  }

  if (score < 50) {
    return "high";
  }

  if (score < 65) {
    return "moderate";
  }

  return "on-track";
}

function isStudentAtRisk(student) {
  const risk = getRiskLevel(student);
  return risk === "high" || risk === "moderate";
}

function formatRiskLabel(risk) {
  if (risk === "on-track") {
    return "On Track";
  }

  return String(risk || "unknown")
    .replace("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatScore(score) {
  if (score === null || score === undefined) {
    return "N/A";
  }

  const value = Number(score);

  if (Number.isNaN(value)) {
    return "N/A";
  }

  return Math.round(value);
}

function getStudentName(student) {
  const firstName = student.first_name || "";
  const lastName = student.last_name || "";
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || student.student_number || "Unknown student";
}

function getDefaultInterventionForm(student) {
  const risk = getRiskLevel(student);

  return {
    reason:
      risk === "high"
        ? "Low academic performance"
        : risk === "moderate"
        ? "Moderate academic risk"
        : "Student support follow-up",
    priority: risk === "high" ? "HIGH" : risk === "moderate" ? "MEDIUM" : "LOW",
    follow_up_date: "",
    note_text: "",
  };
}


function normalizeInterventionStatus(status) {
  const value = String(status || "OPEN").toUpperCase();

  if (value === "OPEN" || value === "TRIGGERED") {
    return "triggered";
  }

  if (value === "IN_PROGRESS") {
    return "in-progress";
  }

  if (value === "COMPLETED" || value === "RESOLVED" || value === "CLOSED") {
    return "completed";
  }

  if (value === "ESCALATED") {
    return "escalated";
  }

  return "unknown";
}

function formatInterventionStatus(status) {
  const normalized = normalizeInterventionStatus(status);

  if (normalized === "in-progress") return "In Progress";
  if (normalized === "triggered") return "Triggered";
  if (normalized === "completed") return "Completed";
  if (normalized === "escalated") return "Escalated";

  return "Unknown";
}

function canStartIntervention(caseItem) {
  return normalizeInterventionStatus(caseItem?.status) === "triggered";
}

function canCompleteIntervention(caseItem) {
  return normalizeInterventionStatus(caseItem?.status) === "in-progress";
}

function canEscalateIntervention(caseItem) {
  const status = normalizeInterventionStatus(caseItem?.status);
  return status === "triggered" || status === "in-progress";
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

export default function LecturerDashboardPage() {
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState("overview");
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);

  const [courses, setCourses] = useState([]);
  const [studentsByCourse, setStudentsByCourse] = useState({});
  const [activeCourse, setActiveCourse] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [riskFilter, setRiskFilter] = useState("all");
  const [studentSearch, setStudentSearch] = useState("");

  const [interventionCases, setInterventionCases] = useState([]);
  const [lecturerInterventionCases, setLecturerInterventionCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingLecturerCases, setLoadingLecturerCases] = useState(false);
  const [creatingCase, setCreatingCase] = useState(false);
  const [updatingCaseId, setUpdatingCaseId] = useState("");
  const [interventionMessage, setInterventionMessage] = useState("");
  const [statusUpdateMessage, setStatusUpdateMessage] = useState("");

  const [interventionForm, setInterventionForm] = useState({
    reason: "Low academic performance",
    priority: "MEDIUM",
    follow_up_date: "",
    note_text: "",
  });

  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [exportingReport, setExportingReport] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [error, setError] = useState("");

  const session = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("sspa_session"));
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!session?.lecturer_number) {
      setUnreadAlertCount(0);
      return;
    }

    let mounted = true;

    getUnreadAlertCount("LECTURER", String(session.lecturer_number))
      .then((data) => {
        if (mounted) setUnreadAlertCount(extractUnreadAlertCount(data));
      })
      .catch(() => {
        if (mounted) setUnreadAlertCount(0);
      });

    return () => {
      mounted = false;
    };
  }, [session?.lecturer_number, activeView]);

  const selectedStudentCourse = selectedStudent?.__courseCode || activeCourse;

  useEffect(() => {
    if (!session || session.role !== "LECTURER" || !session.lecturer_number) {
      navigate("/");
      return;
    }

    setLoadingCourses(true);

    apiGet(`/lecturer/courses/${session.lecturer_number}`)
      .then((data) => {
        const courseList = data || [];
        setCourses(courseList);

        if (courseList.length > 0) {
          setActiveCourse(courseList[0].course_code);
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load lecturer courses");
      })
      .finally(() => {
        setLoadingCourses(false);
      });
  }, [navigate, session]);

  useEffect(() => {
    if (!session?.lecturer_number || courses.length === 0) {
      return;
    }

    setLoadingStudents(true);

    Promise.all(
      courses.map((course) =>
        apiGet(
          `/lecturer/courses/${session.lecturer_number}/${course.course_code}/students`
        )
          .then((students) => ({
            courseCode: course.course_code,
            students: students || [],
          }))
          .catch(() => ({
            courseCode: course.course_code,
            students: [],
          }))
      )
    )
      .then((results) => {
        const nextStudentsByCourse = {};

        results.forEach((result) => {
          nextStudentsByCourse[result.courseCode] = result.students;
        });

        setStudentsByCourse(nextStudentsByCourse);
      })
      .finally(() => {
        setLoadingStudents(false);
      });
  }, [courses, session?.lecturer_number]);

  useEffect(() => {
    if (!selectedStudent || !selectedStudentCourse) {
      setInterventionCases([]);
      return;
    }

    setLoadingCases(true);
    setInterventionMessage("");

    getInterventionCases({
      student_number: selectedStudent.student_number,
      course_code: selectedStudentCourse,
    })
      .then((cases) => {
        setInterventionCases(cases || []);
      })
      .catch((err) => {
        setInterventionMessage(err.message || "Failed to load interventions");
      })
      .finally(() => {
        setLoadingCases(false);
      });
  }, [selectedStudent, selectedStudentCourse]);

  useEffect(() => {
    if (!session?.lecturer_number || activeView !== "interventions") {
      return;
    }

    loadLecturerInterventions();
  }, [activeView, session?.lecturer_number]);

  function loadLecturerInterventions() {
    setLoadingLecturerCases(true);
    setStatusUpdateMessage("");

    getInterventionCases({
      created_by_role: "LECTURER",
      created_by_identifier: String(session.lecturer_number),
    })
      .then((cases) => {
        setLecturerInterventionCases(cases || []);
      })
      .catch((err) => {
        setError(err.message || "Failed to load lecturer interventions");
      })
      .finally(() => {
        setLoadingLecturerCases(false);
      });
  }

  const allLecturerStudents = useMemo(() => {
    return Object.entries(studentsByCourse).flatMap(([courseCode, students]) =>
      (students || []).map((student) => ({
        ...student,
        __courseCode: courseCode,
      }))
    );
  }, [studentsByCourse]);

  const activeStudents = useMemo(() => {
    return (studentsByCourse[activeCourse] || []).map((student) => ({
      ...student,
      __courseCode: activeCourse,
    }));
  }, [studentsByCourse, activeCourse]);

  const coursePortfolio = useMemo(() => {
    return courses.map((course) => {
      const students = studentsByCourse[course.course_code] || [];

      const highRisk = students.filter(
        (student) => getRiskLevel(student) === "high"
      ).length;

      const moderate = students.filter(
        (student) => getRiskLevel(student) === "moderate"
      ).length;

      const onTrack = students.filter(
        (student) => getRiskLevel(student) === "on-track"
      ).length;

      const unknown = students.filter(
        (student) => getRiskLevel(student) === "unknown"
      ).length;

      const scoredStudents = students.filter(
        (student) =>
          student.avg_score !== null &&
          student.avg_score !== undefined &&
          !Number.isNaN(Number(student.avg_score))
      );

      const avgScore =
        scoredStudents.length === 0
          ? null
          : scoredStudents.reduce(
              (sum, student) => sum + Number(student.avg_score),
              0
            ) / scoredStudents.length;

      return {
        ...course,
        students: students.length,
        highRisk,
        moderate,
        onTrack,
        unknown,
        avgScore,
      };
    });
  }, [courses, studentsByCourse]);

  const totals = useMemo(() => {
    return coursePortfolio.reduce(
      (summary, course) => {
        summary.totalStudents += course.students;
        summary.highRisk += course.highRisk;
        summary.moderate += course.moderate;
        summary.onTrack += course.onTrack;
        summary.unknown += course.unknown;

        return summary;
      },
      {
        totalStudents: 0,
        highRisk: 0,
        moderate: 0,
        onTrack: 0,
        unknown: 0,
      }
    );
  }, [coursePortfolio]);

  const activeCourseSummary = useMemo(() => {
    return (
      coursePortfolio.find((course) => course.course_code === activeCourse) || {
        students: 0,
        highRisk: 0,
        moderate: 0,
        onTrack: 0,
        unknown: 0,
      }
    );
  }, [coursePortfolio, activeCourse]);

  const searchQuery = studentSearch.trim().toLowerCase();

  const searchedStudents = useMemo(() => {
    if (!searchQuery) {
      return [];
    }

    return allLecturerStudents.filter((student) => {
      const searchable = [
        getStudentName(student),
        student.student_number,
        student.email,
        student.site_id,
        student.__courseCode,
        student.site_role,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(searchQuery);
    });
  }, [allLecturerStudents, searchQuery]);

  const baseHeatmapStudents = searchQuery ? searchedStudents : activeStudents;

  const visibleStudents = useMemo(() => {
    if (riskFilter === "all") {
      return baseHeatmapStudents;
    }

    return baseHeatmapStudents.filter(
      (student) => getRiskLevel(student) === riskFilter
    );
  }, [baseHeatmapStudents, riskFilter]);

  const heatmapTitle = searchQuery
    ? "Student Search Results"
    : `Risk Heatmap — ${activeCourse}`;

  const heatmapSubtitle = searchQuery
    ? `Showing ${visibleStudents.length} result(s) across lecturer-assigned courses for “${studentSearch.trim()}”.`
    : `Showing ${visibleStudents.length} of ${activeStudents.length} students in ${activeCourse}.`;

  const interventionSummary = useMemo(() => {
    return lecturerInterventionCases.reduce(
      (summary, caseItem) => {
        const status = normalizeInterventionStatus(caseItem.status);

        summary.total += 1;

        if (status === "triggered") summary.triggered += 1;
        if (status === "in-progress") summary.inProgress += 1;
        if (status === "completed") summary.completed += 1;
        if (status === "escalated") summary.escalated += 1;

        return summary;
      },
      {
        total: 0,
        triggered: 0,
        inProgress: 0,
        completed: 0,
        escalated: 0,
      }
    );
  }, [lecturerInterventionCases]);

  function logout() {
    localStorage.removeItem("sspa_session");
    navigate("/");
  }

  function openInterventionModule() {
    setSelectedStudent(null);
    setActiveView("interventions");
  }

  function resetOverviewFilters() {
    setRiskFilter("all");
    setStudentSearch("");
    setSelectedStudent(null);
  }

  async function handleDownloadReport(reportType) {
    const configs = {
      atRisk: {
        path: "/reports/at-risk-students.csv",
        filename: `sspa_${session?.lecturer_number || "lecturer"}_at_risk_students.csv`,
        params: { course_code: activeCourse },
        success: "At-risk students CSV downloaded.",
      },
      courseSummary: {
        path: "/reports/course-summary.csv",
        filename: `sspa_${session?.lecturer_number || "lecturer"}_course_summary.csv`,
        params: {},
        success: "Course summary CSV downloaded.",
      },
      interventions: {
        path: "/reports/interventions.csv",
        filename: `sspa_${session?.lecturer_number || "lecturer"}_interventions.csv`,
        params: { course_code: activeCourse },
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

  function selectStudent(student) {
    const courseCode = student.__courseCode || activeCourse;
    setActiveCourse(courseCode);
    setSelectedStudent(student);
    setInterventionMessage("");
    setInterventionForm(getDefaultInterventionForm(student));
  }

  function replaceInterventionCase(caseItem, nextStatus, serverCase = null) {
    const replacement = {
      ...caseItem,
      ...(serverCase || {}),
      status: serverCase?.status || nextStatus,
    };

    setLecturerInterventionCases((currentCases) =>
      currentCases.map((item) =>
        item.case_id === caseItem.case_id ? replacement : item
      )
    );

    setInterventionCases((currentCases) =>
      currentCases.map((item) =>
        item.case_id === caseItem.case_id ? replacement : item
      )
    );
  }

  async function submitInterventionStatus(caseItem, nextStatus) {
    const basePayload = {
      new_status: nextStatus,
      // Keep status for older frontend/backend compatibility, but the current API requires new_status.
      status: nextStatus,
      changed_by_role: "LECTURER",
      changed_by_identifier: String(session?.lecturer_number || ""),
      updated_by_role: "LECTURER",
      updated_by_identifier: String(session?.lecturer_number || ""),
      change_reason:
        nextStatus === "IN_PROGRESS"
          ? "Lecturer started the agreed intervention"
          : nextStatus === "ESCALATED"
          ? "Lecturer escalated the intervention to an academic advisor"
          : "Lecturer completed the intervention after reviewing student improvement",
    };

    try {
      return await updateInterventionStatus(caseItem.case_id, basePayload);
    } catch (err) {
      if (nextStatus !== "COMPLETED") {
        throw err;
      }

      return updateInterventionStatus(caseItem.case_id, {
        ...basePayload,
        new_status: "RESOLVED",
        status: "RESOLVED",
        change_reason:
          "Lecturer completed the intervention after reviewing student improvement",
      });
    }
  }

  async function handleInterventionStatusChange(caseItem, nextStatus) {
    if (!caseItem?.case_id) return;

    setUpdatingCaseId(caseItem.case_id);
    setStatusUpdateMessage("");
    setInterventionMessage("");

    try {
      const updatedCase = await submitInterventionStatus(caseItem, nextStatus);
      const effectiveStatus = updatedCase?.status || nextStatus;

      replaceInterventionCase(caseItem, effectiveStatus, updatedCase);

      if (nextStatus === "IN_PROGRESS") {
        setStatusUpdateMessage("Intervention moved from Triggered to In Progress.");
      } else if (nextStatus === "ESCALATED") {
        setStatusUpdateMessage(
          "Intervention escalated. Advisor alert visibility depends on the backend notification endpoint for escalated cases."
        );
      } else {
        setStatusUpdateMessage("Intervention marked as Completed.");
      }
    } catch (err) {
      setStatusUpdateMessage(err.message || "Failed to update intervention status");
    } finally {
      setUpdatingCaseId("");
    }
  }

  function renderInterventionActions(caseItem) {
    const isUpdating = updatingCaseId === caseItem.case_id;

    return (
      <div className="intervention-action-row">
        {canStartIntervention(caseItem) && (
          <button
            type="button"
            className="start-action"
            disabled={isUpdating}
            onClick={() => handleInterventionStatusChange(caseItem, "IN_PROGRESS")}
          >
            {isUpdating ? "Updating..." : "Start"}
          </button>
        )}

        {canCompleteIntervention(caseItem) && (
          <button
            type="button"
            className="complete-action"
            disabled={isUpdating}
            onClick={() => handleInterventionStatusChange(caseItem, "COMPLETED")}
          >
            {isUpdating ? "Updating..." : "Complete"}
          </button>
        )}

        {canEscalateIntervention(caseItem) && (
          <button
            type="button"
            className="escalate-action"
            disabled={isUpdating}
            onClick={() => handleInterventionStatusChange(caseItem, "ESCALATED")}
          >
            Escalate
          </button>
        )}

        {!canStartIntervention(caseItem) &&
          !canCompleteIntervention(caseItem) &&
          !canEscalateIntervention(caseItem) && (
            <span className="intervention-no-action">No action needed</span>
          )}
      </div>
    );
  }

  async function handleCreateIntervention(event) {
    event.preventDefault();

    if (!selectedStudent || !session?.lecturer_number || !selectedStudentCourse) {
      return;
    }

    if (!isStudentAtRisk(selectedStudent)) {
      setInterventionMessage(
        "Intervention cases can only be created for high-risk or moderate-risk students."
      );
      return;
    }

    setCreatingCase(true);
    setInterventionMessage("");

    try {
      const payload = {
        student_number: selectedStudent.student_number,
        course_code: selectedStudentCourse,
        risk_level: getRiskLevel(selectedStudent),
        reason: interventionForm.reason,
        priority: interventionForm.priority,
        created_by_role: "LECTURER",
        created_by_identifier: String(session.lecturer_number),
        follow_up_date: interventionForm.follow_up_date || null,
        note_text: interventionForm.note_text || null,
      };

      await createInterventionCase(payload);

      const cases = await getInterventionCases({
        student_number: selectedStudent.student_number,
        course_code: selectedStudentCourse,
      });

      setInterventionCases(cases || []);
      setInterventionMessage("Intervention case triggered successfully. It can now be started from the Intervention Module.");

      if (activeView === "interventions") {
        loadLecturerInterventions();
      }

      setInterventionForm(getDefaultInterventionForm(selectedStudent));
    } catch (err) {
      setInterventionMessage(err.message || "Failed to create intervention");
    } finally {
      setCreatingCase(false);
    }
  }

  if (loadingCourses) {
    return (
      <div className="lecturer-loading">
        <span className="material-symbols-rounded">progress_activity</span>
        Loading lecturer dashboard...
      </div>
    );
  }

  return (
    <div className="lecturer-dashboard-shell">
      <aside className="lecturer-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <span className="material-symbols-rounded">monitoring</span>
          </div>

          <div>
            <h2>SSPA</h2>
            <p>NUL Analytics System</p>
          </div>
        </div>

        <div className="sidebar-profile">
          <div className="profile-avatar">
            <span className="material-symbols-rounded">person</span>
          </div>

          <div>
            <h3>Lecturer</h3>
            <p>{session?.lecturer_number}</p>
          </div>
        </div>

        <p className="sidebar-title">Navigation</p>

        <nav className="sidebar-nav">
          <button
            type="button"
            className={activeView === "overview" ? "active" : ""}
            onClick={() => setActiveView("overview")}
          >
            <span className="material-symbols-rounded">dashboard</span>
            Course Overview
          </button>

          <button
            type="button"
            className={activeView === "interventions" ? "active" : ""}
            onClick={openInterventionModule}
          >
            <span className="material-symbols-rounded">assignment_ind</span>
            Intervention Module
          </button>

          <button
            type="button"
            className={activeView === "alerts" ? "active" : ""}
            onClick={() => {
              setSelectedStudent(null);
              setActiveView("alerts");
            }}
          >
            <span className="material-symbols-rounded">notifications</span>
            <span className="sidebar-link-text">Alerts & Notifications</span>
            {unreadAlertCount > 0 && (
              <span className="sidebar-alert-badge">
                {formatBadgeCount(unreadAlertCount)}
              </span>
            )}
          </button>
        </nav>

        <button className="sidebar-logout" onClick={logout}>
          <span className="material-symbols-rounded">logout</span>
          Logout
        </button>
      </aside>

      <main className="lecturer-main">
        <header className="lecturer-topbar">
          <div className="topbar-title-block">
            <h1>
              {activeView === "overview"
                ? "Lecturer Dashboard"
                : activeView === "interventions"
                ? "Intervention Module"
                : "Alerts & Notifications"}
            </h1>
            <p>
              {session?.lecturer_number} · {courses.length} assigned course(s)
            </p>
          </div>

          {activeView === "overview" && (
            <div className="topbar-student-search" role="search">
              <span className="material-symbols-rounded">search</span>
              <input
                type="search"
                value={studentSearch}
                onChange={(event) => {
                  setStudentSearch(event.target.value);
                  setSelectedStudent(null);
                }}
                placeholder="Search student by name, student number, email, site, or course..."
              />
              {(studentSearch || riskFilter !== "all") && (
                <button type="button" onClick={resetOverviewFilters}>
                  Clear
                </button>
              )}
            </div>
          )}

          <div className="active-course-box">
            <label>Active course</label>

            <select
              value={activeCourse}
              onChange={(event) => {
                setActiveCourse(event.target.value);
                resetOverviewFilters();
              }}
            >
              {courses.map((course) => (
                <option key={course.course_code} value={course.course_code}>
                  {course.course_code}
                </option>
              ))}
            </select>
          </div>
        </header>

        {error && <div className="dashboard-error">{error}</div>}

        <section className="lecturer-export-panel" aria-label="Lecturer data export controls">
          <div>
            <h2>Data Exports</h2>
            <p>Download examiner-ready CSV reports scoped to this lecturer and selected course.</p>
          </div>

          <div className="lecturer-export-actions">
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
          <div className="dashboard-export-message">{exportMessage}</div>
        )}

        {activeView === "overview" && (
          <>
            <section className="metrics-grid">
              <button
                type="button"
                className={`metric-card blue ${riskFilter === "all" ? "active" : ""}`}
                onClick={() => setRiskFilter("all")}
              >
                <div>
                  <span>Students In My Courses</span>
                  <strong>{activeCourseSummary.students}</strong>
                  <small>{totals.totalStudents} across all assigned courses</small>
                </div>
                <span className="material-symbols-rounded">groups</span>
              </button>

              <button
                type="button"
                className={`metric-card green ${
                  riskFilter === "on-track" ? "active" : ""
                }`}
                onClick={() => setRiskFilter("on-track")}
              >
                <div>
                  <span>On Track</span>
                  <strong>{activeCourseSummary.onTrack}</strong>
                  <small>{totals.onTrack} across all assigned courses</small>
                </div>
                <span className="material-symbols-rounded">check_circle</span>
              </button>

              <button
                type="button"
                className={`metric-card amber ${
                  riskFilter === "moderate" ? "active" : ""
                }`}
                onClick={() => setRiskFilter("moderate")}
              >
                <div>
                  <span>Moderate</span>
                  <strong>{activeCourseSummary.moderate}</strong>
                  <small>{totals.moderate} across all assigned courses</small>
                </div>
                <span className="material-symbols-rounded">warning</span>
              </button>

              <button
                type="button"
                className={`metric-card red ${riskFilter === "high" ? "active" : ""}`}
                onClick={() => setRiskFilter("high")}
              >
                <div>
                  <span>High Risk</span>
                  <strong>{activeCourseSummary.highRisk}</strong>
                  <small>{totals.highRisk} across all assigned courses</small>
                </div>
                <span className="material-symbols-rounded">
                  notifications_active
                </span>
              </button>
            </section>

            <section className="dashboard-grid">
              <article className="panel course-portfolio-panel">
                <div className="panel-header">
                  <div>
                    <h2>My Course Portfolio</h2>
                    <p>
                      Actual courses assigned to lecturer {" "}
                      {session?.lecturer_number}
                    </p>
                  </div>
                </div>

                <div className="table-wrap course-portfolio-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Course</th>
                        <th>Students</th>
                        <th>Avg Score</th>
                        <th>High Risk</th>
                      </tr>
                    </thead>

                    <tbody>
                      {coursePortfolio.map((course) => (
                        <tr
                          key={course.course_code}
                          className={
                            activeCourse === course.course_code
                              ? "selected-row"
                              : ""
                          }
                          onClick={() => {
                            setActiveCourse(course.course_code);
                            resetOverviewFilters();
                          }}
                        >
                          <td>
                            <strong>{course.course_code}</strong>
                            <small>Click to focus course</small>
                          </td>
                          <td>{course.students}</td>
                          <td>
                            {course.avgScore === null
                              ? "N/A"
                              : `${Math.round(course.avgScore)}%`}
                          </td>
                          <td>{course.highRisk}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="panel heatmap-panel">
                <div className="panel-header split heatmap-header">
                  <div>
                    <h2>{heatmapTitle}</h2>
                    <p>{heatmapSubtitle}</p>
                  </div>

                  <div className="panel-actions">
                    <button type="button" onClick={openInterventionModule}>
                      Open intervention module
                    </button>
                  </div>
                </div>

                <div className="risk-legend" aria-label="Risk legend">
                  <button
                    type="button"
                    className={riskFilter === "high" ? "active" : ""}
                    onClick={() => setRiskFilter("high")}
                  >
                    <span className="legend-dot high"></span> High Risk
                  </button>
                  <button
                    type="button"
                    className={riskFilter === "moderate" ? "active" : ""}
                    onClick={() => setRiskFilter("moderate")}
                  >
                    <span className="legend-dot moderate"></span> Moderate
                  </button>
                  <button
                    type="button"
                    className={riskFilter === "on-track" ? "active" : ""}
                    onClick={() => setRiskFilter("on-track")}
                  >
                    <span className="legend-dot on-track"></span> On Track
                  </button>
                  <button
                    type="button"
                    className={riskFilter === "unknown" ? "active" : ""}
                    onClick={() => setRiskFilter("unknown")}
                  >
                    <span className="legend-dot unknown"></span> Unknown
                  </button>
                </div>

                {loadingStudents && (
                  <div className="student-loading">Loading students...</div>
                )}

                {!loadingStudents && baseHeatmapStudents.length === 0 && (
                  <div className="empty-state">
                    {searchQuery
                      ? "No matching student found in this lecturer's assigned courses."
                      : "No students found for this course."}
                  </div>
                )}

                {!loadingStudents &&
                  baseHeatmapStudents.length > 0 &&
                  visibleStudents.length === 0 && (
                    <div className="empty-state">
                      No students match the selected risk filter.
                    </div>
                  )}

                {!loadingStudents && visibleStudents.length > 0 && (
                  <div className="heatmap-grid">
                    {visibleStudents.map((student) => {
                      const risk = getRiskLevel(student);

                      return (
                        <button
                          type="button"
                          key={`${student.__courseCode}-${student.site_id}-${student.student_number}`}
                          className={`student-card ${risk}`}
                          onClick={() => selectStudent(student)}
                        >
                          <span className={`student-risk-pill ${risk}`}>
                            {formatRiskLabel(risk)}
                          </span>
                          <small>{getStudentName(student)}</small>
                          <strong>{formatScore(student.avg_score)}</strong>
                          <span>{student.student_number}</span>
                          <em>{student.__courseCode}</em>
                        </button>
                      );
                    })}
                  </div>
                )}
              </article>
            </section>
          </>
        )}

        {activeView === "interventions" && (
          <>
            <section className="metrics-grid">
              <article className="metric-card blue">
                <div>
                  <span>Triggered</span>
                  <strong>{interventionSummary.triggered}</strong>
                  <small>Created and waiting to start</small>
                </div>
                <span className="material-symbols-rounded">flag</span>
              </article>

              <article className="metric-card amber">
                <div>
                  <span>In Progress</span>
                  <strong>{interventionSummary.inProgress}</strong>
                  <small>Lecturer and student are acting on it</small>
                </div>
                <span className="material-symbols-rounded">pending_actions</span>
              </article>

              <article className="metric-card green">
                <div>
                  <span>Completed</span>
                  <strong>{interventionSummary.completed}</strong>
                  <small>Improvement reviewed and closed</small>
                </div>
                <span className="material-symbols-rounded">task_alt</span>
              </article>

              <article className="metric-card red">
                <div>
                  <span>Escalated</span>
                  <strong>{interventionSummary.escalated}</strong>
                  <small>Requires advisor attention</small>
                </div>
                <span className="material-symbols-rounded">priority_high</span>
              </article>
            </section>

            <section className="intervention-module-grid">
              <article className="panel intervention-module-panel">
                <div className="panel-header split">
                  <div>
                    <h2>My Intervention Cases</h2>
                    <p>
                      Cases created by lecturer {session?.lecturer_number}.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="intervention-refresh-button"
                    onClick={loadLecturerInterventions}
                  >
                    Refresh
                  </button>
                </div>

                <div className="intervention-pipeline-strip" aria-label="Intervention workflow">
                  <span>Triggered</span>
                  <strong>→</strong>
                  <span>In Progress</span>
                  <strong>→</strong>
                  <span>Completed</span>
                </div>

                {statusUpdateMessage && (
                  <div className="intervention-status-message">
                    {statusUpdateMessage}
                  </div>
                )}

                {loadingLecturerCases && (
                  <div className="empty-state">Loading intervention cases...</div>
                )}

                {!loadingLecturerCases &&
                  lecturerInterventionCases.length === 0 && (
                    <div className="empty-state">
                      No intervention cases created yet. Go to Course Overview,
                      click a high-risk or moderate-risk student, then create a
                      case.
                    </div>
                  )}

                {!loadingLecturerCases &&
                  lecturerInterventionCases.length > 0 && (
                    <div className="intervention-module-list">
                      {lecturerInterventionCases.map((caseItem) => (
                        <article
                          className={`intervention-module-card ${String(
                            caseItem.priority || ""
                          ).toLowerCase()}`}
                          key={caseItem.case_id}
                        >
                          <div>
                            <strong>{caseItem.student_number}</strong>
                            <small>
                              {caseItem.course_code} · {caseItem.reason}
                            </small>
                          </div>

                          <div>
                            <span
                              className={`intervention-status-pill ${normalizeInterventionStatus(
                                caseItem.status
                              )}`}
                            >
                              {formatInterventionStatus(caseItem.status)}
                            </span>
                            <small>{caseItem.priority}</small>
                          </div>

                          <div>
                            <span>
                              {caseItem.follow_up_date || "No follow-up date"}
                            </span>
                            <small>{caseItem.note_count || 0} note(s)</small>
                          </div>

                          {renderInterventionActions(caseItem)}
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
            recipientRole="LECTURER"
            recipientIdentifier={String(session?.lecturer_number || "")}
          />
        )}
      </main>

      {selectedStudent && (
        <div
          className="student-modal-backdrop"
          onClick={() => setSelectedStudent(null)}
        >
          <section
            className="student-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="student-modal-header">
              <div>
                <h2>{getStudentName(selectedStudent)}</h2>
                <p>
                  {selectedStudent.student_number} · {selectedStudentCourse}
                </p>
              </div>

              <button type="button" onClick={() => setSelectedStudent(null)}>
                <span className="material-symbols-rounded">close</span>
              </button>
            </header>

            <div className="student-modal-body">
              <div className="student-summary-grid">
                <div>
                  <span>Course</span>
                  <strong>{selectedStudentCourse}</strong>
                </div>

                <div>
                  <span>Risk Level</span>
                  <strong className={`risk-text ${getRiskLevel(selectedStudent)}`}>
                    {formatRiskLabel(getRiskLevel(selectedStudent))}
                  </strong>
                </div>

                <div>
                  <span>Average Score</span>
                  <strong>{formatScore(selectedStudent.avg_score)}</strong>
                </div>

                <div>
                  <span>Assessments Found</span>
                  <strong>{selectedStudent.assessment_count}</strong>
                </div>

                <div>
                  <span>Login Activity</span>
                  <strong>{selectedStudent.login_count}</strong>
                </div>

                <div>
                  <span>Resource Activity</span>
                  <strong>{selectedStudent.resource_count}</strong>
                </div>

                <div>
                  <span>Email</span>
                  <strong>{selectedStudent.email || "N/A"}</strong>
                </div>

                <div>
                  <span>Role</span>
                  <strong>{selectedStudent.site_role || "N/A"}</strong>
                </div>

                <div>
                  <span>Site</span>
                  <strong>{selectedStudent.site_id}</strong>
                </div>
              </div>

              <section className="intervention-panel">
                <div className="intervention-header">
                  <div>
                    <h3>Create Intervention</h3>
                    <p>
                      This creates an official lecturer intervention case for {" "}
                      <strong>{selectedStudentCourse}</strong>.
                    </p>
                  </div>
                </div>

                {!isStudentAtRisk(selectedStudent) && (
                  <div className="intervention-blocked-message">
                    Intervention creation is disabled because this student is not
                    currently high-risk or moderate-risk.
                  </div>
                )}

                {isStudentAtRisk(selectedStudent) && (
                  <form
                    className="intervention-form"
                    onSubmit={handleCreateIntervention}
                  >
                    <label>Reason</label>
                    <select
                      value={interventionForm.reason}
                      onChange={(event) =>
                        setInterventionForm((current) => ({
                          ...current,
                          reason: event.target.value,
                        }))
                      }
                    >
                      <option value="Low academic performance">
                        Low academic performance
                      </option>
                      <option value="Moderate academic risk">
                        Moderate academic risk
                      </option>
                      <option value="No assessment records">
                        No assessment records
                      </option>
                      <option value="Low engagement">Low engagement</option>
                      <option value="Missed assessments">Missed assessments</option>
                      <option value="Coursework below threshold">
                        Coursework below threshold
                      </option>
                    </select>

                    <label>Priority</label>
                    <select
                      value={interventionForm.priority}
                      onChange={(event) =>
                        setInterventionForm((current) => ({
                          ...current,
                          priority: event.target.value,
                        }))
                      }
                    >
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                      <option value="URGENT">URGENT</option>
                    </select>

                    <label>Follow-up Date</label>
                    <input
                      type="date"
                      value={interventionForm.follow_up_date}
                      onChange={(event) =>
                        setInterventionForm((current) => ({
                          ...current,
                          follow_up_date: event.target.value,
                        }))
                      }
                    />

                    <label>Initial Note</label>
                    <textarea
                      value={interventionForm.note_text}
                      onChange={(event) =>
                        setInterventionForm((current) => ({
                          ...current,
                          note_text: event.target.value,
                        }))
                      }
                      placeholder="Example: Contact student and schedule a consultation."
                    />

                    {interventionMessage && (
                      <div className="intervention-message">
                        {interventionMessage}
                      </div>
                    )}

                    <button type="submit" disabled={creatingCase}>
                      {creatingCase ? "Creating..." : "Create Intervention Case"}
                    </button>
                  </form>
                )}
              </section>

              <section className="intervention-panel">
                <div className="intervention-header">
                  <div>
                    <h3>Existing Interventions</h3>
                    <p>Cases already recorded for this student in this course.</p>
                  </div>
                </div>

                {loadingCases && <div className="empty-state">Loading cases...</div>}

                {!loadingCases && interventionCases.length === 0 && (
                  <div className="empty-state">
                    No intervention cases found for this student and course.
                  </div>
                )}

                {!loadingCases && interventionCases.length > 0 && (
                  <div className="intervention-case-list">
                    {interventionCases.map((caseItem) => (
                      <article
                        key={caseItem.case_id}
                        className="intervention-case-card"
                      >
                        <div>
                          <strong>{caseItem.reason}</strong>
                          <small>
                            {formatInterventionStatus(caseItem.status)} · {caseItem.priority} · {" "}
                            {caseItem.note_count || 0} note(s)
                          </small>
                        </div>

                        <div className="intervention-case-side">
                          <span>{caseItem.follow_up_date || "No follow-up date"}</span>
                          {renderInterventionActions(caseItem)}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
