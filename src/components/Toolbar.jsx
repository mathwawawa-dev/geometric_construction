import { useState } from 'react'

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
  const [showManual, setShowManual] = useState(false)

  return (
    <>
      {/* 매뉴얼 모달 */}
      {showManual && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setShowManual(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-[580px] max-h-[80vh] overflow-y-auto p-7"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-800">📖 작도 보드 사용 설명서</h2>
              <button onClick={() => setShowManual(false)} className="text-gray-400 hover:text-gray-700 text-xl font-bold leading-none">✕</button>
            </div>

            <div className="space-y-5 text-sm text-gray-700">

              <section>
                <h3 className="font-bold text-gray-900 mb-1.5 text-base">✏️ 펜 도구 <span className="text-xs font-normal text-gray-400">(단축키: P)</span></h3>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li>캔버스에 자유롭게 선을 그립니다.</li>
                  <li><kbd className="bg-gray-100 px-1 rounded">Shift</kbd> + 드래그: 수평·수직·대각선 방향으로 직선 고정.</li>
                  <li>형광펜 모드 ON 시 반투명 노란색 형광펜으로 그립니다.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-bold text-gray-900 mb-1.5 text-base">➖ 선분 도구 <span className="text-xs font-normal text-gray-400">(단축키: L)</span></h3>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li>두 끝점을 가진 직선 선분을 그립니다.</li>
                  <li><strong>클릭 두 번:</strong> 첫 번째 점 클릭 → 마우스 이동(미리보기) → 두 번째 점 클릭으로 완성.</li>
                  <li><strong>드래그:</strong> 클릭한 채 드래그하여 한 번에 선분 완성.</li>
                  <li>양 끝점에 동그란 점이 표시됩니다.</li>
                  <li><kbd className="bg-gray-100 px-1 rounded">Shift</kbd> + 드래그/클릭: 5도 단위 각도로 고정하여 그립니다.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-bold text-gray-900 mb-1.5 text-base">🔤 텍스트 도구 <span className="text-xs font-normal text-gray-400">(단축키: T)</span></h3>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li>캔버스를 클릭하면 텍스트 입력창이 나타납니다.</li>
                  <li><kbd className="bg-gray-100 px-1 rounded">Enter</kbd>: 텍스트 확정. <kbd className="bg-gray-100 px-1 rounded">Esc</kbd>: 취소.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-bold text-gray-900 mb-1.5 text-base">↖️ 선택 도구 <span className="text-xs font-normal text-gray-400">(단축키: S)</span></h3>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li>클릭 또는 드래그로 개체를 선택합니다.</li>
                  <li>선택 후 드래그하여 이동.</li>
                  <li><kbd className="bg-gray-100 px-1 rounded">Ctrl</kbd>+<kbd className="bg-gray-100 px-1 rounded">C</kbd>: 복사 / <kbd className="bg-gray-100 px-1 rounded">Ctrl</kbd>+<kbd className="bg-gray-100 px-1 rounded">V</kbd>: 붙여넣기 (+20px 오프셋).</li>
                  <li><kbd className="bg-gray-100 px-1 rounded">Delete</kbd> 또는 <kbd className="bg-gray-100 px-1 rounded">Backspace</kbd>: 선택 개체 삭제.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-bold text-gray-900 mb-1.5 text-base">🧲 자석(스냅) <span className="text-xs font-normal text-gray-400">(단축키: M)</span></h3>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li>ON 시 기존 선·점·원 위에 펜이 가까워지면 자동으로 위치가 맞춰집니다.</li>
                  <li>자석 OFF 상태에서도 <kbd className="bg-gray-100 px-1 rounded">Ctrl</kbd> 누르는 동안 임시로 스냅 활성화.</li>
                  <li>자를 사용 중일 때 자의 테두리 선에도 스냅됩니다.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-bold text-gray-900 mb-1.5 text-base">🧭 컴퍼스</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li>힌지(중심 원)를 드래그하여 컴퍼스 전체를 이동.</li>
                  <li>연필 끝을 드래그하여 반지름 조절.</li>
                  <li>힌지를 더블클릭하면 팔 방향이 좌우로 전환됩니다.</li>
                  <li>🧲🧭 컴퍼스 스냅 ON 시 연필 끝이 기존 도형에 스냅됩니다.</li>
                  <li>연필 끝을 캔버스에 드래그하여 호·원을 그립니다.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-bold text-gray-900 mb-1.5 text-base">📏 자 / 📐 각도기</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li>자: 양 끝 핸들을 드래그하여 위치·각도 조절. 자의 가장자리 선을 따라 펜 스냅 가능.</li>
                  <li>각도기: 중심점 및 각도를 드래그하여 조절.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-bold text-gray-900 mb-1.5 text-base">도장(①~⑩)</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li>좌측 사이드바에서 도장 번호를 선택한 뒤 캔버스를 클릭하면 번호가 찍힙니다.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-bold text-gray-900 mb-1.5 text-base">기타 단축키</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li><kbd className="bg-gray-100 px-1 rounded">Ctrl</kbd>+<kbd className="bg-gray-100 px-1 rounded">Z</kbd>: 실행 취소 / <kbd className="bg-gray-100 px-1 rounded">Ctrl</kbd>+<kbd className="bg-gray-100 px-1 rounded">Y</kbd>: 다시 실행.</li>
                  <li>두께: 얇게 / 보통 / 굵게 선택 가능.</li>
                  <li>색상 프리셋: 검정·빨강·파랑·핑크·초록.</li>
                  <li>배경 이미지: 좌측 하단에서 업로드, 투명도·잠금 설정 가능.</li>
                </ul>
              </section>

            </div>
          </div>
        </div>
      )}
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

      {/* PNG 저장 + 매뉴얼 버튼 묶음 */}
      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={onSave}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
        >
          PNG 저장
        </button>
        <button
          onClick={() => setShowManual(true)}
          title="사용 설명서"
          className="w-8 h-8 rounded-full bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-500 text-sm font-bold border border-gray-200 flex items-center justify-center transition-colors"
        >
          ?
        </button>
      </div>
    </header>
    </>
  )
}
