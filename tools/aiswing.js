// AI DROP-BACK: how long a rival takes from handing over the front to sitting behind the
// last wheel of the group.
//
// ★ MEASURE THE THING, NOT THE FLAG. The first version of this timed contiguous runs of
// `r.swingOff`, which reads ~12s and is WRONG: the flag is re-armed by three separate paths
// (turn expiry, being relieved, and the stay-out-until-you-are-behind rule), so a single
// run chains several swings together. That bad number was reported as a defect and written
// into two docs before this harness was fixed.
//
// ★ AND THE "39s TAIL" WAS THIS HARNESS TOO. See the rotation gate below. Two separate bogus
// figures came out of this one file, both were written into docs as defects, and one nearly
// bought a rewrite the game did not need. Read the gate before trusting any number here.
//
//   node tools/aiswing.js              # the repo's current sim
//   SIM=/path/to/other-sim.js node ... # a patched copy, for before/after
//
// Pure AI break, player parked far behind, nothing clamped. Deliberately NOT the drill: the
// drill's hold() pins a swinging rival to 90% of your speed, which hides swing changes.
const Sim = require(process.env.SIM || './sim.js');
const { CFG } = Sim;
function run(seed) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time:0, sprintPts:0, komPts:0 };
  const race = Sim.createRace({ seed, stageIndex: 0, playerType:'rouleur', gc, leaders:{}, div: 4 });
  const c = race.course;
  for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
  for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
  c.eMin = 0; c.eMax = 40; c.bend = { a:0, f:1, p:0 }; c.swAmp = 0;
  c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.items = []; c.feeds = []; c.litters = [];
  c.winds = [{ d:-1e6, dir:0, str:0, lon:0 }, { d:1e9, dir:0, str:0, lon:0 }];
  const others = race.riders.filter(o => !o.you);
  const brk = others.slice(0, 3);
  brk.forEach((o, i) => { o.dist = 400 + i * 2.4; o.x = ((i % 2) ? 0.5 : -0.5); o.speed = CFG.base;
    o.plan = { k:'raid', at:0.99, kick:400 }; });
  for (const o of others.slice(3)) { o.dist = 100; o.plan = { k:'raid', at:0.99, kick:400 }; }
  race.you.dist = 90;
  const dropping = new Map(); const times = [];
  let prevFront = null;
  for (let g = 0; g < 120 * 240; g++) {
    Sim.step(race, CFG.fixedDt, { rate: 2.4, ease:false, launch:false, stumble:false, tx: race.you.x });
    race.events.length = 0;
    const t = g / 120;
    const front = race.breakFront;
    // ★★ ONLY WHILE THE GROUP IS ROTATING, AND THIS GATE IS THE WHOLE MEASUREMENT. Without it
    // this harness reported a worst case of 39.07s, which was written down as a defect and
    // nearly bought a rewrite. Instrumented, those long runs had `race.rotating` FALSE and
    // `swingOff` 0 for their entire length: the rider was never relieved and was never
    // dropping back. In a break that is not rotating, `breakFront` is just "whoever is
    // furthest up the road" and it changes for reasons that have nothing to do with a
    // handover, so the trigger was firing on a non-event and the clock ran until something
    // coincidentally put the rider behind the rear.
    //
    // That makes it the SECOND time a reported drop-back figure was this harness rather than
    // the game: the first was timing contiguous runs of `swingOff` and reading 11.91s. A
    // drop-back is a rotation event, so a window that outlives the rotation is not a slow
    // drop-back, it is not a drop-back.
    if (prevFront && front !== prevFront && brk.indexOf(prevFront) >= 0
        && !dropping.has(prevFront) && race.rotating)
      dropping.set(prevFront, t);
    prevFront = front;
    for (const [r, t0] of [...dropping]) {
      let rear = Infinity;
      for (const o of brk) if (o !== r && o.dist < rear) rear = o.dist;
      if (r.dist < rear) { times.push(+(t - t0).toFixed(2)); dropping.delete(r); }
      else if (!race.rotating) dropping.delete(r);       // the rotation ended: not a drop-back
      else if (t - t0 > 40) dropping.delete(r);          // never got there
    }
    if (race.you.finished) break;
  }
  return times;
}
// ONE RULE NOW. The distance budget graduated from a debug toggle to the default in build 35,
// so there is no second path to compare against and `CFG.swingBudget` is gone. The history is
// kept here because the numbers are the argument for the current shape:
//
//   fixed pace cut (build 34 and earlier)   median 3.17s   worst  4.83s
//   budget, gated on `bf !== r`             median 3.90s   worst 28.68s
//   budget applied throughout (shipped)     median 3.08s   worst  5.38s
//
// The middle row is the lesson: the budget lost badly while it only applied once somebody else
// was on the front, because for the seconds before that it silently fell back to the old rule.
// A rule that stops applying halfway through is two rules, and the seam is where the tail was.
const all = []; for (const s of [7, 23, 41]) all.push(...run(s));
all.sort((a, b) => a - b);
const med = all.length ? (all.length % 2 ? all[(all.length - 1) / 2]
  : (all[all.length / 2 - 1] + all[all.length / 2]) / 2) : NaN;
console.log('  drop-backs: ' + all.length + '   median ' + (all.length ? med.toFixed(2) : 'n/a')
  + 's   range ' + (all.length ? all[0] + '-' + all[all.length - 1] : 'n/a') + 's');
console.log('  The player\'s own drop-back is `easeCut`, measured at 3.30s median / 8.90s worst,');
console.log('  and is untouched by this rule. That is the bar a rival should be judged against.');
console.log('  Target band is 4-6s in the design and ~3.3s in the hand; faster is NOT better.');
