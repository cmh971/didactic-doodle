import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { solvePCP, parseTiles } from '../../features/pcp.js';

export const data = new SlashCommandBuilder()
  .setName('pcp')
  .setDescription("Post's Correspondence Problem: does a domino sequence make top == bottom? (undecidable!)")
  .addStringOption((o) => o.setName('tiles').setDescription('Tiles as top/bottom, space-separated. e.g. a/ab b/ca ca/a abc/c').setRequired(true));

export async function execute(interaction) {
  let tiles;
  try { tiles = parseTiles(interaction.options.getString('tiles')); }
  catch (e) { return interaction.reply({ content: `⚠️ ${e.message}`, flags: MessageFlags.Ephemeral }).catch(() => {}); }

  await interaction.deferReply();
  const r = solvePCP(tiles, { maxStates: 150000, maxOverhang: 120 });

  const colors = { YES: 0x22c55e, NO: 0xef4444, UNDETERMINED: 0xf59e0b };
  const titles = { YES: '✅ YES — a match exists', NO: '❌ NO — provably no match', UNDETERMINED: '🤷 UNDETERMINED' };
  const embed = new EmbedBuilder()
    .setColor(colors[r.result])
    .setTitle(titles[r.result])
    .addFields(
      { name: 'Tiles', value: '```\n' + tiles.map(([t, b], i) => `${i + 1}: ${t}/${b}`).join('\n').slice(0, 500) + '\n```' },
      { name: 'States explored', value: String(r.explored), inline: true },
    )
    .setFooter({ text: "PCP is undecidable (Post, 1946): no algorithm can always answer — so UNDETERMINED is a valid, honest result." });

  if (r.result === 'YES') {
    embed.addFields(
      { name: 'Witness sequence', value: '`' + r.sequence.map((i) => i + 1).join(' → ') + '`', inline: true },
      { name: 'Matched string', value: '```\n' + r.word.slice(0, 300) + '\n```' },
    );
  } else if (r.result === 'NO') {
    embed.setDescription('The reachable state space was **finite and fully exhausted** with no match — a genuine, provable NO.');
  } else {
    embed.setDescription(`Hit the resource limit before resolving (**${r.reason}**). This is the undecidability of PCP showing itself — not a bug. A bigger budget *might* resolve it, or it might run forever.`);
  }

  return interaction.editReply({ embeds: [embed] }).catch(() => {});
}
