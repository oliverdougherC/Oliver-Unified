import type { EnemyRole } from '../../types';

export interface EnemyTextureCard {
  radius: number;
  coreRatio: number;
  notch: number;
}

export interface ProjectileTextureCard {
  size: number;
  tail: number;
}

export interface HazardTextureCard {
  radius: number;
  ringCount: number;
}

export interface PickupTextureCard {
  size: number;
}

export const ENEMY_TEXTURE_CARDS: Record<EnemyRole, EnemyTextureCard> = {
  swarmer: { radius: 120, coreRatio: 0.62, notch: 0.28 },
  charger: { radius: 132, coreRatio: 0.6, notch: 0.35 },
  bruiser: { radius: 142, coreRatio: 0.58, notch: 0.18 },
  tank: { radius: 150, coreRatio: 0.55, notch: 0.08 },
  sniper: { radius: 128, coreRatio: 0.57, notch: 0.12 },
  summoner: { radius: 136, coreRatio: 0.51, notch: 0.2 },
  disruptor: { radius: 126, coreRatio: 0.54, notch: 0.24 }
};

export const PROJECTILE_TEXTURE_CARDS: { allied: ProjectileTextureCard; enemy: ProjectileTextureCard } = {
  allied: { size: 150, tail: 0.48 },
  enemy: { size: 160, tail: 0.52 }
};

export const HAZARD_TEXTURE_CARD: HazardTextureCard = {
  radius: 260,
  ringCount: 4
};

export const PICKUP_TEXTURE_CARDS: { chest: PickupTextureCard; xp: PickupTextureCard } = {
  chest: { size: 196 },
  xp: { size: 120 }
};
