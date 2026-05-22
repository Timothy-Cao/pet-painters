/**
 * ai.ts — AI opponent for Critter Crossing.
 *
 * Evaluates all possible moves and picks the best one using a scoring heuristic.
 * Adds slight randomness so it doesn't feel robotic.
 */

import type { CGameState, Vec2, PlayerId } from './types';
import { getUnitDef } from './units';
import { getValidMoves, forwardDir } from './moves';
import { BOARD_SIZE, GOAL_ROW_A, GOAL_ROW_B } from './board';

interface ScoredMove {
  unitId: number;
  to: Vec2;
  score: number;
}

/**
 * Pick the best move for the current player.
 * Returns null if no moves are available.
 */
export function pickAIMove(state: CGameState): { unitId: number; to: Vec2 } | null {
  const player = state.currentPlayer;
  const candidates: ScoredMove[] = [];

  for (const unit of state.units) {
    if (unit.scored || unit.owner !== player) continue;
    const moves = getValidMoves(state, unit);
    for (const to of moves) {
      const score = evaluateMove(state, unit.unitId, unit.pos, to, player);
      candidates.push({ unitId: unit.unitId, to, score });
    }
  }

  if (candidates.length === 0) return null;

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Pick from top ~3 moves with slight randomness
  const topN = Math.min(3, candidates.length);
  const pick = Math.floor(Math.random() * topN);
  return { unitId: candidates[pick].unitId, to: candidates[pick].to };
}

function evaluateMove(
  state: CGameState,
  unitId: number,
  from: Vec2,
  to: Vec2,
  player: PlayerId,
): number {
  let score = 0;
  const def = getUnitDef(state.units.find(u => u.unitId === unitId)!.defId);
  // Forward progress: reward moving toward the goal
  const progressBefore = player === 'A' ? from.y : (BOARD_SIZE - 1 - from.y);
  const progressAfter = player === 'A' ? to.y : (BOARD_SIZE - 1 - to.y);
  score += (progressAfter - progressBefore) * 4;

  // Bonus for being close to scoring
  const goalRow = player === 'A' ? GOAL_ROW_A : GOAL_ROW_B;
  const distToGoal = player === 'A'
    ? Math.max(0, goalRow - to.y)
    : Math.max(0, to.y - goalRow);
  if (distToGoal <= 1) score += 8;

  // Massive bonus for actually scoring
  const wouldScore = player === 'A'
    ? to.y >= GOAL_ROW_A
    : to.y <= GOAL_ROW_B;
  // For 2×2, both rows of footprint must cross
  if (def.size === 2) {
    const allCross = player === 'A'
      ? to.y >= GOAL_ROW_A && to.y + 1 >= GOAL_ROW_A
      : to.y <= GOAL_ROW_B && to.y + 1 <= GOAL_ROW_B;
    if (allCross) score += 25;
  } else {
    if (wouldScore) score += 25;
  }

  // Blocking: reward moving in front of enemy units
  for (const enemy of state.units) {
    if (enemy.scored || enemy.owner === player) continue;
    const enemyFwd = forwardDir(enemy.owner);
    const blocking = (
      to.x === enemy.pos.x &&
      to.y === enemy.pos.y + enemyFwd
    );
    if (blocking) score += 5;
  }

  // Slight penalty for moving sideways (not forward/backward)
  if (to.y === from.y) score -= 1;

  // Slight penalty for moving backward
  if ((player === 'A' && to.y < from.y) || (player === 'B' && to.y > from.y)) {
    score -= 3;
  }

  // Elephant push value: reward pushing enemies backward
  if (def.id === 'elephant') {
    const dy = Math.sign(to.y - from.y);
    // Check if any enemy is in the path that would be pushed
    for (const u of state.units) {
      if (u.scored || u.owner === player) continue;
      const uDef = getUnitDef(u.defId);
      if (uDef.size > 1 || uDef.id === 'turtle') continue;
      // Would this unit be pushed by the elephant?
      for (let ddy = 0; ddy < def.size; ddy++) {
        for (let ddx = 0; ddx < def.size; ddx++) {
          if (u.pos.x === to.x + ddx && u.pos.y === to.y + ddy) {
            // Pushed enemy backward = good
            const pushDir = forwardDir(u.owner);
            if (dy === -pushDir) score += 8; // pushing enemy backward
            else score += 3; // any push is somewhat good
          }
        }
      }
    }
  }

  // Randomness ±2 so AI isn't perfectly deterministic
  score += (Math.random() - 0.5) * 4;

  return score;
}

/**
 * Schedule the AI move with a brief delay (feels natural).
 * Returns a cleanup function.
 */
export function scheduleAIMove(
  state: CGameState,
  onMove: (unitId: number, to: Vec2) => void,
): () => void {
  let cancelled = false;
  const delay = 400 + Math.random() * 600; // 0.4-1.0s

  const timer = setTimeout(() => {
    if (cancelled || state.phase !== 'playing') return;
    const move = pickAIMove(state);
    if (move) onMove(move.unitId, move.to);
  }, delay);

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
