import { SlashCommandBuilder } from 'discord.js';
import { getItem, hasItem, removeItem, addWallet } from '../../economy/store.js';
import { eph, rint } from '../../util.js';
import { renderLootBox } from '../../render/extras.js';
import {
  PROTECTED_ROLE_ID,
  BUCK_ROLE_NAME,
  BUCK_ROLE_COLOR,
  BUCK_DURATION,
  TOKEN,
} from '../../config.js';

export const data = new SlashCommandBuilder()
  .setName('use')
  .setDescription('Use an item from your inventory')
  .addStringOption((o) => o.setName('item').setDescription('Item id to use (see /inventory)').setRequired(true))
  .addUserOption((o) => o.setName('target').setDescription('Target member (for the Timeout Hammer)'))
  .addIntegerOption((o) =>
    o.setName('minutes').setDescription('Timeout length in minutes (hammer)').setMinValue(1).setMaxValue(1440),
  );

export async function execute(interaction) {
  const itemId = interaction.options.getString('item');
  const userId = interaction.user.id;
  const item = getItem(itemId);
  if (!item) return interaction.reply(eph(`❌ No shop item with id \`${itemId}\`. Check \`/shop\`.`));
  if (!hasItem(userId, itemId)) {
    return interaction.reply(eph(`❌ You don't own **${item.name}**. Buy it with \`/buy ${itemId}\`.`));
  }

  if (item.effect === 'timeout') return useTimeoutHammer(interaction, item);

  if (item.effect === 'lootbox') {
    removeItem(userId, itemId);
    const reward = rint(5_000, 1_500_000);
    addWallet(userId, reward);
    return interaction.reply({ content: `🎁 You opened **${item.name}**!`, files: [renderLootBox(reward)] });
  }

  if (item.effect === 'shield') {
    return interaction.reply(`🛡️ Your **${item.name}** is ready — it will block the next person who tries to \`/rob\` you.`);
  }

  // collectible / AI-approved custom items
  return interaction.reply(`✨ You proudly show off your **${item.name}**.\n> ${item.description}`);
}

async function ensureBuckRole(guild) {
  let role = guild.roles.cache.find((r) => r.name === BUCK_ROLE_NAME);
  if (!role) {
    try {
      role = await guild.roles.create({ name: BUCK_ROLE_NAME, color: BUCK_ROLE_COLOR, reason: 'Buck backfire role' });
    } catch {
      return null;
    }
  }
  return role;
}

async function useTimeoutHammer(interaction, item) {
  const userId = interaction.user.id;
  if (!interaction.guild) return interaction.reply(eph('❌ Use the Timeout Hammer in a server.'));
  const target = interaction.options.getMember('target');
  const minutes = interaction.options.getInteger('minutes') ?? 10;
  if (!target) return interaction.reply(eph('❌ The Timeout Hammer needs a `target` member.'));
  if (target.id === userId) return interaction.reply(eph('❌ You cannot hammer yourself.'));

  // 🛡️ Protected role can NEVER be timed out by the hammer.
  if (target.roles.cache.has(PROTECTED_ROLE_ID)) {
    return interaction.reply(eph(`🛡️ <@${target.id}> wears the protected role — the hammer just bounces off. Nothing happens.`));
  }

  const me = interaction.member;
  // Consume the hammer no matter what — swinging it is the cost.
  removeItem(userId, item.id);

  // Does the target OUTRANK the user? Then it backfires onto the user.
  const outranks = target.roles.highest.comparePositionTo(me.roles.highest) > 0;

  if (outranks) {
    const buckRole = await ensureBuckRole(interaction.guild);
    let note = '';
    if (buckRole) {
      await me.roles.add(buckRole).catch(() => {});
      setTimeout(() => me.roles.remove(buckRole).catch(() => {}), BUCK_DURATION);
    }
    try {
      await me.timeout(BUCK_DURATION, 'Timeout Hammer backfired (target outranked user)');
    } catch (e) {
      note = ` (couldn't time you out: ${e.message})`;
    }
    const mins = Math.round(BUCK_DURATION / 60000);
    return interaction.reply(
      `💥 **BACKFIRE!** <@${target.id}> outranks you, so the **${item.name}** turned on YOU.\n` +
        `You've been branded with the **${buckRole?.name ?? BUCK_ROLE_NAME}** role and timed out for **${mins} min**.${note}`,
    );
  }

  try {
    await target.timeout(minutes * 60000, `Timeout Hammer used by ${interaction.user.tag}`);
    return interaction.reply(
      `🔨 <@${userId}> swung the **${item.name}** — <@${target.id}> is timed out for **${minutes} min**! ${TOKEN}`,
    );
  } catch (e) {
    return interaction.reply(eph(`❌ Couldn't time them out (is my bot role high enough?): ${e.message}`));
  }
}
