// MECHANIC: team car tow. Promise: a rider dropped by a mechanical gets paced back —
// once the wheel is changed (flat done) and the bunch is up the road, the car engages
// (r.tow > 0, TEAM CAR), pulls the rider at towSpeed above the peloton's pace, and
// delivers them to the TAIL of the group and no further forward (BACK ON), all inside
// towMax. Holding the car's shelter the whole way means rejoining with legs intact.
// Setup replicates the tutorial 'car' drill mid-race (index.html id:"car"): a bunch
// pinned at tempo up the road, then y.flat = 5.0; y.needTow = true. A control run
// takes the same puncture with no tow, and must be left far behind.
const Sim = require('../sim.js');
const { CFG } = Sim;

function runScenario(withTow) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed: 11, stageIndex: 3, playerType: 'rouleur', gc, leaders: {}, div: 8 });
  const c = race.course;
  race.course.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
  for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
  for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
  c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
  c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.items = []; c.feeds = []; c.litters = [];
  race.pacer.gone = true;                 // the PACE car's slipstream is a different mechanic: keep it out
  const y = race.you;
  const others = race.riders.filter(o => !o.you);
  others.forEach((o, i) => {              // the drill's bunch: something up the road to be paced back TO
    o.dist = y.dist + 9 + (i % 3) * 2.4;
    o.x = ((i % 4) - 1.5) * 1.5;
    o.speed = y.speed;
    o.plan = { k: 'raid', at: 0.99, kick: 400 };
  });
  const hold = () => {                    // the drill's hold(): the bunch rides ON, and away
    for (const o of others) {
      o.eff = 'tempo';
      o.speed = CFG.base * 1.02;
      o.energy = o.legCap; o.fuel = 100; o.fluid = 100;
      if (o.dist < y.dist - 60) { o.dist = y.dist + 40; o.prev = o.dist; }
    }
  };
  const out = { everTow: false, teamCar: false, backOn: null, towStartT: null, towEndT: null,
                gapStart: null, gapEnd: null, heldRatio: null, gapAt: [] };
  const drain = () => {
    while (race.events.length) {
      const ev = race.events.shift();
      if (ev.t === 'TEAM CAR') out.teamCar = true;
      if (ev.t.startsWith('BACK ON') && out.backOn === null) out.backOn = ev.t;
    }
  };
  const pol = () => ({ rate: 2.0, ease: false, launch: false, stumble: false,
                       tx: y.towX === undefined ? 0 : y.towX });   // steer at the car when it is there
  for (let g = 0; g < 240; g++) { hold(); Sim.step(race, CFG.fixedDt, pol()); drain(); }
  y.flat = 5.0;                           // the drill's puncture, mid-race
  if (withTow) y.needTow = true;
  for (let g = 0; g < 120 * 45; g++) {
    hold();
    Sim.step(race, CFG.fixedDt, pol());
    const t = g / 120;
    const gap = race.pelotonHead - y.dist;
    if (g % 120 === 0) out.gapAt.push(gap);            // one sample per second, index = second
    if (y.tow > 0) {
      out.everTow = true;
      if (out.towStartT === null) { out.towStartT = t; out.gapStart = gap; }
      if (y.towTime > 0.5) out.heldRatio = y.towHeld / y.towTime;
      // pin geometry: sit square in the car's shelter (towX exists from the frame
      // AFTER the tow engages — the tow block runs before the needTow branch)
      if (y.towX !== undefined) { y.x = y.towX; y.vx = 0; }
    } else if (out.towStartT !== null && out.towEndT === null) {
      out.towEndT = t; out.gapEnd = gap;
    }
    drain();
  }
  return out;
}

const A = runScenario(true);              // punctured, wheel changed, car called
const B = runScenario(false);             // same puncture, no car: chases alone

const dur = A.towStartT !== null && A.towEndT !== null ? A.towEndT - A.towStartT : null;
console.log('tow ' + (A.towStartT === null ? 'never engaged'
  : 'engaged at ' + A.towStartT.toFixed(1) + 's, ended at ' + (A.towEndT === null ? 'NEVER' : A.towEndT.toFixed(1) + 's')));
console.log('gap at tow start ' + (A.gapStart === null ? '-' : A.gapStart.toFixed(1) + 'm')
  + ', at tow end ' + (A.gapEnd === null ? '-' : A.gapEnd.toFixed(1) + 'm')
  + ', control at same moment ' + (A.towEndT === null ? '-' : (B.gapAt[Math.round(A.towEndT)] || 0).toFixed(1) + 'm'));
console.log('shelter held ' + (A.heldRatio === null ? '-' : Math.round(A.heldRatio * 100) + '%')
  + ', delivery: ' + A.backOn);

if (!A.everTow || !A.teamCar) { console.log('FAIL: tow never engaged (no r.tow > 0 / no TEAM CAR event)'); process.exit(1); }
if (B.everTow || B.teamCar) { console.log('FAIL: control rider without needTow got a tow'); process.exit(1); }
if (A.towEndT === null) { console.log('FAIL: tow never ended'); process.exit(1); }
if (dur > CFG.towMax + 0.5) { console.log('FAIL: tow outlived towMax (' + dur.toFixed(1) + 's)'); process.exit(1); }
if (A.gapStart - A.gapEnd < 15) { console.log('FAIL: tow barely closed the gap (' + (A.gapStart - A.gapEnd).toFixed(1) + 'm)'); process.exit(1); }
const gapB = B.gapAt[Math.round(A.towEndT)];
if (!(gapB - A.gapEnd >= 12)) { console.log('FAIL: towed rider no closer than the control chasing alone'); process.exit(1); }
if (A.backOn === null) { console.log('FAIL: tow ended without delivery (no BACK ON)'); process.exit(1); }
// Delivered to the tail of the group and no further forward: 26 + 24 * D.t back from the head
const slot = 26 + 24 * Sim.tierProfile(8).t;
if (A.gapEnd > slot + 3) { console.log('FAIL: delivered ' + A.gapEnd.toFixed(1) + 'm back, tail slot is ' + slot + 'm'); process.exit(1); }
if (A.gapEnd < slot - 8) { console.log('FAIL: delivered past the tail slot (' + A.gapEnd.toFixed(1) + 'm vs ' + slot + 'm)'); process.exit(1); }
if (A.heldRatio === null || A.heldRatio < 0.85) { console.log('FAIL: pinned in the car\'s shelter yet towHeld never accrued'); process.exit(1); }
if (!/LEGS INTACT/.test(A.backOn)) { console.log('FAIL: held the shelter the whole tow but not credited (' + A.backOn + ')'); process.exit(1); }
console.log('PASS: the car comes, paces you to the tail of the bunch, and holding its wheel pays');
