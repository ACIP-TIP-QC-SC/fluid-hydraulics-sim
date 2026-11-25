/* =====================================================================
 * STEP 3 — Stresses in Soil (UI, diagrams, charts, 3D)
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Physics } = root;
  const G = root.GeoUI;
  const f = Physics.fmt;
  const BULB = '#c0392b', LOAD = '#e67e22', PT = '#16a085', SPREAD = '#27ae60';

  const GStress = {
    id: 'stress', title: 'Stresses in Soil',
    state: {
      type: 'rect',
      points: [{ Q: 500, x: 0, y: 0 }],
      line: { q: 100, x: 0, two: false, q2: 80, x2: 4 },
      strip: { q: 150, B: 3 },
      circle: { q: 120, R: 1.5 },
      rects: [{ B: 2, L: 3, x: 0, y: 0, q: 150 }],
      xP: 0, yP: 0, zP: 3, zMax: 10, avg: false, z1: 2, z2: 6,
      pm: 'bous', mu: 0, find: 'stress', tBy: 'frac', ratio: 12.5, target: 10,
    },
    presets: [
      { name: 'Test T1 — point load Q = 1000 kN, directly below at z = 2 m (Δσz = 119.4 kPa)', apply: (s) => Object.assign(s, { pm: 'bous', find: 'stress', type: 'point', points: [{ Q: 1000, x: 0, y: 0 }], xP: 0, yP: 0, zP: 2, zMax: 8, avg: false }) },
      { name: 'Three point loads (500, 300, 400 kN) and a point between them', apply: (s) => Object.assign(s, { pm: 'bous', find: 'stress', type: 'point', points: [{ Q: 500, x: 0, y: 0 }, { Q: 300, x: 3, y: 0 }, { Q: 400, x: 1.5, y: 2.5 }], xP: 1.5, yP: 1, zP: 2.5, zMax: 8, avg: false }) },
      { name: 'Line load 100 kN/m, point 2 m aside at 3 m depth', apply: (s) => Object.assign(s, { pm: 'bous', find: 'stress', type: 'line', line: { q: 100, x: 0, two: false, q2: 80, x2: 4 }, xP: 2, yP: 0, zP: 3, zMax: 8, avg: false }) },
      { name: 'Test T2 — strip B = 2 m, q = 100 kPa, below the centre at z = 2 m (Δσz = 54.98 kPa)', apply: (s) => Object.assign(s, { pm: 'bous', find: 'stress', type: 'strip', strip: { q: 100, B: 2 }, xP: 0, yP: 0, zP: 2, zMax: 8, avg: false }) },
      { name: 'Test T3 — circle R = 1.5 m, q = 100 kPa, centre z = 3 m (Δσz = 28.45 kPa)', apply: (s) => Object.assign(s, { pm: 'bous', find: 'stress', type: 'circle', circle: { q: 100, R: 1.5 }, xP: 0, yP: 0, zP: 3, zMax: 8, avg: false }) },
      { name: 'Circular tank R = 6 m, q = 120 kPa, below the edge at 4 m', apply: (s) => Object.assign(s, { pm: 'bous', find: 'stress', type: 'circle', circle: { q: 120, R: 6 }, xP: 6, yP: 0, zP: 4, zMax: 24, avg: false }) },
      { name: 'Test T4 — rectangle 2 × 3 m, q = 150 kPa, below a corner at z = 3 m (I = 0.1451, Δσz = 21.76 kPa)', apply: (s) => Object.assign(s, { pm: 'bous', find: 'stress', type: 'rect', rects: [{ B: 2, L: 3, x: 1, y: 1.5, q: 150 }], xP: 0, yP: 0, zP: 3, zMax: 10, avg: false }) },
      { name: 'Footing 3 × 3 m, 200 kPa: centre, with the 2:1 method and the average in a clay layer 2–6 m', apply: (s) => Object.assign(s, { pm: 'bous', find: 'stress', type: 'rect', rects: [{ B: 3, L: 3, x: 0, y: 0, q: 200 }], xP: 0, yP: 0, zP: 4, zMax: 12, avg: true, z1: 2, z2: 6 }) },
      { name: 'L-shaped footprint (two rectangles), point outside the footing', apply: (s) => Object.assign(s, { pm: 'bous', find: 'stress', type: 'rect', rects: [{ B: 6, L: 2, x: 0, y: 0, q: 120 }, { B: 2, L: 4, x: -2, y: 3, q: 120 }], xP: 2, yP: 3, zP: 3, zMax: 12, avg: false }) },
      { name: 'CE Ref 5 May 2022 #45–47 — Westergaard Q = 2.5 MN: 2 m below (198.8 kPa), 4 m below (49.7 kPa); set x_P = 3 m, z = 6 m for #47 (12.02 kPa)', apply: (s) => Object.assign(s, { xP: 0, yP: 0, avg: false, z1: 2, z2: 6, mu: 0, tBy: 'frac', target: 10, type: 'point', points: [{ Q: 2500, x: 0, y: 0 }], pm: 'west', find: 'stress', ratio: 12.5, zP: 2, zMax: 10 }) },
      { name: 'CE Ref 5 Nov 2021 #35 — tunnel under Q = 10,000 kN at z = 10 m: offset where Δσz is 5 % of the value below (r = 15.21 m)', apply: (s) => Object.assign(s, { xP: 0, yP: 0, avg: false, z1: 2, z2: 6, mu: 0, tBy: 'frac', target: 10, type: 'point', points: [{ Q: 10000, x: 0, y: 0 }], pm: 'bous', find: 'offset', ratio: 5, zP: 10, zMax: 20 }) },
      { name: 'CE Ref 5 Nov 2021 #48–50 — circular footing D = 4 m, P = 1800 kN: q = 143.24 kPa, 20.94 kPa at 6 m, depth for q/10 = 7.414 m', apply: (s) => Object.assign(s, { xP: 0, yP: 0, avg: false, z1: 2, z2: 6, mu: 0, tBy: 'frac', target: 10, type: 'circle', circle: { q: 143.24, R: 2, byP: true, P: 1800 }, find: 'depth', ratio: 10, zP: 6, zMax: 16 }) },
      { name: 'CE Ref 6 Apr 2025 #25 — circular footing D = 6 m: depth where Δσz = 1/8 of the base pressure (9.83 m)', apply: (s) => Object.assign(s, { xP: 0, yP: 0, avg: false, z1: 2, z2: 6, mu: 0, tBy: 'frac', target: 10, type: 'circle', circle: { q: 100, R: 3, byP: false, P: 2827.4 }, find: 'depth', ratio: 12.5, zP: 3, zMax: 20 }) },
      { name: 'English units: footing 10 × 10 ft, 3000 psf, centre at 10 ft', units: 'EN', apply: (s) => Object.assign(s, { pm: 'bous', find: 'stress', type: 'rect', rects: [{ B: 10, L: 10, x: 0, y: 0, q: 3000 }], xP: 0, yP: 0, zP: 10, zMax: 35, avg: false }) },
    ],
    legend: [[BULB, 'pressure bulb (Δσz / q)', 'ln'], [LOAD, 'surface load', 'sq'], [SPREAD, '2:1 spread', 'ln'], [PT, 'point P']],
    toggle: 'Pressure bulb',
    plotCaption: 'Stress increase versus depth',
    hint: 'Click the 2D section to move point P (x and depth).',

    controls(el, C) {
      const s = this.state, U = root.App.U(), en = U.id === 'EN';
      C.seg(el, { label: 'Load type', options: [['point', 'Point loads'], ['line', 'Line load'], ['strip', 'Strip'], ['circle', 'Circle'], ['rect', 'Rectangles (composite)']], get: () => s.type, set: (v) => (s.type = v) });
      const g = C.section(el, 'Surface load');
      const sl = (p, o, k, label, min, max, step, unit) => C.slider(p, { label, min, max, step, get: () => o[k], set: (v) => (o[k] = v), unit });
      const qmax = en ? 20000 : 1000, Lmax = en ? 100 : 30;
      if (s.type === 'point') {
        C.layers(g, { layers: s.points, max: 4, soil: false, add: '+ Add load', title: (i) => `Load ${i + 1}`, fields: [{ k: 'Q', label: 'Q', unit: U.force }, { k: 'x', label: 'x', unit: U.len }, { k: 'y', label: 'y', unit: U.len }], make: (ls) => ({ Q: en ? 50000 : 200, x: (ls.length) * (en ? 6 : 2), y: 0 }) });
        C.note(g, 'Plan coordinates x, y of each load; the 2D section is taken through point P (y = y_P).');
        C.seg(g, { label: 'Point-load theory', options: [['bous', 'Boussinesq'], ['west', 'Westergaard']], get: () => s.pm, set: (v) => (s.pm = v) });
        if (s.pm === 'west') { sl(g, s, 'mu', 'Poisson ratio μ of the soil', 0, 0.49, 0.01, ''); C.note(g, 'Westergaard (layered soil with thin rigid sheets). μ = 0 is the usual textbook case: Δσz = Q / (πz²) · 1/[1 + 2(r/z)²]^1.5.'); }
      } else if (s.type === 'line') {
        sl(g, s.line, 'q', 'Line load q (per unit length)', 1, en ? 20000 : 1000, 0.1, U.fpl);
        sl(g, s.line, 'x', 'Position of the line x', -Lmax, Lmax, 0.01, U.len);
        C.toggle(g, { label: 'Second parallel line load', get: () => s.line.two, set: (v) => (s.line.two = v) });
        if (s.line.two) { sl(g, s.line, 'q2', 'Second line load q₂', 1, en ? 20000 : 1000, 0.1, U.fpl); sl(g, s.line, 'x2', 'Position x₂', -Lmax, Lmax, 0.01, U.len); }
      } else if (s.type === 'strip') {
        sl(g, s.strip, 'B', 'Strip width B', 0.1, Lmax, 0.01, U.len);
        sl(g, s.strip, 'q', 'Uniform pressure q', 1, qmax, 0.1, U.press);
      } else if (s.type === 'circle') {
        sl(g, s.circle, 'R', 'Radius R', 0.1, Lmax, 0.01, U.len);
        C.toggle(g, { label: 'Load given as a total force P (q = P / area)', get: () => !!s.circle.byP, set: (v) => { s.circle.byP = v; if (v && !(s.circle.P > 0)) s.circle.P = +(s.circle.q * Math.PI * s.circle.R * s.circle.R).toFixed(1); } });
        if (s.circle.byP) sl(g, s.circle, 'P', 'Total load P', 1, en ? 2e6 : 1e5, 0.1, U.force);
        else sl(g, s.circle, 'q', 'Uniform pressure q', 1, qmax, 0.1, U.press);
      } else {
        C.layers(g, { layers: s.rects, max: 3, soil: false, add: '+ Add rectangle', title: (i) => `Rectangle ${i + 1}`, fields: [{ k: 'B', label: 'B (along x)', unit: U.len }, { k: 'L', label: 'L (along y)', unit: U.len }, { k: 'x', label: 'centre x', unit: U.len }, { k: 'y', label: 'centre y', unit: U.len }, { k: 'q', label: 'q', unit: U.press }], make: (ls) => { const l = ls[ls.length - 1]; return { B: l.B, L: l.L, x: l.x + l.B, y: l.y, q: l.q }; } });
        C.note(g, 'Several rectangles make an L, T or U footprint; each may carry its own q. The stress is found by superposition of corner influence factors.');
      }
      const p = C.section(el, 'Point P');
      if (s.type !== 'line' && s.type !== 'strip') sl(p, s, 'yP', 'y_P (plan, across the section)', -Lmax, Lmax, 0.01, U.len);
      sl(p, s, 'xP', 'x_P (plan, along the section)', -Lmax, Lmax, 0.01, U.len);
      sl(p, s, 'zP', 'Depth z', 0.01, en ? 150 : 50, 0.01, U.len);
      const fd = C.section(el, 'What to find');
      const fopts = [['stress', 'Δσz at point P'], ['depth', 'Depth for a given Δσz']];
      if (s.type === 'point' || s.type === 'line') fopts.push(['offset', 'Offset for a % of the stress below']);
      if (s.find === 'offset' && s.type !== 'point' && s.type !== 'line') s.find = 'stress';
      C.seg(fd, { label: 'Find', options: fopts, get: () => s.find, set: (v) => (s.find = v) });
      if (s.find === 'depth') {
        if (s.type === 'point' || s.type === 'line') s.tBy = 'abs';
        else C.seg(fd, { label: 'Target given as', options: [['frac', '% of surface q'], ['abs', 'Stress value']], get: () => s.tBy, set: (v) => (s.tBy = v) });
        if (s.tBy === 'abs') sl(fd, s, 'target', 'Target Δσz', 0.01, qmax, 0.01, U.press);
        else sl(fd, s, 'ratio', 'Target Δσz as % of q (e.g. 1/8 = 12.5 %)', 0.1, 99.9, 0.1, '%');
        C.note(fd, 'Searches downward below point P (x_P, y_P) for the depth where the stress increase equals the target.');
      } else if (s.find === 'offset') {
        sl(fd, s, 'ratio', 'Stress as % of the value directly below the load', 0.1, 99.9, 0.1, '%');
        C.note(fd, 'Uses depth z of point P; gives the horizontal distance from the (first) load where Δσz drops to this percentage.');
      }
      const o = C.section(el, 'Depth range and layer average');
      sl(o, s, 'zMax', 'Depth shown in the section and chart', 1, en ? 200 : 60, 0.1, U.len);
      C.toggle(o, { label: 'Average increase in a layer (e.g. a clay layer)', get: () => s.avg, set: (v) => (s.avg = v) });
      if (s.avg) { sl(o, s, 'z1', 'Top of layer z₁', 0, en ? 150 : 50, 0.01, U.len); sl(o, s, 'z2', 'Bottom of layer z₂', 0.1, en ? 200 : 60, 0.01, U.len); }
    },
    compute(U) { return Physics.soilStress(this.state, U); },
    onClick(pt, res) {
      if (pt[1] > 0) return false;
      this.state.xP = +pt[0].toFixed(2); this.state.zP = Math.max(0.01, +(-pt[1]).toFixed(2));
      return true;
    },

    extent() {
      const s = this.state;
      if (s.type === 'point') { const xs = s.points.map((q) => q.x), ys = s.points.map((q) => q.y); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; }
      if (s.type === 'line') return { x0: Math.min(s.line.x, s.line.two ? s.line.x2 : s.line.x), x1: Math.max(s.line.x, s.line.two ? s.line.x2 : s.line.x), y0: -1, y1: 1 };
      if (s.type === 'strip') return { x0: -s.strip.B / 2, x1: s.strip.B / 2, y0: -1, y1: 1 };
      if (s.type === 'circle') return { x0: -s.circle.R, x1: s.circle.R, y0: -s.circle.R, y1: s.circle.R };
      return { x0: Math.min(...s.rects.map((r) => r.x - r.B / 2)), x1: Math.max(...s.rects.map((r) => r.x + r.B / 2)), y0: Math.min(...s.rects.map((r) => r.y - r.L / 2)), y1: Math.max(...s.rects.map((r) => r.y + r.L / 2)) };
    },

    draw2D(svg, res, U, opts) {
      const s = this.state, g = res.geo, LS = g.LS;
      const zM = Math.max(s.zMax, s.zP * 1.1);
      const e = this.extent();
      const xc = 0.5 * (e.x0 + e.x1), hw = Math.max(0.5 * (e.x1 - e.x0) + 0.55 * zM, Math.abs(s.xP - xc) + 0.15 * zM);
      const xa = xc - hw, xb = xc + hw, top = 0.16 * zM;
      const D = root.UI.Draw2D(svg, { xmin: xa, xmax: xb, ymin: -zM * 1.03, ymax: top }, { pad: 40 });
      G.soilDefs(svg);
      D.poly([[xa, 0], [xb, 0], [xb, -zM], [xa, -zM]], { fill: '#f3e7c4' });
      D.poly([[xa, 0], [xb, 0], [xb, -zM], [xa, -zM]], { fill: G.soilFill('sand'), op: 0.3 });
      D.line([xa, 0], [xb, 0], { stroke: '#2c3e50', sw: 2 });
      // pressure bulb
      if (opts.showP !== false) {
        const grid = Physics.bulbGrid(LS, xa, xb, zM, s.yP, 90, 60);
        const ref = g.qRef || g.ds;
        const levels = g.qRef ? [0.9, 0.7, 0.5, 0.3, 0.2, 0.1, 0.05] : [4, 2, 1, 0.5, 0.25];
        levels.forEach((lv, li) => {
          const segs = Physics.contour(grid, lv * ref);
          if (!segs.length) return;
          let d = '', low = null;
          segs.forEach((q) => { d += `M${D.X(q[0]).toFixed(1)},${D.Y(q[1]).toFixed(1)}L${D.X(q[2]).toFixed(1)},${D.Y(q[3]).toFixed(1)}`; [[q[0], q[1]], [q[2], q[3]]].forEach((pp) => { if (!low || pp[1] < low[1]) low = pp; }); });
          D.el('path', { d, stroke: BULB, 'stroke-width': 1.4, fill: 'none', opacity: 0.35 + 0.6 * (1 - li / levels.length) });
          if (low) D.text(low, g.qRef ? `${lv}q` : `${f(lv * ref, 3)}`, { anchor: 'middle', dy: 12, size: 10, color: BULB });
        });
      }
      // 2:1 spread
      if (g.t21 !== null && (s.type === 'strip' || (s.type === 'rect' && s.rects.length === 1) || s.type === 'circle')) {
        const half = s.type === 'strip' ? s.strip.B / 2 : s.type === 'circle' ? s.circle.R : s.rects[0].B / 2, cx = s.type === 'rect' ? s.rects[0].x : 0;
        D.line([cx - half, 0], [cx - half - zM / 2, -zM], { stroke: SPREAD, sw: 1.3, dash: '6 4' });
        D.line([cx + half, 0], [cx + half + zM / 2, -zM], { stroke: SPREAD, sw: 1.3, dash: '6 4' });
        D.text([cx + half + zM / 4, -zM / 2], '2 : 1', { dx: 6, size: 11, color: SPREAD });
      }
      // loads on the section
      const yP = s.yP, arrows = (x0, x1, q, lbl) => {
        const h = 0.07 * zM;
        D.poly([[x0, 0], [x1, 0], [x1, h], [x0, h]], { fill: 'url(#concrete)', stroke: '#6e6a5e', sw: 1.4 });
        const n = Math.max(2, Math.round((D.X(x1) - D.X(x0)) / 22));
        for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n; D.arrow([x, h + 0.07 * zM], [x, h], { color: LOAD, w: 1.4, head: 7 }); }
        D.line([x0, h + 0.07 * zM], [x1, h + 0.07 * zM], { stroke: LOAD, sw: 1.4 });
        if (lbl) D.text([(x0 + x1) / 2, h + 0.07 * zM], lbl, { anchor: 'middle', dy: -5, size: 11.5, color: '#b9581c', weight: 700 });
      };
      if (s.type === 'strip') { arrows(-s.strip.B / 2, s.strip.B / 2, s.strip.q, `q = ${f(s.strip.q)} ${U.press}`); D.dim([-s.strip.B / 2, 0], [s.strip.B / 2, 0], `B = ${f(s.strip.B)}`, -0.16 * zM * D.sc); }
      else if (s.type === 'circle') { const R = s.circle.R; if (Math.abs(yP) < R) { const c = Math.sqrt(R * R - yP * yP); arrows(-c, c, s.circle.q, `q = ${f(s.circle.q)} ${U.press}`); } D.dim([-R, 0], [R, 0], `2R = ${f(2 * R)}`, -0.16 * zM * D.sc); }
      else if (s.type === 'rect') s.rects.forEach((r, i) => { if (yP >= r.y - r.L / 2 - 1e-9 && yP <= r.y + r.L / 2 + 1e-9) arrows(r.x - r.B / 2, r.x + r.B / 2, r.q, `${s.rects.length > 1 ? `R${i + 1}: ` : ''}q = ${f(r.q)}`); else D.poly([[r.x - r.B / 2, 0], [r.x + r.B / 2, 0], [r.x + r.B / 2, 0.07 * zM], [r.x - r.B / 2, 0.07 * zM]], { stroke: '#6e6a5e', sw: 1, dash: '4 3' }); });
      else if (s.type === 'line') { [[s.line.x, s.line.q]].concat(s.line.two ? [[s.line.x2, s.line.q2]] : []).forEach(([x, q]) => D.force([x, 0], [0, -1], 0.13 * zM * D.sc, { color: LOAD, label: `q = ${f(q)} ${U.fpl}`, lp: 'tail', ldx: 6, ldy: 4 })); }
      else s.points.forEach((q, i) => { const on = Math.abs(q.y - yP) < 1e-6; D.force([q.x, 0], [0, -1], (0.1 + 0.035 * i) * zM * D.sc, { color: on ? LOAD : '#c8a27a', label: on ? `Q${i + 1} = ${f(q.Q)}` : `Q${i + 1} (off section)`, lp: 'tail', ldx: 6, ldy: 4, size: 11, dash: on ? undefined : '4 3' }); });
      // point P
      D.line([s.xP, 0], [s.xP, -s.zP], { stroke: PT, sw: 1, dash: '3 3' });
      D.dim([s.xP, -s.zP], [s.xP, 0], `z = ${f(s.zP)}`, 12, { anchor: 'end', ldx: -6, color: PT });
      D.dot([s.xP, -s.zP], PT, `P: Δσz = ${f(g.ds)} ${U.press}`, { r: 5, dx: 9, dy: 4 });
      if (s.avg && s.z2 > s.z1) { D.poly([[xa, -s.z1], [xb, -s.z1], [xb, -s.z2], [xa, -s.z2]], { fill: '#8e44ad', fop: 0.08, stroke: '#8e44ad', sw: 1, dash: '5 4' }); D.text([xa, -s.z1], `layer: Δσ_av = ${f(g.avg)} ${U.press}`, { dx: 6, dy: 14, size: 11, color: '#8e44ad' }); }
      D.text([xb, -zM * 1.0], `section at y = ${f(yP)} ${U.len} (looking along y)`, { anchor: 'end', dx: -6, dy: -6, size: 10.5, color: '#5d6b7a' });
      // plan view inset
      if (s.type !== 'strip' && s.type !== 'line') this.planInset(D, U);
    },

    planInset(D, U) {
      const s = this.state, e = this.extent();
      const pts = [[e.x0, e.y0], [e.x1, e.y1], [s.xP, s.yP]];
      const x0 = Math.min(...pts.map((q) => q[0])), x1 = Math.max(...pts.map((q) => q[0])), y0 = Math.min(...pts.map((q) => q[1])), y1 = Math.max(...pts.map((q) => q[1]));
      const span = Math.max(x1 - x0, y1 - y0, 1e-6) * 1.3, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const bw = 170, bh = 150, bx = D.W - bw - 12, by = 12, sc = Math.min(bw - 24, bh - 34) / span;
      const X = (x) => bx + bw / 2 + (x - cx) * sc, Y = (y) => by + 18 + (bh - 18) / 2 - (y - cy) * sc;
      D.el('rect', { x: bx, y: by, width: bw, height: bh, rx: 7, fill: '#ffffff', 'fill-opacity': 0.94, stroke: '#c4ced9' });
      D.text([bx + 8, by + 14], 'Plan view', { px: true, size: 11, color: '#34495e' });
      if (s.type === 'rect') s.rects.forEach((r, i) => { D.el('rect', { x: X(r.x - r.B / 2), y: Y(r.y + r.L / 2), width: r.B * sc, height: r.L * sc, fill: LOAD, 'fill-opacity': 0.25, stroke: '#b9581c', 'stroke-width': 1.2 }); if (s.rects.length > 1) D.text([X(r.x), Y(r.y) + 4], `R${i + 1}`, { px: true, anchor: 'middle', size: 10, color: '#b9581c' }); });
      if (s.type === 'circle') D.el('circle', { cx: X(0), cy: Y(0), r: s.circle.R * sc, fill: LOAD, 'fill-opacity': 0.25, stroke: '#b9581c', 'stroke-width': 1.2 });
      if (s.type === 'point') s.points.forEach((q, i) => { D.el('circle', { cx: X(q.x), cy: Y(q.y), r: 4, fill: LOAD }); D.text([X(q.x) + 5, Y(q.y) - 4], `Q${i + 1}`, { px: true, size: 10, color: '#b9581c' }); });
      D.el('line', { x1: bx + 6, y1: Y(s.yP), x2: bx + bw - 6, y2: Y(s.yP), stroke: '#7f8c8d', 'stroke-dasharray': '4 3' });
      D.text([bx + bw - 8, Y(s.yP) - 3], 'section', { px: true, anchor: 'end', size: 9.5, color: '#7f8c8d' });
      D.el('circle', { cx: X(s.xP), cy: Y(s.yP), r: 4, fill: PT, stroke: '#fff', 'stroke-width': 1.2 });
      D.text([X(s.xP) + 6, Y(s.yP) + 12], 'P', { px: true, size: 10.5, color: PT });
      D.text([bx + 8, by + bh - 6], `x →, y ↑ (${U.len})`, { px: true, size: 9.5, color: '#7f8c8d' });
    },

    draw3D(V, res, U, opts) {
      const s = this.state, g = res.geo, e = this.extent();
      const zM = Math.max(s.zMax, s.zP * 1.1), xc = 0.5 * (e.x0 + e.x1), yc = 0.5 * (e.y0 + e.y1);
      const hw = Math.max(0.5 * (e.x1 - e.x0) + 0.4 * zM, Math.abs(s.xP - xc) + 0.1 * zM), hd = Math.max(0.5 * (e.y1 - e.y0) + 0.4 * zM, Math.abs(s.yP - yc) + 0.1 * zM);
      // 3D axes: x → x, plan y → z (toward viewer is −y), depth → −y
      const P3 = (x, yPlan, z) => [x, -z, -yPlan];
      V.box(xc - hw, -zM, -(yc + hd), xc + hw, 0, -(yc - hd), G.SOILS.sand.c3d, 0.22, '#8a7650');
      const h = 0.05 * zM;
      if (s.type === 'rect') s.rects.forEach((r) => { V.box(r.x - r.B / 2, 0, -(r.y + r.L / 2), r.x + r.B / 2, h, -(r.y - r.L / 2), '#c9c6bb', 0.95, '#6e6a5e'); G.arrow3D(V, [r.x, h + 0.15 * zM, -r.y], [r.x, h, -r.y], LOAD, 2.4, `q = ${f(r.q)} ${U.press}`, 0.03 * zM); });
      if (s.type === 'circle') { const R = s.circle.R; V.lathe([[0, 0], [R, 0], [R, h], [0, h]], '#c9c6bb', 0.95, null, 40); G.arrow3D(V, [0, h + 0.15 * zM, 0], [0, h, 0], LOAD, 2.4, `q = ${f(s.circle.q)} ${U.press}`, 0.03 * zM); }
      if (s.type === 'strip') { const B = s.strip.B; V.box(-B / 2, 0, -(yc + hd), B / 2, h, -(yc - hd), '#c9c6bb', 0.95, '#6e6a5e'); }
      if (s.type === 'line') [[s.line.x, s.line.q]].concat(s.line.two ? [[s.line.x2, s.line.q2]] : []).forEach(([x, q]) => { V.line([[x, 0.01 * zM, -(yc + hd)], [x, 0.01 * zM, -(yc - hd)]], LOAD, 4); for (let i = 0; i <= 4; i++) { const zz = -(yc - hd) - (2 * hd * i) / 4; G.arrow3D(V, [x, 0.15 * zM, zz], [x, 0, zz], LOAD, 1.6, i === 2 ? `q = ${f(q)} ${U.fpl}` : null, 0.025 * zM); } });
      if (s.type === 'point') s.points.forEach((q, i) => G.arrow3D(V, P3(q.x, q.y, -0.22 * zM), P3(q.x, q.y, 0), LOAD, 3, `Q${i + 1} = ${f(q.Q)} ${U.force}`, 0.04 * zM));
      if (opts.showP !== false) {
        const grid = Physics.bulbGrid(g.LS, xc - hw, xc + hw, zM, s.yP, 60, 40), ref = g.qRef || g.ds;
        (g.qRef ? [0.9, 0.5, 0.2, 0.1] : [2, 1, 0.5]).forEach((lv) => Physics.contour(grid, lv * ref).forEach((q) => V.line([[q[0], q[1], -s.yP], [q[2], q[3], -s.yP]], BULB, 1.3)));
      }
      V.line([P3(s.xP, s.yP, 0), P3(s.xP, s.yP, s.zP)], PT, 1.2, [4, 3]);
      V.line([P3(s.xP, s.yP, s.zP), P3(s.xP, s.yP, s.zP)], PT, 7);
      V.label(P3(s.xP, s.yP, s.zP), `P: Δσz = ${f(g.ds)} ${U.press}`, PT);
      V.dim(P3(xc + hw, yc - hd, zM), P3(xc + hw, yc - hd, 0), `${f(zM)} ${U.len}`, [0.1 * zM, 0, 0]);
      V.autoBounds();
    },

    plot(svg, res, U) {
      const g = res.geo, s = this.state, { W, H } = G.chartSurface(svg);
      const series = [{ pts: g.prof.map((q) => [q[0], q[1]]), color: BULB, w: 2.4, label: 'Boussinesq Δσz at P’s plan position', fill: true }];
      if (g.t21 !== null) series.push({ pts: g.prof.map((q) => [q[2], q[1]]), color: SPREAD, dash: '6 4', label: '2:1 method (average)' });
      const hl = [{ y: s.zP, label: `z = ${f(s.zP)}`, color: PT }];
      if (s.avg && s.z2 > s.z1) hl.push({ y: s.z1, label: 'layer top', color: '#8e44ad' }, { y: s.z2, label: 'layer bottom', color: '#8e44ad' });
      const zM = Math.max(s.zMax, s.zP * 1.2);
      // a point or line load gives Δσz → ∞ at the surface; cap the axis so the curve near P stays readable
      const top = Math.max(...g.prof.map((q) => Math.max(q[0], g.t21 !== null ? q[2] : 0)));
      const deep = Math.max(...g.prof.filter((q) => q[1] >= 0.2 * zM).map((q) => q[0]), 0);
      const xmax = Math.min(top, Math.max(4 * g.ds, 2 * (g.avg || 0), 2 * deep)) || undefined;
      G.chart(svg, { x: 0, y: 0, w: W, h: H }, { title: `Vertical stress increase below (x, y) = (${f(s.xP)}, ${f(s.yP)})`, xlab: `Δσz (${U.press})`, ylab: `depth z (${U.len})`, ydown: true, ymin: 0, ymax: zM, xmin: 0, xmax, series, hlines: hl, marks: [{ x: g.ds, y: s.zP, label: f(g.ds), color: PT }].concat(g.avg !== null ? [{ x: g.avg, y: 0.5 * (s.z1 + s.z2), label: `avg ${f(g.avg)}`, color: '#8e44ad' }] : []) });
      return true;
    },
  };

  root.GStress = GStress;
})(window);
