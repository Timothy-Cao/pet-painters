import type { PetDefinition, Pet } from '../../types/pet';
import type { MatchState, Vec2 } from '../../types/game';
import { paintTile, getTile } from '../board';
import { walkOrTurnAtWall, tileInBounds } from '../behaviors';
import { pushSplat } from '../../render/effects';

const STATS = {
  cost: 10,                       // reworks r3: 8→10 — at 82.8% dominance, must cost a true budget commitment
  speedTilesPerSec: 0.4,          // slowest — even a touch slower than elephant
  weight: 15,                     // 50% heavier than elephant; pushes everything except itself
  maxHp: 35,                      // largest HP pool of any pet
  atk: 0,                         // pacifist — its mass is the weapon
  atkSpeedPerSec: 0,
  order: 1,                       // acts early, but only walks
  // bespoke
  spoutIntervalSec: 7.0,          // reworks r3: 5→7 — less frequent spouts reduce raw paint output
  spoutRadius: 1,                 // 3×3 splash
} as const;

/** Pick a random tile on the board using state.rng or Math.random. */
function randTile(state: MatchState, size: number): Vec2 {
  const r1 = state.rng ? state.rng.next() : Math.random();
  const r2 = state.rng ? state.rng.next() : Math.random();
  return { x: Math.floor(r1 * size), y: Math.floor(r2 * size) };
}

function whaleSpout(pet: Pet, state: MatchState): void {
  const size = state.board.size;

  // Collect all neutral tiles; fall back to opponent-painted tiles.
  const neutral: Vec2[] = [];
  const opponentPainted: Vec2[] = [];
  const opponent = pet.owner === 'A' ? 'B' : 'A';

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = getTile(state.board, { x, y });
      if (t === 'neutral') neutral.push({ x, y });
      else if (t === opponent) opponentPainted.push({ x, y });
    }
  }

  const pool = neutral.length > 0 ? neutral : opponentPainted;
  if (pool.length === 0) return;

  // Pick a random tile from the pool as splash center.
  const r = state.rng ? state.rng.next() : Math.random();
  const center = pool[Math.floor(r * pool.length)];

  // Paint 3×3 splash around center.
  const rad = STATS.spoutRadius;
  for (let dy = -rad; dy <= rad; dy++) {
    for (let dx = -rad; dx <= rad; dx++) {
      const t: Vec2 = { x: center.x + dx, y: center.y + dy };
      if (tileInBounds(state, t)) {
        paintTile(state.board, t, pet.owner);
        pushSplat(t.x, t.y, pet.owner);
      }
    }
  }
}

export const WHALE: PetDefinition = {
  id: 'whale',
  displayName: 'Whale',
  emoji: '🐳',
  cost: STATS.cost,
  size: { w: 3, h: 3 },            // first 3×3 pet
  weight: STATS.weight,
  maxHp: STATS.maxHp,
  atk: STATS.atk,
  order: STATS.order,
  immovable: true,
  stats: STATS,
  role: 'painter',
  ui: {
    hotkey: 'e',
    short: '3×3 drift + blowhole artillery',
    ability:
      '3×3 painter. Drifts forward slowly. Every 5 seconds, blasts a 3×3 paint splash to a random neutral tile (or random opponent tile when the board is dominated). Its mass makes it immovable.',
  },
  tuples: [
    {
      intervalSec: 1 / STATS.speedTilesPerSec,
      trigger: () => true,
      action: walkOrTurnAtWall,
    },
    {
      intervalSec: STATS.spoutIntervalSec,
      trigger: () => true,
      action: whaleSpout,
    },
  ],
};
