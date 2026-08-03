// MECHANIC: head/tail wind. Promise: a headwind slows a rider, a tailwind pushes them,
// and shelter blunts both (anchor: TAILWIND PUSHES — tgt *= 1 - k * w.lon * w.str * (1 - b*q)).
// Probe: the PLAYER at rate == CFG.strokeTempo, whose pedalling effort is exactly CFG.tempo
// regardless of shelter, so realized speed isolates the wind term. Shelter comes from a
// real wheel pinned 4.5 m ahead — inside the full-draft window (gap < 9), but outside the
// collision speed-cap guard (HIT_LON + 0.9 = 2.8 m, which would clamp the player's target
// to the exposed wheel's own speed and mask the mechanic) — never from faking q, because
// draftFor overwrites q from geometry every step.
const Sim = require('../sim.js');
const { CFG } = Sim;

// lon: +1 pure headwind, -1 pure tailwind (see the winds factory comment in sim.js)
function run(lon, str, sheltered) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed: 11, stageIndex: 3, playerType: 'rouleur', gc, leaders: {}, div: 4 });
  const c = race.course;
  for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
  for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
  c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
  c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.items = []; c.feeds = []; c.litters = [];
  // one constant wind over the whole road, blowing straight along it (dir 0: no crosswind)
  c.winds = [{ d: -1e6, dir: 0, str, lon }, { d: 1e9, dir: 0, str, lon }];
  race.pacer.gone = true;                       // no pace-car slipstream polluting "exposed"

  const you = race.you;
  const others = race.riders.filter(o => !o.you);
  for (const o of others) o.plan = { k: 'raid', at: 0.99, kick: 400 };   // nobody attacks mid-test
  const wheel = sheltered ? others[0] : null;
  const parked = sheltered ? others.slice(1) : others;

  // Pin geometry and body every frame. The parked riders are held as spread-out SINGLES
  // (25 m apart, 300+ back): every group behind is size 1, so the probe pair is always
  // the frontmost/largest group ("peloton"), brk stays empty, and the rotation layer
  // (swing-off speed cuts, elbow flicks) can never touch the measurement.
  const pin = () => {
    you.x = 0;
    you.energy = 90; you.fluid = 90; you.fuel = 90; you.absorb = 0;   // fresh/dryPen/heavy pinned flat
    if (wheel) {
      wheel.dist = you.dist + 4.5; wheel.prev = wheel.dist; wheel.x = 0;
      wheel.energy = 90; wheel.fluid = 90; wheel.fuel = 90;
    }
    parked.forEach((o, i) => { o.dist = you.dist - 300 - i * 25; o.prev = o.dist; });
  };
  pin();

  let d10 = 0, qSum = 0, qN = 0;
  const steps = 120 * 40;                        // 10 s warm-up + 30 s measured window
  for (let g = 0; g < steps; g++) {
    // rate == strokeTempo: effV is exactly CFG.tempo whatever q is (the carried-effort
    // shortcut only applies below strokeTempo, the attack ramp only above it)
    Sim.step(race, CFG.fixedDt, { rate: CFG.strokeTempo, ease: false, launch: false, stumble: false, tx: 0 });
    pin();
    while (race.events.length) race.events.shift();
    const t = (g + 1) / 120;
    if (t <= 10) d10 = you.dist;
    else { qSum += you.q; qN++; }
  }
  return { gain: you.dist - d10, q: qSum / qN };
}

const E0 = run(0, 0, false);    // exposed, still air
const Eh = run(1, 1, false);    // exposed, full headwind
const Et = run(-1, 1, false);   // exposed, full tailwind
const S0 = run(0, 0, true);     // sheltered, still air
const Sh = run(1, 1, true);     // sheltered, full headwind
const St = run(-1, 1, true);    // sheltered, full tailwind

const dropE = (E0.gain - Eh.gain) / E0.gain;    // headwind cost, exposed
const gainE = (Et.gain - E0.gain) / E0.gain;    // tailwind gift, exposed
const dropS = (S0.gain - Sh.gain) / S0.gain;    // headwind cost, sheltered
const gainS = (St.gain - S0.gain) / S0.gain;    // tailwind gift, sheltered

console.log('exposed 30s gain (m): head ' + Eh.gain.toFixed(1) + '  none ' + E0.gain.toFixed(1) + '  tail ' + Et.gain.toFixed(1)
  + '  (drop ' + (dropE * 100).toFixed(1) + '%, gain ' + (gainE * 100).toFixed(1) + '%)');
console.log('sheltered 30s gain (m): head ' + Sh.gain.toFixed(1) + '  none ' + S0.gain.toFixed(1) + '  tail ' + St.gain.toFixed(1)
  + '  (drop ' + (dropS * 100).toFixed(1) + '%, gain ' + (gainS * 100).toFixed(1) + '%)');
console.log('avg shelter q: exposed-head ' + Eh.q.toFixed(2) + '  sheltered-head ' + Sh.q.toFixed(2));

// the scenario itself must be honest before the wind claims mean anything
if (Eh.q > 0.05) { console.log('FAIL: "exposed" probe was actually sheltered (q=' + Eh.q.toFixed(2) + ')'); process.exit(1); }
if (Sh.q < 0.5 || S0.q < 0.5 || St.q < 0.5) { console.log('FAIL: "sheltered" probe never got real shelter'); process.exit(1); }

// 1) headwind slows, tailwind pushes, still air sits between — with real margins
if (!(dropE > 0.03)) { console.log('FAIL: headwind did not slow an exposed rider (drop ' + (dropE * 100).toFixed(1) + '%)'); process.exit(1); }
if (!(gainE > 0.03)) { console.log('FAIL: tailwind did not push an exposed rider (gain ' + (gainE * 100).toFixed(1) + '%)'); process.exit(1); }

// 2) shelter blunts both — the sheltered rider loses/gains meaningfully less than the
//    exposed one at identical effort, but the wind still exists in the draft
if (!(dropS < dropE * 0.8)) { console.log('FAIL: shelter did not blunt the headwind (sheltered drop ' + (dropS * 100).toFixed(1) + '% vs exposed ' + (dropE * 100).toFixed(1) + '%)'); process.exit(1); }
if (!(gainS < gainE * 0.8)) { console.log('FAIL: shelter did not blunt the tailwind (sheltered gain ' + (gainS * 100).toFixed(1) + '% vs exposed ' + (gainE * 100).toFixed(1) + '%)'); process.exit(1); }
if (!(dropS > 0.005)) { console.log('FAIL: shelter erased the headwind entirely instead of blunting it'); process.exit(1); }

console.log('PASS: headwind slows, tailwind pushes, and a wheel blunts both');
