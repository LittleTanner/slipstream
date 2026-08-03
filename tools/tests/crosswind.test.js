// MECHANIC: crosswind shelter. Promise (DECISIONS.md, "verified true in the sim"):
// in a crosswind the best shelter sits OFF TO ONE SIDE of the wheel ahead, not
// directly behind it.
const Sim = require('../sim.js');
const { CFG } = Sim;
function shelterAt(offsetX) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed: 3, stageIndex: 3, playerType: 'rouleur', gc, leaders: {}, div: 4 });
  const c = race.course;
  for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
  for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
  c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
  c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.items = []; c.feeds = []; c.litters = [];
  c.winds = [{ d: -1e6, dir: 1, str: 0.9 }, { d: 1e9, dir: 1, str: 0.9 }];  // hard side wind
  const others = race.riders.filter(o => !o.you);
  const lead = others[0], tail = others[1];
  lead.dist = race.you.dist + 200; lead.x = 0; lead.speed = 11;
  tail.dist = lead.dist - 1.4; tail.speed = 11;
  lead.plan = tail.plan = { k: 'raid', at: 0.99, kick: 400 };
  for (const o of others.slice(2)) o.dist = race.you.dist - 400;
  let qSum = 0, n = 0;
  for (let g = 0; g < 120 * 8; g++) {
    lead.eff = 'tempo'; tail.eff = 'tempo';
    Sim.step(race, CFG.fixedDt, { rate: 0, ease: true, launch: false, stumble: false, tx: race.you.x });
    if (tail.dist < lead.dist - 3.5 || tail.dist > lead.dist - 0.9) { tail.dist = lead.dist - 1.4; tail.prev = tail.dist; }
    lead.x = 0; tail.x = offsetX;                        // this is a geometry probe: pin both
    if (g > 120) { qSum += tail.q; n++; }                // let it settle first
  }
  return qSum / n;
}
const offsets = [-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5];
const qs = offsets.map(shelterAt);
let bestI = 0; qs.forEach((q, i) => { if (q > qs[bestI]) bestI = i; });
console.log(offsets.map((o, i) => o + ':' + qs[i].toFixed(2)).join('  '));
const behind = qs[offsets.indexOf(0)];
if (qs[bestI] < 0.15) { console.log('FAIL: no meaningful shelter anywhere in a crosswind'); process.exit(1); }
if (offsets[bestI] === 0 || qs[bestI] <= behind + 0.05) { console.log('FAIL: best shelter is not offset to the side'); process.exit(1); }
console.log('PASS: best shelter sits ' + offsets[bestI] + ' to the side of the wheel, not behind it');
