import { useRef, useEffect, useCallback } from 'react'

const RULER_THICKNESS = 60
const SNAP_DIST = 20

function snapToRuler(pos, ruler) {
  if (!ruler || !ruler.visible) return pos

  const { x1, y1, x2, y2 } = ruler
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy)

  if (length === 0) return pos

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
  let snapped = false

  // 위쪽 모서리에 스냅
  if (Math.abs(localY - (-halfThick)) < SNAP_DIST) {
    snappedY = -halfThick
    snapped = true
  }
  // 아래쪽 모서리에 스냅
  else if (Math.abs(localY - halfThick) < SNAP_DIST) {
    snappedY = halfThick
    snapped = true
  }

  if (snapped) {
    // 자의 길이 밖으로 벗어나지 않게 제한
    const snappedLocalX = Math.max(-length / 2, Math.min(length / 2, localX))
    
    // 다시 원래 좌표계로 복구
    const unCos = Math.cos(angle)
    const unSin = Math.sin(angle)
    const globalX = snappedLocalX * unCos - snappedY * unSin + cx
    const globalY = snappedLocalX * unSin + snappedY * unCos + cy
    return { x: globalX, y: globalY }
  }

  return pos
}

export default function DrawingCanvas({ canvasRef, activeTool, strokeColor, strokeWidth, onDrawStart, ruler }) {
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    // 캔버스 크기 비율을 고려 (width=100% 등으로 CSS 크기와 내장 크기가 다를 수 있음)
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    let clientX, clientY
    if (e.touches) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  const startDraw = useCallback((e) => {
    if (activeTool !== 'pen') return
    e.preventDefault()
    isDrawing.current = true
    const canvas = canvasRef.current
    const rawPos = getPos(e, canvas)
    lastPos.current = snapToRuler(rawPos, ruler)
    onDrawStart?.()
  }, [activeTool, canvasRef, onDrawStart, ruler])

  const draw = useCallback((e) => {
    if (!isDrawing.current || activeTool !== 'pen') return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rawPos = getPos(e, canvas)
    const pos = snapToRuler(rawPos, ruler)

    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = strokeWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()

    lastPos.current = pos
  }, [activeTool, canvasRef, strokeColor, strokeWidth, ruler])

  const endDraw = useCallback(() => {
    isDrawing.current = false
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const ctx = canvas.getContext('2d')
      const snapshot = canvas.width > 0 ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null
      canvas.width = parent.clientWidth
      canvas.height = parent.clientHeight
      if (snapshot) ctx.putImageData(snapshot, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement)
    return () => ro.disconnect()
  }, [canvasRef])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ cursor: activeTool === 'pen' ? 'crosshair' : 'default', touchAction: 'none' }}
      onMouseDown={startDraw}
      onMouseMove={draw}
      onMouseUp={endDraw}
      onMouseLeave={endDraw}
      onTouchStart={startDraw}
      onTouchMove={draw}
      onTouchEnd={endDraw}
    />
  )
}
