/* =====================================================================
 * Shared soil profile (Step 0): one set of layers, water table,
 * capillary rise, surcharge and seepage used by Effective Stress and
 * Consolidation. Includes the editor, unit conversion, and the 2D/3D
 * drawing of the soil column with hatching.
 * ===================================================================== */
(function (root) {
  'use strict';
  const G = root.GeoUI;
  const f = (x, n) => root.Physics.fmt(x, n);
  const LEN = 1 / 0.3048, GAM = 6.365880, STR = 20.885434; // SI → English factors

  const DEFAULT = {
    by: 'gamma', wt: 2, cap: 0, capS: 100, capNeg: true, q: 0, seep: 'none', seepLayer: 1, dh: 0,
    layers: [
      { soil: 'sand', H: 4, g: 17, gsat: 19, Gs: 2.65, e: 0.6, S: 40, src: 'gamma', w: 15, gd: 16 },
      { soil: 'clay', H: 5, g: 17.5, gsat: 18.5, Gs: 2.7, e: 1.0, S: 90, src: 'gamma', w: 35, gd: 14 },
    ],
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const GeoProfile = {
    state: clone(DEFAULT),
    /** Replace the profile (presets); missing fields fall back to the defaults. */
    set(p) {
      const s = this.state;
      Object.keys(s).forEach((k) => delete s[k]);
      Object.assign(s, clone(DEFAULT), clone(p));
      s.layers = (p.layers || DEFAULT.layers).map((l) => Object.assign({ soil: 'sand', H: 1, g: 17, gsat: 19, Gs: 2.65, e: 0.6, S: 50, src: 'gamma', w: 20, gd: 16 }, clone(l)));
    },
    convert(from, to) {
      if (from === to) return;
      const k = to === 'EN' ? 1 : -1, s = this.state;
      const L = Math.pow(LEN, k), Gm = Math.pow(GAM, k), S = Math.pow(STR, k);
      const r = (x, d) => +(+x).toPrecision(d || 5);
      s.wt = r(s.wt * L); s.cap = r(s.cap * L); s.dh = r(s.dh * L); s.q = r(s.q * S);
      s.layers.forEach((l) => { l.H = r(l.H * L); l.g = r(l.g * Gm); l.gsat = r(l.gsat * Gm); if (l.gd !== undefined) l.gd = r(l.gd * Gm); });
    },

    /** Editor. o = { seepage: true|false } */
    controls(el, C, U, o) {
      o = o || {};
      const s = this.state, en = U.id === 'EN';
      const g = C.section(el, 'Soil profile (shared with Consolidation)');
      C.seg(g, { label: 'Unit weights from', options: [['gamma', 'γ and γ_sat'], ['phase', 'G_s, e and S'], ['each', 'Each layer its own data']], get: () => s.by, set: (v) => (s.by = v) });
      const fields = s.by === 'phase'
        ? [{ k: 'H', label: 'Thickness H', unit: U.len }, { k: 'Gs', label: 'G_s', unit: '' }, { k: 'e', label: 'Void ratio e', unit: '' }, { k: 'S', label: 'S above GWT', unit: '%' }]
        : s.by === 'each'
          ? [{ k: 'src', label: 'Data given', options: root.Physics.UW_SRC }, { k: 'H', label: 'Thickness H', unit: U.len }].concat(root.Physics.uwFields(U))
          : [{ k: 'H', label: 'Thickness H', unit: U.len }, { k: 'g', label: 'γ (above GWT)', unit: U.gamma }, { k: 'gsat', label: 'γ_sat', unit: U.gamma }];
      C.layers(g, { layers: s.layers, max: 5, fields, make: (ls) => { const l = ls[ls.length - 1] || DEFAULT.layers[0]; return Object.assign(clone(l), { soil: l.soil === 'clay' ? 'sand' : 'clay', H: en ? 10 : 3 }); } });
      if (s.by === 'each') C.note(g, 'G_s, w (saturated): e = w G_s; the layer is saturated unless S above the water table is given. γ_d, γ_sat, S: n = (γ_sat − γ_d)/γw and γ = γ_d + S n γw.');
      const w = C.section(el, 'Water');
      C.slider(w, { label: 'Depth of the water table z_w (negative = water above ground)', min: en ? -30 : -10, max: en ? 200 : 60, step: 0.01, get: () => s.wt, set: (v) => (s.wt = v), unit: U.len });
      C.slider(w, { label: 'Capillary rise above the water table h_c', min: 0, max: en ? 30 : 10, step: 0.01, get: () => s.cap, set: (v) => (s.cap = v), unit: U.len, rebuild: true });
      if (s.cap > 0) {
        C.slider(w, { label: 'Degree of saturation in the capillary zone S', min: 0, max: 100, step: 1, get: () => s.capS, set: (v) => (s.capS = v), unit: '%' });
        C.toggle(w, { label: 'Negative pore pressure in the capillary zone (u = −S γw h)', get: () => s.capNeg, set: (v) => (s.capNeg = v) });
      }
      C.slider(w, { label: 'Uniform surcharge at the ground surface q', min: 0, max: en ? 4000 : 200, step: 0.1, get: () => s.q, set: (v) => (s.q = v), unit: U.press });
      if (o.seepage !== false) {
        const sp = C.section(el, 'Seepage');
        C.seg(sp, { label: 'Flow through one layer', options: [['none', 'None (hydrostatic)'], ['up', 'Upward (artesian)'], ['down', 'Downward']], get: () => s.seep, set: (v) => (s.seep = v) });
        if (s.seep !== 'none') {
          C.select(sp, { label: 'Layer with seepage', options: s.layers.map((l, i) => [i, `Layer ${i + 1} (${(G.SOILS[l.soil] || G.SOILS.sand).name})`]), get: () => s.seepLayer, set: (v) => (s.seepLayer = +v) });
          C.slider(sp, { label: 'Head difference across that layer Δh', min: 0, max: en ? 60 : 20, step: 0.01, get: () => s.dh, set: (v) => (s.dh = v), unit: U.len });
          C.note(sp, s.seep === 'up' ? 'A piezometer at the bottom of the layer rises Δh above the water table.' : 'A piezometer at the bottom of the layer stands Δh below the water table.');
        }
      }
    },

    /**
     * Draw the soil column in a Draw2D context (y = −depth). pr from Physics.soilProfile.
     * o = { x0, x1, U, label:true, piezo:true }
     */
    drawColumn(D, pr, o) {
      const { x0, x1, U } = o, W = x1 - x0, Ht = pr.Ht;
      let z = 0;
      pr.Ls.forEach((l, i) => {
        const sat = pr.zw < z + l.H; // part of the layer is below the water table
        G.soilRect(D, x0, -(z + l.H), x1, -z, l.soil);
        // blue tint below the water table, light tint in the capillary zone
        const zw = Math.max(z, Math.min(z + l.H, pr.zw));
        if (sat) D.poly([[x0, -(z + l.H)], [x1, -(z + l.H)], [x1, -zw], [x0, -zw]], { fill: '#4aa3df', fop: 0.16 });
        if (pr.hc > 0) { const a = Math.max(z, pr.zc), b = Math.min(z + l.H, pr.zw); if (b > a) D.poly([[x0, -b], [x1, -b], [x1, -a], [x0, -a]], { fill: '#4aa3df', fop: 0.08, stroke: '#4aa3df', sw: 0.6, dash: '3 3' }); }
        if (o.label !== false) {
          const g = pr.G[i];
          D.text([x0 + 0.04 * W, -(z + l.H / 2)], `${i + 1}. ${(G.SOILS[l.soil] || G.SOILS.sand).name}`, { dy: -4, size: 11.5, color: '#1d2733', weight: 700 });
          D.text([x0 + 0.04 * W, -(z + l.H / 2)], l.note ? l.note : pr.zw >= z + l.H ? `γ = ${f(g.gm)}` : pr.zw <= z ? `γ_sat = ${f(g.gsat)}` : `γ = ${f(g.gm)} / ${f(g.gsat)}`, { dy: 11, size: 10.5, color: '#1d2733' });
        }
        z += l.H;
      });
      D.pline([[x0, 0], [x0, -Ht], [x1, -Ht], [x1, 0]], { stroke: '#5b4a35', sw: 1.4 });
      D.line([x0 - 0.15 * W, 0], [x1 + 0.05 * W, 0], { stroke: '#2c3e50', sw: 2 });
      // ponded water / water table
      if (pr.pond > 0) { D.poly([[x0, 0], [x1, 0], [x1, pr.pond], [x0, pr.pond]], { fill: 'url(#waterGrad)', op: 0.8 }); D.fs([x0 + 0.7 * W, pr.pond], { label: `${f(pr.pond)} ${U.len}` }); }
      else if (pr.zw < Ht) { D.line([x0, -pr.zw], [x1, -pr.zw], { stroke: '#1f6fa8', sw: 1.4, dash: '7 4' }); D.fs([x0 + 0.78 * W, -pr.zw], { label: 'GWT' }); }
      if (pr.hc > 0 && pr.zw > 0) D.text([x1, -Math.max(0, pr.zc)], `capillary h_c = ${f(pr.hc)}`, { anchor: 'end', dx: -4, dy: 12, size: 10, color: '#1f6fa8' });
      // surcharge
      if (pr.q > 0) {
        const top = pr.pond;
        D.poly([[x0, top], [x1, top], [x1, top + 0.06 * Ht], [x0, top + 0.06 * Ht]], { fill: '#e67e22', fop: 0.18, stroke: '#e67e22', sw: 1 });
        for (let i = 0; i <= 5; i++) { const x = x0 + (W * i) / 5; D.arrow([x, top + 0.06 * Ht], [x, top], { color: '#e67e22', w: 1.4, head: 6 }); }
        D.text([x0 + W / 2, top + 0.06 * Ht], `q = ${f(pr.q)} ${U.press}`, { anchor: 'middle', dy: -5, size: 11, color: '#c0611a' });
      }
      // seepage: arrows and a piezometer from the bottom of the layer
      if (pr.sp && Math.abs(pr.sp.dh) > 0 && o.piezo !== false) {
        const sp = pr.sp, up = sp.dh > 0;
        for (let i = 1; i <= 3; i++) { const x = x0 + (W * i) / 4, y0 = -(up ? sp.zb : sp.zt) - (up ? -0.15 : 0.15) * (sp.zb - sp.zt), y1 = -(up ? sp.zt : sp.zb) + (up ? -0.15 : 0.15) * (sp.zb - sp.zt); D.arrow([x, y0], [x, y1], { color: '#2980b9', w: 1.8, head: 8 }); }
        const xp = x1 - 0.12 * W, lvl = -(pr.zw - sp.dh);
        D.pline([[xp, -sp.zb], [xp, Math.max(lvl, -pr.zw) + 0.08 * Ht]], { stroke: '#2c3e50', sw: 1.2 });
        D.pline([[xp + 0.04 * W, -sp.zb], [xp + 0.04 * W, Math.max(lvl, -pr.zw) + 0.08 * Ht]], { stroke: '#2c3e50', sw: 1.2 });
        D.poly([[xp, -sp.zb], [xp + 0.04 * W, -sp.zb], [xp + 0.04 * W, lvl], [xp, lvl]], { fill: '#4aa3df', fop: 0.85 });
        D.text([xp + 0.04 * W, lvl], `piezometer Δh = ${f(Math.abs(sp.dh))}`, { dx: 4, dy: up ? -4 : 12, size: 10, color: '#1f6fa8' });
      }
    },

    column3D(V, pr, o) {
      const { x0, x1, z0, z1 } = o; let z = 0;
      const bands = pr.Ls.map((l) => { const b = { y0: -(z + l.H), y1: -z, soil: l.soil, sat: pr.zw < z + l.H }; z += l.H; return b; });
      G.soilBlock3D(V, x0, x1, z0, z1, bands);
      if (pr.pond > 0) V.box(x0, 0, z0, x1, pr.pond, z1, '#4aa3df', 0.3, '#1f6fa8');
      else if (pr.zw < pr.Ht) V.face([[x0, -pr.zw, z0], [x1, -pr.zw, z0], [x1, -pr.zw, z1], [x0, -pr.zw, z1]], '#4aa3df', 0.35, '#1f6fa8');
      if (pr.q > 0) for (let i = 0; i <= 3; i++) for (let j = 0; j <= 2; j++) { const x = x0 + ((x1 - x0) * i) / 3, zz = z0 + ((z1 - z0) * j) / 2, t = pr.pond; G.arrow3D(V, [x, t + 0.1 * pr.Ht, zz], [x, t, zz], '#e67e22', 1.6, null, 0.03 * pr.Ht); }
    },
  };

  root.GeoProfile = GeoProfile;
})(window);
