/* =====================================================================
 * Geotechnical — STEP 1: Permeability & Seepage (physics)
 *  - Constant head and falling head permeability tests
 *  - Equivalent permeability of layered soil (horizontal and vertical)
 *  - Flow nets under a sheet pile or a concrete dam (with cut-offs),
 *    solved numerically on a finite-volume grid (Laplace equation), with
 *    seepage quantity, uplift, pore pressure at a point, exit gradient,
 *    and the quick (boiling) / heave checks.
 * ===================================================================== */
(function (root) {
  'use strict';
  const P = root.Physics;
  const { fmt: f, Steps, fail, PI, log10 } = P;

  /* ------------------------------------------------------------------ */
  /* Laboratory tests                                                   */
  /* ------------------------------------------------------------------ */
  function labCommon(p, U, st, k, A, L) {
    const out = [], warn = [];
    // temperature correction to 20 °C
    let k20 = k;
    if (p.temp) {
      const r = P.waterViscosity(p.T) / P.waterViscosity(20);
      k20 = k * r;
      st.add('Correct k to 20 °C', 'k₂₀ = k_T (η_T / η₂₀)', `η_T/η₂₀ = ${f(P.waterViscosity(p.T) * 1000)} / ${f(P.waterViscosity(20) * 1000)} = ${f(r)};  k₂₀ = ${f(k)} × ${f(r)}`, `k₂₀ = ${f(k20)} ${U.kLab}`, 'Viscosity of water from the Vogel equation (within about 1 % of standard tables).');
      out.push({ k: 'k corrected to 20 °C', v: k20, u: U.kLab, hl: true });
    }
    if (U.id === 'SI') {
      out.push({ k: 'k in m/s', v: k * 0.01, u: 'm/s' });
      out.push({ k: 'k in m/day', v: k * 0.01 * 86400, u: 'm/day' });
    } else {
      out.push({ k: 'k in ft/min', v: k * 5, u: 'ft/min' });
      out.push({ k: 'k in ft/day', v: k * 5 * 1440, u: 'ft/day' });
    }
    return { out, warn, k20 };
  }

  function constHead(p, U) {
    const st = Steps(), err = [], out = [];
    const { L, D, h, t } = p;
    if (!(L > 0) || !(D > 0) || !(h > 0) || !(t > 0)) return fail(['Length, diameter, head and time must be positive.']);
    const A = (PI * D * D) / 4;
    st.add('Cross-sectional area of the specimen', 'A = π D² / 4', `A = π × ${f(D)}² / 4`, `A = ${f(A)} ${U.areaS}`);
    const i = h / L;
    st.add('Hydraulic gradient', 'i = h / L', `i = ${f(h)} / ${f(L)}`, `i = ${f(i)}`, 'The head difference h is kept constant across the specimen of length L.');
    let k, Q;
    if (p.solve === 'Q') {
      k = p.k; if (!(k > 0)) return fail(['k must be positive.']);
      Q = (k * A * h * t) / L;
      st.add('Volume of water collected (Darcy’s law)', 'Q = k i A t = k A h t / L', `Q = ${f(k)} × ${f(A)} × ${f(h)} × ${f(t)} / ${f(L)}`, `Q = ${f(Q)} ${U.volS}`);
    } else {
      Q = p.Q; if (!(Q > 0)) return fail(['The collected volume must be positive.']);
      k = (Q * L) / (A * h * t);
      st.add('Coefficient of permeability (Darcy’s law)', 'k = Q L / (A h t)', `k = ${f(Q)} × ${f(L)} / (${f(A)} × ${f(h)} × ${f(t)})`, `k = ${f(k)} ${U.kLab}`, 'From Q = k i A t with i = h/L.');
    }
    const v = k * i;
    st.add('Discharge (Darcy) velocity', 'v = k i', `v = ${f(k)} × ${f(i)}`, `v = ${f(v)} ${U.velS}`);
    out.push({ k: 'Coefficient of permeability k', v: k, u: U.kLab, hl: p.solve !== 'Q' });
    if (p.solve === 'Q') out.push({ k: 'Volume collected Q', v: Q, u: U.volS, hl: true });
    out.push({ k: 'Area A', v: A, u: U.areaS }, { k: 'Hydraulic gradient i', v: i, u: '' }, { k: 'Discharge velocity v', v, u: U.velS });
    out.push({ k: 'Flow rate q = Q/t', v: Q / t, u: U.volS + '/s' });
    let vs = null, n = null;
    if (p.useE) {
      n = p.e / (1 + p.e); vs = v / n;
      st.add('Seepage velocity', 'n = e/(1+e);  v_s = v / n', `n = ${f(p.e)}/(1+${f(p.e)}) = ${f(n)};  v_s = ${f(v)} / ${f(n)}`, `v_s = ${f(vs)} ${U.velS}`, 'Water moves only through the voids, so it travels faster than v.');
      out.push({ k: 'Porosity n', v: n, u: '' }, { k: 'Seepage velocity v_s', v: vs, u: U.velS });
    }
    const c = labCommon(p, U, st, k, A, L);
    out.push(...c.out);
    const warn = [];
    if (k > 1) warn.push('k above 1 cm/s is typical of clean gravel; check the inputs.');
    return { ok: true, err, warn, status: { cls: 'ok', text: `k = ${f(k)} ${U.kLab}` }, out, steps: st.list, geo: { kind: 'const', L, D, h, A, Q, t, k, i, v } };
  }

  function fallingHead(p, U) {
    const st = Steps(), out = [];
    const { L, D, d, h1 } = p;
    if (!(L > 0) || !(D > 0) || !(d > 0) || !(h1 > 0)) return fail(['Length, diameters and the initial head must be positive.']);
    const A = (PI * D * D) / 4, a = (PI * d * d) / 4;
    st.add('Areas of the specimen and the standpipe', 'A = π D²/4,  a = π d²/4', `A = π × ${f(D)}²/4,  a = π × ${f(d)}²/4`, `A = ${f(A)} ${U.areaS},  a = ${f(a)} ${U.areaS}`);
    st.add('Falling head equation', 'k = (a L / (A t)) ln(h₁/h₂) = 2.303 (a L / (A t)) log₁₀(h₁/h₂)', '', '', 'From −a dh/dt = k (h/L) A, integrated from h₁ at t = 0 to h₂ at time t.');
    let k, t, h2;
    if (p.solve === 't') {
      k = p.k; h2 = p.h2;
      if (!(k > 0) || !(h2 > 0) || !(h2 < h1)) return fail(['Need k > 0 and 0 < h₂ < h₁.']);
      t = ((a * L) / (A * k)) * Math.log(h1 / h2);
      st.add('Time for the head to fall from h₁ to h₂', 't = (a L / (A k)) ln(h₁/h₂)', `t = (${f(a)} × ${f(L)} / (${f(A)} × ${f(k)})) × ln(${f(h1)}/${f(h2)})`, `t = ${f(t)} s  (${f(t / 60)} min)`);
    } else if (p.solve === 'h2') {
      k = p.k; t = p.t;
      if (!(k > 0) || !(t > 0)) return fail(['Need k > 0 and t > 0.']);
      h2 = h1 * Math.exp((-k * A * t) / (a * L));
      st.add('Head after time t', 'h₂ = h₁ exp(−k A t / (a L))', `h₂ = ${f(h1)} × exp(−${f(k)} × ${f(A)} × ${f(t)} / (${f(a)} × ${f(L)}))`, `h₂ = ${f(h2)} ${U.lenS}`);
    } else {
      t = p.t; h2 = p.h2;
      if (!(t > 0) || !(h2 > 0) || !(h2 < h1)) return fail(['Need t > 0 and 0 < h₂ < h₁.']);
      k = ((a * L) / (A * t)) * Math.log(h1 / h2);
      st.add('Coefficient of permeability', 'k = 2.303 (a L / (A t)) log₁₀(h₁/h₂)', `k = 2.303 × (${f(a)} × ${f(L)} / (${f(A)} × ${f(t)})) × log₁₀(${f(h1)}/${f(h2)})`, `k = ${f(k)} ${U.kLab}`);
    }
    out.push({ k: 'Coefficient of permeability k', v: k, u: U.kLab, hl: p.solve === 'k' });
    if (p.solve === 't') out.push({ k: 'Time t', v: t, u: 's', hl: true }, { k: 'Time t', v: t / 60, u: 'min' });
    if (p.solve === 'h2') out.push({ k: 'Final head h₂', v: h2, u: U.lenS, hl: true });
    out.push({ k: 'Specimen area A', v: A, u: U.areaS }, { k: 'Standpipe area a', v: a, u: U.areaS }, { k: 'Ratio a/A', v: a / A, u: '' });
    const hm = Math.sqrt(h1 * h2);
    st.add('Head halfway in time', 'h_mid = √(h₁ h₂)', `h_mid = √(${f(h1)} × ${f(h2)})`, `h_mid = ${f(hm)} ${U.lenS}`, 'The head falls exponentially, so at t/2 it equals the geometric mean of h₁ and h₂.');
    out.push({ k: 'Head at t/2', v: hm, u: U.lenS });
    const c = labCommon(p, U, st, k, A, L);
    out.push(...c.out);
    const tau = (a * L) / (A * k);
    const curve = []; const tEnd = Math.max(t * 1.25, 1e-9);
    for (let j = 0; j <= 80; j++) { const tt = (tEnd * j) / 80; curve.push([tt, h1 * Math.exp(-tt / tau)]); }
    return { ok: true, err: [], warn: c.warn, status: { cls: 'ok', text: p.solve === 't' ? `t = ${f(t)} s` : p.solve === 'h2' ? `h₂ = ${f(h2)} ${U.lenS}` : `k = ${f(k)} ${U.kLab}` }, out, steps: st.list, geo: { kind: 'fall', L, D, d, A, a, h1, h2, t, k, curve } };
  }

  /* ------------------------------------------------------------------ */
  /* Layered soil                                                       */
  /* ------------------------------------------------------------------ */
  function layered(p, U) {
    const st = Steps(), out = [], warn = [];
    const L = p.layers;
    if (!L.length) return fail(['Add at least one layer.']);
    if (L.some((l) => !(l.H > 0))) return fail(['Every layer needs a positive thickness.']);
    if (L.some((l) => !(l.k > 0) || (p.aniso && !(l.kv > 0)))) return fail(['Every layer needs a positive k.']);
    const kh = (l) => l.k, kv = (l) => (p.aniso ? l.kv : l.k);
    const H = L.reduce((s, l) => s + l.H, 0);
    const sumKH = L.reduce((s, l) => s + kh(l) * l.H, 0);
    const kH = sumKH / H;
    const sumHk = L.reduce((s, l) => s + l.H / kv(l), 0);
    const kV = H / sumHk;
    const ku = U.kField;
    st.add('Total thickness', 'H = Σ Hᵢ', `H = ${L.map((l) => f(l.H)).join(' + ')}`, `H = ${f(H)} ${U.len}`);
    st.add('Equivalent horizontal permeability (flow parallel to the layers)', 'k_H = Σ(kᵢ Hᵢ) / H', `k_H = (${L.map((l) => `${f(kh(l))}×${f(l.H)}`).join(' + ')}) / ${f(H)}`, `k_H = ${f(kH)} ${ku}`, 'Same gradient in every layer; the flows add up.');
    st.add('Equivalent vertical permeability (flow across the layers)', 'k_V = H / Σ(Hᵢ / kᵢ)', `k_V = ${f(H)} / (${L.map((l) => `${f(l.H)}/${f(kv(l))}`).join(' + ')})`, `k_V = ${f(kV)} ${ku}`, 'Same flow through every layer; the head losses add up.');
    st.add('Anisotropy ratio', 'k_H / k_V', `${f(kH)} / ${f(kV)}`, `k_H / k_V = ${f(kH / kV)}`, 'For layered soil k_H is always at least k_V.');
    out.push({ k: 'Total thickness H', v: H, u: U.len }, { k: 'Equivalent k_H', v: kH, u: ku, hl: true }, { k: 'Equivalent k_V', v: kV, u: ku, hl: true }, { k: 'k_H / k_V', v: kH / kV, u: '' });
    // vertical flow with total head loss dh
    const dh = p.dh, kb = U.kToBase;
    const v = kV * kb * (dh / H);
    const per = L.map((l) => { const hl = (v * l.H) / (kv(l) * kb); return { hl, i: hl / l.H }; });
    if (dh > 0) {
      st.add('Vertical flow: discharge velocity', 'v = k_V (Δh / H)', `v = ${f(kV * kb)} × (${f(dh)} / ${f(H)})`, `v = ${f(v)} ${U.len}/s`, `k in base units: ${f(kV)} ${ku} = ${f(kV * kb)} ${U.len}/s. The same v passes through every layer.`);
      st.add('Head loss in each layer', 'Δhᵢ = v Hᵢ / kᵢ  (gradient iᵢ = Δhᵢ / Hᵢ)', L.map((l, j) => `Δh${j + 1} = ${f(v)} × ${f(l.H)} / ${f(kv(l) * kb)} = ${f(per[j].hl)}`).join(';  '), `Σ Δhᵢ = ${f(per.reduce((s, q) => s + q.hl, 0))} ${U.len} = Δh ✓`);
      out.push({ k: 'Vertical discharge velocity v', v, u: `${U.len}/s` }, { k: 'Vertical flow per unit area', v: v * U.perDay, u: `${U.len}³/day per ${U.len}²` });
      per.forEach((q, j) => out.push({ k: `Layer ${j + 1}: head loss (gradient)`, v: q.hl, u: `${U.len}  (i = ${f(q.i)})` }));
    }
    const ih = p.ih;
    const qh = kH * kb * ih * H;
    if (ih > 0) {
      st.add('Horizontal flow per unit width', 'q = k_H i H', `q = ${f(kH * kb)} × ${f(ih)} × ${f(H)}`, `q = ${f(qh)} ${U.qpl}  (${f(qh * U.perDay)} ${U.qplDay})`);
      const shares = L.map((l) => (kh(l) * l.H) / sumKH);
      st.add('Share of the horizontal flow carried by each layer', 'qᵢ / q = kᵢ Hᵢ / Σ(k H)', shares.map((s, j) => `layer ${j + 1}: ${f(100 * s, 3)} %`).join(',  '), '');
      out.push({ k: 'Horizontal flow q', v: qh, u: U.qpl }, { k: 'Horizontal flow q', v: qh * U.perDay, u: U.qplDay });
    }
    const kmax = Math.max(...L.map(kh)), kmin = Math.min(...L.map(kv));
    if (kmax / kmin > 1e4) warn.push('Layer permeabilities differ by more than 10⁴: vertical flow is controlled by the least permeable layer.');
    return { ok: true, err: [], warn, status: { cls: 'ok', text: `k_H = ${f(kH)},  k_V = ${f(kV)} ${ku}` }, out, steps: st.list, geo: { kind: 'layers', layers: L.map((l, j) => ({ ...l, kh: kh(l), kv: kv(l), hl: per[j].hl, i: per[j].i })), H, kH, kV, dh, v, ih, qh } };
  }

  /* ------------------------------------------------------------------ */
  /* Flow net by finite volumes                                         */
  /* ------------------------------------------------------------------ */
  const _cache = new Map();
  /**
   * Solve the normalised potential φ (1 upstream, 0 downstream) in a
   * permeable layer of thickness T over an impervious base.
   * g = {type:'pile'|'dam', T, D, B, du, dd, rx (kx/k'), rz (kz/k')}
   */
  function solveNet(g, ny0) {
    const key = JSON.stringify(g) + '|' + (ny0 || 40);
    if (_cache.has(key)) return _cache.get(key);
    const T = g.T;
    let ny = ny0 || 40;
    // pick a cell count near ny0 for which the base width and wall depths fall on cell faces
    // (otherwise e.g. B = 20 m on 0.3 m cells is solved, drawn and integrated as 20.1 m)
    {
      const lens = [g.B, g.D, g.du, g.dd].filter((v) => v > 0);
      const miss = (m) => lens.reduce((s, v) => s + Math.abs(v / (T / m) - Math.round(v / (T / m))), 0);
      let best = ny, bestE = miss(ny);
      for (let d = 1; d <= Math.round(0.2 * ny) && bestE > 1e-9; d++) [ny - d, ny + d].forEach((m) => { const e = miss(m); if (e < bestE - 1e-9) { bestE = e; best = m; } });
      ny = best;
    }
    const span = g.type === 'dam' ? g.B : 0;
    const M = 3 * T * Math.max(1, Math.sqrt(g.rx / g.rz));
    let h = T / ny;
    let nx = Math.round((2 * M + span) / h);
    const nxMax = 14 * (ny0 || 40);
    if (nx > nxMax) { ny = Math.max(8, Math.floor((ny * nxMax) / nx)); h = T / ny; nx = Math.round((2 * M + span) / h); }
    const nM = Math.round(M / h);
    const nB = g.type === 'dam' ? Math.max(1, Math.round(g.B / h)) : 0;
    nx = 2 * nM + nB;
    const xL = -nM * h;
    const i0 = nM, i1 = nM + nB; // faces of the heel / toe (pile: both at 0)
    const walls = []; // {face, n}
    if (g.type === 'pile') walls.push({ face: i0, n: Math.min(ny - 1, Math.max(1, Math.round(g.D / h))) });
    else {
      if (g.du > 0) walls.push({ face: i0, n: Math.min(ny - 1, Math.max(1, Math.round(g.du / h))) });
      if (g.dd > 0) walls.push({ face: i1, n: Math.min(ny - 1, Math.max(1, Math.round(g.dd / h))) });
    }
    const wallAt = new Int32Array(nx + 1); // depth (cells) of wall on face i
    walls.forEach((w) => (wallAt[w.face] = Math.max(wallAt[w.face], w.n)));
    const blockedH = (face, j) => wallAt[face] > 0 && j >= ny - wallAt[face];
    const n = nx * ny, wx = g.rx, wz = g.rz;
    // top boundary: +1 upstream, 0 downstream, -1 impervious (dam base)
    const top = new Int8Array(nx);
    for (let i = 0; i < nx; i++) top[i] = i < i0 ? 1 : i >= i1 ? 0 : -1;
    const phi = new Float64Array(n);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = xL + (i + 0.5) * h; phi[j * nx + i] = x < 0 ? 1 : x > span ? 0 : 1 - x / Math.max(span, 1e-9); }
    // neighbour weights
    const wl = new Float64Array(n), wr = new Float64Array(n), wd = new Float64Array(n), wu = new Float64Array(n), bsum = new Float64Array(n), bval = new Float64Array(n), den = new Float64Array(n);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      wl[c] = i > 0 && !blockedH(i, j) ? wx : 0;
      wr[c] = i < nx - 1 && !blockedH(i + 1, j) ? wx : 0;
      wd[c] = j > 0 ? wz : 0;
      wu[c] = j < ny - 1 ? wz : 0;
      if (j === ny - 1 && top[i] >= 0) { bsum[c] = 2 * wz; bval[c] = 2 * wz * top[i]; }
      den[c] = wl[c] + wr[c] + wd[c] + wu[c] + bsum[c];
    }
    const N = Math.max(nx, ny);
    const om = 2 / (1 + Math.sin(PI / N)) * 0.995;
    let it = 0, md = 1;
    for (it = 0; it < 20000 && md > 1e-9; it++) {
      md = 0;
      for (let c = 0; c < n; c++) {
        const i = c % nx;
        let s = bval[c];
        if (wl[c]) s += wl[c] * phi[c - 1];
        if (wr[c]) s += wr[c] * phi[c + 1];
        if (wd[c]) s += wd[c] * phi[c - nx];
        if (wu[c]) s += wu[c] * phi[c + nx];
        const nv = s / den[c];
        const d = nv - phi[c];
        phi[c] += om * d;
        if (Math.abs(d) > md) md = Math.abs(d);
      }
    }
    // flux in (normalised by k' ΔH)
    let qin = 0, qout = 0;
    for (let i = 0; i < nx; i++) { const c = (ny - 1) * nx + i; if (top[i] === 1) qin += 2 * wz * (1 - phi[c]); else if (top[i] === 0) qout += 2 * wz * phi[c]; }
    // stream function on cell corners
    const psi = new Float64Array((nx + 1) * (ny + 1));
    for (let I = 0; I <= nx; I++) {
      let s = 0; psi[I] = 0;
      for (let J = 1; J <= ny; J++) {
        const j = J - 1;
        if (I > 0 && I < nx && !blockedH(I, j)) s += wx * (phi[j * nx + I - 1] - phi[j * nx + I]);
        psi[J * (nx + 1) + I] = s;
      }
    }
    const res = { nx, ny, h, xL, i0, i1, nB, walls, wallAt, top, phi, psi, S: 0.5 * (qin + qout), qin, qout, iters: it, T };
    if (_cache.size > 12) _cache.clear();
    _cache.set(key, res);
    return res;
  }

  /** φ at the top ghost row (ground surface) for cell column i. */
  function topVal(net, i) { const t = net.top[i]; return t >= 0 ? t : net.phi[(net.ny - 1) * net.nx + i]; }

  /** Extended lattice of φ: cell centres plus the boundary rows/columns. */
  function phiLattice(net) {
    const { nx, ny, h, xL, phi } = net;
    const W = nx + 2, H = ny + 2;
    const xs = new Float64Array(W), ys = new Float64Array(H), v = new Float64Array(W * H);
    xs[0] = xL; xs[W - 1] = xL + nx * h; for (let i = 0; i < nx; i++) xs[i + 1] = xL + (i + 0.5) * h;
    ys[0] = 0; ys[H - 1] = ny * h; for (let j = 0; j < ny; j++) ys[j + 1] = (j + 0.5) * h;
    for (let r = 0; r < H; r++) for (let a = 0; a < W; a++) {
      const i = Math.min(nx - 1, Math.max(0, a - 1));
      let val;
      if (r === H - 1) val = topVal(net, i);
      else { const j = Math.min(ny - 1, Math.max(0, r - 1)); val = phi[j * nx + i]; }
      v[r * W + a] = val;
    }
    // squares that straddle a wall are skipped
    const skip = (a, r) => { const face = a; if (face < 1 || face > nx - 1) return false; const d = net.wallAt[face]; if (!d) return false; return r + 1 >= ny - d + 1; };
    return { W, H, xs, ys, v, skip };
  }
  function psiLattice(net) {
    const { nx, ny, h, xL, psi } = net;
    const W = nx + 1, H = ny + 1;
    const xs = new Float64Array(W), ys = new Float64Array(H);
    for (let i = 0; i < W; i++) xs[i] = xL + i * h;
    for (let j = 0; j < H; j++) ys[j] = j * h;
    return { W, H, xs, ys, v: psi, skip: null };
  }

  /** Marching squares: segments [[x1,y1,x2,y2],…] for the iso-line v = level. */
  function contour(L, level) {
    const segs = [];
    const { W, H, xs, ys, v } = L;
    for (let r = 0; r < H - 1; r++) for (let a = 0; a < W - 1; a++) {
      if (L.skip && L.skip(a, r)) continue;
      const v0 = v[r * W + a], v1 = v[r * W + a + 1], v2 = v[(r + 1) * W + a + 1], v3 = v[(r + 1) * W + a];
      const x0 = xs[a], x1 = xs[a + 1], y0 = ys[r], y1 = ys[r + 1];
      const pts = [];
      const edge = (va, vb, pa, pb) => { if ((va - level) * (vb - level) < 0 || (va === level && vb !== level)) { const t = (level - va) / (vb - va); pts.push([pa[0] + t * (pb[0] - pa[0]), pa[1] + t * (pb[1] - pa[1])]); } };
      edge(v0, v1, [x0, y0], [x1, y0]); edge(v1, v2, [x1, y0], [x1, y1]); edge(v2, v3, [x1, y1], [x0, y1]); edge(v3, v0, [x0, y1], [x0, y0]);
      if (pts.length === 2) segs.push([pts[0][0], pts[0][1], pts[1][0], pts[1][1]]);
      else if (pts.length === 4) { segs.push([pts[0][0], pts[0][1], pts[1][0], pts[1][1]]); segs.push([pts[2][0], pts[2][1], pts[3][0], pts[3][1]]); }
    }
    return segs;
  }

  /** Bilinear φ at (x, y). */
  function phiAt(net, x, y) {
    const L = net._lat || (net._lat = phiLattice(net));
    const { W, H, xs, ys, v } = L;
    let a = 0; while (a < W - 2 && xs[a + 1] < x) a++;
    let r = 0; while (r < H - 2 && ys[r + 1] < y) r++;
    const tx = P.clamp((x - xs[a]) / (xs[a + 1] - xs[a] || 1), 0, 1), ty = P.clamp((y - ys[r]) / (ys[r + 1] - ys[r] || 1), 0, 1);
    const v0 = v[r * W + a], v1 = v[r * W + a + 1], v2 = v[(r + 1) * W + a + 1], v3 = v[(r + 1) * W + a];
    return (1 - ty) * ((1 - tx) * v0 + tx * v1) + ty * ((1 - tx) * v3 + tx * v2);
  }

  /** φ down a column of cells next to a face (side: 'R' cells right of the face, 'L' left). Returns [[depth, φ], …]. */
  function column(net, face, side) {
    const i = side === 'R' ? face : face - 1;
    const out = [[0, topVal(net, i)]];
    for (let j = net.ny - 1; j >= 0; j--) out.push([net.T - (j + 0.5) * net.h, net.phi[j * net.nx + i]]);
    out.push([net.T, net.phi[i]]);
    return out;
  }

  function flowNet(p, U) {
    const st = Steps(), err = [], warn = [], out = [];
    const gw = U.gw, Lu = U.len, Pu = U.press;
    const T = p.T, h1 = p.h1, h2 = p.h2;
    if (!(T > 0)) err.push('The permeable layer thickness must be positive.');
    if (!(h1 >= 0) || !(h2 >= 0)) err.push('Water depths must be zero or more.');
    if (!(h1 > h2)) err.push('The upstream water level must be higher than the downstream level for seepage to occur.');
    const isPile = p.type === 'pile';
    if (isPile && !(p.D > 0 && p.D < T)) err.push(p.D >= T ? 'The sheet pile reaches the impervious layer: no seepage path remains.' : 'The sheet pile penetration must be positive.');
    if (!isPile) {
      if (!(p.B > 0)) err.push('The dam base width must be positive.');
      if (p.cutU && !(p.du > 0 && p.du < T)) err.push('The upstream cut-off must be shorter than the permeable layer.');
      if (p.cutD && !(p.dd > 0 && p.dd < T)) err.push('The downstream cut-off must be shorter than the permeable layer.');
    }
    const kx0 = p.aniso ? p.kx : p.k, kz0 = p.aniso ? p.kz : p.k;
    if (!(kx0 > 0) || !(kz0 > 0)) err.push('Permeability must be positive.');
    if (err.length) return fail(err);
    const kb = U.kToBase;
    const kx = kx0 * kb, kz = kz0 * kb, kp = Math.sqrt(kx * kz);
    const g = { type: p.type, T, D: isPile ? p.D : 0, B: isPile ? 0 : p.B, du: !isPile && p.cutU ? p.du : 0, dd: !isPile && p.cutD ? p.dd : 0, rx: Math.sqrt(kx / kz), rz: Math.sqrt(kz / kx) };
    const net = solveNet(g, 40), coarse = solveNet(g, 20);
    const dH = h1 - h2;
    // Richardson extrapolation (the error is first order because of the singular wall tip / dam corners)
    const S = (net.S * net.ny - coarse.S * coarse.ny) / (net.ny - coarse.ny);
    st.add('Head lost through the soil', 'ΔH = h₁ − h₂', `ΔH = ${f(h1)} − ${f(h2)}`, `ΔH = ${f(dH)} ${Lu}`, 'h₁ and h₂ are the water depths above the ground surface upstream and downstream.');
    if (p.aniso) st.add('Anisotropic soil: equivalent permeability', 'k′ = √(k_x k_z)', `k′ = √(${f(kx)} × ${f(kz)})`, `k′ = ${f(kp)} ${Lu}/s`, `The flow net is drawn in the true section; it has square elements only in the section transformed by x′ = x √(k_z/k_x).`);
    else st.add('Permeability in base units', `k = ${f(p.k)} ${U.kField}`, '', `k = ${f(kp)} ${Lu}/s`);
    const Ncalc = S;
    st.add('Flow net (shape factor) from the grid solution', 'N_f / N_d = q / (k ΔH)', `Laplace’s equation solved on ${net.nx} × ${net.ny} cells (cell = ${f(net.h)} ${Lu}) → ${f(net.S)}, and on ${coarse.nx} × ${coarse.ny} cells → ${f(coarse.S)}; extrapolated to zero cell size`, `N_f / N_d = ${f(Ncalc)}`, 'Impervious base, sheet pile and dam base are no-flow boundaries; the ground surface upstream is at total head h₁ and downstream at h₂.');
    if (isPile) {
      const lam = Math.sin((PI * p.D) / (2 * T));
      if (!p.aniso && lam < 0.999999) {
        const Sx = P.ellipK(Math.sqrt(1 - lam * lam)) / (2 * P.ellipK(lam));
        st.add('Closed-form check (Harr): sheet pile in a layer of finite depth', 'q/(kΔH) = K(λ′) / (2 K(λ)),  λ = sin(πD/2T),  λ′ = cos(πD/2T)', `λ = sin(π × ${f(p.D)} / (2 × ${f(T)})) = ${f(lam)}`, `q/(kΔH) = ${f(Sx)}  (grid: ${f(Ncalc)}, difference ${f((100 * (Ncalc - Sx)) / Sx, 2)} %)`, 'K is the complete elliptic integral of the first kind.');
      }
    }
    let Nd = Math.max(2, Math.round(p.Nd)), Nf = Ncalc * Nd;
    if (p.counts === 'given') {
      Nd = Math.max(1, p.NdG); Nf = Math.max(0.1, p.NfG);
      if (Math.abs(Nf / Nd - Ncalc) / Ncalc > 0.15) warn.push(`The given N_f/N_d = ${f(Nf / Nd)} differs by more than 15 % from the computed ${f(Ncalc)} for this geometry.`);
    }
    const ratio = Nf / Nd;
    st.add('Number of flow channels and equipotential drops', p.counts === 'given' ? 'N_f, N_d (given)' : 'N_f = (N_f/N_d) × N_d', p.counts === 'given' ? '' : `N_f = ${f(Ncalc)} × ${Nd}`, `N_f = ${f(Nf, 3)},  N_d = ${f(Nd, 3)}`, p.counts === 'given' ? 'Counts read from a hand-drawn flow net.' : 'N_d is chosen; N_f follows so that the elements are curvilinear squares (a fractional last channel is normal).');
    const q = kp * dH * ratio;
    st.add('Seepage per unit length', 'q = k ΔH (N_f / N_d)', `q = ${f(kp)} × ${f(dH)} × ${f(ratio)}`, `q = ${f(q)} ${U.qpl} = ${f(q * U.perDay)} ${U.qplDay}`);
    out.push({ k: 'Seepage q', v: q, u: U.qpl, hl: true }, { k: 'Seepage q', v: q * U.perDay, u: U.qplDay, hl: true });
    out.push({ k: 'Shape factor N_f/N_d', v: ratio, u: '' }, { k: 'Flow channels N_f', v: Nf, u: '' }, { k: 'Equipotential drops N_d', v: Nd, u: '' }, { k: 'Head drop per step Δh = ΔH/N_d', v: dH / Nd, u: Lu });
    if (p.Lw > 0) {
      const Qt = q * p.Lw * U.perDay;
      st.add('Total seepage along the structure', 'Q = q × L', `Q = ${f(q * U.perDay)} × ${f(p.Lw)}`, `Q = ${f(Qt)} ${U.len}³/day`);
      out.push({ k: `Total seepage over L = ${f(p.Lw)} ${Lu}`, v: Qt, u: `${U.len}³/day` });
    }
    // critical gradient
    let gsat, gsub, icr;
    if (p.soilBy === 'phase') { const ph = P.phase(p.Gs, p.e, 1, gw); gsat = ph.gsat; }
    else gsat = p.gsat;
    gsub = gsat - gw; icr = gsub / gw;
    st.add('Critical hydraulic gradient (quick condition)', p.soilBy === 'phase' ? 'i_cr = (G_s − 1)/(1 + e) = γ′/γw' : 'i_cr = γ′/γw = (γ_sat − γw)/γw', p.soilBy === 'phase' ? `i_cr = (${f(p.Gs)} − 1)/(1 + ${f(p.e)})` : `i_cr = (${f(gsat)} − ${f(gw)}) / ${f(gw)}`, `i_cr = ${f(icr)}`, 'At this upward gradient the effective stress becomes zero and the sand boils.');
    if (!(gsub > 0)) return fail(['The saturated unit weight must exceed the unit weight of water.']);
    // exit gradient at the downstream face of the pile / dam toe
    const exitFace = isPile ? net.i0 : net.i1;
    const col = column(net, exitFace, 'R');
    const target = 1 / Nd;
    let lExit = null;
    for (let m = 1; m < col.length; m++) if (col[m][1] >= target) { const [d0, p0] = col[m - 1], [d1, p1] = col[m]; lExit = d0 + ((target - p0) / (p1 - p0 || 1)) * (d1 - d0); break; }
    let iExit = null, FSexit = null;
    if (lExit > 0) {
      iExit = dH / Nd / lExit;
      FSexit = icr / iExit;
      st.add('Exit gradient (last flow element at the exit)', 'i_exit = (ΔH / N_d) / l', `i_exit = (${f(dH)} / ${f(Nd, 3)}) / ${f(lExit)}`, `i_exit = ${f(iExit)}`, `l = ${f(lExit)} ${Lu} is the length of the last element, measured down the ${isPile ? 'downstream face of the sheet pile' : 'soil below the toe'} to the first equipotential line.`);
      st.add('Factor of safety against quick condition (piping) at the exit', 'FS = i_cr / i_exit', `FS = ${f(icr)} / ${f(iExit)}`, `FS = ${f(FSexit)}`, 'Values of 3 to 4 are commonly required for exit gradients.');
      out.push({ k: 'Critical gradient i_cr', v: icr, u: '' }, { k: 'Exit gradient i_exit', v: iExit, u: '' }, { k: 'FS against piping (i_cr / i_exit)', v: FSexit, u: '', hl: true });
    }
    // Terzaghi heave check for a downstream wall
    let heave = null;
    const dWall = isPile ? p.D : g.dd;
    if (dWall > 0) {
      const xw = isPile ? 0 : p.B, yb = T - dWall, n = 24;
      let s = 0; for (let j = 0; j <= n; j++) s += phiAt(net, xw + (dWall / 2) * (j / n) + 1e-9, yb) * (j === 0 || j === n ? 0.5 : 1);
      const phiAvg = s / n, ha = dH * phiAvg;
      const Wp = gsub * dWall * (dWall / 2), Uex = gw * ha * (dWall / 2);
      const FSh = Wp / Uex;
      heave = { xw, yb, D: dWall, ha, FS: FSh, Wp, Uex };
      st.add('Heave check (Terzaghi): soil prism D × D/2 on the downstream side', 'h_a = average excess head at the prism base;  FS = γ′ D / (γw h_a)', `h_a = ${f(phiAvg)} × ${f(dH)} = ${f(ha)} ${Lu};  FS = ${f(gsub)} × ${f(dWall)} / (${f(gw)} × ${f(ha)})`, `FS_heave = ${f(FSh)}`, `Submerged weight W′ = ${f(Wp)} ${U.force}/${Lu} against the uplift from excess pore pressure U = ${f(Uex)} ${U.force}/${Lu}.`);
      out.push({ k: 'Average excess head at prism base h_a', v: ha, u: Lu }, { k: 'FS against heave (Terzaghi)', v: FSh, u: '', hl: true });
    }
    // pore pressures along the sheet pile faces / under the dam
    let uplift = null, faces = null;
    const Hd = T + h2; // total head downstream (datum: impervious base)
    if (!isPile) {
      const xs = [], us = [];
      const B = net.nB * net.h;
      xs.push(0); us.push(gw * (h2 + dH * phiAt(net, 1e-9, T - 1e-9)));
      for (let i = net.i0; i < net.i1; i++) { const x = net.xL + (i + 0.5) * net.h; xs.push(x); us.push(gw * (h2 + dH * net.phi[(net.ny - 1) * net.nx + i])); }
      xs.push(B); us.push(gw * (h2 + dH * phiAt(net, B - 1e-9, T - 1e-9)));
      // integrate (trapezoid) and moment about the heel
      let Uf = 0, Mx = 0;
      for (let j = 1; j < xs.length; j++) { const dx = xs[j] - xs[j - 1], uu = 0.5 * (us[j] + us[j - 1]); Uf += uu * dx; Mx += uu * dx * 0.5 * (xs[j] + xs[j - 1]); }
      const xb = Mx / Uf;
      uplift = { xs, us, U: Uf, xb, u1: us[0], u2: us[us.length - 1] };
      st.add('Uplift pressure on the base', 'u = γw × (pressure head) = γw [h₂ + ΔH φ]', `heel: u = ${f(us[0])} ${Pu};  toe: u = ${f(us[us.length - 1])} ${Pu}`, '', 'φ is the fraction of ΔH still remaining at the point (1 at entry, 0 at exit). Datum at the impervious base, so the base of the dam has elevation head T.');
      st.add('Uplift force per unit length', 'U = ∫ u dx', `numerical integration over B = ${f(B)} ${Lu}`, `U = ${f(Uf)} ${U.force}/${Lu}, acting ${f(xb)} ${Lu} from the heel`, `Compare: straight-line uplift ½γw(h₁ + h₂)B = ${f(0.5 * gw * (h1 + h2) * B)} ${U.force}/${Lu}.`);
      out.push({ k: 'Uplift at heel', v: us[0], u: Pu }, { k: 'Uplift at toe', v: us[us.length - 1], u: Pu }, { k: 'Uplift force U', v: Uf, u: `${U.force}/${Lu}`, hl: true }, { k: 'U acts from heel at', v: xb, u: Lu });
    } else {
      const left = column(net, net.i0, 'L'), right = column(net, net.i0, 'R');
      const ds = [], uL = [], uR = [];
      for (let m = 0; m < left.length; m++) {
        const d = left[m][0]; if (d > p.D + 1e-9) break;
        ds.push(d); uL.push(gw * (h2 + d + dH * left[m][1])); uR.push(gw * (h2 + d + dH * right[m][1]));
      }
      if (ds[ds.length - 1] < p.D) { ds.push(p.D); uL.push(gw * (h2 + p.D + dH * phiAt(net, -1e-6, T - p.D))); uR.push(gw * (h2 + p.D + dH * phiAt(net, 1e-6, T - p.D))); }
      let Fn = 0; for (let j = 1; j < ds.length; j++) Fn += 0.5 * ((uL[j] - uR[j]) + (uL[j - 1] - uR[j - 1])) * (ds[j] - ds[j - 1]);
      faces = { ds, uL, uR, Fn };
      st.add('Net water pressure on the sheet pile (below ground)', 'u = γw [h₂ + z + ΔH φ]  on each face;  F = ∫ (u_up − u_down) dz', `at the tip (z = ${f(p.D)}): u_up = ${f(uL[uL.length - 1])}, u_down = ${f(uR[uR.length - 1])} ${Pu}`, `F_net = ${f(Fn)} ${U.force}/${Lu} (below ground) + ½γw(h₁² − h₂²) = ${f(0.5 * gw * (h1 * h1 - h2 * h2))} above ground`, 'z = depth below the ground surface.');
      out.push({ k: 'Net seepage force on pile below ground', v: Fn, u: `${U.force}/${Lu}` });
    }
    // pore pressure at point P
    const xp = p.xp, dp = P.clamp(p.dp, 0, T), yp = T - dp;
    const phP = phiAt(net, xp, yp);
    const nd = (1 - phP) * Nd;
    const Ht = Hd + dH * phP, z = yp, hp = Ht - z, uP = gw * hp;
    st.add('Pore water pressure at point P', 'H = (T + h₁) − n_d (ΔH/N_d);  pressure head h_p = H − z;  u = γw h_p', `n_d = ${f(nd, 3)} drops passed;  H = (${f(T)} + ${f(h1)}) − ${f(nd, 3)} × ${f(dH / Nd)} = ${f(Ht)};  h_p = ${f(Ht)} − ${f(z)}`, `u_P = ${f(gw)} × ${f(hp)} = ${f(uP)} ${Pu}`, `P is ${f(dp)} ${Lu} below the ground at x = ${f(xp)} ${Lu}; datum at the impervious base (z = elevation of P = ${f(z)} ${Lu}).`);
    out.push({ k: 'Point P: total head H', v: Ht, u: Lu }, { k: 'Point P: pore pressure u', v: uP, u: Pu, hl: true });
    let cls = 'ok', text = `q = ${f(q * U.perDay)} ${U.qplDay}`;
    const fsMin = Math.min(FSexit || Infinity, heave ? heave.FS : Infinity);
    if (fsMin < 1) { cls = 'bad'; text += ' · quick condition (FS < 1)'; warn.push('The factor of safety against piping/heave is below 1: the soil at the exit will boil.'); }
    else if (fsMin < p.fsReq) { cls = 'warn'; text += ` · FS = ${f(fsMin, 3)} < ${f(p.fsReq)}`; warn.push(`The factor of safety ${f(fsMin, 3)} is below the required ${f(p.fsReq)}.`); }
    else if (isFinite(fsMin)) text += ` · FS = ${f(fsMin, 3)}`;
    return { ok: true, err: [], warn, status: { cls, text }, out, steps: st.list, geo: { kind: 'net', net, g, isPile, T, h1, h2, dH, Nd, Nf, ratio, q, iExit, lExit, heave, uplift, faces, P: { x: xp, y: yp, u: uP, H: Ht }, icr, B: isPile ? 0 : net.nB * net.h, D: isPile ? p.D : 0, du: g.du, dd: g.dd, given: p.counts === 'given' } };
  }

  function seepage(p, U) {
    if (p.sub === 'const') return constHead(p.const, U);
    if (p.sub === 'fall') return fallingHead(p.fall, U);
    if (p.sub === 'layers') return layered(p.layers, U);
    return flowNet(Object.assign({}, p.net, { type: p.sub === 'dam' ? 'dam' : 'pile' }), U);
  }

  Object.assign(P, { seepage, constHead, fallingHead, layered, flowNet, solveNet, contour, phiLattice, psiLattice, phiAt });
})(typeof window !== 'undefined' ? window : globalThis);
