import { useRef, useEffect, useCallback, useState } from 'react'
import { snapToShapesCenter } from '../utils/shapeUtils'

const RULER_THICKNESS = 120
const SNAP_DIST = 12

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

  const tx = pos.x - cx
  const ty = pos.y - cy
  const localX = tx * cos - ty * sin
  const localY = tx * sin + ty * cos

  const halfThick = RULER_THICKNESS / 2

  let snappedY = localY
  let edge = null

  if (currentLock) {
    edge = currentLock.edge
    snappedY = edge === 'top' ? -halfThick : halfThick
  } else {
    if (Math.abs(localY - (-halfThick)) < SNAP_DIST) {
      snappedY = -halfThick
      edge = 'top'
    } else if (Math.abs(localY - halfThick) < SNAP_DIST) {
      snappedY = halfThick
      edge = 'bottom'
    }
  }

  if (edge) {
    const snappedLocalX = localX
    const unCos = Math.cos(angle)
    const unSin = Math.sin(angle)
    const globalX = snappedLocalX * unCos - snappedY * unSin + cx
    const globalY = snappedLocalX * unSin + snappedY * unCos + cy
    return { pos: { x: globalX, y: globalY }, lock: { edge } }
  }

  return { pos, lock: null }
}

// 점의 중심 및 직선/곡선의 '두께 중심축(위-아래 정중앙)' 자석 스냅 함수
function snapToPointCenters(pos, shapes, snapRadius = 20) {
  const center = snapToShapesCenter(pos, shapes, snapRadius)
  return center ? { pos: center, snappedPoint: true } : { pos, snappedPoint: false }
}

