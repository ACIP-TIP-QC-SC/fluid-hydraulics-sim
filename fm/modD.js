/* =====================================================================
 * MODULE — Analysis of gravity dams (per unit length)
 * Composite profile split into rectangles & triangles, water, tailwater,
 * silt, uplift, moments about the toe, FS, eccentricity, foundation pressure.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Physics } = root;
  const { COL } = root.UI;
  const f = Physics.fmt;
  const CONC = '#c9c6bb', CONCD = '#6e6a5e', WAT = '#4aa3df';

  const TEMPLATES = {
    rect: { a: 3, H: 8, bu: 0, hu: 0, bd: 0, hs: 0 },
    tri: { a: 0, H: 10, bu: 0, hu: 0, bd: 7, hs: 10 },
    trap: { a: 2, H: 10, bu: 0, hu: 0, bd: 6, hs: 10 },
    batter: { a: 2, H: 12, bu: 1.5, hu: 6, bd: 7, hs: 10 },
  };

  const MD = {
    id: 'md', title: 'Analysis of Dams',
    state: {
      shape: 'param', a: 2, H: 10, bu: 0, hu: 0, bd: 6, hs: 10,
      pts: [[0, 0], [0, 12], [2, 12], [2, 10], [4, 7], [9, 0]],
      h1: 9, tail: false, h2: 1.5,
      gcBy: 'gc', gc: 24, gcEN: 150, sgc: 2.4,
      uplift: true, upf: 100, silt: false, hsilt: 2, gsub: 10, gsubEN: 65, phis: 30, ice: false, Pice: 150, PiceEN: 10000,
      mu: 0.6, fsoReq: 1.5, fssReq: 1.5, qa: 0, qaEN: 0,
      showSplit: true,
    },
    presets: [
      { name: 'Test D1 — trapezoidal dam: crest 2 m, base 8 m, H = 10 m, water 9 m, full uplift, μ = 0.75', apply: (s) => Object.assign(s, { shape: 'param', ...TEMPLATES.trap, h1: 9, tail: false, uplift: true, upf: 100, silt: false, ice: false, gcBy: 'gc', gc: 24, mu: 0.75 }) },
      { name: 'Rectangular dam 3 × 8 m, water to the crest (barely stands)', apply: (s) => Object.assign(s, { shape: 'param', ...TEMPLATES.rect, h1: 8, tail: false, uplift: false, silt: false, ice: false, gcBy: 'gc', gc: 24, mu: 0.6 }) },
      { name: 'Triangular dam 7 × 10 m, Sg_c = 2.4, full uplift (slides)', apply: (s) => Object.assign(s, { shape: 'param', ...TEMPLATES.tri, h1: 10, tail: false, uplift: true, upf: 100, silt: false, ice: false, gcBy: 'sg', sgc: 2.4, mu: 0.65 }) },
      { name: 'Upstream batter + tailwater 1.5 m, 2/3 uplift', apply: (s) => Object.assign(s, { shape: 'param', ...TEMPLATES.batter, h1: 11, tail: true, h2: 1.5, uplift: true, upf: 66.67, silt: false, ice: false, gcBy: 'gc', gc: 24, mu: 0.75 }) },
      { name: 'Silt 3 m against the upstream face', apply: (s) => Object.assign(s, { shape: 'param', ...TEMPLATES.trap, h1: 9.5, tail: false, uplift: true, upf: 50, silt: true, ice: false, hsilt: 3, gsub: 10, phis: 30, gcBy: 'gc', gc: 24, mu: 0.6 }) },
      { name: 'Irregular (stepped) dam — custom profile', apply: (s) => Object.assign(s, { shape: 'custom', pts: [[0, 0], [0, 12], [2, 12], [2, 10], [4, 7], [9, 0]], h1: 11, tail: true, h2: 1, uplift: true, upf: 100, silt: false, ice: false, gcBy: 'gc', gc: 24, mu: 0.65 }) },
      { name: 'Slender dam that fails (resultant outside middle third)', apply: (s) => Object.assign(s, { shape: 'param', a: 1.5, H: 10, bu: 0, hu: 0, bd: 3.5, hs: 9, h1: 10, tail: false, uplift: true, upf: 100, silt: false, ice: false, gcBy: 'gc', gc: 24, mu: 0.6 }) },
      { name: 'Schaum 3.19 — 100 ft dam, 20 ft crest, 75 ft base, full uplift, ice 12 480 lb/ft, masonry 2.50γ (resultant at the third point, x̄ = 25 ft)', units: 'EN', apply: (s) => Object.assign(s, { shape: 'param', a: 20, H: 100, bu: 0, hu: 0, bd: 55.05, hs: 100, h1: 100, tail: false, uplift: true, upf: 100, silt: false, ice: true, PiceEN: 12480, gcBy: 'sg', sgc: 2.5, mu: 0.6 }) },
    ],

    controls(el, C) {
      const s = this.state, U = root.App.U();
      const sl = (p, label, k, min, max, step, unit) => C.slider(p, { label, min, max, step, get: () => s[k], set: (v) => (s[k] = v), unit });
      const en = U.id === 'EN';
      C.seg(el, { label: 'Dam profile', options: [['param', 'Composite template'], ['custom', 'Custom / irregular points']], get: () => s.shape, set: (v) => (s.shape = v) });
      const g = C.section(el, 'Shape');
      if (s.shape === 'param') {
        const bar = root.UI.h('div', { class: 'presets' });
        [['rect', 'Rectangle'], ['tri', 'Triangle'], ['trap', 'Trapezoid'], ['batter', 'Upstream batter']].forEach(([k, n]) => bar.append(root.UI.h('button', { type: 'button', onclick: () => { Object.assign(s, TEMPLATES[k]); s.h1 = Math.min(s.h1, s.H); root.App.rebuild(true); } }, n)));
        g.append(root.UI.h('div', { class: 'ctl-row' }, root.UI.h('label', { class: 'ctl-label' }, 'Quick shapes'), bar));
        sl(g, 'Height H', 'H', 0.5, 200, 0.01, U.len);
        sl(g, 'Crest (top) width a', 'a', 0, 50, 0.01, U.len);
        sl(g, 'Upstream batter — horizontal projection b_u', 'bu', 0, 100, 0.01, U.len);
        if (s.bu > 0) sl(g, 'Upstream batter — height h_u (from base)', 'hu', 0.01, 200, 0.01, U.len);
        sl(g, 'Downstream slope — horizontal projection b_d', 'bd', 0, 200, 0.01, U.len);
        if (s.bd > 0) sl(g, 'Downstream slope starts at height h_s', 'hs', 0.01, 200, 0.01, U.len);
        C.note(g, `Base B = b_u + a + b_d = ${f(s.bu + s.a + s.bd)} ${U.len}. The profile is split automatically into rectangles and triangles (dashed lines in the diagram).`);
      } else {
        C.note(g, 'Enter the outline of the dam top from the HEEL (x = 0) to the TOE, left to right. The base is the line y = 0. Repeat an x value to make a vertical face. Each strip between points becomes a rectangle + triangle.');
        const tbl = root.UI.h('div', { class: 'ptbl' });
        const head = root.UI.h('div', { class: 'ptrow ph' }, root.UI.h('span', null, '#'), root.UI.h('span', null, `x (${U.len})`), root.UI.h('span', null, `y (${U.len})`), root.UI.h('span', null, ''));
        tbl.append(head);
        s.pts.forEach((q, i) => {
          const mk = (j) => root.UI.h('input', { type: 'number', step: 0.01, value: q[j], class: 'num', oninput: (e) => { const v = parseFloat(e.target.value); if (isFinite(v)) { s.pts[i][j] = v; root.App.update(); } } });
          const del = root.UI.h('button', { type: 'button', class: 'btn small', title: 'Remove point', onclick: () => { if (s.pts.length > 2) { s.pts.splice(i, 1); root.App.rebuild(true); } } }, '×');
          tbl.append(root.UI.h('div', { class: 'ptrow' }, root.UI.h('span', null, String(i + 1)), mk(0), mk(1), del));
        });
        g.append(tbl);
        g.append(root.UI.h('button', { type: 'button', class: 'btn small', style: { marginTop: '6px' }, onclick: () => { const l = s.pts[s.pts.length - 1]; s.pts.push([+(l[0] + 1).toFixed(3), 0]); root.App.rebuild(true); } }, '+ Add point at the toe'));
        g.append(root.UI.h('button', { type: 'button', class: 'btn small', style: { marginTop: '6px', marginLeft: '6px' }, onclick: () => { s.pts = Physics.damProfile(Object.assign({}, s, { shape: 'param' })).map((q) => [+q[0].toFixed(3), +q[1].toFixed(3)]); root.App.rebuild(true); } }, 'Copy from template'));
      }
      const m = C.section(el, 'Concrete');
      C.seg(m, { label: 'Unit weight given as', options: [['gc', 'γ_c directly'], ['sg', 'Sg of concrete']], get: () => s.gcBy, set: (v) => (s.gcBy = v) });
      if (s.gcBy === 'gc') C.slider(m, { label: 'Unit weight of concrete γ_c', min: en ? 60 : 10, max: en ? 250 : 40, step: 0.01, get: () => (en ? s.gcEN : s.gc), set: (v) => (en ? (s.gcEN = v) : (s.gc = v)), unit: U.gamma });
      else sl(m, 'Specific gravity of concrete Sg_c', 'sgc', 1, 4, 0.01, '');
      C.note(m, en ? 'Default 150 lb/ft³ (normal-weight concrete).' : 'Default γ_c = 24 kN/m³. Using Sg = 2.4 instead gives 2.4 × 9.81 = 23.54 kN/m³.');
      const w = C.section(el, 'Water');
      sl(w, 'Upstream water depth h', 'h1', 0, 200, 0.01, U.len);
      C.toggle(w, { label: 'Tailwater on the downstream side', get: () => s.tail, set: (v) => (s.tail = v) });
      if (s.tail) sl(w, 'Tailwater depth h₂', 'h2', 0, 100, 0.01, U.len);
      C.toggle(w, { label: 'Uplift under the base', get: () => s.uplift, set: (v) => (s.uplift = v) });
      if (s.uplift) sl(w, 'Uplift intensity (% of full hydrostatic)', 'upf', 0, 100, 0.01, '%');
      C.toggle(w, { label: 'Silt deposit against the upstream face', get: () => s.silt, set: (v) => (s.silt = v) });
      if (s.silt) {
        sl(w, 'Silt depth h_s', 'hsilt', 0, 100, 0.01, U.len);
        C.slider(w, { label: 'Submerged unit weight of silt γ′', min: 1, max: en ? 120 : 20, step: 0.01, get: () => (en ? s.gsubEN : s.gsub), set: (v) => (en ? (s.gsubEN = v) : (s.gsub = v)), unit: U.gamma });
        sl(w, 'Angle of internal friction φ', 'phis', 0, 45, 0.1, '°');
      }
      C.toggle(w, { label: 'Ice thrust at the water surface', get: () => s.ice, set: (v) => (s.ice = v) });
      if (s.ice) C.slider(w, { label: 'Ice thrust per unit length P_i', min: 0, max: en ? 100000 : 2000, step: 0.01, get: () => (en ? s.PiceEN : s.Pice), set: (v) => (en ? (s.PiceEN = v) : (s.Pice = v)), unit: U.fpl });
      const c = C.section(el, 'Stability criteria');
      sl(c, 'Coefficient of friction μ (base)', 'mu', 0.1, 1.5, 0.01, '');
      sl(c, 'Required FS overturning', 'fsoReq', 1, 3, 0.01, '');
      sl(c, 'Required FS sliding', 'fssReq', 1, 3, 0.01, '');
      C.slider(c, { label: 'Allowable bearing pressure (0 = skip)', min: 0, max: en ? 40000 : 2000, step: 0.1, get: () => (en ? s.qaEN : s.qa), set: (v) => (en ? (s.qaEN = v) : (s.qa = v)), unit: U.press });
      const d = C.section(el, 'Diagram');
      C.toggle(d, { label: 'Show dashed split lines and component weights', get: () => s.showSplit, set: (v) => (s.showSplit = v), rebuild: false });
    },

    compute(U) {
      const s = this.state, en = U.id === 'EN';
      return Physics.dam(Object.assign({}, s, { gc: en ? s.gcEN : s.gc, gsub: en ? s.gsubEN : s.gsub, qa: en ? s.qaEN : s.qa, Pice: en ? s.PiceEN : s.Pice }), U);
    },

    draw2D(svg, res, U, opts) {
      if (!res.ok) { root.M1.emptyMsg(svg, res); return; }
      const s = this.state, g = res.geo, Lu = U.len, Fu = U.force, Pu = U.press;
      const B = g.B, H = g.Hmax, h1 = g.h1, h2 = g.h2;
      const xl = -Math.max(0.45 * H, 0.4 * B), xr = B + Math.max(0.35 * H, 0.3 * B);
      const qMax = Math.max(isFinite(g.qT) ? g.qT : 0, isFinite(g.qH) ? g.qH : 0, 1e-9);
      const uMax = g.upl && g.upl.u1 !== undefined ? Math.max(g.upl.u1, g.upl.u2, 1e-9) : 0;
      const pScale = (0.22 * H) / Math.max(qMax, uMax, 1e-9);
      const yUp = g.Uf > 0 ? -0.05 * H - uMax * pScale : -0.05 * H;
      const yQ = yUp - 0.12 * H;
      const ymin = yQ - qMax * pScale - 0.16 * H;
      const D = root.UI.Draw2D(svg, { xmin: xl, xmax: xr, ymin, ymax: H * 1.12 }, { pad: 40 });
      // ground & foundation
      D.poly([[xl, 0], [xr, 0], [xr, -0.04 * H], [xl, -0.04 * H]], { fill: 'url(#hatch)', stroke: '#2c3e50' });
      // water
      if (h1 > 0) { D.poly([[xl, 0], [0, 0], [0, h1], [xl, h1]], { fill: 'url(#waterGrad)', op: 0.8 }); g.waterUp.forEach((c) => D.poly(c.pts, { fill: 'url(#waterGrad)', op: 0.8 })); D.fs([xl * 0.6, h1], { label: `h = ${f(h1)} ${Lu}` }); }
      if (h2 > 0) { D.poly([[B, 0], [xr, 0], [xr, h2], [B, h2]], { fill: 'url(#waterGrad)', op: 0.8 }); g.waterDn.forEach((c) => D.poly(c.pts, { fill: 'url(#waterGrad)', op: 0.8 })); D.fs([B + 0.6 * (xr - B), h2], { label: `h₂ = ${f(h2)}` }); }
      if (g.hsilt > 0) D.poly([[xl, 0], [0, 0], [0, g.hsilt], [xl, g.hsilt]], { fill: '#a1887f', op: 0.55 });
      // dam
      D.poly(g.prof, { fill: CONC, stroke: CONCD, sw: 2.2 });
      const showSplit = s.showSplit;
      const Fmax = Math.max(...g.comps.map((c) => c.W), g.P1, 1e-9);
      if (showSplit) {
        g.comps.forEach((c) => { D.poly(c.pts, { stroke: '#34495e', sw: 1.1, dash: '6 4' }); });
        g.waterUp.concat(g.waterDn).forEach((c) => D.poly(c.pts, { stroke: '#1f6fa8', sw: 1, dash: '4 4' }));
      }
      g.comps.forEach((c) => {
        D.force([c.x, c.y - 0.0001], [0, -1], 24 + 40 * (c.W / Fmax), { color: COL.weight, w: 2.2, head: 9 });
        D.dot([c.x, c.y], COL.cg, showSplit ? `${c.name} = ${f(c.W)} ${Fu}` : '', { r: 3.5, dx: 6, dy: -8 });
      });
      g.waterUp.concat(g.waterDn).forEach((c) => { D.force([c.x, c.y - 0.0001], [0, -1], 20 + 30 * (c.F / Fmax), { color: '#1f6fa8', w: 2, head: 8 }); if (showSplit) D.text([c.x, c.y], `${c.name} = ${f(c.F)}`, { dx: 6, dy: -6, size: 10.5, color: '#1f6fa8' }); });
      // hydrostatic triangle and thrust
      if (h1 > 0) {
        const k = (0.3 * B + 0.15 * H) / (U.gw * h1);
        D.poly([[0, h1], [0, 0], [-U.gw * h1 * k, 0]], { fill: '#e74c3c', fop: 0.18, stroke: '#c0392b', sw: 1 });
        D.text([-U.gw * h1 * k, 0], `γh = ${f(U.gw * h1)} ${Pu}`, { dy: -6, anchor: 'start', size: 10.5, color: '#c0392b' });
        D.force([0, h1 / 3], [1, 0], 70, { color: COL.force, label: `P = ${f(g.P1)} ${Fu}`, lp: 'tail', ldx: -4, ldy: -8, anchor: 'end' });
      }
      if (g.Pi > 0) D.force([0, g.yi], [1, 0], 50, { color: '#5dade2', label: `P_i = ${f(g.Pi)}`, lp: 'tail', ldx: -4, ldy: -8, anchor: 'end' });
      if (g.Ps > 0) D.force([0, g.hsilt / 3], [1, 0], 50, { color: '#6d4c41', label: `P_s = ${f(g.Ps)}`, lp: 'tail', ldx: -4, ldy: 16, anchor: 'end' });
      if (g.P2 > 0) D.force([B, h2 / 3], [-1, 0], 55, { color: COL.force, label: `P₂ = ${f(g.P2)}`, lp: 'tail', ldx: 6, ldy: -8 });
      // uplift diagram
      if (g.Uf > 0) {
        const u1 = g.upl.u1, u2 = g.upl.u2;
        const y0 = -0.05 * H;
        D.poly([[0, y0], [B, y0], [B, y0 - u2 * pScale], [0, y0 - u1 * pScale]], { fill: '#2980b9', fop: 0.18, stroke: '#2980b9', sw: 1 });
        if (showSplit && g.upl.length > 1) D.line([0, y0 - Math.min(u1, u2) * pScale], [B, y0 - Math.min(u1, u2) * pScale], { stroke: '#2980b9', sw: 1, dash: '4 4' });
        for (let i = 0; i <= 6; i++) { const x = (B * i) / 6, uu = u1 + ((u2 - u1) * i) / 6; if (uu * pScale > 0.01 * H) D.arrow([x, y0 - uu * pScale], [x, y0], { color: '#2980b9', w: 1.2, head: 7 }); }
        D.text([0, y0 - u1 * pScale], `u = ${f(u1)}`, { dx: -6, anchor: 'end', dy: 4, size: 10.5, color: '#2980b9' });
        D.text([B / 2, y0 - Math.max(u1, u2) * pScale], `uplift U = ${f(g.Uf)} ${Fu}`, { anchor: 'middle', dy: 16, color: '#2980b9', size: 11.5 });
        if (showSplit) g.upl.forEach((q) => { const um = Math.min(u1, u2); const yy = q.kind === 'rect' ? y0 - um * pScale / 2 : y0 - um * pScale - Math.abs(u1 - u2) * pScale / 3; D.text([q.x, yy], `${q.name || 'U'} = ${f(q.F)}`, { anchor: 'middle', base: 'middle', size: 10, color: '#1b4f72' }); });
      }
      // foundation pressure
      if (isFinite(g.qT)) {
        let poly;
        if (g.mode === 'trap') poly = [[0, yQ], [B, yQ], [B, yQ - g.qT * pScale], [0, yQ - g.qH * pScale]];
        else if (g.mode === 'triT') poly = [[B - 3 * g.xb, yQ], [B, yQ], [B, yQ - g.qT * pScale]];
        else poly = [[0, yQ], [3 * (B - g.xb), yQ], [0, yQ - g.qH * pScale]];
        D.poly(poly, { fill: '#8e44ad', fop: 0.2, stroke: '#8e44ad', sw: 1.2 });
        D.line([0, yQ], [B, yQ], { stroke: '#8e44ad', sw: 1 });
        D.text([B, yQ - g.qT * pScale], `q_toe = ${f(g.qT)} ${Pu}`, { dx: 6, dy: 4, color: '#8e44ad', size: 11 });
        D.text([0, yQ - g.qH * pScale], `q_heel = ${f(g.qH)}`, { dx: -6, dy: 4, anchor: 'end', color: '#8e44ad', size: 11 });
        D.text([B / 2, yQ - qMax * pScale], 'foundation (soil) pressure', { anchor: 'middle', dy: 16, size: 10.5, color: '#8e44ad' });
      }
      // resultant & middle third
      const xR = B - g.xb;
      D.line([B / 3, 0], [B / 3, -0.035 * H], { stroke: '#e67e22', sw: 2 }); D.line([(2 * B) / 3, 0], [(2 * B) / 3, -0.035 * H], { stroke: '#e67e22', sw: 2 });
      D.text([B / 2, -0.03 * H], 'middle third', { anchor: 'middle', size: 10, color: '#e67e22', dy: 2 });
      if (xR > xl && xR < xr) D.force([xR, 0], [0, 1], 60, { color: '#8e44ad', label: `R_y = ${f(g.Rv)} ${Fu}`, lp: 'tail', ldx: 6, ldy: 14 });
      // dims
      D.dim([0, ymin + 0.03 * H], [B, ymin + 0.03 * H], `B = ${f(B)} ${Lu}`, -2);
      D.dim([xr - 0.05 * (xr - B), 0], [xr - 0.05 * (xr - B), H], `H = ${f(H)} ${Lu}`, 10, { anchor: 'end', ldx: -6 });
      const crest = g.prof.filter((q) => Math.abs(q[1] - H) < 1e-9);
      if (crest.length >= 2) { const c0 = crest[0][0], c1 = crest[crest.length - 1][0]; if (c1 - c0 > 1e-9) D.dim([c0, H], [c1, H], `a = ${f(c1 - c0)}`, -14); }
      if (B - g.xb > 0) D.dim([xR, -0.012 * H], [B, -0.012 * H], `x̄ = ${f(g.xb)}`, 12, { color: '#8e44ad' });
      D.text([xl, H * 1.08], `per 1 ${Lu} length · γ_c = ${f(g.gc)} ${U.gamma}`, { size: 11, color: '#5d6b7a', dx: 4 });
      // righting / overturning moments about the toe
      const Mu = U.mom, toe = [D.X(B), D.Y(0)];
      const arcM = (r, a0, a1, col, headAtStart) => {
        const pts = [];
        for (let i = 0; i <= 24; i++) { const a = ((a0 + ((a1 - a0) * i) / 24) * Math.PI) / 180; pts.push([toe[0] + r * Math.cos(a), toe[1] - r * Math.sin(a)]); }
        D.el('polyline', { points: pts.map((q) => q.join(',')).join(' '), fill: 'none', stroke: col, 'stroke-width': 2.4 });
        const ae = ((headAtStart ? a0 : a1) * Math.PI) / 180, e = headAtStart ? pts[0] : pts[pts.length - 1];
        const ux = headAtStart ? Math.sin(ae) : -Math.sin(ae), uy = headAtStart ? Math.cos(ae) : -Math.cos(ae);
        D.head(e[0], e[1], ux, uy, col, 10);
      };
      arcM(34, 95, 175, '#1e8449', false);
      arcM(52, 95, 175, '#c0392b', true);
      D.text([toe[0] - 36, toe[1] - 40], 'RM', { px: true, color: '#1e8449', size: 11.5, anchor: 'end' });
      D.text([toe[0] - 50, toe[1] - 58], 'OM', { px: true, color: '#c0392b', size: 11.5, anchor: 'end' });
      D.dot([B, 0], '#2c3e50', '', { r: 4 });
      const bx = D.W - 250, by = 14;
      D.el('rect', { x: bx, y: by, width: 236, height: 92, rx: 8, fill: '#ffffff', 'fill-opacity': 0.92, stroke: '#c4ced9' });
      D.text([bx + 10, by + 18], 'Moments about the toe (O)', { px: true, size: 11.5, color: '#34495e' });
      D.text([bx + 10, by + 38], `RM = ${f(g.RM)} ${Mu}  (resisting, ↺)`, { px: true, size: 12, color: '#1e8449' });
      D.text([bx + 10, by + 56], `OM = ${f(g.OM)} ${Mu}  (overturning, ↻)`, { px: true, size: 12, color: '#c0392b' });
      D.text([bx + 10, by + 76], `FS_OT = RM / OM = ${f(g.OM > 0 ? g.RM / g.OM : Infinity)}`, { px: true, size: 12, color: '#1d2733' });
    },

    draw3D(V, res, U) {
      if (!res.ok) return;
      const s = this.state, g = res.geo, Lu = U.len, Fu = U.force;
      const B = g.B, H = g.Hmax, Lz = Math.max(0.6 * B, 0.35 * H);
      const xl = -Math.max(0.4 * H, 0.3 * B), xr = B + Math.max(0.3 * H, 0.25 * B);
      V.box(xl, -0.06 * H, 0, xr, 0, Lz, '#bfa98a', 1, '#7f6a4f');
      V.extrude(g.prof, 0, Lz, CONC, 0.96, CONCD);
      if (g.h1 > 0) {
        V.box(xl, 0, 0, 0, g.h1, Lz, WAT, 0.22, '#1f6fa8', { noTop: false });
        g.waterUp.forEach((c) => V.extrude(c.pts, 0, Lz, WAT, 0.22, null));
      }
      if (g.h2 > 0) { V.box(B, 0, 0, xr, g.h2, Lz, WAT, 0.22, '#1f6fa8'); g.waterDn.forEach((c) => V.extrude(c.pts, 0, Lz, WAT, 0.22, null)); }
      const zf = Lz; // front face
      if (s.showSplit) g.comps.forEach((c) => V.line(c.pts.concat([c.pts[0]]).map((q) => [q[0], q[1], zf + 1e-3]), '#2c3e50', 1.2, [6, 4]));
      const arrow = (a, b, col, label, lw) => {
        V.line([a, b], col, lw || 2.5);
        const d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(d[0], d[1]) || 1, ux = d[0] / L, uy = d[1] / L, hs = 0.04 * H;
        V.line([[b[0] - ux * hs - uy * hs * 0.5, b[1] - uy * hs + ux * hs * 0.5, b[2]], b, [b[0] - ux * hs + uy * hs * 0.5, b[1] - uy * hs - ux * hs * 0.5, b[2]]], col, lw || 2.5);
        if (label) V.label(a, label, col);
      };
      const zm = zf;
      const Fmax = Math.max(...g.comps.map((c) => c.W), 1e-9);
      g.comps.forEach((c) => arrow([c.x, c.y, zm], [c.x, c.y - (0.08 + 0.12 * c.W / Fmax) * H, zm], '#2c3e50', s.showSplit ? `${c.name} = ${f(c.W)} ${Fu}` : null, 2));
      g.waterUp.forEach((c) => arrow([c.x, c.y, zm], [c.x, c.y - 0.1 * H, zm], '#1f6fa8', `${c.name} = ${f(c.F)}`, 2));
      if (g.h1 > 0) {
        const k = (0.25 * B + 0.12 * H) / (U.gw * g.h1);
        V.face([[0, g.h1, zm], [0, 0, zm], [-U.gw * g.h1 * k, 0, zm]], '#e74c3c', 0.3, '#c0392b');
        arrow([-0.3 * H, g.h1 / 3, zm], [0, g.h1 / 3, zm], '#c0392b', `P = ${f(g.P1)} ${Fu}`, 3);
      }
      if (g.P2 > 0) arrow([B + 0.25 * H, g.h2 / 3, zm], [B, g.h2 / 3, zm], '#c0392b', `P₂ = ${f(g.P2)}`, 3);
      if (g.Pi > 0) arrow([-0.25 * H, g.yi, zm * 0.5], [0, g.yi, zm * 0.5], '#5dade2', `P_i = ${f(g.Pi)}`, 3);
      if (g.Ps > 0) arrow([-0.25 * H, g.hsilt / 3, zm * 0.5], [0, g.hsilt / 3, zm * 0.5], '#6d4c41', `P_s = ${f(g.Ps)}`, 3);
      const qMax = Math.max(isFinite(g.qT) ? g.qT : 0, isFinite(g.qH) ? g.qH : 0, g.upl && g.upl.u1 !== undefined ? Math.max(g.upl.u1, g.upl.u2) : 0, 1e-9);
      const ps = (0.18 * H) / qMax;
      if (g.Uf > 0) {
        const y0 = -0.06 * H;
        V.face([[0, y0, zm], [B, y0, zm], [B, y0 - g.upl.u2 * ps, zm], [0, y0 - g.upl.u1 * ps, zm]], '#2980b9', 0.3, '#2980b9');
        for (let i = 0; i <= 4; i++) { const x = (B * i) / 4, uu = g.upl.u1 + ((g.upl.u2 - g.upl.u1) * i) / 4; if (uu > 1e-9) arrow([x, y0 - uu * ps, zm], [x, 0, zm], '#2980b9', null, 1.4); }
        V.label([B / 2, y0 - Math.max(g.upl.u1, g.upl.u2) * ps, zm], `U = ${f(g.Uf)} ${Fu}`, '#2980b9');
      }
      if (isFinite(g.qT)) {
        const y0 = -0.06 * H - (g.Uf > 0 ? Math.max(g.upl.u1, g.upl.u2) * ps + 0.06 * H : 0);
        let poly;
        if (g.mode === 'trap') poly = [[0, y0], [B, y0], [B, y0 - g.qT * ps], [0, y0 - g.qH * ps]];
        else if (g.mode === 'triT') poly = [[B - 3 * g.xb, y0], [B, y0], [B, y0 - g.qT * ps]];
        else poly = [[0, y0], [3 * (B - g.xb), y0], [0, y0 - g.qH * ps]];
        V.face(poly.map((q) => [q[0], q[1], zm]), '#8e44ad', 0.3, '#8e44ad');
        V.label([B, y0 - g.qT * ps, zm], `q_toe = ${f(g.qT)} ${U.press}`, '#8e44ad');
        V.label([0, y0 - g.qH * ps, zm], `q_heel = ${f(g.qH)}`, '#8e44ad');
      }
      const xR = B - g.xb;
      if (xR > xl && xR < xr) arrow([xR, -0.02 * H, zm], [xR, 0.25 * H, zm], '#8e44ad', `R_y = ${f(g.Rv)} ${Fu}`, 3);
      V.dim([0, 0, zm], [B, 0, zm], `B = ${f(B)} ${Lu}`, [0, 0, 0.35 * Lz]);
      { const r = 0.12 * H, ptsR = [], ptsO = [];
        for (let i = 0; i <= 20; i++) { const a = ((95 + 80 * i / 20) * Math.PI) / 180; ptsR.push([B + r * Math.cos(a), r * Math.sin(a), zm]); ptsO.push([B + 1.6 * r * Math.cos(a), 1.6 * r * Math.sin(a), zm]); }
        V.line(ptsR, '#1e8449', 2.6); V.line(ptsO, '#c0392b', 2.6);
        V.label(ptsR[20], `RM = ${f(g.RM)} ${U.mom}`, '#1e8449');
        V.label(ptsO[0], `OM = ${f(g.OM)} ${U.mom}`, '#c0392b'); }
      V.dim([B, 0, 0], [B, H, 0], `H = ${f(H)} ${Lu}`, [0.15 * B + 0.1 * H, 0, 0]);
      if (g.h1 > 0) V.dim([xl, 0, zm], [xl, g.h1, zm], `h = ${f(g.h1)} ${Lu}`, [-0.15 * H, 0, 0]);
      V.dim([0, H, 0], [0, H, Lz], `strip ${f(Lz)} ${Lu} (results per 1 ${Lu})`, [-0.12 * B, 0.1 * H, 0]);
      V.autoBounds();
    },
  };

  root.MD = MD;
})(window);
