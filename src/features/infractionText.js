// Prefix (!) fallback for the infraction system — same power as /infraction, but
// as plain text commands so it works even if the slash command isn't showing.
//
//   !warn  @user <reason>
//   !mute  @user [1h|30m|1d] <reason>     (blank duration = 1 hour)
//   !kick  @user <reason>
//   !ban   @user [1d] <reason>            (blank duration = permanent)
//   !infraction add <action> @user [dur] <reason>
//   !infraction view @user
//   !infraction remove <caseId>
//
// Aliases: !inf = !infraction. Requires the Moderate Members permission.
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { applyInfraction, parseDuration } from '../systems/infractions.js';
import { recentInfractions, infractionCount, deleteInfraction, getInfraction } from '../systems/automod.js';

const ACTIONS = new Set(['warn', 'mute', 'kick', 'ban']);
const TYPE_IC = { warn: '⚠️', timeout: '🔇', kick: '👢', ban: '🔨', badword: '🤬', auto: '🤖' };
const DUR_RE = /^\d+(?:\.\d+)?(?:s|m|h|d|w)$/i;

const HELP =
  '**Infraction commands**\n' +
  '• `!warn @user <reason>`\n' +
  '• `!mute @user [1h] <reason>`  _(blank = 1 hour)_\n' +
  '• `!kick @user <reason>`\n' +
  '• `!ban @user [1d] <reason>`  _(blank = permanent)_\n' +
  '• `!infraction view @user`\n' +
  '• `!infraction remove <caseId>`\n' +
  '_Tip: add notes with a pipe → `!warn @user reason | internal notes`_';

// Returns true if it handled the message (so the caller stops processing it).
export async function handleInfractionText(message) {
  const raw = (message.content || '').trim();
  if (raw[0] !== '!') return false;
  const tokens = raw.slice(1).split(/\s+/);
  const cmd = (tokens[0] || '').toLowerCase();

  let action = null;
  let sub = null;
  let argStart = 1;

  if (cmd === 'infraction' || cmd === 'inf') {
    const s = (tokens[1] || '').toLowerCase();
    if (s === 'view' || s === 'history') { sub = 'view'; argStart = 2; }
    else if (s === 'remove' || s === 'delete' || s === 'rm') { sub = 'remove'; argStart = 2; }
    else if (s === 'add') { action = (tokens[2] || '').toLowerCase(); argStart = 3; }
    else if (ACTIONS.has(s)) { action = s; argStart = 2; }
    else { await reply(message, HELP); return true; }
  } else if (ACTIONS.has(cmd)) {
    action = cmd; argStart = 1;
  } else {
    return false; // not one of our commands
  }

  // Permission gate (mirrors the slash command's default perms).
  if (!message.member?.permissions?.has(PermissionFlagsBits.ModerateMembers)) {
    await reply(message, '❌ You need the **Moderate Members** permission to do that.');
    return true;
  }

  // ---- view ----
  if (sub === 'view') {
    const id = await resolveTargetId(message, tokens.slice(argStart));
    if (!id) { await reply(message, 'Usage: `!infraction view @user` (or a user ID, or reply to their message)'); return true; }
    const total = infractionCount(message.guild.id, id);
    const rows = recentInfractions(message.guild.id, id, 12);
    const list = rows.length
      ? rows.map((r) => `**#${r.id}** ${TYPE_IC[r.type] || '•'} \`${r.type}\` — ${r.reason || '_no reason_'}${r.notes ? ` _(📝 ${r.notes})_` : ''} · by <@${r.moderator_id || '0'}> · <t:${r.created_at}:R>`).join('\n')
      : '_No infractions on record._';
    const embed = new EmbedBuilder().setColor(total ? 0xe67e22 : 0x2ecc71)
      .setTitle(`🗂️ Infractions — <@${id}>`.slice(0, 250))
      .setDescription(`**Total:** ${total}\n\n${list}`.slice(0, 4096))
      .setFooter({ text: 'Remove one with !infraction remove <caseId>' });
    await message.reply({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
    return true;
  }

  // ---- remove ----
  if (sub === 'remove') {
    const caseId = parseInt((tokens[argStart] || '').replace(/\D/g, ''), 10);
    if (!caseId) { await reply(message, 'Usage: `!infraction remove <caseId>`'); return true; }
    const existing = getInfraction(message.guild.id, caseId);
    if (!existing) { await reply(message, `❌ No case **#${caseId}** found in this server.`); return true; }
    deleteInfraction(message.guild.id, caseId);
    await reply(message, `🗑️ Deleted case **#${caseId}** — \`${existing.type}\` on <@${existing.user_id}>.`);
    return true;
  }

  // ---- add / action ----
  if (!ACTIONS.has(action)) { await reply(message, HELP); return true; }
  const args = tokens.slice(argStart);
  const targetId = await resolveTargetId(message, args);
  if (!targetId) {
    const durHint = action === 'mute' || action === 'ban' ? '[duration] ' : '';
    await reply(message, `Couldn't find a user. Try one of:\n• \`!${action} @user ${durHint}<reason>\` _(a real blue @mention)_\n• \`!${action} <userID> ${durHint}<reason>\`\n• **reply** to their message with \`!${action} ${durHint}<reason>\``);
    return true;
  }

  // Everything after the action keyword, minus the mention/ID token(s).
  const rest = args.filter((t) => !/^<@!?\d+>$/.test(t) && t.replace(/\D/g, '') !== targetId);
  let durationMs = null;
  if ((action === 'mute' || action === 'ban') && rest[0] && DUR_RE.test(rest[0])) {
    durationMs = parseDuration(rest.shift());
  }
  // "reason | notes" — anything after a pipe becomes the optional Notes field.
  const combined = rest.join(' ').trim();
  const pipe = combined.indexOf('|');
  const reason = (pipe === -1 ? combined : combined.slice(0, pipe)).trim() || 'No reason provided';
  const notes = pipe === -1 ? null : (combined.slice(pipe + 1).trim() || null);

  const res = await applyInfraction(message.client, {
    guildId: message.guild.id,
    targetId,
    moderatorId: message.author.id,
    action,
    reason,
    durationMs,
    notes,
  });
  if (!res.ok) { await reply(message, `❌ ${res.error}`); return true; }
  await message.reply({ content: `✅ ${res.label} — **Case #${res.caseId}** for **${res.targetTag}**.\n**Reason:** ${reason}`, allowedMentions: { parse: [] } }).catch(() => {});
  return true;
}

function reply(message, content) {
  return message.reply({ content, allowedMentions: { parse: [] } }).catch(() => {});
}

// Resolve a target user from: a real @mention, a raw user ID in the args, or the
// author of the message being replied to. Returns an ID string or null.
async function resolveTargetId(message, args) {
  const mentioned = message.mentions.users.first();
  if (mentioned) return mentioned.id;
  const idTok = (args || []).find((t) => /^<@!?\d+>$/.test(t) || /^\d{15,25}$/.test(t));
  if (idTok) return idTok.replace(/\D/g, '');
  if (message.reference?.messageId) {
    const ref = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
    if (ref && !ref.author.bot) return ref.author.id;
  }
  return null;
}
