# Code Command Center 2

Manage Claude Code sessions from your desktop. An Electron app for monitoring and controlling tmux sessions, with live terminal UI and automatic updates.

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

## Development

Requirements: Node 24 (see `.nvmrc`), pnpm.

```bash
pnpm install
pnpm dev         # Run in dev mode (electron-vite)
pnpm build       # Typecheck + build
pnpm lint        # ESLint
pnpm format      # Prettier
pnpm rebuild     # Rebuild native modules (node-pty)
```

Platform-specific builds:
```bash
pnpm build:linux
pnpm build:mac
pnpm build:win
```

## Architecture

**Electron app** with three compile targets:

- **Main process** (`src/main/`) — Node.js backend: session manager, PTY, config, git worktree ops, IPC handlers
- **Preload** (`src/preload/`) — Context bridge exposing `cccAPI` to renderer
- **Renderer** (`src/renderer/`) — React 19 UI with Zustand state, xterm.js terminal, Tailwind CSS

See `CLAUDE.md` for detailed architecture and patterns.

## License

MIT
