# 👋 Developer Handoff & TODO — "Sentinel" Discord Bot

Welcome! This is a **large, working, production** Discord bot (discord.js v14, Node ESM)
plus a web dashboard. It runs live and has real users. **Please read this whole file
before touching anything** — a few things here will save you (and us) a bad day.

> Golden rule: **this is a working product. We improve it incrementally. We do NOT!!!!!!!
> rewrite it from scratch.** (A rewrite throws away every tested fix and takes
> 3× longer than anyone thinks. If something's messy, we refactor that piece.)

---

## 🚀 Quick start (run it locally)
1. `node -v` → needs **Node 18+** (currently on v24).
2. `npm install`
3. Copy `.env.example` → `.env` and fill in `DISCORD_TOKEN`, `GEMINI_API_KEY`, OAuth
   creds, etc. **The `.env` is git-ignored — never commit it.**
4. Start: `node index.js`  (production runs under PM2 as app **`sentinel`**;
   restart with `pm2 restart sentinel`).
5. Dashboard: `http://localhost:3000`.

-----------------------------------------------------------------------------------------------------------------------------------------

## 🗺️ Architecture map (where things live)
| Path | What it is |
|---|---|
| `index.js` | Entry point: client, event wiring, interaction router |
| `src/events/messageCreate.js` | Prefix-command pipeline (`!`, `?`, etc.) — order matters |
| `src/commands/**` | Slash commands (100 top-level registered — **that's Discord's hard cap**) |
| `src/prefix/commands.js` | The `?` command pack (172 self-contained utility cmds) |
| `src/features/**` | Feature modules (tickets, search, ash AI, forms, regions, backup, dev API…) |
| `src/systems/**` | Core systems (automod, leveling, ratelimit, antiraid, secureStore) |
| `src/web/server.js` | Express dashboard + all HTTP routes + the Developer API |
| `src/web/public/**` | Dashboard front-end, widgets, login, docs pages |
| `src/setup/**` | The `/setup` config UI (pages + interaction handlers) — **complex, tread carefully** |
| `src/ai/**` | Gemini integration (`gemini.js`) + Ash assistant (`ash.js`) |

---

## ⛔ DON'Ts (learned the hard way)
- **Don't wipe/stub a file that others import.** Blanking `src/features/erlc.js` once
  crash-looped the whole bot (everything importing it failed on boot). Edit in place.
- **Don't commit `.env`, `data/`, or the side-project folders** (`xplane12-addon/`, `1234/`) —
  they're git-ignored on purpose.
- **Don't add slash commands past 100 top-level** — use the `?`/`!` prefix packs or a hub subcommand.
- **Don't post secrets (API keys, tokens) in a channel** — everything sensitive goes through
  DMs/modals + `src/systems/secureStore.js` (AES-256-GCM). Keep it that way.

---

## ✅ TODO — prioritized (pick any; leave a note when you take one)

### 🟢 Quick wins
- [ ] Add a **top-level `README.md`** (run steps, feature list, architecture — crib from this file).
- [ ] Add **basic tests** (Vitest/Node test) for the pure functions first:
      `src/features/pathfind.js` (astar), `src/systems/ratelimit.js`, `src/prefix/commands.js` runs,
      `src/features/erlcRegions.js` (pointInPolygon).
- [ ] Add a **health-check endpoint** (`GET /healthz`) for uptime monitoring.

### 🟡 Medium
- [ ] Set up **CI** (GitHub Actions): `npm ci` + lint + `node --check` on all `src/**` + tests.
- [ ] Add a real **linter config** (eslint) and fix warnings incrementally.
- [ ] **Split the big files** for navigability (no behavior change):
      `src/web/public/app.js` (~2,300 lines) into view modules;
      `src/web/server.js` (~1,450 lines) into route files.
- [ ] Standardize the **prefix handlers** in `messageCreate.js` into a registry/loop.

### 🟠 Larger (design first, then do)
- [ ] Move state that's currently in-memory (rate-limit buckets, sessions) toward the DB/Redis
      so a restart doesn't lose it.
- [ ] Formal **WCAG AA audit** of each dashboard page (baseline + `a11y.js` toggle already exist).

---

## 💳 Needs the owner (Chris) to approve/pay
Put anything that costs money here and ping Chris — don't spend without a yes.
- [ ] **VPS host** (~$5–10/mo, e.g. Hetzner/DigitalOcean) → 24/7 uptime, off Chris's PC. **Top priority.**
- [ ] **Domain** (~$12/yr) → real HTTPS URL for dashboard/OAuth/embeds/dev API.
- [ ] *(Only if we hit Gemini free limits)* Gemini paid tier — not needed yet (the AI prefilter keeps usage low).
- [ ] _add items here → tell Chris the cost → wait for approval_

---

## 🧭 Conventions
- ESM everywhere (`import`/`export`), 2-space indent, match the surrounding style.
- Commit on a branch, small commits, describe the *why*.
- After changing bot code: `node --check <file>` then `pm2 restart sentinel` and check
  `pm2 logs sentinel --nostream` for a clean boot before calling it done.
- Ask before anything destructive (force-push, DB migration, deleting data).

_Questions? The architecture is bigger than it looks but every feature module is self-contained.
Start by reading one feature end-to-end (e.g. `src/features/serverBackup.js`) — they follow the same shape._
