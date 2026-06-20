# Local Assistant

## Overview

The Local Assistant runs a small language model entirely in the browser using WebGPU acceleration via Hugging Face's Transformers.js library. It provides a chat interface where messages are processed locally — no data is sent to any server. The model runs in a Web Worker to keep the UI responsive during inference.

## Architecture

```
Main thread (LocalLlmUtility)
  |
  +-- local-llm-worker.js (Web Worker)
        |
        +-- @huggingface/transformers (dynamic import)
              |
              +-- WebGPU backend
```

- **Main thread** (`local-llm-chat.js`): `LocalLlmUtility` class manages the chat UI, message history, streaming display, and worker communication.
- **Worker** (`local-llm-worker.js`): Loads the model, handles generation, streams tokens back to the main thread.
- **Transformers.js** (`@huggingface/transformers@4.2.0`): Dynamically imported from CDN. Provides the `pipeline('text-generation')` API with WebGPU device support.
- **Cache layer** (`local-llm-cache.js`): Manages browser Cache API for model file persistence.
- **Rendering** (`local-llm-rendering.js`): HTML escaping and safe text rendering for chat messages.

## Model Configuration

From `local-llm-config.js`:

| Setting | Value |
|---------|-------|
| Model ID | `onnx-community/Bonsai-1.7B-ONNX` |
| Display name | Bonsai 1.7B |
| Size | ~290 MB |
| Runtime | Transformers.js WebGPU |
| Device | `webgpu` |
| Dtype | `q1` (quantized) |
| Max new tokens | 512 |
| Temperature | 0.9 |
| Top-k | 40 |
| Top-p | 0.95 |
| Repetition penalty | 1.0 |
| Max input chars | 1800 |
| Max message chars | 2500 |
| Max history messages | 48 |

The model is loaded from the Hugging Face CDN (`cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0`) and cached in the browser's Cache API for faster subsequent loads.

## Worker Lifecycle

### States

Defined in `WORKER_STATE` (`local-llm-config.js`):

| State | Description |
|-------|-------------|
| `idle` | No model loaded. User must click "Load". |
| `checking` | Probing WebGPU support. |
| `loading` | Downloading model files from Hugging Face. |
| `optimizing` | Warming up the model on WebGPU (running a single token generation). |
| `ready` | Model is loaded and ready to generate. |
| `thinking` | Prompt is being processed (prefill phase). |
| `streaming` | Tokens are being generated and streamed. |
| `error` | A recoverable error occurred. |
| `unsupported` | WebGPU is unavailable in this browser. |
| `disposed` | Model was unloaded (e.g. on page hide). |

### Loading sequence

1. User clicks "Load" button
2. Worker receives `{ type: 'load' }` message
3. Worker probes WebGPU availability via `probeWebGpu()`
4. If available, dynamically imports `@huggingface/transformers`
5. Creates a `text-generation` pipeline with the Bonsai model, `device: 'webgpu'`, `dtype: 'q1'`
6. Progress callbacks during download are forwarded to the main thread
7. After loading, a warmup generation (`max_new_tokens: 1` on input `"a"`) compiles the WebGPU shaders
8. Worker sends `{ type: 'ready' }` — model is ready

### Generation flow

1. User sends a message
2. Main thread compacts the message history via `compactMessages()` in the worker
3. Worker sends `{ type: 'start' }` — main thread shows typing indicator
4. Worker runs `generator(conversation, { ... })` with:
   - `TextStreamer` for token-by-token streaming
   - `InterruptableStoppingCriteria` for user cancellation
   - `DynamicCache` for past key-values
5. Tokens are batched (4 tokens or 100ms timeout) before sending to main thread
6. Each token message includes `tps` (tokens per second) and `numTokens`
7. On completion, `{ type: 'complete' }` is sent with the full text

### Context management

The `compactMessages()` function in the worker enforces context window limits:

- **Context limit**: 8192 tokens (fallback from model config)
- **Reserved tokens**: 512 for generation + 256 safety buffer
- **Effective input tokens**: 3072
- **Per-message overhead**: 14 tokens (formatting tokens)
- **Max input per message**: 1200 tokens

Strategy:
1. Keep the latest user message (truncated to 1200 tokens if needed)
2. Pack in as many prior messages as fit in the remaining budget
3. Drop oldest messages first
4. If still over budget, truncate the latest message further
5. Ensure conversation starts with a user message (no orphan assistant messages)

### Interruption

When the user sends a new message while the model is generating:
1. Main thread sends `{ type: 'interrupt' }` or `{ type: 'cancel' }`
2. Worker increments the `activeGeneration` counter (invalidating the current generation)
3. `stoppingCriteria.interrupt()` is called
4. Past key-values cache is disposed
5. Worker sends `{ type: 'interrupted' }` back to main thread

### Disposal

On page hide or tab switch:
1. `endModelSession()` is called
2. Worker receives `{ type: 'dispose' }`
3. Generator is disposed, transformers module is cleared
4. If `clearCache: true`, the Cache API entries for the model are deleted
5. Worker sends `{ type: 'disposed' }` — main thread resets to idle state

## UI Components

The `LocalLlmUtility` class builds its UI via `innerHTML` in the `mount()` method:

- **Header**: Title, status chip, model name link, backend label, tokens/sec display
- **Transcript**: Scrollable message list with a live region for accessibility
- **Center panel**: Loading progress bar, model notes, diagnostics panel
- **Form**: Load button, textarea input (auto-resizing), send button, char count
- **Ready prompts**: Rotating suggestions shown when the model is idle and ready

### Diagnostics panel

Shown on errors. Displays:
- Error category and message
- Detailed error information
- Retry button
- Clear cache button (deletes cached model files)

## File Reference

| File | Purpose |
|------|---------|
| `local-llm-chat.js` | `LocalLlmUtility` class — main thread UI controller |
| `local-llm-worker.js` | Web Worker — model loading, generation, streaming, context management |
| `local-llm-config.js` | Model configuration, generation parameters, state definitions |
| `local-llm-cache.js` | Cache API management for model file persistence |
| `local-llm-rendering.js` | HTML escaping and safe text rendering utilities |
| `local-llm-mock-worker.js` | Mock worker for testing without a real model |

## Requirements

- **WebGPU**: Required for model inference. Not available in all browsers.
- **HTTPS or localhost**: Module workers require a secure context.
- **Network access**: Model files are downloaded from Hugging Face CDN on first load.
- **Memory**: ~290 MB for the quantized model + runtime overhead.
- **GPU memory**: WebGPU device must have sufficient VRAM for the model.
