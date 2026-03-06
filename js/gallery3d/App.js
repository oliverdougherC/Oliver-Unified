import Lenis from 'lenis';
import { DEFAULT_QUALITY, WebGL } from './WebGL.js';
import { SceneController } from './SceneController.js';
import { InputController } from './InputController.js';
import { UIController } from './UIController.js';
import { clamp, toNumber } from './utils.js';

function fallbackScene(index) {
  const waveX = [
    -180, -96, 34, 146, -120, 44, 188, -208,
    82, -26, 154, -174, 64, -102, 124, -56
  ];
  const waveY = [
    -76, -24, 22, 76, -58, 12, 54, -68,
    -8, 58, -38, 14, 68, -44, 26, -16
  ];

  return {
    z: -280 - index * 20,
    scale: 0.9 + (index % 4) * 0.08,
    x: waveX[index % waveX.length],
    y: waveY[index % waveY.length],
    rotX: (index % 2 === 0 ? -1 : 1) * (2 + (index % 3)),
    rotY: (index % 2 === 0 ? 1 : -1) * (3 + (index % 5)),
    rotZ: (index % 3 - 1) * 0.8,
    opacity: 0.92
  };
}

function normalizeEntry(entry, index) {
  const scene = {
    ...fallbackScene(index),
    ...(entry.scene || {})
  };

  return {
    id: entry.id || `photo-${index + 1}`,
    title: entry.title || `Untitled ${index + 1}`,
    src: entry.src || {},
    meta: entry.meta || {},
    colorGrade: {
      temperature: toNumber(entry.colorGrade?.temperature, 0),
      tint: toNumber(entry.colorGrade?.tint, 0),
      exposure: clamp(toNumber(entry.colorGrade?.exposure, 1), 0.98, 1.02)
    },
    scene: {
      z: toNumber(scene.z, -300),
      scale: toNumber(scene.scale, 1),
      x: toNumber(scene.x, 0),
      y: toNumber(scene.y, 0),
      rotX: toNumber(scene.rotX, 0),
      rotY: toNumber(scene.rotY, 0),
      rotZ: toNumber(scene.rotZ, 0),
      opacity: clamp(toNumber(scene.opacity, 0.95), 0.1, 1)
    },
    aspect: toNumber(entry.aspect, 1.5)
  };
}

async function loadSequenceFromJson(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }

  const data = await response.json();
  if (!Array.isArray(data.items)) {
    throw new Error('Invalid gallery sequence schema');
  }

  return data.items.map((entry, index) => normalizeEntry(entry, index));
}

function mapPhotoToEntry(photo, index) {
  const title = photo.title || photo.filename || `Photo ${index + 1}`;
  const fallbackPath = `../../photos/${photo.filename}`;
  const mediumJpg = photo.medium?.jpg ? `../../photos/medium/${photo.medium.jpg}` : fallbackPath;
  const largeJpg = photo.large?.jpg ? `../../photos/large/${photo.large.jpg}` : mediumJpg;
  const thumbJpg = photo.thumbs?.jpg ? `../../photos/thumbs/${photo.thumbs.jpg}` : mediumJpg;

  const width = toNumber(photo.medium?.width || photo.width, 1600);
  const height = toNumber(photo.medium?.height || photo.height, 1067);

  return normalizeEntry({
    id: photo.filename || `photo-${index + 1}`,
    title,
    src: {
      thumb: thumbJpg,
      medium: mediumJpg,
      large: largeJpg,
      avif: photo.large?.avif ? `../../photos/large/${photo.large.avif}` : undefined,
      webp: photo.large?.webp ? `../../photos/large/${photo.large.webp}` : undefined
    },
    meta: {
      date: photo.exif?.date || 'Unknown date',
      lens: photo.exif?.lens || 'Unknown lens',
      location: 'Archive',
      notes: [
        photo.exif?.aperture ? `f/${photo.exif.aperture}` : null,
        photo.exif?.shutter ? `${photo.exif.shutter}s` : null,
        photo.exif?.iso ? `ISO ${photo.exif.iso}` : null
      ].filter(Boolean).join(' \u2022 ') || 'No notes'
    },
    aspect: width / Math.max(height, 1),
    scene: fallbackScene(index),
    colorGrade: {
      temperature: 0,
      tint: 0,
      exposure: 1
    }
  }, index);
}

