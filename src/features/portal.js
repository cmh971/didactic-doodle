// Civilian Portal (CAD stage 3). Player-facing: community members build their own
// characters, register vehicles (DMV), apply for licenses, and log firearms. Records
// are scoped to the owner's Discord ID (they only edit their own) but write into the
// SAME tables the MDT reads — so a car registered here shows up in an officer's plate
// lookup. Any logged-in user can use it (no department role needed).
import { getDb } from '../db/index.js';

const db = getDb();
// shared records tables already exist (mdt.js); add ownership + a firearms table.
for (const sql of [
  'ALTER TABLE cad_civilians ADD COLUMN owner_discord TEXT',
  'ALTER TABLE cad_vehicles ADD COLUMN owner_discord TEXT',
]) { try { db.exec(sql); } catch { /* column exists */ } }
db.exec(`CREATE TABLE IF NOT EXISTS cad_firearms (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, owner_discord TEXT, owner_name TEXT,
  serial TEXT, type TEXT, permit TEXT DEFAULT 'None', created_at INTEGER
)`);

const j = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const q = {
  chars: db.prepare('SELECT * FROM cad_civilians WHERE guild_id=? AND owner_discord=? ORDER BY id'),
  addChar: db.prepare('INSERT INTO cad_civilians(guild_id,owner_discord,name,dob,gender,address,licenses,flags,notes,phone,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)'),
  ownChar: db.prepare('SELECT * FROM cad_civilians WHERE id=? AND guild_id=? AND owner_discord=?'),
  setLic: db.prepare('UPDATE cad_civilians SET licenses=? WHERE id=? AND guild_id=? AND owner_discord=?'),
  delChar: db.prepare('DELETE FROM cad_civilians WHERE id=? AND guild_id=? AND owner_discord=?'),
  vehs: db.prepare('SELECT * FROM cad_vehicles WHERE guild_id=? AND owner_discord=? ORDER BY id'),
  addVeh: db.prepare('INSERT INTO cad_vehicles(guild_id,owner_discord,plate,owner,model,color,insurance,created_at) VALUES (?,?,?,?,?,?,?,?)'),
  delVeh: db.prepare('DELETE FROM cad_vehicles WHERE id=? AND guild_id=? AND owner_discord=?'),
  guns: db.prepare('SELECT * FROM cad_firearms WHERE guild_id=? AND owner_discord=? ORDER BY id'),
  addGun: db.prepare('INSERT INTO cad_firearms(guild_id,owner_discord,owner_name,serial,type,permit,created_at) VALUES (?,?,?,?,?,?,?)'),
  delGun: db.prepare('DELETE FROM cad_firearms WHERE id=? AND guild_id=? AND owner_discord=?'),
};

export function myStuff(gid, uid) {
  return {
    characters: q.chars.all(gid, uid).map((c) => ({ ...c, licenses: j(c.licenses, {}), flags: j(c.flags, []) })),
    vehicles: q.vehs.all(gid, uid),
    firearms: q.guns.all(gid, uid),
  };
}

export function registerPortalRoutes(app, client, auth, sendFile) {
  const { requireAuth } = auth;
  const uid = (req) => req.session.user?.id;
  const gid = (req) => req.params.id;
  const need = (req, res) => { if (!uid(req)) { res.status(401).json({ error: 'Sign in first.' }); return false; } return true; };

  app.get('/portal', requireAuth, (req, res) => sendFile(res, 'portal.html'));
  app.get('/api/portal/:id/me', requireAuth, (req, res) => { if (!need(req, res)) return; res.json(myStuff(gid(req), uid(req))); });

  app.post('/api/portal/:id/character', requireAuth, (req, res) => {
    if (!need(req, res)) return; const b = req.body || {};
    const id = Number(q.addChar.run(gid(req), uid(req), (b.name || 'Unnamed').slice(0, 60), b.dob || '', b.gender || '', (b.address || '').slice(0, 120), JSON.stringify(b.licenses || {}), '[]', (b.backstory || '').slice(0, 800), (b.phone || '').slice(0, 30), Date.now()).lastInsertRowid);
    res.json({ ok: true, id });
  });
  app.post('/api/portal/:id/character/:cid/licenses', requireAuth, (req, res) => {
    if (!need(req, res)) return;
    if (!q.ownChar.get(Number(req.params.cid), gid(req), uid(req))) return res.status(403).json({ error: 'Not your character.' });
    q.setLic.run(JSON.stringify(req.body?.licenses || {}), Number(req.params.cid), gid(req), uid(req));
    res.json({ ok: true });
  });
  app.post('/api/portal/:id/character/:cid/delete', requireAuth, (req, res) => { if (!need(req, res)) return; q.delChar.run(Number(req.params.cid), gid(req), uid(req)); res.json({ ok: true }); });

  app.post('/api/portal/:id/vehicle', requireAuth, (req, res) => {
    if (!need(req, res)) return; const b = req.body || {};
    const id = Number(q.addVeh.run(gid(req), uid(req), String(b.plate || '').slice(0, 12), (b.owner || '').slice(0, 60), (b.model || '').slice(0, 60), (b.color || '').slice(0, 40), b.insurance || 'Valid', Date.now()).lastInsertRowid);
    res.json({ ok: true, id });
  });
  app.post('/api/portal/:id/vehicle/:vid/delete', requireAuth, (req, res) => { if (!need(req, res)) return; q.delVeh.run(Number(req.params.vid), gid(req), uid(req)); res.json({ ok: true }); });

  app.post('/api/portal/:id/firearm', requireAuth, (req, res) => {
    if (!need(req, res)) return; const b = req.body || {};
    const id = Number(q.addGun.run(gid(req), uid(req), (b.owner || '').slice(0, 60), (b.serial || '').slice(0, 30), (b.type || '').slice(0, 40), b.permit || 'None', Date.now()).lastInsertRowid);
    res.json({ ok: true, id });
  });
  app.post('/api/portal/:id/firearm/:fid/delete', requireAuth, (req, res) => { if (!need(req, res)) return; q.delGun.run(Number(req.params.fid), gid(req), uid(req)); res.json({ ok: true }); });

  console.log('🚗 Civilian Portal mounted at /portal');
}
