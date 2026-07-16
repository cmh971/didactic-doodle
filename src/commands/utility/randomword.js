import { SlashCommandBuilder } from 'discord.js';
import { rint, pick } from '../../util.js';

export const data = new SlashCommandBuilder().setName('randomword').setDescription("Get a random word");

export async function execute(interaction) {
  const out = (function () { return '🔤 ' + pick(['serendipity','nebula','quasar','lumen','zephyr','cascade','ember','pixel','vortex','aurora']); })();
  await interaction.reply(String(out).slice(0, 1990));
}
