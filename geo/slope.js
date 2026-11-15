/* =====================================================================
 * Geotechnical — STEP 7: Slope Stability (physics)
 * Infinite slope (dry or with seepage parallel to the slope), Culmann's
 * plane failure for a finite slope, and circular slip surfaces by the
 * ordinary method of slices (Fellenius) and Bishop's simplified method,
 * with layered soil, pore pressure (r_u or a phreatic line), crest
 * surcharge and a search for the critical circle through the toe.
 * ===================================================================== */
(function (root) {
  'use strict';
  const P = root.Physics;
  const { fmt: f, Steps, fail, DEG } = P;
  const { tan, sin, cos, sqrt, atan, asin, PI } = Math;

  /* ---------------- infinite slope ---------------- */
  function infinite(p, U, st) {
    const out = [], warn = [];
    const b = p.beta * DEG, phi = p.phi * DEG, H = p.H, gw = U.gw;
    if (!(b > 0 && b < PI / 2 && H > 0)) return { err: ['Need 0 < β < 90° and a positive depth.'] };
    const m = p.seep ? Math.min(1, Math.max(0, p.m)) : 0;
    const gAvg = p.g * (1 - m) + p.gsat * m;
    const c2 = cos(b) ** 2;
    const sig = gAvg * H * c2, tau = gAvg * H * cos(b) * sin(b), u = m * H * gw * c2;
    st.add('Stresses on the slip plane (parallel to the surface)', 'σ = Σγh cos²β,  τ = Σγh cos β sin β,  u = γw m H cos²β', `Σγh = ${f(p.g)}(${f(1 - m)})(${f(H)}) + ${f(p.gsat)}(${f(m)})(${f(H)}) = ${f(gAvg * H)};  cos²β = ${f(c2)}`, `σ = ${f(sig)},  τ = ${f(tau)},  u = ${f(u)} ${U.press}`, m > 0 ? `Seepage parallel to the slope with the water table m H = ${f(m * H)} ${U.len} above the slip plane.` : 'Dry slope (no pore pressure).');
    const res = p.c + (sig - u) * tan(phi);
    const FS = res / tau;
    st.add('Factor of safety', 'FS = [c′ + (σ − u) tan φ′] / τ', `FS = [${f(p.c)} + (${f(sig)} − ${f(u)}) tan ${f(p.phi)}°] / ${f(tau)}`, `FS = ${f(FS)}`, m === 0 ? 'Same as FS = c′/(γ H cos²β tan β) + tan φ′/tan β.' : m === 1 ? 'Same as FS = c′/(γ_sat H cos²β tan β) + (γ′/γ_sat) tan φ′/tan β.' : '');
    out.push({ k: 'Factor of safety FS', v: FS, u: '', hl: true }, { k: 'Normal stress σ on the plane', v: sig, u: U.press }, { k: 'Shear stress τ on the plane', v: tau, u: U.press }, { k: 'Pore pressure u', v: u, u: U.press });
    let Hcr = null;
    if (p.c > 0 && b > phi && m === 0) {
      Hcr = p.c / (p.g * c2 * (tan(b) - tan(phi)));
      st.add('Critical depth (FS = 1, dry)', 'H_cr = c′ / [γ cos²β (tan β − tan φ′)]', `H_cr = ${f(p.c)} / [${f(p.g)} × ${f(c2)} × (${f(tan(b))} − ${f(tan(phi))})]`, `H_cr = ${f(Hcr)} ${U.len}`);
      out.push({ k: 'Critical depth H_cr', v: Hcr, u: U.len });
    } else if (p.c === 0) { out.push({ k: 'tan φ′ / tan β (cohesionless, dry)', v: tan(phi) / tan(b), u: '' }); if (b > phi) warn.push('β > φ′: a cohesionless slope cannot stand at this angle.'); }
    return { out, warn, FS, sig, tau, u, m, Hcr, gAvg };
  }

  /* ---------------- Culmann ---------------- */
  function culmann(p, U, st) {
    const out = [], warn = [];
    const b = p.beta * DEG, phi = p.phi * DEG, H = p.H, g = p.g, c = p.c;
    if (!(b > phi)) return { err: ['Culmann’s method needs β > φ (otherwise the plane never fails).'] };
    const cdReq = (phd) => ((g * H) / 4) * (1 - cos(b - phd)) / (sin(b) * cos(phd));
    const Hcr = phi < b ? ((4 * c) / g) * (sin(b) * cos(phi)) / (1 - cos(b - phi)) : Infinity;
    st.add('Critical height (FS = 1)', 'H_cr = (4c/γ) sin β cos φ / [1 − cos(β − φ)]', `H_cr = (4 × ${f(c)} / ${f(g)}) × sin ${f(p.beta)}° cos ${f(p.phi)}° / [1 − cos ${f(p.beta - p.phi)}°]`, `H_cr = ${f(Hcr)} ${U.len}`, 'The critical plane is inclined at θ_cr = (β + φ)/2.');
    // FS with respect to strength: c_d = c/FS, φ_d = atan(tan φ / FS)
    const g1 = (F) => c / F - cdReq(atan(tan(phi) / F));
    let lo = 0.05, hi = 20;
    if (c === 0) { lo = 1; hi = 1; }
    let FS;
    if (c > 0) {
      for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2; if (g1(mid) > 0) lo = mid; else hi = mid; }
      FS = (lo + hi) / 2;
    } else FS = tan(phi) / tan(b);
    const phd = atan(tan(phi) / FS), thc = (b + phd) / 2;
    st.add('Factor of safety with respect to strength (iteration)', 'c_d = c / FS,  tan φ_d = tan φ / FS,  required c_d = (γH/4) [1 − cos(β − φ_d)] / (sin β cos φ_d)', `FS = ${f(FS)}:  φ_d = ${f(phd / DEG)}°,  c/FS = ${f(c / FS)},  required c_d = ${f(cdReq(phd))}`, `FS_s = ${f(FS)}`, `The critical plane for the developed strength is θ = (β + φ_d)/2 = ${f(thc / DEG)}°.`);
    // trial plane given by the user (or the critical one)
    const th = (p.thetaBy === 'given' ? p.theta : thc / DEG) * DEG;
    if (!(th > 0 && th < b)) return { err: ['The trial plane angle must be between 0 and β.'] };
    const Lp = H / sin(th), W = 0.5 * g * H * H * (sin(b - th) / (sin(b) * sin(th)));
    const Ta = W * sin(th), Na = W * cos(th), Tr = c * Lp + Na * tan(phi);
    const FSp = Tr / Ta;
    st.add(`Wedge on the plane at θ = ${f(th / DEG)}°`, 'W = ½ γ H² sin(β − θ)/(sin β sin θ);  L = H / sin θ;  FS = (c L + W cos θ tan φ) / (W sin θ)', `W = ½ × ${f(g)} × ${f(H)}² × sin ${f(p.beta - th / DEG)}° / (sin ${f(p.beta)}° sin ${f(th / DEG)}°) = ${f(W)};  L = ${f(Lp)}`, `FS on this plane = (${f(c)} × ${f(Lp)} + ${f(Na)} tan ${f(p.phi)}°) / ${f(Ta)} = ${f(FSp)}`, 'This uses the full strength on one plane; the minimum over all planes is close to FS_s above.');
    out.push({ k: 'Factor of safety FS_s (critical plane)', v: FS, u: '', hl: true }, { k: 'Critical height H_cr', v: Hcr, u: U.len, hl: true }, { k: 'Critical plane angle θ_cr', v: thc / DEG, u: '°' }, { k: `Wedge weight W (θ = ${f(th / DEG)}°)`, v: W, u: U.fpl }, { k: 'FS on the trial plane', v: FSp, u: '' });
    return { out, warn, FS, Hcr, thc: thc / DEG, th: th / DEG, W, Lp, Ta, Na, Tr, FSp };
  }

  /* ---------------- method of slices ---------------- */
  function ground(p) { const L = p.H / tan(p.beta * DEG); return (x) => (x <= 0 ? 0 : x >= L ? p.H : (x * p.H) / L); }
  function layerAt(p, y) { let top = p.H; for (let i = 0; i < p.layers.length; i++) { const bot = top - p.layers[i].H; if (y > bot - 1e-9 || i === p.layers.length - 1) return i; top = bot; } return p.layers.length - 1; }
  function phreatic(p) {
    if (p.pore !== 'line') return null;
    const L = p.H / tan(p.beta * DEG), x2 = L + p.xw;
    return (x) => (x <= 0 ? 0 : x >= x2 ? p.hw : (p.hw * x) / x2);
  }

  /** Slices for a circle (xc, yc, R). Returns null if the circle does not cut the slope. */
  function makeSlices(p, xc, yc, R, n, gw) {
    const gr = ground(p), arc = (x) => yc - sqrt(Math.max(0, R * R - (x - xc) ** 2));
    // entry/exit: scan for ground - arc > 0
    const xa0 = xc - R, xb0 = xc + R, N = 600;
    let xa = null, xb = null;
    for (let i = 0; i <= N; i++) {
      const x = xa0 + ((xb0 - xa0) * i) / N, d = gr(x) - arc(x);
      if (d > 1e-9 && xa === null) xa = x;
      if (d > 1e-9) xb = x;
    }
    if (xa === null || xb - xa < 1e-6) return null;
    const ref = (x0, x1) => { for (let k = 0; k < 60; k++) { const m = (x0 + x1) / 2; if (gr(m) - arc(m) > 1e-12) x1 = m; else x0 = m; } return (x0 + x1) / 2; };
    xa = ref(Math.max(xa0, xa - (xb0 - xa0) / N), xa);
    const ref2 = (x0, x1) => { for (let k = 0; k < 60; k++) { const m = (x0 + x1) / 2; if (gr(m) - arc(m) > 1e-12) x0 = m; else x1 = m; } return (x0 + x1) / 2; };
    xb = ref2(xb, Math.min(xb0, xb + (xb0 - xa0) / N));
    const ph = phreatic(p), L = p.H / tan(p.beta * DEG);
    const b = (xb - xa) / n, out = [];
    for (let i = 0; i < n; i++) {
      const x0 = xa + i * b, x1 = x0 + b, xm = (x0 + x1) / 2;
      // weight by integrating the column through the layers (and the phreatic line)
      let W = 0; const M = 24;
      for (let k = 0; k < M; k++) {
        const x = x0 + ((k + 0.5) * b) / M, yt = gr(x), yb = arc(x);
        if (yt <= yb) continue;
        let top = p.H, y0 = yb; const wl = ph ? ph(x) : -Infinity;
        // walk the layers from the top
        let w = 0, lt = top;
        p.layers.forEach((l, j) => {
          const lb = j === p.layers.length - 1 ? -1e9 : lt - l.H;
          const a = Math.min(yt, lt), c0 = Math.max(y0, lb);
          if (a > c0) { const wet = Math.max(0, Math.min(a, wl) - c0), dry = a - c0 - wet; w += dry * l.g + wet * l.gsat; }
          lt = lb;
        });
        W += (w * b) / M; void top;
      }
      const qx = p.q > 0 ? p.q * Math.max(0, Math.min(x1, xb) - Math.max(x0, L)) : 0;
      const ybm = arc(xm), alpha = asin(Math.max(-1, Math.min(1, (xm - xc) / R)));
      const h = gr(xm) - ybm, l = b / cos(alpha), lay = layerAt(p, ybm), soil = p.layers[lay];
      let u = 0;
      if (p.pore === 'ru') u = p.ru * (W / b);
      else if (ph) u = gw * Math.max(0, ph(xm) - ybm);
      out.push({ i: i + 1, x0, x1, xm, b, h, W: W + qx, Wq: qx, alpha, l, u, c: soil.c, phi: soil.phi * DEG, lay, yb: ybm, yt: gr(xm) });
    }
    return { slices: out, xa, xb, ya: gr(xa), yb: gr(xb) };
  }

  function fsCircle(S, method) {
    const drv = S.reduce((s, q) => s + q.W * sin(q.alpha), 0);
    if (!(drv > 1e-9)) return { FS: Infinity, drv };
    const oms = S.reduce((s, q) => s + q.c * q.l + Math.max(0, q.W * cos(q.alpha) - q.u * q.l) * tan(q.phi), 0) / drv;
    if (method === 'oms') return { FS: oms, drv };
    let F = Math.max(0.2, oms), it = [];
    for (let k = 0; k < 100; k++) {
      let num = 0;
      S.forEach((q) => { const ma = cos(q.alpha) + (sin(q.alpha) * tan(q.phi)) / F; q.ma = ma; q.bnum = (q.c * q.b + Math.max(0, q.W - q.u * q.b) * tan(q.phi)) / Math.max(ma, 0.05); num += q.bnum; });
      const Fn = num / drv; it.push(Fn);
      if (Math.abs(Fn - F) < 1e-7) { F = Fn; break; }
      F = Fn;
    }
    return { FS: F, drv, it };
  }

  function circleFor(p) {
    const L = p.H / tan(p.beta * DEG);
    const xc = p.xc, yc = p.yc;
    let R = p.R;
    if (p.thru === 'toe') R = Math.hypot(xc, yc);
    void L;
    return { xc, yc, R };
  }

  function slices(p, U, st) {
    const out = [], warn = [];
    if (!(p.beta > 0 && p.beta < 90 && p.H > 0)) return { err: ['Need a positive slope height and 0 < β < 90°.'] };
    const gw = U.gw;
    let C = circleFor(p);
    // search the critical toe circle on a grid of centres
    let grid = null, best = null;
    if (p.search) {
      grid = [];
      const L = p.H / tan(p.beta * DEG), nx = 15, ny = 12;
      const x0 = -0.2 * p.H, x1 = L + 0.4 * p.H, y0 = p.H * 1.05, y1 = p.H * 2.6;
      for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
        const xc = x0 + ((x1 - x0) * i) / nx, yc = y0 + ((y1 - y0) * j) / ny, R = p.thru === 'toe' ? Math.hypot(xc, yc) : p.R;
        const sl = makeSlices(p, xc, yc, R, p.n, gw);
        if (!sl || sl.xb - sl.xa < 0.2 * p.H) continue;
        const r = fsCircle(sl.slices, p.method);
        if (!isFinite(r.FS) || r.FS <= 0) continue;
        grid.push({ xc, yc, R, FS: r.FS });
        if (!best || r.FS < best.FS) best = { xc, yc, R, FS: r.FS };
      }
      if (best && p.useBest) C = { xc: best.xc, yc: best.yc, R: best.R };
    }
    const sl = makeSlices(p, C.xc, C.yc, C.R, p.n, gw);
    if (!sl) return { err: ['The circle does not cut the slope. Move the centre or change the radius.'] };
    const S = sl.slices;
    st.add('Slip circle', p.thru === 'toe' ? 'Circle through the toe: R = √(x_c² + y_c²)' : 'Circle with the given radius', `centre (${f(C.xc)}, ${f(C.yc)}), R = ${f(C.R)}`, `enters at x = ${f(sl.xa)}, exits at x = ${f(sl.xb)};  ${S.length} slices of width b = ${f(S[0].b)} ${U.len}`, best && p.useBest ? `Critical centre from the grid search (FS = ${f(best.FS)}).` : '');
    if (sl.xb > p.H / tan(p.beta * DEG) + p.H * 3) warn.push('The circle runs far behind the crest; check the geometry.');
    const oms = fsCircle(S, 'oms'), bis = fsCircle(S, 'bishop');
    S.forEach((q) => { q.Wsin = q.W * sin(q.alpha); q.Wcos = q.W * cos(q.alpha); q.ul = q.u * q.l; q.Np = Math.max(0, q.Wcos - q.ul); q.res = q.c * q.l + q.Np * tan(q.phi); });
    st.add('Slice forces (per unit length)', 'W = Σγ A,  α = asin[(x_m − x_c)/R],  l = b / cos α,  N′ = W cos α − u l', S.map((q) => `${q.i}: W = ${f(q.W)}, α = ${f(q.alpha / DEG)}°, W sin α = ${f(q.Wsin)}, N′ = ${f(q.Np)}, u = ${f(q.u)}`).join(';  '), `ΣW sin α = ${f(oms.drv)} ${U.fpl}`, p.q > 0 ? `Crest surcharge q = ${f(p.q)} ${U.press} is added to the slices behind the crest.` : '');
    const sumRes = S.reduce((s, q) => s + q.res, 0);
    st.add('Ordinary method of slices (Fellenius)', 'FS = Σ[c l + (W cos α − u l) tan φ] / Σ W sin α', `FS = ${f(sumRes)} / ${f(oms.drv)}`, `FS_OMS = ${f(oms.FS)}`, 'Ignores the forces between slices; usually conservative.');
    const sumB = S.reduce((s, q) => s + q.bnum, 0);
    st.add('Bishop’s simplified method (iterate on FS)', 'FS = Σ{[c b + (W − u b) tan φ] / m_α} / Σ W sin α,  m_α = cos α + sin α tan φ / FS', `start at FS = ${f(Math.max(0.2, oms.FS))};  ${bis.it.length} iterations: ${bis.it.slice(0, 6).map((v) => f(v)).join(' → ')}${bis.it.length > 6 ? ' → …' : ''}`, `FS_Bishop = ${f(bis.FS)}  (Σ = ${f(sumB)})`, 'Satisfies the vertical force equilibrium of each slice; normally a little higher than the ordinary method.');
    const FS = p.method === 'oms' ? oms.FS : bis.FS;
    out.push({ k: p.method === 'oms' ? 'FS (ordinary method)' : 'FS (Bishop simplified)', v: FS, u: '', hl: true }, { k: p.method === 'oms' ? 'FS by Bishop (for comparison)' : 'FS by the ordinary method', v: p.method === 'oms' ? bis.FS : oms.FS, u: '' }, { k: 'Driving Σ W sin α', v: oms.drv, u: U.fpl }, { k: 'Circle centre (x, y), R', v: `${f(C.xc)}, ${f(C.yc)}, ${f(C.R)}`, u: U.len });
    if (best) out.push({ k: 'Critical circle from the search', v: `FS = ${f(best.FS)} at (${f(best.xc)}, ${f(best.yc)})`, u: '' });
    if (S.some((q) => q.ma !== undefined && q.ma < 0.2)) warn.push('Some slices have m_α < 0.2 (steep base at the toe); Bishop’s result may be unreliable.');
    return { out, warn, FS, oms: oms.FS, bis: bis.FS, it: bis.it, C, sl, S, grid, best, drv: oms.drv };
  }

  function slope(p, U) {
    const st = Steps();
    const r = p.sub === 'inf' ? infinite(p.inf, U, st) : p.sub === 'culmann' ? culmann(p.cul, U, st) : slices(p.circ, U, st);
    if (r.err) return fail(r.err);
    const FS = r.FS;
    const cls = !(FS >= 1) ? 'bad' : FS < 1.5 ? 'warn' : 'ok';
    let text = `FS = ${f(FS, 4)}`;
    if (p.sub === 'circ') text = `FS ${p.circ.method === 'oms' ? 'Fellenius' : 'Bishop'} = ${f(FS, 4)} · ${p.circ.method === 'oms' ? 'Bishop' : 'Fellenius'} = ${f(p.circ.method === 'oms' ? r.bis : r.oms, 4)}`;
    if (p.sub === 'culmann') text += ` · H_cr = ${f(r.Hcr)} ${U.len}`;
    return { ok: true, err: [], warn: r.warn, status: { cls, text }, out: r.out, steps: st.list, geo: Object.assign({ kind: 'slope', sub: p.sub }, r) };
  }

  Object.assign(P, { slope, makeSlices, fsCircle, slopeGround: ground, slopePhreatic: phreatic });
})(typeof window !== 'undefined' ? window : globalThis);
