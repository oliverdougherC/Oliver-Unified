type Vec3 = [number, number, number];
type MaterialKind = 0 | 1 | 2 | 3;
type RtDemoStatus = 'booting' | 'webgpu' | 'mock' | 'unsupported' | 'error';

interface SceneSphere {
  position: Vec3;
  radius: number;
  color: Vec3;
  material: MaterialKind;
  movable: boolean;
}

interface Ray {
  origin: Vec3;
  direction: Vec3;
}

interface HitRecord {
  index: number;
  distance: number;
}

interface DragState {
  index: number;
  planeY: number;
  offset: Vec3;
}

interface GpuAdapterLike {
  requestDevice(): Promise<GpuDeviceLike>;
}

interface GpuLike {
  requestAdapter(options?: { powerPreference?: 'high-performance' | 'low-power' }): Promise<GpuAdapterLike | null>;
  getPreferredCanvasFormat?: () => string;
}

interface GpuDeviceLike {
  queue: {
    writeBuffer(buffer: unknown, offset: number, data: ArrayBufferView): void;
    submit(commands: unknown[]): void;
  };
  lost?: Promise<{ reason: string; message: string }>;
  createShaderModule(descriptor: object): unknown;
  createRenderPipeline(descriptor: object): GpuRenderPipelineLike;
  createBuffer(descriptor: object): unknown;
  createBindGroup(descriptor: object): unknown;
  createCommandEncoder(): GpuCommandEncoderLike;
  destroy?: () => void;
}

interface GpuRenderPipelineLike {
  getBindGroupLayout(index: number): unknown;
}

interface GpuCommandEncoderLike {
  beginRenderPass(descriptor: object): {
    setPipeline(pipeline: GpuRenderPipelineLike): void;
    setBindGroup(index: number, bindGroup: unknown): void;
    draw(vertexCount: number): void;
    end(): void;
  };
  finish(): unknown;
}

interface GpuCanvasContextLike {
  configure(descriptor: object): void;
  getCurrentTexture(): {
    createView(): unknown;
  };
}

declare global {
  interface Window {
    __OD_RT_DEMO_MOCK_WEBGPU__?: boolean;
    __RT_DEMO_STATE__?: {
      status: RtDemoStatus;
      selectedIndex: number;
      frameCount: number;
      fps: number;
      spheres: Array<{ x: number; y: number; z: number; radius: number; material: number }>;
    };
  }

  interface HTMLCanvasElement {
    getContext(contextId: 'webgpu'): GpuCanvasContextLike | null;
  }
}

const MAX_DPR = 2;
const SPHERE_COUNT = 5;
const FLOATS_PER_VEC4 = 4;
const UNIFORM_VEC4_COUNT = 16;
const UNIFORM_FLOAT_COUNT = UNIFORM_VEC4_COUNT * FLOATS_PER_VEC4;
const CAMERA_POSITION: Vec3 = [0, 2.35, 6.2];
const CAMERA_TARGET: Vec3 = [0, 0.92, 0];
const FOV_SCALE = Math.tan((48 * Math.PI / 180) / 2);
const FLOOR_Y = 0;

const INITIAL_SPHERES: SceneSphere[] = [
  { position: [-1.32, 0.46, -0.25], radius: 0.46, color: [0.93, 0.28, 0.16], material: 0, movable: true },
  { position: [0.0, 0.62, 0.18], radius: 0.62, color: [0.82, 0.84, 0.88], material: 1, movable: true },
  { position: [1.22, 0.5, -0.55], radius: 0.5, color: [0.22, 0.62, 0.94], material: 2, movable: true },
  { position: [-0.42, 0.34, 1.08], radius: 0.34, color: [0.86, 0.76, 0.36], material: 0, movable: true },
  { position: [0.92, 2.65, 1.18], radius: 0.2, color: [1.0, 0.82, 0.46], material: 3, movable: true }
];

