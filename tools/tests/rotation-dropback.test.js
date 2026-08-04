// Kevin: "when you pull off and soft pedal you should drop back much faster — it's
// like it's capping you from slowing down." Measures GOOD TURN -> at-the-back time
// per lap in the drill (hold with the new free-train exemption while returning).
const Sim = require('../sim.js');
const { CFG } = Sim;
const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
const race = Sim.createRace({ seed: 7, stageIndex: 0, playerType: 'rouleur', gc, leaders: {}, div: 4 });
// MATCH THE PLAYER TO THE FIELD. Rivals harden with the division across every dimension,
// so an undeveloped rider dropped into a Division 4 break is simply outmatched and what
// this measures becomes the mismatch rather than the rotation. Give the player the same
// division-appropriate body their mates have, so the rotation is tested between peers.
for (const k in Sim.rivalBody('rouleur', race.D.t)) {
  const v = Sim.rivalBody('rouleur', race.D.t)[k];
  race.you.stats[k] = (race.you.stats[k] === undefined ? 0 : race.you.stats[k]) + v;
}
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
let mode = 'sit', goodAt = null, drops = [], fails = [];
for (let g = 0; g < 120 * 200; g++) {
  const you = race.you;
  let rate, tx = you.x;
  const ahead = Math.max(mates[0].dist, mates[1].dist) - you.dist;
  if (mode === 'sit') rate = ahead > 5 ? 5.0 : ahead > 2.5 ? 3.6 : 2.6;
  else if (mode === 'through') { rate = 5.5; tx = cl(-race.swingSide * 1.55); }
  else if (mode === 'pull') { rate = 3.4; tx = cl(-race.swingSide * 0.45); }
  else { rate = 0.8; tx = cl(you.x + race.swingSide * 0.06); }
  hold(race);
  Sim.step(race, CFG.fixedDt, { rate, ease: mode === 'ease', launch: false, stumble: false, tx });
  const t = +(g / 120).toFixed(2);
  while (race.events.length) {
    const ev = race.events.shift();
    if (ev.t.startsWith('YOUR TURN')) mode = 'through';
    if (ev.t.startsWith('GOOD TURN')) { mode = 'ease'; goodAt = t; }
  }
  if (mode === 'through' && race.breakFront === race.you) mode = 'pull';
  if (goodAt !== null && race.youWasBack === true) {
    drops.push(+(t - goodAt).toFixed(1));
    console.log('lap ' + drops.length + ': GOOD TURN -> at the back in ' + (t - goodAt).toFixed(1) + 's');
    goodAt = null;
  }
  if (mode === 'ease' && race.youWasBack === true) mode = 'sit';
}
console.log('---');
if (drops.length < 3) fails.push('only ' + drops.length + ' completed drop-backs in 200s');
drops.forEach((d, i) => {
  // the first lap absorbs the spawn/opening chaos (the scripted first pull gaps the
  // mates before the rotation has formed); steady-state laps are the measurement
  const lim = i === 0 ? 16 : 7;
  if (d > lim) fails.push('drop-back ' + (i + 1) + ' took ' + d + 's (limit ' + lim + ')');
});
if (fails.length) { console.log('FAIL:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('PASS: ' + drops.length + ' drop-backs, ' + Math.min(...drops) + '-' + Math.max(...drops) + 's each');
