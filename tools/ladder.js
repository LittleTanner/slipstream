// Ladder harness: does getting stronger CHANGE ANYTHING against the rivals?
//
// dominance.js asks "is any part best everywhere". This asks the other balance
// question, the one Kevin raised: you grow a career, you climb the divisions, and if
// the rivals harden at exactly your rate then your place never moves and the whole
// career is a treadmill. The grid is DIVISION x PLAYER DEVELOPMENT, and what matters
// is the SPREAD DOWN EACH COLUMN — how many places you gain by developing, at that
// division. A flat column is a treadmill; a steep one is a career.
//
// Same engine as dominance.js: the sim's own AI drives the player (flip `you`, hand it
// a plan) so every stat expresses, score is finishing place with the time gap as a
// tiebreak, and the races fan out over worker_threads.
//
// `LAD_SEEDS=11,23,37,52,71,89 node tools/ladder.js` widens it; LAD_SERIAL=1 forces
// the serial path.
const { Worker, isMainThread, parentPort } = require('worker_threads');
const os = require('os');
const Sim = require('./sim.js');
const P = require('./parts.js');

const TEMPLATES = [0, 1, 2, 3, 4];
const TNAME = ['flat', 'hills', 'mtn', 'panflat', 'queen'];
const TERRAIN_PLAN = ['sprint', 'diesel', 'climb', 'sprint', 'climb'];
const SEEDS = (process.env.LAD_SEEDS || '11,23,37').split(',').map(Number);
const DIVS = [8, 7, 6, 5, 4, 3, 2, 1];
// How developed the player is, on the same 0..1 scale the rivals use. 0 is the rider
// you create on day one; 1 is a fully grown career.
const DEV = [0, 0.25, 0.5, 0.75, 1];

// The player grows the same six dimensions the rivals do, so a like-for-like
// comparison uses the sim's own table rather than a fourth copy of it. A player who
// races everything develops broadly, which is what rivalBody's spread already models.
function playerBody(t) { return Sim.rivalBody('rouleur', t); }

function score(dev, div, seed, stageIndex) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed, stageIndex, playerType: 'rouleur', gc, leaders: {}, div });
  race.you.stats = P.buildStats(P.neutralBuild());
  const bd = playerBody(dev);
  for (const k in bd) race.you.stats[k] = (race.you.stats[k] === undefined ? 0 : race.you.stats[k]) + bd[k];
  race.you.you = false;
  race.you.plan = { k: TERRAIN_PLAN[stageIndex], at: 0.30, kick: 200 };
  let g = 0; while (!race.you.finished && g++ < 120 * 600) Sim.step(race, Sim.CFG.fixedDt, null);
  const order = Sim.settle(race); const you = order.find(o => o.name === 'YOU');
  return you.place + (you.time - order[0].time) / 100;
}
function avgScore(dev, div, stageIndex) {
  let s = 0; for (const seed of SEEDS) s += score(dev, div, seed, stageIndex);
  return s / SEEDS.length;
}

function report(cellFn) {
  // cell = average place over the five templates, so one number per (dev, div).
  const grid = {};
  for (const dev of DEV) {
    grid[dev] = {};
    for (const div of DIVS) {
      let s = 0; for (const ti of TEMPLATES) s += cellFn(dev, div, ti);
      grid[dev][div] = s / TEMPLATES.length;
    }
  }
  console.log('\n=== LADDER ===  avg finishing place over ' + TEMPLATES.length + ' templates x ' + SEEDS.length + ' seeds (lower is better)');
  console.log('  ' + 'dev'.padEnd(7) + DIVS.map(d => ('D' + d).padStart(8)).join(''));
  for (const dev of DEV)
    console.log('  ' + dev.toFixed(2).padEnd(7) + DIVS.map(d => grid[dev][d].toFixed(2).padStart(8)).join(''));
  // THE NUMBER THAT MATTERS. Places gained by going from raw to fully developed, at a
  // fixed division. If this is near zero the rivals are matching you step for step and
  // the career is decoration.
  console.log('  ' + '-'.repeat(7 + DIVS.length * 8));
  const lo = DEV[0], hi = DEV[DEV.length - 1];
  console.log('  ' + 'GAIN'.padEnd(7) + DIVS.map(d => (grid[lo][d] - grid[hi][d]).toFixed(2).padStart(8)).join(''));
  console.log('\n  GAIN = places you win by growing from ' + lo.toFixed(2) + ' to ' + hi.toFixed(2) + ' at that division.');
  console.log('  A career should FEEL like progress at every rung, so no column should be flat.');
  // And the diagonal: a rider who arrives at each division developed FOR that division,
  // which is the actual career path. Flat along here is correct (the ladder should stay
  // a contest); it is the columns that must not be flat.
  const diag = DIVS.map(d => {
    const t = Math.max(0, Math.min(1, (8 - d) / 7));
    let best = DEV[0], bd = Infinity;
    for (const dv of DEV) if (Math.abs(dv - t) < bd) { bd = Math.abs(dv - t); best = dv; }
    return grid[best][d];
  });
  console.log('\n  ' + 'ON PATH'.padEnd(7) + diag.map(v => v.toFixed(2).padStart(8)).join(''));
  console.log('  ON PATH = you arrived at each division developed for it. Should stay a contest (~3-5),');
  console.log('  never a walkover and never hopeless.');
}

function runSerial() { report((dev, div, ti) => avgScore(dev, div, ti)); }

function runParallel() {
  const tasks = [];
  for (const dev of DEV) for (const div of DIVS) for (const ti of TEMPLATES)
    for (let si = 0; si < SEEDS.length; si++) tasks.push({ id: tasks.length, dev, div, ti, seedIdx: si });
  const results = new Array(tasks.length);
  const nWorkers = Math.max(1, Math.min(os.availableParallelism(), tasks.length));
  let next = 0, done = 0;
  return new Promise((resolve, reject) => {
    const dispatch = (w) => { if (next < tasks.length) w.postMessage(tasks[next++]); else w.postMessage(null); };
    for (let i = 0; i < nWorkers; i++) {
      const w = new Worker(__filename);
      w.on('message', (m) => { results[m.id] = m.v; done++; dispatch(w); if (done === tasks.length) resolve(); });
      w.on('error', reject);
      w.on('exit', (code) => { if (code !== 0) reject(new Error('worker exited with code ' + code)); });
      dispatch(w);
    }
  }).then(() => {
    const cells = new Map();
    for (const t of tasks) {
      const key = t.dev + '|' + t.div + '|' + t.ti;
      if (t.seedIdx === 0) cells.set(key, 0);
      cells.set(key, cells.get(key) + results[t.id]);
    }
    for (const [key, sum] of cells) cells.set(key, sum / SEEDS.length);
    report((dev, div, ti) => cells.get(dev + '|' + div + '|' + ti));
  });
}

if (!isMainThread) {
  parentPort.on('message', (m) => {
    if (m === null) { parentPort.close(); return; }
    parentPort.postMessage({ id: m.id, v: score(m.dev, m.div, SEEDS[m.seedIdx], m.ti) });
  });
} else if (process.env.LAD_SERIAL === '1') {
  runSerial();
} else {
  runParallel().catch((e) => { console.error(e); process.exit(1); });
}
