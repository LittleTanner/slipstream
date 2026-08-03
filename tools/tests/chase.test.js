// MECHANIC: the chase. Promise: a threatening break up the road raises race.chase and
// the bunch responds; with everyone together the chase stays low.
const Sim = require('../sim.js');
const { CFG } = Sim;
function run(withBreak) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed: 21, stageIndex: 3, playerType: 'rouleur', gc, leaders: {}, div: 2 });
  race.course.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
  const c = race.course;
  for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
  for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
  c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
  c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.items = []; c.feeds = []; c.litters = [];
  // put the race at 60% distance so the chase has urgency
  const jump = c.len * 0.6;
  for (const r of race.riders) { r.dist += jump; r.prev = r.dist; }
  const others = race.riders.filter(o => !o.you);
  // nobody freelances: the only difference between runs is the planted break —
  // including the player, who rides as AI so they cannot drift off the front and
  // become the "break" themselves (which is how the first control run failed)
  race.you.you = false;
  race.you.plan = { k: 'raid', at: 0.99, kick: 400 };
  for (const o of others) o.plan = { k: 'raid', at: 0.99, kick: 400 };
  if (withBreak) {
    others[0].dist += 90; others[1].dist += 88;
    others[0].plan = others[1].plan = { k: 'raid', at: 0.01, kick: 400 };
  }
  let peak = 0, paceSum = 0, n = 0;
  for (let g = 0; g < 120 * 30; g++) {
    Sim.step(race, CFG.fixedDt, null);
    // the teleport-to-60% spawn takes ~10s to organize; sample after it settles
    if (g > 120 * 15) { peak = Math.max(peak, race.chase || 0); paceSum += race.pelotonPace || 0; n++; }
  }
  return { peak, pace: paceSum / n };
}
const quiet = run(false), threat = run(true);
console.log('chase peak: together ' + quiet.peak.toFixed(2) + ' vs break up the road ' + threat.peak.toFixed(2) + '  |  bunch pace: ' + quiet.pace.toFixed(1) + ' vs ' + threat.pace.toFixed(1));
if (quiet.peak > 0.2) { console.log('FAIL: a compact bunch should not be chasing anything'); process.exit(1); }
if (threat.peak < 0.4) { console.log('FAIL: a dangerous break did not raise the chase'); process.exit(1); }
console.log('PASS: the peloton fears a break and chases it');
