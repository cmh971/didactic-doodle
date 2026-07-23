// Economy store — now backed by a real ACID database (embedded SQLite via the
// data layer in src/db). The public API is unchanged & synchronous, so every
// existing command keeps working without edits. All currency mutations are
// written through the `transactions` ledger for a full audit trail.
import { getDb } from '../db/index.js';
import { STARTING_BALANCE } from '../config.js';
import { mirror } from '../db/mirror.js';

const db = getDb();
const SCOPE = 'global'; // default currency scope (per-guild scopes also supported)

// Copy a user's current balance to the optional Mongo/Postgres mirror.
// No-op unless MONGO_URI / DATABASE_URL are set. Never throws / blocks.
function mirrorBal(id) {
  const r = stmt.getBal.get(id, SCOPE);
  if (r) mirror('balances', `${SCOPE}:${id}`, { userId: id, scope: SCOPE, wallet: r.wallet, bank: r.bank });
}

// Hard ceiling on any single balance. SQLite can store bigger, but reading a
// value above 2^53 (~9.007e15) throws in better-sqlite3, which crashes every
// economy read. 1 quadrillion is huge yet safely under the limit.
const MAX_BAL = 1_000_000_000_000_000;
const clampBal = (n) => Math.min(MAX_BAL, Math.max(0, Math.floor(Number(n) || 0)));

