/* =====================================================================
 * Statics extensions (2026-11-25 book-coverage upgrade).
 * Adds extra "situations" to the existing FM modules without touching
 * their own solvers:
 *   Pressure        → comp (air & compressible fluids, barometer, bubbles),
 *                     incl (inclined-tube gauge with reservoir)
 *   Hydrostatic F.  → any (plane area of any shape, lateral CP), hoop
 *   Buoyancy        → hydro (hydrometer), balloon, volb (volume / weighings only)
 *   Rel. equilibrium→ rotu (rotating U-tube)
 * Each extension keeps its own inputs in state.x[key]; the host module
 * stores the choice in state.sub and hands control here when StatX.is(sub).
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Physics, Scene } = root;
  const f = Physics.fmt;
  const PI = Math.PI, DEG = PI / 180;
  const WATER = '#4aa3df', WATERD = '#1f6fa8', OIL = '#e0b84a', HG = '#95a5a6', GAS = '#eaf3f9', STEEL = '#9aa3ad', GATE = '#e67e22';
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const liqCol = (sg) => (sg > 5 ? HG : sg < 0.97 ? OIL : sg > 1.1 ? '#48c9b0' : WATER);
  const SI = (U) => U.id === 'SI';
  const pick = (U, a, b) => (SI(U) ? a : b);
  const ENR = 5.97994; // J/(kg·K) → ft·lb/(slug·°R)

  /* ------------------------------------------------------------------ */
  const X = {};

  /* ---------------- Pressure: air & compressible fluids --------------- */
  X.comp = {
    mod: 'mp', label: 'Air & compressible',
    def: { ca: 'isoT', gas: 'air', T1: 20, p1: 101.3, dz: 1000, lapse: 0.0065, zT: 0, rhoInc: 0, rho1: 0, sgL: 1, Ev: 2.2, hd: 300, hd2: 0, rho0: 1000, krho: 0.2, db: 10, patm: 101.3, pvap: 0, bsolve: 'h', hbar: 760 },
    controls(x, el, C, U, sl) {
      C.seg(el, { label: 'Case', options: [['isoT', 'Isothermal air'], ['lapse', 'Temperature falls with height'], ['liqE', 'Compressible liquid (E)'], ['varrho', 'Density varies with depth'], ['bubble', 'Rising gas bubble'], ['baro', 'Barometer']], get: () => x.ca, set: (v) => (x.ca = v) });
      const pu = pick(U, 'kPa', 'psi'), Tu = pick(U, '°C', '°F');
      if (x.ca === 'isoT' || x.ca === 'lapse') {
        const g = C.section(el, 'Gas at the lower level');
        C.select(g, { label: 'Gas', options: Object.keys(Physics.GASES).map((k) => [k, Physics.GASES[k].name]), get: () => x.gas, set: (v) => (x.gas = v) });
        sl(g, 'T1', 'Temperature T₁', -80, 200, 0.1, Tu);
        sl(g, 'p1', 'Absolute pressure p₁', 0.1, pick(U, 500, 80), 0.01, pu + ' abs');
        sl(g, 'rho1', 'Density ρ₁ if given (0 = from the gas law)', 0, pick(U, 5, 0.01), 0.00001, pick(U, 'kg/m³', 'slug/ft³'));
        const z = C.section(el, 'Height');
        sl(z, 'dz', 'Rise in elevation Δz', 0, pick(U, 30000, 100000), 1, U.len);
        if (x.ca === 'lapse') {
          sl(z, 'lapse', 'Lapse rate C (temperature drop per unit height)', -0.05, 0.05, 0.0001, pick(U, 'K/m', '°R/ft'));
          sl(z, 'zT', 'Isothermal above this height (0 = none; 11 000 m stratosphere)', 0, pick(U, 30000, 100000), 1, U.len);
        }
        sl(z, 'rhoInc', 'Density for the incompressible comparison (0 = ρ₁)', 0, pick(U, 5, 0.01), 0.00001, pick(U, 'kg/m³', 'slug/ft³'));
      } else if (x.ca === 'liqE') {
        const g = C.section(el, 'Liquid');
        sl(g, 'sgL', 'Specific gravity at the surface', 0.5, 13.6, 0.0001, '');
        sl(g, 'Ev', 'Bulk modulus E (constant)', 0.01, pick(U, 30, 1e6), 0.01, pick(U, 'GPa', 'psi'));
        sl(g, 'hd', 'Depth h', 0, pick(U, 12000, 40000), 0.1, U.len);
      } else if (x.ca === 'varrho') {
        const g = C.section(el, 'Density ρ = ρ₀ + k h');
        sl(g, 'rho0', 'Surface density ρ₀', 0.1, pick(U, 20000, 40), 0.01, pick(U, 'kg/m³', 'slug/ft³'));
        sl(g, 'krho', 'Rate k (per unit depth)', -100, 1000, 0.001, pick(U, 'kg/m⁴', 'slug/ft⁴'));
        sl(g, 'hd', 'Depth h', 0, pick(U, 12000, 40000), 0.01, U.len);
      } else if (x.ca === 'bubble') {
        const g = C.section(el, 'Bubble (isothermal, pV = constant)');
        sl(g, 'sgL', 'Liquid Sg', 0.5, 13.6, 0.01, '');
        sl(g, 'patm', 'Atmospheric pressure', 0.1, pick(U, 120, 20), 0.01, pu + ' abs');
        sl(g, 'hd', 'Starting depth h₁', 0, pick(U, 500, 1500), 0.01, U.len);
        sl(g, 'hd2', 'New depth h₂ (0 = surface)', 0, pick(U, 500, 1500), 0.01, U.len);
        sl(g, 'db', 'Diameter at h₁', 0.001, pick(U, 1000, 40), 0.001, pick(U, 'mm', 'in'));
      } else {
        const g = C.section(el, 'Barometer');
        sl(g, 'sgL', 'Barometer liquid Sg (mercury 13.6)', 0.5, 13.6, 0.0001, '');
        C.seg(g, { label: 'Find', options: [['h', 'Column height'], ['p', 'Atmospheric pressure']], get: () => x.bsolve, set: (v) => (x.bsolve = v) });
        if (x.bsolve === 'h') sl(g, 'patm', 'Atmospheric pressure', 0.1, pick(U, 120, 20), 0.001, pu + ' abs');
        else sl(g, 'hbar', 'Column reading h', 1, pick(U, 12000, 500), 0.1, pick(U, 'mm', 'in'));
        sl(g, 'pvap', 'Vapour pressure of the liquid (0 for mercury)', 0, pick(U, 50, 5), 0.0001, pu + ' abs');
      }
    },
    compute(x, U) {
      const G = Physics.GASES[x.gas] || Physics.GASES.air;
      const r = Physics.compress(Object.assign({}, x, { Rg: SI(U) ? G.R : G.R * ENR }), U);
      if (r.ok && (x.ca === 'isoT' || x.ca === 'lapse') && r.geo.pInc < 0) r.warn.push('The incompressible model gives a negative pressure at that height, so it does not apply.');
      return r;
    },
    scene(x, res, U) {
      const g = res.geo, sc = Scene.Scene();
      if (g.ca === 'isoT' || g.ca === 'lapse' || g.ca === 'liqE' || g.ca === 'varrho') {
        const gas = g.ca === 'isoT' || g.ca === 'lapse';
        const H = gas ? g.dz : g.h;
        const n = 8;
        for (let i = 0; i < n; i++) {
          const y0 = gas ? (H * i) / n : (-H * (i + 1)) / n, y1 = y0 + H / n;
          const a = gas ? 0.75 - (0.6 * i) / n : 0.35 + (0.5 * i) / n;
          sc.rect(0, y0, H * 0.35, y1, { fill: gas ? '#aed6f1' : WATER, stroke: 'none', fop: a }, { fill: gas ? '#aed6f1' : WATER, alpha: a, z0: -H * 0.175, z1: H * 0.175 });
        }
        sc.rect(0, gas ? 0 : -H, H * 0.35, gas ? H : 0, { fill: 'none', stroke: '#2c3e50', sw: 1.5 }, false);
        if (gas) { sc.text([H * 0.4, 0], `p₁ = ${f(g.p1)} ${g.pu}`, { in3: true }); sc.text([H * 0.4, H], `p₂ = ${f(g.p2)} ${g.pu}`, { in3: true, color: '#c0392b' }); if (g.zT) sc.line([0, g.zT], [H * 0.35, g.zT], { stroke: '#8e44ad', dash: '6 4' }); }
        else { sc.fs([H * 0.3, 0]); sc.text([H * 0.4, -H], `p = ${f(g.pEnd)} ${g.pu}`, { in3: true, color: '#c0392b' }); }
        sc.dim([0, gas ? 0 : -H], [0, gas ? H : 0], gas ? `Δz = ${f(H)} ${U.len}` : `h = ${f(H)} ${U.len}`, 30);
        sc.depth = H * 0.35;
        sc.chart2 = (D, box) => {
          const ser = [{ pts: g.prof, color: '#1F5FA8', marks: [[g.prof[g.prof.length - 1][0], g.prof[g.prof.length - 1][1], `${f(g.prof[g.prof.length - 1][0])} ${g.pu}`, '#c0392b']] }];
          if (gas) ser.push({ pts: [[g.p1, 0], [Math.max(0, g.pInc), g.pInc > 0 ? g.dz : (g.p1 / (g.p1 - g.pInc)) * g.dz]], color: '#7f8c8d', dash: '6 4', w: 1.5 });
          Scene.chart(D, box, ser, { xl: gas ? `Absolute pressure (${g.pu})` : `Gauge pressure (${g.pu})`, yl: gas ? `Elevation (${U.len})` : `Depth (${U.len}, down −)`, xmin: gas ? undefined : 0 });
          if (gas) D.text([box[0] + box[2], box[1] - 8], 'dashed: incompressible', { px: true, size: 11, anchor: 'end', color: '#7f8c8d' });
        };
        return sc;
      }
      if (g.ca === 'bubble') {
        const H = Math.max(g.h1, g.h2, 1e-6) * 1.15, W = H * 0.8, r1 = H * 0.05, r2 = (r1 * g.d2) / g.d1;
        sc.rect(0, -H, W, 0, { fill: WATER, stroke: WATERD, fop: 0.45 }, { fill: WATER, alpha: 0.3, z0: -W / 3, z1: W / 3 });
        sc.fs([W * 0.85, 0]);
        sc.circle([W * 0.35, -g.h1], r1, { fill: GAS, stroke: '#5d6d7e', sw: 1.5 }, 'sphere', '#ecf0f1');
        sc.circle([W * 0.6, -g.h2 + (g.h2 < r2 ? 0 : 0)], r2, { fill: GAS, stroke: '#5d6d7e', sw: 1.5 }, 'sphere', '#ecf0f1');
        sc.arrow([W * 0.4, -g.h1 + r1 * 1.4], [W * 0.55, -g.h2 - r2 * 1.4], { color: '#7f8c8d' });
        sc.text([W * 0.35 + r1 * 1.6, -g.h1], `d₁ = ${f(g.d1)} ${pick(U, 'mm', 'in')}`, { in3: true });
        sc.text([W * 0.6 + r2 * 1.4, -g.h2 - r2], `d₂ = ${f(g.d2)} ${pick(U, 'mm', 'in')}`, { in3: true, color: '#c0392b' });
        sc.dim([0, 0], [0, -g.h1], `h₁ = ${f(g.h1)} ${U.len}`, 30);
        sc.depth = W * 0.66;
        return sc;
      }
      // barometer
      const hb = g.hb, W = hb * 0.5, tw = hb * 0.07, col = liqCol(g.sg);
      sc.rect(-W, -hb * 0.18, W, 0, { fill: col, stroke: '#2c3e50', fop: 0.6 }, { fill: col, alpha: 0.5, z0: -W / 2, z1: W / 2 });
      sc.rect(-tw, -hb * 0.12, tw, hb, { fill: col, stroke: 'none', fop: 0.85 }, { fill: col, alpha: 0.7, z0: -tw, z1: tw });
      sc.rect(-tw, hb, tw, hb * 1.15, { fill: '#ffffff', stroke: 'none' }, false);
      sc.rect(-tw * 1.3, -hb * 0.12, tw * 1.3, hb * 1.15, { fill: 'none', stroke: '#2c3e50', sw: 1.5 }, false);
      sc.text([tw * 1.6, hb * 1.08], 'vapour (p_v)', { color: '#52606d' });
      sc.dim([tw * 1.3, 0], [tw * 1.3, hb], `h = ${f(hb * pick(U, 1000, 12))} ${pick(U, 'mm', 'in')}`, 40);
      [-0.8, 0.8].forEach((k) => sc.arrow([k * W, hb * 0.4], [k * W, 0.02 * hb], { color: '#c0392b', label: k < 0 ? 'p_atm' : '' }));
      sc.depth = W;
      return sc;
    },
  };

  /* ---------------- Pressure: inclined-tube gauge ---------------------- */
  X.incl = {
    mod: 'mp', label: 'Inclined gauge',
    def: { sgM: 0.83, sgF: 0, thI: 20, useRes: true, dt: 6, Dr: 60, isolve: 'dp', Lr: 0.12, dpI: 0.3 },
    controls(x, el, C, U, sl) {
      const g = C.section(el, 'Gauge');
      sl(g, 'sgM', 'Gauge liquid Sg_m', 0.5, 13.6, 0.001, '');
      sl(g, 'sgF', 'Fluid above the liquid Sg_f (0 = air or gas)', 0, 13.6, 0.001, '');
      sl(g, 'thI', 'Tube angle θ from horizontal', 1, 90, 0.1, '°');
      C.toggle(g, { label: 'Allow for the reservoir level drop', get: () => x.useRes, set: (v) => (x.useRes = v) });
      if (x.useRes) { sl(g, 'dt', 'Tube diameter d', 0.1, 200, 0.01, pick(U, 'mm', 'in')); sl(g, 'Dr', 'Reservoir diameter D', 0.1, 2000, 0.01, pick(U, 'mm', 'in')); }
      C.seg(g, { label: 'Find', options: [['dp', 'Δp from the reading'], ['L', 'Reading from Δp']], get: () => x.isolve, set: (v) => (x.isolve = v) });
      if (x.isolve === 'dp') sl(g, 'Lr', 'Reading L along the tube', 0, 10, 0.0001, U.len);
      else sl(g, 'dpI', 'Pressure difference p_A − p_B', 0, 1000, 0.0001, U.press);
    },
    compute: (x, U) => Physics.inclined(x, U),
    scene(x, res, U) {
      const g = res.geo, sc = Scene.Scene(), th = g.th * DEG, col = liqCol(x.sgM);
      const Lt = 3, tw = 0.08, Lv = Math.max(0.15, Math.min(Lt * 0.9, 1.2 + 0 * g.L));
      sc.rect(-1.2, -0.4, 0, 0.9, { fill: 'none', stroke: '#2c3e50', sw: 2 }, { fill: '#d6eaf8', alpha: 0.25 });
      sc.rect(-1.2, -0.4, 0, 0.5, { fill: col, stroke: 'none', fop: 0.75 }, { fill: col, alpha: 0.6 });
      sc.line([-1.2, 0.56], [0, 0.56], { stroke: '#7f8c8d', dash: '4 3' });
      sc.text([-1.15, 0.7], 'zero line', { color: '#7f8c8d', size: 11 });
      const ux = Math.cos(th), uy = Math.sin(th), nx = -uy * tw, ny = ux * tw;
      const A0 = [0, -0.3];
      const at = (s) => [A0[0] + ux * s, A0[1] + uy * s];
      const quad = (s0, s1) => [[at(s0)[0] - nx, at(s0)[1] - ny], [at(s1)[0] - nx, at(s1)[1] - ny], [at(s1)[0] + nx, at(s1)[1] + ny], [at(s0)[0] + nx, at(s0)[1] + ny]];
      sc.poly(quad(0, Lt), { fill: '#ffffff', stroke: '#2c3e50', sw: 1.5 }, { fill: '#d6eaf8', alpha: 0.3, z0: -tw, z1: tw });
      sc.poly(quad(0, Lv), { fill: col, stroke: 'none', fop: 0.85 }, { fill: col, alpha: 0.7, z0: -tw * 0.8, z1: tw * 0.8 });
      sc.arrow([-0.6, 1.5], [-0.6, 0.95], { color: '#c0392b', label: 'p_A' });
      sc.arrow([at(Lt)[0] + 0.3, at(Lt)[1] + 0.5], at(Lt), { color: '#2980b9', label: 'p_B' });
      sc.dim(at(Lv * 0.38), at(Lv), `L = ${f(g.L)} ${U.len}`, -26);
      sc.text([0.25, -0.2], `θ = ${f(g.th)}°`, { color: '#52606d' });
      sc.depth = 0.5;
      return sc;
    },
  };

  /* ---------------- Hydrostatic forces: any plane area ---------------- */
  X.any = {
    mod: 'm1', label: 'Any shape (lateral CP)',
    def: { sgA: 1, incl: false, thA: 60, pshape: 'parab', porient: 'up', pb: 2, ph: 4, pd: 0, ptxt: '0, 0\n4, 0\n4, 8\n0, 14', psA: 0, hingeA: false, sHinge: 0, sProp: 4 },
    controls(x, el, C, U, sl) {
      C.sg(el, { get: () => x.sgA, set: (v) => (x.sgA = v) });
      const g = C.section(el, 'Shape');
      C.select(g, { label: 'Area', options: [['parab', 'Parabolic segment'], ['spandrel', 'Semi-parabola (spandrel)'], ['rtri', 'Right triangle'], ['qcirc', 'Quarter circle'], ['poly', 'Polygon (type the corners)']], get: () => x.pshape, set: (v) => (x.pshape = v) });
      if (x.pshape === 'poly') {
        C.note(g, 'One corner per line as "x, s": x across the plate, s measured down the plate from the free-surface line (s ≥ 0).');
        const ta = root.UI.h('textarea', { rows: 6, class: 'num', style: { width: '100%', fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px' } });
        ta.value = x.ptxt;
        ta.addEventListener('input', () => { x.ptxt = ta.value; root.App.update(); });
        g.append(ta);
      } else {
        if (x.pshape === 'qcirc') sl(g, 'pb', 'Radius r', 0.01, 50, 0.001, U.len);
        else { sl(g, 'pb', x.pshape === 'parab' ? 'Chord width b' : 'Width b', 0.01, 50, 0.001, U.len); sl(g, 'ph', 'Height h (down the plate)', 0.01, 50, 0.001, U.len); }
        if (x.pshape !== 'spandrel') C.seg(g, { label: 'Orientation', options: x.pshape === 'parab' ? [['up', 'Chord at top'], ['down', 'Chord at bottom']] : x.pshape === 'rtri' ? [['up', 'Base at bottom'], ['down', 'Base at top']] : [['down', 'Straight edge on top'], ['up', 'Straight edge at bottom']], get: () => x.porient, set: (v) => (x.porient = v) });
        sl(g, 'pd', 'Top of the area below the surface line (along the plate)', 0, 100, 0.001, U.len);
      }
      const p = C.section(el, 'Wall and loading');
      C.toggle(p, { label: 'Inclined wall', get: () => x.incl, set: (v) => (x.incl = v) });
      if (x.incl) sl(p, 'thA', 'Wall angle θ from horizontal', 5, 90, 0.1, '°');
      sl(p, 'psA', 'Gas pressure on the surface (gauge)', 0, 1000, 0.01, U.press);
      C.toggle(p, { label: 'Hinged along a horizontal line', get: () => x.hingeA, set: (v) => (x.hingeA = v) });
      if (x.hingeA) { sl(p, 'sHinge', 'Hinge line s_h (down the plate)', 0, 100, 0.001, U.len); sl(p, 'sProp', 'Support (stop) line s_P', 0, 100, 0.001, U.len); }
    },
    compute(x, U) {
      const ppts = String(x.ptxt || '').split(/\n|;/).map((l) => l.split(/[ ,\t]+/).filter(Boolean).map(Number)).filter((q) => q.length >= 2 && isFinite(q[0]) && isFinite(q[1]));
      return Physics.planeAny(Object.assign({}, x, { ppts }), U);
    },
    scene(x, res, U) {
      const g = res.geo, sc = Scene.Scene();
      const pts = g.pts.map((q) => [q[0], -q[1]]);
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), yb = Math.min(...ys), span = Math.max(x1 - x0, -yb, 1e-6);
      sc.rect(x0 - span * 0.35, yb - span * 0.1, x1 + span * 0.35, 0, { fill: WATER, stroke: 'none', fop: 0.18 }, false);
      sc.line([x0 - span * 0.35, 0], [x1 + span * 0.35, 0], { stroke: WATERD, sw: 2 });
      sc.text([x0 - span * 0.33, span * 0.04], g.th < 90 ? `surface line (wall at ${f(g.th)}°)` : 'free surface', { color: WATERD, size: 12 });
      if (g.sEq) { sc.line([x0 - span * 0.35, g.sEq], [x1 + span * 0.35, g.sEq], { stroke: '#8e44ad', dash: '6 4' }); sc.text([x1 + span * 0.05, g.sEq + span * 0.03], 'imaginary surface', { color: '#8e44ad', size: 11 }); }
      sc.poly(pts, { fill: GATE, stroke: '#a04000', sw: 2, fop: 0.75 }, { fill: GATE, alpha: 0.85, z0: -span * 0.02, z1: span * 0.02 });
      sc.dot([g.G.xc, -g.G.sc], '#16a085', 'G');
      sc.dot([g.xp, -g.yp], '#c0392b', 'CP');
      sc.line([g.G.xc, 0], [g.G.xc, -g.G.sc], { stroke: '#16a085', dash: '3 3' });
      sc.dim([x1 + span * 0.12, 0], [x1 + span * 0.12, -g.yp], `y_p = ${f(g.yp)} ${U.len}`, 22);
      if (Math.abs(g.xp - g.G.xc) > span * 0.01) sc.dim([g.G.xc, yb - span * 0.04], [g.xp, yb - span * 0.04], `x_p − x̄ = ${f(g.xp - g.G.xc)}`, -16);
      sc.text([g.xp + span * 0.04, -g.yp - span * 0.08], `F = ${f(g.F)} ${U.force}`, { color: '#c0392b', size: 13, in3: true });
      sc.depth = span * 0.3;
      return sc;
    },
  };

  /* ---------------- Hydrostatic forces: hoop tension -------------------- */
  X.hoop = {
    mod: 'm1', label: 'Hoop tension',
    def: { vessel: 'cyl', Dh: 1.2, sgH: 1, pBy: 'head', hH: 100, pH: 1000, hsolve: 's', sAllow: 124, tH: 6, bandA: 500 },
    controls(x, el, C, U, sl) {
      const g = C.section(el, 'Vessel');
      C.seg(g, { label: 'Type', options: [['cyl', 'Pipe / cylinder'], ['sphere', 'Sphere'], ['band', 'Banded vat or stave pipe']], get: () => x.vessel, set: (v) => (x.vessel = v) });
      sl(g, 'Dh', 'Diameter D', 0.01, 100, 0.001, U.len);
      const p = C.section(el, 'Internal pressure');
      C.seg(p, { label: 'Given as', options: [['head', 'Head of liquid'], ['p', 'Pressure']], get: () => x.pBy, set: (v) => (x.pBy = v) });
      if (x.pBy === 'head') { sl(p, 'sgH', 'Liquid Sg', 0.5, 13.6, 0.001, ''); sl(p, 'hH', 'Head h', 0, 2000, 0.01, U.len); }
      else if (!(x.vessel !== 'band' && x.hsolve === 'p')) sl(p, 'pH', 'Pressure p', 0, pick(U, 50000, 200000), 0.01, U.press);
      const s = C.section(el, x.vessel === 'band' ? 'Bands' : 'Wall');
      const su = pick(U, 'MPa', 'psi');
      if (x.vessel === 'band') {
        sl(s, 'bandA', 'Cross-section of one band (width × thickness)', 0.01, pick(U, 20000, 50), 0.001, pick(U, 'mm²', 'in²'));
        sl(s, 'sAllow', 'Allowable stress in the band', 1, pick(U, 1000, 100000), 0.1, su);
      } else {
        C.seg(s, { label: 'Find', options: [['s', 'Stress'], ['t', 'Thickness'], ['p', 'Allowable pressure']], get: () => x.hsolve, set: (v) => (x.hsolve = v) });
        if (x.hsolve !== 't') sl(s, 'tH', 'Wall thickness t', 0.01, pick(U, 500, 20), 0.001, pick(U, 'mm', 'in'));
        if (x.hsolve !== 's') sl(s, 'sAllow', 'Allowable stress σ', 1, pick(U, 1000, 100000), 0.1, su);
      }
    },
    compute: (x, U) => Physics.hoop(x, U),
    scene(x, res, U) {
      const g = res.geo, sc = Scene.Scene();
      if (g.vessel === 'band') {
        const D = g.D, H = D * 1.1, n = Math.max(2, Math.min(14, Math.floor(H / Math.max(g.s, 1e-9)))), sp = H / n;
        sc.lathe([[0, 0], [D / 2, 0], [D / 2, H * 0.9], [0, H * 0.9]], 0, WATER, 0.35);
        sc.lathe([[D / 2, 0], [D / 2 * 1.04, 0], [D / 2 * 1.04, H], [D / 2, H]], 0, '#c8a165', 0.55);
        sc.rect(-D / 2, 0, D / 2, H * 0.9, { fill: WATER, stroke: 'none', fop: 0.35 }, false);
        sc.rect(-D / 2 * 1.04, 0, -D / 2, H, { fill: '#c8a165', stroke: '#7e5109' }, false);
        sc.rect(D / 2, 0, D / 2 * 1.04, H, { fill: '#c8a165', stroke: '#7e5109' }, false);
        for (let i = 0; i <= n; i++) sc.rect(-D / 2 * 1.07, i * sp, D / 2 * 1.07, i * sp + H * 0.012, { fill: '#2c3e50', stroke: 'none' }, false);
        sc.dim([D / 2 * 1.07, 0], [D / 2 * 1.07, Math.min(H, Math.max(g.s, H * 0.06))], `s = ${f(g.s * pick(U, 1000, 12))} ${pick(U, 'mm', 'in')} (at the bottom)`, 30);
        sc.dim([-D / 2, -H * 0.05], [D / 2, -H * 0.05], `D = ${f(D)} ${U.len}`, -8);
        sc.text([-D / 2 * 0.9, H * 0.45], 'liquid', { color: WATERD });
        sc.depth = D;
        return sc;
      }
      const R = 1, t = 0.12;
      if (g.vessel === 'sphere') sc.circle([0, 0], R, { fill: WATER, stroke: '#2c3e50', sw: 4, fop: 0.4 }, 'sphere', STEEL);
      else {
        sc.circle([0, 0], R, { fill: STEEL, stroke: '#2c3e50', sw: 1.5 }, false);
        sc.circle([0, 0], R - t, { fill: WATER, stroke: '#2c3e50', sw: 1.5, fop: 0.7 }, false);
        sc.lathe([[R - t, -1.6], [R, -1.6], [R, 1.6], [R - t, 1.6]], 0, STEEL, 0.45);
      }
      for (let i = 0; i < 12; i++) { const a = (2 * PI * i) / 12; sc.arrow([0.45 * Math.cos(a), 0.45 * Math.sin(a)], [(R - t - 0.04) * Math.cos(a), (R - t - 0.04) * Math.sin(a)], { color: '#c0392b', w: 1.4, head: 7 }).only2d = true; }
      sc.text([0, 0], 'p', { anchor: 'middle', size: 16, color: '#c0392b' });
      [[R - t / 2, 0.75], [-(R - t / 2), -0.75]].forEach(([xx, dy]) => { sc.arrow([xx, 0], [xx, dy], { color: '#8e44ad', label: 'T' }).only2d = true; });
      sc.text([R, 1.7], g.vessel === 'sphere' ? 'σ = p D / (4t)' : 'σ = p D / (2t)', { color: '#8e44ad', in3: true }).only3d = true;
      sc.dim([-R, -R - 0.15], [R, -R - 0.15], `D = ${f(g.D)} ${U.len}`, -8);
      sc.text([R + 0.12, 0.6], `t = ${f(g.t * pick(U, 1000, 12))} ${pick(U, 'mm', 'in')}`, { color: '#52606d' });
      sc.depth = 3.2;
      return sc;
    },
  };

  /* ---------------- Buoyancy: hydrometer -------------------------------- */
  X.hydro = {
    mod: 'm2', label: 'Hydrometer',
    def: { Wh: 0.0216, stemBy: 'd', dst: 2.8, aSt: 6, S1h: 1, S2h: 0.9, hsol: 'dh', dhh: 10 },
    controls(x, el, C, U, sl) {
      const g = C.section(el, 'Hydrometer');
      sl(g, 'Wh', 'Weight W', 0.00001, pick(U, 10, 2), 0.00001, pick(U, 'N', 'lb'));
      C.seg(g, { label: 'Stem given by', options: [['d', 'Diameter'], ['a', 'Area']], get: () => x.stemBy, set: (v) => (x.stemBy = v) });
      if (x.stemBy === 'd') sl(g, 'dst', 'Stem diameter d', 0.01, pick(U, 50, 2), 0.001, pick(U, 'mm', 'in'));
      else sl(g, 'aSt', 'Stem area a', 0.0001, pick(U, 2000, 4), 0.0001, pick(U, 'mm²', 'in²'));
      const l = C.section(el, 'Liquids');
      sl(l, 'S1h', 'Liquid 1 Sg (reference mark)', 0.3, 3, 0.001, '');
      C.seg(l, { label: 'Find', options: [['dh', 'Distance between marks'], ['S', 'Sg of liquid 2']], get: () => x.hsol, set: (v) => (x.hsol = v) });
      if (x.hsol === 'dh') sl(l, 'S2h', 'Liquid 2 Sg', 0.3, 3, 0.001, '');
      else sl(l, 'dhh', 'Rise of the stem in liquid 2 (+ up, − down)', -500, 500, 0.01, pick(U, 'mm', 'in'));
    },
    compute: (x, U) => Physics.hydrometer(x, U),
    scene(x, res, U) {
      const g = res.geo, sc = Scene.Scene();
      const draw = (cx, S, shift, lab) => {
        sc.rect(cx - 0.6, -2.2, cx + 0.6, 0, { fill: liqCol(S), stroke: 'none', fop: 0.4 }, false);
        sc.lathe([[0, -2.2], [0.6, -2.2], [0.6, 0], [0, 0]], cx, liqCol(S), 0.25);
        sc.rect(cx - 0.62, -2.25, cx + 0.62, 0.9, { fill: 'none', stroke: '#2c3e50', sw: 1.5 }, false);
        sc.line([cx - 0.6, 0], [cx + 0.6, 0], { stroke: WATERD, sw: 1.5 });
        const yb = -1.4 + shift;
        sc.circle([cx, yb], 0.28, { fill: '#f4f6f7', stroke: '#2c3e50', sw: 1.5 }, 'sphere', '#ecf0f1');
        sc.rect(cx - 0.05, yb + 0.26, cx + 0.05, yb + 2.1, { fill: '#f4f6f7', stroke: '#2c3e50', sw: 1.2 }, { fill: '#ecf0f1', alpha: 0.9, z0: -0.05, z1: 0.05 });
        sc.text([cx, -2.5], lab, { anchor: 'middle', in3: true });
      };
      const sh = Math.abs(g.dh) < 1e-12 ? 0 : g.dh > 0 ? 0.35 : -0.35; // exaggerated
      draw(0, g.S1, 0, `Liquid 1, S = ${f(g.S1)}`);
      draw(1.8, g.S2, sh, `Liquid 2, S = ${f(g.S2)}`);
      sc.line([0.05, 0], [1.75, 0], { stroke: '#7f8c8d', dash: '3 3' });
      sc.text([2.5, 0.3], `Δh = ${f(g.dh * pick(U, 1000, 12))} ${pick(U, 'mm', 'in')} ${g.dh >= 0 ? 'higher' : 'deeper'}`, { color: '#c0392b' });
      sc.depth = 1.2;
      return sc;
    },
  };

  /* ---------------- Buoyancy: balloon ----------------------------------- */
  X.balloon = {
    mod: 'm2', label: 'Balloon (gas lift)',
    def: { gasB: 'he', Tair: 15, Tin: 100, pB: 101.3, gamA: 12, gamG: 2, bsol: 'load', Vby: 'D', DB: 8, VB: 250, WB: 500, Wpay: 1000 },
    controls(x, el, C, U, sl) {
      const g = C.section(el, 'Gas');
      C.select(g, { label: 'Lifting gas', options: [['he', 'Helium'], ['h2', 'Hydrogen'], ['hot', 'Heated air'], ['given', 'Unit weights given']], get: () => x.gasB, set: (v) => (x.gasB = v) });
      if (x.gasB === 'given') {
        sl(g, 'gamA', 'Unit weight of the air γ_a', 0, pick(U, 20, 0.2), 0.00001, pick(U, 'N/m³', 'lb/ft³'));
        sl(g, 'gamG', 'Unit weight of the gas γ_g', 0, pick(U, 20, 0.2), 0.00001, pick(U, 'N/m³', 'lb/ft³'));
      } else {
        sl(g, 'Tair', 'Outside air temperature', -60, 60, 0.1, pick(U, '°C', '°F'));
        if (x.gasB === 'hot') sl(g, 'Tin', 'Air temperature inside', -60, 300, 0.1, pick(U, '°C', '°F'));
        sl(g, 'pB', 'Atmospheric pressure', 1, pick(U, 120, 20), 0.01, pick(U, 'kPa abs', 'psi abs'));
      }
      const b = C.section(el, 'Balloon');
      C.seg(b, { label: 'Find', options: [['load', 'Payload it can lift'], ['size', 'Size needed']], get: () => x.bsol, set: (v) => (x.bsol = v) });
      if (x.bsol === 'load') {
        C.seg(b, { label: 'Size given by', options: [['D', 'Diameter (sphere)'], ['V', 'Volume']], get: () => x.Vby, set: (v) => (x.Vby = v) });
        if (x.Vby === 'D') sl(b, 'DB', 'Diameter D', 0.01, 100, 0.001, U.len);
        else sl(b, 'VB', 'Volume V', 0.001, pick(U, 50000, 2000000), 0.001, U.vol);
      } else sl(b, 'Wpay', 'Payload to lift', 0, pick(U, 1e6, 1e5), 0.01, pick(U, 'N', 'lb'));
      sl(b, 'WB', 'Weight of the empty balloon and gear', 0, pick(U, 1e6, 1e5), 0.01, pick(U, 'N', 'lb'));
    },
    compute: (x, U) => Physics.balloon(x, U),
    scene(x, res, U) {
      const g = res.geo, sc = Scene.Scene(), R = 1;
      sc.circle([0, 1.6], R, { fill: x.gasB === 'hot' ? '#f5b041' : '#d6eaf8', stroke: '#2c3e50', sw: 2, fop: 0.85 }, 'sphere', x.gasB === 'hot' ? '#f5b041' : '#d6eaf8');
      sc.line([-0.7, 0.9], [-0.25, 0], { stroke: '#5d6d7e' }); sc.line([0.7, 0.9], [0.25, 0], { stroke: '#5d6d7e' });
      sc.rect(-0.3, -0.35, 0.3, 0, { fill: '#c8a165', stroke: '#7e5109' }, { fill: '#c8a165', alpha: 1, z0: -0.3, z1: 0.3 });
      sc.arrow([0, 2.65], [0, 3.6], { color: '#2980b9', label: 'buoyancy − gas weight' });
      sc.arrow([0.45, -0.18], [0.45, -1.1], { color: '#2c3e50', label: 'payload + balloon' });
      sc.dim([-R, 0.45], [R, 0.45], `D = ${f(g.D)} ${U.len}`, -6);
      sc.text([1.15, 1.9], `V = ${f(g.V)} ${U.vol}`, { color: '#52606d', in3: true });
      sc.depth = 0.6;
      return sc;
    },
  };

  /* ---------------- Buoyancy: volume or weighings only (any shape) ------ */
  X.volb = {
    mod: 'm2', label: 'Volume only (any shape)',
    def: { vc: 'body', gwV: 0, sg1: 1, Vby: 'V', Vv: 2, Dv: 0.3, av: 0.3, matBy: 'sg', sgB: 0.6, gB: 25, WB: 1000,
      wk: 'air1', Wair: 90, Wl1: 50, Wl2: 60, sg2: 0.8, fsolve: 'vol', fby: 'Vab', Vg: 100, subBy: 'pct', subV: 60,
      liq2: false, l2m: 'cmp', fr1: 0.5, tank: false, Atk: 0.5, mix: false, sga: 10.5, sgb: 19.3 },
    controls(x, el, C, U, sl) {
      const Fu = pick(U, 'N', 'lb'), gu = pick(U, 'kN/m³', 'lb/ft³');
      C.seg(el, { label: 'What is known', options: [['body', 'Volume + material'], ['weigh', 'Weighings'], ['float', 'Floating body']], get: () => x.vc, set: (v) => (x.vc = v) });
      const l = C.section(el, 'Liquid');
      C.sg(l, { label: 'Liquid 1 Sg_L', get: () => x.sg1, set: (v) => (x.sg1 = v) });
      sl(l, 'gwV', `Unit weight of water γ_w (0 = ${pick(U, '9.81 kN/m³', '62.4 lb/ft³')})`, 0, pick(U, 10, 64), 0.001, gu);
      const volCtl = (g) => {
        C.seg(g, { label: 'Volume given as', options: [['V', 'Volume'], ['sph', 'Sphere D'], ['cube', 'Cube side']], get: () => x.Vby, set: (v) => (x.Vby = v) });
        if (x.Vby === 'sph') sl(g, 'Dv', 'Sphere diameter D', 0.001, 100, 0.0001, U.len);
        else if (x.Vby === 'cube') sl(g, 'av', 'Cube side a', 0.001, 100, 0.0001, U.len);
        else sl(g, 'Vv', 'Volume V', 0.000001, pick(U, 1e5, 1e6), 0.000001, U.vol);
      };
      const b = C.section(el, x.vc === 'weigh' ? 'Weighings (apparent weight; − = force to hold it under)' : 'Body');
      if (x.vc === 'body') {
        volCtl(b);
        C.seg(b, { label: 'Material given by', options: [['sg', 'Sg_B'], ['gam', 'Unit weight γ_B'], ['W', 'Weight W']], get: () => x.matBy, set: (v) => (x.matBy = v) });
        if (x.matBy === 'sg') sl(b, 'sgB', 'Body specific gravity Sg_B', 0.001, 25, 0.001, '');
        else if (x.matBy === 'gam') sl(b, 'gB', 'Body unit weight γ_B', 0.001, pick(U, 250, 1500), 0.001, gu);
        else sl(b, 'WB', 'Weight in air W', 0, pick(U, 1e7, 1e6), 0.001, Fu);
      } else if (x.vc === 'weigh') {
        C.select(b, { label: 'Known', options: [['air1', 'Weight in air and in liquid 1'], ['v1', 'Volume and weight in liquid 1'], ['two', 'Weights in liquids 1 and 2'], ['liq', 'Volume and weights in liquids 1 and 2 (find Sg₂)']], get: () => x.wk, set: (v) => (x.wk = v) });
        if (x.wk === 'v1' || x.wk === 'liq') volCtl(b);
        if (x.wk === 'air1') sl(b, 'Wair', 'Weight in air W', 0, pick(U, 1e7, 1e6), 0.001, Fu);
        sl(b, 'Wl1', "Weight in liquid 1 W'₁", -pick(U, 1e7, 1e6), pick(U, 1e7, 1e6), 0.001, Fu);
        if (x.wk === 'two' || x.wk === 'liq') sl(b, 'Wl2', "Weight in liquid 2 W'₂", -pick(U, 1e7, 1e6), pick(U, 1e7, 1e6), 0.001, Fu);
        if (x.wk === 'two') sl(b, 'sg2', 'Liquid 2 Sg₂', 0, 13.6, 0.001, '');
      } else {
        C.seg(b, { label: 'Find', options: [['vol', 'Volumes (Sg_B known)'], ['sg', 'Sg_B (volumes known)']], get: () => x.fsolve, set: (v) => (x.fsolve = v) });
        if (x.fsolve === 'vol') {
          C.seg(b, { label: 'Material given by', options: [['sg', 'Sg_B'], ['gam', 'Unit weight γ_B']], get: () => (x.matBy === 'W' ? 'sg' : x.matBy), set: (v) => (x.matBy = v) });
          if (x.matBy === 'gam') sl(b, 'gB', 'Body unit weight γ_B', 0.001, pick(U, 250, 1500), 0.001, gu);
          else sl(b, 'sgB', 'Body specific gravity Sg_B', 0.001, 25, 0.001, '');
          C.seg(b, { label: 'Volume known', options: [['Vt', 'Total'], ['Vab', 'Above the surface'], ['Vsub', 'Submerged']], get: () => x.fby, set: (v) => (x.fby = v) });
          sl(b, 'Vg', 'That volume', 0.000001, pick(U, 1e7, 1e8), 0.000001, U.vol);
        } else {
          volCtl(b);
          C.seg(b, { label: 'Submergence given as', options: [['pct', '% submerged'], ['Vsub', 'Submerged volume'], ['Vab', 'Volume above']], get: () => x.subBy, set: (v) => (x.subBy = v) });
          sl(b, 'subV', x.subBy === 'pct' ? 'Percent submerged' : x.subBy === 'Vsub' ? 'Submerged volume' : 'Volume above the surface', 0, x.subBy === 'pct' ? 100 : pick(U, 1e5, 1e6), 0.000001, x.subBy === 'pct' ? '%' : U.vol);
        }
      }
      const o = C.section(el, 'Extras');
      if (!(x.vc === 'weigh' && (x.wk === 'two' || x.wk === 'liq'))) {
        C.toggle(o, { label: 'Second liquid', get: () => x.liq2, set: (v) => (x.liq2 = v) });
        if (x.liq2) {
          C.seg(o, { options: [['cmp', 'Weigh it in liquid 2'], ['split', 'Body across both liquids']], get: () => x.l2m, set: (v) => (x.l2m = v) });
          sl(o, 'sg2', 'Liquid 2 Sg₂ (0 = air)', 0, 13.6, 0.001, '');
          if (x.l2m === 'split') sl(o, 'fr1', 'Fraction of the volume in liquid 1', 0, 1, 0.001, '');
        }
      }
      C.toggle(o, { label: 'Liquid rise in a tank', get: () => x.tank, set: (v) => (x.tank = v) });
      if (x.tank) sl(o, 'Atk', 'Tank plan area A', 0.0001, pick(U, 1e4, 1e5), 0.0001, U.area);
      C.toggle(o, { label: 'Body is a mix of two materials (Archimedes’ crown)', get: () => x.mix, set: (v) => (x.mix = v) });
      if (x.mix) { sl(o, 'sga', 'Material A Sg', 0.01, 25, 0.001, ''); sl(o, 'sgb', 'Material B Sg', 0.01, 25, 0.001, ''); }
    },
    compute: (x, U) => Physics.buoyVol(x, U),
    scene(x, res, U) {
      const g = res.geo, sc = Scene.Scene(), R = 0.42, Fu = pick(U, 'N', 'lb');
      const fl = g.floats && (x.vc === 'float' || (x.vc === 'body' && !g.split && !g.two));
      const split = g.split, S2 = x.sg2;
      const cy = fl ? R - 2 * R * g.fsub : -1.05;
      const yi = split ? cy - R + 2 * R * Math.max(0, Math.min(1, g.fr1)) : null;
      // liquid(s)
      const bot = -2.2;
      sc.rect(-1.3, bot, 1.3, split ? yi : 0, { fill: liqCol(g.S1), stroke: 'none', fop: 0.4 }, false);
      sc.lathe([[0, bot], [1.3, bot], [1.3, split ? yi : 0], [0, split ? yi : 0]], 0, liqCol(g.S1), 0.22);
      if (split && S2 > 0) { sc.rect(-1.3, yi, 1.3, 0, { fill: liqCol(S2), stroke: 'none', fop: 0.4 }, false); sc.lathe([[0, yi], [1.3, yi], [1.3, 0], [0, 0]], 0, liqCol(S2), 0.22); }
      if (split) { sc.line([-1.3, yi], [1.3, yi], { stroke: '#b9770e', dash: '6 3' }); sc.text([0.62, yi - 0.14], `S₁ = ${f(g.S1)}`, { color: '#52606d' }); sc.text([0.62, yi + 0.1], S2 > 0 ? `S₂ = ${f(S2)}` : 'air', { color: '#52606d' }); }
      sc.rect(-1.32, bot - 0.04, 1.32, 0.9, { fill: 'none', stroke: '#2c3e50', sw: 1.5 }, false);
      if (!split || S2 > 0) { sc.line([-1.3, 0], [1.3, 0], { stroke: WATERD, sw: 1.5 }); sc.fs([-0.85, 0], {}); }
      if (!split) sc.text([-1.25, -1.95], `Liquid S = ${f(g.S1)}`, { color: '#52606d' });
      // body
      sc.circle([0, cy], R, { fill: '#b08d57', stroke: '#6e4f25', sw: 2 }, 'sphere', '#b08d57');
      sc.text([R + 0.06, fl ? cy - 0.2 : cy + 0.32], `V = ${f(g.V)} ${U.vol}`, { color: '#52606d', in3: true });
      sc.arrow([-0.12, cy], [-0.12, cy - 0.8], { color: '#c0392b' });
      sc.text([-R - 0.08, cy - 0.1], `W = ${f(g.W)} ${Fu}`, { color: '#c0392b', anchor: 'end' });
      sc.arrow([0.12, cy - R - 0.55], [0.12, cy - R + 0.05], { color: '#2980b9', label: `F_B = ${f(fl ? g.W : split ? g.W - g.T : g.BF)} ${Fu}` });
      if (!fl) {
        const T = split ? g.T : g.Wa1;
        if (T >= 0) {
          sc.line([0, cy + R], [0, 1.25], { stroke: '#2c3e50', sw: 1.5 });
          sc.rect(-0.22, 1.25, 0.22, 1.6, { fill: '#ecf0f1', stroke: '#2c3e50', sw: 1.5 }, { fill: '#ecf0f1', alpha: 1, z0: -0.15, z1: 0.15 });
          sc.text([0.3, 1.42], `scale: ${f(T)} ${Fu}`, { color: '#2c3e50' });
        } else {
          sc.arrow([0, cy + R + 0.7], [0, cy + R], { color: '#8e44ad', label: `push ${f(-T)} ${Fu}` });
        }
      }
      if (fl) sc.text([0.35, -1.95], `${f(100 * g.fsub)} % of V submerged`, { color: '#2c3e50' });
      sc.depth = 1.1;
      return sc;
    },
  };

  /* ---------------- Relative equilibrium: rotating U-tube --------------- */
  X.rotu = {
    mod: 'm3', label: 'Rotating U-tube',
    def: { r1u: 0.1, r2u: 0.3, h0u: 0.3, useRpmU: false, Nu: 100, wu: 8, usolve: 'dh', dhu: 0.2, sgU: 1, same: false },
    controls(x, el, C, U, sl) {
      const g = C.section(el, 'U-tube (equal legs, both open)');
      sl(g, 'r1u', 'Radius of leg 1 from the axis r₁', 0, 20, 0.001, U.len);
      sl(g, 'r2u', 'Radius of leg 2 from the axis r₂', 0, 20, 0.001, U.len);
      C.toggle(g, { label: 'Both legs on the same side of the axis (drawing only)', get: () => x.same, set: (v) => (x.same = v) });
      sl(g, 'h0u', 'Liquid height in each leg at rest h₀', 0, 20, 0.001, U.len);
      sl(g, 'sgU', 'Liquid Sg', 0.5, 13.6, 0.01, '');
      const r = C.section(el, 'Rotation');
      C.seg(r, { label: 'Find', options: [['dh', 'Level difference'], ['w', 'Speed for a level difference'], ['empty', 'Speed that empties the inner leg']], get: () => x.usolve, set: (v) => (x.usolve = v) });
      if (x.usolve === 'dh') {
        C.toggle(r, { label: 'Speed in rpm', get: () => x.useRpmU, set: (v) => (x.useRpmU = v) });
        if (x.useRpmU) sl(r, 'Nu', 'Speed N', 0, 5000, 0.1, 'rpm'); else sl(r, 'wu', 'Angular speed ω', 0, 500, 0.01, 'rad/s');
      } else if (x.usolve === 'w') sl(r, 'dhu', 'Level difference Δh = h₂ − h₁', 0, 20, 0.001, U.len);
    },
    compute: (x, U) => Physics.rotUtube(Object.assign({}, x, { useRpmU: x.usolve === 'dh' && x.useRpmU }), U),
    scene(x, res, U) {
      const g = res.geo, sc = Scene.Scene(), col = liqCol(x.sgU);
      const xa = x.same ? g.r1 : -g.r1, xb = g.r2;
      const span = Math.max(Math.abs(xb - xa), g.r2, g.r1, 1e-6), tw = span * 0.05;
      const top = Math.max(g.h1, g.h2, x.h0u, span * 0.3) * 1.25;
      const leg = (cx, h) => {
        sc.rect(cx - tw, 0, cx + tw, top, { fill: '#ffffff', stroke: '#2c3e50', sw: 1.5 }, { fill: '#d6eaf8', alpha: 0.25, z0: -tw, z1: tw });
        if (h > 0) sc.rect(cx - tw, 0, cx + tw, h, { fill: col, stroke: 'none', fop: 0.85 }, { fill: col, alpha: 0.75, z0: -tw * 0.9, z1: tw * 0.9 });
      };
      const xl = Math.min(xa, xb), xr = Math.max(xa, xb);
      sc.rect(xl - tw, -2 * tw, xr + tw, 0, { fill: col, stroke: '#2c3e50', sw: 1.5, fop: 0.85 }, { fill: col, alpha: 0.75, z0: -tw, z1: tw });
      leg(xa, g.h1); leg(xb, g.h2);
      sc.line([0, -span * 0.25], [0, top * 1.1], { stroke: '#7f8c8d', dash: '8 4 2 4' });
      sc.text([span * 0.03, top * 1.12], `ω = ${f(g.w)} rad/s`, { color: '#c0392b', in3: true });
      const par = []; const xm = Math.max(Math.abs(xl), Math.abs(xr)) * 1.1;
      for (let i = 0; i <= 40; i++) { const xx = -xm + (2 * xm * i) / 40; const yy = g.zv + (g.w * g.w * xx * xx) / (2 * U.g); if (yy <= top * 1.1) par.push([xx, yy]); }
      if (par.length > 1) sc.pline(par, { stroke: WATERD, dash: '5 4', sw: 1.4 });
      sc.dim([xr + tw, Math.min(g.h1, g.h2)], [xr + tw, Math.max(g.h1, g.h2)], `Δh = ${f(Math.abs(g.h2 - g.h1))} ${U.len}`, 34);
      sc.dim([0, -span * 0.18], [xa, -span * 0.18], `r₁ = ${f(g.r1)}`, -6);
      sc.dim([0, -span * 0.32], [xb, -span * 0.32], `r₂ = ${f(g.r2)}`, -6);
      sc.depth = tw * 4;
      return sc;
    },
  };

  /* ------------------------------------------------------------------ */
  function st(s, k) {
    s.x = s.x || {};
    if (!s.x[k]) s.x[k] = clone(X[k].def);
    else Object.keys(X[k].def).forEach((q) => { if (s.x[k][q] === undefined) s.x[k][q] = clone(X[k].def[q]); });
    return s.x[k];
  }
  function draw2(svg, sc) {
    if (!sc.chart2) { Scene.draw2D(svg, sc); return; }
    const D = root.UI.Draw2D(svg, { xmin: 0, xmax: 1, ymin: 0, ymax: 1 });
    const box = [80, 50, Math.max(200, D.W - 150), Math.max(160, D.H - 130)];
    sc.chart2(D, box);
  }
  const StatX = {
    is: (k, mod) => !!X[k] && (!mod || X[k].mod === mod),
    options: (mod) => Object.keys(X).filter((k) => X[k].mod === mod).map((k) => [k, X[k].label]),
    controls(k, s, el, C) {
      const x = st(s, k), U = root.App.U();
      const sl = (p, key, label, min, max, step, unit) => C.slider(p, { label, min, max, step, get: () => x[key], set: (v) => (x[key] = v), unit });
      X[k].controls(x, el, C, U, sl);
    },
    compute: (k, s, U) => X[k].compute(st(s, k), U),
    draw2D(k, s, svg, res, U) {
      if (!res.ok) { root.M1.emptyMsg(svg, res); return; }
      draw2(svg, X[k].scene(st(s, k), res, U));
    },
    draw3D(k, s, V, res, U) {
      if (!res.ok) return;
      Scene.draw3D(V, X[k].scene(st(s, k), res, U));
    },
    /** Book preset that switches the host module to extension k with values v. */
    preset(name, k, v, units) {
      return { name, units: units || 'SI', apply: (s) => { s.sub = k; s.x = s.x || {}; s.x[k] = Object.assign(clone(X[k].def), clone(v)); } };
    },
  };
  root.StatX = StatX;

  /* ---------------- hook into the host modules ------------------------ */
  function hook(M) {
    if (!M) return;
    const own = (k) => !!(X[k] && X[k].mod === M.id);
    const cp = M.compute, d2 = M.draw2D, d3 = M.draw3D, oc = M.onClick;
    M.compute = function (U) { const s = this.state; return own(s.sub) ? StatX.compute(s.sub, s, U) : cp.call(this, U); };
    M.draw2D = function (svg, res, U, opts) { const s = this.state; return own(s.sub) ? StatX.draw2D(s.sub, s, svg, res, U) : d2.call(this, svg, res, U, opts); };
    M.draw3D = function (V, res, U) { const s = this.state; return own(s.sub) ? StatX.draw3D(s.sub, s, V, res, U) : d3.call(this, V, res, U); };
    if (oc) M.onClick = function (w, res) { return own(this.state.sub) ? false : oc.call(this, w, res); };
  }
  const P = (name, k, v, units) => StatX.preset(name, k, v, units);
  function register() {
    const { MP, M1, M2, M3 } = root;
    hook(MP); hook(M1); hook(M2); hook(M3);
    if (M2) M2.presets.forEach((pr) => { const a = pr.apply; pr.apply = (s) => { s.sub = 'body'; a(s); }; });
    if (MP) MP.presets.push(
      P('Hibbeler 2-19 — Burj Khalifa 828 m, air 40 °C, 105 kPa (95.92 kPa; incompressible 95.85)', 'comp', { ca: 'isoT', T1: 40, p1: 105, dz: 828, rhoInc: 1.127 }),
      P('Hibbeler 2-20 — Burj Khalifa 2717 ft, air 100 °F, 14.7 psi (13.42 psi; incompressible 13.36)', 'comp', { ca: 'isoT', T1: 100, p1: 14.7, dz: 2717, rhoInc: 0.0022 }, 'EN'),
      P('Schaum 2.24 — isothermal air 20 °C, 101.4 kPa at sea level, 1200 m up (88.2 kPa)', 'comp', { ca: 'isoT', T1: 20, p1: 101.4, dz: 1200 }),
      P('Hibbeler 2-23 — T falls 20 → 16 °C over 500 m, 101 kPa, ρ 1.23 (95.2 kPa, 1.18 kg/m³)', 'comp', { ca: 'lapse', T1: 20, p1: 101, dz: 500, lapse: 0.008, rho1: 1.23 }),
      P('Hibbeler 2-26 — troposphere 15 °C, C = 0.0065 K/m, 101 kPa, 5 km up (53.8 kPa)', 'comp', { ca: 'lapse', T1: 15, p1: 101, dz: 5000, lapse: 0.0065 }),
      P('Hibbeler 2-31 — stratosphere at 20 km, isothermal above 11 km (5.43 kPa)', 'comp', { ca: 'lapse', T1: 15, p1: 101, dz: 20000, lapse: 0.0065, zT: 11000 }),
      P('Hibbeler 2-22 — water 300 m deep with E = 2.20 GPa (2.945 MPa; incompressible 2.943)', 'comp', { ca: 'liqE', sgL: 1, Ev: 2.2, hd: 300 }),
      P('Schaum 2.23 — ocean 5000 ft, 64.0 lb/ft³, E = 300 000 psi (≈ 321 000 psf)', 'comp', { ca: 'liqE', sgL: 64 / 62.4, Ev: 300000, hd: 5000 }, 'EN'),
      P('Hibbeler 2-27 — ρ = 850 + 0.2h kg/m³, h = 20 m (167 kPa)', 'comp', { ca: 'varrho', rho0: 850, krho: 0.2, hd: 20 }),
      P('Hibbeler 2-18 — 0.5 in methane bubble rising from 20 ft (0.584 in)', 'comp', { ca: 'bubble', sgL: 1, patm: 14.7, hd: 20, hd2: 0, db: 0.5 }, 'EN'),
      P('Hibbeler 2-6 — mercury barometer at 14.7 psi, γ = 846 lb/ft³ (30.0 in; water 33.9 ft)', 'comp', { ca: 'baro', sgL: 846 / 62.4, patm: 14.7, pvap: 0, bsolve: 'h' }, 'EN'),
      P('Inclined gauge: Sg 0.83 oil, 20° tube, 6 mm tube on a 60 mm reservoir, L = 120 mm', 'incl', { sgM: 0.83, sgF: 0, thI: 20, useRes: true, dt: 6, Dr: 60, isolve: 'dp', Lr: 0.12 }),
    );
    if (M1) M1.presets.push(
      P('Hibbeler 2-93 — parabolic end plate y = 4x², 2 ft × 4 ft, carbon disulphide (676 lb, 2.29 ft)', 'any', { sgA: 2.46 * 32.2 / 62.4, pshape: 'parab', porient: 'up', pb: 2, ph: 4, pd: 0 }, 'EN'),
      P('Hibbeler 2-95 — triangular plate 0.75 × 0.75 m, base 2 m deep (4.83 kN, 1.77 m)', 'any', { sgA: 1, pshape: 'rtri', porient: 'up', pb: 0.75, ph: 0.75, pd: 1.25 }),
      P('Schaum 3.9 — 4 × 8 ft rectangle over a 6 ft triangle (15 480 lb; x 1.65 ft, y 7.69 ft)', 'any', { sgA: 1, pshape: 'poly', ptxt: '0, 0\n4, 0\n4, 8\n0, 14' }, 'EN'),
      P('Schaum 3.31 — isosceles triangle 18 ft base, 24 ft altitude, axis horizontal 13 ft deep, oil 0.80 (140 400 lb, 14.04 ft)', 'any', { sgA: 0.8, pshape: 'poly', ptxt: '0, 4\n0, 22\n24, 13' }, 'EN'),
      P('Schaum 3.17(a) — 1.2 m steel pipe, 6 mm wall, 120 m head of oil Sg 0.822 (≈ 96.6 MPa)', 'hoop', { vessel: 'cyl', Dh: 1.2, pBy: 'head', sgH: 0.822, hH: 120, hsolve: 's', tH: 6 }),
      P('Schaum 3.17(b) — thickness for 1.72 MPa with 124 MPa allowable (8.3 mm)', 'hoop', { vessel: 'cyl', Dh: 1.2, pBy: 'p', pH: 1720, hsolve: 't', sAllow: 124 }),
      P('Schaum 3.18 — 20 ft vat, 24 ft of brine Sg 1.06, 2 × ¼ in bands at 16 000 psi (6.05 in)', 'hoop', { vessel: 'band', Dh: 20, pBy: 'head', sgH: 1.06, hH: 24, bandA: 0.5, sAllow: 16000 }, 'EN'),
      P('Schaum 3.42 — 48 in stave pipe at 160 psi, 4 × ¾ in bands at 16 000 psi (12.5 in)', 'hoop', { vessel: 'band', Dh: 4, pBy: 'p', pH: 160 * 144, bandA: 3, sAllow: 16000 }, 'EN'),
    );
    if (M2) M2.presets.push(
      P('Schaum 4.3 — hydrometer 0.0216 N, 2.8 mm stem, alcohol 0.821 → oil 0.780 (22.9 mm deeper; book 22.5 with rounding)', 'hydro', { Wh: 0.0216, stemBy: 'd', dst: 2.8, S1h: 0.821, S2h: 0.78, hsol: 'dh' }),
      P('Schaum 4.21 — hydrometer 0.0250 lb, stem 0.0250 in², Sg 0.90 vs 1.25 (8.62 in)', 'hydro', { Wh: 0.025, stemBy: 'a', aSt: 0.025, S1h: 0.9, S2h: 1.25, hsol: 'dh' }, 'EN'),
      P('Hibbeler 2-142 — hot-air balloon 120 000 ft³, ρ 0.00237 / 0.00193 slug/ft³, 200 lb (1.50 kip)', 'balloon', { gasB: 'given', gamA: 0.00237 * 32.2, gamG: 0.00193 * 32.2, bsol: 'load', Vby: 'V', VB: 120000, WB: 200 }, 'EN'),
      P('Schaum 4.29 — 20 ft balloon, gas 0.0345 lb/ft³, air 0.0765, empty 100 lb (76 lb cargo)', 'balloon', { gasB: 'given', gamA: 0.0765, gamG: 0.0345, bsol: 'load', Vby: 'D', DB: 20, WB: 100 }, 'EN'),
      P('Helium balloon sized to lift 5 kN (air 15 °C, 101.3 kPa, 500 N envelope)', 'balloon', { gasB: 'he', Tair: 15, pB: 101.3, bsol: 'size', WB: 500, Wpay: 5000 }),
      P('Schaum 4.1 — stone 90 N in air, 50 N in water (V 0.00409 m³, Sg 2.25)', 'volb', { vc: 'weigh', wk: 'air1', gwV: 9.79, sg1: 1, Wair: 90, Wl1: 50 }),
      P('Schaum 4.15 — object 289 N in air, 187 N in water (0.0104 m³, Sg 2.83)', 'volb', { vc: 'weigh', wk: 'air1', gwV: 9.79, sg1: 1, Wair: 289, Wl1: 187 }),
      P('Schaum 4.16 — 65 lb in air, 42 lb in oil Sg 0.75 (0.491 ft³, Sg 2.12)', 'volb', { vc: 'weigh', wk: 'air1', sg1: 0.75, Wair: 65, Wl1: 42 }, 'EN'),
      P('2500SP 6.1 — stone 105 lb in air, 67.0 lb in water (0.609 ft³, Sg 2.76)', 'volb', { vc: 'weigh', wk: 'air1', sg1: 1, Wair: 105, Wl1: 67 }, 'EN'),
      P('Schaum 4.19 — stone 600 N, 323 N in water, 0.610 m square tank (water rises 76 mm)', 'volb', { vc: 'weigh', wk: 'air1', gwV: 9.79, sg1: 1, Wair: 600, Wl1: 323, tank: true, Atk: 0.61 * 0.61 }),
      P('Schaum 4.2 — 8 × 8 × 16 in prism weighs 11.0 lb in water (48 lb, Sg 1.30)', 'volb', { vc: 'weigh', wk: 'v1', sg1: 1, Vby: 'V', Vv: (8 * 8 * 16) / 1728, Wl1: 11 }, 'EN'),
      P('Schaum 4.18 — 6 in aluminium cube, 12.2 lb in water → in Sg 1.25 (10.25 lb)', 'volb', { vc: 'weigh', wk: 'v1', sg1: 1, Vby: 'cube', av: 0.5, Wl1: 12.2, liq2: true, l2m: 'cmp', sg2: 1.25 }, 'EN'),
      P('2500SP 6.24 — 15 in radius sphere moored in sea water (64 lb/ft³) with 160 lb tension (γ 44.4 lb/ft³)', 'volb', { vc: 'weigh', wk: 'v1', sg1: 64 / 62.4, Vby: 'sph', Dv: 2.5, Wl1: -160 }, 'EN'),
      P('2500SP 6.51 — 4 N in water, 5 N in alcohol Sg 0.80 (0.000511 m³, 9.00 N, 1796 kg/m³)', 'volb', { vc: 'weigh', wk: 'two', gwV: 9.79, sg1: 1, Wl1: 4, Wl2: 5, sg2: 0.8 }),
      P('2500SP 6.44 — typewriter 6 lb in water, 8 lb in oil Sg 0.86 (0.229 ft³, 88.6 lb/ft³)', 'volb', { vc: 'weigh', wk: 'two', sg1: 1, Wl1: 6, Wl2: 8, sg2: 0.86 }, 'EN'),
      P('Schaum 4.23 — 6 ft³ needs 60 lb to hold under water, 36 lb in another liquid (Sg 0.936; book 0.937)', 'volb', { vc: 'weigh', wk: 'liq', sg1: 1, Vby: 'V', Vv: 6, Wl1: -60, Wl2: -36 }, 'EN'),
      P('2500SP 6.22/6.23 — crown 14.0 N in air, 12.7 N in water: gold 19.3 or silver 10.5? (Sg 10.77, 96.9 % silver)', 'volb', { vc: 'weigh', wk: 'air1', gwV: 9.79, sg1: 1, Wair: 14, Wl1: 12.7, mix: true, sga: 10.5, sgb: 19.3 }),
      P('Schaum 4.17 — 305 mm aluminium sphere, γ 25.9 kN/m³, in water and in oil 0.75 (book 238 N and 276 N)', 'volb', { vc: 'body', gwV: 9.79, sg1: 1, Vby: 'sph', Dv: 0.305, matBy: 'gam', gB: 25.9, liq2: true, l2m: 'cmp', sg2: 0.75 }),
      P('Schaum 4.33 — 152 mm aluminium cube half in oil 0.80, half in water (60.0 N; book 60.4)', 'volb', { vc: 'body', gwV: 9.79, sg1: 1, Vby: 'cube', av: 0.152, matBy: 'gam', gB: 25.9, liq2: true, l2m: 'split', sg2: 0.8, fr1: 0.5 }),
      P('Schaum 4.5 — metal Sg 7.25 floating in mercury Sg 13.57 (46.6 % above)', 'volb', { vc: 'float', fsolve: 'vol', sg1: 13.57, matBy: 'sg', sgB: 7.25, fby: 'Vt', Vg: 1 }),
      P('Schaum 4.27 — iceberg 57 lb/ft³ in sea water 64 lb/ft³, 21 000 ft³ above (192 000 ft³)', 'volb', { vc: 'float', fsolve: 'vol', sg1: 64 / 62.4, matBy: 'gam', gB: 57, fby: 'Vab', Vg: 21000 }, 'EN'),
    );
    if (M3) M3.presets.push(
      P('Hibbeler 2-173 — water U-tube, legs 0.2 m and 0.4 m from the axis, levels 0.6 / 1.0 m (8.09 rad/s)', 'rotu', { r1u: 0.2, r2u: 0.4, h0u: 0.8, usolve: 'w', dhu: 0.4, sgU: 1 }),
      P('Schaum 5.27 — mercury U-tube 305 mm wide, axis 76 mm from a leg, 229 mm at rest (13.9 rad/s)', 'rotu', { r1u: 0.076, r2u: 0.229, h0u: 0.229, usolve: 'empty', sgU: 13.6 }),
      P('U-tube 0.1 m / 0.3 m from the axis at 80 rpm', 'rotu', { r1u: 0.1, r2u: 0.3, h0u: 0.3, usolve: 'dh', useRpmU: true, Nu: 80, sgU: 1, same: true }),
    );
  }
  register();
})(window);
