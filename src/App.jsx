import { useRef, useEffect, useCallback } from 'react'
import { useAppState } from './store/useAppState'
import { useHistory } from './hooks/useHistory'
import Toolbar from './components/Toolbar'
import Sidebar from './components/Sidebar'
import DrawingCanvas from './components/DrawingCanvas'
import BackgroundLayer from './components/BackgroundLayer'
import CompassTool from './components/CompassTool'
import RulerTool from './components/RulerTool'
import ProtractorTool from './components/ProtractorTool'

const VERSION = 'v0.1.0_20260930_010415_MVP초안'

export default function App() {
  const canvasRef = useRef(null)
  const bgCanvasRef = useRef(null)
  const { state, setTool, setColor, setWidth, setCompass, setRuler, setProtractor, setBackground } = useAppState()
  const { saveSnapshot, undo, redo, clear } = useHistory(canvasRef)

  // 키보드 단축키
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo() }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])

  // 펜 드로잉 시작 직전 스냅샷 저장
  const handleDrawStart = useCallback(() => {
    saveSnapshot()
  }, [saveSnapshot])

  // 도구 커밋 전 스냅샷 저장 (컴퍼스/자 "그리기" 버튼 클릭 시)
  const handleToolDraw = useCallback(() => {
    saveSnapshot()
  }, [saveSnapshot])

  // PNG 저장 (배경 이미지 + 드로잉 합성)
  const handleSave = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // 합성 캔버스 생성
    const merged = document.createElement('canvas')
    merged.width = canvas.width
    merged.height = canvas.height
    const ctx = merged.getContext('2d')

    // 배경 이미지 먼저
    if (state.background.src) {
      const img = new Image()
      img.onload = () => {
        ctx.globalAlpha = state.background.opacity
        // object-contain 방식으로 그리기
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
        const w = img.width * scale
        const h = img.height * scale
        const ox = (canvas.width - w) / 2
        const oy = (canvas.height - h) / 2
        ctx.drawImage(img, ox, oy, w, h)
        ctx.globalAlpha = 1
        // 드로잉 레이어
        ctx.drawImage(canvas, 0, 0)
        download(merged)
      }
      img.src = state.background.src
    } else {
      ctx.drawImage(canvas, 0, 0)
      download(merged)
    }
  }, [canvasRef, state.background])

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
          activeTool={state.activeTool}
          setTool={setTool}
          background={state.background}
          setBackground={setBackground}
        />

        {/* 캔버스 영역 */}
        <div className="canvas-area relative flex-1 bg-white overflow-hidden">
          {/* 레이어 0: 배경 이미지 */}
          <BackgroundLayer background={state.background} />

          {/* 레이어 1: 드로잉 캔버스 */}
          <DrawingCanvas
            canvasRef={canvasRef}
            activeTool={state.activeTool}
            strokeColor={state.strokeColor}
            strokeWidth={state.strokeWidth}
            onDrawStart={handleDrawStart}
          />

          {/* 레이어 2: 도구 SVG 오버레이 */}
          {state.compass.visible && (
            <CompassTool
              compass={state.compass}
              setCompass={setCompass}
              canvasRef={canvasRef}
              strokeColor={state.strokeColor}
              strokeWidth={state.strokeWidth}
              onDraw={handleToolDraw}
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
      </div>

      {/* 버전 바 */}
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
