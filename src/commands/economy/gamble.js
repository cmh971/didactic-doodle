import { SlashCommandBuilder } from 'discord.js';
import { balance, addWallet } from '../../economy/store.js';
import { eph } from '../../util.js';
import { renderWinBanner, renderLoseBanner } from '../../render/extras.js';
import { TOKEN } from '../../config.js';

export const data = new SlashCommandBuilder()
  .setName('gamble')
  .setDescription('Gamble tokens — ~48% chance to ~double them')
  .addIntegerOption((o) => o.setName('amount').setDescription('How much to bet').setRequired(true).setMinValue(1));

export async function execute(interaction) {
  const bet = interaction.options.getInteger('amount');
  if (balance(interaction.user.id).wallet < bet) return interaction.reply(eph('❌ You don\'t have that many tokens.'));

  if (Math.random() < 0.48) {
    addWallet(interaction.user.id, bet);
    return interaction.reply({
      content: `🎰 You bet ${TOKEN} ${bet.toLocaleString()} and WON!`,
      files: [renderWinBanner(`+${TOKEN} ${bet.toLocaleString()}`)],
    });
  }
  addWallet(interaction.user.id, -bet);
  await interaction.reply({
    content: `🎰 You bet ${TOKEN} ${bet.toLocaleString()} and lost it…`,
    files: [renderLoseBanner(`-${TOKEN} ${bet.toLocaleString()}`)],
  });
}
