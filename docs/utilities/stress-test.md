# Stress Test

## Overview

The Stress Test utility saturates the browser's CPU and/or GPU to measure thermal and performance behavior. It runs continuous computational workloads in Web Workers (CPU) and GPU shaders (GPU), reporting real-time metrics like FPS, dropped frames, worker count, and iteration counts.

Users can select CPU-only, GPU-only, or combined stress modes.

## Architecture

```
Main thread (StressTestController)
  |
  +-- stressTest.worker.ts (Web Workers, xN for CPU)
  |
  +-- WebGPU / WebGL2 / WebGL1 (GPU canvas rendering)
```

- **Controller** (`stressTestController.ts`): `StressTestController` manages start/stop, mode selection, worker lifecycle, GPU stress coordination, and metric reporting.
- **CPU workers** (`stressTest.worker.ts`): Each worker runs a tight loop of math operations, sending heartbeats with iteration counts.
- **GPU stress** (`stressTestGpu.ts`): Adaptive GPU workload that scales based on frame timing. Supports WebGPU compute shaders, WebGL2 fragment shaders, and WebGL1 fragment shaders.

## CPU Stress

### Worker workload

Each CPU worker (`stressTest.worker.ts`) runs a continuous loop:

```javascript
checksum = Math.sin(checksum + iterations) * Math.cos(checksum * 1.000001) + Math.sqrt(Math.abs(checksum) + 1);
checksum = ((checksum % 1) + 1) % 1;
iterations += 1;
```

Workers run in **90ms chunks** to avoid fully blocking the event loop. After each chunk, they yield via a `MessageChannel` post (cooperative scheduling), then resume.

### Heartbeat protocol

Every 250ms, workers send a `cpu-stress-heartbeat` message with:
- `iterations`: cumulative iteration count
- `checksum`: current checksum value (prevents compiler optimization)
- `requestId`: matches the active stress session
- `workerIndex`: identifies which worker

The controller aggregates iterations across all workers and displays the total.

### Worker count

`resolveCpuWorkerCount()` in `stressTestCore.ts`:
- Uses `navigator.hardwareConcurrency` as the base
- Capped at `MAX_CPU_WORKERS = 64`
- Can be overridden via `window.__OD_STRESS_TEST_MAX_WORKERS__` (debug hook)

## GPU Stress

### Backend selection

`startAdaptiveGpuStress()` tries backends in priority order:

| Backend | Type | Description |
|---------|------|-------------|
| `webgpu-compute` | WebGPU | Compute shader + fragment shader rendering |
| `webgl2-fragment` | WebGL2 | Fragment shader with main-thread compute bursts |
| `webgl1-fragment` | WebGL1 | Fragment shader fallback |

If no backend is available, GPU stress fails gracefully.

### WebGPU compute shader

The compute shader (`stressTestGpu.ts`) runs 256-workgroup-size threads that:
1. Read from a 262,144-element f32 storage buffer
2. Perform 256 iterations of `sin * cos + sqrt` operations per thread
3. Write results back as `fract(value)`

A separate render pipeline draws a shader-generated fractal visualization using a fragment shader with 128 iterations of trigonometric operations.

### WebGL fragment shaders

For WebGL1/WebGL2, the GPU stress uses a fragment shader that renders a fullscreen triangle with compute-heavy pixel operations. The main thread performs additional JavaScript compute bursts (capped at 18ms) to supplement the GPU workload.

### Adaptive scaling

`AdaptiveGpuWorkScaler` dynamically adjusts the workload level:

| Parameter | Value | Description |
|-----------|-------|-------------|
| `initialLevel` | 2048 | Starting workload level |
| `fastMs` | 12ms | Threshold for "fast" completion |
| `slowMs` | 120ms | Threshold for "slow" completion |
| `aggressiveGrowthMultiplier` | 1.75x | Growth when consistently fast |
| `steadyGrowthMultiplier` | 1.3x | Growth for normal completion |
| `slowBackoffMultiplier` | 0.78x | Reduction when slow |
| `errorBackoffMultiplier` | 0.35x | Reduction on errors |

The scaler tracks completion times:
- If a frame completes in < 12ms, it counts as "fast". After enough fast samples, the level grows aggressively.
- If a frame takes > 120ms, the level is reduced by the slow backoff multiplier.
- Normal completions get steady growth.
- GPU errors trigger aggressive backoff.

## Stress Modes

| Mode | CPU workers | GPU stress |
|------|-----------|------------|
| `cpu` | Yes | No |
| `gpu` | No | Yes |
| `both` | Yes | Yes |

Mode can only be changed when the stress test is idle (not running or starting).

## State Machine

From `transitionStressState()` in `stressTestCore.ts`:

```
idle --start--> starting --running--> running
running --stop--> stopping --stopped--> idle
starting/running --error--> error
starting/running --unsupported--> unsupported
error/unsupported --retry--> starting
```

## Metrics

The controller reports these metrics every 250ms:

| Metric | Source |
|--------|--------|
| Elapsed | Time since start |
| Workers | Active CPU worker count |
| GPU | Active GPU backend (or "none") |
| FPS | Frames per second from GPU render loop |
| Dropped | Frames dropped by the GPU |
| CPU iterations | Aggregated iteration count from all workers |

Metric visibility adapts to viewport height — less relevant metrics are hidden first when space is constrained. The hide order differs per mode:
- CPU mode: hides GPU-related metrics first
- GPU mode: hides CPU-related metrics first
- Both mode: hides dropped frames first

## Visual feedback

### CPU-only mode

When only CPU stress is active (no GPU backend), the controller draws a **thermal node visualization** on the canvas — 42 animated circles that pulse based on CPU load.

### GPU mode

The GPU stress shader renders its own visualization (fractal patterns for WebGPU, shader patterns for WebGL).

### Idle state

A simple idle screen is drawn when no stress is active.

## Cleanup and safety

- Stress automatically stops when the utility tab is deactivated
- Stress stops on page hide
- `prefers-reduced-motion` stops CPU visuals but not the workload itself
- Workers are terminated (not gracefully stopped) on shutdown
- GPU contexts are lost on shutdown with `loseContext: true`
- All animation frames and timers are cancelled on dispose

## File Reference

| File | Purpose |
|------|---------|
| `stressTestController.ts` | Main controller: start/stop, mode, workers, GPU coordination, metrics |
| `stressTestCore.ts` | State machine, worker count resolution, GPU backend detection, time formatting |
| `stressTestGpu.ts` | GPU stress backends (WebGPU/WebGL2/WebGL1), adaptive workload scaler |
| `stressTest.worker.ts` | CPU stress worker: math loop, heartbeat protocol |
| `stressTestWorkerTypes.ts` | Worker message type definitions |

## Requirements

- **Web Workers**: Required for CPU stress (module workers specifically)
- **WebGPU / WebGL2 / WebGL1**: At least one required for GPU stress
- **GPU memory**: WebGPU compute uses a 1MB storage buffer + render pipeline resources
