/* =====================================================================
 * Geotechnical — STEP 4: Consolidation (physics)
 * Primary consolidation settlement of a clay layer chosen from the shared
 * soil profile (NC, OC case 1 / case 2, by sublayers), the load increase
 * (uniform fill, footing by Boussinesq or by 2:1), time rate (Terzaghi
 * Tv–U, single or double drainage) and secondary compression.
 * ===================================================================== */
(function (root) {
  'use strict';
  const P = root.Physics;
  const { fmt: f, Steps, fail, PI, log10 } = P;

  /** Average degree of consolidation U (0–1) for time factor Tv (Terzaghi series). */
  function UofTv(Tv) {
    if (Tv <= 0) return 0;
    if (Tv < 1e-4) return Math.sqrt((4 * Tv) / PI);
    let s = 0;
    for (let m = 0; m < 200; m++) { const M = (PI * (2 * m + 1)) / 2; const t = (2 / (M * M)) * Math.exp(-M * M * Tv); s += t; if (t < 1e-14) break; }
    return Math.min(1, 1 - s);
  }
  function TvofU(U) { if (U <= 0) return 0; if (U >= 1) return Infinity; return P.bisect(UofTv, U, 0, 10, 120); }

  /** Settlement of a layer from a change in void ratio: ΔH = H Δe / (1 + e₀). */
  function consDe(p, U) {
    const st = Steps(), Lu = U.len;
    const H = p.Hg, e0 = p.e0;
    if (!(H > 0) || !(e0 > 0)) return fail(['Enter the layer thickness and e₀.']);
    let ef, how;
    switch (p.deBy) {
      case 'by': ef = e0 * (1 - p.frac / 100); how = [`e_f = e₀ (1 − ${f(p.frac)} %)`, `e_f = ${f(e0)} × (1 − ${f(p.frac / 100)})`]; break;
      case 'to': ef = e0 * (p.frac / 100); how = [`e_f = ${f(p.frac)} % of e₀`, `e_f = ${f(p.frac / 100)} × ${f(e0)}`]; break;
      case 'de': ef = e0 - p.dE; how = ['e_f = e₀ − Δe', `e_f = ${f(e0)} − ${f(p.dE)}`]; break;
      default: ef = p.ef; how = ['e_f given', ''];
    }
    if (!(ef >= 0)) return fail(['The final void ratio must not be negative.']);
    st.add('Final void ratio', how[0], how[1], `e_f = ${f(ef)}`, 'Halved = decreased by 50 %; "decreased by one-third" = 66.67 % of e₀ remains; "decreased to one-third" = 33.33 % remains.');
    const dH = (H * (e0 - ef)) / (1 + e0);
    st.add('Change in thickness', 'ΔH = H (e₀ − e_f) / (1 + e₀)', `ΔH = ${f(H)} × (${f(e0)} − ${f(ef)}) / (1 + ${f(e0)})`, `ΔH = ${f(dH)} ${Lu} = ${f(dH * U.settleF)} ${U.settle}`, 'The solids keep their volume; the layer shortens by the lost void volume, V_s = H / (1 + e₀) per unit area.');
    const out = [{ k: 'Reduction in thickness ΔH', v: dH, u: Lu, hl: true }, { k: '   in ' + U.settle, v: dH * U.settleF, u: U.settle }, { k: 'Final thickness H − ΔH', v: H - dH, u: Lu }, { k: 'Final void ratio e_f', v: ef, u: '' }, { k: 'Δe', v: e0 - ef, u: '' }, { k: 'Vertical strain ΔH / H', v: (dH / H) * 100, u: '%' }];
    return { ok: true, err: [], warn: [], status: { cls: 'ok', text: `ΔH = ${f(dH)} ${Lu}` }, out, steps: st.list, geo: { kind: 'consDe', H, e0, ef, dH } };
  }

  function consolidation(p, prof, U) {
    if (p.method === 'de') return consDe(p, U);
    const st = Steps(), out = [], warn = [];
    const Lu = U.len, Pu = U.press;
    if (p.src === 'given') {
      if (!(p.Hg > 0) || !(p.s0g > 0)) return fail(['Enter the clay thickness and the initial effective stress.']);
      // one clay layer whose effective stress at mid-depth equals the given σ′₀
      prof = { by: 'gamma', wt: 0, cap: 0, q: 0, seep: 'none', layers: [{ soil: 'clay', H: p.Hg, g: U.gw + (2 * p.s0g) / p.Hg, gsat: U.gw + (2 * p.s0g) / p.Hg }] };
      p = Object.assign({}, p, { layer: 0 });
    }
    const pr = P.soilProfile(prof, U);
    if (pr.err) return fail(pr.err);
    const k = Math.min(pr.Ls.length - 1, Math.max(0, p.layer | 0));
    const Lc = pr.Ls[k], H = Lc.H, zt = pr.tops[k], zb = zt + H;
    const e0 = p.e0;
    if (!(e0 > 0)) return fail(['Initial void ratio e₀ must be positive.']);
    let Cc = p.Cc;
    if (p.ccBy === 'LL') {
      Cc = 0.009 * (p.LL - 10);
      st.add('Compression index from the liquid limit (Skempton)', 'C_c = 0.009 (LL − 10)', `C_c = 0.009 × (${f(p.LL)} − 10)`, `C_c = ${f(Cc)}`, 'For normally consolidated clays of low to medium sensitivity.');
    }
    const Cs = p.Cs;
    if (!(Cc > 0) || !(Cs >= 0)) return fail(['C_c must be positive and C_s zero or more.']);
    if (Cs > Cc) warn.push('C_s is usually 1/5 to 1/10 of C_c.');
    if (pr.zw > zt + 1e-9) warn.push(`The clay layer (layer ${k + 1}) is not fully below the water table.`);
    const n = Math.max(1, Math.min(20, Math.round(p.n || 1)));
    const h = H / n;
    // load increase function Δσ(z)
    let dsFn, loadTxt;
    if (p.load === 'uniform') { dsFn = () => p.q; loadTxt = `uniform fill/surcharge Δσ = ${f(p.q)} ${Pu} (constant with depth)`; }
    else if (p.load === 'bouss') { dsFn = (z) => P.bRect(p.q, -p.B / 2, p.B / 2, -p.L / 2, p.L / 2, 0, 0, z); loadTxt = `footing ${f(p.B)} × ${f(p.L)} ${Lu}, q = ${f(p.q)} ${Pu}, Boussinesq below the centre`; }
    else { dsFn = (z) => (p.q * p.B * p.L) / ((p.B + z) * (p.L + z)); loadTxt = `footing ${f(p.B)} × ${f(p.L)} ${Lu}, q = ${f(p.q)} ${Pu}, 2:1 method`; }
    if ((p.load !== 'uniform') && (!(p.B > 0) || !(p.L > 0))) return fail(['Footing sides must be positive.']);
    st.add(`Clay layer ${k + 1}: from z = ${f(zt)} to ${f(zb)} ${Lu}`, 'H = thickness of the compressible layer', `H = ${f(H)} ${Lu},  e₀ = ${f(e0)},  C_c = ${f(Cc)},  C_s = ${f(Cs)}`, n > 1 ? `divided into ${n} sublayers of ${f(h)} ${Lu}` : 'one layer, stresses at mid-depth', `Load: ${loadTxt}.`);
    const subs = [];
    let Sc = 0;
    const zm0 = zt + H / 2, mid = P.profileAt(pr, zm0);
    for (let j = 0; j < n; j++) {
      const zm = zt + (j + 0.5) * h;
      const v = P.profileAt(pr, zm);
      const so = v.e;
      if (!(so > 0)) return fail([`Effective stress at z = ${f(zm)} ${Lu} is not positive; check the profile.`]);
      let sc;
      if (p.hist === 'NC') sc = so;
      else if (p.hist === 'OCR') sc = Math.max(so, p.OCR * so);
      else sc = Math.max(so, p.pc + (so - mid.e)); // same overconsolidation margin through the layer
      const ds = dsFn(zm);
      const sf = so + ds;
      let S, kind;
      if (sc <= so * (1 + 1e-9)) { S = (Cc * h) / (1 + e0) * log10(sf / so); kind = 'NC'; }
      else if (sf <= sc) { S = (Cs * h) / (1 + e0) * log10(sf / so); kind = 'OC-1'; }
      else { S = (Cs * h) / (1 + e0) * log10(sc / so) + (Cc * h) / (1 + e0) * log10(sf / sc); kind = 'OC-2'; }
      subs.push({ zm, so, sc, ds, sf, S, kind, de: (S * (1 + e0)) / h, u: v.u, s: v.s });
      Sc += S;
    }
    // steps: every sublayer when there are up to 5, otherwise the first, middle and last
    subs.forEach((q, j) => {
      const tag = n === 1 ? 'Mid-depth of the clay' : `Sublayer ${j + 1} (mid-depth z = ${f(q.zm)} ${Lu})`;
      if (n <= 5 || j === 0 || j === n - 1 || j === Math.floor(n / 2)) {
        if (p.src === 'given') { if (j === 0) st.add('Initial effective stress (given)', 'σ′₀ = average effective overburden pressure in the clay', n > 1 ? `σ′₀ at mid-depth = ${f(p.s0g)} ${Pu}, varying with the submerged weight of the clay` : '', `σ′₀ = ${f(q.so)} ${Pu}`); }
        else st.add(`${tag}: initial effective stress`, 'σ′₀ = σ − u  (from the soil profile)', `σ = ${f(q.s)},  u = ${f(q.u)}`, `σ′₀ = ${f(q.so)} ${Pu}`);
        st.add(`${tag}: stress increase and preconsolidation`, p.hist === 'NC' ? 'normally consolidated: σ′c = σ′₀' : p.hist === 'OCR' ? 'σ′c = OCR × σ′₀' : 'σ′c given (same margin above σ′₀ through the layer)', `Δσ = ${f(q.ds)} ${Pu},  σ′_f = σ′₀ + Δσ = ${f(q.sf)},  σ′c = ${f(q.sc)}`, q.kind === 'NC' ? 'Normally consolidated' : q.kind === 'OC-1' ? 'Overconsolidated, case 1 (σ′_f ≤ σ′c)' : 'Overconsolidated, case 2 (σ′_f > σ′c)');
        const fml = q.kind === 'NC' ? 'S = C_c H/(1+e₀) log(σ′_f/σ′₀)' : q.kind === 'OC-1' ? 'S = C_s H/(1+e₀) log(σ′_f/σ′₀)' : 'S = C_s H/(1+e₀) log(σ′c/σ′₀) + C_c H/(1+e₀) log(σ′_f/σ′c)';
        const sub = q.kind === 'NC' ? `S = ${f(Cc)} × ${f(h)}/(1+${f(e0)}) × log(${f(q.sf)}/${f(q.so)})` : q.kind === 'OC-1' ? `S = ${f(Cs)} × ${f(h)}/(1+${f(e0)}) × log(${f(q.sf)}/${f(q.so)})` : `S = ${f(Cs)} × ${f(h)}/(1+${f(e0)}) log(${f(q.sc)}/${f(q.so)}) + ${f(Cc)} × ${f(h)}/(1+${f(e0)}) log(${f(q.sf)}/${f(q.sc)})`;
        st.add(`${tag}: primary consolidation settlement`, fml, sub, `S = ${f(q.S)} ${Lu} = ${f(q.S * U.settleF)} ${U.settle}`);
      }
    });
    if (n > 1) st.add('Total primary settlement (sum of the sublayers)', 'S_c = Σ Sᵢ', subs.map((q) => f(q.S * U.settleF, 3)).join(' + ') + ` ${U.settle}`, `S_c = ${f(Sc)} ${Lu} = ${f(Sc * U.settleF)} ${U.settle}`);
    const scMid = p.hist === 'NC' ? mid.e : p.hist === 'OCR' ? Math.max(mid.e, p.OCR * mid.e) : Math.max(mid.e, p.pc);
    out.push({ k: 'Primary settlement S_c', v: Sc * U.settleF, u: U.settle, hl: true }, { k: 'σ′₀ at the middle of the clay', v: mid.e, u: Pu }, { k: 'Δσ at the middle', v: dsFn(zm0), u: Pu }, { k: 'σ′c at the middle', v: scMid, u: Pu });
    const dE = subs.reduce((s, q) => s + q.de * h, 0) / H;
    out.push({ k: 'Average change in void ratio Δe', v: dE, u: '' }, { k: 'Overconsolidation ratio at mid-depth', v: scMid / mid.e, u: '' });
    // time rate
    const Hdr = p.drain === 'double' ? H / 2 : H;
    st.add('Drainage path', p.drain === 'double' ? 'double drainage: H_dr = H / 2' : 'single drainage: H_dr = H', `H_dr = ${f(Hdr)} ${Lu}`, '', p.drain === 'double' ? 'Pervious layers above and below the clay.' : p.drain === 'top' ? 'Drains only through the top.' : 'Drains only through the bottom.');
    let cv = p.cv;
    let t, Uavg, Tv;
    if (p.solve === 'cv') {
      Uavg = Math.min(0.9999, Math.max(1e-4, p.U / 100));
      Tv = TvofU(Uavg);
      t = p.t;
      if (!(t > 0)) return fail(['Enter the time for the given degree of consolidation.']);
      const cvF = (Tv * Hdr * Hdr) / t;
      cv = cvF;
      st.add(`Time factor for U = ${f(p.U)} %`, Uavg < 0.6 ? 'T_v = (π/4) U²  (U < 60 %)' : 'T_v = 1.781 − 0.933 log(100 − U%)  (U ≥ 60 %)', Uavg < 0.6 ? `T_v = (π/4) × ${f(Uavg)}²` : `T_v = 1.781 − 0.933 log(100 − ${f(p.U)})`, `T_v = ${f(Uavg < 0.6 ? (PI / 4) * Uavg * Uavg : 1.781 - 0.933 * log10(100 - p.U))}  (exact series: ${f(Tv)}; U = 90 % gives 0.848, 50 % gives 0.197)`);
      st.add('Coefficient of consolidation', 'c_v = T_v H_dr² / t', `c_v = ${f(Tv)} × ${f(Hdr)}² / ${f(t)}`, `c_v = ${f(cvF)} ${U.cv}`);
      out.unshift({ k: 'Coefficient of consolidation c_v', v: cvF, u: U.cv, hl: true }, { k: '   per day', v: cvF / 365, u: U.cv.replace('yr', 'day') }, { k: '   per month (1/12 yr)', v: cvF / 12, u: U.cv.replace('yr', 'month') });
      if (U.id === 'SI') out.splice(3, 0, { k: '   in cm²/s', v: (cvF * 1e4) / (365 * 86400), u: 'cm²/s' });
      out.push({ k: 'Time factor T_v', v: Tv, u: '' });
    } else if (!(cv > 0)) return fail(['c_v must be positive.']);
    else if (p.solve === 't') {
      Uavg = Math.min(0.9999, Math.max(1e-4, p.U / 100));
      Tv = TvofU(Uavg);
      t = (Tv * Hdr * Hdr) / cv;
      st.add(`Time factor for U = ${f(p.U)} %`, Uavg < 0.6 ? 'T_v = (π/4) U²  (U < 60 %)' : 'T_v = 1.781 − 0.933 log(100 − U%)  (U ≥ 60 %)', Uavg < 0.6 ? `T_v = (π/4) × ${f(Uavg)}²` : `T_v = 1.781 − 0.933 log(100 − ${f(p.U)})`, `T_v = ${f(Uavg < 0.6 ? (PI / 4) * Uavg * Uavg : 1.781 - 0.933 * log10(100 - p.U))}  (exact series: ${f(Tv)})`, 'The exact Terzaghi series value is used in the results.');
      st.add('Time required', 't = T_v H_dr² / c_v', `t = ${f(Tv)} × ${f(Hdr)}² / ${f(cv)}`, `t = ${f(t)} yr = ${f(t * 365)} days`);
      out.push({ k: `Time for U = ${f(p.U)} %`, v: t, u: 'yr', hl: true }, { k: 'Time', v: t * 365, u: 'days' }, { k: 'Time factor T_v', v: Tv, u: '' }, { k: `Settlement at U = ${f(p.U)} %`, v: Uavg * Sc * U.settleF, u: U.settle });
    } else {
      t = p.t;
      Tv = (cv * t) / (Hdr * Hdr);
      Uavg = UofTv(Tv);
      st.add('Time factor', 'T_v = c_v t / H_dr²', `T_v = ${f(cv)} × ${f(t)} / ${f(Hdr)}²`, `T_v = ${f(Tv)}`);
      st.add('Average degree of consolidation', Tv < 0.2827 ? 'U = √(4 T_v / π)  (T_v < 0.283)' : 'U = 1 − Σ (2/M²) e^(−M² T_v),  M = π(2m+1)/2', Tv < 0.2827 ? `U = √(4 × ${f(Tv)} / π)` : '', `U = ${f(Uavg * 100)} %`);
      st.add('Settlement at time t', 'S_t = U S_c', `S_t = ${f(Uavg)} × ${f(Sc * U.settleF)}`, `S_t = ${f(Uavg * Sc * U.settleF)} ${U.settle}`);
      out.push({ k: `Degree of consolidation at t = ${f(t)} yr`, v: Uavg * 100, u: '%', hl: true }, { k: 'Time factor T_v', v: Tv, u: '' }, { k: 'Settlement at time t', v: Uavg * Sc * U.settleF, u: U.settle, hl: true });
    }
    // secondary compression
    let Ss = 0, sec = null;
    if (p.sec) {
      const t90 = (TvofU(0.99) * Hdr * Hdr) / cv;
      const t1 = p.t1By === 'auto' ? t90 : p.t1, t2 = p.t2;
      if (!(t2 > t1)) warn.push('Secondary compression needs t₂ > t₁.');
      else {
        const ep = e0 - dE;
        const Cap = p.Ca / (1 + ep);
        Ss = Cap * H * log10(t2 / t1);
        sec = { t1, t2, ep, Cap };
        st.add('Void ratio at the end of primary consolidation', 'e_p = e₀ − Δe', `e_p = ${f(e0)} − ${f(dE)}`, `e_p = ${f(ep)}`);
        st.add('Secondary compression settlement', "S_s = C′α H log(t₂/t₁),  C′α = Cα / (1 + e_p)", `C′α = ${f(p.Ca)} / (1 + ${f(ep)}) = ${f(Cap)};  S_s = ${f(Cap)} × ${f(H)} × log(${f(t2)}/${f(t1)})`, `S_s = ${f(Ss)} ${Lu} = ${f(Ss * U.settleF)} ${U.settle}`, p.t1By === 'auto' ? `t₁ = end of primary consolidation, taken at U = 99 % (${f(t1)} yr).` : '');
        out.push({ k: 'Secondary settlement S_s', v: Ss * U.settleF, u: U.settle }, { k: 'Total S_c + S_s', v: (Sc + Ss) * U.settleF, u: U.settle, hl: true });
      }
    }
    // curves
    const tEnd = Math.max(t * 2.5, (TvofU(0.95) * Hdr * Hdr) / cv);
    const curve = [];
    for (let i = 1; i <= 120; i++) { const tt = tEnd * Math.pow(10, -3 + (3 * i) / 120); const Ut = UofTv((cv * tt) / (Hdr * Hdr)); curve.push([tt, Ut * Sc * U.settleF]); }
    const tvU = [];
    for (let i = 0; i <= 120; i++) { const tv = Math.pow(10, -3 + (4 * i) / 120); tvU.push([tv, UofTv(tv) * 100]); }
    const cls = 'ok';
    return { ok: true, err: [], warn, status: { cls, text: `S_c = ${f(Sc * U.settleF)} ${U.settle}` + (p.solve === 't' ? ` · t(${f(p.U)} %) = ${f(t)} yr` : p.solve === 'cv' ? ` · c_v = ${f(cv)} ${U.cv}` : ` · U = ${f(Uavg * 100, 3)} % at ${f(t)} yr`) }, out, steps: st.list,
      geo: { kind: 'cons', pr, k, zt, zb, H, subs, Sc, Ss, e0, Cc, Cs, Hdr, t, Tv, Uavg, curve, tvU, sec, mid, dsFn, p } };
  }

  Object.assign(P, { consolidation, UofTv, TvofU });
})(typeof window !== 'undefined' ? window : globalThis);
