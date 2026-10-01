const WIDTH_OPTIONS = [
  { label: '얇게', value: 1.5 },
  { label: '보통', value: 3 },
  { label: '굵게', value: 6 },
]

const COLOR_PRESETS = [
  { color: '#000000', label: '검정', bg: '#000000' },
  { color: '#FF0000', label: '빨강', bg: '#FF0000' },
  { color: '#2563eb', label: '파랑', bg: '#2563eb' },
  { color: '#F719C0', label: '핑크', bg: '#F719C0' },
  { color: '#16a34a', label: '초록', bg: '#16a34a' },
]

export default function Toolbar({ strokeColor, strokeWidth, setColor, setWidth, onUndo, onRedo, onClear, onSave, highlightMode, setHighlightMode, snapEnabled, setSnapEnabled, compassSnapEnabled, setCompassSnapEnabled }) {
  return (
    <header className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200 shrink-0 flex-wrap">
      <h1 className="text-lg font-bold text-gray-800 mr-2">작도보드</h1>

      {/* 실행 취소 / 재실행 */}
      <div className="flex items-center gap-1">
        <button
          onClick={onUndo}
          title="실행 취소 (Ctrl+Z)"
          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
          </svg>
        </button>
        <button
          onClick={onRedo}
          title="재실행 (Ctrl+Y)"
          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 7v6h-6" />
            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
          </svg>
        </button>
      </div>

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

      <div className="flex items-center gap-1">
        {/* 형광펜 */}
        <button
          onClick={() => setHighlightMode(!highlightMode)}
          title="형광펜 (반투명 굵은 선)"
          className={`flex items-center justify-center h-8 gap-1.5 px-2.5 rounded-lg text-xs font-medium transition-colors border ${
            highlightMode
              ? 'bg-yellow-200 text-yellow-900 border-yellow-400 shadow-inner'
              : 'bg-gray-100 hover:bg-yellow-100 text-gray-700 border-gray-200'
          }`}
        >
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            style={{ filter: highlightMode ? 'none' : 'grayscale(100%) opacity(45%)' }}
          >
            {/* 형광펜 몸통 */}
            <rect x="5" y="3" width="14" height="13" rx="3" fill={highlightMode ? '#facc15' : '#d1d5db'} />
            {/* 형광펜 캡 끝 */}
            <rect x="8" y="1" width="8" height="4" rx="1.5" fill={highlightMode ? '#eab308' : '#9ca3af'} />
            {/* 형광펜 촉 (사다리꼴) */}
            <polygon points="7,16 17,16 14,22 10,22" fill={highlightMode ? '#fde047' : '#e5e7eb'} />
            {/* 하이라이트 반사 */}
            <rect x="8" y="5" width="3" height="8" rx="1.5" fill="white" opacity="0.4" />
          </svg>
          형광펜
        </button>

        {/* 자석 (스냅) ON/OFF */}
        <button
          onClick={() => setSnapEnabled(!snapEnabled)}
          title={snapEnabled ? "자석 스냅 켜짐 (단축키: M)" : "자석 스냅 꺼짐 (단축키: M)"}
          className={`flex items-center justify-center h-8 gap-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all border ${
            snapEnabled
              ? 'bg-blue-100 text-blue-900 border-blue-400 shadow-sm'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-500 border-gray-200'
          }`}
        >
          <span className="text-[14px] leading-none flex items-center" style={{ filter: snapEnabled ? 'none' : 'grayscale(100%) opacity(50%)' }}>🧲</span>
          <span>스냅 (M)</span>
        </button>

        {/* 컴퍼스 전용 스냅 ON/OFF */}
        {setCompassSnapEnabled && (
          <button
            onClick={() => setCompassSnapEnabled(!compassSnapEnabled)}
            title={compassSnapEnabled ? "컴퍼스 스냅 켜짐" : "컴퍼스 스냅 꺼짐"}
            className={`flex items-center justify-center h-8 gap-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all border ${
              compassSnapEnabled
                ? 'bg-blue-100 text-blue-900 border-blue-400 shadow-sm'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-500 border-gray-200'
            }`}
          >
            <span className="text-[14px] leading-none flex items-center" style={{ filter: compassSnapEnabled ? 'none' : 'grayscale(100%) opacity(50%)' }}>🧲🧭</span>
            <span>컴퍼스 스냅</span>
          </button>
        )}
      </div>
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
