import type {
  CombatReadabilityMode,
  ClarityPreset,
  ColorVisionMode,
  FogQuality,
  LightingQuality,
  MaterialDetail,
  QueryOptions,
  QualityTier,
  RendererPreference,
  SceneStyle,
  ShadowQuality,
  VisualPreset
} from '../types';
import { parseSeedFromQuery } from '../core/rng';

export const SETTINGS_KEY = 'forestArcana.settings.v3';
const LEGACY_SETTINGS_KEYS = ['forestArcana.settings.v2'];
export const DEBUG_KEY = 'forestArcana.debug.v1';

export interface RuntimeSettingsPayload {
  rendererPreference: RendererPreference;
  quality: QualityTier;
  audioEnabled: boolean;
  audioVolume: number;
  motionScale: number;
  visualPreset: VisualPreset;
  sceneStyle: SceneStyle;
  combatReadabilityMode: CombatReadabilityMode;
  colorVisionMode: ColorVisionMode;
  uiScale: number;
  screenShake: number;
  hazardOpacity: number;
  hitFlashStrength: number;
  enemyOutlineStrength: number;
  backgroundDensity: number;
  atmosphereStrength: number;
  showDamageNumbers: boolean;
  showDirectionalIndicators: boolean;
  lightingQuality: LightingQuality;
  shadowQuality: ShadowQuality;
  fogQuality: FogQuality;
  bloomStrength: number;
  gamma: number;
  environmentContrast: number;
  materialDetail: MaterialDetail;
  clarityPreset: ClarityPreset;
}

export const DEFAULT_SETTINGS: RuntimeSettingsPayload = {
  rendererPreference: 'auto',
  quality: 'high',
  audioEnabled: true,
  audioVolume: 0.7,
  motionScale: 1,
  visualPreset: 'bioluminescent',
  sceneStyle: 'painterly_forest',
  combatReadabilityMode: 'auto',
  colorVisionMode: 'normal',
  uiScale: 1,
  screenShake: 1,
  hazardOpacity: 0.9,
  hitFlashStrength: 0.9,
  enemyOutlineStrength: 1,
  backgroundDensity: 0.78,
  atmosphereStrength: 0.62,
  showDamageNumbers: false,
  showDirectionalIndicators: true,
  lightingQuality: 'high',
  shadowQuality: 'soft',
  fogQuality: 'volumetric',
  bloomStrength: 0.6,
  gamma: 1,
  environmentContrast: 1,
  materialDetail: 'full',
  clarityPreset: 'balanced'
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function parseRendererPreference(value: string | null): RendererPreference {
  if (value === 'webgpu' || value === 'webgl' || value === 'auto') return value;
  return DEFAULT_SETTINGS.rendererPreference;
}

export function parseColorVisionMode(value: string | null): ColorVisionMode {
  if (value === 'deuteranopia' || value === 'protanopia' || value === 'tritanopia' || value === 'normal') {
    return value;
  }
  return DEFAULT_SETTINGS.colorVisionMode;
}

export function parseSceneStyle(value: unknown): SceneStyle {
  if (value === 'painterly_forest') return value;
  return DEFAULT_SETTINGS.sceneStyle;
}

export function parseCombatReadabilityMode(value: unknown): CombatReadabilityMode {
  if (value === 'auto' || value === 'always_on' || value === 'off') return value;
  return DEFAULT_SETTINGS.combatReadabilityMode;
}

export function parseLightingQuality(value: unknown): LightingQuality {
  if (value === 'cinematic' || value === 'high' || value === 'medium' || value === 'low') return value;
  return DEFAULT_SETTINGS.lightingQuality;
}

export function parseShadowQuality(value: unknown): ShadowQuality {
  if (value === 'soft' || value === 'hard' || value === 'off') return value;
  return DEFAULT_SETTINGS.shadowQuality;
}

export function parseFogQuality(value: unknown): FogQuality {
  if (value === 'volumetric' || value === 'layered' || value === 'off') return value;
  return DEFAULT_SETTINGS.fogQuality;
}

export function parseMaterialDetail(value: unknown): MaterialDetail {
  if (value === 'full' || value === 'reduced') return value;
  return DEFAULT_SETTINGS.materialDetail;
}

export function parseClarityPreset(value: unknown): ClarityPreset {
  if (value === 'cinematic' || value === 'balanced' || value === 'competitive') return value;
  return DEFAULT_SETTINGS.clarityPreset;
}

function parseQuality(value: unknown): QualityTier {
  return value === 'low' || value === 'medium' || value === 'high' ? value : DEFAULT_SETTINGS.quality;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === '1' || value.toLowerCase() === 'true') return true;
    if (value === '0' || value.toLowerCase() === 'false') return false;
  }
  return fallback;
}

function parseNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
}

function parsePercentFromQuery(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0) return 0;
  if (parsed > 1) return clamp(parsed / 100, 0, 1);
  return parsed;
}

function parseAudioFlag(value: string | null): boolean | null {
  if (value === '1') return true;
  if (value === '0') return false;
  return null;
}

export function normalizeSettings(raw: Partial<RuntimeSettingsPayload> | null | undefined): RuntimeSettingsPayload {
  const source = raw ?? {};
  return {
    rendererPreference: parseRendererPreference(source.rendererPreference ?? null),
    quality: parseQuality(source.quality),
    audioEnabled: parseBoolean(source.audioEnabled, DEFAULT_SETTINGS.audioEnabled),
    audioVolume: parseNumber(source.audioVolume, DEFAULT_SETTINGS.audioVolume, 0, 1),
    motionScale: parseNumber(source.motionScale, DEFAULT_SETTINGS.motionScale, 0, 1),
    visualPreset: 'bioluminescent',
    sceneStyle: parseSceneStyle(source.sceneStyle),
    combatReadabilityMode: parseCombatReadabilityMode(source.combatReadabilityMode),
    colorVisionMode: parseColorVisionMode(source.colorVisionMode ?? null),
    uiScale: parseNumber(source.uiScale, DEFAULT_SETTINGS.uiScale, 0.9, 1.25),
    screenShake: parseNumber(source.screenShake, DEFAULT_SETTINGS.screenShake, 0, 1),
    hazardOpacity: parseNumber(source.hazardOpacity, DEFAULT_SETTINGS.hazardOpacity, 0.45, 1),
    hitFlashStrength: parseNumber(source.hitFlashStrength, DEFAULT_SETTINGS.hitFlashStrength, 0, 1),
    enemyOutlineStrength: parseNumber(
      source.enemyOutlineStrength,
      DEFAULT_SETTINGS.enemyOutlineStrength,
      0.5,
      1.5
    ),
    backgroundDensity: parseNumber(source.backgroundDensity, DEFAULT_SETTINGS.backgroundDensity, 0.25, 1),
    atmosphereStrength: parseNumber(source.atmosphereStrength, DEFAULT_SETTINGS.atmosphereStrength, 0, 1),
    showDamageNumbers: parseBoolean(source.showDamageNumbers, DEFAULT_SETTINGS.showDamageNumbers),
    showDirectionalIndicators: parseBoolean(
      source.showDirectionalIndicators,
      DEFAULT_SETTINGS.showDirectionalIndicators
    ),
    lightingQuality: parseLightingQuality(source.lightingQuality),
    shadowQuality: parseShadowQuality(source.shadowQuality),
    fogQuality: parseFogQuality(source.fogQuality),
    bloomStrength: parseNumber(source.bloomStrength, DEFAULT_SETTINGS.bloomStrength, 0, 1),
    gamma: parseNumber(source.gamma, DEFAULT_SETTINGS.gamma, 0.85, 1.2),
    environmentContrast: parseNumber(
      source.environmentContrast,
      DEFAULT_SETTINGS.environmentContrast,
      0.8,
      1.25
    ),
    materialDetail: parseMaterialDetail(source.materialDetail),
    clarityPreset: parseClarityPreset(source.clarityPreset)
  };
}

