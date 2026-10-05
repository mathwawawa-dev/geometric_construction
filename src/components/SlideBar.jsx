// SlideBar.jsx — 상단 슬라이드 탭 바
export default function SlideBar({ slides, currentIdx, onSwitch, onAdd, onDelete }) {
  return (
    <div className="flex items-center px-2 py-1 bg-gray-100 border-b border-gray-200 overflow-x-auto gap-1 min-h-[34px]">
      {slides.map((slide, i) => (
        <button
          key={slide.id}
          onClick={() => onSwitch(i)}
          className={`group relative flex items-center gap-1 px-3 py-[3px] rounded text-xs whitespace-nowrap transition-colors ${
            i === currentIdx
              ? 'bg-white border border-blue-400 text-blue-600 font-semibold shadow-sm'
              : 'bg-gray-200 hover:bg-white hover:border hover:border-gray-300 text-gray-600'
          }`}
        >
          슬라이드 {i + 1}
          {slides.length > 1 && (
            <span
              onClick={(e) => { e.stopPropagation(); onDelete(i) }}
              className="ml-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-xs font-bold leading-none"
              title="슬라이드 삭제"
            >
              ✕
            </span>
          )}
        </button>
      ))}
      <button
        onClick={onAdd}
        className="px-2 py-[3px] rounded text-xs bg-blue-50 hover:bg-blue-100 text-blue-500 font-medium whitespace-nowrap"
        title="슬라이드 추가"
      >
        + 슬라이드
      </button>
    </div>
  )
}
