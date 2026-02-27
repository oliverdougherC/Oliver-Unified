import type { ISystem, Vec2 } from '../types';
import { GameWorld } from '../core/world';
import { ENEMY_ARCHETYPES } from '../data/enemies';
import { getWaveStageAt } from '../data/waves';

const ELITE_VARIANTS: Record<string, string> = {
  moss_hound: 'moss_hound_elite',
  thorn_sentinel: 'thorn_sentinel_elite',
  briar_lancer: 'thorn_sentinel_elite'
};

function spawnOffsetAroundPlayer(world: GameWorld): Vec2 {
  const angle = world.rng.float(0, Math.PI * 2);
  const distance = world.rng.float(460, 760);

  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance
  };
}

function eliteSpawnChance(runTimeSeconds: number): number {
  if (runTimeSeconds < 210) return 0;
  const normalized = Math.min(1, (runTimeSeconds - 210) / 700);
  return 0.04 + normalized * 0.14;
}

function pickThreatAwareArchetype(
  world: GameWorld,
  weights: Record<string, number>,
  remainingThreat: number
): string | null {
  const filtered: Record<string, number> = {};
  for (const [archetypeId, weight] of Object.entries(weights)) {
    if (weight <= 0) continue;
    const archetype = ENEMY_ARCHETYPES[archetypeId];
    if (!archetype) continue;
    if (archetype.threat <= remainingThreat + 0.35) {
      filtered[archetypeId] = weight;
    }
  }

  if (Object.keys(filtered).length === 0) return null;
  return world.rng.weightedKey(filtered);
}

export class SpawnSystem implements ISystem<GameWorld> {
  update(dt: number, world: GameWorld): void {
    const stage = getWaveStageAt(world.runTime);
    const spawnInterval = stage.spawnInterval * world.spawnIntervalScale;
    world.spawnAccumulator += dt;

    const eliteCap = Math.max(1, Math.floor(stage.maxConcurrent * 0.12));
    let eliteCount = 0;
    for (const component of world.enemyComponents.values()) {
      const archetype = ENEMY_ARCHETYPES[component.archetypeId];
      if (archetype?.isElite) eliteCount += 1;
    }

    let currentThreat = world.getCurrentEnemyThreat();
    world.threatLevel = currentThreat;

    while (
      world.spawnAccumulator >= spawnInterval &&
      world.getEnemyCount() < stage.maxConcurrent &&
      currentThreat < stage.threatCap
    ) {
      world.spawnAccumulator -= spawnInterval;

      const remainingThreat = stage.threatCap - currentThreat;
      const baseArchetypeId = pickThreatAwareArchetype(world, stage.weights, remainingThreat);
      if (!baseArchetypeId) continue;

      let archetypeId = baseArchetypeId;
      let archetype = ENEMY_ARCHETYPES[archetypeId];
      if (!archetype) continue;

      const eliteVariantId = ELITE_VARIANTS[baseArchetypeId];
      if (
        eliteVariantId &&
        eliteCount < eliteCap &&
        world.rng.next() < eliteSpawnChance(world.runTime)
      ) {
        const eliteArchetype = ENEMY_ARCHETYPES[eliteVariantId];
        if (eliteArchetype && eliteArchetype.threat <= remainingThreat + 0.25) {
          archetypeId = eliteVariantId;
          archetype = eliteArchetype;
          eliteCount += 1;
        }
      }

      if (archetype.threat > remainingThreat + 0.35) {
        continue;
      }

      const playerPos = world.getPlayerPosition();
      const offset = spawnOffsetAroundPlayer(world);
      world.spawnEnemy(archetypeId, {
        x: playerPos.x + offset.x,
        y: playerPos.y + offset.y
      });

      currentThreat += archetype.threat;
      world.threatLevel = currentThreat;
    }
  }
}
