const API_BASE_URL = "http://localhost:8000";

function getToken() {
  return localStorage.getItem("sspa_access_token");
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem("sspa_session") || "{}");
  } catch {
    return {};
  }
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.append(key, value);
    }
  });

  return query.toString();
}

function getFileNameFromResponse(response, fallbackName) {
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);

  return match?.[1] || fallbackName;
}

export async function downloadReportCsv(arg1 = {}, arg2 = undefined, arg3 = undefined) {
  const session = getSession();

  let reportType = "at-risk-students";
  let lecturerNumber =
    session.lecturer_number ||
    session.lecturerNumber ||
    session.userId ||
    session.user_id ||
    "";

  let courseCode = "";

  /*
    Supported calls:

    downloadReportCsv({
      reportType: "at-risk-students",
      lecturerNumber: "199611855",
      courseCode: "M1506"
    })

    downloadReportCsv("at-risk-students", "199611855", "M1506")

    downloadReportCsv("at-risk-students", {
      lecturerNumber: "199611855",
      courseCode: "M1506"
    })
  */

  if (typeof arg1 === "object" && arg1 !== null) {
    reportType = arg1.reportType || arg1.report_type || arg1.type || reportType;

    lecturerNumber =
      arg1.lecturerNumber ||
      arg1.lecturer_number ||
      lecturerNumber;

    courseCode = arg1.courseCode || arg1.course_code || "";
  } else {
    reportType = arg1 || reportType;

    if (typeof arg2 === "object" && arg2 !== null) {
      lecturerNumber =
        arg2.lecturerNumber ||
        arg2.lecturer_number ||
        lecturerNumber;

      courseCode = arg2.courseCode || arg2.course_code || "";
    } else {
      lecturerNumber = arg2 || lecturerNumber;
      courseCode = arg3 || "";
    }
  }

  if (!lecturerNumber) {
    throw new Error("Cannot export report because lecturer number is missing.");
  }

  const token = getToken();

  if (!token) {
    throw new Error("Missing login token. Please log in again.");
  }

  const query = buildQuery({
    report_type: reportType,
    lecturer_number: lecturerNumber,
    course_code: courseCode,
  });

  const requestUrl = `${API_BASE_URL}/reports/lecturer/export.csv?${query}`;

  const response = await fetch(requestUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    localStorage.removeItem("sspa_access_token");
    localStorage.removeItem("sspa_token_type");
    localStorage.removeItem("sspa_session");
    localStorage.removeItem("sspa_role");

    throw new Error("Session expired. Please log in again.");
  }

  if (response.status === 404) {
    throw new Error(
      `Report export endpoint was not found. The frontend called: ${requestUrl}`
    );
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || `Report export failed with status ${response.status}`);
  }

  const blob = await response.blob();

  const filename = getFileNameFromResponse(
    response,
    `sspa_${reportType}_${lecturerNumber}_${courseCode || "all_courses"}.csv`
  );

  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(downloadUrl);

  return {
    success: true,
    filename,
  };
}