// Auto raid defense. Watches member joins for a BURST of suspicious accounts
// (very new accounts and/or random-gibberish usernames). When a burst trips the
// threshold, it enters "raid mode" for a few minutes: it sweeps the burst and
// auto-removes any suspicious joiner — BANNING the clear bot accounts (young AND
// gibberish) and KICKING borderline ones — then DMs the owner an alert.
//
// Deliberately conservative: it only acts on a BURST of SUSPICIOUS joins, so an
// organic wave of real members won't trip it.
const windows = new Map();  // guildId -> [{ id, at, young, gib, sus }]
const raidMode = new Map(); // guildId -> untilTimestamp

const CFG = {
  burstCount: 5,          // this many suspicious joins…
  burstWindowMs: 12_000,  // …within this window = a raid
  youngMs: 30 * 24 * 60 * 60 * 1000, // account younger than 30 days = suspicious
                                     // (farms age accounts ~2-4 weeks — this raid's were 17.5d)
  raidModeMs: 5 * 60 * 1000,        // stay armed this long after a burst
};

const OWNER_IDS = () => (process.env.OWNER_IDS || '1183222250153984040').split(',').map((s) => s.trim()).filter(Boolean);
const accountAgeMs = (id) => Date.now() - Number((BigInt(id) >> 22n) + 1420070400000n);
// random-string username: long, several digits, not a simple word+number handle.
const isGibberish = (n) => /^[a-z0-9_]{11,}$/i.test(n) && (String(n).match(/[0-9]/g) || []).length >= 3 && !/^[a-z]+[0-9_]*$/i.test(n);

async function alertOwner(guild, text) {
  console.warn(`[ANTIRAID] ${guild.name}: ${text}`);
  for (const oid of OWNER_IDS()) {
    try { const u = await guild.client.users.fetch(oid); await u.send(`🛡️ **Anti-raid** — **${guild.name}**\n${text}`); } catch { /* dm closed */ }
  }
}

async function removeRaider(guild, userId, young, gib) {
  const ban = young && gib; // clear bot-farm account → ban; borderline → kick
  try {
    if (ban) await guild.bans.create(userId, { reason: 'Anti-raid: burst of new/gibberish accounts', deleteMessageSeconds: 3600 });
    else await guild.members.kick(userId, 'Anti-raid: suspicious join during a raid');
    return ban ? 'banned' : 'kicked';
  } catch { return 'failed'; }
}

// Called first thing on member join. Returns true if it removed the member
// (so the caller skips welcome cards / auto-roles for a raider).
export async function antiRaidCheck(member) {
  try {
    if (member.user?.bot) return false;
    const gid = member.guild.id;
    const now = Date.now();
    const young = accountAgeMs(member.id) < CFG.youngMs;
    const gib = isGibberish(member.user.username);
    const sus = young || gib;

    const w = (windows.get(gid) || []).filter((e) => now - e.at < CFG.burstWindowMs);
    w.push({ id: member.id, at: now, young, gib, sus });
    windows.set(gid, w);

    let inRaid = (raidMode.get(gid) || 0) > now;

    // New burst? Trip raid mode and sweep everyone in the window.
    if (!inRaid) {
      const susCount = w.filter((e) => e.sus).length;
      if (susCount >= CFG.burstCount) {
        raidMode.set(gid, now + CFG.raidModeMs);
        let banned = 0; let kicked = 0;
        for (const e of w) {
          if (!e.sus) continue;
          const r = await removeRaider(member.guild, e.id, e.young, e.gib);
          if (r === 'banned') banned++; else if (r === 'kicked') kicked++;
        }
        await alertOwner(member.guild, `🚨 RAID DETECTED — ${susCount} suspicious joins in ${CFG.burstWindowMs / 1000}s.\nAuto-removed: **${banned} banned**, **${kicked} kicked**. Defense armed for ${CFG.raidModeMs / 60000} min — new suspicious joins are auto-removed.`);
        return sus; // current member was handled in the sweep if suspicious
      }
      return false;
    }

    // Already in raid mode: remove any suspicious joiner on sight.
    if (sus) { await removeRaider(member.guild, member.id, young, gib); return true; }
    return false;
  } catch (e) {
    console.error('antiraid error:', e.message);
    return false;
  }
}

export function raidStatus(guildId) {
  return { armed: (raidMode.get(guildId) || 0) > Date.now(), recentJoins: (windows.get(guildId) || []).length };
}
