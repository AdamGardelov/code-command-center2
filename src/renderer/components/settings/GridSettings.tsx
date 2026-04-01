import { useSessionStore } from '../../stores/session-store'
import {
  DEFAULT_GRID_PRESETS,
  GRID_PRESET_OPTIONS,
  GRID_PRESET_LABELS,
} from '../../lib/split-tree'

/** Miniature layout thumbnails rendered as nested flex divs */
function PresetThumbnail({ presetId }: { presetId: string }): React.JSX.Element {
  const layout = PRESET_LAYOUTS[presetId]
  if (!layout) return <div />

  return (
    <div className="w-full h-full flex gap-[2px]" style={{ flexDirection: layout.dir === 'v' ? 'column' : 'row' }}>
      {layout.rows.map((row, i) => (
        <div key={i} className="flex gap-[2px] flex-1 min-h-0 min-w-0" style={{ flexDirection: row.dir === 'h' ? 'row' : 'column' }}>
          {Array.from({ length: row.count }).map((_, j) => (
            <div key={j} className="flex-1 rounded-[2px] min-h-0 min-w-0" style={{ backgroundColor: 'var(--bg-raised)' }} />
          ))}
        </div>
      ))}
    </div>
  )
}

interface RowDef {
  count: number
  dir: 'h' | 'v'
}

interface LayoutDef {
  dir: 'v' | 'h'
  rows: RowDef[]
}

const PRESET_LAYOUTS: Record<string, LayoutDef> = {
  'side-by-side': { dir: 'h', rows: [{ count: 1, dir: 'h' }, { count: 1, dir: 'h' }] },
  'stacked': { dir: 'v', rows: [{ count: 1, dir: 'h' }, { count: 1, dir: 'h' }] },
  '2top-1bottom': { dir: 'v', rows: [{ count: 2, dir: 'h' }, { count: 1, dir: 'h' }] },
  '1top-2bottom': { dir: 'v', rows: [{ count: 1, dir: 'h' }, { count: 2, dir: 'h' }] },
  '1left-2right': { dir: 'h', rows: [{ count: 1, dir: 'v' }, { count: 2, dir: 'v' }] },
  '2left-1right': { dir: 'h', rows: [{ count: 2, dir: 'v' }, { count: 1, dir: 'v' }] },
  '3cols': { dir: 'h', rows: [{ count: 1, dir: 'h' }, { count: 1, dir: 'h' }, { count: 1, dir: 'h' }] },
  '2x2': { dir: 'v', rows: [{ count: 2, dir: 'h' }, { count: 2, dir: 'h' }] },
  '3top-1bottom': { dir: 'v', rows: [{ count: 3, dir: 'h' }, { count: 1, dir: 'h' }] },
  '1top-3bottom': { dir: 'v', rows: [{ count: 1, dir: 'h' }, { count: 3, dir: 'h' }] },
  '4cols': { dir: 'h', rows: [{ count: 1, dir: 'h' }, { count: 1, dir: 'h' }, { count: 1, dir: 'h' }, { count: 1, dir: 'h' }] },
  '3top-2bottom': { dir: 'v', rows: [{ count: 3, dir: 'h' }, { count: 2, dir: 'h' }] },
  '2top-3bottom': { dir: 'v', rows: [{ count: 2, dir: 'h' }, { count: 3, dir: 'h' }] },
  '3x2': { dir: 'v', rows: [{ count: 3, dir: 'h' }, { count: 3, dir: 'h' }] },
  '2x3': { dir: 'h', rows: [{ count: 3, dir: 'v' }, { count: 3, dir: 'v' }] },
  '3top-4bottom': { dir: 'v', rows: [{ count: 3, dir: 'h' }, { count: 4, dir: 'h' }] },
  '4top-3bottom': { dir: 'v', rows: [{ count: 4, dir: 'h' }, { count: 3, dir: 'h' }] },
  '4x2': { dir: 'v', rows: [{ count: 4, dir: 'h' }, { count: 4, dir: 'h' }] },
  '3-3-2': { dir: 'v', rows: [{ count: 3, dir: 'h' }, { count: 3, dir: 'h' }, { count: 2, dir: 'h' }] },
}

export default function GridSettings(): React.JSX.Element {
  const gridPresets = useSessionStore((s) => s.gridPresets)
  const setGridPresets = useSessionStore((s) => s.setGridPresets)
  const resetGridLayout = useSessionStore((s) => s.resetGridLayout)

  const getActivePreset = (count: number): string => {
    return gridPresets[String(count)] ?? DEFAULT_GRID_PRESETS[String(count)] ?? ''
  }

  const selectPreset = (count: number, presetId: string): void => {
    const updated = { ...DEFAULT_GRID_PRESETS, ...gridPresets, [String(count)]: presetId }
    setGridPresets(updated)
    // Reset current grid so it rebuilds with new preset
    resetGridLayout()
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
        Choose the default layout for each session count. Drag-resizing in the grid overrides these defaults until you reset.
      </p>
      {[2, 3, 4, 5, 6, 7, 8].map((count) => {
        const options = GRID_PRESET_OPTIONS[count] ?? []
        const active = getActivePreset(count)
        return (
          <div key={count}>
            <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              {count} Sessions
            </div>
            <div className="flex gap-2 flex-wrap">
              {options.map((presetId) => {
                const isActive = active === presetId
                return (
                  <button
                    key={presetId}
                    onClick={() => selectPreset(count, presetId)}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div
                      className="w-[80px] h-[52px] rounded-md border-2 p-1.5 transition-colors duration-100"
                      style={{
                        borderColor: isActive ? 'var(--accent)' : 'var(--bg-raised)',
                        backgroundColor: 'var(--bg-primary)',
                      }}
                    >
                      <PresetThumbnail presetId={presetId} />
                    </div>
                    <span
                      className="text-[9px]"
                      style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
                    >
                      {GRID_PRESET_LABELS[presetId] ?? presetId}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
