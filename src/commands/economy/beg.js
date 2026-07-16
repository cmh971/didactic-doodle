import { SlashCommandBuilder } from 'discord.js';
import { addWallet, checkCooldown, setCooldown } from '../../economy/store.js';
import { eph, fmtDuration, rint, pick } from '../../util.js';
import { COOLDOWNS, BEG_MIN, BEG_MAX, TOKEN } from '../../config.js';

const DONORS = ['A kind stranger', 'The UNO god', 'A passing wild card', 'Your grandma', 'A rich whale'];

export const data = new SlashCommandBuilder().setName('beg').setDescription('Beg for a few UNO Tokens');

export async function execute(interaction) {
  const left = checkCooldown(interaction.user.id, 'beg', COOLDOWNS.beg);
  if (left) return interaction.reply(eph(`⏳ Don't be greedy. Wait **${fmtDuration(left)}**.`));
  setCooldown(interaction.user.id, 'beg');
  const got = rint(BEG_MIN, BEG_MAX);
  addWallet(interaction.user.id, got);
  await interaction.reply(`🙏 ${pick(DONORS)} gave you ${TOKEN} **${got.toLocaleString()}**.`);
}
