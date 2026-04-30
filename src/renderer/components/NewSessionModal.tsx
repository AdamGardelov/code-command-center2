import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  X,
  SquareTerminal,
  Monitor,
  GitBranch,
  Zap,
  Bot,
  Box,
  Folder,
  ChevronDown,
  Star,
  Clock,
  Search,
} from 'lucide-react'
import { useSessionStore } from '../stores/session-store'
import type { SessionType, ContainerConfig, FavoriteFolder, Session, WorktreeCreateMode } from '../../shared/types'
import BranchPicker, { type BranchPickerResult } from './BranchPicker'
import MultiRepoPreview from './MultiRepoPreview'

function ClaudeIcon({ size = 14 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 1200 1200" fill="none">
      <path d="M233.96 800.21L468.64 668.54l3.95-11.44-3.95-6.36h-11.44l-39.22-2.42-134.09-3.62-116.3-4.83L54.93 633.83l-28.35-5.04L0 592.75l2.74-17.48 23.84-16.03 34.15 2.98 75.46 5.15 113.24 7.81 82.15 4.83 121.69 12.65h19.33l2.74-7.81-6.6-4.83-5.16-4.83L346.39 495.79 219.54 411.87l-66.44-48.32-35.92-24.48-18.12-22.95-7.81-50.1 32.62-35.92 43.81 2.98 11.19 2.98 44.38 34.15L318.04 343.57l123.79 91.17 18.12 15.06 7.25-5.15.89-3.62-8.14-13.63-67.46-121.69-71.84-123.79-31.96-51.3-8.46-30.77c-2.98-12.64-5.15-23.27-5.15-36.24L312.32 13.21l20.54-6.6 49.53 6.6 20.86 18.12 30.77 70.39 49.85 110.82 77.32 150.68 22.63 44.7 12.08 41.4 4.51 12.64h7.81v-7.25l6.36-84.89 11.76-104.21 11.44-134.09 3.95-37.77 18.68-45.26 37.13-24.48 29 13.85 23.84 34.15-3.3 22.07-14.17 92.13-27.79 144.32-18.12 96.64h10.55l12.08-12.08 48.89-64.91 82.15-102.68 36.24-40.75 42.28-45.02 27.14-21.42h51.3l37.77 56.13-16.91 57.99-52.83 67-43.81 56.78-62.82 84.56-39.22 67.65 3.62 5.4 9.34-0.89 141.91-30.2 76.67-13.85 91.49-15.7 41.4 19.33 4.51 19.65-16.27 40.19-97.85 24.16-114.77 22.95-170.9 40.43-2.09 1.53 2.42 2.98 76.99 7.25 32.94 1.77 80.62 0 150.12 11.19 39.22 25.93 23.52 31.73-3.95 24.16-60.4 30.77-81.5-19.33-190.23-45.26-65.46-16.27-9.02 0v5.4l54.36 53.15 99.62 89.96 124.75 115.97 6.36 28.67-16.03 22.63-16.91-2.42-109.61-82.47-42.28-37.13-95.76-80.62-5.56 0v8.46l22.07 32.29 116.54 175.17 6.04 53.72-8.46 17.48-30.2 10.55-33.18-6.04-68.21-95.76-70.39-107.84-56.78-96.64-6.93 3.95-33.5 360.89-15.7 18.44-36.24 13.85-30.2-22.95-16.03-37.13 16.03-73.37 19.33-95.87 15.7-76.1 14.17-94.55 8.46-31.41-.56-2.09-6.93.89-71.23 97.85-108.4 146.5-85.77 91.81-20.54 8.14-35.6-18.44 3.3-32.94 19.89-29.32 118.7-150.99 71.6-93.58 46.23-48.17-.32-7.81-2.74 0L205.29 929.4l-56.13 7.25-24.16-22.63 2.98-37.13 11.44-12.08 94.79-65.23Z" fill="#d97757" />
    </svg>
  )
}

function GeminiIcon({ size = 14 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M14 28C14 21.77 9.94 16.66 4.42 15.08C2.91 14.64 1.36 14.38 0 14.25V13.75C1.36 13.62 2.91 13.36 4.42 12.92C9.94 11.34 14 6.23 14 0C14 6.23 18.06 11.34 23.58 12.92C25.09 13.36 26.64 13.62 28 13.75V14.25C26.64 14.38 25.09 14.64 23.58 15.08C18.06 16.66 14 21.77 14 28Z" fill="#6ea3f2" />
    </svg>
  )
}

function CodexIcon({ size = 14 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" clipRule="evenodd">
      <path d="M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.21-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.94-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z" />
    </svg>
  )
}

const LOCAL_HOST_ID = 'local'

interface FlatDest {
  id: string
  hostId: string
  hostName: string
  kind: 'host' | 'container'
  name: string
  displayName: string
  sub: string
  online: boolean
  containerKind?: 'bunker' | 'sandbox'
  container?: ContainerConfig
  hostFavorites: FavoriteFolder[]
}

const kbdStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9.5,
  padding: '1px 5px',
  borderRadius: 3,
  background: 'var(--bg-2)',
  border: '1px solid var(--line)',
  color: 'var(--ink-1)',
}

function FieldLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }): React.JSX.Element {
  return (
    <label
      className="block"
      style={{
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--ink-3)',
        margin: 0,
        ...style,
      }}
    >
      {children}
    </label>
  )
}

function Toggle({
  on,
  onToggle,
  warn,
  icon,
  label,
}: {
  on: boolean
  onToggle: () => void
  warn?: boolean
  icon: React.ReactNode
  label: string
}): React.JSX.Element {
  const onColor = warn ? 'var(--s-error)' : 'var(--amber)'
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center"
      style={{
        gap: 10,
        padding: '4px 0',
        cursor: 'pointer',
        background: 'transparent',
        border: 'none',
        color: 'var(--ink-2)',
        fontSize: 12,
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'relative',
          display: 'inline-block',
          width: 28,
          height: 16,
          borderRadius: 8,
          backgroundColor: on ? onColor : 'var(--bg-3)',
          transition: 'background 150ms',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: 2,
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: on ? 'var(--bg-0)' : 'var(--ink-2)',
            transform: on ? 'translateX(12px)' : 'translateX(0)',
            transition: 'transform 150ms, background 150ms',
          }}
        />
      </span>
      <span className="inline-flex items-center" style={{ gap: 6 }}>
        {icon}
        {label}
      </span>
    </button>
  )
}

interface DestRowProps {
  d: FlatDest
  active: boolean
  isDefault: boolean
  onClick: () => void
  onSetDefault: () => void
}

