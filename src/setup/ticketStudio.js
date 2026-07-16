// Ticket "creative studio" — the /setup pages that design & deploy the ticket
// system, plus the component/modal handlers behind them. Kept out of ui.js /
// interactions.js so the ticket feature stays self-contained.
//
// These five pages are appended to PAGES in ui.js at fixed indices; the trailing
// number in every customId here is the page to re-render and MUST match.
import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType,
  StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags,
} from 'discord.js';
import { getCfg, setNested } from './store.js';
import { renderPanel } from './ui.js';
import { buildPanelMessage, deployPanel } from '../features/tickets.js';

export const TP = { MASTER: 14, PANEL: 15, BEHAVIOR: 16, DM: 17, EXTRAS: 18 };

const eph = (content) => ({ content, flags: MessageFlags.Ephemeral });
const yn = (v) => (v ? '✅ On' : '❌ Off');
const chanStr = (id) => (id ? `<#${id}>` : '_none_');
const roleStr = (id) => (id ? `<@&${id}>` : '_none_');

const THEMES = [
  { value: 'blurple', label: 'Blurple (default)', color: '#5865F2', emoji: '🎫', style: 'Primary' },
  { value: 'emerald', label: 'Emerald', color: '#2ecc71', emoji: '🟢', style: 'Success' },
  { value: 'crimson', label: 'Crimson', color: '#e74c3c', emoji: '🔴', style: 'Danger' },
  { value: 'midnight', label: 'Midnight', color: '#2c2f33', emoji: '🌙', style: 'Secondary' },
  { value: 'sunset', label: 'Sunset', color: '#e67e22', emoji: '🌅', style: 'Primary' },
  { value: 'candy', label: 'Candy Pink', color: '#ff6ac1', emoji: '🍬', style: 'Primary' },
];

/* ------------------------------------------------------------- tiny builders */

function btn(id, label, style = ButtonStyle.Secondary, emoji) {
  const b = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
  if (emoji) { try { b.setEmoji(emoji); } catch { /* skip */ } }
  return b;
}

function chanSelectRow(key, page, currentId, placeholder, types = [ChannelType.GuildText]) {
  const m = new ChannelSelectMenuBuilder()
    .setCustomId(`setup:tk:chan:${key}:${page}`)
    .setPlaceholder(placeholder)
    .setChannelTypes(...types)
    .setMinValues(0)
    .setMaxValues(1);
  if (currentId) { try { m.setDefaultChannels(currentId); } catch { /* older djs */ } }
  return new ActionRowBuilder().addComponents(m);
}

function roleSelectRow(key, page, currentId, placeholder) {
  const m = new RoleSelectMenuBuilder()
    .setCustomId(`setup:tk:role:${key}:${page}`)
    .setPlaceholder(placeholder)
    .setMinValues(0)
    .setMaxValues(1);
  if (currentId) { try { m.setDefaultRoles(currentId); } catch { /* older djs */ } }
  return new ActionRowBuilder().addComponents(m);
}

/* ---------------------------------------------------------------- PAGE 14 */

export function renderTicketMaster(cfg) {
  const t = cfg.settings.tickets;
  const modeLabel = { channel: '📂 Channel', dm: '📨 DM', both: '📂+📨 Both' }[t.mode] || t.mode;
  const desc =
    `**Ticket System — Control Center**\n\n` +
    `**Status:** ${t.enabled ? '🟢 Enabled' : '🔴 Disabled'}\n` +
    `**Mode:** ${modeLabel}\n` +
    `**Panel channel:** ${chanStr(t.panelChannelId)}\n` +
    `**New tickets open under:** ${t.categoryId ? `<#${t.categoryId}>` : '_no category (top level)_'}\n` +
    `**Welcome-DM opener:** ${yn(t.welcomeDM)}\n\n` +
    `Design the panel on **Ticket Panel ▶**, tune behavior on **Ticket Behavior ▶**, ` +
    `then hit **Deploy** to post it. Use the arrows/dropdown to move between ticket pages.`;

  const rows = [
    new ActionRowBuilder().addComponents(
      btn(`setup:tk:toggle:${TP.MASTER}`, t.enabled ? 'Disable' : 'Enable', t.enabled ? ButtonStyle.Danger : ButtonStyle.Success, t.enabled ? '🔴' : '🟢'),
      btn(`setup:tk:mode:${TP.MASTER}`, `Mode: ${t.mode}`, ButtonStyle.Primary, '🔀'),
      btn(`setup:tk:deploy:${TP.MASTER}`, 'Deploy Panel', ButtonStyle.Success, '🚀'),
      btn(`setup:tk:preview:${TP.MASTER}`, 'Preview', ButtonStyle.Secondary, '👁️'),
      btn(`setup:tk:feat:welcomeDM:${TP.MASTER}`, `Welcome-DM: ${t.welcomeDM ? 'On' : 'Off'}`, ButtonStyle.Secondary, '📩'),
    ),
    chanSelectRow('panelChannelId', TP.MASTER, t.panelChannelId, 'Channel to post the ticket panel in…'),
    chanSelectRow('categoryId', TP.MASTER, t.categoryId, 'Category new ticket channels open under…', [ChannelType.GuildCategory]),
  ];
  return { desc, rows };
}

