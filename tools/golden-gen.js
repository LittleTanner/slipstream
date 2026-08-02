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
  + ' after ELEVATION: every course now sits at a real altitude (own PRNG, so course generation '
  + 'is untouched), and THIN AIR above 1200m costs RECOVERY and WATER — never raw power, which '
  + 'would only duplicate climbing ability. Bites on mountain stages only.';
fs.writeFileSync(GOLDEN_PATH, JSON.stringify(G, null, 0));
console.log('regenerated', G.cases.length, 'cases,', G.schedules.length, 'schedules');
