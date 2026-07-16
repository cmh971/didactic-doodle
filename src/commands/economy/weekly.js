import { SlashCommandBuilder } from 'discord.js';
import { addWallet, checkCooldown, setCooldown } from '../../economy/store.js';
import { eph, fmtDuration } from '../../util.js';
import { renderCoin } from '../../render/extras.js';
import { WEEKLY_REWARD, COOLDOWNS, TOKEN } from '../../config.js';

export const data = new SlashCommandBuilder().setName('weekly').setDescription('Claim your weekly jackpot of UNO Tokens');

export async function execute(interaction) {
  const left = checkCooldown(interaction.user.id, 'weekly', COOLDOWNS.weekly);
  if (left) return interaction.reply(eph(`⏳ Already claimed! Come back in **${fmtDuration(left)}**.`));
  setCooldown(interaction.user.id, 'weekly');
  addWallet(interaction.user.id, WEEKLY_REWARD);
  await interaction.reply({
    content: `🗓️ Weekly jackpot! +${TOKEN} **${WEEKLY_REWARD.toLocaleString()}**`,
    files: [renderCoin(WEEKLY_REWARD, 'WEEKLY')],
  });
}
