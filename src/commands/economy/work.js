import { SlashCommandBuilder } from 'discord.js';
import { addWallet, checkCooldown, setCooldown } from '../../economy/store.js';
import { eph, fmtDuration, rint, pick } from '../../util.js';
import { COOLDOWNS, WORK_MIN, WORK_MAX, TOKEN } from '../../config.js';
import { isPremium, WORK_MULT } from '../../systems/premium.js';

const JOBS = [
  'dealt cards at the UNO casino',
  'refereed a No Mercy tournament',
  'designed new wild cards',
  'streamed UNO on Twitch',
  'coached a rookie to victory',
  'sold +4 cards on the black market',
];

export const data = new SlashCommandBuilder().setName('work').setDescription('Work a shift for UNO Tokens');

export async function execute(interaction) {
  const left = checkCooldown(interaction.user.id, 'work', COOLDOWNS.work);
  if (left) return interaction.reply(eph(`⏳ You're tired. Rest for **${fmtDuration(left)}**.`));
  setCooldown(interaction.user.id, 'work');
  const premium = isPremium(interaction.guildId);
  const pay = rint(WORK_MIN, WORK_MAX) * (premium ? WORK_MULT : 1);
  addWallet(interaction.user.id, pay);
  await interaction.reply(`💼 You ${pick(JOBS)} and earned ${TOKEN} **${pay.toLocaleString()}**!${premium ? ' 💎 *(Premium 2×)*' : ''}`);
}
