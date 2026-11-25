/* =====================================================================
 * Geotechnical — STEP 5: Shear Strength (physics)
 * Mohr–Coulomb with Mohr circles: a general stress state, direct shear
 * tests, triaxial tests (CD, CU with pore pressure, UU) and the
 * unconfined compression test; failure plane angle and stresses on it.
 * ===================================================================== */
(function (root) {
  'use strict';
  const P = root.Physics;
  const { fmt: f, Steps, fail, DEG } = P;

  /** Least-squares line y = a + b x; through the origin when `origin` is true. */
  function fitLine(pts, origin) {
    const n = pts.length;
    if (origin || n < 2) { const sxy = pts.reduce((s, p) => s + p[0] * p[1], 0), sxx = pts.reduce((s, p) => s + p[0] * p[0], 0); return { a: 0, b: sxx > 0 ? sxy / sxx : 0 }; }
    const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
    let sxy = 0, sxx = 0; pts.forEach((p) => { sxy += (p[0] - mx) * (p[1] - my); sxx += (p[0] - mx) ** 2; });
    const b = sxx > 0 ? sxy / sxx : 0; return { a: my - b * mx, b };
  }
  /** Envelope (c, φ) from circles {s1, s3} by fitting q = a + p tan α, sin φ = tan α, c = a / cos φ. */
  function envFromCircles(circ, origin) {
    const pts = circ.map((c) => [(c.s1 + c.s3) / 2, (c.s1 - c.s3) / 2]);
    const L = fitLine(pts, origin);
    const sphi = Math.min(0.999, Math.max(0, L.b)), phi = Math.asin(sphi);
    return { phi, c: Math.max(0, L.a / Math.cos(phi)), a: L.a, tanA: L.b, pts };
  }
  /** Stresses on the failure plane of a circle at failure: plane at θ = 45° + φ/2 from the major principal plane. */
  function failPlane(s1, s3, phi) {
    const th = Math.PI / 4 + phi / 2, p = (s1 + s3) / 2, R = (s1 - s3) / 2;
    return { th, sn: p + R * Math.cos(2 * th), tau: R * Math.sin(2 * th) };
  }

  function stressState(p, U, st) {
    const out = [], warn = [];
    let sx, sy, txy;
    if (p.by === 'principal') { sx = p.s1; sy = p.s3; txy = 0; }
    else { sx = p.sx; sy = p.sy; txy = p.txy; }
    const c0 = (sx + sy) / 2, R = Math.hypot((sx - sy) / 2, txy);
    const s1 = c0 + R, s3 = c0 - R;
    const thp = 0.5 * Math.atan2(2 * txy, sx - sy); // angle from x axis to the σ1 direction
    if (p.by !== 'principal') {
      st.add('Centre and radius of the Mohr circle', 'C = (σx + σy)/2,  R = √[((σx − σy)/2)² + τxy²]', `C = (${f(sx)} + ${f(sy)})/2;  R = √[(${f((sx - sy) / 2)})² + ${f(txy)}²]`, `C = ${f(c0)},  R = ${f(R)} ${U.press}`);
      st.add('Principal stresses', 'σ₁ = C + R,  σ₃ = C − R', `σ₁ = ${f(c0)} + ${f(R)},  σ₃ = ${f(c0)} − ${f(R)}`, `σ₁ = ${f(s1)},  σ₃ = ${f(s3)} ${U.press}`);
      st.add('Direction of the major principal stress', 'tan 2θp = 2τxy / (σx − σy)', `2θp = atan2(${f(2 * txy)}, ${f(sx - sy)})`, `θp = ${f(thp / DEG)}° from the x axis (counterclockwise)`, 'The minor principal stress acts at 90° to it.');
    } else st.add('Principal stresses (given)', 'C = (σ₁ + σ₃)/2,  R = (σ₁ − σ₃)/2', `C = ${f(c0)},  R = ${f(R)}`, `τ_max = R = ${f(R)} ${U.press}`);
    const th = p.theta * DEG;
    const sn = c0 + ((sx - sy) / 2) * Math.cos(2 * th) + txy * Math.sin(2 * th);
    const tn = -((sx - sy) / 2) * Math.sin(2 * th) + txy * Math.cos(2 * th);
    st.add(`Stresses on a plane whose normal is at θ = ${f(p.theta)}° from the x axis`, 'σ_θ = C + ((σx − σy)/2) cos 2θ + τxy sin 2θ;  τ_θ = −((σx − σy)/2) sin 2θ + τxy cos 2θ', `σ_θ = ${f(c0)} + ${f((sx - sy) / 2)} cos ${f(2 * p.theta)}° + ${f(txy)} sin ${f(2 * p.theta)}°`, `σ_θ = ${f(sn)},  τ_θ = ${f(tn)} ${U.press}`);
    out.push({ k: 'Major principal stress σ₁', v: s1, u: U.press, hl: true }, { k: 'Minor principal stress σ₃', v: s3, u: U.press, hl: true }, { k: 'Maximum shear stress τ_max', v: R, u: U.press }, { k: 'Angle of σ₁ from the x axis', v: thp / DEG, u: '°' }, { k: `σ on the θ = ${f(p.theta)}° plane`, v: sn, u: U.press }, { k: `τ on the θ = ${f(p.theta)}° plane`, v: tn, u: U.press });
    // Mohr–Coulomb check
    const phi = p.phi * DEG, c = p.c;
    const Rf = c * Math.cos(phi) + c0 * Math.sin(phi);
    const FS = R > 0 ? Rf / R : Infinity;
    st.add('Mohr–Coulomb check (same centre)', 'radius that just touches the envelope: R_f = c cos φ + C sin φ;  FS = R_f / R', `R_f = ${f(c)} cos ${f(p.phi)}° + ${f(c0)} sin ${f(p.phi)}°`, `R_f = ${f(Rf)},  FS = ${f(FS)}`, FS < 1 ? 'The circle crosses the envelope: the soil fails.' : 'The circle lies below the envelope: no failure.');
    const fpl = failPlane(s1, s3, phi);
    st.add('Critical (failure) plane', 'θ_f = 45° + φ/2 from the major principal plane', `θ_f = 45 + ${f(p.phi)}/2`, `θ_f = ${f(fpl.th / DEG)}°;  on it σ = ${f(fpl.sn)},  τ = ${f(fpl.tau)},  strength τ_f = ${f(c + fpl.sn * Math.tan(phi))} ${U.press}`);
    out.push({ k: 'FS against failure (R_f / R)', v: FS, u: '', hl: true }, { k: 'Failure plane angle θ_f', v: fpl.th / DEG, u: '°' });
    return { out, warn, circles: [{ s1, s3, col: 'main', label: 'stress state' }], env: [{ c, phi, label: 'Mohr–Coulomb', col: 'main' }], state: { sx, sy, txy, s1, s3, thp, theta: p.theta, sn, tn, c0, R }, FS, fpl, phi, cc: c };
  }

  function directShear(p, U, st) {
    const out = [], warn = [];
    const T = p.tests.filter((t) => t.N > 0);
    if (!T.length) return { err: ['Enter at least one test with a positive normal load.'] };
    let pts;
    let A = p.A;
    if (p.input === 'force' && p.aBy === 'D') {
      A = (Math.PI * p.D * p.D) / 4;
      st.add('Area of the circular specimen', 'A = π D² / 4', `A = π × ${f(p.D)}² / 4`, `A = ${f(A)} ${U.areaS}`);
    }
    if (p.input === 'force') {
      if (!(A > 0)) return { err: ['Box area must be positive.'] };
      const k = U.id === 'SI' ? 10 : 144; // N/cm² → kPa ; lb/in² → psf
      pts = T.map((t) => [(t.N / A) * k, (t.S / A) * k]);
      st.add('Normal and shear stress in each test', U.id === 'SI' ? 'σ = N / A,  τ = S / A   (1 N/cm² = 10 kPa)' : 'σ = N / A,  τ = S / A   (1 lb/in² = 144 psf)', T.map((t, i) => `test ${i + 1}: σ = ${f(t.N)}/${f(A)} = ${f(pts[i][0])}, τ = ${f(t.S)}/${f(A)} = ${f(pts[i][1])}`).join(';  '), `stresses in ${U.press}`, `Shear box area A = ${f(A)} ${U.areaS}.`);
    } else pts = T.map((t) => [t.N, t.S]);
    const origin = p.fit === 'phi' || pts.length < 2;
    const L = fitLine(pts, origin);
    const phi = Math.atan(L.b), c = Math.max(0, L.a);
    st.add(origin ? 'Friction angle (envelope through the origin, c = 0)' : 'Failure envelope by least squares', origin ? 'tan φ = Σστ / Σσ²' : 'τ_f = c + σ tan φ', origin ? `tan φ = ${f(L.b)}` : `slope tan φ = ${f(L.b)},  intercept c = ${f(L.a)}`, `φ = ${f(phi / DEG)}°,  c = ${f(c)} ${U.press}`, pts.length === 2 && !origin ? 'Two tests: the line passes through both points.' : '');
    // Mohr circle of each test (failure plane horizontal)
    const circles = pts.map(([sg, tau], i) => {
      const R = tau / Math.cos(phi), C = sg + tau * Math.tan(phi);
      return { s1: C + R, s3: C - R, label: `test ${i + 1}`, sg, tau };
    });
    const c1 = circles[circles.length - 1];
    st.add(`Principal stresses at failure in test ${circles.length} (Mohr circle through the failure point)`, 'C = σ + τ tan φ,  R = τ / cos φ,  σ₁,₃ = C ± R', `C = ${f(c1.sg)} + ${f(c1.tau)} tan ${f(phi / DEG)}°,  R = ${f(c1.tau)} / cos ${f(phi / DEG)}°`, `σ₁ = ${f(c1.s1)},  σ₃ = ${f(c1.s3)} ${U.press}`, 'The horizontal plane in the box is the failure plane; the major principal plane is inclined 45° + φ/2 to it.');
    pts.forEach((q, i) => out.push({ k: `Test ${i + 1}: σ, τ_f`, v: `${f(q[0])}, ${f(q[1])}`, u: U.press }));
    out.unshift({ k: 'Friction angle φ', v: phi / DEG, u: '°', hl: true }, { k: 'Cohesion c', v: c, u: U.press, hl: true });
    out.push({ k: `Test ${circles.length}: σ₁ / σ₃ at failure`, v: `${f(c1.s1)} / ${f(c1.s3)}`, u: U.press });
    if (L.a < -1e-6 && !origin) warn.push('The best-fit line has a negative intercept; c is taken as 0.');
    if (U.id === 'SI' && c > 0 && c < 1) out.splice(2, 0, { k: 'Cohesion c (in pascals)', v: c * 1000, u: 'Pa' });
    if (p.ask === 'N' || p.ask === 'S') {
      const byF = p.input === 'force', k = U.id === 'SI' ? 10 : 144, fu = U.id === 'SI' ? 'N' : 'lb';
      const toS = (v) => (byF ? (v / A) * k : v), toF = (v) => (byF ? (v * A) / k : v), unit = byF ? fu : U.press;
      if (p.ask === 'N') {
        const tau = toS(p.askV), sg = (tau - c) / Math.tan(phi);
        st.add('Normal load needed for the given shear at failure', 'σ = (τ − c) / tan φ' + (byF ? ',  N = σ A' : ''), `τ = ${f(tau)} ${U.press};  σ = (${f(tau)} − ${f(c)}) / tan ${f(phi / DEG)}° = ${f(sg)} ${U.press}`, `${byF ? 'N' : 'σ'} = ${f(toF(sg))} ${unit}`);
        out.unshift({ k: byF ? `Normal load for S = ${f(p.askV)} ${fu}` : `Normal stress for τ = ${f(p.askV)}`, v: toF(sg), u: unit, hl: true });
      } else {
        const sg = toS(p.askV), tau = c + sg * Math.tan(phi);
        st.add('Shear at failure for the given normal load', 'τ_f = c + σ tan φ' + (byF ? ',  S = τ A' : ''), `σ = ${f(sg)};  τ_f = ${f(c)} + ${f(sg)} tan ${f(phi / DEG)}° = ${f(tau)} ${U.press}`, `${byF ? 'S' : 'τ_f'} = ${f(toF(tau))} ${unit}`);
        out.unshift({ k: byF ? `Shear load at failure for N = ${f(p.askV)} ${fu}` : `Shear strength at σ = ${f(p.askV)}`, v: toF(tau), u: unit, hl: true });
      }
    }
    return { out, warn, circles, env: [{ c, phi, label: 'τ = c + σ tan φ', col: 'main' }], points: pts, phi, cc: c };
  }

  function triaxPlane(p, U, st) {
    const out = [], warn = [];
    const pts = (p.planes || []).filter((q) => q.sn > 0 && q.tau > 0).map((q) => [q.sn, q.tau]);
    if (!pts.length) return { err: ['Enter the normal and shear stress on the failure plane.'] };
    const origin = p.fit === 'phi' || pts.length < 2;
    const L = fitLine(pts, origin), phi = Math.atan(L.b), c = Math.max(0, L.a);
    st.add(origin ? 'Friction angle from the stresses on the failure plane (c = 0)' : 'Envelope through the failure-plane points', origin ? 'tan φ = τ_f / σ_f' : 'τ_f = c + σ_f tan φ', origin ? (pts.length === 1 ? `tan φ = ${f(pts[0][1])} / ${f(pts[0][0])} = ${f(L.b)}` : `tan φ = Σστ / Σσ² = ${f(L.b)}`) : `slope = ${f(L.b)}, intercept = ${f(L.a)}`, `φ = ${f(phi / DEG)}°${origin ? '' : `,  c = ${f(c)} ${U.press}`}`);
    const th = 45 + phi / DEG / 2;
    st.add('Angle of the failure plane', 'θ = 45° + φ/2 (from the major principal plane, horizontal in a triaxial test)', `θ = 45 + ${f(phi / DEG)}/2`, `θ = ${f(th)}°`);
    const circles = pts.map(([sg, tau], i) => { const R = tau / Math.cos(phi), C = sg + tau * Math.tan(phi); return { s1: C + R, s3: C - R, label: `specimen ${i + 1}`, col: 'eff', sg, tau }; });
    const c1 = circles[0];
    st.add('Principal stresses at failure (Mohr circle tangent at the failure point)', 'C = σ_f + τ_f tan φ,  R = τ_f / cos φ,  σ₁,₃ = C ± R', `C = ${f(c1.sg)} + ${f(c1.tau)} tan ${f(phi / DEG)}° = ${f((c1.s1 + c1.s3) / 2)},  R = ${f((c1.s1 - c1.s3) / 2)}`, `σ₁ = ${f(c1.s1)},  σ₃ = ${f(c1.s3)} ${U.press}`, `Deviator stress Δσ_d = ${f(c1.s1 - c1.s3)}; maximum shear τ_max = R = ${f((c1.s1 - c1.s3) / 2)} on the 45° plane, with normal stress C.`);
    out.push({ k: 'Friction angle φ', v: phi / DEG, u: '°', hl: true }, { k: 'Failure plane angle θ (from horizontal)', v: th, u: '°', hl: true });
    if (!origin) out.push({ k: 'Cohesion c', v: c, u: U.press, hl: true });
    out.push({ k: 'σ₁ / σ₃ at failure (specimen 1)', v: `${f(c1.s1)} / ${f(c1.s3)}`, u: U.press }, { k: 'Deviator stress Δσ_d', v: c1.s1 - c1.s3, u: U.press }, { k: 'Max shear stress / normal stress on its plane', v: `${f((c1.s1 - c1.s3) / 2)} / ${f((c1.s1 + c1.s3) / 2)}`, u: U.press });
    const fpl = failPlane(c1.s1, c1.s3, phi);
    return { out, warn, circles, env: [{ c, phi, label: 'τ = c + σ tan φ', col: 'eff' }], fpl, phi, cc: c, ref: c1, points: pts };
  }

  function triaxial(p, U, st) {
    if (p.input === 'plane') return triaxPlane(p, U, st);
    const out = [], warn = [];
    const T = p.specs.filter((s) => s.s3 >= 0 && s.dd > 0);
    if (!T.length) return { err: ['Enter at least one specimen with a positive deviator stress.'] };
    const type = p.type;
    const tot = T.map((s, i) => ({ s3: s.s3, s1: s.s3 + s.dd, label: `specimen ${i + 1}`, du: s.du || 0 }));
    st.add('Major principal stress at failure', 'σ₁ = σ₃ + Δσ_d', tot.map((q, i) => `${i + 1}: σ₁ = ${f(q.s3)} + ${f(q.s1 - q.s3)} = ${f(q.s1)}`).join(';  '), `${U.press}`, type === 'UU' ? 'UU: the cell pressure does not change the strength of a saturated clay (φ = 0).' : '');
    const circles = [], env = [];
    let res = {};
    if (type === 'UU') {
      const su = tot.reduce((s, q) => s + (q.s1 - q.s3) / 2, 0) / tot.length;
      st.add('Undrained shear strength', 's_u = c_u = Δσ_d / 2  (φ_u = 0)', tot.map((q) => f((q.s1 - q.s3) / 2)).join(', '), `s_u = ${f(su)} ${U.press}${tot.length > 1 ? ' (average)' : ''}`);
      tot.forEach((q) => circles.push(Object.assign({}, q, { col: 'tot' })));
      env.push({ c: su, phi: 0, label: `s_u = ${f(su)}`, col: 'tot' });
      out.push({ k: 'Undrained shear strength s_u', v: su, u: U.press, hl: true }, { k: 'φ_u', v: 0, u: '°' });
      res = { phi: 0, cc: su };
    } else {
      const origin = p.fit === 'phi' || tot.length < 2;
      const fitOne = (circ, tag) => {
        const E = envFromCircles(circ, origin);
        if (origin) st.add(`${tag}: friction angle (c = 0)`, circ.length === 1 ? 'sin φ = (σ₁ − σ₃)/(σ₁ + σ₃)' : 'sin φ = slope of the p–q line through the origin', circ.length === 1 ? `sin φ = (${f(circ[0].s1)} − ${f(circ[0].s3)}) / (${f(circ[0].s1)} + ${f(circ[0].s3)}) = ${f(E.tanA)}` : `slope = ${f(E.tanA)}`, `φ = ${f(E.phi / DEG)}°`);
        else st.add(`${tag}: envelope from the specimens (p–q fit)`, 'q = a + p tan α,  p = (σ₁+σ₃)/2,  q = (σ₁−σ₃)/2;  sin φ = tan α,  c = a / cos φ', `tan α = ${f(E.tanA)},  a = ${f(E.a)}`, `φ = ${f(E.phi / DEG)}°,  c = ${f(E.c)} ${U.press}`, circ.length === 2 ? 'Two specimens: equivalent to drawing the common tangent to both circles.' : 'Least-squares fit of the tops of the circles.');
        return E;
      };
      const Et = fitOne(tot, type === 'CU' ? 'Total stresses' : 'Drained (effective) stresses');
      tot.forEach((q) => circles.push(Object.assign({}, q, { col: type === 'CU' ? 'tot' : 'eff' })));
      env.push({ c: Et.c, phi: Et.phi, label: type === 'CU' ? 'total' : 'effective', col: type === 'CU' ? 'tot' : 'eff' });
      if (type === 'CU') {
        const eff = tot.map((q, i) => ({ s1: q.s1 - q.du, s3: q.s3 - q.du, label: `specimen ${i + 1} (effective)` }));
        st.add('Effective principal stresses at failure', 'σ′₁ = σ₁ − Δu,  σ′₃ = σ₃ − Δu', eff.map((q, i) => `${i + 1}: σ′₁ = ${f(tot[i].s1)} − ${f(tot[i].du)} = ${f(q.s1)},  σ′₃ = ${f(q.s3)}`).join(';  '), U.press);
        if (eff.some((q) => q.s3 < 0)) warn.push('Δu is larger than σ₃: negative effective confining stress.');
        const Ee = fitOne(eff, 'Effective stresses');
        eff.forEach((q) => circles.push(Object.assign({}, q, { col: 'eff' })));
        env.push({ c: Ee.c, phi: Ee.phi, label: 'effective', col: 'eff' });
        out.push({ k: 'Total stress φ (φ_cu)', v: Et.phi / DEG, u: '°' }, { k: 'Total stress c (c_cu)', v: Et.c, u: U.press }, { k: 'Effective φ′', v: Ee.phi / DEG, u: '°', hl: true }, { k: 'Effective c′', v: Ee.c, u: U.press, hl: true });
        res = { phi: Ee.phi, cc: Ee.c, effCircle: eff[0] };
        const A = tot.map((q) => q.du / (q.s1 - q.s3));
        st.add('Skempton pore pressure parameter at failure', 'A_f = Δu_f / Δσ_d', A.map((a, i) => `${i + 1}: ${f(tot[i].du)} / ${f(tot[i].s1 - tot[i].s3)} = ${f(a)}`).join(';  '), '', 'A_f ≈ 0.5–1 for NC clays, below 0.5 (even negative) for OC clays.');
        out.push({ k: 'Skempton A_f (specimen 1)', v: A[0], u: '' });
      } else {
        out.push({ k: 'Friction angle φ′', v: Et.phi / DEG, u: '°', hl: true }, { k: 'Cohesion c′', v: Et.c, u: U.press, hl: true });
        res = { phi: Et.phi, cc: Et.c };
      }
    }
    const ref = res.effCircle || (type === 'UU' ? tot[0] : tot[0]);
    const fpl = failPlane(ref.s1, ref.s3, res.phi);
    st.add('Failure plane (specimen 1)', 'θ = 45° + φ/2 from the horizontal (major principal plane);  σ_f = C + R cos 2θ,  τ_f = R sin 2θ', `θ = 45 + ${f(res.phi / DEG)}/2 = ${f(fpl.th / DEG)}°`, `σ_f = ${f(fpl.sn)},  τ_f = ${f(fpl.tau)} ${U.press}`, res.effCircle ? 'Using effective stresses.' : '');
    out.push({ k: 'Failure plane angle θ', v: fpl.th / DEG, u: '°' }, { k: 'Normal / shear stress on it', v: `${f(fpl.sn)} / ${f(fpl.tau)}`, u: U.press });
    return { out, warn, circles, env, fpl, phi: res.phi, cc: res.cc, ref };
  }

  function unconfined(p, U, st) {
    const out = [], warn = [];
    let qu;
    if (p.input === 'load') {
      const A0 = (Math.PI * p.D * p.D) / 4, eps = p.eps / 100;
      if (!(A0 > 0) || !(p.Pf > 0) || !(eps < 1)) return { err: ['Need a positive diameter and load and a strain below 100 %.'] };
      const A = A0 / (1 - eps), k = U.id === 'SI' ? 10 : 144;
      qu = (p.Pf / A) * k;
      st.add('Corrected area at failure', 'A = A₀ / (1 − ε),  A₀ = π D² / 4', `A₀ = π × ${f(p.D)}²/4 = ${f(A0)};  A = ${f(A0)} / (1 − ${f(eps)})`, `A = ${f(A)} ${U.areaS}`, 'The specimen bulges, so the load is spread over a larger area.');
      st.add('Unconfined compression strength', 'q_u = P / A', `q_u = ${f(p.Pf)} / ${f(A)} × ${U.id === 'SI' ? 10 : 144}`, `q_u = ${f(qu)} ${U.press}`);
    } else qu = p.qu;
    if (!(qu > 0)) return { err: ['q_u must be positive.'] };
    if (p.useTh) {
      const th = p.th, phi = (2 * th - 90) * DEG;
      if (!(th >= 45 && th < 90)) return { err: ['The failure plane angle must be between 45° and 90° from the horizontal.'] };
      const cc = qu / (2 * Math.tan(th * DEG));
      st.add('Friction angle from the failure plane', 'θ = 45° + φ/2  →  φ = 2θ − 90°', `φ = 2(${f(th)}) − 90`, `φ = ${f(phi / DEG)}°`);
      st.add('Cohesion (σ₃ = 0)', 'σ₁ = σ₃ tan²θ + 2c tan θ  →  c = q_u / (2 tan θ)', `c = ${f(qu)} / (2 tan ${f(th)}°)`, `c = ${f(cc)} ${U.press}`);
      out.push({ k: 'Unconfined strength q_u', v: qu, u: U.press }, { k: 'Friction angle φ', v: phi / DEG, u: '°', hl: true }, { k: 'Cohesion c', v: cc, u: U.press, hl: true });
      const fpl = failPlane(qu, 0, phi);
      return { out, warn, circles: [{ s1: qu, s3: 0, label: 'unconfined', col: 'tot' }], env: [{ c: cc, phi, label: 'τ = c + σ tan φ', col: 'tot' }], fpl, phi, cc, ref: { s1: qu, s3: 0 } };
    }
    const su = qu / 2;
    st.add('Undrained shear strength', 's_u = q_u / 2  (σ₃ = 0, φ = 0)', `s_u = ${f(qu)} / 2`, `s_u = ${f(su)} ${U.press}`);
    out.push({ k: 'Unconfined strength q_u', v: qu, u: U.press, hl: true }, { k: 'Undrained shear strength s_u', v: su, u: U.press, hl: true });
    if (p.sens && p.quR > 0) {
      const St = qu / p.quR;
      const cls = St < 2 ? 'low' : St < 4 ? 'medium' : St < 8 ? 'high (sensitive)' : St < 16 ? 'extra sensitive' : 'quick clay';
      st.add('Sensitivity', 'S_t = q_u (undisturbed) / q_u (remolded)', `S_t = ${f(qu)} / ${f(p.quR)}`, `S_t = ${f(St)} (${cls})`);
      out.push({ k: 'Sensitivity S_t', v: St, u: '' });
    }
    const consist = su < 12.5 * (U.id === 'SI' ? 1 : 20.885) ? 'very soft' : su < 25 * (U.id === 'SI' ? 1 : 20.885) ? 'soft' : su < 50 * (U.id === 'SI' ? 1 : 20.885) ? 'medium' : su < 100 * (U.id === 'SI' ? 1 : 20.885) ? 'stiff' : su < 200 * (U.id === 'SI' ? 1 : 20.885) ? 'very stiff' : 'hard';
    out.push({ k: 'Consistency', v: consist, u: '' });
    const fpl = failPlane(qu, 0, 0);
    return { out, warn, circles: [{ s1: qu, s3: 0, label: 'unconfined', col: 'tot' }], env: [{ c: su, phi: 0, label: `s_u = ${f(su)}`, col: 'tot' }], fpl, phi: 0, cc: su, ref: { s1: qu, s3: 0 } };
  }

  function shear(p, U) {
    const st = Steps();
    const sub = p.sub;
    const r = sub === 'stress' ? stressState(p.stress, U, st) : sub === 'direct' ? directShear(p.direct, U, st) : sub === 'triax' ? triaxial(p.triax, U, st) : unconfined(p.ucs, U, st);
    if (r.err) return fail(r.err);
    let cls = 'ok', text;
    if (sub === 'stress') { text = `σ₁ = ${f(r.state.s1)}, σ₃ = ${f(r.state.s3)} ${U.press} · FS = ${f(r.FS, 3)}`; if (r.FS < 1) cls = 'bad'; else if (r.FS < 1.5) cls = 'warn'; }
    else if ((sub === 'unconf' && !p.ucs.useTh) || (sub === 'triax' && p.triax.type === 'UU' && p.triax.input !== 'plane')) text = `s_u = ${f(r.cc)} ${U.press}`;
    else text = `φ = ${f(r.phi / DEG)}°, c = ${f(r.cc)} ${U.press}`;
    return { ok: true, err: [], warn: r.warn, status: { cls, text }, out: r.out, steps: st.list, geo: Object.assign({ kind: 'shear', sub }, r) };
  }

  Object.assign(P, { shear, fitLine, envFromCircles, failPlane });
})(typeof window !== 'undefined' ? window : globalThis);
