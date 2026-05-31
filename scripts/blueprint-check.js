#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { chromium, firefox, webkit } = require('playwright');
const {
  startLocalStaticServer,
  waitForServer
} = require('./lib/playwright-static');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'output', 'playwright', 'blueprint-check');
const DEFAULT_BASE_URL = 'http://127.0.0.1:4173';
let baseUrl = process.env.BLUEPRINT_CHECK_URL || DEFAULT_BASE_URL;

const ALL_BROWSERS = [
  { name: 'chromium', launcher: chromium },
  { name: 'firefox', launcher: firefox },
  { name: 'webkit', launcher: webkit }
];
const REQUESTED_BROWSER_NAMES = (process.env.BLUEPRINT_CHECK_BROWSERS || '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);
const BROWSERS = REQUESTED_BROWSER_NAMES.length
  ? ALL_BROWSERS.filter((browser) => REQUESTED_BROWSER_NAMES.includes(browser.name))
  : ALL_BROWSERS;

const FRAMES = [
  { label: 'build', delayMs: 2800 },
  { label: 'pre-complete', delayMs: 6200 },
  { label: 'complete', delayMs: 8400 }
];

const VIEWPORTS = [
  { label: '1x', width: 1600, height: 1100, deviceScaleFactor: 1 },
  { label: '2x', width: 1600, height: 1100, deviceScaleFactor: 2 }
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function prepareContext(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor
  });

  await context.addInitScript(() => {
    window.__odActiveAnimationFrames = new Set();
    const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window);

    window.requestAnimationFrame = (callback) => {
      const id = nativeRequestAnimationFrame((timestamp) => {
        window.__odActiveAnimationFrames.delete(id);
        callback(timestamp);
      });
      window.__odActiveAnimationFrames.add(id);
      return id;
    };

    window.cancelAnimationFrame = (id) => {
      window.__odActiveAnimationFrames.delete(id);
      return nativeCancelAnimationFrame(id);
    };

    try {
      if (window.sessionStorage.getItem('od-blueprint-storage-prepared') !== 'true') {
        window.sessionStorage.removeItem('od-page-animations-seen');
        window.sessionStorage.setItem('od-blueprint-storage-prepared', 'true');
      }
    } catch (_error) {
      // Ignore storage access issues in automation contexts.
    }
    try {
      if (window.localStorage.getItem('od-blueprint-storage-prepared') !== 'true') {
        window.localStorage.removeItem('od-color-mode');
        window.localStorage.setItem('od-blueprint-storage-prepared', 'true');
      }
    } catch (_error) {
      // Ignore storage access issues in automation contexts.
    }
  });

  return context;
}

async function waitForBlueprintReady(page) {
  await page.waitForFunction(() => {
    const title = document.querySelector('.blueprint-title');
    const canvas = title?.querySelector('.particle-canvas');
    return title && canvas && canvas.width > 0 && canvas.height > 0;
  }, { timeout: 15000 });
}

async function clearAnimationMemory(page) {
  if (page.url() === 'about:blank') return;

  await page.evaluate(() => {
    try {
      window.sessionStorage.removeItem('od-page-animations-seen');
    } catch (_error) {
      // Ignore storage access issues in automation contexts.
    }
  });
}

async function pauseAnimations(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.blueprint-final-word').forEach((element) => {
      element.getAnimations().forEach((animation) => {
        animation.pause();
      });
    });
  });
}

async function captureFrame(page, browserName, viewportLabel, frame) {
  await clearAnimationMemory(page);
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await waitForBlueprintReady(page);
  await page.waitForTimeout(frame.delayMs);
  await pauseAnimations(page);
  await page.waitForTimeout(120);

  const filename = `${browserName}-${viewportLabel}-${frame.label}.png`;
  await page.screenshot({
    path: path.join(OUTPUT_DIR, filename),
    fullPage: false
  });

  return filename;
}