const WGSL_SOURCE = `
struct Uniforms {
  data: array<vec4f, 16>,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
};

struct Ray {
  origin: vec3f,
  direction: vec3f,
};

struct Hit {
  distance: f32,
  index: i32,
  position: vec3f,
  normal: vec3f,
  color: vec3f,
  material: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -3.0),
    vec2f(3.0, 1.0),
    vec2f(-1.0, 1.0)
  );
  var output: VertexOutput;
  output.position = vec4f(positions[vertexIndex], 0.0, 1.0);
  return output;
}

fn sphereA(index: i32) -> vec4f {
  return uniforms.data[5 + (index * 2)];
}

fn sphereB(index: i32) -> vec4f {
  return uniforms.data[6 + (index * 2)];
}

fn intersectSphere(ray: Ray, index: i32) -> Hit {
  let dataA = sphereA(index);
  let center = dataA.xyz;
  let radius = dataA.w;
  let oc = ray.origin - center;
  let halfB = dot(oc, ray.direction);
  let c = dot(oc, oc) - radius * radius;
  let discriminant = halfB * halfB - c;
  var hit: Hit;
  hit.distance = 1.0e20;
  hit.index = -1;
  hit.position = vec3f(0.0);
  hit.normal = vec3f(0.0, 1.0, 0.0);
  hit.color = vec3f(0.0);
  hit.material = 0.0;
  if (discriminant < 0.0) {
    return hit;
  }
  let root = sqrt(discriminant);
  var t = -halfB - root;
  if (t < 0.01) {
    t = -halfB + root;
  }
  if (t < 0.01) {
    return hit;
  }
  let material = sphereB(index);
  hit.distance = t;
  hit.index = index;
  hit.position = ray.origin + ray.direction * t;
  hit.normal = normalize(hit.position - center);
  hit.color = material.xyz;
  hit.material = material.w;
  return hit;
}

fn intersectFloor(ray: Ray) -> Hit {
  var hit: Hit;
  hit.distance = 1.0e20;
  hit.index = -2;
  hit.position = vec3f(0.0);
  hit.normal = vec3f(0.0, 1.0, 0.0);
  hit.color = vec3f(0.58, 0.56, 0.52);
  hit.material = 0.0;
  let denom = ray.direction.y;
  if (abs(denom) < 0.0001) {
    return hit;
  }
  let t = -ray.origin.y / denom;
  if (t < 0.01) {
    return hit;
  }
  let position = ray.origin + ray.direction * t;
  if (abs(position.x) > 4.0 || abs(position.z) > 3.2) {
    return hit;
  }
  let grid = step(0.035, abs(fract(position.x * 1.55) - 0.5)) * step(0.035, abs(fract(position.z * 1.55) - 0.5));
  hit.distance = t;
  hit.position = position;
  hit.color = mix(vec3f(0.42, 0.41, 0.39), vec3f(0.64, 0.62, 0.58), grid);
  return hit;
}

fn traceClosest(ray: Ray, ignoreIndex: i32) -> Hit {
  var closest = intersectFloor(ray);
  let objectCount = i32(uniforms.data[4].w);
  for (var index = 0; index < 5; index = index + 1) {
    if (index >= objectCount || index == ignoreIndex) {
      continue;
    }
    let hit = intersectSphere(ray, index);
    if (hit.distance < closest.distance) {
      closest = hit;
    }
  }
  return closest;
}

fn sky(direction: vec3f) -> vec3f {
  let t = clamp(direction.y * 0.5 + 0.5, 0.0, 1.0);
  let horizon = vec3f(0.34, 0.38, 0.42);
  let zenith = vec3f(0.025, 0.035, 0.055);
  return mix(horizon, zenith, t);
}

fn directLight(hit: Hit) -> vec3f {
  let lightData = sphereA(4);
  let lightPosition = lightData.xyz;
  let toLight = lightPosition - hit.position;
  let lightDistance = length(toLight);
  let lightDirection = toLight / lightDistance;
  let ndotl = max(dot(hit.normal, lightDirection), 0.0);
  var visibility = 1.0;
  let shadowRay = Ray(hit.position + hit.normal * 0.025, lightDirection);
  let shadowHit = traceClosest(shadowRay, 4);
  if (shadowHit.distance < lightDistance - 0.08) {
    visibility = 0.16;
  }
  let attenuation = 5.2 / max(1.0, lightDistance * lightDistance);
  let warmLight = vec3f(1.0, 0.84, 0.58);
  let diffuse = hit.color * warmLight * ndotl * attenuation * visibility;
  let ambient = hit.color * vec3f(0.035, 0.045, 0.055);
  return diffuse + ambient;
}

fn shadeRay(primary: Ray) -> vec3f {
  var ray = primary;
  var throughput = vec3f(1.0);
  var color = vec3f(0.0);
  let selectedIndex = i32(uniforms.data[0].w);

  for (var bounce = 0; bounce < 3; bounce = bounce + 1) {
    let hit = traceClosest(ray, -99);
    if (hit.index == -1) {
      color += throughput * sky(ray.direction);
      break;
    }
    if (hit.material > 2.5) {
      color += throughput * hit.color * 3.8;
      break;
    }

    var lit = directLight(hit);
    if (hit.index == selectedIndex) {
      let edge = pow(1.0 - max(dot(-ray.direction, hit.normal), 0.0), 2.5);
      lit += vec3f(0.7, 0.9, 1.0) * edge * 0.65;
    }

    if (hit.material < 0.5) {
      color += throughput * lit;
      break;
    }

    let reflectivity = select(0.55, 0.92, hit.material < 1.5);
    color += throughput * lit * (1.0 - reflectivity);
    throughput *= mix(vec3f(reflectivity), hit.color * reflectivity, select(0.72, 0.05, hit.material < 1.5));
    ray.origin = hit.position + hit.normal * 0.03;
    ray.direction = normalize(reflect(ray.direction, hit.normal));
  }

  return pow(clamp(color, vec3f(0.0), vec3f(1.0)), vec3f(0.4545));
}

@fragment
fn fsMain(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
  let resolution = uniforms.data[0].xy;
  let aspect = resolution.x / max(1.0, resolution.y);
  let cameraPosition = uniforms.data[1].xyz;
  let cameraRight = uniforms.data[2].xyz;
  let fovScale = uniforms.data[2].w;
  let cameraUp = uniforms.data[3].xyz;
  let cameraForward = uniforms.data[4].xyz;
  let pixel = (fragCoord.xy / resolution) * 2.0 - vec2f(1.0);
  let uv = vec2f(pixel.x * aspect, -pixel.y) * fovScale;
  let ray = Ray(cameraPosition, normalize(cameraForward + cameraRight * uv.x + cameraUp * uv.y));
  let shaded = shadeRay(ray);
  let vignette = smoothstep(1.42, 0.12, length(pixel));
  return vec4f(shaded * (0.72 + vignette * 0.28), 1.0);
}
`;

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(v: Vec3, amount: number): Vec3 {
  return [v[0] * amount, v[1] * amount, v[2] * amount];
}

