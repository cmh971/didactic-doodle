import { SlashCommandBuilder } from 'discord.js';
import { balance, addWallet } from '../../economy/store.js';
import { eph, pick } from '../../util.js';
import { renderSlots } from '../../render/extras.js';
import { TOKEN } from '../../config.js';

const SYMBOLS = ['🍒', '🍋', '🔔', '💎', '7️⃣', '🃏'];

export const data = new SlashCommandBuilder()
  .setName('slots')
  .setDescription('Spin the slot machine')
  .addIntegerOption((o) => o.setName('amount').setDescription('Bet amount').setRequired(true).setMinValue(1));

export async function execute(interaction) {
  const bet = interaction.options.getInteger('amount');
  if (balance(interaction.user.id).wallet < bet) return interaction.reply(eph('❌ You don\'t have that many tokens.'));

  const reels = [pick(SYMBOLS), pick(SYMBOLS), pick(SYMBOLS)];
  const three = reels[0] === reels[1] && reels[1] === reels[2];
  const two = new Set(reels).size === 2;

  let mult = -1;
  if (three) mult = 9;
  else if (two) mult = 1;

  const delta = bet * mult;
  addWallet(interaction.user.id, delta);
  const won = delta > 0;
  const note = three
    ? `🎉 JACKPOT! +${TOKEN} ${delta.toLocaleString()}`
    : two
      ? `Two match! +${TOKEN} ${delta.toLocaleString()}`
      : `No match… -${TOKEN} ${bet.toLocaleString()}`;
  await interaction.reply({ content: `🎰 ${reels.join(' ')} — ${note}`, files: [renderSlots(reels, won)] });
}
