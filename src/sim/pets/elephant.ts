import type { PetDefinition, Pet } from '../../types/pet';
import type { MatchState } from '../../types/game';
import { enemiesInFront, applyAttack } from '../combat';
import { walkOrTurnAtWall } from '../behaviors';
import { pushDamage, pushHit } from '../../render/effects';

const STATS = {
  cost: 3,                          // final final: 4→3 — Elephant stayed Dead at cost 4; aggressive cut
  speedTilesPerSec: 0.75,           // final balance r2: 0.5→0.75 — needs to reach combat sooner
  weight: 10,
  maxHp: 25,
  atk: 2,
  rageAtk: 6,                       // final balance: tusks rage — atk doubles at half HP
  atkSpeedPerSec: 0.5,
  order: 1,
} as const;

function isRaged(pet: Pet): boolean {
  return pet.hp <= STATS.maxHp / 2;
}

/** Tusks rage attack: doubled damage when at half HP or below. */
function elephantAttack(pet: Pet, state: MatchState): void {
  const targets = enemiesInFront(pet, state);
  if (!targets.length) return;
  const damage = isRaged(pet) ? STATS.rageAtk : STATS.atk;
  for (const target of targets) {
    target.hp -= damage;
    pushHit(target.anchor.x, target.anchor.y, pet.owner);
    pushDamage(target.anchor.x, target.anchor.y, pet.owner, damage);
  }
}

export const ELEPHANT: PetDefinition = {
  id: 'elephant',
  displayName: 'Elephant',
  emoji: '🐘',
  cost: STATS.cost,
  size: { w: 2, h: 2 },
  weight: STATS.weight,
  maxHp: STATS.maxHp,
  atk: STATS.atk,
  order: STATS.order,
  immovable: true,
  stats: STATS,
  role: 'tank',
  ui: {
    hotkey: '2',
    short: 'Unmovable; tusks rage at half HP',
    ability:
      'Cannot be pushed by anything. Trudges in straight lines and only about-faces at walls. At half HP or below, tusks rage kicks in and attack damage doubles (2→6).',
  },
  tuples: [
    // Walk forward; about-face only at walls. Pets in front are handled by the
    // push system thanks to weight 10 and the immovable flag.
    {
      intervalSec: 1 / STATS.speedTilesPerSec,
      trigger: () => true,
      action: walkOrTurnAtWall,
    },
    // Tusks stomp: deals doubled damage when at half HP.
    {
      intervalSec: 1 / STATS.atkSpeedPerSec,
      trigger: (pet, state) => enemiesInFront(pet, state).length > 0,
      action: elephantAttack,
    },
  ],
};
