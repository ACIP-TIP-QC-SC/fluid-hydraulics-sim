/* =====================================================================
 * MODULE — Momentum & Jet Forces (2026-11-25 book-coverage upgrade)
 * jets on plates and vanes, jet dividers, pipe bends / reducers / nozzles,
 * jet reaction, jet engines / rockets / jet boats, sprinklers,
 * propellers / fans / wind turbines.  Formulas: physMom.js
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Physics, Scene } = root;
  const f = Physics.fmt;
  const PI = Math.PI, DEG = PI / 180;
  const WATER = '#4aa3df', WATERD = '#1f6fa8', STEEL = '#9aa3ad', AIR = '#d6eaf8', RED = '#c0392b', GREEN = '#16a085', INK = '#2c3e50';

  const DEF = {
    topic: 'vane', fluid: 'water', rho: 1000, rhoEN: 1.94,
    // jets
    D: 50, V: 30, u: 0, motion: 'fixed', theta: 90, kf: 1, vert: false, h: 2, solve: 'F', Fg: 500, Q: 0.05, ar: 0,
    f1: 0.5, t1: 60, t2: -60,
    // bends
    D1: 300, D2: 200, qBy: 'Q', V1: 3, pAt: 'p1', pg: 200, hL: 0, plane: 'h', dz: 0, vol: 0, Wb: 0,
    // reaction
    hBy: 'h', Cv: 0.98, Cc: 1, alpha: 0,
    // thrust
    kind: 'engine', flowBy: 'm', ma: 50, mf: 1, Ve: 600, pe: 0, Ae: 0.5, F: 20000, Mby: 'm', Mr: 0, Dr: 0, Pr: 0, Vj: 20, Vb: 8, intake: 'bow',
    // sprinkler
    n: '2', r: 0.3, d: 10, rpm: 0, Tf: 0, rF: 0,
    // propeller
    pkind: 'prop', Dp: 2, giv: 'eta', V4: 40, eta: 0.5,
  };
  const pr = (name, units, x) => ({ name, units, apply: (s) => Object.assign(s, JSON.parse(JSON.stringify(DEF)), x) });
  const W_EN = { rhoEN: 1.94 }, OIL85 = { fluid: 'given', rho: 850 };

  const MJ = {
    id: 'mj', title: 'Momentum & Jet Forces',
    state: JSON.parse(JSON.stringify(DEF)),
    presets: [
      pr('Schaum 13.3 (a) — 3 in jet at 80 ft/s on a fixed plate (609 lb)', 'EN', { topic: 'plate', D: 3, V: 80, theta: 90 }),
      pr('Schaum 13.3 (b) — plate 20 × the jet area: average vs stagnation pressure', 'EN', { topic: 'plate', D: 3, V: 80, theta: 90, ar: 20 }),
      pr('Schaum 13.6 — the same plate moving away at 30 ft/s (238 lb)', 'EN', { topic: 'plate', D: 3, V: 80, theta: 90, motion: 'single', u: 30 }),
      pr('Schaum 13.65 — oil (S 0.85) 2 in jet, plate moving toward it at 30 ft/s (434 lb)', 'EN', { topic: 'plate', fluid: 'given', rhoEN: 1.649, D: 2, V: 80, theta: 90, motion: 'single', u: -30 }),
      pr('Schaum 13.67 — 0.034 m³/s pushes 721 N on a plate: jet diameter (45.2 mm)', 'SI', { topic: 'plate', solve: 'D', Q: 0.034, Fg: 721, theta: 90 }),
      pr('Schaum 13.15 — 2 in jet at 60 ft/s on a door at 30° (F_x 38.0, F_y 65.9 lb)', 'EN', { topic: 'plate', D: 2, V: 60, theta: 30 }),
      pr('Vertical jet holding a plate 1.5 m above the nozzle', 'SI', { topic: 'plate', D: 25, V: 10, theta: 90, vert: true, h: 1.5 }),
      pr('Schaum 13.4 — 76 mm jet at 40 m/s turned 45° by a fixed vane (2.12, 5.13 kN)', 'SI', { topic: 'vane', D: 76, V: 40, theta: 45 }),
      pr('Schaum 13.8 — vane moving at 21.3 m/s, 150° (1.23 kN, 0.328 kN)', 'SI', { topic: 'vane', D: 75, V: 33.5, theta: 150, motion: 'single', u: 21.3 }),
      pr('Schaum 13.9 — same vane, friction cuts the relative speed 12.2 → 10.7 m/s', 'SI', { topic: 'vane', D: 75, V: 33.5, theta: 150, motion: 'single', u: 21.3, kf: 0.87705 }),
      pr('Schaum 13.68 — 2 in jet at 90 ft/s turned 135° (630 lb)', 'EN', { topic: 'vane', D: 2, V: 90, theta: 135 }),
      pr('Schaum 13.69 — blade moving into the jet at 20 ft/s (943 lb, 31.7 hp)', 'EN', { topic: 'vane', D: 2, V: 90, theta: 135, motion: 'single', u: -20 }),
      pr('Hibbeler 6-56 — 25 mm jet at 10 m/s, 180° vane moving away at 2 m/s (62.8 N)', 'SI', { topic: 'vane', D: 25, V: 10, theta: 180, motion: 'single', u: 2 }),
      pr('Pelton-type series of buckets: 165°, u = V/2', 'SI', { topic: 'vane', D: 100, V: 60, theta: 165, motion: 'series', u: 30, kf: 0.95 }),
      pr('Jet split by a wedge: half up at 60°, half down at 60°', 'SI', { topic: 'split', D: 50, V: 20, f1: 0.5, t1: 60, t2: -60 }),
      pr('Schaum 13.12 — 600 mm 90° bend, oil S 0.85, 0.889 m³/s, 293 kPa, loss 1.07 m (118.7 kN)', 'SI', Object.assign({ topic: 'bend', D1: 600, D2: 600, theta: 90, Q: 0.889, pAt: 'p1', pg: 293, hL: 1.07 }, OIL85)),
      pr('Schaum 13.13 — 24 in × 12 in reducer, 31.4 cfs of oil, 40 psi (13 000 lb)', 'EN', { topic: 'bend', fluid: 'given', rhoEN: 1.649, D1: 24, D2: 12, theta: 0, Q: 31.4, pAt: 'p1', pg: 40 }),
      pr('Schaum 13.14 — 45° reducing bend 600 → 300 mm, 0.444 m³/s, 145 kPa (34.4 kN)', 'SI', { topic: 'bend', D1: 600, D2: 300, theta: 45, Q: 0.444, pAt: 'p1', pg: 145 }),
      pr('Nozzle 200 → 75 mm discharging to air, pipe velocity 4 m/s: force on the nozzle', 'SI', { topic: 'bend', D1: 200, D2: 75, theta: 0, qBy: 'V', V1: 4, pAt: 'p2', pg: 0 }),
      pr('Vertical 90° bend turning up, with fluid weight (0.1 m³ inside)', 'SI', { topic: 'bend', D1: 300, D2: 300, theta: 90, Q: 0.2, pAt: 'p1', pg: 150, plane: 'v', dz: 1, vol: 0.1 }),
      pr('Schaum 13.16 — jet reaction on a tank, sharp orifice C_c 0.60, C_v 0.98', 'SI', { topic: 'reaction', D: 50, Cv: 0.98, Cc: 0.6, h: 3 }),
      pr('Schaum 13.19 (English) — jet engine on a test stand, 50 lb/s air + 0.5 lb/s fuel, 1500 ft/s (2350 lb)', 'EN', { topic: 'thrust', kind: 'engine', flowBy: 'W', ma: 50, mf: 0.5, V1: 0, Ve: 1500, Ae: 0, pe: 0 }),
      pr('Schaum 13.20 — 0.25 kN/s of air at 180 m/s, thrust 6.7 kN: exit velocity (443 m/s)', 'SI', { topic: 'thrust', kind: 'engine', flowBy: 'W', ma: 250, mf: 0, V1: 180, solve: 'Ve', F: 6700, Ae: 0, pe: 0 }),
      pr('Schaum 13.23 — rocket, 0.0676 kN/s at 980 m/s, 2000 kW: speed (296 m/s)', 'SI', { topic: 'thrust', kind: 'rocket', flowBy: 'W', mf: 67.6, Ve: 980, Ae: 0, pe: 0, Mby: 'W', Mr: 2200, Pr: 2000 }),
      pr('Schaum 13.76 — jet device moving upstream, 1.416 m³/s, jet 18.29 m/s (10.4 kN)', 'SI', { topic: 'thrust', kind: 'water', Q: 1.416, Vj: 18.29, Vb: 10.98, intake: 'bow' }),
      pr('Hibbeler 6-101 — jet boat, 0.03 m³/s, 30 m/s jet at 10 m/s (600 N; 900 N from the sides)', 'SI', { topic: 'thrust', kind: 'water', Q: 0.03, Vj: 30, Vb: 10, intake: 'bow' }),
      pr('Schaum 13.17 — sprinkler, 25 mm jets at 0.6 m, 350 kPa, C_v 0.80: force at 0.3 m (0.44 kN)', 'SI', { topic: 'sprinkler', n: '2', r: 0.6, d: 25, qBy: 'p', pg: 350, Cv: 0.8, rF: 0.3 }),
      pr('Hibbeler 6-78 — four-arm sprinkler, 10 mm nozzles, 0.008 m³/s, r = 0.35 m (71.3 N·m)', 'SI', { topic: 'sprinkler', n: '4', r: 0.35, d: 10, qBy: 'Q', Q: 0.008 }),
      pr('Hibbeler 6-81 — plane at 250 km/h, 350 m³/s through a 1.5 m propeller (90.7 kN, 0.351)', 'SI', { topic: 'prop', pkind: 'prop', fluid: 'given', rho: 1.007, Dp: 1.5, V1: 69.444, giv: 'Q', Q: 350 }),
      pr('Hibbeler 6-84 — ship propeller 2.5 m, η = 40 %, thrust 1.5 MN: speed and power (6.38 m/s, 23.9 MW)', 'SI', { topic: 'prop', pkind: 'prop', Dp: 2.5, giv: 'etaF', eta: 0.4, F: 1.5e6 }),
      pr('Hibbeler 6-86 — helicopter hovering, 14 m rotor, 166.8 kN: power (3.50 MW)', 'SI', { topic: 'prop', pkind: 'prop', fluid: 'given', rho: 1.23, Dp: 14, V1: 0, giv: 'F', F: 166770 }),
      pr('Hibbeler 6-92 — wind turbine 40 m, η = 50 % in a 12 m/s wind (68.2 kN, 662 kW)', 'SI', { topic: 'prop', pkind: 'wind', fluid: 'given', rho: 1.22, Dp: 40, V1: 12, giv: 'eta', eta: 0.5 }),
    ],

    rhoOf(U) { const s = this.state; return U.id === 'SI' ? (s.fluid === 'water' ? 1000 : s.fluid === 'air' ? 1.2 : s.rho) : (s.fluid === 'water' ? 1.94 : s.fluid === 'air' ? 0.00234 : s.rhoEN); },

    controls(el, C) {
      const s = this.state, U = root.App.U(), u = Physics.momUnits(U), SI = u.SI;
      const sl = (p, k, label, min, max, step, unit, o) => C.slider(p, Object.assign({ label, min, max, step, get: () => s[k], set: (v) => (s[k] = v), unit }, o || {}));
      C.select(el, { label: 'Problem', options: [['plate', 'Jet on a flat plate'], ['vane', 'Jet on a curved vane or bucket'], ['split', 'Jet split by a wedge or divider'], ['bend', 'Pipe bend, reducer or nozzle'], ['reaction', 'Jet reaction on a tank'], ['thrust', 'Jet engine, rocket or jet boat'], ['sprinkler', 'Rotating sprinkler (angular momentum)'], ['prop', 'Propeller, fan, rotor or wind turbine']], get: () => s.topic, set: (v) => (s.topic = v) });
      const T = s.topic;
      const fl = C.section(el, 'Fluid');
      const air = T === 'prop' || (T === 'thrust' && s.kind !== 'water');
      if (!(T === 'thrust' && s.kind !== 'water')) {
        C.seg(fl, { label: 'Density', options: [['water', 'Water'], ['air', 'Air'], ['given', 'Given ρ']], get: () => s.fluid, set: (v) => (s.fluid = v) });
        if (s.fluid === 'given') { if (SI) sl(fl, 'rho', 'Density ρ', 0.01, 20000, 0.001, u.rho); else sl(fl, 'rhoEN', 'Density ρ', 0.00001, 30, 0.00001, u.rho); }
        C.note(fl, `ρ = ${f(this.rhoOf(U))} ${u.rho}${air && s.fluid === 'water' ? ' — choose Air for a propeller in air' : ''}`);
      }
      if (T === 'plate' || T === 'vane' || T === 'split') {
        const g = C.section(el, 'Jet');
        if (T === 'plate') C.select(g, { label: 'Solve for', options: [['F', 'Force on the plate'], ['Q', 'Discharge from the force (jet size known)'], ['D', 'Jet size from the force (discharge known)'], ['h', 'Height at which a vertical jet holds a load']], get: () => s.solve, set: (v) => (s.solve = v) });
        const sv = T === 'plate' ? s.solve : 'F';
        if (sv !== 'D') sl(g, 'D', 'Jet diameter D', 1, SI ? 2000 : 80, SI ? 1 : 0.01, u.du);
        if (sv === 'F' || sv === 'h') sl(g, 'V', 'Jet velocity V', 0.1, SI ? 300 : 1000, 0.01, u.v);
        if (sv === 'D') sl(g, 'Q', 'Discharge Q', 0.00001, SI ? 20 : 500, 0.00001, u.Q);
        if (sv !== 'F') sl(g, 'Fg', sv === 'h' ? 'Weight held up by the jet W' : 'Force on the plate F', 0.01, SI ? 1e7 : 1e6, 0.01, u.F);
        if (sv === 'h') C.note(g, 'A vertical jet strikes a flat plate (or the bottom of a load) square on; the plate rides at the height where ρ Q V_h equals the weight.');
        if (T !== 'split' && sv !== 'h') {
          const m = C.section(el, T === 'plate' ? 'Plate' : 'Vane');
          sl(m, 'theta', T === 'plate' ? 'Angle between plate and jet θ' : 'Deflection angle θ', T === 'plate' ? 5 : 0, T === 'plate' ? 90 : 180, 0.1, '°');
          if (sv === 'F') {
            C.select(m, { label: 'Motion', options: [['fixed', 'Fixed'], ['single', 'Single one moving along the jet'], ['series', 'Series of them (wheel): whole jet used']], get: () => s.motion, set: (v) => (s.motion = v) });
            if (s.motion !== 'fixed') sl(m, 'u', 'Speed u (+ away from the jet, − toward it)', SI ? -200 : -600, SI ? 200 : 600, 0.01, u.v);
            if (T === 'vane') sl(m, 'kf', 'Friction factor k = V_r2 / V_r1', 0.5, 1, 0.0001, '');
            if (s.motion === 'fixed') { C.toggle(m, { label: 'Vertical jet rising a height h to the ' + (T === 'plate' ? 'plate' : 'vane'), get: () => s.vert, set: (v) => (s.vert = v) }); if (s.vert) sl(m, 'h', 'Height h', 0, SI ? 100 : 300, 0.001, u.L); }
          }
          if (T === 'plate') { sl(m, 'ar', 'Plate area ÷ jet area (0 = skip pressures)', 0, 100, 0.1, ''); }
        } else {
          const m = C.section(el, 'Streams');
          sl(m, 'f1', 'Share of the flow in stream 1', 0, 1, 0.001, '');
          sl(m, 't1', 'Stream 1 direction θ₁ (CCW from the jet)', -180, 180, 0.1, '°');
          sl(m, 't2', 'Stream 2 direction θ₂ (CCW from the jet)', -180, 180, 0.1, '°');
        }
      } else if (T === 'bend') {
        const g = C.section(el, 'Fitting');
        sl(g, 'D1', 'Inlet diameter D₁', 1, SI ? 5000 : 200, SI ? 1 : 0.01, u.du);
        sl(g, 'D2', 'Outlet diameter D₂', 1, SI ? 5000 : 200, SI ? 1 : 0.01, u.du);
        sl(g, 'theta', 'Turning angle θ (0 = straight reducer or nozzle)', 0, 180, 0.1, '°');
        C.seg(g, { label: 'Plane of the bend', options: [['h', 'Horizontal'], ['v', 'Vertical (outlet turns up)']], get: () => s.plane, set: (v) => (s.plane = v) });
        if (s.plane === 'v') { sl(g, 'dz', 'Outlet above the inlet z₂ − z₁', -50, 50, 0.001, u.L); sl(g, 'vol', 'Volume of fluid inside', 0, SI ? 100 : 3000, 0.0001, SI ? 'm³' : 'ft³'); sl(g, 'Wb', 'Weight of the fitting', 0, SI ? 1e6 : 2e5, 0.1, u.F); }
        const fl2 = C.section(el, 'Flow');
        C.seg(fl2, { label: 'Flow given as', options: [['Q', 'Discharge Q'], ['V', 'Inlet velocity V₁']], get: () => s.qBy, set: (v) => (s.qBy = v) });
        if (s.qBy === 'Q') sl(fl2, 'Q', 'Discharge Q', 0.00001, SI ? 50 : 2000, 0.00001, u.Q); else sl(fl2, 'V1', 'Inlet velocity V₁', 0.01, SI ? 50 : 150, 0.01, u.v);
        C.seg(fl2, { label: 'Known pressure', options: [['p1', 'At the inlet p₁'], ['p2', 'At the outlet p₂']], get: () => s.pAt, set: (v) => (s.pAt = v) });
        sl(fl2, 'pg', s.pAt === 'p1' ? 'Inlet gauge pressure p₁' : 'Outlet gauge pressure p₂ (0 = free jet)', -100, SI ? 20000 : 3000, 0.01, u.pu);
        sl(fl2, 'hL', 'Head loss in the fitting h_L', 0, SI ? 100 : 300, 0.001, u.L);
      } else if (T === 'reaction') {
        const g = C.section(el, 'Tank and opening');
        sl(g, 'D', 'Opening diameter', 1, SI ? 1000 : 40, SI ? 1 : 0.01, u.du);
        C.seg(g, { label: 'Driving head', options: [['h', 'Liquid head h'], ['p', 'Air pressure p + head h']], get: () => s.hBy, set: (v) => (s.hBy = v) });
        sl(g, 'h', 'Head h above the opening', 0, SI ? 100 : 300, 0.001, u.L);
        if (s.hBy === 'p') sl(g, 'pg', 'Air pressure above the liquid', 0, SI ? 5000 : 700, 0.01, u.pu);
        sl(g, 'Cv', 'Velocity coefficient C_v', 0.5, 1, 0.001, ''); sl(g, 'Cc', 'Contraction coefficient C_c', 0.5, 1, 0.001, '');
        sl(g, 'alpha', 'Jet angle above horizontal α', -90, 90, 0.1, '°');
      } else if (T === 'thrust') {
        const g = C.section(el, 'Device');
        C.select(g, { label: 'Type', options: [['engine', 'Air-breathing jet engine'], ['rocket', 'Rocket'], ['water', 'Jet boat or water-jet device']], get: () => s.kind, set: (v) => (s.kind = v) });
        if (s.kind === 'water') {
          sl(g, 'Q', 'Flow through the pump Q', 0.0001, SI ? 50 : 2000, 0.0001, u.Q);
          sl(g, 'Vj', 'Jet velocity relative to the craft', 0.01, SI ? 200 : 600, 0.01, u.v);
          sl(g, 'Vb', 'Speed of the craft relative to the water', 0, SI ? 100 : 300, 0.01, u.v);
          C.seg(g, { label: 'Water taken in', options: [['bow', 'Through the bow (moving with the water)'], ['side', 'From the sides (no forward momentum)']], get: () => s.intake, set: (v) => (s.intake = v) });
        } else {
          C.seg(g, { label: 'Flows given as', options: [['m', `Mass (${u.md})`], ['W', `Weight (${u.wd})`]], get: () => s.flowBy, set: (v) => (s.flowBy = v) });
          const un = s.flowBy === 'm' ? u.md : u.wd;
          if (s.kind === 'engine') sl(g, 'ma', 'Air flow', 0, SI ? 5000 : 2000, 0.001, un);
          sl(g, 'mf', s.kind === 'rocket' ? 'Propellant flow' : 'Fuel flow', 0, SI ? 5000 : 2000, 0.0001, un);
          if (s.kind === 'engine') sl(g, 'V1', 'Flight speed V₁ (0 on a test stand)', 0, SI ? 1000 : 3000, 0.01, u.v);
          C.seg(g, { label: 'Solve for', options: [['F', 'Thrust'], ['Ve', 'Exit velocity for a thrust']], get: () => s.solve === 'Ve' ? 'Ve' : 'F', set: (v) => (s.solve = v) });
          if (s.solve === 'Ve') sl(g, 'F', 'Required thrust F', 0, SI ? 1e7 : 2e6, 0.1, u.F); else sl(g, 'Ve', 'Exit velocity V_e (relative)', 0, SI ? 5000 : 15000, 0.1, u.v);
          sl(g, 'pe', 'Exit pressure above atmospheric', -100, SI ? 2000 : 300, 0.01, u.pu); if (s.pe !== 0) sl(g, 'Ae', 'Exit area A_e', 0, SI ? 20 : 200, 0.0001, u.A);
          if (s.kind === 'rocket') {
            const r = C.section(el, 'Rocket');
            C.seg(r, { label: 'Rocket given by', options: [['m', `Mass (${u.m})`], ['W', `Weight (${u.F})`]], get: () => s.Mby, set: (v) => (s.Mby = v) });
            sl(r, 'Mr', 'Current mass or weight (0 = skip)', 0, 1e8, 0.1, s.Mby === 'm' ? u.m : u.F);
            sl(r, 'Dr', 'Air drag', 0, 1e8, 0.1, u.F);
            sl(r, 'Pr', 'Power developed (0 = skip)', 0, 1e8, 0.1, u.Pu);
          }
        }
      } else if (T === 'sprinkler') {
        const g = C.section(el, 'Sprinkler');
        C.seg(g, { label: 'Number of arms', options: [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], get: () => s.n, set: (v) => (s.n = v) });
        sl(g, 'r', 'Arm radius to the nozzle r', 0.001, SI ? 5 : 15, 0.001, u.L);
        sl(g, 'd', 'Nozzle diameter', 0.1, SI ? 200 : 8, SI ? 0.1 : 0.001, u.du);
        sl(g, 'alpha', 'Nozzle angle from the tangent α', 0, 89, 0.1, '°');
        C.seg(g, { label: 'Flow given as', options: [['Q', 'Total discharge Q'], ['p', 'Supply pressure']], get: () => s.qBy, set: (v) => (s.qBy = v) });
        if (s.qBy === 'p') { sl(g, 'pg', 'Pressure at the nozzles', 0, SI ? 5000 : 700, 0.01, u.pu); sl(g, 'Cv', 'Velocity coefficient C_v', 0.5, 1, 0.001, ''); }
        else sl(g, 'Q', 'Total discharge Q', 0.000001, SI ? 1 : 30, 0.000001, u.Q);
        const m = C.section(el, 'Rotation');
        C.seg(m, { label: 'Solve for', options: [['T', 'Torque at a given speed'], ['w', 'Speed against a friction torque']], get: () => s.solve === 'w' ? 'w' : 'T', set: (v) => (s.solve = v) });
        if (s.solve === 'w') sl(m, 'Tf', 'Friction torque', 0, SI ? 10000 : 7000, 0.001, u.M);
        else sl(m, 'rpm', 'Speed (0 = held still)', 0, 5000, 0.1, 'rpm');
        sl(m, 'rF', 'Radius where a holding force acts (0 = skip)', 0, SI ? 5 : 15, 0.001, u.L);
      } else if (T === 'prop') {
        const g = C.section(el, 'Rotor');
        C.seg(g, { label: 'Type', options: [['prop', 'Propeller, fan or rotor'], ['wind', 'Wind turbine']], get: () => s.pkind, set: (v) => (s.pkind = v) });
        sl(g, 'Dp', 'Rotor diameter', 0.01, SI ? 200 : 600, 0.001, u.L);
        const opts = s.pkind === 'wind' ? [['V4', 'Wake velocity V₄'], ['eta', 'Efficiency']] : [['V4', 'Slipstream velocity V₄'], ['Q', 'Flow through the disk Q'], ['F', 'Thrust F'], ['etaF', 'Ideal efficiency and thrust']];
        if (!opts.some((o) => o[0] === s.giv)) s.giv = 'V4';
        C.select(g, { label: 'Known', options: opts, get: () => s.giv, set: (v) => (s.giv = v) });
        if (s.giv !== 'etaF') sl(g, 'V1', s.pkind === 'wind' ? 'Wind speed V₁' : 'Approach (flight) speed V₁', 0, SI ? 400 : 1300, 0.001, u.v);
        if (s.giv === 'V4') sl(g, 'V4', s.pkind === 'wind' ? 'Wake velocity V₄' : 'Slipstream velocity V₄', 0, SI ? 600 : 2000, 0.001, u.v);
        if (s.giv === 'Q') sl(g, 'Q', 'Flow through the disk Q', 0.001, 1e5, 0.001, u.Q);
        if (s.giv === 'F' || s.giv === 'etaF') sl(g, 'F', 'Thrust F', 0.01, 1e8, 0.01, u.F);
        if (s.giv === 'eta' || s.giv === 'etaF') sl(g, 'eta', 'Efficiency η', 0.01, 0.99, 0.001, '');
      }
    },

    compute(U) {
      const s = this.state, p = Object.assign({}, s, { rho: this.rhoOf(U), n: +s.n, kind: s.topic === 'prop' ? s.pkind : s.kind });
      if (s.topic === 'thrust' && s.kind === 'water') p.rho = this.rhoOf(U);
      if (s.topic === 'sprinkler' && s.solve !== 'w') p.solve = 'T';
      if (s.topic === 'thrust' && s.solve !== 'Ve') p.solve = 'F';
      return Physics.momentum(p, U);
    },

    scene(res, U) {
      const g = res.geo, u = Physics.momUnits(U), sc = Scene.Scene();
      sc.depth = 0.6;
      const jetCol = (o) => Object.assign({ fill: WATER, stroke: WATERD, sw: 1, fop: 0.75 }, o || {});
      const forceArrow = (at, fx, fy, label, len) => { const L = Math.hypot(fx, fy) || 1, l = len || 1.6; sc.arrow([at[0] - (fx / L) * l, at[1] - (fy / L) * l], at, { color: RED, label, w: 3.5 }); };
      const jet = (x0, x1, hw, y) => sc.rect(x0, (y || 0) - hw, x1, (y || 0) + hw, jetCol(), { alpha: 0.6, fill: WATER });
      const stream = (a, ang, len, hw) => { const c = Math.cos(ang), s = Math.sin(ang), nx = -s * hw, ny = c * hw; sc.poly([[a[0] + nx, a[1] + ny], [a[0] + c * len + nx, a[1] + s * len + ny], [a[0] + c * len - nx, a[1] + s * len - ny], [a[0] - nx, a[1] - ny]], jetCol(), { alpha: 0.6, fill: WATER }); };
      if (g.kind === 'plate' || g.kind === 'vane') {
        const hw = 0.22, vert = g.vert && g.h > 0;
        // rotate the picture for a vertical jet: world (x along jet) → screen up
        const R = (pt) => (vert ? [-pt[1], pt[0]] : pt);
        const Rv = (v) => (vert ? [-v[1], v[0]] : v);
        const rect = (x0, y0, x1, y1) => sc.poly([R([x0, y0]), R([x1, y0]), R([x1, y1]), R([x0, y1])], jetCol(), { alpha: 0.6, fill: WATER });
        rect(-3.2, -hw, -0.05, hw);
        sc.arrow(R([-3.0, hw + 0.35]), R([-2.0, hw + 0.35]), { color: WATERD, label: `V = ${f(g.Vin || g.Vh || g.V)} ${u.v}` });
        if (vert) { sc.line([-1.2, -3.2], [1.2, -3.2], { stroke: INK, sw: 2 }); sc.text([0.3, -3.5], 'nozzle', { size: 11 }); sc.dim([1.0, -3.2], [1.0, -0.05], `h = ${f(g.h)} ${u.L}`, 20); }
        if (g.kind === 'plate') {
          const th = g.theta * DEG, c = Math.cos(th), s = Math.sin(th), L = 1.6, t = 0.08;
          const along = [c, s], nrm = [s, -c];
          const P = (a, b) => R([along[0] * a + nrm[0] * b, along[1] * a + nrm[1] * b]);
          sc.poly([P(-L, 0), P(L, 0), P(L, t * 2), P(-L, t * 2)], { fill: STEEL, stroke: INK, sw: 1.5 }, { fill: STEEL, alpha: 0.9 });
          // streams along the plate
          const q1 = (1 + c) / 2, q2 = (1 - c) / 2;
          const st = (dir, frac) => { if (frac < 0.02) return; const w = Math.max(0.04, hw * frac); sc.poly([P(0, -0.01), P(dir * L * 0.95, -0.01), P(dir * L * 0.95, -0.01 - 2 * w), P(0, -0.01 - 2 * w)], jetCol(), { alpha: 0.6, fill: WATER }); };
          st(1, q1); st(-1, q2);
          // force of the jet on the plate: normal to the plate, pushing it away from the jet
          const Fd = Rv(nrm), at = R([nrm[0] * (t * 2 + 0.08), nrm[1] * (t * 2 + 0.08)]);
          sc.arrow(at, [at[0] + Fd[0] * 1.6, at[1] + Fd[1] * 1.6], { color: RED, w: 3.5, lp: 'head', label: `F = ${f(g.Fn)} ${u.F}`, ldy: Fd[1] < -0.3 ? 16 : -8, ldx: Fd[0] < -0.3 ? -6 : 6, anchor: Fd[0] < -0.3 ? 'end' : undefined });
          if (g.motion !== 'fixed') sc.arrow(R([0.4, 1.5]), R([1.4, 1.5]), { color: GREEN, label: `u = ${f(g.u)} ${u.v}` });
          if (g.theta < 89.9) sc.text(R([-1.4, -0.7]), `θ = ${f(g.theta)}°`, { size: 12 });
        } else {
          const th = g.theta * DEG, Rr = 1.1, pts = [], vpts = [];
          for (let i = 0; i <= 30; i++) { const a = (th * i) / 30; pts.push(R([Rr * Math.sin(a), Rr - Rr * Math.cos(a)])); vpts.push(R([(Rr + 0.28) * Math.sin(a), Rr - (Rr + 0.28) * Math.cos(a)])); }
          sc.pline(pts, { stroke: WATER, sw: 9 });
          sc.poly(vpts.concat(pts.slice().reverse().map((q) => [q[0] + (vert ? 0.0 : 0), q[1]])).length > 3 ? vpts.concat(vpts.slice().reverse().map((q, i) => { const a = (th * (30 - i)) / 30; return R([(Rr + 0.42) * Math.sin(a), Rr - (Rr + 0.42) * Math.cos(a)]); })) : vpts, { fill: STEEL, stroke: INK, sw: 1.2 }, { fill: STEEL, alpha: 0.9 });
          const end = [Rr * Math.sin(th), Rr - Rr * Math.cos(th)];
          const dir = [Math.cos(th), Math.sin(th)];
          sc.poly([R([end[0] - dir[1] * hw * 0.9, end[1] + dir[0] * hw * 0.9]), R([end[0] + dir[0] * 1.4 - dir[1] * hw * 0.9, end[1] + dir[1] * 1.4 + dir[0] * hw * 0.9]), R([end[0] + dir[0] * 1.4 + dir[1] * hw * 0.9, end[1] + dir[1] * 1.4 - dir[0] * hw * 0.9]), R([end[0] + dir[1] * hw * 0.9, end[1] - dir[0] * hw * 0.9])], jetCol(), { alpha: 0.6, fill: WATER });
          const ve = Rv([g.V2x, g.V2y]), vl = Math.hypot(ve[0], ve[1]) || 1, e2 = R([end[0] + dir[0] * 1.5, end[1] + dir[1] * 1.5]);
          if (vl > 1e-6) sc.arrow(e2, [e2[0] + (ve[0] / vl) * 0.9, e2[1] + (ve[1] / vl) * 0.9], { color: WATERD, label: `V₂ = ${f(Math.hypot(g.V2x, g.V2y))} ${u.v}` });
          const Fd = Rv([g.Fx, g.Fy]), mid = R([Rr * Math.sin(th / 2) * 1.35, Rr - Rr * Math.cos(th / 2) * 1.35]);
          forceArrow([mid[0] + (Fd[0] / (Math.hypot(Fd[0], Fd[1]) || 1)) * 1.7, mid[1] + (Fd[1] / (Math.hypot(Fd[0], Fd[1]) || 1)) * 1.7], Fd[0], Fd[1], `R = ${f(Math.hypot(g.Fx, g.Fy))} ${u.F}  (F_x = ${f(Math.abs(g.Fx))}, F_y = ${f(Math.abs(g.Fy))})`, 1.4);
          if (g.motion !== 'fixed') sc.arrow(R([-0.6, -1.0]), R([0.4, -1.0]), { color: GREEN, label: `u = ${f(g.u)} ${u.v}` });
          // θ measured at the vane exit from the incoming jet direction
          const e0 = R(end), ref = R([end[0] + 1.1, end[1]]);
          sc.line(e0, ref, { stroke: '#7f8c8d', dash: '4 3', sw: 1, no3: true });
          sc.add({ t: 'arc', c: e0, r: 42, a0: vert ? 90 : 0, a1: (vert ? 90 : 0) + g.theta, s: `θ = ${f(g.theta)}°`, only2d: true });
        }
        sc.autoBounds(0.12); sc.padR = 120; return sc;
      }
      if (g.kind === 'split') {
        const hw = 0.22;
        jet(-3.2, -0.05, hw);
        sc.poly([[0, 0], [0.9, 0.35], [0.9, -0.35]], { fill: STEEL, stroke: INK, sw: 1.5 }, { fill: STEEL, alpha: 0.9 });
        stream([0.05, 0.05], g.t1 * DEG, 2.2, Math.max(0.04, hw * g.f1));
        stream([0.05, -0.05], g.t2 * DEG, 2.2, Math.max(0.04, hw * (1 - g.f1)));
        sc.text([2.2 * Math.cos(g.t1 * DEG), 2.2 * Math.sin(g.t1 * DEG) + 0.3], `Q₁ (${f(g.f1 * 100, 3)} %)`, { size: 12, in3: true });
        sc.text([2.2 * Math.cos(g.t2 * DEG), 2.2 * Math.sin(g.t2 * DEG) - 0.3], `Q₂ (${f((1 - g.f1) * 100, 3)} %)`, { size: 12, in3: true });
        sc.arrow([-3.0, hw + 0.35], [-2.0, hw + 0.35], { color: WATERD, label: `V = ${f(g.V)} ${u.v}` });
        { const L = Math.hypot(g.Fx, g.Fy) || 1; sc.arrow([1.0, 0], [1.0 + (g.Fx / L) * 1.6, (g.Fy / L) * 1.6], { color: RED, w: 3.5, lp: 'head', label: `R = ${f(L)} ${u.F}`, ldy: 18, anchor: 'middle', ldx: 0 }); }
        sc.autoBounds(0.12); sc.padR = 110; return sc;
      }
      if (g.kind === 'bend') {
        const Dm = Math.max(g.D1, g.D2), w1 = 0.25 + 0.35 * (g.D1 / Dm), w2 = 0.25 + 0.35 * (g.D2 / Dm), th = g.theta * DEG;
        const PIPE = { fill: WATER, stroke: INK, sw: 2, fop: 0.5 }, PIPE3 = { fill: WATER, alpha: 0.5 };
        // centreline: inlet straight, then an arc (or a short taper when θ = 0), then the outlet straight
        const Rc = 1.3 * Math.max(w1, w2), L2 = 2.4, N = 24, left = [], right = [];
        const put = (p, n, w) => { left.push([p[0] + n[0] * w, p[1] + n[1] * w]); right.push([p[0] - n[0] * w, p[1] - n[1] * w]); };
        put([-3, 0], [0, 1], w1); put([0, 0], [0, 1], w1);
        let E;
        if (th > 1e-3) {
          for (let i = 1; i <= N; i++) { const a = (th * i) / N; put([Rc * Math.sin(a), Rc * (1 - Math.cos(a))], [-Math.sin(a), Math.cos(a)], w1 + ((w2 - w1) * i) / N); }
          E = [Rc * Math.sin(th), Rc * (1 - Math.cos(th))];
        } else { E = [0.6, 0]; put(E, [0, 1], w2); }
        const c = Math.cos(th), s = Math.sin(th), d = [c, s], nn = [-s, c], F2 = [E[0] + c * L2, E[1] + s * L2];
        put(F2, nn, w2);
        sc.poly(left.concat(right.slice().reverse()), PIPE, PIPE3);
        sc.line([-3, -w1 - 0.1], [-3, w1 + 0.1], { stroke: INK, sw: 3 });
        sc.line([F2[0] + nn[0] * (w2 + 0.1), F2[1] + nn[1] * (w2 + 0.1)], [F2[0] - nn[0] * (w2 + 0.1), F2[1] - nn[1] * (w2 + 0.1)], { stroke: INK, sw: 3 });
        sc.arrow([-4.4, 0], [-3.05, 0], { color: '#8e44ad', label: `P₁ = ${f(g.P1)} ${u.F}`, anchor: 'end', ldx: -6, ldy: 4 });
        if (Math.abs(g.P2) > 1e-9) sc.arrow([F2[0] + c * 1.35, F2[1] + s * 1.35], [F2[0] + c * 0.05, F2[1] + s * 0.05], { color: '#8e44ad', label: `P₂ = ${f(g.P2)} ${u.F}`, ldx: th > 1.2 ? 8 : 6 });
        sc.arrow([-2.6, w1 * 0.4], [-1.6, w1 * 0.4], { color: WATERD, label: `V₁ = ${f(g.V1)} ${u.v}`, size: 12 });
        const v2a = [E[0] + c * 0.5 + nn[0] * w2 * 0.4, E[1] + s * 0.5 + nn[1] * w2 * 0.4];
        sc.arrow(v2a, [v2a[0] + c * 1.0, v2a[1] + s * 1.0], { color: WATERD, label: `V₂ = ${f(g.V2)} ${u.v}`, size: 12 });
        // force on the fitting drawn from the middle of the bend
        const mid = th > 1e-3 ? [Rc * Math.sin(th / 2), Rc * (1 - Math.cos(th / 2))] : [-0.7, -w1 - 0.95];
        const FL = Math.hypot(g.Fx, g.Fy) || 1, fd = [g.Fx / FL, g.Fy / FL];
        sc.arrow(mid, [mid[0] + fd[0] * 2.0, mid[1] + fd[1] * 2.0], { color: RED, w: 3.5, lp: 'head', label: `F on the fitting = ${f(FL)} ${u.F}  (F_x = ${f(Math.abs(g.Fx))}, F_y = ${f(Math.abs(g.Fy))})`, ldy: fd[1] < -0.3 || th <= 1e-3 ? 16 : -8, anchor: fd[0] < -0.3 ? 'end' : undefined, ldx: fd[0] < -0.3 ? -6 : 6 });
        if (g.plane === 'v' && g.W > 0) sc.arrow([-1.0, -w1 - 0.15], [-1.0, -w1 - 1.1], { color: '#7f8c8d', label: `W = ${f(g.W)} ${u.F}`, lp: 'head', ldy: 14, anchor: 'middle', ldx: 0 });
        sc.text([-3, w1 + 0.3], `D₁ = ${f(g.D1 / u.dF)} ${u.du}, p₁ = ${f(g.p1 / u.pF)} ${u.pu}`, { size: 11.5 });
        const dpos = [E[0] + c * L2 * 0.5 - nn[0] * (w2 + 0.3), E[1] + s * L2 * 0.5 - nn[1] * (w2 + 0.3) - (th < 0.2 ? 0.15 : 0)];
        sc.text(dpos, `D₂ = ${f(g.D2 / u.dF)} ${u.du}, p₂ = ${f(g.p2 / u.pF)} ${u.pu}`, { size: 11.5 });
        sc.autoBounds(0.12); sc.padR = 170; return sc;
      }
      if (g.kind === 'reaction') {
        sc.rect(-3, -1.5, 0, 1.5, { fill: 'none', stroke: INK, sw: 3 }, { fill: STEEL, alpha: 0.25 });
        sc.rect(-2.95, -1.45, -0.05, 0.9, { fill: WATER, stroke: 'none', fop: 0.5 }, { fill: WATER, alpha: 0.45 });
        sc.fs([-1.5, 0.9]);
        sc.dim([-0.05, -1.1], [-0.05, 0.9], `H = ${f(g.H)} ${u.L}`, -22);
        const a = g.alpha * DEG, pts = []; for (let i = 0; i <= 20; i++) { const t = i * 0.05; pts.push([0.05 + 3 * Math.cos(a) * t, -1.1 + 3 * Math.sin(a) * t - 2.2 * t * t]); }
        sc.pline(pts, { stroke: WATER, sw: 8 });
        sc.arrow([0.2, -0.6], [1.2, -0.6], { color: WATERD, label: `V_j = ${f(g.Vj)} ${u.v}` });
        sc.arrow([-1.6, -2.0], [-3.0, -2.0], { color: RED, label: `F = ${f(g.F)} ${u.F}`, w: 3.5 });
        sc.autoBounds(0.12); sc.padR = 120; return sc;
      }
      if (g.kind === 'thrust') {
        if (g.sub === 'water') {
          sc.poly([[-3, 0], [1.6, 0], [2.4, 0.9], [-3, 0.9]], { fill: '#ecf0f1', stroke: INK, sw: 2 }, { fill: '#ecf0f1', alpha: 0.9 });
          sc.rect(-4.5, -0.6, 3.2, 0.2, { fill: WATER, stroke: 'none', fop: 0.35 }, { fill: WATER, alpha: 0.3 });
          sc.rect(-4.4, 0.05, -3.0, 0.3, jetCol(), { alpha: 0.6, fill: WATER });
          sc.arrow([-3.1, 0.6], [-4.4, 0.6], { color: WATERD, label: `V_j = ${f(g.Vj)} ${u.v}`, anchor: 'end' });
          sc.arrow([0.5, 1.3], [1.8, 1.3], { color: GREEN, label: `V_b = ${f(g.Vb)} ${u.v}` });
          sc.arrow([-1.2, 0.45], [0.6, 0.45], { color: RED, label: `F = ${f(g.F)} ${u.F}`, w: 3.5 });
        } else {
          const pod = g.sub === 'rocket' ? [[-2.5, -0.5], [1.5, -0.5], [2.5, 0], [1.5, 0.5], [-2.5, 0.5], [-3, 0.7], [-3, -0.7]] : [[-2.6, -0.45], [1.6, -0.7], [2.2, -0.6], [2.2, 0.6], [1.6, 0.7], [-2.6, 0.45]];
          sc.poly(pod, { fill: '#dfe6ec', stroke: INK, sw: 2 }, { fill: '#dfe6ec', alpha: 0.9 });
          sc.poly([[-3, -0.35], [-5, -0.5], [-5, 0.5], [-3, 0.35]], { fill: '#f5b041', stroke: 'none', fop: 0.6 }, { fill: '#f5b041', alpha: 0.5 });
          if (g.sub === 'engine') sc.arrow([4.2, 0], [2.4, 0], { color: WATERD, label: `air in at V₁ = ${f(g.V1)} ${u.v}`, anchor: 'end', ldx: -6 });
          sc.arrow([-3.2, -0.9], [-5, -0.9], { color: '#d35400', label: `V_e = ${f(g.Ve)} ${u.v}`, anchor: 'end' });
          sc.arrow([-0.5, 1.1], [1.6, 1.1], { color: RED, label: `F = ${f(g.F)} ${u.F}`, w: 3.5 });
        }
        sc.autoBounds(0.12); sc.padR = 110; return sc;
      }
      if (g.kind === 'sprinkler') {
        const n = g.n, al = g.alpha * DEG;
        sc.circle([0, 0], 0.25, { fill: STEEL, stroke: INK, sw: 1.5 }, 'disc');
        for (let i = 0; i < n; i++) {
          const a = (2 * PI * i) / n, c = Math.cos(a), s = Math.sin(a), tip = [2 * c, 2 * s];
          sc.line([0.25 * c, 0.25 * s], tip, { stroke: INK, sw: 5 });
          // jet leaves backward (clockwise tangent) tilted outward by α
          const tx = s, ty = -c, jd = [tx * Math.cos(al) + c * Math.sin(al), ty * Math.cos(al) + s * Math.sin(al)];
          sc.line(tip, [tip[0] + jd[0] * 1.2, tip[1] + jd[1] * 1.2], { stroke: WATER, sw: 6 });
          if (i === 0) sc.arrow([tip[0] + jd[0] * 1.3, tip[1] + jd[1] * 1.3], [tip[0] + jd[0] * 2.1, tip[1] + jd[1] * 2.1], { color: WATERD, label: 'jet', lp: 'head', ldx: 6, ldy: 4 });
        }
        sc.add({ t: 'arc', c: [0, 0], r: 46, a0: 200, a1: 330, s: 'T', o: { color: RED, head: true, w: 2.4 }, only2d: true });
        sc.text([0.3, 0.45], g.w > 0 ? `ω = ${f((g.w * 60) / (2 * PI))} rpm` : 'held still', { size: 12, in3: true });
        sc.text([-2.2, -2.9], `T = ${f(g.T)} ${u.M} (reaction turns the arms counterclockwise ↺)`, { size: 13, color: RED, in3: true });
        sc.dim([0, 0], [2, 0], `r = ${f(g.r)} ${u.L}`, -18);
        sc.autoBounds(0.15); sc.padR = 100; return sc;
      }
      if (g.kind === 'prop') {
        const w1 = g.wind ? 0.8 : 1.4, w4 = Math.max(0.3, Math.min(2.2, w1 * Math.sqrt(g.Vd / Math.max(g.V4, 1e-6)) * (g.wind ? 1.25 : 1))), wd = 1.0;
        const up = [[-4, w1], [-1.5, (w1 + wd) / 2], [0, wd], [1.5, (wd + w4) / 2], [4, w4]], dn = up.map((q) => [q[0], -q[1]]);
        sc.pline(up, { stroke: '#7f8c8d', sw: 1.5, dash: '6 4' }); sc.pline(dn, { stroke: '#7f8c8d', sw: 1.5, dash: '6 4' });
        sc.rect(-0.08, -wd, 0.08, wd, { fill: INK, stroke: INK }, { fill: INK, alpha: 0.9 });
        sc.arrow([-4.6, 0], [-3.6, 0], { color: WATERD, label: `V₁ = ${f(g.V1)} ${u.v}` });
        sc.arrow([-1.7, 0], [-0.5, 0], { color: WATERD, label: `V = ${f(g.Vd)} ${u.v}` });
        sc.arrow([3, 0], [4, 0], { color: WATERD, label: `V₄ = ${f(g.V4)} ${u.v}` });
        const fs = g.wind ? 1 : -1;
        sc.arrow([0, wd + 0.45], [fs * 1.5, wd + 0.45], { color: RED, label: `F = ${f(Math.abs(g.F))} ${u.F}`, lp: 'head', anchor: g.wind ? 'start' : 'end', ldx: fs * 6, ldy: 4, w: 3.5 });
        sc.text([0, -wd - 0.4], `D = ${f(g.Dp)} ${u.L}`, { size: 12, anchor: 'middle' });
        sc.autoBounds(0.12); sc.padR = 110; return sc;
      }
      sc.autoBounds(); return sc;
    },

    draw2D(svg, res, U) {
      if (!res.ok) { root.M1.emptyMsg(svg, res); return; }
      Scene.draw2D(svg, this.scene(res, U));
    },
    draw3D(V, res, U) {
      if (!res.ok) return;
      Scene.draw3D(V, this.scene(res, U));
    },
  };
  root.MJ = MJ;
})(window);
