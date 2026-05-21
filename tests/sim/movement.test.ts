import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialMatch } from '../../src/sim/match';
import { tryDeploy } from '../../src/sim/deploy';
import { advanceTick } from '../../src/sim/tick';
import { MOUSE, ELEPHANT } from '../../src/sim/pet-defs';
import { TICKS_PER_SEC } from '../../src/config/constants';
import { getTile } from '../../src/sim/board';
import type { MatchState } from '../../src/types/game';
import type { Pet } from '../../src/types/pet';

function runTicks(state: MatchState, n: number) {
  for (let i = 0; i < n; i++) advanceTick(state);
}

// Pin every tuple on the pet so its own behaviors won't fire until well past
// the duration of any test. Useful for isolating push/conflict mechanics.
function pin(pet: Pet) {
  for (let i = 0; i < pet.tupleLastFireTick.length; i++) {
    pet.tupleLastFireTick[i] = 1000;
  }
}

// Mouse moves at 4 tiles/sec → one step every 5 ticks at 20Hz.
const MOUSE_TICKS_PER_STEP = TICKS_PER_SEC / 4; // = 5

describe('mouse movement', () => {
  let state: MatchState;
  beforeEach(() => {
    state = createInitialMatch();
    state.phase = 'execution';
    state.energy = { A: 10, B: 10 };
  });

  it('advances 1 tile after move interval', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    runTicks(state, MOUSE_TICKS_PER_STEP);
    expect(state.pets[0].anchor).toEqual({ x: 3, y: 1 });
  });

  it('paints the tile it enters', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 1 }, 'N');
    runTicks(state, MOUSE_TICKS_PER_STEP);
    expect(getTile(state.board, { x: 3, y: 2 })).toBe('A');
  });

  it('scurries (changes facing) the first time it hits the board edge', () => {
    // Mouse moves N at 4 tiles/sec = every 5 ticks. From y=0 to y=11 is 11 steps
    // = 55 ticks. On tick 60 it tries to step beyond the edge, hits the wall, and
    // its scurry tuple fires — which always turns to W/E/S, never N. Run exactly
    // that long so we observe the deterministic first turn without later random
    // walks possibly drifting back to N.
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    runTicks(state, 60);
    expect(state.pets[0].anchor.y).toBe(11);
    expect(state.pets[0].facing).not.toBe('N');
  });

  it('scurries (changes facing) when blocked by an allied pet in front', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 1 }, 'N');
    // Pin the front mouse so it stays put as a blocker.
    pin(state.pets[1]);
    runTicks(state, MOUSE_TICKS_PER_STEP);
    // The blocked mouse (state.pets[0]) should have turned rather than stepped into the blocker.
    expect(state.pets[0].anchor).toEqual({ x: 3, y: 0 });
    expect(state.pets[0].facing).not.toBe('N');
  });
});

describe('entry conflicts', () => {
  let state: MatchState;
  beforeEach(() => {
    state = createInitialMatch();
    state.phase = 'execution';
    state.energy = { A: 10, B: 10 };
  });

  it('two mice racing to the same empty tile: equal weight → exactly one wins (random)', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 5, y: 1 }, 'N'); // target (5,2)
    state.energy.B = 10;
    tryDeploy(state, 'B', MOUSE.id, { x: 5, y: 3 }, 'S'); // target (5,2)
    runTicks(state, MOUSE_TICKS_PER_STEP);
    const occupants = state.pets.filter(p => p.anchor.x === 5 && p.anchor.y === 2);
    expect(occupants.length).toBe(1);
  });
});

describe('push-through movement', () => {
  let state: MatchState;
  beforeEach(() => {
    state = createInitialMatch();
    state.phase = 'execution';
    state.energy = { A: 50, B: 50 };
  });

  it('Elephant pushes a single Mouse forward', () => {
    tryDeploy(state, 'A', ELEPHANT.id, { x: 0, y: 0 }, 'N');
    state.pets[0].anchor = { x: 1, y: 6 };
    state.pets[0].facing = 'N';
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    state.pets[1].anchor = { x: 1, y: 8 };
    state.pets[1].facing = 'W';
    pin(state.pets[1]);
    runTicks(state, 40); // 1 Elephant move interval (2s)
    expect(state.pets[1].anchor).toEqual({ x: 1, y: 9 });
    expect(state.pets[0].anchor).toEqual({ x: 1, y: 7 });
  });

  it('Elephant pushes a chain of 4 Mice (sum 4 < 5)', () => {
    tryDeploy(state, 'A', ELEPHANT.id, { x: 1, y: 0 }, 'N');
    state.pets[0].anchor = { x: 1, y: 4 };
    state.pets[0].facing = 'N';
    for (let i = 0; i < 4; i++) {
      tryDeploy(state, 'A', MOUSE.id, { x: 1, y: 1 }, 'N');
      state.pets[1 + i].anchor = { x: 1, y: 6 + i };
      state.pets[1 + i].facing = 'W';
      pin(state.pets[1 + i]);
    }
    runTicks(state, 40);
    for (let i = 0; i < 4; i++) {
      expect(state.pets[1 + i].anchor).toEqual({ x: 1, y: 7 + i });
    }
    expect(state.pets[0].anchor).toEqual({ x: 1, y: 5 });
  });

  it('Elephant blocked by 5 Mice (sum 5, NOT strictly less than 5)', () => {
    tryDeploy(state, 'A', ELEPHANT.id, { x: 1, y: 0 }, 'N');
    state.pets[0].anchor = { x: 1, y: 4 };
    state.pets[0].facing = 'N';
    for (let i = 0; i < 5; i++) {
      tryDeploy(state, 'A', MOUSE.id, { x: 1, y: 1 }, 'N');
      state.pets[1 + i].anchor = { x: 1, y: 6 + i };
      state.pets[1 + i].facing = 'W';
      pin(state.pets[1 + i]);
    }
    runTicks(state, 40);
    expect(state.pets[0].anchor).toEqual({ x: 1, y: 4 });
  });

  it('Elephant blocked when chain hits board edge with no empty tile', () => {
    tryDeploy(state, 'A', ELEPHANT.id, { x: 1, y: 0 }, 'N');
    state.pets[0].anchor = { x: 1, y: 9 };
    state.pets[0].facing = 'N';
    tryDeploy(state, 'A', MOUSE.id, { x: 1, y: 1 }, 'N');
    state.pets[1].anchor = { x: 1, y: 11 };
    state.pets[1].facing = 'W';
    pin(state.pets[1]);
    runTicks(state, 40);
    expect(state.pets[0].anchor).toEqual({ x: 1, y: 9 });
  });

  it('Mouse facing an immovable Elephant scurries instead of pushing', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 5, y: 1 }, 'N');
    state.pets[0].anchor = { x: 5, y: 5 };
    state.pets[0].facing = 'N';
    tryDeploy(state, 'B', ELEPHANT.id, { x: 5, y: 10 }, 'S');
    state.pets[1].anchor = { x: 5, y: 6 };
    state.pets[1].facing = 'W';
    pin(state.pets[1]);
    runTicks(state, MOUSE_TICKS_PER_STEP);
    // The mouse must not have stepped onto the elephant's footprint.
    expect(state.pets[0].anchor).not.toEqual({ x: 5, y: 6 });
    // The mouse should no longer be facing N (it scurry-turned away from the wall of elephant).
    expect(state.pets[0].facing).not.toBe('N');
    // The elephant did not move (it's pinned).
    expect(state.pets[1].anchor).toEqual({ x: 5, y: 6 });
  });
});
