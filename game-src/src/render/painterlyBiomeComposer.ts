import type { Graphics } from 'pixi.js';
import { atlasByKind, type PainterlyForestCard } from './atlas/painterlyForestAtlas';
import type { RenderBudgetTier, SceneSuppressionTier, VisualThemeTokens } from '../types';

interface SceneCard {
  card: PainterlyForestCard;
  wx: number;
  wy: number;
  scale: number;
  rotation: number;
  layer: 0 | 1 | 2 | 3;
  seed: number;
}

interface SceneChunk {
  key: string;
  cards: SceneCard[];
}

interface DrawParams {
  width: number;
  height: number;
  cameraX: number;
  cameraY: number;
  timeMs: number;
  motionScale: number;
  reducedMotion: boolean;
  theme: VisualThemeTokens;
  budgetTier: RenderBudgetTier;
  suppressionTier: SceneSuppressionTier;
  backgroundDensity: number;
  atmosphereStrength: number;
  eventTint: number;
}

const CHUNK_SIZE = 680;
const PARALLAX: [number, number, number, number] = [0.14, 0.35, 0.62, 0.86];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function hash(x: number, y: number, salt: number): number {
  return fract(Math.sin(x * 127.1 + y * 311.7 + salt * 57.9) * 43758.5453123);
}

function pick<T>(arr: readonly T[], seed: number): T {
  const idx = Math.floor(clamp(seed, 0, 0.9999) * arr.length);
  return arr[idx] ?? arr[0];
}

function jitter(seedX: number, seedY: number, salt: number, min: number, max: number): number {
  return min + (max - min) * hash(seedX, seedY, salt);
}

function createChunk(cx: number, cy: number): SceneChunk {
  const canopy = atlasByKind('canopy');
  const trunks = atlasByKind('trunk');
  const vines = atlasByKind('vine');
  const moss = atlasByKind('moss');
  const roots = atlasByKind('root');
  const fungi = atlasByKind('fungus');
  const runes = atlasByKind('rune_stone');
  const sap = atlasByKind('sap_pool');
  const spores = atlasByKind('spore_cluster');

  const cards: SceneCard[] = [];
  const chunkX = cx * CHUNK_SIZE;
  const chunkY = cy * CHUNK_SIZE;

  const pushCard = (card: PainterlyForestCard, layer: 0 | 1 | 2 | 3, i: number): void => {
    cards.push({
      card,
      layer,
      wx: chunkX + jitter(cx + i * 0.17, cy - i * 0.37, 0.31 + i, -CHUNK_SIZE * 0.48, CHUNK_SIZE * 0.48),
      wy: chunkY + jitter(cx - i * 0.23, cy + i * 0.21, 0.63 + i, -CHUNK_SIZE * 0.48, CHUNK_SIZE * 0.48),
      scale: jitter(cx + i, cy - i, 0.92 + i, 0.7, 1.26),
      rotation: jitter(cx - i, cy + i, 1.2 + i, -0.24, 0.24),
      seed: hash(cx + i, cy - i, 1.47 + i)
    });
  };

  const canopyCount = 2 + Math.floor(hash(cx, cy, 2.1) * 2);
  for (let i = 0; i < canopyCount; i += 1) {
    pushCard(pick(canopy, hash(cx, cy, 3.2 + i)), 0, i);
  }

  const trunkCount = 5 + Math.floor(hash(cx, cy, 4.4) * 3);
  for (let i = 0; i < trunkCount; i += 1) {
    pushCard(pick(trunks, hash(cx, cy, 5.6 + i)), 1, 10 + i);
  }

  const vineCount = 4 + Math.floor(hash(cx, cy, 6.9) * 4);
  for (let i = 0; i < vineCount; i += 1) {
    pushCard(pick(vines, hash(cx, cy, 7.8 + i)), 1, 24 + i);
  }

  const floorCount = 7 + Math.floor(hash(cx, cy, 8.5) * 5);
  for (let i = 0; i < floorCount; i += 1) {
    const chooseRoot = hash(cx, cy, 9.3 + i) > 0.58;
    pushCard(
      chooseRoot ? pick(roots, hash(cx, cy, 9.8 + i)) : pick(moss, hash(cx, cy, 10.1 + i)),
      2,
      40 + i
    );
  }

  const glowCount = 3 + Math.floor(hash(cx, cy, 11.2) * 3);
  for (let i = 0; i < glowCount; i += 1) {
    const roll = hash(cx, cy, 12.4 + i);
    const card = roll > 0.72 ? pick(runes, roll) : roll > 0.42 ? pick(fungi, roll) : pick(sap, roll);
    pushCard(card, 2, 56 + i);
  }

  const sporeCount = 4 + Math.floor(hash(cx, cy, 13.7) * 3);
  for (let i = 0; i < sporeCount; i += 1) {
    pushCard(pick(spores, hash(cx, cy, 14.2 + i)), 3, 72 + i);
  }

  return { key: `${cx}:${cy}`, cards };
}

