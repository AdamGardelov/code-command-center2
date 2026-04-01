# Terminal Bug Fixes: Paste, URLs, Selection Copy

## Summary

Three bugs in the xterm.js terminal implementation need fixing:

1. **Double paste** — text appears twice when using Ctrl+V
2. **URLs open about:blank** — clicked links don't open in system browser
3. **Copy fails silently** — selected text sometimes doesn't reach clipboard

## Bug 1: Double Paste

### Root Cause

`attachCustomKeyEventHandler` intercepts Ctrl+V keydown and calls `terminal.paste(text)`, returning `false`. However, `return false` only prevents xterm from processing the keydown event — the browser still fires a separate DOM `paste` event which xterm.js handles natively. Result: text is pasted twice.

### Fix

Remove the entire Ctrl+V block from `attachCustomKeyEventHandler`. Xterm.js handles paste natively via the DOM paste event, including bracketed paste mode support. No replacement code needed.

Also remove the Ctrl+C copy block (lines 139-141) since copy is handled by the selection change listener (redesigned in Bug 3).

### Files Changed

- `src/renderer/hooks/useTerminal.ts` — remove Ctrl+V and Ctrl+C blocks from key handler

## Bug 2: URLs Open about:blank

### Root Cause

`WebLinksAddon` is loaded with no custom handler, so it uses its default which calls `window.open(url)`. In Electron's renderer process, `window.open()` doesn't reliably open the system browser — it attempts to create a new BrowserWindow, which gets denied by `setWindowOpenHandler`, and the URL may not reach `shell.openExternal()` correctly.

### Fix

Add a new IPC channel and preload API for opening external URLs, then pass a custom handler to WebLinksAddon.

**New IPC channel:** `shell:open-external`
- Main process handler calls `shell.openExternal(url)`

**New preload API:** `window.cccAPI.shell.openExternal(url: string)`

**Terminal change:**
```typescript
terminal.loadAddon(new WebLinksAddon((_event, uri) => {
  window.cccAPI.shell.openExternal(uri)
}))
```

### Files Changed

- `src/main/ipc/shell.ts` — new file, IPC handler for `shell:open-external`
- `src/main/index.ts` — register shell IPC handlers
- `src/preload/index.ts` — expose `shell.openExternal` on cccAPI
- `src/shared/types.ts` — add `shell` namespace to CccAPI type
- `src/renderer/hooks/useTerminal.ts` — pass custom handler to WebLinksAddon

## Bug 3: Selection Copy Fails Silently

### Root Cause

`navigator.clipboard.writeText()` in the renderer process can fail silently when the window doesn't have full focus or due to permissions issues. It's an async operation that can race with selection changes.

### Fix

Add a new IPC channel and preload API that uses Electron's `clipboard` module, which is synchronous and doesn't require window focus.

**New IPC channel:** `clipboard:write-text`
- Main process handler calls `clipboard.writeText(text)`

**New preload API:** `window.cccAPI.clipboard.writeText(text: string)`

**Terminal change:**
```typescript
const selectionDisposable = terminal.onSelectionChange(() => {
  const selection = terminal.getSelection()
  if (selection) {
    window.cccAPI.clipboard.writeText(selection)
  }
})
```

### Files Changed

- `src/main/ipc/clipboard.ts` — new file, IPC handler for `clipboard:write-text`
- `src/main/index.ts` — register clipboard IPC handlers
- `src/preload/index.ts` — expose `clipboard.writeText` on cccAPI
- `src/shared/types.ts` — add `clipboard` namespace to CccAPI type
- `src/renderer/hooks/useTerminal.ts` — use cccAPI.clipboard instead of navigator.clipboard

## Implementation Order

1. Add IPC handlers (clipboard, shell) — independent, can be parallel
2. Update preload and types — depends on step 1
3. Update useTerminal.ts — depends on step 2
