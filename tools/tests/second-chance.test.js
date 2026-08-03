// MECHANIC: the second chance. Promise: a crashed-out player revived via
// Sim.secondChance restarts behind the bunch with a convoy of team cars strung
// between them and it; slaloming bumper to bumper at real effort catches the bunch
// before the timer (BACK IN THE BUNCH) and the race continues to a sane finish;
// dawdling up the middle gets the broom wagon (out again, +9999 sentinel); the
// chance is once per race; and a race that is never revived is untouched (that last
// promise is held by verify.js — this suite passing alongside an unregenerated
// golden IS the evidence).
const Sim = require('../sim.js');
const { CFG } = Sim;

function makeRace() {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed: 9, stageIndex: 0, playerType: 'rouleur', gc, leaders: {}, div: 3 });
  const c = race.course;
  for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
  for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
  c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
  c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.items = []; c.feeds = []; c.litters = [];
  c.winds = [{ d: -1e6, dir: 0, str: 0, lon: 0 }, { d: 1e9, dir: 0, str: 0, lon: 0 }];
  const others = race.riders.filter(o => !o.you);
  others.forEach((o, i) => {
    o.dist = race.you.dist + 10 + (i % 3) * 2.2;
    o.x = ((i % 4) - 1.5) * 1.4;
    o.speed = CFG.base;
    o.plan = { k: 'raid', at: 0.99, kick: 400 };
  });
  // ride 20s so the bunch is a real, moving peloton before the crash
  let g = 0;
  while (g++ < 120 * 20) Sim.step(race, CFG.fixedDt, { rate: 3.0, ease: false, launch: false, stumble: false, tx: race.you.x });
  race.events.length = 0;
  return race;
}

function chase(race, rate, slalom, secs) {
  let result = null, g = 0;
  while (g++ < 120 * secs && result === null) {
    let tx = race.you.x;
    if (slalom && race.convoy) {
      const next = race.convoy.filter(cr => cr.dist > race.you.dist + 0.5).sort((a, b) => a.dist - b.dist)[0];
      if (next) tx = next.x;
    }
    Sim.step(race, CFG.fixedDt, { rate, ease: false, launch: false, stumble: false, tx });
    while (race.events.length) {
      const ev = race.events.shift();
      if (ev.t === 'BACK IN THE BUNCH') result = 'caught';
      if (ev.t.indexOf('BROOM WAGON') >= 0) result = 'broomed';
    }
  }
  return result;
}

// ---- the revive itself
let race = makeRace();
race.you.out = true; Sim.tick(race, CFG.fixedDt);
if (!race.you.finished || race.you.time < 9000) { console.log('FAIL: crash-out sentinel not armed before the revive'); process.exit(1); }
const ok = Sim.secondChance(race, 1.0);
if (!ok) { console.log('FAIL: secondChance refused a crashed-out player'); process.exit(1); }
if (race.you.out || race.you.finished) { console.log('FAIL: revive left the player out/finished'); process.exit(1); }
if (!race.convoy || race.convoy.length !== CFG.convoyN) { console.log('FAIL: no convoy spawned'); process.exit(1); }
let tail = Infinity;
for (const r of race.riders) if (!r.you && r.inPeloton && r.dist < tail) tail = r.dist;
const gap0 = tail - race.you.dist;
if (!(gap0 > CFG.chanceGapMin - 4 && gap0 < CFG.chanceGap + 4)) { console.log('FAIL: revive gap ' + gap0.toFixed(1) + ' outside the quality range'); process.exit(1); }
race.events.length = 0;

// ---- the catch, then a real finish
const r1 = chase(race, 3.2, true, 60);
if (r1 !== 'caught') { console.log('FAIL: full-quality slaloming chase at rate 3.2 was not caught: ' + r1); process.exit(1); }
let g = 0;
while (!race.you.finished && g++ < 120 * 600) { Sim.step(race, CFG.fixedDt, { rate: 2.6, ease: false, launch: false, stumble: false, tx: race.you.x }); race.events.length = 0; }
if (!race.you.finished || !(race.you.time > 0 && race.you.time < 9000)) {
  console.log('FAIL: revived rider did not go on to a sane finish (time ' + race.you.time + ')'); process.exit(1);
}
console.log('caught the bunch from +' + gap0.toFixed(1) + 'm and finished in ' + race.you.time.toFixed(1) + 's, no sentinel');

// ---- the broom wagon, and once-per-race
race = makeRace();
race.you.out = true; Sim.tick(race, CFG.fixedDt);
Sim.secondChance(race, 0.0);
race.events.length = 0;
const r2 = chase(race, 2.0, false, 60);
if (r2 !== 'broomed') { console.log('FAIL: dawdling up the middle should be broomed, got: ' + r2); process.exit(1); }
Sim.tick(race, CFG.fixedDt);
if (!race.you.out || race.you.time < 9000) { console.log('FAIL: broomed rider is not out with the sentinel'); process.exit(1); }
if (Sim.secondChance(race, 1.0) !== false) { console.log('FAIL: a second second chance was granted'); process.exit(1); }
console.log('broomed as promised, and the chance is once per race');
console.log('PASS: the spare bike comes off the roof once, and only the chase decides if it mattered');
