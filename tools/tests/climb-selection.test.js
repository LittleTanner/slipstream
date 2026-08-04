// MECHANIC: terrain selects the specialist. Promise: a climbing rider beats a sprinting
// one on the queen stage, and a sprinting rider beats a climbing one on the pan-flat.
//
// ★ A SPECIALIST IS A COMPLETE RIDER WHO LEANS ONE WAY, and this test used to pretend
// otherwise. It gave the player a body consisting of `climbCost -0.22` and NOTHING ELSE
// against a field developed on all six dimensions, so what it actually measured was the
// four dimensions the player was missing, not the one they had. It also sampled a single
// division at two seeds, which made it a coin flip: measured across the whole ladder at
// six seeds, the sim it was passing against had the climbing body beating the sprinting
// body on the DIVISION 1 PAN-FLAT, which is nonsense, and this test never saw it.
//
// Now both riders get a division-appropriate complete body (the sim's own `rivalBody`)
// plus their specialty on top, three divisions wide and three seeds deep, and the
// assertion is on the AGGREGATE, because "climbers win in the mountains" is a claim about
// racing in general rather than about one seed on one parcours.
//
// Not vacuous: run this same measurement against a sim with the division speed ramp
// removed but the day NOT made harder to compensate — the configuration that was tried
// and rejected, see tierProfile — and the pan-flat margin comes back at -1, a failure.
//
// Parallel by division, because 36 full stage simulations end to end is over a minute.
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const Sim = require('../sim.js');
const { CFG } = Sim;

const SPEC = { climb: { climbCost: -0.22 }, sprint: { kick: 0.14, attack: 0.07 } };
const SEEDS = [11, 37, 71];
const DIVS = [8, 4, 1];
const QUEEN = 4, PANFLAT = 3;

function place(spec, seed, stageIndex, plan, div) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = Sim.createRace({ seed, stageIndex, playerType: 'rouleur', gc, leaders: {}, div });
  race.you.stats = Sim.buildStats(Sim.neutralBuild());
  const base = Sim.rivalBody('rouleur', Math.max(0, Math.min(1, (8 - div) / 7)));
  for (const k in base) race.you.stats[k] = (race.you.stats[k] === undefined ? 0 : race.you.stats[k]) + base[k];
  for (const k in SPEC[spec]) race.you.stats[k] = (race.you.stats[k] === undefined ? 0 : race.you.stats[k]) + SPEC[spec][k];
  race.you.you = false;
  race.you.plan = { k: plan, at: 0.30, kick: 200 };
  let g = 0; while (!race.you.finished && g++ < 120 * 700) Sim.step(race, CFG.fixedDt, null);
  return Sim.settle(race).find(x => x.name === 'YOU').place;
}

function oneDivision(div) {
  const sum = (spec, stageIndex, plan) =>
    SEEDS.reduce((a, sd) => a + place(spec, sd, stageIndex, plan, div), 0);
  return {
    queenClimber: sum('climb', QUEEN, 'climb'),
    queenSprinter: sum('sprint', QUEEN, 'climb'),
    flatSprinter: sum('sprint', PANFLAT, 'sprint'),
    flatClimber: sum('climb', PANFLAT, 'sprint')
  };
}

if (!isMainThread) {
  parentPort.postMessage(oneDivision(workerData.div));
} else {
  const out = {};
  let left = DIVS.length;
  for (const div of DIVS) {
    const w = new Worker(__filename, { workerData: { div } });
    w.on('message', (m) => {
      out[div] = m;
      if (--left > 0) return;
      let qc = 0, qs = 0, fs = 0, fc = 0;
      for (const d of DIVS) {
        qc += out[d].queenClimber; qs += out[d].queenSprinter;
        fs += out[d].flatSprinter; fc += out[d].flatClimber;
      }
      const races = DIVS.length * SEEDS.length;
      console.log(DIVS.length + ' divisions x ' + SEEDS.length + ' seeds, ' + races + ' races a side (lower places are better)');
      console.log('  QUEEN   climber ' + qc + ' vs sprinter ' + qs + '   margin ' + (qs - qc));
      console.log('  PANFLAT sprinter ' + fs + ' vs climber ' + fc + '   margin ' + (fc - fs));
      const fails = [];
      if (qs - qc <= 0) fails.push('a climbing rider does not beat a sprinting one on the queen stage');
      if (fc - fs <= 0) fails.push('a sprinting rider does not beat a climbing one on the pan-flat stage');
      if (fails.length) { console.log('FAIL: ' + fails.join('; ')); process.exit(1); }
      console.log('PASS: terrain selects the right specialist, on aggregate across the ladder');
    });
    w.on('error', (e) => { console.error(e); process.exit(1); });
  }
}
