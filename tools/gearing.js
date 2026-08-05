// Does GEARING do anything? Prototype behind CFG.gearsOn, so this harness is the only thing
// standing between "it compiles" and "it is worth Kevin's time".
//
// Four gates, in the order that can kill the idea:
//   1. Is the right gear SPEED-dependent? If one gear is best everywhere there is no
//      decision, only a button that has to be pressed sometimes.
//   2. Does the wrong gear cost something you can feel, without costing speed directly?
//   3. Does shifting UNDER LOAD cost more than shifting while easing? That asymmetry is the
//      whole reason to shift before the ramp, which is the skill being asked for.
//   4. With gears off the sim must be untouched, and gear 4 at the calibration pace must be
//      the neutral case, or nothing here is comparable to anything.
//
// THREE HARNESS TRAPS, all of which read as "the feature does nothing":
//   - `course.grades` is a FLAT ARRAY OF NUMBERS indexed by distance/STEP. Writing {d,g}
//     markers into it lerps two objects into NaN.
//   - The sim's grade is not a percent: displayed % = g * CFG.gradePct, gradePct 15. A
//     literal 0.09 is a 1.35% drag, not a wall.
//   - DO NOT pin a hare on the wheel-line to hold a draft steady. `separate()` runs its
//     anti-ride-through term every frame against a rider inside HIT_LON, which caps and
//     distorts the player's speed: the first version of this measured a rider going FASTER
//     uphill than on the flat. Park the rivals and ride alone instead.
//
//   node tools/gearing.js
const Sim = require('./sim.js');
const P = require('./parts.js');
const { CFG } = Sim;

const HOLD_AT = 70;

function fresh(gears) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed: 11, stageIndex: 0, playerType: 'rouleur', gc, leaders: {}, div: 4, gears });
  race.you.stats = P.buildStats(P.neutralBuild());
  const c = race.course;
  c.winds = [{ d: -1e6, dir: 0, str: 0, lon: 0 }, { d: 1e9, dir: 0, str: 0, lon: 0 }];
  c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
  c.grades = c.grades.map(() => 0); c.elev = c.elev.map(() => 0); c.eMin = 0; c.eMax = 40;
  race.preRoll = 0; race.neutral = false;
  return race;
}
function park(race) { for (const o of race.riders) if (!o.you) { o.dist = -900; o.prev = o.dist; } }

// Hold one effort in one gear until the picture settles, then read it.
function hold(gear, rate, gears) {
  const race = fresh(gears === undefined ? true : gears);
  const you = race.you;
  if (race.gears) you.gear = gear;
  for (let g = 0; g < 120 * 10; g++) {
    you.energy = HOLD_AT; park(race);
    Sim.step(race, CFG.fixedDt, { rate, ease: false, launch: false, stumble: false, tx: you.x });
  }
  const dE = you.dE || 0;
  return { dE, speed: you.speed, cad: you.cad || 0, off: you.cadOff || 0,
    ttl: dE < -0.05 ? HOLD_AT / -dE : Infinity };
}

const fmt = t => (t === Infinity ? 'all day' : Math.round(t) + 's');
// Efforts chosen to land across the speed band a real stage produces (p1..p99 is about
// 5 to 16 m/s, measured by driving full stages with the sim's own AI).
const RATES = [1.2, 2.0, 2.6, 3.4, 4.2];

console.log('=== 1. WHICH GEAR IS BEST AT WHICH SPEED? ===  seconds the legs last');
console.log('  ' + 'speed'.padEnd(8) + CFG.gearRatios.map((_, i) => ('g' + (i + 1)).padStart(9)).join('') + '     best');
const bestBy = [];
for (const rate of RATES) {
  const row = CFG.gearRatios.map((_, i) => hold(i + 1, rate));
  let bi = 0; for (let i = 1; i < row.length; i++) if (row[i].ttl > row[bi].ttl) bi = i;
  bestBy.push(bi + 1);
  console.log('  ' + (row[0].speed.toFixed(1) + ' m/s').padEnd(8)
    + row.map(r => fmt(r.ttl).padStart(9)).join('') + ('  g' + (bi + 1)).padStart(9));
}
const distinct = new Set(bestBy).size;
console.log('  best gear as the speed rises: ' + bestBy.join(', ') + '  -> ' + distinct + ' distinct');

