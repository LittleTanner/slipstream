// CONTRACT: the tour glue between stages. The view (index.html) carries a tour object
// between createRace calls, and this test freezes that contract headlessly:
//   newTour:     tour = { seed, stage: 0, gc: {}, leaders: {}, fatigue: {}, schedule:
//                Sim.tourSchedule(seed, len) }, gc seeded to { time: 0, sprintPts: 0,
//                komPts: 0 } for YOU + FIELD.
//   startStage:  Sim.createRace({ seed: tour.seed + tour.stage * 1013,
//                stageIndex: tour.schedule[tour.stage], gc: tour.gc,
//                leaders: tour.leaders, div, out: tour.out || [], fatigue: tour.fatigue }).
//   finishStage: order = Sim.settle(race); then for every rider
//                tour.gc[name] = { time: r.gcTime, sprintPts, komPts } and
//                tour.fatigue[name] = min(100, (r.fatigue||0)*0.50 + r.load*0.9);
//                leaders = { gc: lowest gcTime (tie: stage place), points/kom: byKey
//                argmax, null while the count is 0 }.
// Promises asserted here:
//  - createRace SEEDS each rider's gcTime/sprintPts/komPts from opts.gc, applies
//    opts.fatigue (fatigue -> legCap = 100 - f*0.28 -> energy), and passes opts.leaders
//    through untouched — feeding the accumulated tour back in distorts nothing.
//  - settle adds EXACTLY time - bonus + timePenalties to gcTime, so every rider's final
//    gc time is the bit-exact sum of their stage contributions.
//  - sprint/kom points only ever grow, by integer stage gains, and the jersey leaders
//    are the argmax/argmin the view would show.
//  - buildStage's spec REBUILD drops no field of the STAGES template (spec.tt and
//    spec.route have both been silently dropped this way before), and a TT stage fed
//    a real GC starts riders in reverse GC order at clean ttGap intervals.
//  - nothing NaNs, everyone finishes with a positive time, the final classification
//    orders correctly.
// The player is AI-driven (you.you = false plus a plan, per DEV-LOOP), so the whole
// run is deterministic from the seed. 3-stage mini tour + a race-of-truth day 4, the
// same glue the view applies to a long tour's TT stage.
const Sim = require('../sim.js');
const { CFG, STAGES, clamp } = Sim;

let failed = false;
function fail(msg) { console.log('FAIL: ' + msg); failed = true; }
function bail() { if (failed) process.exit(1); }
const fin = v => typeof v === 'number' && Number.isFinite(v);

const SEED = 12345, DIV = 8;
const schedule = Sim.tourSchedule(SEED, 3).concat([5]);   // 3-stage tour + the race of truth
const tour = { seed: SEED, stage: 0, gc: {}, leaders: {}, fatigue: {}, schedule };
const names = [Sim.YOU.name].concat(Sim.FIELD.map(f => f.name));
for (const n of names) tour.gc[n] = { time: 0, sprintPts: 0, komPts: 0 };

// independent accumulators: the sum of each rider's stage contributions, kept in the
// same order the sim adds them so the final equality can be exact, not epsilon
const sumTime = {}, sumSprint = {}, sumKom = {};
for (const n of names) { sumTime[n] = 0; sumSprint[n] = 0; sumKom[n] = 0; }

