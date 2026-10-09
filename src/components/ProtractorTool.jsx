import { useRef, useCallback } from 'react'

const HANDLE_R = 10
const SNAP_DEG = 5

function snapAngle(a, step = 1) {
  const deg = a * (180 / Math.PI)
  const snapped = Math.round(deg / step) * step
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

  const startAngleRef = useRef(0)
  const startMouseAngleRef = useRef(0)

  const onPointerDown = useCallback((part) => (e) => {
    e.stopPropagation()
    e.preventDefault()
    dragging.current = part
    const pos = getSVGPos(e)

    if (part === 'center') {
      dragOffset.current = { dx: pos.x - cx, dy: pos.y - cy }
    } else if (part === 'rotate') {
      startAngleRef.current = angle
      startMouseAngleRef.current = Math.atan2(pos.y - cy, pos.x - cx)
      dragOffset.current = { dx: 0, dy: 0 }
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
        if (me.shiftKey) {
          // 절대 각도 5의 배수 스냅 (5°, 10°, 15° ...)
          const currentAngle = Math.atan2(p.y - cy, p.x - cx)
          const deg = currentAngle * (180 / Math.PI)
          const snappedDeg = Math.round(deg / 5) * 5
          setProtractor({ angle: snappedDeg * (Math.PI / 180) })
        } else {
          // 시작 각도 기준 상대 회전 (기본 1°, Ctrl 누르면 5° 단위)
          const currentMouseAngle = Math.atan2(p.y - cy, p.x - cx)
          let delta = currentMouseAngle - startMouseAngleRef.current
          while (delta > Math.PI) delta -= 2 * Math.PI
          while (delta < -Math.PI) delta += 2 * Math.PI

          const deltaDeg = delta * (180 / Math.PI)
          const step = me.ctrlKey ? 5 : 1
          const snappedDeltaDeg = Math.round(deltaDeg / step) * step
          const newAngle = startAngleRef.current + snappedDeltaDeg * (Math.PI / 180)
          setProtractor({ angle: newAngle })
        }
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

  const R_inner = radius * 0.68       // 안쪽 큰 호선
  const R_in_label = radius * 0.71    // 안쪽 숫자
  const R_out_label = radius * 0.767  // 바깥쪽 숫자 (안쪽으로 극미량 이동)
  const R_tick_1deg = radius * 0.84   // 작은 눈금(1°)의 끝에 위치하는 호선
  const R_outer = radius * 0.885      // 가장 바깥쪽 눈금 끝
  const R_hub = radius * 0.16         // 사진의 중심 반원 허브

  const ticks = Array.from({ length: 181 }, (_, i) => i)
  const radialLines = [10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170]

  // SVG는 Y가 아래로 증가 → 반원 위쪽은 cy - r*sin(θ)
  // tickRad: i=0 → left(π), i=90 → top(π/2), i=180 → right(0)
  const aX = (r, tickRad) => cx + r * Math.cos(tickRad)
  const aY = (r, tickRad) => cy - r * Math.sin(tickRad)

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
        {/* 반원 외곽 투명 채우기 (마우스 드래그/이동 이벤트 수신용) & 테두리 호선 (0/180도 숫자 구간은 바닥선을 그리지 않음) */}
        {/* 마우스 인터랙션을 위한 완전 투명 반원 */}
        <path
          d={`M ${cx - R_outer} ${cy} A ${R_outer} ${R_outer} 0 0 1 ${cx + R_outer} ${cy} Z`}
          fill="rgba(255, 255, 255, 0.001)"
          stroke="none"
        />
        {/* 반원 외곽 호 (상단 반원 호만 긋고 바닥 기준선은 제외) */}
        <path
          d={`M ${cx - R_outer} ${cy} A ${R_outer} ${R_outer} 0 0 1 ${cx + R_outer} ${cy}`}
          fill="none"
          stroke="#333"
          strokeWidth="1.2"
        />

        {/* 작은 눈금(1°)의 끝을 받쳐주는 호선 */}
        <path
          d={`M ${cx - R_tick_1deg} ${cy} A ${R_tick_1deg} ${R_tick_1deg} 0 0 1 ${cx + R_tick_1deg} ${cy}`}
          fill="none"
          stroke="#333"
          strokeWidth="1"
        />

        {/* 숫자 아래 안쪽 큰 호선 (선2, R_inner) */}
        <path
          d={`M ${cx - R_inner} ${cy} A ${R_inner} ${R_inner} 0 0 1 ${cx + R_inner} ${cy}`}
          fill="none"
          stroke="#333"
          strokeWidth="1.2"
        />

        {/* 중심 반원 허브 (R_hub) */}
        <path
          d={`M ${cx - R_hub} ${cy} A ${R_hub} ${R_hub} 0 0 1 ${cx + R_hub} ${cy} Z`}
          fill="rgba(255, 255, 255, 0.6)"
          stroke="#333"
          strokeWidth="1.2"
        />

        {/* 기준 지름 수평선: 0도/180도 숫자가 있는 바깥 구간(R_inner ~ R_outer)에는 선이 없고 안쪽(cx - R_inner ~ cx + R_inner)에만 표시 */}
        <line x1={cx - R_inner} y1={cy} x2={cx + R_inner} y2={cy}
          stroke="#333" strokeWidth="1.2"
        />

        {/* 10도 단위 방사선 (R_hub ~ R_inner) */}
        {radialLines.map((deg) => {
          const tickRad = Math.PI - (deg * Math.PI) / 180
          return (
            <line key={deg}
              x1={aX(R_hub, tickRad)} y1={aY(R_hub, tickRad)}
              x2={aX(R_inner, tickRad)} y2={aY(R_inner, tickRad)}
              stroke="#555" strokeWidth="1"
            />
          )
        })}

        {/* 중앙 90° 수직선 (중심부터 R_inner까지) */}
        <line x1={cx} y1={cy} x2={cx} y2={cy - R_inner}
          stroke="#333" strokeWidth="1.2"
        />

        {/* 눈금: 1°는 R_tick_1deg까지, 5°는 1.4배, 10°는 1.8배로 사진1처럼 단정하고 합리적인 길이 */}
        {ticks.map((i) => {
          const tickRad = Math.PI - (i * Math.PI) / 180
          const is10 = i % 10 === 0
          const is5  = i % 5 === 0
          const baseDepth = R_outer - R_tick_1deg
          const len = is10 ? baseDepth * 1.8 : is5 ? baseDepth * 1.4 : baseDepth
          return (
            <line key={i}
              x1={aX(R_outer, tickRad)}       y1={aY(R_outer, tickRad)}
              x2={aX(R_outer - len, tickRad)} y2={aY(R_outer - len, tickRad)}
              stroke="#222"
              strokeWidth={is10 ? 1.3 : is5 ? 0.9 : 0.6}
            />
          )
        })}

        {/* 바깥쪽 숫자: 180~0 (왼쪽=0°, 오른쪽=180°) */}
        {labelDegrees.map((deg) => {
          const outerDeg = 180 - deg
          const tickRad = Math.PI - (deg * Math.PI) / 180
          const lx = aX(R_out_label, tickRad)
          const ly = aY(R_out_label, tickRad)
          const rotDeg = deg - 90
          return (
            <text key={`out-${deg}`} x={lx} y={ly}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={Math.max(8, radius * 0.046)}
              fontWeight="600"
              fill="#111"
              transform={`rotate(${rotDeg}, ${lx}, ${ly})`}
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {outerDeg}
            </text>
          )
        })}

        {/* 안쪽 숫자: 0~180 (왼쪽=180°, 오른쪽=0°) */}
        {labelDegrees.map((deg) => {
          const tickRad = Math.PI - (deg * Math.PI) / 180
          const lx = aX(R_in_label, tickRad)
          const ly = aY(R_in_label, tickRad)
          const rotDeg = deg - 90
          return (
            <text key={`in-${deg}`} x={lx} y={ly}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={Math.max(7, radius * 0.04)}
              fontWeight="500"
              fill="#333"
              transform={`rotate(${rotDeg}, ${lx}, ${ly})`}
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {deg}
            </text>
          )
        })}
      </g>

      {/* 회전 핸들 — 곡선 양방향 화살표 아이콘 */}
      {(() => {
        const hx = cx + radius * Math.cos(angle)
        const hy = cy + radius * Math.sin(angle)
        const S = 24 // 아이콘 크기(px)
        return (
          <g
            transform={`translate(${hx - S / 2}, ${hy - S / 2})`}
            style={{ pointerEvents: 'all', cursor: 'crosshair' }}
            onMouseDown={onPointerDown('rotate')}
            onTouchStart={onPointerDown('rotate')}
          >
            {/* 배경 원 */}
            <circle cx={S/2} cy={S/2} r={S/2} fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5"/>
            {/* 곡선 양방향 화살표 아이콘 (viewBox 0 0 100 100 → S×S 스케일) */}
            <g transform={`scale(${S/100})`}>
              <defs>
                <marker id="rS" markerWidth="13" markerHeight="13"
                        refX="9" refY="6.5" orient="auto-start-reverse"
                        markerUnits="userSpaceOnUse">
                  <path d="M 2 2 L 11 6.5 L 2 11" fill="none" stroke="#854d0e" strokeWidth="2.2"
                        strokeLinecap="round" strokeLinejoin="round"/>
                </marker>
                <marker id="rE" markerWidth="13" markerHeight="13"
                        refX="9" refY="6.5" orient="auto"
                        markerUnits="userSpaceOnUse">
                  <path d="M 2 2 L 11 6.5 L 2 11" fill="none" stroke="#854d0e" strokeWidth="2.2"
                        strokeLinecap="round" strokeLinejoin="round"/>
                </marker>
              </defs>
              <path d="M 45 18 C 76 30, 76 70, 45 82"
                    fill="none" stroke="#854d0e" strokeWidth="7"
                    strokeLinecap="round"
                    markerStart="url(#rS)" markerEnd="url(#rE)"/>
            </g>
          </g>
        )
      })()}

      {/* 크기 조절 핸들 — 대각선 양방향 화살표 아이콘 */}
      {(() => {
        const hx = cx + radius * Math.cos(angle - Math.PI / 2)
        const hy = cy + radius * Math.sin(angle - Math.PI / 2)
        const S = 24
        return (
          <g
            transform={`translate(${hx - S / 2}, ${hy - S / 2})`}
            style={{ pointerEvents: 'all', cursor: 'nwse-resize' }}
            onMouseDown={onPointerDown('resize')}
            onTouchStart={onPointerDown('resize')}
          >
            {/* 배경 원 (viewBox 0 0 48 48 → S×S 스케일) */}
            <g transform={`scale(${S/48})`}>
              <circle cx="24" cy="24" r="22" fill="#dcfce7" stroke="#16a34a" strokeWidth="2.5"/>
              <line x1="14" y1="34" x2="34" y2="14" stroke="#15803d" strokeWidth="3.5" strokeLinecap="round"/>
              <polyline points="22,34 14,34 14,26" fill="none" stroke="#15803d" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="26,14 34,14 34,22" fill="none" stroke="#15803d" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
            </g>
          </g>
        )
      })()}
    </svg>
  )
}
