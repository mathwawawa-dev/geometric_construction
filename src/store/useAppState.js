import { useReducer, useCallback } from 'react'
import { moveShape } from '../utils/shapeUtils'

const initialState = {
  // 드로잉 모드: 'pen' | 'select' | 'pointer'
  // 도구(컴퍼스/자/각도기)는 별도 visible 플래그로 독립 제어
  drawMode: 'pen',
  strokeColor: '#1e40af',
  strokeWidth: 3, // 기본 선 굵기: 보통(3)
  shapes: [],     // 개체 단위 벡터 도형 목록 (선택, 이동, 삭제 가능)
  compass: {
    visible: false,
    pinX: 400, pinY: 380,
    pencilX: 550, pencilY: 380,
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
      const key = action.tool
      const isVisible = !state[key].visible
      const updates = { visible: isVisible }
      if (isVisible && action.coords) {
        if (key === 'compass') {
          updates.pinX = action.coords.x - 100
          updates.pinY = action.coords.y
          updates.pencilX = action.coords.x + 100
          updates.pencilY = action.coords.y
        } else if (key === 'ruler') {
          updates.x1 = action.coords.x - 300
          updates.y1 = action.coords.y
          updates.x2 = action.coords.x + 300
          updates.y2 = action.coords.y
        } else if (key === 'protractor') {
          updates.cx = action.coords.x
          updates.cy = action.coords.y
        }
      }
      return { ...state, [key]: { ...state[key], ...updates } }
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
    case 'ADD_SHAPE':
      return { ...state, shapes: [...state.shapes, action.shape] }
    case 'SET_SHAPES':
      return { ...state, shapes: action.shapes }
    case 'DELETE_SHAPES': {
      const set = new Set(action.ids)
      return { ...state, shapes: state.shapes.filter(s => !set.has(s.id)) }
    }
    case 'MOVE_SHAPES': {
      const set = new Set(action.ids)
      return {
        ...state,
        shapes: state.shapes.map(s => set.has(s.id) ? moveShape(s, action.dx, action.dy) : s)
      }
    }
    default:
      return state
  }
}

export function useAppState() {
  const [state, dispatch] = useReducer(reducer, initialState)

  const setDrawMode   = useCallback((mode) => dispatch({ type: 'SET_DRAW_MODE', mode }), [])
  const toggleTool    = useCallback((tool, coords) => dispatch({ type: 'TOGGLE_TOOL', tool, coords }), [])
  const setColor      = useCallback((color) => dispatch({ type: 'SET_COLOR', color }), [])
  const setWidth      = useCallback((width) => dispatch({ type: 'SET_WIDTH', width }), [])
  const setCompass    = useCallback((payload) => dispatch({ type: 'SET_COMPASS', payload }), [])
  const setRuler      = useCallback((payload) => dispatch({ type: 'SET_RULER', payload }), [])
  const setProtractor = useCallback((payload) => dispatch({ type: 'SET_PROTRACTOR', payload }), [])
  const setBackground = useCallback((payload) => dispatch({ type: 'SET_BACKGROUND', payload }), [])
  const addShape      = useCallback((shape) => dispatch({ type: 'ADD_SHAPE', shape }), [])
  const setShapes     = useCallback((shapes) => dispatch({ type: 'SET_SHAPES', shapes }), [])
  const deleteShapes  = useCallback((ids) => dispatch({ type: 'DELETE_SHAPES', ids }), [])
  const moveShapes    = useCallback((ids, dx, dy) => dispatch({ type: 'MOVE_SHAPES', ids, dx, dy }), [])

  return {
    state,
    setDrawMode,
    toggleTool,
    setColor,
    setWidth,
    setCompass,
    setRuler,
    setProtractor,
    setBackground,
    addShape,
    setShapes,
    deleteShapes,
    moveShapes,
  }
}
