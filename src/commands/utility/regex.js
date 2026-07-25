import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } from 'discord.js';
import { visualizeRegex } from '../../features/regexviz.js';

export const data = new SlashCommandBuilder()
  .setName('regex')
  .setDescription('Compile a regex to a Thompson NFA and animate the match, step by step')
  .addStringOption((o) => o.setName('pattern').setDescription('The regular expression (supports | * + ? . [] () )').setRequired(true))
  .addStringOption((o) => o.setName('test').setDescription('The test string to run through the machine').setRequired(true))
  .addStringOption((o) => o.setName('replace').setDescription('Optional replacement pattern (applied to matches)').setRequired(false));

export async function execute(interaction) {
  const pattern = interaction.options.getString('pattern');
  const test = interaction.options.getString('test');
  const replace = interaction.options.getString('replace');

  await interaction.deferReply();
  let viz;
  try {
    viz = visualizeRegex(pattern, test);
  } catch (err) {
    return interaction.editReply({ content: `⚠️ Couldn’t build the machine: ${err.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
  }

  const { astStr, nfa, sim, gif } = viz;
  const transitions = nfa.states.reduce((n, s) => n + s.trans.length + s.eps.length, 0);

  const embed = new EmbedBuilder()
    .setColor(sim.matched ? 0x22c55e : 0xef4444)
    .setTitle('🧬 Regex → Thompson NFA')
    .addFields(
      { name: 'Pattern', value: '```\n' + pattern.slice(0, 200) + '\n```', inline: false },
      { name: 'Test string', value: '```\n' + test.slice(0, 200) + '\n```', inline: false },
      { name: 'AST', value: '```\n' + astStr.slice(0, 400) + '\n```', inline: false },
      { name: 'NFA', value: `${nfa.states.length} states · ${transitions} transitions`, inline: true },
      { name: 'Frames', value: `${sim.steps.length}`, inline: true },
      { name: 'Result', value: sim.matched ? '✅ full match' : '❌ no full match', inline: true },
    )
    .setImage('attachment://nfa.gif')
    .setFooter({ text: 'Animation = a real Thompson NFA simulation (green = active states)' });

  if (replace != null) {
    let out;
    try { out = test.replace(new RegExp(pattern, 'g'), replace); }
    catch (e) { out = '(invalid for replacement: ' + e.message + ')'; }
    embed.addFields({ name: `Replacement → \`${replace}\``, value: '```\n' + String(out).slice(0, 400) + '\n```' });
  }

  const file = new AttachmentBuilder(gif, { name: 'nfa.gif' });
  return interaction.editReply({ embeds: [embed], files: [file] }).catch(() => {});
}
