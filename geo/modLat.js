/* =====================================================================
 * STEP 6 — Lateral Earth Pressure & Retaining Walls (UI, FBD, charts, 3D)
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Physics } = root;
  const G = root.GeoUI;
  const f = Physics.fmt, DEG = Math.PI / 180;
  const SP = '#d35400', WP = '#2980b9', TP = '#8e44ad', WT = '#2c3e50', PP = '#16a085', BP = '#c0392b', SUR = '#e67e22';
  const LEN = 1 / 0.3048, GAM = 6.365880, STR = 20.885434;

  const lay = (soil, H, g, gsat, phi, c) => ({ soil, H, g, gsat, phi, c });
  const cant = { t1: 0.3, bf: 0.2, bb: 0, Lt: 0.7, Lh: 2.3, tb: 0.7, Hs: 5.3 };
  const grav = { t1: 0.6, bf: 0.4, bb: 1.2, Lt: 0.5, Lh: 0.4, tb: 0.8, Hs: 4.2 };
  const base = {
    sub: 'wall', theory: 'rankine', state: 'A', H: 6, layers: [lay('sand', 6, 18, 20, 30, 0)], wt: false, zw: 3, q: 0, beta: 0, theta: 0, delta: 20, OCR: 1, neglect: true,
    gc: 24, uplift: true, passive: false, wall: Object.assign({}, cant), found: { phi: 20, c: 40, g: 19, Df: 1.5, k1: 2 / 3, k2: 2 / 3, qu: 600 },
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const set = (s, over) => { const b = clone(base); Object.keys(b).forEach((k) => { s[k] = b[k]; }); Object.keys(over || {}).forEach((k) => { s[k] = (typeof over[k] === 'object' && !Array.isArray(over[k])) ? Object.assign(s[k], over[k]) : over[k]; }); };

  /** Clip a polygon to the horizontal strip ylo ≤ y ≤ yhi. */
  function clipY(poly, ylo, yhi) {
    const cut = (pts, keep, yc) => {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length], ia = keep(a[1]), ib = keep(b[1]);
        if (ia) out.push(a);
        if (ia !== ib) { const t = (yc - a[1]) / (b[1] - a[1]); out.push([a[0] + t * (b[0] - a[0]), yc]); }
      }
      return out;
    };
    let p = cut(poly, (y) => y >= ylo - 1e-12, ylo);
    if (p.length) p = cut(p, (y) => y <= yhi + 1e-12, yhi);
    return p;
  }
  /** Draw the layered backfill inside polygon `poly`; layers measured down from `ref`. */
  function backfill(D, poly, s, ref, yw) {
    let top = 1e9, t = ref;
    s.layers.forEach((l, i) => {
      const bot = i === s.layers.length - 1 ? -1e9 : t - l.H; t -= l.H;
      const pc = clipY(poly, bot, top); top = bot;
      if (pc.length > 2) {
        D.poly(pc, { fill: G.soilFill(l.soil), stroke: 'none' });
        if (yw !== null) { const wp = clipY(pc, -1e9, yw); if (wp.length > 2) D.poly(wp, { fill: '#4aa3df', fop: 0.16 }); }
      }
    });
    t = ref;
    s.layers.forEach((l, i) => { t -= l.H; if (i < s.layers.length - 1) { const pc = clipY(poly, t - 1e-6, t + 1e-6); if (pc.length) { const xs = pc.map((q) => q[0]); D.line([Math.min(...xs), t], [Math.max(...xs), t], { stroke: '#6b5b45', sw: 1, dash: '5 3' }); } } });
  }
  function infoBox(D, lines, right, colors) {
    const w = Math.max(...lines.map((l) => l.length)) * 6.3 + 20, x = right ? D.W - w - 12 : 12;
    D.el('rect', { x, y: 12, width: w, height: 14 + lines.length * 18, rx: 7, fill: '#ffffff', 'fill-opacity': 0.92, stroke: '#c4ced9' });
    lines.forEach((l, i) => D.text([x + 10, 30 + i * 18], l, { px: true, size: 12, color: (colors && colors[i]) || '#1d2733', weight: colors && colors[i] ? 700 : 600 }));
  }
  /** Pressure diagram along a vertical line x = x0 (values from pts {y, sh, u}); drawn toward +dir. */
  function pdiag(D, pts, x0, k, dir, key, o) {
    const poly = [[x0, pts[0].y]].concat(pts.map((q) => [x0 + dir * k * Math.max(o.neg ? -1e9 : 0, key(q)), q.y]), [[x0, pts[pts.length - 1].y]]);
    D.poly(poly, { fill: o.color, fop: o.fop || 0.28, stroke: o.color, sw: 1.6 });
  }
  /** Value of key at elevation y from the breakpoint list (descending y). */
  function valAt(pts, y, key) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (y <= a.y + 1e-9 && y >= b.y - 1e-9 && a.y - b.y > 1e-12) return key(a) + (key(b) - key(a)) * (a.y - y) / (a.y - b.y);
    }
    return key(pts[pts.length - 1]);
  }
  /** Arrows of the lateral pressure along the plane x(y), drawn on the face z. */
  function arrows3D(V, pts, xat, k, z, H) {
    const top = pts[0].y, bot = pts[pts.length - 1].y;
    for (let j = 0; j <= 8; j++) {
      const y = bot + ((top - bot) * (j + 0.5)) / 9, v = Math.max(0, valAt(pts, y, (q) => q.sh)) + valAt(pts, y, (q) => q.u);
      if (v * k > 0.015 * H) G.arrow3D(V, [xat(y) + v * k, y, z], [xat(y) + 0.01 * H, y, z], SP, 1.8, null, 0.035 * H);
    }
  }
  const yfmt = (v) => f(Math.abs(v) < 1e-9 ? 0 : v);

  const GLat = {
    id: 'lat', title: 'Lateral Earth Pressure & Retaining Walls',
    state: clone(base),
    presets: [
      { name: 'Test L1 — Rankine active, sand H = 6 m, γ = 18 kN/m³, φ = 30° → K_a = 1/3, P_a = 108 kN/m at 2 m', apply: (s) => set(s, { sub: 'press' }) },
      { name: 'Same wall with a surcharge q = 20 kPa → P_a = 148 kN/m at 2.27 m', apply: (s) => set(s, { sub: 'press', q: 20 }) },
      { name: 'Test L2 — c–φ soil (γ = 17, φ = 26°, c = 15 kPa): tension crack z_c = 2.824 m, P_a = 33.48 kN/m', apply: (s) => set(s, { sub: 'press', layers: [lay('clay', 6, 17, 19, 26, 15)] }) },
      { name: 'Test L3 — two layers with water table at 3 m → P_soil = 76.40, P_w = 44.14 kN/m', apply: (s) => set(s, { sub: 'press', layers: [lay('sand', 3, 16, 18, 30, 0), lay('gravel', 3, 17, 19, 34, 0)], wt: true, zw: 3 }) },
      { name: 'Rankine passive, sand H = 6 m → K_p = 3, P_p = 972 kN/m', apply: (s) => set(s, { sub: 'press', state: 'P' }) },
      { name: 'At rest, overconsolidated sand OCR = 2 → K₀ = 0.7071', apply: (s) => set(s, { sub: 'press', state: '0', OCR: 2 }) },
      { name: 'Rankine, backfill sloping at β = 10° → K_a = 0.3495, thrust parallel to the slope', apply: (s) => set(s, { sub: 'press', beta: 10 }) },
      { name: 'Test L4 — Coulomb: θ = 10°, δ = 20°, β = 10°, φ = 30° → K_a = 0.4376, P_a = 141.8 kN/m', apply: (s) => set(s, { sub: 'press', theory: 'coulomb', theta: 10, delta: 20, beta: 10 }) },
      { name: 'Test W1 — cantilever wall H = 6 m, B = 3.5 m (Rankine): FS_OT = 3.098, FS_s = 1.586, q_toe = 154.1 kPa', apply: (s) => set(s, { sub: 'wall' }) },
      { name: 'Same wall counting passive resistance in front (D = 1.5 m) → FS_s = 3.58', apply: (s) => set(s, { sub: 'wall', passive: true }) },
      { name: 'Cantilever wall, backfill sloping 15°, water table 3 m below the top (fails in sliding)', apply: (s) => set(s, { sub: 'wall', beta: 15, wt: true, zw: 3 }) },
      { name: 'Gravity wall by Coulomb (δ = 20°), back batter 1.2 m', apply: (s) => set(s, { sub: 'wall', theory: 'coulomb', wall: Object.assign({}, grav), found: { Df: 1.2 } }) },
      { name: 'Cantilever wall, two-layer backfill with surcharge 15 kPa, passive resistance counted', apply: (s) => set(s, { sub: 'wall', layers: [lay('sand', 2.5, 17.5, 19.5, 32, 0), lay('silt', 4, 18.5, 20, 28, 5)], q: 15, passive: true, wall: { t1: 0.35, bf: 0.25, bb: 0, Lt: 1, Lh: 3, tb: 0.8, Hs: 5.7 }, found: { Df: 1.8 } }) },
      { name: 'English units: cantilever wall H = 20 ft, sand γ = 115 pcf, φ = 32°', units: 'EN', apply: (s) => set(s, { sub: 'wall', H: 20, zw: 10, layers: [lay('sand', 20, 115, 125, 32, 0)], gc: 150, wall: { t1: 1, bf: 0.75, bb: 0, Lt: 2.5, Lh: 8, tb: 2.25, Hs: 17.75 }, found: { phi: 22, c: 800, g: 120, Df: 4, qu: 12000 } }) },
    ],
    legend() {
      const s = this.state;
      const L = [[SP, 'effective soil pressure', 'sq'], [WP, 'water pressure', 'sq']];
      if (s.sub === 'wall') L.push([WT, 'weights', 'ln'], [PP, 'passive', 'sq'], [BP, 'base pressure', 'sq']);
      return L;
    },
    toggle() { return this.state.sub === 'wall' ? 'Free-body diagram (forces)' : 'Pressure diagrams'; },
    plotCaption() { return this.state.sub === 'wall' ? 'Lateral pressure with depth and contact pressure under the base' : 'Lateral pressure with depth and K versus φ'; },

    controls(el, C) {
      const s = this.state, U = root.App.U(), en = U.id === 'EN', L1 = en ? LEN : 1, P = en ? 20 : 1;
      const sl = (p, o, k, label, min, max, step, unit) => C.slider(p, { label, min, max, step, get: () => o[k], set: (v) => (o[k] = v), unit });
      C.seg(el, { label: 'Analysis', options: [['press', 'Earth pressure on a wall'], ['wall', 'Retaining wall stability']], get: () => s.sub, set: (v) => (s.sub = v) });
      const t = C.section(el, 'Theory');
      if (s.sub === 'press') C.seg(t, { label: 'Pressure state', options: [['A', 'Active'], ['P', 'Passive'], ['0', 'At rest']], get: () => s.state, set: (v) => (s.state = v) });
      if (s.sub === 'wall' || s.state !== '0') C.seg(t, { label: 'Method', options: s.sub === 'wall' ? [['rankine', 'Rankine'], ['coulomb', 'Coulomb'], ['rest', 'At rest (K₀)']] : [['rankine', 'Rankine'], ['coulomb', 'Coulomb']], get: () => s.theory, set: (v) => (s.theory = v) });
      const rest = (s.sub === 'press' && s.state === '0') || (s.sub === 'wall' && s.theory === 'rest');
      if (rest) sl(t, s, 'OCR', 'Overconsolidation ratio OCR', 1, 10, 0.01, '');
      if (!rest) sl(t, s, 'beta', 'Backfill slope β', 0, 40, 0.1, '°');
      if (s.theory === 'coulomb' && !rest) {
        sl(t, s, 'delta', 'Wall friction δ', 0, 40, 0.1, '°');
        if (s.sub === 'press') sl(t, s, 'theta', 'Wall back angle θ from the vertical', -20, 30, 0.1, '°');
        else C.note(t, 'The Coulomb plane runs from the heel bottom to the top of the stem back; its angle θ follows from the wall shape.');
      }
      if (s.sub === 'press') sl(t, s, 'H', 'Wall height H', 0.5, en ? 60 : 20, 0.01, U.len);
      const b = C.section(el, 'Backfill layers (from the top of the wall)');
      C.layers(b, { layers: s.layers, max: 4, min: 1, title: (i) => `Layer ${i + 1}`, fields: [{ k: 'H', label: 'Thickness', unit: U.len }, { k: 'g', label: 'γ (moist)', unit: U.gamma }, { k: 'gsat', label: 'γ_sat', unit: U.gamma }, { k: 'phi', label: 'φ', unit: '°' }, { k: 'c', label: 'c', unit: U.press }], make: (ls) => { const l = ls[ls.length - 1]; return Object.assign({}, l, { soil: l.soil === 'sand' ? 'clay' : 'sand', H: +(l.H / 2).toPrecision(3) }); } });
      C.note(b, 'The last layer continues below the base. Coulomb and sloping Rankine solutions ignore c.');
      const w = C.section(el, 'Surcharge and water');
      sl(w, s, 'q', 'Uniform surcharge q', 0, 200 * P, 0.1, U.press);
      C.toggle(w, { label: 'Water table in the backfill', get: () => s.wt, set: (v) => (s.wt = v) });
      if (s.wt) sl(w, s, 'zw', 'Depth of the water table below the top', 0, (s.sub === 'wall' ? s.wall.Hs + s.wall.tb : s.H), 0.01, U.len);
      if (s.layers.some((l) => l.c > 0)) C.toggle(w, { label: 'Neglect the tension zone (crack)', get: () => s.neglect, set: (v) => (s.neglect = v) });
      if (s.sub === 'wall') {
        const g = C.section(el, 'Wall (split into pieces)'), o = s.wall;
        sl(g, o, 'Hs', 'Stem height', 0.5, 15 * L1, 0.01, U.len);
        sl(g, o, 't1', 'Stem thickness at the top', 0.1, 3 * L1, 0.01, U.len);
        sl(g, o, 'bf', 'Front batter (horizontal)', 0, 3 * L1, 0.01, U.len);
        sl(g, o, 'bb', 'Back batter (horizontal)', 0, 4 * L1, 0.01, U.len);
        sl(g, o, 'tb', 'Base thickness', 0.1, 3 * L1, 0.01, U.len);
        sl(g, o, 'Lt', 'Toe length', 0, 5 * L1, 0.01, U.len);
        sl(g, o, 'Lh', 'Heel length', 0, 10 * L1, 0.01, U.len);
        sl(g, s, 'gc', 'Unit weight of the wall γ_c', 10, en ? 200 : 30, 0.01, U.gamma);
        const gm = Physics.wallGeom(o);
        C.note(g, `H = ${f(gm.H)} ${U.len},  B = ${f(gm.B)} ${U.len}. Dashed lines split the wall into rectangles and triangles.`);
        const fd = C.section(el, 'Foundation soil and checks'), q = s.found;
        sl(fd, q, 'phi', 'Friction angle φ₂', 0, 45, 0.1, '°');
        sl(fd, q, 'c', 'Cohesion c₂', 0, 150 * P, 0.1, U.press);
        sl(fd, q, 'g', 'Unit weight γ₂', 10 * (en ? 6 : 1), 25 * (en ? 6 : 1), 0.1, U.gamma);
        sl(fd, q, 'k1', 'Base friction factor k₁ (δ_b = k₁ φ₂)', 0, 1, 0.01, '');
        sl(fd, q, 'k2', 'Adhesion factor k₂ (c_a = k₂ c₂)', 0, 1, 0.01, '');
        sl(fd, q, 'Df', 'Soil depth in front of the toe D', 0, 5 * L1, 0.01, U.len);
        C.toggle(fd, { label: 'Count passive resistance in sliding', get: () => s.passive, set: (v) => (s.passive = v) });
        if (s.wt) C.toggle(fd, { label: 'Uplift on the base', get: () => s.uplift, set: (v) => (s.uplift = v) });
        sl(fd, q, 'qu', 'Ultimate bearing capacity q_u (0 to skip)', 0, 2000 * P, 1, U.press);
      }
    },
    onUnits(from, to) {
      const s = this.state, k = to === 'EN' ? 1 : -1, L = Math.pow(LEN, k), Gm = Math.pow(GAM, k), S = Math.pow(STR, k), r = (x) => +(+x).toPrecision(5);
      s.H = r(s.H * L); s.zw = r(s.zw * L); s.q = r(s.q * S); s.gc = r(s.gc * Gm);
      s.layers.forEach((l) => { l.H = r(l.H * L); l.g = r(l.g * Gm); l.gsat = r(l.gsat * Gm); l.c = r(l.c * S); });
      ['t1', 'bf', 'bb', 'Lt', 'Lh', 'tb', 'Hs'].forEach((q) => (s.wall[q] = r(s.wall[q] * L)));
      s.found.c = r(s.found.c * S); s.found.g = r(s.found.g * Gm); s.found.Df = r(s.found.Df * L); s.found.qu = r(s.found.qu * S);
    },
    compute(U) { return Physics.lateral(this.state, U); },

    draw2D(svg, res, U, opts) { if (res.geo.sub === 'wall') this.drawWall(svg, res.geo, U, opts.showP !== false); else this.drawPress(svg, res.geo, U, opts.showP !== false); },

    drawPress(svg, g, U, show) {
      const s = this.state, r = g.r, H = g.H, th = g.theta * DEG, tb = Math.tan(g.beta * DEG);
      const Ws = 0.55 * H, tw = 0.14 * H, pw = 0.42 * H, gap = 0.1 * H;
      const panels = show ? (r.Pw > 0 ? 3 : 1) : 0;
      const x0 = Math.min(0, H * Math.tan(th)) - tw, xEnd = Ws + (panels ? 0.12 * H + panels * (pw + gap) : 0.1 * H);
      const yTop = H + Ws * Math.max(0, tb) + (s.q > 0 ? 0.12 * H : 0.04 * H);
      const D = root.UI.Draw2D(svg, { xmin: x0 - 0.06 * H, xmax: xEnd, ymin: -0.1 * H, ymax: yTop + 0.06 * H }, { pad: 34, padT: 20 });
      G.soilDefs(svg);
      const xb = H * Math.tan(th);
      const soil = [[xb, 0], [0, H], [Ws, H + Ws * tb], [Ws, 0]];
      backfill(D, soil, s, H, r.yw === -Infinity || r.yw === null ? null : r.yw);
      D.poly([[xb, 0], [Ws, 0], [Ws, -0.06 * H], [x0, -0.06 * H], [x0, 0]], { fill: G.soilFill(s.layers[s.layers.length - 1].soil), stroke: 'none' });
      D.poly([[x0, 0], [xb, 0], [0, H], [x0, H]], { fill: 'url(#concrete)', stroke: '#6e6a5e', sw: 1.6 });
      D.line([0, H], [Ws, H + Ws * tb], { stroke: '#6b5b45', sw: 1.6 });
      if (r.yw !== null && r.yw > -Infinity && r.yw > 0) { D.line([Math.max(0, xb * (1 - r.yw / H)), r.yw], [Ws, r.yw], { stroke: WP, sw: 1.4, dash: '6 4' }); D.fs([Ws * 0.7, r.yw], { label: 'GWT' }); }
      if (s.q > 0) { D.poly([[0, H + 0.005 * H], [Ws, H + Ws * tb + 0.005 * H], [Ws, H + Ws * tb + 0.03 * H], [0, H + 0.03 * H]], { fill: SUR, fop: 0.35, stroke: SUR }); for (let i = 1; i <= 4; i++) { const x = (Ws * i) / 5; D.arrow([x, H + x * tb + 0.11 * H], [x, H + x * tb + 0.035 * H], { color: SUR, w: 1.4, head: 7 }); } D.text([Ws / 2, H + Ws / 2 * tb + 0.11 * H], `q = ${f(s.q)} ${U.press}`, { anchor: 'middle', dy: -4, size: 11.5, color: SUR, weight: 700 }); }
      if (g.beta > 0) D.arc([0, H], 40, 0, g.beta, `β = ${f(g.beta)}°`, { color: '#6b5b45' });
      if (Math.abs(g.theta) > 0.01) { D.line([xb, 0], [xb, 0.35 * H], { stroke: '#7f8c8d', sw: 1, dash: '3 3' }); D.arc([xb, 0], 34, 90, 90 + g.theta, `θ = ${f(g.theta)}°`, { color: '#6e6a5e' }); }
      D.dim([x0, 0], [x0, H], `H = ${f(H)}`, 16, { anchor: 'end', ldx: -6 });
      if (r.zc !== null && s.state === 'A' && r.zc > 0) { const yc = H - r.zc; D.line([0.01 * H, H], [0.03 * H, Math.max(0, yc)], { stroke: BP, sw: 2 }); D.text([0.03 * H, Math.max(0, yc)], `crack z_c = ${f(r.zc)}`, { dx: 5, dy: 4, size: 10.5, color: BP }); }
      // resultant on the wall back
      const om = g.om, ya = r.yPs, xa = xb * (1 - ya / H);
      const dir = s.state === 'P' ? [-Math.cos(om), Math.sin(-om)] : [-Math.cos(om), -Math.sin(om)];
      if (r.Ps > 0) D.force([xa, ya], dir, 70, { color: SP, label: `${s.state === 'P' ? 'P_p' : s.state === '0' ? 'P₀' : 'P_a'} = ${f(r.Ps)}`, ldx: -6, ldy: -8, anchor: 'end' });
      if (r.Pw > 0) D.force([xb * (1 - r.yPw / H), r.yPw], [-1, 0], 55, { color: WP, label: `P_w = ${f(r.Pw)}`, ldx: -6, ldy: 18, anchor: 'end' });
      if (!panels) return;
      // diagrams
      const pts = r.pts, mx = Math.max(...pts.map((q) => Math.max(q.sh + q.u, q.sh, q.u, 0)), 1e-9), k = (0.8 * pw) / mx;
      const defs = [{ key: (q) => q.sh, col: SP, title: `σ′h (${U.press})`, P: r.Ps, y: r.yPs }];
      if (r.Pw > 0) defs.push({ key: (q) => q.u, col: WP, title: `u (${U.press})`, P: r.Pw, y: r.yPw }, { key: (q) => q.sh + q.u, col: TP, title: `σh = σ′h + u`, P: r.Ps + r.Pw, y: (r.Ps * r.yPs + r.Pw * r.yPw) / (r.Ps + r.Pw) });
      defs.forEach((d, j) => {
        const gx = Ws + 0.12 * H + j * (pw + gap);
        D.line([gx, H], [gx, 0], { stroke: '#2c3e50', sw: 1.2 });
        D.line([gx, 0], [gx + pw, 0], { stroke: '#bdc3c7', sw: 0.8 });
        D.text([gx + pw / 2, H], d.title, { anchor: 'middle', dy: -8, size: 11.5, color: d.col, weight: 700 });
        pdiag(D, pts, gx, k, 1, d.key, { color: d.col, neg: !s.neglect });
        const seen = new Set();
        pts.forEach((q, i) => {
          const v = d.key(q), tag = q.y.toFixed(5) + ':' + v.toFixed(5);
          if (seen.has(tag) || (Math.abs(v) < 1e-9 && i !== pts.length - 1) || (v < 0 && s.neglect)) return; seen.add(tag);
          const dup = i > 0 && Math.abs(pts[i - 1].y - q.y) < 1e-9;
          D.text([gx + k * Math.max(0, v), q.y], yfmt(v), { dx: 4, dy: dup ? 12 : -3, size: 10, color: d.col });
        });
        if (d.P > 0) { D.force([gx, d.y], [-1, 0], 40, { color: d.col, label: `${f(d.P)} @ ${f(d.y)}`, ldx: 4, ldy: -8, size: 11 }); }
        if (j === 0 && r.zc !== null && s.state === 'A' && r.zc > 0) D.text([gx, H - r.zc], `z_c = ${f(r.zc)}`, { dx: 4, dy: -3, size: 10, color: BP });
      });
    },

    drawWall(svg, g, U, show) {
      const s = this.state, w = s.wall, r = g.r, gm = g.g, H = gm.H, B = gm.B, tb = Math.tan(g.beta * DEG);
      const xs = gm.xs, xL = -Math.max(0.35 * H, 0.15 * H + (s.found.Df > 0 ? 0.25 * H : 0)), xR = B + 0.75 * H;
      const surf = (x) => H + Math.max(0, x - xs) * tb;
      const yTop = Math.max(surf(xR), H) + (s.q > 0 ? 0.13 * H : 0.05 * H);
      const D = root.UI.Draw2D(svg, { xmin: xL, xmax: xR + 0.02 * H, ymin: -0.42 * H, ymax: yTop + 0.03 * H }, { pad: 30, padT: 20 });
      G.soilDefs(svg);
      const yw = g.yw;
      // ground below the base and backfill
      D.poly([[xL, 0], [xR, 0], [xR, -0.42 * H], [xL, -0.42 * H]], { fill: G.soilFill(s.layers[s.layers.length - 1].soil === 'clay' ? 'silt' : 'clay'), stroke: 'none', op: 0.75 });
      const bf = [[xs, H], [gm.xsb, w.tb], [B, w.tb], [B, 0], [xR, 0], [xR, surf(xR)]];
      backfill(D, bf, s, H, yw);
      if (s.found.Df > 0) G.soilRect(D, xL, 0, w.Lt, s.found.Df, 'silt', { stroke: 'none' });
      D.line([xs, H], [xR, surf(xR)], { stroke: '#6b5b45', sw: 1.6 });
      if (s.found.Df > 0) D.line([xL, s.found.Df], [w.Lt + (w.bf * Math.min(1, (s.found.Df - w.tb) / w.Hs)), s.found.Df], { stroke: '#6b5b45', sw: 1.4 });
      // concrete
      D.poly(gm.outline, { fill: 'url(#concrete)', stroke: '#5d5a50', sw: 2 });
      if (yw !== null && yw > 0) { D.line([gm.xsb + (xs - gm.xsb) * Math.max(0, (yw - w.tb) / w.Hs), yw], [xR, yw], { stroke: WP, sw: 1.4, dash: '6 4' }); D.fs([xR - 0.12 * H, yw], { label: 'GWT' }); }
      if (s.q > 0) { const xa = xs + 0.02 * H; D.poly([[xa, surf(xa) + 0.005 * H], [xR, surf(xR) + 0.005 * H], [xR, surf(xR) + 0.03 * H], [xa, surf(xa) + 0.03 * H]], { fill: SUR, fop: 0.35, stroke: SUR }); for (let i = 1; i <= 5; i++) { const x = xa + ((xR - xa) * i) / 6; D.arrow([x, surf(x) + 0.12 * H], [x, surf(x) + 0.035 * H], { color: SUR, w: 1.4, head: 7 }); } D.text([xR, surf(xR) + 0.12 * H], `q = ${f(s.q)} ${U.press}`, { anchor: 'end', dy: -4, size: 11.5, color: SUR, weight: 700 }); }
      // pieces
      g.pieces.forEach((p) => {
        D.poly(p.poly, { stroke: p.kind === 'conc' ? '#5d5a50' : '#6b5b45', sw: 1.1, dash: '5 4' });
        D.el('circle', { cx: D.X(p.x), cy: D.Y(p.y), r: 9, fill: '#fff', stroke: p.kind === 'conc' ? '#5d5a50' : '#8d6e3f', 'stroke-width': 1.3 });
        D.text([p.x, p.y], String(p.n), { anchor: 'middle', dy: 4, size: 10.5, color: '#1d2733', weight: 700 });
      });
      // the analysis plane
      const pl = g.plane;
      D.line([pl.xBot, 0], [pl.xTop, pl.top], { stroke: SP, sw: 1.6, dash: '8 4' });
      // dimensions
      D.dim([0, -0.34 * H], [B, -0.34 * H], `B = ${f(B)}`, 0, { ldy: 16 });
      if (w.Lt > 0) D.dim([0, -0.25 * H], [w.Lt, -0.25 * H], `${f(w.Lt)}`, 0, { ldy: -5 });
      if (w.Lh > 0) D.dim([gm.xsb, -0.25 * H], [B, -0.25 * H], `${f(w.Lh)}`, 0, { ldy: -5 });
      D.dim([w.Lt + w.bf, H], [xs, H], `${f(w.t1)}`, 12, {});
      D.dim([xL + 0.04 * H, 0], [xL + 0.04 * H, H], `H = ${f(H)}`, -10, { anchor: 'start', ldx: 6 });
      D.dim([0, 0], [0, w.tb], `${f(w.tb)}`, 10, { anchor: 'end', ldx: -6 });
      if (Math.abs(pl.top - H) > 1e-6) D.dim([pl.xTop + 0.02 * H, 0], [pl.xTop + 0.02 * H, pl.top], `H′ = ${f(pl.top)}`, -8, { anchor: 'start', ldx: 6 });
      // pressure diagram on the analysis plane (vertical projection)
      const pts = r.pts, mx = Math.max(...pts.map((q) => q.sh + q.u), 1e-9), k = (0.38 * H) / mx;
      const tanT = Math.tan(g.theta * DEG), xat = (y) => pl.xBot - y * tanT;
      const poly1 = pts.map((q) => [xat(q.y) + k * Math.max(0, q.sh), q.y]), base1 = [[xat(pts[pts.length - 1].y), pts[pts.length - 1].y], [xat(pts[0].y), pts[0].y]];
      D.poly(poly1.concat(base1.reverse()).reverse(), { fill: '#fff', fop: 0.7 });
      D.poly([[xat(pts[0].y), pts[0].y]].concat(poly1, [[xat(pts[pts.length - 1].y), pts[pts.length - 1].y]]), { fill: SP, fop: 0.22, stroke: SP, sw: 1.5 });
      if (r.Pw > 0) {
        const wpts = pts.filter((q) => q.u > 0 || Math.abs(q.y - (yw || 0)) < 1e-9);
        D.poly(pts.map((q) => [xat(q.y) + k * Math.max(0, q.sh), q.y]).concat(pts.slice().reverse().map((q) => [xat(q.y) + k * (Math.max(0, q.sh) + q.u), q.y])), { fill: WP, fop: 0.3, stroke: WP, sw: 1.3 });
        const qb = pts[pts.length - 1]; D.text([xat(0) + k * (Math.max(0, qb.sh) + qb.u), 0], `σh = ${f(qb.sh + qb.u)}`, { dx: 4, dy: -4, size: 10.5, color: TP }); void wpts;
      }
      const qb = pts[pts.length - 1];
      D.text([xat(0) + k * Math.max(0, qb.sh), 0], `σ′h = ${f(qb.sh)}`, { dx: 4, dy: r.Pw > 0 ? -18 : -4, size: 10.5, color: SP });
      const info = [`FS overturning = ${f(g.FSo, 4)} ${g.FSo >= 2 ? '≥ 2 ✓' : '< 2 ✗'}`, `FS sliding = ${f(g.FSs, 4)} ${g.FSs >= 1.5 ? '≥ 1.5 ✓' : '< 1.5 ✗'}`];
      const cols = [g.FSo >= 2 ? '#1e8449' : BP, g.FSs >= 1.5 ? '#1e8449' : BP];
      if (g.FSb !== null) { info.push(`FS bearing = ${f(g.FSb, 4)} ${g.FSb >= 3 ? '≥ 3 ✓' : '< 3 ✗'}`); cols.push(g.FSb >= 3 ? '#1e8449' : BP); }
      info.push(`e = ${f(g.e)} ${Math.abs(g.e) <= B / 6 ? '≤' : '>'} B/6 = ${f(B / 6)} ${U.len}`); cols.push(null);
      infoBox(D, info, false, cols);
      if (!show) return;
      // forces (free-body diagram)
      const om = g.om;
      D.force([xat(r.yPs), r.yPs], [-Math.cos(om), -Math.sin(om)], 80, { color: SP, label: `P_a = ${f(r.Ps)}`, ldx: 0, ldy: -10, anchor: 'end', lp: 'tail' });
      if (r.Pw > 0) D.force([xat(r.yPw), r.yPw], [-1, -Math.tan(g.theta * DEG) * 0], 60, { color: WP, label: `P_w = ${f(r.Pw)}`, ldx: 4, ldy: 16 });
      D.text([xat(r.yPs), r.yPs], `ȳ = ${f(r.yPs)}`, { dx: 6, dy: 14, size: 10.5, color: SP });
      g.pieces.forEach((p) => { D.force([p.x, p.y - 0.01 * H], [0, -1], 30, { color: WT, w: 2, head: 8, label: `W${p.n} = ${f(p.W)}`, ldx: 5, ldy: -2, size: 10.5 }); });
      // passive
      if (s.found.Df > 0 && g.Pp > 0) {
        const Df = s.found.Df, Kp = g.Kp, c2 = s.found.c, g2 = s.found.g, top = 2 * c2 * Math.sqrt(Kp), bot = top + Kp * g2 * Df, kp = (0.22 * H) / Math.max(bot, 1e-9);
        D.poly([[0, Df], [-kp * top, Df], [-kp * bot, 0], [0, 0]], { fill: PP, fop: g.usePp ? 0.3 : 0.12, stroke: PP, sw: 1.3, dash: g.usePp ? undefined : '4 3' });
        D.force([0, g.yPp], [1, 0], 50, { color: PP, dash: g.usePp ? undefined : '6 4' });
        D.text([-kp * top, Df], `P_p = ${f(g.Pp)}${g.usePp ? '' : ' (ignored)'}`, { anchor: 'middle', dy: -8, size: 11.5, color: PP, weight: 700 });
      }
      // base contact pressure
      const kq = (0.16 * H) / Math.max(g.qmax, 1e-9), y0 = -0.005 * H;
      D.poly([[0, y0], [B, y0], [B, y0 - kq * g.qh], [0, y0 - kq * g.qt]], { fill: BP, fop: 0.22, stroke: BP, sw: 1.4 });
      for (let i = 0; i <= 6; i++) { const x = (B * i) / 6, q = g.qt + ((g.qh - g.qt) * i) / 6; if (q * kq > 0.012 * H) D.arrow([x, y0 - kq * q], [x, y0], { color: BP, w: 1.3, head: 6 }); }
      D.text([0, y0 - kq * g.qt], `q_toe = ${f(g.qt)}`, { anchor: 'end', dx: -4, dy: 4, size: 10.5, color: BP });
      D.text([B, y0 - kq * g.qh], `q_heel = ${f(g.qh)}`, { dx: 4, dy: 4, size: 10.5, color: BP });
      if (g.Uup > 0) D.force([g.xU, 0], [0, 1], 40, { color: WP, label: `U = ${f(g.Uup)}`, ldx: 5, ldy: 14, lp: 'tail' });
      // resultant on the base
      const xr = B / 2 - g.e;
      D.force([xr, 0], [0, 1], 40, { color: '#2c3e50', w: 2.4 });
      D.text([xr, 0], `R_v = ${f(g.V)} at ${f(xr)} from the toe`, { dx: 8, dy: 30, size: 11, color: '#2c3e50', weight: 700 });
    },

    draw3D(V, res, U) {
      const g = res.geo, s = this.state;
      if (g.sub === 'wall') {
        const gm = g.g, H = gm.H, B = gm.B, Lz = 0.7 * H, xR = B + 0.6 * H, tb = Math.tan(g.beta * DEG), sf = (x) => H + Math.max(0, x - gm.xs) * tb;
        V.extrude(gm.outline, 0, Lz, '#c9c6bb', 0.95, '#5d5a50');
        const L = s.layers; let t = H;
        L.forEach((l, i) => {
          const bot = i === L.length - 1 ? 0 : Math.max(0, t - l.H), topY = i === 0 ? 1e9 : t; t -= l.H;
          const pc = clipY([[gm.xs, H], [gm.xsb, s.wall.tb], [B, s.wall.tb], [B, 0], [xR, 0], [xR, sf(xR)]], bot, topY);
          if (pc.length > 2) V.extrude(pc, 0, Lz, G.SOILS[l.soil].c3d, 0.55, '#6b5b45');
        });
        const pl = g.plane, tanT = Math.tan(g.theta * DEG);
        const k = (0.3 * H) / Math.max(...g.r.pts.map((q) => q.sh + q.u), 1e-9);
        arrows3D(V, g.r.pts, (y) => pl.xBot - y * tanT, k, Lz + 0.01 * H, H);
        G.arrow3D(V, [pl.xBot - g.r.yPs * tanT + 0.35 * H, g.r.yPs, Lz / 2], [pl.xBot - g.r.yPs * tanT, g.r.yPs, Lz / 2], SP, 3.2, `P_a = ${f(g.r.Ps)} ${U.fpl}`, 0.06 * H);
        g.pieces.forEach((p) => G.arrow3D(V, [p.x, p.y, Lz + 0.05], [p.x, p.y - 0.15 * H, Lz + 0.05], WT, 2, p.n === 1 ? 'W' : null, 0.03 * H));
        V.dim([0, 0, Lz + 0.1 * H], [B, 0, Lz + 0.1 * H], `B = ${f(B)} ${U.len}`, [0, -0.1 * H, 0]);
        V.dim([0, 0, 0], [0, H, 0], `H = ${f(H)} ${U.len}`, [-0.15 * H, 0, 0]);
      } else {
        const H = g.H, Ws = 0.6 * H, Lz = 0.7 * H, th = Math.tan(g.theta * DEG), tw = 0.12 * H, tb = Math.tan(g.beta * DEG), xb = H * th;
        V.extrude([[Math.min(0, xb) - tw, 0], [xb, 0], [0, H], [Math.min(0, xb) - tw, H]], 0, Lz, '#c9c6bb', 0.95, '#5d5a50');
        const L = s.layers; let t = H;
        L.forEach((l, i) => {
          const bot = i === L.length - 1 ? 0 : Math.max(0, t - l.H), topY = i === 0 ? 1e9 : t; t -= l.H;
          const pc = clipY([[xb, 0], [0, H], [Ws, H + Ws * tb], [Ws, 0]], bot, topY);
          if (pc.length > 2) V.extrude(pc, 0, Lz, G.SOILS[l.soil].c3d, 0.5, '#6b5b45');
        });
        const k = (0.4 * H) / Math.max(...g.r.pts.map((q) => q.sh + q.u), 1e-9);
        arrows3D(V, g.r.pts, (y) => xb * (1 - y / H), k, Lz + 0.01 * H, H);
        G.arrow3D(V, [xb * (1 - g.r.yPs / H) + 0.45 * H, g.r.yPs, Lz / 2], [xb * (1 - g.r.yPs / H), g.r.yPs, Lz / 2], SP, 3.2, `P = ${f(g.r.Ps)} ${U.fpl}`, 0.06 * H);
        V.dim([Math.min(0, xb) - tw, 0, 0], [Math.min(0, xb) - tw, H, 0], `H = ${f(H)} ${U.len}`, [-0.12 * H, 0, 0]);
      }
      V.autoBounds();
    },

    plot(svg, res, U) {
      const g = res.geo, s = this.state, r = g.r, { W, H } = G.chartSurface(svg), R = G.panels(W, H, 2);
      const top = r.top, z = (q) => top - q.y;
      const ser = [{ pts: r.pts.map((q) => [Math.max(s.neglect ? 0 : -1e9, q.sh), z(q)]), color: SP, w: 2.4, label: 'σ′h effective' }];
      if (r.Pw > 0) ser.push({ pts: r.pts.map((q) => [q.u, z(q)]), color: WP, w: 2, label: 'u water' }, { pts: r.pts.map((q) => [Math.max(0, q.sh) + q.u, z(q)]), color: TP, w: 2, dash: '6 4', label: 'σh total' });
      ser.push({ pts: r.pts.map((q) => [q.sv, z(q)]), color: '#95a5a6', w: 1.4, dash: '3 3', label: 'σ′v' });
      const xm = Math.max(...r.pts.map((q) => Math.max(q.sv, q.sh + q.u))) * 1.05;
      G.chart(svg, R[0], { title: 'Pressure versus depth on the wall plane', xlab: `stress (${U.press})`, ylab: `depth z (${U.len})`, ydown: true, ymin: 0, ymax: r.H, xmin: Math.min(0, ...r.pts.map((q) => q.sh)), xmax: xm, series: ser, hlines: r.zc !== null && s.state === 'A' ? [{ y: r.zc, label: 'z_c', color: BP }] : [] });
      if (g.sub === 'wall') {
        const B = g.g.B, xs = [], qs = [];
        for (let i = 0; i <= 40; i++) { const x = (B * i) / 40; xs.push(x); }
        const qx = (x) => { const a = Math.abs(g.e) <= B / 6 ? null : 3 * (B / 2 - Math.abs(g.e)); if (a === null) return g.qt + ((g.qh - g.qt) * x) / B; return g.e > 0 ? Math.max(0, g.qmax * (1 - x / a)) : Math.max(0, g.qmax * (1 - (B - x) / a)); };
        xs.forEach((x) => qs.push([x, qx(x)]));
        const sr = [{ pts: qs, color: BP, w: 2.4, fill: true, label: 'contact pressure q' }];
        if (g.Uup > 0) sr.push({ pts: [[0, 0], [B, g.uh]], color: WP, w: 1.6, dash: '5 4', label: 'uplift u' });
        G.chart(svg, R[1], { title: 'Pressure under the base (toe at x = 0)', xlab: `x from the toe (${U.len})`, ylab: U.press, xmin: 0, xmax: B, ymin: 0, ymax: Math.max(g.qmax, g.uh) * 1.2, series: sr, hlines: s.found.qu > 0 && s.found.qu < g.qmax * 1.2 ? [{ y: s.found.qu, label: 'q_u', color: '#7f8c8d' }] : [], marks: [{ x: 0, y: g.qt, label: f(g.qt), color: BP }, { x: B, y: g.qh, label: f(g.qh), color: BP, anchor: 'end' }] });
      } else {
        const ka = [], kp = [], k0 = [];
        for (let p = 0; p <= 45; p += 1) { const r1 = p * DEG; ka.push([p, Physics.kRankine(r1, 0, false)]); kp.push([p, Physics.kRankine(r1, 0, true)]); k0.push([p, Physics.kRest(r1, 1)]); }
        const phi = s.layers[0].phi;
        G.chart(svg, R[1], { title: 'K_a, K_p and K₀ versus φ (level backfill)', xlab: 'φ (°)', ylab: 'K', xmin: 0, xmax: 45, ymin: 0, ymax: 6, series: [{ pts: kp.filter((q) => q[1] <= 6), color: PP, w: 2.2, label: 'K_p' }, { pts: k0, color: '#7f8c8d', w: 2, dash: '5 4', label: 'K₀' }, { pts: ka, color: SP, w: 2.2, label: 'K_a' }], vlines: [{ x: phi, label: `φ = ${f(phi)}°`, color: '#34495e' }], marks: [{ x: phi, y: r.Ks[0], label: `K = ${f(r.Ks[0])}`, color: SP }] });
      }
      return true;
    },
  };

  root.GLat = GLat;
})(window);
