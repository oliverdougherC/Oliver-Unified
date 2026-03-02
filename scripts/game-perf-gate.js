#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

function parseArgs(argv) {
  const out = {
    url: 'http://127.0.0.1:4173/game/',
    headless: true,
    durations: {
      idleMs: 30_000,
      moveMs: 60_000,
      combatMs: 60_000
    }
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--url' && argv[i + 1]) {
      out.url = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--headed') {
      out.headless = false;
      continue;
    }
    if (arg === '--quick') {
      out.durations = {
        idleMs: 3_000,
        moveMs: 6_000,
        combatMs: 6_000
      };
    }
  }
  return out;
}

function percentile(values, q) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)));
  return sorted[idx];
}

function average(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function metric(rows, key) {
  return rows.map((row) => row[key]).filter((value) => Number.isFinite(value));
}

async function runScenario(page, opts) {
  const { durationMs, startRun, movement } = opts;
  if (startRun) {
    await page.click('#startGameBtn');
    await page.waitForTimeout(100);
  }

  if (movement === 'right') {
    await page.keyboard.down('d');
  } else if (movement === 'combat') {
    await page.keyboard.down('d');
    await page.keyboard.down('w');
  }

  const rows = [];
  const start = Date.now();
  while (Date.now() - start < durationMs) {
    const sample = await page.evaluate(() => {
      const raw = window.render_game_to_text?.();
      if (!raw) return null;
      const state = JSON.parse(raw);
      if (state.uiState === 'levelup' || state.uiState === 'chest') {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
      }
      const perf = state.renderPerf ?? {};
      return {
        uiState: state.uiState,
        frameMs: perf.frameTimeMs ?? null,
        updateMs: perf.updateMs ?? null,
        updateSteps: perf.updateSteps ?? null,
        totalRenderMs: perf.timings?.totalMs ?? null,
        backdropMs: perf.timings?.backdropMs ?? null,
        backdropCommands: perf.backdropDrawCommandsEstimate ?? null,
        canvasRatio: perf.actualCanvasToCssRatio ?? null,
        lightingSamples: perf.lightingSampleCount ?? null,
        entitiesMs: perf.timings?.entitiesMs ?? null,
        overlaysMs: perf.timings?.overlaysMs ?? null,
        budgetTier: perf.budgetTier ?? null
      };
    });
    if (sample) rows.push(sample);
    await page.waitForTimeout(200);
  }

  if (movement === 'right') {
    await page.keyboard.up('d');
  } else if (movement === 'combat') {
    await page.keyboard.up('d');
    await page.keyboard.up('w');
  }

  const frame = metric(rows, 'frameMs');
  const total = metric(rows, 'totalRenderMs');
  const backdrop = metric(rows, 'backdropMs');
  const updateMs = metric(rows, 'updateMs');
  const updateSteps = metric(rows, 'updateSteps');
  const backdropCommands = metric(rows, 'backdropCommands');
  const canvasRatio = metric(rows, 'canvasRatio');
  const lightingSamples = metric(rows, 'lightingSamples');
  const entities = metric(rows, 'entitiesMs');
  const overlays = metric(rows, 'overlaysMs');

  return {
    samples: rows.length,
    frameMs: {
      p50: percentile(frame, 0.5),
      p95: percentile(frame, 0.95),
      max: frame.length ? Math.max(...frame) : null
    },
    update: {
      p50Ms: percentile(updateMs, 0.5),
      p95Ms: percentile(updateMs, 0.95),
      p95Steps: percentile(updateSteps, 0.95)
    },
    renderMs: {
      p50: percentile(total, 0.5),
      p95: percentile(total, 0.95),
      backdropP95: percentile(backdrop, 0.95),
      entitiesP95: percentile(entities, 0.95),
      overlaysP95: percentile(overlays, 0.95)
    },
    backdropMs: backdrop,
    backdropCommands,
    canvasRatio: {
      avg: average(canvasRatio),
      min: canvasRatio.length ? Math.min(...canvasRatio) : null
    },
    lightingSamples: {
      p95: percentile(lightingSamples, 0.95),
      avg: average(lightingSamples)
    },
    budgetTiers: Array.from(new Set(rows.map((row) => row.budgetTier).filter(Boolean)))
  };
}

async function sampleClarity(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      return { ratio: 0, expectedMin: 0, dpr: window.devicePixelRatio || 1, cap: 0 };
    }
    const styleWidth = Math.max(1, canvas.clientWidth || canvas.getBoundingClientRect().width || 1);
    const ratio = canvas.width / styleWidth;
    const dpr = window.devicePixelRatio || 1;
    const coarsePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    const touchPoints = navigator.maxTouchPoints || 0;
    const cap = coarsePointer || touchPoints > 1 ? 2 : 2.5;
    const expectedMin = 0.95 * Math.min(dpr, cap);
    return { ratio, expectedMin, dpr, cap };
  });
}

