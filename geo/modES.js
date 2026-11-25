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
  const { h } = root.UI;

  /* ---------------- Soil phase relations ---------------- */
  function phaseControls(el, C, ph, U) {
    const Q = Physics.PHASE_Q, LAB = Physics.PHASE_LAB[U.id] || Physics.PHASE_LAB.SI;
    if (!LAB[ph.lab]) ph.lab = Object.keys(LAB)[0];
    const lab = LAB[ph.lab];
    const g = C.section(el, 'Known quantities (tick each one the problem gives)');
    if (U.id === 'SI') C.toggle(g, { label: 'Unit weights entered as densities ρ (kg/m³)', get: () => ph.dens, set: (v) => (ph.dens = v) });
    const unitOf = (k) => { const q = Q[k]; return q.kind === 'pct' ? '%' : q.kind === 'gam' ? (ph.dens && U.id === 'SI' ? 'kg/m³' : U.gamma) : q.kind === 'lab' ? lab.m : q.kind === 'labV' ? lab.v : ''; };
    const groups = [['Basic', ['Gs', 'e', 'n', 'w', 'S']], ['Unit weights', ['gm', 'gd', 'gsat', 'gsub', 'gs']], ['Other', ['ac', 'icr', 'emax', 'emin', 'Dr']], ['Laboratory sample', ['M', 'Ms', 'V']]];
    groups.forEach(([title, keys]) => {
      const sec = title === 'Basic' ? g : C.section(el, title);
      if (title === 'Laboratory sample') {
        C.select(sec, { label: 'Units of mass and volume', options: Object.keys(LAB).map((k) => [k, `${LAB[k].m} and ${LAB[k].v}`]), get: () => ph.lab, set: (v) => (ph.lab = v) });
      }
      keys.forEach((k) => {
        const on = !!ph.known[k];
        const cb = h('input', { type: 'checkbox', checked: on, 'aria-label': `${Q[k].label} known` });
        const num = h('input', { type: 'number', step: 'any', class: 'num', value: ph.val[k], disabled: !on || (k === 'V' && ph.jar), 'aria-label': Q[k].label });
        cb.addEventListener('change', () => { ph.known[k] = cb.checked; root.App.rebuild(true); });
        num.addEventListener('input', () => { const v = parseFloat(num.value); if (!isFinite(v)) return; ph.val[k] = v; root.App.update(); });
        sec.append(h('div', { class: 'known-row' + (on ? '' : ' off') }, cb, h('span', null, Q[k].label), num, h('span', { class: 'unit' }, unitOf(k))));
      });
      if (title === 'Laboratory sample' && ph.known.V) {
        C.toggle(sec, { label: 'Volume from a container: V = V_container − water added', get: () => ph.jar, set: (v) => (ph.jar = v) });
        if (ph.jar) {
          C.slider(sec, { label: 'Volume of the container', min: 0, max: 5000, step: 0.1, get: () => ph.Vc, set: (v) => (ph.Vc = v), unit: lab.v });
          C.slider(sec, { label: 'Volume of water added to fill it', min: 0, max: 5000, step: 0.1, get: () => ph.Vwa, set: (v) => (ph.Vwa = v), unit: lab.v });
        }
      }
    });
    C.note(g, 'Tick any two or three independent quantities (more is fine). Water content, saturation, porosity and air content are in %. For a saturated soil tick S = 100 %.');
    const b = C.section(el, 'Borrow pit → compacted fill');
    C.toggle(b, { label: 'The soil above is dug from a borrow pit for a fill', get: () => ph.borrow, set: (v) => (ph.borrow = v) });
    if (ph.borrow) {
      const o = ph.bor;
      C.slider(b, { label: 'Volume of compacted fill V_fill', min: 0, max: 1e6, step: 1, get: () => o.Vf, set: (v) => (o.Vf = v), unit: U.vol });
      C.seg(b, { label: 'Fill specified by', options: [['gd', 'γ_d required'], ['rc', 'Relative compaction'], ['e', 'Void ratio']], get: () => o.fillBy, set: (v) => (o.fillBy = v) });
      if (o.fillBy === 'gd') C.slider(b, { label: 'Dry unit weight required in the fill', min: 1, max: 200, step: 0.01, get: () => o.gdf, set: (v) => (o.gdf = v), unit: U.gamma });
      if (o.fillBy === 'rc') { C.slider(b, { label: 'Relative compaction RC', min: 50, max: 110, step: 0.1, get: () => o.rc, set: (v) => (o.rc = v), unit: '%' }); C.slider(b, { label: 'Maximum dry unit weight (Proctor)', min: 1, max: 200, step: 0.01, get: () => o.gdmax, set: (v) => (o.gdmax = v), unit: U.gamma }); }
      if (o.fillBy === 'e') C.slider(b, { label: 'Void ratio of the compacted fill', min: 0.1, max: 3, step: 0.001, get: () => o.ef, set: (v) => (o.ef = v), unit: '' });
      C.slider(b, { label: 'Truck capacity (0 = skip)', min: 0, max: 100, step: 0.1, get: () => o.cap, set: (v) => (o.cap = v), unit: U.vol });
      C.slider(b, { label: 'Swell of the excavated soil when loaded (0 = haul the pit volume)', min: 0, max: 60, step: 0.1, get: () => o.swell, set: (v) => (o.swell = v), unit: '%' });
      C.slider(b, { label: 'Water content wanted in the fill (0 = skip)', min: 0, max: 60, step: 0.1, get: () => o.wf, set: (v) => (o.wf = v), unit: '%' });
    }
  }

  function phase2D(svg, res, U) {
    const g = res.geo, x = g.x, blk = g.blk;
    const D = root.UI.Draw2D(svg, { xmin: -1.6, xmax: 2.9, ymin: -0.15, ymax: 1.18 }, { pad: 24 });
    if (!blk) { D.text([0.65, 0.55], 'Tick enough known quantities to fix G_s, e and S for the three-phase block.', { anchor: 'middle', size: 13, color: '#5d6b7a' }); return; }
    const Vt = 1, x0 = 0, x1 = 1.3;
    const ys = blk.Vs, yw = ys + blk.Vw;
    D.poly([[x0, 0], [x1, 0], [x1, ys], [x0, ys]], { fill: '#b9875a', fop: 0.75, stroke: '#5b4a35', sw: 1.2 });
    if (blk.Vw > 1e-6) D.poly([[x0, ys], [x1, ys], [x1, yw], [x0, yw]], { fill: '#4aa3df', fop: 0.55, stroke: '#1f6fa8', sw: 1.2 });
    if (blk.Va > 1e-6) D.poly([[x0, yw], [x1, yw], [x1, Vt], [x0, Vt]], { fill: '#ecf0f1', fop: 0.9, stroke: '#7f8c8d', sw: 1.2 });
    D.text([x1 / 2, ys / 2], 'Solids', { anchor: 'middle', size: 14, weight: 700, color: '#3d2b1a' });
    if (blk.Vw > 0.04) D.text([x1 / 2, (ys + yw) / 2], 'Water', { anchor: 'middle', size: 14, weight: 700, color: '#0f4c75' });
    if (blk.Va > 0.04) D.text([x1 / 2, (yw + 1) / 2], 'Air', { anchor: 'middle', size: 14, weight: 700, color: '#5d6b7a' });
    // volumes on the left, weights on the right
    D.dim([x0, 0], [x0, ys], `V_s = ${f(blk.Vs)}`, 16, { anchor: 'end', ldx: -6 });
    if (blk.Vv > 1e-6) D.dim([x0, ys], [x0, 1], `V_v = ${f(blk.Vv)}`, 16, { anchor: 'end', ldx: -6 });
    D.dim([x0, 0], [x0, 1], 'V = 1', 96, { anchor: 'end', ldx: -6 });
    D.dim([x1, 0], [x1, ys], `W_s = ${f(blk.Ws)}`, -16, { anchor: 'start', ldx: 6 });
    if (blk.Vw > 1e-6) D.dim([x1, ys], [x1, yw], `W_w = ${f(blk.Ww)}`, -16, { anchor: 'start', ldx: 6 });
    D.text([x1 + 0.12, 1.1], `weights per unit volume (${U.gamma})`, { size: 10.5, color: '#5d6b7a' });
    const lines = [`G_s = ${f(x.Gs)}`, `e = ${f(x.e)},  n = ${f(x.n * 100)} %`, `w = ${f(x.w * 100)} %,  S = ${f(x.S * 100)} %`, `γ = ${f(x.gm)},  γ_d = ${f(x.gd)}`, `γ_sat = ${f(x.gsat)} ${U.gamma}`];
    lines.forEach((t, i) => D.text([x1 + 0.85, 0.62 - i * 0.12], t, { size: 12, color: '#1d2733' }));
    if (g.bor) D.text([x1 + 0.85, 0.0], `pit ${f(g.bor.Vpit)} ${U.vol} → fill ${f(g.bor.Vf)} ${U.vol}`, { size: 12, weight: 700, color: '#c0611a' });
  }
  function phase3D(V, res, U) {
    const blk = res.geo.blk;
    if (!blk) { V.autoBounds(); return; }
    const ys = blk.Vs, yw = ys + blk.Vw;
    V.box(0, 0, 0, 1, ys, 1, '#b9875a', 0.95, '#5b4a35');
    if (blk.Vw > 1e-6) V.box(0, ys, 0, 1, yw, 1, '#4aa3df', 0.55, '#1f6fa8');
    if (blk.Va > 1e-6) V.box(0, yw, 0, 1, 1, 1, '#ecf0f1', 0.25, '#7f8c8d');
    V.label([1, ys / 2, 1], `solids V_s = ${f(blk.Vs)}`, '#5b4a35');
    if (blk.Vw > 1e-6) V.label([1, (ys + yw) / 2, 1], `water V_w = ${f(blk.Vw)}`, '#1f6fa8');
    if (blk.Va > 1e-6) V.label([1, (yw + 1) / 2, 1], `air V_a = ${f(blk.Va)}`, '#7f8c8d');
    V.autoBounds();
  }
  const PH0 = { known: {}, val: { Gs: 2.65, e: 0.6, n: 37.5, w: 15, S: 60, gm: 18, gd: 16, gsat: 20, gsub: 10, gs: 26, ac: 10, icr: 1, M: 150, Ms: 130, V: 80, emax: 0.9, emin: 0.4, Dr: 50 }, dens: false, lab: 'gcm', jar: false, Vc: 500, Vwa: 420, borrow: false, bor: { Vf: 10000, fillBy: 'gd', gdf: 18, rc: 95, gdmax: 19, ef: 0.5, cap: 10, swell: 0, wf: 0 } };
  /** Preset helper for the phase-relation problems: tick the given quantities and set their values. */
  function phSet(s, val, extra) {
    const ph = JSON.parse(JSON.stringify(PH0));
    Object.keys(val).forEach((k) => { ph.known[k] = true; ph.val[k] = val[k]; });
    s.prob = 'phase'; s.ph = Object.assign(ph, extra || {});
  }
  const GES = {
    id: 'es', title: 'Effective Stress',
    state: { zP: 6, prob: 'prof', ph: { known: { Gs: true, e: true, S: true }, val: { Gs: 2.65, e: 0.6, n: 37.5, w: 15, S: 60, gm: 18, gd: 16, gsat: 20, gsub: 10, gs: 26, ac: 10, icr: 1, M: 150, Ms: 130, V: 80, emax: 0.9, emin: 0.4, Dr: 50 }, dens: false, lab: 'gcm', jar: false, Vc: 500, Vwa: 420, borrow: false, bor: { Vf: 10000, fillBy: 'gd', gdf: 18, rc: 95, gdmax: 19, ef: 0.5, cap: 10, swell: 0, wf: 0 } } },
    presets: [
      { name: 'CE Ref 6 Apr 2025 #16 — G_s 2.7, e 0.5, γ 21.9 kN/m³ → w = 24 % (the book data give S above 100 %)', apply: (s) => phSet(s, { Gs: 2.7, e: 0.5, gm: 21.9 }) },
      { name: 'CE Ref 6 Apr 2025 #17 — G_s 2.67, e 0.59, w 11.2 % → air content (air void ratio) 18.3 %', apply: (s) => phSet(s, { Gs: 2.67, e: 0.59, w: 11.2 }) },
      { name: 'CE Ref 4 Nov 2016 #32 — γ 21.1, w 9.8 %, γ_sat 22.52 kN/m³ → e = 0.508', apply: (s) => phSet(s, { gm: 21.1, w: 9.8, gsat: 22.52 }) },
      { name: 'CE Ref 5 May 2022 #36–38 — ρ 1800 kg/m³, w 12 %, ρ_s 2300 kg/m³ → e 0.431, γ_d 15.77, S 64.04 %', apply: (s) => phSet(s, { gm: 1800, w: 12, gs: 2300 }, { dens: true }) },
      { name: 'CE Ref 4 Nov 2017 #24–26 — field 1800 kg/m³, saturated 2000 kg/m³, w 12 % → n 39.3 %, e 0.647', apply: (s) => phSet(s, { gm: 1800, gsat: 2000, w: 12 }, { dens: true }) },
      { name: 'CE Ref 6 Nov 2024 Sit. 4 — borrow pit G_s 2.7, w 15 %, e 0.69; fill 45,000 m³ at γ_d 18 → 51,680 m³ of pit soil, 5169 trucks of 10 m³', apply: (s) => phSet(s, { Gs: 2.7, w: 15, e: 0.69 }, { borrow: true, bor: { Vf: 45000, fillBy: 'gd', gdf: 18, rc: 95, gdmax: 19, ef: 0.5, cap: 10, swell: 0, wf: 0 } }) },
      { name: 'Test E1 — sand 4 m (γ 17 / γ_sat 19) over clay 5 m (γ_sat 18.5), GWT at 2 m → σ′ = 52.38 kPa at 4 m, 95.83 kPa at 9 m', apply: (s) => { s.prob = 'prof'; GP.set({ by: 'gamma', layers: two, wt: 2 }); s.zP = 9; } },
      { name: 'Test E2 — unit weights from G_s and e: dry sand 3 m (e 0.5), saturated sand 3 m, clay 4 m (e 1.1)', apply: (s) => { s.prob = 'prof'; GP.set({ by: 'phase', wt: 3, layers: [{ soil: 'sand', H: 3, Gs: 2.65, e: 0.5, S: 0 }, { soil: 'sand', H: 3, Gs: 2.65, e: 0.5, S: 0 }, { soil: 'clay', H: 4, Gs: 2.72, e: 1.1, S: 100 }] }); s.zP = 10; } },
      { name: 'Capillary rise 1.5 m in silt, negative pore pressure (S = 100 %)', apply: (s) => { s.prob = 'prof'; GP.set({ by: 'gamma', wt: 3.5, cap: 1.5, capS: 100, capNeg: true, layers: [{ soil: 'silt', H: 5, g: 16.5, gsat: 19.2 }, { soil: 'clay', H: 4, g: 17.8, gsat: 18.6 }] }); s.zP = 3; } },
      { name: 'Artesian (upward) seepage in clay: piezometer 2.5 m above the GWT', apply: (s) => { s.prob = 'prof'; GP.set({ by: 'gamma', wt: 1.5, seep: 'up', seepLayer: 1, dh: 2.5, layers: [{ soil: 'sand', H: 3, g: 16.8, gsat: 19.6 }, { soil: 'clay', H: 4, g: 17.5, gsat: 18.2 }, { soil: 'gravel', H: 2, g: 19, gsat: 21 }] }); s.zP = 7; } },
      { name: 'Upward seepage strong enough to cause a quick condition', apply: (s) => { s.prob = 'prof'; GP.set({ by: 'gamma', wt: 0, seep: 'up', seepLayer: 0, dh: 4.5, layers: [{ soil: 'sand', H: 4, g: 18, gsat: 19.5 }, { soil: 'gravel', H: 3, g: 19, gsat: 21 }] }); s.zP = 4; } },
      { name: 'Downward seepage (drainage) through a 3 m clay layer, Δh = 1.2 m', apply: (s) => { s.prob = 'prof'; GP.set({ by: 'gamma', wt: 2, seep: 'down', seepLayer: 1, dh: 1.2, layers: [{ soil: 'sand', H: 4, g: 17, gsat: 19 }, { soil: 'clay', H: 3, g: 17.5, gsat: 18.5 }, { soil: 'sand', H: 3, g: 18, gsat: 20 }] }); s.zP = 7; } },
      { name: 'Lake bed: 5 m of water above the ground (σ′ is not changed by the water depth)', apply: (s) => { s.prob = 'prof'; GP.set({ by: 'gamma', wt: -5, layers: [{ soil: 'silt', H: 3, g: 17, gsat: 18.5 }, { soil: 'clay', H: 6, g: 17, gsat: 17.8 }] }); s.zP = 9; } },
      { name: 'Five layers with a 60 kPa surcharge', apply: (s) => { s.prob = 'prof'; GP.set({ by: 'gamma', wt: 2.5, q: 60, layers: [{ soil: 'fill', H: 1.5, g: 18, gsat: 19.5 }, { soil: 'sand', H: 2.5, g: 17, gsat: 19.5 }, { soil: 'clay', H: 4, g: 17, gsat: 18 }, { soil: 'peat', H: 1.5, g: 11, gsat: 12.5 }, { soil: 'gravel', H: 3, g: 19.5, gsat: 21.5 }] }); s.zP = 8; } },
      { name: 'English units: sand 10 ft (110 / 125 pcf), clay 15 ft (118 pcf), GWT at 6 ft', units: 'EN', apply: (s) => { s.prob = 'prof'; GP.set({ by: 'gamma', wt: 6, layers: [{ soil: 'sand', H: 10, g: 110, gsat: 125 }, { soil: 'clay', H: 15, g: 112, gsat: 118 }] }); s.zP = 25; } },
    ],
    legend: [[CS, 'total stress σ', 'ln'], [CU, 'pore pressure u', 'ln'], [CE, 'effective stress σ′', 'ln'], ['#4aa3df', 'below the water table', 'sq']],
    toggle: 'Stress diagrams',
    plotCaption: 'Stresses versus depth',

    controls(el, C) {
      const s = this.state, U = root.App.U();
      C.seg(el, { label: 'Problem', options: [['prof', 'Stresses in a soil profile'], ['phase', 'Soil phase relations']], get: () => s.prob, set: (v) => (s.prob = v) });
      if (s.prob === 'phase') return phaseControls(el, C, s.ph, U);
      GP.controls(el, C, U);
      const p = C.section(el, 'Point of interest');
      const Ht = GP.state.layers.reduce((a, l) => a + (l.H > 0 ? l.H : 0), 0);
      C.slider(p, { label: 'Depth of point P below the ground', min: 0, max: Math.max(1, +Ht.toFixed(2)), step: 0.01, get: () => s.zP, set: (v) => (s.zP = v), unit: U.len });
    },
    onUnits(from, to) {
      this.state.zP = +(this.state.zP * (to === 'EN' ? 1 / 0.3048 : 0.3048)).toPrecision(5);
      const ph = this.state.ph, kG = to === 'EN' ? 6.365880 : 1 / 6.365880, kV = to === 'EN' ? 35.3147 : 1 / 35.3147, r = (x) => +(+x).toPrecision(5);
      ['gm', 'gd', 'gsat', 'gsub', 'gs'].forEach((k) => { ph.val[k] = r(ph.val[k] * kG); });
      ph.bor.gdf = r(ph.bor.gdf * kG); ph.bor.gdmax = r(ph.bor.gdmax * kG); ph.bor.Vf = r(ph.bor.Vf * kV); ph.bor.cap = r(ph.bor.cap * kV);
      ph.lab = to === 'EN' ? 'lbft' : 'gcm'; ph.dens = false;
    },
    compute(U) { return this.state.prob === 'phase' ? Physics.phaseRel(this.state.ph, U) : Physics.effStress(Object.assign({}, GP.state, { zP: this.state.zP }), U); },

    draw2D(svg, res, U, opts) {
      if (res.geo.kind === 'phase') return phase2D(svg, res, U);
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
      if (res.geo.kind === 'phase') return phase3D(V, res, U);
      const pr = res.geo.pr, Ht = pr.Ht, W = 0.6 * Ht, Lz = 0.6 * Ht;
      GP.column3D(V, pr, { x0: 0, x1: W, z0: 0, z1: Lz });
      if (opts.showP !== false) {
        const sMax = Math.max(...pr.pts.map((p) => Math.max(Math.abs(p.s), Math.abs(p.u))), 1e-9), k = (0.45 * Ht) / sMax;
        [['s', CS, 'σ'], ['u', CU, 'u'], ['e', CE, 'σ′']].forEach(([key, col, nm], j) => {
          const x0 = W + 0.15 * Ht + j * 0.6 * Ht, zz = 0; // back plane: the diagrams sit beside the column instead of over its right face
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
      if (res.geo.kind === 'phase') return false;
      const pr = res.geo.pr, { W, H } = G.chartSurface(svg);
      const ser = (key) => pr.pts.map((p) => [p[key], p.z]);
      const xmin = Math.min(0, ...pr.pts.map((p) => Math.min(p.u, p.e)));
      G.chart(svg, { x: 0, y: 0, w: W, h: H }, { title: 'Total stress, pore pressure and effective stress versus depth', xlab: `stress (${U.press})`, ylab: `depth z (${U.len})`, ydown: true, ymin: 0, ymax: pr.Ht, xmin,
        series: [{ pts: ser('s'), color: CS, label: 'σ total' }, { pts: ser('u'), color: CU, label: 'u pore water' }, { pts: ser('e'), color: CE, w: 2.6, label: 'σ′ effective' }],
        hlines: [{ y: res.geo.zP, label: 'P', color: '#16a085' }].concat(pr.zw > 0 && pr.zw < pr.Ht ? [{ y: pr.zw, label: 'GWT', color: '#1f6fa8' }] : []),
        marks: [{ x: res.geo.P.e, y: res.geo.zP, label: `σ′ = ${f(res.geo.P.e)}`, color: CE }] });
      return true;
    },
  };

  root.GES = GES;
})(window);
