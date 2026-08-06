// GEARING ON THE RACE OF TRUTH. Road gearing was built, measured, ridden and cut: the edge
// was inside the noise and Kevin's verdict was that it added difficulty without fun. A time
// trial is a different case and this harness is what has to show it.
//
// The model: the gear MOVES the rhythm target instead of adding a second cadence. A bigger
// gear turns slower at the same road speed, so it pulls the target down toward grinding; a
// smaller one pushes it up until you cannot tap fast enough. So there is no separate economy
// penalty and no spin-out cap — the wrong gear moves the target away from your taps, `hold`
// falls, and `hold` is already charged in both speed and legs.
//
// Four questions:
//   1. Does the IDEAL gear actually move through a time trial? If it is constant you shift
//      once at the start and it is a setup screen, not a mechanic.
//   2. Does riding the ideal gear beat sitting in one gear, against the clock?
//   3. Does it beat mashing the chevrons?
//   4. With the toggle off, is the sim bit-identical?
//
// HARNESS TRAPS, all of which read as "the feature does nothing":
//   - `course.grades` is a FLAT ARRAY OF NUMBERS indexed by distance/STEP, not {d,g} markers.
//   - The sim's grade is not a percent: displayed % = g * CFG.gradePct, gradePct 15.
//   - Do NOT pin a hare to hold a draft steady: `separate()` fights the player every frame
//     and distorts the speed. (In a TT that would also be a sheltering offence.)
//   - `createRace` pays a PRE-ROLL debt to the player's start slot on the first step. Leave
//     it alone in a TT: it is what puts the field on the road ahead of you.
//   - THIS HARNESS NEVER STEERS OR BRAKES. It passes `tx: you.x`, which DEV-LOOP already
//     flags as the way to make corners look unmakeable. The consequence shows up as DNFs at
//     Division 1: the FASTER policy arrives at a bend quicker and crashes out on it
//     ("TOO FAST INTO THE CORNER · RACE OVER" at the same metre where the slower policy
//     crashes, gets a team car and rides on). That is the harness, not the mechanic, and it
//     is why DNFs are counted separately instead of being folded into a mean. A real rider
//     brakes and takes a line.
//
//   node tools/gearing.js
const Sim = require('./sim.js');
const P = require('./parts.js');
const { CFG } = Sim;

const TT = 5;                                   // STAGES[5] is the race of truth
const SEEDS = [11, 23, 37, 52, 71, 89];
const SHIFT_SEEDS = [11, 23, 37, 52, 71, 89, 104, 118, 127, 143, 156, 168, 179, 191, 203, 214];
const DIVS = [8, 4, 1];

// ★ THE HAND HAS TO LAG, OR THE BAND IS UNMEASURABLE. The first version of this tapped at
// `cadTgt` EXACTLY, every frame, which means `hold` was pinned at 1.0 in every run — so the
// tolerance band could be set to any width at all and this harness would report no difference.
// It was measuring one thing only: whether the target had gone above the 5.0 tap ceiling. A
// real hand cannot jump 30% in a frame when you shift; it chases. HAND_LAG is the time
// constant of that chase, so a shift now costs a real dip in `hold` and widening the band is
// visible as the thing it actually is.
const HAND_LAG = 2.6;                           // per second; ~0.4s to close a gap
const TAP_MAX = 4.6;                            // what a thumb can actually sustain

