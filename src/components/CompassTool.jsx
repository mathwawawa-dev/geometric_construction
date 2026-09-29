import { useRef, useCallback } from 'react'

const HANDLE_R = 8

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
  const halfThick = 60 / 2 // RULER_THICKNESS
  
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

  // 힌지 위치 계산 (다리 길이 유지하며 위로)
  const midX = (pinX + pencilX) / 2
  const midY = (pinY + pencilY) / 2
  const dx = pencilX - pinX
  const dy = pencilY - pinY
  const length = Math.hypot(dx, dy) || 1
  
  // 직교 벡터
  const nx = -dy / length
  const ny = dx / length
  
  // 컴퍼스 높이: 최소 180px 정도로 실제 컴퍼스처럼 길게 보이도록 함
  const compassHeight = Math.max(180, length * 1.5)
  const hingeX = midX + nx * compassHeight
  const hingeY = midY + ny * compassHeight

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
        const rawWholeP = getSVGPos(me) // 전체 이동은 raw로 계산 후 pin 기준 스냅
        let targetPinX = rawWholeP.x - dragOffset.current.dx
        let targetPinY = rawWholeP.y - dragOffset.current.dy
        
        const pdx = pencilX - pinX
        const pdy = pencilY - pinY

        // pin 위치를 스냅
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
    window.addEventListener('touchend', onUp)
  }, [pinX, pinY, pencilX, pencilY, setCompass, ruler])

  // 숫자 입력 → 반경 설정
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
        {/* 컴퍼스 다리 (메탈 느낌) */}
        <line
          x1={hingeX} y1={hingeY}
          x2={pinX} y2={pinY}
          stroke="#94a3b8" strokeWidth="6" strokeLinecap="round"
          style={{ pointerEvents: 'none' }}
        />
        <line
          x1={hingeX} y1={hingeY}
          x2={pencilX} y2={pencilY}
          stroke="#94a3b8" strokeWidth="6" strokeLinecap="round"
          style={{ pointerEvents: 'none' }}
        />
        
        {/* 침핀 끝 뾰족한 부분 */}
        <circle cx={pinX} cy={pinY} r={3} fill="#475569" style={{ pointerEvents: 'none' }} />
        
        {/* 연필 끝 부분 (흑연 느낌) */}
        <polygon 
          points={`
            ${pencilX},${pencilY} 
            ${pencilX - 4 + (hingeX - pencilX)*0.05},${pencilY - 4 + (hingeY - pencilY)*0.05} 
            ${pencilX + 4 + (hingeX - pencilX)*0.05},${pencilY + 4 + (hingeY - pencilY)*0.05}
          `} 
          fill="#334155" 
          style={{ pointerEvents: 'none' }} 
        />

        {/* 힌지 조인트 (중앙 나사) */}
        <circle
          cx={hingeX} cy={hingeY} r={16}
          fill="#cbd5e1" stroke="#475569" strokeWidth="2"
          style={{ pointerEvents: 'all', cursor: 'grab' }}
          onMouseDown={onPointerDown('whole')}
          onTouchStart={onPointerDown('whole')}
        />
        <circle cx={hingeX} cy={hingeY} r={6} fill="#475569" style={{ pointerEvents: 'none' }} />

        {/* 침핀 핸들 (금속 조절 나사) */}
        <circle
          cx={pinX + (hingeX - pinX)*0.15} cy={pinY + (hingeY - pinY)*0.15} r={HANDLE_R + 2}
          fill="#cbd5e1" stroke="#475569" strokeWidth="2"
          style={{ pointerEvents: 'all', cursor: 'move' }}
          onMouseDown={onPointerDown('pin')}
          onTouchStart={onPointerDown('pin')}
        />
        
        {/* 연필 고정 나사 (금속) */}
        <circle
          cx={pencilX + (hingeX - pencilX)*0.15} cy={pencilY + (hingeY - pencilY)*0.15} r={HANDLE_R + 2}
          fill="#cbd5e1" stroke="#475569" strokeWidth="2"
          style={{ pointerEvents: 'all', cursor: 'move' }}
          onMouseDown={onPointerDown('pencil')}
          onTouchStart={onPointerDown('pencil')}
        />

        {/* 반경 미리보기 원 (점선) */}
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
          ⚙️ 중앙 나사: 전체 이동<br />
          (자 근처에서 찰칵 스냅됨)
        </p>
      </div>
    </>
  )
}
