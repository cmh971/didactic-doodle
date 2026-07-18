// Ticket system — "creative studio" edition, hardened to be practically invincible.
//
// Design rule in this file: NOTHING may throw uncaught. Every external call
// (Discord API, SQLite, config reads) is wrapped, every user-facing field is
// clamped to Discord's limits, and every interaction is answered exactly once
// through a safe responder — so a bad config, a deleted channel, a missing
// permission, an expired interaction, or a dead database can never crash the bot
// or leave a user staring at a spinning button.
//
// Two ticket flows, both configured entirely from /setup ▸ Tickets:
//   • CHANNEL tickets — a deployed panel (button OR select menu) opens a private
//     channel with a configurable opening message and control buttons.
//   • DM tickets (modmail) — a member DMs the bot; the bot opens a private thread
//     in a staff channel and relays messages both ways.
//
// All customIds here use the `ticket:` prefix so index.js routes them to
// handleTicketButton (components) / handleTicketModal (modal submits).
import {
  ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  AttachmentBuilder, MessageFlags,
} from 'discord.js';
import { getCfg, setNested } from '../setup/store.js';
import { getDb } from '../db/index.js';

const eph = (content) => ({ content: clamp(content, 2000), flags: MessageFlags.Ephemeral });

// Animated "loading" emoji shown while a ticket is closing (id 1527074270281470093).
// Renders wherever the bot shares a server that has this emoji available.
const LOADING = '<a:loading:1527074270281470093>';

// Last-resort defaults so the whole feature still works if config is unreadable.
const SAFE_TICKETS = {
  enabled: false, mode: 'channel', title: '🎫 Support Tickets', subtitle: '',
  description: 'Open a ticket to get help.', color: '#5865F2', image: '', thumbnail: '',
  footer: '', component: 'button', buttonLabel: 'Create Ticket', buttonEmoji: '🎫',
  buttonStyle: 'Primary', menuPlaceholder: 'Select a ticket type…', menuOptions: 'General Support',
  panelChannelId: '', categoryId: '', staffRoleId: '', openMessage: 'Hi {user}, staff will help you shortly.',
  naming: 'ticket-{num}', autoCloseMinutes: 0, cooldownSeconds: 0, maxOpen: 1,
  btnClose: true, btnClaim: true, btnLock: false, btnTranscript: true,
  pingStaff: true, requireReason: false, transcriptChannelId: '', logChannelId: '',
  feedback: false, welcomeDM: false, blacklistRoleId: '', priority: false,
  dmCommand: '!ticket', dmCloseCommand: '!close', dmStaffChannelId: '', dmAck: '✅',
  dmReply: 'Thanks! Your message was sent to our staff team.', counter: 0,
  categoryRoles: {}, // { "<menu option label>": roleId } — pinged instead of staffRoleId
};

/* ============================================================ SAFETY HELPERS */

// Never throw: clamp any value to a string within Discord's field limit.
function clamp(v, max) {
  const s = v == null ? '' : String(v);
  return s.length > max ? s.slice(0, max) : s;
}

// Only http(s) URLs are valid embed media; anything else is dropped silently.
function safeUrl(v) {
  const s = String(v || '').trim();
  return /^https?:\/\/\S+$/i.test(s) ? s : null;
}

// Read a guild's ticket config, tolerating a missing/corrupt store.
function tk(guildId) {
  try {
    const t = getCfg(guildId)?.settings?.tickets;
    return t && typeof t === 'object' ? { ...SAFE_TICKETS, ...t } : { ...SAFE_TICKETS };
  } catch {
    return { ...SAFE_TICKETS };
  }
}

// Answer an interaction exactly once, trying every viable path, swallowing the
// "already acknowledged / unknown interaction" errors that would otherwise bubble.
async function safeRespond(interaction, payload) {
  try {
    if (interaction.deferred) return await interaction.editReply(payload);
    if (interaction.replied) return await interaction.followUp(payload);
    return await interaction.reply(payload);
  } catch {
    try { return await interaction.followUp(payload); } catch { /* give up quietly */ }
  }
}

async function safeUpdate(interaction, payload) {
  try {
    if (!interaction.replied && !interaction.deferred) return await interaction.update(payload);
  } catch { /* fall through to a fresh ephemeral note */ }
  return safeRespond(interaction, { ...payload, flags: MessageFlags.Ephemeral });
}

const ignore = () => {};

