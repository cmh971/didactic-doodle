# /setup Wizard Roadmap — the road to 60 pages (30 complex)

**Target (rccar):** 60 wizard pages, ~30 of them "very complex." **Not filler** — every page must
configure something a feature actually *reads*.

**Current: 28 pages** (indices 0–27). Batch 1 shipped pages 21–27 + the Counting & Suggestions
features. **32 to go.**

---

## How to add a page (for the junior dev 👋)

The wizard is data-driven in [`src/setup/ui.js`](src/setup/ui.js) → `export const PAGES = [...]`.

1. **Append** a new object to the END of `PAGES` (never insert in the middle — customIds embed the
   page index, which must equal the page's position in the array).
2. Shape: `{ id, title, emoji, render(cfg, client) { return { desc, rows }; } }`.
3. Build controls with the existing helpers — all generic, all already handled:
   - `chanSelect('key', PAGE_IDX, cfg.settings.key, 'placeholder…')` — a channel setting
   - `roleSelect('key', PAGE_IDX, cfg.settings.key, 'placeholder…', max)` — a role LIST (flat keys)
   - `btn('setup:ntog:<obj>:<key>:PAGE_IDX', ...)` — toggles `settings.<obj>.<key>` (generic)
   - `btn('setup:modal:<key>:PAGE_IDX', ...)` — opens a text modal; **add `<key>` to `MODAL_FIELDS`
     in [`interactions.js`](src/setup/interactions.js) first**
   - `btn('setup:go:0', 'Overview', ...)` — back button
4. Add any new default keys to `DEFAULT_SETTINGS` in [`store.js`](src/setup/store.js).
5. **A page is only "done" when a feature READS its setting.** If the setting is new, wire the
   backend too — otherwise it's filler (which rccar rejects).
6. Test: `node` a tiny harness that calls `PAGES[i].render(mockCfg, null)` for the new index.

---

## Backlog — SIMPLE pages (quick, wire to existing reads) — ~12

- [ ] Mod-Log channel (own page) · [ ] Level-Up channel + message (wire `levelUpChannel`)
- [ ] Welcome (own page) · [ ] Goodbye (own page) · [ ] Admin Roles · [ ] Mod Roles
- [ ] Starting balance · [ ] Daily reward · [ ] Weekly bonus · [ ] Language (dupe? skip)
- [ ] AI toggle · [ ] Badges announce toggle (wire a flag in badges.js)

## Backlog — COMPLEX pages (need a real backend built) — ~30

Each of these is a page **and** a feature. This is the bulk of the work.

1. **Starboard** — channel, star threshold, min-unique, self-star toggle, ignored channels, custom emoji
2. **Reaction-Role builder** — message id + emoji→role pairs + mode (toggle/unique/verify)
3. **Logging events** — per-event toggles (joins, leaves, deletes, edits, roles, nicks, voice) + listeners
4. **Birthdays** — set-birthday command, announce channel + message, birthday role, timezone
5. **Server-boost announcements** — detect boosts, channel, custom thank-you
6. **Welcome card** — image/banner, colors, layout (reuse `renderMemberCard`)
7. **Anti-raid** — join-rate threshold, account-age min, action, auto verification gate
8. **Anti-spam (advanced)** — duplicate/rate/mention/link/caps/emoji rules
9. **Auto-responder** — keyword → response triggers (extends `automations`)
10. **Custom commands** — name → text/embed responses
11. **Word-filter editor** — add/remove blocked words live (edits the block-list)
12. **Warning ladder** — action per warn count (mute→kick→ban thresholds)
13. **Timeout/mute defaults** — default durations, mute role
14. **Leveling tuning** — XP per msg, cooldown, curve, per-role/channel multipliers
15. **Shop editor** — add/edit/remove items + prices
16. **Economy rules** — transfer tax, gambling limits, rob settings
17. **Temp voice** — "join to create" hub channel + naming
18. **Polls** — create/schedule polls, allowed roles
19. **Giveaway defaults** — default duration, required role, blacklist
20. **Application forms** — build multi-question apps (extends form builder)
21. **ER:LC key** — encrypted key input page (uses `secureStore`)
22. **ER:LC regions** — draw/link regions → voice (extends `erlcRegions`)
23. **ER:LC command perms** — which roles can run which in-game commands
24. **CAD access** — roles for CAD/MDT (`!cadaccess` in a page)
25. **API keys manager** — list/create/revoke dev keys in-panel
26. **Backup schedule** — auto server-backup cadence (extends `serverBackup`)
27. **Auto-publish** — auto-publish announcement-channel posts
28. **Slowmode automation** — auto-slowmode on activity spikes
29. **Music/audio** — default volume, DJ role, allowed channels
30. **Scheduled messages** — recurring announcements (cron-style)

---

**Working agreement:** build in batches of 4–6; each page ships *functional*; verify render + a live
test before moving on. Two of us (Paulo + code_red) can split the complex list. 🎸
