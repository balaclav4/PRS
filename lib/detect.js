/**
 * Bullet-hole detection.
 *
 * This is deliberately not machine learning. The app already knows two things
 * that collapse the problem: the bullet diameter (from the load's caliber) and
 * the image scale (from the user's two calibration taps). Together those pin
 * the expected hole radius in pixels to within a few percent, which turns
 * open-ended blob finding into a matched filter at a *known* scale.
 *
 * The filter is a difference-of-boxes centre-surround operator — a Laplacian of
 * Gaussian approximation that runs in O(1) per pixel via integral images, so
 * cost is independent of the radius.
 *
 * Everything here is pure and works on a plain grayscale array, so it can be
 * tested headlessly against synthetic targets with known hole positions.
 */

/** Rec. 709 luma from RGBA bytes. */
export function toGrayscale(rgba, width, height) {
  const out = new Float32Array(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = 0.2126 * rgba[p] + 0.7152 * rgba[p + 1] + 0.0722 * rgba[p + 2];
  }
  return out;
}

/** Summed-area table. Indexed (w+1) x (h+1) so box sums need no bounds logic. */
export function integralImage(src, w, h) {
  const W = w + 1;
  const ii = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += src[y * w + x];
      ii[(y + 1) * W + (x + 1)] = ii[y * W + (x + 1)] + rowSum;
    }
  }
  return ii;
}

/** Mean of the axis-aligned box [x0,x1] x [y0,y1], clamped to the image. */
function boxMean(ii, w, h, cx, cy, r) {
  const x0 = Math.max(0, cx - r), y0 = Math.max(0, cy - r);
  const x1 = Math.min(w - 1, cx + r), y1 = Math.min(h - 1, cy + r);
  const W = w + 1;
  const sum =
    ii[(y1 + 1) * W + (x1 + 1)] - ii[y0 * W + (x1 + 1)] -
    ii[(y1 + 1) * W + x0] + ii[y0 * W + x0];
  const area = (x1 - x0 + 1) * (y1 - y0 + 1);
  return sum / area;
}

/** Median of a sampled subset — full sort on 1MP would dominate runtime. */
function approxMedian(arr, sampleStride = 7) {
  const s = [];
  for (let i = 0; i < arr.length; i += sampleStride) s.push(arr[i]);
  s.sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Median absolute deviation — robust spread, unlike std which the holes skew. */
function mad(arr, med, sampleStride = 7) {
  const s = [];
  for (let i = 0; i < arr.length; i += sampleStride) s.push(Math.abs(arr[i] - med));
  s.sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] || 1e-6;
}

/**
 * Sensor noise estimate from adjacent-pixel differences.
 *
 * Real detail is correlated between neighbours; noise is not, so the median
 * absolute horizontal difference is dominated by noise. The 0.6745 converts
 * MAD to a Gaussian sigma, and the sqrt(2) accounts for differencing two noisy
 * samples. Used to set a contrast floor — without one, a low-contrast noise
 * blob scores high symmetry simply because its ring variance is tiny too.
 */
function estimateNoise(gray, w, h) {
  const diffs = [];
  for (let y = 1; y < h - 1; y += 3) {
    for (let x = 1; x < w - 2; x += 3) {
      diffs.push(Math.abs(gray[y * w + x + 1] - gray[y * w + x]));
    }
  }
  if (!diffs.length) return 1;
  diffs.sort((a, b) => a - b);
  return (diffs[Math.floor(diffs.length / 2)] / 0.6745) / Math.SQRT2 || 1;
}

/**
 * Centre-surround response map.
 *
 * response[i] > 0 means "darker than surroundings" (a hole punched in light
 * paper); < 0 means brighter (a hole over a black bullseye, where the backing
 * or light shows through). Both are real cases, so the caller considers |r|.
 */
function centreSurround(ii, w, h, rIn, rOut) {
  const resp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const centre = boxMean(ii, w, h, x, y, rIn);
      const surround = boxMean(ii, w, h, x, y, rOut);
      resp[y * w + x] = surround - centre;
    }
  }
  return resp;
}

