// CAD — Dispatcher Console (MVP). A live dispatch layer on top of the ER:LC v2 data
// we already poll: shows online units + positions + the game's emergency calls, and
// lets a dispatcher create/assign/close CAD calls and set unit statuses.
//
// This is stage 1 of the CAD. It reuses fetchLiveServer() (ER:LC /v2/server) + the
// verify links, and adds its own dispatch tables. Records/MDT/civilian portal come later.
import { EmbedBuilder } from 'discord.js';
import { getDb } from '../db/index.js';
import { getCfg, setSetting } from '../setup/store.js';
import { getRegionCfg, fetchLiveServer } from './erlcRegions.js';
import { listPenal, addPenal, delPenal, listTen, addTen, delTen } from './penalcodes.js';
import { boloScan } from './bolo.js';

// In-memory dispatch state (near-real-time; fine for the poll loop).
const panics = new Map();    // guildId -> [{ unit, at }]
const signal100 = new Map(); // guildId -> bool
async function alertPanic(client, gid, unit, loc) {
  try {
    const chId = getCfg(gid).settings.logChannel; const guild = client?.guilds?.cache.get(gid);
    const c = chId && guild?.channels?.cache.get(chId);
    if (c?.isTextBased?.()) await c.send({ content: '@here', embeds: [new EmbedBuilder().setColor(0xef4444).setTitle('🆘 PANIC — OFFICER NEEDS ASSISTANCE').setDescription(`**${unit}** hit the panic button${loc ? ` near **${loc}**` : ''}. Respond immediately.`).setTimestamp()] }).catch(() => {});
  } catch { /* no alert channel */ }
}

const db = getDb();
db.exec(`CREATE TABLE IF NOT EXISTS cad_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL,
  title TEXT, type TEXT, priority INTEGER DEFAULT 3, postal TEXT, notes TEXT,
  units TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER, closed_at INTEGER
)`);
db.exec(`CREATE TABLE IF NOT EXISTS cad_units (
  guild_id TEXT NOT NULL, unit_name TEXT NOT NULL, status TEXT DEFAULT 'Available',
  call_id INTEGER, updated_at INTEGER, PRIMARY KEY (guild_id, unit_name)
)`);
db.exec(`CREATE TABLE IF NOT EXISTS cad_jurisdictions (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, name TEXT, color TEXT, points TEXT NOT NULL DEFAULT '[]')`);
const q = {
  addCall: db.prepare('INSERT INTO cad_calls(guild_id,title,type,priority,postal,notes,created_at) VALUES (?,?,?,?,?,?,?)'),
  getCall: db.prepare('SELECT * FROM cad_calls WHERE id=? AND guild_id=?'),
  active: db.prepare("SELECT * FROM cad_calls WHERE guild_id=? AND status='active' ORDER BY priority, id DESC"),
  updCall: db.prepare('UPDATE cad_calls SET title=?, type=?, priority=?, postal=?, notes=?, units=? WHERE id=? AND guild_id=?'),
  closeCall: db.prepare("UPDATE cad_calls SET status='closed', closed_at=? WHERE id=? AND guild_id=?"),
  setUnit: db.prepare('INSERT INTO cad_units(guild_id,unit_name,status,call_id,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(guild_id,unit_name) DO UPDATE SET status=excluded.status, call_id=excluded.call_id, updated_at=excluded.updated_at'),
  unit: db.prepare('SELECT * FROM cad_units WHERE guild_id=? AND unit_name=?'),
  jList: db.prepare('SELECT * FROM cad_jurisdictions WHERE guild_id=? ORDER BY id'),
  jAdd: db.prepare('INSERT INTO cad_jurisdictions(guild_id,name,color,points) VALUES (?,?,?,?)'),
  jDel: db.prepare('DELETE FROM cad_jurisdictions WHERE id=? AND guild_id=?'),
};
export function listJurisdictions(gid) { return q.jList.all(gid).map((r) => ({ id: r.id, name: r.name, color: r.color, points: parse(r.points, []) })); }
export function addJurisdiction(gid, z) { q.jAdd.run(gid, (z.name || 'Zone').slice(0, 40), (z.color || '#3b82f6').slice(0, 9), JSON.stringify((z.points || []).slice(0, 60))); }
export function delJurisdiction(gid, id) { q.jDel.run(id, gid); }
const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const asCall = (r) => ({ id: r.id, title: r.title, type: r.type, priority: r.priority, postal: r.postal, notes: r.notes, units: parse(r.units, []), status: r.status, createdAt: r.created_at });

