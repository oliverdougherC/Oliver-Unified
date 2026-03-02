import { describe, expect, it } from 'vitest';
import { createVisualTheme } from '@/render/visualTheme';
import { buildTexturePackManifest } from '@/render/textureBaker';

describe('texture baker manifest', () => {
  it('builds deterministic and non-empty texture handles', () => {
    const theme = createVisualTheme('normal');
    const first = buildTexturePackManifest(theme, 'ultra');
    const second = buildTexturePackManifest(theme, 'ultra');

    expect(first).toEqual(second);
    expect(first.key.length).toBeGreaterThan(4);
    expect(first.player.base).toContain('player.base');
    expect(first.enemies.swarmer.base).toContain('enemy.swarmer.base');
    expect(first.projectiles.allied).toContain('projectile.allied');
    expect(first.hazards.ring).toContain('hazard.ring');
    expect(first.pickups.xp).toContain('pickup.xp');
  });
});
