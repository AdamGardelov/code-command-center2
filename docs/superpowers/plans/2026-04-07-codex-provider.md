# Codex Provider Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the OpenAI Codex CLI as a third AI provider (alongside Claude Code and Gemini CLI), with opt-in `--full-auto` and `--dangerously-bypass-approvals-and-sandbox` flags hidden until the provider is enabled.

**Architecture:** Codex reuses the existing shallow provider plumbing. Types gain a new `'codex'` union member. `session-manager.ts` gets a `buildCodexCmd` helper paralleling `buildClaudeCmd`, and the four launch branches (local/remote × plain/container) grow a Codex case. Renderer surfaces it in Providers settings (with hidden-until-enabled checkboxes), the New Session modal, and the SessionSidebar categories. State detection is provider-agnostic and unchanged.

**Tech Stack:** TypeScript, Electron, React 19, Zustand, Tailwind CSS 4, tmux, node-pty. Package manager pnpm. Build: electron-vite.

**Spec:** `docs/superpowers/specs/2026-04-07-codex-provider-design.md`

**Verification commands:**
- `pnpm typecheck` (runs typecheck:node + typecheck:web)
- `pnpm lint`
- `pnpm build`

There are no automated unit tests in this project, so each task ends with typecheck + lint + manual verification instructions and a commit.

---

## File Structure

**Modify:**
- `src/shared/types.ts` — union types + optional session fields + config fields
- `src/main/config-service.ts` — defaults + load-time parsing for new config fields
- `src/main/session-manager.ts` — `buildCodexCmd` helper + four launch branches
- `src/renderer/stores/session-store.ts` — new store state + setters
- `src/renderer/components/settings/ProvidersSettings.tsx` — Codex provider card
- `src/renderer/components/NewSessionModal.tsx` — Codex icon + selectable type + Codex flag UI
- `src/renderer/components/SessionSidebar.tsx` — Codex icon + category

**Reused shared icon:** The Codex SVG (24×24, `currentColor`) from `@lobehub/icons`. The path is duplicated inline in both `NewSessionModal.tsx` and `SessionSidebar.tsx` to match how `ClaudeIcon`/`GeminiIcon` are currently defined. No shared icon module — follow existing pattern, do not refactor.

---

## Task 1: Extend shared types

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add `'codex'` to `SessionType` and `AiProvider`**

Change `src/shared/types.ts` line 3:

```ts
export type SessionType = 'claude' | 'gemini' | 'shell' | 'codex'
```

and line 5:

```ts
export type AiProvider = 'claude' | 'gemini' | 'codex'
```

- [ ] **Step 2: Add Codex flags to `Session` interface**

In the `Session` interface (around lines 7–26), add two optional fields after `enableAutoMode?: boolean`:

```ts
  codexFullAuto?: boolean
  codexDangerBypass?: boolean
```

- [ ] **Step 3: Add Codex flags to `SessionCreate` interface**

In `SessionCreate` (around lines 28–36), add after `enableAutoMode?: boolean`:

```ts
  codexFullAuto?: boolean
  codexDangerBypass?: boolean
```

- [ ] **Step 4: Add Codex defaults to `CccConfig` interface**

In `CccConfig` (around lines 155–183), add two new fields next to `dangerouslySkipPermissions` / `enableAutoMode`:

```ts
  codexFullAuto: boolean
  codexDangerouslyBypassApprovals: boolean
```

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: Will likely fail with "Property 'codexFullAuto' is missing in type" errors pointing at `config-service.ts` and `session-store.ts`. That is expected — those are fixed in later tasks. Proceed without committing.

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts
git commit -m "types: add codex session type and config fields"
```

---

## Task 2: Config service defaults and parsing

**Files:**
- Modify: `src/main/config-service.ts`

- [ ] **Step 1: Add defaults to `DEFAULT_CONFIG`**

In `src/main/config-service.ts`, the `DEFAULT_CONFIG` object (lines 8–33) add next to `dangerouslySkipPermissions: false,` / `enableAutoMode: false,`:

```ts
  codexFullAuto: false,
  codexDangerouslyBypassApprovals: false,
