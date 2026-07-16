import { SlashCommandBuilder } from 'discord.js';
import { rint, pick } from '../../util.js';

export const data = new SlashCommandBuilder().setName('rpsls').setDescription("Rock Paper Scissors Lizard Spock vs bot");

export async function execute(interaction) {
  const out = (function () { return '🖖 The bot chose **' + pick(['Rock','Paper','Scissors','Lizard','Spock']) + '**!'; })();
  await interaction.reply(String(out).slice(0, 1990));
}
