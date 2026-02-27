import {
  Application,
  BlurFilter,
  ColorMatrixFilter,
  Container,
  Graphics,
  NoiseFilter
} from 'pixi.js';
import { ENEMY_ARCHETYPES } from '../data/enemies';
import { GameWorld } from '../core/world';
import type { EnemyRole, IRenderAdapter, QualityTier, RendererKind, RendererPreference } from '../types';

function createCircleGraphic(radius: number, fill: number, stroke: number, strokeWidth = 2): Graphics {
  const graphic = new Graphics();
  graphic.circle(0, 0, radius);
  graphic.fill(fill);
  graphic.stroke({ width: strokeWidth, color: stroke });
  return graphic;
}

function createEnemyGraphic(role: EnemyRole, radius: number, fill: number, stroke: number, isElite: boolean): Graphics {
  const graphic = new Graphics();
  const strokeWidth = isElite ? 2.8 : 1.8;

  if (role === 'charger') {
    graphic.poly([
      { x: 0, y: -radius },
      { x: radius * 0.88, y: radius * 0.8 },
      { x: -radius * 0.88, y: radius * 0.8 }
    ]);
  } else if (role === 'bruiser') {
    const r = radius * 0.92;
    graphic.poly([
      { x: -r * 0.86, y: -r * 0.45 },
      { x: 0, y: -r },
      { x: r * 0.86, y: -r * 0.45 },
      { x: r * 0.86, y: r * 0.45 },
      { x: 0, y: r },
      { x: -r * 0.86, y: r * 0.45 }
    ]);
  } else if (role === 'tank') {
    graphic.rect(-radius, -radius, radius * 2, radius * 2);
  } else if (role === 'sniper') {
    graphic.poly([
      { x: 0, y: -radius },
      { x: radius, y: 0 },
      { x: 0, y: radius },
      { x: -radius, y: 0 }
    ]);
  } else if (role === 'summoner') {
    const r = radius;
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + (Math.PI * 2 * i) / 10;
      const mag = i % 2 === 0 ? r : r * 0.48;
      points.push({ x: Math.cos(angle) * mag, y: Math.sin(angle) * mag });
    }
    graphic.poly(points);
  } else if (role === 'disruptor') {
    graphic.circle(0, 0, radius);
    graphic.stroke({ width: strokeWidth * 0.9, color: stroke, alpha: 0.95 });
    graphic.circle(0, 0, radius * 0.56);
    graphic.fill(fill);
    graphic.stroke({ width: strokeWidth * 0.7, color: stroke, alpha: 0.78 });
    return graphic;
  } else {
    graphic.circle(0, 0, radius);
  }

  graphic.fill(fill);
  graphic.stroke({ width: strokeWidth, color: stroke });
  return graphic;
}

const EVENT_AURA_COLORS: Record<string, number> = {
  blood_monsoon: 0xffc59e,
  iron_canopy: 0xb8ffd2,
  void_howl: 0xffe8ab
};

export class PixiRenderAdapter implements IRenderAdapter<GameWorld> {
  private app: Application | null = null;
  private mountEl: HTMLElement | null = null;
  private backdropLayer = new Container();
  private worldLayer = new Container();
  private fxLayer = new Container();
  private combatLayer = new Container();
  private overlayLayer = new Container();
  private hudLayer = new Container();
  private backdropGraphic: Graphics | null = null;
  private playerGraphic: Graphics | null = null;
  private playerAuraGraphic: Graphics | null = null;
  private damageVignette: Graphics | null = null;
  private eventAuraGraphic: Graphics | null = null;
  private impactGlowGraphic: Graphics | null = null;
  private dashTelegraphGraphic: Graphics | null = null;
  private rendererKind: RendererKind = 'webgl';
  private quality: QualityTier = 'high';
  private reducedMotion = false;
  private motionScale = 1;
  private motes: Graphics[] = [];
  private webgpuNoiseFilter: NoiseFilter | null = null;
  private webgpuGradeFilter: ColorMatrixFilter | null = null;

