/* =====================================================================
   physics.js — Hydraulics formulas for "Hydraulics and Principles of Geotechnical Engineering (HPGE) Calculator by CEM Jumawan"
   ---------------------------------------------------------------------
   Pure functions only (no DOM, no drawing). Every module function takes
   an input object I in the BASE units of the chosen unit system and a
   unit object U from HP.units():

     SI      : m, m², m³/s, kPa, kN/m³, g = 9.81 m/s²   (power in kW)
     English : ft, ft², ft³/s, psf, lb/ft³, g = 32.2 ft/s² (power in ft·lb/s)

   Each returns { results, steps, warnings, data, invalid }:
     results  : [{label, value, unit, em}]   numbers shown in the panel
     steps    : [{t, f, s, r, n, table}]     title, formula, substitution,
                                             result, one-line note, table
     warnings : [{lvl:'err'|'warn'|'info', text}]
     data     : anything the diagrams/animations need
   When `invalid` is true the results are withheld and only warnings show.
   ===================================================================== */
(function (root) {
  'use strict';
  const PI = Math.PI, sqrt = Math.sqrt, abs = Math.abs, pow = Math.pow;
  const HP = {};

  /* ---------- formatting: 4 significant figures ---------- */
  function fmt(x, sig) {
    sig = sig || 4;
    if (x === Infinity) return '∞';
    if (x === -Infinity) return '−∞';
    if (x === undefined || x === null || typeof x !== 'number' || !isFinite(x)) return '—';
    if (x === 0) return '0';
    const a = abs(x);
    if (a >= 1e7 || a < 1e-4) {
      const parts = x.toExponential(sig - 1).split('e');
      return parts[0].replace('-', '−') + '×10^(' + (+parts[1]) + ')';
    }
    return Number(x.toPrecision(sig)).toString().replace('-', '−');
  }
  HP.fmt = fmt;
  const P = (x) => (x < 0 ? '(' + fmt(x) + ')' : fmt(x)); // parenthesise negatives in substitutions

  /* ---------- unit systems ---------- */
  HP.units = function (sys) {
    if (sys === 'EN') {
      const g = 32.2;
      return {
        sys: 'EN', g, gw: 62.4, L: 'ft', A: 'ft²', Vol: 'ft³', Q: 'ft³/s', q: 'ft²/s', v: 'ft/s', p: 'psf', gam: 'lb/ft³',
        kD: 8 / (g * PI * PI), kDt: '0.0252', kM: 4.66, kH: 4.73,
        weir: 3.33, vn: 2.5, cip: 3.367, broad: 3.09, man: 1.486, manT: '1.486/n',
        rawP: 'ft·lb/s', P1: (raw) => raw / 550, P1u: 'hp', P2: (raw) => (raw / 550) * 0.746, P2u: 'kW',
        // water hammer (pressures in psf internally)
        ph: 'psi', phDiv: 144, sig: 'ksi', sigDiv: 144000, mod: 'psf', rho: 'slug/ft³', p0toBase: 1, patm: 2116.2, pvap: 48.9
      };
    }
    const g = 9.81;
    return {
      sys: 'SI', g, gw: 9.81, L: 'm', A: 'm²', Vol: 'm³', Q: 'm³/s', q: 'm²/s', v: 'm/s', p: 'kPa', gam: 'kN/m³',
      kD: 8 / (g * PI * PI), kDt: '0.0826', kM: 10.29, kH: 10.67,
      weir: 1.84, vn: 1.4, cip: 1.859, broad: 1.70, man: 1, manT: '1/n',
      rawP: 'kW', P1: (raw) => raw, P1u: 'kW', P2: (raw) => raw / 0.746, P2u: 'hp',
      ph: 'kPa', phDiv: 1000, sig: 'MPa', sigDiv: 1e6, mod: 'Pa', rho: 'kg/m³', p0toBase: 1000, patm: 101.325, pvap: 2.34
    };
  };

  /* ---------- output builders ---------- */
  function Out() { return { results: [], steps: [], warnings: [], data: {}, invalid: false }; }
  function R(o, label, value, unit, em) { o.results.push({ label, value, unit: unit || '', em: !!em }); }
  function S(o, t, f, s, r, n, table) { o.steps.push({ t, f, s, r, n, table }); }
  function W(o, text, lvl) { o.warnings.push({ lvl: lvl || 'warn', text }); }
  function fail(o, text) { W(o, text, 'err'); o.invalid = true; return o; }

  /* ---------- numerics ---------- */
  // Composite Simpson's rule (n even)
  function simpson(f, a, b, n) {
    n = n || 400; if (n % 2) n++;
    const h = (b - a) / n; let s = f(a) + f(b);
    for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
    return (s * h) / 3;
  }
  HP.simpson = simpson;
  // Bisection; optional history [a, b, mid, f(mid)]
  function bisect(f, a, b, tol, maxIt, hist) {
    tol = tol || 1e-10; maxIt = maxIt || 200;
    let fa = f(a), fb = f(b);
    if (fa === 0) return a; if (fb === 0) return b;
    if (fa * fb > 0) return NaN;
    for (let i = 0; i < maxIt; i++) {
      const m = (a + b) / 2, fm = f(m);
      if (hist) hist.push([a, b, m, fm]);
      if (fm === 0 || (b - a) / 2 < tol) return m;
      if (fa * fm < 0) { b = m; fb = fm; } else { a = m; fa = fm; }
    }
    return (a + b) / 2;
  }
  HP.bisect = bisect;
  // Linear interpolation in a monotonic table
  function interp(xs, ys, x) {
    const n = xs.length; if (!n) return NaN;
    const inc = xs[n - 1] >= xs[0];
    if (inc ? x <= xs[0] : x >= xs[0]) return ys[0];
    if (inc ? x >= xs[n - 1] : x <= xs[n - 1]) return ys[n - 1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if ((xs[m] <= x) === inc) lo = m; else hi = m; }
    const t = (x - xs[lo]) / (xs[hi] - xs[lo] || 1);
    return ys[lo] + t * (ys[hi] - ys[lo]);
  }
  HP.interp = interp;

  /* =====================================================================
     MODULE 1 — ORIFICES, TUBES AND TANK DRAINING
     ===================================================================== */
  // Surface area A_s(h) of each tank shape, h measured up from the orifice.
  HP.tankShape = function (I) {
    switch (I.shape) {
      case 'vcyl': { const A = (PI * I.D * I.D) / 4; return { As: () => A, Hmax: Infinity, constA: A, expr: `A_s = πD²/4 = π(${fmt(I.D)})²/4 = ${fmt(A)}` }; }
      case 'rect': { const A = I.Lt * I.Bt; return { As: () => A, Hmax: Infinity, constA: A, expr: `A_s = L×B = ${fmt(I.Lt)}×${fmt(I.Bt)} = ${fmt(A)}` }; }
      case 'cone': { const k = PI * pow(I.Dc / 2 / I.Hc, 2); return { As: (h) => k * h * h, Hmax: I.Hc, k, expr: `A_s(h) = π(R·h/H_c)² = π(${fmt(I.Dc / 2)}h/${fmt(I.Hc)})² = ${fmt(k)}·h²` }; }
      case 'sphere': { const D = I.Ds; return { As: (h) => PI * Math.max(0, D * h - h * h), Hmax: D, expr: `A_s(h) = π(D·h − h²) = π(${fmt(D)}h − h²)` }; }
      case 'hcyl': { const D = I.Dh, L = I.Lh; return { As: (h) => 2 * L * sqrt(Math.max(0, h * (D - h))), Hmax: D, expr: `A_s(h) = L·T(h) = 2L√(h(D − h)) = 2(${fmt(L)})√(h(${fmt(D)} − h))` }; }
      case 'frustum': {
        const rb = I.Db / 2, rt = I.Dt / 2, H = I.Hf;
        return { As: (h) => PI * pow(rb + ((rt - rb) * Math.min(h, H)) / H, 2), Hmax: H, expr: `A_s(h) = π[r_b + (r_t − r_b)h/H_f]² = π[${fmt(rb)} + ${fmt(rt - rb)}h/${fmt(H)}]²` };
      }
    }
    return null;
  };

  /* Tank draining with several immiscible liquid layers (layer 1 at the orifice).
     The bottom-most remaining layer flows out; the layers above it keep their volume
     and ride down. The head driving the jet is the pressure at the orifice expressed
     in metres of the liquid that is flowing out:
         h_eq = Σ Sg_j·t_j / Sg_k + p_s/(γw·Sg_k),   Q = Cd·A_o·√(2g·h_eq)
     and t = ∫ A_s(h) dh / Q, integrated phase by phase (one phase per layer). */
  function drainLayers(o, I, U, lay, sh, K) {
    const L = U.L, H1 = I.H, H2 = I.H2, n = lay.length, gw = U.gw, ps = I.ps;
    if (H2 >= H1) return fail(o, 'Final head H₂ must be smaller than the initial head H₁ for draining.');
    if (H2 < 0) return fail(o, 'Final head H₂ cannot be below the orifice.');
    // volume below height h: V(h) = ∫ A_s dh (Simpson per cell, then linear inside a cell)
    const NV = 2000, dv = H1 / NV, hv = [0], vv = [0];
    for (let i = 1; i <= NV; i++) { const a = (i - 1) * dv, b = i * dv; vv.push(vv[i - 1] + (dv / 6) * (sh.As(a) + 4 * sh.As(a + dv / 2) + sh.As(b))); hv.push(b); }
    const Vof = (h) => (h <= 0 ? 0 : h >= H1 ? vv[NV] : interp(hv, vv, h));
    const Vinv = (v) => (v <= 0 ? 0 : v >= vv[NV] ? H1 : interp(vv, hv, v));
    let z = 0; const zt = lay.map((l) => (z += l.t));
    const Vl = lay.map((l, j) => Vof(zt[j]) - Vof(j ? zt[j - 1] : 0));
    const Cab = lay.map((_, j) => Vl.slice(j + 1).reduce((a, b) => a + b, 0)); // volume of the layers above layer j
    // interface tops of layers k..n−1 when the free surface is at h and layer k is the one draining
    const topsK = (h, k) => { const Vt = Vof(h), t = []; for (let j = k; j < n; j++) t.push(j === n - 1 ? h : Math.max(0, Vinv(Vt - Cab[j]))); return t; };
    const heqK = (h, k) => {
      const t = topsK(h, k); let sum = 0;
      for (let j = k; j < n; j++) sum += lay[j].sg * Math.max(0, t[j - k] - (j === k ? 0 : t[j - k - 1]));
      return sum / lay[k].sg + ps / (gw * lay[k].sg);
    };
    const layerAt = (h) => { const Vt = Vof(h); for (let j = 0; j < n; j++) if (Vt > Cab[j] + 1e-12 * vv[NV]) return j; return n - 1; };
    // phase boundaries: layer j is used up when V(h) = volume of the layers above it
    const hb = lay.map((_, j) => (j === n - 1 ? 0 : Vinv(Cab[j])));
    const segs = []; let stopped = false;
    for (let j = 0; j < n; j++) {
      const ha = j === 0 ? H1 : hb[j - 1], hlo = hb[j];
      if (ha <= hlo + 1e-12) continue;
      if (heqK(ha, j) <= 0) { stopped = true; break; }
      if (heqK(hlo, j) < -1e-12) { const hs = bisect((h) => heqK(h, j), hlo, ha, 1e-12); segs.push({ k: j, ha, hb: hs }); stopped = true; break; }
      segs.push({ k: j, ha, hb: hlo });
    }
    const hEmpty = segs.length ? segs[segs.length - 1].hb : H1;
    // time from ha down to hb with layer k flowing; h = hb + s² removes the 1/√h_eq singularity at the bottom
    const segTime = (ha, hbb, k) => {
      if (ha <= hbb) return 0;
      const sm = sqrt(ha - hbb), f = (s) => { s = Math.max(s, 1e-7 * sm); const h = hbb + s * s, e = heqK(h, k); return e > 0 ? (2 * s * sh.As(h)) / (K * sqrt(e)) : 0; };
      return simpson(f, 0, sm, 400);
    };
    segs.forEach((g) => { g.t = segTime(g.ha, g.hb, g.k); });
    const T = (h) => { let t = 0; for (const g of segs) { if (h >= g.ha) break; t += h <= g.hb ? g.t : segTime(g.ha, h, g.k); if (h > g.hb) break; } return t; };
    const kName = (k) => `layer ${k + 1} (Sg ${fmt(lay[k].sg)})`;

    S(o, 'Surface area as a function of head', 'A_s(h)', sh.expr, sh.constA ? `${fmt(sh.constA)} ${U.A}` : 'varies with h', 'Plan area of the free surface at height h above the orifice.');
    S(o, 'Volume of each layer', 'V_j = ∫ A_s dh over the layer', 'from the bottom of each layer to its top', `total ${fmt(Vl.reduce((a, b) => a + b, 0))} ${U.Vol}`, 'The upper layers keep these volumes while the layer below them drains.',
      { head: ['Layer', 'Sg', `t (${L})`, `V (${U.Vol})`, `used up at h (${L})`], rows: lay.map((l, j) => [String(j + 1), fmt(l.sg), fmt(l.t), fmt(Vl[j]), j === n - 1 ? '0' : fmt(hb[j])]).reverse() });
    let cum = 0;
    segs.forEach((g, i) => {
      const ea = heqK(g.ha, g.k), eb = Math.max(0, heqK(g.hb, g.k));
      const t0 = cum; cum += g.t;
      const f = sh.constA ? 't = 2A_s(√h_eq,a − √h_eq,b) / (Cd·A_o·√(2g))' : 't = ∫ A_s(h) dh / (Cd·A_o·√(2g·h_eq)), Simpson 400 steps';
      const sub = sh.constA ? `t = 2(${fmt(sh.constA)})(√${fmt(ea)} − √${fmt(eb)}) / ${fmt(K)}` : `h = ${fmt(g.ha)} → ${fmt(g.hb)} ${L}; h_eq = ${fmt(ea)} → ${fmt(eb)} ${L}`;
      S(o, `Phase ${i + 1}: ${kName(g.k)} flows out, h = ${fmt(g.ha)} → ${fmt(g.hb)} ${L}`, `h_eq = Σ Sg_j·t_j / Sg_k${ps ? ' + p_s/γ_k' : ''};  ${f}`, sub, `${fmt(g.t)} s (ends at t = ${fmt(cum)} s = ${fmt(cum / 60)} min)`,
        (sh.constA ? 'With a constant area, h_eq falls one-for-one with h, so the single-liquid formula applies to each phase. ' : '') + `Phase starts at t = ${fmt(t0)} s.`);
    });
    if (H2 < hEmpty - 1e-12) return fail(o, `With the vacuum on the surface, outflow stops when the level reaches h = ${fmt(hEmpty)} ${L}; H₂ = ${fmt(H2)} ${L} is never reached.`);
    const t = T(H2), tEmpty = cum, kq = layerAt(H2), e2 = Math.max(0, heqK(H2, Math.min(kq, n - 1)));
    S(o, 'Time to drain H₁ → H₂', 't = sum of the phases down to H₂', `h = ${fmt(H1)} → ${fmt(H2)} ${L}`, `${fmt(t)} s = ${fmt(t / 60)} min`, `At H₂ the outflow is ${kName(kq)} with h_eq = ${fmt(e2)} ${L}.`);
    R(o, 'Time to drain H₁ → H₂', t, 's', true); R(o, 'Time to drain H₁ → H₂', t / 60, 'min');
    R(o, stopped ? 'Time until outflow stops' : 'Time to empty (to orifice level)', tEmpty, 's');
    R(o, 'Discharge at H₂', K * sqrt(e2), U.Q);
    let tc = 0; segs.forEach((g) => { tc += g.t; if (g.k < n - 1 && !(stopped && g === segs[segs.length - 1])) R(o, `Layer ${g.k + 1} (Sg ${fmt(lay[g.k].sg)}) used up at`, tc, 's'); });
    if (stopped) W(o, `The vacuum on the surface stops the outflow at h = ${fmt(hEmpty)} ${L}.`, 'info');
    if (I.tq > 0) {
      if (I.tq >= tEmpty) { S(o, 'Solve for the head after t', 't ≥ time to empty', `t = ${fmt(I.tq)} s`, stopped ? 'outflow stopped' : 'tank empty', 'The level has already reached its lowest point.'); W(o, `After ${fmt(I.tq)} s the outflow has already ended (at ${fmt(tEmpty)} s).`, 'info'); }
      else {
        const hq = bisect((h) => T(h) - I.tq, hEmpty, H1, 1e-9);
        S(o, 'Solve for the head after t', 'find h such that t(H₁ → h) = t', `t = ${fmt(I.tq)} s (bisection over the phases)`, `h = ${fmt(hq)} ${L}`, `Then ${kName(layerAt(hq))} is flowing out.`);
        R(o, `Head after ${fmt(I.tq)} s`, hq, L);
      }
    }
    // animation table: per phase, uniform in s = √(h − h_b), scaled to the exact phase time
    const ts = [0], hs = [H1], qs = [K * sqrt(Math.max(0, heqK(H1, 0)))]; let t0 = 0;
    for (const g of segs) {
      if (H2 >= g.ha) break;
      const lo = Math.max(g.hb, H2), base = g.hb, M = 200, sa = sqrt(g.ha - base), sb = sqrt(lo - base);
      const f = (s) => { s = Math.max(s, 1e-7 * (sa || 1)); const h = base + s * s, e = heqK(h, g.k); return e > 0 ? (2 * s * sh.As(h)) / (K * sqrt(e)) : 0; };
      const loc = [0], hh = [g.ha], qq = [K * sqrt(Math.max(0, heqK(g.ha, g.k)))]; let acc = 0, fp = f(sa);
      for (let i = 1; i <= M; i++) { const s = sa + ((sb - sa) * i) / M, fc = f(s); acc += ((fp + fc) / 2) * ((sa - sb) / M); fp = fc; loc.push(acc); const h = base + s * s; hh.push(h); qq.push(K * sqrt(Math.max(0, heqK(h, g.k)))); }
      const exact = segTime(g.ha, lo, g.k), sc = acc > 0 ? exact / acc : 0;
      for (let i = 1; i <= M; i++) { ts.push(t0 + loc[i] * sc); hs.push(hh[i]); qs.push(qq[i]); }
      t0 += exact;
      if (lo > g.hb) break;
    }
    const heqOf = (h) => Math.max(0, heqK(h, layerAt(h)));
    const layZ = (h) => { const k = layerAt(h), tp = topsK(h, k), out = []; for (let j = 0; j < n; j++) out.push(j < k ? 0 : tp[j - k]); return out; };
    Object.assign(o.data, { tEnd: t, table: { ts, hs, qs }, hAt: (x) => interp(ts, hs, x), heqOf, layZ, layerAt, hEmpty, tEmpty });
    return o;
  }

  HP.orifice = function (I, U) {
    const o = Out(), g = U.g, L = U.L, mode = I.mode;
    const gam = I.Sg * U.gw, Ao = (PI * I.d * I.d) / 4, hp = I.ps / gam, s2g = sqrt(2 * g);
    let Cd = I.Cd, Cv = I.Cv, Cc = I.Cc, K = Cd * Ao * s2g;
    // liquid layers (steady and draining only): layer 1 is the bottom liquid at the orifice
    const nL = mode === 'steady' || mode === 'drain' ? Math.max(1, Math.min(4, Math.round(+I.nLay || 1))) : 1;
    const lay = [{ sg: I.Sg, t: I.H }];
    for (let j = 2; j <= nL; j++) lay.push({ sg: I['sg' + j], t: I['t' + j] });
    if (nL > 1) lay[0].t = I.H - lay.slice(1).reduce((a, l) => a + l.t, 0);
    let H1 = I.H;
    o.data = { mode, Ao, hp, K, Cv, Cd, Cc, d: I.d, y: I.y, g, H1, shape: I.shape };
    if (!(mode === 'steady' && I.jfind === 'cv') && abs(Cc * Cv - Cd) > 0.005) W(o, `Cd should equal Cc × Cv (${fmt(Cc)} × ${fmt(Cv)} = ${fmt(Cc * Cv)}). Q uses Cd = ${fmt(Cd)}.`);

    S(o, nL > 1 ? 'Unit weight of the bottom liquid (layer 1)' : 'Unit weight of the liquid', nL > 1 ? 'γ₁ = Sg₁·γw' : 'γ = Sg·γw', `γ${nL > 1 ? '₁' : ''} = ${fmt(I.Sg)} × ${fmt(U.gw)}`, `${fmt(gam)} ${U.gam}`, nL > 1 ? 'The orifice discharges the bottom liquid first.' : 'Unit weight used for pressure head and jet power.');
    S(o, 'Orifice area', 'A_o = πd²/4', `A_o = π(${fmt(I.d)})²/4`, `${fmt(Ao)} ${U.A}`, 'Area of the orifice opening.');
    if (nL > 1) {
      const up = I.H - lay[0].t;
      if (lay.some((l) => !(l.sg > 0))) return fail(o, 'Every layer needs a specific gravity greater than zero.');
      if (lay.slice(1).some((l) => !(l.t > 0))) return fail(o, 'Every upper layer needs a thickness greater than zero.');
      if (!(lay[0].t > 1e-9)) return fail(o, `The upper layers are ${fmt(up)} ${L} thick in total, which leaves no room for layer 1 in a total depth H${mode === 'drain' ? '₁' : ''} = ${fmt(I.H)} ${L}. Make H larger or the upper layers thinner.`);
      for (let j = 1; j < nL; j++) if (lay[j].sg > lay[j - 1].sg + 1e-9) W(o, `Layer ${j + 1} (Sg ${fmt(lay[j].sg)}) is heavier than layer ${j} below it (Sg ${fmt(lay[j - 1].sg)}); in a real tank it would sink. It is computed as entered.`);
      let pz = 0; lay.forEach((l) => { pz += l.sg * U.gw * l.t; });
      const rows = lay.map((l, j) => [String(j + 1) + (j === 0 ? ' (bottom)' : j === nL - 1 ? ' (top)' : ''), fmt(l.sg), fmt(l.sg * U.gw), fmt(l.t), fmt(l.sg * U.gw * l.t)]).reverse();
      S(o, 'Liquid layers', 't₁ = H − (t₂ + … + tₙ)', `t₁ = ${fmt(I.H)} − ${fmt(up)}`, `t₁ = ${fmt(lay[0].t)} ${L}`, 'Layers listed from the top down; layer 1 sits at the orifice.', { head: ['Layer', 'Sg', `γ (${U.gam})`, `t (${L})`, `γ·t (${U.p})`], rows });
      S(o, 'Pressure at the orifice from the layers', 'p = Σ γᵢ·tᵢ', `p = ${lay.map((l) => `${fmt(l.sg * U.gw)}(${fmt(l.t)})`).join(' + ')}`, `${fmt(pz)} ${U.p}`, 'Each layer adds its own γ·t to the pressure below it.');
      H1 = pz / gam;
      S(o, 'Equivalent head of the bottom liquid', 'H_eq = p/γ₁ = Σ Sgᵢ·tᵢ / Sg₁', `H_eq = ${fmt(pz)} / ${fmt(gam)}`, `${fmt(H1)} ${L}`, 'The jet is layer-1 liquid, so the head driving it is the pressure in metres of that liquid.');
      R(o, 'Equivalent head H_eq' + (mode === 'drain' ? ' (at H₁)' : ''), H1, L);
      o.data.layers = lay; o.data.Heq0 = H1; o.data.H1 = H1;
    }
    let HT = H1 + hp;
    if (hp !== 0 && mode !== 'twotank' && !(mode === 'steady' && I.jfind === 'H'))
      S(o, 'Total head (closed tank)', nL > 1 ? 'H_T = H_eq + p_s/γ₁' : 'H_T = H + p_s/γ', `H_T = ${fmt(H1)} + ${P(I.ps)}/${fmt(gam)}`, `${fmt(HT)} ${L}`, 'Gauge pressure on the liquid surface adds a pressure head.');
    if (mode !== 'twotank' && HT <= 0) return fail(o, 'Total head is zero or negative: the vacuum on the surface is strong enough that no liquid flows out (air is drawn in instead).');

    // slanted jet and measured-point problems (side orifice / nozzle)
    const angDeg = I.jby === 'slope' ? (I.jdir === 'down' ? -1 : 1) * (Math.atan(Math.max(0, +I.zw || 0)) * 180) / PI : +I.jang || 0;
    const th = (mode === 'twotank' ? 0 : Math.max(-89, Math.min(89, angDeg))) * PI / 180, cth = Math.cos(th), tth = Math.tan(th);
    if (mode !== 'twotank' && I.jby === 'slope') S(o, 'Jet angle from the slope of the tank wall', 'θ = tan⁻¹(z)  (jet leaves normal to a wall sloping z H : 1 V)', `θ = tan⁻¹(${fmt(+I.zw || 0)})`, `θ = ${fmt((th * 180) / PI)}° ${th < 0 ? 'below' : 'above'} the horizontal`, 'The wall makes tan⁻¹(1/z) with the horizontal, so its normal makes tan⁻¹(z).');
    const jf = mode === 'steady' ? I.jfind || 'land' : 'land';
    o.data.th = th;
    if (jf === 'cv' || jf === 'H') {
      const xm = I.xm, ym = I.ym, den = 2 * cth * cth * (ym + xm * tth);
      if (!(xm > 0) || !(den > 0)) return fail(o, 'That point cannot lie on the jet: with this angle the jet never reaches it. Check x, the drop y (positive below the orifice centre) and θ.');
      const vm = sqrt((g * xm * xm) / den);
      if (th === 0) S(o, 'Jet velocity from the measured point', 'x = v·t,  y = g·t²/2  →  v = x·√(g/(2y))', `v = ${fmt(xm)} × √(${fmt(g)}/(2 × ${fmt(ym)}))`, `${fmt(vm)} ${U.v}`, 'y is how far the point is below the centre of the orifice.');
      else S(o, 'Jet velocity from the measured point', 'y = g·x²/(2v²cos²θ) − x·tanθ  →  v = √(g·x² / (2cos²θ·(y + x·tanθ)))', `v = √(${fmt(g)} × ${fmt(xm)}² / (2 × ${fmt(cth)}² × (${P(ym)} + ${fmt(xm)} × ${P(tth)})))`, `${fmt(vm)} ${U.v}`, 'y is the drop of the point below the orifice centre; θ is measured up from the horizontal.');
      if (jf === 'cv') {
        const vt0 = sqrt(2 * g * HT);
        Cv = vm / vt0;
        S(o, 'Coefficient of velocity', `Cv = v / √(2g${hp !== 0 ? 'H_T' : nL > 1 ? 'H_eq' : 'H'})`, `Cv = ${fmt(vm)} / ${fmt(vt0)}`, fmt(Cv), 'Actual jet speed over the ideal Torricelli speed.');
        if (I.Qm > 0) {
          Cd = I.Qm / (Ao * vt0);
          S(o, 'Coefficient of discharge', 'Cd = Q / (A_o·√(2gH))', `Cd = ${fmt(I.Qm)} / (${fmt(Ao)} × ${fmt(vt0)})`, fmt(Cd), 'From the measured discharge.');
          Cc = Cd / Cv;
          S(o, 'Coefficient of contraction', 'Cc = Cd / Cv', `Cc = ${fmt(Cd)} / ${fmt(Cv)}`, fmt(Cc), '');
        } else {
          Cd = Cc * Cv;
          S(o, 'Coefficient of discharge', 'Cd = Cc·Cv', `Cd = ${fmt(Cc)} × ${fmt(Cv)}`, fmt(Cd), 'No discharge was measured, so Cc is taken as entered.');
        }
        if (Cv > 1) W(o, 'Cv comes out above 1, which is not possible for a real jet. Check the measurements.');
        R(o, 'Coefficient of velocity Cv', Cv, '', true); R(o, 'Coefficient of discharge Cd', Cd, '', I.Qm > 0); R(o, 'Coefficient of contraction Cc', Cc, '', I.Qm > 0);
      } else {
        if (nL > 1) return fail(o, 'Finding the head from the jet works with one liquid in the tank. Set the layers to one liquid.');
        HT = (vm * vm) / (2 * g * Cv * Cv);
        S(o, hp !== 0 ? 'Total head needed' : 'Head on the orifice', 'H = v² / (2g·Cv²)', `H = ${fmt(vm)}² / (2 × ${fmt(g)} × ${fmt(Cv)}²)`, `${fmt(HT)} ${L}`, 'Since v = Cv·√(2gH).');
        H1 = HT - hp;
        if (hp !== 0) S(o, 'Liquid depth above the orifice', 'H = H_T − p_s/γ', `H = ${fmt(HT)} − ${P(I.ps)}/${fmt(gam)}`, `${fmt(H1)} ${L}`, '');
        if (!(H1 > 0)) return fail(o, 'The surface pressure alone gives more head than the jet needs, so no liquid depth is required.');
        R(o, 'Head on the orifice H', H1, L, true);
        o.data.H1 = H1; o.data.Iover = { H: H1 };
      }
      K = Cd * Ao * s2g; Object.assign(o.data, { K, Cv, Cd, Cc });
    }

    const at = mode === 'steady' ? '' : ' (at H₁)';
    const Hh = mode === 'twotank' ? H1 : HT;
    const vt = sqrt(2 * g * Hh), v = Cv * vt, Q = Cd * Ao * vt, a = Cc * Ao;
    const HL = (1 / (Cv * Cv) - 1) * (v * v) / (2 * g), Pw = (gam * Q * v * v) / (2 * g);
    let x = 2 * Cv * sqrt(Hh * I.y);
    const Hs = mode === 'twotank' ? 'ΔH' : hp !== 0 ? 'H_T' : nL > 1 ? 'H_eq' : 'H';
    S(o, 'Theoretical velocity' + at, `v_t = √(2g${Hs})`, `v_t = √(2 × ${fmt(g)} × ${fmt(Hh)})`, `${fmt(vt)} ${U.v}`, 'Torricelli: ideal velocity from the head.');
    S(o, 'Actual jet velocity' + at, 'v = Cv·√(2gH)', `v = ${fmt(Cv)} × ${fmt(vt)}`, `${fmt(v)} ${U.v}`, 'Friction makes the real jet slower by Cv.');
    S(o, 'Discharge' + at, 'Q = Cd·A_o·√(2gH)', `Q = ${fmt(Cd)} × ${fmt(Ao)} × ${fmt(vt)}`, `${fmt(Q)} ${U.Q}`, 'Cd = Cc·Cv accounts for contraction and friction.');
    S(o, 'Jet area at vena contracta', 'a = Cc·A_o', `a = ${fmt(Cc)} × ${fmt(Ao)}`, `${fmt(a)} ${U.A}`, 'The jet narrows just outside the orifice.');
    S(o, 'Head lost in the orifice', 'HL = (1/Cv² − 1)·v²/(2g)', `HL = (1/${fmt(Cv)}² − 1) × ${fmt(v)}²/(2×${fmt(g)})`, `${fmt(HL)} ${L}`, 'Energy lost to friction in the opening.');
    S(o, 'Power of the jet', 'P = γQ·v²/(2g)', `P = ${fmt(gam)} × ${fmt(Q)} × ${fmt(v)}²/(2×${fmt(g)})`, `${fmt(U.P1(Pw))} ${U.P1u}`, 'Kinetic energy carried by the jet per second.');
    R(o, 'Theoretical velocity v_t' + at, vt, U.v);
    R(o, 'Jet velocity v' + at, v, U.v);
    R(o, 'Discharge Q' + at, Q, U.Q, mode === 'steady');
    if (U.sys === 'SI') R(o, 'Discharge Q' + at, Q * 1000, 'L/s');
    R(o, 'Jet area a', a, U.A);
    R(o, 'Head lost HL', HL, L);
    R(o, 'Jet power P', U.P1(Pw), U.P1u);
    o.data.v0 = v; o.data.Q0 = Q;

    const side = mode === 'steady' || I.shape === 'vcyl' || I.shape === 'rect';
    o.data.side = side;
    if (mode !== 'twotank') {
      if (side && th === 0) {
        S(o, 'Jet trajectory', 'x = 2Cv·√(H·y)', `x = 2 × ${fmt(Cv)} × √(${fmt(Hh)} × ${fmt(I.y)})`, `${fmt(x)} ${L}`, 'From x = vt and y = gt²/2: horizontal distance where the jet lands.');
        R(o, 'Jet lands at x' + at, x, L, mode === 'steady' && jf === 'land');
      } else if (side) {
        const vx = v * cth, vy = v * Math.sin(th), aa = g / (2 * v * v * cth * cth);
        x = (tth + sqrt(tth * tth + 4 * aa * I.y)) / (2 * aa);
        S(o, 'Jet components' + at, 'v_x = v·cosθ,  v_y = v·sinθ', `v_x = ${fmt(v)} cos ${fmt((th * 180) / PI)}°,  v_y = ${fmt(v)} sin ${fmt((th * 180) / PI)}°`, `v_x = ${fmt(vx)}, v_y = ${fmt(vy)} ${U.v}`, 'θ is measured up from the horizontal (negative = pointing down).');
        S(o, 'Path of the jet', 'z = x·tanθ − g·x² / (2v²cos²θ)', `z = ${P(tth)}·x − ${fmt(aa)}·x²`, 'z = height above the orifice centre', 'A projectile path: steady horizontal speed, gravity acting down.');
        S(o, 'Where the jet lands', '−y = x·tanθ − g·x²/(2v²cos²θ)', `${fmt(aa)}x² − ${P(tth)}x − ${fmt(I.y)} = 0`, `x = ${fmt(x)} ${L}`, 'The ground is y below the orifice; take the positive root.');
        const tf = x / vx;
        S(o, 'Time in the air', 't = x / v_x', `t = ${fmt(x)} / ${fmt(vx)}`, `${fmt(tf)} s`, '');
        if (th > 0) {
          const zmax = (vy * vy) / (2 * g), xz = (vx * vy) / g;
          S(o, 'Highest point of the jet', 'z_max = v_y²/(2g),  at x = v_x·v_y/g', `z_max = ${fmt(vy)}²/(2 × ${fmt(g)})`, `${fmt(zmax)} ${L} above the orifice, at x = ${fmt(xz)} ${L}`, 'The vertical speed is zero at the top.');
          R(o, 'Highest point above the orifice', zmax, L); R(o, 'Highest point is at x', xz, L);
          o.data.zmax = zmax; o.data.xz = xz;
        }
        const vimp = sqrt(v * v + 2 * g * I.y), aimp = (Math.atan2(sqrt(Math.max(0, vimp * vimp - vx * vx)), vx) * 180) / PI;
        S(o, 'Speed where it lands', 'v_land = √(v² + 2g·y)', `v_land = √(${fmt(v)}² + 2 × ${fmt(g)} × ${fmt(I.y)})`, `${fmt(vimp)} ${U.v} at ${fmt(aimp)}° below the horizontal`, 'Energy of the free jet: it gains g·y of kinetic energy per unit mass.');
        R(o, 'Jet lands at x' + at, x, L, mode === 'steady' && jf === 'land'); R(o, 'Time of flight', tf, 's'); R(o, 'Landing speed', vimp, U.v);
      } else W(o, 'This tank shape drains through a bottom orifice, so the jet falls vertically (no horizontal range).', 'info');
      if (side && jf === 'pt') {
        const xq = I.xq, aa = g / (2 * v * v * cth * cth), zq = xq * tth - aa * xq * xq;
        S(o, 'Height of the jet at a given distance', th === 0 ? 'z = −g·x²/(2v²)' : 'z = x·tanθ − g·x²/(2v²cos²θ)', `z = ${th === 0 ? '' : `${fmt(xq)} × ${P(tth)} `}− ${fmt(aa)} × ${fmt(xq)}²`, `${fmt(zq)} ${L} (${zq < 0 ? fmt(-zq) + ' ' + L + ' below' : 'above'} the orifice centre)`, zq < -I.y ? 'That is below the ground: the jet lands before reaching this distance.' : 'For example where the jet strikes a wall at that distance.');
        R(o, 'Jet height at x_p (+ above, − below the orifice)', zq, L, true);
        o.data.xq = xq; o.data.zq = zq;
      }
    }
    o.data.x = x;
    if (mode === 'steady') { o.data.tEnd = Infinity; return o; }

    /* ---------- unsteady modes ---------- */
    const H2 = I.H2;
    const sh = HP.tankShape(I);
    o.data.sh = sh;
    if (mode === 'twotank') {
      if (!sh.constA) return fail(o, 'Choose a vertical cylinder or rectangular tank for the two-tank mode (constant surface areas).');
      if (H2 >= H1) return fail(o, 'Final head difference H₂ must be smaller than the initial difference H₁.');
      const A1 = sh.constA, A2 = I.A2;
      S(o, 'Surface area of tank 1', 'A₁', sh.expr, `${fmt(A1)} ${U.A}`, 'Tank 1 holds the higher level.');
      const t = (2 * A1 * A2 * (sqrt(H1) - sqrt(H2))) / (Cd * Ao * s2g * (A1 + A2));
      S(o, 'Time for head difference to fall H₁ → H₂', 't = 2A₁A₂(√H₁ − √H₂) / [Cd·A_o·√(2g)·(A₁ + A₂)]',
        `t = 2(${fmt(A1)})(${fmt(A2)})(√${fmt(H1)} − √${fmt(H2)}) / [${fmt(Cd)}(${fmt(Ao)})(${fmt(s2g)})(${fmt(A1 + A2)})]`,
        `${fmt(t)} s = ${fmt(t / 60)} min`, 'One level falls while the other rises; the difference drives the submerged orifice.');
      R(o, 'Time H₁ → H₂', t, 's', true); R(o, 'Time H₁ → H₂', t / 60, 'min');
      const tEq = (2 * A1 * A2 * sqrt(H1)) / (Cd * Ao * s2g * (A1 + A2));
      R(o, 'Time to equal levels', tEq, 's');
      const zt = (tt) => { const r = sqrt(H1) - (Cd * Ao * s2g * (A1 + A2) * tt) / (2 * A1 * A2); return r > 0 ? r * r : 0; };
      if (I.tq > 0) {
        const zq = zt(I.tq);
        S(o, 'Solve for the head difference after t', '√ΔH = √H₁ − Cd·A_o·√(2g)(A₁ + A₂)t / (2A₁A₂)', `t = ${fmt(I.tq)} s`, `ΔH = ${fmt(zq)} ${L}`, 'Inverse of the time formula.');
        R(o, `Head difference after ${fmt(I.tq)} s`, zq, L);
      }
      const N = 300, ts = [], hs = [], qs = [];
      for (let i = 0; i <= N; i++) { const tt = (t * i) / N, z = zt(tt); ts.push(tt); hs.push(z); qs.push(K * sqrt(z)); }
      Object.assign(o.data, { A1, A2, tEnd: t, table: { ts, hs, qs }, hAt: (tt) => zt(Math.min(tt, t)) });
      return o;
    }

    if (I.H > sh.Hmax) return fail(o, `Initial head H₁ = ${fmt(I.H)} ${L} exceeds the tank height (${fmt(sh.Hmax)} ${L}). Lower H₁ or enlarge the tank.`);
    if (nL > 1) return drainLayers(o, I, U, lay, sh, K);
    const Qin = mode === 'inflow' ? I.Qin : 0;
    S(o, 'Surface area as a function of head', 'A_s(h)', sh.expr, sh.constA ? `${fmt(sh.constA)} ${U.A}` : 'varies with h', 'Plan area of the free surface at height h above the orifice.');
    // t = ∫ A_s dh / (Q_in − Cd·A_o·√(2g(h+hp))); substitute u = √(h+hp) ⇒ dh = 2u du (removes the 1/√h singularity)
    const fu = (u) => (Qin === 0 ? (-2 * sh.As(u * u - hp)) / K : (2 * u * sh.As(u * u - hp)) / (Qin - K * u));
    const timeBetween = (ha, hb) => simpson(fu, sqrt(ha + hp), sqrt(hb + hp), 400);

    if (mode === 'drain') {
      if (H2 >= H1) return fail(o, 'Final head H₂ must be smaller than the initial head H₁ for draining.');
      if (H2 + hp < 0) return fail(o, `With the vacuum on the surface, flow stops when h = ${fmt(-hp)} ${L}; H₂ is never reached.`);
      let t;
      const sq = (h) => sqrt(h + hp);
      if (sh.constA) {
        t = (2 * sh.constA * (sq(H1) - sq(H2))) / (Cd * Ao * s2g);
        S(o, 'Time to drain H₁ → H₂ (constant area)', hp ? 't = 2A_s(√(H₁+p/γ) − √(H₂+p/γ)) / (Cd·A_o·√(2g))' : 't = 2A_s(√H₁ − √H₂) / (Cd·A_o·√(2g))',
          `t = 2(${fmt(sh.constA)})(${fmt(sq(H1))} − ${fmt(sq(H2))}) / (${fmt(Cd)} × ${fmt(Ao)} × ${fmt(s2g)})`, `${fmt(t)} s = ${fmt(t / 60)} min`, 'Integral of A_s dh / Q(h) with A_s constant.');
      } else if (I.shape === 'cone' && hp === 0) {
        t = (sh.k * 0.4 * (pow(H1, 2.5) - pow(H2, 2.5))) / (Cd * Ao * s2g);
        S(o, 'Time to drain (cone, closed form)', 't = k·(2/5)(H₁^(5/2) − H₂^(5/2)) / (Cd·A_o·√(2g)),  k = π(R/H_c)²',
          `t = ${fmt(sh.k)}(0.4)(${fmt(H1)}^(5/2) − ${fmt(H2)}^(5/2)) / (${fmt(Cd)} × ${fmt(Ao)} × ${fmt(s2g)})`, `${fmt(t)} s = ${fmt(t / 60)} min`, '∫ k h² · h^(−1/2) dh = k(2/5)h^(5/2).');
      } else if (I.shape === 'sphere' && hp === 0) {
        const F = (h) => PI * ((2 / 3) * I.Ds * pow(h, 1.5) - 0.4 * pow(h, 2.5));
        t = (F(H1) - F(H2)) / (Cd * Ao * s2g);
        S(o, 'Time to drain (sphere, closed form)', 't = π[(2/3)D h^(3/2) − (2/5)h^(5/2)] from H₂ to H₁ / (Cd·A_o·√(2g))',
          `t = (${fmt(F(H1))} − ${fmt(F(H2))}) / (${fmt(Cd)} × ${fmt(Ao)} × ${fmt(s2g)})`, `${fmt(t)} s = ${fmt(t / 60)} min`, '∫ π(Dh − h²) h^(−1/2) dh integrated term by term.');
      }
      const tn = timeBetween(H1, H2);
      S(o, 'Numerical check (Simpson, 400 steps)', 't = ∫ A_s(h) dh / (Cd·A_o·√(2gh)), u = √h ⇒ t = ∫ 2A_s(u²) du / (Cd·A_o·√(2g))',
        `from u = ${fmt(sq(H2))} to ${fmt(sq(H1))}`, `${fmt(tn)} s = ${fmt(tn / 60)} min`, 'Substituting u = √h removes the singularity at h = 0.');
      if (t === undefined) t = tn;
      R(o, 'Time to drain H₁ → H₂', t, 's', true); R(o, 'Time to drain H₁ → H₂', t / 60, 'min');
      const hEmpty = Math.max(0, -hp);
      const tEmpty = timeBetween(H1, hEmpty);
      R(o, hp < 0 ? 'Time until outflow stops' : 'Time to empty (to orifice level)', tEmpty, 's');
      R(o, 'Discharge at H₂', K * sq(H2), U.Q);
      if (I.tq > 0) {
        if (I.tq >= tEmpty) { S(o, 'Solve for the head after t', 't ≥ time to empty', `t = ${fmt(I.tq)} s`, 'tank empty', 'The level has already reached the orifice.'); W(o, `After ${fmt(I.tq)} s the tank is already empty (empties at ${fmt(tEmpty)} s).`, 'info'); }
        else {
          const hq = bisect((h) => timeBetween(H1, h) - I.tq, hEmpty, H1, 1e-9);
          S(o, 'Solve for the head after t', 'find h such that t(H₁ → h) = t', `t = ${fmt(I.tq)} s (bisection)`, `h = ${fmt(hq)} ${L}`, 'Inverse problem solved numerically.');
          R(o, `Head after ${fmt(I.tq)} s`, hq, L);
        }
      }
      // table for animation
      const N = 600, u1 = sq(H1), u2 = sq(H2), ts = [0], hs = [H1], qs = [K * u1];
      let tt = 0, fp = fu(u1); const du = (u2 - u1) / N;
      for (let i = 1; i <= N; i++) { const u = u1 + i * du, fc = fu(u); tt += ((fp + fc) / 2) * du; fp = fc; ts.push(tt); hs.push(u * u - hp); qs.push(K * u); }
      const sc = t / tt; for (let i = 0; i <= N; i++) ts[i] *= sc; // match the reported time exactly
      Object.assign(o.data, { tEnd: t, table: { ts, hs, qs }, hAt: (x) => interp(ts, hs, x) });
      return o;
    }

    // inflow mode: dh/dt = [Q_in − Cd·A_o·√(2g(h+hp))] / A_s
    const heq = pow(Qin / K, 2) - hp;
    S(o, 'Governing equation', 'A_s(h)·dh/dt = Q_in − Cd·A_o·√(2gh)', `Q_in = ${fmt(Qin)} ${U.Q}`, '', 'Continuity: storage change = inflow − outflow.');
    S(o, 'Equilibrium head', 'h_eq = (Q_in / (Cd·A_o))² / (2g)' + (hp ? ' − p/γ' : ''), `h_eq = (${fmt(Qin)} / (${fmt(Cd)} × ${fmt(Ao)}))² / (2×${fmt(g)})` + (hp ? ` − ${fmt(hp)}` : ''), `${fmt(heq)} ${L}`, 'Head at which outflow equals inflow.');
    R(o, 'Equilibrium head h_eq', heq, L, true);
    const dir = H1 > heq ? 'falls' : H1 < heq ? 'rises' : 'stays';
    W(o, `Starting at H₁ = ${fmt(H1)} ${L}, the level ${dir} toward h_eq = ${fmt(heq)} ${L}.`, 'info');
    if (heq > sh.Hmax) W(o, 'h_eq is above the top of the tank: the tank would overflow.');
    const ok = H2 !== H1 && ((H1 > heq && H2 > heq) ? H2 < H1 : (H1 < heq && H2 < heq) ? H2 > H1 : false);
    let tEnd;
    if (!ok) {
      W(o, `H₂ = ${fmt(H2)} ${L} is never reached: the level only approaches h_eq = ${fmt(heq)} ${L} and cannot cross it.`, 'warn');
      tEnd = timeBetween(H1, heq + 0.02 * (H1 - heq));
      R(o, 'Time H₁ → H₂', Infinity, 's');
    } else {
      tEnd = timeBetween(H1, H2);
      S(o, 'Time from H₁ to H₂ (Simpson, 400 steps)', 't = ∫ A_s(h) dh / [Q_in − Cd·A_o·√(2gh)],  u = √h', `from h = ${fmt(H1)} to ${fmt(H2)} ${L}`, `${fmt(tEnd)} s = ${fmt(tEnd / 60)} min`, 'Numerical integration of the continuity equation.');
      R(o, 'Time H₁ → H₂', tEnd, 's', true); R(o, 'Time H₁ → H₂', tEnd / 60, 'min');
    }
    if (I.tq > 0) {
      const hEndLim = ok ? H2 : heq + 1e-6 * (H1 - heq);
      const tl = timeBetween(H1, hEndLim);
      let hq;
      if (I.tq >= tl) hq = ok ? NaN : heq;
      else hq = bisect((h) => timeBetween(H1, h) - I.tq, Math.min(H1, hEndLim), Math.max(H1, hEndLim), 1e-9);
      if (isFinite(hq)) { S(o, 'Solve for the head after t', 'find h with t(H₁ → h) = t', `t = ${fmt(I.tq)} s`, `h = ${fmt(hq)} ${L}`, 'Bisection on the time integral.'); R(o, `Head after ${fmt(I.tq)} s`, hq, L); }
      else W(o, `t = ${fmt(I.tq)} s is beyond the time to reach H₂; the level has passed H₂.`, 'info');
    }
    const hEnd = ok ? H2 : heq + 0.02 * (H1 - heq);
    const N = 600, u1 = sqrt(H1 + hp), u2 = sqrt(hEnd + hp), ts = [0], hs = [H1], qs = [K * u1];
    let tt = 0, fp = fu(u1); const du = (u2 - u1) / N;
    for (let i = 1; i <= N; i++) { const u = u1 + i * du, fc = fu(u); tt += ((fp + fc) / 2) * du; fp = fc; ts.push(tt); hs.push(u * u - hp); qs.push(K * u); }
    const sc = tEnd / tt; for (let i = 0; i <= N; i++) ts[i] *= sc;
    Object.assign(o.data, { heq, Qin, tEnd, table: { ts, hs, qs }, hAt: (x) => interp(ts, hs, x) });
    return o;
  };

  /* =====================================================================
     MODULE 2 — PIPE FLOW, HEAD LOSSES AND PIPE SYSTEMS
     ===================================================================== */
  // hf = k·Q^m for each friction formula
  function pipeK(F, L, D, c, U) {
    if (F === 'darcy') return { k: (U.kD * c * L) / pow(D, 5), m: 2 };
    if (F === 'manning') return { k: (U.kM * c * c * L) / pow(D, 16 / 3), m: 2 };
    return { k: (U.kH * L) / (pow(c, 1.852) * pow(D, 4.87)), m: 1.852 };
  }
  HP.pipeK = pipeK;
  function kFormula(F, U) {
    if (F === 'darcy') return `hf = f·L·v²/(2gD) = ${U.kDt}·f·L·Q²/D⁵  ⇒ k = ${U.kDt}·f·L/D⁵`;
    if (F === 'manning') return `hf = ${U.kM}·n²·L·Q²/D^(16/3)  ⇒ k = ${U.kM}·n²·L/D^(16/3)`;
    return `hf = ${U.kH}·L·Q^1.852/(C^1.852·D^4.87)  ⇒ k = ${U.kH}·L/(C^1.852·D^4.87)`;
  }
  function kSubst(F, U, p) {
    if (F === 'darcy') return `k = ${U.kDt}(${fmt(p.c)})(${fmt(p.L)})/(${fmt(p.D)})⁵`;
    if (F === 'manning') return `k = ${U.kM}(${fmt(p.c)})²(${fmt(p.L)})/(${fmt(p.D)})^(16/3)`;
    return `k = ${U.kH}(${fmt(p.L)})/((${fmt(p.c)})^1.852 (${fmt(p.D)})^4.87)`;
  }
  // Colebrook (Swamee-Jain start); laminar f = 64/Re
  HP.frictionFactor = function (Re, rel) {
    if (Re < 2000) return { f: 64 / Re, fsj: 64 / Re, regime: 'laminar' };
    const fsj = 0.25 / pow(Math.log10(rel / 3.7 + 5.74 / pow(Re, 0.9)), 2);
    let f = fsj;
    for (let i = 0; i < 60; i++) f = pow(-2 * Math.log10(rel / 3.7 + 2.51 / (Re * sqrt(f))), -2);
    return { f, fsj, regime: Re < 4000 ? 'transitional' : 'turbulent' };
  };

  HP.pipes = function (I, U) {
    const o = Out(), g = U.g, L = U.L, mode = I.mode, F = I.formula;
    const cName = F === 'darcy' ? 'f' : F === 'manning' ? 'n' : 'C';
    const np = mode === 'single' ? 1 : mode === 'three' ? 3 : +I.np;
    const cole = I.cole && F === 'darcy';
    const pipes = [];
    for (let i = 1; i <= np; i++) {
      const c = F === 'darcy' ? I['f' + i] : F === 'manning' ? I['n' + i] : I['C' + i];
      pipes.push({ i, L: I['L' + i], D: I['D' + i], c, A: (PI * pow(I['D' + i], 2)) / 4 });
    }
    const vh = (v) => (v * v) / (2 * g);
    // update f from Colebrook for a given Q
    function colebrook(p, Q, record) {
      const v = abs(Q) / p.A, Re = (v * p.D) / I.nu, rel = I.eps / p.D;
      const r = HP.frictionFactor(Re, rel);
      p.c = r.f; p.Re = Re; p.regime = r.regime;
      if (record) {
        S(o, `Reynolds number, pipe ${p.i}`, 'Re = vD/ν', `Re = ${fmt(v)} × ${fmt(p.D)} / ${fmt(I.nu)}`, fmt(Re) + ` (${r.regime})`, 'Ratio of inertial to viscous forces.');
        if (Re < 2000) S(o, `Friction factor, pipe ${p.i} (laminar)`, 'f = 64/Re', `f = 64/${fmt(Re)}`, fmt(r.f), 'Laminar flow: f depends only on Re.');
        else S(o, `Friction factor, pipe ${p.i}`, '1/√f = −2 log(ε/3.7D + 2.51/(Re√f))', `Swamee-Jain start f = ${fmt(r.fsj)}, ε/D = ${fmt(rel)}`, `f = ${fmt(r.f)}`, 'Colebrook solved by iteration.');
        if (r.regime === 'transitional') W(o, `Pipe ${p.i}: Re = ${fmt(Re)} is in the transition zone (2000–4000); f is uncertain.`);
      }
    }
    const setK = (p) => { const r = pipeK(F, p.L, p.D, p.c, U); p.k = r.k; p.m = r.m; };
    o.data = { mode, F, pipes };

    if (mode === 'single' || mode === 'series') {
      /* ends: 'res'  reservoir → reservoir (H = difference of surfaces)
               'free' reservoir → free jet at the last node (velocity head leaves with the jet)
               'nodes' point A → point B in a pipeline (pressure at A given, pressure at B found) */
      const Q = I.Q, ends = I.ends || 'res', gam = U.gw;
      const zn = []; for (let i = 0; i <= np; i++) zn.push(I['zn' + i] || 0);
      if (cole) pipes.forEach((p) => colebrook(p, Q, true));
      let sumHf = 0, sumHm = 0; const events = [];
      pipes.forEach((p) => {
        setK(p); p.Q = Q; p.v = Q / p.A; p.hv = vh(p.v); p.hf = p.k * pow(Q, p.m); sumHf += p.hf;
        S(o, `Velocity in pipe ${p.i}`, 'v = Q/A = 4Q/(πD²)', `v = 4(${fmt(Q)})/(π·${fmt(p.D)}²)`, `${fmt(p.v)} ${U.v}`, 'Mean velocity from continuity.');
        if (F === 'darcy') S(o, `Friction loss in pipe ${p.i} (Darcy)`, `hf = f·L·v²/(2gD) = ${U.kDt}·f·L·Q²/D⁵`, `hf = ${fmt(p.c)} × ${fmt(p.L)} × ${fmt(p.v)}²/(2×${fmt(g)}×${fmt(p.D)})`, `${fmt(p.hf)} ${L}`, `Velocity head v²/2g = ${fmt(p.hv)} ${L}.`);
        else S(o, `Friction loss in pipe ${p.i} (${F === 'manning' ? 'Manning' : 'Hazen-Williams'})`, kFormula(F, U), kSubst(F, U, p) + ` = ${fmt(p.k)};  hf = k·Q^${p.m === 2 ? 2 : 1.852}`, `${fmt(p.hf)} ${L}`, `Velocity head v²/2g = ${fmt(p.hv)} ${L}.`);
      });
      const first = pipes[0], last = pipes[np - 1];
      const hEnt = ends === 'nodes' ? 0 : I.Kent * first.hv; events.push({ at: 0, dh: hEnt, label: 'entrance' });
      if (hEnt) S(o, 'Entrance loss', 'h_ent = K_ent·v₁²/(2g)', `h_ent = ${fmt(I.Kent)} × ${fmt(first.hv)}`, `${fmt(hEnt)} ${L}`, 'Loss where the pipe leaves the reservoir.');
      sumHm += hEnt;
      let hFit = 0;
      if (I.Kfit) { hFit = I.Kfit * first.hv; sumHm += hFit; events.push({ at: 0, dh: hFit, label: 'bends/valves', spread: true }); S(o, 'Bends and valves (pipe 1)', 'h_fit = ΣK·v₁²/(2g)', `h_fit = ${fmt(I.Kfit)} × ${fmt(first.hv)}`, `${fmt(hFit)} ${L}`, 'Fittings along pipe 1.'); }
      const trans = [0];
      for (let i = 0; i < np - 1; i++) {
        const a = pipes[i], b = pipes[i + 1]; let h = 0;
        if (b.D > a.D) { h = pow(a.v - b.v, 2) / (2 * g); S(o, `Sudden enlargement ${a.i}→${b.i}`, 'h = (v₁ − v₂)²/(2g)', `h = (${fmt(a.v)} − ${fmt(b.v)})²/(2×${fmt(g)})`, `${fmt(h)} ${L}`, 'Borda–Carnot loss at the expansion.'); }
        else if (b.D < a.D) { const Kc = 0.5 * (1 - pow(b.D / a.D, 2)); h = Kc * b.hv; S(o, `Sudden contraction ${a.i}→${b.i}`, 'h = K_c·v₂²/(2g), K_c ≈ 0.5(1 − D₂²/D₁²)', `h = ${fmt(Kc)} × ${fmt(b.hv)}`, `${fmt(h)} ${L}`, 'Approximate contraction loss.'); }
        sumHm += h; trans.push(h); events.push({ at: i + 1, dh: h, label: 'transition' });
      }
      let hEx = 0;
      if (ends === 'res') { hEx = I.Kexit * last.hv; if (hEx) S(o, 'Exit loss', 'h_exit = K_exit·v²/(2g)', `h_exit = ${fmt(I.Kexit)} × ${fmt(last.hv)}`, `${fmt(hEx)} ${L}`, 'Velocity head lost entering the lower reservoir.'); events.push({ at: np, dh: hEx, label: 'exit' }); }
      else if (ends === 'free') { hEx = last.hv; S(o, 'Velocity head of the free jet', 'h_jet = v²/(2g)', `h_jet = ${fmt(last.v)}²/(2×${fmt(g)})`, `${fmt(hEx)} ${L}`, 'This energy leaves with the jet; it is not a friction loss.'); events.push({ at: np, dh: hEx, label: 'outlet v²/2g' }); }
      else events.push({ at: np, dh: 0, label: 'exit' });
      const HL = sumHf + sumHm;
      // energy line at the nodes
      const nodes = [];
      let E, zUp = NaN, zDown = NaN;
      if (ends === 'nodes') E = zn[0] + I.pA / gam + first.hv;
      else {
        const Ht = HL + hEx;
        zDown = ends === 'res' ? I.zR : zn[np];
        zUp = zDown + Ht;
        S(o, ends === 'res' ? 'Head between reservoir surfaces' : 'Head from the supply surface to the outlet', ends === 'res' ? 'H = Σhf + Σhm (incl. exit)' : 'H = Σhf + Σhm + v²/(2g)', `H = ${fmt(sumHf)} + ${fmt(sumHm)}${ends === 'free' ? ' + ' + fmt(hEx) : hEx ? ' + ' + fmt(hEx) : ''}`, `${fmt(Ht)} ${L}`, ends === 'res' ? 'Difference in water surface elevations needed to push Q.' : 'The supply surface must stand this far above the outlet.');
        S(o, 'Supply surface elevation', ends === 'res' ? 'z_up = z_down + H' : 'z_up = z_outlet + H', `z_up = ${fmt(zDown)} + ${fmt(Ht)}`, `${fmt(zUp)} ${L}`, 'Energy grade line starts at this level.');
        E = zUp - hEnt;
      }
      for (let i = 0; i <= np; i++) {
        const pin = pipes[Math.min(i, np - 1)], pout = pipes[Math.max(i - 1, 0)];
        if (i > 0) { E -= pipes[i - 1].hf + (i === 1 ? hFit : 0); }
        const Eup = E; if (i > 0 && i < np) E -= trans[i];
        const vN = i === 0 ? pin.hv : pout.hv;
        let ph = Eup - zn[i] - vN; if (Math.abs(ph) < 1e-9) ph = 0;
        nodes.push({ z: zn[i], Eup, Edn: E, ph, p: ph * gam });
      }
      if (ends === 'nodes') {
        const B = nodes[np];
        S(o, 'Energy equation A → B', 'p_A/γ + v_A²/2g + z_A = p_B/γ + v_B²/2g + z_B + HL', `p_B/γ = ${fmt(I.pA / gam)} + ${fmt(first.hv)} + ${P(zn[0])} − ${fmt(last.hv)} − ${P(zn[np])} − ${fmt(HL)}`, `${fmt(B.ph)} ${L} → p_B = ${fmt(B.p)} ${U.p}`, 'Pressure left at the end of the pipeline.');
        R(o, 'Pressure at B', B.p, U.p, true); R(o, 'Pressure drop A → B', I.pA - B.p, U.p, true); R(o, 'Total head loss HL', HL, L, true);
      } else { R(o, ends === 'res' ? 'Head between surfaces H' : 'Head above outlet H', HL + hEx, L, true); R(o, 'Supply surface elevation', zUp, L); }
      nodes.forEach((n, i) => { S(o, `Pressure at node ${i}`, 'p/γ = EGL − z − v²/(2g)', `p/γ = ${fmt(n.Eup)} − ${P(n.z)} − ${fmt(i === 0 ? first.hv : pipes[i - 1].hv)}`, `${fmt(n.ph)} ${L} = ${fmt(n.p)} ${U.p}`, i === 0 ? 'Start of pipe 1.' : `End of pipe ${i}.`); R(o, `Pressure at node ${i}`, n.p, U.p); });
      const neg = nodes.map((n, i) => [n, i]).filter((x) => x[0].p < 0);
      neg.forEach(([n, i]) => { if (U.patm + n.p < U.pvap) W(o, `Node ${i}: absolute pressure ${fmt(U.patm + n.p)} ${U.p} is below the vapor pressure. The water would vaporize here (cavitation); raise the pressure or lower the pipe.`, 'err'); else W(o, `Node ${i}: pressure is below atmospheric (${fmt(n.p)} ${U.p}).`); });
      pipes.forEach((p) => { R(o, `Pipe ${p.i}: v`, p.v, U.v); R(o, `Pipe ${p.i}: hf`, p.hf, L, np === 1); if (cole) R(o, `Pipe ${p.i}: f (Colebrook)`, p.c, ''); });
      R(o, 'Σ friction losses', sumHf, L); R(o, 'Σ minor losses', sumHm + (ends === 'res' ? hEx : 0), L);
      if (ends !== 'nodes') R(o, 'Total head required H', HL + hEx, L, true);
      Object.assign(o.data, { Q, Ht: HL + hEx, HL, sumHf, sumHm, events, ends, nodes, zn, zUp, zDown, hEnt, hFit, trans, hEx });
      return o;
    }

    if (mode === 'parallel') {
      /* loop of 2–5 branches, each hf = k·Q^m + K·Q²·8/(gπ²D⁴); optional feeder / outlet pipes and end reservoirs.
         Known quantity: total Q | head H between reservoirs | head loss across the loop | flow in one branch. */
      const known = I.known || 'Q', res = known === 'H' || !!I.pres;
      pipes.forEach((p) => { p.K = I['K' + p.i] || 0; p.open = I['open' + p.i] !== false; p.Km = (p.K * 8) / (g * PI * PI * pow(p.D, 4)); });
      if (!pipes.some((p) => p.open)) return fail(o, 'Every branch is closed, so nothing can flow through the loop. Open at least one branch.');
      const mk = (tag, name) => { const c = F === 'darcy' ? I['f' + tag] : F === 'manning' ? I['n' + tag] : I['C' + tag]; return { i: tag, name, L: I['L' + tag], D: I['D' + tag], c, A: (PI * pow(I['D' + tag], 2)) / 4 }; };
      const fd = I.feed ? mk('F', 'feeder') : null, ot = I.outl ? mk('O', 'outlet') : null;
      const ext = [fd, ot].filter(Boolean);
      const hb = (p, Q) => p.k * pow(Q, p.m) + p.Km * Q * Q;
      const Qb = (p, h) => { if (!p.open || h <= 0) return 0; let hi = 1e-3; while (hb(p, hi) < h && hi < 1e7) hi *= 2; return bisect((Q) => hb(p, Q) - h, 0, hi, 1e-14); };
      const loopQ = (h) => pipes.reduce((s, p) => s + Qb(p, h), 0);
      const loopH = (Qt) => { if (Qt <= 0) return 0; let hi = 1e-3; while (loopQ(hi) < Qt && hi < 1e9) hi *= 2; return bisect((h) => loopQ(h) - Qt, 0, hi, 1e-12); };
      const hvA = (p, Q) => pow(Q / p.A, 2) / (2 * g);
      const hExt = (Qt) => { let h = 0; if (fd) h += fd.k * pow(Qt, fd.m) + (res ? I.Kent * hvA(fd, Qt) : 0); if (ot) h += ot.k * pow(Qt, ot.m) + (res ? I.Kexit * hvA(ot, Qt) : 0); return h; };
      let Qt = 0, hf = 0;
      const solveOnce = () => {
        pipes.forEach(setK); ext.forEach(setK);
        if (known === 'Q') { Qt = I.Q; hf = loopH(Qt); }
        else if (known === 'hf') { hf = I.hk; Qt = loopQ(hf); }
        else if (known === 'Qb') { const p = pipes[Math.min(+I.jb, np) - 1]; hf = hb(p, I.Qb); Qt = loopQ(hf); }
        else { let hi = 1e-3; const Hs = (Q) => loopH(Q) + hExt(Q); while (Hs(hi) < I.Ht && hi < 1e5) hi *= 2; Qt = bisect((Q) => Hs(Q) - I.Ht, 0, hi, 1e-12); hf = loopH(Qt); }
        pipes.forEach((p) => (p.Q = Qb(p, hf)));
      };
      if (known === 'Qb' && !pipes[Math.min(+I.jb, np) - 1].open) return fail(o, `Branch ${Math.min(+I.jb, np)} is closed, so its flow cannot be the known quantity. Open it or pick another branch.`);
      if (cole) { pipes.concat(ext).forEach((p) => (p.c = 0.02)); for (let it = 0; it < 30; it++) { solveOnce(); pipes.forEach((p) => p.open && p.Q > 0 && colebrook(p, p.Q, false)); ext.forEach((p) => colebrook(p, Qt, false)); } }
      solveOnce();
      const m = pipes[0].m, me = m === 2 ? '2' : '1.852';
      pipes.forEach((p) => {
        if (!p.open) { S(o, `Branch ${p.i}`, 'valve closed', '', 'Q = 0', 'A closed branch carries no flow; the others share Q.'); return; }
        S(o, `Branch ${p.i} constants`, kFormula(F, U) + (p.K ? ';  K-term = 8K/(gπ²D⁴)' : ''), kSubst(F, U, p) + (p.K ? `;  K-term = 8(${fmt(p.K)})/(${fmt(g)}π²·${fmt(p.D)}⁴)` : ''), `k = ${fmt(p.k)}${p.K ? ', K-term = ' + fmt(p.Km) : ''}`, p.K ? `hf = k·Q^${me} + ${fmt(p.Km)}·Q² (valves and fittings, ΣK = ${fmt(p.K)}).` : `hf = k·Q^${me}.` + (cole ? ` f from Colebrook = ${fmt(p.c)}.` : ''));
      });
      const kk = pipes.filter((p) => p.open).map((p) => p.k + p.Km);
      if (known === 'Q') {
        if (m === 2) S(o, 'Common head loss across the loop', 'Q = Σ√(hf/kᵢ) ⇒ √hf = Q / Σ(1/√kᵢ)', `√hf = ${fmt(Qt)} / (${kk.map((k) => fmt(1 / sqrt(k))).join(' + ')})`, `hf = ${fmt(hf)} ${L}`, 'Every branch between the two junctions loses the same head.');
        else S(o, 'Common head loss across the loop', 'ΣQᵢ(hf) = Q', 'solved by bisection on hf', `hf = ${fmt(hf)} ${L}`, 'Same head loss in every branch.');
      } else if (known === 'hf') S(o, 'Head loss across the loop (given)', 'hf', '', `${fmt(hf)} ${L}`, 'Each branch flow follows from this head.');
      else if (known === 'Qb') { const j = Math.min(+I.jb, np), p = pipes[j - 1]; S(o, `Head loss from the known flow in branch ${j}`, `hf = k${j}·Q${j}^${me}` + (p.K ? ` + K-term·Q${j}²` : ''), `hf = ${fmt(p.k)}(${fmt(I.Qb)})^${me}` + (p.K ? ` + ${fmt(p.Km)}(${fmt(I.Qb)})²` : ''), `${fmt(hf)} ${L}`, 'The same hf drives every other branch.'); }
      else S(o, 'Solve for Q from the head between reservoirs', 'H = h_ent + hf_feeder + hf_loop(Q) + hf_outlet + h_exit', `H = ${fmt(I.Ht)} ${L}; Q found by bisection`, `Q = ${fmt(Qt)} ${U.Q}, hf_loop = ${fmt(hf)} ${L}`, 'The whole system is in series with the loop.');
      pipes.forEach((p) => { p.v = p.Q / p.A; p.hv = vh(p.v); p.hf = p.open ? hf : 0; if (p.open) S(o, `Flow in branch ${p.i}`, `solve k·Q^${me}${p.K ? ' + K-term·Q²' : ''} = hf`, `hf = ${fmt(hf)} ${L}`, `Q${p.i} = ${fmt(p.Q)} ${U.Q} (${fmt((100 * p.Q) / Qt)}%)`, `Velocity ${fmt(p.v)} ${U.v}.`); });
      S(o, 'Continuity check', 'ΣQᵢ = Q', pipes.filter((p) => p.open).map((p) => fmt(p.Q)).join(' + '), `${fmt(Qt)} ${U.Q}`, 'Branch flows add up to the total.');
      let Hsys = hf;
      ext.forEach((p) => { p.Q = Qt; p.v = Qt / p.A; p.hv = vh(p.v); p.hf = p.k * pow(Qt, p.m); Hsys += p.hf; S(o, `${p.name === 'feeder' ? 'Feeder' : 'Outlet'} pipe loss`, kFormula(F, U).split('  ⇒')[0], kSubst(F, U, p) + `;  hf = k·Q^${me}`, `${fmt(p.hf)} ${L}`, `Carries the full Q at v = ${fmt(p.v)} ${U.v}.`); });
      let hEnt = 0, hEx = 0;
      if (res) { const pe = fd || pipes.find((p) => p.open), px = ot || pipes.find((p) => p.open); if (fd) { hEnt = I.Kent * fd.hv; } if (ot) { hEx = I.Kexit * ot.hv; } Hsys += hEnt + hEx; if (hEnt || hEx) S(o, 'Entrance and exit losses', 'h = K·v²/(2g)', `h_ent = ${fmt(I.Kent)}×${fmt(fd ? fd.hv : 0)};  h_exit = ${fmt(I.Kexit)}×${fmt(ot ? ot.hv : 0)}`, `${fmt(hEnt + hEx)} ${L}`, 'Applied on the feeder and outlet pipes.'); if (!fd && !ot) W(o, 'Entrance and exit losses are only applied to feeder/outlet pipes; add them to include those losses.', 'info'); void pe; void px; }
      if (ext.length || res) S(o, 'Total head across the system', 'H = Σ(feeder, loop, outlet, minor)', `H = ${[fd ? fmt(fd.hf) : null, fmt(hf), ot ? fmt(ot.hf) : null, hEnt + hEx ? fmt(hEnt + hEx) : null].filter(Boolean).join(' + ')}`, `${fmt(Hsys)} ${L}`, res ? 'Difference between the reservoir surfaces.' : 'Energy drop from the start of the feeder to the end of the outlet.');
      R(o, 'Total flow Q', Qt, U.Q, true); R(o, 'Head loss across the loop hf', hf, L, true);
      if (ext.length || res) R(o, res ? 'Head between reservoirs H' : 'Total head loss of the system', Hsys, L, true);
      pipes.forEach((p) => { if (!p.open) { R(o, `Q${p.i}`, 'closed', ''); return; } R(o, `Q${p.i}`, p.Q, U.Q, true); R(o, `Q${p.i} share`, (100 * p.Q) / Qt, '%'); R(o, `v${p.i}`, p.v, U.v); });
      ext.forEach((p) => R(o, `${p.name === 'feeder' ? 'Feeder' : 'Outlet'} hf`, p.hf, L));
      Object.assign(o.data, { Q: Qt, hf, fd, ot, res, Hsys, hEnt, hEx, known });
      return o;
    }

    if (mode === 'three') {
      const z = [I.zA, I.zB, I.zC];
      if (cole) pipes.forEach((p) => (p.c = 0.02));
      let Pj = 0; const hist = [];
      const sumQ = (Pe) => pipes.reduce((s, p, i) => s + Math.sign(z[i] - Pe) * pow(abs(z[i] - Pe) / p.k, 1 / p.m), 0);
      const solve = (h) => { pipes.forEach(setK); Pj = bisect(sumQ, Math.min(...z), Math.max(...z), 1e-10, 200, h); };
      if (cole) for (let it = 0; it < 30; it++) { solve(); pipes.forEach((p, i) => colebrook(p, pow(abs(z[i] - Pj) / p.k, 1 / p.m) || 1e-6, false)); }
      solve(hist);
      pipes.forEach((p, i) => { p.Q = Math.sign(z[i] - Pj) * pow(abs(z[i] - Pj) / p.k, 1 / p.m); p.v = abs(p.Q) / p.A; p.hf = abs(z[i] - Pj); p.hv = vh(p.v); });
      pipes.forEach((p) => S(o, `Pipe constant k${p.i}`, kFormula(F, U), kSubst(F, U, p), fmt(p.k), cole ? `f from Colebrook = ${fmt(p.c)}.` : 'So that hf = k·Q^m in each pipe.'));
      const rows = hist.filter((_, i) => i < 10 || i === hist.length - 1).map((r, i) => {
        const Pe = r[2]; const q = pipes.map((p, j) => Math.sign(z[j] - Pe) * pow(abs(z[j] - Pe) / p.k, 1 / p.m));
        return [i < 10 ? String(i + 1) : String(hist.length), fmt(Pe), fmt(q[0]), fmt(q[1]), fmt(q[2]), fmt(q[0] + q[1] + q[2])];
      });
      S(o, 'Assume the energy elevation P at the junction', 'Qᵢ = sign(zᵢ − P)·(|zᵢ − P|/kᵢ)^(1/m); adjust P until ΣQ = 0', `bisection between ${fmt(Math.min(...z))} and ${fmt(Math.max(...z))} ${L}`, `P = ${fmt(Pj)} ${L}`, 'Positive Q flows toward the junction.',
        { head: ['#', `P (${L})`, 'Q₁', 'Q₂', 'Q₃', 'ΣQ'], rows });
      const names = ['A', 'B', 'C'];
      pipes.forEach((p, i) => S(o, `Flow in pipe ${p.i} (reservoir ${names[i]})`, `Q = (|z${names[i]} − P|/k)^(1/m)`, `Q = (|${fmt(z[i])} − ${fmt(Pj)}|/${fmt(p.k)})^(1/${p.m === 2 ? 2 : 1.852})`, `${fmt(abs(p.Q))} ${U.Q} ${p.Q >= 0 ? 'from ' + names[i] : 'into ' + names[i]}`, `hf = ${fmt(p.hf)} ${L}, v = ${fmt(p.v)} ${U.v}.`));
      R(o, 'Junction energy elevation P', Pj, L, true);
      pipes.forEach((p, i) => R(o, `Q${p.i} ${p.Q >= 0 ? '(from ' + names[i] + ')' : '(into ' + names[i] + ')'}`, abs(p.Q), U.Q, true));
      const middle = [...z].sort((a, b) => a - b)[1]; const mi = z.indexOf(middle);
      const sup = pipes[mi].Q > 0;
      W(o, `The middle reservoir ${names[mi]} ${abs(pipes[mi].Q) < 1e-9 ? 'neither supplies nor receives water' : sup ? 'supplies water (P is below its surface)' : 'receives water (P is above its surface)'}.`, 'info');
      Object.assign(o.data, { z, Pj, middle: mi });
      return o;
    }

    // equivalent pipe
    const sys = I.sys;
    if (cole) W(o, 'Colebrook is not applied in equivalent-pipe mode; the entered f values are used.', 'info');
    pipes.forEach(setK);
    const m = pipes[0].m;
    pipes.forEach((p) => S(o, `Pipe constant k${p.i}`, kFormula(F, U), kSubst(F, U, p), fmt(p.k), 'hf = k·Q^m.'));
    let keq;
    if (sys === 'series') { keq = pipes.reduce((s, p) => s + p.k, 0); S(o, 'Equivalent constant (series)', 'k_eq = Σkᵢ', pipes.map((p) => fmt(p.k)).join(' + '), fmt(keq), 'Same Q, losses add.'); }
    else { const s = pipes.reduce((a, p) => a + pow(p.k, -1 / m), 0); keq = pow(s, -m); S(o, 'Equivalent constant (parallel)', `k_eq^(−1/m) = Σkᵢ^(−1/m)`, pipes.map((p) => fmt(pow(p.k, -1 / m))).join(' + ') + ` = ${fmt(s)}`, fmt(keq), 'Same hf, flows add.'); }
    const ce = F === 'darcy' ? I.fe : F === 'manning' ? I.ne : I.Ce;
    const unitK = pipeK(F, 1, 1, ce, U).k; // k for L = 1, D = 1
    const ex = F === 'darcy' ? 5 : F === 'manning' ? 16 / 3 : 4.87;
    let Le, De;
    if (I.solveFor === 'L') { De = I.De; Le = (keq * pow(De, ex)) / unitK; S(o, 'Equivalent length', `L_e = k_eq·D^${F === 'manning' ? '(16/3)' : fmt(ex)} / (coefficient)`, `L_e = ${fmt(keq)} × ${fmt(De)}^${fmt(ex)} / ${fmt(unitK)}`, `${fmt(Le)} ${L}`, `Length of one pipe (D = ${fmt(De)}, ${cName} = ${fmt(ce)}) with the same hf at the same Q.`); }
    else { Le = I.Le; De = pow((unitK * Le) / keq, 1 / ex); S(o, 'Equivalent diameter', `D_e = (coefficient·L_e / k_eq)^(1/${fmt(ex)})`, `D_e = (${fmt(unitK)} × ${fmt(Le)} / ${fmt(keq)})^(1/${fmt(ex)})`, `${fmt(De)} ${L}`, `Diameter of one pipe (L = ${fmt(Le)}, ${cName} = ${fmt(ce)}) with the same hf.`); }
    const Q = I.Q, hf = keq * pow(Q, m);
    S(o, 'Check at the given Q', 'hf = k_eq·Q^m', `hf = ${fmt(keq)} × ${fmt(Q)}^${m === 2 ? 2 : 1.852}`, `${fmt(hf)} ${L}`, 'The system and the equivalent pipe lose the same head.');
    R(o, 'Equivalent constant k_eq', keq, ''); R(o, 'Equivalent length L_e', Le, L, I.solveFor === 'L'); R(o, 'Equivalent diameter D_e', U.sys === 'SI' ? De * 1000 : De * 12, U.sys === 'SI' ? 'mm' : 'in', I.solveFor === 'D'); R(o, 'hf at Q', hf, L);
    pipes.forEach((p) => { p.Q = sys === 'series' ? Q : pow(hf / p.k, 1 / m); p.v = p.Q / p.A; p.hf = sys === 'series' ? p.k * pow(Q, m) : hf; });
    Object.assign(o.data, { sys, keq, Le, De, Q, hf });
    return o;
  };

  /* =====================================================================
     CHANNEL SECTION GEOMETRY (shared by Modules 3 and 6)
     ===================================================================== */
  HP.section = function (shape, G, y) {
    const b = G.b, z = G.z, D = G.D;
    let A, Pw, T, th;
    if (shape === 'rect') { A = b * y; Pw = b + 2 * y; T = b; }
    else if (shape === 'trap') { A = (b + z * y) * y; Pw = b + 2 * y * sqrt(1 + z * z); T = b + 2 * z * y; }
    else if (shape === 'tri') { A = z * y * y; Pw = 2 * y * sqrt(1 + z * z); T = 2 * z * y; }
    else {
      // circle (closed conduit, y ≤ D) or semicircle (open channel of radius r = D/2, y ≤ r): same segment formulas
      const yy = Math.min(Math.max(y, 0), shape === 'semi' ? D / 2 : D);
      th = 2 * Math.acos(1 - (2 * yy) / D); A = ((D * D) / 8) * (th - Math.sin(th)); Pw = (D * th) / 2; T = D * Math.sin(th / 2);
    }
    return { A, P: Pw, T, R: A / Pw, Dh: A / T, theta: th };
  };
  const secText = {
    rect: 'A = b·y,  P = b + 2y,  T = b',
    trap: 'A = (b + zy)y,  P = b + 2y√(1+z²),  T = b + 2zy',
    tri: 'A = zy²,  P = 2y√(1+z²),  T = 2zy',
    circ: 'θ = 2cos⁻¹(1 − 2y/D),  A = (D²/8)(θ − sinθ),  P = Dθ/2,  T = D·sin(θ/2)',
    semi: 'r = D/2,  θ = 2cos⁻¹(1 − y/r),  A = (r²/2)(θ − sinθ),  P = rθ,  T = 2r·sin(θ/2)   (y ≤ r)'
  };
  HP.secText = secText;
  function yMaxFor(shape, G) { return shape === 'circ' ? G.D * 0.99999 : shape === 'semi' ? G.D / 2 : 1e4; }
  HP.yMaxFor = yMaxFor;
  const roundShape = (shape) => shape === 'circ' || shape === 'semi';
  // Critical depth: Q²T/(gA³) = 1
  HP.criticalDepth = function (shape, G, Q, g) {
    const f = (y) => { const s = HP.section(shape, G, y); return (Q * Q * s.T) / (g * pow(s.A, 3)) - 1; };
    // semicircle: y_c must lie below the rim (y = r); NaN means the flow is supercritical even when full
    let hi = shape === 'circ' ? G.D * 0.999 : shape === 'semi' ? G.D / 2 : 1;
    if (!roundShape(shape)) while (f(hi) > 0 && hi < 1e5) hi *= 2;
    return bisect(f, 1e-7, hi, 1e-11);
  };
  const Efun = (shape, G, Q, g) => (y) => y + (Q * Q) / (2 * g * pow(HP.section(shape, G, y).A, 2));
  HP.Efun = Efun;
  // Alternate depths for given E: [supercritical, subcritical]
  HP.alternateDepths = function (shape, G, Q, g, E, yc) {
    const Ef = Efun(shape, G, Q, g);
    const sup = bisect((y) => Ef(y) - E, 1e-7, yc, 1e-11);
    const top = shape === 'circ' ? G.D * 0.99999 : shape === 'semi' ? Math.min(G.D / 2, E) : E;
    const sub = bisect((y) => Ef(y) - E, yc, top, 1e-11);
    return [sup, sub];
  };

  /* =====================================================================
     MODULE 3 — SPECIFIC ENERGY AND HYDRAULIC JUMP
     ===================================================================== */
  function jumpType(F) {
    if (F <= 1) return 'no jump (F₁ ≤ 1)';
    if (F < 1.7) return 'undular jump';
    if (F < 2.5) return 'weak jump';
    if (F < 4.5) return 'oscillating jump';
    if (F < 9) return 'steady jump';
    return 'strong jump';
  }
  HP.specific = function (I, U) {
    const o = Out(), g = U.g, L = U.L, mode = I.mode;
    const shape = mode === 'curve' ? I.shape : 'rect';
    const G = { b: shape === 'tri' ? 0 : I.b, z: shape === 'rect' ? 0 : I.z, D: I.Dc };
    const useq = shape === 'rect' && I.qmode === 'q';
    const Q = useq ? I.q * I.b : I.Q;
    const q = shape === 'rect' ? Q / I.b : NaN;
    if ((shape === 'tri' || (shape === 'trap' && false)) && !(I.z > 0)) return fail(o, 'A triangular channel needs a side slope z > 0.');
    o.data = { mode, shape, G, Q, q, g };
    if (shape === 'rect') S(o, 'Unit discharge', useq ? 'Q = q·b' : 'q = Q/b', useq ? `Q = ${fmt(I.q)} × ${fmt(I.b)}` : `q = ${fmt(Q)}/${fmt(I.b)}`, useq ? `${fmt(Q)} ${U.Q}` : `${fmt(q)} ${U.q}`, 'Flow per unit width of a rectangular channel.');
    const yc = HP.criticalDepth(shape, G, Q, g);
    if (!isFinite(yc)) return fail(o, shape === 'semi' ? `Critical depth not found: Q = ${fmt(Q)} ${U.Q} is too large for this semicircle (the flow is supercritical even when full, so y_c would be above the rim). Use a larger D.` : 'Critical depth not found: for a circular conduit the discharge is too large to flow part-full.');
    if (shape === 'semi' && mode === 'curve' && I.y > I.Dc / 2 + 1e-12) return fail(o, `Depth y = ${fmt(I.y)} ${L} exceeds the radius r = ${fmt(I.Dc / 2)} ${L}: a semicircular channel is full at y = r.`);
    const sc = HP.section(shape, G, yc), Emin = yc + (Q * Q) / (2 * g * sc.A * sc.A), vc = Q / sc.A;
    if (shape === 'rect') S(o, 'Critical depth', 'y_c = (q²/g)^(1/3)', `y_c = (${fmt(q)}²/${fmt(g)})^(1/3)`, `${fmt(yc)} ${L}`, 'Depth at which specific energy is minimum.');
    else if (shape === 'tri') S(o, 'Critical depth (triangular)', 'y_c = (2Q²/(g z²))^(1/5)', `y_c = (2·${fmt(Q)}²/(${fmt(g)}·${fmt(I.z)}²))^(1/5)`, `${fmt(yc)} ${L}`, 'Closed form for a V-shaped channel.');
    else S(o, 'Critical depth (general section)', 'Q²T/(gA³) = 1', `solved numerically, Q = ${fmt(Q)} ${U.Q}`, `${fmt(yc)} ${L}`, 'Froude number equals 1 at critical depth.');
    S(o, 'Minimum specific energy', shape === 'rect' ? 'E_min = 1.5·y_c' : 'E_min = y_c + Q²/(2gA_c²)', shape === 'rect' ? `E_min = 1.5 × ${fmt(yc)}` : `E_min = ${fmt(yc)} + ${fmt(Q)}²/(2·${fmt(g)}·${fmt(sc.A)}²)`, `${fmt(Emin)} ${L}`, `Critical velocity v_c = ${fmt(vc)} ${U.v}.`);
    R(o, 'Critical depth y_c', yc, L, true); R(o, 'Minimum energy E_min', Emin, L); R(o, 'Critical velocity v_c', vc, U.v);
    o.data.yc = yc; o.data.Emin = Emin;

    if (mode === 'curve') {
      const y = I.y, s = HP.section(shape, G, y), v = Q / s.A, E = y + (v * v) / (2 * g), Fr = v / sqrt(g * s.Dh);
      S(o, 'Section properties', secText[shape], (shape === 'semi' ? `r = ${fmt(G.D / 2)} ${L}, ` : '') + `y = ${fmt(y)} ${L}` + (shape === 'semi' || shape === 'circ' ? `, θ = ${fmt(s.theta)} rad` : ''), `A = ${fmt(s.A)} ${U.A}, T = ${fmt(s.T)} ${L}, D_h = A/T = ${fmt(s.Dh)} ${L}`, 'Flow area, top width and hydraulic depth.');
      S(o, 'Specific energy', shape === 'rect' ? 'E = y + q²/(2gy²)' : 'E = y + Q²/(2gA²)', shape === 'rect' ? `E = ${fmt(y)} + ${fmt(q)}²/(2·${fmt(g)}·${fmt(y)}²)` : `E = ${fmt(y)} + ${fmt(Q)}²/(2·${fmt(g)}·${fmt(s.A)}²)`, `${fmt(E)} ${L}`, 'Energy measured from the channel bottom.');
      const reg = abs(Fr - 1) < 0.01 ? 'critical' : Fr < 1 ? 'subcritical' : 'supercritical';
      S(o, 'Froude number', 'F = v/√(g·D_h)', `F = ${fmt(v)}/√(${fmt(g)} × ${fmt(s.Dh)})`, `${fmt(Fr)} → ${reg}`, 'F < 1 subcritical, F > 1 supercritical.');
      const alt = HP.alternateDepths(shape, G, Q, g, E, yc);
      const other = y > yc ? alt[0] : alt[1];
      if (shape === 'semi' && !isFinite(alt[1])) W(o, `The subcritical alternate depth would be above the rim (r = ${fmt(G.D / 2)} ${L}): it does not exist in this semicircle.`, 'info');
      if (shape === 'rect') S(o, 'Alternate depths (solve the cubic)', 'y³ − E·y² + q²/(2g) = 0', `y³ − ${fmt(E)}y² + ${fmt((q * q) / (2 * g))} = 0`, `y = ${fmt(alt[0])} and ${fmt(alt[1])} ${L}`, 'Two positive roots with the same E; the third root is negative.');
      else S(o, 'Alternate depths', 'E(y) = E, solved on each side of y_c', `E = ${fmt(E)} ${L}`, `y = ${fmt(alt[0])} and ${fmt(alt[1])} ${L}`, 'Supercritical and subcritical depths with the same E.');
      R(o, 'Velocity v', v, U.v); R(o, 'Specific energy E', E, L, true); R(o, 'Froude number F', Fr, '', true); R(o, 'Flow regime', reg, ''); R(o, 'Alternate depth', other, L, true);
      Object.assign(o.data, { y, E, Fr, alt, other, v });
      // step / contraction
      const dz = I.dz, b2 = shape === 'rect' || shape === 'trap' ? I.b2 : I.b;
      const changed = dz !== 0 || ((shape === 'rect' || shape === 'trap') && abs(b2 - I.b) > 1e-9);
      if (changed) {
        const G2 = { b: b2, z: I.z, D: I.Dc };
        const yc2 = HP.criticalDepth(shape, G2, Q, g), s2c = HP.section(shape, G2, yc2), Emin2 = yc2 + (Q * Q) / (2 * g * s2c.A * s2c.A);
        const E2 = E - dz;
        S(o, 'Energy over the step / in the contraction', 'E₂ = E₁ − Δz', `E₂ = ${fmt(E)} − ${P(dz)}`, `${fmt(E2)} ${L}`, 'No loss assumed across a short transition.');
        S(o, 'Minimum energy at the transition', b2 !== I.b ? 'E_min,2 from y_c at width b₂' : 'E_min,2 = E_min', `y_c,2 = ${fmt(yc2)} ${L}`, `${fmt(Emin2)} ${L}`, 'The flow needs at least this much energy to pass.');
        let y2, y1n = y, choke = false;
        if (E2 < Emin2) {
          choke = true;
          const E1n = Emin2 + dz;
          const altn = HP.alternateDepths(shape, G, Q, g, E1n, yc);
          y1n = y > yc ? altn[1] : altn[0]; y2 = yc2;
          S(o, 'Choking: E₂ < E_min,2', 'E₁′ = E_min,2 + Δz; y₂ = y_c,2', `E₁′ = ${fmt(Emin2)} + ${P(dz)} = ${fmt(E1n)}`, `new upstream depth y₁′ = ${fmt(y1n)} ${L}`, y > yc ? 'The water backs up upstream until it has enough energy.' : 'Supercritical flow is forced through a jump upstream.');
          W(o, `Choking: the flow does not have enough energy to pass the ${dz !== 0 ? 'step' : 'contraction'}. Depth at the transition becomes critical (${fmt(yc2)} ${L}) and the upstream depth changes to ${fmt(y1n)} ${L}.`);
          R(o, 'Upstream depth after choking y₁′', y1n, L, true);
        } else {
          const a2 = HP.alternateDepths(shape, G2, Q, g, E2, yc2);
          y2 = y > yc ? a2[1] : a2[0];
          S(o, 'Depth over the step / in the contraction', 'E(y₂) = E₂ (same regime as upstream)', `E₂ = ${fmt(E2)} ${L}`, `y₂ = ${fmt(y2)} ${L}`, y > yc ? 'Subcritical flow: the surface dips over a rise.' : 'Supercritical flow: the surface rises over a rise.');
        }
        R(o, 'Depth at transition y₂', y2, L, true); R(o, 'Max step without choking Δz_max', E - Emin2, L);
        Object.assign(o.data, { step: { dz, b2, y2, y1n, choke, E2, Emin2, yc2 } });
      }
      return o;
    }

    // jump / gate (rectangular)
    let y1, y0;
    if (mode === 'gate') {
      y1 = I.Cc * I.a;
      S(o, 'Depth at the vena contracta', 'y₁ = Cc·a', `y₁ = ${fmt(I.Cc)} × ${fmt(I.a)}`, `${fmt(y1)} ${L}`, 'The jet contracts just downstream of the gate.');
      if (y1 >= yc) return fail(o, `The gate is too high: y₁ = ${fmt(y1)} ${L} is not below y_c = ${fmt(yc)} ${L}, so the flow is not supercritical and the jump cannot form.`);
      const E1g = y1 + (q * q) / (2 * g * y1 * y1);
      y0 = HP.alternateDepths('rect', G, Q, g, E1g, yc)[1];
      S(o, 'Upstream depth (energy, no loss)', 'y₀ + q²/(2gy₀²) = y₁ + q²/(2gy₁²)', `E = ${fmt(E1g)} ${L}`, `y₀ = ${fmt(y0)} ${L}`, 'Subcritical alternate depth of y₁.');
      if (y0 < I.a) W(o, 'Upstream depth is lower than the gate opening; the gate would not control the flow.');
      R(o, 'Upstream depth y₀', y0, L);
    } else y1 = I.y;
    const v1 = q / y1, F1 = v1 / sqrt(g * y1);
    S(o, 'Upstream velocity and Froude number', 'v₁ = q/y₁,  F₁ = v₁/√(g·y₁)', `v₁ = ${fmt(q)}/${fmt(y1)} = ${fmt(v1)};  F₁ = ${fmt(v1)}/√(${fmt(g)}·${fmt(y1)})`, `F₁ = ${fmt(F1)}`, 'A jump needs supercritical flow (F₁ > 1).');
    if (F1 <= 1) return fail(o, `Upstream flow is subcritical (F₁ = ${fmt(F1)} ≤ 1). A hydraulic jump cannot form. Use a depth below y_c = ${fmt(yc)} ${L}.`);
    const y2 = (y1 / 2) * (sqrt(1 + 8 * F1 * F1) - 1);
    const E1 = y1 + (v1 * v1) / (2 * g), v2 = q / y2, E2 = y2 + (v2 * v2) / (2 * g);
    const dE = pow(y2 - y1, 3) / (4 * y1 * y2), Pw = U.gw * Q * dE;
    const M1 = (q * q) / (g * y1) + (y1 * y1) / 2, M2 = (q * q) / (g * y2) + (y2 * y2) / 2;
    S(o, 'Sequent (conjugate) depth', 'y₂ = (y₁/2)(√(1 + 8F₁²) − 1)', `y₂ = (${fmt(y1)}/2)(√(1 + 8·${fmt(F1)}²) − 1)`, `${fmt(y2)} ${L}`, 'From momentum conservation across the jump.');
    S(o, 'Specific energies', 'E = y + v²/(2g)', `E₁ = ${fmt(y1)} + ${fmt(v1)}²/(2·${fmt(g)});  E₂ = ${fmt(y2)} + ${fmt(v2)}²/(2·${fmt(g)})`, `E₁ = ${fmt(E1)}, E₂ = ${fmt(E2)} ${L}`, 'Energy before and after the jump.');
    S(o, 'Energy loss', 'ΔE = (y₂ − y₁)³ / (4y₁y₂)', `ΔE = (${fmt(y2)} − ${fmt(y1)})³/(4·${fmt(y1)}·${fmt(y2)})`, `${fmt(dE)} ${L}`, `Check: E₁ − E₂ = ${fmt(E1 - E2)} ${L}.`);
    S(o, 'Power lost', 'P = γ·Q·ΔE', `P = ${fmt(U.gw)} × ${fmt(Q)} × ${fmt(dE)}`, `${fmt(U.P1(Pw))} ${U.P1u}`, `Q = q·b = ${fmt(Q)} ${U.Q}.`);
    S(o, 'Momentum function check', 'M = q²/(gy) + y²/2', `M₁ = ${fmt(M1)},  M₂ = ${fmt(M2)}`, `M₁ = M₂ (${U.L}²)`, 'Momentum per unit width is conserved across the jump.');
    S(o, 'Height, length, efficiency', 'h_j = y₂ − y₁,  L ≈ 6.9(y₂ − y₁),  η = E₂/E₁', `h_j = ${fmt(y2 - y1)};  L ≈ 6.9 × ${fmt(y2 - y1)};  η = ${fmt(E2)}/${fmt(E1)}`, `L ≈ ${fmt(6.9 * (y2 - y1))} ${L}, η = ${fmt((100 * E2) / E1)}%`, `Jump type: ${jumpType(F1)}.`);
    R(o, 'Upstream depth y₁', y1, L); R(o, 'Upstream Froude F₁', F1, '', true); R(o, 'Sequent depth y₂', y2, L, true); R(o, 'E₁', E1, L); R(o, 'E₂', E2, L);
    R(o, 'Energy loss ΔE', dE, L, true); R(o, 'Power lost', U.P1(Pw), U.P1u); R(o, 'Height of jump', y2 - y1, L); R(o, 'Length (approx.)', 6.9 * (y2 - y1), L); R(o, 'Efficiency E₂/E₁', (100 * E2) / E1, '%'); R(o, 'Jump type', jumpType(F1), '');
    R(o, 'M₁ = M₂', M1, U.L + '²');
    Object.assign(o.data, { y1, y2, y0, F1, E1, E2, dE, v1, v2, M1, M2, Lj: 6.9 * (y2 - y1), a: I.a });
    return o;
  };

  /* =====================================================================
     MODULE 4 — ENERGY EQUATION: PUMPS, TURBINES, SIPHONS, NOZZLES
     ===================================================================== */
  HP.energy = function (I, U) {
    const o = Out(), g = U.g, L = U.L, mode = I.mode, gam = I.Sg * U.gw;
    const vh = (v) => (v * v) / (2 * g);
    const A1 = (PI * I.D1 * I.D1) / 4, A2 = (PI * I.D2 * I.D2) / 4;
    S(o, 'Unit weight', 'γ = Sg·γw', `γ = ${fmt(I.Sg)} × ${fmt(U.gw)}`, `${fmt(gam)} ${U.gam}`, 'Converts pressures to heads.');
    o.data = { mode, gam, g };

    if (mode === 'pump' || mode === 'turbine') {
      const Q = I.Q, v1 = Q / A1, v2 = Q / A2, fr = I.friction;
      const K1 = fr ? I.Kent + (I.f1 * I.L1) / I.D1 : 0, K2 = fr ? (I.f2 * I.L2) / I.D2 + I.Kexit : 0;
      const HL1 = K1 * vh(v1), HL2 = K2 * vh(v2), HL = HL1 + HL2;
      S(o, 'Velocities', 'v = Q/A', `v₁ = ${fmt(Q)}/${fmt(A1)};  v₂ = ${fmt(Q)}/${fmt(A2)}`, `v₁ = ${fmt(v1)}, v₂ = ${fmt(v2)} ${U.v}`, 'Suction (1) and discharge (2) pipes.');
      if (fr) {
        S(o, 'Losses in pipe 1', 'HL₁ = (K_ent + f₁L₁/D₁)·v₁²/(2g)', `HL₁ = (${fmt(I.Kent)} + ${fmt(I.f1)}·${fmt(I.L1)}/${fmt(I.D1)}) × ${fmt(vh(v1))}`, `${fmt(HL1)} ${L}`, 'Entrance plus Darcy friction.');
        S(o, 'Losses in pipe 2', 'HL₂ = (f₂L₂/D₂ + K_exit)·v₂²/(2g)', `HL₂ = (${fmt(I.f2)}·${fmt(I.L2)}/${fmt(I.D2)} + ${fmt(I.Kexit)}) × ${fmt(vh(v2))}`, `${fmt(HL2)} ${L}`, 'Darcy friction plus exit.');
      } else W(o, 'Pipe losses are switched off (HL = 0).', 'info');
      const p1h = I.p1 / gam, p2h = I.p2 / gam;
      let HA = 0, HE = 0;
      if (mode === 'pump') {
        HA = p2h - p1h + I.z2 - I.z1 + HL;
        S(o, 'Energy equation → head added by the pump', 'p₁/γ + v₁²/2g + z₁ + H_A − HL = p₂/γ + v₂²/2g + z₂', `H_A = (${fmt(p2h)} − ${fmt(p1h)}) + (${fmt(I.z2)} − ${P(I.z1)}) + ${fmt(HL)}`, `${fmt(HA)} ${L}`, 'Points 1 and 2 are reservoir surfaces (v ≈ 0).');
        if (HA <= 0) return fail(o, `H_A = ${fmt(HA)} ${L} ≤ 0: no pump is needed; the flow runs by gravity (use the turbine mode).`);
        const raw = (gam * Q * HA) / I.eta;
        S(o, 'Pump input power', 'P = γ·Q·H_A / η', `P = ${fmt(gam)} × ${fmt(Q)} × ${fmt(HA)} / ${fmt(I.eta)}`, `${fmt(U.P1(raw))} ${U.P1u} = ${fmt(U.P2(raw))} ${U.P2u}`, U.sys === 'SI' ? '1 hp = 0.746 kW.' : '1 hp = 550 ft·lb/s.');
        R(o, 'Head added H_A', HA, L, true); R(o, 'Input power', U.P1(raw), U.P1u, true); R(o, 'Input power', U.P2(raw), U.P2u); R(o, 'Water power γQH_A', U.P1(raw * I.eta), U.P1u);
        // suction side cavitation
        const pin = gam * (p1h + I.z1 - I.zp - vh(v1) - HL1);
        const pabs = I.patm + pin, npsh = (pabs - I.pvap) / gam + vh(v1);
        S(o, 'Pressure at the pump inlet', 'p_in/γ = p₁/γ + z₁ − z_p − v₁²/2g − HL₁', `p_in/γ = ${fmt(p1h)} + ${P(I.z1)} − ${P(I.zp)} − ${fmt(vh(v1))} − ${fmt(HL1)}`, `p_in = ${fmt(pin)} ${U.p} (abs ${fmt(pabs)} ${U.p})`, `NPSH available = ${fmt(npsh)} ${L}.`);
        R(o, 'Pump inlet pressure (gauge)', pin, U.p); R(o, 'NPSH available', npsh, L);
        if (pabs < I.pvap) W(o, `Cavitation at the pump inlet: absolute pressure ${fmt(pabs)} ${U.p} is below the vapor pressure ${fmt(I.pvap)} ${U.p}. Lower the pump or shorten the suction pipe.`, 'err');
      } else {
        HE = p1h - p2h + I.z1 - I.z2 - HL;
        S(o, 'Energy equation → head extracted by the turbine', 'p₁/γ + v₁²/2g + z₁ − H_E − HL = p₂/γ + v₂²/2g + z₂', `H_E = (${fmt(p1h)} − ${fmt(p2h)}) + (${P(I.z1)} − ${P(I.z2)}) − ${fmt(HL)}`, `${fmt(HE)} ${L}`, 'Head available to the turbine after losses.');
        if (HE <= 0) return fail(o, `H_E = ${fmt(HE)} ${L} ≤ 0: the upper level is not high enough to drive this flow through a turbine.`);
        const raw = gam * Q * HE * I.eta;
        S(o, 'Turbine output power', 'P = γ·Q·H_E·η', `P = ${fmt(gam)} × ${fmt(Q)} × ${fmt(HE)} × ${fmt(I.eta)}`, `${fmt(U.P1(raw))} ${U.P1u} = ${fmt(U.P2(raw))} ${U.P2u}`, 'Efficiency reduces the output.');
        R(o, 'Head extracted H_E', HE, L, true); R(o, 'Output power', U.P1(raw), U.P1u, true); R(o, 'Output power', U.P2(raw), U.P2u);
      }
      R(o, 'Total head loss HL', HL, L); R(o, 'v₁', v1, U.v); R(o, 'v₂', v2, U.v);
      Object.assign(o.data, { Q, v1, v2, HL1, HL2, HA, HE, p1h, p2h, K1, K2, Kent: fr ? I.Kent : 0, Kexit: fr ? I.Kexit : 0, z1: I.z1, z2: I.z2, zp: I.zp });
    } else if (mode === 'siphon') {
      const H = I.z1 - I.z2;
      if (H <= 0) return fail(o, 'The outlet reservoir must be lower than the supply reservoir (z₁ > z₂) for a siphon to flow.');
      const D = I.D1, A = A1, f = I.f1, Ksum = I.Kent + (f * (I.L1 + I.L2)) / D + I.Kexit;
      const v = sqrt((2 * g * H) / Ksum), Q = v * A;
      S(o, 'Energy equation 1 → 2', 'z₁ − z₂ = (K_ent + f(L₁+L₂)/D + K_exit)·v²/(2g)', `${fmt(H)} = (${fmt(I.Kent)} + ${fmt(f)}·${fmt(I.L1 + I.L2)}/${fmt(D)} + ${fmt(I.Kexit)})·v²/(2·${fmt(g)})`, `v = ${fmt(v)} ${U.v}`, 'All the available head is used by losses.');
      S(o, 'Discharge', 'Q = A·v', `Q = ${fmt(A)} × ${fmt(v)}`, `${fmt(Q)} ${U.Q}`, 'One diameter along the siphon.');
      const HL1s = (I.Kent + (f * I.L1) / D) * vh(v);
      const psh = I.z1 - I.zs - vh(v) - HL1s, ps = gam * psh, pabs = I.patm + ps;
      S(o, 'Pressure at the summit', 'p_s/γ = −(z_s − z₁) − v²/(2g) − HL₁₋ₛ', `p_s/γ = −(${fmt(I.zs)} − ${P(I.z1)}) − ${fmt(vh(v))} − ${fmt(HL1s)}`, `${fmt(psh)} ${L} → p_s = ${fmt(ps)} ${U.p}`, 'Energy equation from the supply surface to the summit.');
      S(o, 'Absolute pressure at the summit', 'p_abs = p_atm + p_s', `p_abs = ${fmt(I.patm)} + ${P(ps)}`, `${fmt(pabs)} ${U.p}`, `Must stay above the vapor pressure ${fmt(I.pvap)} ${U.p}.`);
      const zsMax = I.z1 + (I.patm - I.pvap) / gam - vh(v) - HL1s;
      S(o, 'Maximum summit elevation', 'z_s,max = z₁ + (p_atm − p_v)/γ − v²/(2g) − HL₁₋ₛ', `z_s,max = ${P(I.z1)} + (${fmt(I.patm)} − ${fmt(I.pvap)})/${fmt(gam)} − ${fmt(vh(v))} − ${fmt(HL1s)}`, `${fmt(zsMax)} ${L}`, 'Above this the liquid vaporizes at the summit.');
      if (pabs < I.pvap) {
        W(o, `Cavitation: the siphon will not run. Summit absolute pressure ${fmt(pabs)} ${U.p} is below the vapor pressure. Keep the summit below ${fmt(zsMax)} ${L}.`, 'err');
        o.results = []; R(o, 'Maximum summit elevation', zsMax, L, true); R(o, 'Summit absolute pressure (if it ran)', pabs, U.p);
      } else {
        R(o, 'Velocity v', v, U.v); R(o, 'Discharge Q', Q, U.Q, true); R(o, 'Summit pressure (gauge)', ps, U.p, true); R(o, 'Summit pressure head', psh, L); R(o, 'Summit absolute pressure', pabs, U.p); R(o, 'Maximum summit elevation', zsMax, L);
      }
      Object.assign(o.data, { Q, v1: v, v2: v, HL1: HL1s, HL2: (Ksum * vh(v)) - HL1s - I.Kexit * vh(v), Kent: I.Kent, Kexit: I.Kexit, z1: I.z1, z2: I.z2, zs: I.zs, p1h: 0, p2h: 0, psh, cav: pabs < I.pvap, zsMax });
    } else {
      // nozzle at the end of a pipe
      const H = I.z1 - I.z2 + I.p1 / gam;
      if (H <= 0) return fail(o, 'The nozzle must be below the energy level of the supply (z₁ + p₁/γ > z₂).');
      const D = I.D1, dn = I.dn, an = (PI * dn * dn) / 4, rA = pow(dn / D, 4), Kp = I.Kent + (I.f1 * I.L1) / D;
      const vj = sqrt((2 * g * H) / (1 / (I.Cvn * I.Cvn) + Kp * rA)), Q = vj * an, vp = Q / A1;
      S(o, 'Energy equation reservoir → jet', 'H = v_j²/(2g·Cv²) + (K_ent + fL/D)·v_p²/(2g),  v_p = v_j(d/D)²', `${fmt(H)} = v_j²[1/${fmt(I.Cvn)}² + ${fmt(Kp)}·(${fmt(dn)}/${fmt(D)})⁴]/(2·${fmt(g)})`, `v_j = ${fmt(vj)} ${U.v}`, 'Nozzle loss is expressed through Cv.');
      S(o, 'Discharge and pipe velocity', 'Q = a_n·v_j,  v_p = Q/A', `Q = ${fmt(an)} × ${fmt(vj)};  v_p = ${fmt(Q)}/${fmt(A1)}`, `Q = ${fmt(Q)} ${U.Q}, v_p = ${fmt(vp)} ${U.v}`, 'Continuity through pipe and nozzle.');
      const raw = (gam * Q * vj * vj) / (2 * g);
      S(o, 'Jet power', 'P = γQ·v_j²/(2g)', `P = ${fmt(gam)} × ${fmt(Q)} × ${fmt(vh(vj))}`, `${fmt(U.P1(raw))} ${U.P1u}`, 'Kinetic energy flux of the jet.');
      const hf = Kp * vh(vp), pbh = H + I.z2 - I.z2 - hf - vh(vp);
      S(o, 'Pressure at the nozzle base', 'p/γ = H − HL_pipe − v_p²/(2g)', `p/γ = ${fmt(H)} − ${fmt(hf)} − ${fmt(vh(vp))}`, `${fmt(pbh)} ${L} = ${fmt(pbh * gam)} ${U.p}`, 'Pressure just upstream of the nozzle.');
      const vpo = sqrt((2 * g * (H / 3)) / Kp), Qo = vpo * A1, vjo = I.Cvn * sqrt(2 * g * ((2 * H) / 3)), dno = sqrt((4 * Qo) / (PI * vjo)), rawMax = (gam * Qo * vjo * vjo) / (2 * g);
      S(o, 'Maximum jet power', 'P is maximum when pipe loss hf = H/3', `v_p = √(2g(H/3)/(K_ent + fL/D)) = ${fmt(vpo)};  Q = A·v_p`, `Q_opt = ${fmt(Qo)} ${U.Q}, d_opt = ${fmt(dno)} ${L}, P_max = ${fmt(U.P1(rawMax))} ${U.P1u}`, 'dP/dQ = 0 gives hf = H/3.');
      R(o, 'Jet velocity v_j', vj, U.v, true); R(o, 'Discharge Q', Q, U.Q, true); R(o, 'Jet power', U.P1(raw), U.P1u, true); R(o, 'Pipe velocity', vp, U.v); R(o, 'Pressure at nozzle base', pbh * gam, U.p);
      R(o, 'Q for max jet power', Qo, U.Q); R(o, 'Nozzle d for max power', dno, L); R(o, 'Max jet power', U.P1(rawMax), U.P1u);
      Object.assign(o.data, { Q, v1: vp, vj, HL1: hf, Kent: I.Kent, z1: I.z1, z2: I.z2, p1h: I.p1 / gam, Cvn: I.Cvn });
    }
    return o;
  };
  // Pressure at an arbitrary point given the EGL value there
  HP.pointPressure = function (egl, z, v, gam, g) {
    const ph = egl - z - (v * v) / (2 * g);
    return { ph, p: ph * gam, hv: (v * v) / (2 * g) };
  };

  /* =====================================================================
     MODULE 5 — WEIRS
     ===================================================================== */
  function weirQ(I, U) {
    const o = Out(), g = U.g, L = U.L, mode = I.mode, s2g = sqrt(2 * g);
    o.data = { mode };
    const H = mode === 'unsteady' ? I.H1 : I.H;
    const Crect = I.useCd ? (2 / 3) * I.Cd * s2g : U.weir;
    const CrectTxt = I.useCd ? `(2/3)Cd√(2g) = (2/3)(${fmt(I.Cd)})(${fmt(s2g)}) = ${fmt(Crect)}` : `${U.weir} (Francis, ${U.sys})`;
    let Q = 0, expo = 1.5;
    if (I.b < I.L && mode !== 'vnotch') W(o, 'The channel is narrower than the crest; the channel width is taken equal to L.');
    const b = Math.max(I.b, I.L);
    if (mode === 'rect') {
      const n = +I.n, Lp = I.L - 0.1 * n * H;
      if (Lp <= 0) return fail(o, 'The effective crest length L′ = L − 0.1nH is not positive. Increase L or reduce H.');
      S(o, 'Effective crest length', "L′ = L − 0.1·n·H", `L′ = ${fmt(I.L)} − 0.1 × ${n} × ${fmt(H)}`, `${fmt(Lp)} ${L}`, n ? 'End contractions narrow the effective nappe.' : 'Suppressed weir: no end contractions.');
      S(o, 'Weir coefficient', 'C = (2/3)Cd√(2g) or Francis constant', CrectTxt, fmt(Crect), 'Francis: 1.84 (SI), 3.33 (English).');
      Q = Crect * Lp * pow(H, 1.5);
      S(o, 'Discharge (no velocity of approach)', "Q = C·L′·H^(3/2)", `Q = ${fmt(Crect)} × ${fmt(Lp)} × ${fmt(H)}^(3/2)`, `${fmt(Q)} ${U.Q}`, 'Basic rectangular weir equation.');
      if (I.approach) {
        const rows = []; let Qi = Q;
        for (let i = 0; i < 50; i++) {
          const va = Qi / (b * (H + I.P)), hv = (va * va) / (2 * g);
          const Qn = Crect * Lp * (pow(H + hv, 1.5) - pow(hv, 1.5));
          rows.push([String(i + 1), fmt(Qi), fmt(va), fmt(hv), fmt(Qn)]);
          if (abs(Qn - Qi) / Qn < 1e-7) { Qi = Qn; break; }
          Qi = Qn;
        }
        S(o, 'Velocity of approach (iteration)', "v_a = Q/[b(H + P)],  h_v = v_a²/(2g),  Q = C·L′[(H + h_v)^(3/2) − h_v^(3/2)]", `b = ${fmt(b)}, P = ${fmt(I.P)} ${L}`, `${fmt(Qi)} ${U.Q}`, 'Repeat until Q stops changing.', { head: ['#', 'Q assumed', 'v_a', 'h_v', 'Q new'], rows });
        R(o, 'Q without approach velocity', Q, U.Q); Q = Qi;
      }
      R(o, "Effective length L′", Lp, L);
      o.data.Lp = Lp;
    } else if (mode === 'vnotch') {
      expo = 2.5;
      const th = (I.theta * PI) / 180, tn = Math.tan(th / 2);
      let C;
      if (I.useCd) { C = (8 / 15) * I.Cd * s2g * tn; S(o, 'V-notch coefficient', 'C = (8/15)Cd√(2g)·tan(θ/2)', `C = (8/15)(${fmt(I.Cd)})(${fmt(s2g)})(tan ${fmt(I.theta)}°/2 = ${fmt(tn)})`, fmt(C), 'From integrating strips across the V.'); }
      else { C = U.vn * tn; S(o, 'V-notch coefficient', `C = ${U.vn}·tan(θ/2)`, `C = ${U.vn} × ${fmt(tn)}`, fmt(C), `${U.vn} is the 90° notch constant (${U.sys}); tan 45° = 1.`); }
      Q = C * pow(H, 2.5);
      S(o, 'Discharge', 'Q = C·H^(5/2)', `Q = ${fmt(C)} × ${fmt(H)}^(5/2)`, `${fmt(Q)} ${U.Q}`, Math.abs(I.theta - 90) < 1e-9 && !I.useCd ? `90° notch: Q = ${U.vn}H^(5/2).` : 'Triangular weir.');
      o.data.tn = tn;
    } else if (mode === 'trap') {
      const z = I.zs, cip = abs(z - 0.25) < 1e-9 && !I.useCd;
      if (cip) {
        Q = U.cip * I.L * pow(H, 1.5);
        S(o, 'Cipolletti weir (side slope 1H:4V)', `Q = ${U.cip}·L·H^(3/2)`, `Q = ${U.cip} × ${fmt(I.L)} × ${fmt(H)}^(3/2)`, `${fmt(Q)} ${U.Q}`, 'The sloped sides make up for the end contractions.');
      } else {
        const Qr = Crect * I.L * pow(H, 1.5), Ct = (8 / 15) * I.Cd * s2g * z, Qt = Ct * pow(H, 2.5);
        S(o, 'Rectangular part', 'Q_r = C·L·H^(3/2)', `Q_r = ${fmt(Crect)} × ${fmt(I.L)} × ${fmt(H)}^(3/2)`, `${fmt(Qr)} ${U.Q}`, 'Central rectangle of the trapezoid.');
        S(o, 'Triangular part', 'Q_t = (8/15)Cd√(2g)·z·H^(5/2)', `Q_t = (8/15)(${fmt(I.Cd)})(${fmt(s2g)})(${fmt(z)})(${fmt(H)})^(5/2)`, `${fmt(Qt)} ${U.Q}`, 'The two sloped sides form a V-notch with tan(θ/2) = z.');
        Q = Qr + Qt;
        S(o, 'Total', 'Q = Q_r + Q_t', `Q = ${fmt(Qr)} + ${fmt(Qt)}`, `${fmt(Q)} ${U.Q}`, abs(z - 0.25) < 1e-9 ? `Cipolletti formula would give ${fmt(U.cip * I.L * pow(H, 1.5))} ${U.Q}.` : 'Trapezoidal weir.');
      }
    } else if (mode === 'broad') {
      Q = U.broad * I.L * pow(H, 1.5);
      const yc = (2 * H) / 3, vc = sqrt(g * yc);
      S(o, 'Critical depth on the crest', 'y_c = (2/3)H', `y_c = (2/3) × ${fmt(H)}`, `${fmt(yc)} ${L}`, 'Flow passes through critical depth on a broad crest.');
      S(o, 'Discharge', `Q = ${U.broad}·L·H^(3/2)`, `Q = ${U.broad} × ${fmt(I.L)} × ${fmt(H)}^(3/2)`, `${fmt(Q)} ${U.Q}`, `From Q = L·y_c·√(g·y_c) = 1.705LH^(3/2) (SI).`);
      R(o, 'Critical depth on crest', yc, L); R(o, 'Velocity on crest', vc, U.v);
      o.data.yc = yc;
    } else {
      // unsteady: lowering a reservoir over a rectangular weir
      const H1 = I.H1, H2 = I.H2, m = Crect, A = I.As;
      if (H2 >= H1) return fail(o, 'H₂ must be smaller than H₁ to lower the reservoir.');
      if (H2 <= 0) return fail(o, 'H₂ must be above the crest (H₂ > 0); reaching the crest takes infinite time.');
      S(o, 'Outflow over the weir', 'Q = m·L·H^(3/2)', `m = ${CrectTxt}`, `Q₁ = ${fmt(m * I.L * pow(H1, 1.5))} ${U.Q}`, 'Suppressed rectangular weir.');
      const t = ((2 * A) / (m * I.L)) * (1 / sqrt(H2) - 1 / sqrt(H1));
      S(o, 'Time to lower the reservoir', 't = (2A_s/(mL))(1/√H₂ − 1/√H₁)', `t = (2·${fmt(A)}/(${fmt(m)}·${fmt(I.L)}))(1/√${fmt(H2)} − 1/√${fmt(H1)})`, `${fmt(t)} s = ${fmt(t / 60)} min`, 'From −A_s dH = Q dt integrated.');
      R(o, 'Time H₁ → H₂', t, 's', true); R(o, 'Time H₁ → H₂', t / 60, 'min'); R(o, 'Time H₁ → H₂', t / 3600, 'h');
      R(o, 'Q at H₁', m * I.L * pow(H1, 1.5), U.Q); R(o, 'Q at H₂', m * I.L * pow(H2, 1.5), U.Q);
      const Ht = (tt) => pow(1 / sqrt(H1) + (m * I.L * Math.min(tt, t)) / (2 * A), -2);
      const ts = [], hs = [], qs = [];
      for (let i = 0; i <= 300; i++) { const tt = (t * i) / 300, h = Ht(tt); ts.push(tt); hs.push(h); qs.push(m * I.L * pow(h, 1.5)); }
      Object.assign(o.data, { tEnd: t, table: { ts, hs, qs }, hAt: Ht, m, Lw: I.L, Q: m * I.L * pow(H1, 1.5) });
      Q = m * I.L * pow(H1, 1.5);
    }
    // submergence
    const ht = I.ht;
    if (mode !== 'unsteady' && ht > 0) {
      if (ht >= H) return fail(o, `Tailwater (${fmt(ht)} ${L} above the crest) is at or above the upstream level: no flow over the weir.`);
      W(o, `The weir is submerged: tailwater is ${fmt(ht)} ${L} above the crest. The free-flow equation over-predicts Q.`);
      if (I.villemonte) {
        const Qs = Q * pow(1 - pow(ht / H, expo), 0.385);
        S(o, 'Submergence correction (Villemonte)', `Q_s = Q[1 − (H₂/H₁)^${expo === 1.5 ? '(3/2)' : '(5/2)'}]^0.385`, `Q_s = ${fmt(Q)}[1 − (${fmt(ht)}/${fmt(H)})^${expo}]^0.385`, `${fmt(Qs)} ${U.Q}`, 'H₂ is the tailwater head above the crest.');
        R(o, 'Free-flow Q', Q, U.Q); Q = Qs;
      }
    }
    if (mode !== 'unsteady') {
      R(o, 'Discharge Q', Q, U.Q, true);
      if (U.sys === 'SI') R(o, 'Discharge Q', Q * 1000, 'L/s');
      const va = Q / (b * (H + I.P));
      R(o, 'Approach velocity v_a', va, U.v);
    }
    Object.assign(o.data, { Q, H, P: I.P, Lw: I.L, b, ht, theta: I.theta, zs: I.zs, n: +I.n, g });
    return o;
  }

  /** Weirs: find Q from H (default), or H from a given Q by inverting the same equations. */
  HP.weir = function (I, U) {
    if (I.solveFor !== 'H' || I.mode === 'unsteady') return weirQ(I, U);
    const mode = I.mode, L = U.L, g = U.g, s2g = sqrt(2 * g), Qt = I.Qw;
    const bad = (t) => { const o = Out(); o.data = { mode }; return fail(o, t); };
    if (!(Qt > 0)) return bad('Enter a discharge Q greater than zero to solve for the head.');
    const qAt = (h) => { const r = weirQ(Object.assign({}, I, { H: h }), U); return r.invalid ? NaN : r.data.Q; };
    const ht = I.ht > 0 ? I.ht : 0, n = mode === 'rect' ? +I.n : 0;
    const Crect = I.useCd ? (2 / 3) * I.Cd * s2g : U.weir;
    const tn = Math.tan((I.theta * PI) / 360);
    const Cv = I.useCd ? (8 / 15) * I.Cd * s2g * tn : U.vn * tn;
    const cip = mode === 'trap' && abs(I.zs - 0.25) < 1e-9 && !I.useCd;
    // direct inversion where H appears once; otherwise a starting guess
    let H0, direct = null;
    if (mode === 'rect') { H0 = pow(Qt / (Crect * I.L), 2 / 3); if (n === 0 && !I.approach) direct = ['H = [Q / (C·L)]^(2/3)', `H = [${fmt(Qt)} / (${fmt(Crect)} × ${fmt(I.L)})]^(2/3)`]; }
    else if (mode === 'vnotch') { H0 = pow(Qt / Cv, 2 / 5); direct = ['H = (Q / C)^(2/5),  C = ' + (I.useCd ? '(8/15)Cd√(2g)·tan(θ/2)' : `${U.vn}·tan(θ/2)`), `H = (${fmt(Qt)} / ${fmt(Cv)})^(2/5)`]; }
    else if (mode === 'trap') { H0 = pow(Qt / ((cip ? U.cip : Crect) * I.L), 2 / 3); if (cip) direct = [`H = [Q / (${U.cip}·L)]^(2/3)`, `H = [${fmt(Qt)} / (${U.cip} × ${fmt(I.L)})]^(2/3)`]; }
    else { H0 = pow(Qt / (U.broad * I.L), 2 / 3); direct = [`H = [Q / (${U.broad}·L)]^(2/3)`, `H = [${fmt(Qt)} / (${U.broad} × ${fmt(I.L)})]^(2/3)`]; }
    if (ht > 0) direct = null; // submergence makes Q depend on H twice
    // bracket the root: Q(H) rises with H (up to H = 6L/n with end contractions)
    const lo0 = ht > 0 ? ht * (1 + 1e-9) + 1e-12 : 1e-9;
    const cap = n > 0 ? (6 * I.L) / n : 1e4;
    let lo = lo0, hi = Math.min(Math.max(H0, lo0) * 1.5 + 1e-6, cap);
    for (let k = 0; k < 80 && !(qAt(hi) >= Qt) && hi < cap; k++) { lo = hi; hi = Math.min(hi * 2, cap); }
    if (!(qAt(hi) >= Qt)) return bad(n > 0 ? `This weir cannot pass Q = ${fmt(Qt)} ${U.Q}: with ${n} end contraction${n > 1 ? 's' : ''} the most it carries is ${fmt(qAt(cap))} ${U.Q} (at H = 6L/n = ${fmt(cap)} ${L}). Lengthen the crest.` : `No head up to ${fmt(cap)} ${L} passes Q = ${fmt(Qt)} ${U.Q}.`);
    let H, rows = [];
    if (direct) H = mode === 'vnotch' ? pow(Qt / Cv, 2 / 5) : H0;
    else {
      // Newton steps on Q(H) = Q_target, kept inside the bracket (bisection if a step leaves it)
      let h = Math.min(Math.max(H0, lo), hi);
      for (let k = 0; k < 60; k++) {
        const q = qAt(h), dh = Math.max(1e-7, 1e-6 * h), dq = (qAt(h + dh) - qAt(Math.max(lo0, h - dh))) / (h + dh - Math.max(lo0, h - dh));
        rows.push([String(k + 1), fmt(h, 6), fmt(q, 6), fmt(q - Qt, 3)]);
        if (abs(q - Qt) <= 1e-10 * Qt) break;
        if (q < Qt) lo = h; else hi = h;
        let hn = dq > 0 ? h - (q - Qt) / dq : NaN;
        if (!(hn > lo && hn < hi)) hn = 0.5 * (lo + hi);
        if (abs(hn - h) <= 1e-12 * h) { h = hn; break; }
        h = hn;
      }
      H = h;
    }
    const o = weirQ(Object.assign({}, I, { H }), U);
    if (o.invalid) return o;
    const why = mode === 'rect' && n > 0 ? 'L′ = L − 0.1nH depends on H' : mode === 'rect' && I.approach ? 'the velocity of approach depends on H' : ht > 0 ? 'the Villemonte submergence factor depends on H' : 'the trapezoid has a rectangular and a triangular part';
    const st = direct
      ? { t: 'Solve for the head H (direct)', f: direct[0], s: direct[1], r: `${fmt(H)} ${L}`, n: 'The discharge equation rearranged for H.' }
      : { t: 'Solve for the head H (iteration)', f: 'find H such that Q(H) = Q', s: `Q = ${fmt(Qt)} ${U.Q}; start from H = ${fmt(H0)} ${L}; ${why}`, r: `${fmt(H)} ${L}`, n: 'Newton steps on Q(H) − Q = 0 (bisection kept as a fallback); the steps below check the result.', table: { head: ['#', 'H', 'Q(H)', 'Q(H) − Q'], rows: rows.slice(0, 12) } };
    o.steps.unshift(st);
    o.results.forEach((r) => { if (r.label === 'Discharge Q' && r.em) r.em = false; });
    o.results.unshift({ label: 'Head over the crest H', value: H, unit: L, em: true });
    if (ht > 0 && I.villemonte === false) W(o, 'Submerged weir solved without the Villemonte correction: H is under-estimated.', 'info');
    o.data.solveFor = 'H'; o.data.Qtarget = Qt;
    return o;
  };

  /* =====================================================================
     MODULE 6 — OPEN CHANNEL UNIFORM FLOW (MANNING)
     ===================================================================== */
  HP.manning = function (I, U) {
    const o = Out(), g = U.g, L = U.L, mode = I.mode;
    const shape = mode === 'circular' ? 'circ' : I.section;
    const G = { b: shape === 'tri' ? 0 : I.b, z: shape === 'rect' ? 0 : I.z, D: I.D };
    if (shape === 'tri' && !(I.z > 0)) return fail(o, 'A triangular channel needs a side slope z > 0.');
    const semi = shape === 'semi', r0 = I.D / 2;
    const k = U.man;
    const Qof = (y, n, S0, GG) => { const s = HP.section(shape, GG || G, y); return (k / n) * s.A * pow(s.R, 2 / 3) * sqrt(S0); };
    const manTxt = `Q = (${U.manT})·A·R^(2/3)·S^(1/2)`;
    o.data = { mode, shape, G };
    let y = I.y, n = I.n, S0 = I.S, Q;

    if (mode === 'efficient') {
      Q = I.Q;
      // optimum section for given Q, n, S
      let opt; const c = (n * Q) / (k * sqrt(S0));
      if (shape === 'rect') { const yo = pow(c / (2 * pow(0.5, 2 / 3)), 3 / 8); opt = { b: 2 * yo, z: 0, y: yo }; S(o, 'Best rectangle', 'b = 2y,  A = 2y²,  R = y/2', `${manTxt} → 2y²(y/2)^(2/3) = nQ/(${U.man === 1 ? '' : '1.486'}√S) = ${fmt(c)}`, `y = ${fmt(yo)} ${L}, b = ${fmt(2 * yo)} ${L}`, 'Half of a square: depth is half the width.'); }
      else if (shape === 'trap') { const yo = pow(c / (sqrt(3) * pow(0.5, 2 / 3)), 3 / 8); opt = { b: (2 / sqrt(3)) * yo, z: 1 / sqrt(3), y: yo }; S(o, 'Best trapezoid (half hexagon)', 'z = 1/√3 (60°),  b = (2/√3)y,  A = √3·y²,  R = y/2', `√3·y²(y/2)^(2/3) = ${fmt(c)}`, `y = ${fmt(yo)} ${L}, b = ${fmt(opt.b)} ${L}`, 'Sides at 60° to the horizontal.'); }
      else if (shape === 'tri') { const yo = pow(c / pow(1 / (2 * sqrt(2)), 2 / 3), 3 / 8); opt = { b: 0, z: 1, y: yo }; S(o, 'Best triangle (90° vertex)', 'z = 1,  A = y²,  R = y/(2√2)', `y²(y/2√2)^(2/3) = ${fmt(c)}`, `y = ${fmt(yo)} ${L}`, 'Each side at 45°.'); }
      else if (semi) {
        // semicircle flowing full: A = πr²/2, P = πr, R = r/2 (the best hydraulic section of all)
        const fac = (Math.PI / 2) * pow(0.5, 2 / 3), r = pow(c / fac, 3 / 8); opt = { D: 2 * r, y: r };
        S(o, 'Best section: semicircle flowing full', 'A = πr²/2,  P = πr,  R = r/2;  A·R^(2/3) = (π/2)(1/2)^(2/3)·r^(8/3)', `${fmt(fac)}·r^(8/3) = nQ/(${U.man === 1 ? '' : '1.486'}√S) = ${fmt(c)}`, `r = ${fmt(r)} ${L}, D = 2r = ${fmt(2 * r)} ${L}, y = r`, 'Of all sections with the same area, the half circle has the least wetted perimeter.');
      }
      else {
        // circle flowing at y = 0.938D carries max Q
        const sUnit = HP.section('circ', { D: 1 }, 0.938), fac = sUnit.A * pow(sUnit.R, 2 / 3);
        const D = pow(c / fac, 3 / 8); opt = { D, y: 0.938 * D };
        S(o, 'Best circular conduit', 'Q is maximum at y = 0.938D (v is maximum at y = 0.81D)', `A·R^(2/3) = ${fmt(fac)}·D^(8/3) = ${fmt(c)}`, `D = ${fmt(D)} ${L}, y = ${fmt(0.938 * D)} ${L}`, 'Smallest pipe that carries Q part-full.');
      }
      const Go = shape === 'circ' || semi ? { D: opt.D } : { b: opt.b, z: opt.z };
      const so = HP.section(shape, Go, opt.y);
      // current section carrying the same Q
      const ycur = shape === 'circ' ? NaN : bisect((yy) => Qof(yy, n, S0) - Q, 1e-6, semi ? r0 : 1e3);
      const scur = isFinite(ycur) ? HP.section(shape, G, ycur) : null;
      R(o, 'Optimum depth y', opt.y, L, true);
      if (semi) { R(o, 'Optimum radius r', opt.D / 2, L, true); R(o, 'Optimum diameter D', opt.D, L); }
      else if (shape === 'circ') R(o, 'Optimum diameter D', opt.D, L, true); else if (shape !== 'tri') R(o, 'Optimum bottom width b', opt.b, L, true);
      if (shape === 'trap' || shape === 'tri') R(o, 'Optimum side slope z', opt.z, 'H:V');
      R(o, 'Optimum area A', so.A, U.A); R(o, 'Optimum wetted perimeter P', so.P, L); R(o, 'Optimum R', so.R, L);
      if (scur) {
        S(o, 'Your section carrying the same Q', semi ? `normal depth in the entered semicircle (D = ${fmt(I.D)} ${L})` : 'normal depth of the entered b, z', `y_n = ${fmt(ycur)} ${L}`, `A = ${fmt(scur.A)} ${U.A}, P = ${fmt(scur.P)} ${L}, R = ${fmt(scur.R)} ${L}`, `The optimum uses ${fmt((100 * so.P) / scur.P)}% of the wetted perimeter.`);
        R(o, 'Entered section: y_n', ycur, L); R(o, 'Entered section: P', scur.P, L); R(o, 'Entered section: R', scur.R, L);
      } else if (semi) W(o, `The entered semicircle (D = ${fmt(I.D)} ${L}) cannot carry Q = ${fmt(Q)} ${U.Q} even when full.`, 'info');
      Object.assign(o.data, { Q, opt, Go, ycur, so, scur, v: Q / so.A, y: opt.y, morphTo: { G: Go, y: opt.y }, morphFrom: { G, y: ycur } });
      return o;
    }

    if (mode === 'solveY') {
      Q = I.Q;
      let hi = shape === 'circ' ? I.D * 0.938 : 1;
      if (shape === 'circ') {
        const Qmax = Qof(0.938 * I.D, n, S0);
        if (Q > Qmax) return fail(o, `Q = ${fmt(Q)} ${U.Q} exceeds the largest part-full capacity (${fmt(Qmax)} ${U.Q} at y = 0.938D). Use a bigger pipe.`);
      } else if (semi) {
        hi = r0;
        const Qfull = Qof(r0, n, S0);
        if (Q > Qfull) return fail(o, `Q = ${fmt(Q)} ${U.Q} exceeds the capacity of the semicircle flowing full (${fmt(Qfull)} ${U.Q} at y = r = ${fmt(r0)} ${L}). Use a larger D or a steeper slope.`);
      } else while (Qof(hi, n, S0) < Q && hi < 1e4) hi *= 2;
      const hist = [];
      y = bisect((yy) => Qof(yy, n, S0) - Q, 1e-6, hi, 1e-10, 200, hist);
      const rows = hist.filter((_, i) => i < 12 || i === hist.length - 1).map((r, i) => { const s = HP.section(shape, G, r[2]); return [i < 12 ? String(i + 1) : String(hist.length), fmt(r[2]), fmt(s.A), fmt(s.R), fmt(Qof(r[2], n, S0))]; });
      S(o, 'Normal depth by trial', `${manTxt} = ${fmt(Q)}`, 'bisection on y', `y_n = ${fmt(y)} ${L}`, 'Depth at which uniform flow carries Q.', { head: ['#', `y (${L})`, 'A', 'R', 'Q'], rows });
    } else if (mode === 'solveSn') {
      Q = I.Q; const s = HP.section(shape, G, y);
      if (I.solveFor === 'S') { S0 = pow((Q * n) / (k * s.A * pow(s.R, 2 / 3)), 2); S(o, 'Required slope', `S = [Q·n / (${k === 1 ? '' : '1.486·'}A·R^(2/3))]²`, `S = [${fmt(Q)}·${fmt(n)} / (${k === 1 ? '' : '1.486·'}${fmt(s.A)}·${fmt(s.R)}^(2/3))]²`, fmt(S0), 'Manning solved for S.'); }
      else { n = (k * s.A * pow(s.R, 2 / 3) * sqrt(S0)) / Q; S(o, 'Required roughness', `n = ${k === 1 ? '' : '1.486·'}A·R^(2/3)·S^(1/2) / Q`, `n = ${k === 1 ? '' : '1.486·'}${fmt(s.A)}·${fmt(s.R)}^(2/3)·${fmt(S0)}^(1/2) / ${fmt(Q)}`, fmt(n), 'Manning solved for n.'); }
    }
    const s = HP.section(shape, G, y);
    if (shape === 'circ' && y > I.D) return fail(o, 'Depth exceeds the pipe diameter.');
    if (semi && y > r0 + 1e-12) return fail(o, `Depth y = ${fmt(y)} ${L} exceeds the radius r = ${fmt(r0)} ${L}: a semicircular channel is full at y = r.`);
    S(o, 'Section properties', secText[shape], (semi ? `r = ${fmt(r0)} ${L}, ` : '') + `y = ${fmt(y)} ${L}` + (shape === 'circ' || semi ? `, θ = ${fmt(s.theta)} rad` : ''), `A = ${fmt(s.A)} ${U.A}, P = ${fmt(s.P)} ${L}, T = ${fmt(s.T)} ${L}`, 'Area, wetted perimeter and top width.');
    S(o, 'Hydraulic radius', 'R = A/P', `R = ${fmt(s.A)}/${fmt(s.P)}`, `${fmt(s.R)} ${L}`, 'Area per unit of wetted boundary.');
    const v = (k / n) * pow(s.R, 2 / 3) * sqrt(S0);
    Q = v * s.A;
    S(o, 'Velocity (Manning)', `v = (${U.manT})·R^(2/3)·S^(1/2)`, `v = (${k === 1 ? '1' : '1.486'}/${fmt(n)})(${fmt(s.R)})^(2/3)(${fmt(S0)})^(1/2)`, `${fmt(v)} ${U.v}`, U.sys === 'EN' ? 'English units use 1.486/n.' : 'SI units use 1/n.');
    S(o, 'Discharge', manTxt, `Q = ${fmt(s.A)} × ${fmt(v)}`, `${fmt(Q)} ${U.Q}`, 'Q = A·v.');
    const C = (k * pow(s.R, 1 / 6)) / n;
    S(o, 'Chezy coefficient', `C = (${U.manT})·R^(1/6),  v = C√(RS)`, `C = ${k === 1 ? '' : '1.486·'}${fmt(s.R)}^(1/6)/${fmt(n)}`, `${fmt(C)} ${U.sys === 'SI' ? 'm^½/s' : 'ft^½/s'}`, `Check: C√(RS) = ${fmt(C * sqrt(s.R * S0))} ${U.v}.`);
    const Fr = v / sqrt(g * s.Dh);
    const yc = HP.criticalDepth(shape, G, Q, g);
    const scc = HP.section(shape, G, yc), Sc = pow((Q * n) / (k * scc.A * pow(scc.R, 2 / 3)), 2);
    const cls = !isFinite(yc) ? 'steep slope (y_c above the rim)' : abs(y - yc) / yc < 0.01 ? 'critical slope' : y > yc ? 'mild slope (y_n > y_c)' : 'steep slope (y_n < y_c)';
    if (isFinite(yc)) S(o, 'Froude number and critical depth', 'F = v/√(gD_h);  Q²T/(gA³) = 1', `F = ${fmt(v)}/√(${fmt(g)}·${fmt(s.Dh)});  y_c by iteration`, `F = ${fmt(Fr)}, y_c = ${fmt(yc)} ${L}`, `Critical slope S_c = ${fmt(Sc)} → ${cls}.`);
    else S(o, 'Froude number and critical depth', 'F = v/√(gD_h);  Q²T/(gA³) = 1', `F = ${fmt(v)}/√(${fmt(g)}·${fmt(s.Dh)});  Q²T/(gA³) > 1 even at y = r`, `F = ${fmt(Fr)}, no y_c below the rim`, 'At this Q the flow would be supercritical at every depth up to the rim.');
    R(o, 'Area A', s.A, U.A); R(o, 'Wetted perimeter P', s.P, L); R(o, 'Hydraulic radius R', s.R, L, true); R(o, 'Top width T', s.T, L);
    if (mode === 'solveY') R(o, 'Normal depth y_n', y, L, true);
    if (mode === 'solveSn') { if (I.solveFor === 'S') R(o, 'Required slope S', S0, '', true); else R(o, 'Required Manning n', n, '', true); }
    R(o, 'Velocity v', v, U.v, true); R(o, 'Discharge Q', Q, U.Q, true); R(o, 'Chezy C', C, ''); R(o, 'Froude number F', Fr, ''); R(o, 'Critical depth y_c', isFinite(yc) ? yc : 'above the rim', isFinite(yc) ? L : ''); if (isFinite(yc)) R(o, 'Critical slope S_c', Sc, ''); R(o, 'Slope class', cls, '');
    if (Fr > 1) W(o, `Uniform flow here is supercritical (F = ${fmt(Fr)}).`, 'info');
    if (semi) {
      const sf = HP.section('semi', G, r0), Qf = (k / n) * sf.A * pow(sf.R, 2 / 3) * sqrt(S0);
      S(o, 'Semicircle flowing full (y = r)', 'A_f = πr²/2,  P_f = πr,  R_f = r/2', `Q_f = (${U.manT})(${fmt(sf.A)})(${fmt(sf.R)})^(2/3)(${fmt(S0)})^(1/2)`, `Q_f = ${fmt(Qf)} ${U.Q}`, `Depth ratio y/r = ${fmt(y / r0)}; Q/Q_f = ${fmt(Q / Qf)}.`);
      R(o, 'Radius r', r0, L); R(o, 'Q full (y = r)', Qf, U.Q); R(o, 'Q/Q_full', Q / Qf, '');
      Object.assign(o.data, { Qf });
    }
    if (mode === 'circular') {
      const sf = HP.section('circ', G, I.D), Qf = (k / n) * sf.A * pow(sf.R, 2 / 3) * sqrt(S0), vf = Qf / sf.A;
      S(o, 'Pipe flowing full', 'A_f = πD²/4,  R_f = D/4', `Q_f = (${U.manT})(${fmt(sf.A)})(${fmt(sf.R)})^(2/3)(${fmt(S0)})^(1/2)`, `Q_f = ${fmt(Qf)} ${U.Q}, v_f = ${fmt(vf)} ${U.v}`, `Q/Q_f = ${fmt(Q / Qf)}, v/v_f = ${fmt(v / vf)}.`);
      R(o, 'Q/Q_full', Q / Qf, '', true); R(o, 'v/v_full', v / vf, ''); R(o, 'Q full', Qf, U.Q);
      Object.assign(o.data, { Qf, vf });
    }
    Object.assign(o.data, { y, v, Q, Fr, yc, s, S: S0, n });
    return o;
  };

  /* =====================================================================
     MODULE 7 — WATER HAMMER
     Inputs in base units: SI → Pa, kg/m³, m;  English → psf, slug/ft³, ft
     ===================================================================== */
  HP.hammer = function (I, U) {
    const o = Out(), g = U.g, L = U.L;
    const rho = I.rho, Eb = I.Eb, E = I.E, D = I.D, t = I.t;
    const c0 = sqrt(Eb / rho);
    S(o, 'Celerity in a rigid pipe', 'c = √(E_b/ρ)', `c = √(${fmt(Eb)}/${fmt(rho)})`, `${fmt(c0)} ${U.v}`, 'Speed of sound in the liquid alone.');
    let c = c0;
    if (isFinite(E)) {
      c = c0 / sqrt(1 + (Eb * D) / (E * t));
      S(o, 'Celerity in an elastic pipe', 'c = √(E_b/ρ) / √(1 + E_b·D/(E·t))', `c = ${fmt(c0)} / √(1 + ${fmt(Eb)}·${fmt(D)}/(${fmt(E)}·${fmt(t)}))`, `${fmt(c)} ${U.v}`, 'Pipe wall stretch slows the wave.');
    }
    const Tc = (2 * I.L) / c, dv = I.v - I.vf;
    if (dv < 0) return fail(o, 'Final velocity must not exceed the initial velocity.');
    S(o, 'Critical time', 'T_c = 2L/c', `T_c = 2 × ${fmt(I.L)} / ${fmt(c)}`, `${fmt(Tc)} s`, 'Round trip of the wave from valve to reservoir and back.');
    const rapid = I.tc <= Tc;
    let dP;
    if (rapid) { dP = rho * c * dv; S(o, 'Rapid closure (t_c ≤ 2L/c)', 'ΔP = ρ·c·Δv', `ΔP = ${fmt(rho)} × ${fmt(c)} × ${fmt(dv)}`, `${fmt(dP / U.phDiv)} ${U.ph}`, 'Joukowsky: full pressure rise.'); }
    else { dP = (2 * rho * I.L * dv) / I.tc; S(o, 'Slow closure (t_c > 2L/c)', 'ΔP = 2ρLΔv / t_c', `ΔP = 2 × ${fmt(rho)} × ${fmt(I.L)} × ${fmt(dv)} / ${fmt(I.tc)}`, `${fmt(dP / U.phDiv)} ${U.ph}`, `= ρcΔv × (2L/c)/t_c; a reflected wave returns before closure ends.`); }
    const dH = dP / (rho * g);
    S(o, 'Head rise', 'ΔH = ΔP/(ρg)' + (rapid ? ' = c·Δv/g' : ''), rapid ? `ΔH = ${fmt(c)} × ${fmt(dv)} / ${fmt(g)}` : `ΔH = ${fmt(dP)}/(${fmt(rho)} × ${fmt(g)})`, `${fmt(dH)} ${L}`, 'Pressure rise as a column of liquid.');
    const p0 = I.p0, pmax = p0 + dP, sig = (pmax * D) / (2 * t);
    S(o, 'Maximum pressure', 'p_max = p_static + ΔP', `p_max = ${fmt(p0 / U.phDiv)} + ${fmt(dP / U.phDiv)}`, `${fmt(pmax / U.phDiv)} ${U.ph}`, 'Static pressure at the valve plus the surge.');
    S(o, 'Hoop stress', 'σ = p·D/(2t)', `σ = ${fmt(pmax / U.phDiv)} × ${fmt(D)} / (2 × ${fmt(t)})`, `${fmt(sig / U.sigDiv)} ${U.sig}`, 'Tensile stress in the pipe wall.');
    R(o, 'Wave celerity c', c, U.v, true); R(o, 'Critical time 2L/c', Tc, 's', true); R(o, 'Closure type', rapid ? 'rapid' : 'slow', '');
    R(o, 'Pressure rise ΔP', dP / U.phDiv, U.ph, true); if (U.sys === 'EN') R(o, 'Pressure rise ΔP', dP, 'psf'); R(o, 'Head rise ΔH', dH, L);
    R(o, 'Maximum pressure', pmax / U.phDiv, U.ph); R(o, 'Hoop stress σ', sig / U.sigDiv, U.sig, true);
    if (I.sall > 0) {
      if (sig > I.sall) W(o, `Hoop stress ${fmt(sig / U.sigDiv)} ${U.sig} exceeds the allowable ${fmt(I.sall / U.sigDiv)} ${U.sig}. Use a thicker wall or close the valve more slowly (t_c needed ≈ ${fmt((2 * rho * I.L * dv) / Math.max(1e-9, (2 * t * I.sall) / D - p0))} s).`, 'err');
      else W(o, `Hoop stress is within the allowable ${fmt(I.sall / U.sigDiv)} ${U.sig}.`, 'info');
    }
    if (!isFinite(E)) W(o, 'Rigid pipe assumed (E = ∞).', 'info');
    Object.assign(o.data, { c, Tc, dP, rapid, dv, rho, Lp: I.L, v0: I.v, vf: I.vf, tc: I.tc, p0, g });
    o.data.moc = HP.hammerMOC(o.data);
    return o;
  };
  /* Frictionless method of characteristics: reservoir upstream (constant p),
     valve downstream with velocity closing linearly from v₀ to v_f over t_c. */
  HP.hammerMOC = function (d) {
    const Lp = d.Lp, c = d.c, rc = d.rho * c;
    const Tw = (4 * Lp) / c;
    let Tsim = Math.max(d.tc, 0) + 3 * Tw;
    let N = Math.max(4, Math.min(40, Math.floor((16000 * Lp) / (c * Tsim))));
    let dt = Lp / (N * c), steps = Math.ceil(Tsim / dt);
    if (steps > 16000) { steps = 16000; Tsim = steps * dt; }
    const np = N + 1, P = new Float32Array((steps + 1) * np), V = new Float32Array((steps + 1) * np);
    for (let i = 0; i < np; i++) { P[i] = 0; V[i] = d.v0; }
    const vv = (t) => (d.tc <= 0 ? d.vf : d.v0 - (d.v0 - d.vf) * Math.min(1, t / d.tc));
    for (let k = 1; k <= steps; k++) {
      const a = (k - 1) * np, b = k * np, t = k * dt;
      for (let i = 1; i < N; i++) {
        const pA = P[a + i - 1], vA = V[a + i - 1], pB = P[a + i + 1], vB = V[a + i + 1];
        P[b + i] = 0.5 * (pA + pB + rc * (vA - vB));
        V[b + i] = 0.5 * (vA + vB + (pA - pB) / rc);
      }
      P[b] = 0; V[b] = V[a + 1] + (0 - P[a + 1]) / rc;      // reservoir (C− characteristic)
      const vp = vv(t); V[b + N] = vp; P[b + N] = P[a + N - 1] - rc * (vp - V[a + N - 1]); // valve (C+)
    }
    return { N, dt, steps, P, V, Tsim };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = HP;
  else root.HP = HP;
})(this);
