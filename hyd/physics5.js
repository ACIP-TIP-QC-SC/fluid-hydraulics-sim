/* =====================================================================
   physics5.js — 2026-11-25 book-coverage upgrade (Stage 4)
     HP.gvf       gradually varied flow by the step method
       profile   distance between two depths in N reaches, with the
                 profile type (M1 … A3) and the table of steps
       n         roughness from two depths a known distance apart
       Q         discharge from two depths a known distance apart
       res       channel fed by a reservoir with a control depth downstream
     HP.unsteady  unsteady flow and flood routing
       establish time for the flow to build up after a valve opens
       mass      mass oscillation: U-tubes, shafts and standpipes joined
                 by a pipe (frictionless, laminar or turbulent)
       surge     simple surge tank on a power tunnel (load rejection or
                 acceptance)
       pool      level-pool reservoir routing (modified Puls)
       musk      Muskingum channel routing
   Same conventions as physics.js: inputs in base units of the chosen system.
   ===================================================================== */
(function (root) {
  'use strict';
  const HP = root.HP;
  const PI = Math.PI, sqrt = Math.sqrt, abs = Math.abs, pow = Math.pow;
  const fmt = HP.fmt;
  function Out() { return { results: [], steps: [], warnings: [], data: {}, invalid: false }; }
  function R(o, label, value, unit, em) { o.results.push({ label, value, unit: unit || '', em: !!em }); }
  function S(o, t, f, s, r, n, table) { o.steps.push({ t, f, s, r, n, table }); }
  function W(o, text, lvl) { o.warnings.push({ lvl: lvl || 'warn', text }); }
  function fail(o, text) { W(o, text, 'err'); o.invalid = true; return o; }
  function bis(f, a, b, it) { let fa = f(a); for (let i = 0; i < (it || 200); i++) { const m = 0.5 * (a + b), fm = f(m); if ((fm > 0) === (fa > 0)) { a = m; fa = fm; } else b = m; } return 0.5 * (a + b); }

  /* ================================================================ */
  /* Gradually varied flow                                             */
  /* ================================================================ */
  function chan(I) {
    const b = I.shape === 'tri' ? 0 : I.b, z = I.shape === 'rect' ? 0 : I.z, wide = I.shape === 'wide';
    const A = (y) => (b + z * y) * y, P = (y) => (wide ? b : b + 2 * y * sqrt(1 + z * z)), T = (y) => b + 2 * z * y;
    return { b, z, wide, A, P, T, Rh: (y) => (wide ? y : A(y) / P(y)) };
  }
  HP.gvf = function (I, U) {
    const o = Out(), g = U.g, L = U.L, km = U.man, mode = I.mode, ch = chan(I);
    if (ch.b <= 0 && I.shape !== 'tri') return fail(o, 'The bottom width must be positive.');
    if (I.shape !== 'rect' && I.shape !== 'wide' && !(ch.z >= 0)) return fail(o, 'The side slope must not be negative.');
    const S0 = I.S0;
    const Ef = (y, Q) => y + pow(Q / ch.A(y), 2) / (2 * g);
    const Sf = (y, Q, n) => pow((n * (Q / ch.A(y))) / (km * pow(ch.Rh(y), 2 / 3)), 2);
    const Sbar = (y1, y2, Q, n) => {
      if (I.avg === 'S') return 0.5 * (Sf(y1, Q, n) + Sf(y2, Q, n));
      const Vm = 0.5 * (Q / ch.A(y1) + Q / ch.A(y2)), Rm = 0.5 * (ch.Rh(y1) + ch.Rh(y2));
      return pow((n * Vm) / (km * pow(Rm, 2 / 3)), 2);
    };
    const reach = (y1, y2, Q, n) => (Ef(y2, Q) - Ef(y1, Q)) / (S0 - Sbar(y1, y2, Q, n));
    const yc = (Q) => bis((y) => (Q * Q * ch.T(y)) / (g * pow(ch.A(y), 3)) - 1, 1e-6, 1e4);
    const yn = (Q, n) => (S0 > 0 ? bis((y) => (km / n) * ch.A(y) * pow(ch.Rh(y), 2 / 3) * sqrt(S0) - Q, 1e-6, 1e4) : Infinity);
    const avgTxt = I.avg === 'S' ? 'S̄ = (S₁ + S₂)/2,  S = (nV / (k R^{2/3}))²' : 'S̄ = (n V_m / (k R_m^{2/3}))²  with V_m, R_m the reach means';
    const kTxt = km === 1 ? '' : `k = ${km}`;
    const N = Math.max(1, Math.round(+I.nst || 1));
    function table(y1, y2, Q, n) {
      const rows = []; let x = 0, Ltot = 0;
      for (let k = 0; k < N; k++) {
        const ya = y1 + ((y2 - y1) * k) / N, yb = y1 + ((y2 - y1) * (k + 1)) / N, dL = reach(ya, yb, Q, n);
        if (!isFinite(dL)) return { bad: true };
        x += dL; Ltot += dL;
        rows.push({ ya, yb, Va: Q / ch.A(ya), Vb: Q / ch.A(yb), Sb: Sbar(ya, yb, Q, n), dE: Ef(yb, Q) - Ef(ya, Q), dL, x });
      }
      return { rows, L: Ltot };
    }
    function stepTable(o, tb, Q) {
      S(o, 'Step method', 'ΔL = (E₂ − E₁) / (S₀ − S̄),  E = y + V²/2g', avgTxt + (kTxt ? `;  ${kTxt}` : ''), `L = ${fmt(tb.L)} ${L}`, tb.L >= 0 ? 'Positive: section 2 lies downstream of section 1.' : 'Negative: section 2 lies upstream of section 1.',
        { head: [`y₁ (${L})`, `y₂ (${L})`, `V₁ (${U.v})`, `V₂ (${U.v})`, 'S̄', `ΔE (${L})`, `ΔL (${L})`, `x (${L})`], rows: tb.rows.map((r) => [fmt(r.ya, 4), fmt(r.yb, 4), fmt(r.Va, 4), fmt(r.Vb, 4), fmt(r.Sb, 4), fmt(r.dE, 4), fmt(r.dL, 4), fmt(r.x, 4)]) });
    }
    function classify(o, Q, n, yref) {
      const c = yc(Q), nn = yn(Q, n);
      let slope;
      if (S0 < 0) slope = 'A'; else if (S0 === 0) slope = 'H';
      else slope = abs(nn - c) / c < 0.005 ? 'C' : nn > c ? 'M' : 'S';
      let zone;
      const hi = Math.max(isFinite(nn) ? nn : 0, c), lo = Math.min(isFinite(nn) ? nn : Infinity, c);
      if (slope === 'H' || slope === 'A') zone = yref > c ? 2 : 3;
      else zone = yref > hi ? 1 : yref > lo ? 2 : 3;
      const type = slope + zone, names = { M: 'mild', S: 'steep', C: 'critical', H: 'horizontal', A: 'adverse' };
      S(o, 'Normal and critical depths', 'Q = (k/n) A R^{2/3} S₀^{1/2};  Q²T/(gA³) = 1', `Q = ${fmt(Q)} ${U.Q}`, `y_n = ${isFinite(nn) ? fmt(nn) + ' ' + L : 'none (S₀ ≤ 0)'},  y_c = ${fmt(c)} ${L}`, `${names[slope]} slope; depth ${fmt(yref)} ${L} lies in zone ${zone} → ${type} profile.`);
      return { yc: c, yn: nn, type, slope };
    }
    const n = I.n, Q0 = I.Q;
    if (mode === 'profile') {
      if (!(Q0 > 0 && n > 0)) return fail(o, 'Give a positive flow and roughness.');
      const cl = classify(o, Q0, n, I.y1);
      let y2 = I.y2;
      if (!(y2 > 0)) { y2 = isFinite(cl.yn) ? I.y1 + (cl.yn - I.y1) * 0.99 : cl.yc; S(o, 'End depth', isFinite(cl.yn) ? 'stop at 1 % short of the normal depth' : 'stop at the critical depth', '', `y₂ = ${fmt(y2)} ${L}`, 'The profile only approaches y_n asymptotically.'); }
      if (abs(y2 - I.y1) < 1e-9) return fail(o, 'The two depths must differ.');
      const tb = table(I.y1, y2, Q0, n); if (tb.bad) return fail(o, 'A reach passes through uniform flow (S̄ = S₀): pick depths on one side of y_n.');
      if ((I.y1 - cl.yc) * (y2 - cl.yc) < 0) W(o, 'The two depths are on opposite sides of the critical depth: a gradually varied profile cannot join them (a hydraulic jump or a drop lies between).');
      stepTable(o, tb, Q0);
      R(o, 'Distance from section 1 to section 2', tb.L, L, true); R(o, 'Section 2 lies', tb.L >= 0 ? 'downstream' : 'upstream', '');
      R(o, 'Profile type', cl.type, ''); R(o, 'Normal depth y_n', cl.yn, L); R(o, 'Critical depth y_c', cl.yc, L);
      R(o, 'Specific energy at 1', Ef(I.y1, Q0), L); R(o, 'Specific energy at 2', Ef(y2, Q0), L);
      Object.assign(o.data, { kind: 'gvf', Q: Q0, n, yc: cl.yc, yn: cl.yn, type: cl.type, rows: tb.rows, y1: I.y1, y2 });
      return o;
    }
    if (mode === 'n') {
      if (!(Q0 > 0 && I.Lr !== 0)) return fail(o, 'Give the flow and the distance between the sections.');
      const dE = Ef(I.y2, Q0) - Ef(I.y1, Q0), Sb = S0 - dE / I.Lr;
      S(o, 'Energy equation over the reach', 'S̄ = S₀ − (E₂ − E₁)/L', `S̄ = ${fmt(S0)} − (${fmt(Ef(I.y2, Q0))} − ${fmt(Ef(I.y1, Q0))}) / ${fmt(I.Lr)}`, `S̄ = ${fmt(Sb)}`, 'L is measured downstream from section 1.');
      if (!(Sb > 0)) return fail(o, 'The energy line would rise: these depths and distance cannot be right for any roughness.');
      let nn;
      if (I.avg === 'S') { const s1 = Sf(I.y1, Q0, 1), s2 = Sf(I.y2, Q0, 1); nn = sqrt((2 * Sb) / (s1 + s2)); }
      else { const Vm = 0.5 * (Q0 / ch.A(I.y1) + Q0 / ch.A(I.y2)), Rm = 0.5 * (ch.Rh(I.y1) + ch.Rh(I.y2)); nn = (km * pow(Rm, 2 / 3) * sqrt(Sb)) / Vm; S(o, 'Roughness', 'n = k R_m^{2/3} S̄^{1/2} / V_m', `n = ${km} × ${fmt(Rm)}^{2/3} × ${fmt(Sb)}^{1/2} / ${fmt(Vm)}`, `${fmt(nn)}`, ''); }
      R(o, 'Manning n', nn, '', true); R(o, 'Energy slope S̄', Sb, ''); R(o, 'Drop in energy line', Sb * I.Lr, L);
      const cl = classify(o, Q0, nn, I.y1);
      Object.assign(o.data, { kind: 'gvf', Q: Q0, n: nn, yc: cl.yc, yn: cl.yn, type: cl.type, rows: [{ ya: I.y1, yb: I.y2, dL: I.Lr, x: I.Lr }], y1: I.y1, y2: I.y2 });
      return o;
    }
    if (mode === 'Q') {
      if (!(n > 0 && I.Lr !== 0)) return fail(o, 'Give the roughness and the distance between the sections.');
      const f = (Q) => { const tb = table(I.y1, I.y2, Q, n); return tb.bad ? NaN : tb.L - I.Lr; };
      // fine log scan for a sign change that is a true root (not the pole where y_n passes the mean depth)
      let Q = NaN, qa = 1e-6, fa = f(qa);
      for (let i = 1; i <= 1200 && !isFinite(Q); i++) {
        const qb = 1e-6 * Math.pow(10, i / 100), fb = f(qb);
        if (isFinite(fa) && isFinite(fb) && fa * fb < 0) { const r = bis(f, qa, qb); if (abs(f(r)) < 1e-4 * Math.max(1, abs(I.Lr))) Q = r; }
        qa = qb; fa = fb;
      }
      if (!isFinite(Q)) return fail(o, 'No flow makes the step method give this distance; check the depths, slope and length.');
      const tb = table(I.y1, I.y2, Q, n);
      S(o, 'Discharge by trial', 'find Q so that ΣΔL = L', `L = ${fmt(I.Lr)} ${L}`, `Q = ${fmt(Q)} ${U.Q}`, 'Bisection on Q with the step method below.');
      stepTable(o, tb, Q);
      R(o, 'Discharge Q', Q, U.Q, true); R(o, 'V₁', Q / ch.A(I.y1), U.v); R(o, 'V₂', Q / ch.A(I.y2), U.v);
      const cl = classify(o, Q, n, I.y1); R(o, 'Profile type', cl.type, ''); R(o, 'Normal depth y_n', cl.yn, L); R(o, 'Critical depth y_c', cl.yc, L);
      Object.assign(o.data, { kind: 'gvf', Q, n, yc: cl.yc, yn: cl.yn, type: cl.type, rows: tb.rows, y1: I.y1, y2: I.y2 });
      return o;
    }
    // reservoir-fed channel: find the entrance depth (and Q) so the profile reaches the control depth at the end
    const H = I.Hr, ke = I.ke, Lc = I.Lr;
    if (!(H > I.y2 && Lc > 0 && n > 0)) return fail(o, 'The reservoir level must be above the control depth, and the length positive.');
    const QofY = (y) => ch.A(y) * sqrt((2 * g * (H - y)) / (1 + ke));
    const Lof = (y) => { const Q = QofY(y); const tb = table(y, I.y2, Q, n); return tb.bad || tb.rows.some((r) => !(r.dL > 0)) ? NaN : tb.L; }; // every reach must run downstream (no crossing of y_n)
    // entrance depth must be at least critical for that flow
    const yMin = bis((y) => y - yc(QofY(y)), 1e-6, H * 0.9999);
    let a = Math.max(yMin * 1.0001, Math.min(I.y2, H) * 0.5), b = H * 0.99999;
    const f = (y) => Lof(y) - Lc;
    let fa = f(a), fb = f(b);
    // scan for a sign change
    let found = false; const M = 60;
    for (let i = 0; i < M; i++) { const y0 = a + ((b - a) * i) / M, y1 = a + ((b - a) * (i + 1)) / M, f0 = f(y0), f1 = f(y1); if (isFinite(f0) && isFinite(f1) && f0 * f1 <= 0) { a = y0; b = y1; fa = f0; fb = f1; found = true; break; } }
    if (!found) return fail(o, 'No entrance depth gives this channel length; the control depth may drown the channel or force critical flow at the entrance.');
    const y1 = bis(f, a, b), Q = QofY(y1), tb = table(y1, I.y2, Q, n);
    S(o, 'Reservoir to section 1', 'H = y₁ + (1 + k_e) V₁²/2g  →  Q = A₁ √(2g(H − y₁)/(1 + k_e))', `H = ${fmt(H)},  k_e = ${fmt(ke)}`, `y₁ = ${fmt(y1)} ${L},  V₁ = ${fmt(Q / ch.A(y1))} ${U.v},  Q = ${fmt(Q)} ${U.Q}`, 'y₁ found by trial so that the step method gives the channel length.');
    stepTable(o, tb, Q);
    R(o, 'Discharge Q', Q, U.Q, true); if (I.shape !== 'tri') R(o, 'Flow per unit width q', Q / Math.max(ch.b, 1e-9), U.q); R(o, 'Depth at the entrance y₁', y1, L, true); R(o, 'V₁', Q / ch.A(y1), U.v);
    const cl = classify(o, Q, n, y1); R(o, 'Profile type', cl.type, '');
    Object.assign(o.data, { kind: 'gvf', Q, n, yc: cl.yc, yn: cl.yn, type: cl.type, rows: tb.rows, y1, y2: I.y2, H });
    return o;
  };

  /* ================================================================ */
  /* Unsteady flow and flood routing                                   */
  /* ================================================================ */
  HP.unsteady = function (I, U) {
    const o = Out(), g = U.g, L = U.L, mode = I.mode;
    o.data.mode = mode;
    if (mode === 'establish') {
      const A = (PI * I.Dp * I.Dp) / 4, Le = I.Lp + (I.Km * I.Dp) / I.fp;
      const kOut = I.outlet === 'nozzle' ? pow(I.Dp / I.dn, 4) : 0, kTot = (I.fp * Le) / I.Dp + kOut;
      if (!(I.H > 0 && kTot > 0)) return fail(o, 'Give a positive head and losses.');
      const V0 = sqrt((2 * g * I.H) / kTot);
      S(o, 'Equivalent length of the minor losses', 'L_e = L + ΣK D/f', `L_e = ${fmt(I.Lp)} + ${fmt(I.Km)} × ${fmt(I.Dp)} / ${fmt(I.fp)}`, `${fmt(Le)} ${L}`, '');
      S(o, 'Final (steady) velocity', I.outlet === 'nozzle' ? 'H = (f L_e/D) V₀²/2g + V_j²/2g,  V_j = V₀ (D/d)²' : 'H = (f L_e/D) V₀²/2g', `V₀ = √(2 × ${fmt(g)} × ${fmt(I.H)} / ${fmt(kTot)})`, `${fmt(V0)} ${U.v},  Q₀ = ${fmt(V0 * A)} ${U.Q}`, '');
      const p = I.frac, t = ((I.Lp * V0) / (2 * g * I.H)) * Math.log((1 + p) / (1 - p));
      S(o, `Time to reach ${fmt(p * 100)} % of V₀`, 't = (L V₀ / 2gH) ln[(V₀ + V)/(V₀ − V)]', `t = (${fmt(I.Lp)} × ${fmt(V0)} / (2 × ${fmt(g)} × ${fmt(I.H)})) × ln(${fmt(1 + p)}/${fmt(1 - p)})`, `${fmt(t)} s`, 'From (L/g) dV/dt = H − K V²/2g with the valve opened at once; L is the actual pipe length.',
        { head: ['V / V₀', 't (s)'], rows: [0.25, 0.5, 0.75, 0.9, 0.95, 0.99].map((q) => [fmt(q), fmt(((I.Lp * V0) / (2 * g * I.H)) * Math.log((1 + q) / (1 - q)))]) });
      R(o, `Time to ${fmt(p * 100)} % of the final velocity`, t, 's', true); R(o, 'Final velocity V₀', V0, U.v, true); R(o, 'Final discharge Q₀', V0 * A, U.Q); R(o, 'Equivalent length L_e', Le, L);
      const ts = [], vs = []; const tEnd = ((I.Lp * V0) / (2 * g * I.H)) * Math.log(1.99 / 0.01);
      for (let i = 0; i <= 80; i++) { const tt = (tEnd * i) / 80, th = Math.tanh((g * I.H * tt) / (I.Lp * V0)); ts.push(tt); vs.push(V0 * th); }
      Object.assign(o.data, { kind: 'establish', V0, t, p, ts, vs });
      return o;
    }
    if (mode === 'mass') {
      // pipe (or tube) of length L joining two free surfaces of areas A1, A2
      const A = (PI * I.Dp * I.Dp) / 4, utube = I.mkind === 'utube';
      const A1 = utube ? A : I.mBy === 'D' ? (PI * I.D1s * I.D1s) / 4 : I.A1s, A2 = utube ? A : I.mBy === 'D' ? (PI * I.D2s * I.D2s) / 4 : I.A2s;
      if (!(A1 > 0 && A2 > 0 && I.Lp > 0 && I.Dp > 0)) return fail(o, 'Give the pipe and the surface areas.');
      const Le = I.Lp + (I.fr === 'turb' ? (I.Km * I.Dp) / I.fp : 0);
      const z10 = I.init === 'dh' ? (I.dh * A2) / (A1 + A2) : I.z0;
      const nuB = I.nu;
      const acc = (V, z1, z2) => {
        let fr = 0;
        if (I.fr === 'turb') fr = ((I.fp * Le) / I.Dp) * (V * abs(V)) / (2 * g);
        else if (I.fr === 'lam') fr = (32 * nuB * I.Lp * V) / (g * I.Dp * I.Dp);
        return (g / I.Lp) * (z1 - z2 - fr);
      };
      const w0 = sqrt((g * A * (1 / A1 + 1 / A2)) / I.Lp), T0 = (2 * PI) / w0;
      S(o, 'Natural period (no friction)', utube ? 'T = 2π √(L / 2g)' : 'T = 2π √(L / [g A (1/A₁ + 1/A₂)])', `L = ${fmt(I.Lp)} ${L}`, `T = ${fmt(T0)} s`, utube ? 'L is the total length of the liquid column.' : '');
      S(o, 'Start', 'z measured from the final (equilibrium) level', I.init === 'dh' ? `Δh = ${fmt(I.dh)} → z₁ = Δh A₂/(A₁ + A₂)` : '', `z₁(0) = ${fmt(z10)} ${L},  V(0) = ${fmt(I.V0)} ${U.v}`, '');
      let z1 = z10, z2 = utube ? -z10 : (-z10 * A1) / A2, V = I.V0, t = 0;
      const dt = T0 / 2000, tMax = I.tmax > 0 ? I.tmax : 3 * T0;
      const ts = [0], z1s = [z1], z2s = [z2], vs = [V], ext = [];
      let prevDz = -V * A / A1, vmax = abs(V), Re = 0; const lvl = [];
      const f = (s) => [acc(s[0], s[1], s[2]), (-s[0] * A) / A1, (s[0] * A) / A2];
      let st = [V, z1, z2], k = 0;
      while (t < tMax - 1e-12 && k < 400000) {
        const h = Math.min(dt, tMax - t);
        const k1 = f(st), k2 = f(st.map((v, i) => v + (h / 2) * k1[i])), k3 = f(st.map((v, i) => v + (h / 2) * k2[i])), k4 = f(st.map((v, i) => v + h * k3[i]));
        const nx = st.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
        const dz = -nx[0] * A / A1;
        if (k > 0 && prevDz * dz < 0) ext.push([t + h, nx[1]]);
        if (k > 0 && st[1] * nx[1] < 0) { const fr = st[1] / (st[1] - nx[1]); lvl.push([t + fr * h, st[0] + fr * (nx[0] - st[0])]); }
        prevDz = dz; st = nx; t += h; k++;
        vmax = Math.max(vmax, abs(st[0]));
        if (k % 20 === 0) { ts.push(t); vs.push(st[0]); z1s.push(st[1]); z2s.push(st[2]); }
      }
      if (I.fr === 'lam' && nuB > 0) Re = (vmax * I.Dp) / nuB;
      S(o, 'Equation of motion', I.fr === 'turb' ? '(L/g) dV/dt = z₁ − z₂ − (f L_e/D) V|V|/2g' : I.fr === 'lam' ? '(L/g) dV/dt = z₁ − z₂ − 32νLV/(gD²)' : '(L/g) dV/dt = z₁ − z₂', 'dz₁/dt = −V A/A₁,  dz₂/dt = V A/A₂', `integrated to t = ${fmt(tMax)} s (Runge-Kutta, Δt = ${fmt(dt)} s)`, I.fr === 'turb' ? `L_e = ${fmt(Le)} ${L} includes ΣK D/f.` : '',
        { head: ['Extreme', 't (s)', `z₁ (${L})`], rows: ext.slice(0, 8).map((e, i) => [i + 1, fmt(e[0]), fmt(e[1])]) });
      ext.slice(0, 4).forEach((e, i) => R(o, `Extreme ${i + 1} of surface 1 (t = ${fmt(e[0], 4)} s)`, e[1], L, i < 2));
      R(o, 'Period without friction', T0, 's'); R(o, 'Largest velocity in the pipe', vmax, U.v, true);
      if (lvl.length) { R(o, 'Next time the surfaces are level', lvl[0][0], 's'); R(o, 'Velocity then', abs(lvl[0][1]), U.v); }
      if (I.init === 'dh' && ext.length) R(o, 'Largest fluctuation of surface 1 from its start', Math.max(...ext.map((e) => abs(e[1] - z10))), L, true);
      if (Re > 0) { R(o, 'Largest Reynolds number', Re, ''); if (Re > 2000) W(o, `The Reynolds number reaches ${fmt(Re)}: the flow is not laminar throughout.`); }
      Object.assign(o.data, { kind: 'mass', ts, z1s, z2s, vs, ext, T0, utube, A1, A2, A });
      return o;
    }
    if (mode === 'surge') {
      const A = (PI * I.Dp * I.Dp) / 4, As = I.sBy === 'D' ? (PI * I.Ds * I.Ds) / 4 : I.As, Qm = I.Qm;
      if (!(As > 0 && A > 0 && Qm > 0)) return fail(o, 'Give the tunnel, tank and flow.');
      const Le = I.Lp + (I.Km * I.Dp) / I.fp, Rk = (I.fp * Le) / (2 * g * I.Dp * A * A), Z = I.Zr;
      const rej = I.event === 'reject', Tc = Math.max(I.Tc, 1e-9);
      const Qt = (t) => (rej ? (t < Tc ? Qm * (1 - t / Tc) : 0) : t < Tc ? (Qm * t) / Tc : Qm);
      const V0 = Qm / A, zStar = V0 * sqrt((I.Lp * A) / (g * As)), T0 = 2 * PI * sqrt((I.Lp * As) / (g * A)), hf0 = Rk * Qm * Qm;
      S(o, 'Tunnel loss and frictionless surge', 'h_f = f (L_e/D) V²/2g,  z* = V₀ √(L A / (g A_s)),  T = 2π √(L A_s / (g A))', `V₀ = ${fmt(V0)} ${U.v},  L_e = ${fmt(Le)} ${L}`, `h_f = ${fmt(hf0)} ${L},  z* = ${fmt(zStar)} ${L},  T = ${fmt(T0)} s`, 'z* is the largest swing for an instant change with no friction.');
      let Q = rej ? Qm : 0, Y = rej ? Z - hf0 : Z, t = 0; const dt = Math.min(1, T0 / 400), tMax = I.tmax > 0 ? I.tmax : 1.5 * T0;
      const f = (tt, s) => [((g * A) / I.Lp) * (Z - s[1] - Rk * s[0] * abs(s[0])), (s[0] - Qt(tt)) / As];
      let st = [Q, Y], ymax = Y, ymin = Y, tmaxY = 0, tminY = 0; const ts = [0], ys = [Y], qs = [Q], qts = [Qt(0)];
      let k = 0;
      while (t < tMax - 1e-12) {
        const h = Math.min(dt, tMax - t);
        const k1 = f(t, st), k2 = f(t + h / 2, st.map((v, i) => v + (h / 2) * k1[i])), k3 = f(t + h / 2, st.map((v, i) => v + (h / 2) * k2[i])), k4 = f(t + h, st.map((v, i) => v + h * k3[i]));
        st = st.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])); t += h; k++;
        if (st[1] > ymax) { ymax = st[1]; tmaxY = t; } if (st[1] < ymin) { ymin = st[1]; tminY = t; }
        if (k % Math.max(1, Math.round(tMax / dt / 300)) === 0) { ts.push(t); ys.push(st[1]); qs.push(st[0]); qts.push(Qt(t)); }
      }
      S(o, 'Surge tank equations', 'dQ/dt = (gA/L)(Z − Y − R Q|Q|),  dY/dt = (Q − Q_t)/A_s,  R = f L_e/(2gDA²)', `${rej ? 'Load rejection' : 'Load acceptance'}: turbine flow ${rej ? `${fmt(Qm)} → 0` : `0 → ${fmt(Qm)}`} ${U.Q} in ${fmt(I.Tc)} s`, `Y_max = ${fmt(ymax)} ${L} at ${fmt(tmaxY)} s,  Y_min = ${fmt(ymin)} ${L} at ${fmt(tminY)} s`, 'Runge-Kutta integration; Y is the tank water level, Z the reservoir level.');
      R(o, 'Highest tank level Y_max', ymax, L, true); R(o, 'Time of Y_max', tmaxY, 's'); R(o, 'Lowest tank level Y_min', ymin, L, true); R(o, 'Time of Y_min', tminY, 's');
      R(o, 'Upsurge above the reservoir', ymax - Z, L); R(o, 'Frictionless surge z*', zStar, L); R(o, 'Period of oscillation', T0, 's'); R(o, 'Tunnel head loss at full flow', hf0, L);
      if (I.tankTop > 0 && ymax > I.tankTop) W(o, `The tank overflows: the water rises to ${fmt(ymax)} ${L}, above the top at ${fmt(I.tankTop)} ${L}.`, 'err');
      if (I.tankBot > 0 && ymin < I.tankBot) W(o, `The tank empties: the water falls to ${fmt(ymin)} ${L}, below the bottom at ${fmt(I.tankBot)} ${L}; air can enter the penstock.`, 'err');
      Object.assign(o.data, { kind: 'surge', ts, ys, qs, qts, Z, ymax, ymin, tmaxY, tminY });
      return o;
    }
    // ---------------- routing: inflow hydrograph
    const nI = Math.max(2, Math.min(20, Math.round(+I.nI || 10))), Is = []; for (let i = 1; i <= nI; i++) Is.push(I['in' + i]);
    const dt = I.dtr;
    if (!(dt > 0)) return fail(o, 'The routing period must be positive.');
    const hr = dt / 3600;
    if (mode === 'musk') {
      const K = I.Kh * 3600, x = I.xm, den = K - K * x + 0.5 * dt;
      const c0 = -(K * x - 0.5 * dt) / den, c1 = (K * x + 0.5 * dt) / den, c2 = (K - K * x - 0.5 * dt) / den;
      S(o, 'Muskingum coefficients', 'c₀ = −(Kx − Δt/2)/D,  c₁ = (Kx + Δt/2)/D,  c₂ = (K − Kx − Δt/2)/D,  D = K − Kx + Δt/2', `K = ${fmt(I.Kh)} h,  x = ${fmt(x)},  Δt = ${fmt(hr)} h`, `c₀ = ${fmt(c0)},  c₁ = ${fmt(c1)},  c₂ = ${fmt(c2)}  (sum ${fmt(c0 + c1 + c2)})`, '');
      if (c0 < 0 || c2 < 0) W(o, 'A routing coefficient is negative: choose Δt between 2Kx and 2K(1 − x) to keep the routing stable.');
      const Os = [I.O1];
      for (let i = 1; i < nI; i++) Os.push(c0 * Is[i] + c1 * Is[i - 1] + c2 * Os[i - 1]);
      const pk = Os.reduce((m, v, i) => (v > m[0] ? [v, i] : m), [-Infinity, 0]), pkI = Is.reduce((m, v, i) => (v > m[0] ? [v, i] : m), [-Infinity, 0]);
      S(o, 'Routing', 'O₂ = c₀ I₂ + c₁ I₁ + c₂ O₁', `O(0) = ${fmt(I.O1)} ${U.Q}`, `peak outflow ${fmt(pk[0])} ${U.Q} at t = ${fmt(pk[1] * hr)} h`, '', { head: ['t (h)', `I (${U.Q})`, `c₀I₂`, `c₁I₁`, `c₂O₁`, `O (${U.Q})`], rows: Is.map((v, i) => [fmt(i * hr), fmt(v), i ? fmt(c0 * v) : '', i ? fmt(c1 * Is[i - 1]) : '', i ? fmt(c2 * Os[i - 1]) : '', fmt(Os[i])]) });
      R(o, 'Peak outflow', pk[0], U.Q, true); R(o, 'Time of peak outflow', pk[1] * hr, 'h', true); R(o, 'Peak inflow', pkI[0], U.Q); R(o, 'Delay of the peak', (pk[1] - pkI[1]) * hr, 'h');
      R(o, 'c₀', c0, ''); R(o, 'c₁', c1, ''); R(o, 'c₂', c2, '');
      Object.assign(o.data, { kind: 'route', Is, Os, hr });
      return o;
    }
    // level-pool routing
    let rel; // [{e, S, O}] rising
    if (I.res === 'weir') {
      const A = I.Ares, CL = I.Cw * I.Lw, maxI = Math.max(...Is), yTop = pow((3 * maxI) / CL, 2 / 3) + 1;
      rel = []; for (let i = 0; i <= 400; i++) { const y = (yTop * i) / 400; rel.push({ e: y, S: A * y, O: CL * pow(y, 1.5) }); }
      S(o, 'Reservoir with vertical banks and a spillway', 'S = A y,  O = C L y^{3/2}  (y above the crest)', `A = ${fmt(A)} ${U.A},  C L = ${fmt(CL)}`, '', 'Storage counted from the crest.');
    } else {
      const nt = Math.max(2, Math.min(10, Math.round(+I.nT || 6)));
      rel = []; for (let i = 1; i <= nt; i++) rel.push({ e: I['te' + i], S: I['ts' + i], O: I['to' + i] });
      for (let i = 1; i < nt; i++) if (!(rel[i].e > rel[i - 1].e) || rel[i].S < rel[i - 1].S || rel[i].O < rel[i - 1].O) return fail(o, 'List the table with rising elevation, storage and discharge.');
    }
    rel.forEach((r) => (r.W = (2 * r.S) / dt + r.O));
    const interp = (key, val, out) => { if (val <= rel[0][key]) return rel[0][out] + ((val - rel[0][key]) * (rel[1][out] - rel[0][out])) / (rel[1][key] - rel[0][key] || 1); for (let i = 1; i < rel.length; i++) if (val <= rel[i][key]) { const a = rel[i - 1], b = rel[i], t = (val - a[key]) / (b[key] - a[key] || 1); return a[out] + t * (b[out] - a[out]); } const a = rel[rel.length - 2], b = rel[rel.length - 1], t = (val - a[key]) / (b[key] - a[key] || 1); return a[out] + t * (b[out] - a[out]); };
    const e0 = I.res === 'weir' ? I.y0 : I.e0;
    let Wc = interp('e', e0, 'W'), Oc = interp('e', e0, 'O');
    const Os = [Oc], Es = [e0], rows = [];
    rows.push([fmt(0), fmt(Is[0]), fmt(Wc - 2 * Oc), fmt(Wc), fmt(Oc), fmt(e0)]);
    for (let i = 1; i < nI; i++) {
      const W2 = Is[i - 1] + Is[i] + (Wc - 2 * Oc), O2 = interp('W', W2, 'O'), e2 = interp('W', W2, 'e');
      Wc = W2; Oc = O2; Os.push(O2); Es.push(e2);
      rows.push([fmt(i * hr), fmt(Is[i]), fmt(W2 - 2 * O2), fmt(W2), fmt(O2), fmt(e2)]);
    }
    if (Wc > rel[rel.length - 1].W) W(o, 'The pool rises above the top of the storage table: the results were extrapolated.');
    const pk = Os.reduce((m, v, i) => (v > m[0] ? [v, i] : m), [-Infinity, 0]), emax = Math.max(...Es), pkI = Is.reduce((m, v, i) => (v > m[0] ? [v, i] : m), [-Infinity, 0]);
    S(o, 'Modified Puls (storage-indication) routing', 'I₁ + I₂ + (2S₁/Δt − O₁) = 2S₂/Δt + O₂', `Δt = ${fmt(hr)} h;  start at ${fmt(e0)} ${L}`, `peak outflow ${fmt(pk[0])} ${U.Q},  highest pool ${fmt(emax)} ${L}`, 'O₂ and the pool level are read from the 2S/Δt + O relation by straight-line interpolation.', { head: ['t (h)', `I (${U.Q})`, '2S/Δt − O', '2S/Δt + O', `O (${U.Q})`, `pool (${L})`], rows });
    R(o, 'Peak outflow', pk[0], U.Q, true); R(o, 'Highest pool level', emax, L, true); R(o, 'Time of peak outflow', pk[1] * hr, 'h'); R(o, 'Peak inflow', pkI[0], U.Q); R(o, 'Peak reduced by', (1 - pk[0] / pkI[0]) * 100, '%');
    Object.assign(o.data, { kind: 'route', Is, Os, Es, hr, pool: true });
    return o;
  };
})(window);
