// MECHANIC: abandonment and PRNG discipline. Promise: opts.out removes riders from the
// field WITHOUT changing the course or the remaining riders' draws — the departed are
// still created so the PRNG stream is untouched.
const Sim = require('../sim.js');
function make(out) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  return Sim.createRace({ seed: 55, stageIndex: 2, playerType: 'rouleur', gc, leaders: {}, div: 4, out });
}
const full = make(undefined);
const cut = make(['NORD', 'FERN']);
const fpc = r => JSON.stringify({ len: r.course.len, climbs: r.course.climbs.map(x => [Math.round(x.s), Math.round(x.e)]), winds: r.course.winds.map(w => [Math.round(w.s), w.dir]) });
if (fpc(full) !== fpc(cut)) { console.log('FAIL: abandoning riders changed the course'); process.exit(1); }
const names = cut.riders.map(r => r.you ? 'YOU' : r.name);
if (names.includes('NORD') || names.includes('FERN')) { console.log('FAIL: out riders still in the field: ' + names.join(',')); process.exit(1); }
if (cut.riders.length !== full.riders.length - 2) { console.log('FAIL: field size wrong: ' + cut.riders.length + ' vs ' + full.riders.length); process.exit(1); }
const pick = n => r => r.riders.find(x => !x.you && x.name === n);
for (const n of ['ORO', 'SALT']) {
  const a = pick(n)(full), b = pick(n)(cut);
  if (!a || !b) { console.log('FAIL: rider ' + n + ' missing'); process.exit(1); }
  if (JSON.stringify(a.stats) !== JSON.stringify(b.stats) || a.strength !== b.strength || a.sharp !== b.sharp) {
    console.log('FAIL: ' + n + "'s draws changed when others abandoned (PRNG leak)"); process.exit(1);
  }
}
console.log('PASS: abandonment shrinks the field without touching the course or anyone else\'s draws');