/* ---------------------------------------------------------------- PAGE 15 */

export function renderTicketPanel(cfg) {
  const t = cfg.settings.tickets;
  const desc =
    `**Ticket Panel — Design Studio 🎨**\n\n` +
    `**Title:** ${t.title || '_none_'}\n` +
    `**Subtitle:** ${t.subtitle || '_none_'}\n` +
    `**Description:** ${(t.description || '_none_').slice(0, 120)}\n` +
    `**Color:** \`${t.color}\`  ·  **Footer:** ${t.footer || '_none_'}\n` +
    `**Image:** ${t.image ? '✅ set' : '_none_'}  ·  **Thumbnail:** ${t.thumbnail ? '✅ set' : '_none_'}\n` +
    `**Opener component:** ${t.component === 'menu' ? '📋 Select menu' : '🔘 Button'}\n` +
    (t.component === 'menu'
      ? `**Menu options:** ${t.menuOptions}\n`
      : `**Button:** ${t.buttonEmoji || ''} ${t.buttonLabel} _(${t.buttonStyle})_\n`) +
    `\nUse **Edit Text** / **Edit Style** for the wording & look, flip the component type, ` +
    `or apply a **theme preset** below.`;

  const rows = [
    new ActionRowBuilder().addComponents(
      btn(`setup:tk:editText:${TP.PANEL}`, 'Edit Text', ButtonStyle.Primary, '📝'),
      btn(`setup:tk:editStyle:${TP.PANEL}`, 'Edit Style', ButtonStyle.Primary, '🎨'),
      btn(`setup:tk:component:${TP.PANEL}`, `Type: ${t.component === 'menu' ? 'Menu' : 'Button'}`, ButtonStyle.Secondary, '🔁'),
      btn(`setup:tk:editMenu:${TP.PANEL}`, 'Menu Options', ButtonStyle.Secondary, '📋'),
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`setup:tk:theme:${TP.PANEL}`)
        .setPlaceholder('Apply a theme preset (color + emoji + style)…')
        .addOptions(THEMES.map((th) => ({ label: th.label, value: th.value, emoji: th.emoji }))),
    ),
  ];
  return { desc, rows };
}

/* ---------------------------------------------------------------- PAGE 16 */

