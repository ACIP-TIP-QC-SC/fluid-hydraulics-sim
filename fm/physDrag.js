/* =====================================================================
 * PHYSICS — drag, lift and boundary layers; similitude and model laws
 * (2026-11-25 book-coverage upgrade, stage 5)
 *   body   : drag and lift on a body (sphere, cylinder, plate normal to the
 *            flow, any shape with a given C_D), drag power, inclined plates
 *   fall   : terminal velocity of a sphere (or any body) in a fluid, or the
 *            viscosity / particle density / size from an observed velocity
 *   wing   : airfoils and airplanes (lift = weight), C_L and C_D linear in α
 *   coast  : a vehicle coasting against drag (F = ½ C_D ρ A V²)
 *   plate  : boundary layer on a flat plate (laminar, turbulent, combined),
 *            thicknesses, wall shear, friction drag, Blasius velocity
 *   similitude: Reynolds, Froude, Weber and Mach model laws
 * Formulas: Schaum's Outline FMH ch 6 & 13; Hibbeler, Fluid Mechanics ch 8 & 11.
 * Inputs are in the display units of the chosen system:
 *   SI: diameters mm, lengths m, V m/s, ρ kg/m³, γ N/m³, μ Pa·s, ν m²/s,
 *       forces N, power kW, mass kg;  EN: in, ft, ft/s, slug/ft³, lb/ft³,
 *       lb·s/ft², ft²/s, lb, hp, slug.
 * Result shape as physics.js: { ok, err, warn, status, out, steps, geo }
 * ===================================================================== */
