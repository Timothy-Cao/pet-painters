import { BOARD_SIZE } from '../config/constants';

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  tileSize: number;
  width: number;
  height: number;
}

export function createRenderContext(canvas: HTMLCanvasElement): RenderContext {
  const tileSize = Math.floor(Math.min(canvas.width, canvas.height) / BOARD_SIZE);
  const ctx = canvas.getContext('2d')!;
  return { ctx, tileSize, width: canvas.width, height: canvas.height };
}

export function clearCanvas(rc: RenderContext): void {
  rc.ctx.fillStyle = '#1a1a1a';
  rc.ctx.fillRect(0, 0, rc.width, rc.height);
}

export function tileToPixel(rc: RenderContext, x: number, y: number): { px: number; py: number } {
  // y=0 is bottom (south player home); render with origin at top-left so flip y.
  return {
    px: x * rc.tileSize,
    py: (BOARD_SIZE - 1 - y) * rc.tileSize,
  };
}
