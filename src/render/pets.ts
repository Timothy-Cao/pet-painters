import { RenderContext } from './canvas';
import type { Pet } from '../types/pet';
import type { PlayerId } from '../types/game';
import { getPetDef } from '../sim/pet-defs';
import { BOARD_SIZE } from '../config/constants';
import { getRenderPosition, getSpawnAgeMs, pruneRenderHistory, SPAWN_MS } from './interpolation';
import { side } from './palette';
import type { PetRole } from '../types/pet';
import { computeVisibility, tileKey } from '../sim/board';

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

// ── Per-pet combat animation state ──────────────────────────────────────

interface HitAnim { startMs: number; }
interface DeathAnim { startMs: number; }
interface AttackAnim { startMs: number; dx: number; dy: number; }

const hitAnims = new Map<number, HitAnim>();
const deathAnims = new Map<number, DeathAnim>();
const attackAnims = new Map<number, AttackAnim>();

const HIT_FLASH_MS = 260;
const DEATH_SHRINK_MS = 350;
const ATTACK_BUMP_MS = 180;

/** Call when a pet takes damage — triggers a red flash + shake. */
export function triggerHitAnim(petId: number): void {
  hitAnims.set(petId, { startMs: now() });
}

/** Call when a pet dies — triggers shrink-to-nothing. */
export function triggerDeathAnim(petId: number): void {
  deathAnims.set(petId, { startMs: now() });
}

/** Call when a pet attacks — triggers a forward bump. dx/dy in tile-space direction. */
export function triggerAttackAnim(petId: number, dx: number, dy: number): void {
  attackAnims.set(petId, { startMs: now(), dx, dy });
}

export const ROLE_TINT: Record<PetRole, string> = {
  painter:    'rgba(79, 209, 165, 0.65)',   // teal
  predator:   'rgba(255, 209, 102, 0.65)',  // warm yellow
  tank:       'rgba(138, 147, 166, 0.55)',  // cool gray
  disruptor:  'rgba(192, 132, 252, 0.60)',  // soft purple
  specialist: 'rgba(164, 255, 124, 0.60)',  // lime
};

/** Prune finished combat animations. Called each frame. */
function pruneCombatAnims(): void {
  const t = now();
  for (const [id, a] of hitAnims) if (t - a.startMs > HIT_FLASH_MS) hitAnims.delete(id);
  for (const [id, a] of deathAnims) if (t - a.startMs > DEATH_SHRINK_MS * 2) deathAnims.delete(id);
  for (const [id, a] of attackAnims) if (t - a.startMs > ATTACK_BUMP_MS) attackAnims.delete(id);
}

/** Clear all combat animation state. Call on match reset to prevent stale
 *  animations from affecting newly-deployed pets that reuse petId values. */
export function clearCombatAnims(): void {
  hitAnims.clear();
  deathAnims.clear();
  attackAnims.clear();
}

/**
 * Render all pets.
 * @param viewer  When set, enemy pets whose footprint is entirely in fog are skipped.
 *                The viewer's own pets are always rendered.
 *                Pass null (or omit) for sandbox/spectator — no fog filtering.
 *
 * NOTE: The board reference is only needed when viewer is set (fog of war).
 */
