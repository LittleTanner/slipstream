// MECHANIC: crashes. Promises: hitting the road furniture hard puts the PLAYER down —
// speed collapses, the DOWN state runs its clock, the team car is needed — and the
// same impact at low speed is just a scrape. (Race-ending crashes exist at div<=outDiv;
// the +9999 sentinel in the golden covers that path.)
const Sim = require('../sim.js');
const { CFG } = Sim;
function run(fast) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed: 8, stageIndex: 3, playerType: 'rouleur', gc, leaders: {}, div: 4 });
  race.course.winds = [{ d: -1e6, dir: 0, str: 0 }, { d: 1e9, dir: 0, str: 0 }];
  const c = race.course;
  for (let i = 0; i < c.grades.length; i++) c.grades[i] = 0;
  for (let i = 0; i < c.elev.length; i++) c.elev[i] = 0;
  c.eMin = 0; c.eMax = 40; c.swAmp = 0;
  // the input pipeline CLAMPS tx to the road edge, so you cannot steer into the verge —
  // you have to be CARRIED into it, which is what switchbacks at speed do
  c.bend = { a: 1.0, f: 16, p: 0 };
  c.rounds = []; c.narrows = []; c.hazards = []; c.surfaces = []; c.primes = []; c.items = []; c.feeds = []; c.litters = [];
  for (const o of race.riders) if (!o.you) o.dist = race.you.dist - 500;
  // ride the switchbacks holding a fixed line: at full gas the drift carries you out
  let speedAt = 0, events = 0, wentDown = false;
  for (let g = 0; g < 120 * 30; g++) {
    speedAt = Math.max(speedAt, race.you.speed);
    Sim.step(race, CFG.fixedDt, { rate: fast ? 6.0 : 1.0, ease: false, launch: false, stumble: false, tx: 0, hardTurn: fast ? 1 : 0 });
    while (race.events.length) {
      const ev = race.events.shift();
      if (/TOO FAST INTO THE CORNER|CAUGHT THE VERGE|HIT THE MEDIAN|RACE OVER/.test(ev.t)) events++;
    }
    if (race.you.down > 0) wentDown = true;
  }
  return { speedAt, events, wentDown, needTow: race.you.needTow };
}
const hot = run(true), slow = run(false);
console.log('peak ' + hot.speedAt.toFixed(1) + ': ' + hot.events + ' impacts, down=' + hot.wentDown + ', needTow=' + hot.needTow
  + '  |  peak ' + slow.speedAt.toFixed(1) + ': ' + slow.events + ' impacts, down=' + slow.wentDown);
if (hot.events < 1) { console.log('FAIL: driving into the verge at speed never registered an impact'); process.exit(1); }
if (!hot.wentDown) { console.log('FAIL: a full-speed, full-lean verge hit never put the rider down'); process.exit(1); }
if (slow.wentDown) { console.log('FAIL: a crawling verge touch should be a scrape, not a crash'); process.exit(1); }
console.log('PASS: speed plus lean crashes you, a crawl only scrapes');
