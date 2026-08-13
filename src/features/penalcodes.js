// Penal codes + 10-codes — the legal dictionary behind the CAD. Officers pick a
// penal code when writing a citation (auto-fills fine + jail); dispatchers reference
// the 10-codes. Each guild gets a sensible default set on first use, fully editable.
import { getDb } from '../db/index.js';

const db = getDb();
db.exec(`CREATE TABLE IF NOT EXISTS cad_penal (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, code TEXT, title TEXT, category TEXT, fine INTEGER DEFAULT 0, jail INTEGER DEFAULT 0)`);
db.exec(`CREATE TABLE IF NOT EXISTS cad_tencodes (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, code TEXT, meaning TEXT)`);
const q = {
  penal: db.prepare('SELECT * FROM cad_penal WHERE guild_id=? ORDER BY category, code'),
  penalN: db.prepare('SELECT COUNT(*) n FROM cad_penal WHERE guild_id=?'),
  addPenal: db.prepare('INSERT INTO cad_penal(guild_id,code,title,category,fine,jail) VALUES (?,?,?,?,?,?)'),
  delPenal: db.prepare('DELETE FROM cad_penal WHERE id=? AND guild_id=?'),
  ten: db.prepare('SELECT * FROM cad_tencodes WHERE guild_id=? ORDER BY code'),
  tenN: db.prepare('SELECT COUNT(*) n FROM cad_tencodes WHERE guild_id=?'),
  addTen: db.prepare('INSERT INTO cad_tencodes(guild_id,code,meaning) VALUES (?,?,?)'),
  delTen: db.prepare('DELETE FROM cad_tencodes WHERE id=? AND guild_id=?'),
};

const DEFAULT_PENAL = [
  ['P.1', 'Speeding', 'Traffic', 250, 0], ['P.2', 'Reckless Driving', 'Traffic', 500, 5],
  ['P.3', 'Driving Under the Influence', 'Traffic', 1000, 15], ['P.4', 'Failure to Stop', 'Traffic', 400, 5],
  ['P.5', 'Assault', 'Criminal', 1500, 20], ['P.6', 'Armed Robbery', 'Criminal', 3000, 30],
  ['P.7', 'Grand Theft Auto', 'Criminal', 2500, 25], ['P.8', 'Evading Police', 'Criminal', 2000, 20],
  ['P.9', 'Possession of a Firearm', 'Criminal', 1200, 15], ['P.10', 'Murder', 'Criminal', 10000, 60],
];
const DEFAULT_TEN = [
  ['10-4', 'Acknowledged'], ['10-7', 'Out of service'], ['10-8', 'In service'], ['10-11', 'Traffic stop'],
  ['10-20', 'Location'], ['10-50', 'Vehicle accident'], ['10-80', 'Pursuit in progress'], ['10-97', 'Arrived on scene'],
  ['10-99', 'Officer in distress'], ['Signal 100', 'Emergency traffic only — hold all radio'],
];

export function listPenal(gid) { if (q.penalN.get(gid).n === 0) for (const p of DEFAULT_PENAL) q.addPenal.run(gid, ...p); return q.penal.all(gid); }
export function addPenal(gid, p) { q.addPenal.run(gid, (p.code || '').slice(0, 12), (p.title || '').slice(0, 80), (p.category || 'General').slice(0, 30), Math.max(0, Number(p.fine) || 0), Math.max(0, Number(p.jail) || 0)); }
export function delPenal(gid, id) { q.delPenal.run(id, gid); }
export function listTen(gid) { if (q.tenN.get(gid).n === 0) for (const t of DEFAULT_TEN) q.addTen.run(gid, ...t); return q.ten.all(gid); }
export function addTen(gid, t) { q.addTen.run(gid, (t.code || '').slice(0, 16), (t.meaning || '').slice(0, 100)); }
export function delTen(gid, id) { q.delTen.run(id, gid); }
