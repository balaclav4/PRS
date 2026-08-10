# Methods and provenance

Where every equation, table and constant in this app comes from.

Written because a number with no stated origin is the most dangerous thing in a
tool like this. It looks authoritative, it survives review because it is only a
number, and when it is wrong nothing fails: the app just reports a slightly
incorrect answer forever, and the shooter trues their load against it.

Each entry says which of four things it is:

- **Named method** - a published technique, used by name. The method is the
  contribution of whoever devised it; implementing it from the description is
  ordinary practice, and naming them is the point.
- **Public-domain data** - reference tables that belong to nobody.
- **Derived** - worked out here from first principles, with the derivation in
  the source file.
- **Measured** - produced by simulation in this repository, by a script that is
  committed so it can be re-run rather than trusted.

## On sources, plainly

Three ballistics books were shared with me during development. I did not
transcribe from them, and nothing here is copied text, tables or measured data.
What the app uses are the standard published *methods*, which are named below
and are described in many places. The distinction that matters:

- **Miller's twist rule, Litz's spin-drift and aerodynamic-jump forms, McCoy's
  Coriolis treatment** are methods. They are named in the source, used as
  described, and their stated limitations are carried into the app rather than
  hidden. `aerodynamicJump` refuses to give a confident answer outside the
  stability band its fit was built around, because that is what its author says
  about it.
- **Measured ballistic coefficients for specific bullets** are somebody's
  laboratory product, and are deliberately absent. The app takes BC as an input
  from the box, and `trueBC` solves it backwards from the shooter's own dope,
  which is a better number for their rifle than any published figure.
- **The G1 and G7 drag functions** are neither. They are century-old
  reference-projectile curves in the public domain, tabulated identically
  everywhere, describing two imaginary standard projectiles rather than any real
  bullet.

## Exterior ballistics

| What | Where | Kind |
|---|---|---|
| G1 / G7 drag tables | `lib/ballistics.js` | Public-domain data. Gavre Commission and US Army BRL reference drag functions. Anchor values asserted in `test-ballistics.mjs`: G1 is 0.2629 at Mach 0 and peaks at 0.6625 near Mach 1.4; G7 is 0.1198 at Mach 0 and peaks at 0.4043 near Mach 1.05. |
| Point-mass integration | `lib/ballistics.js` | Named method. Standard flat-fire point-mass equations of motion, integrated against the drag table. |
| Standard atmosphere, density ratio, speed of sound | `lib/ballistics.js`, `lib/effects.js` | Named method. ICAO standard atmosphere; density ratio exponent 4.2559. |
| Pressure altitude, density altitude | `lib/zeroing.js` | Named method. `DA = PA + 120 x (OAT - ISA)`, the standard field approximation. |
| BC truing | `lib/ballistics.js` | Derived. Solves BC backwards from observed dope by bisection. |
| Gyroscopic stability | `lib/effects.js` | Named method: Miller's twist rule, with the usual velocity and air-density corrections. |
| Spin drift | `lib/effects.js` | Named method: Litz's closed form, `1.25 x (Sg + 1.2) x TOF^1.83`. Recorded in the source as an empirical fit, not a derivation. |
| Aerodynamic jump | `lib/effects.js` | Named method: Litz's fit in MOA per mph. Its limitation is enforced in code - outside roughly Sg 1.3 to 2.3 it returns `reliable: false` and the screen says so instead of printing a number. |
| Coriolis, horizontal and Eotvos | `lib/effects.js` | Named method. Flat-fire Coriolis as in McCoy. Exact physics rather than a fit, and the source says which is which. |
| Custom drag curves | `lib/dragfn.js` | Derived plumbing, **no data shipped**. The app parses and stores a curve the shooter supplies and records where it came from; it ships none of its own. A measured Cd already contains the form factor, so it is divided by sectional density rather than by BC. `test-dragfn.mjs` checks the two paths agree: a curve `i x Cd_G7` carried at `SD = i x BC` reproduces the BC solve to 0.1 inch at 1000 yards. |
| Sectional density | `lib/dragfn.js` | Definition. `SD = (grains / 7000) / d^2`, in lb/in^2. |
| Implied BC across Mach | `lib/dragfn.js` | Derived. `BC(M) = SD / (Cd(M) / Cd_std(M))`, which is the definition rearranged. Drawn because the answer moves: it is what a single quoted BC is averaging over. |

