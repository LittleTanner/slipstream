#!/usr/bin/env python3
# Browser smoke suite: drives a THROWAWAY copy of index.html through every screen,
# every drill, and one shrunk race end to end. Catches the show()-registration and
# dead-button gotcha classes that the headless sim tests can never see.
#
#   python3 tools/browser/smoke.py            # tests the repo's index.html
#   python3 tools/browser/smoke.py --src F    # tests a specific copy (mutation runs)
#
# The real index.html is never modified: the source is copied to a temp dir with two
# patches (tutorial bypass, STAGES[0] len 1400 -> 320 so a race takes ~30s).
# Chromium: set PW_CHROMIUM to an executable to override; falls back to the
# /opt/pw-browsers/chromium symlink if present, else playwright's default.
# Exit 0 only if every flow passed. One line per flow, then a final PASS/FAIL line.

import asyncio
import os
import pathlib
import re
import sys
import tempfile
import time

from playwright.async_api import async_playwright

REPO = pathlib.Path(__file__).resolve().parents[2]

PATCHES = [
    # bypass the first-run tutorial (DEV-LOOP "Playwright patterns that work")
    ("let ladder = { div: 8,", "let ladder = { div: 8, tutorialDone: true,"),
    # shrink STAGES[0] so the end-to-end race takes ~30s instead of ~3 minutes
    ("len: 1400", "len: 320"),
    # Publish the team car's phase so the continuity flow can watch it. teamCar is a
    # view closure and unreachable from evaluate, and the bug this catches (the car
    # blinking out for a single frame between the wheel change and the tow) is invisible
    # to a screenshot. Inert for every other flow: it only appends to an array.
    ("if (!teamCar.phase) return;",
     "if (!teamCar.phase) { (window.__tcLog=window.__tcLog||[]).push(0); return; }"),
    ("const cd = you.dist + teamCar.dOff, cy = sy(cd);",
     "(window.__tcLog=window.__tcLog||[]).push(teamCar.phase);"
     " const cd = you.dist + teamCar.dOff, cy = sy(cd);"),
]

RACE_DEADLINE = 90          # a race that never finishes within 90s is a FAIL
DRILL_SOAK = 3.0            # seconds a launched drill must run without a page error


def src_path():
    argv = sys.argv[1:]
    if "--src" in argv:
        i = argv.index("--src")
        if i + 1 >= len(argv):
            print("FAIL setup: --src needs a path")
            sys.exit(1)
        return pathlib.Path(argv[i + 1]).resolve()
    if os.environ.get("SMOKE_SRC"):
        return pathlib.Path(os.environ["SMOKE_SRC"]).resolve()
    return REPO / "index.html"


def build_throwaway(src, dstdir):
    text = src.read_text()
    for old, new in PATCHES:
        n = text.count(old)
        if n != 1:
            print("FAIL setup: patch anchor %r matched %d times (want exactly 1) in %s"
                  % (old, n, src))
            sys.exit(1)
        text = text.replace(old, new)
    dst = pathlib.Path(dstdir) / "smoke-index.html"
    dst.write_text(text)
    return dst.as_uri()


async def launch(p):
    exe = os.environ.get("PW_CHROMIUM")
    if not exe and os.path.exists("/opt/pw-browsers/chromium"):
        exe = "/opt/pw-browsers/chromium"
    if exe:
        return await p.chromium.launch(executable_path=exe)
    return await p.chromium.launch()


async def new_page(browser, uri):
    """Fresh context = fresh localStorage, so no flow inherits another's save."""
    ctx = await browser.new_context()
    # Abort the font CDN fetches (the game's only network traffic). They are pure
    # noise here, and in a sandbox they can stall every page load for seconds.
    await ctx.route(re.compile(r"^https?://"), lambda route: route.abort())
    pg = await ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e).splitlines()[0]))
    pg.set_default_timeout(4000)
    # domcontentloaded, not load: the font CDN request can stall the load event for
    # many seconds in a sandbox (its 403 is the one expected console noise)
    await pg.goto(uri, wait_until="domcontentloaded", timeout=15000)
    await pg.locator("#menu").wait_for(state="visible", timeout=6000)
    return ctx, pg, errs


def first_err(errs, base):
    return errs[base] if len(errs) > base else None


# ---------------------------------------------------------------- flows

