import { useRef, useCallback } from 'react'

function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1)
}

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
  const halfThick = 60
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

function snapToDrawing(p, canvasRef, snapRadius = 18) {
  const canvas = canvasRef?.current
  if (!canvas) return p
  const ctx = canvas.getContext('2d')
  const r = snapRadius
  const x0 = Math.max(0, Math.round(p.x) - r)
  const y0 = Math.max(0, Math.round(p.y) - r)
  const x1 = Math.min(canvas.width - 1, Math.round(p.x) + r)
  const y1 = Math.min(canvas.height - 1, Math.round(p.y) + r)
  const w = x1 - x0, h = y1 - y0
  if (w <= 0 || h <= 0) return p
  let imageData
  try { imageData = ctx.getImageData(x0, y0, w, h) } catch { return p }
  let bestDist = Infinity, bestX = p.x, bestY = p.y
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      if (imageData.data[(dy * w + dx) * 4 + 3] > 80) {
        const d = Math.hypot(x0 + dx - p.x, y0 + dy - p.y)
        if (d < bestDist) { bestDist = d; bestX = x0 + dx; bestY = y0 + dy }
      }
    }
  }
  return bestDist < snapRadius ? { x: bestX, y: bestY } : p
}

// arc 그리기 헬퍼
function drawArcSegment(canvas, pinX, pinY, fromAngle, toAngle, r, strokeColor, strokeWidth) {
  if (!canvas || r < 1) return
  const ctx = canvas.getContext('2d')
  ctx.beginPath()
  ctx.arc(pinX, pinY, r, fromAngle, toAngle)
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = strokeWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()
}

