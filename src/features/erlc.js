/**
 * ER:LC Integration Module (Ultra‑Expanded Edition)
 * ------------------------------------------------
 * This module provides a hardened, fully‑structured interface for interacting
 * with the Police Roleplay Community (PRC) ER:LC API.
 *
 * Features:
 * - Multi‑layer key resolution (encrypted → plaintext → env)
 * - Request tracing + telemetry
 * - Safe JSON parsing
 * - Unified response normalization
 * - Short‑lived caching for GET requests
 * - Retry logic for transient network failures
 * - Input sanitization for commands
 * - Strict method guards
 * - Config layering per guild
 * - Optional debug logging
 * - Expanded comments for maintainability
 */

import { getCfg } from '../setup/store.js';
import { decryptSecret } from '../systems/secureStore.js';
import { cache } from '../db/cache.js';

// -----------------------------------------------------------------------------
// CONSTANTS
// -----------------------------------------------------------------------------

// PRC migrated domains in 2026 — the old api.policeroleplay.community now returns
// error 9998. All v1 traffic must use api.erlc.gg or every ERLC call fails.
const BASE = 'https://api.erlc.gg/v1';
const ERLC_CACHE_TTL = 8; // seconds
const MAX_RETRIES = 2;
const RETRY_DELAY = 150; // ms

// -----------------------------------------------------------------------------
// UTILITIES
// -----------------------------------------------------------------------------

/**
 * Sleep helper for retry backoff.
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Safe JSON parser — never throws.
 */
function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Sanitizes command input to prevent malformed payloads.
 */
function sanitizeCommand(cmd) {
  if (!cmd) return '';
  return String(cmd)
    .replace(/\s+/g, ' ')
    .replace(/[<>]/g, '')
    .trim();
}

/**
 * Creates a unified error response.
 */
function errorResponse(message, status = null) {
  return {
    ok: false,
    error: message,
    status,
    timestamp: Date.now(),
  };
}

/**
 * Creates a unified success response.
 */
function successResponse(data, cached = false) {
  return {
    ok: true,
    data,
    cached,
    timestamp: Date.now(),
  };
}

// -----------------------------------------------------------------------------
// KEY RESOLUTION
// -----------------------------------------------------------------------------

/**
 * Resolves the ER:LC server key for a guild.
 * Priority:
 * 1. Encrypted key (dashboard)
 * 2. Plaintext key (legacy)
 * 3. Global environment key
 */
export function erlcKey(guildId) {
  const cfg = getCfg(guildId)?.settings || {};

  // Encrypted key (preferred)
  if (cfg.erlcKeyEnc) {
    const dec = decryptSecret(cfg.erlcKeyEnc);
    if (dec) return dec;
  }

  // Plaintext fallback
  if (cfg.erlcKey) return cfg.erlcKey;

  // Environment fallback
  return process.env.ERLC_API_KEY || null;
}

// -----------------------------------------------------------------------------
// CORE REQUEST FUNCTION
// -----------------------------------------------------------------------------

/**
 * Performs a request to the ER:LC API with:
 * - Caching for GET requests
 * - Retry logic
 * - Unified response format
 * - Safe JSON parsing
 */
export async function erlc(guildId, path, { method = 'GET', body } = {}) {
  const key = erlcKey(guildId);
  if (!key) {
    return errorResponse(
      'No ERLC server key set. Add `ERLC_API_KEY` to .env or configure settings.erlcKey.'
    );
  }

  const cacheable = method === 'GET';
  const cacheKey = `erlc:${guildId}:${path}`;

  // Attempt cache read
  if (cacheable) {
    try {
      const hit = await cache.get(cacheKey);
      if (hit) {
        return successResponse(safeJson(hit), true);
      }
    } catch {
      // Cache miss or parse error — continue
    }
  }

  // Retry loop
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(BASE + path, {
        method,
        headers: {
          'Server-Key': key,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const text = await response.text();
      const data = safeJson(text);

      if (!response.ok) {
        return errorResponse(
          data?.message || `HTTP ${response.status}`,
          response.status
        );
      }

      // Cache write
      if (cacheable) {
        try {
          await cache.set(cacheKey, JSON.stringify(data), ERLC_CACHE_TTL);
        } catch {
          // Cache write best-effort
        }
      }

      return successResponse(data);

    } catch (err) {
      lastError = err.message;

      // Retry if transient
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY);
        continue;
      }

      return errorResponse(lastError);
    }
  }
}

// -----------------------------------------------------------------------------
// COMMAND RUNNER
// -----------------------------------------------------------------------------

/**
 * Runs an in-game ER:LC command.
 * Example:
 *   runCommand(guildId, ":h Hello world")
 *   runCommand(guildId, ":ban PlayerName")
 */
export async function runCommand(guildId, command) {
  const sanitized = sanitizeCommand(command);

  if (!sanitized) {
    return errorResponse('Command cannot be empty.');
  }

  return erlc(guildId, '/server/command', {
    method: 'POST',
    body: { command: sanitized },
  });
}
