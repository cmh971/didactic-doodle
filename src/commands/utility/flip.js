import { SlashCommandBuilder } from 'discord.js';
import { rint, pick } from '../../util.js';

export const data = new SlashCommandBuilder().setName('flip').setDescription("Flip a coin");

export async function execute(interaction) {
  const out = (function () { return Math.random()<0.5?'🪙 Heads!':'🪙 Tails!'; })();
  await interaction.reply(String(out).slice(0, 1990));
}
