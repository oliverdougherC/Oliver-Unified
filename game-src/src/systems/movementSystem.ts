import type { ISystem } from '../types';
import { GameWorld } from '../core/world';

export class MovementSystem implements ISystem<GameWorld> {
  update(dt: number, world: GameWorld): void {
    for (const entityId of world.entities) {
      const position = world.positions.get(entityId);
      const velocity = world.velocities.get(entityId);
      if (!position || !velocity) continue;

      position.x += velocity.x * dt;
      position.y += velocity.y * dt;
    }

    const playerPos = world.positions.get(world.playerId);
    if (!playerPos) return;

    const halfWidth = world.config.fieldWidth / 2;
    const halfHeight = world.config.fieldHeight / 2;

    playerPos.x = Math.max(-halfWidth, Math.min(halfWidth, playerPos.x));
    playerPos.y = Math.max(-halfHeight, Math.min(halfHeight, playerPos.y));
  }
}
