// Server events — the fun economy layer: daily WHEEL spin, a persistent LOTTERY
// with a growing pot, and live channel HEISTS. Everything moves real coins through
// the economy store, so wins/losses stick.
//
// Surfaced through the "?" pack (?wheel, ?lottery, ?heist) so it doesn't burn any of
// Discord's 100 slash-command slots.
import { getDb } from '../db/index.js';
import { balance, addWallet, checkCooldown, setCooldown } from '../economy/store.js';
import { awardBadge, checkWealthBadges, unlockLine } from './badges.js';

const rint = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const fmt = (n) => Number(n || 0).toLocaleString();
const weightedPick = (arr) => {
  const total = arr.reduce((a, x) => a + x.weight, 0);
  let r = Math.random() * total;
  for (const x of arr) { if ((r -= x.weight) <= 0) return x; }
  return arr[arr.length - 1];
};
const dur = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${ss}s` : `${ss}s`;
};

/* ============================ WHEEL (daily spin) ============================ */
const WHEEL_CD = 24 * 3600 * 1000;
const WHEEL = [
  { label: '💀 Bust — nothing', weight: 20, min: 0, max: 0 },
  { label: '🪙 Small win', weight: 30, min: 50, max: 150 },
  { label: '💵 Not bad!', weight: 22, min: 200, max: 400 },
  { label: '💰 Big win', weight: 15, min: 550, max: 950 },
  { label: '🎁 Bonus bag', weight: 9, min: 1200, max: 2000 },
  { label: '🎰 JACKPOT', weight: 3, min: 3500, max: 5500 },
  { label: '✨ MEGA JACKPOT ✨', weight: 1, min: 9000, max: 14000 },
];
export function spinWheel(userId) {
  const rem = checkCooldown(userId, 'wheel', WHEEL_CD);
  if (rem > 0) return { ok: false, wait: rem };
  const seg = weightedPick(WHEEL);
  const amount = seg.max ? rint(seg.min, seg.max) : 0;
  if (amount > 0) addWallet(userId, amount, 'wheel');
  setCooldown(userId, 'wheel');
  return { ok: true, label: seg.label, amount, wallet: balance(userId).wallet };
}
export function wheelTiers() {
  const total = WHEEL.reduce((a, x) => a + x.weight, 0);
  return WHEEL.map((s) => ({ label: s.label, min: s.min, max: s.max, odds: +((s.weight / total) * 100).toFixed(1) }));
}
export function renderWheel(guildId, userId, name) {
  const r = spinWheel(userId);
  if (!r.ok) return `⏳ ${name}, your wheel is recharging — come back in **${dur(r.wait)}**.`;
  const spin = ['🎡 *spinning…*', '🎡 *tick… tick… tick…*'][rint(0, 1)];
  if (!r.amount) return `${spin}\n${r.label}! Ah, no luck today. 😬 Try again tomorrow!`;
  let badges = [];
  if (/JACKPOT/i.test(r.label)) { const b = awardBadge(guildId, userId, 'jackpot'); if (b) badges.push(b); }
  badges = badges.concat(checkWealthBadges(guildId, userId, balance(userId).total));
  return `${spin}\n**${r.label}** — you won **${fmt(r.amount)}** 🪙!\n💼 Wallet: **${fmt(r.wallet)}**` + unlockLine(badges);
}

/* ============================== LOTTERY ==================================== */
const db = getDb();
db.exec(`CREATE TABLE IF NOT EXISTS lottery_state (
  guild_id TEXT PRIMARY KEY,
  round INTEGER NOT NULL DEFAULT 1,
  pot INTEGER NOT NULL DEFAULT 0,
  draws_at INTEGER NOT NULL,
  last_winner TEXT, last_winner_name TEXT, last_prize INTEGER, last_round INTEGER
)`);
db.exec(`CREATE TABLE IF NOT EXISTS lottery_tickets (
  guild_id TEXT, round INTEGER, user_id TEXT, name TEXT, tickets INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, round, user_id)
)`);
const L = {
  get: db.prepare('SELECT * FROM lottery_state WHERE guild_id=?'),
  init: db.prepare('INSERT INTO lottery_state(guild_id,round,pot,draws_at) VALUES (?,1,?,?)'),
  setPot: db.prepare('UPDATE lottery_state SET pot=? WHERE guild_id=?'),
  tickets: db.prepare('SELECT user_id,name,tickets FROM lottery_tickets WHERE guild_id=? AND round=?'),
  myTix: db.prepare('SELECT tickets FROM lottery_tickets WHERE guild_id=? AND round=? AND user_id=?'),
  buy: db.prepare(`INSERT INTO lottery_tickets(guild_id,round,user_id,name,tickets) VALUES (?,?,?,?,?)
                   ON CONFLICT(guild_id,round,user_id) DO UPDATE SET tickets=tickets+excluded.tickets, name=excluded.name`),
  nextRound: db.prepare('UPDATE lottery_state SET round=round+1, pot=?, draws_at=?, last_winner=?, last_winner_name=?, last_prize=?, last_round=? WHERE guild_id=?'),
};
const TICKET_PRICE = 100;
const ROUND_MS = 24 * 3600 * 1000;
const SEED_POT = 1000; // house seeds each fresh round so there's always something to win

function ensureLottery(guildId) {
  let s = L.get.get(guildId);
  if (!s) { L.init.run(guildId, SEED_POT, Date.now() + ROUND_MS); s = L.get.get(guildId); }
  return s;
}

// Lazy draw: if the deadline passed and tickets were sold, resolve + pay the winner.
// Returns a result object when a draw happened, else null.
function maybeDraw(guildId) {
  const s = ensureLottery(guildId);
  if (Date.now() < s.draws_at) return null;
  const rows = L.tickets.all(guildId, s.round);
  const totalTix = rows.reduce((a, r) => a + r.tickets, 0);
  if (!totalTix) { // nobody played — roll the pot forward
    L.setPot.run(s.pot, guildId);
    db.prepare('UPDATE lottery_state SET draws_at=? WHERE guild_id=?').run(Date.now() + ROUND_MS, guildId);
    return null;
  }
  let pick = rint(1, totalTix), winner = rows[0];
  for (const r of rows) { if ((pick -= r.tickets) <= 0) { winner = r; break; } }
  const prize = s.pot;
  addWallet(winner.user_id, prize, 'lottery');
  const badges = [awardBadge(guildId, winner.user_id, 'lottoWin'), ...checkWealthBadges(guildId, winner.user_id, balance(winner.user_id).total)].filter(Boolean);
  L.nextRound.run(SEED_POT, Date.now() + ROUND_MS, winner.user_id, winner.name, prize, s.round, guildId);
  return { round: s.round, winnerId: winner.user_id, winnerName: winner.name, prize, totalTix, badges };
}

export function lotteryStatus(guildId, userId) {
  const drew = maybeDraw(guildId);
  const s = ensureLottery(guildId);
  const rows = L.tickets.all(guildId, s.round);
  const totalTix = rows.reduce((a, r) => a + r.tickets, 0);
  const mine = L.myTix.get(guildId, s.round, userId)?.tickets || 0;
  const odds = totalTix ? ((mine / totalTix) * 100).toFixed(1) : '0.0';
  return { round: s.round, pot: s.pot, totalTix, mine, odds, drawIn: s.draws_at - Date.now(),
    lastWinner: s.last_winner_name, lastPrize: s.last_prize, lastRound: s.last_round, drew };
}

export function lotteryBuy(guildId, userId, name, n) {
  n = Math.max(1, Math.min(1000, Math.floor(n || 1)));
  const cost = n * TICKET_PRICE;
  const bal = balance(userId).wallet;
  if (bal < cost) return { ok: false, cost, bal };
  maybeDraw(guildId); // resolve any pending draw first so tickets land in the live round
  const s = ensureLottery(guildId);
  addWallet(userId, -cost, 'lottery');
  L.buy.run(guildId, s.round, userId, String(name).slice(0, 60), n);
  L.setPot.run(s.pot + cost, guildId);
  const mine = L.myTix.get(guildId, s.round, userId)?.tickets || n;
  return { ok: true, bought: n, cost, mine, pot: s.pot + cost, price: TICKET_PRICE };
}

export function renderLottery(guildId, userId, name, arg) {
  const sub = String(arg || '').trim().toLowerCase();
  const mBuy = /^buy\s*(\d+)?/.exec(sub);
  if (mBuy) {
    const r = lotteryBuy(guildId, userId, name, Number(mBuy[1] || 1));
    if (!r.ok) return `❌ You need **${fmt(r.cost)}** 🪙 for that (you have **${fmt(r.bal)}**). Tickets are ${fmt(TICKET_PRICE)} each.`;
    return `🎟️ Bought **${r.bought}** ticket${r.bought > 1 ? 's' : ''} for **${fmt(r.cost)}** 🪙.\nYou now hold **${fmt(r.mine)}** tickets. 🏆 Pot: **${fmt(r.pot)}** 🪙`;
  }
  const st = lotteryStatus(guildId, userId);
  const head = st.drew ? `🎉 **Round #${st.drew.round} drawn!** ${st.drew.winnerName} won **${fmt(st.drew.prize)}** 🪙!${unlockLine(st.drew.badges)}\n\n` : '';
  const last = st.lastWinner ? `\n🏅 Last winner: **${st.lastWinner}** (+${fmt(st.lastPrize)} 🪙, round #${st.lastRound})` : '';
  return `${head}🎰 **Server Lottery — Round #${st.round}**\n` +
    `🏆 Pot: **${fmt(st.pot)}** 🪙\n` +
    `🎟️ Your tickets: **${fmt(st.mine)}** / ${fmt(st.totalTix)}  (**${st.odds}%** odds)\n` +
    `⏳ Draw in: **${dur(st.drawIn)}**\n` +
    `💵 Buy with \`?lottery buy <n>\` — ${fmt(TICKET_PRICE)} 🪙 each${last}`;
}

