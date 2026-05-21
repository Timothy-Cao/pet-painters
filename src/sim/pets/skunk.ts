import type { PetDefinition, Pet } from '../../types/pet';
import type { MatchState, Vec2, Direction } from '../../types/game';
import { enemiesInFront, applyAttack } from '../combat';
import { anyPetAt, tileInBounds, walkOrScurry, ORTHO_DELTAS } from '../behaviors';
import { getPetDef } from '../pet-defs';
import { footprintTiles } from '../geometry';
import { pushSpray } from '../../render/effects';

const STATS = {
  cost: 3,                          // reworks r2: 4→3 — must be cheaper to appear in meta comps
  speedTilesPerSec: 1,
  weight: 2,
  maxHp: 4,
  atk: 1,
  atkSpeedPerSec: 1,
  order: 2,
  // bespoke
  sprayPerSec: 2,
  freezeTicks: 24,                  // reworks r2: 16→24 (~1.2 s freeze) — longer disable window
  fearIntervalSec: 1.0,
  fearRadius: 2,   // Chebyshev distance
} as const;

function skunkSpray(pet: Pet, state: MatchState): void {
  // Freeze ALL enemies in any orthogonal adjacent tile (omnidirectional spray).
  for (const delta of ORTHO_DELTAS) {
    const t: Vec2 = { x: pet.anchor.x + delta.x, y: pet.anchor.y + delta.y };
    if (!tileInBounds(state, t)) continue;
    const occupant = anyPetAt(state, t, pet);
    if (!occupant || occupant.owner === pet.owner) continue;
    occupant.frozenUntilTick = state.tick + STATS.freezeTicks;
    pushSpray(t.x, t.y, pet.owner);
  }
}

/** Chebyshev distance between two anchor tiles (ignoring pet size). */
function chebyshev(a: Vec2, b: Vec2): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Dominant cardinal direction FROM skunk TO enemy (so enemy flips AWAY = that direction). */
function awayFrom(skunkAnchor: Vec2, enemyAnchor: Vec2): Direction {
  const dx = enemyAnchor.x - skunkAnchor.x;
  const dy = enemyAnchor.y - skunkAnchor.y;
  // Pick the dominant axis; if equal, prefer horizontal.
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'E' : 'W';
  }
  return dy >= 0 ? 'N' : 'S';
}

function fearTrigger(pet: Pet, state: MatchState): boolean {
  for (const other of state.pets) {
    if (other.owner === pet.owner) continue;
    if (chebyshev(pet.anchor, other.anchor) <= STATS.fearRadius) return true;
  }
  return false;
}

function skunkFear(pet: Pet, state: MatchState): void {
  // Already-processed pets this tick (avoid flipping a multi-tile pet multiple times).
  const seen = new Set<number>();

  for (const other of state.pets) {
    if (other.owner === pet.owner) continue;
    if (seen.has(other.petId)) continue;

    const odef = getPetDef(other.defId);
    const tiles = footprintTiles(other.anchor, odef.size);

    // Check any tile of enemy footprint within Chebyshev 2 of skunk.
    let near = false;
    for (const t of tiles) {
      if (chebyshev(pet.anchor, t) <= STATS.fearRadius) { near = true; break; }
    }
    if (!near) continue;

    seen.add(other.petId);
    // Flip enemy to face away from skunk.
    other.facing = awayFrom(pet.anchor, other.anchor);
    pushSpray(other.anchor.x, other.anchor.y, pet.owner);
  }
}

export const SKUNK: PetDefinition = {
  id: 'skunk',
  displayName: 'Skunk',
  emoji: '🦨',
  cost: STATS.cost,
  size: { w: 1, h: 1 },
  weight: STATS.weight,
  maxHp: STATS.maxHp,
  atk: STATS.atk,
  order: STATS.order,
  stats: STATS,
  role: 'disruptor',
  ui: {
    hotkey: '6',
    short: 'Freezes adjacent + redirects nearby enemies',
    ability:
      'Twice a second, sprays all orthogonally adjacent enemies (freezes ~0.8 s). Also: every second, flips all enemies within 2 tiles to face away from it — skunks scare off everything nearby. Attacks the pet directly ahead once per second.',
  },
  tuples: [
    { intervalSec: 1 / STATS.speedTilesPerSec, trigger: () => true, action: walkOrScurry },
    { intervalSec: 1 / STATS.sprayPerSec, trigger: () => true, action: skunkSpray },
    {
      intervalSec: STATS.fearIntervalSec,
      trigger: fearTrigger,
      action: skunkFear,
    },
    {
      intervalSec: 1 / STATS.atkSpeedPerSec,
      trigger: (pet, state) => enemiesInFront(pet, state).length > 0,
      action: applyAttack,
    },
  ],
};
