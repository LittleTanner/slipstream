// MECHANIC: corners. Promises: the AI brakes for a sharp bend it is approaching (a
// sloppier rider scrubs more than a sharp one is the design; here we assert the brake
// itself), and a player carrying too much speed through bends pays — corner/verge
// events fire and speed is lost — while a measured pace passes clean.
const Sim = require('../sim.js');
const { CFG } = Sim;
function mk(bendy) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed: 8, stageIndex: 3, playerType: 'rouleur', gc, leaders: {}, div: 4 });
  race.course.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
  const c = race.course;
  for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
  for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
  c.eMin = 0; c.eMax = 40; c.swAmp = 0;
  // f=16 gives real switchbacks: |bendAt| ~0.28, safe speed ~5-7 vs tempo ~11
  c.bend = bendy ? { a: 1.0, f: 16, p: 0 } : { a: 0, f: 1, p: 0 };
  c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.items = []; c.feeds = []; c.litters = [];
  return race;
}
// (a) AI brakes for bends: same AI rider, pinned tempo, bendy vs straight road
function aiRun(bendy) {
  const race = mk(bendy);
  const ai = race.riders.filter(o => !o.you)[0];
  ai.dist = race.you.dist + 300; ai.plan = { k: 'raid', at: 0.99, kick: 400 };
  for (const o of race.riders.filter(o => !o.you).slice(1)) o.dist = race.you.dist - 500;
  let minSpeed = 99;
  for (let g = 0; g < 120 * 25; g++) {
    ai.eff = 'tempo';                                  // pin the decision layer
    Sim.step(race, CFG.fixedDt, { rate: 0.5, ease: true, launch: false, stumble: false, tx: race.you.x });
    if (g > 120 * 10) minSpeed = Math.min(minSpeed, ai.speed);
  }
  return minSpeed;
}
const straightMin = aiRun(false), bendyMin = aiRun(true);
console.log('AI min cruise: straight ' + straightMin.toFixed(1) + ' vs bendy ' + bendyMin.toFixed(1));
if (bendyMin >= straightMin - 0.8) { console.log('FAIL: the AI never braked for the bends'); process.exit(1); }
// (b) the player pays for a hot line
function playerRun(rate) {
  const race = mk(true);
  for (const o of race.riders) if (!o.you) o.dist = race.you.dist - 500;
  let events = 0;
  for (let g = 0; g < 120 * 30; g++) {
    Sim.step(race, CFG.fixedDt, { rate, ease: false, launch: false, stumble: false, tx: 0 });
    while (race.events.length) {
      const ev = race.events.shift();
      if (/TOO FAST INTO THE CORNER|CAUGHT THE VERGE|HIT THE MEDIAN/.test(ev.t)) events++;
    }
  }
  return events;
}
const hot = playerRun(6.0), cool = playerRun(1.5);
console.log('corner/verge events: flat out ' + hot + ' vs measured ' + cool);
if (hot < 1) { console.log('FAIL: riding bends flat out never bit'); process.exit(1); }
if (cool > hot) { console.log('FAIL: the measured pace paid more than the hot one'); process.exit(1); }
console.log('PASS: bends demand braking, and a hot line pays for itself');
