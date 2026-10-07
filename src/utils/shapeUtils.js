// 점 (px, py)와 선분 (x1, y1)-(x2, y2) 사이의 거리
export function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2
  if (l2 === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)))
}

// 선분 끝점 항상-스냅 (snapEnabled 무관, 반경 radius 이내 최근접 끝점 반환)
// 지오지브라처럼 선분 도구에서 기존 선분 끝점에 자동 흡착
export function snapToSegmentEndpoint(pos, shapes, radius = 8) {
  let best = null
  let bestDist = radius
  for (const s of shapes) {
    if (s.type !== 'segment') continue
    const endpoints = [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }]
    for (const ep of endpoints) {
      const d = Math.hypot(pos.x - ep.x, pos.y - ep.y)
      if (d <= bestDist) {
        bestDist = d
        best = ep
      }
    }
  }
  return best  // null이면 근처에 끝점 없음
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

// ─── 교점(Intersection) 스냅 헬퍼 ───────────────────────────────────────────

// 선분 × 선분 교점 (두 선분이 실제 교차하는 경우만)
function _segSeg(ax1,ay1,ax2,ay2, bx1,by1,bx2,by2) {
  const dx1=ax2-ax1,dy1=ay2-ay1,dx2=bx2-bx1,dy2=by2-by1
  const cross=dx1*dy2-dy1*dx2
  if (Math.abs(cross)<1e-10) return null
  const t=((bx1-ax1)*dy2-(by1-ay1)*dx2)/cross
  const u=((bx1-ax1)*dy1-(by1-ay1)*dx1)/cross
  if (t>=0&&t<=1&&u>=0&&u<=1) return {x:ax1+t*dx1,y:ay1+t*dy1}
  return null
}

// 선분 × 원 교점 (선분 위에 있는 점만, 최대 2개)
function _segCircle(ax1,ay1,ax2,ay2, cx,cy,r) {
  const dx=ax2-ax1,dy=ay2-ay1,fx=ax1-cx,fy=ay1-cy
  const a=dx*dx+dy*dy,b=2*(fx*dx+fy*dy),c=fx*fx+fy*fy-r*r
  const disc=b*b-4*a*c
  if (disc<0||a<1e-10) return []
  const sq=Math.sqrt(disc),pts=[]
  for (const t of [(-b-sq)/(2*a),(-b+sq)/(2*a)])
    if (t>=0&&t<=1) pts.push({x:ax1+t*dx,y:ay1+t*dy})
  return pts
}

// 원 × 원 교점 (최대 2개)
function _circCirc(cx1,cy1,r1, cx2,cy2,r2) {
  const d=Math.hypot(cx2-cx1,cy2-cy1)
  if (d>r1+r2+1e-10||d<Math.abs(r1-r2)-1e-10||d<1e-10) return []
  const a=(r1*r1-r2*r2+d*d)/(2*d),h2=r1*r1-a*a
  if (h2<0) return []
  const h=Math.sqrt(h2)
  const mx=cx1+a*(cx2-cx1)/d,my=cy1+a*(cy2-cy1)/d
  const rx=h*(cy2-cy1)/d,ry=h*(cx2-cx1)/d
  if (h<1e-10) return [{x:mx,y:my}]
  return [{x:mx+rx,y:my-ry},{x:mx-rx,y:my+ry}]
}

// 점이 호(arc)의 각도 범위 안에 있는지 확인 (fromAngle/toAngle 없으면 항상 true)
function _inArcRange(px,py,cx,cy,fromAngle,toAngle,ccw) {
  if (fromAngle==null||toAngle==null) return true
  const TWO_PI=Math.PI*2
  const angle=Math.atan2(py-cy,px-cx)
  let span,a_rel
  if (!ccw) {
    span=((toAngle-fromAngle)%TWO_PI+TWO_PI)%TWO_PI
    a_rel=((angle-fromAngle)%TWO_PI+TWO_PI)%TWO_PI
  } else {
    span=((fromAngle-toAngle)%TWO_PI+TWO_PI)%TWO_PI
    a_rel=((fromAngle-angle)%TWO_PI+TWO_PI)%TWO_PI
  }
  return a_rel<=span+0.05  // 0.05 rad 여유
}

