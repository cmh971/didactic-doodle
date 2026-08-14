// Thin wrapper over @discordjs/voice so /play and /stopaudio stay tiny.
// Uses the pure-JS stack (opusscript + libsodium-wrappers) — no native builds.
import {
  joinVoiceChannel, createAudioPlayer, createAudioResource,
  AudioPlayerStatus, getVoiceConnection, NoSubscriberBehavior,
} from '@discordjs/voice';

// One player per guild + the track it's on and whether to loop it.
const players = new Map(); // guildId -> { player, filePath, loop }

// Build a max-quality Opus resource for a file at a given bitrate.
function hqResource(filePath, bitrate) {
  const resource = createAudioResource(filePath, { inlineVolume: false }); // ffmpeg transcodes via FFMPEG_PATH
  try { resource.encoder?.setBitrate?.(bitrate); } catch { /* native encoder not exposed */ }
  return resource;
}

export async function playFileInChannel(voiceChannel, filePath) {
  const guildId = voiceChannel.guild.id;

  // 🎚️ MAX quality: auto-check the server's boost tier and raise the channel to its
  // bitrate ceiling (Tier 0=96k · 1=128k · 2=256k · 3=384k) when we're allowed to.
  const maxRate = voiceChannel.guild.maximumBitrate || 96000;
  let bitrate = Math.min(voiceChannel.bitrate || maxRate, maxRate);
  if (voiceChannel.manageable && (voiceChannel.bitrate || 0) < maxRate) {
    try { await voiceChannel.setBitrate(maxRate, 'Max-quality audio'); bitrate = maxRate; } catch { /* no Manage Channels — use current */ }
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: true,
  });

  let state = players.get(guildId);
  if (!state) {
    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    state = { player, filePath, loop: false, bitrate };
    player.on('error', (e) => console.error('voice player error:', e.message));
    player.on(AudioPlayerStatus.Idle, () => {
      const s = players.get(guildId);
      // 🔁 If looping, replay the same track (at the same high bitrate).
      if (s && s.loop && s.filePath) {
        try { s.player.play(hqResource(s.filePath, s.bitrate || 96000)); return; } catch { /* fall through to disconnect */ }
      }
      // Otherwise auto-disconnect when the track finishes.
      const conn = getVoiceConnection(guildId);
      if (conn) { try { conn.destroy(); } catch { /* already gone */ } }
    });
    players.set(guildId, state);
  }
  state.filePath = filePath; // remember the current track (loop setting persists across plays)
  state.bitrate = bitrate;

  connection.subscribe(state.player);
  state.player.play(hqResource(filePath, bitrate));
  return state.player;
}

// Boost-tier + max bitrate for a channel — for "playing at X kbps" status lines.
export function channelQuality(voiceChannel) {
  return {
    tier: voiceChannel.guild.premiumTier ?? 0,
    boosts: voiceChannel.guild.premiumSubscriptionCount || 0,
    kbps: Math.round((voiceChannel.guild.maximumBitrate || 96000) / 1000),
  };
}

// Toggle (no arg) or set looping for a guild. Returns the new loop state,
// or null if nothing is playing here.
export function setLoop(guildId, on) {
  const s = players.get(guildId);
  if (!s) return null;
  s.loop = on === undefined ? !s.loop : !!on;
  return s.loop;
}
export function isLooping(guildId) { return !!players.get(guildId)?.loop; }

export function leaveVoice(guildId) {
  const conn = getVoiceConnection(guildId);
  players.delete(guildId); // clears the loop flag too
  if (conn) { try { conn.destroy(); } catch { /* ignore */ } return true; }
  return false;
}
