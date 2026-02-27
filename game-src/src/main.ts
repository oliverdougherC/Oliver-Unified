import { FixedStepLoop, type LoopStats } from './core/loop';
import { AudioManager } from './audio/audioManager';
import { GameWorld } from './core/world';
import { CATALYST_DEFINITIONS } from './data/catalysts';
import { getRunEventDescription, getRunEventLabel } from './data/events';
import { WEAPON_ARCHETYPES } from './data/weapons';
import { PixiRenderAdapter } from './render/pixiRenderAdapter';
import {
  clamp,
  loadSettings,
  parseColorVisionMode,
  parseOptions,
  parseRendererPreference,
  saveSettings,
  type RuntimeSettingsPayload
} from './runtime/settings';
import type { ISystem, LevelUpChoice, QualityTier } from './types';
import { AutoAttackSystem } from './systems/autoAttackSystem';
import { CleanupSystem } from './systems/cleanupSystem';
import { CollisionSystem } from './systems/collisionSystem';
import { EnemyAISystem } from './systems/enemyAISystem';
import { LevelSystem } from './systems/levelSystem';
import { MovementSystem } from './systems/movementSystem';
import { PlayerInputSystem } from './systems/playerInputSystem';
import { ProjectileSystem } from './systems/projectileSystem';
import { RuntimeSystem } from './systems/runtimeSystem';
import { SpawnSystem } from './systems/spawnSystem';
import { XpSystem } from './systems/xpSystem';

interface InventoryTileRefs {
  root: HTMLDivElement;
  title: HTMLElement;
  subtitle: HTMLElement;
}

function formatRunTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

function chooseQuality(smoothedMs: number, current: QualityTier): QualityTier {
  if (current === 'high') {
    if (smoothedMs > 24) return 'low';
    if (smoothedMs > 19) return 'medium';
    return current;
  }

  if (current === 'medium') {
    if (smoothedMs > 24) return 'low';
    if (smoothedMs < 16) return 'high';
    return current;
  }

  if (smoothedMs < 18) return 'medium';
  return current;
}

function keyToMovementFlag(key: string): 'up' | 'down' | 'left' | 'right' | null {
  if (key === 'w' || key === 'arrowup') return 'up';
  if (key === 's' || key === 'arrowdown') return 'down';
  if (key === 'a' || key === 'arrowleft') return 'left';
  if (key === 'd' || key === 'arrowright') return 'right';
  return null;
}

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: #${id}`);
  }
  return element as T;
}

function choiceRarity(choice: LevelUpChoice): 'common' | 'rare' | 'epic' | 'legendary' {
  return choice.rarity ?? 'common';
}

function createBuildSlotTile(): InventoryTileRefs {
  const root = document.createElement('div');
  root.className = 'build-slot empty';
  const title = document.createElement('strong');
  const subtitle = document.createElement('em');
  root.append(title, subtitle);
  return { root, title, subtitle };
}

