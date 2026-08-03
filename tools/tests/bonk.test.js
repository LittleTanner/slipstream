// MECHANIC: bonking and cracking. Promise: running the food (fuel) dry caps raw power
// hard (r.bonk); cracking on empty legs (r.cracked) caps it harder still; and the crack
// only releases once the legs have genuinely recovered past the resilience threshold —
// there is no waiting it out at full gas.
const Sim = require('../sim.js');
const { CFG } = Sim;
const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
const race = Sim.createRace({ seed: 11, stageIndex: 3, playerType: 'rouleur', gc, leaders: {}, div: 4 });
race.course.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
const c = race.course;
for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0; c.baseElev = 0;
c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.items = []; c.feeds = []; c.litters = [];
race.pacer.gone = true;                     // no pace-car slipstream polluting speed
const you = race.you, others = race.riders.filter(o => !o.you);
for (const o of others) { o.plan = { k: 'raid', at: 0.99, kick: 400 }; o.dist = you.dist - 400; }

const FULL = { rate: 6, ease: false, launch: false, stumble: false, tx: 0 };
const EASE = { rate: 0, ease: true, launch: false, stumble: false, tx: 0 };
const seen = [];
// One frame: pin the resource layer as asked, step, drain events, park the field 400
// back, and slide the featureless world backwards so the player never reaches the line.
function frame(policy, pin) {
  if (pin) pin();
  Sim.step(race, CFG.fixedDt, policy);
  while (race.events.length) seen.push(race.events.shift().t);
  for (const o of others) { o.dist = you.dist - 400; o.prev = o.dist; o.speed = you.speed; }
  if (you.dist > 600) { you.dist -= 400; you.prev -= 400; }
}
// Run `seconds` and return the average speed over the final `tail` seconds.
function drive(seconds, policy, pin, tail) {
  const frames = Math.round(seconds * 120);
  let sum = 0, n = 0;
  for (let g = 0; g < frames; g++) {
    frame(policy, pin);
    if (g >= frames - Math.round((tail || 0) * 120)) { sum += you.speed; n++; }
  }
  return n ? sum / n : 0;
}
function fail(msg) { console.log('FAIL: ' + msg); process.exit(1); }

// ---- Phase 1: fueled control, full gas, everything topped up each frame
const pinFresh = () => { you.energy = 100; you.fuel = 100; you.fluid = 100; you.absorb = 0; };
const vFueled = drive(10, FULL, pinFresh, 3);

// ---- Phase 2: food dry. Bonk must latch (the sim's own fuel<=0 latch) and cap power.
// Energy stays pinned full so ONLY the bonk cap separates this from the control.
const pinDry = () => { you.energy = 100; you.fuel = 0; you.fluid = 100; you.absorb = 0; };
const vBonk = drive(10, FULL, pinDry, 3);
if (!seen.includes('BONKED')) fail('fuel ran dry but the BONKED event never fired');
if (!you.bonk) fail('fuel is 0 but r.bonk is not latched');
if (you.cracked) fail('bonk phase accidentally cracked the rider — measurement invalid');
console.log('full gas: fueled ' + vFueled.toFixed(2) + ' vs bonked ' + vBonk.toFixed(2));
if (vBonk >= vFueled * 0.85) fail('bonk did not cap power hard (bonked ' + vBonk.toFixed(2) + ' vs fueled ' + vFueled.toFixed(2) + ')');

// ---- Phase 3: eat again (bonk must clear), then ride the legs to empty for real.
const pinFed = () => { you.fuel = 100; you.fluid = 100; you.absorb = 0; };
drive(0.5, FULL, pinFed, 0);
if (you.bonk) fail('fuel is back at 100 but the bonk never cleared');
let g = 0;
for (; g < 120 * 60 && !you.cracked; g++) frame(FULL, pinFed);
if (!you.cracked) fail('full gas for 60s never emptied the legs — cracked never latched');
if (!seen.includes('CRACKED')) fail('rider cracked but the CRACKED event never fired');
console.log('cracked after ' + (g / 120).toFixed(1) + 's of full gas, energy ' + you.energy.toFixed(2));

// ---- Cracked cap: hold the legs empty so the latch stays shut, measure full-gas speed.
const pinEmpty = () => { you.fuel = 100; you.fluid = 100; you.absorb = 0; you.energy = Math.min(you.energy, 4); };
const vCracked = drive(8, FULL, pinEmpty, 3);
if (!you.cracked) fail('crack released while the legs were still empty');
console.log('cracked full-gas speed ' + vCracked.toFixed(2) + ' vs bonked ' + vBonk.toFixed(2));
if (vCracked >= vBonk * 0.92) fail('cracking does not cap harder than bonking (' + vCracked.toFixed(2) + ' vs ' + vBonk.toFixed(2) + ')');

// ---- Phase 4: ease off. The crack must hold until energy climbs past the resilience
// threshold, then release on its own — recovery, not time, is the way back.
const thresh = 28 / you.stats.resilience;
let clearedAt = -1;
for (let k = 0; k < 120 * 240; k++) {
  frame(EASE, pinFed);
  if (!you.cracked) { clearedAt = k / 120; break; }
  if (you.energy > thresh + 2) fail('energy is past the threshold but the crack never released');
}
if (clearedAt < 0) fail('four minutes of easing never released the crack');
if (you.energy < thresh - 1) fail('crack released at energy ' + you.energy.toFixed(1) + ', below the ' + thresh.toFixed(1) + ' threshold — recovery is not gating it');
if (clearedAt < 5) fail('crack released after only ' + clearedAt.toFixed(1) + 's — that is not a recovery');
console.log('crack released after ' + clearedAt.toFixed(1) + 's of easing, at energy ' + you.energy.toFixed(1) + ' (threshold ' + thresh.toFixed(1) + ')');

// ---- Phase 5: recover further, then full gas again — power must come back above the caps.
for (let k = 0; k < 120 * 120 && you.energy < 60; k++) frame(EASE, pinFed);
if (you.energy < 60) fail('easing never recovered the legs to 60');
let vBack = 0;
for (let k = 0; k < Math.round(120 * 3.5); k++) { frame(FULL, pinFed); vBack = Math.max(vBack, you.speed); }
if (you.cracked) fail('re-cracked during the comeback sprint — window too long');
console.log('recovered full-gas speed ' + vBack.toFixed(2));
if (vBack <= vBonk + 1.0) fail('recovery did not restore power above the bonk cap (' + vBack.toFixed(2) + ' vs ' + vBonk.toFixed(2) + ')');
console.log('PASS: bonk caps power, cracking caps it harder, and only recovery opens the cage');
