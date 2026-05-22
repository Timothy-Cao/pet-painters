/**
 * ai.ts
 *
 * Simple AI opponent for solo play. Controls Player B in sandbox mode.
 *
 * Strategy:
 * - Early rounds: prefers painters and cheap units to expand territory
 * - Mid/late rounds: mixes in predators and tanks to counter the player
 * - Placement: prefers frontier tiles (near non-B territory) to maximize paint
 * - Facing: biased toward the center of the board (toward enemy territory)
 * - Spending: tries to spend most of its budget each round
 */

import type { MatchState, Direction, Vec2 } from '../types/game';
import { tryDeploy } from './deploy';
import { ALL_PETS } from './pets';
import { getTile } from './board';
import { BOARD_SIZE } from '../config/constants';
import { getPetDef } from './pet-defs';
import { footprintTiles } from './geometry';
import { playPetDeploy } from '../render/sfx';

const DIRECTIONS: Direction[] = ['N', 'E', 'S', 'W'];

/**
 * Find all valid anchor positions where a given pet can be deployed for player B.
 * This pre-filters for ownership but does NOT check occupancy — tryDeploy handles that.
 */
function findValidAnchors(state: MatchState, defId: string): Vec2[] {
  const def = getPetDef(defId);
  const anchors: Vec2[] = [];

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      let allOwned = true;
      for (let dy = 0; dy < def.size.h && allOwned; dy++) {
        for (let dx = 0; dx < def.size.w && allOwned; dx++) {
          const tx = x + dx;
          const ty = y + dy;
          if (tx >= BOARD_SIZE || ty >= BOARD_SIZE || getTile(state.board, { x: tx, y: ty }) !== 'B') {
            allOwned = false;
          }
        }
      }
      if (allOwned) anchors.push({ x, y });
    }
  }
  return anchors;
}

/**
 * Score a deploy position — higher is better.
 * Prefers positions near the frontier (non-B tiles nearby) and closer to center.
 */
function scorePosition(state: MatchState, pos: Vec2): number {
  let score = 0;
  const cx = BOARD_SIZE / 2;
  const cy = BOARD_SIZE / 2;

  // Closer to center ≈ closer to the action
  score += 10 - Math.sqrt((pos.x - cx) ** 2 + (pos.y - cy) ** 2) * 0.5;

  // Bonus for being near the frontier (non-B tiles within radius 2)
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const nx = pos.x + dx;
      const ny = pos.y + dy;
      if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
        const tile = getTile(state.board, { x: nx, y: ny });
        if (tile !== 'B') score += 1.5;
      }
    }
  }

  // Small penalty for being right at the board edge (less room to expand)
  if (pos.x <= 1 || pos.x >= BOARD_SIZE - 2) score -= 2;
  if (pos.y <= 1 || pos.y >= BOARD_SIZE - 2) score -= 2;

  return score;
}

/**
 * Pick a facing direction biased toward the center / enemy territory.
 * B starts top-right, so early game it should face S or W.
 */
function pickFacing(pos: Vec2): Direction {
  const cx = BOARD_SIZE / 2;
  const cy = BOARD_SIZE / 2;
  const dx = cx - pos.x;
  const dy = cy - pos.y;

  // 70% chance: face toward center; 30% random
  if (Math.random() < 0.7) {
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'E' : 'W';
    } else {
      return dy > 0 ? 'N' : 'S';
    }
  }
  return DIRECTIONS[Math.floor(Math.random() * 4)];
}

/**
 * Execute the AI's planning turn: deploy pets for Player B and return
 * the list of deployed defIds (for SFX / UI feedback).
 *
 * Call this during the planning phase. Does NOT call submitReady —
 * the caller decides when to ready up.
 */
