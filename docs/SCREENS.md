# The screens

Written for the SwiftUI port. `PORT.md` says the view gets rewritten rather than translated —
this is what it has to be rewritten *into*. The canvas race and the HTML screens are two
different problems and only the second one is here; the race HUD is covered at the end.

Seventeen screens, all registered in `show()`. **An unregistered screen leaves the previous one
visible underneath**, which has been a real bug here more than once, so in Swift make this an
enum with exhaustive switching rather than a list of ids to keep in sync.

---

## The map

```
menu ─┬─ daily ────────────► race
      ├─ pick ─────────────► brief ──► race ──► result ──► (rest) ──► brief …
      ├─ builder ──────────► pick
      ├─ build
      ├─ routes
      ├─ practice ─┬───────► brief ──► race
      │            └─ drills ──► drillBrief ──► race
      ├─ data
      └─ settings ─┬─ rules
                   ├─ gloss
                   └─ debug        (behind a gesture)
```

---

## Screen by screen

| screen | what it is for | must show | notes for the port |
|---|---|---|---|
| **menu** | the hub, and the career's status line | division dots (8→1), the requirement sentence, prize money, kit colour, the radar, and the free-tier offer when standing at the wall | `mStat` has TWO branches — a new rider gets `reqSentence()`, a returning one gets "Still to…". A note added to only one of them is invisible to everyone who matters; that shipped once |
| **pick** | choose the next race | the races available at this division: one-day, short, medium, long, plus the Grand Tour at Division 1 and any custom race | the custom race is a plain `.linky` line, deliberately not a card |
| **brief** | the parcours before you roll out | profile, length, weather, wind, the race's nickname, the field | reached from pick, practice and drills; the eyebrow differs each time |
| **result** | what just happened | placing, verdict, the note, jerseys, stage board, earnings, GC, points, KOM, and the free-tier offer the moment it is earned | the eyebrow shifts the division for `up`/`down` but not for `wall` |
| **rest** | a rest day in a three-week tour | flavour, and one button back | the only screen in the game allowed to be funny |
| **build** | body, bike and race craft | the radar with body and bike as separate rings, 5 bike slots × 5 parts, physique on a points budget, training, and carry-2-of-3 tactics | locked for the length of a tour, so `buildBtn` hides mid-tour. Money buys breadth, never power |
| **routes** | the shop | one card per pack, the price ladder (3000/6000/12000/18000), the balance | price rises with packs owned; nothing to sell once all are owned |
| **builder** | build your own race | name, length, a shape canvas, the character sentence, day types, the purse | gated on owning a route pack, one ranked custom race per division. Draws its own text on its own canvas — **do not** hand it the race canvas's `label()` |
| **practice** | free play | stage templates and owned real roads, capped at `peakDiv` | so the wall holds here too: a free rider cannot practice past Division 6 |
| **drills** | one technique at a time | the drill list | |
| **drillBrief** | what this drill teaches | the goal and the tell | |
| **daily** | the same race for everyone, every day | today's parcours, your result, the streak, a share string | **fixed at Division 4 and free forever** — above the wall on purpose, it is the best advert the game has. UTC-keyed |
| **data** | palmarès | races on record, the history table | PORT NOTE in `Store`: this becomes SwiftData, not one JSON blob |
| **settings** | preferences | steering mode, tilt calibration and sensitivity, lean direction, units, links to rules/glossary, the build number | steering is also changeable from the pause card — one shared implementation, two places that paint it |
| **rules** | how to play | | |
| **gloss** | cycling words | | a non-cyclist has to be able to read this game |
| **debug** | diagnostics | save state, the store kind, division/tactic levels, grant buttons, experiments | behind a gesture: hold the build number 5s, type the passphrase. Not persisted, so a shipped build starts clean |

---

## The race HUD

Not a screen — it is drawn on the canvas and is the actual game. What has to exist:

- **The pads**, bottom band split down the middle. Tapping IS pedalling; holding a side IS
  steering; both pads is easing, and on a descent it ramps to a full stop.
- **The action row**, the strip above the pads. Contextual button in the middle (throw, hop,
  musette, sticky bottle, mostly nothing) and, in a time trial, the two gear chevrons at the
  outer ends with the gear number in each pill.
- **LEGS**, and its projection slice when the power meter is carried.
- **The rhythm bar** in time trials, with the live target and the tolerance pocket, plus the
  gear ladder beside it.
- **The sheltering bar** in time trials, only while you are actually in someone's wheel.
- **The sprint corridor**, only when it can actually bite.
- **The radio strip and rider rail**, gated by race-radio level.
- **The wind arrow**, encoding both components.

**Three rules the HUD has learned the hard way**, all in `DECISIONS.md`:

1. **Additive screen furniture loses.** Verge streaks, a speed vignette and two mini-maps were
   all built to spec and cut on sight. What survives is changing what is already there.
2. **Only draw a cue when it can bite.** The sprint corridor and the sheltering bar are both
   gated on the situation being real, because a warning that is always on is noise.
3. **Point at the button, do not name the symptom.** The gear chevron you need lights up; it
   does not print "SPINNING" and leave you to translate.

---

## Traps that are HTML-specific and should simply vanish

Listed so nobody ports them by accident:

- `.go{display:block}` beats `.hide{display:none}` at equal specificity, so every `.go` button
  that needs hiding requires its own `#id.hide{display:none}`. This has bitten five times. In
  SwiftUI it is just `if`.
- `label()` writes to the global race canvas context, so any other canvas needs its own drawing.
- `show()` is a list of ids that must be kept in sync by hand. Make it an enum.
- The view lives in an IIFE, so its internals are unreachable from the browser tests and **the
  DOM is the contract**. In Swift, prefer testable view models — but keep the discipline that a
  test must not inject the thing it is testing for.
