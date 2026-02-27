import { ENEMY_ARCHETYPES } from '../data/enemies';
import { UPGRADE_OPTIONS } from '../data/upgrades';
import { ROOTSPARK_WAND } from '../data/weapons';
import type {
  EnemyArchetype,
  EnemyBehavior,
  EntityKind,
  GameConfig,
  PlayerStats,
  QualityTier,
  RendererKind,
  UIState,
  UpgradeOption,
  Vec2
} from '../types';
import { NumericIdPool } from './objectPool';
import { xpThresholdForLevel } from './progression';
import { SeededRng, normalizeSeed } from './rng';
import { SpatialHash } from './spatialHash';

interface EnemyComponent {
  archetypeId: string;
  behavior: EnemyBehavior;
  speed: number;
  touchDamage: number;
  xpDrop: number;
  dashCooldown: number;
  dashWindup: number;
  dashDuration: number;
  dashDirection: Vec2;
  spitCooldown: number;
}

interface ProjectileComponent {
  damage: number;
  age: number;
  lifetime: number;
  pierce: number;
}

interface EnemyProjectileComponent {
  damage: number;
  age: number;
  lifetime: number;
  hazardRadius: number;
  hazardDuration: number;
  hazardDamagePerSecond: number;
}

interface HazardComponent {
  damagePerSecond: number;
  age: number;
  lifetime: number;
}

interface XpComponent {
  value: number;
}

interface HealthComponent {
  hp: number;
  maxHp: number;
}

interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface EnemyProjectileSpawnConfig {
  speed: number;
  lifetime: number;
  radius: number;
  damage: number;
  hazardRadius: number;
  hazardDuration: number;
  hazardDamagePerSecond: number;
}

export interface HazardSpawnConfig {
  radius: number;
  duration: number;
  damagePerSecond: number;
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  fieldWidth: 5000,
  fieldHeight: 5000,
  fixedDelta: 1 / 60,
  maxDelta: 0.2,
  enemyDespawnRadius: 1500,
  collisionCellSize: 96,
  maxNarrowPhaseChecks: 5000
};

function createDefaultPlayerStats(): PlayerStats {
  return {
    maxHp: 130,
    hp: 130,
    moveSpeed: 260,
    pickupRadius: 84,
    regenPerSecond: 0,
    contactInvuln: 0.35,
    weapon: { ...ROOTSPARK_WAND }
  };
}

function randomCooldown(rng: SeededRng, base: number): number {
  return rng.float(base * 0.45, base * 1.15);
}

export class GameWorld {
  readonly config: GameConfig;
  readonly enemyHash: SpatialHash;
  readonly xpHash: SpatialHash;
  readonly hazardHash: SpatialHash;

  readonly entities = new Set<number>();
  readonly entityKind = new Map<number, EntityKind>();
  readonly positions = new Map<number, Vec2>();
  readonly velocities = new Map<number, Vec2>();
  readonly radii = new Map<number, number>();
  readonly health = new Map<number, HealthComponent>();
  readonly enemies = new Set<number>();
  readonly enemyComponents = new Map<number, EnemyComponent>();
  readonly projectiles = new Set<number>();
  readonly projectileComponents = new Map<number, ProjectileComponent>();
  readonly enemyProjectiles = new Set<number>();
  readonly enemyProjectileComponents = new Map<number, EnemyProjectileComponent>();
  readonly hazards = new Set<number>();
  readonly hazardComponents = new Map<number, HazardComponent>();
  readonly xpOrbs = new Set<number>();
  readonly xpComponents = new Map<number, XpComponent>();

  readonly enemyPool = new NumericIdPool(10_000);
  readonly projectilePool = new NumericIdPool(100_000);
  readonly enemyProjectilePool = new NumericIdPool(100_000);
  readonly hazardPool = new NumericIdPool(40_000);
  readonly xpPool = new NumericIdPool(200_000);

