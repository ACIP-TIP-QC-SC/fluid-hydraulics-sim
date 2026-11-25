/* =====================================================================
 * More statics extensions (2026-11-25, CE Reference Vol. 4–6 coverage).
 * Registered into the StatX table so they appear as extra "situations"
 * of the existing modules:
 *   Hydrostatic Forces → sector (circular-arc / radial gate of any angle)
 *   Buoyancy           → ship (draft change: load change, sea ↔ fresh water)
 *                        anch (cylindrical buoy held by an anchor block, tide)
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Physics, Scene, StatX } = root;
  if (!StatX || !StatX.X) return;
  const X = StatX.X, f = Physics.fmt;
  const PI = Math.PI, DEG = PI / 180;
  const WATER = '#4aa3df', WATERD = '#1f6fa8', STEEL = '#9aa3ad', GATE = '#e67e22', INK = '#2c3e50', RED = '#c0392b', BLUE = '#2471a3';
  const SI = (U) => U.id === 'SI';
  const pick = (U, a, b) => (SI(U) ? a : b);
  function Steps() { const list = []; return { list, add(t, fo, s, r, n) { list.push({ t, f: fo, s, r, n }); } }; }
  const fail = (err, steps) => ({ ok: false, err, warn: [], steps: steps || [], out: [], geo: {} });
  const ok = (st, out, warn, text, geo, cls) => ({ ok: true, err: [], warn: warn || [], steps: st.list, out, status: { cls: cls || 'ok', text }, geo });

  /* ---------------- Hydrostatic forces: circular arc (sector gate) ---------------- */
  // Pivot O at the origin; arc points P(φ) = O + R(−cos φ, sin φ), φ from φ₁ to φ₂ (degrees above the horizontal
  // through O, on the water side, which is the left). The free surface is h_s above O.
  function sector(p, U) {
    const st = Steps(), warn = [];
    const R = p.R, L = p.Ls, g = p.sgS * U.gw, a1 = Math.min(p.ph1, p.ph2) * DEG, a2 = Math.max(p.ph1, p.ph2) * DEG, hs = p.hs;
    if (!(R > 0) || !(L > 0)) return fail(['Enter a positive radius and gate length.']);
    if (!(a2 - a1 > 1e-6)) return fail(['The arc needs two different end angles.']);
    const outer = p.wside !== 'in'; // water on the convex (outer) face, away from the pivot
    const n = 2000, dA = (a2 - a1) / n;
    let Fx = 0, Fy = 0, wet = 0;
    for (let i = 0; i < n; i++) {
      const a = a1 + (i + 0.5) * dA, y = R * Math.sin(a), pr = Math.max(0, g * (hs - y));
      if (pr > 0) wet++;
      const dF = pr * R * dA * L;
      // water outside pushes toward O: direction (cos a, −sin a); inside pushes away from O
      const sgn = outer ? 1 : -1;
      Fx += sgn * dF * Math.cos(a); Fy += -sgn * dF * Math.sin(a);
    }
    if (!wet) return fail(['The arc is entirely above the water surface.']);
    const yTop = R * Math.sin(a2), yBot = R * Math.sin(a1), xTop = -R * Math.cos(a2), xBot = -R * Math.cos(a1);
    const z1 = Math.max(0, hs - Math.min(hs, yTop)), z2 = Math.max(0, hs - yBot); // depths of the wetted vertical projection
    const yw = Math.min(hs, Math.max(yTop, yBot)), hProj = Math.max(0, yw - Math.min(yTop, yBot));
    const FH = g * ((z1 + z2) / 2) * hProj * L;
    st.add('Horizontal component (force on the vertical projection)', 'F_H = γ h̄ A_v,  A_v = (projected height) × L', `γ = ${f(p.sgS)} × ${f(U.gw)} = ${f(g)};  projection from ${f(z1)} to ${f(z2)} ${U.len} deep, height ${f(hProj)}`, `F_H = ${f(g)} × ${f((z1 + z2) / 2)} × ${f(hProj)} × ${f(L)} = ${f(FH)} ${U.force}`, 'Arc points: φ is measured from the horizontal through the pivot O; the arc runs from φ₁ to φ₂.');
    // vertical: weight of the liquid (real or imaginary) between the arc and the free surface
    const Avol = Math.abs(Fy) / (g * L);
    const sectorA = (R * R * (a2 - a1)) / 2;
    st.add('Vertical component (liquid above the arc up to the free surface)', 'F_V = γ × (area between the arc and the surface) × L', `area = ${f(Avol)} ${U.area}  (sector O–arc = R²Δφ/2 = ${f(sectorA)} ${U.area} for reference)`, `F_V = ${f(g)} × ${f(Avol)} × ${f(L)} = ${f(Math.abs(Fy))} ${U.force} ${Fy < 0 ? 'downward (real liquid above)' : 'upward (imaginary liquid above)'}`, 'Found by integrating the pressure along the arc, which also covers arcs that cross the pivot level or are only partly wet.');
    if (Math.abs(Math.abs(Fx) - FH) > 1e-6 * Math.max(1, FH)) warn.push('Check: the projection formula and the integration differ (an arc that doubles back on itself has its horizontal forces partly cancel).');
    const F = Math.hypot(Fx, Fy), ang = Math.atan2(Math.abs(Fy), Math.abs(Fx)) / DEG;
    st.add('Resultant', 'F = √(F_H² + F_V²),  tan α = F_V / F_H', `F = √(${f(Math.abs(Fx))}² + ${f(Math.abs(Fy))}²)`, `F = ${f(F)} ${U.force} at α = ${f(ang)}° to the horizontal`, 'Every pressure acts normal to the arc, so the resultant passes through the pivot O: it has no moment about the pivot.');
    // where the resultant line (through O) meets the arc
    const dir = Math.atan2(-Fy, -Fx); // line through O pointing back to the water side
    const out = [
      { k: 'Horizontal force F_H', v: Math.abs(Fx), u: U.force, hl: true },
      { k: `Vertical force F_V (${Fy < 0 ? 'downward' : 'upward'})`, v: Math.abs(Fy), u: U.force, hl: true },
      { k: 'Resultant F', v: F, u: U.force },
      { k: 'Angle with the horizontal α', v: ang, u: '°' },
      { k: 'Moment about the pivot', v: 0, u: U.mom },
      { k: 'Height of the arc (vertical projection)', v: Math.abs(yTop - yBot), u: U.len },
    ];
    return ok(st, out, warn, `F_H = ${f(Math.abs(Fx))}, F_V = ${f(Math.abs(Fy))} ${U.force}`, { R, a1, a2, hs, Fx, Fy, F, dir, outer, xTop, yTop, xBot, yBot });
  }
  X.sector = {
    mod: 'm1', label: 'Circular arc (sector gate)',
    def: { R: 6, ph1: 0, ph2: 60, hs: 5.196, Ls: 10, sgS: 1, wside: 'out' },
    controls(x, el, C, U, sl) {
      const g = C.section(el, 'Arc (pivot O at the centre)');
      sl(g, 'R', 'Radius R', 0.01, pick(U, 50, 150), 0.001, U.len);
      sl(g, 'ph1', 'Lower end angle φ₁ (from the horizontal through O)', -90, 90, 0.01, '°');
      sl(g, 'ph2', 'Upper end angle φ₂', -90, 90, 0.01, '°');
      C.note(g, 'Angles are measured at O from the horizontal, positive upward, on the water side. Example: a 60° sector gate with its pivot level with the sill has φ₁ = 0°, φ₂ = 60°.');
      sl(g, 'Ls', 'Gate length L (into the page)', 0.01, pick(U, 100, 300), 0.001, U.len);
      const w = C.section(el, 'Water');
      sl(w, 'hs', 'Water surface above the pivot O', -50, pick(U, 100, 300), 0.001, U.len);
      sl(w, 'sgS', 'Specific gravity', 0.1, 15, 0.001, '');
      C.seg(w, { label: 'Water is on', options: [['out', 'The convex face (away from O)'], ['in', 'The concave face (O side)']], get: () => x.wside, set: (v) => (x.wside = v) });
    },
    compute: (x, U) => sector(x, U),
    scene(x, res, U) {
      const g = res.geo, sc = Scene.Scene(), R = g.R;
      const arc = []; for (let i = 0; i <= 48; i++) { const a = g.a1 + ((g.a2 - g.a1) * i) / 48; arc.push([-R * Math.cos(a), R * Math.sin(a)]); }
      const top = Math.max(g.hs, g.yTop, 0), left = -R * 1.35;
      // water region on the convex side: from the arc out to the left, up to the surface
      if (g.outer) {
        const wpts = [[left, Math.min(g.yBot, g.yTop)]].concat(arc.filter((q) => q[1] <= g.hs + 1e-9)).concat([[arc.filter((q) => q[1] <= g.hs + 1e-9).slice(-1)[0][0], g.hs], [left, g.hs]]);
        sc.poly(wpts, { fill: WATER, stroke: 'none', fop: 0.45 }, { fill: WATER, alpha: 0.25 });
      } else {
        const wet = arc.filter((q) => q[1] <= g.hs + 1e-9);
        sc.poly([[0, Math.min(g.yBot, g.yTop)]].concat(wet).concat([[wet.slice(-1)[0][0], Math.min(g.hs, top)], [0, Math.min(g.hs, top)]]), { fill: WATER, stroke: 'none', fop: 0.45 }, { fill: WATER, alpha: 0.25 });
      }
      sc.line([left, g.hs], [Math.max(0.2 * R, 0), g.hs], { stroke: WATERD, sw: 1.5 });
      sc.fs([left + 0.15 * R, g.hs]);
      sc.pline(arc, { stroke: GATE, sw: 5 });
      sc.poly(arc.concat(arc.slice().reverse().map((q) => [q[0] * 0.985, q[1] * 0.985])), { fill: GATE, stroke: 'none' }, { fill: GATE, alpha: 0.9 });
      sc.line([0, 0], [g.xBot, g.yBot], { stroke: '#7f8c8d', dash: '4 3' }); sc.line([0, 0], [g.xTop, g.yTop], { stroke: '#7f8c8d', dash: '4 3' });
      sc.dot([0, 0], INK, 'O');
      const mid = (g.a1 + g.a2) / 2, pm = [-R * Math.cos(mid), R * Math.sin(mid)];
      sc.arrow([pm[0] - 0.35 * R, pm[1]], [pm[0] - 0.02 * R, pm[1]], { color: RED, label: `F_H = ${f(Math.abs(g.Fx))} ${U.force}` });
      const fvA = g.Fy < 0 ? [pm[0], pm[1] + 0.35 * R] : [pm[0], pm[1] - 0.35 * R];
      sc.arrow(fvA, [pm[0], pm[1] + (g.Fy < 0 ? 0.02 : -0.02) * R], { color: BLUE, label: `F_V = ${f(Math.abs(g.Fy))}` });
      const dl = R * 0.9; sc.line([0, 0], [Math.cos(g.dir) * dl, Math.sin(g.dir) * dl], { stroke: RED, dash: '6 4', sw: 1.4 });
      sc.dim([0.12 * R, 0], [0.12 * R, g.hs], `h_s = ${f(g.hs)} ${U.len}`, -18);
      sc.text([-R * Math.cos(g.a2) - 0.05 * R, R * Math.sin(g.a2) + 0.08 * R], `R = ${f(R)} ${U.len}`, { anchor: 'end', size: 11 });
      sc.depth = Math.max(0.5 * R, x.Ls * 0.25);
      return sc;
    },
  };

  /* ---------------- Buoyancy: ship draft change ---------------- */
  const WUNITS = (U) => (SI(U) ? { kN: ['kN', 1], MN: ['MN', 1000], t: ['tonnes (mass)', 9.81] } : { lb: ['lb', 1], kip: ['kip', 1000], ton: ['short tons (2000 lb)', 2000], LT: ['long tons (2240 lb)', 2240] });
  function ship(p, U) {
    const st = Steps(), warn = [];
    const WU = WUNITS(U), k = (WU[p.wu] || Object.values(WU)[0])[1], wl = (WU[p.wu] || Object.values(WU)[0])[0];
    const W1 = p.W1 * k, g1 = p.s1 * U.gw, g3 = p.s3 * U.gw;
    if (!(W1 > 0) || !(p.d1 > 0)) return fail(['Enter the weight and draft of the ship.']);
    let Aw;
    const V1 = W1 / g1;
    st.add('Displaced volume at the start', 'V₁ = W₁ / γ₁', `V₁ = ${f(W1)} / (${f(p.s1)} × ${f(U.gw)})`, `V₁ = ${f(V1)} ${U.vol}`, p.wu === 't' ? 'A mass in tonnes weighs 9.81 kN per tonne.' : '');
    if (p.AwBy === 'two') {
      const W2 = p.W2 * k, dd = p.d1 - p.d2;
      if (!(Math.abs(dd) > 0)) return fail(['The two drafts must differ.']);
      Aw = (W1 - W2) / (g1 * dd);
      st.add('Waterline area from the change in load', 'A_w = ΔW / (γ₁ Δd)', `A_w = (${f(W1)} − ${f(W2)}) / (${f(g1)} × (${f(p.d1)} − ${f(p.d2)}))`, `A_w = ${f(Aw)} ${U.area}`, 'The sides are vertical near the waterline, so each unit of draft displaces A_w of volume.');
      if (!(Aw > 0)) return fail(['Unloading must make the ship rise (W₂ < W₁ with d₂ < d₁).'], st.list);
    } else Aw = p.Aw;
    if (!(Aw > 0)) return fail(['Enter the waterline area.']);
    const W3 = (p.W3same ? (p.AwBy === 'two' ? p.W2 : p.W1) : p.W3) * k, V3 = W3 / g3;
    const dRef = p.AwBy === 'two' ? p.d2 : p.d1, Wref = p.AwBy === 'two' ? p.W2 * k : W1, Vref = Wref / g1;
    st.add('Displaced volume in the final condition', 'V₃ = W₃ / γ₃', `V₃ = ${f(W3)} / (${f(p.s3)} × ${f(U.gw)})`, `V₃ = ${f(V3)} ${U.vol}`, '');
    const d3 = dRef + (V3 - Vref) / Aw;
    st.add('New draft', 'd₃ = d_ref + (V₃ − V_ref) / A_w', `d₃ = ${f(dRef)} + (${f(V3)} − ${f(Vref)}) / ${f(Aw)}`, `d₃ = ${f(d3)} ${U.len}`, `Reference condition: ${p.AwBy === 'two' ? 'after the load change' : 'the start'} (W = ${f(Wref)} ${U.force}, d = ${f(dRef)} ${U.len}).`);
    if (Math.abs(d3 - dRef) > 0.25 * dRef) warn.push('The draft changes a lot: the vertical-sides assumption near the waterline may not hold.');
    const out = [
      { k: 'Final draft d₃', v: d3, u: U.len, hl: true },
      { k: 'Change from the reference draft', v: d3 - dRef, u: U.len },
      { k: 'Waterline area A_w', v: Aw, u: U.area },
      { k: 'Displaced volume at the start V₁', v: V1, u: U.vol }, { k: 'Displaced volume at the end V₃', v: V3, u: U.vol },
      { k: `Load per ${pick(U, 'cm', 'in')} of immersion`, v: (g1 * Aw * pick(U, 0.01, 1 / 12)) / k, u: wl },
    ];
    return ok(st, out, warn, `d₃ = ${f(d3)} ${U.len}`, { d1: p.d1, d3, dRef, s1: p.s1, s3: p.s3, Aw });
  }
  X.ship = {
    mod: 'm2', label: 'Ship draft change',
    def: { wu: 'kN', W1: 40000, d1: 6.7, s1: 1.026, AwBy: 'two', Aw: 600, W2: 38000, d2: 6.4, W3same: true, W3: 38000, s3: 1 },
    controls(x, el, C, U, sl) {
      const WU = WUNITS(U); if (!WU[x.wu]) x.wu = Object.keys(WU)[0];
      const wl = WU[x.wu][0];
      const g = C.section(el, 'Ship at the start');
      C.select(g, { label: 'Weight given in', options: Object.keys(WU).map((q) => [q, WU[q][0]]), get: () => x.wu, set: (v) => (x.wu = v) });
      sl(g, 'W1', 'Weight (displacement) W₁', 0.001, 1e7, 0.001, wl);
      sl(g, 'd1', 'Draft d₁', 0.001, pick(U, 40, 120), 0.0001, U.len);
      sl(g, 's1', 'Specific gravity of the water (sea ≈ 1.026–1.03)', 0.8, 1.5, 0.0001, '');
      const a = C.section(el, 'Waterline area');
      C.seg(a, { label: 'Waterline area', options: [['A', 'Given'], ['two', 'From a load change (two drafts)']], get: () => x.AwBy, set: (v) => (x.AwBy = v) });
      if (x.AwBy === 'A') sl(a, 'Aw', 'Waterline area A_w', 0.01, 1e6, 0.01, U.area);
      else { sl(a, 'W2', 'Weight after loading / unloading W₂', 0.001, 1e7, 0.001, wl); sl(a, 'd2', 'Draft then d₂ (same water)', 0.001, pick(U, 40, 120), 0.0001, U.len); }
      const fz = C.section(el, 'Final condition');
      C.toggle(fz, { label: x.AwBy === 'two' ? 'Same weight as W₂' : 'Same weight as W₁', get: () => x.W3same, set: (v) => (x.W3same = v) });
      if (!x.W3same) sl(fz, 'W3', 'Final weight W₃', 0.001, 1e7, 0.001, wl);
      sl(fz, 's3', 'Specific gravity of the water (fresh = 1)', 0.8, 1.5, 0.0001, '');
    },
    compute: (x, U) => ship(x, U),
    scene(x, res, U) {
      const g = res.geo, sc = Scene.Scene(), B = 8, H = Math.max(g.d1, g.d3) * 1.7;
      const hull = (cx, d, s, lab) => {
        sc.rect(cx - B * 0.75, -H * 0.2, cx + B * 0.75, d, { fill: s > 1.005 ? '#5dade2' : WATER, stroke: 'none', fop: 0.4 }, { fill: WATER, alpha: 0.2 });
        sc.poly([[cx - B / 2, 0], [cx + B / 2, 0], [cx + B / 2, H], [cx - B / 2, H]].map((q) => [q[0], q[1]]).map((q) => [q[0], q[1] - 0]), { fill: '#d5d8dc', stroke: INK, sw: 1.6 }, { fill: '#d5d8dc', alpha: 0.95 });
        sc.line([cx - B * 0.75, d], [cx + B * 0.75, d], { stroke: WATERD, sw: 1.6 });
        sc.dim([cx + B / 2 + 0.6, 0], [cx + B / 2 + 0.6, d], `d = ${f(d)} ${U.len}`, -16);
        sc.text([cx, -H * 0.32], lab, { anchor: 'middle', in3: true });
      };
      hull(0, g.d1, g.s1, `start: S = ${f(g.s1)}`);
      hull(B * 1.9, g.d3, g.s3, `final: S = ${f(g.s3)}`);
      sc.depth = B * 0.6;
      return sc;
    },
  };

  /* ---------------- Buoyancy: cylinder buoy on an anchor block ---------------- */
  function anchor(p, U) {
    const st = Steps(), warn = [];
    const fu = pick(U, 'N', 'lb'), gF = pick(U, 1000, 1); // force unit: N (SI) / lb (EN)
    const gs = p.sgA * U.gw * gF, A = (PI * p.Db * p.Db) / 4, byD = p.dBy === 'draft', dr = byD ? p.dr : p.Hb - p.fb;
    if (!(p.Db > 0) || (!byD && !(p.Hb > 0))) return fail(['Enter the buoy diameter and height.']);
    if (!(dr > 0)) return fail([byD ? 'Enter a positive submerged depth.' : 'The freeboard must be less than the buoy height.']);
    const BF = gs * A * dr;
    st.add('Buoyant force on the buoy', byD ? 'BF = γ_s A d,  A = πD²/4' : 'BF = γ_s A (H − f),  A = πD²/4', byD ? `BF = ${f(gs)} × ${f(A)} × ${f(dr)}` : `BF = ${f(gs)} × ${f(A)} × (${f(p.Hb)} − ${f(p.fb)})`, `BF = ${f(BF)} ${fu}`, `γ_s = ${f(p.sgA)} × ${f(U.gw * gF)} ${pick(U, 'N/m³', 'lb/ft³')}.`);
    const T = BF - p.Wb;
    st.add('Tension in the anchor line', 'T = BF − W_buoy', `T = ${f(BF)} − ${f(p.Wb)}`, `T = ${f(T)} ${fu}`, T < 0 ? 'Negative: the buoy would float higher with a slack line.' : '');
    const Wa = p.gA * gF * p.Va, BFa = gs * p.Va, net = Wa - BFa;
    st.add('Anchor block: weight less buoyancy', 'W′ = (γ_c − γ_s) V_a', `W′ = (${f(p.gA * gF)} − ${f(gs)}) × ${f(p.Va)}`, `W′ = ${f(net)} ${fu}`, 'The block lifts off the sea bed when the line tension reaches W′.');
    const need = p.Wb + net, drN = need / (gs * A), rise = drN - dr;
    st.add('Rise of the tide that lifts the anchor', 'BF needed = W_buoy + W′;  draft needed = BF / (γ_s A);  Δh = draft needed − present draft', `BF = ${f(p.Wb)} + ${f(net)} = ${f(need)};  draft = ${f(need)} / (${f(gs)} × ${f(A)}) = ${f(drN)}`, `Δh = ${f(drN)} − ${f(dr)} = ${f(rise)} ${U.len}`, p.Hb > 0 && drN > p.Hb ? 'The draft needed is more than the buoy height: the buoy goes under before the anchor lifts.' : 'The line is taut, so the buoy is pulled deeper as the tide rises.');
    if (p.Hb > 0 && drN > p.Hb) warn.push('The buoy is fully submerged before the anchor lifts: it cannot lift the anchor.');
    const out = [
      { k: 'Buoyant force on the buoy', v: BF, u: fu, hl: true },
      { k: 'Tension in the line T', v: T, u: fu, hl: true },
      { k: 'Tide rise that lifts the anchor', v: rise, u: U.len, hl: true },
      { k: 'Anchor weight', v: Wa, u: fu }, { k: 'Buoyancy on the anchor', v: BFa, u: fu }, { k: 'Tension that lifts the anchor W′', v: net, u: fu },
      { k: 'Submerged depth now', v: dr, u: U.len }, { k: 'Submerged depth when the anchor lifts', v: drN, u: U.len },
      { k: 'Max buoyancy (fully submerged)', v: gs * A * p.Hb, u: fu },
    ];
    return ok(st, out, warn, `T = ${f(T)} ${fu}, tide rise = ${f(rise)} ${U.len}`, { D: p.Db, H: p.Hb, dr, drN, T, BF });
  }
  X.anch = {
    mod: 'm2', label: 'Buoy on an anchor (tide)',
    def: { Db: 1.2, dBy: 'free', dr: 0.5, Hb: 1.5, Wb: 800, fb: 0.6, sgA: 1.03, Va: 0.5, gA: 24 },
    controls(x, el, C, U, sl) {
      const fu = pick(U, 'N', 'lb');
      const g = C.section(el, 'Cylindrical buoy (axis vertical)');
      sl(g, 'Db', 'Diameter D', 0.01, pick(U, 20, 60), 0.001, U.len);
      sl(g, 'Wb', 'Weight of the buoy', 0, pick(U, 1e6, 2e5), 0.01, fu);
      C.seg(g, { label: 'Position given by', options: [['free', 'Freeboard (top above water)'], ['draft', 'Submerged depth']], get: () => x.dBy, set: (v) => (x.dBy = v) });
      sl(g, 'Hb', x.dBy === 'draft' ? 'Height H (0 = not given)' : 'Height H', 0, pick(U, 20, 60), 0.001, U.len);
      if (x.dBy === 'draft') sl(g, 'dr', 'Submerged depth d', 0.001, pick(U, 20, 60), 0.001, U.len);
      else sl(g, 'fb', 'Freeboard (top above the water)', 0, pick(U, 20, 60), 0.001, U.len);
      sl(g, 'sgA', 'Specific gravity of the water', 0.9, 1.3, 0.0001, '');
      const a = C.section(el, 'Anchor block on the sea bed');
      sl(a, 'Va', 'Volume of the block', 0.0001, pick(U, 50, 2000), 0.0001, U.vol);
      sl(a, 'gA', 'Unit weight of the block', 1, pick(U, 100, 600), 0.01, pick(U, 'kN/m³', 'lb/ft³'));
    },
    compute: (x, U) => anchor(x, U),
    scene(x, res, U) {
      const g = res.geo, sc = Scene.Scene(), D = g.D, H = g.H > 0 ? g.H : Math.max(g.dr, g.drN) * 1.3, sea = H * 3.2;
      const y0 = sea - g.dr; // buoy bottom
      sc.rect(-D * 2.2, 0, D * 2.2, sea, { fill: WATER, stroke: 'none', fop: 0.4 }, { fill: WATER, alpha: 0.2 });
      sc.line([-D * 2.2, sea], [D * 2.2, sea], { stroke: WATERD, sw: 1.6 }); sc.fs([-D * 1.8, sea]);
      sc.line([-D * 2.2, 0], [D * 2.2, 0], { stroke: '#7e5109', sw: 3 });
      sc.rect(-D / 2, y0, D / 2, y0 + H, { fill: GATE, stroke: INK, sw: 1.6 }, false);
      sc.lathe([[0, y0], [D / 2, y0], [D / 2, y0 + H], [0, y0 + H]], 0, GATE, 0.9);
      const b = D * 0.45; sc.rect(-b, 0, b, b * 0.9, { fill: STEEL, stroke: INK, sw: 1.4 }, { fill: STEEL, alpha: 0.95, z0: -b, z1: b });
      sc.line([0, b * 0.9], [0, y0], { stroke: INK, sw: 1.6 });
      sc.text([0.08 * D, (b + y0) / 2], `T = ${f(g.T)}`, { size: 11, color: RED, in3: true });
      sc.dim([D / 2 + 0.15 * D, y0], [D / 2 + 0.15 * D, sea], `draft = ${f(g.dr)} ${U.len}`, -16);
      sc.dim([-D / 2 - 0.15 * D, y0], [-D / 2 - 0.15 * D, y0 + H], `H = ${f(H)}`, 16);
      sc.depth = D;
      return sc;
    },
  };

  /* ---------------- presets ---------------- */
  const P = (name, k, v, units) => StatX.preset(name, k, v, units);
  if (root.M1) root.M1.presets.push(
    P('CE Ref 6 Apr 2024 #5 & #11 — 60° sector gate, R = 6 m, 10 m long, water to its top (F_H = 1324 kN, F_V = 444.7 kN)', 'sector', { R: 6, ph1: 0, ph2: 60, hs: 6 * Math.sin(60 * DEG), Ls: 10, sgS: 1, wside: 'out' }),
    P('Radial (Tainter) gate, pivot at the water surface, arc 0° to −40°, R = 8 m, 5 m long', 'sector', { R: 8, ph1: -40, ph2: 0, hs: 0, Ls: 5, sgS: 1, wside: 'out' }),
  );
  if (root.M2) root.M2.presets.push(
    P('CE Ref 6 Apr 2024 #10 / CE Ref 4 May 2017 #15 — 40 MN ship, 6.7 m in sea water, 2 MN unloaded → 6.4 m; draft in fresh water (6.548 m)', 'ship', { wu: 'kN', W1: 40000, d1: 6.7, s1: 1.026, AwBy: 'two', W2: 38000, d2: 6.4, W3same: true, s3: 1 }),
    P('Ship of 30,000 tonnes, draft 12.6 m in sea water 1.03, waterline area 3000 m²: draft in fresh water', 'ship', { wu: 't', W1: 30000, d1: 12.6, s1: 1.03, AwBy: 'A', Aw: 3000, W3same: true, s3: 1 }),
    P('CE Ref 4 Nov 2018 Sit. 1 — buoy D = 1 m, 850 N, 0.35 m submerged in sea water 1.03, anchor 0.5 m³ at 24 kN/m³ (BF 2.778 kN, T 1.928 kN, tide rise 0.633 m)', 'anch', { Db: 1, dBy: 'draft', dr: 0.35, Hb: 0, Wb: 850, sgA: 1.03, Va: 0.5, gA: 24 }),
  );
})(window);
