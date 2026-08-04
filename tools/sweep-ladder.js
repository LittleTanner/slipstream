// Sweep candidate ladder curves without editing the game. Writes patched copies of
// tools/sim.js into the scratch dir, one per candidate, and runs the same on-path /
// growth-gain measurement ladder.js does against each.
//
// Two knobs, because measurement says the ladder has two separate faults:
//   strength  — D.strength, a flat raw-speed bonus handed to every rival as the
//               division rises. The player's strength is pinned at 1.0 forever and
//               there is no way to earn any, so this is a handicap that grows while
//               your body growth fights it.
//   bodyExp   — the exponent on the rival body curve. 1 is today's straight line from
//               Division 8 to 1; higher makes the rivals LAG early and converge at the
//               top, which is what a ladder should feel like.
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCRATCH = process.env.SCRATCH || '/tmp/claude-0/-home-user-slipstream/e4354186-dbcf-51c7-814d-aa5df1276973/scratchpad';
const SIM = fs.readFileSync(path.join(__dirname, 'sim.js'), 'utf8');

const CANDIDATES = [
  { name: 'today',        strength: 0.035, bodyExp: 1.0 },
  { name: 'no-strength',  strength: 0.0,   bodyExp: 1.0 },
  { name: 'half+curve',   strength: 0.018, bodyExp: 1.6 },
  { name: 'none+curve',   strength: 0.0,   bodyExp: 1.6 },
];

const SRC_STRENGTH = 'strength: 0.035 * t,';
const SRC_BODY = 'const w = (own.indexOf(dim) >= 0 ? 1 : RIVAL_SPREAD) * t;';

function patch(c) {
  if (SIM.indexOf(SRC_STRENGTH) < 0) throw new Error('strength anchor moved; re-read tierProfile');
  if (SIM.indexOf(SRC_BODY) < 0) throw new Error('rivalBody anchor moved; re-read rivalBody');
  let out = SIM.split(SRC_STRENGTH).join('strength: ' + c.strength + ' * t,');
  out = out.split(SRC_BODY).join(
    'const w = (own.indexOf(dim) >= 0 ? 1 : RIVAL_SPREAD) * Math.pow(t, ' + c.bodyExp + ');');
  const p = path.join(SCRATCH, 'sim-' + c.name + '.js');
  fs.writeFileSync(p, out);
  return p;
}

// The runner is a tiny script rather than an in-process require, so each candidate gets
// its own worker pool and its own fresh module state.
// Each division is its own worker, so a candidate's 8 divisions run concurrently and
// the four candidates overlap. Serial, this sweep is close to half an hour.
const RUNNER = `
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const Sim = require(process.argv[2] || workerData.sim);
const P = require(${JSON.stringify(path.join(__dirname, 'parts.js'))});
const TEMPLATES = [0,1,2,3,4];
const PLAN = ['sprint','diesel','climb','sprint','climb'];
const SEEDS = [11,23,37];
const DIVS = [8,7,6,5,4,3,2,1];
function score(dev, div, seed, ti) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time:0, sprintPts:0, komPts:0 };
  const race = Sim.createRace({ seed, stageIndex: ti, playerType:'rouleur', gc, leaders:{}, div });
  race.you.stats = P.buildStats(P.neutralBuild());
  const bd = Sim.rivalBody('rouleur', dev);
  for (const k in bd) race.you.stats[k] = (race.you.stats[k]===undefined?0:race.you.stats[k]) + bd[k];
  race.you.you = false;
  race.you.plan = { k: PLAN[ti], at: 0.30, kick: 200 };
  let g = 0; while (!race.you.finished && g++ < 120*600) Sim.step(race, Sim.CFG.fixedDt, null);
  const order = Sim.settle(race); const you = order.find(o => o.name === 'YOU');
  return you.place + (you.time - order[0].time) / 100;
}
function oneDiv(div) {
  const t = Math.max(0, Math.min(1, (8 - div) / 7));
  const row = {};
  for (const [tag, dev] of [['raw',0],['path',t],['max',1]]) {
    let s = 0;
    for (const ti of TEMPLATES) for (const sd of SEEDS) s += score(dev, div, sd, ti);
    row[tag] = s / (TEMPLATES.length * SEEDS.length);
  }
  return row;
}
if (!isMainThread) { parentPort.postMessage(oneDiv(workerData.div)); }
else {
  const out = {};
  let left = DIVS.length;
  for (const div of DIVS) {
    const w = new Worker(__filename, { workerData: { div, sim: process.argv[2] } });
    w.on('message', (m) => { out[div] = m; if (--left === 0) console.log(JSON.stringify(out)); });
    w.on('error', (e) => { console.error(e); process.exit(1); });
  }
}
`;
const runnerPath = path.join(SCRATCH, 'ladder-runner.js');
fs.writeFileSync(runnerPath, RUNNER);

const DIVS = [8, 7, 6, 5, 4, 3, 2, 1];
const run = (c) => new Promise((res, rej) => {
  execFile('node', [runnerPath, patch(c)], { encoding: 'utf8', maxBuffer: 1 << 24 },
    (err, so) => err ? rej(err) : res(JSON.parse(so.trim().split('\n').pop())));
});
Promise.all(CANDIDATES.map(run)).then((all) => {
console.log('avg finishing place, 5 templates x 3 seeds, 8-rider field (lower is better)\n');
CANDIDATES.forEach((c, ci) => {
  const g = all[ci];
  console.log('=== ' + c.name + '  (D.strength ' + c.strength + ', body exponent ' + c.bodyExp + ')');
  console.log('  ' + 'row'.padEnd(9) + DIVS.map(d => ('D' + d).padStart(8)).join(''));
  console.log('  ' + 'ON PATH'.padEnd(9) + DIVS.map(d => g[d].path.toFixed(2).padStart(8)).join(''));
  console.log('  ' + 'GAIN'.padEnd(9) + DIVS.map(d => (g[d].raw - g[d].max).toFixed(2).padStart(8)).join(''));
  const paths = DIVS.map(d => g[d].path);
  const drift = paths[paths.length - 1] - paths[0];
  console.log('  ON PATH drift D8 -> D1: ' + (drift >= 0 ? '+' : '') + drift.toFixed(2)
    + '   (0 = the ladder stays the same contest all the way up)');
  console.log('  worst GAIN: ' + Math.min.apply(null, DIVS.map(d => g[d].raw - g[d].max)).toFixed(2)
    + '   (how little growing pays at its weakest division)\n');
});
}).catch((e) => { console.error(e); process.exit(1); });
