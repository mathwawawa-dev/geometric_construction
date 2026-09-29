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
  
  if (localX < -length/2 - 20 || localX > length/2 + 20) return p
  
  const snapDist = 15
  
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

  // 다리 길이 및 힌지 높이 계산
  const midX = (pinX + pencilX) / 2
  const midY = (pinY + pencilY) / 2
  const dx = pencilX - pinX
  const dy = pencilY - pinY
  const halfDist = radius / 2

  // 비율이 길고 슬림한 디자인을 위해 다리 길이를 280으로 증가
  const legLength = Math.max(280, halfDist + 50)
  const compassHeight = Math.sqrt(legLength ** 2 - halfDist ** 2)
  
  const length = Math.hypot(dx, dy) || 1
  const nx = -dy / length
  const ny = dx / length
  
  const hingeX = midX + nx * compassHeight
  const hingeY = midY + ny * compassHeight

  const leftLegAngleDeg = Math.atan2(hingeY - pinY, hingeX - pinX) * (180 / Math.PI)
  const rightLegAngleDeg = Math.atan2(hingeY - pencilY, hingeX - pencilX) * (180 / Math.PI)

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
        <defs>
          <mask id="hinge-hole">
            <rect x="-1000" y="-1000" width="2000" height="2000" fill="white" />
            <rect x={hingeX - 8} y={hingeY - 5} width="16" height="10" rx="3" fill="black" />
          </mask>
        </defs>

        {/* 1. 왼쪽 다리 (침핀) */}
        <g transform={`translate(${pinX}, ${pinY}) rotate(${leftLegAngleDeg})`} style={{ pointerEvents: 'none' }}>
          {/* 바늘 */}
          <polygon points="0,0 20,-1.5 20,1.5" fill="#94a3b8" />
          {/* 네이비색 플라스틱 홀더 */}
          <rect x="20" y="-6" width="24" height="12" rx="3" fill="#1e293b" />
          {/* 은색 금속 다리 본체 */}
          <line x1="40" y1="0" x2={legLength} y2="0" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
          <line x1="40" y1="0" x2={legLength} y2="0" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" />
          
          {/* 조절용 투명 핸들 (여기를 잡고 핀 이동) */}
          <g style={{ pointerEvents: 'all', cursor: 'move' }} onMouseDown={onPointerDown('pin')} onTouchStart={onPointerDown('pin')}>
            <rect x="0" y="-20" width="60" height="40" fill="transparent" />
          </g>
        </g>

        {/* 2. 오른쪽 다리 (긴 연필 장착) */}
        <g transform={`translate(${pencilX}, ${pencilY}) rotate(${rightLegAngleDeg})`} style={{ pointerEvents: 'none' }}>
          
          {/* 은색 금속 다리 본체 (힌지에서 클램프 위치까지) */}
          {/* 연필 그룹이 -9도 회전되어 있으므로 클램프 위치(x=70)의 Y좌표 오프셋은 대략 -11 */}
          <line x1="70" y1="-11" x2={legLength} y2="0" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
          <line x1="70" y1="-11" x2={legLength} y2="0" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" />
          
          {/* 연필 & 클램프 어셈블리 (힌지를 빗겨가도록 -9도 회전) */}
          <g transform="rotate(-9)">
            {/* 긴 연필 */}
            <polygon points="0,0 12,-3 12,3" fill="#333" /> {/* 흑연 */}
            <polygon points="12,-3 12,3 35,-5 35,5" fill="#deb887" /> {/* 나무 */}
            <rect x="35" y="-5" width="260" height="10" fill="#fbbf24" /> {/* 노란 몸통 */}
            
            {/* 육각 디테일 라인 */}
            <line x1="35" y1="-1.5" x2="295" y2="-1.5" stroke="#f59e0b" strokeWidth="1" />
            <line x1="35" y1="1.5" x2="295" y2="1.5" stroke="#f59e0b" strokeWidth="1" />
            
            <rect x="295" y="-5" width="15" height="10" fill="#cbd5e1" /> {/* 은색 페룰 */}
            <rect x="310" y="-5" width="12" height="10" rx="2" fill="#f87171" /> {/* 지우개 */}
            
            {/* 연필을 꽉 잡아주는 네이비색 클램프 */}
            <rect x="60" y="-10" width="20" height="20" rx="4" fill="#1e293b" />
            {/* 은색 조임 나사 */}
            <rect x="66" y="-14" width="8" height="4" rx="1" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
            
            {/* 조절용 투명 핸들 (연필 전체 길이 덮음) */}
            <g style={{ pointerEvents: 'all', cursor: 'move' }} onMouseDown={onPointerDown('pencil')} onTouchStart={onPointerDown('pencil')}>
              <rect x="15" y="-15" width="310" height="30" fill="transparent" />
            </g>
          </g>
        </g>

        {/* 3. 꼭대기 손잡이 및 중앙 힌지 */}
        <g 
          style={{ pointerEvents: 'all', cursor: 'grab' }}
          onMouseDown={onPointerDown('whole')}
          onTouchStart={onPointerDown('whole')}
        >
          {/* 넓은 클릭 판정 영역 */}
          <circle cx={hingeX} cy={hingeY} r="35" fill="transparent" />
          
          {/* 튀어나온 윗부분 손잡이 (다크 네이비) */}
          <line
            x1={hingeX} y1={hingeY}
            x2={hingeX + nx * 28} y2={hingeY + ny * 28}
            stroke="#1e293b" strokeWidth="12" strokeLinecap="round"
          />
          
          {/* 중앙 힌지 (네이비색, 중앙에 직사각형 타공 마스크 적용) */}
          <circle cx={hingeX} cy={hingeY} r="18" fill="#1e293b" mask="url(#hinge-hole)" />
        </g>

        {/* 4. 반경 미리보기 원 (점선) */}
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
          ⚙️ 연필/바늘: 클릭 후 이동<br />
          ⚙️ 상단 힌지: 전체 이동<br />
          (자 근처에서 찰칵 스냅됨)
        </p>
      </div>
    </>
  )
}