export function renderTicketBehavior(cfg) {
  const t = cfg.settings.tickets;
  const desc =
    `**Ticket Behavior & Roles ⚙️**\n\n` +
    `**Staff role:** ${roleStr(t.staffRoleId)}\n` +
    `**Channel naming:** \`${t.naming}\`\n` +
    `**Auto-close:** ${t.autoCloseMinutes > 0 ? `${t.autoCloseMinutes} min` : 'off'}  ·  ` +
    `**Cooldown:** ${t.cooldownSeconds}s  ·  **Max open/user:** ${t.maxOpen}\n` +
    `**Ping staff on open:** ${yn(t.pingStaff)}  ·  **Require reason:** ${yn(t.requireReason)}  ·  **Priority buttons:** ${yn(t.priority)}\n\n` +
    `**Opened-ticket buttons:** ` +
    `Close ${t.btnClose ? '✅' : '❌'} · Claim ${t.btnClaim ? '✅' : '❌'} · Lock ${t.btnLock ? '✅' : '❌'} · ` +
    `Transcript ${t.btnTranscript ? '✅' : '❌'} · Feedback ${t.feedback ? '✅' : '❌'}`;

  const rows = [
    roleSelectRow('staffRoleId', TP.BEHAVIOR, t.staffRoleId, 'Staff role (sees & claims tickets)…'),
    new ActionRowBuilder().addComponents(
      btn(`setup:tk:editBehavior:${TP.BEHAVIOR}`, 'Edit Behavior', ButtonStyle.Primary, '⚙️'),
      btn(`setup:tk:autoclose:${TP.BEHAVIOR}`, `Auto-close: ${t.autoCloseMinutes > 0 ? `${t.autoCloseMinutes}m` : 'off'}`, ButtonStyle.Secondary, '⏱️'),
      btn(`setup:tk:feat:pingStaff:${TP.BEHAVIOR}`, `Ping: ${t.pingStaff ? 'On' : 'Off'}`, t.pingStaff ? ButtonStyle.Success : ButtonStyle.Secondary, '📣'),
      btn(`setup:tk:feat:requireReason:${TP.BEHAVIOR}`, `Reason: ${t.requireReason ? 'On' : 'Off'}`, t.requireReason ? ButtonStyle.Success : ButtonStyle.Secondary, '❓'),
      btn(`setup:tk:feat:priority:${TP.BEHAVIOR}`, `Priority: ${t.priority ? 'On' : 'Off'}`, t.priority ? ButtonStyle.Success : ButtonStyle.Secondary, '🚦'),
    ),
    new ActionRowBuilder().addComponents(
      btn(`setup:tk:feat:btnClose:${TP.BEHAVIOR}`, 'Close', t.btnClose ? ButtonStyle.Success : ButtonStyle.Secondary, '🔒'),
      btn(`setup:tk:feat:btnClaim:${TP.BEHAVIOR}`, 'Claim', t.btnClaim ? ButtonStyle.Success : ButtonStyle.Secondary, '🙋'),
      btn(`setup:tk:feat:btnLock:${TP.BEHAVIOR}`, 'Lock', t.btnLock ? ButtonStyle.Success : ButtonStyle.Secondary, '🔐'),
      btn(`setup:tk:feat:btnTranscript:${TP.BEHAVIOR}`, 'Transcript', t.btnTranscript ? ButtonStyle.Success : ButtonStyle.Secondary, '📄'),
      btn(`setup:tk:feat:feedback:${TP.BEHAVIOR}`, 'Feedback', t.feedback ? ButtonStyle.Success : ButtonStyle.Secondary, '⭐'),
    ),
  ];
  return { desc, rows };
}

/* ---------------------------------------------------------------- PAGE 17 */

export function renderTicketDM(cfg) {
  const t = cfg.settings.tickets;
  const dmOn = t.mode === 'dm' || t.mode === 'both';
  const desc =
    `**DM Tickets (Modmail) 📨**\n\n` +
    (dmOn ? '' : `⚠️ DM tickets are only active when **Mode** is \`dm\` or \`both\` (set it on the Control Center).\n\n`) +
    `Members DM the bot to open a private thread with staff; staff reply in the thread and it relays back to the member's DMs.\n\n` +
    `**Staff relay channel:** ${chanStr(t.dmStaffChannelId)} _(threads are created here)_\n` +
    `**Open command:** \`${t.dmCommand} <message>\`\n` +
    `**Close command:** \`${t.dmCloseCommand}\`\n` +
    `**Acknowledge reaction:** ${t.dmAck}\n` +
    `**Auto-reply to opener:** ${t.dmReply.slice(0, 120)}`;

  const rows = [
    chanSelectRow('dmStaffChannelId', TP.DM, t.dmStaffChannelId, 'Channel where DM-ticket threads are created…'),
    new ActionRowBuilder().addComponents(
      btn(`setup:tk:editDM:${TP.DM}`, 'Edit DM Text & Commands', ButtonStyle.Primary, '✉️'),
    ),
  ];
  return { desc, rows };
}

/* ---------------------------------------------------------------- PAGE 18 */

export function renderTicketExtras(cfg) {
  const t = cfg.settings.tickets;
  const desc =
    `**Ticket Logs & Extras 🧰**\n\n` +
    `**Transcript archive:** ${chanStr(t.transcriptChannelId)} _(closed tickets saved here)_\n` +
    `**Event log:** ${chanStr(t.logChannelId)} _(open/close/claim events)_\n` +
    `**Blacklist role:** ${roleStr(t.blacklistRoleId)} _(these members can't open tickets)_\n\n` +
    `That's the full studio — mix and match freely. Nothing here is required; leave a ` +
    `field blank to disable that feature.`;

  const rows = [
    chanSelectRow('transcriptChannelId', TP.EXTRAS, t.transcriptChannelId, 'Transcript archive channel…'),
    chanSelectRow('logChannelId', TP.EXTRAS, t.logChannelId, 'Ticket event-log channel…'),
    roleSelectRow('blacklistRoleId', TP.EXTRAS, t.blacklistRoleId, 'Blacklist role (blocked from tickets)…'),
  ];
  return { desc, rows };
}

