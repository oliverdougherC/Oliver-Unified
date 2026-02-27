import { describe, expect, it } from 'vitest';
import { getActiveRunEvent, getRunEventDescription, getRunEventLabel } from '@/data/events';

describe('run events', () => {
  it('activates the expected modifier for each configured window', () => {
    const before = getActiveRunEvent(230);
    const verdantFog = getActiveRunEvent(250);
    const moonlitRush = getActiveRunEvent(430);
    const ancientBloom = getActiveRunEvent(620);
    const after = getActiveRunEvent(730);

    expect(before).toBeNull();
    expect(verdantFog?.id).toBe('verdant_fog');
    expect(moonlitRush?.id).toBe('moonlit_rush');
    expect(ancientBloom?.id).toBe('ancient_bloom');
    expect(after).toBeNull();
  });

  it('returns label and description text for hud presentation', () => {
    expect(getRunEventLabel(null)).toBe('None');
    expect(getRunEventDescription(null)).toBe('');
    expect(getRunEventLabel('verdant_fog')).toBe('Verdant Fog');
    expect(getRunEventDescription('ancient_bloom')).toContain('Ancient roots');
  });
});
