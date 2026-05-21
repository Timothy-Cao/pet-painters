import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialMatch } from '../../src/sim/match';
import { tryDeploy } from '../../src/sim/deploy';
import { advanceTick } from '../../src/sim/tick';
import { MOUSE, ELEPHANT } from '../../src/sim/pet-defs';
import { TICKS_PER_SEC } from '../../src/config/constants';
import type { MatchState } from '../../src/types/game';

function runTicks(state: MatchState, n: number) {
  for (let i = 0; i < n; i++) advanceTick(state);
}

describe('combat', () => {
  let state: MatchState;
  beforeEach(() => {
    state = createInitialMatch();
    state.phase = 'execution';
    state.energy = { A: 20, B: 20 };
  });

  it('mouse attacks an enemy in front, dealing 1 damage at 1s intervals', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 5, y: 1 }, 'N');
    tryDeploy(state, 'B', MOUSE.id, { x: 5, y: 10 }, 'S');
    // Position pets head-on, with their move tuples pinned so only attacks happen
    state.pets[0].anchor = { x: 5, y: 4 };
    state.pets[0].tupleLastFireTick[0] = 1000;
    state.pets[1].anchor = { x: 5, y: 5 };
    state.pets[1].tupleLastFireTick[0] = 1000;
    const before = state.pets[1].hp;
    runTicks(state, TICKS_PER_SEC); // 1 second = 1 attack interval for mouse
    expect(state.pets[1].hp).toBe(before - MOUSE.atk);
  });

  it('flank attack: defender takes damage but does not retaliate', () => {
    // Pin A at the east edge facing E (front off-board → cannot attack).
    // B sits one tile west of A facing E (B's front contains A → B attacks; A's front off-board → no retaliation).
    tryDeploy(state, 'A', MOUSE.id, { x: 5, y: 1 }, 'E');
    state.pets[0].anchor = { x: 11, y: 5 };
    state.pets[0].tupleLastFireTick[0] = 1000;
    tryDeploy(state, 'B', MOUSE.id, { x: 5, y: 10 }, 'E');
    state.pets[1].anchor = { x: 10, y: 5 };
    state.pets[1].tupleLastFireTick[0] = 1000;

    const aHpBefore = state.pets[0].hp;
    const bHpBefore = state.pets[1].hp;
    runTicks(state, TICKS_PER_SEC); // 1s
    expect(state.pets[0].hp).toBeLessThan(aHpBefore);
    expect(state.pets[1].hp).toBe(bHpBefore);
  });

  it('elephant facing two mice in front hits both per attack', () => {
    tryDeploy(state, 'A', ELEPHANT.id, { x: 5, y: 0 }, 'N');
    state.pets[0].anchor = { x: 5, y: 5 };
    state.pets[0].tupleLastFireTick[0] = 1000;
    tryDeploy(state, 'B', MOUSE.id, { x: 5, y: 10 }, 'S');
    state.pets[1].anchor = { x: 5, y: 7 };
    state.pets[1].tupleLastFireTick[0] = 1000;
    tryDeploy(state, 'B', MOUSE.id, { x: 5, y: 11 }, 'S');
    state.pets[2].anchor = { x: 6, y: 7 };
    state.pets[2].tupleLastFireTick[0] = 1000;

    runTicks(state, TICKS_PER_SEC * 2); // 2s = 1 elephant attack interval
    expect(state.pets.find((p) => p.petId === 2)).toBeUndefined();
    expect(state.pets.find((p) => p.petId === 3)).toBeUndefined();
  });

  it('pet dies and is removed at hp 0', () => {
    tryDeploy(state, 'A', ELEPHANT.id, { x: 5, y: 0 }, 'N');
    state.pets[0].anchor = { x: 5, y: 5 };
    state.pets[0].tupleLastFireTick[0] = 1000;
    tryDeploy(state, 'B', MOUSE.id, { x: 5, y: 11 }, 'S');
    state.pets[1].anchor = { x: 5, y: 7 };
    state.pets[1].tupleLastFireTick[0] = 1000;

    runTicks(state, TICKS_PER_SEC * 2);
    expect(state.pets.find((p) => p.defId === MOUSE.id)).toBeUndefined();
  });
});
