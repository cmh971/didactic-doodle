import { SlashCommandBuilder } from 'discord.js';
import { addWallet, balance, checkCooldown, setCooldown } from '../../economy/store.js';
import { eph, fmtDuration, rint, pick } from '../../util.js';
import { TOKEN } from '../../config.js';

const CD = 20 * 60 * 1000;
const VERBS = ["bagged some game","tracked a rare beast","had a good hunt"];

export const data = new SlashCommandBuilder().setName('hunt').setDescription('🏹 Earn UNO Tokens by hunt-ing');

export async function execute(interaction) {
  const id = interaction.user.id;
  const left = checkCooldown(id, 'hunt', CD);
  if (left) return interaction.reply(eph('⏳ Not yet — try again in ' + fmtDuration(left) + '.'));
  setCooldown(id, 'hunt');
  const bal = balance(id);
  if (Math.random() < 0.25) { const fee = rint(1000, 20000); addWallet(id, -fee, 'hunt'); return interaction.reply('🏹 No luck this time — it cost you ' + TOKEN + ' ' + fee.toLocaleString() + '.'); }
  const amt = rint(8000, 110000);
  addWallet(id, amt, 'hunt');
  return interaction.reply('🏹 You ' + pick(VERBS) + ' and earned ' + TOKEN + ' ' + amt.toLocaleString() + '!');
}
