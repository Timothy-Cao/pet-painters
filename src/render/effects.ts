import type { PlayerId } from '../types/game';
import type { RenderContext } from './canvas';
import { tileToPixel } from './canvas';

type Effect =
  | { kind: 'hit'; x: number; y: number; owner: PlayerId; born: number }
  | { kind: 'pounce'; x: number; y: number; owner: PlayerId; born: number }
  | { kind: 'spray'; x: number; y: number; owner: PlayerId; born: number }
  | { kind: 'splat'; x: number; y: number; owner: PlayerId; born: number; angle: number }
  | { kind: 'poof'; x: number; y: number; owner: PlayerId; born: number }
  | { kind: 'damage'; x: number; y: number; owner: PlayerId; born: number; amount: number; jitterX: number }
  | { kind: 'roar'; x: number; y: number; owner: PlayerId; born: number }
  | { kind: 'web'; x: number; y: number; owner: PlayerId; born: number };

const DURATION_MS = 360;
const SPLAT_MS = 480;
const POOF_MS = 420;
const DAMAGE_MS = 700;
const ROAR_MS = 520;
const WEB_MS = 600;
const effects: Effect[] = [];

import { side } from './palette';

function colorFor(owner: PlayerId): string {
  return side(owner).accent;
}
// Backwards-compat shim so existing destructuring sites can stay terse.
const COLORS = new Proxy({} as Record<PlayerId, string>, {
  get: (_t, k: PlayerId) => colorFor(k),
});

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function pushHit(x: number, y: number, owner: PlayerId): void {
  effects.push({ kind: 'hit', x, y, owner, born: now() });
}
export function pushPounce(x: number, y: number, owner: PlayerId): void {
  effects.push({ kind: 'pounce', x, y, owner, born: now() });
}
export function pushSpray(x: number, y: number, owner: PlayerId): void {
  effects.push({ kind: 'spray', x, y, owner, born: now() });
}
export function pushSplat(x: number, y: number, owner: PlayerId): void {
  // Random angle so adjacent splats don't visually rhyme.
  effects.push({ kind: 'splat', x, y, owner, born: now(), angle: Math.random() * Math.PI * 2 });
}
export function pushPoof(x: number, y: number, owner: PlayerId): void {
  effects.push({ kind: 'poof', x, y, owner, born: now() });
}
export function pushDamage(x: number, y: number, owner: PlayerId, amount: number): void {
  // Tiny horizontal jitter so two simultaneous hits don't perfectly overlap.
  effects.push({ kind: 'damage', x, y, owner, born: now(), amount, jitterX: (Math.random() - 0.5) * 0.4 });
}
export function pushRoar(x: number, y: number, owner: PlayerId): void {
  effects.push({ kind: 'roar', x, y, owner, born: now() });
}
export function pushWeb(x: number, y: number, owner: PlayerId): void {
  effects.push({ kind: 'web', x, y, owner, born: now() });
}

export function clearEffects(): void {
  effects.length = 0;
}