/* ------------------------------------------------------------------ storage */

// SQLite is preferred; if it can't be opened or a query fails, we transparently
// fall back to an in-memory map so DM tickets keep working for the session.
const memStore = new Map(); // user_id -> row
let dbInsert, dbByUser, dbByThread, dbDelete;
let dbOk = false;

try {
  const db = getDb();
  db.exec(`
CREATE TABLE IF NOT EXISTS dm_tickets (
  user_id    TEXT PRIMARY KEY,
  guild_id   TEXT NOT NULL,
  thread_id  TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  opened_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dm_thread ON dm_tickets(thread_id);
`);
  const insert = db.prepare('INSERT OR REPLACE INTO dm_tickets (user_id, guild_id, thread_id, channel_id, opened_at) VALUES (?, ?, ?, ?, ?)');
  const byUser = db.prepare('SELECT * FROM dm_tickets WHERE user_id = ?');
  const byThread = db.prepare('SELECT * FROM dm_tickets WHERE thread_id = ?');
  const del = db.prepare('DELETE FROM dm_tickets WHERE user_id = ?');
  dbInsert = (...a) => insert.run(...a);
  dbByUser = (id) => byUser.get(id);
  dbByThread = (id) => byThread.get(id);
  dbDelete = (id) => del.run(id);
  dbOk = true;
} catch (err) {
  console.error('⚠️ Ticket DB unavailable — DM tickets fall back to in-memory storage:', err?.message);
}

// Unified store API: uses SQLite when healthy, else the in-memory map. Every call
// is wrapped so a mid-flight DB failure downgrades to memory instead of throwing.
const store = {
  put(row) {
    if (dbOk) { try { dbInsert(row.user_id, row.guild_id, row.thread_id, row.channel_id, row.opened_at); return; } catch { dbOk = false; } }
    memStore.set(row.user_id, row);
  },
  byUser(id) {
    if (dbOk) { try { return dbByUser(id); } catch { dbOk = false; } }
    return memStore.get(id) || null;
  },
  byThread(threadId) {
    if (dbOk) { try { return dbByThread(threadId); } catch { dbOk = false; } }
    for (const r of memStore.values()) if (r.thread_id === threadId) return r;
    return null;
  },
  del(id) {
    if (dbOk) { try { dbDelete(id); } catch { dbOk = false; } }
    memStore.delete(id);
  },
};

// In-memory rolling state (fine to lose on restart).
const autoCloseTimers = new Map(); // channelId -> timeout
const openCooldown = new Map();    // `${guild}:${user}` -> timestamp

/* ------------------------------------------------------------------ helpers */

const STYLE = { Primary: ButtonStyle.Primary, Secondary: ButtonStyle.Secondary, Success: ButtonStyle.Success, Danger: ButtonStyle.Danger };

function parseColor(input) {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  const hex = String(input || '').trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return parseInt(hex, 16);
  return 0x5865f2;
}

// A Discord-legal channel slug from the naming template; always yields something.
function ticketChannelName(cfg, member, num) {
  const uname = member?.user?.username || 'user';
  const name = String(cfg.naming || 'ticket-{num}')
    .replaceAll('{num}', String(num))
    .replaceAll('{username}', uname)
    .replaceAll('{user}', uname)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
  return name || `ticket-${num}`;
}

function botMention(guild) {
  const me = guild?.members?.me;
  return me ? `<@${me.id}>` : '@the bot';
}

function nextNumber(guildId) {
  try {
    const cur = Number(tk(guildId).counter) || 0;
    const num = cur + 1;
    setNested(guildId, 'tickets', 'counter', num);
    return num;
  } catch {
    // If the counter can't be persisted, fall back to a time-based unique-ish id.
    return Math.floor(Date.now() / 1000) % 100000;
  }
}

// Does the bot hold the perms it needs to run tickets in this guild?
function botCan(guild, ...perms) {
  try { return guild.members.me?.permissions?.has(perms) ?? false; } catch { return false; }
}

/* ============================================================ PANEL BUILDING */

