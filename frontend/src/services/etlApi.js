import { apiGet, apiPost } from "./apiClient";

export function getLayer1ETLOverview() {
  return apiGet("/etl/layer1/overview");
}

export function refreshLayer1ETLMonitoring() {
  return apiPost("/etl/layer1/refresh", {});
}

export function getLayer1TableProfiles() {
  return apiGet("/etl/layer1/table-profiles");
}

export function getLayer1QualityChecks() {
  return apiGet("/etl/layer1/quality-checks");
}

export function getLayer1ImportRuns(limit = 50) {
  return apiGet(`/etl/layer1/import-runs?limit=${limit}`);
}

export function getLayer1ImportFiles(runId = "") {
  const query = runId ? `?run_id=${encodeURIComponent(runId)}` : "";
  return apiGet(`/etl/layer1/import-files${query}`);
}

export function getLayer1ImportErrors(fileId = "") {
  const query = fileId ? `?file_id=${encodeURIComponent(fileId)}` : "";
  return apiGet(`/etl/layer1/import-errors${query}`);
}

export function getLayer1ExpectedFiles() {
  return apiGet("/etl/layer1/expected-files");
}
