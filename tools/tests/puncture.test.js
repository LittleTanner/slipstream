// MECHANIC: punctures. Promise: a flat is a STOP, not a slow ride — while flat > 0 the
// rider barely moves (power x0.07), then rides again when it clears; real distance lost.
const Sim = require('../sim.js');
const { CFG } = Sim;
function run(withFlat) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed: 5, stageIndex: 3, playerType: 'rouleur', gc, leaders: {}, div: 4 });
  race.course.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
  const c = race.course;
  for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
  for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
  c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
  c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.items = []; c.feeds = []; c.litters = [];
  for (const o of race.riders) if (!o.you) o.dist = race.you.dist - 400;
  // get up to speed first
  for (let g = 0; g < 120 * 8; g++) Sim.step(race, CFG.fixedDt, { rate: 3.5, ease: false, launch: false, stumble: false, tx: race.you.x });
  const speedBefore = race.you.speed;
  if (withFlat) race.you.flat = 5.0;
  let minSpeed = 99;
  for (let g = 0; g < 120 * 8; g++) {
    Sim.step(race, CFG.fixedDt, { rate: 3.5, ease: false, launch: false, stumble: false, tx: race.you.x });
    if (g > 60 && g < 120 * 5) minSpeed = Math.min(minSpeed, race.you.speed);
  }
  // ride on after it clears
  for (let g = 0; g < 120 * 6; g++) Sim.step(race, CFG.fixedDt, { rate: 3.5, ease: false, launch: false, stumble: false, tx: race.you.x });
  return { dist: race.you.dist, minSpeed, speedBefore, speedAfter: race.you.speed };
}
const ok = run(false), flat = run(true);
const lost = ok.dist - flat.dist;
console.log('min speed during flat: ' + flat.minSpeed.toFixed(2) + ' (cruise ' + ok.speedBefore.toFixed(1) + '), distance lost: ' + lost.toFixed(1) + ', speed after: ' + flat.speedAfter.toFixed(1));
if (flat.minSpeed > 2.0) { console.log('FAIL: a flat should be a stop, not a slow ride'); process.exit(1); }
if (lost < 40) { console.log('FAIL: a 5s flat cost almost nothing (' + lost.toFixed(1) + ')'); process.exit(1); }
if (flat.speedAfter < ok.speedAfter * 0.8) { console.log('FAIL: rider never got going again after the flat'); process.exit(1); }
console.log('PASS: a puncture stops you, costs real distance, and you ride again after');
