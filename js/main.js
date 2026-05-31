/**
 * Oliver Unified main JavaScript (shared)
 * Handles scroll animations, smooth scroll, portal glow, and flashlight mode.
 * Loaded on all pages as the shared base.
 *
 * Wrapped in IIFE to avoid polluting global scope.
 * Intentionally exposed on window: revealDeferredElements
 * (used by page-specific scripts such as gallery.js).
 */
(function () {
  'use strict';

  const DOUGHERTY_PARTICLE_SEQUENCE_MS = 4000;
  let confettiFired = false;
  const FLASHLIGHT_MODE_STORAGE_KEY = 'od-flashlight-mode';
  const FLASHLIGHT_BATTERY_SESSION_KEY = 'od-flashlight-battery';
  const FLASHLIGHT_POINTER_SESSION_KEY = 'od-flashlight-pointer';
  const FLASHLIGHT_MODE_ON = 'on';
  const FLASHLIGHT_MODE_OFF = 'off';

  /**
   * Reveal all .hero-deferred elements by adding .is-visible.
   * Exposed globally for use by page-specific scripts (e.g. gallery.js).
   */
  function revealDeferredElements() {
    document.querySelectorAll('.hero-deferred:not(.is-visible)').forEach((el) => {
      el.classList.add('is-visible');
    });
  }

  // Expose for use by page-specific scripts
  window.revealDeferredElements = revealDeferredElements;
  /**
   * Honor reduced-motion preference globally.
   */
  function initMotionPreference() {
    if (prefersReducedMotion()) {
      document.documentElement.classList.add('reduced-motion');
    }
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function shouldSkipPageAnimation() {
    return window.pageAnimations?.shouldSkip?.() === true;
  }

  function isFlashlightTargetPage() {
    if (
      document.body.classList.contains('page-home')
      || document.body.classList.contains('page-resume')
      || document.body.classList.contains('page-gallery')
    ) {
      return true;
    }

    const normalizedPath = window.location.pathname.replace(/\/index\.html$/, '/');
    return normalizedPath === '/'
      || normalizedPath.endsWith('/pages/resume/')
      || normalizedPath.endsWith('/pages/gallery/');
  }

  function isFlashlightModeAvailable() {
    if (!window.matchMedia) return false;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return false;
    if (window.matchMedia('(forced-colors: active)').matches) return false;
    if (prefersReducedMotion()) return false;
    return true;
  }

  function readStoredFlashlightMode() {
    try {
      return window.localStorage.getItem(FLASHLIGHT_MODE_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function persistFlashlightMode(enabled) {
    try {
      window.localStorage.setItem(
        FLASHLIGHT_MODE_STORAGE_KEY,
        enabled ? FLASHLIGHT_MODE_ON : FLASHLIGHT_MODE_OFF
      );
    } catch {
      // Intentionally ignored: localStorage may be unavailable in some contexts.
    }
  }

  function initFlashlightMode() {
    if (!isFlashlightTargetPage()) return;

    const modeToggleButton = document.querySelector('[data-flashlight-toggle]');
    if (!(modeToggleButton instanceof HTMLButtonElement)) return;

    const FLASHLIGHT_DRAIN_MS = 60000;
    const FLASHLIGHT_FINAL_FLICKER_MS = 900;
    const FLASHLIGHT_FINAL_FADE_MS = 850;
    const FLASHLIGHT_MIN_FLICKER_GAP_MS = 450;
    const FLASHLIGHT_FLICKER_GAP_RANGE_MS = 2200;
    const FLASHLIGHT_MIN_FLICKER_BURST_MS = 260;
    const FLASHLIGHT_FLICKER_BURST_RANGE_MS = 480;
    const FLASHLIGHT_MIN_FLICKER_PULSE_MS = 24;
    const FLASHLIGHT_FLICKER_PULSE_RANGE_MS = 68;
    const root = document.documentElement;

    let modeEnabled = false;
    let modeActive = false;
    let lastPointerPosition = null;
    let animationFrameId = 0;
    let lastBatteryFrameTime = null;
    let batteryRemainingMs = FLASHLIGHT_DRAIN_MS;
    let nextFlickerAt = 0;
    let flickerUntil = 0;
    let nextFlickerPulseAt = 0;
    let finalFlickerStartedAt = null;
    let finalFadeStartedAt = null;
    let lastBatteryPercent = -1;
    let lastBatterySegmentCount = -1;
    let currentCoverOpacity = '';
    let currentFlicker = '';
    let currentBeamOpacity = '';
    let hudElement = null;
    let hudPercentage = null;
    let hudSegments = [];

    const setCoverOpacity = (value) => {
      const nextValue = Math.max(0, Math.min(1, value)).toFixed(3);
      if (nextValue === currentCoverOpacity) return;
      currentCoverOpacity = nextValue;
      root.style.setProperty('--flashlight-cover-opacity', nextValue);
    };

    const setFlicker = (value) => {
      const nextValue = Math.max(0, Math.min(1, value)).toFixed(3);
      if (nextValue === currentFlicker) return;
      currentFlicker = nextValue;
      root.style.setProperty('--flashlight-flicker', nextValue);
    };

    const setBeamOpacity = (value) => {
      const nextValue = Math.max(0, Math.min(1, value)).toFixed(3);
      if (nextValue === currentBeamOpacity) return;
      currentBeamOpacity = nextValue;
      root.style.setProperty('--flashlight-beam-opacity', nextValue);
    };

    const resetEffectVars = () => {
      setCoverOpacity(0);
      setFlicker(1);
      setBeamOpacity(1);
    };

    const clampBatteryRemaining = (value) => {
      if (!Number.isFinite(value)) return FLASHLIGHT_DRAIN_MS;
      return Math.max(0, Math.min(FLASHLIGHT_DRAIN_MS, value));
    };

    const isReloadNavigation = () => {
      const navigationEntry = window.performance
        ?.getEntriesByType
        ?.('navigation')
        ?.[0];

      if (navigationEntry?.type === 'reload') return true;
      return window.performance?.navigation?.type === 1;
    };

    const readStoredBatteryRemaining = () => {
      if (isReloadNavigation()) {
        try {
          window.sessionStorage.removeItem(FLASHLIGHT_BATTERY_SESSION_KEY);
        } catch {
          // Intentionally ignored: sessionStorage may be unavailable in some contexts.
        }
        return FLASHLIGHT_DRAIN_MS;
      }

      try {
        const storedBatteryRemaining = window.sessionStorage.getItem(FLASHLIGHT_BATTERY_SESSION_KEY);
        if (storedBatteryRemaining === null) return FLASHLIGHT_DRAIN_MS;
        return clampBatteryRemaining(Number(storedBatteryRemaining));
      } catch {
        return FLASHLIGHT_DRAIN_MS;
      }
    };

    const persistBatteryRemaining = () => {
      try {
        window.sessionStorage.setItem(
          FLASHLIGHT_BATTERY_SESSION_KEY,
          String(Math.round(clampBatteryRemaining(batteryRemainingMs)))
        );
      } catch {
        // Intentionally ignored: sessionStorage may be unavailable in some contexts.
      }
    };
    const persistPointerPosition = (pointerPosition) => {
      try {
        window.sessionStorage.setItem(
          FLASHLIGHT_POINTER_SESSION_KEY,
          `${Math.round(pointerPosition.x)},${Math.round(pointerPosition.y)}`
        );
      } catch {
        // Intentionally ignored: sessionStorage may be unavailable in some contexts.
      }
    };

    const readStoredPointerPosition = () => {
      try {
        const storedPointerPosition = window.sessionStorage.getItem(FLASHLIGHT_POINTER_SESSION_KEY);
        if (storedPointerPosition === null) return null;

        const separatorIndex = storedPointerPosition.indexOf(',');
        if (separatorIndex <= 0 || separatorIndex === storedPointerPosition.length - 1) {
          return null;
        }

        const x = Number(storedPointerPosition.slice(0, separatorIndex));
        const y = Number(storedPointerPosition.slice(separatorIndex + 1));
        if (
          !Number.isFinite(x)
          || !Number.isFinite(y)
          || x < 0
          || y < 0
          || x > window.innerWidth
          || y > window.innerHeight
        ) {
          return null;
        }

        return { x, y };
      } catch {
        return null;
      }
    };


    const resolveInitialStoredMode = () => {
      if (!isReloadNavigation()) return readStoredFlashlightMode();
      persistFlashlightMode(false);
      return FLASHLIGHT_MODE_OFF;
    };

    const setPointerPosition = (clientX, clientY) => {
      root.style.setProperty('--flashlight-x', `${clientX}px`);
      root.style.setProperty('--flashlight-y', `${clientY}px`);
    };

    const readPointerPosition = (event) => {
      if (
        !event
        || typeof event.clientX !== 'number'
        || typeof event.clientY !== 'number'
        || !Number.isFinite(event.clientX)
        || !Number.isFinite(event.clientY)
      ) {
        return null;
      }

      if (
        event.type === 'click'
        && event.detail === 0
        && event.clientX === 0
        && event.clientY === 0
      ) {
        return null;
      }

      return { x: event.clientX, y: event.clientY };
    };

    const rememberPointerPosition = (event) => {
      const pointerPosition = readPointerPosition(event);
      if (!pointerPosition) return null;
      lastPointerPosition = pointerPosition;
      persistPointerPosition(pointerPosition);
      return pointerPosition;
    };

    const resolveActivationPosition = (event) => {
      return rememberPointerPosition(event) || lastPointerPosition || readStoredPointerPosition();
    };

    const syncToggleLabel = () => {
      const nextAction = modeEnabled ? 'Disable blackout mode' : 'Enable blackout mode';
      modeToggleButton.setAttribute('aria-label', nextAction);
      modeToggleButton.setAttribute('aria-pressed', String(modeEnabled));
      modeToggleButton.dataset.mode = modeEnabled ? FLASHLIGHT_MODE_ON : FLASHLIGHT_MODE_OFF;
      modeToggleButton.title = nextAction;
    };

    const createHud = () => {
      if (hudElement) return;

      hudElement = document.createElement('div');
      hudElement.className = 'flashlight-hud';
      hudElement.setAttribute('aria-hidden', 'true');
      hudElement.innerHTML = `
        <div class="flashlight-hud__readout">
          <span class="flashlight-hud__label">Power left</span>
          <span class="flashlight-hud__percent" data-flashlight-power-value>100%</span>
        </div>
        <div class="flashlight-hud__battery" aria-hidden="true">
          <span class="flashlight-hud__segment"></span>
          <span class="flashlight-hud__segment"></span>
          <span class="flashlight-hud__segment"></span>
          <span class="flashlight-hud__segment"></span>
          <span class="flashlight-hud__segment"></span>
        </div>
      `;
      hudPercentage = hudElement.querySelector('[data-flashlight-power-value]');
      hudSegments = Array.from(hudElement.querySelectorAll('.flashlight-hud__segment'));
      document.body.appendChild(hudElement);
    };

    const updateHud = (percent) => {
      const nextPercent = Math.max(0, Math.min(100, Math.round(percent)));
      if (nextPercent === lastBatteryPercent) return;

      lastBatteryPercent = nextPercent;
      root.style.setProperty('--flashlight-power', `${nextPercent}%`);

      if (hudPercentage) {
        hudPercentage.textContent = `${nextPercent}%`;
      }

      if (hudElement) {
        let powerState = 'ok';
        if (nextPercent === 0) {
          powerState = 'empty';
        } else if (nextPercent <= 15) {
          powerState = 'critical';
        } else if (nextPercent <= 35) {
          powerState = 'low';
        }
        hudElement.dataset.powerState = powerState;
      }

      const activeSegmentCount = Math.ceil(nextPercent / 20);
      if (activeSegmentCount === lastBatterySegmentCount) return;

      lastBatterySegmentCount = activeSegmentCount;
      hudSegments.forEach((segment, index) => {
        segment.classList.toggle('is-active', index < activeSegmentCount);
      });
    };

    const stopBatteryLoop = () => {
      if (!animationFrameId) return;
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = 0;
    };

    const queueBatteryFrame = () => {
      animationFrameId = window.requestAnimationFrame(handleBatteryFrame);
    };

    const scheduleNextFlicker = (timestamp) => {
      nextFlickerAt = timestamp
        + FLASHLIGHT_MIN_FLICKER_GAP_MS
        + (Math.random() * FLASHLIGHT_FLICKER_GAP_RANGE_MS);
    };

    const scheduleNextFlickerPulse = (timestamp) => {
      nextFlickerPulseAt = timestamp
        + FLASHLIGHT_MIN_FLICKER_PULSE_MS
        + (Math.random() * FLASHLIGHT_FLICKER_PULSE_RANGE_MS);
    };

    const nextFlickerIntensity = () => {
      if (Math.random() < 0.22) {
        return 0.74 + (Math.random() * 0.22);
      }
      return 0.28 + (Math.random() * 0.42);
    };

    const updateActiveFlicker = (timestamp) => {
      if (nextFlickerAt === 0) {
        scheduleNextFlicker(timestamp);
      }

      if (timestamp >= nextFlickerAt) {
        flickerUntil = timestamp
          + FLASHLIGHT_MIN_FLICKER_BURST_MS
          + (Math.random() * FLASHLIGHT_FLICKER_BURST_RANGE_MS);
        nextFlickerPulseAt = 0;
        scheduleNextFlicker(timestamp + (Math.random() * FLASHLIGHT_FLICKER_GAP_RANGE_MS));
      }

      if (timestamp < flickerUntil) {
        if (nextFlickerPulseAt === 0 || timestamp >= nextFlickerPulseAt) {
          const coverOpacity = nextFlickerIntensity();
          setCoverOpacity(coverOpacity);
          setFlicker(1 - coverOpacity);
          scheduleNextFlickerPulse(timestamp);
        }
        return;
      }

      setCoverOpacity(0);
      setFlicker(1);
    };

    const updateDepletedState = (timestamp) => {
      updateHud(0);

      if (finalFlickerStartedAt === null) {
        finalFlickerStartedAt = timestamp;
      }

      const flickerElapsed = timestamp - finalFlickerStartedAt;
      if (flickerElapsed < FLASHLIGHT_FINAL_FLICKER_MS) {
        const progress = flickerElapsed / FLASHLIGHT_FINAL_FLICKER_MS;
        const coverOpacity = Math.min(0.74, 0.18 + (progress * 0.32) + (Math.random() * 0.28));
        setCoverOpacity(coverOpacity);
        setFlicker(1 - coverOpacity);
        setBeamOpacity(1);
        return true;
      }

      if (finalFadeStartedAt === null) {
        finalFadeStartedAt = timestamp;
      }

      const fadeProgress = Math.min(1, (timestamp - finalFadeStartedAt) / FLASHLIGHT_FINAL_FADE_MS);
      const beamOpacity = 1 - fadeProgress;
      setBeamOpacity(beamOpacity);
      setFlicker(beamOpacity);
      setCoverOpacity(fadeProgress);
      return fadeProgress < 1;
    };

    function handleBatteryFrame(timestamp) {
      animationFrameId = 0;
      if (!modeEnabled) return;

      if (lastBatteryFrameTime === null) {
        lastBatteryFrameTime = timestamp;
        scheduleNextFlicker(timestamp);
      } else {
        batteryRemainingMs = clampBatteryRemaining(batteryRemainingMs - Math.max(0, timestamp - lastBatteryFrameTime));
        lastBatteryFrameTime = timestamp;
      }

      persistBatteryRemaining();

      if (batteryRemainingMs <= 0) {
        if (updateDepletedState(timestamp)) {
          queueBatteryFrame();
        }
        return;
      }

      updateHud((batteryRemainingMs / FLASHLIGHT_DRAIN_MS) * 100);
      setBeamOpacity(1);
      updateActiveFlicker(timestamp);
      queueBatteryFrame();
    }

    const startBatteryLoop = () => {
      stopBatteryLoop();
      lastBatteryFrameTime = null;
      nextFlickerAt = 0;
      flickerUntil = 0;
      nextFlickerPulseAt = 0;
      finalFlickerStartedAt = batteryRemainingMs <= 0 ? 0 : null;
      finalFadeStartedAt = batteryRemainingMs <= 0 ? 0 : null;
      lastBatteryPercent = -1;
      lastBatterySegmentCount = -1;
      resetEffectVars();
      updateHud((batteryRemainingMs / FLASHLIGHT_DRAIN_MS) * 100);

      if (batteryRemainingMs <= 0) {
        setCoverOpacity(1);
        setFlicker(0);
        setBeamOpacity(0);
        return;
      }

      queueBatteryFrame();
    };

    const activateModeAtPosition = (pointerPosition) => {
      setPointerPosition(pointerPosition.x, pointerPosition.y);
      createHud();
      root.setAttribute('data-flashlight-mode', FLASHLIGHT_MODE_ON);
      document.body.classList.add('flashlight-mode-active');

      if (modeActive) return;
      modeActive = true;
      startBatteryLoop();
    };

    const suspendActiveMode = (shouldPersistBattery = true) => {
      if (!modeActive) return;
      modeActive = false;
      stopBatteryLoop();
      if (shouldPersistBattery) {
        persistBatteryRemaining();
      }
      root.setAttribute('data-flashlight-mode', FLASHLIGHT_MODE_ON);
      document.body.classList.add('flashlight-mode-active');
      setCoverOpacity(1);
      setFlicker(0);
      setBeamOpacity(0);
    };

    function handlePointerMove(event) {
      const pointerPosition = rememberPointerPosition(event);
      if (!pointerPosition) return;

      if (modeEnabled && !modeActive) {
        activateModeAtPosition(pointerPosition);
        return;
      }

      if (modeActive) {
        setPointerPosition(pointerPosition.x, pointerPosition.y);
      }
    }

    function handlePointerInput(event) {
      const pointerPosition = rememberPointerPosition(event);
      if (!pointerPosition) return;

      if (modeEnabled && !modeActive) {
        activateModeAtPosition(pointerPosition);
        return;
      }

      if (modeActive) {
        setPointerPosition(pointerPosition.x, pointerPosition.y);
      }
    }

    const isViewportBoundaryEvent = (event) => {
      return event.relatedTarget === null && event.toElement === null;
    };

    function handleViewportExit(event) {
      if (!isViewportBoundaryEvent(event)) return;
      suspendActiveMode();
    }

    function handleViewportReentry(event) {
      if (!isViewportBoundaryEvent(event)) return;
      handlePointerInput(event);
    }
    function handleWindowBlur() {
      suspendActiveMode();
    }


    const startModeTracking = () => {
      window.addEventListener('pointermove', handlePointerMove, { passive: true });
      window.addEventListener('pointerdown', handlePointerInput, { passive: true });
      window.addEventListener('click', handlePointerInput, { passive: true });
      window.addEventListener('mouseout', handleViewportExit, { passive: true });
      window.addEventListener('mouseover', handleViewportReentry, { passive: true });
      window.addEventListener('blur', handleWindowBlur);
    };

    const stopModeTracking = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerInput);
      window.removeEventListener('click', handlePointerInput);
      window.removeEventListener('mouseout', handleViewportExit);
      window.removeEventListener('mouseover', handleViewportReentry);
      window.removeEventListener('blur', handleWindowBlur);
    };

    const clearMode = (shouldPersistBattery = true) => {
      stopModeTracking();
      stopBatteryLoop();
      modeActive = false;
      if (shouldPersistBattery) {
        persistBatteryRemaining();
      }
      root.removeAttribute('data-flashlight-mode');
      document.body.classList.remove('flashlight-mode-active');
      root.style.setProperty('--flashlight-x', '50vw');
      root.style.setProperty('--flashlight-y', '50vh');
      resetEffectVars();
    };
    if (!isFlashlightModeAvailable()) {
      clearMode(false);
      modeToggleButton.remove();
      return;
    }


    const applyMode = (enabled, event, options = {}) => {
      modeEnabled = Boolean(enabled);

      if (modeEnabled) {
        startModeTracking();
        const activationPosition = resolveActivationPosition(event);
        if (activationPosition) {
          activateModeAtPosition(activationPosition);
        } else {
          suspendActiveMode(false);
        }
      } else {
        clearMode(options.persistBattery !== false);
      }

      syncToggleLabel();
    };

    modeToggleButton.addEventListener('pointermove', rememberPointerPosition, { passive: true });
    modeToggleButton.addEventListener('pointerdown', rememberPointerPosition, { passive: true });

    batteryRemainingMs = readStoredBatteryRemaining();
    const storedMode = resolveInitialStoredMode();
    applyMode(storedMode === FLASHLIGHT_MODE_ON, undefined, { persistBattery: !isReloadNavigation() });

    modeToggleButton.addEventListener('click', (event) => {
      applyMode(!modeEnabled, event);
      persistFlashlightMode(modeEnabled);
    });

    window.addEventListener('pageshow', () => {
      if (!modeEnabled || modeActive) return;
      const activationPosition = lastPointerPosition || readStoredPointerPosition();
      if (activationPosition) {
        activateModeAtPosition(activationPosition);
      }
    });
  }

  function initParticleWordmark() {
    const title = document.querySelector('.blueprint-title');
    const finalWord = title?.querySelector('.blueprint-final-word');
    const canvas = title?.querySelector('.particle-canvas');

    if (!title || !finalWord || !canvas) return;

    if (prefersReducedMotion() || shouldSkipPageAnimation()) {
      title.classList.add('is-particle-complete', 'is-static-word');
      return;
    }

    window.pageAnimations?.markSeen?.();
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const hero = title.closest('.schematic-wrapper') || document.body;
    const word = finalWord.textContent?.trim() || 'DOUGHERTY';
    let particles = [];
    let animationFrameId = 0;
    let resizeFrameId = 0;
    let isComplete = false;
    let canvasWidth = 0;
    let canvasHeight = 0;
    let canvasDpr = 1;
    const pointer = {
      x: 0,
      y: 0,
      active: false
    };

    if (canvas.parentElement !== hero) {
      hero.appendChild(canvas);
    }

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const easeOutCubic = (value) => 1 - Math.pow(1 - clamp(value, 0, 1), 3);

    const updatePointer = (event) => {
      const heroRect = hero.getBoundingClientRect();
      const nextX = event.clientX - heroRect.left;
      const nextY = event.clientY - heroRect.top;
      pointer.x = nextX;
      pointer.y = nextY;
      pointer.active = (
        nextX >= 0
        && nextY >= 0
        && nextX <= heroRect.width
        && nextY <= heroRect.height
      );
    };

    const clearPointer = () => {
      pointer.active = false;
    };

    const clearPointerOnViewportExit = (event) => {
      if (event.relatedTarget !== null || event.toElement !== null) return;
      clearPointer();
    };

    window.addEventListener('pointermove', updatePointer, { passive: true });
    window.addEventListener('pointerleave', clearPointer, { passive: true });
    window.addEventListener('mouseout', clearPointerOnViewportExit, { passive: true });
    window.addEventListener('scroll', clearPointer, { passive: true });
    window.addEventListener('blur', clearPointer);

    const startRender = () => {
      const getDpr = () => window.devicePixelRatio || 1;
      const dpr = getDpr();
      const heroRect = hero.getBoundingClientRect();
      const wordRect = finalWord.getBoundingClientRect();
      const width = wordRect.width;
      const height = wordRect.height;

      if (width === 0 || height === 0) return;

      canvasDpr = Math.min(2, dpr);
      canvasWidth = Math.max(1, Math.round(heroRect.width));
      canvasHeight = Math.max(1, Math.round(heroRect.height));
      canvas.width = Math.round(canvasWidth * canvasDpr);
      canvas.height = Math.round(canvasHeight * canvasDpr);
      canvas.style.width = `${canvasWidth}px`;
      canvas.style.height = `${canvasHeight}px`;
      ctx.setTransform(canvasDpr, 0, 0, canvasDpr, 0, 0);

      const wordStyle = window.getComputedStyle(finalWord);
      const fontSize = wordStyle.fontSize || '16px';
      const fontFamily = wordStyle.fontFamily || 'sans-serif';
      const fontWeight = wordStyle.fontWeight || '800';
      const letterSpacing = wordStyle.letterSpacing || 'normal';

      const offCanvas = document.createElement('canvas');
      const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
      if (!offCtx) return;
      offCanvas.width = Math.ceil(width * canvasDpr);
      offCanvas.height = Math.ceil(height * canvasDpr);
      offCtx.scale(canvasDpr, canvasDpr);

      offCtx.font = `${fontWeight} ${fontSize} ${fontFamily}`;
      offCtx.fillStyle = '#000';
      offCtx.textBaseline = 'alphabetic';
      offCtx.letterSpacing = letterSpacing;

      const baselineY = height * 0.82;
      offCtx.fillText(word, 0, baselineY);

      const imgData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height).data;
      particles = [];

      const sampleStep = Math.max(2, Math.round(canvasDpr * (canvasWidth < 760 ? 3 : 2.35)));
      const targetOffsetX = wordRect.left - heroRect.left;
      const targetOffsetY = wordRect.top - heroRect.top;
      const heroCenterX = canvasWidth / 2;
      const heroCenterY = canvasHeight / 2;
      const alreadyComplete = isComplete;

      for (let y = 0; y < offCanvas.height; y += sampleStep) {
        for (let x = 0; x < offCanvas.width; x += sampleStep) {
          const alpha = imgData[(y * offCanvas.width + x) * 4 + 3];
          if (alpha > 128) {
            const targetX = targetOffsetX + (x / canvasDpr);
            const targetY = targetOffsetY + (y / canvasDpr);
            const angle = Math.random() * Math.PI * 2;
            const orbitDistance = Math.max(canvasWidth, canvasHeight) * (0.28 + Math.random() * 0.62);
            const randomViewportX = Math.random() * canvasWidth;
            const randomViewportY = Math.random() * canvasHeight;
            const originX = (randomViewportX * 0.42) + ((heroCenterX + Math.cos(angle) * orbitDistance) * 0.58);
            const originY = (randomViewportY * 0.42) + ((heroCenterY + Math.sin(angle) * orbitDistance) * 0.58);

            particles.push({
              x: alreadyComplete ? targetX + ((Math.random() - 0.5) * 3) : originX,
              y: alreadyComplete ? targetY + ((Math.random() - 0.5) * 3) : originY,
              targetX,
              targetY,
              vx: 0,
              vy: 0,
              delay: alreadyComplete ? 0 : Math.random() * 620,
              seed: Math.random() * Math.PI * 2,
              orbit: Math.random() > 0.5 ? 1 : -1,
              aliveAmp: 0.45 + Math.random() * 1.65,
              color: Math.random() > 0.95 ? '#FF6700' : '#000000',
              size: Math.random() * 0.85 + 0.45
            });
          }
        }
      }

      particles.sort(() => Math.random() - 0.5);

      const animationStartTime = performance.now() - (alreadyComplete ? DOUGHERTY_PARTICLE_SEQUENCE_MS : 0);

      const draw = (time) => {
        const elapsed = time - animationStartTime;
        const progress = clamp(elapsed / DOUGHERTY_PARTICLE_SEQUENCE_MS, 0, 1);
        const easedProgress = easeOutCubic(progress);
        const interactive = progress >= 1;
        const fadeAlpha = interactive ? 0.36 : 0.24;

        ctx.fillStyle = `rgba(255, 255, 255, ${fadeAlpha})`;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          if (elapsed < p.delay) {
            continue;
          }

          const fieldTime = time * 0.001;
          const introSwirl = Math.max(0, 1 - easedProgress);
          const aliveSwirl = interactive ? 1 : easedProgress * 0.18;
          const aliveX = Math.sin((fieldTime * 1.4) + p.seed + (p.targetY * 0.018)) * p.aliveAmp * aliveSwirl;
          const aliveY = Math.cos((fieldTime * 1.2) + p.seed + (p.targetX * 0.014)) * p.aliveAmp * aliveSwirl;
          const targetX = p.targetX + aliveX;
          const targetY = p.targetY + aliveY;

          const dx = targetX - p.x;
          const dy = targetY - p.y;

          const flowX = Math.sin((p.y * 0.018) + (fieldTime * 5.2) + p.seed) * 2.8 * introSwirl;
          const flowY = Math.cos((p.x * 0.016) + (fieldTime * 4.8) + p.seed) * 2.8 * introSwirl;
          const springForce = interactive ? 0.034 : 0.012 + (easedProgress * 0.072);
          const friction = interactive ? 0.86 : 0.835;

          p.vx += (dx * springForce) + flowX;
          p.vy += (dy * springForce) + flowY;

          if (interactive && pointer.active) {
            const pointerDx = p.x - pointer.x;
            const pointerDy = p.y - pointer.y;
            const pointerDistance = Math.max(1, Math.hypot(pointerDx, pointerDy));
            const radius = clamp(Math.min(canvasWidth, canvasHeight) * 0.16, 92, 168);

            if (pointerDistance < radius) {
              const strength = Math.pow(1 - (pointerDistance / radius), 2);
              const push = strength * 16;
              const normalX = pointerDx / pointerDistance;
              const normalY = pointerDy / pointerDistance;
              p.vx += (normalX * push) + (-normalY * push * 0.22 * p.orbit);
              p.vy += (normalY * push) + (normalX * push * 0.22 * p.orbit);
            }
          }

          p.vx *= friction;
          p.vy *= friction;

          const prevX = p.x;
          const prevY = p.y;

          p.x += p.vx;
          p.y += p.vy;

          if (interactive) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 0.72, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.moveTo(prevX - p.vx * 1.25, prevY - p.vy * 1.25);
            ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size;
            ctx.lineCap = 'round';
            ctx.stroke();
          }
        }

        if (interactive && !isComplete) {
          isComplete = true;
          title.classList.add('is-particle-complete');
        }

        animationFrameId = requestAnimationFrame(draw);
      };

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      animationFrameId = requestAnimationFrame(draw);
    };

    const scheduleRender = () => {
      if (resizeFrameId) return;
      resizeFrameId = window.requestAnimationFrame(() => {
        resizeFrameId = 0;
        startRender();
      });
    };

    window.addEventListener('resize', scheduleRender, { passive: true });

    if (document.fonts?.ready) {
      Promise.race([
        document.fonts.ready,
        new Promise((resolve) => window.setTimeout(resolve, 3000))
      ]).then(startRender).catch(startRender);
    } else {
      startRender();
    }
  }

  /**
   * Keep below-fold imagery out of the initial home-page load.
   */
  function initDeferredImages() {
    const images = document.querySelectorAll('img[data-deferred-src]');
    if (!images.length) return;

    const loadImage = (image) => {
      const src = image.getAttribute('data-deferred-src');
      if (!src) return;

      image.src = src;
      image.removeAttribute('data-deferred-src');
    };

    if (!('IntersectionObserver' in window)) {
      images.forEach(loadImage);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        loadImage(entry.target);
        observer.unobserve(entry.target);
      });
    }, {
      rootMargin: '80px 0px'
    });

    images.forEach((image) => observer.observe(image));
  }

  /**
   * Home hero: reveal deferred elements when the DOUGHERTY blueprint finishes,
   * or when the user scrolls past the wordmark (animations jump to the end).
   *
   * Timing:
   *   - Deferred elements (corners, below-fold) fade in when the blueprint completes (~7.4s)
   *   - If user scrolls past the hero, everything reveals immediately
   */
  function initHeroNavReveal() {
    if (!document.body.classList.contains('page-home')) return;

    const blueprint = document.querySelector('.blueprint-title');
    if (!blueprint) return;

    if (prefersReducedMotion() || shouldSkipPageAnimation()) {
      revealDeferredElements();
      return;
    }

    // If the user reloaded while scrolled past the hero, skip the animation entirely.
    // Browser restores scrollY before DOMContentLoaded, so this catches the reload case.
    const heroBottom = blueprint.getBoundingClientRect().bottom;
    if (heroBottom < 0) {
      revealDeferredElements();
      return;
    }

    let revealTimer = null;
    let revealed = false;

    const finishParticleAnimations = () => {
      const root = document.querySelector('.blueprint-title');
      if (!root) return;
      root.classList.add('is-particle-complete');
    };

    const reveal = () => {
      if (revealed) return;
      revealed = true;
      if (revealTimer !== null) {
        window.clearTimeout(revealTimer);
        revealTimer = null;
      }
      revealDeferredElements();
      window.removeEventListener('scroll', onScrollMaybePastDougherty, { passive: true });
    };

    // rAF-throttled scroll handler to avoid calling getBoundingClientRect on every scroll event.
    let scrollFrame = 0;
    const onScrollMaybePastDougherty = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0;
        if (blueprint.getBoundingClientRect().bottom < 0) {
          finishParticleAnimations();
          reveal();
        }
      });
    };

    window.addEventListener('scroll', onScrollMaybePastDougherty, { passive: true });

    // Deferred elements reveal when the particle animation completes
    revealTimer = window.setTimeout(reveal, DOUGHERTY_PARTICLE_SEQUENCE_MS);
  }

  /**
   * Scroll-triggered animations using Intersection Observer
   */
  function initScrollAnimations() {
    const animatedElements = document.querySelectorAll('[data-animate]');
    const maskElements = document.querySelectorAll('.scroll-mask-wrap');

    if (!animatedElements.length && !maskElements.length) return;

    if (prefersReducedMotion()) {
      animatedElements.forEach((el) => el.classList.add('visible'));
      maskElements.forEach((el) => {
        const inner = el.querySelector('.mask-inner');
        if (inner) inner.style.transform = 'translateY(0)';
      });
      return;
    }

    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -15% 0px',
      threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (entry.target.hasAttribute('data-animate')) {
            entry.target.classList.add('visible');
          } else if (entry.target.classList.contains('scroll-mask-wrap')) {
            const inner = entry.target.querySelector('.mask-inner');
            if (inner) inner.style.animationName = 'maskReveal';
          }
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    animatedElements.forEach(el => observer.observe(el));
    maskElements.forEach(el => {
      const inner = el.querySelector('.mask-inner');
      if (inner) inner.style.animationName = 'none'; // Pause until intersected
      observer.observe(el);
    });
  }

  /**
   * Smooth scroll for anchor links.
   * Uses a CSS class (.smooth-scroll-target) instead of inline scrollMarginTop
   * to avoid forced reflows and residual styles.
   */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');

        if (href === '#') return;

        const target = document.querySelector(href);

        if (target) {
          e.preventDefault();

          const navHeight = document.querySelector('.nav')?.offsetHeight || 0;
          const scrollMarginTop = Number.parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0;
          const fallbackOffset = navHeight + 20;
          const targetOffset = scrollMarginTop || fallbackOffset;

          if (prefersReducedMotion()) {
            const targetPosition = target.getBoundingClientRect().top + window.scrollY - targetOffset;
            window.scrollTo(0, targetPosition);
          } else {
            // Temporarily add a CSS class that provides the scroll-margin-top offset,
            // then remove it after the scroll animation completes.
            if (!scrollMarginTop && targetOffset > 0) {
              target.classList.add('smooth-scroll-target');
              target.style.setProperty('--smooth-scroll-offset', `${targetOffset}px`);
            }

            target.scrollIntoView({ behavior: 'smooth', block: 'start' });

            if (!scrollMarginTop && targetOffset > 0) {
              window.setTimeout(() => {
                target.classList.remove('smooth-scroll-target');
                target.style.removeProperty('--smooth-scroll-offset');
              }, prefersReducedMotion() ? 0 : 1200);
            }
          }
        }
      });
    });
  }

  /**
   * Utility: Debounce function
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Portal card cursor-following glow effect (landing page only)
   * Throttled with requestAnimationFrame to avoid excessive reflows
   */
  function initPortalGlow() {
    const portalCards = document.querySelectorAll('.portal-card');

    if (!portalCards.length) return;
    if (prefersReducedMotion()) return;

    portalCards.forEach(card => {
      const portalBg = card.querySelector('.portal-bg');
      let rafPending = false;

      card.addEventListener('mousemove', (e) => {
        if (rafPending) return;
        rafPending = true;

        requestAnimationFrame(() => {
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;

          card.style.setProperty('--mouse-x', `${x}px`);
          card.style.setProperty('--mouse-y', `${y}px`);
          rafPending = false;
        });
      });

      card.addEventListener('mouseleave', () => {
        if (portalBg) {
          portalBg.style.transition = 'opacity 400ms ease';
          portalBg.style.opacity = '0';
          setTimeout(() => {
            card.style.setProperty('--mouse-x', '50%');
            card.style.setProperty('--mouse-y', '50%');
            portalBg.style.transition = '';
            portalBg.style.opacity = '';
          }, 400);
        }
      });
    });
  }

  /**
   * OSU stat hover: orange confetti emanates from the OSU text once per page load.
   */
  function initOsuConfetti() {
    if (prefersReducedMotion()) return;

    const osuText = document.querySelector('.osu-text');
    if (!osuText) return;

    const trigger = osuText.closest('.stat-value');
    if (!trigger) return;

    window.addEventListener('pageshow', (event) => {
      const navEntry = performance.getEntriesByType?.('navigation')?.[0];
      if (event.persisted || navEntry?.type === 'back_forward') {
        confettiFired = false;
      }
    });

    const colors = ['#d73f09', '#FF6700', '#ff8c42', '#000000'];

    const createCanvas = () => {
      const canvas = document.createElement('canvas');
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '100';
      document.body.appendChild(canvas);
      return { canvas, ctx: canvas.getContext('2d'), dpr };
    };

    const createParticles = (originX, originY) => {
      const count = 100 + Math.floor(Math.random() * 41); // 100-140
      const particles = [];
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 6 - Math.random() * (2 * Math.PI / 3); // -30deg to -150deg
        const velocity = 3 + Math.random() * 9;
        particles.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          size: 4 + Math.random() * 6,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          decay: 0.008 + Math.random() * 0.018,
          gravity: 0.12 + Math.random() * 0.12
        });
      }
      return particles;
    };

    const fireConfetti = () => {
      if (confettiFired) return;
      confettiFired = true;

      const rect = trigger.getBoundingClientRect();
      const originX = rect.left + rect.width / 2;
      const originY = rect.top + rect.height / 2;

      const { canvas, ctx, dpr } = createCanvas();
      const particles = createParticles(originX * dpr, originY * dpr);

      let animationId;

      const render = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;

        for (const p of particles) {
          if (p.alpha <= 0) continue;
          alive = true;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.gravity;
          p.alpha -= p.decay;

          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size * dpr, p.size * dpr);
        }

        ctx.globalAlpha = 1;

        if (alive) {
          animationId = requestAnimationFrame(render);
        } else {
          cancelAnimationFrame(animationId);
          canvas.remove();
        }
      };

      animationId = requestAnimationFrame(render);
      trigger.removeEventListener('mouseenter', fireConfetti);
    };

    trigger.addEventListener('mouseenter', fireConfetti);
  }

  // --- Initialization ---
  document.addEventListener('DOMContentLoaded', () => {
    initMotionPreference();
    initFlashlightMode();
    initParticleWordmark();
    initHeroNavReveal();
    initDeferredImages();
    initScrollAnimations();
    initSmoothScroll();
    initPortalGlow();
    initOsuConfetti();
  });
})();
