// MECHANIC: wheel-suck escalation. Promise: a player who is CALLED and refuses gets the
// elbow flick, and if they keep refusing the break sits up — but a player merely waiting
// their turn is never punished (the audit's false-flick bug).
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
others.forEach((o, i) => {
  if (i < 2) { o.dist = race.you.dist + (i + 1) * 2.4; o.x = race.you.x + (i % 2 ? 0.5 : -0.5); o.speed = race.you.speed; o.plan = { k: 'raid', at: 0.99, kick: 400 }; }
  else o.dist = race.you.dist - 300;
});
const A = others[1], B = others[0];
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
let calledAt = null, flickAt = null, satUpAt = null;
for (let g = 0; g < 120 * 150; g++) {
  const ahead = Math.max(A.dist, B.dist) - race.you.dist;
  // a TRUE wheel-sucker: fight to hold the wheel, but the moment they would inherit
  // the front, sit up — never, ever pull
  const rate = ahead < 1.2 ? 0.4 : ahead > 5 ? 5.2 : 4.2;
  hold(race);
  Sim.step(race, CFG.fixedDt, { rate, ease: false, launch: false, stumble: false, tx: race.you.x });
  const t = g / 120;
  while (race.events.length) {
    const ev = race.events.shift();
    if (ev.t.startsWith('YOUR TURN') && calledAt === null) calledAt = t;
    if (ev.t === 'COME THROUGH' && flickAt === null) {
      flickAt = t;
      if (calledAt === null) { console.log('FAIL: flicked at ' + t.toFixed(1) + 's without ever being called'); process.exit(1); }
    }
  }
  if (race.breakSitUp && satUpAt === null) satUpAt = t;
}
console.log('called at ' + (calledAt && calledAt.toFixed(1)) + 's, flicked at ' + (flickAt && flickAt.toFixed(1)) + 's, break sat up at ' + (satUpAt && satUpAt.toFixed(1)) + 's');
if (calledAt === null) { console.log('FAIL: refusing player was never even called'); process.exit(1); }
if (flickAt === null) { console.log('FAIL: refusing player never got the elbow flick'); process.exit(1); }
if (satUpAt === null) { console.log('FAIL: break never sat up around a refusing player'); process.exit(1); }
if (!(calledAt < flickAt && flickAt < satUpAt)) { console.log('FAIL: escalation out of order'); process.exit(1); }
console.log('PASS: call, then elbow, then the shelter evaporates — in that order');
