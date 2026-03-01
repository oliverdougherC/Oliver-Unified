import { Graphics } from 'pixi.js';
import type { EnemyRole } from '../types';
import { luminanceDelta } from './visualTheme';

export interface EnemySpriteFactoryParams {
  role: EnemyRole;
  radius: number;
  fill: number;
  stroke: number;
  isElite: boolean;
  crownColor: number;
  outlineStrength: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mixColor(base: number, overlay: number, t: number): number {
  const ratio = clamp(t, 0, 1);
  const br = (base >> 16) & 0xff;
  const bg = (base >> 8) & 0xff;
  const bb = base & 0xff;
  const or = (overlay >> 16) & 0xff;
  const og = (overlay >> 8) & 0xff;
  const ob = overlay & 0xff;
  const r = Math.round(br + (or - br) * ratio);
  const g = Math.round(bg + (og - bg) * ratio);
  const b = Math.round(bb + (ob - bb) * ratio);
  return (r << 16) | (g << 8) | b;
}

function enforceBackdropContrast(color: number): number {
  const forestMid = 0x16222a;
  if (luminanceDelta(color, forestMid) >= 0.18) return color;
  return mixColor(color, 0xf3fbff, 0.3);
}

function addEliteMarks(graphic: Graphics, radius: number, crownColor: number, stroke: number): void {
  graphic.circle(0, -radius - 4, radius * 0.44);
  graphic.stroke({ width: 1.5, color: crownColor, alpha: 0.96 });
  graphic.circle(0, 0, radius * 1.18);
  graphic.stroke({ width: 1.3, color: stroke, alpha: 0.84 });
}

export function createEnemySprite(params: EnemySpriteFactoryParams): Graphics {
  const graphic = new Graphics();
  const r = Math.max(7, params.radius);
  const fill = enforceBackdropContrast(params.fill);
  const stroke = enforceBackdropContrast(params.stroke);
  const darkKeyline = mixColor(fill, 0x020406, 0.78);
  const outlineWidth = clamp(2.1 * params.outlineStrength, 1.2, 4);
  const accent = mixColor(fill, 0xffffff, 0.4);

  graphic.circle(0, 0, r * 1.2);
  graphic.fill({ color: darkKeyline, alpha: 0.64 });

  if (params.role === 'charger') {
    graphic.poly([
      { x: 0, y: -r * 1.06 },
      { x: r * 0.92, y: -r * 0.12 },
      { x: r * 0.52, y: r * 0.96 },
      { x: -r * 0.52, y: r * 0.96 },
      { x: -r * 0.92, y: -r * 0.12 }
    ]);
    graphic.fill({ color: fill, alpha: 0.98 });
    graphic.stroke({ width: outlineWidth, color: stroke, alpha: 0.97 });
    graphic.poly([
      { x: -r * 0.25, y: -r * 1.22 },
      { x: -r * 0.03, y: -r * 0.66 },
      { x: -r * 0.4, y: -r * 0.65 }
    ]);
    graphic.poly([
      { x: r * 0.25, y: -r * 1.22 },
      { x: r * 0.03, y: -r * 0.66 },
      { x: r * 0.4, y: -r * 0.65 }
    ]);
    graphic.fill({ color: accent, alpha: 0.74 });
  } else if (params.role === 'tank') {
    graphic.roundRect(-r, -r * 0.9, r * 2, r * 1.8, r * 0.2);
    graphic.fill({ color: fill, alpha: 0.97 });
    graphic.stroke({ width: outlineWidth, color: stroke, alpha: 0.97 });
    graphic.rect(-r * 0.34, -r * 0.42, r * 0.68, r * 0.84);
    graphic.fill({ color: accent, alpha: 0.46 });
  } else if (params.role === 'sniper') {
    graphic.poly([
      { x: 0, y: -r * 1.02 },
      { x: r * 0.84, y: 0 },
      { x: 0, y: r * 1.02 },
      { x: -r * 0.84, y: 0 }
    ]);
    graphic.fill({ color: fill, alpha: 0.97 });
    graphic.stroke({ width: outlineWidth, color: stroke, alpha: 0.97 });
    graphic.circle(0, 0, r * 0.3);
    graphic.fill({ color: accent, alpha: 0.72 });
  } else if (params.role === 'summoner') {
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 12; i += 1) {
      const angle = -Math.PI / 2 + (Math.PI * 2 * i) / 12;
      const mag = i % 2 === 0 ? r : r * 0.54;
      points.push({ x: Math.cos(angle) * mag, y: Math.sin(angle) * mag });
    }
    graphic.poly(points);
    graphic.fill({ color: fill, alpha: 0.97 });
    graphic.stroke({ width: outlineWidth, color: stroke, alpha: 0.97 });
    graphic.circle(0, 0, r * 0.26);
    graphic.fill({ color: accent, alpha: 0.78 });
  } else if (params.role === 'disruptor') {
    graphic.circle(0, 0, r * 0.94);
    graphic.stroke({ width: outlineWidth, color: stroke, alpha: 0.96 });
    graphic.circle(0, 0, r * 0.6);
    graphic.fill({ color: fill, alpha: 0.92 });
    graphic.stroke({ width: outlineWidth * 0.65, color: accent, alpha: 0.75 });
  } else if (params.role === 'bruiser') {
    graphic.poly([
      { x: -r * 0.98, y: -r * 0.45 },
      { x: -r * 0.35, y: -r * 0.96 },
      { x: r * 0.38, y: -r * 0.96 },
      { x: r * 0.98, y: -r * 0.28 },
      { x: r * 0.78, y: r * 0.8 },
      { x: -r * 0.72, y: r * 0.92 }
    ]);
    graphic.fill({ color: fill, alpha: 0.97 });
    graphic.stroke({ width: outlineWidth, color: stroke, alpha: 0.97 });
    graphic.rect(-r * 0.16, -r * 0.35, r * 0.32, r * 0.7);
    graphic.fill({ color: accent, alpha: 0.58 });
  } else {
    // Swarmer beetle silhouette with legs so it no longer reads like a plain orb.
    graphic.ellipse(0, 0, r * 0.74, r * 0.92);
    graphic.fill({ color: fill, alpha: 0.97 });
    graphic.stroke({ width: outlineWidth, color: stroke, alpha: 0.98 });
    graphic.ellipse(0, -r * 0.58, r * 0.42, r * 0.35);
    graphic.fill({ color: accent, alpha: 0.84 });
    for (let i = 0; i < 3; i += 1) {
      const y = -r * 0.28 + i * r * 0.32;
      graphic.moveTo(-r * 0.44, y);
      graphic.lineTo(-r * 1.05, y - r * 0.18);
      graphic.moveTo(r * 0.44, y);
      graphic.lineTo(r * 1.05, y - r * 0.18);
      graphic.stroke({ width: Math.max(1, outlineWidth * 0.4), color: darkKeyline, alpha: 0.9 });
    }
  }

  if (params.isElite) {
    addEliteMarks(graphic, r, params.crownColor, stroke);
  }

  return graphic;
}
