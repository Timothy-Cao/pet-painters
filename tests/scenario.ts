// Scenario harness for scripted simulations. Used by smoke tests and any
// future balance/matchup tests. Build a scenario in a few lines:
//
//   const s = newScenario();
//   s.place('A', MOUSE.id, { x: 3, y: 0 }, 'N');
//   s.place('B', ELEPHANT.id, { x: 4, y: 10 }, 'S');
//   s.run(TICKS_PER_SEC * 10);
//   expect(s.alive(MOUSE.id, 'A').length).toBeGreaterThan(0);
//
// The harness skips the planning phase entirely: pets are inserted directly
// into the live execution state at full HP and the chosen anchor/facing.

import { createInitialMatch } from '../src/sim/match';
import { advanceTick } from '../src/sim/tick';
import { getPetDef } from '../src/sim/pet-defs';
import type { MatchState, PlayerId, Direction, Vec2 } from '../src/types/game';
import type { Pet } from '../src/types/pet';

export interface Scenario {
  readonly state: MatchState;
  place(owner: PlayerId, defId: string, anchor: Vec2, facing: Direction): Pet;
  pin(pet: Pet): void;
  run(ticks: number): void;
  alive(defId?: string, owner?: PlayerId): Pet[];
  paintedBy(player: PlayerId): number;
}

export function newScenario(opts: { sandbox?: boolean } = {}): Scenario {
  const state = createInitialMatch({ sandbox: opts.sandbox ?? true });
  state.phase = 'execution';
  state.energy = { A: 9999, B: 9999 };

  function place(owner: PlayerId, defId: string, anchor: Vec2, facing: Direction): Pet {
    const def = getPetDef(defId);
    const pet: Pet = {
      petId: state.nextPetId++,
      defId,
      owner,
      anchor: { ...anchor },
      facing,
      hp: def.maxHp,
      deployTick: state.tick,
      tupleLastFireTick: def.tuples.map(() => -1),
    };
    state.pets.push(pet);
    return pet;
  }

  function pin(pet: Pet): void {
    for (let i = 0; i < pet.tupleLastFireTick.length; i++) {
      pet.tupleLastFireTick[i] = 1_000_000;
    }
  }

  function run(ticks: number): void {
    for (let i = 0; i < ticks; i++) advanceTick(state);
  }

  function alive(defId?: string, owner?: PlayerId): Pet[] {
    return state.pets.filter((p) =>
      (defId === undefined || p.defId === defId) &&
      (owner === undefined || p.owner === owner));
  }

  function paintedBy(player: PlayerId): number {
    let n = 0;
    for (const t of state.board.tiles) if (t === player) n++;
    return n;
  }

  return { state, place, pin, run, alive, paintedBy };
}
