# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Code Command Center 2 (CCC2) — an Electron desktop app for managing tmux/Claude Code sessions with a terminal UI. Built with React 19, TypeScript, Zustand, xterm.js, and Tailwind CSS 4.

## Commands

- `pnpm dev` — run in dev mode (electron-vite)
- `pnpm build` — typecheck + build
- `pnpm typecheck` — run both `typecheck:node` and `typecheck:web`
- `pnpm lint` — ESLint
- `pnpm format` — Prettier
- `pnpm rebuild` — rebuild native modules (node-pty)
- `pnpm build:linux` / `pnpm build:mac` / `pnpm build:win` — platform builds

Node version: 24 (see .nvmrc). Package manager: pnpm.

## Architecture

Electron app with three compile targets (configured via electron-vite):

**Main process** (`src/main/`) — Node.js backend services:
- `session-manager.ts` — tmux session lifecycle (create, list, kill, status)
- `pty-manager.ts` — PTY/terminal management via node-pty
- `config-service.ts` — persistent config at `~/.ccc/config.json`
- `state-detector.ts` — detects session state via OSC escape sequences and hook files at `~/.ccc/states/`
- `pr-service.ts` — GitHub PR polling
- `git-service.ts` — git worktree operations (local and SSH)
- `ipc/` — IPC handler modules (session, terminal, config, git, group, host, shell, clipboard)

**Preload** (`src/preload/`) — context bridge exposing `cccAPI` to renderer.

**Renderer** (`src/renderer/`) — React UI:
- `stores/session-store.ts` — Zustand store, single source of truth for UI state
- `hooks/useTerminal.ts` — xterm.js terminal setup, fit, resize, attach/detach
- `hooks/useKeyboard.ts` — keyboard shortcuts
- `components/` — Layout, SessionSidebar, TerminalPanel, GridView, SettingsModal, etc.

**Shared** (`src/shared/types.ts`) — TypeScript interfaces shared across all targets.

## Key Patterns

**IPC**: `ipcMain.handle()`/`ipcRenderer.invoke()` for request-response. `ipcMain.on()`/`send()` for one-way events. Renderer listens for broadcasts (terminal:data, session:state-changed) via `cccAPI`.

**State flow**: Main process services → IPC events → Zustand store → React components. App.tsx sets up IPC subscriptions that sync main process state into Zustand.

**Session state detection**: OSC parser reads terminal escape sequences + hook-based detector scans `~/.ccc/states/` files. States: idle → working → waiting → stopped/error.

**Config**: `~/.ccc/config.json` with defaults merged in ConfigService. Safe updates with validation.
