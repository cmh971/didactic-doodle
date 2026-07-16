import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('voicekick')
  .setDescription('Disconnect a member from their voice channel')
  .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers);

export async function execute(interaction) {
  const member = interaction.options.getMember('user');
  if (!member) return interaction.reply({ content: '❌ That user is not in this server.', flags: MessageFlags.Ephemeral });
  if (!member.voice?.channel) return interaction.reply({ content: '❌ They are not in a voice channel.', flags: MessageFlags.Ephemeral });
  try {
    await member.voice.disconnect(`Voice-kicked by ${interaction.user.tag}`);
    await interaction.reply(`🔌 Disconnected **${member.user.tag}** from voice.`);
  } catch (err) {
    await interaction.reply({ content: `❌ Could not disconnect: ${err.message}`, flags: MessageFlags.Ephemeral });
  }
}
