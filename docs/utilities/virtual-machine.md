# Virtual Machine

## Overview

The Virtual Machine utility runs a full x86 PC emulator inside the browser using v86, booting a custom Tiny Core Linux 11 ISO. It provides a complete Linux terminal environment with optional network access through a WebSocket-based TCP relay. Sessions are ephemeral — everything is wiped when the tab closes.

## Architecture

```
Main thread (RetroVmController)
  |
  +-- v86 (WebAssembly x86 emulator)
        |
        +-- SeaBIOS (firmware)
        |
        +-- Tiny Core Linux 11 (guest OS)
        |
        +-- TCP relay (vm-proxy.oliverdougherty.com)
```

- **Controller** (`retroVmController.ts`): `RetroVmController` class manages the VM lifecycle — boot, shutdown, reset, clipboard paste, fullscreen, mouse capture.
- **v86**: WebAssembly-based x86 emulator loaded from `pages/utilities/assets/v86.wasm`. Emulates CPU, VGA, keyboard, mouse, and network.
- **SeaBIOS**: Open-source BIOS implementation (`seabios.bin`) that boots the guest OS.
- **Tiny Core Linux 11**: Custom 22 MB ISO with Firefox stripped, retaining curl and neofetch.
- **TCP relay**: Cloudflare Worker at `vm-proxy.oliverdougherty.com` that bridges guest TCP connections over WISP (WebSocket Internet Stream Protocol).

## VM Configuration

From `retroVmConfig.ts`:

| Setting | Value |
|---------|-------|
| Distro | Tiny Core Linux 11 |
| ISO size | 23,279,616 bytes (~22 MB) |
| Memory | 768 MB |
| VGA memory | 16 MB |
| Boot order | 0x210 (CD-ROM first, disk fallback) |
| Boot menu prompt | `/Press ENTER to boot/i` |
| Boot menu delay | 4000ms |
| Max clipboard paste | 2048 chars |
| NIC type | NE2000 |
| DNS method | DoH (Cloudflare) |
| MTU | 1500 |
| Relay URL | `wisps://vm-proxy.oliverdougherty.com/wisp/` |

### v86 Options

`buildRetroVmV86Options()` constructs the full v86 configuration:
- `screen_container`: DOM element for the VM display
- `wasm_path`: Path to `v86.wasm`
- `bios` / `vga_bios`: URLs to firmware binaries
- `cdrom`: ISO URL with pre-declared size
- `autostart: true`: Boot immediately after loading
- `disable_mouse: true`: Mouse is handled by the custom mouse bridge, not v86's built-in handler
- `net_device`: NE2000 NIC with TCP relay (when network is enabled)

### Config overrides

The HTML page embeds a `<script type="application/json" id="retroVmConfig">` block that can override copy text and network settings. `resolveRetroVmConfigFromDataset()` merges these overrides with the default config.

## Support Detection

`detectRetroVmSupport()` in `retroVmSupport.ts` checks:

1. **Window and document** must exist (no SSR)
2. **WebAssembly** must be available
3. **Web Workers** must be available
4. **Not mobile-like**: Detected via `(pointer: coarse)` media query OR (touch points > 0 AND viewport < 900px)
5. **Fullscreen** support (degraded if unavailable)
6. **Pointer lock** support (degraded if unavailable — falls back to absolute mouse positioning)

Returns a `RetroVmSupport` object with `supported`, `reason`, `isMobileLike`, `hasFullscreen`, `hasPointerLock`.

## Mouse and Input

### Mouse bridge (`RetroVmMouseBridge`)

Custom mouse handling that supports both pointer lock and absolute positioning:

- **Absolute mode** (default): Mouse moves within the VM viewport are converted to guest coordinates. Clicking requests pointer lock.
- **Pointer lock mode**: After clicking into the VM, the cursor is captured. Mouse movement is reported as relative deltas. Escape releases the lock.
- **Touch support**: Touch events are mapped to absolute mouse positions. Touch start requests pointer lock.
- **Scroll wheel**: Mapped to mouse wheel events sent to the guest.
- **Right-click**: Context menu is prevented; button events are forwarded.

