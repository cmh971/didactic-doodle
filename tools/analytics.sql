-- SQL — analytics queries against the bot's schema (SQLite or PostgreSQL).
-- Run: sqlite3 data/bot.db ".read tools/analytics.sql"

-- Top 10 richest players (global currency)
SELECT user_id, wallet + bank AS total
FROM balances
WHERE scope = 'global'
ORDER BY total DESC
LIMIT 10;

-- Economy activity by transaction type
SELECT type, COUNT(*) AS count, SUM(amount) AS net
FROM transactions
GROUP BY type
ORDER BY count DESC;

-- Communities pending approval
SELECT guild_id, community_name, custom_id
FROM community_config
WHERE is_approved = 0
ORDER BY created_at DESC;

-- Most active moderators (by punishments logged)
SELECT moderator_id, COUNT(*) AS actions
FROM punishments
GROUP BY moderator_id
ORDER BY actions DESC
LIMIT 10;

-- XP leaderboard for a guild (replace :guild)
-- SELECT user_id, level, xp FROM levels WHERE guild_id = :guild ORDER BY level DESC, xp DESC LIMIT 10;
