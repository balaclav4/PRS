# Burn-down

Items marked [x] are done and verified in the browser. Numbering is kept
stable so commit messages that cite an item still point at it.

Findings from a measured walkthrough of the capture flow and a read of the
analytics screens, 8 Aug 2026. Nothing here is speculative: every item names the
file and, where it matters, the number that was measured.

Ordered by whether the app currently tells the user something untrue, then by
how much work it makes them do.

## Measured: taps to record a session

Walked in the browser with every interaction counted. Two targets from one
photograph, eight shots between them, using the demo photo and accepting the
default rifle, load and distance.

| phase | taps |
|---|---|
| Photograph in | 1 |
| Setup: choose bull reference, tap 3" preset | 2 |
| Continue | 1 |
| Target 1: four rim taps | 4 |
| Add target 2 | 1 |
| Target 2: four rim taps | 4 |
| Mark Shots | 1 |
| Eight shots | 8 |
| Switch back to target 1 | 1 |
| Review, Save | 2 |
| **Total** | **25** |

The actual walk took 30, because one target was marked badly and cost four taps
plus a Reset to recover. That recovery is item 3 below.

Cost model: `6T + S + 5` where T is targets and S is shots.

- 2 targets, 8 shots: 25 taps
- 6 targets, 5 shots each (a Vegas-style sheet): **71 taps**

Roughly half of that is rim tapping and target switching, not shot marking.

**Re-measured after the two-screen rebuild.** Four targets placed in eight taps,
whole session fifteen taps including three shots and a target switch. Cost model
is now `3T + S + 5`, so the six-bull sheet is **53 taps**.

---

## [x] 1. The trend verdict is a coin flip presented as a finding

`app/(tabs)/analytics.js:129`, `lib/analytics.js:111`

```js
const improving = n >= 2 && trend[n - 1] < trend[0];
```

Two data points, first against last, and each is that session's *minimum* group,
so it is a best-of-k that scales with how many targets were shot that day.

Simulated 20,000 times, 10 sessions of 5-shot groups:

| scenario | shows "Improving" |
|---|---|
| Shooter unchanged, 1 target per session | 50.5% |
| Shooter unchanged, 3 targets per session | 49.8% |
| Shooter unchanged, shoots more targets over time | 83.8% |
| Shooter genuinely 30% **worse**, shoots more targets | 61.8% |
| Shooter genuinely 40% tighter, constant targets | 92.6% |

Row four is the problem: a shooter getting measurably worse is told they are
improving, more often than not.

Fix: regress group size on session index, report the slope with a confidence
interval, and say "no detectable change" when it spans zero. `lib/stats.js`
already has everything needed. Being able to say "your groups have not changed"
is itself a result the app currently cannot express.

## [x] 2. The dashboard headline is a selection-biased statistic

`app/(tabs)/index.js:78`

"Best Group" is the minimum across every session. It only ever falls, never
reverts, and describes the luckiest day rather than the rifle. `lib/seating.js`
already carries best-of-k expectation for exactly this reason and nothing else
uses it.

Fix: headline a median or mean with a spread. Keep the best as a labelled
personal record.

## [x] 3. Rim tapping is blind, and recovery is all or nothing

Superseded and then closed. Two-tap placement measures the rim from the pixels,
so there is no set of taps to preview - the answer does not come from them.
Recovery is item 11. Nudging onto a different ring works by moving either dot,
which re-runs the measurement: on the NRA bull, dragging the edge dot outward
took the fit from 58px on the black disc to 105px on the printed ring.

`app/capture/index.js` step 2

No circle is drawn while tapping. Four points go down with no feedback, and only
then does the fit report. A bad set costs four taps plus a Reset, which is what
happened in the walkthrough.

Fix, in order of value:

- Draw the fitted circle live from the third tap so an error is visible before
  it is committed.
- On a poor fit, highlight the tap with the largest residual rather than
  offering only Reset. The residual per point is already computed in
  `lib/circlefit.js`.

## [x] 4. Already-marked targets are invisible while marking the next one

`app/capture/index.js:1096`

The corners overlay draws only `ordered`, the active target. Add a second target
and the first one's circle disappears. On a six-bull sheet there is nothing to
show which bulls are done, so double-marking one and missing another is easy and
silent.

The shots step already does this correctly at line 1277, drawing other targets'
shots. The wrong one was omitted.

## [x] 5. The distance unit is rendered and invisible

`app/capture/index.js` setup step

Measured in the browser: the Distance input is 215px wide inside a 163px box, so
the "yd" suffix is pushed out of view. The unit was added as asked and has never
been visible. Same cause as the ballistics screen, fixed there with
`minWidth: 0` on the flex item, because a web `<input>` defaults to 20
characters and a flex item will not shrink below intrinsic content width.

Worth auditing every screen with this field pattern rather than fixing one.

## [x] 6. Four rim taps per target where one gesture would do

A bull is a high-contrast disc, far easier to find than a bullet hole, and the
detector machinery already exists. Tap the centre once and fit the rim from the
image.

