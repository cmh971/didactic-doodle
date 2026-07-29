// !path — Enhanced A* Obstacle Avoidance & Pathfinding Bot for Discord.js
// Features: Advanced preprocessing, dynamic grid scaling, performance metrics,
// robust error logging, concurrent batch limits, and rich embedded outputs.
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { renderPathFromImage } from './pathfind.js';
import { renderPathVideo } from './pathvideo.js';

// Configuration Constants
const CONFIG = {
  COMMAND_PREFIX: /^!path\b/i,
  MAX_VIDEO_SIZE_MB: 25,
  TIMEOUT_MS: 15000,
  MAX_IMAGES_BATCH: 5,
  DEFAULT_FPS: 8,
  DEFAULT_MAX_SECONDS: 5,
  DEFAULT_WIDTH: 480,
  DEFAULT_COLS: 80,
  COLORS: {
    SUCCESS: 0x22c55e,
    FAILURE: 0xef4444,
    WARNING: 0xf59e0b,
  },
};

/**
 * Validates if an attachment is a supported image format.
 * @param {import('discord.js').Attachment} attachment
 * @returns {boolean}
 */
const isImage = (attachment) => {
  const contentType = attachment.contentType || '';
  const name = attachment.name || '';
  return /^image\//.test(contentType) || /\.(png|jpe?g|webp|bmp|gif)$/i.test(name);
};

/**
 * Validates if an attachment is a supported video format.
 * @param {import('discord.js').Attachment} attachment
 * @returns {boolean}
 */
const isVideo = (attachment) => {
  const contentType = attachment.contentType || '';
  const name = attachment.name || '';
  return /^video\//.test(contentType) || /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(name);
};

/**
 * Safely fetches a remote URL with a strict timeout signal.
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
async function fetchAttachmentBuffer(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(CONFIG.TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`Failed to fetch resource: HTTP Status ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Handles the video pathfinding routine.
 * @param {import('discord.js').Message} message
 * @param {import('discord.js').Attachment} videoAtt
 */
async function handleVideoProcessing(message, videoAtt) {
  const statusMessage = await message.reply('🎥 Initializing video frame-by-frame A* matrix analysis… please stand by.').catch(() => null);
  try {
    const videoBuffer = await fetchAttachmentBuffer(videoAtt.url);
    const maxSize = CONFIG.MAX_VIDEO_SIZE_MB * 1024 * 1024;
    if (videoBuffer.length > maxSize) {
      await statusMessage?.edit({ content: `⚠️ **Error:** Video exceeds the maximum allowable threshold of ${CONFIG.MAX_VIDEO_SIZE_MB}MB.` });
      return;
    }
    const startTime = Date.now();
    const renderResult = await renderPathVideo(videoBuffer, {
      fps: CONFIG.DEFAULT_FPS,
      maxSeconds: CONFIG.DEFAULT_MAX_SECONDS,
      width: CONFIG.DEFAULT_WIDTH,
    });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const isFound = renderResult.found;
    const resultEmbed = new EmbedBuilder()
      .setColor(isFound ? CONFIG.COLORS.SUCCESS : CONFIG.COLORS.FAILURE)
      .setTitle(isFound ? '🟢 Video Path Successfully Traced' : '🔴 Navigation Route Blocked')
      .setDescription('Per-frame **A\\*** algorithm matrix traversal. Dark regions represent dynamic obstacles; green traces the optimal path.')
      .addFields(
        { name: 'Processed Frames', value: String(renderResult.frames), inline: true },
        { name: 'Processing Time', value: `${duration}s`, inline: true },
        { name: 'Resolution Profile', value: `${CONFIG.DEFAULT_WIDTH}px width`, inline: true },
      )
      .setFooter({ text: '2D Video Navigation Engine • Proximity metrics active' })
      .setTimestamp();
    const outputAttachment = new AttachmentBuilder(renderResult.mp4, { name: 'navigated_path.mp4' });
    await statusMessage?.edit({
      content: '',
      embeds: [resultEmbed],
      files: [outputAttachment],
    });
  } catch (error) {
    console.error(`[VideoPath Error]: ${error.message}`);
    await statusMessage?.edit({ content: `⚠️ Video processing failed: ${error.message}` }).catch(() => {});
  }
}

/**
 * Handles the batch photo pathfinding routine.
 * @param {import('discord.js').Message} message
 * @param {import('discord.js').Attachment[]} imageAtts
 */
