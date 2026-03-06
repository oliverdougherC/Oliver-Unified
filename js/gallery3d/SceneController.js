import * as THREE from 'three';
import { GalleryItem } from './GalleryItem.js';
import { clamp, lerp } from './utils.js';

const SCENE_TUNING = {
  easingDivisor: 132,
  easingMin: 0.1,
  easingMax: 0.3,
  focusBlendDivisor: 140,
  focusBlendMin: 0.12,
  focusBlendMax: 0.34,

  spacingDesktop: 448,
  spacingMobile: 324,
  visibleRangeDesktop: 1.48,
  visibleRangeMobile: 1.14,
  depthStepDesktop: 340,
  depthStepMobile: 250,
  verticalStepDesktop: 18,
  verticalStepMobile: 13,
  staggerXDesktop: 0,
  staggerXMobile: 0,

  heroMaxVwDesktop: 0.74,
  heroMaxVhDesktop: 0.7,
  heroMaxVwMobile: 0.88,
  heroMaxVhMobile: 0.58,
  heroMinHeightDesktop: 182,
  heroMinHeightMobile: 132,

  minProjectedGapDesktop: 28,
  minProjectedGapMobile: 18,
  safeInsetVwDesktop: 0.06,
  safeInsetVwMobile: 0.04,
  depthOpacityFalloff: 0.74,
  maxOpacity: 1,
  obliqueYawBaseDeg: 42,
  obliqueYawMinDeg: 38,
  obliqueYawMaxDeg: 48,
  obliqueYawSign: -1,
  obliqueYawNearBlendRange: 0.4,
  obliqueYawFarBlendRangeDesktop: 1.3,
  obliqueYawFarBlendRangeMobile: 1.05,
  rotationDeadband: 0.12,
  rotationPow: 1.2,
  activeScaleBoost: 1.02,
  flankScaleMin: 0.64,
  scalePow: 1.18,

  activePulseSpeed: 0.72,
  activeBoostBase: 0.006,
  activeBoostPulse: 0.007,

  fresnelBase: 0.01,
  fresnelPhase: 0.014,
  refractionBase: 0.00009,
  refractionPhase: 0.00005,
  chromaticBase: 0.000003,
  chromaticPhase: 0.000006,
  glossBase: 0.085,
  glossPhase: 0.06,
  grainPhaseMin: 0.018,
  grainPhaseMax: 0.05,
  grainPhaseBase: 0.018,
  grainPhaseScale: 0.03,

  focusMaxVwDesktop: 0.78,
  focusMaxVhDesktop: 0.62,
  focusMaxVwMobile: 0.88,
  focusMaxVhMobile: 0.56,
  focusNavMarginDesktop: 24,
  focusNavMarginMobile: 16,
  focusCaptionMarginDesktop: 28,
  focusCaptionMarginMobile: 18,
  focusForwardZDesktop: 140,
  focusForwardZMobile: 122,
  focusSideXScaleDesktop: 1.6,
  focusSideXScaleMobile: 1.48,
  focusSideDepthPushDesktop: 260,
  focusSideDepthPushMobile: 210,
  focusSideOpacityFloor: 0.06,
  focusSideOpacityScale: 0.18,
  focusSideHeightNear: 0.78,
  focusSideHeightFar: 0.66,

  cameraSwayXAmplitudeDesktop: 2.2,
  cameraSwayXAmplitudeMobile: 1.3,
  cameraSwayXFrequency: 0.12,
  cameraSwayYAmplitudeDesktop: 1.6,
  cameraSwayYAmplitudeMobile: 1.1,
  cameraSwayYFrequency: 0.11,
  cameraCenterLockRange: 0.34,
  cameraCenterLockStrength: 0.84
};

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / Math.max(edge1 - edge0, 0.00001), 0, 1);
  return t * t * (3 - 2 * t);
}

