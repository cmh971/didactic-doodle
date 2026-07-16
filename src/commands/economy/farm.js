import { SlashCommandBuilder } from 'discord.js';
import { addWallet, balance, checkCooldown, setCooldown } from '../../economy/store.js';
import { eph, fmtDuration, rint, pick } from '../../util.js';
import { TOKEN } from '../../config.js';

const CD = 30 * 60 * 1000;
const VERBS = ["sold a big harvest","shipped fresh crops","had a bumper yield"];

export const data = new SlashCommandBuilder().setName('farm').setDescription('🌾 Earn UNO Tokens by farm-ing');

export async function execute(interaction) {
  const id = interaction.user.id;
  const left = checkCooldown(id, 'farm', CD);
  if (left) return interaction.reply(eph('⏳ Not yet — try again in ' + fmtDuration(left) + '.'));
  setCooldown(id, 'farm');
  const bal = balance(id);
  if (Math.random() < 0.1) { const fee = rint(1000, 20000); addWallet(id, -fee, 'farm'); return interaction.reply('🌾 No luck this time — it cost you ' + TOKEN + ' ' + fee.toLocaleString() + '.'); }
  const amt = rint(12000, 140000);
  addWallet(id, amt, 'farm');
  return interaction.reply('🌾 You ' + pick(VERBS) + ' and earned ' + TOKEN + ' ' + amt.toLocaleString() + '!');
}