async def flow_load(browser, uri):
    ctx, pg, errs = await new_page(browser, uri)
    try:
        await pg.wait_for_timeout(1500)
        if errs:
            return False, "page error on load: " + errs[0]
        if not await pg.locator("#startBtn").is_visible():
            return False, "#menu visible but #startBtn is not"
        return True, "menu up, no page errors"
    finally:
        await ctx.close()


# (click this id) -> (this screen id becomes visible). Ground truth: the show()
# list and the addEventListener block in index.html.
SCREEN_STEPS = [
    ("setBtn",      "settings"),
    ("rulesBtn",    "rules"),
    ("rulesBack",   "settings"),
    ("glossBtn",    "gloss"),
    ("glossBack",   "settings"),
    ("dataBtnMenu", "data"),      # palmares
    ("dataBack",    "settings"),
    ("setBack",     "menu"),
    ("pracBtn",     "practice"),
    ("drillBtn",    "drills"),
    ("drillBack",   "practice"),
    ("pBack",       "menu"),
    ("routesBtn",   "routes"),
    ("routesBack",  "menu"),
    ("startBtn",    "pick"),      # race picker
    ("pickBack",    "menu"),
]


async def flow_screens(browser, uri):
    ctx, pg, errs = await new_page(browser, uri)
    try:
        for btn, screen in SCREEN_STEPS:
            base = len(errs)
            await pg.click("#" + btn)
            try:
                await pg.locator("#" + screen).wait_for(state="visible", timeout=3000)
            except Exception:
                e = first_err(errs, base)
                return False, ("#%s never became visible after clicking #%s"
                               % (screen, btn)) + (" (page error: %s)" % e if e else
                               " (dead button / show() registration?)")
            e = first_err(errs, base)
            if e:
                return False, "page error opening #%s: %s" % (screen, e)
        return True, "%d transitions incl. settings, rules, gloss, palmares, practice, drills, routes, picker" % len(SCREEN_STEPS)
    finally:
        await ctx.close()


async def open_drills(pg):
    await pg.click("#pracBtn")
    await pg.locator("#practice").wait_for(state="visible")
    await pg.click("#drillBtn")
    await pg.locator("#drills").wait_for(state="visible")


async def flow_drills(browser, uri):
    ctx, pg, errs = await new_page(browser, uri)
    try:
        await open_drills(pg)
        picks = pg.locator("#drillList button.pick")
        count = await picks.count()
        if count == 0:
            return False, "drill list is empty"
        names = [t.split("\n")[0] for t in await picks.all_inner_texts()]
        for i in range(count):
            if i > 0:                       # reload between drills: clean slate each time
                await pg.goto(uri, wait_until="domcontentloaded", timeout=15000)
                await pg.locator("#menu").wait_for(state="visible", timeout=6000)
                await open_drills(pg)
            base = len(errs)
            await picks.nth(i).click()
            await pg.locator("#drillBrief").wait_for(state="visible")
            await pg.click("#dbGo")
            try:
                # startDrill hides every screen and reveals the Done button: that IS the drill HUD
                await pg.locator("#drillDone").wait_for(state="visible", timeout=3000)
            except Exception:
                e = first_err(errs, base)
                return False, "drill %d/%d '%s' never started" % (i + 1, count, names[i]) \
                    + (" (page error: %s)" % e if e else "")
            if not await pg.locator("#drillBrief").is_hidden():
                return False, "drill %d/%d '%s': brief screen still up over the race" % (i + 1, count, names[i])
            await pg.wait_for_timeout(int(DRILL_SOAK * 1000))
            e = first_err(errs, base)
            if e:
                return False, "drill %d/%d '%s' errored while running: %s" % (i + 1, count, names[i], e)
        return True, "%d/%d launched and ran %.0fs each without error" % (count, count, DRILL_SOAK)
    finally:
        await ctx.close()


async def pause_check(pg):
    """Mid-race: pause card opens, #pCal stays hidden under drag steering, resume works."""
    if not await pg.locator("#pauseBtn").is_visible():
        return False, "#pauseBtn not visible mid-race"
    await pg.click("#pauseBtn")
    try:
        await pg.locator("#pauseCard").wait_for(state="visible", timeout=2000)
    except Exception:
        return False, "#pauseCard never appeared after tapping #pauseBtn"
    # judge #pCal, but ALWAYS resume: leaving the game paused would fail the race
    # flow too and bury this verdict under a secondary timeout
    pcal_shown = not await pg.locator("#pCal").is_hidden()
    await pg.click("#pResume")
    try:
        await pg.locator("#pauseCard").wait_for(state="hidden", timeout=2000)
    except Exception:
        return False, "#pauseCard stuck open after #pResume"
    if pcal_shown:
        return False, "#pCal (recalibrate tilt) visible while steering is drag"
    return True, "card opened, #pCal hidden under drag, resumed"