export class SceneController {
  constructor({
    scene,
    camera,
    entries,
    qualityProfile,
    isMobile = false,
    reducedMotion = false,
    onActiveIndexChange
  }) {
    this.scene = scene;
    this.camera = camera;
    this.entries = entries;
    this.qualityProfile = qualityProfile;
    this.isMobile = isMobile;
    this.reducedMotion = reducedMotion;
    this.onActiveIndexChange = onActiveIndexChange;

    this.textureLoader = new THREE.TextureLoader();
    this.items = [];
    this.progress = 0;
    this.targetProgress = 0;
    this.activeIndex = 0;
    this.visibleTargets = [];
    this.hoveredItem = null;
    this.focusState = 'idle';
    this.focusBlend = 0;
    this.focusIndex = -1;
    this.inertialVelocity = 0;
    this.scrollJerk = 0;
    this.layoutDebugState = {
      activeIndex: 0,
      activeCenterPx: 0,
      visibleRects: [],
      minGapPx: Infinity,
      maxGapPx: 0,
      activeNeighborGapPx: Infinity,
      activeYawDeg: 0,
      focusYawDeg: 0,
      inertialVelocity: 0,
      scrollJerk: 0,
      focusSafeZoneBreach: false,
      nearestFocusNeighborGapPx: Infinity,
      focus: {
        enabled: false,
        index: -1,
        safeTopPx: 0,
        safeBottomPx: 0,
        rectTopPx: 0,
        rectBottomPx: 0,
        safeTopBreached: false,
        safeBottomBreached: false,
        nearestGapPx: Infinity,
        nearestOpacity: 0
      }
    };
    this.lights = [];
    this.navElement = document.getElementById('nav') || document.querySelector('.nav');
    this.captionElement = document.getElementById('galleryCaption');

    this.layout = {
      spacing: this.isMobile ? SCENE_TUNING.spacingMobile : SCENE_TUNING.spacingDesktop,
      visibleRange: this.isMobile ? SCENE_TUNING.visibleRangeMobile : SCENE_TUNING.visibleRangeDesktop,
      depthStep: this.isMobile ? SCENE_TUNING.depthStepMobile : SCENE_TUNING.depthStepDesktop,
      verticalStep: this.isMobile ? SCENE_TUNING.verticalStepMobile : SCENE_TUNING.verticalStepDesktop,
      staggerX: this.isMobile ? SCENE_TUNING.staggerXMobile : SCENE_TUNING.staggerXDesktop,
      heroMinHeight: this.isMobile ? SCENE_TUNING.heroMinHeightMobile : SCENE_TUNING.heroMinHeightDesktop,
      fitMaxWidth: this.isMobile ? 640 : 980,
      fitMaxHeight: this.isMobile ? 420 : 620,
      viewportWidth: Math.max(window.innerWidth, 1),
      viewportHeight: Math.max(window.innerHeight, 1),
      worldWidthAtCenter: 1
    };
  }

  setupLighting() {
    if (this.lights.length) return;

    const key = new THREE.DirectionalLight(0xffffff, 0.34);
    key.position.set(-420, 286, 700);

    const fill = new THREE.DirectionalLight(0xffffff, 0.22);
    fill.position.set(430, -86, 590);

    const rim = new THREE.DirectionalLight(0xffffff, 0.2);
    rim.position.set(24, 324, -280);

    const ambience = new THREE.HemisphereLight(0xf4f4f4, 0x2c2c2c, 0.1);

    this.lights = [key, fill, rim, ambience];
    for (const light of this.lights) {
      this.scene.add(light);
    }
  }

  init(maxAnisotropy) {
    this.items = this.entries.map((entry) => {
      const item = new GalleryItem({
        entry,
        textureLoader: this.textureLoader,
        maxAnisotropy,
        qualityLevel: this.qualityProfile.qualityLevel,
        isMobile: this.isMobile
      });
      this.scene.add(item.mesh);
      return item;
    });

    this.setupLighting();

    for (let i = 0; i < this.items.length; i += 1) {
      this.items[i].mesh.userData.galleryIndex = i;
      this.items[i].getRaycastTarget().userData.galleryIndex = i;
    }

    this.refreshLayoutMode(this.isMobile);
  }

  getItemCount() {
    return this.items.length;
  }

  getActiveEntry() {
    return this.entries[this.activeIndex] || null;
  }

  getDepthState() {
    return {
      focused: this.isFocused(),
      activeIndex: this.activeIndex
    };
  }

  getLayoutDebugState() {
    return this.layoutDebugState;
  }

  setInputTelemetry({ inertialVelocity = 0, scrollJerk = 0 } = {}) {
    this.inertialVelocity = Number.isFinite(inertialVelocity) ? inertialVelocity : 0;
    this.scrollJerk = Number.isFinite(scrollJerk) ? scrollJerk : 0;
  }

  setTargetProgress(progress01) {
    if (this.items.length <= 1) {
      this.targetProgress = 0;
      return;
    }

    const scaled = clamp(progress01, 0, 1) * (this.items.length - 1);
    this.targetProgress = scaled;
  }