Cost model drops from `6T + S + 5` to `3T + S + 5`. On a six-bull sheet that is
71 taps down to 53.

Keep manual rim taps as the fallback when the fit is rejected.

## [x] 7. Average group pools incomparable numbers

`lib/analytics.js`

`avg` is the mean over all groups regardless of shot count. Expected extreme
spread grows with shot count, so a 3-shot group and a 10-shot group are not
measurements of the same quantity. The app reasons carefully about this in load
development and discards it here.

## [x] 8. Shot Distribution goes blank when the newest session has no group

`lib/analytics.js:118`

It reads `ordered[ordered.length - 1]` only. With ten sessions on file the card
can still read "No group recorded", and a full-size polar plot sits empty for a
reason the user cannot deduce. Fall back to the most recent session that has a
group, and say which one is being shown.

## [x] 9. Auto-detect presents suggestions as results

`app/capture/index.js`

Measured against the committed photographs: on a Shoot-N-C, five of the six
highest-scoring detections are printed lettering. The button offers no hint that
its output must be audited, and the markers it drops look identical to ones the
shooter placed.

Short term: word it as a suggestion and show detections in a distinct style
until confirmed. Long term is the colour work noted in `lib/detect.js`.

## 10. Smaller

- [x] Step chip read "Corners" while in Bull mode. The steps are now Photo,
  Setup, Place, Targets, Review.
- [x] The scale-reference selector appeared on both Setup and Place. Removed
  from Place, where switching cleared the active target's points, so a mis-tap
  mid-sheet threw away work to change a setting already made one step back.
- [x] The target chip row scrolled above the fold once several targets existed.
  The Targets step is reordered: chips, then the photo, then the prose. Measured
  before and after, the photo starts 27% down a phone rather than 58%, which
  also closes most of the over-explaining noted in the intuitiveness review.
- [x] "2 points" mode reviewed and kept. It is redundant *for round targets*,
  where bull does the same job and can tell when it is being lied to. It is not
  redundant in general: it is the only mode for a reference of known width that
  is not a circle and whose corners are not all in frame. Closed as not a defect
  rather than removed, because deleting working functionality to tidy a list is
  the wrong trade.

## [x] 11. The detail screen cannot adjust a fit

Placing a target measures its rim, and item 3's live preview is no longer the
right fix because there is nothing to preview: the answer comes from the pixels,
not the taps. What is missing is the other half - when the fit is rejected or
lands wrong, the detail screen shows the verdict but offers no way to nudge the
circle. Today the only recovery is Reset and re-place.

## [x] 12. Framing trades finger room against flyers

`lib/viewport.js`

The detail screen holds the bull at 62% of the viewport, which puts a .30 hole
on a 3in bull near 21px, up from 11px at whole-sheet zoom. Apple's minimum touch
target is 44pt, so this is better and still short of it.

Left at 62% deliberately, after working out which way the error runs. Raising
`fill` buys finger room and costs margin around the bull, and the margin is
where flyers land. A shot framed off screen is a shot that does not get marked,
which makes the group look tighter than it was - an error in the direction
nobody would question. Bigger fingers is a comfort problem; a dropped flyer is a
wrong number.

What did change: the frame now also takes in any shots already marked on the
target, so returning to one can never put a previously marked shot off screen.
Pinch and zoom remain for anything tighter.

---

## Found during the app-verification pass, 10 Aug 2026

## [x] 13. A refused bull fit was still used as the scale reference

`app/capture/index.js` — `measureBull`

The four-corner circle path refuses on quality:
`circleQuality(fit).ok ? circleQuad(fit) : null`. The two-tap path, which is
now the primary flow, returned a quad whatever the verdict said. So a fit the
app had itself judged unusable still counted as placed, still fed the
homography, and still carried a green tick.

What made it silent rather than merely wrong: an oblique fit becomes a
rectangle, `solveFor` fits a circle back to those four corners, and the four
corners of a rectangle are always exactly concyclic — so the re-fit is perfect,
passes its own quality check, and yields the circumcircle, whose diameter is
the rectangle's *diagonal*.

Measured on an NRA 50ft sheet: one bull read **94px** across where the same
bull on the same photograph read **65px**. A 45% scale error on every group
from that target, announced by a green tick.

Fixed: a fit that fails `rimQuality` yields no corners, so it is not placed and
does not tick. The fit itself is kept so the verdict still has something to
report. Placing no longer advances to a fresh target on a refusal either —
advancing moved the shooter off the one target needing attention and onto an
empty slot that looked like progress.

Verified: the same two taps that produced 94px now report `—px`, leave
`0 targets placed`, spawn no Target 2, and show no tick.

## [x] 14. Deprecated `pointerEvents` prop

The zoom fix used `pointerEvents="none"` as a prop, which RN 0.86 deprecates in
favour of `style.pointerEvents`. Five call sites moved. Tap accuracy at 1.6x
re-verified afterwards, since this is the exact code path the zoom bug lived in.

## Known and not fixed

