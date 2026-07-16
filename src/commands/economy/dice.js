import { SlashCommandBuilder } from 'discord.js';
import { balance, addWallet } from '../../economy/store.js';
import { eph, rint } from '../../util.js';
import { renderDice } from '../../render/extras.js';
import { TOKEN } from '../../config.js';

export const data = new SlashCommandBuilder()
  .setName('dice')
  .setDescription('Roll against the house — higher total wins')
  .addIntegerOption((o) => o.setName('amount').setDescription('Bet amount').setRequired(true).setMinValue(1));

export async function execute(interaction) {
  const bet = interaction.options.getInteger('amount');
  if (balance(interaction.user.id).wallet < bet) return interaction.reply(eph('❌ You don\'t have that many tokens.'));

  const you = [rint(1, 6), rint(1, 6)];
  const house = [rint(1, 6), rint(1, 6)];
  const yt = you[0] + you[1];
  const ht = house[0] + house[1];
  let note;
  if (yt > ht) {
    addWallet(interaction.user.id, bet);
    note = `You ${yt} vs House ${ht} — WIN +${TOKEN} ${bet.toLocaleString()}!`;
  } else if (yt < ht) {
    addWallet(interaction.user.id, -bet);
    note = `You ${yt} vs House ${ht} — lose -${TOKEN} ${bet.toLocaleString()}.`;
  } else {
    note = `You ${yt} vs House ${ht} — push (tie), bet returned.`;
  }
  await interaction.reply({ content: `🎲 ${note}`, files: [renderDice([...you, ...house])] });
}
