export type RendererKind = 'webgpu' | 'webgl';
export type RendererPreference = 'auto' | RendererKind;
export type QualityTier = 'high' | 'medium' | 'low';
export type UIState = 'boot' | 'playing' | 'paused' | 'levelup' | 'chest' | 'gameover';
export type VisualPreset = 'bioluminescent';
export type ColorVisionMode = 'normal' | 'deuteranopia' | 'protanopia' | 'tritanopia';
export type RenderBudgetTier = 'ultra' | 'high' | 'medium' | 'low' | 'minimal';

export type EntityKind =
  | 'player'
  | 'enemy'
  | 'projectile'
  | 'enemy_projectile'
  | 'xp'
  | 'hazard'
  | 'chest';

export type ItemKind = 'weapon' | 'catalyst' | 'evolution';
export type WeaponPattern = 'single' | 'fan' | 'ring' | 'burst' | 'spiral' | 'heavy' | 'orbit';
export type EnemyBehavior = 'chaser' | 'dash_striker' | 'spitter';
export type EnemyRole = 'swarmer' | 'charger' | 'bruiser' | 'tank' | 'sniper' | 'summoner' | 'disruptor';
export type VisualRole =
  | 'player'
  | 'enemy_role'
  | 'enemy_elite'
  | 'player_projectile'
  | 'enemy_projectile'
  | 'xp_orb'
  | 'hazard'
  | 'chest'
  | 'telegraph';

export interface Vec2 {
  x: number;
  y: number;
}

export interface GameConfig {
  fieldWidth: number;
  fieldHeight: number;
  fixedDelta: number;
  maxDelta: number;
  enemyDespawnRadius: number;
  collisionCellSize: number;
  maxNarrowPhaseChecks: number;
}

export interface WeaponArchetype {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  pattern: WeaponPattern;
  baseDamage: number;
  damagePerRank: number;
  baseCooldown: number;
  cooldownScalePerRank: number;
  projectileSpeed: number;
  projectileLifetime: number;
  projectileRadius: number;
  basePierce: number;
  piercePerRank: number;
  range: number;
  projectilesPerAttack: number;
  spreadAngleDeg: number;
  colorHex: number;
  isEvolution?: boolean;
  evolvedFrom?: string;
}

export type CatalystEffect =
  | { type: 'max_hp'; amount: number }
  | { type: 'heal'; amount: number }
  | { type: 'move_speed'; amount: number }
  | { type: 'pickup_radius'; amount: number }
  | { type: 'regen'; amount: number }
  | { type: 'global_damage_mult'; amount: number }
  | { type: 'global_cooldown_mult'; amount: number }
  | { type: 'projectile_speed_mult'; amount: number }
  | { type: 'crit_chance'; amount: number }
  | { type: 'crit_damage'; amount: number }
  | { type: 'armor'; amount: number };

export interface CatalystDefinition {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic';
  weight: number;
  maxRank: number;
  effects: CatalystEffect[];
}

export interface EvolutionRecipe {
  id: string;
  weaponId: string;
  catalystId: string;
  evolvedWeaponId: string;
  minTimeSeconds: number;
}

export interface InventorySlot {
  slotIndex: number;
  itemId: string | null;
  rank: number;
  isEvolved: boolean;
}

export interface LevelUpChoice {
  id: string;
  title: string;
  description: string;
  choiceType: 'new_item' | 'upgrade_item' | 'stat_boost' | 'reroll';
  itemKind?: ItemKind;
  itemId?: string;
  slotIndex?: number;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  statBoost?: 'heal' | 'armor' | 'speed' | 'damage';
}

export interface ChestChoice {
  id: string;
  title: string;
  description: string;
  choiceType: 'evolve' | 'reward';
  slotIndex?: number;
  evolvedWeaponId?: string;
  rewardType?: 'xp_burst' | 'heal' | 'catalyst_boost';
}

export interface PlayerStats {
  maxHp: number;
  hp: number;
  moveSpeed: number;
  pickupRadius: number;
  regenPerSecond: number;
  contactInvuln: number;
  damageMultiplier: number;
  cooldownMultiplier: number;
  projectileSpeedMultiplier: number;
  critChance: number;
  critMultiplier: number;
  armor: number;
}

export interface EnemyArchetype {
  id: string;
  name: string;
  role: EnemyRole;
  behavior: EnemyBehavior;
  unlockTime: number;
  maxHp: number;
  radius: number;
  speed: number;
  touchDamage: number;
  xpDrop: number;
  threat: number;
  colorHex: number;
  weight: number;
  isElite?: boolean;
  dash?: {
    cooldown: number;
    windup: number;
    duration: number;
    speedMultiplier: number;
    triggerRange: number;
  };
  spit?: {
    cooldown: number;
    range: number;
    projectileSpeed: number;
    projectileLifetime: number;
    projectileRadius: number;
    projectileDamage: number;
    hazardRadius: number;
    hazardDuration: number;
    hazardDamagePerSecond: number;
  };
}

