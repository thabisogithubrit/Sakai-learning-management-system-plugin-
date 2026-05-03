const API_BASE_URL = "http://localhost:8000";

function getSessionHeaders() {
  try {
    const session = JSON.parse(localStorage.getItem("sspa_session"));
    const accessToken = localStorage.getItem("sspa_access_token");

    const headers = {};

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    if (!session) {
      return headers;
    }

    return {
      ...headers,
      "X-Role": session.role || "",
      "X-User-Id":
        session.user_id ||
        session.userId ||
        session.lecturer_number ||
        session.student_number ||
        "",
      "X-Lecturer-Number": session.lecturer_number || "",
      "X-Student-Number": session.student_number || "",
      "X-Display-Name": session.display_name || session.displayName || "",
    };
  } catch {
    const accessToken = localStorage.getItem("sspa_access_token");
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...getSessionHeaders(),
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();

  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      data?.detail ||
      data?.message ||
      `Request failed with status ${response.status}`;

    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  return data;
}

export function apiGet(path) {
  return request(path);
}

export function apiPost(path, body) {
  return request(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function apiPatch(path, body) {
  return request(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
