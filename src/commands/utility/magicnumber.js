import { SlashCommandBuilder } from 'discord.js';
import { rint, pick } from '../../util.js';

export const data = new SlashCommandBuilder().setName('magicnumber').setDescription("A random magic number 1-1000");

export async function execute(interaction) {
  const out = (function () { return '🔢 ' + rint(1,1000); })();
  await interaction.reply(String(out).slice(0, 1990));
}