export interface WaveStage {
  id: string;
  startTime: number;
  endTime: number;
  spawnInterval: number;
  maxConcurrent: number;
  threatCap: number;
  weights: Record<string, number>;
}

export type UpgradeEffect =
  | { type: 'weapon_damage'; amount: number }
  | { type: 'fire_rate'; amount: number }
  | { type: 'projectile_speed'; amount: number }
  | { type: 'projectile_pierce'; amount: number }
  | { type: 'max_hp'; amount: number }
  | { type: 'heal'; amount: number }
  | { type: 'move_speed'; amount: number }
  | { type: 'pickup_radius'; amount: number }
  | { type: 'regen'; amount: number }
  | { type: 'projectile_lifetime'; amount: number };

export interface UpgradeOption {
  id: string;
  name: string;
  description: string;
  weight: number;
  effect: UpgradeEffect;
}

export interface DirectorBand {
  id: string;
  startTime: number;
  endTime: number;
  targetEnemiesMin: number;
  targetEnemiesMax: number;
  targetThreatMin: number;
  targetThreatMax: number;
  projectileHazardMin: number;
  projectileHazardMax: number;
  baseSpawnInterval: number;
}

export interface RunDirectorState {
  phaseId: string;
  intensity: number;
  heat: number;
  targetThreat: number;
  targetEnemies: number;
  lastEliteSpawnTime: number;
  nextGuaranteedEliteTime: number;
  antiLullTimer: number;
}

export interface RunSnapshot {
  seed: number;
  timeSeconds: number;
  level: number;
  kills: number;
  enemiesAlive: number;
  upgradesChosen: string[];
}

export interface QueryOptions {
  rendererPreference: RendererPreference;
  debugMode: boolean;
  seed: number;
  audioEnabled: boolean;
  audioVolume: number;
  motionScale: number;
  visualPreset: VisualPreset;
  colorVisionMode: ColorVisionMode;
  uiScale: number;
  screenShake: number;
  hazardOpacity: number;
  hitFlashStrength: number;
  showDamageNumbers: boolean;
  showDirectionalIndicators: boolean;
}

export interface VisualRuntimeSettings {
  visualPreset: VisualPreset;
  colorVisionMode: ColorVisionMode;
  motionScale: number;
  uiScale: number;
  screenShake: number;
  hazardOpacity: number;
  hitFlashStrength: number;
  showDamageNumbers: boolean;
  showDirectionalIndicators: boolean;
}

export interface RenderBudgetFlags {
  parallaxBackdrop: boolean;
  ambientMotes: boolean;
  secondaryGlows: boolean;
  trailFx: boolean;
  overlayNoise: boolean;
}

export interface RenderPerformanceSnapshot {
  budgetTier: RenderBudgetTier;
  frameTimeMs: number;
  smoothedFrameTimeMs: number;
  visibleEntities: number;
  culledEntities: number;
  drawCallsEstimate: number;
  timings: {
    backdropMs: number;
    entitiesMs: number;
    overlaysMs: number;
    hudSyncMs: number;
    totalMs: number;
  };
  rolling: {
    p50FrameMs: number;
    p95FrameMs: number;
  };
}

export interface VisualThemeTokens {
  player: { fill: number; stroke: number; aura: number };
  projectiles: { allied: number; alliedStroke: number; enemy: number; enemyStroke: number };
  pickups: { xpFill: number; xpStroke: number; chestFill: number; chestStroke: number };
  hazards: { fill: number; inner: number; stroke: number };
  telegraph: { line: number; ring: number };
  enemies: Record<EnemyRole, { fill: number; stroke: number }>;
  elite: { stroke: number; crown: number };
  backdrop: {
    floor: number;
    canopy: number;
    fog: number;
    vines: number;
    grade: number;
    eventTint: number;
  };
}

export interface IObjectPool<T> {
  acquire(): T;
  release(item: T): void;
  reset(): void;
  getStats(): { available: number; total: number };
}

export interface ISystem<TWorld> {
  update(dt: number, world: TWorld): void;
}

export interface IRenderAdapter<TWorld> {
  init(options: {
    mount: HTMLElement;
    requestedRenderer: RendererPreference;
    reducedMotion: boolean;
  }): Promise<RendererKind>;
  render(world: TWorld, alpha: number, frameTimeMs: number): void;
  setQuality(quality: QualityTier): void;
  setVisualSettings(settings: VisualRuntimeSettings): void;
  setHudSyncTime(hudSyncMs: number): void;
  getPerformanceSnapshot(): RenderPerformanceSnapshot;
  getCanvas(): HTMLCanvasElement | null;
  destroy(): void;
}
