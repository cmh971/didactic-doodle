// Thin wrapper over @discordjs/voice so /play and /stopaudio stay tiny.
// Uses the pure-JS stack (opusscript + libsodium-wrappers) — no native builds.
import {
  joinVoiceChannel, createAudioPlayer, createAudioResource,
  AudioPlayerStatus, getVoiceConnection, NoSubscriberBehavior,
} from '@discordjs/voice';

// One player per guild so a new /play replaces the old track cleanly.
const players = new Map();

export function playFileInChannel(voiceChannel, filePath) {
  const guildId = voiceChannel.guild.id;
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: true,
  });

  let player = players.get(guildId);
  if (!player) {
    player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    player.on('error', (e) => console.error('voice player error:', e.message));
    player.on(AudioPlayerStatus.Idle, () => {
      // Auto-disconnect when the track finishes (nothing left to play).
      const conn = getVoiceConnection(guildId);
      if (conn) { try { conn.destroy(); } catch { /* already gone */ } }
    });
    players.set(guildId, player);
  }

  const resource = createAudioResource(filePath); // ffmpeg transcodes via FFMPEG_PATH
  connection.subscribe(player);
  player.play(resource);
  return player;
}

export function leaveVoice(guildId) {
  const conn = getVoiceConnection(guildId);
  if (conn) { try { conn.destroy(); } catch { /* ignore */ } players.delete(guildId); return true; }
  return false;
}
