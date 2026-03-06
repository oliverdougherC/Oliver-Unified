#!/usr/bin/env node

const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_BASE_URL = 'http://127.0.0.1:4173';
const BASE_URL = process.env.GALLERY_CHECK_URL || DEFAULT_BASE_URL;
const REQUIRE_WEBGL = process.env.GALLERY_REQUIRE_WEBGL !== '0';
const WEBGL_ARGS = ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader'];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isLocalBaseUrl(url) {
  return url.startsWith('http://127.0.0.1:') || url.startsWith('http://localhost:');
}

function parsePortFromBaseUrl(url) {
  const match = url.match(/^http:\/\/[^:]+:(\d+)$/);
  return match ? Number(match[1]) : 4173;
}

async function waitForServer(url, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) return;
    } catch (_error) {
      // Retry until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for local server at ${url}`);
}

function startLocalServerIfNeeded() {
  if (!isLocalBaseUrl(BASE_URL) || process.env.GALLERY_CHECK_URL) {
    return null;
  }

  const port = parsePortFromBaseUrl(BASE_URL);
  const server = spawn('python3', ['-m', 'http.server', String(port)], {
    cwd: ROOT,
    stdio: 'ignore'
  });

  return server;
}

async function waitForRenderMode(page, timeoutMs = 3000) {
  try {
    await page.waitForFunction(
      () => {
        const mode = window.__galleryRenderMode;
        return mode && mode !== 'initializing';
      },
      null,
      { timeout: timeoutMs }
    );
  } catch (_) {
    // Fall through to read whatever mode is set.
  }
  return await page.evaluate(() => window.__galleryRenderMode || null);
}

async function waitForPanelState(page, selector, shouldBeOpen, timeoutMs = 2000) {
  try {
    await page.waitForFunction(
      ({ sel, open }) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return open ? !el.hasAttribute('hidden') : el.hasAttribute('hidden');
      },
      { sel: selector, open: shouldBeOpen },
      { timeout: timeoutMs }
    );
  } catch (_) {
    // Fall through — assertions will catch failures.
  }
}

async function assertGalleryToggleFlow(page, label) {
  await page.click('#galleryIndexToggle');
  await waitForPanelState(page, '#galleryIndex', true);

  let state = await page.evaluate(() => ({
    indexOpen: !document.getElementById('galleryIndex').hasAttribute('hidden'),
    indexAria: document.getElementById('galleryIndexToggle').getAttribute('aria-expanded')
  }));

  assert(state.indexOpen, `[${label}] index panel did not open`);
  assert(state.indexAria === 'true', `[${label}] index toggle aria-expanded should be true`);

  await page.click('#galleryInfoToggle');
  await waitForPanelState(page, '#galleryDetail', true);

  state = await page.evaluate(() => ({
    detailOpen: !document.getElementById('galleryDetail').hasAttribute('hidden'),
    detailAria: document.getElementById('galleryInfoToggle').getAttribute('aria-expanded')
  }));

  assert(state.detailOpen, `[${label}] detail panel did not open`);
  assert(state.detailAria === 'true', `[${label}] detail toggle aria-expanded should be true`);

  await page.keyboard.press('Escape');
  await waitForPanelState(page, '#galleryIndex', false);

  state = await page.evaluate(() => ({
    indexOpen: !document.getElementById('galleryIndex').hasAttribute('hidden'),
    detailOpen: !document.getElementById('galleryDetail').hasAttribute('hidden')
  }));

  assert(!state.indexOpen, `[${label}] index panel did not close on Escape`);
  assert(!state.detailOpen, `[${label}] detail panel did not close on Escape`);

  await page.keyboard.press('i');
  await waitForPanelState(page, '#galleryIndex', true);
  state = await page.evaluate(() => ({
    indexOpen: !document.getElementById('galleryIndex').hasAttribute('hidden')
  }));
  assert(state.indexOpen, `[${label}] index panel did not open with keyboard "i"`);

  await page.keyboard.press('d');
  await waitForPanelState(page, '#galleryDetail', true);
  state = await page.evaluate(() => ({
    detailOpen: !document.getElementById('galleryDetail').hasAttribute('hidden')
  }));
  assert(state.detailOpen, `[${label}] detail panel did not open with keyboard "d"`);
}

