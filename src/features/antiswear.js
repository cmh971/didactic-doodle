// Temporary AI anti-swear mode. When enabled it stays on for exactly 4m30s,
// deleting bad-word messages and warning the sender (detection in gemini.isProfane).
export const DURATION = 4 * 60 * 1000 + 30 * 1000; // 4m30s = 270000ms

const active = new Map(); // guildId -> expiry timestamp (ms)

export function enable(guildId) {
  const until = Date.now() + DURATION;
  active.set(guildId, until);
  return until;
}

export function disable(guildId) {
  active.delete(guildId);
}

export function isActive(guildId) {
  const until = active.get(guildId);
  if (!until) return false;
  if (Date.now() > until) {
    active.delete(guildId);
    return false;
  }
  return true;
}

export function remaining(guildId) {
  const until = active.get(guildId);
  return until ? Math.max(0, until - Date.now()) : 0;
}
