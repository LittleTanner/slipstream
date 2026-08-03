// MECHANIC: peloton mass shelter. Promise: shelters COMPOUND — every rider in your wind
// path breaks up some air (shelter = 1 - (1-q1)(1-q2)...), so sitting deep in a bunch is
// meaningfully cheaper than sitting on a single wheel. Not shadowing: a wheel tucked
// behind another must add shelter, not cancel it.
// Design: measure steady-state q for the SAME rider as last wheel of a 2-rider line and
// as last wheel of a 6-rider line. The nearest wheel (same rival, same 2.2 m gap, same
// 0.9 m lateral offset) is identical in both, so any q gain can only come from the
// stacking of the deeper wheels. Offsets keep each wheel's individual q well below 1
// (lat 0.9 of laneTol 2.8) so there is headroom for compounding to show; spacing 2.2 m
// stays outside contact range so separate() never perturbs the pattern.
const Sim = require('../sim.js');
const { CFG } = Sim;

const SPACING = 2.2;
const slotX = k => (k === 0 ? 0 : (k % 2 ? 0.9 : -0.9)); // k = wheels ahead of the back marker

function measure(depth) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed: 11, stageIndex: 3, playerType: 'rouleur', gc, leaders: {}, div: 4 });
  race.course.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
  const c = race.course;
  for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
  for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
  c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
  c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.items = []; c.feeds = []; c.litters = [];
  race.pacer.gone = true;                       // the car's slipstream must not pollute q
  const others = race.riders.filter(o => !o.you);
  // line[0] is the measured back marker in BOTH races; line[k] is its k-th wheel ahead.
  // Using others[0..depth-1] keeps rider identity per slot the same across depths.
  const line = others.slice(0, depth);
  const base = race.you.dist + 250;
  line.forEach((o, k) => {
    o.dist = base + k * SPACING; o.prev = o.dist;
    o.x = slotX(k); o.tx = o.x; o.vx = 0;
    o.speed = 11;
    o.plan = { k: 'raid', at: 0.99, kick: 400 }; // no mid-test attacks
  });
  // park the rest well back, spread out so no big parked group outweighs the line
  for (let i = depth; i < others.length; i++) {
    const o = others[i];
    o.dist = race.you.dist - 300 - (i - depth) * 25; o.prev = o.dist;
  }
  const front = line[line.length - 1], back = line[0];
  let qSum = 0, n = 0;
  const warm = 120 * 3, total = 120 * 15;
  for (let g = 0; g < total; g++) {
    for (const o of line) o.eff = 'tempo';      // pin the decision layer: physics only
    Sim.step(race, CFG.fixedDt, { rate: 0, ease: true, launch: false, stumble: false, tx: race.you.x });
    // pin the geometry: the front rider rides free, everyone else is glued to the pattern
    line.forEach((o, k) => {
      if (o === front) return;
      o.dist = front.dist - (line.length - 1 - k) * SPACING; o.prev = o.dist;
      o.x = slotX(k); o.vx = 0;
    });
    while (race.events.length) race.events.shift();
    if (g >= warm) { qSum += back.q; n++; }
  }
  return qSum / n;
}

const qShallow = measure(2);
const qDeep = measure(6);
console.log('last wheel of 2 avg q=' + qShallow.toFixed(3) + '  last wheel of 6 avg q=' + qDeep.toFixed(3) + '  gain=' + (qDeep - qShallow).toFixed(3));
if (qShallow < 0.25) { console.log('FAIL: a single offset wheel gave no real shelter — the comparison base is broken'); process.exit(1); }
if (qShallow > 0.80) { console.log('FAIL: one wheel nearly saturates shelter — this geometry no longer isolates compounding'); process.exit(1); }
if (qDeep - qShallow < 0.25) { console.log('FAIL: shelter does not compound — deep in the bunch is no better than one wheel'); process.exit(1); }
console.log('PASS: shelters stack — the deep bunch is a meaningfully better place than a single wheel');
