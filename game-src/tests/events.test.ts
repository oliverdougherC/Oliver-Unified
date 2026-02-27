import { describe, expect, it } from 'vitest';
import { getActiveRunEvent, getRunEventDescription, getRunEventLabel } from '@/data/events';

describe('run events', () => {
  it('activates the expected modifier for each configured window', () => {
    const before = getActiveRunEvent(40);
    const bloodMonsoon = getActiveRunEvent(70);
    const ironCanopy = getActiveRunEvent(120);
    const voidHowl = getActiveRunEvent(180);
    const after = getActiveRunEvent(240);

    expect(before).toBeNull();
    expect(bloodMonsoon?.id).toBe('blood_monsoon');
    expect(ironCanopy?.id).toBe('iron_canopy');
    expect(voidHowl?.id).toBe('void_howl');
    expect(after).toBeNull();
  });

  it('returns label and description text for hud presentation', () => {
    expect(getRunEventLabel(null)).toBe('None');
    expect(getRunEventDescription(null)).toBe('');
    expect(getRunEventLabel('blood_monsoon')).toBe('Blood Monsoon');
    expect(getRunEventDescription('iron_canopy')).toContain('fortresses');
  });
});
