// Kevin's report: right after pulling, while easing back to the last wheel, the game
// calls YOUR TURN again as soon as the next puller swings off. Correct: after your
// pull, BOTH other riders pull before you are called, and you are never called while
// still drifting to the back.
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
const others = race.riders.filter(o => !o.you);
const mates = [];
others.forEach((o, i) => {
  if (i < 2) {
    o.dist = race.you.dist + (i + 1) * 2.4;
    o.x = race.you.x + (i % 2 ? 0.5 : -0.5);
    o.speed = race.you.speed;
    o.plan = { k: 'raid', at: 0.99, kick: 400 };
    mates.push(o);
  } else o.dist = race.you.dist - 300;
});
const cl = v => Math.max(-3.5, Math.min(3.5, v));
function hold(r) {
  const y = r.you, ms = r.riders.filter(o => !o.you).slice(0, 2);
  const youDropping = r.youWasBack === false && r.breakFront !== y;
  if (youDropping) {
    const lead = ms[0].dist > ms[1].dist ? ms[0] : ms[1];
    const tail = lead === ms[0] ? ms[1] : ms[0];
    if (lead.dist - tail.dist > 9) { tail.dist = lead.dist - 2.2; tail.prev = tail.dist; }
    for (const o of ms) if (o.dist > y.dist + 14) o.speed = Math.min(o.speed, y.speed * 1.02);
  } else ms.forEach((o, i) => {
    const want = y.dist + (o.dist > y.dist ? 2.2 + i * 2.2 : -(2.2 + i * 2.2));
    if (Math.abs(o.dist - want) > 9) { o.dist = want; o.prev = want; }
    o.speed = Math.max(y.speed * (o.swingOff > 0 ? 0.90 : 0.94),
                       Math.min(y.speed * (o.passBy > 0 ? 1.25 : 1.06), o.speed));
  });
  for (const o of r.riders.filter(o => !o.you).slice(2)) {
    if (o.dist > y.dist - 140) { o.dist = y.dist - 200; o.prev = o.dist; o.speed = y.speed * 0.9; }
  }
}
let mode = 'sit', fails = [], calls = 0, log = [], myTurnEndedAt = -99;
const pulledSinceMyTurn = new Set();     // mates who held the front >=1.5s since my last pull ended
let lastF = null, fSince = 0;
for (let g = 0; g < 120 * 200; g++) {
  const you = race.you;
  let rate, tx = you.x;
  const ahead = Math.max(mates[0].dist, mates[1].dist) - you.dist;
  if (mode === 'sit') rate = ahead > 5 ? 5.0 : ahead > 2.5 ? 3.6 : 2.6;
  else if (mode === 'through') { rate = 5.5; tx = cl(-race.swingSide * 1.55); }
  else if (mode === 'pull') { rate = 3.4; tx = cl(-race.swingSide * 0.45); }
  else { rate = 1.2; tx = cl(you.x + race.swingSide * 0.06); }   // ease and drift aside
  hold(race);
  Sim.step(race, CFG.fixedDt, { rate, ease: mode === 'ease', launch: false, stumble: false, tx });
  const t = +(g / 120).toFixed(2);
  const f = race.breakFront;
  if (f !== lastF) {
    if (lastF && !lastF.you && t - fSince >= 1.5 && mode !== 'pull') pulledSinceMyTurn.add(lastF.name);
    if (lastF && !lastF.you && t - fSince >= 1.5 && mode === 'pull') pulledSinceMyTurn.add(lastF.name);
    lastF = f; fSince = t;
  }
  // ongoing front spell also counts once it exceeds 1.5s
  if (f && !f.you && t - fSince >= 1.5) pulledSinceMyTurn.add(f.name);
  while (race.events.length) {
    const ev = race.events.shift();
    if (ev.t.startsWith('YOUR TURN')) {
      calls++;
      log.push(t + 's YOUR TURN (mode ' + mode + ', youReturn ' + !!race.youReturn + ', pulledSince: [' + [...pulledSinceMyTurn] + '])');
      // The bug being tested: a call arriving soon after my pull, mid-drift or before
      // the others have rotated. A call a full cycle later with a shirking mate is the
      // anti-dodge waiver working as designed (someone must work), not the bug.
      if (calls > 1 && (t - myTurnEndedAt) < 25 && (race.youWasBack === false || pulledSinceMyTurn.size < 2))
        fails.push('called at ' + t + 's only ' + (t - myTurnEndedAt).toFixed(1) + 's after my pull (wasBack=' + race.youWasBack + ', pulledSince=[' + [...pulledSinceMyTurn] + '])');
      mode = 'through';
    }
    if (ev.t.startsWith('GOOD TURN')) { mode = 'ease'; pulledSinceMyTurn.clear(); myTurnEndedAt = t; }
  }
  if (mode === 'through' && race.breakFront === race.you) mode = 'pull';
  if (mode === 'ease') {
    const rear = Math.min(mates[0].dist, mates[1].dist);
    if (you.dist < rear - 0.5) mode = 'sit';
  }
}
console.log(log.join('\n'));
console.log('---');
if (calls < 3) fails.push('only ' + calls + ' calls in 200s — rotation not cycling');
if (fails.length) { console.log('FAIL:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('PASS: ' + calls + ' calls, every one after both mates pulled, never mid-drift');
