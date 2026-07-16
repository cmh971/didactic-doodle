import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Kick a member from the server')
  .addUserOption((o) => o.setName('user').setDescription('Member to kick').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason for the kick'))
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers);

export async function execute(interaction) {
  const member = interaction.options.getMember('user');
  const reason = interaction.options.getString('reason') ?? 'No reason provided';

  if (!member) {
    return interaction.reply({ content: '❌ That user is not in this server.', flags: MessageFlags.Ephemeral });
  }

  try {
    await member.kick(`${reason} (by ${interaction.user.tag})`);
    await interaction.reply(`👢 Kicked **${member.user.tag}**. Reason: ${reason}`);
  } catch (err) {
    await interaction.reply({ content: `❌ Could not kick that user: ${err.message}`, flags: MessageFlags.Ephemeral });
  }
}
