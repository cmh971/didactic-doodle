import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "I used to be a banker but I lost interest.",
  "Time flies like an arrow; fruit flies like a banana.",
  "I'm reading a book on anti-gravity — can't put it down.",
  "Broken pencils are pointless.",
  "I wondered why the ball kept getting bigger. Then it hit me."
];

export const data = new SlashCommandBuilder()
  .setName('pun')
  .setDescription('Random pun');

export async function execute(interaction) {
  await interaction.reply('😹 ' + pick(LINES));
}
