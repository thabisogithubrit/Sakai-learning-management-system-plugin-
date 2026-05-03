import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import HomePage from "./modules/home/HomePage";

import LecturerDashboardPage from "./modules/lecturer/LecturerDashboardPage";
import StudentDashboardPage from "./modules/student/StudentDashboardPage";
import AdvisorDashboardPage from "./modules/advisor/AdvisorDashboardPage";
import AdminDashboardPage from "./modules/admin/AdminDashboardPage";

import Layer1ETLDashboardPage from "./modules/etl/Layer1ETLDashboardPage";
import ETLDashboardPage from "./modules/etl/ETLDashboardPage";

import PredictiveAnalyticsPage from "./modules/predictive/PredictiveAnalyticsPage";

import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route path="/lecturer/dashboard" element={<LecturerDashboardPage />} />

        <Route path="/student/dashboard" element={<StudentDashboardPage />} />

        <Route path="/advisor/dashboard" element={<AdvisorDashboardPage />} />

        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />

        <Route path="/etl/layer1" element={<Layer1ETLDashboardPage />} />

        <Route path="/etl/dashboard" element={<ETLDashboardPage />} />

        <Route path="/predictive-analytics" element={<PredictiveAnalyticsPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