for (let s = 0; s < schedule.length; s++) {
  tour.stage = s;
  const si = schedule[s];
  const tag = 'stage ' + (s + 1) + ' (template ' + si + ')';
  // what the tour carried IN to this stage
  const prevGC = {}, prevFat = {};
  for (const n of names) {
    prevGC[n] = Object.assign({}, tour.gc[n]);
    prevFat[n] = tour.fatigue[n];
  }
  const prevLeaders = Object.assign({}, tour.leaders);

  const race = Sim.createRace({ seed: tour.seed + tour.stage * 1013, stageIndex: si,
    playerType: 'rouleur', gc: tour.gc, leaders: tour.leaders, div: DIV,
    out: tour.out || [], route: null, fatigue: tour.fatigue });

  // ---- feeding the accumulated tour into createRace must not distort anything ----
  if (race.riders.length !== names.length) fail(tag + ': field is ' + race.riders.length + ' riders, expected ' + names.length);
  const got = new Set(race.riders.map(r => r.name));
  for (const n of names) if (!got.has(n)) fail(tag + ': ' + n + ' missing from the field');
  if (!race.riders.includes(race.you)) fail(tag + ': race.you is not in the field');
  for (const r of race.riders) {
    const g = prevGC[r.name];
    if (r.gcTime !== g.time) fail(tag + ': ' + r.name + ' gcTime seeded ' + r.gcTime + ', tour carried ' + g.time);
    if (r.sprintPts !== g.sprintPts) fail(tag + ': ' + r.name + ' sprintPts seeded ' + r.sprintPts + ', tour carried ' + g.sprintPts);
    if (r.komPts !== g.komPts) fail(tag + ': ' + r.name + ' komPts seeded ' + r.komPts + ', tour carried ' + g.komPts);
    const f = clamp(prevFat[r.name] || 0, 0, 100);
    if (r.fatigue !== f) fail(tag + ': ' + r.name + ' fatigue ' + r.fatigue + ', tour carried ' + f);
    if (r.legCap !== 100 - f * 0.28) fail(tag + ': ' + r.name + ' legCap ' + r.legCap + ' does not follow fatigue ' + f);
    if (r.energy !== r.legCap) fail(tag + ': ' + r.name + ' starts at energy ' + r.energy + ', legCap ' + r.legCap);
    if (!fin(r.gcTime) || !fin(r.sprintPts) || !fin(r.komPts) || !fin(r.fatigue)) fail(tag + ': ' + r.name + ' seeded with a non-finite value');
  }
  for (const k of ['gc', 'points', 'kom']) if (race.leaders[k] !== prevLeaders[k])
    fail(tag + ': leaders.' + k + ' arrived as ' + race.leaders[k] + ', tour carried ' + prevLeaders[k]);

  // ---- the spec REBUILD in buildStage must drop no field of the template ----
  // (spec.tt and spec.route were both silently lost this way once; len/hilly/wind are
  // transformed by division but must still exist)
  for (const k of Object.keys(STAGES[si])) {
    if (STAGES[si][k] !== undefined && race.spec[k] === undefined)
      fail(tag + ': spec.' + k + ' was dropped by the buildStage rebuild');
  }
  if (STAGES[si].tt) {
    if (race.spec.tt !== true) fail(tag + ': a TT template built with spec.tt = ' + race.spec.tt);
    if (!race.ttChecks) fail(tag + ': TT built without time checks');
    if (race.ttGap !== CFG.ttGap) fail(tag + ': TT start interval ' + race.ttGap + ', expected ' + CFG.ttGap);
    // reverse GC order: worst on GC rolls first, the leader goes off last
    const gcT = r => prevGC[r.name].time;
    const startOrder = race.riders.slice().sort((a, b) => (gcT(b) - gcT(a)) || (b.i - a.i));
    startOrder.forEach((r, k) => {
      if (r.startAt !== k * CFG.ttGap)
        fail(tag + ': ' + r.name + ' (gc ' + gcT(r).toFixed(1) + ') starts at ' + r.startAt + ', reverse GC order says ' + k * CFG.ttGap);
    });
    if (race.preRoll !== race.you.startAt) fail(tag + ': preRoll ' + race.preRoll + ' is not your start slot ' + race.you.startAt);
  } else {
    if (race.riders.some(r => r.startAt !== 0)) fail(tag + ': a road stage has TT start intervals');
  }
  bail();

  // ---- ride the stage: AI-driven player, settle runs the race to completion ----
  race.you.you = false;
  race.you.plan = { k: 'raid', at: 0.99, kick: 200 };
  const order = Sim.settle(race);

  if (order.length !== names.length) fail(tag + ': settle classified ' + order.length + ' riders');
  const places = order.map(r => r.place);
  if (new Set(places).size !== order.length || Math.min.apply(null, places) !== 1 || Math.max.apply(null, places) !== order.length)
    fail(tag + ': places are not 1..' + order.length + ': ' + places.join(','));
  for (let i = 1; i < order.length; i++)
    if (order[i].time < order[i - 1].time) fail(tag + ': classification out of order at place ' + (i + 1));
  for (let i = 0; i < order.length; i++)
    if (order[i].bonus < (CFG.bonusStage[i] || 0)) fail(tag + ': place ' + (i + 1) + ' bonus ' + order[i].bonus + ' is below the podium seconds');

  for (const r of race.riders) {
    if (!fin(r.time) || r.time <= 0) fail(tag + ': ' + r.name + ' finished with time ' + r.time);
    if (!fin(r.gcTime) || !fin(r.sprintPts) || !fin(r.komPts)) fail(tag + ': ' + r.name + ' holds a non-finite total');
    // the frozen arithmetic: gcTime grew by exactly time - bonus + timePenalties
    const tp = (r.penalties || []).reduce((a, x) => a + (x.time || 0), 0);
    const delta = r.time - r.bonus + tp;
    if (r.gcTime !== prevGC[r.name].time + delta)
      fail(tag + ': ' + r.name + ' gcTime ' + r.gcTime + ' !== carried ' + prevGC[r.name].time + ' + stage ' + delta);
    sumTime[r.name] += delta;
    // points only ever grow, by integer stage gains
    const gs = r.sprintPts - prevGC[r.name].sprintPts, gk = r.komPts - prevGC[r.name].komPts;
    if (gs < 0 || !Number.isInteger(gs)) fail(tag + ': ' + r.name + ' sprint points went ' + prevGC[r.name].sprintPts + ' -> ' + r.sprintPts);
    if (gk < 0 || !Number.isInteger(gk)) fail(tag + ': ' + r.name + ' KOM points went ' + prevGC[r.name].komPts + ' -> ' + r.komPts);
    sumSprint[r.name] += gs; sumKom[r.name] += gk;
  }
  bail();

  // ---- finishStage's accumulation, replicated exactly ----
  for (const r of race.riders) {
    tour.gc[r.name] = { time: r.gcTime, sprintPts: r.sprintPts, komPts: r.komPts };
    tour.fatigue[r.name] = Math.min(100, (r.fatigue || 0) * 0.50 + r.load * 0.9);
    if (!fin(tour.fatigue[r.name]) || tour.fatigue[r.name] < 0 || tour.fatigue[r.name] > 100)
      fail(tag + ': ' + r.name + ' carries fatigue ' + tour.fatigue[r.name] + ' into tomorrow');
  }
  const gc = race.riders.slice().sort((a, b) => (a.gcTime - b.gcTime) || (a.place - b.place));
  const pts = Sim.byKey(race.riders, 'sprintPts', 'place');
  const kom = Sim.byKey(race.riders, 'komPts', 'place');
  tour.leaders = { gc: gc[0].name,
    points: pts[0].sprintPts > 0 ? pts[0].name : null,
    kom: kom[0].komPts > 0 ? kom[0].name : null };

  // the jerseys, re-derived independently of the sorts the view uses
  let bestGC = race.riders[0];
  for (const r of race.riders)
    if (r.gcTime < bestGC.gcTime || (r.gcTime === bestGC.gcTime && r.place < bestGC.place)) bestGC = r;
  if (tour.leaders.gc !== bestGC.name) fail(tag + ': yellow is ' + tour.leaders.gc + ', lowest gc is ' + bestGC.name);
  const argmax = key => {
    let best = race.riders[0];
    for (const r of race.riders)
      if (r[key] > best[key] || (r[key] === best[key] && r.place < best.place)) best = r;
    return best;
  };
  const bestS = argmax('sprintPts'), bestK = argmax('komPts');
  if (tour.leaders.points !== (bestS.sprintPts > 0 ? bestS.name : null))
    fail(tag + ': green is ' + tour.leaders.points + ', argmax says ' + (bestS.sprintPts > 0 ? bestS.name : null));
  if (tour.leaders.kom !== (bestK.komPts > 0 ? bestK.name : null))
    fail(tag + ': polka is ' + tour.leaders.kom + ', argmax says ' + (bestK.komPts > 0 ? bestK.name : null));
  bail();

  console.log(tag + ': won by ' + order[0].name + ' in ' + order[0].time.toFixed(1) + 's; yellow ' +
    tour.leaders.gc + ', green ' + tour.leaders.points + ', polka ' + tour.leaders.kom);
}

