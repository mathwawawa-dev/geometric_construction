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
  const halfThick = 120 / 2 // RULER_THICKNESS
  
  // 자의 길이 범위를 약간 벗어난 곳까지는 스냅 허용
  if (localX < -length/2 - 20 || localX > length/2 + 20) return p
  
  const snapDist = 15 // 컴퍼스 툴 스냅 반경
  
  if (Math.abs(localY - (-halfThick)) < snapDist) {
    const unCos = Math.cos(angle)
    const unSin = Math.sin(angle)
    return {
      x: localX * unCos - (-halfThick) * unSin + cx,
      y: localX * unSin + (-halfThick) * unCos + cy
    }
  }
  
  if (Math.abs(localY - halfThick) < snapDist) {
    const unCos = Math.cos(angle)
    const unSin = Math.sin(angle)
    return {
      x: localX * unCos - halfThick * unSin + cx,
      y: localX * unSin + halfThick * unCos + cy
    }
  }
  
  return p
}

export default function CompassTool({ compass, setCompass, canvasRef, strokeColor, strokeWidth, onDraw, ruler }) {
  const svgRef = useRef(null)
  const dragging = useRef(null) // 'pin' | 'pencil' | 'whole'
  const dragOffset = useRef({ dx: 0, dy: 0 })

  const { pinX, pinY, pencilX, pencilY, radiusInput } = compass
  const radius = dist(pinX, pinY, pencilX, pencilY)

  // 1. 다리 길이 및 힌지(손잡이) 높이 계산
  const midX = (pinX + pencilX) / 2
  const midY = (pinY + pencilY) / 2
  const dx = pencilX - pinX
  const dy = pencilY - pinY
  const halfDist = radius / 2

  // 고정된 다리 길이
  const legLength = Math.max(260, halfDist + 50)
  
  // 높이 계산
  const compassHeight = Math.sqrt(legLength ** 2 - halfDist ** 2)
  
  const length = Math.hypot(dx, dy) || 1
  const nx = -dy / length
  const ny = dx / length
  
  const hingeX = midX + nx * compassHeight
  const hingeY = midY + ny * compassHeight

  // 다리 각도 계산
  const leftLegAngleDeg = Math.atan2(hingeY - pinY, hingeX - pinX) * (180 / Math.PI)
  const rightLegAngleDeg = Math.atan2(hingeY - pencilY, hingeX - pencilX) * (180 / Math.PI)

  // 스핀들 (수평 나사) 좌표
  const barX1 = pinX + (hingeX - pinX) * 0.45
  const barY1 = pinY + (hingeY - pinY) * 0.45
  const barX2 = pencilX + (hingeX - pencilX) * 0.45
  const barY2 = pencilY + (hingeY - pencilY) * 0.45
  const barMidX = (barX1 + barX2) / 2
  const barMidY = (barY1 + barY2) / 2
  const barAngleDeg = Math.atan2(barY2 - barY1, barX2 - barX1) * (180 / Math.PI)

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
    if (part === 'whole') {
      dragOffset.current = { dx: pos.x - pinX, dy: pos.y - pinY }
    } else {
      dragOffset.current = { dx: 0, dy: 0 }
    }

    const onMove = (me) => {
      me.preventDefault()
      const rawP = getSVGPos(me)
      const p = snapPointToRuler(rawP, ruler)

      if (dragging.current === 'pin') {
        const pdx = pencilX - pinX
        const pdy = pencilY - pinY
        setCompass({ pinX: p.x, pinY: p.y, pencilX: p.x + pdx, pencilY: p.y + pdy })
      } else if (dragging.current === 'pencil') {
        setCompass({ pencilX: p.x, pencilY: p.y })
      } else if (dragging.current === 'whole') {
        const rawWholeP = getSVGPos(me)
        let targetPinX = rawWholeP.x - dragOffset.current.dx
        let targetPinY = rawWholeP.y - dragOffset.current.dy
        
        const pdx = pencilX - pinX
        const pdy = pencilY - pinY

        const snappedPin = snapPointToRuler({ x: targetPinX, y: targetPinY }, ruler)
        setCompass({ pinX: snappedPin.x, pinY: snappedPin.y, pencilX: snappedPin.x + pdx, pencilY: snappedPin.y + pdy })
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
    window.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false })
    window.addEventListener('touchend', onUp)
  }, [pinX, pinY, pencilX, pencilY, setCompass, ruler])

  const handleRadiusInput = (e) => {
    const val = e.target.value
    setCompass({ radiusInput: val })
    const num = parseFloat(val)
    if (!isNaN(num) && num > 0) {
      const angle = Math.atan2(pencilY - pinY, pencilX - pinX)
      setCompass({
        radiusInput: val,
        pencilX: pinX + Math.cos(angle) * num,
        pencilY: pinY + Math.sin(angle) * num,
      })
    }
  }

  const drawArc = useCallback(() => {
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
        {/* 1. 스핀들 (가운데 수평 나사선) */}
        <line x1={barX1} y1={barY1} x2={barX2} y2={barY2} stroke="#64748b" strokeWidth="3" />
        <g transform={`translate(${barMidX}, ${barMidY}) rotate(${barAngleDeg})`}>
          <rect x="-3" y="-12" width="6" height="24" rx="1.5" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
        </g>

        {/* 2. 왼쪽 다리 (침핀) */}
        <g transform={`translate(${pinX}, ${pinY}) rotate(${leftLegAngleDeg})`} style={{ pointerEvents: 'none' }}>
          {/* 바늘 */}
          <polygon points="0,0 20,-1.5 20,1.5" fill="#94a3b8" />
          {/* 은색 다리 본체 */}
          <line x1="20" y1="0" x2={legLength} y2="0" stroke="#cbd5e1" strokeWidth="12" strokeLinecap="round" />
          {/* 입체감을 위한 내부 라인 */}
          <line x1="20" y1="0" x2={legLength} y2="0" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />
          
          {/* 조절 클램프 (여기를 잡고 핀 이동) */}
          <g 
            style={{ pointerEvents: 'all', cursor: 'move' }} 
            onMouseDown={onPointerDown('pin')} 
            onTouchStart={onPointerDown('pin')}
          >
            {/* 안쪽 넉넉한 투명 영역으로 클릭 판정 확대 */}
            <rect x="0" y="-15" width="40" height="30" fill="transparent" />
            <rect x="15" y="-7" width="12" height="14" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
            <circle cx="21" cy="9" r="4" fill="#64748b" stroke="white" strokeWidth="1" />
          </g>
        </g>

        {/* 3. 오른쪽 다리 (연필) */}
        <g transform={`translate(${pencilX}, ${pencilY}) rotate(${rightLegAngleDeg})`} style={{ pointerEvents: 'none' }}>
          {/* 짧은 연필 (다리에 장착된 형태) */}
          <polygon points="0,0 8,-2.5 8,2.5" fill="#333" /> {/* 흑연 */}
          <polygon points="8,-2.5 8,2.5 20,-4 20,4" fill="#deb887" /> {/* 나무 */}
          <rect x="20" y="-4" width="55" height="8" fill="#334155" /> {/* 어두운 몸통 */}
          <rect x="75" y="-4" width="10" height="8" fill="#94a3b8" /> {/* 은색 밴드 */}
          
          {/* 은색 다리 본체 (연필 몸통 위를 덮음) */}
          <line x1="35" y1="0" x2={legLength} y2="0" stroke="#cbd5e1" strokeWidth="12" strokeLinecap="round" />
          <line x1="35" y1="0" x2={legLength} y2="0" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />
          
          {/* 조절 클램프 (여기를 잡고 연필 이동) */}
          <g 
            style={{ pointerEvents: 'all', cursor: 'move' }} 
            onMouseDown={onPointerDown('pencil')} 
            onTouchStart={onPointerDown('pencil')}
          >
            <rect x="15" y="-15" width="40" height="30" fill="transparent" />
            <rect x="30" y="-8" width="14" height="16" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
            <circle cx="37" cy="10" r="4.5" fill="#64748b" stroke="white" strokeWidth="1" />
          </g>
        </g>

        {/* 4. 꼭대기 손잡이 및 중앙 힌지 */}
        <g 
          style={{ pointerEvents: 'all', cursor: 'grab' }}
          onMouseDown={onPointerDown('whole')}
          onTouchStart={onPointerDown('whole')}
        >
          {/* 넓은 클릭 판정 영역 */}
          <circle cx={hingeX} cy={hingeY} r="35" fill="transparent" />
          
          {/* 튀어나온 윗부분 손잡이 */}
          <line
            x1={hingeX} y1={hingeY}
            x2={hingeX + nx * 45} y2={hingeY + ny * 45}
            stroke="#cbd5e1" strokeWidth="12" strokeLinecap="round"
          />
          <line
            x1={hingeX} y1={hingeY}
            x2={hingeX + nx * 42} y2={hingeY + ny * 42}
            stroke="#64748b" strokeWidth="4" strokeLinecap="round" strokeDasharray="4 2"
          />
          
          {/* 중앙 O링 힌지 */}
          <circle cx={hingeX} cy={hingeY} r="14" fill="transparent" stroke="#cbd5e1" strokeWidth="8" />
          <circle cx={hingeX} cy={hingeY} r="14" fill="transparent" stroke="#94a3b8" strokeWidth="2" />
          {/* 중앙 심 */}
          <circle cx={hingeX} cy={hingeY} r="4" fill="#475569" />
        </g>

        {/* 5. 반경 미리보기 원 (점선) */}
        <circle
          cx={pinX} cy={pinY} r={radius}
          fill="none" stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="6 4"
          style={{ pointerEvents: 'none' }}
        />
        <text
          x={(pinX + pencilX) / 2}
          y={(pinY + pencilY) / 2 - 8}
          textAnchor="middle" fontSize="13" fill="#1e40af" fontWeight="600"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          r = {Math.round(radius)}px
        </text>
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
          onClick={drawArc}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-1.5 rounded-lg font-semibold transition-colors"
        >
          원 그리기
        </button>
        <p className="text-[11px] text-gray-400 leading-tight mt-1">
          ⚙️ 다리 나사: 이동/반경<br />
          ⚙️ 상단 손잡이: 전체 이동<br />
          (자 근처에서 찰칵 스냅됨)
        </p>
      </div>
    </>
  )
}
