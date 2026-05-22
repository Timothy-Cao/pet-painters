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
  maxHp: 15,                        // final balance: 4→15 — force field needs Skunk alive long enough to matter
  atk: 1,
  atkSpeedPerSec: 1,
  order: 2,
  // bespoke
  sprayPerSec: 2,
  freezeTicks: 24,                  // reworks r2: 16→24 (~1.2 s freeze) — longer disable window
  fearIntervalSec: 1.0,
  fearRadius: 2,   // Chebyshev distance
  pushFieldIntervalSec: 0.5,        // push field fires every 0.5s
  pushFieldRadius: 1,               // Chebyshev 1 = 3×3 zone around Skunk
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

/**
 * Push Field: every 0.5s, any enemy whose footprint is within Chebyshev 1 of
 * Skunk's anchor (the 3×3 zone) gets shoved one tile further away.
 * The push direction is the dominant cardinal axis FROM Skunk TO the enemy;
 * ties go horizontal. If the destination is out-of-bounds or occupied the
 * push is skipped (Skunk can't do the impossible).
 */
function skunkPushField(pet: Pet, state: MatchState): void {
  const seen = new Set<number>();

  for (const other of state.pets) {
    if (other.owner === pet.owner) continue;
    if (seen.has(other.petId)) continue;

    const odef = getPetDef(other.defId);
    const tiles = footprintTiles(other.anchor, odef.size);

    // Check if any tile of the enemy's footprint is within Chebyshev 1 of skunk.
    let near = false;
    for (const t of tiles) {
      if (chebyshev(pet.anchor, t) <= STATS.pushFieldRadius) { near = true; break; }
    }
    if (!near) continue;

    seen.add(other.petId);

    // Compute push delta: dominant cardinal axis from Skunk to enemy.
    const dx = other.anchor.x - pet.anchor.x;
    const dy = other.anchor.y - pet.anchor.y;
    let pushDelta: Vec2;
    if (Math.abs(dx) >= Math.abs(dy)) {
      pushDelta = { x: dx === 0 ? 1 : Math.sign(dx), y: 0 };
    } else {
      pushDelta = { x: 0, y: Math.sign(dy) };
    }

    const dest: Vec2 = { x: other.anchor.x + pushDelta.x, y: other.anchor.y + pushDelta.y };

    // Validate destination: all footprint tiles must be in bounds and unoccupied.
    const destTiles = footprintTiles(dest, odef.size);
    let blocked = false;
    for (const dt of destTiles) {
      if (!tileInBounds(state, dt)) { blocked = true; break; }
      // Check for occupants (ignore the pet being pushed itself).
      for (const check of state.pets) {
        if (check === other) continue;
        const cdef = getPetDef(check.defId);
        for (const ct of footprintTiles(check.anchor, cdef.size)) {
          if (ct.x === dt.x && ct.y === dt.y) { blocked = true; break; }
        }
        if (blocked) break;
      }
      if (blocked) break;
    }
    if (blocked) continue;

    // Apply the push.
    other.anchor = dest;
    pushSpray(dest.x, dest.y, pet.owner);
  }
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
    short: 'Force field pushes + freezes nearby enemies',
    ability:
      'Tanky disruptor (15 HP). Every 0.5s, pushes any enemy in the 3×3 zone around it one tile further away (force field). Twice a second, sprays orthogonally adjacent enemies (freezes ~1.2s). Every second, flips enemies within 2 tiles to face away. Attacks the pet ahead once per second.',
  },
  tuples: [
    { intervalSec: 1 / STATS.speedTilesPerSec, trigger: () => true, action: walkOrScurry },
    { intervalSec: 1 / STATS.sprayPerSec, trigger: () => true, action: skunkSpray },
    {
      intervalSec: STATS.fearIntervalSec,
      trigger: fearTrigger,
      action: skunkFear,
    },
    // Push field: shove adjacent enemies away every 0.5s (additive with freeze spray).
    {
      intervalSec: STATS.pushFieldIntervalSec,
      trigger: () => true,
      action: skunkPushField,
    },
    {
      intervalSec: 1 / STATS.atkSpeedPerSec,
      trigger: (pet, state) => enemiesInFront(pet, state).length > 0,
      action: applyAttack,
    },
  ],
};
