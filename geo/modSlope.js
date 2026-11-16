/* =====================================================================
 * STEP 7 — Slope Stability (UI, slip surfaces, slice table, charts, 3D)
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Physics } = root;
  const G = root.GeoUI;
  const f = Physics.fmt, DEG = Math.PI / 180;
  const SL = '#c0392b', WT = '#2c3e50', NN = '#2980b9', TT = '#8e44ad', UW = '#1f6fa8', MASS = '#e67e22', CEN = '#16a085';
  const LEN = 1 / 0.3048, GAM = 6.365880, STR = 20.885434;

  const lay = (soil, H, g, gsat, phi, c) => ({ soil, H, g, gsat, phi, c });
  const base = {
    sub: 'circ',
    inf: { beta: 25, H: 3, g: 18, gsat: 20, c: 10, phi: 20, seep: false, m: 1 },
    cul: { beta: 60, H: 8, g: 17.5, c: 24, phi: 15, thetaBy: 'crit', theta: 40 },
    circ: { H: 10, beta: 26.565, layers: [lay('clay', 30, 18, 19, 25, 20)], pore: 'none', ru: 0.3, hw: 6, xw: 10, q: 0, xc: 8, yc: 20, R: 22, thru: 'toe', n: 10, method: 'bishop', search: false, useBest: false, sel: 5 },
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const set = (s, over) => { const b = clone(base); Object.keys(b).forEach((k) => { s[k] = b[k]; }); Object.keys(over || {}).forEach((k) => { s[k] = typeof over[k] === 'object' ? Object.assign(s[k], over[k]) : over[k]; }); };

  /** Draw the layered slope body (polygon) in a Draw2D context. */
  function body(D, poly, layers, ref) {
    let top = 1e9, t = ref;
    layers.forEach((l, i) => {
      const bot = i === layers.length - 1 ? -1e9 : t - l.H; t -= l.H;
      const pc = G.clipY(poly, bot, top); top = bot;
      if (pc.length > 2) D.poly(pc, { fill: G.soilFill(l.soil), stroke: 'none' });
      if (i < layers.length - 1) { const q = G.clipY(poly, t - 1e-6, t + 1e-6); if (q.length) { const xs = q.map((p) => p[0]); D.line([Math.min(...xs), t], [Math.max(...xs), t], { stroke: '#6b5b45', sw: 1, dash: '5 3' }); } }
    });
  }

  const GSlope = {
    id: 'slope', title: 'Slope Stability',
    state: clone(base),
    presets: [
      { name: 'Test K1 — infinite slope, dry: β = 25°, H = 3 m, γ = 18, c′ = 10 kPa, φ′ = 20° → FS = 1.264, H_cr = 6.609 m', apply: (s) => set(s, { sub: 'inf' }) },
      { name: 'Test K2 — infinite slope with seepage at the surface: β = 20°, H = 4 m, γ_sat = 19.5, c′ = 10, φ′ = 30° → FS = 1.187', apply: (s) => set(s, { sub: 'inf', inf: { beta: 20, H: 4, gsat: 19.5, phi: 30, seep: true, m: 1 } }) },
      { name: 'Cohesionless infinite slope: FS = tan φ / tan β (φ = 35°, β = 30° → 1.213)', apply: (s) => set(s, { sub: 'inf', inf: { beta: 30, H: 2, c: 0, phi: 35 } }) },
      { name: 'Test K3 — Culmann: H = 8 m, β = 60°, γ = 17.5, c = 24 kPa, φ = 15° → H_cr = 15.67 m, FS_s = 1.607', apply: (s) => set(s, { sub: 'culmann' }) },
      { name: 'Culmann: a trial plane at θ = 45° on the same slope', apply: (s) => set(s, { sub: 'culmann', cul: { thetaBy: 'given', theta: 45 } }) },
      { name: 'Test K4 — 2:1 slope H = 10 m, c = 20 kPa, φ = 25°, toe circle O(8, 20): Fellenius 2.140, Bishop 2.298', apply: (s) => set(s, { sub: 'circ' }) },
      { name: 'Same slope, pore pressure ratio r_u = 0.3 (Fellenius 1.627, Bishop 1.791)', apply: (s) => set(s, { sub: 'circ', circ: { pore: 'ru', ru: 0.3 } }) },
      { name: 'Same slope with a phreatic line 6 m high behind the crest', apply: (s) => set(s, { sub: 'circ', circ: { pore: 'line', hw: 6, xw: 10 } }) },
      { name: 'Search for the critical toe circle (grid of centres), Bishop', apply: (s) => set(s, { sub: 'circ', circ: { search: true, useBest: true } }) },
      { name: 'Two layers: stiff crust over soft clay (φ = 0), deep circle, crest surcharge 20 kPa', apply: (s) => set(s, { sub: 'circ', circ: { H: 8, beta: 33.69, layers: [lay('silt', 4, 18.5, 19.5, 28, 10), lay('clay', 20, 17, 17.5, 0, 35)], q: 20, xc: 6, yc: 14, R: 16.5, thru: 'R', n: 12 } }) },
      { name: 'English units: slope H = 30 ft at 2:1, c = 400 psf, φ = 22°, γ = 120 pcf', units: 'EN', apply: (s) => { set(s, { sub: 'circ', circ: { H: 30, beta: 26.565, layers: [lay('clay', 100, 120, 125, 22, 400)], xc: 25, yc: 60, R: 65, xw: 30, hw: 18 } }); Object.assign(s.inf, { H: 10, g: 115, gsat: 125, c: 200 }); Object.assign(s.cul, { H: 25, g: 110, c: 500 }); } },
    ],
    legend() {
      const s = this.state;
      if (s.sub === 'circ') return [[SL, 'slip circle', 'ln'], [WT, 'slice weight W', 'ln'], [NN, 'normal N′', 'ln'], [TT, 'shear T', 'ln'], [UW, 'pore water', 'ln'], [CEN, 'centre O', '']];
      if (s.sub === 'culmann') return [[SL, 'trial plane', 'ln'], [MASS, 'sliding wedge', 'sq'], [WT, 'weight', 'ln']];
      return [[SL, 'slip plane', 'ln'], [UW, 'water table / seepage', 'ln'], [WT, 'weight', 'ln']];
    },
    toggle() { return this.state.sub === 'circ' ? 'Slice forces' : 'Forces on the element'; },
    plotCaption() { const s = this.state.sub; return s === 'circ' ? 'Table of slice forces and the driving / resisting force of each slice' : s === 'culmann' ? 'FS of trial planes and the critical height' : 'FS versus slope angle and depth'; },
    hint() { return this.state.sub === 'circ' ? 'Click the 2D view to move the circle centre O.' : ''; },

    controls(el, C) {
      const s = this.state, U = root.App.U(), en = U.id === 'EN', L1 = en ? LEN : 1, Gm = en ? GAM : 1, P = en ? 20 : 1;
      const sl = (p, o, k, label, min, max, step, unit) => C.slider(p, { label, min, max, step, get: () => o[k], set: (v) => (o[k] = v), unit });
      C.seg(el, { label: 'Method', options: [['inf', 'Infinite slope'], ['culmann', 'Culmann (plane)'], ['circ', 'Method of slices']], get: () => s.sub, set: (v) => (s.sub = v) });
      if (s.sub === 'inf') {
        const o = s.inf, g = C.section(el, 'Slope and soil');
        sl(g, o, 'beta', 'Slope angle β', 1, 60, 0.1, '°'); sl(g, o, 'H', 'Depth of the slip plane H (vertical)', 0.1, 20 * L1, 0.01, U.len);
        sl(g, o, 'g', 'Unit weight γ', 10 * Gm, 25 * Gm, 0.01, U.gamma); sl(g, o, 'gsat', 'Saturated unit weight γ_sat', 10 * Gm, 25 * Gm, 0.01, U.gamma);
        sl(g, o, 'c', 'Cohesion c′', 0, 100 * P, 0.1, U.press); sl(g, o, 'phi', 'Friction angle φ′', 0, 50, 0.1, '°');
        const w = C.section(el, 'Seepage');
        C.toggle(w, { label: 'Seepage parallel to the slope', get: () => o.seep, set: (v) => (o.seep = v) });
        if (o.seep) sl(w, o, 'm', 'Water table height above the plane m H (m = 0…1)', 0, 1, 0.01, '× H');
      } else if (s.sub === 'culmann') {
        const o = s.cul, g = C.section(el, 'Finite slope (plane failure through the toe)');
        sl(g, o, 'H', 'Slope height H', 0.5, 40 * L1, 0.01, U.len); sl(g, o, 'beta', 'Slope angle β', 10, 90, 0.1, '°');
        sl(g, o, 'g', 'Unit weight γ', 10 * Gm, 25 * Gm, 0.01, U.gamma); sl(g, o, 'c', 'Cohesion c', 0, 150 * P, 0.1, U.press); sl(g, o, 'phi', 'Friction angle φ', 0, 45, 0.1, '°');
        C.seg(g, { label: 'Plane drawn', options: [['crit', 'Critical plane'], ['given', 'Trial plane θ']], get: () => o.thetaBy, set: (v) => (o.thetaBy = v) });
        if (o.thetaBy === 'given') sl(g, o, 'theta', 'Trial plane angle θ', 1, 89, 0.1, '°');
      } else {
        const o = s.circ, g = C.section(el, 'Slope');
        sl(g, o, 'H', 'Slope height H', 1, 40 * L1, 0.01, U.len); sl(g, o, 'beta', 'Slope angle β', 5, 80, 0.01, '°');
        C.note(g, `Slope ${f(1 / Math.tan(o.beta * DEG), 3)} H : 1 V. The toe is at the origin.`);
        sl(g, o, 'q', 'Surcharge on the crest q', 0, 200 * P, 0.1, U.press);
        const l = C.section(el, 'Soil layers (from the crest down)');
        C.layers(l, { layers: o.layers, max: 4, min: 1, title: (i) => `Layer ${i + 1}`, fields: [{ k: 'H', label: 'Thickness', unit: U.len }, { k: 'g', label: 'γ', unit: U.gamma }, { k: 'gsat', label: 'γ_sat', unit: U.gamma }, { k: 'c', label: 'c', unit: U.press }, { k: 'phi', label: 'φ', unit: '°' }], make: (ls) => { const q = ls[ls.length - 1]; return Object.assign({}, q, { soil: q.soil === 'clay' ? 'sand' : 'clay', H: +(q.H / 2).toPrecision(3) }); } });
        C.note(l, 'The last layer continues downward. Each slice base uses the c and φ of the layer it lies in.');
        const w = C.section(el, 'Pore water pressure');
        C.seg(w, { label: 'Pore pressure', options: [['none', 'None (dry)'], ['ru', 'r_u ratio'], ['line', 'Phreatic line']], get: () => o.pore, set: (v) => (o.pore = v) });
        if (o.pore === 'ru') sl(w, o, 'ru', 'Pore pressure ratio r_u = u / (γ h)', 0, 0.8, 0.01, '');
        if (o.pore === 'line') { sl(w, o, 'hw', 'Water level behind the slope (above the toe)', 0, o.H, 0.01, U.len); sl(w, o, 'xw', 'Distance behind the crest where it levels off', 0, 3 * o.H, 0.01, U.len); }
        const c = C.section(el, 'Slip circle');
        C.seg(c, { label: 'Circle', options: [['toe', 'Through the toe'], ['R', 'Radius given']], get: () => o.thru, set: (v) => (o.thru = v) });
        sl(c, o, 'xc', 'Centre x_c', -2 * o.H, 4 * o.H, 0.01, U.len); sl(c, o, 'yc', 'Centre y_c', 0, 5 * o.H, 0.01, U.len);
        if (o.thru === 'R') sl(c, o, 'R', 'Radius R', 0.5, 8 * o.H, 0.01, U.len);
        sl(c, o, 'n', 'Number of slices', 3, 30, 1, '');
        C.seg(c, { label: 'Main result', options: [['bishop', 'Bishop simplified'], ['oms', 'Ordinary (Fellenius)']], get: () => o.method, set: (v) => (o.method = v) });
        C.toggle(c, { label: 'Search a grid of centres for the minimum FS', get: () => o.search, set: (v) => (o.search = v) });
        if (o.search) C.toggle(c, { label: 'Analyse the critical circle found', get: () => o.useBest, set: (v) => (o.useBest = v) });
        sl(c, o, 'sel', 'Slice whose forces are drawn', 1, o.n, 1, '');
      }
    },
    onUnits(from, to) {
      const s = this.state, k = to === 'EN' ? 1 : -1, L = Math.pow(LEN, k), Gm = Math.pow(GAM, k), S = Math.pow(STR, k), r = (x) => +(+x).toPrecision(5);
      ['H'].forEach((q) => { s.inf[q] = r(s.inf[q] * L); s.cul[q] = r(s.cul[q] * L); });
      ['g', 'gsat'].forEach((q) => (s.inf[q] = r(s.inf[q] * Gm))); s.cul.g = r(s.cul.g * Gm);
      s.inf.c = r(s.inf.c * S); s.cul.c = r(s.cul.c * S);
      const c = s.circ; ['H', 'hw', 'xw', 'xc', 'yc', 'R'].forEach((q) => (c[q] = r(c[q] * L))); c.q = r(c.q * S);
      c.layers.forEach((l) => { l.H = r(l.H * L); l.g = r(l.g * Gm); l.gsat = r(l.gsat * Gm); l.c = r(l.c * S); });
    },
    compute(U) { if (this.state.circ.sel > this.state.circ.n) this.state.circ.sel = this.state.circ.n; return Physics.slope(this.state, U); },
    onClick(pt) {
      const s = this.state; if (s.sub !== 'circ') return false;
      s.circ.xc = +pt[0].toFixed(2); s.circ.yc = +Math.max(0, pt[1]).toFixed(2); s.circ.useBest = false;
      return true;
    },

    draw2D(svg, res, U, opts) {
      const g = res.geo, show = opts.showP !== false;
      if (g.sub === 'inf') this.drawInf(svg, g, U, show); else if (g.sub === 'culmann') this.drawCul(svg, g, U, show); else this.drawCirc(svg, g, U, show);
    },

    drawInf(svg, g, U, show) {
      const o = this.state.inf, H = o.H, b = o.beta * DEG, tb = Math.tan(b), X = 2.2 * H;
      const D = root.UI.Draw2D(svg, { xmin: -X, xmax: X, ymin: -X * tb - 1.5 * H, ymax: X * tb + 0.6 * H }, { pad: 34 });
      G.soilDefs(svg);
      const sY = (x) => x * tb, pY = (x) => x * tb - H;
      D.poly([[-X, sY(-X)], [X, sY(X)], [X, pY(X)], [-X, pY(-X)]], { fill: G.soilFill(o.c > 0 ? 'clay' : 'sand'), stroke: 'none' });
      D.poly([[-X, pY(-X)], [X, pY(X)], [X, pY(X) - 0.45 * H], [-X, pY(-X) - 0.45 * H]], { fill: G.soilFill('rock'), stroke: 'none' });
      if (o.seep) { const m = o.m; D.poly([[-X, pY(-X) + m * H], [X, pY(X) + m * H], [X, pY(X)], [-X, pY(-X)]], { fill: '#4aa3df', fop: 0.18 }); D.line([-X, pY(-X) + m * H], [X, pY(X) + m * H], { stroke: UW, sw: 1.6, dash: '7 4' }); for (let i = -1; i <= 1; i += 2) { const x = i * 1.4 * H, y = pY(x) + m * H * 0.45; D.arrow([x - 0.35 * H, y - 0.35 * H * tb], [x + 0.05 * H, y + 0.05 * H * tb], { color: UW, w: 1.6, head: 8 }); } D.text([-X, pY(-X) + m * H], 'seepage parallel to the slope', { dx: 6, dy: -6, size: 11, color: UW }); }
      D.line([-X, sY(-X)], [X, sY(X)], { stroke: '#6b5b45', sw: 1.8 });
      D.line([-X, pY(-X)], [X, pY(X)], { stroke: SL, sw: 2.6, dash: '10 5' });
      D.text([X, pY(X)], 'slip plane', { anchor: 'end', dy: 16, size: 11.5, color: SL, weight: 700 });
      // element
      const e = 0.45 * H, q = [[-e, sY(-e)], [e, sY(e)], [e, pY(e)], [-e, pY(-e)]];
      D.poly(q, { fill: '#fff', fop: 0.35, stroke: WT, sw: 2 });
      D.dim([-e - 0.15 * H, pY(-e)], [-e - 0.15 * H, sY(-e)], `H = ${f(H)}`, -6, { anchor: 'end', ldx: -6 });
      D.arc([-X * 0.75, sY(-X * 0.75)], 36, 0, o.beta, `β = ${f(o.beta)}°`, { color: '#6b5b45' });
      D.line([-X * 0.75, sY(-X * 0.75)], [-X * 0.75 + 0.8 * H, sY(-X * 0.75)], { stroke: '#7f8c8d', sw: 1, dash: '3 3' });
      if (show) {
        const c0 = [0, -H / 2];
        D.force([0, -H / 2 - 0.02 * H], [0, -1], 55, { color: WT, label: 'W', ldx: 6 });
        const nb = [Math.sin(b), -Math.cos(b)], base = [0, -H];
        D.force(base, [-nb[0], -nb[1]], 50, { color: NN, label: `σ = ${f(g.sig)}`, anchor: 'end', ldx: -8, ldy: 14 });
        D.force([base[0] - 0.05 * H, base[1] - 0.05 * H * tb], [Math.cos(b), Math.sin(b)], 50, { color: TT, label: `τ = ${f(g.tau)}`, ldx: -60, ldy: 22 });
        if (g.u > 0) D.text(base, `u = ${f(g.u)}`, { dx: 10, dy: 34, size: 11.5, color: UW, weight: 700 });
        void c0;
      }
      const lines = [`FS = [c′ + (σ − u) tan φ′] / τ = ${f(g.FS, 4)}`];
      if (g.Hcr) lines.unshift(`critical depth H_cr = ${f(g.Hcr)} ${U.len}`);
      G.infoBox(D, lines, true, lines.map((l, i) => (i === lines.length - 1 ? (g.FS >= 1 ? '#1e8449' : SL) : null)));
    },

    drawCul(svg, g, U, show) {
      const o = this.state.cul, H = o.H, b = o.beta * DEG, L = H / Math.tan(b), th = g.th * DEG, xe = H / Math.tan(th), xR = Math.max(xe, L) + 0.5 * H;
      const D = root.UI.Draw2D(svg, { xmin: -0.5 * H, xmax: xR, ymin: -0.3 * H, ymax: 1.25 * H }, { pad: 36 });
      G.soilDefs(svg);
      const soil = G.soilFill(o.c > 0 ? 'clay' : 'sand');
      D.poly([[-0.5 * H, 0], [0, 0], [L, H], [xR, H], [xR, -0.3 * H], [-0.5 * H, -0.3 * H]], { fill: soil, stroke: 'none' });
      D.poly([[0, 0], [L, H], [xe, H]], { fill: MASS, fop: 0.35, stroke: MASS, sw: 1.2 });
      D.pline([[-0.5 * H, 0], [0, 0], [L, H], [xR, H]], { stroke: '#6b5b45', sw: 1.8 });
      D.line([0, 0], [xe, H], { stroke: SL, sw: 2.6 });
      if (Math.abs(g.th - g.thc) > 0.05) { const xc = H / Math.tan(g.thc * DEG); D.line([0, 0], [xc, H], { stroke: SL, sw: 1.3, dash: '7 4' }); D.text([xc, H], `critical θ = ${f(g.thc)}°`, { anchor: 'end', dx: -4, dy: -6, size: 11, color: SL }); }
      D.arc([0, 0], 70, 0, o.beta, `β = ${f(o.beta)}°`, { color: '#6b5b45' });
      D.arc([0, 0], 44, 0, g.th, `θ = ${f(g.th)}°`, { color: SL });
      D.line([0, 0], [0.6 * H, 0], { stroke: '#7f8c8d', sw: 1, dash: '3 3' });
      D.dim([xR - 0.15 * H, 0], [xR - 0.15 * H, H], `H = ${f(H)}`, -8, { anchor: 'start', ldx: 6 });
      D.text([xe / 2, H / 2], `L = ${f(g.Lp)}`, { dx: 8, dy: 14, size: 11, color: SL });
      if (show) {
        const cx = (L + xe) / 3, cy = (2 * H) / 3;
        D.force([cx, cy - 0.02 * H], [0, -1], 60, { color: WT, label: `W = ${f(g.W)}`, ldx: 6 });
        const p = [xe * 0.45, H * 0.45], n = [-Math.sin(th), Math.cos(th)];
        D.force(p, n, 50, { color: NN, label: `N = ${f(g.Na)}`, anchor: 'end', ldx: -6, ldy: 12 });
        D.force([p[0] + 0.05 * H, p[1] + 0.05 * H * Math.tan(th)], [Math.cos(th), Math.sin(th)], 55, { color: TT, label: `resisting c L + N tan φ = ${f(g.Tr)}`, ldx: 10, ldy: -12 });
      }
      G.infoBox(D, [`H_cr = (4c/γ) sin β cos φ / [1 − cos(β − φ)] = ${f(g.Hcr)}`, `FS_s (critical plane) = ${f(g.FS, 4)}`, `FS on the plane θ = ${f(g.th)}°: ${f(g.FSp, 4)}`], false, [null, g.FS >= 1 ? '#1e8449' : SL, null]);
    },

    drawCirc(svg, g, U, show) {
      const o = this.state.circ, H = o.H, L = H / Math.tan(o.beta * DEG), C = g.C, S = g.S, sl = g.sl;
      const arcY = (x) => C.yc - Math.sqrt(Math.max(0, C.R * C.R - (x - C.xc) ** 2));
      const xL = Math.min(-0.5 * H, sl.xa - 0.3 * H, C.xc - 0.2 * H), xR = Math.max(L + 0.6 * H, sl.xb + 0.3 * H, C.xc + 0.2 * H);
      const yB = Math.min(-0.25 * H, Math.min(...S.map((q) => q.yb)) - 0.15 * H), yT = Math.max(H * 1.2, C.yc + 0.12 * H);
      const D = root.UI.Draw2D(svg, { xmin: xL, xmax: xR + 0.12 * H, ymin: yB, ymax: yT }, { pad: 30 });
      G.soilDefs(svg);
      const poly = [[xL, 0], [0, 0], [L, H], [xR, H], [xR, yB], [xL, yB]];
      body(D, poly, o.layers, H);
      const ph = Physics.slopePhreatic(o);
      if (ph) { const pts = []; for (let i = 0; i <= 60; i++) { const x = xL + ((xR - xL) * i) / 60; pts.push([x, ph(x)]); } D.poly(pts.concat([[xR, yB], [xL, yB]]), { fill: '#4aa3df', fop: 0.12 }); D.pline(pts, { stroke: UW, sw: 1.6, dash: '7 4' }); D.text([xR, o.hw], 'phreatic line', { anchor: 'end', dy: -6, size: 11, color: UW }); }
      D.pline([[xL, 0], [0, 0], [L, H], [xR, H]], { stroke: '#6b5b45', sw: 1.8 });
      if (o.q > 0) { D.poly([[L, H], [xR, H], [xR, H + 0.03 * H], [L, H + 0.03 * H]], { fill: '#e67e22', fop: 0.35, stroke: '#e67e22' }); for (let i = 1; i <= 4; i++) { const x = L + ((xR - L) * i) / 5; D.arrow([x, H + 0.13 * H], [x, H + 0.035 * H], { color: '#e67e22', w: 1.4, head: 7 }); } D.text([xR, H + 0.13 * H], `q = ${f(o.q)} ${U.press}`, { anchor: 'end', dy: -4, size: 11.5, color: '#b9581c', weight: 700 }); }
      // search grid
      if (g.grid && g.grid.length) {
        const mn = Math.min(...g.grid.map((q) => q.FS)), mx = Math.min(mn * 2, Math.max(...g.grid.map((q) => q.FS)));
        g.grid.forEach((q) => { const t = Math.min(1, (q.FS - mn) / Math.max(mx - mn, 1e-9)); D.el('circle', { cx: D.X(q.xc), cy: D.Y(q.yc), r: 3.2, fill: `hsl(${Math.round(120 * t)},65%,45%)`, 'fill-opacity': 0.8 }); });
        if (g.best && !o.useBest) { const b = g.best; const pts = []; for (let i = 0; i <= 80; i++) { const a = Math.PI + (Math.PI * i) / 80; pts.push([b.xc + b.R * Math.cos(a), b.yc + b.R * Math.sin(a)]); } D.pline(pts.filter((p) => p[1] <= Physics.slopeGround(o)(p[0]) + 1e-6), { stroke: SL, sw: 1.4, dash: '5 4' }); }
        D.text([g.best.xc, g.best.yc], `min FS = ${f(g.best.FS, 4)}`, { dx: 8, dy: -8, size: 11, color: SL, weight: 700 });
      }
      // sliding mass, slices
      const top = Physics.slopeGround(o), mass = [];
      for (let i = 0; i <= 80; i++) { const x = sl.xa + ((sl.xb - sl.xa) * i) / 80; mass.push([x, top(x)]); }
      for (let i = 80; i >= 0; i--) { const x = sl.xa + ((sl.xb - sl.xa) * i) / 80; mass.push([x, arcY(x)]); }
      D.poly(mass, { fill: MASS, fop: 0.18 });
      const sel = S[Math.min(o.sel, S.length) - 1];
      if (sel) D.poly([[sel.x0, top(sel.x0)], [sel.x0, arcY(sel.x0)], [sel.x1, arcY(sel.x1)], [sel.x1, top(sel.x1)]], { fill: '#f1c40f', fop: 0.35 });
      S.forEach((q, i) => { if (i > 0) D.line([q.x0, arcY(q.x0)], [q.x0, top(q.x0)], { stroke: '#6b4a1f', sw: 1 }); D.text([q.xm, Math.max(q.yb, q.yt - 0.02 * H) ], String(q.i), { anchor: 'middle', dy: -4, size: 10, color: '#6b4a1f', weight: 700 }); });
      D.pline(mass.slice(81), { stroke: SL, sw: 2.8 });
      D.line([C.xc, C.yc], [sl.xa, sl.ya], { stroke: CEN, sw: 1, dash: '4 3' });
      D.line([C.xc, C.yc], [sl.xb, sl.yb], { stroke: CEN, sw: 1, dash: '4 3' });
      D.dot([C.xc, C.yc], CEN, `O (${f(C.xc)}, ${f(C.yc)})`, { r: 5 });
      D.text([(C.xc + sl.xb) / 2, (C.yc + sl.yb) / 2], `R = ${f(C.R)}`, { dx: 6, size: 11, color: CEN });
      D.dim([xR - 0.1 * H, 0], [xR - 0.1 * H, H], `H = ${f(H)}`, -8, { anchor: 'start', ldx: 6 });
      D.arc([0, 0], 40, 0, o.beta, `β = ${f(o.beta)}°`, { color: '#6b5b45' });
      if (show) {
        const Wm = Math.max(...S.map((q) => q.W), 1e-9);
        S.forEach((q) => { const y = (q.yt + q.yb) / 2; D.force([q.xm, y - 0.01 * H], [0, -1], 10 + (40 * q.W) / Wm, { color: WT, w: 1.8, head: 7 }); });
        if (sel) {
          const a = sel.alpha, base = [sel.xm, sel.yb], n = [-Math.sin(a), Math.cos(a)], t = [Math.cos(a), Math.sin(a)];
          D.text([sel.xm, (sel.yt + sel.yb) / 2], `W${sel.i} = ${f(sel.W)}`, { dx: 6, dy: 4, size: 11, color: WT, weight: 700 });
          D.force(base, n, 46, { color: NN, label: `N′ = ${f(sel.Np)}`, anchor: 'end', ldx: -6, ldy: 16 });
          D.force([base[0] - t[0] * 0.02 * H, base[1] - t[1] * 0.02 * H], [-t[0], -t[1]], 46, { color: TT, label: `T = ${f(sel.res / g.FS)}`, ldx: 6, ldy: 24 });
          if (sel.u > 0) D.text(base, `u l = ${f(sel.ul)}`, { dx: 8, dy: 40, size: 11, color: UW, weight: 700 });
          D.text(base, `α = ${f(sel.alpha / DEG, 3)}°`, { dx: 8, dy: sel.u > 0 ? 54 : 40, size: 11, color: '#34495e' });
        }
      }
      G.infoBox(D, [`Fellenius FS = ${f(g.oms, 4)}`, `Bishop FS = ${f(g.bis, 4)}`, `Σ W sin α = ${f(g.drv)} ${U.fpl}`], false, [o.method === 'oms' ? (g.oms >= 1.5 ? '#1e8449' : SL) : null, o.method !== 'oms' ? (g.bis >= 1.5 ? '#1e8449' : SL) : null, null]);
    },

    draw3D(V, res, U) {
      const g = res.geo, s = this.state, Lz = (s.sub === 'circ' ? s.circ.H : s.sub === 'inf' ? s.inf.H * 2 : s.cul.H) * 0.8;
      if (g.sub === 'inf') {
        const o = s.inf, H = o.H, tb = Math.tan(o.beta * DEG), X = 2 * H;
        V.extrude([[-X, -X * tb], [X, X * tb], [X, X * tb - H], [-X, -X * tb - H]], 0, Lz, G.SOILS[o.c > 0 ? 'clay' : 'sand'].c3d, 0.6, '#6b5b45');
        V.extrude([[-X, -X * tb - H], [X, X * tb - H], [X, X * tb - 1.4 * H], [-X, -X * tb - 1.4 * H]], 0, Lz, G.SOILS.rock.c3d, 0.9, '#555');
        V.face([[-X, -X * tb - H, 0], [X, X * tb - H, 0], [X, X * tb - H, Lz], [-X, -X * tb - H, Lz]], SL, 0.5, SL, 2);
        if (o.seep) V.face([[-X, -X * tb - H + o.m * H, 0], [X, X * tb - H + o.m * H, 0], [X, X * tb - H + o.m * H, Lz], [-X, -X * tb - H + o.m * H, Lz]], '#4aa3df', 0.3, UW);
        V.label([X, X * tb - H, Lz], `slip plane, FS = ${f(g.FS, 4)}`, SL);
        V.dim([0, -H, Lz], [0, 0, Lz], `H = ${f(H)} ${U.len}`, [0, 0, 0.3 * H]);
      } else if (g.sub === 'culmann') {
        const o = s.cul, H = o.H, L = H / Math.tan(o.beta * DEG), xe = H / Math.tan(g.th * DEG), xR = Math.max(xe, L) + 0.4 * H;
        V.extrude([[-0.4 * H, 0], [0, 0], [xe, H], [xR, H], [xR, -0.3 * H], [-0.4 * H, -0.3 * H]], 0, Lz, G.SOILS[o.c > 0 ? 'clay' : 'sand'].c3d, 0.7, '#6b5b45');
        V.extrude([[0, 0], [L, H], [xe, H]], 0, Lz, MASS, 0.8, '#a04000');
        G.arrow3D(V, [(L + xe) / 3, (2 * H) / 3 + 0.3 * H, Lz / 2], [(L + xe) / 3, (2 * H) / 3, Lz / 2], WT, 2.6, `W = ${f(g.W)} ${U.fpl}`, 0.05 * H);
        V.label([xe, H, Lz], `θ = ${f(g.th)}°, FS = ${f(g.FSp, 4)}`, SL);
        V.dim([xR, 0, Lz], [xR, H, Lz], `H = ${f(H)} ${U.len}`, [0.15 * H, 0, 0]);
      } else {
        const o = s.circ, H = o.H, L = H / Math.tan(o.beta * DEG), C = g.C, sl = g.sl, top = Physics.slopeGround(o);
        const arcY = (x) => C.yc - Math.sqrt(Math.max(0, C.R * C.R - (x - C.xc) ** 2));
        const xL = Math.min(-0.4 * H, sl.xa - 0.2 * H), xR = Math.max(L + 0.5 * H, sl.xb + 0.2 * H), yB = Math.min(-0.3 * H, Math.min(...g.S.map((q) => q.yb)) - 0.1 * H);
        V.extrude([[xL, 0], [0, 0], [L, H], [xR, H], [xR, yB], [xL, yB]], 0, Lz, G.SOILS[o.layers[0].soil].c3d, 0.35, '#6b5b45');
        const mass = [];
        for (let i = 0; i <= 40; i++) { const x = sl.xa + ((sl.xb - sl.xa) * i) / 40; mass.push([x, top(x)]); }
        for (let i = 40; i >= 0; i--) { const x = sl.xa + ((sl.xb - sl.xa) * i) / 40; mass.push([x, arcY(x)]); }
        V.extrude(mass, Lz * 0.1, Lz * 0.9, MASS, 0.75, '#a04000', { sideStroke: null });
        g.S.forEach((q, i) => { if (i > 0) V.line([[q.x0, arcY(q.x0), Lz * 0.9], [q.x0, top(q.x0), Lz * 0.9]], '#6b4a1f', 1.2); });
        V.line([[C.xc, C.yc, Lz * 0.9], [sl.xb, sl.yb, Lz * 0.9]], CEN, 1.2, [4, 3]);
        V.label([C.xc, C.yc, Lz * 0.9], `O, R = ${f(C.R)} ${U.len}`, CEN);
        V.label([sl.xb, sl.yb, Lz], `FS = ${f(g.FS, 4)}`, SL);
      }
      V.autoBounds();
    },

    plot(svg, res, U) {
      const g = res.geo, s = this.state, { W, H } = G.chartSurface(svg);
      if (g.sub === 'circ') {
        const R = W < 760 ? [{ x: 0, y: 0, w: W, h: H }] : [{ x: 0, y: 0, w: W * 0.64, h: H }, { x: W * 0.64, y: 0, w: W * 0.36, h: H }];
        this.table(svg, R[0], g, U);
        if (R[1]) {
          const S = g.S;
          G.chart(svg, R[1], { title: 'Driving and resisting force per slice', xlab: 'slice', ylab: U.fpl, xmin: 0.5, xmax: S.length + 0.5, series: [{ pts: S.map((q) => [q.i, q.Wsin]), color: SL, w: 2.2, label: 'W sin α' }, { pts: S.map((q) => [q.i, s.circ.method === 'oms' ? q.res : q.bnum]), color: NN, w: 2.2, label: s.circ.method === 'oms' ? 'c l + N′ tan φ' : 'Bishop term' }], hlines: [{ y: 0, color: '#95a5a6', dash: '2 2' }] });
        }
        return true;
      }
      const R = G.panels(W, H, 2);
      if (g.sub === 'inf') {
        const o = s.inf, gw = U.gw, fsAt = (bt, Hh) => { const b = bt * DEG, m = o.seep ? o.m : 0, ga = o.g * (1 - m) + o.gsat * m, c2 = Math.cos(b) ** 2; return (o.c + (ga * Hh * c2 - m * Hh * gw * c2) * Math.tan(o.phi * DEG)) / (ga * Hh * Math.cos(b) * Math.sin(b)); };
        const a = [], d = [];
        for (let bt = 2; bt <= 60; bt += 1) a.push([bt, fsAt(bt, o.H)]);
        for (let i = 1; i <= 60; i++) { const Hh = (3 * o.H * i) / 60; d.push([Hh, fsAt(o.beta, Hh)]); }
        const cap = (pts) => pts.map((p) => [p[0], Math.min(p[1], 6)]);
        G.chart(svg, R[0], { title: `FS versus slope angle (H = ${f(o.H)} ${U.len})`, xlab: 'β (°)', ylab: 'FS', xmin: 0, xmax: 60, ymin: 0, ymax: 4, series: [{ pts: cap(a), color: SL, w: 2.4 }], hlines: [{ y: 1, label: 'FS = 1', color: '#7f8c8d' }], marks: [{ x: o.beta, y: g.FS, label: f(g.FS, 4), color: SL }] });
        G.chart(svg, R[1], { title: `FS versus depth of the slip plane (β = ${f(o.beta)}°)`, xlab: `H (${U.len})`, ylab: 'FS', xmin: 0, xmax: 3 * o.H, ymin: 0, ymax: 4, series: [{ pts: cap(d), color: NN, w: 2.4 }], hlines: [{ y: 1, label: 'FS = 1', color: '#7f8c8d' }], vlines: g.Hcr && g.Hcr < 3 * o.H ? [{ x: g.Hcr, label: 'H_cr', color: SL }] : [], marks: [{ x: o.H, y: g.FS, label: f(g.FS, 4), color: NN }] });
      } else {
        const o = s.cul, b = o.beta * DEG, phi = o.phi * DEG, pts = [];
        for (let t = 1; t < o.beta; t += 0.5) { const th = t * DEG, Wt = 0.5 * o.g * o.H * o.H * Math.sin(b - th) / (Math.sin(b) * Math.sin(th)), Lp = o.H / Math.sin(th); pts.push([t, Math.min(6, (o.c * Lp + Wt * Math.cos(th) * Math.tan(phi)) / (Wt * Math.sin(th)))]); }
        const mn = pts.reduce((a, p) => (p[1] < a[1] ? p : a), pts[0]);
        G.chart(svg, R[0], { title: 'FS on trial planes through the toe', xlab: 'plane angle θ (°)', ylab: 'FS', xmin: 0, xmax: o.beta, ymin: 0, ymax: Math.min(6, Math.max(2, mn[1] * 2.5)), series: [{ pts, color: SL, w: 2.4 }], hlines: [{ y: 1, label: 'FS = 1', color: '#7f8c8d' }], marks: [{ x: mn[0], y: mn[1], label: `min ${f(mn[1], 4)} at ${f(mn[0])}°`, color: SL }] });
        const hs = [];
        for (let bt = Math.max(o.phi + 1, 20); bt <= 90; bt += 1) { const bb = bt * DEG; hs.push([bt, (4 * o.c / o.g) * Math.sin(bb) * Math.cos(phi) / (1 - Math.cos(bb - phi))]); }
        G.chart(svg, R[1], { title: 'Critical height versus slope angle', xlab: 'β (°)', ylab: `H_cr (${U.len})`, xmin: Math.max(o.phi + 1, 20), xmax: 90, ymin: 0, ymax: Math.max(o.H * 2, g.Hcr * 1.3), series: [{ pts: hs, color: NN, w: 2.4 }], hlines: [{ y: o.H, label: `H = ${f(o.H)}`, color: '#7f8c8d' }], marks: [{ x: o.beta, y: g.Hcr, label: f(g.Hcr), color: NN }] });
      }
      return true;
    },

    /** Slice table drawn as SVG text. */
    table(svg, r, g, U) {
      const S = g.S, bis = this.state.circ.method !== 'oms';
      const cols = [['#', (q) => q.i], ['b', (q) => q.b], ['h', (q) => q.h], ['W', (q) => q.W], ['α°', (q) => q.alpha / DEG], ['W sinα', (q) => q.Wsin], ['W cosα', (q) => q.Wcos], ['u·l', (q) => q.ul], ['cl+N′tanφ', (q) => q.res], ['m_α', (q) => q.ma], ['Bishop', (q) => q.bnum]];
      const s = (tag, a, txt) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.keys(a).forEach((k) => e.setAttribute(k, a[k])); if (txt !== undefined) e.textContent = txt; svg.appendChild(e); return e; };
      const rows = S.length + 2, rh = Math.min(17, (r.h - 34) / rows), top = r.y + 24 + rh, cw = (r.w - 16) / cols.length, fs = Math.max(8.5, Math.min(11, rh - 4, cw / 6));
      s('text', { x: r.x + 8, y: r.y + 16, 'font-size': 12.5, 'font-weight': 700, fill: '#1d2733' }, `Slice forces (per unit length, ${U.fpl})`);
      s('rect', { x: r.x + 6, y: top - rh + 3, width: r.w - 12, height: rh, fill: '#eef2f5' });
      cols.forEach(([h], j) => s('text', { x: r.x + 8 + cw * (j + 1) - 4, y: top, 'font-size': fs, 'font-weight': 700, 'text-anchor': 'end', fill: j >= 9 && !bis ? '#95a5a6' : '#34495e' }, h));
      S.forEach((q, i) => {
        const y = top + rh * (i + 1);
        if (i % 2) s('rect', { x: r.x + 6, y: y - rh + 3, width: r.w - 12, height: rh, fill: '#f7f9fa' });
        cols.forEach(([, fn], j) => { const v = fn(q); s('text', { x: r.x + 8 + cw * (j + 1) - 4, y, 'font-size': fs, 'text-anchor': 'end', fill: j === 0 ? '#6b4a1f' : '#1d2733', 'font-family': 'JetBrains Mono, ui-monospace, monospace' }, v === undefined ? '' : j === 0 ? String(v) : f(v, 4)); });
      });
      const y = top + rh * (S.length + 1);
      s('line', { x1: r.x + 6, y1: y - rh + 2, x2: r.x + r.w - 6, y2: y - rh + 2, stroke: '#95a5a6' });
      const sum = (fn) => S.reduce((a, q) => a + (fn(q) || 0), 0);
      [[3, sum((q) => q.W)], [5, sum((q) => q.Wsin)], [8, sum((q) => q.res)], [10, sum((q) => q.bnum)]].forEach(([j, v]) => s('text', { x: r.x + 8 + cw * (j + 1) - 4, y, 'font-size': fs, 'font-weight': 700, 'text-anchor': 'end', fill: '#c0392b', 'font-family': 'JetBrains Mono, ui-monospace, monospace' }, f(v, 5)));
      s('text', { x: r.x + 10, y, 'font-size': fs, 'font-weight': 700, fill: '#c0392b' }, 'Σ');
    },
  };

  root.GSlope = GSlope;
})(window);
