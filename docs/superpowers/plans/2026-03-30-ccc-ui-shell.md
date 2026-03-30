# Code Command Center — UI Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a functional Electron UI shell for managing Claude Code sessions with mock data, Zustand state, keyboard navigation, and a free-drag grid layout.

**Architecture:** electron-vite scaffolds the Electron + React + TypeScript project. The renderer holds all UI logic with Zustand for state (mock sessions). Main process only handles window controls via IPC. react-grid-layout provides the free-drag grid view.

**Tech Stack:** Electron 41, electron-vite 5, React 19.2, TypeScript, Tailwind CSS 4.2, Zustand, react-grid-layout, Lucide React

---

## File Map

```
src/
├── main/
│   └── index.ts                    # BrowserWindow config (frameless), window IPC handlers
├── preload/
│   └── index.ts                    # contextBridge: window.minimize/maximize/close
├── renderer/
│   ├── index.html                  # Electron renderer entry HTML
│   ├── main.tsx                    # React DOM root
│   ├── App.tsx                     # Renders Layout, registers useKeyboard
│   ├── stores/
│   │   └── session-store.ts        # Zustand store: sessions, activeSessionId, viewMode, sidebarOpen, gridLayout
│   ├── components/
│   │   ├── Layout.tsx              # CSS grid shell: titlebar + sidebar + main + statusbar
│   │   ├── TitleBar.tsx            # Custom frameless titlebar with drag region + window controls
│   │   ├── SessionSidebar.tsx      # Session list + new session button + mode toggle
│   │   ├── SessionCard.tsx         # Single session entry: name, status dot, relative time
│   │   ├── TerminalPanel.tsx       # Mock terminal display (static Claude Code output)
│   │   ├── GridView.tsx            # react-grid-layout wrapper for free-drag multi-terminal view
│   │   ├── NewSessionModal.tsx     # Modal form: name + working directory inputs
│   │   ├── StatusBar.tsx           # Bottom bar: session count, active session, view mode
│   │   └── EmptyState.tsx          # Empty state with create session CTA
│   ├── hooks/
│   │   └── useKeyboard.ts          # Global keyboard shortcut handler
│   └── styles/
│       └── index.css               # Tailwind directives + CSS custom properties
└── shared/
    └── types.ts                    # Session, SessionCreate, ViewMode, GridItem types
```

---

### Task 1: Scaffold Project

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`
- Create: `src/main/index.ts`, `src/preload/index.ts`
- Create: `src/renderer/index.html`, `src/renderer/main.tsx`, `src/renderer/App.tsx`
- Create: `src/renderer/styles/index.css`
- Create: `src/shared/types.ts`

- [ ] **Step 1: Scaffold with electron-vite**

```bash
cd /home/adam/Documents/Dev/code-command-center2
npm create electron-vite@latest . -- --template react-ts
```

If prompted about existing files, allow overwrite (only .gitignore and docs/ exist).

- [ ] **Step 2: Install additional dependencies**

```bash
npm install zustand react-grid-layout lucide-react
npm install -D @tailwindcss/vite @types/react-grid-layout
```

- [ ] **Step 3: Configure Tailwind CSS 4.2**

Replace `src/renderer/styles/index.css` with:

```css
@import "tailwindcss";

:root {
  --bg-primary: #0a0a0f;
  --bg-surface: #111118;
  --bg-raised: #1a1a24;
  --text-primary: #ffffff;
  --text-secondary: #888888;
  --text-muted: #555555;
  --accent: #f59e0b;
  --accent-muted: rgba(245, 158, 11, 0.12);
  --success: #10b981;
  --error: #ef4444;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

@font-face {
  font-family: 'JetBrains Mono';
  src: url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
}

body {
  margin: 0;
  padding: 0;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-sans);
  overflow: hidden;
  user-select: none;
}
```

- [ ] **Step 4: Add Tailwind vite plugin to electron-vite config**

Edit `electron.vite.config.ts` — add the Tailwind plugin to the renderer config:

```typescript
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
```

- [ ] **Step 5: Create shared types**

Write `src/shared/types.ts`:

```typescript
export interface Session {
  id: string
  name: string
  workingDirectory: string
  status: 'running' | 'stopped' | 'error'
  createdAt: number
  lastActiveAt: number
}

export interface SessionCreate {
  name: string
  workingDirectory: string
}

export type ViewMode = 'single' | 'grid'

export interface GridItem {
  i: string
  x: number
  y: number
  w: number
  h: number
}

export interface CccAPI {
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
  }
}
```

- [ ] **Step 6: Set up minimal main process**

Replace `src/main/index.ts` with:

```typescript
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0f',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  ipcMain.on('window:minimize', () => mainWindow.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })
  ipcMain.on('window:close', () => mainWindow.close())

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 7: Set up preload script**

Replace `src/preload/index.ts` with:

```typescript
import { contextBridge, ipcRenderer } from 'electron'
import type { CccAPI } from '../shared/types'

const api: CccAPI = {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  }
}

contextBridge.exposeInMainWorld('cccAPI', api)
```

