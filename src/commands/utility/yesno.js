import { SlashCommandBuilder } from 'discord.js';
import { rint, pick } from '../../util.js';

export const data = new SlashCommandBuilder().setName('yesno').setDescription("Ask the bot yes or no");

export async function execute(interaction) {
  const out = (function () { return pick(['✅ Yes.','❌ No.','🤔 Maybe.','💯 Definitely.','🙅 Absolutely not.']); })();
  await interaction.reply(String(out).slice(0, 1990));
}
