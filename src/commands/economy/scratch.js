import { SlashCommandBuilder } from 'discord.js';
import { balance, addWallet } from '../../economy/store.js';
import { eph, pick } from '../../util.js';
import { TOKEN } from '../../config.js';

const COST = 15000;
const SYMS = ['🍒','💎','⭐','🔔','🍀'];

export const data = new SlashCommandBuilder().setName('scratch').setDescription('Buy a 15k scratch card — match 3 to win big');

export async function execute(interaction) {
  if (balance(interaction.user.id).wallet < COST) return interaction.reply(eph('❌ A scratch card costs ' + TOKEN + ' ' + COST.toLocaleString() + '.'));
  addWallet(interaction.user.id, -COST, 'scratch');
  const cells = [pick(SYMS), pick(SYMS), pick(SYMS)];
  const three = cells[0] === cells[1] && cells[1] === cells[2];
  const two = new Set(cells).size === 2;
  const prize = three ? 300000 : two ? 25000 : 0;
  if (prize) addWallet(interaction.user.id, prize, 'scratch');
  await interaction.reply('🎫 ' + cells.join(' ') + ' — ' + (prize ? 'You won ' + TOKEN + ' ' + prize.toLocaleString() + '!' : 'No match, better luck next time!'));
}