  jumpToIndex(index) {
    const bounded = clamp(index, 0, this.items.length - 1);
    this.targetProgress = bounded;
    if (this.reducedMotion) {
      this.progress = bounded;
    }
  }

  setQualityProfile(profile) {
    this.qualityProfile = profile;
    for (const item of this.items) {
      item.setQualityLevel(profile.qualityLevel);
    }
  }

  refreshLayoutMode(isMobile) {
    this.isMobile = isMobile;
    this.layout.spacing = this.isMobile ? SCENE_TUNING.spacingMobile : SCENE_TUNING.spacingDesktop;
    this.layout.visibleRange = this.isMobile ? SCENE_TUNING.visibleRangeMobile : SCENE_TUNING.visibleRangeDesktop;
    this.layout.depthStep = this.isMobile ? SCENE_TUNING.depthStepMobile : SCENE_TUNING.depthStepDesktop;
    this.layout.verticalStep = this.isMobile ? SCENE_TUNING.verticalStepMobile : SCENE_TUNING.verticalStepDesktop;
    this.layout.staggerX = this.isMobile ? SCENE_TUNING.staggerXMobile : SCENE_TUNING.staggerXDesktop;
    this.layout.heroMinHeight = this.isMobile ? SCENE_TUNING.heroMinHeightMobile : SCENE_TUNING.heroMinHeightDesktop;

    for (const item of this.items) {
      item.setViewportMode(this.isMobile);
    }

    this.updateViewportFitMetrics();
  }

  handleViewportResize() {
    this.updateViewportFitMetrics();
  }

  updateViewportFitMetrics() {
    this.layout.viewportWidth = Math.max(window.innerWidth, 1);
    this.layout.viewportHeight = Math.max(window.innerHeight, 1);
    const distance = Math.max(this.camera.position.z, 1);
    const fovRad = (this.camera.fov * Math.PI) / 180;

    const worldHeightAtCenter = 2 * Math.tan(fovRad * 0.5) * distance;
    const worldWidthAtCenter = worldHeightAtCenter * (this.layout.viewportWidth / this.layout.viewportHeight);

    const maxVw = this.isMobile ? SCENE_TUNING.heroMaxVwMobile : SCENE_TUNING.heroMaxVwDesktop;
    const maxVh = this.isMobile ? SCENE_TUNING.heroMaxVhMobile : SCENE_TUNING.heroMaxVhDesktop;

    this.layout.fitMaxWidth = worldWidthAtCenter * maxVw;
    this.layout.fitMaxHeight = worldHeightAtCenter * maxVh;
    this.layout.worldWidthAtCenter = Math.max(worldWidthAtCenter, 1);
  }

  getBaseHeroHeightForAspect(aspectRatio) {
    const safeAspect = clamp(Number(aspectRatio) || 1.5, 0.45, 3.2);
    const availableMaxHeight = Math.max(this.layout.fitMaxHeight, this.layout.heroMinHeight * 0.84);

    let height = Math.min(availableMaxHeight, this.layout.fitMaxWidth / safeAspect);

    if (safeAspect < 1) {
      const portraitBlend = clamp((1 - safeAspect) / 0.5, 0, 1);
      height *= lerp(1, 1.14, portraitBlend);
    } else if (safeAspect > 2) {
      const panoBlend = clamp((safeAspect - 2) / 1.2, 0, 1);
      height *= lerp(1, 0.9, panoBlend);
    }

    return clamp(height, this.layout.heroMinHeight * 0.76, availableMaxHeight);
  }

  getRaycastTargets() {
    return this.visibleTargets;
  }

  getItemIndexForItem(item) {
    if (!item) return -1;
    return this.items.indexOf(item);
  }

  clearHover() {
    if (this.hoveredItem) {
      this.hoveredItem.setHoverState(false);
      this.hoveredItem = null;
    }
  }

  applyHoverHit(hit) {
    if (!hit || !hit.item || this.isMobile || this.isFocused()) {
      this.clearHover();
      return;
    }

    if (this.hoveredItem && this.hoveredItem !== hit.item) {
      this.hoveredItem.setHoverState(false);
    }

    hit.item.setHoverState(true, hit.uv);
    this.hoveredItem = hit.item;
  }

  enterFocus(index = this.activeIndex) {
    if (!this.items.length) return;
    const bounded = clamp(Math.round(index), 0, this.items.length - 1);
    this.focusIndex = bounded;
    this.focusState = 'entering';
    this.clearHover();
    if (this.reducedMotion) {
      this.focusBlend = 1;
      this.focusState = 'active';
    }
  }

