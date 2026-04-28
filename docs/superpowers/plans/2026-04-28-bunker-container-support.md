# Bunker Container Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing container-session model so that containers whose repos live internally (Wint Sandbox Bunker and similar hermetic dev containers) work end-to-end in CCC — repo discovery, worktrees, state detection, and PR-polling exclusion.

**Architecture:** A single new flag `containerInternalPaths` on `ContainerConfig`, plus a `worktreeBaseDir` string. The flag triggers four behaviors: working-directory pickers use `docker exec ls /repos` instead of host filesystem; `git-service` operations dispatch to a `docker-exec` backend (in addition to the existing local + SSH backends); state detection naturally falls to OSC-only since hook-state files are unreachable inside the container; and `pr-service` skips these sessions. No new top-level entity, no Wint-specific naming, no auto-detection.

**Tech Stack:** TypeScript, Electron 35, React 19, Zustand, electron-vite. No test framework — verification via `pnpm typecheck`, `pnpm build`, and a final manual smoke-test sequence inside CCC.

**Spec:** `docs/superpowers/specs/2026-04-28-bunker-container-support-design.md`

---

## File Map

**Modified files (no new files in v1):**

- `src/shared/types.ts` — `ContainerConfig` fields, `ContainerAPI` surface
- `src/main/container-service.ts` — `listRepos` method
- `src/main/index.ts` — IPC handler `container:list-repos`
- `src/preload/index.ts` — expose `cccAPI.container.listRepos`
- `src/renderer/components/settings/ContainersSettings.tsx` — toggle + worktree-path inputs
- `src/renderer/components/NewSessionModal.tsx` — repo dropdown when container is bunker-style
- `src/main/git-service.ts` — `containerName` parameter on six public methods + `execDetailed` dispatch
- `src/main/ipc/git.ts` — pass `containerName` through to `gitService` calls
- `src/renderer/components/BranchPicker.tsx` — pass `containerName` to git API calls

**Not modified (intentionally):**

- `src/main/pr-service.ts` — pr-service is org-level and not session-coupled today; nothing to filter
- `src/renderer/components/PrSidebar.tsx` — its worktree-creation stays host-only in v1

---

## Task 1: Extend ContainerConfig type

**Files:**
- Modify: `src/shared/types.ts` around the existing `ContainerConfig` interface

- [ ] **Step 1: Add the two new optional fields**

In `src/shared/types.ts`, find `interface ContainerConfig` (around line 73) and add:

```ts
export interface ContainerConfig {
  name: string
  label?: string
  remoteHost?: string
  // Bunker-style hermetic containers: repos live inside the container,
  // worktrees are created inside it via docker exec, PR polling is skipped.
  containerInternalPaths?: boolean
  worktreeBaseDir?: string
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm typecheck
```

