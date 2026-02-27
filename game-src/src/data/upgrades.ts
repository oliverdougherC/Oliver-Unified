import type { UpgradeOption } from '../types';

export const UPGRADE_OPTIONS: UpgradeOption[] = [
  {
    id: 'sap_shot',
    name: 'Sap Shot',
    description: '+6 projectile damage',
    weight: 1,
    effect: { type: 'weapon_damage', amount: 6 }
  },
  {
    id: 'rapid_vines',
    name: 'Rapid Vines',
    description: '15% faster attacks',
    weight: 1,
    effect: { type: 'fire_rate', amount: 0.15 }
  },
  {
    id: 'long_reach',
    name: 'Long Reach',
    description: '+0.3s projectile lifetime',
    weight: 0.85,
    effect: { type: 'projectile_lifetime', amount: 0.3 }
  },
  {
    id: 'thorn_drive',
    name: 'Thorn Drive',
    description: '+90 projectile speed',
    weight: 0.8,
    effect: { type: 'projectile_speed', amount: 90 }
  },
  {
    id: 'splinter_path',
    name: 'Splinter Path',
    description: '+1 projectile pierce',
    weight: 0.65,
    effect: { type: 'projectile_pierce', amount: 1 }
  },
  {
    id: 'bark_skin',
    name: 'Bark Skin',
    description: '+24 max HP and heal 24',
    weight: 0.9,
    effect: { type: 'max_hp', amount: 24 }
  },
  {
    id: 'forest_stride',
    name: 'Forest Stride',
    description: '+35 move speed',
    weight: 1,
    effect: { type: 'move_speed', amount: 35 }
  },
  {
    id: 'grasping_roots',
    name: 'Grasping Roots',
    description: '+28 pickup radius',
    weight: 0.9,
    effect: { type: 'pickup_radius', amount: 28 }
  },
  {
    id: 'dewward',
    name: 'Dewward',
    description: '+0.8 HP/s regeneration',
    weight: 0.7,
    effect: { type: 'regen', amount: 0.8 }
  },
  {
    id: 'wild_recovery',
    name: 'Wild Recovery',
    description: 'Heal 28 HP instantly',
    weight: 0.55,
    effect: { type: 'heal', amount: 28 }
  }
];