- [ ] **Step 8: Set up renderer entry**

Replace `src/renderer/main.tsx` with:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

Replace `src/renderer/App.tsx` with:

```tsx
export default function App(): React.JSX.Element {
  return (
    <div className="h-screen w-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <p className="p-8 text-[var(--accent)]">Code Command Center</p>
    </div>
  )
}
```

Update `src/renderer/index.html` to include the JetBrains Mono font link in `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
```

- [ ] **Step 9: Add global type declaration for cccAPI**

Create `src/renderer/env.d.ts`:

```typescript
import type { CccAPI } from '../shared/types'

declare global {
  interface Window {
    cccAPI: CccAPI
  }
}
```

- [ ] **Step 10: Verify app starts**

```bash
npm run dev
```

Expected: Electron window opens with dark background and amber "Code Command Center" text. Window is frameless.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "Scaffold electron-vite project with React, Tailwind, Zustand setup"
```

---

### Task 2: Zustand Store with Mock Data

**Files:**
- Create: `src/renderer/stores/session-store.ts`

- [ ] **Step 1: Create session store**

Write `src/renderer/stores/session-store.ts`:

```typescript
import { create } from 'zustand'
import type { Session, SessionCreate, ViewMode, GridItem } from '../../shared/types'

interface SessionStore {
  sessions: Session[]
  activeSessionId: string | null
  viewMode: ViewMode
  sidebarOpen: boolean
  gridLayout: GridItem[]
  modalOpen: boolean

  createSession: (opts: SessionCreate) => void
  removeSession: (id: string) => void
  setActiveSession: (id: string) => void
  setViewMode: (mode: ViewMode) => void
  toggleSidebar: () => void
  toggleModal: () => void
  updateGridLayout: (layout: GridItem[]) => void
  nextSession: () => void
  prevSession: () => void
}

function generateId(): string {
  return crypto.randomUUID()
}

function generateGridLayout(sessions: Session[]): GridItem[] {
  const cols = sessions.length <= 2 ? sessions.length : sessions.length <= 4 ? 2 : 3
  return sessions.map((s, i) => ({
    i: s.id,
    x: i % cols,
    y: Math.floor(i / cols),
    w: 1,
    h: 1
  }))
}

const now = Date.now()

const mockSessions: Session[] = [
  {
    id: generateId(),
    name: 'api-server',
    workingDirectory: '~/projects/api-server',
    status: 'running',
    createdAt: now - 3600000,
    lastActiveAt: now - 120000
  },
  {
    id: generateId(),
    name: 'frontend',
    workingDirectory: '~/projects/frontend',
    status: 'running',
    createdAt: now - 7200000,
    lastActiveAt: now - 900000
  },
  {
    id: generateId(),
    name: 'infra-setup',
    workingDirectory: '~/projects/infra',
    status: 'stopped',
    createdAt: now - 86400000,
    lastActiveAt: now - 3600000
  },
  {
    id: generateId(),
    name: 'docs-rewrite',
    workingDirectory: '~/projects/docs',
    status: 'error',
    createdAt: now - 10800000,
    lastActiveAt: now - 10800000
  }
]

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: mockSessions,
  activeSessionId: mockSessions[0].id,
  viewMode: 'single',
  sidebarOpen: true,
  gridLayout: generateGridLayout(mockSessions),
  modalOpen: false,

  createSession: (opts) => {
    const session: Session = {
      id: generateId(),
      name: opts.name,
      workingDirectory: opts.workingDirectory,
      status: 'running',
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    }
    set((state) => {
      const sessions = [...state.sessions, session]
      return {
        sessions,
        activeSessionId: session.id,
        gridLayout: generateGridLayout(sessions)
      }
    })
  },

  removeSession: (id) => {
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== id)
      const activeSessionId =
        state.activeSessionId === id
          ? sessions[0]?.id ?? null
          : state.activeSessionId
      return {
        sessions,
        activeSessionId,
        gridLayout: generateGridLayout(sessions)
      }
    })
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  setViewMode: (mode) => set({ viewMode: mode }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  toggleModal: () => set((state) => ({ modalOpen: !state.modalOpen })),

  updateGridLayout: (layout) => set({ gridLayout: layout }),

  nextSession: () => {
    const { sessions, activeSessionId } = get()
    if (sessions.length === 0) return
    const idx = sessions.findIndex((s) => s.id === activeSessionId)
    const next = (idx + 1) % sessions.length
    set({ activeSessionId: sessions[next].id })
  },

  prevSession: () => {
    const { sessions, activeSessionId } = get()
    if (sessions.length === 0) return
    const idx = sessions.findIndex((s) => s.id === activeSessionId)
    const prev = (idx - 1 + sessions.length) % sessions.length
    set({ activeSessionId: sessions[prev].id })
  }
}))
```

- [ ] **Step 2: Verify store loads**

Update `src/renderer/App.tsx` temporarily to test the store:

```tsx
import { useSessionStore } from './stores/session-store'

