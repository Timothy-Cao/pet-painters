import type { PetDefinition, Pet } from '../../types/pet';
import type { MatchState, Vec2, Direction } from '../../types/game';
import { enemiesInFront, applyAttack } from '../combat';
import { anyPetAt, tileInBounds, walkOrScurry } from '../behaviors';
import { pushSpray } from '../../render/effects';

const STATS = {
  cost: 3,
  speedTilesPerSec: 1,
  weight: 2,
  maxHp: 4,
  atk: 1,
  atkSpeedPerSec: 1,
  order: 2,
  // bespoke
  sprayPerSec: 2,
} as const;

function skunkSpray(pet: Pet, state: MatchState): void {
  // For each orthogonal neighbor, if an enemy pet occupies that tile,
  // force its facing to point directly away from the skunk.
  const sides: { delta: Vec2; faceAway: Direction }[] = [
    { delta: { x: 0, y: 1 }, faceAway: 'N' },
    { delta: { x: 0, y: -1 }, faceAway: 'S' },
    { delta: { x: 1, y: 0 }, faceAway: 'E' },
    { delta: { x: -1, y: 0 }, faceAway: 'W' },
  ];
  for (const { delta, faceAway } of sides) {
    const t: Vec2 = { x: pet.anchor.x + delta.x, y: pet.anchor.y + delta.y };
    if (!tileInBounds(state, t)) continue;
    const occupant = anyPetAt(state, t, pet);
    if (!occupant || occupant.owner === pet.owner) continue;
    occupant.facing = faceAway;
    pushSpray(t.x, t.y, pet.owner);
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
    short: 'Forces enemies to flee',
    ability:
      'Twice a second, every adjacent enemy is forced to face directly away from the skunk, scattering enemy formations.',
  },
  tuples: [
    { intervalSec: 1 / STATS.speedTilesPerSec, trigger: () => true, action: walkOrScurry },
    { intervalSec: 1 / STATS.sprayPerSec, trigger: () => true, action: skunkSpray },
    {
      intervalSec: 1 / STATS.atkSpeedPerSec,
      trigger: (pet, state) => enemiesInFront(pet, state).length > 0,
      action: applyAttack,
    },
  ],
};
