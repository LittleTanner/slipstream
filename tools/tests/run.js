// Mechanics test runner: executes every *.test.js in this folder, reports per-test
// PASS/FAIL, exits nonzero if any fail. Each test is a self-contained script that
// requires ../sim.js (extract first: node tools/extract.js) and exits 1 on failure.
// The whole suite is the fast answer to "did that change break a mechanic?" —
// seconds per test, and a failure names the mechanic. The golden (verify.js) still
// catches everything else; dominance.js still owns parts balance.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const tests = fs.readdirSync(dir).filter(f => f.endsWith('.test.js')).sort();
let failed = 0;
const t0 = Date.now();
for (const f of tests) {
  const start = Date.now();
  const r = spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8', timeout: 180000 });
  const secs = ((Date.now() - start) / 1000).toFixed(1);
  const out = (r.stdout || '') + (r.stderr || '');
  const last = out.trim().split('\n').pop() || '(no output)';
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + f.padEnd(28) + secs.padStart(6) + 's  ' + last);
  if (!ok) console.log(out.split('\n').map(l => '      ' + l).join('\n'));
}
console.log('---');
console.log(failed ? 'FAIL: ' + failed + ' of ' + tests.length + ' mechanics tests failed' : 'PASS: all ' + tests.length + ' mechanics tests');
process.exitCode = failed ? 1 : 0;
