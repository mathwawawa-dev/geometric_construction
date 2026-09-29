import { useReducer, useCallback } from 'react'

const VERSION = 'v0.1.0_20260930_010415_MVP초안'

const initialState = {
  activeTool: 'pen', // 'pen' | 'compass' | 'ruler' | 'protractor'
  strokeColor: '#1e40af',
  strokeWidth: 2,
  compass: {
    visible: false,
    pinX: 400, pinY: 300,
    pencilX: 550, pencilY: 300,
    radiusInput: '',   // 숫자 직접 입력값
  },
  ruler: {
    visible: false,
    x1: 200, y1: 400,
    x2: 600, y2: 400,
  },
  protractor: {
    visible: false,
    cx: 400, cy: 350,
    radius: 120,
    angle: 0, // 회전각 (radian)
  },
  background: {
    src: null,
    opacity: 1,
    locked: true,
  },
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_TOOL':
      return {
        ...state,
        activeTool: action.tool,
        compass: { ...state.compass, visible: action.tool === 'compass' },
        ruler: { ...state.ruler, visible: action.tool === 'ruler' },
        protractor: { ...state.protractor, visible: action.tool === 'protractor' },
      }
    case 'SET_COLOR':
      return { ...state, strokeColor: action.color }
    case 'SET_WIDTH':
      return { ...state, strokeWidth: action.width }
    case 'SET_COMPASS':
      return { ...state, compass: { ...state.compass, ...action.payload } }
    case 'SET_RULER':
      return { ...state, ruler: { ...state.ruler, ...action.payload } }
    case 'SET_PROTRACTOR':
      return { ...state, protractor: { ...state.protractor, ...action.payload } }
    case 'SET_BACKGROUND':
      return { ...state, background: { ...state.background, ...action.payload } }
    default:
      return state
  }
}

export function useAppState() {
  const [state, dispatch] = useReducer(reducer, initialState)

  const setTool = useCallback((tool) => dispatch({ type: 'SET_TOOL', tool }), [])
  const setColor = useCallback((color) => dispatch({ type: 'SET_COLOR', color }), [])
  const setWidth = useCallback((width) => dispatch({ type: 'SET_WIDTH', width }), [])
  const setCompass = useCallback((payload) => dispatch({ type: 'SET_COMPASS', payload }), [])
  const setRuler = useCallback((payload) => dispatch({ type: 'SET_RULER', payload }), [])
  const setProtractor = useCallback((payload) => dispatch({ type: 'SET_PROTRACTOR', payload }), [])
  const setBackground = useCallback((payload) => dispatch({ type: 'SET_BACKGROUND', payload }), [])

  return { state, setTool, setColor, setWidth, setCompass, setRuler, setProtractor, setBackground, VERSION }
}
