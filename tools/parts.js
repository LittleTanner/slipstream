// The part tables live in the Sim itself (SLOTS, PARTS, PRESETS, buildStats,
// neutralBuild are all Sim exports). This shim re-exports them for the harnesses that
// historically required a separate parts.js. One reshape: the sim's SLOTS is
// [id, label] pairs for the view; the harnesses expect a flat array of slot ids.
// Re-extract sim.js before using.
const S = require('./sim.js');
module.exports = Object.assign({}, S, { SLOTS: S.SLOTS.map(([id]) => id) });
