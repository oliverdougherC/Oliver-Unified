import type { ISystem, UpgradeOption } from '../types';
import { GameWorld } from '../core/world';

function pickUpgradeChoices(world: GameWorld, count: number): UpgradeOption[] {
  const selected = new Set<string>();
  const choices: UpgradeOption[] = [];

  const weightedEntries = world.upgrades.map((upgrade) => {
    const alreadyChosenCount = world.chosenUpgrades.filter((id) => id === upgrade.id).length;
    const decay = Math.pow(0.7, alreadyChosenCount);
    return {
      upgrade,
      weight: Math.max(0.05, upgrade.weight * decay)
    };
  });

  while (choices.length < count && selected.size < weightedEntries.length) {
    const totalWeight = weightedEntries
      .filter((entry) => !selected.has(entry.upgrade.id))
      .reduce((sum, entry) => sum + entry.weight, 0);

    if (totalWeight <= 0) break;

    let roll = world.rng.float(0, totalWeight);
    for (const entry of weightedEntries) {
      if (selected.has(entry.upgrade.id)) continue;
      roll -= entry.weight;
      if (roll <= 0) {
        selected.add(entry.upgrade.id);
        choices.push(entry.upgrade);
        break;
      }
    }
  }

  return choices;
}

export class LevelSystem implements ISystem<GameWorld> {
  update(dt: number, world: GameWorld): void {
    world.applyPlayerRegen(dt);

    if (world.uiState !== 'playing') return;

    if (world.spendXpForLevel()) {
      const options = pickUpgradeChoices(world, 3);
      world.beginLevelUp(options);
    }
  }
}
