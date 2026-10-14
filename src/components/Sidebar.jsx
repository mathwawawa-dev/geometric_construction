import { useRef, useState, useEffect } from 'react'

// 드로잉 모드 버튼 (캔버스 인터랙션)
const drawModes = [
  { id: 'pen',    icon: '✏️', label: '펜 (P)' },
  { id: 'text',   icon: '🔤', label: '텍스트 (T)' },
  { id: 'line',   icon: '➖', label: '선분 (L)' },
  { id: 'select', icon: '↖️', label: '선택 (S)' },
]

// 실제 컴퍼스 도구 그래픽을 축약한 정밀 미니어처 SVG (어두운 메탈 다리 색상 적용)
const CompassIcon = () => (
  <svg width="24" height="27" viewBox="0 0 30 34" fill="none" className="shrink-0 drop-shadow-sm">
    {/* 상단 손잡이 (검정 캡) */}
    <rect x="13.2" y="0.8" width="3.6" height="6.8" rx="1.8" fill="#0f172a" />
    <rect x="14.2" y="2.2" width="1.6" height="3.8" rx="0.8" fill="#334155" />

    {/* 힌지 원형 관절 */}
    <circle cx="15" cy="8" r="3.8" fill="#0f172a" stroke="#334155" strokeWidth="0.8" />
    <circle cx="15" cy="8" r="1.5" fill="#475569" />
    <circle cx="15" cy="8" r="0.8" fill="#94a3b8" />

    {/* 왼쪽 침핀 다리 (어두운 메탈 바디) */}
    <line x1="14.4" y1="9.2" x2="5.5" y2="25" stroke="#475569" strokeWidth="2.6" strokeLinecap="round" />
    <line x1="14.4" y1="9.2" x2="5.5" y2="25" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" />

    {/* 침핀 홀더 (검정 캡) */}
    <line x1="5.5" y1="25" x2="4" y2="28.5" stroke="#0f172a" strokeWidth="3.4" strokeLinecap="butt" />
    {/* 금속 바늘 */}
    <line x1="4" y1="28.5" x2="2.7" y2="31.8" stroke="#64748b" strokeWidth="1" strokeLinecap="round" />
    {/* 침핀 끝 빨간 볼 */}
    <circle cx="1.8" cy="33" r="1.6" fill="#dc2626" />

    {/* 오른쪽 연필 다리 (어두운 메탈 바디) */}
    <line x1="15.6" y1="9.2" x2="23.5" y2="25" stroke="#475569" strokeWidth="2.6" strokeLinecap="round" />
    <line x1="15.6" y1="9.2" x2="23.5" y2="25" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" />

    {/* 오른쪽 관절 조인트 및 수평 클램프 팔 */}
    <circle cx="23.5" cy="25" r="1.9" fill="#0f172a" />
    <line x1="23.5" y1="25" x2="26.2" y2="25" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" />

    {/* 연필 클램프 칼라 */}
    <rect x="25.2" y="23.5" width="2.4" height="3" rx="0.6" fill="#0f172a" />

    {/* 연필 본체 */}
    {/* 분홍색 지우개 */}
    <rect x="25.4" y="18.8" width="2" height="2.2" rx="0.5" fill="#f9a8a8" />
    {/* 은색 페룰 밴드 */}
    <rect x="25.4" y="21" width="2" height="1.1" fill="#9ca3af" />
    {/* 노란 연필 바디 */}
    <rect x="25.4" y="22.1" width="2" height="5.4" fill="#f59e0b" />
    {/* 깎인 나무 부분 */}
    <polygon points="25.4,27.5 27.4,27.5 26.4,30" fill="#d97706" />
    {/* 흑연 심 */}
    <polygon points="26,29.6 26.8,29.6 26.4,31.2" fill="#0f172a" />
  </svg>
)

// 실제 각도기 도구(ProtractorTool.jsx)의 그래픽 공식과 100% 동일한 수치 (숫자만 제외)
const P_CX = 100
const P_CY = 95
const P_R = 100
const P_R_INNER = P_R * 0.68      // 68
const P_R_TICK_1DEG = P_R * 0.84  // 84
const P_R_OUTER = P_R * 0.885     // 88.5
const P_R_HUB = P_R * 0.16        // 16

