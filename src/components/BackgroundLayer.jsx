import { useRef } from 'react'

/**
 * 배경 이미지 레이어 (최하위 Canvas)
 * - 잠금 시 포인터 이벤트 차단
 * - 이미지가 캔버스 크기에 맞게 cover 형태로 표시
 */
export default function BackgroundLayer({ background }) {
  const { src, opacity, locked } = background
  if (!src) return null
  return (
    <img
      src={src}
      alt="배경"
      draggable={false}
      className="absolute inset-0 w-full h-full object-contain select-none"
      style={{
        opacity,
        pointerEvents: locked ? 'none' : 'auto',
        zIndex: 0,
      }}
    />
  )
}
