import { SlashCommandBuilder } from 'discord.js';
import { rint, pick } from '../../util.js';

export const data = new SlashCommandBuilder().setName('randomname').setDescription("Generate a random name");

export async function execute(interaction) {
  const out = (function () { return '🪪 ' + pick(['Alex','Jordan','Riley','Sam','Taylor','Casey','Morgan','Jamie']) + ' ' + pick(['Stone','Vale','Reed','Frost','Quinn','Hart','Lane','Cruz']); })();
  await interaction.reply(String(out).slice(0, 1990));
}
