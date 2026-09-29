import { useRef, useCallback, useState } from 'react'

function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1)
}

// 자 엣지에 스냅
function snapPointToRuler(p, ruler) {
  if (!ruler || !ruler.visible) return p
  const { x1, y1, x2, y2 } = ruler
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy)
  if (length === 0) return p
  const angle = Math.atan2(dy, dx)
  const cos = Math.cos(-angle)
  const sin = Math.sin(-angle)
  const tx = p.x - cx
  const ty = p.y - cy
  const localX = tx * cos - ty * sin
  const localY = tx * sin + ty * cos
  const halfThick = 60 // RULER_THICKNESS / 2
  if (localX < -length / 2 - 20 || localX > length / 2 + 20) return p
  const snapDist = 15
  const unCos = Math.cos(angle)
  const unSin = Math.sin(angle)
  if (Math.abs(localY - (-halfThick)) < snapDist)
    return { x: localX * unCos - (-halfThick) * unSin + cx, y: localX * unSin + (-halfThick) * unCos + cy }
  if (Math.abs(localY - halfThick) < snapDist)
    return { x: localX * unCos - halfThick * unSin + cx, y: localX * unSin + halfThick * unCos + cy }
  return p
}

// 캔버스 위 픽셀 스캔으로 그려진 도형에 snap
function snapToDrawing(p, canvasRef, snapRadius = 18) {
  const canvas = canvasRef?.current
  if (!canvas) return p
  const ctx = canvas.getContext('2d')
  const r = snapRadius
  const x0 = Math.max(0, Math.round(p.x) - r)
  const y0 = Math.max(0, Math.round(p.y) - r)
  const x1 = Math.min(canvas.width - 1, Math.round(p.x) + r)
  const y1 = Math.min(canvas.height - 1, Math.round(p.y) + r)
  const w = x1 - x0
  const h = y1 - y0
  if (w <= 0 || h <= 0) return p

  let imageData
  try {
    imageData = ctx.getImageData(x0, y0, w, h)
  } catch { return p }

  let bestDist = Infinity
  let bestX = p.x, bestY = p.y
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const alpha = imageData.data[(dy * w + dx) * 4 + 3]
      if (alpha > 80) {
        const px = x0 + dx
        const py = y0 + dy
        const d = Math.hypot(px - p.x, py - p.y)
        if (d < bestDist) { bestDist = d; bestX = px; bestY = py }
      }
    }
  }
  if (bestDist < snapRadius) return { x: bestX, y: bestY }
  return p
}

