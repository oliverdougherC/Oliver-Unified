import type { ISystem } from '../types';
import { GameWorld } from '../core/world';
import { findNearestEnemy } from './targeting';

export class AutoAttackSystem implements ISystem<GameWorld> {
  update(dt: number, world: GameWorld): void {
    if (world.weaponCooldown > 0) {
      world.weaponCooldown = Math.max(0, world.weaponCooldown - dt);
    }

    if (world.weaponCooldown > 0 || world.enemies.size === 0) return;

    const playerPos = world.getPlayerPosition();
    const candidates = Array.from(world.enemies)
      .map((enemyId) => {
        const pos = world.positions.get(enemyId);
        if (!pos) return null;
        return { id: enemyId, position: pos };
      })
      .filter((entry): entry is { id: number; position: { x: number; y: number } } => Boolean(entry));

    const target = findNearestEnemy(playerPos, candidates, world.playerStats.weapon.range);
    if (!target) return;

    const dx = target.position.x - playerPos.x;
    const dy = target.position.y - playerPos.y;
    const mag = Math.hypot(dx, dy);
    if (mag < 0.0001) return;

    world.spawnProjectile({ x: dx / mag, y: dy / mag });
    world.weaponCooldown = world.playerStats.weapon.fireCooldown;
  }
}