```

- [ ] **Step 2: Parse them when loading config from disk**

In the `load()` method where parsed fields are assigned (starting around line 46), add next to the existing `dangerouslySkipPermissions` / `enableAutoMode` lines:

```ts
          codexFullAuto: parsed.codexFullAuto === true,
          codexDangerouslyBypassApprovals: parsed.codexDangerouslyBypassApprovals === true,
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: Still failing in `session-store.ts` (expected — fixed later), but no new errors in `config-service.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/main/config-service.ts
git commit -m "config: default codex launch flags to false"
```

---

## Task 3: Codex command builder + launch branches

**Files:**
- Modify: `src/main/session-manager.ts`

- [ ] **Step 1: Add `buildCodexCmd` helper**

Immediately after `buildClaudeCmd` (lines 5–10), add:

```ts
function buildCodexCmd(fullAuto: boolean, dangerBypass: boolean): string {
  let cmd = 'codex'
  if (fullAuto) cmd += ' --full-auto'
  if (dangerBypass) cmd += ' --dangerously-bypass-approvals-and-sandbox'
  return cmd
}
```

- [ ] **Step 2: Extend the remote container branch**

In `session-manager.ts` around lines 320–329 (the `if (opts.containerName) { ... }` block inside the `isRemote` branch), replace the `cmd` assignment ternary with:

```ts
        const cmd = opts.type === 'claude'
          ? buildClaudeCmd(
              opts.skipPermissions ?? cfg?.dangerouslySkipPermissions ?? false,
              opts.enableAutoMode ?? cfg?.enableAutoMode ?? false
            )
          : opts.type === 'gemini'
            ? 'gemini'
            : opts.type === 'codex'
              ? buildCodexCmd(
                  opts.codexFullAuto ?? cfg?.codexFullAuto ?? false,
                  opts.codexDangerBypass ?? cfg?.codexDangerouslyBypassApprovals ?? false
                )
              : ''
```

- [ ] **Step 3: Extend the remote plain branch**

In the `else if (opts.type === 'gemini')` block at lines 338–340, add a new branch right after it (before the closing `}` of `isRemote`):

```ts
      else if (opts.type === 'codex') {
        const cfg = this.configService?.get()
        const cmd = buildCodexCmd(
          opts.codexFullAuto ?? cfg?.codexFullAuto ?? false,
          opts.codexDangerBypass ?? cfg?.codexDangerouslyBypassApprovals ?? false
        )
        newArgs.push('--', remoteShell, '-ic', `cd ${opts.workingDirectory} && ${cmd}`)
      }
```

- [ ] **Step 4: Extend the local container branch**

In `session-manager.ts` around lines 372–381 (`if (opts.containerName)` inside the local else-branch), replace the ternary the same way as Step 2:

```ts
        const cmd = opts.type === 'claude'
          ? buildClaudeCmd(
              opts.skipPermissions ?? cfg?.dangerouslySkipPermissions ?? false,
              opts.enableAutoMode ?? cfg?.enableAutoMode ?? false
            )
          : opts.type === 'gemini'
            ? 'gemini'
            : opts.type === 'codex'
              ? buildCodexCmd(
                  opts.codexFullAuto ?? cfg?.codexFullAuto ?? false,
                  opts.codexDangerBypass ?? cfg?.codexDangerouslyBypassApprovals ?? false
                )
              : ''
```

- [ ] **Step 5: Extend the local plain branch**

After the `else if (opts.type === 'gemini')` block at lines 390–393, add:

```ts
      } else if (opts.type === 'codex') {
        const cfg = this.configService?.get()
        const cmd = buildCodexCmd(
          opts.codexFullAuto ?? cfg?.codexFullAuto ?? false,
          opts.codexDangerBypass ?? cfg?.codexDangerouslyBypassApprovals ?? false
        )
        const shell = process.env.SHELL || '/bin/bash'
        args.push('--', shell, '-ic', cmd)
```

- [ ] **Step 6: Persist Codex flags on the returned `Session`**

In the `Session` object at lines 425–441, add next to `skipPermissions` / `enableAutoMode`:

```ts
      codexFullAuto: (opts.codexFullAuto ?? this.configService?.get().codexFullAuto) && opts.type === 'codex' ? true : undefined,
      codexDangerBypass: (opts.codexDangerBypass ?? this.configService?.get().codexDangerouslyBypassApprovals) && opts.type === 'codex' ? true : undefined,
```

- [ ] **Step 7: Typecheck**

Run: `pnpm typecheck`
Expected: The only remaining errors should be in `session-store.ts` and the renderer components touched in later tasks.

- [ ] **Step 8: Commit**

```bash
git add src/main/session-manager.ts
git commit -m "session-manager: launch codex sessions with opt-in flags"
```

---

## Task 4: Session store state and setters

**Files:**
- Modify: `src/renderer/stores/session-store.ts`

- [ ] **Step 1: Add store state fields**

In the `SessionStore` interface (around lines 27–28), add next to `dangerouslySkipPermissions` / `enableAutoMode`:

```ts
  codexFullAuto: boolean
  codexDangerouslyBypassApprovals: boolean
```

- [ ] **Step 2: Add setter signatures**

In the same interface (around lines 56–57), add next to `setDangerouslySkipPermissions` / `setEnableAutoMode`:

```ts
  setCodexFullAuto: (value: boolean) => Promise<void>
  setCodexDangerouslyBypassApprovals: (value: boolean) => Promise<void>
```

- [ ] **Step 3: Add initial state values**

In the `create<SessionStore>((set, get) => ({ ... }))` literal (lines 112–113 have `dangerouslySkipPermissions: false,` and `enableAutoMode: false,`). Add next to them:

```ts
  codexFullAuto: false,
  codexDangerouslyBypassApprovals: false,
```

- [ ] **Step 4: Hydrate from config in `loadConfig`**

At lines 144–145 (`dangerouslySkipPermissions: config.dangerouslySkipPermissions ?? false,` and the next line), add:

```ts
      codexFullAuto: config.codexFullAuto ?? false,
      codexDangerouslyBypassApprovals: config.codexDangerouslyBypassApprovals ?? false,
```

- [ ] **Step 5: Implement setters**

Right after the existing `setEnableAutoMode` block (around line 384–387), add:

```ts
  setCodexFullAuto: async (value: boolean) => {
    await window.cccAPI.config.update({ codexFullAuto: value })
    set({ codexFullAuto: value })
  },

  setCodexDangerouslyBypassApprovals: async (value: boolean) => {
    await window.cccAPI.config.update({ codexDangerouslyBypassApprovals: value })
    set({ codexDangerouslyBypassApprovals: value })
  },
```

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: No errors from `session-store.ts` or any main-process files. Errors may remain in the renderer components touched in later tasks.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/stores/session-store.ts
git commit -m "session-store: expose codex flag state and setters"
```

---

## Task 5: Providers settings — Codex card

**Files:**
- Modify: `src/renderer/components/settings/ProvidersSettings.tsx`

- [ ] **Step 1: Wire the new store selectors**

At the top of the `ProvidersSettings` function (after the existing selectors for `enableAutoMode` / `dangerouslySkipPermissions` around lines 9–12), add:

```tsx
  const codexFullAuto = useSessionStore(s => s.codexFullAuto)
  const setCodexFullAuto = useSessionStore(s => s.setCodexFullAuto)
  const codexDangerouslyBypassApprovals = useSessionStore(s => s.codexDangerouslyBypassApprovals)
  const setCodexDangerouslyBypassApprovals = useSessionStore(s => s.setCodexDangerouslyBypassApprovals)
  const [codexSettingsOpen, setCodexSettingsOpen] = useState(false)
