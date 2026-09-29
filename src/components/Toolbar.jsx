const WIDTH_OPTIONS = [
  { label: '얇게', value: 1.5 },
  { label: '보통', value: 3 },
  { label: '굵게', value: 6 },
]

export default function Toolbar({ strokeColor, strokeWidth, setColor, setWidth, onUndo, onRedo, onClear, onSave }) {
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

      {/* 색상 선택 */}
      <label className="flex items-center gap-1 text-xs text-gray-600">
        색상
        <input
          type="color"
          value={strokeColor}
          onChange={(e) => setColor(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border border-gray-300"
        />
      </label>

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
