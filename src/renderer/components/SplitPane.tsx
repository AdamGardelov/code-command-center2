import { useCallback, useRef } from 'react'
import { Box } from 'lucide-react'
import type { Session, SplitNode } from '../../shared/types'
import { snapRatio } from '../lib/split-tree'
import TerminalPanel from './TerminalPanel'
import DragHandle from './DragHandle'

interface SplitPaneProps {
  node: SplitNode
  sessions: Session[]
  path: number[]
  onRatioChange: (path: number[], ratio: number) => void
  onDragEnd: () => void
  onActivate: (id: string) => void
  onDoubleClick: (id: string) => void
  activeSessionId: string | null
}

export default function SplitPane({
  node,
  sessions,
  path,
  onRatioChange,
  onDragEnd,
  onActivate,
  onDoubleClick,
  activeSessionId
}: SplitPaneProps): React.JSX.Element | null {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleRatioChange = useCallback(
    (ratio: number) => {
      onRatioChange(path, snapRatio(ratio))
    },
    [path, onRatioChange]
  )

  if (node.type === 'leaf') {
    const session = sessions.find((s) => s.id === node.sessionId)
    if (!session) return null

    return (
      <div
        className="grid-card"
        onClick={() => onActivate(session.id)}
        onDoubleClick={() => onDoubleClick(session.id)}
      >
        <div
          className="h-6 flex items-center px-2 flex-shrink-0"
          style={{ backgroundColor: 'var(--bg-surface)' }}
        >
          <span
            className={`w-[6px] h-[6px] rounded-full flex-shrink-0 mr-1.5 ${session.type === 'claude' && (session.status === 'working' || session.status === 'waiting') ? 'status-pulse' : ''}`}
            style={{
              backgroundColor: session.type === 'claude'
                ? session.status === 'idle' ? 'var(--success)'
                : session.status === 'working' ? 'var(--accent)'
                : session.status === 'waiting' ? 'var(--error)'
                : 'var(--text-muted)'
                : 'var(--text-muted)'
            }}
          />
          <span
            className="text-[10px] font-medium truncate flex-1"
            style={{
              color: session.id === activeSessionId ? session.color : 'var(--text-secondary)'
            }}
          >
            {session.displayName || session.name}
          </span>
          {session.isContainer && (
            <Box size={10} className="ml-1 flex-shrink-0" style={{ color: 'var(--container)' }} />
          )}
          {session.type === 'claude' && (
            <span
              className="text-[8px] font-semibold uppercase tracking-wide ml-2 flex-shrink-0"
              style={{
                color: session.status === 'idle' ? 'var(--success)'
                  : session.status === 'working' ? 'var(--accent)'
                  : session.status === 'waiting' ? 'var(--error)'
                  : 'var(--text-muted)'
              }}
            >
              {session.status === 'idle' ? 'idle' : session.status === 'working' ? 'working' : session.status === 'waiting' ? 'input' : session.status}
            </span>
          )}
        </div>
        <div className="flex-1 min-h-0 min-w-0 flex">
          <TerminalPanel session={session} />
        </div>
      </div>
    )
  }

  // Split node
  const flexDirection = node.direction === 'horizontal' ? 'row' : 'column'

  return (
    <div
      ref={containerRef}
      className="flex w-full h-full min-w-0 min-h-0"
      style={{ flexDirection }}
    >
      <div style={{ flex: node.ratio, minWidth: 0, minHeight: 0, display: 'flex' }}>
        <SplitPane
          node={node.children[0]}
          sessions={sessions}
          path={[...path, 0]}
          onRatioChange={onRatioChange}
          onDragEnd={onDragEnd}
          onActivate={onActivate}
          onDoubleClick={onDoubleClick}
          activeSessionId={activeSessionId}
        />
      </div>
      <DragHandle
        direction={node.direction}
        containerRef={containerRef}
        onRatioChange={handleRatioChange}
        onDragEnd={onDragEnd}
      />
      <div style={{ flex: 1 - node.ratio, minWidth: 0, minHeight: 0, display: 'flex' }}>
        <SplitPane
          node={node.children[1]}
          sessions={sessions}
          path={[...path, 1]}
          onRatioChange={onRatioChange}
          onDragEnd={onDragEnd}
          onActivate={onActivate}
          onDoubleClick={onDoubleClick}
          activeSessionId={activeSessionId}
        />
      </div>
    </div>
  )
}
