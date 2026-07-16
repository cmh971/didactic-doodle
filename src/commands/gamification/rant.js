import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';
const LINES = [
  "Why do socks disappear in the laundry?!",
  "Loading screens are a personal attack.",
  "Why is there always one stair that isn't there?",
  "Group chats that ping at 3am should be illegal.",
  "Stickers that won't peel cleanly — pure evil."
];
export const data = new SlashCommandBuilder().setName('rant').setDescription('Random rant');
export async function execute(interaction) { await interaction.reply('😤 ' + pick(LINES)); }
