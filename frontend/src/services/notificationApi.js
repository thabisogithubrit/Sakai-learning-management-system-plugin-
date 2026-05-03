import { apiGet, apiPatch, apiPost } from "./apiClient";

export function getAlerts(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      params.append(key, value);
    }
  });

  const query = params.toString();

  return apiGet(`/notifications/alerts${query ? `?${query}` : ""}`);
}

export function getUnreadAlertCount(recipientRole, recipientIdentifier) {
  const params = new URLSearchParams();

  params.append("recipient_role", recipientRole);
  params.append("recipient_identifier", recipientIdentifier);

  return apiGet(`/notifications/unread-count?${params.toString()}`);
}

export function markAlertAsRead(alertId, changedByRole, changedByIdentifier) {
  return apiPatch(`/notifications/alerts/${alertId}/status`, {
    status: "READ",
    changed_by_role: changedByRole,
    changed_by_identifier: String(changedByIdentifier),
    change_reason: "User marked alert as read",
  });
}

export function dismissAlert(alertId, changedByRole, changedByIdentifier) {
  return apiPatch(`/notifications/alerts/${alertId}/status`, {
    status: "DISMISSED",
    changed_by_role: changedByRole,
    changed_by_identifier: String(changedByIdentifier),
    change_reason: "User dismissed alert",
  });
}

export function createAlert(payload) {
  return apiPost("/notifications/alerts", payload);
}