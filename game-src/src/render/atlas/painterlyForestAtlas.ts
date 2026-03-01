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
    roughness: 0.84
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
    roughness: 0.88
  },
  {
    id: 'vine_hang_a',
    kind: 'vine',
    width: 46,
    height: 190,
    fill: 0x21463f,
    shade: 0x16332d,
    highlight: 0x4d8f7d,
    roughness: 0.7
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
    roughness: 0.58
  },
  {
    id: 'root_card_a',
    kind: 'root',
    width: 120,
    height: 60,
    fill: 0x2b332d,
    shade: 0x1a1f1b,
    highlight: 0x55614f,
    roughness: 0.76
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
    roughness: 0.78
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
    roughness: 0.2
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
    roughness: 0.12
  }
];

export function atlasByKind(kind: PainterlyCardKind): PainterlyForestCard[] {
  return PAINTERLY_FOREST_ATLAS.filter((card) => card.kind === kind);
}