// Build the deployable panel message ({ embeds, components }). Bad fields are
// dropped rather than throwing; the result is always a valid, sendable payload.
export function buildPanelMessage(cfg, guild) {
  let t;
  try { t = { ...SAFE_TICKETS, ...(cfg?.tickets || cfg || {}) }; } catch { t = { ...SAFE_TICKETS }; }

  const embed = new EmbedBuilder().setColor(parseColor(t.color)).setTitle(clamp(t.title || '🎫 Support Tickets', 256));

  let desc = clamp(t.description || '', 3500);
  if (t.subtitle) desc = clamp(`**${clamp(t.subtitle, 200)}**\n\n${desc}`, 3800);
  if (t.mode === 'dm' || t.mode === 'both') {
    desc = clamp(`${desc}\n\n📨 **Prefer DMs?** Just DM ${botMention(guild)} with \`${clamp(t.dmCommand || '!ticket', 40)} your message\` and we'll open a private ticket for you.`, 4096);
  }
  embed.setDescription(desc || 'Open a ticket to get help.');

  const img = safeUrl(t.image); if (img) { try { embed.setImage(img); } catch { ignore(); } }
  const thumb = safeUrl(t.thumbnail); if (thumb) { try { embed.setThumbnail(thumb); } catch { ignore(); } }
  if (t.footer) { try { embed.setFooter({ text: clamp(t.footer, 2048) }); } catch { ignore(); } }

  const components = [];
  if (t.mode !== 'dm') {
    try {
      if (t.component === 'menu') {
        const opts = String(t.menuOptions || 'General Support')
          .split(',').map((s) => s.trim()).filter(Boolean).slice(0, 25)
          .map((label, i) => ({ label: clamp(label, 100), value: `opt_${i}`, description: clamp(`Open a "${label}" ticket`, 100) }));
        if (opts.length) {
          components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('ticket:menu').setPlaceholder(clamp(t.menuPlaceholder || 'Select a ticket type…', 150)).addOptions(opts),
          ));
        }
      }
      // Always guarantee at least one working opener: if the menu produced no rows,
      // fall back to a button so a saved-but-empty menu never ships a dead panel.
      if (!components.length) {
        const b = new ButtonBuilder().setCustomId('ticket:create').setLabel(clamp(t.buttonLabel || 'Create Ticket', 80)).setStyle(STYLE[t.buttonStyle] || ButtonStyle.Primary);
        if (t.buttonEmoji) { try { b.setEmoji(t.buttonEmoji); } catch { ignore(); } }
        components.push(new ActionRowBuilder().addComponents(b));
      }
    } catch {
      // Absolute fallback: a bare Create Ticket button.
      components.length = 0;
      components.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket:create').setLabel('Create Ticket').setStyle(ButtonStyle.Primary),
      ));
    }
  }
  return { embeds: [embed], components };
}

// Deploy the panel to the configured (or given) channel. Never throws.
export async function deployPanel(guild, settings, channelId) {
  try {
    const t = settings?.tickets || SAFE_TICKETS;
    const id = channelId || t.panelChannelId;
    const channel = id && guild.channels.cache.get(id);
    if (!channel?.isTextBased?.()) return { ok: false, error: 'No valid panel channel is set. Pick one on the Tickets page first.' };
    if (!channel.permissionsFor?.(guild.members.me)?.has(PermissionFlagsBits.SendMessages)) {
      return { ok: false, error: `I can't send messages in ${channel}. Grant me **Send Messages** there and try again.` };
    }
    const msg = await channel.send(buildPanelMessage(settings, guild));
    return { ok: true, channel, url: msg.url };
  } catch (err) {
    return { ok: false, error: err?.message || 'Unknown error while deploying.' };
  }
}

/* ====================================================== CHANNEL-TICKET FLOW */

export async function handleTicketButton(interaction) {
  try {
    const id = interaction.customId || '';
    const [, action, ...rest] = id.split(':');

    if (interaction.isStringSelectMenu?.() && action === 'menu') {
      const t = tk(interaction.guildId);
      const opts = String(t.menuOptions || '').split(',').map((s) => s.trim()).filter(Boolean);
      const idx = Number((interaction.values?.[0] || 'opt_0').replace('opt_', '')) || 0;
      return startTicket(interaction, opts[idx] || 'General Support');
    }
    if (interaction.isButton?.()) {
      switch (action) {
        case 'create':     return startTicket(interaction, null);
        case 'close':      return closeTicket(interaction);
        case 'claim':      return claimTicket(interaction);
        case 'lock':       return lockTicket(interaction);
        case 'transcript': return sendTranscript(interaction, interaction.channel, false);
        case 'keep':       return keepOpen(interaction);
        case 'prio':       return setPriority(interaction, rest[0]);
        case 'rate':       return recordFeedback(interaction, rest[0]);
        default:           return false;
      }
    }
    return false;
  } catch (err) {
    console.error('ticket button error:', err?.message);
    await safeRespond(interaction, eph('⚠️ Something went wrong with that ticket action. Please try again.'));
    return true;
  }
}

