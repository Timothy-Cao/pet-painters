import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialMatch } from '../../src/sim/match';
import { tryDeploy } from '../../src/sim/deploy';
import { advanceTick } from '../../src/sim/tick';
import { MOUSE, ELEPHANT } from '../../src/sim/pet-defs';
import { TICKS_PER_SEC } from '../../src/config/constants';
import { getTile } from '../../src/sim/board';
import type { MatchState } from '../../src/types/game';

function runTicks(state: MatchState, n: number) {
  for (let i = 0; i < n; i++) advanceTick(state);
}

describe('mouse movement', () => {
  let state: MatchState;
  beforeEach(() => {
    state = createInitialMatch();
    state.phase = 'execution';
    state.energy = { A: 10, B: 10 };
  });

  it('advances 1 tile after move interval', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    runTicks(state, 10); // 0.5s = 10 ticks
    expect(state.pets[0].anchor).toEqual({ x: 3, y: 1 });
  });

  it('paints the tile it enters', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 1 }, 'N');
    runTicks(state, 10);
    expect(getTile(state.board, { x: 3, y: 2 })).toBe('A');
  });

  it('stops at board edge', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    runTicks(state, TICKS_PER_SEC * 10);
    expect(state.pets[0].anchor.y).toBe(11);
  });

  it('stops when blocked by an allied pet in front', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 1 }, 'N');
    runTicks(state, 10);
    expect(state.pets[0].anchor).toEqual({ x: 3, y: 0 });
    expect(state.pets[1].anchor).toEqual({ x: 3, y: 2 });
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
    runTicks(state, 10);
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
    // Move Elephant out of home zone before deploying Mouse
    state.pets[0].anchor = { x: 1, y: 6 }; // Elephant footprint (1,6)(2,6)(1,7)(2,7); facing N → fronts (1,8)(2,8)
    state.pets[0].facing = 'N';
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    state.pets[1].anchor = { x: 1, y: 8 };
    state.pets[1].facing = 'W';
    // Pin the Mouse so its own move tuple won't fire
    state.pets[1].tupleLastFireTick[0] = 1000;
    runTicks(state, 40); // 1 Elephant move interval
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
      // Pin each Mouse so its own move tuple won't fire
      state.pets[1 + i].tupleLastFireTick[0] = 1000;
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
      // Pin each Mouse so its own move tuple won't fire
      state.pets[1 + i].tupleLastFireTick[0] = 1000;
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
    // Pin the Mouse so its own move tuple won't fire
    state.pets[1].tupleLastFireTick[0] = 1000;
    runTicks(state, 40);
    expect(state.pets[0].anchor).toEqual({ x: 1, y: 9 });
  });

  it('Mouse cannot push an Elephant (weight 1 vs 10)', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 5, y: 1 }, 'N');
    state.pets[0].anchor = { x: 5, y: 5 };
    state.pets[0].facing = 'N';
    tryDeploy(state, 'B', ELEPHANT.id, { x: 5, y: 10 }, 'S'); // 2x2 footprint at y=10,11 ✓
    state.pets[1].anchor = { x: 5, y: 6 };
    state.pets[1].facing = 'W';
    // Pin the Elephant so its own move tuple won't fire
    state.pets[1].tupleLastFireTick[0] = 1000;
    runTicks(state, 10);
    expect(state.pets[0].anchor).toEqual({ x: 5, y: 5 });
  });
});
