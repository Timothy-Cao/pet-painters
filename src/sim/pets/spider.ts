import type { PetDefinition, Pet } from '../../types/pet';
import type { MatchState, Vec2 } from '../../types/game';
import { anyPetAt, ORTHO_DELTAS, tileInBounds } from '../behaviors';
import { paintTile } from '../board';
import { pushWeb } from '../../render/effects';

const STATS = {
  cost: 2,
  speedTilesPerSec: 0,            // stationary
  weight: 2,
  maxHp: 12,
  atk: 0,
  atkSpeedPerSec: 0,
  order: 3,                       // late — webs apply after enemies have tried to act
  // bespoke
  webPerSec: 1,                   // weave webs once per second
  freezeTicks: 18,                // each web lasts 0.9 sec (was 0.6 sec)
  radiantPerSec: 0.5,             // passive: paints own tile + 4 neighbors every 2s
} as const;

/** Every 2 s, the spider paints its own tile and all four orthogonal neighbors.
 *  This gives it intrinsic paint output even when no enemy ever walks adjacent. */
function spiderRadiant(pet: Pet, state: MatchState): void {
  // Own tile.
  paintTile(state.board, pet.anchor, pet.owner);
  // Four orthogonal neighbors.
  for (const d of ORTHO_DELTAS) {
    const t: Vec2 = { x: pet.anchor.x + d.x, y: pet.anchor.y + d.y };
    if (tileInBounds(state, t)) paintTile(state.board, t, pet.owner);
  }
}

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
    short: 'Radiant paint + webs enemies',
    ability:
      'Stays put. Every 2 s it paints its tile and all four neighbors (radiant aura). Once per second, every adjacent enemy is also webbed and frozen for 0.9 s — locks down chokepoints while generating territory.',
  },
  tuples: [
    // Passive paint: own tile + 4 neighbors every 2 s.
    { intervalSec: 1 / STATS.radiantPerSec, trigger: () => true, action: spiderRadiant },
    // Web freeze: every adjacent enemy gets frozen for 0.9 s once per second.
    { intervalSec: 1 / STATS.webPerSec, trigger: () => true, action: spiderWeb },
  ],
};
