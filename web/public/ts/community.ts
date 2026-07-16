// TypeScript — typed dashboard client for the community API.
// Build: `tsc web/public/ts/community.ts --outDir web/public/js`
export interface Widget {
  type: string;
  title: string;
  config: Record<string, unknown>;
}

export interface CommunityConfig {
  guildId: string;
  customSubdomainOrId: string;
  communityName: string;
  themeColor: string;
  homePageMarkdown: string;
  verificationRequired: boolean;
  isApproved: boolean;
  widgets: Widget[];
}

export type Unsubscribe = () => void;

/** Live-subscribe to a community's config via Server-Sent Events. */
export function subscribeCommunity(id: string, onUpdate: (cfg: CommunityConfig) => void): Unsubscribe {
  const es = new EventSource(`/api/community/${encodeURIComponent(id)}/stream`);
  es.onmessage = (ev: MessageEvent<string>) => {
    try {
      onUpdate(JSON.parse(ev.data) as CommunityConfig);
    } catch {
      /* ignore malformed frame */
    }
  };
  return () => es.close();
}

/** Fetch the current config once. */
export async function getCommunity(id: string): Promise<CommunityConfig> {
  const res = await fetch(`/api/community/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as CommunityConfig;
}
