/* =====================================================================
 * Geotechnical — Soil phase relations (physics), used by the
 * "Phase relations" problem of the Effective Stress module.
 *
 * The user ticks the quantities that are known (any mix of G_s, e, n, w,
 * S, the unit weights, lab masses and volume, air content, relative
 * density). The solver then
 *   1. propagates: any relation with exactly one unknown is solved for it
 *      (closed forms, each recorded as a worked step), repeated until
 *      nothing new can be found;
 *   2. if G_s, e or S is still unknown but enough other quantities are
 *      known, solves the remaining core unknowns simultaneously
 *      (Gauss–Newton on log values) and propagates again.
 * Quantities that the data cannot fix are reported as "not determined".
 * An optional borrow-pit step turns the dry unit weight into the volume
 * to excavate for a compacted fill and the number of truckloads.
 * ===================================================================== */
(function (root) {
  'use strict';
  const P = root.Physics;
  const { fmt: f, Steps, fail } = P;

  /** Quantity catalogue: key → { label, kind } (kind: 'pct' = entered in %, 'gam' = unit weight, 'lab', 'num'). */
  const Q = {
    Gs: { label: 'Specific gravity of solids G_s', kind: 'num' },
    e: { label: 'Void ratio e', kind: 'num' },
    n: { label: 'Porosity n', kind: 'pct' },
    w: { label: 'Water (moisture) content w', kind: 'pct' },
    S: { label: 'Degree of saturation S', kind: 'pct' },
    gm: { label: 'Moist (bulk) unit weight γ', kind: 'gam' },
    gd: { label: 'Dry unit weight γ_d', kind: 'gam' },
    gsat: { label: 'Saturated unit weight γ_sat', kind: 'gam' },
    gsub: { label: 'Submerged unit weight γ′', kind: 'gam' },
    gs: { label: 'Unit weight of the solids γ_s', kind: 'gam' },
    ac: { label: 'Air content (air void ratio) a = n(1 − S)', kind: 'pct' },
    icr: { label: 'Critical hydraulic gradient i_cr', kind: 'num' },
    M: { label: 'Mass (weight) of the moist sample', kind: 'lab' },
    Ms: { label: 'Mass (weight) of the dry solids', kind: 'lab' },
    V: { label: 'Total volume of the sample', kind: 'labV' },
    emax: { label: 'Maximum void ratio e_max', kind: 'num' },
    emin: { label: 'Minimum void ratio e_min', kind: 'num' },
    Dr: { label: 'Relative density D_r', kind: 'pct' },
  };
  const ORDER = ['Gs', 'e', 'n', 'w', 'S', 'gm', 'gd', 'gsat', 'gsub', 'gs', 'ac', 'icr', 'M', 'Ms', 'V', 'emax', 'emin', 'Dr'];

  /** Lab unit sets: factor k so that γ = k · mass / volume in the unit-weight unit. */
  const LAB = {
    SI: { gcm: { m: 'g', v: 'cm³', k: (U) => U.g }, kgm: { m: 'kg', v: 'm³', k: (U) => U.g / 1000 }, Nm: { m: 'N', v: 'm³', k: () => 1 / 1000 }, kNm: { m: 'kN', v: 'm³', k: () => 1 } },
    EN: { lbft: { m: 'lb', v: 'ft³', k: () => 1 }, lbin: { m: 'lb', v: 'in³', k: () => 1728 } },
  };

  /*
   * Relations. Each has the variables it links and, for each variable, a
   * closed-form solver (vals → value) with its formula text.
   */
  function relations(gw, k) {
    return [
      { id: 'ne', v: ['n', 'e'], name: 'n = e / (1 + e)',
        s: { n: [(x) => x.e / (1 + x.e), 'n = e / (1 + e)'], e: [(x) => x.n / (1 - x.n), 'e = n / (1 − n)'] } },
      { id: 'Se', v: ['S', 'e', 'w', 'Gs'], name: 'S e = w G_s',
        s: { w: [(x) => (x.S * x.e) / x.Gs, 'w = S e / G_s'], e: [(x) => (x.w * x.Gs) / x.S, 'e = w G_s / S'], S: [(x) => (x.w * x.Gs) / x.e, 'S = w G_s / e'], Gs: [(x) => (x.S * x.e) / x.w, 'G_s = S e / w'] } },
      { id: 'gd', v: ['gd', 'Gs', 'e'], name: 'γ_d = G_s γw / (1 + e)',
        s: { gd: [(x) => (x.Gs * gw) / (1 + x.e), 'γ_d = G_s γw / (1 + e)'], Gs: [(x) => (x.gd * (1 + x.e)) / gw, 'G_s = γ_d (1 + e) / γw'], e: [(x) => (x.Gs * gw) / x.gd - 1, 'e = G_s γw / γ_d − 1'] } },
      { id: 'gmw', v: ['gm', 'gd', 'w'], name: 'γ = γ_d (1 + w)',
        s: { gm: [(x) => x.gd * (1 + x.w), 'γ = γ_d (1 + w)'], gd: [(x) => x.gm / (1 + x.w), 'γ_d = γ / (1 + w)'], w: [(x) => x.gm / x.gd - 1, 'w = γ / γ_d − 1'] } },
      { id: 'gsat', v: ['gsat', 'gd', 'n'], name: 'γ_sat = γ_d + n γw',
        s: { gsat: [(x) => x.gd + x.n * gw, 'γ_sat = γ_d + n γw'], gd: [(x) => x.gsat - x.n * gw, 'γ_d = γ_sat − n γw'], n: [(x) => (x.gsat - x.gd) / gw, 'n = (γ_sat − γ_d) / γw'] } },
      { id: 'gsub', v: ['gsub', 'gsat'], name: 'γ′ = γ_sat − γw',
        s: { gsub: [(x) => x.gsat - gw, 'γ′ = γ_sat − γw'], gsat: [(x) => x.gsub + gw, 'γ_sat = γ′ + γw'] } },
      { id: 'gmS', v: ['gm', 'gd', 'S', 'n'], name: 'γ = γ_d + S n γw',
        s: { gm: [(x) => x.gd + x.S * x.n * gw, 'γ = γ_d + S n γw'], gd: [(x) => x.gm - x.S * x.n * gw, 'γ_d = γ − S n γw'], S: [(x) => (x.gm - x.gd) / (x.n * gw), 'S = (γ − γ_d) / (n γw)'], n: [(x) => (x.gm - x.gd) / (x.S * gw), 'n = (γ − γ_d) / (S γw)'] } },
      { id: 'gs', v: ['gs', 'Gs'], name: 'γ_s = G_s γw',
        s: { gs: [(x) => x.Gs * gw, 'γ_s = G_s γw'], Gs: [(x) => x.gs / gw, 'G_s = γ_s / γw'] } },
      { id: 'ac', v: ['ac', 'n', 'S'], name: 'a = n (1 − S)',
        s: { ac: [(x) => x.n * (1 - x.S), 'a = n (1 − S)'], n: [(x) => x.ac / (1 - x.S), 'n = a / (1 − S)'], S: [(x) => 1 - x.ac / x.n, 'S = 1 − a / n'] } },
      { id: 'icr', v: ['icr', 'gsub'], name: 'i_cr = γ′ / γw',
        s: { icr: [(x) => x.gsub / gw, 'i_cr = γ′ / γw'], gsub: [(x) => x.icr * gw, 'γ′ = i_cr γw'] } },
      { id: 'labM', v: ['gm', 'M', 'V'], name: 'γ = M / V',
        s: { gm: [(x) => (k * x.M) / x.V, 'γ = M g / V'], M: [(x) => (x.gm * x.V) / k, 'M = γ V / g'], V: [(x) => (k * x.M) / x.gm, 'V = M g / γ'] } },
      { id: 'labMs', v: ['gd', 'Ms', 'V'], name: 'γ_d = M_s / V',
        s: { gd: [(x) => (k * x.Ms) / x.V, 'γ_d = M_s g / V'], Ms: [(x) => (x.gd * x.V) / k, 'M_s = γ_d V / g'], V: [(x) => (k * x.Ms) / x.gd, 'V = M_s g / γ_d'] } },
      { id: 'labw', v: ['w', 'M', 'Ms'], name: 'w = (M − M_s) / M_s',
        s: { w: [(x) => (x.M - x.Ms) / x.Ms, 'w = (M − M_s) / M_s'], M: [(x) => x.Ms * (1 + x.w), 'M = M_s (1 + w)'], Ms: [(x) => x.M / (1 + x.w), 'M_s = M / (1 + w)'] } },
      { id: 'Dr', v: ['Dr', 'emax', 'emin', 'e'], name: 'D_r = (e_max − e) / (e_max − e_min)',
        s: { Dr: [(x) => (x.emax - x.e) / (x.emax - x.emin), 'D_r = (e_max − e) / (e_max − e_min)'], e: [(x) => x.emax - x.Dr * (x.emax - x.emin), 'e = e_max − D_r (e_max − e_min)'] } },
    ];
  }

  /** Every quantity from the core (G_s, e, S) and optionally the sample volume V. */
  function fromCore(Gs, e, S, gw) {
    const n = e / (1 + e), gd = (Gs * gw) / (1 + e), w = (S * e) / Gs, gsat = gd + n * gw;
    return { Gs, e, S, n, gd, w, gm: gd * (1 + w), gsat, gsub: gsat - gw, gs: Gs * gw, ac: n * (1 - S), icr: (gsat - gw) / gw };
  }

  const pctKey = (key) => Q[key].kind === 'pct';
  const disp = (key, v) => (pctKey(key) ? v * 100 : v);

  /**
   * p = { known:{key:true}, val:{key:number (as entered: % for pct, density if dens)}, dens (SI: unit weights as kg/m³),
   *       lab ('gcm'|…), jar (V from container − water added), Vc, Vwa, borrow, bor:{ Vf, fillBy:'gd'|'rc', gdf, rc, gdmax, cap, swell } }
   */
  function phaseRel(p, U) {
    const st = Steps(), out = [], warn = [], gw = U.gw;
    const labSet = (LAB[U.id] || LAB.SI)[p.lab] || Object.values(LAB[U.id] || LAB.SI)[0];
    const k = labSet.k(U);
    const known = {};
    const given = [];
    // read the known values in internal units (fractions, unit weights)
    for (const key of ORDER) {
      if (!p.known || !p.known[key]) continue;
      let v = +p.val[key];
      if (key === 'V' && p.jar) {
        v = p.Vc - p.Vwa;
        st.add('Volume of the sample from the container', 'V = V_container − V_water added', `V = ${f(p.Vc)} − ${f(p.Vwa)}`, `V = ${f(v)} ${labSet.v}`, 'The water poured in fills the container around the sample, so the sample occupies the rest.');
      }
      if (!isFinite(v)) return fail([`Enter a value for ${Q[key].label}.`]);
      if (pctKey(key)) v /= 100;
      if (Q[key].kind === 'gam' && p.dens && U.id === 'SI') v = (v * U.g) / 1000; // ρ (kg/m³) → γ (kN/m³)
      known[key] = v;
      given.push(key);
    }
    if (given.length < 1) return fail(['Tick at least two known quantities.']);
    if (known.Gs !== undefined && !(known.Gs > 1)) return fail(['G_s must be greater than 1.']);
    if (known.e !== undefined && !(known.e >= 0)) return fail(['The void ratio cannot be negative.']);
    if (known.S !== undefined && (known.S < 0 || known.S > 1 + 1e-9)) return fail(['S must lie between 0 and 100 %.']);
    if (known.n !== undefined && (known.n < 0 || known.n >= 1)) return fail(['n must lie between 0 and 100 %.']);
    st.add('Given', 'known quantities', given.map((key) => `${Q[key].label.replace(/ \(.*\)/, '')} = ${f(disp(key, known[key]))}${pctKey(key) ? ' %' : ''}`).join(';  '), '', `γw = ${f(gw)} ${U.gamma}.${p.dens && U.id === 'SI' ? ' Densities were converted with γ = ρ g / 1000.' : ''}`);
    const R = relations(gw, k);
    const x = Object.assign({}, known);
    const how = {};
    const unit = (key) => (pctKey(key) ? '%' : Q[key].kind === 'gam' ? U.gamma : key === 'V' ? labSet.v : Q[key].kind === 'lab' ? labSet.m : '');
    const show = (key) => `${f(disp(key, x[key]))}${pctKey(key) ? ' %' : unit(key) ? ' ' + unit(key) : ''}`;
    function propagate() {
      let changed = true, guard = 0;
      while (changed && guard++ < 50) {
        changed = false;
        for (const r of R) {
          const unk = r.v.filter((key) => x[key] === undefined);
          if (unk.length !== 1) continue;
          const key = unk[0];
          if (!r.s[key]) continue;
          // avoid 0/0: S from w G_s / e when e = 0, etc.
          const v = r.s[key][0](x);
          if (!isFinite(v)) continue;
          x[key] = v;
          how[key] = r.id;
          const used = r.v.filter((q) => q !== key).map((q) => `${q === 'gm' ? 'γ' : q === 'gd' ? 'γ_d' : q === 'gsat' ? 'γ_sat' : q === 'gsub' ? 'γ′' : q === 'gs' ? 'γ_s' : q === 'Gs' ? 'G_s' : q === 'ac' ? 'a' : q === 'Ms' ? 'M_s' : q} = ${f(pctKey(q) ? x[q] : x[q])}`).join(', ');
          st.add(Q[key].label, r.s[key][1], used + (k && /M|V/.test(r.id) && r.id.startsWith('lab') && r.id !== 'labw' ? `, g factor = ${f(k)}` : ''), `${r.s[key][1].split(' = ')[0]} = ${show(key)}`, pctKey(key) ? 'Fractions are used in the formulas; percentages are shown in the result.' : '');
          changed = true;
        }
      }
    }
    propagate();
    // simultaneous solve for the remaining core unknowns
    const core = ['Gs', 'e', 'S'];
    let missing = core.filter((key) => x[key] === undefined);
    if (missing.length) {
      const target = Object.keys(known).filter((key) => !core.includes(key) && ['n', 'w', 'gm', 'gd', 'gsat', 'gsub', 'gs', 'ac', 'icr'].includes(key));
      // the volume-free lab ratios also constrain the core
      // only quantities that were given (derived ones add no new information); lab masses and volume enter through γ, γ_d and w
      const tk = target.slice();
      ['gm', 'gd', 'w'].forEach((q) => { if (x[q] !== undefined && !tk.includes(q) && (q === 'w' ? known.M !== undefined && known.Ms !== undefined : known.V !== undefined)) tk.push(q); });
      const uniq = Array.from(new Set(tk));
      if (uniq.length >= missing.length) {
        const guess = { Gs: 2.65, e: 0.7, S: 0.6 };
        let z = missing.map((key) => Math.log(key === 'S' ? 0.6 : guess[key]));
        const val = (zz) => { const c = { Gs: x.Gs, e: x.e, S: x.S }; missing.forEach((key, i) => { c[key] = Math.exp(zz[i]); }); return fromCore(c.Gs, c.e, Math.min(c.S, 1.5), gw); };
        const res = (zz) => { const d = val(zz); return uniq.map((key) => (d[key] - x[key]) / (Math.abs(x[key]) + 1e-6)); };
        let ok = false;
        for (let it = 0; it < 80; it++) {
          const r0 = res(z), J = [];
          for (let j = 0; j < z.length; j++) { const zz = z.slice(); zz[j] += 1e-6; const r1 = res(zz); J.push(r1.map((v, i) => (v - r0[i]) / 1e-6)); }
          // normal equations (JᵀJ) dz = −Jᵀ r
          const m = z.length, A = Array.from({ length: m }, () => new Array(m).fill(0)), b = new Array(m).fill(0);
          for (let a = 0; a < m; a++) { for (let c = 0; c < m; c++) A[a][c] = J[a].reduce((s, v, i) => s + v * J[c][i], 0) + (a === c ? 1e-12 : 0); b[a] = -J[a].reduce((s, v, i) => s + v * r0[i], 0); }
          const dz = solveLin(A, b);
          if (!dz) break;
          let step = 1;
          const n0 = r0.reduce((s, v) => s + v * v, 0);
          while (step > 1e-4) { const zn = z.map((v, i) => v + step * dz[i]); const n1 = res(zn).reduce((s, v) => s + v * v, 0); if (n1 < n0) { z = zn; break; } step /= 2; }
          const nn = res(z).reduce((s, v) => s + v * v, 0);
          if (nn < 1e-20) { ok = true; break; }
          if (dz.every((v) => Math.abs(v) < 1e-13)) { ok = nn < 1e-10; break; }
        }
        if (ok) {
          const d = val(z);
          missing.forEach((key) => { x[key] = d[key]; how[key] = 'sim'; });
          st.add(`Simultaneous solution for ${missing.map((q) => (q === 'Gs' ? 'G_s' : q)).join(', ')}`, 'γ_d = G_s γw/(1 + e),  w = S e / G_s,  γ = γ_d (1 + w),  γ_sat = (G_s + e) γw/(1 + e)', `matching ${uniq.map((q) => `${q === 'gm' ? 'γ' : q === 'gd' ? 'γ_d' : q === 'gsat' ? 'γ_sat' : q === 'gsub' ? 'γ′' : q} = ${f(pctKey(q) ? x[q] * 100 : x[q])}`).join(', ')}`, missing.map((q) => `${q === 'Gs' ? 'G_s' : q} = ${show(q)}`).join(',  '), 'No single relation had one unknown left, so the core unknowns were solved together (Gauss–Newton).');
          propagate();
        } else warn.push('The known quantities are not consistent with each other, or not enough to fix the soil; some results are left undetermined.');
      }
    }
    // consistency checks of over-determined data
    const c = x.Gs !== undefined && x.e !== undefined && x.S !== undefined ? fromCore(x.Gs, x.e, x.S, gw) : null;
    if (c) {
      for (const key of given) {
        if (c[key] === undefined) continue;
        const rel = Math.abs(c[key] - known[key]) / (Math.abs(known[key]) + 1e-9);
        if (rel > 0.005) warn.push(`${Q[key].label} given as ${f(disp(key, known[key]))}${pctKey(key) ? ' %' : ''} but the other data give ${f(disp(key, c[key]))}${pctKey(key) ? ' %' : ''} (over-determined data disagree by ${f(rel * 100, 2)} %).`);
      }
      if (x.S > 1 + 1e-6) warn.push('S comes out above 100 %: check the data.');
    }
    // extras
    if (x.Gs !== undefined) {
      x.gmax = x.Gs * gw;
      if (x.e !== undefined) x.wsat = x.e / x.Gs;
      if (x.w !== undefined) x.gzav = (x.Gs * gw) / (1 + x.w * x.Gs);
    }
    // results
    const det = [];
    for (const key of ['Gs', 'e', 'n', 'w', 'S', 'gm', 'gd', 'gsat', 'gsub', 'gs', 'ac', 'icr', 'M', 'Ms', 'V', 'Dr']) {
      if (x[key] === undefined) { if (['Gs', 'e', 'n', 'w', 'S', 'gm', 'gd', 'gsat'].includes(key)) det.push(Q[key].label); continue; }
      if (['M', 'Ms', 'V'].includes(key) && !(p.known.M || p.known.Ms || p.known.V)) continue;
      if (key === 'Dr' && x.emax === undefined) continue;
      out.push({ k: Q[key].label + (given.includes(key) ? ' (given)' : ''), v: disp(key, x[key]), u: unit(key), hl: !given.includes(key) && ['e', 'n', 'w', 'S', 'gm', 'gd', 'gsat'].includes(key) });
      if (Q[key].kind === 'gam' && U.id === 'SI') out.push({ k: `   as density ρ = γ / g`, v: (x[key] * 1000) / U.g, u: 'kg/m³' });
    }
    if (x.gmax !== undefined) {
      out.push({ k: 'Largest possible unit weight (e = 0): G_s γw', v: x.gmax, u: U.gamma });
      st.add('Largest possible unit weight of this soil', 'γ_max = G_s γw  (no voids, e = 0)', `γ_max = ${f(x.Gs)} × ${f(gw)}`, `γ_max = ${f(x.gmax)} ${U.gamma}`);
    }
    if (x.wsat !== undefined) out.push({ k: 'Water content at full saturation w_sat = e / G_s', v: x.wsat * 100, u: '%' });
    if (x.gzav !== undefined) out.push({ k: 'Zero-air-voids unit weight at this w: G_s γw/(1 + wG_s)', v: x.gzav, u: U.gamma });
    if (det.length) warn.push(`Not determined by the data: ${det.join(', ')}. Tick more known quantities.`);
    // three-phase volumes per unit total volume
    let blk = null;
    if (x.e !== undefined && x.S !== undefined && x.Gs !== undefined) {
      const Vt = 1 + x.e, Vs = 1 / Vt, Vv = x.e / Vt, Vw = x.S * Vv, Va = Vv - Vw;
      blk = { Vs, Vv, Vw, Va, Ws: x.Gs * gw * Vs, Ww: gw * Vw };
      st.add('Three-phase block for V = 1', 'V_s = 1/(1 + e), V_v = e/(1 + e), V_w = S V_v, V_a = V_v − V_w', `V_s = ${f(Vs)}, V_v = ${f(Vv)}, V_w = ${f(Vw)}, V_a = ${f(Va)}`, `W_s = ${f(blk.Ws)}, W_w = ${f(blk.Ww)} (per unit volume, ${U.gamma})`);
    }
    // borrow pit → compacted fill
    let bor = null;
    if (p.borrow) {
      const b = p.bor || {};
      const gdPit = x.gd;
      if (gdPit === undefined) return Object.assign(fail(['The borrow-pit soil needs a dry unit weight: tick enough known quantities.']), { steps: st.list });
      let gdf = b.gdf;
      if (b.fillBy === 'rc') { gdf = (b.rc / 100) * b.gdmax; st.add('Dry unit weight required in the fill', 'γ_d,fill = RC × γ_d,max', `γ_d,fill = ${f(b.rc / 100)} × ${f(b.gdmax)}`, `γ_d,fill = ${f(gdf)} ${U.gamma}`); }
      else if (b.fillBy === 'e') { gdf = (x.Gs * gw) / (1 + b.ef); if (!(x.Gs > 0)) return fail(['G_s is needed to use the void ratio of the fill.']); st.add('Dry unit weight required in the fill', 'γ_d,fill = G_s γw / (1 + e_fill)', `γ_d,fill = ${f(x.Gs)} × ${f(gw)} / (1 + ${f(b.ef)})`, `γ_d,fill = ${f(gdf)} ${U.gamma}`); }
      if (!(gdf > 0) || !(b.Vf > 0)) return fail(['Enter the fill volume and its dry unit weight.']);
      const Ws = gdf * b.Vf;
      const Vpit = Ws / gdPit;
      st.add('Weight of solids in the compacted fill', 'W_s = γ_d,fill × V_fill', `W_s = ${f(gdf)} × ${f(b.Vf)}`, `W_s = ${f(Ws)} ${U.force}`, 'The solids are the same in the pit and in the fill; only the voids change.');
      st.add('Volume to excavate from the borrow pit', 'V_pit = W_s / γ_d,pit', `V_pit = ${f(Ws)} / ${f(gdPit)}`, `V_pit = ${f(Vpit)} ${U.vol}`);
      out.unshift({ k: 'Volume of soil to excavate from the borrow pit', v: Vpit, u: U.vol, hl: true });
      let Vt = Vpit;
      if (b.swell > 0) { Vt = Vpit * (1 + b.swell / 100); st.add('Loose volume hauled (swell)', 'V_loose = V_pit (1 + swell)', `V_loose = ${f(Vpit)} × (1 + ${f(b.swell / 100)})`, `V_loose = ${f(Vt)} ${U.vol}`); out.splice(1, 0, { k: 'Loose volume hauled', v: Vt, u: U.vol }); }
      if (b.cap > 0) {
        const nT = Vt / b.cap;
        st.add('Number of truckloads', 'N = V / truck capacity', `N = ${f(Vt)} / ${f(b.cap)} = ${f(nT, 6)}`, `N = ${Math.ceil(nT - 1e-9)} truckloads`, 'Rounded up to whole loads.');
        out.splice(1, 0, { k: 'Number of truckloads (rounded up)', v: Math.ceil(nT - 1e-9), u: '' }, { k: 'Exact number of loads', v: nT, u: '' });
      }
      if (x.w !== undefined) {
        const Wwp = Ws * x.w;
        out.push({ k: 'Water in the excavated soil', v: Wwp, u: U.force });
        if (b.wf > 0) { const add = Ws * (b.wf / 100 - x.w); out.push({ k: `Water to add to reach w = ${f(b.wf)} %`, v: add, u: U.force }, { k: '   as volume of water', v: add / gw, u: U.vol }); st.add('Water to add in the fill', 'W_w,add = W_s (w_fill − w_pit)', `W_w,add = ${f(Ws)} × (${f(b.wf / 100)} − ${f(x.w)})`, `W_w,add = ${f(add)} ${U.force} = ${f(add / gw)} ${U.vol} of water`); }
      }
      bor = { Vpit, Vf: b.Vf, gdf, gdPit, Vt };
    }
    const main = out.find((o) => o.hl);
    return { ok: true, err: [], warn, status: { cls: det.length ? 'warn' : 'ok', text: main ? `${main.k.replace(/ \(.*$/, '')} = ${f(main.v)} ${main.u}` : 'Phase relations' }, out, steps: st.list, geo: { kind: 'phase', x, blk, bor, given, labSet } };
  }

  /** Gaussian elimination with partial pivoting. */
  function solveLin(A, b) {
    const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      if (Math.abs(M[piv][c]) < 1e-300) return null;
      [M[c], M[piv]] = [M[piv], M[c]];
      for (let r = 0; r < n; r++) { if (r === c) continue; const fct = M[r][c] / M[c][c]; for (let j = c; j <= n; j++) M[r][j] -= fct * M[c][j]; }
    }
    return M.map((r, i) => r[n] / r[i]);
  }

  /** Unit weights of one layer from whichever data it is given by (shared by the soil profile and the retaining wall). */
  function layerUW(L, src, gw) {
    const S = (L.S || 0) / 100;
    switch (src) {
      case 'phase': { const ph = P.phase(L.Gs, L.e, S, gw); return { gm: ph.gm, gsat: ph.gsat, gd: ph.gd, e: L.e, Gs: L.Gs }; }
      case 'gew': { const ph = P.phase(L.Gs, L.e, 1, gw); const gm = (L.Gs * (1 + (L.w || 0) / 100) * gw) / (1 + L.e); return { gm, gsat: ph.gsat, gd: ph.gd, e: L.e, Gs: L.Gs }; }
      case 'gsw': { const e = (L.Gs * (L.w || 0)) / 100; const ph = P.phase(L.Gs, e, S, gw); return { gm: S > 0 ? ph.gm : ph.gsat, gsat: ph.gsat, gd: ph.gd, e, Gs: L.Gs }; }
      case 'dry': { const n = (L.gsat - L.gd) / gw; return { gm: L.gd + S * n * gw, gsat: L.gsat, gd: L.gd, e: n / (1 - n) }; }
      default: return { gm: L.g, gsat: L.gsat, gd: L.g };
    }
  }
  /** Formula text for a layer's unit weights (worked steps). */
  function layerUWtext(L, src, gw, g) {
    const S = (L.S || 0) / 100;
    switch (src) {
      case 'phase': return ['γ = (G_s + S e) γw / (1 + e),  γ_sat = (G_s + e) γw / (1 + e)', `G_s = ${f(L.Gs)}, e = ${f(L.e)}, S = ${f(S)}`];
      case 'gew': return ['γ = G_s (1 + w) γw / (1 + e),  γ_sat = (G_s + e) γw / (1 + e)', `G_s = ${f(L.Gs)}, e = ${f(L.e)}, w = ${f(L.w / 100)}`];
      case 'gsw': return ['e = w G_s (saturated),  γ_sat = (G_s + e) γw / (1 + e)', `G_s = ${f(L.Gs)}, w = ${f(L.w / 100)} → e = ${f(g.e)}`];
      case 'dry': return ['n = (γ_sat − γ_d) / γw,  γ = γ_d + S n γw', `γ_d = ${f(L.gd)}, γ_sat = ${f(L.gsat)}, S = ${f(S)} → n = ${f((L.gsat - L.gd) / gw)}`];
      default: return ['given', ''];
    }
  }
  const SRC_OPTS = [['gamma', 'γ, γ_sat'], ['phase', 'G_s, e, S'], ['gew', 'G_s, e, w'], ['gsw', 'G_s, w (saturated)'], ['dry', 'γ_d, γ_sat, S']];
  /** Layer-editor fields for a source (U = units). */
  function srcFields(U, withS) {
    return [
      { k: 'g', label: 'γ (moist)', unit: U.gamma, show: (L) => (L.src || 'gamma') === 'gamma' },
      { k: 'gd', label: 'γ_d (dry)', unit: U.gamma, show: (L) => L.src === 'dry' },
      { k: 'gsat', label: 'γ_sat', unit: U.gamma, show: (L) => (L.src || 'gamma') === 'gamma' || L.src === 'dry' },
      { k: 'Gs', label: 'G_s', unit: '', show: (L) => ['phase', 'gew', 'gsw'].includes(L.src) },
      { k: 'e', label: 'Void ratio e', unit: '', show: (L) => ['phase', 'gew'].includes(L.src) },
      { k: 'w', label: 'Water content w', unit: '%', show: (L) => ['gew', 'gsw'].includes(L.src) },
      { k: 'S', label: withS || 'S above GWT', unit: '%', show: (L) => ['phase', 'dry', 'gsw'].includes(L.src) },
    ];
  }

  Object.assign(P, { phaseRel, PHASE_Q: Q, PHASE_ORDER: ORDER, PHASE_LAB: LAB, layerUW, layerUWtext, UW_SRC: SRC_OPTS, uwFields: srcFields });
})(typeof window !== 'undefined' ? window : globalThis);
