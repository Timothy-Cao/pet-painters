// Centralized color palette for the canvas. CSS-side variables (in styles.css)
// are kept in lockstep via a body class — the source of truth for canvas
// rendering is here, the source of truth for DOM is the CSS variables, and
// `applyPalette` flips both at once.

import type { PlayerId } from '../types/game';

export type PaletteName = 'default' | 'cb-blue-orange';

export interface PaletteSide {
  /** Painted-tile fill (muted). */
  tile: string;
  /** Owner ring and bright accents. */
  accent: string;
  /** Glow used in shadows and effect tints. */
  glow: string;
  /** Soft tint used by home-zone overlays and pill backgrounds. */
  soft: string;
}

export interface Palette {
  A: PaletteSide;
  B: PaletteSide;
  /** Neutral tile fill. */
  neutral: string;
}

const palettes: Record<PaletteName, Palette> = {
  default: {
    A: {
      tile: '#3a567f',
      accent: '#5b8def',
      glow: 'rgba(91, 141, 239, 0.55)',
      soft: 'rgba(91, 141, 239, 0.18)',
    },
    B: {
      tile: '#7f3a3a',
      accent: '#f25f5c',
      glow: 'rgba(242, 95, 92, 0.55)',
      soft: 'rgba(242, 95, 92, 0.18)',
    },
    neutral: '#1a1e29',
  },
  'cb-blue-orange': {
    A: {
      tile: '#3a567f',
      accent: '#5b8def',
      glow: 'rgba(91, 141, 239, 0.55)',
      soft: 'rgba(91, 141, 239, 0.18)',
    },
    B: {
      // Orange instead of red. Blue + orange is the canonical
      // colorblind-safe pairing — distinguishable across the three most
      // common kinds of color blindness.
      tile: '#7d5b1f',
      accent: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.55)',
      soft: 'rgba(245, 158, 11, 0.20)',
    },
    neutral: '#1a1e29',
  },
};

let current: PaletteName = 'default';

export function getPalette(): Palette {
  return palettes[current];
}

export function getPaletteName(): PaletteName {
  return current;
}

export function side(owner: PlayerId): PaletteSide {
  return palettes[current][owner];
}

/** Switches both canvas-side and DOM-side colors. Persists to localStorage. */
export function applyPalette(name: PaletteName): void {
  current = name;
  const body = document.body;
  body.classList.toggle('palette-cb-blue-orange', name === 'cb-blue-orange');
  try { localStorage.setItem('petpainters.palette', name); } catch { /* ignore */ }
}

export function loadPalette(): void {
  let saved: string | null = null;
  try { saved = localStorage.getItem('petpainters.palette'); } catch { /* ignore */ }
  if (saved === 'cb-blue-orange') applyPalette('cb-blue-orange');
  else applyPalette('default');
}