/**
 * Rejects edges, printed rings and text, which can out-respond a hole on the
 * centre-surround filter but are not radially symmetric.
 *
 * Samples the image on a ring just inside the hole and compares it against the
 * paper just outside. A real hole is uniformly dark all the way round; a line
 * or letter stroke is dark on two sides and light on the others, giving high
 * variance across the ring.
 */
function radialSymmetry(gray, w, h, cx, cy, r, polarity) {
  const N = 12;
  const inner = [], outer = [];
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2;
    const ix = Math.round(cx + Math.cos(a) * r * 0.55);
    const iy = Math.round(cy + Math.sin(a) * r * 0.55);
    const ox = Math.round(cx + Math.cos(a) * r * 1.9);
    const oy = Math.round(cy + Math.sin(a) * r * 1.9);
    if (ix >= 0 && ix < w && iy >= 0 && iy < h) inner.push(gray[iy * w + ix]);
    if (ox >= 0 && ox < w && oy >= 0 && oy < h) outer.push(gray[oy * w + ox]);
  }
  if (inner.length < N * 0.6 || outer.length < N * 0.6) return { symmetry: 0, contrast: 0 };

  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const std = (a, m) => Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length);

  const innerMean = mean(inner), outerMean = mean(outer);
  const contrast = polarity > 0 ? outerMean - innerMean : innerMean - outerMean;
  if (contrast <= 0) return { symmetry: 0, contrast: 0 };

  const denom = Math.abs(contrast) + 1e-6;
  // Inner ring uniform => the centre really is a disc, not a stroke or corner.
  const innerConsistency = Math.max(0, 1 - std(inner, innerMean) / denom);
  // Outer ring uniform => the disc is surrounded on all sides. This is what
  // separates a hole from a point just inside a printed bullseye's edge, where
  // the surroundings are black on one side and paper on the other.
  const outerConsistency = Math.max(0, 1 - std(outer, outerMean) / denom);

  return { symmetry: Math.min(innerConsistency, outerConsistency), contrast };
}

/**
 * Intensity-weighted centroid, for sub-pixel placement of the final mark.
 *
 * A full hole-radius window measured best: tightening it to 0.5-0.8r made
 * touching-hole accuracy worse (1.20px vs 1.02px), because the smaller sample
 * is noisier. The residual ~1px error on overlapping holes is inherent — two
 * merged holes have no separable centroid — versus 0.02px on isolated holes.
 */
function refineCentre(gray, w, h, cx, cy, r, polarity, background) {
  let sw = 0, sx = 0, sy = 0;
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy > R * R) continue;
      const x = cx + dx, y = cy + dy;
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      const v = gray[y * w + x];
      const weight = polarity > 0 ? background - v : v - background;
      if (weight > 0) { sw += weight; sx += weight * x; sy += weight * y; }
    }
  }
  return sw > 0 ? { x: sx / sw, y: sy / sw } : { x: cx, y: cy };
}

/**
 * Detect bullet holes.
 *
 * @param gray    grayscale intensities, length width*height
 * @param radiusPx expected hole radius in pixels (from caliber + scale)
 * @returns candidates sorted by descending confidence, in pixel coordinates
 */
