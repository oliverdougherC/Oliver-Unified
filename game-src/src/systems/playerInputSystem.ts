import type { ISystem } from '../types';
import { GameWorld } from '../core/world';

function normalize(x: number, y: number): { x: number; y: number } {
  const mag = Math.hypot(x, y);
  if (mag === 0) return { x: 0, y: 0 };
  return { x: x / mag, y: y / mag };
}

export class PlayerInputSystem implements ISystem<GameWorld> {
  update(_dt: number, world: GameWorld): void {
    const velocity = world.velocities.get(world.playerId);
    if (!velocity) return;

    const x = Number(world.input.right) - Number(world.input.left);
    const y = Number(world.input.down) - Number(world.input.up);

    const direction = normalize(x, y);

    const scaledMoveSpeed = world.playerStats.moveSpeed * world.playerMoveSpeedScale;
    velocity.x = direction.x * scaledMoveSpeed;
    velocity.y = direction.y * scaledMoveSpeed;
  }
}