  exitFocus() {
    if (this.focusState === 'idle') return;
    this.focusState = 'exiting';
    this.clearHover();
    if (this.reducedMotion) {
      this.focusBlend = 0;
      this.focusState = 'idle';
      this.focusIndex = -1;
    }
  }

  isFocused() {
    return this.focusState !== 'idle';
  }

  updateFocusBlend(dtMs) {
    const S = SCENE_TUNING;
    const alpha = this.reducedMotion ? 1 : clamp(dtMs / S.focusBlendDivisor, S.focusBlendMin, S.focusBlendMax);

    if (this.focusState === 'entering' || this.focusState === 'active') {
      this.focusBlend = lerp(this.focusBlend, 1, alpha);
      if (this.focusBlend >= 0.99) {
        this.focusBlend = 1;
        this.focusState = 'active';
      }
      return;
    }

    if (this.focusState === 'exiting') {
      this.focusBlend = lerp(this.focusBlend, 0, alpha);
      if (this.focusBlend <= 0.01) {
        this.focusBlend = 0;
        this.focusState = 'idle';
        this.focusIndex = -1;
      }
      return;
    }

    this.focusBlend = 0;
  }

  getPixelScaleAtDepth(zPosition) {
    const distance = Math.max(this.camera.position.z - zPosition, 1);
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const worldHeightAtDepth = 2 * Math.tan(fovRad * 0.5) * distance;
    const worldWidthAtDepth = worldHeightAtDepth * (this.layout.viewportWidth / this.layout.viewportHeight);
    return this.layout.viewportWidth / Math.max(worldWidthAtDepth, 1e-3);
  }

  getWorldMetricsAtDepth(zPosition) {
    const distance = Math.max(this.camera.position.z - zPosition, 1);
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const worldHeight = 2 * Math.tan(fovRad * 0.5) * distance;
    const worldWidth = worldHeight * (this.layout.viewportWidth / this.layout.viewportHeight);
    const pxPerWorld = this.layout.viewportWidth / Math.max(worldWidth, 1e-3);
    return { worldWidth, worldHeight, pxPerWorld };
  }

  getFocusSafeZonePx() {
    const S = SCENE_TUNING;
    const navMargin = this.isMobile ? S.focusNavMarginMobile : S.focusNavMarginDesktop;
    const captionMargin = this.isMobile ? S.focusCaptionMarginMobile : S.focusCaptionMarginDesktop;
    const fallbackTop = this.isMobile ? 122 : 150;
    const fallbackBottom = this.layout.viewportHeight - (this.isMobile ? 108 : 130);

    let safeTopPx = fallbackTop;
    let safeBottomPx = fallbackBottom;

    if (this.navElement) {
      const navRect = this.navElement.getBoundingClientRect();
      if (Number.isFinite(navRect.bottom)) {
        safeTopPx = Math.max(safeTopPx, navRect.bottom + navMargin);
      }
    }

    if (this.captionElement) {
      const captionRect = this.captionElement.getBoundingClientRect();
      if (Number.isFinite(captionRect.top)) {
        safeBottomPx = Math.min(safeBottomPx, captionRect.top - captionMargin);
      }
    }

    const minHeight = this.isMobile ? 220 : 260;
    safeTopPx = clamp(safeTopPx, 0, this.layout.viewportHeight - minHeight);
    safeBottomPx = clamp(safeBottomPx, safeTopPx + minHeight, this.layout.viewportHeight);

    return { safeTopPx, safeBottomPx };
  }

