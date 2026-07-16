import { SlashCommandBuilder } from 'discord.js';
import { addWallet, balance, checkCooldown, setCooldown } from '../../economy/store.js';
import { eph, fmtDuration, rint, pick } from '../../util.js';
import { TOKEN } from '../../config.js';

const CD = 30 * 60 * 1000;
const VERBS = ["mined precious ore","struck a gem vein","hauled out gold"];

export const data = new SlashCommandBuilder().setName('mine').setDescription('⚒️ Earn UNO Tokens by mine-ing');

export async function execute(interaction) {
  const id = interaction.user.id;
  const left = checkCooldown(id, 'mine', CD);
  if (left) return interaction.reply(eph('⏳ Not yet — try again in ' + fmtDuration(left) + '.'));
  setCooldown(id, 'mine');
  const bal = balance(id);
  if (Math.random() < 0.3) { const fee = rint(1000, 20000); addWallet(id, -fee, 'mine'); return interaction.reply('⚒️ No luck this time — it cost you ' + TOKEN + ' ' + fee.toLocaleString() + '.'); }
  const amt = rint(10000, 160000);
  addWallet(id, amt, 'mine');
  return interaction.reply('⚒️ You ' + pick(VERBS) + ' and earned ' + TOKEN + ' ' + amt.toLocaleString() + '!');
}
