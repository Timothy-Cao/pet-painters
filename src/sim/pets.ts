import type { Direction, Vec2 } from '../types/game';

export interface Size { w: number; h: number; }

export function footprintTiles(anchor: Vec2, size: Size): Vec2[] {
  const out: Vec2[] = [];
  for (let dy = 0; dy < size.h; dy++) {
    for (let dx = 0; dx < size.w; dx++) {
      out.push({ x: anchor.x + dx, y: anchor.y + dy });
    }
  }
  return out;
}

export function frontTiles(anchor: Vec2, size: Size, facing: Direction): Vec2[] {
  // The "front edge" of a footprint depends on facing. We return the tiles immediately past that edge.
  const out: Vec2[] = [];
  switch (facing) {
    case 'N': {
      const y = anchor.y + size.h; // one tile beyond top of footprint
      for (let dx = 0; dx < size.w; dx++) out.push({ x: anchor.x + dx, y });
      break;
    }
    case 'S': {
      const y = anchor.y - 1;
      for (let dx = 0; dx < size.w; dx++) out.push({ x: anchor.x + dx, y });
      break;
    }
    case 'E': {
      const x = anchor.x + size.w;
      for (let dy = 0; dy < size.h; dy++) out.push({ x, y: anchor.y + dy });
      break;
    }
    case 'W': {
      const x = anchor.x - 1;
      for (let dy = 0; dy < size.h; dy++) out.push({ x, y: anchor.y + dy });
      break;
    }
  }
  return out;
}

