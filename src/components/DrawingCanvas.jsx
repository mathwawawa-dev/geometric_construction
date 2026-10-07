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
    // localX가 자의 길이 범위 안에 있을 때만 스냅
    if (localX >= -length / 2 && localX <= length / 2) {
      if (Math.abs(localY - (-halfThick)) < SNAP_DIST) {
        snappedY = -halfThick
        edge = 'top'
      } else if (Math.abs(localY - halfThick) < SNAP_DIST) {
        snappedY = halfThick
        edge = 'bottom'
      }
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

function isPointInsideRuler(pos, ruler) {
  if (!ruler || !ruler.visible) return false
  const { x1, y1, x2, y2 } = ruler
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy)
  if (length === 0) return false

  const angle = Math.atan2(dy, dx)
  const cos = Math.cos(-angle)
  const sin = Math.sin(-angle)

  const tx = pos.x - cx
  const ty = pos.y - cy
  const localX = tx * cos - ty * sin
  const localY = tx * sin + ty * cos

  const halfThick = RULER_THICKNESS / 2

  // 자의 실물 범위 (약간의 여유값 -1 고려)
  if (localX >= -length / 2 && localX <= length / 2 && localY > -halfThick + 1 && localY < halfThick - 1) {
    return true
  }
  return false
}

// 점의 중심 및 직선/곡선의 '두께 중심축(위-아래 정중앙)' 자석 스냅 함수
function snapToPointCenters(pos, shapes, snapRadius = 20) {
  const center = snapToShapesCenter(pos, shapes, snapRadius)
  return center ? { pos: center, snappedPoint: true } : { pos, snappedPoint: false }
}

