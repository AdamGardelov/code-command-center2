# In-App Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing `electron-updater`-based flow with an `install.sh`-based update mechanism: CCC2 polls GitHub Releases for new versions, shows a sidebar indicator + Settings "About" tab, and on "Update now" shells out to `install.sh` which reinstalls the `.deb`/`.dmg` and relaunches the app.

**Architecture:** Main-process heartbeat polls GitHub's releases API, holds state, broadcasts over IPC. Renderer has a dedicated Zustand store subscribing to updates. Install action spawns a detached bash process that curls `install.sh` and relaunches the app. Release pipeline is GitHub Actions matrix builds publishing directly to GitHub Releases (no draft gate).

**Tech Stack:** Electron (main + preload + renderer), TypeScript, Zustand, React 19, `semver` (new dep), bash, GitHub Actions, electron-builder, `softprops/action-gh-release`.

**Spec:** `docs/superpowers/specs/2026-04-06-in-app-updates-design.md`

**Notes for the engineer:**
- This project has no test runner. Verification per task = `pnpm typecheck`, `pnpm lint`, and where relevant a quick `pnpm dev` smoke test.
- Commit messages must NOT include co-author footers.
- Stores live in `src/renderer/stores/` (not `src/renderer/src/stores/`).
- Components live directly in `src/renderer/components/`.
- Existing IPC registration pattern: each module exports a `registerXxxIpc(...)` function, called from `src/main/index.ts`.

---

## File Structure

**New files:**
- `install.sh` — repo root, idempotent install/update bash script
- `.github/workflows/release.yml` — matrix build + publish on tag push
- `src/main/ipc/updater.ts` — IPC registration for updater channels
- `src/renderer/stores/updater-store.ts` — Zustand store for updater state
- `src/renderer/components/AboutTab.tsx` — Settings "About" tab content
- `src/renderer/components/UpdateIndicator.tsx` — sidebar footer indicator

**Modified:**
- `src/main/updater.ts` — full rewrite (heartbeat + state machine, no electron-updater)
- `src/main/index.ts` — register updater IPC, pass window to updater
- `src/preload/index.ts` — add `updater` namespace to `cccAPI`
- `src/shared/types.ts` — add `UpdaterState` + `UpdaterInstallResult`, extend `CccAPI`
- `src/renderer/App.tsx` — subscribe to `updater:state-changed`, hydrate store
- `src/renderer/components/SessionSidebar.tsx` — render `<UpdateIndicator />` in footer
- `src/renderer/components/SettingsModal.tsx` — add "About" tab
- `electron-builder.yml` — remove `publish:`, reduce Linux targets to `deb` only
- `package.json` — remove `electron-updater`, add `semver` + `@types/semver`
- `README.md` — document install.sh one-liner and known limitations

---

## Task 1: Dependencies and shared types

**Files:**
- Modify: `package.json`
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Swap dependencies**

```bash
pnpm remove electron-updater
pnpm add semver
pnpm add -D @types/semver
```

- [ ] **Step 2: Add updater types to `src/shared/types.ts`**

Append these exports (at the bottom of the file, before or after existing types — match file style):

```ts
export type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'update-available'
  | 'up-to-date'
  | 'error'

export interface UpdaterState {
  status: UpdaterStatus
  currentVersion: string
  latestVersion?: string
  releaseUrl?: string
  releaseNotes?: string
  publishedAt?: string
  lastCheckedAt?: string
  errorMessage?: string
}

export interface UpdaterInstallResult {
  /** True when no automated install is possible on this platform (e.g. Windows). */
  manual?: boolean
  /** Copy-pasteable command shown to the user when `manual` is true. */
  command?: string
}
```

- [ ] **Step 3: Extend `CccAPI` interface with the updater namespace**

Find the `CccAPI` interface in `src/shared/types.ts` and add an `updater` property. Example shape to add (match surrounding style):

