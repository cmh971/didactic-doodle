import { SlashCommandBuilder, EmbedBuilder, version as djsVersion } from 'discord.js';
import { fmtDuration } from '../../util.js';
import { getCfg } from '../../setup/store.js';

export const data = new SlashCommandBuilder().setName('botinfo').setDescription('Show bot stats & uptime');

export async function execute(interaction) {
  const { client } = interaction;
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🤖 Bot Info')
    .addFields(
      { name: 'Servers', value: String(client.guilds.cache.size), inline: true },
      { name: 'Commands', value: String(client.application?.commands?.cache.size || 'n/a'), inline: true },
      { name: 'Uptime', value: fmtDuration(client.uptime), inline: true },
      { name: 'Ping', value: `${Math.round(client.ws.ping)}ms`, inline: true },
      { name: 'discord.js', value: `v${djsVersion}`, inline: true },
      { name: 'Node', value: process.version, inline: true },
    );
  // Global bio (About Me) shows everywhere; the server bio is per-guild.
  if (client.application?.description) embed.setDescription(client.application.description);
  const serverBio = interaction.guildId ? getCfg(interaction.guildId).settings?.identity?.serverbio : null;
  if (serverBio) embed.addFields({ name: '📝 About this server', value: String(serverBio).slice(0, 1024), inline: false });
  await interaction.reply({ embeds: [embed] });
}
