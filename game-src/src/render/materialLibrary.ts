import type { EnemyRole, MaterialKind, MaterialSurface } from '../types';

export interface MaterialProfile extends MaterialSurface {
  rim: number;
  specular: number;
}

const MATERIALS: Record<MaterialKind, MaterialProfile> = {
  bark: {
    kind: 'bark',
    albedo: 0x1b2a27,
    normal: 0x68806f,
    roughness: 0.87,
    emissive: 0.04,
    height: 0.75,
    occlusion: 0.82,
    rim: 0x7ac2a2,
    specular: 0.12
  },
  moss: {
    kind: 'moss',
    albedo: 0x244434,
    normal: 0x7ba685,
    roughness: 0.8,
    emissive: 0.1,
    height: 0.62,
    occlusion: 0.78,
    rim: 0x8ce7bf,
    specular: 0.18
  },
  stone: {
    kind: 'stone',
    albedo: 0x2e3241,
    normal: 0x8790a7,
    roughness: 0.9,
    emissive: 0.02,
    height: 0.88,
    occlusion: 0.9,
    rim: 0xa8b2d0,
    specular: 0.08
  },
  fungal: {
    kind: 'fungal',
    albedo: 0x3a2c4a,
    normal: 0xc0a9ff,
    roughness: 0.44,
    emissive: 0.62,
    height: 0.54,
    occlusion: 0.6,
    rim: 0xdfd4ff,
    specular: 0.5
  },
  arcane: {
    kind: 'arcane',
    albedo: 0x20395b,
    normal: 0x8fd3ff,
    roughness: 0.36,
    emissive: 0.58,
    height: 0.65,
    occlusion: 0.68,
    rim: 0xd8fbff,
    specular: 0.65
  },
  flesh: {
    kind: 'flesh',
    albedo: 0x4a3744,
    normal: 0xc194af,
    roughness: 0.56,
    emissive: 0.18,
    height: 0.58,
    occlusion: 0.72,
    rim: 0xf3c8e2,
    specular: 0.28
  },
  energy: {
    kind: 'energy',
    albedo: 0x2a4e66,
    normal: 0x8df4ff,
    roughness: 0.2,
    emissive: 0.82,
    height: 0.2,
    occlusion: 0.28,
    rim: 0xf1feff,
    specular: 0.86
  }
};

const ENEMY_ROLE_MATERIAL: Record<EnemyRole, MaterialKind> = {
  swarmer: 'moss',
  charger: 'arcane',
  bruiser: 'flesh',
  tank: 'stone',
  sniper: 'arcane',
  summoner: 'fungal',
  disruptor: 'energy'
};

export function getMaterial(kind: MaterialKind): MaterialProfile {
  return MATERIALS[kind];
}

export function getEnemyMaterial(role: EnemyRole): MaterialProfile {
  return MATERIALS[ENEMY_ROLE_MATERIAL[role]];
}

export function materialTint(material: MaterialProfile, lightAmount: number): number {
  const intensity = Math.max(0.45, Math.min(1.2, lightAmount));
  const base = material.albedo;
  const r = Math.min(255, (((base >> 16) & 0xff) * intensity) | 0);
  const g = Math.min(255, (((base >> 8) & 0xff) * intensity) | 0);
  const b = Math.min(255, ((base & 0xff) * intensity) | 0);
  return (r << 16) | (g << 8) | b;
}
