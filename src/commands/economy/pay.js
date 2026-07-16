import { SlashCommandBuilder } from 'discord.js';
import { transfer } from '../../economy/store.js';
import { eph } from '../../util.js';
import { TOKEN } from '../../config.js';

export const data = new SlashCommandBuilder()
  .setName('pay')
  .setDescription('Send UNO Tokens to another player')
  .addUserOption((o) => o.setName('user').setDescription('Recipient').setRequired(true))
  .addIntegerOption((o) => o.setName('amount').setDescription('How many tokens').setRequired(true).setMinValue(1));

export async function execute(interaction) {
  const target = interaction.options.getUser('user');
  const amount = interaction.options.getInteger('amount');
  if (target.id === interaction.user.id) return interaction.reply(eph('❌ You can\'t pay yourself.'));
  if (target.bot) return interaction.reply(eph('❌ Bots don\'t need tokens.'));
  const r = transfer(interaction.user.id, target.id, amount);
  if (!r.ok) return interaction.reply(eph(`❌ ${r.reason}`));
  await interaction.reply(`💸 <@${interaction.user.id}> paid <@${target.id}> ${TOKEN} **${amount.toLocaleString()}**!`);
}
