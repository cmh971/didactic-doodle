// ER:LC Regions — draw map regions (polygon OR postal-code), link each to a Discord
// voice channel, and auto-move verified players between VCs based on where they are
// standing in Liberty County.
//
// Data feed: GET https://api.erlc.gg/v2/server?Players=true  ->  each player carries
//   { Player:"Name:id", Location:{ LocationX, LocationZ, PostalCode, StreetName } }
// Map math: official map is 3121x3121 px, world (0,0) = pixel (1560.5,1560.5),
//   +X right, +Z down. Polygons are stored as 0..1 map fractions so they're
//   resolution-independent.
import { getDb } from '../db/index.js';
import { getCfg, setNested } from '../setup/store.js';
import { decryptSecret } from '../systems/secureStore.js';
import { allLinks } from './roblox.js';
import { runErlcTrigger } from './automations.js';
import { erlc } from '../systems/erlcWrapper.js'; // shared, rate-limit-safe ER:LC client

// Resolve the ER:LC server key for a guild (inlined so this module doesn't depend
// on erlc.js): per-guild encrypted key, plain key, or the global env fallback.
function erlcKey(guildId) {
  const s = getCfg(guildId).settings || {};
  if (s.erlcKeyEnc) { try { return decryptSecret(s.erlcKeyEnc); } catch { return null; } }
  return s.erlcKey || process.env.ERLC_API_KEY || null;
}

// (ER:LC URLs now live in the wrapper — see systems/erlcWrapper.js)
const MAP_PX = 3121;
const CENTER = MAP_PX / 2; // 1560.5

const db = getDb();
db.exec(`CREATE TABLE IF NOT EXISTS erlc_regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,           -- 'polygon' | 'postal'
  data TEXT NOT NULL,           -- polygon: [[fx,fy],...]  |  postal: ["604","909"]
  linked_vc TEXT
)`);
const stmt = {
  list: db.prepare('SELECT * FROM erlc_regions WHERE guild_id=? ORDER BY id'),
  add: db.prepare('INSERT INTO erlc_regions(guild_id,name,type,data,linked_vc) VALUES (?,?,?,?,?)'),
  del: db.prepare('DELETE FROM erlc_regions WHERE guild_id=? AND id=?'),
  clear: db.prepare('DELETE FROM erlc_regions WHERE guild_id=?'),
};

export function listRegions(guildId) {
  return stmt.list.all(guildId).map((r) => ({ id: r.id, name: r.name, type: r.type, data: JSON.parse(r.data), linkedVc: r.linked_vc }));
}
export function addRegion(guildId, { name, type, data, linkedVc }) {
  stmt.add.run(guildId, String(name).slice(0, 80), type === 'postal' ? 'postal' : 'polygon', JSON.stringify(data || []), linkedVc || null);
}
export function deleteRegion(guildId, id) { stmt.del.run(guildId, id); }
export function clearRegions(guildId) { stmt.clear.run(guildId); }

export function getRegionCfg(guildId) {
  return getCfg(guildId).settings.erlcRegions || { enabled: false, waitingVc: null, studsPerPixel: 1, season: 'fall' };
}
export function setRegionCfg(guildId, key, val) { setNested(guildId, 'erlcRegions', key, val); }