Expected: completes with no errors. Existing config files merge in fine because both new fields are optional.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat(container): add containerInternalPaths + worktreeBaseDir to ContainerConfig"
```

---

## Task 2: ContainerService.listRepos

**Files:**
- Modify: `src/main/container-service.ts`

- [ ] **Step 1: Add the `listRepos` method**

Add to the `ContainerService` class (next to `isRunning`):

```ts
listRepos(containerName: string, remoteHost?: string): string[] {
  if (!isValidContainerName(containerName)) return []
  try {
    if (remoteHost && this.sshService) {
      const hostConfig = this.configService?.get().remoteHosts?.find(h => h.name === remoteHost)
      const sshHost = hostConfig?.host ?? remoteHost
      const result = this.sshService.exec(sshHost, `docker exec ${containerName} ls -1 /repos`)
      if (!result) return []
      return result.split('\n').map(s => s.trim()).filter(s => s.length > 0)
    }
    const result = execFileSync('docker', ['exec', containerName, 'ls', '-1', '/repos'], {
      timeout: 5000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    return result.split('\n').map(s => s.trim()).filter(s => s.length > 0)
  } catch {
    return []
  }
}
```

No cache in v1 — repo lists change rarely and the caller (NewSessionModal) only invokes on container-pick.

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/main/container-service.ts
git commit -m "feat(container): add listRepos via docker exec ls /repos"
```

---

## Task 3: Wire `container:list-repos` through IPC + preload + types

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Register the IPC handler**

In `src/main/index.ts`, find the existing `ipcMain.handle('container:list-running', ...)` (around line 156) and add right after it:

```ts
ipcMain.handle('container:list-repos', (_event, containerName: string, remoteHost?: string) => {
  return containerService.listRepos(containerName, remoteHost)
})
```

- [ ] **Step 2: Expose in preload**

In `src/preload/index.ts`, find the `container:` block around line 172 and add:

```ts
container: {
  listRunning: (remoteHost?: string): Promise<ContainerConfig[]> =>
    ipcRenderer.invoke('container:list-running', remoteHost),
  listRepos: (containerName: string, remoteHost?: string): Promise<string[]> =>
    ipcRenderer.invoke('container:list-repos', containerName, remoteHost)
}
```

- [ ] **Step 3: Add to `ContainerAPI` in shared types**

In `src/shared/types.ts`, find `container: { listRunning: ... }` (around line 311) and add:

```ts
container: {
  listRunning: (remoteHost?: string) => Promise<ContainerConfig[]>
  listRepos: (containerName: string, remoteHost?: string) => Promise<string[]>
}
```

- [ ] **Step 4: Verify typecheck passes**

```bash
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/main/index.ts src/preload/index.ts src/shared/types.ts
git commit -m "feat(container): expose listRepos via cccAPI"
```

---

## Task 4: Settings UI — toggle + worktree path in Add form

**Files:**
- Modify: `src/renderer/components/settings/ContainersSettings.tsx`

- [ ] **Step 1: Add the two new controls inside the Add form**

In `ContainersSettings.tsx`, find the `addContainerMode` block (around line 91-141) and add the toggle + conditional input *before* the `<div className="flex gap-2">` action row:

```tsx
<label className="flex items-center gap-2 cursor-pointer mt-1">
  <input
    type="checkbox"
    checked={!!newContainer.containerInternalPaths}
    onChange={(e) => setNewContainer({
      ...newContainer,
      containerInternalPaths: e.target.checked || undefined,
      worktreeBaseDir: e.target.checked ? newContainer.worktreeBaseDir : undefined
    })}
    className="accent-[var(--accent)]"
  />
  <span className="text-[11px]" style={{ color: 'var(--text-primary)' }}>
    Repos live inside container
  </span>
</label>
{newContainer.containerInternalPaths && (
  <input
    className="w-full text-[11px] px-2 py-1 rounded"
    style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
    placeholder="Worktree folder (e.g. /repos/worktrees)"
    value={newContainer.worktreeBaseDir ?? ''}
    onChange={(e) => setNewContainer({ ...newContainer, worktreeBaseDir: e.target.value || undefined })}
  />
)}
```

- [ ] **Step 2: Verify the Add button still validates**

The Add button currently only checks `newContainer.name.trim()`. We accept that an empty `worktreeBaseDir` while the toggle is on is OK *here* — the worktree UI itself enforces non-empty later. No change to the Add handler.

- [ ] **Step 3: Run dev mode and click through Add to verify**

```bash
pnpm dev
```

In CCC: Settings → Containers → "Add container" → toggle "Repos live inside container" → input field appears → fill in name + worktree path → click Add → row appears.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/settings/ContainersSettings.tsx
git commit -m "feat(settings): bunker fields in container add form"
```

---

## Task 5: Settings UI — make existing rows show + edit the bunker fields

**Files:**
- Modify: `src/renderer/components/settings/ContainersSettings.tsx`

- [ ] **Step 1: Show worktree base on the row when set**

In the rendered row (around line 62-88), after the `@{container.remoteHost}` chip and before the Edit/Trash buttons, add:

```tsx
{container.containerInternalPaths && (
  <span className="text-[9px] px-1 py-px rounded" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-raised)' }} title="Repos live inside container">
    /repos{container.worktreeBaseDir ? ` · wt:${container.worktreeBaseDir}` : ''}
  </span>
)}
```

- [ ] **Step 2: Expand edit mode to handle the new fields**

The current edit mode only edits `label` inline. Extend it: keep the inline label input, and below the label input render the same toggle + path field used in the Add form. Replace the `editContainerIdx === idx` branch (around line 43-60) with:

```tsx
<div className="flex flex-col gap-1.5 flex-1">
  <input
    className="w-full text-[11px] px-1.5 py-0.5 rounded"
    style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
    value={editContainerLabel}
    onChange={(e) => setEditContainerLabel(e.target.value)}
    placeholder="Label"
  />
  <label className="flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      checked={!!container.containerInternalPaths}
      onChange={(e) => {
        const updated = [...containers]
        updated[idx] = {
          ...updated[idx],
          containerInternalPaths: e.target.checked || undefined,
          worktreeBaseDir: e.target.checked ? updated[idx].worktreeBaseDir : undefined
        }
        void setContainers(updated)
      }}
      className="accent-[var(--accent)]"
    />
    <span className="text-[10px]" style={{ color: 'var(--text-primary)' }}>Repos live inside container</span>
  </label>
  {container.containerInternalPaths && (
    <input
      className="w-full text-[10px] px-1.5 py-0.5 rounded"
      style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
      placeholder="Worktree folder (e.g. /repos/worktrees)"
      value={container.worktreeBaseDir ?? ''}
      onChange={(e) => {
        const updated = [...containers]
        updated[idx] = { ...updated[idx], worktreeBaseDir: e.target.value || undefined }
        void setContainers(updated)
      }}
    />
  )}
</div>
<button onClick={() => {
  const updated = [...containers]
  updated[editContainerIdx!] = { ...updated[editContainerIdx!], label: editContainerLabel || undefined }
  void setContainers(updated)
  setEditContainerIdx(null)
}}>
  <Check size={12} style={{ color: 'var(--success)' }} />
</button>
```

(The toggle + path field write through immediately; only the label is buffered until the Check button confirms — matching existing label-edit behavior.)

- [ ] **Step 3: Verify typecheck and visual rendering**

```bash
pnpm typecheck
```

Then `pnpm dev` and verify: existing container rows show the new chip when `containerInternalPaths=true`; clicking the pencil on a container shows the expanded edit form.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/settings/ContainersSettings.tsx
git commit -m "feat(settings): edit + display bunker fields on container rows"
```

---

## Task 6: NewSessionModal — repo dropdown for bunker containers

**Files:**
- Modify: `src/renderer/components/NewSessionModal.tsx`

- [ ] **Step 1: Locate the working-directory and container state**

In `src/renderer/components/NewSessionModal.tsx`:
- `workingDirectory` and `setWorkingDirectory` state is at line 233
- `selectedContainer: string | undefined` (the chosen container's `name` only) is at line 245
- Working-directory picker JSX (the favorite-folder grid + manual input) is around lines 432–552

- [ ] **Step 2: Compute "is the selected container bunker-style"**

Near the other `useSessionStore` selectors at the top of the component (search for the existing `containers = useSessionStore(...)` if present, otherwise add it), add:

```tsx
const containers = useSessionStore((s) => s.containers)
const activeContainer = containers.find((c) => c.name === selectedContainer)
const isBunkerContainer = !!activeContainer?.containerInternalPaths

const [bunkerRepos, setBunkerRepos] = useState<string[]>([])
const [bunkerReposLoading, setBunkerReposLoading] = useState(false)

useEffect(() => {
  if (!isBunkerContainer || !activeContainer) {
    setBunkerRepos([])
    return
  }
  setBunkerReposLoading(true)
  window.cccAPI.container
    .listRepos(activeContainer.name, activeContainer.remoteHost)
    .then((repos) => setBunkerRepos(repos))
    .finally(() => setBunkerReposLoading(false))
}, [isBunkerContainer, activeContainer?.name, activeContainer?.remoteHost])
```

(Container `name` alone identifies the container in the existing UI — same convention as `containerName: selectedContainer` at line 313.)

- [ ] **Step 3: Render the dropdown when bunker, hide host folder picker**

Wrap the existing working-directory picker JSX with:

```tsx
{isBunkerContainer ? (
  <div>
    <FieldLabel>Repo</FieldLabel>
    {bunkerReposLoading ? (
      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Loading repos…</div>
    ) : bunkerRepos.length === 0 ? (
      <div className="text-[11px]" style={{ color: 'var(--error)' }}>
        No repos found in container at /repos
      </div>
    ) : (
      <select
        style={inputStyle}
        value={workingDirectory}
        onChange={(e) => setWorkingDirectory(e.target.value)}
      >
        <option value="">Select a repo…</option>
        {bunkerRepos.map((r) => (
          <option key={r} value={`/repos/${r}`}>{r}</option>
        ))}
      </select>
    )}
  </div>
) : (
  /* ...existing host folder picker JSX... */
)}
```

(Adjust to the modal's existing field-naming conventions. The key invariant: when `isBunkerContainer` and a repo is selected, `workingDirectory` is `/repos/<name>`.)

- [ ] **Step 4: Disable Create button when bunker + no repo selected**

Find the Create button's `disabled` prop and add:

```tsx
disabled={
  /* ...existing checks... */
  || (isBunkerContainer && !workingDirectory.startsWith('/repos/'))
}
```

- [ ] **Step 5: Verify typecheck + visual flow**

```bash
pnpm typecheck
```

Then `pnpm dev`: configure a bunker container in Settings, open New Session, select that container → repo dropdown appears with discovered repos → select one → Create.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/NewSessionModal.tsx
git commit -m "feat(session): repo dropdown via docker exec ls /repos for bunker containers"
```

---

## Task 7: git-service — add docker-exec backend to internal exec dispatch

**Files:**
- Modify: `src/main/git-service.ts`

- [ ] **Step 1: Extend `execDetailed` to accept a containerName**

Replace the existing `execDetailed` in `src/main/git-service.ts` (around line 23-47) with:

```ts
private execDetailed(
  args: string[],
  remoteHost?: string,
  timeoutMs = 10000,
  containerName?: string
): { stdout: string | null; stderr: string } {
  if (containerName) {
    const escaped = args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')
    if (remoteHost && this.sshService) {
      const hostConfig = this.configService?.get().remoteHosts?.find(h => h.name === remoteHost)
      const sshHost = hostConfig?.host ?? remoteHost
      const stdout = this.sshService.exec(sshHost, `docker exec ${containerName} sh -c "git ${escaped}"`)
      return { stdout, stderr: stdout === null ? 'remote docker exec git failed' : '' }
    }
    try {
      const stdout = execFileSync('docker', ['exec', containerName, 'sh', '-c', `git ${escaped}`], {
        encoding: 'utf-8',
        timeout: timeoutMs,
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim()
      return { stdout, stderr: '' }
    } catch (err) {
      const e = err as { stderr?: Buffer | string; message?: string }
      const stderr = (e.stderr ? e.stderr.toString() : e.message ?? 'unknown error').trim()
      return { stdout: null, stderr }
    }
  }
  if (remoteHost && this.sshService) {
    const hostConfig = this.configService?.get().remoteHosts?.find(h => h.name === remoteHost)
    const sshHost = hostConfig?.host ?? remoteHost
    const escaped = args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')
    const stdout = this.sshService.exec(sshHost, `git ${escaped}`)
    return { stdout, stderr: stdout === null ? 'remote git command failed' : '' }
  }
  try {
    const stdout = execFileSync('git', args, {
      encoding: 'utf-8',
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim()
    return { stdout, stderr: '' }
  } catch (err) {
    const e = err as { stderr?: Buffer | string; message?: string }
    const stderr = (e.stderr ? e.stderr.toString() : e.message ?? 'unknown error').trim()
    return { stdout: null, stderr }
  }
}
```

- [ ] **Step 2: Update the private `exec` wrapper to forward containerName**

Replace `exec` (around line 19-21):

```ts
private exec(args: string[], remoteHost?: string, containerName?: string): string | null {
  return this.execDetailed(args, remoteHost, 10000, containerName).stdout
}
```

- [ ] **Step 3: Verify typecheck still passes**

```bash
pnpm typecheck
```

(Existing callers don't pass `containerName` — typecheck stays clean because the parameter is optional.)

- [ ] **Step 4: Commit**

```bash
git add src/main/git-service.ts
git commit -m "feat(git): add docker-exec backend to internal git dispatch"
```

---

## Task 8: git-service — propagate `containerName` to public methods

**Files:**
- Modify: `src/main/git-service.ts`

- [ ] **Step 1: Update each public method's signature**

In `git-service.ts`, change the signatures of the six public methods to accept an optional trailing `containerName?: string` and forward it through `this.exec` / `this.execDetailed`:

- `listWorktrees(repoPath: string, remoteHost?: string, containerName?: string): Worktree[]`
- `addWorktree(repoPath: string, branch: string, targetPath: string, mode: WorktreeCreateMode, remoteHost?: string, containerName?: string): Worktree`
- `listBranches(repoPath: string, remoteHost?: string, containerName?: string): string[]`
- `fetchRemotes(repoPath: string, remoteHost?: string, containerName?: string): { ok: boolean; error?: string }`
- `getBranchMetadata(repoPath: string, remoteHost?: string, containerName?: string): BranchMetadata[]`
- (and `removeWorktree` if present)

For each, change the internal `exec(...)` / `execDetailed(...)` call to pass `containerName` as the new trailing argument. Also: when `containerName` is set, **skip the `repoPath.replace(/^~/, ...)` host-tilde-expansion** in `listWorktrees` (already gated by `remoteHost ? repoPath : ...` — extend that to `(remoteHost || containerName) ? repoPath : ...`).

For `syncPaths` (worktree-sync helper, around line 49): add a guard at the top:

```ts
if (containerName) return  // bunker worktrees do not get host-side path-syncing in v1
```

(Update `syncPaths` signature to accept `containerName` and pass it from `addWorktree`.)

- [ ] **Step 2: Verify typecheck passes after signature update**

```bash
pnpm typecheck
```

Expected: errors at every IPC handler call site (Task 9 fixes those).

- [ ] **Step 3: Commit**

```bash
git add src/main/git-service.ts
git commit -m "feat(git): pipe containerName through public git-service methods"
```

---

## Task 9: git IPC + preload + types — pass `containerName`

**Files:**
- Modify: `src/main/ipc/git.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Update IPC handler signatures**

In `src/main/ipc/git.ts`, every handler that accepts `repoPath, remoteHost` should also accept and forward `containerName`. Example for `git:list-worktrees`:

```ts
ipcMain.handle('git:list-worktrees', (_event, repoPath: string, remoteHost?: string, containerName?: string) => {
  return gitService.listWorktrees(repoPath, remoteHost, containerName)
})
```

Repeat for `addWorktree`, `removeWorktree`, `listBranches`, `fetchRemotes`, `getBranchMetadata`.

- [ ] **Step 2: Update preload's `git` block**

In `src/preload/index.ts`, find the `git:` block and append `containerName?: string` to each method's signature, forwarding to `ipcRenderer.invoke`. Example:

```ts
listWorktrees: (repoPath: string, remoteHost?: string, containerName?: string): Promise<Worktree[]> =>
  ipcRenderer.invoke('git:list-worktrees', repoPath, remoteHost, containerName),
```

- [ ] **Step 3: Update `GitAPI` in shared types**

In `src/shared/types.ts`, find the `git: { listWorktrees: ... }` block (around line 279) and append the trailing optional parameter to each signature.

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: errors will surface at the renderer call sites in BranchPicker, NewSessionModal, PrSidebar (Task 10 fixes those, but typecheck should now succeed for main+preload+types).

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/git.ts src/preload/index.ts src/shared/types.ts
git commit -m "feat(git): expose containerName on git API surface"
```

---

## Task 10: Renderer — pass `containerName` and `worktreeBaseDir` at call sites

**Files:**
- Modify: `src/renderer/components/BranchPicker.tsx`
- Modify: `src/renderer/components/NewSessionModal.tsx`

When the modal/picker context has a `containerName` whose `ContainerConfig` has `containerInternalPaths=true`, pass `containerName` to git API calls and use the container's `worktreeBaseDir` for new worktree paths. PrSidebar is intentionally untouched in v1 (its worktree-creation continues to write host folders only).

- [ ] **Step 1: BranchPicker — accept new prop and forward containerName**

In `src/renderer/components/BranchPicker.tsx`:
- Add `containerName?: string` to the component props interface
- At line 326: change `.getBranchMetadata(repoPath, remoteHost)` to `.getBranchMetadata(repoPath, remoteHost, containerName)`
- At line 349: change `.fetchRemotes(repoPath, remoteHost)` to `.fetchRemotes(repoPath, remoteHost, containerName)`

There is one `<BranchPicker` usage in the codebase (`NewSessionModal.tsx:736`). Add `containerName={activeContainer?.containerInternalPaths ? activeContainer.name : undefined}` to that usage so it forwards from the modal's container selection.

- [ ] **Step 2: NewSessionModal — branch addWorktree on bunker context**

In `src/renderer/components/NewSessionModal.tsx` around line 293, find the `window.cccAPI.git.addWorktree` call. Replace the worktree-target-path computation with:

```tsx
const repoName = workingDirectory.split('/').filter(Boolean).pop() ?? 'repo'
const baseDir = activeContainer?.containerInternalPaths
  ? (activeContainer.worktreeBaseDir ?? '/repos/worktrees')
  : useSessionStore.getState().worktreeBasePath  // existing host base path source
const targetPath = `${baseDir}/${branchChoice.branch}/${repoName}`

const worktree = await window.cccAPI.git.addWorktree(
  workingDirectory.trim(),
  branchChoice.branch,
  targetPath,
  branchChoice.mode,
  activeContainer?.remoteHost,
  activeContainer?.containerInternalPaths ? activeContainer.name : undefined
)
```

(The existing host base-path source in the modal — search for `worktreeBasePath` or similar in the file — should be reused for the non-bunker branch. If the modal currently inlines the path differently, preserve that path; only branch on `containerInternalPaths` to choose between the two.)

- [ ] **Step 3: Typecheck and visual smoke**

```bash
pnpm typecheck
pnpm dev
```

In CCC: open BranchPicker for a bunker container in NewSessionModal — branches list populates from the container's git. Create a worktree — it lands at `<worktreeBaseDir>/<branch>/<repo>` inside the container.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/BranchPicker.tsx src/renderer/components/NewSessionModal.tsx
git commit -m "feat(git): renderer call sites forward containerName + use worktreeBaseDir"
```

---

## Task 11: Build verification + manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Full build**

```bash
pnpm build
```

Expected: typecheck passes for both `node` and `web` configs; renderer + main + preload bundles produced; no warnings about missing types.

- [ ] **Step 2: Run the built app**

```bash
npx electron out/main/index.js --no-sandbox
```

(`--no-sandbox` only because of the local pnpm SUID-binary quirk — the production .deb sets it correctly.)

- [ ] **Step 3: End-to-end smoke test in CCC**

Run through this sequence without errors. Each item is a pass/fail:

1. **Add bunker container** — Settings → Containers → Add → name `wint-sandbox-bunker-main` → toggle "Repos live inside container" → enter `/repos/worktrees` → Add. Row shows the `/repos · wt:/repos/worktrees` chip.
2. **Edit existing container** — pencil-edit any container, see the new toggle + path field, change worktree path, see it persist after save.
3. **New session repo dropdown** — start the bunker container (`docker start wint-sandbox-bunker-main` outside CCC if not already running). In CCC: New Session → pick the bunker container → repo dropdown loads `/repos` contents.
4. **Session starts in correct dir** — pick a repo (e.g. `Core`) → create session → terminal lands in `/repos/Core` inside the container, prompt is the bunker shell.
5. **State badge** — start a Claude command inside the session → CCC shows `working` then `idle` based on OSC. (Hook-state files won't reach host, but that's expected.)
6. **Branch picker** — open BranchPicker for the bunker session → branches populate (these come from the container's git).
7. **Create worktree** — in BranchPicker, pick a remote-only branch → create worktree → it lands at `/repos/worktrees/<branch>/<repo>` inside the container.
8. **Empty repos handling** — temporarily edit a non-bunker container to set `containerInternalPaths` true and create a session — repo dropdown shows "No repos found in container at /repos" (since the container has no `/repos`). Revert this test container.
9. **Local non-bunker session unaffected** — start a normal local session in any of your existing favorite folders → working-directory picker still shows host paths, no regression.
10. **PrSidebar still works for host worktrees** — open PrSidebar, click create-worktree on any PR — worktree lands on host as before, no bunker involvement.

- [ ] **Step 4: If all pass, push the branch**

```bash
git push origin <branch-name>
```

(Confirm the branch name with the repo owner before pushing if it's a feature branch off main.)

---

## Out of Scope (recap from spec)

These are deliberately not built in v1:

- Auto-discovery from SandboxBunker's `instances.json`
- Pre-filling defaults from bunker conventions
- PR badges for bunker sessions
- File-transfer integration (`~/inbox`)
- Sidebar grouping for bunker instances
- Bunker-dashboard URL display in CCC
- Wint-specific naming or templates