export default function App(): React.JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  return (
    <div className="h-screen w-screen bg-[var(--bg-primary)] text-[var(--text-primary)] p-8">
      <p className="text-[var(--accent)] mb-4">Code Command Center — {sessions.length} sessions</p>
      {sessions.map((s) => (
        <p key={s.id} className="text-[var(--text-secondary)]">{s.name} — {s.status}</p>
      ))}
    </div>
  )
}
```

Run `npm run dev`. Expected: Window shows "4 sessions" and lists all mock session names with status.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/stores/session-store.ts src/renderer/App.tsx
git commit -m "Add Zustand session store with mock data"
```

---

### Task 3: TitleBar Component

**Files:**
- Create: `src/renderer/components/TitleBar.tsx`

- [ ] **Step 1: Build TitleBar**

Write `src/renderer/components/TitleBar.tsx`:

```tsx
import { Minus, Square, X } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'

export default function TitleBar(): React.JSX.Element {
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const sessions = useSessionStore((s) => s.sessions)
  const activeSession = sessions.find((s) => s.id === activeSessionId)

  return (
    <div
      className="h-9 flex items-center justify-between px-4 border-b select-none"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--bg-raised)',
        WebkitAppRegion: 'drag'
      } as React.CSSProperties}
    >
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--accent)' }}>
          CCC
        </span>
        {activeSession && (
          <>
            <span style={{ color: 'var(--text-muted)' }} className="text-xs">
              /
            </span>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {activeSession.name}
            </span>
          </>
        )}
      </div>

      <div
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={() => window.cccAPI.window.minimize()}
          className="p-1.5 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => window.cccAPI.window.maximize()}
          className="p-1.5 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => window.cccAPI.window.close()}
          className="p-1.5 rounded transition-colors duration-100 hover:bg-red-500/20 hover:text-red-400"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify titlebar renders**

Update `src/renderer/App.tsx`:

```tsx
import TitleBar from './components/TitleBar'

export default function App(): React.JSX.Element {
  return (
    <div className="h-screen w-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <TitleBar />
      <div className="flex-1 p-8">
        <p style={{ color: 'var(--accent)' }}>Main area</p>
      </div>
    </div>
  )
}
```

Run `npm run dev`. Expected: Frameless window with dark titlebar showing "CCC / api-server", draggable, and working min/max/close buttons.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/TitleBar.tsx src/renderer/App.tsx
git commit -m "Add custom frameless titlebar with window controls"
```

---

### Task 4: StatusBar Component

**Files:**
- Create: `src/renderer/components/StatusBar.tsx`

- [ ] **Step 1: Build StatusBar**

Write `src/renderer/components/StatusBar.tsx`:

```tsx
import { useSessionStore } from '../stores/session-store'

export default function StatusBar(): React.JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const viewMode = useSessionStore((s) => s.viewMode)
  const activeSession = sessions.find((s) => s.id === activeSessionId)

  const gridLabel = (): string => {
    if (viewMode === 'single') return 'Single'
    const count = sessions.length
    if (count <= 2) return `Grid 1×${count}`
    if (count <= 4) return `Grid 2×${Math.ceil(count / 2)}`
    return `Grid ${Math.ceil(count / 3)}×3`
  }

  return (
    <div
      className="h-7 flex items-center justify-between px-4 text-[10px] border-t select-none"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--bg-raised)',
        color: 'var(--text-muted)'
      }}
    >
      <span>
        <span style={{ color: 'var(--accent)' }}>{sessions.length}</span> sessions
      </span>
      <span>
        {activeSession && (
          <>
            Active: <span style={{ color: 'var(--accent)' }}>{activeSession.name}</span>
          </>
        )}
      </span>
      <span>{gridLabel()}</span>
    </div>
  )
}
```

- [ ] **Step 2: Add to App and verify**

Update `src/renderer/App.tsx`:

```tsx
import TitleBar from './components/TitleBar'
import StatusBar from './components/StatusBar'

export default function App(): React.JSX.Element {
  return (
    <div className="h-screen w-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <TitleBar />
      <div className="flex-1 p-8">
        <p style={{ color: 'var(--accent)' }}>Main area</p>
      </div>
      <StatusBar />
    </div>
  )
}
```

Run `npm run dev`. Expected: Bottom bar shows "4 sessions", "Active: api-server", "Single".

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/StatusBar.tsx src/renderer/App.tsx
git commit -m "Add status bar showing session count, active session, and view mode"
```

---

### Task 5: SessionCard Component

**Files:**
- Create: `src/renderer/components/SessionCard.tsx`

- [ ] **Step 1: Build SessionCard**

Write `src/renderer/components/SessionCard.tsx`:

```tsx
import type { Session } from '../../shared/types'

