# CLAUDE.md for the Swift project

**Copy this file to `CLAUDE.md` in the root of the Xcode project.** It is not read from here.

Everything below is carried over from the JavaScript project, which is the reference
implementation. Paths like `../slipstream-js/...` assume the two repos sit side by side.

---

# Slipstream (iOS) — project context for Claude

A minimalist Tour de France cycling game. Flat visual style modelled on Mini Motorways.
This is the Swift port. The reference implementation is `../slipstream-js`, a single
`index.html` holding a pure deterministic simulation and a canvas view.

**Read `../slipstream-js/docs/PORT.md` before writing any code.** Then `DECISIONS.md` — a lot of
what looks like an obvious improvement has already been tried and reverted, and the reasons are
recorded there.

---

## How Kevin wants to work

- **Question his ideas. Do not just go along with them.** If a proposal is bad, say so and say
  why; if there is a better approach, propose it instead. He wants to be called out.
- Direct honesty over validation. Concise replies.
- No em-dashes or en-dashes in written copy.
- Give constructive feedback and suggest improvements to UI/UX and code maintainability
  unprompted.
- Call him out whenever something is implemented differently from how real racing works, so
  deviating is always a conscious choice.
- Inclusive wording: they/them. American spelling ("tires", not "tyres").
- Keep him honest on scope: minimalist in LOOK, not necessarily in features.

## The standard of proof

Measure before claiming. This is not a slogan; it is the most expensive lesson the JS project
learned, repeatedly. Real examples, all of which passed review and shipped:

- The abandonment line was computed in one function and displayed from another, so riders left
  the race and nothing ever said so.
- The pace car's slipstream could never fire because the car only existed in the renderer.
- `window.storage` was read in four places and defined in none, so a browser silently discarded
  every save and the career reset on reload. It survived 30+ builds because **the browser tests
  injected the very object whose absence was the bug.**
- A rival drop-back was reported as taking 39 seconds. It never happened: the harness started
  its clock on breaks that were not rotating at all. That was the *second* bogus figure from the
  same file.
- Gearing asked for 40 to 56 shifts a ride. Those numbers were measured, written down as a
  neutral statistic, and not recognised as a broken mechanic for eleven builds.

Three rules fall out of that, and they apply to Swift exactly as they did to JS:

1. **A feature is not done because both halves exist.** Check they are in the same scope and
   that the visible half renders.
2. **A harness that supplies the missing piece cannot see it missing.** When a test needs a mock
   or a shim, ask what it stands in for and whether anything checks the real thing exists.
3. **When a measurement looks dramatic, suspect the harness first.** Three separate times the
   number was wrong and the game was fine.

---

## The port is a conformance exercise, not a rewrite

The sim is not being redesigned. It is being reproduced exactly, and there is a kit that proves
it:

```
../slipstream-js/port/constants.json   105 CFG values — READ these, never retype them
../slipstream-js/port/api.json         the interface to implement: exports, entry points,
                                       the input struct, 117 rider fields, SAVE_KEYS
../slipstream-js/port/protocol.json    timestep, PRNG rule, input policy, tolerances
../slipstream-js/port/trace.json       per-rider dist/speed/energy, once a second, 3 races
../slipstream-js/tools/golden.json     1590 checks on what a race RESULTS IN
```

**Order of work, and do not skip ahead:**

1. PRNG and course generation, until `golden.json`'s course section passes.
2. `stepRider` and `step`, until `port-verify` passes on all three traces.
3. `settle`, the GC and the ladder, until all 1590 golden checks pass.
4. **Only then** the SwiftUI view. A view built on a sim that is 2% off gets tuned to compensate
   for the 2%, and you will never find it afterwards.

**Non-negotiables** (all explained in `PORT.md`):

- Fixed timestep 1/120s. Accumulate real time and step in whole slices; never a display delta.
- The PRNG call **order** is part of the specification. Reordering one draw in course generation
  changes every course from that point on.
- The daily challenge is **UTC on purpose**: a `Calendar` pinned to UTC, never `Calendar.current`.
- Match the JS expression shape rather than simplifying the algebra. The simplification is where
  float drift enters.
- The sim works in metres and seconds; the view multiplies by `SCALE` (100). Convert in exactly
  one place.

## The sim never draws

`race.events` is a queue of `{ text, colour }` that the view drains and empties each frame. The
sim says what happened; the view decides how to show it. That split is the only reason the sim
ports at all — keep it absolutely clean, and resist the temptation to let a SwiftUI view reach
into sim state to decide what to render.

---

## What is built

Full stage racing with three jerseys. Divisions 8 to 1, promoted by completing a short, a medium
and a long race per division at a placing that tightens as you climb. One-day races through to a
21-stage tour with rest days. A fixed 14-stage Grand Tour unlocked by taking Division 1.

Time trials with start intervals, a cadence mechanic, gearing, time checks and a sheltering rule.
Descending with gravity, switchbacks, narrow roads and a progressive brake. Breakaways that
rotate, with an elbow flick if you never come through. Real climbs sold as route packs. A race
builder. A tutorial, and a glossary of cycling terms.

`../slipstream-js/docs/SCREENS.md` is the inventory: 17 screens, what each is for, and the race
HUD. Read it at phase 4, not before — it will pull you into building UI early.

## The business model

Divisions 8-6 are free and complete: nothing is disabled inside them. Divisions 5-1 are the
career purchase. What you buy is more ladder, not more features — money buys breadth, never
power. The daily challenge is free forever at Division 4, above the wall on purpose.

`unlockCareer()` in the JS build is the single StoreKit seam. In Swift it becomes a
non-consumable: purchase, verify, finish, then grant. **It needs a Restore Purchases path**,
which the App Store requires and the JS prototype could never test.

The promotion out of Division 6 is EARNED and BANKED, never refused. Buying collects it.

---

## The pipeline

Swift side, per change:

1. `swift test` — the conformance suite (course, traces, golden).
2. Re-run `port-verify` in the JS repo if you touched anything shared.

JS side, if the reference sim is ever changed (it should rarely be):

```
node tools/extract.js && node tools/tests/run.js && node tools/verify.js
node tools/port-export.js && node tools/port-verify.js     # regenerate the fixtures
```

**The fixtures must be regenerated whenever the golden is.** A stale fixture is worse than none,
because the port would be chasing a divergence from a sim that no longer exists.

## Keep the JavaScript

Do not delete it when Swift works. It is the oracle: when a Swift behaviour looks wrong you can
run the same seed there in seconds and find out whether the sim or the port is at fault. Balance
work (`ladder.js`, `dominance.js`, `gearing.js`) is far cheaper headless in Node than in a
simulator, and none of it needs a view.
