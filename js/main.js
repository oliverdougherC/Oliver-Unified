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

  const DOUGHERTY_PARTICLE_SEQUENCE_MS = 7600;
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

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    if (prefersReducedMotion()) {
      title.classList.add('is-reduced-static-word');
      return;
    }

    const word = finalWord.textContent?.trim() || 'DOUGHERTY';
    let particles = [];
    let animationFrameId = 0;
    let resizeFrameId = 0;
    let isComplete = false;
    let canvasWidth = 0;
    let canvasHeight = 0;
    let canvasDpr = 1;
    let animationStartTime = 0;

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const easeOutCubic = (value) => 1 - Math.pow(1 - clamp(value, 0, 1), 3);
    const easeOutQuint = (value) => 1 - Math.pow(1 - clamp(value, 0, 1), 5);
    const easeInOutCubic = (value) => {
      const easedValue = clamp(value, 0, 1);
      return easedValue < 0.5
        ? 4 * easedValue * easedValue * easedValue
        : 1 - Math.pow(-2 * easedValue + 2, 3) / 2;
    };

    const hashString = (value) => {
      let hash = 2166136261;
      for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return hash >>> 0;
    };

    const createSeededRandom = (seed) => {
      let state = seed >>> 0;
      return () => {
        state += 0x6D2B79F5;
        let value = Math.imul(state ^ (state >>> 15), state | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
      };
    };

    const supportsFinePointer = () => window.matchMedia
      && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const maxParticlesForViewport = () => {
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      if (viewportWidth < 640) return 2400;
      if (viewportWidth < 1024) return 5200;
      return 9000;
    };

    const drawParticle = (particle, x = particle.x, y = particle.y) => {
      ctx.beginPath();
      ctx.arc(x, y, particle.size, 0, Math.PI * 2);
      ctx.fillStyle = particle.color;
      ctx.fill();
    };

    const drawStaticFrame = () => {
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      for (const p of particles) {
        p.x = p.targetX;
        p.y = p.targetY;
        p.vx = 0;
        p.vy = 0;
        drawParticle(p);
      }
    };

    let hoverPointer = null;
    let hoverFrameId = 0;

    const completeWordmark = () => {
      if (isComplete) return;
      isComplete = true;
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
      if (hoverFrameId) {
        window.cancelAnimationFrame(hoverFrameId);
        hoverFrameId = 0;
      }
      drawStaticFrame();
      title.classList.remove('is-particle-building');
      title.classList.add('is-particle-complete', 'is-static-wordmark');
      title.dispatchEvent(new CustomEvent('od:home-wordmark-complete', { bubbles: true }));
    };

    const renderHoverFrame = (time) => {
      hoverFrameId = 0;
      if (!isComplete) return;

      const pointerActive = Boolean(hoverPointer);
      const radius = clamp(canvasWidth * 0.035, 26, 54);
      let needsNextFrame = false;

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      for (const p of particles) {
        let desiredX = p.targetX;
        let desiredY = p.targetY;

        if (pointerActive) {
          const dx = p.targetX - hoverPointer.x;
          const dy = p.targetY - hoverPointer.y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          if (distance < radius) {
            const field = Math.pow(1 - (distance / radius), 2);
            const normalX = dx / distance;
            const normalY = dy / distance;
            const push = field * clamp(canvasWidth * 0.021, 12, 24);
            desiredX += (normalX * push) - (normalY * push * 0.32);
            desiredY += (normalY * push) + (normalX * push * 0.18);
          }
        }

        const ax = (desiredX - p.x) * 0.18;
        const ay = (desiredY - p.y) * 0.18;
        p.vx = (p.vx + ax) * 0.72;
        p.vy = (p.vy + ay) * 0.72;
        p.x += p.vx;
        p.y += p.vy;

        if (
          Math.abs(p.x - p.targetX) > 0.08
          || Math.abs(p.y - p.targetY) > 0.08
          || Math.abs(p.vx) > 0.05
          || Math.abs(p.vy) > 0.05
          || pointerActive
        ) {
          needsNextFrame = true;
        }

        drawParticle(p);
      }

      if (needsNextFrame) {
        hoverFrameId = window.requestAnimationFrame(renderHoverFrame);
      } else {
        drawStaticFrame();
      }
    };

    const queueHoverFrame = () => {
      if (!isComplete || hoverFrameId) return;
      hoverFrameId = window.requestAnimationFrame(renderHoverFrame);
    };

    const updateHoverPointer = (event) => {
      if (!isComplete || !supportsFinePointer()) return;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const isInside = event.clientX >= rect.left
        && event.clientX <= rect.right
        && event.clientY >= rect.top
        && event.clientY <= rect.bottom;

      if (!isInside) {
        if (hoverPointer) {
          hoverPointer = null;
          queueHoverFrame();
        }
        return;
      }

      hoverPointer = {
        x: ((event.clientX - rect.left) / rect.width) * canvasWidth,
        y: ((event.clientY - rect.top) / rect.height) * canvasHeight
      };
      queueHoverFrame();
    };

    title.addEventListener('od:home-wordmark-force-complete', completeWordmark);
    window.addEventListener('pointermove', updateHoverPointer, { passive: true });
    window.addEventListener('pagehide', () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
      if (hoverFrameId) {
        window.cancelAnimationFrame(hoverFrameId);
        hoverFrameId = 0;
      }
      if (resizeFrameId) {
        window.cancelAnimationFrame(resizeFrameId);
        resizeFrameId = 0;
      }
    }, { once: true });

    const startRender = (options = {}) => {
      if (hoverFrameId) {
        window.cancelAnimationFrame(hoverFrameId);
        hoverFrameId = 0;
      }
      hoverPointer = null;

      const getDpr = () => window.devicePixelRatio || 1;
      const dpr = getDpr();
      const wordRect = finalWord.getBoundingClientRect();
      const width = wordRect.width;
      const height = wordRect.height;

      if (width === 0 || height === 0) return;

      const wordStyle = window.getComputedStyle(finalWord);
      const fontSize = wordStyle.fontSize || '16px';
      const fontSizePx = Number.parseFloat(fontSize) || height;
      const fontFamily = wordStyle.fontFamily || 'sans-serif';
      const fontWeight = wordStyle.fontWeight || '800';

      canvasDpr = Math.min(2, dpr);
      const padX = clamp(width * 0.58, 160, 440);
      const padTop = clamp(fontSizePx * 0.55, 72, 180);
      const padBottom = clamp(fontSizePx * 0.82, 96, 240);
      canvasWidth = Math.max(1, Math.round(width + (padX * 2)));
      canvasHeight = Math.max(1, Math.round(height + padTop + padBottom));
      canvas.width = Math.round(canvasWidth * canvasDpr);
      canvas.height = Math.round(canvasHeight * canvasDpr);
      canvas.style.width = `${canvasWidth}px`;
      canvas.style.height = `${canvasHeight}px`;
      canvas.style.left = `${Math.round(-padX)}px`;
      canvas.style.top = `${Math.round(-padTop)}px`;
      ctx.setTransform(canvasDpr, 0, 0, canvasDpr, 0, 0);

      const measurementCanvas = document.createElement('canvas');
      const measurementCtx = measurementCanvas.getContext('2d');
      if (!measurementCtx) return;
      measurementCtx.font = `${fontWeight} ${fontSize} ${fontFamily}`;
      const sourcePad = Math.max(8, fontSizePx * 0.12);

      const measureCharacterLayouts = () => {
        const textNode = Array.from(finalWord.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
        if (!textNode) return [];

        const range = document.createRange();
        const layouts = [];
        let offset = 0;

        for (const character of word) {
          const nextOffset = offset + character.length;
          range.setStart(textNode, offset);
          range.setEnd(textNode, nextOffset);
          const rect = range.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            layouts.push({
              character,
              left: rect.left - wordRect.left,
              width: rect.width
            });
          }
          offset = nextOffset;
        }

        range.detach();
        return layouts;
      };

      const characterLayouts = measureCharacterLayouts();
      if (!characterLayouts.length) return;

      const wordMetrics = measurementCtx.measureText(word);
      const ascent = wordMetrics.actualBoundingBoxAscent || fontSizePx * 0.78;
      const descent = wordMetrics.actualBoundingBoxDescent || fontSizePx * 0.22;
      const sourceWidth = Math.ceil(width + (sourcePad * 2));
      const sourceHeight = Math.ceil(ascent + descent + (sourcePad * 2));
      const offCanvas = document.createElement('canvas');
      const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
      if (!offCtx) return;

      offCanvas.width = Math.ceil(sourceWidth * canvasDpr);
      offCanvas.height = Math.ceil(sourceHeight * canvasDpr);
      offCtx.scale(canvasDpr, canvasDpr);
      offCtx.font = `${fontWeight} ${fontSize} ${fontFamily}`;
      offCtx.fillStyle = '#000';
      offCtx.textBaseline = 'alphabetic';

      const baselineY = sourcePad + ascent;
      for (const layout of characterLayouts) {
        offCtx.fillText(layout.character, sourcePad + layout.left, baselineY);
      }

      const imgData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height).data;
      let alphaMinX = offCanvas.width;
      let alphaMaxX = 0;
      let alphaMinY = offCanvas.height;
      let alphaMaxY = 0;

      for (let y = 0; y < offCanvas.height; y += 1) {
        for (let x = 0; x < offCanvas.width; x += 1) {
          const alpha = imgData[(y * offCanvas.width + x) * 4 + 3];
          if (alpha <= 128) continue;
          alphaMinX = Math.min(alphaMinX, x);
          alphaMaxX = Math.max(alphaMaxX, x);
          alphaMinY = Math.min(alphaMinY, y);
          alphaMaxY = Math.max(alphaMaxY, y);
        }
      }

      if (alphaMaxX <= alphaMinX || alphaMaxY <= alphaMinY) return;

      const targetOffsetX = padX;
      const targetOffsetY = padTop;
      const alphaMinXCss = alphaMinX / canvasDpr;
      const alphaMaxXCss = alphaMaxX / canvasDpr;
      const alphaMinYCss = alphaMinY / canvasDpr;
      const alphaMaxYCss = alphaMaxY / canvasDpr;
      const alphaHeightCss = Math.max(1, alphaMaxYCss - alphaMinYCss);
      const heroCenterX = canvasWidth / 2;
      const heroCenterY = canvasHeight / 2;
      const random = createSeededRandom(hashString(`${word}:${Math.round(width)}:${Math.round(height)}:${Math.round(fontSizePx)}`));
      const sampleSpacing = clamp(fontSizePx * 0.026, canvasWidth < 760 ? 3.25 : 2.75, canvasWidth < 760 ? 4.1 : 3.45);
      const baseDotSize = clamp(fontSizePx * 0.012, canvasWidth < 760 ? 0.86 : 1.05, canvasWidth < 760 ? 1.32 : 1.72);
      const sampledParticles = [];
      const readAlphaAt = (cssX, cssY) => {
        const pixelX = clamp(Math.round(cssX * canvasDpr), 0, offCanvas.width - 1);
        const pixelY = clamp(Math.round(cssY * canvasDpr), 0, offCanvas.height - 1);
        return imgData[(pixelY * offCanvas.width + pixelX) * 4 + 3];
      };

      for (let y = alphaMinYCss; y <= alphaMaxYCss; y += sampleSpacing) {
        const rowIndex = Math.round((y - alphaMinYCss) / sampleSpacing);
        const rowOffset = rowIndex % 2 === 0 ? 0 : sampleSpacing * 0.5;

        for (let x = alphaMinXCss + rowOffset; x <= alphaMaxXCss; x += sampleSpacing) {
          const jitterX = (random() - 0.5) * sampleSpacing * 0.72;
          const jitterY = (random() - 0.5) * sampleSpacing * 0.72;
          const sampleX = clamp(x + jitterX, alphaMinXCss, alphaMaxXCss);
          const sampleY = clamp(y + jitterY, alphaMinYCss, alphaMaxYCss);
          const alpha = readAlphaAt(sampleX, sampleY);

          if (alpha <= 72) continue;

          const targetX = targetOffsetX + sampleX - sourcePad;
          const targetY = targetOffsetY + ((sampleY - alphaMinYCss) / alphaHeightCss) * height;
          const edgeRoll = random();
          const originEdge = random();
          let originX = heroCenterX + ((random() - 0.5) * canvasWidth * 0.42);
          let originY = heroCenterY + ((random() - 0.5) * canvasHeight * 0.36);

          if (originEdge < 0.32) {
            originX = padX * (0.35 + random() * 0.58);
            originY = canvasHeight * (0.26 + random() * 0.48);
          } else if (originEdge < 0.64) {
            originX = canvasWidth - (padX * (0.35 + random() * 0.58));
            originY = canvasHeight * (0.26 + random() * 0.48);
          } else if (originEdge < 0.82) {
            originX = heroCenterX + ((random() - 0.5) * canvasWidth * 0.46);
            originY = canvasHeight * (0.15 + random() * 0.18);
          }

          sampledParticles.push({
            originX,
            originY,
            x: originX,
            y: originY,
            vx: (random() - 0.5) * 0.8,
            vy: (random() - 0.5) * 0.8,
            targetX,
            targetY,
            delay: (targetX / canvasWidth) * 470 + random() * 580,
            seed: random() * Math.PI * 2,
            charge: random() > 0.5 ? 1 : -1,
            field: 0.72 + random() * 0.68,
            order: random(),
            color: edgeRoll > 0.955 ? '#FF6700' : '#000000',
            size: baseDotSize * (0.82 + random() * 0.58)
          });
        }
      }

      sampledParticles.sort((a, b) => a.order - b.order);
      particles = sampledParticles.slice(0, maxParticlesForViewport());

      if (options.static || shouldSkipPageAnimation()) {
        title.classList.remove('is-particle-building');
        title.classList.add('is-particle-complete', 'is-static-wordmark');
        isComplete = true;
        drawStaticFrame();
        return;
      }

      window.pageAnimations?.markSeen?.();
      isComplete = false;
      animationStartTime = performance.now();
      title.classList.remove('is-particle-complete', 'is-static-wordmark');
      title.classList.add('is-particle-building');

      const draw = (time) => {
        const elapsed = time - animationStartTime;
        const progress = clamp(elapsed / DOUGHERTY_PARTICLE_SEQUENCE_MS, 0, 1);
        const captureProgress = easeInOutCubic(clamp((elapsed - 420) / (DOUGHERTY_PARTICLE_SEQUENCE_MS - 1600), 0, 1));
        const settleProgress = easeOutQuint(clamp((elapsed - (DOUGHERTY_PARTICLE_SEQUENCE_MS - 1850)) / 1550, 0, 1));

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const localProgress = clamp(
            (elapsed - p.delay) / (DOUGHERTY_PARTICLE_SEQUENCE_MS - 1450),
            0,
            1
          );
          const localCapture = easeInOutCubic(localProgress);
          const arrival = easeOutCubic(clamp((localProgress - 0.64) / 0.36, 0, 1));
          const dxToTarget = p.targetX - p.x;
          const dyToTarget = p.targetY - p.y;
          const distanceToTarget = Math.max(1, Math.hypot(dxToTarget, dyToTarget));
          const normalX = dxToTarget / distanceToTarget;
          const normalY = dyToTarget / distanceToTarget;
          const fieldTime = time * 0.001;
          const fieldFade = 1 - captureProgress;
          const curl = Math.sin((fieldTime * 1.45) + p.seed + (p.targetX * 0.004)) * p.charge * p.field;
          const pull = 0.007 + (localCapture * 0.037) + (settleProgress * 0.036);
          const swirl = fieldFade * (0.12 + (1 - localCapture) * 0.18) * p.field;
          const oscillationX = Math.sin((fieldTime * 1.05) + p.seed) * fieldFade * 0.08;
          const oscillationY = Math.cos((fieldTime * 0.95) + p.seed) * fieldFade * 0.08;

          p.vx += (dxToTarget * pull) + (-normalY * swirl * curl) + oscillationX;
          p.vy += (dyToTarget * pull) + (normalX * swirl * curl) + oscillationY;

          const damping = 0.875 - (settleProgress * 0.17) - (arrival * 0.045);
          p.vx *= damping;
          p.vy *= damping;
          p.x += p.vx;
          p.y += p.vy;

          if (settleProgress > 0.72) {
            const snap = (settleProgress - 0.72) / 0.28;
            p.x += (p.targetX - p.x) * snap * 0.24;
            p.y += (p.targetY - p.y) * snap * 0.24;
          }

          drawParticle(p);
        }

        if (progress >= 1) {
          completeWordmark();
          return;
        }

        animationFrameId = window.requestAnimationFrame(draw);
      };

      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
      animationFrameId = window.requestAnimationFrame(draw);
    };

    const scheduleRender = () => {
      if (resizeFrameId) return;
      resizeFrameId = window.requestAnimationFrame(() => {
        resizeFrameId = 0;
        startRender({ static: isComplete });
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
      blueprint.dispatchEvent(new CustomEvent('od:home-wordmark-force-complete', { bubbles: true }));
    };

    const reveal = () => {
      if (revealed) return;
      revealed = true;
      if (revealTimer !== null) {
        window.clearTimeout(revealTimer);
        revealTimer = null;
      }
      revealDeferredElements();
      blueprint.removeEventListener('od:home-wordmark-complete', reveal);
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
    blueprint.addEventListener('od:home-wordmark-complete', reveal, { once: true });

    // Deferred elements reveal when the particle animation completes
    revealTimer = window.setTimeout(reveal, DOUGHERTY_PARTICLE_SEQUENCE_MS + 1400);
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
