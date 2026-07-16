import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  'you light up every channel you\'re in. ✨',
  'your UNO strategy is genuinely impressive. 🧠',
  'you\'re the kind of person people are glad to have around. 💛',
  'your vibe is immaculate today. 😎',
  'you make this server better just by being here. 🌟',
  'you\'re smarter than you give yourself credit for. 💪',
];

export const data = new SlashCommandBuilder()
  .setName('compliment')
  .setDescription('Send someone a nice compliment')
  .addUserOption((o) => o.setName('user').setDescription('Who to compliment'));

export async function execute(interaction) {
  const target = interaction.options.getUser('user') ?? interaction.user;
  await interaction.reply(`💖 Hey ${target}, ${pick(LINES)}`);
}
