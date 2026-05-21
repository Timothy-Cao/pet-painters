import { RenderContext, tileToPixel } from './canvas';
import type { Pet } from '../types/pet';
import { getPetDef } from '../sim/pet-defs';

export function renderPets(rc: RenderContext, pets: Pet[]): void {
  for (const pet of pets) {
    const def = getPetDef(pet.defId);
    const { px, py } = tileToPixel(rc, pet.anchor.x, pet.anchor.y + def.size.h - 1);
    const w = def.size.w * rc.tileSize;
    const h = def.size.h * rc.tileSize;

    // Owner ring
    rc.ctx.strokeStyle = pet.owner === 'A' ? '#9bf' : '#fbb';
    rc.ctx.lineWidth = 3;
    rc.ctx.strokeRect(px + 2, py + 2, w - 4, h - 4);

    // Emoji
    rc.ctx.font = `${Math.floor(h * 0.7)}px sans-serif`;
    rc.ctx.textAlign = 'center';
    rc.ctx.textBaseline = 'middle';
    rc.ctx.fillText(def.emoji, px + w / 2, py + h / 2);

    // Facing arrow
    rc.ctx.fillStyle = '#fff';
    rc.ctx.font = `${Math.floor(h * 0.25)}px sans-serif`;
    const arrowChar = { N: '▲', S: '▼', E: '▶', W: '◀' }[pet.facing];
    rc.ctx.fillText(arrowChar, px + w / 2, py + h - 8);

    // HP bar
    const hpFrac = pet.hp / def.maxHp;
    rc.ctx.fillStyle = '#222';
    rc.ctx.fillRect(px + 4, py + 4, w - 8, 4);
    rc.ctx.fillStyle = '#4f4';
    rc.ctx.fillRect(px + 4, py + 4, (w - 8) * hpFrac, 4);
  }
}
