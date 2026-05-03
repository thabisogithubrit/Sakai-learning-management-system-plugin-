import { NavLink, Outlet } from "react-router-dom";
import { useSession } from "../app/SessionContext";

const NAV_BY_ROLE = {
  STUDENT: [{ to: "/student/dashboard", label: "Dashboard" }],
  LECTURER: [{ to: "/lecturer/dashboard", label: "Dashboard" }],
  ADVISOR: [{ to: "/advisor/dashboard", label: "Dashboard" }],
};

function activeLinkStyle({ isActive }) {
  return {
    display: "block",
    padding: "10px 12px",
    borderRadius: "8px",
    textDecoration: "none",
    color: isActive ? "#0f172a" : "#334155",
    background: isActive ? "#e2e8f0" : "transparent",
    fontWeight: isActive ? 600 : 400,
    marginBottom: "6px",
  };
}

export default function RoleScopedLayout() {
  const { session } = useSession();
  const navItems = NAV_BY_ROLE[session?.role] || [];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "280px 1fr",
        minHeight: "calc(100vh - 64px)",
      }}
    >
      <aside
        style={{
          borderRight: "1px solid #e2e8f0",
          background: "#ffffff",
          padding: "18px",
        }}
      >
        <div style={{ marginBottom: "18px" }}>
          <div style={{ fontSize: "12px", color: "#64748b" }}>Scoped application</div>
          <div style={{ fontWeight: 700, marginTop: "4px" }}>{session?.role}</div>
          <div style={{ marginTop: "8px", fontSize: "13px", color: "#475569" }}>
            {session?.displayName}
          </div>
        </div>

        <nav>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} style={activeLinkStyle}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main style={{ padding: "24px" }}>
        <Outlet />
      </main>
    </div>
  );
}