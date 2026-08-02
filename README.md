# Slipstream

A minimalist Tour de France cycling game. Flat visual style modelled on Mini Motorways.
Stage racing with three jerseys, divisions 8 to 1, time trials, descending, breakaways,
and real climbs as route packs. The whole game is one HTML file; an iOS/SwiftUI port is
planned once gameplay is settled.

## Running the game

Open `index.html` in a browser. That is the entire install. It also runs as-is on
GitHub Pages (serve the repo root; `index.html` is the entry point).

## Working on it

Read `CLAUDE.md` and `docs/DEV-LOOP.md` before touching code, and `docs/DECISIONS.md`
before proposing design changes.

The sim is a pure, deterministic, DOM-free IIFE at the top of `index.html`
(`const Sim = (function () {...})();`). The tools run it headless in Node against a
golden master. Extract it first: slice `index.html` from the first line starting
`const Sim = (function` through the first line whose trimmed content is `})();`,
append `module.exports = Sim;`, and write the result to `tools/sim.js`. Re-extract
after every sim edit.

## The four commands

Run from the repo root, after extracting `tools/sim.js`:

- `node tools/verify.js` — 1590 checks against the golden master. Must pass before
  and after any change.
- `node tools/golden-gen.js` — regenerate the golden after a deliberate physics or
  tuning change. Update its `G.note`. Takes several minutes.
- `node tools/dominance.js` — parts balance check. Goal: 0 dominant, 0 dead parts.
  Run after anything touching AI behavior, effort, or drafting. Takes a few minutes.
- `python3 tools/loadcheck.py` — headless page-error check of `index.html`
  (requires Playwright).
