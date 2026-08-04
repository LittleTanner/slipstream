// Dominance harness v2 (step 1). v1's scripted policies never cornered, descended or
// contested a sprint, so they were blind to the parts that serve those skills. v2
// drives the PLAYER with the sim's own AI (flip the `you` flag, hand it a plan, step
// with no input): the AI steers, corners, descends and attacks, so a build's stats
// express on every axis. Each stage is ridden under the plan its terrain invites.
// Score is finishing PLACE (gap as a fine tiebreak), which separates a bunch finish
// where raw time cannot.
//
// Orchestration: the 270 races run on worker_threads by default (each worker requires
// sim.js/parts.js itself, so module state is fresh per thread; races are independent
// and deterministic, so per-race scores are bit-identical to the serial ones, and the
// per-cell average sums the three seed scores in SEED ORDER so the float arithmetic
// matches too). DOM_SERIAL=1 forces the original serial path; both paths feed the same
// report() printer, so their stdout is byte-identical.
const { Worker, isMainThread, parentPort } = require('worker_threads');
const os = require('os');
// DOM_SIM points at an alternate extracted sim, so a "did MY change do this?" comparison
// runs without swapping tools/sim.js under the harness's feet. Balance verdicts move with
// terrain and difficulty changes, and the only way to attribute one is to run the same
// grid against the sim before and after.
const Sim = require(process.env.DOM_SIM || './sim.js');
const P = require('./parts.js');

// Parts are now a ~35% tune on top of a grown body, so test each part on a DEVELOPED rider
// matched to the terrain (a climber on the queen), not a bodyless one. Mirrors view DIM_BODY.
const DIM_BODY = { climb:{climbCost:-0.22}, sprint:{kick:0.14,attack:0.07}, endur:{recover:0.12,fuelUse:-0.04}, durab:{resilience:0.10,fatigueResist:-0.24,gut:0.30,sweatRate:-0.14}, aero:{windTax:-0.13,draft:0.08}, handle:{handling:0.14,descend:0.10} };
function body(dims){ const s={}; for(const d of dims) for(const k in DIM_BODY[d]) s[k]=(s[k]||0)+DIM_BODY[d][k]; return s; }
// Six dimensions now, so a terrain-matched rider carries the two that road asks for as
// well: a windy flat day wants aero, a mountain day wants handling for the descents.
const TERRAIN_BODY = [ ['sprint','endur','durab','aero'], ['climb','sprint','endur','handle'], ['climb','endur','durab','handle'], ['sprint','endur','durab','aero'], ['climb','endur','durab','handle'] ];

const TEMPLATES = [0, 1, 2, 3, 4];
const TNAME = ['flat', 'hills', 'mtn', 'panflat', 'queen'];
// DEV-LOOP: confirm any dead/dominant verdict at 6 seeds before acting on it, because the
// 3-seed casualty list churns. `DOM_SEEDS=11,23,37,52,71,89 node tools/dominance.js` does
// it in place; copying the harness to a scratch dir silently runs it against a stale sim.
const SEEDS = (process.env.DOM_SEEDS || "11,23,37").split(",").map(Number);
const DIV = 4;
const TERRAIN_PLAN = ['sprint', 'diesel', 'climb', 'sprint', 'climb'];

function score(build, seed, stageIndex) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed, stageIndex, playerType: 'rouleur', gc, leaders: {}, div: DIV });
  race.you.stats = P.buildStats(build);
  const bd = body(TERRAIN_BODY[stageIndex]); for (const k in bd) race.you.stats[k] = (race.you.stats[k]===undefined?0:race.you.stats[k]) + bd[k];
  race.you.you = false;
  race.you.plan = { k: TERRAIN_PLAN[stageIndex], at: 0.30, kick: 200 };
  let g = 0; while (!race.you.finished && g++ < 120 * 600) Sim.step(race, Sim.CFG.fixedDt, null);
  const order = Sim.settle(race); const you = order.find(o => o.name === 'YOU');
  return you.place + (you.time - order[0].time) / 100;
}
function avgScore(build, stageIndex) {
  let s = 0; for (const seed of SEEDS) s += score(build, seed, stageIndex);
  return s / SEEDS.length;
}

