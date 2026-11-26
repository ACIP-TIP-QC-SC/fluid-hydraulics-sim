/* =====================================================================
 * PHYSICS — compressible flow (2026-11-25 book-coverage upgrade, stage 6)
 *   gas     ideal-gas states and processes: Δh, Δu, Δs, work, polytropic n
 *   mach    speed of sound, Mach number, Mach cone, time to hear a plane
 *   isen    isentropic flow: stagnation ratios, A/A*, mass flow, section 2
 *   stream  Schaum two-point isentropic equation (p, V and unit weight)
 *   noz     tank + converging or converging–diverging nozzle, back pressure,
 *           choking, shock in the nozzle, design for an exit Mach number
 *   ven     compressible flow through a constriction (Schaum eq. 7)
 *   shock   normal shock, oblique shock (β or θ), Prandtl–Meyer expansion
 *   fanno   adiabatic flow with friction (Darcy f): L_max, exit state, F_f
 *   ray     frictionless flow with heat transfer (Rayleigh)
 *   iso     isothermal flow in a long pipe (Schaum eq. 1): ṁ, p2 or L
 *   pitot   Pitot-static tube in subsonic or supersonic flow
 * Sources: Hibbeler Ch. 13; Schaum's FMH Ch. 11; 2500 Solved Problems Ch. 16.
 * Temperatures: books add 273 (SI) or 460 (English) — the input scale does too.
 * ===================================================================== */
