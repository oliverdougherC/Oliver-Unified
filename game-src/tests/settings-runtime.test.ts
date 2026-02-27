import { DEFAULT_SETTINGS, loadSettings, normalizeSettings, parseOptions } from '../src/runtime/settings';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe('runtime settings', () => {
  it('migrates partial legacy settings with defaults for new visual fields', () => {
    const normalized = normalizeSettings({
      rendererPreference: 'webgl',
      quality: 'medium',
      audioEnabled: false,
      audioVolume: 0.2,
      motionScale: 0.4
    });

    expect(normalized.rendererPreference).toBe('webgl');
    expect(normalized.quality).toBe('medium');
    expect(normalized.audioEnabled).toBe(false);
    expect(normalized.audioVolume).toBe(0.2);
    expect(normalized.motionScale).toBe(0.4);
    expect(normalized.visualPreset).toBe('bioluminescent');
    expect(normalized.colorVisionMode).toBe(DEFAULT_SETTINGS.colorVisionMode);
    expect(normalized.uiScale).toBe(DEFAULT_SETTINGS.uiScale);
    expect(normalized.screenShake).toBe(DEFAULT_SETTINGS.screenShake);
    expect(normalized.hazardOpacity).toBe(DEFAULT_SETTINGS.hazardOpacity);
    expect(normalized.hitFlashStrength).toBe(DEFAULT_SETTINGS.hitFlashStrength);
    expect(normalized.showDirectionalIndicators).toBe(DEFAULT_SETTINGS.showDirectionalIndicators);
  });

  it('applies query overrides while keeping defaults from stored settings', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'forestArcana.settings.v3',
      JSON.stringify({
        rendererPreference: 'auto',
        quality: 'high',
        audioEnabled: true,
        audioVolume: 0.7,
        motionScale: 0.6,
        colorVisionMode: 'tritanopia',
        uiScale: 1.1,
        screenShake: 0.8,
        hazardOpacity: 0.75,
        hitFlashStrength: 0.7,
        showDamageNumbers: false,
        showDirectionalIndicators: true
      })
    );

    const options = parseOptions(
      'http://localhost:5174/?renderer=webgpu&audio=0&volume=45&motion=25&colorVision=deuteranopia&hazardOpacity=60&hitFlash=40&indicators=0',
      storage
    );

    expect(options.rendererPreference).toBe('webgpu');
    expect(options.audioEnabled).toBe(false);
    expect(options.audioVolume).toBe(0.45);
    expect(options.motionScale).toBe(0.25);
    expect(options.colorVisionMode).toBe('deuteranopia');
    expect(options.hazardOpacity).toBe(0.6);
    expect(options.hitFlashStrength).toBe(0.4);
    expect(options.showDirectionalIndicators).toBe(false);
    expect(options.uiScale).toBe(1.1);
    expect(options.screenShake).toBe(0.8);
  });

  it('loads legacy v2 settings payloads when v3 key is absent', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'forestArcana.settings.v2',
      JSON.stringify({
        rendererPreference: 'webgl',
        quality: 'medium',
        audioEnabled: true,
        audioVolume: 0.5,
        motionScale: 0.4
      })
    );

    const settings = loadSettings(storage);
    expect(settings.rendererPreference).toBe('webgl');
    expect(settings.quality).toBe('medium');
    expect(settings.audioVolume).toBe(0.5);
    expect(settings.motionScale).toBe(0.4);
    expect(settings.visualPreset).toBe('bioluminescent');
  });
});
