import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } from 'discord.js';
import { setNested } from '../../setup/store.js';
import { isBadwordFilterOn, getStrikes, resetStrikes } from '../../systems/badwords.js';
import { analyzeMessage, aiIsBadword } from '../../ai/gemini.js';

export const data = new SlashCommandBuilder()
  .setName('badwords')
  .setDescription('Configure the bad-word filter (auto-escalates: warn → timeout → kick → ban)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((s) => s.setName('on').setDescription('Turn the bad-word filter ON'))
  .addSubcommand((s) => s.setName('off').setDescription('Turn the bad-word filter OFF'))
  .addSubcommand((s) => s.setName('status').setDescription('Show whether the filter is on'))
  .addSubcommand((s) =>
    s.setName('logchannel')
      .setDescription('Where ban-approval prompts are posted')
      .addChannelOption((o) =>
        o.setName('channel').setDescription('Channel for approvals').addChannelTypes(ChannelType.GuildText).setRequired(true)))
  .addSubcommand((s) =>
    s.setName('strikes')
      .setDescription("Check a member's current strike count")
      .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)))
  .addSubcommand((s) =>
    s.setName('reset')
      .setDescription("Clear a member's strikes")
      .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)))
  .addSubcommand((s) =>
    s.setName('test')
      .setDescription('Test what the filter thinks of some text (nothing is punished)')
      .addStringOption((o) => o.setName('text').setDescription('Text to test').setRequired(true)));

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({ content: '❌ Use this inside a server.', flags: MessageFlags.Ephemeral });
  }
  const gid = interaction.guildId;
  const sub = interaction.options.getSubcommand();

  if (sub === 'on') {
    setNested(gid, 'automod', 'badwords', true);
    return interaction.reply('✅ Bad-word filter is **ON**.\nLadder: **warn → stern warn → 1h timeout → kick → ban** (ban needs staff approval, prompt lasts 6 min).');
  }

  if (sub === 'off') {
    setNested(gid, 'automod', 'badwords', false);
    return interaction.reply('🛑 Bad-word filter is now **OFF**.');
  }

  if (sub === 'status') {
    return interaction.reply(`Bad-word filter is **${isBadwordFilterOn(gid) ? 'ON ✅' : 'OFF 🛑'}**.`);
  }

  if (sub === 'logchannel') {
    const ch = interaction.options.getChannel('channel');
    setNested(gid, 'automod', 'logChannel', ch.id);
    return interaction.reply(`📋 Ban-approval prompts will be posted in ${ch}.`);
  }

  if (sub === 'strikes') {
    const user = interaction.options.getUser('user');
    return interaction.reply({ content: `**${user.tag}** has **${getStrikes(gid, user.id)}/5** strikes.`, flags: MessageFlags.Ephemeral });
  }

  if (sub === 'reset') {
    const user = interaction.options.getUser('user');
    resetStrikes(gid, user.id);
    return interaction.reply(`♻️ Cleared bad-word strikes for **${user.tag}**.`);
  }

  if (sub === 'test') {
    const text = interaction.options.getString('text');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const res = analyzeMessage(text);
    let verdict;
    if (res.level === 'exact') verdict = `🔴 **BAD** — exact match${res.matched.length ? ` (\`${res.matched.join(', ')}\`)` : ''}`;
    else if (res.level === 'fuzzy') verdict = (await aiIsBadword(text)) ? '🔴 **BAD** — obfuscation, AI-confirmed' : '🟢 clean — looked borderline but the AI cleared it';
    else verdict = '🟢 clean';
    return interaction.editReply(`Test for \`${text.slice(0, 120)}\`:\n${verdict}`);
  }
}
