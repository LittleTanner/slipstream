// Golden master regenerator. Course generation and tour schedules run on integer PRNG
// and are unaffected by physics, so this KEEPS every case's course and every schedule
// exactly as they were, and re-runs only the physics-dependent parts (finishing order,
// times, points, money, end resources) under the same reference policy the verifier
// uses. Run this ONLY when a physics/tuning value changed on purpose — here, the
// climbing-model change that lets climbers break away on climbs. Says so in the note.
const S = require('./sim.js'); const { CFG } = S;
const fs = require('fs');
const GOLDEN_PATH = require('path').join(__dirname, 'golden.json');
const G = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
const r3 = v => Math.round(v * 1000) / 1000;
function policy(race) { const togo = race.course.len - race.you.dist; return { rate: togo < 200 ? 4.0 : 0, ease: false, launch: false, stumble: false, tx: race.you.x }; }

for (const c of G.cases) {
  const gc = {}; for (const n of ['YOU', ...S.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = S.createRace({ seed: c.seed, stageIndex: c.stageIndex, playerType: c.playerType, gc, leaders: {}, div: c.div });
  let g = 0; while (!race.you.finished && g++ < 120 * 900) S.step(race, CFG.fixedDt, policy(race));
  const order = S.settle(race);
  const cc = race.course;
  c.course = {
    len: cc.len,
    climbs: cc.climbs.map(x => [Math.round(x.s), Math.round(x.e)]),
    primes: cc.primes.map(p => [p.kind, Math.round(p.d)]),
    feeds: cc.feeds.map(f => [Math.round(f.s), Math.round(f.e)]),
    items: cc.items.map(i => [i.kind, Math.round(i.d), r3(i.x)]),
    winds: cc.winds.map(w => [Math.round(w.s), w.dir, r3(w.str)]),
    elevMin: r3(cc.eMin), elevMax: r3(cc.eMax)
  };
  c.result = order.map(x => ({ name: x.name, place: x.place, time: r3(x.time), sprintPts: x.sprintPts, komPts: x.komPts, money: x.money }));
  c.you = { fuel: r3(race.you.fuel), fluid: r3(race.you.fluid), energy: r3(race.you.energy), absorb: r3(race.you.absorb), load: r3(race.you.load) };
}
// Schedules are integer-PRNG only and were LEFT UNTOUCHED here for good reason: physics
// never moves them. Adding the time trial changed tourSchedule() itself, though, so the
// stored schedules for 7+ day tours are genuinely stale and must be regenerated once.
for (const sc of G.schedules) {
  sc.len = S.tourLength(sc.seed, sc.div);
  sc.stages = S.tourSchedule(sc.seed, sc.len);
}
G.note = 'Slipstream golden master. Regenerated ' + new Date().toISOString().slice(0, 10)
  + ' after TWO PROTOTYPES GRADUATED TO DEFAULTS (build 35). '
  + 'ONE: gearing in time trials is on. `CFG.gearsOn` true, still gated in createRace on the '
  + 'stage being a time trial, so a road day is byte-identical and only TT stages move. Four '
  + 'ratios 30 percent apart calibrated to the measured interquartile speed range 6-14 m/s, a '
  + 'target that reads a lagged speed, hysteresis on the recommendation, and a tolerance '
  + 'window that no longer narrows up the divisions (gearRamp 1.9, the Division 8 value). '
  + 'The golden drives the player through `input` and passes no shift, so a golden TT is now '
  + 'ridden in the starting gear the whole way and its times move accordingly. '
  + 'TWO: the rival drop-back is the distance budget. A relieved rider takes exactly the '
  + 'deficit that clears the gap it still has to drop in `swingSecs`, instead of a flat 9 '
  + 'percent of pace. This changes AI rotation in EVERY race, which is why the whole golden '
  + 'moves and not just the time trials. '
  + 'WHY IT ONLY WORKS NOW: behind the debug toggle the budget required `bf !== r`, so for the '
  + 'seconds before a team-mate came past it switched itself off and the old rule ran. That '
  + 'seam was the entire defect. Measured, front-handover to behind-the-last-wheel: fixed cut '
  + '3.17s median / 4.83s worst; budget half-applied 3.90s / 28.68s; budget applied throughout '
  + '3.08s / 5.38s, against the player own 3.30s / 8.90s. '
  + 'swingSecs 4.0 and swingFloor 0.74 were chosen for REALISM over score: 2.2s/0.66 measures '
  + '2.01s median and was rejected because a rival must not drop back quicker than you do. '
  + 'AND THE 39s TAIL THAT MOTIVATED THE REWRITE NEVER EXISTED: tools/aiswing.js started its '
  + 'clock whenever breakFront changed, including in breaks that were not rotating, where '
  + 'nothing is dropping back at all. Gating on race.rotating collapses it to 4.83s. That is '
  + 'the second bogus figure that harness produced. '
  + 'GATES: 38/38 mechanics, sanity clean across 45 cases, dominance 0 dominant and 1 dead '
  + '(was 4 dead, so the faster rotation widened parts viability), ladder on-path 3.63 to 5.30 '
  + 'with worst-rung gain 1.47 (was 1.17, so no column is flat).';
fs.writeFileSync(GOLDEN_PATH, JSON.stringify(G, null, 0));
console.log('regenerated', G.cases.length, 'cases,', G.schedules.length, 'schedules');
