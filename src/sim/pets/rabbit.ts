import type { PetDefinition, Pet } from '../../types/pet';
import type { MatchState, Vec2, Direction } from '../../types/game';
import { paintTile } from '../board';
import {
  anyPetAt, declareMove, facingDelta,
  frontBlocked, frontIsWall, tileInBounds,
} from '../behaviors';
import { pushSplat } from '../../render/effects';

const STATS = {
  cost: 3,                          // reworks r2: 4→3 — cheaper to stack; hop splash needs more reps
  speedTilesPerSec: 3,
  weight: 2,
  maxHp: 4,
  atk: 1,
  atkSpeedPerSec: 0,
  order: 3,
  maxJump: 4,
} as const;

/** Pick a random cardinal direction using state.rng or Math.random. */
function randomDirection(state: MatchState): Direction {
  const r = state.rng ? state.rng.next() : Math.random();
  const dirs: Direction[] = ['N', 'E', 'S', 'W'];
  return dirs[Math.floor(r * 4)];
}

/** Paint a square splash of radius `r` centered on `center`. */
function paintSplash(state: MatchState, center: Vec2, owner: Pet['owner'], radius: number): void {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const t: Vec2 = { x: center.x + dx, y: center.y + dy };
      if (tileInBounds(state, t)) {
        paintTile(state.board, t, owner);
        if (radius > 0) pushSplat(t.x, t.y, owner);
      }
    }
  }
}

function rabbitStep(pet: Pet, state: MatchState): void {
  // Front is off-board: turn randomly.
  if (frontIsWall(pet, state)) {
    pet.facing = randomDirection(state);
    return;
  }

  // Front is clear: normal walk.
  if (!frontBlocked(pet, state)) {
    declareMove(pet, state);
    return;
  }

  // Front is blocked by a pet (or something on-board): scan for a landing tile.
  const d = facingDelta(pet.facing);
  let jumpDist = 0;
  let landing: Vec2 | null = null;

  for (let step = 1; step <= STATS.maxJump; step++) {
    const candidate: Vec2 = {
      x: pet.anchor.x + d.x * step,
      y: pet.anchor.y + d.y * step,
    };
    if (!tileInBounds(state, candidate)) break; // ran off the board
    if (!anyPetAt(state, candidate, pet)) {
      landing = candidate;
      jumpDist = step;
      break;
    }
  }

  if (landing) {
    // Teleport to landing tile.
    pet.anchor = landing;
    // Paint landing tile plus a splash proportional to jump distance.
    const splashRadius = Math.floor(jumpDist / 2);
    paintSplash(state, landing, pet.owner, splashRadius);
  } else {
    // No landing found within maxJump: turn randomly.
    pet.facing = randomDirection(state);
  }
}

export const RABBIT: PetDefinition = {
  id: 'rabbit',
  displayName: 'Rabbit',
  emoji: '🐰',
  cost: STATS.cost,
  size: { w: 1, h: 1 },
  weight: STATS.weight,
  maxHp: STATS.maxHp,
  atk: STATS.atk,
  order: STATS.order,
  stats: STATS,
  role: 'painter',
  ui: {
    hotkey: '4',
    short: 'Hops over blockers — bigger jump = bigger splash',
    ability:
      'When blocked, scans forward up to 4 tiles and leaps to the first empty tile. Landing paints a splash proportional to jump distance (jump-2 = 3×3, jump-4 = 5×5). Random-turns when no landing exists.',
  },
  tuples: [
    { intervalSec: 1 / STATS.speedTilesPerSec, trigger: () => true, action: rabbitStep },
  ],
};
