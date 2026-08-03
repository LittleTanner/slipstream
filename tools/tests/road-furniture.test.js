// MECHANIC: road furniture. Promises tested: (a) rough surfaces drag — the same rider
// at the same effort is slower on cobbles than on clean asphalt; (b) a narrow pinches
// the usable road — edgeAt shrinks through it and the field funnels inside the edge.
const Sim = require('../sim.js');
const { CFG } = Sim;
function flat(race) {
  race.course.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
  const c = race.course;
  for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
  for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
  c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
  c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.items = []; c.feeds = []; c.litters = [];
  return c;
}
function mk() {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  return Sim.createRace({ seed: 8, stageIndex: 3, playerType: 'rouleur', gc, leaders: {}, div: 4 });
}
// (a) surface drag
function ride(surface) {
  const race = mk(); const c = flat(race);
  if (surface) c.surfaces = [{ s: race.you.dist + 50, e: race.you.dist + 5000, kind: surface, sev: 1 }];
  for (const o of race.riders) if (!o.you) o.dist = race.you.dist - 400;
  for (let g = 0; g < 120 * 20; g++) Sim.step(race, CFG.fixedDt, { rate: 3.0, ease: false, launch: false, stumble: false, tx: 0 });
  return race.you.dist;
}
const clean = ride(null), cobbled = ride('cobbles');
console.log('20s at the same effort: asphalt ' + clean.toFixed(0) + ' vs cobbles ' + cobbled.toFixed(0));
if (cobbled >= clean - 5) { console.log('FAIL: cobbles did not drag'); process.exit(1); }
// (b) narrows funnel the road
{
  const race = mk(); const c = flat(race);
  const at = race.you.dist + 150;
  c.narrows = [{ s: at, e: at + 120, w: 3.6, taper: 110 }];
  const wide = Sim.edgeAt(c, race.you.dist), pinch = Sim.edgeAt(c, at + 60);
  console.log('edge: open road ' + wide.toFixed(2) + ' vs inside the narrow ' + pinch.toFixed(2));
  if (!(pinch < wide - 0.8)) { console.log('FAIL: the narrow did not pinch the road'); process.exit(1); }
  // ride the field through it: nobody may sit outside the pinched edge
  race.you.you = false; race.you.plan = { k: 'raid', at: 0.99, kick: 400 };
  for (const o of race.riders) if (!o.you) { o.plan = { k: 'raid', at: 0.99, kick: 400 }; }
  let worst = 0;
  for (let g = 0; g < 120 * 40; g++) {
    Sim.step(race, CFG.fixedDt, null);
    for (const r of race.riders) {
      if (r.dist > at + 10 && r.dist < at + 110) worst = Math.max(worst, Math.abs(r.x) - Sim.edgeAt(c, r.dist));
    }
  }
  console.log('worst overrun beyond the pinched edge: ' + worst.toFixed(2));
  if (worst > 0.6) { console.log('FAIL: riders sat ' + worst.toFixed(2) + ' outside the narrowed road'); process.exit(1); }
}
console.log('PASS: cobbles drag and narrows funnel the field');