async function loadSequenceWithFallback() {
  try {
    return await loadSequenceFromJson('../../photos/gallery-sequence.json');
  } catch (_error) {
    const response = await fetch('../../photos/photos.json', { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error('Failed to load both gallery-sequence.json and photos.json');
    }

    const data = await response.json();
    const source = Array.isArray(data.photos) ? data.photos.slice(0, 16) : [];
    return source.map((photo, index) => mapPhotoToEntry(photo, index));
  }
}

const QUALITY_UPGRADE_THRESHOLD_MS = 14;
const QUALITY_UPGRADE_HOLD_MS = 5000;
const QUALITY_CHANGE_COOLDOWN_MS = 4500;

export class App {
  constructor({
    canvasSelector = '#galleryWebglCanvas',
    shellSelector = '#galleryShell',
    scrollTrackSelector = '#galleryScrollTrack'
  } = {}) {
    this.canvas = document.querySelector(canvasSelector);
    this.shell = document.querySelector(shellSelector);
    this.scrollTrack = document.querySelector(scrollTrackSelector);

    this.isDestroyed = false;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.isMobile = window.matchMedia('(max-width: 980px), (pointer: coarse)').matches;

    this.qualityOrder = this.isMobile
      ? ['mobile']
      : ['ultra', 'high', 'medium', 'mobile'];

    this.qualityName = this.isMobile ? 'mobile' : 'ultra';
    this.qualityProfile = DEFAULT_QUALITY[this.qualityName];
    this.renderMode = 'initializing';

    this.frameWindow = [];
    this.lastPerfCheck = 0;
    this.lastQualityChangeTime = 0;
    this.upgradeCandidateSince = 0;
    this.pendingFocusIndex = -1;
    this.lastDepthState = { focused: null, uiDepth: null };
    this.panelInteractionUntil = 0;
    this.panelGuardCleanup = [];

    this.raf = this.raf.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleCanvasClick = this.handleCanvasClick.bind(this);
    this.handleFocusExit = this.handleFocusExit.bind(this);
    this.handleFocusToggle = this.handleFocusToggle.bind(this);
    this.markPanelInteraction = this.markPanelInteraction.bind(this);

    if (this.shell) {
      this.shell.dataset.focusState = 'idle';
      this.shell.dataset.uiDepth = 'front';
    }

    this.setRenderMode('initializing');

    this.init().catch((error) => {
      console.error('Gallery initialization error:', error);
      this.activateFallback('Unable to initialize gallery. Compatibility mode is active.', error);
    });
  }

  async init() {
    if (!this.canvas || !this.shell || !this.scrollTrack) {
      return;
    }

    try {
      this.entries = await loadSequenceWithFallback();
    } catch (error) {
      this.initUI([]);
      this.activateFallback('Unable to load gallery data. Compatibility mode is active.', error);
      return;
    }

    this.initUI(this.entries);
    if (!this.entries.length) {
      this.activateFallback('No gallery items are available.');
      return;
    }

    try {
      await this.initRenderPipeline();
    } catch (error) {
      this.activateFallback('3D renderer unavailable. Compatibility mode is active.', error);
      return;
    }

    this.setRenderMode('render');
    this.inputController = new InputController({
      lenis: this.lenis,
      shell: this.shell,
      scrollTrack: this.scrollTrack,
      totalItems: this.entries.length,
      reducedMotion: this.reducedMotion,
      onProgress: (progress, meta = {}) => {
        if (this.sceneController?.isFocused()) {
          if (performance.now() <= this.panelInteractionUntil || !meta.isUserDriven) {
            return;
          }
          this.handleFocusExit();
        }
        this.sceneController.setTargetProgress(progress);
        this.sceneController.setInputTelemetry?.({
          inertialVelocity: meta.inertialVelocity || 0,
          scrollJerk: meta.scrollJerk || 0
        });
      },
      onPointerMove: ({ clientX, clientY }) => {
        this.webgl.setPointer(clientX, clientY);
      },
      onPointerLeave: () => {
        this.webgl.clearPointer();
        this.sceneController.clearHover();
      },
      onClick: ({ clientX, clientY }) => {
        this.handleCanvasClick(clientX, clientY);
      }
    });

    this.shell.dataset.quality = this.qualityName;
    this.syncDepthState();

    window.addEventListener('resize', this.handleResize, { passive: true });
    requestAnimationFrame(this.raf);
  }

  initUI(entries) {
    this.entries = Array.isArray(entries) ? entries : [];

    this.uiController?.dispose();
    this.uiController = new UIController({
      entries: this.entries,
      onSelectIndex: (index) => {
        this.handleSelectIndex(index);
      }
    });
    this.uiController._onFocusExit = this.handleFocusExit;
    this.uiController._onFocusToggle = this.handleFocusToggle;
    this.uiController.setActive(0, this.entries[0]);
    this.uiController.setDepthState({ focused: false });
    this.bindPanelInteractionGuards();
  }

  async initRenderPipeline() {
    this.webgl = new WebGL({
      canvas: this.canvas,
      perspective: 800,
      qualityName: this.qualityName,
      qualityMap: DEFAULT_QUALITY
    });

    this.lenis = new Lenis({
      autoRaf: false,
      smoothWheel: true,
      lerp: this.reducedMotion ? 0.35 : 0.1,
      wheelMultiplier: this.reducedMotion ? 0.9 : 0.55,
      touchMultiplier: this.reducedMotion ? 1 : 0.88,
      prevent: (node) => {
        if (!(node instanceof HTMLElement)) return false;
        return Boolean(node.closest('[data-lenis-prevent], .gallery-index, .gallery-detail'));
      }
    });

    this.sceneController = new SceneController({
      scene: this.webgl.scene,
      camera: this.webgl.camera,
      entries: this.entries,
      qualityProfile: this.qualityProfile,
      isMobile: this.isMobile,
      reducedMotion: this.reducedMotion,
      onActiveIndexChange: (index, entry) => {
        this.uiController?.setActive(index, entry);
        if (this.pendingFocusIndex === index) {
          this.pendingFocusIndex = -1;
          this.sceneController.enterFocus(index);
          this.uiController?.setFocusMode(true);
        }
      }
    });

    this.sceneController.init(this.webgl.getMaxAnisotropy());
  }

  syncDepthState() {
    const focused = Boolean(this.sceneController?.getDepthState?.().focused);
    const uiDepth = focused ? 'pushed' : 'front';
    if (this.lastDepthState.focused === focused && this.lastDepthState.uiDepth === uiDepth) {
      return;
    }

    this.lastDepthState = { focused, uiDepth };
    if (this.shell) {
      this.shell.dataset.focusState = focused ? 'active' : 'idle';
      this.shell.dataset.uiDepth = uiDepth;
    }
    this.uiController?.setDepthState({ focused });
  }

  markPanelInteraction() {
    this.panelInteractionUntil = performance.now() + 220;
  }

  clearPanelInteractionGuards() {
    for (const cleanup of this.panelGuardCleanup) {
      cleanup();
    }
    this.panelGuardCleanup.length = 0;
  }

  bindPanelInteractionGuards() {
    this.clearPanelInteractionGuards();
    const panels = [
      document.getElementById('galleryIndex'),
      document.getElementById('galleryDetail')
    ];
    const keyGuard = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);

    for (const panel of panels) {
      if (!panel) continue;

      const handleWheel = () => this.markPanelInteraction();
      const handleTouch = () => this.markPanelInteraction();
      const handlePointer = () => this.markPanelInteraction();
      const handleKey = (event) => {
        if (keyGuard.has(event.key)) {
          this.markPanelInteraction();
        }
      };

      panel.addEventListener('wheel', handleWheel, { passive: true });
      panel.addEventListener('touchmove', handleTouch, { passive: true });
      panel.addEventListener('pointerdown', handlePointer, { passive: true });
      panel.addEventListener('keydown', handleKey);

      this.panelGuardCleanup.push(() => panel.removeEventListener('wheel', handleWheel));
      this.panelGuardCleanup.push(() => panel.removeEventListener('touchmove', handleTouch));
      this.panelGuardCleanup.push(() => panel.removeEventListener('pointerdown', handlePointer));
      this.panelGuardCleanup.push(() => panel.removeEventListener('keydown', handleKey));
    }
  }

  activateFallback(message, error) {
    if (error) {
      console.error('Gallery fallback activated:', error);
    }

    this.disposeRenderPipeline();
    this.setRenderMode('fallback');

    if (this.shell) {
      this.shell.dataset.focusState = 'idle';
      this.shell.dataset.uiDepth = 'front';
    }
    this.lastDepthState = { focused: false, uiDepth: 'front' };

    if (this.uiController) {
      this.uiController.setRenderMode('fallback');
      this.uiController.setCaptionPrefix('Compatibility mode \u00b7 ');
      this.uiController.setDepthState({ focused: false });
      const activeIndex = this.uiController.activeIndex || 0;
      this.uiController.setActive(activeIndex, this.entries?.[activeIndex]);
    } else {
      const caption = document.getElementById('galleryCaption');
      if (caption) {
        caption.textContent = message;
      }
    }
  }

  setRenderMode(mode) {
    this.renderMode = mode;
    if (this.shell) {
      this.shell.dataset.renderMode = mode;
    }
    window.__galleryRenderMode = mode;
  }

  handleSelectIndex(index) {
    if (!this.entries?.length) return;

    const boundedIndex = Math.min(Math.max(index, 0), this.entries.length - 1);
    const entry = this.entries[boundedIndex];

    this.pendingFocusIndex = -1;
    if (this.sceneController?.isFocused()) {
      this.handleFocusExit();
    }

    if (this.inputController) {
      this.inputController.scrollToIndex(boundedIndex);
      this.uiController?.setActive(boundedIndex, entry);
      return;
    }

    if (this.sceneController) {
      this.sceneController.jumpToIndex(boundedIndex);
    }

    this.uiController?.setActive(boundedIndex, entry);
  }

  handleCanvasClick(clientX, clientY) {
    if (!this.webgl || !this.sceneController || !this.inputController) return;

    if (this.sceneController.isFocused()) {
      this.webgl.setPointer(clientX, clientY);
      const focusedHit = this.webgl.raycast(this.sceneController.getRaycastTargets());
      const hitIndex = focusedHit?.item ? this.sceneController.getItemIndexForItem(focusedHit.item) : -1;
      const focusedIndex = this.sceneController.focusIndex >= 0
        ? this.sceneController.focusIndex
        : this.sceneController.activeIndex;

      if (hitIndex === focusedIndex) {
        return;
      }
      this.handleFocusExit();
      return;
    }

    this.webgl.setPointer(clientX, clientY);
    const hit = this.webgl.raycast(this.sceneController.getRaycastTargets());
    if (!hit?.item) return;

    const hitIndex = this.sceneController.getItemIndexForItem(hit.item);
    if (hitIndex < 0) return;

    if (hitIndex === this.sceneController.activeIndex) {
      this.pendingFocusIndex = -1;
      this.sceneController.enterFocus(hitIndex);
      this.uiController?.setFocusMode(true);
      this.syncDepthState();
      return;
    }

    this.pendingFocusIndex = hitIndex;
    this.inputController.scrollToIndex(hitIndex);
    this.uiController?.setActive(hitIndex, this.entries[hitIndex]);
  }

  handleFocusExit() {
    this.pendingFocusIndex = -1;
    this.sceneController?.exitFocus();
    this.uiController?.setFocusMode(false);
    this.syncDepthState();
  }

  handleFocusToggle() {
    if (!this.sceneController) return;
    if (this.sceneController.isFocused()) {
      this.handleFocusExit();
      return;
    }
    this.pendingFocusIndex = -1;
    this.sceneController.enterFocus(this.sceneController.activeIndex);
    this.uiController?.setFocusMode(true);
    this.syncDepthState();
  }

  disposeRenderPipeline() {
    this.inputController?.dispose();
    this.inputController = null;

    this.sceneController?.dispose();
    this.sceneController = null;

    if (this.lenis) {
      this.lenis.destroy();
      this.lenis = null;
    }

    this.webgl?.dispose();
    this.webgl = null;

    window.removeEventListener('resize', this.handleResize);
  }

  applyQualityTier(next, now) {
    this.qualityName = next;
    this.qualityProfile = DEFAULT_QUALITY[next];

    this.webgl.setQualityProfile(next);
    this.sceneController.setQualityProfile(this.qualityProfile);

    this.shell.dataset.quality = next;
    if (next === 'mobile') {
      this.shell.classList.add('quality-mobile');
    } else {
      this.shell.classList.remove('quality-mobile');
    }

    this.lastQualityChangeTime = now;
    this.upgradeCandidateSince = 0;
  }

  maybeDowngradeQuality(now, avgFrameMs) {
    if (!this.webgl || !this.sceneController) return;
    if (this.reducedMotion) return;
    if (now - this.lastQualityChangeTime < QUALITY_CHANGE_COOLDOWN_MS) return;
    if (avgFrameMs < 23.5) return;

    const index = this.qualityOrder.indexOf(this.qualityName);
    if (index < 0 || index >= this.qualityOrder.length - 1) return;

    this.applyQualityTier(this.qualityOrder[index + 1], now);
  }

  maybeUpgradeQuality(now, avgFrameMs) {
    if (!this.webgl || !this.sceneController) return;
    if (this.reducedMotion) return;
    if (now - this.lastQualityChangeTime < QUALITY_CHANGE_COOLDOWN_MS) return;
    if (avgFrameMs >= QUALITY_UPGRADE_THRESHOLD_MS) {
      this.upgradeCandidateSince = 0;
      return;
    }

    const index = this.qualityOrder.indexOf(this.qualityName);
    if (index <= 0) return;

    if (!this.upgradeCandidateSince) {
      this.upgradeCandidateSince = now;
      return;
    }

    if (now - this.upgradeCandidateSince >= QUALITY_UPGRADE_HOLD_MS) {
      this.applyQualityTier(this.qualityOrder[index - 1], now);
    }
  }

  updatePerfStats(dtMs, now) {
    this.frameWindow.push(dtMs);
    if (this.frameWindow.length > 120) {
      this.frameWindow.shift();
    }

    if (now - this.lastPerfCheck < 900) {
      return;
    }

    this.lastPerfCheck = now;
    const sum = this.frameWindow.reduce((acc, v) => acc + v, 0);
    const avg = sum / Math.max(this.frameWindow.length, 1);

    this.maybeDowngradeQuality(now, avg);
    this.maybeUpgradeQuality(now, avg);

    window.__galleryPerfStats = {
      quality: this.qualityName,
      avgFrameMs: Number(avg.toFixed(2)),
      fps: Number((1000 / Math.max(avg, 1)).toFixed(1)),
      framesSampled: this.frameWindow.length,
      activeIndex: this.sceneController?.activeIndex ?? this.uiController?.activeIndex ?? 0,
      renderMode: this.renderMode
    };
  }

  raf(time) {
    if (this.isDestroyed || !this.lenis || !this.sceneController || !this.webgl) return;

    const dtMs = this.prevTime ? time - this.prevTime : 16.67;
    this.prevTime = time;

    this.lenis.raf(time);
    this.inputController?.update(dtMs, time);
    this.sceneController.update(time * 0.001, dtMs);
    this.syncDepthState();

    if (!this.webgl.contextLost) {
      const hit = this.webgl.raycast(this.sceneController.getRaycastTargets());
      this.sceneController.applyHoverHit(hit);
      if (this.canvas) {
        const nextCursor = this.sceneController.isFocused() || hit?.item ? 'pointer' : 'default';
        if (this.canvas.style.cursor !== nextCursor) {
          this.canvas.style.cursor = nextCursor;
        }
      }
      this.webgl.render();
    }

    this.updatePerfStats(dtMs, time);

    requestAnimationFrame(this.raf);
  }

  handleResize() {
    const mobile = window.matchMedia('(max-width: 980px), (pointer: coarse)').matches;
    this.webgl?.handleResize();

    if (this.sceneController) {
      if (mobile !== this.isMobile) {
        this.isMobile = mobile;
        this.sceneController.refreshLayoutMode(this.isMobile);
      }
      this.sceneController.handleViewportResize();
    }

    this.inputController?.updateTrackHeight();
  }

  dispose() {
    this.isDestroyed = true;
    this.disposeRenderPipeline();
    this.clearPanelInteractionGuards();
    this.uiController?.dispose();
  }
}
