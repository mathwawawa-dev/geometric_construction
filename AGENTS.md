# 프로젝트 규칙 — 작도보드

## 기술 스택
- React 18 (Vite 번들)
- Tailwind CSS
- Canvas API (2D)
- 순수 JS (외부 상태관리 라이브러리 없음)

## 폴더 구조
- `src/App.jsx` — 최상위 컴포넌트, 슬라이드 관리, 세션 저장/불러오기
- `src/store/useAppState.js` — useReducer 기반 전역 상태
- `src/hooks/useHistory.js` — Undo/Redo 히스토리
- `src/components/` — Toolbar, Sidebar, DrawingCanvas, 각 도구 컴포넌트
- `src/utils/shapeUtils.js` — renderShapes, moveShape 등 캔버스 유틸

## 네이밍 컨벤션
- 컴포넌트: PascalCase (예: `DrawingCanvas`)
- 함수/변수: camelCase (예: `handleAddShape`)
- 상수: UPPER_SNAKE_CASE (예: `MAX_HISTORY`)

## 주의사항

### 🚨 Rule 1: React Hook 선언 순서 엄수 (TDZ 방지)
> **위반 시 런타임 크래시(하얀 화면) 발생 — 빌드는 성공하지만 실행 시 앱 전체가 죽음**

`const`로 선언된 `useCallback`, `useMemo` 등의 훅을 작성할 때,
의존성 배열(`deps`)에 포함된 다른 함수나 변수가 **해당 훅보다 아래에 선언되어 있으면 절대 안 됩니다.**

반드시 **"의존성이 없는 함수 → 이를 참조하는 함수 → 최종 호출 함수"** 순서로 위에서 아래로 배치하세요.

```jsx
// ❌ 잘못된 예 — saveCurrentSlideData가 아직 선언 전에 handleSessionSave가 참조
const handleSessionSave = useCallback(() => {
  saveCurrentSlideData()  // ← 이 시점엔 아직 undefined!
}, [saveCurrentSlideData])

const saveCurrentSlideData = useCallback(() => { ... }, [])

// ✅ 올바른 예 — 의존 대상을 반드시 먼저 선언
const saveCurrentSlideData = useCallback(() => { ... }, [])

const handleSessionSave = useCallback(() => {
  saveCurrentSlideData()  // ← 정상 참조
}, [saveCurrentSlideData])
```

**자가 검열 의무:** 새 `useCallback` 추가 또는 기존 것을 수정할 때, deps 배열의 모든 항목이 현재 줄 위에 선언되어 있는지 반드시 `view_file`로 확인한 뒤 진행합니다.