export default function CompassTool({ compass, setCompass, canvasRef, strokeColor, strokeWidth, onDraw, ruler, onInteractionEnd }) {
  const svgRef = useRef(null)
  const dragging = useRef(null)
  // dragOffset: 모든 드래그 파트에서 점프 방지용 공용 저장소
  const dragOffset = useRef({})
  const prevAngleRef = useRef(null)

  const { pinX, pinY, pencilX, pencilY, radiusInput } = compass
  const radius = dist(pinX, pinY, pencilX, pencilY)

  // 힌지 위치: 수직 방향이 위를 향하도록 부호 반전 (dy/span, -dx/span)
  const midX = (pinX + pencilX) / 2
  const midY = (pinY + pencilY) / 2
  const dxMain = pencilX - pinX
  const dyMain = pencilY - pinY
  const span = Math.hypot(dxMain, dyMain) || 1
  const halfDist = radius / 2
  const legLength = Math.max(280, halfDist + 60)
  const compassHeight = Math.sqrt(Math.max(0, legLength ** 2 - halfDist ** 2))
  // 힌지가 위쪽에 오도록: (dy, -dx) 방향
  const nx = dyMain / span
  const ny = -dxMain / span
  const hingeX = midX + nx * compassHeight
  const hingeY = midY + ny * compassHeight

  const leftLegAngleDeg = Math.atan2(hingeY - pinY, hingeX - pinX) * (180 / Math.PI)
  const rightLegAngleDeg = Math.atan2(hingeY - pencilY, hingeX - pencilX) * (180 / Math.PI)

  const getSVGPos = (e) => {
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const scaleX = svg.clientWidth / rect.width || 1
    const scaleY = svg.clientHeight / rect.height || 1
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
  }

  const onPointerDown = useCallback((part) => (e) => {
    e.stopPropagation()
    e.preventDefault()
    dragging.current = part
    const pos = getSVGPos(e)

    if (part === 'pin_top') {
      // 전체 이동: 클릭 지점과 핀 사이 오프셋 보존
      dragOffset.current = { dx: pos.x - pinX, dy: pos.y - pinY }
    } else if (part === 'pin_bottom') {
      // 반지름 조절: 연필 고정, 핀 이동
      const initPinAngle = Math.atan2(pinY - pencilY, pinX - pencilX)
      const initClickAngle = Math.atan2(pos.y - pencilY, pos.x - pencilX)
      dragOffset.current = {
        initPinAngle,
        angleOffset: initPinAngle - initClickAngle,
      }
    } else if (part === 'whole') {
      // 힌지: 절대 각도 기준 회전 (진동 없음)
      dragOffset.current = {
        initMouseAngle: Math.atan2(pos.y - pinY, pos.x - pinX),
        initPencilAngle: Math.atan2(pencilY - pinY, pencilX - pinX),
      }
    } else if (part === 'pencil' || part === 'clamp') {
      // 연필/클램프: 반지름만 조절, arc 없음 → 클릭 지점과 연필끝 각도 오프셋 보존
      const initPencilAngle = Math.atan2(pencilY - pinY, pencilX - pinX)
      const initClickAngle = Math.atan2(pos.y - pinY, pos.x - pinX)
      dragOffset.current = {
        initPencilAngle,
        angleOffset: initPencilAngle - initClickAngle,
      }
    } else if (part === 'leg') {
      // 은색 다리: arc 드로잉
      prevAngleRef.current = Math.atan2(pencilY - pinY, pencilX - pinX)
      onDraw?.()
    }

    const onMove = (me) => {
      me.preventDefault()
      const rawP = getSVGPos(me)

      if (dragging.current === 'pin_top') {
        const targetPinX = rawP.x - dragOffset.current.dx
        const targetPinY = rawP.y - dragOffset.current.dy
        const snapped = snapToDrawing(snapPointToRuler({ x: targetPinX, y: targetPinY }, ruler), canvasRef)
        const pdx = pencilX - pinX, pdy = pencilY - pinY
        setCompass({ pinX: snapped.x, pinY: snapped.y, pencilX: snapped.x + pdx, pencilY: snapped.y + pdy })
      } else if (dragging.current === 'pin_bottom') {
        const curMouseAngle = Math.atan2(rawP.y - pencilY, rawP.x - pencilX)
        const newPinAngle = curMouseAngle + dragOffset.current.angleOffset
        const newRadius = Math.hypot(rawP.x - pencilX, rawP.y - pencilY)
        if (newRadius > 2) {
          setCompass({
            pinX: pencilX + Math.cos(newPinAngle) * newRadius,
            pinY: pencilY + Math.sin(newPinAngle) * newRadius,
          })
        }
      } else if (dragging.current === 'whole') {
        const curMouseAngle = Math.atan2(rawP.y - pinY, rawP.x - pinX)
        const newPencilAngle = dragOffset.current.initPencilAngle + (curMouseAngle - dragOffset.current.initMouseAngle)
        setCompass({
          pencilX: pinX + Math.cos(newPencilAngle) * radius,
          pencilY: pinY + Math.sin(newPencilAngle) * radius,
        })

      } else if (dragging.current === 'pencil' || dragging.current === 'clamp') {
        // 각도 오프셋 유지하며 반지름만 변경 (점프 없음, arc 없음)
        const curMouseAngle = Math.atan2(rawP.y - pinY, rawP.x - pinX)
        const newPencilAngle = curMouseAngle + dragOffset.current.angleOffset
        const newRadius = dist(pinX, pinY, rawP.x, rawP.y)
        if (newRadius > 2) {
          setCompass({
            pencilX: pinX + Math.cos(newPencilAngle) * newRadius,
            pencilY: pinY + Math.sin(newPencilAngle) * newRadius,
          })
        }

      } else if (dragging.current === 'leg') {
        // 은색 다리 드래그 → arc 그리기
        const target = snapToDrawing(snapPointToRuler(rawP, ruler), canvasRef)
        const curAngle = Math.atan2(target.y - pinY, target.x - pinX)
        const newRadius = dist(pinX, pinY, target.x, target.y)
        drawArcSegment(canvasRef.current, pinX, pinY, prevAngleRef.current, curAngle, newRadius, strokeColor, strokeWidth)
        prevAngleRef.current = curAngle
        setCompass({ pencilX: target.x, pencilY: target.y })
      }
    }

    const onUp = () => {
      if (dragging.current) onInteractionEnd?.()
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

  // 힌지 더블클릭 → pin/pencil 교체
  const onHingeDblClick = useCallback((e) => {
    e.stopPropagation()
    e.preventDefault()
    setCompass({
      pinX: pencilX,
      pinY: pencilY,
      pencilX: pinX,
      pencilY: pinY,
    })
  }, [pinX, pinY, pencilX, pencilY, setCompass])

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
        {/* 왼쪽 다리 (침핀 쪽) - 다리 전체가 컴퍼스 이동 핸들 */}
        <g transform={`translate(${pinX}, ${pinY}) rotate(${leftLegAngleDeg})`} style={{ pointerEvents: 'none' }}>
          <polygon points="0,0 18,-1.5 18,1.5" fill="#64748b" />
          <rect x="16" y="-5.5" width="22" height="11" rx="2.5" fill="#1e293b" />
          <line x1="36" y1="0" x2={legLength} y2="0" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
          <line x1="36" y1="0" x2={legLength} y2="0" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
          <g style={{ pointerEvents: 'all', cursor: 'ew-resize' }} onMouseDown={onPointerDown('pin_bottom')} onTouchStart={onPointerDown('pin_bottom')}>
            <rect x="-4" y="-18" width={legLength / 2 + 4} height="36" fill="transparent" />
          </g>
          <g style={{ pointerEvents: 'all', cursor: 'move' }} onMouseDown={onPointerDown('pin_top')} onTouchStart={onPointerDown('pin_top')}>
            <rect x={legLength / 2} y="-18" width={legLength / 2} height="36" fill="transparent" />
          </g>
        </g>

        {/* 오른쪽 다리 (연필 쪽) */}
        <g transform={`translate(${pencilX}, ${pencilY}) rotate(${rightLegAngleDeg})`} style={{ pointerEvents: 'none' }}>
          {/* 은색 다리: 안쪽(y=-25)으로 이동하여 연필을 바깥쪽으로 */}
          <line x1="60" y1="-25" x2={legLength} y2="0" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
          <line x1="60" y1="-25" x2={legLength} y2="0" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
          <g style={{ pointerEvents: 'all', cursor: 'crosshair' }} onMouseDown={onPointerDown('leg')} onTouchStart={onPointerDown('leg')}>
            <rect x="70" y="-35" width={legLength - 70} height="20" fill="transparent" />
          </g>

          {/* 클램프 (네이비 부분) */}
          <g style={{ pointerEvents: 'none' }}>
            <polygon points="65,-25 75,-25 72,-9 60,-9" fill="#1e293b" />
            <rect x="68" y="-29" width="6" height="4" rx="1" fill="#94a3b8" />
            <rect x="55" y="-12" width="22" height="24" rx="4" fill="#1e293b" />
          </g>

          {/* 연필 어셈블리 (y=0 유지) */}
          <g transform="rotate(-9)" style={{ pointerEvents: 'none' }}>
            <path d="M0,0 L11,-2.2 L11,2.2 Z" fill="#1c1917" />
            <path d="M10,-2 L10,2 L30,4.5 L30,-4.5 Z" fill="#c8a96e" />
            <line x1="12" y1="-1.2" x2="29" y2="-3.8" stroke="#a07040" strokeWidth="0.7" />
            <line x1="12" y1="1.2" x2="29" y2="3.8" stroke="#a07040" strokeWidth="0.7" />
            <rect x="30" y="-4.5" width="147" height="9" fill="#f5c518" />
            <rect x="30" y="-4.5" width="147" height="3" fill="#f7d060" opacity="0.5" />
            <rect x="177" y="-4.5" width="14" height="9" fill="#9ca3af" />
            <line x1="179" y1="-4.5" x2="179" y2="4.5" stroke="#6b7280" strokeWidth="1" />
            <line x1="184" y1="-4.5" x2="184" y2="4.5" stroke="#6b7280" strokeWidth="1" />
            <rect x="191" y="-4.5" width="12" height="9" rx="2" fill="#f9a8a8" />
            
            <g style={{ pointerEvents: 'all', cursor: 'ew-resize' }} onMouseDown={onPointerDown('pencil')} onTouchStart={onPointerDown('pencil')}>
              <rect x="0" y="-12" width="55" height="24" fill="transparent" />
              <rect x="82" y="-12" width="122" height="24" fill="transparent" />
            </g>
            <g style={{ pointerEvents: 'all', cursor: 'ew-resize' }} onMouseDown={onPointerDown('clamp')} onTouchStart={onPointerDown('clamp')}>
              <rect x="55" y="-12" width="30" height="24" fill="transparent" />
            </g>
          </g>
        </g>

        {/* 힌지 + 손잡이 */}
        <g
          style={{ pointerEvents: 'all', cursor: 'grab' }}
          onMouseDown={onPointerDown('whole')}
          onTouchStart={onPointerDown('whole')}
          onDoubleClick={onHingeDblClick}
        >
          <circle cx={hingeX} cy={hingeY} r="32" fill="transparent" />
          <line x1={hingeX} y1={hingeY} x2={hingeX + nx * 32} y2={hingeY + ny * 32} stroke="#1e293b" strokeWidth="14" strokeLinecap="round" />
          <line x1={hingeX + nx * 8} y1={hingeY + ny * 8} x2={hingeX + nx * 30} y2={hingeY + ny * 30} stroke="#334155" strokeWidth="6" strokeLinecap="round" />
          <circle cx={hingeX} cy={hingeY} r="15" fill="#1e293b" />
          <circle cx={hingeX} cy={hingeY} r="15" fill="none" stroke="#475569" strokeWidth="2" />
          <rect x={hingeX - 9} y={hingeY - 5.5} width="18" height="11" rx="3" fill="#64748b" />
          <circle cx={hingeX} cy={hingeY} r="3" fill="#94a3b8" />
        </g>

        {/* 바늘 위치 표시 점 */}
        <circle cx={pinX} cy={pinY} r="3" fill="#dc2626" style={{ pointerEvents: 'none' }} />
      </svg>

      <div
        className="absolute bottom-4 right-4 bg-white rounded-xl shadow-lg border border-gray-200 p-3 flex flex-col gap-2 min-w-[160px]"
        style={{ zIndex: 20 }}
      >
        <p className="text-xs font-bold text-gray-600 mb-1">🧭 컴퍼스</p>
        <label className="text-xs text-gray-500">반경 (px)</label>
        <input
          type="number" min="1"
          value={radiusInput !== '' ? radiusInput : Math.round(radius)}
          onChange={handleRadiusInput}
          onFocus={() => setCompass({ radiusInput: String(Math.round(radius)) })}
          className="border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button onClick={drawFullCircle} className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-1.5 rounded-lg font-semibold transition-colors">
          원 그리기 (전체)
        </button>
        <p className="text-[11px] text-gray-400 leading-tight mt-1">
          📌 침핀다리 전체: 이동<br />
          ↔️ 연필/클램프: 반지름 조절<br />
          🔄 힌지: 회전 | 더블클릭: pin↔연필 교체<br />
          ✏️ 은색다리: 드래그로 arc<br />
          (도형 위 snap 지원)
        </p>
      </div>
    </>
  )
}
