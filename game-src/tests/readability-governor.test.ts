import { ReadabilityGovernor } from '../src/render/readabilityGovernor';

describe('readability governor', () => {
  it('ramps suppression tier under high pressure and recovers with hysteresis', () => {
    const governor = new ReadabilityGovernor();
    let now = 0;

    let state = governor.update(
      {
        enemyCount: 8,
        hazardCount: 0,
        hostileProjectileCount: 0,
        p95FrameMs: 14,
        mode: 'auto'
      },
      now
    );
    expect(state.activeSuppressionTier).toBe('none');

    now += 420;
    state = governor.update(
      {
        enemyCount: 62,
        hazardCount: 12,
        hostileProjectileCount: 18,
        p95FrameMs: 22,
        mode: 'auto'
      },
      now
    );
    expect(state.threatLevel).toBeGreaterThan(0.2);
    expect(['none', 'light']).toContain(state.activeSuppressionTier);

    now += 400;
    state = governor.update(
      {
        enemyCount: 66,
        hazardCount: 16,
        hostileProjectileCount: 20,
        p95FrameMs: 26,
        mode: 'auto'
      },
      now
    );
    expect(['light', 'medium', 'hard']).toContain(state.activeSuppressionTier);

    const tierDuringPressure = state.activeSuppressionTier;
    now += 300;
    state = governor.update(
      {
        enemyCount: 2,
        hazardCount: 0,
        hostileProjectileCount: 0,
        p95FrameMs: 14,
        mode: 'auto'
      },
      now
    );
    expect(state.activeSuppressionTier).toBe(tierDuringPressure);

    now += 1900;
    state = governor.update(
      {
        enemyCount: 2,
        hazardCount: 0,
        hostileProjectileCount: 0,
        p95FrameMs: 14,
        mode: 'auto'
      },
      now
    );
    expect(['none', 'light']).toContain(state.activeSuppressionTier);
  });

  it('respects mode overrides', () => {
    const governor = new ReadabilityGovernor();
    const alwaysOn = governor.update(
      {
        enemyCount: 0,
        hazardCount: 0,
        hostileProjectileCount: 0,
        p95FrameMs: 14,
        mode: 'always_on'
      },
      1000
    );
    expect(alwaysOn.activeSuppressionTier).toBe('light');

    const off = governor.update(
      {
        enemyCount: 66,
        hazardCount: 16,
        hostileProjectileCount: 20,
        p95FrameMs: 28,
        mode: 'off'
      },
      3000
    );
    expect(off.activeSuppressionTier).toBe('none');
  });
});
