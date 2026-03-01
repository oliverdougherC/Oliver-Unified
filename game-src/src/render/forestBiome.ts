import type { Graphics } from 'pixi.js';
import type { RenderBudgetTier, VisualThemeTokens } from '../types';

interface ChunkProp {
  kind: 'trunk' | 'fungus' | 'vine' | 'rune' | 'root' | 'moteCluster';
  x: number;
  y: number;
  scale: number;
  rotation: number;
  layer: 0 | 1 | 2 | 3;
  glow: number;
}

interface BiomeChunk {
  key: string;
  cx: number;
  cy: number;
  props: ChunkProp[];
}

interface DrawParams {
  width: number;
  height: number;
  cameraX: number;
  cameraY: number;
  timeMs: number;
  theme: VisualThemeTokens;
  budgetTier: RenderBudgetTier;
  reducedMotion: boolean;
  motionScale: number;
  eventTint: number;
}

const CHUNK_SIZE = 520;
const LAYER_PARALLAX: [number, number, number, number] = [0.18, 0.38, 0.62, 0.85];

function fract(v: number): number {
  return v - Math.floor(v);
}

function hash(seedX: number, seedY: number, salt: number): number {
  return fract(Math.sin(seedX * 127.1 + seedY * 311.7 + salt * 91.7) * 43758.5453);
}

function randRange(seedX: number, seedY: number, salt: number, min: number, max: number): number {
  return min + (max - min) * hash(seedX, seedY, salt);
}

function createChunk(cx: number, cy: number): BiomeChunk {
  const key = `${cx}:${cy}`;
  const props: ChunkProp[] = [];
  const richness = 6 + Math.floor(randRange(cx, cy, 0.1, 0, 5));

  for (let i = 0; i < richness; i += 1) {
    const roll = hash(cx + i * 1.1, cy - i * 1.7, 0.27);
    const kind: ChunkProp['kind'] =
      roll < 0.2 ? 'trunk' :
      roll < 0.38 ? 'root' :
      roll < 0.56 ? 'vine' :
      roll < 0.72 ? 'fungus' :
      roll < 0.86 ? 'rune' :
      'moteCluster';
    const layer: ChunkProp['layer'] =
      kind === 'trunk' ? 1 :
      kind === 'root' ? 2 :
      kind === 'vine' ? 3 :
      kind === 'fungus' ? 2 :
      kind === 'rune' ? 1 :
      3;
    props.push({
      kind,
      x: randRange(cx, cy, 2.2 + i, -CHUNK_SIZE * 0.5, CHUNK_SIZE * 0.5),
      y: randRange(cx, cy, 3.9 + i, -CHUNK_SIZE * 0.5, CHUNK_SIZE * 0.5),
      scale: randRange(cx, cy, 6.1 + i, 0.64, 1.44),
      rotation: randRange(cx, cy, 8.8 + i, -Math.PI, Math.PI),
      layer,
      glow: randRange(cx, cy, 10.3 + i, 0.15, 1)
    });
  }

  return { key, cx, cy, props };
}

export class ForestBiomeRenderer {
  private chunks = new Map<string, BiomeChunk>();

  private ensureChunks(cameraX: number, cameraY: number): void {
    const cx = Math.floor(cameraX / CHUNK_SIZE);
    const cy = Math.floor(cameraY / CHUNK_SIZE);
    for (let y = cy - 2; y <= cy + 2; y += 1) {
      for (let x = cx - 3; x <= cx + 3; x += 1) {
        const key = `${x}:${y}`;
        if (this.chunks.has(key)) continue;
        this.chunks.set(key, createChunk(x, y));
      }
    }
  }

  draw(g: Graphics, params: DrawParams): void {
    const { width, height, cameraX, cameraY, theme, budgetTier, reducedMotion, motionScale, eventTint, timeMs } = params;
    this.ensureChunks(cameraX, cameraY);
    g.clear();

    g.rect(0, 0, width, height);
    g.fill({ color: theme.backdrop.floor, alpha: 1 });

    const gradientBands = budgetTier === 'ultra' ? 4 : budgetTier === 'high' ? 3 : 2;
    for (let i = 0; i < gradientBands; i += 1) {
      const ratio = i / Math.max(1, gradientBands - 1);
      const y = ratio * height;
      g.rect(0, y, width, height / gradientBands + 1);
      g.fill({
        color: ratio < 0.45 ? theme.backdrop.canopy : theme.backdrop.vines,
        alpha: ratio < 0.45 ? 0.05 + ratio * 0.05 : 0.03 + ratio * 0.04
      });
    }

    const wobble = reducedMotion ? 0 : Math.sin(timeMs * 0.00035) * 24 * motionScale;
    for (const chunk of this.chunks.values()) {
      for (const prop of chunk.props) {
        if (budgetTier === 'minimal' && prop.layer > 1) continue;
        if ((budgetTier === 'low' || budgetTier === 'medium') && prop.kind === 'moteCluster') continue;

        const parallax = LAYER_PARALLAX[prop.layer];
        const wx = chunk.cx * CHUNK_SIZE + prop.x;
        const wy = chunk.cy * CHUNK_SIZE + prop.y;
        const sx = wx - cameraX * parallax + width * 0.5;
        const sy = wy - cameraY * parallax + height * 0.5 + wobble * (prop.layer === 3 ? 0.22 : 0.08);
        if (sx < -240 || sx > width + 240 || sy < -220 || sy > height + 220) continue;

        this.drawProp(g, prop, sx, sy, theme, timeMs, reducedMotion, motionScale);
      }
    }

    g.rect(0, 0, width, height);
    g.fill({ color: eventTint, alpha: 0.02 });
  }

