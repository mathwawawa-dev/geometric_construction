import { useRef, useCallback, useEffect } from 'react'

const HANDLE_R = 6
const RULER_THICKNESS = 120 // 자의 두께 (2배 증가)

export default function RulerTool({ ruler, setRuler, canvasRef, strokeColor, strokeWidth, onDraw, onInteractionEnd }) {
  const svgRef = useRef(null)
  const dragging = useRef(null)
  const dragOffset = useRef({ dx: 0, dy: 0 })

  useEffect(() => {
    return () => document.body.classList.remove('is-tool-dragging')
  }, [])

  const { x1, y1, x2, y2 } = ruler

  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI)
  const length = Math.hypot(x2 - x1, y2 - y1)

  const getSVGPos = (e) => {
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const scaleX = svg.clientWidth / rect.width || 1
    const scaleY = svg.clientHeight / rect.height || 1
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  const onPointerDown = useCallback((part) => (e) => {
    e.stopPropagation()
    e.preventDefault()
    dragging.current = part
    document.body.classList.add('is-tool-dragging')
    const pos = getSVGPos(e)

    const angleRad = Math.atan2(y2 - y1, x2 - x1)
    const H1_orig = {
      x: x1 + (RULER_THICKNESS / 2) * Math.sin(angleRad),
      y: y1 - (RULER_THICKNESS / 2) * Math.cos(angleRad)
    }
    const H2_orig = {
      x: x2 + (RULER_THICKNESS / 2) * Math.sin(angleRad),
      y: y2 - (RULER_THICKNESS / 2) * Math.cos(angleRad)
    }

    if (part === 'whole') {
      dragOffset.current = { dx: pos.x - cx, dy: pos.y - cy }
    } else if (part === 'p1') {
      dragOffset.current = { dx: pos.x - H1_orig.x, dy: pos.y - H1_orig.y, H2: H2_orig }
    } else if (part === 'p2') {
      dragOffset.current = { dx: pos.x - H2_orig.x, dy: pos.y - H2_orig.y, H1: H1_orig }
    }

    const onMove = (me) => {
      me.preventDefault()
      const p = getSVGPos(me)
      const isShift = me.shiftKey

      if (dragging.current === 'p1') {
        const targetX = p.x - dragOffset.current.dx
        const targetY = p.y - dragOffset.current.dy
        const H2 = dragOffset.current.H2

        let currentAngle = Math.atan2(H2.y - targetY, H2.x - targetX)
        if (isShift) {
          currentAngle = Math.round((currentAngle * 180 / Math.PI) / 5) * 5 * (Math.PI / 180)
        }
        const dist = Math.hypot(targetX - H2.x, targetY - H2.y)
        const newH1 = {
          x: H2.x - dist * Math.cos(currentAngle),
          y: H2.y - dist * Math.sin(currentAngle)
        }
        const offsetX = - (RULER_THICKNESS / 2) * Math.sin(currentAngle)
        const offsetY = (RULER_THICKNESS / 2) * Math.cos(currentAngle)
        setRuler({
          x1: newH1.x + offsetX, y1: newH1.y + offsetY,
          x2: H2.x + offsetX, y2: H2.y + offsetY
        })
      } else if (dragging.current === 'p2') {
        const targetX = p.x - dragOffset.current.dx
        const targetY = p.y - dragOffset.current.dy
        const H1 = dragOffset.current.H1

        let currentAngle = Math.atan2(targetY - H1.y, targetX - H1.x)
        if (isShift) {
          currentAngle = Math.round((currentAngle * 180 / Math.PI) / 5) * 5 * (Math.PI / 180)
        }
        const dist = Math.hypot(targetX - H1.x, targetY - H1.y)
        const newH2 = {
          x: H1.x + dist * Math.cos(currentAngle),
          y: H1.y + dist * Math.sin(currentAngle)
        }
        const offsetX = - (RULER_THICKNESS / 2) * Math.sin(currentAngle)
        const offsetY = (RULER_THICKNESS / 2) * Math.cos(currentAngle)
        setRuler({
          x1: H1.x + offsetX, y1: H1.y + offsetY,
          x2: newH2.x + offsetX, y2: newH2.y + offsetY
        })
      } else if (dragging.current === 'whole') {
        const dx = x2 - x1
        const dy = y2 - y1
        const nx = p.x - dragOffset.current.dx
        const ny = p.y - dragOffset.current.dy
        setRuler({ x1: nx - dx / 2, y1: ny - dy / 2, x2: nx + dx / 2, y2: ny + dy / 2 })
      }
    }
    const onUp = () => {
      if (dragging.current) onInteractionEnd?.()
      dragging.current = null
      document.body.classList.remove('is-tool-dragging')
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
  }, [x1, y1, x2, y2, cx, cy, setRuler])

  const drawLine = useCallback(() => {
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
  }, [canvasRef, x1, y1, x2, y2, strokeColor, strokeWidth, onDraw])

  return (
    <>
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full tool-overlay"
        style={{ touchAction: 'none', pointerEvents: 'none', zIndex: 20 }}
      >
        <g transform={`rotate(${angle}, ${cx}, ${cy})`}>
          {/* 눈에 보이는 자 배경 (마우스 이벤트 무시) */}
          <rect
            x={cx - length / 2}
            y={cy - RULER_THICKNESS / 2}
            width={length}
            height={RULER_THICKNESS}
            rx="4"
            fill="rgba(186, 230, 253, 0.2)"
            stroke="rgba(14, 165, 233, 0.15)"
            strokeWidth="1.5"
            style={{ pointerEvents: 'none' }}
          />
          {/* 실제 드래그 가능한 투명 영역 (자 전체 두께) */}
          <rect
            x={cx - length / 2 + 15}
            y={cy - RULER_THICKNESS / 2}
            width={Math.max(0, length - 30)}
            height={RULER_THICKNESS}
            fill="transparent"
            style={{ pointerEvents: 'all', cursor: 'grab' }}
            onMouseDown={onPointerDown('whole')}
            onTouchStart={onPointerDown('whole')}
          />
          {/* 양쪽 원 (상단 핸들) */}
          <circle
            cx={cx - length / 2} cy={cy - RULER_THICKNESS / 2} r={HANDLE_R}
            fill="#0ea5e9" stroke="white" strokeWidth="2"
            style={{ pointerEvents: 'all', cursor: 'nwse-resize' }}
            onMouseDown={onPointerDown('p1')}
            onTouchStart={onPointerDown('p1')}
          />
          <circle
            cx={cx + length / 2} cy={cy - RULER_THICKNESS / 2} r={HANDLE_R}
            fill="#0ea5e9" stroke="white" strokeWidth="2"
            style={{ pointerEvents: 'all', cursor: 'nwse-resize' }}
            onMouseDown={onPointerDown('p2')}
            onTouchStart={onPointerDown('p2')}
          />
        </g>
      </svg>

      {/* 자 컨트롤 패널 */}
      <div
        className="absolute bottom-4 right-4 bg-white rounded-xl shadow-lg border border-gray-200 p-3 flex flex-col gap-2 min-w-[160px]"
        style={{ zIndex: 20 }}
      >
        <p className="text-xs font-bold text-gray-600 mb-1">📏 눈금없는 자</p>
        <button
          onClick={drawLine}
          className="bg-sky-500 hover:bg-sky-600 text-white text-sm py-1.5 rounded-lg font-semibold transition-colors"
        >
          선 그리기
        </button>
        <p className="text-[11px] text-gray-400 leading-tight">
          🔹 끝점 드래그: 회전/길이<br />
          (Shift 누르고 회전 시 5도 스냅)<br />
          🔹 중앙 드래그: 자 이동
        </p>
      </div>
    </>
  )
}
