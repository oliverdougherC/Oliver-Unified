/**
 * Starfield Canvas Animation
 * Stationary twinkling stars (no motion) plus occasional comets, a slowly
 * drifting nebula wash, and diffraction spikes on sparkle peaks.
 *
 * The render loop runs on a Web Worker via transferControlToOffscreen when
 * supported (frees the main thread from ~30fps canvas work), with a bit-for-bit
 * identical main-thread fallback. The draw math is shared by a single
 * self-contained renderer function serialized into the worker.
 */
(function () {
  'use strict';

  const STARFIELD_CONFIG = Object.freeze({
    baseStarCount: 320,
    maxDpr: 1.5,
    frameIntervalMs: 1000 / 30,   // throttle to ~30fps; twinkle is slow
    diagnosticsBatchFrames: 30,
    colors: ['#ffffff', '#e0f7fa', '#fff3e0', '#fce4ec', '#f3e5f5'],
    sparkleFraction: 0.06,        // ~6% of stars are sparkle accents (rarer flashes)
    driftColorFraction: 0.05,     // ~5% slowly lerp between two tints
    // Nebula: soft, slowly-drifting color wash cached to a low-res canvas.
    nebulaCount: 3,
    nebulaColors: ['#1a237e', '#004d40', '#4a148c'], // indigo, teal, magenta
    nebulaMaxOpacity: 0.11,
    nebulaRadiusFraction: 0.55,        // radius = Math.min(width, height) * fraction
    nebulaDriftSpeed: 0.2,             // CSS px / sec (very slow drift)
    nebulaCacheRefreshFrames: 30,      // re-render cache every ~1s at 30fps
    // Diffraction spikes drawn on sparkle peaks.
    spikeLengthFactor: 7,        // half-length = radius * factor * flash
    spikeMaxAlpha: 0.55,
    spikeThreshold: 0.6,         // only draw on the strongest sparkle peaks
    spikeLineWidth: 1
  });

  /**
   * Self-contained starfield renderer.
   *
   * FRAGILITY: this function is serialized into a Web Worker via
   * Function.prototype.toString(). It may ONLY reference the outer-scope names
   * `STARFIELD_CONFIG` and `reducedMotion` (both redeclared at the top of the
   * worker blob source). It must NOT reference `window` or `document` on a path
   * that executes in the worker. Do NOT minify or transpile in a way that
   * renames these identifiers or hoists helpers out of this function.
   *
   * Returns { init, resize, setVisibility, pause, resume }.
   */
  function starfieldMain(ctx, canvas, send, scheduler, isWorker) {
    let width = 0;
    let height = 0;
    let stars = [];
    let comets = [];
    let nebulae = [];
    let nebulaCache = null;
    let nebulaCacheCtx = null;
    let nebulaRefreshCounter = 0;
    let drawnFrames = 0;
    let diagnosticsFrameCounter = 0;
    let lastTimestamp = 0;
    let lastDraw = 0;
    let timerId = 0;
    let running = false;
    let hidden = false;

    function resolveStarCount() {
      if (reducedMotion) {
        return Math.min(140, STARFIELD_CONFIG.baseStarCount);
      }
      const areaScale = Math.max(0.45, Math.min(1.15, width * height / (1440 * 900)));
      const coreScale = (navigator.hardwareConcurrency || 4) <= 4 ? 0.72 : 1;
      return Math.round(STARFIELD_CONFIG.baseStarCount * areaScale * coreScale);
    }

    function hexToRgb(hex) {
      return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16)
      };
    }

    function lerpColor(hexA, hexB, t) {
      const a = hexToRgb(hexA);
      const b = hexToRgb(hexB);
      const r = Math.round(a.r + (b.r - a.r) * t);
      const g = Math.round(a.g + (b.g - a.g) * t);
      const bl = Math.round(a.b + (b.b - a.b) * t);
      return '#' +
        r.toString(16).padStart(2, '0') +
        g.toString(16).padStart(2, '0') +
        bl.toString(16).padStart(2, '0');
    }

    function createStar() {
      const depth = Math.random();
      const color = STARFIELD_CONFIG.colors[Math.floor(Math.random() * STARFIELD_CONFIG.colors.length)];
      const sparkle = Math.random() < STARFIELD_CONFIG.sparkleFraction;
      const driftColor = Math.random() < STARFIELD_CONFIG.driftColorFraction;
      let altColor = color;
      if (driftColor) {
        let candidate = STARFIELD_CONFIG.colors[Math.floor(Math.random() * STARFIELD_CONFIG.colors.length)];
        if (candidate === color) {
          candidate = STARFIELD_CONFIG.colors[(STARFIELD_CONFIG.colors.indexOf(color) + 1) % STARFIELD_CONFIG.colors.length];
        }
        altColor = candidate;
      }
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.max(0.5, depth * 2.5),
        color: color,
        baseOpacity: 0.25 + depth * 0.55,
        twinkleAmp: 0.12 + Math.random() * 0.2,
        twinkleSpeed: 0.08 + Math.random() * 0.22,   // ~4x slower breathing
        twinklePhase: Math.random() * Math.PI * 2,
        sparkle: sparkle,
        sparkleSpeed: 0.35 + Math.random() * 0.65,   // ~4x slower sparkle peaks
        sparklePhase: Math.random() * Math.PI * 2,
        driftColor: driftColor,
        altColor: altColor
      };
    }

    function createNebula() {
      const radius = Math.min(width, height) * STARFIELD_CONFIG.nebulaRadiusFraction;
      const color = STARFIELD_CONFIG.nebulaColors[nebulae.length % STARFIELD_CONFIG.nebulaColors.length];
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        radius: radius,
        color: color,
        vx: (Math.random() - 0.5) * 2 * STARFIELD_CONFIG.nebulaDriftSpeed,
        vy: (Math.random() - 0.5) * 2 * STARFIELD_CONFIG.nebulaDriftSpeed
      };
    }

    function reconcileSpace() {
      const targetCount = resolveStarCount();
      while (stars.length < targetCount) {
        stars.push(createStar());
      }
      if (stars.length > targetCount) {
        stars.length = targetCount;
      }
      while (nebulae.length < STARFIELD_CONFIG.nebulaCount) {
        nebulae.push(createNebula());
      }
      if (nebulae.length > STARFIELD_CONFIG.nebulaCount) {
        nebulae.length = STARFIELD_CONFIG.nebulaCount;
      }
    }

    function spawnComet() {
      const isLeftToRight = Math.random() > 0.5;
      return {
        x: isLeftToRight ? -50 : width + 50,
        y: Math.random() * (height * 0.5),
        length: 200 + Math.random() * 400,
        speedX: (isLeftToRight ? 1 : -1) * (70 + Math.random() * 130),
        speedY: 15 + Math.random() * 50,
        opacity: 0.6 + Math.random() * 0.4,
        thickness: 1.5 + Math.random() * 2.5
      };
    }

    function createCacheCanvas(w, h) {
      if (typeof OffscreenCanvas !== 'undefined') {
        return new OffscreenCanvas(w, h);
      }
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    }

    function ensureNebulaCache() {
      if (nebulaCache && nebulaCache.width === width && nebulaCache.height === height && nebulaCacheCtx) {
        return;
      }
      nebulaCache = createCacheCanvas(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
      nebulaCacheCtx = nebulaCache.getContext('2d');
    }

    function refreshNebulaCache() {
      if (!nebulaCacheCtx) return;
      nebulaCacheCtx.clearRect(0, 0, width, height);
      for (let i = 0; i < nebulae.length; i += 1) {
        const n = nebulae[i];
        const rgb = hexToRgb(n.color);
        const grad = nebulaCacheCtx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius);
        grad.addColorStop(0, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + STARFIELD_CONFIG.nebulaMaxOpacity + ')');
        grad.addColorStop(1, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0)');
        nebulaCacheCtx.fillStyle = grad;
        nebulaCacheCtx.fillRect(0, 0, width, height);
      }
    }

    function update(deltaSeconds) {
      for (let i = 0; i < stars.length; i += 1) {
        const star = stars[i];
        star.twinklePhase += star.twinkleSpeed * deltaSeconds;
        if (star.sparkle) {
          star.sparklePhase += star.sparkleSpeed * deltaSeconds;
        }
      }

      if (!reducedMotion) {
        for (let i = 0; i < nebulae.length; i += 1) {
          const n = nebulae[i];
          n.x += n.vx * deltaSeconds;
          n.y += n.vy * deltaSeconds;
          if (n.x < -n.radius) n.x = width + n.radius;
          else if (n.x > width + n.radius) n.x = -n.radius;
          if (n.y < -n.radius) n.y = height + n.radius;
          else if (n.y > height + n.radius) n.y = -n.radius;
        }
      }

      if (comets.length === 0 && Math.random() < 0.02 * deltaSeconds) {
        comets.push(spawnComet());
      }

      for (let i = comets.length - 1; i >= 0; i -= 1) {
        const comet = comets[i];
        comet.x += comet.speedX * deltaSeconds;
        comet.y += comet.speedY * deltaSeconds;

        const fadeMargin = 150;
        let fade = 1;
        if (comet.speedX > 0) {
          if (comet.x > width - fadeMargin) fade = Math.max(0, 1 - (comet.x - (width - fadeMargin)) / fadeMargin);
        } else if (comet.x < fadeMargin) {
          fade = Math.max(0, 1 - (fadeMargin - comet.x) / fadeMargin);
        }
        if (comet.y > height - fadeMargin) {
          fade = Math.min(fade, Math.max(0, 1 - (comet.y - (height - fadeMargin)) / fadeMargin));
        }
        comet.opacity = 0.8 * fade;
        if (comet.opacity < 0.01 || comet.x > width + 200 || comet.x < -200 || comet.y > height + 200) {
          comets.splice(i, 1);
        }
      }
    }

    function draw() {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      if (nebulaCache) {
        ctx.drawImage(nebulaCache, 0, 0);
      }

      for (let i = 0; i < stars.length; i += 1) {
        const star = stars[i];
        const breath = star.twinkleAmp * Math.sin(star.twinklePhase);
        let opacity = star.baseOpacity + breath;
        let radius = star.size;
        let color = star.color;
        let flash = 0;

        if (star.sparkle) {
          flash = Math.pow(Math.max(0, Math.sin(star.sparklePhase)), 4);
          opacity += 0.5 * flash;
          radius = star.size * (1 + 0.3 * flash);
        }

        if (star.driftColor) {
          const t = 0.5 + 0.5 * Math.sin(star.twinklePhase * 0.3);
          color = lerpColor(star.color, star.altColor, t);
        }

        opacity = Math.max(0.08, Math.min(1, opacity));

        ctx.beginPath();
        ctx.arc(star.x, star.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = opacity;
        ctx.fill();

        if (star.sparkle && flash > STARFIELD_CONFIG.spikeThreshold) {
          const len = radius * STARFIELD_CONFIG.spikeLengthFactor * flash;
          ctx.strokeStyle = 'rgba(255,255,255,' + (STARFIELD_CONFIG.spikeMaxAlpha * flash).toFixed(3) + ')';
          ctx.lineWidth = STARFIELD_CONFIG.spikeLineWidth;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(star.x - len, star.y);
          ctx.lineTo(star.x + len, star.y);
          ctx.moveTo(star.x, star.y - len);
          ctx.lineTo(star.x, star.y + len);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      for (let i = 0; i < comets.length; i += 1) {
        const comet = comets[i];
        const speed = Math.sqrt(comet.speedX * comet.speedX + comet.speedY * comet.speedY);
        const dirX = speed > 0.001 ? comet.speedX / speed : 0;
        const dirY = speed > 0.001 ? comet.speedY / speed : 0;
        const tailX = comet.x - dirX * comet.length;
        const tailY = comet.y - dirY * comet.length;
        const perpX = -dirY;
        const perpY = dirX;
        const headWidth = comet.thickness * 1.8;

        const gradient = ctx.createLinearGradient(comet.x, comet.y, tailX, tailY);
        gradient.addColorStop(0, 'rgba(255, 255, 255, ' + comet.opacity + ')');
        gradient.addColorStop(0.05, 'rgba(180, 220, 255, ' + (comet.opacity * 0.8) + ')');
        gradient.addColorStop(0.3, 'rgba(100, 150, 255, ' + (comet.opacity * 0.3) + ')');
        gradient.addColorStop(1, 'rgba(100, 150, 255, 0)');
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(comet.x - perpX * headWidth, comet.y - perpY * headWidth);
        const angle = Math.atan2(dirY, dirX);
        ctx.arc(comet.x, comet.y, headWidth, angle - Math.PI / 2, angle + Math.PI / 2);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        const glowRadius = comet.thickness * 6;
        const headGlow = ctx.createRadialGradient(comet.x, comet.y, 0, comet.x, comet.y, glowRadius);
        headGlow.addColorStop(0, 'rgba(255, 255, 255, ' + comet.opacity + ')');
        headGlow.addColorStop(0.15, 'rgba(200, 230, 255, ' + (comet.opacity * 0.6) + ')');
        headGlow.addColorStop(0.4, 'rgba(100, 150, 255, ' + (comet.opacity * 0.2) + ')');
        headGlow.addColorStop(1, 'rgba(100, 150, 255, 0)');
        ctx.beginPath();
        ctx.arc(comet.x, comet.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = headGlow;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(comet.x, comet.y, comet.thickness * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, ' + comet.opacity + ')';
        ctx.fill();
      }
    }

    function syncDiagnostics(mode) {
      send({ type: 'diagnostics', starCount: stars.length, frameCount: drawnFrames, mode: mode, layerCount: 1 });
    }

    function loop(timestamp) {
      timerId = 0;
      if (!running || hidden) return;

      if (lastDraw && timestamp - lastDraw < STARFIELD_CONFIG.frameIntervalMs) {
        timerId = scheduler(loop);
        return;
      }

      const deltaSeconds = lastTimestamp ? Math.min(0.08, (timestamp - lastTimestamp) / 1000) : 1 / 30;
      lastTimestamp = timestamp;
      lastDraw = timestamp;

      update(deltaSeconds);

      nebulaRefreshCounter += 1;
      if (nebulaRefreshCounter >= STARFIELD_CONFIG.nebulaCacheRefreshFrames) {
        nebulaRefreshCounter = 0;
        refreshNebulaCache();
      }

      draw();

      drawnFrames += 1;
      diagnosticsFrameCounter += 1;
      if (diagnosticsFrameCounter >= STARFIELD_CONFIG.diagnosticsBatchFrames) {
        diagnosticsFrameCounter = 0;
        syncDiagnostics('twinkle');
      }

      if (!running || hidden) return;
      timerId = scheduler(loop);
    }

    function startLoop() {
      if (running || reducedMotion || hidden) return;
      running = true;
      lastTimestamp = 0;
      lastDraw = 0;
      timerId = scheduler(loop);
    }

    function stopLoop() {
      running = false;
      // Any already-scheduled callback will fire once, see running===false, and
      // not reschedule. No explicit cancel needed (works for both rAF and setTimeout).
    }

    function applySize(w, h, dpr) {
      const prevWidth = width;
      const prevHeight = height;
      width = w;
      height = h;

      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      if (!isWorker) {
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (stars.length && prevWidth > 0 && prevHeight > 0) {
        const sx = w / prevWidth;
        const sy = h / prevHeight;
        for (let i = 0; i < stars.length; i += 1) {
          stars[i].x *= sx;
          stars[i].y *= sy;
        }
        for (let i = 0; i < nebulae.length; i += 1) {
          nebulae[i].x *= sx;
          nebulae[i].y *= sy;
          nebulae[i].radius = Math.min(width, height) * STARFIELD_CONFIG.nebulaRadiusFraction;
        }
      }

      reconcileSpace();
      ensureNebulaCache();
      refreshNebulaCache();
      draw();
    }

    function init(w, h, dpr) {
      applySize(w, h, dpr);
      if (reducedMotion) {
        syncDiagnostics('reduced-motion');
      } else {
        startLoop();
      }
    }

    function resize(w, h, dpr) {
      applySize(w, h, dpr);
    }

    function setVisibility(h) {
      hidden = h;
      if (h) {
        stopLoop();
      } else {
        startLoop();
      }
    }

    function pause() {
      if (!running) return;
      stopLoop();
      syncDiagnostics(reducedMotion ? 'reduced-motion' : 'twinkle');
    }

    function resume() {
      if (reducedMotion) return;
      startLoop();
    }

    return { init: init, resize: resize, setVisibility: setVisibility, pause: pause, resume: resume };
  }

  // --- Top-level bootstrap: worker path first, then main-thread fallback ---

  const canvas = document.getElementById('starfield');
  if (!canvas) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resolveDpr() {
    if (reducedMotion) return 1;
    return Math.min(window.devicePixelRatio || 1, STARFIELD_CONFIG.maxDpr);
  }

  function applyDiagnostics(msg) {
    if (!msg || msg.type !== 'diagnostics') return;
    canvas.dataset.starCount = String(msg.starCount);
    canvas.dataset.starfieldMode = msg.mode;
    canvas.dataset.starfieldFrameCount = String(msg.frameCount);
    canvas.dataset.starfieldLayerCount = String(msg.layerCount);
  }

  function readDataset() {
    return {
      starCount: canvas.dataset.starCount || '0',
      starfieldMode: canvas.dataset.starfieldMode || '',
      starfieldFrameCount: canvas.dataset.starfieldFrameCount || '0',
      starfieldLayerCount: canvas.dataset.starfieldLayerCount || '0'
    };
  }

  const supportsWorker = !reducedMotion
    && typeof Worker === 'function'
    && typeof OffscreenCanvas !== 'undefined'
    && typeof canvas.transferControlToOffscreen === 'function';

  if (supportsWorker) {
    try {
      const workerSource =
        'const STARFIELD_CONFIG=' + JSON.stringify(STARFIELD_CONFIG) + ';\n' +
        'const reducedMotion=false;\n' +
        'var starfieldMain=' + starfieldMain.toString() + ';\n' +
        'var ctrl=null;\n' +
        'self.onmessage=function(e){\n' +
        '  var d=e.data;\n' +
        '  if(d.type==="init"){\n' +
        '    var ctx=d.canvas.getContext("2d",{alpha:false});\n' +
        '    if(!ctx)return;\n' +
        '    ctrl=starfieldMain(ctx,d.canvas,function(m){self.postMessage(m);},function(fn){setTimeout(function(){fn(performance.now());},STARFIELD_CONFIG.frameIntervalMs);},true);\n' +
        '    ctrl.init(d.width,d.height,d.dpr);\n' +
        '  } else if(d.type==="resize"){\n' +
        '    if(ctrl)ctrl.resize(d.width,d.height,d.dpr);\n' +
        '  } else if(d.type==="visibility"){\n' +
        '    if(ctrl)ctrl.setVisibility(d.hidden);\n' +
        '  } else if(d.type==="pause"){\n' +
        '    if(ctrl)ctrl.pause();\n' +
        '  } else if(d.type==="resume"){\n' +
        '    if(ctrl)ctrl.resume();\n' +
        '  }\n' +
        '};\n';

      const blob = new Blob([workerSource], { type: 'application/javascript' });
      const worker = new Worker(URL.createObjectURL(blob));

      const offscreen = canvas.transferControlToOffscreen();
      worker.postMessage(
        { type: 'init', canvas: offscreen, width: window.innerWidth, height: window.innerHeight, dpr: resolveDpr() },
        [offscreen]
      );

      worker.onmessage = function (e) {
        applyDiagnostics(e.data);
      };

      window.__starfield = {
        pause: function () { worker.postMessage({ type: 'pause' }); },
        resume: function () { worker.postMessage({ type: 'resume' }); },
        getDiagnostics: readDataset
      };

      let workerResizeFrame = 0;
      window.addEventListener('resize', function () {
        if (workerResizeFrame) return;
        workerResizeFrame = requestAnimationFrame(function () {
          workerResizeFrame = 0;
          worker.postMessage({ type: 'resize', width: window.innerWidth, height: window.innerHeight, dpr: resolveDpr() });
        });
      });

      document.addEventListener('visibilitychange', function () {
        worker.postMessage({ type: 'visibility', hidden: document.hidden });
      });

      return;
    } catch (err) {
      // Worker/offscreen setup failed — fall through to the main-thread renderer.
      // The canvas may already be transferred (unrecoverable); if so, bail.
      try {
        const probe = canvas.getContext('2d', { alpha: false });
        if (!probe) return;
      } catch (probeErr) {
        return;
      }
    }
  }

  // --- Main-thread fallback (also serves reduced-motion) ---
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  const ctrl = starfieldMain(ctx, canvas, applyDiagnostics, requestAnimationFrame, false);
  ctrl.init(window.innerWidth, window.innerHeight, resolveDpr());

  window.__starfield = {
    pause: ctrl.pause,
    resume: ctrl.resume,
    getDiagnostics: readDataset
  };

  let mainResizeFrame = 0;
  window.addEventListener('resize', function () {
    if (mainResizeFrame) return;
    mainResizeFrame = requestAnimationFrame(function () {
      mainResizeFrame = 0;
      ctrl.resize(window.innerWidth, window.innerHeight, resolveDpr());
    });
  });

  document.addEventListener('visibilitychange', function () {
    ctrl.setVisibility(document.hidden);
  });
})();
