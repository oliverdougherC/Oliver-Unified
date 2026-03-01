export interface AtlasSpriteDef {
  id: string;
  kind: 'albedo' | 'normal' | 'emissive' | 'orm';
  note: string;
}

// Hybrid atlas descriptors for handcrafted + procedural sprite generation.
export const FOREST_ATLAS_DEFS: AtlasSpriteDef[] = [
  { id: 'trunk_a', kind: 'albedo', note: 'Main canopy trunk silhouette with moss roots.' },
  { id: 'trunk_a_n', kind: 'normal', note: 'Normal map for trunk_a.' },
  { id: 'fungus_cluster_a', kind: 'albedo', note: 'Bioluminescent mushroom cluster.' },
  { id: 'fungus_cluster_a_e', kind: 'emissive', note: 'Emission map for fungus_cluster_a.' },
  { id: 'rune_stone_a', kind: 'albedo', note: 'Ritual standing stone with rune recesses.' },
  { id: 'rune_stone_a_o', kind: 'orm', note: 'Packed occlusion/roughness/metalness channels.' },
  { id: 'vine_strip_a', kind: 'albedo', note: 'Curved hanging vine strip used in spline attachments.' },
  { id: 'ground_card_a', kind: 'albedo', note: 'Ground patch with puddle/moss breakup.' }
];
