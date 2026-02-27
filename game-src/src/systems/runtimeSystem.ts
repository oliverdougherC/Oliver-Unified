import type { ISystem } from '../types';
import { GameWorld } from '../core/world';
import { getActiveRunEvent } from '../data/events';

export class RuntimeSystem implements ISystem<GameWorld> {
  update(dt: number, world: GameWorld): void {
    world.runTime += dt;
    world.updateCooldowns(dt);
    world.updateChestAges(dt);
    world.consumeNearbyChest();
    world.threatLevel = world.getCurrentEnemyThreat();

    const activeEvent = getActiveRunEvent(world.runTime);
    world.activeEventId = activeEvent?.id ?? null;
    world.enemySpeedScale = activeEvent?.enemySpeedScale ?? 1;
    world.spawnIntervalScale = activeEvent?.spawnIntervalScale ?? 1;
    world.playerMoveSpeedScale = activeEvent?.playerMoveSpeedScale ?? 1;
    world.enemyHealthScale = activeEvent?.enemyHealthScale ?? 1;
    world.enemyXpScale = activeEvent?.enemyXpScale ?? 1;
    world.projectileDamageScale = activeEvent?.projectileDamageScale ?? 1;
  }
}
