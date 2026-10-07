import { useRef, useEffect, useCallback, useState, startTransition } from 'react'
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

if (typeof window !== 'undefined') {
  window.onerror = function(message, source, lineno, colno, error) {
    alert("Runtime Error: " + message + "\nLine: " + lineno + "\nStack: " + (error ? error.stack : ""));
  };
}

const VERSION = 'v0.2.37_20261007_185800_5px미니freeze끝점튐방지'

export default function App() {
  const canvasRef = useRef(null)
  const canvasAreaRef = useRef(null)
  const {
    state,
    setDrawMode, toggleTool,
    setColor, setWidth,
    setCompass, setRuler, setProtractor,
    setBackground,
    addShape, setShapes, deleteShapes, updateShape, moveShapes,
  } = useAppState()
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  // ── 슬라이드 관리 ──────────────────────────────────────────
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0)
  const currentSlideIdxRef = useRef(0)
  const slidesRef = useRef([{
    id: 'slide_1',
    shapes: [],
    background: { src: null, opacity: 0.3 },
    historySnapshot: null,
    canvasSnapshot: null,
  }])
  const [slidesMeta, setSlidesMeta] = useState([{ id: 'slide_1' }])
  // ────────────────────────────────────────────────────────────

  // 개체 선택 상태
  const [selectedIds, setSelectedIds] = useState([])

  // 형광펜 / 넘버스탬프 모드
  const [highlightMode, setHighlightMode] = useState(false)
  const [stampMode, setStampMode] = useState(null)

  // 자석(스냅) ON/OFF 상태 (기본값 OFF - 컴퍼스는 별도 ON 유지)
  const [snapEnabled, setSnapEnabled] = useState(false)
  // 컴퍼스 전용 스냅 (기본값 ON, 전역 스냅과 독립적)
  const [compassSnapEnabled, setCompassSnapEnabled] = useState(true)


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

  const { saveSnapshot, undo, redo, clear, getHistorySnapshot, restoreHistorySnapshot } = useHistory(canvasRef, getStateRef, restoreState)

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
    // renderShapes: 캔버스는 다음 프레임에 즉시 갱신
    requestAnimationFrame(() => {
      if (canvasRef.current) {
        const updated = [...stateRef.current.shapes, shape]
        renderShapes(canvasRef.current.getContext('2d'), updated)
      }
    })
    // React 상태 업데이트는 낮은 우선순위로 지연 → mouseup 직후 mousemove가 먼저 처리됨
    startTransition(() => {
      addShape(shape)
    })
    setTimeout(() => saveSnapshot(), 0)
  }, [addShape, saveSnapshot, canvasRef])



  const handleUpdateShape = useCallback((id, payload) => {
    updateShape(id, payload)
    if (canvasRef.current) {
      const updated = stateRef.current.shapes.map(s => s.id === id ? { ...s, ...payload } : s)
      renderShapes(canvasRef.current.getContext('2d'), updated)
    }
    setTimeout(() => saveSnapshot(), 0)
  }, [updateShape, canvasRef, saveSnapshot])

  // 줌/팬 상태
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  const handleLineRightClick = useCallback(() => {
    const lenStr = prompt("원하는 선분의 길이를 입력하세요 (예: 3.5)", "3.5")
    if (lenStr === null) return

    const len = parseFloat(lenStr)
    if (isNaN(len) || len <= 0) {
      alert("올바른 양수를 입력해주세요.")
      return
    }

    // 1단위 = 100px 로 가정
    const PIXELS_PER_UNIT = 100
    const pixelLength = len * PIXELS_PER_UNIT

    // 현재 뷰포트의 중앙 좌표 계산
    const cx = 1500 - pan.x / zoom
    const cy = 1000 - pan.y / zoom

    // 좌측 끝점을 화면 중앙에서 200px 왼쪽으로 고정 → 여러 선분의 왼쪽이 정렬됨
    const startX = cx - 200

    const newShape = {
      id: 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      type: 'segment',
      color: stateRef.current.strokeColor,
      width: stateRef.current.strokeWidth,
      alpha: 1,
      x1: startX,
      y1: cy,
      x2: startX + pixelLength,
      y2: cy,
    }

    handleAddShape(newShape)
  }, [pan, zoom, handleAddShape])

  const clipboardRef = useRef([])

  // 키보드 단축키 (S: 선택, P: 펜, T: 텍스트, M: 스냅토글, Delete/Backspace: 삭제, Ctrl+C/V: 복사/붙여넣기)
  useEffect(() => {
    const handler = (e) => {
      // 입력 필드 포커스 시 단축키 무시
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo() }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo() }
      
      // Ctrl + C: 복사
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        if (selectedIds.length > 0) {
          e.preventDefault()
          const copied = stateRef.current.shapes.filter(s => selectedIds.includes(s.id))
          clipboardRef.current = JSON.parse(JSON.stringify(copied))
        }
      }
      
      // Ctrl + V: 붙여넣기
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        if (clipboardRef.current.length > 0) {
          e.preventDefault()
          const newShapes = clipboardRef.current.map(s => {
            const newId = (s.type || 's').charAt(0) + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
            const offset = 20
            const ns = { ...s, id: newId }
            if (ns.type === 'path' || ns.type === 'stroke' || ns.type === 'eraser') {
              ns.points = ns.points.map(p => ({ x: p.x + offset, y: p.y + offset }))
            } else if (ns.type === 'line' || ns.type === 'arrow') {
              ns.x1 += offset; ns.y1 += offset; ns.x2 += offset; ns.y2 += offset
            } else if (ns.type === 'circle' || ns.type === 'arc') {
              ns.cx += offset; ns.cy += offset
              if (ns.type === 'arc' && ns.points) {
                ns.points = ns.points.map(p => ({ x: p.x + offset, y: p.y + offset }))
              }
            } else if (ns.type === 'rect' || ns.type === 'text') {
              ns.x += offset; ns.y += offset
            } else if (ns.type === 'stamp') {
              ns.x += offset; ns.y += offset
            }
            return ns
          })
          
          const updated = [...stateRef.current.shapes, ...newShapes]
          setShapes(updated)
          stateRef.current.shapes = updated
          if (canvasRef.current) {
            renderShapes(canvasRef.current.getContext('2d'), updated)
          }

          setDrawMode('select')
          setSelectedIds(newShapes.map(s => s.id))
          setTimeout(() => saveSnapshot(), 0)
        }
      }

      // S 키: 선택(Select) 모드 토글
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        setDrawMode(state.drawMode === 'select' ? 'pen' : 'select')
      }
      // P 키: 펜 모드
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        setDrawMode('pen')
        setStampMode(null)
      }
      // T 키: 텍스트 모드
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        setDrawMode('text')
        setStampMode(null)
      }
      // L 키: 선분 모드
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        setDrawMode('line')
        setStampMode(null)
      }
      // M 키: 자석(스냅) ON/OFF 토글
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        setSnapEnabled(prev => !prev)
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
  }, [undo, redo, setDrawMode, state.drawMode, selectedIds, handleDeleteSelected, setStampMode, saveSnapshot])

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
      download(merged, currentSlideIdxRef.current + 1)
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

  // ── 세션 저장 / 불러오기 ─────────────────────────────────────

  const saveCurrentSlideData = useCallback(() => {
    const slide = slidesRef.current[currentSlideIdxRef.current]
    const canvas = canvasRef.current
    if (canvas) {
      slide.canvasSnapshot = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
    }
    slide.shapes = JSON.parse(JSON.stringify(stateRef.current.shapes))
    slide.background = { ...stateRef.current.background }
    slide.historySnapshot = getHistorySnapshot()
  }, [canvasRef, getHistorySnapshot])

  /** 지정된 슬라이드로 전환 */
  const switchSlide = useCallback((newIdx) => {
    if (newIdx === currentSlideIdxRef.current) return
    saveCurrentSlideData()

    const newSlide = slidesRef.current[newIdx]
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (newSlide.canvasSnapshot) {
        ctx.putImageData(newSlide.canvasSnapshot, 0, 0)
      } else if (newSlide.shapes.length > 0) {
        renderShapes(ctx, newSlide.shapes)
      }
    }
    setShapes(newSlide.shapes)
    setBackground(newSlide.background)
    restoreHistorySnapshot(newSlide.historySnapshot ?? { stack: [], index: -1 })

    currentSlideIdxRef.current = newIdx
    setCurrentSlideIdx(newIdx)
    setTimeout(() => saveSnapshot(), 50)
  }, [saveCurrentSlideData, canvasRef, setShapes, setBackground, restoreHistorySnapshot, saveSnapshot])

  /** 슬라이드 추가 */
  const addSlide = useCallback(() => {
    saveCurrentSlideData()
    const newSlide = {
      id: 'slide_' + Date.now(),
      shapes: [],
      background: { src: null, opacity: 0.3 },
      historySnapshot: null,
      canvasSnapshot: null,
    }
    slidesRef.current = [...slidesRef.current, newSlide]
    setSlidesMeta(slidesRef.current.map(s => ({ id: s.id })))

    const newIdx = slidesRef.current.length - 1
    const canvas = canvasRef.current
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    setShapes([])
    setBackground({ src: null, opacity: 0.3 })
    restoreHistorySnapshot({ stack: [], index: -1 })

    currentSlideIdxRef.current = newIdx
    setCurrentSlideIdx(newIdx)
    setTimeout(() => saveSnapshot(), 50)
  }, [saveCurrentSlideData, canvasRef, setShapes, setBackground, restoreHistorySnapshot, saveSnapshot])

  /** 슬라이드 삭제 */
  const deleteSlide = useCallback((delIdx) => {
    if (slidesRef.current.length <= 1) return
    saveCurrentSlideData()

    const newSlides = slidesRef.current.filter((_, i) => i !== delIdx)
    slidesRef.current = newSlides
    setSlidesMeta(newSlides.map(s => ({ id: s.id })))

    let newActiveIdx = currentSlideIdxRef.current
    if (delIdx < newActiveIdx) newActiveIdx -= 1
    else if (delIdx === newActiveIdx) newActiveIdx = Math.min(newActiveIdx, newSlides.length - 1)

    const slide = newSlides[newActiveIdx]
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (slide.canvasSnapshot) ctx.putImageData(slide.canvasSnapshot, 0, 0)
      else if (slide.shapes.length > 0) renderShapes(ctx, slide.shapes)
    }
    setShapes(slide.shapes)
    setBackground(slide.background)
    restoreHistorySnapshot(slide.historySnapshot ?? { stack: [], index: -1 })

    currentSlideIdxRef.current = newActiveIdx
    setCurrentSlideIdx(newActiveIdx)
  }, [saveCurrentSlideData, canvasRef, setShapes, setBackground, restoreHistorySnapshot])


  // ────────────────────────────────────────────────────────────

  /** 모든 슬라이드 데이터를 JSON 파일로 저장 */
  const handleSessionSave = useCallback(() => {
    saveCurrentSlideData()  // 현재 슬라이드 최신화
    const sessionData = {
      version: '1.0',
      savedAt: new Date().toISOString(),
      slides: slidesRef.current.map(s => ({
        id: s.id,
        shapes: s.shapes,
        background: s.background,
      })),
      currentSlideIdx: currentSlideIdxRef.current,
    }
    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const now = new Date()
    const dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0')
    const timeStr = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0')
    link.download = `작도보드_${dateStr}_${timeStr}.json`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }, [saveCurrentSlideData])

  /** JSON 파일을 읽어 모든 슬라이드 복원 */
  const handleSessionLoad = useCallback((file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        if (!data.slides || !Array.isArray(data.slides)) {
          alert('올바른 작도보드 저장 파일이 아닙니다.')
          return
        }
        const newSlides = data.slides.map(s => ({
          id: s.id || ('slide_' + Date.now()),
          shapes: Array.isArray(s.shapes) ? s.shapes : [],
          background: s.background || { src: null, opacity: 0.3 },
          historySnapshot: null,
          canvasSnapshot: null,
        }))
        slidesRef.current = newSlides
        setSlidesMeta(newSlides.map(s => ({ id: s.id })))

        const targetIdx = Math.min(data.currentSlideIdx ?? 0, newSlides.length - 1)
        const targetSlide = newSlides[targetIdx]

        // 1. 상태 업데이트
        setBackground(targetSlide.background)
        restoreState(null, targetSlide.shapes)
        restoreHistorySnapshot({ stack: [], index: -1 })
        
        currentSlideIdxRef.current = targetIdx
        setCurrentSlideIdx(targetIdx)

        // 2. React 렌더링 이후 강제 다시 그리기 (이중 안전장치)
        setTimeout(() => {
          const c = canvasRef.current
          if (c) {
            renderShapes(c.getContext('2d'), targetSlide.shapes)
          }
          saveSnapshot()
          if (targetSlide.shapes.length === 0) {
            alert('불러온 파일에 도형 데이터가 없습니다. (빈 화면 저장됨)')
          }
        }, 150)
      } catch (err) {
        console.error(err)
        alert('파일을 불러오는 중 오류가 발생했습니다.')
      }
    }
    reader.readAsText(file)
  }, [canvasRef, setBackground, restoreState, restoreHistorySnapshot, saveSnapshot])

  // ────────────────────────────────────────────────────────────
  // ────────────────────────────────────────────────────────────

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
        highlightMode={highlightMode}
        setHighlightMode={setHighlightMode}
        snapEnabled={snapEnabled}
        setSnapEnabled={setSnapEnabled}
        compassSnapEnabled={compassSnapEnabled}
        setCompassSnapEnabled={setCompassSnapEnabled}
        slideCount={slidesMeta.length}
        currentSlideIdx={currentSlideIdx}
        onPrevSlide={() => switchSlide(currentSlideIdx - 1)}
        onNextSlide={() => switchSlide(currentSlideIdx + 1)}
        onAddSlide={addSlide}
        onDeleteSlide={() => {
          if (window.confirm(`슬라이드 ${currentSlideIdx + 1}을(를) 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`)) {
            deleteSlide(currentSlideIdx)
          }
        }}
        onSessionSave={handleSessionSave}
        onSessionLoad={handleSessionLoad}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          drawMode={state.drawMode}
          setDrawMode={setDrawMode}
          onLineRightClick={handleLineRightClick}
          toggleTool={(tool) => {
            const cx = 1500 - pan.x / zoom;
            const cy = 1000 - pan.y / zoom;
            toggleTool(tool, { x: cx, y: cy });
            setTimeout(() => saveSnapshot(), 0);
          }}
          toolsVisible={toolsVisible}
          background={state.background}
          setBackground={setBackground}
          stampMode={stampMode}
          setStampMode={setStampMode}
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
              highlightMode={highlightMode}
              stampMode={stampMode}
              shapes={state.shapes}
              snapEnabled={snapEnabled}
            />
            <SelectionLayer
              active={state.drawMode === 'select'}
              shapes={state.shapes}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              onMoveShapes={handleMoveSelected}
              onFinishMove={handleFinishMove}
              onDeleteSelected={handleDeleteSelected}
              onUpdateShape={handleUpdateShape}
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
                shapes={state.shapes}
                snapEnabled={compassSnapEnabled}
                setSnapEnabled={setCompassSnapEnabled}
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
        </div>
      </div>

      <footer className="px-4 py-1 bg-gray-50 border-t border-gray-200 text-[11px] text-gray-400 flex items-center justify-between">
        <span>{VERSION}</span>
        <span>{Math.round(zoom * 100)}% | S: 선택 | P: 펜 | T: 텍스트 | Del: 삭제 | 우클릭+드래그: 화면 이동 | 휠: 줌</span>
      </footer>
    </div>
  )
}

function download(canvas, slideNum = 1) {
  const link = document.createElement('a')
  const now = new Date()
  const dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0')
  const timeStr = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0')
  link.download = `작도보드_슬라이드${slideNum}_${dateStr}_${timeStr}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