  private enemyGraphics = new Map<number, Graphics>();
  private enemyPrevHp = new Map<number, number>();
  private enemyHitPulse = new Map<number, number>();
  private projectileGraphics = new Map<number, Graphics>();
  private enemyProjectileGraphics = new Map<number, Graphics>();
  private hazardGraphics = new Map<number, Graphics>();
  private chestGraphics = new Map<number, Graphics>();
  private xpGraphics = new Map<number, Graphics>();

  async init(options: {
    mount: HTMLElement;
    requestedRenderer: RendererPreference;
    reducedMotion: boolean;
  }): Promise<RendererKind> {
    this.mountEl = options.mount;
    this.mountEl.innerHTML = '';

    const requested = options.requestedRenderer;

    if (requested === 'webgpu' || requested === 'auto') {
      const ok = await this.tryInitRenderer('webgpu', options.mount, options.reducedMotion);
      if (ok) {
        this.rendererKind = 'webgpu';
        return this.rendererKind;
      }
    }

    const fallbackOk = await this.tryInitRenderer('webgl', options.mount, options.reducedMotion);
    if (!fallbackOk) {
      throw new Error('Unable to initialize either WebGPU or WebGL renderer.');
    }

    this.rendererKind = 'webgl';
    return this.rendererKind;
  }

  private async tryInitRenderer(
    preference: RendererKind,
    mount: HTMLElement,
    reducedMotion: boolean
  ): Promise<boolean> {
    try {
      this.reducedMotion = reducedMotion;
      this.app = new Application();
      await this.app.init({
        preference,
        resizeTo: mount,
        antialias: true,
        backgroundAlpha: 0,
        powerPreference: 'high-performance'
      });

      mount.appendChild(this.app.canvas);
      this.app.stage.addChild(
        this.backdropLayer,
        this.worldLayer,
        this.fxLayer,
        this.combatLayer,
        this.overlayLayer,
        this.hudLayer
      );

      this.backdropGraphic = new Graphics();
      this.backdropLayer.addChild(this.backdropGraphic);

      this.playerGraphic = createCircleGraphic(15, 0xd4f8b3, 0xfdffe8, 3);
      this.worldLayer.addChild(this.playerGraphic);

      this.playerAuraGraphic = new Graphics();
      this.combatLayer.addChild(this.playerAuraGraphic);

      this.dashTelegraphGraphic = new Graphics();
      this.combatLayer.addChild(this.dashTelegraphGraphic);

      this.eventAuraGraphic = new Graphics();
      this.overlayLayer.addChild(this.eventAuraGraphic);

      this.damageVignette = new Graphics();
      this.overlayLayer.addChild(this.damageVignette);

      this.impactGlowGraphic = new Graphics();
      this.overlayLayer.addChild(this.impactGlowGraphic);

      this.createAmbientMotes(preference, reducedMotion);
      this.configureRendererSpecificFx(preference);

      return true;
    } catch {
      this.destroy();
      return false;
    }
  }

  private configureRendererSpecificFx(preference: RendererKind): void {
    if (preference !== 'webgpu') {
      this.fxLayer.filters = [new BlurFilter({ strength: 1.2, quality: 2 })];
      this.overlayLayer.filters = [];
      this.worldLayer.filters = [];
      this.webgpuNoiseFilter = null;
      this.webgpuGradeFilter = null;
      return;
    }

    const fogBlur = new BlurFilter({ strength: 2, quality: 3 });
    this.fxLayer.filters = [fogBlur];

    this.webgpuNoiseFilter = new NoiseFilter({
      noise: 0.068,
      seed: 0.314
    });
    this.overlayLayer.filters = [this.webgpuNoiseFilter];

    this.webgpuGradeFilter = new ColorMatrixFilter();
    this.webgpuGradeFilter.brightness(1.05, false);
    this.webgpuGradeFilter.saturate(0.22, false);
    this.worldLayer.filters = [this.webgpuGradeFilter];
  }