  resolveProjectedSpacing(states, centerIndex) {
    const gapPx = this.isMobile ? SCENE_TUNING.minProjectedGapMobile : SCENE_TUNING.minProjectedGapDesktop;
    const safeInsetRatio = this.isMobile ? SCENE_TUNING.safeInsetVwMobile : SCENE_TUNING.safeInsetVwDesktop;
    const safeInsetPx = this.layout.viewportWidth * safeInsetRatio;
    const viewportCenterPx = this.layout.viewportWidth * 0.5;
    const centerState = states.find((state) => state.index === centerIndex) || states[0];
    if (!centerState) return;

    const centerOffset = centerState.transform.x;
    for (const state of states) {
      state.transform.x -= centerOffset;
    }
    centerState.transform.x = 0;

    const rightStates = states
      .filter((state) => state.index > centerIndex)
      .sort((a, b) => a.index - b.index);

    const leftStates = states
      .filter((state) => state.index < centerIndex)
      .sort((a, b) => b.index - a.index);

    const enforcePairwise = () => {
      let prev = centerState;
      for (const state of rightStates) {
        const prevCenterPx = prev.transform.x * prev.pxPerWorld;
        const requiredCenterPx = prevCenterPx + prev.halfWidthPx + state.halfWidthPx + gapPx;
        const currentCenterPx = state.transform.x * state.pxPerWorld;
        if (currentCenterPx < requiredCenterPx) {
          state.transform.x = requiredCenterPx / state.pxPerWorld;
        }
        prev = state;
      }

      prev = centerState;
      for (const state of leftStates) {
        const prevCenterPx = prev.transform.x * prev.pxPerWorld;
        const requiredCenterPx = prevCenterPx - prev.halfWidthPx - state.halfWidthPx - gapPx;
        const currentCenterPx = state.transform.x * state.pxPerWorld;
        if (currentCenterPx > requiredCenterPx) {
          state.transform.x = requiredCenterPx / state.pxPerWorld;
        }
        prev = state;
      }
    };

    enforcePairwise();

    for (const state of rightStates) {
      const centerPx = viewportCenterPx + state.transform.x * state.pxPerWorld;
      const rightPx = centerPx + state.halfWidthPx;
      const maxRightPx = this.layout.viewportWidth - safeInsetPx;
      if (rightPx > maxRightPx) {
        state.transform.x += (maxRightPx - rightPx) / state.pxPerWorld;
      }
    }

    for (const state of leftStates) {
      const centerPx = viewportCenterPx + state.transform.x * state.pxPerWorld;
      const leftPx = centerPx - state.halfWidthPx;
      if (leftPx < safeInsetPx) {
        state.transform.x += (safeInsetPx - leftPx) / state.pxPerWorld;
      }
    }

    enforcePairwise();
    centerState.transform.x = 0;
  }

  updateLayoutDebugState(debugRects, focusDebug = null) {
    const defaultFocusState = {
      enabled: false,
      index: -1,
      safeTopPx: 0,
      safeBottomPx: 0,
      rectTopPx: 0,
      rectBottomPx: 0,
      safeTopBreached: false,
      safeBottomBreached: false,
      nearestGapPx: Infinity,
      nearestOpacity: 0
    };

    if (!debugRects.length) {
      this.layoutDebugState = {
        activeIndex: this.activeIndex,
        activeCenterPx: this.layout.viewportWidth * 0.5,
        visibleRects: [],
        minGapPx: Infinity,
        maxGapPx: 0,
        activeNeighborGapPx: Infinity,
        activeYawDeg: 0,
        focusYawDeg: 0,
        inertialVelocity: this.inertialVelocity,
        scrollJerk: this.scrollJerk,
        focusSafeZoneBreach: Boolean(focusDebug?.safeTopBreached || focusDebug?.safeBottomBreached),
        nearestFocusNeighborGapPx: Number(focusDebug?.nearestGapPx ?? Infinity),
        focus: focusDebug || defaultFocusState
      };
      return;
    }

    const sorted = [...debugRects].sort((a, b) => a.leftPx - b.leftPx);
    let minGapPx = Infinity;
    let maxGapPx = -Infinity;
    let activeNeighborGapPx = Infinity;

    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const gap = curr.leftPx - prev.rightPx;
      minGapPx = Math.min(minGapPx, gap);
      maxGapPx = Math.max(maxGapPx, gap);

      if (prev.index === this.activeIndex || curr.index === this.activeIndex) {
        activeNeighborGapPx = Math.min(activeNeighborGapPx, gap);
      }
    }

