import { useRef, useCallback } from 'react'

const MAX_HISTORY = 15

export function useHistory(canvasRef, getStateRef, restoreState) {
  const historyRef = useRef([])
  const indexRef = useRef(-1)

  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    
    const snap = {
      image: imgData,
      tools: getStateRef ? JSON.parse(JSON.stringify(getStateRef().tools)) : null
    }

    historyRef.current = historyRef.current.slice(0, indexRef.current + 1)
    historyRef.current.push(snap)

    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift()
    }
    indexRef.current = historyRef.current.length - 1
  }, [canvasRef, getStateRef])

  const undo = useCallback(() => {
    if (indexRef.current > 0) {
      indexRef.current -= 1
      const snap = historyRef.current[indexRef.current]
      const canvas = canvasRef.current
      if (canvas) {
        canvas.getContext('2d').putImageData(snap.image, 0, 0)
      }
      if (restoreState && snap.tools) {
        restoreState(snap.tools)
      }
    }
  }, [canvasRef, restoreState])

  const redo = useCallback(() => {
    if (indexRef.current < historyRef.current.length - 1) {
      indexRef.current += 1
      const snap = historyRef.current[indexRef.current]
      const canvas = canvasRef.current
      if (canvas) {
        canvas.getContext('2d').putImageData(snap.image, 0, 0)
      }
      if (restoreState && snap.tools) {
        restoreState(snap.tools)
      }
    }
  }, [canvasRef, restoreState])

  const clear = useCallback(() => {
    saveSnapshot()
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    saveSnapshot()
  }, [canvasRef, saveSnapshot])

  return { saveSnapshot, undo, redo, clear }
}