async function assertIndexScrollBehavior(page, label) {
  await page.click('#galleryIndexToggle');
  await waitForPanelState(page, '#galleryIndex', true);

  const state = await page.evaluate(() => {
    const panel = document.getElementById('galleryIndex');
    if (!panel) return null;

    const overflowAmount = panel.scrollHeight - panel.clientHeight;
    const canOverflow = overflowAmount > 2;
    panel.scrollTop = 0;
    panel.scrollTop = panel.scrollHeight;
    const afterWheelLike = panel.scrollTop;

    panel.focus?.();
    panel.dispatchEvent(new WheelEvent('wheel', { deltaY: 240, bubbles: true }));
    const afterWheelEvent = panel.scrollTop;

    const style = getComputedStyle(panel);
    const scrollbarPseudo = getComputedStyle(panel, '::-webkit-scrollbar');

    return {
      scrollTop: panel.scrollTop,
      moved: afterWheelLike > 8 || afterWheelEvent > 8,
      canOverflow,
      overflowY: style.overflowY,
      scrollbarWidth: style.scrollbarWidth || '',
      scrollbarDelta: panel.offsetWidth - panel.clientWidth,
      webkitScrollbarWidth: scrollbarPseudo.width || ''
    };
  });

  assert(state, `[${label}] index panel missing while testing scroll behavior`);
  assert(!state.canOverflow || state.moved, `[${label}] index panel did not scroll despite overflow content`);
  assert(
    state.overflowY === 'auto' || state.overflowY === 'scroll',
    `[${label}] index panel overflowY must allow scrolling`
  );
  assert(
    state.scrollbarDelta <= 2 || state.scrollbarWidth === 'none' || state.webkitScrollbarWidth === '0px',
    `[${label}] index scrollbar chrome is still visible`
  );
}

async function assertLayoutContinuity(page, label) {
  const result = await page.evaluate(() => {
    const app = window.__galleryApp;
    if (!app?.sceneController || window.__galleryRenderMode !== 'render') {
      return { skipped: true };
    }
    const layout = app.sceneController.getLayoutDebugState?.();
    if (!layout || !Array.isArray(layout.visibleRects)) {
      return { skipped: true };
    }

    const viewportWidth = window.innerWidth;
    const isMobile = window.matchMedia('(max-width: 980px), (pointer: coarse)').matches;
    const safeInset = viewportWidth * (isMobile ? 0.04 : 0.06);
    const visible = [...layout.visibleRects].sort((a, b) => a.leftPx - b.leftPx);

    let minGap = Infinity;
    let maxGap = -Infinity;
    let worstPair = null;
    for (let i = 1; i < visible.length; i += 1) {
      const prev = visible[i - 1];
      const curr = visible[i];
      const gap = curr.leftPx - prev.rightPx;
      if (gap < minGap) {
        minGap = gap;
        worstPair = [prev.index, curr.index];
      }
      maxGap = Math.max(maxGap, gap);
    }

    const activeRect = visible.find((rect) => rect.index === layout.activeIndex) || null;
    const clippingAmount = activeRect
      ? Math.max(0, safeInset - activeRect.leftPx, activeRect.rightPx - (viewportWidth - safeInset))
      : 0;

    return {
      skipped: false,
      viewportWidth,
      isMobile,
      activeCenterPx: layout.activeCenterPx,
      activeYawDeg: Number(layout.activeYawDeg ?? 0),
      scrollJerk: Number(layout.scrollJerk ?? 0),
      activeIndex: layout.activeIndex,
      visibleCount: visible.length,
      minGap,
      maxGap: Number.isFinite(maxGap) ? maxGap : 0,
      activeNeighborGapPx: layout.activeNeighborGapPx,
      clippingAmount,
      worstPair
    };
  });

  if (result.skipped) {
    if (REQUIRE_WEBGL) {
      throw new Error(`[${label}] layout continuity check skipped: render mode is not WebGL render`);
    }
    console.warn(`[${label}] layout continuity check skipped: render mode is not WebGL render`);
    return;
  }

  const centerTolerancePx = result.viewportWidth * 0.12;
  const centerDeltaPx = Math.abs(result.activeCenterPx - result.viewportWidth * 0.5);
  const maxNeighborGap = result.isMobile ? 260 : 420;
  const activeYawMag = Math.abs(result.activeYawDeg);

  assert(
    centerDeltaPx <= centerTolerancePx,
    `[${label}] active card drifted off center lane by ${centerDeltaPx.toFixed(2)}px (tolerance ${centerTolerancePx.toFixed(2)}px)`
  );
  assert(
    result.clippingAmount <= 0.5,
    `[${label}] active card clips viewport safe inset by ${result.clippingAmount.toFixed(2)}px`
  );
  assert(
    result.minGap >= 6,
    `[${label}] visible photos overlap (min gap ${result.minGap.toFixed(2)}px) between ${result.worstPair?.join(' and ')}`
  );
  if (Number.isFinite(result.activeNeighborGapPx)) {
    assert(
      result.activeNeighborGapPx <= maxNeighborGap,
      `[${label}] active card is isolated by an excessive neighbor gap (${result.activeNeighborGapPx.toFixed(2)}px > ${maxNeighborGap}px)`
    );
  }
  assert(
    activeYawMag >= 38 && activeYawMag <= 46,
    `[${label}] active oblique yaw drifted out of range (${result.activeYawDeg.toFixed(2)}deg)`
  );
}