(function (root) {
  'use strict';
  const P0 = root.Physics;
  const f = P0.fmt;
  const PI = Math.PI, DEG = PI / 180, sqrt = Math.sqrt, abs = Math.abs, pow = Math.pow, log10 = Math.log10;
  function Steps() { const list = []; return { list, add(t, fo, s, r, n) { list.push({ t, f: fo, s, r, n }); } }; }
  const fail = (err, warn, steps) => ({ ok: false, err, warn: warn || [], steps: steps || [], out: [], geo: {} });
  const ok = (st, out, warn, status, geo) => ({ ok: true, err: [], warn: warn || [], steps: st.list, out, status, geo });
  const units = (U) => {
    const SI = U.id === 'SI';
    return {
      SI, g: U.g, dF: SI ? 0.001 : 1 / 12, du: SI ? 'mm' : 'in', L: SI ? 'm' : 'ft', v: SI ? 'm/s' : 'ft/s', A: SI ? 'm²' : 'ft²', Vol: SI ? 'm³' : 'ft³',
      rho: SI ? 'kg/m³' : 'slug/ft³', gam: SI ? 'N/m³' : 'lb/ft³', mu: SI ? 'Pa·s' : 'lb·s/ft²', nu: SI ? 'm²/s' : 'ft²/s', F: SI ? 'N' : 'lb', m: SI ? 'kg' : 'slug',
      Pu: SI ? 'kW' : 'hp', PF: SI ? 1000 : 550, tau: SI ? 'Pa' : 'lb/ft²', T: SI ? '°C' : '°F', pa: SI ? 'kPa (abs)' : 'psia', Q: SI ? 'm³/s' : 'ft³/s', sig: SI ? 'N/m' : 'lb/ft',
    };
  };

  /* ------------------------------------------------------------------ */
  /* Fluid properties                                                    */
  /* ------------------------------------------------------------------ */
  function airSI(Tc, pk) { const T = Tc + 273.15; return { rho: (pk * 1000) / (286.9 * T), mu: (1.458e-6 * pow(T, 1.5)) / (T + 110.4) }; }
  /** p: {fluid, T, pa, dBy, rhoG, gamG, vBy, muG, nuG} (keys may be prefixed) */
  function fluidOf(p, U, u, pre) {
    const k0 = (n) => p[(pre || '') + n];
    const k = (n) => (!u.SI && (n === 'T' || n === 'pa') && k0(n + 'E') !== undefined ? k0(n + 'E') : k0(n));
    const fl = k('fluid');
    if (fl === 'water') {
      const rows = P0.WATER.H[U.id], it = P0.interpTable(rows, k('T'), 0);
      if (!it) return { err: `Water temperature must be between ${rows[0][0]} and ${rows[rows.length - 1][0]} ${u.T}.` };
      const rho = it.row[1], mu = it.row[2];
      return { rho, mu, nu: mu / rho, name: `water at ${f(k('T'))} ${u.T}`, src: `table (Hibbeler App. A): ρ = ${f(rho)} ${u.rho}, μ = ${f(mu)} ${u.mu}` };
    }
    if (fl === 'air') {
      let r;
      if (u.SI) r = airSI(k('T'), k('pa'));
      else { const s = airSI(((k('T') - 32) * 5) / 9, k('pa') * 6.894757); r = { rho: s.rho * 0.00194032, mu: s.mu / 47.880 }; }
      if (!(r.rho > 0) || !(r.mu > 0)) return { err: 'Check the air temperature and pressure.' };
      return { rho: r.rho, mu: r.mu, nu: r.mu / r.rho, name: `air at ${f(k('T'))} ${u.T}, ${f(k('pa'))} ${u.pa}`, src: `ideal gas ρ = p/(RT), R = 286.9 J/(kg·K); Sutherland μ = 1.458×10⁻⁶ T^1.5/(T + 110.4): ρ = ${f(r.rho)} ${u.rho}, μ = ${f(r.mu)} ${u.mu}` };
    }
    const rho = k('dBy') === 'gam' ? k('gamG') / u.g : k('rhoG');
    if (!(rho > 0)) return { err: 'The fluid density must be positive.' };
    let mu = k('muG'), nu;
    if (k('vBy') === 'nu') { nu = k('nuG'); mu = nu * rho; } else nu = mu / rho;
    const src = (k('dBy') === 'gam' ? `ρ = γ/g = ${f(k('gamG'))}/${f(u.g)} = ${f(rho)} ${u.rho}` : `ρ = ${f(rho)} ${u.rho}`) + (k('vBy') === 'nu' ? `, ν = ${f(nu)} ${u.nu}` : `, μ = ${f(mu)} ${u.mu}`);
    return { rho, mu, nu, name: 'the given fluid', src, noVisc: !(mu > 0) };
  }

  /* ------------------------------------------------------------------ */
  /* Drag-coefficient correlations                                       */
  /* ------------------------------------------------------------------ */
  // Sphere: Brown & Lawler (2003) to Re 1e5, Morrison (2013) beyond, blended 1e5–3e5
  const cdBL = (Re) => (24 / Re) * (1 + 0.15 * pow(Re, 0.681)) + 0.407 / (1 + 8710 / Re);
  const cdMor = (Re) => 24 / Re + (2.6 * (Re / 5)) / (1 + pow(Re / 5, 1.52)) + (0.411 * pow(Re / 263000, -7.94)) / (1 + pow(Re / 263000, -8)) + (0.25 * (Re / 1e6)) / (1 + Re / 1e6);
  function cdSphere(Re) {
    if (Re <= 1e5) return cdBL(Re);
    if (Re >= 3e5) return cdMor(Re);
    const t = log10(Re / 1e5) / log10(3);
    return (1 - t) * cdBL(Re) + t * cdMor(Re);
  }
  // Long circular cylinder normal to the flow: Sucker & Brauer
  const cdCyl = (Re) => 1.18 + 6.8 / pow(Re, 0.89) + 1.96 / sqrt(Re) - (0.0004 * Re) / (1 + 3.64e-7 * Re * Re);
  const cdOf = (shape, how, Re, CDg) => (how === 'given' ? CDg : how === 'stokes' ? 24 / Re : shape === 'cyl' ? cdCyl(Re) : cdSphere(Re));
  const cdTxt = (shape, how) => how === 'stokes' ? 'C_D = 24/Re (Stokes, Re < 1)' : shape === 'cyl' ? 'C_D = 1.18 + 6.8/Re^0.89 + 1.96/√Re − 0.0004 Re/(1 + 3.64×10⁻⁷ Re²) (cylinder curve fit)' : 'C_D = (24/Re)(1 + 0.15 Re^0.681) + 0.407/(1 + 8710/Re) (sphere curve fit)';

  function bisect(g, a, b, n) {
    let fa = g(a);
    for (let i = 0; i < (n || 200); i++) { const m = 0.5 * (a + b), fm = g(m); if (!isFinite(fm)) return NaN; if ((fm > 0) === (fa > 0)) { a = m; fa = fm; } else b = m; if (abs(b - a) < 1e-14 * Math.max(1, abs(m))) break; }
    return 0.5 * (a + b);
  }
  // root of g in log space between lo and hi (both > 0)
  function bisectLog(g, lo, hi) { const G = (L) => g(Math.exp(L)); const a = Math.log(lo), b = Math.log(hi); if (G(a) * G(b) > 0) return NaN; return Math.exp(bisect(G, a, b, 300)); }

  /* ------------------------------------------------------------------ */
  /* Drag and lift on a body                                             */
  /* ------------------------------------------------------------------ */
  function geomOf(p, u) {
    if (p.shape === 'sphere') { const D = p.D * u.dF; return { A: (PI * D * D) / 4, Lc: D, D, txt: `A = πD²/4 = π(${f(D)})²/4`, name: 'sphere' }; }
    if (p.shape === 'cyl') { const D = p.D * u.dF, Lb = p.Lb > 0 ? p.Lb : 1; return { A: D * Lb, Lc: D, D, Lb, per: !(p.Lb > 0), txt: p.Lb > 0 ? `A = D L = ${f(D)} × ${f(Lb)}` : `A = D × (1 ${u.L} of length) = ${f(D)}`, name: 'cylinder' }; }
    if (p.shape === 'plateN') return { A: p.a * p.b, Lc: Math.min(p.a, p.b), a: p.a, b: p.b, txt: `A = a b = ${f(p.a)} × ${f(p.b)}`, name: 'plate' };
    if (p.shape === 'disk') { const D = p.Dd; return { A: (PI * D * D) / 4, Lc: D, D, txt: `A = πD²/4 = π(${f(D)})²/4`, name: 'disk' }; }
    return { A: p.Ab, Lc: p.Lch > 0 ? p.Lch : NaN, txt: `A = ${f(p.Ab)} (given projected area)`, name: 'body' };
  }

  function body(p, U, u, st, warn) {
    const fl = fluidOf(p, U, u); if (fl.err) return fail([fl.err]);
    const rho = fl.rho, G = geomOf(p, u), A = G.A;
    if (!(A > 0)) return fail(['The projected area must be positive.']);
    st.add('Fluid', '', fl.src, `ρ = ${f(rho)} ${u.rho}` + (fl.mu > 0 ? `,  ν = ${f(fl.nu)} ${u.nu}` : ''), `Properties of ${fl.name}.`);
    st.add('Projected area', '', G.txt, `A = ${f(A)} ${u.A}`, G.per ? 'Per unit length of the cylinder.' : '');
    const corr = p.cdBy !== 'given' && (p.shape === 'sphere' || p.shape === 'cyl');
    if (corr && !(fl.mu > 0)) return fail(['The fluid viscosity is needed for the Reynolds number (or give C_D).']);
    const Re = (V) => (V * G.Lc) / fl.nu;
    const CDf = (V) => cdOf(p.shape, p.cdBy, Re(V), p.CD);
    let V, CD, FD;
    const q = (V) => 0.5 * rho * V * V;
    const sv = p.solve;
    if (sv === 'F') { V = p.V; if (!(V > 0)) return fail(['The speed must be positive.']); CD = CDf(V); }
    else if (sv === 'V' || sv === 'VP') {
      const target = sv === 'V' ? p.F : (p.P * u.PF);
      if (!(target > 0)) return fail([sv === 'V' ? 'Enter the drag force.' : 'Enter the power.']);
      const g = (V) => (sv === 'V' ? CDf(V) * q(V) * A - target : CDf(V) * q(V) * A * V - target);
      V = corr ? bisectLog(g, 1e-9, 1e5) : sv === 'V' ? sqrt(target / (p.CD * 0.5 * rho * A)) : Math.cbrt(target / (p.CD * 0.5 * rho * A));
      if (!(V > 0)) return fail(['No speed gives that ' + (sv === 'V' ? 'force.' : 'power.')]);
      CD = CDf(V);
      if (sv === 'V') st.add('Speed from the drag force', 'F_D = C_D ρ A V²/2  ⇒  V = √(2 F_D / (C_D ρ A))', `V = √(2 × ${f(p.F)} / (${f(CD)} × ${f(rho)} × ${f(A)}))`, `V = ${f(V)} ${u.v}`, corr ? 'C_D depends on Re, so V and C_D were found together (trial).' : '');
      else st.add('Speed from the power', 'P = F_D V = C_D ρ A V³/2  ⇒  V = ∛(2P / (C_D ρ A))', `V = ∛(2 × ${f(target)} / (${f(CD)} × ${f(rho)} × ${f(A)}))`, `V = ${f(V)} ${u.v}`, `Power in ${u.SI ? 'W' : 'ft·lb/s'}.` + (corr ? ' C_D found together with V.' : ''));
    } else {
      V = p.V; if (!(V > 0)) return fail(['The speed must be positive.']);
      const Fm = sv === 'CD' ? p.F : (p.P * u.PF) / V;
      if (!(Fm > 0)) return fail(['Enter the measured ' + (sv === 'CD' ? 'drag force.' : 'power.')]);
      if (sv === 'CDP') st.add('Drag force from the power', 'F_D = P / V', `F_D = ${f(p.P * u.PF)} / ${f(V)}`, `F_D = ${f(Fm)} ${u.F}`, '');
      CD = Fm / (q(V) * A);
      st.add('Drag coefficient', 'C_D = 2 F_D / (ρ A V²)', `C_D = 2 × ${f(Fm)} / (${f(rho)} × ${f(A)} × ${f(V)}²)`, `C_D = ${f(CD)}`, '');
    }
    const ReV = fl.mu > 0 && isFinite(G.Lc) ? Re(V) : NaN;
    if (isFinite(ReV)) st.add('Reynolds number', 'Re = V L / ν', `Re = ${f(V)} × ${f(G.Lc)} / ${f(fl.nu)}`, `Re = ${f(ReV)}`, p.shape === 'sphere' || p.shape === 'cyl' ? 'L = diameter.' : 'L = the characteristic length given.');
    if (sv === 'F' || sv === 'V' || sv === 'VP') {
      if (corr) st.add('Drag coefficient from Re', cdTxt(p.shape, p.cdBy), `Re = ${f(ReV)}`, `C_D = ${f(CD)}`, 'A chart reading (Schaum Diagram F, Hibbeler Fig. 11-31/32) may differ by several per cent.');
      else if (sv === 'F') st.add('Drag coefficient', '', 'given (from a table or chart)', `C_D = ${f(CD)}`, '');
    }
    FD = CD * q(V) * A;
    if (sv === 'F') st.add('Drag force', 'F_D = C_D ρ A V²/2', `F_D = ${f(CD)} × ${f(rho)} × ${f(A)} × ${f(V)}²/2`, `F_D = ${f(FD)} ${u.F}`, G.per ? `per ${u.L} of length` : '');
    const P = FD * V;
    st.add('Power to overcome the drag', 'P = F_D V', `P = ${f(FD)} × ${f(V)}`, `P = ${f(P / u.PF)} ${u.Pu}`, '');
    const out = [];
    out.push({ k: 'Drag force F_D', v: FD, u: u.F + (G.per ? `/${u.L}` : ''), hl: sv === 'F' });
    if (sv === 'V' || sv === 'VP') out.push({ k: 'Speed V', v: V, u: u.v, hl: true });
    if (sv === 'CD' || sv === 'CDP') out.push({ k: 'Drag coefficient C_D', v: CD, u: '', hl: true }); else out.push({ k: 'Drag coefficient C_D', v: CD, u: '' });
    if (isFinite(ReV)) out.push({ k: 'Reynolds number', v: ReV, u: '' });
    out.push({ k: 'Power', v: P / u.PF, u: u.Pu });
    let FL = 0, R = FD, th = 0;
    if (p.CL > 0) {
      FL = p.CL * q(V) * A; R = Math.hypot(FD, FL); th = Math.atan2(FL, FD) / DEG;
      st.add('Lift force', 'F_L = C_L ρ A V²/2', `F_L = ${f(p.CL)} × ${f(rho)} × ${f(A)} × ${f(V)}²/2`, `F_L = ${f(FL)} ${u.F}`, 'Lift acts normal to the relative velocity, drag along it.');
      st.add('Resultant', 'R = √(F_D² + F_L²),  θ = tan⁻¹(F_L/F_D)', `R = √(${f(FD)}² + ${f(FL)}²)`, `R = ${f(R)} ${u.F} at ${f(th)}° to the relative velocity`, '');
      out.push({ k: 'Lift force F_L', v: FL, u: u.F, hl: true }, { k: 'Resultant R', v: R, u: u.F }, { k: 'Angle of R to the velocity', v: th, u: '°' });
      if (p.inc > 0) {
        const fr = R * Math.cos((th + p.inc) * DEG), nm = R * Math.sin((th + p.inc) * DEG);
        st.add('Components on the inclined plate', 'normal = R sin(θ + α),  along the plate = R cos(θ + α)', `θ + α = ${f(th)}° + ${f(p.inc)}°`, `normal ${f(nm)} ${u.F},  frictional ${f(fr)} ${u.F}`, 'α is the angle of the plate to the relative velocity.');
        out.push({ k: 'Normal component', v: nm, u: u.F }, { k: 'Frictional component (along the plate)', v: fr, u: u.F });
      }
    }
    if (isFinite(ReV) && p.shape === 'sphere' && corr && ReV > 1e6) warn.push('Re is beyond the sphere curve fit (10⁶); C_D is uncertain.');
    if (isFinite(ReV) && p.shape === 'cyl' && corr && ReV > 2e5) warn.push('Re is in the drag-crisis range of a cylinder (above 2×10⁵); C_D may drop sharply.');
    if (p.cdBy === 'stokes' && ReV > 1) warn.push(`Stokes' law assumes Re < 1 (here Re = ${f(ReV)}).`);
    return ok(st, out, warn, { cls: 'ok', text: `F_D = ${f(FD)} ${u.F}` }, { kind: 'body', shape: p.shape, V, FD, FL, CD, Re: ReV, A, D: G.D, a: G.a, b: G.b, inc: p.inc, per: G.per });
  }

  /* ------------------------------------------------------------------ */
  /* Terminal velocity                                                    */
  /* ------------------------------------------------------------------ */
  function fall(p, U, u, st, warn) {
    const sv = p.solve;
    const fl = sv === 'mu' ? null : fluidOf(p, U, u);
    if (fl && fl.err) return fail([fl.err]);
    let rho, nu, mu;
    if (sv === 'mu') {
      rho = p.dBy === 'gam' ? p.gamG / u.g : p.rhoG;
      if (!(rho > 0)) return fail(['The fluid density must be positive.']);
      st.add('Fluid density', '', p.dBy === 'gam' ? `ρ = γ/g = ${f(p.gamG)}/${f(u.g)}` : 'given', `ρ = ${f(rho)} ${u.rho}`, 'The viscosity is the unknown.');
    } else { rho = fl.rho; nu = fl.nu; mu = fl.mu; st.add('Fluid', '', fl.src, `ρ = ${f(rho)} ${u.rho}` + (mu > 0 ? `,  ν = ${f(nu)} ${u.nu}` : ''), `Properties of ${fl.name}.`); }
    if (p.fshape === 'any') {
      // body of given net weight, projected area and C_D (e.g. parachute)
      if (!(p.W > 0 && p.Ab > 0 && p.CD > 0)) return fail(['Enter the weight, the projected area and C_D.']);
      const V = sqrt((2 * p.W) / (p.CD * rho * p.Ab));
      st.add('Terminal velocity (weight = drag)', 'W = C_D ρ A V²/2  ⇒  V = √(2W / (C_D ρ A))', `V = √(2 × ${f(p.W)} / (${f(p.CD)} × ${f(rho)} × ${f(p.Ab)}))`, `V = ${f(V)} ${u.v}`, 'At constant velocity the drag balances the (net) weight.');
      return ok(st, [{ k: 'Terminal velocity V', v: V, u: u.v, hl: true }, { k: 'Drag at terminal velocity', v: p.W, u: u.F }], warn, { cls: 'ok', text: `V = ${f(V)} ${u.v}` }, { kind: 'fall', any: true, V, up: false, W: p.W, FD: p.W });
    }
    const D = sv === 'D' ? NaN : p.D * u.dF;
    // particle density
    const rs = () => { if (p.sBy === 'SG') return p.SGs * (u.SI ? 1000 : 1.94); if (p.sBy === 'gam') return p.gams / u.g; return p.rhos; };
    const how = p.cdBy, sh = 'sphere';
    const CDf = (Re) => cdOf(sh, how, Re, p.CD);
    if (sv === 'V' || sv === 'D') {
      if (!(mu > 0) && how !== 'given') return fail(['The fluid viscosity is needed for the Reynolds number (or give C_D).']);
      let rhos;
      if (p.sBy === 'm') { if (sv === 'D') return fail(['Give the particle density (not its mass) to find the size.']); rhos = p.ms / ((PI * D * D * D) / 6); }
      else rhos = rs();
      if (!(rhos > 0)) return fail(['The particle density must be positive.']);
      const dr = rhos - rho, up = dr < 0;
      if (abs(dr) < 1e-12) return fail(['The particle has the density of the fluid: it neither falls nor rises.']);
      st.add('Particle density', p.sBy === 'm' ? 'ρ_s = m / (πD³/6)' : p.sBy === 'gam' ? 'ρ_s = γ_s / g' : p.sBy === 'SG' ? 'ρ_s = S ρ_w' : '', p.sBy === 'm' ? `ρ_s = ${f(p.ms)} / (π × ${f(D)}³/6)` : '', `ρ_s = ${f(rhos)} ${u.rho}`, up ? 'Lighter than the fluid: the sphere rises.' : 'Heavier than the fluid: the sphere falls.');
      if (sv === 'V') {
        const Vol = (PI * D * D * D) / 6, A = (PI * D * D) / 4, Fn = abs(dr) * u.g * Vol;
        st.add('Net weight (weight − buoyancy)', 'W − F_B = (ρ_s − ρ) g πD³/6', `= |${f(rhos)} − ${f(rho)}| × ${f(u.g)} × ${f(Vol)}`, `${f(Fn)} ${u.F}`, '');
        st.add('Equilibrium at terminal velocity', 'C_D ρ A V²/2 = W − F_B  ⇒  C_D V² = 2(W − F_B)/(ρ A)', `C_D V² = 2 × ${f(Fn)} / (${f(rho)} × ${f(A)})`, `C_D V² = ${f((2 * Fn) / (rho * A))} ${u.SI ? 'm²/s²' : 'ft²/s²'}`, '');
        const K = (2 * Fn) / (rho * A);
        let V;
        if (how === 'given') V = sqrt(K / p.CD);
        else if (how === 'stokes') V = (abs(dr) * u.g * D * D) / (18 * mu);
        else V = bisectLog((V) => CDf((V * D) / nu) * V * V - K, 1e-12, 1e5);
        if (!(V > 0)) return fail(['No terminal velocity found.']);
        const Re = mu > 0 ? (V * D) / nu : NaN, CD = how === 'given' ? p.CD : CDf(Re);
        if (how === 'stokes') st.add("Stokes' law", 'F_D = 3πμDV  ⇒  V = (ρ_s − ρ) g D² / (18 μ)', `V = ${f(abs(dr))} × ${f(u.g)} × ${f(D)}² / (18 × ${f(mu)})`, `V = ${f(V)} ${u.v}`, 'Same as C_D = 24/Re.');
        else if (how !== 'given') {
          // show a trial table like the books (start at C_D = 1)
          const rows = []; let c = 1;
          for (let i = 0; i < 6; i++) { const v = sqrt(K / c), r = (v * D) / nu, cn = CDf(r); rows.push([i + 1, f(c), f(v), f(r), f(cn)]); if (abs(cn - c) < 0.005 * c) break; c = cn; }
          st.add('Trial: assume C_D, find V and Re, read C_D again', 'V = √(C_D V² / C_D),  Re = V D / ν;  ' + cdTxt(sh, how), rows.map((r) => `#${r[0]}: C_D ${r[1]} → V ${r[2]} → Re ${r[3]} → C_D ${r[4]}`).join(';  '), `V = ${f(V)} ${u.v} (converged)`, 'Assume C_D, find V, then Re, then C_D from the curve, and repeat.');
        } else st.add('Terminal velocity', 'V = √(C_D V² / C_D)', `V = √(${f(K)} / ${f(p.CD)})`, `V = ${f(V)} ${u.v}`, '');
        if (isFinite(Re)) st.add('Check the Reynolds number', 'Re = V D / ν', `Re = ${f(V)} × ${f(D)} / ${f(nu)}`, `Re = ${f(Re)}`, Re < 1 ? "Re < 1: Stokes' law range." : '');
        if (how === 'stokes' && Re > 1) warn.push(`Stokes' law assumes Re < 1 (here Re = ${f(Re)}); use the drag curve instead.`);
        const out = [{ k: up ? 'Terminal velocity (rising)' : 'Terminal velocity (falling)', v: V, u: u.v, hl: true }, { k: 'Drag coefficient C_D', v: CD, u: '' }];
        if (isFinite(Re)) out.push({ k: 'Reynolds number', v: Re, u: '' });
        out.push({ k: 'Drag = net weight', v: Fn, u: u.F });
        return ok(st, out, warn, { cls: 'ok', text: `V = ${f(V)} ${u.v}` }, { kind: 'fall', V, up, D, FD: Fn, W: rhos * u.g * Vol, FB: rho * u.g * Vol });
      }
      // sv === 'D': size for a given terminal velocity
      const V = p.Vt; if (!(V > 0)) return fail(['Enter the terminal velocity.']);
      const g = (D) => CDf((V * D) / nu) * 0.5 * rho * V * V * (PI * D * D) / 4 - abs(dr) * u.g * (PI * D * D * D) / 6;
      const Dd = how === 'given' ? (3 * p.CD * rho * V * V) / (4 * abs(dr) * u.g) : how === 'stokes' ? sqrt((18 * mu * V) / (abs(dr) * u.g)) : bisectLog(g, 1e-9, 1e3);
      if (!(Dd > 0)) return fail(['No size gives that terminal velocity.']);
      const Re = (V * Dd) / nu, CD = CDf(Re);
      st.add('Equilibrium', 'C_D ρ (πD²/4) V²/2 = (ρ_s − ρ) g πD³/6  ⇒  D = 3 C_D ρ V² / (4 (ρ_s − ρ) g)', `D = 3 × ${f(CD)} × ${f(rho)} × ${f(V)}² / (4 × ${f(abs(dr))} × ${f(u.g)})`, `D = ${f(Dd / u.dF)} ${u.du}`, how === 'given' ? '' : 'C_D depends on Re = VD/ν, so D was found by trial.');
      st.add('Reynolds number', 'Re = V D / ν', `Re = ${f(V)} × ${f(Dd)} / ${f(nu)}`, `Re = ${f(Re)},  C_D = ${f(CD)}`, '');
      return ok(st, [{ k: 'Diameter D', v: Dd / u.dF, u: u.du, hl: true }, { k: 'Drag coefficient C_D', v: CD, u: '' }, { k: 'Reynolds number', v: Re, u: '' }], warn, { cls: 'ok', text: `D = ${f(Dd / u.dF)} ${u.du}` }, { kind: 'fall', V, up: dr < 0, D: Dd, FD: abs(dr) * u.g * (PI * Dd * Dd * Dd) / 6 });
    }
    // observed velocity → viscosity or particle density
    const V = p.Vt; if (!(V > 0)) return fail(['Enter the observed terminal velocity.']);
    const Vol = (PI * D * D * D) / 6, A = (PI * D * D) / 4;
    if (sv === 'mu') {
      const rhos = p.sBy === 'm' ? p.ms / Vol : rs(), dr = rhos - rho;
      if (!(abs(dr) > 0)) return fail(['The particle and the fluid have the same density.']);
      const CD = (2 * abs(dr) * u.g * Vol) / (rho * A * V * V);
      st.add('Drag coefficient from the observed velocity', 'C_D = 2(ρ_s − ρ) g (πD³/6) / (ρ (πD²/4) V²)', `C_D = 2 × ${f(abs(dr))} × ${f(u.g)} × ${f(Vol)} / (${f(rho)} × ${f(A)} × ${f(V)}²)`, `C_D = ${f(CD)}`, '');
      let Re;
      if (how === 'stokes') Re = 24 / CD;
      else { Re = bisectLog((r) => cdSphere(r) - CD, 1e-6, 3000); if (!(Re > 0)) return fail([`C_D = ${f(CD)} is below the sphere curve; the viscosity can't be found this way.`]); }
      const nuF = (V * D) / Re, muF = nuF * rho;
      st.add('Reynolds number for that C_D', how === 'stokes' ? 'C_D = 24/Re  ⇒  Re = 24/C_D' : cdTxt(sh, how) + ', solved for Re', `C_D = ${f(CD)}`, `Re = ${f(Re)}`, how === 'stokes' ? 'Stokes range (Re < 1).' : '');
      st.add('Viscosity', 'ν = V D / Re,  μ = ρ ν', `ν = ${f(V)} × ${f(D)} / ${f(Re)}`, `ν = ${f(nuF)} ${u.nu},  μ = ${f(muF)} ${u.mu}`, '');
      if (how === 'stokes' && Re > 1) warn.push(`Re = ${f(Re)} is above the Stokes range.`);
      return ok(st, [{ k: 'Dynamic viscosity μ', v: muF, u: u.mu, hl: true }, { k: 'Kinematic viscosity ν', v: nuF, u: u.nu, hl: true }, { k: 'Drag coefficient C_D', v: CD, u: '' }, { k: 'Reynolds number', v: Re, u: '' }], warn, { cls: 'ok', text: `μ = ${f(muF)} ${u.mu}` }, { kind: 'fall', V, up: dr < 0, D, FD: abs(dr) * u.g * Vol });
    }
    // sv === 'rhos'
    if (!(mu > 0) && how !== 'given') return fail(['The fluid viscosity is needed for the Reynolds number.']);
    const Re = (V * D) / nu, CD = CDf(Re), FD = CD * 0.5 * rho * A * V * V;
    st.add('Reynolds number and C_D', 'Re = V D / ν', `Re = ${f(V)} × ${f(D)} / ${f(nu)} = ${f(Re)}`, `C_D = ${f(CD)}`, how === 'given' ? 'C_D given.' : cdTxt(sh, how));
    st.add('Drag', 'F_D = C_D ρ A V²/2', `F_D = ${f(CD)} × ${f(rho)} × ${f(A)} × ${f(V)}²/2`, `F_D = ${f(FD)} ${u.F}`, '');
    const sgn = p.dir === 'up' ? -1 : 1, rhos = rho + (sgn * FD) / (u.g * Vol);
    st.add('Particle density from equilibrium', p.dir === 'up' ? 'F_B − W = F_D  ⇒  γ_s = γ − F_D / Vol' : 'W − F_B = F_D  ⇒  γ_s = γ + F_D / Vol', `γ_s = ${f(rho * u.g)} ${p.dir === 'up' ? '−' : '+'} ${f(FD)} / ${f(Vol)}`, `γ_s = ${f(rhos * u.g)} ${u.gam},  ρ_s = ${f(rhos)} ${u.rho}`, '');
    if (!(rhos > 0)) warn.push('The density comes out negative: check the direction and the data.');
    return ok(st, [{ k: 'Specific weight of the particle γ_s', v: rhos * u.g, u: u.gam, hl: true }, { k: 'Density of the particle ρ_s', v: rhos, u: u.rho }, { k: 'Specific gravity', v: rhos / (u.SI ? 1000 : 1.94), u: '' }, { k: 'Drag coefficient C_D', v: CD, u: '' }, { k: 'Reynolds number', v: Re, u: '' }], warn, { cls: 'ok', text: `γ_s = ${f(rhos * u.g)} ${u.gam}` }, { kind: 'fall', V, up: p.dir === 'up', D, FD });
  }

  /* ------------------------------------------------------------------ */
  /* Airfoils and airplanes                                               */
  /* ------------------------------------------------------------------ */
  function wing(p, U, u, st, warn) {
    const fl = fluidOf(p, U, u); if (fl.err) return fail([fl.err]);
    const rho = fl.rho;
    st.add('Air', '', fl.src, `ρ = ${f(rho)} ${u.rho}`, '');
    const lin = (a, a1, c1, a2, c2) => c1 + ((c2 - c1) * (a - a1)) / (a2 - a1);
    const CLof = (a) => (p.clBy === 'lin' ? lin(a, p.a1, p.cl1, p.a2, p.cl2) : p.clBy === 'thin' ? 2 * PI * Math.sin(a * DEG) : p.CL);
    const CDof = (a) => (p.cdW === 'lin' ? lin(a, p.a3, p.cd3, p.a4, p.cd4) : p.CDw);
    const clTxt = p.clBy === 'lin' ? `C_L linear from ${f(p.cl1)} at ${f(p.a1)}° to ${f(p.cl2)} at ${f(p.a2)}°` : p.clBy === 'thin' ? 'C_L = 2π sin α (thin flat plate, Kutta)' : 'C_L given';
    const cdTxtW = p.cdW === 'lin' ? `C_D linear from ${f(p.cd3)} at ${f(p.a3)}° to ${f(p.cd4)} at ${f(p.a4)}°` : 'C_D given';
    if ((p.clBy === 'lin' && p.a1 === p.a2) || (p.cdW === 'lin' && p.a3 === p.a4)) return fail(['The two angles of a linear coefficient must differ.']);
    const A = p.Aw, sv = p.solve;
    let V = p.V, W = p.W, al = p.alpha, CL, Aw = A;
    const q = (V) => 0.5 * rho * V * V;
    if (sv === 'V') {
      CL = CLof(al); if (!(CL > 0 && W > 0 && A > 0)) return fail(['Need a positive C_L, weight and wing area.']);
      V = sqrt(W / (CL * 0.5 * rho * A));
      st.add('Lift coefficient', '', clTxt, `C_L = ${f(CL)} at α = ${f(al)}°`, '');
      st.add('Speed for lift = weight', 'W = C_L ρ A V²/2  ⇒  V = √(2W / (C_L ρ A))', `V = √(2 × ${f(W)} / (${f(CL)} × ${f(rho)} × ${f(A)}))`, `V = ${f(V)} ${u.v}`, '');
    } else if (sv === 'A') {
      CL = CLof(al); if (!(CL > 0 && W > 0 && V > 0)) return fail(['Need a positive C_L, weight and speed.']);
      Aw = W / (CL * q(V));
      st.add('Lift coefficient', '', clTxt, `C_L = ${f(CL)} at α = ${f(al)}°`, '');
      st.add('Wing area for lift = weight', 'A = 2W / (C_L ρ V²)', `A = 2 × ${f(W)} / (${f(CL)} × ${f(rho)} × ${f(V)}²)`, `A = ${f(Aw)} ${u.A}`, '');
    } else if (sv === 'alpha') {
      if (!(W > 0 && V > 0 && A > 0)) return fail(['Need the weight, speed and wing area.']);
      CL = W / (q(V) * A);
      st.add('Lift coefficient needed', 'C_L = 2W / (ρ A V²)', `C_L = 2 × ${f(W)} / (${f(rho)} × ${f(A)} × ${f(V)}²)`, `C_L = ${f(CL)}`, '');
      if (p.clBy === 'lin') al = p.a1 + ((CL - p.cl1) * (p.a2 - p.a1)) / (p.cl2 - p.cl1);
      else if (p.clBy === 'thin') { if (CL > 2 * PI) return fail(['C_L is above 2π.']); al = Math.asin(CL / (2 * PI)) / DEG; }
      else return fail(['Give C_L as a linear function of α (or the thin-plate law) to find the angle.']);
      st.add('Angle of attack', '', clTxt, `α = ${f(al)}°`, 'Interpolated on the C_L line.');
    } else if (sv === 'alphaP') {
      if (!(p.P > 0 && V > 0 && A > 0)) return fail(['Need the power, speed and wing area.']);
      const FD = (p.P * u.PF) / V, CDn = FD / (q(V) * A);
      st.add('Drag from the power', 'F_D = P / V', `F_D = ${f(p.P * u.PF)} / ${f(V)}`, `F_D = ${f(FD)} ${u.F}`, '');
      st.add('Drag coefficient', 'C_D = 2 F_D / (ρ A V²)', `C_D = 2 × ${f(FD)} / (${f(rho)} × ${f(A)} × ${f(V)}²)`, `C_D = ${f(CDn)}`, '');
      if (p.cdW !== 'lin') return fail(['Give C_D as a linear function of α to find the angle.']);
      al = p.a3 + ((CDn - p.cd3) * (p.a4 - p.a3)) / (p.cd4 - p.cd3);
      st.add('Angle of attack', '', cdTxtW, `α = ${f(al)}°`, 'Interpolated on the C_D line.');
      CL = CLof(al);
    } else { // 'W': lift (weight supported) at speed and angle
      CL = CLof(al); if (!(V > 0 && A > 0)) return fail(['Need the speed and wing area.']);
      W = CL * q(V) * A;
      st.add('Lift coefficient', '', clTxt, `C_L = ${f(CL)} at α = ${f(al)}°`, '');
      st.add('Lift (weight supported)', 'F_L = C_L ρ A V²/2', `F_L = ${f(CL)} × ${f(rho)} × ${f(A)} × ${f(V)}²/2`, `F_L = ${f(W)} ${u.F}`, '');
    }
    const CD = CDof(al), FL = CL * q(V) * Aw, FD = CD * q(V) * Aw, P = FD * V;
    const out = [];
    if (sv === 'V') out.push({ k: 'Speed V', v: V, u: u.v, hl: true });
    if (sv === 'A') out.push({ k: 'Wing area A', v: Aw, u: u.A, hl: true });
    if (sv === 'alpha' || sv === 'alphaP') out.push({ k: 'Angle of attack α', v: al, u: '°', hl: true });
    out.push({ k: 'Lift coefficient C_L', v: CL, u: '' }, { k: 'Lift F_L', v: FL, u: u.F, hl: sv === 'W' });
    if (CD > 0) {
      if (sv !== 'alphaP') st.add('Drag', 'F_D = C_D ρ A V²/2', `${cdTxtW}: C_D = ${f(CD)};  F_D = ${f(CD)} × ${f(rho)} × ${f(Aw)} × ${f(V)}²/2`, `F_D = ${f(FD)} ${u.F}`, '');
      st.add('Power to overcome drag', 'P = F_D V', `P = ${f(FD)} × ${f(V)}`, `P = ${f(P / u.PF)} ${u.Pu}`, '');
      out.push({ k: 'Drag coefficient C_D', v: CD, u: '' }, { k: 'Drag F_D', v: FD, u: u.F }, { k: 'Power', v: P / u.PF, u: u.Pu }, { k: 'Lift / drag', v: FL / FD, u: '' });
    }
    if (p.clMax > 0 && W > 0) {
      const Vs = sqrt(W / (p.clMax * 0.5 * rho * Aw));
      st.add('Stall speed', 'V_s = √(2W / (C_L,max ρ A))', `V_s = √(2 × ${f(W)} / (${f(p.clMax)} × ${f(rho)} × ${f(Aw)}))`, `V_s = ${f(Vs)} ${u.v}`, 'Slowest speed at which the wing can still carry the weight.');
      out.push({ k: 'Stall speed V_s', v: Vs, u: u.v });
    }
    if (p.chord > 0 && fl.mu > 0) {
      const Re = (V * p.chord) / fl.nu;
      st.add('Reynolds number on the chord', 'Re = V c / ν', `Re = ${f(V)} × ${f(p.chord)} / ${f(fl.nu)}`, `Re = ${f(Re)}`, '');
      out.push({ k: 'Reynolds number (chord)', v: Re, u: '' });
    }
    if (al > 25) warn.push('Angles of attack above about 25° are past stall for most wings.');
    return ok(st, out, warn, { cls: 'ok', text: `F_L = ${f(FL)} ${u.F}` }, { kind: 'wing', V, al, FL, FD, W });
  }

  /* ------------------------------------------------------------------ */
  /* Coasting against drag                                                */
  /* ------------------------------------------------------------------ */
  function coast(p, U, u, st, warn) {
    const fl = fluidOf(p, U, u); if (fl.err) return fail([fl.err]);
    const rho = fl.rho, A = p.Ab, m = p.M, V0 = p.V0;
    st.add('Air', '', fl.src, `ρ = ${f(rho)} ${u.rho}`, '');
    if (!(A > 0 && m > 0 && V0 > 0)) return fail(['Need the area, the mass and the starting speed.']);
    st.add('Equation of motion', '−C_D A ρ V²/2 = m dV/dt  ⇒  (C_D A ρ/2) t = m (1/V − 1/V₀)', '', '', 'Integrated from V₀ at t = 0 (rolling resistance neglected).');
    let CD = p.CD, t = p.tc, V = p.V1;
    const sv = p.solve;
    if (sv === 'CD') {
      if (!(V > 0 && V < V0 && t > 0)) return fail(['The later speed must be below V₀, and the time positive.']);
      CD = (2 * m * (1 / V - 1 / V0)) / (A * rho * t);
      st.add('Drag coefficient', 'C_D = 2m(1/V − 1/V₀) / (A ρ t)', `C_D = 2 × ${f(m)} × (1/${f(V)} − 1/${f(V0)}) / (${f(A)} × ${f(rho)} × ${f(t)})`, `C_D = ${f(CD)}`, '');
    } else if (sv === 'V') {
      if (!(CD > 0 && t >= 0)) return fail(['Need C_D and the time.']);
      V = 1 / (1 / V0 + (CD * A * rho * t) / (2 * m));
      st.add('Speed after time t', '1/V = 1/V₀ + C_D A ρ t / (2m)', `1/V = 1/${f(V0)} + ${f(CD)} × ${f(A)} × ${f(rho)} × ${f(t)} / (2 × ${f(m)})`, `V = ${f(V)} ${u.v}`, '');
    } else {
      if (!(CD > 0 && V > 0 && V < V0)) return fail(['Need C_D and a later speed below V₀.']);
      t = (2 * m * (1 / V - 1 / V0)) / (CD * A * rho);
      st.add('Time to slow to V', 't = 2m(1/V − 1/V₀) / (C_D A ρ)', `t = 2 × ${f(m)} × (1/${f(V)} − 1/${f(V0)}) / (${f(CD)} × ${f(A)} × ${f(rho)})`, `t = ${f(t)} s`, '');
    }
    const k = (CD * A * rho) / (2 * m), x = Math.log(1 + k * V0 * t) / k;
    st.add('Distance travelled', 'x = (1/k) ln(1 + k V₀ t),  k = C_D A ρ / (2m)', `k = ${f(k)};  x = ln(1 + ${f(k)} × ${f(V0)} × ${f(t)}) / ${f(k)}`, `x = ${f(x)} ${u.L}`, 'From dx/dt = V.');
    const F0 = CD * 0.5 * rho * A * V0 * V0;
    const out = [];
    out.push({ k: 'Drag coefficient C_D', v: CD, u: '', hl: sv === 'CD' }, { k: 'Speed V', v: V, u: u.v, hl: sv === 'V' }, { k: 'Time t', v: t, u: 's', hl: sv === 't' }, { k: 'Distance coasted', v: x, u: u.L }, { k: 'Drag at V₀', v: F0, u: u.F });
    return ok(st, out, warn, { cls: 'ok', text: sv === 'CD' ? `C_D = ${f(CD)}` : sv === 'V' ? `V = ${f(V)} ${u.v}` : `t = ${f(t)} s` }, { kind: 'coast', V0, V, t, x, F0, F1: CD * 0.5 * rho * A * V * V });
  }

  /* ------------------------------------------------------------------ */
  /* Boundary layer on a flat plate                                       */
  /* ------------------------------------------------------------------ */
  const BLAS = [[0, 0], [0.4, 0.13277], [0.8, 0.26471], [1.2, 0.39378], [1.6, 0.51676], [2.0, 0.62977], [2.4, 0.72899], [2.8, 0.81152], [3.2, 0.87609], [3.6, 0.92333], [4.0, 0.95552], [4.4, 0.97587], [4.8, 0.98779], [5.2, 0.99425], [5.6, 0.99748], [6.0, 0.99898]];
  function blasius(eta) { if (eta >= 6) return 1; for (let i = 0; i < BLAS.length - 1; i++) { const a = BLAS[i], b = BLAS[i + 1]; if (eta <= b[0]) return a[1] + ((b[1] - a[1]) * (eta - a[0])) / (b[0] - a[0]); } return 1; }

  function plate(p, U, u, st, warn) {
    const fl = fluidOf(p, U, u); if (fl.err) return fail([fl.err]);
    if (!(fl.mu > 0)) return fail(['The fluid viscosity is needed.']);
    const rho = fl.rho, nu = fl.nu, S = p.book === 'S', Rc = p.Recr > 0 ? p.Recr : 5e5;
    st.add('Fluid', '', fl.src, `ρ = ${f(rho)} ${u.rho},  ν = ${f(nu)} ${u.nu}`, `Properties of ${fl.name}.`);
    const trap = p.pshape === 'trap';
    const L = trap ? Math.max(p.c1, p.c2) : p.Lp, b = p.bp, ns = +p.sides || 1;
    if (!(L > 0 && b > 0) || (trap && !(p.c1 >= 0 && p.c2 >= 0 && p.c1 + p.c2 > 0))) return fail(['The plate dimensions must be positive.']);
    const kL = S ? 5.20 : 5.0, kT = S ? 0.33 : 0.332;
    const turbCf = (Re) => (Re < 1e7 ? (S ? 0.074 : 0.0740) / pow(Re, 0.2) : 0.455 / pow(log10(Re), 2.58));
    const turbTxt = (Re) => (Re < 1e7 ? 'C_f = 0.074/Re^0.2' : 'C_f = 0.455/(log Re)^2.58');
    // mean friction coefficient over a length with Reynolds number Re
    const regime = (Re) => (p.reg === 'lam' ? 'lam' : p.reg === 'turb' ? 'turb' : p.reg === 'mix' ? 'mix' : Re <= Rc ? 'lam' : 'mix');
    const mixCf = (Re) => {
      if (S) { const xr = Rc / Re; return (1.328 / sqrt(Rc)) * xr + turbCf(Re) - turbCf(Rc) * xr; }
      const Akn = abs(Rc - 5e5) < 1 ? 1700 : 0.074 * pow(Rc, 0.8) - 1.328 * sqrt(Rc);
      return 0.455 / pow(log10(Re), 2.58) - Akn / Re;
    };
    const Cf = (Re) => { const r = regime(Re); return r === 'lam' ? 1.328 / sqrt(Re) : r === 'turb' ? turbCf(Re) : mixCf(Re); };
    // drag at speed V
    const dragAt = (V) => {
      if (!trap) { const Re = (V * L) / nu; return ns * Cf(Re) * 0.5 * rho * V * V * b * L; }
      const N = 400; let s = 0;
      for (let i = 0; i <= N; i++) { const y = (i / N) * b, c = p.c1 + ((p.c2 - p.c1) * y) / b, w = i === 0 || i === N ? 1 : i % 2 ? 4 : 2; if (c > 0) s += w * Cf((V * c) / nu) * c; }
      return ns * 0.5 * rho * V * V * (s * (b / N)) / 3;
    };
    let V = p.V, FD;
    const Aarea = trap ? 0.5 * (p.c1 + p.c2) * b : b * L;
    if (p.solve === 'V') {
      if (!(p.F > 0)) return fail(['Enter the drag force.']);
      V = bisectLog((V) => dragAt(V) - p.F, 1e-9, 1e4);
      if (!(V > 0)) return fail(['No speed gives that drag.']);
      FD = p.F;
      st.add('Speed from the drag (trial)', `F_D = ${ns} C_f (ρV²/2) A,  C_f depends on Re = VL/ν`, `F_D = ${f(p.F)} ${u.F}`, `V = ${f(V)} ${u.v}`, 'V and C_f were found together.');
    } else { if (!(V > 0)) return fail(['The speed must be positive.']); }
    const ReL = (V * L) / nu, reg = regime(ReL), CfL = Cf(ReL);
    st.add('Reynolds number at the trailing edge', 'Re_L = V L / ν', `Re_L = ${f(V)} × ${f(L)} / ${f(nu)}`, `Re_L = ${f(ReL)}`, reg === 'lam' ? `Below ${f(Rc)}: laminar over the whole plate.` : reg === 'turb' ? 'Turbulent from the leading edge (rough or tripped plate).' : `Above ${f(Rc)}: laminar near the front, turbulent beyond x_cr.`);
    const xcr = (Rc * nu) / V;
    if (reg !== 'turb') st.add('End of the laminar layer', 'x_cr = Re_cr ν / V', `x_cr = ${f(Rc)} × ${f(nu)} / ${f(V)}`, `x_cr = ${f(xcr)} ${u.L}`, xcr >= L ? 'Beyond the plate: the layer stays laminar.' : '');
    const out = [];
    if (!trap) {
      const q = 0.5 * rho * V * V, A1 = b * L;
      if (reg === 'lam') st.add('Mean friction coefficient (laminar, Blasius)', 'C_f = 1.328 / √Re_L', `C_f = 1.328 / √${f(ReL)}`, `C_f = ${f(CfL)}`, '');
      else if (reg === 'turb') st.add('Mean friction coefficient (turbulent)', turbTxt(ReL), `Re_L = ${f(ReL)}`, `C_f = ${f(CfL)}`, ReL < 1e7 ? 'Valid 5×10⁵ < Re < 10⁷.' : 'Schlichting, 10⁷ ≤ Re < 10⁹.');
      else if (S) {
        const Fl = (1.328 / sqrt(Rc)) * q * b * xcr, Ft = turbCf(ReL) * q * A1, Ftc = turbCf(Rc) * q * b * xcr;
        st.add('Combined layer by superposition', 'F = F_lam(0→x_cr) + F_turb(0→L) − F_turb(0→x_cr)', `laminar ${f(Fl)} + turbulent ${f(Ft)} − fictitious turbulent ${f(Ftc)} (one side)`, `C_f = ${f(CfL)}`, `Laminar C_f = 1.328/√Re_cr; turbulent ${turbTxt(ReL)}.`);
      } else st.add('Mean friction coefficient (laminar + turbulent)', abs(Rc - 5e5) < 1 ? 'C_f = 0.455/(log Re_L)^2.58 − 1700/Re_L' : `C_f = 0.455/(log Re_L)^2.58 − (0.074 Re_cr^0.8 − 1.328 Re_cr^0.5)/Re_L`, `C_f = 0.455/(log ${f(ReL)})^2.58 − …`, `C_f = ${f(CfL)}`, 'Prandtl, for a laminar start up to Re_cr.');
      if (p.solve !== 'V') { FD = dragAt(V); st.add('Friction drag', `F_D = ${ns === 2 ? '2 ' : ''}C_f (ρV²/2) b L`, `F_D = ${ns === 2 ? '2 × ' : ''}${f(CfL)} × ${f(rho)} × ${f(V)}²/2 × ${f(b)} × ${f(L)}`, `F_D = ${f(FD)} ${u.F}`, ns === 2 ? 'Both sides wetted.' : 'One side wetted.'); }
      if (reg === 'mix' && xcr < L) { const Fl = ns * (1.328 / sqrt(Rc)) * q * b * xcr; out.push({ k: 'Laminar part of the drag', v: Fl, u: u.F }); }
    } else {
      if (p.solve !== 'V') FD = dragAt(V);
      st.add('Friction drag by strips', `dF = ${ns === 2 ? '2 ' : ''}C_f(Re_c) (ρV²/2) c dy,  c = chord at y`, `chord ${f(p.c1)} → ${f(p.c2)} ${u.L} over ${f(b)} ${u.L}; Simpson's rule, 400 strips`, `F_D = ${f(FD)} ${u.F}`, 'Each strip uses the C_f for its own length.');
    }
    out.unshift({ k: 'Friction drag F_D', v: FD, u: u.F, hl: p.solve !== 'V' });
    if (p.solve === 'V') out.unshift({ k: 'Speed V', v: V, u: u.v, hl: true });
    out.push({ k: 'Reynolds number Re_L', v: ReL, u: '' }, { k: 'Mean friction coefficient C_f', v: CfL, u: '' });
    if (reg !== 'turb') out.push({ k: 'Laminar length x_cr', v: Math.min(xcr, L), u: u.L });
    // local quantities at x
    const x = p.xp > 0 ? p.xp : L, Rex = (V * x) / nu;
    const turbAtX = reg === 'turb' || (reg === 'mix' && x > xcr);
    let dl, ds, th, tau;
    if (!turbAtX) {
      dl = (kL * x) / sqrt(Rex); ds = (1.721 * x) / sqrt(Rex); th = (0.664 * x) / sqrt(Rex); tau = (kT * fl.mu * V * sqrt(Rex)) / x;
      st.add(`Boundary layer at x = ${f(x)} ${u.L} (laminar)`, `δ = ${kL.toFixed(2)} x/√Re_x,  δ* = 1.721 x/√Re_x,  θ = 0.664 x/√Re_x,  τ₀ = ${kT} μ V √Re_x / x`, `Re_x = ${f(V)} × ${f(x)} / ${f(nu)} = ${f(Rex)}`, `δ = ${f(dl)} ${u.L},  τ₀ = ${f(tau)} ${u.tau}`, '');
    } else {
      if (S) { dl = Rex < 1e6 ? (0.38 * x) / pow(Rex, 0.2) : (0.22 * x) / pow(Rex, 0.167); tau = 0.0587 * 0.5 * rho * V * V * pow(nu / (x * V), 0.2); }
      else { dl = (0.370 * x) / pow(Rex, 0.2); tau = (0.0288 * rho * V * V) / pow(Rex, 0.2); }
      ds = dl / 8; th = (7 * dl) / 72;
      st.add(`Boundary layer at x = ${f(x)} ${u.L} (turbulent)`, S ? (Rex < 1e6 ? 'δ = 0.38 x/Re_x^0.2' : 'δ = 0.22 x/Re_x^0.167') + ',  τ₀ = 0.0587 (ρV²/2)(ν/xV)^0.2' : 'δ = 0.370 x/Re_x^0.2,  τ₀ = 0.0288 ρV²/Re_x^0.2', `Re_x = ${f(Rex)};  δ* = δ/8,  θ = 7δ/72 (1/7-power profile)`, `δ = ${f(dl)} ${u.L},  τ₀ = ${f(tau)} ${u.tau}`, reg === 'mix' ? 'Measured from the leading edge as if turbulent all along.' : '');
    }
    out.push({ k: `δ at x = ${f(x)} ${u.L}`, v: dl, u: u.L }, { k: 'Displacement thickness δ*', v: ds, u: u.L }, { k: 'Momentum thickness θ', v: th, u: u.L }, { k: 'Wall shear stress τ₀', v: tau, u: u.tau }, { k: 'Local Reynolds number Re_x', v: Rex, u: '' });
    if (p.yp > 0) {
      if (turbAtX) { const uu = V * pow(Math.min(1, p.yp / dl), 1 / 7); st.add('Velocity in the layer (1/7-power law)', 'u/U = (y/δ)^(1/7)', `y/δ = ${f(p.yp)} / ${f(dl)}`, `u = ${f(uu)} ${u.v}`, ''); out.push({ k: `u at y = ${f(p.yp)} ${u.L}`, v: uu, u: u.v }); }
      else { const eta = (p.yp * sqrt(Rex)) / x, r = blasius(eta); st.add('Velocity in the layer (Blasius table)', 'η = (y/x)√Re_x,  u/U from the Blasius solution', `η = ${f(p.yp)}/${f(x)} × √${f(Rex)} = ${f(eta)}`, `u/U = ${f(r, 5)},  u = ${f(r * V)} ${u.v}`, 'Linear interpolation in the table.'); out.push({ k: `u at y = ${f(p.yp)} ${u.L}`, v: r * V, u: u.v }); }
    }
    if (ReL > 1e9) warn.push('Re_L is above 10⁹, beyond the friction formulas.');
    if (reg === 'lam' && p.reg === 'lam' && ReL > Rc) warn.push(`Re_L = ${f(ReL)} is above ${f(Rc)}: a real layer would turn turbulent.`);
    // profile for drawing
    const prof = [];
    for (let i = 0; i <= 60; i++) { const xi = (i / 60) * L, R = (V * Math.max(xi, 1e-9)) / nu, tb = reg === 'turb' || (reg === 'mix' && xi > xcr); prof.push([xi, i === 0 ? 0 : tb ? (S ? 0.38 : 0.37) * xi / pow(R, 0.2) : (kL * xi) / sqrt(R)]); }
    return ok(st, out, warn, { cls: 'ok', text: `F_D = ${f(FD)} ${u.F}` }, { kind: 'plate', L, b, V, prof, xcr: reg === 'turb' ? 0 : Math.min(xcr, L), x, dl, trap, c1: p.c1, c2: p.c2, FD, sides: ns });
  }

  function dragLift(p, U) {
    const u = units(U), st = Steps(), warn = [];
    switch (p.topic) {
      case 'body': return body(p, U, u, st, warn);
      case 'fall': return fall(p, U, u, st, warn);
      case 'wing': return wing(p, U, u, st, warn);
      case 'coast': return coast(p, U, u, st, warn);
      case 'plate': return plate(p, U, u, st, warn);
      default: return fail(['Unknown problem type.']);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Similitude and model laws                                            */
  /* ------------------------------------------------------------------ */
  function similitude(p, U) {
    const u = units(U), st = Steps(), warn = [];
    const fm = fluidOf(p, U, u, 'm'), fp = fluidOf(p, U, u, 'p');
    if (fm.err) return fail(['Model fluid: ' + fm.err]); if (fp.err) return fail(['Prototype fluid: ' + fp.err]);
    const law = p.law;
    st.add('Model fluid', '', fm.src, `ρ_m = ${f(fm.rho)} ${u.rho}` + (fm.nu > 0 ? `,  ν_m = ${f(fm.nu)} ${u.nu}` : ''), '');
    st.add('Prototype fluid', '', fp.src, `ρ_p = ${f(fp.rho)} ${u.rho}` + (fp.nu > 0 ? `,  ν_p = ${f(fp.nu)} ${u.nu}` : ''), '');
    const needNu = law === 'Re' || law === 'ReFr';
    const unk = p.unk;
    if (needNu && unk !== 'nu' && !(fm.nu > 0 && fp.nu > 0)) return fail(['Both viscosities are needed for Reynolds similarity.']);
    let Lr; // model / prototype
    if (p.lBy === 'n') { if (!(p.n > 0)) return fail(['The scale must be positive.']); Lr = 1 / p.n; }
    else { if (!(p.Lm > 0 && p.Lp > 0) && unk !== 'L') return fail(['Both lengths must be positive.']); Lr = p.Lm / p.Lp; }
    const rhoR = fm.rho / fp.rho;
    let nuR = fm.nu / fp.nu, Vr, Vm, Vp;
    const known = p.side; // 'p' prototype speed known, 'm' model speed known
    const Vk = p.V;
    if (law === 'Re') {
      if (unk === 'V') {
        Vr = nuR / Lr;
        st.add('Reynolds law (viscous forces dominate)', 'V_m L_m / ν_m = V_p L_p / ν_p  ⇒  V_r = ν_r / L_r', `V_r = ${f(nuR)} / ${f(Lr)}`, `V_r = ${f(Vr)}`, 'r = model ÷ prototype.');
      } else if (unk === 'L') {
        if (!(p.Vm > 0 && p.Vp > 0)) return fail(['Enter both speeds.']);
        Vr = p.Vm / p.Vp; Lr = nuR / Vr;
        st.add('Length for equal Reynolds numbers', 'L_r = ν_r / V_r', `L_r = ${f(nuR)} / (${f(p.Vm)}/${f(p.Vp)})`, `L_r = ${f(Lr)}`, '');
      } else { // nu: model viscosity required
        if (!(p.Vm > 0 && p.Vp > 0 && fp.nu > 0)) return fail(['Enter both speeds and the prototype viscosity.']);
        Vr = p.Vm / p.Vp; nuR = Vr * Lr;
        st.add('Model viscosity for equal Reynolds numbers', 'ν_r = V_r L_r', `ν_r = ${f(Vr)} × ${f(Lr)}`, `ν_m = ${f(nuR * fp.nu)} ${u.nu}`, '');
      }
    } else if (law === 'Fr' || law === 'ReFr') {
      if (law === 'ReFr') {
        if (unk === 'L') { if (!(fm.nu > 0 && fp.nu > 0)) return fail(['Both viscosities are needed.']); Lr = pow(nuR, 2 / 3); st.add('Scale for Reynolds and Froude together', 'ν_r = L_r^(3/2) (g_r = 1)  ⇒  L_r = ν_r^(2/3)', `L_r = (${f(nuR)})^(2/3)`, `L_r = ${f(Lr)} (1 : ${f(1 / Lr)})`, 'Both laws give the same velocity ratio.'); }
        else { if (!(fp.nu > 0)) return fail(['The prototype viscosity is needed.']); nuR = pow(Lr, 1.5); st.add('Model viscosity for Reynolds and Froude together', 'ν_r = L_r^(3/2)', `ν_r = (${f(Lr)})^(3/2)`, `ν_r = ${f(nuR)},  ν_m = ${f(nuR * fp.nu)} ${u.nu}`, 'Equate V_r = √L_r (Froude) with V_r = ν_r/L_r (Reynolds).'); }
      }
      Vr = sqrt(Lr);
      st.add('Froude law (gravity forces dominate)', 'V_m/√(g L_m) = V_p/√(g L_p)  ⇒  V_r = √L_r', `V_r = √${f(Lr)}`, `V_r = ${f(Vr)}`, '');
    } else if (law === 'We') {
      if (!(p.sigm > 0 && p.sigp > 0)) return fail(['Enter both surface tensions.']);
      Vr = sqrt(p.sigm / p.sigp / (rhoR * Lr));
      st.add('Weber law (surface tension dominates)', 'ρV²L/σ equal  ⇒  V_r = √(σ_r / (ρ_r L_r))', `V_r = √(${f(p.sigm / p.sigp)} / (${f(rhoR)} × ${f(Lr)}))`, `V_r = ${f(Vr)}`, '');
    } else if (law === 'Ma') {
      if (!(p.cm > 0 && p.cp > 0)) return fail(['Enter both sound speeds.']);
      Vr = p.cm / p.cp;
      st.add('Mach law (compressibility dominates)', 'V/c equal  ⇒  V_r = c_r', `V_r = ${f(p.cm)} / ${f(p.cp)}`, `V_r = ${f(Vr)}`, '');
    } else return fail(['Unknown model law.']);
    if (!(Vr > 0) || !(Lr > 0)) return fail(['The ratios came out invalid; check the data.']);
    // velocities
    if (unk === 'V' || law !== 'Re') { if (!(Vk > 0)) { Vp = NaN; Vm = NaN; } else if (known === 'p') { Vp = Vk; Vm = Vk * Vr; } else { Vm = Vk; Vp = Vk / Vr; } }
    else { Vm = p.Vm; Vp = p.Vp; }
    const tr = Lr / Vr, Qr = Vr * Lr * Lr, Fr = rhoR * Vr * Vr * Lr * Lr, Pr = Fr * Vr, pr = rhoR * Vr * Vr, ar = Vr / tr;
    st.add('Scale ratios (model ÷ prototype)', 'L_r, V_r;  t_r = L_r/V_r;  Q_r = V_r L_r²;  F_r = ρ_r V_r² L_r²;  P_r = F_r V_r;  p_r = ρ_r V_r²', `L_r = ${f(Lr)} (1 : ${f(1 / Lr)}),  ρ_r = ${f(rhoR)}`, `V_r = ${f(Vr)},  t_r = ${f(tr)},  Q_r = ${f(Qr)},  F_r = ${f(Fr)},  P_r = ${f(Pr)}`, 'Force from F = (pressure)(area) ∝ ρV²L².');
    const out = [];
    if (law === 'Re' && unk === 'L') out.push({ k: 'Length ratio L_m/L_p', v: Lr, u: '', hl: true }, { k: p.lBy === 'n' ? 'Scale 1 : n' : 'Unknown length', v: p.lBy === 'n' ? 1 / Lr : p.Lp > 0 ? Lr * p.Lp : p.Lm / Lr, u: p.lBy === 'n' ? '' : u.L, hl: true });
    else if (law === 'ReFr' && unk === 'L') out.push({ k: 'Scale 1 : n', v: 1 / Lr, u: '', hl: true });
    else if (unk === 'nu') {
      out.push({ k: 'Model kinematic viscosity ν_m', v: nuR * fp.nu, u: u.nu, hl: true }, { k: 'Viscosity ratio ν_m/ν_p', v: nuR, u: '' });
      if (law === 'Re') { st.add('Same gas at the same temperature', 'μ unchanged, ρ ∝ p  ⇒  p_m/p_p = ν_p/ν_m', `p_m/p_p = 1/${f(nuR)}`, `p_m/p_p = ${f(1 / nuR)}`, 'How a pressurised wind tunnel reaches a low ν.'); out.push({ k: 'Pressure ratio p_m/p_p (same gas, same T)', v: 1 / nuR, u: '' }); }
    }
    if (isFinite(Vm) && isFinite(Vp)) out.push({ k: 'Model speed V_m', v: Vm, u: u.v, hl: known === 'p' && unk !== 'L' && unk !== 'nu' }, { k: 'Prototype speed V_p', v: Vp, u: u.v, hl: known === 'm' && unk !== 'L' && unk !== 'nu' });
    out.push({ k: 'Velocity ratio V_r', v: Vr, u: '' }, { k: 'Time ratio t_r', v: tr, u: '' }, { k: 'Discharge ratio Q_r', v: Qr, u: '' }, { k: 'Force ratio F_r', v: Fr, u: '' }, { k: 'Power ratio P_r', v: Pr, u: '' });
    // transfer quantities
    const tf = (val, r, name, unit) => { if (!(val > 0)) return; const other = known === 'm' ? val / r : val * r; const sideK = known === 'm' ? 'model' : 'prototype', sideO = known === 'm' ? 'prototype' : 'model'; st.add(`${name}: ${sideK} → ${sideO}`, known === 'm' ? `${name}_p = ${name}_m / ${name}_r` : `${name}_m = ${name}_p × ${name}_r`, `${f(val)} ${known === 'm' ? '÷' : '×'} ${f(r)}`, `${f(other)} ${unit}`, ''); out.push({ k: `${name} on the ${sideO}`, v: other, u: unit, hl: true }); };
    tf(p.Qk, Qr, 'Q', u.Q); tf(p.Fk, Fr, 'F', u.F); tf(p.Pk, Pr, 'P', u.Pu); tf(p.tk, tr, 't', p.tu === 'min' ? 'min' : p.tu === 'h' ? 'h' : 's'); tf(p.hk, Lr, 'L', u.L); tf(p.pk, pr, 'p', u.SI ? 'kPa' : 'psi');
    // dimensionless numbers on the prototype if its length is known
    const Lpv = p.lBy === 'L' ? p.Lp : p.Lpx;
    if (Lpv > 0 && Vp > 0) {
      const Rep = fp.nu > 0 ? (Vp * Lpv) / fp.nu : NaN, Frp = Vp / sqrt(u.g * Lpv);
      st.add('Prototype numbers', 'Re = V L/ν,  Fr = V/√(gL)', `V_p = ${f(Vp)}, L_p = ${f(Lpv)}`, `Re = ${f(Rep)},  Fr = ${f(Frp)}`, '');
      if (isFinite(Rep)) out.push({ k: 'Prototype Reynolds number', v: Rep, u: '' });
      out.push({ k: 'Prototype Froude number', v: Frp, u: '' });
    }
    return ok(st, out, warn, { cls: 'ok', text: `V_r = ${f(Vr)}` }, { kind: 'sim', Lr, Vr, Vm, Vp, law, tr, Qr, Fr, Pr });
  }

  Object.assign(P0, { dragLift, similitude, dragUnits: units, cdSphere, cdCyl });
})(window);