async function handlePhotoProcessing(message, imageAtts) {
  const statusMessage = await message.reply(`🧭 Detecting obstacles & routing (A*) on ${imageAtts.length} photo(s)…`).catch(() => null);
  let globalRouteFound = false;
  const processedFiles = [];
  const processingErrors = [];

  for (const [index, attachment] of imageAtts.entries()) {
    const identifier = attachment.name || `image_${index + 1}`;
    try {
      console.log(`[PhotoPath] Fetching asset: ${identifier} (${attachment.size ?? 'unknown'} bytes)...`);
      const buffer = await fetchAttachmentBuffer(attachment.url);
      console.log(`[PhotoPath] Executing grid render for ${identifier}...`);
      const renderStartTime = Date.now();
      const result = await renderPathFromImage(buffer, { cols: CONFIG.DEFAULT_COLS });
      const renderDuration = Date.now() - renderStartTime;
      console.log(`[PhotoPath] Completed ${identifier}: found=${result.found} in ${renderDuration}ms`);
      globalRouteFound = globalRouteFound || result.found;
      const prefix = result.found ? 'path_' : 'nopath_';
      const cleanName = identifier.replace(/\.[^/.]+$/, '');
      processedFiles.push(new AttachmentBuilder(result.png, { name: `${prefix}${cleanName}.png` }));
    } catch (error) {
      console.error(`[PhotoPath Error] Failed on ${identifier}:`, error.message);
      processingErrors.push(`\`${identifier}\`: ${error.message}`);
    }
  }

  if (processedFiles.length === 0) {
    await statusMessage?.edit({
      content: `⚠️ **Batch Processing Error:** All attached images failed execution.\n${processingErrors.join('\n')}`,
      embeds: [],
      files: [],
    }).catch(() => {});
    return;
  }

  const summaryEmbed = new EmbedBuilder()
    .setColor(globalRouteFound ? CONFIG.COLORS.SUCCESS : CONFIG.COLORS.FAILURE)
    .setTitle(globalRouteFound ? '🟢 Optimal Routes Identified' : '🔴 No Viable Path Matrix Found')
    .setDescription('**A\\*** path matrix evaluation over detected obstacle layouts (floor-color segmentation).\n🟢 Path • 🟦 Start Point • 🟨 Goal • 🟥 Obstacles')
    .setFooter({ text: imageAtts.length > 1 ? 'Batch 2D Photo Navigation Grid' : 'Standard Bottom-Center → Top-Center Trace' })
    .setTimestamp();

  const totalPayloadBytes = processedFiles.reduce((acc, file) => acc + (file.attachment?.length || 0), 0);
  try {
    const warningNotice = processingErrors.length > 0 ? `⚠️ **Partial Batch Warnings:**\n${processingErrors.join('\n')}` : '';
    await statusMessage?.edit({
      content: warningNotice,
      embeds: [summaryEmbed],
      files: processedFiles,
    });
    console.log(`[PhotoPath] Successfully dispatched batch response (${processedFiles.length} files, ${totalPayloadBytes} bytes).`);
  } catch (error) {
    console.error(`[PhotoPath Dispatch Error]: ${error.message}`);
    await statusMessage?.edit({
      content: `⚠️ Route matrices rendered, but dispatch payload failed: ${error.message} (Payload: ${(totalPayloadBytes / 1048576).toFixed(1)}MB)`,
      embeds: [],
      files: [],
    }).catch(() => {});
  }
}

/**
 * Main entry point for processing pathfinder commands.
 * @param {import('discord.js').Message} message
 * @returns {Promise<boolean>}
 */
export async function handlePathText(message) {
  const content = message.content || '';
  if (!CONFIG.COMMAND_PREFIX.test(content.trim())) return false;

  console.log(`[PathCommand] Triggered by user: ${message.author?.tag} | Attachments: ${message.attachments.size}`);

  const attachments = [...message.attachments.values()];
  const targetVideo = attachments.find(isVideo);
  const targetImages = attachments.filter(isImage).slice(0, CONFIG.MAX_IMAGES_BATCH);

  if (targetVideo) {
    await handleVideoProcessing(message, targetVideo);
    return true;
  }

  if (targetImages.length === 0) {
    await message.reply({
      content: '📐 **Usage Instructions:** Attach a **photo** (to calculate an A* obstacle avoidance route) or a **video** (for frame-by-frame tracing). Dark pixel zones act as obstacles.',
    }).catch(() => {});
    return true;
  }

  await handlePhotoProcessing(message, targetImages);
  return true;
}