```ts
updater: {
  getState(): Promise<UpdaterState>
  check(): Promise<UpdaterState>
  install(): Promise<UpdaterInstallResult>
  onStateChanged(callback: (state: UpdaterState) => void): () => void
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: passes. If it fails because `CccAPI` implementations are missing the new field, proceed — we'll add them in later tasks. If it fails elsewhere, fix before continuing.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/shared/types.ts
git commit -m "chore: swap electron-updater for semver, add UpdaterState types"
```

---

## Task 2: Rewrite main-process updater

**Files:**
- Modify: `src/main/updater.ts` (full rewrite)

- [ ] **Step 1: Replace the contents of `src/main/updater.ts` with the new implementation**

```ts
import { app, BrowserWindow } from 'electron'
import semver from 'semver'
import { spawn } from 'child_process'
import type { UpdaterState, UpdaterInstallResult } from '../shared/types'
import { log } from './log-service'

const REPO = 'AdamGardelov/code-command-center2'
const RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`
const USER_AGENT = 'ccc2-updater'
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours
const STARTUP_DELAY_MS = 10_000
const FETCH_TIMEOUT_MS = 10_000

const INSTALL_COMMAND =
  `curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash -s -- --relaunch`

interface GitHubRelease {
  tag_name: string
  html_url: string
  body: string
  published_at: string
}

class Updater {
  private state: UpdaterState = {
    status: 'idle',
    currentVersion: app.getVersion()
  }
  private intervalHandle: NodeJS.Timeout | null = null
  private startupHandle: NodeJS.Timeout | null = null

  getState(): UpdaterState {
    return this.state
  }

  start(): void {
    this.startupHandle = setTimeout(() => {
      void this.check()
    }, STARTUP_DELAY_MS)

    this.intervalHandle = setInterval(() => {
      void this.check()
    }, CHECK_INTERVAL_MS)
  }

  stop(): void {
    if (this.startupHandle) clearTimeout(this.startupHandle)
    if (this.intervalHandle) clearInterval(this.intervalHandle)
    this.startupHandle = null
    this.intervalHandle = null
  }

