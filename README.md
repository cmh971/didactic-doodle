<div align="center">

```
 ____             _   _            _
/ ___|  ___ _ __ | |_(_)_ __   ___| |
\___ \ / _ \ '_ \| __| | '_ \ / _ \ |
 ___) |  __/ | | | |_| | | | |  __/ |
|____/ \___|_| |_|\__|_|_| |_|\___|_|
```

# 🛡️ Sentinel

**The all-in-one Discord bot — with a jaw-dropping web control center.**

*Economy · Moderation · Tickets · Leveling · Games · AI · and a 15-page dashboard.*

</div>

---

## ✨ What it does

- **🎫 Tickets** — a full "creative studio": button/menu panels, DM modmail, claim/close/transcript, auto-close.
- **🪙 Economy** — wallets, bank, shop, gambling, daily rewards, leaderboards, and an AI shopkeeper.
- **🛡️ Moderation** — bans, kicks, timeouts, warnings, an infraction ladder, and automod (spam, invites, bad words).
- **📈 Leveling** — message XP, level-up announcements, auto-roles.
- **🧠 AI chat** — mention the bot for a Gemini-powered reply (with a strict moderation layer, only used when needed).
- **🌤️ Weather** — `/weather <city>` via OpenWeather.
- **🚓 ER:LC** — Emergency Response: Liberty County integration, with **dual-encrypted** server keys.
- **🃏 UNO** — a full CPU-rendered UNO game with a private AI coach.
- **🖥️ Web dashboard** — manage everything from a browser: modules, tickets, giveaways, reaction roles, announcements (120 templates!), live analytics, command tracking, presence, and an owner control center.
- **🔐 OAuth** — sign in with Discord **and** Google.

## 🧰 Tech stack

- **Bot & web:** Node.js, [discord.js](https://discord.js.org), Express, SQLite (`node:sqlite`), `@napi-rs/canvas`
- **Helper tools:** Python (`tools/monitor.py` — health monitor) and C++ (`tools/normalize.cpp` — word-list normalizer)

## 🚀 Getting started

```bash
git clone https://github.com/cmh971/didactic-doodle.git
cd didactic-doodle
npm install
cp .env.example .env      # then fill in your keys (Windows: copy .env.example .env)
node index.js
```

The bot logs in and the dashboard starts on **http://localhost:3000**.

### Key `.env` values
| Key | For |
|---|---|
| `DISCORD_TOKEN` | Bot token (**required**) |
| `CLIENT_ID` | Application ID (**required**) |
| `GEMINI_API_KEY` | AI chat (optional) |
| `OAUTH_CLIENT_SECRET` + `GOOGLE_*` | Dashboard login (optional) |
| `OPENWEATHER_API_KEY` | `/weather` (optional) |

See [`.env.example`](.env.example) for the full list. **Never commit your real `.env`.**

### Developer Portal toggles
- ✅ **Message Content Intent** · ✅ **Server Members Intent**
- Invite scopes: `bot` + `applications.commands`

## 🛠️ Helper tools

```bash
# Monitor a running bot's health (servers, users, ping, uptime)
python tools/monitor.py --url http://localhost:3000 --interval 30

# Normalize / de-dupe a word list (mirrors the bot's bad-word filter)
g++ -O2 -std=c++17 -o normalize tools/normalize.cpp
./normalize words.txt > cleaned.txt
```

## 📁 Project layout

```
index.js            loads env, all commands, events, login, web
src/commands/       one file per slash command (auto-loaded, hub-packed)
src/features/       tickets, giveaways, reaction roles, weather, erlc, …
src/systems/        automod, leveling, analytics, usage, secureStore, …
src/web/            Express server + the dashboard SPA (public/)
src/render/         CPU image rendering (cards, banners, member cards)
src/ai/gemini.js    Gemini client + bad-word intelligence
tools/              Python + C++ helper utilities
```

## 📜 License

Personal project — not affiliated with Discord Inc., Google LLC, or PRC.

<div align="center">

*Built with 🖤 (and a lot of "DID I DO IT???").*

</div>
