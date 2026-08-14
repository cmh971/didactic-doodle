// Persistence + PvP layer that turns Chris's Lua racing pack into a real game —
// WITHOUT touching racing_commands.lua. Garages (car/livery/record) live in SQLite;
// credits ARE the real bot economy, so a race payout is spendable in /shop.
//
//   !race @user [wager]  — head-to-head, winner takes the pot (real credits)
//   !garage [@user]      — your ride, record, and net worth
// The per-user car/livery persistence for the Lua commands is driven from here too
// (see loadPlayer/savePlayer, called by racingLua.js around each command).
import { EmbedBuilder } from 'discord.js';
import { getDb } from '../db/index.js';
import { balance, addWallet, recordWin, recordLoss } from '../economy/store.js';

const db = getDb();
db.exec(`CREATE TABLE IF NOT EXISTS racing_garage (
  user_id   TEXT PRIMARY KEY,
  car       TEXT NOT NULL DEFAULT 'Mazda MX-5 Cup',
  livery    TEXT NOT NULL DEFAULT 'Red Bull Racing',
  wins      INTEGER NOT NULL DEFAULT 0,
  losses    INTEGER NOT NULL DEFAULT 0,
  races     INTEGER NOT NULL DEFAULT 0,
  best_lap  REAL,
  updated_at INTEGER
)`);
const q = {
  get: db.prepare('SELECT * FROM racing_garage WHERE user_id=?'),
  upsert: db.prepare(`INSERT INTO racing_garage(user_id,car,livery,updated_at) VALUES(@user_id,@car,@livery,@t)
    ON CONFLICT(user_id) DO UPDATE SET car=@car, livery=@livery, updated_at=@t`),
  result: db.prepare(`INSERT INTO racing_garage(user_id,wins,losses,races,best_lap,updated_at)
    VALUES(@user_id,@w,@l,1,@best,@t)
    ON CONFLICT(user_id) DO UPDATE SET wins=wins+@w, losses=losses+@l, races=races+1,
      best_lap=CASE WHEN best_lap IS NULL OR @best<best_lap THEN @best ELSE best_lap END, updated_at=@t`),
};

db.exec(`CREATE TABLE IF NOT EXISTS racing_owned (
  user_id TEXT NOT NULL,
  car     TEXT NOT NULL,
  PRIMARY KEY (user_id, car)
)`);
const own = {
  add: db.prepare('INSERT OR IGNORE INTO racing_owned(user_id, car) VALUES(?, ?)'),
  has: db.prepare('SELECT 1 FROM racing_owned WHERE user_id=? AND car=?'),
  list: db.prepare('SELECT car FROM racing_owned WHERE user_id=?'),
};

// The car catalog — source of truth for price AND race performance. A faster car
// literally helps you win (its rating feeds the race roll), so the loop closes:
// race → earn → buy faster → win more. It stays mostly luck, so a Miata can still
// upset an F1 car on a good day.
export const CAR_CATALOG = [
  { name: 'Mazda MX-5 Cup', price: 0, rating: 74, emoji: '🚗', desc: 'The people’s champ. Your free starter.' },
  { name: 'Civic Type R', price: 5000, rating: 78, emoji: '🚙', desc: 'FWD hot-hatch hero.' },
  { name: 'Supra MK4', price: 15000, rating: 86, emoji: '🏎️', desc: '2JZ legend — huge tuning ceiling.' },
  { name: 'R34 GT-R', price: 22000, rating: 88, emoji: '🏎️', desc: 'Godzilla. AWD launch monster.' },
  { name: 'GT3 RS', price: 40000, rating: 90, emoji: '🏎️', desc: 'Naturally-aspirated track weapon.' },
  { name: 'Formula 1', price: 100000, rating: 96, emoji: '🏁', desc: 'The pinnacle. If you can afford it.' },
];
const findCar = (name) => CAR_CATALOG.find((c) => c.name.toLowerCase() === String(name || '').toLowerCase().trim());
const carRating = (name) => findCar(name)?.rating ?? 80;
// balance() returns { wallet, bank, total } — the spendable number is .wallet.
const w = (id) => balance(id).wallet;

