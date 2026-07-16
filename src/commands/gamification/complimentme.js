import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "You have impeccable taste.",
  "Your energy is contagious.",
  "You're sharper than you think.",
  "People feel better around you.",
  "You're doing great — really."
];

export const data = new SlashCommandBuilder()
  .setName('complimentme')
  .setDescription('Random complimentme');

export async function execute(interaction) {
  await interaction.reply('💖 ' + pick(LINES));
}
