# In-app updates — design

Date: 2026-04-06
Status: Approved design, pending implementation plan

## Goal

Let CCC2 users receive updates without manual download/reinstall. Replace the existing `electron-updater`-based flow with a simpler architecture built around an idempotent `install.sh` and an in-app heartbeat that polls GitHub Releases.

## Non-goals

- Signing (macOS Developer ID, Windows code signing) — accepted as a known limitation, add later
- Beta/pre-release channel — YAGNI, add later if needed
- Delta updates — full download per update is fine
- In-app update for Windows — Windows shows a copy-paste install command (no PowerShell script yet)

## Architecture

Three deliverables:

1. **`install.sh`** — idempotent first-install + update script for Linux and macOS
2. **Release pipeline** — GitHub Actions builds `.deb`, `.dmg`, `.exe` on tag push and publishes a GitHub Release
3. **In-app heartbeat + UI** — main process polls GitHub Releases API, emits state to renderer, which shows a sidebar indicator and a Settings "About" tab

`electron-updater` is removed entirely. The existing `src/main/updater.ts` is rewritten.

---

## 1. `install.sh`

**Location:** repo root.
**Entry point:** `curl -fsSL https://raw.githubusercontent.com/AdamGardelov/code-command-center2/main/install.sh | bash`

**Responsibilities:**

- `set -euo pipefail`
- Detect OS and arch:
  - Linux → `.deb`
  - macOS → `.dmg` (detect `arm64` vs `x64`)
  - Anything else → error with message pointing Windows users to the nsis installer
- Fetch latest release metadata from `https://api.github.com/repos/AdamGardelov/code-command-center2/releases/latest`
- Parse `tag_name` and the matching asset URL
- If already installed at the same version → print "already up-to-date" and exit 0 (makes heartbeat-triggered re-runs safe no-ops)
- Download asset to `mktemp -d` with a cleanup `trap`
- Install:
  - **Linux:** `sudo dpkg -i <deb>`, fallback to `sudo apt-get install -f` if deps missing
  - **macOS:** `hdiutil attach` the dmg, `cp -R` the `.app` into `/Applications` (overwrite), `hdiutil detach`
- Print installed version and path on success

**Flags:**

- `--relaunch` — after install, exec the installed app in a detached process. Used by the in-app "Update now" flow to achieve seamless restart.

**Env var overrides** (for testing / forks):

- `CCC_INSTALL_VERSION` — pin to a specific version instead of `latest`
- `CCC_REPO` — override the `owner/repo` slug

---

## 2. Release pipeline

**File:** `.github/workflows/release.yml`
**Trigger:** push of a tag matching `v*`

**Matrix jobs:**

| Runner | Script | Artifact |
|--------|--------|----------|
| `ubuntu-latest` | `pnpm build:linux` | `.deb` |
| `macos-latest` | `pnpm build:mac` | `.dmg` (arm64) |
| `windows-latest` | `pnpm build:win` | `.exe` (nsis) |

**Per-job steps:**

