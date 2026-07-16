import { SlashCommandBuilder } from 'discord.js';
import { addWallet, balance, checkCooldown, setCooldown } from '../../economy/store.js';
import { eph, fmtDuration, rint, pick } from '../../util.js';
import { TOKEN } from '../../config.js';

const CD = 15 * 60 * 1000;
const VERBS = ["chopped & sold lumber","cleared a forest plot","split a big log"];

export const data = new SlashCommandBuilder().setName('chop').setDescription('🪓 Earn UNO Tokens by chop-ing');

export async function execute(interaction) {
  const id = interaction.user.id;
  const left = checkCooldown(id, 'chop', CD);
  if (left) return interaction.reply(eph('⏳ Not yet — try again in ' + fmtDuration(left) + '.'));
  setCooldown(id, 'chop');
  const bal = balance(id);
  if (Math.random() < 0.15) { const fee = rint(1000, 20000); addWallet(id, -fee, 'chop'); return interaction.reply('🪓 No luck this time — it cost you ' + TOKEN + ' ' + fee.toLocaleString() + '.'); }
  const amt = rint(4000, 70000);
  addWallet(id, amt, 'chop');
  return interaction.reply('🪓 You ' + pick(VERBS) + ' and earned ' + TOKEN + ' ' + amt.toLocaleString() + '!');
}
