export function computeScale(p1, p2, markerDiameterIn) {
  const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
  if (dist === 0) return null;
  return markerDiameterIn / dist;
}

export function computeGroupStats(shots, inchesPerUnit, distanceYd) {
  if (shots.length < 2 || !inchesPerUnit) return null;

  const cx = shots.reduce((a, s) => a + s.x, 0) / shots.length;
  const cy = shots.reduce((a, s) => a + s.y, 0) / shots.length;

  let esNorm = 0;
  for (let i = 0; i < shots.length; i++) {
    for (let j = i + 1; j < shots.length; j++) {
      const d = Math.hypot(shots[i].x - shots[j].x, shots[i].y - shots[j].y);
      if (d > esNorm) esNorm = d;
    }
  }

  const mrNorm =
    shots.reduce((a, s) => a + Math.hypot(s.x - cx, s.y - cy), 0) /
    shots.length;

  const extremeSpreadIn = esNorm * inchesPerUnit;
  const meanRadiusIn = mrNorm * inchesPerUnit;
  const groupMoa = extremeSpreadIn / (1.047 * (distanceYd / 100));

  return {
    extremeSpreadIn: +extremeSpreadIn.toFixed(3),
    groupMoa: +groupMoa.toFixed(3),
    meanRadiusIn: +meanRadiusIn.toFixed(3),
    centroid: { x: cx, y: cy },
  };
}

export function computeDopeCard(mvFps, bcG1, sightHeightIn = 1.5, zeroYd = 100, tempF = 59, pressureInHg = 29.92, windMph = 10) {
  const g = 386.088;
  const airDensity = (pressureInHg / 29.92) * (518.67 / (tempF + 459.67));
  const dragFactor = airDensity;

  const ranges = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
  const results = [];

  for (const rangeYd of ranges) {
    const rangeIn = rangeYd * 36;
    const tof = rangeIn / (mvFps * 12);
    const velAtRange = mvFps * Math.exp(-dragFactor * (1 - bcG1) * tof * 0.8);
    const avgVel = (mvFps + velAtRange) / 2;
    const flightTime = rangeIn / (avgVel * 12);
    const dropIn = 0.5 * g * flightTime * flightTime;

    const zeroRangeIn = zeroYd * 36;
    const zeroTof = zeroRangeIn / (mvFps * 12);
    const zeroVelAtRange = mvFps * Math.exp(-dragFactor * (1 - bcG1) * zeroTof * 0.8);
    const zeroAvgVel = (mvFps + zeroVelAtRange) / 2;
    const zeroFlightTime = zeroRangeIn / (zeroAvgVel * 12);
    const zeroDropIn = 0.5 * g * zeroFlightTime * zeroFlightTime;

    const boreSightAngle = (zeroDropIn + sightHeightIn) / zeroRangeIn;
    const elevIn = dropIn - boreSightAngle * rangeIn + sightHeightIn;
    const elevMoa = (elevIn / rangeIn) * 3438;

    const windDriftIn = 0.5 * (windMph * 17.6 / 12) * flightTime * flightTime * (1 - bcG1) * dragFactor * 0.15;
    const windMoa = (windDriftIn / rangeIn) * 3438;

    results.push({
      range: rangeYd,
      elevMoa: Math.abs(elevMoa) < 0.05 ? 0 : +elevMoa.toFixed(1),
      windMoa: +Math.abs(windMoa).toFixed(1),
      velFps: Math.round(velAtRange),
      tofSec: +flightTime.toFixed(3),
    });
  }
  return results;
}

export function twoSampleTTest(group1, group2) {
  if (group1.length < 2 || group2.length < 2) return null;

  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = (arr) => {
    const m = mean(arr);
    return arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1);
  };

  const m1 = mean(group1);
  const m2 = mean(group2);
  const v1 = variance(group1);
  const v2 = variance(group2);
  const n1 = group1.length;
  const n2 = group2.length;

  const se = Math.sqrt(v1 / n1 + v2 / n2);
  if (se === 0) return null;

  const t = (m1 - m2) / se;

  const num = (v1 / n1 + v2 / n2) ** 2;
  const den =
    (v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1);
  const df = Math.floor(num / den);

  const significant = Math.abs(t) > 2.0 && df >= 2;

  return { t: +t.toFixed(2), df, significant };
}
