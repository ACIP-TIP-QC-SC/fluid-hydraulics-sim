/* =====================================================================
 * Geotechnical — STEP 2: Effective Stress (physics)
 * A soil profile of up to 5 layers with a water table (or ponded water),
 * capillary rise, surcharge, and upward or downward seepage through one
 * layer. Total stress σ, pore pressure u and effective stress σ′ = σ − u.
 * The same profile is reused by Consolidation (Step 4).
 * ===================================================================== */
(function (root) {
  'use strict';
  const P = root.Physics;
  const { fmt: f, Steps, fail } = P;

  /** Unit weights of a layer: moist (above the water table), saturated, and in the capillary zone. */
  function layerGammas(L, prof, gw) {
    if (prof.by === 'phase') {
      const ph = P.phase(L.Gs, L.e, (L.S || 0) / 100, gw);
      const cap = P.phase(L.Gs, L.e, (prof.capS || 100) / 100, gw);
      return { gm: ph.gm, gsat: ph.gsat, gcap: cap.gm, gd: ph.gd };
    }
    if (prof.by === 'each') {
      const src = L.src || 'gamma';
      const g = P.layerUW(L, src, gw);
      const cap = src === 'gamma' ? L.gsat : P.layerUW(Object.assign({}, L, { S: prof.capS || 100 }), src === 'gew' ? 'phase' : src, gw).gm;
      return { gm: g.gm, gsat: g.gsat, gcap: cap, gd: g.gd, e: g.e };
    }
    return { gm: L.g, gsat: L.gsat, gcap: L.gsat, gd: L.g };
  }

  /**
   * Stresses along the profile.
   * prof = { by, layers:[{soil,H,g,gsat,Gs,e,S}], wt (depth of GWT, < 0 = ponded water), cap (hc), capS (%), capNeg,
   *          q (surcharge), seep:'none'|'up'|'down', seepLayer (index), dh }
   * Returns { pts:[{z,s,u,e}] (duplicate z where u jumps), segs, Ht, … } or { err }.
   */
  function profile(prof, U, st) {
    const gw = U.gw, err = [], warn = [];
    const Ls = prof.layers;
    if (!Ls.length) return { err: ['Add at least one layer.'] };
    if (Ls.some((l) => !(l.H > 0))) return { err: ['Every layer needs a positive thickness.'] };
    const G = Ls.map((l) => layerGammas(l, prof, gw));
    if (G.some((g) => !(g.gm >= 0) || !(g.gsat > 0))) return { err: ['Unit weights must be positive.'] };
    if (prof.by === 'phase' && Ls.some((l) => !(l.Gs > 1) || !(l.e > 0))) return { err: ['G_s must exceed 1 and e must be positive.'] };
    G.forEach((g, i) => { if (g.gsat < g.gm - 1e-9) warn.push(`Layer ${i + 1}: γ_sat is smaller than the moist γ.`); if (g.gsat <= gw) err.push(`Layer ${i + 1}: γ_sat must be larger than γw.`); });
    if (err.length) return { err };
    const tops = []; let z = 0; Ls.forEach((l) => { tops.push(z); z += l.H; });
    const Ht = z;
    const zw = prof.wt, hc = Math.max(0, prof.cap || 0), zc = zw - hc; // top of capillary zone
    const pond = zw < 0 ? -zw : 0;
    const q = prof.q || 0;
    // seepage
    let sp = null;
    if (prof.seep !== 'none') {
      const k = Math.min(Ls.length - 1, Math.max(0, prof.seepLayer | 0));
      const zt = tops[k], zb = tops[k] + Ls[k].H;
      if (zt < zw - 1e-9) err.push(`Seepage layer ${k + 1} must lie wholly below the water table (its top is at ${f(zt)} ${U.len}, the water table at ${f(zw)} ${U.len}).`);
      sp = { k, zt, zb, dh: (prof.seep === 'up' ? 1 : -1) * Math.abs(prof.dh || 0), i: Math.abs(prof.dh || 0) / Ls[k].H };
    }
    if (err.length) return { err };
    // pore pressure (continuous except at the top of the capillary zone)
    const uAt = (zz, above) => {
      if (zz >= zw - 1e-12) {
        let u = gw * (zz - zw);
        if (sp) { if (zz >= sp.zb) u += gw * sp.dh; else if (zz > sp.zt) u += gw * sp.dh * (zz - sp.zt) / (sp.zb - sp.zt); }
        return u;
      }
      if (hc > 0 && prof.capNeg && (zz > zc + 1e-12 || (Math.abs(zz - zc) < 1e-12 && !above))) return -((prof.capS || 100) / 100) * gw * (zw - zz);
      return 0;
    };
    const gAt = (i, zm) => (zm > zw ? G[i].gsat : (hc > 0 && zm > zc) ? G[i].gcap : G[i].gm);
    // breakpoints
    const bps = new Set([0, Ht]);
    tops.forEach((t) => bps.add(t));
    if (zw > 0 && zw < Ht) bps.add(zw);
    if (hc > 0 && zc > 0 && zc < Ht) bps.add(zc);
    const zs = [...bps].sort((a, b) => a - b);
    const segs = [];
    const s0 = q + gw * pond;
    let s = s0;
    const pts = [];
    const push = (zz, above) => { const u = uAt(zz, above); pts.push({ z: zz, s, u, e: s - u }); };
    push(0, false);
    for (let j = 0; j < zs.length - 1; j++) {
      const za = zs[j], zb = zs[j + 1], zm = 0.5 * (za + zb);
      let i = 0; while (i < Ls.length - 1 && zm > tops[i] + Ls[i].H) i++;
      const g = gAt(i, zm);
      const zone = zm > zw ? 'saturated' : (hc > 0 && zm > zc) ? 'capillary zone' : 'above the water table';
      if (hc > 0 && prof.capNeg && Math.abs(za - zc) < 1e-12 && za > 0) push(za, false); // u jumps at the top of the capillary zone
      s += g * (zb - za);
      segs.push({ za, zb, i, g, zone, ds: g * (zb - za) });
      push(zb, true);
    }
    // σ' must stay positive
    const neg = pts.find((p) => p.e < -1e-9 && p.z > 0);
    if (neg) warn.push(`Effective stress becomes negative at z = ${f(neg.z)} ${U.len}: quick (boiling) condition, the soil cannot carry load.`);
    return { pts, segs, Ht, tops, G, zw, hc, zc, pond, q, sp, s0, warn, Ls };
  }

  /** Values at a depth z (taking the lower value at a jump). */
  function at(pr, z) {
    const pts = pr.pts;
    if (z <= 0) return { s: pts[0].s, u: pts[0].u, e: pts[0].e };
    for (let j = 1; j < pts.length; j++) {
      if (z <= pts[j].z + 1e-12 && pts[j].z > pts[j - 1].z) {
        const a = pts[j - 1], b = pts[j], t = (z - a.z) / (b.z - a.z);
        return { s: a.s + t * (b.s - a.s), u: a.u + t * (b.u - a.u), e: a.e + t * (b.e - a.e) };
      }
    }
    const l = pts[pts.length - 1]; return { s: l.s, u: l.u, e: l.e };
  }

  function effStress(prof, U) {
    const st = Steps(), out = [];
    const Lu = U.len, Pu = U.press, gw = U.gw;
    const pr = profile(prof, U, st);
    if (pr.err) return fail(pr.err);
    const warn = pr.warn.slice();
    if (prof.by === 'phase') {
      pr.Ls.forEach((l, i) => {
        const g = pr.G[i];
        st.add(`Layer ${i + 1} unit weights from G_s, e, S`, 'γ = (G_s + S e) γw / (1 + e),  γ_sat = (G_s + e) γw / (1 + e)', `γ = (${f(l.Gs)} + ${f((l.S || 0) / 100)} × ${f(l.e)}) × ${f(gw)} / (1 + ${f(l.e)});  γ_sat = (${f(l.Gs)} + ${f(l.e)}) × ${f(gw)} / (1 + ${f(l.e)})`, `γ = ${f(g.gm)},  γ_sat = ${f(g.gsat)} ${U.gamma}${pr.hc > 0 ? `,  capillary γ = ${f(g.gcap)}` : ''}`);
      });
    }
    if (prof.by === 'each') {
      pr.Ls.forEach((l, i) => {
        const g = pr.G[i], src = l.src || 'gamma';
        if (src === 'gamma') return;
        const [fm, sb] = P.layerUWtext(l, src, gw, g);
        st.add(`Layer ${i + 1} unit weights`, fm, sb, `γ = ${f(g.gm)},  γ_sat = ${f(g.gsat)} ${U.gamma}${g.e !== undefined ? `  (e = ${f(g.e)})` : ''}`);
      });
    }
    if (pr.s0 > 0) st.add('Stress at the ground surface', 'σ₀ = q + γw h_pond', `σ₀ = ${f(pr.q)} + ${f(gw)} × ${f(pr.pond)}`, `σ₀ = ${f(pr.s0)} ${Pu}`, pr.pond > 0 ? 'Water ponded above the ground adds equally to σ and u, so σ′ is unchanged by it.' : 'A wide surcharge raises σ and σ′ by q at every depth.');
    st.add('Water table', pr.zw < 0 ? `water stands ${f(-pr.zw)} ${Lu} above the ground surface` : pr.zw >= pr.Ht ? 'below the bottom of the profile' : `at depth z_w = ${f(pr.zw)} ${Lu}`, pr.hc > 0 ? `capillary rise h_c = ${f(pr.hc)} ${Lu} (zone from z = ${f(Math.max(0, pr.zc))} to ${f(pr.zw)} ${Lu}, S = ${f(prof.capS)} %)` : '', '', pr.hc > 0 ? (prof.capNeg ? 'In the capillary zone the water is in tension: u = −S γw (height above the water table).' : 'Pore pressure in the capillary zone is taken as zero (option off); only the unit weight is saturated.') : 'Below the water table u = γw × depth below it (hydrostatic) unless there is seepage.');
    if (pr.sp) {
      const sp = pr.sp;
      st.add(`Seepage through layer ${sp.k + 1} (${prof.seep === 'up' ? 'upward' : 'downward'})`, 'i = Δh / H;  extra pore pressure at the layer bottom = ±γw Δh', `i = ${f(Math.abs(sp.dh))} / ${f(sp.zb - sp.zt)} = ${f(sp.i)};  Δu = ${prof.seep === 'up' ? '+' : '−'}${f(gw)} × ${f(Math.abs(sp.dh))}`, `Δu = ${f(gw * sp.dh)} ${Pu}`, prof.seep === 'up' ? 'Upward flow raises u and lowers σ′ by i γw z inside the layer (seepage force acts upward).' : 'Downward flow lowers u and raises σ′ by i γw z inside the layer.');
      const se0 = at(pr, sp.zb);
      if (prof.seep === 'up') {
        const eHydro = se0.e + gw * sp.dh; // σ′ at the layer bottom with no seepage
        const dhCr = eHydro / gw;
        st.add('Head that causes a quick condition at the bottom of the layer', 'σ′ = 0  ⇒  Δh_cr = σ′_hydrostatic / γw', `Δh_cr = ${f(eHydro)} / ${f(gw)}`, `Δh_cr = ${f(dhCr)} ${Lu}  (applied Δh = ${f(Math.abs(sp.dh))}, FS = ${f(dhCr / Math.abs(sp.dh || 1e-12))})`, 'Heave/boiling happens when the upward seepage pressure equals the weight of the soil above.');
        out.push({ k: 'Seepage gradient i', v: sp.i, u: '' }, { k: 'Critical head Δh_cr', v: dhCr, u: Lu }, { k: 'FS against heave (Δh_cr / Δh)', v: Math.abs(sp.dh) > 0 ? dhCr / Math.abs(sp.dh) : Infinity, u: '', hl: true });
      } else out.push({ k: 'Seepage gradient i', v: sp.i, u: '' });
    }
    // segment steps
    pr.segs.forEach((sg) => {
      const l = pr.Ls[sg.i];
      st.add(`z = ${f(sg.za)} → ${f(sg.zb)} ${Lu}: layer ${sg.i + 1} (${sg.zone})`, 'Δσ = γ Δz', `Δσ = ${f(sg.g)} × ${f(sg.zb - sg.za)}`, `Δσ = ${f(sg.ds)} ${Pu}`, `${(root.GeoUI && root.GeoUI.SOILS[l.soil] ? root.GeoUI.SOILS[l.soil].name : l.soil)}, γ = ${f(sg.g)} ${U.gamma}`);
    });
    // table at the boundaries
    const tbl = pr.pts.map((p) => `z = ${f(p.z)}: σ = ${f(p.s)}, u = ${f(p.u)}, σ′ = ${f(p.e)}`).join(';  ');
    st.add('Stresses at the boundaries (σ′ = σ − u)', 'σ = Σ γ Δz (+ σ₀);  u = γw (z − z_w) (+ seepage);  σ′ = σ − u', tbl, '', `Units: depth in ${Lu}, stresses in ${Pu}.`);
    // point of interest
    const zP = Math.max(0, Math.min(prof.zP, pr.Ht));
    const v = at(pr, zP);
    st.add(`Stresses at point P (z = ${f(zP)} ${Lu})`, 'linear interpolation within the segment', `σ = ${f(v.s)} ${Pu},  u = ${f(v.u)} ${Pu}`, `σ′ = ${f(v.s)} − ${f(v.u)} = ${f(v.e)} ${Pu}`);
    out.unshift({ k: `σ at P (z = ${f(zP)} ${Lu})`, v: v.s, u: Pu }, { k: 'u at P', v: v.u, u: Pu }, { k: 'σ′ at P', v: v.e, u: Pu, hl: true });
    const bot = pr.pts[pr.pts.length - 1];
    out.push({ k: `σ at the bottom (z = ${f(pr.Ht)} ${Lu})`, v: bot.s, u: Pu }, { k: 'u at the bottom', v: bot.u, u: Pu }, { k: 'σ′ at the bottom', v: bot.e, u: Pu, hl: true });
    pr.tops.slice(1).forEach((t, i) => { const w = at(pr, t); out.push({ k: `σ′ at the top of layer ${i + 2} (z = ${f(t)})`, v: w.e, u: Pu }); });
    let cls = 'ok', text = `σ′ at P = ${f(v.e)} ${Pu}`;
    if (pr.pts.some((p) => p.e < -1e-9 && p.z > 0)) { cls = 'bad'; text = 'Quick condition: σ′ < 0'; }
    else if (pr.sp && prof.seep === 'up' && out.find((o) => o.k.startsWith('FS against heave')).v < 1.5) { cls = 'warn'; text += ' · low FS against heave'; }
    return { ok: true, err: [], warn, status: { cls, text }, out, steps: st.list, geo: { kind: 'es', pr, zP, P: v } };
  }

  Object.assign(P, { soilProfile: profile, profileAt: at, effStress, layerGammas });
})(typeof window !== 'undefined' ? window : globalThis);