async function assertScrollPaceEnvelope(page, label) {
  const before = await page.evaluate(() => {
    const app = window.__galleryApp;
    if (!app?.sceneController || window.__galleryRenderMode !== 'render') {
      return { skipped: true };
    }
    return {
      skipped: false,
      progress: app.sceneController.progress ?? 0,
      targetProgress: app.sceneController.targetProgress ?? 0,
      activeIndex: app.sceneController.activeIndex ?? 0
    };
  });

  if (before.skipped) {
    if (REQUIRE_WEBGL) {
      throw new Error(`[${label}] scroll-pace check skipped: render mode is not WebGL render`);
    }
    console.warn(`[${label}] scroll-pace check skipped: render mode is not WebGL render`);
    return;
  }

  for (let i = 0; i < 4; i += 1) {
    await page.mouse.wheel(0, 320);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(620);

  const after = await page.evaluate(() => {
    const app = window.__galleryApp;
    return {
      progress: app?.sceneController?.progress ?? 0,
      targetProgress: app?.sceneController?.targetProgress ?? 0,
      activeIndex: app?.sceneController?.activeIndex ?? 0
    };
  });

  const targetDelta = after.targetProgress - before.targetProgress;
  const activeDelta = after.activeIndex - before.activeIndex;
  assert(targetDelta >= 0.18, `[${label}] scroll pace is now too slow/unresponsive (target delta ${targetDelta.toFixed(3)})`);
  assert(targetDelta <= 0.32, `[${label}] scroll pace is still too fast (target delta ${targetDelta.toFixed(3)})`);
  assert(activeDelta <= 1, `[${label}] wheel burst advanced too many items (${activeDelta})`);

  const maxJerk = await page.evaluate(async () => {
    const app = window.__galleryApp;
    if (!app?.sceneController) return Infinity;
    let peak = 0;
    for (let i = 0; i < 28; i += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const jerk = Math.abs(app.sceneController.getLayoutDebugState?.().scrollJerk ?? 0);
      if (jerk > peak) peak = jerk;
    }
    return peak;
  });
  assert(maxJerk <= 0.03, `[${label}] inertial jerk is too high (${maxJerk.toFixed(4)})`);
}

async function assertColorFidelitySanity(page, label) {
  const result = await page.evaluate(() => {
    const app = window.__galleryApp;
    if (!app?.sceneController || window.__galleryRenderMode !== 'render') {
      return { skipped: true };
    }

    const activeIndex = app.sceneController.activeIndex ?? 0;
    const item = app.sceneController.items?.[activeIndex];
    if (!item?.uniforms) {
      return { skipped: true };
    }

    const avgDiff = (color) => {
      const mean = (color.r + color.g + color.b) / 3;
      return Math.max(Math.abs(color.r - mean), Math.abs(color.g - mean), Math.abs(color.b - mean));
    };

    const activeUniforms = item.uniforms;
    const lights = Array.isArray(app.sceneController.lights) ? app.sceneController.lights : [];
    const lightBias = lights.reduce((max, light) => {
      if (!light?.color) return max;
      return Math.max(max, avgDiff(light.color));
    }, 0);

    const glassBias = Math.max(
      avgDiff(item.glassBodyMaterial?.color || { r: 1, g: 1, b: 1 }),
      avgDiff(item.backPaneMaterial?.color || { r: 1, g: 1, b: 1 })
    );

    return {
      skipped: false,
      materialMix: Number(activeUniforms.u_materialMix?.value ?? 1),
      exposure: Number(activeUniforms.u_exposure?.value ?? 1),
      chromatic: Number(activeUniforms.u_chromaticStrength?.value ?? 1),
      lightBias,
      glassBias
    };
  });

  if (result.skipped) {
    if (REQUIRE_WEBGL) {
      throw new Error(`[${label}] color-fidelity check skipped: missing render/image context`);
    }
    console.warn(`[${label}] color-fidelity check skipped: missing render/image context`);
    return;
  }

  assert(result.materialMix <= 0.03, `[${label}] material mix is too strong (${result.materialMix.toFixed(3)})`);
  assert(result.exposure >= 0.98 && result.exposure <= 1.02, `[${label}] exposure drifted outside neutral band (${result.exposure.toFixed(3)})`);
  assert(result.chromatic <= 0.00003, `[${label}] chromatic strength is too high (${result.chromatic.toFixed(6)})`);
  assert(result.lightBias <= 0.045, `[${label}] light rig color bias is too strong (${result.lightBias.toFixed(3)})`);
  assert(result.glassBias <= 0.03, `[${label}] glass material tint bias is too strong (${result.glassBias.toFixed(3)})`);
}

async function runGalleryBaselineTest(browser) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/pages/gallery/index.html`, { waitUntil: 'domcontentloaded' });

  const renderMode = await waitForRenderMode(page);
  const state = await page.evaluate(() => ({
    hasApp: !!window.__galleryApp,
    hasUiController: !!window.__galleryApp?.uiController,
    entriesCount: window.__galleryApp?.entries?.length ?? 0
  }));

  assert(state.hasApp, '[baseline] window.__galleryApp missing');
  assert(state.hasUiController, '[baseline] UIController missing');
  assert(state.entriesCount > 0, '[baseline] gallery entries missing');
  if (REQUIRE_WEBGL) {
    assert(renderMode === 'render', `[baseline] expected WebGL render mode, got ${renderMode}`);
  } else {
    assert(renderMode === 'render' || renderMode === 'fallback', `[baseline] unexpected render mode: ${renderMode}`);
  }

  await assertGalleryToggleFlow(page, 'baseline');
  await assertIndexScrollBehavior(page, 'baseline');
  await assertLayoutContinuity(page, 'baseline');
  await assertScrollPaceEnvelope(page, 'baseline');
  await assertColorFidelitySanity(page, 'baseline');
  await context.close();
}

async function runGalleryFocusInteractionTest(browser) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/pages/gallery/index.html`, { waitUntil: 'domcontentloaded' });

  const renderMode = await waitForRenderMode(page, 4000);
  if (renderMode !== 'render') {
    if (REQUIRE_WEBGL) {
      await context.close();
      throw new Error('[focus-flow] render mode is not WebGL render while WebGL is required');
    }
    console.warn('[focus-flow] skipped: render mode is not WebGL render');
    await context.close();
    return;
  }

  await page.waitForTimeout(1100);

  const getClickPoint = async (index) => {
    return page.evaluate((targetIndex) => {
      const app = window.__galleryApp;
      const item = app?.sceneController?.items?.[targetIndex];
      const camera = app?.webgl?.camera;
      if (!item || !camera) return null;

      const projected = item.mesh.position.clone().project(camera);
      const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;

      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      if (x < 8 || y < 8 || x > window.innerWidth - 8 || y > window.innerHeight - 8) return null;
      return { x, y };
    }, index);
  };

  const activeStart = await page.evaluate(() => window.__galleryApp?.sceneController?.activeIndex ?? 0);
  const activePoint = await getClickPoint(activeStart);
  assert(activePoint, '[focus-flow] could not resolve click point for active item');
  await page.mouse.click(activePoint.x, activePoint.y);

  await page.waitForFunction(() => {
    const app = window.__galleryApp;
    return app?.uiController?.isFocusMode && app?.sceneController?.isFocused?.();
  }, null, { timeout: 4000 });

  let state = await page.evaluate(() => ({
    overlayActive: document.getElementById('galleryFocusOverlay')?.classList.contains('is-active') ?? false,
    focusMode: window.__galleryApp?.uiController?.isFocusMode ?? false
  }));
  assert(state.overlayActive, '[focus-flow] overlay did not activate after clicking active item');
  assert(state.focusMode, '[focus-flow] focus mode did not activate after clicking active item');

  const depthState = await page.evaluate(() => {
    const shell = document.getElementById('galleryShell');
    const canvas = document.getElementById('galleryWebglCanvas');
    const ui = document.querySelector('.gallery-ui');
    const detail = document.getElementById('galleryDetail');

    return {
      shellFocus: shell?.dataset.focusState || '',
      shellUiDepth: shell?.dataset.uiDepth || '',
      canvasZ: Number(getComputedStyle(canvas).zIndex || 0),
      uiZ: Number(getComputedStyle(ui).zIndex || 0),
      detailZ: Number(getComputedStyle(detail).zIndex || 0)
    };
  });

  assert(depthState.shellFocus === 'active', '[focus-flow] shell focus state was not set to active');
  assert(depthState.shellUiDepth === 'pushed', '[focus-flow] shell ui depth was not set to pushed');
  assert(depthState.canvasZ > depthState.uiZ, '[focus-flow] focused canvas is not above top UI layer');
  assert(depthState.canvasZ > depthState.detailZ, '[focus-flow] focused canvas is not above detail/index layer');

  await page.waitForFunction(() => {
    const app = window.__galleryApp;
    const focus = app?.sceneController?.getLayoutDebugState?.()?.focus;
    const blend = app?.sceneController?.focusBlend ?? 0;
    return Boolean(focus?.enabled) && blend >= 0.95;
  }, null, { timeout: 2500 }).catch(() => {});

  const focusLayout = await page.evaluate(() => {
    const app = window.__galleryApp;
    const debug = app?.sceneController?.getLayoutDebugState?.();
    const focus = debug?.focus;
    return {
      enabled: Boolean(focus?.enabled),
      isMobile: window.matchMedia('(max-width: 980px), (pointer: coarse)').matches,
      focusYawDeg: Number(debug?.focusYawDeg ?? 999),
      safeTopBreached: Boolean(focus?.safeTopBreached),
      safeBottomBreached: Boolean(focus?.safeBottomBreached),
      nearestGapPx: Number(focus?.nearestGapPx ?? Infinity),
      nearestOpacity: Number(focus?.nearestOpacity ?? 0),
      nearestFocusNeighborGapPx: Number(debug?.nearestFocusNeighborGapPx ?? Infinity)
    };
  });

  assert(focusLayout.enabled, '[focus-flow] focus debug state did not report enabled layout');
  assert(Math.abs(focusLayout.focusYawDeg) <= 3, `[focus-flow] focused card did not flatten to head-on (${focusLayout.focusYawDeg.toFixed(2)}deg)`);
  assert(!focusLayout.safeTopBreached, '[focus-flow] focused card breached top safe zone under nav');
  assert(!focusLayout.safeBottomBreached, '[focus-flow] focused card breached bottom safe zone near caption');
  assert(
    focusLayout.nearestGapPx >= (focusLayout.isMobile ? 28 : 42),
    `[focus-flow] focused spacing is still cluttered (nearest gap ${focusLayout.nearestGapPx.toFixed(2)}px)`
  );
  assert(
    focusLayout.nearestOpacity <= 0.2,
    `[focus-flow] side cards remain too prominent in focus mode (opacity ${focusLayout.nearestOpacity.toFixed(2)})`
  );

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !(window.__galleryApp?.uiController?.isFocusMode ?? false), null, { timeout: 4000 });

  await page.evaluate(() => {
    const app = window.__galleryApp;
    if (!app?.sceneController) return;
    app.pendingFocusIndex = -1;
    app.sceneController.enterFocus(app.sceneController.activeIndex);
    app.uiController?.setFocusMode(true);
    app.syncDepthState?.();
  });
  await page.waitForFunction(() => window.__galleryApp?.uiController?.isFocusMode, null, { timeout: 4000 });
  await page.mouse.wheel(0, 900);
  await page.waitForFunction(() => !(window.__galleryApp?.uiController?.isFocusMode ?? false), null, { timeout: 4000 });

  const flankTarget = await page.evaluate(() => {
    const app = window.__galleryApp;
    const active = app?.sceneController?.activeIndex ?? 0;
    const total = app?.sceneController?.items?.length ?? 0;
    if (total <= 1) return 0;
    return active < total - 1 ? active + 1 : active - 1;
  });

  const flankPoint = await getClickPoint(flankTarget);
  if (!flankPoint) {
    console.warn('[focus-flow] flank click scenario skipped: no clickable flank item center in viewport');
    await context.close();
    return;
  }
  await page.mouse.click(flankPoint.x, flankPoint.y);

  await page.waitForFunction((target) => {
    const app = window.__galleryApp;
    return app?.sceneController?.activeIndex === target && app?.uiController?.isFocusMode;
  }, flankTarget, { timeout: 6000 });

  state = await page.evaluate((target) => ({
    active: window.__galleryApp?.sceneController?.activeIndex ?? -1,
    focusMode: window.__galleryApp?.uiController?.isFocusMode ?? false,
    target
  }), flankTarget);

  assert(state.active === flankTarget, '[focus-flow] flank click did not navigate to target item');
  assert(state.focusMode, '[focus-flow] flank click did not enter focus after navigation');

  await context.close();
}

