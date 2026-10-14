const cx = 50, cy = 50;

function genInward(r, wingL, forwardD, rotDeg) {
  const startDeg = -95, endDeg = 10;
  const a1 = startDeg * Math.PI / 180;
  const a2 = endDeg * Math.PI / 180;
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);

  // tangent vector at a2:
  const Tx = -Math.sin(a2), Ty = Math.cos(a2);
  const tipX = x2 + forwardD * Tx;
  const tipY = y2 + forwardD * Ty;

  // Tangent angle + rotDeg
  const tangAngle = a2 + Math.PI / 2 + (rotDeg * Math.PI / 180);
  const w1Angle = tangAngle + Math.PI - Math.PI / 4;
  const w2Angle = tangAngle + Math.PI + Math.PI / 4;

  const w1x = tipX + wingL * Math.cos(w1Angle);
  const w1y = tipY + wingL * Math.sin(w1Angle);
  const w2x = tipX + wingL * Math.cos(w2Angle);
  const w2y = tipY + wingL * Math.sin(w2Angle);

  // Opposite 180 deg
  const ox1 = 100 - x1, oy1 = 100 - y1;
  const ox2 = 100 - x2, oy2 = 100 - y2;
  const otipX = 100 - tipX, otipY = 100 - tipY;
  const ow1x = 100 - w1x, ow1y = 100 - w1y;
  const ow2x = 100 - w2x, ow2y = 100 - w2y;

  return {
    arc1: `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`,
    head1: `M ${w1x.toFixed(1)} ${w1y.toFixed(1)} L ${tipX.toFixed(1)} ${tipY.toFixed(1)} L ${w2x.toFixed(1)} ${w2y.toFixed(1)}`,
    arc2: `M ${ox1.toFixed(1)} ${oy1.toFixed(1)} A ${r} ${r} 0 0 1 ${ox2.toFixed(1)} ${oy2.toFixed(1)}`,
    head2: `M ${ow1x.toFixed(1)} ${ow1y.toFixed(1)} L ${otipX.toFixed(1)} ${otipY.toFixed(1)} L ${ow2x.toFixed(1)} ${ow2y.toFixed(1)}`
  };
}

console.log('IN1 (r=27.5, wing=13.5, fwd=2.5, rot=-5):', genInward(27.5, 13.5, 2.5, -5));
console.log('IN2 (r=27.0, wing=13.0, fwd=2.5, rot=-5):', genInward(27.0, 13.0, 2.5, -5));
console.log('IN3 (r=28.0, wing=14.0, fwd=2.5, rot=-5):', genInward(28.0, 14.0, 2.5, -5));
console.log('IN4 (r=26.5, wing=12.5, fwd=2.5, rot=-5):', genInward(26.5, 12.5, 2.5, -5));
console.log('IN5 (r=27.5, wing=14.0, fwd=3.0, rot=-6):', genInward(27.5, 14.0, 3.0, -6));