async def flow_race(browser, uri):
    """Tour path end to end on the shrunk stage; the pause check runs mid-race."""
    pause_res = (False, "race never reached the pause point")
    ctx, pg, errs = await new_page(browser, uri)
    try:
        await pg.click("#startBtn")
        await pg.locator("#pick").wait_for(state="visible")
        # Three-day tour: its schedule always opens with stage 0, the one we shrank
        card = pg.locator("#pickBody .card", has_text="Three-day tour")
        if await card.count() == 0:
            return (False, "no 'Three-day tour' card on the picker"), pause_res
        await card.locator("button.mini").click()
        await pg.locator("#build").wait_for(state="visible")
        await pg.click("#bLock")
        await pg.locator("#brief").wait_for(state="visible")
        await pg.click("#rollBtn")
        try:
            # startStage un-hides the pause button: that is "the race is on"
            await pg.locator("#pauseBtn").wait_for(state="visible", timeout=3000)
        except Exception:
            e = first_err(errs, 0)
            return (False, "race never started after Roll out"
                    + (" (page error: %s)" % e if e else "")), pause_res
        if not await pg.locator("#brief").is_hidden():
            return (False, "briefing screen still up after Roll out"), pause_res

        # Pedal: strict z/x alternation (same side twice is a missed pedal)
        t0 = time.monotonic()
        side, last_look, paused_yet, finished = 0, 0.0, False, False
        while time.monotonic() - t0 < RACE_DEADLINE:
            await pg.keyboard.press("z" if side == 0 else "x")
            side ^= 1
            await asyncio.sleep(0.11)
            el = time.monotonic() - t0
            if not paused_yet and el > 12:          # past the 7s neutral roll-out
                pause_res = await pause_check(pg)
                paused_yet = True
            if el - last_look >= 1.0:
                last_look = el
                if await pg.locator("#result").is_visible():
                    finished = True
                    break
        if not paused_yet:
            pause_res = (False, "race ended before the pause point")
        if not finished:
            return (False, "no results after %ds (deadline %ds)"
                    % (int(time.monotonic() - t0), RACE_DEADLINE)), pause_res
        rows = await pg.locator("#rBoard .row").count()
        if rows < 1:
            return (False, "results screen up but the finish order board is empty"), pause_res
        if errs:
            return (False, "race finished but a page error fired: " + errs[0]), pause_res
        return (True, "three-day tour stage 1 finished in %.0fs, %d riders on the board"
                % (time.monotonic() - t0, rows)), pause_res
    finally:
        await ctx.close()


async def flow_daily(browser, uri):
    """Daily challenge start: menu -> daily -> build -> roll out -> 12s soak.

    Exists because the daily start path shipped a freeze the other flows could not
    see: the daily always fits radio level 3, whose LEADER readout hit an
    out-of-scope variable and killed the rAF loop with a ReferenceError. The soak
    covers the countdown, the flag and the first racing seconds on TODAY'S course
    (the template rotates with the real date, which makes this a rolling canary).
    """
    ctx, pg, errs = await new_page(browser, uri)
    try:
        await pg.click("#dailyBtn")
        await pg.locator("#daily").wait_for(state="visible")
        if await pg.locator("#dRide").is_disabled():
            return False, "daily 'Ride it' disabled on a fresh profile"
        await pg.click("#dRide")
        await pg.locator("#build").wait_for(state="visible")
        await pg.click("#bLock")
        await pg.locator("#brief").wait_for(state="visible")
        base = len(errs)
        await pg.click("#rollBtn")
        try:
            await pg.locator("#brief").wait_for(state="hidden", timeout=3000)
        except Exception:
            e = first_err(errs, base)
            return False, "daily never started after Roll out" \
                + (" (page error: %s)" % e if e else "")
        # The freeze presented as a dead rAF loop, so assert the loop is ALIVE at the
        # end of the soak, not just that no error fired.
        side = 0
        t0 = time.monotonic()
        while time.monotonic() - t0 < 12:
            await pg.keyboard.press("z" if side == 0 else "x")
            side ^= 1
            await asyncio.sleep(0.11)
        e = first_err(errs, base)
        if e:
            return False, "page error during the daily: " + e
        f0 = await pg.evaluate("window.__smokeF = 0; requestAnimationFrame(function c(){window.__smokeF++; requestAnimationFrame(c)}); 0")
        await pg.wait_for_timeout(1000)
        frames = await pg.evaluate("window.__smokeF")
        if frames < 20:
            return False, "render loop nearly dead: %d frames in 1s" % frames
        return True, "daily rolled out and ran 12s, loop alive (%d fps)" % frames
    finally:
        await ctx.close()


