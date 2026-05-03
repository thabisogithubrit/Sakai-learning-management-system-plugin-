import { Outlet } from "react-router-dom";
import { useSession } from "./SessionContext";

export default function AppShell() {
  const { session } = useSession();

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
      <header
        style={{
          height: "64px",
          borderBottom: "1px solid #e2e8f0",
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
        }}
      >
        <div>
          <strong>SSPA</strong>
          <div style={{ fontSize: "12px", color: "#475569" }}>
            Sakai Student Success & Predictive Analytics
          </div>
        </div>

        <div style={{ textAlign: "right", fontSize: "14px" }}>
          <div>{session?.displayName || "Unknown User"}</div>
          <div style={{ color: "#64748b", fontSize: "12px" }}>{session?.role || "Unknown Role"}</div>
        </div>
      </header>

      <div style={{ minHeight: "calc(100vh - 64px)" }}>
        <Outlet />
      </div>
    </div>
  );
}
