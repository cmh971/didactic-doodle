import { SlashCommandBuilder } from 'discord.js';
import { addWallet, checkCooldown, setCooldown, balance } from '../../economy/store.js';
import { eph, fmtDuration, rint, pick } from '../../util.js';
import { COOLDOWNS, CRIME_MIN, CRIME_MAX, CRIME_FAIL_CHANCE, TOKEN } from '../../config.js';

const CRIMES = ['robbed the UNO bank', 'counterfeited +4 cards', 'rigged a tournament', 'hacked the leaderboard'];

export const data = new SlashCommandBuilder().setName('crime').setDescription('Commit a crime for big tokens — risky!');

export async function execute(interaction) {
  const left = checkCooldown(interaction.user.id, 'crime', COOLDOWNS.crime);
  if (left) return interaction.reply(eph(`⏳ Lay low for **${fmtDuration(left)}**.`));
  setCooldown(interaction.user.id, 'crime');

  if (Math.random() < CRIME_FAIL_CHANCE) {
    const fine = rint(CRIME_MIN, CRIME_MAX);
    const wallet = balance(interaction.user.id).wallet;
    const lost = Math.min(fine, wallet);
    addWallet(interaction.user.id, -lost);
    return interaction.reply(`🚓 You got CAUGHT and paid a fine of ${TOKEN} **${lost.toLocaleString()}**!`);
  }
  const loot = rint(CRIME_MIN, CRIME_MAX);
  addWallet(interaction.user.id, loot);
  await interaction.reply(`🦹 You ${pick(CRIMES)} and got away with ${TOKEN} **${loot.toLocaleString()}**!`);
}
