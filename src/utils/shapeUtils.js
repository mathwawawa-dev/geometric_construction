// 점 (px, py)와 선분 (x1, y1)-(x2, y2) 사이의 거리
export function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2
  if (l2 === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)))
}

// 선분 위 최근접점 (선분의 두께 중심축 투영점)
export function closestPointOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const l2 = dx * dx + dy * dy
  if (l2 === 0) return { x: x1, y: y1 }
  let t = ((px - x1) * dx + (py - y1) * dy) / l2
  t = Math.max(0, Math.min(1, t))
  return { x: x1 + t * dx, y: y1 + t * dy }
}

// 직선/곡선/원/점의 '정확한 두께 중심(스켈레톤 축선)' 자석 스냅
export function snapToShapesCenter(p, shapes, snapThreshold = 18) {
  if (!shapes || shapes.length === 0) return null

  let bestDist = Infinity
  let bestPoint = null

  // 1단계: 작도점(단일점) 중심, 원의 중심, 선분의 끝점에 최우선 스냅
  for (const s of shapes) {
    if (s.points && s.points.length === 1) {
      const pt = s.points[0]
      const d = Math.hypot(p.x - pt.x, p.y - pt.y)
      const visualR = Math.max((s.width || 3) * 0.8, 4)
      if (d <= visualR + snapThreshold && d < bestDist) {
        bestDist = d
        bestPoint = { x: pt.x, y: pt.y }
      }
    } else if (s.type === 'circle') {
      const d = Math.hypot(p.x - s.cx, p.y - s.cy)
      if (d <= snapThreshold && d < bestDist) {
        bestDist = d
        bestPoint = { x: s.cx, y: s.cy }
      }
    } else if (s.type === 'text') {
      const d = Math.hypot(p.x - s.x, p.y - s.y)
      if (d <= snapThreshold && d < bestDist) {
        bestDist = d
        bestPoint = { x: s.x, y: s.y }
      }
    } else if (s.points && s.points.length > 1) {
      const pStart = s.points[0]
      const pEnd = s.points[s.points.length - 1]
      const dStart = Math.hypot(p.x - pStart.x, p.y - pStart.y)
      const dEnd = Math.hypot(p.x - pEnd.x, p.y - pEnd.y)
      if (dStart <= snapThreshold && dStart < bestDist) {
        bestDist = dStart
        bestPoint = { x: pStart.x, y: pStart.y }
      }
      if (dEnd <= snapThreshold && dEnd < bestDist) {
        bestDist = dEnd
        bestPoint = { x: pEnd.x, y: pEnd.y }
      }
    }
  }

  if (bestPoint && bestDist <= snapThreshold) {
    return bestPoint
  }

  // 2단계: 선분/호/원의 '두께 중심축(위-아래 정중앙)' 탐색
  for (const s of shapes) {
    const halfThick = (s.width || 3) / 2
    const totalThreshold = halfThick + snapThreshold

    if (s.type === 'circle') {
      const dToCenter = Math.hypot(p.x - s.cx, p.y - s.cy)
      const dToCircumference = Math.abs(dToCenter - s.r)
      if (dToCircumference <= totalThreshold && dToCircumference < bestDist) {
        const a = Math.atan2(p.y - s.cy, p.x - s.cx)
        bestDist = dToCircumference
        bestPoint = { x: s.cx + s.r * Math.cos(a), y: s.cy + s.r * Math.sin(a) }
      }
    } else if (s.points && s.points.length > 1) {
      for (let i = 0; i < s.points.length - 1; i++) {
        const pt1 = s.points[i]
        const pt2 = s.points[i + 1]
        const closest = closestPointOnSegment(p.x, p.y, pt1.x, pt1.y, pt2.x, pt2.y)
        const d = Math.hypot(p.x - closest.x, p.y - closest.y)
        if (d <= totalThreshold && d < bestDist) {
          bestDist = d
          bestPoint = closest // 선분의 위/아래 가장자리가 아닌 정확한 선분 중심 좌표!
        }
      }
    }
  }

  return bestPoint
}

// 도형의 경계 상자 (AABB) 계산
export function getShapeBounds(shape) {
  if (shape.type === 'circle') {
    const pad = (shape.width || 2) / 2
    return {
      minX: shape.cx - shape.r - pad,
      maxX: shape.cx + shape.r + pad,
      minY: shape.cy - shape.r - pad,
      maxY: shape.cy + shape.r + pad,
    }
  }
  if (shape.type === 'stamp') {
    const half = (shape.fontSize || 53) * 0.6
    return { minX: shape.x - half, maxX: shape.x + half, minY: shape.y - half, maxY: shape.y + half }
  }
  if (shape.type === 'text') {
    const fs = shape.fontSize || 26
    let approxW = 0
    for (const ch of (shape.text || '')) {
      approxW += ch.charCodeAt(0) > 255 ? fs : fs * 0.58
    }
    approxW = Math.max(approxW, fs)
    const h = fs * 1.25
    return {
      minX: shape.x - 2,
      maxX: shape.x + approxW + 4,
      minY: shape.y - 2,
      maxY: shape.y + h + 2,
    }
  }
  if (shape.points && shape.points.length > 0) {
    if (shape.points.length === 1) {
      const p = shape.points[0]
      const r = Math.max((shape.width || 3) * 0.8, 4)
      return { minX: p.x - r, maxX: p.x + r, minY: p.y - r, maxY: p.y + r }
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const p of shape.points) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    const pad = (shape.width || 2) / 2
    return {
      minX: minX - pad,
      maxX: maxX + pad,
      minY: minY - pad,
      maxY: maxY + pad,
    }
  }
  return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
}

