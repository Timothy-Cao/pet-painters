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
  | { kind: 'web'; x: number; y: number; owner: PlayerId; born: number }
  | { kind: 'flutter'; x: number; y: number; owner: PlayerId; born: number; dx: number; dy: number }
  | { kind: 'dust'; x: number; y: number; owner: PlayerId; born: number; dx: number; dy: number; intensity: number }
  | { kind: 'flame'; x: number; y: number; owner: PlayerId; born: number; seed: number }
  | { kind: 'boost'; x: number; y: number; owner: PlayerId; born: number };

const DURATION_MS = 360;
const SPLAT_MS = 480;
const POOF_MS = 420;
const DAMAGE_MS = 700;
const ROAR_MS = 520;
const WEB_MS = 600;
const FLUTTER_MS = 400;
const DUST_MS = 520;
const FLAME_MS = 520;
const BOOST_MS = 480;
const effects: Effect[] = [];

import { side } from './palette';
import { playHit, playDeath } from './sfx';
import { triggerHitAnim, triggerDeathAnim, triggerAttackAnim } from './pets';

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

// Kill switch for headless sim. Skips all effect allocation when disabled —
// the sim still computes correctly but doesn't churn GC on visual effects.
let effectsEnabled = true;
export function setEffectsEnabled(on: boolean): void { effectsEnabled = on; }

