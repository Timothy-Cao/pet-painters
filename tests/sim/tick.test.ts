import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialMatch } from '../../src/sim/match';
import { tryDeploy } from '../../src/sim/deploy';
import { advanceTick } from '../../src/sim/tick';
import { MOUSE, TUPLE_INDEX_MOVE } from '../../src/sim/pet-defs';
import type { MatchState } from '../../src/types/game';

function runTicks(state: MatchState, n: number) {
  for (let i = 0; i < n; i++) advanceTick(state);
}

describe('advanceTick', () => {
  let state: MatchState;
  beforeEach(() => {
    state = createInitialMatch();
    state.phase = 'execution';
  });

  it('increments tick by 1', () => {
    const t = state.tick;
    advanceTick(state);
    expect(state.tick).toBe(t + 1);
  });

  it('does not advance when phase is not execution', () => {
    state.phase = 'planning';
    advanceTick(state);
    expect(state.tick).toBe(0);
  });

  it('fires the mouse move tuple exactly once per interval', () => {
    // Mouse move tuple interval = 0.25s = 5 ticks at 20Hz (speed 4 tiles/sec).
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    const pet = state.pets[0];
    runTicks(state, 4);
    expect(pet.tupleLastFireTick[TUPLE_INDEX_MOVE]).toBe(-1);
    advanceTick(state);
    expect(pet.tupleLastFireTick[TUPLE_INDEX_MOVE]).toBe(5);
    runTicks(state, 5);
    expect(pet.tupleLastFireTick[TUPLE_INDEX_MOVE]).toBe(10);
  });
});
