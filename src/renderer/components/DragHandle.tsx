import { useCallback, useRef } from 'react'
import type { SplitDirection } from '../../shared/types'

interface DragHandleProps {
  direction: SplitDirection
  containerRef: React.RefObject<HTMLDivElement | null>
  onRatioChange: (ratio: number) => void
  onDragEnd: () => void
}

export default function DragHandle({
  direction,
  containerRef,
  onRatioChange,
  onDragEnd
}: DragHandleProps): React.JSX.Element {
  const dragging = useRef(false)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragging.current = true

      const container = containerRef.current
      if (!container) return

      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'

      // Disable pointer events on all terminals during drag
      const terminals = document.querySelectorAll<HTMLElement>('.xterm-container')
      terminals.forEach((el) => { el.style.pointerEvents = 'none' })

      const handleMouseMove = (ev: MouseEvent): void => {
        if (!dragging.current || !container) return
        const rect = container.getBoundingClientRect()
        let ratio: number
        if (direction === 'horizontal') {
          ratio = (ev.clientX - rect.left) / rect.width
        } else {
          ratio = (ev.clientY - rect.top) / rect.height
        }
        onRatioChange(ratio)
      }

      const handleMouseUp = (): void => {
        dragging.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        terminals.forEach((el) => { el.style.pointerEvents = '' })
        onDragEnd()
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [direction, containerRef, onRatioChange, onDragEnd]
  )

  return (
    <div
      className={`split-drag-handle ${direction === 'horizontal' ? 'split-drag-handle-h' : 'split-drag-handle-v'}`}
      onMouseDown={handleMouseDown}
    />
  )
}
