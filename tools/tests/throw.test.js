// MECHANIC: the bike throw. Promise: thrown in the window before the line it is worth
// a real fraction of a second at the finish; identical runs differ only by the throw.
const Sim = require('../sim.js');
const { CFG } = Sim;
function run(throwing) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed: 5, stageIndex: 3, playerType: 'rouleur', gc, leaders: {}, div: 4 });
  race.course.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
  const c = race.course;
  for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
  for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
  c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
  c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.items = []; c.feeds = []; c.litters = [];
  // the throw targets a LINE (a prime); keep only the finish line
  c.primes = [{ d: c.len, kind: 'finish', pts: [12, 9, 7, 5, 3, 2, 1], crossed: [] }];
  for (const o of race.riders) if (!o.you) o.dist = race.you.dist - 600;
  // start the run a fixed distance from the line
  const jump = c.len - 400 - race.you.dist;
  for (const r of race.riders) { r.dist += jump; r.prev = r.dist; }
  let g = 0;
  while (!race.you.finished && g++ < 120 * 90) {
    const togo = c.len - race.you.dist;
    const throwIt = throwing && togo < 3.2;   // quality peaks ~throwPeak (2) out
    Sim.step(race, CFG.fixedDt, { rate: 4.0, ease: false, launch: false, stumble: false, tx: race.you.x, throwIt });
  }
  return race.you.time;
}
const plain = run(false), thrown = run(true);
const gain = plain - thrown;
console.log('finish: no throw ' + plain.toFixed(3) + 's, with throw ' + thrown.toFixed(3) + 's, gain ' + gain.toFixed(3) + 's');
if (!(gain > 0.005)) { console.log('FAIL: the throw gained nothing at the line'); process.exit(1); }
if (gain > 1.5) { console.log('FAIL: the throw gained an absurd amount (' + gain.toFixed(2) + 's)'); process.exit(1); }
console.log('PASS: a timed throw buys a real fraction of a second at the line');
