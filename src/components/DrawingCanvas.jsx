import { useRef, useEffect, useCallback, useState } from 'react'
import { snapToShapesCenter, snapToSegmentEndpoint } from '../utils/shapeUtils'

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
  const lastMousePos = useRef({ x: -9999, y: -9999 })
  const [isInsideRuler, setIsInsideRuler] = useState(false)
  const [isNearShape, setIsNearShape] = useState(false)
  const isNearShapeRef = useRef(false)  // re-render 최소화용 ref
  const isShiftDrawing = useRef(false)
  const startPoint = useRef({ x: 0, y: 0 })
  const initialAngle = useRef(null)

  // 펜 스냅 가짜 커서 (snap point에 달라붙는 연필 div)
  const fakeCursorPenRef = useRef(null)     // 가짜 커서 div ref
  const [snapCursorActive, setSnapCursorActive] = useState(false)  // 실제 커서 숨기기용
  const snapCursorActiveRef = useRef(false) // re-render 최소화용 ref
  const latchedSnapPosRef = useRef(null)    // Ctrl 놓은 뒤에도 snap 유지 (latch)

  // Ctrl 키 상태 → 펜 커서 SVG 교체용 (스냅 로직은 e.ctrlKey 직접 사용)
  const [ctrlActive, setCtrlActive] = useState(false)
  useEffect(() => {
    const down = (e) => { if (e.key === 'Control') setCtrlActive(true) }
    const up   = (e) => { if (e.key === 'Control') setCtrlActive(false) }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup',   up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup',   up)
    }
  }, [])

  // handleMove를 항상 최신 참조로 유지하는 ref
  // → 펜 도구용 persistent window 리스너에서 stale closure 방지
  const handleMoveRef = useRef(null)

  // shapes를 항상 최신 참조로 유지하는 ref
  // → handleMove/startDraw deps에서 shapes 제거 목적
  //   (shapes 변경 시 handleMove가 재생성되지 않아 mouseup 후 freeze 방지)
  const shapesRef = useRef(shapes)
  shapesRef.current = shapes  // 매 렌더마다 즉시 동기화 (useEffect 불필요)

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
      // 손 커서 감지: 선분 끝점 또는 단일점(점 개체)에 가까울 때만 활성
      // 선분 몸통·스트로크 몸통은 제외 (지오지브라 방식)
      const CURSOR_R = 12
      const nearEndpoint = !!snapToSegmentEndpoint(rawPos, shapesRef.current, CURSOR_R)
      const nearDot = shapesRef.current.some(s =>
        s.type === 'stroke' && s.points?.length === 1 &&
        Math.hypot(rawPos.x - s.points[0].x, rawPos.y - s.points[0].y) <= CURSOR_R
      )
      const near = nearEndpoint || nearDot
      if (near !== isNearShapeRef.current) {
        isNearShapeRef.current = near
        setIsNearShape(near)
      }
    }

    if (isDrawing.current && activeTool === 'pen' && !stampMode) {
      e.preventDefault()
      let finalPos = rawPos
      let lock = null

      const isSnapActive = snapEnabled || e.ctrlKey
      if (isSnapActive) {
        const { pos: rulerSnapped, lock: rLock } = calcRulerSnap(rawPos, ruler, snapLock.current)
        lock = rLock
        finalPos = rulerSnapped
        if (!lock) {
          const pointRes = snapToPointCenters(rulerSnapped, shapesRef.current)
          finalPos = pointRes.pos
        }
      }

      if (isPointInsideRuler(finalPos, ruler)) return

      // Shift: 직선 드로잉 (각도 고정)
      const isShift = e.shiftKey || isShiftDrawing.current
      if (isShift && !lock) {
        const p0 = startPoint.current
        const p1 = finalPos
        const d = Math.hypot(p1.x - p0.x, p1.y - p0.y)
        if (initialAngle.current === null && d >= 6) {
          initialAngle.current = Math.atan2(p1.y - p0.y, p1.x - p0.x)
        }
        if (initialAngle.current !== null) {
          const ang = initialAngle.current
          const ux = Math.cos(ang), uy = Math.sin(ang)
          const proj = (p1.x - p0.x) * ux + (p1.y - p0.y) * uy
          currentStrokePoints.current = [p0, { x: p0.x + proj * ux, y: p0.y + proj * uy }]
        } else {
          currentStrokePoints.current = [p0, p1]
        }
        renderCurrentStroke()
        return
      }

      currentStrokePoints.current.push({ x: finalPos.x, y: finalPos.y })
      renderCurrentStroke()
    } else if (activeTool === 'line') {
      let finalPos = rawPos
      let lock = null

      const isSnapActive = snapEnabled || e.ctrlKey
      if (isSnapActive) {
        const { pos: rulerSnapped, lock: rLock } = calcRulerSnap(rawPos, ruler, null)
        lock = rLock
        finalPos = rulerSnapped
        if (!lock) {
          const pointRes = snapToPointCenters(rulerSnapped, shapesRef.current)
          finalPos = pointRes.pos
        }
      }

      // Shift: 5도 단위 각도 스냅
      if (lineStart && e.shiftKey) {
        const dx = finalPos.x - lineStart.x
        const dy = finalPos.y - lineStart.y
        const dist = Math.hypot(dx, dy)
        const snappedAngle = Math.round(Math.atan2(dy, dx) / (5 * Math.PI / 180)) * (5 * Math.PI / 180)
        finalPos = {
          x: lineStart.x + dist * Math.cos(snappedAngle),
          y: lineStart.y + dist * Math.sin(snappedAngle),
        }
      }

      // 선분 끝점 항상-스냅: snapEnabled 무관, 8px 반경 내 선분 끝점에 흡착 (지오지브라 방식)
      const epSnap = snapToSegmentEndpoint(rawPos, shapesRef.current, 8)
      if (epSnap) finalPos = epSnap

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
    } else if (!isDrawing.current && activeTool === 'pen') {
      // 펜 idle 상태에서 스냅 활성 시 → 스냅 포인트 인디케이터 표시 (v0.2.06 재현)
      const isSnapActive = snapEnabled || e.ctrlKey
      let foundSnapPos = null

      if (isSnapActive) {
        // Ctrl/snap 활성: 새 snap 포인트 계산
        const { pos: rulerSnapped, lock: rLock } = calcRulerSnap(rawPos, ruler, null)
        if (!rLock) {
          const pointRes = snapToPointCenters(rulerSnapped, shapesRef.current)
          if (pointRes.snappedPoint) foundSnapPos = pointRes.pos
        } else {
          foundSnapPos = rulerSnapped
        }
        // latch 갱신 (snap 발견 시 저장, 없으면 해제)
        latchedSnapPosRef.current = foundSnapPos || null
      } else if (latchedSnapPosRef.current) {
        // Ctrl/snap 비활성이지만 latch된 위치 있음
        // → 마우스가 20px 이내이면 latch 유지 (사용자가 놓은 snap 위치 고정)
        const latched = latchedSnapPosRef.current
        const d = Math.hypot(rawPos.x - latched.x, rawPos.y - latched.y)
        if (d <= 20) {
          foundSnapPos = latched  // latch 유지
        } else {
          latchedSnapPosRef.current = null  // 멀어지면 자동 해제
        }
      }

      // 가짜 커서 위치 업데이트 (DOM 직접 조작 — re-render 없이 이동)
      if (fakeCursorPenRef.current) {
        if (foundSnapPos) {
          fakeCursorPenRef.current.style.transform = `translate(${foundSnapPos.x - 2}px, ${foundSnapPos.y - 22}px)`
          fakeCursorPenRef.current.style.display = 'block'
        } else {
          fakeCursorPenRef.current.style.display = 'none'
        }
      }
      // 실제 커서 숨김 여부 (re-render은 on/off 전환 시 2회만 발생)
      const shouldHide = !!foundSnapPos
      if (shouldHide !== snapCursorActiveRef.current) {
        snapCursorActiveRef.current = shouldHide
        setSnapCursorActive(shouldHide)
      }
    }
  }, [activeTool, ruler, stampMode, renderCurrentStroke, canvasRef, snapEnabled, setIsInsideRuler, lineStart, strokeColor, strokeWidth])

  // handleMove가 재생성될 때마다 ref 동기화
  handleMoveRef.current = handleMove

  // 펜 도구 활성화 중: 캔버스 안/밖 전역에서 네이티브 이벤트로 가짜 커서 추적
  // → React 합성 이벤트(onMouseMove) 대신 네이티브 window 이벤트 사용으로 지연 제거
  useEffect(() => {
    if (activeTool !== 'pen') return
    const track = (e) => {
      if (!isDrawing.current) {
        handleMoveRef.current?.(e)
      }
    }
    window.addEventListener('mousemove', track)
    return () => window.removeEventListener('mousemove', track)
  }, [activeTool])

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
      if (snapEnabled || e.ctrlKey) {
        const { pos: rulerSnapped, lock: rLock } = calcRulerSnap(rawPos, ruler, null)
        finalPos = rulerSnapped
        if (!rLock) {
          const pointRes = snapToPointCenters(rulerSnapped, shapesRef.current)
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

        // 선분 끝점 항상-스냅 (8px, 최우선)
        const ep2 = snapToSegmentEndpoint(rawPos, shapesRef.current, 8)
        if (ep2) finalPos = ep2

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
      } else {
        // 첫 번째 클릭 시 시작 — 선분 끝점 항상-스냅 (8px)
        const ep1 = snapToSegmentEndpoint(rawPos, shapesRef.current, 8)
        if (ep1) finalPos = ep1
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
          if (snapEnabled || me.ctrlKey) {
            const { pos: rSnap, lock: rL } = calcRulerSnap(upPos, ruler, null)
            finalUpPos = rSnap
            if (!rL) {
              const pr = snapToPointCenters(rSnap, shapesRef.current)
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

          // 선분 끝점 항상-스냅 (8px, 최우선)
          const epDrag = snapToSegmentEndpoint(upPos, shapesRef.current, 8)
          if (epDrag) finalUpPos = epDrag
          
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

    // 드로잉 시작 시 스냅 가짜 커서 숨김
    if (fakeCursorPenRef.current) fakeCursorPenRef.current.style.display = 'none'
    if (snapCursorActiveRef.current) { snapCursorActiveRef.current = false; setSnapCursorActive(false) }

    let finalPos = rawPos
    let lock = null
    let isPointSnapped = false

    // latch된 snap 위치 우선 사용 (Ctrl 놓은 뒤에도 고정된 위치)
    if (latchedSnapPosRef.current) {
      finalPos = latchedSnapPosRef.current
      isPointSnapped = true
      latchedSnapPosRef.current = null
    } else if (snapEnabled || e.ctrlKey) {
      const { pos: rulerSnapped, lock: rLock } = calcRulerSnap(rawPos, ruler, null)
      lock = rLock
      finalPos = rulerSnapped
      if (!lock) {
        const pointRes = snapToPointCenters(rulerSnapped, shapesRef.current)
        finalPos = pointRes.pos
        isPointSnapped = pointRes.snappedPoint
      }
    }

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
      isShiftDrawing.current = false
      initialAngle.current = null
      snapLock.current = null
      currentStrokePoints.current = []
      document.body.classList.remove('is-drawing')
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
  }, [activeTool, canvasRef, onDrawEnd, onAddShape, ruler, handleMove, strokeColor, strokeWidth, highlightMode, hlWidth, hlAlpha, stampMode, renderCurrentStroke, textEditor, commitText, snapEnabled])

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

  // 펜 도구 연필 SVG 커서 — 평상시
  const penSvgCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' fill='white' stroke='%231e40af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") 2 22, crosshair`

  // 펜 도구 연필 SVG 커서 — 스냅 활성 시 (빨간 선 추가)
  const penSnapCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' fill='white' stroke='%231e40af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cline x1='18' y1='6' x2='6' y2='18' stroke='%23ef4444' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") 2 22, crosshair`

  const getCursorStyle = () => {
    if (activeTool === 'pen') {
      if (isInsideRuler) return 'grab'
      if (snapCursorActive) return 'none'   // 스냅 가짜 커서 표시 중 → 실제 커서 숨김
      return (snapEnabled || ctrlActive) ? penSnapCursor : penSvgCursor
    }
    if (activeTool === 'line') {
      if (isInsideRuler) return 'grab'
      if (isNearShape) return 'pointer'   // 개체 근처 → 손 커서
      return 'default'                     // 평상시 → 화살표
    }
    if (activeTool === 'text') return 'text'
    return 'default'
  }

  return (
    <div
      className="absolute inset-0 w-full h-full"
      onMouseMove={handleMove}
      onTouchMove={handleMove}
      onMouseDown={startDraw}
      onTouchStart={startDraw}
      style={{
        cursor: getCursorStyle(),
        touchAction: 'none',
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      <canvas ref={draftCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* 펜 스냅 가짜 커서: Ctrl/M 활성 시 snap 포인트에 달라붙는 연필 SVG */}
      <div
        ref={fakeCursorPenRef}
        style={{ display: 'none', position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 50 }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" fill="white" stroke="#1e40af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="18" y1="6" x2="6" y2="18" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>

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
    </div>
  )
}
