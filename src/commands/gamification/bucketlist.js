import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';
const LINES = [
  "See the northern lights.",
  "Learn to cook one signature dish.",
  "Win a UNO tournament.",
  "Visit a country you can't pronounce.",
  "Watch a sunrise and a sunset same day."
];
export const data = new SlashCommandBuilder().setName('bucketlist').setDescription('Random bucketlist');
export async function execute(interaction) { await interaction.reply('🪣 ' + pick(LINES)); }
