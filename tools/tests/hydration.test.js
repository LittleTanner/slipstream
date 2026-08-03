// MECHANIC: fluids and sweat. Promise: a dry rider is down on power (dryPen bites
// below 35 fluid, floor 0.85), and a dry rider CANNOT attack — below 12 fluid an
// attack effort degrades to tempo (`if (r.fluid < 12 && r.eff === "attack")`).
// Four probes with identical bodies, pinned effort and pinned fluid, each alone in
// clean air 70 m apart (draft reach is 19 m; the order puts faster ahead of slower
// so every gap only grows) so only hydration differs:
//   HA hydrated attacker · HT hydrated tempo · DA dry "attacker" · DT dry tempo
// Assert: HT clearly outruns DT (the dry deficit), DA rides at DT's pace exactly
// (the attack cap), and HA rides away from DA (a dry rider cannot attack).
const Sim = require('../sim.js');
const { CFG } = Sim;
const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
const race = Sim.createRace({ seed: 11, stageIndex: 3, playerType: 'rouleur', gc, leaders: {}, div: 4 });
race.course.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
const c = race.course;
for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.items = []; c.feeds = []; c.litters = [];
race.pacer.gone = true;                     // no car slipstream near anybody

const others = race.riders.filter(o => !o.you);
const probes = [                            // fastest at the front so gaps only grow
  { tag: 'HA', r: others[0], fluid: 100, eff: 'attack', off: 250 },
  { tag: 'HT', r: others[1], fluid: 100, eff: 'tempo',  off: 180 },
  { tag: 'DA', r: others[2], fluid:   0, eff: 'attack', off: 110 },
  { tag: 'DT', r: others[3], fluid:   0, eff: 'tempo',  off:  40 },
];
const body = Object.assign({}, others[0].stats);   // one body for all four
for (const p of probes) {
  p.r.stats = Object.assign({}, body);
  p.r.strength = 1;
  p.r.plan = { k: 'raid', at: 0.99, kick: 400 };
  p.r.dist = race.you.dist + p.off; p.r.prev = p.r.dist;
  p.r.x = 0; p.r.tx = 0; p.r.speed = 11;
}
// Park the rest FROZEN NEAR THE FINISH, not behind: the largest group is "the
// peloton", and any 2+ riders 10 m clear of its head become a rotating break —
// which hands the front probe a swing-off cut and tows the next one at
// breakFront.speed + 1.2. With the peloton's head ahead of every probe, no break
// ever forms and the probes are pure physics. They freeze via startAt and sit
// 600+ m up the road, far beyond any probe's reach in this window.
others.slice(4).forEach((o, i) => { o.dist = c.len - 30 - i * 2; o.prev = o.dist; o.startAt = 1e9; });

const WARM = 120 * 6, MEAS = 120 * 30;
// fastest probe ~17 m/s: it must stay short of the finish kick zone (togo < 300)
// AND short of the frozen trio for the whole window
if (c.len < race.you.dist + 250 + 17 * (WARM + MEAS) / 120 + 350) {
  console.log('FAIL: course too short for the probe window (len ' + c.len.toFixed(0) + ')'); process.exit(1);
}
function pinAll() {
  for (const p of probes) {
    const r = p.r;
    r.eff = p.eff; r.think = 1;             // hold the decision layer still: physics only
    r.fluid = p.fluid; r.energy = 100; r.fuel = 100; r.absorb = 0;
    r.burst = 0; r.jump = 0; r.spin = 0; r.windUp = 0; r.attackFor = 0;
  }
}
let mark = null;
for (let g = 0; g < WARM + MEAS; g++) {
  pinAll();
  Sim.step(race, CFG.fixedDt, { rate: 0, ease: true, launch: false, stumble: false, tx: race.you.x });
  while (race.events.length) race.events.shift();
  if (g === WARM - 1) mark = probes.map(p => p.r.dist);
}
const v = probes.map((p, i) => (p.r.dist - mark[i]) / (MEAS / 120));
const [vHA, vHT, vDA, vDT] = v;
console.log('avg speed m/s: ' + probes.map((p, i) => p.tag + '=' + v[i].toFixed(3)).join('  '));

if (!(vHT - vDT >= 0.07 * vHT)) {
  console.log('FAIL: dry tempo rider is not meaningfully slower (dryPen missing): HT '
    + vHT.toFixed(3) + ' vs DT ' + vDT.toFixed(3)); process.exit(1);
}
if (!(Math.abs(vDA - vDT) <= 0.02 * vDT)) {
  console.log('FAIL: dry attack should degrade to tempo pace: DA ' + vDA.toFixed(3)
    + ' vs DT ' + vDT.toFixed(3)); process.exit(1);
}
if (!(vHA - vDA >= 0.15 * vDA)) {
  console.log('FAIL: hydrated attacker should ride away from a dry one: HA '
    + vHA.toFixed(3) + ' vs DA ' + vDA.toFixed(3)); process.exit(1);
}
console.log('PASS: dry legs fade, and below 12 fluid an attack is just tempo');
