# Terminal Image Paste — Design

**Date:** 2026-04-07
**Status:** Approved for planning

## Problem

CCC2 wraps `claude` in an xterm.js terminal over node-pty. The official Claude Code CLI supports pasting screenshots from the clipboard (Ctrl/Cmd+V → image auto-saved to a temp file → path inserted into the prompt). In CCC2 this doesn't work: Ctrl+V inside xterm.js just sends `\x16` bytes to the PTY, and the `claude` process inside the forwarded PTY cannot reach the host OS clipboard. Users must currently save screenshots manually and type the path.

Verified current state: `src/main/ipc/clipboard.ts` only exposes `clipboard:write-text` (used for copy-on-select in `useTerminal.ts`). No paste event listener, no `image/*` clipboard reading, no temp-file injection exists anywhere in the renderer or main process.

## Goal

Restore parity with the native CLI paste experience for local sessions: user hits Ctrl/Cmd+V with an image on the clipboard, and the absolute path to a freshly written temp file appears in the prompt so `claude` can read it.

## Non-Goals (v1)

- Remote (SSH) session image paste — the PTY lives on another host, so a local temp path is meaningless there. The handler is structured so an SCP-based follow-up can slot in later.
- Drag-and-drop image support.
- Cleanup of old temp files — `os.tmpdir()` is OS-managed.
- Multi-image paste — v1 handles the first image on the clipboard; additional items are ignored.

## Architecture

Renderer-side interception in `src/renderer/hooks/useTerminal.ts` via xterm's `attachCustomKeyEventHandler`. On Ctrl/Cmd+V the handler asynchronously inspects the clipboard, branches on content type, and either forwards an image to a new main-process IPC or falls through to normal text paste.

### Components

1. **`clipboard:write-image` IPC** (main)
   - Location: `src/main/ipc/clipboard.ts`
   - Signature: `(bytes: Uint8Array, ext: 'png' | 'jpg') => Promise<string>`
   - Behavior: writes `os.tmpdir()/ccc-paste-<timestamp>.<ext>` and returns the absolute path.

2. **Preload bridge**
   - Location: `src/preload/index.ts`
   - Adds `cccAPI.clipboard.writeImage(bytes, ext): Promise<string>` alongside the existing `writeText`.

3. **Paste handler in `useTerminal.ts`**
   - Registers a custom key event handler on the xterm instance that intercepts V with Ctrl (Linux/Win) or Cmd (macOS).
   - On match, kicks off an async helper and returns `false` only when we have committed to handling the paste ourselves; otherwise returns `true` so xterm's normal paste path runs.
   - Async helper flow:
     1. Look up the active session; if remote, return without interception (normal text paste).
     2. `navigator.clipboard.read()` → find the first `image/png` or `image/jpeg` item.
     3. If no image → return without interception.
     4. If image → read blob to `Uint8Array`, call `cccAPI.clipboard.writeImage`, receive path, write `path + ' '` to the PTY via the existing `terminal:write` IPC.
     5. On any error (permission denied, write failure) → surface a toast and fall through to normal text paste.

4. **Remote session detection** — reuse the existing session/host metadata already in the Zustand store (`session-store.ts`). Sessions with a non-local `hostId` are treated as remote.

5. **Error UX** — reuse the existing `ToastContainer` component (`src/renderer/components/ToastContainer.tsx`) for error surfacing. No new notification infra.

### Data Flow

```
Ctrl/Cmd+V
  → xterm custom key handler (useTerminal.ts)
  → async clipboard.read()
  → cccAPI.clipboard.writeImage(bytes, ext)
  → main: fs.writeFile(os.tmpdir()/ccc-paste-<ts>.<ext>)
  → returns absolute path
  → terminal:write IPC (path + ' ')
  → PTY
  → claude reads the path from the prompt
```

## Trigger Semantics

- Key: `Ctrl+V` on Linux/Windows, `Cmd+V` on macOS. Matches native CLI muscle memory.
- Always intercepts at the handler level; decision to swallow vs. fall through is made inside the async helper based on clipboard contents and session type.
- Text paste path is preserved: when the clipboard has no image, xterm's built-in paste runs unchanged.

## Error Handling

| Condition | Behavior |
|---|---|
| Clipboard permission denied | Toast: "Clipboard access denied". Fall through to text paste. |
| No image on clipboard | Silent fall through (normal text paste). |
| Temp file write failure | Toast: "Failed to save pasted image". Fall through to text paste. |
| Remote session | Silent fall through. (Documented future work.) |
| Success | No toast. Path in the prompt is the feedback. |

## Testing

Manual verification (no automated tests — terminal/clipboard integration is hard to unit-test meaningfully):

1. Local session, screenshot on clipboard → Ctrl/Cmd+V → path appears in prompt; `claude` reads the image.
2. Local session, text on clipboard → Ctrl/Cmd+V → normal text paste works unchanged.
3. Local session, empty clipboard → Ctrl/Cmd+V → no error, no-op.
4. Remote session, screenshot on clipboard → Ctrl/Cmd+V → falls through (text paste or no-op), no error.
5. Deny clipboard permission in Electron → Ctrl/Cmd+V with image → toast appears, no crash.
6. Paste image while user has text typed mid-prompt → path is appended at cursor without clobbering existing input.

## Future Work

- **Remote image paste via SCP:** When the active session is remote, upload the image over the session's existing SSH ControlMaster connection to the remote `/tmp`, then inject the remote path. The v1 handler's "get a usable path for the PTY" step becomes a strategy with local and remote implementations.
- **Drag-and-drop** onto the terminal as a complementary trigger.
