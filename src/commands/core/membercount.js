import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder().setName('membercount').setDescription('Show how many members are in this server');

export async function execute(interaction) {
  const g = interaction.guild;
  if (!g) return interaction.reply({ content: '❌ Use this in a server.', flags: MessageFlags.Ephemeral });
  const bots = g.members.cache.filter((m) => m.user.bot).size;
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`👥 ${g.name}`)
    .addFields(
      { name: 'Total', value: String(g.memberCount), inline: true },
      { name: 'Bots (cached)', value: String(bots), inline: true },
      { name: 'Boosts', value: String(g.premiumSubscriptionCount ?? 0), inline: true },
    )
    .setThumbnail(g.iconURL({ size: 256 }));
  await interaction.reply({ embeds: [embed] });
}
