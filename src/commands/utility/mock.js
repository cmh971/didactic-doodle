import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('mock')
  .setDescription('sPoNgEbOb-MoCk some text')
  .addStringOption((o) => o.setName('text').setDescription('Text to mock').setRequired(true));

export async function execute(interaction) {
  const text = interaction.options.getString('text');
  const mocked = [...text].map((c, i) => (i % 2 ? c.toUpperCase() : c.toLowerCase())).join('');
  await interaction.reply(`🧽 ${mocked}`);
}
