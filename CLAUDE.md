# Slipstream — project context for Claude

A minimalist Tour de France cycling game. Flat visual style modelled on Mini Motorways.
Currently a single HTML file; an iOS/SwiftUI port is planned.

Read `docs/DEV-LOOP.md` before writing any code. Read `docs/DECISIONS.md` before
proposing design changes — a lot of what looks like an obvious improvement has already
been tried and reverted, and the reasons are recorded there.

---

## How Kevin wants to work

- **Question his ideas. Do not just go along with them.** If a proposal is bad, say so and
  say why; if there is a better approach, propose it instead. He wants to be called out.
- Direct honesty over validation. Concise replies.
- No em-dashes or en-dashes in written copy.
- Give constructive feedback and suggest improvements to UI/UX and code maintainability
  unprompted.
- Call him out when he is doing work that should wait for the iOS build.
- Call him out whenever something is implemented differently from how real racing works,
  so deviating is always a conscious choice.
- Inclusive wording: they/them. American spelling ("tires", not "tyres").
- Keep him honest on scope: minimalist in LOOK, not necessarily in features.

## The standard of proof

Measure before claiming. Several features were reported "done" and were not:
- The abandonment line was computed in one function and displayed from another, so riders
  left the race and nothing ever said so.
- The pace car's slipstream could never fire because the car only existed in the renderer.
- Half the "race craft" hints were written from intuition; two were false, one exactly
  backwards.
- `window.storage` was read in four places and defined in none, so a browser silently
  discarded every save and the career reset on reload. It survived 30+ builds because the
  browser tests inject the very object whose absence was the bug. **A harness that supplies
  the missing piece cannot see it missing** — when a test needs a shim, ask what the shim is
  standing in for and whether anything checks that the real thing exists.

A feature is not done because both halves exist. Check they are in the same scope and that
the visible half renders.

---

## What is built

Full stage racing with three jerseys. Divisions 8 to 1, promoted by completing a short, a
medium and a long race per division at a placing that tightens as you climb. One-day races
through to a 21-stage tour with rest days. A fixed 14-stage Grand Tour unlocked by taking
Division 1.

Time trials with start intervals, a cadence mechanic, time checks, and a sheltering rule.
Descending with gravity, switchbacks, narrow roads, and a progressive brake. Breakaways
that rotate ("through and off"), with an elbow flick if you never come through. Real
climbs sold as route packs (Alpe d'Huez, Galibier, Madeleine), rated hors categorie from
their real figures. A tutorial with an animated ghost-hand demonstration. A glossary of
cycling terms.

## Before shipping

- ~~Remove the "Unlock everything (testing)" button in Settings.~~ **Done (build 21).** It
  is behind a gesture now: hold the build number five seconds, type the passphrase, and a
  Debug button appears with a diagnostics page. The flag is not persisted, so a shipped
  build starts clean.
- The free-play gate ("play Divisions 8-6, then the paywall") is an idea, not a decision.
- Real-money purchases are StoreKit work and belong in the port.

## The port

Decided: stay in HTML until gameplay and feel are settled, then port as one focused
effort. The reason is the test loop — the sim runs headless here against a 1590-assertion
golden master, plus a parts-balance check and browser tests. None of that runs for Swift
without Xcode.

The sim is pure, deterministic and DOM-free, so it ports to Swift almost directly. The
view and input get rewritten for SwiftUI anyway. **Do not restructure the single HTML
file.**

Kevin's own port signal: when he is tuning numbers rather than changing systems.
