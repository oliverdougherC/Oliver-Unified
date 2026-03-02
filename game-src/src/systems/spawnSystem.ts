import type { EnemyRole, ISystem, Vec2 } from '../types';
import { GameWorld } from '../core/world';
import { getDirectorBand } from '../data/director';
import { ELITE_ENEMY_IDS, ENEMY_ARCHETYPES } from '../data/enemies';

const ROLE_TARGETS: Record<EnemyRole, number> = {
  swarmer: 0.25,
  charger: 0.2,
  bruiser: 0.14,
  tank: 0.1,
  sniper: 0.12,
  summoner: 0.1,
  disruptor: 0.09
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * t;
}

function spawnOffsetAroundPlayer(world: GameWorld): Vec2 {
  const angle = world.rng.float(0, Math.PI * 2);
  const distance = world.rng.float(520, 840);

  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance
  };
}

function countEnemiesByRole(world: GameWorld): Record<EnemyRole, number> {
  const out: Record<EnemyRole, number> = {
    swarmer: 0,
    charger: 0,
    bruiser: 0,
    tank: 0,
    sniper: 0,
    summoner: 0,
    disruptor: 0
  };

  for (const enemy of world.enemyComponents.values()) {
    const archetype = ENEMY_ARCHETYPES[enemy.archetypeId];
    if (!archetype) continue;
    out[archetype.role] += 1;
  }

  return out;
}

function pickEnemyArchetype(world: GameWorld, remainingThreat: number, forceElite: boolean): string | null {
  const roleCounts = countEnemiesByRole(world);
  const totalEnemies = Math.max(1, world.getEnemyCount());

  const candidates: Array<{ id: string; weight: number }> = [];

  for (const archetype of Object.values(ENEMY_ARCHETYPES)) {
    if (world.runTime < archetype.unlockTime) continue;
    if (archetype.threat > remainingThreat + 0.45) continue;

    if (forceElite && !archetype.isElite) continue;
    if (!forceElite && archetype.isElite) continue;

    const roleRatio = roleCounts[archetype.role] / totalEnemies;
    const targetRatio = ROLE_TARGETS[archetype.role];
    const roleBoost = roleRatio < targetRatio ? 1 + (targetRatio - roleRatio) * 3.2 : 0.8;

    const weight = Math.max(0.001, archetype.weight * roleBoost);
    candidates.push({ id: archetype.id, weight });
  }

  if (candidates.length === 0) {
    return null;
  }

  const totalWeight = candidates.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = world.rng.float(0, totalWeight);
  for (const entry of candidates) {
    roll -= entry.weight;
    if (roll <= 0) return entry.id;
  }

  return candidates[candidates.length - 1]?.id ?? null;
}

function shouldForceElite(world: GameWorld): boolean {
  if (world.runTime < 240) return false;

  const eliteCount = Array.from(world.enemyComponents.values()).filter((enemy) => {
    const archetype = ENEMY_ARCHETYPES[enemy.archetypeId];
    return Boolean(archetype?.isElite);
  }).length;

  if (world.runTime >= world.director.nextGuaranteedEliteTime && eliteCount < 2) {
    return true;
  }

  const ambientChance = clamp((world.runTime - 420) / 420, 0, 0.26);
  return eliteCount < 3 && world.rng.next() < ambientChance * world.director.intensity * 0.04;
}

export class SpawnSystem implements ISystem<GameWorld> {
  update(dt: number, world: GameWorld): void {
    const band = getDirectorBand(world.runTime);

    world.director.phaseId = band.id;

    const enemyCount = world.getEnemyCount();
    const currentThreat = world.getCurrentEnemyThreat();
    const hazardPressure = world.hazards.size + world.enemyProjectiles.size;

    if (enemyCount < band.targetEnemiesMin) {
      world.director.intensity = clamp(world.director.intensity + dt * 0.24, 0.2, 1);
      world.director.antiLullTimer += dt;
    } else if (enemyCount > band.targetEnemiesMax) {
      world.director.intensity = clamp(world.director.intensity - dt * 0.16, 0.2, 1);
      world.director.antiLullTimer = 0;
    } else {
      world.director.intensity = clamp(world.director.intensity + (world.rng.next() - 0.5) * dt * 0.02, 0.2, 1);
      world.director.antiLullTimer = Math.max(0, world.director.antiLullTimer - dt * 0.35);
    }

    if (hazardPressure < band.projectileHazardMin && world.runTime > 220) {
      world.director.heat = clamp(world.director.heat + dt * 0.42, 0, 1);
    } else if (hazardPressure > band.projectileHazardMax) {
      world.director.heat = clamp(world.director.heat - dt * 0.55, 0, 1);
    } else {
      world.director.heat = clamp(world.director.heat - dt * 0.08, 0, 1);
    }

    if (world.director.antiLullTimer > 5.4) {
      world.director.heat = clamp(world.director.heat + 0.2, 0, 1);
      world.director.antiLullTimer = 0;
    }

    const pressureBlend = clamp((world.director.intensity + world.director.heat * 0.6) / 1.6, 0, 1);
    world.director.targetEnemies = Math.round(
      lerp(band.targetEnemiesMin, band.targetEnemiesMax, pressureBlend)
    );
    world.director.targetThreat = lerp(band.targetThreatMin, band.targetThreatMax, pressureBlend);

    const spawnInterval =
      band.baseSpawnInterval *
      world.spawnIntervalScale *
      lerp(1.32, 0.7, pressureBlend);

    world.spawnAccumulator += dt;
    world.threatLevel = currentThreat;

    while (
      world.spawnAccumulator >= spawnInterval &&
      world.getEnemyCount() < world.director.targetEnemies + 6 &&
      world.getCurrentEnemyThreat() < world.director.targetThreat + 12
    ) {
      world.spawnAccumulator -= spawnInterval;

      const forceElite = shouldForceElite(world);
      const remainingThreat = world.director.targetThreat - world.getCurrentEnemyThreat();

      let archetypeId = pickEnemyArchetype(world, remainingThreat, forceElite);
      if (!archetypeId && forceElite) {
        archetypeId = ELITE_ENEMY_IDS[world.rng.int(0, ELITE_ENEMY_IDS.length - 1)] ?? null;
      }

      if (!archetypeId) continue;
      const archetype = ENEMY_ARCHETYPES[archetypeId];
      if (!archetype) continue;

      const playerPos = world.getPlayerPosition();
      const offset = spawnOffsetAroundPlayer(world);
      world.spawnEnemy(archetypeId, {
        x: playerPos.x + offset.x,
        y: playerPos.y + offset.y
      });

      if (archetype.isElite) {
        world.director.lastEliteSpawnTime = world.runTime;
        world.director.nextGuaranteedEliteTime = Math.max(
          world.director.nextGuaranteedEliteTime,
          world.runTime + 90
        );
      }
    }
  }
}