  readonly pendingRemoval = new Set<number>();

  readonly input: InputState = {
    up: false,
    down: false,
    left: false,
    right: false
  };

  readonly upgrades = UPGRADE_OPTIONS;
  readonly hazardTickInterval = 0.2;

  readonly playerId = 1;
  playerStats: PlayerStats = createDefaultPlayerStats();
  uiState: UIState = 'boot';
  quality: QualityTier = 'high';
  rendererKind: RendererKind | null = null;
  reducedMotion = false;

  rng: SeededRng;
  seed: number;
  runTime = 0;
  level = 1;
  xp = 0;
  xpToNext = xpThresholdForLevel(1);
  kills = 0;
  totalSpawns = 0;
  weaponCooldown = 0;
  contactCooldown = 0;
  hazardTickCooldown = 0;
  spawnAccumulator = 0;
  chosenUpgrades: string[] = [];
  pendingUpgradeChoices: UpgradeOption[] = [];
  activeEventId: string | null = null;
  enemySpeedScale = 1;
  spawnIntervalScale = 1;
  playerMoveSpeedScale = 1;
  enemyHealthScale = 1;
  enemyXpScale = 1;
  projectileDamageScale = 1;
  damageFlashTimer = 0;
  impactFlashTimer = 0;
  shotsFired = 0;
  enemyShotsFired = 0;
  levelUpOfferedCount = 0;
  playerHitCount = 0;
  hazardsCreated = 0;
  threatLevel = 0;

  constructor(seed: number, reducedMotion: boolean, config: Partial<GameConfig> = {}) {
    this.config = {
      ...DEFAULT_GAME_CONFIG,
      ...config
    };

    this.seed = normalizeSeed(seed);
    this.rng = new SeededRng(this.seed);
    this.reducedMotion = reducedMotion;
    this.enemyHash = new SpatialHash(this.config.collisionCellSize);
    this.xpHash = new SpatialHash(this.config.collisionCellSize);
    this.hazardHash = new SpatialHash(this.config.collisionCellSize);
  }

  setRendererKind(kind: RendererKind): void {
    this.rendererKind = kind;
  }

  setQuality(tier: QualityTier): void {
    this.quality = tier;
  }

  resetRun(seed = this.seed): void {
    this.seed = normalizeSeed(seed);
    this.rng = new SeededRng(this.seed);

    this.entities.clear();
    this.entityKind.clear();
    this.positions.clear();
    this.velocities.clear();
    this.radii.clear();
    this.health.clear();
    this.enemies.clear();
    this.enemyComponents.clear();
    this.projectiles.clear();
    this.projectileComponents.clear();
    this.enemyProjectiles.clear();
    this.enemyProjectileComponents.clear();
    this.hazards.clear();
    this.hazardComponents.clear();
    this.xpOrbs.clear();
    this.xpComponents.clear();
    this.pendingRemoval.clear();

    this.enemyHash.clear();
    this.hazardHash.clear();
    this.xpHash.clear();

    this.enemyPool.reset();
    this.projectilePool.reset();
    this.enemyProjectilePool.reset();
    this.hazardPool.reset();
    this.xpPool.reset();

    this.playerStats = createDefaultPlayerStats();
    this.uiState = 'playing';
    this.runTime = 0;
    this.level = 1;
    this.xp = 0;
    this.xpToNext = xpThresholdForLevel(1);
    this.kills = 0;
    this.totalSpawns = 0;
    this.weaponCooldown = 0;
    this.contactCooldown = 0;
    this.hazardTickCooldown = 0;
    this.spawnAccumulator = 0;
    this.chosenUpgrades = [];
    this.pendingUpgradeChoices = [];
    this.activeEventId = null;
    this.enemySpeedScale = 1;
    this.spawnIntervalScale = 1;
    this.playerMoveSpeedScale = 1;
    this.enemyHealthScale = 1;
    this.enemyXpScale = 1;
    this.projectileDamageScale = 1;
    this.damageFlashTimer = 0;
    this.impactFlashTimer = 0;
    this.shotsFired = 0;
    this.enemyShotsFired = 0;
    this.levelUpOfferedCount = 0;
    this.playerHitCount = 0;
    this.hazardsCreated = 0;
    this.threatLevel = 0;

    this.spawnPlayer();
  }

