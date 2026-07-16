import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "Try a 5-minute doodle challenge.",
  "Learn to say \"hello\" in a new language.",
  "Reorganize one drawer.",
  "Start a quick UNO game with `/uno new`!",
  "Text someone you haven't in a while."
];

export const data = new SlashCommandBuilder()
  .setName('bored')
  .setDescription('Random bored');

export async function execute(interaction) {
  await interaction.reply('🎲 ' + pick(LINES));
}
