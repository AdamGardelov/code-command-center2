import { useState } from 'react'
import { Plus, Trash2, Pencil, Check, Box } from 'lucide-react'
import { useSessionStore } from '../../stores/session-store'
import type { ContainerConfig } from '../../../shared/types'

export default function ContainersSettings(): React.JSX.Element {
  const remoteHosts = useSessionStore((s) => s.remoteHosts)
  const containers = useSessionStore((s) => s.containers)
  const setContainers = useSessionStore((s) => s.setContainers)
  const enableContainers = useSessionStore((s) => s.enableContainers)
  const setEnableContainers = useSessionStore((s) => s.setEnableContainers)

  const [addContainerMode, setAddContainerMode] = useState(false)
  const [newContainer, setNewContainer] = useState<ContainerConfig>({ name: '' })
  const [editContainerIdx, setEditContainerIdx] = useState<number | null>(null)
  const [editContainerLabel, setEditContainerLabel] = useState('')

  return (
    <div className="space-y-4">
      {/* Feature flag toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enableContainers}
          onChange={(e) => void setEnableContainers(e.target.checked)}
          className="accent-[var(--accent)]"
        />
        <span className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>
          Enable container sessions
        </span>
      </label>

      {enableContainers && (
        <>
          {/* Container list */}
          {containers.map((container, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-2 py-1.5 rounded"
              style={{ backgroundColor: 'var(--bg-primary)' }}
            >
              <Box size={12} style={{ color: 'var(--container)' }} />
              {editContainerIdx === idx ? (
                <>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <input
                      className="w-full text-[11px] px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                      value={editContainerLabel}
                      onChange={(e) => setEditContainerLabel(e.target.value)}
                      placeholder="Label"
                    />
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!container.containerInternalPaths}
                        onChange={(e) => {
                          const updated = [...containers]
                          updated[idx] = {
                            ...updated[idx],
                            containerInternalPaths: e.target.checked || undefined,
                            worktreeBaseDir: e.target.checked ? updated[idx].worktreeBaseDir : undefined
                          }
                          void setContainers(updated)
                        }}
                        className="accent-[var(--accent)]"
                      />
                      <span className="text-[10px]" style={{ color: 'var(--text-primary)' }}>Repos live inside container</span>
                    </label>
                    {container.containerInternalPaths && (
                      <input
                        className="w-full text-[10px] px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                        placeholder="Worktree folder (e.g. /repos/worktrees)"
                        value={container.worktreeBaseDir ?? ''}
                        onChange={(e) => {
                          const updated = [...containers]
                          updated[idx] = { ...updated[idx], worktreeBaseDir: e.target.value || undefined }
                          void setContainers(updated)
                        }}
                      />
                    )}
                  </div>
                  <button onClick={() => {
                    const updated = [...containers]
                    updated[editContainerIdx!] = { ...updated[editContainerIdx!], label: editContainerLabel || undefined }
                    void setContainers(updated)
                    setEditContainerIdx(null)
                  }}>
                    <Check size={12} style={{ color: 'var(--success)' }} />
                  </button>
                </>
              ) : (
                <>
                  <span className="text-[11px] font-medium flex-1" style={{ color: 'var(--text-primary)' }}>
                    {container.label || container.name}
                  </span>
                  <span className="text-[9px] px-1 py-px rounded" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-raised)' }}>
                    {container.name}
                  </span>
                  {container.remoteHost && (
                    <span className="text-[9px] px-1 py-px rounded" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-raised)' }}>
                      @{container.remoteHost}
                    </span>
                  )}
                  {container.containerInternalPaths && (
                    <span className="text-[9px] px-1 py-px rounded" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-raised)' }} title="Repos live inside container">
                      /repos{container.worktreeBaseDir ? ` · wt:${container.worktreeBaseDir}` : ''}
                    </span>
                  )}
                  <button onClick={() => {
                    setEditContainerIdx(idx)
                    setEditContainerLabel(containers[idx].label ?? containers[idx].name)
                  }}>
                    <Pencil size={12} style={{ color: 'var(--text-muted)' }} />
                  </button>
                  <button onClick={() => {
                    void setContainers(containers.filter((_, i) => i !== idx))
                  }}>
                    <Trash2 size={12} style={{ color: 'var(--error)' }} />
                  </button>
                </>
              )}
            </div>
          ))}

          {/* Add container form */}
          {addContainerMode ? (
            <div className="space-y-2 p-2 rounded" style={{ backgroundColor: 'var(--bg-primary)' }}>
              <input
                className="w-full text-[11px] px-2 py-1 rounded"
                style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                placeholder="Container name (required)"
                value={newContainer.name}
                onChange={(e) => setNewContainer({ ...newContainer, name: e.target.value })}
                autoFocus
              />
              <input
                className="w-full text-[11px] px-2 py-1 rounded"
                style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                placeholder="Label (optional)"
                value={newContainer.label ?? ''}
                onChange={(e) => setNewContainer({ ...newContainer, label: e.target.value || undefined })}
              />
              <select
                className="w-full text-[11px] px-2 py-1 rounded"
                style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                value={newContainer.remoteHost ?? ''}
                onChange={(e) => setNewContainer({ ...newContainer, remoteHost: e.target.value || undefined })}
              >
                <option value="">Local</option>
                {remoteHosts.map(h => (
                  <option key={h.name} value={h.name}>{h.name}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={!!newContainer.containerInternalPaths}
                  onChange={(e) => setNewContainer({
                    ...newContainer,
                    containerInternalPaths: e.target.checked || undefined,
                    worktreeBaseDir: e.target.checked ? newContainer.worktreeBaseDir : undefined
                  })}
                  className="accent-[var(--accent)]"
                />
                <span className="text-[11px]" style={{ color: 'var(--text-primary)' }}>
                  Repos live inside container
                </span>
              </label>
              {newContainer.containerInternalPaths && (
                <input
                  className="w-full text-[11px] px-2 py-1 rounded"
                  style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                  placeholder="Worktree folder (e.g. /repos/worktrees)"
                  value={newContainer.worktreeBaseDir ?? ''}
                  onChange={(e) => setNewContainer({ ...newContainer, worktreeBaseDir: e.target.value || undefined })}
                />
              )}
              <div className="flex gap-2">
                <button
                  className="text-[11px] px-2 py-1 rounded font-medium"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)' }}
                  onClick={() => {
                    if (newContainer.name.trim()) {
                      void setContainers([...containers, { ...newContainer, name: newContainer.name.trim() }])
                      setNewContainer({ name: '' })
                      setAddContainerMode(false)
                    }
                  }}
                >
                  Add
                </button>
                <button
                  className="text-[11px] px-2 py-1 rounded"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={() => { setAddContainerMode(false); setNewContainer({ name: '' }) }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded"
              style={{ color: 'var(--accent)' }}
              onClick={() => setAddContainerMode(true)}
            >
              <Plus size={12} /> Add container
            </button>
          )}
        </>
      )}
    </div>
  )
}
