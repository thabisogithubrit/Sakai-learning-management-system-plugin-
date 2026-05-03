import { useEffect, useMemo, useState } from "react";
import {
  dismissAlert,
  getAlerts,
  markAlertAsRead,
} from "../../services/notificationApi";
import "./AlertsPage.css";

function formatDate(value) {
  if (!value) return "N/A";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function AlertsPage({ recipientRole, recipientIdentifier }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [message, setMessage] = useState("");

  function loadAlerts() {
    if (!recipientRole || !recipientIdentifier) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    getAlerts({
      recipient_role: recipientRole,
      recipient_identifier: recipientIdentifier,
    })
      .then((data) => setAlerts(data || []))
      .catch((err) => setMessage(err.message || "Failed to load alerts"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAlerts();
  }, [recipientRole, recipientIdentifier]);

  const summary = useMemo(() => {
    return alerts.reduce(
      (acc, alert) => {
        acc.total += 1;

        if (alert.status === "UNREAD") acc.unread += 1;
        if (alert.status === "READ") acc.read += 1;
        if (alert.status === "DISMISSED") acc.dismissed += 1;
        if (alert.severity === "CRITICAL") acc.critical += 1;
        if (alert.severity === "WARNING") acc.warning += 1;
        if (alert.severity === "SUCCESS") acc.success += 1;

        return acc;
      },
      {
        total: 0,
        unread: 0,
        read: 0,
        dismissed: 0,
        critical: 0,
        warning: 0,
        success: 0,
      }
    );
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && alert.status !== "DISMISSED") ||
        alert.status === statusFilter;

      const matchesSeverity =
        severityFilter === "ALL" || alert.severity === severityFilter;

      return matchesStatus && matchesSeverity;
    });
  }, [alerts, statusFilter, severityFilter]);

  async function handleMarkRead(alertId) {
    try {
      await markAlertAsRead(alertId, recipientRole, recipientIdentifier);
      loadAlerts();
    } catch (err) {
      setMessage(err.message || "Failed to mark alert as read");
    }
  }

  async function handleDismiss(alertId) {
    try {
      await dismissAlert(alertId, recipientRole, recipientIdentifier);
      loadAlerts();
    } catch (err) {
      setMessage(err.message || "Failed to dismiss alert");
    }
  }

  return (
    <>
      <section className="alerts-metrics-grid">
        <article className="alerts-metric-card blue">
          <div>
            <span>Total Alerts</span>
            <strong>{summary.total}</strong>
          </div>
          <span className="material-symbols-rounded">notifications</span>
        </article>

        <article className="alerts-metric-card amber">
          <div>
            <span>Unread</span>
            <strong>{summary.unread}</strong>
          </div>
          <span className="material-symbols-rounded">mark_email_unread</span>
        </article>

        <article className="alerts-metric-card red">
          <div>
            <span>Critical</span>
            <strong>{summary.critical}</strong>
          </div>
          <span className="material-symbols-rounded">priority_high</span>
        </article>

        <article className="alerts-metric-card green">
          <div>
            <span>Success</span>
            <strong>{summary.success}</strong>
          </div>
          <span className="material-symbols-rounded">task_alt</span>
        </article>
      </section>

      <section className="alerts-page">
        <article className="alerts-panel">
          <div className="alerts-panel-header">
            <div>
              <h2>Alerts & Notifications</h2>
              <p>
                Important messages, intervention updates, and follow-up
                reminders.
              </p>
            </div>

            <div className="alerts-filters">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ACTIVE">Active</option>
                <option value="ALL">All</option>
                <option value="UNREAD">Unread</option>
                <option value="READ">Read</option>
                <option value="DISMISSED">Dismissed</option>
              </select>

              <select
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value)}
              >
                <option value="ALL">All severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="WARNING">Warning</option>
                <option value="INFO">Info</option>
                <option value="SUCCESS">Success</option>
              </select>

              <button type="button" onClick={loadAlerts}>
                Refresh
              </button>
            </div>
          </div>

          {message && <div className="alerts-message">{message}</div>}

          {loading && <div className="alerts-empty">Loading alerts...</div>}

          {!loading && filteredAlerts.length === 0 && (
            <div className="alerts-empty">No alerts found.</div>
          )}

          {!loading && filteredAlerts.length > 0 && (
            <div className="alerts-list">
              {filteredAlerts.map((alert) => (
                <article
                  key={alert.alert_id}
                  className={`alerts-card ${String(
                    alert.severity || ""
                  ).toLowerCase()} ${String(alert.status || "").toLowerCase()}`}
                >
                  <div className="alerts-card-icon">
                    <span className="material-symbols-rounded">
                      {alert.severity === "CRITICAL"
                        ? "priority_high"
                        : alert.severity === "WARNING"
                        ? "warning"
                        : alert.severity === "SUCCESS"
                        ? "task_alt"
                        : "notifications"}
                    </span>
                  </div>

                  <div className="alerts-card-body">
                    <div className="alerts-card-title-row">
                      <h3>{alert.title}</h3>
                      <span>{alert.status}</span>
                    </div>

                    <p>{alert.message}</p>

                    <div className="alerts-meta">
                      <small>{alert.alert_type}</small>
                      <small>{alert.course_code || "No course"}</small>
                      <small>{formatDate(alert.created_at)}</small>
                    </div>
                  </div>

                  <div className="alerts-actions">
                    {alert.status === "UNREAD" && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(alert.alert_id)}
                      >
                        Mark read
                      </button>
                    )}

                    {alert.status !== "DISMISSED" && (
                      <button
                        type="button"
                        onClick={() => handleDismiss(alert.alert_id)}
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>
    </>
  );
}