/* =====================================================================
 * MODULE — Compressible Flow (2026-11-25 book-coverage upgrade, stage 6)
 * gas processes, Mach number, isentropic flow, nozzles, constrictions,
 * shocks and expansion waves, Fanno, Rayleigh, isothermal pipes, Pitot tube.
 * Formulas: physComp.js
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Physics, Scene } = root;
  const f = Physics.fmt;
  const PI = Math.PI, DEG = PI / 180;
  const AIR = '#d6eaf8', AIRD = '#5dade2', STEEL = '#9aa3ad', RED = '#c0392b', GREEN = '#16a085', INK = '#2c3e50', PURP = '#8e44ad', ORNG = '#e67e22', BLUE = '#1f5fa8';

  const DEF = {
    topic: 'isen', gas: 'air', Rc: 287, kc: 1.4, tS: 'C', gauge: false, patm: 101.3,
    by: 'MTp', M: 0.5, V: 150, T: 20, p: 100, T0: 20, p0: 101.3, AR: 2, br: 'sub', D1: 0, s2by: 'none', D2: 0, br2: 'sub', M2: 0.7, p2: 50, T2: 0,
    gT1: 20, gp1: 100, proc: 'isen', n: 1.3, known2: 'p', gp2: 200, gT2: 50, gr2: 1.5, mass: 0,
    cBy: 'gas', cG: 340, Ev: 2.2, rhoL: 1000, mBy: 'M', alt: 0,
    sp1: 400, sg1: 45, sV1: 80, sFind: 'V2', sp2: 360, sV2: 150, sD: 0,
    nT0: 20, np0: 500, nKind: 'conv', nFind: 'flow', nDe: 20, nDt: 10, npb: 101.3, nm: 0, nmU: 'm', ndBy: 'M', nMe: 2,
    vp1: 500, vT1: 20, vp2: 400, vD1: 75, vD2: 50, vCd: 1,
    shK: 'normal', obBy: 'beta', beta: 40, theta: 10, obW: 'weak',
    fD: 50, ff: 0.02, fFind: 'L', fL: 1, fM2: 0.8,
    rBy: 'q', rq: 100, rL: 1, rT02: 500, rD: 0,
    iT: 20, iD: 150, ip1: 500, ip2: 400, iL: 500, iFind: 'm', im: 1, imU: 'm', ifBy: 'smooth', if: 0.015, ieps: 0.045, iMuBy: 'air', iMu: 1.8e-5,
    pp: 50, pt: 80, ptBy: 'T0', pT: 20,
  };
  const pr = (name, units, x) => ({ name, units, apply: (s) => Object.assign(s, JSON.parse(JSON.stringify(DEF)), units === 'EN' ? { tS: 'F', patm: 14.7 } : {}, x) });
  const G = (topic, o) => Object.assign({ topic }, o);

  const MC = {
    id: 'mc', title: 'Compressible Flow',
    state: JSON.parse(JSON.stringify(DEF)),
    presets: [
      pr('Hibbeler 13.1 — air from 80 kPa (gage), 50 °C to 20 kPa (gage), 20 °C: Δh, Δu, Δs (−30.1 kJ/kg, −21.5 kJ/kg, 17.4 J/kg·K)', 'SI', G('gas', { gauge: true, gT1: 50, gp1: 80, proc: 'both', gT2: 20, gp2: 20 })),
      pr('Hibbeler 13.2 — 4 kg of helium at 100 kPa (gage), 20 °C compressed isentropically to 250 kPa (gage) (366 K, 0.463 kg/m³)', 'SI', G('gas', { gas: 'he', gauge: true, gT1: 20, gp1: 100, proc: 'isen', known2: 'p', gp2: 250, mass: 4 })),
      pr('Polytropic compression of air, n = 1.3, 100 → 500 kPa: work and heat per kg', 'SI', G('gas', { gT1: 20, gp1: 100, proc: 'poly', n: 1.3, known2: 'p', gp2: 500, mass: 1 })),
      pr('Hibbeler 13.3 — jet at M 2.3, 18 km up, c = 295 m/s: time to hear it (54.9 s)', 'SI', G('mach', { cBy: 'given', cG: 295, mBy: 'M', M: 2.3, alt: 18 })),
      pr('Speed of sound in water, E_v = 2.2 GPa (1483 m/s)', 'SI', G('mach', { cBy: 'liq', Ev: 2.2, rhoL: 1000, mBy: 'V', V: 10 })),
      pr('Hibbeler 13.4 — air leaves a 100 °C tank at M 0.6: temperature (348 K)', 'SI', G('isen', { by: 'M0', M: 0.6, T0: 100, p0: 101.3 })),
      pr('Hibbeler 13.5 — nitrogen at 150 m/s, 80 °C, 301.3 kPa: stagnation state (363.8 K, 334.9 kPa)', 'SI', G('isen', { gas: 'n2', by: 'VTp', V: 150, T: 80, p: 301.3 })),
      pr('Hibbeler 13.6 — air drawn from the atmosphere (20 °C) to 98 kPa: M and ρ (0.218; book uses table ρ₀ 1.202 → 1.174 kg/m³)', 'SI', G('isen', { by: 'p0p', p0: 101.3, p: 98, T0: 20 })),
      pr('Hibbeler 13.7 — 50 mm pipe at 150 m/s, 350 K, 400 kPa: throat area, then supersonic flow at 75 mm (A* 1.235 × 10⁻³ m², M₂ 2.82, 15.9 kPa, 668 m/s)', 'SI', G('isen', { tS: 'K', by: 'VTp', V: 150, T: 350, p: 400, D1: 50, s2by: 'D', D2: 75, br2: 'sup' })),
      pr('Hibbeler 13.11 — nozzle from 101.3 kPa, 288 K; 90 kPa at a 100 mm inlet; exit M 0.7 (T₂ 262.3 K)', 'SI', G('isen', { tS: 'K', by: 'p0p', p0: 101.3, p: 90, T0: 288, D1: 100, s2by: 'M', M2: 0.7 })),
      pr('Hibbeler 13.10 — Laval nozzle with A/A* = 4 from 350 kPa: supersonic exit (M 2.940, 10.4 kPa); pick Subsonic for M 0.1467, 345 kPa', 'SI', G('isen', { tS: 'K', by: 'AA', AR: 4, br: 'sup', p0: 350, T0: 300 })),
      pr('Schaum 11.3 — nitrogen at 409 ft/s, 85 psia, 0.655 lb/ft³; velocity where p = 83 psia (442.5 ft/s)', 'EN', G('stream', { gas: 'n2', sp1: 85, sg1: 0.655, sV1: 409, sFind: 'V2', sp2: 83 })),
      pr('Schaum 11.4 — air at 30.5 m/s, 350 kPa, 0.028 kN/m³; pressure where V = 150 m/s', 'SI', G('stream', { sp1: 350, sg1: 28, sV1: 30.5, sFind: 'p2', sV2: 150 })),
      pr('Schaum 11.10 — oxygen at 125 m/s, 450 kPa, 0.058 kN/m³; velocity at 360 kPa (220 m/s)', 'SI', G('stream', { gas: 'o2', sp1: 450, sg1: 58, sV1: 125, sFind: 'V2', sp2: 360 })),
      pr('Schaum 11.11 — air at 80 m/s, 405 kPa, 0.046 kN/m³; pressure where V = 165 m/s (358 kPa)', 'SI', G('stream', { sp1: 405, sg1: 46, sV1: 80, sFind: 'p2', sV2: 165 })),
      pr('Hibbeler 13.9 — nitrogen tank 500 kPa, 1200 K, 300 mm converging nozzle, 300 kPa outside (M 0.886, 40.1 kg/s)', 'SI', G('noz', { gas: 'n2', tS: 'K', nT0: 1200, np0: 500, nKind: 'conv', nDe: 300, npb: 300 })),
      pr('Hibbeler 13.8 — 2 in pipe fed from standard air: pressure for maximum flow and the flow (p* 7.77 psia)', 'EN', G('noz', { nT0: 59, np0: 14.7, nKind: 'conv', nDe: 2, npb: 0 })),
      pr('Schaum 11.5 — 28 °C tank at 40 kPa (gage), 10 mm convergent nozzle, atmosphere 96.5 kPa: weight flow', 'SI', G('noz', { gauge: true, patm: 96.5, nT0: 28, np0: 40, nKind: 'conv', nDe: 10, npb: 0 })),
      pr('Schaum 11.6 — 75 °F tank at 25 psig, 1.5 in nozzle, atmosphere 14.0 psia: choked weight flow', 'EN', G('noz', { gauge: true, patm: 14, nT0: 75, np0: 25, nKind: 'conv', nDe: 1.5, npb: 0 })),
      pr('Schaum 11.12 — 30 °C tank at 50 kPa (gage), 20 mm nozzle, atmosphere 95.4 kPa (book misprints 954.0) (1.00 N/s)', 'SI', G('noz', { gauge: true, patm: 95.4, nT0: 30, np0: 50, nKind: 'conv', nDe: 20, npb: 0 })),
      pr('Hibbeler 13.18 — Laval nozzle 125/250 mm from 350 kPa: back pressures 345, 103 and 10.4 kPa; shock at p_b = 200 kPa', 'SI', G('noz', { tS: 'K', nT0: 300, np0: 350, nKind: 'cd', nDt: 125, nDe: 250, npb: 200 })),
      pr('Design a Laval nozzle for M 2.5 and 1 kg/s from 700 kPa, 300 K: throat and exit sizes', 'SI', G('noz', { tS: 'K', nT0: 300, np0: 700, nKind: 'cd', nFind: 'size', ndBy: 'M', nMe: 2.5, nm: 1 })),
      pr('Schaum 11.7 — 2 in constriction in a 3 in pipe, 108 psig and 105 °F, 81 psig at the throat: weight flow', 'EN', G('ven', { gauge: true, patm: 14.5, vp1: 108, vT1: 105, vp2: 81, vD1: 3, vD2: 2 })),
      pr('Schaum 11.14 — 1 in constriction in a 2 in pipe, 100 psig and 102 °F, 78 psig at the throat (1.67 lb/s)', 'EN', G('ven', { gauge: true, patm: 14.7, vp1: 100, vT1: 102, vp2: 78, vD1: 2, vD2: 1 })),
      pr('Hibbeler 13.16 — standing shock, 550 m/s, 20 °C, 30 kPa behind it: state in front (85.0 kPa, 407.3 K, 270 m/s)', 'SI', G('shock', { shK: 'normal', by: 'VTp', V: 550, T: 20, p: 30 })),
      pr('Hibbeler 13.17 — jet at M 1.5 in 50 kPa, 8 °C air: shock at the intake (123 kPa, 271 m/s)', 'SI', G('shock', { shK: 'normal', by: 'MTp', M: 1.5, T: 8, p: 50 })),
      pr('Hibbeler 13.19 — 845 m/s at 10 °C, 80 kPa, oblique shock at 40° (395 K, 229 kPa, θ 17.7°)', 'SI', G('shock', { shK: 'oblique', obBy: 'beta', beta: 40, by: 'VTp', V: 845, T: 10, p: 80 })),
      pr('Oblique shock from a 10° wedge at M 2 (weak solution)', 'SI', G('shock', { shK: 'oblique', obBy: 'theta', theta: 10, obW: 'weak', by: 'MTp', M: 2, T: 20, p: 50 })),
      pr('Hibbeler 13.20 — 900 m/s, 100 kPa, 30 °C turning 10° away (M₂ 3.063, 246 K, 47.9 kPa, 962 m/s)', 'SI', G('shock', { shK: 'exp', theta: 10, by: 'VTp', V: 900, T: 30, p: 100 })),
      pr('Hibbeler 13.12 — 30 mm pipe, 153 m/s, 300 K, f 0.040: L_max and V at 0.8 m (1.26 m, 323 m/s, 196 m/s)', 'SI', G('fanno', { tS: 'K', by: 'VTp', V: 153, T: 300, p: 100, fD: 30, ff: 0.04, fFind: 'L', fL: 0.8 })),
      pr('Hibbeler 13.13 — 50 mm pipe from a reservoir at M 0.5, f 0.030, L = 1 m (M₂ 0.606)', 'SI', G('fanno', { by: 'M0', M: 0.5, T0: 20, p0: 101.3, fD: 50, ff: 0.03, fFind: 'L', fL: 1 })),
      pr('Hibbeler 13.13 — the same pipe extended to 2 m: it chokes (new M₁ 0.485)', 'SI', G('fanno', { by: 'M0', M: 0.5, T0: 20, p0: 101.3, fD: 50, ff: 0.03, fFind: 'L', fL: 2 })),
      pr('Hibbeler 13.14 — room air (101 kPa, 293 K) drawn to 80 kPa into a 100 mm pipe, f 0.03, L 0.9 m (1.56 kg/s, 93.8 kPa, F_f 43.4 N)', 'SI', G('fanno', { tS: 'K', by: 'p0p', T0: 293, p0: 101, p: 80, fD: 100, ff: 0.03, fFind: 'L', fL: 0.9 })),
      pr('Hibbeler 13.15 — 200 mm pipe, 75 m/s, 135 kPa, 295 K, heated 100 kJ/kg·m over 2 m (M₂ 0.295, 488 K, 128 kPa, 131 m/s)', 'SI', G('ray', { tS: 'K', by: 'VTp', V: 75, T: 295, p: 135, rBy: 'ql', rq: 100, rL: 2, rD: 200 })),
      pr('Schaum 11.1 — air at 65 °F, 6 in pipe, 82 → 65 psia over 550 ft, f 0.0095 (14.5 lb/s)', 'EN', G('iso', { iT: 65, iD: 6, ip1: 82, ip2: 65, iL: 550, iFind: 'm', ifBy: 'given', if: 0.0095 })),
      pr('Schaum 11.2 — air at 18 °C, 300 mm smooth pipe, 0.450 kN/s from 550 kPa: pressure 200 m on (233 kPa)', 'SI', G('iso', { iT: 18, iD: 300, ip1: 550, iL: 200, iFind: 'p2', im: 450, imU: 'G' })),
      pr('Schaum 11.8 — air at 100 °F, 4 in smooth pipe, 120 → 80 psia over 400 ft (book chart: 10.56 lb/s)', 'EN', G('iso', { iT: 100, iD: 4, ip1: 120, ip2: 80, iL: 400, iFind: 'm' })),
      pr('Schaum 11.9 — air at 85 °F, 6 in smooth pipe, 10 lb/s from 70 psia: pressure 600 ft on (58.9 psia)', 'EN', G('iso', { iT: 85, iD: 6, ip1: 70, iL: 600, iFind: 'p2', im: 10, imU: 'G' })),
      pr('Pitot-static tube in supersonic air: 50 kPa static, 200 kPa total, T₀ 20 °C', 'SI', G('pitot', { pp: 50, pt: 200, ptBy: 'T0', pT: 20 })),
    ],

    controls(el, C) {
      const s = this.state, U = root.App.U(), u = Physics.compUnits(U), SI = u.SI;
      if (SI && (s.tS === 'F' || s.tS === 'R')) s.tS = s.tS === 'R' ? 'K' : 'C';
      if (!SI && (s.tS === 'C' || s.tS === 'K')) s.tS = s.tS === 'K' ? 'R' : 'F';
      const tn = SI ? (s.tS === 'K' ? 'K' : '°C') : (s.tS === 'R' ? '°R' : '°F');
      const pn = s.gauge ? (SI ? 'kPa (gage)' : 'psig') : u.pa;
      const sl = (p, k, label, min, max, step, unit, o) => C.slider(p, Object.assign({ label, min, max, step, get: () => s[k], set: (v) => (s[k] = v), unit }, o || {}));
      const tSl = (p, k, label) => sl(p, k, label, SI ? (s.tS === 'K' ? 1 : -270) : (s.tS === 'R' ? 1 : -450), SI ? 3000 : 5000, 0.01, tn);
      const pSl = (p, k, label) => sl(p, k, label, s.gauge ? (SI ? -101 : -14.7) : 0, SI ? 20000 : 3000, 0.001, pn);
      const t = C.section(el, 'Problem type');
      C.select(t, { label: 'Topic', options: [['gas', 'Gas states and processes (Δh, Δu, Δs, work)'], ['mach', 'Speed of sound and Mach number'], ['isen', 'Isentropic flow: stagnation, A/A*, two sections'], ['stream', 'Two points on a streamline (Schaum p, V, γ form)'], ['noz', 'Tank and nozzle: choking, back pressure, design'], ['ven', 'Constriction in a pipe (compressible venturi)'], ['shock', 'Normal and oblique shocks, expansion waves'], ['fanno', 'Pipe flow with friction (Fanno)'], ['ray', 'Pipe flow with heat transfer (Rayleigh)'], ['iso', 'Isothermal flow in a long pipe'], ['pitot', 'Pitot-static tube (subsonic or supersonic)']], get: () => s.topic, set: (v) => (s.topic = v) });
      const g = C.section(el, 'Gas and input scales');
      C.select(g, { label: 'Gas', options: Object.entries(Physics.GASES).map(([k, G]) => [k, `${G.name} (k = ${G.k})`]).concat([['custom', 'Custom R and k']]), get: () => s.gas, set: (v) => (s.gas = v) });
      if (s.gas === 'custom') { sl(g, 'Rc', 'Gas constant R', 1, SI ? 10000 : 60000, 0.01, u.R); sl(g, 'kc', 'Specific-heat ratio k', 1.001, 2, 0.001, ''); }
      C.seg(g, { label: 'Temperatures entered in', options: SI ? [['C', '°C (+273)'], ['K', 'K']] : [['F', '°F (+460)'], ['R', '°R']], get: () => s.tS, set: (v) => (s.tS = v) });
      C.toggle(g, { label: 'Pressures entered as gage', get: () => s.gauge, set: (v) => (s.gauge = v) });
      if (s.gauge) sl(g, 'patm', 'Atmospheric pressure', SI ? 1 : 0.1, SI ? 200 : 30, 0.001, u.pa);

      const stateCtl = (title, opts) => {
        const sec = C.section(el, title);
        C.select(sec, { label: 'Known', options: opts, get: () => s.by, set: (v) => (s.by = v) });
        if (!opts.some((o) => o[0] === s.by)) s.by = opts[0][0];
        const by = s.by;
        if (by === 'MTp' || by === 'M0') sl(sec, 'M', 'Mach number M', 0, 50, 0.0001, '');
        if (by === 'VTp' || by === 'V0') sl(sec, 'V', 'Velocity V', 0, SI ? 5000 : 15000, 0.01, u.V);
        if (by === 'MTp' || by === 'VTp') { tSl(sec, 'T', 'Static temperature T'); pSl(sec, 'p', 'Static pressure p'); }
        else {
          tSl(sec, 'T0', 'Stagnation temperature T₀'); pSl(sec, 'p0', 'Stagnation pressure p₀');
          if (by === 'p0p') pSl(sec, 'p', 'Static pressure p');
          if (by === 'T0T') tSl(sec, 'T', 'Static temperature T');
          if (by === 'AA') { sl(sec, 'AR', 'Area ratio A/A*', 1, 1000, 0.0001, ''); C.seg(sec, { label: 'Branch', options: [['sub', 'Subsonic'], ['sup', 'Supersonic']], get: () => s.br, set: (v) => (s.br = v) }); }
        }
        return sec;
      };
      const ALL = [['MTp', 'M, static T and p'], ['VTp', 'V, static T and p'], ['M0', 'M with stagnation T₀, p₀ (reservoir)'], ['V0', 'V with stagnation T₀, p₀'], ['p0p', 'Stagnation T₀, p₀ and static p'], ['T0T', 'Stagnation T₀, p₀ and static T'], ['AA', 'A/A* with stagnation T₀, p₀']];
      const tp = s.topic;
      if (tp === 'gas') {
        const a = C.section(el, 'State 1');
        pSl(a, 'gp1', 'Pressure p₁'); tSl(a, 'gT1', 'Temperature T₁');
        sl(a, 'mass', 'Mass of gas (0 = per unit mass only)', 0, 1e6, 0.0001, u.mass);
        const b = C.section(el, 'Process to state 2');
        C.select(b, { label: 'Process', options: [['both', 'Both p₂ and T₂ known'], ['isen', 'Isentropic (n = k)'], ['poly', 'Polytropic pvⁿ = const'], ['isoT', 'Isothermal'], ['isoP', 'Constant pressure'], ['isoV', 'Constant volume']], get: () => s.proc, set: (v) => (s.proc = v) });
        if (s.proc === 'poly') sl(b, 'n', 'Polytropic exponent n', 0.01, 5, 0.0001, '');
        if (s.proc === 'both') { pSl(b, 'gp2', 'Pressure p₂'); tSl(b, 'gT2', 'Temperature T₂'); }
        else {
          const ko = s.proc === 'isoT' ? [['p', 'p₂'], ['rho', 'ρ₂']] : s.proc === 'isoP' ? [['T', 'T₂'], ['rho', 'ρ₂']] : s.proc === 'isoV' ? [['p', 'p₂'], ['T', 'T₂']] : [['p', 'p₂'], ['T', 'T₂'], ['rho', 'ρ₂']];
          if (!ko.some((o) => o[0] === s.known2)) s.known2 = ko[0][0];
          C.seg(b, { label: 'Known at state 2', options: ko, get: () => s.known2, set: (v) => (s.known2 = v) });
          if (s.known2 === 'p') pSl(b, 'gp2', 'Pressure p₂'); else if (s.known2 === 'T') tSl(b, 'gT2', 'Temperature T₂'); else sl(b, 'gr2', 'Density ρ₂', 1e-6, SI ? 1000 : 2, 1e-6, u.rho);
        }
      } else if (tp === 'mach') {
        const a = C.section(el, 'Speed of sound');
        C.select(a, { label: 'From', options: [['gas', 'The gas temperature: c = √(kRT)'], ['given', 'Given c'], ['liq', 'A liquid: c = √(E_v/ρ)']], get: () => s.cBy, set: (v) => (s.cBy = v) });
        if (s.cBy === 'gas') tSl(a, 'T', 'Temperature T'); else if (s.cBy === 'given') sl(a, 'cG', 'Speed of sound c', 1, SI ? 10000 : 30000, 0.01, u.V);
        else { sl(a, 'Ev', 'Bulk modulus E_v', 0.0001, SI ? 500 : 5e6, 0.0001, u.E); sl(a, 'rhoL', 'Density ρ', 0.01, SI ? 25000 : 50, 0.0001, u.rho); }
        const b = C.section(el, 'Moving body or flow');
        C.seg(b, { label: 'Given', options: [['M', 'Mach number'], ['V', 'Speed']], get: () => s.mBy, set: (v) => (s.mBy = v) });
        if (s.mBy === 'M') sl(b, 'M', 'Mach number M', 0, 50, 0.0001, ''); else sl(b, 'V', 'Speed V', 0, SI ? 10000 : 30000, 0.01, u.V);
        sl(b, 'alt', 'Altitude above an observer (0 = skip)', 0, 100, 0.0001, u.h);
      } else if (tp === 'isen') {
        const a = stateCtl('Section 1', ALL);
        sl(a, 'D1', 'Diameter at section 1 (0 = skip ṁ)', 0, SI ? 10000 : 400, 0.001, u.D);
        const b = C.section(el, 'Section 2 (same stagnation state)');
        C.select(b, { label: 'Section 2 given by', options: [['none', 'No second section'], ['D', 'Its diameter'], ['M', 'Its Mach number'], ['p', 'Its pressure'], ['T', 'Its temperature']], get: () => s.s2by, set: (v) => (s.s2by = v) });
        if (s.s2by === 'D') { sl(b, 'D2', 'Diameter at section 2', 0, SI ? 10000 : 400, 0.001, u.D); C.seg(b, { label: 'Branch', options: [['sub', 'Subsonic'], ['sup', 'Supersonic']], get: () => s.br2, set: (v) => (s.br2 = v) }); }
        if (s.s2by === 'M') sl(b, 'M2', 'Mach number M₂', 0, 50, 0.0001, '');
        if (s.s2by === 'p') pSl(b, 'p2', 'Pressure p₂');
        if (s.s2by === 'T') tSl(b, 'T2', 'Temperature T₂');
        if (s.s2by === 'M' || s.s2by === 'p' || s.s2by === 'T') C.note(b, 'Give the section 1 diameter to get the area and diameter at section 2.');
      } else if (tp === 'stream') {
        const a = C.section(el, 'Point 1');
        pSl(a, 'sp1', 'Pressure p₁'); sl(a, 'sg1', 'Unit weight γ₁', 0.000001, SI ? 2000 : 10, 0.000001, u.gam); sl(a, 'sV1', 'Velocity V₁', 0, SI ? 3000 : 10000, 0.01, u.V);
        sl(a, 'sD', 'Pipe diameter (0 = skip flow rate)', 0, SI ? 5000 : 200, 0.001, u.D);
        const b = C.section(el, 'Point 2');
        C.seg(b, { label: 'Find', options: [['V2', 'V₂ (p₂ known)'], ['p2', 'p₂ (V₂ known)']], get: () => s.sFind, set: (v) => (s.sFind = v) });
        if (s.sFind === 'V2') pSl(b, 'sp2', 'Pressure p₂'); else sl(b, 'sV2', 'Velocity V₂', 0, SI ? 3000 : 10000, 0.01, u.V);
      } else if (tp === 'noz') {
        const a = C.section(el, 'Tank (stagnation state)');
        pSl(a, 'np0', 'Tank pressure p₀'); tSl(a, 'nT0', 'Tank temperature T₀');
        const b = C.section(el, 'Nozzle');
        C.seg(b, { label: 'Type', options: [['conv', 'Converging'], ['cd', 'Converging–diverging']], get: () => s.nKind, set: (v) => (s.nKind = v) });
        C.seg(b, { label: 'Find', options: [['flow', 'Flow (size known)'], ['size', 'Size (design)']], get: () => s.nFind, set: (v) => (s.nFind = v) });
        const mFlow = (lab) => { sl(b, 'nm', lab, 0, 1e6, 0.000001, s.nmU === 'G' ? u.G : u.m); C.seg(b, { label: 'Flow given as', options: [['m', `mass (${u.m})`], ['G', `weight (${u.G})`]], get: () => s.nmU, set: (v) => (s.nmU = v) }); };
        if (s.nKind === 'conv') {
          if (s.nFind === 'flow') sl(b, 'nDe', 'Exit diameter', 0.001, SI ? 10000 : 400, 0.001, u.D); else mFlow('Required flow');
          pSl(b, 'npb', 'Back (outside) pressure');
        } else if (s.nFind === 'flow') {
          sl(b, 'nDt', 'Throat diameter', 0.001, SI ? 10000 : 400, 0.001, u.D); sl(b, 'nDe', 'Exit diameter', 0.001, SI ? 10000 : 400, 0.001, u.D); pSl(b, 'npb', 'Back (outside) pressure');
        } else {
          C.seg(b, { label: 'Design for', options: [['M', 'Exit Mach number'], ['p', 'Exit pressure']], get: () => s.ndBy, set: (v) => (s.ndBy = v) });
          if (s.ndBy === 'M') sl(b, 'nMe', 'Exit Mach number', 1, 20, 0.0001, ''); else pSl(b, 'npb', 'Exit (= back) pressure');
          mFlow('Mass or weight flow (0 = use throat size)');
          if (!(s.nm > 0)) sl(b, 'nDt', 'Throat diameter', 0.001, SI ? 10000 : 400, 0.001, u.D);
        }
        if (s.gauge) C.note(b, 'With gage pressures, an outside pressure of 0 means the atmosphere.');
      } else if (tp === 'ven') {
        const a = C.section(el, 'Pipe (section 1)');
        pSl(a, 'vp1', 'Pressure p₁'); tSl(a, 'vT1', 'Temperature T₁'); sl(a, 'vD1', 'Pipe diameter D₁', 0.001, SI ? 5000 : 200, 0.001, u.D);
        const b = C.section(el, 'Constriction (section 2)');
        sl(b, 'vD2', 'Throat diameter D₂', 0.001, SI ? 5000 : 200, 0.001, u.D); pSl(b, 'vp2', 'Throat pressure p₂'); sl(b, 'vCd', 'Discharge coefficient C (1 = ideal)', 0.5, 1, 0.0001, '');
      } else if (tp === 'shock') {
        const a = C.section(el, 'Wave');
        C.select(a, { label: 'Type', options: [['normal', 'Normal shock'], ['oblique', 'Oblique shock'], ['exp', 'Expansion fan (Prandtl–Meyer)'], ['comp', 'Isentropic compression turn']], get: () => s.shK, set: (v) => (s.shK = v) });
        if (s.shK === 'oblique') {
          C.seg(a, { label: 'Given', options: [['beta', 'Wave angle β'], ['theta', 'Deflection θ']], get: () => s.obBy, set: (v) => (s.obBy = v) });
          if (s.obBy === 'beta') sl(a, 'beta', 'Wave angle β', 0.01, 90, 0.0001, '°');
          else { sl(a, 'theta', 'Deflection (wedge half-angle) θ', 0.01, 60, 0.0001, '°'); C.seg(a, { label: 'Solution', options: [['weak', 'Weak'], ['strong', 'Strong']], get: () => s.obW, set: (v) => (s.obW = v) }); }
        }
        if (s.shK === 'exp' || s.shK === 'comp') sl(a, 'theta', 'Turning angle θ', 0, 120, 0.0001, '°');
        stateCtl('Upstream flow (1)', ALL.slice(0, 2));
      } else if (tp === 'fanno' || tp === 'ray') {
        stateCtl(tp === 'fanno' ? 'Pipe inlet (1)' : 'Section 1', ALL.slice(0, 6));
        const b = C.section(el, tp === 'fanno' ? 'Pipe with friction' : 'Heat transfer');
        if (tp === 'fanno') {
          sl(b, 'fD', 'Diameter D', 0.001, SI ? 10000 : 400, 0.001, u.D); sl(b, 'ff', 'Darcy friction factor f', 0.0001, 0.2, 0.0001, '');
          C.seg(b, { label: 'Find', options: [['L', 'Exit state (length known)'], ['M2', 'Length (exit Mach known)']], get: () => s.fFind, set: (v) => (s.fFind = v) });
          if (s.fFind === 'L') sl(b, 'fL', 'Pipe length L', 0, 1e5, 0.0001, u.L); else sl(b, 'fM2', 'Exit Mach number M₂', 0.0001, 50, 0.0001, '');
        } else {
          C.select(b, { label: 'Heat given as', options: [['q', `Per unit mass q (${u.e})`], ['ql', `Per unit mass per length × length`], ['T02', 'Exit stagnation temperature T₀₂']], get: () => s.rBy, set: (v) => (s.rBy = v) });
          if (s.rBy === 'T02') tSl(b, 'rT02', 'Exit stagnation temperature T₀₂');
          else { sl(b, 'rq', s.rBy === 'ql' ? 'Heat per unit mass per length' : 'Heat per unit mass q (negative = cooling)', SI ? -5000 : -2e7, SI ? 5000 : 2e7, 0.0001, s.rBy === 'ql' ? u.ql : u.e); if (s.rBy === 'ql') sl(b, 'rL', 'Heated length L', 0, 1e5, 0.0001, u.L); }
          sl(b, 'rD', 'Pipe diameter (0 = skip ṁ)', 0, SI ? 10000 : 400, 0.001, u.D);
        }
      } else if (tp === 'iso') {
        const a = C.section(el, 'Pipe');
        tSl(a, 'iT', 'Gas temperature T (constant)'); sl(a, 'iD', 'Diameter D', 0.001, SI ? 10000 : 400, 0.001, u.D); pSl(a, 'ip1', 'Pressure p₁ at section 1');
        C.select(a, { label: 'Find', options: [['m', 'Flow rate (p₂ and L known)'], ['p2', 'Pressure p₂ (flow and L known)'], ['L', 'Length L (flow and p₂ known)']], get: () => s.iFind, set: (v) => (s.iFind = v) });
        if (s.iFind !== 'p2') pSl(a, 'ip2', 'Pressure p₂ at section 2');
        if (s.iFind !== 'L') sl(a, 'iL', 'Length L between sections', 0, 1e6, 0.0001, u.L);
        if (s.iFind !== 'm') { sl(a, 'im', 'Flow rate', 0, 1e6, 0.000001, s.imU === 'G' ? u.G : u.m); C.seg(a, { label: 'Flow given as', options: [['m', `mass (${u.m})`], ['G', `weight (${u.G})`]], get: () => s.imU, set: (v) => (s.imU = v) }); }
        const b = C.section(el, 'Friction');
        C.seg(b, { label: 'Friction factor', options: [['smooth', 'Smooth pipe'], ['rough', 'Roughness ε'], ['given', 'Given f']], get: () => s.ifBy, set: (v) => (s.ifBy = v) });
        if (s.ifBy === 'given') sl(b, 'if', 'Darcy friction factor f', 0.0001, 0.2, 0.00001, '');
        else {
          if (s.ifBy === 'rough') sl(b, 'ieps', 'Roughness ε', 0, SI ? 10 : 0.5, 0.00001, u.D);
          C.seg(b, { label: 'Viscosity', options: [['air', 'Air (Sutherland)'], ['given', 'Given μ']], get: () => s.iMuBy, set: (v) => (s.iMuBy = v) });
          if (s.iMuBy === 'given') sl(b, 'iMu', 'Dynamic viscosity μ', 1e-9, 0.01, 1e-10, u.mu);
          C.note(b, 'f comes from the Colebrook equation; the Reynolds number is the same all along an isothermal pipe.');
        }
      } else if (tp === 'pitot') {
        const a = C.section(el, 'Readings');
        pSl(a, 'pp', 'Static pressure p'); pSl(a, 'pt', 'Pitot (total) pressure');
        C.seg(a, { label: 'Temperature known', options: [['T0', 'Stagnation T₀'], ['T', 'Static T']], get: () => s.ptBy, set: (v) => (s.ptBy = v) });
        tSl(a, 'pT', s.ptBy === 'T0' ? 'Stagnation temperature T₀' : 'Static temperature T');
      }
    },

    compute(U) { return Physics.compFlow(Object.assign({}, this.state), U); },

    scene(res, U) {
      const g = res.geo, u = Physics.compUnits(U), sc = Scene.Scene(), FN = Physics.compFn;
      sc.depth = 0.6;
      const k = (Physics.GASES[this.state.gas] || { k: this.state.kc || 1.4 }).k;
      const duct = (pts, o) => sc.poly(pts, Object.assign({ fill: AIR, stroke: INK, sw: 1.5 }, o || {}), { fill: AIRD, alpha: 0.35 });
      const tp = g.topic;
      if (tp === 'gas') {
        // p–v diagram of the process (normalised)
        const v1 = 1 / (g.p1 / g.T1), v2 = 1 / (g.p2 / g.T2), vm = Math.max(v1, v2), pm = Math.max(g.p1, g.p2);
        const X = (v) => (6 * v) / vm, Y = (p) => (4 * p) / pm;
        sc.line([0, 0], [6.6, 0], { stroke: INK, sw: 1.2 }); sc.line([0, 0], [0, 4.6], { stroke: INK, sw: 1.2 });
        sc.text([6.7, -0.05], 'v', { size: 13 }); sc.text([-0.35, 4.6], 'p', { size: 13 });
        const pts = [];
        for (let i = 0; i <= 40; i++) {
          const t = i / 40, T = g.T1 + (g.T2 - g.T1) * t, lp = Math.log(g.p1) + (Math.log(g.p2) - Math.log(g.p1)) * t, p = Math.exp(lp);
          pts.push([X(T / p), Y(p)]);
        }
        sc.pline(pts, { stroke: RED, sw: 2.5 });
        sc.dot([X(v1), Y(g.p1)], BLUE, '1'); sc.dot([X(v2), Y(g.p2)], BLUE, '2');
        sc.text([0.3, 4.9], `T₁ = ${f(g.T1)} ${u.T}  →  T₂ = ${f(g.T2)} ${u.T}`, { size: 13, color: INK, in3: true });
      } else if (tp === 'mach') {
        const M = g.M;
        if (M > 1) {
          const al = Math.asin(1 / M), L = 6, h = L * Math.tan(al);
          sc.poly([[0, h], [0.9, h + 0.15], [1.2, h], [0.9, h - 0.15]], { fill: STEEL, stroke: INK, sw: 1 }, { fill: STEEL, alpha: 0.9 });
          sc.line([0, h], [L, 0], { stroke: RED, sw: 2, dash: '6 4' }); sc.line([0, h], [L, 2 * h], { stroke: RED, sw: 2, dash: '6 4' });
          sc.arrow([1.4, h], [2.6, h], { color: GREEN, label: `M = ${f(M)}` });
          sc.text([L - 2.8, 0.45 * h], `α = ${f(g.al / DEG)}°`, { size: 13, color: RED, in3: true });
          sc.line([-0.5, 0], [L + 0.5, 0], { stroke: '#7f8c8d', sw: 2 });
          if (g.alt > 0) { sc.dim([0, 0], [0, h], `${f(g.alt)} ${u.h}`, -24); sc.dim([0, 0], [L, 0], `x = ${f(g.x)} ${u.h}`, -22); }
        } else {
          for (let i = 1; i <= 5; i++) sc.circle([-i * M * 0.9, 0], i * 0.9, { fill: 'none', stroke: AIRD, sw: 1.5 }, false);
          sc.circle([0, 0], 0.15, { fill: RED, stroke: INK, sw: 1 }, false);
          sc.arrow([0.3, 0], [1.6, 0], { color: GREEN, label: `M = ${f(M)}` });
          sc.text([-4.5, 5], 'Subsonic: the waves run ahead of the body', { size: 13, color: INK, in3: true });
        }
      } else if (tp === 'isen' || tp === 'stream') {
        const r1 = 1, s2 = g.s2, A1 = g.A1, A2 = g.A2;
        const r2 = isFinite(A1) && isFinite(A2) && A1 > 0 ? Math.max(0.25, Math.min(2.5, Math.sqrt(A2 / A1))) : tp === 'stream' ? 1 : 0.7;
        duct([[0, -r1], [2, -r1], [5, -r2], [7, -r2], [7, r2], [5, r2], [2, r1], [0, r1]]);
        sc.line([1, -r1], [1, r1], { stroke: BLUE, sw: 1.5, dash: '4 3' }); sc.text([0.8, r1 + 0.35], '1', { size: 13, color: BLUE });
        if (tp === 'stream' || s2) { sc.line([6, -r2], [6, r2], { stroke: BLUE, sw: 1.5, dash: '4 3' }); sc.text([5.8, r2 + 0.35], '2', { size: 13, color: BLUE }); }
        if (tp === 'isen') {
          sc.arrow([-1.4, 0], [-0.2, 0], { color: GREEN, label: `M₁ = ${f(g.s.M)}`, lp: 'head', anchor: 'end', ldx: -4, ldy: -10 });
          if (s2) sc.arrow([7.2, 0], [8.4, 0], { color: GREEN, label: `M₂ = ${f(s2.M)}`, lp: 'head' });
        } else {
          sc.arrow([-1.4, 0], [-0.2, 0], { color: GREEN, label: `${f(g.V1)} ${u.V}`, lp: 'head', anchor: 'end', ldx: -4, ldy: -10 });
          sc.arrow([7.2, 0], [8.4, 0], { color: GREEN, label: `${f(g.V2)} ${u.V}`, lp: 'head' });
        }
      } else if (tp === 'noz') {
        // tank
        sc.rect(-3.2, -2.2, 0, 2.2, { fill: AIR, stroke: INK, sw: 2 }, { fill: AIRD, alpha: 0.3 });
        sc.text([-3.0, 1.6], `p₀ = ${f(g.p0 / u.pf)} ${u.pa}`, { size: 12, color: INK, in3: true }); sc.text([-3.0, 1.1], `T₀ = ${f(g.T0)} ${u.T}`, { size: 12, color: INK, in3: true });
        const rt = 0.55;
        if (!g.cd) {
          const re = rt;
          duct([[0, -1.3], [2.4, -re], [3.2, -re], [3.2, re], [2.4, re], [0, 1.3]]);
          sc.arrow([3.4, 0], [4.6, 0], { color: GREEN, label: `M_e = ${f(g.Me)}` });
          if (isFinite(g.pb)) sc.text([3.4, -1.0], `p_b = ${f(g.pb / u.pf)} ${u.pa}`, { size: 12, color: INK, in3: true });
          if (g.choked) sc.text([1.0, 1.75], 'choked: M = 1 at the exit', { size: 12, color: RED, in3: true });
        } else {
          const AR = g.AR, re = rt * Math.sqrt(Math.min(AR, 30)), xt = 2, xe = 6;
          const rOf = (x) => (x <= xt ? rt + (1.3 - rt) * Math.pow((xt - x) / xt, 1.3) : rt + ((re - rt) * (x - xt)) / (xe - xt));
          const top = [], bot = [];
          for (let i = 0; i <= 60; i++) { const x = (xe * i) / 60; top.push([x, rOf(x)]); bot.push([x, -rOf(x)]); }
          duct(bot.concat(top.reverse()));
          if (isFinite(g.xs) && g.At > 0) {
            const rs = rt * Math.sqrt(g.xs / g.At), xs = xt + ((rs - rt) / (re - rt)) * (xe - xt);
            sc.line([xs, -rs], [xs, rs], { stroke: RED, sw: 3 }); sc.text([xs - 0.4, rs + 0.35], 'shock', { size: 12, color: RED, in3: true });
          }
          sc.arrow([xe + 0.2, 0], [xe + 1.4, 0], { color: GREEN, label: `M_e = ${f(g.Me)}` });
          // pressure distribution below
          const y0 = -2.2 - 3.2, H = 2.8, Y = (r) => y0 + H * r;
          sc.line([0, y0], [xe, y0], { stroke: INK, sw: 1 }); sc.line([0, y0], [0, y0 + H + 0.2], { stroke: INK, sw: 1 });
          sc.text([-0.9, y0 + H], 'p/p₀', { size: 12, color: INK }); sc.text([xt - 0.4, y0 - 0.35], 'throat', { size: 11, color: INK }); sc.text([xe - 0.3, y0 - 0.35], 'exit', { size: 11, color: INK });
          const ARx = (x) => Math.pow(rOf(x) / rt, 2);
          const curve = (fn) => { const pts = []; for (let i = 0; i <= 80; i++) { const x = (xe * i) / 80, r = fn(x); if (isFinite(r)) pts.push([x, Y(r)]); } return pts; };
          const sub = (x) => FN.iP(FN.MofA(ARx(x), k, false), k), sup = (x) => (x <= xt ? sub(x) : FN.iP(FN.MofA(ARx(x), k, true), k));
          sc.pline(curve(sub), { stroke: AIRD, sw: 1.5, dash: '5 3' }); sc.pline(curve(sup), { stroke: PURP, sw: 1.5, dash: '5 3' });
          if (isFinite(g.xs) && g.At > 0) {
            const rs = rt * Math.sqrt(g.xs / g.At), xs = xt + ((rs - rt) / (re - rt)) * (xe - xt), sh = FN.nShock(g.Ms, k);
            const after = (x) => (x < xs ? sup(x) : sh.p0r * FN.iP(FN.MofA(ARx(x) * sh.p0r, k, false), k));
            sc.pline(curve(after), { stroke: RED, sw: 2.5 });
          } else if (g.regime && /subsonic, not/.test(g.regime)) {
            const q = FN.iA(g.Me, k) / g.AR; // A_t / A* of the unchoked flow
            sc.pline(curve((x) => FN.iP(FN.MofA(ARx(x) * q, k, false), k)), { stroke: RED, sw: 2.5 });
          } else sc.pline(curve(sup), { stroke: RED, sw: 2.5 });
          if (isFinite(g.pb) && g.p0) { const rb = g.pb / g.p0; sc.line([xe, Y(rb)], [xe + 0.8, Y(rb)], { stroke: ORNG, sw: 2.5 }); sc.text([xe + 0.9, Y(rb) - 0.1], `p_b/p₀ = ${f(rb)}`, { size: 11.5, color: ORNG }); }
          sc.text([0.2, y0 - 0.9], 'dashed: isentropic subsonic (blue) and supersonic (purple); red: this flow', { size: 11, color: INK });
        }
      } else if (tp === 'ven') {
        const r2 = Math.max(0.25, g.D2 / g.D1);
        duct([[0, -1], [2.5, -1], [3.7, -r2], [4.5, -r2], [6, -1], [8, -1], [8, 1], [6, 1], [4.5, r2], [3.7, r2], [2.5, 1], [0, 1]]);
        sc.arrow([-1.3, 0], [-0.1, 0], { color: GREEN, label: `${f(g.V1)} ${u.V}`, lp: 'head', anchor: 'end', ldx: -4, ldy: -10 });
        sc.arrow([3.5, 0], [4.7, 0], { color: RED }); sc.text([3.0, -1.5], `throat: ${f(g.V2)} ${u.V}`, { size: 12, color: RED, in3: true });
        sc.text([1, 1.4], '1', { size: 13, color: BLUE }); sc.text([4, r2 + 0.4], '2', { size: 13, color: BLUE });
      } else if (tp === 'shock') {
        if (g.kind === 'normal') {
          duct([[0, -1], [8, -1], [8, 1], [0, 1]]);
          sc.line([4, -1], [4, 1], { stroke: RED, sw: 4 });
          sc.arrow([1, 0], [3, 0], { color: GREEN, label: `M₁ = ${f(g.M1)}`, ldy: -12 }); sc.arrow([5, 0], [6.2, 0], { color: GREEN, label: `M₂ = ${f(g.M2)}`, ldy: -12 });
        } else if (g.kind === 'oblique') {
          const th = g.th, be = g.be, L = 6;
          sc.poly([[0, 0], [L, 0], [L, L * Math.tan(th)]], { fill: STEEL, stroke: INK, sw: 1.5 }, { fill: STEEL, alpha: 0.9 });
          sc.line([0, 0], [L, L * Math.tan(be)], { stroke: RED, sw: 3 });
          sc.arrow([-2.5, 0.8], [-0.6, 0.8], { color: GREEN, label: `M₁ = ${f(g.M1)}`, ldy: -12 });
          const mx = 4.4, my = 4.4 * Math.tan(th) + 0.35;
          sc.arrow([mx, my], [mx + 1.4 * Math.cos(th), my + 1.4 * Math.sin(th)], { color: GREEN, label: `M₂ = ${f(g.M2)}` });
          sc.text([L + 0.25, 0.3], `θ = ${f(th / DEG)}°`, { size: 12, color: INK }); sc.text([L * 0.35 - 1.6, L * 0.35 * Math.tan(be) + 0.2], `β = ${f(be / DEG)}°`, { size: 13, color: RED });
        } else {
          const th = g.th, L = 5;
          sc.poly([[-4, 0], [0, 0], [L * Math.cos(th), -L * Math.sin(th)], [L * Math.cos(th), -L * Math.sin(th) - 1], [-4, -1]], { fill: STEEL, stroke: INK, sw: 1.5 }, { fill: STEEL, alpha: 0.9 });
          const m1 = Math.asin(1 / g.M1), m2 = Math.asin(1 / g.M2);
          for (let i = 0; i <= 5; i++) { const a = m1 + ((m2 - th - m1) * i) / 5; sc.line([0, 0], [4 * Math.cos(a), 4 * Math.sin(a)], { stroke: th >= 0 ? AIRD : RED, sw: 1.5 }); }
          sc.arrow([-3.5, 1], [-1.5, 1], { color: GREEN, label: `M₁ = ${f(g.M1)}`, ldy: -12 });
          sc.arrow([3, 1 - 3 * Math.tan(th) * 0.6], [3 + 1.4 * Math.cos(th), 1 - 3 * Math.tan(th) * 0.6 - 1.4 * Math.sin(th)], { color: GREEN, label: `M₂ = ${f(g.M2)}` });
          sc.text([0.3 + 2.2 * Math.cos(th), -2.2 * Math.sin(th) + 0.45], `θ = ${f(Math.abs(th) / DEG)}°`, { size: 12, color: INK });
        }
      } else if (tp === 'fanno' || tp === 'ray' || tp === 'iso') {
        duct([[0, -0.6], [9, -0.6], [9, 0.6], [0, 0.6]]);
        sc.text([0, 0.95], '1', { size: 13, color: BLUE }); sc.text([8.8, 0.95], '2', { size: 13, color: BLUE });
        sc.arrow([-1.4, 0], [-0.2, 0], { color: GREEN, label: `M₁ = ${f(g.M1)}`, lp: 'head', anchor: 'end', ldx: -4, ldy: -10 });
        sc.arrow([9.2, 0], [10.4, 0], { color: GREEN, label: `M₂ = ${f(g.M2)}`, lp: 'head' });
        if (tp === 'ray') for (let i = 1; i <= 7; i++) sc.arrow([i * 1.1, -1.5], [i * 1.1, -0.7], { color: ORNG });
        if (tp === 'fanno' && g.prof) {
          const y0 = -5.0, H = 2.4, Mmax = Math.max(1, g.M1, g.M2);
          sc.line([0, y0], [9, y0], { stroke: INK, sw: 1 }); sc.line([0, y0], [0, y0 + H + 0.2], { stroke: INK, sw: 1 });
          sc.text([-0.6, y0 + H + 0.3], 'M', { size: 12, color: INK });
          const pts = []; for (let i = 0; i <= 60; i++) { const M = g.prof(i / 60); if (isFinite(M)) pts.push([(9 * i) / 60, y0 + (H * M) / Mmax]); }
          sc.pline(pts, { stroke: RED, sw: 2.5 });
          sc.line([0, y0 + H / Mmax], [9, y0 + H / Mmax], { stroke: PURP, sw: 1, dash: '5 3' }); sc.text([9.1, y0 + H / Mmax], 'M = 1', { size: 11, color: PURP });
          sc.dim([0, -0.6], [9, -0.6], `L = ${f(g.L)} ${u.L}  (L_max = ${f(g.Lmax)} ${u.L})`, -18);
        }
        if (tp === 'iso') sc.text([2, 1.0], `p₁ = ${f(g.p1 / u.pf)} → p₂ = ${f(g.p2 / u.pf)} ${u.pa}`, { size: 12, color: INK, in3: true });
      } else if (tp === 'pitot') {
        duct([[-1, -2], [8, -2], [8, 2], [-1, 2]], { fill: AIR, stroke: 'none' });
        sc.poly([[2, -0.12], [7, -0.12], [7, -1.6], [7.3, -1.6], [7.3, 0.12], [2, 0.12]], { fill: STEEL, stroke: INK, sw: 1.2 }, { fill: STEEL, alpha: 0.9 });
        if (g.M > 1) { const pts = []; for (let i = -10; i <= 10; i++) { const y = i * 0.15; pts.push([1.6 - 0.4 * (1 - Math.cos(y)), y]); } sc.pline(pts, { stroke: RED, sw: 2.5 }); sc.text([0.6, 1.7], 'bow shock', { size: 12, color: RED }); }
        sc.arrow([-0.8, 0.9], [1.2, 0.9], { color: GREEN, label: `M = ${f(g.M)}` });
      }
      sc.autoBounds(0.08); sc.padR = 140; return sc;
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
  root.MC = MC;
})(window);
