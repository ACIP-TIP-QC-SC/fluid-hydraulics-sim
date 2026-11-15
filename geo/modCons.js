/* =====================================================================
 * STEP 4 — Consolidation (UI, diagrams, charts, 3D)
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Physics } = root;
  const G = root.GeoUI, GP = root.GeoProfile;
  const f = Physics.fmt;
  const CO = '#8e44ad', CC = '#c0392b', CF = '#d35400', DR = '#2980b9';
  const LEN = 1 / 0.3048, STR = 20.885434;

  const profC = (over) => Object.assign({ by: 'gamma', wt: 2, layers: [{ soil: 'sand', H: 5, g: 16.5, gsat: 18.8 }, { soil: 'clay', H: 4, g: 18, gsat: 19.2 }] }, over || {});
  const base = { layer: 1, n: 1, e0: 0.9, ccBy: 'given', Cc: 0.28, Cs: 0.05, LL: 50, hist: 'NC', pc: 100, OCR: 2, load: 'uniform', q: 60, B: 3, L: 3, cv: 2, drain: 'double', solve: 't', U: 90, t: 1, sec: false, Ca: 0.02, t1By: 'auto', t1: 2, t2: 20 };

  const GCons = {
    id: 'cons', title: 'Consolidation',
    state: Object.assign({}, base),
    presets: [
      { name: 'Test C1 — NC clay 4 m (e₀ 0.9, C_c 0.28) below 5 m sand, GWT 2 m, Δσ = 60 kPa → S_c = 145.0 mm', apply: (s) => { GP.set(profC()); Object.assign(s, base); } },
      { name: 'Test C2 — same clay overconsolidated, σ′c = 100 kPa (case 2) → S_c = 94.76 mm', apply: (s) => { GP.set(profC()); Object.assign(s, base, { hist: 'pc', pc: 100 }); } },
      { name: 'Overconsolidated OCR = 3 (case 1, recompression only)', apply: (s) => { GP.set(profC()); Object.assign(s, base, { hist: 'OCR', OCR: 3 }); } },
      { name: 'Test C3 — time for 90 % consolidation: c_v = 2 m²/yr, double drainage, H = 4 m (T_v = 0.848, t = 1.696 yr)', apply: (s) => { GP.set(profC()); Object.assign(s, base, { solve: 't', U: 90, drain: 'double', cv: 2 }); } },
      { name: 'Degree of consolidation after 6 months, single drainage', apply: (s) => { GP.set(profC()); Object.assign(s, base, { solve: 'U', t: 0.5, drain: 'top', cv: 2 }); } },
      { name: 'Footing 4 × 4 m, 150 kPa on 3 m sand over 6 m clay: Boussinesq, 6 sublayers', apply: (s) => { GP.set(profC({ wt: 1.5, layers: [{ soil: 'sand', H: 3, g: 17, gsat: 19.5 }, { soil: 'clay', H: 6, g: 17.5, gsat: 18.4 }, { soil: 'gravel', H: 2, g: 19, gsat: 21 }] })); Object.assign(s, base, { e0: 1.05, Cc: 0.36, Cs: 0.06, load: 'bouss', q: 150, B: 4, L: 4, n: 6, cv: 1.5 }); } },
      { name: 'Same footing by the 2:1 method', apply: (s) => { GP.set(profC({ wt: 1.5, layers: [{ soil: 'sand', H: 3, g: 17, gsat: 19.5 }, { soil: 'clay', H: 6, g: 17.5, gsat: 18.4 }, { soil: 'gravel', H: 2, g: 19, gsat: 21 }] })); Object.assign(s, base, { e0: 1.05, Cc: 0.36, Cs: 0.06, load: '21', q: 150, B: 4, L: 4, n: 6, cv: 1.5 }); } },
      { name: 'C_c from LL = 60 and secondary compression to 25 years', apply: (s) => { GP.set(profC()); Object.assign(s, base, { ccBy: 'LL', LL: 60, sec: true, Ca: 0.025, t1By: 'auto', t2: 25 }); } },
      { name: 'Soft clay from G_s and e (e₀ = 1.4), fill 40 kPa', apply: (s) => { GP.set(profC({ by: 'phase', wt: 1, layers: [{ soil: 'fill', H: 2, Gs: 2.65, e: 0.7, S: 50 }, { soil: 'clay', H: 8, Gs: 2.7, e: 1.4, S: 100 }, { soil: 'sand', H: 3, Gs: 2.65, e: 0.6, S: 100 }] })); Object.assign(s, base, { e0: 1.4, Cc: 0.6, Cs: 0.1, q: 40, n: 4, cv: 0.8 }); } },
      { name: 'English units: clay 12 ft, Δσ = 1000 psf, c_v = 20 ft²/yr', units: 'EN', apply: (s) => { GP.set({ by: 'gamma', wt: 6, layers: [{ soil: 'sand', H: 15, g: 110, gsat: 125 }, { soil: 'clay', H: 12, g: 112, gsat: 118 }] }); Object.assign(s, base, { e0: 0.85, Cc: 0.3, Cs: 0.05, q: 1000, pc: 2000, cv: 20, B: 10, L: 10 }); } },
    ],
    legend: [[CO, 'σ′₀ initial', 'ln'], [CC, 'σ′c preconsolidation', 'ln'], [CF, 'σ′₀ + Δσ final', 'ln'], [DR, 'drainage', 'ln']],
    toggle: 'Stress profile in the clay',
    plotCaption: 'e–log σ′, T_v–U and settlement–time',

    controls(el, C) {
      const s = this.state, U = root.App.U(), en = U.id === 'EN';
      const sl = (p, k, label, min, max, step, unit, extra) => C.slider(p, Object.assign({ label, min, max, step, get: () => s[k], set: (v) => (s[k] = v), unit }, extra || {}));
      GP.controls(el, C, U, { seepage: false });
      const c = C.section(el, 'Compressible clay layer');
      if (s.layer >= GP.state.layers.length) s.layer = GP.state.layers.length - 1;
      C.select(c, { label: 'Layer that consolidates', options: GP.state.layers.map((l, i) => [i, `Layer ${i + 1} (${(G.SOILS[l.soil] || G.SOILS.sand).name}, ${f(l.H)} ${U.len})`]), get: () => s.layer, set: (v) => (s.layer = +v) });
      sl(c, 'n', 'Number of sublayers', 1, 20, 1, '');
      sl(c, 'e0', 'Initial void ratio e₀', 0.2, 4, 0.001, '');
      C.seg(c, { label: 'Compression index', options: [['given', 'C_c given'], ['LL', 'From LL (Skempton)']], get: () => s.ccBy, set: (v) => (s.ccBy = v) });
      if (s.ccBy === 'given') sl(c, 'Cc', 'Compression index C_c', 0.01, 3, 0.001, ''); else sl(c, 'LL', 'Liquid limit LL', 15, 150, 0.1, '%');
      sl(c, 'Cs', 'Swell / recompression index C_s', 0, 0.6, 0.001, '');
      C.seg(c, { label: 'Stress history', options: [['NC', 'Normally consolidated'], ['pc', 'σ′c given'], ['OCR', 'OCR given']], get: () => s.hist, set: (v) => (s.hist = v) });
      if (s.hist === 'pc') sl(c, 'pc', 'Preconsolidation pressure σ′c (at mid-depth)', 1, en ? 20000 : 1000, 0.1, U.press);
      if (s.hist === 'OCR') sl(c, 'OCR', 'Overconsolidation ratio OCR', 1, 20, 0.01, '');
      const l = C.section(el, 'New load');
      C.seg(l, { label: 'Stress increase from', options: [['uniform', 'Wide fill (uniform)'], ['bouss', 'Footing (Boussinesq)'], ['21', 'Footing (2:1)']], get: () => s.load, set: (v) => (s.load = v) });
      sl(l, 'q', s.load === 'uniform' ? 'Fill pressure Δσ' : 'Footing pressure q', 1, en ? 20000 : 1000, 0.1, U.press);
      if (s.load !== 'uniform') { sl(l, 'B', 'Footing width B', 0.3, en ? 150 : 50, 0.01, U.len); sl(l, 'L', 'Footing length L', 0.3, en ? 150 : 50, 0.01, U.len); }
      C.note(l, 'The surcharge in the soil profile is part of the initial stress; this load is the new one that causes consolidation.');
      const t = C.section(el, 'Time rate');
      sl(t, 'cv', 'Coefficient of consolidation c_v', 0.01, en ? 500 : 50, 0.01, U.cv);
      C.seg(t, { label: 'Drainage', options: [['double', 'Double (top and bottom)'], ['top', 'Top only'], ['bottom', 'Bottom only']], get: () => s.drain, set: (v) => (s.drain = v) });
      C.seg(t, { label: 'Solve for', options: [['t', 'Time for a given U'], ['U', 'U at a given time']], get: () => s.solve, set: (v) => (s.solve = v) });
      if (s.solve === 't') sl(t, 'U', 'Average degree of consolidation U', 1, 99.9, 0.1, '%'); else sl(t, 't', 'Elapsed time t', 0.001, 100, 0.001, 'yr');
      const x = C.section(el, 'Secondary compression');
      C.toggle(x, { label: 'Include secondary compression', get: () => s.sec, set: (v) => (s.sec = v) });
      if (s.sec) {
        sl(x, 'Ca', 'Secondary compression index C_α', 0.001, 0.2, 0.001, '');
        C.seg(x, { label: 'Start t₁', options: [['auto', 'End of primary (U = 99 %)'], ['given', 'Given']], get: () => s.t1By, set: (v) => (s.t1By = v) });
        if (s.t1By === 'given') sl(x, 't1', 'Time t₁', 0.01, 100, 0.01, 'yr');
        sl(x, 't2', 'Time of interest t₂', 0.1, 200, 0.1, 'yr');
      }
    },
    onUnits(from, to) {
      const s = this.state, k = to === 'EN' ? 1 : -1, L = Math.pow(LEN, k), S = Math.pow(STR, k), r = (x) => +(+x).toPrecision(5);
      s.q = r(s.q * S); s.pc = r(s.pc * S); s.B = r(s.B * L); s.L = r(s.L * L); s.cv = r(s.cv * L * L);
    },
    compute(U) { return Physics.consolidation(this.state, GP.state, U); },

    draw2D(svg, res, U, opts) {
      const g = res.geo, pr = g.pr, Ht = pr.Ht, s = this.state;
      const show = opts.showP !== false;
      const W = 0.55 * Ht, Pw = 0.75 * Ht, gx = W + 0.3 * Ht;
      const top = pr.pond + 0.22 * Ht;
      const D = root.UI.Draw2D(svg, { xmin: -0.3 * Ht, xmax: show ? gx + Pw + 0.12 * Ht : W + 0.3 * Ht, ymin: -Ht * 1.06, ymax: top }, { pad: 36 });
      G.soilDefs(svg);
      GP.drawColumn(D, pr, { x0: 0, x1: W, U, piezo: false });
      // clay layer, sublayers
      D.poly([[0, -g.zb], [W, -g.zb], [W, -g.zt], [0, -g.zt]], { stroke: CF, sw: 2.6 });
      g.subs.forEach((q, j) => { if (j > 0) D.line([0, -(g.zt + (j * g.H) / g.subs.length)], [W, -(g.zt + (j * g.H) / g.subs.length)], { stroke: CF, sw: 0.9, dash: '4 3' }); D.dot([W * 0.82, -q.zm], CF, '', { r: 2.8 }); });
      D.dim([0, -g.zb], [0, -g.zt], `H = ${f(g.H)}`, 14, { anchor: 'end', ldx: -6 });
      // drainage arrows
      const dr = s.drain;
      if (dr !== 'bottom') [0.25, 0.5].forEach((fx) => D.arrow([W * fx, -g.zt - 0.04 * Ht], [W * fx, -g.zt + 0.06 * Ht], { color: DR, w: 2, head: 8 }));
      if (dr !== 'top') [0.25, 0.5].forEach((fx) => D.arrow([W * fx, -g.zb + 0.04 * Ht], [W * fx, -g.zb - 0.06 * Ht], { color: DR, w: 2, head: 8 }));
      D.text([W, -g.zt], `H_dr = ${f(g.Hdr)}`, { anchor: 'end', dx: -4, dy: -5, size: 10.5, color: DR });
      // the new load
      const yTop = pr.pond + (pr.q > 0 ? 0.06 * Ht : 0);
      const hl = 0.07 * Ht;
      if (s.load === 'uniform') {
        D.poly([[0, yTop], [W, yTop], [W, yTop + hl], [0, yTop + hl]], { fill: '#a1887f', fop: 0.5, stroke: '#6d4c41', sw: 1.2 });
        D.text([W / 2, yTop + hl], `fill Δσ = ${f(s.q)} ${U.press}`, { anchor: 'middle', dy: -5, size: 11, color: '#6d4c41', weight: 700 });
      } else {
        const bw = Math.min(W * 0.9, Math.max(W * 0.25, s.B / Math.max(s.B, Ht) * W));
        D.poly([[W / 2 - bw / 2, yTop], [W / 2 + bw / 2, yTop], [W / 2 + bw / 2, yTop + hl], [W / 2 - bw / 2, yTop + hl]], { fill: 'url(#concrete)', stroke: '#6e6a5e', sw: 1.4 });
        for (let i = 0; i <= 4; i++) { const x = W / 2 - bw / 2 + (bw * i) / 4; D.arrow([x, yTop + hl + 0.06 * Ht], [x, yTop + hl], { color: '#e67e22', w: 1.3, head: 6 }); }
        D.text([W / 2, yTop + hl + 0.06 * Ht], `${f(s.B)} × ${f(s.L)}, q = ${f(s.q)}`, { anchor: 'middle', dy: -5, size: 11, color: '#b9581c', weight: 700 });
      }
      // settled surface
      const sp = Math.min(0.08 * Ht, Math.max(0.02 * Ht, g.Sc * 3));
      D.line([0, yTop - sp], [W, yTop - sp], { stroke: CC, sw: 1.6, dash: '6 4' });
      D.text([0, yTop - sp], `settled surface: S_c = ${f(g.Sc * U.settleF)} ${U.settle} (exaggerated)`, { dx: 4, dy: 13, size: 10.5, color: CC });
      if (!show) return;
      // stress profile across the clay
      const smax = Math.max(...g.subs.map((q) => Math.max(q.sf, q.sc)), 1e-9), k = (0.8 * Pw) / smax;
      const zs = [g.zt].concat(g.subs.map((q) => q.zm), [g.zb]);
      const at = (z) => { const v = Physics.profileAt(pr, z); const sc = s.hist === 'NC' ? v.e : s.hist === 'OCR' ? Math.max(v.e, s.OCR * v.e) : Math.max(v.e, s.pc + (v.e - g.mid.e)); return { so: v.e, sc, sf: v.e + g.dsFn(z) }; };
      const rows = zs.map((z) => ({ z, ...at(Math.max(z, 1e-6)) }));
      D.line([gx, -g.zt + 0.05 * Ht], [gx, -g.zb - 0.02 * Ht], { stroke: '#2c3e50', sw: 1.2 });
      D.line([gx, -g.zt], [gx + Pw, -g.zt], { stroke: '#bdc3c7', sw: 0.8 });
      D.line([gx, -g.zb], [gx + Pw, -g.zb], { stroke: '#bdc3c7', sw: 0.8 });
      D.text([gx + Pw / 2, -g.zt + 0.05 * Ht], `stresses in the clay (${U.press})`, { anchor: 'middle', dy: -4, size: 11.5, color: '#34495e' });
      D.poly(rows.map((r) => [gx + r.so * k, -r.z]).concat(rows.slice().reverse().map((r) => [gx + r.sf * k, -r.z])), { fill: CF, fop: 0.12 });
      [['so', CO, '', 'σ′₀'], ['sc', CC, '6 4', 'σ′c'], ['sf', CF, '', 'σ′_f']].forEach(([key, col, dash, nm]) => {
        if (key === 'sc' && s.hist === 'NC') return;
        D.pline(rows.map((r) => [gx + r[key] * k, -r.z]), { stroke: col, sw: 2.2, dash: dash || undefined });
        const r0 = rows[Math.floor(rows.length / 2)];
        D.text([gx + r0[key] * k, -r0.z], `${nm} = ${f(r0[key])}`, { dx: 5, dy: key === 'so' ? -6 : key === 'sc' ? 12 : 4, size: 10.5, color: col });
      });
    },

    draw3D(V, res, U, opts) {
      const g = res.geo, pr = g.pr, Ht = pr.Ht, W = 0.8 * Ht, Lz = 0.8 * Ht, s = this.state;
      GP.column3D(V, pr, { x0: 0, x1: W, z0: 0, z1: Lz });
      V.line([[0, -g.zt, Lz], [W, -g.zt, Lz], [W, -g.zb, Lz], [0, -g.zb, Lz], [0, -g.zt, Lz]], CF, 2.6);
      const yTop = pr.pond, h = 0.06 * Ht;
      if (s.load === 'uniform') V.box(0, yTop, 0, W, yTop + h, Lz, '#a1887f', 0.85, '#6d4c41');
      else { const bw = Math.min(W * 0.9, Math.max(W * 0.25, (s.B / Math.max(s.B, Ht)) * W)), bl = Math.min(Lz * 0.9, Math.max(Lz * 0.25, (s.L / Math.max(s.L, Ht)) * Lz)); V.box(W / 2 - bw / 2, yTop, Lz / 2 - bl / 2, W / 2 + bw / 2, yTop + h, Lz / 2 + bl / 2, '#c9c6bb', 0.95, '#6e6a5e'); }
      if (s.drain !== 'bottom') G.arrow3D(V, [W * 1.08, -g.zt - 0.05 * Ht, Lz / 2], [W * 1.08, -g.zt + 0.08 * Ht, Lz / 2], DR, 2.4, 'drainage', 0.03 * Ht);
      if (s.drain !== 'top') G.arrow3D(V, [W * 1.08, -g.zb + 0.05 * Ht, Lz / 2], [W * 1.08, -g.zb - 0.08 * Ht, Lz / 2], DR, 2.4, null, 0.03 * Ht);
      V.label([W, yTop + h, Lz], `S_c = ${f(g.Sc * U.settleF)} ${U.settle}`, CC);
      V.dim([0, -g.zb, Lz], [0, -g.zt, Lz], `H = ${f(g.H)} ${U.len}`, [-0.1 * Ht, 0, 0]);
      V.autoBounds();
    },

    plot(svg, res, U) {
      const g = res.geo, s = this.state, { W, H } = G.chartSurface(svg), R = G.panels(W, H, 3);
      // e–log σ′ at mid-depth
      const so = g.mid.e, sc = s.hist === 'NC' ? so : s.hist === 'OCR' ? Math.max(so, s.OCR * so) : Math.max(so, s.pc), sf = so + g.dsFn(g.zt + g.H / 2);
      const ec = g.e0 - g.Cs * Math.log10(sc / so);
      const ef = sf <= sc ? g.e0 - g.Cs * Math.log10(sf / so) : ec - g.Cc * Math.log10(sf / sc);
      const path = sf <= sc ? [[so, g.e0], [sf, ef]] : [[so, g.e0], [sc, ec], [sf, ef]];
      const xmin = so / 2, xmax = Math.max(sf, sc) * 2.2;
      const virgin = [[sc, ec], [xmax, ec - g.Cc * Math.log10(xmax / sc)]];
      G.chart(svg, R[0], { title: 'e–log σ′ at mid-depth', xlab: `σ′ (${U.press}, log scale)`, ylab: 'void ratio e', xlog: true, xmin, xmax, ymin: Math.min(ef, virgin[1][1]) - 0.03 * (g.e0 - ef + 1e-3), ymax: g.e0 + 0.25 * (g.e0 - Math.min(ef, virgin[1][1]) + 1e-3), series: [{ pts: virgin, color: '#95a5a6', dash: '5 4' }, { pts: path, color: CF, w: 2.6 }], vlines: s.hist !== 'NC' ? [{ x: sc, label: 'σ′c', color: CC }] : [], marks: [{ x: so, y: g.e0, label: `e₀ = ${f(g.e0)}`, color: CO }, { x: sf, y: ef, label: `e = ${f(ef)}`, color: CF, anchor: 'end', dy: 16 }] });
      G.chart(svg, R[1], { title: 'Degree of consolidation U versus T_v', xlab: 'time factor T_v (log scale)', ylab: 'U (%)', xlog: true, xmin: 0.001, xmax: 10, ymin: 0, ymax: 100, series: [{ pts: g.tvU, color: DR, w: 2.4 }], marks: [{ x: g.Tv, y: g.Uavg * 100, label: `T_v = ${f(g.Tv, 3)}, U = ${f(g.Uavg * 100, 3)} %`, color: CC, anchor: 'end' }] });
      G.chart(svg, R[2], { title: 'Primary settlement versus time', xlab: 'time t (yr, log scale)', ylab: `settlement (${U.settle})`, xlog: true, ydown: true, ymin: 0, ymax: g.Sc * U.settleF * 1.05, series: [{ pts: g.curve, color: CF, w: 2.4 }], hlines: [{ y: g.Sc * U.settleF, label: '', color: CC }], marks: [{ x: g.t, y: g.Uavg * g.Sc * U.settleF, label: `t = ${f(g.t, 3)} yr`, color: CC, anchor: 'end' }] });
      return true;
    },
  };

  root.GCons = GCons;
})(window);
