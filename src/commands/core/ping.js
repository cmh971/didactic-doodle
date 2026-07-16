import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder().setName('ping').setDescription('Check the bot latency');

export async function execute(interaction) {
  const sent = await interaction.reply({ content: '🏓 Pinging…', withResponse: true });
  const rtt = sent.resource.message.createdTimestamp - interaction.createdTimestamp;
  await interaction.editReply(`🏓 Pong! Round-trip: **${rtt}ms** · API: **${Math.round(interaction.client.ws.ping)}ms**`);
}
