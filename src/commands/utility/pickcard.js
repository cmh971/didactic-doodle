import { SlashCommandBuilder } from 'discord.js';
import { rint, pick } from '../../util.js';

export const data = new SlashCommandBuilder().setName('pickcard').setDescription("Draw a random UNO card");

export async function execute(interaction) {
  const out = (function () { return '🃏 ' + pick(['Red','Green','Blue','Yellow']) + ' ' + pick(['0','1','2','3','4','5','6','7','8','9','Skip','Reverse','+2']); })();
  await interaction.reply(String(out).slice(0, 1990));
}
