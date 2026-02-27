import type { ISystem } from '../types';
import { GameWorld } from '../core/world';

export class ProjectileSystem implements ISystem<GameWorld> {
  update(dt: number, world: GameWorld): void {
    const playerPos = world.getPlayerPosition();

    for (const projectileId of world.projectiles) {
      const projectile = world.projectileComponents.get(projectileId);
      const projectilePos = world.positions.get(projectileId);
      if (!projectile || !projectilePos) continue;

      projectile.age += dt;

      if (projectile.age >= projectile.lifetime) {
        world.markForRemoval(projectileId);
        continue;
      }

      const dx = projectilePos.x - playerPos.x;
      const dy = projectilePos.y - playerPos.y;
      if (dx * dx + dy * dy > 2200 * 2200) {
        world.markForRemoval(projectileId);
      }
    }

    for (const projectileId of world.enemyProjectiles) {
      const projectile = world.enemyProjectileComponents.get(projectileId);
      const projectilePos = world.positions.get(projectileId);
      if (!projectile || !projectilePos) continue;

      projectile.age += dt;
      if (projectile.age < projectile.lifetime) continue;

      world.spawnHazard(projectilePos, {
        radius: projectile.hazardRadius,
        duration: projectile.hazardDuration,
        damagePerSecond: projectile.hazardDamagePerSecond
      });
      world.markForRemoval(projectileId);
    }

    for (const hazardId of world.hazards) {
      const hazard = world.hazardComponents.get(hazardId);
      if (!hazard) continue;
      hazard.age += dt;
      if (hazard.age >= hazard.lifetime) {
        world.markForRemoval(hazardId);
      }
    }
  }
}
