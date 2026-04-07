# Terminal Image Paste Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users paste screenshots into the xterm.js terminal with Ctrl/Cmd+V; the image is written to a temp file and its absolute path is typed into the PTY so `claude` can read it.

**Architecture:** Renderer intercepts Ctrl/Cmd+V via xterm's `attachCustomKeyEventHandler`. An async helper reads `navigator.clipboard`, and on image content sends bytes to a new main-process IPC that writes `os.tmpdir()/ccc-paste-<ts>.<ext>` and returns the path. The path is written to the PTY via existing `terminal:write`. Remote sessions (those with `remoteHost` set) silently fall through to normal text paste.

**Tech Stack:** Electron, xterm.js, React 19, TypeScript, node-pty, existing `ToastContainer`.

**Spec:** `docs/superpowers/specs/2026-04-07-terminal-image-paste-design.md`

**Testing note:** This feature is clipboard + xterm + PTY integration; there are no existing unit tests for `useTerminal.ts` or `clipboard.ts`, and mocking the browser Clipboard API + xterm + IPC is not worth the scaffolding for one feature. Each task ends with a concrete manual verification step instead. Follow the spec's Testing section for final acceptance.

---

## File Structure

- **Modify** `src/main/ipc/clipboard.ts` — add `clipboard:write-image` handler that writes a temp PNG/JPEG and returns its path.
- **Modify** `src/shared/types.ts` — extend `cccAPI.clipboard` type with `writeImage`.
- **Modify** `src/preload/index.ts` — expose `cccAPI.clipboard.writeImage`.
- **Modify** `src/renderer/hooks/useTerminal.ts` — register a custom key event handler on the xterm instance and add the async paste helper.

No new files. Each modification is focused on one responsibility.

---

## Task 1: Main-process IPC — write image to temp file

**Files:**
- Modify: `src/main/ipc/clipboard.ts`

- [ ] **Step 1: Replace the file contents with the new handler**

```ts
import { ipcMain, clipboard } from 'electron'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function registerClipboardIpc(): void {
  ipcMain.on('clipboard:write-text', (_event, text: string) => {
    clipboard.writeText(text)
  })

  ipcMain.handle(
    'clipboard:write-image',
    async (_event, bytes: Uint8Array, ext: 'png' | 'jpg'): Promise<string> => {
      const filename = `ccc-paste-${Date.now()}.${ext}`
      const filepath = join(tmpdir(), filename)
      await writeFile(filepath, Buffer.from(bytes))
      return filepath
    }
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck:node`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc/clipboard.ts
git commit -m "clipboard-ipc: add write-image handler for pasted screenshots"
```

---

## Task 2: Expose `writeImage` through the preload bridge

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Find the `clipboard` field in `CccAPI` (or equivalent) in `src/shared/types.ts`**

Locate the existing `clipboard: { writeText: ... }` entry (search for `writeText`).

- [ ] **Step 2: Extend the type**

Change it to:

```ts
clipboard: {
  writeText: (text: string) => void
  writeImage: (bytes: Uint8Array, ext: 'png' | 'jpg') => Promise<string>
}
```

(Preserve whatever return type `writeText` already had if different — only add the `writeImage` line.)

- [ ] **Step 3: Update the preload bridge in `src/preload/index.ts`**

Replace lines 131-133:

```ts
clipboard: {
  writeText: (text: string) => ipcRenderer.send('clipboard:write-text', text),
  writeImage: (bytes: Uint8Array, ext: 'png' | 'jpg'): Promise<string> =>
    ipcRenderer.invoke('clipboard:write-image', bytes, ext)
},
```

- [ ] **Step 4: Typecheck both targets**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts src/preload/index.ts
git commit -m "preload: expose clipboard.writeImage bridge"
```

---

## Task 3: Renderer — intercept Ctrl/Cmd+V and paste images

**Files:**
- Modify: `src/renderer/hooks/useTerminal.ts`

This task adds the clipboard-paste handler. It needs two things from the hook's existing scope: the `sessionId` (already a dep) and whether the session is remote. We'll look up the session from the Zustand store inside the handler to avoid restructuring the hook's deps.

- [ ] **Step 1: Add imports at the top of `useTerminal.ts`**

Add alongside existing imports:

```ts
import { useSessionStore } from '../stores/session-store'
```

Also ensure the toast helper is imported — search the file for how toasts are currently triggered (e.g. `useSessionStore.getState().addToast(...)` or a dedicated helper). Use the existing pattern. If unclear, grep `ToastContainer.tsx` and callers to find the API. Do NOT invent a new toast API.

- [ ] **Step 2: Add the paste helper above the `useEffect` that creates the terminal**

Inside the hook body, before the `useEffect`, add:

