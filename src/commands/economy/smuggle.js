import { SlashCommandBuilder } from 'discord.js';
import { addWallet, balance, checkCooldown, setCooldown } from '../../economy/store.js';
import { eph, fmtDuration, rint, pick } from '../../util.js';
import { TOKEN } from '../../config.js';

const CD = 60 * 60 * 1000;
const VERBS = ["ran contraband","moved hot cargo","dodged the patrol"];

export const data = new SlashCommandBuilder().setName('smuggle').setDescription('📦 Earn UNO Tokens by smuggle-ing');

export async function execute(interaction) {
  const id = interaction.user.id;
  const left = checkCooldown(id, 'smuggle', CD);
  if (left) return interaction.reply(eph('⏳ Not yet — try again in ' + fmtDuration(left) + '.'));
  setCooldown(id, 'smuggle');
  const bal = balance(id);
  if (Math.random() < 0.5) { const fee = rint(1000, 20000); addWallet(id, -fee, 'smuggle'); return interaction.reply('📦 No luck this time — it cost you ' + TOKEN + ' ' + fee.toLocaleString() + '.'); }
  const amt = rint(80000, 600000);
  addWallet(id, amt, 'smuggle');
  return interaction.reply('📦 You ' + pick(VERBS) + ' and earned ' + TOKEN + ' ' + amt.toLocaleString() + '!');
}
