import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { allLinks } from '../../features/roblox.js';
import { getCfg } from '../../setup/store.js';

export const data = new SlashCommandBuilder()
  .setName('updatemembers')
  .setDescription('Sync verified members: set nicknames to Roblox names + apply the verified role')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const links = allLinks(interaction.guildId);
  if (!links.length) return interaction.editReply('No linked members yet. Members link with `/link`.');

  const verifiedRole = getCfg(interaction.guildId).settings.verifiedRole;
  let nick = 0;
  let roled = 0;
  for (const l of links) {
    const member = await interaction.guild.members.fetch(l.user_id).catch(() => null);
    if (!member) continue;
    if (member.nickname !== l.roblox_name) {
      if (await member.setNickname(l.roblox_name).then(() => true).catch(() => false)) nick++;
    }
    if (verifiedRole && !member.roles.cache.has(verifiedRole)) {
      if (await member.roles.add(verifiedRole).then(() => true).catch(() => false)) roled++;
    }
  }
  await interaction.editReply(`🔄 Synced **${links.length}** linked member(s): ${nick} nickname(s) updated, ${roled} role(s) applied.`);
}
