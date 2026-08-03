// MECHANIC: bottle drop zone placement. Promise: a drop zone NEVER appears before the
// first feed zone ends — you cannot be carrying an empty before any bottle could have
// been picked up (the "Never before the first feed" anchor in addLitter) — and there is
// ALWAYS at least one drop zone after the LAST feed. The guarantee used to be
// best-effort (on ~14 in 5000 courses a big roundabout right after the last feed
// blocked every strict candidate and the block gave up, leaving a rider who bottled
// there only a fine for the rest of the stage); the guarantee block now runs a relaxed
// second pass with no furniture buffers, so the promise is unconditional and so is
// this assertion.
// This test INSPECTS generated courses; it does not race. Stage 5 is the TT (no feeds,
// no litters by design), so it is skipped.
const Sim = require('../sim.js');

let checked = 0, bad = 0;
for (let seed = 1; seed <= 60; seed++) {
  for (let si = 0; si <= 4; si++) {                       // skip 5, the TT
    for (const div of [2, 7]) {
      const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
      const race = Sim.createRace({ seed, stageIndex: si, playerType: 'rouleur', gc, leaders: {}, div });
      const c = race.course;
      const tag = 'seed=' + seed + ' stage=' + si + ' div=' + div;
      checked++;
      if (!c.feeds.length) {
        console.log('FAIL: ' + tag + ' has no feed zone (the placement guard reduces over feeds)');
        bad++; continue;
      }
      if (!c.litters.length) {
        console.log('FAIL: ' + tag + ' has no drop zone at all (the guarantee block must always find somewhere)');
        bad++; continue;
      }
      const firstFeedEnd = c.feeds.reduce((a, f) => Math.min(a, f.e), 1e9);
      const lastFeedEnd = c.feeds.reduce((a, f) => Math.max(a, f.e), 0);
      for (const l of c.litters) {
        if (l.s < firstFeedEnd) {
          console.log('FAIL: ' + tag + ' drop zone at ' + Math.round(l.s) + 'm starts before the first feed ends at ' + Math.round(firstFeedEnd) + 'm');
          bad++;
        }
      }
      if (!c.litters.some(l => l.s > lastFeedEnd)) {
        console.log('FAIL: ' + tag + ' has no drop zone after the last feed (ends at ' + Math.round(lastFeedEnd) + 'm)');
        bad++;
      }
    }
  }
}
if (bad) { console.log('FAIL: ' + bad + ' violation(s) across ' + checked + ' courses'); process.exit(1); }
console.log('PASS: ' + checked + ' courses: no drop zone before the first feed, always one after the last');
