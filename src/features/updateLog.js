// !update — the "secret" changelog viewer. A paginated embed with a drag-to-jump
// dropdown + Prev/Next/Home buttons covering everything shipped since the last
// WHATS-NEW.md (the web dashboard / tickets / weather / ER:LC keys update).
//
// Tone: brief bullets, ~20% hype — basic things get a little flair ("advanced
// engine"), but it stays honest. Anyone can open it; navigation updates in place.
import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const ACCENT = 0x5865f2;

// Each entry = one page. Keep lines short. Select menu supports up to 25 pages.
const PAGES = [
  {
    emoji: '🎉', title: 'The Update', tag: 'Start here',
    lines: [
      '**You’re looking at weeks of work in one place.** Everything below shipped *after* the last announcement.',
      '',
      '📖 **Drag the dropdown** to jump to any section, or use ◀ ▶ to flip pages.',
      '',
      'Highlights: a full **CAD/dispatch suite**, an **AI with real tools**, a **memecoin analyzer**, **240+ `?` commands**, rate-limiting on everything, a developer API, form builder, bodycam, and a lot more. Let’s go. 🔥',
    ],
  },
  {
    emoji: '🚓', title: 'CAD — Dispatch', tag: 'Computer-aided dispatch',
    lines: [
      'A real **dispatcher console** on the dashboard.',
      '• Live map with player pins + emergency calls',
      '• Create / assign / close calls, set unit status',
      '• Pulls live ER:LC units & 911 calls',
      '• Locked to **PD/EMS/DOT** roles (`!cadaccess add @role`)',
    ],
  },
  {
    emoji: '🖥️', title: 'MDT — Records', tag: 'Mobile data terminal',
    lines: [
      'The officer’s lookup terminal.',
      '• Name & **plate** search (plate falls back to live ER:LC vehicles)',
      '• Civilian records, registered vehicles',
      '• Issue **warrants** & write **citations**',
      '• Penal-code + 10-code reference tabs',
    ],
  },
  {
    emoji: '👤', title: 'Civilian Portal', tag: 'Player-facing',
    lines: [
      'A self-serve portal for *players* (no staff role needed).',
      '• Register yourself as a civilian',
      '• Register vehicles & firearms to your name',
      '• See everything filed under your Discord',
    ],
  },
  {
    emoji: '📕', title: 'Penal & 10-Codes', tag: 'Reference engine',
    lines: [
      'Per-server legal reference, seeded with sensible defaults.',
      '• Editable **penal codes** (add/remove)',
      '• Editable **10-codes**',
      '• Quick lookup: `?tencode 10-99` → *Officer needs help*',
    ],
  },
  {
    emoji: '🗺️', title: 'Live Jurisdictions', tag: 'Map draw tool',
    lines: [
      'Draw **sector zones** right on the dispatch map.',
      '• Translucent colored polygons with labels',
      '• Add / delete zones from a list',
      '• Renders live over player positions',
    ],
  },
  {
    emoji: '🚨', title: 'Panic & Signal 100', tag: 'Officer safety',
    lines: [
      '• **Panic button** → instant `@here` alert to your log channel',
      '• **Signal 100** banner toggles radio-silence mode',
      '• Live on the dispatcher console',
    ],
  },
  {
    emoji: '🎥', title: 'Bodycam', tag: 'Advanced recorder',
    lines: [
      'Browser-based gameplay recorder.',
      '• Records just your **game window** (screen-capture engine)',
      '• Optional **crop box** — drag to record one region',
      '• One-click **Google Drive** auto-backup',
      '• Download the clip locally too',
    ],
  },
  {
    emoji: '🧭', title: 'ER:LC Regions', tag: 'Auto-mover engine',
    lines: [
      'Map regions that **move players between voice channels** by where they stand.',
      '• Draw polygons *or* use postal codes',
      '• Link each region to a VC',
      '• Fires automation triggers on enter/exit',
    ],
  },
  {
    emoji: '⚙️', title: 'Automations', tag: 'Trigger → action engine',
    lines: [
      'A no-code rules engine.',
      '• Triggers: region enter/exit, new 911 call, plate seen',
      '• Actions: message, role, **punish** (timeout/kick/ban)',
      '• Variables like `{player}`, `{region}`, `{emergency.desc}`',
      '• Up to 25 rules per server',
    ],
  },
  {
    emoji: '🤖', title: 'Ash AI', tag: 'AI with real tools',
    lines: [
      'The assistant grew **hands**.',
      '• Tools: web **search**, build an **embed**, build a **form**',
      '• **Vision** — reads posted images',
      '• Remembers context; reacts to your reactions',
      '• Huge pre-filter so it sips the free token budget',
    ],
  },
  {
    emoji: '🛡️', title: 'Rate Limiting', tag: 'On everything',
    lines: [
      'Anti-abuse guarding **every** action.',
      '• 2 warnings → timeout → **lockout** (last resort)',
      '• Locks persist across restarts',
      '• Only guards writes — never slows normal reads',
    ],
  },
  {
    emoji: '🔌', title: 'Developer API', tag: 'GET / POST',
    lines: [
      'Build on top of Sentinel.',
      '• Issue API keys (`!apikey`)',
      '• GET/POST endpoints for your data',
      '• Keys stored encrypted, never shown twice',
    ],
  },
  {
    emoji: '📊', title: 'Embed Widgets', tag: 'Embed-by-URL',
    lines: [
      '• Live **leaderboard** you can embed anywhere by URL',
      '• Visual embed builder on the dashboard',
      '• `!embed` to post rich embeds fast',
    ],
  },
  {
    emoji: '📝', title: 'Form Builder', tag: 'Google Forms bridge',
    lines: [
      'Design a form, then export it.',
      '• Builder UI + `!form`',
      '• Landing page detects who came from Discord and **prefills their ID**',
      '• Hands off to Google Forms',
    ],
  },
  {
    emoji: '♿', title: 'Accessibility', tag: 'ADA-minded',
    lines: [
      'Dashboard-wide a11y toggle.',
      '• Keyboard nav, focus states, reduced motion',
      '• Screen-reader labels',
      '• Off by default so normal users aren’t affected',
    ],
  },
  {
    emoji: '🪙', title: 'Memecoin Analyzer', tag: 'Brand new',
    lines: [
      'Alerts when a fresh coin clears **your** filters (DexScreener feed).',
      '• Filters: liquidity, 24h volume, age, momentum',
      '• Deduped so a coin never pings twice',
      '• `!coinwatch here` → `!coinwatch on`',
      '⚠️ *High risk — finds activity, not guaranteed wins.*',
    ],
  },
  {
    emoji: '🧰', title: 'The `?` Pack', tag: '240+ commands',
    lines: [
      'A giant utility library that doesn’t touch the slash-command cap.',
      '• Text, math, unit converters, encoders, hashes',
      '• Generators (password, uuid, plate, callsign…)',
      '• Games & fun, dev tools (json, luhn, rgb/hex)',
      '• Try `?calc`, `?nthprime`, `?tencode`, `?luhn`',
    ],
  },
  {
    emoji: '🔧', title: 'The `!` Power Tools', tag: 'Heavy features',
    lines: [
      '• `!path` — **A\\* pathfinding engine** on an image',
      '• `!search` — Google/DDG/web lookups',
      '• `!3d` / `!nav` — model & navigation helpers',
      '• `!source`, `!putfile`, `!backup`, `!loa`',
    ],
  },
  {
    emoji: '🚫', title: 'Defense & Backups', tag: 'Server safety',
    lines: [
      '• **Anti-raid** engine (join-spam lockdown)',
      '• Full **server backup & restore**',
      '• File scanner blocks disguised dangerous uploads',
      '• 4,000-word filter with evasion variants',
    ],
  },
  {
    emoji: '😀', title: 'Emojis · Verify · Staff', tag: 'Community',
    lines: [
      '• **100+ emoji pack** — static, animated GIF, WebP + search',
      '• Roblox **/verify** (DM code → website → role swap)',
      '• Staff manager + per-category ticket ping roles',
    ],
  },
  {
    emoji: '🌐', title: 'The Website', tag: 'Full dashboard',
    lines: [
      'Log in with **Discord or Google**. Pages now include:',
      '• Dashboard, CAD hub, Dispatch, MDT, Portal',
      '• Bodycam, ER:LC Regions, Embed builder, Developers',
      '• **PWA** — installable, offline shell, app icons',
      '• Diagnostics page + draggable nav',
    ],
  },
  {
    emoji: '🔮', title: 'That’s the Update', tag: 'Fin',
    lines: [
      'And that’s **everything** since the last announcement. 🎉',
      '',
      'One bot now runs: moderation, economy, tickets, leveling, a CAD suite, an AI, a memecoin radar, 240+ utility commands, a dev API, and a full web app.',
      '',
      'More coming. Thanks for rolling with it. 🔥',
    ],
  },
];