interface SessionCardProps {
  session: Session
  isActive: boolean
  onClick: () => void
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const statusColors: Record<Session['status'], string> = {
  running: 'var(--accent)',
  stopped: 'var(--text-muted)',
  error: 'var(--error)'
}

export default function SessionCard({ session, isActive, onClick }: SessionCardProps): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 rounded-md transition-all duration-100 border-l-2 group"
      style={{
        backgroundColor: isActive ? 'var(--accent-muted)' : 'transparent',
        borderLeftColor: isActive ? 'var(--accent)' : 'transparent'
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: statusColors[session.status] }}
        />
        <span
          className="text-xs font-medium truncate"
          style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}
        >
          {session.name}
        </span>
      </div>
      <div
        className="text-[10px] mt-0.5 ml-3.5"
        style={{ color: 'var(--text-muted)' }}
      >
        {formatRelativeTime(session.lastActiveAt)}
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Verify in App temporarily**

Update `src/renderer/App.tsx` to render a few cards:

```tsx
import TitleBar from './components/TitleBar'
import StatusBar from './components/StatusBar'
import SessionCard from './components/SessionCard'
import { useSessionStore } from './stores/session-store'

export default function App(): React.JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const setActiveSession = useSessionStore((s) => s.setActiveSession)

  return (
    <div className="h-screen w-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <TitleBar />
      <div className="flex-1 flex">
        <div className="w-[260px] p-3 flex flex-col gap-1" style={{ backgroundColor: 'var(--bg-surface)' }}>
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              isActive={s.id === activeSessionId}
              onClick={() => setActiveSession(s.id)}
            />
          ))}
        </div>
        <div className="flex-1 p-8">
          <p style={{ color: 'var(--accent)' }}>Main area</p>
        </div>
      </div>
      <StatusBar />
    </div>
  )
}
```

Run `npm run dev`. Expected: Sidebar with 4 session cards. First one highlighted with amber. Click another → it becomes active, StatusBar updates.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/SessionCard.tsx src/renderer/App.tsx
git commit -m "Add SessionCard component with status indicators and relative time"
```

---

### Task 6: SessionSidebar Component

**Files:**
- Create: `src/renderer/components/SessionSidebar.tsx`

- [ ] **Step 1: Build SessionSidebar**

Write `src/renderer/components/SessionSidebar.tsx`:

```tsx
import { Plus, LayoutGrid, Monitor } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'
import SessionCard from './SessionCard'

export default function SessionSidebar(): React.JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const viewMode = useSessionStore((s) => s.viewMode)
  const setActiveSession = useSessionStore((s) => s.setActiveSession)
  const setViewMode = useSessionStore((s) => s.setViewMode)
  const toggleModal = useSessionStore((s) => s.toggleModal)

  return (
    <div
      className="flex flex-col h-full border-r"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--bg-raised)'
      }}
    >
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <span
          className="text-[10px] uppercase tracking-[1.5px] font-medium"
          style={{ color: 'var(--text-muted)' }}
        >
          Sessions
        </span>
        <button
          onClick={toggleModal}
          className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
          style={{ color: 'var(--text-muted)' }}
          title="New Session (Ctrl+N)"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1 flex flex-col gap-0.5">
        {sessions.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            isActive={s.id === activeSessionId}
            onClick={() => setActiveSession(s.id)}
          />
        ))}
      </div>

      <div
        className="px-3 py-2.5 border-t flex gap-1"
        style={{ borderColor: 'var(--bg-raised)' }}
      >
        <button
          onClick={() => setViewMode('single')}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-medium transition-colors duration-100"
          style={{
            backgroundColor: viewMode === 'single' ? 'var(--bg-raised)' : 'transparent',
            color: viewMode === 'single' ? 'var(--text-primary)' : 'var(--text-muted)'
          }}
        >
          <Monitor size={12} />
          Single
        </button>
        <button
          onClick={() => setViewMode('grid')}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-medium transition-colors duration-100"
          style={{
            backgroundColor: viewMode === 'grid' ? 'var(--accent-muted)' : 'transparent',
            color: viewMode === 'grid' ? 'var(--accent)' : 'var(--text-muted)'
          }}
        >
          <LayoutGrid size={12} />
          Grid
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/SessionSidebar.tsx
git commit -m "Add SessionSidebar with session list, new button, and mode toggle"
```

---

### Task 7: EmptyState and TerminalPanel Components

**Files:**
- Create: `src/renderer/components/EmptyState.tsx`
- Create: `src/renderer/components/TerminalPanel.tsx`

- [ ] **Step 1: Build EmptyState**

Write `src/renderer/components/EmptyState.tsx`:

```tsx
import { Terminal } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'

