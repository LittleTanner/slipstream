# Slipstream — picking this project back up

## What to upload into a new chat
- `slipstream.html` — the game. This IS the project; everything else is tooling.
- `slipstream-golden.json` — the golden master (1590 assertions). Without it there is no regression net.
- `slipstream-verify.js` — checks the build against the golden.
- `slipstream-golden-gen.js` — regenerates the golden after a deliberate physics change.
- `slipstream-dominance.js` — parts balance check (target: 0 dominant, 0 dead).
- `slipstream-loadcheck.py` — headless page-error check.

## What to say
> Read the Slipstream memory, then re-extract the sim and run verify.

Claude's memory already holds the design decisions, the reasoning behind them, and the
bugs that cost the most time. The hub file points at the topic files. You do not need to
re-explain anything.

## The dev loop (Claude will know this, but for reference)
1. Copy the HTML to a scratch file.
2. Extract the `Sim` IIFE into `sim.js` (the memory explains the exact slicing).
3. Edit, then `node slipstream-verify.js`.
4. If a physics change was deliberate, regenerate the golden and re-verify.
5. Run dominance after anything touching AI behaviour, effort, or drafting.
6. Load-check before shipping, and always copy to BOTH `slipstream.html` and `index.html`.

## Before you ship the game
- REMOVE the "Unlock everything (testing)" button in Settings. It hands over the paid
  career and every route pack for free.
- Decide the free-play gate (the "play Divisions 8-6, then the paywall" idea is still
  undecided).
- The real-money purchases themselves are StoreKit work and belong in the iOS port.
