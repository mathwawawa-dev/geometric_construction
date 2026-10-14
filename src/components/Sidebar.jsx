import { useRef, useState, useEffect } from 'react'

// 드로잉 모드 버튼 (캔버스 인터랙션)
const drawModes = [
  { id: 'pen',    icon: '✏️', label: '펜 (P)' },
  { id: 'text',   icon: '🔤', label: '텍스트 (T)' },
  { id: 'line',   icon: '➖', label: '선분 (L)' },
  { id: 'select', icon: '↖️', label: '선택 (S)' },
]

// 수학 작도용 컴퍼스(제도기) SVG 아이콘
const CompassIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v3" />
    <circle cx="12" cy="7" r="2" />
    <path d="M10.5 8.5L5 21" />
    <path d="M13.5 8.5L19 21" />
    <path d="M7.5 14h9" />
    <circle cx="12" cy="14" r="1.2" fill="currentColor" />
  </svg>
)

// 수학 반원 각도기 SVG 아이콘
const ProtractorIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 18h18" />
    <path d="M21 18a9 9 0 0 0-18 0" />
    <path d="M8 18a4 4 0 0 1 8 0" />
    <circle cx="12" cy="18" r="1" fill="currentColor" />
    <path d="M12 9v2.5" />
    <path d="M5.6 11.6l1.8 1.8" />
    <path d="M18.4 11.6l-1.8 1.8" />
  </svg>
)

// 도구 토글 버튼 (독립적으로 on/off, 동시에 여러 개 활성 가능)
const toolDefs = [
  { id: 'compass',    icon: <CompassIcon />,    label: '컴퍼스' },
  { id: 'ruler',      icon: <span>📏</span>,    label: '자' },
  { id: 'protractor', icon: <ProtractorIcon />, label: '각도기' },
]

// 넘버스탬프 목록 ①~⑮
export const STAMPS = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮']