export default function CompassTool({ compass, setCompass, canvasRef, strokeColor, strokeWidth, onDraw, ruler }) {
  const svgRef = useRef(null)
  const dragging = useRef(null) // 'pin' | 'pencil' | 'whole'
  const dragOffset = useRef({ dx: 0, dy: 0 })
  // pencil 드래그: 이전 각도 추적
  const prevAngleRef = useRef(null)
  const [drawingArcAngle, setDrawingArcAngle] = useState(null) // 연필이 그린 arc 끝 각도

  const { pinX, pinY, pencilX, pencilY, radiusInput } = compass
  const radius = dist(pinX, pinY, pencilX, pencilY)

  // 힌지 위치 계산 (현실적 컴퍼스: 다리 고정 길이)
  const midX = (pinX + pencilX) / 2
  const midY = (pinY + pencilY) / 2
  const dxMain = pencilX - pinX
  const dyMain = pencilY - pinY
  const halfDist = radius / 2
  const legLength = Math.max(280, halfDist + 60)
  const compassHeight = Math.sqrt(Math.max(0, legLength ** 2 - halfDist ** 2))
  const span = Math.hypot(dxMain, dyMain) || 1
  const nx = -dyMain / span
  const ny = dxMain / span
  const hingeX = midX + nx * compassHeight
  const hingeY = midY + ny * compassHeight

  const leftLegAngleDeg = Math.atan2(hingeY - pinY, hingeX - pinX) * (180 / Math.PI)
  const rightLegAngleDeg = Math.atan2(hingeY - pencilY, hingeX - pencilX) * (180 / Math.PI)

  const getSVGPos = (e) => {
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const onPointerDown = useCallback((part) => (e) => {
    e.stopPropagation()
    e.preventDefault()
    dragging.current = part
    const pos = getSVGPos(e)

    if (part === 'pin') {
      // 바늘 → 전체 이동, 반지름 유지 (dragOffset으로 점프 방지)
      dragOffset.current = { dx: pos.x - pinX, dy: pos.y - pinY }
    } else if (part === 'whole') {
      // 힌지 → pin 고정, 컴퍼스 회전
      prevAngleRef.current = Math.atan2(pos.y - pinY, pos.x - pinX)
    } else if (part === 'pencil') {
      // 연필 → 반지름 변경 + 실시간 arc 드로잉
      prevAngleRef.current = Math.atan2(pencilY - pinY, pencilX - pinX)
      onDraw?.() // 히스토리 스냅샷
    }

    const onMove = (me) => {
      me.preventDefault()
      const rawP = getSVGPos(me)
      const p = snapPointToRuler(rawP, ruler)
      const snappedCanvas = snapToDrawing(p, canvasRef)

      if (dragging.current === 'pin') {
        // 전체 이동 (반지름 유지)
        const targetPinX = rawP.x - dragOffset.current.dx
        const targetPinY = rawP.y - dragOffset.current.dy
        const snapped = snapPointToRuler({ x: targetPinX, y: targetPinY }, ruler)
        const snappedC = snapToDrawing(snapped, canvasRef)
        const pdx = pencilX - pinX
        const pdy = pencilY - pinY
        setCompass({ pinX: snappedC.x, pinY: snappedC.y, pencilX: snappedC.x + pdx, pencilY: snappedC.y + pdy })
      } else if (dragging.current === 'whole') {
        // 힌지 드래그 → pin 고정, 반지름 유지 + 회전
        const curAngle = Math.atan2(rawP.y - pinY, rawP.x - pinX)
        const dAngle = curAngle - prevAngleRef.current
        prevAngleRef.current = curAngle
        const oldAngle = Math.atan2(pencilY - pinY, pencilX - pinX)
        const newAngle = oldAngle + dAngle
        setCompass({
          pencilX: pinX + Math.cos(newAngle) * radius,
          pencilY: pinY + Math.sin(newAngle) * radius,
        })
      } else if (dragging.current === 'clamp') {
        // 클램프 드래그 → arc 없이 반지름만 조절
        const newPencilPos = snapToDrawing(snapPointToRuler(rawP, ruler), canvasRef)
        const newRadius = dist(pinX, pinY, newPencilPos.x, newPencilPos.y)
        if (newRadius > 2) {
          setCompass({ pencilX: newPencilPos.x, pencilY: newPencilPos.y })
        }
      } else if (dragging.current === 'pencil') {
        // 연필 드래그 → 반지름 방향 이동 + arc 그리기
        const newPencilPos = snapToDrawing(snapPointToRuler(rawP, ruler), canvasRef)
        const prevAngle = prevAngleRef.current
        const curAngle = Math.atan2(newPencilPos.y - pinY, newPencilPos.x - pinX)
        const newRadius = dist(pinX, pinY, newPencilPos.x, newPencilPos.y)
        if (newRadius > 2) {
          // arc 그리기 (prevAngle → curAngle)
          const canvas = canvasRef.current
          if (canvas) {
            const ctx = canvas.getContext('2d')
            ctx.beginPath()
            ctx.arc(pinX, pinY, newRadius, prevAngle, curAngle)
            ctx.strokeStyle = strokeColor
            ctx.lineWidth = strokeWidth
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.stroke()
          }
          prevAngleRef.current = curAngle
          setCompass({ pencilX: newPencilPos.x, pencilY: newPencilPos.y })
        }
      }
    }

    const onUp = () => {
      dragging.current = null
      prevAngleRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
  }, [pinX, pinY, pencilX, pencilY, radius, setCompass, ruler, canvasRef, strokeColor, strokeWidth, onDraw])

  const handleRadiusInput = (e) => {
    const val = e.target.value
    setCompass({ radiusInput: val })
    const num = parseFloat(val)
    if (!isNaN(num) && num > 0) {
      const angle = Math.atan2(pencilY - pinY, pencilX - pinX)
      setCompass({ radiusInput: val, pencilX: pinX + Math.cos(angle) * num, pencilY: pinY + Math.sin(angle) * num })
    }
  }

  const drawFullCircle = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    onDraw?.()
    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.arc(pinX, pinY, radius, 0, Math.PI * 2)
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = strokeWidth
    ctx.lineCap = 'round'
    ctx.stroke()
  }, [canvasRef, pinX, pinY, radius, strokeColor, strokeWidth, onDraw])

  return (
    <>
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full tool-overlay"
        style={{ touchAction: 'none', pointerEvents: 'none' }}
      >
        {/* 왼쪽 다리 (침핀 쪽) */}
        <g transform={`translate(${pinX}, ${pinY}) rotate(${leftLegAngleDeg})`} style={{ pointerEvents: 'none' }}>
          {/* 바늘 (뾰족한 끝) */}
          <polygon points="0,0 18,-1.5 18,1.5" fill="#64748b" />
          {/* 네이비 홀더 */}
          <rect x="16" y="-5.5" width="22" height="11" rx="2.5" fill="#1e293b" />
          {/* 은색 다리 */}
          <line x1="36" y1="0" x2={legLength} y2="0" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
          <line x1="36" y1="0" x2={legLength} y2="0" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
          {/* 핸들 (투명 클릭 영역: pin 전체 이동) */}
          <g style={{ pointerEvents: 'all', cursor: 'move' }} onMouseDown={onPointerDown('pin')} onTouchStart={onPointerDown('pin')}>
            <rect x="-4" y="-18" width={legLength * 0.35} height="36" fill="transparent" />
          </g>
        </g>

        {/* 오른쪽 다리 (연필 쪽) */}
        <g transform={`translate(${pencilX}, ${pencilY}) rotate(${rightLegAngleDeg})`} style={{ pointerEvents: 'none' }}>
          {/* 은색 다리 */}
          <line x1="70" y1="-10" x2={legLength} y2="0" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
          <line x1="70" y1="-10" x2={legLength} y2="0" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />

          {/* 연필 어셈블리 (−9도 기울어져 꽂힘, 길이 2/3로 축소) */}
          <g transform="rotate(-9)" style={{ pointerEvents: 'none' }}>
            {/* 흑연 끝 */}
            <polygon points="0,0 10,-2 10,2" fill="#1c1917" />
            {/* 나무 부분: 흑연 끝에 바로 맞닿게 */}
            <polygon points="10,-2 10,2 30,-4.5 30,4.5" fill="#c8a96e" />
            {/* 나무 결: 삼각형 안쪽에만 */}
            <line x1="11" y1="-1.5" x2="29" y2="-4" stroke="#b8936e" strokeWidth="0.7" />
            <line x1="11" y1="1.5" x2="29" y2="4" stroke="#b8936e" strokeWidth="0.7" />
            {/* 노란 몸통 (220 → 147) */}
            <rect x="30" y="-4.5" width="147" height="9" fill="#f5c518" />
            <rect x="30" y="-4.5" width="147" height="3" fill="#f7d060" opacity="0.5" />
            {/* 금속 페룰 (x: 250→177) */}
            <rect x="177" y="-4.5" width="14" height="9" fill="#9ca3af" />
            <line x1="179" y1="-4.5" x2="179" y2="4.5" stroke="#6b7280" strokeWidth="1" />
            <line x1="184" y1="-4.5" x2="184" y2="4.5" stroke="#6b7280" strokeWidth="1" />
            {/* 지우개 (x: 264→191) */}
            <rect x="191" y="-4.5" width="12" height="9" rx="2" fill="#f9a8a8" />
            {/* 네이비 클램프 (고정) */}
            <rect x="58" y="-9" width="22" height="18" rx="3" fill="#1e293b" />
            <rect x="64" y="-13" width="10" height="5" rx="1.5" fill="#94a3b8" stroke="#64748b" strokeWidth="0.8" />

            {/* 연필 몸통 클릭 핸들 (arc 그리기) — 클램프 제외 */}
            <g style={{ pointerEvents: 'all', cursor: 'crosshair' }} onMouseDown={onPointerDown('pencil')} onTouchStart={onPointerDown('pencil')}>
              <rect x="0" y="-12" width="55" height="24" fill="transparent" />
              <rect x="82" y="-12" width="122" height="24" fill="transparent" />
            </g>

            {/* 클램프 클릭 핸들 (반지름만 조절, arc 없음) */}
            <g style={{ pointerEvents: 'all', cursor: 'ew-resize' }} onMouseDown={onPointerDown('clamp')} onTouchStart={onPointerDown('clamp')}>
              <rect x="55" y="-12" width="30" height="24" fill="transparent" />
            </g>
          </g>
        </g>

        {/* 상단 손잡이 + 힌지 (전체 회전) */}
        <g
          style={{ pointerEvents: 'all', cursor: 'grab' }}
          onMouseDown={onPointerDown('whole')}
          onTouchStart={onPointerDown('whole')}
        >
          <circle cx={hingeX} cy={hingeY} r="32" fill="transparent" />
          {/* 위로 뻗은 손잡이 */}
          <line
            x1={hingeX} y1={hingeY}
            x2={hingeX + nx * 32} y2={hingeY + ny * 32}
            stroke="#1e293b" strokeWidth="14" strokeLinecap="round"
          />
          <line
            x1={hingeX + nx * 8} y1={hingeY + ny * 8}
            x2={hingeX + nx * 30} y2={hingeY + ny * 30}
            stroke="#334155" strokeWidth="6" strokeLinecap="round"
          />
          {/* O링 힌지 */}
          <circle cx={hingeX} cy={hingeY} r="15" fill="#1e293b" />
          <circle cx={hingeX} cy={hingeY} r="15" fill="none" stroke="#475569" strokeWidth="2" />
          {/* 타공 구멍 */}
          <rect x={hingeX - 9} y={hingeY - 5.5} width="18" height="11" rx="3" fill="#64748b" />
          {/* 중심 심 */}
          <circle cx={hingeX} cy={hingeY} r="3" fill="#94a3b8" />
        </g>

        {/* 바늘 위치 표시 점 */}
        <circle cx={pinX} cy={pinY} r="3" fill="#dc2626" style={{ pointerEvents: 'none' }} />
      </svg>

      {/* 컴퍼스 컨트롤 패널 */}
      <div
        className="absolute bottom-4 right-4 bg-white rounded-xl shadow-lg border border-gray-200 p-3 flex flex-col gap-2 min-w-[160px]"
        style={{ zIndex: 20 }}
      >
        <p className="text-xs font-bold text-gray-600 mb-1">🧭 컴퍼스</p>
        <label className="text-xs text-gray-500">반경 (px)</label>
        <input
          type="number"
          min="1"
          value={radiusInput !== '' ? radiusInput : Math.round(radius)}
          onChange={handleRadiusInput}
          onFocus={() => setCompass({ radiusInput: String(Math.round(radius)) })}
          className="border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={drawFullCircle}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-1.5 rounded-lg font-semibold transition-colors"
        >
          원 그리기 (전체)
        </button>
        <p className="text-[11px] text-gray-400 leading-tight mt-1">
          📌 바늘: 전체 이동<br />
          ✏️ 연필: 드래그로 arc 그리기<br />
          🔄 힌지: pin 고정, 회전<br />
          (도형 위에서 찰칵 스냅됨)
        </p>
      </div>
    </>
  )
}
