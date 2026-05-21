import type { PetDefinition, Pet } from '../../types/pet';
import type { MatchState, Vec2 } from '../../types/game';
import { enemiesInFront, applyAttack } from '../combat';
import { anyPetAt, tileInBounds, walkOrScurry, ORTHO_DELTAS } from '../behaviors';
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
    short: 'Freezes all adjacent enemies',
    ability:
      'Twice a second, the skunk sprays all enemies in any orthogonal adjacent tile (N/E/S/W), freezing each for ~0.8 s. Also attacks the pet directly ahead once per second.',
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