export function getGarage(userId) {
  return q.get.get(userId) || { user_id: userId, car: 'Mazda MX-5 Cup', livery: 'Red Bull Racing', wins: 0, losses: 0, races: 0, best_lap: null };
}
// Persist the car/livery the Lua `player` ended a command with.
export function savePlayer(userId, car, livery) {
  q.upsert.run({ user_id: userId, car: car || 'Mazda MX-5 Cup', livery: livery || 'Red Bull Racing', t: Date.now() });
}

// ---- ownership ----
// Everyone owns the free starter — seed it lazily on first touch.
export function ensureStarter(userId) { own.add.run(userId, 'Mazda MX-5 Cup'); }
export function ownsCar(userId, carName) {
  const c = findCar(carName);
  if (!c) return false;             // not a catalog car → can't swap to it
  if (c.price === 0) return true;   // free starter is always yours
  ensureStarter(userId);
  return !!own.has.get(userId, c.name);
}
export function ownedCarNames(userId) {
  ensureStarter(userId);
  return own.list.all(userId).map((r) => r.car);
}

// ---- !race @user [wager] -------------------------------------------------
export async function handleRaceCommand(message) {
  const raw = (message.content || '').trim();
  if (!/^!race\b/i.test(raw) || !message.guild) return false;
  const opp = message.mentions.users.first();
  if (!opp || opp.bot || opp.id === message.author.id) {
    await message.reply('🏁 Usage: `!race @driver [wager]` — challenge a real driver to a head-to-head.').catch(() => {});
    return true;
  }
  const wager = Math.max(0, Math.min(1_000_000, parseInt((raw.match(/(\d[\d,]*)/) || [])[1]?.replace(/,/g, '') || '100', 10) || 0));
  const me = message.author, aId = me.id, bId = opp.id;
  if (wager > 0 && w(aId) < wager) { await message.reply(`💸 You only have **${w(aId).toLocaleString()}** — can’t wager ${wager.toLocaleString()}.`).catch(() => {}); return true; }
  if (wager > 0 && w(bId) < wager) { await message.reply(`💸 <@${bId}> can’t cover a **${wager.toLocaleString()}** wager.`).catch(() => {}); return true; }

  const ga = getGarage(aId), gb = getGarage(bId);
  // Roll: car rating (mostly luck) + a big random spread + a tiny form bonus.
  const rollA = carRating(ga.car) * 0.4 + Math.random() * 100 + (ga.wins - ga.losses) * 0.3;
  const rollB = carRating(gb.car) * 0.4 + Math.random() * 100 + (gb.wins - gb.losses) * 0.3;
  const aWon = rollA >= rollB;
  const winId = aWon ? aId : bId, loseId = aWon ? bId : aId;
  const winUser = aWon ? me : opp, loseUser = aWon ? opp : me;
  const margin = Math.abs(rollA - rollB);
  const gap = (margin / 12).toFixed(3);
  const now = Date.now();
  const bestW = 78 + Math.random() * 8;

  if (wager > 0) { addWallet(winId, wager, 'race-win'); addWallet(loseId, -wager, 'race-loss'); }
  recordWin(winId); recordLoss(loseId);
  q.result.run({ user_id: winId, w: 1, l: 0, best: bestW, t: now });
  q.result.run({ user_id: loseId, w: 0, l: 1, best: bestW + Number(gap), t: now });

  const flavor = margin < 6 ? 'a PHOTO FINISH 📸' : margin < 25 ? `by ${gap}s` : `by a commanding ${gap}s`;
  const e = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('🏁 Head-to-Head Race — Results')
    .setDescription(
      `**${winUser.username}** takes the win ${flavor}!\n\n` +
      `🥇 <@${winId}> — ${getGarage(winId).car}\n` +
      `🥈 <@${loseId}> — ${getGarage(loseId).car}` +
      (wager > 0 ? `\n\n💰 **${winUser.username}** wins the **${wager.toLocaleString()}** credit pot.\n` +
        `Balance — ${winUser.username}: **${w(winId).toLocaleString()}** · ${loseUser.username}: **${w(loseId).toLocaleString()}**` : '\n\n_Friendly race — no wager._'))
    .setFooter({ text: 'Change your ride with !swapcar, then !race again.' });
  await message.reply({ embeds: [e], allowedMentions: { parse: [] } }).catch(() => {});
  return true;
}

