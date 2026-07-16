import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const QUOTES = [
  '"The best way to predict the future is to invent it." — Alan Kay',
  '"Stay hungry, stay foolish." — Steve Jobs',
  '"It always seems impossible until it\'s done." — Nelson Mandela',
  '"Whether you think you can or you can\'t, you\'re right." — Henry Ford',
  '"Do or do not. There is no try." — Yoda',
  '"Fortune favors the bold." — Latin proverb',
  '"A wild +4 a day keeps your friends away." — Ancient UNO wisdom',
];

export const data = new SlashCommandBuilder().setName('quote').setDescription('Get an inspirational quote');

export async function execute(interaction) {
  await interaction.reply(`💬 ${pick(QUOTES)}`);
}