export class PainterlyBiomeComposer {
  private chunks = new Map<string, SceneChunk>();

  private ensureChunkCoverage(cameraX: number, cameraY: number): void {
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
    this.ensureChunkCoverage(params.cameraX, params.cameraY);
    g.clear();

    g.rect(0, 0, params.width, params.height);
    g.fill({ color: 0x03070d, alpha: 1 });

    // Large organic masses anchor the scene without introducing horizontal striping.
    g.ellipse(params.width * 0.18, params.height * 0.18, params.width * 0.42, params.height * 0.22);
    g.fill({ color: 0x070e16, alpha: 0.86 });
    g.ellipse(params.width * 0.78, params.height * 0.2, params.width * 0.38, params.height * 0.2);
    g.fill({ color: 0x071019, alpha: 0.82 });
    g.ellipse(params.width * 0.5, params.height * 0.78, params.width * 0.64, params.height * 0.26);
    g.fill({ color: 0x06111a, alpha: 0.84 });

    const densityMultiplier =
      (params.suppressionTier === 'hard' ? 0.4 : params.suppressionTier === 'medium' ? 0.62 : params.suppressionTier === 'light' ? 0.84 : 1) *
      clamp(params.backgroundDensity, 0.25, 1);
    const atmosphereMultiplier =
      (params.suppressionTier === 'hard' ? 0.3 : params.suppressionTier === 'medium' ? 0.55 : params.suppressionTier === 'light' ? 0.8 : 1) *
      clamp(params.atmosphereStrength, 0, 1);

    const densityCut =
      densityMultiplier *
      (params.budgetTier === 'minimal'
        ? 0.34
        : params.budgetTier === 'low'
          ? 0.58
          : params.budgetTier === 'medium'
            ? 0.78
            : 1);

    const time = params.timeMs;
    const sway = params.reducedMotion ? 0 : Math.sin(time * 0.00045) * 14 * params.motionScale;

    for (const chunk of this.chunks.values()) {
      for (const sceneCard of chunk.cards) {
        const layerBias = sceneCard.layer === 3 ? 0.72 : sceneCard.layer === 0 ? 0.9 : 1;
        const keepChance = densityCut * layerBias;
        const keepRoll = hash(sceneCard.wx * 0.001, sceneCard.wy * 0.001, 0.73 + sceneCard.layer * 0.37);
        if (keepRoll > keepChance) continue;
        this.drawSceneCard(g, sceneCard, params, sway, atmosphereMultiplier);
      }
    }

    if (atmosphereMultiplier > 0.02) {
      g.roundRect(-24, params.height * 0.08, params.width + 48, params.height * 0.2, 38);
      g.fill({ color: params.theme.backdrop.fog, alpha: 0.05 * atmosphereMultiplier });
      g.roundRect(-24, params.height * 0.7, params.width + 48, params.height * 0.22, 34);
      g.fill({ color: params.theme.backdrop.vines, alpha: 0.035 * atmosphereMultiplier });
    }

    if (params.eventTint !== 0 && params.suppressionTier !== 'hard') {
      g.roundRect(-18, -18, params.width + 36, 74, 30);
      g.fill({ color: params.eventTint, alpha: 0.04 * atmosphereMultiplier });
    }
  }