async function assertBlueprintStructure(page, browserName) {
  const state = await page.evaluate(() => {
    const title = document.querySelector('.blueprint-title');
    const finalWord = title?.querySelector('.blueprint-final-word');
    const canvas = title?.querySelector('.particle-canvas');
    const oliver = document.querySelector('.hero-name-line');
    const finalWordStyle = finalWord ? window.getComputedStyle(finalWord) : null;
    const canvasStyle = canvas ? window.getComputedStyle(canvas) : null;
    const canvasRect = canvas?.getBoundingClientRect();
    const oliverRect = oliver?.getBoundingClientRect();
    const wordRect = finalWord?.getBoundingClientRect();
    let activeCanvasPixels = 0;
    let activeOliverOverlapPixels = 0;
    let activeMinX = canvas?.width || 0;
    let activeMaxX = 0;
    let activeMinY = canvas?.height || 0;
    let activeMaxY = 0;

    if (canvas instanceof HTMLCanvasElement) {
      const context = canvas.getContext('2d');
      const imageData = context?.getImageData(0, 0, canvas.width, canvas.height).data;
      if (imageData) {
        for (let y = 0; y < canvas.height; y += 1) {
          for (let x = 0; x < canvas.width; x += 1) {
            const alpha = imageData[(y * canvas.width + x) * 4 + 3];
            if (alpha <= 0) continue;

            activeCanvasPixels += 1;
            activeMinX = Math.min(activeMinX, x);
            activeMaxX = Math.max(activeMaxX, x);
            activeMinY = Math.min(activeMinY, y);
            activeMaxY = Math.max(activeMaxY, y);
            if (canvasRect && oliverRect) {
              const pageX = canvasRect.left + (x / canvas.width) * canvasRect.width;
              const pageY = canvasRect.top + (y / canvas.height) * canvasRect.height;
              if (
                pageX >= oliverRect.left
                && pageX <= oliverRect.right
                && pageY >= oliverRect.top
                && pageY <= oliverRect.bottom
              ) {
                activeOliverOverlapPixels += 1;
              }
            }
          }
        }
      }
    }

    const widthRatio = canvasRect && wordRect ? canvasRect.width / wordRect.width : 0;
    const heightRatio = canvasRect && wordRect ? canvasRect.height / wordRect.height : 0;
    const activeWidth = activeCanvasPixels > 0 ? activeMaxX - activeMinX + 1 : 0;
    const activeHeight = activeCanvasPixels > 0 ? activeMaxY - activeMinY + 1 : 0;
    const activeCssWidth = canvasRect && canvas ? activeWidth * (canvasRect.width / canvas.width) : 0;
    const activeCssHeight = canvasRect && canvas ? activeHeight * (canvasRect.height / canvas.height) : 0;
    const activeWidthRatio = wordRect ? activeCssWidth / wordRect.width : 0;
    const activeHeightRatio = wordRect ? activeCssHeight / wordRect.height : 0;

    return {
      complete: title?.classList.contains('is-static-wordmark') === true,
      finalWordOpacity: finalWordStyle?.opacity,
      canvasOpacity: canvasStyle?.opacity,
      canvasWidth: canvas?.width || 0,
      canvasHeight: canvas?.height || 0,
      activeCanvasPixels,
      activeOliverOverlapPixels,
      widthRatio,
      heightRatio,
      activeWidthRatio,
      activeHeightRatio,
      activeAnimationFrames: window.__odActiveAnimationFrames?.size ?? 0
    };
  });

  assert(state.complete, `[${browserName}] particle wordmark should reach its static complete state`);
  assert(Number(state.finalWordOpacity) === 0, `[${browserName}] final orange word should stay hidden`);
  assert(Number(state.canvasOpacity) === 1, `[${browserName}] completed particle canvas should be visible`);
  assert(state.canvasWidth > 0 && state.canvasHeight > 0, `[${browserName}] particle canvas should be sized`);
  assert(state.activeCanvasPixels > 2400, `[${browserName}] expected dense active particle pixels in completed canvas`);
  assert(state.activeOliverOverlapPixels === 0, `[${browserName}] completed particle canvas should not draw over OLIVER`);
  assert(state.widthRatio > 1.8 && state.widthRatio < 2.35, `[${browserName}] particle canvas width should provide a loose stage`);
  assert(state.heightRatio > 2 && state.heightRatio < 4.8, `[${browserName}] particle canvas height should provide a loose stage`);
  assert(state.activeWidthRatio > 0.82 && state.activeWidthRatio < 1.08, `[${browserName}] final particle bounds should align to DOUGHERTY width`);
  assert(state.activeHeightRatio > 0.58 && state.activeHeightRatio < 1.16, `[${browserName}] final particle bounds should align to DOUGHERTY height`);
  assert(state.activeAnimationFrames === 0, `[${browserName}] particle animation should not leave rAF work queued`);
}