1. `actions/checkout@v4`
2. `actions/setup-node@v4` using `.nvmrc`
3. Install pnpm
4. `pnpm install --frozen-lockfile`
5. `pnpm build:<platform>` (runs typecheck + build via existing scripts — acts as a CI gate; broken code won't publish)
6. Upload artifact to the release via `softprops/action-gh-release` with:
   - `draft: false` — publish immediately
   - `generate_release_notes: true` — auto-populate changelog from commits/PRs since previous tag
   - `files:` pointing at the built artifact

**Release flow for the maintainer:**

```
pnpm version patch      # bumps package.json + creates tag
git push --follow-tags  # triggers workflow
```

No manual publish step. Release is live as soon as all matrix jobs succeed.

**Risk:** no manual safety gate between tag push and live release. Mitigated by:

- Tag pushes are manual, not automated on merge to main
- The `build` step runs `typecheck` + full build, failing fast on broken code
- A bad release can be deleted + re-tagged

**Changes to `electron-builder.yml`:**

- Remove the `publish:` block (no longer needed — the GitHub Action uploads artifacts directly)
- Reduce Linux `target` to `deb` only (drop AppImage, pacman)
- macOS target stays `dmg`, Windows target stays `nsis`

---

## 3. In-app heartbeat + UI

### Main process

**File:** `src/main/updater.ts` (rewritten)

**State machine** (held in main, single source of truth):

```
idle | checking | update-available | up-to-date | error
```

**State payload:**

```ts
interface UpdaterState {
  status: 'idle' | 'checking' | 'update-available' | 'up-to-date' | 'error'
  currentVersion: string
  latestVersion?: string
  releaseUrl?: string
  releaseNotes?: string
  publishedAt?: string
  lastCheckedAt?: string
  errorMessage?: string
}
```

Added to `src/shared/types.ts`.

**Heartbeat:**

- On startup: check after a 10s delay (avoid slowing launch)
- Then every 4h on an interval
- Fetch `https://api.github.com/repos/AdamGardelov/code-command-center2/releases/latest` via native `fetch` (Node 24)
- Headers: `User-Agent: ccc2-updater`, `Accept: application/vnd.github+json`
- 10s timeout via `AbortSignal.timeout(10_000)`
- Compare `tag_name` (stripped of leading `v`) against `app.getVersion()` using the `semver` package (new dep)
- Newer version → `status = 'update-available'` with full payload
- Same/older → `status = 'up-to-date'`
- Network error, rate limit, parse failure → logged, `status = 'error'`, silently retried on next tick
- Manual checks bypass the timer but reuse the same fetch logic

**Install trigger** (on IPC `updater:install`):

- **Linux/macOS:** spawn a detached `bash -c` process with `stdio: 'ignore'` and `detached: true` that:
  1. Sleeps 1s to let the app quit cleanly
  2. Runs `curl -fsSL https://raw.githubusercontent.com/AdamGardelov/code-command-center2/main/install.sh | bash -s -- --relaunch`
  3. `install.sh` downloads, installs, and relaunches the app via its `--relaunch` flag
- After spawning, main immediately calls `app.quit()`
- **Windows:** IPC returns `{ manual: true, command: '<one-liner install command>' }` without quitting. Renderer displays the command for copy-paste.

**IPC handlers** (new `src/main/ipc/updater.ts`, registered alongside existing IPC modules):

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `updater:get-state` | renderer → main, returns state | Initial fetch on mount |
| `updater:check` | renderer → main, returns state | Manual "Check for updates" |
| `updater:install` | renderer → main, returns `{ manual?: boolean, command?: string }` | Trigger install flow |
| `updater:state-changed` | main → renderer (broadcast) | Pushed on every state transition |

**Preload:** extend `cccAPI` with:

```ts
updater: {
  getState(): Promise<UpdaterState>
  check(): Promise<UpdaterState>
  install(): Promise<{ manual?: boolean; command?: string }>
  onStateChanged(cb: (state: UpdaterState) => void): () => void
}
```

### Renderer

**Store:** new `src/renderer/stores/updater-store.ts` (Zustand). Keeps updater concerns separate from `session-store`. `App.tsx` subscribes to `updater:state-changed` on mount and pipes into the store.

**Sidebar indicator:** small pill in `SessionSidebar` footer.

- Hidden when status is `idle`, `checking`, or `up-to-date`
- Shown as `↓ v<latestVersion> available` when `update-available`
- Click → opens the Settings modal on the "About" tab

**Settings modal "About" tab** (new tab in `SettingsModal`):

- Current version: `app.getVersion()`
- Last checked timestamp (relative, e.g. "2 minutes ago")
- Status line matching current state:
  - `up-to-date` → "You're on the latest version"
  - `checking` → "Checking for updates…"
  - `update-available` → version, published date, release notes (plain text, not rendered markdown)
  - `error` → error message
- "Check for updates" button (disabled while `checking`)
- When `update-available`:
  - **Linux/macOS:** "Update now" button → calls `updater:install`
  - **Windows:** copy-paste install command in a code block with a copy button

---

## Data flow

```
GitHub Releases API
        │
        ▼
Main process heartbeat (src/main/updater.ts)
        │
        ▼ IPC broadcast
Preload bridge (cccAPI.updater)
        │
        ▼
Renderer updater-store (Zustand)
        │
        ├──► SessionSidebar indicator
        └──► SettingsModal "About" tab
```

User clicks "Update now" → IPC `updater:install` → main spawns detached install.sh → main quits → install.sh installs + relaunches.

---

## Error handling

| Failure | Behavior |
|---------|----------|
| GitHub API unreachable | Log, set `status = 'error'`, retry in 4h, keep previous `latestVersion` in payload if present |
| GitHub rate limit | Same as above (unauthenticated limit is 60 req/h — 4h interval is nowhere near that) |
| semver parse failure | Log, set `status = 'error'` |
| `install.sh` fails after app quit | User sees no app running; they re-run the curl one-liner manually. Documented in README. |
| Windows user clicks "Update" | Not possible — no button is rendered, only the copy-paste command |

---

## Testing

- **Main process updater:** unit test the version comparison and state transitions with a mocked `fetch`
- **install.sh:** manual smoke test on a Linux VM and a mac — no automated tests (bash scripts hitting sudo/hdiutil aren't worth the CI complexity)
- **Release pipeline:** first real tag is the test. Use a `v0.0.0-test` tag on a throwaway release if wanted.
- **Renderer:** visual verification of the sidebar indicator and Settings tab in dev mode by mocking the updater store state

---

## Known limitations

- **macOS unsigned:** users will see a Gatekeeper warning on first install. Documented in README. Fix = Apple Developer cert later.
- **Windows unsigned:** SmartScreen warning on install. Fix = code-signing cert later.
- **Windows in-app update:** manual copy-paste only until a PowerShell equivalent of install.sh exists.
- **No rollback:** if a release is broken, users must manually install an older `.deb`/`.dmg` from the GitHub Releases page.

---

## Files touched

**New:**

- `install.sh`
- `.github/workflows/release.yml`
- `src/main/ipc/updater.ts`
- `src/renderer/stores/updater-store.ts`
- Settings "About" tab component (likely `src/renderer/components/settings/AboutTab.tsx` or similar, following existing convention)

**Modified:**

- `src/main/updater.ts` — full rewrite
- `src/main/index.ts` — register new IPC, keep calling `initUpdater()`
- `src/preload/index.ts` + preload types — add `updater` namespace
- `src/shared/types.ts` — add `UpdaterState`
- `src/renderer/App.tsx` — subscribe to `updater:state-changed`
- `src/renderer/components/SessionSidebar.tsx` — add indicator
- `src/renderer/components/SettingsModal.tsx` — add "About" tab
- `electron-builder.yml` — remove `publish:`, reduce Linux target to `deb` only
- `package.json` — add `semver` dep, remove `electron-updater` dep
- `README.md` — document install.sh one-liner and known limitations
