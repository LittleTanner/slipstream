// MECHANIC: handling vs speed. Promise: steering authority is INVERSE to speed — the
// same steering command crosses the road faster at low speed than at high speed, so
// braking is the answer to a corner (DECISIONS: "slower means more steering authority",
// deliberately inverted from the old scale-up-with-pace behavior).
const Sim = require('../sim.js');
const { CFG } = Sim;

// One condition = one fresh race (same seed, so identical flattened course), the player
// PINNED to a speed each frame (probing the steering physics, so the longitudinal
// decision layer is taken out of the loop), commanded across the full road width.
function run(V) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed: 11, stageIndex: 3, playerType: 'rouleur', gc, leaders: {}, div: 4 });
  race.course.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
  const c = race.course;
  for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
  for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
  c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
  c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.items = []; c.feeds = []; c.litters = [];
  const you = race.you;
  you.dist = 500; you.prev = 500; you.speed = V;          // past the start, mid-road physics
  you.x = -3.2; you.tx = -3.2; you.txS = -3.2; you.vx = 0; // near one verge (edge is 3.95 here)
  for (const o of race.riders) if (!o.you) { o.dist = you.dist - 400; o.prev = o.dist; }
  // warmup: 1s holding the line so any transients (car, groups) settle
  for (let g = 0; g < 120; g++) {
    you.speed = V;
    Sim.step(race, CFG.fixedDt, { rate: 0, ease: true, launch: false, stumble: false, tx: -3.2 });
    race.events.length = 0;
  }
  // the command: get to the other verge. Same command both conditions; only speed differs.
  let peakVx = 0, tCross = null, spSum = 0, n = 0;
  for (let g = 0; g < 120 * 6; g++) {
    you.speed = V;                                        // pin: speed is the ONLY variable
    Sim.step(race, CFG.fixedDt, { rate: 0, ease: true, launch: false, stumble: false, tx: 3.2 });
    race.events.length = 0;
    peakVx = Math.max(peakVx, Math.abs(you.vx));
    spSum += you.speed; n++;
    if (tCross === null && you.x >= 2.8) tCross = (g + 1) / 120;
  }
  return { peakVx, tCross, avgSpeed: spSum / n, down: you.down, out: you.out };
}

const lo = run(5);    // well under CFG.base*1.5/3.0: full low-speed authority
const hi = run(17);   // well over CFG.base*1.5/1.32: authority at its floor
console.log('slow (' + lo.avgSpeed.toFixed(1) + ' m/s): peak lateral ' + lo.peakVx.toFixed(2) + ' m/s, crossed in ' + (lo.tCross === null ? 'never' : lo.tCross.toFixed(2) + 's'));
console.log('fast (' + hi.avgSpeed.toFixed(1) + ' m/s): peak lateral ' + hi.peakVx.toFixed(2) + ' m/s, crossed in ' + (hi.tCross === null ? 'never' : hi.tCross.toFixed(2) + 's'));

if (lo.down > 0 || lo.out || hi.down > 0 || hi.out) { console.log('FAIL: a rider crashed on a flat straight — scenario invalid'); process.exit(1); }
// the control must be real: the two conditions must actually have ridden at different speeds
if (!(lo.avgSpeed < 7 && hi.avgSpeed > 14)) { console.log('FAIL: speed pin did not hold — conditions not comparable'); process.exit(1); }
if (lo.tCross === null || hi.tCross === null) { console.log('FAIL: a rider never made the far side — steering dead'); process.exit(1); }
// the promise, twice over: more authority when slow, and it cashes out as a faster crossing
if (!(lo.peakVx >= hi.peakVx * 1.5)) { console.log('FAIL: slow rider had no extra steering authority (peak ' + lo.peakVx.toFixed(2) + ' vs ' + hi.peakVx.toFixed(2) + ')'); process.exit(1); }
if (!(lo.tCross * 1.25 < hi.tCross)) { console.log('FAIL: slowing down did not buy a faster crossing (' + lo.tCross.toFixed(2) + 's vs ' + hi.tCross.toFixed(2) + 's)'); process.exit(1); }
console.log('PASS: slower means more steering authority — braking is the answer to a corner');