  private createAmbientMotes(preference: RendererKind, reducedMotion: boolean): void {
    this.motes = [];
    if (!this.app || reducedMotion) return;

    const moteCount = preference === 'webgpu' ? 240 : 90;
    for (let i = 0; i < moteCount; i += 1) {
      const mote = createCircleGraphic(
        1 + Math.random() * 2.8,
        preference === 'webgpu' ? 0x395f34 : 0x324f31,
        0x98be8a,
        0
      );
      mote.alpha = 0.08 + Math.random() * 0.16;
      mote.x = (Math.random() - 0.5) * 3200;
      mote.y = (Math.random() - 0.5) * 3200;
      this.motes.push(mote);
      this.fxLayer.addChild(mote);
    }
  }

  setQuality(quality: QualityTier): void {
    this.quality = quality;
  }

  setMotionScale(scale: number): void {
    this.motionScale = Math.max(0, Math.min(1, scale));
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.app?.canvas ?? null;
  }

  render(world: GameWorld, _alpha: number, frameTimeMs: number): void {
    if (!this.app || !this.playerGraphic) return;

    const playerPos = world.getPlayerPosition();
    const baseCenterX = this.app.screen.width / 2;
    const baseCenterY = this.app.screen.height / 2;
    const shake = this.getShakeOffset(world, frameTimeMs);
    const centerX = baseCenterX + shake.x;
    const centerY = baseCenterY + shake.y;

    this.drawBackdrop(world, frameTimeMs);

    this.playerGraphic.position.set(centerX, centerY);

    this.syncEnemyGraphics(world, playerPos, centerX, centerY);
    this.syncProjectileGraphics(world, playerPos, centerX, centerY);
    this.syncEnemyProjectileGraphics(world, playerPos, centerX, centerY);
    this.syncHazardGraphics(world, playerPos, centerX, centerY, frameTimeMs);
    this.syncChestGraphics(world, playerPos, centerX, centerY, frameTimeMs);
    this.syncXpGraphics(world, playerPos, centerX, centerY);
    this.syncDashTelegraphs(world, playerPos, centerX, centerY);
    this.syncPlayerAura(world, centerX, centerY, frameTimeMs);
    this.syncScreenOverlay(world, frameTimeMs);
    this.updateEnemyHitPulses(frameTimeMs);
    this.updateAmbientMotes(playerPos, frameTimeMs);
    this.updateWebGpuFx(world, frameTimeMs);
  }

  private drawBackdrop(world: GameWorld, frameTimeMs: number): void {
    if (!this.app || !this.backdropGraphic) return;

    const g = this.backdropGraphic;
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const eventColor = EVENT_AURA_COLORS[world.activeEventId ?? ''] ?? 0x24452c;
    const timeWave = this.reducedMotion ? 0 : Math.sin(performance.now() * 0.0006) * 0.04 * this.motionScale;

    g.clear();
    g.rect(0, 0, w, h);
    g.fill({ color: 0x050c08, alpha: 1 });

    g.rect(0, 0, w, h * 0.45);
    g.fill({ color: 0x173321, alpha: 0.45 + timeWave * 0.4 });

    g.circle(w * 0.22, h * 0.18, Math.max(w, h) * 0.34);
    g.fill({ color: 0x2b5736, alpha: 0.16 });

    g.circle(w * 0.78, h * 0.12, Math.max(w, h) * 0.3);
    g.fill({ color: eventColor, alpha: world.activeEventId ? 0.15 : 0.05 });

    const stripeCount = this.quality === 'high' ? 10 : 5;
    for (let i = 0; i < stripeCount; i += 1) {
      const y = (h / stripeCount) * i + ((performance.now() * 0.01 + i * 18) % 24);
      g.rect(0, y, w, 1.5 + (i % 3));
      g.fill({ color: 0x143023, alpha: 0.18 });
    }

    if (!this.reducedMotion && frameTimeMs < 45 && this.quality !== 'low') {
      const gridSpacing = this.quality === 'high' ? 120 : 180;
      for (let x = -gridSpacing; x < w + gridSpacing; x += gridSpacing) {
        g.rect(x, 0, 1, h);
        g.fill({ color: 0x2d5237, alpha: 0.08 });
      }
    }
  }

