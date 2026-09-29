// 점 (px, py)와 선분 (x1, y1)-(x2, y2) 사이의 거리
export function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2
  if (l2 === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)))
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
  if (shape.points && shape.points.length > 0) {
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
  if (shape.type === 'stroke' || shape.type === 'arc') {
    const pts = shape.points
    if (!pts || pts.length === 0) return false
    if (pts.length === 1) return Math.hypot(px - pts[0].x, py - pts[0].y) <= tolerance
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
  if (shape.type === 'circle') {
    return { ...shape, cx: shape.cx + dx, cy: shape.cy + dy }
  }
  if (shape.points) {
    return {
      ...shape,
      points: shape.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
    }
  }
  return shape
}

// 캔버스에 모든 도형 렌더링
export function renderShapes(ctx, shapes) {
  if (!ctx || !ctx.canvas) return
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  for (const s of shapes) {
    ctx.strokeStyle = s.color || '#1e40af'
    ctx.lineWidth = s.width || 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    if (s.type === 'circle') {
      ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2)
    } else if (s.points && s.points.length > 0) {
      ctx.moveTo(s.points[0].x, s.points[0].y)
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y)
      }
    }
    ctx.stroke()
  }
}