// Ticket-flow modal submits (require-reason). Routed from index.js.
export async function handleTicketModal(interaction) {
  try {
    if (interaction.customId === 'ticket:reasonmodal') {
      let reason = '';
      try { reason = interaction.fields.getTextInputValue('reason'); } catch { ignore(); }
      return startTicket(interaction, reason, true);
    }
    return false;
  } catch (err) {
    console.error('ticket modal error:', err?.message);
    await safeRespond(interaction, eph('⚠️ Could not open your ticket. Please try again.'));
    return true;
  }
}

async function startTicket(interaction, reason, fromModal = false) {
  const guild = interaction.guild;
  if (!guild) return safeRespond(interaction, eph('❌ Tickets only work inside a server.'));
  const t = tk(guild.id);
  if (!t.enabled) return safeRespond(interaction, eph('❌ The ticket system is currently disabled.'));

  const member = interaction.member;
  if (!member) return safeRespond(interaction, eph('❌ Could not read your membership. Try again in a moment.'));

  // Pre-flight: make sure the bot can actually create/manage ticket channels.
  if (!botCan(guild, PermissionFlagsBits.ManageChannels)) {
    return safeRespond(interaction, eph('❌ I need the **Manage Channels** permission to open tickets. Ask an admin to grant it.'));
  }

  // Blacklist guard.
  try {
    if (t.blacklistRoleId && member.roles.cache.has(t.blacklistRoleId)) {
      return safeRespond(interaction, eph('🚫 You are not allowed to open tickets.'));
    }
  } catch { ignore(); }

  // Cooldown guard.
  if (t.cooldownSeconds > 0) {
    const key = `${guild.id}:${member.id}`;
    const until = openCooldown.get(key) || 0;
    if (Date.now() < until) {
      return safeRespond(interaction, eph(`⏳ Please wait ${Math.ceil((until - Date.now()) / 1000)}s before opening another ticket.`));
    }
  }

  // Max-open guard. Trailing space avoids "opener:12" matching "opener:123".
  let openCount = 0;
  try { openCount = guild.channels.cache.filter((c) => c.topic?.includes(`opener:${member.id} `)).size; } catch { ignore(); }
  if (openCount >= (Number(t.maxOpen) || 1)) {
    return safeRespond(interaction, eph(`❌ You already have ${openCount} open ticket(s). Close one before opening another.`));
  }

  // Require-reason: pop a modal first (button path only, and only if we haven't
  // already acknowledged the interaction some other way).
  if (t.requireReason && !reason && !fromModal) {
    try {
      const modal = new ModalBuilder().setCustomId('ticket:reasonmodal').setTitle('Open a Ticket').addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('reason').setLabel('Briefly, what do you need help with?').setStyle(TextInputStyle.Paragraph).setMaxLength(400).setRequired(true),
        ),
      );
      return await interaction.showModal(modal);
    } catch {
      // If the modal can't be shown, just open a ticket without a reason.
    }
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(ignore);
  const num = nextNumber(guild.id);

  // Per-category routing: menu tickets pass the chosen option label as `reason`.
  // If that category maps to a role, ping/grant that team; else fall back to staff.
  const catRoleId = (reason && t.categoryRoles && t.categoryRoles[reason]) || '';
  const pingRoleId = (catRoleId && guild.roles.cache.has(catRoleId)) ? catRoleId : t.staffRoleId;

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] },
    { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] },
  ];
  // Grant view to both the routed category role and the base staff role (deduped).
  for (const rid of new Set([pingRoleId, t.staffRoleId].filter((r) => r && guild.roles.cache.has(r)))) {
    overwrites.push({ id: rid, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
  }

  // Only use the configured category if it still exists and is actually a category.
  let parent;
  try {
    const cat = t.categoryId && guild.channels.cache.get(t.categoryId);
    if (cat?.type === ChannelType.GuildCategory) parent = cat.id;
  } catch { ignore(); }

  let channel;
  try {
    channel = await guild.channels.create({
      name: ticketChannelName(t, member, num),
      type: ChannelType.GuildText,
      parent,
      topic: `Ticket #${num} • opener:${member.id} • reason:${clamp(reason || 'General', 200)}`,
      permissionOverwrites: overwrites,
    });
  } catch (err) {
    // Retry once at the top level in case the category was the problem.
    if (parent) {
      try {
        channel = await guild.channels.create({
          name: ticketChannelName(t, member, num),
          type: ChannelType.GuildText,
          topic: `Ticket #${num} • opener:${member.id} • reason:${clamp(reason || 'General', 200)}`,
          permissionOverwrites: overwrites,
        });
      } catch { ignore(); }
    }
    if (!channel) return safeRespond(interaction, eph(`❌ Could not create the ticket channel (check my permissions / category): ${clamp(err?.message, 300)}`));
  }

  const staffMention = pingRoleId ? `<@&${pingRoleId}>` : 'our staff';
  const desc = clamp(String(t.openMessage || 'Hi {user}, staff will be with you shortly.')
    .replaceAll('{user}', `${member}`)
    .replaceAll('{staff}', staffMention)
    .replaceAll('{num}', String(num)), 4000);

  const embed = new EmbedBuilder()
    .setColor(parseColor(t.color))
    .setTitle(clamp(`🎫 Ticket #${num}${reason ? ` — ${reason}` : ''}`, 256))
    .setDescription(desc)
    .setFooter({ text: clamp(`Opened by ${member.user.tag}`, 2048) })
    .setTimestamp();

  const controls = new ActionRowBuilder();
  if (t.btnClose) controls.addComponents(new ButtonBuilder().setCustomId('ticket:close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger));
  if (t.btnClaim) controls.addComponents(new ButtonBuilder().setCustomId('ticket:claim').setLabel('Claim').setEmoji('🙋').setStyle(ButtonStyle.Success));
  if (t.btnLock) controls.addComponents(new ButtonBuilder().setCustomId('ticket:lock').setLabel('Lock').setEmoji('🔐').setStyle(ButtonStyle.Secondary));
  if (t.btnTranscript) controls.addComponents(new ButtonBuilder().setCustomId('ticket:transcript').setLabel('Transcript').setEmoji('📄').setStyle(ButtonStyle.Secondary));
  if (t.autoCloseMinutes > 0) controls.addComponents(new ButtonBuilder().setCustomId('ticket:keep').setLabel('Keep Open').setEmoji('📌').setStyle(ButtonStyle.Primary));
  // Guarantee a Close button even if every button was toggled off — otherwise a
  // ticket could become impossible to close from the UI.
  if (!controls.components.length) controls.addComponents(new ButtonBuilder().setCustomId('ticket:close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger));

  const rows = [controls];
  if (t.priority) {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:prio:low').setLabel('Low').setEmoji('🟢').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket:prio:med').setLabel('Medium').setEmoji('🟡').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket:prio:high').setLabel('High').setEmoji('🔴').setStyle(ButtonStyle.Secondary),
    ));
  }

  const ping = t.pingStaff && pingRoleId ? `${member} <@&${pingRoleId}>` : `${member}`;
  await channel.send({ content: ping, embeds: [embed], components: rows }).catch(ignore);

  if (t.welcomeDM) member.send(clamp(`🎫 Your ticket **#${num}** is open in **${guild.name}**: <#${channel.id}>`, 2000)).catch(ignore);
  if (t.autoCloseMinutes > 0) scheduleAutoClose(channel, t.autoCloseMinutes);
  if (t.cooldownSeconds > 0) openCooldown.set(`${guild.id}:${member.id}`, Date.now() + t.cooldownSeconds * 1000);
  logEvent(guild, t, `📥 Ticket **#${num}** opened by ${member} → <#${channel.id}>${reason ? ` (${clamp(reason, 100)})` : ''}`);

  return safeRespond(interaction, eph(`✅ Your ticket is open: <#${channel.id}>`));
}

function openerIdFromTopic(channel) {
  try { return channel?.topic?.match(/opener:(\d+)/)?.[1] || null; } catch { return null; }
}

function isTicketChannel(channel) {
  try { return Boolean(channel?.topic?.includes('opener:')); } catch { return false; }
}

async function claimTicket(interaction) {
  const t = tk(interaction.guildId);
  try {
    if (t.staffRoleId && !interaction.member.roles.cache.has(t.staffRoleId) && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      return safeRespond(interaction, eph('❌ Only staff can claim tickets.'));
    }
  } catch { ignore(); }

  try {
    const base = interaction.message.embeds[0] ? EmbedBuilder.from(interaction.message.embeds[0]) : new EmbedBuilder().setTitle('🎫 Ticket');
    const embed = base.addFields({ name: 'Claimed by', value: `${interaction.user}`, inline: true });
    const rows = (interaction.message.components || []).map((row) => {
      const r = ActionRowBuilder.from(row);
      r.components.forEach((c) => { if (c.data?.custom_id === 'ticket:claim') c.setDisabled(true).setLabel('Claimed'); });
      return r;
    });
    await safeUpdate(interaction, { embeds: [embed], components: rows });
  } catch {
    await safeRespond(interaction, eph(`🙋 ${interaction.user} claimed this ticket.`));
  }
  interaction.channel?.send(`🙋 ${interaction.user} claimed this ticket.`).catch(ignore);
  logEvent(interaction.guild, t, `🙋 ${interaction.user} claimed <#${interaction.channelId}>`);
  return true;
}

async function lockTicket(interaction) {
  const opener = openerIdFromTopic(interaction.channel);
  if (!opener) return safeRespond(interaction, eph('❌ This is not a ticket channel.'));
  let locked = false;
  try {
    const current = interaction.channel.permissionOverwrites.cache.get(opener);
    locked = current?.deny?.has(PermissionFlagsBits.SendMessages) || false;
    await interaction.channel.permissionOverwrites.edit(opener, { SendMessages: locked ? true : false });
  } catch {
    return safeRespond(interaction, eph('❌ I could not change the lock (missing permissions?).'));
  }
  return safeRespond(interaction, { content: `${locked ? '🔓 Unlocked' : '🔐 Locked'} — the opener ${locked ? 'can now reply again' : 'can no longer send messages'}.` });
}

function scheduleAutoClose(channel, minutes) {
  try {
    clearTimeout(autoCloseTimers.get(channel.id));
    const ms = Math.min(Math.max(Number(minutes) || 0, 1), 20160) * 60_000; // cap at 14 days
    const timer = setTimeout(async () => {
      autoCloseTimers.delete(channel.id);
      try {
        const live = await channel.guild.channels.fetch(channel.id).catch(() => null);
        if (!live) return; // channel already gone
        await live.send(`${LOADING} This ticket has been open past its auto-close timer and will now close.`).catch(ignore);
        await finalizeClose(live, tk(live.guild.id), null, 'auto-close timer');
      } catch { ignore(); }
    }, ms);
    if (typeof timer.unref === 'function') timer.unref(); // don't keep the process alive
    autoCloseTimers.set(channel.id, timer);
  } catch { ignore(); }
}

async function keepOpen(interaction) {
  clearTimeout(autoCloseTimers.get(interaction.channelId));
  autoCloseTimers.delete(interaction.channelId);
  return safeRespond(interaction, { content: '📌 Auto-close cancelled — this ticket will stay open until closed manually.' });
}

async function setPriority(interaction, level) {
  const map = { low: { c: 0x2ecc71, t: '🟢 Low' }, med: { c: 0xf1c40f, t: '🟡 Medium' }, high: { c: 0xe74c3c, t: '🔴 High' } };
  const p = map[level] || map.med;
  try {
    const base = interaction.message.embeds[0] ? EmbedBuilder.from(interaction.message.embeds[0]).setColor(p.c) : new EmbedBuilder().setColor(p.c).setTitle('🎫 Ticket');
    await safeUpdate(interaction, { embeds: [base], components: interaction.message.components || [] });
  } catch { ignore(); }
  interaction.channel?.send(`📌 Priority set to **${p.t}** by ${interaction.user}.`).catch(ignore);
  return true;
}

async function closeTicket(interaction) {
  if (!isTicketChannel(interaction.channel)) return safeRespond(interaction, eph('❌ This is not a ticket channel.'));
  const t = tk(interaction.guildId);
  await safeRespond(interaction, { content: `${LOADING} Closing this ticket…` });

  const openerId = openerIdFromTopic(interaction.channel);
  if (t.feedback && openerId) {
    try {
      const row = new ActionRowBuilder().addComponents(
        ...[1, 2, 3, 4, 5].map((n) => new ButtonBuilder().setCustomId(`ticket:rate:${n}`).setLabel('⭐'.repeat(n)).setStyle(ButtonStyle.Secondary)),
      );
      interaction.client.users.send(openerId, { content: `Your ticket in **${interaction.guild.name}** was closed. How did we do?`, components: [row] }).catch(ignore);
    } catch { ignore(); }
  }
  return finalizeClose(interaction.channel, t, interaction.user, 'closed by staff/opener');
}

async function finalizeClose(channel, t, byUser, reason) {
  clearTimeout(autoCloseTimers.get(channel.id));
  autoCloseTimers.delete(channel.id);
  if (t.transcriptChannelId) { try { await sendTranscript(null, channel, true); } catch { ignore(); } }
  logEvent(channel.guild, t, `📤 ${channel.name} closed${byUser ? ` by ${byUser}` : ''} (${reason}).`);
  const timer = setTimeout(() => channel.delete('Ticket closed').catch(ignore), 5000);
  if (typeof timer.unref === 'function') timer.unref();
  return true;
}

async function sendTranscript(interaction, channel, silent) {
  const t = tk(channel?.guild?.id);
  try {
    const msgs = await channel.messages.fetch({ limit: 100 });
    const lines = [...msgs.values()].reverse().map((m) => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author?.tag || 'unknown'}: ${m.content || '(embed/attachment)'}`);
    const buffer = Buffer.from(`Transcript of #${channel.name}\n\n${lines.join('\n')}`, 'utf8');
    const file = new AttachmentBuilder(buffer, { name: `${channel.name}-transcript.txt`.replace(/[^\w.-]/g, '_') });
    const dest = t.transcriptChannelId && channel.guild.channels.cache.get(t.transcriptChannelId);
    if (dest?.isTextBased?.()) {
      await dest.send({ content: `📄 Transcript for **${channel.name}**`, files: [file] }).catch(ignore);
      if (!silent && interaction) await safeRespond(interaction, eph('📄 Transcript saved.'));
    } else if (!silent && interaction) {
      await safeRespond(interaction, { content: '📄 Transcript:', files: [file] });
    }
    return true;
  } catch (err) {
    if (!silent && interaction) await safeRespond(interaction, eph(`❌ Could not build transcript: ${clamp(err?.message, 300)}`));
    return false;
  }
}

async function recordFeedback(interaction, n) {
  await safeUpdate(interaction, { content: `Thank you! You rated your support **${'⭐'.repeat(Math.min(Math.max(Number(n) || 1, 1), 5))}**.`, components: [] });
  return true;
}

function logEvent(guild, t, text) {
  try {
    const ch = t.logChannelId && guild.channels.cache.get(t.logChannelId);
    if (ch?.isTextBased?.()) ch.send(clamp(text, 2000)).catch(ignore);
  } catch { ignore(); }
}

/* ============================================================= DM MODMAIL */

// Find a guild (shared with this user) that has DM tickets enabled. Cache-first so
// a casual DM doesn't trigger a member fetch against every guild the bot is in.
async function resolveDmGuild(client, userId) {
  let candidates = [];
  try {
    candidates = [...client.guilds.cache.values()].filter((g) => {
      const t = tk(g.id);
      return t.enabled && (t.mode === 'dm' || t.mode === 'both') && t.dmStaffChannelId;
    });
  } catch { return null; }

  for (const guild of candidates) {
    try { if (guild.members.cache.has(userId)) return { guild, t: tk(guild.id) }; } catch { ignore(); }
  }
  for (const guild of candidates) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) return { guild, t: tk(guild.id) };
  }
  return null;
}

