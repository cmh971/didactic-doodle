import { SlashCommandBuilder } from 'discord.js';
import { balance, addWallet } from '../../economy/store.js';
import { eph, pick } from '../../util.js';
import { TOKEN } from '../../config.js';

const SEGMENTS = [0, 0.5, 1, 1.5, 2, 0, 3, 5];

export const data = new SlashCommandBuilder()
  .setName('wheel')
  .setDescription('Spin the multiplier wheel with a bet')
  .addIntegerOption((o) => o.setName('amount').setDescription('Bet').setRequired(true).setMinValue(1));

export async function execute(interaction) {
  const bet = interaction.options.getInteger('amount');
  if (balance(interaction.user.id).wallet < bet) return interaction.reply(eph('❌ Not enough tokens.'));
  const mult = pick(SEGMENTS);
  const delta = Math.round(bet * mult) - bet;
  addWallet(interaction.user.id, delta, 'wheel');
  await interaction.reply('🎡 The wheel hit **x' + mult + '**! Net ' + (delta >= 0 ? '+' : '') + TOKEN + ' ' + delta.toLocaleString() + '.');
}
