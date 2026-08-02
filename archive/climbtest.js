// Fast climbing-model tuning harness. After each physics change: re-extract sim.js,
// run this. Target (Kevin's call): DRAMATIC, GC-deciding gaps on the big mountains —
// the climber build should WIN the mountain/queen stages by a large margin, and weak
// climbers (sprinter build) should be shed and lose real time. grp5 = riders within
// 5s of the winner (8 = still glued; small = the climbs are selecting).
const Sim = require('../tools/sim.js');
const P = require('../tools/parts.js');
const R = require('./presets.js');
const SEEDS = [37, 52];

function sp(build, seed, si, plan, who) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed, stageIndex: si, playerType: who || 'rouleur', gc, leaders: {}, div: 4 });
  if (build) race.you.stats = P.buildStats(build);
  race.you.you = false; race.you.plan = { k: plan, at: 0.30, kick: 200 };
  let g = 0; while (!race.you.finished && g++ < 120 * 700) Sim.step(race, Sim.CFG.fixedDt, null);
  const o = Sim.settle(race); const y = o.find(x => x.name === 'YOU'); const w = o[0].time;
  return { place: y.place, gap: +(y.time - w).toFixed(1), grp5: o.filter(x => x.time - w < 5).length };
}
function avg(build, si, plan, who) {
  const rs = SEEDS.map(s => sp(build, s, si, plan, who));
  const place = (rs.reduce((a, r) => a + r.place, 0) / rs.length).toFixed(1);
  const gap = (rs.reduce((a, r) => a + r.gap, 0) / rs.length).toFixed(1);
  const grp5 = (rs.reduce((a, r) => a + r.grp5, 0) / rs.length).toFixed(1);
  return `place ${place}  gap ${gap}s  grp5 ${grp5}`;
}
for (const [si, nm] of [[2, 'MTN'], [4, 'QUEEN'], [0, 'FLAT']]) {
  const plan = si === 0 ? 'sprint' : 'climb';
  console.log(nm + ' (' + plan + ' plan):');
  console.log('  Climber build : ' + avg(R.PRESETS.Climber, si, plan));
  console.log('  Sprinter build: ' + avg(R.PRESETS.Sprinter, si, plan));
  console.log('  Rouleur build : ' + avg(R.PRESETS.Rouleur, si, plan));
}
console.log('\nWant: on MTN/QUEEN, Climber place ~1 with big gap over a shed Sprinter; on FLAT, Sprinter wins.');
