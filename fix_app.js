
const fs = require('fs');
let text = fs.readFileSync('src/App.jsx', 'utf8');

text = text.replace(/const \\{ saveSnapshot, undo, redo, clear \\} = useHistory\\(canvasRef\\)/,
  \const stateRef = useRef(state)
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
  }, [saveSnapshot])\);

text = text.replace(/onDrawStart=\\{handleDrawStart\\}/, 'onDrawEnd={handleInteractionEnd}');
text = text.replace(/onDraw=\\{handleToolDraw\\}/g, 'onDraw={handleToolDraw} onInteractionEnd={handleInteractionEnd}');
text = text.replace(/setProtractor=\\{setProtractor\\}/, 'setProtractor={setProtractor} onInteractionEnd={handleInteractionEnd}');

fs.writeFileSync('src/App.jsx', text);
console.log('App.jsx done');

