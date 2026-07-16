import { SlashCommandBuilder } from 'discord.js';
import { addWallet } from '../../economy/store.js';
import { rint } from '../../util.js';
import { TOKEN } from '../../config.js';

export const data = new SlashCommandBuilder()
  .setName('guess')
  .setDescription('Guess a number 1-100. Exact wins big tokens, close wins some!')
  .addIntegerOption((o) => o.setName('number').setDescription('Your guess (1-100)').setRequired(true).setMinValue(1).setMaxValue(100));

export async function execute(interaction) {
  const guess = interaction.options.getInteger('number');
  const answer = rint(1, 100);
  const diff = Math.abs(guess - answer);

  let reward = 0;
  let msg;
  if (diff === 0) {
    reward = 250_000;
    msg = `🎯 EXACT! The number was **${answer}**!`;
  } else if (diff <= 3) {
    reward = 50_000;
    msg = `🔥 So close! It was **${answer}**.`;
  } else if (diff <= 10) {
    reward = 10_000;
    msg = `👍 Not bad — it was **${answer}**.`;
  } else {
    msg = `❌ It was **${answer}**. Better luck next time!`;
  }
  if (reward) addWallet(interaction.user.id, reward);
  await interaction.reply(`${msg}${reward ? `\nYou won ${TOKEN} **${reward.toLocaleString()}**!` : ''}`);
}
