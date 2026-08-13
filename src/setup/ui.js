// Setup UI Engine v4 — this will cost u 1.2k chris...... i hope u have sthm ur broke ass porb ... nah i am joking chilllllllll

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

import { getCfg, setCfg, updateCfg, resetCfgToDefault } from './store.js';
import { LANG_LIST } from '../i18n/index.js';
import {
  renderTicketMaster,
  renderTicketPanel,
  renderTicketBehavior,
  renderTicketDM,
  renderTicketExtras,
} from './ticketStudio.js';

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
  // ==========================================================================
  const WEB = 'https://sentinelbothq.com';
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