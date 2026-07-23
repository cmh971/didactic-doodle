// Music metadata + 30s previews — powered by Apple's iTunes Search API.
// NO account, NO API key, NO paywall (we dropped Spotify after their Feb 2026
// Developer-Mode changes started requiring Premium). Public catalog search only.
// Kept the filename + export names so the rest of the bot didn't have to change.

// Always available — there's nothing to configure.
export function spotifyEnabled() { return true; }

// Search a track; returns a tidy object or null if nothing matched.
export async function searchTrack(query) {
  const url = `https://itunes.apple.com/search?media=music&entity=song&limit=1&term=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'SentinelBot/1.0' } });
  if (!res.ok) throw new Error(`music search failed (${res.status})`);
  const j = await res.json();
  const it = j.results?.[0];
  if (!it) return null;
  return {
    name: it.trackName,
    artists: it.artistName,
    album: it.collectionName || null,
    // artworkUrl100 is a 100x100 thumb — bump it to 600x600 for a crisp image.
    art: it.artworkUrl100 ? it.artworkUrl100.replace('100x100bb', '600x600bb') : null,
    preview: it.previewUrl || null, // 30s AAC preview, or null
    url: it.trackViewUrl || null, // opens in Apple Music / iTunes
    durationMs: it.trackTimeMillis || 0,
  };
}
