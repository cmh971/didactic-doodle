import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('unban')
  .setDescription('Unban a user by their ID')
  .addStringOption((o) => o.setName('user_id').setDescription('The user ID to unban').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction) {
  const id = interaction.options.getString('user_id');
  try {
    await interaction.guild.bans.remove(id, `Unbanned by ${interaction.user.tag}`);
    await interaction.reply(`♻️ Unbanned user with ID **${id}**.`);
  } catch (err) {
    await interaction.reply({
      content: `❌ Could not unban that ID (are they banned?): ${err.message}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
