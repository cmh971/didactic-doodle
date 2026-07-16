// Setup UI Engine v3 — OVERKILL EDITION (≈600 LOC)
// Pure JavaScript (ES Modules) — Discord.js setup matrix
// • Data-driven pages (scales to 50+ screens)
// • Tiny component builders (buttons / selects / channel & role pickers)
// • Rich descriptions, hints, and guardrails
// • Owner / admin / safety / AI pages baked in

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType,
} from 'discord.js';
import { getCfg } from './store.js';
import { LANG_LIST } from '../i18n/index.js';
import {
  renderTicketMaster, renderTicketPanel, renderTicketBehavior, renderTicketDM, renderTicketExtras,
} from './ticketStudio.js';

const ACCENT = 0x5865f2;

// ---------------------------------------------------------------------------
// TINY COMPONENT BUILDERS
// ---------------------------------------------------------------------------
function btn(id, label, style = ButtonStyle.Secondary, { emoji, disabled } = {}) {
  const b = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
  if (emoji) b.setEmoji(emoji);
  if (disabled) b.setDisabled(true);
  return b;
}

function chanSelect(key, page, currentId, placeholder, types = [ChannelType.GuildText]) {
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
      // Fallback for older discord.js versions
    }
  }
  return new ActionRowBuilder().addComponents(m);
}

function roleSelect(key, page, currentIds, placeholder, max = 1) {
  const m = new RoleSelectMenuBuilder()
    .setCustomId(`setup:role:${key}:${page}`)
    .setPlaceholder(placeholder)
    .setMinValues(0)
    .setMaxValues(max);
  if (currentIds?.length) {
    try {
      m.setDefaultRoles(...currentIds.slice(0, max));
    } catch {
      // Fallback for older discord.js versions
    }
  }
  return new ActionRowBuilder().addComponents(m);
}

// ---------------------------------------------------------------------------
// FORMATTING HELPERS
// ---------------------------------------------------------------------------
const on = (v) => (v !== false ? '🟢 On' : '🔴 Off');
const chan = (id) => (id ? `<#${id}>` : '_none_');
const rolesStr = (ids) => (ids?.length ? ids.map((r) => `<@&${r}>`).join(', ') : '_none_');
const boolEmoji = (v) => (v ? '✅' : '❌');

