// DEV-LOOP sanity sweep: run every golden case under the CHANGED sim and assert the
// behaviour is sane BEFORE regenerating — a regenerated golden bakes in whatever it sees.
const S = require('./sim.js'); const { CFG } = S;
const G = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'golden.json'), 'utf8'));
function policy(race) { const togo = race.course.len - race.you.dist; return { rate: togo < 200 ? 4.0 : 0, ease: false, launch: false, stumble: false, tx: race.you.x }; }
let bad = [], n = 0, maxSpread = 0, unfinished = 0;
for (const c of G.cases) {
  const gc = {}; for (const nm of ['YOU', ...S.FIELD.map(f => f.name)]) gc[nm] = { time: 0, sprintPts: 0, komPts: 0 };
  const race = S.createRace({ seed: c.seed, stageIndex: c.stageIndex, playerType: c.playerType, gc, leaders: {}, div: c.div });
  let g = 0; while (!race.you.finished && g++ < 120 * 900) S.step(race, CFG.fixedDt, policy(race));
  const order = S.settle(race);
  const tag = 'case ' + c.seed + '/' + c.stageIndex + '/' + c.playerType;
  n++;
  if (!race.you.finished) { unfinished++; bad.push(tag + ': player never finished'); continue; }
  if (order.length !== c.result.length) bad.push(tag + ': field size ' + order.length + ' vs ' + c.result.length);
  const w = order[0].time;
  const spread = order[order.length - 1].time - w;
  maxSpread = Math.max(maxSpread, spread);
  for (const x of order) {
    if (!isFinite(x.time) || isNaN(x.time)) bad.push(tag + ': ' + x.name + ' time ' + x.time);
    else if (x.time <= 0) bad.push(tag + ': ' + x.name + ' nonpositive time ' + x.time);
  }
  // A crashed-out rider carries a +9999 sentinel (race-ending crash in a top division);
  // the shipped golden has always contained one such case. Spread is judged over the
  // riders who actually finished the race.
  const sentinels = order.filter(x => x.time - w > 9000);
  const finishers = order.filter(x => x.time - w <= 9000);
  const finSpread = finishers[finishers.length - 1].time - w;
  if (sentinels.length > 1) bad.push(tag + ': ' + sentinels.length + ' crash-out sentinels');
  if (sentinels.length === 1 && sentinels[0].name !== 'YOU') bad.push(tag + ': non-player sentinel ' + sentinels[0].name);
  if (finSpread < 0 || finSpread > 1500) bad.push(tag + ': finisher spread ' + finSpread.toFixed(1) + 's');
  for (const k of ['fuel', 'fluid', 'energy', 'absorb', 'load'])
    if (!isFinite(race.you[k]) || isNaN(race.you[k])) bad.push(tag + ': you.' + k + ' = ' + race.you[k]);
}
console.log('swept ' + n + ' cases, max field spread ' + maxSpread.toFixed(1) + 's, unfinished ' + unfinished);
if (bad.length) { console.log('INSANE:\n  ' + bad.slice(0, 15).join('\n  ')); process.exit(1); }
console.log('SANE: every case finishes with finite, positive, plausible results');