  private spawnPlayer(): void {
    this.entities.add(this.playerId);
    this.entityKind.set(this.playerId, 'player');
    this.positions.set(this.playerId, { x: 0, y: 0 });
    this.velocities.set(this.playerId, { x: 0, y: 0 });
    this.radii.set(this.playerId, 15);
    this.health.set(this.playerId, {
      hp: this.playerStats.hp,
      maxHp: this.playerStats.maxHp
    });
  }

  getPlayerPosition(): Vec2 {
    const pos = this.positions.get(this.playerId);
    if (!pos) return { x: 0, y: 0 };
    return pos;
  }

  getEnemyCount(): number {
    return this.enemies.size;
  }

  getCurrentEnemyThreat(): number {
    let total = 0;
    for (const component of this.enemyComponents.values()) {
      const archetype = ENEMY_ARCHETYPES[component.archetypeId];
      total += archetype?.threat ?? 1;
    }
    return total;
  }

  getSnapshot() {
    return {
      seed: this.seed,
      timeSeconds: this.runTime,
      level: this.level,
      kills: this.kills,
      enemiesAlive: this.enemies.size,
      upgradesChosen: [...this.chosenUpgrades]
    };
  }

  markForRemoval(entityId: number): void {
    if (entityId === this.playerId) return;
    this.pendingRemoval.add(entityId);
  }

  flushRemovals(): void {
    if (this.pendingRemoval.size === 0) return;

    for (const entityId of this.pendingRemoval) {
      const kind = this.entityKind.get(entityId);
      if (!kind) continue;

      this.entities.delete(entityId);
      this.entityKind.delete(entityId);
      this.positions.delete(entityId);
      this.velocities.delete(entityId);
      this.radii.delete(entityId);
      this.health.delete(entityId);

      if (kind === 'enemy') {
        this.enemies.delete(entityId);
        this.enemyComponents.delete(entityId);
        this.enemyPool.release(entityId);
      } else if (kind === 'projectile') {
        this.projectiles.delete(entityId);
        this.projectileComponents.delete(entityId);
        this.projectilePool.release(entityId);
      } else if (kind === 'enemy_projectile') {
        this.enemyProjectiles.delete(entityId);
        this.enemyProjectileComponents.delete(entityId);
        this.enemyProjectilePool.release(entityId);
      } else if (kind === 'hazard') {
        this.hazards.delete(entityId);
        this.hazardComponents.delete(entityId);
        this.hazardPool.release(entityId);
      } else if (kind === 'xp') {
        this.xpOrbs.delete(entityId);
        this.xpComponents.delete(entityId);
        this.xpPool.release(entityId);
      }
    }

    this.pendingRemoval.clear();
  }

  spawnEnemy(archetypeId: string, position: Vec2): number {
    const archetype: EnemyArchetype | undefined = ENEMY_ARCHETYPES[archetypeId];
    if (!archetype) {
      throw new Error(`Unknown enemy archetype: ${archetypeId}`);
    }

    const entityId = this.enemyPool.acquire();
    this.entities.add(entityId);
    this.entityKind.set(entityId, 'enemy');
    this.positions.set(entityId, { ...position });
    this.velocities.set(entityId, { x: 0, y: 0 });
    this.radii.set(entityId, archetype.radius);
    const scaledMaxHp = Math.max(1, Math.round(archetype.maxHp * this.enemyHealthScale));
    const scaledXpDrop = Math.max(1, Math.round(archetype.xpDrop * this.enemyXpScale));
    this.health.set(entityId, { hp: scaledMaxHp, maxHp: scaledMaxHp });
    this.enemies.add(entityId);
    this.enemyComponents.set(entityId, {
      archetypeId,
      behavior: archetype.behavior,
      speed: archetype.speed,
      touchDamage: archetype.touchDamage,
      xpDrop: scaledXpDrop,
      dashCooldown: archetype.dash ? randomCooldown(this.rng, archetype.dash.cooldown) : 0,
      dashWindup: 0,
      dashDuration: 0,
      dashDirection: { x: 0, y: 0 },
      spitCooldown: archetype.spit ? randomCooldown(this.rng, archetype.spit.cooldown) : 0
    });

    this.totalSpawns += 1;
    return entityId;
  }

