// MECHANIC: legs. Promise: attacking drains energy, easing brings it back — on any
// terrain, in or out of shelter (the sim's own stated rule).
const Sim = require('../sim.js');
const { CFG } = Sim;
const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
const race = Sim.createRace({ seed: 3, stageIndex: 0, playerType: 'rouleur', gc, leaders: {}, div: 4 });
const c = race.course;
for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.items = []; c.feeds = []; c.litters = [];
for (const o of race.riders) if (!o.you) o.dist = race.you.dist - 400;
// burn hard for 20s
for (let g = 0; g < 120 * 20; g++) Sim.step(race, CFG.fixedDt, { rate: 6.0, ease: false, launch: false, stumble: false, tx: race.you.x });
const afterBurn = race.you.energy;
// ease for 25s
for (let g = 0; g < 120 * 25; g++) Sim.step(race, CFG.fixedDt, { rate: 0.5, ease: true, launch: false, stumble: false, tx: race.you.x });
const afterEase = race.you.energy;
console.log('energy: 100 -> ' + afterBurn.toFixed(1) + ' after 20s flat out -> ' + afterEase.toFixed(1) + ' after 25s easing');
if (afterBurn > 85) { console.log('FAIL: riding flat out barely cost anything'); process.exit(1); }
if (afterEase < afterBurn + 8) { console.log('FAIL: easing did not bring the legs back'); process.exit(1); }
console.log('PASS: efforts drain, easing recovers');
