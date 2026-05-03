import { apiGet, apiPost } from "./apiClient";

export function getFacultyAdmins() {
  return apiGet("/faculty-admin/admins");
}

export function getFaculties() {
  return apiGet("/faculty-admin/faculties");
}

export function simulateFacultyAdminLogin(adminIdentifier) {
  return apiPost("/faculty-admin/simulate-login", {
    admin_identifier: adminIdentifier,
  });
}

export function getFacultyAdminDashboard(adminIdentifier) {
  return apiGet(`/faculty-admin/dashboard/${adminIdentifier}`);
}

export function getFacultyStudentProfile(adminIdentifier, studentNumber) {
  return apiGet(
    `/faculty-admin/students/${adminIdentifier}/${studentNumber}/profile`
  );
}

export function getUnmappedCourses() {
  return apiGet("/faculty-admin/unmapped-courses");
}

export function assignCourseToFaculty(payload) {
  return apiPost("/faculty-admin/course-allocation", payload);
}
