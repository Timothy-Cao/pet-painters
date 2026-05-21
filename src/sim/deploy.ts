import type { MatchState, PlayerId, Vec2, Direction } from '../types/game';
import type { Pet } from '../types/pet';
import { getPetDef } from './pet-defs';
import { footprintTiles } from './pets';
import { BOARD_SIZE, HOME_ROWS } from '../config/constants';

export type DeployResult =
  | { ok: true; pet: Pet }
  | { ok: false; reason: string };

function homeZoneContains(owner: PlayerId, p: Vec2): boolean {
  if (p.x < 0 || p.x >= BOARD_SIZE) return false;
  if (owner === 'A') return p.y >= 0 && p.y < HOME_ROWS;
  return p.y >= BOARD_SIZE - HOME_ROWS && p.y < BOARD_SIZE;
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
    if (!homeZoneContains(owner, t)) return { ok: false, reason: 'out of home zone' };
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
