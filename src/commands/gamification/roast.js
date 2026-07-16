import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

// Playful, light-hearted only — no slurs or genuinely mean content.
const ROASTS = [
  'you stack +4s like you\'re paying off a debt. 😏',
  'you call UNO so quietly even you don\'t hear it.',
  'your bluffing face is an open book with the cover torn off.',
  'you draw cards like you\'re collecting them as a hobby.',
  'you\'re the reason the "no mercy" rule exists.',
  'your luck rolled out of bed and went back to sleep.',
];

export const data = new SlashCommandBuilder()
  .setName('roast')
  .setDescription('Get a playful, light-hearted roast')
  .addUserOption((o) => o.setName('user').setDescription('Who to (gently) roast'));

export async function execute(interaction) {
  const target = interaction.options.getUser('user') ?? interaction.user;
  await interaction.reply(`🔥 ${target}, ${pick(ROASTS)}`);
}
