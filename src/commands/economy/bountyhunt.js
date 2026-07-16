import { SlashCommandBuilder } from 'discord.js';
import { addWallet, balance, checkCooldown, setCooldown } from '../../economy/store.js';
import { eph, fmtDuration, rint, pick } from '../../util.js';
import { TOKEN } from '../../config.js';

const CD = 60 * 60 * 1000;
const VERBS = ["collected a bounty","caught a fugitive","claimed a reward"];

export const data = new SlashCommandBuilder().setName('bountyhunt').setDescription('🎯 Earn UNO Tokens by bountyhunt-ing');

export async function execute(interaction) {
  const id = interaction.user.id;
  const left = checkCooldown(id, 'bountyhunt', CD);
  if (left) return interaction.reply(eph('⏳ Not yet — try again in ' + fmtDuration(left) + '.'));
  setCooldown(id, 'bountyhunt');
  const bal = balance(id);
  if (Math.random() < 0.5) { const fee = rint(1000, 20000); addWallet(id, -fee, 'bountyhunt'); return interaction.reply('🎯 No luck this time — it cost you ' + TOKEN + ' ' + fee.toLocaleString() + '.'); }
  const amt = rint(90000, 700000);
  addWallet(id, amt, 'bountyhunt');
  return interaction.reply('🎯 You ' + pick(VERBS) + ' and earned ' + TOKEN + ' ' + amt.toLocaleString() + '!');
}
