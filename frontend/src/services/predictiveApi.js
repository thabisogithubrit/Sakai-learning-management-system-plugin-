import { apiGet, apiPost } from "./apiClient";

export function getPredictiveOverview() {
  return apiGet("/predictive/overview");
}

export function getPredictiveModels(limit = 20) {
  return apiGet(`/predictive/models?limit=${limit}`);
}

export function getPredictions(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      params.append(key, value);
    }
  });

  const query = params.toString();

  return apiGet(`/predictive/predictions${query ? `?${query}` : ""}`);
}

export function getTrainingDatasetStats() {
  return apiGet("/predictive/training-dataset/stats");
}

export function getFeatureImportance(modelId) {
  return apiGet(`/predictive/models/${modelId}/feature-importance`);
}

export function trainPredictiveModel(payload) {
  return apiPost("/predictive/train", payload);
}
