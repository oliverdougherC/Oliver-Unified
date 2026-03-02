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
  ultra: { maxLights: 72, maxShadowLights: 14, tileSize: 92, halfResEffects: false },
  high: { maxLights: 56, maxShadowLights: 10, tileSize: 104, halfResEffects: true },
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
  safariSafeMode: boolean;
  cameraVelocitySq: number;
  theme: VisualThemeTokens;
}

export interface LightingSamplingContext {
  width: number;
  height: number;
  cameraX: number;
  cameraY: number;
  centerX: number;
  centerY: number;
  budgetTier: RenderBudgetTier;
  safariSafeMode: boolean;
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
  private shadowCadenceTick = 0;
  private fogCadenceTick = 0;
  private sampleCount = 0;
  private samplingGrid: Float32Array | null = null;
  private samplingCols = 0;
  private samplingRows = 0;
  private samplingCellSize = 96;
  private samplingOriginX = 0;
  private samplingOriginY = 0;
  private hasSamplingGrid = false;

  setSettings(settings: LightingRuntimeSettings): void {
    this.settings = settings;
  }

  setReadabilityMultiplier(multiplier: number): void {
    this.readabilityMultiplier = clamp(multiplier, 0.25, 1);
  }

  clearDynamicData(): void {
    this.lights.length = 0;
    this.shadowCasters.length = 0;
    this.sampleCount = 0;
    this.hasSamplingGrid = false;
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

  getSampleCount(): number {
    return this.sampleCount;
  }

  private resolveBudget(context: { budgetTier: RenderBudgetTier; safariSafeMode: boolean }): LightingBudget {
    const base = BUDGETS[context.budgetTier];
    if (!context.safariSafeMode) return base;
    return {
      maxLights: Math.max(8, Math.round(base.maxLights * 0.6)),
      maxShadowLights: Math.max(0, Math.round(base.maxShadowLights * 0.5)),
      tileSize: Math.round(base.tileSize * 1.15),
      halfResEffects: true
    };
  }

  private lightScore(light: LightInstance): number {
    return light.priority ?? light.intensity;
  }

  private selectTopPriorityLights(lights: LightInstance[], maxLights: number): LightInstance[] {
    if (maxLights <= 0 || lights.length === 0) return [];
    if (lights.length <= maxLights) {
      return [...lights].sort((a, b) => this.lightScore(b) - this.lightScore(a));
    }

    const selected: LightInstance[] = [];
    for (const light of lights) {
      if (selected.length < maxLights) {
        selected.push(light);
        continue;
      }

      let minIdx = 0;
      let minScore = this.lightScore(selected[0]);
      for (let i = 1; i < selected.length; i += 1) {
        const score = this.lightScore(selected[i]);
        if (score < minScore) {
          minScore = score;
          minIdx = i;
        }
      }
      const score = this.lightScore(light);
      if (score > minScore) {
        selected[minIdx] = light;
      }
    }

    selected.sort((a, b) => this.lightScore(b) - this.lightScore(a));
    return selected;
  }

  prepareSamplingGrid(context: LightingSamplingContext): void {
    const budget = this.resolveBudget(context);
    const sampleLights = this.selectTopPriorityLights(this.lights, Math.min(30, budget.maxLights));
    const baseCell =
      context.budgetTier === 'ultra'
        ? 72
        : context.budgetTier === 'high'
          ? 88
          : context.budgetTier === 'medium'
            ? 104
            : context.budgetTier === 'low'
              ? 128
              : 160;
    this.samplingCellSize = context.safariSafeMode ? Math.round(baseCell * 1.2) : baseCell;
    this.samplingCols = Math.max(2, Math.ceil(context.width / this.samplingCellSize) + 3);
    this.samplingRows = Math.max(2, Math.ceil(context.height / this.samplingCellSize) + 3);
    const total = this.samplingCols * this.samplingRows;
    if (!this.samplingGrid || this.samplingGrid.length !== total) {
      this.samplingGrid = new Float32Array(total);
    } else {
      this.samplingGrid.fill(0);
    }
    this.samplingOriginX = context.cameraX - context.centerX - this.samplingCellSize;
    this.samplingOriginY = context.cameraY - context.centerY - this.samplingCellSize;
    for (let row = 0; row < this.samplingRows; row += 1) {
      for (let col = 0; col < this.samplingCols; col += 1) {
        const wx = this.samplingOriginX + col * this.samplingCellSize;
        const wy = this.samplingOriginY + row * this.samplingCellSize;
        let lightAccum = 0.2;
        for (const light of sampleLights) {
          const dx = wx - light.x;
          const dy = wy - light.y;
          const distSq = dx * dx + dy * dy;
          const radiusSq = light.radius * light.radius;
          if (distSq > radiusSq) continue;
          const falloff = 1 - Math.sqrt(distSq) / Math.max(1, light.radius);
          lightAccum += falloff * light.intensity * (0.8 + (1 - light.falloff) * 0.35);
        }
        this.samplingGrid[row * this.samplingCols + col] = clamp(lightAccum * this.settings.environmentContrast, 0.35, 1.8);
      }
    }
    this.hasSamplingGrid = true;
  }

  sampleIlluminance(x: number, y: number): number {
    this.sampleCount += 1;
    if (this.hasSamplingGrid && this.samplingGrid && this.samplingCols > 1 && this.samplingRows > 1) {
      const gx = (x - this.samplingOriginX) / this.samplingCellSize;
      const gy = (y - this.samplingOriginY) / this.samplingCellSize;
      const x0 = clamp(Math.floor(gx), 0, this.samplingCols - 1);
      const y0 = clamp(Math.floor(gy), 0, this.samplingRows - 1);
      const x1 = clamp(x0 + 1, 0, this.samplingCols - 1);
      const y1 = clamp(y0 + 1, 0, this.samplingRows - 1);
      const tx = clamp(gx - x0, 0, 1);
      const ty = clamp(gy - y0, 0, 1);
      const i00 = this.samplingGrid[y0 * this.samplingCols + x0];
      const i10 = this.samplingGrid[y0 * this.samplingCols + x1];
      const i01 = this.samplingGrid[y1 * this.samplingCols + x0];
      const i11 = this.samplingGrid[y1 * this.samplingCols + x1];
      const ix0 = i00 + (i10 - i00) * tx;
      const ix1 = i01 + (i11 - i01) * tx;
      return clamp(ix0 + (ix1 - ix0) * ty, 0.35, 1.8);
    }

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
    const budget = this.resolveBudget(context);
    if (!this.hasSamplingGrid) {
      this.prepareSamplingGrid({
        width: context.width,
        height: context.height,
        cameraX: context.cameraX,
        cameraY: context.cameraY,
        centerX: context.centerX,
        centerY: context.centerY,
        budgetTier: context.budgetTier,
        safariSafeMode: context.safariSafeMode
      });
    }

    const sortedLights = this.selectTopPriorityLights(this.lights, budget.maxLights);
    const shadowCandidates = sortedLights.filter((light) => light.castsShadow);
    const sortedShadowLights =
      this.settings.shadowQuality === 'off'
        ? []
        : this.selectTopPriorityLights(shadowCandidates, budget.maxShadowLights);
    this.metrics.gbufferMs = Math.max(0.01, performance.now() - gbufferStart);

    const lightCullStart = performance.now();
    const tileAssignments =
      sortedLights.length < 4
        ? []
        : this.createTileAssignments(
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
      // Rim shell creates cleaner edge definition around lit silhouettes.
      lightMap.circle(sx, sy, radius * 0.58);
      lightMap.stroke({
        width: Math.max(1.2, radius * 0.024),
        color: mixColor(light.color, context.theme.backdrop.grade, 0.28),
        alpha: intensity * 0.035
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
    const stableCamera = context.cameraVelocitySq < 16;
    const shadowCadence = context.safariSafeMode
      ? stableCamera
        ? context.budgetTier === 'ultra'
          ? 2
          : 3
        : 2
      : stableCamera && context.budgetTier !== 'ultra'
        ? 2
        : 1;
    const drawShadowPass = this.shadowCadenceTick % shadowCadence === 0;
    this.shadowCadenceTick += 1;
    if (this.settings.shadowQuality === 'off') {
      shadowMap.clear();
    }
    if (drawShadowPass) {
      shadowMap.clear();
      if (sortedShadowLights.length > 0 && this.shadowCasters.length > 0) {
        this.drawShadows(shadowMap, sortedShadowLights, context);
      }
      if (this.settings.shadowQuality !== 'off' && this.shadowCasters.length > 0) {
        this.drawContactShadows(shadowMap, context);
      }
    }

    const fogCadence = context.safariSafeMode
      ? stableCamera
        ? context.budgetTier === 'ultra'
          ? 2
          : context.budgetTier === 'high'
            ? 3
            : 4
        : 2
      : stableCamera && (context.budgetTier === 'low' || context.budgetTier === 'minimal')
        ? 3
        : stableCamera && context.budgetTier === 'medium'
          ? 2
          : 1;
    const drawFogPass = this.fogCadenceTick % fogCadence === 0;
    this.fogCadenceTick += 1;
    if (this.settings.fogQuality === 'off') {
      fogMap.clear();
    }
    if (this.settings.fogQuality !== 'off' && drawFogPass) {
      fogMap.clear();
      this.drawFog(fogMap, context, budget.halfResEffects, sortedLights);
    }
    this.metrics.fogMs =
      this.settings.fogQuality !== 'off' && (drawShadowPass || drawFogPass)
        ? Math.max(0.01, performance.now() - fogStart)
        : 0;
    if (this.shadowCadenceTick > 1_000_000) this.shadowCadenceTick = 0;
    if (this.fogCadenceTick > 1_000_000) this.fogCadenceTick = 0;

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

    // Layered depth haze keeps distant cards cohesive and reduces harsh cutout edges.
    const hazeAlpha = clamp(globalAlpha * 3.2, 0.014, 0.064);
    for (let i = 0; i < 3; i += 1) {
      const y = context.height * (0.16 + i * 0.27);
      const bandHeight = context.height * (0.22 + i * 0.05);
      fogMap.roundRect(-18, y, context.width + 36, bandHeight, 28);
      fogMap.fill({
        color: mixColor(context.theme.backdrop.fog, context.theme.backdrop.grade, 0.16 + i * 0.14),
        alpha: hazeAlpha * (0.58 + i * 0.2)
      });
    }

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

  private drawContactShadows(shadowMap: Graphics, context: LightingDrawContext): void {
    const softness =
      this.settings.shadowQuality === 'soft'
        ? 1
        : this.settings.shadowQuality === 'hard'
          ? 0.6
          : 0;
    if (softness <= 0) return;

    const maxCasters = context.budgetTier === 'ultra' ? 80 : context.budgetTier === 'high' ? 56 : 34;
    const casters = this.shadowCasters.slice(0, maxCasters);
    for (const caster of casters) {
      const sx = caster.x - context.cameraX + context.centerX;
      const sy = caster.y - context.cameraY + context.centerY;
      if (sx < -120 || sy < -120 || sx > context.width + 120 || sy > context.height + 120) continue;

      const radius = Math.max(8, caster.radius ?? 12);
      const depthStretch = 1 + caster.height * 0.9;
      shadowMap.ellipse(sx, sy + radius * 0.42, radius * depthStretch, radius * 0.52);
      shadowMap.fill({
        color: 0x030508,
        alpha: clamp(0.07 * softness * (0.78 + caster.softness * 0.32), 0.02, 0.11)
      });
    }
  }
}
