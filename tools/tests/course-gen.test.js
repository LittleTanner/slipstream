// MECHANIC: course generation determinism. Promise: the same seed and stage yield a
// byte-identical course every time, with no cross-race leakage; different seeds differ.
const Sim = require('../sim.js');
function fp(seed, si) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed, stageIndex: si, playerType: 'rouleur', gc, leaders: {}, div: 4 });
  const c = race.course;
  return JSON.stringify({
    len: c.len,
    climbs: c.climbs.map(x => [Math.round(x.s), Math.round(x.e)]),
    primes: c.primes.map(p => [p.kind, Math.round(p.d)]),
    feeds: c.feeds.map(f => [Math.round(f.s), Math.round(f.e)]),
    winds: c.winds.map(w => [Math.round(w.s), w.dir, Math.round(w.str * 1000)]),
    eMin: c.eMin, eMax: c.eMax, base: c.baseElev || 0,
  });
}
let bad = 0;
for (const si of [0, 2, 5]) {
  const a1 = fp(1234, si), b = fp(9876, si), a2 = fp(1234, si);
  if (a1 !== a2) { console.log('FAIL: stage ' + si + ' same seed differs across creations (leakage)'); bad++; }
  if (a1 === b) { console.log('FAIL: stage ' + si + ' different seeds produced the same course'); bad++; }
}
if (bad) process.exit(1);
console.log('PASS: courses are deterministic per seed, leak-free, and seed-sensitive');
