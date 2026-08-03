// MECHANIC: finish-line ride-through. Promises: (1) a finished rider ROLLS OUT past
// the line, dist still climbing while speed decays gently toward 0, instead of
// freezing into a parked wall ON the line ("RIDE THROUGH THE LINE" in stepRider);
// (2) a finished rider never speed-caps someone still racing to the line (the
// collision-cap scan skips o.finished, "must never speed-cap a sprinter"); (3) the
// race does not end on the frame the player crosses, it lingers about 4 seconds
// (race.overAt = clock + 4, "Linger a few seconds" in step).
const Sim = require('../sim.js');
const { CFG } = Sim;

const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
const race = Sim.createRace({ seed: 7, stageIndex: 0, playerType: 'rouleur', gc, leaders: {}, div: 4 });
race.course.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
const c = race.course;
for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = [];
c.primes = []; c.items = []; c.feeds = []; c.litters = [];

// You start a short run from the line; one rival is up the road so it crosses first
// (togo < sprintFrom puts it in attack, so it stays clear of a rate-3.0 player).
// Everyone else is parked 400+ back and pinned there every frame.
const you = race.you;
you.dist = c.len - 260; you.prev = you.dist; you.x = 0; you.tx = 0; you.txS = 0;
const others = race.riders.filter(o => !o.you);
const rival = others[0];
rival.dist = c.len - 190; rival.prev = rival.dist; rival.x = 1.4; rival.tx = 1.4; rival.txS = 1.4;
rival.speed = you.speed;
rival.plan = { k: 'raid', at: 0.99, kick: 400 };
const parked = others.slice(1);
const anchor = c.len - 700;
for (const o of parked) { o.dist = anchor; o.prev = anchor; o.plan = { k: 'raid', at: 0.99, kick: 400 }; }

// Per-finisher rollout log: dist and speed at the moment of crossing, then at
// +1, +2 and +3 seconds of race clock.
function track(r, nm) { return { r, nm, finClock: null, finDist: 0, finSpeed: 0, samples: [] }; }
const tracks = [track(rival, rival.name), track(you, 'YOU')];
let overFalseAtFinish = null, youFinClock = null, overClock = null, capViolation = null;

let g = 0;
while (g++ < 120 * 600) {
  for (const o of parked) { o.dist = anchor; o.prev = anchor; o.speed = 0; }
  Sim.step(race, CFG.fixedDt, { rate: 3.0, ease: false, launch: false, stumble: false, tx: 0 });
  while (race.events.length) race.events.shift();       // drain, or timestamps lie
  // (2) the cap scan must never elect a finished rider as the wheel that slows you
  for (const r of race.riders) {
    if (!r.finished && r.ahead && r.ahead.finished && capViolation === null) {
      capViolation = r.you ? 'YOU' : r.name;
    }
  }
  for (const tr of tracks) {
    if (tr.finClock === null && tr.r.finished) {
      tr.finClock = race.clock; tr.finDist = tr.r.dist; tr.finSpeed = tr.r.speed;
      if (tr.r === you) { youFinClock = race.clock; overFalseAtFinish = !race.over; }
    } else if (tr.finClock !== null && tr.samples.length < 3
      && race.clock >= tr.finClock + tr.samples.length + 1) {
      tr.samples.push({ d: tr.r.dist, s: tr.r.speed });
    }
  }
  if (race.over && overClock === null) overClock = race.clock;
  if (overClock !== null && tracks.every(tr => tr.samples.length === 3)) break;
}

for (const tr of tracks) {
  if (tr.finClock === null) { console.log('FAIL: ' + tr.nm + ' never finished inside the guard'); process.exit(1); }
}
const rv = tracks[0], yt = tracks[1];
if (!(rv.finClock < yt.finClock)) { console.log('FAIL: scenario broke, the rival did not finish first (rival ' + rv.finClock.toFixed(1) + 's vs you ' + yt.finClock.toFixed(1) + 's)'); process.exit(1); }
console.log('rival crossed at ' + rv.finClock.toFixed(1) + 's doing ' + rv.finSpeed.toFixed(1)
  + ', you at ' + yt.finClock.toFixed(1) + 's doing ' + yt.finSpeed.toFixed(1)
  + ', race.over at ' + (overClock === null ? 'never' : overClock.toFixed(1) + 's'));
for (const tr of tracks) {
  console.log(tr.nm + ' rollout: ' + tr.finDist.toFixed(1) + ' -> '
    + tr.samples.map(sm => sm.d.toFixed(1) + '@' + sm.s.toFixed(1)).join(' -> ')
    + '  (line at ' + c.len + ')');
}

// (1) ride THROUGH the line: dist keeps climbing, speed decays
for (const tr of tracks) {
  let d = tr.finDist, s = tr.finSpeed;
  for (const sm of tr.samples) {
    if (!(sm.d > d)) { console.log('FAIL: ' + tr.nm + ' froze on the line, dist stalled at ' + sm.d.toFixed(2) + ' after finishing'); process.exit(1); }
    if (!(sm.s < s)) { console.log('FAIL: ' + tr.nm + ' is not sitting up, speed ' + sm.s.toFixed(2) + ' did not decay from ' + s.toFixed(2)); process.exit(1); }
    d = sm.d; s = sm.s;
  }
  // (2) positionally: two seconds after crossing, the finisher is well clear of the line
  if (!(tr.samples[1].d > c.len + 2)) { console.log('FAIL: ' + tr.nm + ' still parked within 2 m of the line 2 s after finishing (at ' + tr.samples[1].d.toFixed(2) + ', line ' + c.len + ')'); process.exit(1); }
}
if (capViolation !== null) { console.log('FAIL: a finished rider speed-capped ' + capViolation + ' who was still racing'); process.exit(1); }

// (3) the linger: not over on the finish frame, over about 4 s later
if (overFalseAtFinish !== true) { console.log('FAIL: race.over fired on the frame the player finished'); process.exit(1); }
if (overClock === null) { console.log('FAIL: race.over never fired after the player finished'); process.exit(1); }
const linger = overClock - youFinClock;
if (!(linger > 3.4 && linger < 4.6)) { console.log('FAIL: race.over came ' + linger.toFixed(2) + 's after the finish, expected about 4 s'); process.exit(1); }
console.log('PASS: finishers roll through and clear the line, nobody racing is capped by them, and the race lingers ' + linger.toFixed(1) + 's before ending');
