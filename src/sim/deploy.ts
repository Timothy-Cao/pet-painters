import type { MatchState, PlayerId, Vec2, Direction } from '../types/game';
import type { Pet } from '../types/pet';
import { getPetDef } from './pet-defs';
import { footprintTiles } from './geometry';
import { BOARD_SIZE } from '../config/constants';
import { getTile } from './board';

export type DeployResult =
  | { ok: true; pet: Pet }
  | { ok: false; reason: string };

// A pet may be deployed onto any tile the player currently owns (painted with
// their color), so long as every tile of its footprint is in-bounds and owned.
function tileOwnedByPlayer(state: MatchState, owner: PlayerId, p: Vec2): boolean {
  if (p.x < 0 || p.x >= BOARD_SIZE || p.y < 0 || p.y >= BOARD_SIZE) return false;
  return getTile(state.board, p) === owner;
}

export function tryDeploy(
  state: MatchState,
  owner: PlayerId,
  defId: string,
  anchor: Vec2,
  facing: Direction,
): DeployResult {
  const def = getPetDef(defId);

  if (!state.sandbox && state.energy[owner] < def.cost) {
    return { ok: false, reason: 'insufficient energy' };
  }

  const tiles = footprintTiles(anchor, def.size);
  for (const t of tiles) {
    if (!tileOwnedByPlayer(state, owner, t)) return { ok: false, reason: 'tile not owned' };
  }

  // Check tile occupancy
  const occupied = new Set<string>();
  for (const p of state.pets) {
    const pdef = getPetDef(p.defId);
    for (const ft of footprintTiles(p.anchor, pdef.size)) occupied.add(`${ft.x},${ft.y}`);
  }
  for (const t of tiles) {
    if (occupied.has(`${t.x},${t.y}`)) return { ok: false, reason: 'tile occupied' };
  }

  const pet: Pet = {
    petId: state.nextPetId++,
    defId,
    owner,
    anchor,
    facing,
    hp: def.maxHp,
    deployTick: state.tick,
    tupleLastFireTick: def.tuples.map(() => -1),
  };

  if (!state.sandbox) state.energy[owner] -= def.cost;
  state.pets.push(pet);
  return { ok: true, pet };
}

// Find the pet whose footprint includes the given tile, if any (only valid during planning).
export function petAtTile(state: MatchState, tile: Vec2): import('../types/pet').Pet | null {
  for (const p of state.pets) {
    const def = getPetDef(p.defId);
    for (const ft of footprintTiles(p.anchor, def.size)) {
      if (ft.x === tile.x && ft.y === tile.y) return p;
    }
  }
  return null;
}

// Remove a pet from the match and refund its energy cost (no-op refund in sandbox).
export function undeploy(state: MatchState, petId: number): boolean {
  const idx = state.pets.findIndex((p) => p.petId === petId);
  if (idx < 0) return false;
  const pet = state.pets[idx];
  const def = getPetDef(pet.defId);
  state.pets.splice(idx, 1);
  if (!state.sandbox) {
    state.energy[pet.owner] = Math.min(state.energy[pet.owner] + def.cost, Number.MAX_SAFE_INTEGER);
  }
  return true;
}