// ---- !garage [@user] -----------------------------------------------------
export async function handleGarageCommand(message) {
  const raw = (message.content || '').trim();
  if (!/^!garage\b/i.test(raw) || !message.guild) return false;
  const target = message.mentions.users.first() || message.author;
  const g = getGarage(target.id);
  const winRate = g.races ? Math.round((g.wins / g.races) * 100) : 0;
  const e = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({ name: `${target.username}'s Garage`, iconURL: target.displayAvatarURL() })
    .addFields(
      { name: '🏎️ Current Car', value: g.car, inline: true },
      { name: '🎨 Livery', value: g.livery, inline: true },
      { name: '💰 Credits', value: w(target.id).toLocaleString(), inline: true },
      { name: '🏆 Record', value: `${g.wins}W – ${g.losses}L (${winRate}%)`, inline: true },
      { name: '🏁 Races', value: String(g.races), inline: true },
      { name: '🟣 Best Lap', value: g.best_lap ? `${g.best_lap.toFixed(3)}s` : '—', inline: true },
    );
  await message.reply({ embeds: [e], allowedMentions: { parse: [] } }).catch(() => {});
  return true;
}

// ---- !dealership  ·  !buycar <name> --------------------------------------
export async function handleDealershipCommand(message) {
  const raw = (message.content || '').trim();
  if (!message.guild) return false;
  const uid = message.author.id;

  if (/^!buycar\b/i.test(raw)) {
    const name = raw.replace(/^!buycar\b/i, '').trim();
    const car = findCar(name);
    if (!car) { await message.reply(`❓ No car called **${name || '(none given)'}**. Browse \`!dealership\`.`).catch(() => {}); return true; }
    if (ownsCar(uid, car.name)) { await message.reply(`✅ You already own the **${car.name}** — \`!swapcar ${car.name}\` to drive it.`).catch(() => {}); return true; }
    if (w(uid) < car.price) { await message.reply(`💸 The **${car.name}** costs **${car.price.toLocaleString()}**, you’ve got **${w(uid).toLocaleString()}**. Go win some races! 🏁`).catch(() => {}); return true; }
    addWallet(uid, -car.price, 'car-purchase');
    own.add.run(uid, car.name);
    await message.reply(`🔑 **Purchased the ${car.emoji} ${car.name}!** (−${car.price.toLocaleString()} credits · ⚡ rating ${car.rating})\nDrive it with \`!swapcar ${car.name}\`.`).catch(() => {});
    return true;
  }

  if (!/^!(dealership|dealer|carshop)\b/i.test(raw)) return false;
  ensureStarter(uid);
  const ownedSet = new Set(ownedCarNames(uid));
  const bal = w(uid);
  const lines = CAR_CATALOG.map((c) => {
    const owned = ownedSet.has(c.name) || c.price === 0;
    const tag = owned ? '✅ **Owned**' : (bal >= c.price ? `💰 ${c.price.toLocaleString()}` : `🔒 ${c.price.toLocaleString()}`);
    return `${c.emoji} **${c.name}** — ${tag}\n⚡ Rating ${c.rating} · _${c.desc}_`;
  });
  const e = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('🏪 Sentinel Motorsports — Dealership')
    .setDescription(lines.join('\n\n'))
    .setFooter({ text: `Your balance: ${bal.toLocaleString()} credits · buy with  !buycar <name>` });
  await message.reply({ embeds: [e], allowedMentions: { parse: [] } }).catch(() => {});
  return true;
}
