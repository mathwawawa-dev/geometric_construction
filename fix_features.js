const fs = require('fs');

function updateFile(file, replacer) {
  const content = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, replacer(content));
}

// 1. useHistory.js
updateFile('src/hooks/useHistory.js', text => {
  return import { useRef, useCallback } from 'react'

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
;
});

// 2. DrawingCanvas.jsx
updateFile('src/components/DrawingCanvas.jsx', text => {
  let res = text.replace(/onDrawStart/g, 'onDrawEnd');
  res = res.replace(/onDrawEnd\?\.\(\)\n/g, '');
  res = res.replace(
    /const onWindowUp = \(\) => \{/,
    const onWindowUp = () => {
      if (isDrawing.current) {
        onDrawEnd?.()
      }
  );
  return res;
});

// 3. CompassTool.jsx
updateFile('src/components/CompassTool.jsx', text => {
  let res = text.replace(/export default function CompassTool\(\{ compass, setCompass, canvasRef, strokeColor, strokeWidth, onDraw, ruler \}\) \{/,
    export default function CompassTool({ compass, setCompass, canvasRef, strokeColor, strokeWidth, onDraw, ruler, onInteractionEnd }) {);
  
  res = res.replace(/dragging\.current = null\n\s*prevAngleRef\.current = null/,
    if (dragging.current) onInteractionEnd?.()
      dragging.current = null
      prevAngleRef.current = null);

  res = res.replace(/if \(part === 'pin'\) \{[\s\S]*?\} else if/,
    if (part === 'pin_top') {
      dragOffset.current = { dx: pos.x - pinX, dy: pos.y - pinY }
    } else if (part === 'pin_bottom') {
      const initPinAngle = Math.atan2(pinY - pencilY, pinX - pencilX)
      const initClickAngle = Math.atan2(pos.y - pencilY, pos.x - pencilX)
      dragOffset.current = {
        initPinAngle,
        angleOffset: initPinAngle - initClickAngle,
      }
    } else if);
    
  res = res.replace(/if \(dragging\.current === 'pin'\) \{[\s\S]*?\} else if/,
    if (dragging.current === 'pin_top') {
        const targetPinX = rawP.x - dragOffset.current.dx
        const targetPinY = rawP.y - dragOffset.current.dy
        const snapped = snapToDrawing(snapPointToRuler({ x: targetPinX, y: targetPinY }, ruler), canvasRef)
        const pdx = pencilX - pinX, pdy = pencilY - pinY
        setCompass({ pinX: snapped.x, pinY: snapped.y, pencilX: snapped.x + pdx, pencilY: snapped.y + pdy })
      } else if (dragging.current === 'pin_bottom') {
        const curMouseAngle = Math.atan2(rawP.y - pencilY, rawP.x - pencilX)
        const newPinAngle = curMouseAngle + dragOffset.current.angleOffset
        const newRadius = dist(pencilX, pencilY, rawP.x, rawP.y)
        if (newRadius > 2) {
          setCompass({
            pinX: pencilX + Math.cos(newPinAngle) * newRadius,
            pinY: pencilY + Math.sin(newPinAngle) * newRadius,
          })
        }
      } else if);

  res = res.replace(/<g style=\{\{ pointerEvents: 'all', cursor: 'move' \}\} onMouseDown=\{onPointerDown\('pin'\)\} onTouchStart=\{onPointerDown\('pin'\)\}>\s*<rect x="-4" y="-18" width=\{legLength\} height="36" fill="transparent" \/>\s*<\/g>/,
    <g style={{ pointerEvents: 'all', cursor: 'ew-resize' }} onMouseDown={onPointerDown('pin_bottom')} onTouchStart={onPointerDown('pin_bottom')}>
            <rect x="-4" y="-18" width={legLength / 2 + 4} height="36" fill="transparent" />
          </g>
          <g style={{ pointerEvents: 'all', cursor: 'move' }} onMouseDown={onPointerDown('pin_top')} onTouchStart={onPointerDown('pin_top')}>
            <rect x={legLength / 2} y="-18" width={legLength / 2} height="36" fill="transparent" />
          </g>);

  const oldRightLeg = /\{\/\* 은색 다리: 드래그하면 arc 그려짐 \*\/\}([\s\S]*?)\{\/\* 힌지 \+ 손잡이 \*\/\}/g;
  const newRightLeg = {/* 은색 다리: 안쪽(y=-25)으로 이동하여 연필을 바깥쪽으로 */}
          <line x1="60" y1="-25" x2={legLength} y2="0" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
          <line x1="60" y1="-25" x2={legLength} y2="0" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
          <g style={{ pointerEvents: 'all', cursor: 'crosshair' }} onMouseDown={onPointerDown('leg')} onTouchStart={onPointerDown('leg')}>
            <rect x="70" y="-35" width={legLength - 70} height="20" fill="transparent" />
          </g>

          {/* 클램프 (네이비 부분) */}
          <g style={{ pointerEvents: 'none' }}>
            <polygon points="65,-25 75,-25 72,-9 60,-9" fill="#1e293b" />
            <rect x="68" y="-29" width="6" height="4" rx="1" fill="#94a3b8" />
            <rect x="55" y="-12" width="22" height="24" rx="4" fill="#1e293b" />
          </g>

          {/* 연필 어셈블리 (y=0 유지) */}
          <g transform="rotate(-9)" style={{ pointerEvents: 'none' }}>
            <path d="M0,0 L11,-2.2 L11,2.2 Z" fill="#1c1917" />
            <path d="M10,-2 L10,2 L30,4.5 L30,-4.5 Z" fill="#c8a96e" />
            <line x1="12" y1="-1.2" x2="29" y2="-3.8" stroke="#a07040" strokeWidth="0.7" />
            <line x1="12" y1="1.2" x2="29" y2="3.8" stroke="#a07040" strokeWidth="0.7" />
            <rect x="30" y="-4.5" width="147" height="9" fill="#f5c518" />
            <rect x="30" y="-4.5" width="147" height="3" fill="#f7d060" opacity="0.5" />
            <rect x="177" y="-4.5" width="14" height="9" fill="#9ca3af" />
            <line x1="179" y1="-4.5" x2="179" y2="4.5" stroke="#6b7280" strokeWidth="1" />
            <line x1="184" y1="-4.5" x2="184" y2="4.5" stroke="#6b7280" strokeWidth="1" />
            <rect x="191" y="-4.5" width="12" height="9" rx="2" fill="#f9a8a8" />
            
            <g style={{ pointerEvents: 'all', cursor: 'ew-resize' }} onMouseDown={onPointerDown('pencil')} onTouchStart={onPointerDown('pencil')}>
              <rect x="0" y="-12" width="55" height="24" fill="transparent" />
              <rect x="82" y="-12" width="122" height="24" fill="transparent" />
            </g>
            <g style={{ pointerEvents: 'all', cursor: 'ew-resize' }} onMouseDown={onPointerDown('clamp')} onTouchStart={onPointerDown('clamp')}>
              <rect x="55" y="-12" width="30" height="24" fill="transparent" />
            </g>
          </g>
        </g>

        {/* 힌지 + 손잡이 */};
  res = res.replace(oldRightLeg, newRightLeg);

  res = res.replace(/drawFullCircle = useCallback\(\(\) => \{[\s\S]*?const ctx = canvas\.getContext\('2d'\)/,
    drawFullCircle = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    onDraw?.()
    const ctx = canvas.getContext('2d'));
  res = res.replace(/ctx\.stroke\(\)\n\s*\}, \[/,
    ctx.stroke()
    onInteractionEnd?.()
  }, [);

  return res;
});

// 4. RulerTool.jsx & ProtractorTool.jsx
updateFile('src/components/RulerTool.jsx', text => {
  let res = text.replace(/export default function RulerTool\(\{ ruler, setRuler, canvasRef, strokeColor, strokeWidth, onDraw \}\) \{/,
    export default function RulerTool({ ruler, setRuler, canvasRef, strokeColor, strokeWidth, onDraw, onInteractionEnd }) {);
  res = res.replace(/dragging\.current = null/, if (dragging.current) onInteractionEnd?.(); dragging.current = null);
  return res;
});

updateFile('src/components/ProtractorTool.jsx', text => {
  let res = text.replace(/export default function ProtractorTool\(\{ protractor, setProtractor \}\) \{/,
    export default function ProtractorTool({ protractor, setProtractor, onInteractionEnd }) {);
  res = res.replace(/dragging\.current = null/, if (dragging.current) onInteractionEnd?.(); dragging.current = null);
  return res;
});

// 5. App.jsx
updateFile('src/App.jsx', text => {
  let res = text.replace(/const \{ saveSnapshot, undo, redo, clear \} = useHistory\(canvasRef\)/,
    const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  const getStateRef = useCallback(() => ({
    tools: {
      compass: stateRef.current.compass,
      ruler: stateRef.current.ruler,
      protractor: stateRef.current.protractor
    }
  }), [])

  const restoreState = useCallback((toolsSnap) => {
    setCompass(toolsSnap.compass)
    setRuler(toolsSnap.ruler)
    setProtractor(toolsSnap.protractor)
  }, [setCompass, setRuler, setProtractor])

  const { saveSnapshot, undo, redo, clear } = useHistory(canvasRef, getStateRef, restoreState)

  useEffect(() => {
    const timer = setTimeout(() => saveSnapshot(), 200)
    return () => clearTimeout(timer)
  }, [saveSnapshot])

  const handleInteractionEnd = useCallback(() => {
    setTimeout(() => saveSnapshot(), 0)
  }, [saveSnapshot]));

  res = res.replace(/onDrawStart=\{handleDrawStart\}/, onDrawEnd={handleInteractionEnd});
  res = res.replace(/onDraw=\{handleToolDraw\}/g, onDraw={handleToolDraw} onInteractionEnd={handleInteractionEnd});
  res = res.replace(/setProtractor=\{setProtractor\}/, setProtractor={setProtractor} onInteractionEnd={handleInteractionEnd});
  
  return res;
});

console.log('Update complete!');
