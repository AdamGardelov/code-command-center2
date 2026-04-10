import { X } from 'lucide-react'

export interface PrToastState {
  type: 'loading' | 'error'
  message: string
  detail?: string
}

export default function PrToast({
  toast,
  onDismiss
}: {
  toast: PrToastState
  onDismiss: () => void
}): React.JSX.Element {
  const isError = toast.type === 'error'

  return (
    <div
      className="mx-2 mb-2 rounded-md px-3 py-2 flex items-center gap-2"
      style={{
        backgroundColor: isError ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.08)',
        border: `1px solid ${isError ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)'}`
      }}
    >
      {toast.type === 'loading' ? (
        <div
          className="w-3 h-3 flex-shrink-0 rounded-full"
          style={{
            border: '2px solid #4ade80',
            borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite'
          }}
        />
      ) : (
        <span className="flex-shrink-0 text-[13px]" style={{ color: '#f87171' }}>&#10007;</span>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] truncate" style={{ color: 'var(--text-primary)' }}>
          {toast.message}
        </div>
        {toast.detail && (
          <div className="text-[9px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
            {toast.detail}
          </div>
        )}
      </div>
      {isError && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-0.5 rounded hover:bg-[rgba(255,255,255,0.1)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={10} />
        </button>
      )}
    </div>
  )
}
