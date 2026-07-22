// Infraction command engine — the interactive `/infraction add` menu, plus the
// shared apply logic used by BOTH Discord (the command) and the web dashboard.
//
// Flow for `/infraction add`:
//   1) mod runs the command → ephemeral panel with a user picker + action picker
//   2) mod fills both → "Set reason & apply" button un-locks
//   3) button opens a modal (reason + optional duration)
//   4) modal submit → applyInfraction() → the action is carried out + logged
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import { addInfraction, getInfraction, deleteInfraction } from './automod.js';
import { getCfg } from '../setup/store.js';

const ACCENT = 0x5865f2;
const eph = (content) => ({ content, flags: MessageFlags.Ephemeral });

// Pending selections while a mod is building an infraction, keyed by
// `${guildId}:${moderatorId}`. Cleared on submit/cancel or after 15 minutes.
const pending = new Map();
function setPending(key, state) {
  const prev = pending.get(key);
  if (prev?.timer) clearTimeout(prev.timer);
  const timer = setTimeout(() => pending.delete(key), 15 * 60_000);
  if (timer.unref) timer.unref();
  pending.set(key, { ...state, timer });
}

// ---------------------------------------------------------------------------
// DURATION PARSING + HUMANIZING
// ---------------------------------------------------------------------------
const UNIT = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
const TIMEOUT_MAX = 28 * 86_400_000; // Discord caps a timeout at 28 days

// Accepts "1h", "30m", "1d", "2h30m", "1w", or a bare number (= minutes).
export function parseDuration(str) {
  if (!str) return null;
  const s = String(str).trim().toLowerCase();
  if (!s) return null;
  let total = 0;
  let matched = false;
  const re = /(\d+)\s*(w|d|h|m|s)/g;
  let mm;
  while ((mm = re.exec(s))) { total += Number(mm[1]) * UNIT[mm[2]]; matched = true; }
  if (!matched) {
    const n = parseInt(s.replace(/[^0-9]/g, ''), 10);
    return n ? n * UNIT.m : null;
  }
  return total || null;
}

function humanizeMs(ms) {
  if (!ms) return '0s';
  const parts = [];
  const push = (n, u) => { if (n) parts.push(`${n}${u}`); };
  let s = Math.round(ms / 1000);
  push(Math.floor(s / 86400), 'd'); s %= 86400;
  push(Math.floor(s / 3600), 'h'); s %= 3600;
  push(Math.floor(s / 60), 'm'); s %= 60;
  push(s, 's');
  return parts.slice(0, 2).join(' ') || '0s';
}

const ACTIONS = {
  warn: { label: 'Warn', emoji: '⚠️', type: 'warn' },
  mute: { label: 'Mute (timeout)', emoji: '🔇', type: 'timeout' },
  kick: { label: 'Kick', emoji: '👢', type: 'kick' },
  ban: { label: 'Ban', emoji: '🔨', type: 'ban' },
};
const TYPE_NOUN = { warn: 'Warning', mute: 'Mute', kick: 'Kick', ban: 'Ban' };
const ACTION_COLOR = { warn: 0x3498db, mute: 0xf1c40f, kick: 0xe67e22, ban: 0xe74c3c };

// Best-effort server invite for the "Go to Server" button: vanity → existing
// invite → freshly created one. Returns a URL string or null (button omitted).
async function getServerInvite(guild) {
  try { if (guild.vanityURLCode) return `https://discord.gg/${guild.vanityURLCode}`; } catch { /* no vanity */ }
  try {
    const existing = await guild.invites.fetch();
    const pick = existing.find((i) => !i.maxAge && !i.temporary) || existing.first();
    if (pick) return `https://discord.gg/${pick.code}`;
  } catch { /* missing perms */ }
  try {
    const me = guild.members.me;
    const ch = guild.systemChannel?.permissionsFor?.(me)?.has(PermissionFlagsBits.CreateInstantInvite)
      ? guild.systemChannel
      : [...guild.channels.cache.values()].find((c) => c.isTextBased?.() && !c.isThread?.() && c.permissionsFor?.(me)?.has(PermissionFlagsBits.CreateInstantInvite));
    if (ch) { const inv = await ch.createInvite({ maxAge: 0, maxUses: 0, unique: false, reason: 'Infraction notice link' }); return `https://discord.gg/${inv.code}`; }
  } catch { /* couldn't create */ }
  return null;
}

