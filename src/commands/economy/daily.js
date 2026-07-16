import { SlashCommandBuilder } from 'discord.js';
import { addWallet, checkCooldown, setCooldown, getUser, getStreak, setStreak } from '../../economy/store.js';
import { eph, fmtDuration } from '../../util.js';
import { renderCoin } from '../../render/extras.js';
import { DAILY_REWARD, COOLDOWNS, TOKEN } from '../../config.js';
import { isPremium, DAILY_MULT } from '../../systems/premium.js';

// Streak window: claim again within 48h to keep the streak alive.
const STREAK_WINDOW = 48 * 60 * 60 * 1000;
const MAX_MULTIPLIER = 3; // caps at x3

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Claim your daily UNO Tokens — keep a streak for a bigger multiplier!');

export async function execute(interaction) {
  const id = interaction.user.id;
  const left = checkCooldown(id, 'daily', COOLDOWNS.daily);
  if (left) return interaction.reply(eph(`⏳ Already claimed! Come back in **${fmtDuration(left)}**.`));

  // Continue streak if the last claim was within the window, else reset.
  const lastClaim = getUser(id).cooldowns.daily || 0;
  const continues = lastClaim && Date.now() - lastClaim <= STREAK_WINDOW;
  const streak = continues ? getStreak(id) + 1 : 1;
  setStreak(id, streak);
  setCooldown(id, 'daily');

  const multiplier = Math.min(1 + 0.1 * (streak - 1), MAX_MULTIPLIER);
  const premium = isPremium(interaction.guildId);
  const reward = Math.round(DAILY_REWARD * multiplier * (premium ? DAILY_MULT : 1));
  addWallet(id, reward, 'daily');

  await interaction.reply({
    content:
      `📅 Daily claimed! +${TOKEN} **${reward.toLocaleString()}**\n` +
      `🔥 Streak: **${streak} day${streak === 1 ? '' : 's'}** · Multiplier: **x${multiplier.toFixed(1)}**` +
      (multiplier >= MAX_MULTIPLIER ? ' (max!)' : '') +
      (premium ? `\n💎 **Premium 2× applied!**` : ''),
    files: [renderCoin(reward, `DAILY x${multiplier.toFixed(1)}`)],
  });
}
