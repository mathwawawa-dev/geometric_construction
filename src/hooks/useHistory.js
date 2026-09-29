import { useRef, useCallback } from 'react'

const MAX_HISTORY = 15

export function useHistory(canvasRef) {
  const historyRef = useRef([])   // ImageData 스냅샷 배열
  const indexRef = useRef(-1)     // 현재 위치

  /** 현재 캔버스 상태를 스택에 저장 */
  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // 현재 위치 이후 데이터 제거 (redo 분기 삭제)
    historyRef.current = historyRef.current.slice(0, indexRef.current + 1)
    historyRef.current.push(snapshot)

    // 최대 개수 초과 시 앞에서 제거
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift()
    }
    indexRef.current = historyRef.current.length - 1
  }, [canvasRef])

  const undo = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (indexRef.current <= 0) {
      // 스택 맨 처음 → 완전히 지우기
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      indexRef.current = -1
      return
    }
    indexRef.current -= 1
    const ctx = canvas.getContext('2d')
    ctx.putImageData(historyRef.current[indexRef.current], 0, 0)
  }, [canvasRef])

  const redo = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (indexRef.current >= historyRef.current.length - 1) return
    indexRef.current += 1
    const ctx = canvas.getContext('2d')
    ctx.putImageData(historyRef.current[indexRef.current], 0, 0)
  }, [canvasRef])

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    saveSnapshot()
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    saveSnapshot()
  }, [canvasRef, saveSnapshot])

  return { saveSnapshot, undo, redo, clear }
}