export default function EmptyState(): React.JSX.Element {
  const toggleModal = useSessionStore((s) => s.toggleModal)

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <Terminal size={28} style={{ color: 'var(--text-muted)' }} />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          No sessions yet
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Create a session to start using Claude Code
        </p>
      </div>
      <button
        onClick={toggleModal}
        className="px-4 py-2 rounded-lg text-xs font-medium transition-colors duration-100"
        style={{
          backgroundColor: 'var(--accent)',
          color: 'var(--bg-primary)'
        }}
      >
        Create Session
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Build TerminalPanel**

Write `src/renderer/components/TerminalPanel.tsx`:

```tsx
import type { Session } from '../../shared/types'

interface TerminalPanelProps {
  session: Session
  showHeader?: boolean
}

const mockOutputs: Record<string, string[]> = {
  running: [
    '╭──────────────────────────────────────╮',
    '│  Claude Code  v1.2.3                 │',
    '│  ~/projects/...                      │',
    '╰──────────────────────────────────────╯',
    '',
    '  Analyzing codebase structure...',
    '  Found 47 files, 3,200 lines',
    '',
    '  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '> I can see your project structure. What would',
    '  you like to work on?',
    '',
    '  ▌'
  ],
  stopped: [
    '╭──────────────────────────────────────╮',
    '│  Claude Code  v1.2.3                 │',
    '╰──────────────────────────────────────╯',
    '',
    '  Session ended.',
    '',
    '  ✓ 3 files modified',
    '  ✓ All tasks completed'
  ],
  error: [
    '╭──────────────────────────────────────╮',
    '│  Claude Code  v1.2.3                 │',
    '╰──────────────────────────────────────╯',
    '',
    '  ✗ Error: Connection lost',
    '  Process exited with code 1'
  ]
}

export default function TerminalPanel({ session, showHeader = false }: TerminalPanelProps): React.JSX.Element {
  const lines = mockOutputs[session.status] ?? mockOutputs.running

  return (
    <div
      className="flex flex-col h-full rounded-md overflow-hidden"
      style={{ backgroundColor: '#0d0d14' }}
    >
      {showHeader && (
        <div
          className="h-7 flex items-center px-3 text-[10px] font-semibold border-b flex-shrink-0"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--bg-raised)',
            color: 'var(--text-secondary)'
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full mr-2"
            style={{
              backgroundColor:
                session.status === 'running'
                  ? 'var(--accent)'
                  : session.status === 'error'
                    ? 'var(--error)'
                    : 'var(--text-muted)'
            }}
          />
          {session.name}
          <span className="ml-2" style={{ color: 'var(--text-muted)' }}>
            {session.workingDirectory}
          </span>
        </div>
      )}
      <div className="flex-1 p-3 overflow-y-auto" style={{ fontFamily: 'var(--font-mono)' }}>
        {lines.map((line, i) => (
          <div
            key={i}
            className="text-[11px] leading-relaxed whitespace-pre"
            style={{
              color: line.startsWith('>')
                ? 'var(--text-primary)'
                : line.includes('✗') || line.includes('Error')
                  ? 'var(--error)'
                  : line.includes('✓')
                    ? 'var(--success)'
                    : line.includes('━')
                      ? 'var(--accent)'
                      : 'var(--text-muted)'
            }}
          >
            {line || '\u00A0'}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/EmptyState.tsx src/renderer/components/TerminalPanel.tsx
git commit -m "Add EmptyState and mock TerminalPanel components"
```

---

### Task 8: Layout Component — Full Shell

**Files:**
- Create: `src/renderer/components/Layout.tsx`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Build Layout**

Write `src/renderer/components/Layout.tsx`:

```tsx
import { useSessionStore } from '../stores/session-store'
import TitleBar from './TitleBar'
import SessionSidebar from './SessionSidebar'
import TerminalPanel from './TerminalPanel'
import EmptyState from './EmptyState'
import StatusBar from './StatusBar'

export default function Layout(): React.JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const sidebarOpen = useSessionStore((s) => s.sidebarOpen)
  const viewMode = useSessionStore((s) => s.viewMode)
  const activeSession = sessions.find((s) => s.id === activeSessionId)

  return (
    <div className="h-screen w-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <TitleBar />

      <div className="flex-1 flex overflow-hidden">
        <div
          className="transition-all duration-200 ease-in-out overflow-hidden flex-shrink-0"
          style={{ width: sidebarOpen ? 260 : 0 }}
        >
          <div className="w-[260px] h-full">
            <SessionSidebar />
          </div>
        </div>

        <main className="flex-1 flex overflow-hidden">
          {sessions.length === 0 ? (
            <EmptyState />
          ) : viewMode === 'single' && activeSession ? (
            <div className="flex-1 p-1">
              <TerminalPanel session={activeSession} />
            </div>
          ) : (
            <div className="flex-1 p-1 flex items-center justify-center">
              <p style={{ color: 'var(--text-muted)' }} className="text-sm">
                Grid view — coming in next task
              </p>
            </div>
          )}
        </main>
      </div>

      <StatusBar />
    </div>
  )
}
```

- [ ] **Step 2: Wire up App.tsx**

Replace `src/renderer/App.tsx`:

```tsx
import Layout from './components/Layout'

export default function App(): React.JSX.Element {
  return <Layout />
}
```

- [ ] **Step 3: Verify full shell**

Run `npm run dev`. Expected:
- Titlebar with "CCC / api-server" and working window controls
- Sidebar (260px) with 4 session cards, mode toggle at bottom
- Main area showing mock terminal for active session
- StatusBar at bottom
- Clicking sessions in sidebar switches the terminal view and updates titlebar + statusbar

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/Layout.tsx src/renderer/App.tsx
git commit -m "Add Layout component assembling full app shell"
```

---

### Task 9: NewSessionModal Component

**Files:**
- Create: `src/renderer/components/NewSessionModal.tsx`
- Modify: `src/renderer/components/Layout.tsx`

- [ ] **Step 1: Build NewSessionModal**

Write `src/renderer/components/NewSessionModal.tsx`:

```tsx
import { useState } from 'react'
import { X } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'

export default function NewSessionModal(): React.JSX.Element {
  const modalOpen = useSessionStore((s) => s.modalOpen)
  const toggleModal = useSessionStore((s) => s.toggleModal)
  const createSession = useSessionStore((s) => s.createSession)
  const [name, setName] = useState('')
  const [workingDirectory, setWorkingDirectory] = useState('')

  if (!modalOpen) return <></>

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!name.trim() || !workingDirectory.trim()) return
    createSession({ name: name.trim(), workingDirectory: workingDirectory.trim() })
    setName('')
    setWorkingDirectory('')
    toggleModal()
  }

  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) toggleModal()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-150"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="w-[420px] rounded-xl border p-6"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--bg-raised)',
          animation: 'modal-enter 150ms ease'
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            New Session
          </h2>
          <button
            onClick={toggleModal}
            className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              className="block text-[10px] uppercase tracking-wide mb-1.5 font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              Session Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. api-server"
              autoFocus
              className="w-full px-3 py-2 rounded-lg text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--bg-raised)',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          <div>
            <label
              className="block text-[10px] uppercase tracking-wide mb-1.5 font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              Working Directory
            </label>
            <input
              type="text"
              value={workingDirectory}
              onChange={(e) => setWorkingDirectory(e.target.value)}
              placeholder="e.g. ~/projects/my-app"
              className="w-full px-3 py-2 rounded-lg text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--bg-raised)',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={toggleModal}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors duration-100"
              style={{
                backgroundColor: 'var(--bg-raised)',
                color: 'var(--text-secondary)'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors duration-100"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--bg-primary)'
              }}
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add modal animation CSS**

