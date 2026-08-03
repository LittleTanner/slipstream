# Slipstream — how to work on it

This exists because the test loop is why HTML development has been fast AND correct. It is
the single thing that would be lost by porting to Swift early.

## Architecture (load-bearing)

- ONE file: `index.html`, which is also the GitHub Pages entry point. **Shipping means
  committing it, then re-extracting and re-verifying the golden against the committed
  file, not an edited working copy.** (There used to be a twin `slipstream.html`; the
  repo has retired it. If any old note says "copy to both files", this is the one file
  it means now.)
- `const Sim = (function () {...})();` at the top: pure, deterministic, ZERO DOM
  references. The view is a second IIFE below it.
- Determinism is load-bearing: seeded mulberry32 plus a fixed 1/120s timestep. The golden
  depends on it.
- View closure variables (`ladder`, `committedBuild`, `race`, `tour`, `Sim`) are NOT
  globals. Playwright `evaluate` cannot read them. It can click the DOM and read the DOM
  only.

## The loop

1. Start from what shipped: a clean checkout of `index.html`. Git is the scratch copy —
   `git diff` shows the change, `git checkout -- index.html` gets you back.
2. Extract the sim: `node tools/extract.js`. It finds the first line starting
   `const Sim = (function`, then the first line after it whose trimmed content is
   `})();`, and writes that slice plus `module.exports = Sim;` to `tools/sim.js`.
   **Re-extract after every sim edit.**
3. `node tools/tests/run.js` — the MECHANICS SUITE (~25s): one focused test per
   mechanic promise (rotation, drafting, crosswind, climbing selection, recovery,
   wheel-suck escalation...). A failure NAMES what broke — check this before the
   slower tiers. The catalog of every mechanic, its promise, and its coverage is
   `docs/MECHANICS.md`.
4. `node tools/verify.js` — 1590 checks against the golden. Exits nonzero on failure.
   CI (`.github/workflows/verify.yml`) runs extract + mechanics suite + verify on
   every PR and push to main, so a broken mechanic or golden cannot merge quietly.
5. `node tools/golden-gen.js` — regenerate after ANY sim change (physics, parts,
   rivals, course). Update its `G.note` to say what changed. Takes several minutes, so
   give it a generous timeout.
6. `node tools/dominance.js` — parts balance, now on worker threads (~1.5 min; the
   output is byte-identical to the serial reference, which `DOM_SERIAL=1` forces).
   Goal: 0 dominant, 0 dead. It is body-aware, because parts are only a ~35% tune on
   top of a rider's body. The 3-seed verdict flips on tiny changes: confirm a
   dead/dominant call at 6 seeds before acting on it.
7. `python3 tools/loadcheck.py` — headless page-error check. For VIEW changes go
   deeper: `python3 tools/browser/smoke.py` (~75s) drives every screen, every drill,
   a full shrunk race and the pause card; `python3 tools/browser/career.py` (~2 min)
   checks division display, route-pack pricing, money and result recording against
   seeded saves. Run smoke before shipping any UI change; career when touching
   progression, money or save code.
8. Ship: commit `index.html`, re-extract from the COMMITTED file, verify again. Bump the
   build number at the bottom of Settings (`verLine`) with every shipped change, so what
   is deployed is checkable against what was pushed.

## Sanity sweep — run BEFORE blessing a regenerated golden

`node tools/sanity.js` — loops every golden case under the CHANGED sim and asserts: no
NaN times, no zero or negative times, everyone finishes, finisher spread sane (the one
crashed-out +9999 sentinel, player only, is expected). A regenerated golden BAKES IN
whatever it sees, so check the behaviour is right before regenerating, not after.

## When to run dominance

After anything touching AI behaviour, effort, or drafting. Two separate changes have
knocked parts dead:
- Making AI front riders swing off by flipping their effort killed three parts.
- Adding lateral movement to the rotation killed box-section wheels.

**Box wheels are the canary.** They are the part that feels any change to how much time
riders spend sheltered.

**The general fix:** when a behavioural change wrecks balance, express it in the
speed/position layer rather than the effort/decision layer. Effort ripples into energy, AI
branching and parts balance. A target-speed nudge ripples nowhere.

