// MECHANIC: descending. Promise: gravity coasts you down at ANY effort and grows with
// steepness; soft-pedalling progressively scrubs it (down to brakeMin), so easing IS the
// brake; a better descend stat is faster at the same inputs. Player side: holding the
// pads on a descent ramps to a stop, while easing on the flat stays a rest, not a stop.
const Sim = require('../sim.js');
const { CFG } = Sim;

function scenario(gradeVal) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed: 11, stageIndex: 3, playerType: 'rouleur', gc, leaders: {}, div: 4 });
  race.course.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
  const c = race.course;
  for (let i = 0; i < c.grades.length; i++) c.grades[i] = gradeVal;   // one constant grade, everywhere
  for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
  c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
  c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.items = []; c.feeds = []; c.litters = [];
  race.pacer.gone = true;    // the car's slipstream is pacecar.test.js's subject, not ours
  return race;
}

// Steady-state speed of an isolated AI rider with the decision layer pinned: same rider
// (same seed => same stats) every time, only grade / effort / descend stat vary.
function coastSpeed(gradeVal, effName, descendStat) {
  const race = scenario(gradeVal);
  const others = race.riders.filter(o => !o.you);
  const sub = others[0];
  sub.dist = race.you.dist + 300; sub.x = 0; sub.tx = 0;
  sub.plan = { k: 'raid', at: 0.99, kick: 400 };
  sub.stats.descend = descendStat;
  for (const o of others.slice(1)) o.dist = race.you.dist - 400;
  let sum = 0, n = 0;
  for (let g = 0; g < 120 * 20; g++) {
    sub.eff = effName; sub.think = 999;    // pin the decision layer: physics only
    Sim.step(race, CFG.fixedDt, { rate: 0, ease: true, launch: false, stumble: false, tx: race.you.x });
    while (race.events.length) race.events.shift();
    if (g >= 120 * 15) { sum += sub.speed; n++; }
  }
  if (sub.finished) { console.log('FAIL: scenario invalid, subject finished mid-window'); process.exit(1); }
  return sum / n;
}

// The player at identical inputs: 15s pedalling steadily (rate 2.0 = exactly tempo),
// then 6s holding the ease/brake.
function playerRun(gradeVal) {
  const race = scenario(gradeVal);
  for (const o of race.riders.filter(o => !o.you)) o.dist = race.you.dist - 400;
  let sum = 0, n = 0;
  for (let g = 0; g < 120 * 15; g++) {
    Sim.step(race, CFG.fixedDt, { rate: 2.0, ease: false, launch: false, stumble: false, tx: race.you.x });
    while (race.events.length) race.events.shift();
    if (g >= 120 * 12) { sum += race.you.speed; n++; }
  }
  const vCoast = sum / n;
  for (let g = 0; g < 120 * 6; g++) {
    Sim.step(race, CFG.fixedDt, { rate: 0, ease: true, launch: false, stumble: false, tx: race.you.x });
    while (race.events.length) race.events.shift();
  }
  if (race.you.down > 0 || race.you.out || race.you.finished) { console.log('FAIL: scenario invalid, player crashed or finished'); process.exit(1); }
  return { vCoast, vBraked: race.you.speed };
}

const vFlatT = coastSpeed(0, 'tempo', 1.00);
const vFlatE = coastSpeed(0, 'ease', 1.00);
const vShT = coastSpeed(-0.10, 'tempo', 1.00);
const vStT = coastSpeed(-0.25, 'tempo', 1.00);
const vStE = coastSpeed(-0.25, 'ease', 1.00);
const vStHi = coastSpeed(-0.25, 'tempo', 1.30);
const pFlat = playerRun(0);
const pDesc = playerRun(-0.25);

const gainT = vStT - vFlatT, gainE = vStE - vFlatE;
console.log('AI (descend 1.00): flat tempo ' + vFlatT.toFixed(2) + ', shallow ' + vShT.toFixed(2)
  + ', steep ' + vStT.toFixed(2) + '; flat ease ' + vFlatE.toFixed(2) + ', steep ease ' + vStE.toFixed(2)
  + '; steep tempo with descend 1.30: ' + vStHi.toFixed(2));
console.log('player: flat coast ' + pFlat.vCoast.toFixed(2) + ' -> steep coast ' + pDesc.vCoast.toFixed(2)
  + '; brake on the descent -> ' + pDesc.vBraked.toFixed(2) + ', ease on the flat -> ' + pFlat.vBraked.toFixed(2));

if (vShT <= vFlatT + 0.8) { console.log('FAIL: a shallow descent added no coast speed over the flat'); process.exit(1); }
if (vStT <= vShT + 0.8) { console.log('FAIL: gravity does not grow with steepness'); process.exit(1); }
if (vStE <= vFlatE + 0.15) { console.log('FAIL: no gravity left at zero effort (brakeMin floor gone)'); process.exit(1); }
if (gainE >= 0.55 * gainT) { console.log('FAIL: easing did not scrub the gravity (soft-pedal is not a brake)'); process.exit(1); }
if (vStHi <= vStT + 0.2) { console.log('FAIL: a better descend stat is not faster at the same inputs'); process.exit(1); }
if (pDesc.vCoast <= pFlat.vCoast + 1.0) { console.log('FAIL: the player gets no gravity on a descent'); process.exit(1); }
if (pDesc.vBraked >= 2.0) { console.log('FAIL: holding the brake on a descent does not bring the player to a stop'); process.exit(1); }
if (pFlat.vBraked <= 4.5) { console.log('FAIL: easing on the flat stopped the player (the brake ramp must be descent-only)'); process.exit(1); }
console.log('PASS: gravity is real at any effort, steeper is faster, easing scrubs it, and descend pays');