export function aiDeployPets(state: MatchState): string[] {
  if (state.phase !== 'planning') return [];

  let budget = state.sandbox ? Infinity : state.energy.B;
  const deployed: string[] = [];
  let attempts = 0;
  const MAX_ATTEMPTS = 30;

  // Build a set of already-occupied tile keys for quick checking
  const occupied = new Set<string>();
  for (const p of state.pets) {
    const def = getPetDef(p.defId);
    for (const ft of footprintTiles(p.anchor, def.size)) {
      occupied.add(`${ft.x},${ft.y}`);
    }
  }

  while (budget > 0 && attempts < MAX_ATTEMPTS) {
    attempts++;

    // Filter to affordable pets
    const affordable = ALL_PETS.filter((p) => p.cost <= budget);
    if (affordable.length === 0) break;

    // Weighted selection based on game phase
    const weighted = affordable.map((p) => {
      let w = 1;
      if (state.round <= 1) {
        // Round 0-1: expand aggressively with painters and cheap units
        if (p.role === 'painter') w += 4;
        if (p.cost <= 3) w += 2;
        if (p.role === 'specialist') w += 1;
      } else if (state.round <= 3) {
        // Round 2-3: balanced mix
        if (p.role === 'painter') w += 2;
        if (p.role === 'predator') w += 2;
        if (p.role === 'tank') w += 1;
      } else {
        // Late game: favor combat units to protect territory
        if (p.role === 'predator') w += 3;
        if (p.role === 'tank') w += 2;
        if (p.role === 'disruptor') w += 2;
      }

      // Don't spam the same pet too much — reduce weight if already deployed
      const sameCount = deployed.filter((d) => d === p.id).length;
      if (sameCount >= 2) w *= 0.2;
      else if (sameCount >= 1) w *= 0.5;

      return { def: p, weight: Math.max(0.1, w) };
    });

    // Weighted random pick
    const totalW = weighted.reduce((s, p) => s + p.weight, 0);
    let roll = Math.random() * totalW;
    let chosen = weighted[0].def;
    for (const p of weighted) {
      roll -= p.weight;
      if (roll <= 0) {
        chosen = p.def;
        break;
      }
    }

    // Find valid positions
    const anchors = findValidAnchors(state, chosen.id);
    if (anchors.length === 0) continue;

    // Filter out occupied positions
    const free = anchors.filter((a) => {
      for (let dy = 0; dy < chosen.size.h; dy++) {
        for (let dx = 0; dx < chosen.size.w; dx++) {
          if (occupied.has(`${a.x + dx},${a.y + dy}`)) return false;
        }
      }
      return true;
    });
    if (free.length === 0) continue;

    // Score + randomness so it doesn't always pick the exact same spot
    const scored = free.map((a) => ({
      pos: a,
      score: scorePosition(state, a) + Math.random() * 4,
    }));
    scored.sort((a, b) => b.score - a.score);

    const anchor = scored[0].pos;
    const facing = pickFacing(anchor);

    const result = tryDeploy(state, 'B', chosen.id, anchor, facing);
    if (result.ok) {
      deployed.push(chosen.id);
      budget = state.sandbox ? Infinity : state.energy.B;
      // Update occupied set
      for (let dy = 0; dy < chosen.size.h; dy++) {
        for (let dx = 0; dx < chosen.size.w; dx++) {
          occupied.add(`${anchor.x + dx},${anchor.y + dy}`);
        }
      }
    }

    // In non-sandbox mode, stop if we've spent enough (keep 0-1 energy as reserve)
    if (!state.sandbox && state.energy.B <= 0) break;

    // In sandbox mode, limit total deploys so AI doesn't go infinite
    if (state.sandbox && deployed.length >= 5) break;
  }

  return deployed;
}

/**
 * Schedule AI deployment with a staggered delay so pets appear one at a time.
 * Returns a cleanup function to cancel any pending timers.
 */
export function scheduleAIDeploy(
  state: MatchState,
  onDeployed?: () => void,
): () => void {
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  // Initial delay before AI starts deploying (feels natural)
  const startDelay = 600 + Math.random() * 800; // 0.6–1.4s

  const mainTimer = setTimeout(() => {
    if (cancelled || state.phase !== 'planning') return;

    const deployed = aiDeployPets(state);

    // Play deploy SFX for each pet with slight stagger
    deployed.forEach((defId, i) => {
      const sfxTimer = setTimeout(() => {
        if (!cancelled) playPetDeploy(defId);
      }, i * 200);
      timers.push(sfxTimer);
    });

    onDeployed?.();
  }, startDelay);

  timers.push(mainTimer);

  return () => {
    cancelled = true;
    for (const t of timers) clearTimeout(t);
  };
}
