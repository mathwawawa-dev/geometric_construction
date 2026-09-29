const fs = require('fs');

const file = 'src/components/CompassTool.jsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /\{\/\* 오른쪽 다리 \(연필 쪽\) \*\/\}([\s\S]*?)\{\/\* 힌지 \+ 손잡이 \*\/\}/;

const newContent = \{/* 오른쪽 다리 (연필 쪽) */}
        <g transform={\\\	ranslate(\, \) rotate(\)\\\} style={{ pointerEvents: 'none' }}>
          {/* 은색 다리: 안쪽(y=-30)으로 이동 */}
          <line x1="60" y1="-30" x2={legLength} y2="0" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
          <line x1="60" y1="-30" x2={legLength} y2="0" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
          <g style={{ pointerEvents: 'all', cursor: 'crosshair' }} onMouseDown={onPointerDown('leg')} onTouchStart={onPointerDown('leg')}>
            <rect x="70" y="-40" width={legLength - 70} height="20" fill="transparent" />
          </g>

          {/* 클램프 연결부 (unrotated) */}
          <polygon points={\\\62,-30 70,-30 72,\ 60,\\\\} fill="#1e293b" />
          <rect x="64" y="-35" width="6" height="5" rx="1.5" fill="#94a3b8" />

          {/* 연필 어셈블리 (rotated to be parallel to silver leg) */}
          <g transform={\\\otate(\)\\\} style={{ pointerEvents: 'none' }}>
            <rect x="55" y="-12" width="22" height="24" rx="4" fill="#1e293b" />
            
            <path d="M0,0 L11,-2.2 L11,2.2 Z" fill="#1c1917" />
            <path d="M10,-2 L10,2 L30,4.5 L30,-4.5 Z" fill="#c8a96e" />
            <line x1="12" y1="-1.2" x2="29" y2="-3.8" stroke="#a07040" strokeWidth="0.7" />
            <line x1="12" y1="1.2" x2="29" y2="3.8" stroke="#a07040" strokeWidth="0.7" />
            
            {/* 노란 몸통 (짧게 97) */}
            <rect x="30" y="-4.5" width="97" height="9" fill="#f5c518" />
            <rect x="30" y="-4.5" width="97" height="3" fill="#f7d060" opacity="0.5" />
            
            {/* 페룰 */}
            <rect x="127" y="-4.5" width="14" height="9" fill="#9ca3af" />
            <line x1="129" y1="-4.5" x2="129" y2="4.5" stroke="#6b7280" strokeWidth="1" />
            <line x1="134" y1="-4.5" x2="134" y2="4.5" stroke="#6b7280" strokeWidth="1" />
            
            {/* 지우개 */}
            <rect x="141" y="-4.5" width="12" height="9" rx="2" fill="#f9a8a8" />
            
            <g style={{ pointerEvents: 'all', cursor: 'ew-resize' }} onMouseDown={onPointerDown('pencil')} onTouchStart={onPointerDown('pencil')}>
              <rect x="0" y="-12" width="55" height="24" fill="transparent" />
              <rect x="77" y="-12" width="76" height="24" fill="transparent" />
            </g>
            <g style={{ pointerEvents: 'all', cursor: 'ew-resize' }} onMouseDown={onPointerDown('clamp')} onTouchStart={onPointerDown('clamp')}>
              <rect x="55" y="-12" width="22" height="24" fill="transparent" />
            </g>
          </g>
        </g>

        {/* 힌지 + 손잡이 */}
\

content = content.replace(regex, newContent);
fs.writeFileSync(file, content);
