import { SlashCommandBuilder } from 'discord.js';
import { addWallet, balance, checkCooldown, setCooldown, hasItem, removeItem } from '../../economy/store.js';
import { eph, fmtDuration, rint } from '../../util.js';
import { COOLDOWNS, TOKEN } from '../../config.js';

export const data = new SlashCommandBuilder()
  .setName('rob')
  .setDescription('Try to rob another player\'s wallet')
  .addUserOption((o) => o.setName('user').setDescription('Who to rob').setRequired(true));

export async function execute(interaction) {
  const target = interaction.options.getUser('user');
  const me = interaction.user.id;
  if (target.id === me) return interaction.reply(eph('❌ You can\'t rob yourself.'));
  if (target.bot) return interaction.reply(eph('❌ Bots have no pockets.'));

  const left = checkCooldown(me, 'rob', COOLDOWNS.rob);
  if (left) return interaction.reply(eph(`⏳ The cops are watching. Wait **${fmtDuration(left)}**.`));
  setCooldown(me, 'rob');

  // 🛡️ Rob Shield blocks the attempt.
  if (hasItem(target.id, 'shield')) {
    removeItem(target.id, 'shield');
    return interaction.reply(`🛡️ <@${target.id}>'s **Rob Shield** blocked your robbery! It shattered in the process.`);
  }

  const victimWallet = balance(target.id).wallet;
  if (victimWallet < 1000) return interaction.reply(eph(`😴 <@${target.id}> is too broke to rob.`));

  if (Math.random() < 0.45) {
    const fine = rint(1000, Math.max(1000, Math.floor(balance(me).wallet * 0.2)));
    addWallet(me, -fine);
    return interaction.reply(`🚓 You got caught and paid ${TOKEN} **${fine.toLocaleString()}** in bail!`);
  }
  const stolen = rint(Math.floor(victimWallet * 0.1), Math.floor(victimWallet * 0.5));
  addWallet(target.id, -stolen);
  addWallet(me, stolen);
  await interaction.reply(`🥷 You robbed <@${target.id}> for ${TOKEN} **${stolen.toLocaleString()}**!`);
}
