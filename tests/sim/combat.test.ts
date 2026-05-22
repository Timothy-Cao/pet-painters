import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialMatch } from '../../src/sim/match';
import { tryDeploy } from '../../src/sim/deploy';
import { advanceTick } from '../../src/sim/tick';
import { MOUSE, ELEPHANT } from '../../src/sim/pet-defs';
import { TICKS_PER_SEC, HOME_B_MIN_X, HOME_B_MIN_Y } from '../../src/config/constants';

// B's home zone corner: use valid anchor for deployment (then reposition)
const B_HOME_ANCHOR_X = HOME_B_MIN_X;   // 15
const B_HOME_ANCHOR_Y = HOME_B_MIN_Y;   // 15

import type { MatchState } from '../../src/types/game';
import type { Pet } from '../../src/types/pet';

function runTicks(state: MatchState, n: number) {
  for (let i = 0; i < n; i++) advanceTick(state);
}

function pin(pet: Pet) {
  for (let i = 0; i < pet.tupleLastFireTick.length; i++) {
    pet.tupleLastFireTick[i] = 1000;
  }
}

describe('combat', () => {
  let state: MatchState;
  beforeEach(() => {
    state = createInitialMatch();
    state.phase = 'execution';
    state.energy = { A: 20, B: 20 };
  });

  it('mouse attacks an enemy in front, dealing 1 damage at 1s intervals', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 0, y: 0 }, 'N');
    tryDeploy(state, 'B', MOUSE.id, { x: B_HOME_ANCHOR_X, y: B_HOME_ANCHOR_Y }, 'S');
    state.pets[0].anchor = { x: 5, y: 4 };
    state.pets[1].anchor = { x: 5, y: 5 };
    // Pin every tuple on both pets except the attack we want to observe.
    pin(state.pets[0]);
    pin(state.pets[1]);
    // Unpin only pet 0's attack tuple.
    const attackIdx = MOUSE.tuples.findIndex((t) => t.intervalSec === 1 / 1.0 && t.action.name === 'applyAttack');
    state.pets[0].tupleLastFireTick[attackIdx] = -1;

    const before = state.pets[1].hp;
    runTicks(state, TICKS_PER_SEC);
    expect(state.pets[1].hp).toBe(before - MOUSE.atk);
  });

  it('flank attack: defender takes damage but does not retaliate', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 0, y: 0 }, 'E');
    state.pets[0].anchor = { x: 18, y: 5 };
    tryDeploy(state, 'B', MOUSE.id, { x: B_HOME_ANCHOR_X, y: B_HOME_ANCHOR_Y }, 'E');
    state.pets[1].anchor = { x: 17, y: 5 };
    pin(state.pets[0]);
    pin(state.pets[1]);
    // Unpin only B's attack so it lands a hit on A; A faces a wall so it cannot retaliate.
    const attackIdx = MOUSE.tuples.findIndex((t) => t.action.name === 'applyAttack');
    state.pets[1].tupleLastFireTick[attackIdx] = -1;

    const aHpBefore = state.pets[0].hp;
    const bHpBefore = state.pets[1].hp;
    runTicks(state, TICKS_PER_SEC);
    expect(state.pets[0].hp).toBeLessThan(aHpBefore);
    expect(state.pets[1].hp).toBe(bHpBefore);
  });

  it('elephant facing two mice in front kills both within range of attacks', () => {
    tryDeploy(state, 'A', ELEPHANT.id, { x: 0, y: 0 }, 'N');
    state.pets[0].anchor = { x: 5, y: 5 };
    tryDeploy(state, 'B', MOUSE.id, { x: B_HOME_ANCHOR_X, y: B_HOME_ANCHOR_Y }, 'S');
    state.pets[1].anchor = { x: 5, y: 7 };
    tryDeploy(state, 'B', MOUSE.id, { x: B_HOME_ANCHOR_X + 1, y: B_HOME_ANCHOR_Y }, 'S');
    state.pets[2].anchor = { x: 6, y: 7 };
    pin(state.pets[0]);
    pin(state.pets[1]);
    pin(state.pets[2]);
    // Unpin only elephant's attack tuple (ATK=2, mouse HP=3 → 2 hits to kill, 2s per hit = 4s).
    const elephantAtkIdx = ELEPHANT.tuples.findIndex((t) => t.action.name === 'elephantAttack');
    state.pets[0].tupleLastFireTick[elephantAtkIdx] = -1;

    runTicks(state, TICKS_PER_SEC * 4);
    expect(state.pets.find((p) => p.petId === 2)).toBeUndefined();
    expect(state.pets.find((p) => p.petId === 3)).toBeUndefined();
  });

  it('pet dies and is removed at hp 0', () => {
    tryDeploy(state, 'A', ELEPHANT.id, { x: 0, y: 0 }, 'N');
    state.pets[0].anchor = { x: 5, y: 5 };
    tryDeploy(state, 'B', MOUSE.id, { x: B_HOME_ANCHOR_X, y: B_HOME_ANCHOR_Y }, 'S');
    state.pets[1].anchor = { x: 5, y: 7 };
    pin(state.pets[0]);
    pin(state.pets[1]);
    const elephantAtkIdx = ELEPHANT.tuples.findIndex((t) => t.action.name === 'elephantAttack');
    state.pets[0].tupleLastFireTick[elephantAtkIdx] = -1;

    runTicks(state, TICKS_PER_SEC * 4);
    expect(state.pets.find((p) => p.defId === MOUSE.id)).toBeUndefined();
  });
});
