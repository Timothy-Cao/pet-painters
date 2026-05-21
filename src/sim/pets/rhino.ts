import type { PetDefinition, Pet } from '../../types/pet';
import type { MatchState } from '../../types/game';
import { enemiesInFront } from '../combat';
import { declareMove, facingDelta, frontIsWall, turnAround } from '../behaviors';
import { pushDust, pushHit, pushDamage } from '../../render/effects';

const STATS = {
  cost: 5,                          // corner-zones r3: 7→5 — still 0% after r2 speed buff; needs to fit in budget alongside core picks
  speedTilesPerSec: 2.0,            // corner-zones r2: 1.5→2.0 — faster sprint means momentum builds before midfield engagement
  weight: 9,                      // close to elephant's 10 — barely pushable
  maxHp: 15,
  atk: 2,                         // base damage; momentum adds on top
  atkSpeedPerSec: 1,
  order: 1,
  maxMomentum: 5,
} as const;

/** Module-level state: each rhino's current momentum and last-seen anchor.
 *  Cleared on resetMatchInPlace via the Map's lifetime + reset shim. */
const momentum = new Map<number, number>();
const lastAnchor = new Map<number, { x: number; y: number }>();

function getMomentum(pet: Pet): number {
  return momentum.get(pet.petId) ?? 0;
}

function rhinoStep(pet: Pet, state: MatchState): void {
  // Compare current anchor to the value we saved last time this tuple fired.
  // If they match, the rhino was blocked between fires → reset momentum.
  const prev = lastAnchor.get(pet.petId);
  if (prev) {
    if (prev.x === pet.anchor.x && prev.y === pet.anchor.y) {
      momentum.set(pet.petId, 0);
    } else {
      const next = Math.min(STATS.maxMomentum, getMomentum(pet) + 1);
      momentum.set(pet.petId, next);
    }
  }

  if (frontIsWall(pet, state)) {
    turnAround(pet);
    momentum.set(pet.petId, 0);
  } else {
    declareMove(pet, state);
    // Emit dust trail behind the rhino once it's actually charging.
    const m = getMomentum(pet);
    if (m >= 1) {
      const d = facingDelta(pet.facing);
      // Center of the 2x2 footprint, offset slightly behind.
      const cx = pet.anchor.x + 0.5;
      const cy = pet.anchor.y + 0.5;
      pushDust(cx, cy, pet.owner, d.x, d.y, m);
    }
  }

  lastAnchor.set(pet.petId, { x: pet.anchor.x, y: pet.anchor.y });
}

function rhinoAttack(pet: Pet, state: MatchState): void {
  const targets = enemiesInFront(pet, state);
  if (!targets.length) return;
  const damage = STATS.atk + getMomentum(pet);
  for (const target of targets) {
    target.hp -= damage;
    pushHit(target.anchor.x, target.anchor.y, pet.owner);
    pushDamage(target.anchor.x, target.anchor.y, pet.owner, damage);
  }
}

export const RHINO: PetDefinition = {
  id: 'rhino',
  displayName: 'Rhino',
  emoji: '🦏',
  cost: STATS.cost,
  size: { w: 2, h: 2 },
  weight: STATS.weight,
  maxHp: STATS.maxHp,
  atk: STATS.atk,
  order: STATS.order,
  stats: STATS,
  role: 'predator',
  ui: {
    hotkey: 'q',
    short: 'Builds charging momentum',
    ability:
      '2×2 charger. Each consecutive straight step adds +1 damage (up to +5). Hitting a wall or anything that stops it resets the momentum.',
  },
  tuples: [
    {
      intervalSec: 1 / STATS.speedTilesPerSec,
      trigger: () => true,
      action: rhinoStep,
    },
    {
      intervalSec: 1 / STATS.atkSpeedPerSec,
      trigger: (pet, state) => enemiesInFront(pet, state).length > 0,
      action: rhinoAttack,
    },
  ],
};
