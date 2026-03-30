# Code Command Center (CCC) — UI Shell Design

## Overview

Electron-app för att hantera Claude Code-sessioner. Denna spec täcker fas 1: en fungerande UI-shell med mock-data, Zustand state management och fungerande navigation — utan backend/PTY-integration.

Target: macOS och Linux (Ubuntu).

## Tech Stack

| Paket | Version |
|-------|---------|
| Electron | 41.x |
| electron-vite | 5.x |
| React | 19.2.x |
| TypeScript | 5.x |
| Tailwind CSS | 4.2.x |
| Zustand | latest |
| Lucide React | latest |
| react-grid-layout | latest |

## Visuell Design

### Färgpalett

- **Bakgrund:** #0a0a0f (nästan svart)
- **Surface:** #111118 (sidebar, cards)
- **Surface raised:** #1a1a24 (borders, hover states)
- **Text primary:** #ffffff
- **Text secondary:** #888888
- **Text muted:** #555555
- **Accent:** #f59e0b (amber) — aktiva element, statusindikatorer, fokus
- **Accent muted:** rgba(245, 158, 11, 0.12) — bakgrund för aktiva items
- **Success:** #10b981 (grön) — running status
- **Error:** #ef4444 (röd) — error status

### Typografi

- **Terminal/kod:** JetBrains Mono (Google Fonts eller bundlad)
- **UI-labels:** System sans-serif (-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)

### Animationer

- Session-byte: 150ms ease opacity crossfade
- Sidebar collapse: 200ms ease width transition
- Modal: 150ms ease scale + opacity
- Hover states: 100ms ease

## Layout

Fullscreen, frameless window med custom titlebar.

```
┌─────────────────────────────────────────────────┐
│ TitleBar (36px) — drag region + window controls  │
├──────────┬──────────────────────────────────────┤
│ Sidebar  │                                      │
│ (260px)  │  Main Area                           │
│          │  - Single mode: en TerminalPanel      │
│          │  - Grid mode: free drag layout        │
│ Sessions │                                      │
│ list     │                                      │
│          │                                      │
│ [+] New  │                                      │
│          │                                      │
│ mode     │                                      │
│ toggle   │                                      │
├──────────┴──────────────────────────────────────┤
│ StatusBar (28px) — session count, active name    │
└─────────────────────────────────────────────────┘
```

### Sidebar (260px, collapsible)

- Header: "Sessions" label
- Session list: SessionCard-komponenter med namn, status-dot, relativ tid
- "New Session" knapp (+ ikon) längst ner eller top
- Mode toggle: Single / Grid knappar längst ner
- Collapsible: Cmd/Ctrl+B togglar sidebar (0px eller 260px med transition)

### Main Area

**Single mode (default):**
- En TerminalPanel fyller hela ytan
- EmptyState visas om inga sessioner finns

**Grid mode:**
- Free drag layout via react-grid-layout
- Varje synlig session renderas som en panel med header (namn + drag handle)
- Paneler kan resizas fritt (dra kanter/hörn)
- Drag-and-drop för att byta plats
- Dubbelklick på panel → maximera (tillbaka till single mode med den sessionen)
- Aktiv/fokuserad panel har amber border

### TitleBar (36px)

- Frameless: `BrowserWindow` med `frame: false`
- Vänster: Trafikljus-dots (macOS) eller standard controls
- Center: App-namn + aktiv sessions namn
- Höger: Window controls (minimize, maximize, close)
- Hela ytan utom knappar: `-webkit-app-region: drag`

### StatusBar (28px)

- Vänster: Session count ("4 sessions")
- Center: Aktiv session ("Active: api-server")
- Höger: View mode ("Grid 2×2" / "Single")

## Datamodell

```typescript
// shared/types.ts

interface Session {
  id: string;
  name: string;
  workingDirectory: string;
  status: 'running' | 'stopped' | 'error';
  createdAt: number;
  lastActiveAt: number;
}

interface SessionCreate {
  name: string;
  workingDirectory: string;
}

type ViewMode = 'single' | 'grid';

// Grid layout per panel (react-grid-layout format)
interface GridItem {
  i: string;      // session id
  x: number;
  y: number;
  w: number;
  h: number;
}
```