// Build the "Staff Infraction Issued" DM (embed + buttons) sent to the offender.
async function buildInfractionDM({ guild, targetId, moderatorId, action, reason, notes, caseId, count, expiresAt, issuedAt }) {
  const embed = new EmbedBuilder()
    .setColor(ACTION_COLOR[action] ?? 0x5865f2)
    .setTitle('Staff Infraction Issued')
    .setDescription(`An infraction has been issued to <@${targetId}> within **${guild.name}**.`)
    .addFields(
      { name: 'Offender', value: `<@${targetId}>`, inline: true },
      { name: 'Issued By', value: `<@${moderatorId}>`, inline: true },
      { name: 'Infraction Type', value: `${ACTIONS[action].emoji} ${TYPE_NOUN[action] || action} · Strike ${count}`, inline: true },
      { name: 'Reason', value: reason || '_No reason provided_' },
      ...(notes ? [{ name: 'Notes', value: notes }] : []),
      { name: 'Expires', value: expiresAt ? `<t:${expiresAt}:F> (<t:${expiresAt}:R>)` : 'Does not expire', inline: true },
      { name: 'Issued At', value: `<t:${issuedAt}:F>`, inline: true },
      { name: 'Infraction ID', value: `\`#${caseId}\``, inline: true },
    )
    .setFooter({ text: `${guild.name} · Staff Management`, iconURL: guild.iconURL?.() || undefined })
    .setTimestamp();

  const buttons = [
    new ButtonBuilder().setCustomId(`appeal:open:${guild.id}:${caseId}:${moderatorId}`).setLabel('Request Amendment').setStyle(ButtonStyle.Secondary).setEmoji('⚖️'),
  ];
  const invite = await getServerInvite(guild);
  if (invite) buttons.unshift(new ButtonBuilder().setLabel('Go to Server').setStyle(ButtonStyle.Link).setEmoji('🌐').setURL(invite));

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(...buttons)] };
}

// ---------------------------------------------------------------------------
// SHARED APPLY LOGIC (used by the command AND the web dashboard)
// ---------------------------------------------------------------------------
export async function applyInfraction(client, { guildId, targetId, moderatorId, action, reason, durationMs, notes }) {
  const meta = ACTIONS[action];
  if (!meta) return { ok: false, error: 'Unknown action.' };
  const guild = client.guilds?.cache.get(guildId);
  if (!guild) return { ok: false, error: 'The bot is not in that server.' };

  const cleanReason = (reason || 'No reason provided').toString().slice(0, 500);
  const cleanNotes = notes ? String(notes).slice(0, 500) : null;
  const target = await client.users.fetch(targetId).catch(() => null);
  if (!target) return { ok: false, error: 'Could not find that user.' };
  const member = await guild.members.fetch(targetId).catch(() => null);

  let expiresAt = null;
  let appliedLabel = '';
  try {
    if (action === 'warn') {
      appliedLabel = '⚠️ Warning issued';
    } else if (action === 'mute') {
      if (!member) return { ok: false, error: `${target.tag} is not in the server — can't mute them.` };
      const ms = Math.min(durationMs || 60 * 60_000, TIMEOUT_MAX);
      await member.timeout(ms, cleanReason);
      expiresAt = Math.floor((Date.now() + ms) / 1000);
      appliedLabel = `🔇 Muted for ${humanizeMs(ms)}`;
    } else if (action === 'kick') {
      if (!member) return { ok: false, error: `${target.tag} is not in the server — can't kick them.` };
      await member.kick(cleanReason);
      appliedLabel = '👢 Kicked';
    } else if (action === 'ban') {
      if (durationMs) expiresAt = Math.floor((Date.now() + durationMs) / 1000);
      await guild.members.ban(targetId, { reason: cleanReason });
      appliedLabel = durationMs ? `🔨 Banned (logged ${humanizeMs(durationMs)})` : '🔨 Permanently banned';
    }
  } catch (err) {
    return { ok: false, error: `Discord rejected the action: ${err.message} (check my role position & permissions).` };
  }

  const { id: caseId, count } = addInfraction(guildId, targetId, moderatorId, meta.type, cleanReason, expiresAt, cleanNotes);
  const issuedAt = Math.floor(Date.now() / 1000);

  // Best-effort rich DM to the offender — "Staff Infraction Issued" card with
  // Go-to-Server + Request-Amendment buttons. Never blocks the action.
  try {
    const dm = await buildInfractionDM({ guild, targetId, moderatorId, action, reason: cleanReason, notes: cleanNotes, caseId, count, expiresAt, issuedAt });
    await target.send(dm);
  } catch { /* DMs closed or send failed — ignore */ }

  // Mirror to the configured mod-log channel (set on /setup ▸ Moderation).
  try {
    const logId = getCfg(guildId).settings.modLogChannel;
    if (logId) {
      const ch = guild.channels.cache.get(logId);
      if (ch?.isTextBased?.()) {
        const log = new EmbedBuilder()
          .setColor(action === 'ban' ? 0xe74c3c : action === 'kick' ? 0xe67e22 : action === 'mute' ? 0xf1c40f : 0x3498db)
          .setAuthor({ name: `${target.tag} (${target.id})`, iconURL: target.displayAvatarURL?.() })
          .setTitle(`${appliedLabel} — Case #${caseId}`)
          .addFields(
            { name: 'Moderator', value: `<@${moderatorId}>`, inline: true },
            { name: 'Total cases', value: String(count), inline: true },
            { name: 'Reason', value: cleanReason },
            ...(cleanNotes ? [{ name: 'Notes', value: cleanNotes }] : []),
          )
          .setTimestamp();
        ch.send({ embeds: [log] }).catch(() => {});
      }
    }
  } catch { /* logging must never break the action */ }

  return { ok: true, caseId, count, label: appliedLabel, targetTag: target.tag };
}

