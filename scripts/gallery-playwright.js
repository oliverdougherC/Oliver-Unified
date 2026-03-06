#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const WEBGL_ARGS = ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader'];
const NAV_WAIT_UNTIL = 'domcontentloaded';

function isLocalBaseUrl(url) {
  return url.startsWith('http://127.0.0.1:') || url.startsWith('http://localhost:');
}

function parsePortFromBaseUrl(url) {
  const match = url.match(/^http:\/\/[^:]+:(\d+)/);
  return match ? Number(match[1]) : 4173;
}

function startLocalServerIfNeeded(url) {
  if (!isLocalBaseUrl(url)) return null;
  if (process.argv[2]) return null;
  return spawn('python3', ['-m', 'http.server', String(parsePortFromBaseUrl(url))], {
    cwd: ROOT,
    stdio: 'ignore'
  });
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
    await new Promise((resolve) => setTimeout(resolve, 220));
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

async function waitForGalleryReady(page) {
  const timeoutMs = 18000;
  const startedAt = Date.now();
  let state = null;

  while ((Date.now() - startedAt) < timeoutMs) {
    state = await page.evaluate(() => {
      const shell = document.getElementById('galleryShell');
      const mode = shell?.dataset?.renderMode || null;
      const caption = document.getElementById('galleryCaption');
      const counter = document.getElementById('galleryCounter');
      const indexItems = document.querySelectorAll('.gallery-index-item').length;
      const isReady = mode && mode !== 'initializing'
        && (mode !== 'render' || (caption && counter && indexItems > 0));

      return {
        isReady: Boolean(isReady),
        readyState: document.readyState,
        hasApp: Boolean(window.__galleryApp),
        entries: window.__galleryApp?.entries?.length || 0,
        renderMode: window.__galleryRenderMode || null,
        shellMode: mode,
        hasCaption: Boolean(caption),
        hasCounter: Boolean(counter),
        indexItems
      };
    });

    if (state.isReady) {
      return;
    }

    await page.waitForTimeout(120);
  }

  throw new Error(`Gallery readiness timed out: ${JSON.stringify(state)}`);
}

async function forceColorMode(page, mode) {
  await page.evaluate((nextMode) => {
    window.localStorage.setItem('od-color-mode', nextMode);
    document.documentElement.setAttribute('data-color-mode', nextMode);
    document.documentElement.style.colorScheme = nextMode;
  }, mode);
  await page.reload({ waitUntil: NAV_WAIT_UNTIL });
  try {
    await waitForGalleryReady(page);
  } catch (_error) {
    await page.waitForTimeout(1400);
  }
}

async function focusActiveCard(page) {
  const renderMode = await page.evaluate(() => window.__galleryRenderMode || null);
  if (renderMode !== 'render') {
    return false;
  }

  await page.waitForTimeout(500);
  const point = await page.evaluate(() => {
    const app = window.__galleryApp;
    const camera = app?.webgl?.camera;
    const index = app?.sceneController?.activeIndex ?? 0;
    const item = app?.sceneController?.items?.[index];
    if (!camera || !item?.mesh) return null;

    const projected = item.mesh.position.clone().project(camera);
    const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (x < 8 || y < 8 || x > window.innerWidth - 8 || y > window.innerHeight - 8) return null;
    return { x, y };
  });

  if (!point) return false;
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction(() => window.__galleryApp?.uiController?.isFocusMode ?? false, { timeout: 3000 });
  return true;
}

async function setDeterministicIdleIndex(page, index = 5) {
  await page.evaluate((target) => {
    const app = window.__galleryApp;
    if (!app?.sceneController) return;
    app.pendingFocusIndex = -1;
    app.sceneController.exitFocus?.();
    app.uiController?.setFocusMode(false);
    app.inputController?.scrollToIndex(target);
  }, index);
  await page.waitForTimeout(1200);
}

async function run() {
  const target = process.argv[2] || 'http://127.0.0.1:4173/pages/gallery/index.html';
  const outDir = path.resolve(process.cwd(), 'output/gallery-overhaul');
  await fs.mkdir(outDir, { recursive: true });

  const serverProcess = startLocalServerIfNeeded(target);
  await waitForServer(target);

  const browser = await chromium.launch({ args: WEBGL_ARGS });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(target, { waitUntil: NAV_WAIT_UNTIL });
    await waitForGalleryReady(page);
    await page.waitForTimeout(900);
    await setDeterministicIdleIndex(page, 6);

    await page.screenshot({ path: path.join(outDir, 'desktop-dark-idle.png') });

    if (await focusActiveCard(page)) {
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(outDir, 'desktop-dark-focus.png') });
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(350);
    }

    await forceColorMode(page, 'light');
    await page.waitForTimeout(900);
    await setDeterministicIdleIndex(page, 6);
    await page.screenshot({ path: path.join(outDir, 'desktop-light-idle.png') });

    if (await focusActiveCard(page)) {
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(outDir, 'desktop-light-focus.png') });
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(350);
    }

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload({ waitUntil: NAV_WAIT_UNTIL });
    await waitForGalleryReady(page);
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(outDir, 'desktop-reduced-motion.png') });

    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true
    });

    const mobilePage = await mobile.newPage();
    await mobilePage.goto(target, { waitUntil: NAV_WAIT_UNTIL });
    await waitForGalleryReady(mobilePage);
    await mobilePage.waitForTimeout(900);
    await setDeterministicIdleIndex(mobilePage, 6);
    await mobilePage.screenshot({ path: path.join(outDir, 'mobile-dark-idle.png') });

    await forceColorMode(mobilePage, 'light');
    await mobilePage.waitForTimeout(900);
    await setDeterministicIdleIndex(mobilePage, 6);
    await mobilePage.screenshot({ path: path.join(outDir, 'mobile-light-idle.png') });

    await mobile.close();
    await context.close();
  } finally {
    await browser.close();
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  }

  console.log('Gallery snapshots saved to:', outDir);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
