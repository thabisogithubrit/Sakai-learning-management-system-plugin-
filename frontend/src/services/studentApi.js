import { apiGet } from "./apiClient";

export function getStudentDashboard(studentNumber) {
  return apiGet(`/student/${studentNumber}/dashboard`);
}

export function getStudentCourses(studentNumber) {
  return apiGet(`/student/${studentNumber}/courses`);
}