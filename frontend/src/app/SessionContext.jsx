import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getSessionContext } from "../services/sessionAdapter";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        setLoading(true);
        const data = await getSessionContext();
        if (!active) return;
        setSession(data);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Failed to load session context.");
        setSession(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSession();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      loading,
      error,
    }),
    [session, loading, error]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used inside SessionProvider.");
  }
  return ctx;
}
