import { describe, expect, it } from 'vitest';
import { GameWorld } from '@/core/world';
import { LevelSystem } from '@/systems/levelSystem';
import { BASE_WEAPON_IDS } from '@/data/weapons';

describe('inventory and level-up', () => {
  it('guarantees a new weapon offer when slots are open', () => {
    const world = new GameWorld(1001, false);
    const levelSystem = new LevelSystem();

    world.resetRun(1001);
    world.xp = world.xpToNext;
    levelSystem.update(0.016, world);

    expect(world.uiState).toBe('levelup');
    expect(
      world.pendingLevelChoices.some(
        (choice) => choice.choiceType === 'new_item' && choice.itemKind === 'weapon'
      )
    ).toBe(true);
  });

  it('does not offer new weapon choices once all slots are full', () => {
    const world = new GameWorld(2002, false);
    const levelSystem = new LevelSystem();

    world.resetRun(2002);
    for (const weaponId of BASE_WEAPON_IDS.slice(1, 4)) {
      world.addWeaponToFirstOpenSlot(weaponId);
    }

    expect(world.inventorySlots.every((slot) => slot.itemId !== null)).toBe(true);

    world.xp = world.xpToNext;
    levelSystem.update(0.016, world);

    expect(world.uiState).toBe('levelup');
    expect(
      world.pendingLevelChoices.some(
        (choice) => choice.choiceType === 'new_item' && choice.itemKind === 'weapon'
      )
    ).toBe(false);
  });
});
