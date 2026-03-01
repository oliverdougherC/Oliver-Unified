import type { Graphics } from 'pixi.js';
import type {
  LightInstance,
  LightingBudget,
  LightingRuntimeSettings,
  RenderBudgetTier,
  RenderPassMetrics,
  RendererKind,
  ShadowCaster,
  VisualThemeTokens
} from '../types';

const BUDGETS: Record<RenderBudgetTier, LightingBudget> = {
  ultra: { maxLights: 54, maxShadowLights: 10, tileSize: 96, halfResEffects: false },
  high: { maxLights: 42, maxShadowLights: 8, tileSize: 112, halfResEffects: true },
  medium: { maxLights: 30, maxShadowLights: 5, tileSize: 128, halfResEffects: true },
  low: { maxLights: 18, maxShadowLights: 2, tileSize: 144, halfResEffects: true },
  minimal: { maxLights: 10, maxShadowLights: 0, tileSize: 176, halfResEffects: true }
};

export interface LightingDrawContext {
  width: number;
  height: number;
  cameraX: number;
  cameraY: number;
  centerX: number;
  centerY: number;
  worldTime: number;
  motionScale: number;
  reducedMotion: boolean;
  rendererKind: RendererKind;
  budgetTier: RenderBudgetTier;
  theme: VisualThemeTokens;
}

interface TileAssignment {
  key: string;
  indices: number[];
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

export class LightingPipeline {
  private settings: LightingRuntimeSettings = {
    lightingQuality: 'high',
    shadowQuality: 'soft',
    fogQuality: 'volumetric',
    bloomStrength: 0.6,
    gamma: 1,
    environmentContrast: 1,
    materialDetail: 'full',
    clarityPreset: 'balanced'
  };

  private lights: LightInstance[] = [];
  private shadowCasters: ShadowCaster[] = [];
  private metrics: RenderPassMetrics = {
    gbufferMs: 0,
    lightCullMs: 0,
    lightShadeMs: 0,
    fogMs: 0,
    compositeMs: 0
  };
  private readabilityMultiplier = 1;

  setSettings(settings: LightingRuntimeSettings): void {
    this.settings = settings;
  }

  setReadabilityMultiplier(multiplier: number): void {
    this.readabilityMultiplier = clamp(multiplier, 0.25, 1);
  }

  clearDynamicData(): void {
    this.lights.length = 0;
    this.shadowCasters.length = 0;
  }

  addLight(light: LightInstance): void {
    this.lights.push(light);
  }

  addShadowCaster(caster: ShadowCaster): void {
    this.shadowCasters.push(caster);
  }

  getMetrics(): RenderPassMetrics {
    return { ...this.metrics };
  }

  getCounts(): { lights: number; shadowCasters: number } {
    return { lights: this.lights.length, shadowCasters: this.shadowCasters.length };
  }

  sampleIlluminance(x: number, y: number): number {
    let lightAccum = 0.2;
    for (const light of this.lights) {
      const dx = x - light.x;
      const dy = y - light.y;
      const distSq = dx * dx + dy * dy;
      const radiusSq = light.radius * light.radius;
      if (distSq > radiusSq) continue;
      const falloff = 1 - Math.sqrt(distSq) / Math.max(1, light.radius);
      lightAccum += falloff * light.intensity * (0.8 + (1 - light.falloff) * 0.35);
    }
    return clamp(lightAccum * this.settings.environmentContrast, 0.35, 1.8);
  }

