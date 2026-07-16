import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('massban')
  .setDescription('Ban multiple user IDs at once (space/comma separated)')
  .addStringOption((o) => o.setName('ids').setDescription('User IDs to ban').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason'))
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction) {
  const ids = interaction.options.getString('ids').split(/[\s,]+/).map((s) => s.replace(/[^0-9]/g, '')).filter(Boolean);
  const reason = interaction.options.getString('reason') ?? 'Mass ban';
  if (!ids.length) return interaction.reply({ content: '❌ No valid IDs found.', flags: MessageFlags.Ephemeral });
  if (ids.length > 50) return interaction.reply({ content: '❌ Max 50 IDs at once.', flags: MessageFlags.Ephemeral });

  await interaction.deferReply();
  let ok = 0;
  let fail = 0;
  for (const id of ids) {
    try {
      await interaction.guild.bans.create(id, { reason: `${reason} (by ${interaction.user.tag})` });
      ok++;
    } catch {
      fail++;
    }
  }
  await interaction.editReply(`🔨 Mass ban complete: **${ok}** banned, **${fail}** failed.`);
}
