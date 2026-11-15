/* =====================================================================
 * STEP 1 — Permeability & Seepage (UI, diagrams, charts, 3D)
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Physics } = root;
  const G = root.GeoUI;
  const f = Physics.fmt;
  const WAT = '#4aa3df', WATD = '#1f6fa8', EQ = '#d35400', FL = '#1f6fa8', STEEL = '#34495e', CONC = '#c9c6bb', CONCD = '#6e6a5e';

  const net0 = { T: 10, D: 5, B: 18, Hd: 10, crest: 4, cutU: false, du: 4, cutD: false, dd: 4, h1: 6, h2: 1, k: 1e-3, aniso: false, kx: 4e-3, kz: 1e-3, soilBy: 'gamma', gsat: 19, gsatEN: 120, Gs: 2.65, e: 0.65, counts: 'computed', Nd: 10, NdG: 8, NfG: 4, xp: 3, dp: 4, fsReq: 3, Lw: 0 };

  const GSeep = {
    id: 'seep', title: 'Permeability & Seepage',
    state: {
      sub: 'const',
      const: { solve: 'k', L: 30, D: 10, h: 50, Q: 350, t: 120, k: 0.02, temp: false, T: 25, useE: false, e: 0.6 },
      fall: { solve: 'k', L: 15, D: 10, d: 1, h1: 100, h2: 50, t: 600, k: 2e-4, temp: false, T: 25 },
      layers: { aniso: false, dh: 2, ih: 0.05, layers: [{ soil: 'sand', H: 1, k: 1e-4, kv: 1e-4 }, { soil: 'gravel', H: 2, k: 1e-3, kv: 1e-3 }, { soil: 'silt', H: 1.5, k: 1e-5, kv: 1e-5 }] },
      net: Object.assign({}, net0),
    },
    presets: [
      { name: 'Test S1 — constant head: L = 30 cm, D = 10 cm, h = 50 cm, Q = 350 cm³ in 120 s (k = 0.02228 cm/s)', apply: (s) => { s.sub = 'const'; Object.assign(s.const, { solve: 'k', L: 30, D: 10, h: 50, Q: 350, t: 120, temp: false, useE: false }); } },
      { name: 'Constant head with temperature correction (25 °C) and e = 0.55', apply: (s) => { s.sub = 'const'; Object.assign(s.const, { solve: 'k', L: 25, D: 7.5, h: 60, Q: 500, t: 180, temp: true, T: 25, useE: true, e: 0.55 }); } },
      { name: 'Test S2 — falling head: L = 15 cm, D = 10 cm, d = 1 cm, 100 → 50 cm in 600 s (k = 1.733 × 10⁻⁴ cm/s)', apply: (s) => { s.sub = 'fall'; Object.assign(s.fall, { solve: 'k', L: 15, D: 10, d: 1, h1: 100, h2: 50, t: 600, temp: false }); } },
      { name: 'Falling head: time for the head to drop from 150 to 60 cm (k = 3 × 10⁻⁵ cm/s)', apply: (s) => { s.sub = 'fall'; Object.assign(s.fall, { solve: 't', L: 12, D: 7.6, d: 0.6, h1: 150, h2: 60, k: 3e-5, temp: false }); } },
      { name: 'Test S3 — three layers: 1 m (10⁻⁴), 2 m (10⁻³), 1.5 m (10⁻⁵ cm/s) → k_H = 4.7 × 10⁻⁴, k_V = 2.778 × 10⁻⁵', apply: (s) => { s.sub = 'layers'; Object.assign(s.layers, { aniso: false, dh: 2, ih: 0.05, layers: [{ soil: 'sand', H: 1, k: 1e-4, kv: 1e-4 }, { soil: 'gravel', H: 2, k: 1e-3, kv: 1e-3 }, { soil: 'silt', H: 1.5, k: 1e-5, kv: 1e-5 }] }); } },
      { name: 'Four layers with anisotropic clay (k_h ≠ k_v)', apply: (s) => { s.sub = 'layers'; Object.assign(s.layers, { aniso: true, dh: 3, ih: 0.02, layers: [{ soil: 'sand', H: 2, k: 2e-3, kv: 1e-3 }, { soil: 'clay', H: 1.5, k: 5e-7, kv: 1e-7 }, { soil: 'silt', H: 1, k: 4e-5, kv: 2e-5 }, { soil: 'gravel', H: 2.5, k: 5e-2, kv: 5e-2 }] }); } },
      { name: 'Test S4 — sheet pile D = 5 m in a 10 m layer, h₁ = 6 m, h₂ = 1 m, k = 10⁻³ cm/s (N_f/N_d = 0.5 exactly)', apply: (s) => { s.sub = 'pile'; Object.assign(s.net, net0, { T: 10, D: 5, h1: 6, h2: 1, k: 1e-3, counts: 'computed', Nd: 10, xp: 3, dp: 4 }); } },
      { name: 'Sheet pile from a hand-drawn net: N_f = 4, N_d = 8, ΔH = 4.5 m, k = 5 × 10⁻³ cm/s', apply: (s) => { s.sub = 'pile'; Object.assign(s.net, net0, { T: 12, D: 6, h1: 5, h2: 0.5, k: 5e-3, counts: 'given', NfG: 4, NdG: 8, xp: -3, dp: 6 }); } },
      { name: 'Short sheet pile in sand that boils (FS < 1)', apply: (s) => { s.sub = 'pile'; Object.assign(s.net, net0, { T: 10, D: 1.5, h1: 7, h2: 0, k: 2e-2, soilBy: 'gamma', gsat: 18.5, counts: 'computed', Nd: 10, xp: 1, dp: 1 }); } },
      { name: 'Concrete dam B = 18 m on a 10 m layer, no cut-off, h₁ = 8 m', apply: (s) => { s.sub = 'dam'; Object.assign(s.net, net0, { T: 10, B: 18, Hd: 10, crest: 4, cutU: false, cutD: false, h1: 8, h2: 0, k: 2e-3, counts: 'computed', Nd: 12, xp: 9, dp: 3 }); } },
      { name: 'Dam with upstream cut-off 5 m (lower uplift)', apply: (s) => { s.sub = 'dam'; Object.assign(s.net, net0, { T: 12, B: 20, Hd: 11, crest: 4, cutU: true, du: 5, cutD: false, h1: 9, h2: 1, k: 2e-3, counts: 'computed', Nd: 12, xp: 10, dp: 3 }); } },
      { name: 'Dam with upstream and downstream cut-offs, anisotropic soil k_x = 4 k_z', apply: (s) => { s.sub = 'dam'; Object.assign(s.net, net0, { T: 10, B: 15, Hd: 9, crest: 3, cutU: true, du: 4, cutD: true, dd: 3, h1: 8, h2: 1, aniso: true, kx: 4e-3, kz: 1e-3, counts: 'computed', Nd: 12, xp: 7, dp: 2 }); } },
    ],
    toggle: () => (GSeep.state.sub === 'pile' || GSeep.state.sub === 'dam' ? 'Flow net' : null),
    hint: () => (GSeep.state.sub === 'pile' || GSeep.state.sub === 'dam' ? 'Click the 2D section to move point P.' : ''),
    legend() {
      const s = this.state.sub;
      if (s === 'pile' || s === 'dam') return [[FL, 'flow line', 'ln'], [EQ, 'equipotential line', 'ln'], ['#8e44ad', 'point P'], ['#1e8449', 'exit element / heave prism', 'ln']];
      if (s === 'layers') return [['#2980b9', 'flow direction', 'ln'], ['#c0392b', 'total head', 'ln']];
      return [[WAT, 'water', 'sq'], [G.SOILS.sand.fill, 'soil specimen', 'sq'], ['#34495e', 'dimensions', 'ln']];
    },
    get plotCaption() { const s = this.state.sub; return s === 'fall' ? 'Head versus time' : s === 'pile' ? 'Pore pressure on the sheet pile' : s === 'dam' ? 'Uplift pressure on the base' : 'Charts'; },

    controls(el, C) {
      const S = this.state, U = root.App.U(), en = U.id === 'EN';
      C.seg(el, { label: 'Situation', options: [['const', 'Constant head test'], ['fall', 'Falling head test'], ['layers', 'Layered soil'], ['pile', 'Flow net: sheet pile'], ['dam', 'Flow net: dam']], get: () => S.sub, set: (v) => (S.sub = v) });
      const sl = (p, o, k, label, min, max, step, unit, extra) => C.slider(p, Object.assign({ label, min, max, step, get: () => o[k], set: (v) => (o[k] = v), unit }, extra || {}));
      if (S.sub === 'const' || S.sub === 'fall') {
        const o = S[S.sub], Ls = U.lenS;
        if (S.sub === 'const') C.seg(el, { label: 'Solve for', options: [['k', 'Permeability k'], ['Q', 'Volume Q']], get: () => o.solve, set: (v) => (o.solve = v) });
        else C.seg(el, { label: 'Solve for', options: [['k', 'Permeability k'], ['t', 'Time t'], ['h2', 'Final head h₂']], get: () => o.solve, set: (v) => (o.solve = v) });
        const g = C.section(el, 'Specimen');
        sl(g, o, 'L', 'Specimen length L', 1, 100, 0.1, Ls);
        sl(g, o, 'D', 'Specimen diameter D', 1, 50, 0.01, Ls);
        if (S.sub === 'fall') sl(g, o, 'd', 'Standpipe diameter d', 0.1, 10, 0.01, Ls);
        const t = C.section(el, 'Test readings');
        if (S.sub === 'const') {
          sl(t, o, 'h', 'Constant head difference h', 1, 300, 0.1, Ls);
          sl(t, o, 't', 'Collection time t', 1, 3600, 1, 's');
          if (o.solve === 'k') sl(t, o, 'Q', 'Volume of water collected Q', 1, 5000, 1, U.volS);
          else C.log(t, { label: 'Permeability k', min: 1e-6, max: 10, get: () => o.k, set: (v) => (o.k = v), unit: U.kLab });
        } else {
          sl(t, o, 'h1', 'Initial head h₁ (above the outflow level)', 1, 300, 0.1, Ls);
          if (o.solve !== 'h2') sl(t, o, 'h2', 'Final head h₂', 0.1, 300, 0.1, Ls);
          if (o.solve !== 't') sl(t, o, 't', 'Elapsed time t', 1, 100000, 1, 's');
          if (o.solve !== 'k') C.log(t, { label: 'Permeability k', min: 1e-8, max: 1, get: () => o.k, set: (v) => (o.k = v), unit: U.kLab });
        }
        const x = C.section(el, 'Options');
        C.toggle(x, { label: 'Correct k to 20 °C (water viscosity)', get: () => o.temp, set: (v) => (o.temp = v) });
        if (o.temp) sl(x, o, 'T', 'Water temperature T', 0, 60, 0.1, '°C');
        if (S.sub === 'const') {
          C.toggle(x, { label: 'Seepage velocity from the void ratio', get: () => o.useE, set: (v) => (o.useE = v) });
          if (o.useE) sl(x, o, 'e', 'Void ratio e', 0.1, 3, 0.01, '');
        }
        return;
      }
      if (S.sub === 'layers') {
        const o = S.layers;
        const g = C.section(el, 'Soil layers (top to bottom)');
        C.toggle(g, { label: 'Different k_h and k_v in each layer', get: () => o.aniso, set: (v) => (o.aniso = v) });
        C.layers(g, {
          layers: o.layers, max: 5,
          fields: [{ k: 'H', label: 'Thickness H', unit: U.len }, { k: 'k', label: o.aniso ? 'k_h' : 'k', unit: U.kField }, { k: 'kv', label: 'k_v', unit: U.kField, show: () => o.aniso }],
          make: () => ({ soil: 'sand', H: 1, k: 1e-4, kv: 1e-4 }),
        });
        C.note(g, `Enter k in ${U.kField}; numbers like 1e-4 are accepted.`);
        const w = C.section(el, 'Flow');
        sl(w, o, 'dh', 'Vertical flow: total head loss Δh', 0, 50, 0.01, U.len);
        sl(w, o, 'ih', 'Horizontal flow: hydraulic gradient i', 0, 1, 0.001, '');
        return;
      }
      // flow nets
      const o = S.net, isPile = S.sub === 'pile';
      const g = C.section(el, 'Geometry');
      sl(g, o, 'T', 'Permeable layer thickness T', 1, 60, 0.01, U.len);
      if (isPile) sl(g, o, 'D', 'Sheet pile penetration D', 0.1, 60, 0.01, U.len);
      else {
        sl(g, o, 'B', 'Dam base width B', 1, 120, 0.01, U.len);
        sl(g, o, 'Hd', 'Dam height (drawing only)', 1, 80, 0.01, U.len);
        sl(g, o, 'crest', 'Crest width (drawing only)', 0.5, 30, 0.01, U.len);
        C.toggle(g, { label: 'Upstream cut-off wall (at the heel)', get: () => o.cutU, set: (v) => (o.cutU = v) });
        if (o.cutU) sl(g, o, 'du', 'Upstream cut-off depth', 0.1, 60, 0.01, U.len);
        C.toggle(g, { label: 'Downstream cut-off wall (at the toe)', get: () => o.cutD, set: (v) => (o.cutD = v) });
        if (o.cutD) sl(g, o, 'dd', 'Downstream cut-off depth', 0.1, 60, 0.01, U.len);
      }
      const w = C.section(el, 'Water');
      sl(w, o, 'h1', 'Upstream water depth h₁ (above ground)', 0, 60, 0.01, U.len);
      sl(w, o, 'h2', 'Downstream water depth h₂ (above ground)', 0, 60, 0.01, U.len);
      const so = C.section(el, 'Soil');
      C.toggle(so, { label: 'Anisotropic soil (k_x ≠ k_z)', get: () => o.aniso, set: (v) => (o.aniso = v) });
      if (o.aniso) {
        C.log(so, { label: 'Horizontal permeability k_x', min: 1e-7, max: 1, get: () => o.kx, set: (v) => (o.kx = v), unit: U.kField });
        C.log(so, { label: 'Vertical permeability k_z', min: 1e-7, max: 1, get: () => o.kz, set: (v) => (o.kz = v), unit: U.kField });
      } else C.log(so, { label: 'Permeability k', min: 1e-7, max: 1, get: () => o.k, set: (v) => (o.k = v), unit: U.kField });
      C.seg(so, { label: 'Unit weight for the quick-condition check', options: [['gamma', 'γ_sat'], ['phase', 'G_s and e']], get: () => o.soilBy, set: (v) => (o.soilBy = v) });
      if (o.soilBy === 'gamma') C.slider(so, { label: 'Saturated unit weight γ_sat', min: en ? 70 : 12, max: en ? 150 : 24, step: 0.01, get: () => (en ? o.gsatEN : o.gsat), set: (v) => (en ? (o.gsatEN = v) : (o.gsat = v)), unit: U.gamma });
      else { sl(so, o, 'Gs', 'Specific gravity of solids G_s', 2.4, 2.9, 0.01, ''); sl(so, o, 'e', 'Void ratio e', 0.2, 2, 0.01, ''); }
      const n = C.section(el, 'Flow net');
      C.seg(n, { label: 'Flow channels and drops', options: [['computed', 'Computed from the geometry'], ['given', 'Enter N_f and N_d']], get: () => o.counts, set: (v) => (o.counts = v) });
      if (o.counts === 'computed') sl(n, o, 'Nd', 'Number of equipotential drops N_d', 4, 24, 1, '');
      else { sl(n, o, 'NfG', 'Flow channels N_f', 1, 20, 0.1, ''); sl(n, o, 'NdG', 'Equipotential drops N_d', 2, 30, 0.1, ''); }
      const pp = C.section(el, 'Point P and checks');
      sl(pp, o, 'xp', `P: horizontal position x (0 at the ${isPile ? 'sheet pile' : 'heel'})`, -60, 120, 0.01, U.len);
      sl(pp, o, 'dp', 'P: depth below the ground surface', 0, 60, 0.01, U.len);
      sl(pp, o, 'fsReq', 'Required FS against piping / heave', 1, 6, 0.1, '');
      sl(pp, o, 'Lw', 'Length of structure for total seepage (0 = skip)', 0, 2000, 1, U.len);
    },

    compute(U) {
      const S = this.state, en = U.id === 'EN';
      const net = Object.assign({}, S.net, { gsat: en ? S.net.gsatEN : S.net.gsat });
      return Physics.seepage({ sub: S.sub, const: S.const, fall: S.fall, layers: S.layers, net }, U);
    },

    onClick(pt, res) {
      if (!res.geo || res.geo.kind !== 'net') return false;
      const o = this.state.net, T = res.geo.T;
      if (pt[1] > T || pt[1] < 0) return false;
      o.xp = +pt[0].toFixed(2); o.dp = +(T - pt[1]).toFixed(2);
      return true;
    },

    draw2D(svg, res, U, opts) {
      const g = res.geo;
      if (g.kind === 'const') return drawConst(svg, g, U);
      if (g.kind === 'fall') return drawFall(svg, g, U);
      if (g.kind === 'layers') return drawLayers(svg, g, U, this.state.layers);
      return drawNet(svg, res, U, opts);
    },
    draw3D(V, res, U, opts) {
      const g = res.geo;
      if (g.kind === 'const' || g.kind === 'fall') return draw3DLab(V, g, U);
      if (g.kind === 'layers') return draw3DLayers(V, g, U, this.state.layers);
      return draw3DNet(V, res, U, opts);
    },
    plot(svg, res, U) {
      const g = res.geo;
      if (g.kind === 'fall') {
        const { W, H } = G.chartSurface(svg);
        G.chart(svg, { x: 0, y: 0, w: W, h: H }, { title: 'Head in the standpipe versus time: h = h₁ e^(−kAt/aL)', xlab: 'time t (s)', ylab: `head h (${U.lenS})`, ymin: 0, series: [{ pts: g.curve, color: WATD, fill: true }], marks: [{ x: 0, y: g.h1, label: `h₁ = ${f(g.h1)}`, color: WATD, dy: 16 }, { x: g.t, y: g.h2, label: `h₂ = ${f(g.h2)} at t = ${f(g.t)} s`, color: '#c0392b' }, { x: g.t / 2, y: Math.sqrt(g.h1 * g.h2), label: `√(h₁h₂) at t/2`, color: '#8e44ad' }] });
        return true;
      }
      if (g.kind === 'net' && g.faces) {
        const { W, H } = G.chartSurface(svg);
        const F = g.faces;
        G.chart(svg, { x: 0, y: 0, w: W, h: H }, { title: 'Pore water pressure on the sheet pile below ground (u = γw × pressure head)', xlab: `pressure (${U.press})`, ylab: `depth below ground (${U.len})`, ydown: true, xmin: 0, ymin: 0, ymax: g.D,
          series: [{ pts: F.ds.map((d, i) => [F.uL[i], d]), color: '#c0392b', label: 'upstream face' }, { pts: F.ds.map((d, i) => [F.uR[i], d]), color: WATD, label: 'downstream face' }, { pts: F.ds.map((d, i) => [F.uL[i] - F.uR[i], d]), color: '#8e44ad', dash: '6 4', label: 'net (upstream − downstream)' }],
          marks: [{ x: F.uL[F.uL.length - 1], y: g.D, label: f(F.uL[F.uL.length - 1]), color: '#c0392b', anchor: 'end' }, { x: F.uR[F.uR.length - 1], y: g.D, label: f(F.uR[F.uR.length - 1]), color: WATD }] });
        return true;
      }
      if (g.kind === 'net' && g.uplift) {
        const { W, H } = G.chartSurface(svg);
        const up = g.uplift, gw = U.gw;
        G.chart(svg, { x: 0, y: 0, w: W, h: H }, { title: `Uplift pressure along the base (U = ${f(up.U)} ${U.force}/${U.len})`, xlab: `distance from the heel (${U.len})`, ylab: `uplift u (${U.press})`, ymin: 0, xmin: 0, xmax: g.B,
          series: [{ pts: up.xs.map((x, i) => [x, up.us[i]]), color: '#2980b9', fill: true, label: 'from the flow net' }, { pts: [[0, gw * g.h1], [g.B, gw * g.h2]], color: '#7f8c8d', dash: '6 4', label: 'straight line γw h₁ → γw h₂' }],
          marks: [{ x: 0, y: up.u1, label: `heel ${f(up.u1)}`, color: '#2980b9' }, { x: g.B, y: up.u2, label: `toe ${f(up.u2)}`, color: '#2980b9', anchor: 'end' }],
          vlines: [{ x: up.xb, label: `U acts at ${f(up.xb)}`, color: '#8e44ad' }] });
        return true;
      }
      return false;
    },
  };

  /** Small result box in the top-left corner of a Draw2D diagram. */
  function infoBox(D, lines) {
    const w = Math.max(...lines.map((l) => l.length)) * 6.6 + 20;
    D.el('rect', { x: 12, y: 12, width: w, height: 14 + lines.length * 18, rx: 7, fill: '#ffffff', 'fill-opacity': 0.92, stroke: '#c4ced9' });
    lines.forEach((l, i) => D.text([22, 30 + i * 18], l, { px: true, size: 12, color: i === lines.length - 1 ? '#c0392b' : '#1d2733', weight: i === lines.length - 1 ? 700 : 600 }));
  }

  /* ------------------------------------------------------------------ */
  /* Lab tests                                                          */
  /* ------------------------------------------------------------------ */
  function drawConst(svg, g, U) {
    const { L, D, h } = g, Ls = U.lenS;
    const top = 1.25 * L, bot = -0.12 * L, yOut = -0.32 * L, yIn = yOut + h;
    const rx0 = -D / 2 - 1.9 * D, rx1 = -D / 2 - 0.5 * D, rTop = Math.max(yIn, top) + 0.12 * L, rBot = yIn - 0.22 * L;
    const xs = D / 2 + 1.3 * D;
    const xmin = rx0 - 0.3 * D, xmax = xs + 2.4 * D, ymin = yOut - 0.65 * L, ymax = Math.max(rTop, top) + 0.18 * L;
    const D2 = root.UI.Draw2D(svg, { xmin, xmax, ymin, ymax }, { pad: 44 });
    G.soilDefs(svg);
    // reservoir with overflow (constant level)
    D2.poly([[rx0, rBot], [rx1, rBot], [rx1, yIn], [rx0, yIn]], { fill: 'url(#waterGrad)', op: 0.85 });
    D2.pline([[rx0, rTop], [rx0, rBot], [rx1, rBot], [rx1, rTop]], { stroke: '#2c3e50', sw: 2 });
    D2.line([rx0 - 0.25 * D, yIn], [rx0, yIn], { stroke: WATD, sw: 3 });
    D2.text([rx0 - 0.25 * D, yIn], 'overflow', { dy: -6, size: 10.5, color: WATD });
    D2.fs([(rx0 + rx1) / 2, yIn], {});
    D2.text([(rx0 + rx1) / 2, rTop], 'supply (constant level)', { dy: -6, anchor: 'middle', size: 11, color: '#34495e' });
    // pipe to the top of the specimen
    const capT = top + 0.05 * L;
    D2.pline([[(rx0 + rx1) / 2, rBot], [(rx0 + rx1) / 2, rBot - 0.06 * L], [-D / 2 - 0.25 * D, rBot - 0.06 * L], [-D / 2 - 0.25 * D, capT + 0.08 * L], [0, capT + 0.08 * L], [0, capT]], { stroke: WAT, sw: 5 });
    // specimen cylinder
    D2.poly([[-D / 2, bot], [D / 2, bot], [D / 2, top], [-D / 2, top]], { fill: 'url(#waterGrad)', op: 0.55 });
    G.soilRect(D2, -D / 2, 0, D / 2, L, 'sand', { sat: true });
    [[-0.05 * L, 0], [L, L + 0.05 * L]].forEach(([a, b]) => D2.poly([[-D / 2, a], [D / 2, a], [D / 2, b], [-D / 2, b]], { fill: '#95a5a6', stroke: '#566573', sw: 0.8 }));
    D2.text([D / 2, L + 0.025 * L], 'porous stone', { dx: 6, dy: 4, size: 10, color: '#566573' });
    D2.pline([[-D / 2, capT], [-D / 2, bot], [D / 2, bot], [D / 2, capT]], { stroke: '#2c3e50', sw: 2.2 });
    D2.line([-D / 2 - 0.05 * D, capT], [D / 2 + 0.05 * D, capT], { stroke: '#2c3e50', sw: 4 });
    for (let i = 0; i < 3; i++) { const x = -D / 3 + (i * D) / 3; D2.arrow([x, 0.8 * L], [x, 0.25 * L], { color: '#2980b9', w: 2, head: 9 }); }
    // outflow to the overflow at yOut, then into a graduated cylinder
    D2.pline([[0, bot], [0, bot - 0.06 * L], [xs, bot - 0.06 * L], [xs, yOut], [xs + 0.35 * D, yOut]], { stroke: WAT, sw: 5 });
    const gx0 = xs + 0.25 * D, gx1 = xs + 1.1 * D, gy1 = yOut - 0.1 * L, gy0 = yOut - 0.6 * L;
    D2.poly([[gx0, gy0], [gx1, gy0], [gx1, gy0 + 0.55 * (gy1 - gy0)], [gx0, gy0 + 0.55 * (gy1 - gy0)]], { fill: 'url(#waterGrad)', op: 0.85 });
    D2.pline([[gx0, gy1], [gx0, gy0], [gx1, gy0], [gx1, gy1]], { stroke: '#2c3e50', sw: 1.8 });
    for (let i = 1; i < 6; i++) { const y = gy0 + (i * (gy1 - gy0)) / 6; D2.line([gx1 - 0.18 * D, y], [gx1, y], { stroke: '#2c3e50', sw: 0.8 }); }
    D2.line([xs + 0.35 * D, yOut], [xs + 0.55 * D, gy0 + 0.6 * (gy1 - gy0)], { stroke: WAT, sw: 2, dash: '3 3' });
    D2.text([gx1, gy0], `Q = ${f(g.Q)} ${U.volS} in t = ${f(g.t)} s`, { dx: 6, dy: -4, size: 11.5, color: WATD });
    // levels & dimensions
    D2.line([rx1, yIn], [xs + 1.4 * D, yIn], { stroke: WATD, sw: 1, dash: '6 4' });
    D2.line([xs, yOut], [xs + 1.4 * D, yOut], { stroke: WATD, sw: 1, dash: '6 4' });
    D2.dim([xs + 1.4 * D, yOut], [xs + 1.4 * D, yIn], `h = ${f(h)} ${Ls}`, 10, { anchor: 'start' });
    D2.dim([-D / 2, 0], [-D / 2, L], `L = ${f(L)} ${Ls}`, 16);
    D2.dim([-D / 2, bot], [D / 2, bot], `D = ${f(D)} ${Ls}`, -0.2 * L * D2.sc);
    infoBox(D2, [`i = h/L = ${f(g.i)},  v = ${f(g.v)} ${U.velS}`, `k = ${f(g.k)} ${U.kLab}`]);
  }

  function drawFall(svg, g, U) {
    const { L, D, d, h1, h2 } = g, Ls = U.lenS;
    const sb = -0.25 * L, st = sb + L, capT = st + 0.06 * L;
    const dd = Math.max(d, 0.22 * D);
    const pipeTop = Math.max(h1, capT + 0.2 * L) + 0.12 * Math.max(h1, L);
    const xmin = -D / 2 - 0.9 * D, xmax = D / 2 + 1.8 * D, ymin = sb - 0.35 * L, ymax = pipeTop + 0.1 * Math.max(h1, L);
    const D2 = root.UI.Draw2D(svg, { xmin, xmax, ymin, ymax }, { pad: 44 });
    G.soilDefs(svg);
    // tail pan, water at y = 0 (datum)
    const px0 = -D / 2 - 0.6 * D, px1 = D / 2 + 0.6 * D, pb = sb - 0.2 * L;
    D2.poly([[px0, pb], [px1, pb], [px1, 0], [px0, 0]], { fill: 'url(#waterGrad)', op: 0.85 });
    D2.pline([[px0, 0.08 * L], [px0, pb], [px1, pb], [px1, 0.02 * L]], { stroke: '#2c3e50', sw: 2 });
    D2.line([px1, 0], [px1 + 0.3 * D, 0], { stroke: WATD, sw: 3 });
    D2.text([px0, 0], 'overflow level (datum)', { anchor: 'end', dx: -6, dy: 4, size: 10.5, color: WATD });
    // specimen
    D2.poly([[-D / 2, sb], [D / 2, sb], [D / 2, capT], [-D / 2, capT]], { fill: 'url(#waterGrad)', op: 0.55 });
    G.soilRect(D2, -D / 2, sb + 0.04 * L, D / 2, st - 0.04 * L, 'clay', { sat: true });
    D2.pline([[-D / 2, capT], [-D / 2, sb], [D / 2, sb], [D / 2, capT]], { stroke: '#2c3e50', sw: 2.2 });
    D2.pline([[-D / 2 - 0.05 * D, capT], [-dd / 2, capT], [-dd / 2, pipeTop]], { stroke: '#2c3e50', sw: 2 });
    D2.pline([[D / 2 + 0.05 * D, capT], [dd / 2, capT], [dd / 2, pipeTop]], { stroke: '#2c3e50', sw: 2 });
    // water in the standpipe at h2 (current/final) and the starting level h1
    D2.poly([[-dd / 2, capT], [dd / 2, capT], [dd / 2, Math.max(capT, h2)], [-dd / 2, Math.max(capT, h2)]], { fill: 'url(#waterGrad)', op: 0.85 });
    D2.line([-dd / 2 - 0.3 * D, h1], [dd / 2 + 1.2 * D, h1], { stroke: '#c0392b', sw: 1.2, dash: '6 4' });
    D2.line([-dd / 2 - 0.3 * D, h2], [dd / 2 + 1.2 * D, h2], { stroke: WATD, sw: 1.2, dash: '6 4' });
    D2.text([-dd / 2 - 0.3 * D, h1], 'start (t = 0)', { anchor: 'end', dx: -4, dy: 4, size: 10.5, color: '#c0392b' });
    D2.text([-dd / 2 - 0.3 * D, h2], `after t = ${f(g.t)} s`, { anchor: 'end', dx: -4, dy: 4, size: 10.5, color: WATD });
    D2.arrow([0, Math.max(h1, h2 + 0.1 * L) - 0.02 * h1], [0, h2 + 0.03 * h1], { color: '#c0392b', w: 1.6, head: 8 });
    D2.line([px1, 0], [dd / 2 + 1.5 * D, 0], { stroke: WATD, sw: 1, dash: '6 4' });
    D2.dim([dd / 2 + 1.2 * D, 0], [dd / 2 + 1.2 * D, h1], `h₁ = ${f(h1)} ${Ls}`, 10, { anchor: 'start', ldy: 0.3 * (h1 - h2) * D2.sc });
    D2.dim([dd / 2 + 0.55 * D, 0], [dd / 2 + 0.55 * D, h2], `h₂ = ${f(h2)}`, -10, { anchor: 'end', ldy: -0.2 * h2 * D2.sc });
    D2.dim([-D / 2, sb + 0.04 * L], [-D / 2, st - 0.04 * L], `L = ${f(L)} ${Ls}`, 16);
    D2.dim([-D / 2, sb], [D / 2, sb], `D = ${f(D)} ${Ls}`, -2 - 0.24 * L * D2.sc);
    D2.dim([-dd / 2, pipeTop], [dd / 2, pipeTop], `d = ${f(d)}${dd > d ? ' (drawn wider)' : ''}`, 12);
    infoBox(D2, [`a/A = ${f(g.a / g.A)},  t = ${f(g.t)} s`, `k = ${f(g.k)} ${U.kLab}`]);
  }

  function draw3DLab(V, g, U) {
    const L = g.L, R = g.D / 2;
    const lathe = (r, y0, y1, col, a, st) => V.lathe([[0, y0], [r, y0], [r, y1], [0, y1]], col, a, st, 36);
    lathe(R * 1.02, -0.12 * L, 1.25 * L, '#bcd6e8', 0.18, null);
    lathe(R, 0, L, g.kind === 'fall' ? G.SOILS.clay.c3d : G.SOILS.sand.c3d, 0.95, null);
    lathe(R, -0.05 * L, 0, '#95a5a6', 1, null); lathe(R, L, 1.05 * L, '#95a5a6', 1, null);
    if (g.kind === 'fall') {
      const r = Math.max(g.d, 0.22 * g.D) / 2, top = Math.max(g.h1, 1.3 * L) + 0.1 * g.h1;
      lathe(r * 1.05, 1.25 * L, top, '#bcd6e8', 0.2, null);
      lathe(r, 1.25 * L, Math.max(1.25 * L, g.h2), WAT, 0.6, null);
      V.circle(0, g.h1, 0, r * 2.2, '#c0392b', 2);
      V.label([r * 2.2, g.h1, 0], `h₁ = ${f(g.h1)} ${U.lenS}`, '#c0392b');
      V.label([r * 2.2, g.h2, 0], `h₂ = ${f(g.h2)}`, WATD);
      V.box(-2.2 * R, -0.45 * L, -2.2 * R, 2.2 * R, -0.25 * L, 2.2 * R, WAT, 0.25, WATD);
      V.dim([R, 0, 0], [R, L, 0], `L = ${f(L)} ${U.lenS}`, [R * 0.8, 0, 0]);
    } else {
      const yIn = -0.32 * L + g.h;
      V.box(-4.5 * R, yIn - 0.25 * L, -1.2 * R, -2.2 * R, yIn, 1.2 * R, WAT, 0.35, WATD);
      V.line([[-3.35 * R, yIn - 0.25 * L, 0], [-3.35 * R, 1.33 * L, 0], [0, 1.33 * L, 0], [0, 1.25 * L, 0]], WAT, 4);
      V.line([[0, -0.12 * L, 0], [0, -0.2 * L, 0], [3.4 * R, -0.2 * L, 0], [3.4 * R, -0.32 * L, 0]], WAT, 4);
      V.lathe([[0, -0.95 * L], [R * 0.8, -0.95 * L], [R * 0.8, -0.45 * L], [0, -0.45 * L]], '#bcd6e8', 0.35, null, 24, 4 * R, 0);
      V.dim([R, 0, 0], [R, L, 0], `L = ${f(L)} ${U.lenS}`, [R * 0.8, 0, 0]);
      V.dim([-2.2 * R, -0.32 * L, 0], [-2.2 * R, yIn, 0], `h = ${f(g.h)} ${U.lenS}`, [-3.2 * R, 0, 0]);
      V.label([3.4 * R, -0.5 * L, 0], `Q = ${f(g.Q)} ${U.volS}`, WATD);
    }
    V.dim([-R, 0, R * 1.2], [R, 0, R * 1.2], `D = ${f(g.D)} ${U.lenS}`, [0, -0.15 * L, 0]);
    V.label([R, L * 0.5, 0], `k = ${f(g.k)} ${U.kLab}`, '#c0392b');
    V.autoBounds();
  }

  /* ------------------------------------------------------------------ */
  /* Layered soil                                                       */
  /* ------------------------------------------------------------------ */
  function drawLayers(svg, g, U, st) {
    const H = g.H, W = 1.5 * H, Lu = U.len;
    const gx0 = W + 0.25 * H, gx1 = W + 0.95 * H;
    const D2 = root.UI.Draw2D(svg, { xmin: -0.35 * H, xmax: gx1 + 0.2 * H, ymin: -0.12 * H, ymax: H * 1.12 }, { pad: 40 });
    G.soilDefs(svg);
    let y = H;
    const kmax = Math.max(...g.layers.map((l) => l.kh)), kmin = Math.min(...g.layers.map((l) => l.kh));
    const lr = (k) => (kmax / kmin > 1.0001 ? (Math.log10(k) - Math.log10(kmin)) / (Math.log10(kmax) - Math.log10(kmin)) : 1);
    g.layers.forEach((l, i) => {
      const y0 = y - l.H;
      G.soilRect(D2, 0, y0, W, y, l.soil);
      D2.text([0.04 * W, (y + y0) / 2], `${i + 1}. ${(G.SOILS[l.soil] || G.SOILS.sand).name}`, { dy: -3, size: 12, color: '#1d2733', weight: 700 });
      D2.text([0.04 * W, (y + y0) / 2], st.aniso ? `k_h = ${f(l.kh)}, k_v = ${f(l.kv)} ${U.kField}` : `k = ${f(l.kh)} ${U.kField}`, { dy: 12, size: 11, color: '#1d2733' });
      // horizontal flow arrow, length grows with log k
      const len = 0.12 * W + 0.3 * W * lr(l.kh);
      D2.arrow([0.52 * W, (y + y0) / 2], [0.52 * W + len, (y + y0) / 2], { color: '#2980b9', w: 2.4, head: 10 });
      D2.dim([0, y0], [0, y], `H${i + 1} = ${f(l.H)}`, 14, { anchor: 'end', ldx: -6 });
      y = y0;
    });
    D2.poly([[0, -0.08 * H], [W, -0.08 * H], [W, 0], [0, 0]], { fill: 'url(#impervious)', stroke: '#2c3e50' });
    D2.text([0.5 * W, H], `k_H = ${f(g.kH)} ${U.kField}   ·   k_V = ${f(g.kV)} ${U.kField}`, { anchor: 'middle', dy: -10, size: 12.5, color: '#c0392b', weight: 700 });
    // vertical flow & head-loss diagram
    if (g.dh > 0) {
      D2.arrow([0.93 * W, H * 0.98], [0.93 * W, 0.02 * H], { color: '#2980b9', w: 2.2, head: 11 });
      D2.text([0.93 * W, H * 0.5], 'vertical flow', { rot: -90, anchor: 'middle', dy: -10, size: 11, color: '#2980b9' });
      D2.line([gx0, 0], [gx0, H], { stroke: '#7f8c8d', sw: 1 });
      D2.line([gx0, 0], [gx1, 0], { stroke: '#7f8c8d', sw: 1 });
      D2.text([(gx0 + gx1) / 2, H], 'head lost from the top', { anchor: 'middle', dy: -10, size: 11, color: '#34495e' });
      const X = (v) => gx0 + (v / g.dh) * (gx1 - gx0);
      let yy = H, cum = 0; const pts = [[X(0), H]];
      g.layers.forEach((l, i) => { cum += l.hl; yy -= l.H; pts.push([X(cum), yy]); D2.line([gx0, yy], [X(cum), yy], { stroke: '#bdc3c7', sw: 0.8, dash: '3 3' }); D2.text([X(cum), yy], `Σ = ${f(cum)}`, { dx: 5, dy: 12, size: 10.5, color: '#c0392b' }); D2.text([gx0, yy + l.H / 2], `Δh${i + 1} = ${f(l.hl)}`, { dx: 4, size: 10.5, color: '#34495e' }); });
      D2.pline(pts, { stroke: '#c0392b', sw: 2.4 });
      D2.text([gx1, 0], `Δh = ${f(g.dh)} ${Lu}`, { anchor: 'end', dy: 14, size: 11, color: '#c0392b' });
    }
    D2.dim([W, 0], [W, H], `H = ${f(H)} ${Lu}`, 12, { ldx: 0, ldy: 0.5 * H * D2.sc + 16, anchor: 'start' });
  }
  function draw3DLayers(V, g, U, st) {
    const H = g.H, W = 1.5 * H, Lz = 0.9 * H;
    let y = H; const bands = [];
    g.layers.forEach((l) => { bands.push({ y0: y - l.H, y1: y, soil: l.soil }); y -= l.H; });
    G.soilBlock3D(V, 0, W, 0, Lz, bands);
    V.box(0, -0.08 * H, 0, W, 0, Lz, '#9aa3ad', 1, '#4b5560');
    y = H;
    g.layers.forEach((l, i) => { const yc = y - l.H / 2; G.arrow3D(V, [0.15 * W, yc, Lz], [0.55 * W, yc, Lz], '#2980b9', 2.4, null, 0.06 * H); V.label([0.6 * W, yc, Lz], `k${i + 1} = ${f(l.kh)}`, '#1d2733'); y -= l.H; });
    if (g.dh > 0) G.arrow3D(V, [0.9 * W, H * 1.1, 0.5 * Lz], [0.9 * W, -0.05 * H, 0.5 * Lz], '#2980b9', 2.6, 'vertical flow', 0.07 * H);
    V.dim([W, 0, Lz], [W, H, Lz], `H = ${f(H)} ${U.len}`, [0.15 * H, 0, 0]);
    V.label([0, H * 1.08, 0], `k_H = ${f(g.kH)},  k_V = ${f(g.kV)} ${U.kField}`, '#c0392b');
    V.autoBounds();
  }

  /* ------------------------------------------------------------------ */
  /* Flow nets                                                          */
  /* ------------------------------------------------------------------ */
  function netView(g) {
    const T = g.T, B = g.B;
    const xa = -Math.min(2.2 * T, -g.net.xL), xb = B + Math.min(2.2 * T, g.net.xL + g.net.nx * g.net.h - B + 1e9);
    return { xa, xb: Math.min(xb, g.net.xL + g.net.nx * g.net.h) };
  }
  function netLines(g) {
    const net = g.net, latP = Physics.phiLattice(net), latS = Physics.psiLattice(net);
    const eq = [], fl = [];
    const Nd = g.Nd;
    for (let m = 1; m < Nd; m++) eq.push({ m, segs: Physics.contour(latP, m / Nd) });
    const Nf = g.Nf;
    for (let m = 1; m < Nf - 1e-6; m++) fl.push({ m, segs: Physics.contour(latS, (net.S * m) / Nf) });
    return { eq, fl };
  }
  function segPath(D, segs, xa, xb) {
    let d = '';
    segs.forEach((q) => { if (Math.max(q[0], q[2]) < xa || Math.min(q[0], q[2]) > xb) return; d += `M${D.X(q[0]).toFixed(1)},${D.Y(q[1]).toFixed(1)}L${D.X(q[2]).toFixed(1)},${D.Y(q[3]).toFixed(1)}`; });
    return d;
  }

  function drawNet(svg, res, U, opts) {
    const g = res.geo, T = g.T, Lu = U.len, Pu = U.press;
    const { xa, xb } = netView(g);
    const isPile = g.isPile, B = g.B;
    const topW = Math.max(g.h1, isPile ? 0 : GSeep.state.net.Hd);
    const ymax = T + topW * 1.18 + 0.08 * T;
    const D = root.UI.Draw2D(svg, { xmin: xa, xmax: xb, ymin: -0.1 * T, ymax }, { pad: 42 });
    G.soilDefs(svg);
    // soil, base, water
    D.poly([[xa, 0], [xb, 0], [xb, T], [xa, T]], { fill: '#f4e9c8' });
    D.poly([[xa, 0], [xb, 0], [xb, T], [xa, T]], { fill: G.soilFill('sand'), op: 0.4, stroke: '#8a7650', sw: 1 });
    D.poly([[xa, -0.07 * T], [xb, -0.07 * T], [xb, 0], [xa, 0]], { fill: 'url(#impervious)', stroke: '#2c3e50' });
    D.text([xb, -0.035 * T], 'impervious layer', { anchor: 'end', dx: -6, dy: 4, size: 10.5, color: '#2c3e50' });
    if (g.h1 > 0) { D.poly([[xa, T], [0, T], [0, T + g.h1], [xa, T + g.h1]], { fill: 'url(#waterGrad)', op: 0.8 }); D.fs([xa + 0.35 * (0 - xa), T + g.h1], { label: `h₁ = ${f(g.h1)} ${Lu}` }); }
    if (g.h2 > 0) { D.poly([[B, T], [xb, T], [xb, T + g.h2], [B, T + g.h2]], { fill: 'url(#waterGrad)', op: 0.8 }); D.fs([B + 0.55 * (xb - B), T + g.h2], { label: `h₂ = ${f(g.h2)}` }); }
    // flow net
    if (opts.showP !== false) {
      const L = netLines(g);
      L.fl.forEach((q) => D.el('path', { d: segPath(D, q.segs, xa, xb), stroke: FL, 'stroke-width': 1.5, fill: 'none', 'stroke-linecap': 'round' }));
      L.eq.forEach((q) => D.el('path', { d: segPath(D, q.segs, xa, xb), stroke: EQ, 'stroke-width': 1.3, fill: 'none', 'stroke-dasharray': '5 3', 'stroke-linecap': 'round' }));
      // number a few equipotentials along the ground surface or base
      L.eq.forEach((q) => {
        if (g.Nd > 14 && q.m % 2) return;
        let best = null; q.segs.forEach((sg) => { [[sg[0], sg[1]], [sg[2], sg[3]]].forEach((p) => { if (p[0] >= xa && p[0] <= xb && (!best || p[1] > best[1])) best = p; }); });
        if (best && best[1] > T - 0.05 * T) D.text([best[0], T], String(q.m), { anchor: 'middle', dy: -4, size: 10, color: EQ });
      });
    }
    // structure
    if (isPile) {
      D.line([0, T - g.D], [0, T + g.h1 + 0.12 * T], { stroke: STEEL, sw: 5 });
      D.text([0, T + g.h1 + 0.12 * T], 'sheet pile', { anchor: 'middle', dy: -6, size: 11, color: STEEL });
    } else {
      const S = GSeep.state.net, Hd = S.Hd, cw = Math.min(S.crest, B);
      D.poly([[0, T], [0, T + Hd], [cw, T + Hd], [B, T]], { fill: 'url(#concrete)', stroke: CONCD, sw: 2 });
      D.text([cw / 2 + 0.15 * B, T + 0.45 * Hd], 'concrete dam', { anchor: 'middle', size: 11.5, color: '#4d4a40' });
      if (g.du > 0) D.line([0, T - g.du], [0, T], { stroke: STEEL, sw: 5 });
      if (g.dd > 0) D.line([B, T - g.dd], [B, T], { stroke: STEEL, sw: 5 });
      D.dim([0, T + Hd], [B, T + Hd], `B = ${f(B)} ${Lu}`, 16);
      if (g.uplift) {
        const up = g.uplift, k = (0.14 * T) / Math.max(up.u1, up.u2, 1e-9);
        // uplift diagram drawn inside the dam outline, hanging from the base
        const pts = up.xs.map((x, i) => [x, T + up.us[i] * k]);
        D.poly([[0, T]].concat(pts, [[B, T]]), { fill: '#2980b9', fop: 0.18, stroke: '#2980b9', sw: 1 });
        for (let i = 0; i <= 6; i++) { const x = (B * i) / 6, uu = Physics.interp(up.xs, up.us, x) * k; if (uu > 0.01 * T) D.arrow([x, T + uu], [x, T], { color: '#2980b9', w: 1.2, head: 6 }); }
        D.text([B * 0.62, T + Math.max(up.u1, up.u2) * k * 0.55], `U = ${f(up.U)} ${U.force}/${Lu}`, { size: 11, color: '#1b4f72' });
      }
    }
    // exit element & heave prism
    const xe = isPile ? 0 : B;
    if (g.lExit > 0) {
      D.line([xe + 0.004 * (xb - xa), T], [xe + 0.004 * (xb - xa), T - g.lExit], { stroke: '#1e8449', sw: 4 });
      D.text([xe, T - g.lExit / 2], `l = ${f(g.lExit)},  i_exit = ${f(g.iExit)}`, { dx: 12, dy: 4, size: 11, color: '#1e8449' });
    }
    if (g.heave) {
      const hv = g.heave;
      D.poly([[hv.xw, hv.yb], [hv.xw + hv.D / 2, hv.yb], [hv.xw + hv.D / 2, T], [hv.xw, T]], { stroke: '#1e8449', sw: 1.4, dash: '3 3' });
      D.text([hv.xw + hv.D / 2, hv.yb], `heave prism, FS = ${f(hv.FS, 3)}`, { dx: 4, dy: 12, size: 10.5, color: '#1e8449' });
    }
    // point P
    const Pp = g.P;
    D.dot([Pp.x, Pp.y], '#8e44ad', `P: u = ${f(Pp.u)} ${Pu}`, { r: 5, dx: 8, dy: -6 });
    // dimensions
    D.dim([xa + 0.02 * (xb - xa), 0], [xa + 0.02 * (xb - xa), T], `T = ${f(T)} ${Lu}`, -10, { anchor: 'start', ldx: 6 });
    if (isPile) D.dim([0, T - g.D], [0, T], `D = ${f(g.D)}`, -14, { anchor: 'end', ldx: -6 });
    else { if (g.du > 0) D.dim([0, T - g.du], [0, T], `${f(g.du)}`, -12, { anchor: 'end', ldx: -6 }); if (g.dd > 0) D.dim([B, T - g.dd], [B, T], `${f(g.dd)}`, 12); }
    // info box
    const bx = 12, by = 12;
    D.el('rect', { x: bx, y: by, width: 262, height: 64, rx: 7, fill: '#ffffff', 'fill-opacity': 0.92, stroke: '#c4ced9' });
    D.text([bx + 10, by + 18], `N_f = ${f(g.Nf, 3)},  N_d = ${f(g.Nd, 3)}${g.given ? ' (given)' : ''}`, { px: true, size: 12, color: '#1d2733' });
    D.text([bx + 10, by + 36], `q = k ΔH N_f/N_d = ${f(res.out[1].v)} ${U.qplDay}`, { px: true, size: 12, color: '#c0392b' });
    D.text([bx + 10, by + 54], `ΔH = ${f(g.dH)} ${Lu},  Δh per drop = ${f(g.dH / g.Nd)}`, { px: true, size: 11.5, color: '#34495e' });
  }

  function draw3DNet(V, res, U, opts) {
    const g = res.geo, T = g.T, B = g.B, Lu = U.len;
    const { xa, xb } = netView(g);
    const Lz = 0.45 * (xb - xa);
    V.box(xa, -0.07 * T, 0, xb, 0, Lz, '#9aa3ad', 1, '#4b5560');
    V.box(xa, 0, 0, xb, T, Lz, G.SOILS.sand.c3d, 0.55, '#8a7650');
    if (g.h1 > 0) V.box(xa, T, 0, 0, T + g.h1, Lz, WAT, 0.25, WATD);
    if (g.h2 > 0) V.box(B, T, 0, xb, T + g.h2, Lz, WAT, 0.25, WATD);
    if (g.isPile) V.box(-0.012 * T, T - g.D, 0, 0.012 * T, T + g.h1 + 0.12 * T, Lz, '#5d6d7e', 1, '#2c3e50');
    else {
      const S = GSeep.state.net, cw = Math.min(S.crest, B);
      V.extrude([[0, T], [0, T + S.Hd], [cw, T + S.Hd], [B, T]], 0, Lz, CONC, 0.96, CONCD);
      if (g.du > 0) V.box(-0.012 * T, T - g.du, 0, 0.012 * T, T, Lz, '#5d6d7e', 1, '#2c3e50');
      if (g.dd > 0) V.box(B - 0.012 * T, T - g.dd, 0, B + 0.012 * T, T, Lz, '#5d6d7e', 1, '#2c3e50');
    }
    if (opts.showP !== false) {
      const L = netLines(g), z = Lz + 1e-3;
      const add = (segs, col, lw, dash) => segs.forEach((q) => { if (Math.max(q[0], q[2]) < xa || Math.min(q[0], q[2]) > xb) return; V.line([[q[0], q[1], z], [q[2], q[3], z]], col, lw, dash); });
      L.fl.forEach((q) => add(q.segs, FL, 1.4));
      L.eq.forEach((q) => add(q.segs, EQ, 1.2, [4, 3]));
    }
    V.line([[g.P.x, g.P.y, Lz], [g.P.x, g.P.y, Lz]], '#8e44ad', 6);
    V.label([g.P.x, g.P.y, Lz], `P: u = ${f(g.P.u)} ${U.press}`, '#8e44ad');
    V.dim([xa, 0, Lz], [xa, T, Lz], `T = ${f(T)} ${Lu}`, [-0.08 * T, 0, 0]);
    V.label([xa, T + Math.max(g.h1, 1) * 1.1, 0], `q = ${f(res.out[1].v)} ${U.qplDay}`, '#c0392b');
    V.autoBounds();
  }

  root.GSeep = GSeep;
})(window);