/* =============================== HEIST ===================================== */
// A live, channel-scoped lobby: someone starts it, others join within the window,
// then it resolves — success odds rise with crew size, loot is split among the crew.
const heists = new Map(); // channelId -> { hostId, ante, players:Map(id->name), timer, chan }
const HEIST_WINDOW = 60000;
const HEIST_MIN_ANTE = 100, HEIST_MAX_ANTE = 25000;

export function heistCommand({ guildId, channelId, channel, userId, name, arg }) {
  const active = heists.get(channelId);
  const sub = String(arg || '').trim().toLowerCase();

  // Join an existing heist (explicit "join" or a bare ?heist while one is open).
  if (active && (sub === 'join' || sub === '')) {
    if (active.players.has(userId)) return `🎭 ${name}, you're already in the crew. Sit tight — job kicks off soon!`;
    const bal = balance(userId).wallet;
    if (bal < active.ante) return `❌ The buy-in is **${fmt(active.ante)}** 🪙 and you've got **${fmt(bal)}**. Can't join this one.`;
    addWallet(userId, -active.ante, 'heist');
    active.players.set(userId, name);
    return `🔫 **${name}** joined the heist! Crew: **${active.players.size}** · Pot: **${fmt(active.players.size * active.ante)}** 🪙`;
  }

  if (active) return `🚨 A heist is already being planned in this channel — type \`?heist\` to join! (Pot: ${fmt(active.players.size * active.ante)} 🪙)`;

  // Start a new heist.
  let ante = 250;
  const mAnte = /(\d+)/.exec(sub);
  if (mAnte) ante = Math.max(HEIST_MIN_ANTE, Math.min(HEIST_MAX_ANTE, Number(mAnte[1])));
  const bal = balance(userId).wallet;
  if (bal < ante) return `❌ You need **${fmt(ante)}** 🪙 to start a heist with that buy-in (you have **${fmt(bal)}**).`;
  addWallet(userId, -ante, 'heist');
  const h = { hostId: userId, guildId, ante, players: new Map([[userId, name]]), chan: channel, timer: null };
  h.timer = setTimeout(() => resolveHeist(channelId), HEIST_WINDOW);
  heists.set(channelId, h);
  return `🚨💰 **${name} is planning a HEIST!** 💰🚨\n` +
    `Buy-in: **${fmt(ante)}** 🪙 · Type \`?heist\` in the next **60s** to join the crew.\n` +
    `The bigger the crew, the better the odds. 🕶️`;
}