### Keyboard

v86 handles keyboard input directly through its built-in keyboard handler. The controller sends scancodes during boot to auto-press Enter at the SeaBIOS boot menu.

### Clipboard paste

The "Paste" button reads from the clipboard API, shows a confirmation modal, then sends the text as scancodes to the guest. Limited to 2048 characters.

## VM Lifecycle

### States

From `retroVmTypes.ts` and `transitionRetroVmState()`:

| State | Description |
|-------|-------------|
| `idle` | No VM running. Ready to launch. |
| `loading` | Downloading v86 WASM and guest ISO. |
| `running` | VM is booted and operational. |
| `fullscreen` | VM display is in fullscreen mode. |
| `resetting` | Destroying current VM instance. |
| `error` | Launch or runtime failure. |
| `unsupported` | Browser doesn't meet requirements. |

### State transitions

```
idle --launch--> loading --ready--> running --enter-fullscreen--> fullscreen
running --exit-fullscreen--> running
running --reset--> resetting --reset-complete--> idle
* --error--> error
* --unsupported--> unsupported
```

### Boot process

1. User clicks "Launch"
2. Controller transitions to `loading` state
3. v86 downloads `v86.wasm`, `seabios.bin`, `vgabios.bin`, and the ISO
4. Progress is reported via `download-progress` events
5. v86 boots SeaBIOS, which presents a boot menu
6. Controller sends Enter key after 900ms to auto-select the CD-ROM boot option
7. Tiny Core Linux boots
8. Controller transitions to `running` state

### Reset

The "Wipe" button destroys the current v86 instance and clears all state. A fresh launch starts from scratch — no persistent state survives.

## Network

### TCP relay

When network is enabled, the VM uses a NE2000 NIC connected to a TCP relay at `vm-proxy.oliverdougherty.com`. The relay:
- Accepts WISP (WebSocket Internet Stream Protocol) connections
- Forwards guest TCP traffic to the internet
- Uses DoH (DNS over HTTPS) via Cloudflare for DNS resolution
- Supports MTU 1500

### Fallback modes

- `vmNetworkEnabled` can be set to `"false"` in the config to disable networking
- When offline, the VM falls back to clipboard-paste-only mode
- The UI badge shows "Network relay" (online) or "Local only" (offline)

## File Reference

| File | Purpose |
|------|---------|
| `retroVmController.ts` | Main controller: VM lifecycle, mouse bridge, clipboard, fullscreen |
| `retroVmConfig.ts` | Default VM config, v86 options builder, dataset config parsing |
| `retroVmSupport.ts` | Browser support detection, progress formatting, status view resolution |
| `retroVmTypes.ts` | Type definitions for config, state, progress, support |
| `v86-shim.d.ts` | TypeScript declarations for v86 library |

## Assets

| Asset | Location | Purpose |
|-------|----------|---------|
| `v86.wasm` | `pages/utilities/assets/v86.wasm` | v86 emulator WebAssembly binary |
| `v86-fallback.wasm` | `pages/utilities/assets/v86-fallback.wasm` | Fallback WASM build |
| `libv86.js` | `pages/utilities/assets/libv86.js` | v86 JavaScript library |
| `seabios.bin` | `assets/utilities/vm/seabios.bin` | SeaBIOS firmware |
| `vgabios.bin` | `assets/utilities/vm/vgabios.bin` | VGA BIOS firmware |
| `tinycore-retro-vm.iso` | `assets/utilities/vm/tinycore-retro-vm.iso` | Custom Tiny Core Linux ISO |

## Requirements

- **WebAssembly**: Required for v86 emulator
- **Web Workers**: Required by v86
- **Desktop browser**: Mobile-like devices (touch + narrow screen) are blocked
- **Pointer Lock API**: Preferred for mouse capture (falls back to absolute positioning)
- **Fullscreen API**: Preferred for immersive mode
- **Memory**: ~300 MB+ for v86 runtime + 768 MB guest RAM allocation
- **Network**: Required for initial ISO/WASM download; TCP relay for guest networking
