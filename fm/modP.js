/* =====================================================================
 * MODULE — Pressure: variation with depth, piezometers, manometers,
 * chambers joined by multi-fluid manometers, hydraulic press.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Physics } = root;
  const f = Physics.fmt;

  const fluidCol = (sg) => (sg < 0.05 ? '#eaf3f9' : sg < 0.95 ? '#e0b84a' : sg < 1.15 ? '#4aa3df' : sg < 4 ? '#48c9b0' : '#95a5a6');
  const fluidName = (sg) => (sg < 0.05 ? 'air' : sg < 0.95 ? 'oil' : sg < 1.15 ? 'water' : sg < 4 ? 'heavy liquid' : 'mercury');
  const SGCHIPS = [['Air', 0], ['Oil', 0.8], ['Water', 1], ['Glycerin', 1.26], ['CCl₄', 1.59], ['Mercury', 13.6]];

  const LAYER_DEF = [{ sg: 0.8, t: 1 }, { sg: 1, t: 2 }, { sg: 1.26, t: 0.5 }, { sg: 1.59, t: 0.5 }, { sg: 13.6, t: 0.3 }];
  const padLayers = (s) => { while (s.layers.length < 5) s.layers.push(Object.assign({}, LAYER_DEF[s.layers.length])); };
  const MP = {
    id: 'mp', title: 'Pressure',
    state: {
      sub: 'utube', patm: 101.325, patmEN: 2116.2,
      p0: 0, n: 2, layers: [{ sg: 0.8, t: 1.5 }, { sg: 1, t: 3 }, { sg: 13.6, t: 0.5 }, { sg: 1.26, t: 0.5 }, { sg: 13.6, t: 0.3 }], zq: 4,
      type: 'utube', sgA: 1, sgM: 13.6, hp: 1.2, y: 0.6, h: 0.4, closed: false, pEnd: 0,
      inverted: false, sgB: 1, zA: 0.8, dz: 0, solve: 'dp', dP: 20,
      nl: 4, legs: [{ sg: 1, dz: -1.2 }, { sg: 13.6, dz: 0.5 }, { sg: 1, dz: -0.3 }, { sg: 0.8, dz: 1.0 }, { sg: 1, dz: 0.5 }, { sg: 1, dz: 0.5 }], msolve: 'pB', pA: 25, pB: 0, gasA: false, gasB: false,
      d1: 0.04, d2: 0.3, sgP: 0.88, dzP: 0.5, F1: 0.15, lever: false, Fh: 0.05, ratio: 8,
    },
    presets: [
      { name: 'Test P1 — open tank, oil 1.5 m over water 3 m, point 4 m deep', apply: (s) => Object.assign(s, { sub: 'depth', p0: 0, n: 2, layers: [{ sg: 0.8, t: 1.5 }, { sg: 1, t: 3 }, { sg: 13.6, t: 0.5 }], zq: 4 }) },
      { name: 'Closed tank: air 35 kPa over oil, water, mercury', apply: (s) => Object.assign(s, { sub: 'depth', p0: 35, n: 3, layers: [{ sg: 0.85, t: 1 }, { sg: 1, t: 2 }, { sg: 13.6, t: 0.4 }], zq: 3.4 }) },
      { name: 'Five layers: oil, water, glycerin, CCl₄, mercury (open)', apply: (s) => Object.assign(s, { sub: 'depth', p0: 0, n: 5, layers: [{ sg: 0.8, t: 1 }, { sg: 1, t: 1.5 }, { sg: 1.26, t: 0.8 }, { sg: 1.59, t: 0.6 }, { sg: 13.6, t: 0.3 }], zq: 4.2 }) },
      { name: 'Piezometer on a water pipe, column 1.2 m', apply: (s) => Object.assign(s, { sub: 'utube', type: 'piezo', sgA: 1, hp: 1.2 }) },
      { name: 'Test P2 — U-tube, water pipe, mercury h = 0.4 m, y = 0.6 m', apply: (s) => Object.assign(s, { sub: 'utube', type: 'utube', sgA: 1, sgM: 13.6, y: 0.6, h: 0.4, closed: false }) },
      { name: 'U-tube measuring a vacuum (mercury lower on the open side)', apply: (s) => Object.assign(s, { sub: 'utube', type: 'utube', sgA: 0.9, sgM: 13.6, y: 0.3, h: -0.15, closed: false }) },
      { name: 'Differential manometer, water pipes, mercury h = 0.25 m', apply: (s) => Object.assign(s, { sub: 'diff', inverted: false, sgA: 1, sgB: 1, sgM: 13.6, zA: 0.8, dz: 0, h: 0.25, solve: 'dp' }) },
      { name: 'Differential: A and B at different levels, oil & water', apply: (s) => Object.assign(s, { sub: 'diff', inverted: false, sgA: 0.86, sgB: 1, sgM: 13.6, zA: 1.0, dz: 0.4, h: 0.3, solve: 'dp' }) },
      { name: 'Inverted U with oil, water pipes', apply: (s) => Object.assign(s, { sub: 'diff', inverted: true, sgA: 1, sgB: 1, sgM: 0.8, zA: 1.2, dz: 0, h: 0.2, solve: 'dp' }) },
      { name: 'Chambers: air at 25 kPa in A, water–mercury–water–oil to B', apply: (s) => Object.assign(s, { sub: 'multi', msolve: 'pB', pA: 25, gasA: true, gasB: false, nl: 4, legs: [{ sg: 1, dz: -1.2 }, { sg: 13.6, dz: 0.5 }, { sg: 1, dz: -0.3 }, { sg: 0.8, dz: 1.0 }, { sg: 1, dz: 0.5 }, { sg: 1, dz: 0.5 }] }) },
      { name: 'Two air chambers joined by a mercury U (find p_A)', apply: (s) => Object.assign(s, { sub: 'multi', msolve: 'pA', pB: 15, gasA: true, gasB: true, nl: 3, legs: [{ sg: 0, dz: -0.8 }, { sg: 13.6, dz: 0.35 }, { sg: 0, dz: 0.45 }, { sg: 1, dz: 0 }, { sg: 1, dz: 0 }, { sg: 1, dz: 0 }] }) },
      { name: 'Hydraulic jack: 40 mm / 300 mm pistons, 0.15 kN', apply: (s) => Object.assign(s, { sub: 'press', d1: 0.04, d2: 0.3, sgP: 0.88, dzP: 0.5, F1: 0.15, lever: false }) },
      { name: 'Hydraulic jack with an 8 : 1 lever', apply: (s) => Object.assign(s, { sub: 'press', d1: 0.025, d2: 0.2, sgP: 0.9, dzP: 0, Fh: 0.05, ratio: 8, lever: true }) },
    ],

    controls(el, C) {
      const s = this.state, U = root.App.U();
      padLayers(s);
      const sl = (p, label, get, set, min, max, step, unit) => C.slider(p, { label, min, max, step, get, set, unit });
      const sgRow = (p, label, get, set, min) => {
        const row = C.slider(p, { label, min: min === undefined ? 0 : min, max: 13.6, step: 0.01, get, set, unit: '' });
        const bar = root.UI.h('div', { class: 'presets' });
        SGCHIPS.filter((c) => c[1] >= (min || 0)).forEach(([n, v]) => bar.append(root.UI.h('button', { type: 'button', class: Math.abs(get() - v) < 1e-9 ? 'on' : '', onclick: () => { set(v); root.App.rebuild(true); } }, `${n} ${v}`)));
        row.append(bar);
      };
      const patm = { get: () => (U.id === 'EN' ? s.patmEN : s.patm), set: (v) => (U.id === 'EN' ? (s.patmEN = v) : (s.patm = v)) };
      C.seg(el, { label: 'Situation', options: [['depth', 'Pressure at a depth'], ['utube', 'Piezometer / U-tube'], ['diff', 'Differential manometer'], ['multi', 'Chambers & multi-fluid'], ['press', 'Hydraulic press']], get: () => s.sub, set: (v) => (s.sub = v) });
      if (s.sub === 'depth') {
        const t = C.section(el, 'Tank');
        sl(t, 'Gas pressure on top p₀ (gauge, 0 = open)', () => s.p0, (v) => (s.p0 = v), -100, 500, 0.1, U.press);
        C.seg(t, { label: 'Number of liquid layers', options: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], get: () => s.n, set: (v) => (s.n = +v) });
        for (let i = 0; i < s.n; i++) {
          const L = C.section(el, `Layer ${i + 1} (from the top)`);
          sgRow(L, `Sg${i + 1}`, () => s.layers[i].sg, (v) => (s.layers[i].sg = v), 0.5);
          sl(L, `Thickness h${i + 1}`, () => s.layers[i].t, (v) => (s.layers[i].t = v), 0.01, 20, 0.01, U.len);
        }
        const tot = s.layers.slice(0, s.n).reduce((a, l) => a + l.t, 0);
        const q = C.section(el, 'Point of interest');
        sl(q, 'Depth below the top surface', () => Math.min(s.zq, tot), (v) => (s.zq = v), 0, +tot.toFixed(3), 0.01, U.len);
        sl(q, 'Atmospheric pressure', patm.get, patm.set, 0, U.id === 'EN' ? 3000 : 120, 0.001, U.press);
      } else if (s.sub === 'utube') {
        C.seg(el, { label: 'Device', options: [['piezo', 'Piezometer'], ['utube', 'U-tube manometer']], get: () => s.type, set: (v) => (s.type = v) });
        const a = C.section(el, 'Fluid at A');
        sgRow(a, 'Sg_A', () => s.sgA, (v) => (s.sgA = v), 0.5);
        if (s.type === 'piezo') sl(a, 'Column height h above A', () => s.hp, (v) => (s.hp = v), 0, 10, 0.001, U.len);
        else {
          const m = C.section(el, 'Manometer');
          sgRow(m, 'Manometer liquid Sg_m', () => s.sgM, (v) => (s.sgM = v), 0.5);
          sl(m, 'y — A above the left meniscus', () => s.y, (v) => (s.y = v), -3, 5, 0.001, U.len);
          sl(m, 'h — right meniscus above the left (−: below)', () => s.h, (v) => (s.h = v), -3, 5, 0.001, U.len);
          C.toggle(m, { label: 'Right end closed (gas pressure)', get: () => s.closed, set: (v) => (s.closed = v) });
          if (s.closed) sl(m, 'Gas pressure at the right end', () => s.pEnd, (v) => (s.pEnd = v), -100, 500, 0.1, U.press);
        }
        sl(el, 'Atmospheric pressure', patm.get, patm.set, 0, U.id === 'EN' ? 3000 : 120, 0.001, U.press);
      } else if (s.sub === 'diff') {
        C.seg(el, { label: 'Type', options: [[false, 'Upright U (heavy fluid)'], [true, 'Inverted U (light fluid)']], get: () => s.inverted, set: (v) => (s.inverted = v === true || v === 'true') });
        const fl = C.section(el, 'Fluids');
        sgRow(fl, 'Fluid at A, Sg_A', () => s.sgA, (v) => (s.sgA = v), 0.5);
        sgRow(fl, 'Fluid at B, Sg_B', () => s.sgB, (v) => (s.sgB = v), 0.5);
        sgRow(fl, 'Manometer fluid Sg_m', () => s.sgM, (v) => (s.sgM = v));
        const g = C.section(el, 'Geometry');
        sl(g, s.inverted ? 'z_A — left meniscus above A' : 'z_A — A above the left meniscus', () => s.zA, (v) => (s.zA = v), 0, 5, 0.001, U.len);
        sl(g, 'Δz — elevation of B above A', () => s.dz, (v) => (s.dz = v), -3, 3, 0.001, U.len);
        C.seg(g, { label: 'Solve for', options: [['dp', 'p_A − p_B from h'], ['h', 'Reading h from Δp']], get: () => s.solve, set: (v) => (s.solve = v) });
        if (s.solve === 'dp') sl(g, s.inverted ? 'h — right meniscus below the left' : 'h — right meniscus above the left', () => s.h, (v) => (s.h = v), 0, 3, 0.001, U.len);
        else sl(g, 'p_A − p_B', () => s.dP, (v) => (s.dP = v), -500, 500, 0.01, U.press);
      } else if (s.sub === 'multi') {
        const c = C.section(el, 'Chambers');
        C.seg(c, { label: 'Solve for', options: [['pB', 'p_B (given p_A)'], ['pA', 'p_A (given p_B)']], get: () => s.msolve, set: (v) => (s.msolve = v) });
        if (s.msolve === 'pB') sl(c, 'Gauge pressure in A', () => s.pA, (v) => (s.pA = v), -100, 1000, 0.01, U.press);
        else sl(c, 'Gauge pressure in B', () => s.pB, (v) => (s.pB = v), -100, 1000, 0.01, U.press);
        C.toggle(c, { label: 'Chamber A holds gas (air)', get: () => s.gasA, set: (v) => (s.gasA = v) });
        C.toggle(c, { label: 'Chamber B holds gas (air)', get: () => s.gasB, set: (v) => (s.gasB = v) });
        C.seg(c, { label: 'Number of legs (A → B)', options: [1, 2, 3, 4, 5, 6].map((k) => [k, String(k)]), get: () => s.nl, set: (v) => (s.nl = +v) });
        C.note(c, 'Each leg is a vertical column of one fluid. Δz is + going up and − going down along the path from A to B.');
        for (let i = 0; i < s.nl; i++) {
          const L = C.section(el, `Leg ${i + 1}`);
          sgRow(L, 'Fluid Sg', () => s.legs[i].sg, (v) => (s.legs[i].sg = v));
          sl(L, 'Δz (up +, down −)', () => s.legs[i].dz, (v) => (s.legs[i].dz = v), -5, 5, 0.001, U.len);
        }
        sl(el, 'Atmospheric pressure', patm.get, patm.set, 0, U.id === 'EN' ? 3000 : 120, 0.001, U.press);
      } else {
        const g = C.section(el, 'Press');
        sl(g, 'Small piston diameter d₁', () => s.d1, (v) => (s.d1 = v), 0.005, 2, 0.001, U.len);
        sl(g, 'Large piston diameter d₂', () => s.d2, (v) => (s.d2 = v), 0.01, 5, 0.001, U.len);
        sgRow(g, 'Hydraulic fluid Sg', () => s.sgP, (v) => (s.sgP = v), 0.5);
        sl(g, 'Δz — large piston above the small one', () => s.dzP, (v) => (s.dzP = v), -5, 5, 0.001, U.len);
        C.toggle(g, { label: 'Operated by a lever', get: () => s.lever, set: (v) => (s.lever = v) });
        if (s.lever) { sl(g, 'Hand force F_h', () => s.Fh, (v) => (s.Fh = v), 0, 100, 0.001, U.force); sl(g, 'Lever ratio a / b', () => s.ratio, (v) => (s.ratio = v), 1, 50, 0.1, ''); }
        else sl(g, 'Force on small piston F₁', () => s.F1, (v) => (s.F1 = v), 0, 1000, 0.001, U.force);
      }
    },

    compute(U) {
      const s = this.state;
      padLayers(s);
      const patm = U.id === 'EN' ? s.patmEN : s.patm;
      return Physics.pressure({
        sub: s.sub, patm, p0: s.p0, n: s.n, layers: s.layers, zq: s.zq,
        type: s.type, sgA: s.sgA, sgM: s.sgM, hp: s.hp, y: s.y, h: s.h, closed: s.closed, pEnd: s.pEnd,
        inverted: s.inverted, sgB: s.sgB, zA: s.zA, dz: s.sub === 'press' ? s.dzP : s.dz, solve: s.sub === 'multi' ? s.msolve : s.solve, dP: s.dP,
        n_: 0, legs: s.legs, pA: s.pA, pB: s.pB, gasA: s.gasA, gasB: s.gasB,
        d1: s.d1, d2: s.d2, sg: s.sgP, F1: s.F1, lever: s.lever, Fh: s.Fh, ratio: s.ratio,
        ...(s.sub === 'multi' ? { n: s.nl } : {}),
      }, U);
    },

    draw2D(svg, res, U) {
      if (!res.ok) { root.M1.emptyMsg(svg, res); return; }
      const s = this.state, g = res.geo;
      const sch = scene(s, g, U);
      const D = root.UI.Draw2D(svg, sch.bounds, { pad: 50, padR: sch.padR || 60 });
      sch.items.forEach((it) => {
        if (it.t === 'poly') D.poly(it.pts, it.o);
        else if (it.t === 'line') D.line(it.a, it.b, it.o);
        else if (it.t === 'text') D.text(it.p, it.s, it.o);
        else if (it.t === 'dim') D.dim(it.a, it.b, it.s, it.off, it.o);
        else if (it.t === 'arrow') D.arrow(it.a, it.b, it.o);
        else if (it.t === 'dot') D.dot(it.p, it.c, it.s, it.o);
        else if (it.t === 'fs') D.fs(it.p, it.o);
      });
    },

    draw3D(V, res, U) {
      if (!res.ok) return;
      const s = this.state, g = res.geo;
      if (s.sub === 'press') { press3D(V, s, g, U); return; }
      const sch = scene(s, g, U);
      const w = sch.tw || 0.08, dep = sch.depth || 0.6;
      sch.items.forEach((it) => {
        if (it.t === 'poly' && it.o && it.o.box3 && it.o.box3 !== 'none') {
          const xs = it.pts.map((p) => p[0]), ys = it.pts.map((p) => p[1]);
          const z = it.o.box3 === 'tube' ? w / 2 : dep / 2;
          V.box(Math.min(...xs), Math.min(...ys), -z, Math.max(...xs), Math.max(...ys), z, it.o.c3 || '#cccccc', it.o.a3 || 0.85, it.o.s3 || null);
        } else if (it.t === 'dim') V.dim([it.a[0], it.a[1], dep / 2], [it.b[0], it.b[1], dep / 2], it.s, it.o3 || [0, 0, dep * 0.6]);
        else if (it.t === 'dot' && it.s) V.label([it.p[0], it.p[1], 0], it.s, it.c);
        else if (it.t === 'arrow') { V.line([[it.a[0], it.a[1], 0], [it.b[0], it.b[1], 0]], (it.o && it.o.color) || '#c0392b', 3); if (it.o && it.o.label) V.label([it.b[0], it.b[1], 0], it.o.label, it.o.color); }
        else if (it.t === 'text' && it.o && it.o.in3) V.label([it.p[0], it.p[1], 0], it.s, it.o.color || '#1d2733');
      });
      V.autoBounds();
    },
  };

  /* Hydraulic press in 3D: real round cylinders and pistons (the generic scene would turn both
     cylinders into boxes of the same depth, hiding the small one behind the large one). */
  function press3D(V, s, g, U) {
    const r1 = g.d1 / 2, r2 = g.d2 / 2, dz = g.dz, gap = Math.max(4 * r1, 0.5 * r2), x1 = 0, x2 = 2 * r1 + gap + r2;
    const base = Math.min(0, dz) - 0.5 * r2 - 0.15, col = fluidCol(s.sgP), tp = 0.06, tp2 = 0.08, GREY = '#5d6d7e';
    const wall = Math.max(0.15 * r1, 0.004);
    // transparent cylinder walls a little above each piston
    V.lathe([[r1, base], [r1 + wall, base], [r1 + wall, tp + 0.08], [r1, tp + 0.08]], '#c8d0d8', 0.25, null, 32, x1, 0);
    V.lathe([[r2, base], [r2 + wall, base], [r2 + wall, dz + tp2 + 0.08], [r2, dz + tp2 + 0.08]], '#c8d0d8', 0.25, null, 40, x2, 0);
    // liquid columns and the connecting pipe under them
    V.lathe([[0, base], [r1, base], [r1, 0], [0, 0]], col, 0.6, null, 32, x1, 0);
    V.lathe([[0, base], [r2, base], [r2, dz], [0, dz]], col, 0.6, null, 40, x2, 0);
    const pz = Math.max(0.8 * r1, 0.02);
    V.box(x1 + r1, base, -pz, x2 - r2, base + Math.max(2 * pz, 0.06), pz, col, 0.6, null);
    // pistons
    V.lathe([[0, 0], [r1, 0], [r1, tp], [0, tp]], GREY, 1, null, 32, x1, 0);
    V.lathe([[0, dz], [r2, dz], [r2, dz + tp2], [0, dz + tp2]], GREY, 1, null, 40, x2, 0);
    // force arrows with cone heads: F1 pushes down on the small piston, F2 is the load lifted by the large one
    const al = Math.max(0.25, 1.2 * r2), hh = 0.18 * al, hr = 0.06 * al;
    const a1 = Math.max(al, dz + tp2 + 0.25 - tp); // keep the F1 label clear of the large cylinder
    V.line([[x1, tp + a1, 0], [x1, tp + hh, 0]], '#c0392b', 3);
    V.lathe([[0, tp], [hr, tp + hh], [0, tp + hh]], '#c0392b', 1, null, 16, x1, 0);
    V.label([x1, tp + a1, 0], `F₁ = ${f(g.F1)} ${U.force}`, '#c0392b');
    V.line([[x2, dz + tp2, 0], [x2, dz + tp2 + al - hh, 0]], '#1e8449', 3);
    V.lathe([[0, dz + tp2 + al], [hr, dz + tp2 + al - hh], [0, dz + tp2 + al - hh]], '#1e8449', 1, null, 16, x2, 0);
    V.label([x2, dz + tp2 + al, 0], `F₂ = ${f(g.F2)} ${U.force}`, '#1e8449');
    V.dim([x1 - r1, base, 0], [x1 + r1, base, 0], `d₁ = ${f(g.d1)} ${U.len}`, [0, -0.12, 0]);
    V.dim([x2 - r2, base, 0], [x2 + r2, base, 0], `d₂ = ${f(g.d2)} ${U.len}`, [0, -0.12, 0]);
    if (Math.abs(dz) > 1e-6) V.dim([x2 + r2, 0, 0], [x2 + r2, dz, 0], `Δz = ${f(dz)} ${U.len}`, [0.25, 0, 0]);
    V.autoBounds();
  }

  /* ---------- scene builder shared by 2D and 3D ---------- */
  function scene(s, g, U) {
    const items = [], Lu = U.len, Pu = U.press;
    const box = (x0, y0, x1, y1, fill, extra) => items.push({ t: 'poly', pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], o: Object.assign({ fill, stroke: '#2c3e50', sw: 1, box3: 'tube', c3: fill.startsWith('url') ? '#9aa3ad' : fill, a3: 0.8 }, extra || {}) });
    const text = (p, str, o) => items.push({ t: 'text', p, s: str, o: o || {} });
    const dim = (a, b, str, off, o, o3) => items.push({ t: 'dim', a, b, s: str, off, o, o3 });
    const dot = (p, c, str, o) => items.push({ t: 'dot', p, c, s: str, o });
    const arrow = (a, b, o) => items.push({ t: 'arrow', a, b, o });
    let bounds, padR = 60, tw = 0.08, depth = 0.5;

    if (s.sub === 'depth') {
      const Z = g.Ztot, W = Math.max(1.2, Z * 0.7), gas = g.p0 !== 0, gh = gas ? 0.25 * Z : 0;
      box(-0.1 * W, -Z - 0.1 * W, W + 0.1 * W, -Z, 'url(#hatch)', { box3: 'tank', c3: '#9aa3ad', a3: 1 });
      let z = 0;
      g.L.forEach((l, i) => {
        box(0, -z - l.t, W, -z, fluidCol(l.sg), { op: 0.85, box3: 'tank', a3: 0.35 });
        text([0.06 * W, -z - l.t / 2], `Sg${i + 1} = ${f(l.sg)} (${fluidName(l.sg)})`, { base: 'middle', in3: true });
        z += l.t;
      });
      if (gas) { box(0, 0, W, gh, '#eaf3f9', { box3: 'tank', a3: 0.2 }); text([0.06 * W, gh / 2], `gas p₀ = ${f(g.p0)} ${Pu}`, { base: 'middle', in3: true }); box(0, gh, W, gh + 0.03 * Z, '#2c3e50', { box3: 'tank', a3: 1 }); }
      else items.push({ t: 'fs', p: [0.8 * W, 0], o: { label: 'open' } });
      box(-0.1 * W, -Z, 0, gh + 0.03 * Z, 'url(#hatch)', { box3: 'none' }); box(W, -Z, W + 0.1 * W, gh + 0.03 * Z, 'url(#hatch)', { box3: 'none' });
      // pressure diagram
      const pmax = Math.max(...g.pts.map((q) => Math.abs(q.p)), 1e-9), sx = (0.9 * W) / pmax, x0 = W + 0.35 * W;
      items.push({ t: 'poly', pts: [[x0, 0], ...g.pts.map((q) => [x0 + q.p * sx, -q.z]), [x0, -Z]], o: { fill: '#e74c3c', fop: 0.25, stroke: '#c0392b', sw: 1.2 } });
      items.push({ t: 'line', a: [x0, 0.05 * Z], b: [x0, -Z - 0.05 * Z], o: { stroke: '#2c3e50', sw: 1.2 } });
      g.pts.forEach((q, i) => { if (i) text([x0 + q.p * sx, -q.z], `${f(q.p)} ${Pu}`, { dx: 6, dy: 4, color: '#c0392b', size: 11 }); });
      dot([0.5 * W, -g.zq], '#c0392b', `p = ${f(g.pq)} ${Pu}`, {});
      dim([-0.1 * W, 0], [-0.1 * W, -g.zq], `${f(g.zq)} ${Lu}`, -14, { anchor: 'end', ldx: -8 }, [-0.3 * W, 0, 0]);
      bounds = { xmin: -0.4 * W, xmax: x0 + W, ymin: -Z - 0.2 * W, ymax: gh + 0.15 * Z };
      tw = 0.1 * W; depth = W * 0.8;
    } else if (s.sub === 'utube' && g.type === 'piezo') {
      const r = 0.15, hp = g.hp;
      box(-1, -r, 1, r, fluidCol(s.sgA), { op: 0.9, box3: 'tank', a3: 0.5 });
      text([-0.95, 0], 'pipe / tank, point A', { base: 'middle', in3: true });
      box(0.4, r, 0.48, hp + 0.3, '#ffffff', { box3: 'tube', a3: 0.2 });
      box(0.4, r, 0.48, hp, fluidCol(s.sgA), { op: 0.95 });
      dot([0.44, 0], '#c0392b', 'A', {});
      dim([0.6, 0], [0.6, hp], `h = ${f(hp)} ${Lu}`, -10, { anchor: 'start', ldx: 8 });
      text([0.7, hp], `p_A = ${f(g.pA)} ${Pu}`, { dx: 10, color: '#c0392b', size: 13, in3: true });
      bounds = { xmin: -1.1, xmax: 1.6, ymin: -0.4, ymax: hp + 0.5 };
      tw = 0.08; depth = 0.3;
    } else if (s.sub === 'utube') {
      const y = g.y, h = g.h, w = 0.6, tb = 0.06, bot = Math.min(0, h) - 0.4, topL = Math.max(y, 0) + 0.15, topR = Math.max(h, 0) + 0.5;
      // pipe at A
      box(-0.5, y - 0.12, 0.3, y + 0.12, fluidCol(s.sgA), { op: 0.9, box3: 'tank', a3: 0.5 });
      // tubes outlines
      box(-tb, bot, tb, y - 0.12, '#ffffff', { box3: 'tube', a3: 0.15 });
      box(w - tb, bot, w + tb, topR, '#ffffff', { box3: 'tube', a3: 0.15 });
      box(-tb, bot - 2 * tb, w + tb, bot, '#ffffff', { box3: 'tube', a3: 0.15 });
      // fluids
      box(-tb, 0, tb, y - 0.12, fluidCol(s.sgA), { op: 0.9 });
      box(-tb, bot, tb, 0, fluidCol(s.sgM), { op: 0.95 });
      box(-tb, bot - 2 * tb, w + tb, bot, fluidCol(s.sgM), { op: 0.95 });
      box(w - tb, bot, w + tb, h, fluidCol(s.sgM), { op: 0.95 });
      if (g.closed) { box(w - tb, h, w + tb, topR, '#eaf3f9', { op: 0.9 }); box(w - 2 * tb, topR, w + 2 * tb, topR + 0.03, '#2c3e50'); text([w, topR], `gas ${f(g.pEnd)} ${Pu}`, { dx: 12, dy: -4, in3: true }); }
      else text([w, topR], 'open', { dx: 12, dy: 4, color: '#5d6b7a' });
      dot([0, y], '#c0392b', 'A', { dx: 8, dy: 4 }); text([-0.5, y + 0.12], `p_A = ${f(g.pA)} ${Pu}`, { dy: -8, color: '#c0392b', size: 13 });
      items.push({ t: 'line', a: [-0.3, 0], b: [w + 0.3, 0], o: { stroke: '#5d6b7a', dash: '4 4', sw: 0.8 } });
      items.push({ t: 'line', a: [w - 0.3, h], b: [w + 0.3, h], o: { stroke: '#5d6b7a', dash: '4 4', sw: 0.8 } });
      dim([-0.6, 0], [-0.6, y], `y = ${f(y)} ${Lu}`, 12, { anchor: 'end', ldx: -8 }, [-0.25, 0, 0]);
      dim([w + 0.3, 0], [w + 0.3, h], `h = ${f(h)} ${Lu}`, -10, { anchor: 'start', ldx: 8 }, [0.25, 0, 0]);
      text([w + 0.4, bot], `Sg_m = ${f(s.sgM)} (${fluidName(s.sgM)})`, { dx: 6, color: '#5d6b7a', in3: true });
      bounds = { xmin: -1.1, xmax: w + 1.4, ymin: bot - 0.2, ymax: Math.max(topL, topR) + 0.2 };
      tw = 2 * tb; depth = 0.3;
    } else if (s.sub === 'diff') {
      const w = 0.8, tb = 0.06, h = g.h, zA = g.zA;
      if (!g.inv) {
        const zB = g.zB, yA = zA, yB = h + zB, bot = Math.min(0, h) - 0.35;
        box(-0.45, yA - 0.12, 0.25, yA + 0.12, fluidCol(s.sgA), { op: 0.9, box3: 'tank', a3: 0.5 });
        box(w - 0.25, yB - 0.12, w + 0.45, yB + 0.12, fluidCol(s.sgB), { op: 0.9, box3: 'tank', a3: 0.5 });
        box(-tb, 0, tb, yA - 0.12, fluidCol(s.sgA), { op: 0.9 });
        box(-tb, bot, tb, 0, fluidCol(s.sgM), { op: 0.95 });
        box(-tb, bot - 2 * tb, w + tb, bot, fluidCol(s.sgM), { op: 0.95 });
        box(w - tb, bot, w + tb, h, fluidCol(s.sgM), { op: 0.95 });
        box(w - tb, h, w + tb, yB - 0.12, fluidCol(s.sgB), { op: 0.9 });
        dot([0, yA], '#c0392b', 'A', { dx: -16, anchor: 'end' }); dot([w, yB], '#2980b9', 'B', { dx: 12 });
        items.push({ t: 'line', a: [-0.3, 0], b: [w + 0.3, 0], o: { stroke: '#5d6b7a', dash: '4 4', sw: 0.8 } });
        dim([-0.55, 0], [-0.55, yA], `z_A = ${f(zA)} ${Lu}`, 12, { anchor: 'end', ldx: -8 }, [-0.25, 0, 0]);
        dim([w + 0.25, 0], [w + 0.25, h], `h = ${f(h)} ${Lu}`, -10, { anchor: 'start', ldx: 8 }, [0.25, 0, 0]);
        dim([w + 0.55, h], [w + 0.55, yB], `z_B = ${f(zB)} ${Lu}`, -10, { anchor: 'start', ldx: 8 }, [0.45, 0, 0]);
        bounds = { xmin: -1, xmax: w + 1.4, ymin: bot - 0.25, ymax: Math.max(yA, yB) + 0.35 };
      } else {
        const yA = 0, yL = zA, yR = zA - h, yB = g.dz, top = Math.max(yL, yR) + 0.35;
        box(-0.45, yA - 0.12, 0.25, yA + 0.12, fluidCol(s.sgA), { op: 0.9, box3: 'tank', a3: 0.5 });
        box(w - 0.25, yB - 0.12, w + 0.45, yB + 0.12, fluidCol(s.sgB), { op: 0.9, box3: 'tank', a3: 0.5 });
        box(-tb, yA + 0.12, tb, yL, fluidCol(s.sgA), { op: 0.9 });
        box(-tb, yL, tb, top, fluidCol(s.sgM), { op: 0.95 });
        box(-tb, top, w + tb, top + 2 * tb, fluidCol(s.sgM), { op: 0.95 });
        box(w - tb, yR, w + tb, top, fluidCol(s.sgM), { op: 0.95 });
        box(w - tb, yB + 0.12, w + tb, yR, fluidCol(s.sgB), { op: 0.9 });
        dot([0, yA], '#c0392b', 'A', { dx: -16, anchor: 'end' }); dot([w, yB], '#2980b9', 'B', { dx: 12 });
        items.push({ t: 'line', a: [-0.3, yL], b: [w + 0.3, yL], o: { stroke: '#5d6b7a', dash: '4 4', sw: 0.8 } });
        dim([-0.55, yA], [-0.55, yL], `z_A = ${f(zA)} ${Lu}`, 12, { anchor: 'end', ldx: -8 }, [-0.25, 0, 0]);
        dim([w + 0.25, yR], [w + 0.25, yL], `h = ${f(h)} ${Lu}`, -10, { anchor: 'start', ldx: 8 }, [0.25, 0, 0]);
        dim([w + 0.55, yB], [w + 0.55, yR], `z_B = ${f(g.zB)} ${Lu}`, -10, { anchor: 'start', ldx: 8 }, [0.45, 0, 0]);
        bounds = { xmin: -1, xmax: w + 1.4, ymin: Math.min(yA, yB) - 0.35, ymax: top + 0.35 };
      }
      bounds.ymin -= 0.15; text([w / 2, bounds.ymin + 0.06], `p_A − p_B = ${f(g.dP)} ${Pu}`, { anchor: 'middle', color: '#c0392b', size: 13, in3: true });
      tw = 2 * tb; depth = 0.3;
    } else if (s.sub === 'multi') {
      const legs = g.legs, w = 0.45, tb = 0.05;
      let z = 0; const zs = [0];
      legs.forEach((l) => { z += l.dz; zs.push(z); });
      const zmin = Math.min(...zs), zmax = Math.max(...zs);
      const ch = Math.max(0.5, 0.25 * (zmax - zmin + 1));
      // chamber A sits above node 0 (pipe leaves its bottom); B above the last node
      const xA = 0, xB = legs.length * w;
      const chamber = (x, zz, gas, label, p) => {
        box(x - 0.4, zz, x + 0.4, zz + ch, gas ? '#eaf3f9' : fluidCol(legs.length ? (label === 'A' ? legs[0].sg : legs[legs.length - 1].sg) : 1), { box3: 'tank', a3: 0.35, op: 0.85, sw: 2 });
        text([x - 0.35, zz + ch * 0.6], `${label}${gas ? ' (gas)' : ''}`, { size: 13, in3: true });
        text([x - 0.35, zz + ch * 0.3], `p = ${f(p)} ${Pu}`, { size: 11.5, color: '#c0392b', in3: true });
      };
      // legs
      legs.forEach((l, i) => {
        const x = (i + 0.5) * w, z0 = zs[i], z1 = zs[i + 1];
        box(x - tb, Math.min(z0, z1), x + tb, Math.max(z0, z1) + 1e-6, fluidCol(l.sg), { op: 0.95 });
        // connector from previous node x to this leg at z0
        const xp = i === 0 ? xA : (i - 0.5) * w;
        box(Math.min(xp, x) - tb, z0 - tb, Math.max(xp, x) + tb, z0 + tb, fluidCol(l.sg), { op: 0.95 });
        text([x, (z0 + z1) / 2], `${f(l.sg)}`, { dx: 8, size: 10.5, color: '#5d6b7a' });
        dim([x + 0.18, z0], [x + 0.18, z1], `${f(Math.abs(l.dz))}`, -4, { anchor: 'start', ldx: 4 }, [0.12, 0, 0]);
      });
      if (legs.length) { const xl = (legs.length - 0.5) * w; box(xl - tb, zs[legs.length] - tb, xB + tb, zs[legs.length] + tb, fluidCol(legs[legs.length - 1].sg), { op: 0.95 }); }
      g.nodes.forEach((q, i) => { const x = i === 0 ? xA : i === legs.length ? xB : (i - 0.5) * w; if (i > 0 && i < legs.length) dot([x, zs[i]], '#8e44ad', f(q), { r: 3.5, dx: -6, dy: -8, anchor: 'end' }); });
      chamber(xA, 0, g.gasA, 'A', g.pA);
      chamber(xB, zs[legs.length], g.gasB, 'B', g.pB);
      bounds = { xmin: -0.6, xmax: xB + 0.8, ymin: zmin - 0.3, ymax: Math.max(zmax, zs[legs.length]) + ch + 0.25 };
      text([-0.5, zmin - 0.15], 'purple dots: pressure at each interface (' + Pu + ')', { size: 10.5, color: '#8e44ad' });
      tw = 2 * tb; depth = 0.5;
    } else {
      const r1 = g.d1 / 2, r2 = g.d2 / 2, dz = g.dz, gap = Math.max(4 * r1, 0.5 * r2), x1 = 0, x2 = 2 * r1 + gap + r2;
      const base = Math.min(0, dz) - 0.5 * r2 - 0.15, hS = 0.4 + Math.max(0, -dz);
      const col = fluidCol(s.sgP);
      box(x1 - r1, base, x1 + r1, 0, col, { op: 0.9, box3: 'tank', a3: 0.6 });
      box(x2 - r2, base, x2 + r2, dz, col, { op: 0.9, box3: 'tank', a3: 0.6 });
      box(x1 - r1, base - 0.08, x2 + r2, base, col, { op: 0.9, box3: 'tank', a3: 0.6 });
      box(x1 - r1, 0, x1 + r1, 0.06, '#5d6d7e', { box3: 'tank', c3: '#5d6d7e', a3: 1, sw: 1.5 });
      box(x2 - r2, dz, x2 + r2, dz + 0.08, '#5d6d7e', { box3: 'tank', c3: '#5d6d7e', a3: 1, sw: 1.5 });
      const al = Math.max(0.25, 1.2 * r2);
      arrow([x1, 0.06 + al], [x1, 0.06], { color: '#c0392b', w: 3, label: `F₁ = ${f(g.F1)} ${U.force}`, lp: 'tail', ldx: -8, anchor: 'end' });
      arrow([x2, dz + 0.08], [x2, dz + 0.08 + al], { color: '#1e8449', w: 3, label: `F₂ = ${f(g.F2)} ${U.force}`, lp: 'head', ldx: 8 });
      dim([x1 - r1, base - 0.1], [x1 + r1, base - 0.1], `d₁ = ${f(g.d1)}`, 14, {}, [0, -0.1, 0]);
      dim([x2 - r2, base - 0.1], [x2 + r2, base - 0.1], `d₂ = ${f(g.d2)} ${Lu}`, 14, {}, [0, -0.1, 0]);
      if (Math.abs(dz) > 1e-6) dim([x2 + r2 + 0.1, 0], [x2 + r2 + 0.1, dz], `Δz = ${f(dz)} ${Lu}`, -10, { anchor: 'start', ldx: 8 }, [0.2, 0, 0]);
      text([x1 - r1, base / 2], `p₁ = ${f(g.p1)} ${Pu}`, { anchor: 'end', dx: -6, color: '#5d6b7a', size: 11 });
      text([x2 + r2, (dz + base) / 2], `p₂ = ${f(g.p2)} ${Pu}`, { dx: 6, color: '#5d6b7a', size: 11 });
      bounds = { xmin: x1 - r1 - 0.5, xmax: x2 + r2 + 0.7, ymin: base - 0.35, ymax: Math.max(0, dz) + al + 0.25 };
      tw = 0.1; depth = Math.max(2 * r2, 0.3);
      void hS;
    }
    return { items, bounds, padR, tw, depth };
  }

  root.MP = MP;
})(window);
