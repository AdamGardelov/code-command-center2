import { useState, useEffect } from 'react'
import { X, SquareTerminal, Server, Monitor, GitBranch, Zap, Bot, Box, Folder, ChevronDown } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'
import type { SessionType, ContainerConfig } from '../../shared/types'
import BranchPicker, { type BranchPickerResult } from './BranchPicker'

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

/* --- Primitives --- */

function FieldLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <label
      className="block"
      style={{
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--ink-3)',
        marginBottom: 6
      }}
    >
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  borderRadius: 7,
  backgroundColor: 'var(--bg-0)',
  border: '1px solid var(--line)',
  color: 'var(--ink-0)',
  fontSize: 12,
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  transition: 'border-color 120ms'
}

function Chip({
  active,
  onClick,
  disabled,
  children,
  title
}: {
  active?: boolean
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
  title?: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center transition-all duration-100"
      style={{
        padding: '5px 10px',
        gap: 5,
        border: `1px solid ${active ? 'var(--amber)' : 'var(--line)'}`,
        borderRadius: 6,
        backgroundColor: active ? 'var(--amber-wash)' : 'var(--bg-0)',
        color: active ? 'var(--amber)' : 'var(--ink-2)',
        fontSize: 11,
        fontFamily: 'var(--font-sans)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1
      }}
      onMouseEnter={(e) => {
        if (!active && !disabled) {
          e.currentTarget.style.borderColor = 'var(--ink-3)'
          e.currentTarget.style.color = 'var(--ink-1)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active && !disabled) {
          e.currentTarget.style.borderColor = 'var(--line)'
          e.currentTarget.style.color = 'var(--ink-2)'
        }
      }}
    >
      {children}
    </button>
  )
}

