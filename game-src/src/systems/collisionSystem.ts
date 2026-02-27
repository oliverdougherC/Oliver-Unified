import type { ISystem } from '../types';
import { GameWorld } from '../core/world';
import { ENEMY_ARCHETYPES } from '../data/enemies';

function circlesOverlap(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const rr = ar + br;
  return dx * dx + dy * dy <= rr * rr;
}

export class CollisionSystem implements ISystem<GameWorld> {
  update(_dt: number, world: GameWorld): void {
    world.enemyHash.clear();
    world.xpHash.clear();
    world.hazardHash.clear();
    world.chestHash.clear();

    for (const enemyId of world.enemies) {
      const pos = world.positions.get(enemyId);
      const radius = world.radii.get(enemyId);
      if (!pos || radius === undefined) continue;
      world.enemyHash.insert(enemyId, pos, radius);
    }

    for (const xpId of world.xpOrbs) {
      const pos = world.positions.get(xpId);
      const radius = world.radii.get(xpId);
      if (!pos || radius === undefined) continue;
      world.xpHash.insert(xpId, pos, radius);
    }

    for (const hazardId of world.hazards) {
      const pos = world.positions.get(hazardId);
      const radius = world.radii.get(hazardId);
      if (!pos || radius === undefined) continue;
      world.hazardHash.insert(hazardId, pos, radius);
    }

    for (const chestId of world.chests) {
      const pos = world.positions.get(chestId);
      const radius = world.radii.get(chestId);
      if (!pos || radius === undefined) continue;
      world.chestHash.insert(chestId, pos, radius);
    }

    const playerPos = world.positions.get(world.playerId);
    const playerRadius = world.radii.get(world.playerId);

    if (!playerPos || playerRadius === undefined) return;

    const playerEnemyCandidates = world.enemyHash.queryCircle(
      playerPos,
      playerRadius + 64,
      96
    );

    for (const enemyId of playerEnemyCandidates) {
      const enemyPos = world.positions.get(enemyId);
      const enemyRadius = world.radii.get(enemyId);
      const enemy = world.enemyComponents.get(enemyId);
      if (!enemyPos || enemyRadius === undefined || !enemy) continue;

      if (circlesOverlap(playerPos.x, playerPos.y, playerRadius, enemyPos.x, enemyPos.y, enemyRadius)) {
        world.applyPlayerDamage(enemy.touchDamage);
        break;
      }
    }

    for (const projectileId of world.enemyProjectiles) {
      if (world.pendingRemoval.has(projectileId)) continue;

      const projectilePos = world.positions.get(projectileId);
      const projectileRadius = world.radii.get(projectileId);
      const projectileData = world.enemyProjectileComponents.get(projectileId);
      if (!projectilePos || projectileRadius === undefined || !projectileData) continue;

      if (
        circlesOverlap(
          playerPos.x,
          playerPos.y,
          playerRadius,
          projectilePos.x,
          projectilePos.y,
          projectileRadius
        )
      ) {
        world.applyPlayerDamage(projectileData.damage);
        world.spawnHazard(projectilePos, {
          radius: projectileData.hazardRadius,
          duration: projectileData.hazardDuration,
          damagePerSecond: projectileData.hazardDamagePerSecond
        });
        world.markForRemoval(projectileId);
      }
    }

    const hazardCandidates = world.hazardHash.queryCircle(playerPos, playerRadius + 120, 64);
    for (const hazardId of hazardCandidates) {
      const hazardPos = world.positions.get(hazardId);
      const hazardRadius = world.radii.get(hazardId);
      const hazard = world.hazardComponents.get(hazardId);
      if (!hazardPos || hazardRadius === undefined || !hazard) continue;

      if (circlesOverlap(playerPos.x, playerPos.y, playerRadius, hazardPos.x, hazardPos.y, hazardRadius)) {
        world.applyHazardDamage(hazard.damagePerSecond * world.hazardTickInterval);
        break;
      }
    }

    const pickupCandidates = world.xpHash.queryCircle(
      playerPos,
      playerRadius + world.playerStats.pickupRadius,
      132
    );

    for (const xpId of pickupCandidates) {
      const xpPos = world.positions.get(xpId);
      const xpRadius = world.radii.get(xpId);
      const xpData = world.xpComponents.get(xpId);
      if (!xpPos || xpRadius === undefined || !xpData) continue;

      if (
        circlesOverlap(
          playerPos.x,
          playerPos.y,
          playerRadius + world.playerStats.pickupRadius,
          xpPos.x,
          xpPos.y,
          xpRadius
        )
      ) {
        world.gainXp(xpData.value);
        world.markForRemoval(xpId);
      }
    }

    let narrowPhaseChecks = 0;

    for (const projectileId of world.projectiles) {
      if (narrowPhaseChecks >= world.config.maxNarrowPhaseChecks) break;
      if (world.pendingRemoval.has(projectileId)) continue;

      const projectilePos = world.positions.get(projectileId);
      const projectileRadius = world.radii.get(projectileId);
      const projectileData = world.projectileComponents.get(projectileId);
      if (!projectilePos || projectileRadius === undefined || !projectileData) continue;

      const candidates = world.enemyHash.queryCircle(projectilePos, projectileRadius + 56, 52);

      for (const enemyId of candidates) {
        if (narrowPhaseChecks >= world.config.maxNarrowPhaseChecks) break;
        narrowPhaseChecks += 1;

        if (world.pendingRemoval.has(enemyId)) continue;

        const enemyPos = world.positions.get(enemyId);
        const enemyRadius = world.radii.get(enemyId);
        const enemyHealth = world.health.get(enemyId);
        const enemyData = world.enemyComponents.get(enemyId);

        if (!enemyPos || enemyRadius === undefined || !enemyHealth || !enemyData) continue;

        if (!circlesOverlap(projectilePos.x, projectilePos.y, projectileRadius, enemyPos.x, enemyPos.y, enemyRadius)) {
          continue;
        }

        const dealt = world.applyProjectileHitDamage(projectileData.damage);
        enemyHealth.hp -= dealt;
        projectileData.pierce -= 1;

        if (enemyHealth.hp <= 0) {
          world.kills += 1;
          const archetype = ENEMY_ARCHETYPES[enemyData.archetypeId];
          world.spawnXpOrb(enemyPos, enemyData.xpDrop);
          if (archetype?.isElite) {
            world.eliteKills += 1;
            world.spawnChest(enemyPos, true);
          }
          world.markForRemoval(enemyId);
        }

        if (projectileData.pierce < 0) {
          world.markForRemoval(projectileId);
          break;
        }
      }
    }
  }
}
