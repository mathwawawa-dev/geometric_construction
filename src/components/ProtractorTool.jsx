import { useRef, useCallback } from 'react'

const HANDLE_R = 10

export default function ProtractorTool({ protractor, setProtractor }) {
  const svgRef = useRef(null)
  const dragging = useRef(null) // 'center' | 'rotate' | 'resize'
  const dragOffset = useRef({ dx: 0, dy: 0 })

  const { cx, cy, radius, angle } = protractor

  const getSVGPos = (e) => {
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }

  const onPointerDown = useCallback((part) => (e) => {
    e.stopPropagation()
    e.preventDefault()
    dragging.current = part
    const pos = getSVGPos(e)
    
    if (part === 'center') {
      dragOffset.current = { dx: pos.x - cx, dy: pos.y - cy }
    } else {
      dragOffset.current = { dx: 0, dy: 0 }
    }

    const onMove = (me) => {
      me.preventDefault()
      const p = getSVGPos(me)
      if (dragging.current === 'center') {
        const nx = p.x - dragOffset.current.dx
        const ny = p.y - dragOffset.current.dy
        setProtractor({ cx: nx, cy: ny })
      } else if (dragging.current === 'resize') {
        const nr = Math.hypot(p.x - cx, p.y - cy)
        setProtractor({ radius: Math.max(50, nr) })
      } else if (dragging.current === 'rotate') {
        let a = Math.atan2(p.y - cy, p.x - cx)
        setProtractor({ angle: a })
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
  }, [cx, cy, radius, angle, setProtractor])

  const degAngle = angle * (180 / Math.PI)

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full tool-overlay"
      style={{ touchAction: 'none', pointerEvents: 'none' }}
    >
      {/* 각도기 반원 몸통 */}
      <g
        transform={`rotate(${degAngle}, ${cx}, ${cy})`}
        style={{ pointerEvents: 'all', cursor: 'grab' }}
        onMouseDown={onPointerDown('center')}
        onTouchStart={onPointerDown('center')}
      >
        <path
          d={`M ${cx - radius} ${cy} 
              A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy} 
              Z`}
          fill="rgba(254, 240, 138, 0.4)"
          stroke="#ca8a04"
          strokeWidth="2"
        />
        {/* 눈금선들 */}
        {Array.from({ length: 19 }).map((_, i) => {
          const tickAngle = Math.PI + (i * Math.PI) / 18
          const isMajor = i % 2 === 0
          const r1 = radius
          const r2 = isMajor ? radius - 15 : radius - 8
          const x1 = cx + r1 * Math.cos(tickAngle)
          const y1 = cy + r1 * Math.sin(tickAngle)
          const x2 = cx + r2 * Math.cos(tickAngle)
          const y2 = cy + r2 * Math.sin(tickAngle)
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ca8a04" strokeWidth="1.5" />
          )
        })}
        {/* 중앙 표시 */}
        <line x1={cx} y1={cy - 10} x2={cx} y2={cy + 10} stroke="#ca8a04" strokeWidth="2" />
        <line x1={cx - 10} y1={cy} x2={cx + 10} y2={cy} stroke="#ca8a04" strokeWidth="2" />
      </g>

      {/* 회전 핸들 (0도 방향 끝부분) */}
      <circle
        cx={cx + radius * Math.cos(angle)}
        cy={cy + radius * Math.sin(angle)}
        r={HANDLE_R}
        fill="#eab308" stroke="white" strokeWidth="2"
        style={{ pointerEvents: 'all', cursor: 'crosshair' }}
        onMouseDown={onPointerDown('rotate')}
        onTouchStart={onPointerDown('rotate')}
      />

      {/* 크기 조절 핸들 (90도 방향 끝부분) */}
      <circle
        cx={cx + radius * Math.cos(angle - Math.PI / 2)}
        cy={cy + radius * Math.sin(angle - Math.PI / 2)}
        r={HANDLE_R}
        fill="#22c55e" stroke="white" strokeWidth="2"
        style={{ pointerEvents: 'all', cursor: 'nwse-resize' }}
        onMouseDown={onPointerDown('resize')}
        onTouchStart={onPointerDown('resize')}
      />
    </svg>
  )
}
