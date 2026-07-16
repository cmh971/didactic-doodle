// DB helpers for punishments, BOLOs, automations, and mod stats.
import { getDb } from '../db/index.js';

const db = getDb();

export const punish = {
  create: db.prepare('INSERT INTO punishments(guild_id,roblox_user,type,reason,moderator_id) VALUES (?,?,?,?,?)'),
  search: db.prepare('SELECT * FROM punishments WHERE guild_id=? AND roblox_user LIKE ? ORDER BY id DESC LIMIT 15'),
  list: db.prepare('SELECT * FROM punishments WHERE guild_id=? ORDER BY id DESC LIMIT 15'),
  get: db.prepare('SELECT * FROM punishments WHERE id=? AND guild_id=?'),
  del: db.prepare('DELETE FROM punishments WHERE id=? AND guild_id=?'),
  edit: db.prepare('UPDATE punishments SET reason=? WHERE id=? AND guild_id=?'),
  leaderboard: db.prepare('SELECT moderator_id, COUNT(*) AS n FROM punishments WHERE guild_id=? GROUP BY moderator_id ORDER BY n DESC LIMIT 10'),
  byMod: db.prepare('SELECT COUNT(*) AS n FROM punishments WHERE guild_id=? AND moderator_id=?'),
};

export const bolo = {
  create: db.prepare('INSERT INTO bolos(guild_id,roblox_user,reason,created_by) VALUES (?,?,?,?)'),
  pending: db.prepare("SELECT * FROM bolos WHERE guild_id=? AND status='pending' ORDER BY id DESC LIMIT 15"),
  resolve: db.prepare("UPDATE bolos SET status='resolved' WHERE id=? AND guild_id=?"),
};

export const autos = {
  create: db.prepare('INSERT INTO automations(guild_id,name,trigger,action,data) VALUES (?,?,?,?,?)'),
  list: db.prepare('SELECT * FROM automations WHERE guild_id=?'),
  get: db.prepare('SELECT * FROM automations WHERE id=? AND guild_id=?'),
  del: db.prepare('DELETE FROM automations WHERE id=? AND guild_id=?'),
  edit: db.prepare('UPDATE automations SET name=?, trigger=?, action=?, data=? WHERE id=? AND guild_id=?'),
  toggle: db.prepare('UPDATE automations SET enabled=? WHERE id=? AND guild_id=?'),
};
