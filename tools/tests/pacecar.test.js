// MECHANIC: pace car slipstream. Promise: for a few seconds after the flag, the hole the
// car punches (within carDraft behind it, lined up with its x) is a real tow — carTow
// climbs well past 0.3, q is boosted beyond anything a stack of wheels can give (wheel
// shelter compounds toward 1 but never reaches it; the car's hole exceeds 1), and the
// towed rider hits speeds an identical rider sprinting BESIDE the hole cannot touch.
// The window closes itself: the car accelerates away, and once it is gone carTow is
// exactly zero, every frame.
const Sim = require('../sim.js');
const { CFG } = Sim;

// One run: identical setup both times; only the lateral line-up differs. lineUp=true
// parks the player squarely behind the car's x, lineUp=false rides the same gap 3.0
// to the side — outside the hole, so lined resolves to 0 and there is no tow.
function run(lineUp) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed: 11, stageIndex: 3, playerType: 'rouleur', gc, leaders: {}, div: 4 });
  race.course.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
  const c = race.course;
  for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
  for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
  c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
  c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.items = []; c.feeds = []; c.litters = [];
  const you = race.you, pc = race.pacer;
  for (const o of race.riders) if (!o.you) { o.dist = you.dist - 400; o.prev = o.dist; }
  const myX = () => lineUp ? pc.x : pc.x + 3.0;
  // The car has no dist until the first tick; one step brings it to life 16 m up the
  // road, THEN the player is placed on its bumper (the sprint-off-the-gun the mechanic
  // rewards, done by hand so both runs start from the identical spot).
  Sim.step(race, CFG.fixedDt, { rate: 0, ease: false, launch: false, stumble: false, tx: myX() });
  you.dist = pc.dist - 1.5; you.prev = you.dist; you.speed = pc.v; you.x = myX();
  const out = { peakTow: 0, peakQ: 0, peakSpeed: 0, goneAt: null, towAfterGone: 0, anyTow: 0 };
  for (let g = 0; g < 120 * 40; g++) {
    const gap = (pc.gone || pc.dist === undefined) ? 1e9 : pc.dist - you.dist;
    // chase the bumper hard, feather off right on it, soft-pedal once the car is gone
    const rate = pc.gone ? 0 : gap > 2.2 ? 6 : gap > 1.4 ? 2.5 : 0;
    Sim.step(race, CFG.fixedDt, { rate, ease: !pc.gone && gap < 0.9, launch: false, stumble: false, tx: myX() });
    you.x = myX();                              // pin geometry: squarely in (or beside) the hole
    while (race.events.length) race.events.shift();
    const t = (g + 1) / 120;
    if (you.carTow > out.peakTow) out.peakTow = you.carTow;
    if (you.carTow > 0) out.anyTow++;
    if (you.carTow > 0.3 && you.q > out.peakQ) out.peakQ = you.q;
    if (you.speed > out.peakSpeed) out.peakSpeed = you.speed;
    if (pc.gone && out.goneAt === null) out.goneAt = t;
    if (pc.gone && you.carTow > 0) out.towAfterGone++;
  }
  return out;
}

const tow = run(true);
const ctl = run(false);
console.log('in the hole: peak carTow=' + tow.peakTow.toFixed(2) + ' peak q=' + tow.peakQ.toFixed(2)
  + ' peak speed=' + tow.peakSpeed.toFixed(2) + ' car gone at ' + (tow.goneAt && tow.goneAt.toFixed(1)) + 's');
console.log('beside it:  peak carTow=' + ctl.peakTow.toFixed(2) + ' peak speed=' + ctl.peakSpeed.toFixed(2));

if (tow.peakTow < 0.3) { console.log('FAIL: on the bumper, carTow never rose above 0.3 (peak ' + tow.peakTow.toFixed(2) + ')'); process.exit(1); }
if (tow.peakQ <= 1.0) { console.log('FAIL: the car\'s hole did not boost q past what wheels can give (peak q ' + tow.peakQ.toFixed(2) + ')'); process.exit(1); }
if (ctl.peakTow > 0) { console.log('FAIL: a rider 3.0 off the car\'s line still got carTow=' + ctl.peakTow.toFixed(2) + ' — line-up should gate the tow'); process.exit(1); }
if (tow.peakSpeed < ctl.peakSpeed + 0.8) {
  console.log('FAIL: the tow was not a sling — in the hole ' + tow.peakSpeed.toFixed(2) + ' vs beside it ' + ctl.peakSpeed.toFixed(2));
  process.exit(1);
}
if (tow.goneAt === null) { console.log('FAIL: the car never left — the window must close itself'); process.exit(1); }
if (tow.towAfterGone > 0) { console.log('FAIL: carTow > 0 on ' + tow.towAfterGone + ' frames after the car was gone'); process.exit(1); }
console.log('PASS: the car\'s hole tows hard, only when lined up, and the window closes with the car');
