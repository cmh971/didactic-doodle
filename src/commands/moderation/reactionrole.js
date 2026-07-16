import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { addReactionRole, removeReactionRole, emojiKey } from '../../features/reactionRoles.js';

const eph = (content) => ({ content, flags: MessageFlags.Ephemeral });

export const data = new SlashCommandBuilder()
  .setName('reactionrole')
  .setDescription('Manage reaction roles')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addSubcommand((s) =>
    s.setName('add').setDescription('Add a reaction role to a message')
      .addStringOption((o) => o.setName('message_id').setDescription('Target message ID (in this channel)').setRequired(true))
      .addStringOption((o) => o.setName('emoji').setDescription('Emoji to react with').setRequired(true))
      .addRoleOption((o) => o.setName('role').setDescription('Role to grant').setRequired(true)),
  )
  .addSubcommand((s) =>
    s.setName('remove').setDescription('Remove a reaction role from a message')
      .addStringOption((o) => o.setName('message_id').setDescription('Target message ID').setRequired(true))
      .addStringOption((o) => o.setName('emoji').setDescription('Emoji').setRequired(true)),
  );

function parseEmoji(input) {
  const custom = input.match(/<a?:\w+:(\d+)>/);
  return custom ? custom[1] : input.trim();
}

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const messageId = interaction.options.getString('message_id');
  const emojiInput = interaction.options.getString('emoji');
  const key = parseEmoji(emojiInput);

  const msg = await interaction.channel.messages.fetch(messageId).catch(() => null);
  if (!msg) return interaction.reply(eph('❌ Could not find that message in this channel.'));

  if (sub === 'add') {
    const role = interaction.options.getRole('role');
    addReactionRole(interaction.guildId, messageId, key, role.id);
    await msg.react(emojiInput).catch(() => {});
    return interaction.reply(eph(`✅ Reacting with ${emojiInput} on that message now grants **${role.name}**.`));
  }
  removeReactionRole(messageId, key);
  return interaction.reply(eph(`✅ Removed the reaction role for ${emojiInput}.`));
}
