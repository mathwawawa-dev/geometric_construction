
const fs = require('fs');

function updateFile(file, replacer) {
  const content = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, replacer(content));
}

// 1. App.jsx: Fixed 3000x2000 Workspace
updateFile('src/App.jsx', text => {
  let res = text.replace(
    /className="canvas-area relative flex-1 bg-white overflow-hidden"[\s\S]*?<div\s*style=\{\{[\s\S]*?\}\}\s*>/,
    \className=\"canvas-area relative flex-1 bg-gray-200 overflow-hidden\"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 3000,
            height: 2000,
            transform: \\\	ranslate(calc(-50% + \\\px), calc(-50% + \\\px)) scale(\\\)\\\,
            transformOrigin: 'center center',
            backgroundColor: 'white',
            boxShadow: '0 0 40px rgba(0,0,0,0.1)'
          }}\
        >\
  );
  return res;
});

// 2. useAppState.js: Initial centered positions
updateFile('src/store/useAppState.js', text => {
  return text
    .replace(/pinX:\s*\d+,\s*pinY:\s*\d+/, 'pinX: 1500, pinY: 1000')
    .replace(/pencilX:\s*\d+,\s*pencilY:\s*\d+/, 'pencilX: 1700, pencilY: 1000')
    .replace(/x1:\s*\d+,\s*y1:\s*\d+,\s*x2:\s*\d+,\s*y2:\s*\d+/, 'x1: 1200, y1: 1200, x2: 1800, y2: 1200')
    .replace(/cx:\s*\d+,\s*cy:\s*\d+/, 'cx: 1500, cy: 1000');
});

// 3. useHistory.js: Reduce history size to prevent memory issues with 3000x2000
updateFile('src/hooks/useHistory.js', text => text.replace('const MAX_HISTORY = 50', 'const MAX_HISTORY = 15'));

// 4. Tools: Fix getSVGPos to account for zoom
const fixSVGPos = (text) => {
  return text.replace(
    /const getSVGPos = \(e\) => \{[\s\S]*?return \{ x:[^\n]*y:[^\n]*\}\s*\}/,
    \const getSVGPos = (e) => {
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    // CSS transform zoom º¸Á¤
    const scaleX = svg.clientWidth / rect.width || 1
    const scaleY = svg.clientHeight / rect.height || 1
    return { 
      x: (clientX - rect.left) * scaleX, 
      y: (clientY - rect.top) * scaleY 
    }
  }\
  );
};
updateFile('src/components/CompassTool.jsx', fixSVGPos);
updateFile('src/components/RulerTool.jsx', fixSVGPos);
updateFile('src/components/ProtractorTool.jsx', fixSVGPos);

console.log('Done!');

