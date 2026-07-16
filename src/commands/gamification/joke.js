import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const JOKES = [
  'Why did the UNO player bring a ladder? To reach the high cards!',
  'I told my +4 card a secret. Now everyone has to draw conclusions.',
  'Why was the Reverse card sad? It kept going back to its ex.',
  'I\'m reading a book on anti-gravity. It\'s impossible to put down.',
  'Why don\'t skeletons play UNO? They don\'t have the guts.',
  'I bought shoes from a drug dealer. I don\'t know what he laced them with, but I was tripping all day.',
  'Parallel lines have so much in common. Too bad they\'ll never meet.',
  'Why did the Skip card get a promotion? It always skips the line.',
];

export const data = new SlashCommandBuilder().setName('joke').setDescription('Get a random joke');

export async function execute(interaction) {
  await interaction.reply(`😂 ${pick(JOKES)}`);
}
