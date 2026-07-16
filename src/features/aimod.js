// "AI watch mode": the AI flags suspicious messages to a mod-log channel with
// one-click action buttons. A HUMAN with Manage Messages must click; the AI never
// acts on its own. Actions are hard-capped to safe, reversible ones.
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { getCfg, setSetting } from '../setup/store.js';
import { recordInfraction } from '../systems/automod.js';
import { PROTECTED_ROLE_ID } from '../config.js';

const eph = (content) => ({ content, flags: MessageFlags.Ephemeral });
const SEV_COLOR = { low: 0xf1c40f, medium: 0xe67e22, high: 0xe74c3c };

export function getAimod(guildId) {
  return getCfg(guildId).settings.aimod || { enabled: false, channel: null };
}
export function setAimod(guildId, patch) {
  return setSetting(guildId, 'aimod', { ...getAimod(guildId), ...patch });
}
export function isEnabled(guildId) {
  const a = getAimod(guildId);
  return Boolean(a.enabled && a.channel);
}

export async function reportFlag(message, flag) {
  const a = getAimod(message.guild.id);
  const ch = message.guild.channels.cache.get(a.channel);
  if (!ch?.isTextBased?.()) return;
  const base = `${message.channel.id}:${message.id}:${message.author.id}`;
  const embed = new EmbedBuilder()
    .setColor(SEV_COLOR[flag.severity] || 0xe67e22)
    .setTitle('🚩 AI flagged a message')
    .setDescription(message.content?.slice(0, 600) || '*(no text)*')
    .addFields(
      { name: 'Author', value: `${message.author} \`${message.author.id}\``, inline: true },
      { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
      { name: 'Severity', value: flag.severity, inline: true },
      { name: 'Reason', value: flag.reason },
      { name: 'Message', value: `[Jump](${message.url})`, inline: true },
    )
    .setFooter({ text: 'Human approval required — the AI cannot act on its own' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mod:delete:${base}`).setLabel('Delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`mod:warn:${base}`).setLabel('Warn').setEmoji('⚠️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`mod:timeout:${base}`).setLabel('Timeout 10m').setEmoji('🔇').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`mod:ignore:${base}`).setLabel('Ignore').setEmoji('✅').setStyle(ButtonStyle.Secondary),
  );
  await ch.send({ embeds: [embed], components: [row] }).catch(() => {});
}

export async function handleModButton(interaction) {
  if (!interaction.customId.startsWith('mod:')) return false;
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
    await interaction.reply(eph('❌ You need Manage Messages to action this.'));
    return true;
  }
  const [, action, channelId, msgId, userId] = interaction.customId.split(':');
  const guild = interaction.guild;
  const member = await guild.members.fetch(userId).catch(() => null);

  // Hard safety guard: never act on a protected member.
  if (member && PROTECTED_ROLE_ID && member.roles.cache.has(PROTECTED_ROLE_ID)) {
    await interaction.reply(eph('🛡️ That member is protected — action blocked.'));
    return true;
  }

  let result = '✅ Ignored';
  try {
    if (action === 'delete') {
      const ch = guild.channels.cache.get(channelId);
      const msg = await ch?.messages.fetch(msgId).catch(() => null);
      if (msg) await msg.delete();
      result = '🗑️ Message deleted';
    } else if (action === 'warn') {
      recordInfraction(guild.id, userId, interaction.user.id, 'warn', 'AI-flagged (approved)');
      result = '⚠️ User warned';
    } else if (action === 'timeout') {
      if (!member) result = '❌ Member not found';
      else {
        await member.timeout(10 * 60_000, `AI-flagged, approved by ${interaction.user.tag}`);
        result = '🔇 Timed out 10m';
      }
    }
  } catch (err) {
    result = `❌ ${err.message}`;
  }
  await interaction.update({ content: `Handled by ${interaction.user}: **${result}**`, embeds: interaction.message.embeds, components: [] });
  return true;
}
