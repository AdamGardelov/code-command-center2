# Clipboard & URL Handling Design

## Problem

1. **Ctrl+V** — Electron/browser intercepts paste as a browser event. If clipboard has an image, it sends image data to xterm instead of text, causing errors
2. **Ctrl+Shift+V** — Claude Code CLI sees the paste event but text doesn't arrive properly (bracketed paste mode issue between xterm.js and PTY)
3. **Image paste** — No support for pasting images to Claude Code sessions
4. **URL clicking** — WebLinksAddon is loaded but may not work; needs verification

Selection-to-clipboard (auto-copy) already works via `onSelectionChange`.

## Design

### 1. Text Paste

Intercept `Ctrl+V` and `Ctrl+Shift+V` via `attachCustomKeyEventHandler` on the xterm instance:

- Read text from clipboard via new IPC call `clipboard:read-text`
- Wrap in bracketed paste sequences (`\x1b[200~` ... `\x1b[201~`)
- Write directly to PTY via existing `terminal:write`

Files: `useTerminal.ts` (key handler), `clipboard.ts` (IPC handler), `preload/index.ts` (bridge), `types.ts` (API types)

### 2. Image Paste

Same interceptor checks if clipboard contains an image (via new IPC call `clipboard:read-image`):

- Save image as PNG to `~/.ccc/tmp/paste-{timestamp}.png`
- Write the file path as plain text to PTY (no bracketed paste, just the path string)
- Claude Code can then read the file as image input

**Priority:** If clipboard has both text and image, prioritize text (common when copying from web).

Files: `clipboard.ts` (image read + temp file save), `useTerminal.ts` (paste logic)

### 3. Temp File Cleanup

- `~/.ccc/tmp/` created on demand (first image paste)
- On session close: remove temp files created by that session (tracked in a Set per session in the clipboard IPC module)
- On app start: clear entire `~/.ccc/tmp/` as fallback for crashes/unfinished sessions

Files: `clipboard.ts` (per-session tracking), `main/index.ts` (app-start cleanup), `session-manager.ts` (session-close cleanup)

### 4. URL Clicking

WebLinksAddon is already loaded with `shell.openExternal()` handler. Verify it works during implementation — if broken, fix the addon configuration. If it works, leave as-is.

Files: `useTerminal.ts` (if fix needed)

## File Changes Summary

| File | Change |
|------|--------|
| `src/main/ipc/clipboard.ts` | Add `clipboard:read-text` and `clipboard:read-image` handlers, temp file management |
| `src/preload/index.ts` | Expose `readText()` and `readImage()` in `cccAPI.clipboard` |
| `src/shared/types.ts` | Update `CccAPI` clipboard types |
| `src/renderer/hooks/useTerminal.ts` | `attachCustomKeyEventHandler` for Ctrl+V, paste logic |
| `src/main/index.ts` | Clear `~/.ccc/tmp/` on app start |
| `src/main/session-manager.ts` | Clean session-specific temp files on session close |

No new files needed.