(function (root) {
  'use strict';
  const P0 = root.Physics;
  const f = P0.fmt;
  const PI = Math.PI, DEG = PI / 180, sqrt = Math.sqrt, abs = Math.abs, pow = Math.pow, ln = Math.log;
  function Steps() { const list = []; return { list, add(t, fo, s, r, n) { list.push({ t, f: fo, s, r, n }); } }; }
  const fail = (err, warn, steps) => ({ ok: false, err, warn: warn || [], steps: steps || [], out: [], geo: {} });
  const done = (st, out, warn, status, geo) => ({ ok: true, err: [], warn: warn || [], steps: st.list, out: out.filter((o) => typeof o.v === 'number' && isFinite(o.v)), status, geo });

  const units = (U) => {
    const SI = U.id === 'SI';
    return {
      SI, g: U.g, pf: SI ? 1000 : 144, p: SI ? 'kPa' : 'psi', pa: SI ? 'kPa (abs)' : 'psia', T: SI ? 'K' : '°R', V: SI ? 'm/s' : 'ft/s', L: SI ? 'm' : 'ft',
      D: SI ? 'mm' : 'in', dF: SI ? 0.001 : 1 / 12, A: SI ? 'm²' : 'ft²', m: SI ? 'kg/s' : 'slug/s', G: SI ? 'N/s' : 'lb/s', rho: SI ? 'kg/m³' : 'slug/ft³',
      gam: SI ? 'N/m³' : 'lb/ft³', R: SI ? 'J/(kg·K)' : 'ft·lb/(slug·°R)', e: SI ? 'kJ/kg' : 'ft·lb/slug', ef: SI ? 1000 : 1, s: SI ? 'J/(kg·K)' : 'ft·lb/(slug·°R)',
      F: SI ? 'N' : 'lb', mass: SI ? 'kg' : 'slug', Vol: SI ? 'm³' : 'ft³', ql: SI ? 'kJ/(kg·m)' : 'ft·lb/(slug·ft)', mu: SI ? 'Pa·s' : 'lb·s/ft²', E: SI ? 'GPa' : 'psi', Ef: SI ? 1e9 : 144,
      t: 's', h: SI ? 'km' : 'mi', hf: SI ? 1000 : 5280,
    };
  };
  // temperature scale of the inputs: SI 'C' (+273) or 'K'; English 'F' (+460) or 'R'
  const tOff = (p, u) => (u.SI ? (p.tS === 'K' ? 0 : 273) : (p.tS === 'R' ? 0 : 460));
  const tName = (p, u) => (u.SI ? (p.tS === 'K' ? 'K' : '°C') : (p.tS === 'R' ? '°R' : '°F'));

  function gasOf(p, u) {
    if (p.gas === 'custom') {
      if (!(p.Rc > 0) || !(p.kc > 1)) return { err: 'Enter R > 0 and k > 1 for the custom gas.' };
      return { R: p.Rc, k: p.kc, name: 'the gas', src: `R = ${f(p.Rc)} ${u.R}, k = ${f(p.kc)}` };
    }
    const G = P0.GASES[p.gas] || P0.GASES.air;
    const R = u.SI ? G.R : G.R * 5.97994;
    return { R, k: G.k, name: G.name, src: `${G.name}: R = ${f(R)} ${u.R}, k = ${f(G.k)}`, air: (p.gas || 'air') === 'air' };
  }

  /* ---------------- isentropic relations ---------------- */
  const iT = (M, k) => 1 / (1 + ((k - 1) / 2) * M * M);
  const iP = (M, k) => pow(iT(M, k), k / (k - 1));
  const iR = (M, k) => pow(iT(M, k), 1 / (k - 1));
  const iA = (M, k) => (1 / M) * pow((2 / (k + 1)) * (1 + ((k - 1) / 2) * M * M), (k + 1) / (2 * (k - 1)));
  function bis(fn, a, b, target, n) {
    let fa = fn(a) - target;
    for (let i = 0; i < (n || 200); i++) {
      const m = 0.5 * (a + b), fm = fn(m) - target;
      if ((fa <= 0) === (fm <= 0)) { a = m; fa = fm; } else b = m;
      if (abs(b - a) < 1e-13 * Math.max(1, abs(a))) break;
    }
    return 0.5 * (a + b);
  }
  const MofA = (AR, k, sup) => (AR < 1 ? NaN : AR === 1 ? 1 : sup ? bis((M) => iA(M, k), 1, 200, AR) : bis((M) => iA(M, k), 1e-9, 1, AR));
  const MofP = (r, k) => sqrt((2 / (k - 1)) * (pow(r, -(k - 1) / k) - 1));
  const MofT = (r, k) => sqrt((2 / (k - 1)) * (1 / r - 1));
  const pCrit = (k) => pow(2 / (k + 1), k / (k - 1));
  // choked mass flow per unit throat area: ṁ/A* = p0 √(k/(R T0)) (2/(k+1))^((k+1)/(2(k−1)))
  const mStar = (p0, T0, R, k) => p0 * sqrt(k / (R * T0)) * pow(2 / (k + 1), (k + 1) / (2 * (k - 1)));

  /* ---------------- normal shock ---------------- */
  function nShock(M1, k) {
    const M2 = sqrt((M1 * M1 + 2 / (k - 1)) / ((2 * k / (k - 1)) * M1 * M1 - 1));
    const pr = (2 * k * M1 * M1 - (k - 1)) / (k + 1);
    const rr = ((k + 1) * M1 * M1) / ((k - 1) * M1 * M1 + 2);
    const Tr = pr / rr;
    const p0r = pow(rr, k / (k - 1)) * pow(1 / pr, 1 / (k - 1));
    return { M2, pr, rr, Tr, p0r };
  }
  /* ---------------- oblique shock & Prandtl–Meyer ---------------- */
  const thetaOf = (M, b, k) => Math.atan((2 / Math.tan(b)) * ((M * M * Math.sin(b) ** 2 - 1) / (M * M * (k + Math.cos(2 * b)) + 2)));
  function thetaMax(M, k) {
    const mu = Math.asin(1 / M); let best = 0, bb = mu;
    for (let i = 0; i <= 2000; i++) { const b = mu + ((PI / 2 - mu) * i) / 2000, t = thetaOf(M, b, k); if (t > best) { best = t; bb = b; } }
    // refine
    let a = Math.max(mu, bb - (PI / 2 - mu) / 1000), c = Math.min(PI / 2, bb + (PI / 2 - mu) / 1000);
    for (let i = 0; i < 100; i++) { const m1 = a + (c - a) / 3, m2 = c - (c - a) / 3; if (thetaOf(M, m1, k) < thetaOf(M, m2, k)) a = m1; else c = m2; }
    bb = 0.5 * (a + c);
    return { t: thetaOf(M, bb, k), b: bb };
  }
  const nuPM = (M, k) => sqrt((k + 1) / (k - 1)) * Math.atan(sqrt(((k - 1) / (k + 1)) * (M * M - 1))) - Math.atan(sqrt(M * M - 1));

  /* ---------------- Fanno (Darcy f) ---------------- */
  const fanL = (M, k) => (1 - M * M) / (k * M * M) + ((k + 1) / (2 * k)) * ln(((k + 1) * M * M) / (2 + (k - 1) * M * M));
  const fanT = (M, k) => (k + 1) / (2 + (k - 1) * M * M);
  const fanP = (M, k) => (1 / M) * sqrt(fanT(M, k));
  const fanV = (M, k) => M * sqrt(fanT(M, k));
  const fanP0 = (M, k) => (1 / M) * pow((2 + (k - 1) * M * M) / (k + 1), (k + 1) / (2 * (k - 1)));
  const MofFan = (x, k, sup) => (sup ? bis((M) => fanL(M, k), 1, 1e4, x) : bis((M) => fanL(M, k), 1e-7, 1, x));
  /* ---------------- Rayleigh ---------------- */
  const rayP = (M, k) => (1 + k) / (1 + k * M * M);
  const rayT = (M, k) => M * M * rayP(M, k) ** 2;
  const rayV = (M, k) => (M * M * (1 + k)) / (1 + k * M * M);
  const rayT0 = (M, k) => ((k + 1) * M * M * (2 + (k - 1) * M * M)) / (1 + k * M * M) ** 2;
  const rayP0 = (M, k) => rayP(M, k) * pow((2 + (k - 1) * M * M) / (k + 1), k / (k - 1));
  const MofRay = (x, k, sup) => (sup ? bis((M) => -rayT0(M, k), 1, 1e4, -x) : bis((M) => rayT0(M, k), 1e-7, 1, x));

  /* ---------------- gas viscosity (air, Sutherland) ---------------- */
  const muAir = (T, u) => { const TK = u.SI ? T : T / 1.8; const m = (1.458e-6 * pow(TK, 1.5)) / (TK + 110.4); return u.SI ? m : m / 47.880; };
  function colebrook(Re, eD) {
    if (Re < 2300) return 64 / Re;
    let x = 0.02;
    for (let i = 0; i < 60; i++) x = pow(-2 * Math.log10(eD / 3.7 + 2.51 / (Re * sqrt(x))), -2);
    return x;
  }

  /* ---------------- input helpers ---------------- */
  function ctx(p, U) {
    const u = units(U), g = gasOf(p, u);
    const off = tOff(p, u), tn = tName(p, u);
    const gauge = !!p.gauge, pat = p.patm;
    const P = (x) => (x + (gauge ? pat : 0)) * u.pf; // → Pa or lb/ft² (absolute)
    const Pd = (x) => x / u.pf; // base → kPa / psi (absolute)
    const T = (x) => x + off;
    const pTxt = (x) => (gauge ? `${f(x)} + ${f(pat)} = ${f(x + pat)} ${u.pa}` : `${f(x)} ${u.pa}`);
    const tTxt = (x) => (off ? `${f(x)} ${tn} + ${off} = ${f(x + off)} ${u.T}` : `${f(x)} ${u.T}`);
    return { u, g, P, Pd, T, pTxt, tTxt, tn };
  }

  /** Resolve a flow state from p.by ∈ MTp | VTp | M0 | V0 | p0p | T0T | AA (keys M, V, T, p, T0, p0, AR, br). */
  function stateOf(p, c, st, label) {
    const { u, g } = c, k = g.k, R = g.R, L = label || '';
    let M, T, pr, T0, p0;
    const by = p.by;
    if (by === 'MTp' || by === 'VTp') {
      T = c.T(p.T); pr = c.P(p.p);
      if (!(T > 0)) return { err: 'The absolute temperature must be positive.' };
      if (!(pr > 0)) return { err: 'The absolute pressure must be positive.' };
      const cc = sqrt(k * R * T);
      if (by === 'MTp') M = p.M; else { M = p.V / cc; st.add(`Mach number${L}`, 'M = V/√(kRT)', `M = ${f(p.V)} / √(${f(k)} × ${f(R)} × ${f(T)})`, `M = ${f(M)}`, `T = ${c.tTxt(p.T)}`); }
      if (!(M >= 0)) return { err: 'The Mach number must not be negative.' };
      T0 = T / iT(M, k); p0 = pr / iP(M, k);
      st.add(`Stagnation state${L}`, 'T₀ = T(1 + (k−1)M²/2),  p₀ = p(T₀/T)^(k/(k−1))', `T₀ = ${f(T)}(1 + ${f((k - 1) / 2)} × ${f(M)}²);  p = ${c.pTxt(p.p)}`, `T₀ = ${f(T0)} ${u.T},  p₀ = ${f(c.Pd(p0))} ${u.pa}`, '');
    } else {
      T0 = c.T(p.T0); p0 = c.P(p.p0);
      if (!(T0 > 0)) return { err: 'The stagnation temperature must be positive.' };
      if (!(p0 > 0)) return { err: 'The stagnation pressure must be positive.' };
      if (by === 'M0') M = p.M;
      else if (by === 'V0') {
        const cp = (k * R) / (k - 1), T1 = T0 - (p.V * p.V) / (2 * cp);
        if (!(T1 > 0)) return { err: 'That speed is above the maximum speed √(2c_pT₀) for this stagnation temperature.' };
        M = p.V / sqrt(k * R * T1);
        st.add(`Static temperature${L}`, 'T = T₀ − V²/(2c_p),  c_p = kR/(k−1)', `T = ${f(T0)} − ${f(p.V)}²/(2 × ${f(cp)})`, `T = ${f(T1)} ${u.T},  M = ${f(M)}`, '');
      } else if (by === 'p0p') {
        const pp = c.P(p.p);
        if (!(pp > 0 && pp <= p0)) return { err: 'The static pressure must be positive and not above the stagnation pressure.' };
        M = MofP(pp / p0, k);
        st.add(`Mach number from p/p₀${L}`, 'M = √{[2/(k−1)][(p₀/p)^((k−1)/k) − 1]}', `p/p₀ = ${f(c.Pd(pp))}/${f(c.Pd(p0))} = ${f(pp / p0)}`, `M = ${f(M)}`, '');
      } else if (by === 'T0T') {
        const TT = c.T(p.T);
        if (!(TT > 0 && TT <= T0)) return { err: 'The static temperature must be positive and not above the stagnation temperature.' };
        M = MofT(TT / T0, k);
        st.add(`Mach number from T/T₀${L}`, 'M = √{[2/(k−1)](T₀/T − 1)}', `T/T₀ = ${f(TT)}/${f(T0)} = ${f(TT / T0)}`, `M = ${f(M)}`, '');
      } else if (by === 'AA') {
        if (!(p.AR >= 1)) return { err: 'A/A* must be at least 1.' };
        M = MofA(p.AR, k, p.br === 'sup');
        st.add(`Mach number from A/A*${L} (${p.br === 'sup' ? 'supersonic' : 'subsonic'} branch)`, 'A/A* = (1/M)[(2/(k+1))(1 + (k−1)M²/2)]^((k+1)/(2(k−1)))', `A/A* = ${f(p.AR)}`, `M = ${f(M)}`, 'Solved by bisection on the chosen branch.');
      } else return { err: 'Choose how the state is given.' };
      if (!(M >= 0)) return { err: 'The Mach number must not be negative.' };
      T = T0 * iT(M, k); pr = p0 * iP(M, k);
      st.add(`Static state${L}`, 'T = T₀/(1 + (k−1)M²/2),  p = p₀(T/T₀)^(k/(k−1))', `T₀ = ${c.tTxt(p.T0)},  p₀ = ${c.pTxt(p.p0)},  M = ${f(M)}`, `T = ${f(T)} ${u.T},  p = ${f(c.Pd(pr))} ${u.pa}`, '');
    }
    const a = sqrt(k * R * T), V = M * a, rho = pr / (R * T), rho0 = p0 / (R * T0);
    return { M, T, p: pr, T0, p0, a, V, rho, rho0 };
  }
  const stOut = (s, c, tag) => {
    const u = c.u, t = tag || '';
    return [
      { k: `Mach number M${t}`, v: s.M, u: '', hl: true },
      { k: `Velocity V${t}`, v: s.V, u: u.V, hl: true },
      { k: `Temperature T${t}`, v: s.T, u: u.T },
      { k: `Pressure p${t}`, v: c.Pd(s.p), u: u.pa },
      { k: `Density ρ${t}`, v: s.rho, u: u.rho },
      { k: `Speed of sound c${t}`, v: s.a, u: u.V },
      { k: `Stagnation temperature T₀${t}`, v: s.T0, u: u.T },
      { k: `Stagnation pressure p₀${t}`, v: c.Pd(s.p0), u: u.pa },
    ];
  };
  const regime = (M) => (M < 0.3 ? 'nearly incompressible (M < 0.3)' : M < 0.999 ? 'subsonic' : M <= 1.001 ? 'sonic' : M < 5 ? 'supersonic' : 'hypersonic');

  /* =================================================================== */
  function compFlow(p, U) {
    const c = ctx(p, U), { u, g } = c, st = Steps(), warn = [];
    if (g.err) return fail([g.err]);
    const k = g.k, R = g.R, cp = (k * R) / (k - 1), cv = R / (k - 1);
    st.add('Gas constants', 'c_p = kR/(k−1),  c_v = R/(k−1)', g.src, `c_p = ${f(cp)},  c_v = ${f(cv)} ${u.s}`, '');
    const topic = p.topic;
    const out = [];
    const area = (Dd) => (PI / 4) * (Dd * u.dF) ** 2;

    /* ---------- gas states and processes ---------- */
    if (topic === 'gas') {
      const T1 = c.T(p.gT1), p1 = c.P(p.gp1);
      if (!(T1 > 0 && p1 > 0)) return fail(['State 1 needs a positive absolute pressure and temperature.']);
      const r1 = p1 / (R * T1);
      st.add('State 1 (ideal gas)', 'ρ₁ = p₁/(RT₁)', `ρ₁ = ${f(p1)} / (${f(R)} × ${f(T1)});  p₁ = ${c.pTxt(p.gp1)},  T₁ = ${c.tTxt(p.gT1)}`, `ρ₁ = ${f(r1)} ${u.rho},  γ₁ = ${f(r1 * u.g)} ${u.gam}`, '');
      const pc = p.proc;
      let p2, T2, n = NaN;
      if (pc === 'both') {
        T2 = c.T(p.gT2); p2 = c.P(p.gp2);
      } else {
        n = pc === 'isen' ? k : pc === 'poly' ? p.n : pc === 'isoT' ? 1 : pc === 'isoV' ? Infinity : 0;
        if (pc === 'poly' && !(n > 0)) return fail(['The polytropic exponent n must be positive.']);
        const kn = p.known2;
        if (pc === 'isoT') { T2 = T1; if (kn === 'T') return fail(['For an isothermal process give p₂ or ρ₂.']); p2 = kn === 'p' ? c.P(p.gp2) : p.gr2 * R * T1; }
        else if (pc === 'isoP') { p2 = p1; if (kn === 'p') return fail(['For a constant-pressure process give T₂ or ρ₂.']); T2 = kn === 'T' ? c.T(p.gT2) : p1 / (p.gr2 * R); }
        else if (pc === 'isoV') { if (kn === 'rho') return fail(['For a constant-volume process give p₂ or T₂.']); if (kn === 'p') { p2 = c.P(p.gp2); T2 = (T1 * p2) / p1; } else { T2 = c.T(p.gT2); p2 = (p1 * T2) / T1; } }
        else {
          if (kn === 'p') { p2 = c.P(p.gp2); T2 = T1 * pow(p2 / p1, (n - 1) / n); }
          else if (kn === 'T') { T2 = c.T(p.gT2); p2 = p1 * pow(T2 / T1, n / (n - 1)); }
          else { const r2 = p.gr2; p2 = p1 * pow(r2 / r1, n); T2 = p2 / (r2 * R); }
          st.add(pc === 'isen' ? 'Isentropic process (n = k)' : 'Polytropic process', 'p/ρⁿ = const,  T₂/T₁ = (p₂/p₁)^((n−1)/n)', `n = ${f(n)}`, `p₂ = ${f(c.Pd(p2))} ${u.pa},  T₂ = ${f(T2)} ${u.T}`, '');
        }
      }
      if (!(T2 > 0 && p2 > 0)) return fail(['State 2 needs a positive absolute pressure and temperature.']);
      const r2 = p2 / (R * T2);
      if (pc === 'both') { n = abs(ln(r2 / r1)) > 1e-12 ? ln(p2 / p1) / ln(r2 / r1) : NaN; st.add('Polytropic exponent through both states', 'n = ln(p₂/p₁) / ln(ρ₂/ρ₁)', `p₂ = ${c.pTxt(p.gp2)},  T₂ = ${c.tTxt(p.gT2)}`, `n = ${f(n)}`, ''); }
      const dh = cp * (T2 - T1), du = cv * (T2 - T1), ds = cp * ln(T2 / T1) - R * ln(p2 / p1);
      st.add('Changes of enthalpy and internal energy', 'Δh = c_p(T₂ − T₁),  Δu = c_v(T₂ − T₁)', `T₂ − T₁ = ${f(T2)} − ${f(T1)} = ${f(T2 - T1)}`, `Δh = ${f(dh / u.ef)} ${u.e},  Δu = ${f(du / u.ef)} ${u.e}`, '');
      st.add('Change of entropy', 'Δs = c_p ln(T₂/T₁) − R ln(p₂/p₁)', `Δs = ${f(cp)} ln(${f(T2)}/${f(T1)}) − ${f(R)} ln(${f(c.Pd(p2))}/${f(c.Pd(p1))})`, `Δs = ${f(ds)} ${u.s}`, '');
      // work per unit mass on the gas boundary (closed system) and flow (shaft) work
      let wb = NaN, wf = NaN;
      if (isFinite(n)) {
        if (abs(n - 1) < 1e-9) { wb = R * T1 * ln(r1 / r2); wf = wb; }
        else if (n === 0) { wb = R * (T2 - T1); wf = 0; }
        else { wb = (R * (T2 - T1)) / (1 - n); wf = (n * R * (T2 - T1)) / (1 - n); }
      } else if (n === Infinity) { wb = 0; wf = -R * (T2 - T1); }
      if (isFinite(wb)) st.add('Work done by the gas, per unit mass', 'closed: w = ∫p dv = R(T₂ − T₁)/(1 − n) (n = 1: RT ln(v₂/v₁));  steady flow: w = nR(T₁ − T₂)/(n − 1)', `n = ${f(n)}`, `w_closed = ${f(wb / u.ef)} ${u.e},  w_flow = ${f(wf / u.ef)} ${u.e}`, 'Negative work means work is done ON the gas (compression).');
      const q = isFinite(wb) ? du + wb : NaN;
      if (isFinite(q)) st.add('Heat added, per unit mass (closed system)', 'q = Δu + w', `q = ${f(du / u.ef)} + ${f(wb / u.ef)}`, `q = ${f(q / u.ef)} ${u.e}`, '');
      out.push({ k: 'Density ρ₁', v: r1, u: u.rho }, { k: 'Unit weight γ₁', v: r1 * u.g, u: u.gam }, { k: 'Pressure p₂', v: c.Pd(p2), u: u.pa, hl: true }, { k: 'Temperature T₂', v: T2, u: u.T, hl: true }, { k: 'Density ρ₂', v: r2, u: u.rho, hl: true }, { k: 'Unit weight γ₂', v: r2 * u.g, u: u.gam },
        { k: 'Δh (enthalpy)', v: dh / u.ef, u: u.e, hl: true }, { k: 'Δu (internal energy)', v: du / u.ef, u: u.e, hl: true }, { k: 'Δs (entropy)', v: ds, u: u.s, hl: true }, { k: 'Polytropic exponent n', v: n, u: '' },
        { k: 'Boundary work w (closed)', v: wb / u.ef, u: u.e }, { k: 'Steady-flow work w', v: wf / u.ef, u: u.e }, { k: 'Heat q (closed)', v: q / u.ef, u: u.e }, { k: 'c_p', v: cp, u: u.s }, { k: 'c_v', v: cv, u: u.s },
        { k: 'Speed of sound c₁', v: sqrt(k * R * T1), u: u.V }, { k: 'Speed of sound c₂', v: sqrt(k * R * T2), u: u.V });
      if (p.mass > 0) {
        const m = p.mass;
        st.add('For the given mass', 'V = m/ρ,  ΔH = mΔh,  ΔS = mΔs', `m = ${f(m)} ${u.mass}`, `V₁ = ${f(m / r1)},  V₂ = ${f(m / r2)} ${u.Vol}`, '');
        out.push({ k: 'Volume V₁', v: m / r1, u: u.Vol }, { k: 'Volume V₂', v: m / r2, u: u.Vol }, { k: 'Total ΔH', v: (m * dh) / u.ef, u: u.SI ? 'kJ' : 'ft·lb' }, { k: 'Total ΔU', v: (m * du) / u.ef, u: u.SI ? 'kJ' : 'ft·lb' }, { k: 'Total ΔS', v: m * ds, u: u.SI ? 'J/K' : 'ft·lb/°R' }, { k: 'Total boundary work W', v: (m * wb) / u.ef, u: u.SI ? 'kJ' : 'ft·lb' });
      }
      if (ds < -1e-9 && pc !== 'both') warn.push('Entropy decreases: heat must be removed for this process.');
      return done(st, out, warn, { cls: 'ok', text: `p₂ = ${f(c.Pd(p2))} ${u.pa},  T₂ = ${f(T2)} ${u.T}` }, { topic, T1, T2, p1, p2, pc });
    }

    /* ---------- speed of sound, Mach number, Mach cone ---------- */
    if (topic === 'mach') {
      let a;
      if (p.cBy === 'given') { a = p.cG; st.add('Speed of sound (given)', '', '', `c = ${f(a)} ${u.V}`, ''); }
      else if (p.cBy === 'liq') { const E = p.Ev * u.Ef; a = sqrt(E / p.rhoL); st.add('Speed of sound in a liquid', 'c = √(E_v/ρ)', `c = √(${f(E)} / ${f(p.rhoL)})`, `c = ${f(a)} ${u.V}`, ''); }
      else { const T = c.T(p.T); if (!(T > 0)) return fail(['The absolute temperature must be positive.']); a = sqrt(k * R * T); st.add('Speed of sound in the gas', 'c = √(kRT)', `c = √(${f(k)} × ${f(R)} × ${f(T)});  T = ${c.tTxt(p.T)}`, `c = ${f(a)} ${u.V}`, ''); }
      if (!(a > 0)) return fail(['Check the inputs for the speed of sound.']);
      let M, V;
      if (p.mBy === 'V') { V = p.V; M = V / a; } else { M = p.M; V = M * a; }
      st.add('Mach number', 'M = V/c', `M = ${f(V)} / ${f(a)}`, `M = ${f(M)}  (${regime(M)})`, '');
      out.push({ k: 'Speed of sound c', v: a, u: u.V, hl: true }, { k: 'Mach number M', v: M, u: '', hl: true }, { k: 'Speed V', v: V, u: u.V, hl: true });
      if (!u.SI) out.push({ k: 'Speed V', v: V * 0.681818, u: 'mi/h' }); else out.push({ k: 'Speed V', v: V * 3.6, u: 'km/h' });
      let al = NaN, x = NaN, t = NaN;
      if (M > 1) {
        al = Math.asin(1 / M);
        st.add('Mach cone half-angle', 'sin α = 1/M', `sin α = 1/${f(M)} = ${f(1 / M)}`, `α = ${f(al / DEG)}°`, '');
        out.push({ k: 'Mach angle α', v: al / DEG, u: '°', hl: true });
        if (p.alt > 0) {
          const h = p.alt * u.hf;
          x = h / Math.tan(al); t = x / V;
          st.add('Sound reaches an observer below', 'x = h/tan α,  t = x/V', `x = ${f(h)} / tan ${f(al / DEG)}°`, `x = ${f(x)} ${u.L},  t = ${f(t)} s`, 'Time after the plane passes directly overhead (constant c).');
          out.push({ k: 'Horizontal distance x', v: x / u.hf, u: u.h }, { k: 'Time to hear the plane t', v: t, u: 's', hl: true });
        }
      } else if (p.alt > 0) warn.push('The Mach cone (and the time to hear the plane) applies only to supersonic speeds, M > 1.');
      return done(st, out, warn, { cls: 'ok', text: `M = ${f(M)} — ${regime(M)}` }, { topic, M, al, alt: p.alt, x: x / u.hf, u });
    }

    /* ---------- isentropic flow, section 1 and optional section 2 ---------- */
    if (topic === 'isen') {
      const s = stateOf(p, c, st, ' at section 1');
      if (s.err) return fail([s.err], warn, st.list);
      const k1 = k;
      out.push(...stOut(s, c, '₁'));
      out.push({ k: 'T₁/T₀', v: iT(s.M, k1), u: '' }, { k: 'p₁/p₀', v: iP(s.M, k1), u: '' }, { k: 'ρ₁/ρ₀', v: iR(s.M, k1), u: '' }, { k: 'Stagnation density ρ₀', v: s.rho0, u: u.rho });
      const AR1 = s.M > 0 ? iA(s.M, k1) : Infinity;
      if (isFinite(AR1)) out.push({ k: 'A₁/A*', v: AR1, u: '' });
      st.add('Isentropic ratios at section 1', 'T/T₀, p/p₀, ρ/ρ₀, A/A*', `M = ${f(s.M)}`, `T/T₀ = ${f(iT(s.M, k1))},  p/p₀ = ${f(iP(s.M, k1))},  ρ/ρ₀ = ${f(iR(s.M, k1))},  A/A* = ${f(AR1)}`, '');
      const Tst = s.T0 * 2 / (k + 1), pst = s.p0 * pCrit(k);
      out.push({ k: 'Critical temperature T*', v: Tst, u: u.T }, { k: 'Critical pressure p*', v: c.Pd(pst), u: u.pa }, { k: 'Critical speed V*', v: sqrt(k * R * Tst), u: u.V }, { k: 'Maximum speed √(2c_pT₀)', v: sqrt(2 * cp * s.T0), u: u.V });
      let mdot = NaN, A1 = NaN, As = NaN, s2 = null, A2 = NaN;
      if (p.D1 > 0) {
        A1 = area(p.D1); mdot = s.rho * s.V * A1;
        As = A1 / AR1;
        st.add('Mass flow and throat area', 'ṁ = ρVA,  A* = A/(A/A*)', `ṁ = ${f(s.rho)} × ${f(s.V)} × ${f(A1)}`, `ṁ = ${f(mdot)} ${u.m},  A* = ${f(As)} ${u.A}`, '');
        out.push({ k: 'Area A₁', v: A1, u: u.A }, { k: 'Mass flow ṁ', v: mdot, u: u.m, hl: true }, { k: 'Weight flow G = ṁg', v: mdot * u.g, u: u.G }, { k: 'Throat (sonic) area A*', v: As, u: u.A, hl: true }, { k: 'Throat diameter D*', v: sqrt((4 * As) / PI) / u.dF, u: u.D });
      }
      const s2by = p.s2by;
      if (s2by && s2by !== 'none') {
        let M2;
        if (s2by === 'D') {
          if (!(p.D1 > 0 && p.D2 > 0)) return fail(['Enter both diameters to find section 2 from its area.'], warn, st.list);
          A2 = area(p.D2);
          const AR2 = A2 / As;
          if (AR2 < 1) return fail([`Section 2 is smaller than the sonic area A* = ${f(As)} ${u.A}: this flow cannot pass isentropically (it would choke).`], warn, st.list);
          M2 = MofA(AR2, k, p.br2 === 'sup');
          st.add('Mach number at section 2', 'A₂/A* → M₂', `A₂/A* = ${f(A2)}/${f(As)} = ${f(AR2)} (${p.br2 === 'sup' ? 'supersonic' : 'subsonic'} branch)`, `M₂ = ${f(M2)}`, '');
        } else if (s2by === 'M') M2 = p.M2;
        else if (s2by === 'p') { const pp = c.P(p.p2); if (!(pp > 0 && pp <= s.p0)) return fail(['p₂ must be positive and not above p₀.'], warn, st.list); M2 = MofP(pp / s.p0, k); st.add('Mach number at section 2', 'from p₂/p₀', `p₂/p₀ = ${f(pp / s.p0)}`, `M₂ = ${f(M2)}`, ''); }
        else if (s2by === 'T') { const TT = c.T(p.T2); if (!(TT > 0 && TT <= s.T0)) return fail(['T₂ must be positive and not above T₀.'], warn, st.list); M2 = MofT(TT / s.T0, k); st.add('Mach number at section 2', 'from T₂/T₀', `T₂/T₀ = ${f(TT / s.T0)}`, `M₂ = ${f(M2)}`, ''); }
        if (!(M2 > 0)) return fail(['The Mach number at section 2 must be positive.'], warn, st.list);
        const T2 = s.T0 * iT(M2, k), pr2 = s.p0 * iP(M2, k), a2 = sqrt(k * R * T2);
        s2 = { M: M2, T: T2, p: pr2, T0: s.T0, p0: s.p0, a: a2, V: M2 * a2, rho: pr2 / (R * T2) };
        st.add('State at section 2 (same T₀, p₀)', 'T₂ = T₀/(1 + (k−1)M₂²/2),  p₂ = p₀(T₂/T₀)^(k/(k−1)),  V₂ = M₂√(kRT₂)', `M₂ = ${f(M2)}`, `T₂ = ${f(T2)} ${u.T},  p₂ = ${f(c.Pd(pr2))} ${u.pa},  V₂ = ${f(s2.V)} ${u.V}`, '');
        out.push({ k: 'Mach number M₂', v: M2, u: '', hl: true }, { k: 'Velocity V₂', v: s2.V, u: u.V, hl: true }, { k: 'Temperature T₂', v: T2, u: u.T, hl: true }, { k: 'Pressure p₂', v: c.Pd(pr2), u: u.pa, hl: true }, { k: 'Density ρ₂', v: s2.rho, u: u.rho });
        if (isFinite(As) && s2by !== 'D') { A2 = As * iA(M2, k); st.add('Area at section 2', 'A₂ = A*(A₂/A*)', `A₂/A* = ${f(iA(M2, k))}`, `A₂ = ${f(A2)} ${u.A},  D₂ = ${f(sqrt((4 * A2) / PI) / u.dF)} ${u.D}`, ''); out.push({ k: 'Area A₂', v: A2, u: u.A }, { k: 'Diameter D₂', v: sqrt((4 * A2) / PI) / u.dF, u: u.D, hl: true }); }
      }
      return done(st, out, warn, { cls: 'ok', text: `M₁ = ${f(s.M)} — ${regime(s.M)}` + (s2 ? `;  M₂ = ${f(s2.M)}` : '') }, { topic, s, s2, A1, A2, As });
    }

    /* ---------- Schaum two-point isentropic equation ---------- */
    if (topic === 'stream') {
      const p1 = c.P(p.sp1), gam1 = p.sg1, V1 = p.sV1;
      if (!(p1 > 0 && gam1 > 0)) return fail(['Enter a positive pressure and unit weight at point 1.']);
      const kk = k, ex = (kk - 1) / kk, H = (kk / (kk - 1)) * (p1 / gam1);
      let p2, V2;
      if (p.sFind === 'V2') {
        p2 = c.P(p.sp2);
        if (!(p2 > 0)) return fail(['p₂ must be positive.']);
        const rhs = H * (1 - pow(p2 / p1, ex));
        const V2s = V1 * V1 + 2 * u.g * rhs;
        if (!(V2s >= 0)) return fail(['The pressure rise is too large for the speed at point 1.']);
        V2 = sqrt(V2s);
        st.add('Isentropic energy equation (Schaum eq. 2)', 'V₂²/2g − V₁²/2g = [k/(k−1)](p₁/γ₁)[1 − (p₂/p₁)^((k−1)/k)]', `= ${f(kk / (kk - 1))} × (${f(p1)}/${f(gam1)}) × [1 − (${f(c.Pd(p2))}/${f(c.Pd(p1))})^${f(ex)}] = ${f(rhs)} ${u.L}`, `V₂ = ${f(V2)} ${u.V}`, `p₁ = ${c.pTxt(p.sp1)}`);
      } else {
        V2 = p.sV2;
        const rhs = (V2 * V2 - V1 * V1) / (2 * u.g);
        const r = 1 - rhs / H;
        if (!(r > 0)) return fail(['That speed cannot be reached isentropically from point 1.']);
        p2 = p1 * pow(r, 1 / ex);
        st.add('Isentropic energy equation solved for p₂', 'p₂ = p₁[1 − (V₂² − V₁²)/(2g) ÷ ((k/(k−1)) p₁/γ₁)]^(k/(k−1))', `(V₂² − V₁²)/2g = ${f(rhs)} ${u.L};  (k/(k−1))p₁/γ₁ = ${f(H)} ${u.L}`, `p₂ = ${f(c.Pd(p2))} ${u.pa}`, '');
      }
      const gam2 = gam1 * pow(p2 / p1, 1 / kk);
      st.add('Unit weight at point 2', 'γ₂ = γ₁(p₂/p₁)^(1/k)', `γ₂ = ${f(gam1)} × (${f(p2 / p1)})^${f(1 / kk)}`, `γ₂ = ${f(gam2)} ${u.gam}`, '');
      out.push({ k: 'Velocity V₂', v: V2, u: u.V, hl: true }, { k: 'Pressure p₂', v: c.Pd(p2), u: u.pa, hl: true }, { k: 'Unit weight γ₂', v: gam2, u: u.gam }, { k: 'Density ρ₂', v: gam2 / u.g, u: u.rho }, { k: 'Temperature T₁ = p₁/(ρ₁R)', v: (p1 * u.g) / (gam1 * R), u: u.T }, { k: 'Temperature T₂', v: (p2 * u.g) / (gam2 * R), u: u.T });
      if (p.sD > 0) { const A = area(p.sD), G = gam1 * A * V1; out.push({ k: 'Weight flow G = γ₁A V₁', v: G, u: u.G }, { k: 'Mass flow ṁ', v: G / u.g, u: u.m }, { k: 'Velocity at 2 if same pipe (continuity)', v: G / (gam2 * A), u: u.V }); }
      return done(st, out, warn, { cls: 'ok', text: p.sFind === 'V2' ? `V₂ = ${f(V2)} ${u.V}` : `p₂ = ${f(c.Pd(p2))} ${u.pa}` }, { topic, V1, V2, p1, p2 });
    }

    /* ---------- nozzle from a large tank ---------- */
    if (topic === 'noz') {
      const T0 = c.T(p.nT0), p0 = c.P(p.np0);
      if (!(T0 > 0 && p0 > 0)) return fail(['The tank needs a positive absolute pressure and temperature.']);
      st.add('Tank (stagnation) state', 'p₀, T₀ in the tank; ρ₀ = p₀/(RT₀)', `p₀ = ${c.pTxt(p.np0)},  T₀ = ${c.tTxt(p.nT0)}`, `ρ₀ = ${f(p0 / (R * T0))} ${u.rho}`, '');
      const rc = pCrit(k), pst = p0 * rc, Tst = (T0 * 2) / (k + 1);
      st.add('Critical (sonic) conditions', '(p*/p₀) = [2/(k+1)]^(k/(k−1)),  T* = 2T₀/(k+1)', `k = ${f(k)}`, `p*/p₀ = ${f(rc)},  p* = ${f(c.Pd(pst))} ${u.pa},  T* = ${f(Tst)} ${u.T}`, '');
      out.push({ k: 'Critical pressure ratio p*/p₀', v: rc, u: '' }, { k: 'Critical pressure p*', v: c.Pd(pst), u: u.pa }, { k: 'Critical temperature T*', v: Tst, u: u.T }, { k: 'Critical speed V*', v: sqrt(k * R * Tst), u: u.V });
      const ms = mStar(p0, T0, R, k);
      const kind = p.nKind, des = p.nFind === 'size';
      const geo = { topic, kind, p0, T0 };
      const exitOut = (Me, pe, Ae, tag) => {
        const Te = T0 * iT(Me, k), Ve = Me * sqrt(k * R * Te), re = pe / (R * Te);
        out.push({ k: `Exit Mach number${tag || ''}`, v: Me, u: '', hl: true }, { k: 'Exit pressure p_e', v: c.Pd(pe), u: u.pa, hl: true }, { k: 'Exit temperature T_e', v: Te, u: u.T, hl: true }, { k: 'Exit velocity V_e', v: Ve, u: u.V, hl: true }, { k: 'Exit density ρ_e', v: re, u: u.rho });
        return { Te, Ve, re };
      };
      if (kind === 'conv') {
        const pb = c.P(p.npb);
        let Me, pe, chk;
        if (des) {
          // size the exit for a given mass flow
          const md = p.nm * (p.nmU === 'G' ? 1 / u.g : 1);
          if (!(md > 0)) return fail(['Enter the required flow.']);
          if (!(pb > 0)) return fail(['Enter the back pressure.']);
          if (pb / p0 <= rc) { Me = 1; pe = pst; chk = true; } else { Me = MofP(pb / p0, k); pe = pb; chk = false; }
          const Te = T0 * iT(Me, k), Ve = Me * sqrt(k * R * Te), re = pe / (R * Te), Ae = md / (re * Ve);
          st.add('Exit area for the required flow', 'A_e = ṁ/(ρ_e V_e)', `ṁ = ${f(md)} ${u.m};  M_e = ${f(Me)}`, `A_e = ${f(Ae)} ${u.A},  D_e = ${f(sqrt((4 * Ae) / PI) / u.dF)} ${u.D}`, chk ? 'The back pressure is below p*, so the exit is sonic.' : '');
          exitOut(Me, pe, Ae);
          out.push({ k: 'Exit area A_e', v: Ae, u: u.A, hl: true }, { k: 'Exit diameter D_e', v: sqrt((4 * Ae) / PI) / u.dF, u: u.D, hl: true });
          Object.assign(geo, { Me, pe, pb, Ae, choked: chk, md });
          return done(st, out, warn, { cls: 'ok', text: `D_e = ${f(sqrt((4 * Ae) / PI) / u.dF)} ${u.D}` }, geo);
        }
        if (!(p.nDe > 0)) return fail(['Enter the exit diameter.']);
        if (!(pb >= 0)) return fail(['The back pressure cannot be negative.']);
        const Ae = area(p.nDe);
        if (pb >= p0) return fail(['The back pressure is not below the tank pressure, so nothing flows.']);
        if (pb / p0 > rc) {
          Me = MofP(pb / p0, k); pe = pb; chk = false;
          st.add('Subsonic exit (not choked)', 'p_b/p₀ > (p*/p₀)  ⇒  p_e = p_b,  M_e from p_e/p₀', `p_b/p₀ = ${f(c.Pd(pb))}/${f(c.Pd(p0))} = ${f(pb / p0)} > ${f(rc)}`, `M_e = ${f(Me)}`, '');
        } else {
          Me = 1; pe = pst; chk = true;
          st.add('Choked nozzle', 'p_b/p₀ ≤ (p*/p₀)  ⇒  M_e = 1,  p_e = p*', `p_b/p₀ = ${f(pb / p0)} ≤ ${f(rc)}`, `p_e = ${f(c.Pd(pst))} ${u.pa}`, 'Lowering the back pressure further does not raise the flow.');
        }
        const e = exitOut(Me, pe, Ae);
        const md = e.re * e.Ve * Ae;
        st.add('Mass flow', 'ṁ = ρ_e V_e A_e' + (chk ? ' = A p₀√(k/(RT₀)) [2/(k+1)]^((k+1)/(2(k−1)))' : ''), `ṁ = ${f(e.re)} × ${f(e.Ve)} × ${f(Ae)}`, `ṁ = ${f(md)} ${u.m},  G = ṁg = ${f(md * u.g)} ${u.G}`, '');
        out.push({ k: 'Mass flow ṁ', v: md, u: u.m, hl: true }, { k: 'Weight flow G', v: md * u.g, u: u.G, hl: true }, { k: 'Maximum (choked) mass flow', v: ms * Ae, u: u.m }, { k: 'Tank pressure for choking p₀ = p_b/(p*/p₀)', v: c.Pd(pb / rc), u: u.pa });
        Object.assign(geo, { Me, pe, pb, Ae, choked: chk, md });
        return done(st, out, warn, { cls: chk ? 'warn' : 'ok', text: chk ? `Choked: M_e = 1, ṁ = ${f(md)} ${u.m}` : `Subsonic: M_e = ${f(Me)}, ṁ = ${f(md)} ${u.m}` }, geo);
      }
      // converging–diverging (Laval) nozzle
      if (des) {
        // design for an exit Mach number or exit (= back) pressure; optional mass flow → sizes
        let Me;
        if (p.ndBy === 'M') Me = p.nMe; else { const pe = c.P(p.npb); if (!(pe > 0 && pe < p0)) return fail(['The design exit pressure must be between 0 and p₀.']); Me = MofP(pe / p0, k); }
        if (!(Me > 0)) return fail(['Enter the design exit Mach number.']);
        const AR = iA(Me, k), pe = p0 * iP(Me, k);
        st.add('Design (isentropic) exit', 'A_e/A* from M_e;  p_e = p₀(p/p₀)', `M_e = ${f(Me)}`, `A_e/A* = ${f(AR)},  p_e = ${f(c.Pd(pe))} ${u.pa}`, '');
        exitOut(Me, pe);
        out.push({ k: 'Area ratio A_e/A*', v: AR, u: '', hl: true });
        let At = NaN, Ae = NaN;
        if (p.nm > 0) {
          const md = p.nm * (p.nmU === 'G' ? 1 / u.g : 1);
          At = md / ms; Ae = At * AR;
          st.add('Throat and exit areas for the flow', 'A* = ṁ / {p₀√(k/(RT₀)) [2/(k+1)]^((k+1)/(2(k−1)))},  A_e = A*(A_e/A*)', `ṁ = ${f(md)} ${u.m}`, `A* = ${f(At)},  A_e = ${f(Ae)} ${u.A}`, '');
          out.push({ k: 'Throat area A*', v: At, u: u.A }, { k: 'Throat diameter', v: sqrt((4 * At) / PI) / u.dF, u: u.D, hl: true }, { k: 'Exit area A_e', v: Ae, u: u.A }, { k: 'Exit diameter', v: sqrt((4 * Ae) / PI) / u.dF, u: u.D, hl: true });
        } else if (p.nDt > 0) {
          At = area(p.nDt); Ae = At * AR;
          out.push({ k: 'Exit area A_e', v: Ae, u: u.A }, { k: 'Exit diameter', v: sqrt((4 * Ae) / PI) / u.dF, u: u.D, hl: true }, { k: 'Mass flow ṁ', v: ms * At, u: u.m, hl: true }, { k: 'Weight flow G', v: ms * At * u.g, u: u.G });
        }
        const Msub = MofA(AR, k, false);
        out.push({ k: 'Back pressure for subsonic isentropic exit', v: c.Pd(p0 * iP(Msub, k)), u: u.pa }, { k: 'Back pressure for a shock at the exit', v: c.Pd(pe * nShock(Me, k).pr), u: u.pa });
        Object.assign(geo, { cd: true, AR, Me, Msup: Me, Msub, At, Ae, regime: 'design', xs: NaN });
        return done(st, out, warn, { cls: 'ok', text: `A_e/A* = ${f(AR)} for M_e = ${f(Me)}` }, geo);
      }
      if (!(p.nDt > 0 && p.nDe > 0)) return fail(['Enter the throat and exit diameters.']);
      if (p.nDe < p.nDt) return fail(['The exit must be at least as large as the throat.']);
      const At = area(p.nDt), Ae = area(p.nDe), AR = Ae / At, pb = c.P(p.npb);
      if (pb >= p0) return fail(['The back pressure is not below the tank pressure, so nothing flows.']);
      const Msub = MofA(AR, k, false), Msup = MofA(AR, k, true);
      const p3 = p0 * iP(Msub, k), p4 = p0 * iP(Msup, k), sh = nShock(Msup, k), p6 = p4 * sh.pr;
      st.add('Critical back pressures (choked throat)', 'A_e/A* → M (both branches);  p = p₀(p/p₀);  shock at exit: p₆ = p₄(p₂/p₁)', `A_e/A* = ${f(AR)}: M_sub = ${f(Msub)}, M_sup = ${f(Msup)}`, `p₃ = ${f(c.Pd(p3))},  p₄ = ${f(c.Pd(p4))},  p₆ = ${f(c.Pd(p6))} ${u.pa}`, 'p₃: subsonic isentropic exit; p₄: supersonic design exit; p₆: normal shock standing at the exit.');
      out.push({ k: 'Area ratio A_e/A*', v: AR, u: '' }, { k: 'p₃ subsonic isentropic exit', v: c.Pd(p3), u: u.pa, hl: true }, { k: 'p₆ normal shock at the exit', v: c.Pd(p6), u: u.pa, hl: true }, { k: 'p₄ supersonic design exit', v: c.Pd(p4), u: u.pa, hl: true });
      let reg, Me, pe, md, xs = NaN, Ms = NaN;
      if (pb > p3) {
        reg = 'subsonic, not choked';
        Me = MofP(pb / p0, k); pe = pb;
        const Astar = Ae / iA(Me, k), Mt = MofA(At / Astar, k, false);
        md = (pe / (R * T0 * iT(Me, k))) * Me * sqrt(k * R * T0 * iT(Me, k)) * Ae;
        st.add('Subsonic flow everywhere', 'p_b > p₃  ⇒  p_e = p_b', `M_e = ${f(Me)};  throat A_t/A* = ${f(At / Astar)}`, `M_throat = ${f(Mt)} (< 1)`, 'The nozzle acts as a venturi.');
        out.push({ k: 'Throat Mach number', v: Mt, u: '' });
      } else {
        md = ms * At;
        st.add('Choked throat: mass flow', 'ṁ = A_t p₀√(k/(RT₀)) [2/(k+1)]^((k+1)/(2(k−1)))', `A_t = ${f(At)} ${u.A}`, `ṁ = ${f(md)} ${u.m}`, '');
        if (pb > p6) {
          reg = 'normal shock inside the diverging section';
          // shock area such that the exit pressure equals p_b
          const pexit = (As) => { const M1 = MofA(As / At, k, true), s1 = nShock(M1, k), p02 = p0 * s1.p0r, A2s = At / s1.p0r, M2e = MofA(Ae / A2s, k, false); return p02 * iP(M2e, k); };
          const As = bis((a) => -pexit(a), At * (1 + 1e-9), Ae, -pb);
          Ms = MofA(As / At, k, true);
          const s1 = nShock(Ms, k), p02 = p0 * s1.p0r;
          Me = MofA(Ae / (At / s1.p0r), k, false); pe = pb;
          xs = As;
          st.add('Shock location', 'choose A_s so that the subsonic flow after the shock leaves at p_e = p_b', `p₆ < p_b = ${f(c.Pd(pb))} < p₃`, `A_s = ${f(As)} ${u.A} (A_s/A_t = ${f(As / At)}),  M before shock = ${f(Ms)}`, `After the shock: p₀₂ = ${f(c.Pd(p02))} ${u.pa}, exit M_e = ${f(Me)}.`);
          out.push({ k: 'Shock area A_s', v: As, u: u.A, hl: true }, { k: 'Shock diameter', v: sqrt((4 * As) / PI) / u.dF, u: u.D, hl: true }, { k: 'Mach number just before the shock', v: Ms, u: '' }, { k: 'Stagnation pressure after the shock', v: c.Pd(p02), u: u.pa });
        } else if (abs(pb - p6) < 1e-9 * p0) { reg = 'normal shock at the exit plane'; Me = sh.M2; pe = pb; }
        else if (pb > p4 * (1 + 1e-9)) { reg = 'over-expanded: oblique shocks outside the exit'; Me = Msup; pe = p4; }
        else if (pb >= p4 * (1 - 1e-9)) { reg = 'design condition: isentropic supersonic exit'; Me = Msup; pe = p4; }
        else { reg = 'under-expanded: expansion waves outside the exit'; Me = Msup; pe = p4; }
      }
      st.add('Flow regime', 'compare p_b with p₃, p₆ and p₄', `p_b = ${f(c.Pd(pb))} ${u.pa}`, reg, '');
      exitOut(Me, pe, Ae);
      out.push({ k: 'Mass flow ṁ', v: md, u: u.m, hl: true }, { k: 'Weight flow G', v: md * u.g, u: u.G });
      Object.assign(geo, { cd: true, AR, At, Ae, Me, Msub, Msup, pb, p3, p4, p6, regime: reg, xs, Ms });
      return done(st, out, warn, { cls: /shock|over|under/.test(reg) ? 'warn' : 'ok', text: reg }, geo);
    }

    /* ---------- constriction in a pipe (Schaum eq. 7) ---------- */
    if (topic === 'ven') {
      const p1 = c.P(p.vp1), T1 = c.T(p.vT1), p2 = c.P(p.vp2);
      if (!(p1 > 0 && T1 > 0 && p2 > 0)) return fail(['Enter positive absolute pressures and temperature.']);
      if (!(p.vD1 > p.vD2 && p.vD2 > 0)) return fail(['The constriction must be smaller than the pipe.']);
      if (p2 >= p1) return fail(['The constriction pressure must be below the pipe pressure.']);
      const A1 = area(p.vD1), A2 = area(p.vD2), rho1 = p1 / (R * T1), r = p2 / p1;
      st.add('Pipe state', 'ρ₁ = p₁/(RT₁),  γ₁ = ρ₁g', `p₁ = ${c.pTxt(p.vp1)},  T₁ = ${c.tTxt(p.vT1)}`, `ρ₁ = ${f(rho1)} ${u.rho},  γ₁ = ${f(rho1 * u.g)} ${u.gam}`, '');
      let rr = r;
      if (r < pCrit(k)) { warn.push(`p₂/p₁ = ${f(r)} is below the critical ratio ${f(pCrit(k))}: the constriction is choked, and the flow is computed at the critical ratio.`); rr = pCrit(k); }
      const num = ((2 * k) / (k - 1)) * p1 * rho1 * (pow(rr, 2 / k) - pow(rr, (k + 1) / k));
      const den = 1 - (A2 / A1) ** 2 * pow(rr, 2 / k);
      const md = p.vCd * A2 * sqrt(num / den);
      st.add('Flow through the constriction (Schaum eq. 7)', 'G = A₂ √{ [2gk/(k−1)] p₁γ₁ [(p₂/p₁)^(2/k) − (p₂/p₁)^((k+1)/k)] / [1 − (A₂/A₁)²(p₂/p₁)^(2/k)] }', `A₁ = ${f(A1)}, A₂ = ${f(A2)} ${u.A};  p₂/p₁ = ${f(rr)}` + (p.vCd !== 1 ? `;  C = ${f(p.vCd)}` : ''), `G = ${f(md * u.g)} ${u.G},  ṁ = ${f(md)} ${u.m}`, 'Mass form: ṁ = G/g with ρ₁ in place of γ₁/g.');
      const rho2 = rho1 * pow(rr, 1 / k), V1 = md / (rho1 * A1), V2 = md / (rho2 * A2), T2 = T1 * pow(rr, (k - 1) / k);
      out.push({ k: 'Weight flow G', v: md * u.g, u: u.G, hl: true }, { k: 'Mass flow ṁ', v: md, u: u.m, hl: true }, { k: 'Pipe velocity V₁', v: V1, u: u.V }, { k: 'Throat velocity V₂', v: V2, u: u.V, hl: true }, { k: 'Throat temperature T₂', v: T2, u: u.T }, { k: 'Throat density ρ₂', v: rho2, u: u.rho }, { k: 'Throat Mach number', v: V2 / sqrt(k * R * T2), u: '' }, { k: 'Pipe Mach number', v: V1 / sqrt(k * R * T1), u: '' }, { k: 'Unit weight γ₁', v: rho1 * u.g, u: u.gam });
      return done(st, out, warn, { cls: warn.length ? 'warn' : 'ok', text: `G = ${f(md * u.g)} ${u.G}` }, { topic, D1: p.vD1, D2: p.vD2, V1, V2 });
    }

    /* ---------- shocks and expansion waves ---------- */
    if (topic === 'shock') {
      const s = stateOf(Object.assign({}, p, { by: p.by === 'VTp' ? 'VTp' : 'MTp' }), c, st, ' upstream (1)');
      if (s.err) return fail([s.err], warn, st.list);
      const M1 = s.M;
      if (!(M1 > 1)) return fail([`The upstream flow must be supersonic (M₁ = ${f(M1)}).`], warn, st.list);
      const kind = p.shK;
      let M2, Tr, pr, rr, p0r, th = NaN, be = NaN;
      if (kind === 'normal') {
        const sh = nShock(M1, k); ({ M2, pr, rr, Tr, p0r } = sh);
        st.add('Normal shock relations', 'M₂² = [M₁² + 2/(k−1)] / [2kM₁²/(k−1) − 1];  p₂/p₁ = [2kM₁² − (k−1)]/(k+1);  ρ₂/ρ₁ = (k+1)M₁²/[(k−1)M₁² + 2]', `M₁ = ${f(M1)}`, `M₂ = ${f(M2)},  p₂/p₁ = ${f(pr)},  T₂/T₁ = ${f(Tr)}`, '');
      } else if (kind === 'oblique') {
        const tm = thetaMax(M1, k), mu = Math.asin(1 / M1);
        if (p.obBy === 'beta') {
          be = p.beta * DEG;
          if (!(be > mu && be <= PI / 2 + 1e-12)) return fail([`The wave angle must lie between the Mach angle ${f(mu / DEG)}° and 90°.`], warn, st.list);
          th = thetaOf(M1, be, k);
        } else {
          th = p.theta * DEG;
          if (!(th > 0)) return fail(['Enter a positive deflection angle.'], warn, st.list);
          if (th > tm.t) return fail([`θ = ${f(p.theta)}° exceeds θ_max = ${f(tm.t / DEG)}° for M₁ = ${f(M1)}: the shock detaches (a bow shock forms).`], warn, st.list);
          be = p.obW === 'strong' ? bis((b) => -thetaOf(M1, b, k), tm.b, PI / 2, -th) : bis((b) => thetaOf(M1, b, k), mu, tm.b, th);
          st.add('Wave angle from the deflection', 'tan θ = 2 cot β (M₁² sin²β − 1) / [M₁²(k + cos 2β) + 2]', `θ = ${f(p.theta)}°, ${p.obW === 'strong' ? 'strong' : 'weak'} solution`, `β = ${f(be / DEG)}°`, `θ_max = ${f(tm.t / DEG)}° at β = ${f(tm.b / DEG)}°.`);
        }
        const M1n = M1 * Math.sin(be), sh = nShock(M1n, k);
        ({ pr, rr, Tr, p0r } = sh);
        M2 = sh.M2 / Math.sin(be - th);
        st.add('Normal component through the oblique shock', 'M₁n = M₁ sin β → normal-shock relations → M₂n;  M₂ = M₂n / sin(β − θ)', `M₁n = ${f(M1)} sin ${f(be / DEG)}° = ${f(M1n)}`, `M₂n = ${f(sh.M2)},  θ = ${f(th / DEG)}°,  M₂ = ${f(M2)}`, '');
        out.push({ k: 'Wave angle β', v: be / DEG, u: '°', hl: true }, { k: 'Deflection θ', v: th / DEG, u: '°', hl: true }, { k: 'Normal Mach M₁n', v: M1n, u: '' }, { k: 'Normal Mach M₂n', v: sh.M2, u: '' }, { k: 'Maximum deflection θ_max', v: tm.t / DEG, u: '°' });
      } else {
        // Prandtl–Meyer expansion (or isentropic compression for a negative turn)
        th = (p.shK === 'comp' ? -1 : 1) * abs(p.theta) * DEG;
        const n1 = nuPM(M1, k), n2 = n1 + th;
        if (n2 <= 0) return fail(['The turn is too large for an isentropic compression from this Mach number.'], warn, st.list);
        const nmax = (PI / 2) * (sqrt((k + 1) / (k - 1)) - 1);
        if (n2 >= nmax) return fail([`The turn exceeds the maximum Prandtl–Meyer angle ${f(nmax / DEG)}°.`], warn, st.list);
        M2 = bis((M) => nuPM(M, k), 1, 1e4, n2);
        Tr = iT(M2, k) / iT(M1, k); pr = iP(M2, k) / iP(M1, k); rr = iR(M2, k) / iR(M1, k); p0r = 1;
        st.add('Prandtl–Meyer function', 'ω(M) = √((k+1)/(k−1)) tan⁻¹√[(k−1)(M²−1)/(k+1)] − tan⁻¹√(M²−1);  ω₂ = ω₁ ± θ', `ω₁ = ${f(n1 / DEG)}°,  ω₂ = ${f(n1 / DEG)} ${th >= 0 ? '+' : '−'} ${f(abs(th) / DEG)} = ${f(n2 / DEG)}°`, `M₂ = ${f(M2)}`, 'Isentropic: T₂/T₁ and p₂/p₁ follow from T/T₀ and p/p₀ at M₁ and M₂.');
        out.push({ k: 'ω₁', v: n1 / DEG, u: '°' }, { k: 'ω₂', v: n2 / DEG, u: '°' }, { k: 'Mach angle μ₁', v: Math.asin(1 / M1) / DEG, u: '°' }, { k: 'Mach angle μ₂', v: Math.asin(1 / M2) / DEG, u: '°' });
      }
      const T2 = s.T * Tr, p2 = s.p * pr, V2 = M2 * sqrt(k * R * T2), p02 = s.p0 * p0r, ds = -R * ln(p0r);
      st.add('State behind the wave', 'T₂ = T₁(T₂/T₁),  p₂ = p₁(p₂/p₁),  V₂ = M₂√(kRT₂)', `T₁ = ${f(s.T)} ${u.T},  p₁ = ${f(c.Pd(s.p))} ${u.pa}`, `T₂ = ${f(T2)} ${u.T},  p₂ = ${f(c.Pd(p2))} ${u.pa},  V₂ = ${f(V2)} ${u.V}`, '');
      out.unshift({ k: 'Upstream Mach M₁', v: M1, u: '' }, { k: 'Upstream velocity V₁', v: s.V, u: u.V });
      out.push({ k: 'Mach number M₂', v: M2, u: '', hl: true }, { k: 'Pressure p₂', v: c.Pd(p2), u: u.pa, hl: true }, { k: 'Temperature T₂', v: T2, u: u.T, hl: true }, { k: 'Velocity V₂', v: V2, u: u.V, hl: true }, { k: 'Density ρ₂', v: s.rho * rr, u: u.rho },
        { k: 'p₂/p₁', v: pr, u: '' }, { k: 'T₂/T₁', v: Tr, u: '' }, { k: 'ρ₂/ρ₁', v: rr, u: '' }, { k: 'p₀₂/p₀₁', v: p0r, u: '' }, { k: 'Stagnation pressure p₀₂', v: c.Pd(p02), u: u.pa }, { k: 'Stagnation temperature T₀ (unchanged)', v: s.T0, u: u.T }, { k: 'Entropy rise Δs', v: ds, u: u.s });
      return done(st, out, warn, { cls: 'ok', text: `M₁ = ${f(M1)} → M₂ = ${f(M2)}` }, { topic, kind, M1, M2, th, be, pr, Tr, rr });
    }

    /* ---------- Fanno flow ---------- */
    if (topic === 'fanno') {
      const s = stateOf(p, c, st, ' at the inlet (1)');
      if (s.err) return fail([s.err], warn, st.list);
      const D = p.fD * u.dF, ff = p.ff;
      if (!(D > 0 && ff > 0)) return fail(['Enter the pipe diameter and friction factor.'], warn, st.list);
      let M1 = s.M; const sup = M1 > 1;
      if (abs(M1 - 1) < 1e-9) return fail(['The inlet is already sonic: no pipe length is possible.'], warn, st.list);
      let x1 = fanL(M1, k), Lmax = (x1 * D) / ff;
      st.add('Maximum (choking) length', 'fL_max/D = (1 − M²)/(kM²) + [(k+1)/(2k)] ln{(k+1)M² / [2 + (k−1)M²]}', `M₁ = ${f(M1)}`, `fL_max/D = ${f(x1)},  L_max = ${f(x1)} × ${f(D)}/${f(ff)} = ${f(Lmax)} ${u.L}`, 'f is the Darcy friction factor.');
      let s1 = s, reduced = false;
      if (p.fFind === 'L' && p.fL > Lmax && !sup) {
        // choked: the inlet Mach number falls so that L = L_max
        x1 = (ff * p.fL) / D; M1 = MofFan(x1, k, false); reduced = true;
        const cp1 = { M: M1, T0: s.T0, p0: s.p0 };
        cp1.T = s.T0 * iT(M1, k); cp1.p = s.p0 * iP(M1, k); cp1.a = sqrt(k * R * cp1.T); cp1.V = M1 * cp1.a; cp1.rho = cp1.p / (R * cp1.T);
        if (p.by === 'MTp' || p.by === 'VTp') warn.push('The inlet pressure and temperature were given as static values; with the pipe choked they are recomputed from the same stagnation state.');
        st.add('Pipe longer than L_max: the flow chokes', 'fL/D = fL_max/D at the new inlet Mach number', `fL/D = ${f(ff)} × ${f(p.fL)}/${f(D)} = ${f(x1)}`, `new M₁ = ${f(M1)} (M = 1 at the exit)`, 'The entrance flow (and mass flow) is reduced.');
        warn.push(`L = ${f(p.fL)} ${u.L} exceeds L_max = ${f(Lmax)} ${u.L}: the pipe chokes and the inlet Mach number drops to ${f(M1)}.`);
        s1 = cp1; Lmax = p.fL;
      } else if (p.fFind === 'L' && p.fL > Lmax && sup) {
        warn.push(`L = ${f(p.fL)} ${u.L} exceeds L_max = ${f(Lmax)} ${u.L} for supersonic inlet flow: a normal shock forms in the pipe (not solved here).`);
      }
      const Ts = s1.T / fanT(M1, k), ps = s1.p / fanP(M1, k), Vs = s1.V / fanV(M1, k), p0s = s1.p0 / fanP0(M1, k);
      st.add('Reference (sonic, M = 1) state', 'T* = T₁/(T/T*),  p* = p₁/(p/p*),  V* = V₁/(V/V*),  p₀* = p₀₁/(p₀/p₀*)', `T/T* = ${f(fanT(M1, k))},  p/p* = ${f(fanP(M1, k))},  V/V* = ${f(fanV(M1, k))},  p₀/p₀* = ${f(fanP0(M1, k))}`, `T* = ${f(Ts)} ${u.T},  p* = ${f(c.Pd(ps))} ${u.pa},  V* = ${f(Vs)} ${u.V},  p₀* = ${f(c.Pd(p0s))} ${u.pa}`, '');
      out.push({ k: 'Inlet Mach number M₁', v: M1, u: '', hl: true }, { k: 'Inlet velocity V₁', v: s1.V, u: u.V }, { k: 'Inlet temperature T₁', v: s1.T, u: u.T }, { k: 'Inlet pressure p₁', v: c.Pd(s1.p), u: u.pa }, { k: 'Stagnation temperature T₀ (constant)', v: s1.T0, u: u.T },
        { k: 'Maximum length L_max', v: (x1 * D) / ff, u: u.L, hl: true }, { k: 'fL_max/D at inlet', v: x1, u: '' }, { k: 'T*', v: Ts, u: u.T }, { k: 'p*', v: c.Pd(ps), u: u.pa }, { k: 'V* (exit speed when choked)', v: Vs, u: u.V }, { k: 'p₀*', v: c.Pd(p0s), u: u.pa });
      const A = (PI / 4) * D * D, md = s1.rho * s1.V * A;
      out.push({ k: 'Mass flow ṁ', v: md, u: u.m, hl: true });
      let M2 = NaN, L = NaN;
      if (p.fFind === 'L') {
        L = p.fL;
        if (!(L > 0)) return fail(['Enter the pipe length.'], warn, st.list);
        const x2 = Math.max(0, x1 - (ff * L) / D);
        M2 = x2 <= 1e-12 ? 1 : MofFan(x2, k, sup);
        st.add('Exit Mach number', 'fL′/D = fL_max/D − fL/D  → M₂', `fL′/D = ${f(x1)} − ${f((ff * L) / D)} = ${f(x2)}`, `M₂ = ${f(M2)}`, '');
      } else {
        M2 = p.fM2;
        if (!(M2 > 0) || (sup ? M2 > M1 || M2 < 1 : M2 < M1 || M2 > 1)) return fail([`On this branch the exit Mach number must lie between M₁ = ${f(M1)} and 1.`], warn, st.list);
        L = ((x1 - fanL(M2, k)) * D) / ff;
        st.add('Length to reach M₂', 'L = (D/f)[(fL_max/D)₁ − (fL_max/D)₂]', `(fL_max/D)₂ = ${f(fanL(M2, k))}`, `L = ${f(L)} ${u.L}`, '');
      }
      const T2 = Ts * fanT(M2, k), p2 = ps * fanP(M2, k), V2 = Vs * fanV(M2, k), p02 = p0s * fanP0(M2, k);
      const Ff = (s1.p - p2) * A - md * (V2 - s1.V);
      st.add('Exit state and friction force', 'T₂ = T*(T/T*)₂, p₂ = p*(p/p*)₂, V₂ = V*(V/V*)₂;  F_f = (p₁ − p₂)A − ṁ(V₂ − V₁)', `A = ${f(A)} ${u.A},  ṁ = ${f(md)} ${u.m}`, `F_f = ${f(Ff)} ${u.F}`, '');
      out.push({ k: 'Exit Mach number M₂', v: M2, u: '', hl: true }, { k: 'Length L', v: L, u: u.L, hl: p.fFind !== 'L' }, { k: 'Exit velocity V₂', v: V2, u: u.V, hl: true }, { k: 'Exit temperature T₂', v: T2, u: u.T, hl: true }, { k: 'Exit pressure p₂', v: c.Pd(p2), u: u.pa, hl: true }, { k: 'Exit stagnation pressure p₀₂', v: c.Pd(p02), u: u.pa, hl: true }, { k: 'Friction force F_f', v: Ff, u: u.F, hl: true }, { k: 'Exit density ρ₂', v: p2 / (R * T2), u: u.rho });
      return done(st, out, warn, { cls: reduced ? 'warn' : 'ok', text: `M₁ = ${f(M1)} → M₂ = ${f(M2)}` }, { topic, M1, M2, L, Lmax: (x1 * D) / ff, sup, prof: (t) => MofFan(Math.max(0, x1 - t * (x1 - fanL(M2, k))), k, sup) });
    }

    /* ---------- Rayleigh flow ---------- */
    if (topic === 'ray') {
      const s = stateOf(p, c, st, ' at section 1');
      if (s.err) return fail([s.err], warn, st.list);
      const M1 = s.M, sup = M1 > 1;
      if (!(M1 > 0)) return fail(['The inlet must be moving.'], warn, st.list);
      const T0s = s.T0 / rayT0(M1, k), Ts = s.T / rayT(M1, k), ps = s.p / rayP(M1, k), Vs = s.V / rayV(M1, k), p0s = s.p0 / rayP0(M1, k);
      st.add('Reference (M = 1) state', 'T₀/T₀* = (k+1)M²[2 + (k−1)M²]/(1 + kM²)²,  T/T* = M²[(1+k)/(1+kM²)]²,  p/p* = (1+k)/(1+kM²),  V/V* = (1+k)M²/(1+kM²)', `M₁ = ${f(M1)}: T₀/T₀* = ${f(rayT0(M1, k))}, T/T* = ${f(rayT(M1, k))}, p/p* = ${f(rayP(M1, k))}, V/V* = ${f(rayV(M1, k))}`, `T₀* = ${f(T0s)},  T* = ${f(Ts)} ${u.T},  p* = ${f(c.Pd(ps))} ${u.pa},  V* = ${f(Vs)} ${u.V}`, '');
      let T02, q;
      if (p.rBy === 'T02') { T02 = c.T(p.rT02); q = cp * (T02 - s.T0); }
      else { q = (p.rBy === 'ql' ? p.rq * p.rL : p.rq) * u.ef; T02 = s.T0 + q / cp; }
      st.add('Stagnation temperature after heating', 'q = c_p(T₀₂ − T₀₁)', `q = ${f(q / u.ef)} ${u.e},  c_p = ${f(cp)}`, `T₀₂ = ${f(T02)} ${u.T}`, q < 0 ? 'Heat is removed (cooling).' : '');
      const qmax = cp * (T0s - s.T0);
      out.push({ k: 'Inlet Mach number M₁', v: M1, u: '' }, { k: 'Inlet stagnation temperature T₀₁', v: s.T0, u: u.T }, { k: 'Heat added q', v: q / u.ef, u: u.e }, { k: 'Heat to choke q_max', v: qmax / u.ef, u: u.e }, { k: 'T₀*', v: T0s, u: u.T });
      if (!(T02 > 0)) return fail(['Too much heat is removed.'], warn, st.list);
      if (T02 > T0s * (1 + 1e-9)) return fail([`The heat added exceeds q_max = ${f(qmax / u.ef)} ${u.e}: the duct chokes thermally and the inlet conditions must change.`], warn, st.list);
      const r2 = T02 / T0s;
      const M2 = r2 >= 1 - 1e-12 ? 1 : MofRay(r2, k, sup);
      const T2 = Ts * rayT(M2, k), p2 = ps * rayP(M2, k), V2 = Vs * rayV(M2, k), p02 = p0s * rayP0(M2, k);
      st.add('Section 2', 'T₀₂/T₀* → M₂ (same branch), then the ratios at M₂', `T₀₂/T₀* = ${f(T02)}/${f(T0s)} = ${f(r2)}`, `M₂ = ${f(M2)},  T₂ = ${f(T2)} ${u.T},  p₂ = ${f(c.Pd(p2))} ${u.pa},  V₂ = ${f(V2)} ${u.V}`, '');
      out.push({ k: 'Exit stagnation temperature T₀₂', v: T02, u: u.T, hl: true }, { k: 'Mach number M₂', v: M2, u: '', hl: true }, { k: 'Temperature T₂', v: T2, u: u.T, hl: true }, { k: 'Pressure p₂', v: c.Pd(p2), u: u.pa, hl: true }, { k: 'Velocity V₂', v: V2, u: u.V, hl: true }, { k: 'Stagnation pressure p₀₂', v: c.Pd(p02), u: u.pa }, { k: 'Density ρ₂', v: p2 / (R * T2), u: u.rho }, { k: 'Entropy change Δs', v: cp * ln(T2 / s.T) - R * ln(p2 / s.p), u: u.s });
      if (p.rD > 0) { const A = area(p.rD); out.push({ k: 'Mass flow ṁ', v: s.rho * s.V * A, u: u.m }, { k: 'Heat rate Q̇ = ṁq', v: (s.rho * s.V * A * q) / (u.SI ? 1000 : 550), u: u.SI ? 'kW' : 'hp' }); }
      return done(st, out, warn, { cls: 'ok', text: `M₁ = ${f(M1)} → M₂ = ${f(M2)}` }, { topic, M1, M2, sup });
    }

    /* ---------- isothermal pipe flow ---------- */
    if (topic === 'iso') {
      const T = c.T(p.iT), D = p.iD * u.dF, A = (PI / 4) * D * D, p1 = c.P(p.ip1);
      if (!(T > 0 && D > 0 && p1 > 0)) return fail(['Enter a positive temperature, diameter and inlet pressure.']);
      const mu = p.iMuBy === 'air' ? muAir(T, u) : p.iMu;
      const fr = p.ifBy;
      if (fr !== 'given' && !(mu > 0)) return fail(['Enter the gas viscosity to find the friction factor.']);
      const eD = fr === 'rough' ? (p.ieps * u.dF) / D : 0;
      const fOf = (md) => (fr === 'given' ? p.if : colebrook((4 * md) / (PI * D * mu), eD));
      const find = p.iFind;
      let md, p2, L = p.iL, fv;
      if (find === 'm') {
        p2 = c.P(p.ip2);
        if (!(p2 > 0 && p2 < p1)) return fail(['p₂ must be positive and below p₁.']);
        if (!(L > 0)) return fail(['Enter the pipe length.']);
        fv = fr === 'given' ? p.if : 0.015;
        for (let i = 0; i < 50; i++) { md = A * sqrt((p1 * p1 - p2 * p2) / (R * T * ((fv * L) / D + 2 * ln(p1 / p2)))); const fn = fOf(md); if (abs(fn - fv) < 1e-12) break; fv = fn; }
      } else {
        md = p.im * (p.imU === 'G' ? 1 / u.g : 1);
        if (!(md > 0)) return fail(['Enter the flow rate.']);
        fv = fOf(md);
        const K = (md * md * R * T) / (A * A);
        if (find === 'p2') {
          if (!(L > 0)) return fail(['Enter the pipe length.']);
          const F = (x) => p1 * p1 - x * x - K * ((fv * L) / D + 2 * ln(p1 / x));
          const xm = sqrt(K);
          if (xm >= p1 || F(xm) < 0) return fail(['The pipe is too long for this flow: the isothermal flow would choke (M reaches 1/√k) before the end.']);
          p2 = bis((x) => -F(x), xm, p1, 0);
        } else {
          p2 = c.P(p.ip2);
          if (!(p2 > 0 && p2 < p1)) return fail(['p₂ must be positive and below p₁.']);
          L = (D / fv) * ((p1 * p1 - p2 * p2) / K - 2 * ln(p1 / p2));
          if (!(L > 0)) return fail(['That pressure drop is too small for this flow: the pipe length comes out negative.']);
        }
      }
      const Re = (4 * md) / (PI * D * mu);
      st.add('Isothermal pipe flow (Schaum eq. 1)', 'p₁² − p₂² = (G²RT/(gA²)) [fL/D + 2 ln(p₁/p₂)]  (mass form: ṁ²RT/A²)', `T = ${c.tTxt(p.iT)};  A = ${f(A)} ${u.A};  p₁ = ${c.pTxt(p.ip1)}`, find === 'm' ? `G = ${f(md * u.g)} ${u.G}` : find === 'p2' ? `p₂ = ${f(c.Pd(p2))} ${u.pa}` : `L = ${f(L)} ${u.L}`, fr === 'given' ? `f = ${f(fv)} (given)` : `f = ${f(fv)} from Colebrook at Re = ${f(Re)}${fr === 'rough' ? `, ε/D = ${f(eD)}` : ' (smooth)'}; the iteration repeats until f settles.`);
      const rho1 = p1 / (R * T), V1 = md / (rho1 * A), V2 = (V1 * p1) / p2, a = sqrt(k * R * T), M1 = V1 / a, M2 = V2 / a, Ml = 1 / sqrt(k);
      const xl = (1 - k * M1 * M1) / (k * M1 * M1) + ln(k * M1 * M1), Llim = (xl * D) / fv;
      st.add('Mach numbers and the limiting length', 'M = V/√(kRT);  the flow chokes at M = 1/√k:  fL_max/D = (1 − kM₁²)/(kM₁²) + ln(kM₁²)', `V₁ = ${f(V1)},  V₂ = V₁p₁/p₂ = ${f(V2)} ${u.V}`, `M₁ = ${f(M1)},  M₂ = ${f(M2)},  L_max = ${f(Llim)} ${u.L}`, '');
      if (M2 > Ml) warn.push(`M₂ = ${f(M2)} exceeds 1/√k = ${f(Ml)}: isothermal flow is not possible that far.`);
      if (p2 / p1 < 0.6) warn.push('The pressure drop is large; Schaum warns that the isothermal equation is meant for moderate drops.');
      const qh = md * R * T * ln(p1 / p2);
      out.push({ k: 'Weight flow G', v: md * u.g, u: u.G, hl: find === 'm' }, { k: 'Mass flow ṁ', v: md, u: u.m, hl: find === 'm' }, { k: 'Pressure p₂', v: c.Pd(p2), u: u.pa, hl: find === 'p2' }, { k: 'Length L', v: L, u: u.L, hl: find === 'L' }, { k: 'Friction factor f', v: fv, u: '' }, { k: 'Reynolds number', v: Re, u: '' },
        { k: 'Velocity V₁', v: V1, u: u.V }, { k: 'Velocity V₂', v: V2, u: u.V }, { k: 'Mach number M₁', v: M1, u: '' }, { k: 'Mach number M₂', v: M2, u: '' }, { k: 'Limiting length (M = 1/√k)', v: Llim, u: u.L }, { k: 'Unit weight γ₁', v: rho1 * u.g, u: u.gam }, { k: 'Heat added to keep T constant', v: (qh + 0.5 * md * (V2 * V2 - V1 * V1)) / (u.SI ? 1000 : 550), u: u.SI ? 'kW' : 'hp' });
      return done(st, out, warn, { cls: warn.length ? 'warn' : 'ok', text: find === 'm' ? `G = ${f(md * u.g)} ${u.G}` : find === 'p2' ? `p₂ = ${f(c.Pd(p2))} ${u.pa}` : `L = ${f(L)} ${u.L}` }, { topic, M1, M2, p1, p2 });
    }

    /* ---------- Pitot-static tube ---------- */
    if (topic === 'pitot') {
      const ps = c.P(p.pp), pt = c.P(p.pt);
      if (!(ps > 0 && pt > ps)) return fail(['The Pitot (total) pressure must exceed the static pressure.']);
      const r = pt / ps, rc = 1 / pCrit(k);
      let M;
      if (r <= rc) { M = MofP(ps / pt, k); st.add('Subsonic: isentropic stagnation', 'p₀/p = [1 + (k−1)M²/2]^(k/(k−1))', `p₀/p = ${f(r)} ≤ ${f(rc)}`, `M = ${f(M)}`, ''); }
      else {
        const ray = (m) => pow(((k + 1) ** 2 * m * m) / (4 * k * m * m - 2 * (k - 1)), k / (k - 1)) * ((1 - k + 2 * k * m * m) / (k + 1));
        M = bis(ray, 1, 100, r);
        st.add('Supersonic: Rayleigh Pitot formula (shock ahead of the tube)', 'p₀₂/p₁ = {(k+1)²M²/[4kM² − 2(k−1)]}^(k/(k−1)) · [1 − k + 2kM²]/(k+1)', `p₀₂/p₁ = ${f(r)} > ${f(rc)}`, `M = ${f(M)}`, '');
      }
      let T, V = NaN;
      if (p.ptBy === 'T0') { const T0 = c.T(p.pT); T = T0 * iT(M, k); } else T = c.T(p.pT);
      if (T > 0) { V = M * sqrt(k * R * T); st.add('Velocity', 'V = M√(kRT)', `T = ${f(T)} ${u.T}`, `V = ${f(V)} ${u.V}`, ''); }
      const rho = ps / (R * T), Vi = sqrt((2 * (pt - ps)) / rho);
      out.push({ k: 'Mach number M', v: M, u: '', hl: true }, { k: 'Velocity V', v: V, u: u.V, hl: true }, { k: 'Static temperature T', v: T, u: u.T }, { k: 'p_total/p_static', v: r, u: '' }, { k: 'Density ρ', v: rho, u: u.rho }, { k: 'Incompressible estimate √(2Δp/ρ)', v: Vi, u: u.V }, { k: 'Error of the incompressible estimate', v: ((Vi - V) / V) * 100, u: '%' });
      return done(st, out, warn, { cls: 'ok', text: `M = ${f(M)}, V = ${f(V)} ${u.V}` }, { topic, M, V });
    }
    return fail(['Choose a topic.']);
  }

  Object.assign(P0, { compFlow, compUnits: units, compFn: { iT, iP, iR, iA, MofA, nShock, fanL, rayT0, nuPM, thetaOf, thetaMax } });
})(window);
