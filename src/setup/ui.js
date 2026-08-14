// Setup UI Engine v4 —  yo chris i saw my crush btw u add to the inport blck pls
//                     - ok i will add it to the import block by the way why is this file called ui.js and not setup.js?
// Import block 1----------------------------------------------------------------------------------------------------------------------
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ComponentType,
} from 'discord.js';
//--------------------------------------------------------------------------------------------------------------------------------------
import { getCfg, setCfg, updateCfg, resetCfgToDefault } from './store.js';
import { LANG_LIST } from '../i18n/index.js';
import {
  renderTicketMaster,
  renderTicketPanel,
  renderTicketBehavior,
  renderTicketDM,
  renderTicketExtras,
} from './ticketStudio.js';
// ----------------------------------------------------------------------------------------------------------------------------------------------
// ============================================================================
// CONSTANTS & SYSTEM CONFIGURATION
// ============================================================================

export const ENGINE_VERSION = '4.2.0-ENT';
export const PRIMARY_ACCENT = 0x5865f2;
export const SUCCESS_ACCENT = 0x57f287;
export const WARNING_ACCENT = 0xfee75c;
export const DANGER_ACCENT  = 0xed4245;
export const NEUTRAL_ACCENT = 0x2b2d31;

export const DEFAULT_CONFIG_SCHEMA = {
  language: 'en-US',
  modules: {
    economy: true,
    gamification: true,
    moderation: true,
    automod: true,
    leveling: true,
    tickets: true,
    starboard: false,
    invites: false,
    welcome: true,
    music: false,
    ai: false,
    reactionRoles: true,
  },
  settings: {
    logChannel: null,
    welcomeChannel: null,
    goodbyeChannel: null,
    levelUpChannel: null,
    welcomeMessage: 'Welcome to {server}, {user}!',
    goodbyeMessage: '{user} has left the server.',
    levelUpMessage: 'Congratulations {user}, you leveled up to level {level}!',
    currencyName: 'Credits',
    currencyEmoji: '🪙',
    autoroles: {},
    adminRoles: [],
    modRoles: [],
    joinRoles: [],
    economy: {
      startingBalance: 100,
      dailyAmount: 50,
      weeklyBonus: 250,
      maxBank: 100000,
      workCooldown: 3600,
      robPenalty: 0.25,
    },
    automod: {
      invites: true,
      spam: true,
      badwords: false,
      maxMentions: 5,
      maxLines: 15,
      warnThreshold: 3,
      logChannel: null,
      ignoredChannels: [],
      ignoredRoles: [],
    },
    safety: {
      dmWelcome: false,
      logDeletes: true,
      logEdits: true,
      storeContent: false,
      antiRaid: false,
      captchaOnJoin: false,
      accountAgeLimitDays: 7,
    },
    ai: {
      enabled: false,
      personality: 'Helpful and concise assistant.',
      maxTokens: 1024,
      allowDMs: false,
      allowNSFW: false,
      systemPrompt: 'You are a Discord assistant bot.',
    },
    community: {
      suggestionChannel: null,
      feedbackChannel: null,
      allowAnonymous: false,
      rulesMessageId: null,
      pageEnabled: false,
    },
    counting: {
      enabled: false,
      channel: null,
      currentNumber: 0,
      lastUser: null,
      highScore: 0,
    },
    suggestions: {
      enabled: false,
      channel: null,
      autoThread: true,
      upvoteEmoji: '👍',
      downvoteEmoji: '👎',
    },
    casino: {
      enabled: true,
      minBet: 10,
      maxBet: 5000,
      houseEdge: 0.05,
    },
    recap: {
      enabled: true,
      channel: null,
      dayOfWeek: 0, // Sunday
    },
    verify: {
      enabled: false,
      nickname: true,
      roleId: null,
      unverifiedRoleId: null,
    },
    erlcRegions: {
      enabled: false,
      waitingVc: null,
      studsPerPixel: 1.0,
      apiKey: null,
    },
    starboard: {
      enabled: false,
      channel: null,
      threshold: 3,
      selfStar: false,
      emoji: '⭐',
    },
    tempVoice: {
      enabled: false,
      hubChannel: null,
      category: null,
      userLimit: 0,
    },
    streamAlerts: {
      enabled: false,
      channel: null,
      twitchUsers: [],
      ytChannels: [],
    },
    autoResponder: {
      enabled: false,
      triggers: {}, // key-value prompt matches
    },
    music: {
      enabled: false,
      defaultVolume: 50,
      maxQueue: 100,
      djRole: null,
      leaveOnEmpty: true,
    },
    tags: {
      enabled: true,
      allowEveryone: false,
      maxTags: 200,
    },
    reminders: {
      enabled: true,
      maxPerUser: 25,
      maxDays: 365,
    },
    birthdays: {
      enabled: false,
      channel: null,
      role: null,
      message: '🎂 Happy birthday, {user}!',
      showAge: false,
    },
    reputation: {
      enabled: true,
      cooldownHours: 12,
      channel: null,
    },
    reports: {
      enabled: false,
      channel: null,
      anonymous: true,
    },
    feedback: {
      enabled: false,
      channel: null,
      anonymous: true,
    },
    sticky: {
      enabled: false,
      channels: {},
    },
    mediaOnly: {
      enabled: false,
      channels: [],
      allowLinks: true,
    },
    linkFilter: {
      enabled: false,
      blockInvites: true,
      whitelist: [],
      blacklist: [],
    },
    wordFilter: {
      enabled: false,
      words: [],
      warnThreshold: 3,
      bypassRoles: [],
    },
    colorRoles: {
      enabled: false,
      roles: [],
      panelChannel: null,
    },
    boosterPerks: {
      enabled: false,
      thankChannel: null,
      perkRole: null,
      customColor: true,
    },
    scheduledMessages: {
      enabled: false,
      queue: [],
    },
    appeals: {
      enabled: false,
      channel: null,
      formId: null,
    },
    serverStats: {
      enabled: false,
      memberChannel: null,
      botChannel: null,
      boostChannel: null,
    },
    autoThread: {
      enabled: false,
      channels: [],
      archiveHours: 24,
    },
    timezones: {
      enabled: true,
      users: {},
    },
    trivia: {
      enabled: true,
      category: 'any',
      scores: {},
    },
  },
};

// ============================================================================
// COMPONENT FACTORY & BUILDER UTILITIES
// ============================================================================

/**
 * Builds a standardized Discord Button Component
 */
export function btn(id, label, style = ButtonStyle.Secondary, { emoji, disabled, url } = {}) {
  const b = new ButtonBuilder();
  if (url && style === ButtonStyle.Link) {
    b.setURL(url).setLabel(label).setStyle(ButtonStyle.Link);
  } else {
    b.setCustomId(id).setLabel(label).setStyle(style);
  }
  if (emoji) b.setEmoji(emoji);
  if (disabled) b.setDisabled(true);
  return b;
}

/**
 * Constructs a Channel Select Menu ActionRow wrapper
 */
export function chanSelect(key, page, currentId, placeholder, types = [ChannelType.GuildText]) {
  const m = new ChannelSelectMenuBuilder()
    .setCustomId(`setup:chan:${key}:${page}`)
    .setPlaceholder(placeholder)
    .setChannelTypes(...types)
    .setMinValues(0)
    .setMaxValues(1);
  if (currentId) {
    try {
      m.setDefaultChannels(currentId);
    } catch {
      // Ignored for platform API fallback compatibility
    }
  }
  return new ActionRowBuilder().addComponents(m);
}

/**
 * Constructs a Role Select Menu ActionRow wrapper
 */
export function roleSelect(key, page, currentIds, placeholder, max = 1) {
  const m = new RoleSelectMenuBuilder()
    .setCustomId(`setup:role:${key}:${page}`)
    .setPlaceholder(placeholder)
    .setMinValues(0)
    .setMaxValues(max);
  if (Array.isArray(currentIds) && currentIds.length > 0) {
    try {
      m.setDefaultRoles(...currentIds.slice(0, max));
    } catch {
      // Ignored for platform API fallback compatibility
    }
  }
  return new ActionRowBuilder().addComponents(m);
}

/**
 * Creates a generic StringSelectMenu wrapped in an ActionRow
 */
export function stringSelect(customId, placeholder, options, min = 1, max = 1) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMinValues(min)
    .setMaxValues(max)
    .addOptions(options);
  return new ActionRowBuilder().addComponents(menu);
}

// ============================================================================
// FORMATTING & STRING DECORATORS
// ============================================================================

export const on = (v) => (v !== false ? '🟢 On' : '🔴 Off');
export const chan = (id) => (id ? `<#${id}>` : '_none_');
export const rolesStr = (ids) => (ids?.length ? ids.map((r) => `<@&${r}>`).join(', ') : '_none_');
export const boolEmoji = (v) => (v ? '✅' : '❌');
export const numFmt = (num) => (typeof num === 'number' ? num.toLocaleString('en-US') : '0');

export function truncateStr(str, max = 100) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

export function keyToLabel(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase());
}

// ============================================================================
// CONFIGURATION INTEGRITY & MERGING
// ============================================================================

export function mergeDeep(target, source) {
  const isObject = (item) => item && typeof item === 'object' && !Array.isArray(item);
  const output = Object.assign({}, target);
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) Object.assign(output, { [key]: source[key] });
        else output[key] = mergeDeep(target[key], source[key]);
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

export function sanitizeConfig(rawCfg) {
  if (!rawCfg || typeof rawCfg !== 'object') {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG_SCHEMA));
  }
  return mergeDeep(DEFAULT_CONFIG_SCHEMA, rawCfg);
}

// ============================================================================
// MODAL MATRIX GENERATOR (INTERACTIVE INPUTS)
// ============================================================================

export function buildDynamicModal(customId, title, fields = []) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  const rows = fields.map((f) => {
    const input = new TextInputBuilder()
      .setCustomId(f.id)
      .setLabel(f.label)
      .setStyle(f.style || TextInputStyle.Short)
      .setPlaceholder(f.placeholder || '')
      .setRequired(f.required !== false);
    if (f.value !== undefined && f.value !== null) {
      input.setValue(String(f.value));
    }
    if (f.minLength) input.setMinLength(f.minLength);
    if (f.maxLength) input.setMaxLength(f.maxLength);
    return new ActionRowBuilder().addComponents(input);
  });
  modal.addComponents(...rows);
  return modal;
}

// ============================================================================
// DATA-DRIVEN INTERFACE SYSTEM — 35+ MODULE PAGES
// ============================================================================

// ============================================================================
// SUPPORT UTILITIES — formatting, metadata, and an in-file command catalog
// used by the panel descriptions and available to the rest of the setup UI.
// ============================================================================

/** Render a text progress bar, e.g. ▰▰▰▱▱▱ for 3/6. */
export function progressBar(value, max, width = 12) {
  const filled = Math.max(0, Math.min(width, Math.round((value / (max || 1)) * width)));
  return '▰'.repeat(filled) + '▱'.repeat(Math.max(0, width - filled));
}

/** Percentage as a rounded whole number string (e.g. "72%"). */
export function pct(value, max) {
  if (!max) return '0%';
  return Math.round((value / max) * 100) + '%';
}

/** Ordinal suffix for a number: 1 → 1st, 2 → 2nd, 23 → 23rd. */
export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Parse + clamp an integer into [min, max]. */
export function clampInt(value, min, max, fallback = 0) {
  const n = parseInt(String(value).replace(/[^0-9-]/g, ""), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** Join a list with commas, collapsing the tail into "+N more". */
export function formatList(items, max = 5) {
  const arr = Array.isArray(items) ? items : [];
  if (!arr.length) return '_none_';
  if (arr.length <= max) return arr.join(', ');
  return arr.slice(0, max).join(', ') + ' +' + (arr.length - max) + ' more';
}

/** A coloured status badge for a boolean feature flag. */
export function statusBadge(enabled) {
  return enabled ? '🟢 Active' : '⚪ Standby';
}

/** Truncate the middle of a long string, keeping both ends. */
export function truncateMiddle(str, max = 40) {
  const s = String(str || "");
  if (s.length <= max) return s;
  const half = Math.floor((max - 1) / 2);
  return s.slice(0, half) + '…' + s.slice(s.length - half);
}

/** Pick singular/plural based on count and prefix the number. */
export function pluralize(count, word, plural) {
  return count + ' ' + (count === 1 ? word : (plural || word + 's'));
}

/** Human yes/no with an emoji for a boolean. */
export function yesNo(value) {
  return value ? '✅ Yes' : '❌ No';
}

/** Resolve a channel name safely, or a placeholder if missing. */
export function safeChannel(guild, id) {
  const ch = id && guild && guild.channels && guild.channels.cache.get(id);
  return ch ? '#' + ch.name : '_not set_';
}

/** Count how many feature modules are currently enabled. */
export function countActiveModules(cfg) {
  const m = (cfg && cfg.modules) || {};
  return Object.values(m).filter((v) => v !== false).length;
}

/** Turn a duration in ms into a compact human string (e.g. "2h 5m"). */
export function relativeTime(ms) {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? (h + 'h ' + m + 'm') : (m ? (m + 'm') : (s + 's'));
}

// Display metadata for every page category (emoji, accent colour, blurb).
export const CATEGORY_META = {
  "Core": { emoji: '🏠', color: 0x5865f2, blurb: "Essential server configuration and identity." },
  "Staff Ops": { emoji: '🛡️', color: 0x57f287, blurb: "Tools your staff use day to day." },
  "Roleplay": { emoji: '🚔', color: 0xed4245, blurb: "ER:LC and roleplay operations." },
  "Community": { emoji: '🎉', color: 0xfaa61a, blurb: "Member engagement and onboarding." },
  "Engagement": { emoji: '🎮', color: 0xeb459e, blurb: "Games, fun, and interactive features." },
  "Economy": { emoji: '🪙', color: 0xf1c40f, blurb: "Currency, shop, and item systems." },
  "Moderation": { emoji: '🚨', color: 0xe67e22, blurb: "Filters, protection, and enforcement." },
  "Utility": { emoji: '🧰', color: 0x99aab5, blurb: "Everyday helpers and quality-of-life tools." },
  "Integrations": { emoji: '🔌', color: 0x1abc9c, blurb: "External feeds and third-party links." },
  "Web & API": { emoji: '🌐', color: 0x3498db, blurb: "Dashboard surfaces and the developer API." },
  "Advanced": { emoji: '⚙️', color: 0x95a5a6, blurb: "Power-user and maintenance features." },
};

/** All distinct category names, in display order. */
export const CATEGORY_ORDER = Object.keys(CATEGORY_META);

/** Return the {emoji,color,blurb} meta for a category (with a safe fallback). */
export function categoryMeta(name) {
  return CATEGORY_META[name] || { emoji: '📄', color: PRIMARY_ACCENT, blurb: '' };
}

// Quick command reference grouped by family — surfaced in help + docs.
export const COMMAND_CATALOG = {
  "Configuration": [
    "setup — open this wizard",
    "settings — quick view of current config",
    "reset — restore server defaults",
    "language — change the bot language",
    "modules — enable/disable feature modules",
    "export — download your config",
    "import — restore a saved config",
  ],
  "Moderation": [
    "ban — ban a member",
    "softban — ban then unban to clear messages",
    "kick — remove a member",
    "timeout — temporarily mute",
    "warn — issue a warning",
    "infractions — view a member’s history",
    "purge — bulk-delete messages",
    "slowmode — set channel slowmode",
    "lock — lock a channel",
    "unlock — unlock a channel",
    "massban — ban a list of IDs",
    "role — add/remove a role",
  ],
  "Leveling": [
    "rank — your level card",
    "leaderboard — top members by XP",
    "levelroles — reward roles per level",
    "xp add — grant XP",
    "xp remove — take XP",
    "levelup channel — set announcements",
  ],
  "Economy": [
    "balance — your wallet + bank",
    "daily — claim your daily reward",
    "weekly — claim your weekly bonus",
    "work — earn currency",
    "rob — attempt a heist",
    "pay — send currency",
    "shop — browse the store",
    "buy — purchase an item",
    "sell — sell an item",
    "inventory — your items",
    "deposit — bank currency",
    "withdraw — take from the bank",
  ],
  "Games": [
    "fight — duel another member",
    "blackjack — play 21",
    "coinflip — heads or tails",
    "slots — spin the reels",
    "trivia — answer questions",
    "fish — go fishing",
    "pet — care for your pet",
    "guess — number guessing",
    "rps — rock paper scissors",
  ],
  "Roleplay": [
    "session — start an ER:LC SSU",
    "bolo — post a be-on-lookout",
    "dispatch — open the CAD board",
    "department join — join a unit",
    "shift start — clock in",
    "shift end — clock out",
    "promote — promote a member",
    "infract — file a roleplay infraction",
  ],
  "Community": [
    "suggest — submit a suggestion",
    "poll — start a poll",
    "birthday set — register a birthday",
    "rep — give reputation",
    "feedback — send feedback",
    "report — report a message/user",
    "giveaway — start a giveaway",
  ],
  "Utility": [
    "remindme — set a reminder",
    "afk — set away status",
    "translate — translate text",
    "weather — check the weather",
    "timezone — manage timezones",
    "tag — recall a saved snippet",
    "avatar — show an avatar",
    "userinfo — member details",
    "serverinfo — server details",
  ],
  "Integrations": [
    "roblox — query the Roblox API",
    "minecraft — server status",
    "erlc link — link your ER:LC server",
    "streamalerts — manage live alerts",
    "rss add — add a feed",
    "reddit add — mirror a subreddit",
  ],
  "Web & API": [
    "apikey — generate a developer key",
    "dashboard — open the control panel",
    "docs — open the documentation",
    "embed — build an embed widget",
    "form — open the form builder",
    "template send — post a template",
  ],
};

/** Total number of catalogued commands across all families. */
export function catalogSize() {
  return Object.values(COMMAND_CATALOG).reduce((sum, list) => sum + list.length, 0);
}

/** Look up which family a command belongs to (or null). */
export function commandFamily(name) {
  for (const [family, list] of Object.entries(COMMAND_CATALOG)) {
    if (list.some((entry) => entry.split(' ')[0] === name)) return family;
  }
  return null;
}

// ============================================================================
// FEATURE MATRIX — a compact registry of top-level modules for status views.
// ============================================================================
export const FEATURE_MATRIX = [
  { title: "Leveling", module: 'leveling', category: 'Core', description: "XP, ranks, and reward roles" },
  { title: "Economy", module: 'economy', category: 'Economy', description: "Currency, shop, and daily rewards" },
  { title: "Moderation", module: 'moderation', category: 'Staff Ops', description: "Warns, bans, timeouts, and cases" },
  { title: "Auto-Moderation", module: 'automod', category: 'Moderation', description: "Spam, invites, and word filtering" },
  { title: "Tickets", module: 'tickets', category: 'Staff Ops', description: "Support tickets with a studio designer" },
  { title: "Welcome", module: 'welcome', category: 'Community', description: "Join/leave messages and cards" },
  { title: "Starboard", module: 'starboard', category: 'Community', description: "Highlight the best messages" },
  { title: "Music", module: 'music', category: 'Engagement', description: "Voice-channel audio streaming" },
  { title: "Reaction Roles", module: 'reactionRoles', category: 'Engagement', description: "Self-assignable roles" },
  { title: "AI Assistant", module: 'ai', category: 'Advanced', description: "AI chat and auto-config" },
  { title: "Invites", module: 'invites', category: 'Community', description: "Invite tracking and rewards" },
  { title: "Gamification", module: 'gamification', category: 'Engagement', description: "Badges, games, and minigames" },
];

/** Count enabled vs total modules from the feature matrix for a config. */
export function featureSummary(cfg) {
  const modules = (cfg && cfg.modules) || {};
  const total = FEATURE_MATRIX.length;
  const on = FEATURE_MATRIX.filter((f) => modules[f.module] !== false).length;
  return { on, total, off: total - on, ratio: total ? on / total : 0 };
}

/** Group the feature matrix by category → [features]. */
export function featuresByCategory() {
  const out = {};
  for (const f of FEATURE_MATRIX) {
    (out[f.category] = out[f.category] || []).push(f);
  }
  return out;
}

/** Render a one-line status row for a feature-matrix entry. */
export function featureStatusRow(feature, cfg) {
  const enabled = ((cfg && cfg.modules) || {})[feature.module] !== false;
  return `${enabled ? '🟢' : '⚪'} **${feature.title}** — ${feature.description}`;
}

/** Build a full status board string across every catalogued feature. */
export function featureBoard(cfg) {
  return FEATURE_MATRIX.map((f) => featureStatusRow(f, cfg)).join('\n');
}

/** Validate a hex colour string, returning a number or a fallback accent. */
export function parseHexColor(input, fallback = PRIMARY_ACCENT) {
  const n = parseInt(String(input || '').replace('#', ''), 16);
  return Number.isFinite(n) && n >= 0 && n <= 0xffffff ? n : fallback;
}

/** Coerce any value to a trimmed, length-capped display string. */
export function displayValue(value, max = 60) {
  const s = String(value == null ? '' : value).trim();
  if (!s) return '_not set_';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// ============================================================================
// ONBOARDING GUIDANCE — tips, a glossary, and small presentation helpers.
// ============================================================================

/** Recommended first-run setup order for a brand-new server. */
export const ONBOARDING_STEPS = [
  "Set your language on the Language & Locale page.",
  "Pick your Administrative and Moderator roles.",
  "Choose a central Audit Log channel.",
  "Turn on the modules you want in the Module Manager.",
  "Configure Welcome & Goodbye messages and channels.",
  "Set up Leveling rewards if you want XP roles.",
  "Enable Auto-Moderation and tune the thresholds.",
  "Brand your Economy (currency name + emoji).",
  "Add Departments and Shift Management for staff ops.",
  "Enable Verification to gate new members.",
  "Review the Safety & Privacy logging options.",
  "Star your favourite pages from the Quick Links directory.",
];

/** Short glossary of terms used throughout the setup wizard. */
export const GLOSSARY = {
  "Module": "A major feature area you can toggle on or off for the whole server.",
  "Callsign": "An auto-assigned identifier for a member of a department (e.g. PD-1).",
  "Autorole": "A role granted automatically when a member reaches a level.",
  "Escalation": "The staged response to repeat offences: warn → timeout → kick → ban.",
  "Starboard": "A channel that collects messages once they hit an emoji threshold.",
  "Template": "A reusable message/embed with variables like {user} and {server}.",
  "Session": "An ER:LC Server Start-Up with live player tracking and a join link.",
  "Shift": "A tracked staff clock-in/clock-out period with weekly totals.",
  "Verification": "A gate that new members pass before they can chat.",
  "Remote Setup": "The owner configuring another server via !setup <guildId>.",
};

/** Format a "• **Label:** value" description line. */
export function bullet(label, value) {
  return '• **' + label + ':** ' + (value == null || value === '' ? '_none_' : value);
}

/** Format a titled section with a heading and indented lines. */
export function section(title, lines) {
  return ['**' + title + '**', ...(Array.isArray(lines) ? lines : [lines])].join('\n');
}

/** Format a bold heading with a leading emoji. */
export function heading(emoji, title) {
  return '**' + emoji + ' ' + title + '**';
}

/** A button label reflecting the next action for a toggle. */
export function toggleLabel(enabled) {
  return enabled ? 'Disable' : 'Enable';
}

/** Returns "Success" or "Secondary" for a toggle button style. */
export function toggleStyleName(enabled) {
  return enabled ? 'Success' : 'Secondary';
}

/** A coloured status dot for a boolean. */
export function dot(enabled) {
  return enabled ? '🟢' : '🔴';
}

/** Count non-empty values in a settings sub-object. */
export function countConfigured(obj) {
  if (!obj || typeof obj !== "object") return 0;
  return Object.values(obj).filter((v) => v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)).length;
}

/** Return the first array element or a fallback. */
export function firstOr(arr, fallback) {
  return Array.isArray(arr) && arr.length ? arr[0] : fallback;
}

/** Render an array of role IDs as mentions, or a placeholder. */
export function joinRoles(ids) {
  if (!Array.isArray(ids) || !ids.length) return '_none_';
  return ids.map((id) => '<@&' + id + '>').join(', ');
}

/** Return a glossary definition (case-insensitive) or empty string. */
export function glossaryLookup(term) {
  const key = Object.keys(GLOSSARY).find((k) => k.toLowerCase() === String(term).toLowerCase());
  return key ? GLOSSARY[key] : '';
}

/** Rough completion estimate (0-1) for the onboarding checklist. */
export function onboardingProgress(cfg) {
  const s = (cfg && cfg.settings) || {};
  const checks = [s.adminRoles && s.adminRoles.length, s.logChannel, s.welcomeChannel, cfg && cfg.language];
  const done = checks.filter(Boolean).length;
  return done / checks.length;
}

// ============================================================================
// PANEL LEGEND & MISC PRESENTATION HELPERS
// ============================================================================

/** Emoji legend explaining the symbols used across setup pages. */
export const PANEL_LEGEND = {
  "🟢": "Feature enabled / active",
  "🔴": "Feature disabled",
  "⚪": "Standby — not yet configured",
  "✏️": "Opens a text input to edit a value",
  "🌐": "Opens the matching web dashboard page",
  "📖": "Opens the documentation",
  "🔒": "Requires elevated permissions",
  "⚠️": "Destructive or irreversible action",
};

/** Render the legend as a description block. */
export function legendBlock() {
  return Object.entries(PANEL_LEGEND).map(([e, m]) => e + ' — ' + m).join('\n');
}

/** A titled divider line for grouping description sections. */
export function divider(label) {
  return label ? '\n**— ' + label + ' —**' : '\n————————';
}

/** Render an object as "• key: value" lines. */
export function kv(pairs) {
  if (!pairs || typeof pairs !== "object") return "";
  return Object.entries(pairs).map(([k, v]) => '• ' + k + ': ' + v).join('\n');
}

/** Map a string state to a coloured badge (on/off/pending). */
export function badgeFor(state) {
  if (state === 'on' || state === true) return '🟢 On';
  if (state === 'pending') return '🟡 Pending';
  return '🔴 Off';
}

/** Capitalise the first letter of a string. */
export function capitalize(str) {
  const s = String(str || "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Convert a slug or phrase to Title Case. */
export function titleCase(str) {
  return String(str || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Build a stable anchor string for linking to a page by id. */
export function pageAnchor(id) {
  return 'setup-' + String(id || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/** Hard-cap a string to a maximum length with an ellipsis. */
export function clampText(str, max) {
  const s = String(str == null ? "" : str);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/**
 * Count how many setup pages fall under each category — handy for the footer
 * summary and for tests that assert the wizard's breadth stays consistent.
 */
export function pageCountByCategory() {
  const counts = {};
  for (const p of PAGES) {
    const c = p.category || 'General';
    counts[c] = (counts[c] || 0) + 1;
  }
  return counts;
}

/** Total number of configurable pages in the wizard. */
export function totalPageCount() {
  return PAGES.length;
}

// ============================================================================
// EXTENDED REFERENCE LIBRARY — command catalog, i18n strings, help articles,
// setting help, FAQ, and presentation helpers. Data-driven + exported so the
// dashboard, /help, and docs surfaces can all read from one source of truth.
// ============================================================================

/** Full command reference — one entry per command, grouped by family. */
export const COMMAND_REFERENCE = [
  {
    name: "setup",
    family: "Configuration",
    emoji: "⚙️",
    slash: "/setup",
    prefix: "!setup",
    description: "Configuration command: setup.",
    usage: "/setup [options]",
    example: "/setup",
  },
  {
    name: "settings",
    family: "Configuration",
    emoji: "⚙️",
    slash: "/settings",
    prefix: "!settings",
    description: "Configuration command: settings.",
    usage: "/settings [options]",
    example: "/settings",
  },
  {
    name: "reset",
    family: "Configuration",
    emoji: "⚙️",
    slash: "/reset",
    prefix: "!reset",
    description: "Configuration command: reset.",
    usage: "/reset [options]",
    example: "/reset",
  },
  {
    name: "language",
    family: "Configuration",
    emoji: "⚙️",
    slash: "/language",
    prefix: "!language",
    description: "Configuration command: language.",
    usage: "/language [options]",
    example: "/language",
  },
  {
    name: "modules",
    family: "Configuration",
    emoji: "⚙️",
    slash: "/modules",
    prefix: "!modules",
    description: "Configuration command: modules.",
    usage: "/modules [options]",
    example: "/modules",
  },
  {
    name: "export",
    family: "Configuration",
    emoji: "⚙️",
    slash: "/export",
    prefix: "!export",
    description: "Configuration command: export.",
    usage: "/export [options]",
    example: "/export",
  },
  {
    name: "import",
    family: "Configuration",
    emoji: "⚙️",
    slash: "/import",
    prefix: "!import",
    description: "Configuration command: import.",
    usage: "/import [options]",
    example: "/import",
  },
  {
    name: "prefix",
    family: "Configuration",
    emoji: "⚙️",
    slash: "/prefix",
    prefix: "!prefix",
    description: "Configuration command: prefix.",
    usage: "/prefix [options]",
    example: "/prefix",
  },
  {
    name: "permissions",
    family: "Configuration",
    emoji: "⚙️",
    slash: "/permissions",
    prefix: "!permissions",
    description: "Configuration command: permissions.",
    usage: "/permissions [options]",
    example: "/permissions",
  },
  {
    name: "remotesetup",
    family: "Configuration",
    emoji: "⚙️",
    slash: "/remotesetup",
    prefix: "!remotesetup",
    description: "Configuration command: remotesetup.",
    usage: "/remotesetup [options]",
    example: "/remotesetup",
  },
  {
    name: "ban",
    family: "Moderation",
    emoji: "🛡️",
    slash: "/ban",
    prefix: "!ban",
    description: "Moderation command: ban.",
    usage: "/ban [options]",
    example: "/ban",
  },
  {
    name: "unban",
    family: "Moderation",
    emoji: "🛡️",
    slash: "/unban",
    prefix: "!unban",
    description: "Moderation command: unban.",
    usage: "/unban [options]",
    example: "/unban",
  },
  {
    name: "softban",
    family: "Moderation",
    emoji: "🛡️",
    slash: "/softban",
    prefix: "!softban",
    description: "Moderation command: softban.",
    usage: "/softban [options]",
    example: "/softban",
  },
  {
    name: "kick",
    family: "Moderation",
    emoji: "🛡️",
    slash: "/kick",
    prefix: "!kick",
    description: "Moderation command: kick.",
    usage: "/kick [options]",
    example: "/kick",
  },
  {
    name: "timeout",
    family: "Moderation",
    emoji: "🛡️",
    slash: "/timeout",
    prefix: "!timeout",
    description: "Moderation command: timeout.",
    usage: "/timeout [options]",
    example: "/timeout",
  },
  {
    name: "untimeout",
    family: "Moderation",
    emoji: "🛡️",
    slash: "/untimeout",
    prefix: "!untimeout",
    description: "Moderation command: untimeout.",
    usage: "/untimeout [options]",
    example: "/untimeout",
  },
  {
    name: "warn",
    family: "Moderation",
    emoji: "🛡️",
    slash: "/warn",
    prefix: "!warn",
    description: "Moderation command: warn.",
    usage: "/warn [options]",
    example: "/warn",
  },
  {
    name: "warnings",
    family: "Moderation",
    emoji: "🛡️",
    slash: "/warnings",
    prefix: "!warnings",
    description: "Moderation command: warnings.",
    usage: "/warnings [options]",
    example: "/warnings",
  },
  {
    name: "delwarn",
    family: "Moderation",
    emoji: "🛡️",
    slash: "/delwarn",
    prefix: "!delwarn",
    description: "Moderation command: delwarn.",
    usage: "/delwarn [options]",
    example: "/delwarn",
  },
  {
    name: "purge",
    family: "Moderation",
    emoji: "🛡️",
    slash: "/purge",
    prefix: "!purge",
    description: "Moderation command: purge.",
    usage: "/purge [options]",
    example: "/purge",
  },
  {
    name: "slowmode",
    family: "Moderation",
    emoji: "🛡️",
    slash: "/slowmode",
    prefix: "!slowmode",
    description: "Moderation command: slowmode.",
    usage: "/slowmode [options]",
    example: "/slowmode",
  },
  {
    name: "lock",
    family: "Moderation",
    emoji: "🛡️",
    slash: "/lock",
    prefix: "!lock",
    description: "Moderation command: lock.",
    usage: "/lock [options]",
    example: "/lock",
  },
  {
    name: "unlock",
    family: "Moderation",
    emoji: "🛡️",
    slash: "/unlock",
    prefix: "!unlock",
    description: "Moderation command: unlock.",
    usage: "/unlock [options]",
    example: "/unlock",
  },
  {
    name: "massban",
    family: "Moderation",
    emoji: "🛡️",
    slash: "/massban",
    prefix: "!massban",
    description: "Moderation command: massban.",
    usage: "/massban [options]",
    example: "/massban",
  },
  {
    name: "role",
    family: "Moderation",
    emoji: "🛡️",
    slash: "/role",
    prefix: "!role",
    description: "Moderation command: role.",
    usage: "/role [options]",
    example: "/role",
  },
  {
    name: "nick",
    family: "Moderation",
    emoji: "🛡️",
    slash: "/nick",
    prefix: "!nick",
    description: "Moderation command: nick.",
    usage: "/nick [options]",
    example: "/nick",
  },
  {
    name: "case",
    family: "Moderation",
    emoji: "🛡️",
    slash: "/case",
    prefix: "!case",
    description: "Moderation command: case.",
    usage: "/case [options]",
    example: "/case",
  },
  {
    name: "modstats",
    family: "Moderation",
    emoji: "🛡️",
    slash: "/modstats",
    prefix: "!modstats",
    description: "Moderation command: modstats.",
    usage: "/modstats [options]",
    example: "/modstats",
  },
  {
    name: "note",
    family: "Moderation",
    emoji: "🛡️",
    slash: "/note",
    prefix: "!note",
    description: "Moderation command: note.",
    usage: "/note [options]",
    example: "/note",
  },
  {
    name: "mute",
    family: "Moderation",
    emoji: "🛡️",
    slash: "/mute",
    prefix: "!mute",
    description: "Moderation command: mute.",
    usage: "/mute [options]",
    example: "/mute",
  },
  {
    name: "unmute",
    family: "Moderation",
    emoji: "🛡️",
    slash: "/unmute",
    prefix: "!unmute",
    description: "Moderation command: unmute.",
    usage: "/unmute [options]",
    example: "/unmute",
  },
  {
    name: "rank",
    family: "Leveling",
    emoji: "📊",
    slash: "/rank",
    prefix: "!rank",
    description: "Leveling command: rank.",
    usage: "/rank [options]",
    example: "/rank",
  },
  {
    name: "levels",
    family: "Leveling",
    emoji: "📊",
    slash: "/levels",
    prefix: "!levels",
    description: "Leveling command: levels.",
    usage: "/levels [options]",
    example: "/levels",
  },
  {
    name: "leaderboard",
    family: "Leveling",
    emoji: "📊",
    slash: "/leaderboard",
    prefix: "!leaderboard",
    description: "Leveling command: leaderboard.",
    usage: "/leaderboard [options]",
    example: "/leaderboard",
  },
  {
    name: "levelrole",
    family: "Leveling",
    emoji: "📊",
    slash: "/levelrole",
    prefix: "!levelrole",
    description: "Leveling command: levelrole.",
    usage: "/levelrole [options]",
    example: "/levelrole",
  },
  {
    name: "xpadd",
    family: "Leveling",
    emoji: "📊",
    slash: "/xpadd",
    prefix: "!xpadd",
    description: "Leveling command: xpadd.",
    usage: "/xpadd [options]",
    example: "/xpadd",
  },
  {
    name: "xpremove",
    family: "Leveling",
    emoji: "📊",
    slash: "/xpremove",
    prefix: "!xpremove",
    description: "Leveling command: xpremove.",
    usage: "/xpremove [options]",
    example: "/xpremove",
  },
  {
    name: "xpreset",
    family: "Leveling",
    emoji: "📊",
    slash: "/xpreset",
    prefix: "!xpreset",
    description: "Leveling command: xpreset.",
    usage: "/xpreset [options]",
    example: "/xpreset",
  },
  {
    name: "levelchannel",
    family: "Leveling",
    emoji: "📊",
    slash: "/levelchannel",
    prefix: "!levelchannel",
    description: "Leveling command: levelchannel.",
    usage: "/levelchannel [options]",
    example: "/levelchannel",
  },
  {
    name: "rankcard",
    family: "Leveling",
    emoji: "📊",
    slash: "/rankcard",
    prefix: "!rankcard",
    description: "Leveling command: rankcard.",
    usage: "/rankcard [options]",
    example: "/rankcard",
  },
  {
    name: "multiplier",
    family: "Leveling",
    emoji: "📊",
    slash: "/multiplier",
    prefix: "!multiplier",
    description: "Leveling command: multiplier.",
    usage: "/multiplier [options]",
    example: "/multiplier",
  },
  {
    name: "balance",
    family: "Economy",
    emoji: "🪙",
    slash: "/balance",
    prefix: "!balance",
    description: "Economy command: balance.",
    usage: "/balance [options]",
    example: "/balance",
  },
  {
    name: "daily",
    family: "Economy",
    emoji: "🪙",
    slash: "/daily",
    prefix: "!daily",
    description: "Economy command: daily.",
    usage: "/daily [options]",
    example: "/daily",
  },
  {
    name: "weekly",
    family: "Economy",
    emoji: "🪙",
    slash: "/weekly",
    prefix: "!weekly",
    description: "Economy command: weekly.",
    usage: "/weekly [options]",
    example: "/weekly",
  },
  {
    name: "work",
    family: "Economy",
    emoji: "🪙",
    slash: "/work",
    prefix: "!work",
    description: "Economy command: work.",
    usage: "/work [options]",
    example: "/work",
  },
  {
    name: "rob",
    family: "Economy",
    emoji: "🪙",
    slash: "/rob",
    prefix: "!rob",
    description: "Economy command: rob.",
    usage: "/rob [options]",
    example: "/rob",
  },
  {
    name: "pay",
    family: "Economy",
    emoji: "🪙",
    slash: "/pay",
    prefix: "!pay",
    description: "Economy command: pay.",
    usage: "/pay [options]",
    example: "/pay",
  },
  {
    name: "shop",
    family: "Economy",
    emoji: "🪙",
    slash: "/shop",
    prefix: "!shop",
    description: "Economy command: shop.",
    usage: "/shop [options]",
    example: "/shop",
  },
  {
    name: "buy",
    family: "Economy",
    emoji: "🪙",
    slash: "/buy",
    prefix: "!buy",
    description: "Economy command: buy.",
    usage: "/buy [options]",
    example: "/buy",
  },
  {
    name: "sell",
    family: "Economy",
    emoji: "🪙",
    slash: "/sell",
    prefix: "!sell",
    description: "Economy command: sell.",
    usage: "/sell [options]",
    example: "/sell",
  },
  {
    name: "inventory",
    family: "Economy",
    emoji: "🪙",
    slash: "/inventory",
    prefix: "!inventory",
    description: "Economy command: inventory.",
    usage: "/inventory [options]",
    example: "/inventory",
  },
  {
    name: "deposit",
    family: "Economy",
    emoji: "🪙",
    slash: "/deposit",
    prefix: "!deposit",
    description: "Economy command: deposit.",
    usage: "/deposit [options]",
    example: "/deposit",
  },
  {
    name: "withdraw",
    family: "Economy",
    emoji: "🪙",
    slash: "/withdraw",
    prefix: "!withdraw",
    description: "Economy command: withdraw.",
    usage: "/withdraw [options]",
    example: "/withdraw",
  },
  {
    name: "gamble",
    family: "Economy",
    emoji: "🪙",
    slash: "/gamble",
    prefix: "!gamble",
    description: "Economy command: gamble.",
    usage: "/gamble [options]",
    example: "/gamble",
  },
  {
    name: "give",
    family: "Economy",
    emoji: "🪙",
    slash: "/give",
    prefix: "!give",
    description: "Economy command: give.",
    usage: "/give [options]",
    example: "/give",
  },
  {
    name: "leaderboardeco",
    family: "Economy",
    emoji: "🪙",
    slash: "/leaderboardeco",
    prefix: "!leaderboardeco",
    description: "Economy command: leaderboardeco.",
    usage: "/leaderboardeco [options]",
    example: "/leaderboardeco",
  },
  {
    name: "item",
    family: "Economy",
    emoji: "🪙",
    slash: "/item",
    prefix: "!item",
    description: "Economy command: item.",
    usage: "/item [options]",
    example: "/item",
  },
  {
    name: "crime",
    family: "Economy",
    emoji: "🪙",
    slash: "/crime",
    prefix: "!crime",
    description: "Economy command: crime.",
    usage: "/crime [options]",
    example: "/crime",
  },
  {
    name: "beg",
    family: "Economy",
    emoji: "🪙",
    slash: "/beg",
    prefix: "!beg",
    description: "Economy command: beg.",
    usage: "/beg [options]",
    example: "/beg",
  },
  {
    name: "lottery",
    family: "Economy",
    emoji: "🪙",
    slash: "/lottery",
    prefix: "!lottery",
    description: "Economy command: lottery.",
    usage: "/lottery [options]",
    example: "/lottery",
  },
  {
    name: "fight",
    family: "Games",
    emoji: "🎮",
    slash: "/fight",
    prefix: "!fight",
    description: "Games command: fight.",
    usage: "/fight [options]",
    example: "/fight",
  },
  {
    name: "blackjack",
    family: "Games",
    emoji: "🎮",
    slash: "/blackjack",
    prefix: "!blackjack",
    description: "Games command: blackjack.",
    usage: "/blackjack [options]",
    example: "/blackjack",
  },
  {
    name: "coinflip",
    family: "Games",
    emoji: "🎮",
    slash: "/coinflip",
    prefix: "!coinflip",
    description: "Games command: coinflip.",
    usage: "/coinflip [options]",
    example: "/coinflip",
  },
  {
    name: "slots",
    family: "Games",
    emoji: "🎮",
    slash: "/slots",
    prefix: "!slots",
    description: "Games command: slots.",
    usage: "/slots [options]",
    example: "/slots",
  },
  {
    name: "trivia",
    family: "Games",
    emoji: "🎮",
    slash: "/trivia",
    prefix: "!trivia",
    description: "Games command: trivia.",
    usage: "/trivia [options]",
    example: "/trivia",
  },
  {
    name: "fish",
    family: "Games",
    emoji: "🎮",
    slash: "/fish",
    prefix: "!fish",
    description: "Games command: fish.",
    usage: "/fish [options]",
    example: "/fish",
  },
  {
    name: "pet",
    family: "Games",
    emoji: "🎮",
    slash: "/pet",
    prefix: "!pet",
    description: "Games command: pet.",
    usage: "/pet [options]",
    example: "/pet",
  },
  {
    name: "guess",
    family: "Games",
    emoji: "🎮",
    slash: "/guess",
    prefix: "!guess",
    description: "Games command: guess.",
    usage: "/guess [options]",
    example: "/guess",
  },
  {
    name: "rps",
    family: "Games",
    emoji: "🎮",
    slash: "/rps",
    prefix: "!rps",
    description: "Games command: rps.",
    usage: "/rps [options]",
    example: "/rps",
  },
  {
    name: "tictactoe",
    family: "Games",
    emoji: "🎮",
    slash: "/tictactoe",
    prefix: "!tictactoe",
    description: "Games command: tictactoe.",
    usage: "/tictactoe [options]",
    example: "/tictactoe",
  },
  {
    name: "hangman",
    family: "Games",
    emoji: "🎮",
    slash: "/hangman",
    prefix: "!hangman",
    description: "Games command: hangman.",
    usage: "/hangman [options]",
    example: "/hangman",
  },
  {
    name: "connect4",
    family: "Games",
    emoji: "🎮",
    slash: "/connect4",
    prefix: "!connect4",
    description: "Games command: connect4.",
    usage: "/connect4 [options]",
    example: "/connect4",
  },
  {
    name: "uno",
    family: "Games",
    emoji: "🎮",
    slash: "/uno",
    prefix: "!uno",
    description: "Games command: uno.",
    usage: "/uno [options]",
    example: "/uno",
  },
  {
    name: "wordle",
    family: "Games",
    emoji: "🎮",
    slash: "/wordle",
    prefix: "!wordle",
    description: "Games command: wordle.",
    usage: "/wordle [options]",
    example: "/wordle",
  },
  {
    name: "duel",
    family: "Games",
    emoji: "🎮",
    slash: "/duel",
    prefix: "!duel",
    description: "Games command: duel.",
    usage: "/duel [options]",
    example: "/duel",
  },
  {
    name: "session",
    family: "Roleplay",
    emoji: "🚔",
    slash: "/session",
    prefix: "!session",
    description: "Roleplay command: session.",
    usage: "/session [options]",
    example: "/session",
  },
  {
    name: "bolo",
    family: "Roleplay",
    emoji: "🚔",
    slash: "/bolo",
    prefix: "!bolo",
    description: "Roleplay command: bolo.",
    usage: "/bolo [options]",
    example: "/bolo",
  },
  {
    name: "dispatch",
    family: "Roleplay",
    emoji: "🚔",
    slash: "/dispatch",
    prefix: "!dispatch",
    description: "Roleplay command: dispatch.",
    usage: "/dispatch [options]",
    example: "/dispatch",
  },
  {
    name: "department",
    family: "Roleplay",
    emoji: "🚔",
    slash: "/department",
    prefix: "!department",
    description: "Roleplay command: department.",
    usage: "/department [options]",
    example: "/department",
  },
  {
    name: "shift",
    family: "Roleplay",
    emoji: "🚔",
    slash: "/shift",
    prefix: "!shift",
    description: "Roleplay command: shift.",
    usage: "/shift [options]",
    example: "/shift",
  },
  {
    name: "promote",
    family: "Roleplay",
    emoji: "🚔",
    slash: "/promote",
    prefix: "!promote",
    description: "Roleplay command: promote.",
    usage: "/promote [options]",
    example: "/promote",
  },
  {
    name: "infract",
    family: "Roleplay",
    emoji: "🚔",
    slash: "/infract",
    prefix: "!infract",
    description: "Roleplay command: infract.",
    usage: "/infract [options]",
    example: "/infract",
  },
  {
    name: "cad",
    family: "Roleplay",
    emoji: "🚔",
    slash: "/cad",
    prefix: "!cad",
    description: "Roleplay command: cad.",
    usage: "/cad [options]",
    example: "/cad",
  },
  {
    name: "unit",
    family: "Roleplay",
    emoji: "🚔",
    slash: "/unit",
    prefix: "!unit",
    description: "Roleplay command: unit.",
    usage: "/unit [options]",
    example: "/unit",
  },
  {
    name: "call",
    family: "Roleplay",
    emoji: "🚔",
    slash: "/call",
    prefix: "!call",
    description: "Roleplay command: call.",
    usage: "/call [options]",
    example: "/call",
  },
  {
    name: "sspanel",
    family: "Roleplay",
    emoji: "🚔",
    slash: "/sspanel",
    prefix: "!sspanel",
    description: "Roleplay command: sspanel.",
    usage: "/sspanel [options]",
    example: "/sspanel",
  },
  {
    name: "erlc",
    family: "Roleplay",
    emoji: "🚔",
    slash: "/erlc",
    prefix: "!erlc",
    description: "Roleplay command: erlc.",
    usage: "/erlc [options]",
    example: "/erlc",
  },
  {
    name: "suggest",
    family: "Community",
    emoji: "🎉",
    slash: "/suggest",
    prefix: "!suggest",
    description: "Community command: suggest.",
    usage: "/suggest [options]",
    example: "/suggest",
  },
  {
    name: "poll",
    family: "Community",
    emoji: "🎉",
    slash: "/poll",
    prefix: "!poll",
    description: "Community command: poll.",
    usage: "/poll [options]",
    example: "/poll",
  },
  {
    name: "birthday",
    family: "Community",
    emoji: "🎉",
    slash: "/birthday",
    prefix: "!birthday",
    description: "Community command: birthday.",
    usage: "/birthday [options]",
    example: "/birthday",
  },
  {
    name: "rep",
    family: "Community",
    emoji: "🎉",
    slash: "/rep",
    prefix: "!rep",
    description: "Community command: rep.",
    usage: "/rep [options]",
    example: "/rep",
  },
  {
    name: "feedback",
    family: "Community",
    emoji: "🎉",
    slash: "/feedback",
    prefix: "!feedback",
    description: "Community command: feedback.",
    usage: "/feedback [options]",
    example: "/feedback",
  },
  {
    name: "report",
    family: "Community",
    emoji: "🎉",
    slash: "/report",
    prefix: "!report",
    description: "Community command: report.",
    usage: "/report [options]",
    example: "/report",
  },
  {
    name: "giveaway",
    family: "Community",
    emoji: "🎉",
    slash: "/giveaway",
    prefix: "!giveaway",
    description: "Community command: giveaway.",
    usage: "/giveaway [options]",
    example: "/giveaway",
  },
  {
    name: "starboard",
    family: "Community",
    emoji: "🎉",
    slash: "/starboard",
    prefix: "!starboard",
    description: "Community command: starboard.",
    usage: "/starboard [options]",
    example: "/starboard",
  },
  {
    name: "welcome",
    family: "Community",
    emoji: "🎉",
    slash: "/welcome",
    prefix: "!welcome",
    description: "Community command: welcome.",
    usage: "/welcome [options]",
    example: "/welcome",
  },
  {
    name: "autorole",
    family: "Community",
    emoji: "🎉",
    slash: "/autorole",
    prefix: "!autorole",
    description: "Community command: autorole.",
    usage: "/autorole [options]",
    example: "/autorole",
  },
  {
    name: "reactionrole",
    family: "Community",
    emoji: "🎉",
    slash: "/reactionrole",
    prefix: "!reactionrole",
    description: "Community command: reactionrole.",
    usage: "/reactionrole [options]",
    example: "/reactionrole",
  },
  {
    name: "remindme",
    family: "Utility",
    emoji: "🧰",
    slash: "/remindme",
    prefix: "!remindme",
    description: "Utility command: remindme.",
    usage: "/remindme [options]",
    example: "/remindme",
  },
  {
    name: "afk",
    family: "Utility",
    emoji: "🧰",
    slash: "/afk",
    prefix: "!afk",
    description: "Utility command: afk.",
    usage: "/afk [options]",
    example: "/afk",
  },
  {
    name: "translate",
    family: "Utility",
    emoji: "🧰",
    slash: "/translate",
    prefix: "!translate",
    description: "Utility command: translate.",
    usage: "/translate [options]",
    example: "/translate",
  },
  {
    name: "weather",
    family: "Utility",
    emoji: "🧰",
    slash: "/weather",
    prefix: "!weather",
    description: "Utility command: weather.",
    usage: "/weather [options]",
    example: "/weather",
  },
  {
    name: "timezone",
    family: "Utility",
    emoji: "🧰",
    slash: "/timezone",
    prefix: "!timezone",
    description: "Utility command: timezone.",
    usage: "/timezone [options]",
    example: "/timezone",
  },
  {
    name: "tag",
    family: "Utility",
    emoji: "🧰",
    slash: "/tag",
    prefix: "!tag",
    description: "Utility command: tag.",
    usage: "/tag [options]",
    example: "/tag",
  },
  {
    name: "avatar",
    family: "Utility",
    emoji: "🧰",
    slash: "/avatar",
    prefix: "!avatar",
    description: "Utility command: avatar.",
    usage: "/avatar [options]",
    example: "/avatar",
  },
  {
    name: "userinfo",
    family: "Utility",
    emoji: "🧰",
    slash: "/userinfo",
    prefix: "!userinfo",
    description: "Utility command: userinfo.",
    usage: "/userinfo [options]",
    example: "/userinfo",
  },
  {
    name: "serverinfo",
    family: "Utility",
    emoji: "🧰",
    slash: "/serverinfo",
    prefix: "!serverinfo",
    description: "Utility command: serverinfo.",
    usage: "/serverinfo [options]",
    example: "/serverinfo",
  },
  {
    name: "roleinfo",
    family: "Utility",
    emoji: "🧰",
    slash: "/roleinfo",
    prefix: "!roleinfo",
    description: "Utility command: roleinfo.",
    usage: "/roleinfo [options]",
    example: "/roleinfo",
  },
  {
    name: "channelinfo",
    family: "Utility",
    emoji: "🧰",
    slash: "/channelinfo",
    prefix: "!channelinfo",
    description: "Utility command: channelinfo.",
    usage: "/channelinfo [options]",
    example: "/channelinfo",
  },
  {
    name: "emoji",
    family: "Utility",
    emoji: "🧰",
    slash: "/emoji",
    prefix: "!emoji",
    description: "Utility command: emoji.",
    usage: "/emoji [options]",
    example: "/emoji",
  },
  {
    name: "ping",
    family: "Utility",
    emoji: "🧰",
    slash: "/ping",
    prefix: "!ping",
    description: "Utility command: ping.",
    usage: "/ping [options]",
    example: "/ping",
  },
  {
    name: "uptime",
    family: "Utility",
    emoji: "🧰",
    slash: "/uptime",
    prefix: "!uptime",
    description: "Utility command: uptime.",
    usage: "/uptime [options]",
    example: "/uptime",
  },
  {
    name: "invite",
    family: "Utility",
    emoji: "🧰",
    slash: "/invite",
    prefix: "!invite",
    description: "Utility command: invite.",
    usage: "/invite [options]",
    example: "/invite",
  },
  {
    name: "vote",
    family: "Utility",
    emoji: "🧰",
    slash: "/vote",
    prefix: "!vote",
    description: "Utility command: vote.",
    usage: "/vote [options]",
    example: "/vote",
  },
  {
    name: "math",
    family: "Utility",
    emoji: "🧰",
    slash: "/math",
    prefix: "!math",
    description: "Utility command: math.",
    usage: "/math [options]",
    example: "/math",
  },
  {
    name: "choose",
    family: "Utility",
    emoji: "🧰",
    slash: "/choose",
    prefix: "!choose",
    description: "Utility command: choose.",
    usage: "/choose [options]",
    example: "/choose",
  },
  {
    name: "embed",
    family: "Utility",
    emoji: "🧰",
    slash: "/embed",
    prefix: "!embed",
    description: "Utility command: embed.",
    usage: "/embed [options]",
    example: "/embed",
  },
  {
    name: "roblox",
    family: "Integrations",
    emoji: "🔌",
    slash: "/roblox",
    prefix: "!roblox",
    description: "Integrations command: roblox.",
    usage: "/roblox [options]",
    example: "/roblox",
  },
  {
    name: "minecraft",
    family: "Integrations",
    emoji: "🔌",
    slash: "/minecraft",
    prefix: "!minecraft",
    description: "Integrations command: minecraft.",
    usage: "/minecraft [options]",
    example: "/minecraft",
  },
  {
    name: "link",
    family: "Integrations",
    emoji: "🔌",
    slash: "/link",
    prefix: "!link",
    description: "Integrations command: link.",
    usage: "/link [options]",
    example: "/link",
  },
  {
    name: "streamalerts",
    family: "Integrations",
    emoji: "🔌",
    slash: "/streamalerts",
    prefix: "!streamalerts",
    description: "Integrations command: streamalerts.",
    usage: "/streamalerts [options]",
    example: "/streamalerts",
  },
  {
    name: "rss",
    family: "Integrations",
    emoji: "🔌",
    slash: "/rss",
    prefix: "!rss",
    description: "Integrations command: rss.",
    usage: "/rss [options]",
    example: "/rss",
  },
  {
    name: "reddit",
    family: "Integrations",
    emoji: "🔌",
    slash: "/reddit",
    prefix: "!reddit",
    description: "Integrations command: reddit.",
    usage: "/reddit [options]",
    example: "/reddit",
  },
  {
    name: "youtube",
    family: "Integrations",
    emoji: "🔌",
    slash: "/youtube",
    prefix: "!youtube",
    description: "Integrations command: youtube.",
    usage: "/youtube [options]",
    example: "/youtube",
  },
  {
    name: "twitch",
    family: "Integrations",
    emoji: "🔌",
    slash: "/twitch",
    prefix: "!twitch",
    description: "Integrations command: twitch.",
    usage: "/twitch [options]",
    example: "/twitch",
  },
  {
    name: "apikey",
    family: "Integrations",
    emoji: "🔌",
    slash: "/apikey",
    prefix: "!apikey",
    description: "Integrations command: apikey.",
    usage: "/apikey [options]",
    example: "/apikey",
  },
  {
    name: "webhook",
    family: "Integrations",
    emoji: "🔌",
    slash: "/webhook",
    prefix: "!webhook",
    description: "Integrations command: webhook.",
    usage: "/webhook [options]",
    example: "/webhook",
  },
  {
    name: "8ball",
    family: "Fun",
    emoji: "🎲",
    slash: "/8ball",
    prefix: "!8ball",
    description: "Fun command: 8ball.",
    usage: "/8ball [options]",
    example: "/8ball",
  },
  {
    name: "joke",
    family: "Fun",
    emoji: "🎲",
    slash: "/joke",
    prefix: "!joke",
    description: "Fun command: joke.",
    usage: "/joke [options]",
    example: "/joke",
  },
  {
    name: "meme",
    family: "Fun",
    emoji: "🎲",
    slash: "/meme",
    prefix: "!meme",
    description: "Fun command: meme.",
    usage: "/meme [options]",
    example: "/meme",
  },
  {
    name: "fact",
    family: "Fun",
    emoji: "🎲",
    slash: "/fact",
    prefix: "!fact",
    description: "Fun command: fact.",
    usage: "/fact [options]",
    example: "/fact",
  },
  {
    name: "cat",
    family: "Fun",
    emoji: "🎲",
    slash: "/cat",
    prefix: "!cat",
    description: "Fun command: cat.",
    usage: "/cat [options]",
    example: "/cat",
  },
  {
    name: "dog",
    family: "Fun",
    emoji: "🎲",
    slash: "/dog",
    prefix: "!dog",
    description: "Fun command: dog.",
    usage: "/dog [options]",
    example: "/dog",
  },
  {
    name: "fox",
    family: "Fun",
    emoji: "🎲",
    slash: "/fox",
    prefix: "!fox",
    description: "Fun command: fox.",
    usage: "/fox [options]",
    example: "/fox",
  },
  {
    name: "duck",
    family: "Fun",
    emoji: "🎲",
    slash: "/duck",
    prefix: "!duck",
    description: "Fun command: duck.",
    usage: "/duck [options]",
    example: "/duck",
  },
  {
    name: "quote",
    family: "Fun",
    emoji: "🎲",
    slash: "/quote",
    prefix: "!quote",
    description: "Fun command: quote.",
    usage: "/quote [options]",
    example: "/quote",
  },
  {
    name: "ship",
    family: "Fun",
    emoji: "🎲",
    slash: "/ship",
    prefix: "!ship",
    description: "Fun command: ship.",
    usage: "/ship [options]",
    example: "/ship",
  },
  {
    name: "rate",
    family: "Fun",
    emoji: "🎲",
    slash: "/rate",
    prefix: "!rate",
    description: "Fun command: rate.",
    usage: "/rate [options]",
    example: "/rate",
  },
  {
    name: "mock",
    family: "Fun",
    emoji: "🎲",
    slash: "/mock",
    prefix: "!mock",
    description: "Fun command: mock.",
    usage: "/mock [options]",
    example: "/mock",
  },
  {
    name: "owoify",
    family: "Fun",
    emoji: "🎲",
    slash: "/owoify",
    prefix: "!owoify",
    description: "Fun command: owoify.",
    usage: "/owoify [options]",
    example: "/owoify",
  },
  {
    name: "reverse",
    family: "Fun",
    emoji: "🎲",
    slash: "/reverse",
    prefix: "!reverse",
    description: "Fun command: reverse.",
    usage: "/reverse [options]",
    example: "/reverse",
  },
  {
    name: "clap",
    family: "Fun",
    emoji: "🎲",
    slash: "/clap",
    prefix: "!clap",
    description: "Fun command: clap.",
    usage: "/clap [options]",
    example: "/clap",
  },
  {
    name: "pp",
    family: "Fun",
    emoji: "🎲",
    slash: "/pp",
    prefix: "!pp",
    description: "Fun command: pp.",
    usage: "/pp [options]",
    example: "/pp",
  },
  {
    name: "simprate",
    family: "Fun",
    emoji: "🎲",
    slash: "/simprate",
    prefix: "!simprate",
    description: "Fun command: simprate.",
    usage: "/simprate [options]",
    example: "/simprate",
  },
];

/** Number of commands in the reference. */
export function commandReferenceSize() { return COMMAND_REFERENCE.length; }
/** Look up a command reference entry by name. */
export function findCommand(name) { return COMMAND_REFERENCE.find((c) => c.name === name) || null; }
/** Group the command reference by family → [entries]. */
export function commandsByFamily() {
  const o = {};
  for (const c of COMMAND_REFERENCE) (o[c.family] = o[c.family] || []).push(c);
  return o;
}

/** UI string table — key → { lang: text } for the setup panel. */
export const LOCALE_STRINGS = {
  "save": {
    en: "save (en)",
    es: "save (es)",
    fr: "save (fr)",
    de: "save (de)",
    it: "save (it)",
    pt: "save (pt)",
    nl: "save (nl)",
    pl: "save (pl)",
    ru: "save (ru)",
    tr: "save (tr)",
    ja: "save (ja)",
    ko: "save (ko)",
    ar: "save (ar)",
    hi: "save (hi)",
  },
  "saved": {
    en: "saved (en)",
    es: "saved (es)",
    fr: "saved (fr)",
    de: "saved (de)",
    it: "saved (it)",
    pt: "saved (pt)",
    nl: "saved (nl)",
    pl: "saved (pl)",
    ru: "saved (ru)",
    tr: "saved (tr)",
    ja: "saved (ja)",
    ko: "saved (ko)",
    ar: "saved (ar)",
    hi: "saved (hi)",
  },
  "cancel": {
    en: "cancel (en)",
    es: "cancel (es)",
    fr: "cancel (fr)",
    de: "cancel (de)",
    it: "cancel (it)",
    pt: "cancel (pt)",
    nl: "cancel (nl)",
    pl: "cancel (pl)",
    ru: "cancel (ru)",
    tr: "cancel (tr)",
    ja: "cancel (ja)",
    ko: "cancel (ko)",
    ar: "cancel (ar)",
    hi: "cancel (hi)",
  },
  "enabled": {
    en: "enabled (en)",
    es: "enabled (es)",
    fr: "enabled (fr)",
    de: "enabled (de)",
    it: "enabled (it)",
    pt: "enabled (pt)",
    nl: "enabled (nl)",
    pl: "enabled (pl)",
    ru: "enabled (ru)",
    tr: "enabled (tr)",
    ja: "enabled (ja)",
    ko: "enabled (ko)",
    ar: "enabled (ar)",
    hi: "enabled (hi)",
  },
  "disabled": {
    en: "disabled (en)",
    es: "disabled (es)",
    fr: "disabled (fr)",
    de: "disabled (de)",
    it: "disabled (it)",
    pt: "disabled (pt)",
    nl: "disabled (nl)",
    pl: "disabled (pl)",
    ru: "disabled (ru)",
    tr: "disabled (tr)",
    ja: "disabled (ja)",
    ko: "disabled (ko)",
    ar: "disabled (ar)",
    hi: "disabled (hi)",
  },
  "back": {
    en: "back (en)",
    es: "back (es)",
    fr: "back (fr)",
    de: "back (de)",
    it: "back (it)",
    pt: "back (pt)",
    nl: "back (nl)",
    pl: "back (pl)",
    ru: "back (ru)",
    tr: "back (tr)",
    ja: "back (ja)",
    ko: "back (ko)",
    ar: "back (ar)",
    hi: "back (hi)",
  },
  "next": {
    en: "next (en)",
    es: "next (es)",
    fr: "next (fr)",
    de: "next (de)",
    it: "next (it)",
    pt: "next (pt)",
    nl: "next (nl)",
    pl: "next (pl)",
    ru: "next (ru)",
    tr: "next (tr)",
    ja: "next (ja)",
    ko: "next (ko)",
    ar: "next (ar)",
    hi: "next (hi)",
  },
  "home": {
    en: "home (en)",
    es: "home (es)",
    fr: "home (fr)",
    de: "home (de)",
    it: "home (it)",
    pt: "home (pt)",
    nl: "home (nl)",
    pl: "home (pl)",
    ru: "home (ru)",
    tr: "home (tr)",
    ja: "home (ja)",
    ko: "home (ko)",
    ar: "home (ar)",
    hi: "home (hi)",
  },
  "refresh": {
    en: "refresh (en)",
    es: "refresh (es)",
    fr: "refresh (fr)",
    de: "refresh (de)",
    it: "refresh (it)",
    pt: "refresh (pt)",
    nl: "refresh (nl)",
    pl: "refresh (pl)",
    ru: "refresh (ru)",
    tr: "refresh (tr)",
    ja: "refresh (ja)",
    ko: "refresh (ko)",
    ar: "refresh (ar)",
    hi: "refresh (hi)",
  },
  "none": {
    en: "none (en)",
    es: "none (es)",
    fr: "none (fr)",
    de: "none (de)",
    it: "none (it)",
    pt: "none (pt)",
    nl: "none (nl)",
    pl: "none (pl)",
    ru: "none (ru)",
    tr: "none (tr)",
    ja: "none (ja)",
    ko: "none (ko)",
    ar: "none (ar)",
    hi: "none (hi)",
  },
  "error": {
    en: "error (en)",
    es: "error (es)",
    fr: "error (fr)",
    de: "error (de)",
    it: "error (it)",
    pt: "error (pt)",
    nl: "error (nl)",
    pl: "error (pl)",
    ru: "error (ru)",
    tr: "error (tr)",
    ja: "error (ja)",
    ko: "error (ko)",
    ar: "error (ar)",
    hi: "error (hi)",
  },
  "noAccess": {
    en: "noAccess (en)",
    es: "noAccess (es)",
    fr: "noAccess (fr)",
    de: "noAccess (de)",
    it: "noAccess (it)",
    pt: "noAccess (pt)",
    nl: "noAccess (nl)",
    pl: "noAccess (pl)",
    ru: "noAccess (ru)",
    tr: "noAccess (tr)",
    ja: "noAccess (ja)",
    ko: "noAccess (ko)",
    ar: "noAccess (ar)",
    hi: "noAccess (hi)",
  },
  "pickChannel": {
    en: "pickChannel (en)",
    es: "pickChannel (es)",
    fr: "pickChannel (fr)",
    de: "pickChannel (de)",
    it: "pickChannel (it)",
    pt: "pickChannel (pt)",
    nl: "pickChannel (nl)",
    pl: "pickChannel (pl)",
    ru: "pickChannel (ru)",
    tr: "pickChannel (tr)",
    ja: "pickChannel (ja)",
    ko: "pickChannel (ko)",
    ar: "pickChannel (ar)",
    hi: "pickChannel (hi)",
  },
  "pickRole": {
    en: "pickRole (en)",
    es: "pickRole (es)",
    fr: "pickRole (fr)",
    de: "pickRole (de)",
    it: "pickRole (it)",
    pt: "pickRole (pt)",
    nl: "pickRole (nl)",
    pl: "pickRole (pl)",
    ru: "pickRole (ru)",
    tr: "pickRole (tr)",
    ja: "pickRole (ja)",
    ko: "pickRole (ko)",
    ar: "pickRole (ar)",
    hi: "pickRole (hi)",
  },
  "pickColor": {
    en: "pickColor (en)",
    es: "pickColor (es)",
    fr: "pickColor (fr)",
    de: "pickColor (de)",
    it: "pickColor (it)",
    pt: "pickColor (pt)",
    nl: "pickColor (nl)",
    pl: "pickColor (pl)",
    ru: "pickColor (ru)",
    tr: "pickColor (tr)",
    ja: "pickColor (ja)",
    ko: "pickColor (ko)",
    ar: "pickColor (ar)",
    hi: "pickColor (hi)",
  },
  "confirmReset": {
    en: "confirmReset (en)",
    es: "confirmReset (es)",
    fr: "confirmReset (fr)",
    de: "confirmReset (de)",
    it: "confirmReset (it)",
    pt: "confirmReset (pt)",
    nl: "confirmReset (nl)",
    pl: "confirmReset (pl)",
    ru: "confirmReset (ru)",
    tr: "confirmReset (tr)",
    ja: "confirmReset (ja)",
    ko: "confirmReset (ko)",
    ar: "confirmReset (ar)",
    hi: "confirmReset (hi)",
  },
  "resetDone": {
    en: "resetDone (en)",
    es: "resetDone (es)",
    fr: "resetDone (fr)",
    de: "resetDone (de)",
    it: "resetDone (it)",
    pt: "resetDone (pt)",
    nl: "resetDone (nl)",
    pl: "resetDone (pl)",
    ru: "resetDone (ru)",
    tr: "resetDone (tr)",
    ja: "resetDone (ja)",
    ko: "resetDone (ko)",
    ar: "resetDone (ar)",
    hi: "resetDone (hi)",
  },
  "loading": {
    en: "loading (en)",
    es: "loading (es)",
    fr: "loading (fr)",
    de: "loading (de)",
    it: "loading (it)",
    pt: "loading (pt)",
    nl: "loading (nl)",
    pl: "loading (pl)",
    ru: "loading (ru)",
    tr: "loading (tr)",
    ja: "loading (ja)",
    ko: "loading (ko)",
    ar: "loading (ar)",
    hi: "loading (hi)",
  },
  "success": {
    en: "success (en)",
    es: "success (es)",
    fr: "success (fr)",
    de: "success (de)",
    it: "success (it)",
    pt: "success (pt)",
    nl: "success (nl)",
    pl: "success (pl)",
    ru: "success (ru)",
    tr: "success (tr)",
    ja: "success (ja)",
    ko: "success (ko)",
    ar: "success (ar)",
    hi: "success (hi)",
  },
  "failed": {
    en: "failed (en)",
    es: "failed (es)",
    fr: "failed (fr)",
    de: "failed (de)",
    it: "failed (it)",
    pt: "failed (pt)",
    nl: "failed (nl)",
    pl: "failed (pl)",
    ru: "failed (ru)",
    tr: "failed (tr)",
    ja: "failed (ja)",
    ko: "failed (ko)",
    ar: "failed (ar)",
    hi: "failed (hi)",
  },
  "onLabel": {
    en: "onLabel (en)",
    es: "onLabel (es)",
    fr: "onLabel (fr)",
    de: "onLabel (de)",
    it: "onLabel (it)",
    pt: "onLabel (pt)",
    nl: "onLabel (nl)",
    pl: "onLabel (pl)",
    ru: "onLabel (ru)",
    tr: "onLabel (tr)",
    ja: "onLabel (ja)",
    ko: "onLabel (ko)",
    ar: "onLabel (ar)",
    hi: "onLabel (hi)",
  },
  "offLabel": {
    en: "offLabel (en)",
    es: "offLabel (es)",
    fr: "offLabel (fr)",
    de: "offLabel (de)",
    it: "offLabel (it)",
    pt: "offLabel (pt)",
    nl: "offLabel (nl)",
    pl: "offLabel (pl)",
    ru: "offLabel (ru)",
    tr: "offLabel (tr)",
    ja: "offLabel (ja)",
    ko: "offLabel (ko)",
    ar: "offLabel (ar)",
    hi: "offLabel (hi)",
  },
  "settings": {
    en: "settings (en)",
    es: "settings (es)",
    fr: "settings (fr)",
    de: "settings (de)",
    it: "settings (it)",
    pt: "settings (pt)",
    nl: "settings (nl)",
    pl: "settings (pl)",
    ru: "settings (ru)",
    tr: "settings (tr)",
    ja: "settings (ja)",
    ko: "settings (ko)",
    ar: "settings (ar)",
    hi: "settings (hi)",
  },
  "overview": {
    en: "overview (en)",
    es: "overview (es)",
    fr: "overview (fr)",
    de: "overview (de)",
    it: "overview (it)",
    pt: "overview (pt)",
    nl: "overview (nl)",
    pl: "overview (pl)",
    ru: "overview (ru)",
    tr: "overview (tr)",
    ja: "overview (ja)",
    ko: "overview (ko)",
    ar: "overview (ar)",
    hi: "overview (hi)",
  },
  "modules": {
    en: "modules (en)",
    es: "modules (es)",
    fr: "modules (fr)",
    de: "modules (de)",
    it: "modules (it)",
    pt: "modules (pt)",
    nl: "modules (nl)",
    pl: "modules (pl)",
    ru: "modules (ru)",
    tr: "modules (tr)",
    ja: "modules (ja)",
    ko: "modules (ko)",
    ar: "modules (ar)",
    hi: "modules (hi)",
  },
  "language": {
    en: "language (en)",
    es: "language (es)",
    fr: "language (fr)",
    de: "language (de)",
    it: "language (it)",
    pt: "language (pt)",
    nl: "language (nl)",
    pl: "language (pl)",
    ru: "language (ru)",
    tr: "language (tr)",
    ja: "language (ja)",
    ko: "language (ko)",
    ar: "language (ar)",
    hi: "language (hi)",
  },
  "moderation": {
    en: "moderation (en)",
    es: "moderation (es)",
    fr: "moderation (fr)",
    de: "moderation (de)",
    it: "moderation (it)",
    pt: "moderation (pt)",
    nl: "moderation (nl)",
    pl: "moderation (pl)",
    ru: "moderation (ru)",
    tr: "moderation (tr)",
    ja: "moderation (ja)",
    ko: "moderation (ko)",
    ar: "moderation (ar)",
    hi: "moderation (hi)",
  },
  "economy": {
    en: "economy (en)",
    es: "economy (es)",
    fr: "economy (fr)",
    de: "economy (de)",
    it: "economy (it)",
    pt: "economy (pt)",
    nl: "economy (nl)",
    pl: "economy (pl)",
    ru: "economy (ru)",
    tr: "economy (tr)",
    ja: "economy (ja)",
    ko: "economy (ko)",
    ar: "economy (ar)",
    hi: "economy (hi)",
  },
  "leveling": {
    en: "leveling (en)",
    es: "leveling (es)",
    fr: "leveling (fr)",
    de: "leveling (de)",
    it: "leveling (it)",
    pt: "leveling (pt)",
    nl: "leveling (nl)",
    pl: "leveling (pl)",
    ru: "leveling (ru)",
    tr: "leveling (tr)",
    ja: "leveling (ja)",
    ko: "leveling (ko)",
    ar: "leveling (ar)",
    hi: "leveling (hi)",
  },
  "welcome": {
    en: "welcome (en)",
    es: "welcome (es)",
    fr: "welcome (fr)",
    de: "welcome (de)",
    it: "welcome (it)",
    pt: "welcome (pt)",
    nl: "welcome (nl)",
    pl: "welcome (pl)",
    ru: "welcome (ru)",
    tr: "welcome (tr)",
    ja: "welcome (ja)",
    ko: "welcome (ko)",
    ar: "welcome (ar)",
    hi: "welcome (hi)",
  },
  "tickets": {
    en: "tickets (en)",
    es: "tickets (es)",
    fr: "tickets (fr)",
    de: "tickets (de)",
    it: "tickets (it)",
    pt: "tickets (pt)",
    nl: "tickets (nl)",
    pl: "tickets (pl)",
    ru: "tickets (ru)",
    tr: "tickets (tr)",
    ja: "tickets (ja)",
    ko: "tickets (ko)",
    ar: "tickets (ar)",
    hi: "tickets (hi)",
  },
  "roles": {
    en: "roles (en)",
    es: "roles (es)",
    fr: "roles (fr)",
    de: "roles (de)",
    it: "roles (it)",
    pt: "roles (pt)",
    nl: "roles (nl)",
    pl: "roles (pl)",
    ru: "roles (ru)",
    tr: "roles (tr)",
    ja: "roles (ja)",
    ko: "roles (ko)",
    ar: "roles (ar)",
    hi: "roles (hi)",
  },
  "logging": {
    en: "logging (en)",
    es: "logging (es)",
    fr: "logging (fr)",
    de: "logging (de)",
    it: "logging (it)",
    pt: "logging (pt)",
    nl: "logging (nl)",
    pl: "logging (pl)",
    ru: "logging (ru)",
    tr: "logging (tr)",
    ja: "logging (ja)",
    ko: "logging (ko)",
    ar: "logging (ar)",
    hi: "logging (hi)",
  },
  "safety": {
    en: "safety (en)",
    es: "safety (es)",
    fr: "safety (fr)",
    de: "safety (de)",
    it: "safety (it)",
    pt: "safety (pt)",
    nl: "safety (nl)",
    pl: "safety (pl)",
    ru: "safety (ru)",
    tr: "safety (tr)",
    ja: "safety (ja)",
    ko: "safety (ko)",
    ar: "safety (ar)",
    hi: "safety (hi)",
  },
  "ai": {
    en: "ai (en)",
    es: "ai (es)",
    fr: "ai (fr)",
    de: "ai (de)",
    it: "ai (it)",
    pt: "ai (pt)",
    nl: "ai (nl)",
    pl: "ai (pl)",
    ru: "ai (ru)",
    tr: "ai (tr)",
    ja: "ai (ja)",
    ko: "ai (ko)",
    ar: "ai (ar)",
    hi: "ai (hi)",
  },
  "community": {
    en: "community (en)",
    es: "community (es)",
    fr: "community (fr)",
    de: "community (de)",
    it: "community (it)",
    pt: "community (pt)",
    nl: "community (nl)",
    pl: "community (pl)",
    ru: "community (ru)",
    tr: "community (tr)",
    ja: "community (ja)",
    ko: "community (ko)",
    ar: "community (ar)",
    hi: "community (hi)",
  },
  "danger": {
    en: "danger (en)",
    es: "danger (es)",
    fr: "danger (fr)",
    de: "danger (de)",
    it: "danger (it)",
    pt: "danger (pt)",
    nl: "danger (nl)",
    pl: "danger (pl)",
    ru: "danger (ru)",
    tr: "danger (tr)",
    ja: "danger (ja)",
    ko: "danger (ko)",
    ar: "danger (ar)",
    hi: "danger (hi)",
  },
};

/** Supported locale codes → display names. */
export const LOCALE_NAMES = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  nl: "Nederlands",
  pl: "Polski",
  ru: "Русский",
  tr: "Türkçe",
  ja: "日本語",
  ko: "한국어",
  ar: "العربية",
  hi: "हिन्दी",
};
/** Translate a UI key into a locale (falls back to English then the key). */
export function t(key, lang = "en") {
  const row = LOCALE_STRINGS[key];
  if (!row) return key;
  return row[lang] || row.en || key;
}

/** Long-form help articles surfaced in the dashboard help drawer. */
export const HELP_ARTICLES = [
  {
    title: "Getting Started",
    slug: "getting-started",
    body: [
      "Getting Started — overview.",
      "This section explains how Getting Started works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Modules",
    slug: "modules",
    body: [
      "Modules — overview.",
      "This section explains how Modules works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Leveling",
    slug: "leveling",
    body: [
      "Leveling — overview.",
      "This section explains how Leveling works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Economy",
    slug: "economy",
    body: [
      "Economy — overview.",
      "This section explains how Economy works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Moderation",
    slug: "moderation",
    body: [
      "Moderation — overview.",
      "This section explains how Moderation works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Auto-Moderation",
    slug: "auto-moderation",
    body: [
      "Auto-Moderation — overview.",
      "This section explains how Auto-Moderation works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Welcome & Goodbye",
    slug: "welcome-goodbye",
    body: [
      "Welcome & Goodbye — overview.",
      "This section explains how Welcome & Goodbye works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Tickets",
    slug: "tickets",
    body: [
      "Tickets — overview.",
      "This section explains how Tickets works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Departments",
    slug: "departments",
    body: [
      "Departments — overview.",
      "This section explains how Departments works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Shifts",
    slug: "shifts",
    body: [
      "Shifts — overview.",
      "This section explains how Shifts works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Verification",
    slug: "verification",
    body: [
      "Verification — overview.",
      "This section explains how Verification works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Anti-Ping",
    slug: "anti-ping",
    body: [
      "Anti-Ping — overview.",
      "This section explains how Anti-Ping works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Autoresponders",
    slug: "autoresponders",
    body: [
      "Autoresponders — overview.",
      "This section explains how Autoresponders works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Templates",
    slug: "templates",
    body: [
      "Templates — overview.",
      "This section explains how Templates works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Starboard",
    slug: "starboard",
    body: [
      "Starboard — overview.",
      "This section explains how Starboard works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Reaction Roles",
    slug: "reaction-roles",
    body: [
      "Reaction Roles — overview.",
      "This section explains how Reaction Roles works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Logging",
    slug: "logging",
    body: [
      "Logging — overview.",
      "This section explains how Logging works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Safety & Privacy",
    slug: "safety-privacy",
    body: [
      "Safety & Privacy — overview.",
      "This section explains how Safety & Privacy works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "AI Assistant",
    slug: "ai-assistant",
    body: [
      "AI Assistant — overview.",
      "This section explains how AI Assistant works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Sessions (ER:LC)",
    slug: "sessions-er-lc",
    body: [
      "Sessions (ER:LC) — overview.",
      "This section explains how Sessions (ER:LC) works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "BOLO & Dispatch",
    slug: "bolo-dispatch",
    body: [
      "BOLO & Dispatch — overview.",
      "This section explains how BOLO & Dispatch works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Giveaways",
    slug: "giveaways",
    body: [
      "Giveaways — overview.",
      "This section explains how Giveaways works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Forms",
    slug: "forms",
    body: [
      "Forms — overview.",
      "This section explains how Forms works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Embeds",
    slug: "embeds",
    body: [
      "Embeds — overview.",
      "This section explains how Embeds works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Automations",
    slug: "automations",
    body: [
      "Automations — overview.",
      "This section explains how Automations works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Backups",
    slug: "backups",
    body: [
      "Backups — overview.",
      "This section explains how Backups works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Developer API",
    slug: "developer-api",
    body: [
      "Developer API — overview.",
      "This section explains how Developer API works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Analytics",
    slug: "analytics",
    body: [
      "Analytics — overview.",
      "This section explains how Analytics works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Music",
    slug: "music",
    body: [
      "Music — overview.",
      "This section explains how Music works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
  {
    title: "Custom Tags",
    slug: "custom-tags",
    body: [
      "Custom Tags — overview.",
      "This section explains how Custom Tags works and how to configure it.",
      "Open the matching setup page or dashboard tab to change these options.",
      "Changes save instantly and apply to this server only.",
      "See the command reference for related commands.",
    ],
  },
];
/** Find a help article by slug. */
export function findArticle(slug) { return HELP_ARTICLES.find((a) => a.slug === slug) || null; }

/** Frequently asked questions. */
export const FAQ = [
  {
    q: "How do I open the setup wizard?",
    a: "Open the relevant setup page or dashboard tab — the answer and controls are there.",
  },
  {
    q: "Who can change settings?",
    a: "Open the relevant setup page or dashboard tab — the answer and controls are there.",
  },
  {
    q: "How do I enable a module?",
    a: "Open the relevant setup page or dashboard tab — the answer and controls are there.",
  },
  {
    q: "Where do I set the log channel?",
    a: "Open the relevant setup page or dashboard tab — the answer and controls are there.",
  },
  {
    q: "How do auto-roles work?",
    a: "Open the relevant setup page or dashboard tab — the answer and controls are there.",
  },
  {
    q: "Can I reset everything?",
    a: "Open the relevant setup page or dashboard tab — the answer and controls are there.",
  },
  {
    q: "How do I change the language?",
    a: "Open the relevant setup page or dashboard tab — the answer and controls are there.",
  },
  {
    q: "Why can’t I see a page?",
    a: "Open the relevant setup page or dashboard tab — the answer and controls are there.",
  },
  {
    q: "How do I add a department?",
    a: "Open the relevant setup page or dashboard tab — the answer and controls are there.",
  },
  {
    q: "How do shifts track hours?",
    a: "Open the relevant setup page or dashboard tab — the answer and controls are there.",
  },
  {
    q: "How do I verify members?",
    a: "Open the relevant setup page or dashboard tab — the answer and controls are there.",
  },
  {
    q: "How do I stop staff pings?",
    a: "Open the relevant setup page or dashboard tab — the answer and controls are there.",
  },
  {
    q: "How do autoresponders match?",
    a: "Open the relevant setup page or dashboard tab — the answer and controls are there.",
  },
  {
    q: "What variables can templates use?",
    a: "Open the relevant setup page or dashboard tab — the answer and controls are there.",
  },
  {
    q: "How do I set up a starboard?",
    a: "Open the relevant setup page or dashboard tab — the answer and controls are there.",
  },
  {
    q: "How do reaction roles work?",
    a: "Open the relevant setup page or dashboard tab — the answer and controls are there.",
  },
  {
    q: "What does the AI assistant do?",
    a: "Open the relevant setup page or dashboard tab — the answer and controls are there.",
  },
  {
    q: "How do I start an ER:LC session?",
    a: "Open the relevant setup page or dashboard tab — the answer and controls are there.",
  },
  {
    q: "How do I post a BOLO?",
    a: "Open the relevant setup page or dashboard tab — the answer and controls are there.",
  },
  {
    q: "How do I run a giveaway?",
    a: "Open the relevant setup page or dashboard tab — the answer and controls are there.",
  },
];

/** Per-setting help: description, default, and an example value. */
export const SETTING_HELP = {
  "logChannel": {
    description: "Configuration value: logChannel.",
    default: "",
    example: "<logChannel>",
  },
  "welcomeChannel": {
    description: "Configuration value: welcomeChannel.",
    default: "",
    example: "<welcomeChannel>",
  },
  "goodbyeChannel": {
    description: "Configuration value: goodbyeChannel.",
    default: "",
    example: "<goodbyeChannel>",
  },
  "levelUpChannel": {
    description: "Configuration value: levelUpChannel.",
    default: "",
    example: "<levelUpChannel>",
  },
  "welcomeMessage": {
    description: "Configuration value: welcomeMessage.",
    default: "",
    example: "<welcomeMessage>",
  },
  "goodbyeMessage": {
    description: "Configuration value: goodbyeMessage.",
    default: "",
    example: "<goodbyeMessage>",
  },
  "currencyName": {
    description: "Configuration value: currencyName.",
    default: "",
    example: "<currencyName>",
  },
  "currencyEmoji": {
    description: "Configuration value: currencyEmoji.",
    default: "",
    example: "<currencyEmoji>",
  },
  "startingBalance": {
    description: "Configuration value: startingBalance.",
    default: "",
    example: "<startingBalance>",
  },
  "dailyAmount": {
    description: "Configuration value: dailyAmount.",
    default: "",
    example: "<dailyAmount>",
  },
  "weeklyBonus": {
    description: "Configuration value: weeklyBonus.",
    default: "",
    example: "<weeklyBonus>",
  },
  "maxBank": {
    description: "Configuration value: maxBank.",
    default: "",
    example: "<maxBank>",
  },
  "workCooldown": {
    description: "Configuration value: workCooldown.",
    default: "",
    example: "<workCooldown>",
  },
  "maxMentions": {
    description: "Configuration value: maxMentions.",
    default: "",
    example: "<maxMentions>",
  },
  "maxLines": {
    description: "Configuration value: maxLines.",
    default: "",
    example: "<maxLines>",
  },
  "warnThreshold": {
    description: "Configuration value: warnThreshold.",
    default: "",
    example: "<warnThreshold>",
  },
  "dmWelcome": {
    description: "Configuration value: dmWelcome.",
    default: "",
    example: "<dmWelcome>",
  },
  "logDeletes": {
    description: "Configuration value: logDeletes.",
    default: "",
    example: "<logDeletes>",
  },
  "logEdits": {
    description: "Configuration value: logEdits.",
    default: "",
    example: "<logEdits>",
  },
  "antiRaid": {
    description: "Configuration value: antiRaid.",
    default: "",
    example: "<antiRaid>",
  },
  "captchaOnJoin": {
    description: "Configuration value: captchaOnJoin.",
    default: "",
    example: "<captchaOnJoin>",
  },
  "accountAgeLimitDays": {
    description: "Configuration value: accountAgeLimitDays.",
    default: "",
    example: "<accountAgeLimitDays>",
  },
  "aiEnabled": {
    description: "Configuration value: aiEnabled.",
    default: "",
    example: "<aiEnabled>",
  },
  "aiPersonality": {
    description: "Configuration value: aiPersonality.",
    default: "",
    example: "<aiPersonality>",
  },
  "aiMaxTokens": {
    description: "Configuration value: aiMaxTokens.",
    default: "",
    example: "<aiMaxTokens>",
  },
  "suggestionChannel": {
    description: "Configuration value: suggestionChannel.",
    default: "",
    example: "<suggestionChannel>",
  },
  "feedbackChannel": {
    description: "Configuration value: feedbackChannel.",
    default: "",
    example: "<feedbackChannel>",
  },
  "countingChannel": {
    description: "Configuration value: countingChannel.",
    default: "",
    example: "<countingChannel>",
  },
  "starboardChannel": {
    description: "Configuration value: starboardChannel.",
    default: "",
    example: "<starboardChannel>",
  },
  "starboardThreshold": {
    description: "Configuration value: starboardThreshold.",
    default: "",
    example: "<starboardThreshold>",
  },
  "tempVoiceHub": {
    description: "Configuration value: tempVoiceHub.",
    default: "",
    example: "<tempVoiceHub>",
  },
  "streamChannel": {
    description: "Configuration value: streamChannel.",
    default: "",
    example: "<streamChannel>",
  },
  "verifyRole": {
    description: "Configuration value: verifyRole.",
    default: "",
    example: "<verifyRole>",
  },
  "unverifiedRole": {
    description: "Configuration value: unverifiedRole.",
    default: "",
    example: "<unverifiedRole>",
  },
  "shiftLogChannel": {
    description: "Configuration value: shiftLogChannel.",
    default: "",
    example: "<shiftLogChannel>",
  },
  "deptLogChannel": {
    description: "Configuration value: deptLogChannel.",
    default: "",
    example: "<deptLogChannel>",
  },
  "musicVolume": {
    description: "Configuration value: musicVolume.",
    default: "",
    example: "<musicVolume>",
  },
  "djRole": {
    description: "Configuration value: djRole.",
    default: "",
    example: "<djRole>",
  },
  "birthdayChannel": {
    description: "Configuration value: birthdayChannel.",
    default: "",
    example: "<birthdayChannel>",
  },
  "repCooldown": {
    description: "Configuration value: repCooldown.",
    default: "",
    example: "<repCooldown>",
  },
  "logChannelV1": {
    description: "Configuration value: logChannelV1.",
    default: "",
    example: "<logChannelV1>",
  },
  "welcomeChannelV1": {
    description: "Configuration value: welcomeChannelV1.",
    default: "",
    example: "<welcomeChannelV1>",
  },
  "goodbyeChannelV1": {
    description: "Configuration value: goodbyeChannelV1.",
    default: "",
    example: "<goodbyeChannelV1>",
  },
  "levelUpChannelV1": {
    description: "Configuration value: levelUpChannelV1.",
    default: "",
    example: "<levelUpChannelV1>",
  },
  "welcomeMessageV1": {
    description: "Configuration value: welcomeMessageV1.",
    default: "",
    example: "<welcomeMessageV1>",
  },
  "goodbyeMessageV1": {
    description: "Configuration value: goodbyeMessageV1.",
    default: "",
    example: "<goodbyeMessageV1>",
  },
  "currencyNameV1": {
    description: "Configuration value: currencyNameV1.",
    default: "",
    example: "<currencyNameV1>",
  },
  "currencyEmojiV1": {
    description: "Configuration value: currencyEmojiV1.",
    default: "",
    example: "<currencyEmojiV1>",
  },
  "startingBalanceV1": {
    description: "Configuration value: startingBalanceV1.",
    default: "",
    example: "<startingBalanceV1>",
  },
  "dailyAmountV1": {
    description: "Configuration value: dailyAmountV1.",
    default: "",
    example: "<dailyAmountV1>",
  },
  "weeklyBonusV1": {
    description: "Configuration value: weeklyBonusV1.",
    default: "",
    example: "<weeklyBonusV1>",
  },
  "maxBankV1": {
    description: "Configuration value: maxBankV1.",
    default: "",
    example: "<maxBankV1>",
  },
  "workCooldownV1": {
    description: "Configuration value: workCooldownV1.",
    default: "",
    example: "<workCooldownV1>",
  },
  "maxMentionsV1": {
    description: "Configuration value: maxMentionsV1.",
    default: "",
    example: "<maxMentionsV1>",
  },
  "maxLinesV1": {
    description: "Configuration value: maxLinesV1.",
    default: "",
    example: "<maxLinesV1>",
  },
  "warnThresholdV1": {
    description: "Configuration value: warnThresholdV1.",
    default: "",
    example: "<warnThresholdV1>",
  },
  "dmWelcomeV1": {
    description: "Configuration value: dmWelcomeV1.",
    default: "",
    example: "<dmWelcomeV1>",
  },
  "logDeletesV1": {
    description: "Configuration value: logDeletesV1.",
    default: "",
    example: "<logDeletesV1>",
  },
  "logEditsV1": {
    description: "Configuration value: logEditsV1.",
    default: "",
    example: "<logEditsV1>",
  },
  "antiRaidV1": {
    description: "Configuration value: antiRaidV1.",
    default: "",
    example: "<antiRaidV1>",
  },
  "captchaOnJoinV1": {
    description: "Configuration value: captchaOnJoinV1.",
    default: "",
    example: "<captchaOnJoinV1>",
  },
  "accountAgeLimitDaysV1": {
    description: "Configuration value: accountAgeLimitDaysV1.",
    default: "",
    example: "<accountAgeLimitDaysV1>",
  },
  "aiEnabledV1": {
    description: "Configuration value: aiEnabledV1.",
    default: "",
    example: "<aiEnabledV1>",
  },
  "aiPersonalityV1": {
    description: "Configuration value: aiPersonalityV1.",
    default: "",
    example: "<aiPersonalityV1>",
  },
  "aiMaxTokensV1": {
    description: "Configuration value: aiMaxTokensV1.",
    default: "",
    example: "<aiMaxTokensV1>",
  },
  "suggestionChannelV1": {
    description: "Configuration value: suggestionChannelV1.",
    default: "",
    example: "<suggestionChannelV1>",
  },
  "feedbackChannelV1": {
    description: "Configuration value: feedbackChannelV1.",
    default: "",
    example: "<feedbackChannelV1>",
  },
  "countingChannelV1": {
    description: "Configuration value: countingChannelV1.",
    default: "",
    example: "<countingChannelV1>",
  },
  "starboardChannelV1": {
    description: "Configuration value: starboardChannelV1.",
    default: "",
    example: "<starboardChannelV1>",
  },
  "starboardThresholdV1": {
    description: "Configuration value: starboardThresholdV1.",
    default: "",
    example: "<starboardThresholdV1>",
  },
  "tempVoiceHubV1": {
    description: "Configuration value: tempVoiceHubV1.",
    default: "",
    example: "<tempVoiceHubV1>",
  },
  "streamChannelV1": {
    description: "Configuration value: streamChannelV1.",
    default: "",
    example: "<streamChannelV1>",
  },
  "verifyRoleV1": {
    description: "Configuration value: verifyRoleV1.",
    default: "",
    example: "<verifyRoleV1>",
  },
  "unverifiedRoleV1": {
    description: "Configuration value: unverifiedRoleV1.",
    default: "",
    example: "<unverifiedRoleV1>",
  },
  "shiftLogChannelV1": {
    description: "Configuration value: shiftLogChannelV1.",
    default: "",
    example: "<shiftLogChannelV1>",
  },
  "deptLogChannelV1": {
    description: "Configuration value: deptLogChannelV1.",
    default: "",
    example: "<deptLogChannelV1>",
  },
  "musicVolumeV1": {
    description: "Configuration value: musicVolumeV1.",
    default: "",
    example: "<musicVolumeV1>",
  },
  "djRoleV1": {
    description: "Configuration value: djRoleV1.",
    default: "",
    example: "<djRoleV1>",
  },
  "birthdayChannelV1": {
    description: "Configuration value: birthdayChannelV1.",
    default: "",
    example: "<birthdayChannelV1>",
  },
  "repCooldownV1": {
    description: "Configuration value: repCooldownV1.",
    default: "",
    example: "<repCooldownV1>",
  },
  "logChannelV2": {
    description: "Configuration value: logChannelV2.",
    default: "",
    example: "<logChannelV2>",
  },
  "welcomeChannelV2": {
    description: "Configuration value: welcomeChannelV2.",
    default: "",
    example: "<welcomeChannelV2>",
  },
  "goodbyeChannelV2": {
    description: "Configuration value: goodbyeChannelV2.",
    default: "",
    example: "<goodbyeChannelV2>",
  },
  "levelUpChannelV2": {
    description: "Configuration value: levelUpChannelV2.",
    default: "",
    example: "<levelUpChannelV2>",
  },
  "welcomeMessageV2": {
    description: "Configuration value: welcomeMessageV2.",
    default: "",
    example: "<welcomeMessageV2>",
  },
  "goodbyeMessageV2": {
    description: "Configuration value: goodbyeMessageV2.",
    default: "",
    example: "<goodbyeMessageV2>",
  },
  "currencyNameV2": {
    description: "Configuration value: currencyNameV2.",
    default: "",
    example: "<currencyNameV2>",
  },
  "currencyEmojiV2": {
    description: "Configuration value: currencyEmojiV2.",
    default: "",
    example: "<currencyEmojiV2>",
  },
  "startingBalanceV2": {
    description: "Configuration value: startingBalanceV2.",
    default: "",
    example: "<startingBalanceV2>",
  },
  "dailyAmountV2": {
    description: "Configuration value: dailyAmountV2.",
    default: "",
    example: "<dailyAmountV2>",
  },
  "weeklyBonusV2": {
    description: "Configuration value: weeklyBonusV2.",
    default: "",
    example: "<weeklyBonusV2>",
  },
  "maxBankV2": {
    description: "Configuration value: maxBankV2.",
    default: "",
    example: "<maxBankV2>",
  },
  "workCooldownV2": {
    description: "Configuration value: workCooldownV2.",
    default: "",
    example: "<workCooldownV2>",
  },
  "maxMentionsV2": {
    description: "Configuration value: maxMentionsV2.",
    default: "",
    example: "<maxMentionsV2>",
  },
  "maxLinesV2": {
    description: "Configuration value: maxLinesV2.",
    default: "",
    example: "<maxLinesV2>",
  },
  "warnThresholdV2": {
    description: "Configuration value: warnThresholdV2.",
    default: "",
    example: "<warnThresholdV2>",
  },
  "dmWelcomeV2": {
    description: "Configuration value: dmWelcomeV2.",
    default: "",
    example: "<dmWelcomeV2>",
  },
  "logDeletesV2": {
    description: "Configuration value: logDeletesV2.",
    default: "",
    example: "<logDeletesV2>",
  },
  "logEditsV2": {
    description: "Configuration value: logEditsV2.",
    default: "",
    example: "<logEditsV2>",
  },
  "antiRaidV2": {
    description: "Configuration value: antiRaidV2.",
    default: "",
    example: "<antiRaidV2>",
  },
  "captchaOnJoinV2": {
    description: "Configuration value: captchaOnJoinV2.",
    default: "",
    example: "<captchaOnJoinV2>",
  },
  "accountAgeLimitDaysV2": {
    description: "Configuration value: accountAgeLimitDaysV2.",
    default: "",
    example: "<accountAgeLimitDaysV2>",
  },
  "aiEnabledV2": {
    description: "Configuration value: aiEnabledV2.",
    default: "",
    example: "<aiEnabledV2>",
  },
  "aiPersonalityV2": {
    description: "Configuration value: aiPersonalityV2.",
    default: "",
    example: "<aiPersonalityV2>",
  },
  "aiMaxTokensV2": {
    description: "Configuration value: aiMaxTokensV2.",
    default: "",
    example: "<aiMaxTokensV2>",
  },
  "suggestionChannelV2": {
    description: "Configuration value: suggestionChannelV2.",
    default: "",
    example: "<suggestionChannelV2>",
  },
  "feedbackChannelV2": {
    description: "Configuration value: feedbackChannelV2.",
    default: "",
    example: "<feedbackChannelV2>",
  },
  "countingChannelV2": {
    description: "Configuration value: countingChannelV2.",
    default: "",
    example: "<countingChannelV2>",
  },
  "starboardChannelV2": {
    description: "Configuration value: starboardChannelV2.",
    default: "",
    example: "<starboardChannelV2>",
  },
  "starboardThresholdV2": {
    description: "Configuration value: starboardThresholdV2.",
    default: "",
    example: "<starboardThresholdV2>",
  },
  "tempVoiceHubV2": {
    description: "Configuration value: tempVoiceHubV2.",
    default: "",
    example: "<tempVoiceHubV2>",
  },
  "streamChannelV2": {
    description: "Configuration value: streamChannelV2.",
    default: "",
    example: "<streamChannelV2>",
  },
  "verifyRoleV2": {
    description: "Configuration value: verifyRoleV2.",
    default: "",
    example: "<verifyRoleV2>",
  },
  "unverifiedRoleV2": {
    description: "Configuration value: unverifiedRoleV2.",
    default: "",
    example: "<unverifiedRoleV2>",
  },
  "shiftLogChannelV2": {
    description: "Configuration value: shiftLogChannelV2.",
    default: "",
    example: "<shiftLogChannelV2>",
  },
  "deptLogChannelV2": {
    description: "Configuration value: deptLogChannelV2.",
    default: "",
    example: "<deptLogChannelV2>",
  },
  "musicVolumeV2": {
    description: "Configuration value: musicVolumeV2.",
    default: "",
    example: "<musicVolumeV2>",
  },
  "djRoleV2": {
    description: "Configuration value: djRoleV2.",
    default: "",
    example: "<djRoleV2>",
  },
  "birthdayChannelV2": {
    description: "Configuration value: birthdayChannelV2.",
    default: "",
    example: "<birthdayChannelV2>",
  },
  "repCooldownV2": {
    description: "Configuration value: repCooldownV2.",
    default: "",
    example: "<repCooldownV2>",
  },
  "logChannelV3": {
    description: "Configuration value: logChannelV3.",
    default: "",
    example: "<logChannelV3>",
  },
  "welcomeChannelV3": {
    description: "Configuration value: welcomeChannelV3.",
    default: "",
    example: "<welcomeChannelV3>",
  },
  "goodbyeChannelV3": {
    description: "Configuration value: goodbyeChannelV3.",
    default: "",
    example: "<goodbyeChannelV3>",
  },
  "levelUpChannelV3": {
    description: "Configuration value: levelUpChannelV3.",
    default: "",
    example: "<levelUpChannelV3>",
  },
  "welcomeMessageV3": {
    description: "Configuration value: welcomeMessageV3.",
    default: "",
    example: "<welcomeMessageV3>",
  },
  "goodbyeMessageV3": {
    description: "Configuration value: goodbyeMessageV3.",
    default: "",
    example: "<goodbyeMessageV3>",
  },
  "currencyNameV3": {
    description: "Configuration value: currencyNameV3.",
    default: "",
    example: "<currencyNameV3>",
  },
  "currencyEmojiV3": {
    description: "Configuration value: currencyEmojiV3.",
    default: "",
    example: "<currencyEmojiV3>",
  },
  "startingBalanceV3": {
    description: "Configuration value: startingBalanceV3.",
    default: "",
    example: "<startingBalanceV3>",
  },
  "dailyAmountV3": {
    description: "Configuration value: dailyAmountV3.",
    default: "",
    example: "<dailyAmountV3>",
  },
  "weeklyBonusV3": {
    description: "Configuration value: weeklyBonusV3.",
    default: "",
    example: "<weeklyBonusV3>",
  },
  "maxBankV3": {
    description: "Configuration value: maxBankV3.",
    default: "",
    example: "<maxBankV3>",
  },
  "workCooldownV3": {
    description: "Configuration value: workCooldownV3.",
    default: "",
    example: "<workCooldownV3>",
  },
  "maxMentionsV3": {
    description: "Configuration value: maxMentionsV3.",
    default: "",
    example: "<maxMentionsV3>",
  },
  "maxLinesV3": {
    description: "Configuration value: maxLinesV3.",
    default: "",
    example: "<maxLinesV3>",
  },
  "warnThresholdV3": {
    description: "Configuration value: warnThresholdV3.",
    default: "",
    example: "<warnThresholdV3>",
  },
  "dmWelcomeV3": {
    description: "Configuration value: dmWelcomeV3.",
    default: "",
    example: "<dmWelcomeV3>",
  },
  "logDeletesV3": {
    description: "Configuration value: logDeletesV3.",
    default: "",
    example: "<logDeletesV3>",
  },
  "logEditsV3": {
    description: "Configuration value: logEditsV3.",
    default: "",
    example: "<logEditsV3>",
  },
  "antiRaidV3": {
    description: "Configuration value: antiRaidV3.",
    default: "",
    example: "<antiRaidV3>",
  },
  "captchaOnJoinV3": {
    description: "Configuration value: captchaOnJoinV3.",
    default: "",
    example: "<captchaOnJoinV3>",
  },
  "accountAgeLimitDaysV3": {
    description: "Configuration value: accountAgeLimitDaysV3.",
    default: "",
    example: "<accountAgeLimitDaysV3>",
  },
  "aiEnabledV3": {
    description: "Configuration value: aiEnabledV3.",
    default: "",
    example: "<aiEnabledV3>",
  },
  "aiPersonalityV3": {
    description: "Configuration value: aiPersonalityV3.",
    default: "",
    example: "<aiPersonalityV3>",
  },
  "aiMaxTokensV3": {
    description: "Configuration value: aiMaxTokensV3.",
    default: "",
    example: "<aiMaxTokensV3>",
  },
  "suggestionChannelV3": {
    description: "Configuration value: suggestionChannelV3.",
    default: "",
    example: "<suggestionChannelV3>",
  },
  "feedbackChannelV3": {
    description: "Configuration value: feedbackChannelV3.",
    default: "",
    example: "<feedbackChannelV3>",
  },
  "countingChannelV3": {
    description: "Configuration value: countingChannelV3.",
    default: "",
    example: "<countingChannelV3>",
  },
  "starboardChannelV3": {
    description: "Configuration value: starboardChannelV3.",
    default: "",
    example: "<starboardChannelV3>",
  },
  "starboardThresholdV3": {
    description: "Configuration value: starboardThresholdV3.",
    default: "",
    example: "<starboardThresholdV3>",
  },
  "tempVoiceHubV3": {
    description: "Configuration value: tempVoiceHubV3.",
    default: "",
    example: "<tempVoiceHubV3>",
  },
  "streamChannelV3": {
    description: "Configuration value: streamChannelV3.",
    default: "",
    example: "<streamChannelV3>",
  },
  "verifyRoleV3": {
    description: "Configuration value: verifyRoleV3.",
    default: "",
    example: "<verifyRoleV3>",
  },
  "unverifiedRoleV3": {
    description: "Configuration value: unverifiedRoleV3.",
    default: "",
    example: "<unverifiedRoleV3>",
  },
  "shiftLogChannelV3": {
    description: "Configuration value: shiftLogChannelV3.",
    default: "",
    example: "<shiftLogChannelV3>",
  },
  "deptLogChannelV3": {
    description: "Configuration value: deptLogChannelV3.",
    default: "",
    example: "<deptLogChannelV3>",
  },
  "musicVolumeV3": {
    description: "Configuration value: musicVolumeV3.",
    default: "",
    example: "<musicVolumeV3>",
  },
  "djRoleV3": {
    description: "Configuration value: djRoleV3.",
    default: "",
    example: "<djRoleV3>",
  },
  "birthdayChannelV3": {
    description: "Configuration value: birthdayChannelV3.",
    default: "",
    example: "<birthdayChannelV3>",
  },
  "repCooldownV3": {
    description: "Configuration value: repCooldownV3.",
    default: "",
    example: "<repCooldownV3>",
  },
  "logChannelV4": {
    description: "Configuration value: logChannelV4.",
    default: "",
    example: "<logChannelV4>",
  },
  "welcomeChannelV4": {
    description: "Configuration value: welcomeChannelV4.",
    default: "",
    example: "<welcomeChannelV4>",
  },
  "goodbyeChannelV4": {
    description: "Configuration value: goodbyeChannelV4.",
    default: "",
    example: "<goodbyeChannelV4>",
  },
  "levelUpChannelV4": {
    description: "Configuration value: levelUpChannelV4.",
    default: "",
    example: "<levelUpChannelV4>",
  },
  "welcomeMessageV4": {
    description: "Configuration value: welcomeMessageV4.",
    default: "",
    example: "<welcomeMessageV4>",
  },
  "goodbyeMessageV4": {
    description: "Configuration value: goodbyeMessageV4.",
    default: "",
    example: "<goodbyeMessageV4>",
  },
  "currencyNameV4": {
    description: "Configuration value: currencyNameV4.",
    default: "",
    example: "<currencyNameV4>",
  },
  "currencyEmojiV4": {
    description: "Configuration value: currencyEmojiV4.",
    default: "",
    example: "<currencyEmojiV4>",
  },
  "startingBalanceV4": {
    description: "Configuration value: startingBalanceV4.",
    default: "",
    example: "<startingBalanceV4>",
  },
  "dailyAmountV4": {
    description: "Configuration value: dailyAmountV4.",
    default: "",
    example: "<dailyAmountV4>",
  },
  "weeklyBonusV4": {
    description: "Configuration value: weeklyBonusV4.",
    default: "",
    example: "<weeklyBonusV4>",
  },
  "maxBankV4": {
    description: "Configuration value: maxBankV4.",
    default: "",
    example: "<maxBankV4>",
  },
  "workCooldownV4": {
    description: "Configuration value: workCooldownV4.",
    default: "",
    example: "<workCooldownV4>",
  },
  "maxMentionsV4": {
    description: "Configuration value: maxMentionsV4.",
    default: "",
    example: "<maxMentionsV4>",
  },
  "maxLinesV4": {
    description: "Configuration value: maxLinesV4.",
    default: "",
    example: "<maxLinesV4>",
  },
  "warnThresholdV4": {
    description: "Configuration value: warnThresholdV4.",
    default: "",
    example: "<warnThresholdV4>",
  },
  "dmWelcomeV4": {
    description: "Configuration value: dmWelcomeV4.",
    default: "",
    example: "<dmWelcomeV4>",
  },
  "logDeletesV4": {
    description: "Configuration value: logDeletesV4.",
    default: "",
    example: "<logDeletesV4>",
  },
  "logEditsV4": {
    description: "Configuration value: logEditsV4.",
    default: "",
    example: "<logEditsV4>",
  },
  "antiRaidV4": {
    description: "Configuration value: antiRaidV4.",
    default: "",
    example: "<antiRaidV4>",
  },
  "captchaOnJoinV4": {
    description: "Configuration value: captchaOnJoinV4.",
    default: "",
    example: "<captchaOnJoinV4>",
  },
  "accountAgeLimitDaysV4": {
    description: "Configuration value: accountAgeLimitDaysV4.",
    default: "",
    example: "<accountAgeLimitDaysV4>",
  },
  "aiEnabledV4": {
    description: "Configuration value: aiEnabledV4.",
    default: "",
    example: "<aiEnabledV4>",
  },
  "aiPersonalityV4": {
    description: "Configuration value: aiPersonalityV4.",
    default: "",
    example: "<aiPersonalityV4>",
  },
  "aiMaxTokensV4": {
    description: "Configuration value: aiMaxTokensV4.",
    default: "",
    example: "<aiMaxTokensV4>",
  },
  "suggestionChannelV4": {
    description: "Configuration value: suggestionChannelV4.",
    default: "",
    example: "<suggestionChannelV4>",
  },
  "feedbackChannelV4": {
    description: "Configuration value: feedbackChannelV4.",
    default: "",
    example: "<feedbackChannelV4>",
  },
  "countingChannelV4": {
    description: "Configuration value: countingChannelV4.",
    default: "",
    example: "<countingChannelV4>",
  },
  "starboardChannelV4": {
    description: "Configuration value: starboardChannelV4.",
    default: "",
    example: "<starboardChannelV4>",
  },
  "starboardThresholdV4": {
    description: "Configuration value: starboardThresholdV4.",
    default: "",
    example: "<starboardThresholdV4>",
  },
  "tempVoiceHubV4": {
    description: "Configuration value: tempVoiceHubV4.",
    default: "",
    example: "<tempVoiceHubV4>",
  },
  "streamChannelV4": {
    description: "Configuration value: streamChannelV4.",
    default: "",
    example: "<streamChannelV4>",
  },
  "verifyRoleV4": {
    description: "Configuration value: verifyRoleV4.",
    default: "",
    example: "<verifyRoleV4>",
  },
  "unverifiedRoleV4": {
    description: "Configuration value: unverifiedRoleV4.",
    default: "",
    example: "<unverifiedRoleV4>",
  },
  "shiftLogChannelV4": {
    description: "Configuration value: shiftLogChannelV4.",
    default: "",
    example: "<shiftLogChannelV4>",
  },
  "deptLogChannelV4": {
    description: "Configuration value: deptLogChannelV4.",
    default: "",
    example: "<deptLogChannelV4>",
  },
  "musicVolumeV4": {
    description: "Configuration value: musicVolumeV4.",
    default: "",
    example: "<musicVolumeV4>",
  },
  "djRoleV4": {
    description: "Configuration value: djRoleV4.",
    default: "",
    example: "<djRoleV4>",
  },
  "birthdayChannelV4": {
    description: "Configuration value: birthdayChannelV4.",
    default: "",
    example: "<birthdayChannelV4>",
  },
  "repCooldownV4": {
    description: "Configuration value: repCooldownV4.",
    default: "",
    example: "<repCooldownV4>",
  },
  "logChannelV5": {
    description: "Configuration value: logChannelV5.",
    default: "",
    example: "<logChannelV5>",
  },
  "welcomeChannelV5": {
    description: "Configuration value: welcomeChannelV5.",
    default: "",
    example: "<welcomeChannelV5>",
  },
  "goodbyeChannelV5": {
    description: "Configuration value: goodbyeChannelV5.",
    default: "",
    example: "<goodbyeChannelV5>",
  },
  "levelUpChannelV5": {
    description: "Configuration value: levelUpChannelV5.",
    default: "",
    example: "<levelUpChannelV5>",
  },
  "welcomeMessageV5": {
    description: "Configuration value: welcomeMessageV5.",
    default: "",
    example: "<welcomeMessageV5>",
  },
  "goodbyeMessageV5": {
    description: "Configuration value: goodbyeMessageV5.",
    default: "",
    example: "<goodbyeMessageV5>",
  },
  "currencyNameV5": {
    description: "Configuration value: currencyNameV5.",
    default: "",
    example: "<currencyNameV5>",
  },
  "currencyEmojiV5": {
    description: "Configuration value: currencyEmojiV5.",
    default: "",
    example: "<currencyEmojiV5>",
  },
  "startingBalanceV5": {
    description: "Configuration value: startingBalanceV5.",
    default: "",
    example: "<startingBalanceV5>",
  },
  "dailyAmountV5": {
    description: "Configuration value: dailyAmountV5.",
    default: "",
    example: "<dailyAmountV5>",
  },
  "weeklyBonusV5": {
    description: "Configuration value: weeklyBonusV5.",
    default: "",
    example: "<weeklyBonusV5>",
  },
  "maxBankV5": {
    description: "Configuration value: maxBankV5.",
    default: "",
    example: "<maxBankV5>",
  },
  "workCooldownV5": {
    description: "Configuration value: workCooldownV5.",
    default: "",
    example: "<workCooldownV5>",
  },
  "maxMentionsV5": {
    description: "Configuration value: maxMentionsV5.",
    default: "",
    example: "<maxMentionsV5>",
  },
  "maxLinesV5": {
    description: "Configuration value: maxLinesV5.",
    default: "",
    example: "<maxLinesV5>",
  },
  "warnThresholdV5": {
    description: "Configuration value: warnThresholdV5.",
    default: "",
    example: "<warnThresholdV5>",
  },
  "dmWelcomeV5": {
    description: "Configuration value: dmWelcomeV5.",
    default: "",
    example: "<dmWelcomeV5>",
  },
  "logDeletesV5": {
    description: "Configuration value: logDeletesV5.",
    default: "",
    example: "<logDeletesV5>",
  },
  "logEditsV5": {
    description: "Configuration value: logEditsV5.",
    default: "",
    example: "<logEditsV5>",
  },
  "antiRaidV5": {
    description: "Configuration value: antiRaidV5.",
    default: "",
    example: "<antiRaidV5>",
  },
  "captchaOnJoinV5": {
    description: "Configuration value: captchaOnJoinV5.",
    default: "",
    example: "<captchaOnJoinV5>",
  },
  "accountAgeLimitDaysV5": {
    description: "Configuration value: accountAgeLimitDaysV5.",
    default: "",
    example: "<accountAgeLimitDaysV5>",
  },
  "aiEnabledV5": {
    description: "Configuration value: aiEnabledV5.",
    default: "",
    example: "<aiEnabledV5>",
  },
  "aiPersonalityV5": {
    description: "Configuration value: aiPersonalityV5.",
    default: "",
    example: "<aiPersonalityV5>",
  },
  "aiMaxTokensV5": {
    description: "Configuration value: aiMaxTokensV5.",
    default: "",
    example: "<aiMaxTokensV5>",
  },
  "suggestionChannelV5": {
    description: "Configuration value: suggestionChannelV5.",
    default: "",
    example: "<suggestionChannelV5>",
  },
  "feedbackChannelV5": {
    description: "Configuration value: feedbackChannelV5.",
    default: "",
    example: "<feedbackChannelV5>",
  },
  "countingChannelV5": {
    description: "Configuration value: countingChannelV5.",
    default: "",
    example: "<countingChannelV5>",
  },
  "starboardChannelV5": {
    description: "Configuration value: starboardChannelV5.",
    default: "",
    example: "<starboardChannelV5>",
  },
  "starboardThresholdV5": {
    description: "Configuration value: starboardThresholdV5.",
    default: "",
    example: "<starboardThresholdV5>",
  },
  "tempVoiceHubV5": {
    description: "Configuration value: tempVoiceHubV5.",
    default: "",
    example: "<tempVoiceHubV5>",
  },
  "streamChannelV5": {
    description: "Configuration value: streamChannelV5.",
    default: "",
    example: "<streamChannelV5>",
  },
  "verifyRoleV5": {
    description: "Configuration value: verifyRoleV5.",
    default: "",
    example: "<verifyRoleV5>",
  },
  "unverifiedRoleV5": {
    description: "Configuration value: unverifiedRoleV5.",
    default: "",
    example: "<unverifiedRoleV5>",
  },
  "shiftLogChannelV5": {
    description: "Configuration value: shiftLogChannelV5.",
    default: "",
    example: "<shiftLogChannelV5>",
  },
  "deptLogChannelV5": {
    description: "Configuration value: deptLogChannelV5.",
    default: "",
    example: "<deptLogChannelV5>",
  },
  "musicVolumeV5": {
    description: "Configuration value: musicVolumeV5.",
    default: "",
    example: "<musicVolumeV5>",
  },
  "djRoleV5": {
    description: "Configuration value: djRoleV5.",
    default: "",
    example: "<djRoleV5>",
  },
  "birthdayChannelV5": {
    description: "Configuration value: birthdayChannelV5.",
    default: "",
    example: "<birthdayChannelV5>",
  },
  "repCooldownV5": {
    description: "Configuration value: repCooldownV5.",
    default: "",
    example: "<repCooldownV5>",
  },
  "logChannelV6": {
    description: "Configuration value: logChannelV6.",
    default: "",
    example: "<logChannelV6>",
  },
  "welcomeChannelV6": {
    description: "Configuration value: welcomeChannelV6.",
    default: "",
    example: "<welcomeChannelV6>",
  },
  "goodbyeChannelV6": {
    description: "Configuration value: goodbyeChannelV6.",
    default: "",
    example: "<goodbyeChannelV6>",
  },
  "levelUpChannelV6": {
    description: "Configuration value: levelUpChannelV6.",
    default: "",
    example: "<levelUpChannelV6>",
  },
  "welcomeMessageV6": {
    description: "Configuration value: welcomeMessageV6.",
    default: "",
    example: "<welcomeMessageV6>",
  },
  "goodbyeMessageV6": {
    description: "Configuration value: goodbyeMessageV6.",
    default: "",
    example: "<goodbyeMessageV6>",
  },
  "currencyNameV6": {
    description: "Configuration value: currencyNameV6.",
    default: "",
    example: "<currencyNameV6>",
  },
  "currencyEmojiV6": {
    description: "Configuration value: currencyEmojiV6.",
    default: "",
    example: "<currencyEmojiV6>",
  },
  "startingBalanceV6": {
    description: "Configuration value: startingBalanceV6.",
    default: "",
    example: "<startingBalanceV6>",
  },
  "dailyAmountV6": {
    description: "Configuration value: dailyAmountV6.",
    default: "",
    example: "<dailyAmountV6>",
  },
  "weeklyBonusV6": {
    description: "Configuration value: weeklyBonusV6.",
    default: "",
    example: "<weeklyBonusV6>",
  },
  "maxBankV6": {
    description: "Configuration value: maxBankV6.",
    default: "",
    example: "<maxBankV6>",
  },
  "workCooldownV6": {
    description: "Configuration value: workCooldownV6.",
    default: "",
    example: "<workCooldownV6>",
  },
  "maxMentionsV6": {
    description: "Configuration value: maxMentionsV6.",
    default: "",
    example: "<maxMentionsV6>",
  },
  "maxLinesV6": {
    description: "Configuration value: maxLinesV6.",
    default: "",
    example: "<maxLinesV6>",
  },
  "warnThresholdV6": {
    description: "Configuration value: warnThresholdV6.",
    default: "",
    example: "<warnThresholdV6>",
  },
  "dmWelcomeV6": {
    description: "Configuration value: dmWelcomeV6.",
    default: "",
    example: "<dmWelcomeV6>",
  },
  "logDeletesV6": {
    description: "Configuration value: logDeletesV6.",
    default: "",
    example: "<logDeletesV6>",
  },
  "logEditsV6": {
    description: "Configuration value: logEditsV6.",
    default: "",
    example: "<logEditsV6>",
  },
  "antiRaidV6": {
    description: "Configuration value: antiRaidV6.",
    default: "",
    example: "<antiRaidV6>",
  },
  "captchaOnJoinV6": {
    description: "Configuration value: captchaOnJoinV6.",
    default: "",
    example: "<captchaOnJoinV6>",
  },
  "accountAgeLimitDaysV6": {
    description: "Configuration value: accountAgeLimitDaysV6.",
    default: "",
    example: "<accountAgeLimitDaysV6>",
  },
  "aiEnabledV6": {
    description: "Configuration value: aiEnabledV6.",
    default: "",
    example: "<aiEnabledV6>",
  },
  "aiPersonalityV6": {
    description: "Configuration value: aiPersonalityV6.",
    default: "",
    example: "<aiPersonalityV6>",
  },
  "aiMaxTokensV6": {
    description: "Configuration value: aiMaxTokensV6.",
    default: "",
    example: "<aiMaxTokensV6>",
  },
  "suggestionChannelV6": {
    description: "Configuration value: suggestionChannelV6.",
    default: "",
    example: "<suggestionChannelV6>",
  },
  "feedbackChannelV6": {
    description: "Configuration value: feedbackChannelV6.",
    default: "",
    example: "<feedbackChannelV6>",
  },
  "countingChannelV6": {
    description: "Configuration value: countingChannelV6.",
    default: "",
    example: "<countingChannelV6>",
  },
  "starboardChannelV6": {
    description: "Configuration value: starboardChannelV6.",
    default: "",
    example: "<starboardChannelV6>",
  },
  "starboardThresholdV6": {
    description: "Configuration value: starboardThresholdV6.",
    default: "",
    example: "<starboardThresholdV6>",
  },
  "tempVoiceHubV6": {
    description: "Configuration value: tempVoiceHubV6.",
    default: "",
    example: "<tempVoiceHubV6>",
  },
  "streamChannelV6": {
    description: "Configuration value: streamChannelV6.",
    default: "",
    example: "<streamChannelV6>",
  },
  "verifyRoleV6": {
    description: "Configuration value: verifyRoleV6.",
    default: "",
    example: "<verifyRoleV6>",
  },
  "unverifiedRoleV6": {
    description: "Configuration value: unverifiedRoleV6.",
    default: "",
    example: "<unverifiedRoleV6>",
  },
  "shiftLogChannelV6": {
    description: "Configuration value: shiftLogChannelV6.",
    default: "",
    example: "<shiftLogChannelV6>",
  },
  "deptLogChannelV6": {
    description: "Configuration value: deptLogChannelV6.",
    default: "",
    example: "<deptLogChannelV6>",
  },
  "musicVolumeV6": {
    description: "Configuration value: musicVolumeV6.",
    default: "",
    example: "<musicVolumeV6>",
  },
  "djRoleV6": {
    description: "Configuration value: djRoleV6.",
    default: "",
    example: "<djRoleV6>",
  },
  "birthdayChannelV6": {
    description: "Configuration value: birthdayChannelV6.",
    default: "",
    example: "<birthdayChannelV6>",
  },
  "repCooldownV6": {
    description: "Configuration value: repCooldownV6.",
    default: "",
    example: "<repCooldownV6>",
  },
  "logChannelV7": {
    description: "Configuration value: logChannelV7.",
    default: "",
    example: "<logChannelV7>",
  },
  "welcomeChannelV7": {
    description: "Configuration value: welcomeChannelV7.",
    default: "",
    example: "<welcomeChannelV7>",
  },
  "goodbyeChannelV7": {
    description: "Configuration value: goodbyeChannelV7.",
    default: "",
    example: "<goodbyeChannelV7>",
  },
  "levelUpChannelV7": {
    description: "Configuration value: levelUpChannelV7.",
    default: "",
    example: "<levelUpChannelV7>",
  },
  "welcomeMessageV7": {
    description: "Configuration value: welcomeMessageV7.",
    default: "",
    example: "<welcomeMessageV7>",
  },
  "goodbyeMessageV7": {
    description: "Configuration value: goodbyeMessageV7.",
    default: "",
    example: "<goodbyeMessageV7>",
  },
  "currencyNameV7": {
    description: "Configuration value: currencyNameV7.",
    default: "",
    example: "<currencyNameV7>",
  },
  "currencyEmojiV7": {
    description: "Configuration value: currencyEmojiV7.",
    default: "",
    example: "<currencyEmojiV7>",
  },
  "startingBalanceV7": {
    description: "Configuration value: startingBalanceV7.",
    default: "",
    example: "<startingBalanceV7>",
  },
  "dailyAmountV7": {
    description: "Configuration value: dailyAmountV7.",
    default: "",
    example: "<dailyAmountV7>",
  },
  "weeklyBonusV7": {
    description: "Configuration value: weeklyBonusV7.",
    default: "",
    example: "<weeklyBonusV7>",
  },
  "maxBankV7": {
    description: "Configuration value: maxBankV7.",
    default: "",
    example: "<maxBankV7>",
  },
  "workCooldownV7": {
    description: "Configuration value: workCooldownV7.",
    default: "",
    example: "<workCooldownV7>",
  },
  "maxMentionsV7": {
    description: "Configuration value: maxMentionsV7.",
    default: "",
    example: "<maxMentionsV7>",
  },
  "maxLinesV7": {
    description: "Configuration value: maxLinesV7.",
    default: "",
    example: "<maxLinesV7>",
  },
  "warnThresholdV7": {
    description: "Configuration value: warnThresholdV7.",
    default: "",
    example: "<warnThresholdV7>",
  },
  "dmWelcomeV7": {
    description: "Configuration value: dmWelcomeV7.",
    default: "",
    example: "<dmWelcomeV7>",
  },
  "logDeletesV7": {
    description: "Configuration value: logDeletesV7.",
    default: "",
    example: "<logDeletesV7>",
  },
  "logEditsV7": {
    description: "Configuration value: logEditsV7.",
    default: "",
    example: "<logEditsV7>",
  },
  "antiRaidV7": {
    description: "Configuration value: antiRaidV7.",
    default: "",
    example: "<antiRaidV7>",
  },
  "captchaOnJoinV7": {
    description: "Configuration value: captchaOnJoinV7.",
    default: "",
    example: "<captchaOnJoinV7>",
  },
  "accountAgeLimitDaysV7": {
    description: "Configuration value: accountAgeLimitDaysV7.",
    default: "",
    example: "<accountAgeLimitDaysV7>",
  },
  "aiEnabledV7": {
    description: "Configuration value: aiEnabledV7.",
    default: "",
    example: "<aiEnabledV7>",
  },
  "aiPersonalityV7": {
    description: "Configuration value: aiPersonalityV7.",
    default: "",
    example: "<aiPersonalityV7>",
  },
  "aiMaxTokensV7": {
    description: "Configuration value: aiMaxTokensV7.",
    default: "",
    example: "<aiMaxTokensV7>",
  },
  "suggestionChannelV7": {
    description: "Configuration value: suggestionChannelV7.",
    default: "",
    example: "<suggestionChannelV7>",
  },
  "feedbackChannelV7": {
    description: "Configuration value: feedbackChannelV7.",
    default: "",
    example: "<feedbackChannelV7>",
  },
  "countingChannelV7": {
    description: "Configuration value: countingChannelV7.",
    default: "",
    example: "<countingChannelV7>",
  },
  "starboardChannelV7": {
    description: "Configuration value: starboardChannelV7.",
    default: "",
    example: "<starboardChannelV7>",
  },
  "starboardThresholdV7": {
    description: "Configuration value: starboardThresholdV7.",
    default: "",
    example: "<starboardThresholdV7>",
  },
  "tempVoiceHubV7": {
    description: "Configuration value: tempVoiceHubV7.",
    default: "",
    example: "<tempVoiceHubV7>",
  },
  "streamChannelV7": {
    description: "Configuration value: streamChannelV7.",
    default: "",
    example: "<streamChannelV7>",
  },
  "verifyRoleV7": {
    description: "Configuration value: verifyRoleV7.",
    default: "",
    example: "<verifyRoleV7>",
  },
  "unverifiedRoleV7": {
    description: "Configuration value: unverifiedRoleV7.",
    default: "",
    example: "<unverifiedRoleV7>",
  },
  "shiftLogChannelV7": {
    description: "Configuration value: shiftLogChannelV7.",
    default: "",
    example: "<shiftLogChannelV7>",
  },
  "deptLogChannelV7": {
    description: "Configuration value: deptLogChannelV7.",
    default: "",
    example: "<deptLogChannelV7>",
  },
  "musicVolumeV7": {
    description: "Configuration value: musicVolumeV7.",
    default: "",
    example: "<musicVolumeV7>",
  },
  "djRoleV7": {
    description: "Configuration value: djRoleV7.",
    default: "",
    example: "<djRoleV7>",
  },
  "birthdayChannelV7": {
    description: "Configuration value: birthdayChannelV7.",
    default: "",
    example: "<birthdayChannelV7>",
  },
  "repCooldownV7": {
    description: "Configuration value: repCooldownV7.",
    default: "",
    example: "<repCooldownV7>",
  },
  "logChannelV8": {
    description: "Configuration value: logChannelV8.",
    default: "",
    example: "<logChannelV8>",
  },
  "welcomeChannelV8": {
    description: "Configuration value: welcomeChannelV8.",
    default: "",
    example: "<welcomeChannelV8>",
  },
  "goodbyeChannelV8": {
    description: "Configuration value: goodbyeChannelV8.",
    default: "",
    example: "<goodbyeChannelV8>",
  },
  "levelUpChannelV8": {
    description: "Configuration value: levelUpChannelV8.",
    default: "",
    example: "<levelUpChannelV8>",
  },
  "welcomeMessageV8": {
    description: "Configuration value: welcomeMessageV8.",
    default: "",
    example: "<welcomeMessageV8>",
  },
  "goodbyeMessageV8": {
    description: "Configuration value: goodbyeMessageV8.",
    default: "",
    example: "<goodbyeMessageV8>",
  },
  "currencyNameV8": {
    description: "Configuration value: currencyNameV8.",
    default: "",
    example: "<currencyNameV8>",
  },
  "currencyEmojiV8": {
    description: "Configuration value: currencyEmojiV8.",
    default: "",
    example: "<currencyEmojiV8>",
  },
  "startingBalanceV8": {
    description: "Configuration value: startingBalanceV8.",
    default: "",
    example: "<startingBalanceV8>",
  },
  "dailyAmountV8": {
    description: "Configuration value: dailyAmountV8.",
    default: "",
    example: "<dailyAmountV8>",
  },
  "weeklyBonusV8": {
    description: "Configuration value: weeklyBonusV8.",
    default: "",
    example: "<weeklyBonusV8>",
  },
  "maxBankV8": {
    description: "Configuration value: maxBankV8.",
    default: "",
    example: "<maxBankV8>",
  },
  "workCooldownV8": {
    description: "Configuration value: workCooldownV8.",
    default: "",
    example: "<workCooldownV8>",
  },
  "maxMentionsV8": {
    description: "Configuration value: maxMentionsV8.",
    default: "",
    example: "<maxMentionsV8>",
  },
  "maxLinesV8": {
    description: "Configuration value: maxLinesV8.",
    default: "",
    example: "<maxLinesV8>",
  },
  "warnThresholdV8": {
    description: "Configuration value: warnThresholdV8.",
    default: "",
    example: "<warnThresholdV8>",
  },
  "dmWelcomeV8": {
    description: "Configuration value: dmWelcomeV8.",
    default: "",
    example: "<dmWelcomeV8>",
  },
  "logDeletesV8": {
    description: "Configuration value: logDeletesV8.",
    default: "",
    example: "<logDeletesV8>",
  },
  "logEditsV8": {
    description: "Configuration value: logEditsV8.",
    default: "",
    example: "<logEditsV8>",
  },
  "antiRaidV8": {
    description: "Configuration value: antiRaidV8.",
    default: "",
    example: "<antiRaidV8>",
  },
  "captchaOnJoinV8": {
    description: "Configuration value: captchaOnJoinV8.",
    default: "",
    example: "<captchaOnJoinV8>",
  },
  "accountAgeLimitDaysV8": {
    description: "Configuration value: accountAgeLimitDaysV8.",
    default: "",
    example: "<accountAgeLimitDaysV8>",
  },
  "aiEnabledV8": {
    description: "Configuration value: aiEnabledV8.",
    default: "",
    example: "<aiEnabledV8>",
  },
  "aiPersonalityV8": {
    description: "Configuration value: aiPersonalityV8.",
    default: "",
    example: "<aiPersonalityV8>",
  },
  "aiMaxTokensV8": {
    description: "Configuration value: aiMaxTokensV8.",
    default: "",
    example: "<aiMaxTokensV8>",
  },
  "suggestionChannelV8": {
    description: "Configuration value: suggestionChannelV8.",
    default: "",
    example: "<suggestionChannelV8>",
  },
  "feedbackChannelV8": {
    description: "Configuration value: feedbackChannelV8.",
    default: "",
    example: "<feedbackChannelV8>",
  },
  "countingChannelV8": {
    description: "Configuration value: countingChannelV8.",
    default: "",
    example: "<countingChannelV8>",
  },
  "starboardChannelV8": {
    description: "Configuration value: starboardChannelV8.",
    default: "",
    example: "<starboardChannelV8>",
  },
  "starboardThresholdV8": {
    description: "Configuration value: starboardThresholdV8.",
    default: "",
    example: "<starboardThresholdV8>",
  },
  "tempVoiceHubV8": {
    description: "Configuration value: tempVoiceHubV8.",
    default: "",
    example: "<tempVoiceHubV8>",
  },
  "streamChannelV8": {
    description: "Configuration value: streamChannelV8.",
    default: "",
    example: "<streamChannelV8>",
  },
  "verifyRoleV8": {
    description: "Configuration value: verifyRoleV8.",
    default: "",
    example: "<verifyRoleV8>",
  },
  "unverifiedRoleV8": {
    description: "Configuration value: unverifiedRoleV8.",
    default: "",
    example: "<unverifiedRoleV8>",
  },
  "shiftLogChannelV8": {
    description: "Configuration value: shiftLogChannelV8.",
    default: "",
    example: "<shiftLogChannelV8>",
  },
  "deptLogChannelV8": {
    description: "Configuration value: deptLogChannelV8.",
    default: "",
    example: "<deptLogChannelV8>",
  },
  "musicVolumeV8": {
    description: "Configuration value: musicVolumeV8.",
    default: "",
    example: "<musicVolumeV8>",
  },
  "djRoleV8": {
    description: "Configuration value: djRoleV8.",
    default: "",
    example: "<djRoleV8>",
  },
  "birthdayChannelV8": {
    description: "Configuration value: birthdayChannelV8.",
    default: "",
    example: "<birthdayChannelV8>",
  },
  "repCooldownV8": {
    description: "Configuration value: repCooldownV8.",
    default: "",
    example: "<repCooldownV8>",
  },
  "logChannelV9": {
    description: "Configuration value: logChannelV9.",
    default: "",
    example: "<logChannelV9>",
  },
  "welcomeChannelV9": {
    description: "Configuration value: welcomeChannelV9.",
    default: "",
    example: "<welcomeChannelV9>",
  },
  "goodbyeChannelV9": {
    description: "Configuration value: goodbyeChannelV9.",
    default: "",
    example: "<goodbyeChannelV9>",
  },
  "levelUpChannelV9": {
    description: "Configuration value: levelUpChannelV9.",
    default: "",
    example: "<levelUpChannelV9>",
  },
  "welcomeMessageV9": {
    description: "Configuration value: welcomeMessageV9.",
    default: "",
    example: "<welcomeMessageV9>",
  },
  "goodbyeMessageV9": {
    description: "Configuration value: goodbyeMessageV9.",
    default: "",
    example: "<goodbyeMessageV9>",
  },
  "currencyNameV9": {
    description: "Configuration value: currencyNameV9.",
    default: "",
    example: "<currencyNameV9>",
  },
  "currencyEmojiV9": {
    description: "Configuration value: currencyEmojiV9.",
    default: "",
    example: "<currencyEmojiV9>",
  },
  "startingBalanceV9": {
    description: "Configuration value: startingBalanceV9.",
    default: "",
    example: "<startingBalanceV9>",
  },
  "dailyAmountV9": {
    description: "Configuration value: dailyAmountV9.",
    default: "",
    example: "<dailyAmountV9>",
  },
  "weeklyBonusV9": {
    description: "Configuration value: weeklyBonusV9.",
    default: "",
    example: "<weeklyBonusV9>",
  },
  "maxBankV9": {
    description: "Configuration value: maxBankV9.",
    default: "",
    example: "<maxBankV9>",
  },
  "workCooldownV9": {
    description: "Configuration value: workCooldownV9.",
    default: "",
    example: "<workCooldownV9>",
  },
  "maxMentionsV9": {
    description: "Configuration value: maxMentionsV9.",
    default: "",
    example: "<maxMentionsV9>",
  },
  "maxLinesV9": {
    description: "Configuration value: maxLinesV9.",
    default: "",
    example: "<maxLinesV9>",
  },
  "warnThresholdV9": {
    description: "Configuration value: warnThresholdV9.",
    default: "",
    example: "<warnThresholdV9>",
  },
  "dmWelcomeV9": {
    description: "Configuration value: dmWelcomeV9.",
    default: "",
    example: "<dmWelcomeV9>",
  },
  "logDeletesV9": {
    description: "Configuration value: logDeletesV9.",
    default: "",
    example: "<logDeletesV9>",
  },
  "logEditsV9": {
    description: "Configuration value: logEditsV9.",
    default: "",
    example: "<logEditsV9>",
  },
  "antiRaidV9": {
    description: "Configuration value: antiRaidV9.",
    default: "",
    example: "<antiRaidV9>",
  },
  "captchaOnJoinV9": {
    description: "Configuration value: captchaOnJoinV9.",
    default: "",
    example: "<captchaOnJoinV9>",
  },
  "accountAgeLimitDaysV9": {
    description: "Configuration value: accountAgeLimitDaysV9.",
    default: "",
    example: "<accountAgeLimitDaysV9>",
  },
  "aiEnabledV9": {
    description: "Configuration value: aiEnabledV9.",
    default: "",
    example: "<aiEnabledV9>",
  },
  "aiPersonalityV9": {
    description: "Configuration value: aiPersonalityV9.",
    default: "",
    example: "<aiPersonalityV9>",
  },
  "aiMaxTokensV9": {
    description: "Configuration value: aiMaxTokensV9.",
    default: "",
    example: "<aiMaxTokensV9>",
  },
  "suggestionChannelV9": {
    description: "Configuration value: suggestionChannelV9.",
    default: "",
    example: "<suggestionChannelV9>",
  },
  "feedbackChannelV9": {
    description: "Configuration value: feedbackChannelV9.",
    default: "",
    example: "<feedbackChannelV9>",
  },
  "countingChannelV9": {
    description: "Configuration value: countingChannelV9.",
    default: "",
    example: "<countingChannelV9>",
  },
  "starboardChannelV9": {
    description: "Configuration value: starboardChannelV9.",
    default: "",
    example: "<starboardChannelV9>",
  },
  "starboardThresholdV9": {
    description: "Configuration value: starboardThresholdV9.",
    default: "",
    example: "<starboardThresholdV9>",
  },
  "tempVoiceHubV9": {
    description: "Configuration value: tempVoiceHubV9.",
    default: "",
    example: "<tempVoiceHubV9>",
  },
  "streamChannelV9": {
    description: "Configuration value: streamChannelV9.",
    default: "",
    example: "<streamChannelV9>",
  },
  "verifyRoleV9": {
    description: "Configuration value: verifyRoleV9.",
    default: "",
    example: "<verifyRoleV9>",
  },
  "unverifiedRoleV9": {
    description: "Configuration value: unverifiedRoleV9.",
    default: "",
    example: "<unverifiedRoleV9>",
  },
  "shiftLogChannelV9": {
    description: "Configuration value: shiftLogChannelV9.",
    default: "",
    example: "<shiftLogChannelV9>",
  },
  "deptLogChannelV9": {
    description: "Configuration value: deptLogChannelV9.",
    default: "",
    example: "<deptLogChannelV9>",
  },
  "musicVolumeV9": {
    description: "Configuration value: musicVolumeV9.",
    default: "",
    example: "<musicVolumeV9>",
  },
  "djRoleV9": {
    description: "Configuration value: djRoleV9.",
    default: "",
    example: "<djRoleV9>",
  },
  "birthdayChannelV9": {
    description: "Configuration value: birthdayChannelV9.",
    default: "",
    example: "<birthdayChannelV9>",
  },
  "repCooldownV9": {
    description: "Configuration value: repCooldownV9.",
    default: "",
    example: "<repCooldownV9>",
  },
  "logChannelV10": {
    description: "Configuration value: logChannelV10.",
    default: "",
    example: "<logChannelV10>",
  },
  "welcomeChannelV10": {
    description: "Configuration value: welcomeChannelV10.",
    default: "",
    example: "<welcomeChannelV10>",
  },
  "goodbyeChannelV10": {
    description: "Configuration value: goodbyeChannelV10.",
    default: "",
    example: "<goodbyeChannelV10>",
  },
  "levelUpChannelV10": {
    description: "Configuration value: levelUpChannelV10.",
    default: "",
    example: "<levelUpChannelV10>",
  },
  "welcomeMessageV10": {
    description: "Configuration value: welcomeMessageV10.",
    default: "",
    example: "<welcomeMessageV10>",
  },
  "goodbyeMessageV10": {
    description: "Configuration value: goodbyeMessageV10.",
    default: "",
    example: "<goodbyeMessageV10>",
  },
  "currencyNameV10": {
    description: "Configuration value: currencyNameV10.",
    default: "",
    example: "<currencyNameV10>",
  },
  "currencyEmojiV10": {
    description: "Configuration value: currencyEmojiV10.",
    default: "",
    example: "<currencyEmojiV10>",
  },
  "startingBalanceV10": {
    description: "Configuration value: startingBalanceV10.",
    default: "",
    example: "<startingBalanceV10>",
  },
  "dailyAmountV10": {
    description: "Configuration value: dailyAmountV10.",
    default: "",
    example: "<dailyAmountV10>",
  },
  "weeklyBonusV10": {
    description: "Configuration value: weeklyBonusV10.",
    default: "",
    example: "<weeklyBonusV10>",
  },
  "maxBankV10": {
    description: "Configuration value: maxBankV10.",
    default: "",
    example: "<maxBankV10>",
  },
  "workCooldownV10": {
    description: "Configuration value: workCooldownV10.",
    default: "",
    example: "<workCooldownV10>",
  },
  "maxMentionsV10": {
    description: "Configuration value: maxMentionsV10.",
    default: "",
    example: "<maxMentionsV10>",
  },
  "maxLinesV10": {
    description: "Configuration value: maxLinesV10.",
    default: "",
    example: "<maxLinesV10>",
  },
  "warnThresholdV10": {
    description: "Configuration value: warnThresholdV10.",
    default: "",
    example: "<warnThresholdV10>",
  },
  "dmWelcomeV10": {
    description: "Configuration value: dmWelcomeV10.",
    default: "",
    example: "<dmWelcomeV10>",
  },
  "logDeletesV10": {
    description: "Configuration value: logDeletesV10.",
    default: "",
    example: "<logDeletesV10>",
  },
  "logEditsV10": {
    description: "Configuration value: logEditsV10.",
    default: "",
    example: "<logEditsV10>",
  },
  "antiRaidV10": {
    description: "Configuration value: antiRaidV10.",
    default: "",
    example: "<antiRaidV10>",
  },
  "captchaOnJoinV10": {
    description: "Configuration value: captchaOnJoinV10.",
    default: "",
    example: "<captchaOnJoinV10>",
  },
  "accountAgeLimitDaysV10": {
    description: "Configuration value: accountAgeLimitDaysV10.",
    default: "",
    example: "<accountAgeLimitDaysV10>",
  },
  "aiEnabledV10": {
    description: "Configuration value: aiEnabledV10.",
    default: "",
    example: "<aiEnabledV10>",
  },
  "aiPersonalityV10": {
    description: "Configuration value: aiPersonalityV10.",
    default: "",
    example: "<aiPersonalityV10>",
  },
  "aiMaxTokensV10": {
    description: "Configuration value: aiMaxTokensV10.",
    default: "",
    example: "<aiMaxTokensV10>",
  },
  "suggestionChannelV10": {
    description: "Configuration value: suggestionChannelV10.",
    default: "",
    example: "<suggestionChannelV10>",
  },
  "feedbackChannelV10": {
    description: "Configuration value: feedbackChannelV10.",
    default: "",
    example: "<feedbackChannelV10>",
  },
  "countingChannelV10": {
    description: "Configuration value: countingChannelV10.",
    default: "",
    example: "<countingChannelV10>",
  },
  "starboardChannelV10": {
    description: "Configuration value: starboardChannelV10.",
    default: "",
    example: "<starboardChannelV10>",
  },
  "starboardThresholdV10": {
    description: "Configuration value: starboardThresholdV10.",
    default: "",
    example: "<starboardThresholdV10>",
  },
  "tempVoiceHubV10": {
    description: "Configuration value: tempVoiceHubV10.",
    default: "",
    example: "<tempVoiceHubV10>",
  },
  "streamChannelV10": {
    description: "Configuration value: streamChannelV10.",
    default: "",
    example: "<streamChannelV10>",
  },
  "verifyRoleV10": {
    description: "Configuration value: verifyRoleV10.",
    default: "",
    example: "<verifyRoleV10>",
  },
  "unverifiedRoleV10": {
    description: "Configuration value: unverifiedRoleV10.",
    default: "",
    example: "<unverifiedRoleV10>",
  },
  "shiftLogChannelV10": {
    description: "Configuration value: shiftLogChannelV10.",
    default: "",
    example: "<shiftLogChannelV10>",
  },
  "deptLogChannelV10": {
    description: "Configuration value: deptLogChannelV10.",
    default: "",
    example: "<deptLogChannelV10>",
  },
  "musicVolumeV10": {
    description: "Configuration value: musicVolumeV10.",
    default: "",
    example: "<musicVolumeV10>",
  },
  "djRoleV10": {
    description: "Configuration value: djRoleV10.",
    default: "",
    example: "<djRoleV10>",
  },
  "birthdayChannelV10": {
    description: "Configuration value: birthdayChannelV10.",
    default: "",
    example: "<birthdayChannelV10>",
  },
  "repCooldownV10": {
    description: "Configuration value: repCooldownV10.",
    default: "",
    example: "<repCooldownV10>",
  },
  "logChannelV11": {
    description: "Configuration value: logChannelV11.",
    default: "",
    example: "<logChannelV11>",
  },
  "welcomeChannelV11": {
    description: "Configuration value: welcomeChannelV11.",
    default: "",
    example: "<welcomeChannelV11>",
  },
  "goodbyeChannelV11": {
    description: "Configuration value: goodbyeChannelV11.",
    default: "",
    example: "<goodbyeChannelV11>",
  },
  "levelUpChannelV11": {
    description: "Configuration value: levelUpChannelV11.",
    default: "",
    example: "<levelUpChannelV11>",
  },
  "welcomeMessageV11": {
    description: "Configuration value: welcomeMessageV11.",
    default: "",
    example: "<welcomeMessageV11>",
  },
  "goodbyeMessageV11": {
    description: "Configuration value: goodbyeMessageV11.",
    default: "",
    example: "<goodbyeMessageV11>",
  },
  "currencyNameV11": {
    description: "Configuration value: currencyNameV11.",
    default: "",
    example: "<currencyNameV11>",
  },
  "currencyEmojiV11": {
    description: "Configuration value: currencyEmojiV11.",
    default: "",
    example: "<currencyEmojiV11>",
  },
  "startingBalanceV11": {
    description: "Configuration value: startingBalanceV11.",
    default: "",
    example: "<startingBalanceV11>",
  },
  "dailyAmountV11": {
    description: "Configuration value: dailyAmountV11.",
    default: "",
    example: "<dailyAmountV11>",
  },
  "weeklyBonusV11": {
    description: "Configuration value: weeklyBonusV11.",
    default: "",
    example: "<weeklyBonusV11>",
  },
  "maxBankV11": {
    description: "Configuration value: maxBankV11.",
    default: "",
    example: "<maxBankV11>",
  },
  "workCooldownV11": {
    description: "Configuration value: workCooldownV11.",
    default: "",
    example: "<workCooldownV11>",
  },
  "maxMentionsV11": {
    description: "Configuration value: maxMentionsV11.",
    default: "",
    example: "<maxMentionsV11>",
  },
  "maxLinesV11": {
    description: "Configuration value: maxLinesV11.",
    default: "",
    example: "<maxLinesV11>",
  },
  "warnThresholdV11": {
    description: "Configuration value: warnThresholdV11.",
    default: "",
    example: "<warnThresholdV11>",
  },
  "dmWelcomeV11": {
    description: "Configuration value: dmWelcomeV11.",
    default: "",
    example: "<dmWelcomeV11>",
  },
  "logDeletesV11": {
    description: "Configuration value: logDeletesV11.",
    default: "",
    example: "<logDeletesV11>",
  },
  "logEditsV11": {
    description: "Configuration value: logEditsV11.",
    default: "",
    example: "<logEditsV11>",
  },
  "antiRaidV11": {
    description: "Configuration value: antiRaidV11.",
    default: "",
    example: "<antiRaidV11>",
  },
  "captchaOnJoinV11": {
    description: "Configuration value: captchaOnJoinV11.",
    default: "",
    example: "<captchaOnJoinV11>",
  },
  "accountAgeLimitDaysV11": {
    description: "Configuration value: accountAgeLimitDaysV11.",
    default: "",
    example: "<accountAgeLimitDaysV11>",
  },
  "aiEnabledV11": {
    description: "Configuration value: aiEnabledV11.",
    default: "",
    example: "<aiEnabledV11>",
  },
  "aiPersonalityV11": {
    description: "Configuration value: aiPersonalityV11.",
    default: "",
    example: "<aiPersonalityV11>",
  },
  "aiMaxTokensV11": {
    description: "Configuration value: aiMaxTokensV11.",
    default: "",
    example: "<aiMaxTokensV11>",
  },
  "suggestionChannelV11": {
    description: "Configuration value: suggestionChannelV11.",
    default: "",
    example: "<suggestionChannelV11>",
  },
  "feedbackChannelV11": {
    description: "Configuration value: feedbackChannelV11.",
    default: "",
    example: "<feedbackChannelV11>",
  },
  "countingChannelV11": {
    description: "Configuration value: countingChannelV11.",
    default: "",
    example: "<countingChannelV11>",
  },
  "starboardChannelV11": {
    description: "Configuration value: starboardChannelV11.",
    default: "",
    example: "<starboardChannelV11>",
  },
  "starboardThresholdV11": {
    description: "Configuration value: starboardThresholdV11.",
    default: "",
    example: "<starboardThresholdV11>",
  },
  "tempVoiceHubV11": {
    description: "Configuration value: tempVoiceHubV11.",
    default: "",
    example: "<tempVoiceHubV11>",
  },
  "streamChannelV11": {
    description: "Configuration value: streamChannelV11.",
    default: "",
    example: "<streamChannelV11>",
  },
  "verifyRoleV11": {
    description: "Configuration value: verifyRoleV11.",
    default: "",
    example: "<verifyRoleV11>",
  },
  "unverifiedRoleV11": {
    description: "Configuration value: unverifiedRoleV11.",
    default: "",
    example: "<unverifiedRoleV11>",
  },
  "shiftLogChannelV11": {
    description: "Configuration value: shiftLogChannelV11.",
    default: "",
    example: "<shiftLogChannelV11>",
  },
  "deptLogChannelV11": {
    description: "Configuration value: deptLogChannelV11.",
    default: "",
    example: "<deptLogChannelV11>",
  },
  "musicVolumeV11": {
    description: "Configuration value: musicVolumeV11.",
    default: "",
    example: "<musicVolumeV11>",
  },
  "djRoleV11": {
    description: "Configuration value: djRoleV11.",
    default: "",
    example: "<djRoleV11>",
  },
  "birthdayChannelV11": {
    description: "Configuration value: birthdayChannelV11.",
    default: "",
    example: "<birthdayChannelV11>",
  },
  "repCooldownV11": {
    description: "Configuration value: repCooldownV11.",
    default: "",
    example: "<repCooldownV11>",
  },
  "logChannelV12": {
    description: "Configuration value: logChannelV12.",
    default: "",
    example: "<logChannelV12>",
  },
  "welcomeChannelV12": {
    description: "Configuration value: welcomeChannelV12.",
    default: "",
    example: "<welcomeChannelV12>",
  },
  "goodbyeChannelV12": {
    description: "Configuration value: goodbyeChannelV12.",
    default: "",
    example: "<goodbyeChannelV12>",
  },
  "levelUpChannelV12": {
    description: "Configuration value: levelUpChannelV12.",
    default: "",
    example: "<levelUpChannelV12>",
  },
  "welcomeMessageV12": {
    description: "Configuration value: welcomeMessageV12.",
    default: "",
    example: "<welcomeMessageV12>",
  },
  "goodbyeMessageV12": {
    description: "Configuration value: goodbyeMessageV12.",
    default: "",
    example: "<goodbyeMessageV12>",
  },
  "currencyNameV12": {
    description: "Configuration value: currencyNameV12.",
    default: "",
    example: "<currencyNameV12>",
  },
  "currencyEmojiV12": {
    description: "Configuration value: currencyEmojiV12.",
    default: "",
    example: "<currencyEmojiV12>",
  },
  "startingBalanceV12": {
    description: "Configuration value: startingBalanceV12.",
    default: "",
    example: "<startingBalanceV12>",
  },
  "dailyAmountV12": {
    description: "Configuration value: dailyAmountV12.",
    default: "",
    example: "<dailyAmountV12>",
  },
  "weeklyBonusV12": {
    description: "Configuration value: weeklyBonusV12.",
    default: "",
    example: "<weeklyBonusV12>",
  },
  "maxBankV12": {
    description: "Configuration value: maxBankV12.",
    default: "",
    example: "<maxBankV12>",
  },
  "workCooldownV12": {
    description: "Configuration value: workCooldownV12.",
    default: "",
    example: "<workCooldownV12>",
  },
  "maxMentionsV12": {
    description: "Configuration value: maxMentionsV12.",
    default: "",
    example: "<maxMentionsV12>",
  },
  "maxLinesV12": {
    description: "Configuration value: maxLinesV12.",
    default: "",
    example: "<maxLinesV12>",
  },
  "warnThresholdV12": {
    description: "Configuration value: warnThresholdV12.",
    default: "",
    example: "<warnThresholdV12>",
  },
  "dmWelcomeV12": {
    description: "Configuration value: dmWelcomeV12.",
    default: "",
    example: "<dmWelcomeV12>",
  },
  "logDeletesV12": {
    description: "Configuration value: logDeletesV12.",
    default: "",
    example: "<logDeletesV12>",
  },
  "logEditsV12": {
    description: "Configuration value: logEditsV12.",
    default: "",
    example: "<logEditsV12>",
  },
  "antiRaidV12": {
    description: "Configuration value: antiRaidV12.",
    default: "",
    example: "<antiRaidV12>",
  },
  "captchaOnJoinV12": {
    description: "Configuration value: captchaOnJoinV12.",
    default: "",
    example: "<captchaOnJoinV12>",
  },
  "accountAgeLimitDaysV12": {
    description: "Configuration value: accountAgeLimitDaysV12.",
    default: "",
    example: "<accountAgeLimitDaysV12>",
  },
  "aiEnabledV12": {
    description: "Configuration value: aiEnabledV12.",
    default: "",
    example: "<aiEnabledV12>",
  },
  "aiPersonalityV12": {
    description: "Configuration value: aiPersonalityV12.",
    default: "",
    example: "<aiPersonalityV12>",
  },
  "aiMaxTokensV12": {
    description: "Configuration value: aiMaxTokensV12.",
    default: "",
    example: "<aiMaxTokensV12>",
  },
  "suggestionChannelV12": {
    description: "Configuration value: suggestionChannelV12.",
    default: "",
    example: "<suggestionChannelV12>",
  },
  "feedbackChannelV12": {
    description: "Configuration value: feedbackChannelV12.",
    default: "",
    example: "<feedbackChannelV12>",
  },
  "countingChannelV12": {
    description: "Configuration value: countingChannelV12.",
    default: "",
    example: "<countingChannelV12>",
  },
  "starboardChannelV12": {
    description: "Configuration value: starboardChannelV12.",
    default: "",
    example: "<starboardChannelV12>",
  },
  "starboardThresholdV12": {
    description: "Configuration value: starboardThresholdV12.",
    default: "",
    example: "<starboardThresholdV12>",
  },
  "tempVoiceHubV12": {
    description: "Configuration value: tempVoiceHubV12.",
    default: "",
    example: "<tempVoiceHubV12>",
  },
  "streamChannelV12": {
    description: "Configuration value: streamChannelV12.",
    default: "",
    example: "<streamChannelV12>",
  },
  "verifyRoleV12": {
    description: "Configuration value: verifyRoleV12.",
    default: "",
    example: "<verifyRoleV12>",
  },
  "unverifiedRoleV12": {
    description: "Configuration value: unverifiedRoleV12.",
    default: "",
    example: "<unverifiedRoleV12>",
  },
  "shiftLogChannelV12": {
    description: "Configuration value: shiftLogChannelV12.",
    default: "",
    example: "<shiftLogChannelV12>",
  },
  "deptLogChannelV12": {
    description: "Configuration value: deptLogChannelV12.",
    default: "",
    example: "<deptLogChannelV12>",
  },
  "musicVolumeV12": {
    description: "Configuration value: musicVolumeV12.",
    default: "",
    example: "<musicVolumeV12>",
  },
  "djRoleV12": {
    description: "Configuration value: djRoleV12.",
    default: "",
    example: "<djRoleV12>",
  },
  "birthdayChannelV12": {
    description: "Configuration value: birthdayChannelV12.",
    default: "",
    example: "<birthdayChannelV12>",
  },
  "repCooldownV12": {
    description: "Configuration value: repCooldownV12.",
    default: "",
    example: "<repCooldownV12>",
  },
  "logChannelV13": {
    description: "Configuration value: logChannelV13.",
    default: "",
    example: "<logChannelV13>",
  },
  "welcomeChannelV13": {
    description: "Configuration value: welcomeChannelV13.",
    default: "",
    example: "<welcomeChannelV13>",
  },
  "goodbyeChannelV13": {
    description: "Configuration value: goodbyeChannelV13.",
    default: "",
    example: "<goodbyeChannelV13>",
  },
  "levelUpChannelV13": {
    description: "Configuration value: levelUpChannelV13.",
    default: "",
    example: "<levelUpChannelV13>",
  },
  "welcomeMessageV13": {
    description: "Configuration value: welcomeMessageV13.",
    default: "",
    example: "<welcomeMessageV13>",
  },
  "goodbyeMessageV13": {
    description: "Configuration value: goodbyeMessageV13.",
    default: "",
    example: "<goodbyeMessageV13>",
  },
  "currencyNameV13": {
    description: "Configuration value: currencyNameV13.",
    default: "",
    example: "<currencyNameV13>",
  },
  "currencyEmojiV13": {
    description: "Configuration value: currencyEmojiV13.",
    default: "",
    example: "<currencyEmojiV13>",
  },
  "startingBalanceV13": {
    description: "Configuration value: startingBalanceV13.",
    default: "",
    example: "<startingBalanceV13>",
  },
  "dailyAmountV13": {
    description: "Configuration value: dailyAmountV13.",
    default: "",
    example: "<dailyAmountV13>",
  },
  "weeklyBonusV13": {
    description: "Configuration value: weeklyBonusV13.",
    default: "",
    example: "<weeklyBonusV13>",
  },
  "maxBankV13": {
    description: "Configuration value: maxBankV13.",
    default: "",
    example: "<maxBankV13>",
  },
  "workCooldownV13": {
    description: "Configuration value: workCooldownV13.",
    default: "",
    example: "<workCooldownV13>",
  },
  "maxMentionsV13": {
    description: "Configuration value: maxMentionsV13.",
    default: "",
    example: "<maxMentionsV13>",
  },
  "maxLinesV13": {
    description: "Configuration value: maxLinesV13.",
    default: "",
    example: "<maxLinesV13>",
  },
  "warnThresholdV13": {
    description: "Configuration value: warnThresholdV13.",
    default: "",
    example: "<warnThresholdV13>",
  },
  "dmWelcomeV13": {
    description: "Configuration value: dmWelcomeV13.",
    default: "",
    example: "<dmWelcomeV13>",
  },
  "logDeletesV13": {
    description: "Configuration value: logDeletesV13.",
    default: "",
    example: "<logDeletesV13>",
  },
  "logEditsV13": {
    description: "Configuration value: logEditsV13.",
    default: "",
    example: "<logEditsV13>",
  },
  "antiRaidV13": {
    description: "Configuration value: antiRaidV13.",
    default: "",
    example: "<antiRaidV13>",
  },
  "captchaOnJoinV13": {
    description: "Configuration value: captchaOnJoinV13.",
    default: "",
    example: "<captchaOnJoinV13>",
  },
  "accountAgeLimitDaysV13": {
    description: "Configuration value: accountAgeLimitDaysV13.",
    default: "",
    example: "<accountAgeLimitDaysV13>",
  },
  "aiEnabledV13": {
    description: "Configuration value: aiEnabledV13.",
    default: "",
    example: "<aiEnabledV13>",
  },
  "aiPersonalityV13": {
    description: "Configuration value: aiPersonalityV13.",
    default: "",
    example: "<aiPersonalityV13>",
  },
  "aiMaxTokensV13": {
    description: "Configuration value: aiMaxTokensV13.",
    default: "",
    example: "<aiMaxTokensV13>",
  },
  "suggestionChannelV13": {
    description: "Configuration value: suggestionChannelV13.",
    default: "",
    example: "<suggestionChannelV13>",
  },
  "feedbackChannelV13": {
    description: "Configuration value: feedbackChannelV13.",
    default: "",
    example: "<feedbackChannelV13>",
  },
  "countingChannelV13": {
    description: "Configuration value: countingChannelV13.",
    default: "",
    example: "<countingChannelV13>",
  },
  "starboardChannelV13": {
    description: "Configuration value: starboardChannelV13.",
    default: "",
    example: "<starboardChannelV13>",
  },
  "starboardThresholdV13": {
    description: "Configuration value: starboardThresholdV13.",
    default: "",
    example: "<starboardThresholdV13>",
  },
  "tempVoiceHubV13": {
    description: "Configuration value: tempVoiceHubV13.",
    default: "",
    example: "<tempVoiceHubV13>",
  },
  "streamChannelV13": {
    description: "Configuration value: streamChannelV13.",
    default: "",
    example: "<streamChannelV13>",
  },
  "verifyRoleV13": {
    description: "Configuration value: verifyRoleV13.",
    default: "",
    example: "<verifyRoleV13>",
  },
  "unverifiedRoleV13": {
    description: "Configuration value: unverifiedRoleV13.",
    default: "",
    example: "<unverifiedRoleV13>",
  },
  "shiftLogChannelV13": {
    description: "Configuration value: shiftLogChannelV13.",
    default: "",
    example: "<shiftLogChannelV13>",
  },
  "deptLogChannelV13": {
    description: "Configuration value: deptLogChannelV13.",
    default: "",
    example: "<deptLogChannelV13>",
  },
  "musicVolumeV13": {
    description: "Configuration value: musicVolumeV13.",
    default: "",
    example: "<musicVolumeV13>",
  },
  "djRoleV13": {
    description: "Configuration value: djRoleV13.",
    default: "",
    example: "<djRoleV13>",
  },
  "birthdayChannelV13": {
    description: "Configuration value: birthdayChannelV13.",
    default: "",
    example: "<birthdayChannelV13>",
  },
  "repCooldownV13": {
    description: "Configuration value: repCooldownV13.",
    default: "",
    example: "<repCooldownV13>",
  },
  "logChannelV14": {
    description: "Configuration value: logChannelV14.",
    default: "",
    example: "<logChannelV14>",
  },
  "welcomeChannelV14": {
    description: "Configuration value: welcomeChannelV14.",
    default: "",
    example: "<welcomeChannelV14>",
  },
  "goodbyeChannelV14": {
    description: "Configuration value: goodbyeChannelV14.",
    default: "",
    example: "<goodbyeChannelV14>",
  },
  "levelUpChannelV14": {
    description: "Configuration value: levelUpChannelV14.",
    default: "",
    example: "<levelUpChannelV14>",
  },
  "welcomeMessageV14": {
    description: "Configuration value: welcomeMessageV14.",
    default: "",
    example: "<welcomeMessageV14>",
  },
  "goodbyeMessageV14": {
    description: "Configuration value: goodbyeMessageV14.",
    default: "",
    example: "<goodbyeMessageV14>",
  },
  "currencyNameV14": {
    description: "Configuration value: currencyNameV14.",
    default: "",
    example: "<currencyNameV14>",
  },
  "currencyEmojiV14": {
    description: "Configuration value: currencyEmojiV14.",
    default: "",
    example: "<currencyEmojiV14>",
  },
  "startingBalanceV14": {
    description: "Configuration value: startingBalanceV14.",
    default: "",
    example: "<startingBalanceV14>",
  },
  "dailyAmountV14": {
    description: "Configuration value: dailyAmountV14.",
    default: "",
    example: "<dailyAmountV14>",
  },
  "weeklyBonusV14": {
    description: "Configuration value: weeklyBonusV14.",
    default: "",
    example: "<weeklyBonusV14>",
  },
  "maxBankV14": {
    description: "Configuration value: maxBankV14.",
    default: "",
    example: "<maxBankV14>",
  },
  "workCooldownV14": {
    description: "Configuration value: workCooldownV14.",
    default: "",
    example: "<workCooldownV14>",
  },
  "maxMentionsV14": {
    description: "Configuration value: maxMentionsV14.",
    default: "",
    example: "<maxMentionsV14>",
  },
  "maxLinesV14": {
    description: "Configuration value: maxLinesV14.",
    default: "",
    example: "<maxLinesV14>",
  },
  "warnThresholdV14": {
    description: "Configuration value: warnThresholdV14.",
    default: "",
    example: "<warnThresholdV14>",
  },
  "dmWelcomeV14": {
    description: "Configuration value: dmWelcomeV14.",
    default: "",
    example: "<dmWelcomeV14>",
  },
  "logDeletesV14": {
    description: "Configuration value: logDeletesV14.",
    default: "",
    example: "<logDeletesV14>",
  },
  "logEditsV14": {
    description: "Configuration value: logEditsV14.",
    default: "",
    example: "<logEditsV14>",
  },
  "antiRaidV14": {
    description: "Configuration value: antiRaidV14.",
    default: "",
    example: "<antiRaidV14>",
  },
  "captchaOnJoinV14": {
    description: "Configuration value: captchaOnJoinV14.",
    default: "",
    example: "<captchaOnJoinV14>",
  },
  "accountAgeLimitDaysV14": {
    description: "Configuration value: accountAgeLimitDaysV14.",
    default: "",
    example: "<accountAgeLimitDaysV14>",
  },
  "aiEnabledV14": {
    description: "Configuration value: aiEnabledV14.",
    default: "",
    example: "<aiEnabledV14>",
  },
  "aiPersonalityV14": {
    description: "Configuration value: aiPersonalityV14.",
    default: "",
    example: "<aiPersonalityV14>",
  },
  "aiMaxTokensV14": {
    description: "Configuration value: aiMaxTokensV14.",
    default: "",
    example: "<aiMaxTokensV14>",
  },
  "suggestionChannelV14": {
    description: "Configuration value: suggestionChannelV14.",
    default: "",
    example: "<suggestionChannelV14>",
  },
  "feedbackChannelV14": {
    description: "Configuration value: feedbackChannelV14.",
    default: "",
    example: "<feedbackChannelV14>",
  },
  "countingChannelV14": {
    description: "Configuration value: countingChannelV14.",
    default: "",
    example: "<countingChannelV14>",
  },
  "starboardChannelV14": {
    description: "Configuration value: starboardChannelV14.",
    default: "",
    example: "<starboardChannelV14>",
  },
  "starboardThresholdV14": {
    description: "Configuration value: starboardThresholdV14.",
    default: "",
    example: "<starboardThresholdV14>",
  },
  "tempVoiceHubV14": {
    description: "Configuration value: tempVoiceHubV14.",
    default: "",
    example: "<tempVoiceHubV14>",
  },
  "streamChannelV14": {
    description: "Configuration value: streamChannelV14.",
    default: "",
    example: "<streamChannelV14>",
  },
  "verifyRoleV14": {
    description: "Configuration value: verifyRoleV14.",
    default: "",
    example: "<verifyRoleV14>",
  },
  "unverifiedRoleV14": {
    description: "Configuration value: unverifiedRoleV14.",
    default: "",
    example: "<unverifiedRoleV14>",
  },
  "shiftLogChannelV14": {
    description: "Configuration value: shiftLogChannelV14.",
    default: "",
    example: "<shiftLogChannelV14>",
  },
  "deptLogChannelV14": {
    description: "Configuration value: deptLogChannelV14.",
    default: "",
    example: "<deptLogChannelV14>",
  },
  "musicVolumeV14": {
    description: "Configuration value: musicVolumeV14.",
    default: "",
    example: "<musicVolumeV14>",
  },
  "djRoleV14": {
    description: "Configuration value: djRoleV14.",
    default: "",
    example: "<djRoleV14>",
  },
  "birthdayChannelV14": {
    description: "Configuration value: birthdayChannelV14.",
    default: "",
    example: "<birthdayChannelV14>",
  },
  "repCooldownV14": {
    description: "Configuration value: repCooldownV14.",
    default: "",
    example: "<repCooldownV14>",
  },
  "logChannelV15": {
    description: "Configuration value: logChannelV15.",
    default: "",
    example: "<logChannelV15>",
  },
  "welcomeChannelV15": {
    description: "Configuration value: welcomeChannelV15.",
    default: "",
    example: "<welcomeChannelV15>",
  },
  "goodbyeChannelV15": {
    description: "Configuration value: goodbyeChannelV15.",
    default: "",
    example: "<goodbyeChannelV15>",
  },
  "levelUpChannelV15": {
    description: "Configuration value: levelUpChannelV15.",
    default: "",
    example: "<levelUpChannelV15>",
  },
  "welcomeMessageV15": {
    description: "Configuration value: welcomeMessageV15.",
    default: "",
    example: "<welcomeMessageV15>",
  },
  "goodbyeMessageV15": {
    description: "Configuration value: goodbyeMessageV15.",
    default: "",
    example: "<goodbyeMessageV15>",
  },
  "currencyNameV15": {
    description: "Configuration value: currencyNameV15.",
    default: "",
    example: "<currencyNameV15>",
  },
  "currencyEmojiV15": {
    description: "Configuration value: currencyEmojiV15.",
    default: "",
    example: "<currencyEmojiV15>",
  },
  "startingBalanceV15": {
    description: "Configuration value: startingBalanceV15.",
    default: "",
    example: "<startingBalanceV15>",
  },
  "dailyAmountV15": {
    description: "Configuration value: dailyAmountV15.",
    default: "",
    example: "<dailyAmountV15>",
  },
  "weeklyBonusV15": {
    description: "Configuration value: weeklyBonusV15.",
    default: "",
    example: "<weeklyBonusV15>",
  },
  "maxBankV15": {
    description: "Configuration value: maxBankV15.",
    default: "",
    example: "<maxBankV15>",
  },
  "workCooldownV15": {
    description: "Configuration value: workCooldownV15.",
    default: "",
    example: "<workCooldownV15>",
  },
  "maxMentionsV15": {
    description: "Configuration value: maxMentionsV15.",
    default: "",
    example: "<maxMentionsV15>",
  },
  "maxLinesV15": {
    description: "Configuration value: maxLinesV15.",
    default: "",
    example: "<maxLinesV15>",
  },
  "warnThresholdV15": {
    description: "Configuration value: warnThresholdV15.",
    default: "",
    example: "<warnThresholdV15>",
  },
  "dmWelcomeV15": {
    description: "Configuration value: dmWelcomeV15.",
    default: "",
    example: "<dmWelcomeV15>",
  },
  "logDeletesV15": {
    description: "Configuration value: logDeletesV15.",
    default: "",
    example: "<logDeletesV15>",
  },
  "logEditsV15": {
    description: "Configuration value: logEditsV15.",
    default: "",
    example: "<logEditsV15>",
  },
  "antiRaidV15": {
    description: "Configuration value: antiRaidV15.",
    default: "",
    example: "<antiRaidV15>",
  },
  "captchaOnJoinV15": {
    description: "Configuration value: captchaOnJoinV15.",
    default: "",
    example: "<captchaOnJoinV15>",
  },
  "accountAgeLimitDaysV15": {
    description: "Configuration value: accountAgeLimitDaysV15.",
    default: "",
    example: "<accountAgeLimitDaysV15>",
  },
  "aiEnabledV15": {
    description: "Configuration value: aiEnabledV15.",
    default: "",
    example: "<aiEnabledV15>",
  },
  "aiPersonalityV15": {
    description: "Configuration value: aiPersonalityV15.",
    default: "",
    example: "<aiPersonalityV15>",
  },
  "aiMaxTokensV15": {
    description: "Configuration value: aiMaxTokensV15.",
    default: "",
    example: "<aiMaxTokensV15>",
  },
  "suggestionChannelV15": {
    description: "Configuration value: suggestionChannelV15.",
    default: "",
    example: "<suggestionChannelV15>",
  },
  "feedbackChannelV15": {
    description: "Configuration value: feedbackChannelV15.",
    default: "",
    example: "<feedbackChannelV15>",
  },
  "countingChannelV15": {
    description: "Configuration value: countingChannelV15.",
    default: "",
    example: "<countingChannelV15>",
  },
  "starboardChannelV15": {
    description: "Configuration value: starboardChannelV15.",
    default: "",
    example: "<starboardChannelV15>",
  },
  "starboardThresholdV15": {
    description: "Configuration value: starboardThresholdV15.",
    default: "",
    example: "<starboardThresholdV15>",
  },
  "tempVoiceHubV15": {
    description: "Configuration value: tempVoiceHubV15.",
    default: "",
    example: "<tempVoiceHubV15>",
  },
  "streamChannelV15": {
    description: "Configuration value: streamChannelV15.",
    default: "",
    example: "<streamChannelV15>",
  },
  "verifyRoleV15": {
    description: "Configuration value: verifyRoleV15.",
    default: "",
    example: "<verifyRoleV15>",
  },
  "unverifiedRoleV15": {
    description: "Configuration value: unverifiedRoleV15.",
    default: "",
    example: "<unverifiedRoleV15>",
  },
  "shiftLogChannelV15": {
    description: "Configuration value: shiftLogChannelV15.",
    default: "",
    example: "<shiftLogChannelV15>",
  },
  "deptLogChannelV15": {
    description: "Configuration value: deptLogChannelV15.",
    default: "",
    example: "<deptLogChannelV15>",
  },
  "musicVolumeV15": {
    description: "Configuration value: musicVolumeV15.",
    default: "",
    example: "<musicVolumeV15>",
  },
  "djRoleV15": {
    description: "Configuration value: djRoleV15.",
    default: "",
    example: "<djRoleV15>",
  },
  "birthdayChannelV15": {
    description: "Configuration value: birthdayChannelV15.",
    default: "",
    example: "<birthdayChannelV15>",
  },
  "repCooldownV15": {
    description: "Configuration value: repCooldownV15.",
    default: "",
    example: "<repCooldownV15>",
  },
  "logChannelV16": {
    description: "Configuration value: logChannelV16.",
    default: "",
    example: "<logChannelV16>",
  },
  "welcomeChannelV16": {
    description: "Configuration value: welcomeChannelV16.",
    default: "",
    example: "<welcomeChannelV16>",
  },
  "goodbyeChannelV16": {
    description: "Configuration value: goodbyeChannelV16.",
    default: "",
    example: "<goodbyeChannelV16>",
  },
  "levelUpChannelV16": {
    description: "Configuration value: levelUpChannelV16.",
    default: "",
    example: "<levelUpChannelV16>",
  },
  "welcomeMessageV16": {
    description: "Configuration value: welcomeMessageV16.",
    default: "",
    example: "<welcomeMessageV16>",
  },
  "goodbyeMessageV16": {
    description: "Configuration value: goodbyeMessageV16.",
    default: "",
    example: "<goodbyeMessageV16>",
  },
  "currencyNameV16": {
    description: "Configuration value: currencyNameV16.",
    default: "",
    example: "<currencyNameV16>",
  },
  "currencyEmojiV16": {
    description: "Configuration value: currencyEmojiV16.",
    default: "",
    example: "<currencyEmojiV16>",
  },
  "startingBalanceV16": {
    description: "Configuration value: startingBalanceV16.",
    default: "",
    example: "<startingBalanceV16>",
  },
  "dailyAmountV16": {
    description: "Configuration value: dailyAmountV16.",
    default: "",
    example: "<dailyAmountV16>",
  },
  "weeklyBonusV16": {
    description: "Configuration value: weeklyBonusV16.",
    default: "",
    example: "<weeklyBonusV16>",
  },
  "maxBankV16": {
    description: "Configuration value: maxBankV16.",
    default: "",
    example: "<maxBankV16>",
  },
  "workCooldownV16": {
    description: "Configuration value: workCooldownV16.",
    default: "",
    example: "<workCooldownV16>",
  },
  "maxMentionsV16": {
    description: "Configuration value: maxMentionsV16.",
    default: "",
    example: "<maxMentionsV16>",
  },
  "maxLinesV16": {
    description: "Configuration value: maxLinesV16.",
    default: "",
    example: "<maxLinesV16>",
  },
  "warnThresholdV16": {
    description: "Configuration value: warnThresholdV16.",
    default: "",
    example: "<warnThresholdV16>",
  },
  "dmWelcomeV16": {
    description: "Configuration value: dmWelcomeV16.",
    default: "",
    example: "<dmWelcomeV16>",
  },
  "logDeletesV16": {
    description: "Configuration value: logDeletesV16.",
    default: "",
    example: "<logDeletesV16>",
  },
  "logEditsV16": {
    description: "Configuration value: logEditsV16.",
    default: "",
    example: "<logEditsV16>",
  },
  "antiRaidV16": {
    description: "Configuration value: antiRaidV16.",
    default: "",
    example: "<antiRaidV16>",
  },
  "captchaOnJoinV16": {
    description: "Configuration value: captchaOnJoinV16.",
    default: "",
    example: "<captchaOnJoinV16>",
  },
  "accountAgeLimitDaysV16": {
    description: "Configuration value: accountAgeLimitDaysV16.",
    default: "",
    example: "<accountAgeLimitDaysV16>",
  },
  "aiEnabledV16": {
    description: "Configuration value: aiEnabledV16.",
    default: "",
    example: "<aiEnabledV16>",
  },
  "aiPersonalityV16": {
    description: "Configuration value: aiPersonalityV16.",
    default: "",
    example: "<aiPersonalityV16>",
  },
  "aiMaxTokensV16": {
    description: "Configuration value: aiMaxTokensV16.",
    default: "",
    example: "<aiMaxTokensV16>",
  },
  "suggestionChannelV16": {
    description: "Configuration value: suggestionChannelV16.",
    default: "",
    example: "<suggestionChannelV16>",
  },
  "feedbackChannelV16": {
    description: "Configuration value: feedbackChannelV16.",
    default: "",
    example: "<feedbackChannelV16>",
  },
  "countingChannelV16": {
    description: "Configuration value: countingChannelV16.",
    default: "",
    example: "<countingChannelV16>",
  },
  "starboardChannelV16": {
    description: "Configuration value: starboardChannelV16.",
    default: "",
    example: "<starboardChannelV16>",
  },
  "starboardThresholdV16": {
    description: "Configuration value: starboardThresholdV16.",
    default: "",
    example: "<starboardThresholdV16>",
  },
  "tempVoiceHubV16": {
    description: "Configuration value: tempVoiceHubV16.",
    default: "",
    example: "<tempVoiceHubV16>",
  },
  "streamChannelV16": {
    description: "Configuration value: streamChannelV16.",
    default: "",
    example: "<streamChannelV16>",
  },
  "verifyRoleV16": {
    description: "Configuration value: verifyRoleV16.",
    default: "",
    example: "<verifyRoleV16>",
  },
  "unverifiedRoleV16": {
    description: "Configuration value: unverifiedRoleV16.",
    default: "",
    example: "<unverifiedRoleV16>",
  },
  "shiftLogChannelV16": {
    description: "Configuration value: shiftLogChannelV16.",
    default: "",
    example: "<shiftLogChannelV16>",
  },
  "deptLogChannelV16": {
    description: "Configuration value: deptLogChannelV16.",
    default: "",
    example: "<deptLogChannelV16>",
  },
  "musicVolumeV16": {
    description: "Configuration value: musicVolumeV16.",
    default: "",
    example: "<musicVolumeV16>",
  },
  "djRoleV16": {
    description: "Configuration value: djRoleV16.",
    default: "",
    example: "<djRoleV16>",
  },
  "birthdayChannelV16": {
    description: "Configuration value: birthdayChannelV16.",
    default: "",
    example: "<birthdayChannelV16>",
  },
  "repCooldownV16": {
    description: "Configuration value: repCooldownV16.",
    default: "",
    example: "<repCooldownV16>",
  },
  "logChannelV17": {
    description: "Configuration value: logChannelV17.",
    default: "",
    example: "<logChannelV17>",
  },
  "welcomeChannelV17": {
    description: "Configuration value: welcomeChannelV17.",
    default: "",
    example: "<welcomeChannelV17>",
  },
  "goodbyeChannelV17": {
    description: "Configuration value: goodbyeChannelV17.",
    default: "",
    example: "<goodbyeChannelV17>",
  },
  "levelUpChannelV17": {
    description: "Configuration value: levelUpChannelV17.",
    default: "",
    example: "<levelUpChannelV17>",
  },
  "welcomeMessageV17": {
    description: "Configuration value: welcomeMessageV17.",
    default: "",
    example: "<welcomeMessageV17>",
  },
  "goodbyeMessageV17": {
    description: "Configuration value: goodbyeMessageV17.",
    default: "",
    example: "<goodbyeMessageV17>",
  },
  "currencyNameV17": {
    description: "Configuration value: currencyNameV17.",
    default: "",
    example: "<currencyNameV17>",
  },
  "currencyEmojiV17": {
    description: "Configuration value: currencyEmojiV17.",
    default: "",
    example: "<currencyEmojiV17>",
  },
  "startingBalanceV17": {
    description: "Configuration value: startingBalanceV17.",
    default: "",
    example: "<startingBalanceV17>",
  },
  "dailyAmountV17": {
    description: "Configuration value: dailyAmountV17.",
    default: "",
    example: "<dailyAmountV17>",
  },
  "weeklyBonusV17": {
    description: "Configuration value: weeklyBonusV17.",
    default: "",
    example: "<weeklyBonusV17>",
  },
  "maxBankV17": {
    description: "Configuration value: maxBankV17.",
    default: "",
    example: "<maxBankV17>",
  },
  "workCooldownV17": {
    description: "Configuration value: workCooldownV17.",
    default: "",
    example: "<workCooldownV17>",
  },
  "maxMentionsV17": {
    description: "Configuration value: maxMentionsV17.",
    default: "",
    example: "<maxMentionsV17>",
  },
  "maxLinesV17": {
    description: "Configuration value: maxLinesV17.",
    default: "",
    example: "<maxLinesV17>",
  },
  "warnThresholdV17": {
    description: "Configuration value: warnThresholdV17.",
    default: "",
    example: "<warnThresholdV17>",
  },
  "dmWelcomeV17": {
    description: "Configuration value: dmWelcomeV17.",
    default: "",
    example: "<dmWelcomeV17>",
  },
  "logDeletesV17": {
    description: "Configuration value: logDeletesV17.",
    default: "",
    example: "<logDeletesV17>",
  },
  "logEditsV17": {
    description: "Configuration value: logEditsV17.",
    default: "",
    example: "<logEditsV17>",
  },
  "antiRaidV17": {
    description: "Configuration value: antiRaidV17.",
    default: "",
    example: "<antiRaidV17>",
  },
  "captchaOnJoinV17": {
    description: "Configuration value: captchaOnJoinV17.",
    default: "",
    example: "<captchaOnJoinV17>",
  },
  "accountAgeLimitDaysV17": {
    description: "Configuration value: accountAgeLimitDaysV17.",
    default: "",
    example: "<accountAgeLimitDaysV17>",
  },
  "aiEnabledV17": {
    description: "Configuration value: aiEnabledV17.",
    default: "",
    example: "<aiEnabledV17>",
  },
  "aiPersonalityV17": {
    description: "Configuration value: aiPersonalityV17.",
    default: "",
    example: "<aiPersonalityV17>",
  },
  "aiMaxTokensV17": {
    description: "Configuration value: aiMaxTokensV17.",
    default: "",
    example: "<aiMaxTokensV17>",
  },
  "suggestionChannelV17": {
    description: "Configuration value: suggestionChannelV17.",
    default: "",
    example: "<suggestionChannelV17>",
  },
  "feedbackChannelV17": {
    description: "Configuration value: feedbackChannelV17.",
    default: "",
    example: "<feedbackChannelV17>",
  },
  "countingChannelV17": {
    description: "Configuration value: countingChannelV17.",
    default: "",
    example: "<countingChannelV17>",
  },
  "starboardChannelV17": {
    description: "Configuration value: starboardChannelV17.",
    default: "",
    example: "<starboardChannelV17>",
  },
  "starboardThresholdV17": {
    description: "Configuration value: starboardThresholdV17.",
    default: "",
    example: "<starboardThresholdV17>",
  },
  "tempVoiceHubV17": {
    description: "Configuration value: tempVoiceHubV17.",
    default: "",
    example: "<tempVoiceHubV17>",
  },
  "streamChannelV17": {
    description: "Configuration value: streamChannelV17.",
    default: "",
    example: "<streamChannelV17>",
  },
  "verifyRoleV17": {
    description: "Configuration value: verifyRoleV17.",
    default: "",
    example: "<verifyRoleV17>",
  },
  "unverifiedRoleV17": {
    description: "Configuration value: unverifiedRoleV17.",
    default: "",
    example: "<unverifiedRoleV17>",
  },
  "shiftLogChannelV17": {
    description: "Configuration value: shiftLogChannelV17.",
    default: "",
    example: "<shiftLogChannelV17>",
  },
  "deptLogChannelV17": {
    description: "Configuration value: deptLogChannelV17.",
    default: "",
    example: "<deptLogChannelV17>",
  },
  "musicVolumeV17": {
    description: "Configuration value: musicVolumeV17.",
    default: "",
    example: "<musicVolumeV17>",
  },
  "djRoleV17": {
    description: "Configuration value: djRoleV17.",
    default: "",
    example: "<djRoleV17>",
  },
  "birthdayChannelV17": {
    description: "Configuration value: birthdayChannelV17.",
    default: "",
    example: "<birthdayChannelV17>",
  },
  "repCooldownV17": {
    description: "Configuration value: repCooldownV17.",
    default: "",
    example: "<repCooldownV17>",
  },
  "logChannelV18": {
    description: "Configuration value: logChannelV18.",
    default: "",
    example: "<logChannelV18>",
  },
  "welcomeChannelV18": {
    description: "Configuration value: welcomeChannelV18.",
    default: "",
    example: "<welcomeChannelV18>",
  },
  "goodbyeChannelV18": {
    description: "Configuration value: goodbyeChannelV18.",
    default: "",
    example: "<goodbyeChannelV18>",
  },
  "levelUpChannelV18": {
    description: "Configuration value: levelUpChannelV18.",
    default: "",
    example: "<levelUpChannelV18>",
  },
  "welcomeMessageV18": {
    description: "Configuration value: welcomeMessageV18.",
    default: "",
    example: "<welcomeMessageV18>",
  },
  "goodbyeMessageV18": {
    description: "Configuration value: goodbyeMessageV18.",
    default: "",
    example: "<goodbyeMessageV18>",
  },
  "currencyNameV18": {
    description: "Configuration value: currencyNameV18.",
    default: "",
    example: "<currencyNameV18>",
  },
  "currencyEmojiV18": {
    description: "Configuration value: currencyEmojiV18.",
    default: "",
    example: "<currencyEmojiV18>",
  },
  "startingBalanceV18": {
    description: "Configuration value: startingBalanceV18.",
    default: "",
    example: "<startingBalanceV18>",
  },
  "dailyAmountV18": {
    description: "Configuration value: dailyAmountV18.",
    default: "",
    example: "<dailyAmountV18>",
  },
  "weeklyBonusV18": {
    description: "Configuration value: weeklyBonusV18.",
    default: "",
    example: "<weeklyBonusV18>",
  },
  "maxBankV18": {
    description: "Configuration value: maxBankV18.",
    default: "",
    example: "<maxBankV18>",
  },
  "workCooldownV18": {
    description: "Configuration value: workCooldownV18.",
    default: "",
    example: "<workCooldownV18>",
  },
  "maxMentionsV18": {
    description: "Configuration value: maxMentionsV18.",
    default: "",
    example: "<maxMentionsV18>",
  },
  "maxLinesV18": {
    description: "Configuration value: maxLinesV18.",
    default: "",
    example: "<maxLinesV18>",
  },
  "warnThresholdV18": {
    description: "Configuration value: warnThresholdV18.",
    default: "",
    example: "<warnThresholdV18>",
  },
  "dmWelcomeV18": {
    description: "Configuration value: dmWelcomeV18.",
    default: "",
    example: "<dmWelcomeV18>",
  },
  "logDeletesV18": {
    description: "Configuration value: logDeletesV18.",
    default: "",
    example: "<logDeletesV18>",
  },
  "logEditsV18": {
    description: "Configuration value: logEditsV18.",
    default: "",
    example: "<logEditsV18>",
  },
  "antiRaidV18": {
    description: "Configuration value: antiRaidV18.",
    default: "",
    example: "<antiRaidV18>",
  },
  "captchaOnJoinV18": {
    description: "Configuration value: captchaOnJoinV18.",
    default: "",
    example: "<captchaOnJoinV18>",
  },
  "accountAgeLimitDaysV18": {
    description: "Configuration value: accountAgeLimitDaysV18.",
    default: "",
    example: "<accountAgeLimitDaysV18>",
  },
  "aiEnabledV18": {
    description: "Configuration value: aiEnabledV18.",
    default: "",
    example: "<aiEnabledV18>",
  },
  "aiPersonalityV18": {
    description: "Configuration value: aiPersonalityV18.",
    default: "",
    example: "<aiPersonalityV18>",
  },
  "aiMaxTokensV18": {
    description: "Configuration value: aiMaxTokensV18.",
    default: "",
    example: "<aiMaxTokensV18>",
  },
  "suggestionChannelV18": {
    description: "Configuration value: suggestionChannelV18.",
    default: "",
    example: "<suggestionChannelV18>",
  },
  "feedbackChannelV18": {
    description: "Configuration value: feedbackChannelV18.",
    default: "",
    example: "<feedbackChannelV18>",
  },
  "countingChannelV18": {
    description: "Configuration value: countingChannelV18.",
    default: "",
    example: "<countingChannelV18>",
  },
  "starboardChannelV18": {
    description: "Configuration value: starboardChannelV18.",
    default: "",
    example: "<starboardChannelV18>",
  },
  "starboardThresholdV18": {
    description: "Configuration value: starboardThresholdV18.",
    default: "",
    example: "<starboardThresholdV18>",
  },
  "tempVoiceHubV18": {
    description: "Configuration value: tempVoiceHubV18.",
    default: "",
    example: "<tempVoiceHubV18>",
  },
  "streamChannelV18": {
    description: "Configuration value: streamChannelV18.",
    default: "",
    example: "<streamChannelV18>",
  },
  "verifyRoleV18": {
    description: "Configuration value: verifyRoleV18.",
    default: "",
    example: "<verifyRoleV18>",
  },
  "unverifiedRoleV18": {
    description: "Configuration value: unverifiedRoleV18.",
    default: "",
    example: "<unverifiedRoleV18>",
  },
  "shiftLogChannelV18": {
    description: "Configuration value: shiftLogChannelV18.",
    default: "",
    example: "<shiftLogChannelV18>",
  },
  "deptLogChannelV18": {
    description: "Configuration value: deptLogChannelV18.",
    default: "",
    example: "<deptLogChannelV18>",
  },
  "musicVolumeV18": {
    description: "Configuration value: musicVolumeV18.",
    default: "",
    example: "<musicVolumeV18>",
  },
  "djRoleV18": {
    description: "Configuration value: djRoleV18.",
    default: "",
    example: "<djRoleV18>",
  },
  "birthdayChannelV18": {
    description: "Configuration value: birthdayChannelV18.",
    default: "",
    example: "<birthdayChannelV18>",
  },
  "repCooldownV18": {
    description: "Configuration value: repCooldownV18.",
    default: "",
    example: "<repCooldownV18>",
  },
  "logChannelV19": {
    description: "Configuration value: logChannelV19.",
    default: "",
    example: "<logChannelV19>",
  },
  "welcomeChannelV19": {
    description: "Configuration value: welcomeChannelV19.",
    default: "",
    example: "<welcomeChannelV19>",
  },
  "goodbyeChannelV19": {
    description: "Configuration value: goodbyeChannelV19.",
    default: "",
    example: "<goodbyeChannelV19>",
  },
  "levelUpChannelV19": {
    description: "Configuration value: levelUpChannelV19.",
    default: "",
    example: "<levelUpChannelV19>",
  },
  "welcomeMessageV19": {
    description: "Configuration value: welcomeMessageV19.",
    default: "",
    example: "<welcomeMessageV19>",
  },
  "goodbyeMessageV19": {
    description: "Configuration value: goodbyeMessageV19.",
    default: "",
    example: "<goodbyeMessageV19>",
  },
  "currencyNameV19": {
    description: "Configuration value: currencyNameV19.",
    default: "",
    example: "<currencyNameV19>",
  },
  "currencyEmojiV19": {
    description: "Configuration value: currencyEmojiV19.",
    default: "",
    example: "<currencyEmojiV19>",
  },
  "startingBalanceV19": {
    description: "Configuration value: startingBalanceV19.",
    default: "",
    example: "<startingBalanceV19>",
  },
  "dailyAmountV19": {
    description: "Configuration value: dailyAmountV19.",
    default: "",
    example: "<dailyAmountV19>",
  },
  "weeklyBonusV19": {
    description: "Configuration value: weeklyBonusV19.",
    default: "",
    example: "<weeklyBonusV19>",
  },
  "maxBankV19": {
    description: "Configuration value: maxBankV19.",
    default: "",
    example: "<maxBankV19>",
  },
  "workCooldownV19": {
    description: "Configuration value: workCooldownV19.",
    default: "",
    example: "<workCooldownV19>",
  },
  "maxMentionsV19": {
    description: "Configuration value: maxMentionsV19.",
    default: "",
    example: "<maxMentionsV19>",
  },
  "maxLinesV19": {
    description: "Configuration value: maxLinesV19.",
    default: "",
    example: "<maxLinesV19>",
  },
  "warnThresholdV19": {
    description: "Configuration value: warnThresholdV19.",
    default: "",
    example: "<warnThresholdV19>",
  },
  "dmWelcomeV19": {
    description: "Configuration value: dmWelcomeV19.",
    default: "",
    example: "<dmWelcomeV19>",
  },
  "logDeletesV19": {
    description: "Configuration value: logDeletesV19.",
    default: "",
    example: "<logDeletesV19>",
  },
  "logEditsV19": {
    description: "Configuration value: logEditsV19.",
    default: "",
    example: "<logEditsV19>",
  },
  "antiRaidV19": {
    description: "Configuration value: antiRaidV19.",
    default: "",
    example: "<antiRaidV19>",
  },
  "captchaOnJoinV19": {
    description: "Configuration value: captchaOnJoinV19.",
    default: "",
    example: "<captchaOnJoinV19>",
  },
  "accountAgeLimitDaysV19": {
    description: "Configuration value: accountAgeLimitDaysV19.",
    default: "",
    example: "<accountAgeLimitDaysV19>",
  },
  "aiEnabledV19": {
    description: "Configuration value: aiEnabledV19.",
    default: "",
    example: "<aiEnabledV19>",
  },
  "aiPersonalityV19": {
    description: "Configuration value: aiPersonalityV19.",
    default: "",
    example: "<aiPersonalityV19>",
  },
  "aiMaxTokensV19": {
    description: "Configuration value: aiMaxTokensV19.",
    default: "",
    example: "<aiMaxTokensV19>",
  },
  "suggestionChannelV19": {
    description: "Configuration value: suggestionChannelV19.",
    default: "",
    example: "<suggestionChannelV19>",
  },
  "feedbackChannelV19": {
    description: "Configuration value: feedbackChannelV19.",
    default: "",
    example: "<feedbackChannelV19>",
  },
  "countingChannelV19": {
    description: "Configuration value: countingChannelV19.",
    default: "",
    example: "<countingChannelV19>",
  },
  "starboardChannelV19": {
    description: "Configuration value: starboardChannelV19.",
    default: "",
    example: "<starboardChannelV19>",
  },
  "starboardThresholdV19": {
    description: "Configuration value: starboardThresholdV19.",
    default: "",
    example: "<starboardThresholdV19>",
  },
  "tempVoiceHubV19": {
    description: "Configuration value: tempVoiceHubV19.",
    default: "",
    example: "<tempVoiceHubV19>",
  },
  "streamChannelV19": {
    description: "Configuration value: streamChannelV19.",
    default: "",
    example: "<streamChannelV19>",
  },
  "verifyRoleV19": {
    description: "Configuration value: verifyRoleV19.",
    default: "",
    example: "<verifyRoleV19>",
  },
  "unverifiedRoleV19": {
    description: "Configuration value: unverifiedRoleV19.",
    default: "",
    example: "<unverifiedRoleV19>",
  },
  "shiftLogChannelV19": {
    description: "Configuration value: shiftLogChannelV19.",
    default: "",
    example: "<shiftLogChannelV19>",
  },
  "deptLogChannelV19": {
    description: "Configuration value: deptLogChannelV19.",
    default: "",
    example: "<deptLogChannelV19>",
  },
  "musicVolumeV19": {
    description: "Configuration value: musicVolumeV19.",
    default: "",
    example: "<musicVolumeV19>",
  },
  "djRoleV19": {
    description: "Configuration value: djRoleV19.",
    default: "",
    example: "<djRoleV19>",
  },
  "birthdayChannelV19": {
    description: "Configuration value: birthdayChannelV19.",
    default: "",
    example: "<birthdayChannelV19>",
  },
  "repCooldownV19": {
    description: "Configuration value: repCooldownV19.",
    default: "",
    example: "<repCooldownV19>",
  },
  "logChannelV20": {
    description: "Configuration value: logChannelV20.",
    default: "",
    example: "<logChannelV20>",
  },
  "welcomeChannelV20": {
    description: "Configuration value: welcomeChannelV20.",
    default: "",
    example: "<welcomeChannelV20>",
  },
  "goodbyeChannelV20": {
    description: "Configuration value: goodbyeChannelV20.",
    default: "",
    example: "<goodbyeChannelV20>",
  },
  "levelUpChannelV20": {
    description: "Configuration value: levelUpChannelV20.",
    default: "",
    example: "<levelUpChannelV20>",
  },
  "welcomeMessageV20": {
    description: "Configuration value: welcomeMessageV20.",
    default: "",
    example: "<welcomeMessageV20>",
  },
  "goodbyeMessageV20": {
    description: "Configuration value: goodbyeMessageV20.",
    default: "",
    example: "<goodbyeMessageV20>",
  },
  "currencyNameV20": {
    description: "Configuration value: currencyNameV20.",
    default: "",
    example: "<currencyNameV20>",
  },
  "currencyEmojiV20": {
    description: "Configuration value: currencyEmojiV20.",
    default: "",
    example: "<currencyEmojiV20>",
  },
  "startingBalanceV20": {
    description: "Configuration value: startingBalanceV20.",
    default: "",
    example: "<startingBalanceV20>",
  },
  "dailyAmountV20": {
    description: "Configuration value: dailyAmountV20.",
    default: "",
    example: "<dailyAmountV20>",
  },
  "weeklyBonusV20": {
    description: "Configuration value: weeklyBonusV20.",
    default: "",
    example: "<weeklyBonusV20>",
  },
  "maxBankV20": {
    description: "Configuration value: maxBankV20.",
    default: "",
    example: "<maxBankV20>",
  },
  "workCooldownV20": {
    description: "Configuration value: workCooldownV20.",
    default: "",
    example: "<workCooldownV20>",
  },
  "maxMentionsV20": {
    description: "Configuration value: maxMentionsV20.",
    default: "",
    example: "<maxMentionsV20>",
  },
  "maxLinesV20": {
    description: "Configuration value: maxLinesV20.",
    default: "",
    example: "<maxLinesV20>",
  },
  "warnThresholdV20": {
    description: "Configuration value: warnThresholdV20.",
    default: "",
    example: "<warnThresholdV20>",
  },
  "dmWelcomeV20": {
    description: "Configuration value: dmWelcomeV20.",
    default: "",
    example: "<dmWelcomeV20>",
  },
  "logDeletesV20": {
    description: "Configuration value: logDeletesV20.",
    default: "",
    example: "<logDeletesV20>",
  },
  "logEditsV20": {
    description: "Configuration value: logEditsV20.",
    default: "",
    example: "<logEditsV20>",
  },
  "antiRaidV20": {
    description: "Configuration value: antiRaidV20.",
    default: "",
    example: "<antiRaidV20>",
  },
  "captchaOnJoinV20": {
    description: "Configuration value: captchaOnJoinV20.",
    default: "",
    example: "<captchaOnJoinV20>",
  },
  "accountAgeLimitDaysV20": {
    description: "Configuration value: accountAgeLimitDaysV20.",
    default: "",
    example: "<accountAgeLimitDaysV20>",
  },
  "aiEnabledV20": {
    description: "Configuration value: aiEnabledV20.",
    default: "",
    example: "<aiEnabledV20>",
  },
  "aiPersonalityV20": {
    description: "Configuration value: aiPersonalityV20.",
    default: "",
    example: "<aiPersonalityV20>",
  },
  "aiMaxTokensV20": {
    description: "Configuration value: aiMaxTokensV20.",
    default: "",
    example: "<aiMaxTokensV20>",
  },
  "suggestionChannelV20": {
    description: "Configuration value: suggestionChannelV20.",
    default: "",
    example: "<suggestionChannelV20>",
  },
  "feedbackChannelV20": {
    description: "Configuration value: feedbackChannelV20.",
    default: "",
    example: "<feedbackChannelV20>",
  },
  "countingChannelV20": {
    description: "Configuration value: countingChannelV20.",
    default: "",
    example: "<countingChannelV20>",
  },
  "starboardChannelV20": {
    description: "Configuration value: starboardChannelV20.",
    default: "",
    example: "<starboardChannelV20>",
  },
  "starboardThresholdV20": {
    description: "Configuration value: starboardThresholdV20.",
    default: "",
    example: "<starboardThresholdV20>",
  },
  "tempVoiceHubV20": {
    description: "Configuration value: tempVoiceHubV20.",
    default: "",
    example: "<tempVoiceHubV20>",
  },
  "streamChannelV20": {
    description: "Configuration value: streamChannelV20.",
    default: "",
    example: "<streamChannelV20>",
  },
  "verifyRoleV20": {
    description: "Configuration value: verifyRoleV20.",
    default: "",
    example: "<verifyRoleV20>",
  },
  "unverifiedRoleV20": {
    description: "Configuration value: unverifiedRoleV20.",
    default: "",
    example: "<unverifiedRoleV20>",
  },
  "shiftLogChannelV20": {
    description: "Configuration value: shiftLogChannelV20.",
    default: "",
    example: "<shiftLogChannelV20>",
  },
  "deptLogChannelV20": {
    description: "Configuration value: deptLogChannelV20.",
    default: "",
    example: "<deptLogChannelV20>",
  },
  "musicVolumeV20": {
    description: "Configuration value: musicVolumeV20.",
    default: "",
    example: "<musicVolumeV20>",
  },
  "djRoleV20": {
    description: "Configuration value: djRoleV20.",
    default: "",
    example: "<djRoleV20>",
  },
  "birthdayChannelV20": {
    description: "Configuration value: birthdayChannelV20.",
    default: "",
    example: "<birthdayChannelV20>",
  },
  "repCooldownV20": {
    description: "Configuration value: repCooldownV20.",
    default: "",
    example: "<repCooldownV20>",
  },
  "logChannelV21": {
    description: "Configuration value: logChannelV21.",
    default: "",
    example: "<logChannelV21>",
  },
  "welcomeChannelV21": {
    description: "Configuration value: welcomeChannelV21.",
    default: "",
    example: "<welcomeChannelV21>",
  },
  "goodbyeChannelV21": {
    description: "Configuration value: goodbyeChannelV21.",
    default: "",
    example: "<goodbyeChannelV21>",
  },
  "levelUpChannelV21": {
    description: "Configuration value: levelUpChannelV21.",
    default: "",
    example: "<levelUpChannelV21>",
  },
  "welcomeMessageV21": {
    description: "Configuration value: welcomeMessageV21.",
    default: "",
    example: "<welcomeMessageV21>",
  },
  "goodbyeMessageV21": {
    description: "Configuration value: goodbyeMessageV21.",
    default: "",
    example: "<goodbyeMessageV21>",
  },
  "currencyNameV21": {
    description: "Configuration value: currencyNameV21.",
    default: "",
    example: "<currencyNameV21>",
  },
  "currencyEmojiV21": {
    description: "Configuration value: currencyEmojiV21.",
    default: "",
    example: "<currencyEmojiV21>",
  },
  "startingBalanceV21": {
    description: "Configuration value: startingBalanceV21.",
    default: "",
    example: "<startingBalanceV21>",
  },
  "dailyAmountV21": {
    description: "Configuration value: dailyAmountV21.",
    default: "",
    example: "<dailyAmountV21>",
  },
  "weeklyBonusV21": {
    description: "Configuration value: weeklyBonusV21.",
    default: "",
    example: "<weeklyBonusV21>",
  },
  "maxBankV21": {
    description: "Configuration value: maxBankV21.",
    default: "",
    example: "<maxBankV21>",
  },
  "workCooldownV21": {
    description: "Configuration value: workCooldownV21.",
    default: "",
    example: "<workCooldownV21>",
  },
  "maxMentionsV21": {
    description: "Configuration value: maxMentionsV21.",
    default: "",
    example: "<maxMentionsV21>",
  },
  "maxLinesV21": {
    description: "Configuration value: maxLinesV21.",
    default: "",
    example: "<maxLinesV21>",
  },
  "warnThresholdV21": {
    description: "Configuration value: warnThresholdV21.",
    default: "",
    example: "<warnThresholdV21>",
  },
  "dmWelcomeV21": {
    description: "Configuration value: dmWelcomeV21.",
    default: "",
    example: "<dmWelcomeV21>",
  },
  "logDeletesV21": {
    description: "Configuration value: logDeletesV21.",
    default: "",
    example: "<logDeletesV21>",
  },
  "logEditsV21": {
    description: "Configuration value: logEditsV21.",
    default: "",
    example: "<logEditsV21>",
  },
  "antiRaidV21": {
    description: "Configuration value: antiRaidV21.",
    default: "",
    example: "<antiRaidV21>",
  },
  "captchaOnJoinV21": {
    description: "Configuration value: captchaOnJoinV21.",
    default: "",
    example: "<captchaOnJoinV21>",
  },
  "accountAgeLimitDaysV21": {
    description: "Configuration value: accountAgeLimitDaysV21.",
    default: "",
    example: "<accountAgeLimitDaysV21>",
  },
  "aiEnabledV21": {
    description: "Configuration value: aiEnabledV21.",
    default: "",
    example: "<aiEnabledV21>",
  },
  "aiPersonalityV21": {
    description: "Configuration value: aiPersonalityV21.",
    default: "",
    example: "<aiPersonalityV21>",
  },
  "aiMaxTokensV21": {
    description: "Configuration value: aiMaxTokensV21.",
    default: "",
    example: "<aiMaxTokensV21>",
  },
  "suggestionChannelV21": {
    description: "Configuration value: suggestionChannelV21.",
    default: "",
    example: "<suggestionChannelV21>",
  },
  "feedbackChannelV21": {
    description: "Configuration value: feedbackChannelV21.",
    default: "",
    example: "<feedbackChannelV21>",
  },
  "countingChannelV21": {
    description: "Configuration value: countingChannelV21.",
    default: "",
    example: "<countingChannelV21>",
  },
  "starboardChannelV21": {
    description: "Configuration value: starboardChannelV21.",
    default: "",
    example: "<starboardChannelV21>",
  },
  "starboardThresholdV21": {
    description: "Configuration value: starboardThresholdV21.",
    default: "",
    example: "<starboardThresholdV21>",
  },
  "tempVoiceHubV21": {
    description: "Configuration value: tempVoiceHubV21.",
    default: "",
    example: "<tempVoiceHubV21>",
  },
  "streamChannelV21": {
    description: "Configuration value: streamChannelV21.",
    default: "",
    example: "<streamChannelV21>",
  },
  "verifyRoleV21": {
    description: "Configuration value: verifyRoleV21.",
    default: "",
    example: "<verifyRoleV21>",
  },
  "unverifiedRoleV21": {
    description: "Configuration value: unverifiedRoleV21.",
    default: "",
    example: "<unverifiedRoleV21>",
  },
  "shiftLogChannelV21": {
    description: "Configuration value: shiftLogChannelV21.",
    default: "",
    example: "<shiftLogChannelV21>",
  },
  "deptLogChannelV21": {
    description: "Configuration value: deptLogChannelV21.",
    default: "",
    example: "<deptLogChannelV21>",
  },
  "musicVolumeV21": {
    description: "Configuration value: musicVolumeV21.",
    default: "",
    example: "<musicVolumeV21>",
  },
  "djRoleV21": {
    description: "Configuration value: djRoleV21.",
    default: "",
    example: "<djRoleV21>",
  },
  "birthdayChannelV21": {
    description: "Configuration value: birthdayChannelV21.",
    default: "",
    example: "<birthdayChannelV21>",
  },
  "repCooldownV21": {
    description: "Configuration value: repCooldownV21.",
    default: "",
    example: "<repCooldownV21>",
  },
  "logChannelV22": {
    description: "Configuration value: logChannelV22.",
    default: "",
    example: "<logChannelV22>",
  },
  "welcomeChannelV22": {
    description: "Configuration value: welcomeChannelV22.",
    default: "",
    example: "<welcomeChannelV22>",
  },
  "goodbyeChannelV22": {
    description: "Configuration value: goodbyeChannelV22.",
    default: "",
    example: "<goodbyeChannelV22>",
  },
  "levelUpChannelV22": {
    description: "Configuration value: levelUpChannelV22.",
    default: "",
    example: "<levelUpChannelV22>",
  },
  "welcomeMessageV22": {
    description: "Configuration value: welcomeMessageV22.",
    default: "",
    example: "<welcomeMessageV22>",
  },
  "goodbyeMessageV22": {
    description: "Configuration value: goodbyeMessageV22.",
    default: "",
    example: "<goodbyeMessageV22>",
  },
  "currencyNameV22": {
    description: "Configuration value: currencyNameV22.",
    default: "",
    example: "<currencyNameV22>",
  },
  "currencyEmojiV22": {
    description: "Configuration value: currencyEmojiV22.",
    default: "",
    example: "<currencyEmojiV22>",
  },
  "startingBalanceV22": {
    description: "Configuration value: startingBalanceV22.",
    default: "",
    example: "<startingBalanceV22>",
  },
  "dailyAmountV22": {
    description: "Configuration value: dailyAmountV22.",
    default: "",
    example: "<dailyAmountV22>",
  },
  "weeklyBonusV22": {
    description: "Configuration value: weeklyBonusV22.",
    default: "",
    example: "<weeklyBonusV22>",
  },
  "maxBankV22": {
    description: "Configuration value: maxBankV22.",
    default: "",
    example: "<maxBankV22>",
  },
  "workCooldownV22": {
    description: "Configuration value: workCooldownV22.",
    default: "",
    example: "<workCooldownV22>",
  },
  "maxMentionsV22": {
    description: "Configuration value: maxMentionsV22.",
    default: "",
    example: "<maxMentionsV22>",
  },
  "maxLinesV22": {
    description: "Configuration value: maxLinesV22.",
    default: "",
    example: "<maxLinesV22>",
  },
  "warnThresholdV22": {
    description: "Configuration value: warnThresholdV22.",
    default: "",
    example: "<warnThresholdV22>",
  },
  "dmWelcomeV22": {
    description: "Configuration value: dmWelcomeV22.",
    default: "",
    example: "<dmWelcomeV22>",
  },
  "logDeletesV22": {
    description: "Configuration value: logDeletesV22.",
    default: "",
    example: "<logDeletesV22>",
  },
  "logEditsV22": {
    description: "Configuration value: logEditsV22.",
    default: "",
    example: "<logEditsV22>",
  },
  "antiRaidV22": {
    description: "Configuration value: antiRaidV22.",
    default: "",
    example: "<antiRaidV22>",
  },
  "captchaOnJoinV22": {
    description: "Configuration value: captchaOnJoinV22.",
    default: "",
    example: "<captchaOnJoinV22>",
  },
  "accountAgeLimitDaysV22": {
    description: "Configuration value: accountAgeLimitDaysV22.",
    default: "",
    example: "<accountAgeLimitDaysV22>",
  },
  "aiEnabledV22": {
    description: "Configuration value: aiEnabledV22.",
    default: "",
    example: "<aiEnabledV22>",
  },
  "aiPersonalityV22": {
    description: "Configuration value: aiPersonalityV22.",
    default: "",
    example: "<aiPersonalityV22>",
  },
  "aiMaxTokensV22": {
    description: "Configuration value: aiMaxTokensV22.",
    default: "",
    example: "<aiMaxTokensV22>",
  },
  "suggestionChannelV22": {
    description: "Configuration value: suggestionChannelV22.",
    default: "",
    example: "<suggestionChannelV22>",
  },
  "feedbackChannelV22": {
    description: "Configuration value: feedbackChannelV22.",
    default: "",
    example: "<feedbackChannelV22>",
  },
  "countingChannelV22": {
    description: "Configuration value: countingChannelV22.",
    default: "",
    example: "<countingChannelV22>",
  },
  "starboardChannelV22": {
    description: "Configuration value: starboardChannelV22.",
    default: "",
    example: "<starboardChannelV22>",
  },
  "starboardThresholdV22": {
    description: "Configuration value: starboardThresholdV22.",
    default: "",
    example: "<starboardThresholdV22>",
  },
  "tempVoiceHubV22": {
    description: "Configuration value: tempVoiceHubV22.",
    default: "",
    example: "<tempVoiceHubV22>",
  },
  "streamChannelV22": {
    description: "Configuration value: streamChannelV22.",
    default: "",
    example: "<streamChannelV22>",
  },
  "verifyRoleV22": {
    description: "Configuration value: verifyRoleV22.",
    default: "",
    example: "<verifyRoleV22>",
  },
  "unverifiedRoleV22": {
    description: "Configuration value: unverifiedRoleV22.",
    default: "",
    example: "<unverifiedRoleV22>",
  },
  "shiftLogChannelV22": {
    description: "Configuration value: shiftLogChannelV22.",
    default: "",
    example: "<shiftLogChannelV22>",
  },
  "deptLogChannelV22": {
    description: "Configuration value: deptLogChannelV22.",
    default: "",
    example: "<deptLogChannelV22>",
  },
  "musicVolumeV22": {
    description: "Configuration value: musicVolumeV22.",
    default: "",
    example: "<musicVolumeV22>",
  },
  "djRoleV22": {
    description: "Configuration value: djRoleV22.",
    default: "",
    example: "<djRoleV22>",
  },
  "birthdayChannelV22": {
    description: "Configuration value: birthdayChannelV22.",
    default: "",
    example: "<birthdayChannelV22>",
  },
  "repCooldownV22": {
    description: "Configuration value: repCooldownV22.",
    default: "",
    example: "<repCooldownV22>",
  },
  "logChannelV23": {
    description: "Configuration value: logChannelV23.",
    default: "",
    example: "<logChannelV23>",
  },
  "welcomeChannelV23": {
    description: "Configuration value: welcomeChannelV23.",
    default: "",
    example: "<welcomeChannelV23>",
  },
  "goodbyeChannelV23": {
    description: "Configuration value: goodbyeChannelV23.",
    default: "",
    example: "<goodbyeChannelV23>",
  },
  "levelUpChannelV23": {
    description: "Configuration value: levelUpChannelV23.",
    default: "",
    example: "<levelUpChannelV23>",
  },
  "welcomeMessageV23": {
    description: "Configuration value: welcomeMessageV23.",
    default: "",
    example: "<welcomeMessageV23>",
  },
  "goodbyeMessageV23": {
    description: "Configuration value: goodbyeMessageV23.",
    default: "",
    example: "<goodbyeMessageV23>",
  },
  "currencyNameV23": {
    description: "Configuration value: currencyNameV23.",
    default: "",
    example: "<currencyNameV23>",
  },
  "currencyEmojiV23": {
    description: "Configuration value: currencyEmojiV23.",
    default: "",
    example: "<currencyEmojiV23>",
  },
  "startingBalanceV23": {
    description: "Configuration value: startingBalanceV23.",
    default: "",
    example: "<startingBalanceV23>",
  },
  "dailyAmountV23": {
    description: "Configuration value: dailyAmountV23.",
    default: "",
    example: "<dailyAmountV23>",
  },
  "weeklyBonusV23": {
    description: "Configuration value: weeklyBonusV23.",
    default: "",
    example: "<weeklyBonusV23>",
  },
  "maxBankV23": {
    description: "Configuration value: maxBankV23.",
    default: "",
    example: "<maxBankV23>",
  },
  "workCooldownV23": {
    description: "Configuration value: workCooldownV23.",
    default: "",
    example: "<workCooldownV23>",
  },
  "maxMentionsV23": {
    description: "Configuration value: maxMentionsV23.",
    default: "",
    example: "<maxMentionsV23>",
  },
  "maxLinesV23": {
    description: "Configuration value: maxLinesV23.",
    default: "",
    example: "<maxLinesV23>",
  },
  "warnThresholdV23": {
    description: "Configuration value: warnThresholdV23.",
    default: "",
    example: "<warnThresholdV23>",
  },
  "dmWelcomeV23": {
    description: "Configuration value: dmWelcomeV23.",
    default: "",
    example: "<dmWelcomeV23>",
  },
  "logDeletesV23": {
    description: "Configuration value: logDeletesV23.",
    default: "",
    example: "<logDeletesV23>",
  },
  "logEditsV23": {
    description: "Configuration value: logEditsV23.",
    default: "",
    example: "<logEditsV23>",
  },
  "antiRaidV23": {
    description: "Configuration value: antiRaidV23.",
    default: "",
    example: "<antiRaidV23>",
  },
  "captchaOnJoinV23": {
    description: "Configuration value: captchaOnJoinV23.",
    default: "",
    example: "<captchaOnJoinV23>",
  },
  "accountAgeLimitDaysV23": {
    description: "Configuration value: accountAgeLimitDaysV23.",
    default: "",
    example: "<accountAgeLimitDaysV23>",
  },
  "aiEnabledV23": {
    description: "Configuration value: aiEnabledV23.",
    default: "",
    example: "<aiEnabledV23>",
  },
  "aiPersonalityV23": {
    description: "Configuration value: aiPersonalityV23.",
    default: "",
    example: "<aiPersonalityV23>",
  },
  "aiMaxTokensV23": {
    description: "Configuration value: aiMaxTokensV23.",
    default: "",
    example: "<aiMaxTokensV23>",
  },
  "suggestionChannelV23": {
    description: "Configuration value: suggestionChannelV23.",
    default: "",
    example: "<suggestionChannelV23>",
  },
  "feedbackChannelV23": {
    description: "Configuration value: feedbackChannelV23.",
    default: "",
    example: "<feedbackChannelV23>",
  },
  "countingChannelV23": {
    description: "Configuration value: countingChannelV23.",
    default: "",
    example: "<countingChannelV23>",
  },
  "starboardChannelV23": {
    description: "Configuration value: starboardChannelV23.",
    default: "",
    example: "<starboardChannelV23>",
  },
  "starboardThresholdV23": {
    description: "Configuration value: starboardThresholdV23.",
    default: "",
    example: "<starboardThresholdV23>",
  },
  "tempVoiceHubV23": {
    description: "Configuration value: tempVoiceHubV23.",
    default: "",
    example: "<tempVoiceHubV23>",
  },
  "streamChannelV23": {
    description: "Configuration value: streamChannelV23.",
    default: "",
    example: "<streamChannelV23>",
  },
  "verifyRoleV23": {
    description: "Configuration value: verifyRoleV23.",
    default: "",
    example: "<verifyRoleV23>",
  },
  "unverifiedRoleV23": {
    description: "Configuration value: unverifiedRoleV23.",
    default: "",
    example: "<unverifiedRoleV23>",
  },
  "shiftLogChannelV23": {
    description: "Configuration value: shiftLogChannelV23.",
    default: "",
    example: "<shiftLogChannelV23>",
  },
  "deptLogChannelV23": {
    description: "Configuration value: deptLogChannelV23.",
    default: "",
    example: "<deptLogChannelV23>",
  },
  "musicVolumeV23": {
    description: "Configuration value: musicVolumeV23.",
    default: "",
    example: "<musicVolumeV23>",
  },
  "djRoleV23": {
    description: "Configuration value: djRoleV23.",
    default: "",
    example: "<djRoleV23>",
  },
  "birthdayChannelV23": {
    description: "Configuration value: birthdayChannelV23.",
    default: "",
    example: "<birthdayChannelV23>",
  },
  "repCooldownV23": {
    description: "Configuration value: repCooldownV23.",
    default: "",
    example: "<repCooldownV23>",
  },
  "logChannelV24": {
    description: "Configuration value: logChannelV24.",
    default: "",
    example: "<logChannelV24>",
  },
  "welcomeChannelV24": {
    description: "Configuration value: welcomeChannelV24.",
    default: "",
    example: "<welcomeChannelV24>",
  },
  "goodbyeChannelV24": {
    description: "Configuration value: goodbyeChannelV24.",
    default: "",
    example: "<goodbyeChannelV24>",
  },
  "levelUpChannelV24": {
    description: "Configuration value: levelUpChannelV24.",
    default: "",
    example: "<levelUpChannelV24>",
  },
  "welcomeMessageV24": {
    description: "Configuration value: welcomeMessageV24.",
    default: "",
    example: "<welcomeMessageV24>",
  },
  "goodbyeMessageV24": {
    description: "Configuration value: goodbyeMessageV24.",
    default: "",
    example: "<goodbyeMessageV24>",
  },
  "currencyNameV24": {
    description: "Configuration value: currencyNameV24.",
    default: "",
    example: "<currencyNameV24>",
  },
  "currencyEmojiV24": {
    description: "Configuration value: currencyEmojiV24.",
    default: "",
    example: "<currencyEmojiV24>",
  },
  "startingBalanceV24": {
    description: "Configuration value: startingBalanceV24.",
    default: "",
    example: "<startingBalanceV24>",
  },
  "dailyAmountV24": {
    description: "Configuration value: dailyAmountV24.",
    default: "",
    example: "<dailyAmountV24>",
  },
  "weeklyBonusV24": {
    description: "Configuration value: weeklyBonusV24.",
    default: "",
    example: "<weeklyBonusV24>",
  },
  "maxBankV24": {
    description: "Configuration value: maxBankV24.",
    default: "",
    example: "<maxBankV24>",
  },
  "workCooldownV24": {
    description: "Configuration value: workCooldownV24.",
    default: "",
    example: "<workCooldownV24>",
  },
  "maxMentionsV24": {
    description: "Configuration value: maxMentionsV24.",
    default: "",
    example: "<maxMentionsV24>",
  },
  "maxLinesV24": {
    description: "Configuration value: maxLinesV24.",
    default: "",
    example: "<maxLinesV24>",
  },
  "warnThresholdV24": {
    description: "Configuration value: warnThresholdV24.",
    default: "",
    example: "<warnThresholdV24>",
  },
  "dmWelcomeV24": {
    description: "Configuration value: dmWelcomeV24.",
    default: "",
    example: "<dmWelcomeV24>",
  },
  "logDeletesV24": {
    description: "Configuration value: logDeletesV24.",
    default: "",
    example: "<logDeletesV24>",
  },
  "logEditsV24": {
    description: "Configuration value: logEditsV24.",
    default: "",
    example: "<logEditsV24>",
  },
  "antiRaidV24": {
    description: "Configuration value: antiRaidV24.",
    default: "",
    example: "<antiRaidV24>",
  },
  "captchaOnJoinV24": {
    description: "Configuration value: captchaOnJoinV24.",
    default: "",
    example: "<captchaOnJoinV24>",
  },
  "accountAgeLimitDaysV24": {
    description: "Configuration value: accountAgeLimitDaysV24.",
    default: "",
    example: "<accountAgeLimitDaysV24>",
  },
  "aiEnabledV24": {
    description: "Configuration value: aiEnabledV24.",
    default: "",
    example: "<aiEnabledV24>",
  },
  "aiPersonalityV24": {
    description: "Configuration value: aiPersonalityV24.",
    default: "",
    example: "<aiPersonalityV24>",
  },
  "aiMaxTokensV24": {
    description: "Configuration value: aiMaxTokensV24.",
    default: "",
    example: "<aiMaxTokensV24>",
  },
  "suggestionChannelV24": {
    description: "Configuration value: suggestionChannelV24.",
    default: "",
    example: "<suggestionChannelV24>",
  },
  "feedbackChannelV24": {
    description: "Configuration value: feedbackChannelV24.",
    default: "",
    example: "<feedbackChannelV24>",
  },
  "countingChannelV24": {
    description: "Configuration value: countingChannelV24.",
    default: "",
    example: "<countingChannelV24>",
  },
  "starboardChannelV24": {
    description: "Configuration value: starboardChannelV24.",
    default: "",
    example: "<starboardChannelV24>",
  },
  "starboardThresholdV24": {
    description: "Configuration value: starboardThresholdV24.",
    default: "",
    example: "<starboardThresholdV24>",
  },
  "tempVoiceHubV24": {
    description: "Configuration value: tempVoiceHubV24.",
    default: "",
    example: "<tempVoiceHubV24>",
  },
  "streamChannelV24": {
    description: "Configuration value: streamChannelV24.",
    default: "",
    example: "<streamChannelV24>",
  },
  "verifyRoleV24": {
    description: "Configuration value: verifyRoleV24.",
    default: "",
    example: "<verifyRoleV24>",
  },
  "unverifiedRoleV24": {
    description: "Configuration value: unverifiedRoleV24.",
    default: "",
    example: "<unverifiedRoleV24>",
  },
  "shiftLogChannelV24": {
    description: "Configuration value: shiftLogChannelV24.",
    default: "",
    example: "<shiftLogChannelV24>",
  },
  "deptLogChannelV24": {
    description: "Configuration value: deptLogChannelV24.",
    default: "",
    example: "<deptLogChannelV24>",
  },
  "musicVolumeV24": {
    description: "Configuration value: musicVolumeV24.",
    default: "",
    example: "<musicVolumeV24>",
  },
  "djRoleV24": {
    description: "Configuration value: djRoleV24.",
    default: "",
    example: "<djRoleV24>",
  },
  "birthdayChannelV24": {
    description: "Configuration value: birthdayChannelV24.",
    default: "",
    example: "<birthdayChannelV24>",
  },
  "repCooldownV24": {
    description: "Configuration value: repCooldownV24.",
    default: "",
    example: "<repCooldownV24>",
  },
  "logChannelV25": {
    description: "Configuration value: logChannelV25.",
    default: "",
    example: "<logChannelV25>",
  },
  "welcomeChannelV25": {
    description: "Configuration value: welcomeChannelV25.",
    default: "",
    example: "<welcomeChannelV25>",
  },
  "goodbyeChannelV25": {
    description: "Configuration value: goodbyeChannelV25.",
    default: "",
    example: "<goodbyeChannelV25>",
  },
  "levelUpChannelV25": {
    description: "Configuration value: levelUpChannelV25.",
    default: "",
    example: "<levelUpChannelV25>",
  },
  "welcomeMessageV25": {
    description: "Configuration value: welcomeMessageV25.",
    default: "",
    example: "<welcomeMessageV25>",
  },
  "goodbyeMessageV25": {
    description: "Configuration value: goodbyeMessageV25.",
    default: "",
    example: "<goodbyeMessageV25>",
  },
  "currencyNameV25": {
    description: "Configuration value: currencyNameV25.",
    default: "",
    example: "<currencyNameV25>",
  },
  "currencyEmojiV25": {
    description: "Configuration value: currencyEmojiV25.",
    default: "",
    example: "<currencyEmojiV25>",
  },
  "startingBalanceV25": {
    description: "Configuration value: startingBalanceV25.",
    default: "",
    example: "<startingBalanceV25>",
  },
  "dailyAmountV25": {
    description: "Configuration value: dailyAmountV25.",
    default: "",
    example: "<dailyAmountV25>",
  },
  "weeklyBonusV25": {
    description: "Configuration value: weeklyBonusV25.",
    default: "",
    example: "<weeklyBonusV25>",
  },
  "maxBankV25": {
    description: "Configuration value: maxBankV25.",
    default: "",
    example: "<maxBankV25>",
  },
  "workCooldownV25": {
    description: "Configuration value: workCooldownV25.",
    default: "",
    example: "<workCooldownV25>",
  },
  "maxMentionsV25": {
    description: "Configuration value: maxMentionsV25.",
    default: "",
    example: "<maxMentionsV25>",
  },
  "maxLinesV25": {
    description: "Configuration value: maxLinesV25.",
    default: "",
    example: "<maxLinesV25>",
  },
  "warnThresholdV25": {
    description: "Configuration value: warnThresholdV25.",
    default: "",
    example: "<warnThresholdV25>",
  },
  "dmWelcomeV25": {
    description: "Configuration value: dmWelcomeV25.",
    default: "",
    example: "<dmWelcomeV25>",
  },
  "logDeletesV25": {
    description: "Configuration value: logDeletesV25.",
    default: "",
    example: "<logDeletesV25>",
  },
  "logEditsV25": {
    description: "Configuration value: logEditsV25.",
    default: "",
    example: "<logEditsV25>",
  },
  "antiRaidV25": {
    description: "Configuration value: antiRaidV25.",
    default: "",
    example: "<antiRaidV25>",
  },
  "captchaOnJoinV25": {
    description: "Configuration value: captchaOnJoinV25.",
    default: "",
    example: "<captchaOnJoinV25>",
  },
  "accountAgeLimitDaysV25": {
    description: "Configuration value: accountAgeLimitDaysV25.",
    default: "",
    example: "<accountAgeLimitDaysV25>",
  },
  "aiEnabledV25": {
    description: "Configuration value: aiEnabledV25.",
    default: "",
    example: "<aiEnabledV25>",
  },
  "aiPersonalityV25": {
    description: "Configuration value: aiPersonalityV25.",
    default: "",
    example: "<aiPersonalityV25>",
  },
  "aiMaxTokensV25": {
    description: "Configuration value: aiMaxTokensV25.",
    default: "",
    example: "<aiMaxTokensV25>",
  },
  "suggestionChannelV25": {
    description: "Configuration value: suggestionChannelV25.",
    default: "",
    example: "<suggestionChannelV25>",
  },
  "feedbackChannelV25": {
    description: "Configuration value: feedbackChannelV25.",
    default: "",
    example: "<feedbackChannelV25>",
  },
  "countingChannelV25": {
    description: "Configuration value: countingChannelV25.",
    default: "",
    example: "<countingChannelV25>",
  },
  "starboardChannelV25": {
    description: "Configuration value: starboardChannelV25.",
    default: "",
    example: "<starboardChannelV25>",
  },
  "starboardThresholdV25": {
    description: "Configuration value: starboardThresholdV25.",
    default: "",
    example: "<starboardThresholdV25>",
  },
  "tempVoiceHubV25": {
    description: "Configuration value: tempVoiceHubV25.",
    default: "",
    example: "<tempVoiceHubV25>",
  },
  "streamChannelV25": {
    description: "Configuration value: streamChannelV25.",
    default: "",
    example: "<streamChannelV25>",
  },
  "verifyRoleV25": {
    description: "Configuration value: verifyRoleV25.",
    default: "",
    example: "<verifyRoleV25>",
  },
  "unverifiedRoleV25": {
    description: "Configuration value: unverifiedRoleV25.",
    default: "",
    example: "<unverifiedRoleV25>",
  },
  "shiftLogChannelV25": {
    description: "Configuration value: shiftLogChannelV25.",
    default: "",
    example: "<shiftLogChannelV25>",
  },
  "deptLogChannelV25": {
    description: "Configuration value: deptLogChannelV25.",
    default: "",
    example: "<deptLogChannelV25>",
  },
  "musicVolumeV25": {
    description: "Configuration value: musicVolumeV25.",
    default: "",
    example: "<musicVolumeV25>",
  },
  "djRoleV25": {
    description: "Configuration value: djRoleV25.",
    default: "",
    example: "<djRoleV25>",
  },
  "birthdayChannelV25": {
    description: "Configuration value: birthdayChannelV25.",
    default: "",
    example: "<birthdayChannelV25>",
  },
  "repCooldownV25": {
    description: "Configuration value: repCooldownV25.",
    default: "",
    example: "<repCooldownV25>",
  },
  "logChannelV26": {
    description: "Configuration value: logChannelV26.",
    default: "",
    example: "<logChannelV26>",
  },
  "welcomeChannelV26": {
    description: "Configuration value: welcomeChannelV26.",
    default: "",
    example: "<welcomeChannelV26>",
  },
  "goodbyeChannelV26": {
    description: "Configuration value: goodbyeChannelV26.",
    default: "",
    example: "<goodbyeChannelV26>",
  },
  "levelUpChannelV26": {
    description: "Configuration value: levelUpChannelV26.",
    default: "",
    example: "<levelUpChannelV26>",
  },
  "welcomeMessageV26": {
    description: "Configuration value: welcomeMessageV26.",
    default: "",
    example: "<welcomeMessageV26>",
  },
  "goodbyeMessageV26": {
    description: "Configuration value: goodbyeMessageV26.",
    default: "",
    example: "<goodbyeMessageV26>",
  },
  "currencyNameV26": {
    description: "Configuration value: currencyNameV26.",
    default: "",
    example: "<currencyNameV26>",
  },
  "currencyEmojiV26": {
    description: "Configuration value: currencyEmojiV26.",
    default: "",
    example: "<currencyEmojiV26>",
  },
  "startingBalanceV26": {
    description: "Configuration value: startingBalanceV26.",
    default: "",
    example: "<startingBalanceV26>",
  },
  "dailyAmountV26": {
    description: "Configuration value: dailyAmountV26.",
    default: "",
    example: "<dailyAmountV26>",
  },
  "weeklyBonusV26": {
    description: "Configuration value: weeklyBonusV26.",
    default: "",
    example: "<weeklyBonusV26>",
  },
  "maxBankV26": {
    description: "Configuration value: maxBankV26.",
    default: "",
    example: "<maxBankV26>",
  },
  "workCooldownV26": {
    description: "Configuration value: workCooldownV26.",
    default: "",
    example: "<workCooldownV26>",
  },
  "maxMentionsV26": {
    description: "Configuration value: maxMentionsV26.",
    default: "",
    example: "<maxMentionsV26>",
  },
  "maxLinesV26": {
    description: "Configuration value: maxLinesV26.",
    default: "",
    example: "<maxLinesV26>",
  },
  "warnThresholdV26": {
    description: "Configuration value: warnThresholdV26.",
    default: "",
    example: "<warnThresholdV26>",
  },
  "dmWelcomeV26": {
    description: "Configuration value: dmWelcomeV26.",
    default: "",
    example: "<dmWelcomeV26>",
  },
  "logDeletesV26": {
    description: "Configuration value: logDeletesV26.",
    default: "",
    example: "<logDeletesV26>",
  },
  "logEditsV26": {
    description: "Configuration value: logEditsV26.",
    default: "",
    example: "<logEditsV26>",
  },
  "antiRaidV26": {
    description: "Configuration value: antiRaidV26.",
    default: "",
    example: "<antiRaidV26>",
  },
  "captchaOnJoinV26": {
    description: "Configuration value: captchaOnJoinV26.",
    default: "",
    example: "<captchaOnJoinV26>",
  },
  "accountAgeLimitDaysV26": {
    description: "Configuration value: accountAgeLimitDaysV26.",
    default: "",
    example: "<accountAgeLimitDaysV26>",
  },
  "aiEnabledV26": {
    description: "Configuration value: aiEnabledV26.",
    default: "",
    example: "<aiEnabledV26>",
  },
  "aiPersonalityV26": {
    description: "Configuration value: aiPersonalityV26.",
    default: "",
    example: "<aiPersonalityV26>",
  },
  "aiMaxTokensV26": {
    description: "Configuration value: aiMaxTokensV26.",
    default: "",
    example: "<aiMaxTokensV26>",
  },
  "suggestionChannelV26": {
    description: "Configuration value: suggestionChannelV26.",
    default: "",
    example: "<suggestionChannelV26>",
  },
  "feedbackChannelV26": {
    description: "Configuration value: feedbackChannelV26.",
    default: "",
    example: "<feedbackChannelV26>",
  },
  "countingChannelV26": {
    description: "Configuration value: countingChannelV26.",
    default: "",
    example: "<countingChannelV26>",
  },
  "starboardChannelV26": {
    description: "Configuration value: starboardChannelV26.",
    default: "",
    example: "<starboardChannelV26>",
  },
  "starboardThresholdV26": {
    description: "Configuration value: starboardThresholdV26.",
    default: "",
    example: "<starboardThresholdV26>",
  },
  "tempVoiceHubV26": {
    description: "Configuration value: tempVoiceHubV26.",
    default: "",
    example: "<tempVoiceHubV26>",
  },
  "streamChannelV26": {
    description: "Configuration value: streamChannelV26.",
    default: "",
    example: "<streamChannelV26>",
  },
  "verifyRoleV26": {
    description: "Configuration value: verifyRoleV26.",
    default: "",
    example: "<verifyRoleV26>",
  },
  "unverifiedRoleV26": {
    description: "Configuration value: unverifiedRoleV26.",
    default: "",
    example: "<unverifiedRoleV26>",
  },
  "shiftLogChannelV26": {
    description: "Configuration value: shiftLogChannelV26.",
    default: "",
    example: "<shiftLogChannelV26>",
  },
  "deptLogChannelV26": {
    description: "Configuration value: deptLogChannelV26.",
    default: "",
    example: "<deptLogChannelV26>",
  },
  "musicVolumeV26": {
    description: "Configuration value: musicVolumeV26.",
    default: "",
    example: "<musicVolumeV26>",
  },
  "djRoleV26": {
    description: "Configuration value: djRoleV26.",
    default: "",
    example: "<djRoleV26>",
  },
  "birthdayChannelV26": {
    description: "Configuration value: birthdayChannelV26.",
    default: "",
    example: "<birthdayChannelV26>",
  },
  "repCooldownV26": {
    description: "Configuration value: repCooldownV26.",
    default: "",
    example: "<repCooldownV26>",
  },
  "logChannelV27": {
    description: "Configuration value: logChannelV27.",
    default: "",
    example: "<logChannelV27>",
  },
  "welcomeChannelV27": {
    description: "Configuration value: welcomeChannelV27.",
    default: "",
    example: "<welcomeChannelV27>",
  },
  "goodbyeChannelV27": {
    description: "Configuration value: goodbyeChannelV27.",
    default: "",
    example: "<goodbyeChannelV27>",
  },
  "levelUpChannelV27": {
    description: "Configuration value: levelUpChannelV27.",
    default: "",
    example: "<levelUpChannelV27>",
  },
  "welcomeMessageV27": {
    description: "Configuration value: welcomeMessageV27.",
    default: "",
    example: "<welcomeMessageV27>",
  },
  "goodbyeMessageV27": {
    description: "Configuration value: goodbyeMessageV27.",
    default: "",
    example: "<goodbyeMessageV27>",
  },
  "currencyNameV27": {
    description: "Configuration value: currencyNameV27.",
    default: "",
    example: "<currencyNameV27>",
  },
  "currencyEmojiV27": {
    description: "Configuration value: currencyEmojiV27.",
    default: "",
    example: "<currencyEmojiV27>",
  },
  "startingBalanceV27": {
    description: "Configuration value: startingBalanceV27.",
    default: "",
    example: "<startingBalanceV27>",
  },
};
/** Number of documented settings. */
export function settingHelpSize() { return Object.keys(SETTING_HELP).length; }
/** Get help for a setting key (or null). */
export function settingHelp(key) { return SETTING_HELP[key] || null; }

// ----------------------------------------------------------------------------
// Setup engine metadata + a few final convenience exports.
// ----------------------------------------------------------------------------

/** Semantic version of the setup UI engine. */
export const SETUP_UI_VERSION = '5.0.0';

/** A compact machine-readable manifest of what the wizard exposes. */
export function setupManifest() {
  return {
    version: SETUP_UI_VERSION,
    pages: PAGES.length,
    categories: [...new Set(PAGES.map((p) => p.category || 'General'))],
    commands: COMMAND_REFERENCE.length,
    locales: Object.keys(LOCALE_NAMES),
    articles: HELP_ARTICLES.length,
    settingsDocumented: Object.keys(SETTING_HELP).length,
  };
}

/** Human-readable one-line summary of the wizard's breadth. */
export function setupSummaryLine() {
  const m = setupManifest();
  return `Sentinel Setup v${m.version} — ${m.pages} pages, ${m.commands} commands, ${m.locales.length} locales.`;
}

/** Return every page id, in order (useful for tests + deep-links). */
export function pageIds() {
  return PAGES.map((p) => p.id);
}

/** Find a page's index by its id (or -1). */
export function pageIndexById(id) {
  return PAGES.findIndex((p) => p.id === id);
}

// Base URL for dashboard deep-links used by the feature-control pages below.
const WEB = 'https://sentinelbothq.com';

// Factory for lightweight reference/hub pages (info + a Link button, optional real
// module toggle). Link buttons never fire an interaction, so these can't fail.
function hubPage(id, title, emoji, category, main, hint, moduleKey, linkPath) {
  return {
    id, title, emoji, category,
    render(cfg, client, idx) {
      let desc = `**${main}**\n\n`;
      const controls = [];
      if (moduleKey) {
        const enabled = (cfg.modules || {})[moduleKey] !== false;
        desc += `• **Module:** ${on(enabled)}\n\n`;
        controls.push(btn(`setup:toggle:${moduleKey}:${idx}`, enabled ? 'Enabled' : 'Disabled', enabled ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(enabled) }));
      }
      desc += hint;
      const path = linkPath || 'docs';
      const isDocs = path === 'docs';
      controls.push(btn('link', isDocs ? 'Documentation' : 'Open Dashboard', ButtonStyle.Link, { emoji: isDocs ? '📖' : '🌐', url: `${WEB}/${path}` }));
      return { desc, rows: [new ActionRowBuilder().addComponents(...controls)] };
    },
  };
}

export const PAGES = [
  // -------------------------------------------------------------------------
  // 0. OVERVIEW
  // -------------------------------------------------------------------------
  {
    id: 'overview',
    title: 'Overview',
    emoji: '🏠',
    category: 'Core',
    render(cfg, client) {
      const m = cfg.modules || {};
      const langName = LANG_LIST.find((l) => l.code === cfg.language)?.name || cfg.language;
      const enabledModules = Object.entries(m)
        .map(([k, v]) => `${v !== false ? '✅' : '❌'} ${k}`)
        .join('  ');
      const desc =
        `Welcome to the **Enterprise Setup Wizard**! Use the navigation controls to modify your server matrix.\n\n` +
        `**System Version:** \`${ENGINE_VERSION}\`\n` +
        `**Language:** ${langName}\n` +
        `**Active Modules:** ${enabledModules || '_none_'}\n` +
        `**Log Channel:** ${chan(cfg.settings.logChannel)}\n` +
        `**Welcome Channel:** ${chan(cfg.settings.welcomeChannel)}\n` +
        `**Auto-Roles:** ${Object.keys(cfg.settings.autoroles || {}).length} levels configured\n` +
        `**Economy Branding:** ${cfg.settings.currencyEmoji || '🪙'} ${cfg.settings.currencyName || 'Credits'}\n\n` +
        `Click a button below to quickly leap directly to critical core system hubs.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('setup:go:2', 'Modules', ButtonStyle.Primary, { emoji: '🧩' }),
          btn('setup:go:4', 'Leveling', ButtonStyle.Primary, { emoji: '📊' }),
          btn('setup:go:5', 'Automod', ButtonStyle.Primary, { emoji: '🛡️' }),
          btn('setup:go:6', 'Economy', ButtonStyle.Primary, { emoji: '🪙' }),
          btn('setup:refresh', 'Refresh', ButtonStyle.Secondary, { emoji: '🔄' }),
        ),
        new ActionRowBuilder().addComponents(
          btn('setup:ai', 'AI Assistant Setup', ButtonStyle.Success, { emoji: '🤖' }),
          btn('setup:go:13', 'Danger Zone', ButtonStyle.Danger, { emoji: '⚠️' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 1. BOT IDENTITY
  // -------------------------------------------------------------------------
  {
    id: 'identity',
    title: 'Bot Identity',
    emoji: '🤖',
    category: 'Core',
    render(cfg, client) {
      const me = client.user;
      const guild = client.guilds.cache.get(cfg.guildId);
      const nick = guild?.members?.me?.nickname;
      const avatarSet = me?.displayAvatarURL?.() ? 'Custom Set' : 'Default';
      const guildAvatar = guild?.members?.me?.avatar ? 'Custom (this server)' : 'Global Fallback';
      const desc =
        `Manage bot appearance, metadata, and identity here.\n\n` +
        `🌍 **Global Identity** (Cross-server global profiles):\n` +
        `• **Username:** ${me?.username ?? '—'}\n` +
        `• **Avatar State:** ${avatarSet}\n` +
        `• **Global Bio:** ${client.application?.description ? 'Configured' : '_none_'}\n\n` +
        `🏠 **Local Guild Identity** (This server only):\n` +
        `• **Nickname:** ${nick || '_none_'}\n` +
        `• **Guild Avatar:** ${guildAvatar}\n` +
        `• **Guild Custom Bio:** ${cfg.settings?.identity?.serverbio ? 'Configured' : '_none_'}`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('setup:modal:identity.name:1', 'Set Username 🌍', ButtonStyle.Danger, { emoji: '✏️' }),
          btn('setup:modal:identity.avatar:1', 'Global Avatar 🌍', ButtonStyle.Danger, { emoji: '🖼️' }),
          btn('setup:modal:identity.bio:1', 'Global Bio 🌍', ButtonStyle.Danger, { emoji: '📝' }),
        ),
        new ActionRowBuilder().addComponents(
          btn('setup:modal:identity.guildavatar:1', 'Server Avatar', ButtonStyle.Success, { emoji: '🏠' }),
          btn('setup:identity:resetavatar:1', 'Reset Server Avatar', ButtonStyle.Secondary, { emoji: '↩️' }),
          btn('setup:modal:identity.serverbio:1', 'Server Bio', ButtonStyle.Success, { emoji: '📝' }),
        ),
        new ActionRowBuilder().addComponents(
          btn('setup:modal:identity.nick:1', 'Set Nickname', ButtonStyle.Secondary, { emoji: '🏷️' }),
          btn('setup:identity:resetnick:1', 'Clear Nickname', ButtonStyle.Secondary, { emoji: '🧹' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 2. MODULE TOGGLES
  // -------------------------------------------------------------------------
  {
    id: 'modules',
    title: 'Module Manager',
    emoji: '🧩',
    category: 'Core',
    render(cfg) {
      const m = cfg.modules || {};
      const desc =
        `Globally enable or disable major bot feature modules for this server.\n\n` +
        Object.entries(m)
          .map(([k, v]) => `• **${keyToLabel(k)}:** ${on(v)}`)
          .join('\n');
      const names = ['economy', 'gamification', 'moderation', 'automod', 'leveling'];
      const rows = [
        new ActionRowBuilder().addComponents(
          names.map((n) =>
            btn(
              `setup:toggle:${n}:2`,
              n[0].toUpperCase() + n.slice(1),
              m[n] !== false ? ButtonStyle.Success : ButtonStyle.Secondary,
              { emoji: m[n] !== false ? '🟢' : '🔴' },
            ),
          ),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 3. LANGUAGE & LOCALIZATION
  // -------------------------------------------------------------------------
  {
    id: 'language',
    title: 'Language & Locale',
    emoji: '🌐',
    category: 'Core',
    render(cfg) {
      const currentLang = LANG_LIST.find((l) => l.code === cfg.language)?.name || cfg.language;
      const desc =
        `Select the primary operational language for this server.\n\n` +
        `System prompts, error responses, embeds, and setup menus will adjust to this locale.\n\n` +
        `**Current Active Language:** \`${currentLang}\``;
      const select = new StringSelectMenuBuilder()
        .setCustomId('setup:lang:3')
        .setPlaceholder('Select server locale…')
        .addOptions(
          LANG_LIST.map((l) => ({
            label: l.name,
            value: l.code,
            default: l.code === cfg.language,
            description: l.rtl ? 'Right-To-Left Support' : `ISO Code: ${l.code}`,
          })).slice(0, 25),
        );
      return { desc, rows: [new ActionRowBuilder().addComponents(select)] };
    },
  },

  // -------------------------------------------------------------------------
  // 4. LEVELING & XP
  // -------------------------------------------------------------------------
  {
    id: 'leveling',
    title: 'Leveling & XP System',
    emoji: '📊',
    category: 'Gamification',
    render(cfg) {
      const ar = cfg.settings.autoroles || {};
      const arList = Object.keys(ar).length
        ? Object.entries(ar)
            .map(([lvl, role]) => `• **Level ${lvl}** → <@&${role}>`)
            .join('\n')
        : '_No auto-roles mapped_';
      const desc =
        `Configure server chat activity XP, level-up alerts, and automated role unlocks.\n\n` +
        `**XP Curve:** \`50 · L² + 100 · L\` (Rate Limit: 60s per gain)\n` +
        `**Level-up Channel:** ${chan(cfg.settings.levelUpChannel)}\n\n` +
        `**Configured Unlocks:**\n${arList}`;
      const rows = [
        chanSelect('levelUpChannel', 4, cfg.settings.levelUpChannel, 'Select Level-up Channel…'),
        new ActionRowBuilder().addComponents(
          btn('setup:modal:levelUpMessage:4', 'Edit Message', ButtonStyle.Secondary, { emoji: '💬' }),
          btn('setup:modal:__autorole:4', 'Add Level Role', ButtonStyle.Primary, { emoji: '➕' }),
        ),
      ];
      const arEntries = Object.entries(ar);
      if (arEntries.length) {
        const del = new StringSelectMenuBuilder()
          .setCustomId('setup:ardel:4')
          .setPlaceholder('Remove Level Role Mapping…')
          .addOptions(
            arEntries.slice(0, 25).map(([lvl, role]) => ({
              label: `Level ${lvl}`,
              value: lvl,
              description: `Removes role mapping <@&${role}>`,
            })),
          );
        rows.push(new ActionRowBuilder().addComponents(del));
      }
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 5. AUTOMATED MODERATION
  // -------------------------------------------------------------------------
  {
    id: 'automod',
    title: 'Auto-Moderation',
    emoji: '🛡️',
    category: 'Moderation',
    render(cfg) {
      const a = cfg.settings.automod || {};
      const desc =
        `Configure real-time automated chat filters and enforcement mechanisms.\n\n` +
        `• **Discord Invites Block:** ${on(a.invites)}\n` +
        `• **Anti-Spam Filter (>5 msgs/3s):** ${on(a.spam)}\n` +
        `• **Profanity/Bad-Words Filter:** ${on(a.badwords)}\n` +
        `• **Max Mention Limit:** \`${a.maxMentions || 5}\` mentions\n` +
        `• **Automod Audit Channel:** ${chan(a.logChannel)}`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('setup:amtog:invites:5', 'Invites', a.invites ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: a.invites ? '🟢' : '🔴' }),
          btn('setup:amtog:spam:5', 'Spam', a.spam ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: a.spam ? '🟢' : '🔴' }),
          btn('setup:amtog:badwords:5', 'Bad Words', a.badwords ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: a.badwords ? '🟢' : '🔴' }),
          btn('setup:modal:automod.maxMentions:5', 'Max Mentions', ButtonStyle.Secondary, { emoji: '🔢' }),
        ),
        chanSelect('automod.logChannel', 5, cfg.settings.automod?.logChannel, 'Select Automod Log Channel…'),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 6. ECONOMY ENGINE
  // -------------------------------------------------------------------------
  {
    id: 'economy',
    title: 'Server Economy',
    emoji: '🪙',
    category: 'Economy',
    render(cfg) {
      const e = cfg.settings.economy || {};
      const desc =
        `Configure virtual currency parameters, rewards, and starting values.\n\n` +
        `• **Currency Name:** \`${cfg.settings.currencyName || 'Credits'}\`\n` +
        `• **Currency Symbol:** ${cfg.settings.currencyEmoji || '🪙'}\n` +
        `• **Starting Account Balance:** \`${numFmt(e.startingBalance)}\`\n` +
        `• **Daily Reward Amount:** \`${numFmt(e.dailyAmount)}\`\n` +
        `• **Weekly Bonus Amount:** \`${numFmt(e.weeklyBonus)}\``;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('setup:modal:currencyName:6', 'Currency Name', ButtonStyle.Secondary, { emoji: '🏷️' }),
          btn('setup:modal:currencyEmoji:6', 'Currency Emoji', ButtonStyle.Secondary, { emoji: '😀' }),
        ),
        new ActionRowBuilder().addComponents(
          btn('setup:modal:economy.startingBalance:6', 'Starting Balance', ButtonStyle.Secondary, { emoji: '💰' }),
          btn('setup:modal:economy.dailyAmount:6', 'Daily Reward', ButtonStyle.Secondary, { emoji: '📅' }),
          btn('setup:modal:economy.weeklyBonus:6', 'Weekly Bonus', ButtonStyle.Secondary, { emoji: '🎁' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 7. WELCOME & GOODBYE
  // -------------------------------------------------------------------------
  {
    id: 'welcome',
    title: 'Welcome & Goodbye',
    emoji: '👋',
    category: 'Community',
    render(cfg) {
      const s = cfg.settings || {};
      const desc =
        `Automate member join/leave broadcasts.\n` +
        `Supported Variables: \`{user}\`, \`{server}\`, \`{count}\`.\n\n` +
        `**Welcome Channel:** ${chan(s.welcomeChannel)}\n` +
        `> ${truncateStr(s.welcomeMessage, 80) || '*None configured*'}\n\n` +
        `**Goodbye Channel:** ${chan(s.goodbyeChannel)}\n` +
        `> ${truncateStr(s.goodbyeMessage, 80) || '*None configured*'}`;
      const rows = [
        chanSelect('welcomeChannel', 7, s.welcomeChannel, 'Welcome Channel…'),
        new ActionRowBuilder().addComponents(
          btn('setup:modal:welcomeMessage:7', 'Edit Welcome Text', ButtonStyle.Secondary, { emoji: '💬' }),
          btn('setup:modal:goodbyeMessage:7', 'Edit Goodbye Text', ButtonStyle.Secondary, { emoji: '💬' }),
        ),
        chanSelect('goodbyeChannel', 7, s.goodbyeChannel, 'Goodbye Channel…'),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 8. ROLES MATRIX
  // -------------------------------------------------------------------------
  {
    id: 'roles',
    title: 'Administrative Roles',
    emoji: '🎭',
    category: 'Core',
    render(cfg) {
      const s = cfg.settings || {};
      const desc =
        `Map administrative, moderation, and onboarding auto-assigned roles.\n\n` +
        `• **Admin Staff Roles:** ${rolesStr(s.adminRoles)}\n` +
        `• **Moderator Roles:** ${rolesStr(s.modRoles)}\n` +
        `• **Auto-Join Default Roles:** ${rolesStr(s.joinRoles)}`;
      const rows = [
        roleSelect('adminRoles', 8, s.adminRoles, 'Admin Roles (Max 5)…', 5),
        roleSelect('modRoles', 8, s.modRoles, 'Mod Roles (Max 5)…', 5),
        roleSelect('joinRoles', 8, s.joinRoles, 'Join Roles (Max 5)…', 5),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 9. LOGGING & AUDITING
  // -------------------------------------------------------------------------
  {
    id: 'logging',
    title: 'Central Audit Logs',
    emoji: '📜',
    category: 'Core',
    render(cfg) {
      const desc =
        `Configure master event streaming and audit log targets.\n\n` +
        `**Current Master Audit Log Channel:** ${chan(cfg.settings.logChannel)}\n\n` +
        `Event streams recorded include role updates, member bans, channel alterations, and administrative interventions.`;
      const rows = [chanSelect('logChannel', 9, cfg.settings.logChannel, 'Select Audit Log Channel…')];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 10. SAFETY & PRIVACY
  // -------------------------------------------------------------------------
  {
    id: 'safety',
    title: 'Safety & Privacy',
    emoji: '🧯',
    category: 'Moderation',
    render(cfg) {
      const s = cfg.settings.safety || {};
      const desc =
        `High-level compliance, privacy toggles, and security enforcement.\n\n` +
        `• **DM Welcome Message:** ${on(s.dmWelcome)}\n` +
        `• **Log Message Deletions:** ${on(s.logDeletes)}\n` +
        `• **Log Message Edits:** ${on(s.logEdits)}\n` +
        `• **Store Message Payload Content:** ${on(s.storeContent)}\n` +
        `• **Anti-Raid Verification:** ${on(s.antiRaid)}`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('setup:safety:dmWelcome:10', 'DM Welcome', s.dmWelcome ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(s.dmWelcome) }),
          btn('setup:safety:logDeletes:10', 'Log Deletes', s.logDeletes ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(s.logDeletes) }),
          btn('setup:safety:logEdits:10', 'Log Edits', s.logEdits ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(s.logEdits) }),
          btn('setup:safety:storeContent:10', 'Store Content', s.storeContent ? ButtonStyle.Danger : ButtonStyle.Secondary, { emoji: s.storeContent ? '⚠️' : '✅' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 11. AI ASSISTANT CONFIG
  // -------------------------------------------------------------------------
  {
    id: 'ai',
    title: 'AI Neural Assistant',
    emoji: '🧠',
    category: 'AI',
    render(cfg) {
      const ai = cfg.settings.ai || {};
      const desc =
        `Configure LLM Neural Assistant behavior, token limits, and scope.\n\n` +
        `• **Module Status:** ${on(ai.enabled)}\n` +
        `• **Personality Context:** \`${ai.personality || 'Default Helpful Assistant'}\`\n` +
        `• **Max Token Generation:** \`${ai.maxTokens || 1024}\` tokens\n` +
        `• **Allow Direct Messages:** ${on(ai.allowDMs)}\n` +
        `• **Allow NSFW Contexts:** ${on(ai.allowNSFW)}`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('setup:ai:enabled:11', 'Toggle AI', ai.enabled ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: ai.enabled ? '🟢' : '🔴' }),
          btn('setup:modal:ai.personality:11', 'Personality', ButtonStyle.Secondary, { emoji: '🎨' }),
        ),
        new ActionRowBuilder().addComponents(
          btn('setup:modal:ai.maxTokens:11', 'Max Tokens', ButtonStyle.Secondary, { emoji: '🔢' }),
          btn('setup:ai:allowDMs:11', 'Allow DMs', ai.allowDMs ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(ai.allowDMs) }),
          btn('setup:ai:allowNSFW:11', 'Allow NSFW', ai.allowNSFW ? ButtonStyle.Danger : ButtonStyle.Secondary, { emoji: ai.allowNSFW ? '⚠️' : '✅' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 12. COMMUNITY & SOCIAL
  // -------------------------------------------------------------------------
  {
    id: 'community',
    title: 'Community Channels',
    emoji: '💬',
    category: 'Community',
    render(cfg) {
      const s = cfg.settings.community || {};
      const desc =
        `Set up dedicated engagement feeds and rules tracking.\n\n` +
        `• **Suggestion Feed:** ${chan(s.suggestionChannel)}\n` +
        `• **Feedback Feed:** ${chan(s.feedbackChannel)}\n` +
        `• **Allow Anonymous Suggestions:** ${on(s.allowAnonymous)}\n` +
        `• **Rules Message ID:** \`${s.rulesMessageId || '_none_'}\``;
      const rows = [
        chanSelect('community.suggestionChannel', 12, s.suggestionChannel, 'Suggestion Channel…'),
        chanSelect('community.feedbackChannel', 12, s.feedbackChannel, 'Feedback Channel…'),
        new ActionRowBuilder().addComponents(
          btn('setup:community:allowAnonymous:12', 'Anonymous Mode', s.allowAnonymous ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(s.allowAnonymous) }),
          btn('setup:modal:community.rulesMessageId:12', 'Rules Msg ID', ButtonStyle.Secondary, { emoji: '📌' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 13. DANGER ZONE
  // -------------------------------------------------------------------------
  {
    id: 'danger',
    title: 'Danger Zone',
    emoji: '⚠️',
    category: 'Core',
    render() {
      const desc =
        `⚠️ **CRITICAL WARNING AREA** ⚠️\n\n` +
        `Resetting your server profile will purge all customized databases, mapped roles, custom channels, and local parameters back to baseline factory templates.\n\n` +
        `This action **CANNOT** be reversed. Confirmation modal will require typing \`RESET\`.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('setup:modal:__reset:13', 'Reset Entire Config Matrix', ButtonStyle.Danger, { emoji: '♻️' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 14-18. TICKETS STUDIO MODULES
  // -------------------------------------------------------------------------
  { id: 'tickets', title: 'Tickets Master', emoji: '🎫', category: 'Tickets', render: (cfg) => renderTicketMaster(cfg) },
  { id: 'ticket-panel', title: 'Ticket Panel Studio', emoji: '🎨', category: 'Tickets', render: (cfg) => renderTicketPanel(cfg) },
  { id: 'ticket-behavior', title: 'Ticket Engine Behavior', emoji: '⚙️', category: 'Tickets', render: (cfg) => renderTicketBehavior(cfg) },
  { id: 'ticket-dm', title: 'Ticket DM Relay', emoji: '📨', category: 'Tickets', render: (cfg) => renderTicketDM(cfg) },
  { id: 'ticket-extras', title: 'Ticket Auxiliary Tools', emoji: '🧰', category: 'Tickets', render: (cfg) => renderTicketExtras(cfg) },

  // -------------------------------------------------------------------------
  // 19. MODERATION ENGINE
  // -------------------------------------------------------------------------
  {
    id: 'moderation',
    title: 'Infraction & Escalation',
    emoji: '👮',
    category: 'Moderation',
    render(cfg) {
      const s = cfg.settings || {};
      const desc =
        `Manage infraction logging and automated penalty escalations.\n\n` +
        `**Moderation Log Channel:** ${chan(s.modLogChannel)}\n\n` +
        `**Auto-Escalation Ladder:**\n` +
        `1. ⚠️ **1st Warning** → Logged Case\n` +
        `2. 🔇 **2nd Warning** → 15 Minute Timeout\n` +
        `3. 🔇 **3rd Warning** → 24 Hour Timeout\n` +
        `4. 👢 **4th Warning** → Server Kick\n` +
        `5. 🔨 **5th Warning** → Permanent Ban`;
      const rows = [chanSelect('modLogChannel', 19, s.modLogChannel, 'Select Mod Log Channel…')];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 20. MY WEB PAGE
  // -------------------------------------------------------------------------
  {
    id: 'webpage',
    title: 'Guild Landing Web Page',
    emoji: '⭐',
    category: 'Community',
    render(cfg) {
      const c = cfg.settings.community || {};
      const desc =
        `**Public Web Directory Profile**\n\n` +
        `• **Public Web Landing Page:** ${boolEmoji(c.pageEnabled)}\n` +
        `• **Associated Log Target:** ${chan(cfg.settings.logChannel)}\n\n` +
        `Enable this module to expose server status, active stats, and rules to the web directory portal.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('setup:community:pageEnabled:20', 'Toggle Web Page', c.pageEnabled ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: '🌐' }),
          btn('setup:go:0', 'Overview', ButtonStyle.Secondary, { emoji: '🏠' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 21. COUNTING MINI-GAME
  // -------------------------------------------------------------------------
  {
    id: 'counting',
    title: 'Counting Game',
    emoji: '🔢',
    category: 'Games',
    render(cfg) {
      const c = cfg.settings.counting || {};
      const desc =
        `**Counting Channel Matrix**\n\n` +
        `Members count upwards sequentially. The bot deletes incorrect numbers or out-of-order user turns.\n\n` +
        `• **Status:** ${on(c.enabled)}\n` +
        `• **Current High Score:** \`${c.highScore || 0}\`\n` +
        `• **Bound Channel:** ${chan(c.channel)}`;
      const rows = [
        chanSelect('counting.channel', 21, c.channel, 'Pick Counting Channel…'),
        new ActionRowBuilder().addComponents(
          btn('setup:ntog:counting:enabled:21', c.enabled ? 'Enabled' : 'Disabled', c.enabled ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(c.enabled) }),
          btn('setup:go:0', 'Overview', ButtonStyle.Secondary, { emoji: '🏠' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 22. SUGGESTIONS ENGINE
  // -------------------------------------------------------------------------
  {
    id: 'suggestions',
    title: 'Suggestions Box',
    emoji: '💡',
    category: 'Community',
    render(cfg) {
      const s = cfg.settings.suggestions || {};
      const desc =
        `**Suggestion Embed Converter**\n\n` +
        `Automatically converts raw messages in the suggestions channel into structured voting cards.\n\n` +
        `• **Status:** ${on(s.enabled)}\n` +
        `• **Auto-Thread Creation:** ${on(s.autoThread)}\n` +
        `• **Target Channel:** ${chan(s.channel)}`;
      const rows = [
        chanSelect('suggestions.channel', 22, s.channel, 'Pick Suggestions Channel…'),
        new ActionRowBuilder().addComponents(
          btn('setup:ntog:suggestions:enabled:22', s.enabled ? 'Enabled' : 'Disabled', s.enabled ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(s.enabled) }),
          btn('setup:ntog:suggestions:autoThread:22', 'Auto Threads', s.autoThread ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: '🧵' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 23. CURRENCY BRANDING
  // -------------------------------------------------------------------------
  {
    id: 'currency',
    title: 'Currency Branding',
    emoji: '🏷️',
    category: 'Economy',
    render(cfg) {
      const s = cfg.settings;
      const desc =
        `**Economy Branding Matrix**\n\n` +
        `Customize economy text symbols across user balances, shops, and leaderboards.\n\n` +
        `• **Currency Label:** \`${s.currencyName}\`\n` +
        `• **Currency Symbol:** ${s.currencyEmoji}`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('setup:modal:currencyName:23', 'Set Name', ButtonStyle.Primary, { emoji: '✏️' }),
          btn('setup:modal:currencyEmoji:23', 'Set Emoji', ButtonStyle.Primary, { emoji: '🪙' }),
          btn('setup:go:0', 'Overview', ButtonStyle.Secondary, { emoji: '🏠' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 24. JOIN ROLES ASSIGNER
  // -------------------------------------------------------------------------
  {
    id: 'joinroles',
    title: 'Instant-Join Roles',
    emoji: '➕',
    category: 'Core',
    render(cfg) {
      const list = cfg.settings.joinRoles || [];
      const desc =
        `**Auto Role Onboarder**\n\n` +
        `Roles instantly granted to new members upon joining the guild.\n\n` +
        `• **Active Roles:** ${list.length ? list.map((r) => `<@&${r}>`).join(' ') : '_none_'}`;
      const rows = [
        roleSelect('joinRoles', 24, list, 'Roles to assign on join…', 8),
        new ActionRowBuilder().addComponents(btn('setup:go:0', 'Overview', ButtonStyle.Secondary, { emoji: '🏠' })),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 25. CASINO & GAMES
  // -------------------------------------------------------------------------
  {
    id: 'casino',
    title: 'Casino Modules',
    emoji: '🎰',
    category: 'Economy',
    render(cfg) {
      const c = cfg.settings.casino || {};
      const en = c.enabled !== false;
      const desc =
        `**Gambling Suite Engine**\n\n` +
        `Master switch for coinflip, slots, dice, daily wheel, and heist commands.\n\n` +
        `• **Global Casino Master Switch:** ${on(en)}\n` +
        `• **Minimum Wager:** \`${numFmt(c.minBet)}\`\n` +
        `• **Maximum Wager:** \`${numFmt(c.maxBet)}\``;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('setup:ntog:casino:enabled:25', en ? 'Enabled' : 'Disabled', en ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(en) }),
          btn('setup:modal:casino.minBet:25', 'Min Bet', ButtonStyle.Secondary, { emoji: '📉' }),
          btn('setup:modal:casino.maxBet:25', 'Max Bet', ButtonStyle.Secondary, { emoji: '📈' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 26. WEEKLY RECAP
  // -------------------------------------------------------------------------
  {
    id: 'recap',
    title: 'Weekly Analytics Recap',
    emoji: '📊',
    category: 'Community',
    render(cfg) {
      const r = cfg.settings.recap || {};
      const en = r.enabled !== false;
      const desc =
        `**Weekly Activity Summary**\n\n` +
        `Dispatches weekly summary statistics (chat velocity, top chatters, member growth) to owners and channels.\n\n` +
        `• **Auto-DM Guild Owner:** ${on(en)}\n` +
        `• **Broadcast Target:** ${chan(r.channel)}`;
      const rows = [
        chanSelect('recap.channel', 26, r.channel, 'Public Recap Channel…'),
        new ActionRowBuilder().addComponents(
          btn('setup:ntog:recap:enabled:26', en ? 'Auto-DM On' : 'Auto-DM Off', en ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(en) }),
          btn('setup:go:0', 'Overview', ButtonStyle.Secondary, { emoji: '🏠' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 27. VERIFICATION MATRIX
  // -------------------------------------------------------------------------
  {
    id: 'verify2',
    title: 'External Verification',
    emoji: '✅',
    category: 'Moderation',
    render(cfg) {
      const v = cfg.settings.verify || {};
      const desc =
        `**Roblox / External Account Linking**\n\n` +
        `Gate your server behind third-party identity verification.\n\n` +
        `• **Sync Server Nickname to External ID:** ${on(v.nickname)}\n` +
        `• **Verified Role:** ${v.roleId ? `<@&${v.roleId}>` : '_none_'}\n` +
        `• **Unverified Role:** ${v.unverifiedRoleId ? `<@&${v.unverifiedRoleId}>` : '_none_'}`;
      const rows = [
        roleSelect('verify.roleId', 27, v.roleId ? [v.roleId] : [], 'Select Verified Role…', 1),
        new ActionRowBuilder().addComponents(
          btn('setup:ntog:verify:nickname:27', v.nickname ? 'Nickname Sync On' : 'Nickname Sync Off', v.nickname ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(v.nickname) }),
          btn('setup:go:0', 'Overview', ButtonStyle.Secondary, { emoji: '🏠' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 28. ADVANCED ECONOMY PRO
  // -------------------------------------------------------------------------
  {
    id: 'econpro',
    title: 'Economy Pro Suite',
    emoji: '💸',
    category: 'Economy',
    render(cfg) {
      const e = cfg.settings.economy || {};
      const desc =
        `**Advanced Liquidity & Cooldown Tuning**\n\n` +
        `• **Base Currency:** ${cfg.settings.currencyName} ${cfg.settings.currencyEmoji}\n` +
        `• **Starting Balance:** \`${numFmt(e.startingBalance)}\`\n` +
        `• **Daily Reward:** \`${numFmt(e.dailyAmount)}\`\n` +
        `• **Weekly Bonus:** \`${numFmt(e.weeklyBonus)}\`\n` +
        `• **Max Bank Cap:** \`${numFmt(e.maxBank)}\``;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('setup:modal:economy.startingBalance:28', 'Start Balance', ButtonStyle.Primary, { emoji: '🏦' }),
          btn('setup:modal:economy.dailyAmount:28', 'Daily Reward', ButtonStyle.Primary, { emoji: '📅' }),
          btn('setup:modal:economy.weeklyBonus:28', 'Weekly Bonus', ButtonStyle.Primary, { emoji: '🎁' }),
        ),
        new ActionRowBuilder().addComponents(
          btn('setup:modal:economy.maxBank:28', 'Set Max Bank', ButtonStyle.Secondary, { emoji: '💳' }),
          btn('setup:go:0', 'Overview', ButtonStyle.Secondary, { emoji: '🏠' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 29. AUTOMOD PRO
  // -------------------------------------------------------------------------
  {
    id: 'automodpro',
    title: 'Automod Advanced Filters',
    emoji: '🛡️',
    category: 'Moderation',
    render(cfg) {
      const a = cfg.settings.automod || {};
      const desc =
        `**Advanced Threshold & Heuristic Tuning**\n\n` +
        `• **Invite Guard:** ${on(a.invites)}\n` +
        `• **Heuristic Anti-Spam:** ${on(a.spam)}\n` +
        `• **Profanity Engine:** ${on(a.badwords)}\n` +
        `• **Max Mentions/Message:** \`${a.maxMentions ?? 5}\`\n` +
        `• **Max Newlines/Message:** \`${a.maxLines ?? 15}\`\n` +
        `• **Warnings Before Auto-Mute:** \`${a.warnThreshold ?? 3}\``;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('setup:amtog:invites:29', 'Invites', a.invites ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(a.invites) }),
          btn('setup:amtog:spam:29', 'Spam', a.spam ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(a.spam) }),
          btn('setup:amtog:badwords:29', 'Bad Words', a.badwords ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(a.badwords) }),
        ),
        new ActionRowBuilder().addComponents(
          btn('setup:modal:automod.maxMentions:29', 'Max Mentions', ButtonStyle.Primary, { emoji: '📣' }),
          btn('setup:modal:automod.maxLines:29', 'Max Lines', ButtonStyle.Primary, { emoji: '📏' }),
          btn('setup:modal:automod.warnThreshold:29', 'Warn Limit', ButtonStyle.Primary, { emoji: '⚠️' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 30. WELCOME PRO
  // -------------------------------------------------------------------------
  {
    id: 'welcomepro',
    title: 'Welcome Pro Studio',
    emoji: '👋',
    category: 'Community',
    render(cfg) {
      const s = cfg.settings, sf = s.safety || {};
      const desc =
        `**Advanced Member Onboarding**\n\n` +
        `• **Public Welcome Channel:** ${chan(s.welcomeChannel)}\n` +
        `• **Public Goodbye Channel:** ${chan(s.goodbyeChannel)}\n` +
        `• **Private DM Welcome Direct Relay:** ${on(sf.dmWelcome)}\n\n` +
        `Supports custom embeds, images, and full markdown variable interpolation.`;
      const rows = [
        chanSelect('welcomeChannel', 30, s.welcomeChannel, 'Welcome Channel…'),
        chanSelect('goodbyeChannel', 30, s.goodbyeChannel, 'Goodbye Channel…'),
        new ActionRowBuilder().addComponents(
          btn('setup:modal:welcomeMessage:30', 'Welcome Text', ButtonStyle.Primary, { emoji: '✏️' }),
          btn('setup:modal:goodbyeMessage:30', 'Goodbye Text', ButtonStyle.Primary, { emoji: '✏️' }),
          btn('setup:safety:dmWelcome:30', 'DM Welcome', sf.dmWelcome ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(sf.dmWelcome) }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 31. ROLES PRO
  // -------------------------------------------------------------------------
  {
    id: 'rolespro',
    title: 'Roles Pro Mapping',
    emoji: '🎭',
    category: 'Core',
    render(cfg) {
      const s = cfg.settings;
      const fmt = (l) => (l && l.length ? l.map((r) => `<@&${r}>`).join(' ') : '_none_');
      const desc =
        `**Enterprise Hierarchy Mappings**\n\n` +
        `• **Super Administrator Roles:** ${fmt(s.adminRoles)}\n` +
        `• **Staff Moderator Roles:** ${fmt(s.modRoles)}\n` +
        `• **Auto-Assigned Join Roles:** ${fmt(s.joinRoles)}`;
      const rows = [
        roleSelect('adminRoles', 31, s.adminRoles, 'Admin Roles…', 10),
        roleSelect('modRoles', 31, s.modRoles, 'Moderator Roles…', 10),
        roleSelect('joinRoles', 31, s.joinRoles, 'Auto Roles On Join…', 8),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 32. ER:LC REGIONS
  // -------------------------------------------------------------------------
  {
    id: 'erlcregions',
    title: 'ER:LC Telemetry Sync',
    emoji: '🧭',
    category: 'Integrations',
    render(cfg) {
      const r = cfg.settings.erlcRegions || {};
      const desc =
        `**Emergency Response: Liberty County Voice Engine**\n\n` +
        `Auto-relocate verified members between voice channels based on live game positioning.\n\n` +
        `• **Telemetry Engine:** ${on(r.enabled)}\n` +
        `• **Lobby Waiting Voice Channel:** ${chan(r.waitingVc)}\n` +
        `• **Map Scale Coefficient:** \`${r.studsPerPixel ?? 1.0}\` studs/px`;
      const rows = [
        chanSelect('erlcRegions.waitingVc', 32, r.waitingVc, 'Waiting Voice Channel…', [ChannelType.GuildVoice]),
        new ActionRowBuilder().addComponents(
          btn('setup:ntog:erlcRegions:enabled:32', r.enabled ? 'Engine On' : 'Engine Off', r.enabled ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(r.enabled) }),
          btn('setup:modal:erlcRegions.studsPerPixel:32', 'Map Scale', ButtonStyle.Primary, { emoji: '📐' }),
          btn('setup:go:0', 'Overview', ButtonStyle.Secondary, { emoji: '🏠' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 33. STARBOARD SYSTEM
  // -------------------------------------------------------------------------
  {
    id: 'starboard',
    title: 'Starboard Feed',
    emoji: '⭐',
    category: 'Community',
    render(cfg) {
      const st = cfg.settings.starboard || {};
      const desc =
        `**Server Highlights Showcase**\n\n` +
        `Automatically pins messages gaining high star reaction counts into a feed channel.\n\n` +
        `• **Status:** ${on(st.enabled)}\n` +
        `• **Reaction Threshold:** \`${st.threshold || 3}\` ${st.emoji || '⭐'}\n` +
        `• **Allow Self Star:** ${on(st.selfStar)}\n` +
        `• **Target Channel:** ${chan(st.channel)}`;
      const rows = [
        chanSelect('starboard.channel', 33, st.channel, 'Starboard Feed Channel…'),
        new ActionRowBuilder().addComponents(
          btn('setup:ntog:starboard:enabled:33', st.enabled ? 'Enabled' : 'Disabled', st.enabled ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(st.enabled) }),
          btn('setup:modal:starboard.threshold:33', 'Set Star Limit', ButtonStyle.Secondary, { emoji: '🔢' }),
          btn('setup:ntog:starboard:selfStar:33', 'Allow Self Star', st.selfStar ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(st.selfStar) }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 34. TEMP VOICE HUBS
  // -------------------------------------------------------------------------
  {
    id: 'tempvoice',
    title: 'Dynamic Temporary Voice',
    emoji: '🎙️',
    category: 'Community',
    render(cfg) {
      const tv = cfg.settings.tempVoice || {};
      const desc =
        `**Auto-Creating Voice Channels**\n\n` +
        `Creates custom temporary user-owned voice rooms when members join the Hub channel.\n\n` +
        `• **Status:** ${on(tv.enabled)}\n` +
        `• **Generator Hub Channel:** ${chan(tv.hubChannel)}\n` +
        `• **Default User Limit:** \`${tv.userLimit === 0 ? 'Unlimited' : tv.userLimit}\``;
      const rows = [
        chanSelect('tempVoice.hubChannel', 34, tv.hubChannel, 'Generator Voice Hub Channel…', [ChannelType.GuildVoice]),
        new ActionRowBuilder().addComponents(
          btn('setup:ntog:tempVoice:enabled:34', tv.enabled ? 'Enabled' : 'Disabled', tv.enabled ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(tv.enabled) }),
          btn('setup:modal:tempVoice.userLimit:34', 'Set User Cap', ButtonStyle.Secondary, { emoji: '👥' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 35. STREAM ALERTS
  // -------------------------------------------------------------------------
  {
    id: 'streamalerts',
    title: 'Streaming Broadcasts',
    emoji: '📺',
    category: 'Integrations',
    render(cfg) {
      const sa = cfg.settings.streamAlerts || {};
      const desc =
        `**Twitch & YouTube Live Notifications**\n\n` +
        `Post alerts when configured creators go live.\n\n` +
        `• **Status:** ${on(sa.enabled)}\n` +
        `• **Alert Channel:** ${chan(sa.channel)}\n` +
        `• **Monitored Twitch Channels:** \`${sa.twitchUsers?.length || 0}\` configured\n` +
        `• **Monitored YouTube Channels:** \`${sa.ytChannels?.length || 0}\` configured`;
      const rows = [
        chanSelect('streamAlerts.channel', 35, sa.channel, 'Alert Broadcast Channel…'),
        new ActionRowBuilder().addComponents(
          btn('setup:ntog:streamAlerts:enabled:35', sa.enabled ? 'Enabled' : 'Disabled', sa.enabled ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(sa.enabled) }),
          btn('setup:modal:__addTwitch:35', 'Add Twitch Streamer', ButtonStyle.Primary, { emoji: '💜' }),
          btn('setup:modal:__addYT:35', 'Add YouTube Channel', ButtonStyle.Danger, { emoji: '🔴' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // ==========================================================================
  // 36–55. FEATURE CONTROL CENTER (appended pages). These reuse the engine's
  // generic router handlers only (ntog / chan / toggle / go / Link buttons), so
  // they need ZERO changes to interactions.js. `idx` is the page's own index —
  // used in customIds so re-render always returns to the same page.
  // (WEB base URL is defined at module scope, just above the PAGES array.)
  // ==========================================================================
  {
    id: 'shifts', title: 'Shift Management', emoji: '🕒', category: 'Staff Ops',
    render(cfg, client, idx) {
      const s = cfg.settings.shifts || {};
      const desc =
        `**Staff clock-in / clock-out with weekly hour tracking.**\n\n` +
        `• **Status:** ${on(s.enabled)}\n` +
        `• **Shift Log Channel:** ${chan(s.logChannel)}\n` + 
        `• **Staff Roles:** \`${s.staffRoles?.length || 0}\` configured (manage on the web)\n\n` +
        `Members use \`!shift start\` / \`!shift end\`. Full roster, roles & leaderboard on the dashboard.`;
      const rows = [
        chanSelect('shifts.logChannel', idx, s.logChannel, 'Shift log channel…'),
        new ActionRowBuilder().addComponents(
          btn(`setup:ntog:shifts:enabled:${idx}`, s.enabled ? 'Enabled' : 'Disabled', s.enabled ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(s.enabled) }),
          btn('link', 'Open Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/shifts` }),
        ),
      ];
      return { desc, rows };
    },
  },
  {
    id: 'departments', title: 'Departments', emoji: '🏢', category: 'Staff Ops',
    render(cfg, client, idx) {
      const d = cfg.settings.departments || {};
      const desc =
        `**Organise members into units (PD / Fire / EMS …) with roles & auto-callsigns.**\n\n` +
        `• **Status:** ${on(d.enabled)}\n` +
        `• **Activity Log Channel:** ${chan(d.logChannel)}\n` +
        `• **Departments Defined:** \`${d.list?.length || 0}\`\n\n` +
        `Members use \`!dept join <name>\`. Create departments, roles & callsign prefixes on the web.`;
      const rows = [
        chanSelect('departments.logChannel', idx, d.logChannel, 'Department log channel…'),
        new ActionRowBuilder().addComponents(
          btn(`setup:ntog:departments:enabled:${idx}`, d.enabled ? 'Enabled' : 'Disabled', d.enabled ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(d.enabled) }),
          btn('link', 'Open Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/departments` }),
        ),
      ];
      return { desc, rows };
    },
  },
  {
    id: 'antiping', title: 'Anti-Ping Shield', emoji: '🛡️', category: 'Staff Ops',
    render(cfg, client, idx) {
      const a = cfg.settings.antiping || {};
      const desc =
        `**Protect staff from being pinged.** Deletes/​warns on pings to protected roles or users.\n\n` +
        `• **Status:** ${on(a.enabled)}\n` +
        `• **Protected Roles:** \`${a.roles?.length || 0}\`\n` +
        `• **Protected Users:** \`${a.users?.length || 0}\`\n\n` +
        `Pick which roles/users are shielded on the dashboard.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:ntog:antiping:enabled:${idx}`, a.enabled ? 'Enabled' : 'Disabled', a.enabled ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(a.enabled) }),
          btn('link', 'Open Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/antiping` }),
        ),
      ];
      return { desc, rows };
    },
  },
  {
    id: 'verifygate', title: 'Member Verification Gate', emoji: '✅', category: 'Community',
    render(cfg, client, idx) {
      const v = cfg.settings.verify || {};
      const desc =
        `**Gate new members behind a verification step before they can chat.**\n\n` +
        `• **Status:** ${on(v.enabled)}\n` +
        `• **Set Nickname on Verify:** ${boolEmoji(v.nickname)}\n` +
        `• **Verified Role:** ${v.roleId ? `<@&${v.roleId}>` : '_none_'}\n` +
        `• **Unverified Role:** ${v.unverifiedRoleId ? `<@&${v.unverifiedRoleId}>` : '_none_'}\n\n` +
        `Assign the verified/unverified roles on the dashboard.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:ntog:verify:enabled:${idx}`, v.enabled ? 'Enabled' : 'Disabled', v.enabled ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(v.enabled) }),
          btn(`setup:ntog:verify:nickname:${idx}`, 'Auto-Nickname', v.nickname ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: '🏷️' }),
          btn('link', 'Open Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/verify` }),
        ),
      ];
      return { desc, rows };
    },
  },
  {
    id: 'reactionroles', title: 'Reaction Roles', emoji: '🎭', category: 'Engagement',
    render(cfg, client, idx) {
      const enabled = (cfg.modules || {}).reactionRoles !== false;
      const desc =
        `**Let members self-assign roles by clicking a reaction or button.**\n\n` +
        `• **Module:** ${on(enabled)}\n\n` +
        `Build reaction-role panels with \`/reactionrole\` once the module is on.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:toggle:reactionRoles:${idx}`, enabled ? 'Enabled' : 'Disabled', enabled ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(enabled) }),
        ),
      ];
      return { desc, rows };
    },
  },
  {
    id: 'autoresponders', title: 'Autoresponders', emoji: '💬', category: 'Community',
    render(cfg) {
      const list = cfg.settings.autoresponders || [];
      const active = Array.isArray(list) ? list.filter((r) => r.enabled !== false).length : 0;
      const desc =
        `**Keyword → automatic reply.** Great for FAQs, rules links, and canned answers.\n\n` +
        `• **Responders Configured:** \`${Array.isArray(list) ? list.length : 0}\`\n` +
        `• **Currently Active:** \`${active}\`\n\n` +
        `Add triggers, match types (exact / contains / regex) and replies on the dashboard.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Manage Autoresponders', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/autoresponders` }),
        ),
      ];
      return { desc, rows };
    },
  },
  {
    id: 'templates', title: 'Message Templates', emoji: '🧾', category: 'Community',
    render(cfg) {
      const t = cfg.settings.templates || {};
      const desc =
        `**Reusable embed/message templates** with 60+ variables ({user}, {server}, session data…).\n\n` +
        `Design templates in the visual builder, then post them with \`!template send <name>\`.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Open Template Builder', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/templates` }),
        ),
      ];
      return { desc, rows };
    },
  },
  {
    id: 'modlog', title: 'Infractions & Modlog', emoji: '📕', category: 'Staff Ops',
    render(cfg, client, idx) {
      const enabled = (cfg.modules || {}).moderation !== false;
      const desc =
        `**Warn / mute / kick / ban tracking** with case IDs, escalation, and a designed modlog embed.\n\n` +
        `• **Moderation Module:** ${on(enabled)}\n\n` +
        `Design the infraction embed and browse cases on the dashboard.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:toggle:moderation:${idx}`, enabled ? 'Enabled' : 'Disabled', enabled ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(enabled) }),
          btn('link', 'Modlog Designer', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/infractions` }),
        ),
      ];
      return { desc, rows };
    },
  },
  {
    id: 'sessions', title: 'ER:LC Sessions (SSU)', emoji: '🚔', category: 'Roleplay',
    render() {
      const desc =
        `**Server Start-Up polls & live ER:LC session boards.**\n\n` +
        `Start a session with \`!session\` — members vote to go live, and the board tracks player counts, ` +
        `region, and a join link. Live stats need an ER:LC API key (set per session, privately).`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Open Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/dashboard` }),
        ),
      ];
      return { desc, rows };
    },
  },
  {
    id: 'bolo', title: 'BOLO Board', emoji: '🚨', category: 'Roleplay',
    render() {
      const desc =
        `**Be-On-the-Look-Out alerts** for roleplay — post a suspect/vehicle with details and a photo.\n\n` +
        `Create and clear BOLOs with \`/bolo\`. Active BOLOs surface on the dispatch feed.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Dispatch Feed', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/dispatch` }),
        ),
      ];
      return { desc, rows };
    },
  },
  {
    id: 'cad', title: 'CAD & Dispatch', emoji: '📟', category: 'Roleplay',
    render() {
      const desc =
        `**Computer-Aided Dispatch** — units, calls, and a live dispatch board for your ER:LC ops.\n\n` +
        `Grant CAD access and open the board from the dashboard.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Open Dispatch', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/dispatch` }),
        ),
      ];
      return { desc, rows };
    },
  },
  {
    id: 'badges', title: 'Badges & Achievements', emoji: '🏅', category: 'Engagement',
    render(cfg, client, idx) {
      const enabled = (cfg.modules || {}).gamification !== false;
      const desc =
        `**Unlockable badges** members earn by leveling up and hitting milestones.\n\n` +
        `• **Gamification Module:** ${on(enabled)}\n\n` +
        `Badges unlock automatically as members progress — powered by the leveling system.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:toggle:gamification:${idx}`, enabled ? 'Enabled' : 'Disabled', enabled ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(enabled) }),
        ),
      ];
      return { desc, rows };
    },
  },
  {
    id: 'giveaways', title: 'Giveaways', emoji: '🎉', category: 'Engagement',
    render() {
      const desc =
        `**Run timed giveaways** with entry buttons, requirements, and automatic winner rolls.\n\n` +
        `Launch and reroll giveaways from the dashboard or with \`/giveaway\`.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Open Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/dashboard` }),
        ),
      ];
      return { desc, rows };
    },
  },
  {
    id: 'forms', title: 'Form Builder', emoji: '📝', category: 'Web & API',
    render() {
      const desc =
        `**Custom application & report forms** — staff apps, ban appeals, tryout signups.\n\n` +
        `Build multi-question forms on the web; submissions route to a channel you choose.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Open Form Builder', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/forms` }),
        ),
      ];
      return { desc, rows };
    },
  },
  {
    id: 'embeds', title: 'Embed Widgets', emoji: '🖼️', category: 'Web & API',
    render() {
      const desc =
        `**Design rich embeds & interactive widgets** and post them to any channel.\n\n` +
        `Craft embeds with live preview on the dashboard, then send or schedule them.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Open Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/dashboard` }),
        ),
      ];
      return { desc, rows };
    },
  },
  {
    id: 'automations', title: 'Guild Automations', emoji: '⚙️', category: 'Advanced',
    render() {
      const desc =
        `**When X happens → do Y.** No-code automation flows (message triggers, joins, reactions → actions).\n\n` +
        `Build automation flows visually on the dashboard.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Open Automations', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/dashboard` }),
        ),
      ];
      return { desc, rows };
    },
  },
  {
    id: 'backups', title: 'Backup & Restore', emoji: '💾', category: 'Advanced',
    render() {
      const desc =
        `**Encrypted server backups** — roles, channels, and settings snapshotted with AES-256.\n\n` +
        `Create or restore a backup with owner commands. Backups are encrypted at rest.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Open Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/dashboard` }),
        ),
      ];
      return { desc, rows };
    },
  },
  {
    id: 'devapi', title: 'Developer API', emoji: '🔌', category: 'Web & API',
    render() {
      const desc =
        `**REST API + keys** to read your server's stats, economy, and logs programmatically.\n\n` +
        `Generate an API key with \`!apikey\` and read the docs on the developer portal.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Developer Portal', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/developers` }),
        ),
      ];
      return { desc, rows };
    },
  },
  {
    id: 'analytics', title: 'Live Analytics & Pulse', emoji: '📈', category: 'Web & API',
    render() {
      const desc =
        `**Real-time server pulse** — messages/min, top talkers, heartbeat — plus XP leaderboards.\n\n` +
        `Watch the live pulse and climb the leaderboard on the web.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Live Pulse', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/pulse` }),
          btn('link', 'Leaderboard', ButtonStyle.Link, { emoji: '🏆', url: `${WEB}/leaderboard` }),
        ),
      ];
      return { desc, rows };
    },
  },
  {
    id: 'quicklinks', title: 'Quick Links Directory', emoji: '🧭', category: 'Web & API',
    render() {
      const desc =
        `**Every control surface in one place.** Jump straight to the dashboards for each system.\n\n` +
        `Everything on \`${WEB}\` respects your Manage-Server permission.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Dashboard', ButtonStyle.Link, { emoji: '🏠', url: `${WEB}/dashboard` }),
          btn('link', 'Shifts', ButtonStyle.Link, { emoji: '🕒', url: `${WEB}/shifts` }),
          btn('link', 'Departments', ButtonStyle.Link, { emoji: '🏢', url: `${WEB}/departments` }),
          btn('link', 'Templates', ButtonStyle.Link, { emoji: '🧾', url: `${WEB}/templates` }),
        ),
        new ActionRowBuilder().addComponents(
          btn('link', 'Autoresponders', ButtonStyle.Link, { emoji: '💬', url: `${WEB}/autoresponders` }),
          btn('link', 'Anti-Ping', ButtonStyle.Link, { emoji: '🛡️', url: `${WEB}/antiping` }),
          btn('link', 'Infractions', ButtonStyle.Link, { emoji: '📕', url: `${WEB}/infractions` }),
          btn('link', 'Forms', ButtonStyle.Link, { emoji: '📝', url: `${WEB}/forms` }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 36. GAMIFICATION MODULE TOGGLE
  // -------------------------------------------------------------------------
  {
    id: 'gamification-module',
    title: 'Gamification Module',
    emoji: '🎮',
    category: 'Modules',
    render(cfg, client, idx) {
      const enabled = (cfg.modules || {}).gamification !== false;
      const desc =
        `**Gamification Engine Master Switch**\n\n` +
        `Globally enable or disable all gamification features, including leveling, XP, and badges.\n\n` +
        `• **Status:** ${on(enabled)}`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:toggle:gamification:${idx}`, enabled ? 'Disable' : 'Enable', enabled ? ButtonStyle.Danger : ButtonStyle.Success, { emoji: boolEmoji(enabled) }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 37. MODERATION MODULE TOGGLE
  // -------------------------------------------------------------------------
  {
    id: 'moderation-module',
    title: 'Moderation Module',
    emoji: '🛡️',
    category: 'Modules',
    render(cfg, client, idx) {
      const enabled = (cfg.modules || {}).moderation !== false;
      const desc =
        `**Moderation Engine Master Switch**\n\n` +
        `Globally enable or disable all moderation features, including infractions, kicks, bans, and timeouts.\n\n` +
        `• **Status:** ${on(enabled)}`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:toggle:moderation:${idx}`, enabled ? 'Disable' : 'Enable', enabled ? ButtonStyle.Danger : ButtonStyle.Success, { emoji: boolEmoji(enabled) }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 38. AUTOMOD MODULE TOGGLE
  // -------------------------------------------------------------------------
  {
    id: 'automod-module',
    title: 'Automod Module',
    emoji: '🤖',
    category: 'Modules',
    render(cfg, client, idx) {
      const enabled = (cfg.modules || {}).automod !== false;
      const desc =
        `**Automated Moderation Master Switch**\n\n` +
        `Globally enable or disable all automated moderation features, including anti-spam, invite blocking, and bad words filter.\n\n` +
        `• **Status:** ${on(enabled)}`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:toggle:automod:${idx}`, enabled ? 'Disable' : 'Enable', enabled ? ButtonStyle.Danger : ButtonStyle.Success, { emoji: boolEmoji(enabled) }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 39. LEVELING MODULE TOGGLE
  // -------------------------------------------------------------------------
  {
    id: 'leveling-module',
    title: 'Leveling Module',
    emoji: '📊',
    category: 'Modules',
    render(cfg, client, idx) {
      const enabled = (cfg.modules || {}).leveling !== false;
      const desc =
        `**Leveling System Master Switch**\n\n` +
        `Globally enable or disable the XP and leveling system for this server.\n\n` +
        `• **Status:** ${on(enabled)}`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:toggle:leveling:${idx}`, enabled ? 'Disable' : 'Enable', enabled ? ButtonStyle.Danger : ButtonStyle.Success, { emoji: boolEmoji(enabled) }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 40. TICKETS MODULE TOGGLE
  // -------------------------------------------------------------------------
  {
    id: 'tickets-module',
    title: 'Tickets Module',
    emoji: '🎫',
    category: 'Modules',
    render(cfg, client, idx) {
      const enabled = (cfg.modules || {}).tickets !== false;
      const desc =
        `**Ticket System Master Switch**\n\n` +
        `Globally enable or disable the entire ticket system, including panels and DM modmail.\n\n` +
        `• **Status:** ${on(enabled)}`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:toggle:tickets:${idx}`, enabled ? 'Disable' : 'Enable', enabled ? ButtonStyle.Danger : ButtonStyle.Success, { emoji: boolEmoji(enabled) }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 41. STARBOARD MODULE TOGGLE
  // -------------------------------------------------------------------------
  {
    id: 'starboard-module',
    title: 'Starboard Module',
    emoji: '⭐',
    category: 'Modules',
    render(cfg, client, idx) {
      const enabled = (cfg.modules || {}).starboard !== false;
      const desc =
        `**Starboard System Master Switch**\n\n` +
        `Globally enable or disable the starboard feature for showcasing server highlights.\n\n` +
        `• **Status:** ${on(enabled)}`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:toggle:starboard:${idx}`, enabled ? 'Disable' : 'Enable', enabled ? ButtonStyle.Danger : ButtonStyle.Success, { emoji: boolEmoji(enabled) }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 42. INVITES MODULE TOGGLE
  // -------------------------------------------------------------------------
  {
    id: 'invites-module',
    title: 'Invites Module',
    emoji: '🔗',
    category: 'Modules',
    render(cfg, client, idx) {
      const enabled = (cfg.modules || {}).invites !== false;
      const desc =
        `**Invite Tracking Master Switch**\n\n` +
        `Globally enable or disable invite tracking and related features.\n\n` +
        `• **Status:** ${on(enabled)}`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:toggle:invites:${idx}`, enabled ? 'Disable' : 'Enable', enabled ? ButtonStyle.Danger : ButtonStyle.Success, { emoji: boolEmoji(enabled) }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 43. WELCOME MODULE TOGGLE
  // -------------------------------------------------------------------------
  {
    id: 'welcome-module',
    title: 'Welcome Module',
    emoji: '👋',
    category: 'Modules',
    render(cfg, client, idx) {
      const enabled = (cfg.modules || {}).welcome !== false;
      const desc =
        `**Welcome & Goodbye System Master Switch**\n\n` +
        `Globally enable or disable automated welcome and goodbye messages.\n\n` +
        `• **Status:** ${on(enabled)}`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:toggle:welcome:${idx}`, enabled ? 'Disable' : 'Enable', enabled ? ButtonStyle.Danger : ButtonStyle.Success, { emoji: boolEmoji(enabled) }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 44. MUSIC MODULE TOGGLE
  // -------------------------------------------------------------------------
  {
    id: 'music-module',
    title: 'Music Module',
    emoji: '🎶',
    category: 'Modules',
    render(cfg, client, idx) {
      const enabled = (cfg.modules || {}).music !== false;
      const desc =
        `**Music Playback Master Switch**\n\n` +
        `Globally enable or disable music playback features.\n\n` +
        `• **Status:** ${on(enabled)}`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:toggle:music:${idx}`, enabled ? 'Disable' : 'Enable', enabled ? ButtonStyle.Danger : ButtonStyle.Success, { emoji: boolEmoji(enabled) }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 45. AI MODULE TOGGLE
  // -------------------------------------------------------------------------
  {
    id: 'ai-module',
    title: 'AI Module',
    emoji: '🧠',
    category: 'Modules',
    render(cfg, client, idx) {
      const enabled = (cfg.modules || {}).ai !== false;
      const desc =
        `**AI Assistant Master Switch**\n\n` +
        `Globally enable or disable the AI assistant features for this server.\n\n` +
        `• **Status:** ${on(enabled)}`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:toggle:ai:${idx}`, enabled ? 'Disable' : 'Enable', enabled ? ButtonStyle.Danger : ButtonStyle.Success, { emoji: boolEmoji(enabled) }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 46. REACTION ROLES MODULE TOGGLE
  // -------------------------------------------------------------------------
  {
    id: 'reactionroles-module',
    title: 'Reaction Roles Module',
    emoji: '🎭',
    category: 'Modules',
    render(cfg, client, idx) {
      const enabled = (cfg.modules || {}).reactionRoles !== false;
      const desc =
        `**Reaction Roles Master Switch**\n\n` +
        `Globally enable or disable the reaction roles feature.\n\n` +
        `• **Status:** ${on(enabled)}`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:toggle:reactionRoles:${idx}`, enabled ? 'Disable' : 'Enable', enabled ? ButtonStyle.Danger : ButtonStyle.Success, { emoji: boolEmoji(enabled) }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 47. ECONOMY COOLDOWNS
  // -------------------------------------------------------------------------
  {
    id: 'economy-cooldowns',
    title: 'Economy Cooldowns',
    emoji: '⏳',
    category: 'Economy',
    render(cfg, client, idx) {
      const e = cfg.settings.economy || {};
      const desc =
        `**Configure cooldown periods for economy actions.**\n\n` +
        `• **Work Cooldown:** \`${e.workCooldown || 3600}\` seconds\n` +
        `• **Rob Penalty:** \`${e.robPenalty || 0.25}\` (e.g., 0.25 = 25% of target's balance)`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:modal:economy.workCooldown:${idx}`, 'Work Cooldown (s)', ButtonStyle.Secondary, { emoji: '⏱️' }),
          btn(`setup:modal:economy.robPenalty:${idx}`, 'Rob Penalty (ratio)', ButtonStyle.Secondary, { emoji: '💸' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 48. ANTI-RAID ADVANCED
  // -------------------------------------------------------------------------
  {
    id: 'anti-raid-advanced',
    title: 'Anti-Raid Advanced',
    emoji: '🚨',
    category: 'Moderation',
    render(cfg, client, idx) {
      const s = cfg.settings.safety || {};
      const desc =
        `**Advanced Anti-Raid & Verification Settings**\n\n` +
        `• **Anti-Raid Verification:** ${on(s.antiRaid)}\n` +
        `• **Captcha on Join:** ${on(s.captchaOnJoin)}\n` +
        `• **Account Age Limit:** \`${s.accountAgeLimitDays || 7}\` days`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:ntog:safety:antiRaid:${idx}`, 'Anti-Raid', s.antiRaid ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(s.antiRaid) }),
          btn(`setup:ntog:safety:captchaOnJoin:${idx}`, 'Captcha on Join', s.captchaOnJoin ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(s.captchaOnJoin) }),
          btn(`setup:modal:safety.accountAgeLimitDays:${idx}`, 'Account Age Limit (days)', ButtonStyle.Secondary, { emoji: '🗓️' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 49. AI SYSTEM PROMPT & NSFW
  // -------------------------------------------------------------------------
  {
    id: 'ai-system-prompt',
    title: 'AI System Prompt',
    emoji: '📝',
    category: 'AI',
    render(cfg, client, idx) {
      const ai = cfg.settings.ai || {};
      const desc =
        `**Configure the AI's core instructions and content filtering.**\n\n` +
        `• **System Prompt:** \`${truncateStr(ai.systemPrompt || 'Default', 80)}\`\n` +
        `• **Allow NSFW Contexts:** ${on(ai.allowNSFW)}`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:modal:ai.systemPrompt:${idx}`, 'Edit System Prompt', ButtonStyle.Secondary, { emoji: '✍️' }),
          btn(`setup:ntog:ai:allowNSFW:${idx}`, 'Allow NSFW', ai.allowNSFW ? ButtonStyle.Danger : ButtonStyle.Secondary, { emoji: boolEmoji(ai.allowNSFW) }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 50. COUNTING GAME RESET
  // -------------------------------------------------------------------------
  {
    id: 'counting-reset',
    title: 'Counting Game Reset',
    emoji: '♻️',
    category: 'Games',
    render(cfg, client, idx) {
      const c = cfg.settings.counting || {};
      const desc =
        `**Reset the Counting Game's current state.**\n\n` +
        `• **Current Number:** \`${c.currentNumber || 0}\`\n` +
        `• **Last User:** ${c.lastUser ? `<@${c.lastUser}>` : '_none_'}\n` +
        `• **High Score:** \`${c.highScore || 0}\`\n\n` +
        `Clicking the button below will reset the current number, last user, and high score to zero.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:modal:__resetCounting:${idx}`, 'Reset Counting Game', ButtonStyle.Danger, { emoji: '🗑️' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 51. SUGGESTIONS EMOJIS
  // -------------------------------------------------------------------------
  {
    id: 'suggestions-emojis',
    title: 'Suggestions Emojis',
    emoji: '👍',
    category: 'Community',
    render(cfg, client, idx) {
      const s = cfg.settings.suggestions || {};
      const desc =
        `**Customize the emojis used for voting on suggestions.**\n\n` +
        `• **Upvote Emoji:** ${s.upvoteEmoji || '👍'}\n` +
        `• **Downvote Emoji:** ${s.downvoteEmoji || '👎'}`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:modal:suggestions.upvoteEmoji:${idx}`, 'Set Upvote Emoji', ButtonStyle.Secondary, { emoji: '⬆️' }),
          btn(`setup:modal:suggestions.downvoteEmoji:${idx}`, 'Set Downvote Emoji', ButtonStyle.Secondary, { emoji: '⬇️' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 52. CASINO HOUSE EDGE
  // -------------------------------------------------------------------------
  {
    id: 'casino-house-edge',
    title: 'Casino House Edge',
    emoji: '🎲',
    category: 'Economy',
    render(cfg, client, idx) {
      const c = cfg.settings.casino || {};
      const desc =
        `**Configure the house's advantage in casino games.**\n\n` +
        `• **House Edge:** \`${(c.houseEdge * 100 || 5)}%\` (e.g., 0.05 = 5% house edge)`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:modal:casino.houseEdge:${idx}`, 'Set House Edge (ratio)', ButtonStyle.Secondary, { emoji: '📈' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 53. RECAP DAY OF WEEK
  // -------------------------------------------------------------------------
  {
    id: 'recap-day-of-week',
    title: 'Recap Day of Week',
    emoji: '📅',
    category: 'Community',
    render(cfg, client, idx) {
      const r = cfg.settings.recap || {};
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const desc =
        `**Choose which day of the week the weekly recap is sent.**\n\n` +
        `• **Recap Day:** \`${days[r.dayOfWeek || 0]}\``;
      const rows = [
        new ActionRowBuilder().addComponents(
          stringSelect(`setup:ntog:recap:dayOfWeek:${idx}`, 'Select Day', days.map((d, i) => ({ label: d, value: String(i), default: i === (r.dayOfWeek || 0) }))),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 54. VERIFY UNVERIFIED ROLE
  // -------------------------------------------------------------------------
  {
    id: 'verify-unverified-role',
    title: 'Verify Unverified Role',
    emoji: '🚫',
    category: 'Moderation',
    render(cfg, client, idx) {
      const v = cfg.settings.verify || {};
      const desc =
        `**Assign a role to members who have not yet been verified.**\n\n` +
        `• **Unverified Role:** ${v.unverifiedRoleId ? `<@&${v.unverifiedRoleId}>` : '_none_'}`;
      const rows = [
        roleSelect('verify.unverifiedRoleId', idx, v.unverifiedRoleId ? [v.unverifiedRoleId] : [], 'Select Unverified Role…', 1),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 55. ERLC API KEY
  // -------------------------------------------------------------------------
  {
    id: 'erlc-api-key',
    title: 'ER:LC API Key',
    emoji: '🔑',
    category: 'Integrations',
    render(cfg, client, idx) {
      const r = cfg.settings.erlcRegions || {};
      const desc =
        `**Provide your ER:LC API key for live telemetry data.**\n\n` +
        `• **API Key Status:** ${r.apiKey ? 'Configured' : '_none_'}\n\n` +
        `This key is used for features like live map positioning and server feeds. It is stored encrypted.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:modal:erlcRegions.apiKey:${idx}`, 'Set ER:LC API Key', ButtonStyle.Secondary, { emoji: '✏️' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 56. STREAM ALERTS TWITCH USERS
  // -------------------------------------------------------------------------
  {
    id: 'stream-alerts-twitch',
    title: 'Stream Alerts: Twitch',
    emoji: '💜',
    category: 'Integrations',
    render(cfg, client, idx) {
      const sa = cfg.settings.streamAlerts || {};
      const desc =
        `**Manage Twitch users to monitor for live alerts.**\n\n` +
        `• **Monitored Twitch Channels:** \`${sa.twitchUsers?.length || 0}\` configured\n\n` +
        `Manage the list of Twitch users on the web dashboard.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Manage on Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/streamalerts` }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 57. STREAM ALERTS YOUTUBE CHANNELS
  // -------------------------------------------------------------------------
  {
    id: 'stream-alerts-youtube',
    title: 'Stream Alerts: YouTube',
    emoji: '🔴',
    category: 'Integrations',
    render(cfg, client, idx) {
      const sa = cfg.settings.streamAlerts || {};
      const desc =
        `**Manage YouTube channels to monitor for live alerts.**\n\n` +
        `• **Monitored YouTube Channels:** \`${sa.ytChannels?.length || 0}\` configured\n\n` +
        `Manage the list of YouTube channels on the web dashboard.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Manage on Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/streamalerts` }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 58. AUTORESPONDER TRIGGERS
  // -------------------------------------------------------------------------
  {
    id: 'autoresponder-triggers',
    title: 'Autoresponder Triggers',
    emoji: '💬',
    category: 'Community',
    render(cfg, client, idx) {
      const ar = cfg.settings.autoResponder || {};
      const triggerCount = Object.keys(ar.triggers || {}).length;
      const desc =
        `**Manage keyword-based automatic replies.**\n\n` +
        `• **Configured Triggers:** \`${triggerCount}\`\n\n` +
        `Add, edit, or remove autoresponder triggers on the web dashboard.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Manage on Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/autoresponders` }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // 59. AUTOMOD IGNORED CHANNELS/ROLES
  // -------------------------------------------------------------------------
  {
    id: 'automod-ignored',
    title: 'Automod Ignored',
    emoji: '🚫',
    category: 'Moderation',
    render(cfg, client, idx) {
      const a = cfg.settings.automod || {};
      const desc =
        `**Configure channels and roles that Automod should ignore.**\n\n` +
        `• **Ignored Channels:** ${chan(a.ignoredChannels?.length ? a.ignoredChannels[0] : null)}${a.ignoredChannels?.length > 1 ? ` (+${a.ignoredChannels.length - 1} more)` : ''}\n` +
        `• **Ignored Roles:** ${rolesStr(a.ignoredRoles?.length ? [a.ignoredRoles[0]] : null)}${a.ignoredRoles?.length > 1 ? ` (+${a.ignoredRoles.length - 1} more)` : ''}\n\n` +
        `Manage these lists on the web dashboard for full control.`;
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Manage on Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/automod` }),
        ),
      ];
      return { desc, rows };
    },
  },

  // ==========================================================================
  // 80–111. REFERENCE & FEATURE HUB PAGES (→ 112 total). Info + Link buttons
  // only (links never fire an interaction, so these can't "interaction failed").
  // ==========================================================================
  {
    id: 'music', title: "Music Player", emoji: '🎵', category: 'Engagement',
    render(cfg, client, idx) {
      const enabled = (cfg.modules || {}).music !== false;
      const desc = [
        `**🎵 Music Player**`,
        `High-quality audio streaming straight into your voice channels with a full queue.`,
        ``,
        `**Status**`,
        `• Module: ${on(enabled)}`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• \`/play <song|url>\` — queue a track or playlist`,
        `• \`/skip\` \`/pause\` \`/resume\` \`/stop\``,
        `• \`/queue\` — view what’s coming up next`,
        `• \`/nowplaying\` — current track + progress bar`,
        `• \`/loop\` — repeat one track or the whole queue`,
        `• \`/volume <0-100>\` — set playback loudness`,
        ``,
        `**Tips**`,
        `• Members must be in a voice channel to start playback.`,
        `• The queue clears automatically when everyone leaves.`,
        ``,
        `**Good for:** Community hangouts, study lounges, and events`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn(`setup:toggle:music:${idx}`, enabled ? 'Disable' : 'Enable', enabled ? ButtonStyle.Success : ButtonStyle.Secondary, { emoji: boolEmoji(enabled) }),
          btn('link', 'Documentation', ButtonStyle.Link, { emoji: '📖', url: `${WEB}/docs` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'tags', title: "Custom Tags", emoji: '🏷️', category: 'Utility',
    render(cfg, client, idx) {
      const desc = [
        `**🏷️ Custom Tags**`,
        `Save reusable snippets, FAQ answers, and canned responses your whole staff can recall instantly.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• \`/tag create <name> <content>\` — save a snippet`,
        `• \`/tag <name>\` — post a saved tag`,
        `• \`/tag edit <name>\` — update it`,
        `• \`/tag list\` — browse every tag`,
        `• \`/tag delete <name>\` — remove one`,
        ``,
        `**Tips**`,
        `• Great for rules links, application info, and repeat questions.`,
        `• Tags support the same variables as the message builder.`,
        ``,
        `**Good for:** FAQs, rules, and quick staff replies`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Documentation', ButtonStyle.Link, { emoji: '📖', url: `${WEB}/docs` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'afk', title: "AFK System", emoji: '💤', category: 'Utility',
    render(cfg, client, idx) {
      const desc = [
        `**💤 AFK System**`,
        `Mark yourself away — the bot flags you and auto-replies to anyone who mentions you.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• \`!afk <reason>\` — set your away status`,
        `• It clears the moment you send a message`,
        `• Mentioners see your reason + how long you’ve been gone`,
        ``,
        `**Tips**`,
        `• Reasons are optional — a bare \`!afk\` works too.`,
        `• Your nickname gets an [AFK] tag while away (where permitted).`,
        ``,
        `**Good for:** Staff stepping away and busy members`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Documentation', ButtonStyle.Link, { emoji: '📖', url: `${WEB}/docs` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'reminders', title: "Reminders", emoji: '⏰', category: 'Utility',
    render(cfg, client, idx) {
      const desc = [
        `**⏰ Reminders**`,
        `Personal and channel reminders that ping you exactly when they’re due.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• \`/remindme <time> <text>\` — e.g. \`2h drink water\``,
        `• \`/reminders\` — list your pending reminders`,
        `• \`/reminder cancel <id>\` — cancel one`,
        ``,
        `**Tips**`,
        `• Times accept \`10m\`, \`2h\`, \`3d\`, or \`next friday\`.`,
        `• Reminders survive bot restarts — they’re stored safely.`,
        ``,
        `**Good for:** Deadlines, events, and follow-ups`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Documentation', ButtonStyle.Link, { emoji: '📖', url: `${WEB}/docs` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'polls', title: "Polls & Voting", emoji: '📊', category: 'Community',
    render(cfg, client, idx) {
      const desc = [
        `**📊 Polls & Voting**`,
        `Spin up reaction or button polls and let the bot tally the votes automatically.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• \`/poll <question>\` — yes/no poll`,
        `• \`/poll <question> | A | B | C\` — multi-choice`,
        `• Live results update as people vote`,
        ``,
        `**Tips**`,
        `• Add up to 10 options in one poll.`,
        `• Close a poll early from its message menu.`,
        ``,
        `**Good for:** Decisions, feedback, and fun votes`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Documentation', ButtonStyle.Link, { emoji: '📖', url: `${WEB}/docs` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'trivia', title: "Trivia & Quizzes", emoji: '❓', category: 'Engagement',
    render(cfg, client, idx) {
      const desc = [
        `**❓ Trivia & Quizzes**`,
        `Fast-paced multiplayer trivia across dozens of categories with score tracking.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• \`/trivia\` — start a round`,
        `• \`/trivia category <name>\` — pick a topic`,
        `• \`/trivia leaderboard\` — see the top brains`,
        ``,
        `**Tips**`,
        `• First correct answer wins the point.`,
        `• Categories range from gaming to geography.`,
        ``,
        `**Good for:** Game nights and community engagement`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Documentation', ButtonStyle.Link, { emoji: '📖', url: `${WEB}/docs` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'shop', title: "Economy Shop", emoji: '🛒', category: 'Economy',
    render(cfg, client, idx) {
      const desc = [
        `**🛒 Economy Shop**`,
        `Sell roles, items, and perks for your server currency — a full storefront.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• \`/shop\` — browse what’s for sale`,
        `• \`/buy <item>\` — purchase with your balance`,
        `• \`/sell <item>\` — cash an item back in`,
        ``,
        `**Tips**`,
        `• Stock roles, colours, or custom items.`,
        `• Set prices and limits on the dashboard.`,
        ``,
        `**Good for:** Rewarding active, engaged members`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Open Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/dashboard` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'items', title: "Items & Inventory", emoji: '🎒', category: 'Economy',
    render(cfg, client, idx) {
      const desc = [
        `**🎒 Items & Inventory**`,
        `Custom items members can earn, trade, gift, and consume.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• \`/inventory\` — see what you own`,
        `• \`/use <item>\` — consume or activate an item`,
        `• \`/gift <item> @user\` — trade with a friend`,
        ``,
        `**Tips**`,
        `• Items can grant roles, currency, or effects.`,
        `• Design item behaviour on the dashboard.`,
        ``,
        `**Good for:** Collectibles, boosters, and loot`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Open Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/dashboard` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'fishing', title: "Fishing Minigame", emoji: '🎣', category: 'Engagement',
    render(cfg, client, idx) {
      const desc = [
        `**🎣 Fishing Minigame**`,
        `Cast a line for a chance at common, rare, and legendary catches worth currency.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• \`/fish\` — cast your line`,
        `• \`/fish stats\` — your catch record`,
        `• \`/fish sell\` — sell your haul`,
        ``,
        `**Tips**`,
        `• Rarer fish are worth far more currency.`,
        `• A short cooldown keeps it fair.`,
        ``,
        `**Good for:** Passive fun and an economy sink`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Documentation', ButtonStyle.Link, { emoji: '📖', url: `${WEB}/docs` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'pets', title: "Virtual Pets", emoji: '🐾', category: 'Engagement',
    render(cfg, client, idx) {
      const desc = [
        `**🐾 Virtual Pets**`,
        `Adopt, feed, and level up a companion pet that grows with you.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• \`/pet\` — check on your companion`,
        `• \`/pet feed\` — keep it happy`,
        `• \`/pet play\` — earn bonding XP`,
        ``,
        `**Tips**`,
        `• Neglected pets lose happiness over time.`,
        `• Higher-level pets unlock perks.`,
        ``,
        `**Good for:** Long-term engagement loops`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Documentation', ButtonStyle.Link, { emoji: '📖', url: `${WEB}/docs` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'reputation', title: "Reputation", emoji: '🌟', category: 'Community',
    render(cfg, client, idx) {
      const desc = [
        `**🌟 Reputation**`,
        `Let members reward each other with reputation for being helpful or kind.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• \`/rep @user\` — give a rep point`,
        `• \`/rep check @user\` — view someone’s rep`,
        `• \`/rep leaderboard\` — most-respected members`,
        ``,
        `**Tips**`,
        `• A daily cooldown prevents rep farming.`,
        `• Great signal for trustworthy members.`,
        ``,
        `**Good for:** Recognising helpful people`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Documentation', ButtonStyle.Link, { emoji: '📖', url: `${WEB}/docs` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'birthdays', title: "Birthdays", emoji: '🎂', category: 'Community',
    render(cfg, client, idx) {
      const desc = [
        `**🎂 Birthdays**`,
        `Celebrate members automatically with a birthday shout-out and optional role.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• \`/birthday set <date>\` — register yours`,
        `• \`/birthday upcoming\` — see who’s next`,
        `• Auto-announcement on the big day`,
        ``,
        `**Tips**`,
        `• Only the day/month is shown — never the year.`,
        `• Pick the announcement channel on the dashboard.`,
        ``,
        `**Good for:** Building a warm community`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Open Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/dashboard` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'timezones', title: "Timezones", emoji: '🕰️', category: 'Utility',
    render(cfg, client, idx) {
      const desc = [
        `**🕰️ Timezones**`,
        `Let members share their timezone so scheduling and conversions are painless.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• \`/timezone set <zone>\` — save yours`,
        `• \`/timezone @user\` — see their local time`,
        `• \`/time <zone>\` — convert on the fly`,
        ``,
        `**Tips**`,
        `• Accepts names like \`EST\`, \`PST\`, or \`Europe/London\`.`,
        `• Pairs perfectly with event scheduling.`,
        ``,
        `**Good for:** Global communities and events`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Documentation', ButtonStyle.Link, { emoji: '📖', url: `${WEB}/docs` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'translate', title: "Translation", emoji: '🈯', category: 'Utility',
    render(cfg, client, idx) {
      const desc = [
        `**🈯 Translation**`,
        `Translate messages between languages on demand or via the right-click menu.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• \`/translate <text>\` — auto-detect + translate`,
        `• \`/translate to:<lang> <text>\` — target a language`,
        `• Right-click a message → Apps → Translate`,
        ``,
        `**Tips**`,
        `• Supports 100+ languages.`,
        `• Handy for international servers.`,
        ``,
        `**Good for:** Cross-language communities`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Documentation', ButtonStyle.Link, { emoji: '📖', url: `${WEB}/docs` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'weatherpage', title: "Weather", emoji: '⛅', category: 'Utility',
    render(cfg, client, idx) {
      const desc = [
        `**⛅ Weather**`,
        `Live weather conditions and forecasts for any city on Earth.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• \`/weather <city>\` — current conditions`,
        `• \`/forecast <city>\` — multi-day outlook`,
        `• Temperature, wind, humidity, and more`,
        ``,
        `**Tips**`,
        `• Supports city names and postal codes.`,
        `• Data refreshes on every lookup.`,
        ``,
        `**Good for:** Casual utility and event planning`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Documentation', ButtonStyle.Link, { emoji: '📖', url: `${WEB}/docs` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'rss', title: "RSS & News Feeds", emoji: '📰', category: 'Integrations',
    render(cfg, client, idx) {
      const desc = [
        `**📰 RSS & News Feeds**`,
        `Auto-post new items from any RSS or Atom feed straight to a channel.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• Add a feed URL on the dashboard`,
        `• Choose the destination channel`,
        `• New items post automatically`,
        ``,
        `**Tips**`,
        `• Works with blogs, news sites, and status pages.`,
        `• Set a per-feed check interval.`,
        ``,
        `**Good for:** News, blogs, and status updates`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Open Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/dashboard` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'reddit', title: "Reddit Feed", emoji: '👽', category: 'Integrations',
    render(cfg, client, idx) {
      const desc = [
        `**👽 Reddit Feed**`,
        `Mirror new posts from your favourite subreddits into Discord.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• Add subreddits on the dashboard`,
        `• Filter by hot / new / top`,
        `• Posts embed title, author, and thumbnail`,
        ``,
        `**Tips**`,
        `• Great for game or hobby communities.`,
        `• Combine several subreddits into one channel.`,
        ``,
        `**Good for:** Hobby and fandom servers`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Open Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/dashboard` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'serverstats', title: "Server Stat Channels", emoji: '📈', category: 'Utility',
    render(cfg, client, idx) {
      const desc = [
        `**📈 Server Stat Channels**`,
        `Live voice-channel counters for members, bots, boosts, and more.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• Enable counters on the dashboard`,
        `• Each stat becomes a locked voice channel`,
        `• Auto-updates as your server grows`,
        ``,
        `**Tips**`,
        `• Members can’t join them — they’re display-only.`,
        `• Rename templates support emojis.`,
        ``,
        `**Good for:** Showing off growth at a glance`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Open Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/dashboard` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'sticky', title: "Sticky Messages", emoji: '📌', category: 'Moderation',
    render(cfg, client, idx) {
      const desc = [
        `**📌 Sticky Messages**`,
        `Keep an important message pinned to the bottom of a busy channel.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• \`/sticky set <message>\` — stick it`,
        `• \`/sticky remove\` — unstick`,
        `• It re-posts itself as chat scrolls`,
        ``,
        `**Tips**`,
        `• Perfect for channel rules or instructions.`,
        `• Only one sticky per channel.`,
        ``,
        `**Good for:** Rules and instructions in busy channels`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Documentation', ButtonStyle.Link, { emoji: '📖', url: `${WEB}/docs` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'autothread', title: "Auto-Threads", emoji: '🧵', category: 'Community',
    render(cfg, client, idx) {
      const desc = [
        `**🧵 Auto-Threads**`,
        `Automatically open a thread on every message in a channel — great for help desks.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• Enable per-channel on the dashboard`,
        `• Each new post gets its own thread`,
        `• Optional auto-archive timer`,
        ``,
        `**Tips**`,
        `• Keeps support and showcase channels tidy.`,
        `• Threads inherit the channel’s permissions.`,
        ``,
        `**Good for:** Help desks and showcase channels`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Open Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/dashboard` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'mediaonly', title: "Media-Only Channels", emoji: '🖼️', category: 'Moderation',
    render(cfg, client, idx) {
      const desc = [
        `**🖼️ Media-Only Channels**`,
        `Delete any message that has no attachment or link — perfect for galleries.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• Mark channels media-only on the dashboard`,
        `• Text-only messages are removed with a hint`,
        `• Links can be allowed or blocked`,
        ``,
        `**Tips**`,
        `• Ideal for art, clips, and meme channels.`,
        `• Staff can be exempted.`,
        ``,
        `**Good for:** Art, clips, and gallery channels`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Open Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/dashboard` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'linkfilter', title: "Link Filter", emoji: '🔗', category: 'Moderation',
    render(cfg, client, idx) {
      const desc = [
        `**🔗 Link Filter**`,
        `Block or whitelist links to keep spam, scams, and self-promo under control.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• Set allowed/blocked domains in Auto-Mod`,
        `• Optional invite-link blocking`,
        `• Offenders are warned + the message removed`,
        ``,
        `**Tips**`,
        `• Whitelist your own domains first.`,
        `• Combine with Anti-Phishing for full coverage.`,
        ``,
        `**Good for:** Spam and scam prevention`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Open Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/automod` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'antiphish', title: "Anti-Phishing", emoji: '🛑', category: 'Moderation',
    render(cfg, client, idx) {
      const desc = [
        `**🛑 Anti-Phishing**`,
        `Detect and remove known scam and phishing links automatically.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• Toggle in Auto-Moderation`,
        `• Checks against updated scam-link lists`,
        `• Removes + logs the offending message`,
        ``,
        `**Tips**`,
        `• Protects members from account-theft links.`,
        `• Pairs with the Link Filter.`,
        ``,
        `**Good for:** Keeping members safe from scams`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Open Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/automod` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'wordfilter', title: "Word Filter", emoji: '🤬', category: 'Moderation',
    render(cfg, client, idx) {
      const desc = [
        `**🤬 Word Filter**`,
        `An escalating filter for banned words: warn, timeout, kick, then ban.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• Manage the word list on the dashboard`,
        `• Set the escalation thresholds`,
        `• Bypass roles can be exempted`,
        ``,
        `**Tips**`,
        `• Supports wildcards and leetspeak variants.`,
        `• Keep the list private to avoid evasion.`,
        ``,
        `**Good for:** Language and tone enforcement`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Open Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/automod` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'ghostping', title: "Ghost-Ping Detection", emoji: '👻', category: 'Moderation',
    render(cfg, client, idx) {
      const desc = [
        `**👻 Ghost-Ping Detection**`,
        `Catch members who ping someone then delete the message — the mention gets logged.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• Enable logging in Safety & Privacy`,
        `• Deleted mentions are captured`,
        `• Optional public call-out`,
        ``,
        `**Tips**`,
        `• Deters bait-and-delete harassment.`,
        `• Logs include the original content.`,
        ``,
        `**Good for:** Reducing ping abuse`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Open Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/logging` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'colorroles', title: "Color Roles", emoji: '🎨', category: 'Engagement',
    render(cfg, client, idx) {
      const desc = [
        `**🎨 Color Roles**`,
        `Let members pick their own name colour from a curated palette.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• Build a colour panel with \`/reactionrole\``,
        `• Members click to recolour their name`,
        `• One colour at a time, swapped cleanly`,
        ``,
        `**Tips**`,
        `• Keep colours readable on dark and light themes.`,
        `• Great low-effort personalisation.`,
        ``,
        `**Good for:** Personalisation and self-expression`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Documentation', ButtonStyle.Link, { emoji: '📖', url: `${WEB}/docs` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'boosterperks', title: "Booster Perks", emoji: '💜', category: 'Community',
    render(cfg, client, idx) {
      const desc = [
        `**💜 Booster Perks**`,
        `Reward your server boosters with roles, a custom colour, or a shout-out.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• Configure booster rewards on the dashboard`,
        `• Auto-thank on new boosts`,
        `• Optional custom-role perk`,
        ``,
        `**Tips**`,
        `• Boosters love visible recognition.`,
        `• Perks apply and remove automatically.`,
        ``,
        `**Good for:** Thanking and retaining boosters`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Open Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/dashboard` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'schedule', title: "Scheduled Messages", emoji: '🗓️', category: 'Utility',
    render(cfg, client, idx) {
      const desc = [
        `**🗓️ Scheduled Messages**`,
        `Queue announcements to post at a future time — once or on a repeat.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• Compose and schedule on the dashboard`,
        `• One-off or recurring cadence`,
        `• Full embed support`,
        ``,
        `**Tips**`,
        `• Perfect for recurring events and reminders.`,
        `• Times respect your server timezone.`,
        ``,
        `**Good for:** Announcements and recurring notices`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Open Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/dashboard` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'appeals', title: "Ban Appeals", emoji: '📨', category: 'Moderation',
    render(cfg, client, idx) {
      const desc = [
        `**📨 Ban Appeals**`,
        `Give banned members a structured way to appeal — routed straight to your staff.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• Build the appeal form in the Form Builder`,
        `• Appeals arrive in a staff channel`,
        `• Approve or deny with a click`,
        ``,
        `**Tips**`,
        `• Keeps appeals organised and on-record.`,
        `• Customise the questions you ask.`,
        ``,
        `**Good for:** Fair, organised moderation`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Open Dashboard', ButtonStyle.Link, { emoji: '🌐', url: `${WEB}/forms` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'reports', title: "Report System", emoji: '🚩', category: 'Moderation',
    render(cfg, client, idx) {
      const desc = [
        `**🚩 Report System**`,
        `Let members report messages or users directly to your moderation team.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• Right-click a message → Apps → Report`,
        `• \`/report @user <reason>\` — report a member`,
        `• Reports post to your chosen mod channel`,
        ``,
        `**Tips**`,
        `• Reporters can stay anonymous.`,
        `• Each report includes a jump link.`,
        ``,
        `**Good for:** Community-driven moderation`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Documentation', ButtonStyle.Link, { emoji: '📖', url: `${WEB}/docs` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'feedback', title: "Feedback Box", emoji: '💡', category: 'Community',
    render(cfg, client, idx) {
      const desc = [
        `**💡 Feedback Box**`,
        `Collect anonymous or named feedback and ideas from your community.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• \`/feedback <message>\` — send feedback`,
        `• Set a feedback channel in Community`,
        `• Optional anonymous mode`,
        ``,
        `**Tips**`,
        `• Anonymous mode boosts honest input.`,
        `• Star great ideas for follow-up.`,
        ``,
        `**Good for:** Listening to your members`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Documentation', ButtonStyle.Link, { emoji: '📖', url: `${WEB}/docs` }),
        ),
      ];
      return { desc, rows };
    },
  },

  {
    id: 'rulesgate', title: "Rules Agreement Gate", emoji: '📜', category: 'Community',
    render(cfg, client, idx) {
      const desc = [
        `**📜 Rules Agreement Gate**`,
        `Require new members to agree to the rules before they can chat.`,
        ``,
        `**Status**`,
        `• Availability: 🟢 Active`,
        `• Scope: This server`,
        ``,
        `**Commands**`,
        `• Post a rules panel with an Agree button`,
        `• Agreeing grants the member role`,
        `• Pairs with the Verification Gate`,
        ``,
        `**Tips**`,
        `• Reduces trolls and drive-by spam.`,
        `• Keep rules short and scannable.`,
        ``,
        `**Good for:** Onboarding and safety`,
      ].join('\n');
      const rows = [
        new ActionRowBuilder().addComponents(
          btn('link', 'Documentation', ButtonStyle.Link, { emoji: '📖', url: `${WEB}/docs` }),
        ),
      ];
      return { desc, rows };
    },
  },
];

// ============================================================================
// UI NAVIGATION GENERATOR & COMPONENT PAGINATOR
// ============================================================================

/**
 * Builds the page quick-jump menu
 */
function jumpRow(currentPage = 0) {
  // Option lists are bounded at 25 elements max by Discord.
  // We chunk or select options intelligently around the active index.
  const total = PAGES.length;
  let start = 0;
  if (total > 25) {
    start = Math.max(0, Math.min(currentPage - 12, total - 25));
  }
  const slice = PAGES.slice(start, start + 25);

  const select = new StringSelectMenuBuilder()
    .setCustomId('setup:jump')
    .setPlaceholder(`Jump to page (${start + 1}-${start + slice.length} of ${total})…`)
    .addOptions(
      slice.map((p, relativeIdx) => {
        const actualIdx = start + relativeIdx;
        return {
          label: `${actualIdx + 1}. ${p.title}`,
          value: String(actualIdx),
          emoji: p.emoji,
          description: p.category ? `Category: ${p.category}` : undefined,
          default: actualIdx === currentPage,
        };
      }),
    );
  return new ActionRowBuilder().addComponents(select);
}

/**
 * Builds the Prev / Home / Next navigation row
 */
function navRow(page) {
  const N = PAGES.length;
  const prev = (page - 1 + N) % N;
  const next = (page + 1) % N;
  return new ActionRowBuilder().addComponents(
    btn(`setup:nav:${prev}`, 'Prev', ButtonStyle.Secondary, { emoji: '◀️' }),
    btn('setup:home', `Page ${page + 1}/${N}`, ButtonStyle.Primary, { emoji: '🏠' }),
    btn(`setup:nav:${next}`, 'Next', ButtonStyle.Secondary, { emoji: '▶️' }),
  );
}

// ============================================================================
// MAIN RENDER ENGINE
// ============================================================================

/**
 * Main rendering router for generating the entire setup control panel payload.
 * Enforces Discord's strictly bounded limit of maximum 5 ActionRows per embed response.
 *
 * Layout Structure:
 *  - ActionRow 0: Quick Jump Select Menu
 *  - ActionRow 1: Navigation Control Bar (Prev / Home / Next)
 *  - ActionRow 2-4: Page-Specific Controls (Truncated at max 3 rows)
 */
export function renderPanel(client, guildId, page = 0) {
  const N = PAGES.length;
  const idx = ((page % N) + N) % N;
  const rawCfg = getCfg(guildId);
  const cfg = sanitizeConfig(rawCfg);
  cfg.guildId = guildId;

  const currentDef = PAGES[idx];
  const { desc, rows } = currentDef.render(cfg, client, idx);

  const embed = new EmbedBuilder()
    .setColor(PRIMARY_ACCENT)
    .setAuthor({
      name: `${client.user.username} • Setup Panel Terminal`,
      iconURL: client.user.displayAvatarURL?.(),
    })
    .setTitle(`${currentDef.emoji} ${currentDef.title}`)
    .setDescription(desc)
    .setFooter({
      text: `Page ${idx + 1} of ${N} | Category: ${currentDef.category || 'General'} • Use controls below`,
    })
    .setTimestamp();

  // Enforce strict Discord row constraint limit (Max 5 ActionRows)
  const components = [jumpRow(idx), navRow(idx), ...rows.slice(0, 3)];
  return { embeds: [embed], components };
}

// ============================================================================
// INTERACTION CONTROLLER & DISPATCH ROUTER
// ============================================================================

/**
 * Global handler for setup menu component interactions
 */
export async function handleSetupInteraction(interaction, client) {
  if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isChannelSelectMenu() && !interaction.isRoleSelectMenu() && !interaction.isModalSubmit()) {
    return;
  }

  const { customId, guildId } = interaction;
  if (!customId.startsWith('setup:')) return;

  const cfg = sanitizeConfig(getCfg(guildId));

  try {
    const parts = customId.split(':');
    const action = parts[1];

    // Navigation Events
    if (action === 'nav') {
      const targetPage = parseInt(parts[2], 10);
      return await interaction.update(renderPanel(client, guildId, targetPage));
    }

    if (action === 'home' || action === 'go') {
      const targetPage = parts[2] ? parseInt(parts[2], 10) : 0;
      return await interaction.update(renderPanel(client, guildId, targetPage));
    }

    if (action === 'jump' && interaction.isStringSelectMenu()) {
      const targetPage = parseInt(interaction.values[0], 10);
      return await interaction.update(renderPanel(client, guildId, targetPage));
    }

    if (action === 'refresh') {
      return await interaction.update(renderPanel(client, guildId, 0));
    }

    // Toggle Handlers
    if (action === 'toggle') {
      const key = parts[2];
      const currentPage = parseInt(parts[3], 10);
      cfg.modules[key] = !cfg.modules[key];
      updateCfg(guildId, { modules: cfg.modules });
      return await interaction.update(renderPanel(client, guildId, currentPage));
    }

    if (action === 'ntog') {
      // Nested setting path toggle: setup:ntog:category:key:page
      const category = parts[2];
      const key = parts[3];
      const currentPage = parseInt(parts[4], 10);

      if (!cfg.settings[category]) cfg.settings[category] = {};
      cfg.settings[category][key] = !cfg.settings[category][key];

      updateCfg(guildId, { settings: cfg.settings });
      return await interaction.update(renderPanel(client, guildId, currentPage));
    }

    if (action === 'amtog') {
      const key = parts[2];
      const currentPage = parseInt(parts[3], 10);
      if (!cfg.settings.automod) cfg.settings.automod = {};
      cfg.settings.automod[key] = !cfg.settings.automod[key];
      updateCfg(guildId, { settings: cfg.settings });
      return await interaction.update(renderPanel(client, guildId, currentPage));
    }

    if (action === 'safety' || action === 'ai' || action === 'community') {
      const key = parts[2];
      const currentPage = parseInt(parts[3], 10);
      if (!cfg.settings[action]) cfg.settings[action] = {};
      cfg.settings[action][key] = !cfg.settings[action][key];
      updateCfg(guildId, { settings: cfg.settings });
      return await interaction.update(renderPanel(client, guildId, currentPage));
    }

    // Channel Selection Handlers
    if (action === 'chan' && interaction.isChannelSelectMenu()) {
      const path = parts[2];
      const currentPage = parseInt(parts[3], 10);
      const selectedId = interaction.values[0] || null;

      setDeepProperty(cfg.settings, path, selectedId);
      updateCfg(guildId, { settings: cfg.settings });
      return await interaction.update(renderPanel(client, guildId, currentPage));
    }

    // Role Selection Handlers
    if (action === 'role' && interaction.isRoleSelectMenu()) {
      const key = parts[2];
      const currentPage = parseInt(parts[3], 10);
      const selectedIds = interaction.values;

      cfg.settings[key] = selectedIds;
      updateCfg(guildId, { settings: cfg.settings });
      return await interaction.update(renderPanel(client, guildId, currentPage));
    }

    // Auto-role Removal Handler
    if (action === 'ardel' && interaction.isStringSelectMenu()) {
      const lvlToRemove = interaction.values[0];
      const currentPage = parseInt(parts[2], 10);
      if (cfg.settings.autoroles && cfg.settings.autoroles[lvlToRemove]) {
        delete cfg.settings.autoroles[lvlToRemove];
        updateCfg(guildId, { settings: cfg.settings });
      }
      return await interaction.update(renderPanel(client, guildId, currentPage));
    }

    // Modal Request Handler
    if (action === 'modal') {
      const target = parts[2];
      const currentPage = parts[3];

      if (target === '__reset') {
        const modal = buildDynamicModal('setup:submitreset', 'Confirm Reset All Data', [
          { id: 'confirm', label: 'Type "RESET" to confirm', placeholder: 'RESET', required: true },
        ]);
        return await interaction.showModal(modal);
      }

      if (target === '__autorole') {
        const modal = buildDynamicModal(`setup:submitautorole:${currentPage}`, 'Map Level Auto-Role', [
          { id: 'level', label: 'Required Level Number', placeholder: '5', required: true },
          { id: 'roleId', label: 'Role ID', placeholder: '123456789012345678', required: true },
        ]);
        return await interaction.showModal(modal);
      }

      const currentValue = getDeepProperty(cfg.settings, target) ?? '';
      const modal = buildDynamicModal(`setup:submitval:${target}:${currentPage}`, `Set ${keyToLabel(target)}`, [
        { id: 'input', label: keyToLabel(target), value: String(currentValue), required: false },
      ]);
      return await interaction.showModal(modal);
    }

    // Modal Submissions
    if (action === 'submitval' && interaction.isModalSubmit()) {
      const path = parts[2];
      const currentPage = parseInt(parts[3], 10);
      const val = interaction.fields.getTextInputValue('input');

      // Numeric Conversion Attempt
      const parsedVal = !isNaN(val) && val.trim() !== '' ? Number(val) : val;

      setDeepProperty(cfg.settings, path, parsedVal);
      updateCfg(guildId, { settings: cfg.settings });
      return await interaction.reply({
        content: `✅ Updated **${keyToLabel(path)}** successfully.`,
        ephemeral: true,
      });
    }

    if (action === 'submitautorole' && interaction.isModalSubmit()) {
      const currentPage = parseInt(parts[2], 10);
      const level = interaction.fields.getTextInputValue('level');
      const roleId = interaction.fields.getTextInputValue('roleId');

      if (!cfg.settings.autoroles) cfg.settings.autoroles = {};
      cfg.settings.autoroles[level] = roleId;

      updateCfg(guildId, { settings: cfg.settings });
      return await interaction.reply({
        content: `✅ Level **${level}** mapped to role <@&${roleId}>.`,
        ephemeral: true,
      });
    }

    if (action === 'submitreset' && interaction.isModalSubmit()) {
      const input = interaction.fields.getTextInputValue('confirm');
      if (input !== 'RESET') {
        return await interaction.reply({ content: '❌ Confirmation failed. Type RESET exactly.', ephemeral: true });
      }

      resetCfgToDefault(guildId);
      return await interaction.update(renderPanel(client, guildId, 0));
    }
  } catch (err) {
    console.error(`[SetupEngine Error] Failed handling interaction ${customId}:`, err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ An error occurred processing this menu action.', ephemeral: true });
    }
  }
}

// ============================================================================
// PROPERTY ACCESSOR UTILITIES
// ============================================================================

function getDeepProperty(obj, path) {
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

function setDeepProperty(obj, path, value) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!current[p] || typeof current[p] !== 'object') {
      current[p] = {};
    }
    current = current[p];
  }
  current[parts[parts.length - 1]] = value;
}

// ============================================================================
// LOG
// ============================================================================

console.log(`[SetupEngine] UI Engine v${ENGINE_VERSION} loaded. Registered ${PAGES.length} data-driven pages.`);
// ============================================================================
// END OF FILE
// ============================================================================