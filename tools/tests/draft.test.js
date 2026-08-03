// MECHANIC: drafting. Promise: sitting in a wheel's shelter is cheaper than riding the
// same effort in clean air — the follower arrives fresher than the leader.
const Sim = require('../sim.js');
const { CFG } = Sim;
const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
const race = Sim.createRace({ seed: 3, stageIndex: 3, playerType: 'rouleur', gc, leaders: {}, div: 4 });
race.course.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
const c = race.course;
for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.items = []; c.feeds = []; c.litters = [];
// leader and follower, identical efforts; everyone else far away
const others = race.riders.filter(o => !o.you);
const lead = others[0], tail = others[1];
lead.dist = race.you.dist + 200; tail.dist = lead.dist - 1.4; tail.x = lead.x = 0;
lead.speed = tail.speed = 11; lead.plan = tail.plan = { k: 'raid', at: 0.99, kick: 400 };
for (const o of others.slice(2)) o.dist = race.you.dist - 400;
let qSum = 0, n = 0;
for (let g = 0; g < 120 * 30; g++) {
  lead.eff = 'tempo'; tail.eff = 'tempo';         // pin the decision layer: same effort
  Sim.step(race, CFG.fixedDt, { rate: 0, ease: true, launch: false, stumble: false, tx: race.you.x });
  // keep the pair glued longitudinally so only the AERO difference accumulates
  if (tail.dist < lead.dist - 3.5) { tail.dist = lead.dist - 1.6; tail.prev = tail.dist; }
  if (tail.dist > lead.dist - 0.9) { tail.dist = lead.dist - 1.4; tail.prev = tail.dist; }
  tail.x = lead.x;                                 // stay square in the shelter
  qSum += tail.q; n++;
}
const avgQ = qSum / n;
const drainLead = 100 - lead.energy, drainTail = 100 - tail.energy;
console.log('follower avg shelter q=' + avgQ.toFixed(2) + '  energy drain: leader ' + drainLead.toFixed(1) + ' vs follower ' + drainTail.toFixed(1));
if (avgQ < 0.25) { console.log('FAIL: follower never got meaningful shelter'); process.exit(1); }
if (drainTail >= drainLead) { console.log('FAIL: drafting did not reduce energy drain'); process.exit(1); }
console.log('PASS: shelter is real and cheaper');