export default function DrawingCanvas({ canvasRef, activeTool, strokeColor, strokeWidth, onDrawEnd, onAddShape, ruler, highlightMode, stampMode, shapes, snapEnabled = true }) {
  const draftCanvasRef = useRef(null)
  const isDrawing = useRef(false)
  const snapLock = useRef(null)
  const currentStrokePoints = useRef([])
  const fakeCursorRef = useRef(null)
  const fakePencilLineRef = useRef(null)
  const lastMousePos = useRef({ x: -9999, y: -9999 })
  const [isHovering, setIsHovering] = useState(false)
  const [isInsideRuler, setIsInsideRuler] = useState(false)
  const isShiftDrawing = useRef(false)
  const startPoint = useRef({ x: 0, y: 0 })
  const initialAngle = useRef(null)
  const ctrlHeld = useRef(false)  // Ctrl 누른 동안 임시 스냅 ON
  const linePinnedPos = useRef(null)       // 선분/펜 커서 끝점 고정용
  const penMouseUpRawPos = useRef(null)    // 펜 Shift: mouseup 실제 위치 (핀 해제 기준)

  // Ctrl 키 상태 추적
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Control') ctrlHeld.current = true }
    const onKeyUp = (e) => { if (e.key === 'Control') ctrlHeld.current = false }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // 텍스트 도구 상태
  const [textEditor, setTextEditor] = useState(null)
  const textInputRef = useRef(null)

  // 선분 도구 상태
  const [lineStart, setLineStart] = useState(null)

  useEffect(() => {
    setLineStart(null)
    const draftCanvas = draftCanvasRef.current
    if (draftCanvas) {
      draftCanvas.getContext('2d').clearRect(0, 0, draftCanvas.width, draftCanvas.height)
    }
  }, [activeTool])

  // 형광펜 굵기/투명도
  const hlWidth = Math.max(strokeWidth * 6, 20)
  const hlAlpha = 0.35

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    let clientX, clientY
    if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX
      clientY = e.changedTouches[0].clientY
    } else if (e.touches && e.touches.length > 0) {
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
      const isStamp = !!stampMode
      const tx = isStamp ? pos.x - 27 : pos.x - 2
      const ty = isStamp ? pos.y - 27 : pos.y - 22
      fakeCursorRef.current.style.transform = `translate(${tx}px, ${ty}px)`
      fakeCursorRef.current.style.display = 'block'
    }
    if (fakePencilLineRef.current) {
      fakePencilLineRef.current.style.opacity = snapped ? '1' : '0'
    }
  }, [stampMode])

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

    // 자 내부 여부 실시간 업데이트 (커서 변경용) - 그리는 중에는 업데이트하지 않음 (스냅 위치에 커서 고정)
    if (!isDrawing.current) {
      setIsInsideRuler(activeTool === 'pen' && isPointInsideRuler(rawPos, ruler))
    }

    if (isDrawing.current && activeTool === 'pen' && !stampMode) {
      e.preventDefault()
      let finalPos = rawPos
      let lock = null
      let isPointSnapped = false

      const isSnapActive = snapEnabled || ctrlHeld.current
      if (isSnapActive) {
        const { pos: rulerSnapped, lock: rLock } = calcRulerSnap(rawPos, ruler, snapLock.current)
        lock = rLock
        finalPos = rulerSnapped
        if (!lock) {
          const pointRes = snapToPointCenters(rulerSnapped, shapes)
          finalPos = pointRes.pos
          isPointSnapped = pointRes.snappedPoint
        }
      }

      if (isPointInsideRuler(finalPos, ruler)) {
        updateFakeCursor(finalPos, false)
        return
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
      let finalPos = rawPos
      let lock = null
      let isPointSnapped = false

      const isSnapActive = snapEnabled || ctrlHeld.current
      if (isSnapActive) {
        const { pos: rulerSnapped, lock: rLock } = calcRulerSnap(rawPos, ruler, null)
        lock = rLock
        finalPos = rulerSnapped
        if (!lock) {
          const pointRes = snapToPointCenters(rulerSnapped, shapes)
          finalPos = pointRes.pos
          isPointSnapped = pointRes.snappedPoint
        }
      }
      // 펜 드래그 완성 후: 마우스가 mouseup 위치에서 30px 이상 움직이기 전까지 끝점 고정
      if (linePinnedPos.current && penMouseUpRawPos.current && !isDrawing.current) {
        const dMoved = Math.hypot(rawPos.x - penMouseUpRawPos.current.x, rawPos.y - penMouseUpRawPos.current.y)
        if (dMoved < 30) {
          updateFakeCursor(linePinnedPos.current, false)
          return
        }
        linePinnedPos.current = null
        penMouseUpRawPos.current = null
      }
      updateFakeCursor(finalPos, lock !== null || isPointSnapped)
    } else if (activeTool === 'line') {
      let finalPos = rawPos
      let lock = null
      let isPointSnapped = false

      const isSnapActive = snapEnabled || ctrlHeld.current
      if (isSnapActive) {
        const { pos: rulerSnapped, lock: rLock } = calcRulerSnap(rawPos, ruler, null)
        lock = rLock
        finalPos = rulerSnapped
        if (!lock) {
          const pointRes = snapToPointCenters(rulerSnapped, shapes)
          finalPos = pointRes.pos
          isPointSnapped = pointRes.snappedPoint
        }
      }

      // Shift 누른 상태: 5도 단위 각도 스냅
      if (lineStart && e.shiftKey) {
        const dx = finalPos.x - lineStart.x
        const dy = finalPos.y - lineStart.y
        const dist = Math.hypot(dx, dy)
        const rawAngle = Math.atan2(dy, dx)
        const step = (5 * Math.PI) / 180
        const snappedAngle = Math.round(rawAngle / step) * step
        finalPos = {
          x: lineStart.x + dist * Math.cos(snappedAngle),
          y: lineStart.y + dist * Math.sin(snappedAngle),
        }
      }

      if (lineStart) {
        const draftCanvas = draftCanvasRef.current
        if (draftCanvas) {
          const ctx = draftCanvas.getContext('2d')
          ctx.clearRect(0, 0, draftCanvas.width, draftCanvas.height)
          ctx.save()
          ctx.globalAlpha = 1
          ctx.strokeStyle = strokeColor
          ctx.fillStyle = strokeColor
          ctx.lineWidth = strokeWidth
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.beginPath()
          ctx.moveTo(lineStart.x, lineStart.y)
          ctx.lineTo(finalPos.x, finalPos.y)
          ctx.stroke()
          const pointR = Math.max(strokeWidth * 0.8, 4)
          ctx.beginPath()
          ctx.arc(lineStart.x, lineStart.y, pointR, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.arc(finalPos.x, finalPos.y, pointR, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }

      // 선분 드래그 완성 후 핀 고정: mouseup 위치에서 30px 이상 움직이기 전까지 끝점에 고정
      if (linePinnedPos.current && penMouseUpRawPos.current && !lineStart) {
        const dMoved = Math.hypot(rawPos.x - penMouseUpRawPos.current.x, rawPos.y - penMouseUpRawPos.current.y)
        if (dMoved < 30) {
          updateFakeCursor(linePinnedPos.current, false)
          return
        }
        linePinnedPos.current = null
        penMouseUpRawPos.current = null
      }

      updateFakeCursor(finalPos, lock !== null || isPointSnapped)
    }
  }, [activeTool, ruler, updateFakeCursor, stampMode, renderCurrentStroke, canvasRef, shapes, snapEnabled, setIsInsideRuler, lineStart, strokeColor, strokeWidth])

  const commitText = useCallback(() => {
    if (!textEditor) return
    const text = textEditor.text.trim()
    if (text) {
      const fontSize = 26
      // 캔버스에 즉시 렌더링 (엔터 치자마자 즉시 보이도록 보장)
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        ctx.save()
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Malgun Gothic", sans-serif`
        ctx.fillStyle = strokeColor
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(text, textEditor.x, textEditor.y)
        ctx.restore()
      }

      const shape = {
        id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        type: 'text',
        text,
        x: textEditor.x,
        y: textEditor.y,
        color: strokeColor,
        fontSize,
      }
      onAddShape?.(shape)
    }
    setTextEditor(null)
  }, [textEditor, strokeColor, onAddShape, onDrawEnd, canvasRef])

  useEffect(() => {
    if (textEditor) {
      setTimeout(() => textInputRef.current?.focus(), 15)
    }
  }, [textEditor])

  const startDraw = useCallback((e) => {
    // 텍스트 도구일 때 클릭으로 텍스트 입력창 열기
    if (activeTool === 'text') {
      if (e.button !== undefined && e.button !== 0) return
      e.preventDefault()
      if (textEditor) {
        commitText()
      }
      const canvas = canvasRef.current
      if (!canvas) return
      const rawPos = getPos(e, canvas)
      setTextEditor({ x: rawPos.x, y: rawPos.y, text: '' })
      return
    }

    if (activeTool === 'line') {
      if (e.button !== undefined && e.button !== 0) return
      e.preventDefault()
      
      const canvas = canvasRef.current
      if (!canvas) return
      const rawPos = getPos(e, canvas)
      
      let finalPos = rawPos
      if (snapEnabled || ctrlHeld.current) {
        const { pos: rulerSnapped, lock: rLock } = calcRulerSnap(rawPos, ruler, null)
        finalPos = rulerSnapped
        if (!rLock) {
          const pointRes = snapToPointCenters(rulerSnapped, shapes)
          finalPos = pointRes.pos
        }
      }

      if (lineStart) {
        // 두 번째 클릭 시 Shift 5도 스냅 적용
        if (e.shiftKey) {
          const dx = finalPos.x - lineStart.x
          const dy = finalPos.y - lineStart.y
          const dist = Math.hypot(dx, dy)
          const rawAngle = Math.atan2(dy, dx)
          const step = (5 * Math.PI) / 180
          const snappedAngle = Math.round(rawAngle / step) * step
          finalPos = {
            x: lineStart.x + dist * Math.cos(snappedAngle),
            y: lineStart.y + dist * Math.sin(snappedAngle),
          }
        }

        // 두 번째 클릭 시 선분 완성
        const shape = {
          id: 'seg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          type: 'segment',
          x1: lineStart.x,
          y1: lineStart.y,
          x2: finalPos.x,
          y2: finalPos.y,
          color: strokeColor,
          width: strokeWidth,
        }
        onAddShape?.(shape)
        setLineStart(null)
        const draftCanvas = draftCanvasRef.current
        if (draftCanvas) {
          draftCanvas.getContext('2d').clearRect(0, 0, draftCanvas.width, draftCanvas.height)
        }
        // Click-Click 완성: 두 번째 클릭의 실제 위치(rawPos) 기준으로 핀 고정
        penMouseUpRawPos.current = rawPos
        linePinnedPos.current = finalPos
        updateFakeCursor(finalPos, false)
      } else {
        // 첫 번째 클릭 시 시작
        linePinnedPos.current = null      // 새 선분 시작 → 핀 해제
        penMouseUpRawPos.current = null   // mouseup 위치 초기화
        setLineStart({ x: finalPos.x, y: finalPos.y })
        isDrawing.current = true
        startPoint.current = { x: finalPos.x, y: finalPos.y }
        
        const onWindowUpLine = (me) => {
          if (!isDrawing.current) return
          isDrawing.current = false
          
          const mainCanvas = canvasRef.current
          if (!mainCanvas) return
          const upPos = getPos(me, mainCanvas)
          
          let finalUpPos = upPos
          if (snapEnabled || ctrlHeld.current) {
            const { pos: rSnap, lock: rL } = calcRulerSnap(upPos, ruler, null)
            finalUpPos = rSnap
            if (!rL) {
              const pr = snapToPointCenters(rSnap, shapes)
              finalUpPos = pr.pos
            }
          }

          // Shift 드래그 시 5도 단위 스냅
          if (me.shiftKey) {
            const dx = finalUpPos.x - startPoint.current.x
            const dy = finalUpPos.y - startPoint.current.y
            const dist = Math.hypot(dx, dy)
            const rawAngle = Math.atan2(dy, dx)
            const step = (5 * Math.PI) / 180
            const snappedAngle = Math.round(rawAngle / step) * step
            finalUpPos = {
              x: startPoint.current.x + dist * Math.cos(snappedAngle),
              y: startPoint.current.y + dist * Math.sin(snappedAngle),
            }
          }
          
          const d = Math.hypot(finalUpPos.x - startPoint.current.x, finalUpPos.y - startPoint.current.y)
          if (d > 5) {
            // 드래그로 그렸음
            const shape = {
              id: 'seg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
              type: 'segment',
              x1: startPoint.current.x,
              y1: startPoint.current.y,
              x2: finalUpPos.x,
              y2: finalUpPos.y,
              color: strokeColor,
              width: strokeWidth,
            }
            onAddShape?.(shape)
            setLineStart(null)
            const draftCanvas = draftCanvasRef.current
            if (draftCanvas) {
              draftCanvas.getContext('2d').clearRect(0, 0, draftCanvas.width, draftCanvas.height)
            }
            // mouseup 실제 위치 저장 + 끝점에 핀 고정
            penMouseUpRawPos.current = upPos
            linePinnedPos.current = finalUpPos
            updateFakeCursor(finalUpPos, false)
          }
          window.removeEventListener('mouseup', onWindowUpLine)
          window.removeEventListener('touchend', onWindowUpLine)
        }
        
        window.addEventListener('mouseup', onWindowUpLine)
        window.addEventListener('touchend', onWindowUpLine)
      }
      return
    }

    if (activeTool !== 'pen') return
    // 우클릭(button=2) / 중간클릭(button=1) 은 드로잉 시작하지 않음 (화면 이동 전용)
    if (e.button !== undefined && e.button !== 0) return
    e.preventDefault()

    const canvas = canvasRef.current
    const rawPos = getPos(e, canvas)

    // 넘버스탬프 클릭
    if (stampMode) {
      if (isPointInsideRuler(rawPos, ruler)) return
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
      return
    }

    isDrawing.current = true
    snapLock.current = null

    document.body.classList.add('is-drawing')

    let finalPos = rawPos
    let lock = null
    let isPointSnapped = false

    if (snapEnabled || ctrlHeld.current) {
      const { pos: rulerSnapped, lock: rLock } = calcRulerSnap(rawPos, ruler, null)
      lock = rLock
      finalPos = rulerSnapped
      if (!lock) {
        const pointRes = snapToPointCenters(rulerSnapped, shapes)
        finalPos = pointRes.pos
        isPointSnapped = pointRes.snappedPoint
      }
    }

    linePinnedPos.current = null      // 새 선 긋기 시작하면 핀 해제
    penMouseUpRawPos.current = null   // mouseup 위치 초기화

    if (isPointInsideRuler(finalPos, ruler)) {
      isDrawing.current = false
      document.body.classList.remove('is-drawing')
      return
    }

    snapLock.current = lock
    isShiftDrawing.current = !!e.shiftKey
    startPoint.current = { x: finalPos.x, y: finalPos.y }
    initialAngle.current = null
    currentStrokePoints.current = [{ x: finalPos.x, y: finalPos.y }]
    renderCurrentStroke()
    updateFakeCursor(finalPos, lock !== null || isPointSnapped)

    const onWindowMove = (me) => handleMove(me)
    const onWindowUp = (upEvent) => {
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
        } else {
          onDrawEnd?.()
        }
      }
      isDrawing.current = false
      const wasShiftDrawing = isShiftDrawing.current
      isShiftDrawing.current = false
      // Shift 직선 모드 OR 일반 드래그 모드: mouseup 위치에서 커서 freeze
      if (currentStrokePoints.current.length > 0) {
        const lastPt = currentStrokePoints.current[currentStrokePoints.current.length - 1]
        const mainCanvas = canvasRef.current
        if (mainCanvas && upEvent) {
          const upRawPos = getPos(upEvent, mainCanvas)
          penMouseUpRawPos.current = upRawPos  // mouseup 실제 위치 저장 (핀 해제 기준)
        }
        linePinnedPos.current = lastPt
        updateFakeCursor(lastPt, false)
      }
      initialAngle.current = null
      snapLock.current = null
      currentStrokePoints.current = []
      document.body.classList.remove('is-drawing')
      // 그리기 종료 후 자 커서 상태 초기화
      setIsInsideRuler(false)
      window.removeEventListener('mousemove', onWindowMove)
      window.removeEventListener('mouseup', onWindowUp)
      window.removeEventListener('touchmove', onWindowMove)
      window.removeEventListener('touchend', onWindowUp)
    }
    window.addEventListener('mousemove', onWindowMove)
    window.addEventListener('mouseup', onWindowUp)
    window.addEventListener('touchmove', onWindowMove, { passive: false })
    window.addEventListener('touchend', onWindowUp)
  }, [activeTool, canvasRef, onDrawEnd, onAddShape, ruler, handleMove, updateFakeCursor, strokeColor, strokeWidth, highlightMode, hlWidth, hlAlpha, stampMode, renderCurrentStroke, shapes, textEditor, commitText, snapEnabled])

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

  useEffect(() => {
    if (activeTool === 'pen' || activeTool === 'line') {
      setIsHovering(true)
      if (fakeCursorRef.current && lastMousePos.current.x > -100) {
        fakeCursorRef.current.style.display = 'block'
      }
    }
  }, [activeTool])

  const isStampMode = activeTool === 'pen' && !!stampMode

  return (
    <div
      className="absolute inset-0 w-full h-full"
      onMouseEnter={(e) => {
        setIsHovering(true)
        const canvas = canvasRef.current
        if (canvas) {
          const p = getPos(e, canvas)
          lastMousePos.current = p
        }
        if (fakeCursorRef.current) fakeCursorRef.current.style.display = 'block'
      }}
      onMouseLeave={() => {
        if (!isDrawing.current && !lineStart) {
          setIsHovering(false)
          if (fakeCursorRef.current) fakeCursorRef.current.style.display = 'none'
        }
      }}
      onMouseMove={handleMove}
      onTouchMove={handleMove}
      onMouseDown={startDraw}
      onTouchStart={startDraw}
      style={{
        cursor: (activeTool === 'pen' || activeTool === 'line')
          ? (isInsideRuler ? 'grab' : 'none')
          : (activeTool === 'text' ? 'text' : 'default'),
        touchAction: 'none',
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      <canvas ref={draftCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* 텍스트 입력 에디터 */}
      {textEditor && (
        <div
          style={{
            position: 'absolute',
            left: textEditor.x,
            top: textEditor.y,
            zIndex: 1000,
            pointerEvents: 'all',
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            ref={textInputRef}
            type="text"
            value={textEditor.text}
            placeholder="텍스트 입력 (Enter 완료, Esc 취소)"
            onChange={(e) => setTextEditor(prev => prev ? { ...prev, text: e.target.value } : null)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') {
                e.preventDefault()
                commitText()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setTextEditor(null)
              }
            }}
            onBlur={commitText}
            style={{
              fontSize: 26,
              fontWeight: 'bold',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Malgun Gothic", sans-serif',
              color: strokeColor,
              background: 'rgba(255, 255, 255, 0.95)',
              border: '2px dashed #2563eb',
              borderRadius: 4,
              padding: '4px 8px',
              outline: 'none',
              minWidth: 140,
              boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
            }}
          />
        </div>
      )}

      {(activeTool === 'pen' || activeTool === 'line') && isHovering && !isInsideRuler && (
        <div
          id="fake-pen-cursor"
          ref={fakeCursorRef}
          className="absolute top-0 left-0 pointer-events-none drop-shadow-md"
          style={{
            zIndex: 9999,
            willChange: 'transform',
            transform: (() => {
              if (lastMousePos.current.x <= -100) return 'none'
              if (isStampMode) {
                // 스탬프: 문자 중앙이 포인터에 오도록 (fontSize 53 → 절반 ~26.5)
                return `translate(${lastMousePos.current.x - 27}px, ${lastMousePos.current.y - 27}px)`
              }
              return `translate(${lastMousePos.current.x - 2}px, ${lastMousePos.current.y - 22}px)`
            })(),
            display: lastMousePos.current.x > -100 ? 'block' : 'none',
          }}
        >
          {isStampMode ? (
            <div style={{ fontSize: 53, lineHeight: 1, userSelect: 'none', opacity: 0.75 }}>
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
