import { useEffect, useRef, useState } from 'react'
import type { PullRequest, SessionType, AiProvider } from '../../shared/types'

interface PrContextMenuProps {
  pr: PullRequest
  x: number
  y: number
  enabledProviders: AiProvider[]
  onClose: () => void
  onOpenInBrowser: () => void
  onCopyUrl: () => void
  onReviewInWorktree: (provider: SessionType) => void
}

export default function PrContextMenu({
  pr: _pr,
  x,
  y,
  enabledProviders,
  onClose,
  onOpenInBrowser,
  onCopyUrl,
  onReviewInWorktree
}: PrContextMenuProps): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)
  const [submenuOpen, setSubmenuOpen] = useState(false)
  const [adjustedPos, setAdjustedPos] = useState({ x, y })
  const [submenuFlipped, setSubmenuFlipped] = useState(false)

  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const newX = x + rect.width > window.innerWidth ? window.innerWidth - rect.width - 4 : x
    const newY = y + rect.height > window.innerHeight ? window.innerHeight - rect.height - 4 : y
    setAdjustedPos({ x: newX, y: newY })
    setSubmenuFlipped(newX + rect.width + 130 > window.innerWidth)
  }, [x, y])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const providerItems: { type: SessionType; label: string }[] = []
  if (enabledProviders.includes('claude')) providerItems.push({ type: 'claude', label: 'Claude' })
  if (enabledProviders.includes('gemini')) providerItems.push({ type: 'gemini', label: 'Gemini' })
  if (enabledProviders.includes('codex')) providerItems.push({ type: 'codex', label: 'Codex' })
  providerItems.push({ type: 'shell', label: 'Shell' })

  const menuItemClass = 'w-full text-left px-3 py-1.5 text-[11px] transition-colors hover:bg-[rgba(255,255,255,0.06)]'

  return (
    <>
    <div className="fixed inset-0 z-40" onClick={onClose} />
    <div
      ref={menuRef}
      className="fixed z-50 rounded-md py-1 shadow-lg"
      style={{
        left: adjustedPos.x,
        top: adjustedPos.y,
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        minWidth: 180
      }}
    >
      <button
        className={menuItemClass}
        style={{ color: 'var(--text-primary)' }}
        onClick={() => { onOpenInBrowser(); onClose() }}
      >
        Open in browser
      </button>
      <button
        className={menuItemClass}
        style={{ color: 'var(--text-primary)' }}
        onClick={() => { onCopyUrl(); onClose() }}
      >
        Copy PR URL
      </button>

      <div className="my-1" style={{ height: 1, backgroundColor: '#333' }} />

      {/* Review in worktree with submenu */}
      <div
        className="relative"
        onMouseEnter={() => setSubmenuOpen(true)}
        onMouseLeave={() => setSubmenuOpen(false)}
      >
        <button
          className={`${menuItemClass} flex items-center justify-between`}
          style={{ color: '#4ade80' }}
        >
          <span>Review in worktree</span>
          <span className="text-[9px] ml-2" style={{ opacity: 0.5 }}>&#9656;</span>
        </button>

        {submenuOpen && (
          <div
            className="absolute rounded-md py-1 shadow-lg"
            style={{
              ...(submenuFlipped ? { right: '100%' } : { left: '100%' }),
              top: 0,
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              minWidth: 120
            }}
          >
            {providerItems.map((item) => (
              <button
                key={item.type}
                className={menuItemClass}
                style={{ color: 'var(--text-primary)' }}
                onClick={() => { onReviewInWorktree(item.type); onClose() }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  )
}
