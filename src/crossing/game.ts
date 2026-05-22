/**
 * game.ts — Game state machine for Critter Crossing v2.
 *
 * 8×8 board, 5 units per side, first to score 3 wins.
 */

import type { CGameState, CUnit, PlayerId, Vec2, AIDifficulty } from './types';
import { DEFAULT_ARMY, getUnitDef } from './units';
import { getValidMoves, executeMove } from './moves';

const SCORE_TO_WIN = 3;

export function createCrossingGame(difficulty: AIDifficulty = 'normal'): CGameState {
  const units: CUnit[] = [];
  let id = 1;

  // Player A: row 0 (bottom)
  // Place 5 units spread across the row
  const placements = [1, 2, 3, 4, 6]; // columns — leave 0,5,7 empty for breathing room
  for (let i = 0; i < DEFAULT_ARMY.length; i++) {
    units.push({
      unitId: id++,
      defId: DEFAULT_ARMY[i],
      owner: 'A',
      pos: { x: placements[i], y: 0 },
      scored: false,
      cooldown: 0,
    });
  }

  // Player B: row 7 (top), mirrored
  const placementsB = [6, 5, 4, 3, 1]; // mirrored
  for (let i = 0; i < DEFAULT_ARMY.length; i++) {
    units.push({
      unitId: id++,
      defId: DEFAULT_ARMY[i],
      owner: 'B',
      pos: { x: placementsB[i], y: 7 },
      scored: false,
      cooldown: 0,
    });
  }

  return {
    units,
    nextUnitId: id,
    phase: 'playing',
    currentPlayer: 'A',
    scored: { A: 0, B: 0 },
    scoreToWin: SCORE_TO_WIN,
    winner: null,
    selectedUnitId: null,
    turn: 1,
    vfx: [],
    hoverTile: null,
    lastMove: null,
    events: [],
    difficulty,
  };
}

export function getMovableUnits(state: CGameState): CUnit[] {
  return state.units.filter(u =>
    u.owner === state.currentPlayer && getValidMoves(state, u).length > 0
  );
}

export function hasAnyMoves(state: CGameState, player: PlayerId): boolean {
  return state.units.some(u =>
    u.owner === player && getValidMoves(state, u).length > 0
  );
}

export function skipTurnIfNeeded(state: CGameState): boolean {
  if (!hasAnyMoves(state, state.currentPlayer)) {
    state.currentPlayer = state.currentPlayer === 'A' ? 'B' : 'A';
    state.turn++;
    return true;
  }
  return false;
}

/**
 * Perform a move. Returns false if invalid.
 */
export function performMove(state: CGameState, unitId: number, to: Vec2): boolean {
  const unit = state.units.find(u => u.unitId === unitId && u.owner === state.currentPlayer);
  if (!unit) return false;

  const validMoves = getValidMoves(state, unit);
  const move = validMoves.find(m => m.to.x === to.x && m.to.y === to.y);
  if (!move) return false;

  const result = executeMove(state, unitId, move);
  const now = performance.now();
  const def = getUnitDef(unit.defId);
  const ownerLabel = unit.owner === 'A' ? 'You' : 'AI';

  // Track last move
  state.lastMove = { unitId, from: unit.animFrom!, to: { ...to } };

  // Event log
  let eventText = `${ownerLabel} moved ${def.displayName}`;
  let eventIcon = def.emoji;
  if (result.captured) {
    const capDef = getUnitDef(state.units.find(u => u.unitId === result.captured!.unitId)!.defId);
    eventText = `${ownerLabel}'s ${def.displayName} captured ${capDef.displayName}!`;
    eventIcon = '\u{2694}'; // crossed swords
  } else if (result.pushed) {
    const pushDef = getUnitDef(state.units.find(u => u.unitId === result.pushed!.unitId)!.defId);
    eventText = `${ownerLabel}'s ${def.displayName} pushed ${pushDef.displayName}`;
    eventIcon = '\u{1F4A8}'; // dash
  }
  if (result.scored) {
    eventText += ` \u{2014} Scored!`;
    eventIcon = '\u{2B50}'; // star
  }
  state.events.push({ turn: state.turn, owner: unit.owner, text: eventText, icon: eventIcon, time: now });
  // Keep last 12 events
  if (state.events.length > 12) state.events.shift();

  // VFX
  if (result.scored) {
    state.vfx.push({
      type: 'score-flash',
      pos: { ...to },
      size: 1,
      owner: unit.owner,
      startTime: now + 180,
      duration: 1000,
    });
  }
  if (result.captured) {
    state.vfx.push({
      type: 'capture',
      pos: result.captured.sentTo,
      size: 1,
      owner: state.units.find(u => u.unitId === result.captured!.unitId)!.owner,
      startTime: now,
      duration: 750,
    });
  }
  if (result.pushed) {
    state.vfx.push({
      type: 'push',
      pos: result.pushed.to,
      size: 1,
      owner: state.units.find(u => u.unitId === result.pushed!.unitId)!.owner,
      startTime: now,
      duration: 400,
    });
  }

  // Apply scoring cooldown: unit just scored = exhausted for 1 turn
  if (result.scored && unit.scored) {
    unit.cooldown = 1;
  }

  // Check win
  if (state.scored[unit.owner] >= state.scoreToWin) {
    state.winner = unit.owner;
    state.phase = 'ended';
  }

  // Advance turn — tick down cooldowns for the player whose turn is ending
  if (state.phase !== 'ended') {
    // Tick cooldowns for all units of the current player (whose turn just ended)
    for (const u of state.units) {
      if (u.owner === state.currentPlayer && u.cooldown > 0) {
        u.cooldown--;
      }
    }
    state.currentPlayer = state.currentPlayer === 'A' ? 'B' : 'A';
    state.turn++;
  }

  state.selectedUnitId = null;
  return true;
}
