import type { ColorVisionMode, EnemyRole, VisualThemeTokens } from '../types';

type EnemyPalette = Record<EnemyRole, { fill: number; stroke: number }>;

const BASE_ENEMIES: EnemyPalette = {
  swarmer: { fill: 0x5dcf8c, stroke: 0xe7fff4 },
  charger: { fill: 0x3f90f2, stroke: 0xe6f7ff },
  bruiser: { fill: 0xff8d64, stroke: 0xffe1cf },
  tank: { fill: 0xa7b2ff, stroke: 0xf1f2ff },
  sniper: { fill: 0xffc973, stroke: 0xfff1cf },
  summoner: { fill: 0xd68aff, stroke: 0xf7e7ff },
  disruptor: { fill: 0xff6ba4, stroke: 0xffdfeb }
};

const DEUTERANOPIA_ENEMIES: EnemyPalette = {
  swarmer: { fill: 0x78c2ff, stroke: 0xe8f5ff },
  charger: { fill: 0x2f79d8, stroke: 0xe0edff },
  bruiser: { fill: 0xffa67d, stroke: 0xffead8 },
  tank: { fill: 0xbb9cff, stroke: 0xf6efff },
  sniper: { fill: 0xffd264, stroke: 0xfff2cc },
  summoner: { fill: 0xd17aff, stroke: 0xf6e5ff },
  disruptor: { fill: 0xff79ba, stroke: 0xffe0f0 }
};

const PROTANOPIA_ENEMIES: EnemyPalette = {
  swarmer: { fill: 0x6ecfff, stroke: 0xe9f7ff },
  charger: { fill: 0x2f73d4, stroke: 0xdfe9ff },
  bruiser: { fill: 0xffaf87, stroke: 0xffeddc },
  tank: { fill: 0xaa9dff, stroke: 0xf3efff },
  sniper: { fill: 0xfecf6a, stroke: 0xfff2cf },
  summoner: { fill: 0xcf84ff, stroke: 0xf5e9ff },
  disruptor: { fill: 0xff84c2, stroke: 0xffe7f2 }
};

const TRITANOPIA_ENEMIES: EnemyPalette = {
  swarmer: { fill: 0x46d89f, stroke: 0xe2fff5 },
  charger: { fill: 0x2f82e0, stroke: 0xe1f6ff },
  bruiser: { fill: 0xff8c70, stroke: 0xffe6da },
  tank: { fill: 0x8eb8ff, stroke: 0xeaf2ff },
  sniper: { fill: 0xffbe66, stroke: 0xffebcb },
  summoner: { fill: 0xf38aff, stroke: 0xffe8ff },
  disruptor: { fill: 0xff5c96, stroke: 0xffd9e8 }
};

function enemyPalette(mode: ColorVisionMode): EnemyPalette {
  if (mode === 'deuteranopia') return DEUTERANOPIA_ENEMIES;
  if (mode === 'protanopia') return PROTANOPIA_ENEMIES;
  if (mode === 'tritanopia') return TRITANOPIA_ENEMIES;
  return BASE_ENEMIES;
}

export function createVisualTheme(mode: ColorVisionMode): VisualThemeTokens {
  const enemies = enemyPalette(mode);
  return {
    player: { fill: 0xb8f8ff, stroke: 0xf3ffff, aura: 0x7bf1ff },
    projectiles: {
      allied: 0x8defff,
      alliedStroke: 0xf4ffff,
      enemy: 0xff7f4e,
      enemyStroke: 0xffe4cf
    },
    pickups: {
      xpFill: 0xaa8bff,
      xpStroke: 0xf1ebff,
      chestFill: 0x63311d,
      chestStroke: 0xffde96
    },
    hazards: {
      fill: 0x98271a,
      inner: 0xffd39e,
      stroke: 0xfff0cf
    },
    telegraph: {
      line: 0xffbd4a,
      ring: 0xffe4a3
    },
    enemies,
    elite: {
      stroke: 0xfff2bc,
      crown: 0xffd16a
    },
    backdrop: {
      floor: 0x070a14,
      canopy: 0x10263f,
      fog: 0x173f56,
      vines: 0x0e6d73,
      grade: 0x96f9d7,
      eventTint: 0xffc98a
    }
  };
}

function channelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hexColor: number): number {
  const r = channelToLinear((hexColor >> 16) & 0xff);
  const g = channelToLinear((hexColor >> 8) & 0xff);
  const b = channelToLinear(hexColor & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function luminanceDelta(a: number, b: number): number {
  return Math.abs(relativeLuminance(a) - relativeLuminance(b));
}
