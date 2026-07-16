import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const MOVES = { rock: '🪨', paper: '📄', scissors: '✂️' };
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

export const data = new SlashCommandBuilder()
  .setName('rps')
  .setDescription('Play rock-paper-scissors against the bot')
  .addStringOption((o) =>
    o.setName('move').setDescription('Your move').setRequired(true).addChoices(
      { name: 'Rock', value: 'rock' },
      { name: 'Paper', value: 'paper' },
      { name: 'Scissors', value: 'scissors' },
    ),
  );

export async function execute(interaction) {
  const you = interaction.options.getString('move');
  const bot = pick(Object.keys(MOVES));
  let result;
  if (you === bot) result = '🤝 It\'s a tie!';
  else if (BEATS[you] === bot) result = '🎉 You win!';
  else result = '😢 You lose!';
  await interaction.reply(`You: ${MOVES[you]}  vs  Bot: ${MOVES[bot]}\n${result}`);
}
