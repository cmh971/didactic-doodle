import { SlashCommandBuilder } from 'discord.js';
import { rint, pick } from '../../util.js';

export const data = new SlashCommandBuilder().setName('randomcountry').setDescription("Pick a random country");

export async function execute(interaction) {
  const out = (function () { return '🌍 ' + pick(['Japan','Brazil','Norway','Kenya','Canada','Italy','Thailand','Morocco','Peru','New Zealand']); })();
  await interaction.reply(String(out).slice(0, 1990));
}
