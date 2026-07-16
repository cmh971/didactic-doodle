import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { getSnipe } from '../../features/snipe.js';

export const data = new SlashCommandBuilder()
  .setName('snipe')
  .setDescription('Show the most recently deleted message in this channel')
  .addIntegerOption((o) => o.setName('index').setDescription('How far back (0 = latest)').setMinValue(0).setMaxValue(4))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
  const idx = interaction.options.getInteger('index') ?? 0;
  const sniped = getSnipe(interaction.channelId, idx);
  if (!sniped) return interaction.reply({ content: '🤷 Nothing to snipe here.', flags: MessageFlags.Ephemeral });

  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setAuthor({ name: sniped.author, iconURL: sniped.avatar || undefined })
    .setDescription(sniped.content || '*(no text)*')
    .setFooter({ text: 'Deleted message' })
    .setTimestamp(sniped.at);
  if (sniped.attachment) embed.setImage(sniped.attachment);
  await interaction.reply({ embeds: [embed] });
}
