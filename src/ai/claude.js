// Claude (Anthropic) wrapper — sits ALONGSIDE Gemini (Ash), not replacing it.
// The bot can now switch the /ask brain between Gemini and Claude, or combine them.
//
// Activate by adding ANTHROPIC_API_KEY to .env (get one at https://platform.claude.com
// → API keys). Until then claudeAvailable() is false and the bot stays on Gemini.
import Anthropic from '@anthropic-ai/sdk';

// Friendly names → real model IDs. Opus = smartest (pricey), Haiku = cheapest.
export const CLAUDE_MODELS = {
  opus: 'claude-opus-4-8',     // $5 / $25 per 1M tokens — best quality
  sonnet: 'claude-sonnet-4-6', // $3 / $15 — balanced (good bot default)
  haiku: 'claude-haiku-4-5',   // $1 / $5  — fastest & cheapest
};

let _client = null;
function client() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return (_client ??= new Anthropic()); // SDK reads ANTHROPIC_API_KEY from env
}

export function claudeAvailable() { return !!process.env.ANTHROPIC_API_KEY; }

// Ask Claude a single question. Returns the text answer (or throws a friendly error).
//   model: 'opus' | 'sonnet' | 'haiku'  (default opus — the most capable)
export async function askClaude(prompt, { model = 'opus', system = null, maxTokens = 1024 } = {}) {
  const c = client();
  if (!c) throw new Error('Claude isn’t configured yet — add `ANTHROPIC_API_KEY` to `.env`.');
  const id = CLAUDE_MODELS[String(model).toLowerCase()] || CLAUDE_MODELS.opus;
  try {
    const msg = await c.messages.create({
      model: id,
      max_tokens: maxTokens,
      system: system || 'You are Ash, a friendly, sharp Discord assistant. Answer directly and concisely for a chat — no long preambles, just the useful answer.',
      messages: [{ role: 'user', content: String(prompt).slice(0, 8000) }],
    });
    if (msg.stop_reason === 'refusal') return '⚠️ Claude declined to answer that one.';
    const text = (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return text || '(Claude returned an empty response.)';
  } catch (e) {
    if (e?.status === 401) throw new Error('Claude rejected the API key (401) — check ANTHROPIC_API_KEY.');
    if (e?.status === 429) throw new Error('Claude is rate limited right now — try again shortly.');
    throw new Error(`Claude error: ${e?.message || e}`);
  }
}
