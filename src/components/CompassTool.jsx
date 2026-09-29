import { useRef, useState, useCallback, useEffect } from 'react'

const HANDLE_R = 10   // 드래그 핸들 반지름
const LEG_COLOR = '#6b7280'
const HINGE_COLOR = '#374151'

function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay)
}

/**
 * 컴퍼스 SVG 오버레이
 *
 * - pinPoint  : 침핀 (중심, 고정 가능)
 * - pencilPoint: 연필 (반경 결정)
 * - 몸통 전체 드래그 (힌지 영역)
 * - 침핀 드래그 → 중심 이동, 반경 유지
 * - 연필 드래그 → 반경 변경
 * - 반경 숫자 직접 입력
 * - "원호 그리기" 버튼 → canvasRef에 arc 커밋
 */
export default function CompassTool({ compass, setCompass, canvasRef, strokeColor, strokeWidth, onDraw }) {
  const svgRef = useRef(null)
  const dragging = useRef(null) // 'pin' | 'pencil' | 'whole'
  const dragOffset = useRef({ dx: 0, dy: 0 })

  const { pinX, pinY, pencilX, pencilY, radiusInput } = compass
  const radius = dist(pinX, pinY, pencilX, pencilY)

  // 힌지(손잡이) 위치 — 두 다리의 중점에서 위로
  const hingeX = (pinX + pencilX) / 2
  const hingeY = (pinY + pencilY) / 2 - radius * 0.35

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
      const p = getSVGPos(me)
      if (dragging.current === 'pin') {
        const dx = pencilX - pinX
        const dy = pencilY - pinY
        setCompass({ pinX: p.x, pinY: p.y, pencilX: p.x + dx, pencilY: p.y + dy })
      } else if (dragging.current === 'pencil') {
        setCompass({ pencilX: p.x, pencilY: p.y })
      } else if (dragging.current === 'whole') {
        const nx = p.x - dragOffset.current.dx
        const ny = p.y - dragOffset.current.dy
        const dx = pencilX - pinX
        const dy = pencilY - pinY
        setCompass({ pinX: nx, pinY: ny, pencilX: nx + dx, pencilY: ny + dy })
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
  }, [pinX, pinY, pencilX, pencilY, setCompass])

  // 숫자 입력 → 반경 설정 (연필이 오른쪽 방향으로)
  const handleRadiusInput = (e) => {
    const val = e.target.value
    setCompass({ radiusInput: val })
    const num = parseFloat(val)
    if (!isNaN(num) && num > 0) {
      // 현재 각도 유지, 반경만 변경
      const angle = Math.atan2(pencilY - pinY, pencilX - pinX)
      setCompass({
        radiusInput: val,
        pencilX: pinX + Math.cos(angle) * num,
        pencilY: pinY + Math.sin(angle) * num,
      })
    }
  }

  // 원호 그리기 → Canvas에 커밋
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
      {/* SVG 오버레이 — 포인터 이벤트는 도구 부분만 */}
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full tool-overlay"
        style={{ touchAction: 'none', pointerEvents: 'none' }}
      >
        {/* 왼쪽 다리 (침핀) */}
        <line
          x1={hingeX} y1={hingeY}
          x2={pinX} y2={pinY}
          stroke={LEG_COLOR} strokeWidth="4" strokeLinecap="round"
          style={{ pointerEvents: 'none' }}
        />
        {/* 오른쪽 다리 (연필) */}
        <line
          x1={hingeX} y1={hingeY}
          x2={pencilX} y2={pencilY}
          stroke={LEG_COLOR} strokeWidth="4" strokeLinecap="round"
          style={{ pointerEvents: 'none' }}
        />
        {/* 힌지 — 전체 드래그 */}
        <circle
          cx={hingeX} cy={hingeY} r={14}
          fill={HINGE_COLOR}
          style={{ pointerEvents: 'all', cursor: 'grab' }}
          onMouseDown={onPointerDown('whole')}
          onTouchStart={onPointerDown('whole')}
        />
        {/* 침핀 핸들 */}
        <circle
          cx={pinX} cy={pinY} r={HANDLE_R}
          fill="#ef4444" stroke="white" strokeWidth="2"
          style={{ pointerEvents: 'all', cursor: 'move' }}
          onMouseDown={onPointerDown('pin')}
          onTouchStart={onPointerDown('pin')}
        />
        {/* 연필 핸들 */}
        <circle
          cx={pencilX} cy={pencilY} r={HANDLE_R}
          fill="#f59e0b" stroke="white" strokeWidth="2"
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
        {/* 반경 레이블 */}
        <text
          x={(pinX + pencilX) / 2}
          y={(pinY + pencilY) / 2 - 8}
          textAnchor="middle" fontSize="13" fill="#1e40af" fontWeight="600"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          r = {Math.round(radius)}px
        </text>
      </svg>

      {/* 컴퍼스 컨트롤 패널 (우측 하단 고정) */}
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
        <p className="text-[11px] text-gray-400 leading-tight">
          🔴 침핀 드래그: 이동<br />
          🟡 연필 드래그: 반경<br />
          ⚫ 힌지 드래그: 전체
        </p>
      </div>
    </>
  )
}