async function assertLateSettlePointerInteraction(page, browserName) {
  await clearAnimationMemory(page);
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await waitForBlueprintReady(page);
  await page.mouse.move(10, 10);
  await page.waitForTimeout(6250);

  const before = await page.evaluate(() => {
    const title = document.querySelector('.blueprint-title');
    const canvas = title?.querySelector('.particle-canvas');
    const canvasRect = canvas?.getBoundingClientRect();

    if (!(title instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement) || !canvasRect) {
      return null;
    }

    const context = canvas.getContext('2d');
    const imageData = context?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!imageData) return null;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    let sampleX = 0;
    let sampleY = 0;
    let sampleDistance = Number.POSITIVE_INFINITY;

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const alpha = imageData[(y * canvas.width + x) * 4 + 3];
        if (alpha <= 0) continue;
        const distance = Math.hypot(x - centerX, y - centerY);
        if (distance < sampleDistance) {
          sampleDistance = distance;
          sampleX = x;
          sampleY = y;
        }
      }
    }

    if (!Number.isFinite(sampleDistance)) return null;

    const cssPixelScale = canvas.width / canvasRect.width;
    const radiusCss = Math.max(26, Math.min(54, canvasRect.width * 0.035));
    const radiusPx = Math.round(radiusCss * cssPixelScale * 0.62);
    let localActivePixels = 0;
    const minX = Math.max(0, sampleX - radiusPx);
    const maxX = Math.min(canvas.width - 1, sampleX + radiusPx);
    const minY = Math.max(0, sampleY - radiusPx);
    const maxY = Math.min(canvas.height - 1, sampleY + radiusPx);
    const radiusSquared = radiusPx * radiusPx;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = x - sampleX;
        const dy = y - sampleY;
        if ((dx * dx) + (dy * dy) > radiusSquared) continue;
        if (imageData[(y * canvas.width + x) * 4 + 3] > 0) {
          localActivePixels += 1;
        }
      }
    }

    return {
      building: title.classList.contains('is-particle-building'),
      complete: title.classList.contains('is-static-wordmark'),
      pointerClientX: canvasRect.left + ((sampleX / canvas.width) * canvasRect.width),
      pointerClientY: canvasRect.top + ((sampleY / canvas.height) * canvasRect.height),
      sampleX,
      sampleY,
      radiusPx,
      localActivePixels
    };
  });

  assert(before, `[${browserName}] late-settle particle sample should be readable`);
  assert(before.building, `[${browserName}] late-settle pointer check should run before particle completion`);
  assert(!before.complete, `[${browserName}] late-settle pointer check should not use the completed hover loop`);

  await page.mouse.move(before.pointerClientX, before.pointerClientY);
  await page.waitForTimeout(240);

  const after = await page.evaluate(({ sampleX, sampleY, radiusPx }) => {
    const title = document.querySelector('.blueprint-title');
    const canvas = title?.querySelector('.particle-canvas');
    if (!(title instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) {
      return null;
    }

    const context = canvas.getContext('2d');
    const imageData = context?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!imageData) return null;

    let localActivePixels = 0;
    const minX = Math.max(0, sampleX - radiusPx);
    const maxX = Math.min(canvas.width - 1, sampleX + radiusPx);
    const minY = Math.max(0, sampleY - radiusPx);
    const maxY = Math.min(canvas.height - 1, sampleY + radiusPx);
    const radiusSquared = radiusPx * radiusPx;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = x - sampleX;
        const dy = y - sampleY;
        if ((dx * dx) + (dy * dy) > radiusSquared) continue;
        if (imageData[(y * canvas.width + x) * 4 + 3] > 0) {
          localActivePixels += 1;
        }
      }
    }

    return {
      building: title.classList.contains('is-particle-building'),
      complete: title.classList.contains('is-static-wordmark'),
      localActivePixels
    };
  }, {
    sampleX: before.sampleX,
    sampleY: before.sampleY,
    radiusPx: before.radiusPx
  });

  assert(after, `[${browserName}] late-settle particle response should be readable`);
  assert(after.building, `[${browserName}] cursor effect should activate before particle completion`);
  assert(!after.complete, `[${browserName}] cursor effect should not depend on the completed wordmark class`);
  assert(
    after.localActivePixels < before.localActivePixels * 0.88,
    `[${browserName}] cursor effect should repel late-settle particles before completion`
  );
}

