import { SlashCommandBuilder } from 'discord.js';
import { addWallet, balance, checkCooldown, setCooldown } from '../../economy/store.js';
import { eph, fmtDuration, rint, pick } from '../../util.js';
import { TOKEN } from '../../config.js';

const CD = 20 * 60 * 1000;
const VERBS = ["reeled in a big catch","hooked a rare fish","netted a haul"];

export const data = new SlashCommandBuilder().setName('fish').setDescription('🎣 Earn UNO Tokens by fish-ing');

export async function execute(interaction) {
  const id = interaction.user.id;
  const left = checkCooldown(id, 'fish', CD);
  if (left) return interaction.reply(eph('⏳ Not yet — try again in ' + fmtDuration(left) + '.'));
  setCooldown(id, 'fish');
  const bal = balance(id);
  if (Math.random() < 0.2) { const fee = rint(1000, 20000); addWallet(id, -fee, 'fish'); return interaction.reply('🎣 No luck this time — it cost you ' + TOKEN + ' ' + fee.toLocaleString() + '.'); }
  const amt = rint(5000, 90000);
  addWallet(id, amt, 'fish');
  return interaction.reply('🎣 You ' + pick(VERBS) + ' and earned ' + TOKEN + ' ' + amt.toLocaleString() + '!');
}