function DestRow({ d, active, isDefault, onClick, onSetDefault }: DestRowProps): React.JSX.Element {
  const isContainer = d.kind === 'container'
  const disabled = !d.online
  return (
    <div
      onClick={() => { if (!disabled) onClick() }}
      style={{
        display: 'grid',
        gridTemplateColumns: '24px 1fr auto auto',
        gap: 10,
        alignItems: 'center',
        padding: '8px 10px',
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: active ? 'var(--amber-wash)' : 'transparent',
        opacity: disabled ? 0.42 : 1,
        border: active ? '1px solid var(--amber-rim)' : '1px solid transparent',
        transition: 'background 80ms',
      }}
      onMouseEnter={(e) => { if (!active && !disabled) e.currentTarget.style.background = 'var(--bg-2)' }}
      onMouseLeave={(e) => { if (!active && !disabled) e.currentTarget.style.background = 'transparent' }}
    >
      <div
        style={{
          width: 24, height: 24, borderRadius: 6,
          background: isContainer ? 'color-mix(in srgb, var(--container, #7ec8c8) 18%, transparent)' : 'var(--bg-2)',
          color: isContainer ? 'var(--container, #7ec8c8)' : 'var(--ink-1)',
          display: 'grid', placeItems: 'center', border: '1px solid var(--line)',
        }}
      >
        {isContainer ? <Box size={12} /> : <Monitor size={12} />}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: active ? 'var(--amber-hi)' : 'var(--ink-0)' }}>
            {d.displayName}
          </span>
          {isContainer && d.containerKind && (
            <span
              style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                padding: '1px 6px', borderRadius: 3,
                background: d.containerKind === 'bunker' ? 'color-mix(in srgb, var(--amber) 20%, transparent)' : 'var(--bg-2)',
                color: d.containerKind === 'bunker' ? 'var(--amber)' : 'var(--ink-2)',
                border: '1px solid var(--line)',
              }}
            >{d.containerKind}</span>
          )}
          {!isContainer && d.hostId === LOCAL_HOST_ID && (
            <span
              style={{
                fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 3,
                color: 'var(--ink-3)', border: '1px solid var(--line)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}
            >local</span>
          )}
          {isDefault && (
            <span
              title="Default destination"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                color: 'var(--amber)',
              }}
            >
              <Star size={9} fill="var(--amber)" color="var(--amber)" />
              default
            </span>
          )}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 1, fontFamily: 'var(--font-mono)' }}>{d.sub}</div>
      </div>
      <button
        type="button"
        title={isDefault ? 'Default destination (click to unpin)' : 'Set as default'}
        onClick={(e) => { e.stopPropagation(); if (!disabled) onSetDefault() }}
        disabled={disabled}
        style={{
          width: 22, height: 22, display: 'grid', placeItems: 'center',
          background: 'transparent', border: 'none', borderRadius: 4,
          color: isDefault ? 'var(--amber)' : 'var(--ink-4)',
          opacity: isDefault ? 1 : 0.35,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'opacity 100ms, color 100ms, background 100ms',
        }}
        onMouseEnter={(e) => {
          if (disabled) return
          e.currentTarget.style.opacity = '1'
          e.currentTarget.style.background = 'var(--bg-3)'
          if (!isDefault) e.currentTarget.style.color = 'var(--amber-hi)'
        }}
        onMouseLeave={(e) => {
          if (disabled) return
          e.currentTarget.style.opacity = isDefault ? '1' : '0.35'
          e.currentTarget.style.background = 'transparent'
          if (!isDefault) e.currentTarget.style.color = 'var(--ink-4)'
        }}
      >
        <Star size={12} fill={isDefault ? 'var(--amber)' : 'transparent'} />
      </button>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 10, color: disabled ? 'var(--s-error)' : 'var(--ink-3)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: disabled ? 'var(--s-error)' : 'var(--s-done)',
            boxShadow: disabled ? 'none' : '0 0 6px color-mix(in srgb, var(--s-done) 60%, transparent)',
          }}
        />
        {disabled ? 'offline' : 'ready'}
      </div>
    </div>
  )
}

function timeAgoShort(ts: number): string {
  if (!ts) return ''
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  const days = Math.floor(diff / 86400)
  if (days < 7) return `${days}d`
  if (days < 30) return `${Math.floor(days / 7)}w`
  return `${Math.floor(days / 30)}mo`
}

interface RecentEntry {
  key: string
  name: string
  type: SessionType
  workingDirectory: string
  remoteHost?: string
  containerName?: string
  branch?: string
  lastActiveAt: number
  destId: string
}

function buildRecents(sessions: Session[]): RecentEntry[] {
  const seen = new Set<string>()
  const out: RecentEntry[] = []
  const sorted = [...sessions].sort((a, b) => b.lastActiveAt - a.lastActiveAt)
  for (const s of sorted) {
    if (s.type === 'shell') continue
    const display = s.displayName || s.name
    if (seen.has(display)) continue
    seen.add(display)
    const hostId = s.remoteHost || LOCAL_HOST_ID
    const destId = s.containerName ? `${hostId}/${s.containerName}` : hostId
    out.push({
      key: s.id,
      name: display,
      type: s.type,
      workingDirectory: s.workingDirectory,
      remoteHost: s.remoteHost,
      containerName: s.containerName,
      branch: s.gitBranch,
      lastActiveAt: s.lastActiveAt,
      destId,
    })
    if (out.length >= 5) break
  }
  return out
}

