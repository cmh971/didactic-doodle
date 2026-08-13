# Ducky → Sentinel — feature/page gaps

Comparison of Ducky v1's setup pages + modules vs. what Sentinel already has.
(Ducky is Lua/Discordia; features get **rebuilt in JS**, not copied.)

## ❌ Missing — worth building (real gaps)
| Ducky page/feature | What it does | Notes |
|---|---|---|
| **Autoresponders** | keyword/trigger → automatic reply | Setup page + engine. Sentinel's automations are event-based, not simple keyword responders. |
| **Anti-Ping** ("Discord Pings") | protect high-ranking staff from being pinged (warn/delete/timeout) | Setup page + message hook. |
| **Shift Management** | staff clock in/out, shift logs, leaderboards | Setup page + `!shift` + storage. |
| **Departments** | staff department structure (roles, leads, rosters) | Setup page + data model. |
| **Server Statistics** | live stat voice channels (member count, online, etc.) | Auto-updating channel names. |
| **Message Management** | bulk/scheduled messages, embed sender, sticky messages | Sentinel has an embed builder; Ducky bundles more. |

## ✅ Already have (parity or better)
Audit Logging (Logging) · Discord Moderation (Moderation/Automod) · Server Economy · Sessions ·
Roblox Verification · ER:LC Integration/Regions · Suggestions · Tickets · Welcome/Autoroles ·
Reaction Boards (Starboard) · Giveaways · Staff Management (staff.js) · Roblox Punishments (erlc)

## 🟡 Have the feature, may lack a dedicated setup PAGE
Sessions · Giveaways · ER:LC Server Status · ER:LC Server Logs · Staff Management · Activity Management (LOA)

## Done this session
- ✅ **AFK** (`!afk`) — Ducky had it, we didn't. Built + deployed.
- ✅ **Autoresponders** — keyword → auto-reply, dashboard at /autoresponders, uses template vars.
- ✅ **Anti-Ping** — protect staff from pings, dashboard at /antiping.

## YAGPDB (botlabs-gg) gaps — features it has that Sentinel doesn't
(Go bot, ref-only clone in `yagpdb-reference/`. Rebuild in JS.)
| YAGPDB feature | What it is |
|---|---|
| **Feeds** (YouTube / Twitch / Reddit / RSS / Twitter) | Auto-post when a creator uploads / goes live / posts |
| **Custom Commands** | User-created commands (ties into the Lua custom-commands idea) |
| **Reputation** | `+rep` points system |
| **Voice Roles** | auto-assign a role while in voice |
| **Streaming role** | role while a member is live-streaming |
| **Anti-Phishing / SafeBrowsing** | detect + block scam/phishing links |
| **Timezone companion** | per-user timezones + conversion |
| **RSVP / events** | event sign-ups |
| **CAH** | Cards Against Humanity game |
| _(have already: automod, moderation, tickets, verification, reminders, trivia, autorole, reaction roles, logs, serverstats)_ | |

## Suggested build order (highest value first)
1. **Autoresponders** (very common, high demand)
2. **Anti-Ping** (staff QoL, quick)
3. **Shift Management** (staff ops)
4. **Departments** (staff structure)
5. **Server Statistics** channels
