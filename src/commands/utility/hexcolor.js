import { SlashCommandBuilder } from 'discord.js';
import { rint, pick } from '../../util.js';

export const data = new SlashCommandBuilder().setName('hexcolor').setDescription("Generate a random hex color");

export async function execute(interaction) {
  const out = (function () { return '🎨 #' + Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0').toUpperCase(); })();
  await interaction.reply(String(out).slice(0, 1990));
}