export default function NewSessionModal(): React.JSX.Element {
  const modalOpen = useSessionStore((s) => s.modalOpen)
  const toggleModal = useSessionStore((s) => s.toggleModal)
  const createSession = useSessionStore((s) => s.createSession)
  const favorites = useSessionStore((s) => s.favorites)
  const enabledProviders = useSessionStore((s) => s.enabledProviders)
  const enableContainers = useSessionStore((s) => s.enableContainers)

  const remoteHosts = useSessionStore((s) => s.remoteHosts)
  const hostStatuses = useSessionStore((s) => s.hostStatuses)
  const sessions = useSessionStore((s) => s.sessions)
  const defaultAutoMode = useSessionStore((s) => s.enableAutoMode)
  const defaultSkipPermissions = useSessionStore((s) => s.dangerouslySkipPermissions)
  const defaultCodexFullAuto = useSessionStore((s) => s.codexFullAuto)
  const defaultCodexDangerBypass = useSessionStore((s) => s.codexDangerouslyBypassApprovals)
  const defaultDestinationId = useSessionStore((s) => s.defaultDestinationId)
  const setDefaultDestinationId = useSessionStore((s) => s.setDefaultDestinationId)
  const worktreeBasePathFromStore = useSessionStore((s) => s.worktreeBasePath)

  const [name, setName] = useState('')
  const [selectedRepos, setSelectedRepos] = useState<string[]>([])
  const [primaryRepo, setPrimaryRepo] = useState<string | null>(null)
  const [perRepoSessions, setPerRepoSessions] = useState(false)
  const [resolutions, setResolutions] = useState<Map<string, WorktreeCreateMode>>(new Map())
  const [creationErrors, setCreationErrors] = useState<Map<string, string>>(new Map())
  const [branchInput, setBranchInput] = useState('')
  // Task folder is the parent dir that groups per-repo worktrees on disk.
  // Tracks the branch slug until the user edits it explicitly.
  const [taskName, setTaskName] = useState('')
  const [taskNameDirty, setTaskNameDirty] = useState(false)
  const [freeFormPath, setFreeFormPath] = useState('')

  const workingDirectory = selectedRepos[0] ?? freeFormPath
  const isMulti = selectedRepos.length >= 2

  const branchSlug = useMemo<string>(() => {
    const cleaned = branchInput
      .replace(/^refs\/heads\//, '')
      .replace(/^refs\/remotes\//, '')
      .replace(/^heads\//, '')
      .trim()
    return cleaned.split('/').filter(Boolean).pop() ?? ''
  }, [branchInput])
  const effectiveTaskName = (taskNameDirty ? taskName : branchSlug).trim()
  const [type, setType] = useState<SessionType>(enabledProviders[0] ?? 'claude')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [branchChoice, setBranchChoice] = useState<BranchPickerResult | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [enableAutoMode, setEnableAutoMode] = useState(defaultAutoMode)
  const [skipPermissions, setSkipPermissions] = useState(defaultSkipPermissions)
  const [codexFullAuto, setCodexFullAuto] = useState(defaultCodexFullAuto)
  const [codexDangerBypass, setCodexDangerBypass] = useState(defaultCodexDangerBypass)
  const [runningContainers, setRunningContainersLocal] = useState<ContainerConfig[]>([])
  const [runningContainersRemote, setRunningContainersRemote] = useState<Record<string, ContainerConfig[]>>({})
  const [destId, setDestId] = useState<string>(LOCAL_HOST_ID)
  const [destQuery, setDestQuery] = useState('')
  const [bunkerRepos, setBunkerRepos] = useState<string[]>([])
  const [bunkerReposLoading, setBunkerReposLoading] = useState(false)

  const flatDests = useMemo<FlatDest[]>(() => {
    const out: FlatDest[] = []
    // Local host first
    out.push({
      id: LOCAL_HOST_ID,
      hostId: LOCAL_HOST_ID,
      hostName: 'Local',
      kind: 'host',
      name: 'local',
      displayName: 'Local',
      sub: 'this machine',
      online: true,
      hostFavorites: favorites,
    })
    // Containers attached to local
    if (enableContainers) {
      for (const c of runningContainers) {
        const kind: 'bunker' | 'sandbox' = c.containerInternalPaths ? 'bunker' : 'sandbox'
        out.push({
          id: `${LOCAL_HOST_ID}/${c.name}`,
          hostId: LOCAL_HOST_ID,
          hostName: 'Local',
          kind: 'container',
          name: c.name,
          displayName: c.label?.trim() || c.name,
          sub: kind === 'bunker' ? 'repos pre-mounted at /repos' : 'point at any working dir',
          online: true,
          containerKind: kind,
          container: c,
          hostFavorites: favorites,
        })
      }
    }
    // Remote hosts and their containers
    for (const rh of remoteHosts) {
      const online = hostStatuses[rh.name] ?? false
      out.push({
        id: rh.name,
        hostId: rh.name,
        hostName: rh.name,
        kind: 'host',
        name: rh.name,
        displayName: rh.name,
        sub: rh.host,
        online,
        hostFavorites: rh.favoriteFolders ?? [],
      })
      if (enableContainers && online) {
        const containers = runningContainersRemote[rh.name] ?? []
        for (const c of containers) {
          const kind: 'bunker' | 'sandbox' = c.containerInternalPaths ? 'bunker' : 'sandbox'
          out.push({
            id: `${rh.name}/${c.name}`,
            hostId: rh.name,
            hostName: rh.name,
            kind: 'container',
            name: c.name,
            displayName: c.label?.trim() || c.name,
            sub: kind === 'bunker' ? 'repos pre-mounted at /repos' : 'point at any working dir',
            online: true,
            containerKind: kind,
            container: c,
            hostFavorites: rh.favoriteFolders ?? [],
          })
        }
      }
    }
    return out
  }, [favorites, remoteHosts, hostStatuses, enableContainers, runningContainers, runningContainersRemote])

  const dest = flatDests.find((d) => d.id === destId) ?? flatDests[0]
  const activeContainer = dest?.container
  const isBunkerContainer = dest?.kind === 'container' && dest.containerKind === 'bunker'
  const isSandboxContainer = dest?.kind === 'container' && dest.containerKind === 'sandbox'
  const remoteHost = dest && dest.hostId !== LOCAL_HOST_ID ? dest.hostId : undefined

  const filteredDests = destQuery.trim()
    ? flatDests.filter((d) => {
        const q = destQuery.toLowerCase()
        return (
          d.displayName.toLowerCase().includes(q) ||
          d.sub.toLowerCase().includes(q) ||
          d.hostName.toLowerCase().includes(q)
        )
      })
    : flatDests

  const groupedDests = useMemo(() => {
    const g = new Map<string, FlatDest[]>()
    for (const d of filteredDests) {
      const arr = g.get(d.hostId) ?? []
      arr.push(d)
      g.set(d.hostId, arr)
    }
    return Array.from(g.entries())
  }, [filteredDests])

  const recents = useMemo(() => buildRecents(sessions), [sessions])

  const repoSourceLabel: React.ReactNode = isBunkerContainer
    ? (<>pick from <span style={{ color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>/repos</span> in container</>)
    : isSandboxContainer
      ? (<>point at a working dir on <span style={{ color: 'var(--ink-2)' }}>{dest?.hostName}</span></>)
      : (<>repos on <span style={{ color: 'var(--ink-2)' }}>{dest?.displayName}</span></>)

  // Reset transient state when modal opens
  useEffect(() => {
    if (!modalOpen) return
    setEnableAutoMode(defaultAutoMode)
    setSkipPermissions(defaultSkipPermissions)
    setCodexFullAuto(defaultCodexFullAuto)
    setCodexDangerBypass(defaultCodexDangerBypass)
    setError(null)
    setBranchChoice(null)
    setDestQuery('')
    setName('')
    setSelectedRepos([])
    setPrimaryRepo(null)
    setBranchInput('')
    setTaskName('')
    setTaskNameDirty(false)
    setFreeFormPath('')
    setResolutions(new Map())
    setCreationErrors(new Map())
    setPerRepoSessions(false)
  }, [modalOpen, defaultAutoMode, defaultSkipPermissions, defaultCodexFullAuto, defaultCodexDangerBypass])

  // Pick default destination on open. If the default points at a container that
  // hasn't loaded yet, retry once it appears — but stop retrying once the user
  // makes their own selection.
  const openedRef = useRef(false)
  const resolvedRef = useRef(false)
  useEffect(() => {
    if (!modalOpen) {
      openedRef.current = false
      resolvedRef.current = false
      return
    }
    const defaultExists = !!defaultDestinationId && flatDests.some((d) => d.id === defaultDestinationId && d.online)
    if (!openedRef.current) {
      openedRef.current = true
      if (defaultExists) {
        setDestId(defaultDestinationId as string)
        resolvedRef.current = true
      } else {
        setDestId(flatDests.find((d) => d.online)?.id ?? LOCAL_HOST_ID)
        if (!defaultDestinationId) resolvedRef.current = true
      }
      return
    }
    if (!resolvedRef.current && defaultExists) {
      setDestId(defaultDestinationId as string)
      resolvedRef.current = true
    }
  }, [modalOpen, defaultDestinationId, flatDests])

  // Load running containers (local) when modal opens
  useEffect(() => {
    if (!modalOpen || !enableContainers) {
      setRunningContainersLocal([])
      return
    }
    void window.cccAPI.container.listRunning(undefined).then((containers) => {
      setRunningContainersLocal(containers)
    })
  }, [modalOpen, enableContainers])

  // Load running containers for each online remote host
  useEffect(() => {
    if (!modalOpen || !enableContainers) {
      setRunningContainersRemote({})
      return
    }
    let cancelled = false
    const next: Record<string, ContainerConfig[]> = {}
    Promise.all(
      remoteHosts
        .filter((rh) => hostStatuses[rh.name])
        .map(async (rh) => {
          try {
            const containers = await window.cccAPI.container.listRunning(rh.name)
            next[rh.name] = containers
          } catch {
            next[rh.name] = []
          }
        }),
    ).then(() => {
      if (!cancelled) setRunningContainersRemote(next)
    })
    return () => {
      cancelled = true
    }
  }, [modalOpen, enableContainers, remoteHosts, hostStatuses])

  // Load bunker repo list when destination is a bunker container
  useEffect(() => {
    if (!isBunkerContainer || !activeContainer) {
      setBunkerRepos([])
      return
    }
    setBunkerReposLoading(true)
    window.cccAPI.container
      .listRepos(activeContainer.name, activeContainer.remoteHost)
      .then((repos) => {
        // /repos/ contains both the actual checkouts and the worktree base
        // directory; treating the latter as a repo makes BranchPicker run
        // `git fetch` against a non-repo and surface "offline — cached".
        const baseDir = activeContainer.worktreeBaseDir
        const baseName = baseDir
          ? baseDir.replace(/^\/repos\//, '').replace(/\/.*$/, '').replace(/\/+$/, '')
          : null
        setBunkerRepos(baseName ? repos.filter((r) => r !== baseName) : repos)
      })
      .finally(() => setBunkerReposLoading(false))
  }, [isBunkerContainer, activeContainer?.name, activeContainer?.remoteHost, activeContainer?.worktreeBaseDir])

  // Debounced branch resolution for multi-repo mode
  useEffect(() => {
    if (!isMulti || !branchInput.trim()) {
      setResolutions(new Map())
      return
    }
    const handle = setTimeout(() => {
      void window.cccAPI.git
        .resolveBranchBatch(selectedRepos, branchInput.trim(), remoteHost, isBunkerContainer ? activeContainer?.name : undefined)
        .then((results) => {
          const next = new Map<string, WorktreeCreateMode>()
          for (const r of results) {
            if (r.ok) next.set(r.repoPath, r.mode)
          }
          setResolutions(next)
        })
    }, 250)
    return () => clearTimeout(handle)
  }, [isMulti, branchInput, selectedRepos, remoteHost, isBunkerContainer, activeContainer?.name])

  const selectDest = useCallback((id: string): void => {
    resolvedRef.current = true
    setDestId((prev) => {
      if (prev !== id) {
        setSelectedRepos([])
        setPrimaryRepo(null)
        setFreeFormPath('')
        setBranchChoice(null)
      }
      return id
    })
  }, [])

  const handleSubmit = useCallback(
    async (e?: React.FormEvent): Promise<void> => {
      if (e) e.preventDefault()
      if (!name.trim() && !isMulti) return
      if (creating) return

      // Single-repo path — preserves existing behavior exactly
      if (!isMulti) {
        if (type !== 'shell' && !workingDirectory.trim()) return
        if (isBunkerContainer && !workingDirectory.startsWith('/repos/')) return

        setCreating(true)
        setError(null)
        try {
          let dir = workingDirectory.trim() || '~'
          if (branchChoice && type !== 'shell' && workingDirectory.trim()) {
            if (branchChoice.mode === 'existing-worktree' && branchChoice.worktreePath) {
              dir = branchChoice.worktreePath
            } else if (
              branchChoice.mode === 'existing-local' ||
              branchChoice.mode === 'track-remote' ||
              branchChoice.mode === 'new-branch'
            ) {
              const repoName = workingDirectory.trim().split('/').filter(Boolean).pop() ?? 'repo'
              const bunkerTargetPath = isBunkerContainer && activeContainer
                ? `${activeContainer.worktreeBaseDir ?? '/repos/worktrees'}/${branchChoice.branch}/${repoName}`
                : ''
              const worktree = await window.cccAPI.git.addWorktree(
                workingDirectory.trim(),
                branchChoice.branch,
                bunkerTargetPath,
                branchChoice.mode,
                remoteHost,
                isBunkerContainer ? activeContainer?.name : undefined,
              )
              dir = worktree.path
            }
          }
          await createSession({
            name: name.trim(),
            workingDirectory: dir,
            type,
            remoteHost,
            enableAutoMode: type === 'claude' ? enableAutoMode : undefined,
            skipPermissions: type === 'claude' ? skipPermissions : undefined,
            codexFullAuto: type === 'codex' ? codexFullAuto : undefined,
            codexDangerBypass: type === 'codex' ? codexDangerBypass : undefined,
            containerName: dest?.kind === 'container' ? activeContainer?.name : undefined,
          })
          toggleModal()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to create session')
        } finally {
          setCreating(false)
        }
        return
      }

      // Multi-repo path
      if (!branchInput.trim()) {
        setError('Branch name is required for multi-repo tasks')
        return
      }

      setCreating(true)
      setError(null)
      setCreationErrors(new Map())
      try {
        // 1. Create worktrees in parallel-per-repo (the IPC fans them out sequentially server-side)
        const reposToCreate = selectedRepos.map((repoPath) => ({
          repoPath,
          mode: resolutions.get(repoPath) ?? 'new-branch' as WorktreeCreateMode,
        }))
        const wtResults = await window.cccAPI.git.addWorktreeBatch({
          repos: reposToCreate,
          branch: branchInput.trim(),
          taskName: effectiveTaskName || undefined,
          remoteHost,
          containerName: isBunkerContainer ? activeContainer?.name : undefined,
        })

        const errs = new Map<string, string>()
        const oks = new Map<string, string>() // repoPath -> worktreePath
        for (const r of wtResults) {
          if (r.ok) oks.set(r.repoPath, r.worktree.path)
          else errs.set(r.repoPath, r.error)
        }
        if (errs.size > 0) setCreationErrors(errs)
        if (oks.size === 0) {
          setError('All worktree creations failed.')
          return
        }

        // 2. Create sessions
        const repoLeaf = (p: string): string => p.split('/').filter(Boolean).pop() ?? p
        const sessionType = type
        const containerName = dest?.kind === 'container' ? activeContainer?.name : undefined

        // The task folder is the parent of every per-repo worktree path.
        const taskFolderPath = (() => {
          const sample = oks.values().next().value as string | undefined
          if (!sample) return ''
          const parts = sample.split('/')
          parts.pop()
          return parts.join('/')
        })()
        const groupName = effectiveTaskName || branchInput.trim()

        if (perRepoSessions) {
          const createdIds: string[] = []
          for (const [repoPath, wtPath] of oks) {
            const sessionName = `${groupName} · ${repoLeaf(repoPath)}`
            const session = await createSession({
              name: sessionName,
              workingDirectory: wtPath,
              type: sessionType,
              remoteHost,
              enableAutoMode: sessionType === 'claude' ? enableAutoMode : undefined,
              skipPermissions: sessionType === 'claude' ? skipPermissions : undefined,
              codexFullAuto: sessionType === 'codex' ? codexFullAuto : undefined,
              codexDangerBypass: sessionType === 'codex' ? codexDangerBypass : undefined,
              containerName,
            })
            if (session?.id) createdIds.push(session.id)
          }
          if (createdIds.length > 0) {
            try {
              const group = await window.cccAPI.group.create(groupName)
              for (const id of createdIds) {
                await window.cccAPI.group.addSession(group.id, id)
              }
            } catch (groupErr) {
              console.warn('Sessions created but grouping failed:', groupErr)
            }
          }
        } else {
          // Shared session opens at the task folder so the agent sees every
          // per-repo worktree as a sibling — the "one agent, all repos" mode.
          await createSession({
            name: name.trim() || groupName,
            workingDirectory: taskFolderPath,
            type: sessionType,
            remoteHost,
            enableAutoMode: sessionType === 'claude' ? enableAutoMode : undefined,
            skipPermissions: sessionType === 'claude' ? skipPermissions : undefined,
            codexFullAuto: sessionType === 'codex' ? codexFullAuto : undefined,
            codexDangerBypass: sessionType === 'codex' ? codexDangerBypass : undefined,
            containerName,
          })
        }

        if (errs.size === 0) toggleModal()
        // If errs.size > 0 we keep the modal open so user can retry the failures.
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create multi-repo task')
      } finally {
        setCreating(false)
      }
    },
    [
      name, creating, type, workingDirectory, isBunkerContainer, branchChoice,
      activeContainer, remoteHost, dest, createSession, toggleModal,
      enableAutoMode, skipPermissions, codexFullAuto, codexDangerBypass,
      isMulti, branchInput, effectiveTaskName, selectedRepos, resolutions,
      perRepoSessions, primaryRepo,
    ],
  )

  // Keyboard shortcuts: ⌘⏎ submit, esc close (when picker isn't open).
  useEffect(() => {
    if (!modalOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        void handleSubmit()
      } else if (e.key === 'Escape' && !pickerOpen && !creating) {
        e.preventDefault()
        toggleModal()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalOpen, handleSubmit, pickerOpen, creating, toggleModal])

  if (!modalOpen) return <></>

  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget && !creating) toggleModal()
  }

  const handleRecentClick = (r: RecentEntry): void => {
    resolvedRef.current = true
    setName(r.name)
    setType(r.type)
    if (flatDests.some((d) => d.id === r.destId && d.online)) {
      setDestId(r.destId)
    }
    setSelectedRepos([])
    setPrimaryRepo(null)
    setFreeFormPath(r.workingDirectory)
    setBranchChoice(null)
  }

  const typeButtons: { type: SessionType; label: string; icon: React.ReactNode }[] = []
  if (enabledProviders.includes('claude')) typeButtons.push({ type: 'claude', label: 'Claude', icon: <ClaudeIcon size={14} /> })
  if (enabledProviders.includes('gemini')) typeButtons.push({ type: 'gemini', label: 'Gemini', icon: <GeminiIcon size={14} /> })
  if (enabledProviders.includes('codex')) typeButtons.push({ type: 'codex', label: 'Codex', icon: <CodexIcon size={14} /> })
  typeButtons.push({ type: 'shell', label: 'Shell', icon: <SquareTerminal size={14} /> })

  const repoChoices: string[] = isBunkerContainer
    ? bunkerRepos
    : (dest?.hostFavorites ?? []).map((f) => f.path)

  const handleRepoChipClick = (val: string): void => {
    const path = isBunkerContainer ? `/repos/${val}` : val
    setSelectedRepos((prev) => {
      const idx = prev.indexOf(path)
      if (idx >= 0) {
        const next = [...prev.slice(0, idx), ...prev.slice(idx + 1)]
        if (primaryRepo === path) setPrimaryRepo(next[0] ?? null)
        return next
      }
      if (!isBunkerContainer) {
        const fav = (dest?.hostFavorites ?? []).find((f) => f.path === path)
        if (fav && !name.trim()) setName(fav.name)
      }
      setPrimaryRepo((p) => p ?? path)
      return [...prev, path]
    })
    setBranchChoice(null)
  }

  const repoIsActive = (val: string): boolean => {
    const path = isBunkerContainer ? `/repos/${val}` : val
    return selectedRepos.includes(path)
  }

  const branchPathPreview = branchChoice
    ? (branchChoice.worktreePath ?? (isBunkerContainer && activeContainer
        ? `${activeContainer.worktreeBaseDir ?? '/repos/worktrees'}/${branchChoice.branch}/${(workingDirectory.split('/').filter(Boolean).pop() ?? 'repo')}`
        : 'a new worktree will be created on submit'))
    : null

  const ready = isMulti
    ? selectedRepos.length >= 2 && !!branchInput.trim()
    : !!name.trim() && (type === 'shell' || !!workingDirectory.trim()) && !(isBunkerContainer && !workingDirectory.startsWith('/repos/'))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: 'var(--modal-backdrop, rgba(0,0,0,0.55))',
        backdropFilter: 'blur(3px)',
        animation: 'modal-fade 160ms ease',
      }}
      onClick={handleBackdropClick}
    >
      <div
        className="modal-shell"
        data-multi={isMulti ? 'true' : 'false'}
        style={{
          width: isMulti ? 960 : 560,
          maxHeight: '92vh',
          backgroundColor: 'var(--bg-1)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-modal)',
          animation: 'modal-enter 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 22px 12px',
            borderBottom: '1px solid var(--line-soft)',
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-0)', letterSpacing: '-0.005em' }}>
            {isMulti ? 'New multi-repo task' : 'New session'}
            {isMulti && (
              <span className="modal-pill">multi-repo</span>
            )}
          </div>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
            <kbd style={kbdStyle}>esc</kbd> close · <kbd style={kbdStyle}>⌘⏎</kbd> create
          </span>
          <button
            type="button"
            onClick={toggleModal}
            className="flex items-center justify-center rounded transition-colors duration-100"
            style={{ width: 24, height: 24, color: 'var(--ink-3)', background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: 6 }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-2)'; e.currentTarget.style.color = 'var(--ink-0)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body-wrap">
        <form
          onSubmit={handleSubmit}
          className="ccc-scroll"
          style={{ padding: '14px 22px 0', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          {/* Recents */}
          {recents.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
                  Resume recent
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--line-soft)' }} />
              </div>
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }} className="ccc-scroll">
                {recents.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => handleRecentClick(r)}
                    style={{
                      flexShrink: 0,
                      padding: '6px 10px',
                      borderRadius: 6,
                      background: 'var(--bg-0)',
                      border: '1px solid var(--line)',
                      cursor: 'pointer',
                      minWidth: 0,
                      textAlign: 'left',
                      fontFamily: 'var(--font-sans)',
                      color: 'inherit',
                      transition: 'border-color 100ms',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--amber-rim)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={10} style={{ color: 'var(--ink-4)' }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-0)' }}>{r.name}</span>
                      <span style={{ fontSize: 9.5, color: 'var(--ink-4)' }}>{timeAgoShort(r.lastActiveAt)}</span>
                    </div>
                    <div
                      style={{
                        fontSize: 9.5,
                        color: 'var(--ink-3)',
                        fontFamily: 'var(--font-mono)',
                        marginTop: 2,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {(r.workingDirectory.split('/').filter(Boolean).pop() ?? r.workingDirectory)}
                      {r.branch ? ` · ${r.branch.length > 18 ? r.branch.slice(0, 18) + '…' : r.branch}` : ''}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* DESTINATION */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <FieldLabel>1 · Destination</FieldLabel>
              <span
                style={{
                  fontSize: 9.5,
                  color: 'var(--ink-4)',
                  fontWeight: 400,
                  letterSpacing: 0,
                  textTransform: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Star size={9} fill="var(--amber)" color="var(--amber)" />
                star one to set as default
              </span>
              <div style={{ flex: 1 }} />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 8px',
                  background: 'var(--bg-0)',
                  border: '1px solid var(--line)',
                  borderRadius: 5,
                  width: 160,
                }}
              >
                <Search size={10} style={{ color: 'var(--ink-4)' }} />
                <input
                  value={destQuery}
                  onChange={(e) => setDestQuery(e.target.value)}
                  placeholder="filter…"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--ink-1)',
                    fontSize: 10.5,
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              </div>
            </div>
            <div
              className="ccc-scroll"
              style={{
                border: '1px solid var(--line)',
                borderRadius: 8,
                background: 'var(--bg-0)',
                padding: 4,
                maxHeight: 220,
                overflowY: 'auto',
              }}
            >
              {groupedDests.map(([hostId, items]) => {
                const host = flatDests.find((d) => d.hostId === hostId && d.kind === 'host')
                const headerName = host?.displayName ?? hostId
                const headerOnline = host?.online ?? true
                return (
                  <div key={hostId}>
                    <div
                      style={{
                        padding: '6px 10px 4px',
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: headerOnline ? 'var(--ink-4)' : 'var(--s-error)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span>{headerName}</span>
                      {!headerOnline && <span style={{ fontWeight: 500 }}>· offline</span>}
                    </div>
                    {items.map((d) => (
                      <DestRow
                        key={d.id}
                        d={d}
                        active={d.id === destId}
                        isDefault={d.id === defaultDestinationId}
                        onClick={() => selectDest(d.id)}
                        onSetDefault={() => {
                          void setDefaultDestinationId(d.id === defaultDestinationId ? null : d.id)
                        }}
                      />
                    ))}
                  </div>
                )
              })}
              {filteredDests.length === 0 && (
                <div style={{ padding: '18px 12px', textAlign: 'center', fontSize: 11, color: 'var(--ink-3)' }}>
                  No destinations match &ldquo;{destQuery}&rdquo;
                </div>
              )}
            </div>
          </div>

          {/* REPO */}
          {type !== 'shell' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <FieldLabel>2 · Repo</FieldLabel>
                <span style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>
                  {repoSourceLabel}
                </span>
              </div>

              {isBunkerContainer && bunkerReposLoading ? (
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Loading repos…</div>
              ) : isBunkerContainer && bunkerRepos.length === 0 ? (
                <div
                  style={{
                    padding: '10px 12px',
                    background: 'var(--bg-0)',
                    border: '1px dashed var(--line)',
                    borderRadius: 7,
                    fontSize: 11,
                    color: 'var(--ink-3)',
                  }}
                >
                  No repos found in container at /repos.
                </div>
              ) : !isBunkerContainer && repoChoices.length === 0 && !isSandboxContainer ? (
                <div
                  style={{
                    padding: '10px 12px',
                    background: 'var(--bg-0)',
                    border: '1px dashed var(--line)',
                    borderRadius: 7,
                    fontSize: 11,
                    color: 'var(--ink-3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Folder size={11} />
                  <span>No favorites on {dest?.displayName}.</span>
                  <input
                    type="text"
                    value={freeFormPath}
                    onChange={(e) => { setFreeFormPath(e.target.value); setBranchChoice(null) }}
                    placeholder="enter a path…"
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--ink-1)',
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                </div>
              ) : (
                <div className="chip-row">
                  {repoChoices.map((r) => {
                    const active = repoIsActive(r)
                    const label = isBunkerContainer ? r : ((dest?.hostFavorites ?? []).find((f) => f.path === r)?.name ?? r)
                    return (
                      <button
                        type="button"
                        key={r}
                        onClick={() => handleRepoChipClick(r)}
                        className={`chip ${active ? 'active' : ''}`}
                        style={{
                          fontFamily: isBunkerContainer ? 'var(--font-mono)' : undefined,
                          fontSize: isBunkerContainer ? 10.5 : undefined,
                        }}
                      >
                        {isBunkerContainer ? (
                          <><span style={{ color: 'var(--ink-3)' }}>/repos/</span>{label}</>
                        ) : (
                          label
                        )}
                      </button>
                    )
                  })}
                  {isSandboxContainer && (
                    <input
                      type="text"
                      value={freeFormPath}
                      onChange={(e) => { setFreeFormPath(e.target.value); setBranchChoice(null) }}
                      placeholder="working directory in container…"
                      style={{
                        flex: '1 1 200px',
                        padding: '5px 10px',
                        background: 'var(--bg-0)',
                        border: '1px solid var(--line)',
                        borderRadius: 6,
                        outline: 'none',
                        color: 'var(--ink-1)',
                        fontSize: 11,
                        fontFamily: 'var(--font-mono)',
                      }}
                    />
                  )}
                  {!isBunkerContainer && !isSandboxContainer && repoChoices.length > 0 && (
                    <input
                      type="text"
                      value={freeFormPath}
                      onChange={(e) => { setFreeFormPath(e.target.value); setBranchChoice(null) }}
                      placeholder="or browse path…"
                      style={{
                        flex: '1 1 160px',
                        padding: '5px 10px',
                        background: 'var(--bg-0)',
                        border: '1px dashed var(--line)',
                        borderRadius: 6,
                        outline: 'none',
                        color: 'var(--ink-1)',
                        fontSize: 11,
                        fontFamily: 'var(--font-mono)',
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* BRANCH */}
          {type !== 'shell' && (selectedRepos.length > 0 || workingDirectory.trim()) && (
            <div>
              <FieldLabel style={{ marginBottom: 6 }}>3 · Branch{isMulti ? '' : ' / worktree'}</FieldLabel>
              {isMulti ? (
                <>
                  <input
                    type="text"
                    value={branchInput}
                    onChange={(e) => setBranchInput(e.target.value)}
                    placeholder="feat/refund-flow"
                    className="branch-multi-input"
                  />
                  <div className="task-folder-row">
                    <FieldLabel style={{ marginBottom: 0, flexShrink: 0 }}>
                      Task folder
                    </FieldLabel>
                    <span className="task-folder-row__hint">parent of all worktrees</span>
                    <div className="task-folder-input">
                      <span className="task-folder-input__prefix">
                        {(worktreeBasePathFromStore ?? '~/Dev/worktrees')}/
                      </span>
                      <input
                        type="text"
                        value={taskNameDirty ? taskName : branchSlug}
                        placeholder={branchSlug || 'task-name'}
                        onChange={(e) => { setTaskName(e.target.value); setTaskNameDirty(true) }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className="branch-trigger"
                  onClick={() => setPickerOpen(true)}
                >
                  <span className="branch-trigger__icon">
                    {branchChoice?.worktreePath ? (
                      <Folder size={13} style={{ color: 'var(--amber)' }} />
                    ) : (
                      <GitBranch size={13} style={{ color: branchChoice ? 'var(--ink-1)' : 'var(--ink-3)' }} />
                    )}
                  </span>
                  <span className="branch-trigger__main">
                    <span className="branch-trigger__name">
                      {branchChoice ? (
                        <>
                          <span>{branchChoice.branch}</span>
                          {branchChoice.mode === 'existing-worktree' && (
                            <span className="bp-row__badge active" style={{ height: 14, fontSize: 8.5 }}>worktree</span>
                          )}
                          {(branchChoice.mode === 'existing-local' || branchChoice.mode === 'track-remote') && (
                            <span className="bp-row__badge main" style={{ height: 14, fontSize: 8.5 }}>checkout</span>
                          )}
                          {branchChoice.mode === 'new-branch' && (
                            <span className="bp-row__badge active" style={{ height: 14, fontSize: 8.5 }}>new</span>
                          )}
                        </>
                      ) : (
                        <span style={{ color: 'var(--ink-3)' }}>Open repo as-is — pick branch to use a worktree…</span>
                      )}
                    </span>
                    {branchChoice && (
                      <span className="branch-trigger__sub">
                        {branchPathPreview}
                      </span>
                    )}
                  </span>
                  <span className="branch-trigger__kbd">
                    <ChevronDown size={12} style={{ color: 'var(--ink-3)' }} />
                  </span>
                </button>
              )}
            </div>
          )}

          {/* AGENT + NAME */}
          <div>
            <FieldLabel style={{ marginBottom: 6 }}>4 · Agent &amp; name</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8 }}>
              <div
                style={{
                  display: 'flex',
                  gap: 3,
                  padding: 3,
                  background: 'var(--bg-0)',
                  border: '1px solid var(--line)',
                  borderRadius: 7,
                }}
              >
                {typeButtons.map((btn) => {
                  const active = type === btn.type
                  return (
                    <button
                      key={btn.type}
                      type="button"
                      onClick={() => setType(btn.type)}
                      title={btn.label}
                      style={{
                        width: 34,
                        height: 30,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: 5,
                        background: active ? 'var(--amber-wash)' : 'transparent',
                        color: active ? 'var(--amber)' : 'var(--ink-2)',
                        cursor: 'pointer',
                        border: active ? '1px solid var(--amber-rim)' : '1px solid transparent',
                        transition: 'all 100ms',
                      }}
                    >
                      {btn.icon}
                    </button>
                  )
                })}
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="session name (e.g. salary)"
                autoFocus
                style={{
                  width: '100%',
                  padding: '9px 11px',
                  borderRadius: 7,
                  backgroundColor: 'var(--bg-0)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink-0)',
                  fontSize: 12,
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                  transition: 'border-color 120ms',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--amber-rim)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }}
              />
            </div>

            {(type === 'claude' || type === 'codex') && (
              <div style={{ display: 'flex', gap: 18, marginTop: 10 }}>
                {type === 'claude' && (
                  <>
                    <Toggle
                      on={enableAutoMode}
                      onToggle={() => setEnableAutoMode(!enableAutoMode)}
                      icon={<Bot size={11} />}
                      label="Auto mode"
                    />
                    <Toggle
                      on={skipPermissions}
                      warn
                      onToggle={() => setSkipPermissions(!skipPermissions)}
                      icon={<Zap size={11} />}
                      label="Skip permissions"
                    />
                  </>
                )}
                {type === 'codex' && (
                  <>
                    <Toggle
                      on={codexFullAuto}
                      onToggle={() => setCodexFullAuto(!codexFullAuto)}
                      icon={<Bot size={11} />}
                      label="Full auto"
                    />
                    <Toggle
                      on={codexDangerBypass}
                      warn
                      onToggle={() => setCodexDangerBypass(!codexDangerBypass)}
                      icon={<Zap size={11} />}
                      label="Danger bypass"
                    />
                  </>
                )}
              </div>
            )}
          </div>

          {error && (
            <p style={{ fontSize: 11, color: 'var(--s-error)' }}>{error}</p>
          )}
        </form>
        {isMulti && (
          <MultiRepoPreview
            selectedRepos={selectedRepos}
            primaryRepo={primaryRepo}
            branch={branchInput}
            taskFolder={effectiveTaskName}
            resolutions={resolutions}
            perRepoSessions={perRepoSessions}
            worktreeBasePath={worktreeBasePathFromStore ?? '~/Dev/worktrees'}
            creationErrors={creationErrors}
            onSetPrimary={(p) => { if (!perRepoSessions) setPrimaryRepo(p) }}
            onRemove={(p) => {
              setSelectedRepos((prev) => prev.filter((x) => x !== p))
              if (primaryRepo === p) setPrimaryRepo(() => {
                const next = selectedRepos.filter((x) => x !== p)[0]
                return next ?? null
              })
            }}
            onSetPerRepo={(v) => setPerRepoSessions(v)}
            onRetry={(p) => {
              setCreationErrors((prev) => { const n = new Map(prev); n.delete(p); return n })
            }}
          />
        )}
        </div>{/* end modal-body-wrap */}

        {/* Footer */}
        <div
          style={{
            padding: '10px 22px',
            borderTop: '1px solid var(--line)',
            background: 'var(--bg-0)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--ink-3)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {ready ? (
              <>
                <span style={{ color: 'var(--s-done)' }}>→</span>{' '}
                <span style={{ color: 'var(--ink-1)' }}>{name.trim()}</span>
                <span style={{ color: 'var(--ink-4)' }}> · </span>
                {type}
                <span style={{ color: 'var(--ink-4)' }}> · </span>
                {dest?.displayName}
                {type !== 'shell' && (
                  <>
                    <span style={{ color: 'var(--ink-4)' }}> · </span>
                    {(workingDirectory.split('/').filter(Boolean).pop() ?? workingDirectory)}
                  </>
                )}
                {branchChoice && (
                  <>
                    <span style={{ color: 'var(--ink-4)' }}>@</span>
                    {branchChoice.branch.length > 16 ? branchChoice.branch.slice(0, 16) + '…' : branchChoice.branch}
                  </>
                )}
              </>
            ) : (
              <span>
                {!name.trim()
                  ? 'Name your session to continue'
                  : type !== 'shell' && !workingDirectory.trim()
                    ? 'Pick a repo to continue'
                    : isBunkerContainer && !workingDirectory.startsWith('/repos/')
                      ? 'Pick a /repos path inside the container'
                      : 'Ready'}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={toggleModal}
            disabled={creating}
            style={{
              padding: '7px 14px',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 600,
              border: 'none',
              fontFamily: 'var(--font-sans)',
              backgroundColor: 'var(--bg-2)',
              color: 'var(--ink-1)',
              cursor: creating ? 'not-allowed' : 'pointer',
              transition: 'background 120ms',
            }}
            onMouseEnter={(e) => { if (!creating) e.currentTarget.style.backgroundColor = 'var(--bg-3)' }}
            onMouseLeave={(e) => { if (!creating) e.currentTarget.style.backgroundColor = 'var(--bg-2)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { void handleSubmit() }}
            disabled={!ready || creating}
            style={{
              padding: '7px 16px',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 600,
              border: 'none',
              fontFamily: 'var(--font-sans)',
              backgroundColor: !ready || creating ? 'var(--bg-3)' : 'var(--amber)',
              color: !ready || creating ? 'var(--ink-3)' : 'var(--bg-0)',
              cursor: !ready || creating ? 'not-allowed' : 'pointer',
              boxShadow: !ready || creating ? 'none' : '0 4px 14px -4px color-mix(in srgb, var(--amber) 60%, transparent)',
              transition: 'background 120ms',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
            onMouseEnter={(e) => { if (ready && !creating) e.currentTarget.style.backgroundColor = 'var(--amber-hi)' }}
            onMouseLeave={(e) => { if (ready && !creating) e.currentTarget.style.backgroundColor = 'var(--amber)' }}
          >
            {creating ? 'Creating…' : (
              isMulti
                ? perRepoSessions
                  ? `Create ${selectedRepos.length} sessions`
                  : `Create task · ${selectedRepos.length} worktrees`
                : 'Create session'
            )}
            {!creating && (
              <span style={{ opacity: 0.6, fontFamily: 'var(--font-mono)', fontSize: 10 }}>⌘⏎</span>
            )}
          </button>
        </div>
      </div>

      {pickerOpen && workingDirectory.trim() && type !== 'shell' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'var(--modal-backdrop, rgba(0,0,0,0.55))', backdropFilter: 'blur(3px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setPickerOpen(false) }}
        >
          <div
            style={{
              width: 760,
              maxHeight: '85vh',
              backgroundColor: 'var(--bg-1)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-modal)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              animation: 'modal-enter 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
          >
            <div
              className="flex items-center"
              style={{ padding: '16px 18px 12px', gap: 10, borderBottom: '1px solid var(--line-soft)' }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-0)' }}>Pick branch or worktree</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                for session in{' '}
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-1)' }}>{workingDirectory.trim()}</span>
              </div>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="flex items-center justify-center rounded transition-colors duration-100"
                style={{
                  width: 24, height: 24, color: 'var(--ink-3)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-2)'; e.currentTarget.style.color = 'var(--ink-0)' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)' }}
              >
                <X size={14} />
              </button>
            </div>
            <BranchPicker
              repoPath={workingDirectory.trim()}
              remoteHost={remoteHost}
              containerName={isBunkerContainer ? activeContainer?.name : undefined}
              onCancel={() => setPickerOpen(false)}
              onConfirm={(result) => {
                setBranchChoice(result)
                setPickerOpen(false)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

