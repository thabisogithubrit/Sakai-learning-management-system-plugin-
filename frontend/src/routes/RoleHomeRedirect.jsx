import { Navigate } from "react-router-dom";
import { useSession } from "../app/SessionContext";

export default function RoleHomeRedirect() {
  const { session } = useSession();

  const roleToPath = {
    STUDENT: "/student/dashboard",
    LECTURER: "/lecturer/dashboard",
    ADVISOR: "/advisor/dashboard",
    FACULTY_ADMIN: "/faculty-admin/dashboard",
    SYSTEM_ADMIN: "/system-admin/dashboard",
  };

  const destination = roleToPath[session?.role] || "/unauthorized";
  return <Navigate to={destination} replace />;
}
