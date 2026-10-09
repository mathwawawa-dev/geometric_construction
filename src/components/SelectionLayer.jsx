import { useState, useRef, useEffect, useCallback } from 'react'
import { isPointNearShape, isShapeInRect, getShapeBounds } from '../utils/shapeUtils'

export default function SelectionLayer({
  active,
  shapes,
  selectedIds,
  setSelectedIds,
  onMoveShapes,
  onFinishMove,
  onDeleteSelected,
  onUpdateShape,
}) {
  const [marquee, setMarquee] = useState(null)
  const [editingText, setEditingText] = useState(null)
  const isDraggingShapes = useRef(false)
  const activeDragIds = useRef([])
  const dragStartPos = useRef({ x: 0, y: 0 })
  const lastPos = useRef({ x: 0, y: 0 })
  const svgRef = useRef(null)
  const editInputRef = useRef(null)

  const getSVGPos = useCallback((e) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const scaleX = svg.clientWidth / rect.width || 1
    const scaleY = svg.clientHeight / rect.height || 1
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }, [])

  // 키보드 단축키 (Delete, Backspace, Escape, 방향키 이동)
  const finishMoveTimer = useRef(null)

  useEffect(() => {
    if (!active) return
    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault()
          onDeleteSelected()
        }
      } else if (e.key === 'Escape') {
        setSelectedIds([])
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (selectedIds.length > 0) {
          e.preventDefault()
          const step = e.shiftKey ? 10 : 1
          let dx = 0
          let dy = 0
          if (e.key === 'ArrowUp') dy = -step
          else if (e.key === 'ArrowDown') dy = step
          else if (e.key === 'ArrowLeft') dx = -step
          else if (e.key === 'ArrowRight') dx = step

          onMoveShapes(selectedIds, dx, dy)

          if (finishMoveTimer.current) clearTimeout(finishMoveTimer.current)
          finishMoveTimer.current = setTimeout(() => {
            onFinishMove?.()
            finishMoveTimer.current = null
          }, 300)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (finishMoveTimer.current) clearTimeout(finishMoveTimer.current)
    }
  }, [active, selectedIds, onDeleteSelected, setSelectedIds, onMoveShapes, onFinishMove])

  const commitEditText = () => {
    if (!editingText) return
    const newText = editingText.text.trim()
    if (newText) {
      onUpdateShape?.(editingText.id, { text: newText })
    }
    setEditingText(null)
  }

  const handleDoubleClick = (e) => {
    if (!active) return
    e.stopPropagation()
    const pos = getSVGPos(e)
    const hitText = [...shapes].reverse().find(s => s.type === 'text' && isPointNearShape(pos.x, pos.y, s, 10))
    if (hitText) {
      setEditingText({
        id: hitText.id,
        text: hitText.text,
        x: hitText.x,
        y: hitText.y,
        fontSize: hitText.fontSize || 26,
        color: hitText.color || '#1e40af',
      })
      setTimeout(() => editInputRef.current?.focus(), 15)
    }
  }

  const draggingEndpoint = useRef(null) // { shapeId, endpoint: 'p1' | 'p2', origX, origY, fixedX, fixedY }

  const handlePointerDown = (e) => {
    if (!active) return
    // 이미 편집 중이면 커밋 후 종료
    if (editingText) {
      commitEditText()
    }
    e.stopPropagation()
    const pos = getSVGPos(e)
    dragStartPos.current = pos
    lastPos.current = pos

    // 0. 단일 선택된 선분의 끝점 핸들 근처를 클릭했는지 확인 (우선순위 최고)
    if (selectedIds.length === 1) {
      const selectedShape = shapes.find((s) => s.id === selectedIds[0])
      if (selectedShape && selectedShape.type === 'segment') {
        const HANDLE_RADIUS = 12
        const d1 = Math.hypot(pos.x - selectedShape.x1, pos.y - selectedShape.y1)
        const d2 = Math.hypot(pos.x - selectedShape.x2, pos.y - selectedShape.y2)
        if (d1 <= HANDLE_RADIUS) {
          draggingEndpoint.current = {
            shapeId: selectedShape.id,
            endpoint: 'p1',
            fixedX: selectedShape.x2,
            fixedY: selectedShape.y2,
          }
        } else if (d2 <= HANDLE_RADIUS) {
          draggingEndpoint.current = {
            shapeId: selectedShape.id,
            endpoint: 'p2',
            fixedX: selectedShape.x1,
            fixedY: selectedShape.y1,
          }
        }
      }
    }

    if (!draggingEndpoint.current) {
      // 1. 이미 선택된 도형 위를 클릭했는지 확인 (선택된 것들 즉시 이동)
      const clickedSelected = shapes.find(
        (s) => selectedIds.includes(s.id) && isPointNearShape(pos.x, pos.y, s)
      )

      if (clickedSelected) {
        isDraggingShapes.current = true
        activeDragIds.current = selectedIds
      } else {
        // 2. 다른 도형을 클릭했는지 확인 (선택과 동시에 원터치 드래그 이동 시작!)
        const hit = [...shapes].reverse().find((s) => isPointNearShape(pos.x, pos.y, s))
        if (hit) {
          const nextIds = e.shiftKey
            ? (selectedIds.includes(hit.id) ? selectedIds.filter((id) => id !== hit.id) : [...selectedIds, hit.id])
            : [hit.id]
          setSelectedIds(nextIds)
          activeDragIds.current = nextIds
          isDraggingShapes.current = true
        } else {
          // 3. 빈 공간 클릭 -> 영역 드래그 선택 (블록 지정) 시작
          if (!e.shiftKey) {
            setSelectedIds([])
          }
          activeDragIds.current = []
          setMarquee({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y })
        }
      }
    }

    const onPointerMove = (me) => {
      const curPos = getSVGPos(me)

      if (draggingEndpoint.current) {
        // 끝점 드래그 처리 (Shift: 5° 스냅, Shift+Ctrl: 1° 스냅)
        const { shapeId, endpoint, fixedX, fixedY } = draggingEndpoint.current
        let targetX = curPos.x
        let targetY = curPos.y

        if (me.shiftKey) {
          const step = me.ctrlKey ? 1 : 5
          const dx = curPos.x - fixedX
          const dy = curPos.y - fixedY
          const r = Math.hypot(dx, dy)
          const deg = Math.atan2(dy, dx) * (180 / Math.PI)
          const snappedDeg = Math.round(deg / step) * step
          const rad = snappedDeg * (Math.PI / 180)
          targetX = fixedX + r * Math.cos(rad)
          targetY = fixedY + r * Math.sin(rad)
        }

        if (endpoint === 'p1') {
          onUpdateShape?.(shapeId, { x1: targetX, y1: targetY })
        } else {
          onUpdateShape?.(shapeId, { x2: targetX, y2: targetY })
        }
      } else if (isDraggingShapes.current && activeDragIds.current.length > 0) {
        const dx = curPos.x - lastPos.current.x
        const dy = curPos.y - lastPos.current.y
        lastPos.current = curPos
        if (dx !== 0 || dy !== 0) {
          onMoveShapes(activeDragIds.current, dx, dy)
        }
      } else if (setMarquee) {
        setMarquee((prev) => (prev ? { ...prev, x2: curPos.x, y2: curPos.y } : null))
      }
    }

    const onPointerUp = () => {
      if (draggingEndpoint.current) {
        draggingEndpoint.current = null
        onFinishMove?.()
      }

      if (isDraggingShapes.current) {
        isDraggingShapes.current = false
        activeDragIds.current = []
        onFinishMove?.()
      }

      setMarquee((currentMarquee) => {
        if (currentMarquee) {
          const w = Math.abs(currentMarquee.x2 - currentMarquee.x1)
          const h = Math.abs(currentMarquee.y2 - currentMarquee.y1)
          if (w > 4 || h > 4) {
            const newlySelected = shapes.filter((s) => isShapeInRect(s, currentMarquee)).map((s) => s.id)
            setSelectedIds(newlySelected)
          }
        }
        return null
      })

      window.removeEventListener('mousemove', onPointerMove)
      window.removeEventListener('mouseup', onPointerUp)
      window.removeEventListener('touchmove', onPointerMove)
      window.removeEventListener('touchend', onPointerUp)
    }

    window.addEventListener('mousemove', onPointerMove)
    window.addEventListener('mouseup', onPointerUp)
    window.addEventListener('touchmove', onPointerMove)
    window.addEventListener('touchend', onPointerUp)
  }

  if (!active && selectedIds.length === 0 && !editingText) return null

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 15 }}>
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        style={{
          pointerEvents: active ? 'all' : 'none',
          cursor: active ? (isDraggingShapes.current ? 'grabbing' : 'default') : 'inherit',
        }}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        onDoubleClick={handleDoubleClick}
      >
        {/* 1. 선택된 도형들의 경계 상자 및 코너 핸들 렌더링 */}
        {shapes
          .filter((s) => selectedIds.includes(s.id))
          .map((s) => {
            const b = getShapeBounds(s)
            const w = Math.max(12, b.maxX - b.minX)
            const h = Math.max(12, b.maxY - b.minY)
            const x = b.minX
            const y = b.minY
            return (
              <g key={s.id} className="pointer-events-none">
                {/* 반투명 선택 박스 */}
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill="rgba(59, 130, 246, 0.08)"
                  stroke="#2563eb"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                {/* 4개 코너 핸들 */}
                <rect x={x - 3.5} y={y - 3.5} width="7" height="7" fill="#ffffff" stroke="#2563eb" strokeWidth="1.5" />
                <rect x={x + w - 3.5} y={y - 3.5} width="7" height="7" fill="#ffffff" stroke="#2563eb" strokeWidth="1.5" />
                <rect x={x - 3.5} y={y + h - 3.5} width="7" height="7" fill="#ffffff" stroke="#2563eb" strokeWidth="1.5" />
                <rect x={x + w - 3.5} y={y + h - 3.5} width="7" height="7" fill="#ffffff" stroke="#2563eb" strokeWidth="1.5" />

                {/* 선분(segment)인 경우: 양 끝점에 길이/각도 조절 원형 핸들 표시 */}
                {s.type === 'segment' && (
                  <g className="pointer-events-none">
                    {/* 끝점 1 (x1, y1) */}
                    <circle cx={s.x1} cy={s.y1} r={10} fill="rgba(37, 99, 235, 0.15)" stroke="none" />
                    <circle cx={s.x1} cy={s.y1} r={5} fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" />
                    {/* 끝점 2 (x2, y2) */}
                    <circle cx={s.x2} cy={s.y2} r={10} fill="rgba(37, 99, 235, 0.15)" stroke="none" />
                    <circle cx={s.x2} cy={s.y2} r={5} fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" />
                  </g>
                )}
              </g>
            )
          })}

        {/* 2. 블록 지정 드래그 영역 (마키 박스) */}
        {marquee && (
          <rect
            x={Math.min(marquee.x1, marquee.x2)}
            y={Math.min(marquee.y1, marquee.y2)}
            width={Math.abs(marquee.x2 - marquee.x1)}
            height={Math.abs(marquee.y2 - marquee.y1)}
            fill="rgba(37, 99, 235, 0.12)"
            stroke="#2563eb"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            className="pointer-events-none"
          />
        )}
      </svg>

      {/* 3. 텍스트 개체 더블클릭 수정 인라인 인풋 */}
      {editingText && (
        <div
          style={{
            position: 'absolute',
            left: editingText.x,
            top: editingText.y,
            zIndex: 1000,
            pointerEvents: 'all',
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            ref={editInputRef}
            type="text"
            value={editingText.text}
            onChange={(e) => setEditingText(prev => prev ? { ...prev, text: e.target.value } : null)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') {
                e.preventDefault()
                commitEditText()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setEditingText(null)
              }
            }}
            onBlur={commitEditText}
            style={{
              fontSize: editingText.fontSize,
              fontWeight: 'bold',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Malgun Gothic", sans-serif',
              color: editingText.color,
              background: 'rgba(255, 255, 255, 0.98)',
              border: '2px solid #2563eb',
              borderRadius: 4,
              padding: '2px 8px',
              outline: 'none',
              minWidth: 120,
              boxShadow: '0 4px 14px rgba(0,0,0,0.22)',
            }}
          />
        </div>
      )}
    </div>
  )
}
