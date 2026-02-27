import { BASE_WEAPON_IDS, WEAPON_ARCHETYPES } from '../data/weapons';
import { CATALYST_DEFINITIONS, CATALYST_IDS } from '../data/catalysts';
import type { ISystem, LevelUpChoice } from '../types';
import { GameWorld } from '../core/world';

interface WeightedChoice {
  choice: LevelUpChoice;
  weight: number;
}

function pickWeightedChoice(world: GameWorld, pool: WeightedChoice[], used: Set<string>): LevelUpChoice | null {
  const candidates = pool.filter((entry) => !used.has(entry.choice.id) && entry.weight > 0);
  if (candidates.length === 0) return null;

  const total = candidates.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return null;

  let roll = world.rng.float(0, total);
  for (const entry of candidates) {
    roll -= entry.weight;
    if (roll <= 0) return entry.choice;
  }

  return candidates[candidates.length - 1]?.choice ?? null;
}

function rarityWeight(rarity: 'common' | 'rare' | 'epic' | 'legendary'): number {
  if (rarity === 'legendary') return 0.28;
  if (rarity === 'epic') return 0.55;
  if (rarity === 'rare') return 0.85;
  return 1.1;
}

function buildChoicePools(world: GameWorld): {
  guaranteedNewWeapon: LevelUpChoice | null;
  weightedChoices: WeightedChoice[];
} {
  const ownedWeaponIds = new Set(
    world.inventorySlots.filter((slot) => slot.itemId).map((slot) => slot.itemId as string)
  );

  const openSlots = world.inventorySlots.filter((slot) => slot.itemId === null);
  const availableNewWeapons = BASE_WEAPON_IDS.filter((weaponId) => !ownedWeaponIds.has(weaponId));

  let guaranteedNewWeapon: LevelUpChoice | null = null;
  if (openSlots.length > 0 && availableNewWeapons.length > 0) {
    const weaponId = availableNewWeapons[world.rng.int(0, availableNewWeapons.length - 1)];
    const weapon = WEAPON_ARCHETYPES[weaponId];
    guaranteedNewWeapon = {
      id: `choice_new_weapon_${weaponId}`,
      title: `New Weapon: ${weapon.name}`,
      description: weapon.description,
      choiceType: 'new_item',
      itemKind: 'weapon',
      itemId: weapon.id,
      rarity: weapon.rarity
    };
  }

  const weightedChoices: WeightedChoice[] = [];

  for (const weaponId of availableNewWeapons) {
    const weapon = WEAPON_ARCHETYPES[weaponId];
    weightedChoices.push({
      choice: {
        id: `choice_new_weapon_${weapon.id}`,
        title: `New Weapon: ${weapon.name}`,
        description: weapon.description,
        choiceType: 'new_item',
        itemKind: 'weapon',
        itemId: weapon.id,
        rarity: weapon.rarity
      },
      weight: 0.7 * rarityWeight(weapon.rarity)
    });
  }

  for (const slot of world.inventorySlots) {
    if (!slot.itemId || slot.isEvolved || slot.rank >= 8) continue;
    const weapon = WEAPON_ARCHETYPES[slot.itemId];
    weightedChoices.push({
      choice: {
        id: `choice_upgrade_weapon_${slot.slotIndex}`,
        title: `Upgrade ${weapon.name} (${slot.rank} -> ${slot.rank + 1})`,
        description: `Raise slot ${slot.slotIndex + 1} weapon power.`,
        choiceType: 'upgrade_item',
        itemKind: 'weapon',
        slotIndex: slot.slotIndex,
        itemId: slot.itemId,
        rarity: weapon.rarity
      },
      weight: 1.6 + (8 - slot.rank) * 0.16
    });
  }

  for (const catalystId of CATALYST_IDS) {
    const catalyst = CATALYST_DEFINITIONS[catalystId];
    const currentRank = world.getCatalystRank(catalystId);

    if (currentRank === 0) {
      weightedChoices.push({
        choice: {
          id: `choice_new_catalyst_${catalystId}`,
          title: `Catalyst: ${catalyst.name}`,
          description: catalyst.description,
          choiceType: 'new_item',
          itemKind: 'catalyst',
          itemId: catalyst.id,
          rarity: catalyst.rarity
        },
        weight: catalyst.weight
      });
    } else if (currentRank < catalyst.maxRank) {
      weightedChoices.push({
        choice: {
          id: `choice_upgrade_catalyst_${catalystId}`,
          title: `Catalyst Up: ${catalyst.name} (${currentRank} -> ${currentRank + 1})`,
          description: catalyst.description,
          choiceType: 'upgrade_item',
          itemKind: 'catalyst',
          itemId: catalyst.id,
          rarity: catalyst.rarity
        },
        weight: 0.76 * catalyst.weight
      });
    }
  }

  weightedChoices.push(
    {
      choice: {
        id: 'choice_stat_heal',
        title: 'Crimson Surge',
        description: 'Heal 36 HP instantly.',
        choiceType: 'stat_boost',
        statBoost: 'heal',
        rarity: 'common'
      },
      weight: 0.62
    },
    {
      choice: {
        id: 'choice_stat_armor',
        title: 'Stone Nerve',
        description: '+0.45 armor for reduced incoming damage.',
        choiceType: 'stat_boost',
        statBoost: 'armor',
        rarity: 'rare'
      },
      weight: 0.55
    },
    {
      choice: {
        id: 'choice_stat_speed',
        title: 'Predator Step',
        description: '+18 movement speed.',
        choiceType: 'stat_boost',
        statBoost: 'speed',
        rarity: 'common'
      },
      weight: 0.65
    },
    {
      choice: {
        id: 'choice_stat_damage',
        title: 'Savage Focus',
        description: '+12% global damage.',
        choiceType: 'stat_boost',
        statBoost: 'damage',
        rarity: 'rare'
      },
      weight: 0.58
    }
  );

  return { guaranteedNewWeapon, weightedChoices };
}

function buildLevelChoices(world: GameWorld): LevelUpChoice[] {
  const out: LevelUpChoice[] = [];
  const used = new Set<string>();
  const pools = buildChoicePools(world);

  if (pools.guaranteedNewWeapon) {
    out.push(pools.guaranteedNewWeapon);
    used.add(pools.guaranteedNewWeapon.id);
  }

  while (out.length < 3) {
    const picked = pickWeightedChoice(world, pools.weightedChoices, used);
    if (!picked) break;
    out.push(picked);
    used.add(picked.id);
  }

  while (out.length < 3) {
    const fallback: LevelUpChoice = {
      id: `choice_fallback_${out.length}`,
      title: 'Survival Instinct',
      description: 'Recover 22 HP and gain minor resolve.',
      choiceType: 'stat_boost',
      statBoost: 'heal',
      rarity: 'common'
    };
    out.push(fallback);
  }

  return out.slice(0, 3);
}

export class LevelSystem implements ISystem<GameWorld> {
  update(dt: number, world: GameWorld): void {
    world.applyPlayerRegen(dt);

    if (world.uiState !== 'playing') return;

    if (world.spendXpForLevel()) {
      const options = buildLevelChoices(world);
      world.beginLevelUp(options);
    }
  }
}