// ---- geometry ----
export function pointInPolygon(fx, fy, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]; const [xj, yj] = pts[j];
    if (((yi > fy) !== (yj > fy)) && (fx < ((xj - xi) * (fy - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
// world (stud) coords -> 0..1 map fraction
function worldToFraction(x, z, studsPerPixel) {
  const spp = studsPerPixel || 1;
  return [(CENTER + x / spp) / MAP_PX, (CENTER + z / spp) / MAP_PX];
}

// Which region (if any) contains this player's Location?
export function regionForLocation(regions, loc, studsPerPixel) {
  if (!loc) return null;
  for (const r of regions) {
    if (r.type === 'postal') {
      if (loc.PostalCode && r.data.map(String).includes(String(loc.PostalCode))) return r;
    } else {
      const [fx, fy] = worldToFraction(Number(loc.LocationX) || 0, Number(loc.LocationZ) || 0, studsPerPixel);
      if (pointInPolygon(fx, fy, r.data)) return r;
    }
  }
  return null;
}

// ---- the live poll: VC auto-move + ER:LC automation triggers ----
async function fetchServer(guildId) {
  const key = erlcKey(guildId);
  if (!key) return null;
  // Via the wrapper: rate-limit governor protects us from an IP ban. ttl=0 keeps
  // each poll fresh (the governor still throttles, so it's still safe).
  try { return await erlc.getV2(key, { Players: true, EmergencyCalls: true, Vehicles: true }, 0); }
  catch { return null; }
}

// Per-guild event state so we only fire on CHANGES (and never on the startup backlog).
const regionPrev = new Map(); // guildId -> Map(playerLower -> regionName|null)
const emergSeen = new Map();  // guildId -> Set(call ids)
const plateSeen = new Map();  // guildId -> Set(owner:plate)
const primed = new Set();     // guilds ticked at least once

async function tickGuild(client, guildId) {
  const cfg = getRegionCfg(guildId);
  if (!cfg.enabled) return;
  const data = await fetchServer(guildId);
  if (!data) return;
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const players = Array.isArray(data.Players) ? data.Players : [];
  const regions = listRegions(guildId);
  const nameToDiscord = new Map(); const idToDiscord = new Map();
  for (const link of allLinks(guildId)) { if (link.name) nameToDiscord.set(String(link.name).toLowerCase(), link.user_id); if (link.roblox_id) idToDiscord.set(String(link.roblox_id), link.user_id); }
  const memberById = async (dId) => (dId ? (guild.members.cache.get(dId) || await guild.members.fetch(dId).catch(() => null)) : null);
  const memberByName = (n) => memberById(nameToDiscord.get(String(n).toLowerCase()));
  const staffCount = players.filter((p) => p.Permission && p.Permission !== 'Normal').length;
  const notInDiscord = players.filter((p) => !nameToDiscord.has(String(p.Player || '').split(':')[0].toLowerCase())).length;
  const base = { staffCount, notInDiscord };
  const first = !primed.has(guildId);

  // ---- VC auto-move (only when regions are configured) ----
  if (regions.length) {
    const ourVcs = new Set(regions.map((r) => r.linkedVc).filter(Boolean));
    if (cfg.waitingVc) ourVcs.add(cfg.waitingVc);
    for (const p of players) {
      const member = await memberByName(String(p.Player || '').split(':')[0]);
      if (!member || !member.voice?.channelId) continue;
      const region = regionForLocation(regions, p.Location, cfg.studsPerPixel);
      const target = region?.linkedVc || null;
      if (target && member.voice.channelId !== target) await member.voice.setChannel(target, 'ER:LC region move').catch(() => {});
      else if (!target && cfg.waitingVc && ourVcs.has(member.voice.channelId) && member.voice.channelId !== cfg.waitingVc) await member.voice.setChannel(cfg.waitingVc, 'ER:LC left region').catch(() => {});
    }
  }

  // ---- region_entered / region_exited ----
  if (regions.length) {
    const prev = regionPrev.get(guildId) || new Map();
    const now = new Map();
    for (const p of players) {
      const rname = String(p.Player || '').split(':')[0];
      const region = regionForLocation(regions, p.Location, cfg.studsPerPixel);
      const name = region?.name || null;
      now.set(rname.toLowerCase(), name);
      if (!first) {
        const was = prev.get(rname.toLowerCase()) ?? null;
        if (was !== name) {
          const member = await memberByName(rname);
          if (name) await runErlcTrigger(guild, 'region_entered', { ...base, player: rname, region: name }, member).catch(() => {});
          if (was) await runErlcTrigger(guild, 'region_exited', { ...base, player: rname, region: was }, member).catch(() => {});
        }
      }
    }
    regionPrev.set(guildId, now);
  }

  // ---- emergency_created ----
  const seenE = emergSeen.get(guildId) || new Set();
  for (const e of (data.EmergencyCalls || [])) {
    const idc = String(e.CallNumber ?? `${e.Caller}:${e.StartedAt}`);
    if (seenE.has(idc)) continue; seenE.add(idc);
    if (!first) {
      const member = await memberById(idToDiscord.get(String(e.Caller)));
      await runErlcTrigger(guild, 'emergency_created', { ...base, player: member?.user.username || String(e.Caller || ''), emergencyDesc: e.Description || '', emergencyNumber: e.CallNumber ?? '', region: e.PositionDescriptor || '' }, member).catch(() => {});
    }
  }
  emergSeen.set(guildId, seenE.size > 500 ? new Set([...seenE].slice(-300)) : seenE);

  // ---- plate_used ----
  const seenP = plateSeen.get(guildId) || new Set();
  for (const v of (data.Vehicles || [])) {
    if (!v.Plate) continue;
    const k = `${v.Owner}:${v.Plate}`;
    if (seenP.has(k)) continue; seenP.add(k);
    if (!first) {
      const member = await memberByName(v.Owner || '');
      await runErlcTrigger(guild, 'plate_used', { ...base, player: String(v.Owner || ''), plate: v.Plate }, member).catch(() => {});
    }
  }
  plateSeen.set(guildId, seenP.size > 500 ? new Set([...seenP].slice(-300)) : seenP);

  primed.add(guildId);
}

// Exposed for the CAD / dispatcher console (raw /v2/server snapshot).
export async function fetchLiveServer(guildId) { return fetchServer(guildId); }

// One V2 call that pulls all the log feeds at once (join/kill/mod/command + queue).
// Cached per guild so the live "server feed" page can't hammer the API into a ban.
const logsCache = new Map();     // guildId -> { at, data }
const logsInflight = new Map();  // guildId -> Promise
const LOGS_TTL = 8000;
export function fetchServerLogs(guildId) {
  const hit = logsCache.get(guildId);
  if (hit && Date.now() - hit.at < LOGS_TTL) return Promise.resolve(hit.data);
  if (logsInflight.has(guildId)) return logsInflight.get(guildId);
  const p = (async () => {
    let data = null;
    const key = erlcKey(guildId);
    if (key) {
      // Wrapper handles rate limits; keep this function's own 8s cache above.
      try { data = await erlc.getV2(key, { JoinLogs: true, KillLogs: true, ModCalls: true, CommandLogs: true, Queue: true }, 0); }
      catch (e) { data = { code: e.code || e.status, message: e.message }; }
    }
    logsCache.set(guildId, { at: Date.now(), data });
    logsInflight.delete(guildId);
    return data;
  })();
  logsInflight.set(guildId, p);
  return p;
}

let timer = null;
export function startRegionEngine(client, intervalMs = 20000) {
  if (timer) return;
  timer = setInterval(async () => {
    for (const gid of client.guilds.cache.keys()) {
      try { await tickGuild(client, gid); } catch (e) { console.error('erlcRegions tick', gid, e.message); }
    }
  }, intervalMs);
  console.log('🗺️  ER:LC Regions engine started (' + intervalMs / 1000 + 's).');
}
