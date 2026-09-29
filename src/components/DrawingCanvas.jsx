import { useRef, useEffect, useCallback, useState } from 'react'

const RULER_THICKNESS = 120
const SNAP_DIST = 12 // 스냅 반경 축소 (20 -> 12)

function calcRulerSnap(pos, ruler, currentLock) {
  if (!ruler || !ruler.visible) return { pos, lock: null }

  const { x1, y1, x2, y2 } = ruler
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy)

  if (length === 0) return { pos, lock: null }

  const angle = Math.atan2(dy, dx)
  const cos = Math.cos(-angle)
  const sin = Math.sin(-angle)

  // 자의 중심을 원점으로 변환하고 회전
  const tx = pos.x - cx
  const ty = pos.y - cy
  const localX = tx * cos - ty * sin
  const localY = tx * sin + ty * cos

  const halfThick = RULER_THICKNESS / 2

  let snappedY = localY
  let edge = null

  // 드로잉 중이면 기존 스냅 엣지 유지 (자를 벗어나지 않게 고정)
  if (currentLock) {
    edge = currentLock.edge
    snappedY = edge === 'top' ? -halfThick : halfThick
  } else {
    // 처음 드래그 시작 시 스냅 여부 판단
    if (Math.abs(localY - (-halfThick)) < SNAP_DIST) {
      snappedY = -halfThick
      edge = 'top'
    } else if (Math.abs(localY - halfThick) < SNAP_DIST) {
      snappedY = halfThick
      edge = 'bottom'
    }
  }

  if (edge) {
    // X축을 자의 길이에 강제로 가두지 않고 무한선으로 처리하여
    // 마우스의 물리적 X 위치와 포인터가 완벽히 일치하도록 함 (점프 현상 해결)
    const snappedLocalX = localX
    
    // 다시 원래 좌표계로 복구
    const unCos = Math.cos(angle)
    const unSin = Math.sin(angle)
    const globalX = snappedLocalX * unCos - snappedY * unSin + cx
    const globalY = snappedLocalX * unSin + snappedY * unCos + cy
    return { pos: { x: globalX, y: globalY }, lock: { edge } }
  }

  return { pos, lock: null }
}

export default function DrawingCanvas({ canvasRef, activeTool, strokeColor, strokeWidth, onDrawEnd, ruler }) {
  const isDrawing = useRef(false)
  const snapLock = useRef(null)
  const lastPos = useRef({ x: 0, y: 0 })
  const fakeCursorRef = useRef(null)
  const fakePencilLineRef = useRef(null)
  const [isHovering, setIsHovering] = useState(false)

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    let clientX, clientY
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX || 0
      clientY = e.clientY || 0
    }
    const scaleX = canvas.clientWidth / rect.width || 1
    const scaleY = canvas.clientHeight / rect.height || 1
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  const updateFakeCursor = useCallback((pos, snapped) => {
    if (fakeCursorRef.current) {
      fakeCursorRef.current.style.transform = `translate(${pos.x - 2}px, ${pos.y - 22}px)`
    }
    if (fakePencilLineRef.current) {
      // 스냅 시 연필 가운데 선 표시
      fakePencilLineRef.current.style.opacity = snapped ? '1' : '0'
    }
  }, [])

  const handleMove = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rawPos = getPos(e, canvas)
    
    if (isDrawing.current && activeTool === 'pen') {
      e.preventDefault()
      const ctx = canvas.getContext('2d')
      const { pos, lock } = calcRulerSnap(rawPos, ruler, snapLock.current)

      ctx.beginPath()
      ctx.moveTo(lastPos.current.x, lastPos.current.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = strokeWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()

      lastPos.current = pos
      updateFakeCursor(pos, lock !== null)
    } else if (activeTool === 'pen') {
      const { pos, lock } = calcRulerSnap(rawPos, ruler, null)
      updateFakeCursor(pos, lock !== null)
    }
  }, [activeTool, strokeColor, strokeWidth, ruler, updateFakeCursor])

  const startDraw = useCallback((e) => {
    if (activeTool !== 'pen') return
    e.preventDefault()
    isDrawing.current = true
    snapLock.current = null

    // 드로잉 중 툴 오버레이 이벤트 차단
    document.body.classList.add('is-drawing')

    const canvas = canvasRef.current
    const rawPos = getPos(e, canvas)
    const { pos, lock } = calcRulerSnap(rawPos, ruler, null)
    
    snapLock.current = lock
    lastPos.current = pos
    updateFakeCursor(pos, lock !== null)

    // 윈도우 레벨 이벤트 연결로 드래그 끊김 방지
    const onWindowMove = (me) => handleMove(me)
    const onWindowUp = () => {
      if (isDrawing.current) {
        onDrawEnd?.()
      }
      isDrawing.current = false
      snapLock.current = null
      document.body.classList.remove('is-drawing')
      window.removeEventListener('mousemove', onWindowMove)
      window.removeEventListener('mouseup', onWindowUp)
      window.removeEventListener('touchmove', onWindowMove)
      window.removeEventListener('touchend', onWindowUp)
    }
    window.addEventListener('mousemove', onWindowMove)
    window.addEventListener('mouseup', onWindowUp)
    window.addEventListener('touchmove', onWindowMove, { passive: false })
    window.addEventListener('touchend', onWindowUp)
  }, [activeTool, canvasRef, onDrawEnd, ruler, handleMove, updateFakeCursor])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const ctx = canvas.getContext('2d')
      const tmp = document.createElement('canvas')
      tmp.width = canvas.width
      tmp.height = canvas.height
      if (canvas.width > 0 && canvas.height > 0) {
        tmp.getContext('2d').drawImage(canvas, 0, 0)
      }
      canvas.width = parent.clientWidth
      canvas.height = parent.clientHeight
      if (tmp.width > 0 && tmp.height > 0) {
        ctx.drawImage(tmp, 0, 0)
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement)
    return () => ro.disconnect()
  }, [canvasRef])

  return (
    <div 
      className="absolute inset-0 w-full h-full"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => { if (!isDrawing.current) setIsHovering(false) }}
      onMouseMove={handleMove}
      onTouchMove={handleMove}
      onMouseDown={startDraw}
      onTouchStart={startDraw}
      style={{ cursor: activeTool === 'pen' ? 'none' : 'default', touchAction: 'none' }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      
      {activeTool === 'pen' && (isHovering || isDrawing.current) && (
        <div 
          ref={fakeCursorRef} 
          className="absolute top-0 left-0 pointer-events-none drop-shadow-md"
          style={{ zIndex: 9999, willChange: 'transform' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="#1e40af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            <line ref={fakePencilLineRef} x1="18" y1="6" x2="6" y2="18" stroke="#ef4444" strokeWidth="2" style={{ opacity: 0, transition: 'opacity 0.15s' }} />
          </svg>
        </div>
      )}
    </div>
  )
}