export function listCalls(guildId) { return q.active.all(guildId).map(asCall); }
export function createCall(guildId, c) { const i = q.addCall.run(guildId, (c.title || 'Call').slice(0, 80), (c.type || '').slice(0, 40), Math.min(5, Math.max(1, Number(c.priority) || 3)), (c.postal || '').slice(0, 20), (c.notes || '').slice(0, 500), Date.now()); return Number(i.lastInsertRowid); }
export function updateCall(guildId, id, c) { const cur = q.getCall.get(id, guildId); if (!cur) return false; q.updCall.run((c.title ?? cur.title), (c.type ?? cur.type), Math.min(5, Math.max(1, Number(c.priority) || cur.priority)), (c.postal ?? cur.postal), (c.notes ?? cur.notes), JSON.stringify(c.units ?? parse(cur.units, [])), id, guildId); return true; }
export function closeCall(guildId, id) { q.closeCall.run(Date.now(), id, guildId); return true; }
export function setUnitStatus(guildId, name, status, callId) { q.setUnit.run(guildId, name, String(status || 'Available').slice(0, 24), callId ?? null, Date.now()); }
export function assignUnit(guildId, callId, name) {
  const cur = q.getCall.get(callId, guildId); if (!cur) return false;
  const units = new Set(parse(cur.units, [])); units.add(name);
  q.updCall.run(cur.title, cur.type, cur.priority, cur.postal, cur.notes, JSON.stringify([...units]), callId, guildId);
  setUnitStatus(guildId, name, 'En Route', callId);
  return true;
}
export function unassignUnit(guildId, callId, name) {
  const cur = q.getCall.get(callId, guildId); if (!cur) return false;
  const units = parse(cur.units, []).filter((u) => u !== name);
  q.updCall.run(cur.title, cur.type, cur.priority, cur.postal, cur.notes, JSON.stringify(units), callId, guildId);
  setUnitStatus(guildId, name, 'Available', null);
  return true;
}

// ---- live snapshot (cached ~3s so we don't hammer the PRC API) ----
const cache = new Map(); // guildId -> { at, data }
export async function getLiveState(guildId) {
  const hit = cache.get(guildId);
  if (hit && Date.now() - hit.at < 3000) return hit.data;
  const data = await fetchLiveServer(guildId);
  if (!data) return { ok: false, error: 'No ER:LC data — check the server key (/erlc link) and that the server is up.' };
  const cfg = getRegionCfg(guildId);
  const units = (data.Players || []).map((p) => {
    const name = String(p.Player || '').split(':')[0];
    const u = q.unit.get(guildId, name);
    return { name, team: p.Team || 'Civilian', permission: p.Permission || 'Normal', callsign: p.Callsign || '',
      x: p.Location?.LocationX ?? null, z: p.Location?.LocationZ ?? null, postal: p.Location?.PostalCode || '', street: p.Location?.StreetName || '',
      status: u?.status || 'Available', callId: u?.call_id || null };
  });
  const gameCalls = (data.EmergencyCalls || []).map((e) => ({ number: e.CallNumber, caller: String(e.Caller || ''), team: e.Team, desc: e.Description || '', postal: e.PositionDescriptor || '', x: e.Position?.[0] ?? null, z: e.Position?.[1] ?? null }));
  const out = { ok: true, name: data.Name, players: data.CurrentPlayers, maxPlayers: data.MaxPlayers, studsPerPixel: cfg.studsPerPixel || 1, season: cfg.season || 'fall', units, gameCalls, cadCalls: listCalls(guildId),
    signal100: !!signal100.get(guildId), panics: (panics.get(guildId) || []).filter((p) => Date.now() - p.at < 90000), jurisdictions: listJurisdictions(guildId),
    bolos: boloScan(guildId, { vehicles: data.Vehicles || [], units }) };
  cache.set(guildId, { at: Date.now(), data: out });
  return out;
}