// 도형에서 커서 p 근처(radius 이내)를 지나는 선분 추출 (성능 필터)
function _segsNear(shape, px, py, radius) {
  if (shape.type==='segment') {
    return distToSegment(px,py,shape.x1,shape.y1,shape.x2,shape.y2)<=radius
      ? [{x1:shape.x1,y1:shape.y1,x2:shape.x2,y2:shape.y2}] : []
  }
  if (shape.points&&shape.points.length>1) {
    const segs=[]
    for (let i=0;i<shape.points.length-1;i++) {
      const p1=shape.points[i],p2=shape.points[i+1]
      if (distToSegment(px,py,p1.x,p1.y,p2.x,p2.y)<=radius)
        segs.push({x1:p1.x,y1:p1.y,x2:p2.x,y2:p2.y})
    }
    return segs
  }
  return []
}

// 도형이 원/호 타입인지 (cx,cy,r 필드 보유)
function _isCircType(s) {
  return (s.type==='circle'||s.type==='arc')&&s.cx!=null&&s.r!=null
}

// ────────────────────────────────────────────────────────────────────────────

// 직선/곡선/원/점의 '정확한 두께 중심(스켈레톤 축선)' 자석 스냅
export function snapToShapesCenter(p, shapes, snapThreshold = 18) {
  if (!shapes || shapes.length === 0) return null

  // ── 0단계: 교점 스냅 (최우선) ─────────────────────────────────────────────
  // segment×segment, segment×circle/arc, circle×circle, 자유곡선 포함
  {
    const R = 9  // 교점 스냅 반경: 끝점(18px)보다 좁게 설정
    let iBest = Infinity, iPoint = null
    for (let i = 0; i < shapes.length; i++) {
      for (let j = i + 1; j < shapes.length; j++) {
        const si = shapes[i], sj = shapes[j]
        const iC = _isCircType(si), jC = _isCircType(sj)
        const cands = []

        if (iC && jC) {
          // 원/호 × 원/호
          for (const pt of _circCirc(si.cx,si.cy,si.r, sj.cx,sj.cy,sj.r))
            if (_inArcRange(pt.x,pt.y,si.cx,si.cy,si.fromAngle,si.toAngle,si.ccw) &&
                _inArcRange(pt.x,pt.y,sj.cx,sj.cy,sj.fromAngle,sj.toAngle,sj.ccw))
              cands.push(pt)
        } else if (iC) {
          // 원/호 × 폴리선(선분·자유곡선·폴리라인호)
          for (const seg of _segsNear(sj, p.x, p.y, R))
            for (const pt of _segCircle(seg.x1,seg.y1,seg.x2,seg.y2, si.cx,si.cy,si.r))
              if (_inArcRange(pt.x,pt.y,si.cx,si.cy,si.fromAngle,si.toAngle,si.ccw))
                cands.push(pt)
        } else if (jC) {
          // 폴리선 × 원/호
          for (const seg of _segsNear(si, p.x, p.y, R))
            for (const pt of _segCircle(seg.x1,seg.y1,seg.x2,seg.y2, sj.cx,sj.cy,sj.r))
              if (_inArcRange(pt.x,pt.y,sj.cx,sj.cy,sj.fromAngle,sj.toAngle,sj.ccw))
                cands.push(pt)
        } else {
          // 폴리선 × 폴리선 (선분·자유곡선·폴리라인호)
          const segsI = _segsNear(si, p.x, p.y, R)
          const segsJ = _segsNear(sj, p.x, p.y, R)
          for (const sI of segsI)
            for (const sJ of segsJ) {
              const pt = _segSeg(sI.x1,sI.y1,sI.x2,sI.y2, sJ.x1,sJ.y1,sJ.x2,sJ.y2)
              if (pt) cands.push(pt)
            }
        }

        for (const pt of cands) {
          const d = Math.hypot(p.x-pt.x, p.y-pt.y)
          if (d<=R && d<iBest) { iBest=d; iPoint=pt }
        }
      }
    }
    if (iPoint) return iPoint
  }
  // ──────────────────────────────────────────────────────────────────────────

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
    } else if (s.type === 'segment') {
      // segment 끝점 우선 스냅
      // 탐지 범위: pointR + snapThreshold (단순 점과 동일)
      // bestDist = 0으로 고정 → 2단계가 절대 이길 수 없음
      const pointR = Math.max((s.width || 3) * 0.8, 4)
      const endpointRange = pointR + snapThreshold
      const dStart = Math.hypot(p.x - s.x1, p.y - s.y1)
      const dEnd   = Math.hypot(p.x - s.x2, p.y - s.y2)
      if (dStart <= endpointRange && dStart < bestDist) {
        bestDist = 0
        bestPoint = { x: s.x1, y: s.y1 }
      }
      if (dEnd <= endpointRange && dEnd < bestDist) {
        bestDist = 0
        bestPoint = { x: s.x2, y: s.y2 }
      }
    } else if (s.points && s.points.length > 1) {
      const pointR = Math.max((s.width || 3) * 0.8, 4)
      const endpointRange = pointR + snapThreshold
      const pStart = s.points[0]
      const pEnd = s.points[s.points.length - 1]
      const dStart = Math.hypot(p.x - pStart.x, p.y - pStart.y)
      const dEnd = Math.hypot(p.x - pEnd.x, p.y - pEnd.y)
      if (dStart <= endpointRange && dStart < bestDist) {
        bestDist = 0
        bestPoint = { x: pStart.x, y: pStart.y }
      }
      if (dEnd <= endpointRange && dEnd < bestDist) {
        bestDist = 0
        bestPoint = { x: pEnd.x, y: pEnd.y }
      }
    }
  }

  if (bestPoint) {
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
    } else if (s.type === 'segment') {
      // segment 선분 위 정중앙 스냅
      const closest = closestPointOnSegment(p.x, p.y, s.x1, s.y1, s.x2, s.y2)
      const d = Math.hypot(p.x - closest.x, p.y - closest.y)
      if (d <= totalThreshold && d < bestDist) {
        bestDist = d
        bestPoint = closest
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
  if (shape.type === 'segment') {
    const pad = Math.max((shape.width || 3) * 0.8, 4) + 2
    return {
      minX: Math.min(shape.x1, shape.x2) - pad,
      maxX: Math.max(shape.x1, shape.x2) + pad,
      minY: Math.min(shape.y1, shape.y2) - pad,
      maxY: Math.max(shape.y1, shape.y2) + pad,
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
  if (shape.type === 'segment') {
    const d = distToSegment(px, py, shape.x1, shape.y1, shape.x2, shape.y2)
    return d <= tolerance
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
  if (shape.x1 !== undefined) updated.x1 = shape.x1 + dx
  if (shape.y1 !== undefined) updated.y1 = shape.y1 + dy
  if (shape.x2 !== undefined) updated.x2 = shape.x2 + dx
  if (shape.y2 !== undefined) updated.y2 = shape.y2 + dy
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
    } else if (s.type === 'segment') {
      ctx.globalAlpha = s.alpha ?? 1
      ctx.strokeStyle = s.color || '#1e40af'
      ctx.fillStyle = s.color || '#1e40af'
      ctx.lineWidth = s.width || 3
      ctx.beginPath()
      ctx.moveTo(s.x1, s.y1)
      ctx.lineTo(s.x2, s.y2)
      ctx.stroke()
      
      const pointR = Math.max(ctx.lineWidth * 0.8, 4)
      ctx.beginPath()
      ctx.arc(s.x1, s.y1, pointR, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(s.x2, s.y2, pointR, 0, Math.PI * 2)
      ctx.fill()
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
