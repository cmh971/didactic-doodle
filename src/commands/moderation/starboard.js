import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { configureStarboard } from '../../features/starboard.js';

export const data = new SlashCommandBuilder()
  .setName('starboard')
  .setDescription('Configure the ⭐ starboard')
  .addChannelOption((o) => o.setName('channel').setDescription('Starboard channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
  .addIntegerOption((o) => o.setName('threshold').setDescription('Stars needed (default 3)').setMinValue(1))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const channel = interaction.options.getChannel('channel');
  const threshold = interaction.options.getInteger('threshold') ?? 3;
  configureStarboard(interaction.guildId, channel.id, threshold);
  await interaction.reply({ content: `⭐ Starboard set to ${channel} with a threshold of **${threshold}**.`, flags: MessageFlags.Ephemeral });
}