## Statistics

| What | Where | Kind |
|---|---|---|
| Welch's t-test | `lib/stats.js` | Named method. |
| F-test for variance | `lib/stats.js` | Named method. |
| Clopper-Pearson exact binomial bounds | `lib/refload.js` | Named method. Chosen over Wilson after measuring that Wilson is anti-conservative at k = n, where it collapses to `n/(n+z^2)` and claimed 25 hits confirmed 90% when the exact answer needs 29. |
| Wilson score interval | `lib/refload.js` | Named method, display only, for the reason above. |
| Rayleigh sigma, CEP | `lib/stats.js` | Named method. |
| Lanczos gamma, incomplete beta and gamma | `lib/stats.js` | Named method. Standard numerical recipes; coefficients are the published Lanczos set. |
| Acklam's inverse normal CDF | `lib/stats.js` | Named method. |
| Best-of-k selection bias | `lib/seating.js` | Named method: Blom's approximation to expected order statistics. |
| Bootstrap difference | `lib/stats.js` | Named method. Seeded so a result is reproducible. |
| Group-size trend | `lib/trend.js` | Derived. Least squares on log group size against session index, with a confidence interval on the slope. Simulated in `test-trend.mjs`: claims a direction 8.7% of the time for a shooter who has not changed, against 50% for the rule it replaced. |
| E[extreme spread] / sigma by shot count | `lib/groupsize.js` | **Measured.** No closed form above n = 2. Simulated by `scripts/derive-es-factors.mjs`, 400,000 groups per shot count, mulberry32. Checked against the one case with a closed form: two bivariate normals are separated by a Rayleigh variate, so the mean is `sigma x sqrt(pi)` = 1.7725, and the table reproduces it to 0.03%. |

## Vision and geometry

| What | Where | Kind |
|---|---|---|
| Homography from four points (DLT) | `lib/homography.js` | Named method. |
| Centre-surround blob detection | `lib/detect.js` | Named method. Difference-of-boxes approximation to a Laplacian of Gaussian, via integral images. |
| Distance-transform splitting of merged holes | `lib/detect.js` | Derived. |
| Algebraic circle fit | `lib/circlefit.js` | Named method: Kasa. Its known bias on short arcs is noted, and `arcSpanDeg` refuses fits that would suffer from it. |
| Ellipse fit about a known centre | `lib/rimfit.js` | Derived. Polar form is linear in three coefficients, so it is an ordinary least squares solve rather than an eigenvalue problem; the 2x2 eigen-decomposition is closed form. |
| Obliquity from an ellipse | `lib/rimfit.js` | Derived. The axis ratio is `cos t` directly. |
| Scale-error from a circle-fit residual | `lib/circlefit.js` | Derived, and corrected after being wrong. The first version inverted `(1 - cos t)/2` and under-read a 30 degree tilt as 26. The correct relation is residual `(1-k)/(1+k)` for semi-axes `a` and `ak`, RMS about that over root two. Checked against synthetic ellipses at 15, 25, 30 and 40 degrees. |

## Units and conventions

| What | Where | Kind |
|---|---|---|
| 1 MOA = 1.047 inches per 100 yd | `lib/units.js`, `lib/analytics.js` | Derived. `2 x 100yd x 36 x tan(1/60 degree)`. |
| 1 mil = 3.6 inches per 100 yd | `lib/units.js` | Derived. |
| Rec. 709 luma | `lib/detect.js` | Named standard. |
| Inch, yard, foot, grain conversions | `lib/units.js` | Definitional. |

## What is not backed by anything yet

Kept here rather than in a comment nobody reads.

- **Splatter-target detection.** Measured against real photographs and recorded
  as failing: on a Shoot-N-C, five of the six best-scoring detections are
  printed lettering. `lib/detect.js` states the cause and the intended fix. The
  UI says "Suggest shots" rather than claiming to have found them.
- **Bull diameter presets** are Shoot-N-C sizes only, because those are printed
  on the packaging. Competition ring diameters are deliberately not listed: a
  guessed reference size is a scale error applied silently to every measurement
  taken from that photograph.
- **Torque figures** are entered by the shooter. The app ships no defaults,
  because a wrong torque value can damage a rifle or a scope, and the
  manufacturer's figure is the only one worth having.
