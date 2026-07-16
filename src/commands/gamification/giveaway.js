import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { createGiveaway, endGiveaway, reroll } from '../../features/giveaways.js';

const eph = (content) => ({ content, flags: MessageFlags.Ephemeral });

function parseDuration(str) {
  const m = String(str).toLowerCase().match(/^(\d+)\s*(s|m|h|d)$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]];
  return n * mult;
}

export const data = new SlashCommandBuilder()
  .setName('giveaway')
  .setDescription('Run a giveaway')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((s) =>
    s.setName('start').setDescription('Start a giveaway')
      .addStringOption((o) => o.setName('prize').setDescription('What you\'re giving away').setRequired(true))
      .addStringOption((o) => o.setName('duration').setDescription('e.g. 30s, 10m, 2h, 1d').setRequired(true))
      .addIntegerOption((o) => o.setName('winners').setDescription('Number of winners (default 1)').setMinValue(1)),
  )
  .addSubcommand((s) => s.setName('end').setDescription('End a giveaway now').addIntegerOption((o) => o.setName('id').setDescription('Giveaway ID').setRequired(true)))
  .addSubcommand((s) => s.setName('reroll').setDescription('Reroll a giveaway').addIntegerOption((o) => o.setName('id').setDescription('Giveaway ID').setRequired(true)));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'start') {
    const prize = interaction.options.getString('prize');
    const ms = parseDuration(interaction.options.getString('duration'));
    const winners = interaction.options.getInteger('winners') ?? 1;
    if (!ms || ms < 5000) return interaction.reply(eph('❌ Use a duration like `30s`, `10m`, `2h`, `1d` (min 5s).'));
    const id = await createGiveaway(interaction, prize, ms, winners);
    return interaction.reply(eph(`🎉 Giveaway **#${id}** started for **${prize}**!`));
  }
  if (sub === 'end') {
    await endGiveaway(interaction.client, interaction.options.getInteger('id'));
    return interaction.reply(eph('✅ Giveaway ended.'));
  }
  await reroll(interaction.client, interaction.options.getInteger('id'));
  return interaction.reply(eph('🔁 Rerolled.'));
}
