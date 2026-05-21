// Per-pet smoke tests. Each pet is deployed alone in an empty arena and run
// for several seconds. The harness asserts:
//   - The pet (and the sim) never crashes.
//   - The pet at least paints something OR is intentionally stationary.
//   - Pets bounded by the board never leave the board.
//
// These exist to catch the "I shipped a pet with a broken trigger and CI
// passed because the existing tests only cover Mouse/Elephant" failure mode.

import { describe, it, expect } from 'vitest';
import { newScenario } from './scenario';
import { ALL_PETS } from '../src/sim/pets';
import { TICKS_PER_SEC, BOARD_SIZE } from '../src/config/constants';

const RUN_SECONDS = 8;
const RUN_TICKS = TICKS_PER_SEC * RUN_SECONDS;

describe('pet smoke tests', () => {
  for (const def of ALL_PETS) {
    it(`${def.displayName}: survives ${RUN_SECONDS}s solo without crashing`, () => {
      const s = newScenario();
      // Place near the bottom-left, facing north.
      s.place('A', def.id, { x: 2, y: 2 }, 'N');
      expect(() => s.run(RUN_TICKS)).not.toThrow();
    });

    it(`${def.displayName}: stays in-bounds after ${RUN_SECONDS}s`, () => {
      const s = newScenario();
      const pet = s.place('A', def.id, { x: 5, y: 5 }, 'N');
      s.run(RUN_TICKS);
      // Pet may have died only if it's involved in combat (it isn't here).
      expect(s.alive(def.id, 'A').length).toBe(1);
      const minX = 0;
      const minY = 0;
      const maxX = BOARD_SIZE - def.size.w;
      const maxY = BOARD_SIZE - def.size.h;
      expect(pet.anchor.x).toBeGreaterThanOrEqual(minX);
      expect(pet.anchor.x).toBeLessThanOrEqual(maxX);
      expect(pet.anchor.y).toBeGreaterThanOrEqual(minY);
      expect(pet.anchor.y).toBeLessThanOrEqual(maxY);
    });

    if (def.stats.speedTilesPerSec > 0) {
      it(`${def.displayName}: paints at least one tile when moving`, () => {
        const s = newScenario();
        s.place('A', def.id, { x: 5, y: 5 }, 'N');
        const before = s.paintedBy('A');
        s.run(RUN_TICKS);
        const after = s.paintedBy('A');
        expect(after).toBeGreaterThan(before);
      });
    }
  }
});
