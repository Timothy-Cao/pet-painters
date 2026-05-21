import type { PetDefinition, Pet } from '../../types/pet';
import type { MatchState, Vec2 } from '../../types/game';
import { anyPetAt, ORTHO_DELTAS, tileInBounds } from '../behaviors';
import { pushWeb } from '../../render/effects';

const STATS = {
  cost: 2,
  speedTilesPerSec: 0,            // stationary
  weight: 2,
  maxHp: 6,
  atk: 0,
  atkSpeedPerSec: 0,
  order: 3,                       // late — webs apply after enemies have tried to act
  // bespoke
  webPerSec: 1,                   // weave webs once per second
  freezeTicks: 18,                // each web lasts 0.9 sec (was 0.6 sec)
} as const;

function spiderWeb(pet: Pet, state: MatchState): void {
  for (const d of ORTHO_DELTAS) {
    const t: Vec2 = { x: pet.anchor.x + d.x, y: pet.anchor.y + d.y };
    if (!tileInBounds(state, t)) continue;
    const target = anyPetAt(state, t, pet);
    if (!target || target.owner === pet.owner) continue;
    target.frozenUntilTick = state.tick + STATS.freezeTicks;
    pushWeb(t.x, t.y, pet.owner);
  }
}

export const SPIDER: PetDefinition = {
  id: 'spider',
  displayName: 'Spider',
  emoji: '🕷️',
  cost: STATS.cost,
  size: { w: 1, h: 1 },
  weight: STATS.weight,
  maxHp: STATS.maxHp,
  atk: STATS.atk,
  order: STATS.order,
  stats: STATS,
  role: 'disruptor',
  ui: {
    hotkey: '8',
    short: 'Webs adjacent enemies',
    ability:
      'Stays put. Once per second, every orthogonally adjacent enemy is webbed and skips its next 12 ticks — perfect for sealing a chokepoint.',
  },
  tuples: [
    { intervalSec: 1 / STATS.webPerSec, trigger: () => true, action: spiderWeb },
  ],
};
