// Permanent Cloudflare NAMED tunnel runner (replaces the old quick-tunnel manager).
// Runs under PM2 as app "tunnel". Points sentinelbothq.com → localhost:3000 via the
// named tunnel "sentinel" (config at %USERPROFILE%\.cloudflared\config.yml).
// The URL is now permanent, so this no longer rewrites .env — set it once, done forever.
import { spawn } from 'node:child_process';
import path from 'node:path';

const CF = process.env.CLOUDFLARED_BIN || path.join(process.env.LOCALAPPDATA || '', 'cloudflared', 'cloudflared.exe');

console.log('[tunnel] starting permanent named tunnel "sentinel" → sentinelbothq.com');
const cf = spawn(CF, ['tunnel', 'run', 'sentinel'], { shell: false, stdio: 'inherit' });
cf.on('exit', (code) => { console.error('[tunnel] cloudflared exited (' + code + ') — PM2 will relaunch'); process.exit(1); });
