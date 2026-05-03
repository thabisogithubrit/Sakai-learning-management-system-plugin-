import { apiGet } from "./apiClient";

export async function getLecturerDashboard(session, courseId) {
  if (!session) {
    throw new Error("Session context is required.");
  }

  if (session.role !== "LECTURER") {
    throw new Error("Lecturer dashboard requested with non-lecturer session.");
  }

  return apiGet("/api/v1/lecturer/dashboard", {
    session,
    params: { courseId },
  });
}
