import { useRef, useEffect, useCallback, useState } from 'react'

/**
 * 자유 펜 드로잉 캔버스 (영구 레이어)
 * 컴퍼스/자/각도기가 그린 선도 이곳에 커밋됨
 */
export default function DrawingCanvas({ canvasRef, activeTool, strokeColor, strokeWidth, onDrawStart }) {
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const startDraw = useCallback((e) => {
    if (activeTool !== 'pen') return
    e.preventDefault()
    isDrawing.current = true
    const canvas = canvasRef.current
    const pos = getPos(e, canvas)
    lastPos.current = pos
    onDrawStart?.()
  }, [activeTool, canvasRef, onDrawStart])

  const draw = useCallback((e) => {
    if (!isDrawing.current || activeTool !== 'pen') return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)

    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = strokeWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()

    lastPos.current = pos
  }, [activeTool, canvasRef, strokeColor, strokeWidth])

  const endDraw = useCallback(() => {
    isDrawing.current = false
  }, [])

  // 캔버스 크기를 컨테이너에 맞춤
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      // 기존 내용 보존
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