export default function DrawingCanvas({ canvasRef, activeTool, strokeColor, strokeWidth, onDrawEnd, onAddShape, ruler, highlightMode, stampMode, shapes }) {
  const draftCanvasRef = useRef(null)
  const isDrawing = useRef(false)
  const snapLock = useRef(null)
  const currentStrokePoints = useRef([])
  const fakeCursorRef = useRef(null)
  const fakePencilLineRef = useRef(null)
  const lastMousePos = useRef({ x: -9999, y: -9999 })
  const [isHovering, setIsHovering] = useState(false)
  const isShiftDrawing = useRef(false)
  const startPoint = useRef({ x: 0, y: 0 })
  const initialAngle = useRef(null)

  // 형광펜 굵기/투명도
  const hlWidth = Math.max(strokeWidth * 6, 20)
  const hlAlpha = 0.35

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
    lastMousePos.current = pos
    if (fakeCursorRef.current) {
      fakeCursorRef.current.style.transform = `translate(${pos.x - 2}px, ${pos.y - 22}px)`
      fakeCursorRef.current.style.display = 'block'
    }
    if (fakePencilLineRef.current) {
      fakePencilLineRef.current.style.opacity = snapped ? '1' : '0'
    }
  }, [])

  // 드래프트 캔버스에 현재 스트로크 단일 경로로 렌더링 (동그라미 겹침 방지)
  const renderCurrentStroke = useCallback(() => {
    const draftCanvas = draftCanvasRef.current
    if (!draftCanvas) return
    const ctx = draftCanvas.getContext('2d')
    ctx.clearRect(0, 0, draftCanvas.width, draftCanvas.height)

    const pts = currentStrokePoints.current
    if (!pts || pts.length === 0) return

    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalAlpha = highlightMode ? hlAlpha : 1
    ctx.fillStyle = strokeColor
    ctx.strokeStyle = strokeColor
    const curWidth = highlightMode ? hlWidth : strokeWidth
    ctx.lineWidth = curWidth

    if (pts.length === 1) {
      const r = Math.max(curWidth * 0.8, 4)
      ctx.beginPath()
      ctx.arc(pts[0].x, pts[0].y, r, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y)
      }
      ctx.stroke()
    }
    ctx.restore()
  }, [highlightMode, hlAlpha, hlWidth, strokeColor, strokeWidth])

  const handleMove = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rawPos = getPos(e, canvas)
    lastMousePos.current = rawPos

    if (isDrawing.current && activeTool === 'pen' && !stampMode) {
      e.preventDefault()
      const { pos: rulerSnapped, lock } = calcRulerSnap(rawPos, ruler, snapLock.current)
      let finalPos = rulerSnapped
      let isPointSnapped = false
      if (!lock) {
        const pointRes = snapToPointCenters(rulerSnapped, shapes)
        finalPos = pointRes.pos
        isPointSnapped = pointRes.snappedPoint
      }

      // Shift 키를 누른 상태이거나 Shift로 시작한 직선 드로잉인 경우 (첫 시작 방향 각도 유지)
      const isShift = e.shiftKey || isShiftDrawing.current
      if (isShift && !lock) {
        const p0 = startPoint.current
        const p1 = finalPos
        const d = Math.hypot(p1.x - p0.x, p1.y - p0.y)

        // 6px 이상 움직였을 때 첫 시작 방향(각도) 고정
        if (initialAngle.current === null && d >= 6) {
          initialAngle.current = Math.atan2(p1.y - p0.y, p1.x - p0.x)
        }

        if (initialAngle.current !== null) {
          const ang = initialAngle.current
          const ux = Math.cos(ang)
          const uy = Math.sin(ang)
          const proj = (p1.x - p0.x) * ux + (p1.y - p0.y) * uy
          const straightPos = { x: p0.x + proj * ux, y: p0.y + proj * uy }
          currentStrokePoints.current = [p0, straightPos]
          renderCurrentStroke()
          updateFakeCursor(straightPos, isPointSnapped)
          return
        } else {
          currentStrokePoints.current = [p0, p1]
          renderCurrentStroke()
          updateFakeCursor(finalPos, isPointSnapped)
          return
        }
      }

      currentStrokePoints.current.push({ x: finalPos.x, y: finalPos.y })
      renderCurrentStroke()
      updateFakeCursor(finalPos, lock !== null || isPointSnapped)
    } else if (activeTool === 'pen') {
      const { pos: rulerSnapped, lock } = calcRulerSnap(rawPos, ruler, null)
      let finalPos = rulerSnapped
      let isPointSnapped = false
      if (!lock) {
        const pointRes = snapToPointCenters(rulerSnapped, shapes)
        finalPos = pointRes.pos
        isPointSnapped = pointRes.snappedPoint
      }
      updateFakeCursor(finalPos, lock !== null || isPointSnapped)
    }
  }, [activeTool, ruler, updateFakeCursor, stampMode, renderCurrentStroke, canvasRef, shapes])

  const startDraw = useCallback((e) => {
    if (activeTool !== 'pen') return
    // 우클릭(button=2) / 중간클릭(button=1) 은 드로잉 시작하지 않음 (화면 이동 전용)
    if (e.button !== undefined && e.button !== 0) return
    e.preventDefault()

    const canvas = canvasRef.current
    const rawPos = getPos(e, canvas)

    // 넘버스탬프 클릭 (기존 48에서 5만큼 키운 53px)
    if (stampMode) {
      const ctx = canvas.getContext('2d')
      const fontSize = 53
      ctx.save()
      ctx.font = `bold ${fontSize}px serif`
      ctx.fillStyle = strokeColor
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(stampMode, rawPos.x, rawPos.y)
      ctx.restore()
      const shape = {
        id: 'st_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        type: 'stamp',
        char: stampMode,
        x: rawPos.x,
        y: rawPos.y,
        color: strokeColor,
        fontSize,
      }
      onAddShape?.(shape)
      onDrawEnd?.()
      return
    }

    isDrawing.current = true
    snapLock.current = null

    document.body.classList.add('is-drawing')

    const { pos: rulerSnapped, lock } = calcRulerSnap(rawPos, ruler, null)
    let finalPos = rulerSnapped
    let isPointSnapped = false
    if (!lock) {
      const pointRes = snapToPointCenters(rulerSnapped, shapes)
      finalPos = pointRes.pos
      isPointSnapped = pointRes.snappedPoint
    }

    snapLock.current = lock
    isShiftDrawing.current = !!e.shiftKey
    startPoint.current = { x: finalPos.x, y: finalPos.y }
    initialAngle.current = null
    currentStrokePoints.current = [{ x: finalPos.x, y: finalPos.y }]
    renderCurrentStroke()
    updateFakeCursor(finalPos, lock !== null || isPointSnapped)

    const onWindowMove = (me) => handleMove(me)
    const onWindowUp = () => {
      if (isDrawing.current) {
        const draftCanvas = draftCanvasRef.current
        const mainCanvas = canvasRef.current
        if (draftCanvas && mainCanvas) {
          const mainCtx = mainCanvas.getContext('2d')
          mainCtx.drawImage(draftCanvas, 0, 0)
          const draftCtx = draftCanvas.getContext('2d')
          draftCtx.clearRect(0, 0, draftCanvas.width, draftCanvas.height)
        }

        if (currentStrokePoints.current.length >= 1) {
          const shape = {
            id: 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            type: 'stroke',
            color: strokeColor,
            width: highlightMode ? hlWidth : strokeWidth,
            alpha: highlightMode ? hlAlpha : 1,
            points: [...currentStrokePoints.current],
          }
          onAddShape?.(shape)
        }
        onDrawEnd?.()
      }
      isDrawing.current = false
      isShiftDrawing.current = false
      initialAngle.current = null
      snapLock.current = null
      currentStrokePoints.current = []
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
  }, [activeTool, canvasRef, onDrawEnd, onAddShape, ruler, handleMove, updateFakeCursor, strokeColor, strokeWidth, highlightMode, hlWidth, hlAlpha, stampMode, renderCurrentStroke, shapes])

  useEffect(() => {
    const canvas = canvasRef.current
    const draftCanvas = draftCanvasRef.current
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
      if (draftCanvas) {
        draftCanvas.width = parent.clientWidth
        draftCanvas.height = parent.clientHeight
      }
      if (tmp.width > 0 && tmp.height > 0) {
        ctx.drawImage(tmp, 0, 0)
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement)
    return () => ro.disconnect()
  }, [canvasRef])

  const isStampMode = activeTool === 'pen' && !!stampMode

  return (
    <div
      className="absolute inset-0 w-full h-full"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => { if (!isDrawing.current) setIsHovering(false) }}
      onMouseMove={handleMove}
      onTouchMove={handleMove}
      onMouseDown={startDraw}
      onTouchStart={startDraw}
      style={{
        cursor: activeTool === 'pen' ? 'none' : 'default',
        touchAction: 'none',
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      <canvas ref={draftCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {activeTool === 'pen' && isHovering && lastMousePos.current.x > -100 && (
        <div
          ref={fakeCursorRef}
          className="absolute top-0 left-0 pointer-events-none drop-shadow-md"
          style={{
            zIndex: 9999,
            willChange: 'transform',
            transform: `translate(${lastMousePos.current.x - 2}px, ${lastMousePos.current.y - 22}px)`,
          }}
        >
          {isStampMode ? (
            <div style={{ fontSize: 41, lineHeight: 1, userSelect: 'none', opacity: 0.75 }}>
              {stampMode}
            </div>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
              fill={highlightMode ? 'rgba(250,204,21,0.6)' : 'white'}
              stroke={highlightMode ? '#ca8a04' : '#1e40af'}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              <line ref={fakePencilLineRef} x1="18" y1="6" x2="6" y2="18" stroke="#ef4444" strokeWidth="2" style={{ opacity: 0, transition: 'opacity 0.15s' }} />
            </svg>
          )}
        </div>
      )}
    </div>
  )
}
