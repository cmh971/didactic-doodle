import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { enable, DURATION } from '../../features/antiswear.js';

export const data = new SlashCommandBuilder()
  .setName('antiswear')
  .setDescription('Turn on AI anti-swear mode for 4m30s — deletes bad words and warns senders')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
  enable(interaction.guildId);
  const mins = Math.floor(DURATION / 60000);
  const secs = Math.floor((DURATION % 60000) / 1000);
  await interaction.reply(
    `🧼 **AI Anti-swear mode ON** for **${mins}m${secs}s**.\n` +
      `I'll automatically **delete bad-word messages** and **warn** the sender. The AI decides what counts as bad. 🤖`,
  );
}