  private drawProp(
    g: Graphics,
    prop: ChunkProp,
    sx: number,
    sy: number,
    theme: VisualThemeTokens,
    timeMs: number,
    reducedMotion: boolean,
    motionScale: number
  ): void {
    if (prop.kind === 'trunk') {
      const w = 16 * prop.scale;
      const h = 120 * prop.scale;
      g.roundRect(sx - w * 0.6, sy - h * 0.7, w * 1.2, h, 7 * prop.scale);
      g.fill({ color: 0x16211d, alpha: 0.34 });
      g.stroke({ width: Math.max(1, 1.3 * prop.scale), color: 0x446a58, alpha: 0.26 });
      g.roundRect(sx - w * 0.18, sy - h * 0.64, w * 0.36, h * 0.92, 4 * prop.scale);
      g.fill({ color: 0x315447, alpha: 0.14 });
      return;
    }

    if (prop.kind === 'root') {
      const r = 24 * prop.scale;
      g.poly([
        { x: sx - r * 1.2, y: sy + r * 0.5 },
        { x: sx - r * 0.2, y: sy - r * 0.2 },
        { x: sx + r * 1.2, y: sy + r * 0.6 },
        { x: sx + r * 0.1, y: sy + r * 1.05 }
      ]);
      g.fill({ color: 0x1b2d2a, alpha: 0.3 });
      g.stroke({ width: 1, color: 0x578468, alpha: 0.17 });
      return;
    }

    if (prop.kind === 'vine') {
      const sway = reducedMotion ? 0 : Math.sin(timeMs * 0.0012 + prop.rotation * 3) * 8 * motionScale;
      const len = 88 * prop.scale;
      g.moveTo(sx, sy - len * 0.7);
      g.bezierCurveTo(
        sx + sway * 0.35,
        sy - len * 0.35,
        sx - sway * 0.5,
        sy + len * 0.2,
        sx + sway * 0.1,
        sy + len * 0.72
      );
      g.stroke({ width: Math.max(1, 1.4 * prop.scale), color: 0x4f8766, alpha: 0.24 });
      return;
    }

    if (prop.kind === 'rune') {
      const r = 11 * prop.scale;
      g.circle(sx, sy, r);
      g.stroke({ width: 1.1, color: theme.backdrop.grade, alpha: 0.18 });
      g.poly([
        { x: sx, y: sy - r * 0.72 },
        { x: sx + r * 0.62, y: sy },
        { x: sx, y: sy + r * 0.72 },
        { x: sx - r * 0.62, y: sy }
      ]);
      g.stroke({ width: 1, color: 0x8cebc7, alpha: 0.12 + prop.glow * 0.12 });
      return;
    }

    if (prop.kind === 'fungus') {
      const pulse = reducedMotion ? 0 : (Math.sin(timeMs * 0.0016 + prop.rotation) * 0.5 + 0.5) * motionScale;
      const r = 10 * prop.scale;
      g.ellipse(sx, sy, r * 1.2, r * 0.7);
      g.fill({ color: 0x6d58a8, alpha: 0.22 + prop.glow * 0.08 });
      g.circle(sx, sy, r * (0.36 + pulse * 0.18));
      g.fill({ color: 0x8ff6ff, alpha: 0.18 + prop.glow * 0.14 });
      return;
    }

    const dotCount = 3 + Math.floor(prop.glow * 4);
    for (let i = 0; i < dotCount; i += 1) {
      const angle = (Math.PI * 2 * i) / dotCount + prop.rotation;
      const radius = 8 * prop.scale + i * 2.5;
      g.circle(sx + Math.cos(angle) * radius, sy + Math.sin(angle) * radius, 1.2 + prop.scale * 0.6);
      g.fill({ color: theme.backdrop.grade, alpha: 0.07 + prop.glow * 0.08 });
    }
  }
}
