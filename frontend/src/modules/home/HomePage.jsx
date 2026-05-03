import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../../services/apiClient";
import "./HomePage.css";

export default function HomePage() {
  const navigate = useNavigate();

  const [role, setRole] = useState("");
  const [lecturerNumber, setLecturerNumber] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      const result = await apiPost("/me/simulate-login", {
        role,
        password,
        lecturer_number: role === "LECTURER" ? lecturerNumber : null,
        student_number: role === "STUDENT" ? studentNumber : null,
      });

      localStorage.setItem("sspa_session", JSON.stringify(result.session));
      localStorage.setItem("sspa_role", result.session.role);

      if (result.access_token) {
        localStorage.setItem("sspa_access_token", result.access_token);
      }

      if (result.token_type) {
        localStorage.setItem("sspa_token_type", result.token_type);
      }

      if (result.expires_at) {
        localStorage.setItem("sspa_token_expires_at", result.expires_at);
      }

      if (result.session.role === "LECTURER") {
        navigate("/lecturer/dashboard");
        return;
      }

      if (result.session.role === "STUDENT") {
        navigate("/student/dashboard");
        return;
      }

      if (result.session.role === "ADVISOR") {
        navigate("/advisor/dashboard");
        return;
      }

      if (result.session.role === "ADMIN") {
        navigate("/admin/dashboard");
        return;
      }

      setError("Only Student, Lecturer, Advisor, and Admin dashboards are active for now.");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="home-page">
      <section className="home-shell">
        <aside className="home-left">
          <div className="home-brand">
            <div className="home-logo">
              <span className="material-symbols-rounded">monitoring</span>
            </div>

            <div>
              <h1>SSPA</h1>
              <p>Sakai Student Success & Predictive Analytics</p>
            </div>
          </div>

          <div className="home-copy">
            <span>RBAC Simulation</span>
            <h2>Choose your Sakai role</h2>
            <p>
              This login screen simulates Sakai role-based access with
              static role passwords while the real Sakai API is not yet connected.
            </p>
          </div>
        </aside>

        <section className="home-card">
          <form className="home-form" onSubmit={handleSubmit}>
            <div className="form-header">
              <h2>Access Dashboard</h2>
            </div>

            <label>Role</label>

            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPassword("");
                setError("");
                setLecturerNumber("");
                setStudentNumber("");
              }}
              required
            >
              <option value="">Select role</option>
              <option value="STUDENT">Student</option>
              <option value="LECTURER">Lecturer</option>
              <option value="ADVISOR">Advisor</option>
              <option value="ADMIN">Admin</option>
            </select>

            {role && (
              <>
                <label>{role.charAt(0) + role.slice(1).toLowerCase()} Password</label>

                <input
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                  }}
                  placeholder={`Enter ${role.toLowerCase()} password`}
                  autoComplete="current-password"
                  required
                />
              </>
            )}

            {role === "LECTURER" && (
              <>
                <label>Lecturer Number</label>

                <input
                  type="text"
                  value={lecturerNumber}
                  onChange={(event) => {
                    setLecturerNumber(event.target.value);
                    setError("");
                  }}
                  placeholder="Enter lecturer number"
                  required
                />
              </>
            )}

            {role === "STUDENT" && (
              <>
                <label>Student Number</label>

                <input
                  type="text"
                  value={studentNumber}
                  onChange={(event) => {
                    setStudentNumber(event.target.value);
                    setError("");
                  }}
                  placeholder="Enter student number"
                  required
                />
              </>
            )}

            {role === "ADVISOR" && (
              <div className="advisor-access-box">
                <span className="material-symbols-rounded">supervisor_account</span>
                <div>
                  <strong>Advisor Access</strong>
                  <p>
                    Advisor access opens a real overview of students, courses,
                    and risk indicators from Sakai raw data.
                  </p>
                </div>
              </div>
            )}

            {role === "ADMIN" && (
              <div className="advisor-access-box">
                <span className="material-symbols-rounded">admin_panel_settings</span>
                <div>
                  <strong>Admin Access</strong>
                  <p>
                    Admin access opens the system control dashboard for ETL,
                    feature store, predictive analytics, notifications, and
                    module readiness.
                  </p>
                </div>
              </div>
            )}

            {/* Login errors are hidden from the UI to avoid showing backend RBAC messages here. */}

            <button
              type="submit"
              disabled={
                submitting ||
                !role ||
                !password ||
                (role === "LECTURER" && !lecturerNumber) ||
                (role === "STUDENT" && !studentNumber)
              }
            >
              {submitting ? "Checking..." : "Continue"}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}