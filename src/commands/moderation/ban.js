import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a member from the server')
  .addUserOption((o) => o.setName('user').setDescription('Member to ban').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason for the ban'))
  .addIntegerOption((o) =>
    o.setName('delete_days').setDescription('Delete this many days of their messages (0-7)').setMinValue(0).setMaxValue(7),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction) {
  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  const days = interaction.options.getInteger('delete_days') ?? 0;

  try {
    await interaction.guild.members.ban(user.id, {
      reason: `${reason} (by ${interaction.user.tag})`,
      deleteMessageSeconds: days * 86400,
    });
    await interaction.reply(`🔨 Banned **${user.tag}**. Reason: ${reason}`);
  } catch (err) {
    await interaction.reply({ content: `❌ Could not ban that user: ${err.message}`, flags: MessageFlags.Ephemeral });
  }
}