const N = PAGES.length;

function buildPage(i) {
  const idx = Math.max(0, Math.min(N - 1, i | 0));
  const p = PAGES[idx];
  const embed = new EmbedBuilder()
    .setColor(ACCENT)
    .setAuthor({ name: 'Sentinel — What’s New' })
    .setTitle(`${p.emoji} ${p.title}`)
    .setDescription(p.lines.join('\n'))
    .setFooter({ text: `Page ${idx + 1} of ${N} • drag the menu to jump around` });

  const menu = new StringSelectMenuBuilder()
    .setCustomId('upd:sel')
    .setPlaceholder('📖 Jump to a section…')
    .addOptions(PAGES.map((pg, k) => ({
      label: `${k + 1}. ${pg.title}`.slice(0, 100),
      description: pg.tag.slice(0, 100),
      value: String(k),
      emoji: pg.emoji,
      default: k === idx,
    })));

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`upd:go:${idx - 1}`).setLabel('Prev').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(idx === 0),
    new ButtonBuilder().setCustomId('upd:noop').setLabel(`${idx + 1}/${N}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(`upd:go:${idx + 1}`).setLabel('Next').setEmoji('▶️').setStyle(ButtonStyle.Primary).setDisabled(idx === N - 1),
    new ButtonBuilder().setCustomId('upd:go:0').setLabel('Home').setEmoji('🏠').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu), buttons] };
}

export async function handleUpdateCommand(message) {
  if (!/^!(update|changelog|whatsnew)\b/i.test((message.content || '').trim())) return false;
  await message.reply(buildPage(0)).catch(() => {});
  return true;
}

export async function handleUpdateComponent(interaction) {
  if (!interaction.customId?.startsWith('upd:')) return;
  if (interaction.customId === 'upd:noop') { await interaction.deferUpdate().catch(() => {}); return; }
  let idx = 0;
  if (interaction.isStringSelectMenu?.()) idx = Number(interaction.values[0]);
  else idx = Number(interaction.customId.split(':')[2]);
  if (!Number.isFinite(idx)) idx = 0;
  await interaction.update(buildPage(idx)).catch(() => {});
}
