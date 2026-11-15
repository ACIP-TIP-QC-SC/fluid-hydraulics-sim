/* =====================================================================
 * Geotechnical Engineering — PHYSICS CORE
 * ---------------------------------------------------------------------
 * Units, number formatting, the step recorder and the soil phase
 * relations shared by every geotechnical module. Each module adds its
 * own solver to `Physics` in a separate file (seep.js, …).
 *
 * Every solver returns
 *   { ok, err:[], warn:[], status:{cls,text}, out:[{k,v,u,hl}], steps:[...], geo:{...} }
 * `steps` are {t: title, n: note, f: formula, s: substitution, r: result}.
 * ===================================================================== */
(function (root) {
  'use strict';
  const PI = Math.PI, DEG = PI / 180;

  const UNITS = {
    SI: {
      id: 'SI', gw: 9.81, g: 9.81, len: 'm', force: 'kN', press: 'kPa', gamma: 'kN/m³', fpl: 'kN/m', mom: 'kN·m', area: 'm²', vol: 'm³', acc: 'm/s²', inertia: 'm⁴',
      // laboratory scale
      lenS: 'cm', areaS: 'cm²', volS: 'cm³', kLab: 'cm/s',
      // field permeability is entered in cm/s and converted to m/s
      kField: 'cm/s', kToBase: 0.01, qpl: 'm³/s per m', qplDay: 'm³/day per m', perDay: 86400,
      velS: 'cm/s', time: 's', cv: 'm²/yr', settle: 'mm', settleF: 1000,
    },
    EN: {
      id: 'EN', gw: 62.4, g: 32.2, len: 'ft', force: 'lb', press: 'psf', gamma: 'lb/ft³', fpl: 'lb/ft', mom: 'lb·ft', area: 'ft²', vol: 'ft³', acc: 'ft/s²', inertia: 'ft⁴',
      lenS: 'in', areaS: 'in²', volS: 'in³', kLab: 'in/s',
      kField: 'ft/min', kToBase: 1 / 60, qpl: 'ft³/s per ft', qplDay: 'ft³/day per ft', perDay: 86400,
      velS: 'in/s', time: 's', cv: 'ft²/yr', settle: 'in', settleF: 12,
    },
  };

  /** Round to `sig` significant figures (default 4) and return a string. */
  function fmt(x, sig) {
    sig = sig || 4;
    if (x === null || x === undefined || typeof x !== 'number' || !isFinite(x)) return '—';
    if (Math.abs(x) < 1e-12) return '0';
    const a = Math.abs(x);
    if (a >= 1e-4 && a < 1e10) return String(parseFloat(x.toPrecision(sig)));
    return x.toExponential(sig - 1);
  }
  const clamp = (x, a, b) => Math.min(Math.max(x, a), b);
  const log10 = (x) => Math.log(x) / Math.LN10;

  function Steps() {
    const list = [];
    return { list, add(t, f, s, r, n) { list.push({ t, f, s, r, n }); } };
  }
  function fail(err, warn) {
    return { ok: false, err: err || ['Invalid input'], warn: warn || [], steps: [], out: [], geo: null };
  }

  /** Bisection on an increasing function. */
  function bisect(fn, target, lo, hi, iters) {
    iters = iters || 200;
    for (let i = 0; i < iters; i++) {
      const m = 0.5 * (lo + hi);
      if (fn(m) < target) lo = m; else hi = m;
    }
    return 0.5 * (lo + hi);
  }

  /** Complete elliptic integral of the first kind K(k) (modulus k) by the AGM. */
  function ellipK(k) {
    if (k >= 1) return Infinity;
    let a = 1, b = Math.sqrt(1 - k * k);
    for (let i = 0; i < 40; i++) { const an = (a + b) / 2, bn = Math.sqrt(a * b); a = an; b = bn; if (Math.abs(a - b) < 1e-15) break; }
    return PI / (2 * a);
  }

  /* ------------------------------------------------------------------ */
  /* Soil phase relations                                               */
  /* ------------------------------------------------------------------ */
  /** Unit weights from Gs, e and degree of saturation S (0–1). */
  function phase(Gs, e, S, gw) {
    const gd = (Gs * gw) / (1 + e);
    const gsat = ((Gs + e) * gw) / (1 + e);
    const gm = ((Gs + S * e) * gw) / (1 + e);
    const n = e / (1 + e);
    const w = (S * e) / Gs;
    return { gd, gsat, gm, gsub: gsat - gw, n, w, icr: (Gs - 1) / (1 + e) };
  }

  /** Dynamic viscosity of water (Pa·s) at T °C (Vogel equation, within ~1 % of tables for 0–100 °C). */
  function waterViscosity(T) { return 2.414e-5 * Math.pow(10, 247.8 / (T + 273.15 - 140)); }

  /** Polygon area & centroid (shoelace). */
  function polyAC(pts) {
    let A = 0, cx = 0, cy = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      const c = x0 * y1 - x1 * y0;
      A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
    }
    A /= 2;
    if (Math.abs(A) < 1e-15) return { A: 0, x: pts[0] ? pts[0][0] : 0, y: pts[0] ? pts[0][1] : 0 };
    return { A: Math.abs(A), x: cx / (6 * A), y: cy / (6 * A) };
  }

  /** Linear interpolation in a table xs (increasing) → ys. */
  function interp(xs, ys, x) {
    if (x <= xs[0]) return ys[0];
    for (let i = 1; i < xs.length; i++) if (x <= xs[i]) { const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1] || 1); return ys[i - 1] + t * (ys[i] - ys[i - 1]); }
    return ys[ys.length - 1];
  }

  root.Physics = Object.assign(root.Physics || {}, {
    PI, DEG, UNITS, fmt, clamp, log10, Steps, fail, bisect, ellipK, phase, waterViscosity, polyAC, interp,
  });
})(typeof window !== 'undefined' ? window : globalThis);