console.log('\n=== 2. CADENCE, so those numbers have a reason ===');
console.log('  ' + 'speed'.padEnd(8) + CFG.gearRatios.map((_, i) => ('g' + (i + 1)).padStart(9)).join(''));
for (const rate of RATES) {
  const row = CFG.gearRatios.map((_, i) => hold(i + 1, rate));
  console.log('  ' + (row[0].speed.toFixed(1) + ' m/s').padEnd(8)
    + row.map(r => (r.cad.toFixed(1) + (r.off > 0.01 ? '*' : ' ')).padStart(9)).join(''));
}
console.log('  target ' + CFG.cadTarget + ' +/- ' + CFG.cadBand + ', spun out past ' + CFG.cadMax
  + '.  * = outside the band, so it is costing you legs');

console.log('\n=== 3. THE SHIFT COST, loaded against eased ===');
// MEASURE THE MECHANISM, not a distance difference. The first attempt compared "ease for a
// tenth of a second then shift" against "never shift", which folds the cost of easing into
// the answer and reported the shift as free.
function shiftTrace(rate) {
  const race = fresh(true);
  const you = race.you; you.gear = 4;
  let before = 0, dip = Infinity, load = 0;
  for (let g = 0; g < 120 * 8; g++) {
    park(race);
    if (g === 120 * 4 - 1) before = you.effV;
    const sh = g === 120 * 4;
    Sim.step(race, CFG.fixedDt, { rate, ease: false, launch: false, stumble: false, tx: you.x, shiftUp: sh, shiftDown: false });
    if (g === 120 * 4) load = you.shiftLoad || 0;
    if (g >= 120 * 4 && g <= 120 * 4 + Math.ceil(120 * CFG.shiftTime)) dip = Math.min(dip, you.effV);
  }
  return { before, dip, load, drop: (before - dip) / before, gear: you.gear };
}
const loaded = shiftTrace(3.6), eased = shiftTrace(0.6);
console.log('  shifting at full effort : load ' + loaded.load.toFixed(2)
  + ', effort ' + loaded.before.toFixed(3) + ' -> ' + loaded.dip.toFixed(3)
  + '  (' + (loaded.drop * 100).toFixed(1) + '% for up to ' + CFG.shiftTime + 's)');
console.log('  shifting soft-pedalling : load ' + eased.load.toFixed(2)
  + ', effort ' + eased.before.toFixed(3) + ' -> ' + eased.dip.toFixed(3)
  + '  (' + (eased.drop * 100).toFixed(1) + '%)');

console.log('\n=== 4. CONTROL ===');
const onMid = hold(CFG.gearStart, 2.6, true), offMid = hold(CFG.gearStart, 2.6, false);
console.log('  gear ' + CFG.gearStart + ' at the calibration pace, gears ON : dE ' + onMid.dE.toFixed(5)
  + ', speed ' + onMid.speed.toFixed(4) + ', cadence ' + onMid.cad.toFixed(2));
console.log('  same, gears OFF                          : dE ' + offMid.dE.toFixed(5)
  + ', speed ' + offMid.speed.toFixed(4));
const neutral = onMid.dE === offMid.dE && onMid.speed === offMid.speed;
console.log('  bit-identical: ' + neutral);

