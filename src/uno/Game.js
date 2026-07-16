// UNO Game Engine v4 — FIRE EDITION
// • Same rules, cleaner flow, richer state, DM-coach ready
// • Modes: classic, flip, allwild, nomercy, seven_o, force_play, draw_to_match

import { shuffle, cardLabel } from "./Deck.js";
import {
  buildDeckForMode,
  DRAW_AMOUNT,
  isDrawValue,
  isWildValue,
  LIGHT_COLORS,
  DARK_COLORS,
} from "./rules.js";

export class Game {
  constructor(channelId, hostId) {
    this.channelId = channelId;
    this.hostId = hostId;

    this.players = []; // { id, username, hand: [] }
    this.started = false;
    this.finished = false;

    this.mode = "classic";
    this.houseRules = new Set();

    this.drawPile = [];
    this.discardPile = [];

    this.side = "light";        // flip side
    this.currentColor = null;   // active color

    this.currentIndex = 0;      // whose turn
    this.direction = 1;         // 1 = clockwise, -1 = counter

    this.pendingDraw = 0;       // stacked draw amount
    this.drawnThisTurn = false; // did current player draw already
    this.pendingSwap = null;    // playerId who must swap
    this.calledUno = new Set(); // playerIds who called UNO

    this.winnerId = null;
    this.lastAction = "Game created. Waiting for players to join.";

    this.createdAt = Date.now();
    this.lastActive = Date.now();
  }

  // -------------------------------------------------------
  // INTERNAL TOUCH
  // -------------------------------------------------------
  _touch(message = null) {
    this.lastActive = Date.now();
    if (message) this.lastAction = message;
  }

  // -------------------------------------------------------
  // CONFIGURATION
  // -------------------------------------------------------
  get stackingEnabled() {
    return this.mode === "nomercy" || this.houseRules.has("stacking");
  }

  colorChoices() {
    return this.mode === "flip" && this.side === "dark"
      ? DARK_COLORS
      : LIGHT_COLORS;
  }

  face(card) {
    if (card && card.light && card.dark) return card[this.side];
    return card;
  }

  // -------------------------------------------------------
  // STATE SNAPSHOT (for DM coach / debug / logs)
  // -------------------------------------------------------
  getState() {
    return {
      channelId: this.channelId,
      hostId: this.hostId,
      mode: this.mode,
      houseRules: [...this.houseRules],
      started: this.started,
      finished: this.finished,
      side: this.side,
      currentColor: this.currentColor,
      currentIndex: this.currentIndex,
      direction: this.direction,
      pendingDraw: this.pendingDraw,
      pendingSwap: this.pendingSwap,
      calledUno: [...this.calledUno],
      winnerId: this.winnerId,
      players: this.players.map((p) => ({
        id: p.id,
        username: p.username,
        handSize: p.hand.length,
      })),
      lastAction: this.lastAction,
      createdAt: this.createdAt,
      lastActive: this.lastActive,
    };
  }

  // -------------------------------------------------------
  // PLAYERS
  // -------------------------------------------------------
  getPlayer(id) {
    return this.players.find((p) => p.id === id);
  }

  addPlayer(id, username) {
    if (this.started)
      return { ok: false, reason: "The game has already started." };
    if (this.getPlayer(id)) return { ok: false, reason: "You already joined." };
    if (this.players.length >= 10)
      return { ok: false, reason: "This game is full (10 players)." };

    this.players.push({ id, username, hand: [] });
    this._touch(`➕ ${username} joined the game.`);
    return { ok: true };
  }

  removePlayer(id) {
    const idx = this.players.findIndex((p) => p.id === id);
    if (idx === -1)
      return { ok: false, reason: "You are not in this game." };

    const [removed] = this.players.splice(idx, 1);
    if (this.started && idx < this.currentIndex) this.currentIndex--;
    if (this.currentIndex >= this.players.length) this.currentIndex = 0;

    this._touch(`➖ ${removed.username} left the game.`);
    return { ok: true };
  }