// Ride a time trial to the line and return the elapsed time. Pedalling policy is identical in
// every run; only the shifting differs.
function ttRun(shiftPolicy, seed, div, opts) {
  const o = opts || {};
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed, stageIndex: TT, playerType: 'rouleur', gc, leaders: {},
    div, gears: !o.off });
  race.you.stats = P.buildStats(P.neutralBuild());
  if (o.startGear && race.gears) race.you.gear = o.startGear;
  const seen = new Set();
  let g = 0, shifts = 0, hand = CFG.ttCadence, holdSum = 0, holdN = 0;
  // ★ COUNT THE RESTARTS, OR THE SHIFT COUNT IS MOSTLY THEM. This harness never steers
  // (`tx: you.x`), so it crashes into bends, takes a team car and sets off again from a dead
  // stop. Traced on one Division 4 ride: five stops, and each one costs a full climb back up
  // the ladder from gear 1, which was 25 of the 27 shifts. A rider who brakes and takes a line
  // does not do that, so the raw count was measuring the harness, not the mechanic.
  let stops = 0, rolling = false;
  // ★ DECISIONS, NOT CLICKS, IS THE NUMBER THAT MATTERS. Dumping four gears at the foot of a
  // climb is ONE decision and three clicks, and the click count can never fall below the gear
  // span however clean the recommendation is. Traced at Division 1 the shifts arrive as pure
  // sequential sweeps with no reversals at all — 4-3-2-1 slowing onto a ramp, 1-2-3-4 coming
  // off it — so counting clicks was scoring the width of the ladder, not how often the game
  // interrupts you. A run of clicks in one direction is one decision.
  let decisions = 0, lastDir = 0;
  while (!race.you.finished && g++ < 120 * 900) {
    if (race.you.speed > 5) rolling = true;
    else if (rolling && race.you.speed < 1) { stops++; rolling = false; }
    const want = shiftPolicy ? shiftPolicy(race.you, g) : 0;
    if (want !== 0 && (race.you.shiftT || 0) <= 0) {
      shifts++;
      if (want !== lastDir) { decisions++; lastDir = want; }
    }
    if (race.gears && race.you.gearIdeal) seen.add(race.you.gearIdeal);
    // Chase the target the bar is showing, at the speed a hand can chase it. A TT is ridden
    // to the rhythm, so this is the honest "competent rider" policy.
    const tgt = race.you.cadTgt === null || race.you.cadTgt === undefined ? CFG.ttCadence : race.you.cadTgt;
    hand += (Math.min(TAP_MAX, Math.max(0, tgt)) - hand) * Math.min(1, CFG.fixedDt * HAND_LAG);
    Sim.step(race, CFG.fixedDt, { rate: hand, ease: false, launch: false, stumble: false,
      tx: race.you.x, shiftUp: want > 0, shiftDown: want < 0 });
    if (race.you.ttHold !== null && race.you.ttHold !== undefined) { holdSum += race.you.ttHold; holdN++; }
  }
  return { time: race.you.time, shifts, decisions, stops, idealSeen: seen,
    hold: holdN ? holdSum / holdN : 0 };
}

// Aim for the gear the sim says is ideal, one click at a time.
const chase = you => {
  const want = you.gearIdeal || you.gear;
  if (want > you.gear) return 1;
  if (want < you.gear) return -1;
  return 0;
};
const stuck = () => 0;
const churn = (you, g) => (g % 40 === 0 ? (g % 80 === 0 ? 1 : -1) : 0);

console.log('=== 1. DOES THE IDEAL GEAR MOVE THROUGH A TIME TRIAL? ===');
// ★ SHIFTS A RIDE IS A GATE, NOT A STATISTIC. A time trial runs 110-140s, so the six-gear
// build's 40 to 56 was one shift every two or three seconds: gearing had stopped being a
// decision and become a second pedalling task. Target is under 10, which is a shift when the
// road changes. Scored on CLEAN rides only, with the crash count printed beside it, because a
// restart from a dead stop costs four shifts that no rider who brakes would ever make.
let worstClean = 0;
for (const div of DIVS) {
  const all = new Set();
  // More seeds here than the timing section uses, because the crash-free subset is what is
  // being averaged and at Division 1 six seeds left it standing on a single ride.
  const rs = SHIFT_SEEDS.map(s => ttRun(chase, s, div));
  for (const r of rs) for (const x of r.idealSeen) all.add(x);
  const clean = rs.filter(r => r.stops === 0);
  const list = [...all].sort((a, b) => a - b);
  const av = (xs, k) => xs.length ? xs.reduce((a, r) => a + r[k], 0) / xs.length : NaN;
  const cd = av(clean, 'decisions');
  if (clean.length) worstClean = Math.max(worstClean, cd);
  console.log('  div ' + div + ': ideal gear visited ' + list.join(', ')
    + '  (' + list.length + ' of ' + CFG.gearRatios.length + ')');
  console.log('    crash-free rides: ' + av(clean, 'decisions').toFixed(1) + ' decisions, '
    + av(clean, 'shifts').toFixed(1) + ' clicks'
    + '   |  all rides: ' + av(rs, 'decisions').toFixed(1) + ' / ' + av(rs, 'shifts').toFixed(1)
    + '   |  ' + clean.length + '/' + rs.length + ' crash-free, '
    + av(rs, 'stops').toFixed(1) + ' stops a ride');
}

