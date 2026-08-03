// Drill-shaped repro for the rotation rejoin fix. Player THIRD in a 3-man break,
// sitting in. Asserts:
//   1. cue order: "YOUR TURN" only after BOTH riders ahead each held the front >= 2s
//   2. THE FIX: every swing-off release happens BEHIND the player (on their wheel)
//   3. every relieved AI front actually swings (no silent mid-file rejoin)
const Sim = require('../sim.js');
const { CFG } = Sim;

const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
const race = Sim.createRace({ seed: 7, stageIndex: 0, playerType: 'rouleur', gc, leaders: {}, div: 4 });
race.course.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
{
  const c = race.course;
  for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
  for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
  c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
  c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = [];
  c.primes = []; c.items = []; c.feeds = []; c.litters = [];
}
const others = race.riders.filter(o => !o.you);
const mates = [];
others.forEach((o, i) => {
  if (i < 2) {
    o.dist = race.you.dist + (i + 1) * 2.4;
    o.x = race.you.x + (i % 2 ? 0.5 : -0.5);
    o.speed = race.you.speed;
    o.plan = { k: 'raid', at: 0.05, kick: 400 };
    mates.push(o);
  } else o.dist = race.you.dist - 300;
});
const A = mates[1], B = mates[0];

function policy(r) {
  const ahead = Math.max(A.dist, B.dist) - r.you.dist;
  const rate = ahead > 5 ? 5.0 : ahead > 2.5 ? 3.6 : 2.6;
  return { rate, ease: false, launch: false, stumble: false, tx: r.you.x };
}
function hold(r) {
  const y = r.you, ms = r.riders.filter(o => !o.you).slice(0, 2);
  ms.forEach((o, i) => {
    const want = y.dist + (o.dist > y.dist ? 2.2 + i * 2.2 : -(2.2 + i * 2.2));
    if (Math.abs(o.dist - want) > 9) { o.dist = want; o.prev = want; }
    const lo = y.speed * (o.swingOff > 0 ? 0.90 : 0.94);
    o.speed = Math.max(lo, Math.min(y.speed * 1.06, o.speed));
  });
  for (const o of r.riders.filter(o => !o.you).slice(2)) {
    if (o.dist > y.dist - 140) { o.dist = y.dist - 200; o.prev = o.dist; o.speed = y.speed * 0.9; }
  }
}

let log = [], cueT = null, fails = [];
const tenure = {};          // name -> seconds of longest completed spell on the front
let lastF = null, fSince = 0;
const wasSwinging = {}, everSwung = {};
for (let g = 0; g < 120 * 40; g++) {
  hold(race);
  Sim.step(race, CFG.fixedDt, policy(race));
  const t = +(g / 120).toFixed(2);
  const f = race.breakFront;
  if (f !== lastF) {
    if (lastF) {
      const nm = lastF.you ? 'YOU' : lastF.name;
      const dur = +(t - fSince).toFixed(2);
      tenure[nm] = Math.max(tenure[nm] || 0, dur);
      log.push(t + 's  ' + nm + ' relieved after ' + dur + 's on the front');
      if (!lastF.you && dur >= 1.5 && !(lastF.swingOff > 0))
        fails.push(nm + ' relieved at ' + t + 's after a real pull but did NOT swing off');
    }
    lastF = f; fSince = t;
    if (f) log.push(t + 's  front -> ' + (f.you ? 'YOU' : f.name));
  }
  for (const r of [A, B]) {
    if (r.swingOff > 0) { wasSwinging[r.name] = true; everSwung[r.name] = true; }
    else if (wasSwinging[r.name]) {
      wasSwinging[r.name] = false;
      const rel = +(r.dist - race.you.dist).toFixed(2);
      log.push(t + 's  ' + r.name + ' swing released at ' + rel + ' vs player (negative = on your wheel)');
      if (rel > -0.5) fails.push(r.name + ' released swing still at ' + rel + ' vs player at ' + t + 's');
      if (rel < -8) fails.push(r.name + ' released swing stranded at ' + rel + ' vs player at ' + t + 's');
    }
  }
  while (race.events.length) {
    const ev = race.events.shift();
    if (/YOUR TURN|GOOD TURN|COME THROUGH/.test(ev.t)) {
      log.push(t + 's  EVENT: ' + ev.t);
      if (ev.t.startsWith('YOUR TURN') && cueT === null) {
        cueT = t;
        // count the current front's ongoing spell too: the cue fires the moment the
        // front's pull is DONE, which is before they are formally relieved
        const cur = {}; if (lastF && !lastF.you) cur[lastF.name] = t - fSince;
        const tA = Math.max(tenure[A.name] || 0, cur[A.name] || 0);
        const tB = Math.max(tenure[B.name] || 0, cur[B.name] || 0);
        if (!(tA >= 2 && tB >= 2))
          fails.push('cue at ' + t + 's before both ahead had done real pulls (A=' + tA.toFixed(1) + 's B=' + tB.toFixed(1) + 's)');
      }
    }
  }
  if (cueT !== null && t > cueT + 15) break;
}
console.log(log.join('\n'));
console.log('---');
if (cueT === null) fails.push('cue never fired in 40s');
if (!everSwung[A.name]) fails.push(A.name + ' never swung off at all');
if (!everSwung[B.name]) fails.push(B.name + ' never swung off at all');
for (const r of [A, B]) if (r.swingOff > 0) fails.push(r.name + ' still swinging at end of run (never rejoined)');
if (fails.length) { console.log('FAIL:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('PASS: both pulled, both swung, every swing released on the player\'s wheel, cue in order');
