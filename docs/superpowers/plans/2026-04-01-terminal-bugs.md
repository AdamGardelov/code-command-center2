# Terminal Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three terminal bugs: double paste, URLs opening about:blank, and silent copy failures.

**Architecture:** Add two lightweight IPC channels (clipboard, shell) to the main process, expose them via preload, and simplify the terminal hook to use native xterm paste + Electron APIs for clipboard and link opening.

**Tech Stack:** Electron (clipboard, shell modules), xterm.js, node IPC

---

### Task 1: Add clipboard IPC handler

**Files:**
- Create: `src/main/ipc/clipboard.ts`
- Modify: `src/main/index.ts:23-128`

- [ ] **Step 1: Create clipboard IPC handler**

Create `src/main/ipc/clipboard.ts`:

```typescript
import { ipcMain, clipboard } from 'electron'

export function registerClipboardIpc(): void {
  ipcMain.on('clipboard:write-text', (_event, text: string) => {
    clipboard.writeText(text)
  })
}
```

- [ ] **Step 2: Register handler in main process**

In `src/main/index.ts`, add the import alongside existing IPC imports (after line 31):

```typescript
import { registerClipboardIpc } from './ipc/clipboard'
```

Add the registration call after line 128 (after `registerGroupIpc`):

```typescript
registerClipboardIpc()
```

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc/clipboard.ts src/main/index.ts
git commit -m "feat: add clipboard IPC handler"
```

---

### Task 2: Add shell IPC handler

**Files:**
- Create: `src/main/ipc/shell.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Create shell IPC handler**

Create `src/main/ipc/shell.ts`:

```typescript
import { ipcMain, shell } from 'electron'

export function registerShellIpc(): void {
  ipcMain.on('shell:open-external', (_event, url: string) => {
    shell.openExternal(url)
  })
}
```

- [ ] **Step 2: Register handler in main process**

In `src/main/index.ts`, add import:

```typescript
import { registerShellIpc } from './ipc/shell'
```

Add registration call next to `registerClipboardIpc()`:

```typescript
registerShellIpc()
```

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc/shell.ts src/main/index.ts
git commit -m "feat: add shell open-external IPC handler"
```

---

### Task 3: Update types and preload

**Files:**
- Modify: `src/shared/types.ts:152-207`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add clipboard and shell namespaces to CccAPI type**

In `src/shared/types.ts`, add these two namespaces to the `CccAPI` interface (after the `pr` namespace, before the closing `}`):

```typescript
  clipboard: {
    writeText: (text: string) => void
  }
  shell: {
    openExternal: (url: string) => void
  }
```

- [ ] **Step 2: Add clipboard and shell to preload API object**

In `src/preload/index.ts`, add these two namespaces to the `api` object (after the `pr` block, before the closing `}`):

```typescript
  clipboard: {
    writeText: (text: string) => ipcRenderer.send('clipboard:write-text', text)
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.send('shell:open-external', url)
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts src/preload/index.ts
git commit -m "feat: expose clipboard and shell APIs via preload"
```

---

### Task 4: Fix useTerminal — paste, links, and copy

**Files:**
- Modify: `src/renderer/hooks/useTerminal.ts:99,131-151`

- [ ] **Step 1: Pass custom handler to WebLinksAddon**

In `src/renderer/hooks/useTerminal.ts`, change line 99 from:

```typescript
    terminal.loadAddon(new WebLinksAddon())
```

to:

```typescript
    terminal.loadAddon(new WebLinksAddon((_event, uri) => {
      window.cccAPI.shell.openExternal(uri)
    }))
```

- [ ] **Step 2: Remove Ctrl+V and Ctrl+C blocks from key handler**

Replace the entire `attachCustomKeyEventHandler` block (lines 131-144):

```typescript
    terminal.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true
      if (e.ctrlKey && e.key === 'v') {
        navigator.clipboard.readText().then((text) => {
          terminal.paste(text)
        })
        return false
      }
      if (e.ctrlKey && e.key === 'c' && terminal.hasSelection()) {
        terminal.clearSelection()
        return false
      }
      return true
    })
```

with nothing — remove it entirely.

- [ ] **Step 3: Use Electron clipboard for selection copy**

Replace the `onSelectionChange` block (lines 146-151):

```typescript
    const selectionDisposable = terminal.onSelectionChange(() => {
      const selection = terminal.getSelection()
      if (selection) {
        navigator.clipboard.writeText(selection)
      }
    })
```

with:

```typescript
    const selectionDisposable = terminal.onSelectionChange(() => {
      const selection = terminal.getSelection()
      if (selection) {
        window.cccAPI.clipboard.writeText(selection)
      }
    })
```

- [ ] **Step 4: Verify the app compiles**

Run: `npm run build` (or the project's build command)
Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hooks/useTerminal.ts
git commit -m "fix: resolve double paste, broken URLs, and unreliable copy"
```

---

### Task 5: Manual verification

- [ ] **Step 1: Start the app in dev mode**

Run: `npm run dev`

- [ ] **Step 2: Test paste**

Copy an IP address like `100.114.52.25`, press Ctrl+V in terminal. Verify text appears exactly once.

- [ ] **Step 3: Test URL clicking**

Run `echo https://github.com` in terminal. Click the URL. Verify it opens in system browser, not about:blank.

- [ ] **Step 4: Test selection copy**

Select text in the terminal by clicking and dragging. Switch to another app and paste. Verify the selected text was copied correctly. Also test selecting while the window is partially unfocused (e.g. during a drag from outside).

- [ ] **Step 5: Test Ctrl+C still sends SIGINT**

Run `sleep 999` in terminal. Press Ctrl+C (without selection). Verify the command is interrupted.
