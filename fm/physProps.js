/* =====================================================================
 * PHYSICS — Fluid Properties
 *   density & specific gravity, ideal gas, gas processes, bulk modulus,
 *   viscosity units and temperature laws, surface tension, capillarity,
 *   water property tables (vapor pressure, boiling, cavitation, expansion).
 * Same result shape as physics.js:
 *   { ok, err:[], warn:[], status:{cls,text}, out:[{k,v,u,hl}], steps:[{t,n,f,s,r}], geo:{} }
 * Property tables are from Hibbeler, Fluid Mechanics, Appendix A and
 * Schaum's Outline of Fluid Mechanics & Hydraulics, Table 1.
 * ===================================================================== */
(function (root) {
  'use strict';
  const P0 = root.Physics;
  const f = P0.fmt;
  const PI = Math.PI, DEG = PI / 180;

  function Steps() { const list = []; return { list, add(t, fo, s, r, n) { list.push({ t, f: fo, s, r, n }); } }; }
  const fail = (err, warn, steps) => ({ ok: false, err, warn: warn || [], steps: steps || [], out: [], geo: {} });

  /* ------------------------------------------------------------------ */
  /* Units for this module                                               */
  /* ------------------------------------------------------------------ */
  const PU = {
    SI: { id: 'SI', g: 9.81, m: 'kg', V: 'm³', rho: 'kg/m³', gam: 'kN/m³', gamN: 'N/m³', gamF: 1000, W: 'N', acc: 'm/s²', p: 'kPa', pF: 1000, pabs: 'kPa (abs)', T: '°C', Ta: 'K', Toff: 273, R: 'J/(kg·K)', E: 'GPa', EF: 1e9, dp: 'MPa', dpF: 1e6, sig: 'N/m', len: 'mm', lenF: 0.001, dP: 'Pa', mu: 'Pa·s', nu: 'm²/s', rhoW: 1000, sv: 'm³/kg', vel: 'm/s', z: 'm', patm: 101.325 },
    EN: { id: 'EN', g: 32.2, m: 'slug', V: 'ft³', rho: 'slug/ft³', gam: 'lb/ft³', gamN: 'lb/ft³', gamF: 1, W: 'lb', acc: 'ft/s²', p: 'psi', pF: 144, pabs: 'psia', T: '°F', Ta: '°R', Toff: 460, R: 'ft·lb/(slug·°R)', E: 'psi', EF: 144, dp: 'psi', dpF: 144, sig: 'lb/ft', len: 'in', lenF: 1 / 12, dP: 'psf', mu: 'lb·s/ft²', nu: 'ft²/s', rhoW: 1.94, sv: 'ft³/slug', vel: 'ft/s', z: 'ft', patm: 14.7 },
  };
  const R_SI2EN = 5.97994; // 1 J/(kg·K) = 5.980 ft·lb/(slug·°R)

  /* Gases: R in J/(kg·K) (Hibbeler App. A; Schaum Table 1A for NH3, SO2, H2O vapour), k = cp/cv */
  const GASES = {
    air: { name: 'Air', R: 286.9, k: 1.40 },
    o2: { name: 'Oxygen O₂', R: 259.8, k: 1.40 },
    n2: { name: 'Nitrogen N₂', R: 296.8, k: 1.40 },
    h2: { name: 'Hydrogen H₂', R: 4124, k: 1.41 },
    he: { name: 'Helium He', R: 2077, k: 1.66 },
    co2: { name: 'Carbon dioxide CO₂', R: 188.9, k: 1.30 },
    ch4: { name: 'Methane CH₄', R: 518.3, k: 1.31 },
    nh3: { name: 'Ammonia NH₃', R: 482.7, k: 1.32 },
    so2: { name: 'Sulfur dioxide SO₂', R: 127.5, k: 1.26 },
    h2o: { name: 'Water vapour H₂O', R: 461.5, k: 1.33 },
  };
  function gasR(p, U) {
    if (p.gas === 'custom') return { R: p.R, k: p.k, name: 'Custom gas' };
    const G = GASES[p.gas] || GASES.air;
    return { R: U.id === 'SI' ? G.R : G.R * R_SI2EN, k: G.k, name: G.name };
  }

  /* Water tables. SI: T °C, ρ kg/m³, μ Pa·s, p_v kPa. EN: T °F, ρ slug/ft³, μ lb·s/ft², p_v psia. */
  const WATER = {
    H: {
      SI: [[0, 999.8, 1.80e-3, 0.611], [5, 1000.0, 1.52e-3, 0.872], [10, 999.7, 1.31e-3, 1.23], [15, 999.2, 1.15e-3, 1.71], [20, 998.3, 1.00e-3, 2.34], [25, 997.1, 0.897e-3, 3.17], [30, 995.7, 0.801e-3, 4.25], [35, 994.0, 0.723e-3, 5.63], [40, 992.3, 0.659e-3, 7.38], [45, 990.2, 0.599e-3, 9.59], [50, 988.0, 0.554e-3, 12.4], [55, 985.7, 0.508e-3, 15.8], [60, 983.2, 0.470e-3, 19.9], [65, 980.5, 0.437e-3, 25.0], [70, 977.7, 0.405e-3, 31.2], [75, 974.8, 0.381e-3, 38.6], [80, 971.6, 0.356e-3, 47.4], [85, 968.4, 0.336e-3, 57.8], [90, 965.1, 0.318e-3, 70.1], [95, 961.6, 0.300e-3, 84.6], [100, 958.1, 0.284e-3, 101.3]],
      EN: [[32, 1.940, 37.5e-6, 0.0885], [40, 1.940, 32.3e-6, 0.122], [50, 1.940, 27.4e-6, 0.178], [60, 1.939, 23.6e-6, 0.256], [70, 1.937, 20.2e-6, 0.363], [80, 1.934, 18.1e-6, 0.507], [90, 1.931, 15.8e-6, 0.698], [100, 1.927, 14.4e-6, 0.949], [110, 1.923, 12.8e-6, 1.28], [120, 1.918, 11.8e-6, 1.69], [130, 1.913, 10.7e-6, 2.23], [140, 1.908, 9.81e-6, 2.89], [150, 1.902, 9.06e-6, 3.72], [160, 1.896, 8.30e-6, 4.75], [170, 1.890, 7.80e-6, 6.00], [180, 1.883, 7.20e-6, 7.51], [190, 1.877, 6.82e-6, 9.34], [200, 1.869, 6.36e-6, 11.5], [212, 1.860, 5.93e-6, 14.7]],
    },
    // Schaum Table 1(C): T, ρ, μ, p_v, σ, E   (SI: E in GPa → stored in Pa; EN: E in psi)
    S: {
      SI: [[0, 1000, 1.75e-3, 0.611, 0.0756, 2.02e9], [10, 1000, 1.30e-3, 1.23, 0.0742, 2.10e9], [20, 998, 1.02e-3, 2.34, 0.0728, 2.18e9], [30, 996, 8.00e-4, 4.24, 0.0712, 2.25e9], [40, 992, 6.51e-4, 7.38, 0.0696, 2.28e9], [50, 988, 5.41e-4, 12.3, 0.0679, 2.29e9], [60, 984, 4.60e-4, 19.9, 0.0662, 2.28e9], [70, 978, 4.02e-4, 31.2, 0.0644, 2.25e9], [80, 971, 3.50e-4, 47.4, 0.0626, 2.20e9], [90, 965, 3.11e-4, 70.1, 0.0608, 2.14e9], [100, 958, 2.82e-4, 101.3, 0.0589, 2.07e9]],
      EN: [[32, 1.94, 3.75e-5, 0.08, 0.00518, 287000], [40, 1.94, 3.24e-5, 0.12, 0.00514, 296000], [50, 1.94, 2.74e-5, 0.17, 0.00508, 305000], [60, 1.94, 2.36e-5, 0.26, 0.00504, 313000], [70, 1.94, 2.04e-5, 0.36, 0.00497, 319000], [80, 1.93, 1.80e-5, 0.51, 0.00492, 325000], [90, 1.93, 1.59e-5, 0.70, 0.00486, 329000], [100, 1.93, 1.42e-5, 0.96, 0.00479, 331000], [120, 1.92, 1.17e-5, 1.70, 0.00466, 332000]],
    },
  };
  /* U.S. Standard Atmosphere (Hibbeler App. A). SI: z km, T °C, p kPa, ρ kg/m³. EN: z ft, T °F, p psf, ρ slug/ft³ */
  const ATM = {
    SI: [[0, 15.00, 101.3, 1.225], [1, 8.501, 89.88, 1.112], [2, 2.004, 79.50, 1.007], [3, -4.491, 70.12, 0.9092], [4, -10.98, 61.66, 0.8194], [5, -17.47, 54.05, 0.7364], [6, -23.96, 47.22, 0.6601], [7, -30.45, 41.10, 0.5900], [8, -36.94, 35.65, 0.5258], [9, -43.42, 30.80, 0.4671], [10, -49.90, 26.45, 0.4135], [11, -56.38, 22.67, 0.3648], [12, -56.50, 19.40, 0.3119], [13, -56.50, 16.58, 0.2666], [14, -56.50, 14.17, 0.2279], [15, -56.50, 12.11, 0.1948], [16, -56.50, 10.35, 0.1665], [17, -56.50, 8.850, 0.1423], [18, -56.50, 7.565, 0.1217], [19, -56.50, 6.468, 0.1040], [20, -56.50, 5.529, 0.08891], [21, -55.57, 4.729, 0.07572], [22, -54.58, 4.048, 0.06451], [23, -53.58, 3.467, 0.05501], [24, -52.59, 2.972, 0.04694], [25, -51.60, 2.549, 0.04008]],
    EN: [[0, 59.00, 2116, 2.377e-3], [2500, 50.09, 1932, 2.209e-3], [5000, 41.17, 1761, 2.048e-3], [7500, 32.26, 1602, 1.897e-3], [10000, 23.36, 1456, 1.756e-3], [12500, 14.45, 1320, 1.622e-3], [15000, 5.55, 1195, 1.496e-3], [17500, -3.36, 1079, 1.378e-3], [20000, -12.26, 973.3, 1.267e-3], [22500, -21.16, 875.8, 1.163e-3], [25000, -30.05, 786.3, 1.066e-3], [27500, -38.95, 704.4, 0.9748e-3], [30000, -47.83, 629.6, 0.8907e-3], [32500, -56.72, 561.4, 0.8117e-3], [35000, -65.61, 499.3, 0.7382e-3], [37500, -69.70, 443.2, 0.6652e-3], [40000, -69.70, 393.1, 0.5873e-3], [42500, -69.70, 348.7, 0.5207e-3], [45000, -69.70, 309.5, 0.4623e-3], [47500, -69.70, 274.6, 0.4103e-3], [50000, -69.70, 243.6, 0.3639e-3], [52500, -69.70, 216.1, 0.3229e-3], [55000, -69.70, 191.4, 0.2860e-3], [57500, -69.70, 170.3, 0.2549e-3], [60000, -69.70, 151.0, 0.2260e-3]],
  };

  /** Linear interpolation in table rows on column `xc`, returning the whole row and the bracket. */
  function interp(rows, x, xc) {
    xc = xc || 0;
    const n = rows.length;
    const asc = rows[n - 1][xc] > rows[0][xc];
    const lo = asc ? rows[0][xc] : rows[n - 1][xc], hi = asc ? rows[n - 1][xc] : rows[0][xc];
    if (!(x >= lo - 1e-9 && x <= hi + 1e-9)) return null;
    for (let i = 0; i < n - 1; i++) {
      const a = rows[i], b = rows[i + 1];
      const x0 = a[xc], x1 = b[xc];
      if ((x - x0) * (x - x1) <= 0) {
        const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
        return { row: a.map((v, j) => v + t * (b[j] - v)), a, b, t, exact: t < 1e-12 || t > 1 - 1e-12 };
      }
    }
    return null;
  }

  /* Viscosity unit factors to SI */
  const MU_U = { Pas: [1, 'Pa·s (N·s/m²)'], P: [0.1, 'poise (P)'], cP: [0.001, 'centipoise (cP)'], ENmu: [47.880, 'lb·s/ft²'] };
  const NU_U = { m2s: [1, 'm²/s'], St: [1e-4, 'stoke (St = cm²/s)'], cSt: [1e-6, 'centistoke (cSt)'], ft2s: [0.09290304, 'ft²/s'] };

  /** Volume helper for gas tanks and the like */
  function volumeOf(p, U, st) {
    const L = U.id === 'SI' ? 'm' : 'ft';
    if (p.vshape === 'sphere') { const V = (PI * p.vD ** 3) / 6; st.add('Volume of the sphere', 'V = πD³/6', `V = π × ${f(p.vD)}³ / 6`, `V = ${f(V)} ${U.id === 'SI' ? 'm³' : 'ft³'}`, ''); return V; }
    if (p.vshape === 'cyl') { const V = (PI * p.vD ** 2 / 4) * p.vL; st.add('Volume of the cylinder', 'V = (πD²/4)L', `V = π × ${f(p.vD)}² / 4 × ${f(p.vL)}`, `V = ${f(V)} ${U.id === 'SI' ? 'm³' : 'ft³'}`, ''); return V; }
    if (p.vshape === 'capsule') { const V = (PI * p.vD ** 2 / 4) * p.vL + (PI * p.vD ** 3) / 6; st.add('Volume of the capsule (cylinder + two hemispherical ends)', 'V = (πD²/4)L + πD³/6', `V = π × ${f(p.vD)}² / 4 × ${f(p.vL)} + π × ${f(p.vD)}³ / 6`, `V = ${f(V)} ${U.id === 'SI' ? 'm³' : 'ft³'}`, `L = length of the straight part (${L}).`); return V; }
    return p.V;
  }

  /* =================================================================== */
  function props(p, U) {
    const u = PU[U.id];
    const st = Steps(), warn = [], out = [];
    const T = p.topic;
    const pos = (v, name) => (v > 0 ? null : `${name} must be positive.`);
    const errs = (list) => list.filter(Boolean);

    /* ---------------- Density, specific weight, specific gravity -------- */
    if (T === 'dens') {
      const g = p.gLoc > 0 ? p.gLoc : u.g;
      let rho;
      if (p.given === 'mix') {
        const n = +p.nmix || 2, parts = [];
        let V = 0, Wg = 0;
        for (let i = 1; i <= n; i++) {
          const Vi = p['mV' + i], si = p['mS' + i];
          if (!(Vi >= 0) || !(si > 0)) return fail([`Component ${i}: volume and specific gravity must be positive.`]);
          parts.push({ V: Vi, s: si }); V += Vi; Wg += Vi * si;
        }
        if (!(V > 0)) return fail(['The total volume must be positive.']);
        const sm = Wg / V;
        st.add('Mixture specific gravity (volumes add, weights add)', 'S_mix = Σ(Sᵢ Vᵢ) / ΣVᵢ', `S_mix = (${parts.map((q) => `${f(q.s)}×${f(q.V)}`).join(' + ')}) / ${f(V)}`, `S_mix = ${f(sm)}`, 'Weight of the mixture = sum of the weights; volume = sum of the volumes (no shrinkage).');
        rho = sm * u.rhoW;
        const gam = rho * g;
        st.add('Mixture density and specific weight', 'ρ = S ρ_w ,  γ = ρ g', `ρ = ${f(sm)} × ${f(u.rhoW)} ;  γ = ${f(rho)} × ${f(g)}`, `ρ = ${f(rho)} ${u.rho},  γ = ${f(gam / u.gamF)} ${u.gam}`, '');
        out.push({ k: 'Mixture specific gravity S', v: sm, u: '', hl: true }, { k: 'Mixture density ρ', v: rho, u: u.rho }, { k: 'Mixture specific weight γ', v: gam / u.gamF, u: u.gam, hl: true }, { k: 'Total volume', v: V, u: u.V }, { k: 'Total weight', v: gam * V, u: u.W }, { k: 'Total mass', v: rho * V, u: u.m });
        return { ok: true, err: [], warn, steps: st.list, out, status: { cls: 'ok', text: `S_mix = ${f(sm)}` }, geo: { topic: T, mix: parts, sm } };
      }
      const e = errs([p.given === 'mV' && (pos(p.m, 'Mass') || pos(p.V, 'Volume')), p.given === 'WV' && (pos(p.W, 'Weight') || pos(p.V, 'Volume')), p.given === 'rho' && pos(p.rho, 'Density'), p.given === 'gam' && pos(p.gam, 'Specific weight'), p.given === 'sg' && pos(p.sg, 'Specific gravity'), p.given === 'sv' && pos(p.sv, 'Specific volume'), pos(g, 'g')]);
      if (e.length) return fail(e);
      if (g !== u.g) st.add('Local acceleration of gravity', 'g', '', `g = ${f(g)} ${u.acc}`, 'Mass and density do not change with g; weight and specific weight do.');
      if (p.given === 'mV') { rho = p.m / p.V; st.add('Density from mass and volume', 'ρ = m / V', `ρ = ${f(p.m)} / ${f(p.V)}`, `ρ = ${f(rho)} ${u.rho}`, ''); }
      else if (p.given === 'WV') { const gam = p.W / p.V; rho = gam / g; st.add('Specific weight from weight and volume', 'γ = W / V', `γ = ${f(p.W)} / ${f(p.V)}`, `γ = ${f(gam)} ${u.gamN}`, ''); st.add('Density', 'ρ = γ / g', `ρ = ${f(gam)} / ${f(g)}`, `ρ = ${f(rho)} ${u.rho}`, ''); }
      else if (p.given === 'rho') rho = p.rho;
      else if (p.given === 'gam') { rho = (p.gam * u.gamF) / g; st.add('Density from specific weight', 'ρ = γ / g', `ρ = ${f(p.gam * u.gamF)} / ${f(g)}`, `ρ = ${f(rho)} ${u.rho}`, U.id === 'SI' ? 'γ converted from kN/m³ to N/m³.' : ''); }
      else if (p.given === 'sg') { rho = p.sg * u.rhoW; st.add('Density from specific gravity', 'ρ = S ρ_w', `ρ = ${f(p.sg)} × ${f(u.rhoW)}`, `ρ = ${f(rho)} ${u.rho}`, `Reference water density ρ_w = ${f(u.rhoW)} ${u.rho}.`); }
      else { rho = 1 / p.sv; st.add('Density from specific volume', 'ρ = 1 / v', `ρ = 1 / ${f(p.sv)}`, `ρ = ${f(rho)} ${u.rho}`, ''); }
      const gam = rho * g, sg = rho / u.rhoW, sv = 1 / rho;
      if (p.given !== 'gam' && p.given !== 'WV') st.add('Specific weight', 'γ = ρ g', `γ = ${f(rho)} × ${f(g)}`, `γ = ${f(gam)} ${u.gamN}${U.id === 'SI' ? ` = ${f(gam / 1000)} kN/m³` : ''}`, '');
      if (p.given !== 'sg') st.add('Specific gravity', 'S = ρ / ρ_w', `S = ${f(rho)} / ${f(u.rhoW)}`, `S = ${f(sg)}`, 'Compared with water at 4 °C.');
      st.add('Specific volume', 'v = 1 / ρ', `v = 1 / ${f(rho)}`, `v = ${f(sv)} ${u.sv}`, 'Volume per unit mass.');
      out.push({ k: 'Density ρ', v: rho, u: u.rho, hl: true }, { k: 'Specific weight γ', v: gam / u.gamF, u: u.gam, hl: true });
      if (U.id === 'SI') out.push({ k: 'Specific weight γ', v: gam, u: 'N/m³' });
      out.push({ k: 'Specific gravity S', v: sg, u: '', hl: true }, { k: 'Specific volume v', v: sv, u: u.sv });
      let V = null;
      if (p.given === 'mV' || p.given === 'WV') V = p.V; else if (p.useV) V = p.Vq;
      if (V > 0) {
        const m = rho * V, W = gam * V;
        st.add('Mass and weight of the volume', 'm = ρ V ,  W = γ V = m g', `m = ${f(rho)} × ${f(V)} ;  W = ${f(gam)} × ${f(V)}`, `m = ${f(m)} ${u.m},  W = ${f(W)} ${u.W}`, '');
        out.push({ k: 'Volume V', v: V, u: u.V }, { k: 'Mass m', v: m, u: u.m, hl: true }, { k: 'Weight W', v: W, u: u.W, hl: true });
        if (U.id === 'SI' && W >= 1000) out.push({ k: 'Weight W', v: W / 1000, u: 'kN' });
        if (U.id === 'EN') out.push({ k: 'Weight W', v: W / 1000, u: 'kip' });
      }
      return { ok: true, err: [], warn, steps: st.list, out, status: { cls: 'ok', text: `ρ = ${f(rho)} ${u.rho}, S = ${f(sg)}` }, geo: { topic: T, sg, V } };
    }

    /* ---------------- Ideal gas -------------------------------------- */
    if (T === 'gas') {
      const G = gasR(p, U);
      if (!(G.R > 0)) return fail(['Gas constant R must be positive.']);
      st.add(`Gas constant of ${G.name}`, 'R', '', `R = ${f(G.R)} ${u.R}`, U.id === 'SI' ? 'From Hibbeler Appendix A (Schaum Table 1A gives R per unit weight: R/g in m/K).' : 'R in ft·lb/(slug·°R) (Schaum gives R/g in ft/°R).');
      const toAbsP = (pp) => (p.gauge ? pp + p.patm : pp);
      const Tabs = (Tc) => Tc + u.Toff;
      let pa, Ta, rho;
      const solve = p.solve;
      if (solve !== 'p') {
        if (!(toAbsP(p.p) > 0)) return fail(['Absolute pressure must be positive.']);
        pa = toAbsP(p.p);
        if (p.gauge) st.add('Absolute pressure', 'p_abs = p_gauge + p_atm', `p = ${f(p.p)} + ${f(p.patm)}`, `p = ${f(pa)} ${u.pabs}`, 'The gas law needs absolute pressure.');
      }
      if (solve !== 'T') { Ta = Tabs(p.T); if (!(Ta > 0)) return fail(['Absolute temperature must be positive.']); st.add('Absolute temperature', U.id === 'SI' ? 'T = T(°C) + 273' : 'T = T(°F) + 460', `T = ${f(p.T)} + ${f(u.Toff)}`, `T = ${f(Ta)} ${u.Ta}`, ''); }
      const pPa = (x) => x * u.pF; // to Pa or psf
      const lawStep = () => st.add('Ideal gas law', 'p = ρ R T', '', '', 'Valid for gases far from condensation; p and T absolute.');
      let V = null, m = null;
      if (solve === 'rho' || solve === 'm' || solve === 'V') {
        lawStep();
        rho = pPa(pa) / (G.R * Ta);
        st.add('Density', 'ρ = p / (R T)', `ρ = ${f(pPa(pa))} / (${f(G.R)} × ${f(Ta)})`, `ρ = ${f(rho)} ${u.rho}`, U.id === 'SI' ? 'p in Pa.' : 'p in lb/ft² (psi × 144).');
        if (solve === 'm') {
          V = volumeOf(p, U, st);
          if (!(V > 0)) return fail(['Tank volume must be positive.'], warn, st.list);
          m = rho * V;
          st.add('Mass of gas in the tank', 'm = ρ V', `m = ${f(rho)} × ${f(V)}`, `m = ${f(m)} ${u.m}`, '');
        } else if (solve === 'V') {
          if (!(p.mass > 0)) return fail(['Mass must be positive.'], warn, st.list);
          m = p.mass; V = m / rho;
          st.add('Volume occupied by the gas', 'V = m / ρ', `V = ${f(m)} / ${f(rho)}`, `V = ${f(V)} ${u.V}`, '');
        }
      } else if (solve === 'p') {
        if (!(p.rho > 0)) return fail(['Density must be positive.']);
        rho = p.rho; lawStep();
        const pp = rho * G.R * Ta; pa = pp / u.pF;
        st.add('Absolute pressure', 'p = ρ R T', `p = ${f(rho)} × ${f(G.R)} × ${f(Ta)}`, `p = ${f(pp)} ${U.id === 'SI' ? 'Pa' : 'psf'} = ${f(pa)} ${u.pabs}`, '');
      } else {
        if (!(p.rho > 0)) return fail(['Density must be positive.']);
        rho = p.rho; lawStep();
        Ta = pPa(pa) / (rho * G.R);
        st.add('Absolute temperature', 'T = p / (ρ R)', `T = ${f(pPa(pa))} / (${f(rho)} × ${f(G.R)})`, `T = ${f(Ta)} ${u.Ta} = ${f(Ta - u.Toff)} ${u.T}`, '');
      }
      const gam = rho * u.g;
      st.add('Specific weight and specific volume', 'γ = ρ g ,  v = 1/ρ', `γ = ${f(rho)} × ${f(u.g)}`, `γ = ${f(gam)} ${u.gamN},  v = ${f(1 / rho)} ${u.sv}`, '');
      out.push({ k: 'Density ρ', v: rho, u: u.rho, hl: solve !== 'p' && solve !== 'T' }, { k: 'Specific weight γ', v: gam, u: u.gamN, hl: solve === 'rho' }, { k: 'Specific volume v', v: 1 / rho, u: u.sv });
      out.push({ k: 'Absolute pressure p', v: pa, u: u.pabs, hl: solve === 'p' }, { k: 'Absolute temperature T', v: Ta, u: u.Ta, hl: solve === 'T' }, { k: 'Temperature', v: Ta - u.Toff, u: u.T });
      if (V !== null) {
        const W = m * u.g;
        st.add('Weight of the gas', 'W = m g', `W = ${f(m)} × ${f(u.g)}`, `W = ${f(W)} ${u.W}`, '');
        out.push({ k: 'Volume V', v: V, u: u.V, hl: solve === 'V' }, { k: 'Mass m', v: m, u: u.m, hl: solve === 'm' }, { k: 'Weight W', v: W, u: u.W, hl: solve === 'm' });
      }
      out.push({ k: 'Gas constant R', v: G.R, u: u.R });
      return { ok: true, err: [], warn, steps: st.list, out, status: { cls: 'ok', text: `${G.name}: ρ = ${f(rho)} ${u.rho}` }, geo: { topic: T, V } };
    }

    /* ---------------- Gas processes / rigid tank ------------------------ */
    if (T === 'proc') {
      const G = gasR(p, U), k = G.k;
      const p1 = p.p1, T1 = p.T1 + u.Toff;
      if (!(p1 > 0) || !(T1 > 0)) return fail(['Initial absolute pressure and temperature must be positive.']);
      st.add('Initial state (absolute)', 'p₁ , T₁', '', `p₁ = ${f(p1)} ${u.pabs},  T₁ = ${f(T1)} ${u.Ta}`, `${G.name}: R = ${f(G.R)} ${u.R}, k = ${f(k)}.`);
      const rhoOf = (pp, TT) => (pp * u.pF) / (G.R * TT);
      const rho1 = rhoOf(p1, T1);
      st.add('Initial density', 'ρ₁ = p₁ / (R T₁)', `ρ₁ = ${f(p1 * u.pF)} / (${f(G.R)} × ${f(T1)})`, `ρ₁ = ${f(rho1)} ${u.rho}`, '');
      let p2, T2, Vr, txt;
      const kind = p.proc;
      if (kind === 'isoT' || kind === 'isen') {
        if (p.spec === 'p2') { p2 = p.p2; if (!(p2 > 0)) return fail(['Final pressure must be positive.']); Vr = kind === 'isoT' ? p1 / p2 : Math.pow(p1 / p2, 1 / k); }
        else { Vr = p.Vr; if (!(Vr > 0)) return fail(['Volume ratio must be positive.']); p2 = kind === 'isoT' ? p1 / Vr : p1 * Math.pow(1 / Vr, k); }
        if (kind === 'isoT') {
          T2 = T1;
          st.add('Isothermal process (Boyle’s law)', 'p₁V₁ = p₂V₂', p.spec === 'p2' ? `V₂/V₁ = p₁/p₂ = ${f(p1)}/${f(p2)}` : `p₂ = p₁ (V₁/V₂) = ${f(p1)} / ${f(Vr)}`, `p₂ = ${f(p2)} ${u.pabs},  V₂/V₁ = ${f(Vr)}`, 'Temperature stays constant.');
          st.add('Isothermal bulk modulus', 'E = p', '', `E₁ = ${f(p1)} ${u.p},  E₂ = ${f(p2)} ${u.p}`, 'For an isothermal gas the bulk modulus equals the absolute pressure.');
        } else {
          T2 = T1 * Math.pow(p2 / p1, (k - 1) / k);
          st.add('Isentropic (adiabatic, frictionless) process', 'p₁V₁ᵏ = p₂V₂ᵏ', p.spec === 'p2' ? `V₂/V₁ = (p₁/p₂)^(1/k) = (${f(p1)}/${f(p2)})^(1/${f(k)})` : `p₂ = p₁ (V₁/V₂)ᵏ = ${f(p1)} × (1/${f(Vr)})^${f(k)}`, `p₂ = ${f(p2)} ${u.pabs},  V₂/V₁ = ${f(Vr)}`, '');
          st.add('Final temperature', 'T₂/T₁ = (p₂/p₁)^((k−1)/k)', `T₂ = ${f(T1)} × (${f(p2)}/${f(p1)})^(${f(k - 1)}/${f(k)})`, `T₂ = ${f(T2)} ${u.Ta} = ${f(T2 - u.Toff)} ${u.T}`, '');
          st.add('Isentropic bulk modulus', 'E = k p', `E₁ = ${f(k)} × ${f(p1)} ;  E₂ = ${f(k)} × ${f(p2)}`, `E₁ = ${f(k * p1)} ${u.p},  E₂ = ${f(k * p2)} ${u.p}`, '');
        }
        txt = `p₂ = ${f(p2)} ${u.pabs}`;
      } else if (kind === 'isoV') {
        Vr = 1;
        if (p.spec === 'p2') { p2 = p.p2; if (!(p2 > 0)) return fail(['Final pressure must be positive.']); T2 = T1 * p2 / p1; st.add('Constant volume (rigid tank)', 'p₁/T₁ = p₂/T₂', `T₂ = ${f(T1)} × ${f(p2)}/${f(p1)}`, `T₂ = ${f(T2)} ${u.Ta} = ${f(T2 - u.Toff)} ${u.T}`, 'Same mass, same volume.'); }
        else { T2 = p.T2 + u.Toff; if (!(T2 > 0)) return fail(['Final temperature must be above absolute zero.']); p2 = p1 * T2 / T1; st.add('Constant volume (rigid tank)', 'p₁/T₁ = p₂/T₂', `p₂ = ${f(p1)} × ${f(T2)}/${f(T1)}`, `p₂ = ${f(p2)} ${u.pabs}`, 'Same mass, same volume.'); }
        txt = `p₂ = ${f(p2)} ${u.pabs}, T₂ = ${f(T2 - u.Toff)} ${u.T}`;
      } else if (kind === 'isoP') {
        p2 = p1; T2 = p.T2 + u.Toff; if (!(T2 > 0)) return fail(['Final temperature must be above absolute zero.']);
        Vr = T2 / T1;
        st.add('Constant pressure (Charles’s law)', 'V₁/T₁ = V₂/T₂', `V₂/V₁ = ${f(T2)}/${f(T1)}`, `V₂/V₁ = ${f(Vr)}`, '');
        txt = `V₂/V₁ = ${f(Vr)}`;
      } else {
        // rigid tank, mass added or removed
        let V;
        if (p.vshape === 'fromM') {
          V = p.m1 / rho1;
          st.add('Tank volume from the initial mass', 'V = m₁ / ρ₁', `V = ${f(p.m1)} / ${f(rho1)}`, `V = ${f(V)} ${u.V}`, '');
        } else V = volumeOf(p, U, st);
        if (!(V > 0)) return fail(['Tank volume must be positive.'], warn, st.list);
        const m1 = rho1 * V;
        T2 = p.T2 + u.Toff; if (!(T2 > 0)) return fail(['Final temperature must be above absolute zero.']);
        st.add('Initial mass', 'm₁ = ρ₁ V', `m₁ = ${f(rho1)} × ${f(V)}`, `m₁ = ${f(m1)} ${u.m}`, '');
        let m2;
        if (p.spec === 'p2') {
          p2 = p.p2; if (!(p2 > 0)) return fail(['Final pressure must be positive.']);
          m2 = rhoOf(p2, T2) * V;
          st.add('Final mass', 'm₂ = p₂V / (R T₂)', `m₂ = ${f(p2 * u.pF)} × ${f(V)} / (${f(G.R)} × ${f(T2)})`, `m₂ = ${f(m2)} ${u.m}`, '');
        } else {
          m2 = m1 + p.dm; if (!(m2 > 0)) return fail(['More mass removed than the tank holds.'], warn, st.list);
          p2 = (m2 * G.R * T2) / V / u.pF;
          st.add('Final pressure', 'p₂ = m₂ R T₂ / V', `p₂ = ${f(m2)} × ${f(G.R)} × ${f(T2)} / ${f(V)}`, `p₂ = ${f(p2)} ${u.pabs}`, `m₂ = m₁ ${p.dm >= 0 ? '+' : '−'} ${f(Math.abs(p.dm))} = ${f(m2)} ${u.m}.`);
        }
        const dm = m2 - m1;
        st.add(dm >= 0 ? 'Mass added' : 'Mass removed', 'Δm = m₂ − m₁', `Δm = ${f(m2)} − ${f(m1)}`, `Δm = ${f(dm)} ${u.m}`, '');
        out.push({ k: 'Tank volume V', v: V, u: u.V }, { k: 'Initial mass m₁', v: m1, u: u.m }, { k: 'Final mass m₂', v: m2, u: u.m }, { k: 'Mass change Δm', v: dm, u: u.m, hl: true });
        Vr = 1; txt = `Δm = ${f(dm)} ${u.m}, p₂ = ${f(p2)} ${u.pabs}`;
      }
      const rho2 = rhoOf(p2, T2);
      st.add('Final density', 'ρ₂ = p₂ / (R T₂)', `ρ₂ = ${f(p2 * u.pF)} / (${f(G.R)} × ${f(T2)})`, `ρ₂ = ${f(rho2)} ${u.rho}`, '');
      out.push({ k: 'Final pressure p₂', v: p2, u: u.pabs, hl: true }, { k: 'Final temperature T₂', v: T2 - u.Toff, u: u.T, hl: kind !== 'isoT' }, { k: 'T₂ (absolute)', v: T2, u: u.Ta }, { k: 'Volume ratio V₂/V₁', v: Vr, u: '' });
      out.push({ k: 'Initial density ρ₁', v: rho1, u: u.rho }, { k: 'Final density ρ₂', v: rho2, u: u.rho }, { k: 'Density change Δρ', v: rho2 - rho1, u: u.rho, hl: true });
      if (kind === 'isoT') out.push({ k: 'Bulk modulus E₂ (= p₂)', v: p2, u: u.p });
      if (kind === 'isen') out.push({ k: 'Bulk modulus E₂ (= k p₂)', v: k * p2, u: u.p });
      return { ok: true, err: [], warn, steps: st.list, out, status: { cls: 'ok', text: txt }, geo: { topic: T, Vr, kind } };
    }

    /* ---------------- Bulk modulus of a liquid ------------------------- */
    if (T === 'bulk') {
      const s = p.solve;
      const V1 = p.V1;
      if (!(V1 > 0)) return fail(['Initial volume must be positive.']);
      let E = p.E * u.EF, dp = p.dp * u.dpF, dV = p.dV;
      st.add('Bulk modulus of elasticity', 'E = −Δp / (ΔV/V₁)', '', '', 'A pressure increase Δp causes a volume decrease ΔV; E is the stiffness of the liquid.');
      if (s === 'E') {
        if (!(dV > 0) || !(dV < V1)) return fail(['Volume decrease ΔV must be between 0 and V₁.']);
        if (!(dp > 0)) return fail(['Pressure increase must be positive.']);
        E = dp / (dV / V1);
        st.add('Bulk modulus', 'E = Δp V₁ / ΔV', `E = ${f(p.dp)} × ${f(V1)} / ${f(dV)}`, `E = ${f(E / u.EF)} ${u.E}`, `Δp in ${u.dp}.`);
      } else if (s === 'dV') {
        if (!(E > 0) || !(dp > 0)) return fail(['E and Δp must be positive.']);
        dV = V1 * dp / E;
        st.add('Volume decrease', 'ΔV = V₁ Δp / E', `ΔV = ${f(V1)} × ${f(dp)} / ${f(E)}`, `ΔV = ${f(dV)} ${u.V}`, `Pressures in ${U.id === 'SI' ? 'Pa' : 'psf'}.`);
      } else {
        if (!(E > 0)) return fail(['E must be positive.']);
        if (!(dV > 0) || !(dV < V1)) return fail(['Volume decrease ΔV must be between 0 and V₁.']);
        dp = E * dV / V1;
        st.add('Pressure increase needed', 'Δp = E ΔV / V₁', `Δp = ${f(p.E)} ${u.E} × ${f(dV)} / ${f(V1)}`, `Δp = ${f(dp / u.dpF)} ${u.dp}`, '');
      }
      const strain = dV / V1, V2 = V1 - dV;
      st.add('Volumetric strain and final volume', 'ΔV/V₁ ,  V₂ = V₁ − ΔV', `${f(dV)} / ${f(V1)} ;  V₂ = ${f(V1)} − ${f(dV)}`, `ΔV/V₁ = ${f(strain)} (${f(strain * 100)} %),  V₂ = ${f(V2)} ${u.V}`, '');
      const rho1 = (p.sg || 1) * u.rhoW, rho2 = rho1 * V1 / V2;
      st.add('Density after compression (mass conserved)', 'ρ₂ = ρ₁ V₁ / V₂', `ρ₂ = ${f(rho1)} × ${f(V1)} / ${f(V2)}`, `ρ₂ = ${f(rho2)} ${u.rho},  γ₂ = ${f(rho2 * u.g / u.gamF)} ${u.gam}`, '');
      const c = Math.sqrt(E / rho1);
      st.add('Speed of sound in the liquid', 'c = √(E/ρ)', `c = √(${f(E)} / ${f(rho1)})`, `c = ${f(c)} ${u.vel}`, 'Celerity of a pressure wave (used in water hammer).');
      out.push({ k: 'Bulk modulus E', v: E / u.EF, u: u.E, hl: s === 'E' }, { k: 'Pressure increase Δp', v: dp / u.dpF, u: u.dp, hl: s === 'dp' }, { k: 'Volume decrease ΔV', v: dV, u: u.V, hl: s === 'dV' }, { k: 'Volumetric strain ΔV/V₁', v: strain, u: '' }, { k: 'Final volume V₂', v: V2, u: u.V });
      out.push({ k: 'Initial density ρ₁', v: rho1, u: u.rho }, { k: 'Final density ρ₂', v: rho2, u: u.rho }, { k: 'Final specific weight γ₂', v: rho2 * u.g / u.gamF, u: u.gam }, { k: 'Compressibility β = 1/E', v: 1 / (E / u.EF), u: '1/' + u.E }, { k: 'Speed of sound c', v: c, u: u.vel });
      return { ok: true, err: [], warn, steps: st.list, out, status: { cls: 'ok', text: s === 'E' ? `E = ${f(E / u.EF)} ${u.E}` : s === 'dV' ? `ΔV = ${f(dV)} ${u.V}` : `Δp = ${f(dp / u.dpF)} ${u.dp}` }, geo: { topic: T, strain } };
    }

    /* ---------------- Viscosity units ---------------------------------- */
    if (T === 'visc') {
      const sg = p.sg; if (!(sg > 0)) return fail(['Specific gravity must be positive.']);
      const rho = sg * 1000;
      if (!(p.val > 0)) return fail(['Enter a positive value.']);
      let mu, nu;
      st.add('Density of the liquid (SI)', 'ρ = S × 1000 kg/m³', `ρ = ${f(sg)} × 1000`, `ρ = ${f(rho)} kg/m³`, 'All conversions are done in SI, then expressed in the other units.');
      if (p.from === 'mu') {
        const [fac, nm] = MU_U[p.muU] || MU_U.Pas;
        mu = p.val * fac;
        st.add('Dynamic viscosity in Pa·s', `μ = value × factor`, `μ = ${f(p.val)} ${nm} × ${f(fac)}`, `μ = ${f(mu)} Pa·s`, '1 P = 0.1 Pa·s; 1 cP = 0.001 Pa·s; 1 lb·s/ft² = 47.88 Pa·s.');
        nu = mu / rho;
        st.add('Kinematic viscosity', 'ν = μ / ρ', `ν = ${f(mu)} / ${f(rho)}`, `ν = ${f(nu)} m²/s`, '');
      } else if (p.from === 'nu') {
        const [fac, nm] = NU_U[p.nuU] || NU_U.m2s;
        nu = p.val * fac;
        st.add('Kinematic viscosity in m²/s', 'ν = value × factor', `ν = ${f(p.val)} ${nm} × ${f(fac)}`, `ν = ${f(nu)} m²/s`, '1 St = 10⁻⁴ m²/s; 1 cSt = 10⁻⁶ m²/s; 1 ft²/s = 0.09290 m²/s.');
        mu = nu * rho;
        st.add('Dynamic viscosity', 'μ = ρ ν', `μ = ${f(rho)} × ${f(nu)}`, `μ = ${f(mu)} Pa·s`, '');
      } else {
        const t = p.val;
        const nuSt = t <= 100 ? 0.0022 * t - 1.80 / t : 0.0022 * t - 1.35 / t;
        if (!(nuSt > 0)) return fail(['Saybolt time too short for the formula (needs t ≳ 29 s).']);
        st.add('Saybolt Universal seconds to stokes', t <= 100 ? 'ν = 0.0022 t − 1.80/t  (t ≤ 100 s)' : 'ν = 0.0022 t − 1.35/t  (t > 100 s)', `ν = 0.0022 × ${f(t)} − ${t <= 100 ? '1.80' : '1.35'}/${f(t)}`, `ν = ${f(nuSt)} St`, 'Empirical conversion (Schaum 1.9).');
        nu = nuSt * 1e-4; mu = nu * rho;
        st.add('Kinematic and dynamic viscosity in SI', 'ν = St × 10⁻⁴ ,  μ = ρ ν', `ν = ${f(nuSt)} × 10⁻⁴ ;  μ = ${f(rho)} × ${f(nu)}`, `ν = ${f(nu)} m²/s,  μ = ${f(mu)} Pa·s`, '');
      }
      out.push({ k: 'μ', v: mu, u: 'Pa·s', hl: true }, { k: 'μ', v: mu * 10, u: 'poise' }, { k: 'μ', v: mu * 1000, u: 'cP' }, { k: 'μ', v: mu / 47.880, u: 'lb·s/ft²', hl: true });
      out.push({ k: 'ν', v: nu, u: 'm²/s', hl: true }, { k: 'ν', v: nu * 1e4, u: 'stokes' }, { k: 'ν', v: nu * 1e6, u: 'cSt' }, { k: 'ν', v: nu / 0.09290304, u: 'ft²/s', hl: true });
      out.push({ k: 'Density ρ', v: rho, u: 'kg/m³' }, { k: 'Density ρ', v: sg * 1.94, u: 'slug/ft³' });
      return { ok: true, err: [], warn, steps: st.list, out, status: { cls: 'ok', text: `μ = ${f(mu)} Pa·s, ν = ${f(nu)} m²/s` }, geo: { topic: T } };
    }

    /* ---------------- Viscosity vs temperature -------------------------- */
    if (T === 'vlaw') {
      const law = p.law, Toff = u.Toff;
      const nmLaw = law === 'andrade' ? 'Andrade (liquids): μ = B e^(C/T)' : 'Sutherland (gases): μ = B T^(3/2) / (T + C)';
      const muOf = (B, C, Ta) => (law === 'andrade' ? B * Math.exp(C / Ta) : (B * Math.pow(Ta, 1.5)) / (Ta + C));
      let B, C;
      st.add('Empirical viscosity law', nmLaw, '', '', 'T is the absolute temperature.');
      if (p.vmode === 'fit') {
        const T1 = p.vT1 + Toff, T2 = p.vT2 + Toff, m1 = p.mu1, m2 = p.mu2;
        if (!(T1 > 0 && T2 > 0) || Math.abs(T1 - T2) < 1e-9) return fail(['Enter two different temperatures above absolute zero.']);
        if (!(m1 > 0 && m2 > 0)) return fail(['Viscosities must be positive.']);
        st.add('Absolute temperatures', 'T = T + ' + f(Toff), '', `T₁ = ${f(T1)} ${u.Ta},  T₂ = ${f(T2)} ${u.Ta}`, '');
        if (law === 'andrade') {
          C = Math.log(m1 / m2) / (1 / T1 - 1 / T2);
          B = m1 * Math.exp(-C / T1);
          st.add('Constant C (divide the two equations)', 'C = ln(μ₁/μ₂) / (1/T₁ − 1/T₂)', `C = ln(${f(m1)}/${f(m2)}) / (1/${f(T1)} − 1/${f(T2)})`, `C = ${f(C)} ${u.Ta}`, '');
          st.add('Constant B', 'B = μ₁ e^(−C/T₁)', `B = ${f(m1)} × e^(−${f(C)}/${f(T1)})`, `B = ${f(B)} ${u.mu}`, '');
        } else {
          const a1 = Math.pow(T1, 1.5), a2 = Math.pow(T2, 1.5);
          C = (m2 * T2 * a1 - m1 * T1 * a2) / (m1 * a2 - m2 * a1);
          B = (m1 * (T1 + C)) / a1;
          st.add('Constant C (equate B from both points)', 'C = (μ₂T₂T₁^1.5 − μ₁T₁T₂^1.5) / (μ₁T₂^1.5 − μ₂T₁^1.5)', `C = (${f(m2)}×${f(T2)}×${f(a1)} − ${f(m1)}×${f(T1)}×${f(a2)}) / (${f(m1)}×${f(a2)} − ${f(m2)}×${f(a1)})`, `C = ${f(C)} ${u.Ta}`, '');
          st.add('Constant B', 'B = μ₁ (T₁ + C) / T₁^(3/2)', `B = ${f(m1)} × (${f(T1)} + ${f(C)}) / ${f(T1)}^1.5`, `B = ${f(B)} ${u.mu}/${u.Ta}^½`, '');
        }
      } else { B = p.B; C = p.C; if (!(B > 0)) return fail(['B must be positive.']); }
      const Tq = p.Tq + Toff;
      if (!(Tq > 0)) return fail(['Temperature must be above absolute zero.']);
      const mq = muOf(B, C, Tq);
      st.add(`Viscosity at ${f(p.Tq)} ${u.T}`, law === 'andrade' ? 'μ = B e^(C/T)' : 'μ = B T^1.5 / (T + C)', law === 'andrade' ? `μ = ${f(B)} × e^(${f(C)}/${f(Tq)})` : `μ = ${f(B)} × ${f(Tq)}^1.5 / (${f(Tq)} + ${f(C)})`, `μ = ${f(mq)} ${u.mu}`, '');
      if (p.Tq2On) { const Tq2 = p.Tq2 + Toff, mq2 = muOf(B, C, Tq2); st.add(`Viscosity at ${f(p.Tq2)} ${u.T}`, '', '', `μ = ${f(mq2)} ${u.mu}`, ''); out.push({ k: `μ at ${f(p.Tq2)} ${u.T}`, v: mq2, u: u.mu, hl: true }); }
      out.unshift({ k: 'Constant B', v: B, u: law === 'andrade' ? u.mu : `${u.mu}/${u.Ta}^½`, hl: p.vmode === 'fit' }, { k: 'Constant C', v: C, u: u.Ta, hl: p.vmode === 'fit' }, { k: `μ at ${f(p.Tq)} ${u.T}`, v: mq, u: u.mu, hl: true });
      const curve = [];
      const Tx = p.Tq2On ? [Tq, p.Tq2 + Toff] : [Tq];
      const Ta0 = Math.min(...Tx, p.vmode === 'fit' ? Math.min(p.vT1, p.vT2) + Toff : Tq) - 20, Ta1 = Math.max(...Tx, p.vmode === 'fit' ? Math.max(p.vT1, p.vT2) + Toff : Tq) + 20;
      for (let i = 0; i <= 40; i++) { const Ta = Math.max(1, Ta0 + ((Ta1 - Ta0) * i) / 40); curve.push([Ta - Toff, muOf(B, C, Ta)]); }
      return { ok: true, err: [], warn, steps: st.list, out, status: { cls: 'ok', text: `B = ${f(B)}, C = ${f(C)} ${u.Ta}` }, geo: { topic: T, curve, pts: p.vmode === 'fit' ? [[p.vT1, p.mu1], [p.vT2, p.mu2]] : [], q: [p.Tq, mq] } };
    }

    /* ---------------- Surface tension ---------------------------------- */
    if (T === 'surf') {
      const c = p.scase, sv = p.solveS;
      const sig = p.sigma, d = p.d * u.lenF;
      const dPu = u.dP;
      if (c === 'ring') {
        const Do = p.Do * u.lenF, Di = p.Di * u.lenF;
        if (!(Do > 0 && Di >= 0 && Di <= Do)) return fail(['Ring diameters must satisfy 0 ≤ Dᵢ ≤ D₀.']);
        const Lw = PI * (Do + Di);
        st.add('Wetted length of the ring (inner + outer edge)', 'L = π(D₀ + Dᵢ)', `L = π × (${f(Do)} + ${f(Di)})`, `L = ${f(Lw)} ${U.id === 'SI' ? 'm' : 'ft'}`, 'A thin wire ring has two contact lines; for a thin ring L ≈ 2πD.');
        let P, sg2 = sig;
        if (sv === 'sigma') {
          P = p.Pring; sg2 = (P - p.Wring) / Lw;
          st.add('Surface tension from the pull force', 'P = W + σ L  →  σ = (P − W)/L', `σ = (${f(P)} − ${f(p.Wring)}) / ${f(Lw)}`, `σ = ${f(sg2)} ${u.sig}`, '');
        } else {
          P = p.Wring + sig * Lw;
          st.add('Force to lift the ring off the surface', 'P = W + σ L', `P = ${f(p.Wring)} + ${f(sig)} × ${f(Lw)}`, `P = ${f(P)} ${u.W}`, 'The surface-tension force acts straight down along both contact lines just before release.');
        }
        out.push({ k: 'Pull force P', v: P, u: u.W, hl: sv !== 'sigma' }, { k: 'Surface tension σ', v: sg2, u: u.sig, hl: sv === 'sigma' }, { k: 'Surface-tension force σL', v: sg2 * Lw, u: u.W }, { k: 'Wetted length L', v: Lw, u: U.id === 'SI' ? 'm' : 'ft' });
        return { ok: true, err: [], warn, steps: st.list, out, status: { cls: 'ok', text: sv === 'sigma' ? `σ = ${f(sg2)} ${u.sig}` : `P = ${f(P)} ${u.W}` }, geo: { topic: T, c } };
      }
      if (c === 'float') {
        const gs = p.sgS * u.rhoW * u.g; // N/m³ or lb/ft³
        const obj = p.fobj;
        st.add('Specific weight of the object', 'γ_s = S ρ_w g', `γ_s = ${f(p.sgS)} × ${f(u.rhoW)} × ${f(u.g)}`, `γ_s = ${f(gs)} ${u.gamN}`, '');
        if (obj === 'sphere') {
          const dmax = Math.sqrt((6 * sig) / gs);
          st.add('Largest sphere held up by surface tension', 'σ (πd) = γ_s (πd³/6)  →  d = √(6σ/γ_s)', `d = √(6 × ${f(sig)} / ${f(gs)})`, `d = ${f(dmax)} ${U.id === 'SI' ? 'm' : 'ft'} = ${f(dmax / u.lenF)} ${u.len}`, 'Surface tension acts vertically around the waterline circle of diameter d (contact angle taken as 0, the most favourable case).');
          out.push({ k: 'Largest diameter d', v: dmax / u.lenF, u: u.len, hl: true }, { k: 'Its weight', v: gs * PI * dmax ** 3 / 6, u: u.W });
          return { ok: true, err: [], warn, steps: st.list, out, status: { cls: 'ok', text: `d_max = ${f(dmax / u.lenF)} ${u.len}` }, geo: { topic: T, c, obj, d: dmax } };
        }
        if (obj === 'needle') {
          const dmax = Math.sqrt((8 * sig) / (PI * gs));
          st.add('Largest needle (cylinder) that floats', '2σL = γ_s (πd²/4)L  →  d = √(8σ/(πγ_s))', `d = √(8 × ${f(sig)} / (π × ${f(gs)}))`, `d = ${f(dmax)} ${U.id === 'SI' ? 'm' : 'ft'} = ${f(dmax / u.lenF)} ${u.len}`, 'Surface tension pulls up along both sides of the needle; length cancels.');
          out.push({ k: 'Largest diameter d', v: dmax / u.lenF, u: u.len, hl: true });
          return { ok: true, err: [], warn, steps: st.list, out, status: { cls: 'ok', text: `d_max = ${f(dmax / u.lenF)} ${u.len}` }, geo: { topic: T, c, obj, d: dmax } };
        }
        // legs / wire supporting a weight
        const W = p.Wobj;
        const Lreq = W / (2 * sig);
        st.add('Contact length needed to support the weight', 'W = 2σL  →  L = W/(2σ)', `L = ${f(W)} / (2 × ${f(sig)})`, `L = ${f(Lreq)} ${U.id === 'SI' ? 'm' : 'ft'} = ${f(Lreq / u.lenF)} ${u.len}`, 'Surface tension acts on both sides of each leg (or wire) along its contact length.');
        out.push({ k: 'Required total contact length L', v: Lreq / u.lenF, u: u.len, hl: true }, { k: 'Weight W', v: W, u: u.W });
        return { ok: true, err: [], warn, steps: st.list, out, status: { cls: 'ok', text: `L = ${f(Lreq / u.lenF)} ${u.len}` }, geo: { topic: T, c, obj } };
      }
      // drop / bubble / gas bubble / jet
      const K = c === 'drop' || c === 'gasb' ? 4 : c === 'bubble' ? 8 : 2; // Δp = K σ / d
      const form = c === 'drop' ? 'Δp = 2σ/r = 4σ/d' : c === 'gasb' ? 'Δp = 2σ/r = 4σ/d  (one interface)' : c === 'bubble' ? 'Δp = 4σ/r = 8σ/d  (soap film: two surfaces)' : 'Δp = σ/r = 2σ/d  (cylinder)';
      const nm = { drop: 'Liquid droplet', gasb: 'Gas bubble inside a liquid', bubble: 'Soap bubble in air', jet: 'Cylindrical liquid jet' }[c];
      st.add(`${nm}: pressure difference across the surface`, form, '', '', 'Force balance on half the drop/bubble/jet: pressure × projected area = σ × cut perimeter.');
      let dP, sg2 = sig, dd = d;
      if (sv === 'dp') { if (!(sig > 0 && d > 0)) return fail(['σ and d must be positive.']); dP = (K * sig) / d; st.add('Pressure difference', form.split('  ')[0], `Δp = ${K} × ${f(sig)} / ${f(d)}`, `Δp = ${f(dP)} ${dPu}`, `d = ${f(p.d)} ${u.len} = ${f(d)} ${U.id === 'SI' ? 'm' : 'ft'}.`); }
      else if (sv === 'sigma') { dP = p.dPin; if (!(dP > 0 && d > 0)) return fail(['Δp and d must be positive.']); sg2 = (dP * d) / K; st.add('Surface tension', `σ = Δp d / ${K}`, `σ = ${f(dP)} × ${f(d)} / ${K}`, `σ = ${f(sg2)} ${u.sig}`, ''); }
      else { dP = p.dPin; if (!(dP > 0 && sig > 0)) return fail(['Δp and σ must be positive.']); dd = (K * sig) / dP; st.add('Diameter', `d = ${K}σ / Δp`, `d = ${K} × ${f(sig)} / ${f(dP)}`, `d = ${f(dd)} ${U.id === 'SI' ? 'm' : 'ft'} = ${f(dd / u.lenF)} ${u.len}`, ''); }
      out.push({ k: 'Pressure difference Δp', v: dP, u: dPu, hl: sv === 'dp' });
      if (U.id === 'SI') out.push({ k: 'Δp', v: dP / 1000, u: 'kPa' }); else out.push({ k: 'Δp', v: dP / 144, u: 'psi' });
      out.push({ k: 'Surface tension σ', v: sg2, u: u.sig, hl: sv === 'sigma' }, { k: 'Diameter d', v: dd / u.lenF, u: u.len, hl: sv === 'd' });
      return { ok: true, err: [], warn, steps: st.list, out, status: { cls: 'ok', text: `Δp = ${f(dP)} ${dPu}` }, geo: { topic: T, c, d: dd } };
    }

    /* ---------------- Capillarity --------------------------------------- */
    if (T === 'cap') {
      const gam = p.sgL * u.rhoW * u.g; // N/m³ or lb/ft³
      const geom = p.cgeom, sv = p.solveC;
      const th = p.theta * DEG;
      const Kg = geom === 'plates' ? 2 : 4; // h = Kg σ cosθ / (γ w)
      const wName = geom === 'tube' ? 'd' : geom === 'plates' ? 't' : '(D₀ − Dᵢ)';
      const form = geom === 'tube' ? 'h = 4σ cosθ / (γ d)' : geom === 'plates' ? 'h = 2σ cosθ / (γ t)' : 'h = 4σ cosθ / (γ (D₀ − Dᵢ))';
      st.add('Unit weight of the liquid', 'γ = S ρ_w g', `γ = ${f(p.sgL)} × ${f(u.rhoW)} × ${f(u.g)}`, `γ = ${f(gam)} ${u.gamN}`, '');
      st.add('Capillary rise (force balance on the raised column)', form, '', '', geom === 'tube' ? 'σ cosθ (πd) = γ h (πd²/4).' : geom === 'plates' ? 'Per unit length of plate: 2σ cosθ = γ h t.' : 'σ cosθ π(D₀ + Dᵢ) = γ h π(D₀² − Dᵢ²)/4.');
      const wOf = () => (geom === 'annulus' ? (p.Do - p.Di) * u.lenF : p.d * u.lenF);
      let h, w = wOf(), sg2 = p.sigma, thd = p.theta;
      if (sv === 'h') {
        if (!(w > 0)) return fail(['Tube diameter / gap must be positive.']);
        h = (Kg * p.sigma * Math.cos(th)) / (gam * w);
        st.add('Height of rise', form, `h = ${Kg} × ${f(p.sigma)} × cos ${f(p.theta)}° / (${f(gam)} × ${f(w)})`, `h = ${f(h)} ${U.id === 'SI' ? 'm' : 'ft'} = ${f(h / u.lenF)} ${u.len}`, h < 0 ? 'Negative: the liquid is depressed (θ > 90°, e.g. mercury on glass).' : '');
      } else {
        h = p.h * u.lenF;
        if (Math.abs(h) < 1e-15) return fail(['Height must not be zero.']);
        if (sv === 'd') {
          w = (Kg * p.sigma * Math.cos(th)) / (gam * h);
          st.add(geom === 'plates' ? 'Gap between plates' : 'Diameter for that rise', `${wName} = ${Kg}σ cosθ / (γ h)`, `${wName} = ${Kg} × ${f(p.sigma)} × cos ${f(p.theta)}° / (${f(gam)} × ${f(h)})`, `${wName} = ${f(w / u.lenF)} ${u.len}`, '');
          if (!(w > 0)) return fail(['The rise and contact angle are inconsistent (a rise needs θ < 90°, a depression θ > 90°).'], warn, st.list);
        } else if (sv === 'sigma') {
          sg2 = (gam * h * w) / (Kg * Math.cos(th));
          st.add('Surface tension', `σ = γ h ${wName} / (${Kg} cosθ)`, `σ = ${f(gam)} × ${f(h)} × ${f(w)} / (${Kg} × cos ${f(p.theta)}°)`, `σ = ${f(sg2)} ${u.sig}`, '');
        } else {
          const cth = (gam * h * w) / (Kg * p.sigma);
          if (Math.abs(cth) > 1) return fail(['No contact angle gives that rise (cos θ would exceed 1).'], warn, st.list);
          thd = Math.acos(cth) / DEG;
          st.add('Contact angle', `cosθ = γ h ${wName} / (${Kg}σ)`, `cosθ = ${f(gam)} × ${f(h)} × ${f(w)} / (${Kg} × ${f(p.sigma)})`, `θ = ${f(thd)}°`, '');
        }
      }
      let Lt = null;
      if (p.tilt > 0) {
        Lt = h / Math.cos(p.tilt * DEG);
        st.add('Length of liquid along a tilted tube', 'L = h / cos α', `L = ${f(h)} / cos ${f(p.tilt)}°`, `L = ${f(Lt / u.lenF)} ${u.len}`, 'The vertical rise h is unchanged; the column is longer along the tube (α measured from the vertical).');
      }
      out.push({ k: h >= 0 ? 'Capillary rise h' : 'Capillary depression h', v: h / u.lenF, u: u.len, hl: sv === 'h' }, { k: geom === 'plates' ? 'Gap t' : geom === 'annulus' ? 'D₀ − Dᵢ' : 'Diameter d', v: w / u.lenF, u: u.len, hl: sv === 'd' }, { k: 'Surface tension σ', v: sg2, u: u.sig, hl: sv === 'sigma' }, { k: 'Contact angle θ', v: thd, u: '°', hl: sv === 'theta' });
      if (Lt !== null) out.push({ k: 'Length along tilted tube L', v: Lt / u.lenF, u: u.len, hl: true });
      return { ok: true, err: [], warn, steps: st.list, out, status: { cls: h >= 0 ? 'ok' : 'warn', text: `h = ${f(h / u.lenF)} ${u.len}${h < 0 ? ' (depression)' : ''}` }, geo: { topic: T, geom, h, w, th: thd, tilt: p.tilt } };
    }

    /* ---------------- Water tables: vapour pressure, boiling, cavitation, expansion */
    if (T === 'water') {
      const src = p.tbl === 'S' ? 'S' : 'H';
      let rows = WATER[src][U.id];
      const srcName = src === 'S' ? 'Schaum Table 1(C)' : 'Hibbeler Appendix A';
      const sRows = WATER.S[U.id];
      const look = (Tt) => interp(rows, Tt, 0);
      const pvUnit = U.id === 'SI' ? 'kPa' : 'psia';
      const showRow = (Tt, label) => {
        const r = look(Tt);
        if (!r) return null;
        const how = r.exact ? 'table value' : `interpolated between ${f(r.a[0])} and ${f(r.b[0])} ${u.T}`;
        st.add(`${label} — water at ${f(Tt)} ${u.T}`, `${srcName}`, how, `ρ = ${f(r.row[1])} ${u.rho},  μ = ${f(r.row[2])} ${u.mu},  p_v = ${f(r.row[3])} ${pvUnit}`, '');
        return r.row;
      };
      if (p.wtask === 'props' || p.wtask === 'cav') {
        const r = showRow(p.Tw, 'Properties');
        if (!r) return fail([`Temperature outside the table (${rows[0][0]}–${rows[rows.length - 1][0]} ${u.T}).`]);
        const gam = r[1] * u.g, nu = r[2] / r[1];
        const s2 = interp(sRows, p.Tw, 0);
        st.add('Specific weight and kinematic viscosity', 'γ = ρ g ,  ν = μ / ρ', `γ = ${f(r[1])} × ${f(u.g)} ;  ν = ${f(r[2])} / ${f(r[1])}`, `γ = ${f(gam / u.gamF)} ${u.gam},  ν = ${f(nu)} ${u.nu}`, '');
        out.push({ k: 'Density ρ', v: r[1], u: u.rho }, { k: 'Specific weight γ', v: gam / u.gamF, u: u.gam }, { k: 'Dynamic viscosity μ', v: r[2], u: u.mu }, { k: 'Kinematic viscosity ν', v: nu, u: u.nu }, { k: 'Vapour pressure p_v', v: r[3], u: pvUnit, hl: true });
        if (s2) out.push({ k: 'Surface tension σ (Schaum)', v: s2.row[4], u: u.sig }, { k: 'Bulk modulus E (Schaum)', v: U.id === 'SI' ? s2.row[5] / 1e9 : s2.row[5], u: U.id === 'SI' ? 'GPa' : 'psi' });
        if (p.wtask === 'cav') {
          const pv = r[3];
          st.add('Cavitation limit', 'p_min = p_v', '', `p_min = ${f(pv)} ${pvUnit} (absolute)`, 'If the absolute pressure falls to the vapour pressure, the water boils locally and vapour cavities form.');
          const pg = pv - (U.id === 'SI' ? p.patmW : p.patmW);
          st.add('Same limit as a gauge pressure', 'p_gauge = p_v − p_atm', `p = ${f(pv)} − ${f(p.patmW)}`, `p_gauge = ${f(pg)} ${U.id === 'SI' ? 'kPa' : 'psi'}`, 'A vacuum of this size starts cavitation.');
          out.unshift({ k: 'Lowest absolute pressure (no cavitation)', v: pv, u: pvUnit, hl: true }, { k: 'As gauge pressure', v: pg, u: U.id === 'SI' ? 'kPa' : 'psi' });
        }
        return { ok: true, err: [], warn, steps: st.list, out, status: { cls: 'ok', text: `p_v = ${f(r[3])} ${pvUnit} at ${f(p.Tw)} ${u.T}` }, geo: { topic: T, rows, Tq: p.Tw, pv: r[3], pvUnit } };
      }
      if (p.wtask === 'boil') {
        let pa;
        if (p.bby === 'z') {
          const zt = U.id === 'SI' ? p.zb / 1000 : p.zb;
          const A = interp(ATM[U.id], zt, 0);
          if (!A) return fail(['Elevation outside the standard-atmosphere table.']);
          pa = U.id === 'SI' ? A.row[2] : A.row[2] / 144;
          st.add('Atmospheric pressure at that elevation', 'U.S. Standard Atmosphere (Hibbeler App. A)', A.exact ? 'table value' : `interpolated between ${f(A.a[0])} and ${f(A.b[0])} ${U.id === 'SI' ? 'km' : 'ft'}`, `p_atm = ${f(pa)} ${pvUnit}${U.id === 'EN' ? ` (${f(A.row[2])} psf)` : ''}`, '');
          out.push({ k: 'Atmospheric pressure', v: pa, u: pvUnit }, { k: 'Air temperature', v: A.row[1], u: u.T });
        } else { pa = p.pb; st.add('Absolute pressure on the water', 'p', '', `p = ${f(pa)} ${pvUnit}`, ''); }
        const r = interp(rows, pa, 3);
        if (!r) return fail([`That pressure is outside the vapour-pressure table (${rows[0][3]}–${rows[rows.length - 1][3]} ${pvUnit}).`], warn, st.list);
        const Tb = r.row[0];
        st.add('Boiling temperature: where p_v = p', 'interpolate T in the p_v column', r.exact ? 'table value' : `T = ${f(r.a[0])} + (${f(pa)} − ${f(r.a[3])}) / (${f(r.b[3])} − ${f(r.a[3])}) × (${f(r.b[0])} − ${f(r.a[0])})`, `T_boil = ${f(Tb)} ${u.T}`, 'Water boils when its vapour pressure equals the pressure on it.');
        out.unshift({ k: 'Boiling temperature', v: Tb, u: u.T, hl: true });
        return { ok: true, err: [], warn, steps: st.list, out, status: { cls: 'ok', text: `Boils at ${f(Tb)} ${u.T}` }, geo: { topic: T, rows, Tq: Tb, pv: pa, pvUnit } };
      }
      // expansion
      const r1 = showRow(p.Tw, 'State 1'), r2 = showRow(p.Tw2, 'State 2');
      if (!r1 || !r2) return fail([`Temperature outside the table (${rows[0][0]}–${rows[rows.length - 1][0]} ${u.T}).`], warn, st.list);
      const ratio = r1[1] / r2[1];
      st.add('Same mass, new density', 'V₂ = V₁ ρ₁/ρ₂', `V₂/V₁ = ${f(r1[1])} / ${f(r2[1])}`, `V₂/V₁ = ${f(ratio)}`, '');
      const h2 = p.hw * ratio;
      st.add('New depth in a vertical-walled tank or pool', 'h₂ = h₁ ρ₁/ρ₂', `h₂ = ${f(p.hw)} × ${f(ratio)}`, `h₂ = ${f(h2)} ${u.z}`, 'Plan area does not change, so depth scales with volume.');
      out.push({ k: 'Volume ratio V₂/V₁', v: ratio, u: '' }, { k: 'New depth h₂', v: h2, u: u.z, hl: true }, { k: 'Change in depth', v: h2 - p.hw, u: u.z });
      return { ok: true, err: [], warn, steps: st.list, out, status: { cls: 'ok', text: `h₂ = ${f(h2)} ${u.z}` }, geo: { topic: T, rows, Tq: p.Tw2, pv: r2[3], pvUnit, h1: p.hw, h2 } };
    }
    return fail(['Unknown topic.']);
  }

  Object.assign(P0, { props, PU, GASES, WATER, ATM, interpTable: interp, MU_U, NU_U });
})(window);
