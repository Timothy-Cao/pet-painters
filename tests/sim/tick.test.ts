import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialMatch } from '../../src/sim/match';
import { tryDeploy } from '../../src/sim/deploy';
import { advanceTick } from '../../src/sim/tick';
import { MOUSE } from '../../src/sim/pet-defs';
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

  it('fires a pet tuple exactly once per interval', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    const pet = state.pets[0];
    // Mouse move tuple interval = 0.5s = 10 ticks at 20Hz.
    // The tuple is currently a stub (trigger returns false), but lastFireTick is still set when timer elapses.
    runTicks(state, 9);
    expect(pet.tupleLastFireTick[0]).toBe(-1);
    advanceTick(state);
    expect(pet.tupleLastFireTick[0]).toBe(10);
    runTicks(state, 10);
    expect(pet.tupleLastFireTick[0]).toBe(20);
  });
});
