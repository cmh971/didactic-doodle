import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('unlock')
  .setDescription('Unlock this channel so @everyone can send messages again')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction) {
  try {
    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
    await interaction.reply('🔓 Channel unlocked.');
  } catch (err) {
    await interaction.reply({ content: `❌ Could not unlock: ${err.message}`, flags: MessageFlags.Ephemeral });
  }
}