    const activeRect = sorted.find((rect) => rect.index === this.activeIndex) || sorted[0];
    const focusRect = sorted.find((rect) => rect.index === (focusDebug?.index ?? -1)) || null;
    this.layoutDebugState = {
      activeIndex: this.activeIndex,
      activeCenterPx: activeRect?.centerPx ?? this.layout.viewportWidth * 0.5,
      visibleRects: sorted,
      minGapPx,
      maxGapPx: Number.isFinite(maxGapPx) ? maxGapPx : 0,
      activeNeighborGapPx,
      activeYawDeg: Number(activeRect?.yawDeg ?? 0),
      focusYawDeg: Number(focusRect?.yawDeg ?? 0),
      inertialVelocity: this.inertialVelocity,
      scrollJerk: this.scrollJerk,
      focusSafeZoneBreach: Boolean(focusDebug?.safeTopBreached || focusDebug?.safeBottomBreached),
      nearestFocusNeighborGapPx: Number(focusDebug?.nearestGapPx ?? Infinity),
      focus: focusDebug || defaultFocusState
    };
  }

  update(time, dtMs) {
    const S = SCENE_TUNING;
    const easing = this.reducedMotion ? 1 : clamp(dtMs / S.easingDivisor, S.easingMin, S.easingMax);
    this.progress = lerp(this.progress, this.targetProgress, easing);
    this.updateFocusBlend(dtMs);
    this.updateViewportFitMetrics();

    this.visibleTargets.length = 0;

    let nextActiveIndex = this.activeIndex;
    let closestDelta = Infinity;

    const activePulse = Math.sin(time * S.activePulseSpeed) * 0.5 + 0.5;
    const yawFarBlendRange = this.isMobile ? S.obliqueYawFarBlendRangeMobile : S.obliqueYawFarBlendRangeDesktop;

    const states = [];
    for (let i = 0; i < this.items.length; i += 1) {
      const item = this.items[i];
      const delta = i - this.progress;
      const absDelta = Math.abs(delta);

      if (absDelta < closestDelta) {
        closestDelta = absDelta;
        nextActiveIndex = i;
      }

      const visible = absDelta <= this.layout.visibleRange + 0.12;
      const normalized = clamp(absDelta / Math.max(this.layout.visibleRange, 0.0001), 0, 1);
      const nearBlend = clamp(absDelta / Math.max(S.obliqueYawNearBlendRange, 0.0001), 0, 1);
      const farBlend = clamp(
        (absDelta - S.obliqueYawNearBlendRange) / Math.max(yawFarBlendRange - S.obliqueYawNearBlendRange, 0.0001),
        0,
        1
      );
      const yawDeg = absDelta <= S.obliqueYawNearBlendRange
        ? lerp(S.obliqueYawBaseDeg, S.obliqueYawMinDeg, nearBlend)
        : lerp(S.obliqueYawMinDeg, S.obliqueYawMaxDeg, farBlend);
      const rotation = THREE.MathUtils.degToRad(yawDeg * S.obliqueYawSign);
      const scaleFromDelta = lerp(S.activeScaleBoost, S.flankScaleMin, Math.pow(normalized, S.scalePow));
      const baseHeroHeight = this.getBaseHeroHeightForAspect(item.aspect || 1.5);
      const height = baseHeroHeight * scaleFromDelta;
      const width = height * (item.aspect || 1.5);

      const transform = {
        x: delta * this.layout.spacing,
        y: -Math.pow(absDelta, 1.06) * this.layout.verticalStep,
        z: -Math.pow(absDelta, 1.05) * this.layout.depthStep,
        rotX: 0,
        rotY: rotation,
        rotZ: 0,
        height,
        opacity: clamp(1 - Math.pow(absDelta, 1.08) * S.depthOpacityFalloff, 0, S.maxOpacity),
        visible
      };

      const pxPerWorld = this.getPixelScaleAtDepth(transform.z);
      const apparentWidthWorld = width * Math.max(0.26, Math.abs(Math.cos(rotation))) + (item.worldThickness || 0) * 0.9;
      const halfWidthPx = apparentWidthWorld * 0.5 * pxPerWorld;

      states.push({
        index: i,
        item,
        delta,
        absDelta,
        normalized,
        yawDeg,
        phaseBase: clamp(1 - absDelta / (this.layout.visibleRange + 0.18), 0, 1),
        transform,
        pxPerWorld,
        halfWidthPx
      });
    }

    this.resolveProjectedSpacing(states, nextActiveIndex);

    const focusIndex = this.focusIndex >= 0 ? this.focusIndex : nextActiveIndex;
    const focusSafeZone = this.focusBlend > 0 ? this.getFocusSafeZonePx() : null;
    let focusConfig = null;
    if (this.focusBlend > 0 && focusSafeZone) {
      const focusForwardZ = this.isMobile ? S.focusForwardZMobile : S.focusForwardZDesktop;
      const focusWorld = this.getWorldMetricsAtDepth(focusForwardZ);
      const maxFocusVw = this.isMobile ? S.focusMaxVwMobile : S.focusMaxVwDesktop;
      const maxFocusVh = this.isMobile ? S.focusMaxVhMobile : S.focusMaxVhDesktop;
      const safeInsetRatio = this.isMobile ? S.safeInsetVwMobile : S.safeInsetVwDesktop;
      const safeInsetPx = this.layout.viewportWidth * safeInsetRatio;
      const safeHeightPx = Math.max(140, focusSafeZone.safeBottomPx - focusSafeZone.safeTopPx);
      const safeWidthPx = Math.max(180, this.layout.viewportWidth - safeInsetPx * 2);
      const maxWidthWorld = Math.min(focusWorld.worldWidth * maxFocusVw, safeWidthPx / focusWorld.pxPerWorld);
      const maxHeightWorld = Math.min(focusWorld.worldHeight * maxFocusVh, safeHeightPx / focusWorld.pxPerWorld);
      const focusState = states.find((state) => state.index === focusIndex) || states[nextActiveIndex] || states[0];
      const focusAspect = Math.max(focusState?.item?.aspect || 1.5, 0.2);
      const maxHeightFromWidth = maxWidthWorld / focusAspect;
      const desiredHeight = (focusState?.transform?.height || this.layout.heroMinHeight) * (this.isMobile ? 1.04 : 1.08);
      const upperBound = Math.max(Math.min(maxHeightWorld, maxHeightFromWidth), this.layout.heroMinHeight * 0.72);
      const lowerBound = Math.min(this.layout.heroMinHeight * 0.64, upperBound);
      const focusHeight = clamp(Math.min(desiredHeight, upperBound), lowerBound, upperBound);
      const safeCenterPx = focusSafeZone.safeTopPx + safeHeightPx * 0.5;
      const focusCenterY = (this.layout.viewportHeight * 0.5 - safeCenterPx) / focusWorld.pxPerWorld;

      focusConfig = {
        focusForwardZ,
        focusHeight,
        focusCenterY,
        safeTopPx: focusSafeZone.safeTopPx,
        safeBottomPx: focusSafeZone.safeBottomPx
      };
    }

    const debugRects = [];
    for (const state of states) {
      const { item, index, absDelta, phaseBase, transform } = state;
      let finalTransform = transform;

      if (this.focusBlend > 0 && focusConfig) {
        const focusTarget = index === focusIndex
          ? {
              x: 0,
              y: focusConfig.focusCenterY,
              z: focusConfig.focusForwardZ,
              rotX: 0,
              rotY: 0,
              rotZ: 0,
              height: focusConfig.focusHeight,
              opacity: 1
            }
          : {
              x: transform.x * (this.isMobile ? S.focusSideXScaleMobile : S.focusSideXScaleDesktop)
                + (Math.sign(state.delta) || (index > focusIndex ? 1 : -1)) * this.layout.spacing * (this.isMobile ? 0.1 : 0.12),
              y: transform.y - (6 + state.normalized * 18),
              z: transform.z - (this.isMobile ? S.focusSideDepthPushMobile : S.focusSideDepthPushDesktop) - state.normalized * 72,
              rotX: transform.rotX,
              rotY: transform.rotY * 1.04,
              rotZ: transform.rotZ,
              height: transform.height * lerp(S.focusSideHeightNear, S.focusSideHeightFar, state.normalized),
              opacity: Math.max(S.focusSideOpacityFloor, transform.opacity * S.focusSideOpacityScale)
            };

        finalTransform = {
          x: lerp(transform.x, focusTarget.x, this.focusBlend),
          y: lerp(transform.y, focusTarget.y, this.focusBlend),
          z: lerp(transform.z, focusTarget.z, this.focusBlend),
          rotX: lerp(transform.rotX, focusTarget.rotX, this.focusBlend),
          rotY: lerp(
            transform.rotY,
            focusTarget.rotY,
            index === focusIndex ? Math.min(1, this.focusBlend * 1.35) : this.focusBlend
          ),
          rotZ: lerp(transform.rotZ, focusTarget.rotZ, this.focusBlend),
          height: lerp(transform.height, focusTarget.height, this.focusBlend),
          opacity: lerp(transform.opacity, focusTarget.opacity, this.focusBlend),
          visible: true
        };
      }

      item.setTransform(finalTransform);

      const phase = this.focusBlend > 0
        ? (index === focusIndex ? 1 : phaseBase * (1 - this.focusBlend * 0.65))
        : phaseBase;
      const activeBoost = index === nextActiveIndex ? S.activeBoostBase + activePulse * S.activeBoostPulse : 0;

      item.setDepthProfile({
        depthPhase: phase,
        fresnel: S.fresnelBase + phase * S.fresnelPhase + activeBoost,
        refraction: S.refractionBase + phase * S.refractionPhase,
        chromatic: S.chromaticBase + phase * S.chromaticPhase,
        gloss: S.glossBase + phase * S.glossPhase,
        grain: this.qualityProfile.grain * clamp(S.grainPhaseBase + phase * S.grainPhaseScale, S.grainPhaseMin, S.grainPhaseMax)
      });

      item.update(time);

      if (finalTransform.visible && finalTransform.opacity > 0.03) {
        this.visibleTargets.push(item.getRaycastTarget());
        item.loadHighResTexture();

        const pxPerWorld = this.getPixelScaleAtDepth(finalTransform.z);
        const apparentWidthWorld = finalTransform.height * (item.aspect || 1.5)
          * Math.max(0.26, Math.abs(Math.cos(finalTransform.rotY)))
          + (item.worldThickness || 0) * 0.9;
        const widthPx = apparentWidthWorld * pxPerWorld;
        const centerPx = this.layout.viewportWidth * 0.5 + finalTransform.x * pxPerWorld;
        const centerYPx = this.layout.viewportHeight * 0.5 - finalTransform.y * pxPerWorld;
        const heightPx = finalTransform.height * pxPerWorld;
        debugRects.push({
          index,
          centerPx,
          centerYPx,
          yawDeg: THREE.MathUtils.radToDeg(finalTransform.rotY),
          leftPx: centerPx - widthPx * 0.5,
          rightPx: centerPx + widthPx * 0.5,
          topPx: centerYPx - heightPx * 0.5,
          bottomPx: centerYPx + heightPx * 0.5,
          widthPx,
          heightPx,
          opacity: finalTransform.opacity
        });
      }
    }

    let focusDebug = null;
    if (focusConfig) {
      const focusRect = debugRects.find((rect) => rect.index === focusIndex) || null;
      if (focusRect) {
        let nearestGapPx = Infinity;
        let nearestOpacity = 0;

        for (const rect of debugRects) {
          if (rect.index === focusIndex) continue;
          let gap = 0;
          if (rect.rightPx <= focusRect.leftPx) {
            gap = focusRect.leftPx - rect.rightPx;
          } else if (rect.leftPx >= focusRect.rightPx) {
            gap = rect.leftPx - focusRect.rightPx;
          } else {
            gap = -Math.min(focusRect.rightPx - rect.leftPx, rect.rightPx - focusRect.leftPx);
          }

          if (Math.abs(gap) < Math.abs(nearestGapPx)) {
            nearestGapPx = gap;
            nearestOpacity = rect.opacity ?? 0;
          }
        }

        focusDebug = {
          enabled: true,
          index: focusIndex,
          safeTopPx: focusConfig.safeTopPx,
          safeBottomPx: focusConfig.safeBottomPx,
          rectTopPx: focusRect.topPx,
          rectBottomPx: focusRect.bottomPx,
          safeTopBreached: focusRect.topPx < focusConfig.safeTopPx,
          safeBottomBreached: focusRect.bottomPx > focusConfig.safeBottomPx,
          nearestGapPx,
          nearestOpacity
        };
      }
    }

    if (nextActiveIndex !== this.activeIndex) {
      this.activeIndex = nextActiveIndex;
      if (this.onActiveIndexChange) {
        this.onActiveIndexChange(this.activeIndex, this.entries[this.activeIndex]);
      }
    }

    const swayXAmp = this.isMobile ? S.cameraSwayXAmplitudeMobile : S.cameraSwayXAmplitudeDesktop;
    const swayYAmp = this.isMobile ? S.cameraSwayYAmplitudeMobile : S.cameraSwayYAmplitudeDesktop;
    const centerLock = 1 - smoothstep(S.rotationDeadband, S.cameraCenterLockRange, closestDelta);
    const centerSwayScale = 1 - centerLock * S.cameraCenterLockStrength;
    const focusSwayScale = (1 - this.focusBlend * 0.9) * centerSwayScale;

    this.camera.position.x = Math.sin(this.progress * S.cameraSwayXFrequency) * swayXAmp * focusSwayScale;
    this.camera.position.y = Math.cos(this.progress * S.cameraSwayYFrequency) * swayYAmp * focusSwayScale;
    this.updateLayoutDebugState(debugRects, focusDebug);
  }

  dispose() {
    for (const item of this.items) {
      this.scene.remove(item.mesh);
      item.dispose();
    }
    this.items.length = 0;

    for (const light of this.lights) {
      this.scene.remove(light);
    }
    this.lights.length = 0;
  }
}
