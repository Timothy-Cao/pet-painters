// Behavior building blocks used by pet definitions.
//
// All pets are expressed as tuples of (interval, trigger, action). These
// helpers are the action and trigger primitives a pet author composes from.
// Keep this file pure (no DOM, no rendering) so behaviors stay unit-testable.

import type { Direction, MatchState, Vec2 } from '../types/game';
import type { Pet } from '../types/pet';
import { frontTiles, footprintTiles } from './geometry';
import { getPetDef } from './pet-defs';

// ---------- Direction maths ----------

export const CW_NEXT: Record<Direction, Direction> = { N: 'E', E: 'S', S: 'W', W: 'N' };
export const CCW_NEXT: Record<Direction, Direction> = { N: 'W', W: 'S', S: 'E', E: 'N' };
export const OPPOSITE: Record<Direction, Direction> = { N: 'S', S: 'N', E: 'W', W: 'E' };

export function facingDelta(d: Direction): Vec2 {
  switch (d) {
    case 'N': return { x: 0, y: 1 };
    case 'S': return { x: 0, y: -1 };
    case 'E': return { x: 1, y: 0 };
    case 'W': return { x: -1, y: 0 };
  }
}

// ---------- Board queries ----------

export function tileInBounds(state: MatchState, t: Vec2): boolean {
  return t.x >= 0 && t.x < state.board.size && t.y >= 0 && t.y < state.board.size;
}

export function frontInBounds(pet: Pet, state: MatchState): boolean {
  const def = getPetDef(pet.defId);
  for (const t of frontTiles(pet.anchor, def.size, pet.facing)) {
    if (!tileInBounds(state, t)) return false;
  }
  return true;
}

export function frontHasPet(pet: Pet, state: MatchState): boolean {
  const def = getPetDef(pet.defId);
  const fronts = frontTiles(pet.anchor, def.size, pet.facing);
  for (const other of state.pets) {
    if (other === pet) continue;
    const odef = getPetDef(other.defId);
    const occupied = footprintTiles(other.anchor, odef.size);
    for (const f of fronts) {
      for (const o of occupied) {
        if (o.x === f.x && o.y === f.y) return true;
      }
    }
  }
  return false;
}

export function frontIsWall(pet: Pet, state: MatchState): boolean {
  return !frontInBounds(pet, state);
}

export function frontBlocked(pet: Pet, state: MatchState): boolean {
  return frontIsWall(pet, state) || frontHasPet(pet, state);
}

/** Returns the pet whose footprint covers tile `t`, or null. `except` is skipped. */
export function anyPetAt(state: MatchState, t: Vec2, except: Pet | null = null): Pet | null {
  for (const other of state.pets) {
    if (except && other === except) continue;
    const odef = getPetDef(other.defId);
    for (const o of footprintTiles(other.anchor, odef.size)) {
      if (o.x === t.x && o.y === t.y) return other;
    }
  }
  return null;
}

// ---------- Movement actions ----------

/** Push a forward move intent through the standard movement / push system. */
export function declareMove(pet: Pet, state: MatchState): void {
  const d = facingDelta(pet.facing);
  state.moveIntents.push({
    petId: pet.petId,
    from: pet.anchor,
    to: { x: pet.anchor.x + d.x, y: pet.anchor.y + d.y },
  });
}

/** 45% left / 45% right / 10% U-turn. Used by scurry-style pets. */
export function scurryTurn(pet: Pet): void {
  const r = Math.random();
  if (r < 0.45) pet.facing = CCW_NEXT[pet.facing];
  else if (r < 0.9) pet.facing = CW_NEXT[pet.facing];
  else pet.facing = OPPOSITE[pet.facing];
}

/** 180° flip. */
export function turnAround(pet: Pet): void {
  pet.facing = OPPOSITE[pet.facing];
}

/** 90° clockwise rotation. */
export function rotateCW(pet: Pet): void {
  pet.facing = CW_NEXT[pet.facing];
}

/** 90° counter-clockwise rotation. */
export function rotateCCW(pet: Pet): void {
  pet.facing = CCW_NEXT[pet.facing];
}

// ---------- Common composite actions ----------

/** Walk forward when clear; scurry-turn otherwise. The "default safe walker". */
export function walkOrScurry(pet: Pet, state: MatchState): void {
  if (frontBlocked(pet, state)) scurryTurn(pet);
  else declareMove(pet, state);
}

/** Walk forward when clear; rotate CW when blocked. Predictable spiral-walker. */
export function walkOrRotateCW(pet: Pet, state: MatchState): void {
  if (frontBlocked(pet, state)) rotateCW(pet);
  else declareMove(pet, state);
}

/** Walk forward when in-bounds; about-face only at walls. Used by tanks. */
export function walkOrTurnAtWall(pet: Pet, state: MatchState): void {
  if (frontIsWall(pet, state)) turnAround(pet);
  else declareMove(pet, state);
}

// ---------- 8-neighbor (king's move) helper ----------

export const ORTHO_DELTAS: Vec2[] = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
];

export const DIAG_DELTAS: Vec2[] = [
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
];

export const KING_DELTAS: Vec2[] = [...ORTHO_DELTAS, ...DIAG_DELTAS];

// ---------- Sightline ----------

export type SightHit =
  | { kind: 'enemy'; pet: Pet; distance: number }
  | { kind: 'ally'; pet: Pet; distance: number }
  | { kind: 'wall'; distance: number }
  | { kind: 'clear' };

/** Cast a ray from the pet's front edge in its facing direction. Returns the
 *  first thing it hits — enemy, ally, wall, or nothing within `maxDistance`. */
export function lookAhead(pet: Pet, state: MatchState, maxDistance: number): SightHit {
  const def = getPetDef(pet.defId);
  const d = facingDelta(pet.facing);
  const fronts = frontTiles(pet.anchor, def.size, pet.facing);
  for (let dist = 0; dist < maxDistance; dist++) {
    for (const f of fronts) {
      const t: Vec2 = { x: f.x + d.x * dist, y: f.y + d.y * dist };
      if (!tileInBounds(state, t)) {
        return { kind: 'wall', distance: dist + 1 };
      }
      for (const other of state.pets) {
        if (other === pet) continue;
        const odef = getPetDef(other.defId);
        for (const o of footprintTiles(other.anchor, odef.size)) {
          if (o.x === t.x && o.y === t.y) {
            return {
              kind: other.owner !== pet.owner ? 'enemy' : 'ally',
              pet: other,
              distance: dist + 1,
            };
          }
        }
      }
    }
  }
  return { kind: 'clear' };
}

export function enemyInSight(pet: Pet, state: MatchState, maxDistance: number): boolean {
  return lookAhead(pet, state, maxDistance).kind === 'enemy';
}
