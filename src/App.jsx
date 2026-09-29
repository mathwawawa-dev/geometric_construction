import { useRef, useEffect, useCallback, useState } from 'react'
import { useAppState } from './store/useAppState'
import { useHistory } from './hooks/useHistory'
import Toolbar from './components/Toolbar'
import Sidebar from './components/Sidebar'
import DrawingCanvas from './components/DrawingCanvas'
import BackgroundLayer from './components/BackgroundLayer'
import CompassTool from './components/CompassTool'
import RulerTool from './components/RulerTool'
import ProtractorTool from './components/ProtractorTool'

const VERSION = 'v0.1.16_20260930_031800_개선'

export default function App() {
  const canvasRef = useRef(null)
  const canvasAreaRef = useRef(null)
  const {
    state,
    setDrawMode, toggleTool,
    setColor, setWidth,
    setCompass, setRuler, setProtractor,
    setBackground,
  } = useAppState()
  const { saveSnapshot, undo, redo, clear } = useHistory(canvasRef)

  // 줌/팬 상태
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  // 키보드 단축키
  useEffect(() => {
    const handler = (e) => {
      // 입력 필드 포커스 시 단축키 무시
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo() }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo() }
      // V 키: pointer(이동) 모드 토글
      if (e.key === 'v' || e.key === 'V') {
        setDrawMode(state.drawMode === 'pointer' ? 'pen' : 'pointer')
      }
      // P 키: 펜 모드
      if (e.key === 'p' || e.key === 'P') {
        setDrawMode('pen')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, setDrawMode, state.drawMode])

  // 마우스 휠 줌
  useEffect(() => {
    const el = canvasAreaRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setZoom(prev => Math.min(8, Math.max(0.2, prev * delta)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // 스페이스바 + 드래그로 팬
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Space' && !e.target.matches('input,textarea')) {
        e.preventDefault()
        document.body.style.cursor = 'grab'
      }
    }
    const onKeyUp = (e) => {
      if (e.code === 'Space') {
        document.body.style.cursor = ''
        isPanning.current = false
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const handleCanvasMouseDown = useCallback((e) => {
    if (e.buttons === 2 || e.buttons === 4 || (e.buttons === 1 && e.altKey)) {
      // 우클릭/중간 클릭/Alt+클릭: 팬
      isPanning.current = true
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
      e.preventDefault()
    }
  }, [pan])

  const handleCanvasMouseMove = useCallback((e) => {
    if (isPanning.current) {
      setPan({
        x: panStart.current.panX + (e.clientX - panStart.current.x),
        y: panStart.current.panY + (e.clientY - panStart.current.y),
      })
    }
  }, [])

  const handleCanvasMouseUp = useCallback(() => {
    isPanning.current = false
  }, [])

  const handleDrawStart = useCallback(() => saveSnapshot(), [saveSnapshot])
  const handleToolDraw  = useCallback(() => saveSnapshot(), [saveSnapshot])

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const merged = document.createElement('canvas')
    merged.width = canvas.width
    merged.height = canvas.height
    const ctx = merged.getContext('2d')
    const commit = () => {
      ctx.drawImage(canvas, 0, 0)
      download(merged)
    }
    if (state.background.src) {
      const img = new Image()
      img.onload = () => {
        ctx.globalAlpha = state.background.opacity
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
        const w = img.width * scale
        const h = img.height * scale
        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h)
        ctx.globalAlpha = 1
        commit()
      }
      img.src = state.background.src
    } else {
      commit()
    }
  }, [canvasRef, state.background])

  const toolsVisible = {
    compass:    state.compass.visible,
    ruler:      state.ruler.visible,
    protractor: state.protractor.visible,
  }

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden select-none">
      <Toolbar
        strokeColor={state.strokeColor}
        strokeWidth={state.strokeWidth}
        setColor={setColor}
        setWidth={setWidth}
        onUndo={undo}
        onRedo={redo}
        onClear={clear}
        onSave={handleSave}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          drawMode={state.drawMode}
          setDrawMode={setDrawMode}
          toggleTool={toggleTool}
          toolsVisible={toolsVisible}
          background={state.background}
          setBackground={setBackground}
        />

        {/* 캔버스 영역 */}
        <div
          ref={canvasAreaRef}
          className="canvas-area relative flex-1 bg-white overflow-hidden"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* 줌/팬 래퍼 */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              width: '100%',
              height: '100%',
            }}
          >
            <BackgroundLayer background={state.background} />
            <DrawingCanvas
              canvasRef={canvasRef}
              activeTool={state.drawMode}
              strokeColor={state.strokeColor}
              strokeWidth={state.strokeWidth}
              onDrawStart={handleDrawStart}
              ruler={state.ruler}
            />
            {state.compass.visible && (
              <CompassTool
                compass={state.compass}
                setCompass={setCompass}
                canvasRef={canvasRef}
                strokeColor={state.strokeColor}
                strokeWidth={state.strokeWidth}
                onDraw={handleToolDraw}
                ruler={state.ruler}
              />
            )}
            {state.ruler.visible && (
              <RulerTool
                ruler={state.ruler}
                setRuler={setRuler}
                canvasRef={canvasRef}
                strokeColor={state.strokeColor}
                strokeWidth={state.strokeWidth}
                onDraw={handleToolDraw}
              />
            )}
            {state.protractor.visible && (
              <ProtractorTool
                protractor={state.protractor}
                setProtractor={setProtractor}
              />
            )}
          </div>

          {/* 줌 레벨 표시 */}
          <div className="absolute bottom-14 left-2 text-[11px] text-gray-400 bg-white/70 px-2 py-0.5 rounded pointer-events-none">
            {Math.round(zoom * 100)}% | V: 이동모드 | 우클릭+드래그: 팬 | 휠: 줌
          </div>
        </div>
      </div>

      <footer className="px-4 py-1 bg-gray-50 border-t border-gray-200 text-[11px] text-gray-400">
        {VERSION}
      </footer>
    </div>
  )
}

function download(canvas) {
  const link = document.createElement('a')
  link.download = `작도보드_${new Date().toISOString().slice(0, 10)}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