  get currentPlayer() {
    return this.players[this.currentIndex];
  }

  get topCard() {
    return this.discardPile[this.discardPile.length - 1];
  }

  topFace() {
    return this.face(this.topCard);
  }

  // -------------------------------------------------------
  // DECK
  // -------------------------------------------------------
  draw(n) {
    const drawn = [];
    for (let i = 0; i < n; i++) {
      if (this.drawPile.length === 0) this._reshuffle();
      if (this.drawPile.length === 0) break;
      drawn.push(this.drawPile.pop());
    }
    return drawn;
  }

  _reshuffle() {
    if (this.discardPile.length <= 1) return;
    const top = this.discardPile.pop();
    this.drawPile = shuffle(this.discardPile);
    this.discardPile = [top];
  }

  drawTo(player, n) {
    player.hand.push(...this.draw(n));
    this._mercyCheck(player);
  }

  _mercyCheck(player) {
    if (this.mode !== "nomercy") return;
    if (player.hand.length >= 25 && this.getPlayer(player.id)) {
      const wasBefore = this.players.indexOf(player) <= this.currentIndex;
      this.removePlayer(player.id);
      this._touch(
        `💀 ${player.username} hit 25 cards and is OUT (No Mercy)!`
      );
      if (this.players.length === 1) {
        this.finished = true;
        this.winnerId = this.players[0].id;
      }
      if (wasBefore && !this.finished) {
        this.currentIndex = 0;
      }
    }
  }

  // -------------------------------------------------------
  // START
  // -------------------------------------------------------
  canStart() {
    if (this.started) return { ok: false, reason: "Already started." };
    if (this.players.length < 2)
      return { ok: false, reason: "Need at least 2 players to start." };
    return { ok: true };
  }

  start() {
    const check = this.canStart();
    if (!check.ok) return check;

    this.side = "light";
    this.drawPile = shuffle(buildDeckForMode(this.mode));
    for (const player of this.players) player.hand = this.draw(7);

    let first = this.draw(1)[0];
    let guard = 0;
    while (
      this.face(first).color === "wild" &&
      this.mode !== "allwild" &&
      guard < 60
    ) {
      this.drawPile.unshift(first);
      first = this.draw(1)[0];
      guard++;
    }

    this.discardPile = [first];
    const f = this.face(first);
    this.currentColor = f.color === "wild" ? this.colorChoices()[0] : f.color;

    this.started = true;
    this.finished = false;
    this.currentIndex = 0;
    this.direction = 1;
    this.pendingDraw = 0;
    this.pendingSwap = null;
    this.calledUno.clear();
    this.winnerId = null;

    this._touch(
      `Game started in **${this.mode}** mode! First card: ${cardLabel(f)}.`
    );
    return { ok: true };
  }

  // -------------------------------------------------------
  // PLAYABILITY
  // -------------------------------------------------------
  isPlayable(card) {
    const face = this.face(card);
    const top = this.topFace();
    if (this.pendingDraw > 0) return isDrawValue(face.value);
    if (face.color === "wild") return true;
    if (face.color === this.currentColor) return true;
    if (face.value === top.value) return true;
    return false;
  }

  playableIndexes(player) {
    return player.hand
      .map((card, i) => ({ card, i }))
      .filter(({ card }) => this.isPlayable(card));
  }

  advance(steps = 1) {
    const n = this.players.length;
    if (n === 0) return;
    this.currentIndex =
      (((this.currentIndex + this.direction * steps) % n) + n) % n;
    this.drawnThisTurn = false;
    this._touch(this.lastAction);
  }

