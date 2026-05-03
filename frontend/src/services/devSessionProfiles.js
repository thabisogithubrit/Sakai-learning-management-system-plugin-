export const DEV_SESSION_PROFILES = {
  LECTURER: {
    userId: "lecturer-001",
    displayName: "Dr. Mpho Rakotsoane",
    role: "LECTURER",
    facultyId: "FST",
    allowedCourseIds: ["CSC201", "CSC204"],
    allowedStudentIds: [],
  },
  STUDENT: {
    userId: "student-001",
    displayName: "Tumelo Qhobela",
    role: "STUDENT",
    facultyId: "FST",
    allowedCourseIds: ["CSC201", "CSC204", "MAT201"],
    allowedStudentIds: [],
  },
  ADVISOR: {
    userId: "advisor-001",
    displayName: "Ms. Lineo Sefako",
    role: "ADVISOR",
    facultyId: "FST",
    allowedCourseIds: [],
    allowedStudentIds: ["stu-201", "stu-202", "stu-203"],
  },
};