  private getShakeOffset(world: GameWorld, frameTimeMs: number): { x: number; y: number } {
    if (this.reducedMotion || this.quality === 'low' || this.motionScale <= 0) return { x: 0, y: 0 };
    if (world.damageFlashTimer <= 0) return { x: 0, y: 0 };

    const intensity =
      Math.min(1, world.damageFlashTimer / 0.2) * (this.quality === 'high' ? 7 : 4) * this.motionScale;
    const t = performance.now() * (0.02 + frameTimeMs * 0.00001);
    return {
      x: Math.sin(t * 3.7) * intensity,
      y: Math.cos(t * 2.9) * intensity
    };
  }

  private syncPlayerAura(world: GameWorld, centerX: number, centerY: number, frameTimeMs: number): void {
    if (!this.playerAuraGraphic) return;
    const aura = this.playerAuraGraphic;

    const highMotion = !this.reducedMotion && this.quality !== 'low' && this.motionScale > 0;
    const eventColor = world.activeEventId ? EVENT_AURA_COLORS[world.activeEventId] || 0xe2ffc8 : 0xe2ffc8;
    const damagePulse = Math.max(0, Math.min(1, world.damageFlashTimer / 0.2));
    const baseRadius = 23 + (highMotion ? Math.sin(performance.now() * 0.006) * 3 * this.motionScale : 0);
    const auraRadius = baseRadius + damagePulse * (2 + 2 * this.motionScale);

    aura.clear();
    aura.circle(centerX, centerY, auraRadius);
    aura.stroke({ width: 2.2, color: eventColor, alpha: 0.16 + damagePulse * 0.24 });

    if (highMotion && frameTimeMs < 40) {
      aura.circle(centerX, centerY, auraRadius + 9);
      aura.stroke({ width: 1.2, color: eventColor, alpha: 0.09 + damagePulse * 0.2 });
    }
  }

  private syncDashTelegraphs(world: GameWorld, camera: { x: number; y: number }, centerX: number, centerY: number): void {
    if (!this.dashTelegraphGraphic) return;
    this.dashTelegraphGraphic.clear();

    for (const enemyId of world.enemies) {
      const component = world.enemyComponents.get(enemyId);
      const pos = world.positions.get(enemyId);
      if (!component || !pos || component.dashWindup <= 0) continue;

      const archetype = ENEMY_ARCHETYPES[component.archetypeId];
      const dash = archetype?.dash;
      if (!dash) continue;

      const progress = 1 - component.dashWindup / dash.windup;
      const sx = pos.x - camera.x + centerX;
      const sy = pos.y - camera.y + centerY;
      const lineLength = 130 + progress * 240;
      const ex = sx + component.dashDirection.x * lineLength;
      const ey = sy + component.dashDirection.y * lineLength;
      const alpha = 0.2 + progress * 0.45;
      const pulse = 0.9 + (Math.sin(performance.now() * 0.02 + enemyId) * 0.08 + 0.08);

      this.dashTelegraphGraphic.moveTo(sx, sy);
      this.dashTelegraphGraphic.lineTo(ex, ey);
      this.dashTelegraphGraphic.stroke({ width: 2.4 + progress * 2.8, color: 0xffe5b2, alpha });

      this.dashTelegraphGraphic.circle(sx, sy, (world.radii.get(enemyId) ?? 14) * pulse + progress * 18);
      this.dashTelegraphGraphic.stroke({ width: 1.4, color: 0xffc889, alpha: alpha * 0.88 });
    }
  }

