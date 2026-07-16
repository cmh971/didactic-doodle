import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('purgeuser')
  .setDescription('Delete a specific user\'s recent messages in this channel')
  .addUserOption((o) => o.setName('user').setDescription('Whose messages to purge').setRequired(true))
  .addIntegerOption((o) => o.setName('amount').setDescription('How many recent messages to scan (max 100)').setMinValue(1).setMaxValue(100))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
  const user = interaction.options.getUser('user');
  const scan = interaction.options.getInteger('amount') ?? 100;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const messages = await interaction.channel.messages.fetch({ limit: scan });
    const theirs = messages.filter((m) => m.author.id === user.id && Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000);
    const deleted = await interaction.channel.bulkDelete(theirs, true);
    await interaction.editReply(`🧹 Deleted **${deleted.size}** message(s) from **${user.tag}**.`);
  } catch (err) {
    await interaction.editReply(`❌ Could not purge: ${err.message}`);
  }
}
