import { useRef, useCallback, useState, useEffect } from 'react'
import { snapToShapesCenter } from '../utils/shapeUtils'

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
  if (localX < -length / 2 || localX > length / 2) return p
  const snapDist = 15
  const unCos = Math.cos(angle)
  const unSin = Math.sin(angle)
  if (Math.abs(localY - (-halfThick)) < snapDist)
    return { x: localX * unCos - (-halfThick) * unSin + cx, y: localX * unSin + (-halfThick) * unCos + cy }
  if (Math.abs(localY - halfThick) < snapDist)
    return { x: localX * unCos - halfThick * unSin + cx, y: localX * unSin + halfThick * unCos + cy }
  return p
}

function snapToDrawing(p, canvasRef, shapes = [], snapRadius = 22) {
  // 1. 점 중심 및 직선/곡선/원의 '두께 중심축(위-아래 정중앙)' 최우선 자석 스냅
  const centerSnap = snapToShapesCenter(p, shapes, snapRadius)
  if (centerSnap) {
    return centerSnap
  }

  // 2. 픽셀 기반 스캔 스냅 (선분, 호 등 fallback)
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

// arc 그리기 헬퍼: 최단 각도 방향(ccw 여부) 판별 및 원의 일부만 잉크처럼 부드럽게 증분 그리기
function drawArcSegment(canvas, pinX, pinY, fromAngle, toAngle, r, strokeColor, strokeWidth) {
  if (!canvas || r < 1) return
  let diff = toAngle - fromAngle
  while (diff < -Math.PI) diff += 2 * Math.PI
  while (diff > Math.PI) diff -= 2 * Math.PI
  // 0.0002rad 이하이거나 90도 이상 점프(이상치)인 경우 생략
  if (Math.abs(diff) < 0.0002 || Math.abs(diff) > Math.PI / 2) return

  const ctx = canvas.getContext('2d')
  ctx.beginPath()
  const ccw = diff < 0
  ctx.arc(pinX, pinY, r, fromAngle, toAngle, ccw)
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = strokeWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()
}

export default function CompassTool({ compass, setCompass, canvasRef, strokeColor, strokeWidth, onDraw, ruler, onInteractionEnd, onAddShape, shapes, snapEnabled = true, onCursorUpdate }) {
  const svgRef = useRef(null)
  const dragging = useRef(null)
  // dragOffset: 모든 드래그 파트에서 점프 방지용 공용 저장소
  const dragOffset = useRef({})
  const prevAngleRef = useRef(null)
  const legArcPoints = useRef([])
  // 드래그 중 실제 컴포넌트 위치에 커서 고정
  const [dragCursor, setDragCursor] = useState(null) // { x, y, type } | null

  useEffect(() => {
    return () => {
      document.body.style.cursor = ''
    }
  }, [])

  const rawPinX = compass.pinX
  const rawPinY = compass.pinY
  const rawPencilX = compass.pencilX
  const rawPencilY = compass.pencilY
  const pinX = (typeof rawPinX === 'number' && !isNaN(rawPinX)) ? rawPinX : 400
  const pinY = (typeof rawPinY === 'number' && !isNaN(rawPinY)) ? rawPinY : 380
  const pencilX = (typeof rawPencilX === 'number' && !isNaN(rawPencilX)) ? rawPencilX : 550
  const pencilY = (typeof rawPencilY === 'number' && !isNaN(rawPencilY)) ? rawPencilY : 380
  const { radiusInput, hingeSide = 1 } = compass
  const radius = dist(pinX, pinY, pencilX, pencilY)

  // 힌지 위치: 수직 방향 (dy/span, -dx/span) * hingeSide (더블클릭 교체 시 힌지 위치 불변 유지)
  const midX = (pinX + pencilX) / 2
  const midY = (pinY + pencilY) / 2
  const dxMain = pencilX - pinX
  const dyMain = pencilY - pinY
  const span = Math.hypot(dxMain, dyMain) || 1
  const halfDist = radius / 2
  const legLength = Math.max(280, halfDist + 60)
  const compassHeight = Math.sqrt(Math.max(0, legLength ** 2 - halfDist ** 2))
  
  const nx = (dyMain / span) * hingeSide
  const ny = (-dxMain / span) * hingeSide
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
    // whole/pencil/clamp/leg 드래그 중에는 OS 커서 숨기기
    if (part === 'whole' || part === 'pencil' || part === 'clamp' || part === 'leg') {
      document.body.style.cursor = 'none'
    }

    if (part === 'pin_top') {
      // 전체 이동: 클릭 지점과 핀 사이 오프셋 보존
      dragOffset.current = { dx: pos.x - pinX, dy: pos.y - pinY }
    } else if (part === 'pin_bottom') {
      // 침핀 바늘 조절: 연필 고정, 침핀 이동 (클릭 위치 오프셋 완벽 보존)
      const curPinAngle = Math.atan2(pinY - pencilY, pinX - pencilX)
      const curDistFromPencil = Math.hypot(pinX - pencilX, pinY - pencilY)
      const clickAngle = Math.atan2(pos.y - pencilY, pos.x - pencilX)
      const clickDist = Math.hypot(pos.x - pencilX, pos.y - pencilY)
      dragOffset.current = {
        angleOffset: curPinAngle - clickAngle,
        distOffset: curDistFromPencil - clickDist,
      }
    } else if (part === 'whole') {
      // 힌지: 절대 각도 기준 회전 (진동 없음)
      dragOffset.current = {
        initMouseAngle: Math.atan2(pos.y - pinY, pos.x - pinX),
        initPencilAngle: Math.atan2(pencilY - pinY, pencilX - pinX),
      }
      setDragCursor({ x: hingeX, y: hingeY, type: 'whole' })
    } else if (part === 'pencil' || part === 'clamp') {
      // 연필/클램프: 반지름 및 각도 조절 (클릭한 위치가 마우스 포인터에 100% 밀착하여 튕김/멀어짐 원천 차단)
      const curPencilAngle = Math.atan2(pencilY - pinY, pencilX - pinX)
      const curDistFromPin = Math.hypot(pencilX - pinX, pencilY - pinY)
      const clickAngle = Math.atan2(pos.y - pinY, pos.x - pinX)
      const clickDist = Math.hypot(pos.x - pinX, pos.y - pinY)
      dragOffset.current = {
        angleOffset: curPencilAngle - clickAngle,
        distOffset: curDistFromPin - clickDist,
      }
      setDragCursor({ x: pencilX, y: pencilY, type: 'pencil' })
    } else if (part === 'leg') {
      // 은색 다리 드래그: 회전 및 원 호 그리기 (반지름 고정, 클릭 각도 오프셋 보존하여 튐 방지)
      const curPencilAngle = Math.atan2(pencilY - pinY, pencilX - pinX)
      const clickAngle = Math.atan2(pos.y - pinY, pos.x - pinX)
      const clickDist = Math.hypot(pos.x - pinX, pos.y - pinY)
      dragOffset.current = {
        angleOffset: curPencilAngle - clickAngle,
        fixedRadius: radius,
        startAngle: curPencilAngle,
        lastAngle: curPencilAngle,
        totalAngleTraveled: 0,
        minAccumulated: 0,
        maxAccumulated: 0,
        clickDist,
      }
      setDragCursor({ x: pos.x, y: pos.y, type: 'leg' })
      prevAngleRef.current = curPencilAngle
      legArcPoints.current = [{ x: pencilX, y: pencilY }]
    }

    const onMove = (me) => {
      me.preventDefault()
      const rawP = getSVGPos(me)

      if (dragging.current === 'pin_top') {
        const targetPinX = rawP.x - dragOffset.current.dx
        const targetPinY = rawP.y - dragOffset.current.dy
        const candidate = { x: targetPinX, y: targetPinY }
        const snapped = snapEnabled ? snapToDrawing(snapPointToRuler(candidate, ruler), canvasRef, shapes) : candidate
        const pdx = pencilX - pinX, pdy = pencilY - pinY
        setCompass({ pinX: snapped.x, pinY: snapped.y, pencilX: snapped.x + pdx, pencilY: snapped.y + pdy })
      } else if (dragging.current === 'pin_bottom') {
        const curMouseAngle = Math.atan2(rawP.y - pencilY, rawP.x - pencilX)
        const curMouseDist = Math.hypot(rawP.x - pencilX, rawP.y - pencilY)
        const newPinAngle = curMouseAngle + dragOffset.current.angleOffset
        const newRadius = Math.max(10, curMouseDist + dragOffset.current.distOffset)
        const candidatePin = {
          x: pencilX + Math.cos(newPinAngle) * newRadius,
          y: pencilY + Math.sin(newPinAngle) * newRadius,
        }
        const snappedPin = snapEnabled ? snapToDrawing(snapPointToRuler(candidatePin, ruler), canvasRef, shapes) : candidatePin
        setCompass({
          pinX: snappedPin.x,
          pinY: snappedPin.y,
        })
      } else if (dragging.current === 'whole') {
        // 힌지 회전: 커서를 힌지 위치에 고정
        const curMouseAngle = Math.atan2(rawP.y - pinY, rawP.x - pinX)
        const newPencilAngle = dragOffset.current.initPencilAngle + (curMouseAngle - dragOffset.current.initMouseAngle)
        const newPencilX = pinX + Math.cos(newPencilAngle) * radius
        const newPencilY = pinY + Math.sin(newPencilAngle) * radius
        // 새 힌지 위치 계산
        const newDxMain = newPencilX - pinX
        const newDyMain = newPencilY - pinY
        const newSpan = Math.hypot(newDxMain, newDyMain) || 1
        const newNx = (newDyMain / newSpan) * hingeSide
        const newNy = (-newDxMain / newSpan) * hingeSide
        const newHingeX = (pinX + newPencilX) / 2 + newNx * compassHeight
        const newHingeY = (pinY + newPencilY) / 2 + newNy * compassHeight
        setCompass({ pencilX: newPencilX, pencilY: newPencilY })
        setDragCursor({ x: newHingeX, y: newHingeY, type: 'whole' })
        onCursorUpdate?.({ x: newHingeX, y: newHingeY })

      } else if (dragging.current === 'pencil' || dragging.current === 'clamp') {
        // 연필 조작 시 마우스 포인터와 클릭 위치 1:1 완벽 동기화 + 점 중심 스냅 지원
        const curMouseAngle = Math.atan2(rawP.y - pinY, rawP.x - pinX)
        const curMouseDist = Math.hypot(rawP.x - pinX, rawP.y - pinY)
        const newPencilAngle = curMouseAngle + dragOffset.current.angleOffset
        const newRadius = Math.max(10, curMouseDist + dragOffset.current.distOffset)
        const candidatePencil = {
          x: pinX + Math.cos(newPencilAngle) * newRadius,
          y: pinY + Math.sin(newPencilAngle) * newRadius,
        }
        const snappedPencil = snapEnabled ? snapToDrawing(snapPointToRuler(candidatePencil, ruler), canvasRef, shapes) : candidatePencil
        setCompass({ pencilX: snappedPencil.x, pencilY: snappedPencil.y })
        setDragCursor({ x: snappedPencil.x, y: snappedPencil.y, type: 'pencil' })
        onCursorUpdate?.({ x: snappedPencil.x, y: snappedPencil.y })

      } else if (dragging.current === 'leg') {
        // 은색 다리 조작 시: 반지름 고정된 채 연필 끝에서 잉크가 흘러나오듯 호의 일부만 점진적으로 그림
        const curMouseAngle = Math.atan2(rawP.y - pinY, rawP.x - pinX)
        const curAngle = curMouseAngle + dragOffset.current.angleOffset
        const curRadius = dragOffset.current.fixedRadius
        const newPx = pinX + Math.cos(curAngle) * curRadius
        const newPy = pinY + Math.sin(curAngle) * curRadius

        const prev = prevAngleRef.current
        if (prev !== null) {
          let diff = curAngle - prev
          while (diff < -Math.PI) diff += 2 * Math.PI
          while (diff > Math.PI) diff -= 2 * Math.PI
          const newTotal = (dragOffset.current.totalAngleTraveled || 0) + diff
          dragOffset.current.totalAngleTraveled = newTotal
          dragOffset.current.minAccumulated = Math.min(dragOffset.current.minAccumulated || 0, newTotal)
          dragOffset.current.maxAccumulated = Math.max(dragOffset.current.maxAccumulated || 0, newTotal)
          dragOffset.current.lastAngle = curAngle
          drawArcSegment(canvasRef.current, pinX, pinY, prev, curAngle, curRadius, strokeColor, strokeWidth)
        }
        prevAngleRef.current = curAngle
        legArcPoints.current.push({ x: newPx, y: newPy })
        setCompass({ pencilX: newPx, pencilY: newPy })

        // 은색 다리 상의 실제 잡은 위치 (회전 각도 curMouseAngle, 고정 반지름 clickDist)
        const curLegX = pinX + Math.cos(curMouseAngle) * (dragOffset.current.clickDist || curRadius)
        const curLegY = pinY + Math.sin(curMouseAngle) * (dragOffset.current.clickDist || curRadius)
        setDragCursor({ x: curLegX, y: curLegY, type: 'leg' })
        // 실제로 클릭(그립)한 다리 위치로 가짜 펜 커서 이동
        onCursorUpdate?.({ x: curLegX, y: curLegY })
      }
    }

    const onUp = () => {
      let shapeAdded = false
      if (dragging.current === 'leg' && legArcPoints.current.length > 1) {
        const minAcc = dragOffset.current.minAccumulated || 0
        const maxAcc = dragOffset.current.maxAccumulated || 0
        const totalTraveled = maxAcc - minAcc
        const curRadius = dragOffset.current.fixedRadius || radius
        // 거의 한 바퀴(350도 이상) 돌았으면 완벽한 원으로 등록
        if (totalTraveled >= Math.PI * 1.94) {
          const circleShape = {
            id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            type: 'circle',
            cx: pinX,
            cy: pinY,
            r: curRadius,
            color: strokeColor,
            width: strokeWidth,
          }
          onAddShape?.(circleShape)
          shapeAdded = true
        } else {
          // 그 외에는 수학적 완벽한 호(arc)로 등록 (다각형 변형 방지)
          const arcShape = {
            id: 'a_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            type: 'arc',
            cx: pinX,
            cy: pinY,
            r: curRadius,
            fromAngle: dragOffset.current.startAngle + minAcc,
            toAngle: dragOffset.current.startAngle + maxAcc,
            ccw: false,
            points: [...legArcPoints.current],
            color: strokeColor,
            width: strokeWidth,
          }
          onAddShape?.(arcShape)
          shapeAdded = true
        }
      }
      legArcPoints.current = []
      // shape가 등록되지 않은 상호작용(예: 단순 툴 이동)인 경우에만 onInteractionEnd로 스냅샷 저장
      if (dragging.current && !shapeAdded) {
        onInteractionEnd?.()
      }
      dragging.current = null
      prevAngleRef.current = null
      document.body.style.cursor = ''
      setDragCursor(null)
      onCursorUpdate?.(null)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
  }, [pinX, pinY, pencilX, pencilY, radius, setCompass, ruler, canvasRef, strokeColor, strokeWidth, onDraw, onInteractionEnd, onAddShape, shapes])

  // 힌지 더블클릭 → pin/pencil 역할 교체 (힌지 위치는 그대로 유지!)
  const onHingeDblClick = useCallback((e) => {
    e.stopPropagation()
    e.preventDefault()
    setCompass({
      pinX: pencilX,
      pinY: pencilY,
      pencilX: pinX,
      pencilY: pinY,
      hingeSide: -hingeSide,
    })
    onInteractionEnd?.()
  }, [pinX, pinY, pencilX, pencilY, hingeSide, setCompass, onInteractionEnd])

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
    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.arc(pinX, pinY, radius, 0, Math.PI * 2)
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = strokeWidth
    ctx.lineCap = 'round'
    ctx.stroke()
    const shape = {
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      type: 'circle',
      cx: pinX,
      cy: pinY,
      r: radius,
      color: strokeColor,
      width: strokeWidth,
    }
    onAddShape?.(shape)
  }, [canvasRef, pinX, pinY, radius, strokeColor, strokeWidth, onAddShape])

  // 레퍼런스 이미지와 100% 동일한 강체 기하구조:
  // 연필 각도: 다리-힌지 기준 24도 기울어짐 (업라이트 상태에서 연필이 완벽한 수직 -90도를 이룸)
  // hingeSide에 따라 부호 반전 → swap 후에도 연필이 항상 외부를 향함
  // 클램프 팔: 연필과 정확히 90도 수직을 이루며 다리와 결합 (hingeSide에 따라 방향 반전)
  const pencilAngleDeg = 24 * hingeSide
  const pencilAngleRad = pencilAngleDeg * (Math.PI / 180)
  const clampPos = 26             // 연필 촉에서 클램프 칼라까지 거리 (px)
  const clampLength = 22          // 클램프 팔 길이 (px)
  const clampLengthSigned = clampLength * hingeSide  // hingeSide=-1일 때 방향 반전
  // 다리 로컬 좌표계에서 클램프 조인트 위치 계산 (hingeSide 반영):
  const jointX = clampPos * Math.cos(pencilAngleRad) + clampLengthSigned * Math.sin(pencilAngleRad)
  const jointY = clampPos * Math.sin(pencilAngleRad) - clampLengthSigned * Math.cos(pencilAngleRad)

  return (
    <>
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full tool-overlay"
        style={{ touchAction: 'none', pointerEvents: 'none', zIndex: 20 }}
      >
        {/* 왼쪽 다리 (침핀 쪽) */}
        <g transform={`translate(${pinX}, ${pinY}) rotate(${leftLegAngleDeg})`} style={{ pointerEvents: 'none' }}>
          {/* 은색 메인 다리 */}
          <line x1="36" y1="0" x2={legLength} y2="0" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
          <line x1="36" y1="0" x2={legLength} y2="0" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />

          {/* 침핀 홀더 (검정 캡) */}
          <rect x="18" y="-6" width="18" height="12" rx="2.5" fill="#1e293b" />
          
          {/* 금속 바늘 */}
          <polygon points="0,0 20,-1.5 20,1.5" fill="#64748b" />
          <line x1="0" y1="0" x2="20" y2="0" stroke="#94a3b8" strokeWidth="1" />
          
          {/* 침핀 끝 빨간 볼 (레퍼런스 이미지와 동일) */}
          <circle cx="0" cy="0" r="4" fill="#dc2626" stroke="#b91c1c" strokeWidth="0.5" />

          {/* 침핀 하단(빨간 끝 부근) → 반지름 조절 */}
          <g style={{ pointerEvents: 'all', cursor: 'ew-resize' }} onMouseDown={onPointerDown('pin_bottom')} onTouchStart={onPointerDown('pin_bottom')}>
            <rect x="-10" y="-15" width="46" height="30" fill="transparent" />
          </g>
          {/* 침핀 상단(은색 다리 전체) → 컴퍼스 전체 이동 */}
          <g style={{ pointerEvents: 'all', cursor: 'move' }} onMouseDown={onPointerDown('pin_top')} onTouchStart={onPointerDown('pin_top')}>
            <rect x="36" y="-15" width={legLength - 36} height="30" fill="transparent" />
          </g>
        </g>

        {/* 오른쪽 다리 + 클램프 + 연필 (모두 다리 로컬 좌표계, 다리와 함께 완벽한 강체로 회전) */}
        <g transform={`translate(${pencilX}, ${pencilY}) rotate(${rightLegAngleDeg})`} style={{ pointerEvents: 'none' }}>
          {/* 은색 다리: 힌지(legLength, 0)에서 클램프 조인트(jointX, jointY)까지만 연결! */}
          <line x1={jointX} y1={jointY} x2={legLength} y2="0" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
          <line x1={jointX} y1={jointY} x2={legLength} y2="0" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
          
          {/* 다리 클릭/드래그 히트 영역 (호 그리기) */}
          <line x1={jointX} y1={jointY} x2={legLength} y2="0" stroke="transparent" strokeWidth="30"
            style={{ pointerEvents: 'all', cursor: 'crosshair' }}
            onMouseDown={onPointerDown('leg')} onTouchStart={onPointerDown('leg')} />

          {/* 연필 & 클램프 어셈블리: 연필축 pencilAngleDeg 회전 그룹 */}
          <g transform={`rotate(${pencilAngleDeg})`}>
            {/* 클램프 팔: hingeSide에 따라 +y/-y 방향으로 뻗어 조인트까지 */}
            <line x1={clampPos} y1="0" x2={clampPos} y2={-clampLengthSigned} stroke="#1e293b" strokeWidth="7" strokeLinecap="round" />
            <line x1={clampPos} y1="0" x2={clampPos} y2={-clampLengthSigned} stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
            
            {/* 조인트 볼 (은색 다리와 클램프가 만나는 결합부) */}
            <circle cx={clampPos} cy={-clampLengthSigned} r="6" fill="#1e293b" />
            <circle cx={clampPos} cy={-clampLengthSigned} r="3" fill="#64748b" />

            {/* 클램프 칼라 (연필을 감싸고 있는 검정 홀더) */}
            <rect x={clampPos - 5} y="-6.5" width="10" height="13" rx="2" fill="#1e293b" />
            <rect x={clampPos - 3} y="-8" width="6" height="3" rx="1" fill="#475569" />

            {/* 연필 본체 (끝점이 정확히 0, 0에 위치!) */}
            {/* 1. 흑연 촉 (0,0 ~ 8,0) */}
            <polygon points="0,0 8,-2.5 8,2.5" fill="#1c1917" />
            {/* 2. 깎인 나무 부분 (8 ~ 20) */}
            <polygon points="8,-2.5 8,2.5 20,4.5 20,-4.5" fill="#c8a96e" />
            <line x1="9" y1="-1" x2="19" y2="-3" stroke="#a07040" strokeWidth="0.6" />
            <line x1="9" y1="1" x2="19" y2="3" stroke="#a07040" strokeWidth="0.6" />
            {/* 3. 노란 연필 바디 (20 ~ 54) */}
            <rect x="20" y="-4.5" width="34" height="9" fill="#f5c518" />
            <rect x="20" y="-4.5" width="34" height="2.5" fill="#f7d060" opacity="0.6" />
            {/* 4. 은색 페룰 금속 밴드 (54 ~ 61) */}
            <rect x="54" y="-4.5" width="7" height="9" fill="#9ca3af" />
            <line x1="56" y1="-4.5" x2="56" y2="4.5" stroke="#6b7280" strokeWidth="0.8" />
            <line x1="58" y1="-4.5" x2="58" y2="4.5" stroke="#6b7280" strokeWidth="0.8" />
            {/* 5. 분홍색 지우개 (61 ~ 68) */}
            <rect x="61" y="-4" width="7" height="8" rx="2" fill="#f9a8a8" />

            {/* 연필 드래그 히트 영역 (반지름 조절) */}
            <g style={{ pointerEvents: 'all', cursor: 'ew-resize' }} onMouseDown={onPointerDown('pencil')} onTouchStart={onPointerDown('pencil')}>
              <rect x="0" y="-12" width="70" height="24" fill="transparent" />
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

      {/* 드래그 중 실제 컴포넌트 위치에 고정되는 가짜 커서 */}
      {dragCursor && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: dragCursor.x - 12,
              top: dragCursor.y - 12,
              width: 24,
              height: 24,
              pointerEvents: 'none',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))',
            }}
          >
            {dragCursor.type === 'whole' ? (
              /* 힌지 회전 시 주먹 쥔 손 커서 */
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
                <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
                <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
                <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
              </svg>
            ) : dragCursor.type === 'pencil' ? (
              /* 연필 조작/회전 시 ew-resize 화살표 커서 */
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m18 8 4 4-4 4M6 8l-4 4 4 4M2 12h20" stroke="white" strokeWidth="4" />
                <path d="m18 8 4 4-4 4M6 8l-4 4 4 4M2 12h20" stroke="#1e40af" strokeWidth="2" />
              </svg>
            ) : (
              /* 은색 다리 드래그(호 그리기) 시 crosshair 커서 */
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeLinecap="round">
                <circle cx="12" cy="12" r="6" stroke="white" strokeWidth="3" />
                <circle cx="12" cy="12" r="6" stroke="#1e40af" strokeWidth="1.5" />
                <line x1="12" y1="1" x2="12" y2="7" stroke="white" strokeWidth="3" />
                <line x1="12" y1="1" x2="12" y2="7" stroke="#1e40af" strokeWidth="1.5" />
                <line x1="12" y1="17" x2="12" y2="23" stroke="white" strokeWidth="3" />
                <line x1="12" y1="17" x2="12" y2="23" stroke="#1e40af" strokeWidth="1.5" />
                <line x1="1" y1="12" x2="7" y2="12" stroke="white" strokeWidth="3" />
                <line x1="1" y1="12" x2="7" y2="12" stroke="#1e40af" strokeWidth="1.5" />
                <line x1="17" y1="12" x2="23" y2="12" stroke="white" strokeWidth="3" />
                <line x1="17" y1="12" x2="23" y2="12" stroke="#1e40af" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="1.5" fill="#1e40af" />
              </svg>
            )}
          </div>
        </div>
      )}

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
