// MECHANIC: thin air. Promise: above ~1200 m altitude the air costs RECOVERY and
// WATER — recovery while easing is slower and fluid drains faster — but raw POWER is
// deliberately NOT cut (cutting power would just duplicate climbing ability).
// Method: two identical flat scenarios differing ONLY in course.baseElev (0 m vs
// 2600 m, where thin saturates at 1). altAt() feeds nothing in the sim but `thin`,
// so any behavioral difference between the runs IS the mechanic.
const Sim = require('../sim.js');
const { CFG } = Sim;

function mkRace(baseElev) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed: 11, stageIndex: 3, playerType: 'rouleur', gc, leaders: {}, div: 4 });
  const c = race.course;
  c.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
  for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
  for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
  c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
  c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.items = []; c.feeds = []; c.litters = [];
  c.baseElev = baseElev;                       // the ONLY difference between the two runs
  for (const o of race.riders) if (!o.you) o.plan = { k: 'raid', at: 0.99, kick: 400 };
  return race;
}

function run(baseElev) {
  const race = mkRace(baseElev);
  const you = race.you;
  const others = race.riders.filter(o => !o.you);
  const lead = others[0];
  const park = keepLead => {
    for (const o of others) {
      if (keepLead && o === lead) continue;
      o.dist = you.dist - 400; o.prev = o.dist;
    }
  };
  const drain = () => { while (race.events.length) race.events.shift(); };

  // Phase 1 — POWER. Solo in clean air, flat out, resources pinned every frame so
  // fresh/dryPen/heavy are constant: distance covered is pure power vs drag, and
  // thin air must not touch it.
  const d0 = you.dist;
  for (let g = 0; g < 120 * 25; g++) {
    you.energy = 100; you.fluid = 100; you.fuel = 100; you.absorb = 0;
    park(false);
    Sim.step(race, CFG.fixedDt, { rate: 5, ease: false, launch: false, stumble: false, tx: you.x });
    drain();
  }
  const powerDist = you.dist - d0;

  // Phase 2 — RECOVERY. Sheltered on a glued wheel (an exposed rider's recovery is
  // clipped by the ease floor, which would mask thin), easing. Energy is reset to 40
  // every frame so the cap never saturates; the per-frame gain accumulates into a
  // total recovery figure.
  let recSum = 0, qSum = 0, qN = 0;
  for (let g = 0; g < 120 * 15; g++) {
    you.energy = 40; you.fluid = 100; you.fuel = 100; you.absorb = 0;
    park(true);
    lead.dist = you.dist + 2.5; lead.prev = lead.dist;   // just past contact range, full draft
    lead.x = you.x; lead.speed = you.speed;
    lead.eff = 'tempo'; lead.energy = 100; lead.fluid = 100; lead.fuel = 100;
    Sim.step(race, CFG.fixedDt, { rate: 0, ease: true, launch: false, stumble: false, tx: you.x });
    recSum += you.energy - 40;
    qSum += you.q; qN++;
    drain();
  }
  const avgQ = qSum / qN;

  // Phase 3 — WATER. Solo again, riding hard; fluid reset to 80 every frame and the
  // per-frame loss accumulated, so dryness never feeds back into the effort.
  let sweatSum = 0;
  for (let g = 0; g < 120 * 20; g++) {
    you.energy = 100; you.fluid = 80; you.fuel = 100; you.absorb = 0;
    park(false);
    Sim.step(race, CFG.fixedDt, { rate: 5, ease: false, launch: false, stumble: false, tx: you.x });
    sweatSum += 80 - you.fluid;
    drain();
  }
  return { powerDist, recSum, avgQ, sweatSum };
}

const sea = run(0);      // thin = 0
const alt = run(2600);   // full effect: thin = 1 from ~2600 m
console.log('power dist: sea ' + sea.powerDist.toFixed(1) + ' vs alt ' + alt.powerDist.toFixed(1)
  + '  |  recovery: sea ' + sea.recSum.toFixed(1) + ' vs alt ' + alt.recSum.toFixed(1)
  + ' (q ' + sea.avgQ.toFixed(2) + '/' + alt.avgQ.toFixed(2) + ')'
  + '  |  sweat: sea ' + sea.sweatSum.toFixed(2) + ' vs alt ' + alt.sweatSum.toFixed(2));

if (sea.powerDist < 250) { console.log('FAIL: rider barely moved at full gas — scenario broken'); process.exit(1); }
if (sea.avgQ < 0.5 || alt.avgQ < 0.5) { console.log('FAIL: recovery phase was not sheltered — the ease floor would mask thin air'); process.exit(1); }
if (sea.recSum < 100) { console.log('FAIL: sea-level sheltered recovery implausibly small — floor-clipped, not measuring the rate'); process.exit(1); }
if (sea.sweatSum < 1) { console.log('FAIL: no measurable sweat at sea level — scenario broken'); process.exit(1); }

const powerDiff = Math.abs(alt.powerDist - sea.powerDist) / sea.powerDist;
if (powerDiff > 0.005) { console.log('FAIL: altitude changed attainable speed by ' + (100 * powerDiff).toFixed(2) + '% — thin air must never cut raw power'); process.exit(1); }
if (alt.recSum <= 0) { console.log('FAIL: legs do not come back at all at altitude — thin slows recovery, it must not stop it'); process.exit(1); }
if (alt.recSum >= sea.recSum * 0.85) { console.log('FAIL: recovery at 2600 m is ' + (100 * alt.recSum / sea.recSum).toFixed(1) + '% of sea level — thin air is not slowing recovery'); process.exit(1); }
if (alt.sweatSum <= sea.sweatSum * 1.15) { console.log('FAIL: fluid drain at 2600 m is ' + (100 * alt.sweatSum / sea.sweatSum).toFixed(1) + '% of sea level — thin air is not costing water'); process.exit(1); }
console.log('PASS: altitude leaves power alone, slows recovery, drains the bottle faster');
