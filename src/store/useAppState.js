import { useReducer, useCallback } from 'react'

const initialState = {
  // 펜 드로잉 모드: 'pen' | 'pointer'
  // 도구(컴퍼스/자/각도기)는 별도 visible 플래그로 독립 제어
  drawMode: 'pen',
  strokeColor: '#1e40af',
  strokeWidth: 2,
  compass: {
    visible: false,
    pinX: 400, pinY: 300,
    pencilX: 550, pencilY: 300,
    radiusInput: '',
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
    angle: 0,
  },
  background: {
    src: null,
    opacity: 1,
    locked: true,
  },
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_DRAW_MODE':
      return { ...state, drawMode: action.mode }
    case 'TOGGLE_TOOL': {
      const key = action.tool  // 'compass' | 'ruler' | 'protractor'
      return { ...state, [key]: { ...state[key], visible: !state[key].visible } }
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

  const setDrawMode   = useCallback((mode) => dispatch({ type: 'SET_DRAW_MODE', mode }), [])
  const toggleTool    = useCallback((tool) => dispatch({ type: 'TOGGLE_TOOL', tool }), [])
  const setColor      = useCallback((color) => dispatch({ type: 'SET_COLOR', color }), [])
  const setWidth      = useCallback((width) => dispatch({ type: 'SET_WIDTH', width }), [])
  const setCompass    = useCallback((payload) => dispatch({ type: 'SET_COMPASS', payload }), [])
  const setRuler      = useCallback((payload) => dispatch({ type: 'SET_RULER', payload }), [])
  const setProtractor = useCallback((payload) => dispatch({ type: 'SET_PROTRACTOR', payload }), [])
  const setBackground = useCallback((payload) => dispatch({ type: 'SET_BACKGROUND', payload }), [])

  return { state, setDrawMode, toggleTool, setColor, setWidth, setCompass, setRuler, setProtractor, setBackground }
}
