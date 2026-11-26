/* =====================================================================
 * MODULE — Kinematics & Potential Flow (2026-11-25 book-coverage upgrade)
 * velocity fields (u, v, w / polar / ψ / φ), acceleration, rotation,
 * continuity, Bernoulli between two points, particle paths, streamline
 * coordinates, and superposed ideal flows.  Formulas: physKin.js
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Physics, Scene } = root;
  const f = Physics.fmt;
  const PI = Math.PI, DEG = PI / 180, hyp = Math.hypot;
  const AIR = '#d6eaf8', AIRD = '#5dade2', STEEL = '#9aa3ad', RED = '#c0392b', GREEN = '#16a085', INK = '#2c3e50', PURP = '#8e44ad', ORNG = '#e67e22', BLUE = '#1f5fa8', GRID = '#d5dde5';

  const DEF = {
    topic: 'field', mode: 'cart', eu: '2x', ev: '-2y', ew: '0', epsi: '5xy', ephi: '10xy', evr: '0', evt: '5/r',
    px: 1, py: 2, pz: 0, pt: 0, pr: 1, pth: 45,
    useB: false, bx: 2, by: 2, bz: 0, br: 2, bth: 45, pA: 0, rho: 1000, gAx: 'none', circR: 0,
    track: 'none', tDur: 1, tTo: 2, tMax: 10,
    eV: '0.4s^2 exp(-0.4t)', ss: 0.6, st: 1, sR: 0.5, sAnt: 0,
    sk: 'half', U: 10, q: 8, a: 1, G: 0, Rcyl: 0.5, pinf: 0, ppol: false, vt: 'comb', kBy: 'vmax', kv: 100, rc: 10, w: 1, vmax: 50, vr: 5, Lcyl: 0, rpm: 0,
    al: 0, q1: 0, x1: -1, y1: 0, q2: 0, x2: 1, y2: 0, xv: 0, yv: 0, K: 0,
  };
  const pr = (name, units, x) => ({ name, units, apply: (s) => Object.assign(s, JSON.parse(JSON.stringify(DEF)), x) });
  const F = (o) => Object.assign({ topic: 'field' }, o);
  const S = (o) => Object.assign({ topic: 'super', px: 0, py: 0 }, o);

  const MN = {
    id: 'mn', title: 'Kinematics & Potential Flow',
    state: JSON.parse(JSON.stringify(DEF)),
    presets: [
      pr('Hibbeler 3.5 — V = 2x i − 2y j at (1 m, 2 m): speed and acceleration (4.47 m/s, 8.94 m/s²)', 'SI', F({ mode: 'cart', eu: '2x', ev: '-2y', px: 1, py: 2 })),
      pr('Hibbeler 3.4 — oil in a closing nozzle, u = 6(1 + 0.4x²)(1 − 0.5t) at x = 0.25 m, t = 1 s (a = −1.23 m/s²)', 'SI', F({ mode: 'cart', eu: '6(1+0.4x^2)(1-0.5t)', ev: '0', px: 0.25, py: 0, pt: 1 })),
      pr('Hibbeler 3.2 — u = 3, v = 6t from the origin: position at t = 2 s (6 m, 12 m)', 'SI', F({ mode: 'cart', eu: '3', ev: '6t', px: 0, py: 0, pt: 0, track: 'time', tDur: 2 })),
      pr('Hibbeler 3.3 — gas in a pipe, V = t/x, released at x = 1 m when t = 0: speed at x = 2 m (0.866 m/s)', 'SI', F({ mode: 'cart', eu: 't/x', ev: '0', px: 1, py: 0, pt: 0, track: 'x', tTo: 2, tMax: 10 })),
      pr('Hibbeler 3.7 — V = 0.4s² e^(−0.4t) on a curve of R = 0.5 m at s = 0.6 m, t = 1 s (a = 20.1 mm/s²)', 'SI', { topic: 'sn', eV: '0.4s^2 exp(-0.4t)', ss: 0.6, st: 1, sR: 0.5 }),
      pr('Hibbeler 7.3 — V = −6x i + 6y j in a vertical plane: dilatation, rotation, p_B from p_A = 250 kPa (173 kPa)', 'SI', F({ mode: 'cart', eu: '-6x', ev: '6y', px: 1, py: 1, useB: true, bx: 1, by: 2, pA: 250, rho: 1200, gAx: 'y' })),
      pr('Hibbeler 7.4 — stream function ψ = y² − x: velocity at (2 m, 3 m) (6.08 m/s)', 'SI', F({ mode: 'psi', epsi: 'y^2-x', px: 2, py: 3 })),
      pr('Hibbeler 7.6 — corner flow ψ = 5xy: velocity at (1 m, 2 m) and flow to (2 m, 2 m)', 'SI', F({ mode: 'psi', epsi: '5xy', px: 1, py: 2, useB: true, bx: 2, by: 2, pA: 0, rho: 1000 })),
      pr('Hibbeler 7.8 — potential φ = 10xy: velocity, rotation and continuity at (1 m, 1 m)', 'SI', F({ mode: 'phi', ephi: '10xy', px: 1, py: 1 })),
      pr('Hibbeler 7.7 — V = 4xy² i + 4x²y j: is it irrotational, does it satisfy continuity?', 'SI', F({ mode: 'cart', eu: '4x y^2', ev: '4x^2 y', px: 1, py: 1 })),
      pr('3-D field u = xy, v = −yz, w = z²/2 − yz: continuity and rotation at (1, 2, 1)', 'SI', F({ mode: 'cart', eu: 'x y', ev: '-y z', ew: 'z^2/2 - y z', px: 1, py: 2, pz: 1 })),
      pr('Free vortex v_θ = 5/r: circulation around a circle that does not enclose the centre (0)', 'SI', F({ mode: 'polar', evr: '0', evt: '5/r', pr: 2, pth: 30, circR: 1 })),
      pr('Forced vortex v_θ = 2r: rotation and circulation (Γ = 2ω × area)', 'SI', F({ mode: 'polar', evr: '0', evt: '2r', pr: 0.5, pth: 30, circR: 1 })),
      pr('Hibbeler 7.10 — Rankine oval, source and sink 8 m²/s, 2 m apart, U = 10 m/s (b = 1.12 m, h = 0.321 m)', 'SI', S({ sk: 'oval', U: 10, q: 8, a: 1, px: 0, py: 0.321, rho: 1.2 })),
      pr('Half-body: uniform 10 m/s with a 8 m²/s source (stagnation 0.127 m upstream, half-width 0.4 m)', 'SI', S({ sk: 'half', U: 10, q: 8, px: 0, py: 0.2, rho: 1.2 })),
      pr('Cylinder of radius 0.5 m in a 10 m/s air stream: surface speed and C_p at the top (20 m/s, −3)', 'SI', S({ sk: 'cyl', U: 10, Rcyl: 0.5, G: 0, ppol: true, pr: 0.5, pth: 90, rho: 1.2 })),
      pr('Spinning cylinder with circulation 20 m²/s: stagnation points and lift (240 N/m)', 'SI', S({ sk: 'cyl', U: 10, Rcyl: 0.5, G: 20, ppol: true, pr: 0.5, pth: 90, rho: 1.2 })),
      pr('Hibbeler 7.9 — tornado as a combined vortex, 50 m/s at r₀ = 10 m: speed and pressure at r = 5 m, 20 m', 'SI', S({ sk: 'vortex', vt: 'comb', kBy: 'vmax', vmax: 50, rc: 10, vr: 20, rho: 1.2 })),
      pr('Sink with a vortex (bathtub drain): q = −2 m²/s, Γ = 6 m²/s, at r = 0.5 m', 'SI', S({ sk: 'source', q: -2, G: 6, ppol: true, pr: 0.5, pth: 0, rho: 1000 })),
      pr('Hibbeler 7.5 — uniform 6 m/s flow at 30° to the x axis (custom superposition)', 'SI', S({ sk: 'custom', U: 6, al: 30, px: 1, py: 1 })),
    ],

    controls(el, C) {
      const s = this.state, U = root.App.U(), u = Physics.kinUnits(U), SI = u.SI;
      const sl = (p, k, label, min, max, step, unit) => C.slider(p, { label, min, max, step, get: () => s[k], set: (v) => (s[k] = v), unit });
      const tx = (p, k, label) => C.text(p, { label, get: () => s[k], set: (v) => (s[k] = v) });
      const t = C.section(el, 'Problem type');
      C.select(t, { label: 'Topic', options: [['field', 'Velocity field: acceleration, rotation, continuity, paths'], ['sn', 'Streamline coordinates: a_s and a_n'], ['super', 'Ideal flows: half-body, oval, cylinder, vortex']], get: () => s.topic, set: (v) => (s.topic = v) });
      const L = u.L;
      if (s.topic === 'field') {
        const a = C.section(el, 'Flow field');
        C.select(a, { label: 'Described by', options: [['cart', 'Velocity components u, v, w'], ['psi', 'Stream function ψ(x, y)'], ['phi', 'Velocity potential φ(x, y)'], ['polar', 'Polar components v_r, v_θ'], ['psiP', 'Stream function ψ(r, θ)'], ['phiP', 'Velocity potential φ(r, θ)']], get: () => s.mode, set: (v) => (s.mode = v) });
        const m = s.mode, pol = m === 'polar' || m === 'psiP' || m === 'phiP';
        if (m === 'cart') { tx(a, 'eu', 'u(x, y, z, t)'); tx(a, 'ev', 'v(x, y, z, t)'); tx(a, 'ew', 'w(x, y, z, t)'); }
        if (m === 'psi' || m === 'psiP') tx(a, 'epsi', m === 'psi' ? 'ψ(x, y, t)' : 'ψ(r, θ, t)');
        if (m === 'phi' || m === 'phiP') tx(a, 'ephi', m === 'phi' ? 'φ(x, y, t)' : 'φ(r, θ, t)');
        if (m === 'polar') { tx(a, 'evr', 'v_r(r, θ, t)'); tx(a, 'evt', 'v_θ(r, θ, t)'); }
        C.note(a, `Type expressions like 6(1+0.4x^2)(1-0.5t), 4x y^2, 5/r or sin(th). Use th for θ in radians, pi, exp(), ln(), sqrt(). Velocities in ${u.V}, lengths in ${L}, time in s.`);
        const b = C.section(el, 'Point A');
        if (pol) { sl(b, 'pr', 'Radius r', 0, 1e4, 0.0001, L); sl(b, 'pth', 'Angle θ', -360, 360, 0.01, '°'); }
        else { sl(b, 'px', 'x', -1e4, 1e4, 0.0001, L); sl(b, 'py', 'y', -1e4, 1e4, 0.0001, L); if (m === 'cart') sl(b, 'pz', 'z', -1e4, 1e4, 0.0001, L); }
        sl(b, 'pt', 'Time t', 0, 1e4, 0.0001, 's');
        const c = C.section(el, 'Second point B (Bernoulli, flow between streamlines)');
        C.toggle(c, { label: 'Use a second point B', get: () => s.useB, set: (v) => (s.useB = v) });
        if (s.useB) {
          if (pol) { sl(c, 'br', 'Radius r_B', 0, 1e4, 0.0001, L); sl(c, 'bth', 'Angle θ_B', -360, 360, 0.01, '°'); }
          else { sl(c, 'bx', 'x_B', -1e4, 1e4, 0.0001, L); sl(c, 'by', 'y_B', -1e4, 1e4, 0.0001, L); if (m === 'cart') sl(c, 'bz', 'z_B', -1e4, 1e4, 0.0001, L); }
          sl(c, 'pA', 'Pressure at A', -1e5, 1e5, 0.001, u.p); sl(c, 'rho', 'Density ρ', 0.001, SI ? 20000 : 40, 0.0001, u.rho);
          C.seg(c, { label: 'Elevation (gravity) along', options: [['none', 'none (horizontal)'], ['y', '+y up'], ['z', '+z up']], get: () => s.gAx, set: (v) => (s.gAx = v) });
        }
        const d = C.section(el, 'Circulation and particle path');
        sl(d, 'circR', 'Circulation around a circle of radius (0 = skip)', 0, 1e4, 0.0001, L);
        C.select(d, { label: 'Follow the particle at A', options: [['none', 'No'], ['time', 'For a time interval'], ['x', 'Until it reaches a given x'], ['y', 'Until it reaches a given y']], get: () => s.track, set: (v) => (s.track = v) });
        if (s.track === 'time') sl(d, 'tDur', 'Time interval', 0, 1e4, 0.0001, 's');
        if (s.track === 'x' || s.track === 'y') { sl(d, 'tTo', `Target ${s.track}`, -1e4, 1e4, 0.0001, L); sl(d, 'tMax', 'Give up after', 0.001, 1e5, 0.001, 's'); }
      } else if (s.topic === 'sn') {
        const a = C.section(el, 'Speed along the streamline');
        tx(a, 'eV', 'V(s, t)');
        C.note(a, `s is the distance along the streamline (${L}), t the time (s).`);
        sl(a, 'ss', 'Position s', -1e4, 1e4, 0.0001, L); sl(a, 'st', 'Time t', 0, 1e4, 0.0001, 's');
        sl(a, 'sR', 'Radius of curvature R (0 = straight)', 0, 1e5, 0.0001, L);
        sl(a, 'sAnt', 'Local normal part (∂Vₙ/∂t), usually 0', -1e4, 1e4, 0.0001, u.a);
      } else {
        const a = C.section(el, 'Flow');
        C.select(a, { label: 'Pattern', options: [['half', 'Half-body: uniform flow + source'], ['oval', 'Rankine oval: uniform flow + source + sink'], ['cyl', 'Cylinder: uniform flow + doublet (+ vortex)'], ['vortex', 'Vortex: free, forced or combined (tornado)'], ['source', 'Source or sink (with a vortex)'], ['custom', 'Custom superposition']], get: () => s.sk, set: (v) => (s.sk = v) });
        const k = s.sk;
        if (k === 'half' || k === 'oval' || k === 'cyl') sl(a, 'U', 'Free-stream speed U', 0, 1e4, 0.0001, u.V);
        if (k === 'half' || k === 'oval' || k === 'source') sl(a, 'q', 'Source strength q (− for a sink)', -1e5, 1e5, 0.0001, u.q);
        if (k === 'oval') sl(a, 'a', 'Half spacing a (source at −a, sink at +a)', 0.0001, 1e4, 0.0001, L);
        if (k === 'cyl') { sl(a, 'Rcyl', 'Cylinder radius a', 0.0001, 1e4, 0.0001, L); sl(a, 'G', 'Circulation Γ (clockwise +)', -1e5, 1e5, 0.0001, u.q); sl(a, 'rpm', 'Or spin rate for an estimate of Γ (0 = skip)', 0, 1e5, 0.01, 'rev/min'); sl(a, 'Lcyl', 'Cylinder length for the total lift (0 = per unit length)', 0, 1e4, 0.0001, L); }
        if (k === 'source') sl(a, 'G', 'Vortex circulation Γ (clockwise +)', -1e5, 1e5, 0.0001, u.q);
        if (k === 'vortex') {
          C.seg(a, { label: 'Vortex', options: [['free', 'Free'], ['forced', 'Forced'], ['comb', 'Combined']], get: () => s.vt, set: (v) => (s.vt = v) });
          if (s.vt === 'forced') sl(a, 'w', 'Angular velocity ω', -1e4, 1e4, 0.0001, 'rad/s');
          else {
            const ko = s.vt === 'comb' ? [['vmax', 'Max speed at r₀'], ['k', 'k = Γ/2π'], ['G', 'Γ']] : [['k', 'k = Γ/2π'], ['G', 'Γ']];
            if (!ko.some((o) => o[0] === s.kBy)) s.kBy = ko[0][0];
            C.seg(a, { label: 'Strength given as', options: ko, get: () => s.kBy, set: (v) => (s.kBy = v) });
            if (s.kBy === 'vmax') sl(a, 'vmax', 'Maximum speed at r₀', 0, 1e4, 0.0001, u.V); else if (s.kBy === 'k') sl(a, 'kv', 'Vortex constant k', -1e6, 1e6, 0.0001, u.q); else sl(a, 'G', 'Circulation Γ', -1e6, 1e6, 0.0001, u.q);
            if (s.vt === 'comb') sl(a, 'rc', 'Core radius r₀', 0.0001, 1e5, 0.0001, L);
          }
          sl(a, 'vr', 'Radius r of interest', 0.0001, 1e5, 0.0001, L);
          sl(a, 'rho', 'Density ρ (0 = skip pressures)', 0, SI ? 20000 : 40, 0.0001, u.rho);
        }
        if (k === 'custom') {
          sl(a, 'U', 'Uniform flow U (0 = none)', 0, 1e4, 0.0001, u.V); sl(a, 'al', 'Its angle from +x', -180, 180, 0.01, '°');
          sl(a, 'q1', 'Source 1 strength (− = sink, 0 = none)', -1e5, 1e5, 0.0001, u.q); sl(a, 'x1', 'Source 1 at x', -1e4, 1e4, 0.0001, L); sl(a, 'y1', 'Source 1 at y', -1e4, 1e4, 0.0001, L);
          sl(a, 'q2', 'Source 2 strength (− = sink, 0 = none)', -1e5, 1e5, 0.0001, u.q); sl(a, 'x2', 'Source 2 at x', -1e4, 1e4, 0.0001, L); sl(a, 'y2', 'Source 2 at y', -1e4, 1e4, 0.0001, L);
          sl(a, 'G', 'Vortex Γ (clockwise +, 0 = none)', -1e5, 1e5, 0.0001, u.q); sl(a, 'xv', 'Vortex at x', -1e4, 1e4, 0.0001, L); sl(a, 'yv', 'Vortex at y', -1e4, 1e4, 0.0001, L);
          sl(a, 'K', 'Doublet strength κ at the origin (0 = none)', -1e5, 1e5, 0.0001, SI ? 'm³/s' : 'ft³/s');
        }
        if (k !== 'vortex') {
          const b = C.section(el, 'Point of interest');
          C.seg(b, { label: 'Given as', options: [[false, 'x, y'], [true, 'r, θ']], get: () => s.ppol, set: (v) => (s.ppol = v === true || v === 'true') });
          if (s.ppol) { sl(b, 'pr', 'Radius r', 0, 1e4, 0.0001, L); sl(b, 'pth', 'Angle θ', -360, 360, 0.01, '°'); }
          else { sl(b, 'px', 'x', -1e4, 1e4, 0.0001, L); sl(b, 'py', 'y', -1e4, 1e4, 0.0001, L); }
          sl(b, 'rho', 'Density ρ (0 = skip pressure)', 0, SI ? 20000 : 40, 0.0001, u.rho);
          sl(b, 'pinf', 'Free-stream pressure p∞ (gage)', -1e5, 1e5, 0.001, u.p);
        }
      }
    },

    compute(U) { return Physics.kinematics(Object.assign({}, this.state), U); },

    scene(res, U) {
      const g = res.geo, u = Physics.kinUnits(U), sc = Scene.Scene();
      sc.depth = 0.4;
      const quiver = (vel, cx, cy, W, n, t, z0) => {
        const cell = (2 * W) / n, pts = [];
        let vmax = 0;
        for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) { const x = cx - W + i * cell, y = cy - W + j * cell, v = vel({ x, y, z: z0 || 0, t }); if (isFinite(v[0]) && isFinite(v[1])) { const m = hyp(v[0], v[1]); if (m < 1e6) { pts.push([x, y, v[0], v[1], m]); vmax = Math.max(vmax, m); } } }
        if (!(vmax > 0)) return;
        pts.forEach(([x, y, a, b, m]) => { if (m < 1e-9 * vmax) return; const L = 0.42 * cell * Math.min(1, Math.max(0.25, m / vmax)); sc.line([x, y], [x + (L * a) / m, y + (L * b) / m], { stroke: AIRD, sw: 1.1 }); const hx = x + (L * a) / m, hy = y + (L * b) / m, ang = Math.atan2(b, a); sc.line([hx, hy], [hx - 0.25 * L * Math.cos(ang - 0.45), hy - 0.25 * L * Math.sin(ang - 0.45)], { stroke: AIRD, sw: 1.1 }); });
      };
      const clip = (pts, x0, x1, y0, y1) => { const out = []; let cur = []; pts.forEach((q) => { if (q[0] >= x0 && q[0] <= x1 && q[1] >= y0 && q[1] <= y1) cur.push(q); else { if (cur.length > 1) out.push(cur); cur = []; } }); if (cur.length > 1) out.push(cur); return out; };
      const frame = (x0, x1, y0, y1) => {
        sc.rect(x0, y0, x1, y1, { fill: '#f7fbfe', stroke: GRID, sw: 1 }, false);
        if (x0 < 0 && x1 > 0) sc.line([0, y0], [0, y1], { stroke: '#aab7c4', sw: 1 });
        if (y0 < 0 && y1 > 0) sc.line([x0, 0], [x1, 0], { stroke: '#aab7c4', sw: 1 });
        sc.text([x1 + 0.02 * (x1 - x0), y0 > 0 || y1 < 0 ? y0 : 0], 'x', { size: 12, color: INK }); sc.text([x0 > 0 || x1 < 0 ? x0 : 0, y1 + 0.03 * (y1 - y0)], 'y', { size: 12, color: INK });
        sc.text([x0, y0 - 0.06 * (y1 - y0)], `${f(x0)} … ${f(x1)} ${u.L}`, { size: 11, color: INK });
      };
      if (g.topic === 'sn') {
        const R = g.R > 0 ? 1 : 0;
        const pts = []; for (let i = 0; i <= 60; i++) { const a = -0.9 + (1.8 * i) / 60; pts.push(R ? [3 * Math.sin(a), 3 - 3 * Math.cos(a)] : [3 * a, 0]); }
        sc.pline(pts, { stroke: BLUE, sw: 3 });
        sc.dot([0, 0], RED, 'A');
        const k = 1.6 / Math.max(Math.abs(g.as), Math.abs(g.an), 1e-12);
        sc.arrow([0, 0], [k * g.as, 0], { color: ORNG, label: `a_s = ${f(g.as)} ${u.a}`, ldy: 22, anchor: g.as < 0 ? 'end' : 'start' });
        if (R) { sc.arrow([0, 0], [0, k * g.an], { color: PURP, label: `a_n = ${f(g.an)} ${u.a}`, lp: 'head', ldx: 8, ldy: 4 }); sc.text([0.2, 3.2], `centre of curvature (R = ${f(g.R)} ${u.L})`, { size: 11, color: INK }); sc.dot([0, 3], INK, ''); }
        sc.arrow([-2.4, -0.25], [-1.4, -0.25], { color: GREEN, label: `V = ${f(g.V)} ${u.V}`, ldy: 18 });
        sc.autoBounds(0.12); sc.padR = 160; return sc;
      }
      if (g.topic === 'field') {
        const A = g.PA, W = g.span, x0 = A.x - W, x1 = A.x + W, y0 = A.y - W, y1 = A.y + W;
        frame(x0, x1, y0, y1);
        quiver(g.vel, A.x, A.y, W, 12, g.t, A.z);
        clip(g.sl, x0, x1, y0, y1).forEach((pp) => sc.pline(pp, { stroke: BLUE, sw: 2.2 }));
        if (g.slB) clip(g.slB, x0, x1, y0, y1).forEach((pp) => sc.pline(pp, { stroke: PURP, sw: 2, dash: '6 4' }));
        if (g.path) clip(g.path, x0 - W, x1 + W, y0 - W, y1 + W).forEach((pp) => sc.pline(pp, { stroke: ORNG, sw: 2.5 }));
        const vm = hyp(g.v[0], g.v[1]), am = hyp(g.acc[0], g.acc[1]), Lv = 0.35 * W;
        if (vm > 0) sc.arrow([A.x, A.y], [A.x + (Lv * g.v[0]) / vm, A.y + (Lv * g.v[1]) / vm], { color: GREEN, label: `V = ${f(vm)} ${u.V}`, lp: 'head', size: 12 });
        if (am > 1e-9) sc.arrow([A.x, A.y], [A.x + (Lv * g.acc[0]) / am, A.y + (Lv * g.acc[1]) / am], { color: RED, label: `a = ${f(am)} ${u.a}`, lp: 'head', size: 12 });
        sc.dot([A.x, A.y], INK, 'A');
        if (g.PB) sc.dot([g.PB.x, g.PB.y], PURP, 'B');
        sc.text([x0, y1 + 0.12 * W], 'blue: streamline through A' + (g.PB ? ', purple: through B' : '') + (g.path ? ', orange: particle path' : '') + (g.t ? ` (t = ${f(g.t)} s)` : ''), { size: 11, color: INK });
        sc.autoBounds(0.06); sc.padR = 60; return sc;
      }
      // superposed flows
      if (g.kind === 'vortex') {
        const R = Math.max(g.rP, g.vt === 'comb' ? 2 * g.rc : 0) * 1.4;
        for (let i = 1; i <= 6; i++) sc.circle([0, 0], (R * i) / 6, { fill: 'none', stroke: AIRD, sw: 1.3 }, false);
        if (g.vt === 'comb') sc.circle([0, 0], g.rc, { fill: '#e8f1f8', stroke: PURP, sw: 2, dash: '5 3' }, false);
        sc.dot([g.rP, 0], RED, `r = ${f(g.rP)} ${u.L}`);
        // v_θ profile to the right
        const x0 = 1.3 * R, W = 1.6 * R, H = R;
        sc.line([x0, -H / 2], [x0 + W, -H / 2], { stroke: INK, sw: 1 }); sc.line([x0, -H / 2], [x0, H / 2 + 0.1 * H], { stroke: INK, sw: 1 });
        sc.text([x0 - 0.1 * R, H / 2 + 0.2 * H], 'v_θ', { size: 12, color: INK }); sc.text([x0 + W, -H / 2 - 0.12 * H], 'r', { size: 12, color: INK });
        const rmax = R, pts = []; let vmax = 0;
        for (let i = 1; i <= 100; i++) { const r = (rmax * i) / 100; vmax = Math.max(vmax, Math.abs(g.vAt(r))); }
        for (let i = 1; i <= 100; i++) { const r = (rmax * i) / 100, v = g.vAt(r); pts.push([x0 + (W * r) / rmax, -H / 2 + (H * Math.abs(v)) / (vmax || 1)]); }
        sc.pline(pts, { stroke: RED, sw: 2.5 });
        sc.text([x0, -H / 2 - 0.28 * H], g.vt === 'free' ? 'free vortex: v_θ = k/r' : g.vt === 'forced' ? 'forced vortex: v_θ = ωr' : `combined: core ωr (r < ${f(g.rc)} ${u.L}), outside k/r`, { size: 11.5, color: INK });
        sc.autoBounds(0.06); sc.padR = 60; return sc;
      }
      let Wx = 3, Wy = 2;
      if (g.body === 'half') { Wx = Math.max(6 * Math.abs(g.xs), 2.2 * g.h); Wy = 2.2 * g.h; }
      else if (g.body === 'oval') { Wx = 2.4 * g.b; Wy = Math.max(3 * g.h, 0.8 * g.b); }
      else if (g.body === 'cyl') { Wx = 3.2 * g.R; Wy = 2.4 * g.R; }
      else { const ex = g.els.filter((e) => e.t !== 'U').map((e) => Math.max(Math.abs(e.x), Math.abs(e.y))); const m = Math.max(1, ...ex, Math.abs(g.PA.x), Math.abs(g.PA.y)); Wx = 2.2 * m; Wy = 1.6 * m; }
      const x0 = -Wx, x1 = Wx, y0 = -Wy, y1 = Wy;
      frame(x0, x1, y0, y1);
      const hasU = g.els.some((e) => e.t === 'U');
      const seeds = [];
      if (hasU) { const al = (g.els.find((e) => e.t === 'U').al) || 0; for (let i = 1; i < 14; i++) { const y = y0 + ((y1 - y0) * i) / 14; seeds.push([x0 - (Math.tan(al) * y) * 0 + 0.001 * Wx, y]); } }
      else g.els.forEach((e) => { if (e.t === 'src' || e.t === 'vtx') for (let i = 0; i < 12; i++) { const a = (i / 12) * 2 * PI; seeds.push([e.x + 0.35 * Wy * Math.cos(a), e.y + 0.35 * Wy * Math.sin(a)]); } });
      seeds.forEach((sd) => {
        const pts = Physics.kinStreamline(g.vel, { x: sd[0], y: sd[1], z: 0 }, 0, 2.2 * Math.max(Wx, Wy));
        clip(pts, x0, x1, y0, y1).forEach((pp) => sc.pline(pp, { stroke: AIRD, sw: 1.4 }));
      });
      // body
      if (g.body === 'half') {
        const top = [], bot = [];
        for (let i = 1; i < 200; i++) { const th = (i / 200) * PI, r = (g.q * (PI - th)) / (2 * PI * g.U * Math.sin(th)), x = r * Math.cos(th), y = r * Math.sin(th); if (x <= x1) { top.push([x, y]); bot.push([x, -y]); } }
        sc.poly(top.concat(bot.reverse()), { fill: STEEL, stroke: INK, sw: 1.5 }, { fill: STEEL, alpha: 0.9 });
        sc.dot([g.xs, 0], RED, 'stagnation');
      } else if (g.body === 'oval') {
        const psi = (x, y) => g.U * y - (g.q / (2 * PI)) * Math.atan2(2 * g.a * y, x * x + y * y - g.a * g.a);
        const top = [];
        for (let i = 0; i <= 120; i++) { const x = -g.b + (2 * g.b * i) / 120; let lo = 0, hi = g.h * 1.05; if (Math.abs(x) >= g.b) { top.push([x, 0]); continue; } for (let k = 0; k < 60; k++) { const m = 0.5 * (lo + hi); if (psi(x, m) < 0) lo = m; else hi = m; } top.push([x, 0.5 * (lo + hi)]); }
        sc.poly(top.concat(top.slice().reverse().map((q) => [q[0], -q[1]])), { fill: STEEL, stroke: INK, sw: 1.5 }, { fill: STEEL, alpha: 0.9 });
        sc.dot([-g.a, 0], GREEN, ''); sc.dot([g.a, 0], RED, '');
        sc.dim([-g.b, -g.h], [g.b, -g.h], `2b = ${f(2 * g.b)} ${u.L}`, -18);
      } else if (g.body === 'cyl') {
        sc.circle([0, 0], g.R, { fill: STEEL, stroke: INK, sw: 1.5 }, 'disc');
        if (Math.abs(g.sn) <= 1) { const t1 = Math.asin(-g.sn); [t1, PI - t1].forEach((t) => sc.dot([g.R * Math.cos(t), g.R * Math.sin(t)], RED, '')); }
        if (g.G) sc.text([-0.55 * g.R, -0.05 * g.R], g.G > 0 ? 'Γ clockwise' : 'Γ counter-cw', { size: 11, color: '#fff' });
      }
      g.els.forEach((e) => { if (e.t === 'src' && g.body === 'none') sc.dot([e.x, e.y], e.q > 0 ? GREEN : RED, e.q > 0 ? 'source' : 'sink'); if (e.t === 'vtx' && g.body === 'none') sc.dot([e.x, e.y], PURP, 'vortex'); });
      const vm = hyp(g.v[0], g.v[1]), Lv = 0.25 * Wy;
      if (vm > 0) sc.arrow([g.PA.x, g.PA.y], [g.PA.x + (Lv * g.v[0]) / vm, g.PA.y + (Lv * g.v[1]) / vm], { color: GREEN, label: `${f(vm)} ${u.V}` });
      sc.dot([g.PA.x, g.PA.y], INK, '');
      sc.autoBounds(0.06); sc.padR = 80; return sc;
    },

    draw2D(svg, res, U) {
      if (!res.ok) { root.M1.emptyMsg(svg, res); return; }
      Scene.draw2D(svg, this.scene(res, U));
    },
    draw3D(V, res, U) {
      if (!res.ok) return;
      Scene.draw3D(V, this.scene(res, U));
    },
  };
  root.MN = MN;
})(window);
