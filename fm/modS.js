/* =====================================================================
 * MODULE — Similitude & Model Laws (2026-11-25 book-coverage upgrade)
 * Reynolds, Froude, Weber and Mach model laws, Reynolds + Froude together,
 * scale ratios and model ↔ prototype transfer.  Formulas: physDrag.js
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Physics, Scene } = root;
  const f = Physics.fmt;
  const WATER = '#4aa3df', WATERD = '#1f6fa8', STEEL = '#9aa3ad', RED = '#c0392b', GREEN = '#16a085', INK = '#2c3e50';

  const FL = (pre, o) => { const r = {}; const d = Object.assign({ fluid: 'water', T: 20, pa: 101.3, TE: 68, paE: 14.7, dBy: 'rho', rhoG: 1000, gamG: 9810, vBy: 'nu', muG: 0.001, nuG: 0.000001 }, o || {}); for (const k in d) r[pre + k] = d[k]; return r; };
  const DEF = Object.assign({
    law: 'Fr', unk: 'V', lBy: 'n', n: 25, Lm: 1, Lp: 25, Lpx: 0, side: 'p', V: 5, Vm: 1, Vp: 1,
    Qk: 0, Fk: 0, Pk: 0, tk: 0, tu: 's', hk: 0, pk: 0, sigm: 0.0728, sigp: 0.0728, cm: 343, cp: 343,
  }, FL('m'), FL('p'));
  const pr = (name, units, x) => ({ name, units, apply: (s) => Object.assign(s, JSON.parse(JSON.stringify(DEF)), x) });
  const GN = (pre, rho, nu) => FL(pre, { fluid: 'given', dBy: 'rho', rhoG: rho, vBy: 'nu', nuG: nu });

  const MS = {
    id: 'ms', title: 'Similitude & Model Laws',
    state: JSON.parse(JSON.stringify(DEF)),
    presets: [
      pr('Schaum 6.29 — 140 m ship at 7.6 m/s, 1:30 model: Froude number and model speed (0.205, 1.39 m/s)', 'SI', { law: 'Fr', n: 30, side: 'p', V: 7.6, Lpx: 140 }),
      pr('Schaum 6.51 — 1:36 spillway model, 0.381 m/s and 0.0708 m³/s (2.29 m/s, 550 m³/s)', 'SI', { law: 'Fr', n: 36, side: 'm', V: 0.381, Qk: 0.0708 }),
      pr('Schaum 6.30 — 1:25 spillway: 0.70 cfs and 0.15 hp in the model (2188 cfs, 11 700 hp)', 'EN', Object.assign({ law: 'Fr', n: 25, side: 'm', V: 0, Qk: 0.7, Pk: 0.15 }, FL('m', { fluid: 'given', rhoG: 1.94 }), FL('p', { fluid: 'given', rhoG: 1.94 }))),
      pr('Schaum 6.31 — 1:225 reservoir model drains in 4 min (60 min)', 'SI', { law: 'Fr', n: 225, side: 'm', V: 0, tk: 4, tu: 'min' }),
      pr('Schaum 6.32 — 1:16 pier model, 0.76 m/s, 4.0 N, 49 mm wave (3.04 m/s, 16.4 kN, 0.784 m)', 'SI', { law: 'Fr', n: 16, side: 'm', V: 0.76, Fk: 4, hk: 0.049 }),
      pr('Schaum 6.33 — 8 ft model at 6.50 ft/s, 9.60 lb in fresh water; 128 ft ship in salt water (26.0 ft/s, 40 330 lb)', 'EN', Object.assign({ law: 'Fr', lBy: 'L', Lm: 8, Lp: 128, side: 'm', V: 6.5, Fk: 9.6 }, FL('m', { fluid: 'given', rhoG: 1.94 }), FL('p', { fluid: 'given', rhoG: 1.99 }))),
      pr('Schaum 6.53 — oil in a 6 in pipe at 12 ft/s; water in a 12 in pipe (1.20 ft/s)', 'EN', Object.assign({ law: 'Re', lBy: 'L', Lm: 12, Lp: 6, side: 'p', V: 12 }, GN('m', 1.94, 1.217e-5), GN('p', 1.8, 6.09e-5))),
      pr('Schaum 6.56 — model in 68 °F air at 90 ft/s; same model in 60 °F water (6.84 ft/s)', 'EN', Object.assign({ law: 'Re', lBy: 'n', n: 1, side: 'p', V: 90 }, GN('m', 1.94, 1.217e-5), GN('p', 0.00233, 16e-5))),
      pr('Schaum 6.59 — 1:5 model in a wind tunnel feels 4.5 lb; prototype in 60 °F water (21.7 lb)', 'EN', Object.assign({ law: 'Re', n: 5, side: 'm', V: 0, Fk: 4.5 }, GN('m', 0.00233, 16e-5), GN('p', 1.94, 1.217e-5))),
      pr('Schaum 6.28 — 3 in wing model at 108 mph for a 3 ft wing at 90 mph: tunnel pressure (10 atm)', 'EN', Object.assign({ law: 'Re', unk: 'nu', lBy: 'L', Lm: 3, Lp: 36, Vm: 108, Vp: 90 }, GN('m', 0.00233, 16e-5), GN('p', 0.00233, 16e-5))),
      pr('Schaum 6.21 — 1:5 model, Reynolds and Froude both: model liquid viscosity (4.16 × 10⁻⁶ m²/s)', 'SI', Object.assign({ law: 'ReFr', unk: 'nu', n: 5, V: 0 }, FL('m', { fluid: 'given', rhoG: 900 }), GN('p', 900, 4.65e-5))),
      pr('Schaum 6.34 — oils of ν 9.29 and 74.3 × 10⁻⁵ m²/s, Reynolds and Froude both: scale (1:4)', 'SI', Object.assign({ law: 'ReFr', unk: 'L', V: 0 }, GN('m', 900, 9.29e-5), GN('p', 900, 74.3e-5))),
      pr('Water droplets: 1:4 model with surface tension dominant (Weber)', 'SI', { law: 'We', n: 4, side: 'p', V: 2, sigm: 0.0728, sigp: 0.0728 }),
    ],

    controls(el, C) {
      const s = this.state, U = root.App.U(), u = Physics.dragUnits(U), SI = u.SI;
      const sl = (p, k, label, min, max, step, unit, o) => C.slider(p, Object.assign({ label, min, max, step, get: () => s[k], set: (v) => (s[k] = v), unit }, o || {}));
      const g = C.section(el, 'Model law');
      C.select(g, { label: 'Dominant force', options: [['Fr', 'Gravity: Froude law (open channels, ships, spillways)'], ['Re', 'Viscosity: Reynolds law (pipes, submerged bodies, wind tunnels)'], ['ReFr', 'Gravity and viscosity together'], ['We', 'Surface tension: Weber law'], ['Ma', 'Compressibility: Mach law']], get: () => s.law, set: (v) => (s.law = v) });
      const uo = s.law === 'Re' ? [['V', 'Speeds (and other quantities)'], ['L', 'Size of one of them'], ['nu', 'Viscosity of the model fluid']] : s.law === 'ReFr' ? [['nu', 'Viscosity of the model fluid'], ['L', 'Scale']] : [['V', 'Speeds (and other quantities)']];
      if (!uo.some((o) => o[0] === s.unk)) s.unk = uo[0][0];
      if (uo.length > 1) C.select(g, { label: 'Find', options: uo, get: () => s.unk, set: (v) => (s.unk = v) });
      const sc = C.section(el, 'Scale');
      const findL = s.unk === 'L';
      if (!(findL && s.law === 'ReFr')) {
        C.seg(sc, { label: 'Lengths given as', options: [['n', 'Scale 1 : n'], ['L', 'Model and prototype lengths']], get: () => s.lBy, set: (v) => (s.lBy = v) });
        if (s.lBy === 'n') { if (!findL) sl(sc, 'n', 'n = prototype ÷ model', 0.0001, 10000, 0.0001, ''); sl(sc, 'Lpx', 'Prototype length for Re and Fr (0 = skip)', 0, SI ? 10000 : 30000, 0.001, u.L); }
        else { sl(sc, 'Lm', 'Model length L_m' + (findL ? ' (0 = unknown)' : ''), 0, SI ? 10000 : 30000, 0.0001, u.L); sl(sc, 'Lp', 'Prototype length L_p' + (findL ? ' (0 = unknown)' : ''), 0, SI ? 10000 : 30000, 0.0001, u.L); }
      }
      const fl = (pre, title) => {
        const sec = C.section(el, title), k = (n) => pre + n;
        C.select(sec, { label: 'Fluid', options: [['water', 'Water (table by temperature)'], ['air', 'Air (ideal gas)'], ['given', 'Given properties']], get: () => s[k('fluid')], set: (v) => (s[k('fluid')] = v) });
        if (s[k('fluid')] === 'water') sl(sec, k(SI ? 'T' : 'TE'), 'Temperature', SI ? 0 : 32, SI ? 100 : 212, 0.1, u.T);
        else if (s[k('fluid')] === 'air') { sl(sec, k(SI ? 'T' : 'TE'), 'Temperature', SI ? -50 : -60, SI ? 200 : 400, 0.1, u.T); sl(sec, k(SI ? 'pa' : 'paE'), 'Absolute pressure', SI ? 1 : 0.2, SI ? 5000 : 700, 0.01, u.pa); }
        else {
          sl(sec, k('rhoG'), 'Density ρ', SI ? 0.01 : 0.00001, SI ? 20000 : 40, SI ? 0.001 : 0.000001, u.rho);
          const skipNu = s.unk === 'nu' && pre === 'm';
          if (!skipNu) { C.seg(sec, { label: 'Viscosity given as', options: [['nu', 'ν (kinematic)'], ['mu', 'μ (dynamic)']], get: () => s[k('vBy')], set: (v) => (s[k('vBy')] = v) }); if (s[k('vBy')] === 'mu') sl(sec, k('muG'), 'Dynamic viscosity μ', 0, SI ? 50 : 1, 1e-9, u.mu); else sl(sec, k('nuG'), 'Kinematic viscosity ν', 0, SI ? 0.1 : 1, 1e-10, u.nu); }
          else C.note(sec, 'The model viscosity is the unknown.');
        }
        if (s.law === 'We') sl(sec, pre === 'm' ? 'sigm' : 'sigp', 'Surface tension σ', 0.0001, SI ? 1 : 0.1, 0.00001, u.sig);
        if (s.law === 'Ma') sl(sec, pre === 'm' ? 'cm' : 'cp', 'Speed of sound c', 1, SI ? 5000 : 16000, 0.01, u.v);
      };
      fl('m', 'Model fluid'); fl('p', 'Prototype fluid');
      const k = C.section(el, 'Known values');
      if (s.law === 'Re' && s.unk !== 'V') { sl(k, 'Vm', 'Model speed V_m', 0.0001, SI ? 1000 : 3000, 0.0001, u.v); sl(k, 'Vp', 'Prototype speed V_p', 0.0001, SI ? 1000 : 3000, 0.0001, u.v); }
      else {
        C.seg(k, { label: 'Values known on the', options: [['p', 'prototype'], ['m', 'model']], get: () => s.side, set: (v) => (s.side = v) });
        const sd = s.side === 'm' ? 'model' : 'prototype';
        sl(k, 'V', `Speed on the ${sd} (0 = none)`, 0, SI ? 1000 : 3000, 0.0001, u.v);
        sl(k, 'Qk', `Discharge on the ${sd} (0 = none)`, 0, 1e6, 0.00001, u.Q);
        sl(k, 'Fk', `Force on the ${sd} (0 = none)`, 0, 1e9, 0.00001, u.F);
        sl(k, 'Pk', `Power on the ${sd} (0 = none)`, 0, 1e7, 0.00001, u.Pu);
        sl(k, 'tk', `Time on the ${sd} (0 = none)`, 0, 1e6, 0.0001, s.tu);
        C.seg(k, { label: 'Time unit', options: [['s', 's'], ['min', 'min'], ['h', 'h']], get: () => s.tu, set: (v) => (s.tu = v) });
        sl(k, 'hk', `A length on the ${sd}, e.g. a wave height (0 = none)`, 0, 1e5, 0.0001, u.L);
        sl(k, 'pk', `Pressure on the ${sd} (0 = none)`, 0, 1e6, 0.0001, SI ? 'kPa' : 'psi');
      }
    },

    compute(U) { return Physics.similitude(Object.assign({}, this.state), U); },

    scene(res, U) {
      const g = res.geo, u = Physics.dragUnits(U), sc = Scene.Scene();
      sc.depth = 0.5;
      const ship = (x0, s, lab, V) => {
        sc.poly([[x0, 0], [x0 + 3 * s, 0], [x0 + 3.4 * s, 0.6 * s], [x0 - 0.2 * s, 0.6 * s]], { fill: STEEL, stroke: INK, sw: 1.5 }, { fill: STEEL, alpha: 0.9 });
        sc.poly([[x0 + 0.8 * s, 0.6 * s], [x0 + 2.0 * s, 0.6 * s], [x0 + 2.0 * s, 1.0 * s], [x0 + 0.8 * s, 1.0 * s]], { fill: '#ecf0f1', stroke: INK, sw: 1 }, { fill: '#ecf0f1', alpha: 0.9 });
        sc.text([x0, -0.55], lab, { size: 12, in3: true });
        if (isFinite(V) && V > 0) sc.arrow([x0 + 3.5 * s, 0.3 * s], [x0 + 3.5 * s + 1.0, 0.3 * s], { color: GREEN, label: `${lab === 'prototype' ? 'V_p' : 'V_m'} = ${f(V)} ${u.v}` });
      };
      sc.rect(-0.6, -0.2, 9.6, 0.15, { fill: WATER, stroke: 'none', fop: 0.4 }, false);
      const sm = Math.max(0.12, Math.min(1, Math.sqrt(g.Lr)));
      ship(0, 1, 'prototype', g.Vp);
      ship(5.8, sm, `model 1 : ${f(1 / g.Lr)}`, g.Vm);
      const name = { Fr: 'Froude', Re: 'Reynolds', ReFr: 'Froude + Reynolds', We: 'Weber', Ma: 'Mach' }[g.law];
      sc.text([0, 2.0], `${name} law:  V_r = ${f(g.Vr)},  L_r = ${f(g.Lr)}`, { size: 13, color: RED, in3: true });
      // ratio table (model ÷ prototype) under the sketch
      const rows = [['Length L_r', g.Lr], ['Velocity V_r', g.Vr], ['Time t_r = L_r/V_r', g.tr], ['Discharge Q_r = V_r L_r²', g.Qr], ['Force F_r = ρ_r V_r² L_r²', g.Fr], ['Power P_r = F_r V_r', g.Pr]].filter((r) => isFinite(r[1]));
      sc.text([0, -1.2], 'Ratios (model ÷ prototype)', { size: 12, color: '#34495e' });
      rows.forEach((r, i) => { const x = i < 3 ? 0 : 4.8, y = -1.75 - (i % 3) * 0.5; sc.text([x, y], `${r[0]} = ${f(r[1])}`, { size: 12, color: '#1d2733' }); });
      sc.autoBounds(0.1); sc.padR = 120; return sc;
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
  root.MS = MS;
})(window);
