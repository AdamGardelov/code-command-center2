# Codex Provider Support — Design

**Date:** 2026-04-07
**Status:** Approved for planning

## Goal

Add OpenAI Codex CLI as a third AI provider alongside Claude Code and Gemini CLI, reusing the existing provider plumbing. Expose two opt-in launch flags (Full Auto, Danger Mode) that are hidden until the provider is enabled in Settings.

## Non-goals

- Codex config-dir routing (analogue of `claudeConfigRoutes`) — YAGNI until someone needs it.
- Default model selection (`-m`).
- Codex-specific state detection. The existing OSC parser + `~/.ccc/states/` hook system is provider-agnostic and already works for any tmux pane.

## Changes

### `src/shared/types.ts`

- `SessionType`: add `'codex'`.
- `AiProvider`: add `'codex'`.
- `Session`: add optional `codexFullAuto?: boolean` and `codexDangerBypass?: boolean` (mirrors the Claude-specific optional flags pattern).
- `SessionCreate`: same two optional fields.
- `CccConfig`: add `codexFullAuto: boolean` and `codexDangerouslyBypassApprovals: boolean`, both defaulting to `false`.

### `src/main/config-service.ts`

- Add defaults for the two new config fields in the defaults merge.

### `src/main/session-manager.ts`

- New helper mirroring `buildClaudeCmd`:
  ```ts
  function buildCodexCmd(fullAuto: boolean, dangerBypass: boolean): string {
    let cmd = 'codex'
    if (fullAuto) cmd += ' --full-auto'
    if (dangerBypass) cmd += ' --dangerously-bypass-approvals-and-sandbox'
    return cmd
  }
  ```
- Extend both the local spawn branch (~line 322–338) and the remote/SSH branch (~line 374–392) to handle `opts.type === 'codex'` by composing the command via `buildCodexCmd` and passing it into the tmux `new-session` / remote-shell path exactly like the Claude branch does.
- Effective-flag resolution (around lines 435–436) mirrors Claude: apply `codexFullAuto` / `codexDangerBypass` only when `opts.type === 'codex'`, falling back to config defaults when not passed explicitly.
- No PATH preflight (`isCodexInstalled`) — Gemini does not have one either; failure surfaces naturally from tmux.

### `src/renderer/stores/session-store.ts`

- Add store state + setters:
  - `codexFullAuto`, `setCodexFullAuto`
  - `codexDangerouslyBypassApprovals`, `setCodexDangerouslyBypassApprovals`
- Persist via `cccAPI.config.update`, symmetric to the existing Claude pair.

### `src/renderer/components/settings/ProvidersSettings.tsx`

- New card for Codex, structured like the Claude card:
  - Icon (see below) + "Codex CLI" label
  - Enable/Disable toggle writing to `enabledProviders`
  - When enabled: "Requires `codex` in PATH" note + collapsible **Settings** section
  - Settings section (hidden while the provider is disabled) contains:
    - **Full Auto** checkbox → `codexFullAuto`, helper: "Passes `--full-auto` to Codex on session start"
    - **Danger Mode** checkbox → `codexDangerouslyBypassApprovals`, warning-colored helper: "Warning: allows Codex to execute commands without confirmation (`--dangerously-bypass-approvals-and-sandbox`)"
- No config-routing UI.

#### Codex icon

Use the official Codex icon SVG (from `@lobehub/icons`, 24×24 viewBox, `currentColor` fill):

```tsx
<svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" clipRule="evenodd">
  <path d="M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.21-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.94-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z" />
</svg>
```

Use the same icon (in a larger size if appropriate) wherever Codex needs visual representation (sidebar, new-session modal, empty state).

### `src/renderer/components/NewSessionModal.tsx`

- Add Codex as a selectable session type, gated on `enabledProviders.includes('codex')`, alongside the existing Claude/Gemini entries.

### `src/renderer/components/SessionSidebar.tsx`, `EmptyState.tsx`

- Add Codex icon + label wherever provider icons/labels appear today.

## Testing

Manual verification:

- Toggle Codex off → settings rows (Full Auto, Danger Mode) are not visible; Codex not selectable in New Session modal.
- Toggle Codex on → settings rows appear; Codex selectable.
- Create a local Codex session with each of the four flag combinations and verify the spawned tmux command matches expectations.
- Create a remote/SSH Codex session and verify the same via the SSH branch.
- Create a Gemini and Claude session to confirm no regression.
- `pnpm typecheck` and `pnpm lint` pass.
