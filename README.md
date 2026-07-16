# UNO Discord Bot 🎴

An UNO game bot with **everything rendered on your CPU** (via `@napi-rs/canvas` — no GPU, no build tools): a full table-scene image, card backs, hands, win banners, profile/balance cards, slot machines, dice, coins and more. Plus a private **AI coach** powered by **Google Gemini**, a full **UNO Token economy + shop**, and **59 slash commands**.

## 🪙 Economy & Shop

- Win an UNO game → earn **UNO Tokens**; lose → drop tokens. (`settleGame` pays out on every game end.)
- Earn with `/daily` `/weekly` `/work` `/beg` `/crime`, gamble with `/slots` `/coinflip` `/dice` `/blackjack` `/roulette` `/gamble` `/lottery`, manage with `/balance` `/deposit` `/withdraw` `/pay` `/rob` `/networth` `/leaderboard`.
- `/shop` `/buy` `/sell` `/use` `/inventory` `/iteminfo` — items include the **🔨 Timeout Hammer**, loot boxes, rob shields, and flex collectibles.
- **`/additem <idea>`** — the **AI shopkeeper** approves a new collectible, designs its name/price/description, and adds it to the shop live.

### 🔨 Timeout Hammer rules
- Use it to time out a member you outrank.
- If the target **outranks you**, it **backfires**: you get the **Buck** role + a timeout instead.
- Members with the **protected role** (`PROTECTED_ROLE_ID`, default `1520771668166049892`) can **never** be hammered.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Fill in `.env`**
   - `DISCORD_TOKEN` — Bot → Reset Token in the [Developer Portal](https://discord.com/developers/applications)
   - `CLIENT_ID` — General Information → Application ID
   - `GUILD_ID` — *(optional)* a server ID for instant command registration
   - `GEMINI_API_KEY` — from [Google AI Studio](https://aistudio.google.com/app/apikey)

3. **Enable the right toggles in the Developer Portal → Bot tab**
   - ✅ **Message Content Intent** (so the AI can read your DMs)
   - ✅ **Server Members Intent** (for `userinfo`, role/kick lookups)

4. **Invite the bot** with the `bot` and `applications.commands` scopes and these permissions:
   `Ban Members`, `Kick Members`, `Moderate Members`, `Manage Messages`, `Manage Channels`, `Manage Roles`.

5. **Run it**
   ```bash
   npm start
   ```

## How to play

- `/uno new` — opens a lobby. Others press **Join**, host presses **Start**.
- **Show Hand / Play** — privately (ephemeral) shows *your* hand image and a menu to play.
- **Draw / Pass**, **Call UNO!**, **Leave**, and **Talk to AI** buttons on the table.
- **Talk to AI** DMs you a Gemini coach that can see **only your hand** — never anyone else's.

## Commands

| Category | Commands |
|------|----------|
| **Game** | `/uno new` `/uno status` `/uno end` |
| **Economy** | `/balance` `/networth` `/leaderboard` `/daily` `/weekly` `/work` `/beg` `/crime` `/rob` `/pay` `/deposit` `/withdraw` |
| **Shop** | `/shop` `/buy` `/sell` `/use` `/inventory` `/iteminfo` `/additem` |
| **Gambling** | `/gamble` `/slots` `/coinflip` `/dice` `/blackjack` `/roulette` `/lottery` |
| **Fun** | `/8ball` `/rps` `/joke` `/fact` `/quote` `/meme` `/choose` `/mock` `/owoify` `/clap` `/emojify` `/reverse` `/colorpick` `/roll` |
| **Utility** | `/calc` `/base64` `/hash` `/password` `/botinfo` `/ping` `/userinfo` `/serverinfo` `/avatar` `/say` `/poll` |
| **Moderation** | `/ban` `/kick` `/timeout` `/unban` `/purge` `/slowmode` `/role` |

## Project layout

```
index.js               loads .env, all commands, events, login
src/commands/          one file per slash command (auto-loaded)
src/uno/               Deck, Game rules, GameManager
src/economy/           token store (JSON), shop, win/loss settlement
src/config.js          token amounts, Buck role, protected role id
src/render/renderer.js CPU card + full table-scene rendering
src/render/extras.js   CPU images: profile, shop, banners, slots, dice, coins…
src/ui.js              embeds, buttons, menus
src/interactions.js    button & menu handling
src/ai/gemini.js       Gemini client (AI sees only the sender's hand)
src/dmHandler.js       routes DMs to the AI
```