function resolveHeist(channelId) {
  const h = heists.get(channelId);
  heists.delete(channelId);
  if (!h) return;
  const crew = [...h.players.entries()]; // [ [id,name], ... ]
  const n = crew.length;
  const pot = n * h.ante;
  // Odds scale with crew size: 32% solo → up to ~85%.
  const chance = Math.min(0.85, 0.32 + (n - 1) * 0.09);
  const success = Math.random() < chance;
  const send = (msg) => { try { h.chan?.send(msg); } catch { /* channel gone */ } };

  if (!success) {
    send(`🚔 **BUSTED!** The crew of **${n}** got caught red-handed and lost their buy-in. 💸\n` +
      `Better luck next score. (${Math.round(chance * 100)}% success this run.)`);
    return;
  }
  // Success: loot = pot × multiplier, split evenly.
  const mult = 1.5 + Math.random(); // 1.5×–2.5×
  const loot = Math.floor(pot * mult);
  const share = Math.floor(loot / n);
  const unlocks = [];
  for (const [id, nm] of crew) {
    addWallet(id, share, 'heist');
    const b = awardBadge(h.guildId, id, 'heistWin'); if (b) unlocks.push(`${nm} ${b.emoji}`);
    for (const w of checkWealthBadges(h.guildId, id, balance(id).total)) unlocks.push(`${nm} ${w.emoji}`);
  }
  const names = crew.map(([, nm]) => nm).join(', ');
  send(`💰🎉 **HEIST SUCCESS!** The crew cracked the vault for **${fmt(loot)}** 🪙 (${mult.toFixed(1)}×)!\n` +
    `👥 Crew: ${names}\n` +
    `Each robber takes home **${fmt(share)}** 🪙. 🕶️💵` +
    (unlocks.length ? `\n🏅 **Unlocked:** ${unlocks.join(' · ')}` : ''));
}
