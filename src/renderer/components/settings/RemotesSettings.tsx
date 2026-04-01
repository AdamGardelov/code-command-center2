import { useState } from 'react'
import { Plus, Trash2, Pencil, Check, Server, ChevronDown, ChevronRight } from 'lucide-react'
import { useSessionStore } from '../../stores/session-store'
import type { FavoriteFolder, RemoteHost } from '../../../shared/types'

export default function RemotesSettings(): React.JSX.Element {
  const remoteHosts = useSessionStore((s) => s.remoteHosts)
  const setRemoteHosts = useSessionStore((s) => s.setRemoteHosts)

  const [editRemoteIdx, setEditRemoteIdx] = useState<number | null>(null)
  const [editRemoteForm, setEditRemoteForm] = useState<{ name: string; host: string; shell: string }>({ name: '', host: '', shell: '' })
  const [addRemoteMode, setAddRemoteMode] = useState(false)
  const [expandedRemote, setExpandedRemote] = useState<number | null>(null)
  const [editRemoteFavIdx, setEditRemoteFavIdx] = useState<number | null>(null)
  const [editRemoteFavForm, setEditRemoteFavForm] = useState<FavoriteFolder>({ name: '', path: '', defaultBranch: 'main' })
  const [addRemoteFavMode, setAddRemoteFavMode] = useState(false)

  const saveRemoteHosts = (updated: RemoteHost[]): void => {
    void setRemoteHosts(updated)
  }

  return (
    <div className="flex flex-col gap-2">
      {remoteHosts.map((rh, idx) =>
        editRemoteIdx === idx ? (
          <div key={idx} className="flex flex-col gap-2 p-3 rounded-lg border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)' }}>
            <input
              type="text"
              value={editRemoteForm.name}
              onChange={(e) => setEditRemoteForm({ ...editRemoteForm, name: e.target.value })}
              placeholder="Name (e.g. dev-server)"
              autoFocus
              className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
            />
            <input
              type="text"
              value={editRemoteForm.host}
              onChange={(e) => setEditRemoteForm({ ...editRemoteForm, host: e.target.value })}
              placeholder="SSH host (e.g. user@192.168.1.100)"
              className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
            />
            <input
              type="text"
              value={editRemoteForm.shell}
              onChange={(e) => setEditRemoteForm({ ...editRemoteForm, shell: e.target.value })}
              placeholder="Shell (default: /bin/bash)"
              className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditRemoteIdx(null)}
                className="px-2.5 py-1 rounded-md text-[11px] transition-colors duration-100"
                style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!editRemoteForm.name.trim() || !editRemoteForm.host.trim()) return
                  const updated = [...remoteHosts]
                  updated[idx] = { ...updated[idx], name: editRemoteForm.name.trim(), host: editRemoteForm.host.trim(), shell: editRemoteForm.shell.trim() || undefined }
                  saveRemoteHosts(updated)
                  setEditRemoteIdx(null)
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-100"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)' }}
              >
                <Check size={11} />
                Save
              </button>
            </div>
          </div>
        ) : (
          <div key={idx}>
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border"
              style={{ borderColor: 'var(--bg-raised)', backgroundColor: 'var(--bg-primary)' }}
            >
              <button
                onClick={() => setExpandedRemote(expandedRemote === idx ? null : idx)}
                className="p-0.5"
                style={{ color: 'var(--text-muted)' }}
              >
                {expandedRemote === idx ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </button>
              <Server size={12} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {rh.name}
                </div>
                <div className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {rh.host}
                </div>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}>
                {rh.favoriteFolders.length} favorites
              </span>
              <button
                onClick={() => {
                  setEditRemoteIdx(idx)
                  setEditRemoteForm({ name: rh.name, host: rh.host, shell: rh.shell || '' })
                  setAddRemoteMode(false)
                }}
                className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
                style={{ color: 'var(--text-muted)' }}
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => {
                  const updated = remoteHosts.filter((_, i) => i !== idx)
                  saveRemoteHosts(updated)
                  if (expandedRemote === idx) setExpandedRemote(null)
                }}
                className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
                style={{ color: 'var(--text-muted)' }}
              >
                <Trash2 size={12} />
              </button>
            </div>

            {/* Expanded: per-host favorite folders */}
            {expandedRemote === idx && (
              <div className="ml-6 mt-1 flex flex-col gap-1.5">
                <div className="text-[10px] uppercase tracking-wide font-medium px-1 pt-1" style={{ color: 'var(--text-muted)' }}>
                  Favorite Folders
                </div>
                {rh.favoriteFolders.map((fav, fIdx) =>
                  editRemoteFavIdx === fIdx ? (
                    <div key={fIdx} className="flex flex-col gap-1.5 p-2.5 rounded-lg border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)' }}>
                      <input
                        type="text"
                        value={editRemoteFavForm.name}
                        onChange={(e) => setEditRemoteFavForm({ ...editRemoteFavForm, name: e.target.value })}
                        placeholder="Name"
                        autoFocus
                        className="w-full px-2 py-1 rounded-md text-[11px] border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                      />
                      <input
                        type="text"
                        value={editRemoteFavForm.path}
                        onChange={(e) => setEditRemoteFavForm({ ...editRemoteFavForm, path: e.target.value })}
                        placeholder="Path"
                        className="w-full px-2 py-1 rounded-md text-[11px] border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                      />
                      <input
                        type="text"
                        value={editRemoteFavForm.defaultBranch}
                        onChange={(e) => setEditRemoteFavForm({ ...editRemoteFavForm, defaultBranch: e.target.value })}
                        placeholder="Default branch"
                        className="w-full px-2 py-1 rounded-md text-[11px] border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => { setEditRemoteFavIdx(null); setAddRemoteFavMode(false) }}
                          className="px-2 py-0.5 rounded-md text-[10px] transition-colors duration-100"
                          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            if (!editRemoteFavForm.name.trim() || !editRemoteFavForm.path.trim()) return
                            const updated = [...remoteHosts]
                            const favs = [...updated[idx].favoriteFolders]
                            if (addRemoteFavMode) {
                              favs.push({ ...editRemoteFavForm })
                            } else {
                              favs[fIdx] = { ...editRemoteFavForm }
                            }
                            updated[idx] = { ...updated[idx], favoriteFolders: favs }
                            saveRemoteHosts(updated)
                            setEditRemoteFavIdx(null)
                            setAddRemoteFavMode(false)
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors duration-100"
                          style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)' }}
                        >
                          <Check size={10} />
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={fIdx}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border"
                      style={{ borderColor: 'var(--bg-raised)', backgroundColor: 'var(--bg-primary)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>{fav.name}</span>
                        <span className="text-[10px] ml-2" style={{ color: 'var(--text-muted)' }}>{fav.path}</span>
                      </div>
                      <button
                        onClick={() => {
                          setEditRemoteFavIdx(fIdx)
                          setEditRemoteFavForm({ ...fav })
                          setAddRemoteFavMode(false)
                        }}
                        className="p-0.5 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Pencil size={10} />
                      </button>
                      <button
                        onClick={() => {
                          const updated = [...remoteHosts]
                          updated[idx] = { ...updated[idx], favoriteFolders: updated[idx].favoriteFolders.filter((_, i) => i !== fIdx) }
                          saveRemoteHosts(updated)
                        }}
                        className="p-0.5 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  )
                )}

                {addRemoteFavMode && editRemoteFavIdx === null ? (
                  <div className="flex flex-col gap-1.5 p-2.5 rounded-lg border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)' }}>
                    <input
                      type="text"
                      value={editRemoteFavForm.name}
                      onChange={(e) => setEditRemoteFavForm({ ...editRemoteFavForm, name: e.target.value })}
                      placeholder="Name"
                      autoFocus
                      className="w-full px-2 py-1 rounded-md text-[11px] border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                    />
                    <input
                      type="text"
                      value={editRemoteFavForm.path}
                      onChange={(e) => setEditRemoteFavForm({ ...editRemoteFavForm, path: e.target.value })}
                      placeholder="Path"
                      className="w-full px-2 py-1 rounded-md text-[11px] border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                    />
                    <input
                      type="text"
                      value={editRemoteFavForm.defaultBranch}
                      onChange={(e) => setEditRemoteFavForm({ ...editRemoteFavForm, defaultBranch: e.target.value })}
                      placeholder="Default branch"
                      className="w-full px-2 py-1 rounded-md text-[11px] border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { setAddRemoteFavMode(false) }}
                        className="px-2 py-0.5 rounded-md text-[10px] transition-colors duration-100"
                        style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          if (!editRemoteFavForm.name.trim() || !editRemoteFavForm.path.trim()) return
                          const updated = [...remoteHosts]
                          const favs = [...updated[idx].favoriteFolders, { ...editRemoteFavForm }]
                          updated[idx] = { ...updated[idx], favoriteFolders: favs }
                          saveRemoteHosts(updated)
                          setAddRemoteFavMode(false)
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors duration-100"
                        style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)' }}
                      >
                        <Check size={10} />
                        Save
                      </button>
                    </div>
                  </div>
                ) : !addRemoteFavMode && (
                  <button
                    onClick={() => {
                      setAddRemoteFavMode(true)
                      setEditRemoteFavIdx(null)
                      setEditRemoteFavForm({ name: '', path: '', defaultBranch: 'main' })
                    }}
                    className="flex items-center justify-center gap-1 w-full py-1.5 rounded-md border border-dashed text-[10px] font-medium transition-colors duration-100 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    style={{ borderColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
                  >
                    <Plus size={10} />
                    Add Folder
                  </button>
                )}
              </div>
            )}
          </div>
        )
      )}

      {addRemoteMode ? (
        <div className="flex flex-col gap-2 p-3 rounded-lg border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)' }}>
          <input
            type="text"
            value={editRemoteForm.name}
            onChange={(e) => setEditRemoteForm({ ...editRemoteForm, name: e.target.value })}
            placeholder="Name (e.g. dev-server)"
            autoFocus
            className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
          />
          <input
            type="text"
            value={editRemoteForm.host}
            onChange={(e) => setEditRemoteForm({ ...editRemoteForm, host: e.target.value })}
            placeholder="SSH host (e.g. user@192.168.1.100)"
            className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
          />
          <input
            type="text"
            value={editRemoteForm.shell}
            onChange={(e) => setEditRemoteForm({ ...editRemoteForm, shell: e.target.value })}
            placeholder="Shell (default: /bin/bash)"
            className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setAddRemoteMode(false)}
              className="px-2.5 py-1 rounded-md text-[11px] transition-colors duration-100"
              style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!editRemoteForm.name.trim() || !editRemoteForm.host.trim()) return
                const updated = [...remoteHosts, { name: editRemoteForm.name.trim(), host: editRemoteForm.host.trim(), shell: editRemoteForm.shell.trim() || undefined, favoriteFolders: [] }]
                saveRemoteHosts(updated)
                setAddRemoteMode(false)
                setEditRemoteForm({ name: '', host: '', shell: '' })
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-100"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)' }}
            >
              <Check size={11} />
              Save
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => {
            setAddRemoteMode(true)
            setEditRemoteIdx(null)
            setEditRemoteForm({ name: '', host: '', shell: '' })
          }}
          className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-lg border border-dashed text-[11px] font-medium transition-colors duration-100 hover:border-[var(--accent)] hover:text-[var(--accent)]"
          style={{ borderColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
        >
          <Plus size={12} />
          Add Remote Host
        </button>
      )}
    </div>
  )
}