// Mounts the CAD page + API. `auth = { requireAuth, canManage }` from server.js.
export function registerCadRoutes(app, client, auth, sendFile) {
  const { requireAuth } = auth;
  const gate = async (req, res, next) => ((await auth.access(req, req.params.id)) ? next() : res.status(403).json({ error: 'Requires a PD/EMS/DOT (department) role. Ask an admin to add yours with `!cadaccess add @role`.' }));

  app.get('/cad', requireAuth, (req, res) => sendFile(res, 'cad.html'));
  app.get('/api/cad/:id/access', requireAuth, async (req, res) => res.json({ access: await auth.access(req, req.params.id) }));
  app.get('/api/cad/:id/state', requireAuth, gate, async (req, res) => res.json(await getLiveState(req.params.id)));
  app.post('/api/cad/:id/call', requireAuth, gate, (req, res) => {
    if (req.body?.id) { updateCall(req.params.id, Number(req.body.id), req.body); return res.json({ ok: true, id: Number(req.body.id) }); }
    res.json({ ok: true, id: createCall(req.params.id, req.body || {}) });
  });
  app.post('/api/cad/:id/call/:cid/close', requireAuth, gate, (req, res) => { closeCall(req.params.id, Number(req.params.cid)); res.json({ ok: true }); });
  app.post('/api/cad/:id/assign', requireAuth, gate, (req, res) => { const { callId, unit, remove } = req.body || {}; (remove ? unassignUnit : assignUnit)(req.params.id, Number(callId), String(unit || '')); res.json({ ok: true }); });
  app.post('/api/cad/:id/status', requireAuth, gate, (req, res) => { setUnitStatus(req.params.id, String(req.body?.unit || ''), req.body?.status, req.body?.callId); res.json({ ok: true }); });
  // panic + Signal 100
  app.post('/api/cad/:id/panic', requireAuth, gate, async (req, res) => {
    const unit = String(req.body?.unit || 'Unknown');
    let street = ''; let postal = '';
    try { const st = await getLiveState(req.params.id); const u = (st.units || []).find((x) => x.name.toLowerCase() === unit.toLowerCase() || (x.callsign && x.callsign.toLowerCase() === unit.toLowerCase())); if (u) { street = u.street || ''; postal = u.postal || ''; } } catch { /* live lookup failed */ }
    const arr = panics.get(req.params.id) || []; arr.push({ unit, street, postal, at: Date.now() }); panics.set(req.params.id, arr);
    await alertPanic(client, req.params.id, unit, street || postal);
    res.json({ ok: true });
  });
  app.post('/api/cad/:id/signal100', requireAuth, gate, (req, res) => { signal100.set(req.params.id, !!req.body?.on); res.json({ ok: true, on: !!req.body?.on }); });
  // penal codes + 10-codes
  app.get('/api/cad/:id/penal', requireAuth, gate, (req, res) => res.json(listPenal(req.params.id)));
  app.post('/api/cad/:id/penal', requireAuth, gate, (req, res) => { addPenal(req.params.id, req.body || {}); res.json({ ok: true }); });
  app.post('/api/cad/:id/penal/:pid/delete', requireAuth, gate, (req, res) => { delPenal(req.params.id, Number(req.params.pid)); res.json({ ok: true }); });
  app.get('/api/cad/:id/tencodes', requireAuth, gate, (req, res) => res.json(listTen(req.params.id)));
  app.post('/api/cad/:id/tencodes', requireAuth, gate, (req, res) => { addTen(req.params.id, req.body || {}); res.json({ ok: true }); });
  app.post('/api/cad/:id/tencodes/:tid/delete', requireAuth, gate, (req, res) => { delTen(req.params.id, Number(req.params.tid)); res.json({ ok: true }); });
  // jurisdictions (map sector boundaries)
  app.get('/api/cad/:id/jurisdictions', requireAuth, gate, (req, res) => res.json(listJurisdictions(req.params.id)));
  app.post('/api/cad/:id/jurisdictions', requireAuth, gate, (req, res) => { addJurisdiction(req.params.id, req.body || {}); res.json({ ok: true }); });
  app.post('/api/cad/:id/jurisdictions/:jid/delete', requireAuth, gate, (req, res) => { delJurisdiction(req.params.id, Number(req.params.jid)); res.json({ ok: true }); });
  console.log('🚨 CAD Dispatcher Console mounted at /cad');
}

// ---- !cadaccess — which roles can use the CAD/MDT (PD/EMS/DOT/…) ----
export async function handleCadAccessCommand(message) {
  const m = /^!cadaccess\b\s*(\w*)/i.exec((message.content || '').trim());
  if (!m || !message.guild) return false;
  if (!message.member?.permissions?.has('ManageGuild')) { await message.reply('🔒 Needs **Manage Server**.').catch(() => {}); return true; }
  const sub = (m[1] || '').toLowerCase();
  const gid = message.guild.id;
  const roles = getCfg(gid).settings.cadRoles || [];
  if (sub === 'add') {
    const r = message.mentions.roles.first();
    if (!r) return message.reply('Mention a role: `!cadaccess add @PD`').catch(() => {});
    const set = new Set(roles); set.add(r.id); setSetting(gid, 'cadRoles', [...set]);
    return message.reply(`✅ <@&${r.id}> can now use the CAD/MDT (\`/cad\`, \`/mdt\`).`).catch(() => {});
  }
  if (sub === 'remove') {
    const r = message.mentions.roles.first();
    if (!r) return message.reply('Mention a role to remove.').catch(() => {});
    setSetting(gid, 'cadRoles', roles.filter((x) => x !== r.id));
    return message.reply(`🗑️ <@&${r.id}> removed from CAD access.`).catch(() => {});
  }
  return message.reply(roles.length
    ? `🚨 **CAD/MDT access roles:** ${roles.map((r) => `<@&${r}>`).join(', ')}\nManage: \`!cadaccess add @role\` · \`!cadaccess remove @role\``
    : 'No CAD roles set yet — only **server managers** can open the CAD/MDT. Add a department role: `!cadaccess add @PD`').catch(() => {});
}
