import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder().setName('servericon').setDescription('Show this server\'s icon');

export async function execute(interaction) {
  const g = interaction.guild;
  if (!g) return interaction.reply({ content: '❌ Use this in a server.', flags: MessageFlags.Ephemeral });
  const url = g.iconURL({ size: 1024 });
  if (!url) return interaction.reply({ content: 'This server has no icon.', flags: MessageFlags.Ephemeral });
  const embed = new EmbedBuilder().setColor(0xf1c40f).setTitle(`${g.name}'s icon`).setImage(url);
  await interaction.reply({ embeds: [embed] });
}
