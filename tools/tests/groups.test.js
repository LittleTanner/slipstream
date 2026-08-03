// MECHANIC: group detection. Promise: the peloton is the largest group; riders 10+
// clear of its head are the breakaway; ties resolve to the FRONT group (the known,
// documented gotcha — asserted here as current behavior; it underlies the open 4-6
// break design question).
const Sim = require('../sim.js');
const { CFG } = Sim;
function scenario(place) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed: 9, stageIndex: 3, playerType: 'rouleur', gc, leaders: {}, div: 4 });
  race.course.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
  const c = race.course;
  for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
  for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
  c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
  c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.items = []; c.feeds = []; c.litters = [];
  place(race);
  for (const r of race.riders) { r.prev = r.dist; r.speed = 11; }
  Sim.step(race, CFG.fixedDt, { rate: 2, ease: false, launch: false, stumble: false, tx: race.you.x });
  return race;
}
// 1: three clear of a five-rider bunch (player in the bunch)
let race = scenario(r => {
  const o = r.riders.filter(x => !x.you);
  o.forEach((x, i) => { x.dist = i < 3 ? r.you.dist + 300 + i * 2 : r.you.dist + (i % 2 ? 1 : -1); });
});
let brkN = race.breakaway.length, youIn = race.you.inPeloton;
if (brkN !== 3 || !youIn) { console.log('FAIL: 3-clear split read as brk=' + brkN + ' youInPeloton=' + youIn); process.exit(1); }
// 2: a 4/4 tie — the FRONT group is crowned peloton (the gotcha)
race = scenario(r => {
  const o = r.riders.filter(x => !x.you);
  o.forEach((x, i) => { x.dist = i < 4 ? r.you.dist + 300 + (i % 2) : r.you.dist + (i % 2); });
});
const frontIsPeloton = race.riders.filter(x => !x.you).slice(0, 4).every(x => x.inPeloton);
if (!frontIsPeloton || race.you.inPeloton) { console.log('FAIL: 4/4 tie did not crown the front group (gotcha changed?)'); process.exit(1); }
if (race.breakaway.length !== 0) { console.log('FAIL: tie case produced a breakaway of ' + race.breakaway.length); process.exit(1); }
// 3: everyone together — one peloton, no breakaway
race = scenario(r => { for (const x of r.riders) if (!x.you) x.dist = r.you.dist + (x.i % 3); });
if (race.breakaway.length !== 0 || !race.you.inPeloton) { console.log('FAIL: compact bunch not one peloton'); process.exit(1); }
console.log('PASS: largest group is the peloton, 10+ clear is the break, ties go to the front (documented gotcha)');
