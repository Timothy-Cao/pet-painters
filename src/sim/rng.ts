// mulberry32 — small, fast, deterministic PRNG.
export interface Rng {
  next(): number;
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  return {
    next() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

// FNV-1a 32-bit hash. Stable across browsers.
export function hashSeed(roomId: string, round: number): number {
  let h = 2166136261 >>> 0;
  const input = `${roomId}|${round}`;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
