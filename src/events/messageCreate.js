// Guild message pipeline: automod first (may delete/punish), then XP/leveling.
import { scan } from '../systems/automod.js';
import { awardMessageXp, applyAutoRole } from '../systems/leveling.js';
import { getGuild } from '../systems/guilds.js';
import { chatWithAI, isProfane, moderationFlag } from '../ai/gemini.js';
import { recordMention } from '../systems/mentions.js';
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
import { handleFunPrefix } from '../features/funPrefixText.js';
import { handleClaudeInbox } from '../features/claudeInbox.js';
import { handleSpecsText } from '../features/specs.js';
import { handleSpaceHazardText } from '../features/spaceHazard.js';
import { handleServerStatsText } from '../features/serverStats.js';
import { handlePromoteText } from '../features/promote.js';
import { handleInfractText } from '../features/infract.js';
import { handleTemplateText } from '../features/templateText.js';
import { handleAfkCommand, checkAfk } from '../features/afk.js';
import { checkAutoresponders } from '../features/autoresponders.js';
import { checkAntiping } from '../features/antiping.js';
import { handleShiftText } from '../features/shifts.js';
import { handleDeptText } from '../features/departments.js';
import { handleSessionText } from '../features/session.js';
import { handleServerText } from '../features/serverAdmin.js';
import { handleLuaText } from '../features/luaText.js';
import { handleRobloxLuaCommand } from '../features/robloxLua.js';
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
import { handleActivityText } from '../features/activityManagement.js';
import { handleRateLimitCommand } from '../systems/ratelimit.js';
import { handleApiKeyCommand } from '../features/devApi.js';
import { handleEmbedCommand } from '../features/embedWidgets.js';
import { handleFormCommand } from '../features/formBuilder.js';
import { handleCadAccessCommand } from '../features/cad.js';
import { handleCoinWatchCommand } from '../features/memecoin.js';
import { handleUpdateCommand } from '../features/updateLog.js';
import { handleTtsCommand } from '../features/ttsText.js';
import { handleAshVoiceCommand } from '../features/ashVoice.js';
import { handlePizzaCommand } from '../features/pizza.js';
import { handleMinecraftCommand } from '../features/minecraft.js';
import { handleErlcLinkCommand } from '../features/erlcLink.js';
import { runMessageAutomations } from '../features/automations.js';
import { recordUnoChat } from '../uno/spy.js';
import { recordPulse } from '../systems/pulse.js';
import { checkLevelBadges, unlockLine } from '../features/badges.js';
import { handleCountingMessage } from '../features/counting.js';
import { handleSuggestionMessage } from '../features/suggestions.js';

export async function handleGuildMessage(message) {
  if (!message.guild || message.author.bot) return;

  // Mirror chat in channels with a live UNO game into the spy snapshot.
  recordUnoChat(message);

  // Feed the live "server pulse" window (messages/min, heartbeat, top talkers).
  recordPulse(message);

  // AFK: clear the author's away status / flag mentioned AFK users (non-blocking).
  checkAfk(message);

  // 0.0.0) Prefix (!) commands — run before automod so a mod typing
  // "!ban @user spam reason" isn't itself caught by the filters. Stops here if handled.
  try {
    if (await handleClaudeInbox(message)) return;
    if (await handleSpecsText(message)) return;
    if (await handleSpaceHazardText(message)) return;
    if (await handleServerStatsText(message)) return;
    if (await handlePromoteText(message)) return;
    if (await handleInfractText(message)) return;
    if (await handleTemplateText(message)) return;
    if (await handleAfkCommand(message)) return;
    if (await handleShiftText(message)) return;
    if (await handleDeptText(message)) return;
    if (await handleInfractionText(message)) return;
    if (await handleVerifyText(message)) return;
    if (await handleFightText(message)) return;
    if (await handleSetupText(message)) return;
    if (await handleMediaText(message)) return;
    if (await handleSessionText(message)) return;
    if (await handleServerText(message)) return;
    if (await handleLuaText(message)) return;
    if (await handleRobloxLuaCommand(message)) return;
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
    if (await handleActivityText(message)) return;
    if (await handleRateLimitCommand(message)) return;
    if (await handleApiKeyCommand(message)) return;
    if (await handleEmbedCommand(message)) return;
    if (await handleFormCommand(message)) return;
    if (await handleCadAccessCommand(message)) return;
    if (await handleCoinWatchCommand(message)) return;
    if (await handleUpdateCommand(message)) return;
    if (await handleTtsCommand(message)) return;
    if (await handleAshVoiceCommand(message)) return;
    if (await handlePizzaCommand(message)) return;
    if (await handleMinecraftCommand(message)) return;
    if (await handleErlcLinkCommand(message)) return;
    if (await handleFunPrefix(message)) return;
    if (await handlePrefixCommand(message)) return;
  } catch (err) {
    console.error('prefix-command error:', err.message);
  }

  // Channel games — counting + suggestions box. Each only acts in its configured
  // channel; if it handled the message, stop here.
  try {
    if (await handleCountingMessage(message)) return;
    if (await handleSuggestionMessage(message)) return;
  } catch (err) {
    console.error('counting/suggestions error:', err.message);
  }

  // Anti-Ping — protect staff from pings. If it deleted the message, stop here.
  try { if (await checkAntiping(message)) return; } catch (err) { console.error('antiping error:', err.message); }

  // Autoresponders — keyword → auto-reply (non-blocking; automod still scans the msg).
  try { await checkAutoresponders(message); } catch (err) { console.error('autoresponder error:', err.message); }

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

  // 2) Bot @mention → NOTIFY the lead dev (do NOT auto-reply). The AI only talks
  // via /ask now, so a ping never triggers it — but we don't let pings vanish:
  // recordMention logs it (mirrored to the dashboard + PM2) and appends it to
  // data/mentions.jsonl, which `node tools/peek.mjs pings` reads as an inbox.
  try {
    if (message.mentions.has(message.client.user) && !message.mentions.everyone) {
      recordMention(message);
    }
  } catch (err) {
    console.error('mention notify error:', err.message);
  }

  // 2.5) Custom automations (When someone says X → Do Y). Runs on clean messages.
  try {
    await runMessageAutomations(message);
  } catch (err) {
    console.error('automations error:', err.message);
  }
// 2.6) AI chat (experimental, opt-in). If the message starts with /ask, the bot
  // will respond with a short answer. If the message starts with /asklong, the bot
  // will respond with a longer answer. If the message starts with /askcode, the bot
  // will respond with code. If the message starts with /askimage, the bot will
  // respond with an image. If the message starts with /askfile, the bot will
  // respond with a file. If the message starts with /askvoice, the bot will
  // respond with a voice message. If the message starts with /askvideo, the bot
  // will respond with a video. If the message starts with /askaudio, the bot will
  // respond with an audio file. If the message starts with /askpdf, the bot will
  // respond with a PDF file. If the message starts with /askdoc, the bot will
  // respond with a Word document. If the message starts with / HHHGH
  // 3) Leveling XP (respects the 60s cooldown internally).
  try {
    if (!getGuild(message.guild.id).modules.leveling) return;
    const res = awardMessageXp(message.author.id, message.guild.id);
    if (res?.leveled) {
      const roleId = await applyAutoRole(message.member, res.level);
      const badges = checkLevelBadges(message.guild.id, message.author.id, res.level);
      await message.channel
        .send(`🎉 ${message.author} reached **level ${res.level}**!${roleId ? ` Unlocked <@&${roleId}>` : ''}${unlockLine(badges)}`)
        .catch(() => {});
    }
  } catch (err) {
    console.error('leveling error:', err);
  }
}
// End of file.