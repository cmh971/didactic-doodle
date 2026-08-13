// !promote — Staff Promotion for President RP | Los Angeles RP ONLY.
// Uses their real PROMOTIONS banner (saved in ./assets), the promoted user's
// avatar as the thumbnail, auto-assigns the mentioned rank role, and posts an
// upgraded congratulations card.
//
//   !promote @user | @NewRankRole | Reason
//
// Scoped to one guild; needs Manage Roles to issue.
import { EmbedBuilder, AttachmentBuilder, PermissionFlagsBits } from 'discord.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PRESIDENT_RP = '1505196861412081694';
const BANNER = readFileSync(fileURLToPath(new URL('./assets/presidentrp-promo.jpg', import.meta.url)));

export async function handlePromoteText(message) {
  const raw = (message.content || '').trim();
  if (!/^!promote\b/i.test(raw)) return false;
  if (message.guild?.id !== PRESIDENT_RP) return false; // scoped

  if (!message.member?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    await message.reply('🔒 You need the **Manage Roles** permission to issue promotions.').catch(() => {});
    return true;
  }

  const body = raw.replace(/^!promote\b/i, '').trim();
  const parts = body.split('|').map((p) => p.trim());
  const target = message.mentions.users.first();
  const role = message.mentions.roles.first();
  const rank = parts[1] || (role ? `<@&${role.id}>` : '');
  const reason = parts.slice(2).join(' | ').trim();

  if (!target || !rank || !reason) {
    await message.reply(
      '📋 **Issue a promotion**\n`!promote @user | @NewRankRole | Reason`\n' +
      '_Example:_ `!promote @jm | @Praise 1 | First to respond to an activity check`\n' +
      '_Tip: mention the actual rank **role** and I’ll assign it automatically._',
    ).catch(() => {});
    return true;
  }

  // ---- RANK HIERARCHY: you cannot promote to a rank at/above your own ----
  // (owner + admins bypass). This blocks a mod from promoting anyone — including
  // themselves — into a role equal to or higher than their own top role.
  const invokerIsOwner = message.author.id === message.guild.ownerId;
  const invokerIsAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
  if (role && !invokerIsOwner && !invokerIsAdmin) {
    if (role.position >= message.member.roles.highest.position) {
      await message.reply(`🛡️ You can’t promote anyone to **${role.name}** — it’s at or above your own highest rank.`).catch(() => {});
      return true;
    }
  }
  // Don't let a lower-ranked staffer act on someone who already outranks them.
  const targetMemberPre = await message.guild.members.fetch(target.id).catch(() => null);
  if (targetMemberPre && !invokerIsOwner && !invokerIsAdmin && target.id !== message.author.id
      && targetMemberPre.roles.highest.position >= message.member.roles.highest.position) {
    await message.reply('🛡️ You can’t promote someone who already ranks equal to or above you.').catch(() => {});
    return true;
  }

  // ---- auto-assign the rank role (best-effort, with safety checks) ----
  let roleNote = '';
  const member = targetMemberPre;
  if (role && member) {
    const me = message.guild.members.me;
    if (role.id === message.guild.id) roleNote = '⚠️ Can’t assign @everyone.';
    else if (role.managed) roleNote = '⚠️ That role is managed by an integration and can’t be assigned.';
    else if (!me?.permissions?.has(PermissionFlagsBits.ManageRoles)) roleNote = '⚠️ I’m missing Manage Roles, so I couldn’t assign it.';
    else if (role.position >= me.roles.highest.position) roleNote = '⚠️ That role is above my highest role — move my role up to auto-assign it.';
    else {
      try { await member.roles.add(role, `Promotion by ${message.author.tag}`); roleNote = '✅ Rank role assigned.'; }
      catch (e) { roleNote = `⚠️ Couldn’t assign the role: ${e.message}`; }
    }
  } else if (role && !member) {
    roleNote = '⚠️ That user isn’t in the server, so I couldn’t assign the role.';
  }

  const now = Math.floor(Date.now() / 1000);
  const embed = new EmbedBuilder()
    .setColor(0x22c24f)
    .setAuthor({ name: `${message.guild.name} • Staff Promotions`, iconURL: message.guild.iconURL?.() || undefined })
    .setTitle('🎖️ Congratulations on your Promotion!')
    .setThumbnail(target.displayAvatarURL?.({ extension: 'png', size: 256 }) || null)
    .setDescription('The high-ranking team have reviewed your dedication and decided to grant you a **promotion**. Outstanding work — keep it up! 🎉')
    .addFields(
      { name: '👤 Staff Member', value: `<@${target.id}>`, inline: true },
      { name: '⭐ New Rank', value: rank.slice(0, 256), inline: true },
      { name: '​', value: '​', inline: true },
      { name: '📝 Reason', value: reason.slice(0, 1024), inline: false },
      { name: '🧑‍⚖️ Issued By', value: `<@${message.author.id}>`, inline: true },
      { name: '📅 Date', value: `<t:${now}:D>`, inline: true },
    )
    .setImage('attachment://promotions.png')
    .setFooter({ text: `${message.guild.name} • Staff Management`, iconURL: message.guild.iconURL?.() || undefined })
    .setTimestamp();
  if (roleNote) embed.addFields({ name: '​', value: roleNote, inline: false });

  await message.channel.send({
    content: `🎉 <@${target.id}>`,
    embeds: [embed],
    files: [new AttachmentBuilder(BANNER, { name: 'promotions.png' })],
    allowedMentions: { users: [target.id] },
  }).catch(() => {});
  await message.delete().catch(() => {});
  return true;
}