  private syncScreenOverlay(world: GameWorld, frameTimeMs: number): void {
    if (!this.app || !this.damageVignette || !this.eventAuraGraphic || !this.impactGlowGraphic) return;

    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const centerX = w / 2;
    const centerY = h / 2;

    const auraColor = world.activeEventId ? EVENT_AURA_COLORS[world.activeEventId] || 0xcde8a5 : 0xcde8a5;
    const eventStrength = world.activeEventId ? 1 : 0;
    const auraAlphaBase = this.quality === 'high' ? 0.14 : this.quality === 'medium' ? 0.1 : 0.06;
    const pulse = this.reducedMotion ? 0 : Math.sin(performance.now() * 0.0015) * 0.03 * this.motionScale;
    const auraAlpha = eventStrength > 0 ? Math.max(0, auraAlphaBase + pulse) : 0;

    this.eventAuraGraphic.clear();
    if (auraAlpha > 0.001) {
      this.eventAuraGraphic.rect(0, 0, w, h);
      this.eventAuraGraphic.fill({ color: auraColor, alpha: auraAlpha * 0.24 });
      this.eventAuraGraphic.circle(centerX, centerY, Math.max(w, h) * 0.46);
      this.eventAuraGraphic.fill({ color: auraColor, alpha: auraAlpha * 0.9 });
    }

    const damageRatio = Math.max(0, Math.min(1, world.damageFlashTimer / 0.2));
    const vignetteAlpha = damageRatio * (this.quality === 'high' ? 0.32 : 0.24);
    this.damageVignette.clear();
    if (vignetteAlpha > 0.001) {
      this.damageVignette.rect(0, 0, w, h);
      this.damageVignette.fill({ color: 0xff9d91, alpha: vignetteAlpha });

      if (!this.reducedMotion && frameTimeMs < 45) {
        this.damageVignette.circle(centerX, centerY, Math.max(w, h) * 0.25);
        this.damageVignette.fill({ color: 0xffd0c0, alpha: vignetteAlpha * 0.38 });
      }
    }

    const impactRatio = Math.max(0, Math.min(1, world.impactFlashTimer / 0.16));
    this.impactGlowGraphic.clear();
    if (impactRatio > 0.001) {
      const color = world.rendererKind === 'webgpu' ? 0xd9ffc0 : 0xc5eab1;
      const alpha = impactRatio * (this.quality === 'high' ? 0.24 : 0.16);
      this.impactGlowGraphic.rect(0, 0, w, h);
      this.impactGlowGraphic.fill({ color, alpha });
    }
  }

  private updateEnemyHitPulses(frameTimeMs: number): void {
    if (this.enemyHitPulse.size === 0) return;
    const decay = Math.max(0.01, frameTimeMs / 1000);

    for (const [enemyId, timer] of this.enemyHitPulse.entries()) {
      const next = timer - decay;
      if (next <= 0) {
        this.enemyHitPulse.delete(enemyId);
      } else {
        this.enemyHitPulse.set(enemyId, next);
      }
    }
  }

  private syncEnemyGraphics(world: GameWorld, camera: { x: number; y: number }, centerX: number, centerY: number): void {
    for (const enemyId of world.enemies) {
      let graphic = this.enemyGraphics.get(enemyId);
      const pos = world.positions.get(enemyId);
      const enemyComp = world.enemyComponents.get(enemyId);
      const radius = world.radii.get(enemyId) ?? 12;
      const hp = world.health.get(enemyId)?.hp;

      if (!pos || !enemyComp) continue;

      const archetype = ENEMY_ARCHETYPES[enemyComp.archetypeId];
      const fillColor = archetype ? archetype.colorHex : 0x6e9369;
      const isElite = Boolean(archetype?.isElite);
      const role = archetype?.role ?? 'swarmer';

      if (!graphic) {
        const strokeColor = isElite ? 0xfff5b8 : 0xf0ffe8;
        graphic = createEnemyGraphic(role, radius, fillColor, strokeColor, isElite);
        this.enemyGraphics.set(enemyId, graphic);
        this.worldLayer.addChild(graphic);
      }

      const previousHp = this.enemyPrevHp.get(enemyId);
      if (previousHp !== undefined && hp !== undefined && hp < previousHp) {
        this.enemyHitPulse.set(enemyId, 0.14);
      }
      if (hp !== undefined) {
        this.enemyPrevHp.set(enemyId, hp);
      }

      const hitPulse = this.enemyHitPulse.get(enemyId) ?? 0;
      const windupPulse = enemyComp.dashWindup > 0 ? (enemyComp.dashWindup / 0.6) * 0.25 : 0;
      graphic.position.set(pos.x - camera.x + centerX, pos.y - camera.y + centerY);
      graphic.alpha = this.quality === 'low' ? 0.9 + hitPulse * 0.36 : 0.95 + hitPulse * 0.45;
      graphic.scale.set(1 + hitPulse * 1.05 + windupPulse + (isElite ? 0.06 : 0));
    }

    for (const [enemyId, graphic] of this.enemyGraphics.entries()) {
      if (world.enemies.has(enemyId)) continue;
      graphic.destroy();
      this.enemyGraphics.delete(enemyId);
      this.enemyPrevHp.delete(enemyId);
      this.enemyHitPulse.delete(enemyId);
    }
  }