```

- [ ] **Step 2: Add the Codex card after the Gemini card**

Immediately before the closing `</div>` of the outer flex container (after the Gemini card block that ends around line 280), append:

```tsx
      {/* Codex */}
      <div
        className="rounded-lg border"
        style={{ borderColor: 'var(--bg-raised)' }}
      >
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" clipRule="evenodd" style={{ color: 'var(--text-primary)' }}>
                <path d="M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.21-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.94-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z" />
              </svg>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Codex CLI</span>
            </div>
            <button
              onClick={() => toggleProvider('codex')}
              className="px-3 py-1 rounded text-[10px] font-medium transition-colors"
              style={{
                backgroundColor: enabledProviders.includes('codex') ? 'var(--success)' : 'var(--bg-raised)',
                color: enabledProviders.includes('codex') ? '#1d1f21' : 'var(--text-muted)'
              }}
            >
              {enabledProviders.includes('codex') ? 'Enabled' : 'Disabled'}
            </button>
          </div>
          {enabledProviders.includes('codex') && (
            <>
              <div className="mt-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Requires <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-raised)' }}>codex</code> in PATH
              </div>
              <button
                onClick={() => setCodexSettingsOpen(!codexSettingsOpen)}
                className="flex items-center gap-1 mt-3 text-[10px] font-medium transition-colors hover:text-[var(--accent)]"
                style={{ color: 'var(--text-muted)' }}
              >
                {codexSettingsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Settings
              </button>
            </>
          )}
        </div>

        {enabledProviders.includes('codex') && codexSettingsOpen && (
          <div
            className="px-4 pb-4 pt-2 border-t space-y-4"
            style={{ borderColor: 'var(--bg-raised)' }}
          >
            <div>
              <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Full Auto</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={codexFullAuto}
                  onChange={(e) => setCodexFullAuto(e.target.checked)}
                  className="rounded accent-[var(--accent)]"
                />
                <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
                  Enable full auto by default for new sessions
                </span>
              </label>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                Passes --full-auto to Codex on session start
              </p>
            </div>

            <div>
              <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Danger Mode</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={codexDangerouslyBypassApprovals}
                  onChange={(e) => setCodexDangerouslyBypassApprovals(e.target.checked)}
                  className="rounded accent-[var(--accent)]"
                />
                <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
                  Pass --dangerously-bypass-approvals-and-sandbox to new sessions
                </span>
              </label>
              <p className="text-[10px] mt-1" style={{ color: 'var(--warning, #f59e0b)' }}>
                Warning: This allows Codex to execute commands without confirmation or sandboxing
              </p>
            </div>
          </div>
        )}
      </div>
```

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: Pass for this file. Remaining errors only in the other renderer components.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/settings/ProvidersSettings.tsx
git commit -m "settings: add codex provider card with opt-in launch flags"
```

---

## Task 6: New Session modal — Codex type

**Files:**
- Modify: `src/renderer/components/NewSessionModal.tsx`

- [ ] **Step 1: Add a `CodexIcon` helper**

After the existing `GeminiIcon` function (line 15–21), add:

```tsx
function CodexIcon({ size = 14 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" clipRule="evenodd">
      <path d="M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.21-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.94-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z" />
    </svg>
  )
}
```

- [ ] **Step 2: Pull Codex defaults from the store**

Next to the existing `defaultAutoMode` / `defaultSkipPermissions` selectors (lines 34–35), add:

```tsx
  const defaultCodexFullAuto = useSessionStore((s) => s.codexFullAuto)
  const defaultCodexDangerBypass = useSessionStore((s) => s.codexDangerouslyBypassApprovals)
```

- [ ] **Step 3: Add local state for the Codex checkboxes**

Next to the existing local `enableAutoMode` / `skipPermissions` useState calls (lines 49–50), add:

```tsx
  const [codexFullAuto, setCodexFullAuto] = useState(defaultCodexFullAuto)
  const [codexDangerBypass, setCodexDangerBypass] = useState(defaultCodexDangerBypass)
```

- [ ] **Step 4: Pass Codex flags when creating the session**

In the `createSession` call at lines 131–139, add next to `enableAutoMode` / `skipPermissions`:

```tsx
        codexFullAuto: type === 'codex' ? codexFullAuto : undefined,
        codexDangerBypass: type === 'codex' ? codexDangerBypass : undefined,
```

- [ ] **Step 5: Reset Codex flags after create**

In the reset block at lines 149–150 (`setEnableAutoMode(false); setSkipPermissions(false)`), add:

```tsx
      setCodexFullAuto(false)
      setCodexDangerBypass(false)
```

- [ ] **Step 6: Add Codex to `typeButtons`**

At lines 165–172, after the Gemini push and before the Shell push, add:

```tsx
  if (enabledProviders.includes('codex')) {
    typeButtons.push({ type: 'codex', label: 'Codex', icon: <CodexIcon size={14} /> })
  }
```

- [ ] **Step 7: Show Codex flag toggles when Codex is selected**

Immediately after the closing `)}` of the existing `{type === 'claude' && ( ... )}` block at line 375, add a sibling block:

```tsx
          {type === 'codex' && (
            <div className="flex flex-col gap-2">
              <label
                className="flex items-center gap-2 cursor-pointer select-none"
                style={{ color: codexFullAuto ? 'var(--accent)' : 'var(--text-muted)' }}
              >
                <input
                  type="checkbox"
                  checked={codexFullAuto}
                  onChange={(e) => setCodexFullAuto(e.target.checked)}
                  className="sr-only peer"
                />
                <div
                  className="w-7 h-4 rounded-full relative transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)]"
                  style={{ backgroundColor: codexFullAuto ? 'var(--accent)' : 'var(--bg-raised)' }}
                >
                  <div
                    className="absolute top-0.5 w-3 h-3 rounded-full transition-transform duration-150"
                    style={{
                      backgroundColor: codexFullAuto ? 'var(--bg-primary)' : 'var(--text-muted)',
                      transform: codexFullAuto ? 'translateX(14px)' : 'translateX(2px)'
                    }}
                  />
                </div>
                <Bot size={12} />
                <span className="text-xs">Full auto</span>
              </label>
              <label
                className="flex items-center gap-2 cursor-pointer select-none"
                style={{ color: codexDangerBypass ? 'var(--warning, #e9c880)' : 'var(--text-muted)' }}
              >
                <input
                  type="checkbox"
                  checked={codexDangerBypass}
                  onChange={(e) => setCodexDangerBypass(e.target.checked)}
                  className="sr-only peer"
                />
                <div
                  className="w-7 h-4 rounded-full relative transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)]"
                  style={{ backgroundColor: codexDangerBypass ? 'var(--warning, #e9c880)' : 'var(--bg-raised)' }}
                >
                  <div
                    className="absolute top-0.5 w-3 h-3 rounded-full transition-transform duration-150"
                    style={{
                      backgroundColor: codexDangerBypass ? 'var(--bg-primary)' : 'var(--text-muted)',
                      transform: codexDangerBypass ? 'translateX(14px)' : 'translateX(2px)'
                    }}
                  />
                </div>
                <Zap size={12} />
                <span className="text-xs">Danger mode</span>
              </label>
            </div>
          )}
```

- [ ] **Step 8: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: No errors from this file. `SessionSidebar.tsx` is the last remaining touch.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/components/NewSessionModal.tsx
git commit -m "new-session: add codex as selectable provider with flag toggles"
```

---

## Task 7: SessionSidebar — Codex category

**Files:**
- Modify: `src/renderer/components/SessionSidebar.tsx`

- [ ] **Step 1: Add `CodexIcon` helper**

After the existing `ClaudeIcon` function (lines 16–22), add:

```tsx
function CodexIcon({ size = 12 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" clipRule="evenodd" style={{ color: 'var(--text-secondary)' }}>
      <path d="M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.21-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.94-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z" />
    </svg>
  )
}
```

- [ ] **Step 2: Add the ungrouped filter inside `MachineGroup`**

At lines 150–152 there are three existing `ungroupedSessions.filter(...)` lines. Add after the `gemini` line:

```ts
  const codexUngrouped = ungroupedSessions.filter(s => s.type === 'codex')
```

- [ ] **Step 3: Render a Codex Category inside `MachineGroup`**

Directly after the `geminiUngrouped` Category block (lines 210–219) and before the `shellUngrouped` block, add:

```tsx
          {codexUngrouped.length > 0 && (
            <Category
              icon={<CodexIcon size={12} />}
              label="Codex"
              count={codexUngrouped.length}
              sessions={codexUngrouped}
              activeSessionId={activeSessionId}
              onSelect={onSelect}
            />
          )}
```

- [ ] **Step 4: Add the top-level Codex filter and Category (non-remote branch)**

At line 261 there is `const geminiSessions = activeSessions.filter((s) => s.type === 'gemini')`. Add after it:

```ts
  const codexSessions = activeSessions.filter((s) => s.type === 'codex')
```

Then, in the JSX at lines 352–360 there is the `geminiSessions.length > 0 && <Category ... />` block. Immediately after that block, add a matching Codex block:

```tsx
            {codexSessions.length > 0 && (
              <Category
                icon={<CodexIcon size={12} />}
                label="Codex"
                count={codexSessions.length}
                sessions={codexSessions}
                activeSessionId={activeSessionId}
                onSelect={setActiveSession}
              />
            )}
```

- [ ] **Step 5: Typecheck, lint, and build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: All three pass cleanly.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/SessionSidebar.tsx
git commit -m "sidebar: add codex category and icon"
```

---

## Task 8: Manual verification

**Files:** (none — runtime checks only)

- [ ] **Step 1: Start the app in dev mode**

Run: `pnpm dev`
Expected: The app launches without runtime errors in the electron-vite terminal output.

- [ ] **Step 2: Confirm Codex is hidden when disabled**

In Settings → Providers, verify:
- Codex card is present after the Gemini card
- Toggle shows "Disabled"
- No Full Auto / Danger Mode rows are rendered
- Open New Session modal — no "Codex" button in the type selector

- [ ] **Step 3: Enable Codex and verify the settings surface**

In Settings → Providers → Codex:
- Click the toggle → shows "Enabled"
- "Requires `codex` in PATH" note appears
- Click "Settings" → panel expands with Full Auto and Danger Mode checkboxes
- Toggle each checkbox; reload app; verify they persisted (check `~/.ccc/config.json` contains `codexFullAuto` and `codexDangerouslyBypassApprovals`)

- [ ] **Step 4: Verify the New Session modal shows Codex**

- Open New Session. "Codex" button appears in the type selector with the Codex icon.
- Select Codex. The Full Auto / Danger Mode toggle row appears between the type buttons and the session-name field.
- Confirm the row disappears when switching to Claude / Gemini / Shell and reappears for Codex.

- [ ] **Step 5: Launch a Codex session (four flag combinations)**

For each of `{fullAuto=false, danger=false}`, `{true,false}`, `{false,true}`, `{true,true}`:
- Create a new local Codex session with a dummy working directory such as `~/tmp` (make sure `codex` exists in PATH — `which codex`).
- Attach to the tmux session externally with `tmux attach -t ccc-<name>` or read the pane with `tmux capture-pane -t ccc-<name> -p` and confirm the launched command matches the expected flags, e.g. `codex --full-auto --dangerously-bypass-approvals-and-sandbox`.
- Kill the session from the sidebar.

- [ ] **Step 6: Verify the sidebar category**

With at least one active Codex session, confirm the Codex category appears in the sidebar (both the non-remote flat view and, if a remote host is configured, inside the MachineGroup for that host).

- [ ] **Step 7: Regression check**

Create one Claude session and one Gemini session with their existing defaults and confirm they still launch correctly. Kill them.

- [ ] **Step 8: Stop dev server**

Ctrl+C in the `pnpm dev` terminal.

- [ ] **Step 9: (Nothing to commit — verification only)**

---

## Self-review notes

- **Spec coverage:** Each section of the spec (`types.ts` additions, `config-service.ts` defaults, `session-manager.ts` four branches + helper + Session flags, store state/setters, ProvidersSettings Codex card with hidden-until-enabled settings, NewSessionModal type button + per-session toggles, SessionSidebar icon + category, no config routing, no state-detector changes) maps to a concrete task above.
- **Icon source:** The SVG path comes from `@lobehub/icons` Codex icon (24×24, `currentColor`). It is duplicated in three components because that matches the existing ClaudeIcon/GeminiIcon pattern — no shared module.
- **Testing:** No unit-test harness exists in this repo (pre-existing fact), so verification uses `pnpm typecheck`, `pnpm lint`, `pnpm build`, plus explicit manual steps in Task 8.
