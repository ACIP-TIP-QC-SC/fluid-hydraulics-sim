/* =====================================================================
 * MODULE 1 — Hydrostatic forces on surfaces (UI + diagrams)
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Physics } = root;
  const { COL } = root.UI;
  const f = Physics.fmt;

  const M1 = {
    id: 'm1', title: 'Hydrostatic Forces',
    state: {
      sub: 'vertical', sg: 1, h1: 1, theta: 60, shape: 'rect', orient: 'up', ps: 0, both: false, sg2: 1, h2: 0.5, hinge: 'none',
      dims: { rect: { b: 2, h: 3 }, tri: { b: 2, h: 3 }, circle: { D: 2 }, semi: { r: 1 }, trap: { a: 1, b: 3, h: 2 } },
      ctype: 'quarter', R: 2, L: 1, side: 'concave', hd: 0,
    },
    presets: [
      { name: 'Test 1 — Vertical rectangle 2×3 m, top 1 m deep', apply: (s) => Object.assign(s, { sub: 'vertical', sg: 1, h1: 1, shape: 'rect', ps: 0, both: false, hinge: 'none' }, { dims: Object.assign(s.dims, { rect: { b: 2, h: 3 } }) }) },
      { name: 'Test 2 — Vertical circle D = 2 m, centre 3 m deep', apply: (s) => Object.assign(s, { sub: 'vertical', sg: 1, h1: 2, shape: 'circle', ps: 0, both: false, hinge: 'none' }, { dims: Object.assign(s.dims, { circle: { D: 2 } }) }) },
      { name: 'Inclined 60° rectangle, hinged at top', apply: (s) => Object.assign(s, { sub: 'inclined', theta: 60, sg: 1, h1: 1.5, shape: 'rect', ps: 0, both: false, hinge: 'top' }, { dims: Object.assign(s.dims, { rect: { b: 1.5, h: 2.5 } }) }) },
      { name: 'Triangle apex up, oil Sg 0.80', apply: (s) => Object.assign(s, { sub: 'vertical', sg: 0.8, h1: 2, shape: 'tri', orient: 'up', ps: 0, both: false, hinge: 'none' }, { dims: Object.assign(s.dims, { tri: { b: 2, h: 3 } }) }) },
      { name: 'Closed tank, p_s = 20 kPa', apply: (s) => Object.assign(s, { sub: 'vertical', sg: 1, h1: 1, shape: 'rect', ps: 20, both: false, hinge: 'none' }, { dims: Object.assign(s.dims, { rect: { b: 2, h: 3 } }) }) },
      { name: 'Water on both sides (4 m / 3.2 m)', apply: (s) => Object.assign(s, { sub: 'vertical', sg: 1, h1: 1, shape: 'rect', ps: 0, both: true, sg2: 1, h2: 0.2, hinge: 'bottom' }, { dims: Object.assign(s.dims, { rect: { b: 2, h: 3 } }) }) },
      { name: 'Quarter-circle gate R = 2 m', apply: (s) => Object.assign(s, { sub: 'curved', ctype: 'quarter', R: 2, L: 1, side: 'concave', hd: 0, sg: 1 }) },
      { name: 'Cylinder gate R = 1 m, water to the top', apply: (s) => Object.assign(s, { sub: 'curved', ctype: 'full', R: 1, L: 1, hd: 0, sg: 1 }) },
    ],

    controls(el, C) {
      const s = this.state;
      const U = root.App.U();
      C.seg(el, { label: 'Surface type', options: [['vertical', 'Plane vertical'], ['inclined', 'Plane inclined'], ['curved', 'Curved']], get: () => s.sub, set: (v) => (s.sub = v) });
      C.sg(el, { get: () => s.sg, set: (v) => (s.sg = v) });
      if (s.sub !== 'curved') {
        const g = C.section(el, 'Gate');
        C.select(g, { label: 'Gate shape', options: [['rect', 'Rectangle'], ['tri', 'Triangle'], ['circle', 'Circle'], ['semi', 'Semicircle'], ['trap', 'Trapezoid']], get: () => s.shape, set: (v) => (s.shape = v) });
        const d = s.dims[s.shape];
        const sl = (k, label, min, max, def) => C.slider(g, { label, min, max, step: 0.01, get: () => d[k], set: (v) => (d[k] = v), unit: U.len });
        if (s.shape === 'rect') { sl('b', 'Width b', 0.1, 10); sl('h', 'Height h', 0.1, 10); }
        if (s.shape === 'tri') {
          sl('b', 'Base b', 0.1, 10); sl('h', 'Height h', 0.1, 10);
          C.seg(g, { label: 'Orientation', options: [['up', 'Apex up'], ['down', 'Apex down']], get: () => s.orient === 'down' ? 'down' : 'up', set: (v) => (s.orient = v) });
        }
        if (s.shape === 'circle') sl('D', 'Diameter D', 0.1, 10);
        if (s.shape === 'semi') {
          sl('r', 'Radius r', 0.1, 5);
          C.seg(g, { label: 'Orientation', options: [['top', 'Diameter at top'], ['bottom', 'Diameter at bottom']], get: () => s.orient === 'bottom' ? 'bottom' : 'top', set: (v) => (s.orient = v) });
        }
        if (s.shape === 'trap') { sl('a', 'Top width a', 0.1, 10); sl('b', 'Bottom width b', 0.1, 10); sl('h', 'Height h', 0.1, 10); }
        const p = C.section(el, 'Position & loading');
        C.slider(p, { label: 'Depth of top edge h₁ (vertical)', min: 0, max: 20, step: 0.01, get: () => s.h1, set: (v) => (s.h1 = v), unit: U.len });
        if (s.sub === 'inclined') C.slider(p, { label: 'Inclination θ from horizontal', min: 5, max: 90, step: 0.1, get: () => s.theta, set: (v) => (s.theta = v), unit: '°' });
        C.slider(p, { label: 'Surface gas pressure p_s (closed tank)', min: 0, max: 200, step: 0.1, get: () => s.ps, set: (v) => (s.ps = v), unit: U.press });
        C.toggle(p, { label: 'Liquid on both sides', get: () => s.both, set: (v) => (s.both = v) });
        if (s.both) {
          C.slider(p, { label: 'Side 2: Sg₂', min: 0.5, max: 13.6, step: 0.01, get: () => s.sg2, set: (v) => (s.sg2 = v), unit: '' });
          C.slider(p, { label: 'Side 2: depth of top edge h₂', min: 0, max: 20, step: 0.01, get: () => s.h2, set: (v) => (s.h2 = v), unit: U.len });
        }
        C.seg(p, { label: 'Hinge', options: [['none', 'None'], ['top', 'Top edge'], ['bottom', 'Bottom edge']], get: () => s.hinge, set: (v) => (s.hinge = v) });
      } else {
        const g = C.section(el, 'Curved surface');
        C.select(g, { label: 'Surface', options: [['quarter', 'Quarter circle'], ['semi', 'Semicircle (half cylinder)'], ['full', 'Full cylinder (log / drum gate)']], get: () => s.ctype, set: (v) => (s.ctype = v) });
        C.slider(g, { label: 'Radius R', min: 0.1, max: 10, step: 0.01, get: () => s.R, set: (v) => (s.R = v), unit: U.len });
        C.slider(g, { label: 'Length L (perpendicular to page)', min: 0.1, max: 20, step: 0.01, get: () => s.L, set: (v) => (s.L = v), unit: U.len });
        C.slider(g, { label: 'Liquid depth above top of curve', min: 0, max: 20, step: 0.01, get: () => s.hd, set: (v) => (s.hd = v), unit: U.len });
        if (s.ctype !== 'full') C.seg(g, { label: 'Liquid on the', options: [['concave', 'Concave side'], ['convex', 'Convex side']], get: () => s.side, set: (v) => (s.side = v) });
        else C.note(g, 'Full cylinder: liquid is on the left (convex side), touching the left half.');
      }
    },

    compute(U) {
      const s = this.state;
      if (s.sub === 'curved') return Physics.curved({ sg: s.sg, type: s.ctype, R: s.R, L: s.L, side: s.side, hd: s.hd }, U);
      return Physics.plane({ sg: s.sg, mode: s.sub, theta: s.theta, shape: s.shape, dims: s.dims[s.shape], orient: s.orient, h1: s.h1, ps: s.ps, both: s.both, sg2: s.sg2, h2: s.h2, hinge: s.hinge }, U);
    },

    /* ------------------------------ 2D --------------------------------- */
    draw2D(svg, res, U, opts) {
      if (this.state.sub === 'curved') return drawCurved(svg, res, U, opts);
      return drawPlane(svg, res, U, opts, this.state);
    },
    draw3D(V, res, U) {
      if (this.state.sub === 'curved') return curved3D(V, res, U);
      return plane3D(V, res, this.state, U);
    },
  };

  /* plane geometry helpers: top edge T at (0, −h1); plate direction down-left; liquid on the upper-left */
  function plateFrame(g) {
    const sn = g.sn, cs = g.cs;
    const dvec = [-cs, -sn];         // down the plate
    const n = [sn, -cs];             // normal, from liquid side onto the plate
    const T = [0, -g.h1];
    const at = (sPos) => [T[0] + dvec[0] * sPos, T[1] + dvec[1] * sPos];
    const wallX = (y) => (y + g.h1) * (cs / sn); // x of the plate line at height y
    return { dvec, n, T, at, wallX };
  }

  function drawPlane(svg, res, U, opts, state) {
    if (!res.ok) { emptyMsg(svg, res); return; }
    const g = res.geo, G = g.G;
    const F = plateFrame(g);
    const B = F.at(G.Lp);
    const yBot = B[1] - Math.max(0.6, G.Lp * 0.25);
    const xL = Math.min(F.wallX(yBot), F.wallX(0)) - Math.max(2.5, G.Lp * 0.9);
    const both = g.both;
    const y2 = both ? -g.h1 + both.h2 : null; // second free surface elevation
    const xR = Math.max(F.wallX(0), F.wallX(yBot)) + Math.max(2.2, G.Lp * 0.9);
    const yTopB = Math.max(0, y2 || 0) + Math.max(0.6, G.Lp * 0.25);
    const D = root.UI.Draw2D(svg, { xmin: xL, xmax: xR, ymin: yBot, ymax: yTopB }, { pad: 46, padR: 210 });
    // liquid 1 polygon (left of the wall)
    const liq1 = [[xL, 0], [F.wallX(0), 0], [F.wallX(yBot), yBot], [xL, yBot]];
    D.poly(liq1, { fill: 'url(#waterGrad)', op: 0.85 });
    if (g.ps > 0) {
      D.poly([[xL, 0], [F.wallX(0), 0], [F.wallX(yTopB * 0.8), yTopB * 0.8], [xL, yTopB * 0.8]], { fill: COL.air });
      D.line([xL, yTopB * 0.8], [F.wallX(yTopB * 0.8), yTopB * 0.8], { stroke: '#2c3e50', sw: 4 });
      D.text([xL + 0.2, yTopB * 0.45], `gas  p_s = ${f(g.ps)} ${U.press}`, { color: '#2c3e50' });
      D.line([xL, g.heq], [F.wallX(0) - 0.05, g.heq], { stroke: COL.waterDark, dash: '6 4', sw: 1 });
      if (g.heq < yTopB * 0.8) D.text([xL + 0.2, g.heq], `imaginary surface (h_eq = ${f(g.heq)} ${U.len})`, { dy: -4, color: COL.waterDark, size: 10.5 });
    }
    if (both) {
      const yy = Math.min(y2, yTopB);
      D.poly([[F.wallX(yy), yy], [xR, yy], [xR, yBot], [F.wallX(yBot), yBot]], { fill: '#7fc6a4', op: 0.75 });
      D.line([F.wallX(yy), yy], [xR, yy], { stroke: '#1e8449', sw: 1.5 });
      D.fs([xR - 0.6, yy], { color: '#1e8449', label: `Sg₂ = ${f(state.sg2)}` });
    }
    // floor and walls
    D.line([xL, yBot], [xR, yBot], { stroke: '#2c3e50', sw: 3 });
    D.line([xL, yBot], [xL, yTopB * 0.8], { stroke: '#2c3e50', sw: 3 });
    D.line([F.wallX(yBot), yBot], [F.wallX(yTopB), yTopB], { stroke: '#2c3e50', sw: 5 });
    D.line([xL, 0], [F.wallX(0), 0], { stroke: COL.waterDark, sw: 1.5 });
    D.fs([xL + (F.wallX(0) - xL) * 0.25, 0], { label: g.ps > 0 ? 'liquid surface' : `Sg = ${f(state.sg)}` });
    // gate
    D.line(F.T, B, { stroke: COL.gate, sw: 8 });
    // pressure diagram on the wetted side
    if (opts.showP) {
      const maxp = Math.max(g.pTop, g.pBot, both ? both.gam2 * (both.h2 + G.Lp * g.sn) : 0) || 1;
      const sp = (Math.min(2.2, G.Lp * 0.7) * 1) / maxp;
      const back = [-F.n[0], -F.n[1]]; // toward liquid 1
      const pT = [F.T[0] + back[0] * g.pTop * sp, F.T[1] + back[1] * g.pTop * sp];
      const pB = [B[0] + back[0] * g.pBot * sp, B[1] + back[1] * g.pBot * sp];
      D.poly([F.T, pT, pB, B], { fill: COL.press, fop: 0.22, stroke: COL.press, sw: 1.2 });
      for (let i = 1; i < 6; i++) {
        const t = i / 6, a = [F.T[0] + (B[0] - F.T[0]) * t, F.T[1] + (B[1] - F.T[1]) * t];
        const pp = g.pTop + (g.pBot - g.pTop) * t;
        D.arrow([a[0] + back[0] * pp * sp, a[1] + back[1] * pp * sp], a, { color: COL.press, w: 1, head: 6 });
      }
      D.text(pT, `${f(g.pTop)} ${U.press}`, { color: COL.press, size: 10.5, anchor: 'end', dx: -4 });
      D.text(pB, `${f(g.pBot)} ${U.press}`, { color: COL.press, size: 10.5, anchor: 'end', dx: -4, dy: 10 });
      if (both) {
        const p2T = both.gam2 * both.h2, p2B = both.gam2 * (both.h2 + G.Lp * g.sn);
        const q = F.n;
        D.poly([F.T, [F.T[0] + q[0] * p2T * sp, F.T[1] + q[1] * p2T * sp], [B[0] + q[0] * p2B * sp, B[1] + q[1] * p2B * sp], B], { fill: '#1e8449', fop: 0.2, stroke: '#1e8449', sw: 1 });
      }
    }
    // CG, CP
    const CG = F.at(g.sCG), CP = F.at(g.sCP);
    D.dot(CG, COL.cg, 'CG', { dx: 10, dy: -6 });
    D.dot(CP, COL.cp, 'CP', { dx: 10, dy: 14 });
    // force
    const fmax = both ? Math.max(g.F, both.F2) : g.F;
    D.force(CP, F.n, 40 + 70 * (g.F / fmax), { color: COL.force, label: `F = ${f(g.F)} ${U.force}`, lp: 'tail', anchor: 'end', ldx: -6 });
    if (both) {
      const CP2 = F.at(both.sCP2);
      D.force(CP2, [-F.n[0], -F.n[1]], 40 + 70 * (both.F2 / fmax), { color: '#1e8449', label: `F₂ = ${f(both.F2)}`, lp: 'tail', ldx: 6 });
      if (isFinite(both.sR) && both.sR >= -G.Lp && both.sR <= 2 * G.Lp) {
        const RP = F.at(both.sR);
        D.force(RP, [F.n[0] * Math.sign(both.Fnet || 1), F.n[1] * Math.sign(both.Fnet || 1)], 60, { color: COL.force2, label: `R = ${f(both.Fnet)}`, lp: 'head', ldx: 8, ldy: 16 });
      }
    }
    // hinge
    if (g.hinge) {
      const Hp = g.hinge.at === 'top' ? F.T : B, Op = g.hinge.at === 'top' ? B : F.T;
      D.el('circle', { cx: D.X(Hp[0]), cy: D.Y(Hp[1]), r: 7, fill: '#fff', stroke: '#2c3e50', 'stroke-width': 2.5 });
      D.text(Hp, 'hinge', { dx: 10, dy: -8, color: '#2c3e50' });
      D.force(Op, [-F.n[0] * Math.sign(g.hinge.P || 1), -F.n[1] * Math.sign(g.hinge.P || 1)], 55, { color: '#2c3e50', label: `P = ${f(g.hinge.P)} ${U.force}`, lp: 'tail', ldx: 6, ldy: -14 });
    }
    // dimensions
    const xd = F.wallX(0) + 0.15;
    const dimX = Math.max(F.wallX(0), F.wallX(yBot)) + 0.4;
    D.dim([dimX, 0], [dimX, F.T[1]], `h₁ = ${f(g.h1)}`, 18);
    D.dim([dimX, 0], [dimX, CG[1]], `h̄ = ${f(g.hbar - g.heq)}`, 92);
    D.dim([dimX, 0], [dimX, CP[1]], `h_p = ${f(g.hp - g.heq)}`, 166);
    D.line([F.wallX(CG[1]), CG[1]], [dimX + 92 / D.sc, CG[1]], { stroke: COL.cg, sw: 0.6, dash: '3 3' });
    D.line([F.wallX(CP[1]), CP[1]], [dimX + 166 / D.sc, CP[1]], { stroke: COL.cp, sw: 0.6, dash: '3 3' });
    D.line([F.wallX(F.T[1]), F.T[1]], [dimX + 18 / D.sc, F.T[1]], { stroke: COL.dim, sw: 0.6, dash: '3 3' });
    if (g.thDeg < 89.9) {
      const bx = F.wallX(yBot);
      D.line([bx, yBot], [bx - 2.5, yBot], { stroke: COL.dim, sw: 0.6 });
      D.arc([bx, yBot], 46, 0, g.thDeg, `θ = ${f(g.thDeg)}°`);
    }
    if (g.thDeg < 89.9) D.dim(F.T, B, `L = ${f(G.Lp)}`, 30);
    // front-view inset
    inset(D, G, g, U);
    void xd;
  }

  function F0(Fp, y) { return Fp.wallX(y); }

  /** Dimension descriptors of the gate in plate coordinates: widths at s and the height. */
  function gateDims(G, state) {
    const d = state.dims[state.shape], u = root.App.U().len, out = [];
    const xs = G.outline.map((p) => p[0]);
    const w0 = Math.min(...xs), w1 = Math.max(...xs);
    switch (state.shape) {
      case 'rect': out.push({ kind: 'w', s: G.Lp, u0: w0, u1: w1, t: `b = ${f(d.b)} ${u}` }, { kind: 'h', t: `h = ${f(d.h)} ${u}` }); break;
      case 'tri': out.push({ kind: 'w', s: state.orient === 'down' ? 0 : G.Lp, u0: w0, u1: w1, t: `b = ${f(d.b)} ${u}` }, { kind: 'h', t: `h = ${f(d.h)} ${u}` }); break;
      case 'circle': out.push({ kind: 'w', s: G.Lp / 2, u0: w0, u1: w1, t: `D = ${f(d.D)} ${u}` }); break;
      case 'semi': out.push({ kind: 'w', s: state.orient === 'bottom' ? G.Lp : 0, u0: w0, u1: w1, t: `2r = ${f(2 * d.r)} ${u}` }, { kind: 'h', t: `r = ${f(d.r)} ${u}` }); break;
      case 'trap': out.push({ kind: 'w', s: 0, u0: -d.a / 2, u1: d.a / 2, t: `a = ${f(d.a)} ${u}` }, { kind: 'w', s: G.Lp, u0: -d.b / 2, u1: d.b / 2, t: `b = ${f(d.b)} ${u}` }, { kind: 'h', t: `h = ${f(d.h)} ${u}` }); break;
    }
    return out;
  }

  function inset(D, G, g, U) {
    const w = 190, hgt = 190, x0 = D.W - w - 12, y0 = 14;
    const grp = D.el('g', {});
    D.el('rect', { x: x0, y: y0, width: w, height: hgt, rx: 8, fill: '#fff', stroke: '#cfd6de' }, grp);
    D.text([x0 + 8, y0 + 16], 'Front view (true shape)', { px: true, size: 11, color: '#566' }, grp);
    const xs = G.outline.map((p) => p[0]), ys = G.outline.map((p) => p[1]);
    const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
    const sc = Math.min((w - 84) / bw, (hgt - 70) / bh);
    const cx = x0 + w / 2 + 22, cy = y0 + 34;
    const pts = G.outline.map((p) => `${cx + p[0] * sc},${cy + p[1] * sc}`).join(' ');
    D.el('polygon', { points: pts, fill: COL.gate, 'fill-opacity': 0.35, stroke: COL.gate, 'stroke-width': 2 }, grp);
    D.el('line', { x1: cx, y1: cy - 4, x2: cx, y2: cy + bh * sc + 4, stroke: '#999', 'stroke-dasharray': '4 3' }, grp);
    D.el('circle', { cx, cy: cy + g.sCG * sc, r: 4, fill: COL.cg }, grp);
    D.el('circle', { cx, cy: cy + g.sCP * sc, r: 4, fill: COL.cp }, grp);
    D.text([cx + 6, cy + g.sCG * sc - 2], 'CG', { px: true, size: 10, color: COL.cg }, grp);
    D.text([cx + 6, cy + g.sCP * sc + 10], 'CP', { px: true, size: 10, color: COL.cp }, grp);
    D.text([x0 + 8, y0 + hgt - 8], `A = ${f(G.A)} ${U.area}`, { px: true, size: 10.5, color: '#333' }, grp);
    // gate dimensions in the inset (pixel space)
    const st = root.M1.state;
    gateDims(G, st).forEach((dm) => {
      if (dm.kind === 'w') {
        const yy = cy + dm.s * sc + (dm.s > G.Lp / 2 ? 9 : -9);
        dimPx(D, grp, [cx + dm.u0 * sc, yy], [cx + dm.u1 * sc, yy], dm.t, dm.s > G.Lp / 2 ? 11 : -3);
      } else {
        const xx = cx + Math.min(...G.outline.map((p) => p[0])) * sc - 9;
        dimPx(D, grp, [xx, cy], [xx, cy + bh * sc], dm.t, 0, true);
      }
    });
  }
  function dimPx(D, grp, a, b, t, dy, vert) {
    const c = COL.dim;
    D.lineP(a, b, { stroke: c, sw: 1 }, grp);
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, hs = Math.min(6, L / 3);
    D.head(b[0], b[1], ux, uy, c, hs, grp); D.head(a[0], a[1], -ux, -uy, c, hs, grp);
    if (vert) D.text([a[0] - 3, (a[1] + b[1]) / 2], t, { px: true, size: 10, color: c, anchor: 'end', dy: 3 }, grp);
    else D.text([(a[0] + b[0]) / 2, a[1]], t, { px: true, size: 10, color: c, anchor: 'middle', dy }, grp);
  }

  function emptyMsg(svg, res) {
    const D = root.UI.Draw2D(svg, { xmin: 0, xmax: 1, ymin: 0, ymax: 1 });
    D.text([D.W / 2, D.H / 2], '⚠ ' + (res.err && res.err[0] ? res.err[0].slice(0, 90) : 'Invalid input'), { px: true, anchor: 'middle', color: '#c0392b', size: 14 });
  }
  M1.emptyMsg = emptyMsg;

  function arcPts(R, a0, a1, n, cx = 0, cy = 0) {
    const out = [];
    for (let i = 0; i <= n; i++) { const t = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; out.push([cx + R * Math.cos(t), cy + R * Math.sin(t)]); }
    return out;
  }

  /** Geometry polygons for the curved surface. */
  function curvedGeom(g) {
    const R = g.R, hd = g.hd, Wd = 1.3 * R, yFS = g.yFS;
    let liquid, solid, arc, prism, extra = [];
    if (g.type === 'quarter') {
      arc = arcPts(R, 0, -90, 40); // (R,0) → (0,−R)
      if (g.side === 'concave') {
        liquid = [[-Wd, yFS], [R, yFS], ...arc, [-Wd, -R]];
        solid = [[R, 0], [R, yFS + 0.3 * R], [R + 0.25 * R, yFS + 0.3 * R], [R + 0.25 * R, -R - 0.25 * R], [-Wd, -R - 0.25 * R], [-Wd, -R], [0, -R], ...arcPts(R, -90, 0, 40)];
      } else {
        const fl = -R - 0.6 * R;
        liquid = [[R, yFS], [R + Wd, yFS], [R + Wd, fl], [-Wd * 0.6, fl], [-Wd * 0.6, -R], [0, -R], ...arcPts(R, -90, 0, 40)];
        solid = [[-Wd * 0.6, -R], [0, -R], ...arcPts(R, -90, 0, 40), [R, yFS + 0.3 * R], [-Wd * 0.6, yFS + 0.3 * R]];
      }
      prism = [[0, yFS], [R, yFS], [R, 0], ...arcPts(R, 0, -90, 40), [0, -R]];
    } else if (g.type === 'semi') {
      arc = arcPts(R, 90, -90, 60);
      if (g.side === 'concave') {
        liquid = [[-Wd, yFS], [0, yFS], [0, R], ...arc, [-Wd, -R]];
        solid = [[0, R], [0.18 * R, R], [0.18 * R, yFS + 0.3 * R], [0, yFS + 0.3 * R]];
        extra.push([[-Wd, -R], [0, -R], [0, -R - 0.2 * R], [-Wd, -R - 0.2 * R]]);
      } else {
        liquid = [[0, yFS], [R + Wd, yFS], [R + Wd, -R], [0, -R], ...arcPts(R, -90, 90, 60)];
        solid = [[0, yFS + 0.3 * R], [0, R], ...arcPts(R, 90, -90, 60), [0, -R], [-0.4 * R, -R], [-0.4 * R, yFS + 0.3 * R]];
        extra.push([[-0.4 * R, -R], [R + Wd, -R], [R + Wd, -R - 0.2 * R], [-0.4 * R, -R - 0.2 * R]]);
      }
      prism = [[0, R], ...arcPts(R, 90, -90, 60)];
    } else {
      arc = arcPts(R, 90, 270, 60);
      liquid = [[-R - Wd, yFS], [0, yFS], [0, R], ...arcPts(R, 90, 270, 60), [-R - Wd, -R]];
      solid = arcPts(R, 0, 360, 80);
      extra.push([[-R - Wd, -R], [R + Wd * 0.6, -R], [R + Wd * 0.6, -R - 0.2 * R], [-R - Wd, -R - 0.2 * R]]);
      if (hd > 0) extra.push([[0, R], [0.08 * R, R], [0.08 * R, yFS + 0.3 * R], [0, yFS + 0.3 * R]]);
      prism = [[0, R], ...arcPts(R, 90, 270, 60)];
    }
    return { liquid, solid, arc, prism, extra };
  }

  function drawCurved(svg, res, U, opts) {
    if (!res.ok) { emptyMsg(svg, res); return; }
    const g = res.geo, R = g.R;
    const cg = curvedGeom(g);
    const all = [...cg.liquid, ...cg.solid, ...cg.extra.flat()];
    const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
    const D = root.UI.Draw2D(svg, { xmin: Math.min(...xs) - 0.2 * R, xmax: Math.max(...xs) + 0.9 * R, ymin: Math.min(...ys), ymax: Math.max(...ys) + 0.2 * R }, { pad: 48 });
    D.poly(cg.liquid, { fill: 'url(#waterGrad)', op: 0.85 });
    D.poly(cg.solid, { fill: 'url(#hatch)', stroke: '#566', sw: 1 });
    cg.extra.forEach((p) => D.poly(p, { fill: 'url(#hatch)', stroke: '#566', sw: 1 }));
    // pressure prism
    D.poly(cg.prism, { fill: 'url(#hatchPrism)', stroke: COL.meta, sw: 1.4, dash: g.vDown ? null : '6 4' });
    const pc = cg.prism.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]).map((v) => v / cg.prism.length);
    D.text([pc[0], g.yFS], 'Pressure prism: ' + (g.vDown ? 'REAL liquid above (F_V ↓)' : 'IMAGINARY liquid above (F_V ↑)'), { color: COL.meta, anchor: 'middle', size: 11.5, dy: -10 });
    if (g.type !== 'quarter') D.text([pc[0], g.yFS], 'net prism = half circle', { color: COL.meta, anchor: 'middle', size: 10.5, dy: -26 });
    D.pline(cg.arc, { stroke: COL.gate, sw: 7 });
    // free surface
    const fsx = [Math.min(...cg.liquid.map((p) => p[0])), Math.max(...cg.liquid.map((p) => p[0]))];
    D.line([fsx[0], g.yFS], [fsx[1], g.yFS], { stroke: COL.waterDark, sw: 1.5 });
    D.fs([fsx[0] + (fsx[1] - fsx[0]) * 0.18, g.yFS], { label: `Sg = ${f(res.geo.gam / U.gw)}` });
    // radial pressure arrows
    if (opts.showP) {
      const pmax = g.gam * (g.yFS - (g.yTop - g.Hp));
      cg.arc.forEach((p, i) => {
        if (i % 5) return;
        const dep = g.yFS - p[1], pr = g.gam * dep;
        const len = (0.7 * R * pr) / pmax;
        const nrm = [p[0] / R, p[1] / R]; // outward normal from centre
        const into = g.type === 'full' || g.side === 'convex' ? [-nrm[0], -nrm[1]] : nrm; // pressure direction onto surface
        D.arrow([p[0] - into[0] * len, p[1] - into[1] * len], p, { color: COL.press, w: 1, head: 6 });
      });
    }
    // centre
    D.dot([0, 0], '#2c3e50', 'O', { r: 3.5, dx: -14, dy: -6 });
    // forces
    const Fm = g.Rres || 1;
    const yH = g.yFS - g.hpH;
    const sgnH = g.hRight ? 1 : -1;
    const xHat = g.type === 'full' ? -Math.sqrt(Math.max(0, R * R - yH * yH)) : Math.sqrt(Math.max(0, R * R - yH * yH));
    D.force([xHat, yH], [sgnH, 0], 30 + 80 * (g.FH / Fm), { color: COL.force, label: `F_H = ${f(g.FH)} ${U.force}`, lp: 'tail', anchor: sgnH > 0 ? 'end' : 'start', ldx: sgnH > 0 ? -4 : 4 });
    const yVhat = g.type === 'quarter' ? -Math.sqrt(Math.max(0, R * R - g.xV * g.xV)) : (g.type === 'semi' ? (g.vDown ? -1 : 1) : -1) * Math.sqrt(Math.max(0, R * R - g.xV * g.xV));
    D.force([g.xV, yVhat], [0, g.vDown ? -1 : 1], 30 + 80 * (g.FV / Fm), { color: COL.force2, label: `F_V = ${f(g.FV)} ${U.force}`, lp: 'tail', ldx: 6 });
    D.line([g.xV, g.yFS], [g.xV, yVhat], { stroke: COL.force2, sw: 0.8, dash: '4 3' });
    // resultant through O
    const dir = [sgnH * g.FH, (g.vDown ? -1 : 1) * g.FV];
    const l = Math.hypot(dir[0], dir[1]) || 1;
    const u = [dir[0] / l, dir[1] / l];
    const hit = [u[0] * R, u[1] * R];
    const s2 = g.type === 'full' || g.side === 'convex' ? -1 : 1;
    const head = s2 > 0 ? hit : [0 + u[0] * 0.0, 0];
    if (s2 > 0) {
      D.line([0, 0], hit, { stroke: '#d35400', sw: 1, dash: '5 4' });
      D.force(hit, u, 90, { color: '#d35400', label: `R = ${f(g.Rres)} ${U.force} @ ${f(g.ang)}°`, lp: 'head', ldx: 10, ldy: 16 });
    } else {
      const surf = [-u[0] * R, -u[1] * R];
      D.line(surf, [u[0] * R * 0.4, u[1] * R * 0.4], { stroke: '#d35400', sw: 1, dash: '5 4' });
      D.force([0, 0], u, 90, { color: '#d35400', label: `R = ${f(g.Rres)} ${U.force} @ ${f(g.ang)}°`, lp: 'tail', ldx: 6, ldy: -8 });
      void surf;
    }
    void head;
    // dims
    const xr = Math.max(...xs) + 0.35 * R;
    D.dim([xr, g.yFS], [xr, yH], `h_p = ${f(g.hpH)}`, -10, { ldx: 6, anchor: 'start' });
    if (g.hd > 0) D.dim([xr + 0.35 * R, g.yFS], [xr + 0.35 * R, g.yTop], `h = ${f(g.hd)}`, -10, { ldx: 6, anchor: 'start' });
    const ra = ((g.type === 'full' ? 200 : g.type === 'semi' ? 30 : -12) * Math.PI) / 180;
    D.dim([0, 0], [R * Math.cos(ra), R * Math.sin(ra)], `R = ${f(R)}`, 0, { ldy: -6, ldx: 0 });
    D.line([xHat, yH], [xr, yH], { stroke: COL.force, sw: 0.6, dash: '3 3' });
  }

  /* ------------------------------ 3D --------------------------------- */
  function plane3D(V, res, state, U) {
    if (!res.ok) return;
    const g = res.geo, G = g.G, Fp = plateFrame(g);
    const B = Fp.at(G.Lp);
    const yBot = B[1] - Math.max(0.6, G.Lp * 0.25);
    const xL = Math.min(Fp.wallX(yBot), Fp.wallX(0)) - Math.max(2.5, G.Lp * 0.9);
    const gw = Math.max(...G.outline.map((p) => Math.abs(p[0]))) * 2;
    const Wz = Math.max(gw * 1.8, 2.5);
    const yTop = Math.max(0.6, G.Lp * 0.3);
    // liquid
    const liq = [[xL, 0], [Fp.wallX(0), 0], [Fp.wallX(yBot), yBot], [xL, yBot]];
    V.extrude(liq, 0, Wz, '#4aa3df', 0.28, '#1f6fa8');
    if (g.both) {
      const y2 = -g.h1 + g.both.h2, xR = Fp.wallX(yBot) + 2;
      V.extrude([[Fp.wallX(y2), y2], [xR, y2], [xR, yBot], [Fp.wallX(yBot), yBot]], 0, Wz, '#58b88a', 0.25, '#1e8449');
    }
    // tank shell (floor, back wall, side panes)
    const tankPoly = [[xL, yTop], [xL, yBot], [Fp.wallX(yBot), yBot], [Fp.wallX(yTop), yTop]];
    V.face([[xL, yBot, 0], [Fp.wallX(yBot), yBot, 0], [Fp.wallX(yBot), yBot, Wz], [xL, yBot, Wz]], '#95a5a6', 0.5, '#555');
    V.face([[xL, yBot, 0], [xL, yTop, 0], [xL, yTop, Wz], [xL, yBot, Wz]], '#bdc3c7', 0.25, '#555');
    V.face(tankPoly.map((p) => [p[0], p[1], 0]), '#ecf0f1', 0.12, '#777');
    // inclined/vertical wall
    const wall = [[Fp.wallX(yBot), yBot, 0], [Fp.wallX(yTop), yTop, 0], [Fp.wallX(yTop), yTop, Wz], [Fp.wallX(yBot), yBot, Wz]];
    V.face(wall, '#7f8c8d', 0.35, '#444');
    // gate panel on the wall (true shape)
    const off = 0.01;
    const gate = G.outline.map(([u, sPos]) => { const p = Fp.at(sPos); return [p[0] + Fp.n[0] * off, p[1] + Fp.n[1] * off, Wz / 2 + u]; });
    V.face(gate, '#e67e22', 0.95, '#a04000', 2);
    // surface outline
    V.line([[xL, 0, 0], [Fp.wallX(0), 0, 0], [Fp.wallX(0), 0, Wz], [xL, 0, Wz], [xL, 0, 0]], '#1f6fa8', 2);
    if (g.ps > 0) V.box(xL, yTop, 0, Fp.wallX(yTop), yTop + 0.05, Wz, '#2c3e50', 0.35, '#2c3e50');
    const CG = Fp.at(g.sCG), CP = Fp.at(g.sCP);
    V.label([CG[0], CG[1], Wz / 2], 'CG', '#16a085');
    V.label([CP[0], CP[1], Wz / 2], 'CP', '#c0392b');
    const L = 1.2;
    V.line([[CP[0] - Fp.n[0] * L, CP[1] - Fp.n[1] * L, Wz / 2], [CP[0], CP[1], Wz / 2]], '#c0392b', 3);
    V.label([CP[0] - Fp.n[0] * L, CP[1] - Fp.n[1] * L, Wz / 2], `F = ${f(g.F)}`, '#c0392b');
    // dimensions
    const u = U.len, us = G.outline.map((p) => p[0]);
    const umin = Math.min(...us), umax = Math.max(...us);
    const zc = Wz / 2, gap = Math.max(0.35, 0.12 * G.Lp);
    const dn = [Fp.dvec[0] * gap, Fp.dvec[1] * gap, 0];
    const at3 = (sPos, z) => { const p = Fp.at(sPos); return [p[0] + Fp.n[0] * 0.02, p[1] + Fp.n[1] * 0.02, z]; };
    gateDims(G, state).forEach((dm) => {
      if (dm.kind === 'w') V.dim(at3(dm.s, zc + dm.u0), at3(dm.s, zc + dm.u1), dm.t, dm.s > G.Lp / 2 ? dn : [-dn[0], -dn[1], 0]);
      else V.dim(at3(0, zc + umax), at3(G.Lp, zc + umax), dm.t, [0, 0, gap + (Wz / 2 - umax) * 0.4]);
    });
    const zf = Wz + gap;
    V.dim([F0(Fp, 0), 0, Wz], [F0(Fp, 0), -g.h1, Wz], `h₁ = ${f(g.h1)} ${u}`, [0, 0, gap]);
    V.dim([CP[0], 0, Wz], [CP[0], CP[1], Wz], `h_p = ${f(g.hp - g.heq)} ${u}`, [0, 0, 2.2 * gap]);
    V.dim([xL, yBot, Wz], [Fp.wallX(yBot), yBot, Wz], `${f(Fp.wallX(yBot) - xL)} ${u}`, [0, -gap * 0.8, 0]);
    void zf; void umin;
    V.autoBounds();
  }

  function curved3D(V, res, U) {
    if (!res.ok) return;
    const g = res.geo, cg = curvedGeom(g), Lz = Math.max(g.W, 0.4 * g.R);
    V.extrude(cg.liquid, 0, Lz, '#4aa3df', 0.25, null, { sideStroke: null });
    V.extrude(cg.solid, 0, Lz, '#aab3bd', 0.55, null);
    cg.extra.forEach((p) => V.extrude(p, 0, Lz, '#aab3bd', 0.55, null));
    V.extrude(cg.arc, 0, Lz, '#e67e22', 0.95, null, { caps: false, open: true });
    V.line(cg.arc.map((p) => [p[0], p[1], 0]), '#a04000', 2);
    V.line(cg.arc.map((p) => [p[0], p[1], Lz]), '#a04000', 2);
    const xs = cg.liquid.map((p) => p[0]);
    V.line([[Math.min(...xs), g.yFS, 0], [Math.max(...xs), g.yFS, 0], [Math.max(...xs), g.yFS, Lz], [Math.min(...xs), g.yFS, Lz], [Math.min(...xs), g.yFS, 0]], '#1f6fa8', 2);
    V.label([0, 0, Lz], 'O');
    const u = U.len, gap = 0.3 * g.R;
    const ra = ((g.type === 'full' ? 200 : g.type === 'semi' ? 30 : -12) * Math.PI) / 180;
    V.dim([0, 0, Lz], [g.R * Math.cos(ra), g.R * Math.sin(ra), Lz], `R = ${f(g.R)} ${u}`, [0, 0, 0]);
    const bx = g.type === 'quarter' ? 0 : g.type === 'semi' ? 0 : 0;
    V.dim([bx, -g.R, 0], [bx, -g.R, Lz], `L = ${f(g.W)} ${u}`, [0, -gap, 0]);
    const xr = Math.max(...xs, ...cg.solid.map((p) => p[0])); // keep the depth dimension outside the gate and its support
    V.dim([xr, g.yFS, Lz], [xr, g.yTop - g.Hp, Lz], `depth ${f(g.hd + g.Hp)} ${u}`, [gap, 0, 0]);
    if (g.hd > 0) V.dim([xr, g.yFS, Lz], [xr, g.yTop, Lz], `h = ${f(g.hd)} ${u}`, [2.2 * gap, 0, 0]);
    V.autoBounds();
  }

  root.M1 = M1;
})(window);
