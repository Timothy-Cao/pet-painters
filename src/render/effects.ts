import type { PlayerId } from '../types/game';
import type { RenderContext } from './canvas';
import { tileToPixel } from './canvas';

type Effect =
  | { kind: 'hit'; x: number; y: number; owner: PlayerId; born: number }
  | { kind: 'pounce'; x: number; y: number; owner: PlayerId; born: number }
  | { kind: 'spray'; x: number; y: number; owner: PlayerId; born: number }
  | { kind: 'splat'; x: number; y: number; owner: PlayerId; born: number; angle: number };

const DURATION_MS = 360;
const SPLAT_MS = 480;
const effects: Effect[] = [];

const COLORS = { A: '#5b8def', B: '#f25f5c' } as const;

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

export function clearEffects(): void {
  effects.length = 0;
}

export function renderEffects(rc: RenderContext): void {
  const t0 = now();
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    const age = t0 - e.born;
    const lifetime = e.kind === 'splat' ? SPLAT_MS : DURATION_MS;
    if (age >= lifetime) { effects.splice(i, 1); continue; }
    const t = age / lifetime;       // 0..1
    const size = rc.tileSize;
    const { px, py } = tileToPixel(rc, e.x, e.y);
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