  private syncProjectileGraphics(
    world: GameWorld,
    camera: { x: number; y: number },
    centerX: number,
    centerY: number
  ): void {
    for (const projectileId of world.projectiles) {
      let graphic = this.projectileGraphics.get(projectileId);
      const pos = world.positions.get(projectileId);
      const radius = world.radii.get(projectileId) ?? 5;
      const projectile = world.projectileComponents.get(projectileId);
      if (!pos || !projectile) continue;

      if (!graphic) {
        graphic = createCircleGraphic(radius, projectile.colorHex, 0xffffff, 1);
        this.projectileGraphics.set(projectileId, graphic);
        this.combatLayer.addChild(graphic);
      }

      graphic.position.set(pos.x - camera.x + centerX, pos.y - camera.y + centerY);
      const lifeRatio = Math.max(0, 1 - projectile.age / projectile.lifetime);
      graphic.alpha = this.quality === 'low' ? 0.66 + lifeRatio * 0.24 : 0.75 + lifeRatio * 0.32;
      graphic.scale.set(0.86 + lifeRatio * 0.3);
    }

    for (const [projectileId, graphic] of this.projectileGraphics.entries()) {
      if (world.projectiles.has(projectileId)) continue;
      graphic.destroy();
      this.projectileGraphics.delete(projectileId);
    }
  }

  private syncEnemyProjectileGraphics(
    world: GameWorld,
    camera: { x: number; y: number },
    centerX: number,
    centerY: number
  ): void {
    for (const projectileId of world.enemyProjectiles) {
      let graphic = this.enemyProjectileGraphics.get(projectileId);
      const pos = world.positions.get(projectileId);
      const radius = world.radii.get(projectileId) ?? 6;
      const projectile = world.enemyProjectileComponents.get(projectileId);
      if (!pos || !projectile) continue;

      if (!graphic) {
        graphic = createCircleGraphic(radius, 0xbbd588, 0xf2ffd9, 1.2);
        this.enemyProjectileGraphics.set(projectileId, graphic);
        this.combatLayer.addChild(graphic);
      }

      const lifeRatio = Math.max(0, 1 - projectile.age / projectile.lifetime);
      const pulse = this.reducedMotion ? 1 : 0.95 + Math.sin(performance.now() * 0.014 + projectileId) * 0.11;
      graphic.position.set(pos.x - camera.x + centerX, pos.y - camera.y + centerY);
      graphic.alpha = 0.58 + lifeRatio * 0.36;
      graphic.scale.set((0.84 + lifeRatio * 0.25) * pulse);
    }

    for (const [projectileId, graphic] of this.enemyProjectileGraphics.entries()) {
      if (world.enemyProjectiles.has(projectileId)) continue;
      graphic.destroy();
      this.enemyProjectileGraphics.delete(projectileId);
    }
  }