// The printer, verbatim from the serial harness. cellFn(slot, partId, build, ti)
// returns the averaged score for one grid cell; serial computes it inline, parallel
// looks it up from the collected worker results. Everything printed flows through
// here, which is what keeps the two paths byte-identical.
function report(cellFn) {
  const base = P.neutralBuild();
  let dominant = 0, dead = 0;
  for (const slot of P.SLOTS) {
    console.log('\n=== ' + slot.toUpperCase() + ' ===  (avg finishing place, lower is better; .xx = time gap)');
    const parts = P.PARTS[slot];
    const grid = {};
    for (const part of parts) {
      const b = Object.assign({}, base, { [slot]: part.id });
      grid[part.id] = TEMPLATES.map(t => cellFn(slot, part.id, b, t));
    }
    console.log('  ' + 'part'.padEnd(10) + TNAME.map(n => n.padStart(9)).join(''));
    for (const part of parts) console.log('  ' + part.id.padEnd(10) + grid[part.id].map(v => v.toFixed(2).padStart(9)).join(''));
    const best = TEMPLATES.map((t, ti) => {
      let bp = parts[0].id, bv = Infinity;
      for (const part of parts) if (grid[part.id][ti] < bv) { bv = grid[part.id][ti]; bp = part.id; }
      return bp;
    });
    console.log('  ' + 'BEST'.padEnd(10) + best.map(x => x.padStart(9)).join(''));
    const wins = {}; parts.forEach(p => wins[p.id] = 0); best.forEach(b => wins[b]++);
    // ★ "NEVER STRICTLY BEST" DOES NOT SCALE PAST A HANDFUL OF PARTS. With three parts over
    // five templates each one had ~1.7 templates to claim; at five parts it is 1.0, so the
    // pigeonhole alone condemns several parts however good they are, and the casualty list
    // churns between seed counts (3 seeds said 4 dead, 6 seeds said 6 dead and named a
    // different set). A part is healthy if you would SENSIBLY CHOOSE it somewhere, so the
    // test is now whether it lands within a placing of the best on some template.
    // Dominant is unchanged: strictly best everywhere is still a monoculture.
    const LIVE = 0.40;                     // places behind the best and still worth picking
    for (const part of parts) {
      const near = TEMPLATES.filter((t, ti) => {
        let bv = Infinity;
        for (const p2 of parts) if (grid[p2.id][ti] < bv) bv = grid[p2.id][ti];
        return grid[part.id][ti] <= bv + LIVE;
      }).length;
      if (wins[part.id] === TEMPLATES.length) { console.log('  !! DOMINANT: ' + part.id + ' — best on every template'); dominant++; }
      if (near === 0 && !part.neutral) {
        console.log('  .. dead: ' + part.id + ' — never within ' + LIVE.toFixed(2) + ' of the best anywhere');
        dead++;
      }
    }
  }
  console.log('\n---\nSUMMARY: ' + dominant + ' dominant, ' + dead + ' dead (neutral excluded). Goal: 0 dominant, 0 dead.');
}

function runSerial() {
  report((slot, partId, b, t) => avgScore(b, t));
}

function runParallel() {
  // One task per race, enumerated in canonical (slot, part, template, seed) order.
  const tasks = [];
  for (const slot of P.SLOTS) for (const part of P.PARTS[slot])
    for (const ti of TEMPLATES) for (let si = 0; si < SEEDS.length; si++)
      tasks.push({ id: tasks.length, slot, partId: part.id, ti, seedIdx: si });
  const results = new Array(tasks.length);
  const nWorkers = Math.max(1, Math.min(os.availableParallelism(), tasks.length));
  let next = 0, done = 0;
  return new Promise((resolve, reject) => {
    const dispatch = (w) => {
      if (next < tasks.length) w.postMessage(tasks[next++]);
      else w.postMessage(null); // no work left: worker exits itself
    };
    for (let i = 0; i < nWorkers; i++) {
      const w = new Worker(__filename);
      w.on('message', (m) => {
        results[m.id] = m.v; done++;
        dispatch(w);
        if (done === tasks.length) resolve();
      });
      w.on('error', reject);
      w.on('exit', (code) => { if (code !== 0) reject(new Error('worker exited with code ' + code)); });
      dispatch(w);
    }
  }).then(() => {
    // Reassemble per-cell averages exactly as avgScore does: sum in SEED order, then
    // divide, so the floating-point result is identical to the serial computation.
    const cells = new Map();
    for (const t of tasks) {
      const key = t.slot + '|' + t.partId + '|' + t.ti;
      if (t.seedIdx === 0) cells.set(key, 0);
      cells.set(key, cells.get(key) + results[t.id]);
    }
    for (const [key, sum] of cells) cells.set(key, sum / SEEDS.length);
    report((slot, partId, b, t) => cells.get(slot + '|' + partId + '|' + t));
  });
}

if (!isMainThread) {
  // WORKER: this thread required the sim/parts.js itself (fresh module state); it
  // builds each race from scratch, so no race object ever crosses a thread boundary.
  parentPort.on('message', (m) => {
    if (m === null) { parentPort.close(); return; }
    const b = Object.assign({}, P.neutralBuild(), { [m.slot]: m.partId });
    parentPort.postMessage({ id: m.id, v: score(b, SEEDS[m.seedIdx], m.ti) });
  });
} else if (process.env.DOM_SERIAL === '1') {
  runSerial();
} else {
  runParallel().catch((e) => { console.error(e); process.exit(1); });
}