- **Shots on the rim defeat the rim fit.** Same NRA sheet: the two bulls with
  clean rims fitted at 100% coverage and read square-on; the two with holes
  through the printed edge read 54 and 55 degrees off-axis. The app refuses
  these, which is the honest failure — it costs a refusal on a target that
  might have been measurable, not a scale error on one that was not. Recorded
  in `lib/rimfit.js` with the fix if it ever matters.
- **Dragging a placement marker is unverified.** Synthetic mouse drags do not
  drive `PanResponder` reliably, so this needs a finger. It is the only way to
  adjust a placed bull — taps past the second are deliberately inert so a stray
  tap cannot destroy a calibration — which makes it the recovery path for a
  refused fit and worth checking first on the phone.

---

# Pre-beta audit, 11 Aug 2026

Everything below is a gap, not a bug. Ordered by what it costs.

## A. Blocks a beta with strangers

## [ ] B1. Every new user inherits somebody else's rifles

`store/data.js` seeds three rifles, two loads, five sessions and a load
development project on first launch, gated on a `seeded` pref. That is right
for a demo and wrong for a tester: they open the app, see "Impact 737R" and
five sessions they did not shoot, and have no way to tell which data is theirs.
Worse, their first real session lands in a list of fiction, and any statistic
on the dashboard — typical group, best group, trend — is computed over invented
numbers.

Needs a first-run choice: start empty, or load the demo set and label it as
such. Settings already has Clear All Data, so the machinery exists; what is
missing is being asked.

## [ ] B2. No error boundary

A render error anywhere unmounts the tree to a blank screen with no message and
no way back except force-quitting. Grep confirms no `ErrorBoundary` and no
`componentDidCatch` in the project. On a device the shooter cannot open a
console, so "it went white" is all the report anyone can give.

One boundary at the root, one per tab, and a "something broke — go back" button
would turn a dead app into a recoverable one.

## [ ] B3. Nothing reports crashes

No Sentry, no Crashlytics, no logging of caught errors. During a beta the whole
point is finding out what breaks on hardware nobody here owns, and right now
the only channel is a tester remembering to describe it.

## [ ] B4. No way to send feedback

Related and cheaper: no in-app route to report anything. A tester who finds the
rim fit refusing a bull they think is fine has nowhere to put that.

## [ ] B5. Losing the phone loses everything

Sync is built and unwired, so data lives in one SQLite file. CSV export exists
but is manual and partial — it does not carry shots, aim points or scale, so an
export is not a backup. For a beta, either wire sync or add a real
export-and-restore, and say plainly which.

Legal blockers from `RELEASE.md` also bind here, not just at store submission:
the privacy policy has six placeholders and is not lawyer-reviewed, and the app
collects email addresses through authentication.

## B. Physics and tooling gaps a serious user will notice

## [ ] B6. The dope card omits the effects the app computes

Spin drift, Coriolis and aerodynamic jump are implemented, tested against
published forms, and shown in a separate "Long Range Effects" panel — which
says, in its own words, that the card does not include them. They come to
roughly a minute at 1000 yards. So the card a shooter carries is knowingly
incomplete, and the app is the thing that knows it.

This is the most incoherent thing in the app: the right numbers exist and are
not where they are used. Either fold them into the card behind a toggle, or
print them as a separate column.

## [ ] B7. No angle-of-fire correction

Nothing in `lib/` handles an inclined shot. PRS stages are shot up and down
hill routinely, and the correction is large enough to miss with — a 30 degree
angle removes about 13% of the drop. Standard treatments run from the rifleman's
rule to the improved-cosine method; the honest version also states where the
simple rule breaks down.

## [ ] B8. No powder temperature sensitivity

Velocity moves with ammunition temperature, typically enough to matter past
600 yards, and shooters routinely record it. Nothing models it and nothing asks.

## [ ] B9. Velocity truing

`trueBC` solves a BC backwards from dope. Muzzle velocity is at least as likely
to be the wrong input, and truing the two is a different and better-posed
problem than truing either alone.

## C. Discussed, agreed, not built

- **Wind as a bracket** on the dope card — drift per mph, or a 5/10/15/20
  matrix. Highest field value of anything on this list and nearly free, since
  drift is exactly linear in wind speed and the solver already knows it.
- **Trajectory chart.** Every number is computed; nothing is drawn. Both zero
  crossings, the apex and the transonic point.
- **Danger space / point-blank range** for a given target size.
- **Jump recorded per rifle.** The diagram teaches it; there is no field to put
  the CBTO-at-lands in, so seating rows are still raw CBTO.
- **Velocity against charge, with the SD band**, so a "node" can be seen to be
  inside the noise or outside it.
- **Magnetic declination** from the NOAA World Magnetic Model, public domain.
  Coriolis needs a true azimuth; a shooter reads a magnetic one off a compass.

## D. Known and accepted

- Splatter-target detection fails and says so.
- `expectedShots` built, measured as no improvement, deliberately unwired.
- No shipped BCs, ring diameters, torque figures or SAAMI/CIP dimensions.
