import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { fmtDuration } from '../../util.js';

const MAX_MS = 6 * 60 * 60 * 1000; // 6h (kept in-process)

function parseDuration(str) {
  const m = str.toLowerCase().match(/^(\d+)\s*(s|m|h)$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n * (m[2] === 's' ? 1000 : m[2] === 'm' ? 60000 : 3600000);
}

export const data = new SlashCommandBuilder()
  .setName('remindme')
  .setDescription('Set a reminder (e.g. 10m, 2h)')
  .addStringOption((o) => o.setName('when').setDescription('Like 30s, 10m, 2h').setRequired(true))
  .addStringOption((o) => o.setName('text').setDescription('What to remind you about').setRequired(true));

export async function execute(interaction) {
  const ms = parseDuration(interaction.options.getString('when'));
  const text = interaction.options.getString('text');
  if (!ms || ms < 1000) return interaction.reply({ content: '❌ Use a duration like `30s`, `10m`, or `2h`.', flags: MessageFlags.Ephemeral });
  if (ms > MAX_MS) return interaction.reply({ content: '❌ Max reminder is 6h.', flags: MessageFlags.Ephemeral });

  await interaction.reply({ content: `⏰ Okay! I'll remind you in **${fmtDuration(ms)}**.`, flags: MessageFlags.Ephemeral });
  setTimeout(() => {
    interaction.channel?.send(`⏰ <@${interaction.user.id}> reminder: ${text}`).catch(() => {});
  }, ms);
}
