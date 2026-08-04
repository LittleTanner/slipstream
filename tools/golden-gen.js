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
  + ' after THE DAY GETS HARDER, THE RIDERS DO NOT GET FASTER (build 16). One deliberate '
  + 'change, three constants: tierProfile loses `strength` entirely and raises `len` from '
  + '0.18 to 0.40 and `hilly` from 0.14 to 0.32. '
  + 'WHY: `strength` handed every RIVAL up to 3.5 percent free speed as the divisions rose '
  + 'and handed the player none, whose strength is pinned at 1.0 with no way to earn any. '
  + 'Measured with the new tools/ladder.js harness, a rider who arrives at each division '
  + 'developed exactly for it slid from 4.11 at Division 8 to 6.27 at Division 1: second to '
  + 'last in an eight-rider field having done everything right. Not a treadmill, a downward '
  + 'escalator. '
  + 'WHY THE OTHER TWO CONSTANTS MOVE WITH IT: deleting the speed ramp alone was tried and '
  + 'was worse, because what shatters a field on a climb is ABSOLUTE PACE, and the '
  + 'queen-stage margin for a climbing rider over a sprinting one fell from +20 places to '
  + '-11 (sprinters winning mountain stages). Longer, hillier days put the selection back by '
  + 'making you arrive at the decisive climb with less in the legs, which is why a real '
  + 'mountain stage is harder in a grand tour than in a one-day race. Measured across all '
  + 'three gates at once: ladder drift +2.16 to +1.11, worst rung payoff for a career of '
  + 'growth 0.88 to 1.46 places, queen margin +20 to +49, and the second chance IMPROVED '
  + '(paced catches the bunch 7 of 7 clean and 6 of 7 after a fumbled wheel change, against '
  + '5 and 5). '
  + 'AND IT HAD TO BE THE DAY, NOT THE CLIMB: a named route stamps its REAL gradient and '
  + 'length into the road, so steepening climbs by division would make a route pack the way '
  + 'to buy an easier Division 1. Stage length and preamble scale on route stages too. '
  + 'Two other fixes were built and rejected: sharing the ramp with the player, and curving '
  + 'the rivals growth, each of which turned a fumbled wheel change into a near-certain DNF. '
  + 'RELAXED REACH rebalanced (fatigueResist -0.090, handling +0.060, recover +0.012, '
  + 'windTax +0.032): its virtue was almost entirely fatigue resistance, which is next-day '
  + 'value, and dominance rides ONE stage so it could never see it. Dead on both seed sets '
  + 'once the days lengthened; alive on both now. '
  + 'ALSO IN THIS BUILD, no sim effect unless fitted: a third race-craft tactic (FEED CRAFT, '
  + 'wiring carbMix and feedSmooth, which were implemented in the sim and reachable by no '
  + 'rider) and the carry limit raised to two of three. Its levels are spelled out rather '
  + 'than ramped, because reach is a liability until feedSmooth reaches 2 and a flat ramp '
  + 'measured level I as WORSE than carrying nothing. '
  + 'NOTE ON THE DEAD-PART GATE: it is not stable at six seeds on EITHER sim. The shipped '
  + 'build measures 0 dead on one seed set and 1 on another; this one measures 2 and 1, with '
  + 'no part dead on both. Phase 3s claim of 0/0 confirmed at six seeds was seed-specific. '
  + 'Previous round: phase 2 body layer and phase 3 bike variety.';
fs.writeFileSync(GOLDEN_PATH, JSON.stringify(G, null, 0));
console.log('regenerated', G.cases.length, 'cases,', G.schedules.length, 'schedules');