function dot(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getNavigatorGpu() {
  const gpu = (navigator as Navigator & { gpu?: GpuLike }).gpu;
  return gpu && typeof gpu.requestAdapter === 'function' ? gpu : null;
}

function getGlobalGpuFlag(groupName: 'GPUBufferUsage' | 'GPUTextureUsage', flagName: string, fallback: number) {
  const flags = (globalThis as typeof globalThis & Record<string, Record<string, number> | undefined>)[groupName];
  return flags?.[flagName] ?? fallback;
}

class RtDemoApp {
  private readonly canvas: HTMLCanvasElement;
  private readonly fpsLabel: HTMLElement;
  private readonly infoButton: HTMLButtonElement;
  private readonly infoMenu: HTMLElement;
  private readonly spheres = INITIAL_SPHERES.map((sphere) => ({
    ...sphere,
    position: [...sphere.position] as Vec3,
    color: [...sphere.color] as Vec3
  }));
  private readonly cameraForward = normalize(subtract(CAMERA_TARGET, CAMERA_POSITION));
  private readonly cameraRight = normalize(cross(this.cameraForward, [0, 1, 0]));
  private readonly cameraUp = normalize(cross(this.cameraRight, this.cameraForward));
  private resizeObserver: ResizeObserver | null = null;
  private frameId = 0;
  private frameCount = 0;
  private fpsFrameCount = 0;
  private fpsLastTimestamp = 0;
  private fps = 0;
  private selectedIndex = -1;
  private dragState: DragState | null = null;
  private status: RtDemoStatus = 'booting';
  private device: GpuDeviceLike | null = null;
  private context: GpuCanvasContextLike | null = null;
  private pipeline: GpuRenderPipelineLike | null = null;
  private bindGroup: unknown = null;
  private uniformBuffer: unknown = null;
  private uniformData = new Float32Array(UNIFORM_FLOAT_COUNT);
  private mockContext: CanvasRenderingContext2D | null = null;

  constructor() {
    this.canvas = this.requireElement<HTMLCanvasElement>('rtDemoCanvas', HTMLCanvasElement);
    this.fpsLabel = this.requireElement<HTMLElement>('rtDemoFps', HTMLElement);
    this.infoButton = this.requireElement<HTMLButtonElement>('rtDemoInfoButton', HTMLButtonElement);
    this.infoMenu = this.requireElement<HTMLElement>('rtDemoInfoMenu', HTMLElement);
  }

  async init() {
    this.bindInfoMenu();
    this.bindPointerEvents();
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(this.canvas);
    window.addEventListener('resize', () => this.resizeCanvas());
    window.addEventListener('pagehide', () => this.stop());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stop();
      } else {
        this.startLoop();
      }
    });

    if (window.__OD_RT_DEMO_MOCK_WEBGPU__) {
      this.startMockRenderer();
      return;
    }

    try {
      await this.startWebGpuRenderer();
    } catch (error) {
      console.error('[RT Demo] WebGPU initialization failed:', error);
      this.drawUnsupported(error instanceof Error ? error.message : 'WebGPU could not start.');
    }
  }

  private requireElement<T extends HTMLElement>(
    id: string,
    constructorRef: { new (...args: never[]): T }
  ) {
    const element = document.getElementById(id);
    if (!(element instanceof constructorRef)) {
      throw new Error(`Missing required RT Demo element: ${id}`);
    }
    return element;
  }

  private bindInfoMenu() {
    const close = () => {
      this.infoMenu.hidden = true;
      this.infoButton.setAttribute('aria-expanded', 'false');
    };
    const toggle = () => {
      const open = this.infoMenu.hidden;
      this.infoMenu.hidden = !open;
      this.infoButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    this.infoButton.addEventListener('click', (event) => {
      event.stopPropagation();
      toggle();
    });
    this.infoMenu.addEventListener('click', (event) => event.stopPropagation());
    document.addEventListener('click', close);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        close();
      }
    });
  }

  private bindPointerEvents() {
    this.canvas.addEventListener('pointerdown', (event) => {
      const ray = this.rayFromPointer(event.clientX, event.clientY);
      const hit = this.pickSphere(ray);
      if (!hit || !this.spheres[hit.index]?.movable) {
        this.selectedIndex = -1;
        this.syncTestState();
        return;
      }
      const sphere = this.spheres[hit.index];
      const hitPoint = add(ray.origin, scale(ray.direction, hit.distance));
      this.selectedIndex = hit.index;
      this.dragState = {
        index: hit.index,
        planeY: sphere.position[1],
        offset: subtract(sphere.position, hitPoint)
      };
      this.canvas.setPointerCapture(event.pointerId);
      this.canvas.classList.add('is-dragging');
      this.syncTestState();
      event.preventDefault();
    });

    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.dragState) {
        return;
      }
      const ray = this.rayFromPointer(event.clientX, event.clientY);
      const planeDenom = ray.direction[1];
      if (Math.abs(planeDenom) < 0.0001) {
        return;
      }
      const distance = (this.dragState.planeY - ray.origin[1]) / planeDenom;
      if (distance <= 0) {
        return;
      }
      const point = add(ray.origin, scale(ray.direction, distance));
      const next = add(point, this.dragState.offset);
      const sphere = this.spheres[this.dragState.index];
      sphere.position = [
        clamp(next[0], -2.7, 2.7),
        sphere.material === 3 ? clamp(next[1], 1.35, 3.05) : Math.max(sphere.radius, next[1]),
        clamp(next[2], -1.95, 2.15)
      ];
      this.syncTestState();
      event.preventDefault();
    });

    const endDrag = (event: PointerEvent) => {
      if (this.dragState) {
        this.canvas.releasePointerCapture(event.pointerId);
      }
      this.dragState = null;
      this.canvas.classList.remove('is-dragging');
    };

    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointercancel', endDrag);
  }

  private async startWebGpuRenderer() {
    const gpu = getNavigatorGpu();
    if (!gpu) {
      throw new Error('WebGPU is unavailable in this browser or context.');
    }
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) {
      throw new Error('No WebGPU adapter was found.');
    }
    this.device = await adapter.requestDevice();
    const context = this.canvas.getContext('webgpu');
    if (!context) {
      throw new Error('Unable to create a WebGPU canvas context.');
    }
    this.context = context;
    const format = gpu.getPreferredCanvasFormat?.() ?? 'bgra8unorm';
    context.configure({
      device: this.device,
      format,
      alphaMode: 'opaque',
      usage: getGlobalGpuFlag('GPUTextureUsage', 'RENDER_ATTACHMENT', 16)
    });
    const shaderModule = this.device.createShaderModule({ code: WGSL_SOURCE });
    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vsMain'
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fsMain',
        targets: [{ format }]
      },
      primitive: {
        topology: 'triangle-list'
      }
    });
    this.uniformBuffer = this.device.createBuffer({
      size: this.uniformData.byteLength,
      usage:
        getGlobalGpuFlag('GPUBufferUsage', 'UNIFORM', 64) |
        getGlobalGpuFlag('GPUBufferUsage', 'COPY_DST', 8)
    });
    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.uniformBuffer
          }
        }
      ]
    });
    this.device.lost?.then((info) => {
      if (info.reason !== 'destroyed') {
        this.drawUnsupported(info.message || 'The WebGPU device was lost.');
      }
    });
    this.status = 'webgpu';
    this.resizeCanvas();
    this.syncTestState();
    this.startLoop();
  }

  private startMockRenderer() {
    const context = this.canvas.getContext('2d', { alpha: false });
    if (!context) {
      this.drawUnsupported('Unable to create a canvas renderer.');
      return;
    }
    this.mockContext = context;
    this.status = 'mock';
    this.resizeCanvas();
    this.syncTestState();
    this.startLoop();
  }

  private resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  private startLoop() {
    if (this.frameId || document.hidden) {
      return;
    }
    this.fpsLastTimestamp = performance.now();
    const tick = (timestamp: number) => {
      this.frameId = window.requestAnimationFrame(tick);
      this.resizeCanvas();
      this.updateFps(timestamp);
      if (this.status === 'mock') {
        this.renderMock();
      } else if (this.status === 'webgpu') {
        this.renderWebGpu(timestamp);
      }
      this.frameCount += 1;
      this.syncTestState();
    };
    this.frameId = window.requestAnimationFrame(tick);
  }

  private stop() {
    if (this.frameId) {
      window.cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    }
  }

  private updateFps(timestamp: number) {
    this.fpsFrameCount += 1;
    const elapsed = timestamp - this.fpsLastTimestamp;
    if (elapsed < 300) {
      return;
    }
    const current = this.fpsFrameCount * 1000 / elapsed;
    this.fps = this.fps === 0 ? current : this.fps * 0.72 + current * 0.28;
    this.fpsFrameCount = 0;
    this.fpsLastTimestamp = timestamp;
    this.fpsLabel.textContent = `FPS ${Math.round(this.fps).toString().padStart(2, '0')}`;
  }

  private renderWebGpu(timestamp: number) {
    if (!this.device || !this.context || !this.pipeline || !this.bindGroup || !this.uniformBuffer) {
      return;
    }
    this.writeUniforms(timestamp * 0.001);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData);
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          loadOp: 'clear',
          clearValue: { r: 0.015, g: 0.017, b: 0.02, a: 1 },
          storeOp: 'store'
        }
      ]
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(3);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  private writeUniforms(time: number) {
    this.uniformData.fill(0);
    this.writeVec4(0, this.canvas.width, this.canvas.height, time, this.selectedIndex);
    this.writeVec4(1, CAMERA_POSITION[0], CAMERA_POSITION[1], CAMERA_POSITION[2], 0);
    this.writeVec4(2, this.cameraRight[0], this.cameraRight[1], this.cameraRight[2], this.getViewportFovScale());
    this.writeVec4(3, this.cameraUp[0], this.cameraUp[1], this.cameraUp[2], 0);
    this.writeVec4(4, this.cameraForward[0], this.cameraForward[1], this.cameraForward[2], SPHERE_COUNT);
    this.spheres.forEach((sphere, index) => {
      const base = 5 + index * 2;
      this.writeVec4(base, sphere.position[0], sphere.position[1], sphere.position[2], sphere.radius);
      this.writeVec4(base + 1, sphere.color[0], sphere.color[1], sphere.color[2], sphere.material);
    });
  }

  private writeVec4(index: number, x: number, y: number, z: number, w: number) {
    const offset = index * FLOATS_PER_VEC4;
    this.uniformData[offset] = x;
    this.uniformData[offset + 1] = y;
    this.uniformData[offset + 2] = z;
    this.uniformData[offset + 3] = w;
  }

  private renderMock() {
    if (!this.mockContext) {
      return;
    }
    const ctx = this.mockContext;
    const { width, height } = this.canvas;
    ctx.clearRect(0, 0, width, height);
    const background = ctx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, '#090d13');
    background.addColorStop(0.58, '#151719');
    background.addColorStop(1, '#080807');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const floorY = height * 0.72;
    ctx.fillStyle = '#242321';
    ctx.fillRect(0, floorY, width, height - floorY);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.055)';
    ctx.lineWidth = 1;
    for (let x = -width; x < width * 2; x += width / 14) {
      ctx.beginPath();
      ctx.moveTo(x, height);
      ctx.lineTo(width * 0.5 + (x - width * 0.5) * 0.2, floorY);
      ctx.stroke();
    }

    const projected = this.spheres
      .map((sphere, index) => ({ sphere, index, projected: this.project(sphere.position) }))
      .filter((item) => item.projected.visible)
      .sort((a, b) => b.projected.depth - a.projected.depth);

    projected.forEach(({ sphere, index, projected: point }) => {
      const radius = Math.max(8, sphere.radius * point.scale);
      const shadowScale = clamp(1.2 - sphere.position[1] * 0.2, 0.35, 1.2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.beginPath();
      ctx.ellipse(point.x + radius * 0.34, floorY + 8, radius * 1.15 * shadowScale, radius * 0.26 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      const gradient = ctx.createRadialGradient(
        point.x - radius * 0.35,
        point.y - radius * 0.45,
        radius * 0.1,
        point.x,
        point.y,
        radius
      );
      const rgb = sphere.color.map((value) => Math.round(value * 255));
      gradient.addColorStop(0, sphere.material === 3 ? '#fff6cc' : 'rgba(255, 255, 255, 0.95)');
      gradient.addColorStop(0.18, `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`);
      gradient.addColorStop(1, sphere.material === 1 ? '#1d2024' : '#121416');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
      if (sphere.material === 1 || sphere.material === 2) {
        ctx.strokeStyle = sphere.material === 1 ? 'rgba(255, 255, 255, 0.72)' : 'rgba(190, 220, 255, 0.42)';
        ctx.lineWidth = Math.max(1, radius * 0.04);
        ctx.beginPath();
        ctx.arc(point.x - radius * 0.14, point.y - radius * 0.08, radius * 0.62, -0.55, 0.95);
        ctx.stroke();
      }
      if (index === this.selectedIndex) {
        ctx.strokeStyle = 'rgba(170, 220, 255, 0.95)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }

  private drawUnsupported(message: string) {
    this.status = 'unsupported';
    this.stop();
    this.resizeCanvas();
    const context = this.canvas.getContext('2d', { alpha: false });
    if (!context) {
      this.status = 'error';
      return;
    }
    const { width, height } = this.canvas;
    context.fillStyle = '#050607';
    context.fillRect(0, 0, width, height);
    context.fillStyle = 'rgba(255, 255, 255, 0.82)';
    context.font = `${Math.max(16, Math.round(width / 72))}px Inter, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('WebGPU unavailable', width / 2, height / 2 - 16);
    context.fillStyle = 'rgba(255, 255, 255, 0.48)';
    context.font = `${Math.max(12, Math.round(width / 110))}px Inter, sans-serif`;
    context.fillText(message, width / 2, height / 2 + 18);
    this.fpsLabel.textContent = 'FPS --';
    this.syncTestState();
  }

  private rayFromPointer(clientX: number, clientY: number): Ray {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const y = ((clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1;
    const aspect = rect.width / Math.max(1, rect.height);
    const fovScale = this.getViewportFovScale();
    const direction = normalize(add(
      add(this.cameraForward, scale(this.cameraRight, x * aspect * fovScale)),
      scale(this.cameraUp, -y * fovScale)
    ));
    return {
      origin: CAMERA_POSITION,
      direction
    };
  }

  private pickSphere(ray: Ray): HitRecord | null {
    let closest: HitRecord | null = null;
    this.spheres.forEach((sphere, index) => {
      const oc = subtract(ray.origin, sphere.position);
      const halfB = dot(oc, ray.direction);
      const c = dot(oc, oc) - sphere.radius * sphere.radius;
      const discriminant = halfB * halfB - c;
      if (discriminant < 0) {
        return;
      }
      const root = Math.sqrt(discriminant);
      let distance = -halfB - root;
      if (distance < 0.01) {
        distance = -halfB + root;
      }
      if (distance < 0.01) {
        return;
      }
      if (!closest || distance < closest.distance) {
        closest = { index, distance };
      }
    });
    return closest;
  }

  private project(position: Vec3) {
    const relative = subtract(position, CAMERA_POSITION);
    const x = dot(relative, this.cameraRight);
    const y = dot(relative, this.cameraUp);
    const depth = dot(relative, this.cameraForward);
    if (depth <= 0.1) {
      return { visible: false, x: 0, y: 0, scale: 0, depth };
    }
    const scaleAmount = this.canvas.height / (2 * this.getViewportFovScale() * depth);
    return {
      visible: true,
      x: this.canvas.width / 2 + x * scaleAmount,
      y: this.canvas.height / 2 - y * scaleAmount,
      scale: scaleAmount,
      depth
    };
  }

  private syncTestState() {
    window.__RT_DEMO_STATE__ = {
      status: this.status,
      selectedIndex: this.selectedIndex,
      frameCount: this.frameCount,
      fps: this.fps,
      spheres: this.spheres.map((sphere) => ({
        x: sphere.position[0],
        y: sphere.position[1],
        z: sphere.position[2],
        radius: sphere.radius,
        material: sphere.material
      }))
    };
  }

  private getViewportFovScale() {
    const rect = this.canvas.getBoundingClientRect();
    const aspect = rect.width / Math.max(1, rect.height);
    return FOV_SCALE * (aspect < 0.82 ? 0.82 / Math.max(0.32, aspect) : 1);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new RtDemoApp();
  app.init().catch((error) => {
    console.error('[RT Demo] Fatal initialization error:', error);
  });
});

export {};
