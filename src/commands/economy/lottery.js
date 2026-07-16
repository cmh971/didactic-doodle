import { SlashCommandBuilder } from 'discord.js';
import { balance, addWallet } from '../../economy/store.js';
import { eph, rint } from '../../util.js';
import { renderCoin } from '../../render/extras.js';
import { TOKEN } from '../../config.js';

const TICKET = 10_000;

export const data = new SlashCommandBuilder()
  .setName('lottery')
  .setDescription(`Buy a lottery ticket for ${TICKET.toLocaleString()} tokens — jackpot up to 10,000,000!`);

export async function execute(interaction) {
  if (balance(interaction.user.id).wallet < TICKET) {
    return interaction.reply(eph(`❌ A ticket costs ${TOKEN} ${TICKET.toLocaleString()}.`));
  }
  addWallet(interaction.user.id, -TICKET);

  const roll = Math.random();
  let prize = 0;
  if (roll < 0.01) prize = 10_000_000;
  else if (roll < 0.05) prize = 1_000_000;
  else if (roll < 0.2) prize = 100_000;
  else if (roll < 0.5) prize = 25_000;

  if (prize) {
    addWallet(interaction.user.id, prize);
    return interaction.reply({
      content: `🎟️ Winner! You won ${TOKEN} **${prize.toLocaleString()}**!`,
      files: [renderCoin(prize, 'LOTTERY')],
    });
  }
  await interaction.reply(`🎟️ No luck this time — your ${TOKEN} ${TICKET.toLocaleString()} ticket was a dud. Try again!`);
}