async function main(): Promise<void> {
  const options = parseOptions(window.location.href, localStorage);
  const bootSettings = loadSettings(localStorage);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const world = new GameWorld(options.seed, prefersReducedMotion);
  const renderer = new PixiRenderAdapter();
  const audio = new AudioManager(options.audioEnabled);

  const gameShell = requireElement<HTMLElement>('gameShell');
  const gameRoot = requireElement<HTMLElement>('gameRoot');
  const bootScreen = requireElement<HTMLElement>('bootScreen');
  const startGameBtn = requireElement<HTMLButtonElement>('startGameBtn');
  const unsupportedPanel = requireElement<HTMLElement>('unsupportedPanel');
  const hud = requireElement<HTMLElement>('hud');
  const pauseBanner = requireElement<HTMLElement>('pauseBanner');
  const levelUpModal = requireElement<HTMLElement>('levelUpModal');
  const upgradeGrid = requireElement<HTMLElement>('upgradeGrid');
  const chestModal = requireElement<HTMLElement>('chestModal');
  const chestGrid = requireElement<HTMLElement>('chestGrid');
  const inventoryBar = requireElement<HTMLElement>('inventoryBar');
  const catalystBar = requireElement<HTMLElement>('catalystBar');
  const gameOverModal = requireElement<HTMLElement>('gameOverModal');
  const settingsPanel = requireElement<HTMLElement>('settingsPanel');
  const settingsToggleBtn = requireElement<HTMLButtonElement>('settingsToggleBtn');
  const settingsCloseBtn = requireElement<HTMLButtonElement>('settingsCloseBtn');
  const settingsApplyRendererBtn = requireElement<HTMLButtonElement>('settingsApplyRendererBtn');
  const settingsAudioEnabled = requireElement<HTMLInputElement>('settingsAudioEnabled');
  const settingsAudioVolume = requireElement<HTMLInputElement>('settingsAudioVolume');
  const settingsAudioVolumeValue = requireElement<HTMLElement>('settingsAudioVolumeValue');
  const settingsMotionIntensity = requireElement<HTMLInputElement>('settingsMotionIntensity');
  const settingsMotionIntensityValue = requireElement<HTMLElement>('settingsMotionIntensityValue');
  const settingsRendererPreference = requireElement<HTMLSelectElement>('settingsRendererPreference');
  const settingsColorVision = requireElement<HTMLSelectElement>('settingsColorVision');
  const settingsUiScale = requireElement<HTMLInputElement>('settingsUiScale');
  const settingsUiScaleValue = requireElement<HTMLElement>('settingsUiScaleValue');
  const settingsScreenShake = requireElement<HTMLInputElement>('settingsScreenShake');
  const settingsScreenShakeValue = requireElement<HTMLElement>('settingsScreenShakeValue');
  const settingsHazardOpacity = requireElement<HTMLInputElement>('settingsHazardOpacity');
  const settingsHazardOpacityValue = requireElement<HTMLElement>('settingsHazardOpacityValue');
  const settingsHitFlashStrength = requireElement<HTMLInputElement>('settingsHitFlashStrength');
  const settingsHitFlashStrengthValue = requireElement<HTMLElement>('settingsHitFlashStrengthValue');
  const settingsDamageNumbers = requireElement<HTMLInputElement>('settingsDamageNumbers');
  const settingsDirectionalIndicators = requireElement<HTMLInputElement>('settingsDirectionalIndicators');
  const restartRunBtn = requireElement<HTMLButtonElement>('restartRunBtn');
  const runSummary = requireElement<HTMLElement>('runSummary');
  const debugPanel = requireElement<HTMLElement>('debugPanel');

  const hudHpChip = requireElement<HTMLElement>('hudHpChip');
  const hudHp = requireElement<HTMLElement>('hudHp');
  const hudLevel = requireElement<HTMLElement>('hudLevel');
  const hudEnemies = requireElement<HTMLElement>('hudEnemies');
  const hudTime = requireElement<HTMLElement>('hudTime');
  const hudEventChip = requireElement<HTMLElement>('hudEventChip');
  const hudEvent = requireElement<HTMLElement>('hudEvent');
  const hudAudio = requireElement<HTMLElement>('hudAudio');
  const hudRenderer = requireElement<HTMLElement>('hudRenderer');
  const hudEvolutionReady = requireElement<HTMLElement>('hudEvolutionReady');
  const xpFill = requireElement<HTMLElement>('xpFill');

  const inventoryTiles: InventoryTileRefs[] = [];
  for (let i = 0; i < 4; i += 1) {
    const tile = createBuildSlotTile();
    inventoryBar.appendChild(tile.root);
    inventoryTiles.push(tile);
  }

  const hudCache = {
    hp: '',
    level: '',
    enemies: '',
    time: '',
    event: '',
    audio: '',
    xpWidth: '',
    eventDescription: '',
    evolutionReady: '',
    inventory: Array.from({ length: 4 }, () => ''),
    catalysts: ''
  };
  type HudStringCacheKey = 'hp' | 'level' | 'enemies' | 'time' | 'event' | 'audio';

  let pausedByVisibility = false;
  let pausedBySettings = false;
  let settingsOpen = false;
  let lastLevelSignature = '';
  let lastChestSignature = '';
  let preferredRenderer = options.rendererPreference;
  let audioEnabled = options.audioEnabled;
  let audioVolume = options.audioVolume;
  let motionScale = options.motionScale;
  let colorVisionMode = options.colorVisionMode;
  let uiScale = options.uiScale;
  let screenShake = options.screenShake;
  let hazardOpacity = options.hazardOpacity;
  let hitFlashStrength = options.hitFlashStrength;
  let showDamageNumbers = options.showDamageNumbers;
  let showDirectionalIndicators = options.showDirectionalIndicators;
  let previousShotsFired = 0;
  let previousPlayerHitCount = 0;
  let previousLevelUpOfferedCount = 0;
  let previousEliteKills = 0;
  let previousEventId: string | null = null;
  let previousUiState = world.uiState;
  let lastHeavyHudSyncAt = 0;
  let hudSyncMs = 0;

  world.setQuality(bootSettings.quality);

  function persistSettings(quality: QualityTier): void {
    const next: RuntimeSettingsPayload = {
      rendererPreference: preferredRenderer,
      quality,
      audioEnabled,
      audioVolume,
      motionScale,
      visualPreset: 'bioluminescent',
      colorVisionMode,
      uiScale,
      screenShake,
      hazardOpacity,
      hitFlashStrength,
      showDamageNumbers,
      showDirectionalIndicators
    };
    saveSettings(localStorage, next);
  }

  function applyVisualSettings(): void {
    const effectiveMotionScale = prefersReducedMotion ? Math.min(motionScale, 0.35) : motionScale;
    const effectiveScreenShake = prefersReducedMotion ? Math.min(screenShake, 0.2) : screenShake;

    renderer.setMotionScale(effectiveMotionScale);
    renderer.setVisualSettings({
      visualPreset: 'bioluminescent',
      colorVisionMode,
      motionScale: effectiveMotionScale,
      uiScale,
      screenShake: effectiveScreenShake,
      hazardOpacity,
      hitFlashStrength,
      showDamageNumbers,
      showDirectionalIndicators
    });

    gameShell.style.setProperty('--hud-scale', uiScale.toFixed(2));
    gameShell.dataset.colorVisionMode = colorVisionMode;
  }

  function syncTopChromeOffsets(): void {
    const shellRect = gameShell.getBoundingClientRect();
    const hudBottom = hud.classList.contains('hidden')
      ? 0
      : Math.max(0, hud.getBoundingClientRect().bottom - shellRect.top);
    const topAnchor = Math.max(88, Math.round(hudBottom + 8));
    gameShell.style.setProperty('--hud-stack-bottom', `${topAnchor}px`);
  }

  function syncSettingsControls(): void {
    settingsAudioEnabled.checked = audioEnabled;
    settingsAudioVolume.value = String(Math.round(audioVolume * 100));
    settingsAudioVolumeValue.textContent = `${Math.round(audioVolume * 100)}%`;
    settingsAudioVolume.disabled = !audioEnabled;

    settingsMotionIntensity.value = String(Math.round(motionScale * 100));
    settingsMotionIntensityValue.textContent = `${Math.round(motionScale * 100)}%`;

    settingsRendererPreference.value = preferredRenderer;
    settingsColorVision.value = colorVisionMode;
    settingsUiScale.value = String(Math.round(uiScale * 100));
    settingsUiScaleValue.textContent = `${Math.round(uiScale * 100)}%`;
    settingsScreenShake.value = String(Math.round(screenShake * 100));
    settingsScreenShakeValue.textContent = `${Math.round(screenShake * 100)}%`;
    settingsHazardOpacity.value = String(Math.round(hazardOpacity * 100));
    settingsHazardOpacityValue.textContent = `${Math.round(hazardOpacity * 100)}%`;
    settingsHitFlashStrength.value = String(Math.round(hitFlashStrength * 100));
    settingsHitFlashStrengthValue.textContent = `${Math.round(hitFlashStrength * 100)}%`;
    settingsDamageNumbers.checked = showDamageNumbers;
    settingsDirectionalIndicators.checked = showDirectionalIndicators;
  }

  try {
    const rendererKind = await renderer.init({
      mount: gameRoot,
      requestedRenderer: options.rendererPreference,
      reducedMotion: prefersReducedMotion
    });

    world.setRendererKind(rendererKind);
    renderer.setQuality(world.quality);
    applyVisualSettings();
    persistSettings(world.quality);

    audio.setEnabled(audioEnabled);
    audio.setVolume(audioVolume);
    hudRenderer.textContent = rendererKind;
  } catch (error) {
    console.error(error);
    unsupportedPanel.classList.remove('hidden');
    bootScreen.classList.add('hidden');
    hud.classList.add('hidden');
    return;
  }

  if (options.debugMode) {
    debugPanel.classList.remove('hidden');
  }

  syncTopChromeOffsets();
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => {
      syncTopChromeOffsets();
    });
    observer.observe(hud);
  }
  window.addEventListener('resize', syncTopChromeOffsets);

  const systems: ISystem<GameWorld>[] = [
    new RuntimeSystem(),
    new PlayerInputSystem(),
    new EnemyAISystem(),
    new AutoAttackSystem(),
    new SpawnSystem(),
    new XpSystem(),
    new MovementSystem(),
    new ProjectileSystem(),
    new CollisionSystem(),
    new LevelSystem(),
    new CleanupSystem()
  ];

  function renderLevelChoices(): void {
    const signature = world.pendingLevelChoices.map((choice) => choice.id).join('|');
    if (signature === lastLevelSignature) return;

    lastLevelSignature = signature;
    upgradeGrid.innerHTML = '';

    world.pendingLevelChoices.forEach((choice, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'upgrade-btn';
      button.dataset.rarity = choiceRarity(choice);
      button.innerHTML = `<strong>${index + 1}. ${choice.title}</strong><span>${choice.description}</span>`;
      button.addEventListener('click', () => {
        world.applyLevelChoice(choice.id);
        levelUpModal.classList.add('hidden');
      });
      upgradeGrid.appendChild(button);
    });
  }

  function renderChestChoices(): void {
    const signature = world.pendingChestChoices.map((choice) => choice.id).join('|');
    if (signature === lastChestSignature) return;

    lastChestSignature = signature;
    chestGrid.innerHTML = '';

    world.pendingChestChoices.forEach((choice, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'upgrade-btn';
      button.dataset.rarity = choice.choiceType === 'evolve' ? 'legendary' : 'epic';
      button.innerHTML = `<strong>${index + 1}. ${choice.title}</strong><span>${choice.description}</span>`;
      button.addEventListener('click', () => {
        world.applyChestChoice(choice.id);
        chestModal.classList.add('hidden');
      });
      chestGrid.appendChild(button);
    });
  }

  function chooseLevelChoiceByIndex(index: number): void {
    if (world.uiState !== 'levelup') return;
    const choice = world.pendingLevelChoices[index];
    if (!choice) return;
    world.applyLevelChoice(choice.id);
    levelUpModal.classList.add('hidden');
  }

  function chooseChestChoiceByIndex(index: number): void {
    if (world.uiState !== 'chest') return;
    const choice = world.pendingChestChoices[index];
    if (!choice) return;
    world.applyChestChoice(choice.id);
    chestModal.classList.add('hidden');
  }

  function clearMovementInput(): void {
    world.input.up = false;
    world.input.down = false;
    world.input.left = false;
    world.input.right = false;
  }

  function openSettings(): void {
    if (settingsOpen) return;
    settingsOpen = true;
    syncSettingsControls();
    settingsPanel.classList.remove('hidden');
    clearMovementInput();

    if (world.uiState === 'playing') {
      pausedBySettings = true;
      pauseRun('Paused - Settings Open');
    } else {
      pausedBySettings = false;
    }
  }

  function closeSettings(): void {
    if (!settingsOpen) return;
    settingsOpen = false;
    settingsPanel.classList.add('hidden');

    if (pausedBySettings && world.uiState === 'paused' && !document.hidden) {
      pausedBySettings = false;
      resumeRun();
    } else {
      pausedBySettings = false;
    }
  }

  function setIfChanged(element: HTMLElement, next: string, key: HudStringCacheKey): void {
    if (hudCache[key] === next) return;
    hudCache[key] = next;
    element.textContent = next;
  }

  function syncHud(forceHeavy = false): void {
    const hudStart = performance.now();

    setIfChanged(
      hudHp,
      `${Math.ceil(world.playerStats.hp)} / ${Math.ceil(world.playerStats.maxHp)}`,
      'hp'
    );
    setIfChanged(hudLevel, String(world.level), 'level');
    setIfChanged(hudEnemies, String(world.getEnemyCount()), 'enemies');
    setIfChanged(hudTime, formatRunTime(world.runTime), 'time');
    setIfChanged(hudEvent, getRunEventLabel(world.activeEventId), 'event');
    setIfChanged(hudAudio, audioEnabled ? 'On' : 'Off', 'audio');
    hudEventChip.classList.toggle('event-active', world.activeEventId !== null);

    const nextEventDescription = getRunEventDescription(world.activeEventId);
    if (hudCache.eventDescription !== nextEventDescription) {
      hudCache.eventDescription = nextEventDescription;
      hudEventChip.title = nextEventDescription;
    }

    const hpRatio = world.playerStats.maxHp > 0 ? world.playerStats.hp / world.playerStats.maxHp : 1;
    hudHpChip.classList.toggle('danger', hpRatio <= 0.3);
    const ratio = world.xpToNext > 0 ? Math.min(1, world.xp / world.xpToNext) : 0;
    const nextXpWidth = `${ratio * 100}%`;
    if (hudCache.xpWidth !== nextXpWidth) {
      hudCache.xpWidth = nextXpWidth;
      xpFill.style.width = nextXpWidth;
    }

    const now = performance.now();
    const shouldSyncHeavy = forceHeavy || now - lastHeavyHudSyncAt >= 100;
    if (shouldSyncHeavy) {
      lastHeavyHudSyncAt = now;

      for (const slot of world.inventorySlots) {
        const weapon = slot.itemId ? WEAPON_ARCHETYPES[slot.itemId] : null;
        const rarityClass = weapon?.rarity ?? 'common';
        const signature = `${slot.itemId ?? '-'}|${slot.rank}|${slot.isEvolved ? 1 : 0}|${rarityClass}`;
        if (hudCache.inventory[slot.slotIndex] === signature) continue;
        hudCache.inventory[slot.slotIndex] = signature;

        const tile = inventoryTiles[slot.slotIndex];
        const empty = !slot.itemId;
        tile.root.className = `build-slot ${empty ? 'empty' : ''} rarity-${rarityClass}`;
        tile.title.textContent = empty ? `Slot ${slot.slotIndex + 1}` : `S${slot.slotIndex + 1}: ${weapon?.name ?? slot.itemId}`;
        tile.subtitle.textContent = empty ? 'Empty' : `Rank ${slot.rank}${slot.isEvolved ? ' • Evolved' : ''}`;
      }

      const catalystEntries = Array.from(world.catalystRanks.entries()).sort(([a], [b]) => a.localeCompare(b));
      const catalystSignature = catalystEntries.map(([id, rank]) => `${id}:${rank}`).join('|');
      if (hudCache.catalysts !== catalystSignature) {
        hudCache.catalysts = catalystSignature;
        catalystBar.replaceChildren();
        if (catalystEntries.length === 0) {
          const tile = createBuildSlotTile();
          tile.root.className = 'build-slot empty';
          tile.title.textContent = 'Catalysts';
          tile.subtitle.textContent = 'None yet';
          catalystBar.appendChild(tile.root);
        } else {
          for (const [id, rank] of catalystEntries) {
            const catalyst = CATALYST_DEFINITIONS[id];
            const tile = createBuildSlotTile();
            const rarityClass = catalyst?.rarity === 'epic' ? 'legendary' : catalyst?.rarity ?? 'common';
            tile.root.className = `build-slot rarity-${rarityClass}`;
            tile.title.textContent = catalyst?.name ?? id;
            tile.subtitle.textContent = `Rank ${rank}`;
            catalystBar.appendChild(tile.root);
          }
        }
      }

      const readyCount = world.getEvolutionCandidates().length;
      const evolutionLabel = readyCount > 0 ? `${readyCount} Ready` : 'None';
      if (hudCache.evolutionReady !== evolutionLabel) {
        hudCache.evolutionReady = evolutionLabel;
        hudEvolutionReady.textContent = evolutionLabel;
      }
      hudEvolutionReady.classList.toggle('active', readyCount > 0);
    }

    hudSyncMs = performance.now() - hudStart;
    renderer.setHudSyncTime(hudSyncMs);
  }

  function syncAudioCues(): void {
    if (world.shotsFired > previousShotsFired) {
      const delta = Math.min(4, world.shotsFired - previousShotsFired);
      for (let i = 0; i < delta; i += 1) {
        audio.playShot();
      }
    }

    if (world.playerHitCount > previousPlayerHitCount) {
      audio.playPlayerHit();
    }

    if (world.levelUpOfferedCount > previousLevelUpOfferedCount) {
      audio.playLevelUp();
    }

    if (world.eliteKills > previousEliteKills) {
      audio.playEventStart();
    }

    if (world.activeEventId !== previousEventId && world.activeEventId) {
      audio.playEventStart();
    }

    if (previousUiState !== 'gameover' && world.uiState === 'gameover') {
      audio.playGameOver();
    }

    previousShotsFired = world.shotsFired;
    previousPlayerHitCount = world.playerHitCount;
    previousLevelUpOfferedCount = world.levelUpOfferedCount;
    previousEliteKills = world.eliteKills;
    previousEventId = world.activeEventId;
    previousUiState = world.uiState;
  }

  function syncUiState(): void {
    pauseBanner.classList.toggle('hidden', world.uiState !== 'paused');
    settingsToggleBtn.classList.toggle('hidden', world.uiState === 'boot' || world.uiState === 'gameover');

    if (world.uiState === 'levelup') {
      renderLevelChoices();
      levelUpModal.classList.remove('hidden');
    } else {
      levelUpModal.classList.add('hidden');
      lastLevelSignature = '';
    }

    if (world.uiState === 'chest') {
      renderChestChoices();
      chestModal.classList.remove('hidden');
    } else {
      chestModal.classList.add('hidden');
      lastChestSignature = '';
    }

    if (world.uiState === 'gameover') {
      gameOverModal.classList.remove('hidden');
      runSummary.textContent = world.toRunSummaryText();
    } else {
      gameOverModal.classList.add('hidden');
    }
  }

  function syncDebug(stats: LoopStats): void {
    if (debugPanel.classList.contains('hidden')) return;

    const enemyPoolStats = world.enemyPool.getStats();
    const projectilePoolStats = world.projectilePool.getStats();
    const enemyProjectilePoolStats = world.enemyProjectilePool.getStats();
    const hazardPoolStats = world.hazardPool.getStats();
    const chestPoolStats = world.chestPool.getStats();
    const xpPoolStats = world.xpPool.getStats();
    const evolutionsReady = world.getEvolutionCandidates();
    const perf = renderer.getPerformanceSnapshot();

    debugPanel.textContent = [
      `seed: ${world.seed}`,
      `ui: ${world.uiState}`,
      `renderer: ${world.rendererKind}`,
      `audio: ${audioEnabled ? 'on' : 'off'}`,
      `volume: ${Math.round(audioVolume * 100)}%`,
      `motion: ${Math.round(motionScale * 100)}%`,
      `fps: ${stats.fps.toFixed(1)}`,
      `frame: ${stats.smoothedFrameTimeMs.toFixed(2)}ms`,
      `quality: ${world.quality}`,
      `budget tier: ${perf.budgetTier}`,
      `render p50/p95: ${perf.rolling.p50FrameMs.toFixed(2)} / ${perf.rolling.p95FrameMs.toFixed(2)}ms`,
      `render timings: b${perf.timings.backdropMs.toFixed(2)} e${perf.timings.entitiesMs.toFixed(2)} o${perf.timings.overlaysMs.toFixed(2)} h${perf.timings.hudSyncMs.toFixed(2)} t${perf.timings.totalMs.toFixed(2)}`,
      `visible/culled: ${perf.visibleEntities}/${perf.culledEntities}`,
      `draw calls est: ${perf.drawCallsEstimate}`,
      `hud sync: ${hudSyncMs.toFixed(2)}ms`,
      `visual: ${colorVisionMode}, ui ${Math.round(uiScale * 100)}%, shake ${Math.round(screenShake * 100)}%, hazard ${Math.round(hazardOpacity * 100)}%`,
      `event: ${world.activeEventId ?? 'none'}`,
      `phase: ${world.director.phaseId}`,
      `intensity: ${world.director.intensity.toFixed(2)}`,
      `heat: ${world.director.heat.toFixed(2)}`,
      `target enemies: ${world.director.targetEnemies}`,
      `target threat: ${world.director.targetThreat.toFixed(1)}`,
      `entities: ${world.entities.size}`,
      `threat: ${world.threatLevel.toFixed(1)}`,
      `enemy shots: ${world.enemyShotsFired}`,
      `hazards: ${world.hazards.size}`,
      `chests: ${world.chests.size}`,
      `evolutions ready: ${evolutionsReady.length}`,
      `inventory: ${world.inventorySlots.map((slot) => `${slot.slotIndex + 1}:${slot.itemId ?? '-'}:${slot.rank}${slot.isEvolved ? '*' : ''}`).join(' | ')}`,
      `catalysts: ${Array.from(world.catalystRanks.entries()).map(([id, rank]) => `${id}:${rank}`).join(', ') || 'none'}`,
      `enemy pool: ${enemyPoolStats.available}/${enemyPoolStats.total}`,
      `proj pool: ${projectilePoolStats.available}/${projectilePoolStats.total}`,
      `enemy proj pool: ${enemyProjectilePoolStats.available}/${enemyProjectilePoolStats.total}`,
      `hazard pool: ${hazardPoolStats.available}/${hazardPoolStats.total}`,
      `chest pool: ${chestPoolStats.available}/${chestPoolStats.total}`,
      `xp pool: ${xpPoolStats.available}/${xpPoolStats.total}`
    ].join('\n');
  }

  function startRun(seed = world.seed): void {
    void audio.unlock();
    world.resetRun(seed);
    settingsOpen = false;
    pausedBySettings = false;
    settingsPanel.classList.add('hidden');
    previousShotsFired = world.shotsFired;
    previousPlayerHitCount = world.playerHitCount;
    previousLevelUpOfferedCount = world.levelUpOfferedCount;
    previousEliteKills = world.eliteKills;
    previousEventId = world.activeEventId;
    previousUiState = world.uiState;
    lastHeavyHudSyncAt = 0;
    bootScreen.classList.add('hidden');
    gameOverModal.classList.add('hidden');
    levelUpModal.classList.add('hidden');
    chestModal.classList.add('hidden');
    pauseBanner.classList.add('hidden');
    hud.classList.remove('hidden');
    syncHud(true);
    syncTopChromeOffsets();
    loop.resetAccumulator();
  }

  function pauseRun(message = 'Paused - Press Esc to Resume'): void {
    if (world.uiState !== 'playing') return;
    world.uiState = 'paused';
    pauseBanner.textContent = message;
    pauseBanner.classList.remove('hidden');
  }

  function resumeRun(): void {
    if (world.uiState !== 'paused') return;
    world.uiState = 'playing';
    pauseBanner.textContent = 'Paused - Press Esc to Resume';
    pauseBanner.classList.add('hidden');
    loop.resetAccumulator();
  }

  function stepSimulation(dt: number): void {
    if (world.uiState !== 'playing') return;
    for (const system of systems) {
      system.update(dt, world);
      if (world.uiState !== 'playing') break;
    }
  }

  function renderFrame(stats: LoopStats): void {
    const nextQuality = chooseQuality(stats.smoothedFrameTimeMs, world.quality);
    if (nextQuality !== world.quality) {
      world.setQuality(nextQuality);
      renderer.setQuality(nextQuality);
      persistSettings(nextQuality);
    }

    renderer.render(world, 0, stats.smoothedFrameTimeMs);
    syncAudioCues();
    syncHud();
    syncUiState();
    syncDebug(stats);
  }

  const loop = new FixedStepLoop({
    fixedDelta: world.config.fixedDelta,
    maxDelta: world.config.maxDelta,
    onUpdate: (dt) => stepSimulation(dt),
    onRender: (_alpha, stats) => renderFrame(stats)
  });

  function buildTextState(): string {
    const playerPos = world.getPlayerPosition();
    const playerVel = world.velocities.get(world.playerId) || { x: 0, y: 0 };

    const sortByDistanceToPlayer = (a: { x: number; y: number }, b: { x: number; y: number }) => {
      const da = (a.x - playerPos.x) ** 2 + (a.y - playerPos.y) ** 2;
      const db = (b.x - playerPos.x) ** 2 + (b.y - playerPos.y) ** 2;
      return da - db;
    };

    const enemies = Array.from(world.enemies)
      .map((enemyId) => {
        const pos = world.positions.get(enemyId);
        const comp = world.enemyComponents.get(enemyId);
        const health = world.health.get(enemyId);
        if (!pos || !comp || !health) return null;
        return {
          id: enemyId,
          x: Number(pos.x.toFixed(1)),
          y: Number(pos.y.toFixed(1)),
          archetype: comp.archetypeId,
          behavior: comp.behavior,
          hp: Number(health.hp.toFixed(1)),
          spitCooldown: Number(comp.spitCooldown.toFixed(2)),
          dashWindup: Number(comp.dashWindup.toFixed(2)),
          dashDuration: Number(comp.dashDuration.toFixed(2))
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort(sortByDistanceToPlayer)
      .slice(0, 28);

    const enemyProjectiles = Array.from(world.enemyProjectiles)
      .map((projectileId) => {
        const pos = world.positions.get(projectileId);
        const data = world.enemyProjectileComponents.get(projectileId);
        if (!pos || !data) return null;
        return {
          id: projectileId,
          x: Number(pos.x.toFixed(1)),
          y: Number(pos.y.toFixed(1)),
          ttl: Number(Math.max(0, data.lifetime - data.age).toFixed(2))
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort(sortByDistanceToPlayer)
      .slice(0, 28);

    const hazards = Array.from(world.hazards)
      .map((hazardId) => {
        const pos = world.positions.get(hazardId);
        const data = world.hazardComponents.get(hazardId);
        const radius = world.radii.get(hazardId);
        if (!pos || !data || radius === undefined) return null;
        return {
          id: hazardId,
          x: Number(pos.x.toFixed(1)),
          y: Number(pos.y.toFixed(1)),
          r: Number(radius.toFixed(1)),
          ttl: Number(Math.max(0, data.lifetime - data.age).toFixed(2))
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort(sortByDistanceToPlayer)
      .slice(0, 28);

    const chests = Array.from(world.chests)
      .map((chestId) => {
        const pos = world.positions.get(chestId);
        if (!pos) return null;
        return {
          id: chestId,
          x: Number(pos.x.toFixed(1)),
          y: Number(pos.y.toFixed(1))
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort(sortByDistanceToPlayer)
      .slice(0, 12);

    const inventory = world.inventorySlots.map((slot) => ({
      slot: slot.slotIndex + 1,
      itemId: slot.itemId,
      rank: slot.rank,
      evolved: slot.isEvolved
    }));

    const catalysts = Array.from(world.catalystRanks.entries()).map(([id, rank]) => ({ id, rank }));
    const renderPerf = renderer.getPerformanceSnapshot();

    return JSON.stringify({
      coordinateSystem: 'World space with origin at player spawn (0,0), +x right, +y down.',
      uiState: world.uiState,
      timerSeconds: Number(world.runTime.toFixed(2)),
      player: {
        x: Number(playerPos.x.toFixed(1)),
        y: Number(playerPos.y.toFixed(1)),
        vx: Number(playerVel.x.toFixed(1)),
        vy: Number(playerVel.y.toFixed(1)),
        hp: Number(world.playerStats.hp.toFixed(1)),
        maxHp: Number(world.playerStats.maxHp.toFixed(1)),
        level: world.level,
        xp: Number(world.xp.toFixed(1)),
        xpToNext: Number(world.xpToNext.toFixed(1))
      },
      director: {
        phase: world.director.phaseId,
        intensity: Number(world.director.intensity.toFixed(2)),
        heat: Number(world.director.heat.toFixed(2)),
        targetEnemies: world.director.targetEnemies,
        targetThreat: Number(world.director.targetThreat.toFixed(1))
      },
      visualSettings: {
        colorVisionMode,
        uiScale: Number(uiScale.toFixed(2)),
        screenShake: Number(screenShake.toFixed(2)),
        hazardOpacity: Number(hazardOpacity.toFixed(2)),
        hitFlashStrength: Number(hitFlashStrength.toFixed(2)),
        showDirectionalIndicators
      },
      renderPerf,
      inventory,
      catalysts,
      evolutionCandidates: world.getEvolutionCandidates(),
      counts: {
        enemies: world.enemies.size,
        enemyProjectiles: world.enemyProjectiles.size,
        hazards: world.hazards.size,
        chests: world.chests.size,
        xpOrbs: world.xpOrbs.size
      },
      event: world.activeEventId,
      renderer: world.rendererKind,
      quality: world.quality,
      enemies,
      enemyProjectiles,
      hazards,
      chests
    });
  }

  function installTestingHooks(): void {
    const testWindow = window as Window & {
      render_game_to_text?: () => string;
      advanceTime?: (ms: number) => void;
    };

    testWindow.render_game_to_text = () => buildTextState();
    testWindow.advanceTime = (ms: number) => {
      const boundedMs = Number.isFinite(ms) ? Math.max(0, ms) : 0;
      const stepMs = world.config.fixedDelta * 1000;
      const steps = Math.max(1, Math.round(boundedMs / stepMs));
      for (let i = 0; i < steps; i += 1) {
        stepSimulation(world.config.fixedDelta);
      }

      const frameMs = steps > 0 ? Math.max(1, boundedMs / steps) : stepMs;
      renderFrame({
        frameTimeMs: frameMs,
        smoothedFrameTimeMs: frameMs,
        fps: 1000 / frameMs
      });
    };
  }

  installTestingHooks();
  loop.start();

  startGameBtn.addEventListener('click', () => {
    startRun(world.seed);
  });

  restartRunBtn.addEventListener('click', () => {
    startRun(world.seed);
  });

  settingsToggleBtn.addEventListener('click', () => {
    if (settingsOpen) {
      closeSettings();
    } else {
      openSettings();
    }
  });

  settingsCloseBtn.addEventListener('click', () => {
    closeSettings();
  });

  settingsPanel.addEventListener('click', (event) => {
    if (event.target === settingsPanel) {
      closeSettings();
    }
  });

  settingsAudioEnabled.addEventListener('change', () => {
    audioEnabled = settingsAudioEnabled.checked;
    audio.setEnabled(audioEnabled);
    if (audioEnabled) {
      void audio.unlock();
    }
    syncSettingsControls();
    persistSettings(world.quality);
  });

  settingsAudioVolume.addEventListener('input', () => {
    audioVolume = clamp(Number(settingsAudioVolume.value) / 100, 0, 1);
    audio.setVolume(audioVolume);
    syncSettingsControls();
    persistSettings(world.quality);
  });

  settingsMotionIntensity.addEventListener('input', () => {
    motionScale = clamp(Number(settingsMotionIntensity.value) / 100, 0, 1);
    applyVisualSettings();
    syncSettingsControls();
    persistSettings(world.quality);
  });

  settingsColorVision.addEventListener('change', () => {
    colorVisionMode = parseColorVisionMode(settingsColorVision.value);
    applyVisualSettings();
    syncSettingsControls();
    persistSettings(world.quality);
  });

  settingsUiScale.addEventListener('input', () => {
    uiScale = clamp(Number(settingsUiScale.value) / 100, 0.9, 1.25);
    applyVisualSettings();
    syncSettingsControls();
    persistSettings(world.quality);
    syncTopChromeOffsets();
  });

  settingsScreenShake.addEventListener('input', () => {
    screenShake = clamp(Number(settingsScreenShake.value) / 100, 0, 1);
    applyVisualSettings();
    syncSettingsControls();
    persistSettings(world.quality);
  });

  settingsHazardOpacity.addEventListener('input', () => {
    hazardOpacity = clamp(Number(settingsHazardOpacity.value) / 100, 0.45, 1);
    applyVisualSettings();
    syncSettingsControls();
    persistSettings(world.quality);
  });

  settingsHitFlashStrength.addEventListener('input', () => {
    hitFlashStrength = clamp(Number(settingsHitFlashStrength.value) / 100, 0, 1);
    applyVisualSettings();
    syncSettingsControls();
    persistSettings(world.quality);
  });

  settingsDamageNumbers.addEventListener('change', () => {
    showDamageNumbers = settingsDamageNumbers.checked;
    applyVisualSettings();
    syncSettingsControls();
    persistSettings(world.quality);
  });

  settingsDirectionalIndicators.addEventListener('change', () => {
    showDirectionalIndicators = settingsDirectionalIndicators.checked;
    applyVisualSettings();
    syncSettingsControls();
    persistSettings(world.quality);
  });

  settingsRendererPreference.addEventListener('change', () => {
    preferredRenderer = parseRendererPreference(settingsRendererPreference.value);
    persistSettings(world.quality);
  });

  settingsApplyRendererBtn.addEventListener('click', () => {
    persistSettings(world.quality);
    const url = new URL(window.location.href);
    url.searchParams.set('renderer', preferredRenderer);
    window.location.assign(url.toString());
  });

  syncSettingsControls();
  applyVisualSettings();
  syncHud(true);

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    const movementFlag = keyToMovementFlag(key);

    if (settingsOpen) {
      if (key === 'escape' || key === 'o') {
        closeSettings();
        event.preventDefault();
      } else if (movementFlag || key === ' ') {
        event.preventDefault();
      }
      return;
    }

    if (key === 'o') {
      openSettings();
      event.preventDefault();
      return;
    }

    if (movementFlag) {
      world.input[movementFlag] = true;
      event.preventDefault();
      return;
    }

    if (key === 'escape') {
      if (world.uiState === 'playing') {
        pauseRun();
      } else if (world.uiState === 'paused') {
        resumeRun();
      }
      event.preventDefault();
      return;
    }

    if (key === 'm') {
      audioEnabled = !audioEnabled;
      audio.setEnabled(audioEnabled);
      if (audioEnabled) {
        void audio.unlock();
      }
      syncSettingsControls();
      persistSettings(world.quality);
      event.preventDefault();
      return;
    }

    if (world.uiState === 'levelup') {
      if (key === '1') chooseLevelChoiceByIndex(0);
      if (key === '2') chooseLevelChoiceByIndex(1);
      if (key === '3') chooseLevelChoiceByIndex(2);
      if (key === ' ') chooseLevelChoiceByIndex(0);
      event.preventDefault();
      return;
    }

    if (world.uiState === 'chest') {
      if (key === '1') chooseChestChoiceByIndex(0);
      if (key === '2') chooseChestChoiceByIndex(1);
      if (key === '3') chooseChestChoiceByIndex(2);
      if (key === ' ') chooseChestChoiceByIndex(0);
      event.preventDefault();
      return;
    }

    if (world.uiState === 'boot' && (key === 'enter' || key === ' ')) {
      startRun(world.seed);
      event.preventDefault();
      return;
    }

    if (world.uiState === 'gameover' && (key === 'enter' || key === ' ')) {
      startRun(world.seed);
      event.preventDefault();
    }
  });

  window.addEventListener('keyup', (event) => {
    const movementFlag = keyToMovementFlag(event.key.toLowerCase());
    if (!movementFlag) return;
    world.input[movementFlag] = false;
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (world.uiState === 'playing') {
        pausedByVisibility = true;
        pauseRun('Paused - Tab hidden');
      }
      return;
    }

    if (!document.hidden && pausedByVisibility && world.uiState === 'paused') {
      pausedByVisibility = false;
      resumeRun();
    }
  });

  const canvas = renderer.getCanvas();
  if (canvas) {
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      pauseRun('Context lost - waiting for restore');
    });

    canvas.addEventListener('webglcontextrestored', () => {
      resumeRun();
    });
  }
}

main().catch((error) => {
  console.error('Fatal error while booting Forest Arcana:', error);
});