// ---------------------------------------------------------------------------
// PAGE DEFINITIONS — DATA-DRIVEN INTERFACE SYSTEM
// ---------------------------------------------------------------------------
// Each page: { id, title, emoji, render(cfg, client, idx) -> { desc, rows } }
// NOTE: the trailing number in a component customId is the page index to
// re-render after the action. It MUST equal this page's index in PAGES.
export const PAGES = [
  // -------------------------------------------------------------------------
  // OVERVIEW (index 0)
  // -------------------------------------------------------------------------
  {
    id: 'overview',
    title: 'Overview',
    emoji: '🏠',
    render(cfg, client) {
      const m = cfg.modules || {};
      const langName = LANG_LIST.find((l) => l.code === cfg.language)?.name || cfg.language;
      const enabledModules = Object.entries(m)
        .map(([k, v]) => `${v !== false ? '✅' : '❌'} ${k}`)
        .join('  ');

      const desc =
        `Welcome to the **setup wizard**! Use the ◀ ▶ arrows or the dropdown to browse pages.\n\n` +
        `**Language:** ${langName}\n` +
        `**Modules:** ${enabledModules || '_none_'}\n` +
        `**Log channel:** ${chan(cfg.settings.logChannel)}\n` +
        `**Welcome channel:** ${chan(cfg.settings.welcomeChannel)}\n` +
        `**Auto-roles:** ${Object.keys(cfg.settings.autoroles || {}).length} configured\n` +
        `**Currency:** ${cfg.settings.currencyEmoji || '🪙'} ${cfg.settings.currencyName || 'Credits'}\n\n` +
        `Use the buttons below to jump into the most important configuration areas.`;

      const rows = [
        new ActionRowBuilder().addComponents(
          btn('setup:go:2', 'Modules', ButtonStyle.Primary, { emoji: '🧩' }),
          btn('setup:go:4', 'Leveling', ButtonStyle.Primary, { emoji: '📊' }),
          btn('setup:go:5', 'Automod', ButtonStyle.Primary, { emoji: '🛡️' }),
          btn('setup:go:6', 'Economy', ButtonStyle.Primary, { emoji: '🪙' }),
          btn('setup:refresh', 'Refresh', ButtonStyle.Secondary, { emoji: '🔄' }),
        ),
        new ActionRowBuilder().addComponents(
          btn('setup:ai', 'Talk to AI to auto-configure', ButtonStyle.Success, { emoji: '🤖' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // BOT IDENTITY (index 1)
  // -------------------------------------------------------------------------
  {
    id: 'identity',
    title: 'Bot Identity',
    emoji: '🤖',
    render(cfg, client) {
      const me = client.user;
      const guild = client.guilds.cache.get(cfg.guildId);
      const nick = guild?.members?.me?.nickname;
      const avatarSet = me?.displayAvatarURL?.() ? 'Set' : 'Default';

      const desc =
        `Change the bot's global identity (⚠️ username & avatar are **global** and rate-limited by Discord) or its nickname here.\n\n` +
        `**Username:** ${me?.username ?? '—'}\n` +
        `**Nickname (this server):** ${nick || '_none_'}\n` +
        `**Avatar:** ${avatarSet}\n\n` +
        `Use these controls carefully — Discord enforces strict limits on username & avatar changes.`;

      const rows = [
        new ActionRowBuilder().addComponents(
          btn('setup:modal:identity.name:1', 'Set Username', ButtonStyle.Primary, { emoji: '✏️' }),
          btn('setup:modal:identity.avatar:1', 'Set Avatar (URL)', ButtonStyle.Primary, { emoji: '🖼️' }),
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
  // MODULES (index 2)
  // -------------------------------------------------------------------------
  {
    id: 'modules',
    title: 'Modules',
    emoji: '🧩',
    render(cfg) {
      const m = cfg.modules || {};
      const desc =
        `Toggle whole feature modules on/off for this server.\n\n` +
        Object.entries(m)
          .map(([k, v]) => `**${k}:** ${on(v)}`)
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
  // LANGUAGE (index 3)
  // -------------------------------------------------------------------------
  {
    id: 'language',
    title: 'Language',
    emoji: '🌐',
    render(cfg) {
      const currentLang = LANG_LIST.find((l) => l.code === cfg.language)?.name || cfg.language;
      const desc =
        `Choose the server language.\n\n` +
        `Commands and dashboard default to **English**, but responses and embeds can be localized.\n\n` +
        `Current: **${currentLang}**`;

      const select = new StringSelectMenuBuilder()
        .setCustomId('setup:lang:3')
        .setPlaceholder('Select a language…')
        .addOptions(
          LANG_LIST.map((l) => ({
            label: l.name,
            value: l.code,
            default: l.code === cfg.language,
            description: l.rtl ? 'Right-to-left language' : undefined,
          })).slice(0, 25),
        );

      return { desc, rows: [new ActionRowBuilder().addComponents(select)] };
    },
  },

  // -------------------------------------------------------------------------
  // LEVELING & XP (index 4)
  // -------------------------------------------------------------------------
  {
    id: 'leveling',
    title: 'Leveling & XP',
    emoji: '📊',
    render(cfg) {
      const ar = cfg.settings.autoroles || {};
      const arList = Object.keys(ar).length
        ? Object.entries(ar)
            .map(([lvl, role]) => `• Level ${lvl} → <@&${role}>`)
            .join('\n')
        : '_none yet_';

      const desc =
        `XP curve: **50·L² + 100·L**, 60s cooldown.\n` +
        `Configure level-up announcements & auto-roles.\n\n` +
        `**Level-up channel:** ${chan(cfg.settings.levelUpChannel)}\n` +
        `**Auto-roles:**\n${arList}`;

      const rows = [
        chanSelect('levelUpChannel', 4, cfg.settings.levelUpChannel, 'Level-up announcement channel…'),
        new ActionRowBuilder().addComponents(
          btn('setup:modal:levelUpMessage:4', 'Edit Level-up Message', ButtonStyle.Secondary, { emoji: '💬' }),
          btn('setup:modal:__autorole:4', 'Add Auto-role', ButtonStyle.Primary, { emoji: '➕' }),
        ),
      ];

      const arEntries = Object.entries(ar);
      if (arEntries.length) {
        const del = new StringSelectMenuBuilder()
          .setCustomId('setup:ardel:4')
          .setPlaceholder('Remove an auto-role…')
          .addOptions(
            arEntries.slice(0, 25).map(([lvl, role]) => ({
              label: `Level ${lvl}`,
              value: lvl,
              description: `Deletes assignment mapping to: ${role}`,
            })),
          );
        rows.push(new ActionRowBuilder().addComponents(del));
      }

      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // AUTOMOD (index 5)
  // -------------------------------------------------------------------------
  {
    id: 'automod',
    title: 'Auto-Moderation',
    emoji: '🛡️',
    render(cfg) {
      const a = cfg.settings.automod || {};
      const desc =
        `Automated moderation settings.\n\n` +
        `**Invite blocking:** ${on(a.invites)}\n` +
        `**Spam (>5/3s):** ${on(a.spam)}\n` +
        `**Bad-word filter:** ${on(a.badwords)}\n` +
        `**Max mentions:** ${a.maxMentions || 5}\n` +
        `**Automod log:** ${chan(a.logChannel)}`;

      const rows = [
        new ActionRowBuilder().addComponents(
          btn(
            'setup:amtog:invites:5',
            'Invites',
            a.invites ? ButtonStyle.Success : ButtonStyle.Secondary,
            { emoji: a.invites ? '🟢' : '🔴' },
          ),
          btn(
            'setup:amtog:spam:5',
            'Spam',
            a.spam ? ButtonStyle.Success : ButtonStyle.Secondary,
            { emoji: a.spam ? '🟢' : '🔴' },
          ),
          btn(
            'setup:amtog:badwords:5',
            'Bad-words',
            a.badwords ? ButtonStyle.Success : ButtonStyle.Secondary,
            { emoji: a.badwords ? '🟢' : '🔴' },
          ),
          btn('setup:modal:automod.maxMentions:5', 'Max Mentions', ButtonStyle.Secondary, { emoji: '🔢' }),
        ),
        chanSelect('automod.logChannel', 5, cfg.settings.automod?.logChannel, 'Automod log channel…'),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // ECONOMY (index 6)
  // -------------------------------------------------------------------------
  {
    id: 'economy',
    title: 'Economy',
    emoji: '🪙',
    render(cfg) {
      const e = cfg.settings.economy || {};
      const desc =
        `Tune the internal economy ecosystem for this server.\n\n` +
        `**Currency:** ${cfg.settings.currencyEmoji || '🪙'} ${cfg.settings.currencyName || 'Credits'}\n` +
        `**Starting balance:** ${(e.startingBalance || 0).toLocaleString()}\n` +
        `**Daily amount:** ${(e.dailyAmount || 0).toLocaleString()}`;

      const rows = [
        new ActionRowBuilder().addComponents(
          btn('setup:modal:currencyName:6', 'Currency Name', ButtonStyle.Secondary, { emoji: '🏷️' }),
          btn('setup:modal:currencyEmoji:6', 'Currency Emoji', ButtonStyle.Secondary, { emoji: '😀' }),
        ),
        new ActionRowBuilder().addComponents(
          btn('setup:modal:economy.startingBalance:6', 'Starting Balance', ButtonStyle.Secondary, { emoji: '💰' }),
          btn('setup:modal:economy.dailyAmount:6', 'Daily Amount', ButtonStyle.Secondary, { emoji: '📅' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // WELCOME / GOODBYE (index 7)
  // -------------------------------------------------------------------------
  {
    id: 'welcome',
    title: 'Welcome & Goodbye',
    emoji: '👋',
    render(cfg) {
      const s = cfg.settings || {};
      const desc =
        `Greet new members and farewell leavers.\n` +
        `Placeholders: \`{user}\`, \`{server}\`.\n\n` +
        `**Welcome channel:** ${chan(s.welcomeChannel)}\n` +
        `> ${s.welcomeMessage || '*None text configured*'}\n\n` +
        `**Goodbye channel:** ${chan(s.goodbyeChannel)}\n` +
        `> ${s.goodbyeMessage || '*None text configured*'}`;

      const rows = [
        chanSelect('welcomeChannel', 7, s.welcomeChannel, 'Welcome channel…'),
        new ActionRowBuilder().addComponents(
          btn('setup:modal:welcomeMessage:7', 'Edit Welcome Msg', ButtonStyle.Secondary, { emoji: '💬' }),
          btn('setup:modal:goodbyeMessage:7', 'Edit Goodbye Msg', ButtonStyle.Secondary, { emoji: '💬' }),
        ),
        chanSelect('goodbyeChannel', 7, s.goodbyeChannel, 'Goodbye channel…'),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // ROLES (index 8)
  // -------------------------------------------------------------------------
  {
    id: 'roles',
    title: 'Roles',
    emoji: '🎭',
    render(cfg) {
      const s = cfg.settings || {};
      const desc =
        `Define administrative operational staff groups and instant-join permissions.\n\n` +
        `**Admin roles:** ${rolesStr(s.adminRoles)}\n` +
        `**Mod roles:** ${rolesStr(s.modRoles)}\n` +
        `**Join roles:** ${rolesStr(s.joinRoles)}`;

      const rows = [
        roleSelect('adminRoles', 8, s.adminRoles, 'Admin roles (Max 5)…', 5),
        roleSelect('modRoles', 8, s.modRoles, 'Mod roles (Max 5)…', 5),
        roleSelect('joinRoles', 8, s.joinRoles, 'Auto-join roles (Max 5)…', 5),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // LOGGING (index 9)
  // -------------------------------------------------------------------------
  {
    id: 'logging',
    title: 'Logging',
    emoji: '📜',
    render(cfg) {
      const desc =
        `Server audit logs and automation streaming channel.\n\n` +
        `**Log channel:** ${chan(cfg.settings.logChannel)}`;

      const rows = [chanSelect('logChannel', 9, cfg.settings.logChannel, 'Server log channel…')];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // SAFETY / PRIVACY (index 10)
  // -------------------------------------------------------------------------
  {
    id: 'safety',
    title: 'Safety & Privacy',
    emoji: '🧯',
    render(cfg) {
      const s = cfg.settings.safety || {};
      const desc =
        `High-level safety and privacy toggles.\n\n` +
        `**DM welcome messages:** ${on(s.dmWelcome)}\n` +
        `**Log deleted messages:** ${on(s.logDeletes)}\n` +
        `**Log edits:** ${on(s.logEdits)}\n` +
        `**Store message content:** ${on(s.storeContent)}\n\n` +
        `Use these options to align with your community's expectations and local regulations.`;

      const rows = [
        new ActionRowBuilder().addComponents(
          btn(
            'setup:safety:dmWelcome:10',
            'DM Welcome',
            s.dmWelcome ? ButtonStyle.Success : ButtonStyle.Secondary,
            { emoji: boolEmoji(s.dmWelcome) },
          ),
          btn(
            'setup:safety:logDeletes:10',
            'Log Deletes',
            s.logDeletes ? ButtonStyle.Success : ButtonStyle.Secondary,
            { emoji: boolEmoji(s.logDeletes) },
          ),
          btn(
            'setup:safety:logEdits:10',
            'Log Edits',
            s.logEdits ? ButtonStyle.Success : ButtonStyle.Secondary,
            { emoji: boolEmoji(s.logEdits) },
          ),
          btn(
            'setup:safety:storeContent:10',
            'Store Content',
            s.storeContent ? ButtonStyle.Danger : ButtonStyle.Secondary,
            { emoji: s.storeContent ? '⚠️' : '✅' },
          ),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // AI ASSISTANT CONFIG (index 11)
  // -------------------------------------------------------------------------
  {
    id: 'ai',
    title: 'AI Assistant',
    emoji: '🧠',
    render(cfg) {
      const ai = cfg.settings.ai || {};
      const desc =
        `Configure AI assistant behavior for this server.\n\n` +
        `**Enabled:** ${on(ai.enabled)}\n` +
        `**Default personality:** ${ai.personality || '_default_'}\n` +
        `**Max tokens per reply:** ${ai.maxTokens || 1024}\n` +
        `**Allow DMs:** ${on(ai.allowDMs)}\n` +
        `**Allow NSFW channels:** ${on(ai.allowNSFW)}\n\n` +
        `Keep AI usage aligned with your moderation and content policies.`;

      const rows = [
        new ActionRowBuilder().addComponents(
          btn(
            'setup:ai:enabled:11',
            'Toggle AI',
            ai.enabled ? ButtonStyle.Success : ButtonStyle.Secondary,
            { emoji: ai.enabled ? '🟢' : '🔴' },
          ),
          btn('setup:modal:ai.personality:11', 'Edit Personality', ButtonStyle.Secondary, { emoji: '🎨' }),
        ),
        new ActionRowBuilder().addComponents(
          btn('setup:modal:ai.maxTokens:11', 'Max Tokens', ButtonStyle.Secondary, { emoji: '🔢' }),
          btn(
            'setup:ai:allowDMs:11',
            'Allow DMs',
            ai.allowDMs ? ButtonStyle.Success : ButtonStyle.Secondary,
            { emoji: boolEmoji(ai.allowDMs) },
          ),
          btn(
            'setup:ai:allowNSFW:11',
            'Allow NSFW',
            ai.allowNSFW ? ButtonStyle.Danger : ButtonStyle.Secondary,
            { emoji: ai.allowNSFW ? '⚠️' : '✅' },
          ),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // COMMUNITY / SOCIAL (index 12)
  // -------------------------------------------------------------------------
  {
    id: 'community',
    title: 'Community & Social',
    emoji: '💬',
    render(cfg) {
      const s = cfg.settings.community || {};
      const desc =
        `Community engagement and social features.\n\n` +
        `**Suggestion channel:** ${chan(s.suggestionChannel)}\n` +
        `**Feedback channel:** ${chan(s.feedbackChannel)}\n` +
        `**Allow anonymous suggestions:** ${on(s.allowAnonymous)}\n` +
        `**Pinned rules message:** ${s.rulesMessageId ? `Message ID: \`${s.rulesMessageId}\`` : '_none_'}\n\n` +
        `Use these tools to keep feedback flowing and rules visible.`;

      const rows = [
        chanSelect('community.suggestionChannel', 12, s.suggestionChannel, 'Suggestion channel…'),
        chanSelect('community.feedbackChannel', 12, s.feedbackChannel, 'Feedback channel…'),
        new ActionRowBuilder().addComponents(
          btn(
            'setup:community:allowAnonymous:12',
            'Anonymous Suggestions',
            s.allowAnonymous ? ButtonStyle.Success : ButtonStyle.Secondary,
            { emoji: boolEmoji(s.allowAnonymous) },
          ),
          btn('setup:modal:community.rulesMessageId:12', 'Rules Message ID', ButtonStyle.Secondary, { emoji: '📌' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // DANGER ZONE (index 13)
  // -------------------------------------------------------------------------
  {
    id: 'danger',
    title: 'Danger Zone',
    emoji: '⚠️',
    render() {
      const desc =
        `⚠️ **Danger Zone** — reset **all configuration properties** for this server profile back to default template blocks.\n\n` +
        `This action cannot be reverted.\n\n` +
        `You will be asked to type \`RESET\` to confirm.`;

      const rows = [
        new ActionRowBuilder().addComponents(
          btn('setup:modal:__reset:13', 'Reset Everything', ButtonStyle.Danger, { emoji: '♻️' }),
        ),
      ];
      return { desc, rows };
    },
  },

  // -------------------------------------------------------------------------
  // TICKETS — creative studio (indices 14-18; rendered by ticketStudio.js).
  // Keep this order/position: the customIds in ticketStudio use these indices.
  // -------------------------------------------------------------------------
  { id: 'tickets', title: 'Tickets', emoji: '🎫', render: (cfg) => renderTicketMaster(cfg) },            // 14
  { id: 'ticket-panel', title: 'Ticket Panel', emoji: '🎨', render: (cfg) => renderTicketPanel(cfg) },     // 15
  { id: 'ticket-behavior', title: 'Ticket Behavior', emoji: '⚙️', render: (cfg) => renderTicketBehavior(cfg) }, // 16
  { id: 'ticket-dm', title: 'DM Tickets', emoji: '📨', render: (cfg) => renderTicketDM(cfg) },             // 17
  { id: 'ticket-extras', title: 'Ticket Extras', emoji: '🧰', render: (cfg) => renderTicketExtras(cfg) },  // 18
];

// ---------------------------------------------------------------------------
// NAVIGATION GENERATION
// ---------------------------------------------------------------------------
function jumpRow() {
  const select = new StringSelectMenuBuilder()
    .setCustomId('setup:jump')
    .setPlaceholder('Jump directly to configuration matrix page…')
    .addOptions(
      PAGES.slice(0, 25).map((p, i) => ({
        label: p.title,
        value: String(i),
        emoji: p.emoji,
      })),
    );
  return new ActionRowBuilder().addComponents(select);
}

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

// ---------------------------------------------------------------------------
// MAIN RENDER ENGINE
// ---------------------------------------------------------------------------
export function renderPanel(client, guildId, page = 0) {
  const N = PAGES.length;
  const idx = ((page % N) + N) % N;
  const cfg = getCfg(guildId);
  const currentDef = PAGES[idx];

  const { desc, rows } = currentDef.render(cfg, client, idx);
  const embed = new EmbedBuilder()
    .setColor(ACCENT)
    .setAuthor({
      name: `${client.user.username} • Setup Panel Terminal`,
      iconURL: client.user.displayAvatarURL?.(),
    })
    .setTitle(`${currentDef.emoji} ${currentDef.title}`)
    .setDescription(desc)
    .setFooter({
      text: `Page ${idx + 1} of ${N} — use arrow navigations below`,
    });

  // Discord strictly rejects messages exceeding 5 total ActionRows.
  // We attach:
  //  - jumpRow (1)
  //  - navRow (1)
  //  - up to 3 custom rows from the page definition.
  const components = [jumpRow(), navRow(idx), ...rows.slice(0, 3)];

  return { embeds: [embed], components };
}
