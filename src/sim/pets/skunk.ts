import type { PetDefinition, Pet } from '../../types/pet';
import type { MatchState } from '../../types/game';
import { enemiesInFront, applyAttack } from '../combat';
import { walkOrScurry } from '../behaviors';
import { pushSpray } from '../../render/effects';

const STATS = {
  cost: 4,
  speedTilesPerSec: 1,
  weight: 2,
  maxHp: 4,
  atk: 1,
  atkSpeedPerSec: 1,
  order: 2,
  // bespoke
  sprayPerSec: 2,
  freezeTicks: 16, // ~0.8 s freeze
} as const;

function skunkSpray(pet: Pet, state: MatchState): void {
  // Freeze ALL enemies in front of the skunk (entire front row footprint).
  const targets = enemiesInFront(pet, state);
  for (const target of targets) {
    target.frozenUntilTick = state.tick + STATS.freezeTicks;
    pushSpray(target.anchor.x, target.anchor.y, pet.owner);
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
    short: 'Freezes enemies in front',
    ability:
      'Twice a second, the skunk sprays all enemies in front of it, freezing them for ~0.8 s. Also attacks the pet directly ahead once per second.',
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
