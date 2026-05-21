import { describe, it, expect } from 'vitest';
import { footprintTiles, frontTiles } from '../../src/sim/geometry';

describe('footprintTiles', () => {
  it('returns single tile for 1x1', () => {
    const tiles = footprintTiles({ x: 5, y: 7 }, { w: 1, h: 1 });
    expect(tiles).toEqual([{ x: 5, y: 7 }]);
  });

  it('returns four tiles for 2x2 (anchor is top-left)', () => {
    const tiles = footprintTiles({ x: 3, y: 4 }, { w: 2, h: 2 });
    expect(tiles).toEqual([
      { x: 3, y: 4 }, { x: 4, y: 4 },
      { x: 3, y: 5 }, { x: 4, y: 5 },
    ]);
  });
});

describe('frontTiles', () => {
  it('1x1 facing N: one tile north of anchor', () => {
    expect(frontTiles({ x: 5, y: 5 }, { w: 1, h: 1 }, 'N')).toEqual([{ x: 5, y: 6 }]);
  });

  it('1x1 facing S: one tile south', () => {
    expect(frontTiles({ x: 5, y: 5 }, { w: 1, h: 1 }, 'S')).toEqual([{ x: 5, y: 4 }]);
  });

  it('1x1 facing E: one tile east', () => {
    expect(frontTiles({ x: 5, y: 5 }, { w: 1, h: 1 }, 'E')).toEqual([{ x: 6, y: 5 }]);
  });

  it('1x1 facing W: one tile west', () => {
    expect(frontTiles({ x: 5, y: 5 }, { w: 1, h: 1 }, 'W')).toEqual([{ x: 4, y: 5 }]);
  });

  it('2x2 facing N: two tiles north of front edge', () => {
    // anchor (3,4) → footprint occupies (3,4) (4,4) (3,5) (4,5). Front edge facing N is y=5; in front = y=6.
    expect(frontTiles({ x: 3, y: 4 }, { w: 2, h: 2 }, 'N')).toEqual([{ x: 3, y: 6 }, { x: 4, y: 6 }]);
  });

  it('2x2 facing E: two tiles east of front edge', () => {
    expect(frontTiles({ x: 3, y: 4 }, { w: 2, h: 2 }, 'E')).toEqual([{ x: 5, y: 4 }, { x: 5, y: 5 }]);
  });
});