Add to the end of `src/renderer/styles/index.css`:

```css
@keyframes modal-enter {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

- [ ] **Step 3: Add modal to Layout**

In `src/renderer/components/Layout.tsx`, add the modal import and render it as the last child inside the root div:

Add import at top:
```tsx
import NewSessionModal from './NewSessionModal'
```

Add `<NewSessionModal />` right before the closing `</div>` of the root element, after `<StatusBar />`:

```tsx
      <StatusBar />
      <NewSessionModal />
    </div>
```

- [ ] **Step 4: Verify modal**

Run `npm run dev`. Expected: Click the "+" button in sidebar header → modal appears with backdrop. Fill in name + directory → Create → new session appears in sidebar and becomes active. Click backdrop or Cancel → modal closes. Escape key should also close (handled in keyboard task).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/NewSessionModal.tsx src/renderer/components/Layout.tsx src/renderer/styles/index.css
git commit -m "Add NewSessionModal with create session form"
```

---

### Task 10: GridView Component

**Files:**
- Create: `src/renderer/components/GridView.tsx`
- Modify: `src/renderer/components/Layout.tsx`

- [ ] **Step 1: Build GridView**

Write `src/renderer/components/GridView.tsx`:

```tsx
import { useRef, useCallback } from 'react'
import ReactGridLayout, { useContainerWidth } from 'react-grid-layout'
import type { LayoutItem } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import { useSessionStore } from '../stores/session-store'
import TerminalPanel from './TerminalPanel'

export default function GridView(): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const { width } = useContainerWidth(containerRef)

  const sessions = useSessionStore((s) => s.sessions)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const gridLayout = useSessionStore((s) => s.gridLayout)
  const setActiveSession = useSessionStore((s) => s.setActiveSession)
  const setViewMode = useSessionStore((s) => s.setViewMode)
  const updateGridLayout = useSessionStore((s) => s.updateGridLayout)

  const cols = sessions.length <= 2 ? sessions.length || 1 : sessions.length <= 4 ? 2 : 3

  const handleLayoutChange = useCallback(
    (layout: LayoutItem[]) => {
      updateGridLayout(
        layout.map((item) => ({
          i: item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h
        }))
      )
    },
    [updateGridLayout]
  )

  const handleDoubleClick = useCallback(
    (sessionId: string) => {
      setActiveSession(sessionId)
      setViewMode('single')
    },
    [setActiveSession, setViewMode]
  )

  return (
    <div ref={containerRef} className="flex-1 h-full p-1 overflow-auto">
      {width > 0 && (
        <ReactGridLayout
          width={width}
          layout={gridLayout}
          cols={cols}
          rowHeight={Math.floor((containerRef.current?.clientHeight ?? 400) / Math.ceil(sessions.length / cols)) - 12}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".grid-drag-handle"
          isResizable={true}
          isDraggable={true}
          margin={[6, 6]}
          containerPadding={[0, 0]}
        >
          {sessions.map((session) => (
            <div
              key={session.id}
              className="rounded-md overflow-hidden border transition-colors duration-100"
              style={{
                borderColor:
                  session.id === activeSessionId ? 'var(--accent)' : 'var(--bg-raised)'
              }}
              onClick={() => setActiveSession(session.id)}
              onDoubleClick={() => handleDoubleClick(session.id)}
            >
              <div
                className="grid-drag-handle h-6 flex items-center px-2 cursor-grab active:cursor-grabbing border-b"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--bg-raised)'
                }}
              >
                <span
                  className="mr-2 text-[10px]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  ⠿
                </span>
                <span
                  className="text-[10px] font-medium truncate"
                  style={{
                    color:
                      session.id === activeSessionId
                        ? 'var(--accent)'
                        : 'var(--text-secondary)'
                  }}
                >
                  {session.name}
                </span>
              </div>
              <div className="h-[calc(100%-24px)]">
                <TerminalPanel session={session} />
              </div>
            </div>
          ))}
        </ReactGridLayout>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire GridView into Layout**

In `src/renderer/components/Layout.tsx`, add import:

```tsx
import GridView from './GridView'
```

Replace the grid placeholder in the main area. Change:

```tsx
            <div className="flex-1 p-1 flex items-center justify-center">
              <p style={{ color: 'var(--text-muted)' }} className="text-sm">
                Grid view — coming in next task
              </p>
            </div>