// ---------------------------------------------------------------------------
// THE INTERACTIVE `/infraction add` PANEL
// ---------------------------------------------------------------------------
function buildPanel(state = {}) {
  const { targetId, action } = state;
  const meta = action ? ACTIONS[action] : null;
  const embed = new EmbedBuilder()
    .setColor(ACCENT)
    .setTitle('🛠️ Add Infraction')
    .setDescription(
      'Pick a **member** and an **action**, then press **Set reason & apply**.\n\n' +
      `**Member:** ${targetId ? `<@${targetId}>` : '_not selected_'}\n` +
      `**Action:** ${meta ? `${meta.emoji} ${meta.label}` : '_not selected_'}\n\n` +
      '_A reason (and, for mutes/bans, an optional duration like `1h`, `1d`, `2h30m`) is collected next._',
    );

  const userRow = new ActionRowBuilder().addComponents(
    (() => {
      const m = new UserSelectMenuBuilder().setCustomId('infraction:user').setPlaceholder('Select a member…').setMinValues(0).setMaxValues(1);
      if (targetId) { try { m.setDefaultUsers(targetId); } catch { /* older discord.js */ } }
      return m;
    })(),
  );

  const actionRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('infraction:action')
      .setPlaceholder('Select an action…')
      .addOptions(Object.entries(ACTIONS).map(([value, a]) => ({
        label: a.label, value, emoji: a.emoji, default: value === action,
      }))),
  );

  const btnRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('infraction:submit').setLabel('Set reason & apply').setStyle(ButtonStyle.Success).setEmoji('✅').setDisabled(!(targetId && action)),
    new ButtonBuilder().setCustomId('infraction:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('🚫'),
  );

  return { embeds: [embed], components: [userRow, actionRow, btnRow] };
}

// Called by `/infraction add`.
export async function startAdd(interaction) {
  setPending(`${interaction.guildId}:${interaction.user.id}`, {});
  await interaction.reply({ ...buildPanel({}), flags: MessageFlags.Ephemeral });
}