  private drawSceneCard(
    g: Graphics,
    sceneCard: SceneCard,
    params: DrawParams,
    sway: number,
    atmosphereMultiplier: number
  ): void {
    const parallax = PARALLAX[sceneCard.layer];
    const sx = sceneCard.wx - params.cameraX * parallax + params.width * 0.5;
    const sy = sceneCard.wy - params.cameraY * parallax + params.height * 0.5 + sway * (sceneCard.layer === 3 ? 0.22 : 0.08);
    if (sx < -220 || sx > params.width + 220 || sy < -220 || sy > params.height + 220) return;

    const scale = sceneCard.scale;
    const width = sceneCard.card.width * scale;
    const height = sceneCard.card.height * scale;
    const alphaBase = sceneCard.layer === 0 ? 0.7 : sceneCard.layer === 1 ? 0.86 : sceneCard.layer === 2 ? 0.92 : 0.7;
    const alpha = alphaBase * (sceneCard.layer === 3 ? atmosphereMultiplier : 1);

    if (sceneCard.card.kind === 'trunk') {
      g.poly([
        { x: sx - width * 0.26, y: sy - height * 0.75 },
        { x: sx + width * 0.18, y: sy - height * 0.72 },
        { x: sx + width * 0.24, y: sy + height * 0.12 },
        { x: sx + width * 0.12, y: sy + height * 0.24 },
        { x: sx + width * 0.21, y: sy + height * 0.78 },
        { x: sx - width * 0.19, y: sy + height * 0.8 },
        { x: sx - width * 0.3, y: sy + height * 0.18 }
      ]);
      g.fill({ color: sceneCard.card.fill, alpha: 0.9 * alpha });
      g.stroke({ width: Math.max(1, 1.4 * scale), color: sceneCard.card.highlight, alpha: 0.44 * alpha });
      g.roundRect(sx - width * 0.08, sy - height * 0.66, width * 0.1, height * 0.86, Math.max(2, 3 * scale));
      g.fill({ color: sceneCard.card.shade, alpha: 0.68 * alpha });
      g.ellipse(sx + width * 0.1, sy - height * 0.08, width * 0.2, height * 0.1);
      g.fill({ color: sceneCard.card.highlight, alpha: 0.18 * alpha });
      return;
    }

    if (sceneCard.card.kind === 'vine') {
      const drift = params.reducedMotion ? 0 : Math.sin(params.timeMs * 0.001 + sceneCard.seed * 9) * 14 * params.motionScale;
      g.moveTo(sx, sy - height * 0.5);
      g.bezierCurveTo(
        sx + drift * 0.25,
        sy - height * 0.2,
        sx - drift * 0.55,
        sy + height * 0.2,
        sx + drift * 0.16,
        sy + height * 0.52
      );
      g.stroke({ width: Math.max(1, 1.4 * scale), color: sceneCard.card.fill, alpha: 0.68 * alpha });
      g.circle(sx + drift * 0.16, sy + height * 0.5, 2.2 * scale);
      g.fill({ color: sceneCard.card.highlight, alpha: 0.38 * alpha });
      return;
    }

    if (sceneCard.card.kind === 'canopy') {
      g.ellipse(sx, sy, width * 0.55, height * 0.38);
      g.fill({ color: sceneCard.card.fill, alpha: 0.65 * alpha });
      g.ellipse(sx - width * 0.18, sy + 2, width * 0.36, height * 0.3);
      g.fill({ color: sceneCard.card.shade, alpha: 0.46 * alpha });
      g.ellipse(sx + width * 0.2, sy - 3, width * 0.3, height * 0.24);
      g.fill({ color: sceneCard.card.highlight, alpha: 0.2 * alpha });
      return;
    }

    if (sceneCard.card.kind === 'moss' || sceneCard.card.kind === 'root') {
      g.poly([
        { x: sx - width * 0.54, y: sy + height * 0.14 },
        { x: sx - width * 0.22, y: sy - height * 0.28 },
        { x: sx + width * 0.2, y: sy - height * 0.24 },
        { x: sx + width * 0.52, y: sy + height * 0.08 },
        { x: sx + width * 0.18, y: sy + height * 0.32 },
        { x: sx - width * 0.26, y: sy + height * 0.3 }
      ]);
      g.fill({ color: sceneCard.card.fill, alpha });
      g.ellipse(sx - width * 0.12, sy + 2 * scale, width * 0.28, height * 0.16);
      g.fill({ color: sceneCard.card.highlight, alpha: 0.26 * alpha });
      return;
    }

    if (sceneCard.card.kind === 'fungus') {
      const pulse = params.reducedMotion ? 0 : (Math.sin(params.timeMs * 0.0018 + sceneCard.seed * 30) * 0.5 + 0.5) * 0.2;
      g.ellipse(sx, sy, width * 0.38, height * 0.26);
      g.fill({ color: sceneCard.card.fill, alpha: 0.86 });
      g.ellipse(sx, sy + height * 0.08, width * 0.2, height * 0.22);
      g.fill({ color: sceneCard.card.shade, alpha: 0.74 });
      if (sceneCard.card.emissive) {
        g.circle(sx, sy, Math.max(4, width * (0.1 + pulse)));
        g.fill({ color: sceneCard.card.emissive, alpha: (sceneCard.card.emissiveStrength ?? 0.4) * atmosphereMultiplier });
      }
      return;
    }

    if (sceneCard.card.kind === 'rune_stone') {
      g.roundRect(sx - width * 0.24, sy - height * 0.48, width * 0.48, height * 0.8, 6 * scale);
      g.fill({ color: sceneCard.card.fill, alpha: 0.86 });
      g.stroke({ width: Math.max(1, 1.2 * scale), color: sceneCard.card.highlight, alpha: 0.4 });
      g.poly([
        { x: sx, y: sy - height * 0.24 },
        { x: sx + width * 0.12, y: sy },
        { x: sx, y: sy + height * 0.24 },
        { x: sx - width * 0.12, y: sy }
      ]);
      g.stroke({ width: 1.1 * scale, color: sceneCard.card.emissive ?? params.theme.backdrop.grade, alpha: 0.56 * atmosphereMultiplier });
      return;
    }

    if (sceneCard.card.kind === 'sap_pool') {
      g.ellipse(sx, sy, width * 0.34, height * 0.22);
      g.fill({ color: sceneCard.card.fill, alpha: 0.7 });
      g.ellipse(sx - width * 0.05, sy - 1, width * 0.24, height * 0.12);
      g.fill({ color: sceneCard.card.highlight, alpha: 0.24 });
      if (sceneCard.card.emissive) {
        g.ellipse(sx + width * 0.04, sy, width * 0.18, height * 0.1);
        g.fill({ color: sceneCard.card.emissive, alpha: (sceneCard.card.emissiveStrength ?? 0.3) * atmosphereMultiplier });
      }
      return;
    }

    const dotCount = 4;
    for (let i = 0; i < dotCount; i += 1) {
      const angle = (Math.PI * 2 * i) / dotCount + sceneCard.rotation;
      const px = sx + Math.cos(angle) * width * 0.2;
      const py = sy + Math.sin(angle) * height * 0.2;
      g.circle(px, py, Math.max(1.8, 2.6 * scale));
      g.fill({ color: sceneCard.card.emissive ?? sceneCard.card.fill, alpha: 0.34 * atmosphereMultiplier });
    }
  }
}