// Called for every DM to the bot. Returns true if it handled a ticket action.
export async function handleDMTicket(message) {
  try {
    const content = (message.content || '').trim();
    const existing = store.byUser(message.author.id);

    // Already in a ticket → relay everything to the staff thread (unless closing).
    if (existing) {
      const thread = await message.client.channels.fetch(existing.thread_id).catch(() => null);
      const t = tk(existing.guild_id);

      // If the thread vanished (deleted/archived away), auto-heal by closing it.
      if (!thread) {
        store.del(message.author.id);
        await message.reply('⚠️ Your previous ticket was closed. DM me again to open a new one.').catch(ignore);
        return true;
      }
      if (content.toLowerCase() === String(t.dmCloseCommand || '!close').toLowerCase()) {
        store.del(message.author.id);
        await thread.send(`🔒 **${message.author.tag}** closed this ticket from their DMs.`).catch(ignore);
        await thread.setArchived(true).catch(ignore);
        await message.react('🔒').catch(ignore);
        return message.reply('🔒 Your ticket has been closed. DM me again any time to open a new one.').catch(ignore);
      }
      const embed = new EmbedBuilder().setColor(0x5865f2)
        .setAuthor({ name: clamp(message.author.tag, 256), iconURL: message.author.displayAvatarURL() })
        .setDescription(clamp(content || '*(no text)*', 4000)).setTimestamp();
      const files = [...message.attachments.values()].map((a) => a.url).slice(0, 10);
      await thread.send({ embeds: [embed], files }).catch(ignore);
      await message.react(t.dmAck || '✅').catch(ignore);
      return true;
    }

    // Not in a ticket yet → only open when the command prefix is used.
    const resolved = await resolveDmGuild(message.client, message.author.id);
    if (!resolved) return false;
    const { guild, t } = resolved;
    const cmd = String(t.dmCommand || '!ticket').toLowerCase();
    if (!content.toLowerCase().startsWith(cmd)) return false;

    const body = content.slice(cmd.length).trim();
    const staffChannel = await guild.channels.fetch(t.dmStaffChannelId).catch(() => null);
    if (!staffChannel?.threads) return message.reply('❌ Sorry, DM tickets are misconfigured on that server (no staff channel).').catch(ignore);

    let thread;
    try {
      thread = await staffChannel.threads.create({
        name: `dm-${message.author.username}`.slice(0, 90),
        type: ChannelType.PrivateThread,
        invitable: false,
        reason: `DM ticket opened by ${message.author.tag}`,
      });
    } catch {
      thread = await staffChannel.threads.create({ name: `dm-${message.author.username}`.slice(0, 90) }).catch(() => null);
    }
    if (!thread) return message.reply('❌ Could not open a ticket right now. Please try again later.').catch(ignore);

    store.put({ user_id: message.author.id, guild_id: guild.id, thread_id: thread.id, channel_id: staffChannel.id, opened_at: Date.now() });

    const header = new EmbedBuilder().setColor(parseColor(t.color)).setTitle('📨 New DM Ticket')
      .setDescription(clamp(body || '*(no message)*', 4000))
      .addFields({ name: 'User', value: clamp(`${message.author.tag} \`${message.author.id}\``, 1024), inline: true })
      .setFooter({ text: 'Reply in this thread to message the user • they type your close command to end it' }).setTimestamp();
    const staffPing = t.staffRoleId ? `<@&${t.staffRoleId}>` : '';
    await thread.send({ content: staffPing, embeds: [header] }).catch(ignore);

    await message.react(t.dmAck || '✅').catch(ignore);
    return message.reply(clamp(t.dmReply || 'Thanks! Your message was sent to our staff team.', 2000)).catch(ignore);
  } catch (err) {
    console.error('DM ticket error:', err?.message);
    return false; // fall through to normal DM handling
  }
}

