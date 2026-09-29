import { useRef, useCallback } from 'react'

const HANDLE_R = 10
const RULER_THICKNESS = 60 // 자의 두께

export default function RulerTool({ ruler, setRuler, canvasRef, strokeColor, strokeWidth, onDraw, isInteractive }) {
  const svgRef = useRef(null)
  const dragging = useRef(null)
  const dragOffset = useRef({ dx: 0, dy: 0 })

  const { x1, y1, x2, y2 } = ruler

  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI)
  const length = Math.hypot(x2 - x1, y2 - y1)

  const pointerStyle = isInteractive ? 'all' : 'none'
  const grabCursor = isInteractive ? 'grab' : 'default'
  const resizeCursor = isInteractive ? 'nwse-resize' : 'default'

  const getSVGPos = (e) => {
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    // svg 요소 자체의 clientRect 안에서의 상대 좌표 반환 (1:1 매핑)
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }

  const onPointerDown = useCallback((part) => (e) => {
    if (!isInteractive) return
    e.stopPropagation()
    e.preventDefault()
    dragging.current = part
    const pos = getSVGPos(e)

    if (part === 'whole') {
      dragOffset.current = { dx: pos.x - cx, dy: pos.y - cy }
    }

    const onMove = (me) => {
      me.preventDefault()
      const p = getSVGPos(me)
      if (dragging.current === 'p1') {
        setRuler({ x1: p.x, y1: p.y })
      } else if (dragging.current === 'p2') {
        setRuler({ x2: p.x, y2: p.y })
      } else if (dragging.current === 'whole') {
        const dx = x2 - x1
        const dy = y2 - y1
        const nx = p.x - dragOffset.current.dx
        const ny = p.y - dragOffset.current.dy
        setRuler({ x1: nx - dx / 2, y1: ny - dy / 2, x2: nx + dx / 2, y2: ny + dy / 2 })
      }
    }
    const onUp = () => {
      dragging.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
  }, [x1, y1, x2, y2, cx, cy, setRuler, isInteractive])

  const drawLine = useCallback(() => {
    if (!isInteractive) return
    const canvas = canvasRef.current
    if (!canvas) return
    onDraw?.()
    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = strokeWidth
    ctx.lineCap = 'round'
    ctx.stroke()
  }, [canvasRef, x1, y1, x2, y2, strokeColor, strokeWidth, onDraw, isInteractive])

  return (
    <>
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: 'none', pointerEvents: 'none' }}
      >
        <g
          transform={`rotate(${angle}, ${cx}, ${cy})`}
          style={{ pointerEvents: pointerStyle, cursor: grabCursor }}
          onMouseDown={onPointerDown('whole')}
          onTouchStart={onPointerDown('whole')}
        >
          <rect
            x={cx - length / 2}
            y={cy - RULER_THICKNESS / 2}
            width={length}
            height={RULER_THICKNESS}
            rx="4"
            fill="rgba(186, 230, 253, 0.45)"
            stroke="#0ea5e9"
            strokeWidth="1.5"
          />
        </g>
        <line
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="#0ea5e9" strokeWidth="1" strokeDasharray="4 4"
          style={{ pointerEvents: 'none' }}
        />
        <circle
          cx={x1} cy={y1} r={HANDLE_R}
          fill="#0ea5e9" stroke="white" strokeWidth="2"
          style={{ pointerEvents: pointerStyle, cursor: resizeCursor }}
          onMouseDown={onPointerDown('p1')}
          onTouchStart={onPointerDown('p1')}
        />
        <circle
          cx={x2} cy={y2} r={HANDLE_R}
          fill="#0ea5e9" stroke="white" strokeWidth="2"
          style={{ pointerEvents: pointerStyle, cursor: resizeCursor }}
          onMouseDown={onPointerDown('p2')}
          onTouchStart={onPointerDown('p2')}
        />
      </svg>

      {/* 자 컨트롤 패널 */}
      <div
        className="absolute bottom-4 right-4 bg-white rounded-xl shadow-lg border border-gray-200 p-3 flex flex-col gap-2 min-w-[160px]"
        style={{ zIndex: 20, pointerEvents: pointerStyle, opacity: isInteractive ? 1 : 0.5 }}
      >
        <p className="text-xs font-bold text-gray-600 mb-1">📏 눈금없는 자</p>
        <button
          onClick={drawLine}
          disabled={!isInteractive}
          className="bg-sky-500 hover:bg-sky-600 disabled:bg-gray-400 text-white text-sm py-1.5 rounded-lg font-semibold transition-colors"
        >
          선 그리기
        </button>
        <p className="text-[11px] text-gray-400 leading-tight">
          🔵 끝점 드래그: 회전/길이<br />
          자 몸통 드래그: 이동
        </p>
      </div>
    </>
  )
}
