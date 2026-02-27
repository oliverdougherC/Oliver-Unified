import type { EnemyArchetype } from '../types';

export const ENEMY_ARCHETYPES: Record<string, EnemyArchetype> = {
  brambleling: {
    id: 'brambleling',
    name: 'Brambleling',
    behavior: 'chaser',
    maxHp: 34,
    radius: 14,
    speed: 120,
    touchDamage: 8,
    xpDrop: 6,
    threat: 0.9,
    colorHex: 0x7fa86a,
    weight: 1
  },
  moss_hound: {
    id: 'moss_hound',
    name: 'Moss Hound',
    behavior: 'chaser',
    maxHp: 24,
    radius: 11,
    speed: 165,
    touchDamage: 7,
    xpDrop: 5,
    threat: 1.05,
    colorHex: 0x9ac977,
    weight: 1
  },
  elder_bark: {
    id: 'elder_bark',
    name: 'Elder Bark',
    behavior: 'chaser',
    maxHp: 110,
    radius: 20,
    speed: 78,
    touchDamage: 15,
    xpDrop: 18,
    threat: 2.75,
    colorHex: 0x6f8660,
    weight: 0.25
  },
  thorn_sentinel: {
    id: 'thorn_sentinel',
    name: 'Thorn Sentinel',
    behavior: 'chaser',
    maxHp: 64,
    radius: 16,
    speed: 108,
    touchDamage: 11,
    xpDrop: 10,
    threat: 1.9,
    colorHex: 0x5f7b52,
    weight: 0.45
  },
  spore_wisp: {
    id: 'spore_wisp',
    name: 'Spore Wisp',
    behavior: 'chaser',
    maxHp: 18,
    radius: 9,
    speed: 208,
    touchDamage: 6,
    xpDrop: 4,
    threat: 0.95,
    colorHex: 0xbde08f,
    weight: 0.55
  },
  briar_lancer: {
    id: 'briar_lancer',
    name: 'Briar Lancer',
    behavior: 'dash_striker',
    maxHp: 52,
    radius: 13,
    speed: 124,
    touchDamage: 11,
    xpDrop: 9,
    threat: 2.3,
    colorHex: 0xa9c57f,
    weight: 0.3,
    dash: {
      cooldown: 2.7,
      windup: 0.52,
      duration: 0.32,
      speedMultiplier: 3.4,
      triggerRange: 300
    }
  },
  spore_channeler: {
    id: 'spore_channeler',
    name: 'Spore Channeler',
    behavior: 'spitter',
    maxHp: 46,
    radius: 13,
    speed: 92,
    touchDamage: 8,
    xpDrop: 11,
    threat: 2.5,
    colorHex: 0xb8d8a1,
    weight: 0.24,
    spit: {
      cooldown: 1.55,
      range: 720,
      projectileSpeed: 250,
      projectileLifetime: 2.4,
      projectileRadius: 8,
      projectileDamage: 12,
      hazardRadius: 78,
      hazardDuration: 6,
      hazardDamagePerSecond: 18
    }
  },
  moss_hound_elite: {
    id: 'moss_hound_elite',
    name: 'Moss Hound (Elder)',
    behavior: 'chaser',
    maxHp: 70,
    radius: 14,
    speed: 188,
    touchDamage: 14,
    xpDrop: 20,
    threat: 2.6,
    colorHex: 0xc9e890,
    weight: 0.07,
    isElite: true
  },
  thorn_sentinel_elite: {
    id: 'thorn_sentinel_elite',
    name: 'Thorn Sentinel (Ancient)',
    behavior: 'dash_striker',
    maxHp: 158,
    radius: 20,
    speed: 132,
    touchDamage: 22,
    xpDrop: 36,
    threat: 4.4,
    colorHex: 0xd8d39f,
    weight: 0.05,
    isElite: true,
    dash: {
      cooldown: 2.3,
      windup: 0.44,
      duration: 0.34,
      speedMultiplier: 3.8,
      triggerRange: 340
    }
  }
};
