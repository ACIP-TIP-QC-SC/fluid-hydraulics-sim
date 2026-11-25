/* =====================================================================
 * Geotechnical — STEP 3: Stresses in Soil (physics)
 * Vertical stress increase Δσz below surface loads on an elastic
 * half-space (Boussinesq): point loads, a line load, a strip, a circle,
 * and rectangles (composite footprints by superposition), plus the 2:1
 * method, the average increase in a layer, and the pressure bulb.
 * ===================================================================== */
(function (root) {
  'use strict';
  const P = root.Physics;
  const { fmt: f, Steps, fail, PI } = P;

  /** Point load Q at horizontal distance r, depth z. */
  function bPoint(Q, r, z) { if (z <= 0) return 0; const t = r / z; return (3 * Q) / (2 * PI * z * z) / Math.pow(1 + t * t, 2.5); }
  /** Line load q (per unit length) at horizontal offset x. */
  /** Westergaard point load (Poisson ratio μ; μ = 0 gives Q/(πz²) / [1 + 2(r/z)²]^(3/2)). */
  function wPoint(Q, r, z, mu) { if (z <= 0) return 0; const eta = Math.sqrt((1 - 2 * mu) / (2 - 2 * mu)), t = r / z; return (Q / (2 * PI * z * z)) * eta / Math.pow(eta * eta + t * t, 1.5); }
  function bLine(q, x, z) { if (z <= 0) return 0; return (2 * q * z * z * z) / (PI * Math.pow(x * x + z * z, 2)); }
  /** Uniform strip of width B centred at x = 0. */
  function bStrip(q, B, x, z) {
    if (z <= 1e-12) return Math.abs(x) < B / 2 ? q : Math.abs(x) === B / 2 ? q / 2 : 0;
    const b1 = Math.atan((x + B / 2) / z), b2 = Math.atan((x - B / 2) / z), a = b1 - b2;
    return (q / PI) * (a + Math.sin(a) * Math.cos(b1 + b2));
  }
  /** Influence factor below the corner of a B × L rectangle (Newmark), m = B/z, n = L/z. */
  function cornerI(m, n) {
    if (m <= 0 || n <= 0) return 0;
    const m2 = m * m, n2 = n * n, V = m2 + n2 + 1, s = Math.sqrt(V);
    return (1 / (4 * PI)) * ((2 * m * n * s) / (V + m2 * n2) * ((V + 1) / V) + Math.atan2(2 * m * n * s, V - m2 * n2));
  }
  /** Signed corner term for a rectangle corner offset (a, b) from the point. */
  function F(a, b, z) { if (z <= 1e-12) return 0.25 * Math.sign(a) * Math.sign(b); return Math.sign(a) * Math.sign(b) * cornerI(Math.abs(a) / z, Math.abs(b) / z); }
  /** Rectangle [x1,x2] × [y1,y2] with intensity q, at point (x, y, z). */
  function bRect(q, x1, x2, y1, y2, x, y, z) { return q * (F(x2 - x, y2 - y, z) - F(x1 - x, y2 - y, z) - F(x2 - x, y1 - y, z) + F(x1 - x, y1 - y, z)); }
  /** Uniform circle of radius R at horizontal distance r from its centre (exact below the centre). */
  function bCircle(q, R, r, z) {
    if (z <= 1e-12) return r < R ? q : r === R ? q / 2 : 0;
    if (r < 1e-9) return q * (1 - Math.pow(1 + (R / z) * (R / z), -1.5));
    // Boussinesq integrated in polar coordinates centred below P: the radial integral is exact,
    // ∫ρ dρ/(ρ²+z²)^(5/2) = −1/[3(ρ²+z²)^(3/2)], so only the angle is integrated numerically.
    const g = (rho) => Math.pow(rho * rho + z * z, -1.5), z3 = z * z * z, n = 360;
    let s = 0;
    if (r < R) {
      for (let k = 0; k < n; k++) { const th = ((k + 0.5) * 2 * PI) / n, sn = Math.sin(th); const r2 = r * Math.cos(th) + Math.sqrt(R * R - r * r * sn * sn); s += (g(0) - g(r2)) * ((2 * PI) / n); }
    } else {
      const tm = Math.asin(Math.min(1, R / r));
      for (let k = 0; k < n; k++) {
        const ph = -PI / 2 + ((k + 0.5) * PI) / n, th = tm * Math.sin(ph), dth = tm * Math.cos(ph) * (PI / n);
        const c = r * Math.cos(th), d = Math.sqrt(Math.max(0, R * R - r * r * Math.sin(th) ** 2));
        s += (g(c - d) - g(c + d)) * dth;
      }
    }
    return ((q * z3) / (2 * PI)) * s;
  }

  /** Build the load set from the state; returns { fn(x,y,z) → Δσ, qRef, … }. */
  function loadSet(p) {
    const t = p.type;
    if (t === 'point') {
      const L = p.points.filter((q) => q.Q !== 0);
      const W = p.pm === 'west', mu = p.mu || 0;
      return { fn: (x, y, z) => L.reduce((s, q) => s + (W ? wPoint(q.Q, Math.hypot(x - q.x, y - q.y), z, mu) : bPoint(q.Q, Math.hypot(x - q.x, y - q.y), z)), 0), qRef: null, L };
    }
    if (t === 'line') return { fn: (x, y, z) => bLine(p.line.q, x - p.line.x, z) + (p.line.two ? bLine(p.line.q2, x - p.line.x2, z) : 0), qRef: null };
    if (t === 'strip') return { fn: (x, y, z) => bStrip(p.strip.q, p.strip.B, x, z), qRef: p.strip.q };
    if (t === 'circle') return { fn: (x, y, z) => bCircle(p.circle.q, p.circle.R, Math.hypot(x, y), z), qRef: p.circle.q };
    const R = p.rects;
    return { fn: (x, y, z) => R.reduce((s, r) => s + bRect(r.q, r.x - r.B / 2, r.x + r.B / 2, r.y - r.L / 2, r.y + r.L / 2, x, y, z), 0), qRef: Math.max(...R.map((r) => r.q)) };
  }

  /** 2:1 method (average stress on the spread area) where it applies. */
  function twoToOne(p, z) {
    if (p.type === 'rect' && p.rects.length === 1) { const r = p.rects[0]; return (r.q * r.B * r.L) / ((r.B + z) * (r.L + z)); }
    if (p.type === 'strip') return (p.strip.q * p.strip.B) / (p.strip.B + z);
    if (p.type === 'circle') { const D = 2 * p.circle.R; return (p.circle.q * D * D) / ((D + z) * (D + z)); }
    return null;
  }

  function soilStress(p, U) {
    const st = Steps(), out = [], warn = [], err = [];
    const Lu = U.len, Pu = U.press, Fu = U.force;
    const x = p.xP, y = p.yP, z = p.zP;
    if (!(z > 0)) return fail(['Depth z of the point must be positive.']);
    if (p.type === 'point' && !p.points.some((q) => q.Q !== 0)) return fail(['Enter at least one point load.']);
    if (p.type === 'strip' && !(p.strip.B > 0)) err.push('Strip width must be positive.');
    if (p.type === 'circle' && !(p.circle.R > 0)) err.push('Radius must be positive.');
    if (p.type === 'rect' && p.rects.some((r) => !(r.B > 0) || !(r.L > 0))) err.push('Rectangle sides must be positive.');
    if (err.length) return fail(err);
    if (p.type === 'circle' && p.circle.byP) {
      const q = p.circle.P / (Math.PI * p.circle.R * p.circle.R);
      p = Object.assign({}, p, { circle: Object.assign({}, p.circle, { q }) });
      st.add('Contact pressure from the total load', 'q = P / (πR²)', `q = ${f(p.circle.P)} / (π × ${f(p.circle.R)}²)`, `q = ${f(q)} ${Pu}`);
    }
    const LS = loadSet(p);
    let ds = 0;
    if (p.type === 'point' && p.pm === 'west') {
      const mu = p.mu || 0, eta = Math.sqrt((1 - 2 * mu) / (2 - 2 * mu));
      st.add('Westergaard: vertical stress below a point load', 'Δσz = (Q / 2πz²) η / [η² + (r/z)²]^(3/2),  η = √[(1 − 2μ)/(2 − 2μ)];  μ = 0: Δσz = (0.318 Q / z²) / [1 + 2(r/z)²]^(3/2)', `μ = ${f(mu)},  η = ${f(eta)}`, '', 'Elastic soil reinforced by thin rigid horizontal sheets (layered or varved deposits); no lateral strain.');
      LS.L.forEach((q, i) => {
        const r = Math.hypot(x - q.x, y - q.y), I = eta / (2 * PI) / Math.pow(eta * eta + (r / z) ** 2, 1.5), d = (q.Q / (z * z)) * I;
        ds += d;
        st.add(`Load ${i + 1}: Q = ${f(q.Q)} ${Fu} at (${f(q.x)}, ${f(q.y)})`, 'Δσz = (Q / z²) I_W', `r = ${f(r)} ${Lu},  r/z = ${f(r / z)},  I_W = ${f(I)};  Δσz = ${f(q.Q)} / ${f(z)}² × ${f(I)}`, `Δσz = ${f(d)} ${Pu}`);
      });
      if (LS.L.length > 1) st.add('Superposition of all point loads', 'Δσz = Σ Δσz,i', '', `Δσz = ${f(ds)} ${Pu}`);
      const db = LS.L.reduce((s0, q) => s0 + bPoint(q.Q, Math.hypot(x - q.x, y - q.y), z), 0);
      out.push({ k: 'Boussinesq value for comparison', v: db, u: Pu });
    } else if (p.type === 'point') {
      st.add('Boussinesq: vertical stress below a point load', 'Δσz = 3Q z³ / (2π R⁵) = (Q/z²) I,  I = (3/2π) / [1 + (r/z)²]^(5/2)', '', '', 'Elastic, homogeneous, isotropic half-space; the surface load acts at a point.');
      LS.L.forEach((q, i) => {
        const r = Math.hypot(x - q.x, y - q.y), I = (3 / (2 * PI)) / Math.pow(1 + (r / z) ** 2, 2.5), d = (q.Q / (z * z)) * I;
        ds += d;
        st.add(`Load ${i + 1}: Q = ${f(q.Q)} ${Fu} at (${f(q.x)}, ${f(q.y)})`, 'r = √((x − x_Q)² + (y − y_Q)²);  Δσz = (Q / z²) I', `r = ${f(r)} ${Lu},  r/z = ${f(r / z)},  I = ${f(I)};  Δσz = ${f(q.Q)} / ${f(z)}² × ${f(I)}`, `Δσz = ${f(d)} ${Pu}`);
      });
      if (LS.L.length > 1) st.add('Superposition of all point loads', 'Δσz = Σ Δσz,i', '', `Δσz = ${f(ds)} ${Pu}`);
    } else if (p.type === 'line') {
      const L1 = p.line, x1 = x - L1.x;
      const d1 = bLine(L1.q, x1, z); ds = d1;
      st.add('Line load (per unit length)', 'Δσz = 2q z³ / [π (x² + z²)²]', `Δσz = 2 × ${f(L1.q)} × ${f(z)}³ / [π (${f(x1)}² + ${f(z)}²)²]`, `Δσz = ${f(d1)} ${Pu}`, `x is measured from the line load (${f(x1)} ${Lu}).`);
      if (L1.two) { const x2 = x - L1.x2, d2 = bLine(L1.q2, x2, z); ds += d2; st.add('Second line load', 'Δσz = 2q₂ z³ / [π (x₂² + z²)²]', `Δσz = 2 × ${f(L1.q2)} × ${f(z)}³ / [π (${f(x2)}² + ${f(z)}²)²]`, `Δσz = ${f(d2)} ${Pu};  total = ${f(ds)} ${Pu}`); }
    } else if (p.type === 'strip') {
      const { q, B } = p.strip;
      const b1 = Math.atan((x + B / 2) / z), b2 = Math.atan((x - B / 2) / z), a = b1 - b2, dl = b1 + b2 - a; // δ = angle to the near edge
      ds = bStrip(q, B, x, z);
      st.add('Flexible strip load (width B, uniform q)', 'Δσz = (q/π) [α + sin α cos(α + 2δ)]', `α = ${f(a / P.DEG)}° (angle subtended by the strip),  δ = ${f((b2) / P.DEG)}°  (from the vertical to the near edge)`, `Δσz = (${f(q)}/π) [${f(a)} + sin(${f(a)}) cos(${f(a + 2 * b2)})] = ${f(ds)} ${Pu}`, 'Angles in radians inside the brackets; x measured from the centre line of the strip.');
      void dl;
    } else if (p.type === 'circle') {
      const { q, R } = p.circle, r = Math.hypot(x, y);
      ds = bCircle(q, R, r, z);
      if (r < 1e-9) st.add('Uniform circular load: below the centre', 'Δσz = q [1 − 1 / (1 + (R/z)²)^(3/2)]', `Δσz = ${f(q)} [1 − 1 / (1 + (${f(R)}/${f(z)})²)^1.5]`, `Δσz = ${f(ds)} ${Pu}`);
      else {
        st.add('Uniform circular load: off the centre', 'Δσz = ∫∫ 3q z³ / (2π R_d⁵) dA  (Boussinesq integrated over the circle)', `r/R = ${f(r / R)},  z/R = ${f(z / R)}`, `Δσz = ${f(ds)} ${Pu}  (I = ${f(ds / q)})`, 'Integrated numerically; it reproduces the closed form exactly below the centre and the published influence charts elsewhere.');
        st.add('For comparison, below the centre', 'Δσz = q [1 − 1/(1 + (R/z)²)^(3/2)]', '', `Δσz,centre = ${f(bCircle(q, R, 0, z))} ${Pu}`);
      }
    } else {
      st.add('Uniform rectangle: influence factor below a corner (Newmark)', 'I = (1/4π) [ 2mn√(m²+n²+1)/(m²+n²+m²n²+1) · (m²+n²+2)/(m²+n²+1) + tan⁻¹( 2mn√(m²+n²+1) / (m²+n²+1−m²n²) ) ],  m = B/z, n = L/z', '', '', 'The point is made a corner of four rectangles; their influence factors are added or subtracted (superposition). The angle is taken in 0…π.');
      p.rects.forEach((r, i) => {
        const x1 = r.x - r.B / 2, x2 = r.x + r.B / 2, y1 = r.y - r.L / 2, y2 = r.y + r.L / 2;
        const terms = [[x2 - x, y2 - y, +1], [x1 - x, y2 - y, -1], [x2 - x, y1 - y, -1], [x1 - x, y1 - y, +1]];
        const parts = terms.map(([a, b, sg]) => { const m = Math.abs(a) / z, n = Math.abs(b) / z, I = cornerI(m, n); const sign = sg * Math.sign(a) * Math.sign(b); return { m, n, I, sign }; });
        const Inet = parts.reduce((s, q) => s + q.sign * q.I, 0), d = r.q * Inet;
        ds += d;
        st.add(`Rectangle ${i + 1}: ${f(r.B)} × ${f(r.L)} ${Lu}, q = ${f(r.q)} ${Pu}`, 'I = Σ ± I(m, n) for the four corner rectangles;  Δσz = q I', parts.filter((q) => q.sign !== 0).map((q) => `${q.sign > 0 ? '+' : '−'}I(${f(q.m, 3)}, ${f(q.n, 3)}) = ${q.sign > 0 ? '+' : '−'}${f(q.I)}`).join('  '), `I = ${f(Inet)};  Δσz = ${f(r.q)} × ${f(Inet)} = ${f(d)} ${Pu}`);
      });
      if (p.rects.length > 1) st.add('Composite footprint: sum of the rectangles', 'Δσz = Σ qᵢ Iᵢ', '', `Δσz = ${f(ds)} ${Pu}`);
    }
    out.unshift({ k: `Δσz at P (${f(x)}, ${f(y)}, z = ${f(z)})`, v: ds, u: Pu, hl: true });
    if (p.type === 'circle' || p.type === 'strip' || p.type === 'rect') {
      const qa = p.type === 'circle' ? p.circle.q : p.type === 'strip' ? p.strip.q : p.rects[0].q;
      out.push({ k: 'Contact pressure at the base q', v: qa, u: Pu });
    }
    // inverse questions
    let inv = null;
    if (p.find === 'depth') {
      const target = p.tBy === 'abs' ? p.target : (p.ratio / 100) * (LS.qRef || 0);
      if (!(target > 0)) warn.push(p.tBy === 'abs' ? 'Enter a positive target stress.' : 'A fraction of q needs a distributed load (strip, circle or rectangle).');
      else {
        const g = (zz) => LS.fn(x, y, zz);
        // Δσ decreases with depth below the load; bracket and bisect (search from just below the surface)
        let lo = 1e-4, hi = 1, it = 0;
        while (g(hi) > target && it++ < 80) hi *= 2;
        if (g(lo) < target) warn.push('The stress never reaches that value below this point.');
        else {
          for (let i = 0; i < 200; i++) { const m = 0.5 * (lo + hi); if (g(m) > target) lo = m; else hi = m; }
          const zr = 0.5 * (lo + hi);
          inv = { z: zr, target };
          st.add('Depth at which Δσz reaches the target', p.tBy === 'abs' ? 'Δσz(z) = target' : 'Δσz(z) = ratio × q', `target = ${p.tBy === 'abs' ? '' : `${f(p.ratio)} % × ${f(LS.qRef)} = `}${f(target)} ${Pu}`, `z = ${f(zr)} ${Lu}`, p.type === 'circle' && Math.hypot(x, y) < 1e-9 ? 'Below the centre of a circle: ratio = 1 − 1/[1 + (R/z)²]^1.5, so z = R / √[(1 − ratio)^(−2/3) − 1].' : 'Solved by bisection on the stress–depth curve below P.');
          out.unshift({ k: `Depth where Δσz = ${f(target)} ${Pu}`, v: zr, u: Lu, hl: true });
        }
      }
    } else if (p.find === 'offset' && (p.type === 'point' || p.type === 'line')) {
      const x0 = p.type === 'point' ? LS.L[0].x : p.line.x, y0 = p.type === 'point' ? LS.L[0].y : 0;
      const g = (r) => LS.fn(x0 + r, y0, z);
      const d0 = g(0), target = (p.ratio / 100) * d0;
      let lo = 0, hi = z, it = 0;
      while (g(hi) > target && it++ < 80) hi *= 2;
      for (let i = 0; i < 200; i++) { const m = 0.5 * (lo + hi); if (g(m) > target) lo = m; else hi = m; }
      const rr = 0.5 * (lo + hi);
      inv = { r: rr, target };
      st.add(`Horizontal distance where Δσz falls to ${f(p.ratio)} % of the value directly below`, 'Δσz(r, z) = ratio × Δσz(0, z)', `Δσz(0, ${f(z)}) = ${f(d0)} ${Pu};  target = ${f(target)} ${Pu}`, `r = ${f(rr)} ${Lu}`, 'Measured from the (first) load at the same depth.');
      out.unshift({ k: `Offset where Δσz = ${f(p.ratio)} % of the value below the load`, v: rr, u: Lu, hl: true }, { k: 'Δσz directly below at this depth', v: d0, u: Pu });
    }
    if (LS.qRef) out.push({ k: 'Influence factor Δσz / q', v: ds / LS.qRef, u: '' });
    // 2:1 method
    const t21 = twoToOne(p, z);
    if (t21 !== null) {
      if (p.type === 'rect') { const r = p.rects[0]; st.add('2:1 approximate method (average over the spread area)', 'Δσ = q B L / [(B + z)(L + z)]', `Δσ = ${f(r.q)} × ${f(r.B)} × ${f(r.L)} / [(${f(r.B)} + ${f(z)})(${f(r.L)} + ${f(z)})]`, `Δσ = ${f(t21)} ${Pu}`, 'The load spreads at 2 vertical : 1 horizontal on every side; this is an average, not the value under a point.'); }
      else if (p.type === 'strip') st.add('2:1 approximate method (average)', 'Δσ = q B / (B + z)', `Δσ = ${f(p.strip.q)} × ${f(p.strip.B)} / (${f(p.strip.B)} + ${f(z)})`, `Δσ = ${f(t21)} ${Pu}`);
      else st.add('2:1 approximate method (as an equivalent square of side D)', 'Δσ = q D² / (D + z)²', `Δσ = ${f(p.circle.q)} × ${f(2 * p.circle.R)}² / (${f(2 * p.circle.R)} + ${f(z)})²`, `Δσ = ${f(t21)} ${Pu}`);
      out.push({ k: '2:1 method (average)', v: t21, u: Pu });
    }
    // average in a layer (Simpson)
    let avg = null;
    if (p.avg && p.z2 > p.z1 && p.z1 >= 0) {
      const zt = Math.max(p.z1, 1e-6), zb = p.z2, zm = 0.5 * (zt + zb);
      const dt = LS.fn(x, y, zt), dm = LS.fn(x, y, zm), db = LS.fn(x, y, zb);
      avg = (dt + 4 * dm + db) / 6;
      st.add(`Average increase in the layer from z = ${f(p.z1)} to ${f(p.z2)} ${Lu} (Simpson’s rule)`, 'Δσ_av = (Δσ_t + 4 Δσ_m + Δσ_b) / 6', `Δσ_av = (${f(dt)} + 4 × ${f(dm)} + ${f(db)}) / 6`, `Δσ_av = ${f(avg)} ${Pu}`, 'Used for consolidation settlement of a clay layer.');
      out.push({ k: 'Average Δσ in the layer', v: avg, u: Pu, hl: true }, { k: 'Δσ at top / middle / bottom', v: `${f(dt, 3)} / ${f(dm, 3)} / ${f(db, 3)}`, u: Pu });
    }
    // depth profile
    const zMax = Math.max(p.zMax, z * 1.2);
    const prof = [];
    for (let i = 1; i <= 80; i++) { const zz = (zMax * i) / 80; prof.push([LS.fn(x, y, zz), zz, twoToOne(p, zz)]); }
    // total load for reference
    let Qtot = null;
    if (p.type === 'point') Qtot = LS.L.reduce((s, q) => s + q.Q, 0);
    else if (p.type === 'rect') Qtot = p.rects.reduce((s, r) => s + r.q * r.B * r.L, 0);
    else if (p.type === 'circle') Qtot = p.circle.q * PI * p.circle.R ** 2;
    if (Qtot !== null) out.push({ k: 'Total applied load', v: Qtot, u: Fu });
    if (p.type === 'strip') out.push({ k: 'Load per unit length qB', v: p.strip.q * p.strip.B, u: U.fpl });
    if (z < 0.1 * (p.type === 'strip' ? p.strip.B : 1) && p.type === 'point') warn.push('Very close to a point load the Boussinesq stress becomes very large (theoretical singularity).');
    return { ok: true, err: [], warn, status: { cls: 'ok', text: inv && inv.z !== undefined ? `z = ${f(inv.z)} ${Lu} where Δσz = ${f(inv.target)} ${Pu}` : inv && inv.r !== undefined ? `r = ${f(inv.r)} ${Lu} where Δσz = ${f(p.ratio)} % of the value below` : `Δσz = ${f(ds)} ${Pu} at z = ${f(z)} ${Lu}` }, out, steps: st.list, geo: { kind: 'stress', ds, LS, p, prof, t21, avg, qRef: LS.qRef } };
  }

  /** Pressure-bulb grid in the x–z plane through y = y0. */
  function bulbGrid(LS, x0, x1, zmax, y0, nx, nz) {
    const W = nx + 1, H = nz + 1, xs = new Float64Array(W), ys = new Float64Array(H), v = new Float64Array(W * H);
    for (let i = 0; i < W; i++) xs[i] = x0 + ((x1 - x0) * i) / nx;
    for (let j = 0; j < H; j++) ys[j] = -zmax + (zmax * j) / nz; // y = −z (row 0 deepest)
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const z = -ys[j]; v[j * W + i] = z < 1e-9 ? NaN : LS.fn(xs[i], y0, z); }
    for (let i = 0; i < W; i++) v[(H - 1) * W + i] = v[(H - 2) * W + i] * 1.0; // surface row ≈ just below
    return { W, H, xs, ys, v, skip: null };
  }

  Object.assign(P, { soilStress, bPoint, bLine, bStrip, bRect, bCircle, cornerI, stressLoadSet: loadSet, bulbGrid, twoToOne });
})(typeof window !== 'undefined' ? window : globalThis);
