// What does the power meter actually SAY? The readout is "how long can I hold this",
// derived from `dE`, the per-second energy rate the sim records as it applies it. The
// feature is only worth a tactic slot if that number MOVES: if the same effort reads the
// same everywhere, the meter is decoration and the honest thing is to say so.
//
// So this measures seconds-to-empty for one effort across the situations a stage actually
// puts you in: in the bunch or clear of it, flat or on a ramp, on a good climbing body or
// a poor one. Nothing here is a balance gate. It is a readability check on a NUMBER SHOWN
// TO THE PLAYER, which is the class of thing this project has shipped wrong before by
// computing it in one place and displaying it from another.
//
//   node tools/outlook.js
const Sim = require('./sim.js');
const P = require('./parts.js');
const { CFG } = Sim;

// DISPLAYED PERCENT, converted on the way in. The sim's internal grade is not a percent:
// `displayed % = g * CFG.gradePct` with gradePct 15, so a literal 0.09 is a 1.35% drag,
// not a wall. Stamping raw fractions here made the whole gradient axis read flat and made
// the feature look worthless when it was the harness that was wrong.
const GRADES = [0, 4, 9];                    // flat, a drag, a real ramp
const BODIES = [
  { name: 'climber', d: { climbCost: -0.22 } },
  { name: 'plain', d: {} },
  { name: 'rouleur', d: { climbCost: +0.18 } },
];
const HOLD_AT = 70;                          // read the rate at one fixed energy level

// One rider, one effort, one situation, stepped until the picture settles. The rate is
// transient for the first moment (burnHot ramps, the draft settles), so read it after a
// few seconds of holding rather than on frame one.
//
// ENERGY IS PINNED at HOLD_AT every frame. Without it a cell that drains faster also ends
// on a lower bar, so seconds-to-empty would fold the drain in twice and every situation
// would look more alike than it is. Pinned, `ttl` is a clean function of the situation.
function hold(gradePct, clear, bodyD, rate) {
  const grade = gradePct / CFG.gradePct;
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed: 11, stageIndex: 0, playerType: 'rouleur', gc, leaders: {}, div: 4 });
  const you = race.you;
  you.stats = P.buildStats(P.neutralBuild());
  for (const k in bodyD) you.stats[k] = (you.stats[k] === undefined ? 0 : you.stats[k]) + bodyD[k];
  // FLATTEN THE WEATHER AND STRAIGHTEN THE ROAD, then stamp the one grade under test.
  // Live wind plus a rolling bend makes this a reading of the parcours instead of the
  // effort, which is the trap tt.test.js already documents.
  race.course.winds = [{ d: -1e6, dir: 0, str: 0, lon: 0 }, { d: 1e9, dir: 0, str: 0, lon: 0 }];
  race.course.bend = { a: 0, f: 1, p: 0 }; race.course.swAmp = 0;
  // `grades` is a FLAT ARRAY OF NUMBERS indexed by distance/STEP, not a list of {d,g}
  // markers. Writing markers into it makes gradeAt lerp two objects, which is NaN, which
  // silently reads as "all day" in every cell.
  race.course.grades = race.course.grades.map(() => grade);
  race.course.elev = race.course.elev.map((_, i) => i * grade * 10);
  race.preRoll = 0;
  race.neutral = false;
  // Shelter is not settable: `q` is recomputed every substep from who is actually around
  // you. Pinning a hare on the player's wheel-line is the only reliable way to hold a
  // draft steady, and it is the trick tt.test.js already uses. Riding "in the bunch" does
  // NOT work here — a player driving at 2.4+ rides straight off the front inside a
  // second, so the first version of this measured an exposed rider in every single cell
  // and reported the shelter axis as dead.
  const hare = race.riders.filter(o => !o.you)[0];
  for (let g = 0; g < 120 * 6; g++) {
    you.energy = HOLD_AT;
    if (!clear) {
      hare.dist = you.dist + 1.4; hare.prev = hare.dist; hare.x = you.x; hare.speed = you.speed;
    }
    Sim.step(race, CFG.fixedDt, { rate, ease: false, launch: false, stumble: false, tx: you.x });
  }
  const dE = you.dE || 0;
  return { dE, q: you.q, ttl: dE < -0.05 ? HOLD_AT / -dE : Infinity };
}

const fmt = t => (t === Infinity ? 'all day' : t >= 60 ? (t / 60).toFixed(1) + ' min' : Math.round(t) + 's');

for (const rate of [1.4, 2.0, 2.4, 3.0, 3.4, 4.0]) {
  console.log('\n=== holding ' + rate.toFixed(1) + ' strokes/s at ' + HOLD_AT + ' legs ===  (what the meter reads)');
  console.log('  ' + 'body'.padEnd(9) + ['flat/wheel', 'flat/wind', '4%/wheel', '4%/wind', '9%/wheel', '9%/wind'].map(s => s.padStart(11)).join(''));
  for (const b of BODIES) {
    const row = [];
    for (const g of GRADES) for (const cl of [false, true]) row.push(hold(g, cl, b.d, rate));
    console.log('  ' + b.name.padEnd(9) + row.map(r => fmt(r.ttl).padStart(11)).join(''));
    if (process.env.OUT_Q) console.log('    q: ' + row.map(r => r.q.toFixed(2).padStart(11)).join(''));
  }
}
console.log('\nThe meter earns a slot only if these differ by MUCH more than a glance at the');
console.log('road would tell you. If every cell reads the same, say so and cut the feature.');
