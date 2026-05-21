import { RenderContext, tileToPixel } from './canvas';
import type { Pet } from '../types/pet';
import type { Direction } from '../types/game';
import { getPetDef } from '../sim/pet-defs';

const RING = {
  A: { color: '#5b8def', glow: 'rgba(91, 141, 239, 0.55)' },
  B: { color: '#f25f5c', glow: 'rgba(242, 95, 92, 0.55)' },
};

const FACING_RAD: Record<Direction, number> = {
  N: 0,
  E: Math.PI / 2,
  S: Math.PI,
  W: -Math.PI / 2,
};

export function renderPets(rc: RenderContext, pets: Pet[]): void {
  const { ctx } = rc;
  for (const pet of pets) {
    const def = getPetDef(pet.defId);
    const { px, py } = tileToPixel(rc, pet.anchor.x, pet.anchor.y + def.size.h - 1);
    const w = def.size.w * rc.tileSize;
    const h = def.size.h * rc.tileSize;
    const ring = RING[pet.owner];

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
    ctx.rotate(FACING_RAD[pet.facing]);
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
  }
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
