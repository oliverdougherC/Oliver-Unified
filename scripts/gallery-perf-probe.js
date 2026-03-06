#!/usr/bin/env node

const { chromium } = require('playwright');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const WEBGL_ARGS = ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader'];
const REQUIRE_WEBGL = process.env.GALLERY_REQUIRE_WEBGL !== '0';

function isLocalBaseUrl(url) {
  return url.startsWith('http://127.0.0.1:') || url.startsWith('http://localhost:');
}

function parsePortFromBaseUrl(url) {
  const match = url.match(/^http:\/\/[^:]+:(\d+)/);
  return match ? Number(match[1]) : 4173;
}

function startLocalServerIfNeeded(targetUrl) {
  if (!isLocalBaseUrl(targetUrl)) return null;
  if (process.env.GALLERY_PERF_URL) return null;

  const port = parsePortFromBaseUrl(targetUrl);
  return spawn('python3', ['-m', 'http.server', String(port)], {
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

async function run() {
  const target = process.argv[2] || process.env.GALLERY_PERF_URL || 'http://127.0.0.1:4173/pages/gallery/index.html';
  const serverProcess = startLocalServerIfNeeded(target);
  await waitForServer(target);

  const browser = await chromium.launch({ headless: true, args: WEBGL_ARGS });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(target, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);

    const renderMode = await page.evaluate(() => window.__galleryRenderMode || null);
    if (REQUIRE_WEBGL && renderMode !== 'render') {
      throw new Error(`Expected WebGL render mode, got ${renderMode}`);
    }

    for (let i = 0; i < 6; i += 1) {
      await page.mouse.wheel(0, 2200);
      await page.waitForTimeout(420);
    }

    await page.waitForTimeout(1400);

    const stats = await page.evaluate(() => window.__galleryPerfStats || null);
    console.log('Perf stats:', stats);

    await context.close();

    if (!stats) {
      throw new Error('No perf stats exposed on window.__galleryPerfStats');
    }

    if (stats.fps < 24) {
      throw new Error(`FPS below threshold: ${stats.fps} < 24`);
    }

    if (stats.avgFrameMs > 33.3) {
      throw new Error(`Average frame time above threshold: ${stats.avgFrameMs}ms > 33.3ms`);
    }

    console.log(`Perf OK: ${stats.fps} fps, ${stats.avgFrameMs}ms avg frame time`);
  } finally {
    await browser.close();
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
