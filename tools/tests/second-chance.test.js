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

// The INTENDED play, and the yardstick the balance was measured against: bridge to the
// next car, tuck into its draft to breathe when the legs run low, and steer AROUND it
// rather than into it. 'dawdle' is the control — up the middle of the road at a tempo
// that ignores the convoy entirely.
function chase(race, style, secs) {
  let result = null, g = 0;
  while (g++ < 120 * secs && result === null) {
    const you = race.you;
    let tx = you.x, rate = 4.0;
    if (style === 'paced') {
      const next = (race.convoy || []).filter(cr => cr.dist > you.dist + 0.4)
        .sort((a, b) => a.dist - b.dist)[0];
      if (next) {
        const d = next.dist - you.dist;
        const inDraft = d > 2.8 && d < CFG.carDraft && Math.abs(you.x - next.x) < 1.7;
        if (inDraft && you.energy < 48) { tx = next.x; rate = 1.2; }        // breathe
        else if (d < 6.5) { tx = next.x + (next.x > 0 ? -1 : 1) * 2.1; }    // go around it
        else tx = next.x;                                                    // bridge to it
      }
    } else { tx = 0; rate = 2.0; }
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
if (!race.convoy || race.convoy.length < 2) { console.log('FAIL: no convoy spawned'); process.exit(1); }
if (!(race.you.energy >= race.you.legCap * CFG.chanceLegs - 1e-6) || race.you.cracked) {
  console.log('FAIL: revived on cracked/empty legs — the convoy rides away and no chase is possible');
  process.exit(1);
}
// The rungs must be FURTHER apart than a car's draft reaches, or the convoy is one
// long shelter you can sit in the whole way instead of a ladder you have to climb.
const offs = race.convoy.map(c => c.off).sort((a, b) => a - b);
for (let i = 1; i < offs.length; i++) {
  const d = offs[i] - offs[i - 1];
  if (d < CFG.carDraft + 2) {
    console.log('FAIL: cars only ' + d.toFixed(1) + 'm apart — inside the ' + CFG.carDraft + 'm car draft, so the drafts overlap into one');
    process.exit(1);
  }
}
if (new Set(race.convoy.map(c => Math.sign(c.x))).size < 2) {
  console.log('FAIL: every car on the same side of the road — nothing to pick your way through');
  process.exit(1);
}
let tail = Infinity;
for (const r of race.riders) if (!r.you && r.inPeloton && r.dist < tail) tail = r.dist;
const gap0 = tail - race.you.dist;
if (!(gap0 > CFG.chanceGapMin - 4 && gap0 < CFG.chanceGap + 4)) { console.log('FAIL: revive gap ' + gap0.toFixed(1) + ' outside the quality range'); process.exit(1); }
race.events.length = 0;

// ---- the catch, then a real finish
const r1 = chase(race, 'paced', 80);
if (r1 !== 'caught') { console.log('FAIL: the intended play (bridge, breathe in the draft, go around) did not catch the bunch: ' + r1); process.exit(1); }
let g = 0;
while (!race.you.finished && g++ < 120 * 600) { Sim.step(race, CFG.fixedDt, { rate: 2.6, ease: false, launch: false, stumble: false, tx: race.you.x }); race.events.length = 0; }
if (!race.you.finished || !(race.you.time > 0 && race.you.time < 9000)) {
  console.log('FAIL: revived rider did not go on to a sane finish (time ' + race.you.time + ')'); process.exit(1);
}
console.log('caught the bunch from +' + gap0.toFixed(1) + 'm and finished in ' + race.you.time.toFixed(1) + 's, no sentinel');

// ---- the cars are SOLID: you go around them, you do not ride through them
race = makeRace();
race.you.out = true; Sim.tick(race, CFG.fixedDt);
Sim.secondChance(race, 0.5);
race.events.length = 0;
{
  // Line the player up dead behind the nearest car and drive straight at it.
  const car = race.convoy.slice().sort((a, b) => a.dist - b.dist)[0];
  const you = race.you;
  you.dist = car.dist - 9; you.prev = you.dist; you.x = car.x; you.tx = car.x;
  you.energy = you.legCap;
  let passedThrough = false, bumped = false, minGap = 99;
  for (let i = 0; i < 120 * 12; i++) {
    Sim.step(race, CFG.fixedDt, { rate: 4.0, ease: false, launch: false, stumble: false, tx: car.x });
    while (race.events.length) {
      const ev = race.events.shift();
      if (ev.t.indexOf('CAR') >= 0) bumped = true;
    }
    const gap = car.dist - you.dist;
    if (gap > -0.4) minGap = Math.min(minGap, Math.abs(gap));
    // through it means past its nose while still lined up with it laterally
    if (gap < -CFG.carLon * 0.5 && Math.abs(you.x - car.x) < CFG.carLat * 0.6) passedThrough = true;
    if (!race.chance.active) break;
  }
  if (passedThrough) { console.log('FAIL: rode straight through a team car'); process.exit(1); }
  if (!bumped) { console.log('FAIL: driving into a car raised no contact at all (minGap ' + minGap.toFixed(2) + ')'); process.exit(1); }
  console.log('drove into a car head-on: contact raised, never passed through it');
}

// ---- the broom wagon, and once-per-race
race = makeRace();
race.you.out = true; Sim.tick(race, CFG.fixedDt);
Sim.secondChance(race, 0.0);
race.events.length = 0;
const r2 = chase(race, 'dawdle', 80);
if (r2 !== 'broomed') { console.log('FAIL: dawdling up the middle of the road should be broomed, got: ' + r2); process.exit(1); }
Sim.tick(race, CFG.fixedDt);
if (!race.you.out || race.you.time < 9000) { console.log('FAIL: broomed rider is not out with the sentinel'); process.exit(1); }
if (Sim.secondChance(race, 1.0) !== false) { console.log('FAIL: a second second chance was granted'); process.exit(1); }
console.log('broomed as promised, and the chance is once per race');
console.log('PASS: the spare bike comes off the roof once, and only the chase decides if it mattered');
