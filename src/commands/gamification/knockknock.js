import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "Knock knock! / Who's there? / Lettuce. / Lettuce who? / Lettuce in, it's cold!",
  "Knock knock! / Who's there? / Boo. / Boo who? / Don't cry, it's just a joke!",
  "Knock knock! / Who's there? / Tank. / Tank who? / You're welcome!"
];

export const data = new SlashCommandBuilder()
  .setName('knockknock')
  .setDescription('Random knockknock');

export async function execute(interaction) {
  await interaction.reply('🚪 ' + pick(LINES));
}