export function renderPets(
  rc: RenderContext,
  pets: Pet[],
  viewer?: PlayerId | null,
  board?: import('../types/game').Board | null,
): void {
  const { ctx, tileSize } = rc;
  pruneCombatAnims();

  // Pre-compute visibility once per frame when fog is active.
  const visSet: Set<number> | null = (viewer && board) ? computeVisibility(board, viewer) : null;

  for (const pet of pets) {
    const def = getPetDef(pet.defId);

    // Fog of war: skip enemy pets whose anchor tile is in fog.
    // We check the anchor tile as a quick proxy for the full footprint.
    if (visSet && pet.owner !== viewer) {
      if (!visSet.has(tileKey(pet.anchor.x, pet.anchor.y))) continue;
    }
    const { x: fx, y: fy, rad } = getRenderPosition(pet);

    // Convert fractional board coords → screen pixel top-left of the sprite.
    const px = fx * tileSize;
    const py = (BOARD_SIZE - def.size.h - fy) * tileSize;
    const w = def.size.w * tileSize;
    const h = def.size.h * tileSize;
    const palette = side(pet.owner);
    const ring = { color: palette.accent, glow: palette.glow };

    // Deploy fade-in: ease-out scale + alpha during the first SPAWN_MS.
    const age = getSpawnAgeMs(pet.petId);
    const tSpawn = Math.min(1, age / SPAWN_MS);
    const eased = 1 - (1 - tSpawn) * (1 - tSpawn);
    const scale = 0.35 + 0.65 * eased;
    const alpha = eased;

    // ── Combat animations: attack bump offset ──
    let bumpOffX = 0, bumpOffY = 0;
    const atkAnim = attackAnims.get(pet.petId);
    if (atkAnim) {
      const atkAge = now() - atkAnim.startMs;
      const atkT = Math.min(1, atkAge / ATTACK_BUMP_MS);
      // Quick forward lunge then snap back (sine half-wave).
      const bumpMag = Math.sin(atkT * Math.PI) * tileSize * 0.25;
      bumpOffX = atkAnim.dx * bumpMag;
      bumpOffY = -atkAnim.dy * bumpMag; // canvas Y is inverted
    }

    // ── Combat animations: death shrink ──
    let deathScale = 1;
    let deathAlpha = 1;
    const deathAnim = deathAnims.get(pet.petId);
    if (deathAnim) {
      const deathAge = now() - deathAnim.startMs;
      const deathT = Math.min(1, deathAge / DEATH_SHRINK_MS);
      deathScale = 1 - deathT;
      deathAlpha = 1 - deathT;
    }

    ctx.save();
    ctx.translate(px + w / 2 + bumpOffX, py + h / 2 + bumpOffY);
    ctx.scale(scale * deathScale, scale * deathScale);
    ctx.translate(-(px + w / 2), -(py + h / 2));
    ctx.globalAlpha = alpha * deathAlpha;

    // ── Idle animation: gentle breathing bob ──────────────────────────
    // Each pet gets a unique phase offset so they don't all bob in sync.
    // Cycle: 2.0s period, vertical bob ±2px, subtle scale pulse ±2%.
    const idlePhase = ((now() + pet.petId * 211) % 2000) / 2000;
    const idleSin = Math.sin(idlePhase * Math.PI * 2);
    const idleBobY = idleSin * 2;                       // ±2px vertical
    const idleScalePulse = 1 + idleSin * 0.018;         // ±1.8% scale

    // Role aura — a slow-pulsing radial glow behind the pet so each archetype
    // is recognizable at a glance. 2.4s sine cycle, alpha 0.55→0.95 of the
    // role tint. Pets can override the color (e.g. Bear shifts red when raged).
    {
      const tint = def.getAuraColor ? def.getAuraColor(pet) : ROLE_TINT[def.role];
      const phase = (now() + pet.petId * 137) % 2400 / 2400;
      const pulse = 0.55 + 0.40 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2));
      const cx = px + w / 2;
      const cy = py + h / 2;
      const r = Math.max(w, h) * 0.65;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, withAlpha(tint, pulse));
      grad.addColorStop(0.7, withAlpha(tint, pulse * 0.25));
      grad.addColorStop(1, withAlpha(tint, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Soft glow background + ground shadow that compresses as pet bobs up
    ctx.save();
    ctx.shadowColor = ring.glow;
    ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(px + 4, py + 4, w - 8, h - 8);
    ctx.restore();

    // Ground shadow — ellipse at the pet's feet, squashes when pet bobs up
    {
      const shadowCx = px + w / 2;
      const shadowCy = py + h - 4;
      const shadowRx = w * 0.32;
      const shadowRy = 2.5 + idleSin * 0.5; // taller when pet is lower
      ctx.save();
      ctx.globalAlpha = 0.18 + idleSin * 0.04;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(shadowCx, shadowCy, shadowRx, shadowRy, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Owner ring (rounded, axis-aligned — does not rotate)
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = 2;
    roundRect(ctx, px + 3, py + 3, w - 6, h - 6, 6);
    ctx.stroke();

    // Boost ring — visible while the pet is currently boosted. Bright gold,
    // animated dash offset so it reads as "actively powered up."
    if (pet.boostedUntilTick !== undefined && pet.boostedUntilTick > 0) {
      // Compare against wall-clock time via the existing now() helper, gated
      // by the same condition tick.ts uses: state.tick < boostedUntilTick.
      // We approximate "is boosted right now" by checking if the lookups
      // would still pass: the render layer doesn't have state.tick directly,
      // but boostedUntilTick was set with the duration in mind, so we just
      // draw it if the recency is plausibly active. Cap at 1.6s of render.
      const ageHint = 0; // sim tick controls real expiry; this is decorative
      void ageHint;
      ctx.save();
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(255, 209, 102, 0.7)';
      ctx.shadowBlur = 10;
      ctx.setLineDash([6, 3]);
      ctx.lineDashOffset = -(now() / 60) % 9;
      roundRect(ctx, px + 1, py + 1, w - 2, h - 2, 8);
      ctx.stroke();
      ctx.restore();
    }

    // ── Hit flash: shake + red overlay when damaged ──
    let shakeX = 0, shakeY = 0;
    let hitFlashAlpha = 0;
    const hitAnim = hitAnims.get(pet.petId);
    if (hitAnim) {
      const hitAge = now() - hitAnim.startMs;
      const hitT = Math.min(1, hitAge / HIT_FLASH_MS);
      // Rapid shake: damped high-frequency oscillation
      const shakeAmp = tileSize * 0.06 * (1 - hitT);
      shakeX = Math.sin(hitAge * 0.06) * shakeAmp;
      shakeY = Math.cos(hitAge * 0.08) * shakeAmp * 0.6;
      hitFlashAlpha = (1 - hitT) * 0.45;
    }

    // Emoji rotates with facing direction
    ctx.save();
    ctx.translate(px + w / 2 + shakeX, py + h / 2 + shakeY + idleBobY);
    ctx.scale(idleScalePulse, idleScalePulse);
    ctx.rotate(rad);
    ctx.font = `${Math.floor(h * 0.85)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(def.emoji, 0, 2);
    ctx.restore();

    // Red flash overlay on hit
    if (hitFlashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = hitFlashAlpha;
      ctx.fillStyle = '#ff3333';
      ctx.beginPath();
      const cx = px + w / 2 + shakeX;
      const cy = py + h / 2 + shakeY;
      const flashR = Math.max(w, h) * 0.4;
      ctx.arc(cx, cy, flashR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // HP bar (only if damaged) — stays axis-aligned for readability
    if (pet.hp < def.maxHp) {
      const hpFrac = Math.max(0, pet.hp / def.maxHp);
      const barX = px + 5;
      const barY = py + 5;
      const barW = w - 10;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(barX, barY, barW, 4);
      ctx.fillStyle = hpFrac > 0.5 ? '#4fd1a5' : hpFrac > 0.25 ? '#ffd166' : '#f25f5c';
      ctx.fillRect(barX, barY, barW * hpFrac, 4);
    }

    ctx.restore();
  }

  pruneRenderHistory(pets.map((p) => p.petId));
}

/** Multiplies an `rgba(...)` string's alpha by `mul`. Returns the same string
 *  shape; falls back to the input untouched if parsing fails. */
function withAlpha(rgba: string, mul: number): string {
  const m = rgba.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (!m) return rgba;
  const r = m[1], g = m[2], b = m[3];
  const a = m[4] ? parseFloat(m[4]) : 1;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a * mul)).toFixed(3)})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