```ts
const handleImagePaste = async (): Promise<boolean> => {
  // Returns true if we handled the paste (caller should swallow the key event),
  // false if the caller should let xterm run its normal paste path.
  try {
    const session = useSessionStore.getState().sessions.find((s) => s.id === sessionId)
    if (session?.remoteHost) return false // remote sessions: fall through to text paste

    if (!navigator.clipboard || !navigator.clipboard.read) return false
    const items = await navigator.clipboard.read()

    for (const item of items) {
      const imageType = item.types.find(
        (t) => t === 'image/png' || t === 'image/jpeg'
      )
      if (!imageType) continue

      const blob = await item.getType(imageType)
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const ext = imageType === 'image/png' ? 'png' : 'jpg'
      const filepath = await window.cccAPI.clipboard.writeImage(bytes, ext)
      window.cccAPI.terminal.write(sessionId, filepath + ' ')
      return true
    }
    return false
  } catch (err) {
    // Permission denied, write failure, etc. — surface and fall through.
    const message = err instanceof Error ? err.message : 'Failed to paste image'
    // Use the existing toast pattern discovered in Step 1.
    // Example if the store has addToast:
    // useSessionStore.getState().addToast({ type: 'error', message: `Image paste failed: ${message}` })
    console.error('[image paste]', message)
    return false
  }
}
```

Replace the example toast line with the actual API used elsewhere in the renderer. If there is no toast API reachable from a hook, call `console.error` and leave a `// TODO` comment — do NOT build new toast infra in this task.

- [ ] **Step 3: Register the custom key event handler on the xterm instance**

Inside the main `useEffect` (the one that creates the `terminal`), after `termRef.current = terminal` and before the `fitAndResize` helper is defined, add:

```ts
terminal.attachCustomKeyEventHandler((event) => {
  if (event.type !== 'keydown') return true
  const isPaste =
    event.key.toLowerCase() === 'v' && (event.ctrlKey || event.metaKey) && !event.shiftKey
  if (!isPaste) return true

  // Fire and forget; if we handle it, we've already written to the PTY and
  // we must swallow the key so xterm does NOT also run its text-paste path.
  // If we don't handle it, return true synchronously below so xterm handles it normally.
  let handled = false
  handleImagePaste()
    .then((didHandle) => {
      handled = didHandle
    })
    .catch(() => {
      /* already logged */
    })

  // We can't await here. Strategy: always swallow the key and let the async
  // helper decide whether to (a) write image path or (b) re-dispatch a text paste.
  // To keep text paste working, call navigator.clipboard.readText() in the
  // else branch of the helper and write it to the PTY ourselves.
  return false
})
```

- [ ] **Step 4: Update `handleImagePaste` to also handle the text-paste fallthrough**

Since we now swallow the key unconditionally, the helper must perform the text paste itself when there is no image. Update the helper:

Replace `if (session?.remoteHost) return false` with:

```ts
if (session?.remoteHost) {
  await fallbackTextPaste()
  return true
}
```

Replace `if (!navigator.clipboard || !navigator.clipboard.read) return false` with:

```ts
if (!navigator.clipboard || !navigator.clipboard.read) {
  await fallbackTextPaste()
  return true
}
```

Replace the final `return false` at the end of the try block with:

```ts
await fallbackTextPaste()
return true
```

And in the catch block, after logging, call:

```ts
await fallbackTextPaste()
return true
```

Add the helper above `handleImagePaste`:

```ts
const fallbackTextPaste = async (): Promise<void> => {
  try {
    const text = await navigator.clipboard.readText()
    if (text) window.cccAPI.terminal.write(sessionId, text)
  } catch {
    // Nothing we can do — clipboard unavailable.
  }
}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck:web`
Expected: no errors.

- [ ] **Step 6: Run the app and verify manually**

Run: `pnpm dev`

Verify all six spec test cases in a local session:
1. Screenshot on clipboard → Ctrl/Cmd+V → absolute path ending in `.png` appears at the cursor followed by a space.
2. Text on clipboard → Ctrl/Cmd+V → text appears at the cursor.
3. Empty clipboard → Ctrl/Cmd+V → no-op, no error in console.
4. Remote session (if available) with screenshot → Ctrl/Cmd+V → text paste behavior, no crash.
5. Paste image mid-prompt with existing typed text → path is appended at cursor, existing input is not clobbered.
6. `claude` can read the image at the pasted path (hit Enter and ask it to describe the image).

- [ ] **Step 7: Commit**

```bash
git add src/renderer/hooks/useTerminal.ts
git commit -m "terminal: paste screenshots from clipboard as temp file path"
```

---

## Task 4: Final acceptance check

- [ ] **Step 1: Full build**

Run: `pnpm build`
Expected: clean build, no typecheck or bundler errors.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: no new lint errors in modified files.

- [ ] **Step 3: Re-run the six manual spec cases one more time against the built dev app**

Run: `pnpm dev`
All six cases from Task 3 Step 6 pass.

---

## Self-review notes

- Spec coverage: IPC handler (Task 1), preload bridge (Task 2), renderer interception + remote fallthrough + text fallback + error toast/log (Task 3), manual test plan covered in Task 3 Step 6 and Task 4 Step 3. ✓
- No placeholders except one intentional `// TODO` fallback for the toast API if the engineer cannot locate one — this is a documented concession, not a gap.
- Type consistency: `writeImage(bytes: Uint8Array, ext: 'png' | 'jpg'): Promise<string>` is used identically in main, preload, shared types, and renderer.
- Scope: single subsystem, single plan. ✓