  spawnProjectile(direction: Vec2): number {
    const playerPos = this.getPlayerPosition();
    const weapon = this.playerStats.weapon;
    const entityId = this.projectilePool.acquire();

    this.entities.add(entityId);
    this.entityKind.set(entityId, 'projectile');
    this.positions.set(entityId, { x: playerPos.x, y: playerPos.y });
    this.velocities.set(entityId, {
      x: direction.x * weapon.projectileSpeed,
      y: direction.y * weapon.projectileSpeed
    });
    this.radii.set(entityId, weapon.projectileRadius);
    this.projectiles.add(entityId);
    this.projectileComponents.set(entityId, {
      damage: weapon.damage * this.projectileDamageScale,
      age: 0,
      lifetime: weapon.projectileLifetime,
      pierce: weapon.pierce
    });

    this.shotsFired += 1;
    return entityId;
  }

  spawnEnemyProjectile(position: Vec2, direction: Vec2, config: EnemyProjectileSpawnConfig): number {
    const magnitude = Math.hypot(direction.x, direction.y);
    if (magnitude < 0.0001) {
      return -1;
    }

    const entityId = this.enemyProjectilePool.acquire();
    const vx = (direction.x / magnitude) * config.speed;
    const vy = (direction.y / magnitude) * config.speed;

    this.entities.add(entityId);
    this.entityKind.set(entityId, 'enemy_projectile');
    this.positions.set(entityId, { x: position.x, y: position.y });
    this.velocities.set(entityId, { x: vx, y: vy });
    this.radii.set(entityId, config.radius);
    this.enemyProjectiles.add(entityId);
    this.enemyProjectileComponents.set(entityId, {
      damage: config.damage,
      age: 0,
      lifetime: config.lifetime,
      hazardRadius: config.hazardRadius,
      hazardDuration: config.hazardDuration,
      hazardDamagePerSecond: config.hazardDamagePerSecond
    });

    this.enemyShotsFired += 1;
    return entityId;
  }

  spawnHazard(position: Vec2, config: HazardSpawnConfig): number {
    const entityId = this.hazardPool.acquire();

    this.entities.add(entityId);
    this.entityKind.set(entityId, 'hazard');
    this.positions.set(entityId, { ...position });
    this.velocities.set(entityId, { x: 0, y: 0 });
    this.radii.set(entityId, config.radius);
    this.hazards.add(entityId);
    this.hazardComponents.set(entityId, {
      damagePerSecond: config.damagePerSecond,
      age: 0,
      lifetime: config.duration
    });

    this.hazardsCreated += 1;
    this.impactFlashTimer = Math.max(this.impactFlashTimer, 0.16);
    return entityId;
  }

  spawnXpOrb(position: Vec2, value: number): number {
    const entityId = this.xpPool.acquire();

    this.entities.add(entityId);
    this.entityKind.set(entityId, 'xp');
    this.positions.set(entityId, { ...position });
    this.velocities.set(entityId, { x: 0, y: 0 });
    this.radii.set(entityId, 8);
    this.xpOrbs.add(entityId);
    this.xpComponents.set(entityId, { value });

    return entityId;
  }

  gainXp(amount: number): void {
    this.xp += Math.max(0, amount);
  }

