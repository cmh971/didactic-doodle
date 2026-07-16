import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "Who here would survive a zombie apocalypse?",
  "Who is most likely to become famous?",
  "Who would win in a debate?",
  "Who has the best taste in music?",
  "Who is secretly a genius?"
];

export const data = new SlashCommandBuilder()
  .setName('paranoia')
  .setDescription('Random paranoia');

export async function execute(interaction) {
  await interaction.reply('😳 ' + pick(LINES));
}