export function pushHit(x: number, y: number, owner: PlayerId, targetPetId?: number, attackerPetId?: number, aDx?: number, aDy?: number): void {
  if (!effectsEnabled) return;
  effects.push({ kind: 'hit', x, y, owner, born: now() });
  playHit();
  if (targetPetId != null) triggerHitAnim(targetPetId);
  if (attackerPetId != null && aDx != null && aDy != null) triggerAttackAnim(attackerPetId, aDx, aDy);
}
export function pushPounce(x: number, y: number, owner: PlayerId): void {
  if (!effectsEnabled) return;
  effects.push({ kind: 'pounce', x, y, owner, born: now() });
}
export function pushSpray(x: number, y: number, owner: PlayerId): void {
  if (!effectsEnabled) return;
  effects.push({ kind: 'spray', x, y, owner, born: now() });
}
export function pushSplat(x: number, y: number, owner: PlayerId): void {
  if (!effectsEnabled) return;
  // Random angle so adjacent splats don't visually rhyme.
  effects.push({ kind: 'splat', x, y, owner, born: now(), angle: Math.random() * Math.PI * 2 });
}
export function pushPoof(x: number, y: number, owner: PlayerId, petId?: number): void {
  if (!effectsEnabled) return;
  effects.push({ kind: 'poof', x, y, owner, born: now() });
  playDeath();
  if (petId != null) triggerDeathAnim(petId);
}
export function pushDamage(x: number, y: number, owner: PlayerId, amount: number): void {
  if (!effectsEnabled) return;
  // Tiny horizontal jitter so two simultaneous hits don't perfectly overlap.
  effects.push({ kind: 'damage', x, y, owner, born: now(), amount, jitterX: (Math.random() - 0.5) * 0.4 });
}
export function pushRoar(x: number, y: number, owner: PlayerId): void {
  if (!effectsEnabled) return;
  effects.push({ kind: 'roar', x, y, owner, born: now() });
}
export function pushWeb(x: number, y: number, owner: PlayerId): void {
  if (!effectsEnabled) return;
  effects.push({ kind: 'web', x, y, owner, born: now() });
}
export function pushFlutter(x: number, y: number, owner: PlayerId, dx: number, dy: number): void {
  if (!effectsEnabled) return;
  effects.push({ kind: 'flutter', x, y, owner, born: now(), dx, dy });
}
export function pushDust(x: number, y: number, owner: PlayerId, dx: number, dy: number, intensity: number): void {
  if (!effectsEnabled) return;
  effects.push({ kind: 'dust', x, y, owner, born: now(), dx, dy, intensity });
}
export function pushFlame(x: number, y: number, owner: PlayerId): void {
  if (!effectsEnabled) return;
  effects.push({ kind: 'flame', x, y, owner, born: now(), seed: Math.random() });
}
export function pushBoostFlash(x: number, y: number, owner: PlayerId): void {
  if (!effectsEnabled) return;
  effects.push({ kind: 'boost', x, y, owner, born: now() });
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
                   : e.kind === 'flutter' ? FLUTTER_MS
                   : e.kind === 'dust' ? DUST_MS
                   : e.kind === 'flame' ? FLAME_MS
                   : e.kind === 'boost' ? BOOST_MS
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
    } else if (e.kind === 'flame') {
      // Flickering orange-red radial gradient fills the tile. Three short
      // tongues of flame rise out of the center, jittered per-seed.
      const grow = 0.4 + 0.6 * Math.sin(t * Math.PI);   // peak around mid-life
      const baseR = size * 0.45 * grow;
      const grad = rc.ctx.createRadialGradient(0, 0, 0, 0, 0, baseR);
      grad.addColorStop(0, `rgba(255, 240, 180, ${(1 - t) * 0.8})`);
      grad.addColorStop(0.45, `rgba(255, 140, 60, ${(1 - t) * 0.55})`);
      grad.addColorStop(1, `rgba(180, 50, 30, 0)`);
      rc.ctx.fillStyle = grad;
      rc.ctx.beginPath();
      rc.ctx.arc(0, 0, baseR, 0, Math.PI * 2);
      rc.ctx.fill();
      // Tongue licks rising upward (negative y on canvas = up).
      rc.ctx.globalAlpha = 1 - t;
      rc.ctx.fillStyle = '#ffc066';
      for (let k = 0; k < 3; k++) {
        const ang = -Math.PI / 2 + (e.seed + k * 0.4) % 1 * 1.2 - 0.6;
        const lr = size * (0.25 + 0.30 * grow);
        const lx = Math.cos(ang) * lr;
        const ly = Math.sin(ang) * lr;
        rc.ctx.beginPath();
        rc.ctx.arc(lx, ly, size * 0.06 * (1 - t * 0.5), 0, Math.PI * 2);
        rc.ctx.fill();
      }
    } else if (e.kind === 'dust') {
      // Tan/brown dust puffs scattering behind a charging unit. The number
      // and size of puffs scale with momentum intensity (1..5).
      const dots = 3 + Math.floor(e.intensity);
      const trailAng = Math.atan2(-e.dy, -e.dx);
      rc.ctx.fillStyle = '#9c8262';
      for (let k = 0; k < dots; k++) {
        const spread = trailAng + (k - dots / 2) * 0.35;
        const r = size * (0.20 + 0.55 * t);
        const dotR = size * (0.04 + 0.02 * e.intensity) * (1 - t * 0.5);
        rc.ctx.globalAlpha = (1 - t) * (0.4 + 0.10 * e.intensity);
        rc.ctx.beginPath();
        rc.ctx.arc(Math.cos(spread) * r, Math.sin(spread) * r, dotR, 0, Math.PI * 2);
        rc.ctx.fill();
      }
    } else if (e.kind === 'flutter') {
      // Three small dashes that trail in the eagle's flight direction, like
      // feathers shed at takeoff. They drift outward and shrink as they fade.
      rc.ctx.globalAlpha = 1 - t;
      // Trailing direction is opposite the flight direction.
      const angBase = Math.atan2(-e.dy, -e.dx);
      const r0 = size * 0.10;
      const r1 = size * 0.45;
      rc.ctx.strokeStyle = '#dde8ff';
      rc.ctx.lineWidth = 2;
      for (let k = -1; k <= 1; k++) {
        const angSpread = angBase + k * 0.45;
        const r = r0 + (r1 - r0) * t;
        const fx = Math.cos(angSpread) * r;
        const fy = Math.sin(angSpread) * r;
        const lx = Math.cos(angSpread) * (r - size * 0.13);
        const ly = Math.sin(angSpread) * (r - size * 0.13);
        rc.ctx.beginPath();
        rc.ctx.moveTo(lx, ly);
        rc.ctx.lineTo(fx, fy);
        rc.ctx.stroke();
      }
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
    } else if (e.kind === 'boost') {
      // Gold expanding starburst — twin rings + 6 quick rays radiating out.
      const r1 = size * (0.25 + 0.55 * t);
      const r2 = size * (0.10 + 0.40 * t);
      rc.ctx.globalAlpha = (1 - t) * 0.9;
      rc.ctx.strokeStyle = '#ffd166';
      rc.ctx.lineWidth = 3;
      rc.ctx.beginPath();
      rc.ctx.arc(0, 0, r1, 0, Math.PI * 2);
      rc.ctx.stroke();
      rc.ctx.globalAlpha = (1 - t) * 0.6;
      rc.ctx.lineWidth = 2;
      rc.ctx.beginPath();
      rc.ctx.arc(0, 0, r2, 0, Math.PI * 2);
      rc.ctx.stroke();
      // Six rays
      rc.ctx.globalAlpha = (1 - t) * 0.8;
      rc.ctx.lineWidth = 2;
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI * 2 * k) / 6 + Math.PI / 12;
        const inner = size * 0.12;
        const outer = size * (0.30 + 0.45 * t);
        rc.ctx.beginPath();
        rc.ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
        rc.ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
        rc.ctx.stroke();
      }
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