```

To:

```tsx
            <GridView />
```

- [ ] **Step 3: Verify grid mode**

Run `npm run dev`. Expected:
- Click "Grid" in sidebar mode toggle → all 4 sessions appear in a grid layout
- Drag the ⠿ handle to rearrange panels
- Resize panels by dragging edges/corners
- Click panel → it becomes active (amber border)
- Double-click panel → switches back to single mode with that session
- Click "Single" → returns to single terminal view

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/GridView.tsx src/renderer/components/Layout.tsx
git commit -m "Add GridView with react-grid-layout for free-drag multi-terminal view"
```

---

### Task 11: Keyboard Shortcuts

**Files:**
- Create: `src/renderer/hooks/useKeyboard.ts`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Build useKeyboard hook**

Write `src/renderer/hooks/useKeyboard.ts`:

```typescript
import { useEffect } from 'react'
import { useSessionStore } from '../stores/session-store'

export function useKeyboard(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key === 'n') {
        e.preventDefault()
        useSessionStore.getState().toggleModal()
        return
      }

      if (mod && e.key === 'w') {
        e.preventDefault()
        const { activeSessionId, removeSession } = useSessionStore.getState()
        if (activeSessionId) removeSession(activeSessionId)
        return
      }

      if (mod && e.key === 'g') {
        e.preventDefault()
        const { viewMode, setViewMode } = useSessionStore.getState()
        setViewMode(viewMode === 'single' ? 'grid' : 'single')
        return
      }

      if (mod && e.key === 'b') {
        e.preventDefault()
        useSessionStore.getState().toggleSidebar()
        return
      }

      if (mod && e.key === 'Tab') {
        e.preventDefault()
        if (e.shiftKey) {
          useSessionStore.getState().prevSession()
        } else {
          useSessionStore.getState().nextSession()
        }
        return
      }

      if (mod && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const idx = parseInt(e.key) - 1
        const { sessions, setActiveSession } = useSessionStore.getState()
        if (idx < sessions.length) {
          setActiveSession(sessions[idx].id)
        }
        return
      }

      if (e.key === 'Escape') {
        const { modalOpen, toggleModal } = useSessionStore.getState()
        if (modalOpen) {
          e.preventDefault()
          toggleModal()
        }
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
```

- [ ] **Step 2: Register in App**

Update `src/renderer/App.tsx`:

```tsx
import Layout from './components/Layout'
import { useKeyboard } from './hooks/useKeyboard'

export default function App(): React.JSX.Element {
  useKeyboard()
  return <Layout />
}
```

- [ ] **Step 3: Verify shortcuts**

Run `npm run dev`. Test each shortcut:
- `Ctrl+N` → opens new session modal
- `Escape` → closes modal
- `Ctrl+W` → removes active session
- `Ctrl+G` → toggles single/grid mode
- `Ctrl+B` → toggles sidebar
- `Ctrl+Tab` → next session
- `Ctrl+Shift+Tab` → previous session
- `Ctrl+1` through `Ctrl+4` → jumps to session by index

- [ ] **Step 4: Commit**

```bash
git add src/renderer/hooks/useKeyboard.ts src/renderer/App.tsx
git commit -m "Add keyboard shortcuts for session management and navigation"
```

---

### Task 12: Polish — Animations, Hover States, Empty State UX

**Files:**
- Modify: `src/renderer/styles/index.css`
- Modify: `src/renderer/components/SessionCard.tsx`
- Modify: `src/renderer/components/TerminalPanel.tsx`
- Modify: `src/renderer/components/Layout.tsx`

- [ ] **Step 1: Add transition CSS for session crossfade**

Add to `src/renderer/styles/index.css`:

