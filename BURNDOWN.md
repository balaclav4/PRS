# Burn-down

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

---

## 1. The trend verdict is a coin flip presented as a finding

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

## 2. The dashboard headline is a selection-biased statistic

`app/(tabs)/index.js:78`

"Best Group" is the minimum across every session. It only ever falls, never
reverts, and describes the luckiest day rather than the rifle. `lib/seating.js`
already carries best-of-k expectation for exactly this reason and nothing else
uses it.

Fix: headline a median or mean with a spread. Keep the best as a labelled
personal record.

## 3. Rim tapping is blind, and recovery is all or nothing

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

## 4. Already-marked targets are invisible while marking the next one

`app/capture/index.js:1096`

The corners overlay draws only `ordered`, the active target. Add a second target
and the first one's circle disappears. On a six-bull sheet there is nothing to
show which bulls are done, so double-marking one and missing another is easy and
silent.

The shots step already does this correctly at line 1277, drawing other targets'
shots. The wrong one was omitted.

## 5. The distance unit is rendered and invisible

`app/capture/index.js` setup step

Measured in the browser: the Distance input is 215px wide inside a 163px box, so
the "yd" suffix is pushed out of view. The unit was added as asked and has never
been visible. Same cause as the ballistics screen, fixed there with
`minWidth: 0` on the flex item, because a web `<input>` defaults to 20
characters and a flex item will not shrink below intrinsic content width.

Worth auditing every screen with this field pattern rather than fixing one.

## 6. Four rim taps per target where one gesture would do

A bull is a high-contrast disc, far easier to find than a bullet hole, and the
detector machinery already exists. Tap the centre once and fit the rim from the
image.

Cost model drops from `6T + S + 5` to `3T + S + 5`. On a six-bull sheet that is
71 taps down to 53.

Keep manual rim taps as the fallback when the fit is rejected.

## 7. Average group pools incomparable numbers

`lib/analytics.js`

`avg` is the mean over all groups regardless of shot count. Expected extreme
spread grows with shot count, so a 3-shot group and a 10-shot group are not
measurements of the same quantity. The app reasons carefully about this in load
development and discards it here.

## 8. Shot Distribution goes blank when the newest session has no group

`lib/analytics.js:118`

It reads `ordered[ordered.length - 1]` only. With ten sessions on file the card
can still read "No group recorded", and a full-size polar plot sits empty for a
reason the user cannot deduce. Fall back to the most recent session that has a
group, and say which one is being shown.

## 9. Auto-detect presents suggestions as results

`app/capture/index.js`

Measured against the committed photographs: on a Shoot-N-C, five of the six
highest-scoring detections are printed lettering. The button offers no hint that
its output must be audited, and the markers it drops look identical to ones the
shooter placed.

Short term: word it as a suggestion and show detections in a distinct style
until confirmed. Long term is the colour work noted in `lib/detect.js`.

## 10. Smaller

- Step chip reads "Corners" while in Bull mode tapping a rim.
  `app/capture/index.js` `STEP_LABELS`.
- The scale-reference selector now appears on both Setup and Corners. The first
  was added without removing the second.
- The target chip row scrolls above the fold once a second target is added, so
  the control for switching targets is off screen while marking them.
- "2 points" mode is now redundant for round targets: bull does the same job and
  can report when it is being lied to, which span cannot.