  private syncHazardGraphics(
    world: GameWorld,
    camera: { x: number; y: number },
    centerX: number,
    centerY: number,
    frameTimeMs: number
  ): void {
    for (const hazardId of world.hazards) {
      let graphic = this.hazardGraphics.get(hazardId);
      const pos = world.positions.get(hazardId);
      const radius = world.radii.get(hazardId) ?? 42;
      const hazard = world.hazardComponents.get(hazardId);
      if (!pos || !hazard) continue;

      if (!graphic) {
        graphic = new Graphics();
        this.hazardGraphics.set(hazardId, graphic);
        this.combatLayer.addChild(graphic);
      }

      const lifeRatio = Math.max(0, 1 - hazard.age / hazard.lifetime);
      const pulse = this.reducedMotion ? 0 : Math.sin((performance.now() + hazardId) * 0.006) * 0.09;
      const halo = radius * (0.92 + pulse * this.motionScale);
      const inner = radius * 0.56;
      const x = pos.x - camera.x + centerX;
      const y = pos.y - camera.y + centerY;

      graphic.clear();
      graphic.circle(x, y, halo);
      graphic.fill({ color: 0x9ecb78, alpha: (0.1 + 0.12 * lifeRatio) * (this.quality === 'low' ? 0.72 : 1) });
      graphic.circle(x, y, inner);
      graphic.fill({ color: 0xeeffd7, alpha: 0.1 + 0.16 * lifeRatio });
      graphic.circle(x, y, radius * (1.02 + (frameTimeMs < 45 ? 0.03 : 0)));
      graphic.stroke({ width: 1.3, color: 0xf3ffd5, alpha: 0.28 * lifeRatio });
    }

    for (const [hazardId, graphic] of this.hazardGraphics.entries()) {
      if (world.hazards.has(hazardId)) continue;
      graphic.destroy();
      this.hazardGraphics.delete(hazardId);
    }
  }

  private syncChestGraphics(
    world: GameWorld,
    camera: { x: number; y: number },
    centerX: number,
    centerY: number,
    frameTimeMs: number
  ): void {
    for (const chestId of world.chests) {
      let graphic = this.chestGraphics.get(chestId);
      const pos = world.positions.get(chestId);
      const radius = world.radii.get(chestId) ?? 18;
      if (!pos) continue;

      if (!graphic) {
        graphic = new Graphics();
        this.chestGraphics.set(chestId, graphic);
        this.worldLayer.addChild(graphic);
      }

      const pulse = this.reducedMotion ? 1 : 1 + Math.sin((performance.now() + chestId) * 0.005) * 0.09;
      const x = pos.x - camera.x + centerX;
      const y = pos.y - camera.y + centerY;
      const glow = radius * (2.2 + (frameTimeMs < 45 ? 0.2 : 0));

      graphic.clear();
      graphic.circle(x, y, glow * pulse);
      graphic.fill({ color: 0xffd57f, alpha: 0.1 });
      graphic.rect(x - radius, y - radius, radius * 2, radius * 2);
      graphic.fill({ color: 0x5f451f, alpha: 1 });
      graphic.stroke({ width: 2, color: 0xffe6a2, alpha: 0.9 });
      graphic.rect(x - radius * 0.26, y - radius, radius * 0.52, radius * 2);
      graphic.fill({ color: 0xd8b671, alpha: 1 });
    }

    for (const [chestId, graphic] of this.chestGraphics.entries()) {
      if (world.chests.has(chestId)) continue;
      graphic.destroy();
      this.chestGraphics.delete(chestId);
    }
  }

  private syncXpGraphics(world: GameWorld, camera: { x: number; y: number }, centerX: number, centerY: number): void {
    for (const xpId of world.xpOrbs) {
      let graphic = this.xpGraphics.get(xpId);
      const pos = world.positions.get(xpId);
      if (!pos) continue;

      if (!graphic) {
        graphic = createCircleGraphic(6, 0xb6df9a, 0xecffd9, 1);
        this.xpGraphics.set(xpId, graphic);
        this.worldLayer.addChild(graphic);
      }

      graphic.position.set(pos.x - camera.x + centerX, pos.y - camera.y + centerY);
      graphic.alpha = this.quality === 'low' ? 0.84 : 1;
      if (this.quality === 'high' && !this.reducedMotion && this.motionScale > 0) {
        const wobble = 1 + Math.sin((xpId + performance.now() * 0.006) * 0.8) * 0.08 * this.motionScale;
        graphic.scale.set(wobble);
      } else {
        graphic.scale.set(this.quality === 'high' ? 1.04 : 1);
      }
    }

    for (const [xpId, graphic] of this.xpGraphics.entries()) {
      if (world.xpOrbs.has(xpId)) continue;
      graphic.destroy();
      this.xpGraphics.delete(xpId);
    }
  }

