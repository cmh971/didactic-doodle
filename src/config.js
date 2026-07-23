// Central config for the economy + moderation items.
// Numbers are intentionally HUGE — this is a "so much money" server. 🪙

// ---- Optional DB mirror (SQLite stays primary) ----
// Set either/both in .env to ALSO copy balances + infractions there.
//   MONGO_URI=mongodb+srv://user:pass@cluster/…   (needs: npm i mongodb)
//   DATABASE_URL=postgres://user:pass@host:5432/db  (pg already installed)
export const MONGO_URI = process.env.MONGO_URI || '';
export const MONGO_DB = process.env.MONGO_DB || 'sentinel';
export const DATABASE_URL = process.env.DATABASE_URL || '';

// (Music search uses Apple's free, keyless iTunes Search API — no config needed.
//  Spotify was dropped after its Feb 2026 Developer-Mode Premium requirement.)

export const TOKEN = '🪙';
export const TOKEN_NAME = 'UNO Tokens';

// Starting balance for brand-new players.
export const STARTING_BALANCE = 100_000;

// UNO game payouts.
export const WIN_REWARD = 50_000; // winner gains this
export const LOSS_PENALTY = 10_000; // each loser drops this (never below 0)

// Earning commands (so. much. money.)
export const DAILY_REWARD = 250_000;
export const WEEKLY_REWARD = 2_000_000;
export const WORK_MIN = 25_000;
export const WORK_MAX = 150_000;
export const BEG_MIN = 1_000;
export const BEG_MAX = 50_000;
export const CRIME_MIN = 100_000;
export const CRIME_MAX = 750_000;
export const CRIME_FAIL_CHANCE = 0.35;

// Cooldowns (ms)
export const COOLDOWNS = {
  daily: 20 * 60 * 60 * 1000, // 20h
  weekly: 7 * 24 * 60 * 60 * 1000,
  work: 30 * 60 * 1000,
  beg: 60 * 1000,
  crime: 60 * 60 * 1000,
  rob: 60 * 60 * 1000,
};

// ---- Timeout Hammer item config ----
// People with this role can NEVER be timed out by the hammer.
export const PROTECTED_ROLE_ID = process.env.PROTECTED_ROLE_ID || '1520771668166049892';
// If you try to hammer someone who outranks you, it backfires and you get the "Buck" role.
export const BUCK_ROLE_NAME = process.env.BUCK_ROLE_NAME || 'Buck';
export const BUCK_ROLE_COLOR = 0x8b4513;
// How long the Buck role / backfire timeout lasts (ms).
export const BUCK_DURATION = 10 * 60 * 1000; // 10 min
