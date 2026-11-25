/* =====================================================================
 * MODULE — Fluid Properties
 * density & specific gravity, ideal gas, gas processes, bulk modulus,
 * viscosity units & temperature laws, surface tension, capillarity,
 * water tables (vapour pressure, boiling, cavitation, thermal expansion).
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Physics, Scene } = root;
  const f = Physics.fmt;
  const PI = Math.PI, DEG = PI / 180;
  const WATER = '#4aa3df', WATERD = '#1f6fa8', GAS = '#d6eaf8', OIL = '#e0b84a', STEEL = '#9aa3ad', HG = '#aab7b8';

  const DEF = {
    topic: 'dens',
    given: 'sg', m: 100, W: 1000, V: 0.1, rho: 1000, gam: 9.81, sg: 0.85, sv: 0.001, gLoc: 0, useV: false, Vq: 1,
    nmix: '2', mV1: 4, mS1: 0.81, mV2: 10, mS2: 0.79, mV3: 1, mS3: 1,
    gas: 'air', R: 287, k: 1.4, solve: 'rho', p: 101.3, T: 20, gauge: false, patm: 101.3, vshape: 'V', vD: 1, vL: 2, mass: 1,
    proc: 'isoT', spec: 'p2', p1: 100, T1: 20, p2: 200, Vr: 0.5, T2: 50, dm: 0.5, m1: 2,
    E: 2.2, dp: 10, V1: 1, dV: 0.005,
    from: 'mu', muU: 'Pas', nuU: 'm2s', val: 0.1,
    law: 'andrade', vmode: 'fit', vT1: 20, vT2: 80, mu1: 1.0e-3, mu2: 0.356e-3, B: 1.732e-6, C: 1863, Tq: 50, Tq2On: false, Tq2: 80,
    scase: 'drop', solveS: 'dp', sigma: 0.0728, d: 1, dPin: 300, Do: 50, Di: 48, Pring: 0.03, Wring: 0.02, sgS: 7.85, fobj: 'sphere', Wobj: 0.01,
    cgeom: 'tube', solveC: 'h', sgL: 1, theta: 0, h: 10, tilt: 0,
    tbl: 'H', wtask: 'props', Tw: 20, Tw2: 40, hw: 3, bby: 'z', zb: 1000, pb: 50, patmW: 101.3,
  };
  const pr = (name, units, x) => ({ name, units, apply: (s) => Object.assign(s, JSON.parse(JSON.stringify(DEF)), x) });

  const MF = {
    id: 'mf', title: 'Fluid Properties',
    state: JSON.parse(JSON.stringify(DEF)),
    presets: [
      pr('Hibbeler 1-5 — mercury γ = 133 kN/m³: density and S (13 558 kg/m³, 13.6)', 'SI', { topic: 'dens', given: 'gam', gam: 133 }),
      pr('Hibbeler 1-6 — jet fuel ρ = 1.32 slug/ft³, 50 ft³: weight (2.13 kip)', 'EN', { topic: 'dens', given: 'rho', rho: 1.32, useV: true, Vq: 50 }),
      pr('Schaum 1.2 — 6 m³ of oil weighs 47 kN: γ, ρ, S (7.83 kN/m³)', 'SI', { topic: 'dens', given: 'WV', W: 47000, V: 6 }),
      pr('Hibbeler 1-20 — 4 ft³ kerosene + 10 ft³ ethyl alcohol (γ = 49.7 lb/ft³)', 'EN', { topic: 'dens', given: 'mix', nmix: '2', mV1: 4, mS1: 0.8144, mV2: 10, mS2: 0.7887 }),
      pr('Hibbeler 1-8 — oxygen tank 0.12 m³ at 12 MPa, 30 °C: mass (18.3 kg)', 'SI', { topic: 'gas', gas: 'o2', solve: 'm', p: 12000, T: 30, vshape: 'V', V: 0.12 }),
      pr('Hibbeler 1-10 — CO₂ at 100 °C, 400 kPa: specific weight (55.7 N/m³)', 'SI', { topic: 'gas', gas: 'co2', solve: 'rho', p: 400, T: 100 }),
      pr('Hibbeler 1-11 — air at 100 °F, 80 psia: specific weight (0.386 lb/ft³)', 'EN', { topic: 'gas', gas: 'air', solve: 'rho', p: 80, T: 100 }),
      pr('Hibbeler 1-19 — helium balloon D = 8 m, 28 °C, 106 kPa: weight (446 N)', 'SI', { topic: 'gas', gas: 'he', solve: 'm', p: 106, T: 28, vshape: 'sphere', vD: 8 }),
      pr('Schaum 1.1 — methane at 100 °F, 120 psia: γ and ρ (0.320 lb/ft³)', 'EN', { topic: 'gas', gas: 'ch4', solve: 'rho', p: 120, T: 100 }),
      pr('Hibbeler 1-22 — helium 230 → 450 kPa at 20 °C: density increase (0.362 kg/m³)', 'SI', { topic: 'proc', gas: 'he', proc: 'isoT', spec: 'p2', p1: 230, T1: 20, p2: 450 }),
      pr('Schaum 1.6 — air 12.5 → 2.5 ft³ isothermally from 40 psia (200 psia, E = 200 psi)', 'EN', { topic: 'proc', gas: 'air', proc: 'isoT', spec: 'Vr', p1: 40, T1: 120, Vr: 0.2 }),
      pr('Schaum 1.6 — same air compressed adiabatically (381 psia, E = 533 psi)', 'EN', { topic: 'proc', gas: 'air', proc: 'isen', spec: 'Vr', p1: 40, T1: 120, Vr: 0.2 }),
      pr('Hibbeler 1-16 — 2 kg air at 400 kPa, 20 °C; add 0.6 kg, T → 32 °C (541 kPa)', 'SI', { topic: 'proc', gas: 'air', proc: 'tank', spec: 'dm', p1: 400, T1: 20, vshape: 'fromM', m1: 2, dm: 0.6, T2: 32 }),
      pr('Hibbeler 1-15 — 5 m³ air tank at 210 kPa, 15 °C warms to 30 °C: mass that escapes (0.629 kg)', 'SI', { topic: 'proc', gas: 'air', proc: 'tank', spec: 'p2', p1: 210, T1: 15, vshape: 'V', V: 5, p2: 210, T2: 30 }),
      pr('Schaum 1.5 — ocean at 80 MPa, γ₀ = 10.05 kN/m³, E = 2.34 GPa (γ = 10.41 kN/m³)', 'SI', { topic: 'bulk', solve: 'dV', E: 2.34, dp: 80, V1: 1, sg: 1.0245 }),
      pr('Bulk modulus from a test: 1.000 ft³ loses 0.0102 ft³ under 3000 psi (E = 294 000 psi)', 'EN', { topic: 'bulk', solve: 'E', dp: 3000, V1: 1, dV: 0.0102, sg: 1 }),
      pr('Schaum 1.7 — water 1.008 cP in lb·s/ft² (2.11 × 10⁻⁵)', 'SI', { topic: 'visc', from: 'mu', muU: 'cP', val: 1.008, sg: 1 }),
      pr('Schaum 1.8 — 15.14 poise, S = 0.964, in ft²/s (0.0169)', 'SI', { topic: 'visc', from: 'mu', muU: 'P', val: 15.14, sg: 0.964 }),
      pr('Schaum 1.9 — 510 Saybolt seconds in ft²/s (0.00120)', 'SI', { topic: 'visc', from: 'ssu', val: 510, sg: 0.9 }),
      pr('Hibbeler 1-49 — Andrade water law at 10 °C and 80 °C (1.25, 0.339 mPa·s)', 'SI', { topic: 'vlaw', law: 'andrade', vmode: 'pred', B: 1.732e-6, C: 1863, Tq: 10, Tq2On: true, Tq2: 80 }),
      pr('Hibbeler 1-50 — Sutherland constants for air from 2 readings (B = 1.36 × 10⁻⁶, C = 78.8 K)', 'SI', { topic: 'vlaw', law: 'suth', vmode: 'fit', vT1: 20, mu1: 18.3e-6, vT2: 50, mu2: 19.6e-6, Tq: 20 }),
      pr('Hibbeler 1-66 — water jet d = 0.4 in, σ = 0.005 lb/ft (Δp = 0.300 psf)', 'EN', { topic: 'surf', scase: 'jet', solveS: 'dp', sigma: 0.005, d: 0.4 }),
      pr('Hibbeler 1-68 — soda bubble d = 0.02 in, σ = 0.00503 lb/ft (0.0838 psi)', 'EN', { topic: 'surf', scase: 'gasb', solveS: 'dp', sigma: 0.00503, d: 0.02 }),
      pr('Hibbeler 1-67 — largest steel particle that floats, σ = 0.00492 lb/ft (0.0931 in)', 'EN', { topic: 'surf', scase: 'float', fobj: 'sphere', sigma: 0.00492, sgS: 7.844 }),
      pr('Hibbeler 1-75 — water strider 0.36 g: leg contact length (24.3 mm)', 'SI', { topic: 'surf', scase: 'float', fobj: 'legs', sigma: 0.0727, Wobj: 0.0035316 }),
      pr('Hibbeler 1-77 — 100 mm ring, W = 0.2 N, pulled off at 0.245 N: σ (0.0716 N/m)', 'SI', { topic: 'surf', scase: 'ring', solveS: 'sigma', Do: 100, Di: 100, Pring: 0.245, Wring: 0.2 }),
      pr('Hibbeler 1-71 — water at 40 °C in a 1 mm tube: rise (28.6 mm)', 'SI', { topic: 'cap', cgeom: 'tube', solveC: 'h', sigma: 0.0696, theta: 0, sgL: 0.9923, d: 1 }),
      pr('Mercury in a 2 mm glass tube, θ = 140°: depression', 'SI', { topic: 'cap', cgeom: 'tube', solveC: 'h', sigma: 0.514, theta: 140, sgL: 13.6, d: 2 }),
      pr('Water between parallel plates 1.5 mm apart: rise', 'SI', { topic: 'cap', cgeom: 'plates', solveC: 'h', sigma: 0.0728, theta: 0, sgL: 1, d: 1.5 }),
      pr('Hibbeler 1-60 — boiling water in Denver, 1610 m (94.6 °C)', 'SI', { topic: 'water', wtask: 'boil', bby: 'z', zb: 1610 }),
      pr('Hibbeler 1-61 — boiling water on Everest, 29 000 ft (158 °F)', 'EN', { topic: 'water', wtask: 'boil', bby: 'z', zb: 29000 }),
      pr('Hibbeler 1-62 — lowest pressure at turbine blades, water 30 °C (4.25 kPa)', 'SI', { topic: 'water', wtask: 'cav', Tw: 30, patmW: 101.3 }),
      pr('Hibbeler 1-64 — garden hose cavitation, water 70 °F (0.363 psia)', 'EN', { topic: 'water', wtask: 'cav', Tw: 70, patmW: 14.7 }),
      pr('Hibbeler 1-14 — pool 3.03 m deep at 5 °C warmed to 35 °C (3.05 m)', 'SI', { topic: 'water', wtask: 'expand', Tw: 5, Tw2: 35, hw: 3.03 }),
    ],

    controls(el, C) {
      const s = this.state, u = Physics.PU[root.App.U().id], SI = u.id === 'SI';
      const sl = (p, k, label, min, max, step, unit, o) => C.slider(p, Object.assign({ label, min, max, step, get: () => s[k], set: (v) => (s[k] = v), unit }, o || {}));
      C.select(el, { label: 'Topic', options: [['dens', 'Density, specific weight & gravity'], ['gas', 'Ideal gas law'], ['proc', 'Gas compression & rigid tanks'], ['bulk', 'Bulk modulus (liquid compressibility)'], ['visc', 'Viscosity unit conversion'], ['vlaw', 'Viscosity vs temperature (Andrade, Sutherland)'], ['surf', 'Surface tension'], ['cap', 'Capillary rise'], ['water', 'Water tables: vapour pressure & boiling']], get: () => s.topic, set: (v) => (s.topic = v) });
      const T = s.topic;
      const gasSel = (g) => {
        C.select(g, { label: 'Gas', options: Object.entries(Physics.GASES).map(([k, G]) => [k, `${G.name} (R = ${SI ? G.R : Math.round(G.R * 5.97994)}, k = ${G.k})`]).concat([['custom', 'Custom R and k']]), get: () => s.gas, set: (v) => (s.gas = v) });
        if (s.gas === 'custom') { sl(g, 'R', 'Gas constant R', 1, SI ? 5000 : 30000, 0.1, u.R); sl(g, 'k', 'Specific heat ratio k', 1, 1.7, 0.01, ''); }
      };
      const volCtl = (g, allowFromM) => {
        C.select(g, { label: 'Tank volume from', options: [['V', 'Volume V directly'], ['sphere', 'Sphere of diameter D'], ['cyl', 'Cylinder D × L'], ['capsule', 'Cylinder + hemispherical ends']].concat(allowFromM ? [['fromM', 'Initial mass of gas m₁']] : []), get: () => s.vshape, set: (v) => (s.vshape = v) });
        if (s.vshape === 'V') sl(g, 'V', 'Volume V', 0.0001, 1000, 0.0001, u.V);
        else if (s.vshape === 'fromM') sl(g, 'm1', 'Initial mass m₁', 0.0001, 1000, 0.0001, u.m);
        else { sl(g, 'vD', 'Diameter D', 0.01, 50, 0.01, SI ? 'm' : 'ft'); if (s.vshape !== 'sphere') sl(g, 'vL', s.vshape === 'capsule' ? 'Straight length L' : 'Length L', 0, 100, 0.01, SI ? 'm' : 'ft'); }
      };

      if (T === 'dens') {
        const g = C.section(el, 'Given');
        C.select(g, { label: 'Known quantity', options: [['sg', 'Specific gravity S'], ['rho', 'Density ρ'], ['gam', 'Specific weight γ'], ['sv', 'Specific volume v'], ['mV', 'Mass m and volume V'], ['WV', 'Weight W and volume V'], ['mix', 'Mixture of liquids']], get: () => s.given, set: (v) => (s.given = v) });
        if (s.given === 'sg') C.sg(g, { label: 'Specific gravity S', get: () => s.sg, set: (v) => (s.sg = v) });
        if (s.given === 'rho') sl(g, 'rho', 'Density ρ', 0.0001, SI ? 20000 : 40, SI ? 0.1 : 0.0001, u.rho);
        if (s.given === 'gam') sl(g, 'gam', 'Specific weight γ', 0.001, SI ? 200 : 1000, 0.001, u.gam);
        if (s.given === 'sv') sl(g, 'sv', 'Specific volume v', 0.00001, SI ? 10 : 1000, 0.00001, u.sv);
        if (s.given === 'mV') { sl(g, 'm', 'Mass m', 0.0001, 100000, 0.0001, u.m); sl(g, 'V', 'Volume V', 0.0001, 10000, 0.0001, u.V); }
        if (s.given === 'WV') { sl(g, 'W', 'Weight W', 0.001, 1e7, 0.001, u.W); sl(g, 'V', 'Volume V', 0.0001, 10000, 0.0001, u.V); }
        if (s.given === 'mix') {
          C.seg(g, { label: 'Number of liquids', options: [['2', '2'], ['3', '3']], get: () => s.nmix, set: (v) => (s.nmix = v) });
          for (let i = 1; i <= +s.nmix; i++) { sl(g, 'mV' + i, `Liquid ${i}: volume`, 0, 10000, 0.001, u.V); sl(g, 'mS' + i, `Liquid ${i}: specific gravity`, 0.1, 13.6, 0.0001, ''); }
          C.note(g, 'Enter S = γ/γ_w or ρ/ρ_w. Volumes are assumed to add (no shrinkage on mixing).');
        } else {
          const o = C.section(el, 'Options');
          sl(o, 'gLoc', 'Local gravity g (0 = standard)', 0, SI ? 30 : 100, 0.01, u.acc);
          if (s.given !== 'mV' && s.given !== 'WV') { C.toggle(o, { label: 'Find the mass and weight of a volume', get: () => s.useV, set: (v) => (s.useV = v) }); if (s.useV) sl(o, 'Vq', 'Volume V', 0.0001, 1e6, 0.0001, u.V); }
        }
      } else if (T === 'gas') {
        const g = C.section(el, 'Gas');
        gasSel(g);
        C.select(g, { label: 'Solve for', options: [['rho', 'Density & specific weight (p, T given)'], ['m', 'Mass & weight in a tank'], ['V', 'Volume of a given mass'], ['p', 'Pressure (ρ, T given)'], ['T', 'Temperature (p, ρ given)']], get: () => s.solve, set: (v) => (s.solve = v) });
        const st = C.section(el, 'State');
        if (s.solve !== 'p') {
          C.toggle(st, { label: 'Pressure entered as gauge', get: () => s.gauge, set: (v) => (s.gauge = v) });
          sl(st, 'p', s.gauge ? 'Gauge pressure p' : 'Absolute pressure p', s.gauge ? -100 : 0.01, SI ? 50000 : 5000, 0.01, s.gauge ? u.p : u.pabs);
          if (s.gauge) sl(st, 'patm', 'Atmospheric pressure', 0.1, SI ? 110 : 16, 0.001, u.p);
        }
        if (s.solve !== 'T') sl(st, 'T', 'Temperature T', SI ? -100 : -150, SI ? 1500 : 2500, 0.1, u.T);
        if (s.solve === 'p' || s.solve === 'T') sl(st, 'rho', 'Density ρ', 0.00001, SI ? 500 : 1, 0.00001, u.rho);
        if (s.solve === 'm') volCtl(st, false);
        if (s.solve === 'V') sl(st, 'mass', 'Mass m', 0.00001, 10000, 0.00001, u.m);
      } else if (T === 'proc') {
        const g = C.section(el, 'Gas & process');
        gasSel(g);
        C.select(g, { label: 'Process', options: [['isoT', 'Isothermal (pV = const)'], ['isen', 'Isentropic / adiabatic (pVᵏ = const)'], ['isoV', 'Constant volume (rigid, heated)'], ['isoP', 'Constant pressure (heated)'], ['tank', 'Rigid tank: gas added or released']], get: () => s.proc, set: (v) => (s.proc = v) });
        const st = C.section(el, 'Initial state 1');
        sl(st, 'p1', 'Absolute pressure p₁', 0.01, SI ? 50000 : 5000, 0.01, u.pabs);
        sl(st, 'T1', 'Temperature T₁', SI ? -100 : -150, SI ? 1500 : 2500, 0.1, u.T);
        const s2 = C.section(el, 'Final state 2');
        if (s.proc === 'isoT' || s.proc === 'isen') {
          C.seg(s2, { label: 'Known', options: [['p2', 'Final pressure p₂'], ['Vr', 'Volume ratio V₂/V₁']], get: () => s.spec, set: (v) => (s.spec = v) });
          if (s.spec === 'p2') sl(s2, 'p2', 'Absolute pressure p₂', 0.01, SI ? 50000 : 5000, 0.01, u.pabs); else sl(s2, 'Vr', 'Volume ratio V₂/V₁', 0.001, 100, 0.001, '');
        } else if (s.proc === 'isoV') {
          C.seg(s2, { label: 'Known', options: [['T2', 'Final temperature T₂'], ['p2', 'Final pressure p₂']], get: () => (s.spec === 'p2' ? 'p2' : 'T2'), set: (v) => (s.spec = v) });
          if (s.spec === 'p2') sl(s2, 'p2', 'Absolute pressure p₂', 0.01, SI ? 50000 : 5000, 0.01, u.pabs); else sl(s2, 'T2', 'Temperature T₂', SI ? -100 : -150, SI ? 1500 : 2500, 0.1, u.T);
        } else if (s.proc === 'isoP') {
          sl(s2, 'T2', 'Temperature T₂', SI ? -100 : -150, SI ? 1500 : 2500, 0.1, u.T);
        } else {
          volCtl(s2, true);
          sl(s2, 'T2', 'Final temperature T₂', SI ? -100 : -150, SI ? 1500 : 2500, 0.1, u.T);
          C.seg(s2, { label: 'Known', options: [['p2', 'Final pressure p₂'], ['dm', 'Mass added Δm']], get: () => (s.spec === 'p2' ? 'p2' : 'dm'), set: (v) => (s.spec = v) });
          if (s.spec === 'p2') sl(s2, 'p2', 'Absolute pressure p₂', 0.01, SI ? 50000 : 5000, 0.01, u.pabs); else sl(s2, 'dm', 'Mass added Δm (negative = released)', -1000, 1000, 0.0001, u.m);
        }
      } else if (T === 'bulk') {
        const g = C.section(el, 'Liquid');
        C.select(g, { label: 'Solve for', options: [['dV', 'Volume decrease ΔV'], ['E', 'Bulk modulus E'], ['dp', 'Pressure increase Δp']], get: () => s.solve === 'E' || s.solve === 'dp' ? s.solve : 'dV', set: (v) => (s.solve = v) });
        if (s.solve !== 'E') sl(g, 'E', 'Bulk modulus E', 0.001, SI ? 30 : 4e6, SI ? 0.001 : 100, u.E);
        if (s.solve !== 'dp') sl(g, 'dp', 'Pressure increase Δp', 0.0001, SI ? 1000 : 100000, 0.0001, u.dp);
        sl(g, 'V1', 'Initial volume V₁', 0.000001, 1e6, 0.000001, u.V);
        if (s.solve !== 'dV') sl(g, 'dV', 'Volume decrease ΔV', 0, 1e5, 0.000001, u.V);
        C.sg(g, { label: 'Specific gravity at the start (for density, c)', get: () => s.sg, set: (v) => (s.sg = v) });
        C.note(g, 'For a percentage problem put V₁ = 100 and ΔV = the percentage.');
      } else if (T === 'visc') {
        const g = C.section(el, 'Viscosity');
        C.seg(g, { label: 'Known', options: [['mu', 'Dynamic μ'], ['nu', 'Kinematic ν'], ['ssu', 'Saybolt seconds']], get: () => s.from, set: (v) => (s.from = v) });
        if (s.from === 'mu') C.select(g, { label: 'Unit of μ', options: Object.entries(Physics.MU_U).map(([k, v]) => [k, v[1]]), get: () => s.muU, set: (v) => (s.muU = v) });
        if (s.from === 'nu') C.select(g, { label: 'Unit of ν', options: Object.entries(Physics.NU_U).map(([k, v]) => [k, v[1]]), get: () => s.nuU, set: (v) => (s.nuU = v) });
        sl(g, 'val', s.from === 'ssu' ? 'Saybolt Universal time t' : 'Value', 1e-9, 10000, 1e-9, s.from === 'ssu' ? 's' : '');
        C.sg(g, { label: 'Specific gravity S (for μ ↔ ν)', get: () => s.sg, set: (v) => (s.sg = v) });
      } else if (T === 'vlaw') {
        const g = C.section(el, 'Empirical law');
        C.seg(g, { label: 'Law', options: [['andrade', 'Andrade (liquids)'], ['suth', 'Sutherland (gases)']], get: () => s.law, set: (v) => (s.law = v) });
        C.seg(g, { label: 'Task', options: [['fit', 'Find B and C from 2 readings'], ['pred', 'Use known B and C']], get: () => s.vmode, set: (v) => (s.vmode = v) });
        if (s.vmode === 'fit') {
          sl(g, 'vT1', 'Reading 1: temperature T₁', -100, 1500, 0.1, u.T); sl(g, 'mu1', 'Reading 1: viscosity μ₁', 1e-9, 10, 1e-9, u.mu);
          sl(g, 'vT2', 'Reading 2: temperature T₂', -100, 1500, 0.1, u.T); sl(g, 'mu2', 'Reading 2: viscosity μ₂', 1e-9, 10, 1e-9, u.mu);
        } else { sl(g, 'B', 'Constant B', 1e-12, 1, 1e-12, s.law === 'andrade' ? u.mu : `${u.mu}/${u.Ta}^½`); sl(g, 'C', 'Constant C', -5000, 10000, 0.01, u.Ta); }
        const q = C.section(el, 'Predict');
        sl(q, 'Tq', 'Temperature T', -100, 1500, 0.1, u.T);
        C.toggle(q, { label: 'Also at a second temperature', get: () => s.Tq2On, set: (v) => (s.Tq2On = v) });
        if (s.Tq2On) sl(q, 'Tq2', 'Second temperature', -100, 1500, 0.1, u.T);
      } else if (T === 'surf') {
        const g = C.section(el, 'Situation');
        C.select(g, { label: 'Case', options: [['drop', 'Liquid droplet in air'], ['gasb', 'Gas bubble inside a liquid'], ['bubble', 'Soap bubble (two surfaces)'], ['jet', 'Cylindrical liquid jet'], ['ring', 'Ring pulled off a surface (tensiometer)'], ['float', 'Object supported by surface tension']], get: () => s.scase, set: (v) => (s.scase = v) });
        const c = s.scase;
        if (['drop', 'gasb', 'bubble', 'jet'].includes(c)) {
          C.seg(g, { label: 'Solve for', options: [['dp', 'Pressure difference Δp'], ['sigma', 'Surface tension σ'], ['d', 'Diameter d']], get: () => s.solveS === 'sigma' || s.solveS === 'd' ? s.solveS : 'dp', set: (v) => (s.solveS = v) });
          if (s.solveS !== 'sigma') sl(g, 'sigma', 'Surface tension σ', 0.0001, SI ? 1 : 0.05, 0.00001, u.sig);
          if (s.solveS !== 'd') sl(g, 'd', 'Diameter d', 0.0001, SI ? 100 : 4, 0.0001, u.len);
          if (s.solveS !== 'dp') sl(g, 'dPin', 'Pressure difference Δp', 0.0001, SI ? 100000 : 2000, 0.0001, u.dP);
        } else if (c === 'ring') {
          C.seg(g, { label: 'Solve for', options: [['P', 'Pull force P'], ['sigma', 'Surface tension σ']], get: () => (s.solveS === 'sigma' ? 'sigma' : 'P'), set: (v) => (s.solveS = v) });
          sl(g, 'Do', 'Outer diameter D₀', 0.1, SI ? 500 : 20, 0.01, u.len); sl(g, 'Di', 'Inner diameter Dᵢ', 0, SI ? 500 : 20, 0.01, u.len);
          sl(g, 'Wring', 'Ring weight W', 0, SI ? 10 : 2, 0.0001, u.W);
          if (s.solveS === 'sigma') sl(g, 'Pring', 'Measured pull P', 0, SI ? 10 : 2, 0.0001, u.W); else sl(g, 'sigma', 'Surface tension σ', 0.0001, SI ? 1 : 0.05, 0.00001, u.sig);
        } else {
          C.seg(g, { label: 'Object', options: [['sphere', 'Small sphere'], ['needle', 'Needle / wire'], ['legs', 'Insect legs / wire carrying W']], get: () => s.fobj, set: (v) => (s.fobj = v) });
          sl(g, 'sigma', 'Surface tension σ', 0.0001, SI ? 1 : 0.05, 0.00001, u.sig);
          if (s.fobj === 'legs') sl(g, 'Wobj', 'Weight to support W', 0, SI ? 1 : 0.2, 0.0000001, u.W);
          else sl(g, 'sgS', 'Specific gravity of the object', 0.1, 22, 0.001, '');
        }
      } else if (T === 'cap') {
        const g = C.section(el, 'Geometry');
        C.seg(g, { label: 'Shape', options: [['tube', 'Round tube'], ['plates', 'Parallel plates'], ['annulus', 'Annulus between tubes']], get: () => s.cgeom, set: (v) => (s.cgeom = v) });
        C.select(g, { label: 'Solve for', options: [['h', 'Height of rise h'], ['d', s.cgeom === 'plates' ? 'Gap t' : 'Diameter d'], ['sigma', 'Surface tension σ'], ['theta', 'Contact angle θ']], get: () => s.solveC, set: (v) => (s.solveC = v) });
        if (s.cgeom === 'annulus') { sl(g, 'Do', 'Outer tube inside diameter D₀', 0.01, SI ? 50 : 2, 0.001, u.len); sl(g, 'Di', 'Inner tube outside diameter Dᵢ', 0, SI ? 50 : 2, 0.001, u.len); }
        else if (s.solveC !== 'd') sl(g, 'd', s.cgeom === 'plates' ? 'Gap t' : 'Inside diameter d', 0.001, SI ? 50 : 2, 0.001, u.len);
        if (s.solveC !== 'h') sl(g, 'h', 'Rise h (negative = depression)', SI ? -100 : -4, SI ? 500 : 20, 0.001, u.len);
        sl(g, 'tilt', 'Tube tilt from vertical α', 0, 85, 0.1, '°');
        const L = C.section(el, 'Liquid');
        const bar = root.UI.h('div', { class: 'presets' });
        [['Water 20 °C', SI ? 0.0728 : 0.00499, 0, 1], ['Water 40 °C', SI ? 0.0696 : 0.00477, 0, 0.9923], ['Mercury', SI ? 0.514 : 0.0352, 140, 13.6]].forEach(([n, sg2, th, S]) => bar.append(root.UI.h('button', { type: 'button', onclick: () => { s.sigma = sg2; s.theta = th; s.sgL = S; root.App.rebuild(); } }, n)));
        L.append(bar);
        if (s.solveC !== 'sigma') sl(L, 'sigma', 'Surface tension σ', 0.0001, SI ? 1 : 0.05, 0.00001, u.sig);
        if (s.solveC !== 'theta') sl(L, 'theta', 'Contact angle θ', 0, 180, 0.1, '°');
        sl(L, 'sgL', 'Specific gravity S', 0.5, 13.6, 0.0001, '');
      } else if (T === 'water') {
        const g = C.section(el, 'Water');
        C.seg(g, { label: 'Table', options: [['H', 'Hibbeler App. A'], ['S', 'Schaum Table 1(C)']], get: () => s.tbl, set: (v) => (s.tbl = v) });
        C.select(g, { label: 'Task', options: [['props', 'Properties at a temperature'], ['boil', 'Boiling temperature'], ['cav', 'Cavitation pressure'], ['expand', 'Thermal expansion of a pool or tank']], get: () => s.wtask, set: (v) => (s.wtask = v) });
        if (s.wtask === 'boil') {
          C.seg(g, { label: 'Pressure from', options: [['z', 'Elevation (standard atmosphere)'], ['p', 'Absolute pressure']], get: () => s.bby, set: (v) => (s.bby = v) });
          if (s.bby === 'z') sl(g, 'zb', 'Elevation above sea level', 0, SI ? 25000 : 60000, 1, u.z); else sl(g, 'pb', 'Absolute pressure', 0.1, SI ? 101.3 : 14.7, 0.001, SI ? 'kPa' : 'psia');
        } else {
          sl(g, 'Tw', s.wtask === 'expand' ? 'Initial temperature T₁' : 'Water temperature T', SI ? 0 : 32, SI ? 100 : 212, 0.1, u.T);
          if (s.wtask === 'expand') { sl(g, 'Tw2', 'Final temperature T₂', SI ? 0 : 32, SI ? 100 : 212, 0.1, u.T); sl(g, 'hw', 'Initial depth h₁', 0.001, 100, 0.001, u.z); }
          if (s.wtask === 'cav') sl(g, 'patmW', 'Atmospheric pressure', 1, SI ? 110 : 16, 0.001, SI ? 'kPa' : 'psi');
        }
      }
    },

    compute(U) { return Physics.props(this.state, U); },

    scene(res, U) {
      const s = this.state, g = res.geo, u = Physics.PU[U.id];
      const sc = Scene.Scene();
      const T = g.topic;
      if (T === 'dens') {
        if (g.mix) {
          let y = 0; const tot = g.mix.reduce((a, q) => a + q.V, 0) || 1;
          sc.rect(-0.05, -0.05, 1.05, 1.15, { fill: 'none', stroke: '#2c3e50', sw: 2 }, false);
          g.mix.forEach((q, i) => { const hgt = q.V / tot; sc.rect(0, y, 1, y + hgt, { fill: [OIL, '#f5cba7', '#a9cce3'][i], stroke: '#7f8c8d', fop: 0.85 }, { alpha: 0.6 }); sc.text([0.5, y + hgt / 2], `Liquid ${i + 1}: S = ${f(q.s)}, V = ${f(q.V)}`, { anchor: 'middle', in3: true }); y += hgt; });
          sc.text([1.12, 0.5], `S_mix = ${f(g.sm)}`, { color: '#c0392b', size: 14 });
          sc.autoBounds(0.15); sc.padR = 140; return sc;
        }
        const sg = g.sg, col = sg > 3 ? HG : sg >= 0.98 && sg <= 1.05 ? WATER : sg < 0.01 ? GAS : OIL;
        sc.rect(0, 0, 1, 1, { fill: col, stroke: '#2c3e50', sw: 1.5, fop: 0.8 }, { alpha: 0.65, fill: col });
        sc.dim([0, 0], [1, 0], g.V ? `V = ${f(g.V)} ${u.V}` : '1 unit volume', -22);
        sc.text([0.5, 0.62], `ρ, γ, S = ${f(sg)}`, { anchor: 'middle', size: 14, in3: true });
        sc.arrow([0.5, 0.35], [0.5, -0.35], { color: '#2c3e50', label: 'W = mg' });
        sc.autoBounds(0.2); return sc;
      }
      if (T === 'gas') {
        const shp = s.solve === 'm' ? s.vshape : 'V';
        if (shp === 'sphere') sc.circle([0, 0], 1, { fill: GAS, stroke: '#2c3e50', sw: 2 }, 'sphere', '#aed6f1');
        else if (shp === 'cyl' || shp === 'capsule') { sc.rect(-1.4, -0.7, 1.4, 0.7, { fill: GAS, stroke: '#2c3e50', sw: 2 }, false); sc.lathe([[0, -1.4], [0.7, -1.4], [0.7, 1.4], [0, 1.4]], 0, '#aed6f1', 0.5); if (shp === 'capsule') { sc.circle([-1.4, 0], 0.7, { fill: GAS, stroke: '#2c3e50', sw: 2 }); sc.circle([1.4, 0], 0.7, { fill: GAS, stroke: '#2c3e50', sw: 2 }); } }
        else sc.rect(-1, -1, 1, 1, { fill: GAS, stroke: '#2c3e50', sw: 2 }, { fill: '#aed6f1', alpha: 0.45 });
        for (let i = 0; i < 26; i++) { const a = i * 2.39996, r = 0.75 * Math.sqrt((i + 0.5) / 26); sc.dot([r * Math.cos(a), r * Math.sin(a)], '#5d6d7e', null, { r: 2.5 }); }
        const r = res.out;
        const val = (k) => (r.find((o) => o.k.startsWith(k)) || {}).v;
        sc.text([0, 0.15], `p = ${f(val('Absolute pressure'))} ${u.pabs}`, { anchor: 'middle', size: 13, in3: true });
        sc.text([0, -0.15], `T = ${f(val('Absolute temperature'))} ${u.Ta}`, { anchor: 'middle', size: 13 });
        sc.text([0, -0.45], `ρ = ${f(val('Density'))} ${u.rho}`, { anchor: 'middle', size: 13, color: '#c0392b' });
        if (s.solve === 'm' && shp === 'sphere') sc.dim([-1, -1.15], [1, -1.15], `D = ${f(s.vD)}`, -6);
        sc.autoBounds(0.15); sc.depth = 2; return sc;
      }
      if (T === 'proc') {
        const Vr = Math.max(0.05, Math.min(3, g.Vr || 1));
        const H1 = 1.6, H2 = H1 * Math.min(Vr, 2);
        const cyl = (x0, hgt, lab) => {
          sc.rect(x0 - 0.05, 0, x0 + 1.05, 3.4, { fill: 'none', stroke: '#2c3e50', sw: 2 }, false);
          sc.rect(x0, 0, x0 + 1, hgt, { fill: GAS, stroke: '#7f8c8d', fop: 0.9 }, { fill: '#aed6f1', alpha: 0.5 });
          sc.rect(x0, hgt, x0 + 1, hgt + 0.18, { fill: STEEL, stroke: '#2c3e50' }, { fill: STEEL, alpha: 0.95 });
          sc.rect(x0 + 0.45, hgt + 0.18, x0 + 0.55, 3.6, { fill: STEEL, stroke: '#2c3e50' }, { fill: STEEL, alpha: 0.95 });
          sc.text([x0 + 0.5, -0.3], lab, { anchor: 'middle', size: 13, in3: true });
        };
        cyl(0, H1, 'State 1');
        if (g.kind === 'tank') { cyl(2.2, H1, 'State 2 (same V)'); sc.text([1.6, 1.0], s.spec === 'dm' ? `${s.dm >= 0 ? '+' : ''}${f(s.dm)} ${u.m}` : 'Δm', { anchor: 'middle', color: '#c0392b' }); }
        else cyl(2.2, H2, `State 2: V₂/V₁ = ${f(g.Vr)}`);
        sc.arrow([1.25, 2.6], [1.95, 2.6], { color: '#c0392b' });
        sc.autoBounds(0.12); sc.depth = 1; return sc;
      }
      if (T === 'bulk') {
        const e = Math.min(0.5, Math.max(0.05, g.strain * 5));
        sc.rect(-0.05, 0, 1.05, 2.4, { fill: 'none', stroke: '#2c3e50', sw: 2 }, false);
        sc.rect(0, 0, 1, 2 * (1 - e), { fill: WATER, stroke: '#2c3e50', fop: 0.85 }, { fill: WATER, alpha: 0.55 });
        sc.line([0, 2], [1, 2], { stroke: '#7f8c8d', dash: '5 4' });
        sc.text([1.1, 2], 'V₁', { color: '#52606d' });
        sc.rect(0, 2 * (1 - e), 1, 2 * (1 - e) + 0.15, { fill: STEEL, stroke: '#2c3e50' }, { fill: STEEL, alpha: 0.95 });
        sc.arrow([0.5, 3.2], [0.5, 2 * (1 - e) + 0.2], { color: '#c0392b', label: 'Δp' });
        sc.dim([1, 2 * (1 - e)], [1, 2], 'ΔV (exaggerated)', 30);
        sc.autoBounds(0.15); return sc;
      }
      if (T === 'surf') {
        if (g.c === 'ring') {
          sc.rect(-2, -1, 2, 0, { fill: WATER, stroke: WATERD, fop: 0.6 }, { fill: WATER, alpha: 0.4 });
          sc.rect(-1, 0, 1, 0.08, { fill: STEEL, stroke: '#2c3e50' }, { fill: STEEL, alpha: 1, z0: -0.05, z1: 0.05 });
          sc.arrow([0, 0.1], [0, 1.2], { color: '#c0392b', label: 'P' });
          [-1, 1].forEach((x) => sc.arrow([x, 0], [x, -0.5], { color: '#8e44ad', label: 'σ' }));
          sc.dim([-1, 0.3], [1, 0.3], 'D', 10);
          sc.autoBounds(0.15); return sc;
        }
        if (g.c === 'float') {
          sc.rect(-2, -1.2, 2, 0, { fill: WATER, stroke: WATERD, fop: 0.6 }, { fill: WATER, alpha: 0.4 });
          if (g.obj === 'sphere') sc.circle([0, 0], 0.5, { fill: STEEL, stroke: '#2c3e50' }, 'sphere', STEEL);
          else sc.rect(-1.2, -0.05, 1.2, 0.12, { fill: STEEL, stroke: '#2c3e50' }, { fill: STEEL, alpha: 1 });
          sc.arrow([0, 0], [0, -0.9], { color: '#2c3e50', label: 'W' });
          [-0.55, 0.55].forEach((x) => sc.arrow([x, -0.02], [x * 1.25, 0.6], { color: '#8e44ad', label: 'σ' }));
          sc.autoBounds(0.15); return sc;
        }
        const r = 1;
        if (g.c === 'jet') {
          sc.rect(-0.5, -2, 0.5, 2, { fill: WATER, stroke: WATERD, fop: 0.75 }, false);
          sc.lathe([[0, -2], [0.5, -2], [0.5, 2], [0, 2]], 0, WATER, 0.6);
          sc.text([0, 0], 'pᵢ', { anchor: 'middle', size: 15, in3: true }); sc.text([1.2, 0], 'p₀', { size: 15 });
          sc.dim([-0.5, -2.2], [0.5, -2.2], 'd', -6);
          sc.autoBounds(0.25); return sc;
        }
        sc.circle([0, 0], r, { fill: g.c === 'drop' ? WATER : GAS, stroke: g.c === 'drop' ? WATERD : '#5d6d7e', sw: 2, fop: 0.8 }, 'sphere', g.c === 'drop' ? WATER : '#d6eaf8');
        if (g.c === 'bubble') sc.circle([0, 0], r * 0.95, { stroke: '#5d6d7e', sw: 1, dash: '3 3' });
        if (g.c === 'gasb') sc.rect(-2, -2, 2, 2, { fill: WATER, fop: 0.25, stroke: 'none' }, false);
        sc.line([-r, 0], [r, 0], { stroke: '#7f8c8d', dash: '5 4' });
        sc.text([0, 0.3], 'pᵢ', { anchor: 'middle', size: 15, in3: true }); sc.text([1.5, 0.8], 'p₀', { size: 15 });
        sc.arrow([-r, 0], [-r, -0.7], { color: '#8e44ad', label: 'σ' }); sc.arrow([r, 0], [r, -0.7], { color: '#8e44ad', label: 'σ' });
        sc.dim([-r, -1.2], [r, -1.2], `d = ${f(g.d / u.lenF)} ${u.len}`, -6);
        sc.autoBounds(0.2); return sc;
      }
      if (T === 'cap') {
        const w = 0.6, hgt = Math.max(-2, Math.min(3.5, (g.h / (Math.abs(g.h) || 1)) * Math.min(3.2, 0.4 + 2.8 * Math.min(1, Math.abs(g.h) / (8 * g.w + 1e-12)))));
        const HG2 = s.sgL > 5;
        const liq = HG2 ? HG : WATER;
        sc.rect(-3, -2.5, 3, 0, { fill: liq, stroke: '#2c3e50', fop: 0.55 }, { fill: liq, alpha: 0.35 });
        sc.fs([2.2, 0]);
        // tube walls
        sc.rect(-w / 2 - 0.12, -1.4, -w / 2, 4, { fill: '#d6eaf8', stroke: '#5d6d7e', fop: 0.6 }, { fill: '#d6eaf8', alpha: 0.3 });
        sc.rect(w / 2, -1.4, w / 2 + 0.12, 4, { fill: '#d6eaf8', stroke: '#5d6d7e', fop: 0.6 }, { fill: '#d6eaf8', alpha: 0.3 });
        if (hgt > 0) sc.rect(-w / 2, 0, w / 2, hgt, { fill: liq, stroke: 'none', fop: 0.8 }, { fill: liq, alpha: 0.6, z0: -w / 2, z1: w / 2 });
        else { sc.rect(-w / 2, -1.4, w / 2, hgt, { fill: liq, stroke: 'none', fop: 0.8 }, false); sc.rect(-w / 2, hgt, w / 2, 0, { fill: '#ffffff', stroke: 'none' }, false); }
        // meniscus
        const mz = hgt, sg = hgt >= 0 ? -1 : 1, pts = [];
        for (let i = 0; i <= 16; i++) { const x = -w / 2 + (w * i) / 16; pts.push([x, mz + sg * 0.15 * (1 - Math.pow((2 * x) / w, 2))]); }
        sc.pline(pts, { stroke: WATERD, sw: 2 });
        sc.dim([w / 2 + 0.12, 0], [w / 2 + 0.12, hgt], `h = ${f(g.h / u.lenF)} ${u.len}`, 34);
        sc.dim([-w / 2, 4.1], [w / 2, 4.1], g.geom === 'plates' ? 't' : g.geom === 'annulus' ? 'D₀ − Dᵢ' : 'd', 10);
        sc.text([-2.8, -2.2], `θ = ${f(g.th)}°`, { color: '#52606d' });
        sc.autoBounds(0.1); sc.depth = 0.8; return sc;
      }
      // chart-style topics: water, vlaw, visc → a beaker for 3D, chart in 2D
      sc.lathe([[0, 0], [0.9, 0], [0.9, 1.4], [0, 1.4]], 0, T === 'visc' || T === 'vlaw' ? OIL : WATER, 0.55);
      sc.lathe([[0.9, 0], [1, 0], [1, 2], [0.9, 2]], 0, '#d6eaf8', 0.25);
      sc.chart = true;
      sc.bounds = { xmin: 0, xmax: 1, ymin: 0, ymax: 1 };
      return sc;
    },

    draw2D(svg, res, U) {
      if (!res.ok) { root.M1.emptyMsg(svg, res); return; }
      const sc = this.scene(res, U);
      if (!sc.chart) { Scene.draw2D(svg, sc); return; }
      const D = root.UI.Draw2D(svg, { xmin: 0, xmax: 1, ymin: 0, ymax: 1 });
      const g = res.geo, u = Physics.PU[U.id], W = D.W, H = D.H;
      const box = [70, 50, Math.max(200, W - 130), Math.max(160, H - 130)];
      if (g.topic === 'water') {
        const pts = g.rows.map((r) => [r[0], r[3]]);
        Scene.chart(D, box, [{ pts, color: '#1F5FA8', marks: [[g.Tq, g.pv, `${f(g.Tq)} ${u.T}, p_v = ${f(g.pv)} ${g.pvUnit}`, '#c0392b']] }], { xl: `Temperature (${u.T})`, yl: `Vapour pressure p_v (${g.pvUnit})` });
        if (g.h2) D.text([box[0], box[1] - 26], `Depth ${f(g.h1)} → ${f(g.h2)} ${u.z}`, { px: true, size: 13, color: '#c0392b' });
      } else if (g.topic === 'vlaw') {
        Scene.chart(D, box, [{ pts: g.curve, color: '#1F5FA8', marks: g.pts.map((q, i) => [q[0], q[1], `reading ${i + 1}`, '#16a085']).concat([[g.q[0], g.q[1], `μ = ${f(g.q[1])}`, '#c0392b']]) }], { xl: `Temperature (${u.T})`, yl: `Viscosity μ (${u.mu})` });
      } else {
        // velocity profile sketch for viscosity units
        const x0 = box[0], y0 = box[1], w = Math.min(box[2], 420), h = Math.min(box[3], 240);
        D.el('rect', { x: x0, y: y0 + h, width: w, height: 10, fill: '#9aa3ad' });
        D.el('rect', { x: x0, y: y0 - 10, width: w, height: 10, fill: '#9aa3ad' });
        D.el('rect', { x: x0, y: y0, width: w, height: h, fill: OIL, 'fill-opacity': 0.35 });
        for (let i = 0; i <= 6; i++) { const yy = y0 + h - (h * i) / 6, L = (w * 0.7 * i) / 6; if (L > 4) D.arrow(D.inv(x0 + 10, yy), D.inv(x0 + 10 + L, yy), { color: '#1F5FA8', w: 1.6, head: 8 }); }
        D.text([x0 + w * 0.75, y0 - 18], 'V →', { px: true, size: 13 });
        D.text([x0 + w + 12, y0 + h / 2], 'τ = μ du/dy ,  ν = μ/ρ', { px: true, size: 13, color: '#34495e' });
        const r = res.out;
        r.slice(0, 8).forEach((o, i) => D.text([x0, y0 + h + 40 + i * 18], `${o.k} = ${f(o.v)} ${o.u}`, { px: true, size: 12, color: '#1d2733', weight: 500 }));
      }
    },

    draw3D(V, res, U) {
      if (!res.ok) return;
      Scene.draw3D(V, this.scene(res, U));
    },
  };
  root.MF = MF;
})(window);
