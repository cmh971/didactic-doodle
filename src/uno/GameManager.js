import { Game } from './Game.js';

/**
 * The Ultimate Game Manager
 * - Multi-indexed
 * - Event-driven
 * - Auto-cleaning
 * - Debuggable
 * - Esports-grade performance
 */
class GameManager {
  constructor() {
    // Primary index: channelId -> Game
    this.games = new Map();

    // Secondary index: userId -> Set<Game>
    this.playerIndex = new Map();

    // Debug + analytics
    this.stats = {
      created: 0,
      deleted: 0,
      active: 0,
      lookups: 0,
      playerSearches: 0
    };

    // Event listeners
    this.listeners = {
      create: new Set(),
      delete: new Set(),
      update: new Set()
    };
  }

  // -------------------------------------------------------
  // EVENT SYSTEM
  // -------------------------------------------------------
  on(event, fn) {
    if (this.listeners[event]) {
      this.listeners[event].add(fn);
    }
  }

  emit(event, payload) {
    if (this.listeners[event]) {
      for (const fn of this.listeners[event]) fn(payload);
    }
  }

  // -------------------------------------------------------
  // INTERNAL INDEX HELPERS
  // -------------------------------------------------------
  _indexPlayer(game) {
    for (const player of game.players.values()) {
      const id = player.id;
      if (!this.playerIndex.has(id)) {
        this.playerIndex.set(id, new Set());
      }
      this.playerIndex.get(id).add(game);
    }
  }

  _unindexPlayer(game) {
    for (const player of game.players.values()) {
      const id = player.id;
      const set = this.playerIndex.get(id);
      if (set) {
        set.delete(game);
        if (set.size === 0) this.playerIndex.delete(id);
      }
    }
  }

  // -------------------------------------------------------
  // GETTERS
  // -------------------------------------------------------
  get(channelId) {
    this.stats.lookups++;
    return this.games.get(channelId);
  }

  /**
   * Find ANY game a user is in.
   * Ultra-fast thanks to secondary index.
   */
  findGameByPlayer(userId) {
    this.stats.playerSearches++;
    const set = this.playerIndex.get(userId);
    if (!set || set.size === 0) return undefined;
    return [...set][0]; // first game
  }

  // -------------------------------------------------------
  // CREATE GAME
  // -------------------------------------------------------
  create(channelId, hostId) {
    // Prevent duplicates
    if (this.games.has(channelId)) {
      return this.games.get(channelId);
    }

    const game = new Game(channelId, hostId);
    this.games.set(channelId, game);

    this._indexPlayer(game);

    this.stats.created++;
    this.stats.active++;

    this.emit('create', game);

    return game;
  }

  // -------------------------------------------------------
  // DELETE GAME
  // -------------------------------------------------------
  delete(channelId) {
    const game = this.games.get(channelId);
    if (!game) return false;

    this._unindexPlayer(game);

    this.games.delete(channelId);

    this.stats.deleted++;
    this.stats.active--;

    this.emit('delete', game);

    return true;
  }

  // -------------------------------------------------------
  // AUTO-CLEANUP (optional)
  // -------------------------------------------------------
  cleanupInactive(maxAgeMs = 1000 * 60 * 30) {
    const now = Date.now();
    for (const [channelId, game] of this.games.entries()) {
      if (now - game.lastActive > maxAgeMs) {
        this.delete(channelId);
      }
    }
  }

  // -------------------------------------------------------
  // DEBUG / INSPECTION
  // -------------------------------------------------------
  debug() {
    return {
      stats: { ...this.stats },
      activeGames: this.games.size,
      indexedPlayers: this.playerIndex.size
    };
  }
}

export const gameManager = new GameManager();
