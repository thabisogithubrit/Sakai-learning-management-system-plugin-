export const mockLecturerDirectory = [
  {
    userId: "lecturer-001",
    lecturerId: "lec-001",
    displayName: "Dr. Mpho Rakotsoane",
    role: "LECTURER",
    facultyId: "FST",
    courseAllocations: [
      {
        courseId: "CSC201",
        courseCode: "CSC201",
        courseTitle: "Data Structures and Algorithms",
      },
      {
        courseId: "CSC204",
        courseCode: "CSC204",
        courseTitle: "Web Development",
      },
    ],
  },
  {
    userId: "lecturer-002",
    lecturerId: "lec-002",
    displayName: "Ms. Lineo Sefako",
    role: "LECTURER",
    facultyId: "FST",
    courseAllocations: [
      {
        courseId: "CSC202",
        courseCode: "CSC202",
        courseTitle: "Database Systems",
      },
    ],
  },
];

const mockCourseAnalytics = {
  CSC201: {
    courseId: "CSC201",
    courseCode: "CSC201",
    courseTitle: "Data Structures and Algorithms",
    qualificationThreshold: 50,
    studentsTotal: 42,
    likelyQualifiedCount: 28,
    belowThresholdCount: 14,
    averageCourseworkMark: 54.6,
    onTimeSubmissionRate: 78,
    resourceEngagementRate: 67,
    flaggedStudents: [
      {
        studentId: "stu-101",
        studentName: "Tumelo Qhobela",
        currentCourseworkMark: 41,
        thresholdGap: -9,
        qualificationLikelihood: 34,
        recentSignal: "Low login activity and missed assessment",
        alertsCount: 2,
      },
      {
        studentId: "stu-102",
        studentName: "Lerato Mofokeng",
        currentCourseworkMark: 46,
        thresholdGap: -4,
        qualificationLikelihood: 45,
        recentSignal: "Late submissions increasing",
        alertsCount: 1,
      },
      {
        studentId: "stu-103",
        studentName: "Mpho Sechele",
        currentCourseworkMark: 52,
        thresholdGap: 2,
        qualificationLikelihood: 63,
        recentSignal: "Borderline but improving",
        alertsCount: 0,
      },
    ],
  },
  CSC204: {
    courseId: "CSC204",
    courseCode: "CSC204",
    courseTitle: "Web Development",
    qualificationThreshold: 50,
    studentsTotal: 38,
    likelyQualifiedCount: 30,
    belowThresholdCount: 8,
    averageCourseworkMark: 61.2,
    onTimeSubmissionRate: 84,
    resourceEngagementRate: 71,
    flaggedStudents: [
      {
        studentId: "stu-201",
        studentName: "Kananelo Ramathe",
        currentCourseworkMark: 44,
        thresholdGap: -6,
        qualificationLikelihood: 39,
        recentSignal: "Missing required coursework",
        alertsCount: 2,
      },
      {
        studentId: "stu-202",
        studentName: "Neo Tšoeu",
        currentCourseworkMark: 49,
        thresholdGap: -1,
        qualificationLikelihood: 49,
        recentSignal: "Near threshold, needs one strong assessment",
        alertsCount: 1,
      },
    ],
  },
  CSC202: {
    courseId: "CSC202",
    courseCode: "CSC202",
    courseTitle: "Database Systems",
    qualificationThreshold: 50,
    studentsTotal: 40,
    likelyQualifiedCount: 26,
    belowThresholdCount: 14,
    averageCourseworkMark: 53.1,
    onTimeSubmissionRate: 74,
    resourceEngagementRate: 64,
    flaggedStudents: [
      {
        studentId: "stu-301",
        studentName: "Teboho Ntlamelle",
        currentCourseworkMark: 43,
        thresholdGap: -7,
        qualificationLikelihood: 36,
        recentSignal: "Weak test completion ratio",
        alertsCount: 1,
      },
    ],
  },
};

export function findMockLecturerByUserId(userId) {
  return mockLecturerDirectory.find((lecturer) => lecturer.userId === userId) || null;
}

export function getMockLecturerDashboardPayload(session, selectedCourseId) {
  const lecturer = findMockLecturerByUserId(session?.userId) || mockLecturerDirectory[0];

  const scopedCourses = lecturer.courseAllocations.filter((course) =>
    session?.allowedCourseIds?.includes(course.courseId)
  );

  const activeCourseId = selectedCourseId || scopedCourses[0]?.courseId;
  const activeCourse = mockCourseAnalytics[activeCourseId];

  return {
    lecturer: {
      userId: lecturer.userId,
      lecturerId: lecturer.lecturerId,
      displayName: lecturer.displayName,
      facultyId: lecturer.facultyId,
      role: lecturer.role,
    },
    scopedCourses,
    selectedCourseId: activeCourseId,
    courseSummary: activeCourse || null,
  };
}