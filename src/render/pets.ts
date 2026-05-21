import { RenderContext } from './canvas';
import type { Pet } from '../types/pet';
import { getPetDef } from '../sim/pet-defs';
import { BOARD_SIZE } from '../config/constants';
import { getRenderPosition, getSpawnAgeMs, pruneRenderHistory, SPAWN_MS } from './interpolation';
import { side } from './palette';
import type { PetRole } from '../types/pet';

export const ROLE_TINT: Record<PetRole, string> = {
  painter:    'rgba(79, 209, 165, 0.65)',   // teal
  predator:   'rgba(255, 209, 102, 0.65)',  // warm yellow
  tank:       'rgba(138, 147, 166, 0.55)',  // cool gray
  disruptor:  'rgba(192, 132, 252, 0.60)',  // soft purple
  specialist: 'rgba(164, 255, 124, 0.60)',  // lime
};

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function renderPets(rc: RenderContext, pets: Pet[]): void {
  const { ctx, tileSize } = rc;
  for (const pet of pets) {
    const def = getPetDef(pet.defId);
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

    ctx.save();
    ctx.translate(px + w / 2, py + h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-(px + w / 2), -(py + h / 2));
    ctx.globalAlpha = alpha;

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

    // Soft glow background
    ctx.save();
    ctx.shadowColor = ring.glow;
    ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(px + 4, py + 4, w - 8, h - 8);
    ctx.restore();

    // Owner ring (rounded, axis-aligned — does not rotate)
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = 2;
    roundRect(ctx, px + 3, py + 3, w - 6, h - 6, 6);
    ctx.stroke();

    // Emoji rotates with facing direction
    ctx.save();
    ctx.translate(px + w / 2, py + h / 2);
    ctx.rotate(rad);
    ctx.font = `${Math.floor(h * 0.65)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(def.emoji, 0, 2);
    ctx.restore();

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
