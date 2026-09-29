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
import SelectionLayer from './components/SelectionLayer'
import { renderShapes, moveShape } from './utils/shapeUtils'

const VERSION = 'v0.1.32_20260930_050800_개선'

export default function App() {
  const canvasRef = useRef(null)
  const canvasAreaRef = useRef(null)
  const {
    state,
    setDrawMode, toggleTool,
    setColor, setWidth,
    setCompass, setRuler, setProtractor,
    setBackground,
    addShape, setShapes, deleteShapes, moveShapes,
  } = useAppState()
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  // 개체 선택 상태
  const [selectedIds, setSelectedIds] = useState([])

  const getStateRef = useCallback(() => ({
    tools: {
      compass: stateRef.current.compass,
      ruler: stateRef.current.ruler,
      protractor: stateRef.current.protractor
    },
    shapes: stateRef.current.shapes,
  }), [])

  const restoreState = useCallback((toolsSnap, shapesSnap) => {
    if (toolsSnap) {
      setCompass(toolsSnap.compass)
      setRuler(toolsSnap.ruler)
      setProtractor(toolsSnap.protractor)
    }
    if (shapesSnap) {
      setShapes(shapesSnap)
      if (canvasRef.current) {
        renderShapes(canvasRef.current.getContext('2d'), shapesSnap)
      }
    }
  }, [setCompass, setRuler, setProtractor, setShapes, canvasRef])

  const { saveSnapshot, undo, redo, clear } = useHistory(canvasRef, getStateRef, restoreState)

  useEffect(() => {
    const timer = setTimeout(() => saveSnapshot(), 200)
    return () => clearTimeout(timer)
  }, [saveSnapshot])

  // 도형 이동 및 삭제 핸들러 (원터치 즉시 드래그 이동 완벽 지원)
  const handleMoveSelected = useCallback((ids, dx, dy) => {
    const targetIds = (Array.isArray(ids) && ids.length > 0) ? ids : (typeof ids === 'number' ? selectedIds : ids)
    if (!targetIds || targetIds.length === 0) return
    moveShapes(targetIds, dx, dy)
    if (canvasRef.current) {
      const set = new Set(targetIds)
      const updated = stateRef.current.shapes.map(s => set.has(s.id) ? moveShape(s, dx, dy) : s)
      renderShapes(canvasRef.current.getContext('2d'), updated)
    }
  }, [moveShapes, selectedIds, canvasRef])

  const handleFinishMove = useCallback(() => {
    setTimeout(() => saveSnapshot(), 0)
  }, [saveSnapshot])

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return
    deleteShapes(selectedIds)
    if (canvasRef.current) {
      const set = new Set(selectedIds)
      const updated = stateRef.current.shapes.filter(s => !set.has(s.id))
      renderShapes(canvasRef.current.getContext('2d'), updated)
    }
    setSelectedIds([])
    setTimeout(() => saveSnapshot(), 0)
  }, [selectedIds, deleteShapes, canvasRef, saveSnapshot])

  const handleAddShape = useCallback((shape) => {
    addShape(shape)
    setTimeout(() => saveSnapshot(), 0)
  }, [addShape, saveSnapshot])

  // 줌/팬 상태
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  // 키보드 단축키 (S: 선택, P: 펜, V: 이동, Delete/Backspace: 삭제)
  useEffect(() => {
    const handler = (e) => {
      // 입력 필드 포커스 시 단축키 무시
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo() }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo() }
      // S 키: 선택(Select) 모드 토글
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        setDrawMode(state.drawMode === 'select' ? 'pen' : 'select')
      }
      // V 키: pointer(이동) 모드 토글
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault()
        setDrawMode(state.drawMode === 'pointer' ? 'pen' : 'pointer')
      }
      // P 키: 펜 모드
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        setDrawMode('pen')
      }
      // Delete / Backspace 키: 선택된 개체 삭제
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault()
          handleDeleteSelected()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, setDrawMode, state.drawMode, selectedIds, handleDeleteSelected])

  // 마우스 휠 줌 (포인터 위치 기준)
  useEffect(() => {
    const el = canvasAreaRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      // 컨테이너 내 마우스 좌표
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      setZoom(prevZoom => {
        const newZoom = Math.min(8, Math.max(0.1, prevZoom * factor))
        setPan(prevPan => {
          const worldOffsetX = (mx - rect.width / 2 - prevPan.x) / prevZoom
          const worldOffsetY = (my - rect.height / 2 - prevPan.y) / prevZoom
          return {
            x: mx - rect.width / 2 - worldOffsetX * newZoom,
            y: my - rect.height / 2 - worldOffsetY * newZoom,
          }
        })
        return newZoom
      })
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

  const handleInteractionEnd = useCallback(() => {
    setTimeout(() => saveSnapshot(), 0)
  }, [saveSnapshot])

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
          toggleTool={(tool) => {
            const cx = 1500 - pan.x / zoom;
            const cy = 1000 - pan.y / zoom;
            toggleTool(tool, { x: cx, y: cy });
          }}
          toolsVisible={toolsVisible}
          background={state.background}
          setBackground={setBackground}
        />

        {/* 캔버스 영역 */}
        <div
          ref={canvasAreaRef}
          className="canvas-area relative flex-1 bg-gray-200 overflow-hidden"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* 줌/팬 래퍼 (고정 3000x2000 캔버스) */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 3000,
              height: 2000,
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
              transformOrigin: 'center center',
              backgroundColor: 'white',
              boxShadow: '0 0 40px rgba(0,0,0,0.1)',
            }}
          >
            <BackgroundLayer background={state.background} />
            <DrawingCanvas
              canvasRef={canvasRef}
              activeTool={state.drawMode}
              strokeColor={state.strokeColor}
              strokeWidth={state.strokeWidth}
              onDrawEnd={handleInteractionEnd}
              onAddShape={handleAddShape}
              ruler={state.ruler}
            />
            <SelectionLayer
              active={state.drawMode === 'select'}
              shapes={state.shapes}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              onMoveShapes={handleMoveSelected}
              onFinishMove={handleFinishMove}
              onDeleteSelected={handleDeleteSelected}
            />
            {state.compass.visible && (
              <CompassTool
                compass={state.compass}
                setCompass={setCompass}
                canvasRef={canvasRef}
                strokeColor={state.strokeColor}
                strokeWidth={state.strokeWidth}
                onDraw={handleInteractionEnd}
                onInteractionEnd={handleInteractionEnd}
                onAddShape={handleAddShape}
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
                onDraw={handleInteractionEnd}
                onInteractionEnd={handleInteractionEnd}
              />
            )}
            {state.protractor.visible && (
              <ProtractorTool
                protractor={state.protractor}
                setProtractor={setProtractor}
                onInteractionEnd={handleInteractionEnd}
              />
            )}
          </div>

          {/* 줌 레벨 및 단축키 안내 */}
          <div className="absolute bottom-14 left-2 text-[11px] text-gray-400 bg-white/70 px-2 py-0.5 rounded pointer-events-none">
            {Math.round(zoom * 100)}% | S: 선택 | P: 펜 | V: 이동 | Del: 삭제 | 우클릭+드래그: 팬 | 휠: 줌
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
