import { SlashCommandBuilder } from 'discord.js';
import { rint, pick } from '../../util.js';

export const data = new SlashCommandBuilder().setName('ball').setDescription("Bounce the chaos ball");

export async function execute(interaction) {
  const out = (function () { return pick(['🟢 GO for it!','🔴 Stop right there.','🟡 Proceed with caution.','🔵 Sleep on it.']); })();
  await interaction.reply(String(out).slice(0, 1990));
}
