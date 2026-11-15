/* =====================================================================
 * STEP 5 — Shear Strength (UI, Mohr circles, specimen sketches, charts, 3D)
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Physics } = root;
  const G = root.GeoUI;
  const f = Physics.fmt, DEG = Math.PI / 180;
  const COL = { main: '#2980b9', tot: '#c0392b', eff: '#27ae60' };
  const FP = '#d35400', PL = '#8e44ad', AX = '#34495e';
  const STR = 20.885434, FRC = 0.2248089, AR = 1 / 6.4516, LN = 1 / 2.54;

  const base = {
    sub: 'triax',
    stress: { by: 'xy', sx: 100, sy: 40, txy: 30, s1: 200, s3: 80, theta: 30, c: 10, phi: 30 },
    direct: { input: 'force', A: 36, fit: 'cphi', tests: [{ N: 180, S: 110 }, { N: 360, S: 200 }, { N: 540, S: 290 }] },
    triax: { type: 'CD', fit: 'phi', specs: [{ s3: 100, dd: 200, du: 0 }] },
    ucs: { input: 'load', D: 3.8, eps: 8, Pf: 170, qu: 100, sens: false, quR: 30 },
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const set = (s, over) => { const b = clone(base); Object.keys(b).forEach((k) => { s[k] = typeof b[k] === 'object' ? Object.assign(b[k], (over || {})[k] || {}) : (over && over[k] !== undefined ? over[k] : b[k]); }); };

  function infoBox(D, lines, right) {
    const w = Math.max(...lines.map((l) => l.length)) * 6.4 + 20, x = right ? D.W - w - 12 : 12;
    D.el('rect', { x, y: 12, width: w, height: 14 + lines.length * 18, rx: 7, fill: '#ffffff', 'fill-opacity': 0.92, stroke: '#c4ced9' });
    lines.forEach((l, i) => D.text([x + 10, 30 + i * 18], l, { px: true, size: 12, color: i === lines.length - 1 ? '#c0392b' : '#1d2733', weight: i === lines.length - 1 ? 700 : 600 }));
  }

  /* ---------------- specimen sketches (world units = stress units) ---------------- */
  const SK = { triax: 0.66, unconf: 0.5, direct: 0.95, stress: 0.95 };

  function sketchCyl(D, x0, yc, hS, g, s, U, triax) {
    const h = 0.56 * hS, w = 0.28 * hS, m = 0.13 * hS;
    const cx = x0 + (triax ? m + 0.02 * hS : 0.11 * hS) + w / 2, yb = yc - h / 2, yt = yc + h / 2;
    const ref = g.circles[0];
    if (triax) {
      D.poly([[cx - w / 2 - m, yb - 0.05 * hS], [cx + w / 2 + m, yb - 0.05 * hS], [cx + w / 2 + m, yt + 0.06 * hS], [cx - w / 2 - m, yt + 0.06 * hS]], { fill: '#4aa3df', fop: 0.16, stroke: '#1f6fa8', sw: 1.4 });
      D.text([cx, yb - 0.05 * hS], `cell pressure σ₃ = ${f(ref.s3)}`, { anchor: 'middle', dy: 15, size: 11, color: '#1f6fa8' });
    }
    D.poly([[cx - w / 2, yb], [cx + w / 2, yb], [cx + w / 2, yt], [cx - w / 2, yt]], { fill: G.soilFill(s.sub === 'unconf' ? 'clay' : s.triax.type === 'CD' ? 'sand' : 'clay'), stroke: '#2c3e50', sw: 1.6 });
    D.poly([[cx - w / 2 - 0.02 * hS, yt], [cx + w / 2 + 0.02 * hS, yt], [cx + w / 2 + 0.02 * hS, yt + 0.04 * hS], [cx - w / 2 - 0.02 * hS, yt + 0.04 * hS]], { fill: '#95a5a6', stroke: '#2c3e50', sw: 1.2 });
    D.poly([[cx - w / 2 - 0.02 * hS, yb], [cx + w / 2 + 0.02 * hS, yb], [cx + w / 2 + 0.02 * hS, yb - 0.04 * hS], [cx - w / 2 - 0.02 * hS, yb - 0.04 * hS]], { fill: '#95a5a6', stroke: '#2c3e50', sw: 1.2 });
    // axial load
    const top = yt + 0.04 * hS;
    D.arrow([cx, top + 0.2 * hS], [cx, top], { color: COL.tot, w: 3, head: 12 });
    D.text([cx, top + 0.2 * hS], triax ? `σ₁ = σ₃ + Δσ_d = ${f(ref.s1)}` : `σ₁ = q_u = ${f(ref.s1)}`, { anchor: 'middle', dy: -6, size: 11.5, color: COL.tot, weight: 700 });
    // confining arrows
    if (triax) [0.25, 0.75].forEach((t) => {
      const y = yb + t * h;
      D.arrow([cx - w / 2 - m * 0.9, y], [cx - w / 2, y], { color: '#1f6fa8', w: 2, head: 8 });
      D.arrow([cx + w / 2 + m * 0.9, y], [cx + w / 2, y], { color: '#1f6fa8', w: 2, head: 8 });
    });
    // failure plane
    const th = g.fpl ? g.fpl.th : Math.PI / 4;
    let dx = w / 2, dy = dx * Math.tan(th);
    if (dy > h / 2) { dy = h / 2; dx = dy / Math.tan(th); }
    D.line([cx - dx, yc - dy], [cx + dx, yc + dy], { stroke: FP, sw: 2.6 });
    D.line([cx, yc], [cx + w / 2 + 0.03 * hS, yc], { stroke: AX, sw: 0.9, dash: '3 3' });
    D.arc([cx, yc], 20, 0, th / DEG, `θ = ${f(th / DEG, 3)}°`, { color: FP });
    if (triax && s.triax.type === 'CU') {
      const gx = cx + w / 2 + m + 0.06 * hS, gy = yb - 0.02 * hS;
      D.line([cx + w / 2, yb - 0.04 * hS], [gx, yb - 0.04 * hS], { stroke: '#2c3e50', sw: 1.2 });
      D.line([gx, yb - 0.04 * hS], [gx, gy + 0.08 * hS], { stroke: '#2c3e50', sw: 1.2 });
      D.circle([gx, gy + 0.11 * hS], 0.03 * hS, { fill: '#fff', stroke: '#2c3e50', sw: 1.2 });
      D.text([gx, gy + 0.14 * hS], `Δu = ${f(ref.du || 0)}`, { anchor: 'middle', dy: -4, size: 11, color: PL, weight: 700 });
    }
    D.text([cx, yb - 0.05 * hS], triax ? `Triaxial ${s.triax.type} specimen` : 'Unconfined compression (σ₃ = 0)', { anchor: 'middle', dy: triax ? 30 : 15, size: 11.5, color: AX, weight: 700 });
  }

  function sketchBox(D, x0, yc, hS, g, s, U) {
    const wB = 0.56 * hS, hB = 0.17 * hS, d = 0.06 * wB, xa = x0 + 0.26 * hS;
    G.soilRect(D, xa, yc - hB, xa + wB, yc, 'sand', { stroke: '#2c3e50', sw: 2.2 });
    G.soilRect(D, xa + d, yc, xa + wB + d, yc + hB, 'sand', { stroke: '#2c3e50', sw: 2.2 });
    D.poly([[xa + d - 0.01 * hS, yc + hB], [xa + wB + d + 0.01 * hS, yc + hB], [xa + wB + d + 0.01 * hS, yc + hB + 0.035 * hS], [xa + d - 0.01 * hS, yc + hB + 0.035 * hS]], { fill: '#95a5a6', stroke: '#2c3e50', sw: 1.2 });
    const cx = xa + d + wB / 2, top = yc + hB + 0.035 * hS;
    const last = s.direct.tests.filter((t) => t.N > 0).slice(-1)[0] || { N: 0, S: 0 };
    const fu = U.id === 'SI' ? 'N' : 'lb', byF = s.direct.input === 'force';
    D.arrow([cx, top + 0.2 * hS], [cx, top], { color: COL.tot, w: 3, head: 12 });
    D.text([cx, top + 0.2 * hS], byF ? `N = ${f(last.N)} ${fu}` : `σ = ${f(last.N)}`, { anchor: 'middle', dy: -6, size: 11.5, color: COL.tot, weight: 700 });
    D.arrow([xa + d - 0.22 * hS, yc + hB / 2], [xa + d, yc + hB / 2], { color: PL, w: 3, head: 12 });
    D.text([xa + d - 0.22 * hS, yc + hB / 2], byF ? `S = ${f(last.S)} ${fu}` : `τ = ${f(last.S)}`, { dy: -8, size: 11.5, color: PL, weight: 700 });
    D.arrow([xa + wB + 0.2 * hS, yc - hB / 2], [xa + wB, yc - hB / 2], { color: '#7f8c8d', w: 2.2, head: 10 });
    D.line([xa - 0.03 * hS, yc], [xa + wB + d + 0.05 * hS, yc], { stroke: FP, sw: 2.4, dash: '7 4' });
    D.text([xa + wB / 2, yc - hB], 'failure plane is forced to be horizontal', { anchor: 'middle', dy: 15, size: 11, color: FP });
    if (byF) D.dim([xa, yc - hB - 0.08 * hS], [xa + wB, yc - hB - 0.08 * hS], `A = ${f(s.direct.A)} ${U.areaS}`, 0, { ldy: 16 });
    D.text([xa + wB / 2, yc - hB - 0.08 * hS], 'Direct shear box (last test)', { anchor: 'middle', dy: 34, size: 11.5, color: AX, weight: 700 });
  }

  function sketchElement(D, x0, yc, hS, g, s, U) {
    const st = g.state, a = 0.42 * hS, L = 0.17 * hS, cx = x0 + L + 0.03 * hS + a / 2;
    const pr = s.stress.by === 'principal';
    D.poly([[cx - a / 2, yc - a / 2], [cx + a / 2, yc - a / 2], [cx + a / 2, yc + a / 2], [cx - a / 2, yc + a / 2]], { fill: G.soilFill('silt'), stroke: '#2c3e50', sw: 1.6 });
    const nx = (sgn, v) => v >= 0 ? [[cx + sgn * (a / 2 + L), yc], [cx + sgn * a / 2, yc]] : [[cx + sgn * a / 2, yc], [cx + sgn * (a / 2 + L), yc]];
    const ny = (sgn, v) => v >= 0 ? [[cx, yc + sgn * (a / 2 + L)], [cx, yc + sgn * a / 2]] : [[cx, yc + sgn * a / 2], [cx, yc + sgn * (a / 2 + L)]];
    [1, -1].forEach((sg) => { const p = nx(sg, st.sx); D.arrow(p[0], p[1], { color: COL.tot, w: 2.6, head: 10 }); const q = ny(sg, st.sy); D.arrow(q[0], q[1], { color: COL.tot, w: 2.6, head: 10 }); });
    D.text([cx + a / 2 + L, yc], `${pr ? 'σ₁' : 'σx'} = ${f(st.sx)}`, { anchor: 'end', dy: 16, size: 11, color: COL.tot, weight: 700 });
    D.text([cx, yc + a / 2 + L], `${pr ? 'σ₃' : 'σy'} = ${f(st.sy)}`, { dx: 6, dy: 4, size: 11, color: COL.tot, weight: 700 });
    if (Math.abs(st.txy) > 1e-9) {
      const t = Math.sign(st.txy), o = 0.05 * hS, l = 0.3 * a;
      D.arrow([cx + a / 2 + o, yc - t * l], [cx + a / 2 + o, yc + t * l], { color: PL, w: 2, head: 8 });
      D.arrow([cx - a / 2 - o, yc + t * l], [cx - a / 2 - o, yc - t * l], { color: PL, w: 2, head: 8 });
      D.arrow([cx - t * l, yc + a / 2 + o], [cx + t * l, yc + a / 2 + o], { color: PL, w: 2, head: 8 });
      D.arrow([cx + t * l, yc - a / 2 - o], [cx - t * l, yc - a / 2 - o], { color: PL, w: 2, head: 8 });
      D.text([cx + l, yc + a / 2 + o], `τxy = ${f(st.txy)}`, { dx: 2, dy: -5, size: 11, color: PL, weight: 700 });
    }
    // plane at θ (normal at θ from x) and the σ₁ direction
    const th = st.theta * DEG, ux = Math.cos(th + Math.PI / 2), uy = Math.sin(th + Math.PI / 2);
    const k = Math.min(Math.abs(ux) > 1e-9 ? a / 2 / Math.abs(ux) : 1e9, Math.abs(uy) > 1e-9 ? a / 2 / Math.abs(uy) : 1e9);
    D.line([cx - ux * k, yc - uy * k], [cx + ux * k, yc + uy * k], { stroke: FP, sw: 2.6 });
    D.arrow([cx, yc], [cx + Math.cos(th) * a * 0.42, yc + Math.sin(th) * a * 0.42], { color: FP, w: 1.8, head: 8, label: 'n', lp: 'head', size: 11 });
    if (st.theta > 0.5) D.arc([cx, yc], 16, 0, st.theta, `θ = ${f(st.theta, 3)}°`, { color: FP });
    if (!pr) {
      const tp = st.thp;
      D.line([cx - Math.cos(tp) * a * 0.62, yc - Math.sin(tp) * a * 0.62], [cx + Math.cos(tp) * a * 0.62, yc + Math.sin(tp) * a * 0.62], { stroke: PL, sw: 1.2, dash: '5 4' });
      D.text([cx + Math.cos(tp) * a * 0.62, yc + Math.sin(tp) * a * 0.62], `σ₁ at ${f(tp / DEG, 3)}°`, { dx: 3, dy: -3, size: 10.5, color: PL });
    }
    D.text([cx, yc - a / 2 - L], 'Soil element (compression +)', { anchor: 'middle', dy: 16, size: 11.5, color: AX, weight: 700 });
  }

  /* ---------------- Mohr diagram ---------------- */
  function mohr(svg, g, s, U, show) {
    const circ = g.circles, env = g.env;
    let Smin = Math.min(0, ...circ.map((c) => c.s3)), Smax = Math.max(...circ.map((c) => c.s1));
    let Rm = Math.max(...circ.map((c) => (c.s1 - c.s3) / 2), 1e-9);
    if (g.sub === 'stress') {
      const Rf = g.state ? Math.max(0, env[0].c * Math.cos(g.phi) + g.state.c0 * Math.sin(g.phi)) : 0;
      if (Rf < 3 * Rm) { Rm = Math.max(Rm, Rf); Smax = Math.max(Smax, g.state.c0 + Rf); Smin = Math.min(Smin, g.state.c0 - Rf); }
    }
    const span = Math.max(Smax - Smin, 1e-9);
    const xL = Smin - 0.06 * span, xR = Smax + (g.sub === 'stress' ? 0.32 : 0.16) * span;
    const yT = Math.max(1.45 * Rm, 0.24 * span), yB = -Math.max(1.12 * Rm, 0.12 * span);
    const hS = 0.86 * (yT - yB), sw = show ? SK[g.sub] * hS : 0, gap = 0.1 * span;
    const D = root.UI.Draw2D(svg, { xmin: show ? xL - gap - sw : xL, xmax: xR, ymin: yB, ymax: yT }, { pad: 30, padT: 22 });
    G.soilDefs(svg);
    if (show) {
      const x0 = xL - gap - sw, yc = (yT + yB) / 2 - 0.02 * hS;
      if (g.sub === 'triax') sketchCyl(D, x0, yc, hS, g, s, U, true);
      else if (g.sub === 'unconf') sketchCyl(D, x0, yc, hS, g, s, U, false);
      else if (g.sub === 'direct') sketchBox(D, x0, yc, hS, g, s, U);
      else sketchElement(D, x0, yc, hS, g, s, U);
    }
    // axes and ticks
    D.arrow([xL, 0], [xR, 0], { color: AX, w: 1.4, head: 9 });
    D.arrow([0, yB], [0, yT], { color: AX, w: 1.4, head: 9 });
    D.text([xR, 0], `σ (${U.press})`, { anchor: 'end', dy: 30, size: 12, color: AX, weight: 700 });
    D.text([0, yT], `τ (${U.press})`, { dx: 8, dy: 12, size: 12, color: AX, weight: 700 });
    const step = G.niceStep(xR - xL, Math.max(4, Math.floor(D.sc * (xR - xL) / 80)));
    for (let v = Math.ceil(xL / step) * step; v < xR - 0.4 * step; v += step) {
      if (Math.abs(v) < step * 1e-6) continue;
      D.el('line', { x1: D.X(v), y1: D.Y(0), x2: D.X(v), y2: D.Y(0) + 5, stroke: AX, 'stroke-width': 1 });
      D.text([v, 0], f(v, 4), { anchor: 'middle', dy: 17, size: 10, color: '#7f8c8d', weight: 500 });
    }
    for (let v = Math.ceil(yB / step) * step; v < yT - 0.4 * step; v += step) {
      if (Math.abs(v) < step * 1e-6) continue;
      D.el('line', { x1: D.X(0) - 5, y1: D.Y(v), x2: D.X(0), y2: D.Y(v), stroke: AX, 'stroke-width': 1 });
      D.text([0, v], f(v, 4), { anchor: 'end', dx: -7, dy: 4, size: 10, color: '#7f8c8d', weight: 500 });
    }
    // envelopes (clipped to the frame)
    env.forEach((e, i) => {
      const t = Math.tan(e.phi), col = COL[e.col] || COL.main;
      const x0 = t > 1e-9 ? Math.max(xL, -e.c / t) : xL;
      let x1 = xR; if (t > 1e-9) x1 = Math.min(xR, (yT * 0.94 - e.c) / t);
      D.line([x0, e.c + x0 * t], [x1, e.c + x1 * t], { stroke: col, sw: 2.4 });
      D.line([x0, -(e.c + x0 * t)], [x1, -(e.c + x1 * t)], { stroke: col, sw: 1, dash: '5 5', op: 0.55 });
      const lab = e.phi > 1e-9 ? `${e.label}: φ = ${f(e.phi / DEG, 4)}°, c = ${f(e.c, 4)}` : `${e.label} (φ = 0)`;
      D.text([x1, e.c + x1 * t], lab, { anchor: 'end', dx: -4, dy: i || e.phi < 1e-9 ? 16 : -8, size: 11.5, color: col, weight: 700 });
    });
    // circles
    const failing = g.sub !== 'stress';
    circ.forEach((c, i) => {
      const C = (c.s1 + c.s3) / 2, R = (c.s1 - c.s3) / 2, col = COL[c.col] || COL.main;
      D.circle([C, 0], R, { fill: col, fop: 0.07, stroke: col, sw: 2 });
      D.dot([C, 0], col, '', { r: 2.6 });
      if (circ.length > 1) D.text([C, R], c.label.replace('specimen ', '').replace(' (effective)', '′').replace('test ', ''), { anchor: 'middle', dy: -4, size: 10.5, color: col, weight: 700 });
      if (failing) {
        const e = env.find((q) => q.col === c.col) || env[0];
        D.dot([C - R * Math.sin(e.phi), R * Math.cos(e.phi)], col, '', { r: 3.4 });
      }
    });
    // annotate the reference circle
    const ref = g.sub === 'stress' ? { s1: g.state.s1, s3: g.state.s3 } : g.sub === 'direct' ? circ[circ.length - 1] : (g.ref.s1 !== undefined ? (g.phi && s.sub === 'triax' && s.triax.type === 'CU' ? circ.find((c) => c.col === 'eff') : circ[0]) : circ[0]);
    const rc = COL[ref.col] || COL.main;
    if ((g.sub !== 'stress' || g.state.R > 0) && D.sc * (ref.s1 - ref.s3) > 140 && !(g.sub === 'stress' && s.stress.by === 'principal')) {
      const dy = g.sub === 'stress' ? 32 : -6;
      D.text([ref.s3, 0], `σ₃ = ${f(ref.s3)}`, { dx: 4, dy, size: 11, color: rc });
      D.text([ref.s1, 0], `σ₁ = ${f(ref.s1)}`, { anchor: 'end', dx: -4, dy, size: 11, color: rc });
    }
    const info = [];
    if (g.sub === 'stress') {
      const st = g.state, C = st.c0, R = st.R;
      const Rf = env[0].c * Math.cos(g.phi) + C * Math.sin(g.phi);
      if (Rf > 0 && Rf < 3 * Math.max(R, 1e-9)) D.circle([C, 0], Rf, { stroke: COL.tot, sw: 1.4, dash: '6 4' });
      if (s.stress.by === 'principal') {
        D.dot([st.s1, 0], AX, `σ₁ = ${f(st.s1)}`, { r: 4, dx: 6, dy: -8 });
        D.dot([st.s3, 0], AX, `σ₃ = ${f(st.s3)}`, { r: 4, anchor: 'end', dx: -6, dy: -8 });
      } else {
        D.line([st.sx, st.txy], [st.sy, -st.txy], { stroke: AX, sw: 1, dash: '3 3' });
        D.dot([st.sx, st.txy], AX, `x (${f(st.sx)}, ${f(st.txy)})`, { r: 4, dx: 6, dy: st.txy >= 0 ? -6 : 14 });
        D.dot([st.sy, -st.txy], AX, `y (${f(st.sy)}, ${f(-st.txy)})`, { r: 4, anchor: 'end', dx: -6, dy: st.txy >= 0 ? 14 : -6 });
      }
      D.line([C, 0], [st.sn, st.tn], { stroke: FP, sw: 1.6 });
      D.dot([st.sn, st.tn], FP, `θ plane (${f(st.sn)}, ${f(st.tn)})`, { r: 5, dx: st.sn >= C ? 8 : -8, anchor: st.sn >= C ? 'start' : 'end', dy: st.tn >= 0 ? -8 : 16 });
      const a0 = Math.atan2(st.txy, st.sx - C) / DEG;
      if (st.theta > 0.5 && R > 0) D.arc([C, 0], 26, a0, a0 - 2 * st.theta, `2θ = ${f(2 * st.theta, 3)}°`, { color: FP });
      info.push(`C = ${f(C)},  R = τ_max = ${f(R)} ${U.press}`, `critical radius R_f = c cos φ + C sin φ = ${f(Rf)}`, `FS = R_f / R = ${f(g.FS, 4)} — ${g.FS < 1 ? 'fails' : 'safe'}`);
    } else if (g.fpl) {
      const fp = g.fpl, pole = g.sub === 'direct' ? [2 * ((ref.s1 + ref.s3) / 2) - ref.sg, ref.tau] : [ref.s3, 0];
      if (g.sub === 'direct') {
        D.line(pole, [ref.sg, ref.tau], { stroke: FP, sw: 1.6, dash: '6 4' });
        D.line(pole, [ref.s1, 0], { stroke: PL, sw: 1.3, dash: '4 3' });
        D.dot(pole, PL, 'pole', { r: 4, anchor: 'end', dx: -7, dy: -6 });
        D.dot([ref.sg, ref.tau], FP, `failure (${f(ref.sg)}, ${f(ref.tau)})`, { r: 5, dy: -9 });
        info.push(`Last test: σ₁ = ${f(ref.s1)}, σ₃ = ${f(ref.s3)} ${U.press}`, `major principal plane at ${f(45 + g.phi / DEG / 2, 4)}° to the horizontal`, `φ = ${f(g.phi / DEG, 4)}°,  c = ${f(g.cc, 4)} ${U.press}`);
      } else {
        const F = [fp.sn, fp.tau];
        D.line(pole, F, { stroke: FP, sw: 1.8 });
        D.dot(pole, PL, 'pole', { r: 4, dx: -4, anchor: 'end', dy: 32 });
        D.dot(F, FP, `failure plane: σ = ${f(fp.sn)}, τ = ${f(fp.tau)}`, { r: 5, dy: -10, anchor: fp.sn > (ref.s1 + ref.s3) / 2 ? 'start' : 'end', dx: fp.sn > (ref.s1 + ref.s3) / 2 ? 8 : -8 });
        D.arc(pole, 30, 0, fp.th / DEG, `θ = ${f(fp.th / DEG, 4)}°`, { color: FP });
        const C = (ref.s1 + ref.s3) / 2;
        D.line([C, 0], F, { stroke: FP, sw: 1, dash: '3 3' });
        D.arc([C, 0], 18, 0, 2 * fp.th / DEG, '', { color: FP });
        if (g.sub === 'unconf') info.push(`q_u = ${f(ref.s1)} ${U.press} (σ₃ = 0)`, `s_u = q_u / 2 = ${f(g.cc)} ${U.press}`);
        else if (s.triax.type === 'UU') info.push(`Δσ_d is the same for every cell pressure`, `s_u = Δσ_d / 2 = ${f(g.cc)} ${U.press}`);
        else if (s.triax.type === 'CU') { const e = env[1], t = env[0]; info.push(`total: φ = ${f(t.phi / DEG, 4)}°, c = ${f(t.c, 4)}`, `effective: φ′ = ${f(e.phi / DEG, 4)}°, c′ = ${f(e.c, 4)}`, `θ = 45° + φ′/2 = ${f(fp.th / DEG, 4)}°`); }
        else info.push(`sin φ′ = (σ₁ − σ₃)/(σ₁ + σ₃ + 2c cot φ)`, `φ′ = ${f(g.phi / DEG, 4)}°,  c′ = ${f(g.cc, 4)} ${U.press}`, `θ = 45° + φ′/2 = ${f(fp.th / DEG, 4)}°`);
      }
    }
    if (info.length) infoBox(D, info, true);
    return D;
  }

  const GShear = {
    id: 'shear', title: 'Shear Strength',
    state: clone(base),
    presets: [
      { name: 'Test M1 — stress state σx = 100, σy = 40, τxy = 30 kPa → σ₁ = 112.4, σ₃ = 27.57 kPa; c = 10 kPa, φ = 30° (FS = 1.029)', apply: (s) => set(s, { sub: 'stress' }) },
      { name: 'Principal stresses σ₁ = 200, σ₃ = 80 kPa in sand (φ = 30°, c = 0): FS = 1.167, plane at 30°', apply: (s) => set(s, { sub: 'stress', stress: { by: 'principal', s1: 200, s3: 80, c: 0, phi: 30, theta: 30 } }) },
      { name: 'Test M2 — direct shear, 6 × 6 cm box: N = 180, 360, 540 N; S = 110, 200, 290 N → φ = 26.57°, c = 5.556 kPa', apply: (s) => set(s, { sub: 'direct' }) },
      { name: 'Dry sand direct shear (stresses given), envelope through the origin → φ = 35.68°', apply: (s) => set(s, { sub: 'direct', direct: { input: 'stress', fit: 'phi', tests: [{ N: 50, S: 36 }, { N: 100, S: 71 }, { N: 200, S: 144 }] } }) },
      { name: 'Test M3 — CD test on sand: σ₃ = 100 kPa, Δσ_d = 200 kPa → φ′ = 30°, θ = 60°', apply: (s) => set(s, { sub: 'triax' }) },
      { name: 'Two CD tests on clay (σ₃ = 50 and 150 kPa) → c′ = 10 kPa, φ′ = 25°', apply: (s) => set(s, { sub: 'triax', triax: { type: 'CD', fit: 'cphi', specs: [{ s3: 50, dd: 104.59, du: 0 }, { s3: 150, dd: 250.98, du: 0 }] } }) },
      { name: 'Test M4 — CU test: σ₃ = 150, Δσ_d = 180, Δu = 75 kPa → φ_cu = 22.02°, φ′ = 33.06°, A_f = 0.4167', apply: (s) => set(s, { sub: 'triax', triax: { type: 'CU', fit: 'phi', specs: [{ s3: 150, dd: 180, du: 75 }] } }) },
      { name: 'Normally consolidated clay, two CU tests with pore pressures (c fitted)', apply: (s) => set(s, { sub: 'triax', triax: { type: 'CU', fit: 'cphi', specs: [{ s3: 100, dd: 120, du: 55 }, { s3: 200, dd: 240, du: 110 }] } }) },
      { name: 'UU tests at three cell pressures → s_u = 42.5 kPa (φ_u = 0)', apply: (s) => set(s, { sub: 'triax', triax: { type: 'UU', fit: 'phi', specs: [{ s3: 50, dd: 84, du: 0 }, { s3: 100, dd: 85, du: 0 }, { s3: 150, dd: 86, du: 0 }] } }) },
      { name: 'Test M5 — unconfined: D = 3.8 cm, P = 170 N at ε = 8 % → q_u = 137.9 kPa, s_u = 68.95 kPa', apply: (s) => set(s, { sub: 'unconf' }) },
      { name: 'Sensitive clay: q_u = 120 kPa undisturbed, 25 kPa remolded (S_t = 4.8)', apply: (s) => set(s, { sub: 'unconf', ucs: { input: 'qu', qu: 120, sens: true, quR: 25 } }) },
      { name: 'English units: CD test σ₃ = 2000 psf, Δσ_d = 4000 psf → φ′ = 30°', units: 'EN', apply: (s) => { set(s, { sub: 'triax', triax: { type: 'CD', fit: 'phi', specs: [{ s3: 2000, dd: 4000, du: 0 }] } }); Object.assign(s.stress, { sx: 2000, sy: 800, txy: 600, s1: 4000, s3: 1600, c: 200 }); Object.assign(s.direct, { A: 6.25, tests: [{ N: 50, S: 33 }, { N: 100, S: 62 }, { N: 150, S: 91 }] }); Object.assign(s.ucs, { D: 1.5, Pf: 40, qu: 2000, quR: 500 }); } },
      { name: 'English units: direct shear, 2.5 × 2.5 in box, N = 50/100/150 lb → φ = 30.11°, c = 92.16 psf', units: 'EN', apply: (s) => { set(s, { sub: 'direct', direct: { input: 'force', A: 6.25, fit: 'cphi', tests: [{ N: 50, S: 33 }, { N: 100, S: 62 }, { N: 150, S: 91 }] } }); Object.assign(s.stress, { sx: 2000, sy: 800, txy: 600, s1: 4000, s3: 1600, c: 200 }); Object.assign(s.triax.specs[0], { s3: 2000, dd: 4000 }); Object.assign(s.ucs, { D: 1.5, Pf: 40, qu: 2000, quR: 500 }); } },
    ],
    legend() {
      const s = this.state;
      if (s.sub === 'stress') return [[COL.main, 'Mohr circle', 'ln'], [COL.tot, 'Mohr–Coulomb envelope / critical circle', 'ln'], [FP, 'plane at θ', 'ln'], [PL, 'σ₁ direction', 'ln']];
      const L = [];
      if (s.sub === 'triax' && s.triax.type !== 'CD') L.push([COL.tot, 'total stress', 'ln']);
      else if (s.sub !== 'triax') L.push([COL.main, 'Mohr circles and envelope', 'ln']);
      if (s.sub === 'triax' && s.triax.type !== 'UU') L.push([COL.eff, 'effective stress', 'ln']);
      if (s.sub === 'unconf') L[0] = [COL.tot, 'Mohr circle (σ₃ = 0)', 'ln'];
      L.push([FP, 'failure plane', 'ln'], [PL, 'pole', '']);
      return L;
    },
    toggle: 'Specimen sketch',
    plotCaption: 'p–q diagram and stresses on a plane versus its angle',
    hint() { return this.state.sub === 'stress' ? 'Click the Mohr circle to choose the plane angle θ.' : ''; },

    controls(el, C) {
      const s = this.state, U = root.App.U(), en = U.id === 'EN';
      const P = en ? 20 : 1, sl = (p, o, k, label, min, max, step, unit) => C.slider(p, { label, min, max, step, get: () => o[k], set: (v) => (o[k] = v), unit });
      C.seg(el, { label: 'Analysis', options: [['stress', 'Stress state'], ['direct', 'Direct shear'], ['triax', 'Triaxial'], ['unconf', 'Unconfined']], get: () => s.sub, set: (v) => (s.sub = v) });
      if (s.sub === 'stress') {
        const o = s.stress, g = C.section(el, 'Stresses on the element');
        C.seg(g, { label: 'Given', options: [['xy', 'σx, σy, τxy'], ['principal', 'σ₁, σ₃']], get: () => o.by, set: (v) => (o.by = v) });
        if (o.by === 'xy') { sl(g, o, 'sx', 'Normal stress σx', -200 * P, 1000 * P, 0.1, U.press); sl(g, o, 'sy', 'Normal stress σy', -200 * P, 1000 * P, 0.1, U.press); sl(g, o, 'txy', 'Shear stress τxy', -500 * P, 500 * P, 0.1, U.press); }
        else { sl(g, o, 's1', 'Major principal stress σ₁', 0, 1000 * P, 0.1, U.press); sl(g, o, 's3', 'Minor principal stress σ₃', -200 * P, 1000 * P, 0.1, U.press); }
        sl(g, o, 'theta', 'Plane angle θ (normal from the x axis)', 0, 180, 0.1, '°');
        C.note(g, 'Compression is positive. τxy is positive as drawn on the element.');
        const m = C.section(el, 'Mohr–Coulomb strength');
        sl(m, o, 'c', 'Cohesion c', 0, 300 * P, 0.1, U.press); sl(m, o, 'phi', 'Friction angle φ', 0, 50, 0.1, '°');
      } else if (s.sub === 'direct') {
        const o = s.direct, g = C.section(el, 'Direct shear tests');
        const fu = en ? 'lb' : 'N', byF = o.input === 'force';
        C.seg(g, { label: 'Readings', options: [['force', `Loads N, S (${fu})`], ['stress', `Stresses σ, τ (${U.press})`]], get: () => o.input, set: (v) => (o.input = v) });
        if (byF) sl(g, o, 'A', 'Box area A', 1, en ? 20 : 150, 0.01, U.areaS);
        C.layers(g, { layers: o.tests, max: 5, min: 1, soil: false, add: '+ Add test', title: (i) => `Test ${i + 1}`, fields: [{ k: 'N', label: byF ? 'Normal load N' : 'Normal stress σ', unit: byF ? fu : U.press }, { k: 'S', label: byF ? 'Shear at failure S' : 'Shear stress τ_f', unit: byF ? fu : U.press }], make: (ls) => { const l = ls[ls.length - 1]; return { N: +(l.N * 1.5).toPrecision(4), S: +(l.S * 1.4).toPrecision(4) }; } });
        C.seg(g, { label: 'Envelope', options: [['cphi', 'c and φ (least squares)'], ['phi', 'φ only (c = 0)']], get: () => o.fit, set: (v) => (o.fit = v) });
      } else if (s.sub === 'triax') {
        const o = s.triax, g = C.section(el, 'Triaxial test');
        C.seg(g, { label: 'Test type', options: [['CD', 'CD (drained)'], ['CU', 'CU (with Δu)'], ['UU', 'UU (undrained)']], get: () => o.type, set: (v) => (o.type = v) });
        C.layers(g, { layers: o.specs, max: 4, min: 1, soil: false, add: '+ Add specimen', title: (i) => `Specimen ${i + 1}`, fields: [{ k: 's3', label: 'Cell pressure σ₃', unit: U.press }, { k: 'dd', label: 'Deviator at failure Δσ_d', unit: U.press }, { k: 'du', label: 'Pore pressure Δu_f', unit: U.press, show: () => o.type === 'CU' }], make: (ls) => { const l = ls[ls.length - 1]; return { s3: +(l.s3 * 2).toPrecision(4), dd: +(l.dd * 1.8).toPrecision(4), du: +(l.du * 2).toPrecision(4) }; } });
        if (o.type !== 'UU') C.seg(g, { label: 'Envelope', options: [['phi', 'φ only (c = 0)'], ['cphi', 'c and φ (p–q fit)']], get: () => o.fit, set: (v) => (o.fit = v) });
        C.note(g, o.type === 'CD' ? 'Drained: Δu = 0, so total and effective stresses are equal.' : o.type === 'CU' ? 'Consolidated undrained: the effective circles are the total circles shifted left by Δu.' : 'Unconsolidated undrained on saturated clay: every circle has the same size, φ_u = 0.');
      } else {
        const o = s.ucs, g = C.section(el, 'Unconfined compression test');
        C.seg(g, { label: 'Input', options: [['load', 'Failure load and strain'], ['qu', 'q_u given']], get: () => o.input, set: (v) => (o.input = v) });
        if (o.input === 'load') { sl(g, o, 'D', 'Specimen diameter D', 0.5, en ? 6 : 15, 0.01, U.lenS); sl(g, o, 'Pf', 'Axial load at failure P', 1, en ? 500 : 2000, 0.1, en ? 'lb' : 'N'); sl(g, o, 'eps', 'Axial strain at failure ε', 0, 30, 0.1, '%'); }
        else sl(g, o, 'qu', 'Unconfined strength q_u', 1, 1000 * P, 0.1, U.press);
        C.toggle(g, { label: 'Sensitivity (remolded test)', get: () => o.sens, set: (v) => (o.sens = v) });
        if (o.sens) sl(g, o, 'quR', 'Remolded strength q_u,r', 0.1, 500 * P, 0.1, U.press);
      }
    },
    onUnits(from, to) {
      const s = this.state, k = to === 'EN' ? 1 : -1, S = Math.pow(STR, k), F = Math.pow(FRC, k), A = Math.pow(AR, k), L = Math.pow(LN, k), r = (x) => +(+x).toPrecision(5);
      ['sx', 'sy', 'txy', 's1', 's3', 'c'].forEach((q) => (s.stress[q] = r(s.stress[q] * S)));
      const byF = s.direct.input === 'force';
      s.direct.A = r(s.direct.A * A);
      s.direct.tests.forEach((t) => { t.N = r(t.N * (byF ? F : S)); t.S = r(t.S * (byF ? F : S)); });
      s.triax.specs.forEach((t) => { t.s3 = r(t.s3 * S); t.dd = r(t.dd * S); t.du = r(t.du * S); });
      s.ucs.D = r(s.ucs.D * L); s.ucs.Pf = r(s.ucs.Pf * F); s.ucs.qu = r(s.ucs.qu * S); s.ucs.quR = r(s.ucs.quR * S);
    },
    compute(U) { return Physics.shear(this.state, U); },
    onClick(pt, res) {
      const s = this.state, g = res.geo;
      if (s.sub !== 'stress' || !g.state || !(g.state.R > 0)) return false;
      const st = g.state, a0 = Math.atan2(st.txy, st.sx - st.c0), a = Math.atan2(pt[1], pt[0] - st.c0);
      let th = ((a0 - a) / 2) / DEG; th = ((th % 180) + 180) % 180;
      s.stress.theta = +th.toFixed(1);
      return true;
    },

    draw2D(svg, res, U, opts) { mohr(svg, res.geo, this.state, U, opts.showP !== false); },

    draw3D(V, res, U, opts) {
      const g = res.geo, s = this.state;
      const tot = '#c0392b';
      if (g.sub === 'triax' || g.sub === 'unconf') {
        const r = 0.5, h = 2, th = g.fpl ? g.fpl.th : Math.PI / 4, ref = g.circles[0];
        if (g.sub === 'triax') V.lathe([[0, -0.15], [1.05, -0.15], [1.05, h + 0.3], [0, h + 0.3]], '#4aa3df', 0.1, null, 36);
        V.lathe([[0, 0], [r, 0], [r, h], [0, h]], (G.SOILS[g.sub === 'unconf' || s.triax.type !== 'CD' ? 'clay' : 'sand']).c3d, 0.55, null, 36);
        V.circle(0, 0, 0, r, '#2c3e50', 1.5); V.circle(0, h, 0, r, '#2c3e50', 1.5);
        V.lathe([[0, h], [0.6, h], [0.6, h + 0.08], [0, h + 0.08]], '#95a5a6', 0.95, null, 36);
        V.lathe([[0, -0.08], [0.6, -0.08], [0.6, 0], [0, 0]], '#95a5a6', 0.95, null, 36);
        const pts = []; let tn = Math.tan(th); if (r * tn > h / 2 * 0.98) tn = (h / 2 * 0.98) / r;
        for (let i = 0; i <= 48; i++) { const t = (i / 48) * 2 * Math.PI; pts.push([r * Math.cos(t), h / 2 + r * Math.cos(t + 0.6) * tn, r * Math.sin(t)]); }
        V.face(pts, FP, 0.6, FP, 1.5);
        G.arrow3D(V, [0, h + 0.75, 0], [0, h + 0.1, 0], tot, 3, `σ₁ = ${f(ref.s1)} ${U.press}`, 0.12);
        if (g.sub === 'triax') {
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([cx, cz], i) => G.arrow3D(V, [cx * 0.98, h * 0.45, cz * 0.98], [cx * (r + 0.04), h * 0.45, cz * (r + 0.04)], '#1f6fa8', 2.2, i === 0 ? `σ₃ = ${f(ref.s3)} ${U.press}` : null, 0.1));
        }
        V.label([r * Math.cos(-0.6), h / 2 + r * tn, r * Math.sin(-0.6)], `failure plane θ = ${f(th / DEG, 4)}°`, FP);
        V.dim([-r, -0.1, 0.7], [r, -0.1, 0.7], s.sub === 'unconf' && s.ucs.input === 'load' ? `D = ${f(s.ucs.D)} ${U.lenS}` : 'D', [0, -0.15, 0]);
      } else if (g.sub === 'direct') {
        const w = 2, hb = 0.45, d = 0.15;
        V.box(0, -hb, 0, w, 0, w, G.SOILS.sand.c3d, 0.9, '#333');
        V.box(d, 0, 0, w + d, hb, w, G.SOILS.sand.c3d, 0.75, '#333');
        V.box(d - 0.05, hb, -0.05, w + d + 0.05, hb + 0.1, w + 0.05, '#95a5a6', 0.95, '#555');
        V.face([[-0.1, 0, -0.1], [w + d + 0.1, 0, -0.1], [w + d + 0.1, 0, w + 0.1], [-0.1, 0, w + 0.1]], FP, 0.35, FP, 2);
        const last = s.direct.tests.filter((t) => t.N > 0).slice(-1)[0] || { N: 0, S: 0 }, fu = s.direct.input === 'force' ? (U.id === 'SI' ? ' N' : ' lb') : ' ' + U.press;
        G.arrow3D(V, [w / 2 + d, hb + 0.9, w / 2], [w / 2 + d, hb + 0.12, w / 2], tot, 3, `N = ${f(last.N)}${fu}`, 0.14);
        G.arrow3D(V, [d - 0.9, hb / 2, w / 2], [d - 0.02, hb / 2, w / 2], PL, 3, `S = ${f(last.S)}${fu}`, 0.14);
        G.arrow3D(V, [w + 0.9, -hb / 2, w / 2], [w + 0.02, -hb / 2, w / 2], '#7f8c8d', 2.4, null, 0.12);
        V.label([w + d, 0, 0], 'horizontal failure plane', FP);
        V.dim([0, -hb, w + 0.1], [w, -hb, w + 0.1], s.direct.input === 'force' ? `A = ${f(s.direct.A)} ${U.areaS}` : 'box', [0, -0.25, 0]);
      } else {
        const a = 1, st = g.state, th = st.theta * DEG;
        V.box(-a, -a, 0, a, a, 2 * a, G.SOILS.silt.c3d, 0.45, '#333');
        const ux = -Math.sin(th), uy = Math.cos(th), k = Math.min(Math.abs(ux) > 1e-9 ? a / Math.abs(ux) : 1e9, Math.abs(uy) > 1e-9 ? a / Math.abs(uy) : 1e9);
        V.face([[-ux * k, -uy * k, 0], [ux * k, uy * k, 0], [ux * k, uy * k, 2 * a], [-ux * k, -uy * k, 2 * a]], FP, 0.55, FP, 1.5);
        const pr = s.stress.by === 'principal';
        [[1, 0], [-1, 0]].forEach(([sx], i) => G.arrow3D(V, [sx * (a + 0.8), 0, a], [sx * (a + 0.02), 0, a], tot, 2.8, i ? null : `${pr ? 'σ₁' : 'σx'} = ${f(st.sx)}`, 0.12));
        [[1], [-1]].forEach(([sy], i) => G.arrow3D(V, [0, sy * (a + 0.8), a], [0, sy * (a + 0.02), a], tot, 2.8, i ? null : `${pr ? 'σ₃' : 'σy'} = ${f(st.sy)}`, 0.12));
        if (Math.abs(st.txy) > 1e-9) { const t = Math.sign(st.txy); G.arrow3D(V, [a + 0.08, -t * 0.5, 2 * a], [a + 0.08, t * 0.5, 2 * a], PL, 2.2, `τxy = ${f(st.txy)}`, 0.1); G.arrow3D(V, [-t * 0.5, a + 0.08, 2 * a], [t * 0.5, a + 0.08, 2 * a], PL, 2.2, null, 0.1); }
        V.label([ux * k, uy * k, 2 * a], `plane θ = ${f(st.theta, 4)}°: σ = ${f(st.sn)}, τ = ${f(st.tn)}`, FP);
      }
      V.autoBounds();
    },

    plot(svg, res, U) {
      const g = res.geo, s = this.state, { W, H } = G.chartSurface(svg), R = G.panels(W, H, 2);
      // panel 1
      if (g.sub === 'direct') {
        const pts = g.points, xm = Math.max(...pts.map((p) => p[0])) * 1.2, t = Math.tan(g.phi);
        G.chart(svg, R[0], { title: 'Shear strength versus normal stress', xlab: `normal stress σ (${U.press})`, ylab: `τ_f (${U.press})`, xmin: 0, xmax: xm, ymin: 0, ymax: Math.max(g.cc + xm * t, ...pts.map((p) => p[1])) * 1.1, series: [{ pts: [[0, g.cc], [xm, g.cc + xm * t]], color: COL.main, w: 2.2, label: `τ = ${f(g.cc, 4)} + σ tan ${f(g.phi / DEG, 4)}°` }], marks: pts.map((p, i) => ({ x: p[0], y: p[1], label: `${i + 1}`, color: COL.tot, anchor: 'end', dy: -6 })) });
      } else {
        const circ = g.circles, pq = circ.map((c) => [(c.s1 + c.s3) / 2, (c.s1 - c.s3) / 2]);
        const xm = Math.max(...pq.map((p) => p[0])) * 1.3 || 1;
        const ser = g.env.map((e) => ({ pts: [[0, e.c * Math.cos(e.phi)], [xm, e.c * Math.cos(e.phi) + xm * Math.sin(e.phi)]], color: COL[e.col] || COL.main, w: 2.2, label: `K_f${g.env.length > 1 ? ' (' + e.label + ')' : ''}: a = ${f(e.c * Math.cos(e.phi), 4)}, α = ${f(Math.atan(Math.sin(e.phi)) / DEG, 4)}°` }));
        const ym = Math.max(...pq.map((p) => p[1]), ...ser.map((q) => q.pts[1][1])) * (g.env.every((e) => e.phi < 1e-9) ? 1.5 : 1.1);
        G.chart(svg, R[0], { title: g.sub === 'stress' ? 'p–q point of the stress state and the K_f line' : 'p–q diagram (tops of the Mohr circles)', xlab: `p = (σ₁ + σ₃)/2 (${U.press})`, ylab: `q = (σ₁ − σ₃)/2`, xmin: Math.min(0, ...pq.map((p) => p[0])), xmax: xm, ymin: 0, ymax: ym, series: ser, marks: pq.map((p, i) => ({ x: p[0], y: p[1], label: circ.length > 1 ? `${i + 1}${circ[i].col === 'eff' && s.triax.type === 'CU' ? '′' : ''}` : `(${f(p[0])}, ${f(p[1])})`, color: COL[circ[i].col] || COL.main, anchor: 'end' })) });
      }
      // panel 2: stresses on a plane versus its angle
      let C, Rr, a0 = 0, xlab = 'plane angle θ from the major principal plane (°)', mark;
      if (g.sub === 'stress') { C = g.state.c0; Rr = g.state.R; a0 = Math.atan2(g.state.txy, g.state.sx - C); xlab = 'plane angle θ, normal from the x axis (°)'; mark = g.state.theta; }
      else { const ref = g.sub === 'direct' ? g.circles[g.circles.length - 1] : (s.sub === 'triax' && s.triax.type === 'CU' ? g.circles.find((c) => c.col === 'eff') : g.ref || g.circles[0]); C = (ref.s1 + ref.s3) / 2; Rr = (ref.s1 - ref.s3) / 2; mark = g.fpl ? g.fpl.th / DEG : 45; }
      const sg = [], tu = [], tf = [], cc = g.sub === 'stress' ? g.env[0].c : g.cc, tp = Math.tan(g.phi);
      for (let i = 0; i <= 180; i += 2) { const a = a0 - 2 * i * DEG, sn = C + Rr * Math.cos(a), tn = Rr * Math.sin(a); sg.push([i, sn]); tu.push([i, Math.abs(tn)]); tf.push([i, cc + Math.max(0, sn) * tp]); }
      const ym = Math.max(...sg.map((p) => p[1]), ...tf.map((p) => p[1])) * 1.08, yn = Math.min(0, ...sg.map((p) => p[1]));
      const am = a0 - 2 * mark * DEG;
      G.chart(svg, R[1], { title: 'Stresses on a plane versus its angle', xlab, ylab: U.press, xmin: 0, xmax: 180, ymin: yn, ymax: ym, series: [{ pts: sg, color: COL.main, w: 2.2, label: 'normal stress σ' }, { pts: tu, color: PL, w: 2.2, label: '|τ| on the plane' }, { pts: tf, color: COL.tot, w: 1.6, dash: '6 4', label: 'strength c + σ tan φ' }], vlines: [{ x: mark, color: FP, label: g.sub === 'stress' ? `θ = ${f(mark, 4)}°` : `θ_f = ${f(mark, 4)}°` }], marks: [{ x: mark, y: Math.abs(Rr * Math.sin(am)), color: FP }] });
      return true;
    },
  };

  root.GShear = GShear;
})(window);
