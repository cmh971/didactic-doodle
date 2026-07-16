import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { autos } from '../../features/management.js';

const eph = (c) => ({ content: c, flags: MessageFlags.Ephemeral });

export const data = new SlashCommandBuilder()
  .setName('automations')
  .setDescription('Create automated trigger → action rules')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((s) => s.setName('create').setDescription('Create an automation')
    .addStringOption((o) => o.setName('name').setDescription('Name').setRequired(true))
    .addStringOption((o) => o.setName('trigger').setDescription('Trigger').setRequired(true).addChoices(
      { name: 'member_join', value: 'member_join' }, { name: 'keyword', value: 'keyword' }, { name: 'manual', value: 'manual' }))
    .addStringOption((o) => o.setName('action').setDescription('Action').setRequired(true).addChoices(
      { name: 'send_message', value: 'send_message' }, { name: 'add_role', value: 'add_role' }))
    .addStringOption((o) => o.setName('data').setDescription('Param (message text / role id / keyword)')))
  .addSubcommand((s) => s.setName('list').setDescription('List automations'))
  .addSubcommand((s) => s.setName('delete').setDescription('Delete one').addIntegerOption((o) => o.setName('id').setDescription('ID').setRequired(true)))
  .addSubcommand((s) => s.setName('edit').setDescription('Toggle enabled').addIntegerOption((o) => o.setName('id').setDescription('ID').setRequired(true)))
  .addSubcommand((s) => s.setName('run').setDescription('Run a manual automation now').addIntegerOption((o) => o.setName('id').setDescription('ID').setRequired(true)));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const g = interaction.guildId;

  if (sub === 'create') {
    const info = autos.create.run(g, interaction.options.getString('name'), interaction.options.getString('trigger'), interaction.options.getString('action'), interaction.options.getString('data') || '');
    return interaction.reply(`⚙️ Automation **#${info.lastInsertRowid}** created.`);
  }
  if (sub === 'list') {
    const rows = autos.list.all(g);
    if (!rows.length) return interaction.reply(eph('No automations yet.'));
    const embed = new EmbedBuilder().setColor(0x9b59b6).setTitle('⚙️ Automations')
      .setDescription(rows.map((r) => `**#${r.id}** ${r.enabled ? '🟢' : '🔴'} **${r.name}** — on \`${r.trigger}\` → \`${r.action}\` ${r.data ? `(${r.data})` : ''}`).join('\n'));
    return interaction.reply({ embeds: [embed] });
  }
  if (sub === 'delete') {
    autos.del.run(interaction.options.getInteger('id'), g);
    return interaction.reply('🗑️ Deleted.');
  }
  if (sub === 'edit') {
    const row = autos.get.get(interaction.options.getInteger('id'), g);
    if (!row) return interaction.reply(eph('❌ Not found.'));
    autos.toggle.run(row.enabled ? 0 : 1, row.id, g);
    return interaction.reply(`⚙️ Automation #${row.id} ${row.enabled ? 'disabled' : 'enabled'}.`);
  }
  // run
  const row = autos.get.get(interaction.options.getInteger('id'), g);
  if (!row) return interaction.reply(eph('❌ Not found.'));
  if (row.action === 'send_message') {
    await interaction.channel.send(row.data || '(automation message)').catch(() => {});
    return interaction.reply(eph(`▶️ Ran #${row.id}.`));
  }
  return interaction.reply(eph(`▶️ Automation #${row.id} (\`${row.action}\`) triggered. Auto-actions run on their trigger event.`));
}
