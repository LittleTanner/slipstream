// MECHANIC: rotation cohesion. Promise: rotation cues only fire in a COHESIVE working
// group. brk is "everyone 10+ clear of the bunch", so a companion dropped 15 m back
// (but still well clear of the peloton) used to keep a two-man "rotation" alive and the
// cues congratulated a player pulling a train that did not exist. The cohesion rule
// (updateGroups, anchor "A ROTATION IS RIDERS TOGETHER") walks the chain back from the
// front rider and breaks at the first inter-rider gap > 10.
// Phase 1: mate pinned 15 m back -> NO "GOOD TURN", NO "YOUR TURN", race.rotating never
// true while the player is functionally alone on the front.
// Phase 2: same mate pinned 2.4 m back (a working wheel) -> the rotation engages, which
// proves the gate blocks the fake rotation without killing the real one.
const Sim = require('../sim.js');
const { CFG } = Sim;

const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
const race = Sim.createRace({ seed: 7, stageIndex: 0, playerType: 'rouleur', gc, leaders: {}, div: 4 });
race.course.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
const c = race.course;
for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.items = []; c.feeds = []; c.litters = [];

const others = race.riders.filter(o => !o.you);
const mate = others[0];
mate.plan = { k: 'raid', at: 0.99, kick: 400 };          // never launches a real attack
for (const o of others) if (o !== mate) {
  o.dist = race.you.dist - 320; o.prev = o.dist;         // the bunch, parked far back
}

// Per-frame pins: the mate held at a fixed offset behind the player (dist AND prev, so
// no implied velocity spike; speed matched), the bunch repinned if it ever creeps.
function pin(offset) {
  const y = race.you;
  mate.dist = y.dist - offset; mate.prev = mate.dist;
  mate.speed = y.speed;
  mate.x = y.x;
  for (const o of others) {
    if (o === mate) continue;
    if (o.dist > y.dist - 300) { o.dist = y.dist - 320; o.prev = o.dist; o.speed = y.speed * 0.9; }
  }
}
const policy = () => ({ rate: 3.5, ease: false, launch: false, stumble: false, tx: race.you.x });

// Phase 1 (~90s): dropped companion, 15 m back. Clear of the bunch, NOT a working group.
const badCues = [];
let everRotating = null;
for (let g = 0; g < 120 * 90; g++) {
  pin(15);
  Sim.step(race, CFG.fixedDt, policy());
  const t = (g / 120).toFixed(1);
  if (race.rotating && everRotating === null) everRotating = t;
  while (race.events.length) {
    const ev = race.events.shift();
    if (ev.t.startsWith('GOOD TURN') || ev.t.startsWith('YOUR TURN')) badCues.push(t + 's  ' + ev.t);
  }
}

// Phase 2 (~40s): the same companion tucked in at 2.4 m — a genuine working wheel.
let rotatingAt = null, goodTurnAt = null;
for (let g = 0; g < 120 * 40; g++) {
  pin(2.4);
  Sim.step(race, CFG.fixedDt, policy());
  const t = (90 + g / 120).toFixed(1);
  if (race.rotating && rotatingAt === null) rotatingAt = t;
  while (race.events.length) {
    const ev = race.events.shift();
    if (ev.t.startsWith('GOOD TURN') && goodTurnAt === null) goodTurnAt = t;
  }
}

console.log('phase 1 (mate 15m back, 90s): cues=' + badCues.length + ', rotating first true at ' + (everRotating || 'never'));
console.log('phase 2 (mate 2.4m back, 40s): rotating at ' + (rotatingAt ? rotatingAt + 's' : 'never') + ', GOOD TURN at ' + (goodTurnAt ? goodTurnAt + 's' : 'never'));
if (badCues.length) { console.log('FAIL: rotation cues fired while functionally alone:\n' + badCues.join('\n')); process.exit(1); }
if (everRotating !== null) { console.log('FAIL: race.rotating went true at ' + everRotating + 's with the only companion 15m back'); process.exit(1); }
if (rotatingAt === null && goodTurnAt === null) { console.log('FAIL: cohesion gate killed the REAL rotation — mate on the wheel at 2.4m never engaged it'); process.exit(1); }
console.log('PASS: no rotation with a dropped companion 15m back; the same pair rotates once the wheel closes to 2.4m');
