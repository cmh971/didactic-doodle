import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('serverinfo')
  .setDescription('Show information about this server');

export async function execute(interaction) {
  const g = interaction.guild;
  const owner = await g.fetchOwner();

  const embed = new EmbedBuilder()
    .setTitle(`🏠 ${g.name}`)
    .setColor(0x57f287)
    .setThumbnail(g.iconURL({ size: 256 }))
    .addFields(
      { name: 'Owner', value: owner.user.tag, inline: true },
      { name: 'Members', value: String(g.memberCount), inline: true },
      { name: 'Channels', value: String(g.channels.cache.size), inline: true },
      { name: 'Roles', value: String(g.roles.cache.size), inline: true },
      { name: 'Boosts', value: String(g.premiumSubscriptionCount ?? 0), inline: true },
      { name: 'Created', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:R>`, inline: true },
    );

  await interaction.reply({ embeds: [embed] });
}