  private updateAmbientMotes(playerPos: { x: number; y: number }, frameTimeMs: number): void {
    if (this.motes.length === 0) return;

    const shouldShow = this.quality !== 'low';
    const isWebGpu = this.rendererKind === 'webgpu';
    const activeMotes = this.quality === 'high'
      ? this.motes.length
      : Math.floor(this.motes.length * (isWebGpu ? 0.62 : 0.45));

    for (let i = 0; i < this.motes.length; i += 1) {
      const mote = this.motes[i];
      mote.visible = shouldShow && i < activeMotes;
      if (!mote.visible) continue;

      const drift = frameTimeMs * 0.005 * this.motionScale * (isWebGpu ? 1.35 : 1);
      mote.x += Math.sin((i + performance.now() * 0.0003) * 0.8) * drift;
      mote.y += Math.cos((i + performance.now() * 0.00025) * 0.9) * drift;

      if (mote.x > playerPos.x + 1500) mote.x -= 3000;
      if (mote.x < playerPos.x - 1500) mote.x += 3000;
      if (mote.y > playerPos.y + 1500) mote.y -= 3000;
      if (mote.y < playerPos.y - 1500) mote.y += 3000;
    }
  }

  private updateWebGpuFx(world: GameWorld, frameTimeMs: number): void {
    if (!this.webgpuNoiseFilter || this.rendererKind !== 'webgpu') return;
    if (this.reducedMotion || this.motionScale <= 0) {
      this.webgpuNoiseFilter.noise = 0.01;
      return;
    }

    const targetNoise = this.quality === 'high' ? 0.064 : this.quality === 'medium' ? 0.042 : 0.02;
    const eventBoost = world.activeEventId ? 0.02 : 0;
    this.webgpuNoiseFilter.noise = (targetNoise + eventBoost) * Math.max(0.24, this.motionScale);
    this.webgpuNoiseFilter.seed = (performance.now() * 0.00002 + frameTimeMs * 0.0005) % 1;
  }

  destroy(): void {
    for (const graphic of this.enemyGraphics.values()) graphic.destroy();
    for (const graphic of this.projectileGraphics.values()) graphic.destroy();
    for (const graphic of this.enemyProjectileGraphics.values()) graphic.destroy();
    for (const graphic of this.hazardGraphics.values()) graphic.destroy();
    for (const graphic of this.chestGraphics.values()) graphic.destroy();
    for (const graphic of this.xpGraphics.values()) graphic.destroy();

    this.enemyGraphics.clear();
    this.enemyPrevHp.clear();
    this.enemyHitPulse.clear();
    this.projectileGraphics.clear();
    this.enemyProjectileGraphics.clear();
    this.hazardGraphics.clear();
    this.chestGraphics.clear();
    this.xpGraphics.clear();

    this.backdropLayer.removeChildren();
    this.worldLayer.removeChildren();
    this.fxLayer.removeChildren();
    this.combatLayer.removeChildren();
    this.overlayLayer.removeChildren();
    this.hudLayer.removeChildren();

    if (this.app) {
      this.app.destroy(true, { children: true });
      this.app = null;
    }

    if (this.mountEl) {
      this.mountEl.innerHTML = '';
    }

    this.backdropGraphic = null;
    this.playerGraphic = null;
    this.playerAuraGraphic = null;
    this.damageVignette = null;
    this.eventAuraGraphic = null;
    this.impactGlowGraphic = null;
    this.dashTelegraphGraphic = null;
    this.motes = [];
    this.reducedMotion = false;
    this.motionScale = 1;
    this.webgpuNoiseFilter = null;
    this.webgpuGradeFilter = null;
  }
}
