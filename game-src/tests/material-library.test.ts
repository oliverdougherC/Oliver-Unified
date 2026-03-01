import { getEnemyMaterial, getMaterial, materialTint } from '../src/render/materialLibrary';

describe('material library', () => {
  it('exposes all required base material kinds', () => {
    expect(getMaterial('bark').kind).toBe('bark');
    expect(getMaterial('moss').kind).toBe('moss');
    expect(getMaterial('stone').kind).toBe('stone');
    expect(getMaterial('fungal').kind).toBe('fungal');
    expect(getMaterial('arcane').kind).toBe('arcane');
    expect(getMaterial('flesh').kind).toBe('flesh');
    expect(getMaterial('energy').kind).toBe('energy');
  });

  it('maps enemy roles to a deterministic material profile', () => {
    expect(getEnemyMaterial('tank').kind).toBe('stone');
    expect(getEnemyMaterial('summoner').kind).toBe('fungal');
    expect(getEnemyMaterial('charger').kind).toBe('arcane');
  });

  it('produces valid tint colors from light intensity', () => {
    const material = getMaterial('moss');
    const low = materialTint(material, 0.4);
    const high = materialTint(material, 1.6);
    expect(low).toBeGreaterThanOrEqual(0);
    expect(low).toBeLessThanOrEqual(0xffffff);
    expect(high).toBeGreaterThanOrEqual(0);
    expect(high).toBeLessThanOrEqual(0xffffff);
    expect(high).not.toBe(low);
  });
});