export function detectShots(gray, width, height, options = {}) {
  const {
    radiusPx,
    maxDetections = 60,
    // Detection collapses once the assumed radius is off by more than ~1.5x, so
    // sweep around the estimate rather than trusting the user's scale taps to
    // be exact. Measured envelope per scale is roughly 0.7x-1.5x.
    scales = [0.75, 1.0, 1.35],
  } = options;

  if (!radiusPx || radiusPx < 1.2) {
    return { shots: [], reason: 'Scale too coarse to resolve holes — zoom in or set the scale more precisely.' };
  }

  const all = [];
  for (const k of scales) {
    const r = radiusPx * k;
    if (r < 1.2) continue;
    all.push(...detectAtRadius(gray, width, height, r, options));
  }

  // Rank by score, but nudge toward the caliber-derived radius. Two touching
  // holes read as one larger blob at a coarse scale; without this preference
  // that blob can outrank the two real holes it spans.
  for (const s of all) {
    s.rank = s.score * (1 - 0.12 * Math.abs(Math.log(s.radius / radiusPx)));
  }
  all.sort((a, b) => b.rank - a.rank);

  // Merge across scales. Suppression uses the larger of the two radii so a
  // coarse blob spanning a pair is rejected once either real hole is kept,
  // while the pair itself — separated by more than one hole radius — survives.
  const kept = [];
  for (const s of all) {
    const clash = kept.some(k =>
      Math.hypot(k.x - s.x, k.y - s.y) < Math.max(s.radius, k.radius) * 1.1
    );
    if (!clash) kept.push(s);
    if (kept.length >= maxDetections) break;
  }

  return {
    shots: kept,
    reason: kept.length === 0
      ? 'No holes found. Check the scale marks match the reference object, or mark shots manually.'
      : null,
  };
}

/** One pass of the pipeline at a single assumed hole radius. */
function detectAtRadius(gray, width, height, r, options = {}) {
  const {
    minSymmetry = 0.35,
    sensitivity = 1.0, // higher = more permissive
  } = options;
  const rIn = Math.max(1, Math.round(r * 0.8));
  const rOut = Math.max(rIn + 2, Math.round(r * 2.2));

  const ii = integralImage(gray, width, height);
  const resp = centreSurround(ii, width, height, rIn, rOut);

  // A hole must be darker (or brighter) than its surroundings by clearly more
  // than the sensor noise, otherwise noise blobs pass the symmetry test.
  const noiseSigma = estimateNoise(gray, width, height);
  const minContrast = Math.max(options.minContrast ?? 14, noiseSigma * 4);

  // Robust threshold: holes are rare, so most of the response map is noise.
  const absResp = new Float32Array(resp.length);
  for (let i = 0; i < resp.length; i++) absResp[i] = Math.abs(resp[i]);
  const med = approxMedian(absResp);
  const spread = mad(absResp, med);
  const threshold = med + (4.0 / sensitivity) * spread;

  // Non-maximum suppression over a hole-sized window.
  const nmsR = Math.max(2, Math.round(r * 1.1));
  // Inside this margin the surround box clamps against the edge, so its mean is
  // biased and produces phantom responses along the border.
  const margin = rOut + 1;
  const peaks = [];
  for (let y = margin; y < height - margin; y++) {
    for (let x = margin; x < width - margin; x++) {
      const v = absResp[y * width + x];
      if (v < threshold) continue;
      let isMax = true;
      for (let dy = -nmsR; dy <= nmsR && isMax; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -nmsR; dx <= nmsR; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          const o = absResp[yy * width + xx];
          if (o > v || (o === v && (yy < y || (yy === y && xx < x)))) { isMax = false; break; }
        }
      }
      if (isMax) peaks.push({ x, y, v, polarity: Math.sign(resp[y * width + x]) || 1 });
    }
  }

  // Validate each peak for radial symmetry, then refine to sub-pixel.
  const shots = [];
  for (const p of peaks) {
    const { symmetry, contrast } = radialSymmetry(gray, width, height, p.x, p.y, r, p.polarity);
    if (symmetry < minSymmetry || contrast < minContrast) continue;

    const background = boxMean(ii, width, height, p.x, p.y, rOut);
    const c = refineCentre(gray, width, height, p.x, p.y, r, p.polarity, background);

    // Confidence blends how far above noise the response is with how round it is.
    const strength = Math.min(1, (p.v - threshold) / (threshold + 1e-6) + 0.5);
    shots.push({
      x: c.x,
      y: c.y,
      radius: r,
      polarity: p.polarity,
      contrast: +contrast.toFixed(1),
      symmetry: +symmetry.toFixed(3),
      score: +(strength * 0.5 + symmetry * 0.5).toFixed(3),
    });
  }

  return shots;
}
