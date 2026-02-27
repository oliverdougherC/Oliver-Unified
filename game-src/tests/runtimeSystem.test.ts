import { describe, expect, it } from 'vitest';
import { GameWorld } from '@/core/world';
import { RuntimeSystem } from '@/systems/runtimeSystem';

describe('runtime system event modifiers', () => {
  it('applies and clears event-driven scales over time', () => {
    const world = new GameWorld(1337, false);
    const system = new RuntimeSystem();

    world.resetRun(1337);
    world.runTime = 70;
    system.update(1, world);

    expect(world.activeEventId).toBe('blood_monsoon');
    expect(world.spawnIntervalScale).toBeLessThan(1);
    expect(world.enemySpeedScale).toBeGreaterThan(1);

    world.runTime = 240;
    system.update(1, world);

    expect(world.activeEventId).toBeNull();
    expect(world.spawnIntervalScale).toBe(1);
    expect(world.enemySpeedScale).toBe(1);
    expect(world.enemyHealthScale).toBe(1);
    expect(world.enemyXpScale).toBe(1);
    expect(world.playerMoveSpeedScale).toBe(1);
  });

  it('applies canopy modifier with tougher but richer enemies', () => {
    const world = new GameWorld(4242, false);
    const system = new RuntimeSystem();

    world.resetRun(4242);
    world.runTime = 120;
    system.update(1, world);

    expect(world.activeEventId).toBe('iron_canopy');
    expect(world.enemyHealthScale).toBeGreaterThan(1);
    expect(world.enemyXpScale).toBeGreaterThan(1);
    expect(world.projectileDamageScale).toBeGreaterThan(1);
  });
});
