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

const BROWSERS = [
  { name: 'chromium', launcher: chromium },
  { name: 'firefox', launcher: firefox },
  { name: 'webkit', launcher: webkit }
];

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
      window.sessionStorage.removeItem('od-page-animations-seen');
    } catch (_error) {
      // Ignore storage access issues in automation contexts.
    }
    try {
      window.localStorage.removeItem('od-color-mode');
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

    if (canvas instanceof HTMLCanvasElement) {
      const context = canvas.getContext('2d');
      const imageData = context?.getImageData(0, 0, canvas.width, canvas.height).data;
      if (imageData) {
        for (let index = 3; index < imageData.length; index += 4) {
          if (imageData[index] > 0) activeCanvasPixels += 1;
        }
      }
    }

    const intersectsOliver = Boolean(canvasRect && oliverRect)
      && canvasRect.left < oliverRect.right
      && canvasRect.right > oliverRect.left
      && canvasRect.top < oliverRect.bottom
      && canvasRect.bottom > oliverRect.top;

    const widthRatio = canvasRect && wordRect ? canvasRect.width / wordRect.width : 0;
    const heightRatio = canvasRect && wordRect ? canvasRect.height / wordRect.height : 0;

    return {
      complete: title?.classList.contains('is-static-wordmark') === true,
      finalWordOpacity: finalWordStyle?.opacity,
      canvasOpacity: canvasStyle?.opacity,
      canvasWidth: canvas?.width || 0,
      canvasHeight: canvas?.height || 0,
      activeCanvasPixels,
      intersectsOliver,
      widthRatio,
      heightRatio,
      activeAnimationFrames: window.__odActiveAnimationFrames?.size ?? 0
    };
  });

  assert(state.complete, `[${browserName}] particle wordmark should reach its static complete state`);
  assert(Number(state.finalWordOpacity) === 0, `[${browserName}] final orange word should stay hidden`);
  assert(Number(state.canvasOpacity) === 1, `[${browserName}] completed particle canvas should be visible`);
  assert(state.canvasWidth > 0 && state.canvasHeight > 0, `[${browserName}] particle canvas should be sized`);
  assert(state.activeCanvasPixels > 500, `[${browserName}] expected active particle pixels in completed canvas`);
  assert(!state.intersectsOliver, `[${browserName}] particle canvas should not cover OLIVER`);
  assert(state.widthRatio > 1 && state.widthRatio < 1.7, `[${browserName}] particle canvas width should stay close to DOUGHERTY bounds`);
  assert(state.heightRatio > 1.6 && state.heightRatio < 3.8, `[${browserName}] particle canvas height should stay close to DOUGHERTY bounds`);
  assert(state.activeAnimationFrames === 0, `[${browserName}] particle animation should not leave rAF work queued`);
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
