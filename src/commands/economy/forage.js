import { SlashCommandBuilder } from 'discord.js';
import { addWallet, balance, checkCooldown, setCooldown } from '../../economy/store.js';
import { eph, fmtDuration, rint, pick } from '../../util.js';
import { TOKEN } from '../../config.js';

const CD = 15 * 60 * 1000;
const VERBS = ["foraged rare herbs","found wild truffles","gathered berries"];

export const data = new SlashCommandBuilder().setName('forage').setDescription('🍄 Earn UNO Tokens by forage-ing');

export async function execute(interaction) {
  const id = interaction.user.id;
  const left = checkCooldown(id, 'forage', CD);
  if (left) return interaction.reply(eph('⏳ Not yet — try again in ' + fmtDuration(left) + '.'));
  setCooldown(id, 'forage');
  const bal = balance(id);
  if (Math.random() < 0.15) { const fee = rint(1000, 20000); addWallet(id, -fee, 'forage'); return interaction.reply('🍄 No luck this time — it cost you ' + TOKEN + ' ' + fee.toLocaleString() + '.'); }
  const amt = rint(3000, 60000);
  addWallet(id, amt, 'forage');
  return interaction.reply('🍄 You ' + pick(VERBS) + ' and earned ' + TOKEN + ' ' + amt.toLocaleString() + '!');
}
