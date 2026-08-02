// Difficulty curve harness. Rides the game AS THE PLAYER using the sim's own AI
// (race.you.you = false + a plan), so cornering, descending, feeding and sprinting all
// express. Reports mean finishing place and win rate per division, which is the thing
// every difficulty claim needs and never had.
const Sim = require('./sim.js');
const { CFG } = Sim;
const PLANS = {
  0: { k: 'flat', at: 0.72, kick: 220 }, 1: { k: 'flat', at: 0.70, kick: 220 },
  2: { k: 'climb', at: 0.55, kick: 200 }, 3: { k: 'flat', at: 0.74, kick: 240 },
  4: { k: 'climb', at: 0.45, kick: 200 }
};
function ride(seed, stageIndex, div, build) {
  const gc = {}; for (const n of ['YOU', ...Sim.FIELD.map(f => f.name)]) gc[n] = { time: 0, sprintPts: 0, komPts: 0 };
  const opts = { seed, stageIndex, playerType: 'rouleur', kit: 'magenta', gc, leaders: {}, div };
  if (build) opts.playerStats = build;
  const race = Sim.createRace(opts);
  race.you.you = false;
  race.you.plan = PLANS[stageIndex] || PLANS[0];
  let g = 0;
  while (race.riders.some(r => !r.finished) && g++ < 120 * 1400) Sim.step(race, CFG.fixedDt, null);
  const order = Sim.settle(race);
  const you = order.find(o => o.name === 'YOU');
  const rivals = order.filter(o => o.name !== 'YOU');
  return { place: you.place, gap: you.time - order[0].time,
           field: rivals[rivals.length - 1].time - rivals[0].time };
}
function curve(divs, seeds, stages, build, label) {
  console.log('\n' + (label || 'difficulty curve') + '  (mean place of 8, win rate, mean gap to winner)');
  const rows = [];
  for (const div of divs) {
    let sum = 0, wins = 0, n = 0, gaps = 0, fld = 0;
    for (const seed of seeds) for (const si of stages) {
      const r = ride(seed, si, div, build);
      sum += r.place; if (r.place === 1) wins++; gaps += r.gap; fld += r.field; n++;
    }
    const row = { div, place: +(sum / n).toFixed(2), winPct: Math.round(100 * wins / n), gap: +(gaps / n).toFixed(1), field: +(fld / n).toFixed(1) };
    rows.push(row);
    console.log('  Div ' + div + '   place ' + row.place.toFixed(2) + '   wins ' + String(row.winPct).padStart(3) + '%   gap ' + String(row.gap).padStart(5) + 's   field spread ' + row.field + 's');
  }
  return rows;
}
module.exports = { ride, curve };
if (require.main === module) {
  const seeds = [11, 23, 37, 52, 68, 91, 104, 137];
  curve([8, 6, 4, 2, 1], seeds, [0, 2, 4], null, 'BASELINE — neutral build, all stage types');
}