// ★ 5 IS THE GATE THAT ACTUALLY MATTERS, and sections 1-2 above cannot stand in for it.
// Two reasons they cannot, both worth knowing before trusting them:
//   - Scoring by "seconds the legs last" rewards being SPUN OUT. Past cadMax the power is
//     capped, so you are not working as hard and your legs last longer. g1 therefore "wins"
//     at high effort by refusing to let you try, which is the opposite of good.
//   - A lone rider on the flat in still air is drag-limited, so the whole table spans
//     10.8-12.5 m/s. A real stage spans about 5-16. The situations gearing exists for are
//     not reachable from a steady-state hold at all.
// So: race full stages, identical pedalling, and vary ONLY the shifting. If holding the band
// does not beat sitting in one gear, the mechanic is admin and should not ship.
console.log('\n=== 5. DOES SHIFTING WELL WIN A RACE? ===  finishing place over full stages');
const SEEDS = [11, 23, 37, 52];
const STAGES = [0, 2, 4];
// Same legs in every run: a fixed effort, wound up over the closing kilometre, so the only
// difference between policies is which gear the rider is in.
const pedal = (race) => {
  const togo = race.course.len - race.you.dist;
  return togo < 200 ? 4.2 : 2.6;
};
const POLICIES = {
  stuck: () => 0,
  // Shift toward the band. One click at a time; the sim refuses a second while the chain is
  // still moving, so this cannot outrun the shift timer.
  band: (you) => {
    const cad = you.cad || 0;
    if (cad > CFG.cadTarget + CFG.cadBand) return 1;
    if (cad < CFG.cadTarget - CFG.cadBand) return -1;
    return 0;
  },
  // A rider who shifts constantly and thoughtlessly. If this beats `band`, the mechanic is
  // rewarding button-mashing rather than judgement.
  churn: (you, g) => (g % 40 === 0 ? (g % 80 === 0 ? 1 : -1) : 0),
};
function raceOut(policyName, seed, stageIndex) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed, stageIndex, playerType: 'rouleur', gc, leaders: {}, div: 4, gears: true });
  race.you.stats = P.buildStats(P.neutralBuild());
  const pol = POLICIES[policyName];
  let g = 0;
  while (!race.you.finished && g++ < 120 * 900) {
    const want = pol(race.you, g);
    Sim.step(race, CFG.fixedDt, { rate: pedal(race), ease: false, launch: false, stumble: false,
      tx: race.you.x, shiftUp: want > 0, shiftDown: want < 0 });
  }
  const order = Sim.settle(race), you = order.find(o => o.name === 'YOU');
  return you.place + (you.time - order[0].time) / 100;
}
const names = Object.keys(POLICIES);
const scores = {};
console.log('  ' + 'policy'.padEnd(8) + STAGES.map(s => Sim.STAGES[s].sub.padStart(16)).join('') + '      mean');
for (const n of names) {
  const cols = STAGES.map(si => SEEDS.reduce((a, sd) => a + raceOut(n, sd, si), 0) / SEEDS.length);
  scores[n] = cols.reduce((a, b) => a + b, 0) / cols.length;
  console.log('  ' + n.padEnd(8) + cols.map(v => v.toFixed(2).padStart(16)).join('')
    + scores[n].toFixed(2).padStart(10));
}
const edge = scores.stuck - scores.band;
const overChurn = scores.churn - scores.band;
console.log('  holding the band beats one gear by ' + edge.toFixed(2) + ' places');
console.log('  holding the band beats churning by ' + overChurn.toFixed(2) + ' places');

// ★ DO NOT TUNE AGAINST THESE FOUR SEEDS. A 12-race sweep of (gearCost, shiftBite) named a
// cell worth +1.02 places and it measured -0.03 on eight fresh seeds over four stages. The
// effect this mechanic is fighting for is smaller than the noise at this sample size, so any
// number picked here has to be re-measured on seeds it was not chosen on before it is
// believed. 5a's threshold is therefore deliberately low: it asks whether using the gears is
// not actively WORSE than ignoring them, which is the bar the first tuning failed.
// GATES vs READINGS, and the difference is not cosmetic.
//
// 1, 3 and 4 are MECHANISM gates: deterministic, one right answer, and a regression in any of
// them is a bug. Those are pass/fail and they exit nonzero.
//
// 5 is a BALANCE READING and it is reported, never asserted, because it churns. Measured
// three ways on this prototype: a 12-race sweep named a cell worth +1.02 places; the same
// cell measured -0.03 on eight fresh seeds; and the cell that shipped reads +0.17 over
// "never shift" on one seed set and -0.06 over "mash the chevrons" on another. The effect
// gearing is fighting for is smaller than the noise at any sample size worth running here,
// so a threshold on it would only ever encode which seeds it was tuned against. Feed craft,
// for scale, measures about half a place and was already considered marginal.
//
// HARNESS LIMIT, stated rather than used as an excuse: the shifting policy is a REACTIVE
// SERVO that shifts whenever it is outside the band, ~250 times a stage. A person shifts a
// handful of times and ANTICIPATES the ramp, which is the actual skill and the one thing this
// harness structurally cannot do. So it may understate a human's edge. It cannot be relied on
// to overstate it either — that is what makes this a question for the hand, not the harness.
const pass = [
  ['1. more than one gear is the right answer (weak: see the note above)', distinct > 1],
  ['3. a loaded shift costs more than an eased one', loaded.drop > 0.05 && eased.drop < 0.01],
  ['4. gear ' + CFG.gearStart + ' is the neutral case', neutral],
];
console.log('\n--- MECHANISM GATES (pass/fail) ---');
for (const [name, ok] of pass) console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + name);
console.log('--- BALANCE READINGS (reported, not asserted: they churn between seed sets) ---');
console.log('  ..   using the gears vs ignoring them : ' + edge.toFixed(2) + ' places');
console.log('  ..   using them vs mashing them       : ' + overChurn.toFixed(2) + ' places');
if (!pass.every(p => p[1])) process.exit(1);
