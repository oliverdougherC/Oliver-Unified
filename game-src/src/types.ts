export type RendererKind = 'webgpu' | 'webgl';
export type RendererPreference = 'auto' | RendererKind;
export type QualityTier = 'high' | 'medium' | 'low';
export type UIState = 'boot' | 'playing' | 'paused' | 'levelup' | 'gameover';
export type EntityKind = 'player' | 'enemy' | 'projectile' | 'enemy_projectile' | 'xp' | 'hazard';
export type EnemyBehavior = 'chaser' | 'dash_striker' | 'spitter';

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
  damage: number;
  fireCooldown: number;
  projectileSpeed: number;
  projectileLifetime: number;
  projectileRadius: number;
  pierce: number;
  range: number;
}

export interface EnemyArchetype {
  id: string;
  name: string;
  behavior: EnemyBehavior;
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

export interface PlayerStats {
  maxHp: number;
  hp: number;
  moveSpeed: number;
  pickupRadius: number;
  regenPerSecond: number;
  contactInvuln: number;
  weapon: WeaponArchetype;
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
  metaEnabled: boolean;
  audioEnabled: boolean;
  audioVolume: number;
  motionScale: number;
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
  getCanvas(): HTMLCanvasElement | null;
  destroy(): void;
}