const P_TICKS = Array.from({ length: 181 }, (_, i) => i)
const P_RADIAL_LINES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170]
const pAX = (r, rad) => (P_CX + r * Math.cos(rad)).toFixed(2)
const pAY = (r, rad) => (P_CY - r * Math.sin(rad)).toFixed(2)

// 실제 각도기 도구 그래픽을 100% 반영한 정밀 SVG (숫자 제외)
const ProtractorIcon = () => {
  const baseDepth = P_R_OUTER - P_R_TICK_1DEG
  return (
    <svg width="27" height="17" viewBox="8 3 184 96" fill="none" className="shrink-0 drop-shadow-sm">
      {/* 반원 아크릴 바디 */}
      <path d={`M ${(P_CX - P_R_OUTER).toFixed(2)} ${P_CY} A ${P_R_OUTER} ${P_R_OUTER} 0 0 1 ${(P_CX + P_R_OUTER).toFixed(2)} ${P_CY} Z`} fill="#ffffff" fillOpacity="0.8" />

      {/* 반원 외곽 호 (R_outer) */}
      <path d={`M ${(P_CX - P_R_OUTER).toFixed(2)} ${P_CY} A ${P_R_OUTER} ${P_R_OUTER} 0 0 1 ${(P_CX + P_R_OUTER).toFixed(2)} ${P_CY}`} stroke="#333" strokeWidth="1.2" />

      {/* 1° 눈금 끝 받치는 호선 (R_tick_1deg) */}
      <path d={`M ${(P_CX - P_R_TICK_1DEG).toFixed(2)} ${P_CY} A ${P_R_TICK_1DEG} ${P_R_TICK_1DEG} 0 0 1 ${(P_CX + P_R_TICK_1DEG).toFixed(2)} ${P_CY}`} stroke="#333" strokeWidth="1" />

      {/* 안쪽 큰 호선 (R_inner) */}
      <path d={`M ${(P_CX - P_R_INNER).toFixed(2)} ${P_CY} A ${P_R_INNER} ${P_R_INNER} 0 0 1 ${(P_CX + P_R_INNER).toFixed(2)} ${P_CY}`} stroke="#333" strokeWidth="1.2" />

      {/* 중심 반원 허브 (R_hub) */}
      <path d={`M ${(P_CX - P_R_HUB).toFixed(2)} ${P_CY} A ${P_R_HUB} ${P_R_HUB} 0 0 1 ${(P_CX + P_R_HUB).toFixed(2)} ${P_CY} Z`} fill="#ffffff" stroke="#333" strokeWidth="1.2" />

      {/* 기준 지름 수평선 (R_inner 구간) */}
      <line x1={(P_CX - P_R_INNER).toFixed(2)} y1={P_CY} x2={(P_CX + P_R_INNER).toFixed(2)} y2={P_CY} stroke="#333" strokeWidth="1.2" />

      {/* 중앙 90° 수직선 (중심부터 R_inner까지) */}
      <line x1={P_CX} y1={P_CY} x2={P_CX} y2={P_CY - P_R_INNER} stroke="#333" strokeWidth="1.2" />

      {/* 10° 단위 방사선 (R_hub ~ R_inner) */}
      {P_RADIAL_LINES.map(deg => {
        const tickRad = Math.PI - (deg * Math.PI) / 180
        return (
          <line
            key={`r-${deg}`}
            x1={pAX(P_R_HUB, tickRad)} y1={pAY(P_R_HUB, tickRad)}
            x2={pAX(P_R_INNER, tickRad)} y2={pAY(P_R_INNER, tickRad)}
            stroke="#555" strokeWidth="1"
          />
        )
      })}

      {/* 181개 눈금선 (0°~180°, 1° 간격, 10°/5° 가중 길이) */}
      {P_TICKS.map(i => {
        const tickRad = Math.PI - (i * Math.PI) / 180
        const is10 = i % 10 === 0
        const is5 = i % 5 === 0
        const len = is10 ? baseDepth * 1.8 : is5 ? baseDepth * 1.4 : baseDepth
        const sw = is10 ? 1.3 : is5 ? 0.9 : 0.6
        return (
          <line
            key={`t-${i}`}
            x1={pAX(P_R_OUTER, tickRad)} y1={pAY(P_R_OUTER, tickRad)}
            x2={pAX(P_R_OUTER - len, tickRad)} y2={pAY(P_R_OUTER - len, tickRad)}
            stroke="#222" strokeWidth={sw}
          />
        )
      })}
    </svg>
  )
}

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
