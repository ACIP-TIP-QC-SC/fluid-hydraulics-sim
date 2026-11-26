/* =====================================================================
 * MODULE — Drag, Lift & Boundary Layers (2026-11-25 book-coverage upgrade)
 * drag and lift on bodies, terminal velocity, airfoils and airplanes,
 * coasting against drag, flat-plate boundary layers.  Formulas: physDrag.js
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Physics, Scene } = root;
  const f = Physics.fmt;
  const PI = Math.PI, DEG = PI / 180;
  const WATER = '#4aa3df', WATERD = '#1f6fa8', STEEL = '#9aa3ad', AIR = '#d6eaf8', RED = '#c0392b', GREEN = '#16a085', INK = '#2c3e50', PURP = '#8e44ad', OIL = '#e0b84a';

  const DEF = {
    topic: 'body', fluid: 'air', T: 20, pa: 101.3, TE: 68, paE: 14.7, dBy: 'rho', rhoG: 1000, gamG: 9810, vBy: 'mu', muG: 0.001, nuG: 0.000001,
    // body
    shape: 'sphere', cdBy: 'corr', CD: 1, CL: 0, inc: 0, solve: 'F', V: 10, F: 10, P: 1, D: 100, Lb: 0, a: 1, b: 1, Dd: 1, Ab: 1, Lch: 0,
    // fall
    fshape: 'sphere', sBy: 'rho', rhos: 7800, SGs: 2.65, gams: 77000, ms: 0.5, Vt: 0.1, dir: 'down', W: 700,
    // wing
    clBy: 'lin', a1: 0, cl1: 0.35, a2: 6, cl2: 0.8, cdW: 'lin', CDw: 0.05, a3: 4, cd3: 0.04, a4: 14, cd4: 0.12, Aw: 28, alpha: 4, clMax: 0, chord: 0, CLw: 0.6,
    // coast
    M: 1500, V0: 30, V1: 20, tc: 60, cAb: 2, cCD: 0.3,
    // plate
    book: 'H', Recr: 500000, pshape: 'rect', Lp: 2, bp: 1, c1: 2, c2: 0, sides: '1', reg: 'auto', Vp: 5, Fp: 100, xp: 0, yp: 0, psolve: 'F',
  };
  const pr = (name, units, x) => ({ name, units, apply: (s) => Object.assign(s, JSON.parse(JSON.stringify(DEF)), x) });
  const GW = (gam) => ({ fluid: 'given', dBy: 'gam', gamG: gam });
  const GR = (rho, o) => Object.assign({ fluid: 'given', dBy: 'rho', rhoG: rho }, o || {});

  const MK = {
    id: 'mk', title: 'Drag, Lift & Boundary Layers',
    state: JSON.parse(JSON.stringify(DEF)),
    presets: [
      pr('Schaum 13.25 — 50 mph wind on a 6 ft × 8 ft sign, C_D 1.20 (362 lb)', 'EN', Object.assign(GW(0.0752), { shape: 'plateN', cdBy: 'given', CD: 1.2, a: 6, b: 8, V: 73.333 })),
      pr('Schaum 13.26 — 1.2 m square plate at 6.7 m/s through air, C_D 1.16 (45.1 N)', 'SI', Object.assign(GW(11.8), { shape: 'plateN', cdBy: 'given', CD: 1.16, a: 1.2, b: 1.2, V: 6.7 })),
      pr('Schaum 13.26 (b) — the same plate through water (37.5 kN)', 'SI', GR(1000, { vBy: 'mu', muG: 0.00111, shape: 'plateN', cdBy: 'given', CD: 1.16, a: 1.2, b: 1.2, V: 6.7 })),
      pr('Schaum 13.27 — 10 mm wire in a 27 m/s wind, chart C_D 1.30 (5.69 N per m)', 'SI', GR(1.2, { vBy: 'nu', nuG: 1.49e-5, shape: 'cyl', cdBy: 'given', CD: 1.3, D: 10, V: 27 })),
      pr('The same wire with C_D from the cylinder curve', 'SI', GR(1.2, { vBy: 'nu', nuG: 1.49e-5, shape: 'cyl', cdBy: 'corr', D: 10, V: 27 })),
      pr('Schaum 13.28 — 3 ft × 4 ft plate at 12°, C_D 0.17, C_L 0.72, 44 ft/s (R 20.0 lb, 0.369 hp)', 'EN', Object.assign(GW(0.0752), { shape: 'plateN', cdBy: 'given', CD: 0.17, CL: 0.72, inc: 12, a: 3, b: 4, V: 44 })),
      pr('Schaum 13.47 — 150 mm sphere held by 1.1 N in 20 °C air: speed (book reads C_D 0.56 off its chart: 13.6 m/s)', 'SI', { fluid: 'air', T: 20, pa: 101.3, shape: 'sphere', cdBy: 'corr', D: 150, solve: 'V', F: 1.1 }),
      pr('Car: drag coefficient from the power used at 60 mph', 'EN', Object.assign(GW(0.0763), { shape: 'any', cdBy: 'given', Ab: 20, solve: 'CDP', V: 88, P: 15 })),
      pr('Schaum 13.36 — 756 N parachutist, 5.5 m canopy, C_D 1.00 (7.27 m/s)', 'SI', Object.assign(GW(11.8), { topic: 'fall', fshape: 'any', W: 756, Ab: 23.758, CD: 1 })),
      pr('Schaum 13.37 — ⅛ in steel ball (0.284 lb/in³) in oil S 0.908, ν 0.00157 ft²/s (0.66 ft/s)', 'EN', { topic: 'fall', fluid: 'given', dBy: 'gam', gamG: 56.659, vBy: 'nu', nuG: 0.00157, D: 0.125, sBy: 'gam', gams: 490.75 }),
      pr('Schaum 13.38 — 25 mm lead sphere falls at 0.357 m/s in oil S 0.93: viscosity (9.75 Pa·s)', 'SI', { topic: 'fall', solve: 'mu', fluid: 'given', dBy: 'gam', gamG: 9104.7, D: 25, sBy: 'gam', gams: 111000, Vt: 0.357, cdBy: 'stokes' }),
      pr('Schaum 13.39 — 12.5 mm sphere rising at 0.037 m/s in oil: its specific weight (book 8.70 kN/m³ with chart C_D 3.9)', 'SI', GR(917, { topic: 'fall', solve: 'rhos', muG: 0.034, D: 12.5, Vt: 0.037, dir: 'up' })),
      pr('Hibbeler Example 11.12 — 0.5 kg, 100 mm ball in oil (book reads C_D 0.48 off its chart: 0.400 m/s)', 'SI', GR(900, { topic: 'fall', muG: 0.036, D: 100, sBy: 'm', ms: 0.5 })),
      pr("Silt grain 0.05 mm (S 2.65) settling in 20 °C water by Stokes' law", 'SI', { topic: 'fall', fluid: 'water', T: 20, D: 0.05, sBy: 'SG', SGs: 2.65, cdBy: 'stokes' }),
      pr('Schaum 13.29 — 17.8 kN plane, 28 m², 160 km/h: angle of attack (2.5°)', 'SI', Object.assign(GW(11.8), { topic: 'wing', solve: 'alpha', W: 17800, Aw: 28, V: 44.444, cdW: 'given', CDw: 0 })),
      pr('Schaum 13.30 — wing area for a 22.2 kN plane at 5°, 27 m/s (69.8 m²)', 'SI', Object.assign(GW(11.8), { topic: 'wing', solve: 'A', W: 22200, alpha: 5, V: 27, cdW: 'given', CDw: 0 })),
      pr('Schaum 13.31–13.32 — 400 ft² airfoil at 6°, 80 ft/s: drag power and lift (22.7 hp, 1950 lb)', 'EN', Object.assign(GW(0.0702), { topic: 'wing', solve: 'W', clBy: 'given', CLw: 0.7, cdW: 'lin', Aw: 400, alpha: 6, V: 80, chord: 5, vBy: 'mu', muG: 3.6e-7 })),
      pr('Schaum 13.33 — 25 m² wing at 26 m/s takes 10 kW: angle of attack (4.1°)', 'SI', Object.assign(GW(11.0), { topic: 'wing', solve: 'alphaP', cdW: 'lin', Aw: 25, V: 26, P: 10 })),
      pr('Hibbeler Example 11.11 — 2.3 Mg car coasts 11 → 10 m/s in 165 s: C_D (0.275)', 'SI', GR(1.23, { topic: 'coast', solve: 'CD', cAb: 0.75, M: 2300, V0: 11, V1: 10, tc: 165 })),
      pr('Schaum 13.43 — 4 ft square plate in 10 ft/s air, laminar, both sides (0.0099 lb)', 'EN', GR(0.0023354, { topic: 'plate', book: 'S', vBy: 'nu', nuG: 16e-5, Lp: 4, bp: 4, Vp: 10, sides: '2', reg: 'lam' })),
      pr('Schaum 13.44 — 10 ft × 4 ft plate at 4 ft/s in air: laminar drag, δ at mid-plate (0.00200 lb, 0.073 ft)', 'EN', GR(0.00237, { topic: 'plate', book: 'S', vBy: 'nu', nuG: 15.8e-5, Lp: 10, bp: 4, Vp: 4, reg: 'lam', xp: 5 })),
      pr('Schaum 13.44 (b) — the same plate taken turbulent all along (0.00464 lb)', 'EN', GR(0.00237, { topic: 'plate', book: 'S', vBy: 'nu', nuG: 15.8e-5, Lp: 10, bp: 4, Vp: 4, reg: 'turb' })),
      pr('Schaum 13.45 — 24.4 m × 1.2 m plate in water, drag 8.0 kN: speed (12.2 m/s, δ 0.206 m)', 'SI', GR(1000, { topic: 'plate', book: 'S', vBy: 'nu', nuG: 9.84e-7, Lp: 24.4, bp: 1.2, sides: '2', reg: 'turb', psolve: 'V', Fp: 8000 })),
      pr('Schaum 13.46 — the 10 ft plate in 50 °F water: laminar then turbulent (3.94 lb, x_c 1.76 ft)', 'EN', GR(1.94, { topic: 'plate', book: 'S', vBy: 'nu', nuG: 1.41e-5, Lp: 10, bp: 4, Vp: 4, sides: '2', reg: 'mix', xp: 1.76 })),
      pr('Hibbeler Example 11.1 — water at 0.25 m/s, 1 m plate: τ₀ and δ at the end (0.0415 Pa, 10 mm)', 'SI', GR(1000, { topic: 'plate', muG: 0.001, Lp: 1, bp: 1, Vp: 0.25 })),
      pr('Hibbeler Example 11.2 — ship at 0.2 m/s: δ at 1 m and u at δ/2 (11.7 mm, 0.150 m/s)', 'SI', GR(1000, { topic: 'plate', vBy: 'nu', nuG: 1.1e-6, Lp: 1, bp: 1, Vp: 0.2, xp: 1, yp: 0.005865 })),
      pr('Hibbeler Example 11.3 — air duct at 3 m/s: displacement thickness at 2 m (5.46 mm)', 'SI', GR(1.2, { topic: 'plate', muG: 18.1e-6, Lp: 2, bp: 1, Vp: 3 })),
      pr('Hibbeler Example 11.4 — triangular fin 2 ft × 2 ft at 3 ft/s, both sides (0.0948 lb)', 'EN', GR(1.94, { topic: 'plate', vBy: 'nu', nuG: 14.1e-6, pshape: 'trap', c1: 2, c2: 0, bp: 2, Vp: 3, sides: '2', reg: 'lam' })),
      pr('Hibbeler Example 11.6 — oil at 20 m/s on a 2 m plate: combined layer (1004 N, laminar 31.9 N)', 'SI', GR(890, { topic: 'plate', muG: 3.4e-3, Lp: 2, bp: 1, Vp: 20 })),
      pr('Hibbeler Example 11.7 — rough plate, turbulent: τ₀ and δ at x = 2 m (99.8 Pa, 25.6 mm)', 'SI', GR(1000, { topic: 'plate', muG: 0.001, Lp: 2, bp: 1, Vp: 10, reg: 'turb' })),
      pr('Hibbeler Example 11.8 — wing as a 6 ft × 18 ft plate at 300 ft/s, both sides (56.1 lb)', 'EN', GR(0.00204, { topic: 'plate', muG: 0.364e-6, Lp: 6, bp: 18, Vp: 300, sides: '2' })),
    ],

    controls(el, C) {
      const s = this.state, U = root.App.U(), u = Physics.dragUnits(U), SI = u.SI;
      const sl = (p, k, label, min, max, step, unit, o) => C.slider(p, Object.assign({ label, min, max, step, get: () => s[k], set: (v) => (s[k] = v), unit }, o || {}));
      C.select(el, { label: 'Problem', options: [['body', 'Drag and lift on a body'], ['fall', 'Terminal velocity (falling or rising)'], ['wing', 'Airfoils and airplanes'], ['coast', 'Vehicle coasting against drag'], ['plate', 'Boundary layer on a flat plate']], get: () => s.topic, set: (v) => (s.topic = v) });
      const T = s.topic;
      // fluid
      const fl = C.section(el, T === 'wing' || T === 'coast' ? 'Air' : 'Fluid');
      const viscNeeded = !(T === 'coast' || T === 'wing' || (T === 'fall' && s.fshape === 'any'));
      const fopts = [['water', 'Water (table by temperature)'], ['air', 'Air (ideal gas)'], ['given', 'Given properties']];
      if (T === 'fall' && s.solve === 'mu') { s.fluid = 'given'; }
      C.select(fl, { label: 'Fluid', options: T === 'fall' && s.solve === 'mu' ? [['given', 'Given density (viscosity is the unknown)']] : fopts, get: () => s.fluid, set: (v) => (s.fluid = v) });
      if (s.fluid === 'water') sl(fl, SI ? 'T' : 'TE', 'Temperature', SI ? 0 : 32, SI ? 100 : 212, 0.1, u.T);
      else if (s.fluid === 'air') { sl(fl, SI ? 'T' : 'TE', 'Temperature', SI ? -50 : -60, SI ? 200 : 400, 0.1, u.T); sl(fl, SI ? 'pa' : 'paE', 'Absolute pressure', SI ? 1 : 0.2, SI ? 5000 : 700, 0.01, u.pa); }
      else {
        C.seg(fl, { label: 'Density given as', options: [['rho', 'ρ'], ['gam', 'γ (specific weight)']], get: () => s.dBy, set: (v) => (s.dBy = v) });
        if (s.dBy === 'rho') sl(fl, 'rhoG', 'Density ρ', SI ? 0.01 : 0.00001, SI ? 20000 : 40, SI ? 0.001 : 0.000001, u.rho); else sl(fl, 'gamG', 'Specific weight γ', SI ? 0.1 : 0.001, SI ? 200000 : 1000, 0.0001, u.gam);
        if (viscNeeded || T === 'wing') {
          if (!(T === 'fall' && s.solve === 'mu')) {
            C.seg(fl, { label: 'Viscosity given as', options: [['mu', 'μ (dynamic)'], ['nu', 'ν (kinematic)']], get: () => s.vBy, set: (v) => (s.vBy = v) });
            if (s.vBy === 'mu') sl(fl, 'muG', 'Dynamic viscosity μ' + (T === 'wing' ? ' (0 = skip Re)' : ''), 0, SI ? 50 : 1, 1e-9, u.mu); else sl(fl, 'nuG', 'Kinematic viscosity ν', 0, SI ? 0.1 : 1, 1e-10, u.nu);
          }
        }
      }
      if (T === 'body') {
        const g = C.section(el, 'Body');
        C.select(g, { label: 'Shape', options: [['sphere', 'Sphere'], ['cyl', 'Long cylinder (axis across the flow)'], ['plateN', 'Rectangular plate facing the flow'], ['disk', 'Circular disk facing the flow'], ['any', 'Any body (projected area and C_D given)']], get: () => s.shape, set: (v) => (s.shape = v) });
        if (s.shape === 'sphere' || s.shape === 'cyl') sl(g, 'D', 'Diameter D', 0.001, SI ? 20000 : 600, 0.001, u.du);
        if (s.shape === 'cyl') sl(g, 'Lb', 'Length (0 = per unit length)', 0, SI ? 1000 : 3000, 0.001, u.L);
        if (s.shape === 'plateN') { sl(g, 'a', 'Width a', 0.001, SI ? 100 : 300, 0.001, u.L); sl(g, 'b', 'Height b', 0.001, SI ? 100 : 300, 0.001, u.L); }
        if (s.shape === 'disk') sl(g, 'Dd', 'Disk diameter', 0.001, SI ? 100 : 300, 0.001, u.L);
        if (s.shape === 'any') { sl(g, 'Ab', 'Projected area A', 0.0001, SI ? 1000 : 10000, 0.0001, u.A); sl(g, 'Lch', 'Length for Re (0 = skip)', 0, SI ? 100 : 300, 0.001, u.L); }
        const canCorr = s.shape === 'sphere' || s.shape === 'cyl';
        if (!canCorr && s.cdBy !== 'given') s.cdBy = 'given';
        if (canCorr) C.seg(g, { label: 'Drag coefficient', options: [['corr', 'From Re (curve)'], ['stokes', 'Stokes 24/Re'], ['given', 'Given']], get: () => s.cdBy, set: (v) => (s.cdBy = v) });
        if (s.shape === 'cyl' && s.cdBy === 'stokes') s.cdBy = 'corr';
        const so = [['F', 'Drag (and lift) at a speed'], ['V', 'Speed for a drag force'], ['VP', 'Speed for a power'], ['CD', 'C_D from a measured drag'], ['CDP', 'C_D from the power used']];
        if (!so.some((o) => o[0] === s.solve)) s.solve = 'F';
        const m = C.section(el, 'Motion');
        C.select(m, { label: 'Solve for', options: so, get: () => s.solve, set: (v) => (s.solve = v) });
        if (s.cdBy === 'given' && s.solve !== 'CD' && s.solve !== 'CDP') sl(g, 'CD', 'Drag coefficient C_D', 0.001, 50, 0.001, '');
        if (s.solve !== 'V' && s.solve !== 'VP') sl(m, 'V', 'Relative speed V', 0.0001, SI ? 1000 : 3000, 0.001, u.v);
        if (s.solve === 'V' || s.solve === 'CD') sl(m, 'F', 'Drag force F_D', 0.000001, 1e8, 0.000001, u.F);
        if (s.solve === 'VP' || s.solve === 'CDP') sl(m, 'P', 'Power', 0.00001, 1e6, 0.00001, u.Pu);
        const l = C.section(el, 'Lift (optional)');
        sl(l, 'CL', 'Lift coefficient C_L (0 = none)', 0, 5, 0.001, '');
        if (s.CL > 0) sl(l, 'inc', 'Angle of the plate to the wind α (0 = skip)', 0, 90, 0.1, '°');
      } else if (T === 'fall') {
        const g = C.section(el, 'Body');
        C.seg(g, { label: 'Body', options: [['sphere', 'Sphere'], ['any', 'Any body (W, A, C_D)']], get: () => s.fshape, set: (v) => (s.fshape = v) });
        if (s.fshape === 'any') {
          sl(g, 'W', 'Net weight W', 0.0001, 1e7, 0.0001, u.F); sl(g, 'Ab', 'Projected area A', 0.0001, SI ? 1000 : 10000, 0.0001, u.A); sl(g, 'CD', 'Drag coefficient C_D', 0.001, 50, 0.001, '');
          C.note(g, 'For a parachute or another body whose C_D is known. For a sphere, choose Sphere to include buoyancy and C_D from Re.');
        } else {
          const so = [['V', 'Terminal velocity'], ['mu', 'Fluid viscosity from an observed velocity'], ['rhos', 'Particle density from an observed velocity'], ['D', 'Size for a terminal velocity']];
          if (!so.some((o) => o[0] === s.solve)) s.solve = 'V';
          C.select(g, { label: 'Solve for', options: so, get: () => s.solve, set: (v) => (s.solve = v) });
          if (s.solve !== 'D') sl(g, 'D', 'Diameter D', 0.0001, SI ? 5000 : 200, 0.0001, u.du);
          if (s.solve !== 'rhos') {
            C.select(g, { label: 'Particle given by', options: [['rho', 'Density ρ_s'], ['SG', 'Specific gravity'], ['gam', 'Specific weight γ_s'], ['m', 'Mass']], get: () => s.sBy, set: (v) => (s.sBy = v) });
            if (s.sBy === 'rho') sl(g, 'rhos', 'Particle density ρ_s', 0.0001, SI ? 30000 : 60, 0.0001, u.rho);
            if (s.sBy === 'SG') sl(g, 'SGs', 'Specific gravity', 0.001, 30, 0.001, '');
            if (s.sBy === 'gam') sl(g, 'gams', 'Specific weight γ_s', 0.01, SI ? 300000 : 2000, 0.01, u.gam);
            if (s.sBy === 'm') sl(g, 'ms', 'Mass', 1e-9, 1e5, 1e-9, u.m);
          }
          if (s.solve !== 'V') sl(g, 'Vt', s.solve === 'D' ? 'Terminal velocity wanted' : 'Observed terminal velocity', 1e-7, SI ? 300 : 1000, 1e-7, u.v);
          if (s.solve === 'rhos') C.seg(g, { label: 'The particle', options: [['down', 'falls'], ['up', 'rises']], get: () => s.dir, set: (v) => (s.dir = v) });
          const cd = C.section(el, 'Drag coefficient');
          const opts = s.solve === 'mu' ? [['corr', 'From Re (sphere curve)'], ['stokes', "Stokes' law (Re < 1)"]] : [['corr', 'From Re (sphere curve)'], ['stokes', "Stokes' law (Re < 1)"], ['given', 'Given']];
          if (!opts.some((o) => o[0] === s.cdBy)) s.cdBy = 'corr';
          C.seg(cd, { options: opts, get: () => s.cdBy, set: (v) => (s.cdBy = v) });
          if (s.cdBy === 'given') sl(cd, 'CD', 'Drag coefficient C_D', 0.001, 1000, 0.001, '');
        }
      } else if (T === 'wing') {
        const g = C.section(el, 'Wing');
        const so = [['V', 'Speed to carry the weight'], ['A', 'Wing area to carry the weight'], ['alpha', 'Angle of attack to carry the weight'], ['alphaP', 'Angle of attack from the power used'], ['W', 'Lift, drag and power at a speed and angle']];
        if (!so.some((o) => o[0] === s.solve)) s.solve = 'V';
        C.select(g, { label: 'Solve for', options: so, get: () => s.solve, set: (v) => (s.solve = v) });
        if (s.solve === 'V' || s.solve === 'A' || s.solve === 'alpha') sl(g, 'W', 'Weight W', 0.01, 1e8, 0.01, u.F);
        if (s.solve !== 'A') sl(g, 'Aw', 'Wing area A', 0.001, SI ? 2000 : 20000, 0.001, u.A);
        if (s.solve !== 'V') sl(g, 'V', 'Speed V', 0.01, SI ? 400 : 1300, 0.001, u.v);
        if (s.solve === 'alphaP') sl(g, 'P', 'Power used', 0.0001, 1e6, 0.0001, u.Pu);
        if (s.solve !== 'alpha' && s.solve !== 'alphaP') sl(g, 'alpha', 'Angle of attack α', -10, 30, 0.01, '°');
        sl(g, 'chord', 'Chord for Re (0 = skip)', 0, SI ? 50 : 150, 0.001, u.L);
        sl(g, 'clMax', 'Maximum C_L for the stall speed (0 = skip)', 0, 4, 0.001, '');
        const c = C.section(el, 'Lift coefficient');
        C.seg(c, { options: [['lin', 'Linear in α'], ['given', 'Given'], ['thin', '2π sin α']], get: () => s.clBy, set: (v) => (s.clBy = v) });
        if (s.clBy === 'lin') { sl(c, 'a1', 'α₁', -10, 30, 0.01, '°'); sl(c, 'cl1', 'C_L at α₁', -2, 4, 0.0001, ''); sl(c, 'a2', 'α₂', -10, 30, 0.01, '°'); sl(c, 'cl2', 'C_L at α₂', -2, 4, 0.0001, ''); }
        if (s.clBy === 'given') sl(c, 'CLw', 'Lift coefficient C_L', 0, 4, 0.0001, '');
        const d = C.section(el, 'Drag coefficient');
        C.seg(d, { options: [['lin', 'Linear in α'], ['given', 'Given (0 = skip)']], get: () => s.cdW, set: (v) => (s.cdW = v) });
        if (s.cdW === 'lin') { sl(d, 'a3', 'α₃', -10, 30, 0.01, '°'); sl(d, 'cd3', 'C_D at α₃', 0, 2, 0.0001, ''); sl(d, 'a4', 'α₄', -10, 30, 0.01, '°'); sl(d, 'cd4', 'C_D at α₄', 0, 2, 0.0001, ''); }
        else sl(d, 'CDw', 'Drag coefficient C_D', 0, 2, 0.0001, '');
      } else if (T === 'coast') {
        const g = C.section(el, 'Vehicle');
        const so = [['CD', 'C_D from the slowing down'], ['V', 'Speed after a time'], ['t', 'Time to slow to a speed']];
        if (!so.some((o) => o[0] === s.solve)) s.solve = 'CD';
        C.select(g, { label: 'Solve for', options: so, get: () => s.solve, set: (v) => (s.solve = v) });
        sl(g, 'M', 'Mass m', 0.001, 1e7, 0.001, u.m); sl(g, 'cAb', 'Projected front area A', 0.0001, SI ? 200 : 2000, 0.0001, u.A);
        sl(g, 'V0', 'Starting speed V₀', 0.001, SI ? 400 : 1300, 0.001, u.v);
        if (s.solve !== 'V') sl(g, 'V1', 'Later speed V', 0.001, SI ? 400 : 1300, 0.001, u.v);
        if (s.solve !== 't') sl(g, 'tc', 'Time t', 0, 1e5, 0.01, 's');
        if (s.solve !== 'CD') sl(g, 'cCD', 'Drag coefficient C_D', 0.001, 3, 0.0001, '');
      } else if (T === 'plate') {
        const g = C.section(el, 'Plate');
        C.seg(g, { label: 'Plate shape', options: [['rect', 'Rectangle'], ['trap', 'Trapezoid / triangle (chord varies)']], get: () => s.pshape, set: (v) => (s.pshape = v) });
        if (s.pshape === 'rect') { sl(g, 'Lp', 'Length L along the flow', 0.0001, SI ? 500 : 1500, 0.0001, u.L); sl(g, 'bp', 'Width b', 0.0001, SI ? 500 : 1500, 0.0001, u.L); }
        else { sl(g, 'c1', 'Chord along the flow at one end', 0, SI ? 100 : 300, 0.0001, u.L); sl(g, 'c2', 'Chord at the other end', 0, SI ? 100 : 300, 0.0001, u.L); sl(g, 'bp', 'Span between them', 0.0001, SI ? 500 : 1500, 0.0001, u.L); }
        C.seg(g, { label: 'Sides wetted', options: [['1', 'One'], ['2', 'Both']], get: () => s.sides, set: (v) => (s.sides = v) });
        const b = C.section(el, 'Boundary layer');
        C.select(b, { label: 'Layer', options: [['auto', 'Laminar, turning turbulent at Re_cr'], ['lam', 'Laminar all along'], ['turb', 'Turbulent from the leading edge'], ['mix', 'Laminar then turbulent (forced)']], get: () => s.reg, set: (v) => (s.reg = v) });
        C.seg(b, { label: 'Formulas from', options: [['H', 'Hibbeler'], ['S', "Schaum's"]], get: () => s.book, set: (v) => (s.book = v) });
        sl(b, 'Recr', 'Critical Reynolds number Re_cr', 1e4, 5e6, 1000, '');
        const m = C.section(el, 'Flow');
        C.seg(m, { label: 'Solve for', options: [['F', 'Drag at a speed'], ['V', 'Speed from the drag']], get: () => s.psolve, set: (v) => (s.psolve = v) });
        if (s.psolve === 'F') sl(m, 'Vp', 'Free-stream speed U', 0.00001, SI ? 500 : 1500, 0.00001, u.v); else sl(m, 'Fp', 'Friction drag F_D', 1e-7, 1e8, 1e-7, u.F);
        const x = C.section(el, 'Point in the layer');
        sl(x, 'xp', 'Distance x from the leading edge (0 = trailing edge)', 0, SI ? 500 : 1500, 0.0001, u.L);
        sl(x, 'yp', 'Height y above the plate for u (0 = skip)', 0, SI ? 5 : 15, 0.000001, u.L);
      }
    },

    compute(U) {
      const s = this.state, p = Object.assign({}, s);
      if (s.topic === 'wing') { p.CL = s.CLw; }
      if (s.topic === 'coast') { p.Ab = s.cAb; p.CD = s.cCD; }
      if (s.topic === 'plate') { p.V = s.Vp; p.F = s.Fp; p.solve = s.psolve; }
      if (s.topic === 'fall' && s.solve === 'mu') p.fluid = 'given';
      return Physics.dragLift(p, U);
    },

    scene(res, U) {
      const g = res.geo, u = Physics.dragUnits(U), sc = Scene.Scene();
      sc.depth = 0.8;
      const flowArrows = (x0, ys, len, lab) => { ys.forEach((y, i) => sc.arrow([x0, y], [x0 + len, y], { color: WATERD, label: i === 0 ? lab : undefined })); };
      if (g.kind === 'body') {
        flowArrows(-4.2, [1.1, 0, -1.1], 1.3, `V = ${f(g.V)} ${u.v}`);
        if (g.shape === 'sphere') sc.circle([0, 0], 1, { fill: STEEL, stroke: INK, sw: 2 }, 'sphere', STEEL);
        else if (g.shape === 'cyl') { sc.circle([0, 0], 1, { fill: STEEL, stroke: INK, sw: 2 }, 'disc', STEEL); sc.text([-0.9, -1.45], g.per ? 'per unit length' : 'cylinder end view', { size: 11, color: '#7f8c8d' }); }
        else if (g.shape === 'plateN' || g.shape === 'disk') {
          const a = (90 - (g.inc > 0 ? g.inc : 90)) * DEG, c = Math.cos(a + PI / 2), s2 = Math.sin(a + PI / 2), hl = 1.3, t = 0.09;
          const P = (al, n) => [c * al + Math.cos(a) * n, s2 * al + Math.sin(a) * n];
          sc.poly([P(-hl, -t), P(hl, -t), P(hl, t), P(-hl, t)], { fill: STEEL, stroke: INK, sw: 1.5 }, { fill: STEEL, alpha: 0.9 });
          if (g.inc > 0 && g.inc < 90) {
            // angle at the trailing end: plate extended (dashed) against the horizontal flow direction
            const E = P(-hl, 0), ex = [E[0] - c * 0.9, E[1] - s2 * 0.9];
            sc.line(E, ex, { stroke: '#95a5a6', sw: 1, dash: '5 4', no3: true }); sc.line(E, [E[0] + 1.0, E[1]], { stroke: '#95a5a6', sw: 1, dash: '5 4', no3: true });
            sc.add({ t: 'arc', c: E, r: 48, a0: -g.inc, a1: 0, s: `α = ${f(g.inc)}°`, only2d: true });
          }
        } else sc.poly([[-1.2, -0.5], [0.2, -0.75], [1.3, -0.3], [1.3, 0.3], [0.2, 0.75], [-1.2, 0.5], [-1.4, 0]], { fill: STEEL, stroke: INK, sw: 2 }, { fill: STEEL, alpha: 0.9 });
        sc.arrow([1.25, 0], [2.85, 0], { color: RED, label: `F_D = ${f(g.FD)} ${u.F}`, w: 3.5, lp: 'head', ldy: 16 });
        if (g.FL > 0) sc.arrow([0, 1.15], [0, 2.6], { color: PURP, label: `F_L = ${f(g.FL)} ${u.F}`, w: 3.5, lp: 'head', ldx: 8 });
        sc.text([-1.6, -2.1], `C_D = ${f(g.CD)}` + (isFinite(g.Re) ? `,  Re = ${f(g.Re)}` : ''), { size: 12, in3: true });
        sc.autoBounds(0.1); sc.padR = 120; return sc;
      }
      if (g.kind === 'fall') {
        if (g.any) {
          const pts = []; for (let i = 0; i <= 24; i++) { const a = PI * (i / 24); pts.push([1.6 * Math.cos(a), 1.2 + 0.8 * Math.sin(a)]); }
          sc.poly(pts.concat([[-1.6, 1.2]]), { fill: '#f5b041', stroke: INK, sw: 1.5 }, { fill: '#f5b041', alpha: 0.85 });
          sc.line([-1.6, 1.2], [0, -0.6], { stroke: INK, sw: 1 }); sc.line([1.6, 1.2], [0, -0.6], { stroke: INK, sw: 1 });
          sc.circle([0, -0.8], 0.22, { fill: INK, stroke: INK }, 'sphere', INK);
          sc.arrow([0, -1.1], [0, -2.6], { color: INK, label: `W = ${f(g.W)} ${u.F}`, w: 3, lp: 'head', ldx: 8 });
          sc.arrow([0, 2.1], [0, 3.4], { color: RED, label: `F_D = ${f(g.FD)} ${u.F}`, w: 3, lp: 'head', ldx: 8 });
          sc.arrow([2.4, 1.4], [2.4, -0.2], { color: GREEN, label: `V = ${f(g.V)} ${u.v}`, ldx: 8 });
          sc.autoBounds(0.1); sc.padR = 120; return sc;
        }
        sc.rect(-2, -3, 2, 3, { fill: OIL, stroke: 'none', fop: 0.35 }, false);
        sc.line([-2, -3], [-2, 3.3], { stroke: INK, sw: 3 }); sc.line([2, -3], [2, 3.3], { stroke: INK, sw: 3 }); sc.line([-2, -3], [2, -3], { stroke: INK, sw: 3 });
        sc.circle([0, 0], 0.45, { fill: STEEL, stroke: INK, sw: 2 }, 'sphere', STEEL);
        const dn = !g.up;
        sc.arrow([0, dn ? 0.55 : -0.55], [0, dn ? 2.0 : -2.0], { color: RED, label: `F_D = ${f(g.FD)} ${u.F}`, w: 3, lp: 'head', ldx: 8 });
        sc.arrow([0.9, dn ? 1.0 : -1.0], [0.9, dn ? -1.0 : 1.0], { color: GREEN, label: `V = ${f(g.V)} ${u.v}`, ldx: 8 });
        if (g.W > 0) { sc.arrow([-0.7, -0.3], [-0.7, -1.7], { color: INK, label: `W = ${f(g.W)} ${u.F}`, lp: 'head', anchor: 'end', ldx: -6 }); sc.arrow([-1.2, 0.3], [-1.2, 1.7], { color: '#2980b9', label: g.FB > 0 ? `F_B = ${f(g.FB)} ${u.F}` : 'F_B', lp: 'head', anchor: 'end', ldx: -6 }); }
        else sc.arrow([-0.9, dn ? -0.3 : 0.3], [-0.9, dn ? -1.9 : 1.9], { color: INK, label: `${dn ? 'W − F_B' : 'F_B − W'} = ${f(g.FD)} ${u.F}`, lp: 'head', anchor: 'end', ldx: -6 });
        sc.text([0.5, -2.7], 'terminal velocity: forces balance', { size: 11, color: '#7f8c8d' });
        sc.text([-1.8, -3.5], `D = ${f(g.D / u.dF)} ${u.du}`, { size: 12, in3: true });
        sc.autoBounds(0.1); sc.padR = 120; return sc;
      }
      if (g.kind === 'wing') {
        const al = (isFinite(g.al) ? g.al : 0) * DEG, c = Math.cos(-al), s2 = Math.sin(-al);
        const prof = []; for (let i = 0; i <= 30; i++) { const x = i / 30, t = 0.12 * 5 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4); prof.push([x, t]); }
        const pts = prof.map(([x, t]) => [x, t + 0.04 * Math.sin(PI * x)]).concat(prof.slice().reverse().map(([x, t]) => [x, -t * 0.6 + 0.04 * Math.sin(PI * x)]));
        const R = ([x, y]) => [(x - 0.35) * 3.2 * c - y * 3.2 * s2, (x - 0.35) * 3.2 * s2 + y * 3.2 * c];
        sc.poly(pts.map(R), { fill: STEEL, stroke: INK, sw: 2 }, { fill: STEEL, alpha: 0.9 });
        flowArrows(-4.4, [0.9, 0, -0.9], 1.3, `V = ${f(g.V)} ${u.v}`);
        sc.arrow([0, 0.5], [0, 2.3], { color: PURP, label: `F_L = ${f(g.FL)} ${u.F}`, w: 3.5, lp: 'head', ldx: 8 });
        if (g.FD > 0) sc.arrow([2.1, 0], [3.4, 0], { color: RED, label: `F_D = ${f(g.FD)} ${u.F}`, w: 3.5, lp: 'head', ldy: 16 });
        sc.line([-1.2, 0], [2.0, 0], { stroke: '#95a5a6', sw: 1, dash: '5 4' });
        { const le = R([0, 0]), te = R([1, 0]), ux = (te[0] - le[0]), uy = (te[1] - le[1]), L = Math.hypot(ux, uy);
          sc.line(le, [te[0] + (ux / L) * 0.8, te[1] + (uy / L) * 0.8], { stroke: '#95a5a6', sw: 1, dash: '2 3', no3: true });
          if (Math.abs(g.al) > 0.05) sc.add({ t: 'arc', c: le, r: 150, a0: -g.al, a1: 0, s: `α = ${f(g.al)}° (chord vs flow)`, only2d: true }); }
        sc.add({ t: 'text', p: [-1.0, -1.1], s: `α = ${f(g.al)}°`, o: { size: 12, in3: true }, only3d: true });
        sc.autoBounds(0.1); sc.padR = 120; return sc;
      }
      if (g.kind === 'coast') {
        sc.poly([[-2, -0.4], [2, -0.4], [2, 0.3], [1.0, 0.45], [0.3, 1.0], [-1.2, 1.0], [-2, 0.3]], { fill: '#d35400', stroke: INK, sw: 2 }, { fill: '#d35400', alpha: 0.85 });
        sc.circle([-1.2, -0.5], 0.35, { fill: INK, stroke: INK }, 'disc', INK); sc.circle([1.2, -0.5], 0.35, { fill: INK, stroke: INK }, 'disc', INK);
        sc.line([-4, -0.85], [4, -0.85], { stroke: INK, sw: 2 });
        sc.arrow([2.2, 1.4], [3.6, 1.4], { color: GREEN, label: `V₀ = ${f(g.V0)} → ${f(g.V)} ${u.v}` });
        sc.arrow([3.6, 0.2], [2.15, 0.2], { color: RED, label: `F_D = ${f(g.F0)} ${u.F} at V₀`, w: 3.5, lp: 'tail', anchor: 'start', ldx: 6 });
        sc.dim([-2, -1.4], [2, -1.4], `t = ${f(g.t)} s,  x = ${f(g.x)} ${u.L}`, 18);
        sc.autoBounds(0.1); sc.padR = 160; return sc;
      }
      if (g.kind === 'plate') {
        const Lw = 7, sx = Lw / g.L, dmax = Math.max(...g.prof.map((q) => q[1]), 1e-12), sy = 1.6 / dmax;
        sc.rect(0, -0.12, Lw, 0, { fill: STEEL, stroke: INK, sw: 1.5 }, { fill: STEEL, alpha: 0.9 });
        sc.pline(g.prof.map(([x, d]) => [x * sx, d * sy]), { stroke: WATERD, sw: 2.5 });
        flowArrows(-1.8, [1.8, 1.0, 0.25], 1.2, `U = ${f(g.V)} ${u.v}`);
        if (g.xcr > 0 && g.xcr < g.L) { sc.line([g.xcr * sx, 0], [g.xcr * sx, 2.0], { stroke: '#e67e22', sw: 1.2, dash: '5 4' }); sc.text([g.xcr * sx + 0.08, 2.15], `x_cr = ${f(g.xcr)} ${u.L}`, { size: 11, color: '#e67e22' }); }
        const xp = Math.min(g.x, g.L) * sx;
        sc.line([xp, 0], [xp, g.dl * sy], { stroke: RED, sw: 2 });
        sc.text([xp + 0.1, g.dl * sy + 0.25], `δ = ${f(g.dl)} ${u.L}`, { size: 12, color: RED });
        sc.dim([0, -0.12], [Lw, -0.12], g.trap ? `chord ${f(g.c1)} → ${f(g.c2)} ${u.L}` : `L = ${f(g.L)} ${u.L}`, -22);
        sc.text([0, -1.5], `F_D = ${f(g.FD)} ${u.F} (${g.sides === 2 ? 'both sides' : 'one side'});  δ drawn to an exaggerated scale`, { size: 11, color: '#7f8c8d', in3: true });
        sc.autoBounds(0.06); sc.padR = 110; return sc;
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
  root.MK = MK;
})(window);