  render(
    lightMap: Graphics,
    shadowMap: Graphics,
    fogMap: Graphics,
    context: LightingDrawContext
  ): void {
    const gbufferStart = performance.now();
    const budget = BUDGETS[context.budgetTier];

    const sortedLights = [...this.lights]
      .sort((a, b) => (b.priority ?? b.intensity) - (a.priority ?? a.intensity))
      .slice(0, budget.maxLights);
    const sortedShadowLights =
      this.settings.shadowQuality === 'off'
        ? []
        : sortedLights.filter((light) => light.castsShadow).slice(0, budget.maxShadowLights);
    this.metrics.gbufferMs = Math.max(0.01, performance.now() - gbufferStart);

    const lightCullStart = performance.now();
    const tileAssignments = this.createTileAssignments(
      sortedLights,
      context.width,
      context.height,
      context.cameraX,
      context.cameraY,
      context.centerX,
      context.centerY,
      budget.tileSize
    );
    this.metrics.lightCullMs =
      sortedLights.length > 0 ? Math.max(0.01, performance.now() - lightCullStart) : 0;

    const shadeStart = performance.now();
    lightMap.clear();
    for (const light of sortedLights) {
      const sx = light.x - context.cameraX + context.centerX;
      const sy = light.y - context.cameraY + context.centerY;
      const jitter =
        context.reducedMotion || light.flicker <= 0
          ? 0
          : Math.sin((context.worldTime + light.x * 0.07 + light.y * 0.05) * 0.008) * light.flicker;
      const intensity = clamp(light.intensity + jitter, 0.08, 2);
      const radius = light.radius * (budget.halfResEffects ? 0.94 : 1) * (1 + jitter * 0.04);
      lightMap.circle(sx, sy, radius * 0.42);
      lightMap.fill({
        color: light.color,
        alpha: intensity * (0.0024 + this.settings.bloomStrength * 0.0028)
      });
      lightMap.circle(sx, sy, radius * 0.22);
      lightMap.fill({
        color: light.color,
        alpha: intensity * (0.007 + this.settings.bloomStrength * 0.006)
      });
      lightMap.circle(sx, sy, Math.max(8, radius * 0.08));
      lightMap.fill({
        color: light.color,
        alpha: intensity * 0.015
      });
    }

    if (tileAssignments.length > 0) {
      const assignmentBoost = clamp(tileAssignments.length / 120, 0.04, 0.18);
      lightMap.rect(0, 0, context.width, context.height);
      lightMap.fill({
        color: mixColor(context.theme.backdrop.fog, context.theme.backdrop.grade, assignmentBoost),
        alpha: 0.02
      });
    }
    this.metrics.lightShadeMs =
      sortedLights.length > 0 ? Math.max(0.01, performance.now() - shadeStart) : 0;

    const fogStart = performance.now();
    shadowMap.clear();
    if (sortedShadowLights.length > 0 && this.shadowCasters.length > 0) {
      this.drawShadows(shadowMap, sortedShadowLights, context);
    }

    fogMap.clear();
    if (this.settings.fogQuality !== 'off') {
      this.drawFog(fogMap, context, budget.halfResEffects, sortedLights);
    }
    this.metrics.fogMs =
      this.settings.fogQuality !== 'off' ? Math.max(0.01, performance.now() - fogStart) : 0;

    this.metrics.compositeMs = this.metrics.gbufferMs + this.metrics.lightCullMs + this.metrics.lightShadeMs + this.metrics.fogMs;
  }

  private createTileAssignments(
    lights: LightInstance[],
    width: number,
    height: number,
    cameraX: number,
    cameraY: number,
    centerX: number,
    centerY: number,
    tileSize: number
  ): TileAssignment[] {
    const cols = Math.ceil(width / tileSize);
    const rows = Math.ceil(height / tileSize);
    const map = new Map<string, number[]>();

    for (let i = 0; i < lights.length; i += 1) {
      const light = lights[i];
      const sx = light.x - cameraX + centerX;
      const sy = light.y - cameraY + centerY;
      const minCol = clamp(Math.floor((sx - light.radius) / tileSize), 0, cols - 1);
      const maxCol = clamp(Math.floor((sx + light.radius) / tileSize), 0, cols - 1);
      const minRow = clamp(Math.floor((sy - light.radius) / tileSize), 0, rows - 1);
      const maxRow = clamp(Math.floor((sy + light.radius) / tileSize), 0, rows - 1);
      for (let row = minRow; row <= maxRow; row += 1) {
        for (let col = minCol; col <= maxCol; col += 1) {
          const key = `${col}:${row}`;
          const list = map.get(key);
          if (list) list.push(i);
          else map.set(key, [i]);
        }
      }
    }

    return Array.from(map.entries()).map(([key, indices]) => ({ key, indices }));
  }

