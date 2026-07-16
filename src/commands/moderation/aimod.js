import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { setAimod, getAimod } from '../../features/aimod.js';

export const data = new SlashCommandBuilder()
  .setName('aimod')
  .setDescription('AI watch mode: AI flags suspicious messages for your approval (it never acts on its own)')
  .addBooleanOption((o) => o.setName('enabled').setDescription('Turn AI watch mode on/off').setRequired(true))
  .addChannelOption((o) => o.setName('channel').setDescription('Mod-log channel for flags').addChannelTypes(ChannelType.GuildText))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const enabled = interaction.options.getBoolean('enabled');
  const channel = interaction.options.getChannel('channel');
  const current = getAimod(interaction.guildId);
  if (enabled && !channel && !current.channel) {
    return interaction.reply({ content: '❌ Provide a `channel` for the flags to be sent to.', flags: MessageFlags.Ephemeral });
  }
  setAimod(interaction.guildId, { enabled, ...(channel ? { channel: channel.id } : {}) });
  await interaction.reply({
    content: enabled
      ? `🤖 **AI watch mode ON.** I'll flag suspicious messages to ${channel ? channel : `<#${current.channel}>`} with action buttons. I will **never** act on my own — a human must approve.`
      : '🤖 AI watch mode **OFF**.',
    flags: MessageFlags.Ephemeral,
  });
}
