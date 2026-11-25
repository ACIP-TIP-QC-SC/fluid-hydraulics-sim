/* =====================================================================
 * PHYSICS — statics extensions (2026-11-25 book-coverage upgrade)
 *   compressible & variable-density fluids, barometers, rising bubbles,
 *   inclined-tube manometer, hoop tension, plane areas of any shape
 *   (polygon / parabola, incl. lateral centre of pressure), hydrometers,
 *   balloons, rotating U-tubes.
 * Result shape as physics.js: { ok, err, warn, status, out, steps, geo }
 * ===================================================================== */
(function (root) {
  'use strict';
  const P0 = root.Physics;
  const f = P0.fmt;
  const PI = Math.PI, DEG = PI / 180;
  function Steps() { const list = []; return { list, add(t, fo, s, r, n) { list.push({ t, f: fo, s, r, n }); } }; }
  const fail = (err, warn, steps) => ({ ok: false, err, warn: warn || [], steps: steps || [], out: [], geo: {} });
  const ok = (st, out, warn, status, geo) => ({ ok: true, err: [], warn: warn || [], steps: st.list, out, status, geo });
  const Rair = (U) => (U.id === 'SI' ? 286.9 : 1716);
  const Toff = (U) => (U.id === 'SI' ? 273 : 460);
  const PSI = 144;

  /* =================================================================== */
  /* Pressure in compressible / variable-density fluids                    */
  /* SI: p in kPa (abs), z in m.  EN: p in psi (abs), z in ft.            */
  /* =================================================================== */
  function compress(p, U) {
    const st = Steps(), out = [], warn = [];
    const SI = U.id === 'SI', g = U.g, pu = SI ? 'kPa' : 'psi', pF = SI ? 1000 : PSI, Lu = U.len;
    const Tu = SI ? 'K' : '°R', R = p.Rg > 0 ? p.Rg : Rair(U), Ru = SI ? 'J/(kg·K)' : 'ft·lb/(slug·°R)';
    const ca = p.ca;
    if (ca === 'isoT' || ca === 'lapse') {
      const T1 = p.T1 + Toff(U), p1 = p.p1, dz = p.dz;
      if (!(T1 > 0 && p1 > 0)) return fail(['Absolute temperature and pressure must be positive.']);
      st.add('Gas data', 'p₁, T₁, R', '', `p₁ = ${f(p1)} ${pu} (abs),  T₁ = ${f(T1)} ${Tu},  R = ${f(R)} ${Ru}`, 'Hydrostatics of a gas: dp/dz = −ρg with ρ = p/(RT).');
      const rho1 = p.rho1 > 0 ? p.rho1 : (p1 * pF) / (R * T1);
      let p2, T2 = T1;
      const zT = ca === 'lapse' && p.zT > 0 && p.zT < dz ? p.zT : 0; // isothermal (stratosphere) above zT
      if (ca === 'isoT') {
        p2 = p1 * Math.exp((-g * dz) / (R * T1));
        st.add('Isothermal layer', 'p₂ = p₁ e^(−g Δz /(R T))', `p₂ = ${f(p1)} × e^(−${f(g)} × ${f(dz)} / (${f(R)} × ${f(T1)}))`, `p₂ = ${f(p2)} ${pu}`, 'Integrating dp/p = −g dz/(RT) with T constant.');
      } else {
        const C = p.lapse; // K/m or °R/ft (positive = cooler higher up)
        const dzL = zT || dz;
        T2 = T1 - C * dzL;
        if (!(T2 > 0)) return fail(['The temperature drops below absolute zero over that height.']);
        st.add(zT ? 'Temperature at the top of the troposphere' : 'Temperature at the new elevation', 'T₂ = T₁ − C Δz', `T₂ = ${f(T1)} − ${f(C)} × ${f(dzL)}`, `T₂ = ${f(T2)} ${Tu} = ${f(T2 - Toff(U))} ${SI ? '°C' : '°F'}`, 'Linear lapse rate, as in the troposphere (C = 0.00650 K/m standard).');
        if (Math.abs(C) < 1e-12) p2 = p1 * Math.exp((-g * dzL) / (R * T1));
        else p2 = p1 * Math.pow(T2 / T1, g / (R * C));
        st.add('Pressure with a linear temperature drop', 'p₂ = p₁ (T₂/T₁)^(g/(R C))', `p₂ = ${f(p1)} × (${f(T2)}/${f(T1)})^(${f(g)}/(${f(R)} × ${f(C)}))`, `p₂ = ${f(p2)} ${pu}${zT ? ` at ${f(zT)} ${Lu}` : ''}`, 'From dp/p = −g dz/(R(T₁ − Cz)).');
        if (zT) {
          const pT = p2;
          p2 = pT * Math.exp((-g * (dz - zT)) / (R * T2));
          st.add('Isothermal layer above (stratosphere)', 'p = p_T e^(−g (z − z_T)/(R T_T))', `p = ${f(pT)} × e^(−${f(g)} × ${f(dz - zT)} / (${f(R)} × ${f(T2)}))`, `p = ${f(p2)} ${pu}`, 'Temperature stays at T_T above z_T.');
        }
      }
      let rho2;
      if (p.rho1 > 0) { rho2 = rho1 * (p2 / p1) * (T1 / T2); st.add('Air density at the new elevation', 'ρ₂ = ρ₁ (p₂/p₁)(T₁/T₂)', `ρ₂ = ${f(rho1)} × (${f(p2)}/${f(p1)}) × (${f(T1)}/${f(T2)})`, `ρ₂ = ${f(rho2)} ${SI ? 'kg/m³' : 'slug/ft³'}`, 'Scaled from the density you gave at the lower level (gas law ratio).'); }
      else { rho2 = (p2 * pF) / (R * T2); st.add('Air density at the new elevation', 'ρ₂ = p₂/(R T₂)', `ρ₂ = ${f(p2 * pF)} / (${f(R)} × ${f(T2)})`, `ρ₂ = ${f(rho2)} ${SI ? 'kg/m³' : 'slug/ft³'}`, ''); }
      const rhoI = p.rhoInc > 0 ? p.rhoInc : rho1;
      const pInc = p1 - (rhoI * g * dz) / pF;
      st.add('Same height treating the air as incompressible', 'p₂ = p₁ − ρ g Δz', `p₂ = ${f(p1 * pF)} − ${f(rhoI)} × ${f(g)} × ${f(dz)}`, `p₂ = ${f(pInc)} ${pu}`, p.rhoInc > 0 ? 'Using the density you entered (for example from a table).' : 'Density at the lower level from the gas law.');
      out.push({ k: 'Pressure p₂ (compressible)', v: p2, u: pu + ' abs', hl: true }, { k: 'Pressure p₂ (incompressible)', v: pInc, u: pu + ' abs' }, { k: 'Temperature T₂', v: T2 - Toff(U), u: SI ? '°C' : '°F' }, { k: 'Density ρ₁', v: rho1, u: SI ? 'kg/m³' : 'slug/ft³' }, { k: 'Density ρ₂', v: rho2, u: SI ? 'kg/m³' : 'slug/ft³' });
      const pz = (z) => {
        if (ca !== 'lapse') return p1 * Math.exp((-g * z) / (R * T1));
        const zz = zT ? Math.min(z, zT) : z, Tz = T1 - p.lapse * zz;
        let q = Math.abs(p.lapse) > 1e-12 ? p1 * Math.pow(Tz / T1, g / (R * p.lapse)) : p1 * Math.exp((-g * zz) / (R * T1));
        if (zT && z > zT) q *= Math.exp((-g * (z - zT)) / (R * Tz));
        return q;
      };
      const prof = []; for (let i = 0; i <= 40; i++) { const z = (dz * i) / 40; prof.push([pz(z), z]); }
      return ok(st, out, warn, { cls: 'ok', text: `p₂ = ${f(p2)} ${pu} (abs)` }, { ca, prof, dz, p1, p2, pu, zT, pInc });
    }
    if (ca === 'liqE') {
      const g0 = p.sgL * U.gw * (SI ? 1000 : 1), E = p.Ev * (SI ? 1e9 : PSI), h = p.hd;
      st.add('Surface unit weight and bulk modulus', 'γ₀ , E', '', `γ₀ = ${f(g0)} ${SI ? 'N/m³' : 'lb/ft³'},  E = ${f(E)} ${SI ? 'Pa' : 'psf'}`, 'E constant; the liquid gets denser with depth.');
      const x = (g0 * h) / E;
      if (!(x < 1)) return fail(['Depth too large for constant E.']);
      const pc = -E * Math.log(1 - x), pi = g0 * h;
      st.add('Compressible liquid (E constant)', 'p = −E ln(1 − γ₀ h / E)', `p = −${f(E)} × ln(1 − ${f(g0)} × ${f(h)} / ${f(E)})`, `p = ${f(pc)} ${SI ? 'Pa' : 'psf'}`, 'From dρ/ρ = dp/E and dp = ρ g dh (gauge pressure).');
      st.add('Incompressible value for comparison', 'p = γ₀ h', `p = ${f(g0)} × ${f(h)}`, `p = ${f(pi)} ${SI ? 'Pa' : 'psf'}`, '');
      const gh = g0 / (1 - x);
      st.add('Unit weight at that depth', 'γ = γ₀ / (1 − γ₀h/E)', `γ = ${f(g0)} / (1 − ${f(x)})`, `γ = ${f(gh)} ${SI ? 'N/m³' : 'lb/ft³'}`, '');
      out.push({ k: 'Pressure (compressible)', v: pc / (SI ? 1e6 : 1), u: SI ? 'MPa' : 'psf', hl: true }, { k: 'Pressure (incompressible)', v: pi / (SI ? 1e6 : 1), u: SI ? 'MPa' : 'psf' }, { k: 'Difference', v: (pc - pi) / (SI ? 1000 : 1), u: SI ? 'kPa' : 'psf' }, { k: 'Unit weight at depth', v: gh / (SI ? 1000 : 1), u: SI ? 'kN/m³' : 'lb/ft³' });
      if (!SI) out.push({ k: 'Pressure (compressible)', v: pc / PSI, u: 'psi' });
      const prof = []; for (let i = 0; i <= 30; i++) { const z = (h * i) / 30; prof.push([-E * Math.log(1 - (g0 * z) / E) / (SI ? 1e6 : PSI), -z]); }
      return ok(st, out, warn, { cls: 'ok', text: SI ? `p = ${f(pc / 1e6)} MPa` : `p = ${f(pc)} psf (${f(pc / PSI)} psi)` }, { ca, prof, h, pu: SI ? 'MPa' : 'psi', pEnd: pc / (SI ? 1e6 : PSI) });
    }
    if (ca === 'varrho') {
      const r0 = p.rho0, k = p.krho, h = p.hd;
      const pp = g * (r0 * h + (k * h * h) / 2);
      st.add('Density varying linearly with depth', 'ρ = ρ₀ + k h', '', `ρ₀ = ${f(r0)}, k = ${f(k)} per ${Lu}`, '');
      st.add('Integrate dp = ρ g dh', 'p = g(ρ₀ h + k h²/2)', `p = ${f(g)} × (${f(r0)} × ${f(h)} + ${f(k)} × ${f(h)}²/2)`, `p = ${f(pp)} ${SI ? 'Pa' : 'psf'} = ${f(pp / pF)} ${pu}`, 'Gauge pressure, zero at the surface.');
      out.push({ k: 'Pressure at depth h', v: pp / pF, u: pu, hl: true }, { k: 'Density at depth h', v: r0 + k * h, u: SI ? 'kg/m³' : 'slug/ft³' }, { k: 'Same depth with constant ρ₀', v: (g * r0 * h) / pF, u: pu });
      const prof = []; for (let i = 0; i <= 30; i++) { const z = (h * i) / 30; prof.push([(g * (r0 * z + (k * z * z) / 2)) / pF, -z]); }
      return ok(st, out, warn, { cls: 'ok', text: `p = ${f(pp / pF)} ${pu}` }, { ca, prof, h, pu, pEnd: pp / pF });
    }
    if (ca === 'bubble') {
      const gl = p.sgL * U.gw * (SI ? 1000 : 1), pa = p.patm * pF;
      const p1 = pa + gl * p.hd, p2 = pa + gl * p.hd2;
      st.add('Absolute pressure where the bubble starts', 'p₁ = p_atm + γ h₁', `p₁ = ${f(pa)} + ${f(gl)} × ${f(p.hd)}`, `p₁ = ${f(p1)} ${SI ? 'Pa' : 'psf'}`, '');
      st.add('Absolute pressure at the new depth', 'p₂ = p_atm + γ h₂', `p₂ = ${f(pa)} + ${f(gl)} × ${f(p.hd2)}`, `p₂ = ${f(p2)} ${SI ? 'Pa' : 'psf'}`, '');
      const d2 = p.db * Math.cbrt(p1 / p2);
      st.add('Isothermal gas: pV = constant', 'd₂ = d₁ (p₁/p₂)^(1/3)', `d₂ = ${f(p.db)} × (${f(p1)}/${f(p2)})^(1/3)`, `d₂ = ${f(d2)} ${SI ? 'mm' : 'in'}`, 'Volume ∝ d³, so the diameter grows with the cube root of the pressure ratio.');
      out.push({ k: 'Bubble diameter d₂', v: d2, u: SI ? 'mm' : 'in', hl: true }, { k: 'Volume ratio V₂/V₁', v: p1 / p2, u: '' }, { k: 'p₁ (abs)', v: p1 / pF, u: pu }, { k: 'p₂ (abs)', v: p2 / pF, u: pu });
      return ok(st, out, warn, { cls: 'ok', text: `d₂ = ${f(d2)} ${SI ? 'mm' : 'in'}` }, { ca, d1: p.db, d2, h1: p.hd, h2: p.hd2 });
    }
    // barometer
    const gl = p.sgL * U.gw * (SI ? 1000 : 1);
    const pv = p.pvap * pF;
    let pa, hb;
    if (p.bsolve === 'h') {
      pa = p.patm * pF; hb = (pa - pv) / gl;
      st.add('Barometer column height', 'h = (p_atm − p_v)/γ', `h = (${f(pa)} − ${f(pv)}) / ${f(gl)}`, `h = ${f(hb)} ${Lu} = ${f(hb * (SI ? 1000 : 12))} ${SI ? 'mm' : 'in'}`, 'The space above the column holds only the liquid’s vapour.');
    } else {
      hb = p.hbar / (SI ? 1000 : 12); pa = gl * hb + pv;
      st.add('Atmospheric pressure from the reading', 'p_atm = γ h + p_v', `p_atm = ${f(gl)} × ${f(hb)} + ${f(pv)}`, `p_atm = ${f(pa)} ${SI ? 'Pa' : 'psf'} = ${f(pa / pF)} ${pu}`, '');
    }
    out.push({ k: 'Column height h', v: hb * (SI ? 1000 : 12), u: SI ? 'mm' : 'in', hl: p.bsolve === 'h' }, { k: 'Atmospheric pressure', v: pa / pF, u: pu, hl: p.bsolve !== 'h' }, { k: 'Water-column equivalent', v: pa / (U.gw * (SI ? 1000 : 1)), u: Lu });
    return ok(st, out, warn, { cls: 'ok', text: `h = ${f(hb * (SI ? 1000 : 12))} ${SI ? 'mm' : 'in'}` }, { ca: 'baro', hb, sg: p.sgL });
  }

  /* Inclined-tube manometer with a reservoir: Δp = (γ_m − γ_f) L (sinθ + a/A) */
  function inclined(p, U) {
    const st = Steps(), out = [];
    const SI = U.id === 'SI', gw = U.gw;
    const gm = p.sgM * gw, gf = p.sgF * gw, th = p.thI * DEG;
    const ratio = p.useRes ? (p.dt / p.Dr) ** 2 : 0;
    st.add('Unit weights', 'γ_m = S_m γ_w ,  γ_f = S_f γ_w', `γ_m = ${f(p.sgM)} × ${f(gw)} ;  γ_f = ${f(p.sgF)} × ${f(gw)}`, `γ_m = ${f(gm)},  γ_f = ${f(gf)} ${U.gamma}`, 'γ_f = fluid above the gauge liquid (0 for air or gas).');
    if (p.useRes) st.add('Reservoir drop per unit reading', 'Δh_res = L a/A = L (d/D)²', `(d/D)² = (${f(p.dt)}/${f(p.Dr)})²`, `a/A = ${f(ratio)}`, 'The liquid leaving the reservoir lowers its level a little.');
    const k = Math.sin(th) + ratio;
    let L, dp;
    if (p.isolve === 'dp') {
      L = p.Lr;
      const dh = L * k;
      dp = (gm - gf) * dh;
      st.add('Vertical difference of the gauge-liquid levels', 'Δh = L (sinθ + a/A)', `Δh = ${f(L)} × (sin ${f(p.thI)}° + ${f(ratio)})`, `Δh = ${f(dh)} ${U.len}`, '');
      st.add('Pressure difference', 'p_A − p_B = (γ_m − γ_f) Δh', `Δp = (${f(gm)} − ${f(gf)}) × ${f(dh)}`, `Δp = ${f(dp)} ${U.press}`, '');
    } else {
      dp = p.dpI;
      L = dp / ((gm - gf) * k);
      st.add('Reading along the tube', 'L = Δp / ((γ_m − γ_f)(sinθ + a/A))', `L = ${f(dp)} / ((${f(gm)} − ${f(gf)}) × (sin ${f(p.thI)}° + ${f(ratio)}))`, `L = ${f(L)} ${U.len}`, '');
    }
    const Lv = dp / (gm - gf);
    st.add('Sensitivity compared with a vertical U-tube', 'L / h_vertical = 1/(sinθ + a/A)', `1 / ${f(k)}`, `${f(1 / k)} times longer reading`, 'Tilting the tube magnifies the reading.');
    out.push({ k: 'Pressure difference Δp', v: dp, u: U.press, hl: p.isolve === 'dp' }, { k: 'Reading along the tube L', v: L, u: U.len, hl: p.isolve !== 'dp' }, { k: 'Equivalent vertical reading', v: Lv, u: U.len }, { k: 'Magnification', v: 1 / k, u: '' });
    if (!SI) out.push({ k: 'Δp', v: dp / PSI, u: 'psi' }); else out.push({ k: 'Δp', v: dp * 1000, u: 'Pa' });
    return ok(st, out, [], { cls: 'ok', text: `Δp = ${f(dp)} ${U.press}, L = ${f(L)} ${U.len}` }, { L, th: p.thI, useRes: p.useRes });
  }

  /* =================================================================== */
  /* Hoop tension (thin-walled pipes, tanks, spheres; band spacing)       */
  /* =================================================================== */
  function hoop(p, U) {
    const st = Steps(), out = [], warn = [];
    const SI = U.id === 'SI';
    const sU = SI ? 'MPa' : 'psi', sF = SI ? 1000 : PSI; // stress unit factor from kPa or psf base
    const D = p.Dh, gam = p.sgH * U.gw;
    let pr;
    if (p.pBy === 'head') { pr = gam * p.hH; st.add('Pressure from the head of liquid', 'p = γ h', `p = ${f(gam)} × ${f(p.hH)}`, `p = ${f(pr)} ${U.press}`, ''); }
    else pr = p.pH;
    if (p.vessel === 'band') {
      const r = D / 2;
      const Tper = pr * r; // per unit height
      st.add('Hoop tension per unit height at that depth', 'T = p r', `T = ${f(pr)} × ${f(r)}`, `T = ${f(Tper)} ${U.fpl}`, 'Free body of half the vat: 2T = p D per unit height.');
      const Tb = SI ? (p.bandA * p.sAllow) / 1000 : p.bandA * p.sAllow; // mm²·MPa = N → kN ; in²·psi = lb
      st.add('Force one band can carry', 'T = A_band σ_allow', `T = ${f(p.bandA)} ${SI ? 'mm²' : 'in²'} × ${f(p.sAllow)} ${sU}`, `T = ${f(Tb)} ${U.force}`, '');
      const s = Tb / Tper;
      st.add('Spacing of hoops (bands)', 's = T / (p r)', `s = ${f(Tb)} / ${f(Tper)}`, `s = ${f(s)} ${U.len} = ${f(s * (SI ? 1000 : 12))} ${SI ? 'mm' : 'in'}`, 'Each band carries the hoop tension of the strip of wall it serves.');
      out.push({ k: 'Pressure p', v: pr, u: U.press }, { k: 'Hoop tension per unit height', v: Tper, u: U.fpl }, { k: 'Band spacing s', v: s, u: U.len, hl: true }, { k: 'Band spacing s', v: s * (SI ? 1000 : 12), u: SI ? 'mm' : 'in', hl: true });
      return ok(st, out, warn, { cls: 'ok', text: `s = ${f(s * (SI ? 1000 : 12))} ${SI ? 'mm' : 'in'}` }, { vessel: 'band', D, s });
    }
    const k = p.vessel === 'sphere' ? 4 : 2;
    const nm = p.vessel === 'sphere' ? 'Sphere' : 'Cylinder (hoop)';
    let t = p.tH / (SI ? 1000 : 12), sig;
    if (p.hsolve === 't') {
      const sigK = SI ? p.sAllow * 1000 : p.sAllow * PSI;
      t = (pr * D) / (k * sigK);
      st.add(`${nm} wall thickness`, `t = p D / (${k} σ_allow)`, `t = ${f(pr)} × ${f(D)} / (${k} × ${f(sigK)})`, `t = ${f(t)} ${U.len} = ${f(t * (SI ? 1000 : 12))} ${SI ? 'mm' : 'in'}`, k === 2 ? 'Free body of half a pipe ring: 2σ t = p D (per unit length).' : 'Free body of a hemisphere: σ π D t = p π D²/4.');
      sig = sigK;
    } else if (p.hsolve === 'p') {
      const sigK = SI ? p.sAllow * 1000 : p.sAllow * PSI;
      pr = (k * sigK * t) / D;
      st.add('Largest internal pressure', `p = ${k} σ_allow t / D`, `p = ${k} × ${f(sigK)} × ${f(t)} / ${f(D)}`, `p = ${f(pr)} ${U.press}`, '');
      sig = sigK;
    } else {
      sig = (pr * D) / (k * t);
      st.add(`${nm} stress`, `σ = p D / (${k} t)`, `σ = ${f(pr)} × ${f(D)} / (${k} × ${f(t)})`, `σ = ${f(sig)} ${U.press} = ${f(sig / sF)} ${sU}`, '');
    }
    const sigL = p.vessel === 'cyl' ? (pr * D) / (4 * t) : null;
    if (sigL !== null) st.add('Longitudinal stress (closed ends)', 'σ_L = p D / (4t)', `σ_L = ${f(pr)} × ${f(D)} / (4 × ${f(t)})`, `σ_L = ${f(sigL / sF)} ${sU}`, 'Half the hoop stress.');
    if (p.vessel === 'cyl') st.add('Hoop force per unit length', 'T = p D / 2', `T = ${f(pr)} × ${f(D)} / 2`, `T = ${f((pr * D) / 2)} ${U.fpl}`, '');
    out.push({ k: 'Internal pressure p', v: pr, u: U.press, hl: p.hsolve === 'p' }, { k: p.vessel === 'sphere' ? 'Wall stress σ' : 'Hoop stress σ_h', v: sig / sF, u: sU, hl: p.hsolve === 's' }, { k: 'Wall thickness t', v: t * (SI ? 1000 : 12), u: SI ? 'mm' : 'in', hl: p.hsolve === 't' });
    if (sigL !== null) out.push({ k: 'Longitudinal stress σ_L', v: sigL / sF, u: sU });
    return ok(st, out, warn, { cls: 'ok', text: p.hsolve === 't' ? `t = ${f(t * (SI ? 1000 : 12))} ${SI ? 'mm' : 'in'}` : p.hsolve === 'p' ? `p = ${f(pr)} ${U.press}` : `σ = ${f(sig / sF)} ${sU}` }, { vessel: p.vessel, D, t });
  }

  /* =================================================================== */
  /* Plane area of any shape: polygon (or parabola) on a vertical or      */
  /* inclined wall. Plate coords: x across (right +), s down the slope     */
  /* from the free-surface line. Returns F, CP (x_p, y_p), I_xy.          */
  /* =================================================================== */
  function polyProps(pts) {
    // pts in (x, s). Returns A, centroid, second moments about the s=0 and x=0 axes.
    let A = 0, Cx = 0, Cs = 0, Iss = 0, Ixs = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n];
      const c = x0 * y1 - x1 * y0;
      A += c; Cx += (x0 + x1) * c; Cs += (y0 + y1) * c;
      Iss += (y0 * y0 + y0 * y1 + y1 * y1) * c;          // ∫ s² dA
      Ixs += (x0 * y1 + 2 * x0 * y0 + 2 * x1 * y1 + x1 * y0) * c; // ∫ x s dA
    }
    A /= 2;
    const sgn = A < 0 ? -1 : 1;
    A = Math.abs(A);
    return { A, xc: (Cx / 6) * sgn / A, sc: (Cs / 6) * sgn / A, I_ss: Math.abs(Iss / 12), I_xs: (Ixs / 24) * sgn };
  }
  function shapePts(p) {
    const b = p.pb, h = p.ph, d = p.pd, N = 120;
    const pts = [];
    switch (p.pshape) {
      case 'rtri': // right triangle, vertical leg on x = 0 (left), base b at the bottom or top
        return p.porient === 'down' ? [[0, d], [b, d], [0, d + h]] : [[0, d], [0, d + h], [b, d + h]];
      case 'parab': // parabolic segment: width b, height h; vertex at top (opening down=area below curve) etc.
        for (let i = 0; i <= N; i++) { const x = -b / 2 + (b * i) / N; const yy = h * (1 - Math.pow((2 * x) / b, 2)); pts.push(p.porient === 'down' ? [x, d + h - yy] : [x, d + yy]); }
        if (p.porient === 'down') pts.push([b / 2, d + h], [-b / 2, d + h]); else pts.push([b / 2, d], [-b / 2, d]);
        // remove duplicate ends
        return pts;
      case 'spandrel': // area between y = h(x/b)² and the top line: semiparabola (Hibbeler sea wall style)
        for (let i = 0; i <= N; i++) { const x = (b * i) / N; pts.push([x, d + h * Math.pow(x / b, 2)]); }
        pts.push([0, d + h]); return pts;
      case 'qcirc':
        return qc(b, d, p.porient);
      default: return (p.ppts || []).map((q) => [q[0], q[1]]);
    }
  }
  function qc(r, d, orient) {
    const pts = [], N = 120;
    if (orient === 'down') { // straight edges on top (s = d) and left (x = 0), arc below
      pts.push([0, d]); pts.push([r, d]);
      for (let i = 1; i <= N; i++) { const a = (PI / 2) * (i / N); pts.push([r * Math.cos(a), d + r * Math.sin(a)]); }
    } else { // straight edges at bottom and left, arc on top
      pts.push([0, d + r]);
      for (let i = 0; i <= N; i++) { const a = (PI / 2) * (i / N); pts.push([r * Math.sin(a), d + r - r * Math.cos(a)]); }
      pts.push([r, d + r]);
    }
    return pts;
  }
  function planeAny(p, U) {
    const st = Steps(), out = [], warn = [];
    const gam = p.sgA * U.gw, th = (p.incl ? p.thA : 90) * DEG, sn = Math.sin(th);
    let pts = shapePts(p);
    if (pts.length < 3) return fail(['Enter at least three vertices.']);
    const sEq = p.psA ? p.psA / gam / sn : 0;
    if (pts.some((q) => q[1] < -1e-9)) warn.push('Part of the area lies above the free surface; only use shapes fully submerged (s ≥ 0).');
    const G = polyProps(pts);
    const nm = { rtri: 'Right triangle', parab: 'Parabolic segment', spandrel: 'Semi-parabolic (spandrel) area', qcirc: 'Quarter circle', poly: 'Polygon' }[p.pshape] || 'Area';
    st.add(`${nm}: area and centroid`, 'A, x̄, s̄ (polygon / numerical)', p.pshape === 'poly' ? `${pts.length} vertices` : 'curve split into 120 straight pieces (exact to 4 figures)', `A = ${f(G.A)} ${U.area},  x̄ = ${f(G.xc)},  s̄ = ${f(G.sc)} ${U.len}`, 's is measured down the plate from the free-surface line; x across it.');
    const sbar = G.sc + sEq;
    if (sEq) st.add('Surface pressure as an equivalent liquid height', 's_eq = p_s / (γ sinθ)', `s_eq = ${f(p.psA)} / (${f(gam)} × ${f(sn)})`, `s_eq = ${f(sEq)} ${U.len}`, 'Moves the imaginary free surface up.');
    const hbar = sbar * sn;
    const F = gam * hbar * G.A;
    st.add('Resultant force', 'F = γ h̄ A = γ (s̄ sinθ) A', `F = ${f(gam)} × ${f(hbar)} × ${f(G.A)}`, `F = ${f(F)} ${U.force}`, '');
    // second moments about centroid
    const Iss_c = G.I_ss - G.A * G.sc * G.sc;
    const Ixs_c = G.I_xs - G.A * G.xc * G.sc;
    st.add('Second moments about the centroid', 'I_x̄ = ∫s²dA − A s̄² ,  I_x̄ȳ = ∫x s dA − A x̄ s̄', '', `I_x̄ = ${f(Iss_c)} ${U.inertia},  I_x̄ȳ = ${f(Ixs_c)} ${U.inertia}`, I_xyNote(Ixs_c));
    const yp = sbar + Iss_c / (sbar * G.A);
    const xp = G.xc + Ixs_c / (sbar * G.A);
    st.add('Centre of pressure down the plate', 'y_p = s̄ + I_x̄ / (s̄ A)', `y_p = ${f(sbar)} + ${f(Iss_c)} / (${f(sbar)} × ${f(G.A)})`, `y_p = ${f(yp)} ${U.len}${sEq ? ` (= ${f(yp - sEq)} from the real surface line)` : ''}`, '');
    st.add('Centre of pressure across the plate', 'x_p = x̄ + I_x̄ȳ / (s̄ A)', `x_p = ${f(G.xc)} + ${f(Ixs_c)} / (${f(sbar)} × ${f(G.A)})`, `x_p = ${f(xp)} ${U.len}`, 'Off the centroid line only when the shape is not symmetric about a vertical axis.');
    out.push({ k: 'Area A', v: G.A, u: U.area }, { k: 'Centroid x̄', v: G.xc, u: U.len }, { k: 'Centroid depth h̄', v: hbar, u: U.len }, { k: 'Resultant force F', v: F, u: U.force, hl: true }, { k: 'CP down the plate y_p', v: yp - sEq, u: U.len, hl: true }, { k: 'CP vertical depth h_p', v: (yp - sEq) * sn, u: U.len }, { k: 'CP across x_p', v: xp, u: U.len, hl: true }, { k: 'I_x̄ (centroidal)', v: Iss_c, u: U.inertia }, { k: 'I_x̄ȳ (centroidal)', v: Ixs_c, u: U.inertia });
    if (p.hingeA) {
      // moment about a horizontal hinge line at s = sh: force P at s = sP normal to plate
      const arm = yp - sEq - p.sHinge, Parm = p.sProp - p.sHinge;
      const M = F * arm;
      st.add('Moment of F about the hinge line', 'M = F (y_p − s_hinge)', `M = ${f(F)} × (${f(yp - sEq)} − ${f(p.sHinge)})`, `M = ${f(M)} ${U.mom}`, '');
      if (Math.abs(Parm) > 1e-12) { const P = M / Parm; st.add('Force at the support (normal to the plate)', 'P = M / (s_P − s_hinge)', `P = ${f(M)} / ${f(Parm)}`, `P = ${f(P)} ${U.force}`, ''); out.push({ k: 'Support force P', v: P, u: U.force, hl: true }); }
      out.push({ k: 'Moment about hinge', v: M, u: U.mom });
    }
    return ok(st, out, warn, { cls: 'ok', text: `F = ${f(F)} ${U.force} at (${f(xp)}, ${f(yp - sEq)})` }, { pts, G, xp, yp: yp - sEq, F, th: p.incl ? p.thA : 90, sEq });
  }
  const I_xyNote = (v) => (Math.abs(v) < 1e-9 ? 'I_xy = 0: symmetric about a line down the plate.' : 'Product of inertia ≠ 0: the force acts off the centroid line.');

  /* =================================================================== */
  /* Hydrometer                                                           */
  /* =================================================================== */
  function hydrometer(p, U) {
    const st = Steps(), out = [];
    const SI = U.id === 'SI', gw = U.gw * (SI ? 1000 : 1); // N/m³ or lb/ft³
    const lu = SI ? 'mm' : 'in', lf = SI ? 1000 : 12, W = p.Wh;
    const a = p.stemBy === 'a' ? p.aSt / (lf * lf) : (PI * (p.dst / lf) ** 2) / 4;
    if (p.stemBy === 'a') st.add('Stem cross-section', 'a', `${f(p.aSt)} ${lu}²`, `a = ${f(a)} ${U.area}`, '');
    else st.add('Stem cross-section', 'a = π d²/4', `a = π × ${f(p.dst / lf)}² / 4`, `a = ${f(a)} ${U.area}`, '');
    const V1 = W / (gw * p.S1h);
    st.add('Displaced volume in liquid 1', 'V₁ = W / (S₁ γ_w)', `V₁ = ${f(W)} / (${f(p.S1h)} × ${f(gw)})`, `V₁ = ${f(V1)} ${U.vol}`, 'A floating hydrometer always displaces its own weight.');
    let S2 = p.S2h, dh;
    if (p.hsol === 'dh') {
      const V2 = W / (gw * S2);
      dh = (V1 - V2) / a;
      st.add('Displaced volume in liquid 2', 'V₂ = W / (S₂ γ_w)', `V₂ = ${f(W)} / (${f(S2)} × ${f(gw)})`, `V₂ = ${f(V2)} ${U.vol}`, '');
      st.add('Distance between the two marks on the stem', 'Δh = (V₁ − V₂)/a', `Δh = (${f(V1)} − ${f(V2)}) / ${f(a)}`, `Δh = ${f(dh * lf)} ${lu}`, dh > 0 ? 'Liquid 2 is denser: the hydrometer rises.' : 'Liquid 2 is lighter: the hydrometer sinks deeper.');
    } else {
      dh = p.dhh / lf;
      const V2 = V1 - a * dh;
      if (!(V2 > 0)) return fail(['The stem would come out of the liquid.'], [], st.list);
      S2 = W / (gw * V2);
      st.add('Displaced volume after rising by Δh', 'V₂ = V₁ − a Δh', `V₂ = ${f(V1)} − ${f(a)} × ${f(dh)}`, `V₂ = ${f(V2)} ${U.vol}`, 'Positive Δh = hydrometer floats higher.');
      st.add('Specific gravity of liquid 2', 'S₂ = W / (γ_w V₂)', `S₂ = ${f(W)} / (${f(gw)} × ${f(V2)})`, `S₂ = ${f(S2)}`, '');
    }
    out.push({ k: 'Mark spacing Δh (rise)', v: dh * lf, u: lu, hl: p.hsol === 'dh' }, { k: 'Specific gravity S₂', v: S2, u: '', hl: p.hsol !== 'dh' }, { k: 'Displaced volume V₁', v: V1, u: U.vol }, { k: 'Stem area a', v: a, u: U.area });
    return ok(st, out, [], { cls: 'ok', text: p.hsol === 'dh' ? `Δh = ${f(dh * lf)} ${lu}` : `S₂ = ${f(S2)}` }, { dh, S1: p.S1h, S2, a, V1 });
  }

  /* Balloon / gas lift */
  function balloon(p, U) {
    const st = Steps(), out = [];
    const SI = U.id === 'SI', g = U.g, pF = SI ? 1000 : PSI, To = Toff(U);
    const Ra = Rair(U), Rg = p.gasB === 'he' ? (SI ? 2077 : 12420) : p.gasB === 'h2' ? (SI ? 4124 : 24650) : Ra;
    const Ta = p.Tair + To, Tg = (p.gasB === 'hot' ? p.Tin : p.Tair) + To, pa = p.pB * pF;
    const ra = pa / (Ra * Ta), rg = pa / (Rg * Tg);
    let ga = ra * g, gg = rg * g;
    const wu = SI ? 'N/m³' : 'lb/ft³';
    if (p.gasB === 'given') { ga = p.gamA; gg = p.gamG; st.add('Specific weights (given)', 'γ_a , γ_g', '', `γ_a = ${f(ga)} ${wu},  γ_g = ${f(gg)} ${wu}`, 'Unit weights entered directly (for example from a table, γ = ρg).'); }
    else st.add('Specific weight of the surrounding air', 'γ_a = p g /(R_a T_a)', `γ_a = ${f(pa)} × ${f(g)} / (${f(Ra)} × ${f(Ta)})`, `γ_a = ${f(ga)} ${SI ? 'N/m³' : 'lb/ft³'}`, '');
    if (p.gasB !== 'given') st.add(`Specific weight of the ${p.gasB === 'hot' ? 'heated air' : p.gasB === 'he' ? 'helium' : 'hydrogen'}`, 'γ_g = p g /(R_g T_g)', `γ_g = ${f(pa)} × ${f(g)} / (${f(Rg)} × ${f(Tg)})`, `γ_g = ${f(gg)} ${SI ? 'N/m³' : 'lb/ft³'}`, 'Gas inside is at (nearly) the outside pressure.');
    let V, D;
    if (p.bsol === 'load') {
      if (p.Vby === 'V') { V = p.VB; D = Math.cbrt((6 * V) / PI); st.add('Balloon volume (given)', 'V', '', `V = ${f(V)} ${U.vol}`, ''); }
      else { D = p.DB; V = (PI * D ** 3) / 6; st.add('Balloon volume (sphere)', 'V = πD³/6', `V = π × ${f(D)}³ / 6`, `V = ${f(V)} ${U.vol}`, ''); }
      const L = V * (ga - gg), net = L - p.WB;
      st.add('Gross lift (buoyancy − gas weight)', 'L = V(γ_a − γ_g)', `L = ${f(V)} × (${f(ga)} − ${f(gg)})`, `L = ${f(L)} ${SI ? 'N' : 'lb'}`, '');
      st.add('Payload it can carry', 'W_payload = L − W_balloon', `= ${f(L)} − ${f(p.WB)}`, `W_payload = ${f(net)} ${SI ? 'N' : 'lb'}`, net < 0 ? 'Negative: the balloon cannot even lift itself.' : '');
      out.push({ k: 'Gross lift', v: L, u: SI ? 'N' : 'lb' }, { k: 'Payload', v: net, u: SI ? 'N' : 'lb', hl: true }, { k: 'Payload mass', v: net / g, u: SI ? 'kg' : 'slug' });
    } else {
      V = (p.WB + p.Wpay) / (ga - gg);
      if (!(V > 0)) return fail(['The gas is not lighter than the air.'], [], st.list);
      D = Math.cbrt((6 * V) / PI);
      st.add('Volume needed', 'V = (W_balloon + W_payload)/(γ_a − γ_g)', `V = (${f(p.WB)} + ${f(p.Wpay)}) / (${f(ga)} − ${f(gg)})`, `V = ${f(V)} ${U.vol}`, '');
      st.add('Diameter of a spherical balloon', 'D = (6V/π)^(1/3)', `D = (6 × ${f(V)} / π)^(1/3)`, `D = ${f(D)} ${U.len}`, '');
      out.push({ k: 'Volume needed', v: V, u: U.vol, hl: true }, { k: 'Diameter D', v: D, u: U.len, hl: true });
    }
    out.push({ k: 'γ air', v: ga, u: wu }, { k: 'γ gas', v: gg, u: wu });
    return ok(st, out, [], { cls: 'ok', text: p.bsol === 'load' ? `Payload = ${f(out[1].v)} ${SI ? 'N' : 'lb'}` : `D = ${f(D)} ${U.len}` }, { D, V, net: p.bsol === 'load' ? out[1].v : p.Wpay });
  }

  /* Rotating U-tube: legs at radii r1, r2, equal areas, rest level h0 above the horizontal tube */
  function rotUtube(p, U) {
    const st = Steps(), out = [], warn = [];
    const g = U.g, r1 = p.r1u, r2 = p.r2u, h0 = p.h0u;
    let w = p.useRpmU ? (2 * PI * p.Nu) / 60 : p.wu;
    if (p.usolve === 'w') {
      const dh = p.dhu;
      const d2 = Math.abs(r2 * r2 - r1 * r1);
      if (!(d2 > 0)) return fail(['The two legs must be at different radii.']);
      w = Math.sqrt((2 * g * dh) / d2);
      st.add('Speed for a level difference Δh', 'ω = √(2g Δh /(r₂² − r₁²))', `ω = √(2 × ${f(g)} × ${f(dh)} / ${f(d2)})`, `ω = ${f(w)} rad/s = ${f((w * 60) / (2 * PI))} rpm`, '');
    } else if (p.usolve === 'empty') {
      const ri = Math.min(r1, r2), ro = Math.max(r1, r2), d2 = ro * ro - ri * ri;
      if (!(d2 > 0)) return fail(['The two legs must be at different radii.']);
      w = Math.sqrt((4 * g * h0) / d2);
      st.add('Speed that just empties the inner leg', 'ω = √(4 g h₀ /(r_out² − r_in²))', `ω = √(4 × ${f(g)} × ${f(h0)} / ${f(d2)})`, `ω = ${f(w)} rad/s = ${f((w * 60) / (2 * PI))} rpm`, 'Inner level at the tube (h = 0) and h₁ + h₂ = 2h₀ (equal leg areas).');
    } else if (p.useRpmU) st.add('Angular speed', 'ω = 2πN/60', `ω = 2π × ${f(p.Nu)} / 60`, `ω = ${f(w)} rad/s`, '');
    const z = (r) => (w * w * r * r) / (2 * g);
    const dh = z(r2) - z(r1);
    st.add('Free surfaces lie on one paraboloid', 'z = z_v + ω² r² /(2g)', `Δh = ω²(r₂² − r₁²)/(2g) = ${f(w)}² × (${f(r2)}² − ${f(r1)}²) / (2 × ${f(g)})`, `Δh = ${f(dh)} ${U.len}`, 'Both legs are open to the air, so both surfaces are on the same pressure-zero paraboloid.');
    const zv = h0 - (w * w * (r1 * r1 + r2 * r2)) / (4 * g);
    const h1 = zv + z(r1), h2 = zv + z(r2);
    st.add('Leg levels (liquid volume conserved, equal leg areas)', 'h₁ + h₂ = 2h₀', `h₁ = ${f(h1)},  h₂ = ${f(h2)}`, `vertex at ${f(zv)} ${U.len} above the horizontal tube`, '');
    if (h1 < -1e-9 || h2 < -1e-9) warn.push('One leg empties: the liquid level falls into the horizontal tube, so these levels no longer apply.');
    const gam = p.sgU * U.gw;
    const pAxis = -gam * zv;
    st.add('Pressure in the horizontal tube on the axis', 'p = γ(0 − z_v)', `p = ${f(gam)} × ${f(-zv)}`, `p = ${f(pAxis)} ${U.press}`, pAxis < 0 ? 'Negative gauge pressure (suction) on the axis.' : '');
    out.push({ k: 'ω', v: w, u: 'rad/s', hl: p.usolve !== 'dh' }, { k: 'N', v: (w * 60) / (2 * PI), u: 'rpm' }, { k: 'Level difference Δh', v: dh, u: U.len, hl: p.usolve === 'dh' }, { k: 'Level in leg 1 h₁', v: h1, u: U.len }, { k: 'Level in leg 2 h₂', v: h2, u: U.len }, { k: 'Pressure on the axis', v: pAxis, u: U.press });
    return ok(st, out, warn, { cls: warn.length ? 'warn' : 'ok', text: p.usolve === 'dh' ? `Δh = ${f(dh)} ${U.len}` : `ω = ${f(w)} rad/s (${f((w * 60) / (2 * PI))} rpm)` }, { r1, r2, h1, h2, zv, w });
  }

  Object.assign(P0, { compress, inclined, hoop, planeAny, polyProps, hydrometer, balloon, rotUtube });
})(window);
