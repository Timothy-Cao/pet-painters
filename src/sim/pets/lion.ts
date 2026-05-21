import type { PetDefinition, Pet } from '../../types/pet';
import type { MatchState } from '../../types/game';
import { enemiesInFront } from '../combat';
import { getPetDef } from '../pet-defs';
import { pushHit, pushDamage, pushRoar } from '../../render/effects';
import {
  declareMove, enemyInSight, frontBlocked, frontIsWall, frontHasPet,
  rotateCW, scurryTurn,
} from '../behaviors';

const STATS = {
  cost: 4,
  speedTilesPerSec: 1,            // calm patrol
  huntSpeedTilesPerSec: 3,        // sprint when locked on
  weight: 3,
  maxHp: 6,
  atk: 3,                         // one-shots a Mouse, two-shots a Cat
  atkSpeedPerSec: 1,
  order: 1,                       // acts early — gets the kill before the prey reacts
  sightRange: 5,
} as const;

/** Module-level lock-on bookkeeping so we only roar at the moment we first
 *  see a target, not every tick we keep seeing it. */
const lockedOn = new Map<number, boolean>();

/** Rage stacks — incremented each time this lion kills an enemy. */
const rageBonus = new Map<number, number>();

function getLionRage(petId: number): number {
  return rageBonus.get(petId) ?? 0;
}

function lionHunt(pet: Pet, state: MatchState): void {
  if (frontBlocked(pet, state)) {
    if (frontIsWall(pet, state) || !enemiesInFront(pet, state).length) {
      rotateCW(pet);
    }
    return;
  }
  declareMove(pet, state);
}

function lionWander(pet: Pet, state: MatchState): void {
  // Reset the lock-on flag while wandering so the next hunt-trigger plays
  // the roar effect again.
  lockedOn.set(pet.petId, false);
  if (frontBlocked(pet, state)) {
    if (frontHasPet(pet, state)) rotateCW(pet);
    else scurryTurn(pet);
    return;
  }
  declareMove(pet, state);
}

function lionLockOnTrigger(pet: Pet, state: MatchState): boolean {
  const has = enemyInSight(pet, state, STATS.sightRange);
  if (has && !lockedOn.get(pet.petId)) {
    pushRoar(pet.anchor.x, pet.anchor.y, pet.owner);
    lockedOn.set(pet.petId, true);
  } else if (!has) {
    lockedOn.set(pet.petId, false);
  }
  return has;
}

function lionAttack(pet: Pet, state: MatchState): void {
  const def = getPetDef(pet.defId);
  const rage = getLionRage(pet.petId);
  const dmg = def.atk + rage;
  for (const target of enemiesInFront(pet, state)) {
    const wasAlive = target.hp > 0;
    target.hp -= dmg;
    pushHit(target.anchor.x, target.anchor.y, pet.owner);
    if (dmg > 0) pushDamage(target.anchor.x, target.anchor.y, pet.owner, dmg);
    // Kill detected: increment rage
    if (wasAlive && target.hp <= 0) {
      rageBonus.set(pet.petId, rage + 1);
    }
  }
}

export const LION: PetDefinition = {
  id: 'lion',
  displayName: 'Lion',
  emoji: '🦁',
  cost: STATS.cost,
  size: { w: 1, h: 1 },
  weight: STATS.weight,
  maxHp: STATS.maxHp,
  atk: STATS.atk,
  order: STATS.order,
  stats: STATS,
  role: 'predator',
  ui: {
    hotkey: '7',
    short: 'Stalks, sprints, rages',
    ability:
      'Patrols at a walk. The instant an enemy enters its line of sight (up to 5 tiles), it roars and sprints at triple speed. Deals 3 damage per strike, plus +1 for each kill (rage stacks — first kill: 3 dmg, second: 4, third: 5, etc.).',
  },
  tuples: [
    // Hunt: enemy in straight-line sight → step forward at the hunt cadence.
    {
      intervalSec: 1 / STATS.huntSpeedTilesPerSec,
      trigger: lionLockOnTrigger,
      action: lionHunt,
    },
    // Wander: no enemy in sight → patrol slowly, turning at obstacles.
    {
      intervalSec: 1 / STATS.speedTilesPerSec,
      trigger: (pet, state) => !enemyInSight(pet, state, STATS.sightRange),
      action: lionWander,
    },
    // Strike whatever it ends up adjacent to (rage-scaling damage).
    {
      intervalSec: 1 / STATS.atkSpeedPerSec,
      trigger: (pet, state) => enemiesInFront(pet, state).length > 0,
      action: lionAttack,
    },
  ],
};
