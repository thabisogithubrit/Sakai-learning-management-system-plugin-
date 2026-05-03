import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "../app/SessionContext";

export default function ProtectedRoute({ allowedRoles }) {
  const { session, loading, error } = useSession();

  if (loading) {
    return (
      <div style={{ padding: "24px", fontFamily: "Arial, sans-serif" }}>
        <h2>Loading session...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "24px", fontFamily: "Arial, sans-serif" }}>
        <h2>Session error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
