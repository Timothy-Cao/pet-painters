/**
 * ai.ts — AI opponent for Critter Crossing.
 *
 * Evaluates all possible moves using a scoring heuristic that considers:
 * - Forward progress toward the goal
 * - Scoring opportunities
 * - Blocking enemy advancement
 * - SYNERGY: pushing allies forward, creating hop chains, positioning for combos
 *
 * Adds slight randomness so it doesn't feel robotic.
 */

import type { CGameState, Vec2, PlayerId } from './types';
import { getUnitDef } from './units';
import { getValidMoves, forwardDir } from './moves';
import { BOARD_SIZE, GOAL_ROW_A, GOAL_ROW_B, footprint, getTerrain } from './board';

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
  const unit = state.units.find(u => u.unitId === unitId)!;
  const def = getUnitDef(unit.defId);

  // ── Forward progress (core) ──
  const progressBefore = player === 'A' ? from.y : (BOARD_SIZE - 1 - from.y);
  const progressAfter = player === 'A' ? to.y : (BOARD_SIZE - 1 - to.y);
  score += (progressAfter - progressBefore) * 4;

  // ── Scoring bonus ──
  const goalRow = player === 'A' ? GOAL_ROW_A : GOAL_ROW_B;
  const distToGoal = player === 'A'
    ? Math.max(0, goalRow - to.y)
    : Math.max(0, to.y - goalRow);
  if (distToGoal <= 1) score += 8;

  // Massive bonus for actually scoring
  if (def.size === 2) {
    const allCross = player === 'A'
      ? to.y >= GOAL_ROW_A && to.y + 1 >= GOAL_ROW_A
      : to.y <= GOAL_ROW_B && to.y + 1 <= GOAL_ROW_B;
    if (allCross) score += 30;
  } else {
    const wouldScore = player === 'A' ? to.y >= GOAL_ROW_A : to.y <= GOAL_ROW_B;
    if (wouldScore) score += 30;
  }

  // ── Blocking (move in front of enemy) ──
  for (const enemy of state.units) {
    if (enemy.scored || enemy.owner === player) continue;
    const enemyFwd = forwardDir(enemy.owner);
    if (to.x === enemy.pos.x && to.y === enemy.pos.y + enemyFwd) {
      score += 4;
    }
  }

  // ── Synergy: elephant pushing allies forward ──
  if (def.id === 'elephant') {
    const dy = Math.sign(to.y - from.y);
    const pushFwd = forwardDir(player);

    const newFp = footprint(to, def.size);
    for (const t of newFp) {
      for (const u of state.units) {
        if (u.scored || u.unitId === unitId) continue;
        const uDef = getUnitDef(u.defId);
        if (uDef.size > 1 || uDef.id === 'turtle') continue;
        if (u.pos.x === t.x && u.pos.y === t.y) {
          // Would push this unit
          if (u.owner === player) {
            // Pushing own unit forward = great synergy
            if (dy === pushFwd) score += 10;
            // Pushing own unit sideways = mild
            else if (dy === 0) score += 2;
            // Pushing own unit backward = bad
            else score -= 5;
          } else {
            // Pushing enemy backward = good
            if (dy === -forwardDir(u.owner)) score += 7;
            // Pushing enemy forward = bad
            else if (dy === forwardDir(u.owner)) score -= 3;
            else score += 2;
          }
        }
      }
    }
  }

  // ── Synergy: turtle moving toward water (to enable bridges) ──
  if (def.id === 'turtle') {
    // Reward moving toward water columns if not already in water
    const currentTerrain = getTerrain(state.board, from);
    const targetTerrain = getTerrain(state.board, to);
    if (currentTerrain === 'land' && targetTerrain === 'water') {
      score += 3; // Entering water to create bridge
    }
    // Reward being in water (supporting role)
    if (targetTerrain === 'water') {
      // Positioned as bridge for hoppers
      score += 2;
    }
  }

  // ── Synergy: creating hop chains (positioning near allies) ──
  if (def.id !== 'elephant' && def.id !== 'whale') {
    let adjAllies = 0;
    for (const d of [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }]) {
      const adj = { x: to.x + d.x, y: to.y + d.y };
      for (const u of state.units) {
        if (u.scored || u.unitId === unitId || u.owner !== player) continue;
        if (u.pos.x === adj.x && u.pos.y === adj.y) adjAllies++;
      }
    }
    // Being near allies is good (enables chain hops, mouse slides)
    score += adjAllies * 1.5;
  }

  // ── Penalty for moving backward ──
  if ((player === 'A' && to.y < from.y) || (player === 'B' && to.y > from.y)) {
    score -= 3;
  }

  // ── Penalty for moving sideways ──
  if (to.y === from.y) score -= 0.5;

  // ── Eagle dive-bomb bonus ──
  if (def.id === 'eagle') {
    // Check if landing next to an enemy (would trigger bump)
    for (const d of [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }]) {
      const adj = { x: to.x + d.x, y: to.y + d.y };
      for (const u of state.units) {
        if (u.scored || u.owner === player) continue;
        const uDef = getUnitDef(u.defId);
        if (uDef.size > 1 || uDef.id === 'turtle') continue;
        if (u.pos.x === adj.x && u.pos.y === adj.y) {
          score += 6; // Will bump enemy
        }
      }
    }
  }

  // ── Randomness ±2 ──
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
