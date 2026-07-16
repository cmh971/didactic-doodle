import { SlashCommandBuilder, EmbedBuilder, version as djsVersion } from 'discord.js';
import { fmtDuration } from '../../util.js';

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
  await interaction.reply({ embeds: [embed] });
}
