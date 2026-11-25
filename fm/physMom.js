/* =====================================================================
 * PHYSICS — momentum of moving fluids (2026-11-25 book-coverage upgrade)
 *   jets on flat plates and curved vanes (fixed, moving, single or a
 *   series), jets split by a wedge, forces on pipe bends / reducers /
 *   nozzles, jet reaction on a tank, jet engines / rockets / jet boats,
 *   rotating sprinklers, propellers / fans / wind turbines (actuator disk).
 * Inputs are in the display units of the chosen system:
 *   SI: jet and pipe diameters in mm, V m/s, Q m³/s, ρ kg/m³, p kPa,
 *       forces N, flow rates kg/s or N/s;  EN: in, ft/s, ft³/s, slug/ft³,
 *       psi, lb, slug/s or lb/s.
 * Result shape as physics.js: { ok, err, warn, status, out, steps, geo }
 * ===================================================================== */
(function (root) {
  'use strict';
  const P0 = root.Physics;
  const f = P0.fmt;
  const PI = Math.PI, DEG = PI / 180, sqrt = Math.sqrt, abs = Math.abs;
  function Steps() { const list = []; return { list, add(t, fo, s, r, n) { list.push({ t, f: fo, s, r, n }); } }; }
  const fail = (err, warn, steps) => ({ ok: false, err, warn: warn || [], steps: steps || [], out: [], geo: {} });
  const ok = (st, out, warn, status, geo) => ({ ok: true, err: [], warn: warn || [], steps: st.list, out, status, geo });
  const units = (U) => {
    const SI = U.id === 'SI';
    return { SI, g: U.g, dF: SI ? 0.001 : 1 / 12, du: SI ? 'mm' : 'in', L: SI ? 'm' : 'ft', v: SI ? 'm/s' : 'ft/s', Q: SI ? 'm³/s' : 'ft³/s', A: SI ? 'm²' : 'ft²', rho: SI ? 'kg/m³' : 'slug/ft³', F: SI ? 'N' : 'lb', pu: SI ? 'kPa' : 'psi', pF: SI ? 1000 : 144, md: SI ? 'kg/s' : 'slug/s', wd: SI ? 'N/s' : 'lb/s', M: SI ? 'N·m' : 'lb·ft', m: SI ? 'kg' : 'slug', Pu: SI ? 'kW' : 'hp', PF: SI ? 1000 : 550, rhoW: SI ? 1000 : 1.94 };
  };
  const pw = (u, P) => P / u.PF; // power in kW or hp
  const angOf = (x, y) => Math.atan2(y, x) / DEG;

  /* ------------------------------------------------------------------ */
  /* Jet on a flat plate                                                  */
  /* ------------------------------------------------------------------ */
  function plate(p, U, u, st, warn) {
    const rho = p.rho, th = p.theta * DEG, A0 = (PI * Math.pow(p.D * u.dF, 2)) / 4;
    let V = p.V, A = A0, Q;
    if (!(rho > 0)) return fail(['Density must be positive.']);
    const sn = Math.sin(th);
    if (!(sn > 1e-6)) return fail(['The plate must make an angle with the jet (θ > 0).']);
    if (p.solve === 'h') {
      if (!(p.Fg > 0) || !(V > 0)) return fail(['Enter the jet velocity and the weight held up.']);
      Q = A * V;
      st.add('Jet area and discharge', 'A = πD²/4,  Q = A V', `A = π(${f(p.D * u.dF)})²/4 = ${f(A)},  Q = ${f(A)} × ${f(V)}`, `Q = ${f(Q)} ${u.Q}`, '');
      const Vh = p.Fg / (rho * Q);
      st.add('Jet speed needed at the plate', 'W = ρ Q V_h  ⇒  V_h = W / (ρ Q)', `V_h = ${f(p.Fg)} / (${f(rho)} × ${f(Q)})`, `V_h = ${f(Vh)} ${u.v}`, 'The water leaves the plate sideways, so all its upward momentum is destroyed.');
      if (Vh >= V) return fail([`The jet cannot hold that weight: even at the nozzle it gives only ρQV = ${f(rho * Q * V)} ${u.F}.`], [], st.list);
      const h = (V * V - Vh * Vh) / (2 * u.g);
      st.add('Height of the plate above the nozzle', 'h = (V² − V_h²) / (2g)', `h = (${f(V)}² − ${f(Vh)}²) / (2 × ${f(u.g)})`, `h = ${f(h)} ${u.L}`, 'Bernoulli along the free jet (no losses).');
      return { ok: true, err: [], warn, steps: st.list, status: { cls: 'ok', text: `h = ${f(h)} ${u.L}` }, out: [{ k: 'Height of the load above the nozzle h', v: h, u: u.L, hl: true }, { k: 'Jet speed at the load V_h', v: Vh, u: u.v }, { k: 'Discharge Q', v: Q, u: u.Q }, { k: 'Max height of the free jet V²/2g', v: (V * V) / (2 * u.g), u: u.L }], geo: { kind: 'plate', V, Vh, Vr: Vh, u: 0, Q, D: sqrt((4 * A) / PI), Fn: p.Fg, Fx: p.Fg, Fy: 0, theta: 90, motion: 'fixed', vert: true, h } };
    }
    if (p.solve === 'Q' || p.solve === 'D') {
      if (p.motion !== 'fixed' || p.vert) return fail(['Solving for the flow or the jet size works for a fixed plate with a horizontal jet.']);
      if (!(p.Fg > 0)) return fail(['Enter the force on the plate.']);
      const k = sn * sn; // F_x along the jet = ρ Q V sin²θ  (normal force × sinθ)
      if (p.solve === 'Q') {
        V = sqrt(p.Fg / (rho * A * k)); Q = A * V;
        st.add('Velocity from the measured force', 'F = ρ A V² sin²θ  ⇒  V = √(F / (ρ A sin²θ))', `V = √(${f(p.Fg)} / (${f(rho)} × ${f(A)} × ${f(k)}))`, `V = ${f(V)} ${u.v}`, 'F is the force along the jet on a fixed plate.');
        st.add('Discharge', 'Q = A V', `Q = ${f(A)} × ${f(V)}`, `Q = ${f(Q)} ${u.Q}`, '');
      } else {
        Q = p.Q; A = (rho * Q * Q * k) / p.Fg; V = Q / A;
        st.add('Jet area from the force', 'F = ρ Q² sin²θ / A  ⇒  A = ρ Q² sin²θ / F', `A = ${f(rho)} × ${f(Q)}² × ${f(k)} / ${f(p.Fg)}`, `A = ${f(A)} ${u.A},  D = ${f(sqrt((4 * A) / PI) / u.dF)} ${u.du}`, '');
      }
    } else {
      Q = A * V;
      st.add('Jet area and discharge', 'A = πD²/4,  Q = A V', `A = π(${f(p.D * u.dF)})²/4 = ${f(A)},  Q = ${f(A)} × ${f(V)}`, `Q = ${f(Q)} ${u.Q}`, '');
    }
    let Vh = V;
    if (p.vert && p.h > 0) {
      Vh = V * V - 2 * u.g * p.h;
      if (Vh <= 0) return fail([`A vertical jet at ${f(V)} ${u.v} rises only ${f((V * V) / (2 * u.g))} ${u.L}; the plate is higher than that.`]);
      Vh = sqrt(Vh);
      st.add('Jet speed at the plate (vertical jet)', 'V_h = √(V² − 2 g h)', `V_h = √(${f(V)}² − 2 × ${f(u.g)} × ${f(p.h)})`, `${f(Vh)} ${u.v}`, 'The jet slows as it rises (Bernoulli along the free jet); the discharge stays the same.');
    }
    const uu = p.motion === 'fixed' ? 0 : p.u, Vr = Vh - uu;
    if (Vr <= 0) return fail(['The plate moves as fast as the jet (or faster): the water cannot reach it.']);
    const mdot = p.motion === 'single' ? rho * A * Vr : rho * Q;
    if (p.motion !== 'fixed') st.add('Relative velocity and mass flow turned', p.motion === 'single' ? 'V_r = V − u,  ṁ = ρ A V_r' : 'V_r = V − u,  ṁ = ρ Q (a series of plates catches the whole jet)', `V_r = ${f(Vh)} − ${f(uu)} = ${f(Vr)} ${u.v}`, `ṁ = ${f(mdot)} ${u.md}`, p.motion === 'single' ? 'A single plate running away from the jet only receives water at the relative speed.' : '');
    else st.add('Mass flow', 'ṁ = ρ Q', `ṁ = ${f(rho)} × ${f(Q)}`, `${f(mdot)} ${u.md}`, '');
    const Fn = mdot * Vr * sn, Fx = Fn * sn, Fy = Fn * Math.cos(th);
    st.add('Force normal to the plate', 'F_n = ṁ V_r sinθ', `F_n = ${f(mdot)} × ${f(Vr)} × sin ${f(p.theta)}°`, `${f(Fn)} ${u.F}`, 'Without friction the plate can only push normal to itself; the water leaves along the plate with its relative speed unchanged.');
    const out = [];
    if (p.solve === 'Q') out.push({ k: 'Discharge Q', v: Q, u: u.Q, hl: true }, { k: 'Jet velocity V', v: V, u: u.v });
    if (p.solve === 'D') out.push({ k: 'Jet diameter D', v: sqrt((4 * A) / PI) / u.dF, u: u.du, hl: true }, { k: 'Jet velocity V', v: V, u: u.v });
    if (abs(p.theta - 90) > 1e-9) {
      st.add('Components (x along the jet)', 'F_x = F_n sinθ,  F_y = F_n cosθ', `F_x = ${f(Fn)} × sin ${f(p.theta)}°,  F_y = ${f(Fn)} × cos ${f(p.theta)}°`, `F_x = ${f(Fx)},  F_y = ${f(Fy)} ${u.F}`, '');
      if (p.motion === 'fixed') {
        const q1 = (Q * (1 + Math.cos(th))) / 2, q2 = (Q * (1 - Math.cos(th))) / 2;
        st.add('How the jet divides', 'Q₁ = Q(1 + cosθ)/2,  Q₂ = Q(1 − cosθ)/2', `Q₁ = ${f(Q)}(1 + cos ${f(p.theta)}°)/2`, `Q₁ = ${f(q1)},  Q₂ = ${f(q2)} ${u.Q}`, 'No momentum change along the plate: Q V cosθ = Q₁V − Q₂V.');
        out.push({ k: 'Flow deflected forward Q₁', v: q1, u: u.Q }, { k: 'Flow deflected back Q₂', v: q2, u: u.Q });
      }
    }
    if (p.solve === 'F') out.push({ k: 'Force on the plate (normal) F_n', v: Fn, u: u.F, hl: true });
    else out.push({ k: 'Force on the plate (normal) F_n', v: Fn, u: u.F });
    if (abs(p.theta - 90) > 1e-9) out.push({ k: 'Component along the jet F_x', v: Fx, u: u.F }, { k: 'Component across the jet F_y', v: Fy, u: u.F });
    out.push({ k: 'Discharge of the jet Q', v: Q, u: u.Q }, { k: 'Mass flow turned ṁ', v: mdot, u: u.md });
    if (p.vert && p.h > 0) {
      out.push({ k: 'Jet speed at the plate', v: Vh, u: u.v });
      out.push({ k: 'Weight the jet can hold W = F_n', v: Fn, u: u.F });
    }
    if (p.motion !== 'fixed') {
      const P = Fx * uu; st.add('Power delivered to the moving plate', 'P = F_x u', `P = ${f(Fx)} × ${f(uu)}`, `${f(pw(u, P))} ${u.Pu}`, '');
      out.push({ k: 'Power to the plate P', v: pw(u, P), u: u.Pu });
      if (p.motion === 'series') { const Pj = 0.5 * rho * Q * V * V; out.push({ k: 'Efficiency P / (½ρQV²)', v: P / Pj, u: '' }); }
    }
    if (p.ar > 1) {
      const pav = Fn / (A * p.ar), ps = 0.5 * rho * Vr * Vr;
      st.add('Average and stagnation pressure on the plate', 'p_avg = F / A_plate,  p_s = ρV²/2', `p_avg = ${f(Fn)} / (${f(p.ar)} × ${f(A)}),  p_s = ½ × ${f(rho)} × ${f(Vr)}²`, `p_avg = ${f(pav / u.pF)},  p_s = ${f(ps / u.pF)} ${u.pu}`, 'For a plate n times the jet area the average pressure is 2/n of the stagnation pressure.');
      out.push({ k: 'Average pressure on the plate', v: pav / u.pF, u: u.pu }, { k: 'Stagnation pressure ρV²/2', v: ps / u.pF, u: u.pu });
    }
    return ok(st, out, warn, { cls: 'ok', text: `F = ${f(Fn)} ${u.F}` }, { kind: 'plate', theta: p.theta, V, Vh, Vr, u: uu, Fn, Fx, Fy, D: sqrt((4 * A) / PI), motion: p.motion, vert: p.vert, h: p.h, Q });
  }

  /* ------------------------------------------------------------------ */
  /* Jet on a curved vane                                                 */
  /* ------------------------------------------------------------------ */
  function vane(p, U, u, st, warn) {
    const rho = p.rho, th = p.theta * DEG, A = (PI * Math.pow(p.D * u.dF, 2)) / 4;
    if (!(rho > 0 && A > 0)) return fail(['Enter the jet size and the fluid density.']);
    let V = p.V;
    const Q = A * V;
    st.add('Jet area and discharge', 'A = πD²/4,  Q = A V', `A = π(${f(p.D * u.dF)})²/4 = ${f(A)},  Q = ${f(A)} × ${f(V)}`, `Q = ${f(Q)} ${u.Q}`, '');
    let Vin = V;
    if (p.vert && p.h > 0) {
      const v2 = V * V - 2 * u.g * p.h;
      if (v2 <= 0) return fail([`A vertical jet at ${f(V)} ${u.v} rises only ${f((V * V) / (2 * u.g))} ${u.L}.`]);
      Vin = sqrt(v2);
      st.add('Jet speed at the vane (vertical jet)', 'V_h = √(V² − 2 g h)', `V_h = √(${f(V)}² − 2 × ${f(u.g)} × ${f(p.h)})`, `${f(Vin)} ${u.v}`, '');
    }
    const uu = p.motion === 'fixed' ? 0 : p.u, Vr1 = Vin - uu;
    if (Vr1 <= 0) return fail(['The vane moves as fast as the jet (or faster): the water cannot catch it.']);
    const mdot = p.motion === 'single' ? rho * A * Vr1 : rho * Q;
    const k = p.kf, Vr2 = k * Vr1;
    st.add('Relative velocities', 'V_r1 = V − u,  V_r2 = k V_r1', `V_r1 = ${f(Vin)} − ${f(uu)} = ${f(Vr1)},  V_r2 = ${f(k)} × ${f(Vr1)}`, `V_r2 = ${f(Vr2)} ${u.v}`, k < 1 ? 'Friction on the vane reduces the relative speed by the factor k.' : 'No friction: the water leaves the vane with the relative speed it arrived with.');
    st.add('Mass flow turned', p.motion === 'single' ? 'ṁ = ρ A V_r1 (a single vane running away from the jet)' : 'ṁ = ρ Q', p.motion === 'single' ? `ṁ = ${f(rho)} × ${f(A)} × ${f(Vr1)}` : `ṁ = ${f(rho)} × ${f(Q)}`, `${f(mdot)} ${u.md}`, '');
    const V2x = uu + Vr2 * Math.cos(th), V2y = Vr2 * Math.sin(th);
    st.add('Absolute exit velocity', 'V₂ = u + V_r2 (cosθ, sinθ)', `V₂x = ${f(uu)} + ${f(Vr2)} cos ${f(p.theta)}°,  V₂y = ${f(Vr2)} sin ${f(p.theta)}°`, `V₂x = ${f(V2x)},  V₂y = ${f(V2y)},  |V₂| = ${f(Math.hypot(V2x, V2y))} ${u.v}`, 'θ is the deflection measured from the incoming jet.');
    const Fx = mdot * (Vr1 - Vr2 * Math.cos(th)), Fy = -mdot * Vr2 * Math.sin(th);
    st.add('Force of the water on the vane (momentum, relative frame)', 'F_x = ṁ (V_r1 − V_r2 cosθ),  F_y = −ṁ V_r2 sinθ', `F_x = ${f(mdot)} (${f(Vr1)} − ${f(Vr2)} cos ${f(p.theta)}°),  F_y = −${f(mdot)} × ${f(Vr2)} sin ${f(p.theta)}°`, `F_x = ${f(Fx)},  F_y = ${f(Fy)} ${u.F}`, 'The vane pushes the water up (positive θ), so the water pushes the vane down.');
    const R = Math.hypot(Fx, Fy), ang = angOf(Fx, Fy);
    st.add('Resultant', 'R = √(F_x² + F_y²)', `R = √(${f(Fx)}² + ${f(Fy)}²)`, `${f(R)} ${u.F} at ${f(ang)}° from the jet direction`, '');
    const out = [{ k: 'Force along the jet F_x', v: Fx, u: u.F, hl: true }, { k: 'Force across the jet F_y', v: Fy, u: u.F, hl: true }, { k: 'Resultant R', v: R, u: u.F }, { k: 'Direction of R (from the jet axis)', v: ang, u: '°' }, { k: 'Mass flow turned ṁ', v: mdot, u: u.md }, { k: 'Absolute exit speed |V₂|', v: Math.hypot(V2x, V2y), u: u.v }, { k: 'Exit direction', v: angOf(V2x, V2y), u: '°' }];
    if (p.vert && p.h > 0) out.push({ k: 'Weight the jet can hold (vertical force)', v: Fx, u: u.F });
    if (p.motion !== 'fixed') {
      const P = Fx * uu; st.add('Power delivered to the vane', 'P = F_x u', `P = ${f(Fx)} × ${f(uu)}`, `${f(P)} ${u.SI ? 'W' : 'ft·lb/s'} = ${f(pw(u, P))} ${u.Pu}`, uu < 0 ? 'The vane moves against the jet: power must be supplied to keep it moving.' : '');
      out.push({ k: 'Power P = F_x u', v: pw(u, P), u: u.Pu });
      if (p.motion === 'series') {
        const Pj = 0.5 * rho * Q * V * V; out.push({ k: 'Efficiency P / (½ρQV²)', v: P / Pj, u: '' });
        st.add('Efficiency of a series of vanes', 'η = P / (½ρQV²);  best at u = V/2', `η = ${f(P)} / (½ × ${f(rho)} × ${f(Q)} × ${f(V)}²)`, `${f(P / Pj)}`, `u = V/2 = ${f(V / 2)} ${u.v} gives the most power.`);
      }
    }
    return ok(st, out, warn, { cls: 'ok', text: `R = ${f(R)} ${u.F}` }, { kind: 'vane', theta: p.theta, V, Vin, u: uu, Vr1, Vr2, Fx, Fy, V2x, V2y, D: p.D * u.dF, motion: p.motion, vert: p.vert, h: p.h });
  }

  /* ------------------------------------------------------------------ */
  /* Jet split by a wedge / divider                                      */
  /* ------------------------------------------------------------------ */
  function split(p, U, u, st, warn) {
    const rho = p.rho, A = (PI * Math.pow(p.D * u.dF, 2)) / 4, V = p.V, Q = A * V, f1 = p.f1, f2 = 1 - f1;
    const t1 = p.t1 * DEG, t2 = p.t2 * DEG;
    if (!(f1 >= 0 && f1 <= 1)) return fail(['The share of stream 1 must be between 0 and 1.']);
    st.add('Jet discharge', 'Q = A V', `Q = ${f(A)} × ${f(V)}`, `${f(Q)} ${u.Q}  (Q₁ = ${f(f1 * Q)}, Q₂ = ${f(f2 * Q)})`, 'Without friction each stream leaves at the jet speed V.');
    const md = rho * Q;
    const Fx = md * V - rho * f1 * Q * V * Math.cos(t1) - rho * f2 * Q * V * Math.cos(t2);
    const Fy = -(rho * f1 * Q * V * Math.sin(t1) + rho * f2 * Q * V * Math.sin(t2));
    st.add('Force of the water on the divider', 'F_x = ρQV − ρQ₁V cosθ₁ − ρQ₂V cosθ₂,  F_y = −(ρQ₁V sinθ₁ + ρQ₂V sinθ₂)', `ρQV = ${f(md * V)}`, `F_x = ${f(Fx)},  F_y = ${f(Fy)} ${u.F}`, 'Angles are measured counterclockwise from the incoming jet.');
    const R = Math.hypot(Fx, Fy);
    return ok(st, [{ k: 'Force along the jet F_x', v: Fx, u: u.F, hl: true }, { k: 'Force across the jet F_y', v: Fy, u: u.F, hl: true }, { k: 'Resultant R', v: R, u: u.F }, { k: 'Direction of R', v: angOf(Fx, Fy), u: '°' }, { k: 'Stream 1 Q₁', v: f1 * Q, u: u.Q }, { k: 'Stream 2 Q₂', v: f2 * Q, u: u.Q }], warn, { cls: 'ok', text: `R = ${f(R)} ${u.F}` }, { kind: 'split', V, t1: p.t1, t2: p.t2, f1, Fx, Fy, D: p.D * u.dF });
  }

  /* ------------------------------------------------------------------ */
  /* Pipe bend, reducer or nozzle                                         */
  /* ------------------------------------------------------------------ */
  function bend(p, U, u, st, warn) {
    const rho = p.rho, g = u.g, gam = rho * g, D1 = p.D1 * u.dF, D2 = p.D2 * u.dF, A1 = (PI * D1 * D1) / 4, A2 = (PI * D2 * D2) / 4, th = p.theta * DEG;
    if (!(rho > 0 && A1 > 0 && A2 > 0)) return fail(['Enter both diameters and the density.']);
    const Q = p.qBy === 'V' ? p.V1 * A1 : p.Q, V1 = Q / A1, V2 = Q / A2, md = rho * Q;
    st.add('Velocities', 'V = Q / A', `V₁ = ${f(Q)} / ${f(A1)},  V₂ = ${f(Q)} / ${f(A2)}`, `V₁ = ${f(V1)},  V₂ = ${f(V2)} ${u.v};  ṁ = ρQ = ${f(md)} ${u.md}`, '');
    const dz = p.plane === 'v' ? p.dz : 0;
    let p1, p2;
    const hv = (v) => (v * v) / (2 * g);
    if (p.pAt === 'p1') {
      p1 = p.pg * u.pF;
      p2 = p1 + gam * (hv(V1) - hv(V2) - p.hL - dz);
      st.add('Pressure at the outlet (energy equation)', 'p₂ = p₁ + γ(V₁²/2g − V₂²/2g − h_L − (z₂ − z₁))', `p₂ = ${f(p1 / u.pF)} + ${f(gam / u.pF)}(${f(hv(V1))} − ${f(hv(V2))} − ${f(p.hL)} − ${f(dz)})`, `p₂ = ${f(p2 / u.pF)} ${u.pu}`, '');
    } else {
      p2 = p.pg * u.pF;
      p1 = p2 - gam * (hv(V1) - hv(V2) - p.hL - dz);
      st.add('Pressure at the inlet (energy equation)', 'p₁ = p₂ − γ(V₁²/2g − V₂²/2g − h_L − (z₂ − z₁))', `p₁ = ${f(p2 / u.pF)} − ${f(gam / u.pF)}(${f(hv(V1))} − ${f(hv(V2))} − ${f(p.hL)} − ${f(dz)})`, `p₁ = ${f(p1 / u.pF)} ${u.pu}`, p.pg === 0 ? 'p₂ = 0: the fitting discharges a free jet into the atmosphere.' : '');
    }
    const P1 = p1 * A1, P2 = p2 * A2;
    st.add('Pressure forces', 'P = p A (gauge)', `P₁ = ${f(p1 / u.pF)} × ${f(A1)} ${u.SI ? '× 1000' : '× 144'},  P₂ = ${f(p2 / u.pF)} × ${f(A2)} ${u.SI ? '× 1000' : '× 144'}`, `P₁ = ${f(P1)},  P₂ = ${f(P2)} ${u.F}`, 'Gauge pressures: the atmosphere acts all round the outside of the fitting.');
    const W = p.plane === 'v' ? gam * p.vol + p.Wb : 0;
    if (p.plane === 'v') st.add('Weight of the fluid (and fitting)', 'W = γ V_f + W_b', `W = ${f(gam)} × ${f(p.vol)} + ${f(p.Wb)}`, `${f(W)} ${u.F}`, 'Vertical bend: the weight acts in −y.');
    // momentum on the fluid: P1 x̂ − P2 ê₂ + R_b − W ŷ = ṁ (V₂ ê₂ − V₁ x̂)
    const c = Math.cos(th), s = Math.sin(th);
    const Rx = md * (V2 * c - V1) - P1 + P2 * c, Ry = md * V2 * s + P2 * s + W;
    st.add('Momentum equation on the fluid in the fitting', 'ΣF = ṁ(V₂ − V₁):  P₁ − P₂cosθ + R_x = ṁ(V₂cosθ − V₁),  −P₂sinθ + R_y − W = ṁV₂sinθ', `R_x = ${f(md)}(${f(V2)}cos ${f(p.theta)}° − ${f(V1)}) − ${f(P1)} + ${f(P2)}cos ${f(p.theta)}°,  R_y = ${f(md)} × ${f(V2)} sin ${f(p.theta)}° + ${f(P2)} sin ${f(p.theta)}° + ${f(W)}`, `R_x = ${f(Rx)},  R_y = ${f(Ry)} ${u.F} (fitting on the fluid)`, 'x along the inlet pipe; the outlet leaves at θ counterclockwise.');
    const Fx = -Rx, Fy = -Ry, F = Math.hypot(Fx, Fy), ang = angOf(Fx, Fy);
    st.add('Force of the fluid on the fitting', 'F = −R', '', `F_x = ${f(Fx)},  F_y = ${f(Fy)},  F = ${f(F)} ${u.F} at ${f(ang)}°`, 'The anchor or the flange bolts must supply R.');
    const out = [{ k: 'Force on the fitting F_x', v: Fx, u: u.F, hl: true }, { k: 'Force on the fitting F_y', v: Fy, u: u.F, hl: true }, { k: 'Resultant F', v: F, u: u.F, hl: true }, { k: 'Direction (from +x)', v: ang, u: '°' }, { k: 'Inlet pressure p₁', v: p1 / u.pF, u: u.pu }, { k: 'Outlet pressure p₂', v: p2 / u.pF, u: u.pu }, { k: 'V₁', v: V1, u: u.v }, { k: 'V₂', v: V2, u: u.v }, { k: 'Discharge Q', v: Q, u: u.Q }];
    if (p2 < -0.9 * (u.SI ? 101325 : 2116)) warn.push('The outlet pressure is close to a full vacuum: the flow cannot be this large.');
    return ok(st, out, warn, { cls: 'ok', text: `F = ${f(F)} ${u.F}` }, { kind: 'bend', theta: p.theta, D1, D2, V1, V2, Fx, Fy, P1, P2, W, plane: p.plane, p1, p2 });
  }

  /* ------------------------------------------------------------------ */
  /* Jet reaction on a tank / nozzle                                      */
  /* ------------------------------------------------------------------ */
  function reaction(p, U, u, st, warn) {
    const rho = p.rho, g = u.g, A0 = (PI * Math.pow(p.D * u.dF, 2)) / 4, Aj = p.Cc * A0;
    const H = p.hBy === 'p' ? (p.pg * u.pF) / (rho * g) + p.h : p.h;
    if (!(H > 0)) return fail(['The head on the opening must be positive.']);
    st.add('Head on the opening', p.hBy === 'p' ? 'H = p/γ + h' : 'H = h', p.hBy === 'p' ? `H = ${f(p.pg)} ${u.pu} / ${f(rho * g)} + ${f(p.h)}` : '', `H = ${f(H)} ${u.L}`, '');
    const Vj = p.Cv * sqrt(2 * g * H), Q = Aj * Vj, F = rho * Q * Vj;
    st.add('Jet velocity and discharge', 'V_j = C_v √(2gH),  Q = C_c A₀ V_j', `V_j = ${f(p.Cv)} √(2 × ${f(g)} × ${f(H)}),  Q = ${f(p.Cc)} × ${f(A0)} × V_j`, `V_j = ${f(Vj)} ${u.v},  Q = ${f(Q)} ${u.Q}`, '');
    st.add('Reaction of the jet on the tank', 'F = ρ Q V_j = 2 C_c C_v² γ H A₀', `F = ${f(rho)} × ${f(Q)} × ${f(Vj)}`, `${f(F)} ${u.F}`, 'The jet pushes the tank the opposite way (Schaum 13.16).');
    const plug = rho * g * H * A0;
    st.add('Compare: static force on a plug in the opening', 'F_plug = γ H A₀', `= ${f(rho * g)} × ${f(H)} × ${f(A0)}`, `${f(plug)} ${u.F};  F / F_plug = ${f(F / plug)}`, 'Ideal flow (C_v = C_c = 1) gives exactly twice the plug force.');
    const a = p.alpha * DEG;
    return ok(st, [{ k: 'Jet reaction F', v: F, u: u.F, hl: true }, { k: 'Horizontal part F cosα', v: F * Math.cos(a), u: u.F }, { k: 'Vertical part F sinα', v: F * Math.sin(a), u: u.F }, { k: 'Jet velocity V_j', v: Vj, u: u.v }, { k: 'Discharge Q', v: Q, u: u.Q }, { k: 'Ratio to the plug force', v: F / plug, u: '' }], warn, { cls: 'ok', text: `F = ${f(F)} ${u.F}` }, { kind: 'reaction', H, F, Vj, D: p.D * u.dF, alpha: p.alpha });
  }

  /* ------------------------------------------------------------------ */
  /* Jet propulsion: air-breathing engine, rocket, jet boat              */
  /* ------------------------------------------------------------------ */
  function thrust(p, U, u, st, warn) {
    const g = u.g, out = [];
    const m = (x) => (p.flowBy === 'W' ? x / g : x);
    if (p.kind === 'water') {
      const rho = p.rho, Q = p.Q, Vj = p.Vj, Vb = p.Vb, Vin = p.intake === 'side' ? 0 : Vb;
      const F = rho * Q * (Vj - Vin);
      st.add('Thrust of the water jet', 'F = ρQ (V_j − V_in)', `F = ${f(rho)} × ${f(Q)} × (${f(Vj)} − ${f(Vin)})`, `${f(F)} ${u.F}`, p.intake === 'side' ? 'Water taken in at the sides arrives with no forward momentum relative to the craft.' : 'Water enters the bow at the craft speed relative to the craft and leaves at V_j.');
      const Pu = F * Vb, Pj = 0.5 * rho * Q * (Vj * Vj - Vin * Vin), eta = Pu / Pj;
      st.add('Useful power and efficiency', 'P = F V_b,  η = P / (½ρQ(V_j² − V_in²))', `P = ${f(F)} × ${f(Vb)}`, `P = ${f(pw(u, Pu))} ${u.Pu},  η = ${f(eta)}`, '');
      out.push({ k: 'Thrust F', v: F, u: u.F, hl: true }, { k: 'Useful power F V_b', v: pw(u, Pu), u: u.Pu }, { k: 'Efficiency', v: eta, u: '' });
      return ok(st, out, warn, { cls: 'ok', text: `F = ${f(F)} ${u.F}` }, { kind: 'thrust', sub: 'water', F, Vj, Vb });
    }
    const mf = m(p.mf), ma = p.kind === 'rocket' ? 0 : m(p.ma), me = ma + mf, V1 = p.kind === 'rocket' ? 0 : p.V1, dpA = p.pe * u.pF * p.Ae;
    if (p.flowBy === 'W') st.add('Mass flows from the weight flows', 'ṁ = Ẇ / g', `ṁ_air = ${f(p.ma)} / ${f(g)},  ṁ_fuel = ${f(p.mf)} / ${f(g)}`, `ṁ_air = ${f(ma)},  ṁ_fuel = ${f(mf)} ${u.md}`, '');
    let F, Ve;
    if (p.solve === 'Ve') {
      F = p.F; Ve = (F + ma * V1 - dpA) / me;
      st.add('Exit velocity for the required thrust', 'F = ṁ_e V_e − ṁ_a V₁ + (p_e − p_a)A_e  ⇒  V_e = (F + ṁ_a V₁ − (p_e − p_a)A_e)/ṁ_e', `V_e = (${f(F)} + ${f(ma)} × ${f(V1)} − ${f(dpA)}) / ${f(me)}`, `${f(Ve)} ${u.v}`, '');
    } else {
      Ve = p.Ve; F = me * Ve - ma * V1 + dpA;
      st.add('Thrust (momentum through the engine)', 'F = ṁ_e V_e − ṁ_a V₁ + (p_e − p_a) A_e', `F = ${f(me)} × ${f(Ve)} − ${f(ma)} × ${f(V1)} + ${f(dpA)}`, `${f(F)} ${u.F}`, p.kind === 'rocket' ? 'A rocket carries its own oxidiser: no air enters, so there is no ram drag.' : 'ṁ_a V₁ is the ram drag of the air taken in at flight speed; V_e is relative to the engine.');
    }
    out.push({ k: 'Thrust F', v: F, u: u.F, hl: p.solve !== 'Ve' }, { k: 'Exit velocity V_e (relative)', v: Ve, u: u.v, hl: p.solve === 'Ve' });
    if (p.kind === 'engine') {
      const Pu = F * V1, eta = V1 > 0 ? (2 * V1) / (V1 + Ve) : 0;
      st.add('Propulsive power and ideal efficiency', 'P = F V₁,  η ≈ 2V₁/(V₁ + V_e)', `P = ${f(F)} × ${f(V1)}`, `P = ${f(pw(u, Pu))} ${u.Pu},  η = ${f(eta)}`, '');
      out.push({ k: 'Propulsive power F V₁', v: pw(u, Pu), u: u.Pu }, { k: 'Ideal propulsive efficiency', v: eta, u: '' });
    } else {
      const M = p.Mby === 'W' ? p.Mr / g : p.Mr, W = M * g;
      if (M > 0) {
        const a = (F - W - p.Dr) / M;
        st.add('Acceleration (vertical flight)', 'a = (F − W − D)/M', `a = (${f(F)} − ${f(W)} − ${f(p.Dr)}) / ${f(M)}`, `${f(a)} ${u.SI ? 'm/s²' : 'ft/s²'}`, 'Instantaneous value: the mass falls as propellant burns.');
        out.push({ k: 'Acceleration (vertical)', v: a, u: u.SI ? 'm/s²' : 'ft/s²' }, { k: 'Weight W', v: W, u: u.F });
      }
      if (p.Pr > 0) { const v = (p.Pr * u.PF) / F; st.add('Speed from the power developed', 'P = F V  ⇒  V = P / F', `V = ${f(p.Pr * u.PF)} / ${f(F)}`, `${f(v)} ${u.v}`, ''); out.push({ k: 'Rocket speed V = P / F', v, u: u.v }); }
    }
    return ok(st, out, warn, { cls: 'ok', text: `F = ${f(F)} ${u.F}` }, { kind: 'thrust', sub: p.kind, F, Ve, V1 });
  }

  /* ------------------------------------------------------------------ */
  /* Rotating sprinkler (angular momentum)                                */
  /* ------------------------------------------------------------------ */
  function sprinkler(p, U, u, st, warn) {
    const rho = p.rho, n = +p.n, r = p.r, An = (PI * Math.pow(p.d * u.dF, 2)) / 4, al = p.alpha * DEG;
    let q, Vr;
    if (p.qBy === 'p') { Vr = p.Cv * sqrt((2 * p.pg * u.pF) / rho); q = An * Vr; st.add('Jet speed from the supply pressure', 'V_r = C_v √(2p/ρ)', `V_r = ${f(p.Cv)} √(2 × ${f(p.pg * u.pF)} / ${f(rho)})`, `${f(Vr)} ${u.v};  q = A V_r = ${f(q)} ${u.Q} per nozzle`, 'Rotation of the arm is ignored in the supply energy.'); }
    else { q = p.Q / n; Vr = q / An; st.add('Flow and jet speed in each nozzle', 'q = Q/n,  V_r = q / A', `q = ${f(p.Q)} / ${n},  V_r = ${f(q)} / ${f(An)}`, `q = ${f(q)} ${u.Q},  V_r = ${f(Vr)} ${u.v}`, 'V_r is relative to the rotating arm.'); }
    const Vt = Vr * Math.cos(al), w0 = Vt / r;
    const out = [];
    let w;
    if (p.solve === 'w') {
      const Tf = p.Tf; w = (Vt - Tf / (n * rho * q * r)) / r;
      st.add('Steady speed against the friction torque', 'T_f = n ρ q r (V_r cosα − ω r)  ⇒  ω = (V_r cosα − T_f/(nρqr))/r', `ω = (${f(Vt)} − ${f(Tf)}/(${n} × ${f(rho)} × ${f(q)} × ${f(r)}))/${f(r)}`, `${f(w)} rad/s = ${f((w * 60) / (2 * PI))} rpm`, '');
      if (w < 0) warn.push('The friction torque is larger than the holding torque: the arms will not turn.');
      out.push({ k: 'Speed ω', v: (w * 60) / (2 * PI), u: 'rpm', hl: true }, { k: 'Speed ω', v: w, u: 'rad/s' });
    } else w = (p.rpm * 2 * PI) / 60;
    const T = n * rho * q * r * (Vt - w * r);
    st.add('Torque from the angular momentum of the jets', 'T = n ρ q r (V_r cosα − ω r)', `T = ${n} × ${f(rho)} × ${f(q)} × ${f(r)} × (${f(Vt)} − ${f(w)} × ${f(r)})`, `${f(T)} ${u.M}`, 'Absolute tangential velocity of each jet = V_r cosα − ωr.');
    if (p.solve !== 'w') out.push({ k: w === 0 ? 'Torque to hold the arms T' : 'Torque developed T', v: T, u: u.M, hl: true });
    if (p.rF > 0) { st.add('Force to hold each arm at r_F', 'F = T / (n r_F)', `F = ${f(T)} / (${n} × ${f(p.rF)})`, `${f(T / (n * p.rF))} ${u.F}`, ''); out.push({ k: 'Holding force on each arm at r_F', v: T / (n * p.rF), u: u.F, hl: true }); }
    out.push({ k: 'Free-running speed (no friction)', v: (w0 * 60) / (2 * PI), u: 'rpm' }, { k: 'Power T ω', v: pw(u, T * w), u: u.Pu }, { k: 'Jet speed relative to the arm', v: Vr, u: u.v }, { k: 'Flow per nozzle q', v: q, u: u.Q });
    st.add('Free-running speed', 'T = 0  ⇒  ω₀ = V_r cosα / r', `ω₀ = ${f(Vt)} / ${f(r)}`, `${f(w0)} rad/s = ${f((w0 * 60) / (2 * PI))} rpm`, '');
    return ok(st, out, warn, { cls: 'ok', text: `T = ${f(T)} ${u.M}` }, { kind: 'sprinkler', n, r, alpha: p.alpha, w, T });
  }

  /* ------------------------------------------------------------------ */
  /* Propeller, fan, helicopter rotor, wind turbine (actuator disk)       */
  /* ------------------------------------------------------------------ */
  function prop(p, U, u, st, warn) {
    const rho = p.rho, A = (PI * p.Dp * p.Dp) / 4, out = [];
    let V1 = p.V1, V4;
    const wind = p.kind === 'wind';
    if (wind) {
      if (p.giv === 'eta') {
        const e = p.eta; if (!(e > 0 && e <= 16 / 27)) return fail([`An ideal wind turbine cannot exceed the Betz limit 16/27 = 0.593.`]);
        const E = (r) => 0.5 * (1 - r * r) * (1 + r); let lo = 1 / 3, hi = 1; for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (E(m) > e) lo = m; else hi = m; }
        V4 = V1 * (lo + hi) / 2;
        st.add('Wake velocity from the efficiency', 'η = ½(1 − r²)(1 + r),  r = V₄/V₁', `${f(e)} = ½(1 − r²)(1 + r)`, `r = ${f(V4 / V1)},  V₄ = ${f(V4)} ${u.v}`, 'The root with r ≥ 1/3 (the usual operating branch).');
      } else V4 = p.V4;
      if (!(V4 < V1)) return fail(['A wind turbine slows the wind: the wake speed must be below the wind speed.']);
    } else {
      if (p.giv === 'V4') V4 = p.V4;
      else if (p.giv === 'Q') { const Vd = p.Q / A; V4 = 2 * Vd - V1; st.add('Slipstream from the flow through the disk', 'V = Q/A = (V₁ + V₄)/2', `V = ${f(p.Q)} / ${f(A)} = ${f(Vd)}`, `V₄ = 2V − V₁ = ${f(V4)} ${u.v}`, ''); }
      else if (p.giv === 'F') { V4 = sqrt(V1 * V1 + (2 * p.F) / (rho * A)); st.add('Slipstream from the thrust', 'F = ρA(V₄² − V₁²)/2', `V₄ = √(${f(V1)}² + 2 × ${f(p.F)} / (${f(rho)} × ${f(A)}))`, `${f(V4)} ${u.v}`, V1 === 0 ? 'Hovering or a static test: the air approaches from rest.' : ''); }
      else { // ideal efficiency and thrust → flight speed
        const e = p.eta; if (!(e > 0 && e < 1)) return fail(['The ideal efficiency must be between 0 and 1.']);
        const k = 2 / e - 1; V1 = sqrt((2 * p.F) / (rho * A * (k * k - 1))); V4 = k * V1;
        st.add('Speed from the ideal efficiency and thrust', 'η = 2V₁/(V₁ + V₄)  ⇒  V₄ = (2/η − 1)V₁;  F = ρA(V₄² − V₁²)/2', `V₁ = √(2 × ${f(p.F)} / (${f(rho)} × ${f(A)} × (${f(k)}² − 1)))`, `V₁ = ${f(V1)},  V₄ = ${f(V4)} ${u.v}`, '');
      }
      if (!(V4 > V1)) return fail(['A propeller speeds the air up: the slipstream must be faster than the approach.']);
    }
    const Vd = (V1 + V4) / 2, Q = A * Vd, md = rho * Q, F = md * (V4 - V1), dp = F / A;
    st.add('Velocity through the disk', 'V = (V₁ + V₄)/2', `V = (${f(V1)} + ${f(V4)})/2`, `${f(Vd)} ${u.v};  Q = A V = ${f(Q)} ${u.Q}`, 'Froude: half the change in speed happens ahead of the disk.');
    st.add(wind ? 'Thrust on the rotor' : 'Thrust', 'F = ρQ(V₄ − V₁) = ρA(V₄² − V₁²)/2', `F = ${f(rho)} × ${f(Q)} × (${f(V4)} − ${f(V1)})`, `${f(abs(F))} ${u.F};  Δp across the disk = F/A = ${f(abs(dp))} ${u.SI ? 'Pa' : 'psf'}`, '');
    out.push({ k: wind ? 'Thrust on the rotor' : 'Thrust F', v: abs(F), u: u.F, hl: true });
    if (wind) {
      const P = abs(F) * Vd, Pw = 0.5 * rho * A * V1 * V1 * V1, e = P / Pw;
      st.add('Power taken from the wind', 'P = F V = ½ρQ(V₁² − V₄²),  η = P / (½ρAV₁³)', `P = ${f(abs(F))} × ${f(Vd)}`, `P = ${f(pw(u, P))} ${u.Pu},  η = ${f(e)} (Betz limit 0.593)`, '');
      out.push({ k: 'Power extracted', v: pw(u, P), u: u.Pu, hl: true }, { k: 'Efficiency', v: e, u: '' });
    } else {
      const Pin = F * Vd, Pout = F * V1, e = V1 > 0 ? (2 * V1) / (V1 + V4) : 0;
      st.add('Power and ideal efficiency', 'P_in = F V,  P_out = F V₁,  η = 2V₁/(V₁ + V₄)', `P_in = ${f(F)} × ${f(Vd)}`, `P_in = ${f(pw(u, Pin))} ${u.Pu},  η = ${f(e)}`, V1 === 0 ? 'Hovering: all the power goes into the slipstream.' : '');
      out.push({ k: 'Power supplied P_in = F V', v: pw(u, Pin), u: u.Pu, hl: true }, { k: 'Useful power F V₁', v: pw(u, Pout), u: u.Pu }, { k: 'Ideal efficiency', v: e, u: '' });
    }
    out.push({ k: 'Approach velocity V₁', v: V1, u: u.v, hl: p.giv === 'etaF' }, { k: 'Slipstream (wake) velocity V₄', v: V4, u: u.v }, { k: 'Velocity through the disk', v: Vd, u: u.v }, { k: 'Flow through the disk Q', v: Q, u: u.Q }, { k: 'Pressure jump across the disk', v: abs(dp), u: u.SI ? 'Pa' : 'psf' });
    return ok(st, out, warn, { cls: 'ok', text: `F = ${f(abs(F))} ${u.F}` }, { kind: 'prop', wind, V1, V4, Vd, F, Dp: p.Dp });
  }

  function momentum(p, U) {
    const u = units(U), st = Steps(), warn = [];
    const fn = { plate, vane, split, bend, reaction, thrust, sprinkler, prop }[p.topic];
    if (!fn) return fail(['Unknown topic.']);
    return fn(p, U, u, st, warn);
  }
  P0.momentum = momentum;
  P0.momUnits = units;
})(window);
