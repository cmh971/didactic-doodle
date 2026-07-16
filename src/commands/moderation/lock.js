import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('lock')
  .setDescription('Lock this channel so @everyone can\'t send messages')
  .addStringOption((o) => o.setName('reason').setDescription('Reason'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction) {
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  try {
    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
    await interaction.reply(`🔒 Channel locked. Reason: ${reason}`);
  } catch (err) {
    await interaction.reply({ content: `❌ Could not lock: ${err.message}`, flags: MessageFlags.Ephemeral });
  }
}
