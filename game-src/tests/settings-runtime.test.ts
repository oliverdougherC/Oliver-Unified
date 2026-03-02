import { DEBUG_KEY, DEFAULT_SETTINGS, loadSettings, normalizeSettings, parseOptions } from '../src/runtime/settings';

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
    expect(normalized.rendererPolicy).toBe(DEFAULT_SETTINGS.rendererPolicy);
    expect(normalized.safariSafeMode).toBe(DEFAULT_SETTINGS.safariSafeMode);
    expect(normalized.quality).toBe('medium');
    expect(normalized.audioEnabled).toBe(false);
    expect(normalized.audioVolume).toBe(0.2);
    expect(normalized.motionScale).toBe(0.4);
    expect(normalized.visualPreset).toBe('bioluminescent');
    expect(normalized.sceneStyle).toBe('painterly_forest');
    expect(normalized.combatReadabilityMode).toBe('auto');
    expect(normalized.colorVisionMode).toBe(DEFAULT_SETTINGS.colorVisionMode);
    expect(normalized.uiScale).toBe(DEFAULT_SETTINGS.uiScale);
    expect(normalized.screenShake).toBe(DEFAULT_SETTINGS.screenShake);
    expect(normalized.hazardOpacity).toBe(DEFAULT_SETTINGS.hazardOpacity);
    expect(normalized.hitFlashStrength).toBe(DEFAULT_SETTINGS.hitFlashStrength);
    expect(normalized.enemyOutlineStrength).toBe(DEFAULT_SETTINGS.enemyOutlineStrength);
    expect(normalized.backgroundDensity).toBe(DEFAULT_SETTINGS.backgroundDensity);
    expect(normalized.atmosphereStrength).toBe(DEFAULT_SETTINGS.atmosphereStrength);
    expect(normalized.showDirectionalIndicators).toBe(DEFAULT_SETTINGS.showDirectionalIndicators);
    expect(normalized.lightingQuality).toBe(DEFAULT_SETTINGS.lightingQuality);
    expect(normalized.shadowQuality).toBe(DEFAULT_SETTINGS.shadowQuality);
    expect(normalized.fogQuality).toBe(DEFAULT_SETTINGS.fogQuality);
    expect(normalized.bloomStrength).toBe(DEFAULT_SETTINGS.bloomStrength);
    expect(normalized.gamma).toBe(DEFAULT_SETTINGS.gamma);
    expect(normalized.environmentContrast).toBe(DEFAULT_SETTINGS.environmentContrast);
    expect(normalized.materialDetail).toBe(DEFAULT_SETTINGS.materialDetail);
    expect(normalized.clarityPreset).toBe(DEFAULT_SETTINGS.clarityPreset);
    expect(normalized.textureDetail).toBe(DEFAULT_SETTINGS.textureDetail);
    expect(normalized.edgeAntialiasing).toBe(DEFAULT_SETTINGS.edgeAntialiasing);
    expect(normalized.resolutionProfile).toBe(DEFAULT_SETTINGS.resolutionProfile);
    expect(normalized.resolutionScale).toBe(DEFAULT_SETTINGS.resolutionScale);
    expect(normalized.postFxSoftness).toBe(DEFAULT_SETTINGS.postFxSoftness);
    expect(normalized.desktopUltraLock).toBe(DEFAULT_SETTINGS.desktopUltraLock);
  });

  it('applies query overrides while keeping defaults from stored settings', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'forestArcana.settings.v3',
      JSON.stringify({
        rendererPreference: 'auto',
        rendererPolicy: 'auto',
        safariSafeMode: true,
        quality: 'high',
        audioEnabled: true,
        audioVolume: 0.7,
        motionScale: 0.6,
        sceneStyle: 'painterly_forest',
        combatReadabilityMode: 'auto',
        colorVisionMode: 'tritanopia',
        uiScale: 1.1,
        screenShake: 0.8,
        hazardOpacity: 0.75,
        hitFlashStrength: 0.7,
        enemyOutlineStrength: 1.02,
        backgroundDensity: 0.62,
        atmosphereStrength: 0.48,
        lightingQuality: 'high',
        shadowQuality: 'soft',
        fogQuality: 'volumetric',
        bloomStrength: 0.42,
        gamma: 1,
        environmentContrast: 0.96,
        materialDetail: 'full',
        clarityPreset: 'balanced',
        textureDetail: 'high',
        edgeAntialiasing: 'fxaa',
        resolutionProfile: 'balanced',
        resolutionScale: 1,
        postFxSoftness: 0.15,
        desktopUltraLock: false,
        showDamageNumbers: false,
        showDirectionalIndicators: true
      })
    );

    const options = parseOptions(
      'http://localhost:5174/?renderer=webgpu&rendererPolicy=prefer_webgl&safariSafeMode=0&audio=0&volume=45&motion=25&colorVision=deuteranopia&combatReadabilityMode=always_on&hazardOpacity=60&hitFlash=40&enemyOutline=120&bgDensity=54&atmosphere=22&indicators=0&lightingQuality=cinematic&shadowQuality=hard&fogQuality=layered&bloom=35&gamma=1.1&contrast=1.17&materialDetail=reduced&clarityPreset=competitive&textureDetail=ultra&edgeAntialiasing=supersample&resolutionProfile=quality&resolutionScale=1.22&postFxSoftness=22&desktopUltraLock=1',
      storage
    );

    expect(options.rendererPreference).toBe('webgpu');
    expect(options.rendererPolicy).toBe('prefer_webgl');
    expect(options.safariSafeMode).toBe(false);
    expect(options.audioEnabled).toBe(false);
    expect(options.audioVolume).toBe(0.45);
    expect(options.motionScale).toBe(0.25);
    expect(options.colorVisionMode).toBe('deuteranopia');
    expect(options.combatReadabilityMode).toBe('always_on');
    expect(options.hazardOpacity).toBe(0.6);
    expect(options.hitFlashStrength).toBe(0.4);
    expect(options.enemyOutlineStrength).toBe(1.2);
    expect(options.backgroundDensity).toBe(0.54);
    expect(options.atmosphereStrength).toBe(0.22);
    expect(options.showDirectionalIndicators).toBe(false);
    expect(options.uiScale).toBe(1.1);
    expect(options.screenShake).toBe(0.8);
    expect(options.lightingQuality).toBe('cinematic');
    expect(options.shadowQuality).toBe('hard');
    expect(options.fogQuality).toBe('layered');
    expect(options.bloomStrength).toBe(0.35);
    expect(options.gamma).toBe(1.1);
    expect(options.environmentContrast).toBe(1.17);
    expect(options.materialDetail).toBe('reduced');
    expect(options.clarityPreset).toBe('competitive');
    expect(options.textureDetail).toBe('ultra');
    expect(options.edgeAntialiasing).toBe('supersample');
    expect(options.resolutionProfile).toBe('quality');
    expect(options.resolutionScale).toBe(1.22);
    expect(options.postFxSoftness).toBe(0.22);
    expect(options.desktopUltraLock).toBe(true);
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
    expect(settings.sceneStyle).toBe('painterly_forest');
  });

  it('survives storage read/write failures during options parsing', () => {
    class RestrictedStorage extends MemoryStorage {
      override getItem(_key: string): string | null {
        throw new Error('blocked read');
      }

      override setItem(_key: string, _value: string): void {
        throw new Error('blocked write');
      }
    }

    const storage = new RestrictedStorage();
    expect(() => parseOptions('http://localhost:5174/?debug=1&audio=0', storage)).not.toThrow();
    const options = parseOptions('http://localhost:5174/?debug=1&audio=0', storage);

    expect(options.debugMode).toBe(true);
    expect(options.audioEnabled).toBe(false);
  });

  it('reads debug overlay from persisted v3 settings payload', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'forestArcana.settings.v3',
      JSON.stringify({
        rendererPreference: 'auto',
        rendererPolicy: 'auto',
        safariSafeMode: true,
        quality: 'high',
        audioEnabled: true,
        audioVolume: 0.7,
        motionScale: 1,
        debugOverlayEnabled: true
      })
    );

    const options = parseOptions('http://localhost:5174/', storage);
    expect(options.debugMode).toBe(true);
    expect(storage.getItem(DEBUG_KEY)).toBe('1');
  });
});
