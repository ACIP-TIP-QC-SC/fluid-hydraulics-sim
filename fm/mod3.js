/* =====================================================================
 * MODULE 3 — Relative equilibrium (linear acceleration, rotation)
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Physics } = root;
  const { COL } = root.UI;
  const f = Physics.fmt;
  const PI = Math.PI;

  const M3 = {
    id: 'm3', title: 'Relative Equilibrium',
    state: {
      sub: 'lin',
      lin: { sg: 1, L: 6, B: 2, H: 2, d: 1.5, a: 2, dir: 'h', alpha: 30, slope: 'up', decel: false, closed: false, p0: 0, probe: null },
      rot: { sg: 1, shape: 'open', R: 0.5, H: 1.5, d: 1.0, omega: 6, useRpm: false, p0: 0, targetSpill: 0, probe: null },
    },
    presets: [
      { name: 'Test 4 — Horizontal a = 4.905 m/s² (tan θ = 0.5)', apply: (s) => { s.sub = 'lin'; Object.assign(s.lin, { sg: 1, L: 6, B: 2, H: 2, d: 1.5, a: 4.905, dir: 'h', decel: false, closed: false, p0: 0, probe: null }); } },
      { name: 'Test 5 — Up a 30° incline, a = 3 m/s²', apply: (s) => { s.sub = 'lin'; Object.assign(s.lin, { sg: 1, L: 2, B: 1, H: 2, d: 1.0, a: 3, dir: 'incline', alpha: 30, slope: 'up', decel: false, closed: false, p0: 0, probe: null }); } },
      { name: 'Truck tank 6 m, a = 2 m/s² (no spill)', apply: (s) => { s.sub = 'lin'; Object.assign(s.lin, { sg: 1, L: 6, B: 2, H: 2, d: 1.2, a: 2, dir: 'h', decel: false, closed: false, p0: 0, probe: null }); } },
      { name: 'Elevator: vertical up a = 4 m/s²', apply: (s) => { s.sub = 'lin'; Object.assign(s.lin, { sg: 1, L: 3, B: 2, H: 2, d: 1.5, a: 4, dir: 'up', decel: false, closed: false, p0: 0, probe: null }); } },
      { name: 'Closed full tank, a = 3 m/s²', apply: (s) => { s.sub = 'lin'; Object.assign(s.lin, { sg: 1, L: 4, B: 2, H: 2, d: 2, a: 3, dir: 'h', decel: false, closed: true, p0: 0, probe: null }); } },
      { name: 'Test 6 — Open cylinder R = 0.5 m, ω = 10 rad/s', apply: (s) => { s.sub = 'rot'; Object.assign(s.rot, { sg: 1, shape: 'open', R: 0.5, H: 2.0, d: 1.0, omega: 10, useRpm: false, p0: 0, probe: null }); } },
      { name: 'Open cylinder that spills (ω = 14 rad/s)', apply: (s) => { s.sub = 'rot'; Object.assign(s.rot, { sg: 1, shape: 'open', R: 0.5, H: 1.5, d: 1.0, omega: 14, useRpm: false, p0: 0, probe: null }); } },
      { name: 'Vertex below bottom (ω = 20 rad/s)', apply: (s) => { s.sub = 'rot'; Object.assign(s.rot, { sg: 1, shape: 'open', R: 0.5, H: 1.0, d: 0.8, omega: 20, useRpm: false, p0: 0, probe: null }); } },
      { name: 'Closed cylinder, half full, 300 rpm', apply: (s) => { s.sub = 'rot'; Object.assign(s.rot, { sg: 1, shape: 'closed', R: 0.4, H: 1.2, d: 0.6, omega: (300 * 2 * PI) / 60, useRpm: true, p0: 0, probe: null }); } },
      { name: 'Open cone, apex down', apply: (s) => { s.sub = 'rot'; Object.assign(s.rot, { sg: 1, shape: 'cone', R: 0.6, H: 1.2, d: 0.9, omega: 5, useRpm: false, p0: 0, probe: null }); } },
    ],

    controls(el, C) {
      const S = this.state, U = root.App.U();
      C.seg(el, { label: 'Motion', options: [['lin', 'Rectilinear acceleration'], ['rot', 'Rotating vessel']].concat(root.StatX ? root.StatX.options('m3') : []), get: () => S.sub, set: (v) => (S.sub = v) });
      if (root.StatX && root.StatX.is(S.sub, 'm3')) { root.StatX.controls(S.sub, S, el, C); return; }
      if (S.sub === 'lin') {
        const s = S.lin;
        C.sg(el, { get: () => s.sg, set: (v) => (s.sg = v) });
        const t = C.section(el, 'Tank');
        C.slider(t, { label: 'Length L (direction of motion)', min: 0.1, max: 20, step: 0.01, get: () => s.L, set: (v) => (s.L = v), unit: U.len });
        C.slider(t, { label: 'Width B', min: 0.1, max: 20, step: 0.01, get: () => s.B, set: (v) => (s.B = v), unit: U.len });
        C.slider(t, { label: 'Height H', min: 0.1, max: 20, step: 0.01, get: () => s.H, set: (v) => (s.H = v), unit: U.len, rebuild: true });
        C.slider(t, { label: 'Initial depth d', min: 0, max: s.H, step: 0.01, get: () => s.d, set: (v) => (s.d = v), unit: U.len });
        C.seg(t, { label: 'Tank', options: [['open', 'Open'], ['closed', 'Closed']], get: () => (s.closed ? 'closed' : 'open'), set: (v) => (s.closed = v === 'closed') });
        if (s.closed) C.slider(t, { label: 'Air pressure p₀ (gauge)', min: 0, max: 200, step: 0.1, get: () => s.p0, set: (v) => (s.p0 = v), unit: U.press });
        const m = C.section(el, 'Acceleration');
        C.slider(m, { label: 'Acceleration a', min: 0, max: 20, step: 0.001, get: () => s.a, set: (v) => (s.a = v), unit: U.acc });
        C.select(m, { label: 'Direction', options: [['h', 'Horizontal'], ['up', 'Vertical, upward'], ['down', 'Vertical, downward'], ['incline', 'Along an incline']], get: () => s.dir, set: (v) => (s.dir = v) });
        if (s.dir === 'incline') {
          C.slider(m, { label: 'Incline angle α', min: 0, max: 90, step: 0.1, get: () => s.alpha, set: (v) => (s.alpha = v), unit: '°' });
          C.seg(m, { label: 'Moving', options: [['up', 'Up the slope'], ['down', 'Down the slope']], get: () => s.slope, set: (v) => (s.slope = v) });
        }
        C.seg(m, { options: [['acc', 'Accelerating'], ['dec', 'Decelerating']], get: () => (s.decel ? 'dec' : 'acc'), set: (v) => (s.decel = v === 'dec') });
        C.note(el, 'Tip: click inside the liquid on the diagram to read the pressure at that point.');
      } else {
        const s = S.rot;
        C.sg(el, { get: () => s.sg, set: (v) => (s.sg = v) });
        const t = C.section(el, 'Vessel');
        C.select(t, { label: 'Shape', options: [['open', 'Open cylinder'], ['closed', 'Closed cylinder'], ['cone', 'Open cone (apex down)']], get: () => s.shape, set: (v) => (s.shape = v) });
        C.slider(t, { label: 'Radius R', min: 0.05, max: 5, step: 0.01, get: () => s.R, set: (v) => (s.R = v), unit: U.len });
        C.slider(t, { label: 'Height H', min: 0.1, max: 10, step: 0.01, get: () => s.H, set: (v) => (s.H = v), unit: U.len, rebuild: true });
        C.slider(t, { label: 'Initial depth d', min: 0, max: s.H, step: 0.01, get: () => s.d, set: (v) => (s.d = v), unit: U.len });
        if (s.shape === 'closed') C.slider(t, { label: 'Initial air pressure p₀ (gauge)', min: 0, max: 200, step: 0.1, get: () => s.p0, set: (v) => (s.p0 = v), unit: U.press });
        const m = C.section(el, 'Rotation');
        C.seg(m, { label: 'Input speed as', options: [['w', 'ω (rad/s)'], ['n', 'N (rpm)']], get: () => (s.useRpm ? 'n' : 'w'), set: (v) => (s.useRpm = v === 'n') });
        if (!s.useRpm) C.slider(m, { label: 'Angular speed ω', min: 0, max: 100, step: 0.01, get: () => s.omega, set: (v) => (s.omega = v), unit: 'rad/s' });
        else C.slider(m, { label: 'Speed N', min: 0, max: 955, step: 0.1, get: () => (s.omega * 60) / (2 * PI), set: (v) => (s.omega = (v * 2 * PI) / 60), unit: 'rpm' });
        C.note(m, `ω = 2πN/60 → currently ${f(s.omega)} rad/s = ${f((s.omega * 60) / (2 * PI))} rpm`);
        if (s.shape === 'open') C.slider(m, { label: 'Target spill volume (solve for ω)', min: 0, max: 50, step: 0.001, get: () => s.targetSpill, set: (v) => (s.targetSpill = v), unit: U.vol });
        C.note(m, 'Axis is at the centre of the vessel. Click inside the liquid to probe the pressure.');
      }
    },

    compute(U) {
      const S = this.state;
      if (S.sub === 'lin') return Physics.rectilinear(S.lin, U);
      return Physics.rotating(S.rot, U);
    },

    onClick(world, res) {
      const S = this.state;
      if (!res || !res.ok) return false;
      if (S.sub === 'lin') {
        const b = res.geo.beta, x = world[0] * Math.cos(b) + world[1] * Math.sin(b), y = -world[0] * Math.sin(b) + world[1] * Math.cos(b);
        if (res.pAt(x, y) === null) return false;
        S.lin.probe = [x, y];
      } else {
        if (res.pAt(world[0], world[1]) === null) return false;
        S.rot.probe = [world[0], world[1]];
      }
      return true;
    },

    draw2D(svg, res, U, opts) {
      if (!res.ok) { root.M1.emptyMsg(svg, res); this._cur = null; return; }
      if (this.state.sub === 'rot') return drawRot(svg, res, U, opts, this.state.rot);
      // animate c, s toward the new solution
      const tgt = { c: res.geo.c, s: res.geo.s, beta: res.geo.beta };
      const from = this._cur && this._cur.beta === tgt.beta ? Object.assign({}, this._cur) : tgt;
      cancelAnimationFrame(this._raf);
      const t0 = performance.now(), dur = 380;
      const step = (now) => {
        const t = Math.min(1, (now - t0) / dur), e = t * (2 - t);
        const cur = { c: from.c + (tgt.c - from.c) * e, s: from.s + (tgt.s - from.s) * e, beta: tgt.beta };
        this._cur = cur;
        drawLin(svg, res, U, opts, this.state.lin, cur, t >= 1);
        if (t < 1) this._raf = requestAnimationFrame(step);
      };
      if (Math.abs(from.c - tgt.c) < 1e-9 && Math.abs(from.s - tgt.s) < 1e-9) { this._cur = tgt; drawLin(svg, res, U, opts, this.state.lin, tgt, true); }
      else this._raf = requestAnimationFrame(step);
    },

    draw3D(V, res, U) {
      if (!res.ok) return;
      if (this.state.sub === 'rot') return rot3D(V, res, U);
      return lin3D(V, res, U);
    },
  };

  /* ---------------- linear acceleration ---------------- */
  function liquidPoly(c, s, L, H) {
    const xs = [0, L];
    if (s) { const a = -c / s, b = (H - c) / s; if (a > 0 && a < L) xs.push(a); if (b > 0 && b < L) xs.push(b); }
    xs.sort((a, b) => a - b);
    const top = xs.map((x) => [x, Math.min(Math.max(c + s * x, 0), H)]);
    return [[0, 0], ...top, [L, 0]];
  }

  function drawLin(svg, res, U, opts, st, cur, final) {
    const g = res.geo, { L, H } = g, b = g.beta;
    const cb = Math.cos(b), sb = Math.sin(b);
    const W = (p) => [p[0] * cb - p[1] * sb, p[0] * sb + p[1] * cb];
    const wr = Math.min(0.12 * L, 0.2 * H);
    const box = [[-0.45 * L, -2.2 * wr], [1.45 * L, -2.2 * wr], [1.45 * L, 1.55 * H], [-0.45 * L, 1.55 * H]].map(W);
    const xs = box.map((p) => p[0]), ys = box.map((p) => p[1]);
    const D = root.UI.Draw2D(svg, { xmin: Math.min(...xs), xmax: Math.max(...xs), ymin: Math.min(...ys), ymax: Math.max(...ys) }, { pad: 40 });
    D.svg.style.cursor = 'crosshair';
    const c = cur.c, s = cur.s;
    // ground / incline
    const gy = -2 * wr;
    D.line(W([-0.4 * L, gy]), W([1.4 * L, gy]), { stroke: '#5d6d7e', sw: 3 });
    for (let i = 0; i <= 18; i++) { const x = -0.4 * L + (i * 1.8 * L) / 18; D.line(W([x, gy]), W([x - 0.05 * L, gy - 0.06 * L]), { stroke: '#95a5a6', sw: 1 }); }
    if (b) {
      const p0 = W([-0.4 * L, gy]);
      D.line(p0, [p0[0] + 0.5 * L, p0[1]], { stroke: '#7f8c8d', sw: 1, dash: '4 3' });
      D.arc(p0, 46, b > 0 ? 0 : b / (PI / 180), b > 0 ? b / (PI / 180) : 0, `α = ${f(Math.abs(b) * 180 / PI)}°`);
    }
    [0.18 * L, 0.82 * L].forEach((x) => { D.circle(W([x, -wr]), wr * 0.9, { fill: '#34495e', stroke: '#1b2631', sw: 2 }); D.circle(W([x, -wr]), wr * 0.3, { fill: '#bdc3c7' }); });
    D.poly([[-0.02 * L, -0.25 * wr], [1.02 * L, -0.25 * wr], [1.02 * L, -wr * 0.9], [-0.02 * L, -wr * 0.9]].map(W), { fill: '#566573' });
    // liquid
    const poly = liquidPoly(c, s, L, H).map(W);
    D.poly(poly, { fill: 'url(#waterGrad)', op: 0.88 });
    // original (rest) surface
    const rest = [[0, Math.min(H, Math.max(0, g.c0))], [L, Math.min(H, Math.max(0, g.c0 + g.s0 * L))]].map(W);
    D.line(rest[0], rest[1], { stroke: '#1b4f72', sw: 1.2, dash: '7 5' });
    D.text(rest[1], 'original level', { dx: 6, dy: 4, color: '#1b4f72', size: 10.5 });
    // free surface + imaginary extension
    const fx = (x) => c + s * x;
    const segs = [];
    for (let i = 0; i <= 60; i++) { const x = (i / 60) * L; segs.push([x, fx(x)]); }
    D.pline(segs.filter((p) => p[1] >= 0 && p[1] <= H).map(W), { stroke: COL.waterDark, sw: 2 });
    const ext = segs.filter((p) => p[1] > H || p[1] < 0);
    if (ext.length) D.pline([[-0.25 * L, fx(-0.25 * L)], [1.25 * L, fx(1.25 * L)]].map(W), { stroke: COL.waterDark, sw: 1, dash: '3 4' });
    // pressure diagrams on the end walls
    if (opts.showP && final) {
      const pAt = (x, y) => g.gEff * Math.max(0, fx(x) - y) + g.p0;
      const pmax = Math.max(pAt(0, 0), pAt(L, 0), 1e-9);
      const k = (0.3 * L) / pmax;
      [[0, -1], [L, 1]].forEach(([x0, sg]) => {
        const pts = [];
        for (let i = 0; i <= 20; i++) { const y = (i / 20) * H; pts.push([x0 + sg * pAt(x0, y) * k, y]); }
        D.poly([[x0, 0], ...pts, [x0, H]].map(W), { fill: COL.press, fop: 0.18, stroke: COL.press, sw: 1 });
        D.text(W([x0 + sg * pAt(x0, 0) * k, 0]), `${f(pAt(x0, 0))} ${U.press}`, { color: COL.press, size: 10.5, anchor: sg < 0 ? 'end' : 'start', dx: sg * 4, dy: 14 });
      });
    }
    // tank
    D.pline([[0, H * 1.0], [0, 0], [L, 0], [L, H]].map(W), { stroke: '#2c3e50', sw: 4 });
    if (g.closed) D.line(W([0, H]), W([L, H]), { stroke: '#2c3e50', sw: 4 });
    // θ arc at the back wall
    if (Math.abs(g.ah) > 1e-9 && final) {
      const xm = L * 0.5, pm = W([xm, fx(xm)]);
      const ang = Math.atan2(W([1, s])[1] - W([0, 0])[1], W([1, s])[0] - W([0, 0])[0]) * 180 / PI;
      D.line(pm, [pm[0] + 0.3 * L, pm[1]], { stroke: COL.dim, sw: 0.8, dash: '3 3' });
      D.arc(pm, 60, Math.min(0, ang), Math.max(0, ang), `θ = ${f(Math.abs(g.thDeg))}°`);
    }
    // acceleration arrow
    if (st.a > 0) {
      const av = [g.ah, g.av], l = Math.hypot(av[0], av[1]) || 1;
      const mid = W([L / 2, 1.3 * H]);
      const half = Math.min(0.25 * L, 1.2);
      D.arrow([mid[0] - (av[0] / l) * half, mid[1] - (av[1] / l) * half], [mid[0] + (av[0] / l) * half, mid[1] + (av[1] / l) * half], { color: COL.force, w: 3.2, label: `a = ${f(st.a)} ${U.acc}${st.decel ? ' (decelerating)' : ''}`, lp: 'head', ldx: 8, ldy: 4 });
      const mv = g.mv;
      D.text(W([L / 2, 1.48 * H]), `motion ${mv[0] > 0.5 ? '→' : mv[1] > 0 ? '↑' : '↓'}`, { anchor: 'middle', color: '#566', size: 11 });
    }
    // spill animation
    if (g.spill && final) {
      const rim = W([s < 0 ? 0 : L, H]);
      const dir = s < 0 ? -1 : 1;
      for (let i = 0; i < 7; i++) {
        const cx = D.X(rim[0]) + dir * (6 + (i % 3) * 5), cy = D.Y(rim[1]);
        const dot = D.el('circle', { cx, cy, r: 3.2, fill: '#3d8fcc' });
        const an = root.UI.svgEl('animate', { attributeName: 'cy', from: cy, to: cy + 90, dur: '0.9s', begin: `${i * 0.13}s`, repeatCount: 'indefinite' }, dot);
        root.UI.svgEl('animate', { attributeName: 'opacity', from: 1, to: 0, dur: '0.9s', begin: `${i * 0.13}s`, repeatCount: 'indefinite' }, dot);
        void an;
      }
      D.text(rim, `spills ${f(g.Vsp)} ${U.vol}`, { color: '#c0392b', dx: dir * 10, dy: -10, anchor: dir < 0 ? 'end' : 'start' });
    }
    // dims (tank frame, on walls)
    D.dim(W([0, 0]), W([0, g.hb]), `${f(g.hb)}`, 16);
    D.dim(W([L, 0]), W([L, g.hf]), `${f(g.hf)}`, -16);
    D.dim(W([0, -2.2 * wr]), W([L, -2.2 * wr]), `L = ${f(L)} ${U.len}`, 0, { ldy: 16 });
    D.text(W([0, H]), 'back', { dx: -4, dy: -8, anchor: 'end', color: '#566', size: 10.5 });
    D.text(W([L, H]), 'front', { dx: 4, dy: -8, color: '#566', size: 10.5 });
    if (final) {
      const cn = g.corners;
      const lab = (p, v, anchor, dy) => D.text(W(p), `${f(v)} ${U.press}`, { anchor, dy, color: '#7b241c', size: 10, dx: anchor === 'end' ? -6 : 6 });
      lab([0, 0], cn.backBottom, 'start', -4); lab([L, 0], cn.frontBottom, 'end', -4);
      if (g.closed) { lab([0, H], cn.backTop, 'start', 12); lab([L, H], cn.frontTop, 'end', 12); }
    }
    // probe
    if (st.probe && final) {
      const pv = res.pAt(st.probe[0], st.probe[1]);
      if (pv !== null) {
        const pw = W(st.probe);
        D.dot(pw, '#f1c40f', `p = ${f(pv)} ${U.press}`, { r: 5, dx: 9, dy: -6 });
      }
    }
  }

  function lin3D(V, res, U) {
    const g = res.geo, { L, H, B } = g, b = g.beta;
    const cb = Math.cos(b), sb = Math.sin(b);
    const W = (p) => [p[0] * cb - p[1] * sb, p[0] * sb + p[1] * cb];
    const poly = liquidPoly(g.c, g.s, L, H).map(W);
    V.extrude(poly, 0, B, '#4aa3df', 0.4, '#1f6fa8');
    const P = (x, y, z) => { const w = W([x, y]); return [w[0], w[1], z]; };
    V.face([P(0, 0, 0), P(L, 0, 0), P(L, 0, B), P(0, 0, B)], '#7f8c8d', 0.6, '#333');
    V.face([P(0, 0, 0), P(0, H, 0), P(0, H, B), P(0, 0, B)], '#bdc3c7', 0.18, '#333');
    V.face([P(L, 0, 0), P(L, H, 0), P(L, H, B), P(L, 0, B)], '#bdc3c7', 0.18, '#333');
    V.face([P(0, 0, 0), P(L, 0, 0), P(L, H, 0), P(0, H, 0)], '#bdc3c7', 0.12, '#333');
    V.face([P(0, 0, B), P(L, 0, B), P(L, H, B), P(0, H, B)], '#bdc3c7', 0.12, '#333');
    if (g.closed) V.face([P(0, H, 0), P(L, H, 0), P(L, H, B), P(0, H, B)], '#95a5a6', 0.15, '#333');
    const a = [g.ah, g.av], l = Math.hypot(a[0], a[1]);
    if (l > 0) {
      const m = W([L / 2, 1.3 * H]);
      V.line([[m[0] - (a[0] / l) * 0.2 * L, m[1] - (a[1] / l) * 0.2 * L, B / 2], [m[0] + (a[0] / l) * 0.2 * L, m[1] + (a[1] / l) * 0.2 * L, B / 2]], '#c0392b', 3);
      V.label([m[0] + (a[0] / l) * 0.2 * L, m[1] + (a[1] / l) * 0.2 * L, B / 2], 'a', '#c0392b');
    }
    const u = U.len, gap = 0.15 * Math.max(L, H);
    const nrm = (x, y) => { const w = W([x, y]); return [w[0], w[1], 0]; };
    const n0 = W([0, -1]), nb = W([-1, 0]);
    V.dim(P(0, 0, B), P(L, 0, B), `L = ${f(L)} ${u}`, [n0[0] * gap, n0[1] * gap, 0]);
    V.dim(P(L, 0, 0), P(L, 0, B), `B = ${f(B)} ${u}`, [n0[0] * gap, n0[1] * gap, 0]);
    V.dim(P(0, 0, B), P(0, H, B), `H = ${f(H)} ${u}`, [nb[0] * gap, nb[1] * gap, 0]);
    V.dim(P(0, 0, 0), P(0, g.hb, 0), `back ${f(g.hb)} ${u}`, [0, 0, -gap], '#0b3d91');
    V.dim(P(L, 0, 0), P(L, g.hf, 0), `front ${f(g.hf)} ${u}`, [0, 0, -gap], '#0b3d91');
    void nrm;
    V.autoBounds();
  }

  /* ---------------- rotation ---------------- */
  function rotSection(g, n) {
    n = n || 160;
    const { R, H, zv, k, shape } = g;
    const up = [], dn = [];
    for (let i = 0; i <= n; i++) {
      const x = -R + (2 * R * i) / n;
      const bot = shape === 'cone' ? (H * Math.abs(x)) / R : 0;
      const top = Math.min(zv + k * x * x, H);
      up.push([x, Math.max(top, bot)]); dn.push([x, bot]);
    }
    return { up, dn, poly: [...up, ...dn.reverse()] };
  }

  function drawRot(svg, res, U, opts, st) {
    const g = res.geo, { R, H, zv, k } = g;
    const below = Math.min(0, zv) - 0.15 * H;
    const D = root.UI.Draw2D(svg, { xmin: -R * 1.9, xmax: R * 2.6, ymin: Math.min(below, -0.35 * H), ymax: H * 1.3 }, { pad: 40 });
    D.svg.style.cursor = 'crosshair';
    const sec = rotSection(g);
    D.poly(sec.poly, { fill: 'url(#waterGrad)', op: 0.88 });
    // pressure diagrams
    if (opts.showP && g.shape !== 'cone') {
      const pw = (z) => g.gam * Math.max(0, g.rim - z) * (z <= g.rim ? 1 : 0) + g.p0;
      const pb = (x) => g.gam * Math.max(0, zv + k * x * x) + g.p0;
      const pmax = Math.max(pw(0), pb(R), 1e-9), kk = (0.55 * R) / pmax;
      [-1, 1].forEach((sg) => {
        const pts = []; for (let i = 0; i <= 20; i++) { const z = (i / 20) * H; pts.push([sg * (R + pw(z) * kk), z]); }
        D.poly([[sg * R, 0], ...pts, [sg * R, H]], { fill: COL.press, fop: 0.16, stroke: COL.press, sw: 1 });
      });
      const pts = []; for (let i = 0; i <= 40; i++) { const x = -R + (2 * R * i) / 40; pts.push([x, -pb(x) * kk * 0.6]); }
      D.poly([[-R, 0], ...pts, [R, 0]], { fill: COL.press, fop: 0.16, stroke: COL.press, sw: 1 });
      D.text([R, -pb(R) * kk * 0.6], `${f(pb(R))} ${U.press}`, { color: COL.press, size: 10.5, dx: 4, dy: 10 });
      D.text([0, -pb(0) * kk * 0.6], `${f(pb(0))}`, { color: COL.press, size: 10.5, anchor: 'middle', dy: 14 });
    }
    // imaginary parabola
    const par = [];
    for (let i = 0; i <= 80; i++) { const x = -R + (2 * R * i) / 80; const z = zv + k * x * x; par.push([x, Math.min(z, H * 1.25)]); }
    D.pline(par, { stroke: COL.waterDark, sw: 1, dash: '3 4' });
    D.pline(sec.up.filter((p, i) => { const x = p[0]; const z = zv + k * x * x; return z >= (g.shape === 'cone' ? (H * Math.abs(x)) / R : 0) - 1e-9 && z <= H + 1e-9; }), { stroke: COL.waterDark, sw: 2 });
    // original level
    const dl = g.shape === 'cone' ? (R * g.d) / H : R;
    D.line([-dl, g.d], [dl, g.d], { stroke: '#1b4f72', sw: 1.2, dash: '7 5' });
    D.text([-dl, g.d], `original d = ${f(g.d)}`, { anchor: 'end', dx: -6, dy: 4, color: '#1b4f72', size: 10.5 });
    // vessel
    if (g.shape === 'cone') D.pline([[-R, H], [0, 0], [R, H]], { stroke: '#2c3e50', sw: 4 });
    else D.pline([[-R, H], [-R, 0], [R, 0], [R, H]], { stroke: '#2c3e50', sw: 4 });
    if (g.shape === 'closed') D.line([-R, H], [R, H], { stroke: '#2c3e50', sw: 4 });
    D.line([0, below], [0, H * 1.2], { stroke: '#7f8c8d', sw: 1, dash: '10 4 2 4' });
    // rotation arrow
    const cy = H * 1.15, rx = R * 0.6;
    const arcP = []; for (let i = 0; i <= 30; i++) { const t = PI * 1.15 + (i / 30) * PI * 1.6; arcP.push([rx * Math.cos(t), cy + 0.06 * H * Math.sin(t)]); }
    D.pline(arcP, { stroke: COL.force, sw: 2 });
    const a1 = arcP[arcP.length - 1], a0 = arcP[arcP.length - 3];
    D.arrow(a0, a1, { color: COL.force, w: 2, head: 10 });
    D.text([rx, cy], `ω = ${f(st.omega)} rad/s (${f((st.omega * 60) / (2 * PI))} rpm)`, { dx: 10, dy: -4, color: COL.force });
    // vertex
    D.dot([0, zv], '#8e44ad', zv < 0 ? 'vertex (imaginary)' : 'vertex', { r: 4, dx: 8, dy: 14 });
    // dims
    const xr = R * 1.25;
    D.dim([xr, zv], [xr, g.rim], `h = ${f(g.h)}`, -10, { anchor: 'start', ldx: 8 });
    D.line([-R, g.rim], [xr, g.rim], { stroke: COL.dim, sw: 0.6, dash: '3 3' });
    D.line([0, zv], [xr, zv], { stroke: COL.dim, sw: 0.6, dash: '3 3' });
    if (g.kase === 1 && g.h > 1e-6) {
      D.dim([-R * 1.3, g.d], [-R * 1.3, g.rim], `h/2 = ${f(g.h / 2)}`, 10, { anchor: 'end', ldx: -8 });
      D.dim([-R * 1.3, zv], [-R * 1.3, g.d], `h/2`, 10, { anchor: 'end', ldx: -8 });
    }
    D.dim([R * 1.9, 0], [R * 1.9, H], `H = ${f(H)}`, -10, { anchor: 'start', ldx: 8 });
    D.dim([-R, below + 0.05 * H], [R, below + 0.05 * H], `2R = ${f(2 * R)}`, 0, { ldy: 16 });
    if (g.r0 > 0 && g.shape !== 'cone') D.dim([-g.r0, 0], [g.r0, 0], `2r₀ = ${f(2 * g.r0)}`, -14, { ldy: -6 });
    if (g.rLid) D.text([g.rLid, H], `lid wetted beyond r = ${f(g.rLid)}`, { dy: -8, color: '#7b241c', size: 10.5 });
    // spill drops
    if (g.spill) {
      [-1, 1].forEach((sg) => {
        for (let i = 0; i < 5; i++) {
          const cx = D.X(sg * R) + sg * (5 + (i % 3) * 5), cyy = D.Y(H);
          const dot = D.el('circle', { cx, cy: cyy, r: 3, fill: '#3d8fcc' });
          root.UI.svgEl('animate', { attributeName: 'cy', from: cyy, to: cyy + 80, dur: '0.85s', begin: `${i * 0.17}s`, repeatCount: 'indefinite' }, dot);
          root.UI.svgEl('animate', { attributeName: 'opacity', from: 1, to: 0, dur: '0.85s', begin: `${i * 0.17}s`, repeatCount: 'indefinite' }, dot);
        }
      });
      D.text([R, H], `spills ${f(g.Vsp)} ${U.vol}`, { dx: 14, dy: -8, color: '#c0392b' });
    }
    if (st.probe) {
      const pv = res.pAt(st.probe[0], st.probe[1]);
      if (pv !== null) D.dot(st.probe, '#f1c40f', `p = ${f(pv)} ${U.press}`, { r: 5, dx: 9, dy: -6 });
    }
  }

  function rot3D(V, res, U) {
    const g = res.geo, { R, H } = g;
    if (g.shape === 'cone') V.lathe([[0, 0], [R, H]], '#bdc3c7', 0.16, null, 40, 0, 0, { open: true });
    else {
      V.lathe([[0, 0], [R, 0], [R, H]], '#bdc3c7', 0.16, null, 40, 0, 0, { open: true });
      if (g.shape === 'closed') V.lathe([[R, H], [0, H]], '#95a5a6', 0.12, null, 40, 0, 0, { open: true });
    }
    const sec = rotSection(g, 60);
    const half = sec.poly.filter((p) => p[0] >= -1e-9);
    // profile: bottom from axis outwards, then top back to axis
    const n = 30, top = [], bot = [];
    for (let i = 0; i <= n; i++) {
      const r = (R * i) / n;
      const b = g.shape === 'cone' ? (H * r) / R : 0;
      const t = Math.max(Math.min(g.zv + g.k * r * r, H), b);
      bot.push([r, b]); top.push([r, t]);
    }
    V.lathe([...bot, ...top.reverse()], '#4aa3df', 0.42, null, 40);
    V.circle(0, H, 0, R, '#2c3e50', 2);
    if (g.shape !== 'cone') V.circle(0, 0, 0, R, '#2c3e50', 2);
    V.line([[0, Math.min(0, g.zv) - 0.1 * H, 0], [0, H * 1.25, 0]], '#7f8c8d', 1, [8, 4]);
    // paraboloid meridian (dashed): shows the imaginary part below the bottom or above the lid, which h is measured on
    if (g.zv < -1e-9 || g.rim > H + 1e-9) { const pr = []; for (let i = -40; i <= 40; i++) { const r = (R * i) / 40; pr.push([r, g.zv + g.k * r * r, 0]); } V.line(pr, '#0b3d91', 1.2, [5, 4]); }
    void half;
    const u = U.len, gap = 0.3 * Math.max(R, 0.3 * H);
    V.dim([0, H, 0], [R, H, 0], `R = ${f(R)} ${u}`, [0, gap * 0.6, 0]);
    V.dim([R, 0, 0], [R, H, 0], `H = ${f(H)} ${u}`, [gap, 0, 0]);
    V.dim([-R, g.zv, 0], [-R, g.rim, 0], `h = ${f(g.h)} ${u}`, [-gap, 0, 0], '#0b3d91');
    V.autoBounds();
  }

  root.M3 = M3;
})(window);