async def flow_teamcar(browser, uri):
    """ONE car does the whole job: arrives, changes the wheel, pulls through, tows.

    The puncture drill loops the cycle, so the phase log should read exactly
    1 (arriving) 2 (alongside) 3 (pulling through) 4 (towing) with no 0 in between.
    A 0 mid-job means the car vanished and a second one appeared up the road — the
    continuity break this replaced. An out-of-order run means it restarted its run-up.
    """
    ctx, pg, errs = await new_page(browser, uri)
    try:
        await open_drills(pg)
        card = pg.locator("button.pick", has_text="Punctures and the team car")
        if await card.count() == 0:
            return False, "no 'Punctures and the team car' drill on the list"
        await card.click()
        await pg.locator("#drillBrief").wait_for(state="visible")
        await pg.click("#dbGo")
        await pg.locator("#drillDone").wait_for(state="visible")
        side = 0
        t0 = time.monotonic()
        # one full cycle is ~14s of drill time; 40s covers it with margin
        while time.monotonic() - t0 < 40:
            await pg.keyboard.press("z" if side == 0 else "x")
            side ^= 1
            await asyncio.sleep(0.09)
        log = await pg.evaluate("window.__tcLog || []")
        if not log:
            return False, "the team car never drew at all (instrumentation or drill broken)"
        runs = []
        for v in log:
            if not runs or runs[-1] != v:
                runs.append(v)
        for need, name in ((1, "arriving"), (2, "alongside"), (3, "pulling through"), (4, "towing")):
            if need not in runs:
                return False, "car never reached phase %d (%s): %s" % (need, name, runs[:8])
        core = runs[runs.index(1):runs.index(4) + 1]
        if 0 in core:
            return False, "car VANISHED mid-job (a 0 between arriving and towing): %s" % core
        if core != [1, 2, 3, 4]:
            return False, "car did not go straight through the job: %s" % core
        if errs:
            return False, "page error during the wheel change: " + errs[0]
        return True, "one car: arrive, change, pull through, tow (%s)" % core
    finally:
        await ctx.close()


# ---------------------------------------------------------------- main

async def main():
    src = src_path()
    if not src.is_file():
        print("FAIL setup: source not found: %s" % src)
        sys.exit(1)
    results = []
    with tempfile.TemporaryDirectory(prefix="slipstream-smoke-") as tmp:
        uri = build_throwaway(src, tmp)
        async with async_playwright() as p:
            browser = await launch(p)
            try:
                for name, fn in [("load", flow_load), ("screens", flow_screens),
                                 ("drills", flow_drills), ("daily", flow_daily),
                                 ("teamcar", flow_teamcar)]:
                    t0 = time.monotonic()
                    try:
                        ok, detail = await fn(browser, uri)
                    except Exception as e:
                        ok, detail = False, "flow crashed: " + str(e).splitlines()[0]
                    results.append((name, ok, "%s  (%.0fs)" % (detail, time.monotonic() - t0)))
                t0 = time.monotonic()
                try:
                    race_res, pause_res = await flow_race(browser, uri)
                except Exception as e:
                    race_res = (False, "flow crashed: " + str(e).splitlines()[0])
                    pause_res = (False, "race flow crashed before the pause check")
                results.append(("race", race_res[0],
                                "%s  (%.0fs)" % (race_res[1], time.monotonic() - t0)))
                results.append(("pause", pause_res[0], pause_res[1]))
            finally:
                await browser.close()
    for name, ok, detail in results:
        print("%s  %-8s %s" % ("PASS" if ok else "FAIL", name + ":", detail))
    failed = sum(1 for _, ok, _ in results if not ok)
    print("---")
    print("FAIL: %d of %d smoke flows failed" % (failed, len(results)) if failed
          else "PASS: all %d smoke flows" % len(results))
    sys.exit(1 if failed else 0)


asyncio.run(main())
