// MECHANIC: sprint deviation. Promise: in the closing sprint you may hold your line,
// but a sustained move INTO a rider close enough to be affected forfeits the result
// and fines you ("OFF YOUR LINE"); the same sprint ridden straight is clean.
const Sim = require('../sim.js');
const { CFG } = Sim;
function run(swerve) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed: 8, stageIndex: 3, playerType: 'rouleur', gc, leaders: {}, div: 4 });
  race.course.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
  const c = race.course;
  for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
  for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
  c.eMin = 0; c.eMax = 40; c.bend = { a: 0, f: 1, p: 0 }; c.swAmp = 0;
  c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.items = []; c.feeds = []; c.litters = [];
  c.primes = [{ d: c.len, kind: 'finish', pts: [12, 9, 7, 5, 3, 2, 1], crossed: [] }];
  const others = race.riders.filter(o => !o.you);
  const rival = others[0];
  // both contesting the finale, side by side, inside the sprint zone
  const start = c.len - 170;
  race.you.dist = start; race.you.prev = start; race.you.x = -0.6; race.you.speed = 13;
  rival.dist = start - 0.2; rival.prev = rival.dist; rival.x = 2.0; rival.speed = 13;
  rival.plan = { k: 'sprint', at: 0.9, kick: 400 };
  for (const o of others.slice(1)) { o.dist = start - 600; o.prev = o.dist; }
  let offLine = false;
  let g = 0;
  while (!race.you.finished && g++ < 120 * 40) {
    // the rival contests to the line, glued alongside
    rival.x = 2.0; rival.tx = 2.0;
    rival.dist = race.you.dist + 0.3; rival.prev = rival.dist; rival.speed = race.you.speed;
    // the corridor is only enforced in the last ~20 before the line: hold your line
    // until inside it, then (dirty run) swerve across the rival
    const togo = c.len - race.you.dist;
    const tx = swerve && togo < 17 ? 3.2 : -0.6;
    Sim.step(race, CFG.fixedDt, { rate: 5.5, ease: false, launch: false, stumble: false, tx });
    while (race.events.length) {
      const ev = race.events.shift();
      if (ev.t === 'OFF YOUR LINE') offLine = true;
    }
  }
  return { offLine, penalties: race.you.penalties.length };
}
const dirty = run(true), clean = run(false);
console.log('swerving: OFF YOUR LINE=' + dirty.offLine + ', penalties=' + dirty.penalties + '  |  straight: OFF YOUR LINE=' + clean.offLine + ', penalties=' + clean.penalties);
if (!dirty.offLine || dirty.penalties < 1) { console.log('FAIL: swerving across a contesting rival was not punished'); process.exit(1); }
if (clean.offLine || clean.penalties > 0) { console.log('FAIL: riding your own line was punished'); process.exit(1); }
console.log('PASS: hold your line and you are fine; move into a rival and you are relegated');
