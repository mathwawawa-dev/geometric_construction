import { useRef } from 'react'

// 드로잉 모드 버튼 (캔버스 인터랙션)
const drawModes = [
  { id: 'pen',    icon: '✏️', label: '펜 (P)' },
  { id: 'text',   icon: '🔤', label: '텍스트 (T)' },
  { id: 'select', icon: '↖️', label: '선택 (S)' },
]

// 도구 토글 버튼 (독립적으로 on/off, 동시에 여러 개 활성 가능)
const toolDefs = [
  { id: 'compass',    icon: '🧭', label: '컴퍼스' },
  { id: 'ruler',      icon: '📏', label: '자' },
  { id: 'protractor', icon: '📐', label: '각도기' },
]

// 넘버스탬프 목록 ①~⑩
const STAMPS = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩']

export default function Sidebar({ drawMode, setDrawMode, toggleTool, toolsVisible, background, setBackground, stampMode, setStampMode }) {
  const fileRef = useRef(null)

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
          title={m.label}
          className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center text-xl transition-all
            ${drawMode === m.id && !stampMode
              ? 'bg-blue-100 ring-2 ring-blue-500 shadow'
              : 'bg-white hover:bg-gray-100 border border-gray-200'
            }`}
        >
          <span>{m.icon}</span>
          <span className="text-[9px] text-gray-500 leading-none mt-0.5">{m.label}</span>
        </button>
      ))}

      <div className="w-10 border-t border-gray-300 my-1" />

      {/* ─── 넘버스탬프 ─── */}
      <span className="text-[9px] text-gray-400 leading-none">도장</span>
      <div className="flex flex-col gap-1">
        {STAMPS.map((ch) => (
          <button
            key={ch}
            title={`넘버스탬프 ${ch}`}
            onClick={() => {
              const next = stampMode === ch ? null : ch
              setStampMode(next)
              if (next) setDrawMode('pen')
            }}
            className={`w-12 h-8 rounded-lg text-base font-bold flex items-center justify-center transition-all ${
              stampMode === ch
                ? 'bg-orange-100 ring-2 ring-orange-400 text-orange-700'
                : 'bg-white hover:bg-orange-50 border border-gray-200 text-gray-700'
            }`}
          >
            {ch}
          </button>
        ))}
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
            className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center text-xl transition-all
              ${isOn
                ? 'bg-emerald-50 ring-2 ring-emerald-500 shadow'
                : 'bg-white hover:bg-gray-100 border border-gray-200'
              }`}
          >
            <span>{t.icon}</span>
            <span className="text-[9px] text-gray-500 leading-none mt-0.5">{t.label}</span>
          </button>
        )
      })}

      <div className="w-10 border-t border-gray-300 my-1" />

      {/* ─── 배경 이미지 ─── */}
      <button
        onClick={() => fileRef.current?.click()}
        title="배경 이미지 업로드"
        className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-xl bg-white hover:bg-gray-100 border border-gray-200 transition-all"
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
            className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center text-xl transition-all
              ${background.locked ? 'bg-red-50 border-red-300 border' : 'bg-white border border-gray-200'}`}
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
