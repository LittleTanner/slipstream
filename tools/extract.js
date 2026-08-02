// Extract the Sim IIFE from index.html into tools/sim.js, exactly as DEV-LOOP.md
// describes: slice from the first line starting `const Sim = (function` through the
// first line after it whose trimmed content is `})();`, plus a module export.
// Run from anywhere: paths resolve against the repo root.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const lines = fs.readFileSync(path.join(root, 'index.html'), 'utf8').split('\n');
const s = lines.findIndex(l => l.trimStart().startsWith('const Sim = (function'));
if (s < 0) { console.error('extract: Sim start not found'); process.exit(1); }
const e = lines.findIndex((l, i) => i > s && l.trim() === '})();');
if (e < 0) { console.error('extract: Sim end not found'); process.exit(1); }
fs.writeFileSync(path.join(__dirname, 'sim.js'), lines.slice(s, e + 1).join('\n') + '\nmodule.exports = Sim;\n');
console.log('extracted lines ' + (s + 1) + ' to ' + (e + 1) + ' into tools/sim.js');