export default function Sidebar({ drawMode, setDrawMode, toggleTool, toolsVisible, background, setBackground, stampMode, setStampMode, onLineRightClick }) {
  const fileRef = useRef(null)
  const [lastStamp, setLastStamp] = useState('①')
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef(null)

  // 외부(날인/휠 등)에서 stampMode가 바뀔 때 마지막 번호 기억
  useEffect(() => {
    if (stampMode) setLastStamp(stampMode)
  }, [stampMode])

  // 팝오버 외부 클릭 시 닫기
  useEffect(() => {
    if (!showPicker) return
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [showPicker])

  const currentStamp = stampMode || lastStamp || '①'

  // 스탬프 번호 n단계 변경
  const changeStampBy = (delta) => {
    const idx = STAMPS.indexOf(currentStamp)
    if (idx < 0) return
    const nextIdx = Math.max(0, Math.min(STAMPS.length - 1, idx + delta))
    const nextStamp = STAMPS[nextIdx]
    setLastStamp(nextStamp)
    setStampMode(nextStamp)
    setDrawMode('pen')
  }

  // 사이드바 위젯 위 휠 스크롤로 번호 변경 (휠 up: 증가, 휠 down: 감소)
  const handleWidgetWheel = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const delta = e.deltaY < 0 ? 1 : -1
    changeStampBy(delta)
  }

  // 메인 스탬프 토글
  const handleToggleStamp = () => {
    if (stampMode) {
      setStampMode(null)
    } else {
      setStampMode(lastStamp)
      setDrawMode('pen')
    }
  }

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setBackground({ src: ev.target.result, locked: true, opacity: 1 })
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <aside className="flex flex-col items-center gap-2 p-2 bg-gray-50 border-r border-gray-200 w-16 shrink-0 overflow-y-auto">

      {/* ─── 드로잉 모드 ─── */}
      {drawModes.map((m) => (
        <button
          key={m.id}
          onClick={() => { setDrawMode(m.id); setStampMode(null) }}
          onContextMenu={(e) => {
            if (m.id === 'line' && onLineRightClick) {
              e.preventDefault();
              onLineRightClick();
            }
          }}
          title={m.label}
          className={`w-12 h-12 rounded-xl border flex flex-col items-center justify-center text-xl transition-colors
            ${drawMode === m.id && !stampMode
              ? 'bg-blue-100 border-blue-500 ring-1 ring-blue-500 shadow'
              : 'bg-white hover:bg-gray-100 border-gray-200'
            }`}
        >
          <span>{m.icon}</span>
          <span className="text-[9px] text-gray-500 leading-none mt-0.5">{m.label}</span>
        </button>
      ))}

      <div className="w-10 border-t border-gray-300 my-1" />

      {/* ─── 넘버스탬프 (단일 스마트 위젯) ─── */}
      <div className="relative flex flex-col items-center">
        <div
          onWheel={handleWidgetWheel}
          onContextMenu={(e) => {
            e.preventDefault()
            setShowPicker(prev => !prev)
          }}
          title={`넘버스탬프 ${currentStamp}\n• 클릭: 켜기/끄기\n• 휠/화살표: 번호 변경\n• 우클릭: 전체 번호 목록`}
          className={`w-12 rounded-xl border flex flex-col items-center justify-between p-1 transition-colors select-none ${
            stampMode
              ? 'bg-orange-100 border-orange-400 ring-1 ring-orange-400 text-orange-700 shadow'
              : 'bg-white hover:bg-orange-50/50 border-gray-200 text-gray-700'
          }`}
        >
          {/* 다음 번호(증가) ▲ */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              changeStampBy(1)
            }}
            disabled={STAMPS.indexOf(currentStamp) === STAMPS.length - 1}
            title="다음 번호 (+1)"
            className="w-full text-[10px] text-gray-400 hover:text-orange-600 disabled:opacity-20 flex items-center justify-center py-0.5 leading-none transition-colors"
          >
            ▲
          </button>

          {/* 중앙 현재 번호 (클릭 시 토글) */}
          <button
            type="button"
            onClick={handleToggleStamp}
            title={`클릭하여 도장 ${stampMode ? '끄기' : '켜기'}`}
            className="w-full text-center text-xl font-bold leading-tight py-0.5 hover:scale-105 active:scale-95 transition-transform"
          >
            {currentStamp}
          </button>

          {/* 이전 번호(감소) ▼ */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              changeStampBy(-1)
            }}
            disabled={STAMPS.indexOf(currentStamp) === 0}
            title="이전 번호 (-1)"
            className="w-full text-[10px] text-gray-400 hover:text-orange-600 disabled:opacity-20 flex items-center justify-center py-0.5 leading-none transition-colors"
          >
            ▼
          </button>
        </div>

        {/* 퀵 셀렉터 팝오버 (우클릭 시 표시) */}
        {showPicker && (
          <div
            ref={pickerRef}
            className="absolute left-14 top-0 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-2 w-44"
          >
            <div className="text-[10px] text-gray-500 font-semibold mb-1.5 px-1 flex justify-between items-center">
              <span>도장 번호 선택</span>
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="text-gray-400 hover:text-gray-700 text-xs font-bold leading-none"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {STAMPS.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => {
                    setLastStamp(ch)
                    setStampMode(ch)
                    setDrawMode('pen')
                    setShowPicker(false)
                  }}
                  className={`h-8 rounded-lg text-sm font-bold flex items-center justify-center transition-all ${
                    currentStamp === ch && stampMode
                      ? 'bg-orange-500 text-white shadow'
                      : 'bg-gray-50 hover:bg-orange-100 text-gray-700'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="w-10 border-t border-gray-300 my-1" />

      {/* ─── 도구 토글 (동시 표시 가능) ─── */}
      {toolDefs.map((t) => {
        const isOn = toolsVisible[t.id]
        return (
          <button
            key={t.id}
            onClick={() => toggleTool(t.id)}
            title={`${t.label} ${isOn ? '숨기기' : '표시'}`}
            className={`w-12 h-12 rounded-xl border flex flex-col items-center justify-center text-xl transition-colors
              ${isOn
                ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500 shadow text-emerald-700'
                : 'bg-white hover:bg-gray-100 border-gray-200 text-gray-700'
              }`}
          >
            <span className="flex items-center justify-center w-6 h-6">{t.icon}</span>
            <span className="text-[9px] text-gray-500 leading-none mt-0.5">{t.label}</span>
          </button>
        )
      })}

      <div className="w-10 border-t border-gray-300 my-1" />

      {/* ─── 배경 이미지 ─── */}
      <button
        onClick={() => fileRef.current?.click()}
        title="배경 이미지 업로드"
        className="w-12 h-12 rounded-xl border border-gray-200 flex flex-col items-center justify-center text-xl bg-white hover:bg-gray-100 transition-colors"
      >
        <span>🖼️</span>
        <span className="text-[9px] text-gray-500 leading-none mt-0.5">배경</span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {background.src && (
        <>
          <button
            onClick={() => setBackground({ locked: !background.locked })}
            title={background.locked ? '배경 잠금 해제' : '배경 잠금'}
            className={`w-12 h-12 rounded-xl border flex flex-col items-center justify-center text-xl transition-colors
              ${background.locked ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'}`}
          >
            <span>{background.locked ? '🔒' : '🔓'}</span>
            <span className="text-[9px] text-gray-500 leading-none mt-0.5">잠금</span>
          </button>

          <div className="flex flex-col items-center gap-1 mt-1">
            <span className="text-[9px] text-gray-500">불투명도</span>
            <input
              type="range" min="0.1" max="1" step="0.05"
              value={background.opacity}
              onChange={(e) => setBackground({ opacity: parseFloat(e.target.value) })}
              className="w-2 h-20 cursor-pointer"
              style={{ writingMode: 'vertical-lr', direction: 'rtl', appearance: 'slider-vertical' }}
            />
            <span className="text-[9px] text-gray-400">{Math.round(background.opacity * 100)}%</span>
          </div>

          <button
            onClick={() => setBackground({ src: null })}
            className="w-12 h-8 rounded-lg text-[10px] text-red-500 border border-red-200 hover:bg-red-50 transition-all"
          >
            제거
          </button>
        </>
      )}
    </aside>
  )
}
