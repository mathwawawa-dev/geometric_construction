const cx = 50, cy = 50, r = 30;

function gen(startDeg, endDeg, L) {
  const a1 = startDeg * Math.PI / 180;
  const a2 = endDeg * Math.PI / 180;
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
  const Tx = -Math.sin(a2), Ty = Math.cos(a2);
  const Nx = -Math.cos(a2), Ny = -Math.sin(a2);
  const w1x = x2 - L * (Tx + Nx) / Math.SQRT2;
  const w1y = y2 - L * (Ty + Ny) / Math.SQRT2;
  const w2x = x2 - L * (Tx - Nx) / Math.SQRT2;
  const w2y = y2 - L * (Ty - Ny) / Math.SQRT2;

  const a1_o = a1 + Math.PI, a2_o = a2 + Math.PI;
  const ox1 = cx + r * Math.cos(a1_o), oy1 = cy + r * Math.sin(a1_o);
  const ox2 = cx + r * Math.cos(a2_o), oy2 = cy + r * Math.sin(a2_o);
  const oTx = -Math.sin(a2_o), oTy = Math.cos(a2_o);
  const oNx = -Math.cos(a2_o), oNy = -Math.sin(a2_o);
  const ow1x = ox2 - L * (oTx + oNx) / Math.SQRT2;
  const ow1y = oy2 - L * (oTy + oNy) / Math.SQRT2;
  const ow2x = ox2 - L * (oTx - oNx) / Math.SQRT2;
  const ow2y = oy2 - L * (oTy - oNy) / Math.SQRT2;

  return {
    arc1: `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`,
    head1: `M ${w1x.toFixed(1)} ${w1y.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)} L ${w2x.toFixed(1)} ${w2y.toFixed(1)}`,
    arc2: `M ${ox1.toFixed(1)} ${oy1.toFixed(1)} A ${r} ${r} 0 0 1 ${ox2.toFixed(1)} ${oy2.toFixed(1)}`,
    head2: `M ${ow1x.toFixed(1)} ${ow1y.toFixed(1)} L ${ox2.toFixed(1)} ${oy2.toFixed(1)} L ${ow2x.toFixed(1)} ${ow2y.toFixed(1)}`
  };
}

console.log('T1:', gen(-100, 15, 9));
console.log('T2:', gen(-95, 10, 9));
console.log('T3:', gen(-105, 20, 9.5));
console.log('T4:', gen(-90, 15, 8.8));
console.log('T5:', gen(-100, 10, 9.2));
