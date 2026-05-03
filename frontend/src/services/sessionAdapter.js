import { DEV_SESSION_PROFILES } from "./devSessionProfiles";

const ACTIVE_DEV_PROFILE = import.meta.env.VITE_DEV_SESSION_PROFILE || "LECTURER";

export async function getSessionContext() {
  // Temporary placeholder only.
  // Replace this with the real Sakai-issued session/context later.
  return Promise.resolve(
    DEV_SESSION_PROFILES[ACTIVE_DEV_PROFILE] || DEV_SESSION_PROFILES.LECTURER
  );
}
