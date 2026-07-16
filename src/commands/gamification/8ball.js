import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const ANSWERS = [
  'It is certain.', 'Without a doubt.', 'Yes — definitely.', 'You may rely on it.',
  'Most likely.', 'Outlook good.', 'Signs point to yes.', 'Reply hazy, try again.',
  'Ask again later.', 'Cannot predict now.', 'Don\'t count on it.', 'My reply is no.',
  'Very doubtful.', 'Absolutely not.',
];

export const data = new SlashCommandBuilder()
  .setName('8ball')
  .setDescription('Ask the magic 8-ball a question')
  .addStringOption((o) => o.setName('question').setDescription('Your question').setRequired(true));

export async function execute(interaction) {
  const q = interaction.options.getString('question');
  await interaction.reply(`🎱 **Q:** ${q}\n**A:** ${pick(ANSWERS)}`);
}
