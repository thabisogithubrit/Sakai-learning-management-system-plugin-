import { apiGet, apiPatch, apiPost } from "./apiClient";

export function getInterventionCases(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      params.append(key, value);
    }
  });

  const query = params.toString();

  return apiGet(`/interventions/cases${query ? `?${query}` : ""}`);
}

export function getInterventionCase(caseId) {
  return apiGet(`/interventions/cases/${caseId}`);
}

export function getStudentInterventionCases(studentNumber) {
  return getInterventionCases({
    student_number: studentNumber,
  });
}

export function createInterventionCase(payload) {
  return apiPost("/interventions/cases", payload);
}

export function addInterventionNote(caseId, payload) {
  return apiPost(`/interventions/cases/${caseId}/notes`, payload);
}

export function updateInterventionStatus(caseId, payload) {
  return apiPatch(`/interventions/cases/${caseId}/status`, payload);
}

export function addInterventionOutcome(caseId, payload) {
  return apiPost(`/interventions/cases/${caseId}/outcome`, payload);
}