export function loadSettings(storage: Storage): RuntimeSettingsPayload {
  try {
    const current = storage.getItem(SETTINGS_KEY);
    const fallbackRaw =
      current ??
      LEGACY_SETTINGS_KEYS.map((key) => storage.getItem(key)).find((value) => value !== null) ??
      '{}';
    const raw = JSON.parse(fallbackRaw) as Partial<RuntimeSettingsPayload>;
    return normalizeSettings(raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(storage: Storage, next: RuntimeSettingsPayload): void {
  storage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(next)));
}

export function parseOptions(locationHref: string, storage: Storage): QueryOptions {
  const url = new URL(locationHref);
  const settings = loadSettings(storage);
  const rendererPreference = parseRendererPreference(url.searchParams.get('renderer') || settings.rendererPreference);
  const debugFromQuery = url.searchParams.get('debug');
  const seed = parseSeedFromQuery(url.searchParams.get('seed'));

  const audioFlagFromQuery = parseAudioFlag(url.searchParams.get('audio'));
  const volumeFromQuery = parsePercentFromQuery(url.searchParams.get('volume'));
  const motionFromQuery = parsePercentFromQuery(url.searchParams.get('motion'));
  const shakeFromQuery = parsePercentFromQuery(url.searchParams.get('shake'));
  const hazardFromQuery = parsePercentFromQuery(url.searchParams.get('hazardOpacity'));
  const flashFromQuery = parsePercentFromQuery(url.searchParams.get('hitFlash'));
  const enemyOutlineParam = url.searchParams.get('enemyOutline');
  const enemyOutlineRaw = enemyOutlineParam === null ? Number.NaN : Number(enemyOutlineParam);
  const enemyOutlineFromQuery = Number.isFinite(enemyOutlineRaw)
    ? clamp(enemyOutlineRaw > 3 ? enemyOutlineRaw / 100 : enemyOutlineRaw, 0.5, 1.5)
    : null;
  const backgroundDensityFromQuery = parsePercentFromQuery(url.searchParams.get('bgDensity'));
  const atmosphereFromQuery = parsePercentFromQuery(url.searchParams.get('atmosphere'));
  const uiScaleParam = url.searchParams.get('uiScale');
  const uiScaleRaw = uiScaleParam === null ? Number.NaN : Number(uiScaleParam);
  const uiScaleFromQuery = Number.isFinite(uiScaleRaw) ? clamp(uiScaleRaw, 0.9, 1.25) : null;
  const colorVisionParam = url.searchParams.get('colorVision');
  const colorVisionFromQuery = colorVisionParam === null ? null : parseColorVisionMode(colorVisionParam);
  const sceneStyle = parseSceneStyle(url.searchParams.get('sceneStyle') ?? settings.sceneStyle);
  const combatReadabilityMode = parseCombatReadabilityMode(
    url.searchParams.get('combatReadabilityMode') ?? settings.combatReadabilityMode
  );
  const lightingQuality = parseLightingQuality(url.searchParams.get('lightingQuality') ?? settings.lightingQuality);
  const shadowQuality = parseShadowQuality(url.searchParams.get('shadowQuality') ?? settings.shadowQuality);
  const fogQuality = parseFogQuality(url.searchParams.get('fogQuality') ?? settings.fogQuality);
  const bloomFromQuery = parsePercentFromQuery(url.searchParams.get('bloom'));
  const gammaParam = url.searchParams.get('gamma');
  const gammaRaw = gammaParam === null ? Number.NaN : Number(gammaParam);
  const gamma = Number.isFinite(gammaRaw) ? clamp(gammaRaw, 0.85, 1.2) : settings.gamma;
  const contrastParam = url.searchParams.get('contrast');
  const contrastRaw = contrastParam === null ? Number.NaN : Number(contrastParam);
  const environmentContrast = Number.isFinite(contrastRaw) ? clamp(contrastRaw, 0.8, 1.25) : settings.environmentContrast;
  const materialDetail = parseMaterialDetail(url.searchParams.get('materialDetail') ?? settings.materialDetail);
  const clarityPreset = parseClarityPreset(url.searchParams.get('clarityPreset') ?? settings.clarityPreset);
  const showDamageNumbers =
    url.searchParams.get('damageNumbers') === null
      ? settings.showDamageNumbers
      : url.searchParams.get('damageNumbers') === '1';
  const showDirectionalIndicators =
    url.searchParams.get('indicators') === null
      ? settings.showDirectionalIndicators
      : url.searchParams.get('indicators') !== '0';

  const debugMode = debugFromQuery === '1' || (debugFromQuery !== '0' && storage.getItem(DEBUG_KEY) === '1');
  storage.setItem(DEBUG_KEY, debugMode ? '1' : '0');

  return {
    rendererPreference,
    debugMode,
    seed,
    audioEnabled: audioFlagFromQuery ?? settings.audioEnabled,
    audioVolume: volumeFromQuery ?? settings.audioVolume,
    motionScale: motionFromQuery ?? settings.motionScale,
    visualPreset: 'bioluminescent',
    sceneStyle,
    combatReadabilityMode,
    colorVisionMode: colorVisionFromQuery ?? settings.colorVisionMode,
    uiScale: uiScaleFromQuery ?? settings.uiScale,
    screenShake: shakeFromQuery ?? settings.screenShake,
    hazardOpacity: hazardFromQuery ?? settings.hazardOpacity,
    hitFlashStrength: flashFromQuery ?? settings.hitFlashStrength,
    enemyOutlineStrength: enemyOutlineFromQuery ?? settings.enemyOutlineStrength,
    backgroundDensity: backgroundDensityFromQuery ?? settings.backgroundDensity,
    atmosphereStrength: atmosphereFromQuery ?? settings.atmosphereStrength,
    showDamageNumbers,
    showDirectionalIndicators,
    lightingQuality,
    shadowQuality,
    fogQuality,
    bloomStrength: bloomFromQuery ?? settings.bloomStrength,
    gamma,
    environmentContrast,
    materialDetail,
    clarityPreset
  };
}
