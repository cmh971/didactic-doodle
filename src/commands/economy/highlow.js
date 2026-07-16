import { SlashCommandBuilder } from 'discord.js';
import { balance, addWallet } from '../../economy/store.js';
import { eph, rint } from '../../util.js';
import { TOKEN } from '../../config.js';

export const data = new SlashCommandBuilder()
  .setName('highlow')
  .setDescription('Guess if the next number (1-100) is higher or lower than 50')
  .addStringOption((o) => o.setName('guess').setDescription('high or low').setRequired(true).addChoices({ name: 'high', value: 'high' }, { name: 'low', value: 'low' }))
  .addIntegerOption((o) => o.setName('amount').setDescription('Bet').setRequired(true).setMinValue(1));

export async function execute(interaction) {
  const g = interaction.options.getString('guess');
  const bet = interaction.options.getInteger('amount');
  if (balance(interaction.user.id).wallet < bet) return interaction.reply(eph('❌ Not enough tokens.'));
  const n = rint(1, 100);
  const win = (g === 'high' && n > 50) || (g === 'low' && n < 50);
  addWallet(interaction.user.id, win ? bet : -bet, 'highlow');
  await interaction.reply('🎚️ The number was **' + n + '**. You ' + (win ? 'WON ' : 'lost ') + TOKEN + ' ' + bet.toLocaleString() + (n === 50 ? ' (50 is a push-ish, you lost the edge)' : '') + '.');
}
