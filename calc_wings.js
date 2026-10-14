const tip = [79.5, 55.2];
const w1_base = [87.7, 49.4];
const w2_base = [73.7, 47.0];
const v1x = (w1_base[0] - tip[0]) / 10.04;
const v1y = (w1_base[1] - tip[1]) / 10.04;
const v2x = (w2_base[0] - tip[0]) / 10.04;
const v2y = (w2_base[1] - tip[1]) / 10.04;

[12, 13.5, 15, 16.7, 18].forEach(L => {
  const nw1 = [tip[0] + L * v1x, tip[1] + L * v1y];
  const nw2 = [tip[0] + L * v2x, tip[1] + L * v2y];
  const ow1 = [100 - nw1[0], 100 - nw1[1]];
  const ow2 = [100 - nw2[0], 100 - nw2[1]];
  console.log(`L=${L.toFixed(1)}:`);
  console.log(`  top: M ${nw1[0].toFixed(1)} ${nw1[1].toFixed(1)} L 79.5 55.2 L ${nw2[0].toFixed(1)} ${nw2[1].toFixed(1)}`);
  console.log(`  bot: M ${ow1[0].toFixed(1)} ${ow1[1].toFixed(1)} L 20.5 44.8 L ${ow2[0].toFixed(1)} ${ow2[1].toFixed(1)}`);
});
