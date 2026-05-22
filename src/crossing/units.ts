/**
 * units.ts — 5 unit types for Critter Crossing v2.
 *
 * Chess-inspired movement with emoji flavor.
 * Each unit has a distinct tactical role.
 */

import type { UnitDef } from './types';

export const MOUSE: UnitDef = {
  id: 'mouse',
  displayName: 'Mouse',
  emoji: '\u{1F42D}',
  size: 1,
  terrain: 'land',
  moveDesc: '1-2 tiles orthogonal (rook)',
  abilityDesc: 'Slips through units — can pass over occupied tiles.',
};

export const CAT: UnitDef = {
  id: 'cat',
  displayName: 'Cat',
  emoji: '\u{1F431}',
  size: 1,
  terrain: 'land',
  moveDesc: '1-2 tiles diagonal (bishop)',
  abilityDesc: 'Pounce capture — jumps over enemy to land behind (checkers).',
};

export const RABBIT: UnitDef = {
  id: 'rabbit',
  displayName: 'Rabbit',
  emoji: '\u{1F430}',
  size: 1,
  terrain: 'land',
  moveDesc: 'L-shape: 2+1 tiles (knight)',
  abilityDesc: 'Hops over everything. Cannot be blocked.',
};

export const EAGLE: UnitDef = {
  id: 'eagle',
  displayName: 'Eagle',
  emoji: '\u{1F985}',
  size: 1,
  terrain: 'land',
  moveDesc: '1-3 tiles any direction (queen)',
  abilityDesc: 'Fastest unit but cannot capture enemies.',
};

export const ELEPHANT: UnitDef = {
  id: 'elephant',
  displayName: 'Elephant',
  emoji: '\u{1F418}',
  size: 1,
  terrain: 'land',
  moveDesc: '1 tile orthogonal (king)',
  abilityDesc: 'Charge: pushes adjacent enemy 1 tile back. Cannot be captured.',
};

export const ALL_CROSSING_UNITS: readonly UnitDef[] = [
  MOUSE, CAT, RABBIT, EAGLE, ELEPHANT,
];

export function getUnitDef(defId: string): UnitDef {
  const def = ALL_CROSSING_UNITS.find((d) => d.id === defId);
  if (!def) throw new Error(`Unknown crossing unit: ${defId}`);
  return def;
}

/** Starting army — 1 of each. */
export const DEFAULT_ARMY: string[] = [
  'elephant', 'mouse', 'rabbit', 'cat', 'eagle',
];