  spendXpForLevel(): boolean {
    if (this.xp < this.xpToNext) return false;
    this.xp -= this.xpToNext;
    this.level += 1;
    this.xpToNext = xpThresholdForLevel(this.level);
    return true;
  }

  beginLevelUp(choices: UpgradeOption[]): void {
    this.pendingUpgradeChoices = choices;
    this.levelUpOfferedCount += 1;
    this.uiState = 'levelup';
  }

  applyUpgrade(optionId: string): void {
    const option = this.upgrades.find((entry) => entry.id === optionId);
    if (!option) return;

    const weapon = this.playerStats.weapon;

    switch (option.effect.type) {
      case 'weapon_damage':
        weapon.damage += option.effect.amount;
        break;
      case 'fire_rate':
        weapon.fireCooldown = Math.max(0.1, weapon.fireCooldown * (1 - option.effect.amount));
        break;
      case 'projectile_speed':
        weapon.projectileSpeed += option.effect.amount;
        break;
      case 'projectile_pierce':
        weapon.pierce += option.effect.amount;
        break;
      case 'max_hp':
        this.playerStats.maxHp += option.effect.amount;
        this.playerStats.hp = Math.min(this.playerStats.maxHp, this.playerStats.hp + option.effect.amount);
        break;
      case 'heal':
        this.playerStats.hp = Math.min(this.playerStats.maxHp, this.playerStats.hp + option.effect.amount);
        break;
      case 'move_speed':
        this.playerStats.moveSpeed += option.effect.amount;
        break;
      case 'pickup_radius':
        this.playerStats.pickupRadius += option.effect.amount;
        break;
      case 'regen':
        this.playerStats.regenPerSecond += option.effect.amount;
        break;
      case 'projectile_lifetime':
        weapon.projectileLifetime += option.effect.amount;
        break;
      default:
        break;
    }

    this.chosenUpgrades.push(option.id);
    this.pendingUpgradeChoices = [];
    this.uiState = 'playing';
  }

  applyPlayerRegen(dt: number): void {
    if (this.playerStats.regenPerSecond <= 0) return;
    this.playerStats.hp = Math.min(
      this.playerStats.maxHp,
      this.playerStats.hp + this.playerStats.regenPerSecond * dt
    );
  }

  applyPlayerDamage(amount: number): void {
    if (this.contactCooldown > 0 || this.uiState !== 'playing') return;

    this.playerStats.hp -= Math.max(0, amount);
    this.contactCooldown = this.playerStats.contactInvuln;
    this.damageFlashTimer = Math.max(this.damageFlashTimer, 0.2);
    this.playerHitCount += 1;

    if (this.playerStats.hp <= 0) {
      this.playerStats.hp = 0;
      this.uiState = 'gameover';
    }
  }

  applyHazardDamage(amount: number): void {
    if (this.hazardTickCooldown > 0 || this.uiState !== 'playing') return;

    this.playerStats.hp -= Math.max(0, amount);
    this.hazardTickCooldown = this.hazardTickInterval;
    this.damageFlashTimer = Math.max(this.damageFlashTimer, 0.14);
    this.playerHitCount += 1;

    if (this.playerStats.hp <= 0) {
      this.playerStats.hp = 0;
      this.uiState = 'gameover';
    }
  }

  updateCooldowns(dt: number): void {
    this.weaponCooldown = Math.max(0, this.weaponCooldown - dt);
    this.contactCooldown = Math.max(0, this.contactCooldown - dt);
    this.hazardTickCooldown = Math.max(0, this.hazardTickCooldown - dt);
    this.damageFlashTimer = Math.max(0, this.damageFlashTimer - dt);
    this.impactFlashTimer = Math.max(0, this.impactFlashTimer - dt);
  }

  toRunSummaryText(): string {
    return `Survived ${this.runTime.toFixed(1)}s | Lvl ${this.level} | Kills ${this.kills}`;
  }
}