// Called for guild messages: if a staff member types in a DM-ticket thread, relay
// it to the user's DMs. Returns true if it relayed.
export async function relayStaffThreadMessage(message) {
  try {
    if (!message.channel?.isThread?.()) return false;
    const row = store.byThread(message.channel.id);
    if (!row) return false;
    if (message.author.bot) return false;

    const t = tk(row.guild_id);
    if ((message.content || '').trim().toLowerCase() === String(t.dmCloseCommand || '!close').toLowerCase()) {
      store.del(row.user_id);
      await message.channel.send('🔒 Ticket closed.').catch(ignore);
      await message.channel.setArchived(true).catch(ignore);
      message.client.users.send(row.user_id, '🔒 Your ticket was closed by staff. DM me again any time to open a new one.').catch(ignore);
      return true;
    }

    const user = await message.client.users.fetch(row.user_id).catch(() => null);
    if (user) {
      const files = [...message.attachments.values()].map((a) => a.url).slice(0, 10);
      const label = message.member?.displayName || message.author.username;
      await user.send({ content: clamp(`**${label}** (staff): ${message.content || ''}`, 2000), files }).catch(ignore);
      await message.react('📨').catch(ignore);
    } else {
      // Couldn't reach the user (DMs closed / left) — tell staff instead of failing silently.
      await message.channel.send('⚠️ Could not deliver that message — the user may have DMs off or left the server.').catch(ignore);
    }
    return true;
  } catch (err) {
    console.error('staff relay error:', err?.message);
    return false;
  }
}
