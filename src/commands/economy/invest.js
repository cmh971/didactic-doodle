import { SlashCommandBuilder } from 'discord.js';
import { addWallet, balance, checkCooldown, setCooldown } from '../../economy/store.js';
import { eph, fmtDuration, rint, pick } from '../../util.js';
import { TOKEN } from '../../config.js';

const CD = 60 * 60 * 1000;
const VERBS = ["rode a bull market","timed the dip","cashed out gains"];

export const data = new SlashCommandBuilder().setName('invest').setDescription('📈 Earn UNO Tokens by invest-ing');

export async function execute(interaction) {
  const id = interaction.user.id;
  const left = checkCooldown(id, 'invest', CD);
  if (left) return interaction.reply(eph('⏳ Not yet — try again in ' + fmtDuration(left) + '.'));
  setCooldown(id, 'invest');
  const bal = balance(id);
  const stake = Math.min(bal.wallet, 200000);
  if (stake < 1000) return interaction.reply(eph('❌ You need at least some tokens in your wallet to invest.'));
  if (Math.random() < 0.45) { addWallet(id, -stake, 'invest'); return interaction.reply('📈 The market crashed — you lost ' + TOKEN + ' ' + stake.toLocaleString() + '.'); }
  const gain = Math.round(stake * (0.2 + Math.random()));
  addWallet(id, gain, 'invest');
  return interaction.reply('📈 You ' + pick(VERBS) + ' and gained ' + TOKEN + ' ' + gain.toLocaleString() + '!');
}
