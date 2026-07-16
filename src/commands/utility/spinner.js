import { SlashCommandBuilder } from 'discord.js';
import { rint, pick } from '../../util.js';

export const data = new SlashCommandBuilder().setName('spinner').setDescription("Spin the wheel of fate");

export async function execute(interaction) {
  const out = (function () { return '🎡 The wheel landed on: **' + pick(['Win','Lose','Spin again','Jackpot','Nothing','Bonus']) + '**'; })();
  await interaction.reply(String(out).slice(0, 1990));
}