## Zustand Store

```typescript
interface SessionStore {
  // State
  sessions: Session[];
  activeSessionId: string | null;
  viewMode: ViewMode;
  sidebarOpen: boolean;
  gridLayout: GridItem[];

  // Actions
  createSession: (opts: SessionCreate) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleSidebar: () => void;
  updateGridLayout: (layout: GridItem[]) => void;
  nextSession: () => void;
  prevSession: () => void;
}
```

Mock-data: 3-4 fördefinierade sessioner laddas vid app-start för att testa UI.

## Komponenter

### Layout.tsx
Rot-komponent. CSS grid med titlebar, sidebar, main, statusbar. Hanterar sidebar collapse.

### TitleBar.tsx
Custom titlebar med drag region och window controls. Visar aktiv sessions namn. IPC till main process för minimize/maximize/close.

### SessionSidebar.tsx
Listar SessionCards. "New Session"-knapp öppnar modal. Mode toggle (Single/Grid) längst ner.

### SessionCard.tsx
Visar sessions namn, status-dot (amber=running, grå=stopped, röd=error), relativ tid ("2m ago"). Klick → setActiveSession. Aktiv session har amber vänsterborder + highlighted bakgrund.

### TerminalPanel.tsx
I denna fas: mock terminal-vy med statisk text som simulerar Claude Code-output. Svart bakgrund, monospace text. I framtida fas: xterm.js.

### GridView.tsx
Wrapper kring react-grid-layout. Renderar en TerminalPanel per session (alla sessioner visas i grid mode). Hanterar drag, drop, resize. Skickar layout-ändringar till Zustand store.

### NewSessionModal.tsx
Overlay modal med form: session-namn (input) + working directory (input, i denna fas fritext). "Create" och "Cancel" knappar. Skapar session i Zustand store.

### StatusBar.tsx
Visar session count, aktiv sessions namn, view mode.

### EmptyState.tsx
Centrerad vy med ikon + text ("No sessions yet") + "Create Session"-knapp. Visas när sessions-listan är tom.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl+N | Öppna NewSessionModal |
| Cmd/Ctrl+W | Ta bort aktiv session |
| Cmd/Ctrl+G | Toggle single/grid mode |
| Cmd/Ctrl+B | Toggle sidebar |
| Cmd/Ctrl+1-9 | Snabbväxla till session 1-9 |
| Cmd/Ctrl+Tab | Nästa session |
| Cmd/Ctrl+Shift+Tab | Föregående session |

Implementeras i `useKeyboard` hook som registrerar globala event listeners.

## IPC (minimal för UI shell)

Enda IPC som behövs i fas 1:

```typescript
// preload/index.ts — exponeras via contextBridge
interface CccAPI {
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };
}
```

All session-logik lever i renderer via Zustand (mock-data).

## Applikationsarkitektur

```
src/
├── main/
│   └── index.ts                 # BrowserWindow setup, window IPC handlers
├── preload/
│   └── index.ts                 # contextBridge med window controls
├── renderer/
│   ├── App.tsx                  # Root, renderar Layout
│   ├── main.tsx                 # React entry point
│   ├── stores/
│   │   └── session-store.ts     # Zustand store med mock-data
│   ├── components/
│   │   ├── Layout.tsx
│   │   ├── TitleBar.tsx
│   │   ├── SessionSidebar.tsx
│   │   ├── SessionCard.tsx
│   │   ├── TerminalPanel.tsx
│   │   ├── GridView.tsx
│   │   ├── NewSessionModal.tsx
│   │   ├── StatusBar.tsx
│   │   └── EmptyState.tsx
│   ├── hooks/
│   │   └── useKeyboard.ts
│   └── styles/
│       └── index.css            # Tailwind + CSS-variabler
└── shared/
    └── types.ts
```

## Vad som INTE ingår i denna fas

- node-pty / terminal backend
- xterm.js (ersätts av mock terminal-panel)
- Riktig process-spawn av Claude Code
- Session persistence
- Split view (ersätts av grid mode)
- Notifikationer
- Konfigurationsfil
- Auto-updater