  private drawShadows(shadowMap: Graphics, lights: LightInstance[], context: LightingDrawContext): void {
    const softness =
      this.settings.shadowQuality === 'soft'
        ? 1
        : this.settings.shadowQuality === 'hard'
          ? 0.45
          : 0;
    if (softness <= 0) return;

    for (const caster of this.shadowCasters) {
      if (caster.shape !== 'circle') continue;
      const radius = caster.radius ?? 14;
      for (const light of lights) {
        const dx = caster.x - light.x;
        const dy = caster.y - light.y;
        const len = Math.hypot(dx, dy);
        if (len <= 1 || len > light.radius * 1.1) continue;
        const nx = dx / len;
        const ny = dy / len;
        const px = -ny;
        const py = nx;
        const reach = Math.min(light.radius * 1.45, 380 + caster.height * 80);

        const a1x = caster.x + px * radius;
        const a1y = caster.y + py * radius;
        const a2x = caster.x - px * radius;
        const a2y = caster.y - py * radius;
        const b1x = a1x + nx * reach;
        const b1y = a1y + ny * reach;
        const b2x = a2x + nx * reach;
        const b2y = a2y + ny * reach;

        shadowMap.poly([
          { x: a1x - context.cameraX + context.centerX, y: a1y - context.cameraY + context.centerY },
          { x: a2x - context.cameraX + context.centerX, y: a2y - context.cameraY + context.centerY },
          { x: b2x - context.cameraX + context.centerX, y: b2y - context.cameraY + context.centerY },
          { x: b1x - context.cameraX + context.centerX, y: b1y - context.cameraY + context.centerY }
        ]);
        shadowMap.fill({ color: 0x04060a, alpha: 0.1 * softness * (0.4 + caster.softness * 0.6) });
      }
    }
  }

  private drawFog(
    fogMap: Graphics,
    context: LightingDrawContext,
    halfResEffects: boolean,
    sortedLights: LightInstance[]
  ): void {
    const globalAlpha =
      (this.settings.fogQuality === 'volumetric' ? 0.016 : 0.01) *
      (halfResEffects ? 1.1 : 1) *
      this.readabilityMultiplier;
    fogMap.rect(0, 0, context.width, context.height);
    fogMap.fill({ color: context.theme.backdrop.fog, alpha: globalAlpha });

    const pocketCount = this.settings.fogQuality === 'volumetric' ? 10 : 6;
    const topLights = sortedLights.slice(0, pocketCount);
    for (let i = 0; i < topLights.length; i += 1) {
      const light = topLights[i];
      const sx = light.x - context.cameraX + context.centerX;
      const sy = light.y - context.cameraY + context.centerY;
      const radius = light.radius * (this.settings.fogQuality === 'volumetric' ? 0.46 : 0.34);
      if (sx < -120 || sy < -120 || sx > context.width + 120 || sy > context.height + 120) continue;
      fogMap.circle(sx, sy, radius);
      fogMap.fill({
        color: light.color,
        alpha: clamp(light.intensity * 0.035 * this.readabilityMultiplier, 0.006, 0.042)
      });
    }

    const ambientPockets = this.settings.fogQuality === 'volumetric' ? 7 : 4;
    for (let i = 0; i < ambientPockets; i += 1) {
      const drift = context.reducedMotion ? 0 : Math.sin(context.worldTime * 0.0004 + i * 1.3) * 14 * context.motionScale;
      const x = ((i * 173 + context.cameraX * 0.12) % (context.width + 280)) - 140;
      const y = ((i * 131 + context.cameraY * 0.09) % (context.height + 220)) - 110 + drift;
      fogMap.ellipse(x, y, 70 + i * 8, 28 + i * 5);
      fogMap.fill({ color: context.theme.backdrop.vines, alpha: 0.008 * this.readabilityMultiplier });
    }
  }
}
