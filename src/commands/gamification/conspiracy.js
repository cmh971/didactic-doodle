import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "Birds are government drones. 🐦",
  "The moon is closer than they say. 🌙",
  "Pigeons file taxes. 📁",
  "Wi-Fi is just very small ghosts. 👻",
  "Mondays are a social construct. 📅"
];

export const data = new SlashCommandBuilder()
  .setName('conspiracy')
  .setDescription('Random conspiracy');

export async function execute(interaction) {
  await interaction.reply('👽 ' + pick(LINES));
}