async function assertPointerTracksScroll(page, browserName) {
  await clearAnimationMemory(page);
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await waitForBlueprintReady(page);
  await page.evaluate(() => {
    document
      .querySelector('.blueprint-title')
      ?.dispatchEvent(new CustomEvent('od:home-wordmark-force-complete', { bubbles: true }));
  });
  await page.waitForTimeout(180);

  const sample = await page.evaluate(() => {
    const title = document.querySelector('.blueprint-title');
    const canvas = title?.querySelector('.particle-canvas');
    const canvasRect = canvas?.getBoundingClientRect();

    if (!(title instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement) || !canvasRect) {
      return null;
    }

    const context = canvas.getContext('2d');
    const imageData = context?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!imageData) return null;

    const countActivePixels = (centerX, centerY, radiusPx) => {
      let count = 0;
      const minX = Math.max(0, centerX - radiusPx);
      const maxX = Math.min(canvas.width - 1, centerX + radiusPx);
      const minY = Math.max(0, centerY - radiusPx);
      const maxY = Math.min(canvas.height - 1, centerY + radiusPx);
      const radiusSquared = radiusPx * radiusPx;

      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const dx = x - centerX;
          const dy = y - centerY;
          if ((dx * dx) + (dy * dy) > radiusSquared) continue;
          if (imageData[(y * canvas.width + x) * 4 + 3] > 0) {
            count += 1;
          }
        }
      }

      return count;
    };

    const cssPixelScaleX = canvas.width / canvasRect.width;
    const cssPixelScaleY = canvas.height / canvasRect.height;
    const scrollDeltaCss = 32;
    const scrollDeltaPx = Math.round(scrollDeltaCss * cssPixelScaleY);
    const radiusCss = Math.max(26, Math.min(54, canvasRect.width * 0.035));
    const radiusPx = Math.round(radiusCss * cssPixelScaleX * 0.62);
    let best = null;

    for (let y = radiusPx; y < canvas.height - radiusPx - scrollDeltaPx; y += 4) {
      for (let x = radiusPx; x < canvas.width - radiusPx; x += 4) {
        if (imageData[(y * canvas.width + x) * 4 + 3] <= 0) continue;

        const oldLocalActivePixels = countActivePixels(x, y, radiusPx);
        const newLocalActivePixels = countActivePixels(x, y + scrollDeltaPx, radiusPx);
        const score = Math.min(oldLocalActivePixels, newLocalActivePixels);
        if (score < 18 || (best && score <= best.score)) continue;

        best = {
          score,
          sampleX: x,
          sampleY: y,
          radiusPx,
          scrollDeltaCss,
          oldLocalActivePixels,
          newLocalActivePixels,
          pointerClientX: canvasRect.left + (x / cssPixelScaleX),
          pointerClientY: canvasRect.top + (y / cssPixelScaleY)
        };
      }
    }

    return best;
  });

  assert(sample, `[${browserName}] scroll pointer sample should be readable`);

  await page.mouse.move(sample.pointerClientX, sample.pointerClientY);
  await page.waitForTimeout(260);

  const beforeScroll = await page.evaluate(({ sampleX, sampleY, radiusPx }) => {
    const canvas = document.querySelector('.particle-canvas');
    if (!(canvas instanceof HTMLCanvasElement)) return null;
    const context = canvas.getContext('2d');
    const imageData = context?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!imageData) return null;

    let localActivePixels = 0;
    const minX = Math.max(0, sampleX - radiusPx);
    const maxX = Math.min(canvas.width - 1, sampleX + radiusPx);
    const minY = Math.max(0, sampleY - radiusPx);
    const maxY = Math.min(canvas.height - 1, sampleY + radiusPx);
    const radiusSquared = radiusPx * radiusPx;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = x - sampleX;
        const dy = y - sampleY;
        if ((dx * dx) + (dy * dy) > radiusSquared) continue;
        if (imageData[(y * canvas.width + x) * 4 + 3] > 0) {
          localActivePixels += 1;
        }
      }
    }

    return { localActivePixels };
  }, {
    sampleX: sample.sampleX,
    sampleY: sample.sampleY,
    radiusPx: sample.radiusPx
  });

  assert(beforeScroll, `[${browserName}] pre-scroll particle response should be readable`);
  assert(
    beforeScroll.localActivePixels < sample.oldLocalActivePixels * 0.92,
    `[${browserName}] cursor effect should activate before scrolling`
  );

  await page.evaluate((scrollDeltaCss) => window.scrollBy(0, scrollDeltaCss), sample.scrollDeltaCss);
  await page.waitForTimeout(280);

  const afterScroll = await page.evaluate(({ sampleX, sampleY, radiusPx, scrollDeltaCss }) => {
    const canvas = document.querySelector('.particle-canvas');
    const canvasRect = canvas?.getBoundingClientRect();
    if (!(canvas instanceof HTMLCanvasElement) || !canvasRect) return null;
    const context = canvas.getContext('2d');
    const imageData = context?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!imageData) return null;

    const scrollDeltaPx = Math.round(scrollDeltaCss * (canvas.height / canvasRect.height));
    const projectedY = sampleY + scrollDeltaPx;
    let localActivePixels = 0;
    const minX = Math.max(0, sampleX - radiusPx);
    const maxX = Math.min(canvas.width - 1, sampleX + radiusPx);
    const minY = Math.max(0, projectedY - radiusPx);
    const maxY = Math.min(canvas.height - 1, projectedY + radiusPx);
    const radiusSquared = radiusPx * radiusPx;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = x - sampleX;
        const dy = y - projectedY;
        if ((dx * dx) + (dy * dy) > radiusSquared) continue;
        if (imageData[(y * canvas.width + x) * 4 + 3] > 0) {
          localActivePixels += 1;
        }
      }
    }

    return {
      localActivePixels,
      scrollY: window.scrollY
    };
  }, {
    sampleX: sample.sampleX,
    sampleY: sample.sampleY,
    radiusPx: sample.radiusPx,
    scrollDeltaCss: sample.scrollDeltaCss
  });

  assert(afterScroll, `[${browserName}] post-scroll particle response should be readable`);
  assert(afterScroll.scrollY >= sample.scrollDeltaCss, `[${browserName}] test page should scroll under a stationary cursor`);
  assert(
    afterScroll.localActivePixels < sample.newLocalActivePixels * 0.92,
    `[${browserName}] cursor effect should track the stationary viewport cursor after scrolling`
  );
}

