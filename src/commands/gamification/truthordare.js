import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const TRUTHS = [
  'What\'s the most competitive you\'ve ever been over a board game?',
  'Have you ever rage-quit a game? Which one?',
  'What\'s a small thing that makes you irrationally happy?',
  'Who in this server would win at UNO and why?',
  'What\'s your most-used emoji?',
];
const DARES = [
  'Type your next message in ALL CAPS.',
  'Use `/mock` on your own last sentence.',
  'Send a UNO pun in chat.',
  'Change your nickname to a card name for 10 minutes.',
  'Compliment the last person who messaged.',
];

export const data = new SlashCommandBuilder()
  .setName('truthordare')
  .setDescription('Get a truth or a dare')
  .addStringOption((o) =>
    o.setName('choice').setDescription('truth or dare').addChoices(
      { name: 'truth', value: 'truth' },
      { name: 'dare', value: 'dare' },
    ),
  );

export async function execute(interaction) {
  const choice = interaction.options.getString('choice') ?? (Math.random() < 0.5 ? 'truth' : 'dare');
  const text = choice === 'truth' ? pick(TRUTHS) : pick(DARES);
  await interaction.reply(`${choice === 'truth' ? '💬 **Truth:**' : '🔥 **Dare:**'} ${text}`);
}
