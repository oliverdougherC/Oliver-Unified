import { describe, expect, it } from 'vitest';
import { Graphics, Sprite, Texture } from 'pixi.js';
import { enemyTextureVariantForRole, createEnemySprite } from '@/render/enemySpriteFactory';
import type { BakedTexturePack } from '@/render/textureBaker';

function makePack(): BakedTexturePack {
  const white = Texture.WHITE;
  return {
    key: 'test-pack',
    manifest: {
      key: 'test-manifest',
      player: { base: 'p.base', aura: 'p.aura' },
      enemies: {
        swarmer: { base: 'e.s.base', glow: 'e.s.glow', elite: 'e.s.elite' },
        charger: { base: 'e.c.base', glow: 'e.c.glow', elite: 'e.c.elite' },
        bruiser: { base: 'e.b.base', glow: 'e.b.glow', elite: 'e.b.elite' },
        tank: { base: 'e.t.base', glow: 'e.t.glow', elite: 'e.t.elite' },
        sniper: { base: 'e.sn.base', glow: 'e.sn.glow', elite: 'e.sn.elite' },
        summoner: { base: 'e.su.base', glow: 'e.su.glow', elite: 'e.su.elite' },
        disruptor: { base: 'e.d.base', glow: 'e.d.glow', elite: 'e.d.elite' }
      },
      projectiles: { allied: 'p.a', enemy: 'p.e' },
      hazards: { ring: 'h.r', core: 'h.c' },
      pickups: { chest: 'pk.c', xp: 'pk.x' }
    },
    player: { base: white, aura: white },
    enemies: {
      swarmer: { base: white, glow: white, elite: white },
      charger: { base: white, glow: white, elite: white },
      bruiser: { base: white, glow: white, elite: white },
      tank: { base: white, glow: white, elite: white },
      sniper: { base: white, glow: white, elite: white },
      summoner: { base: white, glow: white, elite: white },
      disruptor: { base: white, glow: white, elite: white }
    },
    projectiles: { allied: white, enemy: white },
    hazards: { ring: white, core: white },
    pickups: { chest: white, xp: white }
  };
}

describe('enemy sprite factory', () => {
  it('maps role + elite state to deterministic texture variant keys', () => {
    expect(enemyTextureVariantForRole('swarmer', false)).toBe('swarmer.base');
    expect(enemyTextureVariantForRole('swarmer', true)).toBe('swarmer.elite');
  });

  it('returns texture-backed sprite when texture pack is available', () => {
    const sprite = createEnemySprite({
      role: 'charger',
      radius: 12,
      fill: 0x88aaff,
      stroke: 0xffffff,
      isElite: false,
      crownColor: 0xffdd88,
      outlineStrength: 1,
      texturePack: makePack(),
      textureDetail: 'ultra'
    });
    expect(sprite).toBeInstanceOf(Sprite);
  });

  it('falls back to graphics in low texture detail mode', () => {
    const node = createEnemySprite({
      role: 'charger',
      radius: 12,
      fill: 0x88aaff,
      stroke: 0xffffff,
      isElite: false,
      crownColor: 0xffdd88,
      outlineStrength: 1,
      texturePack: makePack(),
      textureDetail: 'low'
    });
    expect(node).toBeInstanceOf(Graphics);
  });
});
