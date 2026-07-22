import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { startAdd } from '../../systems/infractions.js';
import { recentInfractions, infractionCount, deleteInfraction, getInfraction } from '../../systems/automod.js';

export const data = new SlashCommandBuilder()
  .setName('infraction')
  .setDescription('Add, view, or remove member infractions (warns, mutes, kicks, bans)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand((s) => s
    .setName('add')
    .setDescription('Open a menu to warn / mute / kick / ban a member with a reason'))
  .addSubcommand((s) => s
    .setName('view')
    .setDescription('Show a member\'s infraction history (case IDs + moderators)')
    .addUserOption((o) => o.setName('user').setDescription('Member to look up').setRequired(true)))
  .addSubcommand((s) => s
    .setName('remove')
    .setDescription('Delete a single case by its ID (e.g. an accidental warning)')
    .addIntegerOption((o) => o.setName('case').setDescription('The case ID to delete').setRequired(true).setMinValue(1)));

const TYPE_IC = { warn: '⚠️', timeout: '🔇', kick: '👢', ban: '🔨', badword: '🤬', auto: '🤖' };

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply(eph('❌ Use `/infraction` inside a server.'));
  }
  const sub = interaction.options.getSubcommand();

  // ---- add: hand off to the interactive menu ----
  if (sub === 'add') return startAdd(interaction);

  // ---- view: history for one member ----
  if (sub === 'view') {
    const user = interaction.options.getUser('user');
    const total = infractionCount(interaction.guildId, user.id);
    const rows = recentInfractions(interaction.guildId, user.id, 15);
    const list = rows.length
      ? rows.map((r) => {
        const dur = r.expires_at ? ` · until <t:${r.expires_at}:R>` : '';
        return `**Case #${r.id}** ${TYPE_IC[r.type] || '•'} \`${r.type}\`\n` +
          `> ${r.reason || '_no reason_'}\n` +
          (r.notes ? `> 📝 ${r.notes}\n` : '') +
          `> by ${r.moderator_id ? `<@${r.moderator_id}>` : '_unknown_'} · <t:${r.created_at}:R>${dur}`;
      }).join('\n')
      : '_No infractions on record._';
    const embed = new EmbedBuilder()
      .setColor(total ? 0xe67e22 : 0x2ecc71)
      .setAuthor({ name: `${user.tag}`, iconURL: user.displayAvatarURL?.() })
      .setTitle(`🗂️ Infractions — ${user.username}`)
      .setDescription(`**Total:** ${total}\n\n${list}`.slice(0, 4096))
      .setFooter({ text: 'Remove a case with /infraction remove case:<id>' });
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  // ---- remove: delete one case by ID ----
  if (sub === 'remove') {
    const id = interaction.options.getInteger('case');
    const existing = getInfraction(interaction.guildId, id);
    if (!existing) {
      return interaction.reply(eph(`❌ No case **#${id}** found in this server.`));
    }
    deleteInfraction(interaction.guildId, id);
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`🗑️ Deleted case #${id}`)
      .setDescription(`Removed a \`${existing.type}\` on <@${existing.user_id}>.\n> ${existing.reason || '_no reason_'}`);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

function eph(content) { return { content, flags: MessageFlags.Ephemeral }; }
