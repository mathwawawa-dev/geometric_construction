import { useRef, useState, useCallback, useEffect } from 'react'

const HANDLE_R = 10

/**
 * 각도기 SVG 오버레이 (반원형)
 * - 몸통 드래그 → 이동
 * - 회전 핸들 드래그 → 회전
 * - 크기 조절 핸들 드래그 → 반경 변경
 */
export default function ProtractorTool({ protractor, setProtractor }) {
  const svgRef = useRef(null)
  const dragging = useRef(null)

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

    const onMove = (me) => {
      me.preventDefault()
      const p = getSVGPos(me)
      if (dragging.current === 'whole') {
        setProtractor({ cx: p.x, cy: p.y })
      } else if (dragging.current === 'rotate') {
        const a = Math.atan2(p.y - cy, p.x - cx)
        setProtractor({ angle: a })
      } else if (dragging.current === 'resize') {
        const r = Math.hypot(p.x - cx, p.y - cy)
        if (r > 40) setProtractor({ radius: r })
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
  }, [cx, cy, angle, radius, setProtractor])

  // 각도기 경로 — 반원 (arc) + 지름선
  const startAngle = angle        // 회전 적용된 시작
  const endAngle = angle + Math.PI

  const arcPath = describeArc(cx, cy, radius, startAngle, endAngle)

  // 회전 핸들: 반원 중앙 상단
  const rotatHandleAngle = angle + Math.PI / 2
  const rotateHandleX = cx + Math.cos(rotatHandleAngle) * (radius + 20)
  const rotateHandleY = cy + Math.sin(rotatHandleAngle) * (radius + 20)

  // 리사이즈 핸들: 오른쪽 끝
  const resizeHandleX = cx + Math.cos(angle) * radius
  const resizeHandleY = cy + Math.sin(angle) * radius

  // 각도 눈금 (0°, 30°, 60°, 90°, 120°, 150°, 180°)
  const tickAngles = [0, 30, 60, 90, 120, 150, 180]

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full"
      style={{ touchAction: 'none', pointerEvents: 'none' }}
    >
      {/* 각도기 반원 몸통 */}
      <path
        d={arcPath}
        fill="rgba(254, 240, 138, 0.45)"
        stroke="#ca8a04"
        strokeWidth="2"
        style={{ pointerEvents: 'all', cursor: 'grab' }}
        onMouseDown={onPointerDown('whole')}
        onTouchStart={onPointerDown('whole')}
      />
      {/* 지름선 */}
      <line
        x1={cx + Math.cos(angle) * radius}
        y1={cy + Math.sin(angle) * radius}
        x2={cx + Math.cos(angle + Math.PI) * radius}
        y2={cy + Math.sin(angle + Math.PI) * radius}
        stroke="#ca8a04" strokeWidth="2"
        style={{ pointerEvents: 'none' }}
      />
      {/* 중심점 */}
      <circle cx={cx} cy={cy} r={4} fill="#ca8a04" style={{ pointerEvents: 'none' }} />

      {/* 각도 눈금 */}
      {tickAngles.map((deg) => {
        const tickAngle = angle + (deg / 180) * Math.PI
        const inner = radius - 12
        const outer = radius
        const labelR = radius - 22
        return (
          <g key={deg} style={{ pointerEvents: 'none' }}>
            <line
              x1={cx + Math.cos(tickAngle) * inner}
              y1={cy + Math.sin(tickAngle) * inner}
              x2={cx + Math.cos(tickAngle) * outer}
              y2={cy + Math.sin(tickAngle) * outer}
              stroke="#92400e" strokeWidth="1.5"
            />
            <text
              x={cx + Math.cos(tickAngle) * labelR}
              y={cy + Math.sin(tickAngle) * labelR + 4}
              textAnchor="middle"
              fontSize="10"
              fill="#92400e"
              fontWeight="500"
              style={{ userSelect: 'none' }}
            >
              {deg}
            </text>
          </g>
        )
      })}

      {/* 회전 핸들 */}
      <circle
        cx={rotateHandleX} cy={rotateHandleY} r={HANDLE_R}
        fill="#f59e0b" stroke="white" strokeWidth="2"
        style={{ pointerEvents: 'all', cursor: 'grab' }}
        onMouseDown={onPointerDown('rotate')}
        onTouchStart={onPointerDown('rotate')}
      />
      {/* 리사이즈 핸들 */}
      <circle
        cx={resizeHandleX} cy={resizeHandleY} r={HANDLE_R}
        fill="#16a34a" stroke="white" strokeWidth="2"
        style={{ pointerEvents: 'all', cursor: 'ew-resize' }}
        onMouseDown={onPointerDown('resize')}
        onTouchStart={onPointerDown('resize')}
      />
    </svg>
  )
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const x1 = cx + r * Math.cos(startAngle)
  const y1 = cy + r * Math.sin(startAngle)
  const x2 = cx + r * Math.cos(endAngle)
  const y2 = cy + r * Math.sin(endAngle)
  return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} L ${cx} ${cy} Z`
}
