// BOLO / ALPR — "Be On the Lookout" alerts + Automated License Plate Reader.
// Officers save BOLOs for a plate or a person; boloScan() runs the live ER:LC
// vehicle + player lists against them each dispatch poll and surfaces hits, so a
// flagged plate driving past lights up the dispatcher console automatically.
import { getDb } from '../db/index.js';

const db = getDb();
db.exec(`CREATE TABLE IF NOT EXISTS cad_bolos (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'plate', value TEXT NOT NULL, reason TEXT, created_at INTEGER
)`);
const q = {
  list: db.prepare('SELECT * FROM cad_bolos WHERE guild_id=? ORDER BY id DESC'),
  add: db.prepare('INSERT INTO cad_bolos(guild_id,kind,value,reason,created_at) VALUES (?,?,?,?,?)'),
  del: db.prepare('DELETE FROM cad_bolos WHERE id=? AND guild_id=?'),
};

export function listBolos(g) { return q.list.all(g); }
export function addBolo(g, b) { return Number(q.add.run(g, b.kind === 'person' ? 'person' : 'plate', String(b.value || '').slice(0, 40), String(b.reason || '').slice(0, 200), Date.now()).lastInsertRowid); }
export function delBolo(g, id) { q.del.run(id, g); }

// Scan live vehicles (plate BOLOs) + players (person BOLOs) → array of hits.
export function boloScan(guildId, { vehicles = [], units = [] } = {}) {
  const bolos = q.list.all(guildId);
  if (!bolos.length) return [];
  const plates = new Map(); const people = new Map();
  for (const b of bolos) (b.kind === 'person' ? people : plates).set(String(b.value).toLowerCase(), b);
  const hits = [];
  if (plates.size) for (const v of vehicles) { const b = plates.get(String(v.Plate || '').toLowerCase()); if (b) hits.push({ id: b.id, type: 'plate', label: v.Plate, detail: `${v.Name || '?'} · owner ${v.Owner || '?'}`, reason: b.reason }); }
  if (people.size) for (const u of units) { const b = people.get(String(u.name || '').toLowerCase()); if (b) hits.push({ id: b.id, type: 'person', label: u.name, detail: `${u.team || '?'} · 📍 ${u.street || u.postal || '?'}`, reason: b.reason }); }
  return hits;
}