  // -------------------------------------------------------
  // PLAY CARD
  // -------------------------------------------------------
  playCard(playerId, handIndex, chosenColor = null) {
    if (!this.started) return { ok: false, reason: "The game has not started." };
    if (this.finished) return { ok: false, reason: "The game is over." };
    if (this.pendingSwap)
      return { ok: false, reason: "A hand swap is in progress." };

    const player = this.currentPlayer;
    if (!player || player.id !== playerId)
      return { ok: false, reason: "It is not your turn." };

    const card = player.hand[handIndex];
    if (!card) return { ok: false, reason: "Invalid card." };
    const face = this.face(card);

    if (this.pendingDraw > 0 && !isDrawValue(face.value)) {
      return {
        ok: false,
        reason: `You must stack a Draw card or take ${this.pendingDraw} cards.`,
      };
    }
    if (this.pendingDraw === 0 && !this.isPlayable(card)) {
      return {
        ok: false,
        reason: `You can't play ${cardLabel(face)} right now.`,
      };
    }
    if (isWildValue(face.value) && !this.colorChoices().includes(chosenColor)) {
      return { ok: false, reason: "pick-color", handIndex };
    }

    player.hand.splice(handIndex, 1);
    this.discardPile.push(card);
    this.currentColor = isWildValue(face.value) ? chosenColor : face.color;
    if (player.hand.length !== 1) this.calledUno.delete(player.id);

    let message = `${player.username} played ${cardLabel(face)}`;
    if (isWildValue(face.value) && face.value !== "wildcolor")
      message += ` (chose ${chosenColor})`;

    if (player.hand.length === 0) {
      this.finished = true;
      this.winnerId = player.id;
      this._touch(`${message}. 🎉 ${player.username} wins!`);
      return { ok: true, won: true, message: this.lastAction };
    }

    if (
      this.houseRules.has("seven_o") &&
      face.value === "7" &&
      this.players.length > 1
    ) {
      this.pendingSwap = player.id;
      this._touch(
        `${message}. 🔁 ${player.username} must choose someone to swap hands with.`
      );
      return { ok: true, needSwap: true, message: this.lastAction };
    }

    message += this._resolveEffect(player, face, chosenColor);

    if (player.hand.length === 1 && !this.calledUno.has(player.id)) {
      message += `. ⚠️ ${player.username} has UNO! (didn't call it)`;
    }
    this._touch(message + ".");
    return { ok: true, message: this.lastAction };
  }

  _resolveEffect(player, face, chosenColor) {
    const v = face.value;

    if (this.houseRules.has("seven_o") && v === "0") {
      this._rotateHands();
      this.advance(1);
      return ". 🔄 All hands rotated!";
    }
    if (isDrawValue(v)) return this._resolveDraw(face);

    switch (v) {
      case "skip":
      case "wildskip": {
        this.advance(1);
        const name = this.currentPlayer.username;
        this.advance(1);
        return `. ${name} is skipped`;
      }
      case "reverse":
      case "wildreverse":
        this.direction *= -1;
        if (this.players.length === 2) this.advance(2);
        else this.advance(1);
        return ". Order reversed";
      case "skipall":
        return ". 😈 Everyone else skipped — you go again!";
      case "discardall": {
        const before = player.hand.length;
        const removed = player.hand.filter(
          (c) => this.face(c).color === face.color
        );
        player.hand = player.hand.filter(
          (c) => this.face(c).color !== face.color
        );
        this.discardPile.push(...removed);
        this.advance(1);
        return `. 🗑️ Discarded all ${face.color} cards (${
          before - player.hand.length
        })`;
      }
      case "wildcolor":
        return this._colorRoulette(chosenColor);
      case "flip": {
        this.side = this.side === "light" ? "dark" : "light";
        this.currentColor = this.topFace().color;
        this.advance(1);
        return `. 🔃 FLIP! Now on the **${this.side}** side`;
      }
      default:
        this.advance(1);
        return "";
    }
  }

  _resolveDraw(face) {
    const amount = DRAW_AMOUNT[face.value];
    if (this.stackingEnabled) {
      this.pendingDraw += amount;
      this.advance(1);
      return `. +${amount}! Stack is now **${this.pendingDraw}** — ${this.currentPlayer.username} must stack or draw`;
    }
    this.advance(1);
    const victim = this.currentPlayer;
    this.drawTo(victim, amount);
    this.advance(1);
    return `. ${victim.username} draws ${amount} and is skipped`;
  }

