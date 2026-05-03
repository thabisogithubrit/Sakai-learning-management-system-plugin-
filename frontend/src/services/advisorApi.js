import { apiGet } from "./apiClient";

export function getAdvisorDashboard() {
  return apiGet("/advisor/dashboard");
}

export function getAdvisorStudentProfile(studentNumber) {
  return apiGet(`/advisor/students/${studentNumber}/profile`);
}