/* ============================================================ MODAL BUILDERS */

function input(id, label, value, { style = TextInputStyle.Short, max = 200, required = false } = {}) {
  const ti = new TextInputBuilder().setCustomId(id).setLabel(label.slice(0, 45)).setStyle(style).setMaxLength(max).setRequired(required);
  if (value) ti.setValue(String(value).slice(0, max));
  return new ActionRowBuilder().addComponents(ti);
}

function buildTicketModal(kind, page, t) {
  const m = new ModalBuilder();
  if (kind === 'editText') {
    m.setCustomId(`setup:msub:tk_text:${page}`).setTitle('Panel Text').addComponents(
      input('title', 'Title', t.title, { max: 256 }),
      input('subtitle', 'Subtitle (bold line)', t.subtitle),
      input('description', 'Description', t.description, { style: TextInputStyle.Paragraph, max: 2000 }),
      input('footer', 'Footer', t.footer),
      input('image', 'Large image URL', t.image, { max: 500 }),
    );
  } else if (kind === 'editStyle') {
    m.setCustomId(`setup:msub:tk_style:${page}`).setTitle('Panel Style').addComponents(
      input('color', 'Embed color (hex, e.g. #5865F2)', t.color, { max: 7 }),
      input('buttonLabel', 'Button label', t.buttonLabel, { max: 80 }),
      input('buttonEmoji', 'Button emoji', t.buttonEmoji, { max: 32 }),
      input('buttonStyle', 'Button style (Primary/Secondary/Success/Danger)', t.buttonStyle, { max: 12 }),
      input('thumbnail', 'Thumbnail URL', t.thumbnail, { max: 500 }),
    );
  } else if (kind === 'editMenu') {
    m.setCustomId(`setup:msub:tk_menu:${page}`).setTitle('Menu Options').addComponents(
      input('menuPlaceholder', 'Menu placeholder', t.menuPlaceholder, { max: 150 }),
      input('menuOptions', 'Options (comma-separated, max 25)', t.menuOptions, { style: TextInputStyle.Paragraph, max: 1000 }),
    );
  } else if (kind === 'editBehavior') {
    m.setCustomId(`setup:msub:tk_behavior:${page}`).setTitle('Ticket Behavior').addComponents(
      input('openMessage', 'Opening message ({user}, {staff}, {num})', t.openMessage, { style: TextInputStyle.Paragraph, max: 2000 }),
      input('naming', 'Channel naming ({num}, {username})', t.naming, { max: 90 }),
      input('cooldownSeconds', 'Cooldown between tickets (seconds)', t.cooldownSeconds, { max: 6 }),
      input('maxOpen', 'Max open tickets per user', t.maxOpen, { max: 3 }),
    );
  } else if (kind === 'editDM') {
    m.setCustomId(`setup:msub:tk_dm:${page}`).setTitle('DM Ticket Settings').addComponents(
      input('dmCommand', 'Open command', t.dmCommand, { max: 32 }),
      input('dmCloseCommand', 'Close command', t.dmCloseCommand, { max: 32 }),
      input('dmAck', 'Acknowledge reaction (emoji)', t.dmAck, { max: 32 }),
      input('dmReply', 'Auto-reply to the opener', t.dmReply, { style: TextInputStyle.Paragraph, max: 1000 }),
    );
  }
  return m;
}

/* ============================================================ ACTION HANDLER */