function TypeOption({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center transition-all duration-100"
      style={{
        padding: '10px 4px',
        gap: 4,
        border: `1px solid ${active ? 'var(--amber)' : 'var(--line)'}`,
        borderRadius: 8,
        backgroundColor: active ? 'var(--amber-wash)' : 'var(--bg-0)',
        color: active ? 'var(--amber)' : 'var(--ink-2)',
        fontSize: 11,
        cursor: 'pointer'
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.borderColor = 'var(--ink-3)'
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.borderColor = 'var(--line)'
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function Toggle({
  on,
  onToggle,
  warn,
  icon,
  label
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
        fontSize: 12
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
          flexShrink: 0
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
            transition: 'transform 150ms, background 150ms'
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

export default function NewSessionModal(): React.JSX.Element {
  const modalOpen = useSessionStore((s) => s.modalOpen)
  const toggleModal = useSessionStore((s) => s.toggleModal)
  const createSession = useSessionStore((s) => s.createSession)
  const favorites = useSessionStore((s) => s.favorites)
  const toggleSettings = useSessionStore((s) => s.toggleSettings)
  const enabledProviders = useSessionStore((s) => s.enabledProviders)
  const enableContainers = useSessionStore((s) => s.enableContainers)

  const remoteHosts = useSessionStore((s) => s.remoteHosts)
  const hostStatuses = useSessionStore((s) => s.hostStatuses)
  const defaultAutoMode = useSessionStore((s) => s.enableAutoMode)
  const defaultSkipPermissions = useSessionStore((s) => s.dangerouslySkipPermissions)
  const defaultCodexFullAuto = useSessionStore((s) => s.codexFullAuto)
  const defaultCodexDangerBypass = useSessionStore((s) => s.codexDangerouslyBypassApprovals)
  const [name, setName] = useState('')
  const [workingDirectory, setWorkingDirectory] = useState('')
  const [type, setType] = useState<SessionType>(enabledProviders[0] ?? 'claude')
  const [remoteHost, setRemoteHost] = useState<string | undefined>(undefined)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [branchChoice, setBranchChoice] = useState<BranchPickerResult | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [enableAutoMode, setEnableAutoMode] = useState(defaultAutoMode)
  const [skipPermissions, setSkipPermissions] = useState(defaultSkipPermissions)
  const [codexFullAuto, setCodexFullAuto] = useState(defaultCodexFullAuto)
  const [codexDangerBypass, setCodexDangerBypass] = useState(defaultCodexDangerBypass)
  const [runningContainers, setRunningContainers] = useState<ContainerConfig[]>([])
  const [selectedContainer, setSelectedContainer] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (modalOpen) {
      setEnableAutoMode(defaultAutoMode)
      setSkipPermissions(defaultSkipPermissions)
      setCodexFullAuto(defaultCodexFullAuto)
      setCodexDangerBypass(defaultCodexDangerBypass)
    }
  }, [modalOpen, defaultAutoMode, defaultSkipPermissions, defaultCodexFullAuto, defaultCodexDangerBypass])

  useEffect(() => {
    if (!modalOpen || !enableContainers) {
      setRunningContainers([])
      setSelectedContainer(undefined)
      return
    }
    void window.cccAPI.container.listRunning(remoteHost).then((containers) => {
      setRunningContainers(containers)
      if (containers.length > 0) {
        setSelectedContainer(containers[0].name)
      } else {
        setSelectedContainer(undefined)
      }
    })
  }, [modalOpen, enableContainers, remoteHost])

  if (!modalOpen) return <></>

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim() || creating) return
    if (type !== 'shell' && !workingDirectory.trim()) return

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
          const worktree = await window.cccAPI.git.addWorktree(
            workingDirectory.trim(),
            branchChoice.branch,
            '',
            branchChoice.mode,
            remoteHost
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
        containerName: selectedContainer
      })
      setName('')
      setWorkingDirectory('')
      setType(enabledProviders[0] ?? 'claude')
      setRemoteHost(undefined)
      setBranchChoice(null)
      setEnableAutoMode(defaultAutoMode)
      setSkipPermissions(defaultSkipPermissions)
      setCodexFullAuto(defaultCodexFullAuto)
      setCodexDangerBypass(defaultCodexDangerBypass)
      setRunningContainers([])
      setSelectedContainer(undefined)
      toggleModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
    } finally {
      setCreating(false)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget && !creating) toggleModal()
  }

  const typeButtons: { type: SessionType; label: string; icon: React.ReactNode }[] = []
  if (enabledProviders.includes('claude')) typeButtons.push({ type: 'claude', label: 'Claude', icon: <ClaudeIcon size={16} /> })
  if (enabledProviders.includes('gemini')) typeButtons.push({ type: 'gemini', label: 'Gemini', icon: <GeminiIcon size={16} /> })
  if (enabledProviders.includes('codex')) typeButtons.push({ type: 'codex', label: 'Codex', icon: <CodexIcon size={16} /> })
  typeButtons.push({ type: 'shell', label: 'Shell', icon: <SquareTerminal size={16} /> })

  const activeFavorites = remoteHost
    ? remoteHosts.find(h => h.name === remoteHost)?.favoriteFolders ?? []
    : favorites

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: 'var(--modal-backdrop)',
        backdropFilter: 'blur(3px)',
        animation: 'modal-fade 160ms ease'
      }}
      onClick={handleBackdropClick}
    >
      <div
        style={{
          width: 480,
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: 22,
          backgroundColor: 'var(--bg-1)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-modal)',
          animation: 'modal-enter 180ms cubic-bezier(0.2, 0.8, 0.2, 1)'
        }}
        className="ccc-scroll"
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-0)', letterSpacing: '-0.005em' }}>
            New Session
            <span style={{ color: 'var(--ink-3)', fontWeight: 400, marginLeft: 8, fontSize: 11 }}>
              tmux · {remoteHost ?? 'local'}
            </span>
          </div>
          <button
            onClick={toggleModal}
            className="flex items-center justify-center rounded transition-colors duration-100"
            style={{ width: 24, height: 24, color: 'var(--ink-3)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-2)'
              e.currentTarget.style.color = 'var(--ink-0)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'var(--ink-3)'
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Where */}
        {remoteHosts.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <FieldLabel>Where</FieldLabel>
            <div className="flex flex-wrap" style={{ gap: 6 }}>
              <Chip active={remoteHost === undefined} onClick={() => { setRemoteHost(undefined); setBranchChoice(null) }}>
                <Monitor size={11} /> Local
              </Chip>
              {remoteHosts.map((rh) => {
                const online = hostStatuses[rh.name] ?? false
                return (
                  <Chip
                    key={rh.name}
                    active={remoteHost === rh.name}
                    disabled={!online}
                    onClick={() => { if (online) { setRemoteHost(rh.name); setBranchChoice(null) } }}
                    title={online ? rh.name : `${rh.name} — offline`}
                  >
                    <Server size={11} /> {rh.name}
                    {!online && (
                      <span style={{ fontSize: 9, color: 'var(--ink-3)' }}>offline</span>
                    )}
                  </Chip>
                )
              })}
            </div>
          </div>
        )}

        {/* Favorites */}
        {activeFavorites.length > 0 ? (
          <div style={{ marginBottom: 14 }}>
            <FieldLabel>Favorites</FieldLabel>
            <div className="flex flex-wrap" style={{ gap: 6 }}>
              {activeFavorites.map((fav, idx) => {
                const isActive = name === fav.name && workingDirectory === fav.path
                return (
                  <Chip
                    key={idx}
                    active={isActive}
                    onClick={() => {
                      setName(fav.name)
                      setWorkingDirectory(fav.path)
                      setBranchChoice(null)
                    }}
                  >
                    {fav.name}
                  </Chip>
                )
              })}
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 14, textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => { toggleModal(); toggleSettings() }}
              className="transition-colors hover:underline"
              style={{ fontSize: 10, color: 'var(--ink-3)', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              Add favorite repos in Settings
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col" style={{ gap: 14 }}>
          {/* Type */}
          <div>
            <FieldLabel>Type</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${typeButtons.length}, 1fr)`, gap: 6 }}>
              {typeButtons.map((btn) => (
                <TypeOption
                  key={btn.type}
                  active={type === btn.type}
                  onClick={() => setType(btn.type)}
                  icon={btn.icon}
                  label={btn.label}
                />
              ))}
            </div>
          </div>

          {/* Claude toggles */}
          {type === 'claude' && (
            <div className="flex flex-wrap" style={{ gap: 18 }}>
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
            </div>
          )}

          {/* Codex toggles */}
          {type === 'codex' && (
            <div className="flex flex-wrap" style={{ gap: 18 }}>
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
                label="Danger mode"
              />
            </div>
          )}

          {/* Session name */}
          <div>
            <FieldLabel>Session Name</FieldLabel>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. api-server"
              autoFocus
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--amber-rim)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }}
            />
          </div>

          {/* Working directory */}
          {type !== 'shell' && (
            <div>
              <FieldLabel>Working Directory</FieldLabel>
              <input
                type="text"
                value={workingDirectory}
                onChange={(e) => {
                  setWorkingDirectory(e.target.value)
                  setBranchChoice(null)
                }}
                placeholder="e.g. ~/projects/my-app"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--amber-rim)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }}
              />
            </div>
          )}

          {/* Branch / Worktree trigger */}
          {workingDirectory.trim() && type !== 'shell' && (
            <div>
              <FieldLabel>Branch / Worktree</FieldLabel>
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
                          <span className="branch-trigger__tag">worktree</span>
                        )}
                        {(branchChoice.mode === 'existing-local' || branchChoice.mode === 'track-remote') && (
                          <span className="branch-trigger__tag">checkout</span>
                        )}
                        {branchChoice.mode === 'new-branch' && (
                          <span className="branch-trigger__tag">new</span>
                        )}
                      </>
                    ) : (
                      <span style={{ color: 'var(--ink-3)' }}>Open repo as-is — pick branch to use a worktree…</span>
                    )}
                  </span>
                  {branchChoice && (
                    <span className="branch-trigger__sub">
                      {branchChoice.worktreePath ?? 'a new worktree will be created on submit'}
                    </span>
                  )}
                </span>
                <span className="branch-trigger__kbd">
                  <ChevronDown size={12} style={{ color: 'var(--ink-3)' }} />
                </span>
              </button>
            </div>
          )}

          {enableContainers && runningContainers.length > 0 && (
            <div>
              <FieldLabel>Container</FieldLabel>
              <div className="relative">
                <Box
                  size={12}
                  className="absolute"
                  style={{ left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--container)', pointerEvents: 'none' }}
                />
                <select
                  value={selectedContainer ?? ''}
                  onChange={(e) => setSelectedContainer(e.target.value || undefined)}
                  style={{ ...inputStyle, paddingLeft: 28, appearance: 'none' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--amber-rim)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }}
                >
                  <option value="">No container (run on host)</option>
                  {runningContainers.map((c) => (
                    <option key={c.name} value={c.name}>{c.label || c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {error && (
            <p style={{ fontSize: 11, color: 'var(--s-error)' }}>{error}</p>
          )}

          {/* Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={toggleModal}
              disabled={creating}
              style={{
                padding: '9px 14px',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                fontFamily: 'var(--font-sans)',
                backgroundColor: 'var(--bg-2)',
                color: 'var(--ink-1)',
                cursor: creating ? 'not-allowed' : 'pointer',
                transition: 'background 120ms'
              }}
              onMouseEnter={(e) => { if (!creating) e.currentTarget.style.backgroundColor = 'var(--bg-3)' }}
              onMouseLeave={(e) => { if (!creating) e.currentTarget.style.backgroundColor = 'var(--bg-2)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !name.trim()}
              style={{
                padding: '9px 14px',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                fontFamily: 'var(--font-sans)',
                backgroundColor: !name.trim() || creating ? 'var(--bg-3)' : 'var(--amber)',
                color: !name.trim() || creating ? 'var(--ink-3)' : 'var(--bg-0)',
                cursor: !name.trim() || creating ? 'not-allowed' : 'pointer',
                boxShadow: !name.trim() || creating ? 'none' : '0 4px 14px -4px color-mix(in srgb, var(--amber) 60%, transparent)',
                transition: 'background 120ms'
              }}
              onMouseEnter={(e) => {
                if (!creating && name.trim()) e.currentTarget.style.backgroundColor = 'var(--amber-hi)'
              }}
              onMouseLeave={(e) => {
                if (!creating && name.trim()) e.currentTarget.style.backgroundColor = 'var(--amber)'
              }}
            >
              {creating ? 'Creating…' : 'Create session'}
            </button>
          </div>
        </form>
      </div>

      {pickerOpen && workingDirectory.trim() && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            backgroundColor: 'var(--modal-backdrop)',
            backdropFilter: 'blur(3px)'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPickerOpen(false)
          }}
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
              animation: 'modal-enter 180ms cubic-bezier(0.2, 0.8, 0.2, 1)'
            }}
          >
            <div
              className="flex items-center"
              style={{ padding: '16px 18px 12px', gap: 10, borderBottom: '1px solid var(--line-soft)' }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-0)' }}>
                Pick branch or worktree
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                for session in{' '}
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-1)' }}>
                  {workingDirectory.trim()}
                </span>
              </div>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="flex items-center justify-center rounded transition-colors duration-100"
                style={{ width: 24, height: 24, color: 'var(--ink-3)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-2)'
                  e.currentTarget.style.color = 'var(--ink-0)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = 'var(--ink-3)'
                }}
              >
                <X size={14} />
              </button>
            </div>
            <BranchPicker
              repoPath={workingDirectory.trim()}
              remoteHost={remoteHost}
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
