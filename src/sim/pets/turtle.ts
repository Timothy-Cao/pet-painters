import type { PetDefinition, Pet } from '../../types/pet';
import type { MatchState, Vec2 } from '../../types/game';
import { paintTile } from '../board';
import { tileInBounds, walkOrRotateCW, ORTHO_DELTAS } from '../behaviors';

const STATS = {
  cost: 4,
  speedTilesPerSec: 0.5,
  weight: 3,
  maxHp: 8,
  atk: 0,
  atkSpeedPerSec: 0,
  order: 2,
  // bespoke
  splashPerSec: 1,
} as const;

function turtleSplash(pet: Pet, state: MatchState): void {
  // Paint all 4 orthogonal neighbors in the turtle's color.
  for (const d of ORTHO_DELTAS) {
    const t: Vec2 = { x: pet.anchor.x + d.x, y: pet.anchor.y + d.y };
    if (tileInBounds(state, t)) paintTile(state.board, t, pet.owner);
  }
}

export const TURTLE: PetDefinition = {
  id: 'turtle',
  displayName: 'Turtle',
  emoji: '🐢',
  cost: STATS.cost,
  size: { w: 1, h: 1 },
  weight: STATS.weight,
  maxHp: STATS.maxHp,
  atk: STATS.atk,
  order: STATS.order,
  stats: STATS,
  ui: {
    hotkey: '5',
    short: 'Slow, paints all around',
    ability:
      'Once per second, paints all four neighboring tiles in its color. Slow walker, but its real damage is in area coverage.',
  },
  tuples: [
    { intervalSec: 1 / STATS.speedTilesPerSec, trigger: () => true, action: walkOrRotateCW },
    { intervalSec: 1 / STATS.splashPerSec, trigger: () => true, action: turtleSplash },
  ],
};
