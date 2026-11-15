/* =====================================================================
 * PHYSICS — part 2: Viscosity, Pressure & Manometers, Analysis of Dams.
 * Same conventions as physics.js: every solver returns
 *   { ok, err:[], warn:[], status:{cls,text}, out:[{k,v,u,hl}], steps:[{t,n,f,s,r}], geo:{} }
 * ===================================================================== */
(function (root) {
  'use strict';
  const P0 = root.Physics;
  const { fmt: f, clamp } = P0;
  const PI = Math.PI, DEG = PI / 180;

  function Steps() { const list = []; return { list, add(t, fo, s, r, n) { list.push({ t, f: fo, s, r, n }); } }; }
  const fail = (err, warn, steps) => ({ ok: false, err, warn: warn || [], steps: steps || [], out: [], geo: {} });

  /* =================================================================== */
  /* VISCOSITY                                                            */
  /* =================================================================== */
  const VU = {
    SI: { id: 'SI', mu: 'Pa·s', F: 'N', A: 'm²', len: 'm', t: 'mm', tF: 0.001, V: 'm/s', T: 'N·m', P: 'W', tau: 'Pa', nu: 'm²/s', rho: 'kg/m³', rhoW: 1000 },
    EN: { id: 'EN', mu: 'lb·s/ft²', F: 'lb', A: 'ft²', len: 'ft', t: 'in', tF: 1 / 12, V: 'ft/s', T: 'lb·ft', P: 'ft·lb/s', tau: 'psf', nu: 'ft²/s', rho: 'slug/ft³', rhoW: 1.94 },
  };

  /**
   * p = { sub:'incline'|'gap'|'shaft'|'disk'|'cone'|'visc', solve, mu, sg, ... }
   * Newton's law of viscosity for a thin film with a linear velocity profile: τ = μ V / t.
   */
  function viscosity(p, U) {
    const u = VU[U.id], st = Steps(), warn = [], err = [], out = [];
    const solveT = p.sub === 'incline' && p.solve === 't', solveW = p.sub === 'incline' && p.solve === 'W';
    let t = (p.t || 0) * u.tF;
    const rho = (p.sg || 1) * u.rhoW;
    if (!solveT && !(t > 0)) err.push('Film thickness / clearance must be positive.');
    if (p.solve !== 'mu' && !(p.mu > 0)) err.push('Viscosity μ must be positive.');
    if (err.length) return fail(err, warn);
    const omegaOf = (N) => (2 * PI * N) / 60;
    let mu = p.mu, geo = { sub: p.sub, t, tIn: p.t }, status;
    const muStep = () => st.add('Newton’s law of viscosity (thin film, linear profile)', 'τ = μ (du/dy) = μ V / t', '', 'shear stress is constant across the film', 'For a thin film the velocity varies linearly from the moving surface to the fixed one.');

    if (p.sub === 'incline') {
      const A = p.L * p.B, th = p.theta * DEG;
      let W = p.W;
      if (!(A > 0)) return fail(['Contact area must be positive.']);
      st.add('Contact area of the block', 'A = L × B', `A = ${f(p.L)} × ${f(p.B)}`, `A = ${f(A)} ${u.A}`, 'Area of the block face resting on the liquid film.');
      if (!solveT) st.add('Film thickness in base units', `t = ${f(p.t)} ${u.t}`, '', `t = ${f(t)} ${u.len}`, '');
      muStep();
      if (solveW || solveT) {
        const V0 = p.V;
        if (!(V0 > 0)) return fail(['Velocity must be positive.']);
        if (!(Math.sin(th) > 0)) return fail(['θ must be greater than 0: on a level surface the weight does not drive the block.']);
        if (solveW) {
          W = (mu * V0 * A) / (t * Math.sin(th));
          st.add('Block weight for the observed terminal velocity', 'W sin θ = μ V A / t  →  W = μ V A / (t sin θ)', `W = ${f(mu)} × ${f(V0)} × ${f(A)} / (${f(t)} × sin ${f(p.theta)}°)`, `W = ${f(W)} ${u.F}`, 'At constant velocity the weight component along the slope equals the viscous drag.');
        } else {
          if (!(W > 0)) return fail(['Block weight must be positive.']);
          t = (mu * V0 * A) / (W * Math.sin(th));
          st.add('Film thickness for the observed terminal velocity', 'W sin θ = μ V A / t  →  t = μ V A / (W sin θ)', `t = ${f(mu)} × ${f(V0)} × ${f(A)} / (${f(W)} × sin ${f(p.theta)}°)`, `t = ${f(t)} ${u.len} = ${f(t / u.tF)} ${u.t}`, 'At constant velocity the weight component along the slope equals the viscous drag.');
        }
        geo.t = t; geo.tIn = t / u.tF;
      }
      const Wp = W * Math.sin(th);
      st.add('Weight component along the incline', 'W∥ = W sin θ', `W∥ = ${f(W)} × sin ${f(p.theta)}°`, `W∥ = ${f(Wp)} ${u.F}`, 'This component drives the block down the slope.');
      let V, F = 0, tau;
      if (p.solve === 'V') {
        if (!(Wp > 0)) return fail(['On a horizontal surface (θ = 0) nothing drives the block. Use "Force to pull" instead.'], warn, st.list);
        V = (Wp * t) / (mu * A); tau = Wp / A;
        st.add('Terminal velocity (ΣF∥ = 0)', 'W sin θ = τ A = μ V A / t  →  V = W sin θ · t / (μ A)', `V = ${f(Wp)} × ${f(t)} / (${f(mu)} × ${f(A)})`, `V = ${f(V)} ${u.V}`, 'At terminal (constant) velocity the viscous drag balances the driving force.');
        status = { cls: 'ok', text: `Terminal velocity V = ${f(V)} ${u.V}` };
      } else if (p.solve === 'mu') {
        V = p.V; if (!(V > 0)) return fail(['Velocity must be positive.']);
        if (!(Wp > 0)) return fail(['θ must be greater than 0 to back-compute μ from a free slide.']);
        mu = (Wp * t) / (V * A); tau = Wp / A;
        st.add('Viscosity from the observed terminal velocity', 'μ = W sin θ · t / (V A)', `μ = ${f(Wp)} × ${f(t)} / (${f(V)} × ${f(A)})`, `μ = ${f(mu)} ${u.mu}`, 'Same equilibrium, solved for μ.');
        status = { cls: 'ok', text: `μ = ${f(mu)} ${u.mu}` };
      } else if (solveW || solveT) {
        V = p.V; tau = Wp / A;
        status = { cls: 'ok', text: solveW ? `W = ${f(W)} ${u.F}` : `t = ${f(t / u.tF)} ${u.t}` };
      } else {
        V = p.V; if (!(V > 0)) return fail(['Velocity must be positive.']);
        const Fv = (mu * V * A) / t; tau = Fv / A;
        F = Wp + Fv;
        st.add('Viscous drag on the block', 'F_v = μ V A / t', `F_v = ${f(mu)} × ${f(V)} × ${f(A)} / ${f(t)}`, `F_v = ${f(Fv)} ${u.F}`, 'The film resists the motion.');
        st.add('Force to pull the block UP the incline at constant V', 'P = W sin θ + μ V A / t', `P = ${f(Wp)} + ${f(Fv)}`, `P = ${f(F)} ${u.F}`, 'Pull parallel to the incline; both gravity and viscous drag act down the slope.');
        status = { cls: 'ok', text: `Pull P = ${f(F)} ${u.F}` };
      }
      st.add('Shear stress in the film', 'τ = μ V / t', `τ = ${f(mu)} × ${f(V)} / ${f(t)}`, `τ = ${f(tau)} ${u.tau}`, '');
      out.push({ k: 'Contact area A', v: A, u: u.A }, { k: 'W sin θ', v: Wp, u: u.F });
      out.push({ k: 'Velocity V', v: V, u: u.V, hl: p.solve === 'V' }, { k: 'Viscosity μ', v: mu, u: u.mu, hl: p.solve === 'mu' }, { k: 'Shear stress τ', v: tau, u: u.tau });
      if (p.solve === 'up') out.push({ k: 'Pull force P', v: F, u: u.F, hl: true });
      if (solveW) out.push({ k: 'Block weight W', v: W, u: u.F, hl: true });
      if (solveT) out.push({ k: 'Film thickness t', v: t / u.tF, u: u.t, hl: true });
      Object.assign(geo, { A, V, F, tau, W, Wp });
    } else if (p.sub === 'gap') {
      const A = p.A, hgap = (p.h || 0) * u.tF, tp = (p.tp || 0) * u.tF, y1 = (p.y1 || 0) * u.tF;
      const clear = hgap - tp, y2 = clear - y1;
      if (!(clear > 0)) return fail(['The plate is thicker than the gap.']);
      if (!(y1 > 0 && y2 > 0)) return fail(['The plate must sit inside the gap with liquid on both sides (0 < y₁ < h − t_p).']);
      const mu1 = p.mu, mu2 = p.same ? p.mu : p.mu2, V = p.V;
      if (!(mu2 > 0)) return fail(['Lower-film viscosity must be positive.']);
      st.add('Film thicknesses', 'y₂ = h − t_p − y₁', `y₂ = ${f(hgap)} − ${f(tp)} − ${f(y1)}`, `y₁ = ${f(y1)} ${u.len},  y₂ = ${f(y2)} ${u.len}`, 'Liquid above and below the moving plate.');
      muStep();
      const F1 = (mu1 * V * A) / y1, F2 = (mu2 * V * A) / y2, F = F1 + F2;
      st.add('Drag from the upper film', 'F₁ = μ₁ V A / y₁', `F₁ = ${f(mu1)} × ${f(V)} × ${f(A)} / ${f(y1)}`, `F₁ = ${f(F1)} ${u.F}`, '');
      st.add('Drag from the lower film', 'F₂ = μ₂ V A / y₂', `F₂ = ${f(mu2)} × ${f(V)} × ${f(A)} / ${f(y2)}`, `F₂ = ${f(F2)} ${u.F}`, '');
      st.add('Force to pull the plate', 'F = F₁ + F₂', `F = ${f(F1)} + ${f(F2)}`, `F = ${f(F)} ${u.F}`, 'Both films resist the motion.');
      const yOpt = (clear * Math.sqrt(mu1)) / (Math.sqrt(mu1) + Math.sqrt(mu2));
      const Fmin = (mu1 / yOpt + mu2 / (clear - yOpt)) * V * A;
      st.add('Position for the least force', 'dF/dy₁ = 0 → μ₁/y₁² = μ₂/y₂² → y₁ = c√μ₁ / (√μ₁ + √μ₂)', `c = h − t_p = ${f(clear)}`, `y₁* = ${f(yOpt)} ${u.len},  F_min = ${f(Fmin)} ${u.F}`, mu1 === mu2 ? 'Same liquid on both sides → the plate should be centred.' : 'Closer to the thinner liquid.');
      out.push({ k: 'y₁ / y₂', v: y1 / y2, u: '' }, { k: 'F₁ (upper)', v: F1, u: u.F }, { k: 'F₂ (lower)', v: F2, u: u.F }, { k: 'Pull force F', v: F, u: u.F, hl: true }, { k: 'y₁ for F_min', v: yOpt, u: u.len }, { k: 'F_min', v: Fmin, u: u.F });
      Object.assign(geo, { A, V, F, F1, F2, y1, y2, tp, hgap, mu1, mu2 });
      status = { cls: 'ok', text: `F = ${f(F)} ${u.F}` };
    } else if (p.sub === 'shaft') {
      const D = p.D, L = p.Ls, r = D / 2, As = PI * D * p.Ls;
      st.add('Wetted (sleeve) area', 'A = π D L', `A = π × ${f(D)} × ${f(L)}`, `A = ${f(As)} ${u.A}`, 'Lateral area of the shaft inside the sleeve.');
      muStep();
      if (p.motion === 'rotate') {
        const w = omegaOf(p.N), V = w * r;
        st.add('Angular and surface speed', 'ω = 2πN/60,  V = ω r', `ω = 2π × ${f(p.N)} / 60;  V = ${f(w)} × ${f(r)}`, `ω = ${f(w)} rad/s,  V = ${f(V)} ${u.V}`, '');
        let T;
        if (p.solve === 'mu') {
          T = p.Tq; mu = (T * t) / (w * r * r * As);
          st.add('Viscosity from the measured torque', 'T = τ A r = (μ ω r / t)(2π r L) r  →  μ = T t / (2π r³ L ω)', `μ = ${f(T)} × ${f(t)} / (2π × ${f(r)}³ × ${f(L)} × ${f(w)})`, `μ = ${f(mu)} ${u.mu}`, '');
        } else {
          T = (mu * w * r * r * As) / t;
          st.add('Torque to rotate the shaft', 'T = (μ ω r / t) × (2π r L) × r = 2π μ ω r³ L / t', `T = 2π × ${f(mu)} × ${f(w)} × ${f(r)}³ × ${f(L)} / ${f(t)}`, `T = ${f(T)} ${u.T}`, 'Shear stress × area × lever arm.');
        }
        const Pw = T * w, tau = (mu * V) / t;
        st.add('Power lost to viscous friction', 'P = T ω', `P = ${f(T)} × ${f(w)}`, U.id === 'SI' ? `P = ${f(Pw)} W` : `P = ${f(Pw)} ft·lb/s = ${f(Pw / 550)} hp`, '');
        out.push({ k: 'ω', v: w, u: 'rad/s' }, { k: 'Surface speed V', v: V, u: u.V }, { k: 'Shear stress τ', v: tau, u: u.tau }, { k: 'Torque T', v: T, u: u.T, hl: p.solve !== 'mu' }, { k: 'Power P', v: Pw, u: u.P, hl: true });
        if (p.solve === 'mu') out.push({ k: 'Viscosity μ', v: mu, u: u.mu, hl: true });
        Object.assign(geo, { D, L, V, T, w, tau });
        status = { cls: 'ok', text: p.solve === 'mu' ? `μ = ${f(mu)} ${u.mu}` : `T = ${f(T)} ${u.T}, P = ${f(Pw)} ${u.P}` };
      } else {
        const V = p.V;
        let F;
        if (p.solve === 'mu') { F = p.Fa; mu = (F * t) / (V * As); st.add('Viscosity from the measured pull', 'μ = F t / (V π D L)', `μ = ${f(F)} × ${f(t)} / (${f(V)} × ${f(As)})`, `μ = ${f(mu)} ${u.mu}`, ''); }
        else { F = (mu * V * As) / t; st.add('Force to slide the shaft axially', 'F = μ V (π D L) / t', `F = ${f(mu)} × ${f(V)} × ${f(As)} / ${f(t)}`, `F = ${f(F)} ${u.F}`, ''); }
        out.push({ k: 'Shear stress τ', v: (mu * V) / t, u: u.tau }, { k: 'Axial force F', v: F, u: u.F, hl: p.solve !== 'mu' }, { k: 'Power F·V', v: F * V, u: u.P });
        if (p.solve === 'mu') out.push({ k: 'Viscosity μ', v: mu, u: u.mu, hl: true });
        Object.assign(geo, { D, L, V, F });
        status = { cls: 'ok', text: p.solve === 'mu' ? `μ = ${f(mu)} ${u.mu}` : `F = ${f(F)} ${u.F}` };
      }
    } else if (p.sub === 'disk' || p.sub === 'cone') {
      const w = omegaOf(p.N), R = p.R;
      st.add('Angular speed', 'ω = 2πN/60', `ω = 2π × ${f(p.N)} / 60`, `ω = ${f(w)} rad/s`, '');
      muStep();
      let k, kf, ks;
      if (p.sub === 'disk') {
        const Ri = p.hollow ? p.Ri : 0;
        if (!(Ri < R)) return fail(['Inner radius must be smaller than the outer radius.']);
        k = (PI * (R ** 4 - Ri ** 4)) / (2 * t);
        kf = 'dT = τ r dA = (μ ω r / t) r (2π r dr)  →  T = π μ ω (R⁴ − Rᵢ⁴) / (2t)';
        ks = `T = π × μ × ${f(w)} × (${f(R)}⁴ − ${f(Ri)}⁴) / (2 × ${f(t)})`;
        Object.assign(geo, { R, Ri });
      } else {
        const H = p.H, a = Math.atan(R / H);
        st.add('Cone half-angle', 'α = tan⁻¹(R / H)', `α = tan⁻¹(${f(R)} / ${f(H)})`, `α = ${f(a / DEG)}°`, '');
        k = (PI * R ** 4) / (2 * t * Math.sin(a));
        kf = 'dA = 2π r ds, ds = dr / sin α  →  T = π μ ω R⁴ / (2 t sin α)';
        ks = `T = π × μ × ${f(w)} × ${f(R)}⁴ / (2 × ${f(t)} × sin ${f(a / DEG)}°)`;
        if (p.base) { k += (PI * R ** 4) / (2 * t); kf += '  + base disk π μ ω R⁴/(2t)'; }
        Object.assign(geo, { R, H, alpha: a });
      }
      let T;
      if (p.solve === 'mu') { T = p.Tq; mu = T / (k * w); st.add('Viscous torque relation', kf, ks, `T = μ × ${f(k * w)}`, 'The shear stress grows linearly with radius, so the torque grows with R⁴.'); st.add('Viscosity from the measured torque', 'μ = T / (T per unit μ)', `μ = ${f(T)} / ${f(k * w)}`, `μ = ${f(mu)} ${u.mu}`, ''); }
      else { T = mu * k * w; st.add('Viscous torque', kf, ks.replace('μ', f(mu)), `T = ${f(T)} ${u.T}`, 'The shear stress grows linearly with radius, so the torque grows with R⁴.'); }
      const Pw = T * w;
      st.add('Power', 'P = T ω', `P = ${f(T)} × ${f(w)}`, U.id === 'SI' ? `P = ${f(Pw)} W` : `P = ${f(Pw)} ft·lb/s = ${f(Pw / 550)} hp`, '');
      out.push({ k: 'ω', v: w, u: 'rad/s' }, { k: 'Max shear τ (at R)', v: (mu * w * R) / t, u: u.tau }, { k: 'Torque T', v: T, u: u.T, hl: p.solve !== 'mu' }, { k: 'Power P', v: Pw, u: u.P, hl: true });
      if (p.solve === 'mu') out.push({ k: 'Viscosity μ', v: mu, u: u.mu, hl: true });
      Object.assign(geo, { w, T });
      status = { cls: 'ok', text: p.solve === 'mu' ? `μ = ${f(mu)} ${u.mu}` : `T = ${f(T)} ${u.T}` };
    } else if (p.sub === 'visc') {
      const w = omegaOf(p.N), R = p.R, L = p.Lc, tb = (p.tb || 0) * u.tF;
      st.add('Angular speed', 'ω = 2πN/60', `ω = 2π × ${f(p.N)} / 60`, `ω = ${f(w)} rad/s`, '');
      muStep();
      const kSide = (2 * PI * R ** 3 * L) / t, kBot = p.bottom && tb > 0 ? (PI * R ** 4) / (2 * tb) : 0;
      st.add('Torque per unit μω on the side wall', 'T_side = 2π μ ω R³ L / t', `2π × ${f(R)}³ × ${f(L)} / ${f(t)}`, `${f(kSide)}`, 'Thin annular gap between the inner and outer cylinders.');
      if (kBot) st.add('…and on the bottom face', 'T_bottom = π μ ω R⁴ / (2 t_b)', `π × ${f(R)}⁴ / (2 × ${f(tb)})`, `${f(kBot)}`, 'Bottom of the inner cylinder over its own film t_b.');
      mu = p.Tq / ((kSide + kBot) * w);
      st.add('Viscosity of the sample', 'μ = T / [ω (T_side + T_bottom)/μω]', `μ = ${f(p.Tq)} / (${f(w)} × ${f(kSide + kBot)})`, `μ = ${f(mu)} ${u.mu}`, 'Rotational (Couette) viscometer.');
      out.push({ k: 'ω', v: w, u: 'rad/s' }, { k: 'Viscosity μ', v: mu, u: u.mu, hl: true });
      Object.assign(geo, { R, L, w, tb, T: p.Tq });
      status = { cls: 'ok', text: `μ = ${f(mu)} ${u.mu}` };
    }
    const nu = mu / rho;
    st.add('Kinematic viscosity', 'ν = μ / ρ,  ρ = Sg × ρw', `ν = ${f(mu)} / (${f(p.sg)} × ${f(u.rhoW)})`, `ν = ${f(nu)} ${u.nu}`, 'Dynamic viscosity divided by density.');
    out.push({ k: 'Kinematic ν', v: nu, u: u.nu });
    if (mu > 50 && U.id === 'SI') warn.push('μ is larger than most oils and syrups (> 50 Pa·s) — check the inputs.');
    geo.mu = mu;
    return { ok: true, err, warn, steps: st.list, out, status, geo, VU: u };
  }

  /* =================================================================== */
  /* PRESSURE & MANOMETERS                                                */
  /* =================================================================== */
  function pressure(p, U) {
    const st = Steps(), warn = [], err = [], out = [];
    const gw = U.gw, Pu = U.press, Lu = U.len;
    const hW = (pp) => pp / gw, hHg = (pp) => pp / (13.6 * gw);
    const psi = (pp) => (U.id === 'EN' ? ` (${f(pp / 144)} psi)` : '');
    let status, geo = { sub: p.sub };
    if (p.sub === 'depth') {
      const L = p.layers.slice(0, p.n);
      if (L.some((l) => !(l.sg > 0) || !(l.t > 0))) return fail(['Every layer needs a positive Sg and thickness.']);
      for (let i = 1; i < L.length; i++) if (L[i].sg < L[i - 1].sg) { warn.push('A heavier liquid sits above a lighter one — the layers would overturn; results assume they stay put.'); break; }
      let pc = p.p0, z = 0;
      const pts = [{ z: 0, p: pc }];
      st.add('Pressure at the top surface', p.p0 ? 'p₀ = gas / applied pressure (gauge)' : 'open to the atmosphere → p₀ = 0 gauge', '', `p₀ = ${f(pc)} ${Pu}`, '');
      L.forEach((l, i) => {
        const g = l.sg * gw, dp = g * l.t; const p1 = pc + dp;
        st.add(`Through layer ${i + 1} (Sg = ${f(l.sg)})`, `p = p_above + γ${i + 1} h${i + 1}`, `p = ${f(pc)} + ${f(l.sg)}×${f(gw)} × ${f(l.t)}`, `p = ${f(p1)} ${Pu}`, i === L.length - 1 ? 'Bottom of the tank.' : `Interface ${i + 1}–${i + 2}.`);
        pc = p1; z += l.t; pts.push({ z, p: pc });
      });
      const Ztot = z, zq = clamp(p.zq, 0, Ztot);
      let pq = p.p0, acc = 0;
      for (const l of L) { const d = Math.min(l.t, Math.max(0, zq - acc)); pq += l.sg * gw * d; acc += l.t; }
      st.add(`Pressure at the chosen point (depth ${f(zq)} ${Lu})`, 'p = p₀ + Σ γᵢ hᵢ', '', `p = ${f(pq)} ${Pu} gauge`, 'Sum of the weight of every liquid column above the point.');
      const pabs = pq + p.patm;
      st.add('Absolute pressure', 'p_abs = p_gauge + p_atm', `p_abs = ${f(pq)} + ${f(p.patm)}`, `p_abs = ${f(pabs)} ${Pu}${psi(pabs)}`, '');
      st.add('Equivalent pressure heads', 'h = p / γ', `h_water = ${f(pq)} / ${f(gw)};  h_Hg = ${f(pq)} / (13.6 × ${f(gw)})`, `${f(hW(pq))} ${Lu} of water = ${f(hHg(pq))} ${Lu} of mercury`, '');
      out.push({ k: 'p at point (gauge)', v: pq, u: Pu, hl: true }, { k: 'p at point (absolute)', v: pabs, u: Pu, hl: true }, { k: 'p at bottom (gauge)', v: pc, u: Pu }, { k: 'Head of water', v: hW(pq), u: Lu }, { k: 'Head of mercury', v: hHg(pq), u: Lu });
      if (U.id === 'EN') out.push({ k: 'p at point', v: pq / 144, u: 'psi' });
      Object.assign(geo, { L, pts, Ztot, zq, pq, p0: p.p0 });
      status = { cls: 'ok', text: `p = ${f(pq)} ${Pu} gauge at ${f(zq)} ${Lu}` };
    } else if (p.sub === 'utube') {
      const gA = p.sgA * gw, gm = p.sgM * gw;
      if (p.type === 'piezo') {
        const pA = gA * p.hp;
        st.add('Piezometer', 'p_A = γ_A h', `p_A = ${f(p.sgA)}×${f(gw)} × ${f(p.hp)}`, `p_A = ${f(pA)} ${Pu}`, 'The liquid rises in the open tube until its weight balances the pressure at A. Only suitable for small positive gauge pressures.');
        out.push({ k: 'p_A (gauge)', v: pA, u: Pu, hl: true }, { k: 'p_A (absolute)', v: pA + p.patm, u: Pu });
        Object.assign(geo, { type: 'piezo', hp: p.hp, pA });
        status = { cls: 'ok', text: `p_A = ${f(pA)} ${Pu}` };
      } else {
        const pEnd = p.closed ? p.pEnd : 0;
        st.add('Unit weights', 'γ = Sg × γw', `γ_A = ${f(p.sgA)}×${f(gw)},  γ_m = ${f(p.sgM)}×${f(gw)}`, `γ_A = ${f(gA)},  γ_m = ${f(gm)} ${U.gamma}`, '');
        if (p.sgM <= p.sgA) warn.push('The manometer liquid should be heavier than the fluid at A, or it will not stay at the bottom of the U.');
        const pA = pEnd + gm * p.h - gA * p.y;
        st.add('Manometer equation (start at A, go down +, up −)', 'p_A + γ_A y − γ_m h = p_end', `p_A + ${f(gA)}×${f(p.y)} − ${f(gm)}×${f(p.h)} = ${f(pEnd)}`, `p_A = ${f(pA)} ${Pu} gauge`, 'Pressure is equal at the same level in a continuous liquid, so we can walk the tube from A to the open end.');
        st.add('Absolute pressure at A', 'p_A,abs = p_A + p_atm', `= ${f(pA)} + ${f(p.patm)}`, `${f(pA + p.patm)} ${Pu}${psi(pA + p.patm)}`, '');
        if (pA + p.patm < 0) warn.push('Absolute pressure is negative — not physically possible.');
        out.push({ k: 'p_A (gauge)', v: pA, u: Pu, hl: true }, { k: 'p_A (absolute)', v: pA + p.patm, u: Pu }, { k: 'Head of fluid A', v: pA / gA, u: Lu });
        Object.assign(geo, { type: 'utube', y: p.y, h: p.h, pA, closed: p.closed, pEnd });
        status = { cls: pA >= 0 ? 'ok' : 'warn', text: `p_A = ${f(pA)} ${Pu} ${pA < 0 ? '(vacuum)' : ''}` };
      }
    } else if (p.sub === 'diff') {
      const gA = p.sgA * gw, gB = p.sgB * gw, gm = p.sgM * gw, inv = p.inverted;
      st.add('Unit weights', 'γ = Sg × γw', `γ_A = ${f(gA)},  γ_B = ${f(gB)},  γ_m = ${f(gm)}`, U.gamma, '');
      let h = p.h, dP;
      if (!inv) {
        if (p.solve === 'h') {
          if (Math.abs(gm - gB) < 1e-9) return fail(['γ_m = γ_B: the reading h does not depend on the pressure difference.']);
          h = (p.dP - gB * (p.zA + p.dz) + gA * p.zA) / (gm - gB);
          st.add('Reading for the given p_A − p_B', 'h = [Δp − γ_B(z_A + Δz) + γ_A z_A] / (γ_m − γ_B)', `h = [${f(p.dP)} − ${f(gB)}(${f(p.zA)} + ${f(p.dz)}) + ${f(gA)}×${f(p.zA)}] / (${f(gm)} − ${f(gB)})`, `h = ${f(h)} ${Lu}`, '');
        }
        const zB = p.zA + p.dz - h;
        dP = gm * h + gB * zB - gA * p.zA;
        st.add('Height of B above the right meniscus', 'z_B = z_A + Δz − h', `z_B = ${f(p.zA)} + ${f(p.dz)} − ${f(h)}`, `z_B = ${f(zB)} ${Lu}`, 'Δz = elevation of B above A.');
        st.add('Manometer equation (A → B)', 'p_A + γ_A z_A − γ_m h − γ_B z_B = p_B', `p_A − p_B = ${f(gm)}×${f(h)} + ${f(gB)}×${f(zB)} − ${f(gA)}×${f(p.zA)}`, `p_A − p_B = ${f(dP)} ${Pu}`, 'Walk down from A to the left meniscus, up through the manometer liquid, then up to B.');
        if (p.sgM <= Math.max(p.sgA, p.sgB)) warn.push('For an upright U the manometer liquid must be heavier than both pipe fluids.');
        Object.assign(geo, { zB });
      } else {
        if (p.solve === 'h') {
          if (Math.abs(gB - gm) < 1e-9) return fail(['γ_m = γ_B: the reading h does not depend on the pressure difference.']);
          h = (p.dP - gA * p.zA + gB * (p.zA - p.dz)) / (gB - gm);
          st.add('Reading for the given p_A − p_B', 'h = [Δp − γ_A z_A + γ_B(z_A − Δz)] / (γ_B − γ_m)', '', `h = ${f(h)} ${Lu}`, '');
        }
        const zB = p.zA - h - p.dz;
        dP = gA * p.zA - gm * h - gB * zB;
        st.add('Height of the right meniscus above B', 'z_B = z_A − h − Δz', `z_B = ${f(p.zA)} − ${f(h)} − ${f(p.dz)}`, `z_B = ${f(zB)} ${Lu}`, 'Inverted U: the light manometer fluid sits on top.');
        st.add('Manometer equation (A → B)', 'p_A − γ_A z_A + γ_m h + γ_B z_B = p_B', `p_A − p_B = ${f(gA)}×${f(p.zA)} − ${f(gm)}×${f(h)} − ${f(gB)}×${f(zB)}`, `p_A − p_B = ${f(dP)} ${Pu}`, 'Walk up from A, across the top through the light fluid, then down to B.');
        if (p.sgM >= Math.min(p.sgA, p.sgB)) warn.push('For an inverted U the manometer fluid must be lighter than both pipe fluids.');
        Object.assign(geo, { zB });
      }
      if (geo.zB < 0) warn.push('B ends up below the meniscus on its side — check the geometry.');
      if (h < 0) warn.push('Negative reading — the deflection is the other way round.');
      out.push({ k: 'p_A − p_B', v: dP, u: Pu, hl: true }, { k: 'Reading h', v: h, u: Lu, hl: p.solve === 'h' }, { k: 'Δp as head of water', v: dP / gw, u: Lu });
      Object.assign(geo, { inv, h, zA: p.zA, dz: p.dz, dP });
      status = { cls: 'ok', text: `p_A − p_B = ${f(dP)} ${Pu}` };
    } else if (p.sub === 'multi') {
      const legs = p.legs.slice(0, p.n);
      let pc = p.solve === 'pB' ? p.pA : p.pB;
      const sign = p.solve === 'pB' ? 1 : -1;
      const list = p.solve === 'pB' ? legs : legs.slice().reverse();
      st.add(p.solve === 'pB' ? 'Start in chamber A' : 'Start in chamber B (working backwards)', 'p = known gauge pressure', '', `p = ${f(pc)} ${Pu}`, 'Going DOWN a column adds γh, going UP subtracts γh.');
      const press = [p.solve === 'pB' ? pc : null];
      list.forEach((l, j) => {
        const i = p.solve === 'pB' ? j : legs.length - 1 - j;
        const g = l.sg * gw, dz = sign * l.dz, dp = -g * dz;
        const p1 = pc + dp;
        st.add(`Leg ${i + 1}: ${l.dz >= 0 ? 'up' : 'down'} ${f(Math.abs(l.dz))} ${Lu} through Sg ${f(l.sg)}`, dz >= 0 ? 'p_next = p − γ Δz' : 'p_next = p + γ |Δz|', `p = ${f(pc)} ${dp >= 0 ? '+' : '−'} ${f(l.sg)}×${f(gw)}×${f(Math.abs(l.dz))}`, `p = ${f(p1)} ${Pu}`, '');
        pc = p1; press.push(pc);
      });
      const pA = p.solve === 'pB' ? p.pA : pc, pB = p.solve === 'pB' ? pc : p.pB;
      st.add('Result', p.solve === 'pB' ? 'p_B = p_A − Σ γᵢ Δzᵢ' : 'p_A = p_B + Σ γᵢ Δzᵢ', '', `p_A = ${f(pA)} ${Pu},  p_B = ${f(pB)} ${Pu}`, 'Δz is positive when the path goes up.');
      out.push({ k: 'p_A (gauge)', v: pA, u: Pu, hl: p.solve === 'pA' }, { k: 'p_B (gauge)', v: pB, u: Pu, hl: p.solve === 'pB' }, { k: 'p_A − p_B', v: pA - pB, u: Pu }, { k: 'p_A absolute', v: pA + p.patm, u: Pu }, { k: 'p_B absolute', v: pB + p.patm, u: Pu });
      // pressure at every node, from A
      let q = pA; const nodes = [q];
      legs.forEach((l) => { q -= l.sg * gw * l.dz; nodes.push(q); });
      Object.assign(geo, { legs, pA, pB, nodes, gasA: p.gasA, gasB: p.gasB });
      status = { cls: 'ok', text: `p_A = ${f(pA)}, p_B = ${f(pB)} ${Pu}` };
    } else if (p.sub === 'press') {
      const A1 = (PI * p.d1 ** 2) / 4, A2 = (PI * p.d2 ** 2) / 4, g = p.sg * gw;
      const F1 = p.lever ? p.Fh * p.ratio : p.F1;
      st.add('Piston areas', 'A = π d² / 4', `A₁ = π×${f(p.d1)}²/4,  A₂ = π×${f(p.d2)}²/4`, `A₁ = ${f(A1)},  A₂ = ${f(A2)} ${U.area}`, '');
      if (p.lever) st.add('Force on the small piston from the lever', 'F₁ = F_hand × (a / b)', `F₁ = ${f(p.Fh)} × ${f(p.ratio)}`, `F₁ = ${f(F1)} ${U.force}`, 'Mechanical advantage of the handle.');
      const p1 = F1 / A1, p2 = p1 - g * p.dz, F2 = p2 * A2;
      st.add('Pressure under the small piston', 'p₁ = F₁ / A₁', `p₁ = ${f(F1)} / ${f(A1)}`, `p₁ = ${f(p1)} ${Pu}`, 'Pascal: pressure is transmitted through the liquid.');
      st.add('Pressure under the large piston', 'p₂ = p₁ − γ Δz', `p₂ = ${f(p1)} − ${f(g)} × ${f(p.dz)}`, `p₂ = ${f(p2)} ${Pu}`, 'Δz = height of the large piston above the small one.');
      st.add('Force on the large piston', 'F₂ = p₂ A₂', `F₂ = ${f(p2)} × ${f(A2)}`, `F₂ = ${f(F2)} ${U.force}`, '');
      out.push({ k: 'F₁ on small piston', v: F1, u: U.force }, { k: 'p₁', v: p1, u: Pu }, { k: 'p₂', v: p2, u: Pu }, { k: 'F₂ (lifting force)', v: F2, u: U.force, hl: true }, { k: 'Force ratio F₂/F₁', v: F2 / F1, u: '' });
      Object.assign(geo, { d1: p.d1, d2: p.d2, dz: p.dz, F1, F2, p1, p2 });
      status = { cls: 'ok', text: `F₂ = ${f(F2)} ${U.force}` };
    }
    return { ok: true, err, warn, steps: st.list, out, status, geo };
  }

  /* =================================================================== */
  /* ANALYSIS OF GRAVITY DAMS (per unit length)                           */
  /* =================================================================== */
  /** Area and centroid of a polygon. */
  function polyAC(pts) {
    let A = 0, cx = 0, cy = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      const c = x0 * y1 - x1 * y0; A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
    }
    A /= 2;
    if (Math.abs(A) < 1e-12) return { A: 0, x: 0, y: 0 };
    return { A: Math.abs(A), x: cx / (6 * A), y: cy / (6 * A) };
  }
  /**
   * Split the region between y = lo(x) and y = hi(x) over [x0,x1] (both linear)
   * into a rectangle and a triangle. Returns pieces with polygon, kind.
   */
  function stripPieces(x0, x1, lo0, lo1, hi0, hi1) {
    const out = [];
    if (x1 - x0 < 1e-9) return out;
    // Case A: flat bottom (lo0 === lo1), sloped top
    if (Math.abs(lo0 - lo1) < 1e-9) {
      const m = Math.min(hi0, hi1);
      if (m - lo0 > 1e-9) out.push({ kind: 'rect', pts: [[x0, lo0], [x1, lo0], [x1, m], [x0, m]] });
      if (Math.abs(hi0 - hi1) > 1e-9) out.push({ kind: 'tri', pts: hi1 > hi0 ? [[x0, m], [x1, m], [x1, hi1]] : [[x0, m], [x1, m], [x0, hi0]] });
      return out;
    }
    // Case B: flat top, sloped bottom
    if (Math.abs(hi0 - hi1) < 1e-9) {
      const m = Math.max(lo0, lo1);
      if (hi0 - m > 1e-9) out.push({ kind: 'rect', pts: [[x0, m], [x1, m], [x1, hi0], [x0, hi0]] });
      out.push({ kind: 'tri', pts: lo1 < lo0 ? [[x0, m], [x1, lo1], [x1, m]] : [[x0, lo0], [x1, m], [x0, m]] });
      return out;
    }
    out.push({ kind: 'trap', pts: [[x0, lo0], [x1, lo1], [x1, hi1], [x0, hi0]] });
    return out;
  }

  /** Profile (top line of the dam over a flat base y = 0) from the template parameters. */
  function damProfile(p) {
    if (p.shape === 'custom') return p.pts.map((q) => [+q[0], +q[1]]);
    const { a, H } = p, bu = p.bu, hu = Math.min(p.hu, H), bd = p.bd, hs = Math.min(p.hs, H);
    const pts = [[0, 0]];
    if (bu > 0) pts.push([bu, hu]);
    pts.push([bu, H], [bu + a, H]);
    if (bd > 0) pts.push([bu + a, hs], [bu + a + bd, 0]); else pts.push([bu + a, 0]);
    // remove consecutive duplicates
    return pts.filter((q, i) => i === 0 || Math.abs(q[0] - pts[i - 1][0]) > 1e-12 || Math.abs(q[1] - pts[i - 1][1]) > 1e-12);
  }

  function dam(p, U) {
    const st = Steps(), warn = [], err = [], out = [];
    const gw = U.gw, Fu = U.force, Lu = U.len, Mu = U.mom;
    const prof = damProfile(p);
    if (prof.length < 2) return fail(['The profile needs at least two points.']);
    for (let i = 1; i < prof.length; i++) if (prof[i][0] < prof[i - 1][0] - 1e-12) err.push(`Point ${i + 1}: x must not decrease along the profile (heel → toe).`);
    if (prof.some((q) => q[1] < 0 || !isFinite(q[0]) || !isFinite(q[1]))) err.push('Heights must be ≥ 0.');
    if (Math.abs(prof[0][0]) > 1e-9) err.push('The first point (heel) must be at x = 0.');
    const B = prof[prof.length - 1][0];
    if (!(B > 0)) err.push('The base width must be positive.');
    if (err.length) return fail(err);
    // ensure closed at ground level
    const top = prof.slice();
    if (top[0][1] > 0) top.unshift([0, 0]);
    if (top[top.length - 1][1] > 0) top.push([B, 0]);
    const Hmax = Math.max(...top.map((q) => q[1]));
    const h1 = p.h1, h2 = p.tail ? p.h2 : 0;
    if (!(h1 >= 0)) err.push('Water depth must be ≥ 0.');
    if (h1 > Hmax + 1e-9) err.push(`Water depth ${f(h1)} ${Lu} is above the crest (${f(Hmax)} ${Lu}) — an overflow dam is not modelled here.`);
    if (h2 > Hmax) err.push('Tailwater is above the crest.');
    if (err.length) return fail(err);
    const gc = p.gcBy === 'sg' ? p.sgc * gw : p.gc;

    st.add('Unit weight of concrete', p.gcBy === 'sg' ? 'γ_c = Sg_c × γw' : 'γ_c (given)', p.gcBy === 'sg' ? `γ_c = ${f(p.sgc)} × ${f(gw)}` : '', `γ_c = ${f(gc)} ${U.gamma}`, 'Analysis is per unit length of dam (1 ' + Lu + ' into the page).');
    st.add('Base width', 'B = x_toe − x_heel', '', `B = ${f(B)} ${Lu}`, 'Moments are taken about the TOE (downstream end of the base).');

    // ---- concrete pieces ----
    const pieces = [];
    for (let i = 0; i < top.length - 1; i++) {
      const [x0, y0] = top[i], [x1, y1] = top[i + 1];
      stripPieces(x0, x1, 0, 0, y0, y1).forEach((pc) => pieces.push(pc));
    }
    const comps = pieces.map((pc, i) => {
      const ac = polyAC(pc.pts);
      const W = gc * ac.A;
      return { ...pc, A: ac.A, x: ac.x, y: ac.y, W, arm: B - ac.x, M: W * (B - ac.x), name: `W${i + 1}` };
    }).filter((c) => c.A > 1e-12);
    comps.forEach((c) => {
      const xs = c.pts.map((q) => q[0]), ys = c.pts.map((q) => q[1]);
      const bw = Math.max(...xs) - Math.min(...xs), hh = Math.max(...ys) - Math.min(...ys);
      c.desc = c.kind === 'rect' ? `rectangle ${f(bw)} × ${f(hh)}` : c.kind === 'tri' ? `triangle ½ × ${f(bw)} × ${f(hh)}` : 'trapezoid';
      st.add(`${c.name} — concrete ${c.desc}`, c.kind === 'rect' ? 'W = γ_c b h' : 'W = γ_c (½ b h)', `W = ${f(gc)} × ${f(c.A)}`, `W = ${f(c.W)} ${Fu},  arm to toe = ${f(c.arm)} ${Lu},  M = ${f(c.M)} ${Mu}`, `Centroid at x = ${f(c.x)} ${Lu} from the heel.`);
    });
    const Wc = comps.reduce((s, c) => s + c.W, 0);

    // ---- upstream water: horizontal ----
    const forces = []; // {name, F, dir:'x'|'y', sign, x, y, arm, M, kind:'R'|'O'}
    const P1 = 0.5 * gw * h1 * h1;
    if (h1 > 0) {
      st.add('Upstream water — horizontal force', 'P = ½ γw h²', `P = ½ × ${f(gw)} × ${f(h1)}²`, `P = ${f(P1)} ${Fu},  acts at h/3 = ${f(h1 / 3)} ${Lu} above the base`, 'Triangular pressure distribution on the vertical projection of the upstream face.');
      forces.push({ name: 'P', F: P1, dir: 'x', sign: +1, x: 0, y: h1 / 3, arm: h1 / 3, M: P1 * h1 / 3, kind: 'O' });
    }
    // ---- upstream water: vertical (on battered face) ----
    const wv = [];
    if (h1 > 0) {
      for (let i = 0; i < top.length - 1; i++) {
        let [x0, y0] = top[i], [x1, y1] = top[i + 1];
        if (y0 >= h1 - 1e-12) break;
        if (x1 - x0 < 1e-12) { if (y1 >= h1) break; else continue; }
        let stop = false;
        if (y1 > h1) { x1 = x0 + ((h1 - y0) / (y1 - y0)) * (x1 - x0); y1 = h1; stop = true; }
        stripPieces(x0, x1, y0, y1, h1, h1).forEach((pc) => wv.push(pc));
        if (stop) break;
      }
    }
    const waterUp = wv.map((pc, i) => { const ac = polyAC(pc.pts); const F = gw * ac.A; return { ...pc, A: ac.A, x: ac.x, y: ac.y, F, arm: B - ac.x, M: F * (B - ac.x), name: `Wv${i + 1}` }; }).filter((c) => c.A > 1e-12);
    waterUp.forEach((c) => st.add(`${c.name} — water on the upstream face (${c.kind === 'rect' ? 'rectangle' : 'triangle'})`, 'W = γw × area', `W = ${f(gw)} × ${f(c.A)}`, `W = ${f(c.F)} ${Fu},  arm = ${f(c.arm)} ${Lu},  M = ${f(c.M)} ${Mu}`, 'Weight of water directly above the sloping upstream face — a resisting force.'));
    // ---- tailwater ----
    const tw = [];
    let P2 = 0;
    if (h2 > 0) {
      P2 = 0.5 * gw * h2 * h2;
      st.add('Tailwater — horizontal force', 'P₂ = ½ γw h₂²', `P₂ = ½ × ${f(gw)} × ${f(h2)}²`, `P₂ = ${f(P2)} ${Fu},  at h₂/3 = ${f(h2 / 3)} ${Lu}`, 'Acts toward upstream — resists sliding and overturning.');
      forces.push({ name: 'P₂', F: P2, dir: 'x', sign: -1, x: B, y: h2 / 3, arm: h2 / 3, M: P2 * h2 / 3, kind: 'R' });
      for (let i = top.length - 1; i > 0; i--) {
        let [x1, y1] = top[i], [x0, y0] = top[i - 1];
        if (y1 >= h2 - 1e-12) break;
        if (x1 - x0 < 1e-12) { if (y0 >= h2) break; else continue; }
        let stop = false;
        if (y0 > h2) { x0 = x1 - ((h2 - y1) / (y0 - y1)) * (x1 - x0); y0 = h2; stop = true; }
        stripPieces(x0, x1, y0, y1, h2, h2).forEach((pc) => tw.push(pc));
        if (stop) break;
      }
    }
    const waterDn = tw.map((pc, i) => { const ac = polyAC(pc.pts); const F = gw * ac.A; return { ...pc, A: ac.A, x: ac.x, y: ac.y, F, arm: B - ac.x, M: F * (B - ac.x), name: `Wt${i + 1}` }; }).filter((c) => c.A > 1e-12);
    waterDn.forEach((c) => st.add(`${c.name} — tailwater on the downstream face`, 'W = γw × area', `W = ${f(gw)} × ${f(c.A)}`, `W = ${f(c.F)} ${Fu},  arm = ${f(c.arm)} ${Lu}`, ''));
    // ---- silt ----
    let Ps = 0;
    if (p.silt && p.hsilt > 0) {
      const phi = p.phis * DEG, Ka = (1 - Math.sin(phi)) / (1 + Math.sin(phi));
      Ps = 0.5 * Ka * p.gsub * p.hsilt ** 2;
      st.add('Silt pressure (Rankine active)', 'K_a = (1 − sin φ)/(1 + sin φ);  P_s = ½ K_a γ′ h_s²', `K_a = ${f(Ka)};  P_s = ½ × ${f(Ka)} × ${f(p.gsub)} × ${f(p.hsilt)}²`, `P_s = ${f(Ps)} ${Fu} at h_s/3 = ${f(p.hsilt / 3)} ${Lu}`, 'Submerged silt deposited against the upstream face (in addition to the full water pressure).');
      forces.push({ name: 'P_s', F: Ps, dir: 'x', sign: +1, x: 0, y: p.hsilt / 3, arm: p.hsilt / 3, M: Ps * p.hsilt / 3, kind: 'O' });
      if (p.hsilt > h1) warn.push('Silt is deeper than the water — check h_s.');
    }
    // ---- uplift ----
    let upl = [];
    let Uf = 0;
    if (p.uplift) {
      const c = p.upf / 100, u1 = c * gw * h1, u2 = c * gw * h2;
      const pcs = [];
      if (Math.min(u1, u2) > 1e-12) pcs.push({ kind: 'rect', F: Math.min(u1, u2) * B, x: B / 2 });
      if (Math.abs(u1 - u2) > 1e-12) pcs.push({ kind: 'tri', F: 0.5 * Math.abs(u1 - u2) * B, x: u1 > u2 ? B / 3 : (2 * B) / 3 });
      upl = pcs.map((q, i) => ({ ...q, arm: B - q.x, M: q.F * (B - q.x), name: `U${pcs.length > 1 ? i + 1 : ''}` }));
      Uf = upl.reduce((s, q) => s + q.F, 0);
      st.add('Uplift pressure at heel and toe', 'u_heel = c γw h,  u_toe = c γw h₂', `u_heel = ${f(c)} × ${f(gw)} × ${f(h1)};  u_toe = ${f(c)} × ${f(gw)} × ${f(h2)}`, `u_heel = ${f(u1)},  u_toe = ${f(u2)} ${U.press}`, `Linear variation across the base; c = ${f(p.upf)}% of full hydrostatic uplift.`);
      upl.forEach((q) => st.add(`${q.name} — uplift ${q.kind === 'rect' ? 'rectangle' : 'triangle'}`, q.kind === 'rect' ? 'U = u_min B' : 'U = ½ (u_heel − u_toe) B', '', `U = ${f(q.F)} ${Fu},  arm = ${f(q.arm)} ${Lu},  M = ${f(q.M)} ${Mu}`, 'Uplift acts upward on the base — an overturning force.'));
      Object.assign(upl, { u1, u2 });
    }

    // ---- sums ----
    const Rv = Wc + waterUp.reduce((s, c) => s + c.F, 0) + waterDn.reduce((s, c) => s + c.F, 0) - Uf;
    const Rh = P1 + Ps - P2;
    const RM = comps.reduce((s, c) => s + c.M, 0) + waterUp.reduce((s, c) => s + c.M, 0) + waterDn.reduce((s, c) => s + c.M, 0) + (P2 * h2) / 3;
    const OM = P1 * (h1 / 3) + (Ps * (p.hsilt || 0)) / 3 * (p.silt ? 1 : 0) + upl.reduce((s, q) => s + q.M, 0);
    st.add('Sum of vertical forces', 'R_y = ΣW_concrete + ΣW_water − U', `R_y = ${f(Wc)} + ${f(Rv - Wc + Uf)} − ${f(Uf)}`, `R_y = ${f(Rv)} ${Fu}`, '');
    st.add('Sum of horizontal forces', 'R_x = P + P_s − P₂', `R_x = ${f(P1)} + ${f(Ps)} − ${f(P2)}`, `R_x = ${f(Rh)} ${Fu}`, '');
    st.add('Righting moment about the toe', 'RM = Σ W·arm (+ P₂ h₂/3)', '', `RM = ${f(RM)} ${Mu}`, 'Concrete and water weights, plus the tailwater thrust.');
    st.add('Overturning moment about the toe', 'OM = P h/3 + P_s h_s/3 + Σ U·arm', '', `OM = ${f(OM)} ${Mu}`, 'Upstream thrust, silt and uplift.');
    if (!(Rv > 0)) return { ...fail(['Uplift exceeds the weight — the dam floats (R_y ≤ 0).'], warn, st.list) };
    const FSo = OM > 0 ? RM / OM : Infinity;
    const FSs = Rh > 0 ? (p.mu * Rv) / Rh : Infinity;
    st.add('Factor of safety against overturning', 'FS_OT = RM / OM', `FS_OT = ${f(RM)} / ${f(OM)}`, `FS_OT = ${f(FSo)} ${FSo >= p.fsoReq ? '≥' : '<'} ${f(p.fsoReq)}`, FSo >= p.fsoReq ? 'Safe against overturning.' : 'NOT safe against overturning.');
    st.add('Factor of safety against sliding', 'FS_S = μ R_y / R_x', `FS_S = ${f(p.mu)} × ${f(Rv)} / ${f(Rh)}`, `FS_S = ${f(FSs)} ${FSs >= p.fssReq ? '≥' : '<'} ${f(p.fssReq)}`, FSs >= p.fssReq ? 'Safe against sliding.' : 'NOT safe against sliding.');
    const xb = (RM - OM) / Rv; // from toe
    const e = B / 2 - xb;
    st.add('Location of R_y from the toe', 'x̄ = (RM − OM) / R_y', `x̄ = (${f(RM)} − ${f(OM)}) / ${f(Rv)}`, `x̄ = ${f(xb)} ${Lu}`, '');
    st.add('Eccentricity', 'e = B/2 − x̄', `e = ${f(B / 2)} − ${f(xb)}`, `e = ${f(e)} ${Lu}  (B/6 = ${f(B / 6)} ${Lu})`, Math.abs(e) <= B / 6 + 1e-12 ? 'Resultant lies within the middle third → no tension at the base.' : 'Resultant is OUTSIDE the middle third → part of the base lifts off.');
    let qT, qH, mode;
    if (xb <= 0 || xb >= B) {
      warn.push('The resultant falls outside the base — the dam overturns.');
      qT = qH = NaN; mode = 'out';
      st.add('Foundation pressure', '—', '', 'Resultant outside the base: no equilibrium pressure distribution.', '');
    } else if (Math.abs(e) <= B / 6 + 1e-12) {
      qT = (Rv / B) * (1 + (6 * e) / B); qH = (Rv / B) * (1 - (6 * e) / B); mode = 'trap';
      st.add('Foundation pressure (e ≤ B/6)', 'q = (R_y / B)(1 ± 6e/B)', `q = (${f(Rv)} / ${f(B)})(1 ± 6×${f(e)}/${f(B)})`, `q_toe = ${f(qT)},  q_heel = ${f(qH)} ${U.press}`, 'Linear (trapezoidal) soil pressure, compression throughout.');
    } else if (e > 0) {
      qT = (2 * Rv) / (3 * xb); qH = 0; mode = 'triT';
      st.add('Foundation pressure (e > B/6, near the toe)', 'q_max = 2R_y / (3x̄)', `q_max = 2 × ${f(Rv)} / (3 × ${f(xb)})`, `q_toe = ${f(qT)} ${U.press},  bearing length 3x̄ = ${f(3 * xb)} ${Lu}`, 'Soil cannot take tension: only a triangle of length 3x̄ is in contact.');
    } else {
      const xh = B - xb; qH = (2 * Rv) / (3 * xh); qT = 0; mode = 'triH';
      st.add('Foundation pressure (e > B/6, near the heel)', 'q_max = 2R_y / (3(B − x̄))', `q_max = 2 × ${f(Rv)} / (3 × ${f(xh)})`, `q_heel = ${f(qH)} ${U.press}`, '');
    }
    if (p.qa > 0 && isFinite(qT)) {
      const qm = Math.max(qT, qH);
      st.add('Bearing capacity check', 'q_max ≤ q_allow', `${f(qm)} ${qm <= p.qa ? '≤' : '>'} ${f(p.qa)}`, qm <= p.qa ? 'OK' : 'EXCEEDS allowable bearing pressure', '');
      if (qm > p.qa) warn.push(`Maximum foundation pressure ${f(qm)} ${U.press} exceeds the allowable ${f(p.qa)} ${U.press}.`);
    }
    if (FSo < p.fsoReq) warn.push(`FS against overturning ${f(FSo)} is below ${f(p.fsoReq)}.`);
    if (FSs < p.fssReq) warn.push(`FS against sliding ${f(FSs)} is below ${f(p.fssReq)}.`);

    out.push({ k: 'Base width B', v: B, u: Lu }, { k: 'Concrete weight ΣW', v: Wc, u: Fu });
    comps.forEach((c) => out.push({ k: `  ${c.name} (${c.kind === 'rect' ? 'rect' : c.kind === 'tri' ? 'tri' : 'trap'})`, v: c.W, u: Fu }));
    if (waterUp.length) out.push({ k: 'Water on upstream face', v: waterUp.reduce((s, c) => s + c.F, 0), u: Fu });
    if (waterDn.length) out.push({ k: 'Tailwater weight', v: waterDn.reduce((s, c) => s + c.F, 0), u: Fu });
    out.push({ k: 'Water thrust P', v: P1, u: Fu });
    if (P2) out.push({ k: 'Tailwater thrust P₂', v: P2, u: Fu });
    if (Ps) out.push({ k: 'Silt thrust P_s', v: Ps, u: Fu });
    if (p.uplift) out.push({ k: 'Uplift U', v: Uf, u: Fu });
    out.push({ k: 'R_y', v: Rv, u: Fu }, { k: 'R_x', v: Rh, u: Fu }, { k: 'RM (about toe)', v: RM, u: Mu }, { k: 'OM (about toe)', v: OM, u: Mu });
    out.push({ k: 'FS overturning', v: FSo, u: '', hl: true }, { k: 'FS sliding', v: FSs, u: '', hl: true }, { k: 'x̄ from toe', v: xb, u: Lu }, { k: 'Eccentricity e', v: e, u: Lu });
    out.push({ k: 'q at toe', v: qT, u: U.press, hl: true }, { k: 'q at heel', v: qH, u: U.press, hl: true });
    const okAll = FSo >= p.fsoReq && FSs >= p.fssReq && mode !== 'out';
    const status = { cls: okAll ? (mode === 'trap' ? 'ok' : 'warn') : 'bad', text: `FS_OT = ${f(FSo)}, FS_S = ${f(FSs)}${mode === 'trap' ? '' : mode === 'out' ? ' — OVERTURNS' : ' — outside middle third'}` };
    return {
      ok: true, err, warn, steps: st.list, out, status,
      geo: { prof: top, B, Hmax, h1, h2, comps, waterUp, waterDn, P1, P2, Ps, hsilt: p.silt ? p.hsilt : 0, upl, Uf, Rv, Rh, RM, OM, xb, e, qT, qH, mode, gc },
    };
  }

  Object.assign(P0, { viscosity, pressure, dam, damProfile, polyAC, VU });
})(window);
