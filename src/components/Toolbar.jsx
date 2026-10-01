const WIDTH_OPTIONS = [
  { label: '얇게', value: 1.5 },
  { label: '보통', value: 3 },
  { label: '굵게', value: 6 },
]

const COLOR_PRESETS = [
  { color: '#000000', label: '검정', bg: '#000000' },
  { color: '#dc2626', label: '빨강', bg: '#dc2626' },
  { color: '#2563eb', label: '파랑', bg: '#2563eb' },
  { color: '#ec4899', label: '핑크', bg: '#ec4899' },
]

export default function Toolbar({ strokeColor, strokeWidth, setColor, setWidth, onUndo, onRedo, onClear, onSave, highlightMode, setHighlightMode, snapEnabled, setSnapEnabled }) {
  return (
    <header className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200 shrink-0 flex-wrap">
      <h1 className="text-lg font-bold text-gray-800 mr-2">작도보드</h1>

      {/* 실행 취소 / 재실행 */}
      <button
        onClick={onUndo}
        title="실행 취소 (Ctrl+Z)"
        className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-base transition-colors"
      >↩</button>
      <button
        onClick={onRedo}
        title="재실행 (Ctrl+Y)"
        className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-base transition-colors"
      >↪</button>

      <div className="w-px h-6 bg-gray-300" />

      {/* 색상 선택 + 프리셋 */}
      <div className="flex items-center gap-1.5">
        <label className="flex items-center gap-1 text-xs text-gray-600">
          색상
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-gray-300"
          />
        </label>
        {COLOR_PRESETS.map((p) => (
          <button
            key={p.color}
            title={p.label}
            onClick={() => setColor(p.color)}
            style={{ backgroundColor: p.bg }}
            className={`w-7 h-7 rounded-full border-2 transition-all ${
              strokeColor === p.color
                ? 'border-gray-600 scale-110 shadow-md'
                : 'border-gray-200 hover:border-gray-500'
            }`}
          />
        ))}
      </div>

      <div className="w-px h-6 bg-gray-300" />

      {/* 형광펜 */}
      <button
        onClick={() => setHighlightMode(!highlightMode)}
        title="형광펜 (반투명 굵은 선)"
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
          highlightMode
            ? 'bg-yellow-200 text-yellow-900 border-yellow-400 shadow-inner'
            : 'bg-gray-100 hover:bg-yellow-100 text-gray-700 border-gray-200'
        }`}
      >
        <span>🖊</span> 형광펜
      </button>

      {/* 자석 (스냅) ON/OFF */}
      <button
        onClick={() => setSnapEnabled(!snapEnabled)}
        title={snapEnabled ? "자석 스냅 켜짐 (단축키: M)" : "자석 스냅 꺼짐 (단축키: M)"}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
          snapEnabled
            ? 'bg-blue-100 text-blue-900 border-blue-400 shadow-sm'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-500 border-gray-200'
        }`}
      >
        <span className="text-sm" style={{ filter: snapEnabled ? 'none' : 'grayscale(100%) opacity(50%)' }}>🧲</span>
        <span>스냅 (M)</span>
      </button>

      <div className="w-px h-6 bg-gray-300" />

      {/* 굵기 */}
      <div className="flex gap-1 items-center">
        {WIDTH_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setWidth(opt.value)}
            title={opt.label}
            className={`px-2 py-1 rounded text-xs transition-colors
              ${strokeWidth === opt.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-gray-300" />

      {/* 전체 지우기 */}
      <button
        onClick={onClear}
        className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-700 text-xs font-medium transition-colors"
      >
        전체 지우기
      </button>

      {/* PNG 저장 */}
      <button
        onClick={onSave}
        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors ml-auto"
      >
        PNG 저장
      </button>
    </header>
  )
}
