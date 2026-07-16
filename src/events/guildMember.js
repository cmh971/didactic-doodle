// Member join / leave: welcome & goodbye cards + auto-join roles.
// Driven entirely by the per-guild settings configured in /setup.
import { getCfg } from '../setup/store.js';
import { renderMemberCard } from '../render/cards.js';
import { bump as analyticsBump } from '../systems/analytics.js';

function fill(template, member) {
  return (template || '')
    .replaceAll('{user}', member.user ? `<@${member.id}>` : member.toString?.() || '')
    .replaceAll('{username}', member.user?.username || 'member')
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{count}', String(member.guild.memberCount));
}

export async function handleMemberAdd(member) {
  if (member.user?.bot) return;
  analyticsBump(member.guild.id, 'joins');
  const { settings } = getCfg(member.guild.id);

  // Auto-join roles
  for (const roleId of settings.joinRoles || []) {
    await member.roles.add(roleId, 'Auto-join role').catch(() => {});
  }

  if (!settings.welcomeChannel) return;
  const channel = member.guild.channels.cache.get(settings.welcomeChannel);
  if (!channel?.isTextBased?.()) return;

  try {
    const card = await renderMemberCard({
      username: member.user.username,
      avatarURL: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
      guildName: member.guild.name,
      memberCount: member.guild.memberCount,
      type: 'welcome',
    });
    await channel.send({ content: fill(settings.welcomeMessage, member), files: [card] });
  } catch (err) {
    console.error('welcome card error:', err.message);
  }
}

export async function handleMemberRemove(member) {
  if (member.user?.bot) return;
  analyticsBump(member.guild.id, 'leaves');
  const { settings } = getCfg(member.guild.id);
  if (!settings.goodbyeChannel) return;
  const channel = member.guild.channels.cache.get(settings.goodbyeChannel);
  if (!channel?.isTextBased?.()) return;

  try {
    const card = await renderMemberCard({
      username: member.user.username,
      avatarURL: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
      guildName: member.guild.name,
      type: 'goodbye',
    });
    await channel.send({ content: fill(settings.goodbyeMessage, member), files: [card] });
  } catch (err) {
    console.error('goodbye card error:', err.message);
  }
}
