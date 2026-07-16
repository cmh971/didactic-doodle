import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "A day on Venus is longer than its year.",
  "Neutron stars can spin 600 times per second.",
  "There are more stars than grains of sand on Earth.",
  "Jupiter's Great Red Spot is a storm older than telescopes.",
  "Space is completely silent."
];

export const data = new SlashCommandBuilder()
  .setName('spacefact')
  .setDescription('Random spacefact');

export async function execute(interaction) {
  await interaction.reply('🚀 ' + pick(LINES));
}
