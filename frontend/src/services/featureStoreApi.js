import { apiGet, apiPost } from "./apiClient";

function buildQuery(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      params.append(key, value);
    }
  });

  const query = params.toString();

  return query ? `?${query}` : "";
}

async function firstSuccessfulRequest(paths, runner) {
  const candidates = Array.isArray(paths) ? paths : [paths];
  let lastError = null;

  for (const path of candidates) {
    try {
      return await runner(path);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Feature store request failed");
}

export function getFeatureStoreOverview() {
  return firstSuccessfulRequest(
    ["/feature-store/overview", "/etl/feature-store/overview", "/etl/dashboard/overview"],
    apiGet
  );
}

export function refreshFeatureStore() {
  return firstSuccessfulRequest(
    ["/feature-store/refresh", "/etl/feature-store/refresh", "/etl/dashboard/refresh"],
    (path) => apiPost(path, { triggered_by: "FRONTEND" })
  );
}

export function getStudentCourseFeatures(filters = {}) {
  const query = buildQuery(filters);

  return firstSuccessfulRequest(
    [`/feature-store/features${query}`, `/etl/feature-store/features${query}`],
    apiGet
  );
}

export function getTrainingDataset(filters = {}) {
  const query = buildQuery(filters);

  return firstSuccessfulRequest(
    [`/feature-store/training-dataset${query}`, `/etl/feature-store/training-dataset${query}`],
    apiGet
  );
}

export function getFeatureStoreCourses() {
  return firstSuccessfulRequest(
    ["/feature-store/courses", "/etl/feature-store/courses"],
    apiGet
  );
}

export function getFeatureCatalog() {
  return firstSuccessfulRequest(
    ["/feature-store/catalog", "/etl/feature-store/catalog"],
    apiGet
  );
}

export function getFeatureRefreshLogs(limit = 20) {
  return firstSuccessfulRequest(
    [`/feature-store/refresh-logs?limit=${limit}`, `/etl/feature-store/refresh-logs?limit=${limit}`],
    apiGet
  );
}

export function logTrainingExport(exportedBy = "FRONTEND", notes = "") {
  const params = new URLSearchParams();

  params.append("exported_by", exportedBy);

  if (notes) {
    params.append("notes", notes);
  }

  return firstSuccessfulRequest(
    [
      `/feature-store/training-export-log?${params.toString()}`,
      `/etl/feature-store/training-export-log?${params.toString()}`,
    ],
    (path) => apiPost(path, {})
  );
}