// Handle a `setup:tk:*` component interaction. Returns true if handled.
export async function handleTicketAction(interaction, segments) {
  const guildId = interaction.guildId;
  const client = interaction.client;
  const sub = segments[2];
  const t = () => getCfg(guildId).settings.tickets;

  const rerender = (page) => interaction.update(renderPanel(client, guildId, Number(page)));

  switch (sub) {
    case 'toggle': {
      setNested(guildId, 'tickets', 'enabled', !t().enabled);
      await rerender(segments[3]);
      return true;
    }
    case 'mode': {
      const order = ['channel', 'dm', 'both'];
      const next = order[(order.indexOf(t().mode) + 1) % order.length];
      setNested(guildId, 'tickets', 'mode', next);
      await rerender(segments[3]);
      return true;
    }
    case 'component': {
      setNested(guildId, 'tickets', 'component', t().component === 'menu' ? 'button' : 'menu');
      await rerender(segments[3]);
      return true;
    }
    case 'autoclose': {
      const steps = [0, 5, 15, 30, 60, 120, 720];
      const next = steps[(steps.indexOf(t().autoCloseMinutes) + 1) % steps.length];
      setNested(guildId, 'tickets', 'autoCloseMinutes', next);
      await rerender(segments[3]);
      return true;
    }
    case 'feat': {
      const key = segments[3];
      setNested(guildId, 'tickets', key, !t()[key]);
      await rerender(segments[4]);
      return true;
    }
    case 'chan': {
      setNested(guildId, 'tickets', segments[3], interaction.values[0] || '');
      await rerender(segments[4]);
      return true;
    }
    case 'role': {
      setNested(guildId, 'tickets', segments[3], interaction.values[0] || '');
      await rerender(segments[4]);
      return true;
    }
    case 'theme': {
      const th = THEMES.find((x) => x.value === interaction.values[0]);
      if (th) {
        setNested(guildId, 'tickets', 'color', th.color);
        setNested(guildId, 'tickets', 'buttonEmoji', th.emoji);
        setNested(guildId, 'tickets', 'buttonStyle', th.style);
      }
      await rerender(segments[3]);
      return true;
    }
    case 'preview': {
      const msg = buildPanelMessage(getCfg(guildId).settings, interaction.guild);
      await interaction.reply({ content: '👁️ **Live preview** (buttons inert here):', embeds: msg.embeds, flags: MessageFlags.Ephemeral });
      return true;
    }
    case 'deploy': {
      const res = await deployPanel(interaction.guild, getCfg(guildId).settings);
      await interaction.reply(eph(res.ok ? `🚀 Panel deployed → ${res.channel} ${res.url}` : `❌ ${res.error}`));
      return true;
    }
    case 'editText': case 'editStyle': case 'editMenu': case 'editBehavior': case 'editDM': {
      await interaction.showModal(buildTicketModal(sub, segments[3], t()));
      return true;
    }
    default:
      return false;
  }
}

// Handle a `setup:msub:tk_*` modal submit. Returns true if handled.
export async function handleTicketModalSubmit(interaction, targetKey, page) {
  const guildId = interaction.guildId;
  const val = (id) => { try { return interaction.fields.getTextInputValue(id); } catch { return undefined; } };
  const put = (key, v) => { if (v !== undefined) setNested(guildId, 'tickets', key, v); };
  const putInt = (key, v) => { if (v !== undefined) setNested(guildId, 'tickets', key, Math.max(0, parseInt(String(v).replace(/[^0-9]/g, ''), 10) || 0)); };

  if (targetKey === 'tk_text') {
    put('title', val('title')); put('subtitle', val('subtitle')); put('description', val('description'));
    put('footer', val('footer')); put('image', val('image'));
  } else if (targetKey === 'tk_style') {
    const color = val('color'); if (color !== undefined) put('color', /^#?[0-9a-fA-F]{6}$/.test(color.trim()) ? (color.trim().startsWith('#') ? color.trim() : `#${color.trim()}`) : '#5865F2');
    put('buttonLabel', val('buttonLabel')); put('buttonEmoji', val('buttonEmoji'));
    const style = val('buttonStyle');
    if (style !== undefined) {
      const norm = { primary: 'Primary', secondary: 'Secondary', success: 'Success', danger: 'Danger' }[style.trim().toLowerCase()] || 'Primary';
      put('buttonStyle', norm);
    }
    put('thumbnail', val('thumbnail'));
  } else if (targetKey === 'tk_menu') {
    put('menuPlaceholder', val('menuPlaceholder')); put('menuOptions', val('menuOptions'));
  } else if (targetKey === 'tk_behavior') {
    put('openMessage', val('openMessage')); put('naming', val('naming'));
    putInt('cooldownSeconds', val('cooldownSeconds')); putInt('maxOpen', val('maxOpen'));
  } else if (targetKey === 'tk_dm') {
    put('dmCommand', val('dmCommand')); put('dmCloseCommand', val('dmCloseCommand'));
    put('dmAck', val('dmAck')); put('dmReply', val('dmReply'));
  } else {
    return false;
  }

  await interaction.update(renderPanel(interaction.client, guildId, Number(page) || TP.MASTER));
  return true;
}
