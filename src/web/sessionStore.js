// Persistent session store backed by the existing node:sqlite DB. The default
// express-session MemoryStore is wiped on every process restart — and we restart
// a lot — which logged everyone out constantly. This keeps logins alive across
// restarts (and shares them if the bot ever runs multiple workers).
import session from 'express-session';
import { getDb } from '../db/index.js';

const DAY = 24 * 60 * 60 * 1000;
const db = getDb();
db.exec('CREATE TABLE IF NOT EXISTS web_sessions (sid TEXT PRIMARY KEY, sess TEXT NOT NULL, expire INTEGER NOT NULL)');

const st = {
  get: db.prepare('SELECT sess, expire FROM web_sessions WHERE sid=?'),
  set: db.prepare('INSERT INTO web_sessions(sid,sess,expire) VALUES(?,?,?) ON CONFLICT(sid) DO UPDATE SET sess=excluded.sess, expire=excluded.expire'),
  del: db.prepare('DELETE FROM web_sessions WHERE sid=?'),
  touch: db.prepare('UPDATE web_sessions SET expire=? WHERE sid=?'),
  prune: db.prepare('DELETE FROM web_sessions WHERE expire < ?'),
};

const expiryOf = (sess) =>
  sess?.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + (sess?.cookie?.maxAge || 30 * DAY);

export class SqliteSessionStore extends session.Store {
  constructor() {
    super();
    // Sweep expired rows hourly so the table stays small.
    const timer = setInterval(() => { try { st.prune.run(Date.now()); } catch { /* ignore */ } }, 60 * 60 * 1000);
    timer.unref?.();
  }

  get(sid, cb) {
    try {
      const row = st.get.get(sid);
      if (!row) return cb(null, null);
      if (row.expire < Date.now()) { st.del.run(sid); return cb(null, null); }
      return cb(null, JSON.parse(row.sess));
    } catch (e) { return cb(e); }
  }

  set(sid, sess, cb) {
    try { st.set.run(sid, JSON.stringify(sess), expiryOf(sess)); if (cb) cb(null); }
    catch (e) { if (cb) cb(e); }
  }

  destroy(sid, cb) {
    try { st.del.run(sid); if (cb) cb(null); }
    catch (e) { if (cb) cb(e); }
  }

  touch(sid, sess, cb) {
    try { st.touch.run(expiryOf(sess), sid); if (cb) cb(null); }
    catch (e) { if (cb) cb(e); }
  }
}
