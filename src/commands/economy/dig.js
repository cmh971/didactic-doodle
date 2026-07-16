import { SlashCommandBuilder } from 'discord.js';
import { addWallet, balance, checkCooldown, setCooldown } from '../../economy/store.js';
import { eph, fmtDuration, rint, pick } from '../../util.js';
import { TOKEN } from '../../config.js';

const CD = 20 * 60 * 1000;
const VERBS = ["dug up buried coins","unearthed a relic","found a stash"];

export const data = new SlashCommandBuilder().setName('dig').setDescription('⛏️ Earn UNO Tokens by dig-ing');

export async function execute(interaction) {
  const id = interaction.user.id;
  const left = checkCooldown(id, 'dig', CD);
  if (left) return interaction.reply(eph('⏳ Not yet — try again in ' + fmtDuration(left) + '.'));
  setCooldown(id, 'dig');
  const bal = balance(id);
  if (Math.random() < 0.25) { const fee = rint(1000, 20000); addWallet(id, -fee, 'dig'); return interaction.reply('⛏️ No luck this time — it cost you ' + TOKEN + ' ' + fee.toLocaleString() + '.'); }
  const amt = rint(6000, 120000);
  addWallet(id, amt, 'dig');
  return interaction.reply('⛏️ You ' + pick(VERBS) + ' and earned ' + TOKEN + ' ' + amt.toLocaleString() + '!');
}