// ---------------------------------------------------------------------------
// COMPONENT + MODAL ROUTER (registered in index.js under the `infraction:` prefix)
// ---------------------------------------------------------------------------
export async function handleInfraction(interaction) {
  const cid = interaction.customId;
  if (!cid || !cid.startsWith('infraction:')) return false;

  if (!interaction.inGuild()) {
    await interaction.reply(eph('❌ Infractions can only be managed inside a server.')).catch(() => {});
    return true;
  }
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
    await interaction.reply(eph('❌ You need the **Moderate Members** permission to do that.')).catch(() => {});
    return true;
  }

  const key = `${interaction.guildId}:${interaction.user.id}`;
  const state = pending.get(key) || {};
  const part = cid.split(':')[1];

  // ---- user picker ----
  if (part === 'user' && interaction.isUserSelectMenu()) {
    state.targetId = interaction.values[0] || null;
    setPending(key, state);
    await interaction.update(buildPanel(state));
    return true;
  }

  // ---- action picker ----
  if (part === 'action' && interaction.isStringSelectMenu()) {
    state.action = interaction.values[0] || null;
    setPending(key, state);
    await interaction.update(buildPanel(state));
    return true;
  }

  // ---- cancel ----
  if (part === 'cancel') {
    if (state.timer) clearTimeout(state.timer);
    pending.delete(key);
    await interaction.update({ embeds: [new EmbedBuilder().setColor(0x99aab5).setTitle('🚫 Cancelled').setDescription('No infraction was added.')], components: [] });
    return true;
  }

  // ---- submit → open the reason/duration modal ----
  if (part === 'submit') {
    if (!state.targetId || !state.action) {
      await interaction.reply(eph('Pick both a member and an action first.')).catch(() => {});
      return true;
    }
    const needsDuration = state.action === 'mute' || state.action === 'ban';
    const rows = [
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('reason').setLabel('Reason').setStyle(TextInputStyle.Paragraph).setMaxLength(500).setRequired(true).setPlaceholder('Why is this action being taken?'),
      ),
    ];
    if (needsDuration) {
      rows.push(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('duration').setLabel('Duration (optional, e.g. 1h, 1d, 2h30m)').setStyle(TextInputStyle.Short).setMaxLength(20).setRequired(false)
          .setPlaceholder(state.action === 'mute' ? 'Blank = 1 hour' : 'Blank = permanent'),
      ));
    }
    rows.push(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('notes').setLabel('Notes (optional, internal / shown to user)').setStyle(TextInputStyle.Paragraph).setMaxLength(500).setRequired(false).setPlaceholder('Extra context, e.g. "expires shortly" or ticket link.'),
    ));
    const modal = new ModalBuilder().setCustomId('infraction:modal').setTitle(`${ACTIONS[state.action].emoji} ${ACTIONS[state.action].label}`).addComponents(...rows);
    await interaction.showModal(modal);
    return true;
  }

  // ---- modal submit → carry out the action ----
  if (part === 'modal' && interaction.isModalSubmit()) {
    if (!state.targetId || !state.action) {
      await interaction.reply(eph('⌛ That infraction draft expired — run `/infraction add` again.')).catch(() => {});
      return true;
    }
    await interaction.deferUpdate().catch(() => {});
    const reason = interaction.fields.getTextInputValue('reason');
    let durationMs = null;
    try { durationMs = parseDuration(interaction.fields.getTextInputValue('duration')); } catch { /* no field */ }
    let notes = null;
    try { notes = interaction.fields.getTextInputValue('notes') || null; } catch { /* no field */ }

    const result = await applyInfraction(interaction.client, {
      guildId: interaction.guildId,
      targetId: state.targetId,
      moderatorId: interaction.user.id,
      action: state.action,
      reason,
      durationMs,
      notes,
    });

    if (state.timer) clearTimeout(state.timer);
    pending.delete(key);

    const embed = result.ok
      ? new EmbedBuilder().setColor(0x2ecc71).setTitle(`✅ ${result.label} — Case #${result.caseId}`)
        .setDescription(`**Member:** ${result.targetTag}\n**Reason:** ${reason}\n**Total cases:** ${result.count}\n\nView anytime with \`/infraction view\`.`)
      : new EmbedBuilder().setColor(0xe74c3c).setTitle('❌ Could not apply').setDescription(result.error);
    await interaction.editReply({ embeds: [embed], components: [] }).catch(() => {});
    return true;
  }

  return true;
}