async function runProfile(browser, baseUrl, profile, durations) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(profile.params)) {
    url.searchParams.set(key, String(value));
  }

  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const idle = await runScenario(page, { durationMs: durations.idleMs, startRun: false, movement: 'none' });
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  const move = await runScenario(page, { durationMs: durations.moveMs, startRun: true, movement: 'right' });
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  const combat = await runScenario(page, { durationMs: durations.combatMs, startRun: true, movement: 'combat' });
  const clarity = await sampleClarity(page);

  await context.close();
  const firstHalfBackdrop = move.backdropMs.slice(0, Math.floor(move.backdropMs.length / 2));
  const secondHalfBackdrop = move.backdropMs.slice(Math.floor(move.backdropMs.length / 2));
  const backdropRatio = (() => {
    const a = average(firstHalfBackdrop);
    const b = average(secondHalfBackdrop);
    if (!a || !b) return null;
    return b / a;
  })();
  const firstHalfCommands = move.backdropCommands.slice(0, Math.floor(move.backdropCommands.length / 2));
  const secondHalfCommands = move.backdropCommands.slice(Math.floor(move.backdropCommands.length / 2));
  const backdropCommandsRatio = (() => {
    const a = average(firstHalfCommands);
    const b = average(secondHalfCommands);
    if (!a || !b) return null;
    return b / a;
  })();

  return { idle, move, combat, clarity, backdropRatio, backdropCommandsRatio };
}

async function main() {
  const args = parseArgs(process.argv);
  const browser = await chromium.launch({ headless: args.headless });
  const started = Date.now();

  const profiles = [
    {
      name: 'desktop_webgpu',
      params: {
        renderer: 'webgpu',
        resolutionProfile: 'balanced',
        resolutionScale: '1.0',
        postFxSoftness: '0.15'
      }
    },
    {
      name: 'desktop_webgl',
      params: {
        renderer: 'webgl',
        resolutionProfile: 'balanced',
        resolutionScale: '1.0',
        postFxSoftness: '0.15'
      }
    },
    {
      name: 'mobile_profile_sim',
      params: {
        renderer: 'webgl',
        resolutionProfile: 'performance',
        resolutionScale: '0.82',
        postFxSoftness: '0.05'
      }
    },
    {
      name: 'safari_safe_profile',
      params: {
        renderer: 'auto',
        rendererPolicy: 'prefer_webgl',
        safariSafeMode: '1',
        resolutionProfile: 'balanced',
        resolutionScale: '0.9',
        postFxSoftness: '0.1'
      }
    }
  ];

  const report = { startedAt: new Date(started).toISOString(), baseUrl: args.url, profiles: {} };
  for (const profile of profiles) {
    report.profiles[profile.name] = await runProfile(browser, args.url, profile, args.durations);
  }

  await browser.close();

  const failures = [];
  const webgpu = report.profiles.desktop_webgpu;
  const webgl = report.profiles.desktop_webgl;
  const mobile = report.profiles.mobile_profile_sim;
  const safariSafe = report.profiles.safari_safe_profile;

  if ((webgpu.combat.frameMs.p95 ?? Infinity) > 16.7) failures.push(`desktop_webgpu combat p95 ${(webgpu.combat.frameMs.p95 ?? Infinity).toFixed(2)}ms > 16.7ms`);
  if ((webgl.combat.frameMs.p95 ?? Infinity) > 16.7) failures.push(`desktop_webgl combat p95 ${(webgl.combat.frameMs.p95 ?? Infinity).toFixed(2)}ms > 16.7ms`);
  if ((mobile.combat.frameMs.p95 ?? Infinity) > 25) failures.push(`mobile_profile_sim combat p95 ${(mobile.combat.frameMs.p95 ?? Infinity).toFixed(2)}ms > 25ms`);
  if ((webgpu.backdropRatio ?? 0) > 1.2) failures.push(`desktop_webgpu backdrop drift ratio ${(webgpu.backdropRatio ?? 0).toFixed(2)} > 1.20`);
  if ((webgl.backdropRatio ?? 0) > 1.2) failures.push(`desktop_webgl backdrop drift ratio ${(webgl.backdropRatio ?? 0).toFixed(2)} > 1.20`);
  if ((webgpu.backdropCommandsRatio ?? 0) > 1.1) failures.push(`desktop_webgpu backdrop command drift ${(webgpu.backdropCommandsRatio ?? 0).toFixed(2)} > 1.10`);
  if ((webgl.backdropCommandsRatio ?? 0) > 1.1) failures.push(`desktop_webgl backdrop command drift ${(webgl.backdropCommandsRatio ?? 0).toFixed(2)} > 1.10`);
  if ((safariSafe.combat.frameMs.p95 ?? Infinity) > 25) failures.push(`safari_safe_profile combat p95 ${(safariSafe.combat.frameMs.p95 ?? Infinity).toFixed(2)}ms > 25ms`);
  if ((safariSafe.combat.update.p95Steps ?? Infinity) > 3) failures.push(`safari_safe_profile update steps p95 ${(safariSafe.combat.update.p95Steps ?? Infinity).toFixed(2)} > 3`);
  if ((safariSafe.backdropCommandsRatio ?? 0) > 1.1) failures.push(`safari_safe_profile backdrop command drift ${(safariSafe.backdropCommandsRatio ?? 0).toFixed(2)} > 1.10`);
  if (webgpu.clarity.ratio < webgpu.clarity.expectedMin) failures.push(`desktop_webgpu clarity ${webgpu.clarity.ratio.toFixed(2)} < expected ${webgpu.clarity.expectedMin.toFixed(2)}`);
  if (webgl.clarity.ratio < webgl.clarity.expectedMin) failures.push(`desktop_webgl clarity ${webgl.clarity.ratio.toFixed(2)} < expected ${webgl.clarity.expectedMin.toFixed(2)}`);

  const outputDir = path.join(process.cwd(), 'output');
  fs.mkdirSync(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, 'game-perf-gate-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ ...report, failures }, null, 2));

  console.log(`Perf gate report written: ${reportPath}`);
  if (failures.length > 0) {
    console.error('Perf gate failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log('Perf gate passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