## Playwright patterns that work

- Bypass the first-run tutorial with `sed` on a THROWAWAY copy:
  `let ladder = { div: 8,` → `let ladder = { div: 8, tutorialDone: true,`
- A full stage is ~3 minutes real-time. For UI-flow tests, shrink a STAGES entry in the
  throwaway (e.g. `len: 1400` → `320`) and a race takes ~30s.
- Pedal keys are **z** and **x**. NOT arrows. Arrows steer, ArrowDown eases/brakes,
  ArrowUp throws, Shift is full lean.
- Practice path: `#pracBtn` → `#pRide` → BUILD SCREEN → `#bLock` → BRIEFING → `#rollBtn`.
  It does not start the race directly; a test that clicks `#pRide` and waits will hang.
- Drills path: `#pracBtn` → `#drillBtn` → `button.pick:has-text('<name>')` → `#dbGo`.
- Tour path: `#startBtn` → RACE PICKER (`#pick`) → a card button → `#bLock` → `#rollBtn`.
- Catch errors with `pg.on("pageerror", ...)`. A blocked font CDN 403 is the only expected
  console noise.

## Harness limits — know these before trusting a null result

- **Synthetic pedalling only reaches ~1.6 m/s**, so pickup-based tutorial steps can never
  be completed and any test depending on collecting an item will fail. The pre-existing
  "Food and bottles" step fails identically — that is how to tell a harness limit from a
  real bug.
- **An AI-driven player takes turns naturally**, so the wheel-suck path never fires in a
  normal sweep. It needs a hand-built break.
- **A synthetic player attacking flat out often fails to get clear at all**, so break tests
  cannot separate "nobody followed" from "the attack did not stick".
- **Check the terrain actually contains the thing you are testing.** A four-seed test of
  attacking over a summit was diluted because two of the four summits had no descent after
  them at all.
- **Give the harness a real steering target.** A test that passes `tx: you.x` ("hold your
  line") will sit in the verge and look like proof that corners are unmakeable.

## Gotchas that cost real debugging time

- **CSS `.hide` does not hide buttons whose class sets `display`.** `.go{display:block}` is
  the same specificity and comes later, so `.hide` loses. This has bitten FOUR times
  (`.go`, `#leanBtn`, `.segmented`, `#tcLong`). Any new button of those classes needs its
  own `#id.hide{display:none}`. Specificity only bites when two rules set the SAME
  property, so check whether the competing rule declares `display`.
- **New screens must be registered** in the `show()` list array or they never display.
- **Render-then-show is fragile.** `renderX(); show("x");` presents as a DEAD BUTTON if
  renderX throws. Prefer `show("x"); renderX();`.
- **Test with real data, not a fresh profile.** A bug in the riding-data screen only fired
  once history had one race; the empty path returned early, so a fresh-profile test passed
  and proved nothing.
- **Course PRNG discipline.** Adding an `R()` call inside course generation shifts every
  downstream value and changes every course. DERIVE values instead of rolling them. To drop
  a rider from a field, still CREATE them (so the draws happen) and just omit them from the
  list.
- **Anything the physics or AI reacts to cannot live in the render loop.** The pace car's
  position was updated only by the renderer, so its slipstream could never fire headlessly
  and the AI had nothing to chase.
- **Adding a stage flag means adding it to the spec REBUILD in `buildStage`**, which
  rebuilds field by field rather than copying. `spec.tt` and `spec.route` were both
  silently dropped this way.
- **Group detection resolves ties to the first group found.** A hand-built scenario with an
  even split between two groups will read the FRONT group as the peloton — so the player is
  "not up the road" even though they are.
- **Scope in `aiThink`**: use `r.stats.<x>`, not `st.<x>`.
- **Driving the player headlessly**: setting `you.effV` is overwritten by the input
  pipeline. Drive rivals-style instead: `race.you.you = false` plus a plan, and step with
  `null` input.
- **`settle()` runs the race to completion itself** before ordering, so a harness that
  stops at the player's finish still gets full results.