console.log('\n=== 2 & 3. TIME AGAINST THE CLOCK ===  (lower is better)');
// ★ MEDIAN, NEVER MEAN, AND DNFs COUNTED SEPARATELY. A rider pulled by the broom wagon
// carries a +9999 sentinel, which DEV-LOOP already flags as expected in the golden sweep.
// One of them inside a six-seed mean reported a Division 1 ride at 1796s against a real
// 117-173s, and it read exactly like the mechanic having a catastrophic bug. A median is
// immune to it and the DNF count says out loud what the median is hiding.
const med = xs => { const a = xs.slice().sort((x, y) => x - y);
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2; };
console.log('  ' + 'div'.padEnd(6) + 'chase ideal'.padStart(13) + 'stuck in g3'.padStart(13)
  + 'churn'.padStart(13) + '   chase gains (median)');
const gains = [];
for (const div of DIVS) {
  const runs = pol => SEEDS.map(s => ttRun(pol, s, div));
  const score = rs => ({ t: med(rs.filter(r => r.time < 5000).map(r => r.time)),
    dnf: rs.filter(r => r.time >= 5000).length });
  const c = score(runs(chase)), s = score(runs(stuck)), h = score(runs(churn));
  gains.push({ div, vsStuck: s.t - c.t, vsChurn: h.t - c.t, dnf: c.dnf + s.dnf + h.dnf });
  const tag = x => x.t.toFixed(1) + (x.dnf ? '*' + x.dnf : '');
  console.log('  ' + String(div).padEnd(6) + tag(c).padStart(13) + tag(s).padStart(13)
    + tag(h).padStart(13) + ('  ' + (s.t - c.t).toFixed(1) + 's vs stuck, ' + (h.t - c.t).toFixed(1) + 's vs churn'));
}
console.log('  * = rides that ended in the broom wagon, excluded from the median and counted here');

console.log('\n=== 4. CONTROL: the toggle off must be the sim we shipped ===');
const onOff = ttRun(stuck, 11, 4, { off: true }).time;
const onOff2 = ttRun(stuck, 11, 4, { off: true }).time;
console.log('  gears off, twice: ' + onOff.toFixed(4) + ' / ' + onOff2.toFixed(4) + ' (deterministic: ' + (onOff === onOff2) + ')');
console.log('  NOTE: `node tools/verify.js` is the real control here — CFG.gearsOn is false in');
console.log('  a shipped build, so the golden passes with NO regeneration. TT times only move');
console.log('  with the toggle on, and the golden never turns it on.');

const meanGain = gains.reduce((a, g) => a + g.vsStuck, 0) / gains.length;
const meanOverChurn = gains.reduce((a, g) => a + g.vsChurn, 0) / gains.length;
const pass = [
  ['1. the ideal gear moves (more than one gear is ever right)',
    ttRun(chase, 11, 4).idealSeen.size > 1],
  ['2. chasing the ideal gear beats sitting in one', meanGain > 0],
  ['3. and beats mashing the chevrons', meanOverChurn > 0],
  ['4. under 10 shift DECISIONS on a crash-free ride (worst division '
    + worstClean.toFixed(1) + ')', worstClean > 0 && worstClean < 10],
];
console.log('\n--- GATES ---');
for (const [n, ok] of pass) console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + n);
console.log('  mean gain: ' + meanGain.toFixed(1) + 's vs one gear, ' + meanOverChurn.toFixed(1) + 's vs churning');
// A TIME is a far less noisy score than a finishing PLACE, which is why this reads cleanly
// where the road harness did not: no bunch, no rivals interacting, and the clock is
// continuous rather than a rank. Still confirm a verdict on a second seed set before acting.
if (!pass.every(p => p[1])) process.exit(1);