async function assertReloadSkipState(page, browserName) {
  await page.reload({ waitUntil: 'networkidle' });
  await waitForBlueprintReady(page);
  await page.waitForTimeout(220);

  const state = await page.evaluate(() => {
    const root = document.documentElement;
    const title = document.querySelector('.blueprint-title');
    const finalWord = title?.querySelector('.blueprint-final-word');
    const canvas = title?.querySelector('.particle-canvas');
    const finalWordStyle = finalWord ? window.getComputedStyle(finalWord) : null;
    const canvasStyle = canvas ? window.getComputedStyle(canvas) : null;
    let activeCanvasPixels = 0;

    if (canvas instanceof HTMLCanvasElement) {
      const context = canvas.getContext('2d');
      const imageData = context?.getImageData(0, 0, canvas.width, canvas.height).data;
      if (imageData) {
        for (let index = 3; index < imageData.length; index += 4) {
          if (imageData[index] > 0) activeCanvasPixels += 1;
        }
      }
    }

    return {
      skipped: root.classList.contains('skip-page-animation') && root.dataset.pageId === 'home',
      complete: title?.classList.contains('is-static-wordmark') === true,
      finalWordOpacity: finalWordStyle?.opacity,
      canvasOpacity: canvasStyle?.opacity,
      activeCanvasPixels
    };
  });

  assert(state.skipped, `[${browserName}] reload should apply page animation skip flags`);
  assert(state.complete, `[${browserName}] reload should render the static particle wordmark`);
  assert(Number(state.finalWordOpacity) === 0, `[${browserName}] reload should not show orange DOUGHERTY text`);
  assert(Number(state.canvasOpacity) === 1, `[${browserName}] reload should show the static particle canvas`);
  assert(state.activeCanvasPixels > 500, `[${browserName}] reload particle canvas should contain active pixels`);
}

async function runBrowser(browserEntry, viewport) {
  const browser = await browserEntry.launcher.launch({ headless: true });

  try {
    const context = await prepareContext(browser, viewport);
    const page = await context.newPage();

    for (const frame of FRAMES) {
      const filename = await captureFrame(page, browserEntry.name, viewport.label, frame);
      console.log(`Captured ${filename}`);
    }

    await assertBlueprintStructure(page, browserEntry.name);
    await assertLateSettlePointerInteraction(page, browserEntry.name);
    await assertPointerTracksScroll(page, browserEntry.name);
    await assertReloadSkipState(page, browserEntry.name);
    await context.close();
  } finally {
    await browser.close();
  }
}

async function run() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const server = await startLocalStaticServer({
    url: baseUrl,
    cwd: ROOT,
    skip: Boolean(process.env.BLUEPRINT_CHECK_URL),
    bindHost: null
  });
  baseUrl = server?.url || baseUrl;

  try {
    await waitForServer(baseUrl);

    for (const browserEntry of BROWSERS) {
      for (const viewport of VIEWPORTS) {
        await runBrowser(browserEntry, viewport);
      }
      console.log(`Verified blueprint animation in ${browserEntry.name}.`);
    }

    console.log('Blueprint animation checks passed.');
  } finally {
    if (server) {
      server.kill('SIGTERM');
    }
  }
}

run().catch((error) => {
  console.error('Blueprint check failed:', error.message);
  process.exit(1);
});