// ---------------------------------------------------------------------------
// AMENDMENT / APPEAL FLOW — the offender's "Request Amendment" button (works in
// DMs). customId carries the context: appeal:<part>:<guildId>:<caseId>:<modId>.
// ---------------------------------------------------------------------------
export async function handleAppeal(interaction) {
  const cid = interaction.customId;
  if (!cid || !cid.startsWith('appeal:')) return false;
  const [, part, guildId, caseId, moderatorId] = cid.split(':');

  // Button → open a modal for the offender to explain their case.
  if (part === 'open') {
    const modal = new ModalBuilder()
      .setCustomId(`appeal:submit:${guildId}:${caseId}:${moderatorId}`)
      .setTitle(`Amend Case #${caseId}`.slice(0, 45))
      .addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('msg').setLabel('Why should this be amended?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000).setPlaceholder('Explain your side — this is sent to the staff who issued it.'),
      ));
    await interaction.showModal(modal);
    return true;
  }

  // Modal submit → notify the issuing moderator (DM + mod-log).
  if (part === 'submit' && interaction.isModalSubmit()) {
    await interaction.deferReply().catch(() => {});
    const msg = interaction.fields.getTextInputValue('msg');
    const client = interaction.client;
    const guild = client.guilds?.cache.get(guildId);
    const appellant = interaction.user;

    let caseInfo = null;
    try { caseInfo = getInfraction(guildId, caseId); } catch { /* gone */ }

    const notice = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('⚖️ Amendment Requested')
      .setDescription(`**${appellant.tag}** is requesting an amendment to **Case #${caseId}**${guild ? ` in **${guild.name}**` : ''}.`)
      .addFields(
        { name: 'Offender', value: `<@${appellant.id}> (${appellant.id})`, inline: true },
        { name: 'Case', value: `\`#${caseId}\`${caseInfo ? ` · \`${caseInfo.type}\`` : ''}`, inline: true },
        ...(caseInfo?.reason ? [{ name: 'Original reason', value: String(caseInfo.reason).slice(0, 1024) }] : []),
        { name: 'Their message', value: msg.slice(0, 1024) },
      )
      .setTimestamp();

    // Accept / Deny buttons for staff — carry guild, case, and the offender ID.
    const decisionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`appeal:accept:${guildId}:${caseId}:${appellant.id}`).setLabel('Accept & Remove').setStyle(ButtonStyle.Success).setEmoji('✅'),
      new ButtonBuilder().setCustomId(`appeal:deny:${guildId}:${caseId}:${appellant.id}`).setLabel('Deny').setStyle(ButtonStyle.Danger).setEmoji('❌'),
    );

    let notified = false;
    try { const mod = await client.users.fetch(moderatorId); await mod.send({ content: `<@${appellant.id}> wants to amend a case you issued.`, embeds: [notice], components: [decisionRow] }); notified = true; } catch { /* mod DMs off */ }
    try {
      const logId = getCfg(guildId).settings.modLogChannel;
      const ch = logId && guild?.channels.cache.get(logId);
      if (ch?.isTextBased?.()) { await ch.send({ content: `<@${moderatorId}>`, embeds: [notice], components: [decisionRow], allowedMentions: { users: [moderatorId] } }); notified = true; }
    } catch { /* no log channel */ }

    await interaction.editReply({
      content: notified
        ? '✅ Your amendment request was sent to the staff team. They’ll review it — hang tight.'
        : '⚠️ Request logged, but I couldn’t reach the moderator directly (their DMs may be off). Please open a ticket in the server.',
    }).catch(() => {});
    return true;
  }

  // Staff decision on an amendment: appeal:<accept|deny>:<guildId>:<caseId>:<offenderId>
  if (part === 'accept' || part === 'deny') {
    const offenderId = caseId && cid.split(':')[4]; // [2]=guild [3]=case [4]=offender
    // In a guild (mod-log), require Moderate Members. In a DM it's the moderator's own inbox.
    if (interaction.inGuild() && !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply(eph('❌ You need **Moderate Members** to decide amendments.')).catch(() => {});
      return true;
    }
    await interaction.deferUpdate().catch(() => {});
    const client = interaction.client;
    const decidedBy = interaction.user;
    let resultText;

    if (part === 'accept') {
      const existed = getInfraction(guildId, caseId);
      if (existed) deleteInfraction(guildId, caseId);
      resultText = `✅ **Accepted** by ${decidedBy.tag} — Case #${caseId} ${existed ? 'has been removed' : 'was already removed'}.`;
      if (existed) {
        try { const o = await client.users.fetch(offenderId); await o.send(`✅ Good news — your amendment request for **Case #${caseId}** was **accepted**. The infraction has been removed.`); } catch { /* DMs off */ }
      }
    } else {
      resultText = `❌ **Denied** by ${decidedBy.tag} — Case #${caseId} stands.`;
      try { const o = await client.users.fetch(offenderId); await o.send(`❌ Your amendment request for **Case #${caseId}** was reviewed and **denied**. The infraction stands.`); } catch { /* DMs off */ }
    }

    // Update the notice: recolor, append the decision, and drop the buttons.
    try {
      const base = interaction.message?.embeds?.[0];
      const eb = base ? EmbedBuilder.from(base) : new EmbedBuilder().setTitle('⚖️ Amendment');
      eb.setColor(part === 'accept' ? 0x2ecc71 : 0xe74c3c).addFields({ name: 'Decision', value: resultText });
      await interaction.editReply({ embeds: [eb], components: [] }).catch(() => {});
    } catch { /* message vanished */ }
    return true;
  }

  return true;
}
