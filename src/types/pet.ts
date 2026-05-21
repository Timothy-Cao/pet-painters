import type { Direction, PlayerId, Vec2, MatchState } from './game';

export interface PetTuple {
  intervalSec: number;
  trigger: (pet: Pet, state: MatchState) => boolean;
  action: (pet: Pet, state: MatchState) => void;
}

export interface PetDefinition {
  id: string;
  displayName: string;
  emoji: string;
  cost: number;
  size: { w: number; h: number };
  weight: number;
  maxHp: number;
  atk: number;
  order: number;
  tuples: PetTuple[];
  // Optional traits
  immovable?: boolean;     // Cannot be pushed by any pet, regardless of weight ratio.
}

export interface Pet {
  petId: number;            // unique per match
  defId: string;
  owner: PlayerId;
  anchor: Vec2;             // top-left tile of the footprint
  facing: Direction;
  hp: number;
  deployTick: number;
  // last-fired tick per tuple index, parallel to def.tuples; -1 means never fired
  tupleLastFireTick: number[];
}
