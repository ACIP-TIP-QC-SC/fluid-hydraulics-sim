/* =====================================================================
 * Geotechnical — STEP 6: Lateral Earth Pressure & Retaining Walls (physics)
 * Rankine (horizontal or sloping backfill), Coulomb (wall friction, wall
 * batter, sloping backfill) and at-rest pressures on layered backfill with
 * surcharge, water table and tension cracks; stability of cantilever and
 * gravity walls (overturning, sliding with optional passive resistance,
 * bearing pressure under the base) with the wall split into pieces.
 * ===================================================================== */
(function (root) {
  'use strict';
  const P = root.Physics;
  const { fmt: f, Steps, fail, DEG } = P;
  const { tan, sin, cos, sqrt, PI } = Math;

  /* ---------------- coefficients (angles in radians) ---------------- */
  function kRankine(phi, beta, passive) {
    if (beta < 1e-9) return passive ? tan(PI / 4 + phi / 2) ** 2 : tan(PI / 4 - phi / 2) ** 2;
    const cb = cos(beta), r = sqrt(Math.max(0, cb * cb - cos(phi) ** 2));
    return passive ? (cb * (cb + r)) / (cb - r) : (cb * (cb - r)) / (cb + r);
  }
  function kCoulomb(phi, delta, theta, beta, passive) {
    if (!passive) {
      const r = sqrt(Math.max(0, (sin(delta + phi) * sin(phi - beta)) / (cos(delta + theta) * cos(theta - beta))));
      return cos(phi - theta) ** 2 / (cos(theta) ** 2 * cos(delta + theta) * (1 + r) ** 2);
    }
    const r = sqrt(Math.max(0, (sin(phi + delta) * sin(phi + beta)) / (cos(delta - theta) * cos(beta - theta))));
    return cos(phi + theta) ** 2 / (cos(theta) ** 2 * cos(delta - theta) * (1 - r) ** 2);
  }
  const kRest = (phi, OCR) => (1 - sin(phi)) * Math.pow(Math.max(1, OCR || 1), sin(phi));

  /** Polygon area and centroid. */
  function polyAC(pts) {
    let A = 0, cx = 0, cy = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length], c = x1 * y2 - x2 * y1;
      A += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c;
    }
    A /= 2; if (Math.abs(A) < 1e-12) return { A: 0, x: pts[0][0], y: pts[0][1] };
    return { A: Math.abs(A), x: cx / (6 * A), y: cy / (6 * A) };
  }

  /** Layer index containing elevation y; layers measured down from `ref` (layer 1 extends upward, last downward). */
  function layerAt(layers, ref, y) {
    let top = ref;
    for (let i = 0; i < layers.length; i++) { const bot = top - layers[i].H; if (y > bot - 1e-9 || i === layers.length - 1) return i; top = bot; }
    return layers.length - 1;
  }

  /**
   * Lateral pressure on a plane whose top is at elevation `top` and base at `bot`.
   * o = { layers, ref, yw, q, state ('A'|'P'|'0'), theory, beta, theta, delta, OCR, neglect, gw, qm }
   */
  function pressure(o) {
    const L = o.layers, gw = o.gw, top = o.top, bot = o.bot, H = top - bot;
    const yw = o.yw === null || o.yw === undefined ? -Infinity : Math.min(o.yw, top);
    const passive = o.state === 'P';
    const Ks = L.map((l) => {
      const phi = l.phi * DEG;
      if (o.state === '0') return kRest(phi, o.OCR);
      if (o.theory === 'coulomb') return kCoulomb(phi, o.delta * DEG, o.theta * DEG, o.beta * DEG, passive);
      return kRankine(phi, o.beta * DEG, passive);
    });
    const useC = o.state !== '0' && o.theory !== 'coulomb' && !(o.beta > 1e-9);
    const ys = [top, bot];
    let t = o.ref;
    L.forEach((l, i) => { t -= l.H; if (i < L.length - 1 && t < top - 1e-9 && t > bot + 1e-9) ys.push(t); });
    if (yw < top - 1e-9 && yw > bot + 1e-9) ys.push(yw);
    const lev = Array.from(new Set(ys.map((y) => +y.toFixed(9)))).sort((a, b) => b - a);
    const pts = [], forces = [];
    let sv = o.q * (o.qm || 1), zc = null;
    const lat = (i, s) => { const K = Ks[i], c = useC ? L[i].c : 0; return o.state === 'P' ? K * s + 2 * c * sqrt(K) : K * s - 2 * c * sqrt(K); };
    for (let k = 0; k < lev.length - 1; k++) {
      const ya = lev[k], yb = lev[k + 1], i = layerAt(L, o.ref, (ya + yb) / 2), l = L[i];
      const wet = (ya + yb) / 2 < yw;
      const ge = wet ? l.gsat - gw : l.g;
      const sva = sv, svb = sv + ge * (ya - yb);
      let ha = lat(i, sva), hb = lat(i, svb);
      const ua = gw * Math.max(0, yw - ya), ub = gw * Math.max(0, yw - yb);
      pts.push({ y: ya, z: Math.max(0, +(top - ya).toFixed(9)), sv: sva, sh: ha, u: ua, K: Ks[i], i });
      if (o.state === 'A' && ha < 0 && hb > 0) { const t0 = -ha / (hb - ha), y0 = ya - (ya - yb) * t0; pts.push({ y: y0, z: +(top - y0).toFixed(9), sv: sva + (svb - sva) * t0, sh: 0, u: ua + (ub - ua) * t0, K: Ks[i], i, crack: true }); }
      pts.push({ y: yb, z: +(top - yb).toFixed(9), sv: svb, sh: hb, u: ub, K: Ks[i], i });
      // tension zone
      const parts = [];
      if (o.state === 'A' && ha < 0 && hb > 0) {
        const y0 = ya - (ya - yb) * (-ha / (hb - ha));
        if (zc === null) zc = top - y0;
        if (o.neglect) parts.push([y0, yb, 0, hb]); else parts.push([ya, y0, ha, 0], [y0, yb, 0, hb]);
      } else if (o.state === 'A' && ha <= 0 && hb <= 0) { if (!o.neglect) parts.push([ya, yb, ha, hb]); else if (zc === null && hb < 0 && k === lev.length - 2) zc = top - yb; }
      else parts.push([ya, yb, ha, hb]);
      parts.forEach(([a, b, pa, pb]) => {
        const h = a - b; if (h < 1e-12) return;
        const rect = pa * h, tri = ((pb - pa) * h) / 2;
        if (Math.abs(rect) > 1e-9) forces.push({ P: rect, y: (a + b) / 2 - bot, kind: 'rect', i, a, b, pa, pb: pa });
        if (Math.abs(tri) > 1e-9) forces.push({ P: tri, y: b + h / 3 - bot, kind: 'tri', i, a, b, pa: 0, pb: pb - pa });
      });
      sv = svb;
    }
    const Ps = forces.reduce((s, q) => s + q.P, 0);
    const yPs = Math.abs(Ps) > 1e-12 ? forces.reduce((s, q) => s + q.P * q.y, 0) / Ps : 0;
    const hw = Math.max(0, Math.min(yw, top) - bot);
    const Pw = 0.5 * gw * hw * hw, yPw = hw / 3;
    return { pts, forces, Ps, yPs, Pw, yPw, hw, H, Ks, useC, zc, top, bot, yw };
  }

  function omega(p) {
    if (p.state === '0') return 0;
    if (p.theory === 'coulomb') return (p.state === 'P' ? p.delta - p.theta : p.delta + p.theta) * DEG;
    return p.beta * DEG;
  }

  function stepsPressure(st, p, r, U, title) {
    const L = p.layers, used = Array.from(new Set(r.pts.map((q) => q.i)));
    const nm = p.state === 'P' ? 'K_p' : p.state === '0' ? 'K₀' : 'K_a';
    let form;
    if (p.state === '0') form = 'K₀ = (1 − sin φ) OCR^(sin φ)';
    else if (p.theory === 'coulomb') form = p.state === 'P' ? 'K_p = cos²(φ+θ) / {cos²θ cos(δ−θ) [1 − √(sin(φ+δ) sin(φ+β) / (cos(δ−θ) cos(β−θ)))]²}' : 'K_a = cos²(φ−θ) / {cos²θ cos(δ+θ) [1 + √(sin(δ+φ) sin(φ−β) / (cos(δ+θ) cos(θ−β)))]²}';
    else if (p.beta > 1e-9) form = p.state === 'P' ? 'K_p = cos β (cos β + √(cos²β − cos²φ)) / (cos β − √(cos²β − cos²φ))' : 'K_a = cos β (cos β − √(cos²β − cos²φ)) / (cos β + √(cos²β − cos²φ))';
    else form = p.state === 'P' ? 'K_p = tan²(45° + φ/2)' : 'K_a = tan²(45° − φ/2)';
    const extra = p.theory === 'coulomb' && p.state !== '0' ? `, δ = ${f(p.delta)}°, θ = ${f(p.theta)}°, β = ${f(p.beta)}°` : p.beta > 1e-9 && p.state !== '0' ? `, β = ${f(p.beta)}°` : p.state === '0' && p.OCR > 1 ? `, OCR = ${f(p.OCR)}` : '';
    st.add(`${title}: earth pressure coefficient${used.length > 1 ? 's' : ''}`, form, used.map((i) => `layer ${i + 1}: φ = ${f(L[i].phi)}°${extra}`).join(';  '), used.map((i) => `${nm}${used.length > 1 ? `(${i + 1})` : ''} = ${f(r.Ks[i])}`).join(',  '), p.theory === 'coulomb' && L.some((l) => l.c > 0) ? 'Coulomb’s solution is for cohesionless soil; c is ignored.' : p.beta > 1e-9 && p.theory === 'rankine' && L.some((l) => l.c > 0) ? 'For a sloping backfill c is ignored and the pressure acts parallel to the slope.' : '');
    const sgn = p.state === 'P' ? '+' : '−';
    const fm = r.useC ? `σ′h = K σ′v ${sgn} 2c√K,  u = γw h_w,  σ_h = σ′h + u` : 'σ′h = K σ′v,  u = γw h_w,  σ_h = σ′h + u';
    const rows = r.pts.filter((q, k) => k === 0 || Math.abs(q.sh - r.pts[k - 1].sh) > 1e-9 || Math.abs(q.y - r.pts[k - 1].y) > 1e-9 || Math.abs(q.u - r.pts[k - 1].u) > 1e-9);
    st.add('Pressures at the breakpoints (depth z below the top of the plane)', fm + (p.q > 0 ? `;  σ′v starts at q = ${f(p.q * (r.qm || 1))}` : ''), rows.map((q) => `z = ${f(q.z)} (layer ${q.i + 1}): σ′v = ${f(q.sv)}, σ′h = ${f(q.sh)}, u = ${f(q.u)}`).join(';  '), U.press, r.zc !== null && p.state === 'A' ? `Tension crack depth z_c = ${f(r.zc)} ${U.len}${p.neglect ? ' (tension zone neglected)' : ''}` : '');
    st.add('Resultant of the soil pressure (sum of rectangles and triangles)', 'P = Σ area,  ȳ = Σ P_i y_i / Σ P_i (above the base)', r.forces.map((q, k) => `P${k + 1} = ${f(q.P)} @ ${f(q.y)}`).join(';  '), `P_soil = ${f(r.Ps)} ${U.fpl} at ȳ = ${f(r.yPs)} ${U.len}`);
    if (r.Pw > 0) st.add('Water pressure', 'P_w = ½ γw h_w²  at  h_w / 3', `P_w = ½ × ${f(p.gw)} × ${f(r.hw)}²`, `P_w = ${f(r.Pw)} ${U.fpl} at ${f(r.yPw)} ${U.len}`);
  }

  /* ---------------- wall geometry ---------------- */
  function wallGeom(w) {
    const { t1, bf, bb, Lt, Lh, tb, Hs } = w;
    const H = Hs + tb, xs = Lt + bf + t1, xsb = xs + bb, B = xsb + Lh;
    const conc = [];
    conc.push({ name: 'stem', poly: [[Lt + bf, tb], [xs, tb], [xs, H], [Lt + bf, H]] });
    if (bf > 1e-9) conc.push({ name: 'front batter', poly: [[Lt, tb], [Lt + bf, tb], [Lt + bf, H]] });
    if (bb > 1e-9) conc.push({ name: 'back batter', poly: [[xs, tb], [xsb, tb], [xs, H]] });
    conc.push({ name: 'base', poly: [[0, 0], [B, 0], [B, tb], [0, tb]] });
    const outline = [[0, 0], [B, 0], [B, tb], [xsb, tb], [xs, H], [Lt + bf, H], [Lt, tb], [0, tb]];
    return { H, xs, xsb, B, conc, outline };
  }

  function retaining(p, U, st) {
    const out = [], warn = [];
    const w = p.wall, gw = U.gw, L = p.layers;
    const g = wallGeom(w);
    if (!(w.Hs > 0 && w.tb > 0 && w.t1 > 0 && g.B > 0)) return { err: ['Wall dimensions must be positive.'] };
    const theory = p.theory, beta = theory === 'rest' ? 0 : p.beta;
    if (p.theory === 'rest' && p.beta > 0) warn.push('At-rest pressure is computed for a level backfill; β is ignored.');
    const yw = p.wt ? g.H - p.zw : null;
    let plane, theta = 0;
    if (theory === 'coulomb') { theta = Math.atan((g.B - g.xs) / g.H); plane = { top: g.H, bot: 0, xTop: g.xs, xBot: g.B }; }
    else { const ys = g.H + (g.B - g.xs) * tan(beta * DEG); plane = { top: ys, bot: 0, xTop: g.B, xBot: g.B }; }
    const th = theta / DEG;
    const qm = theory === 'coulomb' ? (cos(theta) * cos(beta * DEG)) / cos(theta - beta * DEG) : 1;
    const pp = { top: plane.top, bot: 0, layers: L, ref: g.H, yw, q: p.q, state: theory === 'rest' ? '0' : 'A', theory: theory === 'rest' ? 'rankine' : theory, beta, theta: th, delta: p.delta, OCR: p.OCR, neglect: p.neglect, gw, qm };
    if (theory === 'coulomb') st.add('Coulomb plane: from the heel bottom to the top of the stem back', 'θ = atan[(B − x_s) / H]  (from the vertical)', `θ = atan(${f(g.B - g.xs)} / ${f(g.H)})`, `θ = ${f(th)}°,  δ = ${f(p.delta)}°`, 'The soil between this plane and the wall moves with the wall.');
    else st.add('Rankine: pressure on the vertical plane through the heel', beta > 1e-9 ? 'H′ = H + (B − x_s) tan β' : 'H′ = H', beta > 1e-9 ? `H′ = ${f(g.H)} + ${f(g.B - g.xs)} tan ${f(beta)}°` : `H′ = ${f(g.H)}`, `H′ = ${f(plane.top)} ${U.len}`, 'The soil above the heel moves with the wall and counts as resisting weight.');
    const r = pressure(pp); r.qm = qm;
    stepsPressure(st, Object.assign({}, pp, { gw }), r, U, theory === 'coulomb' ? 'Coulomb active' : theory === 'rest' ? 'At rest' : 'Rankine active');
    const om = theory === 'coulomb' ? (p.delta + th) * DEG : theory === 'rest' ? 0 : beta * DEG;
    const Ph = r.Ps * cos(om), Pv = r.Ps * sin(om);
    const xPv = theory === 'coulomb' ? g.B - r.yPs * tan(theta) : g.B;
    if (om > 1e-9) st.add('Components of the soil thrust', `P_h = P cos ω,  P_v = P sin ω  (ω = ${theory === 'coulomb' ? 'δ + θ' : 'β'})`, `ω = ${f(om / DEG)}°`, `P_h = ${f(Ph)},  P_v = ${f(Pv)} ${U.fpl}`, `P_v acts at x = ${f(xPv)} ${U.len} from the toe.`);
    const Pwh = r.Pw, Pwv = theory === 'coulomb' ? r.Pw * tan(theta) : 0, xPwv = g.B - r.yPw * tan(theta);
    // pieces
    const pieces = [];
    g.conc.forEach((c) => { const a = polyAC(c.poly); pieces.push({ name: c.name, kind: 'conc', poly: c.poly, A: a.A, x: a.x, y: a.y, g: p.gc, W: a.A * p.gc }); });
    const gAt = (y) => { const i = layerAt(L, g.H, y); return yw !== null && y < yw ? L[i].gsat : L[i].g; };
    const soilPoly = (name, poly) => { const a = polyAC(poly); if (a.A < 1e-9) return; const gg = gAt(a.y); pieces.push({ name, kind: 'soil', poly, A: a.A, x: a.x, y: a.y, g: gg, W: a.A * gg }); };
    if (theory === 'coulomb') {
      const xp = g.B - w.tb * tan(theta);
      if (xp > g.xsb + 1e-9) soilPoly('soil wedge', [[g.xs, g.H], [g.xsb, w.tb], [xp, w.tb]]);
      else warn.push('The Coulomb plane passes inside the wall; no soil wedge is added.');
    } else {
      if (w.bb > 1e-9) soilPoly('soil on back batter', [[g.xs, g.H], [g.xsb, w.tb], [g.xsb, g.H]]);
      if (w.Lh > 1e-9) {
        const cuts = [g.H]; let t = g.H; L.forEach((l, i) => { t -= l.H; if (i < L.length - 1 && t < g.H - 1e-9 && t > w.tb + 1e-9) cuts.push(t); });
        if (yw !== null && yw < g.H - 1e-9 && yw > w.tb + 1e-9) cuts.push(yw);
        cuts.push(w.tb); const cs = Array.from(new Set(cuts)).sort((a, b) => b - a);
        for (let k = 0; k < cs.length - 1; k++) soilPoly(cs.length > 2 ? `soil over heel ${String.fromCharCode(97 + k)}` : 'soil over heel', [[g.xsb, cs[k + 1]], [g.B, cs[k + 1]], [g.B, cs[k]], [g.xsb, cs[k]]]);
      }
      if (beta > 1e-9) soilPoly('sloping soil', [[g.xs, g.H], [g.B, g.H], [g.B, plane.top]]);
    }
    pieces.forEach((q, k) => { q.n = k + 1; q.M = q.W * q.x; });
    st.add('Weights of the pieces and their moments about the toe', 'W = γ A (per unit length),  M = W x̄', pieces.map((q) => `${q.n} ${q.name}: A = ${f(q.A)}, W = ${f(q.g)} × ${f(q.A)} = ${f(q.W)}, x̄ = ${f(q.x)}, M = ${f(q.M)}`).join(';  '), `ΣW = ${f(pieces.reduce((s, q) => s + q.W, 0))} ${U.fpl},  ΣM = ${f(pieces.reduce((s, q) => s + q.M, 0))} ${U.mom}/${U.len}`, `Concrete γ_c = ${f(p.gc)} ${U.gamma}; soil uses γ above the water table and γ_sat below it.`);
    // uplift
    let Uup = 0, xU = 0, uh = 0;
    if (p.uplift && yw !== null && yw > 0) { uh = gw * yw; Uup = 0.5 * uh * g.B; xU = (2 * g.B) / 3; st.add('Uplift on the base (drained at the toe)', 'U = ½ u_heel B,  at 2B/3 from the toe', `u_heel = ${f(gw)} × ${f(yw)} = ${f(uh)};  U = ½ × ${f(uh)} × ${f(g.B)}`, `U = ${f(Uup)} ${U.fpl}`); }
    const SW = pieces.reduce((s, q) => s + q.W, 0), SMw = pieces.reduce((s, q) => s + q.M, 0);
    const V = SW + Pv + Pwv - Uup;
    const MR = SMw + Pv * xPv + Pwv * xPwv;
    const MO = Ph * r.yPs + Pwh * r.yPw + Uup * xU;
    const FSo = MO > 0 ? MR / MO : Infinity;
    st.add('Overturning about the toe', 'FS_OT = ΣM_R / ΣM_O  (≥ 2)', `ΣM_R = ${f(SMw)}${Pv > 0 ? ` + ${f(Pv)}×${f(xPv)}` : ''}${Pwv > 0 ? ` + ${f(Pwv)}×${f(xPwv)}` : ''} = ${f(MR)};  ΣM_O = ${f(Ph)}×${f(r.yPs)}${Pwh > 0 ? ` + ${f(Pwh)}×${f(r.yPw)}` : ''}${Uup > 0 ? ` + ${f(Uup)}×${f(xU)}` : ''} = ${f(MO)}`, `FS_OT = ${f(FSo)}`, FSo >= 2 ? 'OK' : 'Less than 2: the wall may overturn.');
    // sliding
    const fd = p.found, phi2 = fd.phi * DEG, Kp = kRankine(phi2, 0, true);
    let Pp = 0, yPp = 0;
    if (fd.Df > 0) {
      const p1 = 0.5 * Kp * fd.g * fd.Df * fd.Df, p2 = 2 * fd.c * sqrt(Kp) * fd.Df;
      Pp = p1 + p2; yPp = Pp > 0 ? (p1 * fd.Df / 3 + p2 * fd.Df / 2) / Pp : 0;
    }
    const usePp = p.passive && Pp > 0;
    if (fd.Df > 0) st.add('Passive resistance in front of the toe (Rankine)', 'K_p = tan²(45° + φ₂/2);  P_p = ½ K_p γ₂ D² + 2 c₂ √K_p D', `K_p = ${f(Kp)};  P_p = ½ × ${f(Kp)} × ${f(fd.g)} × ${f(fd.Df)}² + 2 × ${f(fd.c)} × √${f(Kp)} × ${f(fd.Df)}`, `P_p = ${f(Pp)} ${U.fpl}${usePp ? '' : ' (not counted)'}`, usePp ? '' : 'Often neglected because the front soil may be removed or eroded.');
    const tanb = tan(fd.k1 * phi2), adh = g.B * fd.k2 * fd.c;
    const Fr = V * tanb + adh + (usePp ? Pp : 0), Fd = Ph + Pwh;
    const FSs = Fd > 0 ? Fr / Fd : Infinity;
    st.add('Sliding along the base', 'FS_s = [ΣV tan(k₁φ₂) + B k₂ c₂ + P_p] / ΣP_h  (≥ 1.5)', `ΣV = ${f(V)};  ${f(V)} × tan(${f(fd.k1)}×${f(fd.phi)}°) + ${f(g.B)} × ${f(fd.k2)} × ${f(fd.c)}${usePp ? ` + ${f(Pp)}` : ''} = ${f(Fr)};  ΣP_h = ${f(Fd)}`, `FS_s = ${f(FSs)}`, FSs >= 1.5 ? 'OK' : 'Less than 1.5: add a shear key, widen the base or count passive resistance.');
    // bearing
    const xR = (MR - MO) / V, e = g.B / 2 - xR;
    let qt, qh, qmax;
    if (Math.abs(e) <= g.B / 6) { qt = (V / g.B) * (1 + (6 * e) / g.B); qh = (V / g.B) * (1 - (6 * e) / g.B); qmax = Math.max(qt, qh); }
    else { const a = 3 * (g.B / 2 - Math.abs(e)); qmax = (2 * V) / a; if (e > 0) { qt = qmax; qh = 0; } else { qh = qmax; qt = 0; } warn.push('The resultant falls outside the middle third: part of the base lifts off.'); }
    st.add('Bearing pressure under the base', 'x̄ = (ΣM_R − ΣM_O)/ΣV,  e = B/2 − x̄;  q = (ΣV/B)(1 ± 6e/B)', `x̄ = (${f(MR)} − ${f(MO)}) / ${f(V)} = ${f(xR)};  e = ${f(g.B / 2)} − ${f(xR)} = ${f(e)}  (B/6 = ${f(g.B / 6)})`, `q_toe = ${f(qt)},  q_heel = ${f(qh)} ${U.press}`, Math.abs(e) > g.B / 6 ? 'e > B/6: q_max = 2ΣV / [3(B/2 − e)] and the heel side lifts off.' : 'e ≤ B/6: the whole base is in compression.');
    const FSb = fd.qu > 0 && qmax > 0 ? fd.qu / qmax : null;
    if (FSb !== null) st.add('Bearing capacity check', 'FS_b = q_u / q_max  (≥ 3)', `FS_b = ${f(fd.qu)} / ${f(qmax)}`, `FS_b = ${f(FSb)}`, FSb >= 3 ? 'OK' : 'Less than 3.');
    out.push({ k: 'Soil thrust P (resultant)', v: r.Ps, u: U.fpl, hl: true }, { k: 'Acting at ȳ above the base', v: r.yPs, u: U.len });
    if (Pwh > 0) out.push({ k: 'Water thrust P_w', v: Pwh, u: U.fpl });
    out.push({ k: 'FS against overturning', v: FSo, u: '', hl: true }, { k: 'FS against sliding', v: FSs, u: '', hl: true });
    if (FSb !== null) out.push({ k: 'FS bearing (q_u / q_max)', v: FSb, u: '', hl: true });
    out.push({ k: 'Eccentricity e', v: e, u: U.len }, { k: 'q at toe / heel', v: `${f(qt)} / ${f(qh)}`, u: U.press }, { k: 'ΣV / ΣM_R / ΣM_O', v: `${f(V)} / ${f(MR)} / ${f(MO)}`, u: '' });
    return { out, warn, r, g, plane, theta: th, om, Ph, Pv, xPv, Pwh, Pwv, xPwv, pieces, Uup, uh, xU, V, MR, MO, FSo, FSs, FSb, e, qt, qh, qmax, Pp, yPp, usePp, Kp, yw, beta };
  }

  function pressureOnly(p, U, st) {
    const out = [], warn = [];
    const H = p.H; if (!(H > 0)) return { err: ['Wall height must be positive.'] };
    const theory = p.state === '0' ? 'rankine' : p.theory, beta = p.state === '0' ? 0 : p.beta, theta = theory === 'coulomb' ? p.theta : 0;
    if (theory === 'rankine' && beta > 0) { if (p.layers.some((l) => beta >= l.phi)) return { err: ['The backfill slope β must be smaller than φ.'] }; }
    if (theory === 'coulomb' && p.delta > Math.min(...p.layers.map((l) => l.phi)) + 1e-9) warn.push('Wall friction δ is normally not larger than φ.');
    const yw = p.wt ? H - p.zw : null;
    const qm = theory === 'coulomb' ? (cos(theta * DEG) * cos(beta * DEG)) / cos((theta - beta) * DEG) : 1;
    const pp = { layers: p.layers, ref: H, yw, q: p.q, state: p.state, theory, beta, theta, delta: p.delta, OCR: p.OCR, neglect: p.neglect, gw: U.gw, qm, top: H, bot: 0 };
    const r = pressure(pp); r.qm = qm;
    const nm = p.state === 'P' ? 'Passive' : p.state === '0' ? 'At-rest' : 'Active';
    stepsPressure(st, pp, r, U, `${nm} (${p.state === '0' ? 'K₀' : theory === 'coulomb' ? 'Coulomb' : 'Rankine'})`);
    const om = p.state === '0' ? 0 : theory === 'coulomb' ? (p.state === 'P' ? p.delta - theta : p.delta + theta) * DEG : beta * DEG;
    const Ph = r.Ps * cos(om), Pv = r.Ps * sin(om);
    const Ptot = Ph + r.Pw, yT = Ptot > 0 ? (Ph * r.yPs + r.Pw * r.yPw) / Ptot : 0;
    if (om > 1e-9 || r.Pw > 0) st.add('Total horizontal thrust on the wall', 'ΣP_h = P cos ω + P_w,  ȳ = Σ P y / Σ P', `ω = ${f(om / DEG)}°:  ${f(r.Ps)} cos ${f(om / DEG)}° + ${f(r.Pw)}`, `ΣP_h = ${f(Ptot)} ${U.fpl} at ȳ = ${f(yT)} ${U.len}`, om > 1e-9 ? `Vertical component P_v = ${f(Pv)} ${U.fpl}` : '');
    out.push({ k: p.state === 'P' ? 'Passive thrust P_p (soil)' : p.state === '0' ? 'At-rest thrust P₀ (soil)' : 'Active thrust P_a (soil)', v: r.Ps, u: U.fpl, hl: true }, { k: 'Acting at ȳ above the base', v: r.yPs, u: U.len, hl: true });
    r.Ks.forEach((K, i) => { if (r.pts.some((q) => q.i === i)) out.push({ k: `${p.state === 'P' ? 'K_p' : p.state === '0' ? 'K₀' : 'K_a'}${p.layers.length > 1 ? ` (layer ${i + 1})` : ''}`, v: K, u: '' }); });
    if (r.Pw > 0) out.push({ k: 'Water thrust P_w', v: r.Pw, u: U.fpl }, { k: 'Total horizontal thrust', v: Ptot, u: U.fpl, hl: true }, { k: 'Total thrust acts at', v: yT, u: U.len });
    if (om > 1e-9) out.push({ k: 'Horizontal / vertical components', v: `${f(Ph)} / ${f(Pv)}`, u: U.fpl });
    if (r.zc !== null && p.state === 'A') out.push({ k: 'Tension crack depth z_c', v: r.zc, u: U.len });
    const bot = r.pts[r.pts.length - 1];
    out.push({ k: 'σ′h / u at the base', v: `${f(bot.sh)} / ${f(bot.u)}`, u: U.press });
    return { out, warn, r, H, om, Ph, Pv, Ptot, yT, theta, beta, yw };
  }

  function lateral(p, U) {
    const st = Steps(), pre = [];
    if (p.layers.some((l) => l.src && l.src !== 'gamma')) {
      p = Object.assign({}, p, { layers: p.layers.map((l, i) => {
        if (!l.src || l.src === 'gamma') return l;
        const g = P.layerUW(l, l.src, U.gw), t = P.layerUWtext(l, l.src, U.gw, g);
        st.add(`Layer ${i + 1}: unit weights from the soil data`, t[0], t[1], `γ = ${f(g.gm)},  γ_sat = ${f(g.gsat)} ${U.gamma}${g.e !== undefined && l.src === 'gsw' ? `,  e = ${f(g.e)}` : ''}`);
        pre.push({ k: `Layer ${i + 1}: γ / γ_sat`, v: `${f(g.gm)} / ${f(g.gsat)}`, u: U.gamma });
        return Object.assign({}, l, { g: g.gm, gsat: g.gsat });
      }) });
    }
    if (p.kInv && p.sub === 'press' && p.state !== '0') {
      const K = p.Kg, pas = p.state === 'P';
      if (!(K > 0) || (pas ? K <= 1 : K >= 1)) return fail([pas ? 'K_p must be larger than 1.' : 'K_a must be between 0 and 1.']);
      const phi = pas ? 2 * Math.atan(sqrt(K)) / DEG - 90 : 90 - 2 * Math.atan(sqrt(K)) / DEG;
      st.add('Friction angle from the earth pressure coefficient', pas ? 'K_p = tan²(45° + φ/2)  →  φ = 2 tan⁻¹√K_p − 90°' : 'K_a = tan²(45° − φ/2)  →  φ = 90° − 2 tan⁻¹√K_a', `${pas ? 'K_p' : 'K_a'} = ${f(K)}`, `φ = ${f(phi)}°`, pas ? `Same as sin φ = (K_p − 1)/(K_p + 1); K_a = 1/K_p = ${f(1 / K)}.` : `Same as sin φ = (1 − K_a)/(1 + K_a); K_p = 1/K_a = ${f(1 / K)}.`);
      pre.unshift({ k: 'Friction angle φ', v: phi, u: '°', hl: true });
      p = Object.assign({}, p, { theory: 'rankine', beta: 0, layers: p.layers.map((l) => Object.assign({}, l, { phi })) });
    }
    if (!p.layers.length || p.layers.some((l) => !(l.H > 0) || !(l.g > 0))) return fail(['Each layer needs a positive thickness and unit weight.']);
    if (p.layers.some((l) => !(l.phi >= 0 && l.phi < 60))) return fail(['φ must be between 0° and 60°.']);
    if (p.sub === 'wall' && p.theory === 'rankine' && p.beta > 0 && p.layers.some((l) => p.beta >= l.phi)) return fail(['The backfill slope β must be smaller than φ.']);
    const r = p.sub === 'wall' ? retaining(p, U, st) : pressureOnly(p, U, st);
    if (r.err) return fail(r.err);
    let cls = 'ok', text;
    if (p.sub === 'wall') {
      const min = Math.min(r.FSo / 2, r.FSs / 1.5, r.FSb === null ? 9 : r.FSb / 3);
      cls = min < 1 ? 'bad' : min < 1.1 ? 'warn' : 'ok';
      text = `FS overturning ${f(r.FSo, 3)} · sliding ${f(r.FSs, 3)}${r.FSb !== null ? ` · bearing ${f(r.FSb, 3)}` : ''}`;
    } else text = `P = ${f(r.r.Ps)} ${U.fpl} at ${f(r.r.yPs)} ${U.len}${r.r.Pw > 0 ? ` · P_w = ${f(r.r.Pw)}` : ''}`;
    return { ok: true, err: [], warn: r.warn, status: { cls, text }, out: pre.concat(r.out), steps: st.list, geo: Object.assign({ kind: 'lat', sub: p.sub, layersU: p.layers }, r) };
  }

  Object.assign(P, { lateral, kRankine, kCoulomb, kRest, latPressure: pressure, wallGeom, polyArea: polyAC });
})(typeof window !== 'undefined' ? window : globalThis);
