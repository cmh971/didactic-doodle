import { SlashCommandBuilder } from 'discord.js';
import { balance, addWallet } from '../../economy/store.js';
import { eph } from '../../util.js';
import { renderCoinFlip } from '../../render/extras.js';
import { TOKEN } from '../../config.js';

export const data = new SlashCommandBuilder()
  .setName('coinflip')
  .setDescription('Bet on a coin flip — double or nothing')
  .addStringOption((o) =>
    o.setName('side').setDescription('Heads or tails').setRequired(true).addChoices(
      { name: 'Heads', value: 'Heads' },
      { name: 'Tails', value: 'Tails' },
    ),
  )
  .addIntegerOption((o) => o.setName('amount').setDescription('Bet amount').setRequired(true).setMinValue(1));

export async function execute(interaction) {
  const side = interaction.options.getString('side');
  const bet = interaction.options.getInteger('amount');
  if (balance(interaction.user.id).wallet < bet) return interaction.reply(eph('❌ You don\'t have that many tokens.'));

  const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
  const won = result === side;
  addWallet(interaction.user.id, won ? bet : -bet);
  await interaction.reply({
    content: `🪙 It landed on **${result}** — you ${won ? `WON ${TOKEN} ${bet.toLocaleString()}!` : `lost ${TOKEN} ${bet.toLocaleString()}.`}`,
    files: [renderCoinFlip(result)],
  });
}