  async check(): Promise<UpdaterState> {
    this.setState({ ...this.state, status: 'checking', errorMessage: undefined })

    try {
      const release = await this.fetchLatestRelease()
      const latest = release.tag_name.replace(/^v/, '')
      const current = app.getVersion()
      const lastCheckedAt = new Date().toISOString()

      if (semver.valid(latest) && semver.gt(latest, current)) {
        this.setState({
          status: 'update-available',
          currentVersion: current,
          latestVersion: latest,
          releaseUrl: release.html_url,
          releaseNotes: release.body,
          publishedAt: release.published_at,
          lastCheckedAt
        })
      } else {
        this.setState({
          status: 'up-to-date',
          currentVersion: current,
          latestVersion: latest,
          lastCheckedAt
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error(`Updater check failed: ${message}`)
      this.setState({
        ...this.state,
        status: 'error',
        errorMessage: message,
        lastCheckedAt: new Date().toISOString()
      })
    }

    return this.state
  }

  install(): UpdaterInstallResult {
    if (process.platform === 'win32') {
      return { manual: true, command: INSTALL_COMMAND }
    }

    // Spawn a detached shell that waits for the app to exit, then runs install.sh
    // with --relaunch. stdio is ignored so the child can outlive the parent.
    const child = spawn(
      'bash',
      ['-c', `sleep 1 && ${INSTALL_COMMAND}`],
      {
        detached: true,
        stdio: 'ignore'
      }
    )
    child.unref()

    // Quit after a short delay so the IPC reply can flush.
    setTimeout(() => app.quit(), 200)

    return {}
  }

  private async fetchLatestRelease(): Promise<GitHubRelease> {
    const res = await fetch(RELEASE_API, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/vnd.github+json'
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    })

    if (!res.ok) {
      throw new Error(`GitHub API ${res.status}: ${res.statusText}`)
    }

    return (await res.json()) as GitHubRelease
  }

  private setState(next: UpdaterState): void {
    this.state = next
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('updater:state-changed', this.state)
    }
  }
}

let updaterInstance: Updater | null = null

export function getUpdater(): Updater {
  if (!updaterInstance) {
    updaterInstance = new Updater()
  }
  return updaterInstance
}

export function initUpdater(): void {
  getUpdater().start()
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: passes. If `log.error` signature differs, open `src/main/log-service.ts` and adjust the call site to match (e.g. `log.error('msg')`).

- [ ] **Step 3: Commit**

```bash
git add src/main/updater.ts
git commit -m "feat(updater): rewrite main-process updater with GitHub Releases heartbeat"
```

---

## Task 3: Updater IPC handlers

**Files:**
- Create: `src/main/ipc/updater.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Create `src/main/ipc/updater.ts`**

```ts
import { ipcMain } from 'electron'
import { getUpdater } from '../updater'

export function registerUpdaterIpc(): void {
  ipcMain.handle('updater:get-state', () => {
    return getUpdater().getState()
  })

  ipcMain.handle('updater:check', async () => {
    return getUpdater().check()
  })

  ipcMain.handle('updater:install', () => {
    return getUpdater().install()
  })
}
```

- [ ] **Step 2: Register the IPC in `src/main/index.ts`**

Add the import alongside the other `registerXxxIpc` imports:

```ts
import { registerUpdaterIpc } from './ipc/updater'
```

And add the call alongside the other `registerXxxIpc()` calls (near line 144-151 in the current file, after `registerShellIpc()`):

```ts
registerUpdaterIpc()
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc/updater.ts src/main/index.ts
git commit -m "feat(updater): add IPC handlers for updater state/check/install"
```

---

## Task 4: Preload bridge

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add the `updater` namespace to the `api` object in `src/preload/index.ts`**

Add after the existing `app:` namespace (around line 145):

```ts
  updater: {
    getState: () => ipcRenderer.invoke('updater:get-state'),
    check: () => ipcRenderer.invoke('updater:check'),
    install: () => ipcRenderer.invoke('updater:install'),
    onStateChanged: (callback) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        state: Parameters<typeof callback>[0]
      ): void => {
        callback(state)
      }
      ipcRenderer.on('updater:state-changed', handler)
      return () => ipcRenderer.removeListener('updater:state-changed', handler)
    }
  }
```

(Remember to add a comma after the preceding `app:` block.)

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: passes. The `CccAPI` interface already has the `updater` field from Task 1, so this satisfies it.

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat(updater): expose updater namespace via cccAPI preload bridge"
```

---

## Task 5: Renderer updater store

**Files:**
- Create: `src/renderer/stores/updater-store.ts`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Create `src/renderer/stores/updater-store.ts`**

```ts
import { create } from 'zustand'
import type { UpdaterState } from '../../shared/types'

interface UpdaterStore {
  state: UpdaterState
  setState: (state: UpdaterState) => void
  check: () => Promise<void>
  install: () => Promise<{ manual?: boolean; command?: string }>
}

const initialState: UpdaterState = {
  status: 'idle',
  currentVersion: ''
}

export const useUpdaterStore = create<UpdaterStore>((set) => ({
  state: initialState,
  setState: (state) => set({ state }),
  check: async () => {
    const next = await window.cccAPI.updater.check()
    set({ state: next })
  },
  install: async () => {
    return window.cccAPI.updater.install()
  }
}))
```

- [ ] **Step 2: Hydrate and subscribe from `src/renderer/App.tsx`**

In `App.tsx`, find the existing `useEffect` block that sets up IPC subscriptions (look for `session:state-changed` or `pr:` subscriptions). Add:

```ts
import { useUpdaterStore } from './stores/updater-store'
```

Inside the effect (or a new effect if cleaner):

