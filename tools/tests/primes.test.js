// MECHANIC: primes. Promise: crossing a sprint prime among the first takes its points
// in crossing order; KOM primes award komPts; the points survive into the results.
const Sim = require('../sim.js');
const { CFG } = Sim;
const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
const race = Sim.createRace({ seed: 5, stageIndex: 3, playerType: 'rouleur', gc, leaders: {}, div: 4 });
race.course.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
const c = race.course;
for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.items = []; c.feeds = []; c.litters = [];
const others = race.riders.filter(o => !o.you);
// the player leads, one rival trails 30 back, the rest are far away
const rival = others[0];
rival.dist = race.you.dist - 30; rival.plan = { k: 'raid', at: 0.99, kick: 400 };
for (const o of others.slice(1)) o.dist = race.you.dist - 500;
c.primes = [
  { d: race.you.dist + 150, kind: 'sprint', pts: [5, 3, 2, 1], crossed: [] },
  { d: race.you.dist + 220, kind: 'kom', pts: [6, 4, 2], crossed: [] },
];
for (let g = 0; g < 120 * 40; g++) {
  rival.eff = 'tempo';
  Sim.step(race, CFG.fixedDt, { rate: 3.2, ease: false, launch: false, stumble: false, tx: race.you.x });
  if (race.you.dist > c.primes[1].d + 60 && rival.dist > c.primes[1].d + 60) break;
}
const you = race.you;
console.log('you: sprintPts=' + you.sprintPts + ' komPts=' + you.komPts + '  rival: sprintPts=' + rival.sprintPts + ' komPts=' + rival.komPts);
if (you.sprintPts !== 5) { console.log('FAIL: first across the sprint prime should take 5 (got ' + you.sprintPts + ')'); process.exit(1); }
if (you.komPts !== 6) { console.log('FAIL: first over the KOM should take 6 (got ' + you.komPts + ')'); process.exit(1); }
if (rival.sprintPts !== 3 || rival.komPts !== 4) { console.log('FAIL: second across should take 3/4 (got ' + rival.sprintPts + '/' + rival.komPts + ')'); process.exit(1); }
console.log('PASS: primes pay in crossing order, sprint and KOM alike');
