// !infract — Staff Infraction for President RP | Los Angeles RP ONLY.
// Red embed matching their card (server icon thumbnail + red INFRACTIONS banner).
// Choose a punishment type:
//   • a role punishment (verbal / warning / strike / anything else) → finds the
//     role by NAME, creates it if missing, and assigns it.
//   • kick / ban → performs the Discord action (hierarchy-guarded).
//
//   !infract @user | <punishment> | <reason> | [notes]
//
// Scoped to one guild; needs the right perms per action.
import { EmbedBuilder, AttachmentBuilder, PermissionFlagsBits } from 'discord.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { guardTarget, guardRoleAssign } from '../systems/modGuard.js';

const PRESIDENT_RP = '1505196861412081694';
const BANNER = readFileSync(fileURLToPath(new URL('./assets/presidentrp-infract.png', import.meta.url)));

const titleCase = (s) => s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

// Find a role by name (case-insensitive); create it if it doesn't exist.
async function ensureRole(guild, name) {
  let role = guild.roles.cache.find((r) => r.name.toLowerCase() === name.toLowerCase());
  if (role) return { role, created: false };
  role = await guild.roles.create({ name, color: 0xe74c3c, reason: `Auto-created infraction role: ${name}`, hoist: false, mentionable: false });
  return { role, created: true };
}

export async function handleInfractText(message) {
  const raw = (message.content || '').trim();
  if (!/^!infract\b/i.test(raw)) return false;
  if (message.guild?.id !== PRESIDENT_RP) return false; // scoped

  const body = raw.replace(/^!infract\b/i, '').trim();
  const parts = body.split('|').map((p) => p.trim());
  const target = message.mentions.users.first();
  const typeRaw = parts[1] || '';
  const reason = parts[2] || '';
  const notes = parts[3] || 'None';

  if (!target || !typeRaw || !reason) {
    await message.reply(
      '📋 **Issue a staff infraction**\n`!infract @user | <punishment> | <reason> | [notes]`\n' +
      '_Punishments:_ `verbal` · `warning` · `strike` · (or any custom role name) · `kick` · `ban`\n' +
      '_Example:_ `!infract @jm | strike | Staff disrespect | 2nd offense`',
    ).catch(() => {});
    return true;
  }

  const kind = typeRaw.toLowerCase().replace(/\s+/g, '');
  const isKick = kind === 'kick';
  const isBan = kind === 'ban';

  // ---- permission gate per action ----
  const need = isBan ? PermissionFlagsBits.BanMembers : isKick ? PermissionFlagsBits.KickMembers : PermissionFlagsBits.ManageRoles;
  const needName = isBan ? 'Ban Members' : isKick ? 'Kick Members' : 'Manage Roles';
  if (!message.member?.permissions?.has(need)) {
    await message.reply(`🔒 You need the **${needName}** permission for that punishment.`).catch(() => {});
    return true;
  }

  const member = await message.guild.members.fetch(target.id).catch(() => null);
  let punishmentLabel = titleCase(typeRaw);
  let actionNote = '';

  if (isKick || isBan) {
    // target protection (owner/self/bot/hierarchy) — reuse the shared guard
    const blocked = await guardTarget({ guild: message.guild, user: message.author, member: message.member, client: message.client }, target.id);
    if (blocked) { await message.reply(blocked).catch(() => {}); return true; }
    try {
      if (isBan) { await message.guild.members.ban(target.id, { reason: `Infraction: ${reason} (by ${message.author.tag})` }); punishmentLabel = 'Ban'; actionNote = '🔨 Member banned.'; }
      else { if (!member) { await message.reply('❌ That member isn’t in the server to kick.').catch(() => {}); return true; } await member.kick(`Infraction: ${reason} (by ${message.author.tag})`); punishmentLabel = 'Kick'; actionNote = '👢 Member kicked.'; }
    } catch (e) { await message.reply(`❌ Could not ${isBan ? 'ban' : 'kick'}: ${e.message}`).catch(() => {}); return true; }
  } else {
    // role punishment — find or create the role, then assign
    if (!member) { await message.reply('❌ That member isn’t in the server.').catch(() => {}); return true; }
    if (!message.guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) { await message.reply('⚠️ I’m missing **Manage Roles**, so I can’t assign/create the punishment role.').catch(() => {}); return true; }
    try {
      const { role, created } = await ensureRole(message.guild, punishmentLabel);
      const blocked = guardRoleAssign({ guild: message.guild, invokerMember: message.member, targetMember: member, role });
      if (blocked) { await message.reply(blocked).catch(() => {}); return true; }
      await member.roles.add(role, `Infraction by ${message.author.tag}: ${reason}`);
      actionNote = created ? `✅ Created & assigned the **${role.name}** role.` : `✅ Assigned the **${role.name}** role.`;
    } catch (e) { await message.reply(`❌ Could not apply the role: ${e.message}`).catch(() => {}); return true; }
  }

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle('Staff Infraction')
    .setThumbnail(message.guild.iconURL?.({ extension: 'png', size: 128 }) || null)
    .setDescription(`The high-ranking team of **${message.guild.name}** has decided to take disciplinary action against you.`)
    .addFields(
      { name: 'Staff Member', value: `<@${target.id}>` },
      { name: 'Punishment', value: punishmentLabel },
      { name: 'Reason', value: reason.slice(0, 1024) },
      { name: 'Notes', value: notes.slice(0, 1024) },
    )
    .setImage('attachment://infractions.png')
    .setFooter({ text: `Infraction issued by ${message.author.tag}`, iconURL: message.author.displayAvatarURL?.() })
    .setTimestamp();

  await message.channel.send({
    content: `<@${target.id}>`,
    embeds: [embed],
    files: [new AttachmentBuilder(BANNER, { name: 'infractions.png' })],
    allowedMentions: { users: [target.id] },
  }).catch(() => {});
  // let the issuer know the role/action result (ephemeral-ish: a quick reply then tidy)
  if (actionNote) await message.reply(actionNote).then((m) => setTimeout(() => m.delete().catch(() => {}), 6000)).catch(() => {});
  await message.delete().catch(() => {});
  return true;
}