```css
.terminal-crossfade-enter {
  opacity: 0;
}
.terminal-crossfade-enter-active {
  opacity: 1;
  transition: opacity 150ms ease;
}

/* react-grid-layout overrides for dark theme */
.react-grid-item.react-grid-placeholder {
  background: var(--accent) !important;
  opacity: 0.15 !important;
  border-radius: 6px;
}

.react-grid-item > .react-resizable-handle::after {
  border-right-color: var(--text-muted) !important;
  border-bottom-color: var(--text-muted) !important;
}
```

- [ ] **Step 2: Add hover effect to SessionCard**

In `src/renderer/components/SessionCard.tsx`, add a hover style to the button. Change the button's `className`:

Replace:
```tsx
      className="w-full text-left px-3 py-2.5 rounded-md transition-all duration-100 border-l-2 group"
```

With:
```tsx
      className="w-full text-left px-3 py-2.5 rounded-md transition-all duration-100 border-l-2 group hover:bg-[rgba(255,255,255,0.03)]"
```

- [ ] **Step 3: Add crossfade key to terminal in Layout**

In `src/renderer/components/Layout.tsx`, add a `key` prop to force re-render with animation when switching sessions. Change:

```tsx
            <div className="flex-1 p-1">
              <TerminalPanel session={activeSession} />
            </div>
```

To:

```tsx
            <div className="flex-1 p-1">
              <TerminalPanel key={activeSession.id} session={activeSession} />
            </div>
```

- [ ] **Step 4: Add unique mock output per session**

In `src/renderer/components/TerminalPanel.tsx`, make the mock output use the session's name and directory. Replace the `mockOutputs` object and the line that reads it with:

Replace:
```tsx
const mockOutputs: Record<string, string[]> = {
  running: [
    '╭──────────────────────────────────────╮',
    '│  Claude Code  v1.2.3                 │',
    '│  ~/projects/...                      │',
    '╰──────────────────────────────────────╯',
    '',
    '  Analyzing codebase structure...',
    '  Found 47 files, 3,200 lines',
    '',
    '  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '> I can see your project structure. What would',
    '  you like to work on?',
    '',
    '  ▌'
  ],
  stopped: [
    '╭──────────────────────────────────────╮',
    '│  Claude Code  v1.2.3                 │',
    '╰──────────────────────────────────────╯',
    '',
    '  Session ended.',
    '',
    '  ✓ 3 files modified',
    '  ✓ All tasks completed'
  ],
  error: [
    '╭──────────────────────────────────────╮',
    '│  Claude Code  v1.2.3                 │',
    '╰──────────────────────────────────────╯',
    '',
    '  ✗ Error: Connection lost',
    '  Process exited with code 1'
  ]
}
```

With:

```tsx
function getMockOutput(session: Session): string[] {
  const header = [
    '╭──────────────────────────────────────╮',
    `│  Claude Code  v1.2.3                 │`,
    `│  ${session.workingDirectory.padEnd(37)}│`,
    '╰──────────────────────────────────────╯',
    ''
  ]

  if (session.status === 'error') {
    return [...header, '  ✗ Error: Connection lost', '  Process exited with code 1']
  }
  if (session.status === 'stopped') {
    return [...header, '  Session ended.', '', '  ✓ 3 files modified', '  ✓ All tasks completed']
  }
  return [
    ...header,
    `  Analyzing codebase structure...`,
    `  Found 47 files, 3,200 lines`,
    '',
    '  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '> I can see your project structure. What would',
    '  you like to work on?',
    '',
    '  ▌'
  ]
}
```

And change the line that creates `lines`:

Replace:
```tsx
  const lines = mockOutputs[session.status] ?? mockOutputs.running
```

With:
```tsx
  const lines = getMockOutput(session)
```

- [ ] **Step 5: Verify polish**

Run `npm run dev`. Expected:
- Switching sessions shows a subtle fade
- SessionCards have hover effect
- Grid drag placeholder is amber-tinted
- Each session's terminal shows its own name and directory in the mock output

- [ ] **Step 6: Commit**

```bash
git add src/renderer/styles/index.css src/renderer/components/SessionCard.tsx src/renderer/components/TerminalPanel.tsx src/renderer/components/Layout.tsx
git commit -m "Polish: animations, hover states, per-session mock output, grid theme"
```

---

## Summary

| Task | What it builds | Key files |
|------|---------------|-----------|
| 1 | Project scaffold | All config + entry points |
| 2 | Zustand store + mock data | session-store.ts |
| 3 | Custom titlebar | TitleBar.tsx |
| 4 | Status bar | StatusBar.tsx |
| 5 | Session card | SessionCard.tsx |
| 6 | Sidebar | SessionSidebar.tsx |
| 7 | Empty state + mock terminal | EmptyState.tsx, TerminalPanel.tsx |
| 8 | Full layout shell | Layout.tsx, App.tsx |
| 9 | New session modal | NewSessionModal.tsx |
| 10 | Grid view (free drag) | GridView.tsx |
| 11 | Keyboard shortcuts | useKeyboard.ts |
| 12 | Polish & animations | CSS + component tweaks |
