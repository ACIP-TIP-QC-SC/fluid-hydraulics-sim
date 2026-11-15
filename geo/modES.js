/* =====================================================================
 * STEP 2 — Effective Stress (UI, diagrams, charts, 3D)
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Physics } = root;
  const G = root.GeoUI, GP = root.GeoProfile;
  const f = Physics.fmt;
  const CS = '#d35400', CU = '#2471a3', CE = '#8e44ad';

  const two = [{ soil: 'sand', H: 4, g: 17, gsat: 19 }, { soil: 'clay', H: 5, g: 17.5, gsat: 18.5 }];
  const GES = {
    id: 'es', title: 'Effective Stress',
    state: { zP: 6 },
    presets: [
      { name: 'Test E1 — sand 4 m (γ 17 / γ_sat 19) over clay 5 m (γ_sat 18.5), GWT at 2 m → σ′ = 52.38 kPa at 4 m, 95.83 kPa at 9 m', apply: (s) => { GP.set({ by: 'gamma', layers: two, wt: 2 }); s.zP = 9; } },
      { name: 'Test E2 — unit weights from G_s and e: dry sand 3 m (e 0.5), saturated sand 3 m, clay 4 m (e 1.1)', apply: (s) => { GP.set({ by: 'phase', wt: 3, layers: [{ soil: 'sand', H: 3, Gs: 2.65, e: 0.5, S: 0 }, { soil: 'sand', H: 3, Gs: 2.65, e: 0.5, S: 0 }, { soil: 'clay', H: 4, Gs: 2.72, e: 1.1, S: 100 }] }); s.zP = 10; } },
      { name: 'Capillary rise 1.5 m in silt, negative pore pressure (S = 100 %)', apply: (s) => { GP.set({ by: 'gamma', wt: 3.5, cap: 1.5, capS: 100, capNeg: true, layers: [{ soil: 'silt', H: 5, g: 16.5, gsat: 19.2 }, { soil: 'clay', H: 4, g: 17.8, gsat: 18.6 }] }); s.zP = 2; } },
      { name: 'Artesian (upward) seepage in clay: piezometer 2.5 m above the GWT', apply: (s) => { GP.set({ by: 'gamma', wt: 1.5, seep: 'up', seepLayer: 1, dh: 2.5, layers: [{ soil: 'sand', H: 3, g: 16.8, gsat: 19.6 }, { soil: 'clay', H: 4, g: 17.5, gsat: 18.2 }, { soil: 'gravel', H: 2, g: 19, gsat: 21 }] }); s.zP = 7; } },
      { name: 'Upward seepage strong enough to cause a quick condition', apply: (s) => { GP.set({ by: 'gamma', wt: 0, seep: 'up', seepLayer: 0, dh: 4.5, layers: [{ soil: 'sand', H: 4, g: 18, gsat: 19.5 }, { soil: 'gravel', H: 3, g: 19, gsat: 21 }] }); s.zP = 4; } },
      { name: 'Downward seepage (drainage) through a 3 m clay layer, Δh = 1.2 m', apply: (s) => { GP.set({ by: 'gamma', wt: 2, seep: 'down', seepLayer: 1, dh: 1.2, layers: [{ soil: 'sand', H: 4, g: 17, gsat: 19 }, { soil: 'clay', H: 3, g: 17.5, gsat: 18.5 }, { soil: 'sand', H: 3, g: 18, gsat: 20 }] }); s.zP = 7; } },
      { name: 'Lake bed: 5 m of water above the ground (σ′ is not changed by the water depth)', apply: (s) => { GP.set({ by: 'gamma', wt: -5, layers: [{ soil: 'silt', H: 3, g: 17, gsat: 18.5 }, { soil: 'clay', H: 6, g: 17, gsat: 17.8 }] }); s.zP = 9; } },
      { name: 'Five layers with a 60 kPa surcharge', apply: (s) => { GP.set({ by: 'gamma', wt: 2.5, q: 60, layers: [{ soil: 'fill', H: 1.5, g: 18, gsat: 19.5 }, { soil: 'sand', H: 2.5, g: 17, gsat: 19.5 }, { soil: 'clay', H: 4, g: 17, gsat: 18 }, { soil: 'peat', H: 1.5, g: 11, gsat: 12.5 }, { soil: 'gravel', H: 3, g: 19.5, gsat: 21.5 }] }); s.zP = 8; } },
      { name: 'English units: sand 10 ft (110 / 125 pcf), clay 15 ft (118 pcf), GWT at 6 ft', units: 'EN', apply: (s) => { GP.set({ by: 'gamma', wt: 6, layers: [{ soil: 'sand', H: 10, g: 110, gsat: 125 }, { soil: 'clay', H: 15, g: 112, gsat: 118 }] }); s.zP = 25; } },
    ],
    legend: [[CS, 'total stress σ', 'ln'], [CU, 'pore pressure u', 'ln'], [CE, 'effective stress σ′', 'ln'], ['#4aa3df', 'below the water table', 'sq']],
    toggle: 'Stress diagrams',
    plotCaption: 'Stresses versus depth',

    controls(el, C) {
      const s = this.state, U = root.App.U();
      GP.controls(el, C, U);
      const p = C.section(el, 'Point of interest');
      const Ht = GP.state.layers.reduce((a, l) => a + (l.H > 0 ? l.H : 0), 0);
      C.slider(p, { label: 'Depth of point P below the ground', min: 0, max: Math.max(1, +Ht.toFixed(2)), step: 0.01, get: () => s.zP, set: (v) => (s.zP = v), unit: U.len });
    },
    onUnits(from, to) { this.state.zP = +(this.state.zP * (to === 'EN' ? 1 / 0.3048 : 0.3048)).toPrecision(5); },
    compute(U) { return Physics.effStress(Object.assign({}, GP.state, { zP: this.state.zP }), U); },

    draw2D(svg, res, U, opts) {
      const pr = res.geo.pr, Ht = pr.Ht, zP = res.geo.zP;
      const show = opts.showP !== false;
      const top0 = pr.pond + (pr.q > 0 ? 0.08 * Ht : 0) + 0.12 * Ht, Hs = Ht * 1.05 + top0;
      const asp = Math.max(0.6, (svg.clientWidth || 800) / (svg.clientHeight || 560));
      const W = 0.4 * Ht, gap = 0.12 * Ht;
      const Pw = Math.min(1.1 * Ht, Math.max(0.3 * Ht, (asp * Hs * 0.92 - 0.32 * Ht - W) / 3 - gap));
      const sMax = Math.max(...pr.pts.map((p) => Math.max(Math.abs(p.s), Math.abs(p.u), Math.abs(p.e))), 1e-9);
      const uMin = Math.min(0, ...pr.pts.map((p) => Math.min(p.u, p.e)));
      const k = (0.8 * Pw) / (sMax - uMin);
      const neg = -uMin * k;
      const top = top0;
      const xr = show ? W + 3 * (Pw + gap) : W + 0.4 * Ht;
      const D = root.UI.Draw2D(svg, { xmin: -0.32 * Ht, xmax: xr, ymin: -Ht * 1.05, ymax: top }, { pad: 36 });
      G.soilDefs(svg);
      GP.drawColumn(D, pr, { x0: 0, x1: W, U });
      // layer dimensions & water table depth
      let z = 0; pr.Ls.forEach((l, i) => { D.dim([0, -z - l.H], [0, -z], `H${i + 1} = ${f(l.H)}`, 12, { anchor: 'end', ldx: -6 }); z += l.H; });
      if (pr.zw > 0 && pr.zw < Ht) D.dim([-0.2 * Ht, -pr.zw], [-0.2 * Ht, 0], `z_w = ${f(pr.zw)}`, 0, { anchor: 'end', ldx: -6 });
      // point P
      D.line([-0.05 * Ht, -zP], [show ? xr : W, -zP], { stroke: '#7f8c8d', sw: 1, dash: '2 4' });
      D.dot([W / 2, -zP], '#16a085', 'P', { r: 5 });
      if (!show) return;
      const panels = [['Total stress σ', 's', CS], ['Pore pressure u', 'u', CU], ['Effective stress σ′', 'e', CE]];
      panels.forEach(([title, key, col], j) => {
        const x0 = W + gap + j * (Pw + gap) + neg;
        const pts = pr.pts.map((p) => [x0 + p[key] * k, -p.z]);
        D.poly([[x0, 0]].concat(pts, [[x0, -Ht]]), { fill: col, fop: 0.16, stroke: 'none' });
        D.pline(pts, { stroke: col, sw: 2.2 });
        D.line([x0, 0.02 * Ht], [x0, -Ht], { stroke: '#2c3e50', sw: 1.2 });
        D.line([x0 - neg - 0.02 * Ht, 0], [x0 + 0.85 * Pw, 0], { stroke: '#2c3e50', sw: 1 });
        D.text([x0 + 0.35 * Pw, 0.03 * Ht], title, { anchor: 'middle', dy: -6, size: 12, color: col, weight: 700 });
        // values at the breakpoints (skip repeats)
        let lastY = null;
        pr.pts.forEach((p, i) => {
          const v = p[key];
          const prev = pr.pts[i - 1];
          if (prev && Math.abs(prev.z - p.z) < 1e-9 && Math.abs(prev[key] - v) < 1e-9) return;
          const yp = D.Y(-p.z);
          const dupZ = prev && Math.abs(prev.z - p.z) < 1e-9;
          if (lastY !== null && Math.abs(yp - lastY) < 12 && !dupZ) return;
          if (Math.abs(v) < 1e-9 && p.z === 0) return;
          D.text([x0 + v * k, -p.z], f(v), { dx: v < 0 ? -4 : 4, dy: dupZ ? 12 : -3, anchor: v < 0 ? 'end' : 'start', size: 10.5, color: col });
          lastY = yp;
        });
        const vP = res.geo.P[key];
        D.dot([x0 + vP * k, -zP], '#16a085', '', { r: 3.5 });
        if (!pr.pts.some((p) => Math.abs(p.z - zP) * D.sc < 14)) D.text([x0 + vP * k, -zP], `${f(vP)}`, { dx: 6, dy: 14, size: 11, color: '#16a085', weight: 700 });
        // boundaries
        pr.tops.slice(1).forEach((t) => D.line([x0 - neg, -t], [x0 + 0.85 * Pw, -t], { stroke: '#bdc3c7', sw: 0.8, dash: '3 3' }));
      });
      D.text([xr, top], `stresses in ${U.press}, depth in ${U.len}`, { anchor: 'end', dy: 4, size: 10.5, color: '#5d6b7a' });
    },

    draw3D(V, res, U, opts) {
      const pr = res.geo.pr, Ht = pr.Ht, W = 0.6 * Ht, Lz = 0.6 * Ht;
      GP.column3D(V, pr, { x0: 0, x1: W, z0: 0, z1: Lz });
      if (opts.showP !== false) {
        const sMax = Math.max(...pr.pts.map((p) => Math.max(Math.abs(p.s), Math.abs(p.u))), 1e-9), k = (0.45 * Ht) / sMax;
        [['s', CS, 'σ'], ['u', CU, 'u'], ['e', CE, 'σ′']].forEach(([key, col, nm], j) => {
          const x0 = W + 0.15 * Ht + j * 0.6 * Ht, zz = Lz;
          const pts = pr.pts.map((p) => [x0 + p[key] * k, -p.z, zz]);
          V.face([[x0, 0, zz]].concat(pts, [[x0, -Ht, zz]]), col, 0.3, col);
          V.line([[x0, 0, zz], [x0, -Ht, zz]], '#2c3e50', 1.2);
          const b = pr.pts[pr.pts.length - 1];
          V.label([x0 + b[key] * k, -Ht, zz], `${nm} = ${f(b[key])} ${U.press}`, col);
        });
      }
      V.label([W / 2, -res.geo.zP, Lz], `P: σ′ = ${f(res.geo.P.e)} ${U.press}`, '#16a085');
      V.dim([0, -Ht, Lz], [0, 0, Lz], `${f(Ht)} ${U.len}`, [-0.12 * Ht, 0, 0]);
      V.autoBounds();
    },

    plot(svg, res, U) {
      const pr = res.geo.pr, { W, H } = G.chartSurface(svg);
      const ser = (key) => pr.pts.map((p) => [p[key], p.z]);
      const xmin = Math.min(0, ...pr.pts.map((p) => p.u));
      G.chart(svg, { x: 0, y: 0, w: W, h: H }, { title: 'Total stress, pore pressure and effective stress versus depth', xlab: `stress (${U.press})`, ylab: `depth z (${U.len})`, ydown: true, ymin: 0, ymax: pr.Ht, xmin,
        series: [{ pts: ser('s'), color: CS, label: 'σ total' }, { pts: ser('u'), color: CU, label: 'u pore water' }, { pts: ser('e'), color: CE, w: 2.6, label: 'σ′ effective' }],
        hlines: [{ y: res.geo.zP, label: 'P', color: '#16a085' }].concat(pr.zw > 0 && pr.zw < pr.Ht ? [{ y: pr.zw, label: 'GWT', color: '#1f6fa8' }] : []),
        marks: [{ x: res.geo.P.e, y: res.geo.zP, label: `σ′ = ${f(res.geo.P.e)}`, color: CE }] });
      return true;
    },
  };

  root.GES = GES;
})(window);