export function renderEffects(rc: RenderContext): void {
  const t0 = now();
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    const age = t0 - e.born;
    const lifetime = e.kind === 'splat' ? SPLAT_MS
                   : e.kind === 'poof' ? POOF_MS
                   : e.kind === 'damage' ? DAMAGE_MS
                   : e.kind === 'roar' ? ROAR_MS
                   : e.kind === 'web' ? WEB_MS
                   : DURATION_MS;
    if (age >= lifetime) { effects.splice(i, 1); continue; }
    const t = age / lifetime;       // 0..1
    const size = rc.tileSize;
    const { px, py } = tileToPixel(rc, e.x, e.y);

    // Damage numbers render without the centering-translate dance — they
    // need to draw above the tile, not on it, and they don't rotate.
    if (e.kind === 'damage') {
      const eased = 1 - (1 - t) * (1 - t);
      const cx = px + size / 2 + e.jitterX * size;
      const startY = py + size / 2;
      const ny = startY - size * 0.6 * eased;
      rc.ctx.save();
      rc.ctx.globalAlpha = t < 0.85 ? 1 : (1 - t) / 0.15;
      rc.ctx.font = `700 ${Math.floor(size * 0.42)}px ui-monospace, monospace`;
      rc.ctx.textAlign = 'center';
      rc.ctx.textBaseline = 'middle';
      // Black halo for readability over any tile color.
      rc.ctx.fillStyle = 'rgba(0,0,0,0.85)';
      rc.ctx.fillText(`-${e.amount}`, cx + 1, ny + 1);
      rc.ctx.fillStyle = COLORS[e.owner];
      rc.ctx.fillText(`-${e.amount}`, cx, ny);
      rc.ctx.restore();
      continue;
    }

    rc.ctx.save();
    rc.ctx.translate(px + size / 2, py + size / 2);

    if (e.kind === 'hit') {
      // Expanding white-edged ring in the attacker's color.
      const radius = size * (0.25 + 0.45 * t);
      rc.ctx.globalAlpha = 1 - t;
      rc.ctx.strokeStyle = COLORS[e.owner];
      rc.ctx.lineWidth = 3;
      rc.ctx.beginPath();
      rc.ctx.arc(0, 0, radius, 0, Math.PI * 2);
      rc.ctx.stroke();
      rc.ctx.globalAlpha = (1 - t) * 0.6;
      rc.ctx.strokeStyle = '#ffffff';
      rc.ctx.lineWidth = 1.5;
      rc.ctx.beginPath();
      rc.ctx.arc(0, 0, radius * 0.7, 0, Math.PI * 2);
      rc.ctx.stroke();
    } else if (e.kind === 'pounce') {
      // 4 claw slashes radiating outward.
      rc.ctx.globalAlpha = 1 - t;
      rc.ctx.strokeStyle = '#ffd166';
      rc.ctx.lineWidth = 2.5;
      const r1 = size * 0.15 * (1 - t);
      const r2 = size * 0.55 * (0.4 + 0.6 * t);
      for (let a = 0; a < 4; a++) {
        const ang = (Math.PI * 2 * a) / 4 + Math.PI / 4;
        rc.ctx.beginPath();
        rc.ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
        rc.ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
        rc.ctx.stroke();
      }
      // Bright burst center
      rc.ctx.globalAlpha = (1 - t) * 0.8;
      rc.ctx.fillStyle = '#fff7d6';
      rc.ctx.beginPath();
      rc.ctx.arc(0, 0, size * 0.08 * (1 - t), 0, Math.PI * 2);
      rc.ctx.fill();
    } else if (e.kind === 'spray') {
      // Radiating green ring.
      rc.ctx.globalAlpha = (1 - t) * 0.7;
      rc.ctx.strokeStyle = '#a4ff7c';
      rc.ctx.lineWidth = 2;
      const r = size * 0.4 + size * 0.3 * t;
      rc.ctx.beginPath();
      rc.ctx.arc(0, 0, r, 0, Math.PI * 2);
      rc.ctx.stroke();
    } else if (e.kind === 'web') {
      // 8 fine purple threads radiate from the tile center, then a small
      // pulse settles in the middle — reads as "you are caught."
      rc.ctx.globalAlpha = 1 - t;
      rc.ctx.strokeStyle = '#c084fc';
      rc.ctx.lineWidth = 1.3;
      const threads = 8;
      const r = size * (0.18 + 0.40 * t);
      for (let k = 0; k < threads; k++) {
        const ang = (Math.PI * 2 * k) / threads;
        rc.ctx.beginPath();
        rc.ctx.moveTo(0, 0);
        rc.ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
        rc.ctx.stroke();
      }
      // Connecting ring
      rc.ctx.globalAlpha = (1 - t) * 0.55;
      rc.ctx.beginPath();
      rc.ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      rc.ctx.stroke();
    } else if (e.kind === 'roar') {
      // Two concentric warm-yellow rings expanding outward — reads as a
      // "spotted you" cue when the lion locks onto a target.
      rc.ctx.globalAlpha = 1 - t;
      rc.ctx.strokeStyle = '#ffd166';
      rc.ctx.lineWidth = 2.5;
      const r1 = size * (0.20 + 0.70 * t);
      rc.ctx.beginPath();
      rc.ctx.arc(0, 0, r1, 0, Math.PI * 2);
      rc.ctx.stroke();
      rc.ctx.globalAlpha = (1 - t) * 0.55;
      rc.ctx.lineWidth = 1.5;
      const r2 = size * (0.05 + 0.55 * t);
      rc.ctx.beginPath();
      rc.ctx.arc(0, 0, r2, 0, Math.PI * 2);
      rc.ctx.stroke();
    } else if (e.kind === 'poof') {
      // Grey-tinted dust burst: 8 small dots drift outward and fade.
      const dots = 8;
      const ringR = size * (0.18 + 0.34 * t);
      rc.ctx.globalAlpha = (1 - t) * 0.65;
      rc.ctx.fillStyle = '#cdd3df';
      for (let k = 0; k < dots; k++) {
        const a = (Math.PI * 2 * k) / dots + (e.born % 1);
        const dotR = size * 0.05 * (1 - t * 0.6);
        rc.ctx.beginPath();
        rc.ctx.arc(Math.cos(a) * ringR, Math.sin(a) * ringR, dotR, 0, Math.PI * 2);
        rc.ctx.fill();
      }
      // Faint colored core in owner tint, hinting which side just lost a pet.
      rc.ctx.globalAlpha = (1 - t) * 0.35;
      rc.ctx.fillStyle = COLORS[e.owner];
      rc.ctx.beginPath();
      rc.ctx.arc(0, 0, size * 0.18 * (1 - t), 0, Math.PI * 2);
      rc.ctx.fill();
    } else if (e.kind === 'splat') {
      // Brief brush bloom: a soft filled circle that puffs out and fades,
      // plus 5 small droplets radiating outward.
      const color = COLORS[e.owner];
      rc.ctx.rotate(e.angle);
      // Bloom
      const bloomR = size * (0.18 + 0.32 * t);
      rc.ctx.globalAlpha = (1 - t) * 0.55;
      rc.ctx.fillStyle = color;
      rc.ctx.beginPath();
      rc.ctx.arc(0, 0, bloomR, 0, Math.PI * 2);
      rc.ctx.fill();
      // Droplets
      rc.ctx.globalAlpha = (1 - t) * 0.7;
      const droplets = 5;
      for (let k = 0; k < droplets; k++) {
        const a = (Math.PI * 2 * k) / droplets;
        const r = size * (0.18 + 0.28 * t);
        const dropR = size * 0.045 * (1 - t * 0.6);
        rc.ctx.beginPath();
        rc.ctx.arc(Math.cos(a) * r, Math.sin(a) * r, dropR, 0, Math.PI * 2);
        rc.ctx.fill();
      }
    }
    rc.ctx.restore();
  }
}
