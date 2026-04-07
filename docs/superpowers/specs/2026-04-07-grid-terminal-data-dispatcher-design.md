# Grid Terminal Data Dispatcher

**Date:** 2026-04-07
**Status:** Design

## Problem

Grid mode feels laggy when terminal output is streaming. Reproduced subjectively with 5 tiles open and 2 sessions actively streaming.

## Root Cause

Each `TerminalPanel` mounts `useTerminal`, which calls `cccAPI.terminal.onData(...)`. The current preload implementation (`src/preload/index.ts:25-35`) registers a fresh `ipcRenderer.on('terminal:data', ...)` listener per call. Every `terminal:data` IPC event therefore wakes **every** mounted listener, and each listener filters by `sessionId` (`src/renderer/hooks/useTerminal.ts:201-205`).

With N tiles open and K streaming, every chunk does N callback invocations and N string compares — O(N) wasted work per chunk, O(N·K) total per unit time. With 5 tiles and 2 streamers, that's ~5× more renderer main-thread work than necessary on the hot path. xterm itself is fast; the bottleneck is fan-out before xterm sees the data.

## Fix

Single dispatcher in the **preload** layer: one root `ipcRenderer.on('terminal:data')` listener routes chunks to per-session callbacks via a `Map`. Filter as early as possible — before crossing the context bridge boundary into renderer code.

### Change 1 — Preload dispatcher (`src/preload/index.ts`)

Replace the current `terminal.onData` with a module-level singleton:

- `Map<string, Set<(data: string) => void>>` keyed by sessionId.
- Lazy install: on first subscribe, register a single `ipcRenderer.on('terminal:data', (_e, id, data) => { ... })` that looks up the Set for `id` and invokes each callback with `data` only.
- New signature: `onData(sessionId: string, callback: (data: string) => void): () => void`.
- Unsubscribe removes the callback from its Set; if the Set becomes empty, delete the map entry. The root listener is left installed (cheap, avoids churn).

### Change 2 — useTerminal callsite (`src/renderer/hooks/useTerminal.ts:201`)

```ts
const unsubData = window.cccAPI.terminal.onData(sessionId, (data) => {
  terminal.write(data)
})
```

The `if (id === sessionId)` filter is removed — routing is now upstream.

### Change 3 — Type update

Update the `cccAPI.terminal.onData` type wherever it's declared to match the new signature.

## What this fixes

- 2 streaming sessions in a 5-tile grid: each chunk wakes exactly 1 callback instead of 5. Renderer-side work on the streaming path drops ~5×.
- Scales linearly with active streamers, not quadratically with total tiles.
- Zero added latency — purely removes wasted work. Honors the "match native terminal feel" rule.
- No behavior change for single-session view.

## Out of Scope

- Main-side batching/coalescing of `pty.onData` chunks. Adds latency; revisit only if dispatcher fix proves insufficient.
- WebGL context count (one per tile). Baseline cost, not load-correlated with streaming.
- Grid drag/resize lag (ResizeObserver cascades). Different problem, different fix.

## Risks

- **Callsite audit:** Confirmed only one renderer callsite (`useTerminal.ts:201`). No other consumers to update.
- **Cleanup correctness:** When a `useTerminal` effect re-runs for the same sessionId, the new effect subscribes before the old cleanup runs (or vice versa). Standard `Set<callback>` semantics handle this as long as each unsubscribe closure removes the exact callback reference it added.
- **Listener leak:** If the renderer somehow re-imports preload, a second root listener could be installed. Mitigated by the lazy-install guard (boolean flag at module scope).

## Verification

- Manual: open grid with 5 sessions, stream output in 2, confirm subjective lag is gone.
- Functional: single-session view still works; switching tiles still works; cleanup on unmount leaves no dangling callbacks (check `Map` is empty after closing all tiles, e.g. via a temporary debug log).
