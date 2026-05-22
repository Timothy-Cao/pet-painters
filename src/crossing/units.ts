/**
 * units.ts — Unit definitions for Critter Crossing.
 *
 * Each unit has unique movement and ability rules.
 * Movement computation lives in moves.ts; this file defines the roster.
 */

import type { UnitDef } from './types';

export const MOUSE: UnitDef = {
  id: 'mouse',
  displayName: 'Mouse',
  emoji: '\u{1F42D}', // 🐭
  size: 1,
  terrain: 'land',
  abilityDesc: 'Scurry: Can move through friendly units.',
};

export const CAT: UnitDef = {
  id: 'cat',
  displayName: 'Cat',
  emoji: '\u{1F431}', // 🐱
  size: 1,
  terrain: 'land',
  abilityDesc: 'Pounce: Can leap over 1 adjacent unit.',
};

export const RABBIT: UnitDef = {
  id: 'rabbit',
  displayName: 'Rabbit',
  emoji: '\u{1F430}', // 🐰
  size: 1,
  terrain: 'land',
  abilityDesc: 'Chain Hop: Jumps over consecutive units in a line.',
};

export const TURTLE: UnitDef = {
  id: 'turtle',
  displayName: 'Turtle',
  emoji: '\u{1F422}', // 🐢
  size: 1,
  terrain: 'amphibious',
  abilityDesc: 'Shell: Cannot be pushed. Blocks push chains.',
};

export const EAGLE: UnitDef = {
  id: 'eagle',
  displayName: 'Eagle',
  emoji: '\u{1F985}', // 🦅
  size: 1,
  terrain: 'flying',
  abilityDesc: 'Soar: Flies over all units and terrain (2 tiles any direction).',
};

export const FROG: UnitDef = {
  id: 'frog',
  displayName: 'Frog',
  emoji: '\u{1F438}', // 🐸
  size: 1,
  terrain: 'amphibious',
  abilityDesc: 'Leap: From water, can jump 3 tiles forward.',
};

export const ELEPHANT: UnitDef = {
  id: 'elephant',
  displayName: 'Elephant',
  emoji: '\u{1F418}', // 🐘
  size: 2,
  terrain: 'land',
  abilityDesc: 'Trample: Pushes small units in move direction back 2 tiles.',
};

export const WHALE: UnitDef = {
  id: 'whale',
  displayName: 'Whale',
  emoji: '\u{1F40B}', // 🐋
  size: 2,
  terrain: 'water',
  abilityDesc: 'Splash: After moving, pushes adjacent small units 1 tile away.',
};

/** All unit definitions, ordered for the roster display. */
export const ALL_CROSSING_UNITS: readonly UnitDef[] = [
  MOUSE, CAT, RABBIT, TURTLE, EAGLE, FROG, ELEPHANT, WHALE,
];

/** Lookup a unit definition by id. */
export function getUnitDef(defId: string): UnitDef {
  const def = ALL_CROSSING_UNITS.find((d) => d.id === defId);
  if (!def) throw new Error(`Unknown crossing unit: ${defId}`);
  return def;
}

/** The default starting army for each player. */
export interface ArmyEntry {
  defId: string;
  count: number;
}

export const DEFAULT_ARMY: ArmyEntry[] = [
  { defId: 'rabbit', count: 3 },
  { defId: 'mouse', count: 2 },
  { defId: 'cat', count: 2 },
  { defId: 'turtle', count: 1 },
  { defId: 'eagle', count: 1 },
  { defId: 'frog', count: 1 },
  { defId: 'elephant', count: 1 },
  { defId: 'whale', count: 1 },
];