// ---- final classification: every total is the exact sum of its stage contributions ----
for (const n of names) {
  if (tour.gc[n].time !== sumTime[n]) fail(n + ' final gc ' + tour.gc[n].time + ' !== sum of stage contributions ' + sumTime[n]);
  if (tour.gc[n].sprintPts !== sumSprint[n]) fail(n + ' final sprint points ' + tour.gc[n].sprintPts + ' !== summed gains ' + sumSprint[n]);
  if (tour.gc[n].komPts !== sumKom[n]) fail(n + ' final KOM points ' + tour.gc[n].komPts + ' !== summed gains ' + sumKom[n]);
  if (!fin(tour.gc[n].time) || tour.gc[n].time <= 0) fail(n + ' final gc time is ' + tour.gc[n].time);
}
const finalGC = names.slice().sort((a, b) => tour.gc[a].time - tour.gc[b].time);
for (let i = 1; i < finalGC.length; i++)
  if (tour.gc[finalGC[i]].time < tour.gc[finalGC[i - 1]].time) fail('final classification is out of order');
if (tour.leaders.gc !== finalGC[0]) fail('tour ends with yellow on ' + tour.leaders.gc + ' but ' + finalGC[0] + ' has the lowest time');
bail();

console.log('final gc: ' + finalGC.map(n => n + ' ' + tour.gc[n].time.toFixed(3)).join(', '));
console.log('PASS: tour glue carries gc, points, jerseys and fatigue between stages exactly as the view does');
