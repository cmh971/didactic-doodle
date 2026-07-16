import { SlashCommandBuilder } from 'discord.js';
import { rint, pick } from '../../util.js';

export const data = new SlashCommandBuilder().setName('percent').setDescription("Get a random percentage");

export async function execute(interaction) {
  const out = (function () { return '📊 ' + rint(0,100) + '%'; })();
  await interaction.reply(String(out).slice(0, 1990));
}
