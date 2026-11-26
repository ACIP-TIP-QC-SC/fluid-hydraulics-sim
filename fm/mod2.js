/* =====================================================================
 * MODULE 2 — Buoyancy and flotation (UI + diagrams)
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Physics } = root;
  const { COL } = root.UI;
  const f = Physics.fmt;
  const BODY = Physics.BODY;
  const PI = Math.PI;

  const defDims = {};
  Object.keys(BODY).forEach((k) => { defDims[k] = {}; BODY[k].dims.forEach((d) => (defDims[k][d.k] = d.def)); });

  const M2 = {
    id: 'm2', title: 'Buoyancy & Flotation',
    state: {
      sub: 'body', sgL: 1, drive: 'sg', sgB: 0.6, W: 10, shape: 'box', dims: defDims, mode: 'auto', draft: 0.5, P: 0,
      layer: false, sg2: 0.8, t2: 0.3, layer3: false, sg3: 0.7, t3: 0.2, stab: false, zG: null, phi: 10,
      ballast: { on: false, bodyDef: 'solid', Wbody: 860, matDef: 'sg', sgb: 11.3, gb: 700, place: 'inside', solve: 'findW', targetBy: 'draft', target: 0.8, givenBy: 'W', Wb: 1, mb: 10 },
    },
    presets: [
      { name: 'Test 3 — Floating cube 1 m, Sg_B = 0.60', apply: (s) => { Object.assign(s, { sgL: 1, drive: 'sg', sgB: 0.6, shape: 'box', mode: 'auto', P: 0, layer: false }); s.dims.box = { L: 1, B: 1, H: 1 }; } },
      { name: 'Wooden log Ø0.6 × 4 m, Sg 0.65 (side)', apply: (s) => { Object.assign(s, { sgL: 1, drive: 'sg', sgB: 0.65, shape: 'hcyl', mode: 'auto', P: 0, layer: false }); s.dims.hcyl = { Dc: 0.6, L: 4 }; } },
      { name: 'Sphere Ø1 m, Sg 0.4 in seawater', apply: (s) => { Object.assign(s, { sgL: 1.03, drive: 'sg', sgB: 0.4, shape: 'sphere', mode: 'auto', P: 0, layer: false }); s.dims.sphere = { Ds: 1 }; } },
      { name: 'Cone apex down Ø1 × 1.2 m, Sg 0.5', apply: (s) => { Object.assign(s, { sgL: 1, drive: 'sg', sgB: 0.5, shape: 'coneDown', mode: 'auto', P: 0, layer: false }); s.dims.coneDown = { Dc: 1, H: 1.2 }; } },
      { name: 'Block in oil (0.3 m) over water', apply: (s) => { Object.assign(s, { sgL: 1, drive: 'sg', sgB: 0.9, shape: 'box', mode: 'auto', P: 0, layer: true, sg2: 0.8, t2: 0.3 }); s.dims.box = { L: 1, B: 1, H: 1 }; } },
      { name: 'Block in three liquids: oil 0.2 m / oil 0.3 m / water', apply: (s) => { Object.assign(s, { sgL: 1, drive: 'sg', sgB: 0.92, shape: 'box', mode: 'auto', P: 0, layer: true, sg2: 0.85, t2: 0.3, layer3: true, sg3: 0.7, t3: 0.2 }); s.dims.box = { L: 1, B: 1, H: 1 }; } },
      { name: 'Sphere Ø1 m, Sg 1.1: oil / water / glycerin (3 layers)', apply: (s) => { Object.assign(s, { sgL: 1.26, drive: 'sg', sgB: 1.1, shape: 'sphere', mode: 'auto', P: 0, layer: true, sg2: 1, t2: 0.4, layer3: true, sg3: 0.8, t3: 0.3 }); s.dims.sphere = { Ds: 1 }; } },
      { name: 'Steel-loaded block that sinks (needs lift)', apply: (s) => { Object.assign(s, { sgL: 1, drive: 'sg', sgB: 1.4, shape: 'box', mode: 'auto', P: 0, layer: false }); s.dims.box = { L: 2, B: 1, H: 1 }; } },
      { name: 'Ballast test 1a — hollow cyl. 860 lb, lead OUTSIDE (EN)', units: 'EN', apply: (s) => { Object.assign(s, { sgL: 1, shape: 'vcyl', mode: 'auto', P: 0, layer: false, stab: false }); s.dims.vcyl = { Dc: 3, H: 5 }; Object.assign(s.ballast, { on: true, bodyDef: 'hollow', Wbody: 860, matDef: 'gamma', gb: 700, place: 'outside', solve: 'findW', targetBy: 'draft', target: 3 }); } },
      { name: 'Ballast test 1b — same, lead INSIDE (EN)', units: 'EN', apply: (s) => { Object.assign(s, { sgL: 1, shape: 'vcyl', mode: 'auto', P: 0, layer: false, stab: false }); s.dims.vcyl = { Dc: 3, H: 5 }; Object.assign(s.ballast, { on: true, bodyDef: 'hollow', Wbody: 860, matDef: 'gamma', gb: 700, place: 'inside', solve: 'findW', targetBy: 'draft', target: 3 }); } },
      { name: 'Ballast test 2 — wood 70×70×1500 mm, lead Sg 11.2 outside, 0.30 m above', apply: (s) => { Object.assign(s, { sgL: 1, drive: 'sg', sgB: 0.6, shape: 'box', mode: 'auto', P: 0, layer: false, stab: false }); s.dims.box = { L: 0.07, B: 0.07, H: 1.5 }; Object.assign(s.ballast, { on: true, bodyDef: 'solid', matDef: 'sg', sgb: 11.2, place: 'outside', solve: 'findW', targetBy: 'proj', target: 0.3 }); } },
      { name: 'Barge stability: 6×3×1.5 m, Sg 0.5, G at 0.9 m', apply: (s) => { Object.assign(s, { sgL: 1, drive: 'sg', sgB: 0.5, shape: 'box', mode: 'auto', P: 0, layer: false, stab: true, zG: 0.9, phi: 10 }); s.dims.box = { L: 6, B: 3, H: 1.5 }; } },
    ],

    controls(el, C) {
      const s = this.state, U = root.App.U(), B = BODY[s.shape], d = s.dims[s.shape];
      if (root.StatX) {
        C.seg(el, { label: 'Problem', options: [['body', 'Floating or submerged body']].concat(root.StatX.options('m2')), get: () => s.sub || 'body', set: (v) => (s.sub = v) });
        if (root.StatX.is(s.sub, 'm2')) { root.StatX.controls(s.sub, s, el, C); return; }
      }
      C.sg(el, { label: 'Liquid Sg_L', get: () => s.sgL, set: (v) => (s.sgL = v) });
      const b = C.section(el, 'Body');
      const opts = Object.keys(BODY).map((k) => [k, BODY[k].name, BODY[k].group]);
      C.select(b, { label: 'Shape', options: opts, get: () => s.shape, set: (v) => (s.shape = v) });
      B.dims.forEach((dm) => C.slider(b, { label: dm.label, min: 0.05, max: dm.max || 10, step: 0.01, get: () => d[dm.k], set: (v) => (d[dm.k] = v), unit: dm.area ? U.area : U.len }));
      const hollowB = s.ballast.on && s.ballast.bodyDef === 'hollow';
      if (hollowB) C.note(b, 'Hollow container: weight is set in the ballast panel below.');
      else C.seg(b, { label: 'Body defined by', options: [['sg', 'Sg_B'], ['W', 'Weight W']], get: () => s.drive, set: (v) => (s.drive = v) });
      if (hollowB) { /* weight from ballast panel */ } else if (s.drive === 'sg') C.slider(b, { label: 'Body specific gravity Sg_B', min: 0.05, max: 10, step: 0.01, get: () => s.sgB, set: (v) => (s.sgB = v), unit: '' });
      else C.slider(b, { label: 'Body weight W', min: 0, max: 5000, step: 0.01, get: () => s.W, set: (v) => (s.W = v), unit: U.force });
      C.slider(b, { label: 'External load P (+down / −up)', min: -1000, max: 1000, step: 0.01, get: () => s.P, set: (v) => (s.P = v), unit: U.force });

      const m = C.section(el, 'Solve mode');
      if (s.ballast.on) C.note(m, 'Ballast panel is on — it sets its own solve mode below.');
      else C.seg(m, { options: [['auto', 'Auto equilibrium'], ['manual', 'Manual draft']], get: () => s.mode, set: (v) => (s.mode = v) });
      if (s.mode === 'manual' && !s.ballast.on) {
        const Hmax = B.H(d) + (s.layer ? s.t2 + (s.layer3 ? s.t3 : 0) : 0);
        C.slider(m, { label: 'Draft D', min: 0, max: +Hmax.toFixed(3), step: 0.001, get: () => Math.min(s.draft, Hmax), set: (v) => (s.draft = v), unit: U.len });
      }
      const l = C.section(el, 'Additional liquid layers (up to three liquids)');
      C.toggle(l, { label: 'Lighter liquid layer on top (e.g. oil over water)', get: () => s.layer, set: (v) => (s.layer = v) });
      if (s.layer) {
        C.slider(l, { label: 'Upper layer Sg₂', min: 0.5, max: 13.6, step: 0.01, get: () => s.sg2, set: (v) => (s.sg2 = v), unit: '' });
        C.slider(l, { label: 'Upper layer thickness t₂', min: 0, max: 10, step: 0.01, get: () => s.t2, set: (v) => (s.t2 = v), unit: U.len });
        C.toggle(l, { label: 'Third liquid on top of that', get: () => s.layer3, set: (v) => (s.layer3 = v) });
        if (s.layer3) {
          C.slider(l, { label: 'Top layer Sg₃', min: 0.5, max: 13.6, step: 0.01, get: () => s.sg3, set: (v) => (s.sg3 = v), unit: '' });
          C.slider(l, { label: 'Top layer thickness t₃', min: 0, max: 10, step: 0.01, get: () => s.t3, set: (v) => (s.t3 = v), unit: U.len });
        }
      }
      ballastControls(el, C, s, U, B, d);
      const st = C.section(el, 'Stability');
      if (s.ballast.on) C.note(st, 'Stability is not computed while ballast is attached (G of the combined body depends on the ballast position).');
      else C.toggle(st, { label: 'Show stability (metacentre)', get: () => s.stab, set: (v) => (s.stab = v) });
      if (s.stab && !s.ballast.on) {
        C.toggle(st, { label: 'Custom height of G (otherwise geometric centroid)', get: () => s.zG !== null, set: (v) => { s.zG = v ? +(B.H(d) / 2).toFixed(3) : null; } });
        if (s.zG !== null) C.slider(st, { label: 'KG — height of G above the bottom', min: 0, max: +B.H(d).toFixed(3), step: 0.001, get: () => s.zG, set: (v) => (s.zG = v), unit: U.len });
        C.slider(st, { label: 'Heel angle φ', min: 0, max: 30, step: 0.1, get: () => s.phi, set: (v) => (s.phi = v), unit: '°' });
      }
    },

    compute(U) {
      const s = this.state;
      return Physics.buoyancy({ sgL: s.sgL, drive: s.drive, sgB: s.sgB, W: s.W, shape: s.shape, dims: s.dims[s.shape], mode: s.mode, draft: s.draft, P: s.P, layer: s.layer, sg2: s.sg2, t2: s.t2, layer3: s.layer3, sg3: s.sg3, t3: s.t3, stab: s.stab && !s.ballast.on, zG: s.zG, phi: s.phi, ballast: s.ballast }, U);
    },

    draw2D(svg, res, U, opts) {
      if (!res.ok) { root.M1.emptyMsg(svg, res); return; }
      const s = this.state, g = res.geo, d = s.dims[s.shape];
      const out = outline(s.shape, d);
      const bw = Math.max(...out.map((p) => p[0])) - Math.min(...out.map((p) => p[0]));
      const H = g.H, D = g.D;
      const Wt = Math.max(bw * 1.6, H * 1.6, 1);
      const yb = -D;                       // bottom of body
      const t3 = g.t3 || 0, tt = (g.t2 || 0) + t3;
      const floor = Math.min(yb, -tt) - Math.max(0.25 * H, 0.2);
      const Dr = root.UI.Draw2D(svg, { xmin: -Wt, xmax: Wt + 0.4 * Wt, ymin: floor, ymax: Math.max(H - D, 0) + 0.3 * H }, { pad: 46 });
      // liquid
      Dr.poly([[-Wt, 0], [Wt, 0], [Wt, floor], [-Wt, floor]], { fill: 'url(#waterGrad)', op: 0.85 });
      if (s.layer) {
        Dr.poly([[-Wt, -t3], [Wt, -t3], [Wt, -tt], [-Wt, -tt]], { fill: COL.oil, op: 0.75 });
        Dr.line([-Wt, -tt], [Wt, -tt], { stroke: '#b9770e', sw: 1, dash: '6 3' });
        Dr.text([-Wt + 0.4 * Wt, -t3 - g.t2 / 2], `Sg₂ = ${f(s.sg2)}`, { color: '#7e5109', base: 'middle' });
        if (t3 > 0) {
          Dr.poly([[-Wt, 0], [Wt, 0], [Wt, -t3], [-Wt, -t3]], { fill: '#f7e7a8', op: 0.85 });
          Dr.line([-Wt, -t3], [Wt, -t3], { stroke: '#b9770e', sw: 1, dash: '6 3' });
          Dr.text([-Wt + 0.4 * Wt, -t3 / 2], `Sg₃ = ${f(s.sg3)}`, { color: '#7e5109', base: 'middle' });
          Dr.dim([-Wt * 0.98, 0], [-Wt * 0.98, -t3], `t₃ = ${f(t3)}`, -6, { anchor: 'start', ldx: 6 });
        }
        Dr.dim([-Wt * 0.98, -t3], [-Wt * 0.98, -tt], `t₂ = ${f(g.t2)}`, -6, { anchor: 'start', ldx: 6 });
      }
      Dr.line([-Wt, 0], [Wt, 0], { stroke: COL.waterDark, sw: 1.6 });
      Dr.fs([-Wt * 0.7, 0], { label: `Sg_L = ${f(s.sgL)}` });
      Dr.line([-Wt, floor], [Wt, floor], { stroke: '#2c3e50', sw: 2 });
      // body (possibly heeled)
      const stab = g.stab;
      const phi = stab && stab.phi > 0 ? (stab.phi * PI) / 180 : 0;
      const zG = g.zG;
      const tf = (p) => {
        const x = p[0], y = p[1] - zG;
        const xr = x * Math.cos(phi) + y * Math.sin(phi), yr = -x * Math.sin(phi) + y * Math.cos(phi);
        return [xr, yr + zG + yb];
      };
      const hollow = g.ballast && g.ballast.hollow;
      Dr.poly(out.map(tf), { fill: '#d4a373', stroke: '#7f5539', sw: hollow ? 4 : 2, op: hollow ? 0.35 : 0.95 });
      // waterline mark on the body
      const Gw = tf([0, zG]);
      const Bw = phi ? null : [0, g.zB + yb];
      Dr.dot(Gw, COL.weight, 'G', { dx: -18, dy: 4 });
      const Fm = Math.max(g.Wreq, g.BF, 1e-9);
      Dr.force([Gw[0], Gw[1] - 0.001], [0, -1], 35 + 60 * (g.W / Fm), { color: COL.weight, label: `W = ${f(g.W)} ${U.force}`, lp: 'head', ldx: 8, ldy: 4 });
      let Bp = Bw;
      if (stab) {
        const M = tf([0, stab.KM]);
        if (phi) Bp = [M[0], M[1] - stab.BM];
        Dr.dot(M, COL.meta, 'M', { dx: 10, dy: -4 });
        if (phi) {
          Dr.line(Bp, [M[0], M[1] + 0.15 * H], { stroke: COL.meta, sw: 1, dash: '5 4' });
          Dr.line(tf([0, -0.1 * H]), tf([0, H * 1.1]), { stroke: '#555', sw: 0.8, dash: '2 3' });
          Dr.text(Bp, 'B′', { dx: 10, dy: 16, color: COL.buoy });
          Dr.text([Gw[0], Gw[1] + 0.1 * H], `RM = ${f(stab.RM)} ${U.mom}`, { color: stab.GM > 0 ? '#1e8449' : '#c0392b', dx: 14 });
        }
      }
      if (Bp) {
        Dr.dot(Bp, COL.buoy, phi ? '' : 'B', { dx: 10, dy: 12 });
        Dr.force(Bp, [0, 1], 35 + 60 * (g.BF / Fm), { color: COL.buoy, label: `BF = ${f(g.BF)} ${U.force}`, lp: 'tail', ldx: 8, ldy: 14 });
      }
      if (s.P) Dr.force([0.25 * bw, H + yb], [0, s.P > 0 ? -1 : 1], 30 + 50 * (Math.abs(s.P) / Fm), { color: '#7d3c98', label: `P = ${f(s.P)}`, lp: 'tail', ldx: 6 });
      if (s.mode === 'manual' && Math.abs(g.net) > 1e-9) {
        Dr.force([-0.75 * Wt, -0.3 * D], [0, g.net > 0 ? 1 : -1], 60, { color: g.net > 0 ? '#1e8449' : '#c0392b', label: g.net > 0 ? `rises (net ${f(g.net)})` : `sinks (net ${f(g.net)})`, lp: 'head', ldx: 8 });
      }
      // dims
      const xd = Math.max(...out.map((p) => p[0])) + 0.15 * Wt;
      if (D > 0) Dr.dim([xd, 0], [xd, yb], `D = ${f(D)} ${U.len}`, -10, { anchor: 'start', ldx: 8 });
      if (H - D > 1e-9 && !phi) Dr.dim([xd, H + yb], [xd, 0], `freeboard ${f(H - D)}`, -10, { anchor: 'start', ldx: 8 });
      Dr.line([Math.max(...out.map((p) => p[0])), yb], [xd, yb], { stroke: COL.dim, sw: 0.5, dash: '3 3' });
      Dr.line([Math.max(...out.map((p) => p[0])), H + yb], [xd, H + yb], { stroke: COL.dim, sw: 0.5, dash: '3 3' });
      if (g.ballast) drawBallast(Dr, g, U, out, yb, Fm);
      if (g.state === 'sinks' || g.state === 'swamps') Dr.text([0, floor + 0.08 * H], g.ballast ? (g.state === 'swamps' ? 'SWAMPS — liquid enters the container' : 'SINKS with this ballast') : `SINKS — lifting force ${f(g.lift)} ${U.force}`, { anchor: 'middle', color: '#c0392b', size: 14 });
    },

    draw3D(V, res, U) {
      if (!res.ok) return;
      const s = this.state, g = res.geo, d = s.dims[s.shape];
      const yb = -g.D, H = g.H;
      const out = outline(s.shape, d);
      const bw = Math.max(...out.map((p) => p[0])) * 2;
      const len = s.shape === 'box' ? d.L : s.shape === 'hcyl' || s.shape === 'triside' ? d.L : bw;
      const t3 = g.t3 || 0, tt = (g.t2 || 0) + t3;
      const Wx = Math.max(bw, len, H) * 0.95, floor = Math.min(yb, -tt) - 0.25 * H;
      body3D(V, s.shape, d, yb);
      if (g.ballast) { const bb = ballastBox(g, out, yb); V.box(bb.x0, bb.y0, -bb.w / 2, bb.x0 + bb.w, bb.y0 + bb.h, bb.w / 2, '#5d6d7e', 0.95, '#1b2631'); if (g.ballast.place === 'hang') V.line([[0, yb, 0], [0, bb.y0 + bb.h, 0]], '#1b2631', 1.5); }
      if (s.layer) {
        if (t3 > 0) V.box(-Wx, -t3, -Wx, Wx, 0, Wx, '#f2d675', 0.2, '#b9770e');
        V.box(-Wx, -tt, -Wx, Wx, -t3, Wx, '#e0b84a', 0.22, '#b9770e', { noTop: false });
        V.box(-Wx, floor, -Wx, Wx, -tt, Wx, '#4aa3df', 0.2, '#1f6fa8');
        if (t3 > 0) V.label([-Wx, -t3 / 2, Wx], `Sg₃ = ${f(s.sg3)}`, '#7e5109');
        V.label([-Wx, -t3 - g.t2 / 2, Wx], `Sg₂ = ${f(s.sg2)}`, '#7e5109');
      } else V.box(-Wx, floor, -Wx, Wx, 0, Wx, '#4aa3df', 0.2, '#1f6fa8');
      const wl = waterline(s.shape, d, g.D);
      if (wl) V.line(wl, '#0b3d91', 3);
      V.line([[-Wx, 0, -Wx], [Wx, 0, -Wx], [Wx, 0, Wx], [-Wx, 0, Wx], [-Wx, 0, -Wx]], '#1f6fa8', 1.5);
      V.label([0, g.zB + yb, 0], 'B', '#2980b9');
      V.label([0, g.zG + yb, 0], 'G', '#2c3e50');
      // forces: W down at G, BF up at B (drawn out of the body so they read clearly)
      const Fm3 = Math.max(g.W || 0, g.BF || 0) || 1, aL = 0.35 * Math.max(H, bw);
      const arr3 = (a, b, c, lab) => {
        V.line([a, b], c, 3);
        const dy = b[1] - a[1], hh = Math.min(Math.abs(dy) * 0.3, 0.08 * Math.max(H, bw)), sg = Math.sign(dy);
        V.face([b, [b[0] - hh * 0.4, b[1] - sg * hh, b[2]], [b[0] + hh * 0.4, b[1] - sg * hh, b[2]]], c, 1, null);
        V.face([b, [b[0], b[1] - sg * hh, b[2] - hh * 0.4], [b[0], b[1] - sg * hh, b[2] + hh * 0.4]], c, 1, null);
        V.label([a[0] + (sg > 0 ? 0.25 : -0.25) * bw, a[1], a[2]], lab, c);
      };
      const zF = (['box', 'hcyl', 'triside'].includes(s.shape) ? d.L / 2 : bw / 2) + 0.05 * Math.max(bw, H);
      if (g.W > 0) { const y = g.zG + yb, L = aL * (0.5 + 0.5 * g.W / Fm3); arr3([-0.12 * bw, y, zF], [-0.12 * bw, y - L, zF], '#c0392b', `W = ${f(g.W)} ${U.force}`); }
      if (g.BF > 0) { const y = g.zB + yb, L = aL * (0.5 + 0.5 * g.BF / Fm3); arr3([0.12 * bw, y - L, zF], [0.12 * bw, y, zF], '#2980b9', `BF = ${f(g.BF)} ${U.force}`); }
      // dimensions
      const u = U.len, xm = bw / 2, gap = 0.25 * Math.max(bw, H);
      const zm = s.shape === 'box' ? d.L / 2 : s.shape === 'hcyl' || s.shape === 'triside' ? d.L / 2 : s.shape === 'custom' ? Math.sqrt(d.A) / 2 : s.shape === 'tri' ? (2 * d.t) / 3 : xm;
      const wName = { box: 'B', vcyl: 'Ø', tri: 'b', custom: '√A', hcyl: 'Ø', triside: 'b', sphere: 'Ø', coneDown: 'Ø', coneUp: 'Ø', pyramid: 'a', frustum: 'Ø₁', hemi: 'Ø' }[s.shape];
      const yTopB = yb + H;
      V.dim([-xm, yTopB, zm], [xm, yTopB, zm], `${wName} = ${f(bw)} ${u}`, [0, gap * 0.6, 0]);
      V.dim([xm, yb, zm], [xm, yTopB, zm], `H = ${f(H)} ${u}`, [gap, 0, 0]);
      V.dim([-xm, yb, zm], [-xm, 0, zm], `D = ${f(g.D)} ${u}`, [-gap, 0, 0], '#0b3d91');
      if (['box', 'hcyl', 'triside'].includes(s.shape)) V.dim([xm, yTopB, -d.L / 2], [xm, yTopB, d.L / 2], `L = ${f(d.L)} ${u}`, [gap * 0.6, gap * 0.4, 0]);
      if (s.shape === 'frustum') V.dim([-d.D2 / 2, yb, zm], [d.D2 / 2, yb, zm], `Ø₂ = ${f(d.D2)} ${u}`, [0, -gap * 0.6, 0]);
      V.autoBounds();
    },
  };

  // presets that do not mention ballast must switch it off
  M2.presets.forEach((p) => { const ap = p.apply; p.apply = (s) => { s.layer3 = false; if (!/Ballast/.test(p.name)) s.ballast.on = false; s.stab = false; s.zG = null; ap(s); }; });

  /* ---------------- ballast panel & drawing ---------------- */
  function ballastControls(el, C, s, U, B, d) {
    const b = s.ballast, H = B.H(d);
    const p = C.section(el, 'Attached ballast / added load');
    C.toggle(p, { label: 'Add ballast (e.g. lead) to the body', get: () => b.on, set: (v) => (b.on = v) });
    if (!b.on) return;
    C.seg(p, { label: 'Body definition', options: [['solid', 'Solid (Sg_B / W above)'], ['hollow', 'Hollow / open container']], get: () => b.bodyDef, set: (v) => (b.bodyDef = v) });
    if (b.bodyDef === 'hollow') C.slider(p, { label: 'Container weight W_body', min: 0, max: 5000, step: 0.01, get: () => b.Wbody, set: (v) => (b.Wbody = v), unit: U.force });
    C.seg(p, { label: 'Ballast material by', options: [['sg', 'Sg_b'], ['gamma', 'Unit weight γ_b']], get: () => b.matDef, set: (v) => (b.matDef = v) });
    if (b.matDef === 'sg') {
      const row = C.slider(p, { label: 'Ballast Sg_b', min: 1, max: 22, step: 0.01, get: () => b.sgb, set: (v) => (b.sgb = v), unit: '' });
      const bar = root.UI.h('div', { class: 'presets' });
      [['Lead', 11.3], ['Steel', 7.85], ['Concrete', 2.4]].forEach(([n, v]) => bar.append(root.UI.h('button', { type: 'button', class: Math.abs(b.sgb - v) < 1e-9 ? 'on' : '', onclick: () => { b.sgb = v; root.App.rebuild(true); } }, `${n} ${v}`)));
      row.append(bar);
    } else C.slider(p, { label: 'Ballast unit weight γ_b', min: 1, max: U.id === 'SI' ? 220 : 1400, step: 0.01, get: () => b.gb, set: (v) => (b.gb = v), unit: U.gamma });
    C.select(p, { label: 'Placement', options: [['inside', '1. Inside the body / on top'], ['outside', '2. Attached outside, below waterline'], ['hang', '3. Hanging by a cord (submerged)'], ['above', '4. Placed above the waterline']], get: () => b.place, set: (v) => (b.place = v) });
    C.seg(p, { label: 'Solve for', options: [['findW', 'Ballast for target draft'], ['findD', 'Draft for given ballast']], get: () => b.solve, set: (v) => (b.solve = v) });
    if (b.solve === 'findW') {
      C.seg(p, { options: [['draft', 'Target draft'], ['proj', 'Projection above surface']], get: () => b.targetBy, set: (v) => (b.targetBy = v) });
      C.slider(p, { label: b.targetBy === 'draft' ? 'Target draft D' : 'Projection above the surface', min: 0, max: +H.toFixed(3), step: 0.001, get: () => b.target, set: (v) => (b.target = v), unit: U.len });
    } else {
      C.seg(p, { options: [['W', 'Weight W_b'], ['m', 'Mass m_b']], get: () => b.givenBy, set: (v) => (b.givenBy = v) });
      if (b.givenBy === 'W') C.slider(p, { label: 'Ballast weight W_b', min: 0, max: 5000, step: 0.001, get: () => b.Wb, set: (v) => (b.Wb = v), unit: U.force });
      else C.slider(p, { label: 'Ballast mass m_b', min: 0, max: 5000, step: 0.001, get: () => b.mb, set: (v) => (b.mb = v), unit: U.id === 'SI' ? 'kg' : 'slug' });
    }
  }
  /** Ballast block drawn at true size (cube of volume V_b), capped for readability. */
  function ballastBox(g, out, yb) {
    const xs = out.map((p) => p[0]), bw = Math.max(...xs) - Math.min(...xs);
    const side = Math.min(Math.max(Math.cbrt(g.ballast.Vb), 0.04 * g.H), 0.8 * bw, 0.45 * g.H);
    const pl = g.ballast.place;
    let y0;
    if (pl === 'inside') y0 = yb + 0.03 * g.H;
    else if (pl === 'above') y0 = yb + g.H;
    else if (pl === 'outside') y0 = yb - side;
    else y0 = yb - side - 0.3 * g.H;
    return { x0: -side / 2, y0, w: side, h: side };
  }
  function drawBallast(Dr, g, U, out, yb, Fm) {
    const B = g.ballast, bb = ballastBox(g, out, yb);
    if (B.place === 'hang') Dr.line([0, yb], [0, bb.y0 + bb.h], { stroke: '#1b2631', sw: 1.5 });
    Dr.poly([[bb.x0, bb.y0], [bb.x0 + bb.w, bb.y0], [bb.x0 + bb.w, bb.y0 + bb.h], [bb.x0, bb.y0 + bb.h]], { fill: '#5d6d7e', stroke: '#1b2631', sw: 1.5 });
    const c = [bb.x0 + bb.w / 2, bb.y0 + bb.h / 2];
    const xr = bb.x0 + bb.w;
    Dr.force([xr + 0.02 * g.H, bb.y0], [0, -1], 30 + 50 * (B.Wb / Fm), { color: '#7b241c', label: `W_b = ${f(B.Wb)} ${U.force}`, lp: 'head', ldx: 6, ldy: 4 });
    if (B.BFb > 0) Dr.force([bb.x0 - 0.02 * g.H, bb.y0 + bb.h], [0, 1], 25 + 50 * (B.BFb / Fm), { color: '#2471a3', label: `BF_b = ${f(B.BFb)}`, lp: 'head', anchor: 'end', ldx: -6, ldy: -2 });
    if (B.place === 'hang') Dr.text([0, (yb + bb.y0 + bb.h) / 2], `T = ${f(B.T)} ${U.force}`, { dx: 8, color: '#1b2631' });
    Dr.text(c, 'ballast', { anchor: 'middle', dy: -bb.h * Dr.sc / 2 - 4, color: '#1b2631', size: 10.5 });
  }

  /* section outline (x, z) with z from the bottom of the body */
  function outline(shape, d) {
    const rect = (w, h) => [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]];
    const circ = (r, n = 64) => { const o = []; for (let i = 0; i < n; i++) { const t = (i / n) * 2 * PI; o.push([r * Math.cos(t), r + r * Math.sin(t)]); } return o; };
    switch (shape) {
      case 'box': return rect(d.B, d.H);
      case 'vcyl': return rect(d.Dc, d.H);
      case 'tri': return rect(d.b, d.H);
      case 'custom': return rect(Math.sqrt(d.A), d.H);
      case 'hcyl': return circ(d.Dc / 2);
      case 'triside': return [[0, 0], [d.b / 2, d.h], [-d.b / 2, d.h]];
      case 'sphere': return circ(d.Ds / 2);
      case 'coneDown': return [[0, 0], [d.Dc / 2, d.H], [-d.Dc / 2, d.H]];
      case 'coneUp': return [[-d.Dc / 2, 0], [d.Dc / 2, 0], [0, d.H]];
      case 'pyramid': return [[0, 0], [d.a / 2, d.H], [-d.a / 2, d.H]];
      case 'frustum': return [[-d.D2 / 2, 0], [d.D2 / 2, 0], [d.D1 / 2, d.H], [-d.D1 / 2, d.H]];
      case 'hemi': { const r = d.Ds / 2, o = []; for (let i = 0; i <= 40; i++) { const t = PI + (i / 40) * PI; o.push([r * Math.cos(t), r + r * Math.sin(t)]); } return o; }
    }
    return [];
  }
  function profile(shape, d) {
    switch (shape) {
      case 'vcyl': return [[0, 0], [d.Dc / 2, 0], [d.Dc / 2, d.H], [0, d.H]];
      case 'sphere': { const r = d.Ds / 2, o = []; for (let i = 0; i <= 24; i++) { const t = (i / 24) * PI; o.push([r * Math.sin(t), r - r * Math.cos(t)]); } return o; }
      case 'coneDown': return [[0, 0], [d.Dc / 2, d.H], [0, d.H]];
      case 'coneUp': return [[0, 0], [d.Dc / 2, 0], [0, d.H]];
      case 'frustum': return [[0, 0], [d.D2 / 2, 0], [d.D1 / 2, d.H], [0, d.H]];
      case 'hemi': { const r = d.Ds / 2, o = []; for (let i = 0; i <= 16; i++) { const t = (i / 16) * (PI / 2); o.push([r * Math.sin(t), r - r * Math.cos(t)]); } o.push([0, r]); return o; }
    }
    return null;
  }
  function body3D(V, shape, d, yb) {
    const col = '#d4a373', a = 0.92, st = '#7f5539';
    const pr = profile(shape, d);
    if (pr) { V.lathe(pr.map(([r, z]) => [r, z + yb]), col, a, null, 36); return; }
    if (shape === 'box') return V.box(-d.B / 2, yb, -d.L / 2, d.B / 2, yb + d.H, d.L / 2, col, a, st);
    if (shape === 'custom') { const w = Math.sqrt(d.A); return V.box(-w / 2, yb, -w / 2, w / 2, yb + d.H, w / 2, col, a, st); }
    if (shape === 'tri') return V.extrudeY([[-d.b / 2, -d.t / 3], [d.b / 2, -d.t / 3], [0, (2 * d.t) / 3]], yb, yb + d.H, col, a, st);
    if (shape === 'hcyl' || shape === 'triside') {
      const o = outline(shape, d).map(([x, z]) => [x, z + yb]);
      return V.extrude(o, -d.L / 2, d.L / 2, col, a, shape === 'triside' ? st : null);
    }
    if (shape === 'pyramid') {
      const s = d.a / 2, top = yb + d.H, ap = [0, yb, 0];
      const c = [[-s, top, -s], [s, top, -s], [s, top, s], [-s, top, s]];
      V.face(c, col, a, st);
      for (let i = 0; i < 4; i++) V.face([ap, c[i], c[(i + 1) % 4]], col, a, st);
    }
  }
  function waterline(shape, d, D) {
    const H = BODY[shape].H(d);
    if (D <= 0 || D >= H) return null;
    const circle = (r) => { const o = []; for (let i = 0; i <= 48; i++) { const t = (i / 48) * 2 * PI; o.push([r * Math.cos(t), 0, r * Math.sin(t)]); } return o; };
    const rect = (wx, wz) => [[-wx / 2, 0, -wz / 2], [wx / 2, 0, -wz / 2], [wx / 2, 0, wz / 2], [-wx / 2, 0, wz / 2], [-wx / 2, 0, -wz / 2]];
    switch (shape) {
      case 'box': return rect(d.B, d.L);
      case 'vcyl': return circle(d.Dc / 2);
      case 'custom': return rect(Math.sqrt(d.A), Math.sqrt(d.A));
      case 'tri': return [[-d.b / 2, 0, -d.t / 3], [d.b / 2, 0, -d.t / 3], [0, 0, (2 * d.t) / 3], [-d.b / 2, 0, -d.t / 3]];
      case 'hcyl': return rect(2 * Math.sqrt(D * (d.Dc - D)), d.L);
      case 'triside': return rect((d.b * D) / d.h, d.L);
      case 'sphere': case 'hemi': return circle(Math.sqrt(D * (d.Ds - D)));
      case 'coneDown': return circle((d.Dc / 2) * (D / d.H));
      case 'coneUp': return circle((d.Dc / 2) * (1 - D / d.H));
      case 'frustum': return circle(d.D2 / 2 + ((d.D1 - d.D2) / 2) * (D / d.H));
      case 'pyramid': { const s = (d.a * D) / d.H; return rect(s, s); }
    }
    return null;
  }

  root.M2 = M2;
})(window);
