import { useRef } from 'react'

const tools = [
  { id: 'pen',        icon: '✏️', label: '펜' },
  { id: 'compass',    icon: '🧭', label: '컴퍼스' },
  { id: 'ruler',      icon: '📏', label: '자' },
  { id: 'protractor', icon: '📐', label: '각도기' },
]

export default function Sidebar({ activeTool, setTool, background, setBackground }) {
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
    <aside className="flex flex-col items-center gap-2 p-2 bg-gray-50 border-r border-gray-200 w-16 shrink-0">
      {/* 도구 선택 */}
      {tools.map((t) => (
        <button
          key={t.id}
          onClick={() => setTool(t.id)}
          title={t.label}
          className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center text-xl transition-all
            ${activeTool === t.id
              ? 'bg-blue-100 ring-2 ring-blue-500 shadow'
              : 'bg-white hover:bg-gray-100 border border-gray-200'
            }`}
        >
          <span>{t.icon}</span>
          <span className="text-[9px] text-gray-500 leading-none mt-0.5">{t.label}</span>
        </button>
      ))}

      <div className="w-10 border-t border-gray-300 my-1" />

      {/* 이미지 업로드 */}
      <button
        onClick={() => fileRef.current?.click()}
        title="배경 이미지"
        className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-xl bg-white hover:bg-gray-100 border border-gray-200 transition-all"
      >
        <span>🖼️</span>
        <span className="text-[9px] text-gray-500 leading-none mt-0.5">배경</span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {/* 배경 설정 (이미지 있을 때만) */}
      {background.src && (
        <>
          {/* 잠금 토글 */}
          <button
            onClick={() => setBackground({ locked: !background.locked })}
            title={background.locked ? '배경 잠금 해제' : '배경 잠금'}
            className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center text-xl transition-all
              ${background.locked ? 'bg-red-50 border-red-300 border' : 'bg-white border border-gray-200'}`}
          >
            <span>{background.locked ? '🔒' : '🔓'}</span>
            <span className="text-[9px] text-gray-500 leading-none mt-0.5">잠금</span>
          </button>

          {/* 투명도 슬라이더 (세로) */}
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

          {/* 배경 제거 */}
          <button
            onClick={() => setBackground({ src: null })}
            title="배경 제거"
            className="w-12 h-8 rounded-lg text-[10px] text-red-500 border border-red-200 hover:bg-red-50 transition-all"
          >
            제거
          </button>
        </>
      )}
    </aside>
  )
}
