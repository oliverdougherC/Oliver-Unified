import { describe, expect, it } from 'vitest';
import { GameWorld } from '@/core/world';

describe('guaranteed chest handling', () => {
  it('forces at least one evolution choice when a guaranteed chest has candidates', () => {
    const world = new GameWorld(777, false);
    world.resetRun(777);
    world.runTime = 500;
    world.inventorySlots[0].rank = 8;
    world.addCatalystRank('ritual_resin');

    const chestId = world.spawnChest(world.getPlayerPosition(), true);
    world.openChest(chestId);

    expect(world.pendingChestChoices.some((choice) => choice.choiceType === 'evolve')).toBe(true);
  });

  it('falls back to premium reward messaging when no evolution candidate exists', () => {
    const world = new GameWorld(778, false);
    world.resetRun(778);
    world.runTime = 120;

    const chestId = world.spawnChest(world.getPlayerPosition(), true);
    world.openChest(chestId);

    const descriptions = world.pendingChestChoices.map((choice) => choice.description);
    expect(world.pendingChestChoices.every((choice) => choice.choiceType === 'reward')).toBe(true);
    expect(descriptions.some((text) => text.includes('Guaranteed premium reward'))).toBe(true);
  });
});

describe('post-modal grace and level-up cooldown gates', () => {
  it('applies post-level-up grace to contact and hazard damage timers', () => {
    const world = new GameWorld(779, false);
    world.resetRun(779);

    world.beginLevelUp([
      {
        id: 'grace_test',
        title: 'Grace',
        description: 'test',
        choiceType: 'stat_boost',
        statBoost: 'heal',
        rarity: 'common'
      }
    ]);

    world.applyLevelChoice('grace_test');

    expect(world.contactCooldown).toBeGreaterThanOrEqual(0.74);
    expect(world.hazardTickCooldown).toBeGreaterThanOrEqual(0.74);
  });

  it('requires a short cooldown and XP buffer before the next level-up modal', () => {
    const world = new GameWorld(780, false);
    world.resetRun(780);

    world.xp = world.xpToNext + 600;
    expect(world.spendXpForLevel()).toBe(true);

    world.beginLevelUp([
      {
        id: 'cooldown_test',
        title: 'Cooldown',
        description: 'test',
        choiceType: 'stat_boost',
        statBoost: 'heal',
        rarity: 'common'
      }
    ]);
    world.applyLevelChoice('cooldown_test');

    expect(world.spendXpForLevel()).toBe(false);

    world.gainXp(world.levelUpXpGate - world.xp);
    world.updateCooldowns(1);

    expect(world.spendXpForLevel()).toBe(true);
  });

  it('supports contact-only grace windows for settings resume', () => {
    const world = new GameWorld(781, false);
    world.resetRun(781);
    world.hazardTickCooldown = 0;
    world.contactCooldown = 0;

    world.applyPostModalGrace(0.5, false);

    expect(world.contactCooldown).toBeGreaterThanOrEqual(0.5);
    expect(world.hazardTickCooldown).toBe(0);
  });
});