// 여러 도형들의 합산 경계 상자 계산
export function getCombinedBounds(shapes) {
  if (!shapes || shapes.length === 0) return null
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const s of shapes) {
    const b = getShapeBounds(s)
    if (b.minX < minX) minX = b.minX
    if (b.maxX > maxX) maxX = b.maxX
    if (b.minY < minY) minY = b.minY
    if (b.maxY > maxY) maxY = b.maxY
  }
  if (minX === Infinity) return null
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY }
}

// 점이 도형 근처에 있는지 검사 (클릭 선택용)
export function isPointNearShape(px, py, shape, threshold = 8) {
  const tolerance = ((shape.width || 2) / 2) + threshold
  if (shape.type === 'circle') {
    const d = Math.hypot(px - shape.cx, py - shape.cy)
    return Math.abs(d - shape.r) <= tolerance
  }
  if (shape.type === 'stamp') {
    const half = (shape.fontSize || 53) * 0.6
    return Math.abs(px - shape.x) < half && Math.abs(py - shape.y) < half
  }
  if (shape.type === 'text') {
    const b = getShapeBounds(shape)
    return px >= b.minX - threshold && px <= b.maxX + threshold &&
           py >= b.minY - threshold && py <= b.maxY + threshold
  }
  if (shape.type === 'stroke' || shape.type === 'arc') {
    const pts = shape.points
    if (!pts || pts.length === 0) return false
    if (pts.length === 1) {
      const r = Math.max((shape.width || 3) * 0.8, 4) + threshold
      return Math.hypot(px - pts[0].x, py - pts[0].y) <= r
    }
    for (let i = 0; i < pts.length - 1; i++) {
      if (distToSegment(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= tolerance) {
        return true
      }
    }
  }
  return false
}

// 도형이 사각 영역 (드래그 블록 선택)과 겹치거나 포함되는지 검사
export function isShapeInRect(shape, rect) {
  const rMinX = Math.min(rect.x1, rect.x2)
  const rMaxX = Math.max(rect.x1, rect.x2)
  const rMinY = Math.min(rect.y1, rect.y2)
  const rMaxY = Math.max(rect.y1, rect.y2)

  const b = getShapeBounds(shape)
  return !(b.maxX < rMinX || b.minX > rMaxX || b.maxY < rMinY || b.minY > rMaxY)
}

// 도형 이동 (dx, dy)
export function moveShape(shape, dx, dy) {
  let updated = { ...shape }
  if (shape.cx !== undefined) updated.cx = shape.cx + dx
  if (shape.cy !== undefined) updated.cy = shape.cy + dy
  if (shape.x !== undefined) updated.x = shape.x + dx
  if (shape.y !== undefined) updated.y = shape.y + dy
  if (shape.points) {
    updated.points = shape.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
  }
  return updated
}

// 캔버스에 모든 도형 렌더링
export function renderShapes(ctx, shapes) {
  if (!ctx || !ctx.canvas) return
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  for (const s of shapes) {
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (s.type === 'text') {
      ctx.font = `bold ${s.fontSize || 26}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Malgun Gothic", sans-serif`
      ctx.fillStyle = s.color || '#1e40af'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(s.text, s.x, s.y)
    } else if (s.type === 'stamp') {
      ctx.font = `bold ${s.fontSize || 53}px serif`
      ctx.fillStyle = s.color || '#000000'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(s.char, s.x, s.y)
    } else if (s.type === 'circle') {
      ctx.globalAlpha = s.alpha ?? 1
      ctx.strokeStyle = s.color || '#1e40af'
      ctx.lineWidth = s.width || 3
      ctx.beginPath()
      ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2)
      ctx.stroke()
    } else if (s.type === 'arc') {
      ctx.globalAlpha = s.alpha ?? 1
      ctx.strokeStyle = s.color || '#1e40af'
      ctx.lineWidth = s.width || 3
      ctx.beginPath()
      if (s.cx !== undefined && s.cy !== undefined && s.r !== undefined && s.fromAngle !== undefined && s.toAngle !== undefined) {
        ctx.arc(s.cx, s.cy, s.r, s.fromAngle, s.toAngle, !!s.ccw)
      } else if (s.points && s.points.length > 0) {
        ctx.moveTo(s.points[0].x, s.points[0].y)
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x, s.points[i].y)
        }
      }
      ctx.stroke()
    } else if (s.points && s.points.length > 0) {
      ctx.globalAlpha = s.alpha ?? 1
      ctx.fillStyle = s.color || '#1e40af'
      ctx.strokeStyle = s.color || '#1e40af'
      ctx.lineWidth = s.width || 3
      if (s.points.length === 1) {
        const p = s.points[0]
        const r = Math.max((s.width || 3) * 0.8, 4)
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.moveTo(s.points[0].x, s.points[0].y)
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x, s.points[i].y)
        }
        ctx.stroke()
      }
    }
    ctx.restore()
  }
}
