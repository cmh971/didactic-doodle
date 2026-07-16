import { SlashCommandBuilder } from 'discord.js';
import { balance, addWallet } from '../../economy/store.js';
import { eph, rint } from '../../util.js';
import { TOKEN } from '../../config.js';

// Quick auto-played blackjack: both sides draw to a sensible stand. Instant result.
function play() {
  const draw = () => Math.min(11, rint(2, 11));
  const handTotal = (cards) => {
    let t = cards.reduce((a, b) => a + b, 0);
    let aces = cards.filter((c) => c === 11).length;
    while (t > 21 && aces > 0) {
      t -= 10;
      aces--;
    }
    return t;
  };
  const you = [draw(), draw()];
  while (handTotal(you) < 17) you.push(draw());
  const dealer = [draw(), draw()];
  while (handTotal(dealer) < 17) dealer.push(draw());
  return { you, dealer, yt: handTotal(you), dt: handTotal(dealer) };
}

export const data = new SlashCommandBuilder()
  .setName('blackjack')
  .setDescription('Auto-play a hand of blackjack')
  .addIntegerOption((o) => o.setName('amount').setDescription('Bet amount').setRequired(true).setMinValue(1));

export async function execute(interaction) {
  const bet = interaction.options.getInteger('amount');
  if (balance(interaction.user.id).wallet < bet) return interaction.reply(eph('❌ You don\'t have that many tokens.'));

  const { yt, dt } = play();
  let result;
  if (yt > 21) result = ['💥 You busted!', -bet];
  else if (dt > 21) result = ['🎉 Dealer busted — you win!', bet];
  else if (yt > dt) result = ['🎉 You win!', bet];
  else if (yt < dt) result = ['😢 Dealer wins.', -bet];
  else result = ['🤝 Push (tie).', 0];

  addWallet(interaction.user.id, result[1]);
  const sign = result[1] >= 0 ? '+' : '-';
  await interaction.reply(
    `🃏 **Blackjack** — You: **${yt}** · Dealer: **${dt}**\n${result[0]} ${sign}${TOKEN} ${Math.abs(result[1]).toLocaleString()}`,
  );
}
