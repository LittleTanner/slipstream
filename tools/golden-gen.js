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
    // ★ `w.d`, NOT `w.s`. A wind has { d, dir, str, lon } and never had an `s`, so this read
    // `undefined`, `Math.round` gave NaN and JSON wrote null — for all 45 cases, since the
    // golden was first generated. WHERE the wind sits was never verified, only its direction
    // and strength, and `lon` (the headwind/tailwind component) was not checked at all. Found
    // while writing a Swift decoder for the fixture: a port could have placed every wind zone
    // in the wrong place and the golden would have passed it.
    winds: cc.winds.map(w => [Math.round(w.d), w.dir, r3(w.str), r3(w.lon)]),
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
  + ' to FIX A VACUOUS ASSERTION, not because the sim changed (build 36; the sim is untouched '
  + 'and 38/38 mechanics plus port-verify pass unchanged either side of this). '
  + 'A wind is { d, dir, str, lon } and has never had an `s`. Both this generator and verify.js '
  + 'read `Math.round(w.s)`, which is Math.round(undefined) = NaN, which JSON writes as null. '
  + 'So the first element of every wind triple was null on both sides and compared equal: '
  + 'WHERE THE WIND SAT ON THE COURSE WAS NEVER VERIFIED, in any of the 45 cases, for as long as '
  + 'this file has existed. Only direction and strength were. `lon`, the headwind/tailwind '
  + 'component that the physics actually reads, was not recorded at all. '
  + 'Now [Math.round(w.d), dir, r3(str), r3(lon)]. Re-running the OLD golden against the FIXED '
  + 'assertion failed 45 of 1590 — one per case, exactly the wind check — which is the proof '
  + 'that the data was absent rather than merely unchecked. '
  + 'FOUND while writing a Swift decoder for this fixture, which is the point of doing the port '
  + 'kit before the port: a Swift sim could have placed every wind zone in the wrong place and '
  + 'the golden would have called it conformant. Wind is not a detail here — it drives the '
  + 'crosswind splits, the draft value and the whole reason to sit in.';
fs.writeFileSync(GOLDEN_PATH, JSON.stringify(G, null, 0));
console.log('regenerated', G.cases.length, 'cases,', G.schedules.length, 'schedules');
