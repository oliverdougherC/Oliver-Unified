export type PainterlyCardKind =
  | 'canopy'
  | 'trunk'
  | 'vine'
  | 'moss'
  | 'root'
  | 'fungus'
  | 'rune_stone'
  | 'sap_pool'
  | 'spore_cluster';

export interface PainterlyForestCard {
  id: string;
  kind: PainterlyCardKind;
  width: number;
  height: number;
  fill: number;
  shade: number;
  highlight: number;
  emissive?: number;
  emissiveStrength?: number;
  specularMask?: number;
  roughness: number;
}

export const PAINTERLY_FOREST_ATLAS: PainterlyForestCard[] = [
  {
    id: 'canopy_silhouette_a',
    kind: 'canopy',
    width: 220,
    height: 110,
    fill: 0x090f16,
    shade: 0x05090f,
    highlight: 0x142232,
    roughness: 0.82
  },
  {
    id: 'canopy_silhouette_b',
    kind: 'canopy',
    width: 180,
    height: 96,
    fill: 0x0a111b,
    shade: 0x060a11,
    highlight: 0x15283c,
    specularMask: 0x1e3b53,
    roughness: 0.84
  },
  {
    id: 'canopy_silhouette_c',
    kind: 'canopy',
    width: 244,
    height: 118,
    fill: 0x0b141f,
    shade: 0x060b12,
    highlight: 0x1b3249,
    specularMask: 0x244660,
    roughness: 0.81
  },
  {
    id: 'trunk_tall_a',
    kind: 'trunk',
    width: 54,
    height: 220,
    fill: 0x1d2a28,
    shade: 0x111a18,
    highlight: 0x315147,
    roughness: 0.9
  },
  {
    id: 'trunk_tall_b',
    kind: 'trunk',
    width: 42,
    height: 186,
    fill: 0x223230,
    shade: 0x141d1c,
    highlight: 0x3a5b53,
    specularMask: 0x5e897b,
    roughness: 0.88
  },
  {
    id: 'trunk_tall_c',
    kind: 'trunk',
    width: 58,
    height: 236,
    fill: 0x243633,
    shade: 0x15201f,
    highlight: 0x44685f,
    specularMask: 0x618f80,
    roughness: 0.86
  },
  {
    id: 'vine_hang_a',
    kind: 'vine',
    width: 46,
    height: 190,
    fill: 0x21463f,
    shade: 0x16332d,
    highlight: 0x4d8f7d,
    specularMask: 0x67ab96,
    roughness: 0.7
  },
  {
    id: 'vine_hang_b',
    kind: 'vine',
    width: 42,
    height: 210,
    fill: 0x244f46,
    shade: 0x17352f,
    highlight: 0x5ba392,
    specularMask: 0x80c4b1,
    roughness: 0.68
  },
  {
    id: 'moss_floor_a',
    kind: 'moss',
    width: 148,
    height: 88,
    fill: 0x1f3a33,
    shade: 0x142723,
    highlight: 0x4a836f,
    roughness: 0.62
  },
  {
    id: 'moss_floor_b',
    kind: 'moss',
    width: 110,
    height: 72,
    fill: 0x24453a,
    shade: 0x173127,
    highlight: 0x5b9a82,
    specularMask: 0x72b29b,
    roughness: 0.58
  },
  {
    id: 'moss_floor_c',
    kind: 'moss',
    width: 168,
    height: 94,
    fill: 0x295044,
    shade: 0x1b372f,
    highlight: 0x67ae93,
    specularMask: 0x89cfb2,
    roughness: 0.54
  },
  {
    id: 'root_card_a',
    kind: 'root',
    width: 120,
    height: 60,
    fill: 0x2b332d,
    shade: 0x1a1f1b,
    highlight: 0x55614f,
    specularMask: 0x70806a,
    roughness: 0.76
  },
  {
    id: 'root_card_b',
    kind: 'root',
    width: 146,
    height: 70,
    fill: 0x2f3830,
    shade: 0x1f251f,
    highlight: 0x64745f,
    specularMask: 0x86967f,
    roughness: 0.74
  },
  {
    id: 'fungus_glow_a',
    kind: 'fungus',
    width: 54,
    height: 44,
    fill: 0x4a3b63,
    shade: 0x312643,
    highlight: 0x8f7cc3,
    emissive: 0x7ffff0,
    emissiveStrength: 0.62,
    specularMask: 0xd0b8ff,
    roughness: 0.35
  },
  {
    id: 'fungus_glow_b',
    kind: 'fungus',
    width: 46,
    height: 38,
    fill: 0x523f69,
    shade: 0x372a49,
    highlight: 0xa991da,
    emissive: 0x89ffd8,
    emissiveStrength: 0.56,
    specularMask: 0xe1ceff,
    roughness: 0.33
  },
  {
    id: 'rune_stone_a',
    kind: 'rune_stone',
    width: 64,
    height: 78,
    fill: 0x273237,
    shade: 0x171f22,
    highlight: 0x526773,
    emissive: 0x7df9ff,
    emissiveStrength: 0.44,
    specularMask: 0x8cb0c1,
    roughness: 0.78
  },
  {
    id: 'rune_stone_b',
    kind: 'rune_stone',
    width: 70,
    height: 84,
    fill: 0x2d3a40,
    shade: 0x1b2428,
    highlight: 0x607987,
    emissive: 0x8cf8ff,
    emissiveStrength: 0.4,
    specularMask: 0xa9c4d0,
    roughness: 0.74
  },
  {
    id: 'sap_pool_a',
    kind: 'sap_pool',
    width: 82,
    height: 46,
    fill: 0x1b3941,
    shade: 0x10242a,
    highlight: 0x3f7c8c,
    emissive: 0x5de9ff,
    emissiveStrength: 0.48,
    specularMask: 0x74c4cf,
    roughness: 0.2
  },
  {
    id: 'sap_pool_b',
    kind: 'sap_pool',
    width: 96,
    height: 52,
    fill: 0x21444d,
    shade: 0x142c34,
    highlight: 0x4e95a7,
    emissive: 0x72ecff,
    emissiveStrength: 0.5,
    specularMask: 0x9fdbdf,
    roughness: 0.18
  },
  {
    id: 'spore_cluster_a',
    kind: 'spore_cluster',
    width: 50,
    height: 42,
    fill: 0x89d7c0,
    shade: 0x4f8b79,
    highlight: 0xd7fff1,
    emissive: 0xa5ffde,
    emissiveStrength: 0.3,
    specularMask: 0xffffff,
    roughness: 0.12
  },
  {
    id: 'spore_cluster_b',
    kind: 'spore_cluster',
    width: 56,
    height: 48,
    fill: 0x7ccdb7,
    shade: 0x4d8d7a,
    highlight: 0xd4fff1,
    emissive: 0x98ffd8,
    emissiveStrength: 0.28,
    specularMask: 0xfcfff4,
    roughness: 0.14
  }
];

export function atlasByKind(kind: PainterlyCardKind): PainterlyForestCard[] {
  return PAINTERLY_FOREST_ATLAS.filter((card) => card.kind === kind);
}
