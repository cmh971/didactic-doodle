import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { punish } from '../../features/management.js';

const eph = (c) => ({ content: c, flags: MessageFlags.Ephemeral });

export const data = new SlashCommandBuilder()
  .setName('punishments')
  .setDescription('Manage Roblox punishment logs')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand((s) => s.setName('create').setDescription('Log a punishment')
    .addStringOption((o) => o.setName('roblox_user').setDescription('Roblox username').setRequired(true))
    .addStringOption((o) => o.setName('type').setDescription('Type').setRequired(true).addChoices(
      { name: 'warn', value: 'warn' }, { name: 'kick', value: 'kick' }, { name: 'ban', value: 'ban' }, { name: 'note', value: 'note' }))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true)))
  .addSubcommand((s) => s.setName('view').setDescription('View/search punishment logs')
    .addStringOption((o) => o.setName('roblox_user').setDescription('Filter by user')))
  .addSubcommand((s) => s.setName('manage').setDescription('Edit or delete a log')
    .addIntegerOption((o) => o.setName('id').setDescription('Log ID').setRequired(true))
    .addStringOption((o) => o.setName('action').setDescription('Action').setRequired(true).addChoices({ name: 'edit', value: 'edit' }, { name: 'delete', value: 'delete' }))
    .addStringOption((o) => o.setName('reason').setDescription('New reason (for edit)')));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const g = interaction.guildId;

  if (sub === 'create') {
    const user = interaction.options.getString('roblox_user');
    const type = interaction.options.getString('type');
    const reason = interaction.options.getString('reason');
    const info = punish.create.run(g, user, type, reason, interaction.user.id);
    return interaction.reply(`📝 Logged **#${info.lastInsertRowid}** — \`${type}\` for **${user}**: ${reason}`);
  }

  if (sub === 'view') {
    const filter = interaction.options.getString('roblox_user');
    const rows = filter ? punish.search.all(g, `%${filter}%`) : punish.list.all(g);
    if (!rows.length) return interaction.reply(eph('No punishment logs found.'));
    const embed = new EmbedBuilder().setColor(0xe67e22).setTitle('📋 Punishment Logs')
      .setDescription(rows.map((r) => `**#${r.id}** \`${r.type}\` **${r.roblox_user}** — ${r.reason} · <@${r.moderator_id}> · <t:${r.created_at}:R>`).join('\n').slice(0, 4000));
    return interaction.reply({ embeds: [embed] });
  }

  // manage
  const id = interaction.options.getInteger('id');
  const action = interaction.options.getString('action');
  const row = punish.get.get(id, g);
  if (!row) return interaction.reply(eph(`❌ No log #${id}.`));
  if (action === 'delete') {
    punish.del.run(id, g);
    return interaction.reply(`🗑️ Deleted log #${id}.`);
  }
  const reason = interaction.options.getString('reason');
  if (!reason) return interaction.reply(eph('❌ Provide a new `reason` to edit.'));
  punish.edit.run(reason, id, g);
  return interaction.reply(`✏️ Updated log #${id}.`);
}
