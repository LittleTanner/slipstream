// MECHANIC: feeding. Promise: riding over an item on the right line picks it up — food
// tops up fuel through the stomach (absorb loads), a bottle restores fluid — and a
// pickup far off your line does not happen.
const Sim = require('../sim.js');
const { CFG } = Sim;
function run(itemX) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed: 5, stageIndex: 3, playerType: 'rouleur', gc, leaders: {}, div: 4 });
  race.course.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
  const c = race.course;
  for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
  for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
  c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
  c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.feeds = []; c.litters = [];
  for (const o of race.riders) if (!o.you) o.dist = race.you.dist - 400;
  race.you.fuel = 40; race.you.fluid = 40; race.you.absorb = 0;
  c.items = [
    { kind: 'food', d: race.you.dist + 120, x: itemX, taken: new Set() },
    { kind: 'water', d: race.you.dist + 160, x: itemX, taken: new Set() },
  ];
  for (let g = 0; g < 120 * 25; g++) Sim.step(race, CFG.fixedDt, { rate: 3.0, ease: false, launch: false, stumble: false, tx: 0 });
  return { fuel: race.you.fuel, fluid: race.you.fluid, absorb: race.you.absorb, took: c.items.filter(i => i.taken.has(race.you)).length };
}
const on = run(0), off = run(3.4);
console.log('on the line: took ' + on.took + ', fuel 40->' + on.fuel.toFixed(1) + ', fluid 40->' + on.fluid.toFixed(1) + ', absorb ' + on.absorb.toFixed(1) + '  |  off the line: took ' + off.took);
if (on.took !== 2) { console.log('FAIL: riding over the items did not pick them up'); process.exit(1); }
if (on.fuel <= 41 || on.fluid <= 41) { console.log('FAIL: pickups did not feed fuel/fluid'); process.exit(1); }
if (off.took !== 0) { console.log('FAIL: picked up items far off the riding line'); process.exit(1); }
console.log('PASS: feeding works on the line, not off it, and flows through the stomach');