```ts
useEffect(() => {
  void window.cccAPI.updater.getState().then((state) => {
    useUpdaterStore.getState().setState(state)
  })
  const unsubscribe = window.cccAPI.updater.onStateChanged((state) => {
    useUpdaterStore.getState().setState(state)
  })
  return unsubscribe
}, [])
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/stores/updater-store.ts src/renderer/App.tsx
git commit -m "feat(updater): add renderer updater store and App subscription"
```

---

## Task 6: Sidebar update indicator

**Files:**
- Create: `src/renderer/components/UpdateIndicator.tsx`
- Modify: `src/renderer/components/SessionSidebar.tsx`

- [ ] **Step 1: Create `src/renderer/components/UpdateIndicator.tsx`**

```tsx
import { ArrowDownCircle } from 'lucide-react'
import { useUpdaterStore } from '../stores/updater-store'

interface UpdateIndicatorProps {
  onClick: () => void
}

export function UpdateIndicator({ onClick }: UpdateIndicatorProps): JSX.Element | null {
  const status = useUpdaterStore((s) => s.state.status)
  const latestVersion = useUpdaterStore((s) => s.state.latestVersion)

  if (status !== 'update-available' || !latestVersion) {
    return null
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 w-full px-3 py-2 text-xs rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors"
      title={`Update to v${latestVersion}`}
    >
      <ArrowDownCircle className="w-3.5 h-3.5" />
      <span>Update available: v{latestVersion}</span>
    </button>
  )
}
```

(Adjust Tailwind classes if the project uses a different color/token style — skim `SessionSidebar.tsx` for surrounding conventions and match them.)

- [ ] **Step 2: Render `<UpdateIndicator />` in `SessionSidebar.tsx`**

Open `src/renderer/components/SessionSidebar.tsx`. Find the footer area (bottom of the sidebar, where settings/version info typically lives). Add:

```tsx
import { UpdateIndicator } from './UpdateIndicator'
```

And in the footer JSX, render:

```tsx
<UpdateIndicator onClick={() => openSettingsModalOnAboutTab()} />
```

The `openSettingsModalOnAboutTab` implementation depends on how the modal is currently opened — likely a store action or prop. If the sidebar already opens settings (e.g. a settings gear button), reuse that handler and add an "initial tab" argument in Task 7. If not, wire it by:
1. Adding a `settingsInitialTab` piece of state somewhere (prop, store, or URL — match existing patterns)
2. Setting it to `'about'` when this indicator is clicked

If the plumbing is non-trivial, a simpler fallback: just `alert()` or open Settings with no tab preference, and let the user click the About tab. Note this as a follow-up.

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/UpdateIndicator.tsx src/renderer/components/SessionSidebar.tsx
git commit -m "feat(updater): add sidebar update-available indicator"
```

---

## Task 7: Settings "About" tab

**Files:**
- Create: `src/renderer/components/AboutTab.tsx`
- Modify: `src/renderer/components/SettingsModal.tsx`

- [ ] **Step 1: Create `src/renderer/components/AboutTab.tsx`**

```tsx
import { useState } from 'react'
import { RefreshCw, Copy, Check } from 'lucide-react'
import { useUpdaterStore } from '../stores/updater-store'

