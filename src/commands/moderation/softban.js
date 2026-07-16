import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('softban')
  .setDescription('Ban then immediately unban a user to wipe their recent messages')
  .addUserOption((o) => o.setName('user').setDescription('User to softban').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason'))
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction) {
  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  try {
    await interaction.guild.bans.create(user.id, { deleteMessageSeconds: 7 * 24 * 60 * 60, reason: `Softban: ${reason}` });
    await interaction.guild.bans.remove(user.id, 'Softban (auto-unban)');
    await interaction.reply(`🧼 Softbanned **${user.tag}** — last 7 days of their messages wiped. Reason: ${reason}`);
  } catch (err) {
    await interaction.reply({ content: `❌ Could not softban: ${err.message}`, flags: MessageFlags.Ephemeral });
  }
}