  _colorRoulette(color) {
    this.advance(1);
    const victim = this.currentPlayer;
    let count = 0;
    let guard = 0;
    while (guard < 60) {
      const [c] = this.draw(1);
      if (!c) break;
      victim.hand.push(c);
      count++;
      guard++;
      if (this.face(c).color === color) break;
    }
    this._mercyCheck(victim);
    this.advance(1);
    return `. 🎯 ${victim.username} drew ${count} until ${color}, and is skipped`;
  }

  _rotateHands() {
    const hands = this.players.map((p) => p.hand);
    if (this.direction === 1) hands.unshift(hands.pop());
    else hands.push(hands.shift());
    this.players.forEach((p, i) => (p.hand = hands[i]));
  }

  // -------------------------------------------------------
  // SWAP / STACK
  // -------------------------------------------------------
  completeSwap(playerId, targetId) {
    if (this.pendingSwap !== playerId)
      return { ok: false, reason: "No swap is pending for you." };
    const me = this.getPlayer(playerId);
    const target = this.getPlayer(targetId);
    if (!target || target.id === me.id)
      return { ok: false, reason: "Pick a different player." };
    [me.hand, target.hand] = [target.hand, me.hand];
    this.pendingSwap = null;
    this.advance(1);
    this._touch(`🔁 ${me.username} swapped hands with ${target.username}.`);
    return { ok: true };
  }

  takeStack(playerId) {
    if (this.pendingDraw <= 0)
      return { ok: false, reason: "There is no stack to take." };
    if (this.currentPlayer.id !== playerId)
      return { ok: false, reason: "It is not your turn." };
    const player = this.currentPlayer;
    const n = this.pendingDraw;
    this.pendingDraw = 0;
    this.drawTo(player, n);
    if (!this.finished) this.advance(1);
    this._touch(`${player.username} took the stack and drew ${n} cards.`);
    return { ok: true, drew: n };
  }

  // -------------------------------------------------------
  // DRAW / PASS
  // -------------------------------------------------------
  drawForTurn(playerId) {
    if (!this.started || this.finished)
      return { ok: false, reason: "Game not active." };
    if (this.pendingDraw > 0) return { ok: false, reason: "stack" };
    const player = this.currentPlayer;
    if (!player || player.id !== playerId)
      return { ok: false, reason: "It is not your turn." };
    if (
      this.houseRules.has("force_play") &&
      this.playableIndexes(player).length > 0
    ) {
      return {
        ok: false,
        reason:
          "Force Play is on — you have a playable card and must play it.",
      };
    }

    let last = null;
    let count = 0;
    do {
      const [card] = this.draw(1);
      if (!card) break;
      player.hand.push(card);
      last = card;
      count++;
    } while (
      this.houseRules.has("draw_to_match") &&
      last &&
      !this.isPlayable(last) &&
      count < 40
    );

    this.calledUno.delete(player.id);
    this.drawnThisTurn = true;
    this._mercyCheck(player);
    if (!last) return { ok: false, reason: "No cards left to draw." };

    const playable = this.isPlayable(last);
    this._touch(
      `${player.username} drew ${count} card${count === 1 ? "" : "s"}.`
    );
    return { ok: true, card: this.face(last), playable, count };
  }

  pass(playerId) {
    if (this.currentPlayer.id !== playerId)
      return { ok: false, reason: "It is not your turn." };
    if (!this.drawnThisTurn)
      return { ok: false, reason: "You must draw a card before passing." };
    this.advance(1);
    this._touch(`Turn passed to ${this.currentPlayer.username}.`);
    return { ok: true };
  }

  // -------------------------------------------------------
  // UNO
  // -------------------------------------------------------
  callUno(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) return { ok: false, reason: "You are not in this game." };
    if (player.hand.length > 2)
      return { ok: false, reason: "You can only call UNO with 1 or 2 cards." };
    this.calledUno.add(playerId);
    this._touch(`📣 ${player.username} called UNO!`);
    return { ok: true };
  }
}
