/* =====================================================================
   physics3.js — 2026-11-25 book-coverage upgrade (Stage 2)
     HP.meter      Bernoulli between two sections, Venturi / nozzle / orifice
                   meters, end-of-pipe nozzles, Pitot tubes
     HP.pipeDesign single pipe or duct: head loss, discharge or size, with
                   Darcy (f or Colebrook), Hazen-Williams or Manning, laminar
                   details; and pipe networks by Hardy Cross (mode 'net')
   Same conventions as physics.js: inputs in base units of the chosen system,
   returns { results, steps, warnings, data, invalid }.
   ===================================================================== */
(function (root) {
  'use strict';
  const HP = root.HP;
  const PI = Math.PI, sqrt = Math.sqrt, abs = Math.abs, pow = Math.pow;
  const fmt = HP.fmt;
  function Out() { return { results: [], steps: [], warnings: [], data: {}, invalid: false }; }
  function R(o, label, value, unit, em) { o.results.push({ label, value, unit: unit || '', em: !!em }); }
  function S(o, t, f, s, r, n, table) { o.steps.push({ t, f, s, r, n, table }); }
  function W(o, text, lvl) { o.warnings.push({ lvl: lvl || 'warn', text }); }
  function fail(o, text) { W(o, text, 'err'); o.invalid = true; return o; }
  const area = (D) => (PI * D * D) / 4;
  function bis(f, a, b, it) { let fa = f(a); for (let i = 0; i < (it || 200); i++) { const m = 0.5 * (a + b), fm = f(m); if ((fm > 0) === (fa > 0)) { a = m; fa = fm; } else b = m; } return 0.5 * (a + b); }

  /* ================================================================ */
  /* Flow measurement                                                  */
  /* ================================================================ */
  HP.meter = function (I, U) {
    const o = Out(), g = U.g, L = U.L, mode = I.mode;
    const gf = I.Sg * U.gw; // unit weight of the flowing fluid (kN/m³ or lb/ft³)
    const vh = (v) => (v * v) / (2 * g);
    if (!(I.Sg > 0)) return fail(o, 'The specific gravity of the flowing fluid must be positive.');
    const needM = (mode === 'pitot' && (I.psolve === 'h' || I.pread === 'mano')) || (mode === 'venturi' && (I.msolve === 'h' || I.read === 'mano'));
    if (needM && !(abs(I.Sgm / I.Sg - 1) > 1e-6)) return fail(o, 'The gauge liquid must differ from the flowing fluid, or the manometer cannot read anything.');
    S(o, 'Unit weight of the flowing fluid', 'γ = Sg γw', `γ = ${fmt(I.Sg)} × ${fmt(U.gw)}`, `${fmt(gf)} ${U.gam}`, '');
    // manometer → difference in piezometric head of the flowing fluid
    const manoDH = (h) => {
      const r = I.Sgm / I.Sg - 1;
      S(o, 'Differential manometer', 'Δ(p/γ + z) = h (S_m/S_f − 1)', `= ${fmt(h)} × (${fmt(I.Sgm)}/${fmt(I.Sg)} − 1)`, `${fmt(h * r)} ${L} of flowing fluid`, r < 0 ? 'Gauge liquid lighter than the flowing fluid (inverted U): the sign flips.' : 'Elevation of the taps cancels out: the manometer reads the piezometric head difference.');
      return abs(h * r);
    };
    if (mode === 'bern') {
      const A1 = area(I.D1), A2 = area(I.D2), z1 = I.z1, z2 = I.z2, hL = I.hL;
      S(o, 'Areas', 'A = πD²/4', `A₁ = π(${fmt(I.D1)})²/4,  A₂ = π(${fmt(I.D2)})²/4`, `A₁ = ${fmt(A1)},  A₂ = ${fmt(A2)} ${U.A}`, '');
      let Q, p1, p2;
      if (I.bsolve === 'Q') {
        p1 = I.p1; p2 = I.p2;
        const dh = (p1 - p2) / gf + z1 - z2 - hL, k = 1 / (A2 * A2) - 1 / (A1 * A1);
        S(o, 'Energy equation 1 → 2', 'p₁/γ + z₁ + V₁²/2g = p₂/γ + z₂ + V₂²/2g + h_L', `(${fmt(p1)} − ${fmt(p2)})/${fmt(gf)} + ${fmt(z1)} − ${fmt(z2)} − ${fmt(hL)}`, `${fmt(dh)} ${L} = (Q²/2g)(1/A₂² − 1/A₁²)`, 'Continuity Q = A₁V₁ = A₂V₂ puts both velocities in terms of Q.');
        if (dh <= 0 || k <= 0) return fail(o, dh <= 0 ? 'With these pressures and elevations the flow would go from 2 to 1 (or not at all).' : 'Section 2 must be smaller than section 1 to solve for Q this way.');
        Q = sqrt((2 * g * dh) / k);
        S(o, 'Discharge', 'Q = √(2gΔh / (1/A₂² − 1/A₁²))', `Q = √(2 × ${fmt(g)} × ${fmt(dh)} / ${fmt(k)})`, `${fmt(Q)} ${U.Q}`, '');
      } else {
        Q = I.Q;
        const V1 = Q / A1, V2 = Q / A2;
        S(o, 'Velocities from continuity', 'V = Q/A', `V₁ = ${fmt(Q)}/${fmt(A1)},  V₂ = ${fmt(Q)}/${fmt(A2)}`, `V₁ = ${fmt(V1)},  V₂ = ${fmt(V2)} ${U.v}`, '');
        if (I.bsolve === 'p2') {
          p1 = I.p1;
          p2 = gf * (p1 / gf + z1 + vh(V1) - z2 - vh(V2) - hL);
          S(o, 'Energy equation 1 → 2', 'p₂ = γ(p₁/γ + z₁ + V₁²/2g − z₂ − V₂²/2g − h_L)', `p₂ = ${fmt(gf)}(${fmt(p1 / gf)} + ${fmt(z1)} + ${fmt(vh(V1))} − ${fmt(z2)} − ${fmt(vh(V2))} − ${fmt(hL)})`, `${fmt(p2)} ${U.p}`, '');
        } else {
          p2 = I.p2;
          p1 = gf * (p2 / gf + z2 + vh(V2) + hL - z1 - vh(V1));
          S(o, 'Energy equation 1 → 2', 'p₁ = γ(p₂/γ + z₂ + V₂²/2g + h_L − z₁ − V₁²/2g)', `p₁ = ${fmt(gf)}(${fmt(p2 / gf)} + ${fmt(z2)} + ${fmt(vh(V2))} + ${fmt(hL)} − ${fmt(z1)} − ${fmt(vh(V1))})`, `${fmt(p1)} ${U.p}`, '');
        }
      }
      const V1 = Q / A1, V2 = Q / A2;
      const E1 = p1 / gf + z1 + vh(V1), E2 = p2 / gf + z2 + vh(V2);
      R(o, 'Discharge Q', Q, U.Q, I.bsolve === 'Q'); R(o, 'V₁', V1, U.v); R(o, 'V₂', V2, U.v);
      R(o, 'p₁', p1, U.p, I.bsolve === 'p1'); R(o, 'p₂', p2, U.p, I.bsolve === 'p2');
      R(o, 'Energy line at 1', E1, L); R(o, 'Energy line at 2', E2, L);
      if (I.Sg > 0.5) { const pa = U.sys === 'SI' ? 101.325 : 2116.2; if (p2 + pa < (U.sys === 'SI' ? 2.34 : 48.9)) W(o, 'p₂ is below the vapour pressure of water: the liquid would cavitate before reaching this flow.'); }
      o.data = { kind: 'bern', D1: I.D1, D2: I.D2, z1, z2, p1, p2, V1, V2, Q, E1, E2, gf, hL };
      return o;
    }
    if (mode === 'venturi') {
      const A1 = area(I.D1), A2 = area(I.D2), beta = I.D2 / I.D1;
      if (!(beta < 1)) return fail(o, 'The throat (or orifice) must be smaller than the pipe.');
      const nm = { venturi: 'Venturi meter', nozzle: 'flow nozzle', orifice: 'orifice meter' }[I.mtype];
      const kb = 1 - pow(beta, 4);
      S(o, `Ideal ${nm} equation`, 'Q = C A₂ √(2gΔh / (1 − β⁴)),  β = D₂/D₁', `β = ${fmt(I.D2)}/${fmt(I.D1)} = ${fmt(beta)},  1 − β⁴ = ${fmt(kb)}`, `A₂ = ${fmt(A2)} ${U.A}`, I.mtype === 'orifice' ? 'C is the orifice meter coefficient (it already includes contraction).' : 'Δh is the drop in piezometric head p/γ + z from the inlet to the throat.');
      let dh, Q, C = I.Cm;
      const byM = I.read === 'mano';
      const dhOf = () => (I.read === 'dh' ? (S(o, 'Piezometric head drop (given)', 'Δh = Δ(p/γ + z)', '', `${fmt(I.dhG)} ${L} of flowing fluid`, ''), I.dhG) : byM ? manoDH(I.hm) : (() => { const d = (I.p1 - I.p2) / gf - I.dz; S(o, 'Piezometric head drop from the pressures', 'Δh = (p₁ − p₂)/γ + (z₁ − z₂)', `Δh = (${fmt(I.p1)} − ${fmt(I.p2)})/${fmt(gf)} − ${fmt(I.dz)}`, `${fmt(d)} ${L}`, 'z₂ − z₁ = throat above the inlet.'); return d; })());
      if (I.msolve === 'Q') {
        dh = dhOf();
        if (!(dh > 0)) return fail(o, 'The piezometric head must drop toward the throat.');
        Q = C * A2 * sqrt((2 * g * dh) / kb);
        S(o, 'Discharge', 'Q = C A₂ √(2gΔh/(1 − β⁴))', `Q = ${fmt(C)} × ${fmt(A2)} × √(2 × ${fmt(g)} × ${fmt(dh)} / ${fmt(kb)})`, `${fmt(Q)} ${U.Q}`, '');
      } else if (I.msolve === 'C') {
        dh = dhOf(); Q = I.Q;
        const Qi = A2 * sqrt((2 * g * dh) / kb);
        C = Q / Qi;
        S(o, 'Ideal discharge', 'Q_i = A₂ √(2gΔh/(1 − β⁴))', `Q_i = ${fmt(A2)} × √(2 × ${fmt(g)} × ${fmt(dh)} / ${fmt(kb)})`, `${fmt(Qi)} ${U.Q}`, '');
        S(o, 'Meter coefficient', 'C = Q / Q_i', `C = ${fmt(Q)} / ${fmt(Qi)}`, fmt(C), '');
      } else {
        Q = I.Q;
        dh = (kb * pow(Q / (C * A2), 2)) / (2 * g);
        S(o, 'Piezometric head drop needed', 'Δh = (1 − β⁴)(Q/(C A₂))²/2g', `Δh = ${fmt(kb)} × (${fmt(Q)}/(${fmt(C)} × ${fmt(A2)}))² / (2 × ${fmt(g)})`, `${fmt(dh)} ${L}`, '');
        const r = abs(I.Sgm / I.Sg - 1);
        const h = dh / r;
        S(o, 'Manometer reading', 'h = Δh / |S_m/S_f − 1|', `h = ${fmt(dh)} / ${fmt(r)}`, `${fmt(h)} ${L}`, '');
        const dp = gf * (dh + I.dz);
        S(o, 'Pressure difference between the taps', 'p₁ − p₂ = γ(Δh + z₂ − z₁)', `= ${fmt(gf)} × (${fmt(dh)} + ${fmt(I.dz)})`, `${fmt(dp)} ${U.p}`, '');
        R(o, 'Manometer reading h', h, L, true); R(o, 'p₁ − p₂', dp, U.p);
      }
      const V2 = Q / A2, V1 = Q / A1;
      R(o, 'Discharge Q', Q, U.Q, I.msolve === 'Q'); if (I.msolve === 'C') R(o, 'Meter coefficient C', C, '', true);
      R(o, 'Piezometric head drop Δh', dh, L); R(o, 'Pipe velocity V₁', V1, U.v); R(o, 'Throat velocity V₂', V2, U.v);
      R(o, 'Flow coefficient K = C/√(1 − β⁴)', C / sqrt(kb), '');
      o.data = { kind: 'venturi', mtype: I.mtype, D1: I.D1, D2: I.D2, Q, dh, V1, V2, hm: I.msolve === 'h' ? dh / abs(I.Sgm / I.Sg - 1) : I.hm, read: I.read, Sgm: I.Sgm };
      return o;
    }
    if (mode === 'nozzle') {
      const A1 = area(I.D1), A2 = area(I.D2), Cc = I.Cc, Cv = I.Cv, Aj = Cc * A2;
      S(o, 'Jet area at the vena contracta', 'A_j = C_c A₂', `A_j = ${fmt(Cc)} × ${fmt(A2)}`, `${fmt(Aj)} ${U.A}`, '');
      // H = p1/γ + dz + V1²/2g = Vj²/(2g Cv²)
      let Q, p1;
      const r = pow(Aj / A1, 2);
      if (I.nsolve === 'p') {
        Q = I.Q;
        const Vj = Q / Aj, V1 = Q / A1;
        const H = (Vj * Vj) / (2 * g * Cv * Cv);
        S(o, 'Total head at the base of the nozzle', 'H = V_j²/(2g C_v²)', `H = ${fmt(Vj)}² / (2 × ${fmt(g)} × ${fmt(Cv)}²)`, `${fmt(H)} ${L}`, 'V_j = Q/A_j; C_v accounts for the nozzle loss.');
        p1 = gf * (H - I.dzN - vh(V1));
        S(o, 'Pressure at the base', 'p₁/γ = H − Δz − V₁²/2g', `p₁/γ = ${fmt(H)} − ${fmt(I.dzN)} − ${fmt(vh(V1))}`, `p₁/γ = ${fmt(p1 / gf)} ${L},  p₁ = ${fmt(p1)} ${U.p}`, 'Δz = base above the tip.');
      } else {
        p1 = I.p1;
        const h0 = p1 / gf + I.dzN;
        const Vj = sqrt((2 * g * h0) / (1 / (Cv * Cv) - r));
        S(o, 'Energy, base → jet', 'p₁/γ + Δz + V₁²/2g = V_j²/(2g C_v²),  V₁ = V_j A_j/A₁', `${fmt(p1 / gf)} + ${fmt(I.dzN)} = (V_j²/2g)(1/${fmt(Cv)}² − ${fmt(r)})`, `V_j = ${fmt(Vj)} ${U.v}`, '');
        Q = Vj * Aj;
        S(o, 'Discharge', 'Q = A_j V_j', `Q = ${fmt(Aj)} × ${fmt(Vj)}`, `${fmt(Q)} ${U.Q}`, '');
      }
      const Vj = Q / Aj, V1 = Q / A1, hj = vh(Vj), loss = (1 / (Cv * Cv) - 1) * hj, P = gf * Q * hj;
      S(o, 'Head lost in the nozzle', 'h_L = (1/C_v² − 1) V_j²/2g', `h_L = (1/${fmt(Cv)}² − 1) × ${fmt(hj)}`, `${fmt(loss)} ${L}`, '');
      S(o, 'Power in the jet', 'P = γ Q V_j²/2g', `P = ${fmt(gf)} × ${fmt(Q)} × ${fmt(hj)}`, `${fmt(U.P1(P))} ${U.P1u}`, '');
      R(o, 'Pressure at the base p₁', p1, U.p, I.nsolve === 'p'); R(o, 'Pressure head p₁/γ', p1 / gf, L);
      R(o, 'Discharge Q', Q, U.Q, I.nsolve !== 'p'); R(o, 'Jet velocity V_j', Vj, U.v); R(o, 'Jet diameter', sqrt((4 * Aj) / PI), L);
      R(o, 'Head lost in the nozzle', loss, L); R(o, 'Jet power', U.P1(P), U.P1u, true); R(o, 'Jet power', U.P2(P), U.P2u);
      o.data = { kind: 'nozzle', D1: I.D1, D2: I.D2, dzN: I.dzN, Vj, V1, Q, p1, Cc };
      return o;
    }
    // Pitot tube
    let dh, V;
    const C = I.Cp;
    if (I.psolve === 'V') {
      if (I.pread === 'mano') dh = manoDH(I.hm);
      else if (I.pread === 'heads') { dh = I.hst - I.h0; S(o, 'Stagnation minus static head', 'Δh = h_s − h₀', `Δh = ${fmt(I.hst)} − ${fmt(I.h0)}`, `${fmt(dh)} ${L}`, ''); }
      else { dh = I.dpP / gf; S(o, 'Pressure difference as a head of the flowing fluid', 'Δh = (p_s − p₀)/γ', `Δh = ${fmt(I.dpP)} / ${fmt(gf)}`, `${fmt(dh)} ${L}`, ''); }
      if (!(dh > 0)) return fail(o, 'The stagnation pressure must exceed the static pressure.');
      V = C * sqrt(2 * g * dh);
      S(o, 'Velocity at the tube', 'V = C √(2gΔh)', `V = ${fmt(C)} × √(2 × ${fmt(g)} × ${fmt(dh)})`, `${fmt(V)} ${U.v}`, 'Bernoulli from the free stream to the stagnation point, with the tube coefficient C.');
    } else {
      V = I.Vp;
      dh = pow(V / C, 2) / (2 * g);
      S(o, 'Head difference produced', 'Δh = (V/C)²/2g', `Δh = (${fmt(V)}/${fmt(C)})² / (2 × ${fmt(g)})`, `${fmt(dh)} ${L} of flowing fluid`, '');
      const r = abs(I.Sgm / I.Sg - 1), h = dh / r;
      S(o, 'Manometer deflection', 'h = Δh / |S_m/S_f − 1|', `h = ${fmt(dh)} / ${fmt(r)}`, `${fmt(h)} ${L}`, '');
      R(o, 'Manometer deflection h', h, L, true);
    }
    R(o, 'Velocity V', V, U.v, I.psolve === 'V'); R(o, 'Head difference Δh', dh, L); R(o, 'Stagnation − static pressure', gf * dh, U.p);
    if (I.Sg < 0.01) { const c = U.sys === 'SI' ? 343 : 1125; if (V > 0.3 * c) W(o, `V is above about 0.3 of the speed of sound in air: compressibility makes this estimate a little high.`); }
    o.data = { kind: 'pitot', V, dh, pread: I.pread };
    return o;
  };

  /* ================================================================ */
  /* Pipe design: hf, Q or size for a pipe or duct                     */
  /* ================================================================ */
  function geom(shape, s, I) {
    if (shape === 'square') return { A: s * s, P: 4 * s, txt: `square ${fmt(s)} × ${fmt(s)}` };
    if (shape === 'rect') { const b = s * I.ar; return { A: s * b, P: 2 * (s + b), txt: `${fmt(s)} × ${fmt(b)} rectangle` }; }
    if (shape === 'annulus') { const di = I.Di; return { A: (PI * (s * s - di * di)) / 4, P: PI * (s + di), txt: `annulus ${fmt(s)} / ${fmt(di)}` }; }
    return { A: area(s), P: PI * s, txt: `circle D = ${fmt(s)}` };
  }
  HP.pipeDesign = function (I, U) {
    if (I.mode === 'net') return HP.network(I, U);
    const o = Out(), g = U.g, L = U.L, F = I.pform, mode = I.mode, SI = U.sys === 'SI';
    const gam = I.Sg * U.gw, rho = (gam * (SI ? 1000 : 1)) / g; // kg/m³ or slug/ft³
    const kHW = SI ? 0.8492 : 1.318, kMan = SI ? 1 : 1.486;
    const sizeName = I.shape === 'circle' || I.shape === 'annulus' ? (I.shape === 'annulus' ? 'outer diameter' : 'diameter D') : I.shape === 'rect' ? 'height a (width = ratio × a)' : 'side a';
    const nu = I.nu;
    // friction head for flow Q in a section of size s
    function hfOf(Q, s, rec) {
      const G = geom(I.shape, s, I), Rh = G.A / G.P, Dh = 4 * Rh, V = Q / G.A, Sf = 0;
      let hf, f, Re = nu > 0 ? (V * Dh) / nu : NaN, regime = '';
      if (F === 'darcy' || F === 'cole') {
        if (F === 'cole') { const r = HP.frictionFactor(Re, I.eps / Dh); f = r.f; regime = r.regime; }
        else f = I.f;
        hf = (f * I.L * V * V) / (2 * g * Dh);
      } else if (F === 'hw') { const Sx = pow(V / (kHW * I.C * pow(Rh, 0.63)), 1 / 0.54); hf = Sx * I.L; f = (hf * 2 * g * Dh) / (I.L * V * V); }
      else { const Sx = pow((V * I.n) / (kMan * pow(Rh, 2 / 3)), 2); hf = Sx * I.L; f = (hf * 2 * g * Dh) / (I.L * V * V); }
      const hm = (I.K * V * V) / (2 * g);
      return { G, Rh, Dh, V, f, Re, regime, hf, hm, H: hf + hm, Sf };
    }
    let Q = I.Q, s = I.shape === 'circle' ? I.D : I.shape === 'annulus' ? I.D : I.a;
    if (!(I.L > 0)) return fail(o, 'Length must be positive.');
    if (I.shape === 'annulus' && !(I.Di < s)) return fail(o, 'The inner diameter must be smaller than the outer one.');
    if ((F === 'cole') && !(nu > 0)) return fail(o, 'Enter the kinematic viscosity to use Colebrook.');
    const fName = { darcy: 'Darcy-Weisbach with a given f', cole: 'Darcy-Weisbach, f from Re (64/Re laminar, Colebrook turbulent)', hw: 'Hazen-Williams', manning: 'Manning' }[F];
    const formula = F === 'hw' ? `V = ${kHW} C R^0.63 S^0.54` : F === 'manning' ? `V = (${SI ? '1' : '1.486'}/n) R^(2/3) S^(1/2)` : 'h_f = f (L/D_h) V²/2g';
    if (mode === 'Q') {
      const H = I.H;
      if (!(H > 0)) return fail(o, 'The available head must be positive.');
      Q = bis((q) => hfOf(q, s).H - H, 1e-12, 1e4);
      S(o, 'Discharge for the available head', `H = h_f + ΣK V²/2g,  ${formula}`, `${fName}; solved for Q so that the losses equal H = ${fmt(H)} ${L}`, `Q = ${fmt(Q)} ${U.Q}`, F === 'cole' ? 'f depends on Re, which depends on Q: solved by iteration.' : '');
    } else if (mode === 'D') {
      const H = I.H;
      if (!(H > 0)) return fail(o, 'The allowable head loss must be positive.');
      const lo = I.shape === 'annulus' ? I.Di * 1.0001 : 1e-5;
      s = bis((x) => H - hfOf(Q, x).H, lo, 1e3);
      S(o, `Size for the allowable head loss`, `H = h_f + ΣK V²/2g,  ${formula}`, `${fName}; solved for the ${sizeName}`, `${fmt(s)} ${L} = ${fmt(s * (SI ? 1000 : 12))} ${SI ? 'mm' : 'in'}`, 'Losses fall as the section grows: solved by bisection.');
    }
    const r = hfOf(Q, s);
    const G = r.G;
    S(o, 'Section properties', 'A, wetted perimeter P, R = A/P, D_h = 4R', G.txt, `A = ${fmt(G.A)} ${U.A},  R = ${fmt(r.Rh)},  D_h = ${fmt(r.Dh)} ${L}`, I.shape === 'circle' ? 'For a full circular pipe R = D/4 and D_h = D.' : 'Non-circular duct: use the hydraulic diameter D_h = 4R in place of D.');
    S(o, 'Mean velocity', 'V = Q/A', `V = ${fmt(Q)} / ${fmt(G.A)}`, `${fmt(r.V)} ${U.v}`, '');
    if (nu > 0) S(o, 'Reynolds number', 'Re = V D_h / ν', `Re = ${fmt(r.V)} × ${fmt(r.Dh)} / ${fmt(nu)}`, `${fmt(r.Re)} (${r.Re < 2000 ? 'laminar' : r.Re < 4000 ? 'transitional' : 'turbulent'})`, '');
    if (F === 'cole') S(o, 'Friction factor', r.Re < 2000 ? 'f = 64/Re' : '1/√f = −2 log(ε/3.7D_h + 2.51/(Re√f))', r.Re < 2000 ? `f = 64/${fmt(r.Re)}` : `ε/D_h = ${fmt(I.eps / r.Dh)}`, `f = ${fmt(r.f)}`, '');
    if (F === 'darcy' || F === 'cole') S(o, 'Friction head loss', 'h_f = f (L/D_h) V²/2g', `h_f = ${fmt(r.f)} × (${fmt(I.L)}/${fmt(r.Dh)}) × ${fmt(r.V)}²/(2 × ${fmt(g)})`, `${fmt(r.hf)} ${L}`, '');
    else if (F === 'hw') S(o, 'Friction head loss (Hazen-Williams)', `S = (V/(${kHW} C R^0.63))^(1/0.54),  h_f = S L`, `S = (${fmt(r.V)}/(${kHW} × ${fmt(I.C)} × ${fmt(r.Rh)}^0.63))^1.852`, `S = ${fmt(r.hf / I.L)},  h_f = ${fmt(r.hf)} ${L}`, '');
    else S(o, 'Friction head loss (Manning)', `S = (n V/(${SI ? '1' : '1.486'} R^(2/3)))²,  h_f = S L`, `S = (${fmt(I.n)} × ${fmt(r.V)}/(${SI ? '' : '1.486 × '}${fmt(r.Rh)}^(2/3)))²`, `S = ${fmt(r.hf / I.L)},  h_f = ${fmt(r.hf)} ${L}`, '');
    if (I.K > 0) S(o, 'Minor losses', 'h_m = ΣK V²/2g', `h_m = ${fmt(I.K)} × ${fmt((r.V * r.V) / (2 * g))}`, `${fmt(r.hm)} ${L}`, 'Entrance, exit, bends and valves.');
    const Sf = r.hf / I.L, tau = gam * r.Rh * Sf * (SI ? 1000 : 1), ustar = sqrt(tau / rho);
    S(o, 'Wall shear stress', 'τ₀ = γ R S', `τ₀ = ${fmt(gam)} × ${fmt(r.Rh)} × ${fmt(Sf)}`, `${fmt(tau)} ${SI ? 'Pa' : 'psf'}`, `Shear velocity u* = √(τ₀/ρ) = ${fmt(ustar)} ${U.v}.`);
    const dp = gam * r.hf, Pw = gam * Q * r.H;
    if (r.Re < 2000 && nu > 0 && I.shape === 'circle') {
      S(o, 'Laminar flow (Hagen-Poiseuille)', 'h_f = 32 ν L V/(g D²),  u_max = 2V,  u = u_max(1 − r²/R²)', `h_f = 32 × ${fmt(nu)} × ${fmt(I.L)} × ${fmt(r.V)} / (${fmt(g)} × ${fmt(s)}²)`, `${fmt((32 * nu * I.L * r.V) / (g * s * s))} ${L},  u_max = ${fmt(2 * r.V)} ${U.v}`, 'Same as f = 64/Re in the Darcy-Weisbach equation.');
    }
    if (mode === 'D') R(o, `Required ${sizeName}`, s, L, true);
    R(o, 'Discharge Q', Q, U.Q, mode === 'Q'); R(o, 'Mean velocity V', r.V, U.v);
    R(o, 'Friction head loss h_f', r.hf, L, mode === 'hf'); if (I.K > 0) R(o, 'Minor losses h_m', r.hm, L);
    R(o, 'Total head loss', r.H, L); R(o, 'Pressure drop from friction γh_f', dp, U.p);
    if (nu > 0) R(o, 'Reynolds number', r.Re, ''); R(o, 'Friction factor f', r.f, '');
    R(o, 'Wall shear stress τ₀', tau, SI ? 'Pa' : 'psf'); R(o, 'Shear velocity u*', ustar, U.v);
    R(o, 'Power lost', U.P1(Pw), U.P1u);
    if (nu > 0) R(o, 'Velocity at Re = 2000 (laminar limit)', (2000 * nu) / r.Dh, U.v);
    if (r.Re >= 2000 && r.Re < 4000) W(o, `Re = ${fmt(r.Re)} is in the transition zone; f is uncertain.`);
    if (F === 'hw' && r.Re < 1e5 && nu > 0) W(o, 'Hazen-Williams is meant for turbulent water flow in larger pipes; check with Darcy-Weisbach.', 'info');
    o.data = { kind: 'pipe', shape: I.shape, s, G, V: r.V, Re: r.Re, f: r.f, Dh: r.Dh, hf: r.hf, hm: r.hm, L: I.L, Q };
    return o;
  };

  /* ================================================================ */
  /* Pipe network on a grid of loops — Hardy Cross                     */
  /* ================================================================ */
  HP.netGrid = function (grid) {
    const [nr, nc] = grid.split('x').map(Number);
    const NL = 'ABCDEFGHIJKL';
    const nodes = []; for (let r = 0; r <= nr; r++) for (let c = 0; c <= nc; c++) nodes.push({ r, c, name: NL[r * (nc + 1) + c] });
    const id = (r, c) => r * (nc + 1) + c;
    const pipes = [];
    for (let r = 0; r <= nr; r++) for (let c = 0; c < nc; c++) pipes.push({ a: id(r, c), b: id(r, c + 1) });
    for (let r = 0; r < nr; r++) for (let c = 0; c <= nc; c++) pipes.push({ a: id(r, c), b: id(r + 1, c) });
    pipes.forEach((p) => (p.name = nodes[p.a].name + nodes[p.b].name));
    const pid = (a, b) => pipes.findIndex((p) => (p.a === a && p.b === b));
    const loops = [];
    for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
      // clockwise: top (+), right (+), bottom (−), left (−)
      loops.push([[pid(id(r, c), id(r, c + 1)), 1], [pid(id(r, c + 1), id(r + 1, c + 1)), 1], [pid(id(r + 1, c), id(r + 1, c + 1)), -1], [pid(id(r, c), id(r + 1, c)), -1]]);
    }
    return { nr, nc, nodes, pipes, loops };
  };
  HP.network = function (I, U) {
    const o = Out(), L = U.L, F = I.nform;
    const N = HP.netGrid(I.grid);
    const cName = F === 'darcy' ? 'f' : F === 'manning' ? 'n' : 'C';
    N.pipes.forEach((p, i) => { p.L = I['nL' + (i + 1)]; p.D = I['nD' + (i + 1)]; p.c = I['nc' + (i + 1)]; const k = HP.pipeK(F, p.L, p.D, p.c, U); p.k = k.k; p.m = k.m; });
    const q = N.nodes.map((n, j) => I['q' + (j + 1)] || 0); // + inflow, − outflow
    const sum = q.reduce((a, b) => a + b, 0);
    if (abs(sum) > 1e-9 * Math.max(1, ...q.map(abs))) return fail(o, `Inflows and outflows must balance (Σq = ${fmt(sum)} ${U.Q}). Adjust a node.`);
    if (!q.some((x) => abs(x) > 0)) return fail(o, 'Enter at least one inflow and one outflow.');
    // initial flows: spanning tree (BFS from node 0), chords start at zero
    const nN = N.nodes.length, adj = N.nodes.map(() => []);
    N.pipes.forEach((p, i) => { adj[p.a].push([i, p.b]); adj[p.b].push([i, p.a]); });
    const par = Array(nN).fill(-1), parPipe = Array(nN).fill(-1), order = [0], seen = Array(nN).fill(false); seen[0] = true;
    for (let h = 0; h < order.length; h++) adj[order[h]].forEach(([pi, nb]) => { if (!seen[nb]) { seen[nb] = true; par[nb] = order[h]; parPipe[nb] = pi; order.push(nb); } });
    const Q = N.pipes.map(() => 0);
    const net = q.slice();
    for (let h = order.length - 1; h > 0; h--) {
      const n = order[h], pi = parPipe[n], p = N.pipes[pi];
      // flow from parent to n must supply −net[n]
      const flowToN = -net[n];
      Q[pi] = p.b === n ? flowToN : -flowToN;
      net[par[n]] += net[n];
    }
    S(o, 'Network', `${N.loops.length} loop${N.loops.length > 1 ? 's' : ''}, ${N.pipes.length} pipes, ${nN} junctions`, `head loss h = k Q^m with ${F === 'darcy' ? 'Darcy-Weisbach (m = 2)' : F === 'manning' ? 'Manning (m = 2)' : 'Hazen-Williams (m = 1.852)'}`, `${N.pipes.map((p) => `${p.name}: k = ${fmt(p.k)}`).join(',  ')}`, 'Starting flows satisfy continuity at every junction (spanning-tree guess); each loop is then corrected until Σh = 0 around it.');
    const hist = [];
    let it = 0, maxD = Infinity;
    const table = (title) => {
      const rows = [];
      N.loops.forEach((lp, li) => lp.forEach(([pi, sg]) => { const p = N.pipes[pi], qq = sg * Q[pi], h = sg * p.k * Q[pi] * pow(abs(Q[pi]), p.m - 1); rows.push([`${li + 1}`, p.name, fmt(qq), fmt(h), fmt(abs(h / (qq || 1e-30)))]); }));
      return { head: ['Loop', 'Pipe (clockwise)', `Q (${U.Q})`, `h (${L})`, 'h/Q'], rows, title };
    };
    const first = table('Starting flows');
    while (it < 200 && maxD > 1e-9) {
      const dels = N.loops.map((lp) => {
        let num = 0, den = 0;
        lp.forEach(([pi, sg]) => { const p = N.pipes[pi], a = abs(Q[pi]); num += sg * p.k * Q[pi] * pow(a, p.m - 1); den += p.m * p.k * pow(Math.max(a, 1e-12), p.m - 1); });
        return { d: -num / den, num, den };
      });
      dels.forEach((d, li) => N.loops[li].forEach(([pi, sg]) => (Q[pi] += sg * d.d)));
      maxD = Math.max(...dels.map((d) => abs(d.d)));
      it++;
      if (it <= 3 || maxD <= 1e-9) hist.push([String(it), ...dels.map((d) => fmt(d.d))]);
    }
    S(o, 'Loop corrections (Hardy Cross)', 'ΔQ = −Σ(k Q|Q|^(m−1)) / Σ(m k |Q|^(m−1))', 'All loops corrected together each round; a pipe shared by two loops takes both corrections.', `${it} rounds until every |ΔQ| < 10⁻⁹`, '', { head: ['Round', ...N.loops.map((_, i) => `ΔQ loop ${i + 1}`)], rows: hist });
    S(o, 'Starting flows', '', '', '', 'Signs follow each loop clockwise.', first);
    const fin = table('Final flows');
    S(o, 'Final flows and head losses', 'Σh ≈ 0 around every loop', '', '', '', fin);
    // HGL at junctions from node A
    const hgl = Array(nN).fill(NaN); hgl[0] = I.hA;
    for (let h = 1; h < order.length; h++) { const n = order[h], p = N.pipes[parPipe[n]], hl = p.k * Q[parPipe[n]] * pow(abs(Q[parPipe[n]]), p.m - 1); hgl[n] = p.a === par[n] ? hgl[par[n]] - hl : hgl[par[n]] + hl; }
    N.pipes.forEach((p, i) => { const qf = Q[i]; const from = qf >= 0 ? p.a : p.b, to = qf >= 0 ? p.b : p.a; R(o, `Pipe ${p.name}: ${N.nodes[from].name} → ${N.nodes[to].name}`, abs(qf), U.Q, true); });
    N.nodes.forEach((n, j) => R(o, `HGL at ${n.name}`, hgl[j], L));
    const jr = +I.repN || 0;
    if (I.zRep !== undefined) R(o, `Pressure head at ${N.nodes[jr].name}`, hgl[jr] - I.zRep, L);
    S(o, 'Hydraulic grade line', 'HGL drops by h along each pipe in the direction of flow', `HGL at A = ${fmt(I.hA)} ${L}`, N.nodes.map((n, j) => `${n.name}: ${fmt(hgl[j])}`).join(',  '), `Pressure head at ${N.nodes[jr].name} = HGL − z = ${fmt(hgl[jr])} − ${fmt(I.zRep)} = ${fmt(hgl[jr] - I.zRep)} ${L}`);
    o.data = { kind: 'net', N, Q, q, hgl };
    return o;
  };
})(window);
