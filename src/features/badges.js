// Achievement badges — members unlock these by hitting milestones (levels, wealth,
// heist/lottery/wheel wins). Stored once each in SQLite; awarding is idempotent, so
// hooks can call it freely on every level-up or win without creating duplicates.
import { getDb } from '../db/index.js';

const db = getDb();
db.exec(`CREATE TABLE IF NOT EXISTS user_badges (
  guild_id TEXT NOT NULL, user_id TEXT NOT NULL, badge TEXT NOT NULL, earned_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id, badge)
)`);

export const BADGES = {
  level5:   { emoji: '🌱', name: 'Getting Started', desc: 'Reached level 5' },
  level10:  { emoji: '⭐', name: 'Regular',         desc: 'Reached level 10' },
  level25:  { emoji: '🌟', name: 'Veteran',         desc: 'Reached level 25' },
  level50:  { emoji: '💫', name: 'Legend',          desc: 'Reached level 50' },
  rich10k:  { emoji: '💵', name: 'Getting Paid',    desc: 'Held 10,000 coins' },
  rich100k: { emoji: '💰', name: 'Big Money',       desc: 'Held 100,000 coins' },
  rich1m:   { emoji: '🤑', name: 'Millionaire',     desc: 'Held 1,000,000 coins' },
  heistWin: { emoji: '🔫', name: 'Master Thief',    desc: 'Pulled off a heist' },
  lottoWin: { emoji: '🎟️', name: 'Lucky Ticket',    desc: 'Won the server lottery' },
  jackpot:  { emoji: '🎰', name: 'Jackpot!',        desc: 'Hit a wheel jackpot' },
};

const q = {
  add:  db.prepare('INSERT OR IGNORE INTO user_badges(guild_id,user_id,badge,earned_at) VALUES (?,?,?,?)'),
  has:  db.prepare('SELECT 1 FROM user_badges WHERE guild_id=? AND user_id=? AND badge=?'),
  list: db.prepare('SELECT badge, earned_at FROM user_badges WHERE guild_id=? AND user_id=? ORDER BY earned_at'),
};

// Award one badge. Returns the badge object if NEWLY earned, else null.
export function awardBadge(guildId, userId, key) {
  if (!BADGES[key] || !guildId || !userId) return null;
  if (q.has.get(String(guildId), String(userId), key)) return null;
  q.add.run(String(guildId), String(userId), key, Date.now());
  return { key, ...BADGES[key] };
}

export function getBadges(guildId, userId) {
  return q.list.all(String(guildId), String(userId))
    .map((r) => ({ key: r.badge, ...BADGES[r.badge], earnedAt: r.earned_at }))
    .filter((b) => b.name);
}

// Milestone checkers — each returns an array of newly-earned badge objects.
export function checkLevelBadges(guildId, userId, level) {
  const out = [];
  for (const [lv, key] of [[5, 'level5'], [10, 'level10'], [25, 'level25'], [50, 'level50']]) {
    if (level >= lv) { const b = awardBadge(guildId, userId, key); if (b) out.push(b); }
  }
  return out;
}
export function checkWealthBadges(guildId, userId, total) {
  const out = [];
  for (const [amt, key] of [[10000, 'rich10k'], [100000, 'rich100k'], [1000000, 'rich1m']]) {
    if (total >= amt) { const b = awardBadge(guildId, userId, key); if (b) out.push(b); }
  }
  return out;
}

// Pretty one-liner for announcing freshly-unlocked badges.
export function unlockLine(badges) {
  if (!badges || !badges.length) return '';
  return '\n🏅 **Achievement unlocked:** ' + badges.map((b) => `${b.emoji} ${b.name}`).join(', ');
}
