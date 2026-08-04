// MECHANIC: time trial rules. Promise: riders start alone at fixed intervals, the road
// carries no hand-ups, and sitting in another rider's shelter is an offence the
// commissaire counts (SHELTERING penalty).
const Sim = require('../sim.js');
const { CFG } = Sim;
const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
const race = Sim.createRace({ seed: 13, stageIndex: 5, playerType: 'rouleur', gc, leaders: {}, div: 4 });
if (!(race.spec && race.spec.tt) && !(race.course.spec && race.course.spec.tt)) { console.log('FAIL: stage 5 did not build as a time trial'); process.exit(1); }
if (race.course.items.length || race.course.feeds.length) { console.log('FAIL: a TT should carry no items or feed zones'); process.exit(1); }
const starts = race.riders.map(r => r.startAt).sort((a, b) => a - b);
const gapsOk = starts.every((s, i) => i === 0 || Math.abs((s - starts[i - 1]) - CFG.ttGap) < 0.01);
console.log('start slots: ' + starts.map(s => s.toFixed(0)).join(','));
if (new Set(starts).size !== starts.length || !gapsOk) { console.log('FAIL: TT starts are not clean ' + CFG.ttGap + 's intervals'); process.exit(1); }
// FLATTEN THE WIND AND STRAIGHTEN THE ROAD before measuring the shelter. The shelter sits
// off to one side in a crosswind AND to the inside of a bend, so a rider pinned directly
// behind a wheel drifts in and out of it as the weather and the road roll past: what the
// commissaire counts becomes a reading of the parcours rather than of the rule. Left live,
// this passed or failed on which patch of wind and which curve the player happened to be
// in (found when rivals gained an aero dimension, which shifted their speed and therefore
// their position in both fields). Same hard rule the other scenario tests follow.
race.course.winds = [{ d: -1e6, dir: 0, str: 0, lon: 0 }, { d: 1e9, dir: 0, str: 0, lon: 0 }];
race.course.bend = { a: 0, f: 1, p: 0 }; race.course.swAmp = 0;
// glue the player to a rider's wheel and let the commissaire count
const hare = race.riders.filter(o => !o.you)[0];
race.you.startAt = 0; hare.startAt = 0;
// AND CLEAR THE PRE-ROLL DEBT. createRace records the player's start slot as a debt the
// first step() pays off in one go; moving the slot to 0 afterwards does not cancel it. The
// first step therefore rode 84 seconds, carrying the player over the finish line, where a
// finished rider is skipped entirely and there is no shelter left to measure.
race.preRoll = 0;
race.you.dist = 60; hare.dist = 61.4; hare.speed = race.you.speed = 11;
let sheltered = null, pen0 = race.you.penalties.length;
for (let g = 0; g < 120 * 20; g++) {
  hare.dist = race.you.dist + 1.4; hare.prev = hare.dist; hare.x = race.you.x; hare.speed = race.you.speed;  // pinned hare
  Sim.step(race, CFG.fixedDt, { rate: 3.0, ease: false, launch: false, stumble: false, tx: race.you.x });
  while (race.events.length) {
    const ev = race.events.shift();
    if (ev.t === 'SHELTERING' && sheltered === null) sheltered = g / 120;
  }
}
console.log('sheltering flagged at ' + (sheltered === null ? 'never' : sheltered.toFixed(1) + 's') + ', penalties ' + pen0 + ' -> ' + race.you.penalties.length);
if (sheltered === null || race.you.penalties.length <= pen0) { console.log('FAIL: gluing to a wheel in a TT was not penalised'); process.exit(1); }
console.log('PASS: intervals, a bare road, and the commissaire counting your drafting');
