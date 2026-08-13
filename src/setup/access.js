// Per-guild setup allowlist — lets specific users open the setup wizard in a
// specific server WITHOUT the Manage Server permission. Scoped tightly on
// purpose: an entry only grants access in the one guild it's listed under, and
// nowhere else. This is separate from the global-owner powers.
//
// Shape: { [guildId]: Set<userId> }
const SETUP_ALLOWLIST = {
  // PRPC | Department of Homeland Security (DHS)
  '1400502228355125389': new Set([
    '1312176286088826947', // granted setup access without Manage Server
  ]),
};

// True if this user is explicitly allowlisted to run setup in this guild.
export function canOpenSetup(guildId, userId) {
  if (!guildId || !userId) return false;
  return SETUP_ALLOWLIST[guildId]?.has(userId) ?? false;
}
