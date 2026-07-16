import { SlashCommandBuilder } from 'discord.js';
import { balance, addWallet } from '../../economy/store.js';
import { eph, rint } from '../../util.js';
import { TOKEN } from '../../config.js';

export const data = new SlashCommandBuilder()
  .setName('roulette')
  .setDescription('Bet on roulette: red, black, green, or a number')
  .addStringOption((o) => o.setName('bet').setDescription('"red", "black", "green", or a number 0-36').setRequired(true))
  .addIntegerOption((o) => o.setName('amount').setDescription('Bet amount').setRequired(true).setMinValue(1));

export async function execute(interaction) {
  const choice = interaction.options.getString('bet').toLowerCase().trim();
  const amount = interaction.options.getInteger('amount');
  if (balance(interaction.user.id).wallet < amount) return interaction.reply(eph('❌ You don\'t have that many tokens.'));

  const n = rint(0, 36);
  const color = n === 0 ? 'green' : n % 2 === 0 ? 'black' : 'red';

  let mult = -1;
  if ((choice === 'red' || choice === 'black') && choice === color) mult = 1;
  else if (choice === 'green' && color === 'green') mult = 14;
  else if (/^\d+$/.test(choice) && parseInt(choice, 10) === n) mult = 35;

  const delta = amount * mult;
  addWallet(interaction.user.id, delta);
  const emoji = color === 'red' ? '🔴' : color === 'black' ? '⚫' : '🟢';
  await interaction.reply(
    `🎡 The ball landed on ${emoji} **${n} (${color})**.\n` +
      (delta > 0
        ? `🎉 You won ${TOKEN} **${delta.toLocaleString()}**!`
        : `😢 You lost ${TOKEN} **${amount.toLocaleString()}**.`),
  );
}