// ---- prepared statements ----
const stmt = {
  insUser: db.prepare('INSERT OR IGNORE INTO users(user_id, username) VALUES (?, ?)'),
  insBal: db.prepare('INSERT OR IGNORE INTO balances(user_id, scope, wallet) VALUES (?, ?, ?)'),
  getBal: db.prepare('SELECT wallet, bank, wins, losses, streak FROM balances WHERE user_id = ? AND scope = ?'),
  setWallet: db.prepare('UPDATE balances SET wallet = ? WHERE user_id = ? AND scope = ?'),
  setBank: db.prepare('UPDATE balances SET bank = ? WHERE user_id = ? AND scope = ?'),
  bumpWin: db.prepare('UPDATE balances SET wins = wins + 1 WHERE user_id = ? AND scope = ?'),
  bumpLoss: db.prepare('UPDATE balances SET losses = losses + 1 WHERE user_id = ? AND scope = ?'),
  inv: db.prepare('SELECT item_id, qty FROM inventories WHERE user_id = ?'),
  invOne: db.prepare('SELECT qty FROM inventories WHERE user_id = ? AND item_id = ?'),
  invUpsert: db.prepare(
    'INSERT INTO inventories(user_id, item_id, qty) VALUES (?, ?, ?) ON CONFLICT(user_id, item_id) DO UPDATE SET qty = qty + excluded.qty',
  ),
  invSet: db.prepare('UPDATE inventories SET qty = ? WHERE user_id = ? AND item_id = ?'),
  invDel: db.prepare('DELETE FROM inventories WHERE user_id = ? AND item_id = ?'),
  cdGet: db.prepare('SELECT used_at FROM cooldowns WHERE user_id = ? AND action = ?'),
  cdSet: db.prepare(
    'INSERT INTO cooldowns(user_id, action, used_at) VALUES (?, ?, ?) ON CONFLICT(user_id, action) DO UPDATE SET used_at = excluded.used_at',
  ),
  tx: db.prepare(
    'INSERT INTO transactions(user_id, scope, type, amount, balance_after, meta) VALUES (?, ?, ?, ?, ?, ?)',
  ),
  cooldownsAll: db.prepare('SELECT action, used_at FROM cooldowns WHERE user_id = ?'),
  board: db.prepare(
    'SELECT user_id AS id, (wallet + bank) AS total FROM balances WHERE scope = ? ORDER BY total DESC LIMIT ?',
  ),
  shopAll: db.prepare('SELECT * FROM shop_items ORDER BY price ASC'),
  shopOne: db.prepare('SELECT * FROM shop_items WHERE id = ?'),
  shopIns: db.prepare(
    `INSERT INTO shop_items(id, name, price, description, category, rarity, effect, consumable, custom, added_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ),
};

export function getUserRow(id) {
  stmt.insUser.run(id, '');
  stmt.insBal.run(id, SCOPE, STARTING_BALANCE);
  return stmt.getBal.get(id, SCOPE);
}

export function getUser(id) {
  const row = getUserRow(id);
  const inventory = {};
  for (const { item_id, qty } of stmt.inv.all(id)) inventory[item_id] = qty;
  const cooldowns = {};
  for (const { action, used_at } of stmt.cooldownsAll.all(id)) cooldowns[action] = used_at;
  return { wallet: row.wallet, bank: row.bank, inventory, wins: row.wins, losses: row.losses, streak: row.streak, cooldowns };
}

export function balance(id) {
  const row = getUserRow(id);
  return { wallet: row.wallet, bank: row.bank, total: row.wallet + row.bank };
}

export function addWallet(id, amount, type = 'adjust') {
  const row = getUserRow(id);
  const next = clampBal(row.wallet + Math.floor(amount));
  stmt.setWallet.run(next, id, SCOPE);
  stmt.tx.run(id, SCOPE, type, Math.floor(amount), next, null);
  mirrorBal(id);
  return next;
}

export function setWallet(id, amount) {
  getUserRow(id);
  const next = clampBal(amount);
  stmt.setWallet.run(next, id, SCOPE);
  stmt.tx.run(id, SCOPE, 'set', next, next, null);
  mirrorBal(id);
  return next;
}

export function deposit(id, amount) {
  const row = getUserRow(id);
  const amt = Math.min(Math.floor(amount), row.wallet);
  if (amt <= 0) return { ok: false, reason: 'You have nothing to deposit.' };
  stmt.setWallet.run(row.wallet - amt, id, SCOPE);
  stmt.setBank.run(clampBal(row.bank + amt), id, SCOPE);
  stmt.tx.run(id, SCOPE, 'deposit', -amt, row.wallet - amt, null);
  mirrorBal(id);
  return { ok: true, amount: amt };
}

export function withdraw(id, amount) {
  const row = getUserRow(id);
  const amt = Math.min(Math.floor(amount), row.bank);
  if (amt <= 0) return { ok: false, reason: 'Your bank is empty.' };
  stmt.setBank.run(row.bank - amt, id, SCOPE);
  stmt.setWallet.run(clampBal(row.wallet + amt), id, SCOPE);
  stmt.tx.run(id, SCOPE, 'withdraw', amt, row.wallet + amt, null);
  mirrorBal(id);
  return { ok: true, amount: amt };
}

export function transfer(fromId, toId, amount) {
  amount = Math.floor(amount);
  const from = getUserRow(fromId);
  if (amount <= 0) return { ok: false, reason: 'Amount must be positive.' };
  if (from.wallet < amount) return { ok: false, reason: 'You do not have that many tokens in your wallet.' };
  const to = getUserRow(toId);
  db.exec('BEGIN');
  try {
    stmt.setWallet.run(from.wallet - amount, fromId, SCOPE);
    stmt.setWallet.run(clampBal(to.wallet + amount), toId, SCOPE);
    stmt.tx.run(fromId, SCOPE, 'transfer_out', -amount, from.wallet - amount, JSON.stringify({ to: toId }));
    stmt.tx.run(toId, SCOPE, 'transfer_in', amount, to.wallet + amount, JSON.stringify({ from: fromId }));
    db.exec('COMMIT');
    mirrorBal(fromId);
    mirrorBal(toId);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { ok: true };
}

// ---- cooldowns ----
// The bot owner ignores ALL cooldowns (rob, daily, work, crime, …).
function isEcoOwner(id) {
  const ids = (process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return ids.length ? ids.includes(id) : id === '1183222250153984040';
}

export function checkCooldown(id, action, ms) {
  if (isEcoOwner(id)) return 0; // owner: never on cooldown
  const row = stmt.cdGet.get(id, action);
  if (!row) return 0;
  const remaining = row.used_at + ms - Date.now();
  return remaining > 0 ? remaining : 0;
}

export function setCooldown(id, action) {
  stmt.cdSet.run(id, action, Date.now());
}

// ---- inventory ----
export function addItem(id, itemId, qty = 1) {
  getUserRow(id);
  stmt.invUpsert.run(id, itemId, qty);
}

export function removeItem(id, itemId, qty = 1) {
  const row = stmt.invOne.get(id, itemId);
  if (!row || row.qty < qty) return false;
  const next = row.qty - qty;
  if (next <= 0) stmt.invDel.run(id, itemId);
  else stmt.invSet.run(next, id, itemId);
  return true;
}

export function hasItem(id, itemId) {
  const row = stmt.invOne.get(id, itemId);
  return Boolean(row && row.qty > 0);
}

// ---- daily streak ----
const setStreakStmt = db.prepare('UPDATE balances SET streak = ? WHERE user_id = ? AND scope = ?');
export function getStreak(id) {
  return getUserRow(id).streak;
}
export function setStreak(id, n) {
  getUserRow(id);
  setStreakStmt.run(n, id, SCOPE);
  return n;
}

// ---- stats ----
export function recordWin(id) {
  getUserRow(id);
  stmt.bumpWin.run(id, SCOPE);
}
export function recordLoss(id) {
  getUserRow(id);
  stmt.bumpLoss.run(id, SCOPE);
}

// ---- leaderboard ----
export function leaderboard(limit = 10) {
  return stmt.board.all(SCOPE, limit);
}

// ======================= SHOP =======================
export const DEFAULT_ITEMS = [
  { id: 'timeout_hammer', name: '🔨 Timeout Hammer', price: 75_000, description: 'Time out any member you outrank. ⚠️ If they OUTRANK you it backfires and YOU get the Buck role + a timeout!', category: 'equipment', rarity: 'epic', consumable: true, effect: 'timeout' },
  { id: 'lootbox', name: '🎁 Mystery Loot Box', price: 40_000, description: 'Open it for a random token payout (could be huge, could be tiny).', category: 'consumable', rarity: 'uncommon', consumable: true, effect: 'lootbox' },
  { id: 'shield', name: '🛡️ Rob Shield', price: 60_000, description: 'Blocks the next person who tries to rob you.', category: 'booster', rarity: 'uncommon', consumable: true, effect: 'shield' },
  { id: 'vip', name: '💎 VIP Diamond Pass', price: 500_000, description: 'A shiny flex collectible that screams "I am rich".', category: 'collectible', rarity: 'epic', consumable: false, effect: 'collectible' },
  { id: 'crown', name: '👑 Golden Crown', price: 5_000_000, description: 'The ultimate flex. Only the wealthiest wear it.', category: 'collectible', rarity: 'legendary', consumable: false, effect: 'collectible' },
  { id: 'fish', name: '🐟 Lucky Fish', price: 9_999, description: 'A slippery little companion that brings good fortune.', category: 'collectible', rarity: 'common', consumable: false, effect: 'collectible' },
];

// Seed default catalog (idempotent).
for (const it of DEFAULT_ITEMS) {
  if (!stmt.shopOne.get(it.id)) {
    stmt.shopIns.run(it.id, it.name, it.price, it.description, it.category, it.rarity, it.effect, it.consumable ? 1 : 0, 0, null);
  }
}

function rowToItem(r) {
  return {
    id: r.id, name: r.name, price: r.price, description: r.description,
    category: r.category, rarity: r.rarity, effect: r.effect,
    consumable: Boolean(r.consumable), custom: Boolean(r.custom), addedBy: r.added_by,
  };
}

export function getShopItems() {
  return stmt.shopAll.all().map(rowToItem);
}

export function getItem(itemId) {
  const r = stmt.shopOne.get(itemId);
  return r ? rowToItem(r) : undefined;
}

export function addShopItem(item) {
  if (stmt.shopOne.get(item.id)) return { ok: false, reason: 'An item with that id already exists.' };
  stmt.shopIns.run(
    item.id, item.name, item.price, item.description,
    item.category || 'collectible', item.rarity || 'common', item.effect || 'collectible',
    item.consumable ? 1 : 0, item.custom ? 1 : 0, item.addedBy || null,
  );
  return { ok: true, item };
}
// End of file: src/economy/store.js  S