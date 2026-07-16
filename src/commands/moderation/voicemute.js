import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('voicemute')
  .setDescription('Toggle server voice-mute on a member')
  .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason'))
  .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers);

export async function execute(interaction) {
  const member = interaction.options.getMember('user');
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  if (!member) return interaction.reply({ content: '❌ That user is not in this server.', flags: MessageFlags.Ephemeral });
  if (!member.voice?.channel) return interaction.reply({ content: '❌ They are not in a voice channel.', flags: MessageFlags.Ephemeral });
  try {
    const newState = !member.voice.serverMute;
    await member.voice.setMute(newState, `${reason} (by ${interaction.user.tag})`);
    await interaction.reply(`${newState ? '🔇 Muted' : '🔊 Unmuted'} **${member.user.tag}** in voice. Reason: ${reason}`);
  } catch (err) {
    await interaction.reply({ content: `❌ Could not toggle mute: ${err.message}`, flags: MessageFlags.Ephemeral });
  }
}
