import { useRef, useCallback } from 'react'

const HANDLE_R = 10
const SNAP_DEG = 5

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

  const R_outer = radius
  const R_inner = radius * 0.88  // 눈금 띠 안쪽

  const ticks = Array.from({ length: 181 }, (_, i) => i)
  const radialLines = [10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170]

  // SVG는 Y가 아래로 증가 → 반원 위쪽은 cy - r*sin(θ)
  // tickRad: i=0 → left(π), i=90 → top(π/2), i=180 → right(0)
  const aX = (r, tickRad) => cx + r * Math.cos(tickRad)
  const aY = (r, tickRad) => cy - r * Math.sin(tickRad)  // ← 핵심: 마이너스

  const labelDegrees = [0,10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180]

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full tool-overlay"
      style={{ touchAction: 'none', pointerEvents: 'none', zIndex: 20 }}
    >
      <g
        transform={`rotate(${degAngle}, ${cx}, ${cy})`}
        style={{ pointerEvents: 'all', cursor: 'grab' }}
        onMouseDown={onPointerDown('center')}
        onTouchStart={onPointerDown('center')}
      >
        {/* 반원 내부 채우기 (호=위쪽, 직선=아래 기준선) */}
        <path
          d={`M ${cx - R_outer} ${cy} A ${R_outer} ${R_outer} 0 0 1 ${cx + R_outer} ${cy} Z`}
          fill="rgba(245, 245, 245, 0.75)"
          stroke="none"
        />

        {/* 눈금 띠 (바깥호 + 안쪽호 사이 흰 띠) */}
        <path
          d={`M ${cx - R_outer} ${cy} A ${R_outer} ${R_outer} 0 0 1 ${cx + R_outer} ${cy}
              L ${cx + R_inner} ${cy} A ${R_inner} ${R_inner} 0 0 0 ${cx - R_inner} ${cy} Z`}
          fill="white"
          stroke="#444"
          strokeWidth="1"
        />

        {/* 10도 단위 방사선 (중심 → R_inner) */}
        {radialLines.map((deg) => {
          const tickRad = Math.PI - (deg * Math.PI) / 180
          return (
            <line key={deg}
              x1={cx} y1={cy}
              x2={aX(R_inner, tickRad)} y2={aY(R_inner, tickRad)}
              stroke="#bbb" strokeWidth="0.7" opacity="0.7"
            />
          )
        })}

        {/* 기준 지름 수평선 */}
        <line x1={cx - R_inner} y1={cy} x2={cx + R_inner} y2={cy}
          stroke="#bbb" strokeWidth="0.7" opacity="0.7"
        />

        {/* 눈금 (바깥에서 안쪽으로) */}
        {ticks.map((i) => {
          const tickRad = Math.PI - (i * Math.PI) / 180
          const is10 = i % 10 === 0
          const is5  = i % 5 === 0
          const tickLen = is10 ? R_outer * 0.09 : is5 ? R_outer * 0.06 : R_outer * 0.03
          return (
            <line key={i}
              x1={aX(R_outer, tickRad)}          y1={aY(R_outer, tickRad)}
              x2={aX(R_outer - tickLen, tickRad)} y2={aY(R_outer - tickLen, tickRad)}
              stroke="#444"
              strokeWidth={is10 ? 1.5 : is5 ? 1 : 0.6}
            />
          )
        })}

        {/* 바깥쪽 숫자 (오른쪽=0°, 왼쪽=180°) */}
        {labelDegrees.map((deg) => {
          const tickRad = Math.PI - (deg * Math.PI) / 180
          const lx = aX(R_outer - R_outer * 0.065, tickRad)
          const ly = aY(R_outer - R_outer * 0.065, tickRad)
          // 반지름 방향으로 세워서 읽히도록 회전
          const rotDeg = deg - 90
          return (
            <text key={`out-${deg}`} x={lx} y={ly}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={R_outer * 0.058}
              fill="#222"
              transform={`rotate(${rotDeg}, ${lx}, ${ly})`}
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {deg}
            </text>
          )
        })}

        {/* 안쪽 숫자 (반대 방향 스케일: 오른쪽=180°, 왼쪽=0°) */}
        {labelDegrees.map((deg) => {
          const innerDeg = 180 - deg
          const tickRad = Math.PI - (deg * Math.PI) / 180
          const lx = aX(R_outer - R_outer * 0.165, tickRad)
          const ly = aY(R_outer - R_outer * 0.165, tickRad)
          const rotDeg = deg - 90
          return (
            <text key={`in-${deg}`} x={lx} y={ly}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={R_outer * 0.052}
              fill="#555"
              transform={`rotate(${rotDeg}, ${lx}, ${ly})`}
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {innerDeg}
            </text>
          )
        })}

        {/* 내측 반원 테두리 */}
        <path
          d={`M ${cx - R_inner} ${cy} A ${R_inner} ${R_inner} 0 0 1 ${cx + R_inner} ${cy}`}
          fill="none" stroke="#444" strokeWidth="1"
        />

        {/* 중앙 수직선 (90° 기준선) */}
        <line x1={cx} y1={cy - R_inner} x2={cx} y2={cy}
          stroke="#555" strokeWidth="0.8"
        />

        {/* 중앙 기준점 원 */}
        <circle cx={cx} cy={cy} r={radius * 0.025} fill="none" stroke="#444" strokeWidth="1.2" />
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
