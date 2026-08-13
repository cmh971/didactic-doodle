// MDT — Mobile Data Terminal (CAD stage 2). The LEO side: a records database
// (civilians, vehicles, warrants, citations) + name/plate lookups. Plate lookups
// fall back to the LIVE ER:LC vehicle list so officers can query a car that's on the
// road even if nobody registered it yet.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/index.js';
import { fetchLiveServer } from './erlcRegions.js';
import { getLawbook, PENAL_CODE } from './lawbook.js';
import { addPenal } from './penalcodes.js';
import { searchAll } from './search.js';
import { getLiveState } from './cad.js';
import { allLinks } from './roblox.js';
import { reportCatalog, saveReport, listReports } from './reports.js';
import { listBolos, addBolo, delBolo } from './bolo.js';
import { aiVerdict, saveVerdict, listVerdicts, lockVerdict } from './judge.js';

// Resolve a Roblox username → avatar headshot (mugshot). Real, free Roblox API.
export async function robloxMugshot(username) {
  const name = String(username || '').trim();
  if (!name) return null;
  try {
    const r = await fetch('https://users.roblox.com/v1/usernames/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usernames: [name], excludeBannedUsers: false }) });
    const id = (await r.json())?.data?.[0]?.id;
    if (!id) return null;
    const t = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png&isCircular=false`);
    const url = (await t.json())?.data?.[0]?.imageUrl || null;
    return { userId: id, url };
  } catch { return null; }
}

const db = getDb();
db.exec(`CREATE TABLE IF NOT EXISTS cad_civilians (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, name TEXT NOT NULL,
  dob TEXT, gender TEXT, address TEXT, licenses TEXT DEFAULT '{}', flags TEXT DEFAULT '[]', notes TEXT, created_at INTEGER
)`);
db.exec(`CREATE TABLE IF NOT EXISTS cad_vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, plate TEXT NOT NULL, owner TEXT,
  model TEXT, color TEXT, insurance TEXT DEFAULT 'Valid', stolen INTEGER DEFAULT 0, created_at INTEGER
)`);
db.exec(`CREATE TABLE IF NOT EXISTS cad_warrants (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, subject TEXT NOT NULL,
  reason TEXT, severity TEXT DEFAULT 'Misdemeanor', status TEXT DEFAULT 'active', created_at INTEGER, cleared_at INTEGER
)`);
db.exec(`CREATE TABLE IF NOT EXISTS cad_citations (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, subject TEXT NOT NULL, officer TEXT,
  charges TEXT, fine INTEGER DEFAULT 0, jail INTEGER DEFAULT 0, notes TEXT, created_at INTEGER
)`);
db.exec(`CREATE TABLE IF NOT EXISTS cad_lawrefs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, title TEXT, snippet TEXT, url TEXT, created_at INTEGER
)`);
db.exec(`CREATE TABLE IF NOT EXISTS cad_idscans (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, name TEXT, data TEXT, created_at INTEGER
)`);
// Phone field (players enter it on their portal profile — ER:LC can't push it).
try { db.exec('ALTER TABLE cad_civilians ADD COLUMN phone TEXT'); } catch { /* column already exists */ }
// REPO-eligible flag (set when a subject can't afford a locked bond).
try { db.exec('ALTER TABLE cad_vehicles ADD COLUMN repo INTEGER DEFAULT 0'); } catch { /* column already exists */ }
try { db.exec('ALTER TABLE cad_civilians ADD COLUMN phone TEXT'); } catch { /* column already exists */ }

const j = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const q = {
  addCiv: db.prepare('INSERT INTO cad_civilians(guild_id,name,dob,gender,address,licenses,flags,notes,phone,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)'),
  findCiv: db.prepare("SELECT * FROM cad_civilians WHERE guild_id=? AND name LIKE ? ORDER BY name LIMIT 25"),
  civByName: db.prepare('SELECT * FROM cad_civilians WHERE guild_id=? AND name=? COLLATE NOCASE'),
  setFlags: db.prepare('UPDATE cad_civilians SET flags=? WHERE id=? AND guild_id=?'),
  addVeh: db.prepare('INSERT INTO cad_vehicles(guild_id,plate,owner,model,color,insurance,stolen,created_at) VALUES (?,?,?,?,?,?,?,?)'),
  vehByPlate: db.prepare('SELECT * FROM cad_vehicles WHERE guild_id=? AND plate=? COLLATE NOCASE'),
  vehByOwner: db.prepare('SELECT * FROM cad_vehicles WHERE guild_id=? AND owner=? COLLATE NOCASE'),
  setStolen: db.prepare('UPDATE cad_vehicles SET stolen=? WHERE id=? AND guild_id=?'),
  addWar: db.prepare('INSERT INTO cad_warrants(guild_id,subject,reason,severity,created_at) VALUES (?,?,?,?,?)'),
  warBySubj: db.prepare("SELECT * FROM cad_warrants WHERE guild_id=? AND subject=? COLLATE NOCASE AND status='active' ORDER BY id DESC"),
  warAll: db.prepare("SELECT * FROM cad_warrants WHERE guild_id=? AND status='active' ORDER BY id DESC LIMIT 50"),
  clearWar: db.prepare("UPDATE cad_warrants SET status='cleared', cleared_at=? WHERE id=? AND guild_id=?"),
  addCit: db.prepare('INSERT INTO cad_citations(guild_id,subject,officer,charges,fine,jail,notes,created_at) VALUES (?,?,?,?,?,?,?,?)'),
  citBySubj: db.prepare('SELECT * FROM cad_citations WHERE guild_id=? AND subject=? COLLATE NOCASE ORDER BY id DESC'),
  citAll: db.prepare('SELECT * FROM cad_citations WHERE guild_id=? ORDER BY id DESC LIMIT 50'),
  lawList: db.prepare('SELECT * FROM cad_lawrefs WHERE guild_id=? ORDER BY id DESC LIMIT 200'),
  lawAdd: db.prepare('INSERT INTO cad_lawrefs(guild_id,title,snippet,url,created_at) VALUES (?,?,?,?,?)'),
  lawDel: db.prepare('DELETE FROM cad_lawrefs WHERE id=? AND guild_id=?'),
  idAdd: db.prepare('INSERT INTO cad_idscans(guild_id,name,data,created_at) VALUES (?,?,?,?)'),
  idList: db.prepare('SELECT * FROM cad_idscans WHERE guild_id=? ORDER BY id DESC LIMIT 50'),
  repoOwner: db.prepare('UPDATE cad_vehicles SET repo=1 WHERE guild_id=? AND owner=? COLLATE NOCASE'),
};

export function flagRepo(g, owner) { q.repoOwner.run(g, String(owner || '')); }

export function saveIdScan(g, snap) { return Number(q.idAdd.run(g, (snap.name || '').slice(0, 60), JSON.stringify(snap).slice(0, 8000), Date.now()).lastInsertRowid); }
export function listIdScans(g) { return q.idList.all(g).map((r) => { let d = {}; try { d = JSON.parse(r.data); } catch { /* corrupt */ } return { id: r.id, name: r.name, ...d, at: r.created_at }; }); }

// ---- law search (web, filtered to legal sources) + saved law references ----
const LEGAL_HOSTS = ['law.cornell.edu', 'justia.com', 'findlaw.com', 'uscode.house.gov', 'govinfo.gov', 'nolo.com', 'casetext.com', 'ecfr.gov', 'courtlistener.com', 'oyez.org', 'legislature', 'statutes', '.gov'];
const LEGAL_WORDS = /\b(law|laws|statute|penal|code|felony|misdemeanor|ordinance|legal|legislat|jurisdiction|criminal|offense|offence|regulation)\b|§/i;
export async function lawSearch(query) {
  const q2 = LEGAL_WORDS.test(query) ? query : query + ' law statute';
  let results = [];
  try { results = await searchAll(q2); } catch { results = []; }
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const legal = results.filter((r) => { const h = host(r.url); return LEGAL_HOSTS.some((x) => h.includes(x)) || LEGAL_WORDS.test(`${r.title || ''} ${r.snippet || ''}`); });
  return (legal.length ? legal : results).slice(0, 15).map((r) => ({ title: r.title, snippet: r.snippet, url: r.url, source: r.source }));
}
export function listLawRefs(g) { return q.lawList.all(g); }
export function addLawRef(g, r) { return Number(q.lawAdd.run(g, (r.title || '').slice(0, 200), (r.snippet || '').slice(0, 500), (r.url || '').slice(0, 400), Date.now()).lastInsertRowid); }
export function delLawRef(g, id) { q.lawDel.run(id, g); }

// ---- name lookup (NCIC-style aggregate) ----
export function nameLookup(guildId, name) {
  const civ = q.civByName.get(guildId, name);
  return {
    query: name,
    civilian: civ ? { ...civ, licenses: j(civ.licenses, {}), flags: j(civ.flags, []) } : null,
    vehicles: q.vehByOwner.all(guildId, name),
    warrants: q.warBySubj.all(guildId, name),
    citations: q.citBySubj.all(guildId, name),
  };
}
export function searchCivilians(guildId, term) { return q.findCiv.all(guildId, `%${term}%`); }

// ---- plate lookup (records first, then LIVE api) ----
export async function plateLookup(guildId, plate) {
  const rec = q.vehByPlate.get(guildId, plate);
  if (rec) return { plate, source: 'records', ...rec, warrants: rec.owner ? q.warBySubj.all(guildId, rec.owner) : [] };
  const data = await fetchLiveServer(guildId).catch(() => null);
  const live = (data?.Vehicles || []).find((v) => String(v.Plate).toLowerCase() === String(plate).toLowerCase());
  if (live) return { plate, source: 'live', owner: live.Owner, model: live.Name, color: live.ColorName, insurance: 'Unknown', stolen: 0, warrants: q.warBySubj.all(guildId, live.Owner || '') };
  return { plate, source: 'none' };
}

export function createCivilian(guildId, c) { return Number(q.addCiv.run(guildId, (c.name || 'Unknown').slice(0, 60), c.dob || '', c.gender || '', (c.address || '').slice(0, 120), JSON.stringify(c.licenses || {}), JSON.stringify(c.flags || []), (c.notes || '').slice(0, 500), (c.phone || '').slice(0, 30), Date.now()).lastInsertRowid); }
export function addFlag(guildId, name, flag) { const c = q.civByName.get(guildId, name); if (!c) return false; const flags = new Set(j(c.flags, [])); flags.add(flag); q.setFlags.run(JSON.stringify([...flags]), c.id, guildId); return true; }
export function registerVehicle(guildId, v) { return Number(q.addVeh.run(guildId, String(v.plate || '').slice(0, 12), (v.owner || '').slice(0, 60), (v.model || '').slice(0, 60), (v.color || '').slice(0, 40), v.insurance || 'Valid', v.stolen ? 1 : 0, Date.now()).lastInsertRowid); }
export function flagStolen(guildId, plate, stolen) { const v = q.vehByPlate.get(guildId, plate); if (!v) return false; q.setStolen.run(stolen ? 1 : 0, v.id, guildId); return true; }
export function issueWarrant(guildId, w) { return Number(q.addWar.run(guildId, (w.subject || '').slice(0, 60), (w.reason || '').slice(0, 300), w.severity || 'Misdemeanor', Date.now()).lastInsertRowid); }
export function clearWarrant(guildId, id) { q.clearWar.run(Date.now(), id, guildId); return true; }
export function listWarrants(guildId) { return q.warAll.all(guildId); }
export function writeCitation(guildId, c) { return Number(q.addCit.run(guildId, (c.subject || '').slice(0, 60), (c.officer || '').slice(0, 60), (c.charges || '').slice(0, 300), Math.max(0, Number(c.fine) || 0), Math.max(0, Number(c.jail) || 0), (c.notes || '').slice(0, 500), Date.now()).lastInsertRowid); }
export function listCitations(guildId) { return q.citAll.all(guildId); }

// ---- routes ----
export function registerMdtRoutes(app, client, auth, sendFile) {
  const { requireAuth } = auth;
  const gate = async (req, res, next) => ((await auth.access(req, req.params.id)) ? next() : res.status(403).json({ error: 'Requires a PD/EMS/DOT (department) role. Ask an admin to add yours with `!cadaccess add @role`.' }));
  const gid = (req) => req.params.id;

  app.get('/mdt', requireAuth, (req, res) => sendFile(res, 'mdt.html'));
  app.get('/api/mdt/:id/lookup/name', requireAuth, gate, (req, res) => res.json(nameLookup(gid(req), String(req.query.q || ''))));
  app.get('/api/mdt/:id/search', requireAuth, gate, (req, res) => res.json(searchCivilians(gid(req), String(req.query.q || ''))));
  app.get('/api/mdt/:id/lookup/plate', requireAuth, gate, async (req, res) => res.json(await plateLookup(gid(req), String(req.query.q || ''))));
  app.get('/api/mdt/:id/warrants', requireAuth, gate, (req, res) => res.json(listWarrants(gid(req))));
  app.get('/api/mdt/:id/citations', requireAuth, gate, (req, res) => res.json(listCitations(gid(req))));
  app.post('/api/mdt/:id/civilian', requireAuth, gate, (req, res) => res.json({ ok: true, id: createCivilian(gid(req), req.body || {}) }));
  app.post('/api/mdt/:id/flag', requireAuth, gate, (req, res) => res.json({ ok: addFlag(gid(req), req.body?.name, req.body?.flag) }));
  app.post('/api/mdt/:id/vehicle', requireAuth, gate, (req, res) => res.json({ ok: true, id: registerVehicle(gid(req), req.body || {}) }));
  app.post('/api/mdt/:id/stolen', requireAuth, gate, (req, res) => res.json({ ok: flagStolen(gid(req), req.body?.plate, req.body?.stolen) }));
  app.post('/api/mdt/:id/warrant', requireAuth, gate, (req, res) => res.json({ ok: true, id: issueWarrant(gid(req), req.body || {}) }));
  app.post('/api/mdt/:id/warrant/:wid/clear', requireAuth, gate, (req, res) => res.json({ ok: clearWarrant(gid(req), Number(req.params.wid)) }));
  app.post('/api/mdt/:id/citation', requireAuth, gate, async (req, res) => {
    const body = req.body || {};
    const cid = writeCitation(gid(req), body);
    if (typeof body.shot === 'string' && /^data:image\/png;base64,/.test(body.shot)) {
      try { const dir = path.join(process.cwd(), 'data', 'citations'); await fs.mkdir(dir, { recursive: true }); await fs.writeFile(path.join(dir, cid + '.png'), Buffer.from(body.shot.split(',')[1], 'base64')); } catch { /* screenshot save failed */ }
    }
    res.json({ ok: true, id: cid });
  });
  // Run ID / scan — extract name → Roblox mugshot + Discord pfp + live in-game state +
  // civilian-CAD record, then save the whole snapshot to the database.
  app.get('/api/mdt/:id/id', requireAuth, gate, async (req, res) => {
    const name = String(req.query.name || '').trim();
    const guildId = gid(req);
    const [mug, live] = await Promise.all([robloxMugshot(name), getLiveState(guildId).catch(() => null)]);
    const ingame = (live?.units || []).find((u) => u.name.toLowerCase() === name.toLowerCase()) || null;
    const record = nameLookup(guildId, name);
    let discord = null;
    try {
      const link = (allLinks(guildId) || []).find((l) => String(l.roblox_name || '').toLowerCase() === name.toLowerCase());
      if (link?.user_id) { const u = await client.users.fetch(link.user_id).catch(() => null); if (u) discord = { id: u.id, tag: u.tag || u.username, avatar: u.displayAvatarURL({ size: 128 }) }; }
    } catch { /* no discord link */ }
    const snap = { name, mugshot: mug, discord, ingame, record, at: Date.now() };
    saveIdScan(guildId, snap);
    res.json(snap);
  });
  app.get('/api/mdt/:id/idscans', requireAuth, gate, (req, res) => res.json(listIdScans(gid(req))));
  // Report Center — catalog of 60+ report types + save/list.
  app.get('/api/mdt/:id/reports/catalog', requireAuth, gate, (req, res) => res.json(reportCatalog()));
  app.post('/api/mdt/:id/report', requireAuth, gate, (req, res) => res.json({ ok: true, id: saveReport(gid(req), req.body || {}) }));
  app.get('/api/mdt/:id/reports', requireAuth, gate, (req, res) => res.json(listReports(gid(req))));
  // BOLO / ALPR
  app.get('/api/mdt/:id/bolos', requireAuth, gate, (req, res) => res.json(listBolos(gid(req))));
  app.post('/api/mdt/:id/bolo', requireAuth, gate, (req, res) => res.json({ ok: true, id: addBolo(gid(req), req.body || {}) }));
  app.post('/api/mdt/:id/bolo/:bid/delete', requireAuth, gate, (req, res) => { delBolo(gid(req), Number(req.params.bid)); res.json({ ok: true }); });
  // AI Judge + Jail/Bond
  app.post('/api/mdt/:id/judge/verdict', requireAuth, gate, async (req, res) => {
    const b = req.body || {};
    let prior = 'none on file';
    if (b.subject) { const rec = nameLookup(gid(req), b.subject); const w = rec.warrants?.length || 0; const c = rec.citations?.length || 0; if (w || c) prior = `${w} active warrant(s), ${c} prior citation(s)`; }
    res.json(await aiVerdict({ ...b, prior }));
  });
  app.post('/api/mdt/:id/judge/save', requireAuth, gate, (req, res) => res.json({ ok: true, id: saveVerdict(gid(req), req.body || {}) }));
  app.get('/api/mdt/:id/judge', requireAuth, gate, (req, res) => res.json(listVerdicts(gid(req))));
  app.post('/api/mdt/:id/judge/:vid/lock', requireAuth, gate, (req, res) => {
    const r = lockVerdict(gid(req), Number(req.params.vid), req.body?.judge || req.session.user?.username || 'Judge');
    if (r.repo && r.subject) flagRepo(gid(req), r.subject); // [REPO ELIGIBLE] on their vehicles
    res.json(r);
  });
  // 50-state law book (static reference) + bulk-load the full code into this guild's editable penal list.
  app.get('/api/mdt/:id/lawbook', requireAuth, gate, (req, res) => res.json(getLawbook()));
  app.post('/api/mdt/:id/penal/loadfull', requireAuth, gate, (req, res) => {
    for (const c of PENAL_CODE) addPenal(gid(req), { code: c.code, title: c.title, category: c.category, fine: c.fine, jail: c.jail });
    res.json({ ok: true, added: PENAL_CODE.length });
  });
  // Web law search (filtered to legal sources) + save results into the guild's law book.
  app.get('/api/mdt/:id/lawsearch', requireAuth, gate, async (req, res) => res.json(await lawSearch(String(req.query.q || ''))));
  app.get('/api/mdt/:id/lawrefs', requireAuth, gate, (req, res) => res.json(listLawRefs(gid(req))));
  app.post('/api/mdt/:id/lawref', requireAuth, gate, (req, res) => res.json({ ok: true, id: addLawRef(gid(req), req.body || {}) }));
  app.post('/api/mdt/:id/lawref/:rid/delete', requireAuth, gate, (req, res) => { delLawRef(gid(req), Number(req.params.rid)); res.json({ ok: true }); });
  console.log('👮 MDT (records + lookups) mounted at /mdt');
}
