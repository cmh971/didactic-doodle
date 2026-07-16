import { SlashCommandBuilder } from 'discord.js';
import { addWallet, balance, checkCooldown, setCooldown } from '../../economy/store.js';
import { eph, fmtDuration, rint, pick } from '../../util.js';
import { TOKEN } from '../../config.js';

const CD = 45 * 60 * 1000;
const VERBS = ["cleared a dungeon","looted a ruin","survived a quest"];

export const data = new SlashCommandBuilder().setName('adventure').setDescription('🗺️ Earn UNO Tokens by adventure-ing');

export async function execute(interaction) {
  const id = interaction.user.id;
  const left = checkCooldown(id, 'adventure', CD);
  if (left) return interaction.reply(eph('⏳ Not yet — try again in ' + fmtDuration(left) + '.'));
  setCooldown(id, 'adventure');
  const bal = balance(id);
  if (Math.random() < 0.4) { const fee = rint(1000, 20000); addWallet(id, -fee, 'adventure'); return interaction.reply('🗺️ No luck this time — it cost you ' + TOKEN + ' ' + fee.toLocaleString() + '.'); }
  const amt = rint(50000, 400000);
  addWallet(id, amt, 'adventure');
  return interaction.reply('🗺️ You ' + pick(VERBS) + ' and earned ' + TOKEN + ' ' + amt.toLocaleString() + '!');
}
