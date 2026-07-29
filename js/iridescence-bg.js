/**
 * Iridescence WebGL Background
 * Raw WebGL port of the React Bits Iridescence component.
 * 8-iteration cosine interference pattern with configurable color, speed, and amplitude.
 */
(function () {
  'use strict';

  const vertexSource = /* glsl */ `
    attribute vec2 uv;
    attribute vec2 position;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fragmentSource = /* glsl */ `
    precision highp float;

    varying vec2 vUv;

    uniform float uTime;
    uniform vec3 uColor;
    uniform vec3 uResolution;
    uniform vec2 uMouse;
    uniform float uAmplitude;
    uniform float uSpeed;

    void main() {
      float mr = min(uResolution.x, uResolution.y);
      vec2 uv = (vUv.xy * 2.0 - 1.0) * uResolution.xy / mr;
      uv += (uMouse - vec2(0.5)) * uAmplitude;

      float d = -uTime * 0.5 * uSpeed;
      float a = 0.0;
      for (float i = 0.0; i < 8.0; ++i) {
        a += cos(i - d - a * uv.x);
        d += sin(uv.y * i + a);
      }
      d += uTime * 0.5 * uSpeed;
      vec3 col = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);
      col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5);
      col = mix(col, col * uColor, 0.35);
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  let canvas, gl, program;
  let animFrameId = null;
  let startTime = performance.now();
  let frameCount = 0;

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(gl, vertexShader, fragmentShader) {
    const prog = gl.createProgram();
    gl.attachShader(prog, vertexShader);
    gl.attachShader(prog, fragmentShader);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog);
      return null;
    }
    return prog;
  }

  function resize() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
    const resLoc = gl.getUniformLocation(program, 'uResolution');
    gl.uniform3f(resLoc, canvas.width, canvas.height, canvas.width / canvas.height);
  }

  function update() {
    const elapsed = (performance.now() - startTime) * 0.001;
    const timeLoc = gl.getUniformLocation(program, 'uTime');
    gl.uniform1f(timeLoc, elapsed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    frameCount += 1;
    canvas.dataset.iridescenceFrameCount = String(frameCount);
    animFrameId = requestAnimationFrame(update);
  }

  function init() {
    canvas = document.createElement('canvas');
    canvas.id = 'iridescence-bg';
    canvas.style.cssText =
      'position:fixed;top:0;left:0;z-index:0;width:100vw;height:100vh;pointer-events:none;';
    document.body.insertBefore(canvas, document.body.firstChild);

    gl = canvas.getContext('webgl', { alpha: false, antialias: false });
    if (!gl) return;

    // Test-probe markers: background activity, animation mode, and frame progress.
    canvas.dataset.iridescenceActive = '1';
    const motionQuery = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    canvas.dataset.iridescenceMode = motionQuery && motionQuery.matches ? 'reduced-motion' : 'twinkle';

    const vs = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if (!vs || !fs) return;

    program = createProgram(gl, vs, fs);
    if (!program) return;
    gl.useProgram(program);

    // Full-screen triangle: covers [-1,1] clip space
    const positions = new Float32Array([-5, -1, 5, -1, -1, 3]);
    const uvs = new Float32Array([0, 0, 1, 0, 0, 1]);

    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
    const uvLoc = gl.getAttribLocation(program, 'uv');
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

    // Static uniforms
    gl.uniform3f(gl.getUniformLocation(program, 'uColor'), 0.62, 0.38, 0.96); // lighter #6c21ed for iridescence
    gl.uniform2f(gl.getUniformLocation(program, 'uMouse'), 0.5, 0.5);
    gl.uniform1f(gl.getUniformLocation(program, 'uAmplitude'), 0.1);
    gl.uniform1f(gl.getUniformLocation(program, 'uSpeed'), 0.5);

    resize();
    window.addEventListener('resize', resize);

    // Reduced motion: render single frame and stop
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      gl.uniform1f(gl.getUniformLocation(program, 'uTime'), 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      frameCount += 1;
      canvas.dataset.iridescenceFrameCount = String(frameCount);
      return;
    }

    animFrameId = requestAnimationFrame(update);

    // Cleanup on pagehide
    const cleanup = function () {
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      window.removeEventListener('resize', resize);
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    };
    window.addEventListener('pagehide', cleanup);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
