import type { ColorVisionMode, QueryOptions, QualityTier, RendererPreference, VisualPreset } from '../types';
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
  colorVisionMode: ColorVisionMode;
  uiScale: number;
  screenShake: number;
  hazardOpacity: number;
  hitFlashStrength: number;
  showDamageNumbers: boolean;
  showDirectionalIndicators: boolean;
}

export const DEFAULT_SETTINGS: RuntimeSettingsPayload = {
  rendererPreference: 'auto',
  quality: 'high',
  audioEnabled: true,
  audioVolume: 0.7,
  motionScale: 1,
  visualPreset: 'bioluminescent',
  colorVisionMode: 'normal',
  uiScale: 1,
  screenShake: 1,
  hazardOpacity: 0.9,
  hitFlashStrength: 0.9,
  showDamageNumbers: false,
  showDirectionalIndicators: true
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
    colorVisionMode: parseColorVisionMode(source.colorVisionMode ?? null),
    uiScale: parseNumber(source.uiScale, DEFAULT_SETTINGS.uiScale, 0.9, 1.25),
    screenShake: parseNumber(source.screenShake, DEFAULT_SETTINGS.screenShake, 0, 1),
    hazardOpacity: parseNumber(source.hazardOpacity, DEFAULT_SETTINGS.hazardOpacity, 0.45, 1),
    hitFlashStrength: parseNumber(source.hitFlashStrength, DEFAULT_SETTINGS.hitFlashStrength, 0, 1),
    showDamageNumbers: parseBoolean(source.showDamageNumbers, DEFAULT_SETTINGS.showDamageNumbers),
    showDirectionalIndicators: parseBoolean(
      source.showDirectionalIndicators,
      DEFAULT_SETTINGS.showDirectionalIndicators
    )
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
  const uiScaleParam = url.searchParams.get('uiScale');
  const uiScaleRaw = uiScaleParam === null ? Number.NaN : Number(uiScaleParam);
  const uiScaleFromQuery = Number.isFinite(uiScaleRaw) ? clamp(uiScaleRaw, 0.9, 1.25) : null;
  const colorVisionParam = url.searchParams.get('colorVision');
  const colorVisionFromQuery = colorVisionParam === null ? null : parseColorVisionMode(colorVisionParam);
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
    colorVisionMode: colorVisionFromQuery ?? settings.colorVisionMode,
    uiScale: uiScaleFromQuery ?? settings.uiScale,
    screenShake: shakeFromQuery ?? settings.screenShake,
    hazardOpacity: hazardFromQuery ?? settings.hazardOpacity,
    hitFlashStrength: flashFromQuery ?? settings.hitFlashStrength,
    showDamageNumbers,
    showDirectionalIndicators
  };
}
