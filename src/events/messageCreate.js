// Guild message pipeline: automod first (may delete/punish), then XP/leveling.
import { scan } from '../systems/automod.js';
import { awardMessageXp, applyAutoRole } from '../systems/leveling.js';
import { getGuild } from '../systems/guilds.js';
import { chatWithAI, isProfane, moderationFlag } from '../ai/gemini.js';
import { askAsh, imagePartsFromMessage, registerAshMessage } from '../ai/ash.js';
import { isActive as antiswearActive } from '../features/antiswear.js';
import { isEnabled as aimodEnabled, reportFlag } from '../features/aimod.js';
import { scanBadwords } from '../systems/badwords.js';
import { handleFileScan } from '../features/filescan.js';
import { bump as analyticsBump } from '../systems/analytics.js';
import { handleInfractionText } from '../features/infractionText.js';
import { handleVerifyText } from '../features/verifyText.js';
import { handleFightText } from '../features/fight.js';
import { handleSetupText } from '../features/setupText.js';
import { handleMediaText } from '../features/mediaText.js';
import { handlePrefixCommand } from '../prefix/index.js';
import { handleSessionText } from '../features/session.js';
import { handleServerText } from '../features/serverAdmin.js';
import { handleLuaText } from '../features/luaText.js';
import { handlePyText } from '../features/pyText.js';
import { handleTagText } from '../features/tagText.js';
import { handleRenderText } from '../features/renderText.js';
import { handlePathText } from '../features/pathText.js';
import { handleNavText } from '../features/navigate.js';
import { handleModelText } from '../features/modelText.js';
import { handleSearchText } from '../features/searchText.js';
import { handleSourceText } from '../features/sourceText.js';
import { handlePutFileText } from '../features/putFileText.js';
import { handleBackupText } from '../features/serverBackup.js';
import { runMessageAutomations } from '../features/automations.js';
import { recordUnoChat } from '../uno/spy.js';

export async function handleGuildMessage(message) {
  if (!message.guild || message.author.bot) return;

  // Mirror chat in channels with a live UNO game into the spy snapshot.
  recordUnoChat(message);

  // 0.0.0) Prefix (!) commands — run before automod so a mod typing
  // "!ban @user spam reason" isn't itself caught by the filters. Stops here if handled.
  try {
    if (await handleInfractionText(message)) return;
    if (await handleVerifyText(message)) return;
    if (await handleFightText(message)) return;
    if (await handleSetupText(message)) return;
    if (await handleMediaText(message)) return;
    if (await handleSessionText(message)) return;
    if (await handleServerText(message)) return;
    if (await handleLuaText(message)) return;
    if (await handlePyText(message)) return;
    if (await handleTagText(message)) return;
    if (await handleRenderText(message)) return;
    if (await handlePathText(message)) return;
    if (await handleNavText(message)) return;
    if (await handleModelText(message)) return;
    if (await handleSearchText(message)) return;
    if (await handleSourceText(message)) return;
    if (await handlePutFileText(message)) return;
    if (await handleBackupText(message)) return;
    if (await handlePrefixCommand(message)) return;
  } catch (err) {
    console.error('prefix-command error:', err.message);
  }

  // Analytics: count human messages per guild per day (cheap upsert, never throws).
  analyticsBump(message.guild.id, 'messages');

  // 0.0) File scanner — if someone posts a dangerous file, delete + warn, stop here.
  try {
    if (await handleFileScan(message)) return;
  } catch (err) {
    console.error('filescan error:', err.message);
  }

  // 0) AI anti-swear mode (temporary, /antiswear). Deletes bad words + warns.
  try {
    if (antiswearActive(message.guild.id) && (await isProfane(message.content))) {
      await message.delete().catch(() => {});
      await message.channel.send(`🚫 ${message.author}, watch your language! **Anti-swear mode** is on.`).catch(() => {});
      return;
    }
  } catch (err) {
    console.error('antiswear error:', err.message);
  }

  // 1) Automod — if it acted (deleted/punished), stop here.
  try {
    const notice = await scan(message);
    if (notice) {
      await message.channel.send(notice).catch(() => {});
      return;
    }
  } catch (err) {
    console.error('automod error:', err);
  }

  // 1.2) Bad-word filter — escalates (warn → timeout → kick → ban). If it acted
  // (deleted + punished), stop here.
  try {
    const notice = await scanBadwords(message);
    if (notice) {
      await message.channel.send(notice).catch(() => {});
      return;
    }
  } catch (err) {
    console.error('badwords error:', err.message);
  }

  // 1.5) AI watch mode — flag suspicious messages for human approval (AI never acts).
  try {
    if (aimodEnabled(message.guild.id)) {
      const flag = await moderationFlag(message.content);
      if (flag) await reportFlag(message, flag);
    }
  } catch (err) {
    console.error('aimod error:', err.message);
  }

  // 2) AI chat (Ash) — reply when the bot is @mentioned (not @everyone).
  // Ash can search the web, see attached images, remember the chat, and answer
  // with embeds/forms. Common lines are handled locally to save Gemini tokens.
  try {
    if (message.mentions.has(message.client.user) && !message.mentions.everyone) {
      const prompt = message.content.replace(/<@!?\d+>/g, '').trim() || 'Hi!';
      await message.channel.sendTyping().catch(() => {});
      const images = await imagePartsFromMessage(message).catch(() => []);
      const { text, embed, components } = await askAsh({
        channelId: message.channel.id,
        authorTag: message.author.username,
        text: prompt,
        images,
      });
      const payload = {};
      if (text) payload.content = text.slice(0, 2000);
      if (embed) payload.embeds = [embed];
      if (components) payload.components = components;
      if (!payload.content && !payload.embeds) payload.content = '🤖';
      const sent = await message.reply(payload).catch(() => null);
      if (sent) registerAshMessage(sent.id, message.channel.id);
    }
  } catch (err) {
    console.error('AI mention error:', err.message);
  }

  // 2.5) Custom automations (When someone says X → Do Y). Runs on clean messages.
  try {
    await runMessageAutomations(message);
  } catch (err) {
    console.error('automations error:', err.message);
  }

  // 3) Leveling XP (respects the 60s cooldown internally).
  try {
    if (!getGuild(message.guild.id).modules.leveling) return;
    const res = awardMessageXp(message.author.id, message.guild.id);
    if (res?.leveled) {
      const roleId = await applyAutoRole(message.member, res.level);
      await message.channel
        .send(`🎉 ${message.author} reached **level ${res.level}**!${roleId ? ` Unlocked <@&${roleId}>` : ''}`)
        .catch(() => {});
    }
  } catch (err) {
    console.error('leveling error:', err);
  }
}