export function AboutTab(): JSX.Element {
  const state = useUpdaterStore((s) => s.state)
  const check = useUpdaterStore((s) => s.check)
  const install = useUpdaterStore((s) => s.install)
  const [isChecking, setIsChecking] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)
  const [manualCommand, setManualCommand] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleCheck(): Promise<void> {
    setIsChecking(true)
    try {
      await check()
    } finally {
      setIsChecking(false)
    }
  }

  async function handleInstall(): Promise<void> {
    setIsInstalling(true)
    try {
      const result = await install()
      if (result.manual && result.command) {
        setManualCommand(result.command)
      }
    } finally {
      setIsInstalling(false)
    }
  }

  function handleCopy(): void {
    if (!manualCommand) return
    window.cccAPI.clipboard.writeText(manualCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lastChecked = state.lastCheckedAt
    ? new Date(state.lastCheckedAt).toLocaleString()
    : 'never'

  return (
    <div className="flex flex-col gap-4 p-4 text-sm">
      <div>
        <div className="text-xs text-neutral-500">Current version</div>
        <div className="text-neutral-200">v{state.currentVersion || '…'}</div>
      </div>

      <div>
        <div className="text-xs text-neutral-500">Last checked</div>
        <div className="text-neutral-200">{lastChecked}</div>
      </div>

      <div>
        <div className="text-xs text-neutral-500">Status</div>
        <div className="text-neutral-200">
          {state.status === 'checking' && 'Checking for updates…'}
          {state.status === 'up-to-date' && "You're on the latest version"}
          {state.status === 'update-available' &&
            `Update available: v${state.latestVersion}`}
          {state.status === 'error' && `Error: ${state.errorMessage ?? 'unknown'}`}
          {state.status === 'idle' && 'Idle'}
        </div>
      </div>

      {state.status === 'update-available' && state.releaseNotes && (
        <div>
          <div className="text-xs text-neutral-500 mb-1">Release notes</div>
          <pre className="text-xs whitespace-pre-wrap text-neutral-300 bg-neutral-900 p-2 rounded max-h-48 overflow-auto">
            {state.releaseNotes}
          </pre>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCheck}
          disabled={isChecking || state.status === 'checking'}
          className="flex items-center gap-2 px-3 py-1.5 text-xs rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
          Check for updates
        </button>

        {state.status === 'update-available' && !manualCommand && (
          <button
            type="button"
            onClick={handleInstall}
            disabled={isInstalling}
            className="px-3 py-1.5 text-xs rounded bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-50"
          >
            {isInstalling ? 'Installing…' : 'Update now'}
          </button>
        )}
      </div>

      {manualCommand && (
        <div>
          <div className="text-xs text-neutral-500 mb-1">
            Run this command in a terminal to update:
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-neutral-900 p-2 rounded overflow-x-auto">
              {manualCommand}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="p-2 rounded bg-neutral-800 hover:bg-neutral-700"
              title="Copy command"
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add the "About" tab to `SettingsModal.tsx`**

Open `src/renderer/components/SettingsModal.tsx`. It already has a tab system — find the tab list and tab content switch. Add:

```tsx
import { AboutTab } from './AboutTab'
```

Add `'about'` to the tab id union type, add a tab button labeled "About" to the tab bar, and add a case in the content switch:

```tsx
{activeTab === 'about' && <AboutTab />}
```

Also accept an optional `initialTab` prop (or equivalent) so `UpdateIndicator` (Task 6) can open directly to this tab. If the modal is opened via a store action, add an `openSettingsOnTab(tab: 'about' | ...)` action alongside it.

Wire the sidebar click-through from Task 6 to use this.

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: passes.

- [ ] **Step 4: Smoke test in dev**

Run: `pnpm dev`
Open the app → Settings → About tab. Verify:
- Current version renders
- "Check for updates" fires and updates the last-checked time
- With no newer release, status shows "You're on the latest version"

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/AboutTab.tsx src/renderer/components/SettingsModal.tsx
git commit -m "feat(updater): add Settings About tab with update controls"
```

---

## Task 8: `install.sh`

**Files:**
- Create: `install.sh`

- [ ] **Step 1: Create `install.sh` at repo root**

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO="${CCC_REPO:-AdamGardelov/code-command-center2}"
VERSION="${CCC_INSTALL_VERSION:-latest}"
RELAUNCH=0

for arg in "$@"; do
  case "$arg" in
    --relaunch) RELAUNCH=1 ;;
    *) echo "Unknown arg: $arg" >&2; exit 1 ;;
  esac
done

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux)
    PLATFORM="linux"
    ;;
  Darwin)
    PLATFORM="mac"
    ;;
  *)
    echo "Unsupported OS: $OS" >&2
    echo "On Windows, download the .exe installer from:" >&2
    echo "  https://github.com/$REPO/releases/latest" >&2
    exit 1
    ;;
esac

echo "Detected: $PLATFORM ($ARCH)"

# Fetch release metadata
if [ "$VERSION" = "latest" ]; then
  API_URL="https://api.github.com/repos/$REPO/releases/latest"
else
  API_URL="https://api.github.com/repos/$REPO/releases/tags/$VERSION"
fi

echo "Fetching release metadata from $API_URL"
RELEASE_JSON=$(curl -fsSL -H "Accept: application/vnd.github+json" "$API_URL")

TAG=$(echo "$RELEASE_JSON" | grep -m1 '"tag_name"' | cut -d'"' -f4)
if [ -z "$TAG" ]; then
  echo "Could not determine release tag" >&2
  exit 1
fi
echo "Release tag: $TAG"

# Select asset by extension per platform
if [ "$PLATFORM" = "linux" ]; then
  ASSET_URL=$(echo "$RELEASE_JSON" | grep -o '"browser_download_url": *"[^"]*\.deb"' | head -1 | cut -d'"' -f4)
  ASSET_EXT="deb"
else
  ASSET_URL=$(echo "$RELEASE_JSON" | grep -o '"browser_download_url": *"[^"]*\.dmg"' | head -1 | cut -d'"' -f4)
  ASSET_EXT="dmg"
fi

if [ -z "$ASSET_URL" ]; then
  echo "No .$ASSET_EXT asset found in release $TAG" >&2
  exit 1
fi

# Skip if already on this version
if command -v code-command-center &>/dev/null; then
  CURRENT=$(code-command-center --version 2>/dev/null || echo "")
  TAG_STRIPPED="${TAG#v}"
  if [ "$CURRENT" = "$TAG_STRIPPED" ]; then
    echo "Already on version $TAG — nothing to do."
    if [ "$RELAUNCH" = "1" ]; then
      echo "Relaunching anyway (--relaunch)…"
      nohup code-command-center >/dev/null 2>&1 &
    fi
    exit 0
  fi
fi

# Download
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

ARCHIVE="$TMP_DIR/ccc2.$ASSET_EXT"
echo "Downloading $ASSET_URL"
curl -fsSL "$ASSET_URL" -o "$ARCHIVE"

# Install
if [ "$PLATFORM" = "linux" ]; then
  echo "Installing .deb (requires sudo)"
  if ! sudo dpkg -i "$ARCHIVE"; then
    echo "dpkg reported missing dependencies, running apt-get install -f"
    sudo apt-get install -f -y
  fi
  INSTALLED_CMD="code-command-center"
else
  echo "Mounting dmg"
  MOUNT_DIR=$(hdiutil attach -nobrowse -readonly "$ARCHIVE" | tail -1 | awk '{print $3}')
  APP_NAME=$(ls "$MOUNT_DIR" | grep '\.app$' | head -1)
  if [ -z "$APP_NAME" ]; then
    hdiutil detach "$MOUNT_DIR" >/dev/null
    echo "No .app found inside dmg" >&2
    exit 1
  fi
  echo "Copying $APP_NAME to /Applications"
  rm -rf "/Applications/$APP_NAME"
  cp -R "$MOUNT_DIR/$APP_NAME" /Applications/
  hdiutil detach "$MOUNT_DIR" >/dev/null
  INSTALLED_CMD="open -a \"/Applications/$APP_NAME\""
fi

echo "Installed $TAG"

if [ "$RELAUNCH" = "1" ]; then
  echo "Relaunching…"
  if [ "$PLATFORM" = "linux" ]; then
    nohup code-command-center >/dev/null 2>&1 &
  else
    eval "$INSTALLED_CMD"
  fi
fi
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x install.sh
```

- [ ] **Step 3: Shellcheck (if installed) or at least bash -n**

Run: `bash -n install.sh`
Expected: no output (syntactically valid). If `shellcheck` is installed, run `shellcheck install.sh` and address any errors (warnings optional).

- [ ] **Step 4: Commit**

```bash
git add install.sh
git commit -m "feat: add install.sh for first-install and updates (linux/mac)"
```

---

## Task 9: electron-builder config cleanup

**Files:**
- Modify: `electron-builder.yml`

- [ ] **Step 1: Remove the `publish:` block and reduce Linux targets**

Replace the Linux + publish sections. The final file should look like:

```yaml
appId: com.ccc.code-command-center
productName: code-command-center
directories:
  buildResources: build
  output: dist
files:
  - '!**/.vscode/*'
  - '!src/*'
  - '!electron.vite.config.{js,ts,mjs,cjs}'
  - '!{.eslintignore,.eslintrc.cjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}'
  - '!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}'
extraResources:
  - from: resources/
    to: resources/
linux:
  target:
    - deb
  icon: build/icon.png
  category: Development;
win:
  target:
    - nsis
  icon: build/icon.ico
mac:
  target:
    - dmg
  icon: build/icon.png
```

- [ ] **Step 2: Verify build still works locally for Linux**

Run: `pnpm build:linux`
Expected: produces `dist/code-command-center_<version>_amd64.deb` (or similar). No AppImage, no pacman.

- [ ] **Step 3: Commit**

```bash
git add electron-builder.yml
git commit -m "chore(build): drop publish block and reduce linux targets to deb"
```

---

## Task 10: GitHub Actions release workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create `.github/workflows/release.yml`**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: ubuntu-latest
            build: pnpm build:linux
            artifact: dist/*.deb
          - os: macos-latest
            build: pnpm build:mac
            artifact: dist/*.dmg
          - os: windows-latest
            build: pnpm build:win
            artifact: dist/*.exe

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Build
        run: ${{ matrix.build }}

      - name: Publish to GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: ${{ matrix.artifact }}
          draft: false
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: Verify YAML parses**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))"` (or any YAML linter you prefer)
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add release workflow for tagged builds across linux/mac/win"
```

---

## Task 11: README and cleanup

**Files:**
- Modify: `README.md`
- Verify: no stale references to `electron-updater` remain

- [ ] **Step 1: Add an "Install" section to README**

Add (or replace an existing install section with):

```markdown
## Install

### Linux / macOS (one-liner)

```bash
curl -fsSL https://raw.githubusercontent.com/AdamGardelov/code-command-center2/main/install.sh | bash
```

This downloads the latest `.deb` (Linux) or `.dmg` (macOS) from GitHub Releases and installs it. Re-run the same command any time to update — or use the in-app "Update now" button (Settings → About).

### Windows

Download the latest `.exe` installer from the [Releases page](https://github.com/AdamGardelov/code-command-center2/releases/latest).

### Known limitations

- macOS and Windows builds are unsigned. You'll see Gatekeeper / SmartScreen warnings on first install.
- In-app "Update now" is automated on Linux and macOS; on Windows it shows a copy-paste install command.
```

- [ ] **Step 2: Search for stale `electron-updater` references**

Run: `grep -r "electron-updater\|autoUpdater" src/ docs/ README.md 2>/dev/null`
Expected: no matches. If any remain (e.g. in `dev-app-update.yml`), delete the file or strip the reference.

- [ ] **Step 3: Delete `dev-app-update.yml` if present**

```bash
ls dev-app-update.yml 2>/dev/null && rm dev-app-update.yml
```

- [ ] **Step 4: Final typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add README.md
git rm --ignore-unmatch dev-app-update.yml
git commit -m "docs: document install.sh one-liner and update flow"
```

---

## Verification checklist (post-implementation)

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm build:linux` produces a `.deb`
- [ ] `pnpm dev` launches; Settings → About shows current version and a working "Check for updates" button
- [ ] Sidebar shows no indicator when up-to-date
- [ ] Tag a test release (e.g. `v0.0.0-test` on a throwaway branch, delete after) to verify the workflow runs and publishes artifacts
- [ ] Run `install.sh` on a Linux VM to verify install + relaunch path
