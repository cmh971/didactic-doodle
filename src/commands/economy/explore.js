import { SlashCommandBuilder } from 'discord.js';
import { addWallet, balance, checkCooldown, setCooldown } from '../../economy/store.js';
import { eph, fmtDuration, rint, pick } from '../../util.js';
import { TOKEN } from '../../config.js';

const CD = 45 * 60 * 1000;
const VERBS = ["charted new lands","found hidden treasure","mapped a cave"];

export const data = new SlashCommandBuilder().setName('explore').setDescription('🧭 Earn UNO Tokens by explore-ing');

export async function execute(interaction) {
  const id = interaction.user.id;
  const left = checkCooldown(id, 'explore', CD);
  if (left) return interaction.reply(eph('⏳ Not yet — try again in ' + fmtDuration(left) + '.'));
  setCooldown(id, 'explore');
  const bal = balance(id);
  if (Math.random() < 0.4) { const fee = rint(1000, 20000); addWallet(id, -fee, 'explore'); return interaction.reply('🧭 No luck this time — it cost you ' + TOKEN + ' ' + fee.toLocaleString() + '.'); }
  const amt = rint(40000, 350000);
  addWallet(id, amt, 'explore');
  return interaction.reply('🧭 You ' + pick(VERBS) + ' and earned ' + TOKEN + ' ' + amt.toLocaleString() + '!');
}
