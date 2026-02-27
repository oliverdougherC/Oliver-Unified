import type { ISystem, Vec2 } from '../types';
import { GameWorld } from '../core/world';
import { ENEMY_ARCHETYPES } from '../data/enemies';

function normalize(x: number, y: number): Vec2 {
  const mag = Math.hypot(x, y);
  if (mag < 0.0001) return { x: 0, y: 0 };
  return { x: x / mag, y: y / mag };
}

function setVelocity(velocity: Vec2, direction: Vec2, speed: number): void {
  velocity.x = direction.x * speed;
  velocity.y = direction.y * speed;
}

export class EnemyAISystem implements ISystem<GameWorld> {
  update(dt: number, world: GameWorld): void {
    const playerPos = world.getPlayerPosition();

    for (const enemyId of world.enemies) {
      const enemyPos = world.positions.get(enemyId);
      const enemyVel = world.velocities.get(enemyId);
      const enemyData = world.enemyComponents.get(enemyId);

      if (!enemyPos || !enemyVel || !enemyData) continue;

      const archetype = ENEMY_ARCHETYPES[enemyData.archetypeId];
      if (!archetype) continue;

      const dx = playerPos.x - enemyPos.x;
      const dy = playerPos.y - enemyPos.y;
      const distance = Math.hypot(dx, dy);
      const toPlayer = normalize(dx, dy);
      const baseSpeed = enemyData.speed * world.enemySpeedScale;

      if (enemyData.behavior === 'dash_striker' && archetype.dash) {
        if (enemyData.dashDuration > 0) {
          enemyData.dashDuration = Math.max(0, enemyData.dashDuration - dt);
          setVelocity(enemyVel, enemyData.dashDirection, baseSpeed * archetype.dash.speedMultiplier);
          if (enemyData.dashDuration <= 0) {
            enemyData.dashCooldown = world.rng.float(archetype.dash.cooldown * 0.85, archetype.dash.cooldown * 1.2);
          }
          continue;
        }

        if (enemyData.dashWindup > 0) {
          enemyData.dashWindup = Math.max(0, enemyData.dashWindup - dt);
          enemyVel.x = 0;
          enemyVel.y = 0;
          if (enemyData.dashWindup <= 0) {
            const direction = Math.hypot(enemyData.dashDirection.x, enemyData.dashDirection.y) > 0.1
              ? enemyData.dashDirection
              : toPlayer;
            enemyData.dashDirection = direction;
            enemyData.dashDuration = archetype.dash.duration;
          }
          continue;
        }

        enemyData.dashCooldown = Math.max(0, enemyData.dashCooldown - dt);
        if (distance > 0.1) {
          setVelocity(enemyVel, toPlayer, baseSpeed * 0.9);
        } else {
          enemyVel.x = 0;
          enemyVel.y = 0;
        }

        if (enemyData.dashCooldown <= 0 && distance <= archetype.dash.triggerRange) {
          enemyData.dashDirection = toPlayer;
          enemyData.dashWindup = archetype.dash.windup;
          enemyVel.x = 0;
          enemyVel.y = 0;
        }
        continue;
      }

      if (enemyData.behavior === 'spitter' && archetype.spit) {
        const desiredRange = archetype.spit.range * 0.85;
        enemyData.spitCooldown = Math.max(0, enemyData.spitCooldown - dt);

        if (distance < desiredRange * 0.82 && distance > 0.1) {
          setVelocity(enemyVel, { x: -toPlayer.x, y: -toPlayer.y }, baseSpeed * 1.05);
        } else if (distance > desiredRange * 1.22) {
          setVelocity(enemyVel, toPlayer, baseSpeed * 0.82);
        } else {
          const strafeSign = enemyId % 2 === 0 ? 1 : -1;
          const strafe = { x: -toPlayer.y * strafeSign, y: toPlayer.x * strafeSign };
          setVelocity(enemyVel, strafe, baseSpeed * 0.72);
        }

        if (enemyData.spitCooldown <= 0 && distance <= archetype.spit.range) {
          world.spawnEnemyProjectile(enemyPos, toPlayer, {
            speed: archetype.spit.projectileSpeed,
            lifetime: archetype.spit.projectileLifetime,
            radius: archetype.spit.projectileRadius,
            damage: archetype.spit.projectileDamage,
            hazardRadius: archetype.spit.hazardRadius,
            hazardDuration: archetype.spit.hazardDuration,
            hazardDamagePerSecond: archetype.spit.hazardDamagePerSecond
          });
          enemyData.spitCooldown = world.rng.float(archetype.spit.cooldown * 0.88, archetype.spit.cooldown * 1.2);
        }
        continue;
      }

      if (distance < 0.0001) {
        enemyVel.x = 0;
        enemyVel.y = 0;
        continue;
      }

      setVelocity(enemyVel, toPlayer, baseSpeed);
    }
  }
}
