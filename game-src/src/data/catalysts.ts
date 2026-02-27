import type { CatalystDefinition } from '../types';

export const CATALYST_DEFINITIONS: Record<string, CatalystDefinition> = {
  ritual_resin: {
    id: 'ritual_resin',
    name: 'Ritual Resin',
    description: '+12% global damage per rank.',
    rarity: 'common',
    weight: 1,
    maxRank: 5,
    effects: [{ type: 'global_damage_mult', amount: 0.12 }]
  },
  predator_lens: {
    id: 'predator_lens',
    name: 'Predator Lens',
    description: '+4% crit chance and +20% crit damage per rank.',
    rarity: 'rare',
    weight: 0.78,
    maxRank: 4,
    effects: [
      { type: 'crit_chance', amount: 0.04 },
      { type: 'crit_damage', amount: 0.2 }
    ]
  },
  storm_vial: {
    id: 'storm_vial',
    name: 'Storm Vial',
    description: '+9% projectile speed and +5% cooldown efficiency per rank.',
    rarity: 'common',
    weight: 0.92,
    maxRank: 5,
    effects: [
      { type: 'projectile_speed_mult', amount: 0.09 },
      { type: 'global_cooldown_mult', amount: 0.05 }
    ]
  },
  blood_compass: {
    id: 'blood_compass',
    name: 'Blood Compass',
    description: '+28 pickup radius and +9 move speed per rank.',
    rarity: 'common',
    weight: 1,
    maxRank: 5,
    effects: [
      { type: 'pickup_radius', amount: 28 },
      { type: 'move_speed', amount: 9 }
    ]
  },
  marrow_charm: {
    id: 'marrow_charm',
    name: 'Marrow Charm',
    description: '+34 max HP and +0.4 regen per rank.',
    rarity: 'rare',
    weight: 0.8,
    maxRank: 4,
    effects: [
      { type: 'max_hp', amount: 34 },
      { type: 'regen', amount: 0.4 }
    ]
  },
  wildfire_oil: {
    id: 'wildfire_oil',
    name: 'Wildfire Oil',
    description: '+14% global damage and +3% crit chance per rank.',
    rarity: 'epic',
    weight: 0.58,
    maxRank: 3,
    effects: [
      { type: 'global_damage_mult', amount: 0.14 },
      { type: 'crit_chance', amount: 0.03 }
    ]
  },
  eclipse_sigil: {
    id: 'eclipse_sigil',
    name: 'Eclipse Sigil',
    description: '+8% cooldown efficiency and +0.3 armor per rank.',
    rarity: 'epic',
    weight: 0.55,
    maxRank: 3,
    effects: [
      { type: 'global_cooldown_mult', amount: 0.08 },
      { type: 'armor', amount: 0.3 }
    ]
  },
  ancient_clock: {
    id: 'ancient_clock',
    name: 'Ancient Clock',
    description: 'Heal 14 and +7 move speed per rank.',
    rarity: 'rare',
    weight: 0.74,
    maxRank: 4,
    effects: [
      { type: 'heal', amount: 14 },
      { type: 'move_speed', amount: 7 }
    ]
  }
};

export const CATALYST_IDS = Object.keys(CATALYST_DEFINITIONS);