async function runGalleryForcedFallbackTest(browser) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await context.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContextPatched(type, ...args) {
      const contextType = String(type || '').toLowerCase();
      if (contextType === 'webgl' || contextType === 'webgl2' || contextType === 'experimental-webgl') {
        return null;
      }
      return originalGetContext.call(this, type, ...args);
    };
  });

  const page = await context.newPage();
  await page.goto(`${BASE_URL}/pages/gallery/index.html`, { waitUntil: 'domcontentloaded' });

  await waitForRenderMode(page);

  const state = await page.evaluate(() => ({
    renderMode: window.__galleryRenderMode || null,
    hasUiController: !!window.__galleryApp?.uiController,
    caption: document.getElementById('galleryCaption')?.textContent ?? ''
  }));

  assert(state.renderMode === 'fallback', `[forced-fallback] expected render mode fallback, got ${state.renderMode}`);
  assert(state.hasUiController, '[forced-fallback] UIController missing');
  assert(state.caption.includes('Compatibility mode'), '[forced-fallback] compatibility caption was not shown');

  await assertGalleryToggleFlow(page, 'forced-fallback');
  await context.close();
}

async function runSharedNavSanity(browser) {
  const navPages = [
    `${BASE_URL}/index.html`,
    `${BASE_URL}/pages/resume/index.html`,
    `${BASE_URL}/pages/archive/index.html`,
    `${BASE_URL}/pages/dashboard/index.html`
  ];

  for (const url of navPages) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(() => !!document.getElementById('navToggle'), null, { timeout: 3000 }).catch(() => {});

    await page.click('#navToggle');
    await page.waitForFunction(
      () => document.getElementById('navOverlay')?.classList.contains('active'),
      null,
      { timeout: 2000 }
    ).catch(() => {});

    let state = await page.evaluate(() => ({
      active: document.getElementById('navOverlay').classList.contains('active'),
      ariaExpanded: document.getElementById('navToggle').getAttribute('aria-expanded')
    }));

    assert(state.active, `[shared-nav] overlay did not open for ${url}`);
    assert(state.ariaExpanded === 'true', `[shared-nav] aria-expanded should be true for ${url}`);

    await page.click('#navToggle');
    await page.waitForFunction(
      () => !document.getElementById('navOverlay')?.classList.contains('active'),
      null,
      { timeout: 2000 }
    ).catch(() => {});

    state = await page.evaluate(() => ({
      active: document.getElementById('navOverlay').classList.contains('active'),
      ariaExpanded: document.getElementById('navToggle').getAttribute('aria-expanded')
    }));

    assert(!state.active, `[shared-nav] overlay did not close for ${url}`);
    assert(state.ariaExpanded === 'false', `[shared-nav] aria-expanded should be false for ${url}`);

    await context.close();
  }
}

async function main() {
  const serverProcess = startLocalServerIfNeeded();
  try {
    await waitForServer(`${BASE_URL}/pages/gallery/index.html`);

    const browser = await chromium.launch({ headless: true, args: WEBGL_ARGS });
    try {
      await runGalleryBaselineTest(browser);
      await runGalleryFocusInteractionTest(browser);
      await runGalleryForcedFallbackTest(browser);
      await runSharedNavSanity(browser);
    } finally {
      await browser.close();
    }

    console.log('Gallery dropdown checks passed.');
  } finally {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  }
}

main().catch((error) => {
  console.error('Gallery dropdown checks failed:', error.stack || error.message);
  process.exit(1);
});
