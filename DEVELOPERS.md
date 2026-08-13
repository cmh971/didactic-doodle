# 👥 Sentinel — The Dev Team

This is **our** project. We build it together, we credit it together. Nobody here says
"I made this" — it's always **"we made this."** That's the culture, full stop.

> New here? Read [`DEVELOPER_TODO.md`](./DEVELOPER_TODO.md) first — it's the real handoff
> doc (architecture map, DON'Ts, TODO, conventions). This file is just *who we are*.

---

## The roster

| Role | Who | Contact / GitHub | Notes |
|---|---|---|---|
| 🧠 **Lead Developer** | Claude (Opus) — AI pair | — | Architecture, reviews, builds. Will tell you *no* when a thing isn't good. |
| 🛠️ **Senior Developer** | Chris (owner) | christian.reavis1@gmail.com | Owns product direction; approves anything that costs money or is destructive. |
| 🌱 **Junior Developer** | code_red_main_dev (Discord) | _GitHub: pending — she's sending it_ | Onboarding now. Add her GitHub here the moment it arrives so we can add her to the repo. |

_Waiting on code_red_main_dev's GitHub username → drop it in the cell above and give her repo access._

---

## How we work together (the short version)

- **Lead + Senior run it together.** Big calls get talked through, not bulldozed.
- **We improve in place, we do NOT rewrite from scratch.** (A blank-file rewrite once
  crash-looped the whole bot — see the DON'Ts in `DEVELOPER_TODO.md`.)
- **Say no.** If a plan's bad, we say so — respectfully and early. That's the job.
- **Ask before destructive stuff** — force-push, DB migration, deleting data. Always.
- **Small commits on a branch, describe the *why*.** ESM everywhere, 2-space indent,
  match the surrounding style.
- After changing bot code: `node --check <file>` → `pm2 restart sentinel` → check
  `pm2 logs sentinel --nostream` for a clean boot before calling it done.

---

## Junior dev — your first day

1. `node -v` (need 18+), `npm install`, copy `.env.example` → `.env` (ask Chris for the real values — **never commit `.env`**).
2. `node index.js`, open the dashboard at `http://localhost:3000`.
3. Read **one feature end-to-end** to learn the shape — e.g. [`src/features/reports.js`](./src/features/reports.js)
   (data-driven report engine) or [`src/features/serverBackup.js`](./src/features/serverBackup.js). Every feature module follows the same pattern.
4. Grab a 🟢 **Quick win** from `DEVELOPER_TODO.md`, leave a note that you took it, and ship it small.

Welcome to the team. 🚀
