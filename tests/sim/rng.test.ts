import { describe, it, expect } from 'vitest';
import { createRng, hashSeed } from '../../src/sim/rng';

describe('createRng', () => {
  it('produces a deterministic sequence for a given seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('values are in [0,1)', () => {
    const r = createRng(42);
    for (let i = 0; i < 100; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('hashSeed', () => {
  it('produces stable 32-bit integers', () => {
    expect(hashSeed('room-1', 0)).toBe(hashSeed('room-1', 0));
    expect(hashSeed('room-1', 0)).not.toBe(hashSeed('room-1', 1));
    expect(hashSeed('room-1', 0)).not.toBe(hashSeed('room-2', 0));
  });
});
