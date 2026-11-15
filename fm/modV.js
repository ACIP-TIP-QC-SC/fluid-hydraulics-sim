/* =====================================================================
 * MODULE — Viscosity (Newton's law of viscosity, thin films)
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Physics } = root;
  const { COL } = root.UI;
  const f = Physics.fmt;
  const PI = Math.PI, DEG = PI / 180;
  const OIL = '#e0b84a', OILD = '#b9770e', STEEL = '#9aa3ad', BLOCK = '#d4a373';

  const MV = {
    id: 'mv', title: 'Viscosity',
    state: {
      sub: 'incline', solve: 'V', mu: 0.8, sg: 0.9, t: 0.5,
      W: 200, theta: 30, L: 0.5, B: 0.4, V: 0.3,
      A: 1, h: 20, tp: 2, y1: 6, same: true, mu2: 0.4,
      D: 0.1, Ls: 0.25, motion: 'rotate', N: 600, Tq: 2, Fa: 50,
      R: 0.15, hollow: false, Ri: 0.03, H: 0.2, base: false,
      Lc: 0.1, bottom: true, tb: 2,
    },
    presets: [
      { name: 'Test V1 — block 200 N on 30° incline, oil film 0.5 mm, μ = 0.8 Pa·s', apply: (s) => Object.assign(s, { sub: 'incline', solve: 'V', W: 200, theta: 30, L: 0.5, B: 0.4, t: 0.5, mu: 0.8, sg: 0.9 }) },
      { name: 'Block slides at 0.3 m/s — find μ of the oil', apply: (s) => Object.assign(s, { sub: 'incline', solve: 'mu', W: 150, theta: 20, L: 0.4, B: 0.4, t: 0.2, V: 0.3, sg: 0.88 }) },
      { name: 'Find the block weight: slides at 0.4 m/s on a 25° incline', apply: (s) => Object.assign(s, { sub: 'incline', solve: 'W', theta: 25, L: 0.5, B: 0.5, t: 0.4, V: 0.4, mu: 0.6, sg: 0.9 }) },
      { name: 'Find the film thickness: 250 N block slides at 0.2 m/s on 20°', apply: (s) => Object.assign(s, { sub: 'incline', solve: 't', W: 250, theta: 20, L: 0.6, B: 0.4, V: 0.2, mu: 0.5, sg: 0.9 }) },
      { name: 'Force to pull a block UP a 15° incline at 0.5 m/s', apply: (s) => Object.assign(s, { sub: 'incline', solve: 'up', W: 300, theta: 15, L: 0.6, B: 0.5, t: 1, V: 0.5, mu: 0.3, sg: 0.9 }) },
      { name: 'Plate pulled through a 20 mm gap (same oil both sides)', apply: (s) => Object.assign(s, { sub: 'gap', A: 1, h: 20, tp: 2, y1: 6, V: 0.4, mu: 0.6, same: true, sg: 0.9 }) },
      { name: 'Plate between two different oils', apply: (s) => Object.assign(s, { sub: 'gap', A: 0.5, h: 25, tp: 1, y1: 8, V: 1, mu: 0.9, same: false, mu2: 0.3, sg: 0.9 }) },
      { name: 'Journal bearing — 100 mm shaft at 600 rpm', apply: (s) => Object.assign(s, { sub: 'shaft', motion: 'rotate', solve: 'fwd', D: 0.1, Ls: 0.25, t: 0.1, N: 600, mu: 0.12, sg: 0.9 }) },
      { name: 'Shaft pulled axially through a sleeve', apply: (s) => Object.assign(s, { sub: 'shaft', motion: 'axial', solve: 'fwd', D: 0.08, Ls: 0.3, t: 0.08, V: 0.5, mu: 0.2, sg: 0.9 }) },
      { name: 'Disk rotating on an oil film (thrust bearing)', apply: (s) => Object.assign(s, { sub: 'disk', solve: 'fwd', R: 0.15, hollow: false, t: 0.25, N: 300, mu: 0.2, sg: 0.9 }) },
      { name: 'Cone in a conical housing', apply: (s) => Object.assign(s, { sub: 'cone', solve: 'fwd', R: 0.1, H: 0.15, base: false, t: 0.2, N: 400, mu: 0.25, sg: 0.9 }) },
      { name: 'Rotational viscometer — find μ from torque', apply: (s) => Object.assign(s, { sub: 'visc', R: 0.05, Lc: 0.1, t: 1, bottom: true, tb: 2, N: 120, Tq: 0.05, sg: 1.26 }) },
    ],

    controls(el, C) {
      const s = this.state, u = Physics.VU[root.App.U().id];
      C.seg(el, { label: 'Situation', options: [['incline', 'Block on incline'], ['gap', 'Plate in a gap'], ['shaft', 'Shaft & sleeve'], ['disk', 'Rotating disk'], ['cone', 'Rotating cone'], ['visc', 'Viscometer']], get: () => s.sub, set: (v) => { s.sub = v; if (v !== 'incline' && !['fwd', 'mu'].includes(s.solve)) s.solve = 'fwd'; if (v === 'incline' && !['V', 'mu', 'up', 'W', 't'].includes(s.solve)) s.solve = 'V'; } });
      const sl = (p, k, label, min, max, step, unit) => C.slider(p, { label, min, max, step, get: () => s[k], set: (v) => (s[k] = v), unit });
      const L = C.section(el, 'Liquid');
      if (!(s.sub === 'visc' || (s.solve === 'mu'))) sl(L, 'mu', s.sub === 'gap' && !s.same ? 'Upper-film viscosity μ₁' : 'Dynamic viscosity μ', 0.0005, u.id === 'SI' ? 20 : 0.4, u.id === 'SI' ? 0.0001 : 0.000001, u.mu);
      if (s.sub === 'gap') {
        C.toggle(L, { label: 'Same liquid on both sides of the plate', get: () => s.same, set: (v) => (s.same = v) });
        if (!s.same) sl(L, 'mu2', 'Lower-film viscosity μ₂', 0.0005, u.id === 'SI' ? 20 : 0.4, 0.0001, u.mu);
      }
      sl(L, 'sg', 'Specific gravity (for ν = μ/ρ)', 0.5, 13.6, 0.01, '');
      const g = C.section(el, 'Geometry & motion');
      if (s.sub === 'incline') {
        C.seg(g, { label: 'Solve for', options: [['V', 'Terminal velocity'], ['mu', 'Viscosity μ'], ['W', 'Block weight W'], ['t', 'Film thickness t'], ['up', 'Force to pull up']], get: () => s.solve, set: (v) => (s.solve = v) });
        if (s.solve !== 'W') sl(g, 'W', 'Block weight W', 1, 5000, 0.1, u.F);
        sl(g, 'theta', 'Incline angle θ', 0, 80, 0.1, '°');
        sl(g, 'L', 'Block length L (along slope)', 0.05, 5, 0.01, u.len);
        sl(g, 'B', 'Block width B', 0.05, 5, 0.01, u.len);
        if (s.solve !== 't') sl(g, 't', 'Film thickness t', 0.01, 10, 0.01, u.t);
        if (s.solve !== 'V') sl(g, 'V', 'Velocity V', 0.001, 10, 0.001, u.V);
      } else if (s.sub === 'gap') {
        sl(g, 'A', 'Plate area A (one face)', 0.01, 10, 0.01, u.A);
        sl(g, 'h', 'Gap between fixed walls h', 0.1, 100, 0.1, u.t);
        sl(g, 'tp', 'Plate thickness t_p', 0, 50, 0.1, u.t);
        sl(g, 'y1', 'Distance from top wall y₁', 0.05, 100, 0.05, u.t);
        sl(g, 'V', 'Plate velocity V', 0.001, 10, 0.001, u.V);
      } else if (s.sub === 'shaft') {
        C.seg(g, { label: 'Motion', options: [['rotate', 'Rotating (journal bearing)'], ['axial', 'Sliding axially']], get: () => s.motion, set: (v) => (s.motion = v) });
        C.seg(g, { label: 'Solve for', options: [['fwd', s.motion === 'rotate' ? 'Torque & power' : 'Force'], ['mu', 'Viscosity μ']], get: () => s.solve, set: (v) => (s.solve = v) });
        sl(g, 'D', 'Shaft diameter D', 0.005, 2, 0.001, u.len);
        sl(g, 'Ls', 'Sleeve length L', 0.01, 5, 0.001, u.len);
        sl(g, 't', 'Radial clearance t', 0.005, 5, 0.005, u.t);
        if (s.motion === 'rotate') sl(g, 'N', 'Speed N', 1, 5000, 1, 'rpm'); else sl(g, 'V', 'Axial speed V', 0.001, 10, 0.001, u.V);
        if (s.solve === 'mu') { if (s.motion === 'rotate') sl(g, 'Tq', 'Measured torque T', 0.0001, 1000, 0.0001, u.T); else sl(g, 'Fa', 'Measured force F', 0.01, 10000, 0.01, u.F); }
      } else if (s.sub === 'disk' || s.sub === 'cone') {
        C.seg(g, { label: 'Solve for', options: [['fwd', 'Torque & power'], ['mu', 'Viscosity μ']], get: () => s.solve, set: (v) => (s.solve = v) });
        sl(g, 'R', s.sub === 'disk' ? 'Disk radius R' : 'Cone base radius R', 0.01, 2, 0.001, u.len);
        if (s.sub === 'disk') { C.toggle(g, { label: 'Annular (hollow) disk', get: () => s.hollow, set: (v) => (s.hollow = v) }); if (s.hollow) sl(g, 'Ri', 'Inner radius Rᵢ', 0, 2, 0.001, u.len); }
        else { sl(g, 'H', 'Cone height H', 0.01, 2, 0.001, u.len); C.toggle(g, { label: 'Include oil film on the flat base too', get: () => s.base, set: (v) => (s.base = v) }); }
        sl(g, 't', 'Film thickness t', 0.01, 10, 0.01, u.t);
        sl(g, 'N', 'Speed N', 1, 5000, 1, 'rpm');
        if (s.solve === 'mu') sl(g, 'Tq', 'Measured torque T', 0.0001, 1000, 0.0001, u.T);
      } else {
        C.note(g, 'Concentric-cylinder (Couette) viscometer: the inner cylinder turns at N rpm and the torque needed is measured.');
        sl(g, 'R', 'Inner cylinder radius R', 0.005, 1, 0.001, u.len);
        sl(g, 'Lc', 'Immersed length L', 0.005, 2, 0.001, u.len);
        sl(g, 't', 'Annular gap t', 0.01, 20, 0.01, u.t);
        C.toggle(g, { label: 'Include the bottom face', get: () => s.bottom, set: (v) => (s.bottom = v) });
        if (s.bottom) sl(g, 'tb', 'Bottom gap t_b', 0.01, 50, 0.01, u.t);
        sl(g, 'N', 'Speed N', 1, 5000, 1, 'rpm');
        sl(g, 'Tq', 'Measured torque T', 0.00001, 100, 0.00001, u.T);
      }
    },

    compute(U) {
      const s = this.state;
      return Physics.viscosity(Object.assign({}, s, { solve: s.sub === 'visc' ? 'mu' : s.solve }), U);
    },

    draw2D(svg, res, U) {
      if (!res.ok) { root.M1.emptyMsg(svg, res); return; }
      const s = this.state, g = res.geo, u = res.VU;
      if (s.sub === 'incline') return incline2D(svg, s, g, u);
      if (s.sub === 'gap') return gap2D(svg, s, g, u);
      if (s.sub === 'shaft') return shaft2D(svg, s, g, u);
      if (s.sub === 'disk' || s.sub === 'cone') return disk2D(svg, s, g, u);
      return visc2D(svg, s, g, u);
    },

    draw3D(V, res, U) {
      if (!res.ok) return;
      const s = this.state, g = res.geo, u = res.VU;
      if (s.sub === 'incline') {
        const th = s.theta * DEG, Lr = s.L * 2.6, tf = Math.max(g.t, 0.03 * s.L), hb = 0.4 * s.L;
        const d = [Math.cos(th), -Math.sin(th)], n = [Math.sin(th), Math.cos(th)];
        const top = [0, Lr * Math.sin(th)], P = (sv, nv) => [top[0] + d[0] * sv + n[0] * nv, top[1] + d[1] * sv + n[1] * nv];
        const zb = s.B * 1.6;
        V.extrude([[0, 0], [Lr * Math.cos(th), 0], top], -zb, zb, '#bfc9d3', 1, '#566573');
        const s0 = 0.8 * s.L;
        V.extrude([P(s0, 0), P(s0 + s.L, 0), P(s0 + s.L, tf), P(s0, tf)], -s.B / 2, s.B / 2, OIL, 0.85, OILD);
        V.extrude([P(s0, tf), P(s0 + s.L, tf), P(s0 + s.L, tf + hb), P(s0, tf + hb)], -s.B / 2, s.B / 2, BLOCK, 0.95, '#7f5539');
        const c = P(s0 + s.L / 2, tf + hb / 2);
        V.line([[c[0], c[1], 0], [c[0], c[1] - 0.6 * s.L, 0]], '#2c3e50', 3); V.label([c[0], c[1] - 0.6 * s.L, 0], `W = ${f(g.W)} ${u.F}`, '#2c3e50');
        const vs = s.solve === 'up' ? -1 : 1, a = P(s0 + s.L / 2, tf + hb + 0.15 * s.L), b = P(s0 + s.L / 2 + vs * 0.5 * s.L, tf + hb + 0.15 * s.L);
        V.line([[a[0], a[1], 0], [b[0], b[1], 0]], '#c0392b', 3); V.label([b[0], b[1], 0], `V = ${f(g.V)} ${u.V}`, '#c0392b');
        V.dim([P(s0, tf + hb)[0], P(s0, tf + hb)[1], s.B / 2], [P(s0 + s.L, tf + hb)[0], P(s0 + s.L, tf + hb)[1], s.B / 2], `L = ${f(s.L)} ${u.len}`, [n[0] * 0.2 * s.L, n[1] * 0.2 * s.L, 0]);
        const q = P(s0 + s.L, tf); V.dim([q[0], q[1], -s.B / 2], [q[0], q[1], s.B / 2], `B = ${f(s.B)} ${u.len}`, [0.2 * s.L, 0, 0]);
        V.label([Lr * Math.cos(th) * 0.8, 0.02, zb], `θ = ${f(s.theta)}°`, '#34495e');
        V.label([P(s0, 0)[0], P(s0, 0)[1], s.B / 2], `film t = ${f(g.tIn)} ${u.t}`, OILD);
      } else if (s.sub === 'gap') {
        const Wd = Math.sqrt(s.A), H = g.hgap, sc = Wd / (H * 6), Hs = H * sc * 3;
        const y = (m) => m * sc * 3;
        V.box(-Wd, Hs, -Wd / 2, Wd, Hs + 0.05 * Wd, Wd / 2, STEEL, 0.6, '#555');
        V.box(-Wd, -0.05 * Wd, -Wd / 2, Wd, 0, Wd / 2, STEEL, 1, '#555');
        V.box(-Wd, 0, -Wd / 2, Wd, Hs, Wd / 2, OIL, 0.18, null);
        const yb = y(g.y2), yt = y(g.y2 + g.tp);
        V.box(-Wd / 2, yb, -Wd / 2, Wd / 2, Math.max(yt, yb + 0.01 * Wd), Wd / 2, '#5d6d7e', 0.95, '#1b2631');
        V.line([[Wd / 2, (yb + yt) / 2, 0], [Wd * 1.1, (yb + yt) / 2, 0]], '#c0392b', 3); V.label([Wd * 1.1, (yb + yt) / 2, 0], `F = ${f(g.F)} ${u.F}, V = ${f(g.V)} ${u.V}`, '#c0392b');
        V.dim([-Wd, yt, Wd / 2], [-Wd, Hs, Wd / 2], `y₁ = ${f(s.y1)} ${u.t}`, [-0.2 * Wd, 0, 0]);
        V.dim([-Wd, 0, Wd / 2], [-Wd, yb, Wd / 2], `y₂ = ${f(g.y2 / u.tF)} ${u.t}`, [-0.2 * Wd, 0, 0]);
        V.dim([-Wd / 2, yt, Wd / 2], [Wd / 2, yt, Wd / 2], `√A = ${f(Wd)} ${u.len}`, [0, 0, 0.25 * Wd]);
      } else if (s.sub === 'shaft') {
        const r = s.D / 2, L = s.Ls, c = Math.max(g.t, 0.08 * r);
        V.lathe([[r + c, 0], [r + c + 0.4 * r, 0], [r + c + 0.4 * r, L], [r + c, L]], STEEL, 0.35, null, 36);
        V.lathe([[r, 0], [r + c, 0], [r + c, L], [r, L]], OIL, 0.4, null, 36);
        V.lathe([[0, -0.6 * L], [r, -0.6 * L], [r, 1.6 * L], [0, 1.6 * L]], '#7f8c8d', 0.95, null, 36);
        if (s.motion === 'rotate') V.circle(0, 1.7 * L, 0, r * 1.6, '#c0392b', 2.5); else V.line([[0, 1.6 * L, 0], [0, 2.1 * L, 0]], '#c0392b', 3);
        V.label([r * 1.6, 1.7 * L, 0], s.motion === 'rotate' ? `N = ${f(s.N)} rpm, T = ${f(g.T)} ${u.T}` : `V = ${f(g.V)} ${u.V}, F = ${f(g.F)} ${u.F}`, '#c0392b');
        V.dim([-r, 1.6 * L, 0], [r, 1.6 * L, 0], `D = ${f(s.D)} ${u.len}`, [0, 0.15 * L, 0]);
        V.dim([r + c + 0.4 * r, 0, 0], [r + c + 0.4 * r, L, 0], `L = ${f(L)} ${u.len}`, [0.5 * r, 0, 0]);
        V.label([r + c, 0, 0], `clearance t = ${f(s.t)} ${u.t}`, OILD);
      } else if (s.sub === 'disk' || s.sub === 'cone') {
        const R = s.R, tf = Math.max(g.t, 0.04 * R);
        if (s.sub === 'disk') {
          V.lathe([[0, -0.15 * R], [1.3 * R, -0.15 * R], [1.3 * R, 0], [0, 0]], STEEL, 1, null, 40);
          V.lathe([[s.hollow ? s.Ri : 0, 0], [R, 0], [R, tf], [s.hollow ? s.Ri : 0, tf]], OIL, 0.6, null, 40);
          V.lathe([[s.hollow ? s.Ri : 0, tf], [R, tf], [R, tf + 0.12 * R], [s.hollow ? s.Ri : 0, tf + 0.12 * R]], '#7f8c8d', 0.95, null, 40);
          V.lathe([[0, tf + 0.12 * R], [0.12 * R, tf + 0.12 * R], [0.12 * R, 1.2 * R], [0, 1.2 * R]], '#5d6d7e', 1, null, 24);
          V.dim([-R, tf + 0.12 * R, 0], [R, tf + 0.12 * R, 0], `2R = ${f(2 * R)} ${u.len}`, [0, 0.4 * R, 0]);
        } else {
          const H = s.H;
          V.lathe([[0, -0.15 * R], [1.4 * R, -0.15 * R], [1.4 * R, H], [R + tf, H], [0, -tf]], STEEL, 0.35, null, 40);
          V.lathe([[0, -tf], [R + tf, H], [R, H], [0, 0]], OIL, 0.5, null, 40);
          V.lathe([[0, 0], [R, H], [R, H + 0.1 * R], [0, H + 0.1 * R]], '#7f8c8d', 0.95, null, 40);
          V.lathe([[0, H + 0.1 * R], [0.1 * R, H + 0.1 * R], [0.1 * R, H + 0.8 * R], [0, H + 0.8 * R]], '#5d6d7e', 1, null, 24);
          V.dim([-R, H + 0.1 * R, 0], [R, H + 0.1 * R, 0], `2R = ${f(2 * R)} ${u.len}`, [0, 0.4 * R, 0]);
          V.dim([1.4 * R, 0, 0], [1.4 * R, H, 0], `H = ${f(H)} ${u.len}`, [0.3 * R, 0, 0]);
        }
        V.circle(0, (s.sub === 'disk' ? 1.2 : 1) * R + (s.sub === 'cone' ? s.H : 0), 0, 0.5 * R, '#c0392b', 2.5);
        V.label([0.5 * R, (s.sub === 'disk' ? 1.2 * R : s.H + R), 0], `N = ${f(s.N)} rpm, T = ${f(g.T)} ${u.T}`, '#c0392b');
        V.label([R, 0, 0], `film t = ${f(s.t)} ${u.t}`, OILD);
      } else {
        const R = s.R, L = s.Lc, c = Math.max(g.t, 0.1 * R), tb = s.bottom ? Math.max(g.tb, 0.1 * R) : 0.15 * R;
        V.lathe([[0, -tb - 0.1 * R], [R + c + 0.15 * R, -tb - 0.1 * R], [R + c + 0.15 * R, 1.15 * L], [R + c, 1.15 * L], [R + c, -tb], [0, -tb]], STEEL, 0.3, null, 40);
        V.lathe([[0, -tb], [R + c, -tb], [R + c, L], [0, L]], OIL, 0.35, null, 40);
        V.lathe([[0, 0], [R, 0], [R, 1.3 * L], [0, 1.3 * L]], '#7f8c8d', 0.95, null, 40);
        V.circle(0, 1.4 * L, 0, R * 0.8, '#c0392b', 2.5);
        V.label([R, 1.4 * L, 0], `N = ${f(s.N)} rpm, T = ${f(s.Tq)} ${u.T}`, '#c0392b');
        V.dim([R + c + 0.15 * R, 0, 0], [R + c + 0.15 * R, L, 0], `L = ${f(L)} ${u.len}`, [0.4 * R, 0, 0]);
        V.dim([-R, 1.3 * L, 0], [R, 1.3 * L, 0], `2R = ${f(2 * R)} ${u.len}`, [0, 0.25 * L, 0]);
      }
      V.autoBounds();
    },
  };

  /* ---------- 2D views ---------- */
  function profileInset(D, x0, y0, w, h, label, twoSided) {
    // velocity-profile inset (px coordinates)
    D.el('rect', { x: x0, y: y0, width: w, height: h, fill: '#fff', stroke: '#c4ced9', rx: 6 });
    D.text([x0 + 8, y0 + 16], label, { px: true, size: 11, color: '#5d6b7a' });
    const ym = twoSided ? y0 + h / 2 : y0 + h - 14, yt = y0 + 26, yb = y0 + h - 14, xl = x0 + 20, xr = x0 + w - 24;
    D.lineP([xl, yt], [xl, yb], { stroke: '#34495e', sw: 2 });
    if (twoSided) {
      D.el('polygon', { points: `${xl},${yt} ${xr},${ym} ${xl},${yb}`, fill: OIL, 'fill-opacity': 0.45, stroke: OILD });
      for (let i = 1; i < 6; i++) { const yy = yt + ((ym - yt) * i) / 6, len = ((xr - xl) * i) / 6; D.head(xl + len, yy, 1, 0, OILD, 6); D.lineP([xl, yy], [xl + len, yy], { stroke: OILD, sw: 1 }); const y2 = ym + ((yb - ym) * (6 - i)) / 6; D.lineP([xl, y2], [xl + len, y2], { stroke: OILD, sw: 1 }); D.head(xl + len, y2, 1, 0, OILD, 6); }
      D.text([xr + 2, ym + 4], 'V', { px: true, color: '#c0392b' });
    } else {
      D.el('polygon', { points: `${xl},${yb} ${xr},${yt} ${xl},${yt}`, fill: OIL, 'fill-opacity': 0.45, stroke: OILD });
      for (let i = 1; i < 6; i++) { const yy = yb - ((yb - yt) * i) / 6, len = ((xr - xl) * i) / 6; D.lineP([xl, yy], [xl + len, yy], { stroke: OILD, sw: 1 }); D.head(xl + len, yy, 1, 0, OILD, 6); }
      D.text([xr + 2, yt + 4], 'V', { px: true, color: '#c0392b' });
      D.text([xl + 4, yb + 12], 'fixed (u = 0)', { px: true, size: 10, color: '#5d6b7a' });
    }
  }

  function incline2D(svg, s, g, u) {
    const th = s.theta * DEG, Lr = s.L * 2.6, hb = 0.4 * s.L, tf = Math.max(g.t, 0.04 * s.L);
    const d = [Math.cos(th), -Math.sin(th)], n = [Math.sin(th), Math.cos(th)];
    const top = [0, Lr * Math.sin(th)], P = (sv, nv) => [top[0] + d[0] * sv + n[0] * nv, top[1] + d[1] * sv + n[1] * nv];
    const xmax = Lr * Math.cos(th), ymax = top[1] + hb + 0.6 * s.L;
    const D = root.UI.Draw2D(svg, { xmin: -0.3 * s.L, xmax: Math.max(xmax, s.L) + 0.3 * s.L, ymin: -0.35 * s.L, ymax }, { pad: 46, padR: 220 });
    D.poly([[0, 0], [xmax, 0], top], { fill: 'url(#hatch)', stroke: '#2c3e50', sw: 2 });
    const s0 = 0.8 * s.L;
    D.poly([P(s0 - 0.05 * s.L, 0), P(s0 + 1.05 * s.L, 0), P(s0 + s.L, tf), P(s0, tf)], { fill: OIL, stroke: OILD, sw: 1 });
    D.poly([P(s0, tf), P(s0 + s.L, tf), P(s0 + s.L, tf + hb), P(s0, tf + hb)], { fill: BLOCK, stroke: '#7f5539', sw: 2 });
    const c = P(s0 + s.L / 2, tf + hb / 2);
    D.force([c[0], c[1] - 0.001], [0, -1], 90, { color: COL.weight, label: `W = ${f(g.W)} ${u.F}`, lp: 'head', ldx: -8, ldy: 14, anchor: 'end' });
    if (s.theta > 0) D.arrow(c, [c[0] + d[0] * 0.45 * s.L * Math.sin(th) * 1.5, c[1] + d[1] * 0.45 * s.L * Math.sin(th) * 1.5], { color: '#7d3c98', w: 2, label: `W sin θ = ${f(g.Wp)}`, lp: 'head', size: 11 });
    const vs = s.solve === 'up' ? -1 : 1;
    const a = P(s0 + s.L * 0.2, tf + hb + 0.12 * s.L), b = P(s0 + s.L * 0.2 + vs * 0.6 * s.L, tf + hb + 0.12 * s.L);
    D.arrow(a, b, { color: '#c0392b', w: 3, label: `V = ${f(g.V)} ${u.V}`, lp: 'head', ldy: -8 });
    const ta = P(s0 + s.L * 0.5, tf * 0.5), tb2 = P(s0 + s.L * 0.5 - vs * 0.35 * s.L, tf * 0.5);
    D.arrow(ta, tb2, { color: OILD, w: 2, label: `τA = ${f(g.tau * g.A)} ${u.F}`, lp: 'tail', ldx: 8, ldy: 22, size: 11 });
    if (s.solve === 'up') { const pa = P(s0 - 0.6 * s.L, tf + hb / 2), pb = P(s0, tf + hb / 2); D.arrow(pa, pb, { color: '#1e8449', w: 3, label: `P = ${f(g.F)} ${u.F}`, lp: 'tail', ldy: -8 }); }
    D.dim(P(s0, tf + hb), P(s0 + s.L, tf + hb), `L = ${f(s.L)} ${u.len}`, 26);
    D.arc([xmax, 0], 46, 180 - s.theta, 180, `θ = ${f(s.theta)}°`);
    const fp = P(s0 + s.L, tf / 2); D.text(fp, `oil film t = ${f(g.tIn)} ${u.t} (drawn exaggerated)`, { dx: 10, dy: 14, color: OILD, size: 11 });
    profileInset(D, D.W - 210, 20, 190, 140, 'Velocity profile in the film', false);
    D.text([D.W - 200, 180], `τ = μV/t = ${f(g.tau)} ${u.tau}`, { px: true, size: 11.5, color: '#34495e' });
  }

  function gap2D(svg, s, g, u) {
    const H = g.hgap, Wd = 1, sc = 1 / H;
    const Y = (m) => m * sc;
    const D = root.UI.Draw2D(svg, { xmin: -1.4, xmax: 2.4, ymin: -0.15, ymax: 1.15 }, { pad: 46, padR: 200 });
    D.poly([[-1.4, 1], [1.4, 1], [1.4, 1.08], [-1.4, 1.08]], { fill: 'url(#hatch)', stroke: '#2c3e50' });
    D.poly([[-1.4, 0], [1.4, 0], [1.4, -0.08], [-1.4, -0.08]], { fill: 'url(#hatch)', stroke: '#2c3e50' });
    D.poly([[-1.4, 0], [1.4, 0], [1.4, 1], [-1.4, 1]], { fill: OIL, op: 0.35 });
    const yb = Y(g.y2), yt = Y(g.y2 + g.tp);
    D.poly([[-Wd, yb], [Wd, yb], [Wd, Math.max(yt, yb + 0.01)], [-Wd, Math.max(yt, yb + 0.01)]], { fill: '#5d6d7e', stroke: '#1b2631', sw: 1.5 });
    D.arrow([Wd, (yb + yt) / 2], [Wd + 0.45, (yb + yt) / 2], { color: '#c0392b', w: 3, label: `F = ${f(g.F)} ${u.F}`, lp: 'tail', ldx: 4, ldy: 18 });
    D.text([0, yt], `plate, V = ${f(g.V)} ${u.V}`, { anchor: 'middle', dy: -6, color: '#1b2631' });
    // linear profiles
    const xp = -1.25;
    D.poly([[xp, 1], [xp + 0.3, yt], [xp, yt]], { fill: OIL, op: 0.7, stroke: OILD });
    D.poly([[xp, 0], [xp + 0.3, yb], [xp, yb]], { fill: OIL, op: 0.7, stroke: OILD });
    
    D.text([-0.6, (1 + yt) / 2], `μ₁, F₁ = ${f(g.F1)} ${u.F}`, { anchor: 'middle', dy: 4, color: '#7e5109' });
    D.text([-0.6, yb / 2], `μ₂, F₂ = ${f(g.F2)} ${u.F}`, { anchor: 'middle', dy: 4, color: '#7e5109' });
    D.dim([1.75, yt], [1.75, 1], `y₁ = ${f(s.y1)} ${u.t}`, -10, { anchor: 'start', ldx: 8 });
    D.dim([1.75, 0], [1.75, yb], `y₂ = ${f(g.y2 / u.tF)} ${u.t}`, -10, { anchor: 'start', ldx: 8 });
    D.dim([2.2, 0], [2.2, 1], `h = ${f(s.h)} ${u.t}`, -10, { anchor: 'start', ldx: 8 });
    D.line([1.4, 1], [2.25, 1], { stroke: '#5d6b7a', sw: 0.6, dash: '3 3' }); D.line([1.4, 0], [2.25, 0], { stroke: '#5d6b7a', sw: 0.6, dash: '3 3' });
    D.text([D.W - 200, 30], `A = ${f(s.A)} ${u.A} per face`, { px: true, size: 11.5, color: '#34495e' });
    D.text([D.W - 200, 50], 'Profiles are linear in each film', { px: true, size: 11, color: '#5d6b7a' });
  }

  function shaft2D(svg, s, g, u) {
    const r = s.D / 2, L = s.Ls, c = Math.max(g.t, 0.06 * r), w = 0.35 * r;
    const D = root.UI.Draw2D(svg, { xmin: -0.5 * L, xmax: 1.5 * L, ymin: -r - c - w - 0.3 * r, ymax: r + c + w + 0.5 * r }, { pad: 50, padR: 180 });
    D.poly([[-0.5 * L, -r], [1.5 * L, -r], [1.5 * L, r], [-0.5 * L, r]], { fill: '#aab3bb', stroke: '#2c3e50', sw: 1.5 });
    D.line([-0.5 * L, 0], [1.5 * L, 0], { stroke: '#2c3e50', sw: 0.8, dash: '10 4 2 4' });
    [1, -1].forEach((sg) => {
      D.poly([[0, sg * r], [L, sg * r], [L, sg * (r + c)], [0, sg * (r + c)]], { fill: OIL, stroke: OILD });
      D.poly([[0, sg * (r + c)], [L, sg * (r + c)], [L, sg * (r + c + w)], [0, sg * (r + c + w)]], { fill: 'url(#hatch)', stroke: '#2c3e50', sw: 1.5 });
    });
    D.dim([0, r + c + w], [L, r + c + w], `L = ${f(L)} ${u.len}`, 18);
    D.dim([-0.2 * L, -r], [-0.2 * L, r], `D = ${f(s.D)} ${u.len}`, 12, { anchor: 'end', ldx: -8 });
    D.text([L, -(r + c / 2)], `clearance t = ${f(s.t)} ${u.t} (exaggerated)`, { dx: 8, dy: 4, size: 11, color: OILD });
    if (s.motion === 'rotate') {
      D.arc([1.3 * L, 0], 26, -60, 240, `N = ${f(s.N)} rpm`, { color: '#c0392b' });
      D.text([1.2 * L, r + 0.25 * r], `T = ${f(g.T)} ${u.T}`, { color: '#c0392b', size: 13 });
    } else {
      D.arrow([1.5 * L, 0], [1.5 * L + 0.25 * L, 0], { color: '#c0392b', w: 3, label: `V = ${f(g.V)} ${u.V}, F = ${f(g.F)} ${u.F}`, lp: 'tail', ldy: -10 });
    }
    profileInset(D, D.W - 170, 20, 150, 120, 'Film profile', false);
  }

  function disk2D(svg, s, g, u) {
    const R = s.R, tf = Math.max(g.t, 0.04 * R);
    const top = s.sub === 'cone' ? s.H : tf;
    const D = root.UI.Draw2D(svg, { xmin: -1.5 * R, xmax: 1.6 * R, ymin: -0.35 * R, ymax: top + 1.1 * R }, { pad: 46, padR: 180 });
    if (s.sub === 'disk') {
      D.poly([[-1.4 * R, 0], [1.4 * R, 0], [1.4 * R, -0.2 * R], [-1.4 * R, -0.2 * R]], { fill: 'url(#hatch)', stroke: '#2c3e50', sw: 1.5 });
      const ri = s.hollow ? s.Ri : 0;
      [[-R, -ri], [ri, R]].forEach(([a, b]) => { if (b - a > 1e-9) { D.poly([[a, 0], [b, 0], [b, tf], [a, tf]], { fill: OIL, stroke: OILD }); D.poly([[a, tf], [b, tf], [b, tf + 0.12 * R], [a, tf + 0.12 * R]], { fill: '#7f8c8d', stroke: '#2c3e50', sw: 1.5 }); } });
      D.poly([[-0.1 * R, tf + 0.12 * R], [0.1 * R, tf + 0.12 * R], [0.1 * R, tf + R], [-0.1 * R, tf + R]], { fill: '#5d6d7e', stroke: '#2c3e50' });
      D.dim([-R, tf + 0.12 * R], [R, tf + 0.12 * R], `2R = ${f(2 * R)} ${u.len}`, -30);
      if (s.hollow) D.dim([-ri, tf + 0.12 * R], [ri, tf + 0.12 * R], `2Rᵢ = ${f(2 * ri)}`, -14);
    } else {
      const H = s.H;
      D.poly([[-1.4 * R, H], [-R - tf, H], [0, -tf], [R + tf, H], [1.4 * R, H], [1.4 * R, -0.25 * R], [-1.4 * R, -0.25 * R]], { fill: 'url(#hatch)', stroke: '#2c3e50', sw: 1.5 });
      D.poly([[-R - tf, H], [0, -tf], [R + tf, H], [R, H], [0, 0], [-R, H]], { fill: OIL, stroke: OILD });
      D.poly([[-R, H], [0, 0], [R, H], [R, H + 0.1 * R], [-R, H + 0.1 * R]], { fill: '#7f8c8d', stroke: '#2c3e50', sw: 1.5 });
      D.poly([[-0.08 * R, H + 0.1 * R], [0.08 * R, H + 0.1 * R], [0.08 * R, H + 0.9 * R], [-0.08 * R, H + 0.9 * R]], { fill: '#5d6d7e', stroke: '#2c3e50' });
      D.dim([-R, H + 0.1 * R], [R, H + 0.1 * R], `2R = ${f(2 * R)} ${u.len}`, -24);
      D.dim([1.5 * R, 0], [1.5 * R, H], `H = ${f(H)} ${u.len}`, -10, { anchor: 'start', ldx: 8 });
      D.text([R * 0.5, H * 0.5], `α = ${f(g.alpha / DEG)}°`, { dx: 12, color: '#34495e' });
    }
    D.arc([0, top + 0.95 * R], 24, -60, 240, `N = ${f(s.N)} rpm`, { color: '#c0392b' });
    D.text([0.35 * R, top + 0.6 * R], `T = ${f(g.T)} ${u.T}`, { color: '#c0392b', size: 13 });
    D.text([R, tf / 2], `film t = ${f(s.t)} ${u.t} (exaggerated)`, { dx: 12, dy: 4, size: 11, color: OILD });
    D.text([D.W - 170, 30], 'τ = μ ω r / t grows with r', { px: true, size: 11, color: '#34495e' });
    // shear distribution triangle under the disk
  }

  function visc2D(svg, s, g, u) {
    const R = s.R, L = s.Lc, c = Math.max(g.t, 0.1 * R), tb = s.bottom ? Math.max(g.tb, 0.1 * R) : 0.15 * R, w = 0.2 * R;
    const D = root.UI.Draw2D(svg, { xmin: -R - c - w - 0.4 * R, xmax: R + c + w + 0.8 * R, ymin: -tb - w - 0.3 * R, ymax: 1.5 * L }, { pad: 46, padR: 180 });
    D.poly([[-R - c - w, 1.15 * L], [-R - c, 1.15 * L], [-R - c, -tb], [R + c, -tb], [R + c, 1.15 * L], [R + c + w, 1.15 * L], [R + c + w, -tb - w], [-R - c - w, -tb - w]], { fill: 'url(#hatch)', stroke: '#2c3e50', sw: 1.5 });
    D.poly([[-R - c, -tb], [R + c, -tb], [R + c, L], [-R - c, L]], { fill: OIL, op: 0.8, stroke: OILD });
    D.poly([[-R, 0], [R, 0], [R, 1.35 * L], [-R, 1.35 * L]], { fill: '#7f8c8d', stroke: '#2c3e50', sw: 1.5 });
    D.dim([R + c + w, 0], [R + c + w, L], `L = ${f(L)} ${u.len}`, -14, { anchor: 'start', ldx: 8 });
    D.dim([-R, 1.35 * L], [R, 1.35 * L], `2R = ${f(2 * R)} ${u.len}`, -14);
    D.text([-R - c - w, L * 0.5], `gap t = ${f(s.t)} ${u.t}`, { dx: -6, anchor: 'end', size: 11, color: OILD });
    D.arc([0, 1.42 * L], 22, -60, 240, `N = ${f(s.N)} rpm`, { color: '#c0392b' });
    D.text([D.W - 170, 30], `T = ${f(s.Tq)} ${u.T}`, { px: true, size: 13, color: '#c0392b' });
    D.text([D.W - 170, 50], `μ = ${f(g.mu)} ${u.mu}`, { px: true, size: 13, color: '#1e8449' });
  }

  root.MV = MV;
})(window);
