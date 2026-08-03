// MECHANIC: the stomach (absorb). Promise: a full stomach makes the legs heavy —
// the same rider, at the same effort, on the same steady climb goes measurably
// slower right after eating (absorb 100) than on an empty stomach (absorb 0) —
// and digestion drains the stomach at a steady rate, so the heaviness fades.
const Sim = require('../sim.js');
const { CFG } = Sim;

function makeRace() {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed: 11, stageIndex: 0, playerType: 'rouleur', gc, leaders: {}, div: 4 });
  const c = race.course;
  // flatten everything, then stamp a steady climb — gradient is the promise's terrain
  for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0.6;
  for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
  c.eMin = 0; c.eMax = 40; c.baseElev = 0;               // sea level: no thin-air noise
  c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
  c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.items = []; c.feeds = []; c.litters = [];
  c.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
  for (const o of race.riders.filter(o => !o.you)) {
    o.dist = race.you.dist - 400;                        // parked: no shelter, no contact
    o.plan = { k: 'raid', at: 0.99, kick: 400 };
  }
  return race;
}

// rate 2.0 = exactly tempo out of shelter: effort identical in both runs, energy
// neither drains nor recovers, so the ONLY difference power can see is the stomach.
function policy(you) { return { rate: 2.0, ease: false, launch: false, stumble: false, tx: you.x }; }

// --- 1. heavy legs: pin absorb each frame (probing the multiplier, not digestion) ---
function climbRun(absorbPin) {
  const race = makeRace();
  const you = race.you, start = you.dist;
  for (let g = 0; g < 120 * 25; g++) {
    you.absorb = absorbPin;
    Sim.step(race, CFG.fixedDt, policy(you));
    while (race.events.length) race.events.shift();
  }
  return { dist: you.dist - start, speed: you.speed };
}
const empty = climbRun(0), full = climbRun(100);
const deficit = (empty.dist - full.dist) / empty.dist;
console.log('25s of steady climb: empty stomach ' + empty.dist.toFixed(1) + 'm @ ' + empty.speed.toFixed(2)
  + ' m/s, full stomach ' + full.dist.toFixed(1) + 'm @ ' + full.speed.toFixed(2)
  + ' m/s  (deficit ' + (100 * deficit).toFixed(1) + '%)');
if (empty.dist < 100) { console.log('FAIL: scenario dead — rider barely moved on the climb'); process.exit(1); }
if (full.speed >= empty.speed) { console.log('FAIL: a full stomach did not slow the rider at all'); process.exit(1); }
if (deficit < 0.08) { console.log('FAIL: full-stomach deficit ' + (100 * deficit).toFixed(1) + '% — heavy legs too weak to matter'); process.exit(1); }
if (deficit > 0.30) { console.log('FAIL: full-stomach deficit ' + (100 * deficit).toFixed(1) + '% — far beyond the 15% the mechanic promises'); process.exit(1); }

// --- 2. digestion: unpinned, the stomach empties at CFG.digest * gut per second ---
{
  const race = makeRace();
  const you = race.you;
  you.absorb = 100;
  let prev = 100;
  for (let s = 1; s <= 8; s++) {
    for (let g = 0; g < 120; g++) {
      Sim.step(race, CFG.fixedDt, policy(you));
      while (race.events.length) race.events.shift();
    }
    if (you.absorb >= prev) { console.log('FAIL: stomach did not drain during second ' + s + ' (absorb ' + you.absorb.toFixed(1) + ')'); process.exit(1); }
    prev = you.absorb;
  }
  const drained = 100 - you.absorb, expect = CFG.digest * you.stats.gut * 8;
  console.log('digestion: absorb 100 -> ' + you.absorb.toFixed(1) + ' after 8s (drained ' + drained.toFixed(1)
    + ', expected ' + expect.toFixed(1) + ')');
  if (Math.abs(drained - expect) > 0.5) { console.log('FAIL: digestion rate is not CFG.digest * gut'); process.exit(1); }
}

console.log('PASS: a full stomach climbs heavy, and digestion empties it on schedule');
