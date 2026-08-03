// Repro of the "Through and off" drill cue bug: player seeded THIRD in a 3-man break.
// Expected order: rider A pulls, swings; rider B pulls, swings; ONLY THEN "YOUR TURN".
// The old clock-based cue fired at sinceTurn=4s, right as rider A swung off.
const Sim = require('../sim.js');
const { CFG } = Sim;

const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
const race = Sim.createRace({ seed: 7, stageIndex: 0, playerType: 'rouleur', gc, leaders: {}, div: 4 });
// Replicate the drill's calming: no wind, flat straight road, no furniture.
race.course.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
{
  const c = race.course;
  for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
  for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
  c.eMin = 0; c.eMax = 40;
  c.bend = { a: 0, f: 1, p: 0 };
  c.swAmp = 0;
  c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = [];
  c.primes = []; c.items = []; c.feeds = []; c.litters = [];
}

const others = race.riders.filter(o => !o.you);
const mates = [];
others.forEach((o, i) => {
  if (i < 2) {
    o.dist = race.you.dist + (i + 1) * 2.4;      // strung out in front of you, drill-style
    o.x = race.you.x + (i % 2 ? 0.5 : -0.5);
    o.speed = race.you.speed;
    o.plan = { k: 'raid', at: 0.05, kick: 400 };
    mates.push(o);
  } else {
    o.dist = race.you.dist - 300;                // the bunch, far back
  }
});
const A = mates[1];  // furthest ahead, first on the front
const B = mates[0];  // between A and you

// A sitting-in player: pedals just enough to hold the wheel, never surges through.
function policy(r) {
  const ahead = Math.max(A.dist, B.dist) - r.you.dist;
  const rate = ahead > 5 ? 5.0 : ahead > 2.5 ? 3.6 : 2.6;
  return { rate, ease: false, launch: false, stumble: false, tx: r.you.x };
}

let lastFront = null, log = [], cueT = null;
const pulls = { [A.name]: 0, [B.name]: 0, YOU: 0 };  // completed pulls (turnT reached turnLen)
const pulling = {};
// The drill's per-frame HOLD, verbatim: break pinned around the player, bunch held back.
function hold(r) {
  const y = r.you, ms = r.riders.filter(o => !o.you).slice(0, 2);
  ms.forEach((o, i) => {
    const want = y.dist + (o.dist > y.dist ? 2.2 + i * 2.2 : -(2.2 + i * 2.2));
    if (Math.abs(o.dist - want) > 9) { o.dist = want; o.prev = want; }
    o.speed = Math.max(y.speed * 0.94, Math.min(y.speed * 1.06, o.speed));
  });
  for (const o of r.riders.filter(o => !o.you).slice(2)) {
    if (o.dist > y.dist - 140) { o.dist = y.dist - 200; o.prev = o.dist; o.speed = y.speed * 0.9; }
  }
}
for (let g = 0; g < 120 * 25; g++) {
  hold(race);
  Sim.step(race, CFG.fixedDt, policy(race));
  const t = (g / 120).toFixed(2);
  const f = race.breakFront;
  if (f && f !== lastFront) { log.push(t + 's  front -> ' + f.name); lastFront = f; }
  for (const r of [A, B, race.you]) {
    const nm = r.you ? 'YOU' : r.name;
    if ((r.turnT || 0) > CFG.turnLen && !pulling[nm]) { pulling[nm] = true; pulls[nm]++; log.push(t + 's  ' + nm + ' completed a full pull'); }
    if ((r.turnT || 0) === 0) pulling[nm] = false;
  }
  while (race.events.length) {
    const ev = race.events.shift();
    log.push(t + 's  EVENT: ' + ev.t);
    if (ev.t.startsWith('YOUR TURN') && cueT === null) {
      cueT = +t;
      log.push('      at cue: pulls so far  A(' + A.name + ')=' + pulls[A.name] + '  B(' + B.name + ')=' + pulls[B.name]);
    }
  }
  if (cueT !== null && +t > cueT + 2) break;
}
console.log(log.join('\n'));
console.log('---');
if (cueT === null) { console.log('FAIL: cue never fired in 25s'); process.exit(1); }
if (pulls[A.name] >= 1 && pulls[B.name] >= 1) console.log('PASS: cue at ' + cueT + 's, AFTER both riders ahead had pulled');
else { console.log('FAIL: cue at ' + cueT + 's fired before rider B pulled (A=' + pulls[A.name] + ', B=' + pulls[B.name] + ')'); process.exit(1); }
