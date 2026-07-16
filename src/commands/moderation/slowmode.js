import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('slowmode')
  .setDescription('Set slowmode (rate limit) for this channel')
  .addIntegerOption((o) =>
    o.setName('seconds').setDescription('Seconds between messages (0 to disable)').setRequired(true).setMinValue(0).setMaxValue(21600),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction) {
  const seconds = interaction.options.getInteger('seconds');
  try {
    await interaction.channel.setRateLimitPerSecond(seconds, `Set by ${interaction.user.tag}`);
    await interaction.reply(seconds === 0 ? '🐢 Slowmode disabled.' : `🐢 Slowmode set to **${seconds}s**.`);
  } catch (err) {
    await interaction.reply({ content: `❌ Could not set slowmode: ${err.message}`, flags: MessageFlags.Ephemeral });
  }
}
