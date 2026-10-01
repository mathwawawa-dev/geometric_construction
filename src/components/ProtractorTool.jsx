import { useRef, useCallback } from 'react'

const HANDLE_R = 10
const SNAP_DEG = 5 // 5도 단위 snap

function snapAngle(a) {
  const deg = a * (180 / Math.PI)
  const snapped = Math.round(deg / SNAP_DEG) * SNAP_DEG
  return snapped * (Math.PI / 180)
}

export default function ProtractorTool({ protractor, setProtractor, onInteractionEnd }) {
  const svgRef = useRef(null)
  const dragging = useRef(null)
  const dragOffset = useRef({ dx: 0, dy: 0 })

  const { cx, cy, radius, angle } = protractor

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
        setProtractor({ cx: p.x - dragOffset.current.dx, cy: p.y - dragOffset.current.dy })
      } else if (dragging.current === 'resize') {
        const nr = Math.hypot(p.x - cx, p.y - cy)
        setProtractor({ radius: Math.max(60, nr) })
      } else if (dragging.current === 'rotate') {
        const a = snapAngle(Math.atan2(p.y - cy, p.x - cx))
        setProtractor({ angle: a })
      }
    }
    const onUp = () => {
      if (dragging.current) onInteractionEnd?.()
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
  }, [cx, cy, radius, angle, setProtractor, onInteractionEnd])

  const degAngle = angle * (180 / Math.PI)

  // 눈금 (0~180도, 1도 단위)
  const ticks = Array.from({ length: 181 }, (_, i) => i)

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full tool-overlay"
      style={{ touchAction: 'none', pointerEvents: 'none', zIndex: 20 }}
    >
      {/* 각도기 몸통 그룹 */}
      <g
        transform={`rotate(${degAngle}, ${cx}, ${cy})`}
        style={{ pointerEvents: 'all', cursor: 'grab' }}
        onMouseDown={onPointerDown('center')}
        onTouchStart={onPointerDown('center')}
      >
        {/* 반원 채우기 */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy} Z`}
          fill="rgba(254, 240, 138, 0.35)"
          stroke="#ca8a04"
          strokeWidth="2"
        />

        {/* 기준 가로선 */}
        <line x1={cx - radius} y1={cy} x2={cx + radius} y2={cy}
          stroke="#ca8a04" strokeWidth="1" strokeDasharray="4 3" opacity="0.5"
        />

        {/* 눈금 (1도 단위) */}
        {ticks.map((i) => {
          // 각도기 좌측(180°) → 우측(0°) 방향 배치
          const tickRad = Math.PI - (i * Math.PI) / 180
          const is10 = i % 10 === 0
          const is5  = i % 5 === 0
          const tickLen = is10 ? 18 : is5 ? 12 : 7
          const x1 = cx + radius * Math.cos(tickRad)
          const y1 = cy + radius * Math.sin(tickRad)
          const x2 = cx + (radius - tickLen) * Math.cos(tickRad)
          const y2 = cy + (radius - tickLen) * Math.sin(tickRad)
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#92400e"
              strokeWidth={is10 ? 1.8 : is5 ? 1.2 : 0.7}
            />
          )
        })}

        {/* 숫자 레이블 (10도 단위) */}
        {[0,10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180].map((deg) => {
          const tickRad = Math.PI - (deg * Math.PI) / 180
          const labelR = radius - 26
          const lx = cx + labelR * Math.cos(tickRad)
          const ly = cy + labelR * Math.sin(tickRad)
          return (
            <text key={deg} x={lx} y={ly}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={deg % 30 === 0 ? 11 : 9}
              fontWeight={deg % 30 === 0 ? 'bold' : 'normal'}
              fill="#92400e"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {deg}
            </text>
          )
        })}

        {/* 중앙 십자 */}
        <line x1={cx} y1={cy - 12} x2={cx} y2={cy + 6} stroke="#ca8a04" strokeWidth="2" />
        <line x1={cx - 12} y1={cy} x2={cx + 12} y2={cy} stroke="#ca8a04" strokeWidth="2" />
        <circle cx={cx} cy={cy} r="4" fill="#ca8a04" />
      </g>

      {/* 회전 핸들 */}
      <circle
        cx={cx + radius * Math.cos(angle)}
        cy={cy + radius * Math.sin(angle)}
        r={HANDLE_R}
        fill="#eab308" stroke="white" strokeWidth="2"
        style={{ pointerEvents: 'all', cursor: 'crosshair' }}
        onMouseDown={onPointerDown('rotate')}
        onTouchStart={onPointerDown('rotate')}
      />

      {/* 크기 조절 핸들 */}
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
