import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('purge')
  .setDescription('Bulk-delete recent messages in this channel')
  .addIntegerOption((o) =>
    o.setName('amount').setDescription('How many messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
  const amount = interaction.options.getInteger('amount');
  try {
    const deleted = await interaction.channel.bulkDelete(amount, true);
    await interaction.reply({
      content: `🧹 Deleted **${deleted.size}** message(s). (Messages older than 14 days can't be bulk-deleted.)`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    await interaction.reply({ content: `❌ Could not purge: ${err.message}`, flags: MessageFlags.Ephemeral });
  }
}
