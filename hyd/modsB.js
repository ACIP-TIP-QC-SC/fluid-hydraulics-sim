/* =====================================================================
   modsB.js — Hydraulics modules added in the 2026-11-25 book-coverage
   upgrade (Stage 2):
     Flow Measurement        (HP.meter)      Pitot, Venturi / nozzle /
                                             orifice meters, end nozzles,
                                             Bernoulli between two sections
     Pipe Design & Networks  (HP.pipeDesign) hf, Q or size of a pipe or duct,
                                             Hardy Cross networks
   Registered through window.HYD_EXT; app.js hands over its helpers.
   ===================================================================== */
(function (root) {
  'use strict';
  const PI = Math.PI;
  (root.HYD_EXT = root.HYD_EXT || []).push(function (K) {
    const { MODS, S, C, fmt, clamp, lerp, txt, poly, stroke, arrow, dimV, dimH, datum, plot, view, pipe3, pipePath, flange, gauge, flowDots, reservoir, shade, SUB } = K;
    const insertAfter = (id, m) => { const i = MODS.findIndex((x) => x.id === id); MODS.splice(i < 0 ? MODS.length : i + 1, 0, m); };
    const mmOf = (D) => (S.U.sys === 'SI' ? `${fmt(D * 1000)} mm` : `${fmt(D * 12)} in`);
    const bg = (ctx, W, H) => { ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H); };
    const isAir = (Sg) => Sg < 0.05;

    /* -------------------------------------------------------------- helpers */
    // U-tube manometer between two taps on a horizontal pipe wall.
    // dir = +1 hangs below (gauge liquid heavier), −1 stands above (inverted, lighter gauge fluid).
    // hiA: leg A carries the higher pressure (otherwise leg B does).
    function uTube(ctx, xa, xb, yTap, dir, Lpx, hpx, flowCol, gaugeCol, label, hiA) {
      const w = 9, yBend = yTap + dir * Lpx, yMid = yTap + dir * (Lpx * 0.55);
      const sA = hiA ? 1 : -1, ia = yMid + (sA * dir * hpx) / 2, ib = yMid - (sA * dir * hpx) / 2; // the higher-pressure leg's interface sits further from the tap
      const leg = (x, y0, y1, col, a) => { ctx.fillStyle = col; ctx.globalAlpha = a; ctx.fillRect(x - w / 2 + 1.5, Math.min(y0, y1), w - 3, Math.abs(y1 - y0)); ctx.globalAlpha = 1; };
      leg(xa, yTap, ia, flowCol, 0.45); leg(xb, yTap, ib, flowCol, 0.45);
      leg(xa, ia, yBend, gaugeCol, 0.75); leg(xb, ib, yBend, gaugeCol, 0.75);
      ctx.fillStyle = gaugeCol; ctx.globalAlpha = 0.75; ctx.fillRect(xa - w / 2 + 1.5, yBend - (dir > 0 ? 0 : w - 3), xb - xa + w - 3, w - 3); ctx.globalAlpha = 1;
      const out = dir * (w - 3);
      stroke(ctx, [[xa - w / 2, yTap], [xa - w / 2, yBend + out], [xb + w / 2, yBend + out], [xb + w / 2, yTap]], C.ink, 1.4);
      stroke(ctx, [[xa + w / 2, yTap], [xa + w / 2, yBend], [xb - w / 2, yBend], [xb - w / 2, yTap]], C.ink, 1.4);
      stroke(ctx, [[xa - 14, ia], [xb + 30, ia]], C.muted, 0.8, [3, 3]); stroke(ctx, [[xb - 14, ib], [xb + 30, ib]], C.muted, 0.8, [3, 3]);
      if (hpx > 4) dimV(ctx, xb + 26, ia, ib, label);
      else txt(ctx, label, xb + 30, ib, { mono: true, size: 11, bg: C.bg });
    }
    // straight horizontal duct with walls, fluid fill and moving particles
    function duct(ctx, A, key, x0, x1, yc, r, v, air, dt) {
      ctx.fillStyle = air ? C.air : C.water; ctx.globalAlpha = air ? 0.5 : 0.35; ctx.fillRect(x0, yc - r, x1 - x0, 2 * r); ctx.globalAlpha = 1;
      stroke(ctx, [[x0, yc - r], [x1, yc - r]], C.wall, 3); stroke(ctx, [[x0, yc + r], [x1, yc + r]], C.wall, 3);
      for (let k = -1; k <= 1; k++) flowDots(ctx, A, key + k, [[x0, yc + k * r * 0.5], [x1, yc + k * r * 0.5]], v, dt, C.part);
    }
    // tube whose radius varies along x: prof = [[x, r], …]
    function shapedTube(ctx, prof, yc, air) {
      const top = prof.map((p) => [p[0], yc - p[1]]), bot = prof.map((p) => [p[0], yc + p[1]]);
      poly(ctx, top.concat(bot.slice().reverse()), true); ctx.fillStyle = air ? C.air : C.water; ctx.globalAlpha = air ? 0.5 : 0.35; ctx.fill(); ctx.globalAlpha = 1;
      stroke(ctx, top, C.wall, 3); stroke(ctx, bot, C.wall, 3);
    }
    function bars(ctx, W, H, title, groups, unit) {
      // groups: [{name, items:[[label, value, color]]}]
      txt(ctx, title, 14, 14, { bold: true });
      const all = groups.flatMap((g) => g.items.map((i) => i[1])), mx = Math.max(...all, 0), mn = Math.min(...all, 0), rg = mx - mn || 1;
      const top = 40, bot = H - 34, Y = (v) => bot - ((v - mn) / rg) * (bot - top);
      const n = groups.reduce((s, g) => s + g.items.length, 0) + groups.length - 1, bw = Math.min(70, (W - 40) / n - 8);
      let x = 24;
      stroke(ctx, [[14, Y(0)], [W - 10, Y(0)]], C.muted, 1);
      groups.forEach((g) => {
        const gx = x;
        g.items.forEach((it) => { const y0 = Y(0), y1 = Y(it[1]); ctx.fillStyle = it[2]; ctx.globalAlpha = 0.8; ctx.fillRect(x, Math.min(y0, y1), bw, Math.abs(y1 - y0)); ctx.globalAlpha = 1; txt(ctx, fmt(it[1]), x + bw / 2, Math.min(y0, y1) - 8, { align: 'center', size: 10.5, mono: true }); txt(ctx, it[0], x + bw / 2, bot + 12, { align: 'center', size: 10.5 }); x += bw + 8; });
        if (g.name) txt(ctx, g.name, (gx + x - 8) / 2, bot + 26, { align: 'center', size: 11, bold: true });
        x += bw + 8;
      });
      if (unit) txt(ctx, unit, W - 12, 14, { align: 'right', size: 11, color: C.muted });
    }

    /* ================================================================ Flow measurement */
    const meterModes = ['pitot', 'venturi', 'nozzle', 'bern'];
    const usesMano = (P, m) => (m === 'pitot' && (P.psolve === 'h' || P.pread === 'mano')) || (m === 'venturi' && (P.msolve === 'h' || P.read === 'mano'));
    const MF = {
      id: 'meter', tab: 'Flow Measurement', title: 'Flow Measurement: Bernoulli, Venturi, Nozzles, Orifice Meters and Pitot Tubes', fn: 'meter',
      modes: [['pitot', 'Pitot tube'], ['venturi', 'Venturi, flow nozzle or orifice meter'], ['nozzle', 'Nozzle at the end of a pipe'], ['bern', 'Bernoulli between two sections']],
      speed: {},
      modeDefaults: { pitot: { Sgm: 13.6 }, venturi: { D1: 300, D2: 150, Sgm: 13.6 }, nozzle: { D1: 100, D2: 50, p1: 80 }, bern: { D1: 300, D2: 150, p1: 100, p2: 50, Q: 0.1 } },
      params: [
        { k: 'Sg', label: 'Flowing fluid specific gravity Sg', min: 0.0005, max: 13.6, step: 0.00001, def: 1, log: true, chips: [['Water', 1], ['Air', 0.00122], ['Oil', 0.8], ['CCl₄', 1.6]] },
        // Pitot
        { k: '_hp', type: 'head', label: 'Pitot tube', modes: ['pitot'] },
        { k: 'psolve', type: 'select', label: 'Solve for', def: 'V', options: [['V', 'Velocity from the reading'], ['h', 'Manometer reading for a velocity']], modes: ['pitot'] },
        { k: 'pread', type: 'select', label: 'Reading taken as', def: 'mano', options: [['mano', 'Differential manometer deflection'], ['heads', 'Static and stagnation tube heights'], ['dp', 'Stagnation − static pressure']], show: (P, m) => m === 'pitot' && P.psolve === 'V' },
        { k: 'hst', label: 'Stagnation (Pitot) tube head h_s', dim: 'len', min: 0, max: 100, step: 0.001, def: 5.67, show: (P, m) => m === 'pitot' && P.psolve === 'V' && P.pread === 'heads' },
        { k: 'h0', label: 'Static (piezometer) head h₀', dim: 'len', min: 0, max: 100, step: 0.001, def: 4.73, show: (P, m) => m === 'pitot' && P.psolve === 'V' && P.pread === 'heads' },
        { k: 'dpP', label: 'Stagnation − static pressure', dim: 'kPa', min: 0, max: 2000, step: 0.001, def: 5, show: (P, m) => m === 'pitot' && P.psolve === 'V' && P.pread === 'dp' },
        { k: 'Vp', label: 'Velocity V', dim: 'vel', min: 0.01, max: 300, step: 0.01, def: 1.42, show: (P, m) => m === 'pitot' && P.psolve === 'h' },
        { k: 'Cp', label: 'Pitot tube coefficient C', min: 0.9, max: 1.05, step: 0.001, def: 1, modes: ['pitot'] },
        // Meter
        { k: '_hv', type: 'head', label: 'Meter', modes: ['venturi'] },
        { k: 'mtype', type: 'select', label: 'Meter type', def: 'venturi', options: [['venturi', 'Venturi meter'], ['nozzle', 'Flow nozzle'], ['orifice', 'Orifice meter (sharp plate)']], modes: ['venturi'], onSet: (P) => { P.Cm = { venturi: 0.98, nozzle: 0.97, orifice: 0.61 }[P.mtype]; } },
        { k: 'msolve', type: 'select', label: 'Solve for', def: 'Q', options: [['Q', 'Discharge from the reading'], ['C', 'Meter coefficient from a measured Q'], ['h', 'Manometer reading for a given Q']], modes: ['venturi'] },
        { k: 'read', type: 'select', label: 'Reading taken as', def: 'mano', options: [['mano', 'Differential manometer deflection'], ['p', 'Pressure gauges p₁ and p₂'], ['dh', 'Piezometric head drop Δh']], show: (P, m) => m === 'venturi' && P.msolve !== 'h' },
        { k: 'dhG', label: 'Piezometric head drop Δh', dim: 'len', min: 0.001, max: 200, step: 0.001, def: 1.1, show: (P, m) => m === 'venturi' && P.msolve !== 'h' && P.read === 'dh' },
        // sections (shared)
        { k: 'D1', label: 'Pipe (inlet) diameter D₁', labelFn: (P, m) => (m === 'nozzle' ? 'Pipe (base) diameter D₁' : m === 'bern' ? 'Diameter at section 1 D₁' : 'Pipe (inlet) diameter D₁'), dim: 'mm', min: 5, max: 3000, step: 1, def: 300, modes: ['venturi', 'nozzle', 'bern'] },
        { k: 'D2', label: 'Throat diameter D₂', labelFn: (P, m) => (m === 'nozzle' ? 'Nozzle tip diameter D₂' : m === 'bern' ? 'Diameter at section 2 D₂' : P.mtype === 'orifice' ? 'Orifice diameter D₂' : 'Throat diameter D₂'), dim: 'mm', min: 2, max: 3000, step: 1, def: 150, modes: ['venturi', 'nozzle', 'bern'] },
        { k: 'cby', type: 'select', label: 'Coefficient C', def: 'given', options: [['given', 'Enter C'], ['curve', 'From the standard curve C(Re) (iterated)']], show: (P, m) => m === 'venturi' && P.msolve !== 'C' && P.mtype !== 'venturi' },
        { k: 'ntype', type: 'select', label: 'Nozzle', def: 'lr', options: [['lr', 'Long-radius (ASME) nozzle'], ['isa', 'ISA 1932 nozzle']], show: (P, m) => m === 'venturi' && P.msolve !== 'C' && P.mtype === 'nozzle' && P.cby === 'curve' },
        { k: 'taps', type: 'select', label: 'Pressure taps', def: 'corner', options: [['corner', 'Corner taps (vena contracta region)'], ['flange', 'Flange taps (25 mm)'], ['D2', 'D and D/2 taps']], show: (P, m) => m === 'venturi' && P.msolve !== 'C' && P.mtype === 'orifice' && P.cby === 'curve' },
        { k: 'nuM', label: 'Kinematic viscosity ν of the flowing fluid', dim: 'nu', min: 0.01, max: 100000, step: 0.001, def: 1.003, log: true, chips: [['Water 20°C', 1.003], ['Water 30°C', 0.801], ['Water 10°C', 1.306]], show: (P, m) => m === 'venturi' && P.mtype !== 'venturi' && (P.cby === 'curve' || P.msolve === 'C') },
        { k: 'Cm', label: 'Meter coefficient C', min: 0.5, max: 1.05, step: 0.001, def: 0.98, show: (P, m) => m === 'venturi' && P.msolve !== 'C' && !(P.cby === 'curve' && P.mtype !== 'venturi') },
        // nozzle
        { k: 'nsolve', type: 'select', label: 'Solve for', def: 'Q', options: [['Q', 'Discharge from the base pressure'], ['p', 'Base pressure for a given Q']], modes: ['nozzle'] },
        { k: 'Cv', label: 'Coefficient of velocity C_v', min: 0.8, max: 1, step: 0.001, def: 0.96, modes: ['nozzle'] },
        { k: 'Cc', label: 'Coefficient of contraction C_c', min: 0.5, max: 1, step: 0.001, def: 1, modes: ['nozzle'] },
        { k: 'dzN', label: 'Base above the tip Δz', dim: 'len', min: -50, max: 50, step: 0.001, def: 0, modes: ['nozzle'] },
        // Bernoulli
        { k: 'bsolve', type: 'select', label: 'Solve for', def: 'Q', options: [['Q', 'Discharge from p₁ and p₂'], ['p2', 'p₂ from Q and p₁'], ['p1', 'p₁ from Q and p₂']], modes: ['bern'] },
        { k: 'z1', label: 'Elevation of section 1 z₁', dim: 'len', min: -200, max: 500, step: 0.01, def: 0, modes: ['bern'] },
        { k: 'z2', label: 'Elevation of section 2 z₂', dim: 'len', min: -200, max: 500, step: 0.01, def: 0, modes: ['bern'] },
        { k: 'hL', label: 'Head loss from 1 to 2 h_L', dim: 'len', min: 0, max: 200, step: 0.001, def: 0, modes: ['bern'] },
        // pressures and flow
        { k: 'p1', label: 'Pressure p₁', labelFn: (P, m) => (m === 'nozzle' ? 'Pressure at the base p₁' : 'Pressure p₁'), dim: 'kPa', min: -100, max: 10000, step: 0.01, def: 100, show: (P, m) => (m === 'venturi' && P.msolve !== 'h' && P.read === 'p') || (m === 'nozzle' && P.nsolve === 'Q') || (m === 'bern' && P.bsolve !== 'p1') },
        { k: 'p2', label: 'Pressure p₂', labelFn: (P, m) => (m === 'venturi' ? 'Pressure at the throat p₂' : 'Pressure p₂'), dim: 'kPa', min: -100, max: 10000, step: 0.01, def: 50, show: (P, m) => (m === 'venturi' && P.msolve !== 'h' && P.read === 'p') || (m === 'bern' && P.bsolve !== 'p2') },
        { k: 'dz', label: 'Throat tap above the inlet tap z₂ − z₁', dim: 'len', min: -50, max: 50, step: 0.001, def: 0, show: (P, m) => m === 'venturi' && ((P.msolve !== 'h' && P.read === 'p') || P.msolve === 'h') },
        { k: 'Q', label: 'Discharge Q', dim: 'Q', min: 0.00001, max: 100, step: 0.00001, def: 0.05, log: true, show: (P, m) => (m === 'venturi' && P.msolve !== 'Q') || (m === 'nozzle' && P.nsolve === 'p') || (m === 'bern' && P.bsolve !== 'Q') },
        // gauge
        { k: '_hm', type: 'head', label: 'Differential manometer', show: usesMano },
        { k: 'hm', label: 'Manometer deflection h', dim: 'len', min: 0, max: 20, step: 0.0001, def: 0.2, show: (P, m) => usesMano(P, m) && !((m === 'pitot' && P.psolve === 'h') || (m === 'venturi' && P.msolve === 'h')) },
        { k: 'Sgm', label: 'Gauge liquid specific gravity S_m', min: 0.0001, max: 13.6, step: 0.0001, def: 13.6, log: true, chips: [['Mercury', 13.6], ['Water', 1], ['CCl₄', 1.6], ['Sg 1.25', 1.25], ['Air', 0.0012]], show: usesMano }
      ],
      presets: [
        { name: 'Schaum 12.1 — Pitot tube heads 5.67 m and 4.73 m, C = 0.98', mode: 'pitot', set: { psolve: 'V', pread: 'heads', hst: 5.67, h0: 4.73, Cp: 0.98 } },
        { name: 'Schaum 12.2 (English) — Pitot tube in air, 4 in water gauge, C = 0.98', mode: 'pitot', units: 'EN', set: { psolve: 'V', pread: 'mano', Sg: 0.00122, Sgm: 1, hm: 0.3333, Cp: 0.98 } },
        { name: 'Schaum 12.3 — CCl₄ (Sg 1.6), mercury gauge reads 76 mm', mode: 'pitot', set: { psolve: 'V', pread: 'mano', Sg: 1.6, Sgm: 13.6, hm: 0.076, Cp: 1 } },
        { name: 'Schaum 12.4 — gauge reading for V = 1.42 m/s, gauge liquid Sg 1.25', mode: 'pitot', set: { psolve: 'h', Vp: 1.42, Sgm: 1.25, Cp: 1 } },
        { name: 'Schaum 12.17 (English) — 12 in × 6 in Venturi, Q = 1.49 cfs, find C', mode: 'venturi', units: 'EN', set: { mtype: 'venturi', msolve: 'C', read: 'mano', D1: 12, D2: 6, Q: 1.49, hm: 3.5, Sgm: 1.25 } },
        { name: 'Schaum 12.18 — 300 × 150 mm Venturi, C = 0.98, gauge (Sg 1.25) reads 1.18 m', mode: 'venturi', set: { mtype: 'venturi', msolve: 'Q', read: 'mano', D1: 300, D2: 150, Cm: 0.98, hm: 1.18, Sgm: 1.25 } },
        { name: 'Schaum 12.21 — 150 mm orifice in a 250 mm pipe, Δh = 1.10 m, C = 0.609', mode: 'venturi', set: { mtype: 'orifice', msolve: 'Q', read: 'dh', D1: 250, D2: 150, Cm: 0.609, dhG: 1.1 } },
        { name: 'Schaum 12.21 with C from the orifice curve — 150 mm in 250 mm, Δh 1.10 m, water 20 °C (C 0.608, Q 0.0535; book reads 0.609 off Diagram C)', mode: 'venturi', set: { mtype: 'orifice', msolve: 'Q', read: 'dh', D1: 250, D2: 150, cby: 'curve', taps: 'corner', nuM: 1.003, dhG: 1.1 } },
        { name: 'Schaum 12.19 (English) — 4 in orifice in an 8 in pipe, water 100 °F, 0.525 cfs: C from the curve (Δh 1.43 ft of water; book 1.44 with 0.604)', mode: 'venturi', units: 'EN', set: { mtype: 'orifice', msolve: 'h', D1: 8, D2: 4, Q: 0.525, cby: 'curve', taps: 'corner', nuM: 0.739, Sgm: 13.6 } },
        { name: 'Long-radius nozzle 75 mm in a 150 mm pipe, 152 mm of mercury, water 20 °C: Q with C(Re) iterated', mode: 'venturi', set: { mtype: 'nozzle', msolve: 'Q', read: 'mano', D1: 150, D2: 75, cby: 'curve', ntype: 'lr', nuM: 1.003, hm: 0.152, Sgm: 13.6 } },
        { name: 'Venturi: mercury gauge reading needed for 60 L/s', mode: 'venturi', set: { mtype: 'venturi', msolve: 'h', D1: 300, D2: 150, Cm: 0.98, Q: 0.06, Sgm: 13.6 } },
        { name: 'Schaum 12.15 — pressure head at the nozzle base for 27 L/s (C_v 0.95, C_c 0.93)', mode: 'nozzle', set: { nsolve: 'p', D1: 100, D2: 50, Cv: 0.95, Cc: 0.93, Q: 0.027, dzN: 0 } },
        { name: 'Schaum 12.16 — nozzle pointing down, 7.92 m head at the base, jet power', mode: 'nozzle', set: { nsolve: 'Q', D1: 100, D2: 50, Cv: 0.962, Cc: 1, p1: 77.695, dzN: 0.914 } },
        { name: 'Reducer 300 → 150 mm, 100 kPa → 50 kPa, level: find Q', mode: 'bern', set: { bsolve: 'Q', D1: 300, D2: 150, p1: 100, p2: 50, z1: 0, z2: 0, hL: 0 } },
        { name: 'Rising pipe 300 → 200 mm, Q = 0.15, p₁ = 200 kPa, 6 m higher, 1.5 m loss: p₂', mode: 'bern', set: { bsolve: 'p2', D1: 300, D2: 200, Q: 0.15, p1: 200, z1: 0, z2: 6, hL: 1.5 } }
      ],
      hint: 'The manometer is drawn hanging below the pipe when the gauge liquid is heavier than the flowing fluid, and upside-down above it when it is lighter. Dots move at the local velocity.'
    };

    MF.draw = function (ctx, W, H, R, A, T) {
      const d = R.data, U = S.U, I = S.I, L = U.L, air = isAir(I.Sg);
      bg(ctx, W, H);
      const flowCol = air ? C.air : C.water, gaugeCol = I.Sgm > 5 ? '#8c96a3' : I.Sgm < 0.05 ? C.air : '#d9822b';
      if (d.kind === 'pitot') {
        const yc = I.psolve === 'V' && I.pread === 'heads' ? H * 0.7 : H * 0.42, r = clamp(H * 0.12, 22, 46), x0 = W * 0.04, x1 = W * 0.96, xs = W * 0.34, xp = W * 0.58;
        duct(ctx, A, 'pt', x0, x1, yc, r, d.V, air, T.pdt);
        // Pitot tube: mouth faces upstream
        stroke(ctx, [[xp - W * 0.09, yc], [xp, yc], [xp, yc + r + 2]], C.ink, 4);
        ctx.beginPath(); ctx.arc(xp - W * 0.09, yc, 2.5, 0, 2 * PI); ctx.fillStyle = C.danger; ctx.fill();
        txt(ctx, 'stagnation point', xp - W * 0.09, yc - 12, { size: 10.5, color: C.danger, align: 'center', bg: C.bg });
        txt(ctx, 'static tap', xs, yc - r - 10, { size: 10.5, color: C.muted, align: 'center' });
        arrow(ctx, x0 + 8, yc - r * 0.5, x0 + 60, yc - r * 0.5, C.ink, 2);
        txt(ctx, `V = ${fmt(d.V)} ${U.v}`, x0 + 66, yc - r * 0.5, { mono: true, bold: true, size: 12, bg: C.bg });
        if (I.psolve === 'V' && I.pread === 'heads') {
          // open piezometer and Pitot tubes standing above the pipe
          const top = 46, base = yc - r, sc = (base - top) / Math.max(I.hst, I.h0, 1e-9);
          [[xs, I.h0, 'h₀'], [xp, I.hst, 'h_s']].forEach(([x, h, n]) => {
            ctx.fillStyle = flowCol; ctx.globalAlpha = 0.45; ctx.fillRect(x - 3, base - h * sc, 6, h * sc); ctx.globalAlpha = 1;
            stroke(ctx, [[x - 4, base], [x - 4, top - 6]], C.ink, 1.3); stroke(ctx, [[x + 4, base], [x + 4, top - 6]], C.ink, 1.3);
            stroke(ctx, [[x - 9, base - h * sc], [x + 9, base - h * sc]], C.water_deep, 1.5);
            if (x === xs) dimV(ctx, x - 16, base, base - h * sc, `${n} = ${fmt(h)} ${L}`, null, 'left'); else dimV(ctx, x + 16, base, base - h * sc, `${n} = ${fmt(h)} ${L}`);
          });
          const xm = (xs + xp) / 2;
          stroke(ctx, [[xs, base - I.h0 * sc], [xm + 8, base - I.h0 * sc]], C.muted, 0.8, [3, 3]); stroke(ctx, [[xm - 8, base - I.hst * sc], [xp, base - I.hst * sc]], C.muted, 0.8, [3, 3]);
          dimV(ctx, xm, base - I.h0 * sc, base - I.hst * sc, `Δh = ${fmt(d.dh)} ${L}`);
          stroke(ctx, [[xs, yc - r], [xs, yc - r - 2]], C.ink, 2);
        } else if (I.psolve === 'V' && I.pread === 'dp') {
          stroke(ctx, [[xs, yc + r], [xs, yc + r + 40], [W * 0.44, yc + r + 40]], C.ink, 1.5); stroke(ctx, [[xp, yc + r], [xp, yc + r + 40], [W * 0.48, yc + r + 40]], C.ink, 1.5);
          ctx.fillStyle = C.bg; ctx.fillRect(W * 0.44, yc + r + 28, W * 0.04, 24); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.strokeRect(W * 0.44, yc + r + 28, W * 0.04, 24);
          txt(ctx, `Δp = ${fmt(I.dpP)} ${U.p}`, W * 0.46, yc + r + 66, { align: 'center', mono: true, size: 12, bold: true });
        } else {
          const dir = I.Sgm >= I.Sg ? 1 : -1, yTap = dir > 0 ? yc + r : yc - r, room = dir > 0 ? H - yTap - 20 : yTap - 30;
          const hpx = clamp(room * 0.5, 6, room * 0.6);
          uTube(ctx, xs, xp, yTap, dir, room * 0.9, hpx, flowCol, gaugeCol, `h = ${fmt(I.psolve === 'h' ? d.dh / Math.abs(I.Sgm / I.Sg - 1) : I.hm)} ${L}`);
          txt(ctx, `gauge liquid S_m = ${fmt(I.Sgm)}`, xs - 12, yTap + dir * room * 0.9 + dir * 14, { size: 11, color: C.muted, align: 'right' });
        }
        txt(ctx, `Pitot tube:  V = C√(2gΔh),  Δh = ${fmt(d.dh)} ${L} of ${air ? 'air' : 'flowing fluid'}`, 14, 18, { bold: true, mono: true, size: 12 });
        return;
      }
      if (d.kind === 'venturi') {
        const above = I.msolve !== 'h' && (I.read === 'p' || I.read === 'dh'), yc = above ? H * 0.56 : H * 0.36, r1 = clamp(H * 0.13, 22, 52), r2 = Math.max(6, r1 * (d.D2 / d.D1)), x0 = W * 0.04, x1 = W * 0.96;
        const xa = W * 0.2, xt = W * 0.46;
        let prof;
        if (d.mtype === 'venturi') prof = [[x0, r1], [W * 0.3, r1], [W * 0.42, r2], [W * 0.5, r2], [W * 0.82, r1], [x1, r1]];
        else if (d.mtype === 'nozzle') prof = [[x0, r1], [W * 0.34, r1], [W * 0.4, r1 * 0.75 + r2 * 0.25], [W * 0.44, r2], [W * 0.46, r2], [W * 0.46, r1], [x1, r1]];
        else prof = [[x0, r1], [x1, r1]];
        shapedTube(ctx, prof, yc, air);
        if (d.mtype === 'orifice') { ctx.fillStyle = C.wall; ctx.fillRect(W * 0.4 - 2, yc - r1, 4, r1 - r2); ctx.fillRect(W * 0.4 - 2, yc + r2, 4, r1 - r2); }
        const vdt = T.pdt;
        flowDots(ctx, A, 'v1', [[x0, yc], [W * 0.3, yc]], d.V1, vdt, C.part); flowDots(ctx, A, 'v2', [[W * 0.42, yc], [W * 0.5, yc]], d.V2, vdt, C.part); flowDots(ctx, A, 'v3', [[W * 0.82, yc], [x1, yc]], d.V1, vdt, C.part);
        [[x0 + 6, r1 * 0.5], [x0 + 6, -r1 * 0.5]].forEach(([x, o]) => flowDots(ctx, A, 'w' + o, [[x, yc + o], [W * 0.3, yc + o]], d.V1, vdt, C.part));
        const vy = above || I.Sgm < I.Sg ? yc + r1 + 30 : yc - r1 - 12;
        txt(ctx, `V₁ = ${fmt(d.V1)} ${U.v}`, W * 0.12, vy, { align: 'center', mono: true, size: 11, bg: C.bg });
        txt(ctx, `V₂ = ${fmt(d.V2)} ${U.v}`, W * 0.46, vy, { align: 'center', mono: true, size: 11, bg: C.bg });
        txt(ctx, `D₁ = ${mmOf(d.D1)}`, W * 0.12, yc + r1 + 14, { align: 'center', mono: true, size: 11, bg: C.bg });
        if (I.read === 'p' && I.msolve !== 'h') {
          [[xa, I.p1, 'p₁'], [xt, I.p2, 'p₂']].forEach(([x, p, n]) => { stroke(ctx, [[x, yc - r1], [x, yc - r1 - 26]], C.wall, 2); gauge(ctx, x, yc - r1 - 37, clamp(p / Math.max(I.p1, 1e-9), 0, 1), p < 0); txt(ctx, `${n} = ${fmt(p)} ${U.p}`, x, yc - r1 - 58, { align: 'center', mono: true, size: 11, bg: C.bg }); });
        } else if (I.read === 'dh' && I.msolve !== 'h') {
          // piezometers at the inlet tap and the throat / vena contracta (heights schematic)
          const yl1 = yc - r1 - 10, xv = d.mtype === 'orifice' ? W * 0.46 : xt;
          const lv1 = 46, lv2 = lv1 + (yl1 - lv1) * 0.6;
          [[xa, lv1], [xv, lv2]].forEach(([x, lv]) => { ctx.fillStyle = flowCol; ctx.globalAlpha = 0.45; ctx.fillRect(x - 3, lv, 6, yc - r1 - lv); ctx.globalAlpha = 1; stroke(ctx, [[x - 4, yc - r1], [x - 4, lv - 8]], C.ink, 1.3); stroke(ctx, [[x + 4, yc - r1], [x + 4, lv - 8]], C.ink, 1.3); stroke(ctx, [[x - 9, lv], [x + 9, lv]], C.water_deep, 1.5); });
          stroke(ctx, [[xa, lv1], [xv + 40, lv1]], C.hgl, 1, [4, 3]);
          dimV(ctx, xv + 34, lv1, lv2, `Δh = ${fmt(d.dh)} ${L}`);
          txt(ctx, 'piezometers (HGL)', xa - 8, lv1 - 2, { color: C.hgl, size: 10.5, align: 'right' });
        } else {
          const dir = I.Sgm >= I.Sg ? 1 : -1, yTap = dir > 0 ? yc + r1 : yc - r1, room = dir > 0 ? H - yTap - 20 : yTap - 30;
          const xt2 = d.mtype === 'orifice' ? W * 0.46 : xt;
          stroke(ctx, [[xt2, yc + dir * r2], [xt2, yTap]], C.ink, 1.2);
          uTube(ctx, xa, xt2, yTap, dir, room * 0.9, clamp(room * 0.5, 6, room * 0.6), flowCol, gaugeCol, `h = ${fmt(d.hm)} ${L}`, true);
          txt(ctx, `gauge liquid S_m = ${fmt(I.Sgm)}`, xa - 12, yTap + dir * room * 0.9 + dir * 14, { size: 11, color: C.muted, align: 'right' });
        }
        const nm = { venturi: 'Venturi meter', nozzle: 'Flow nozzle', orifice: 'Orifice meter' }[d.mtype];
        txt(ctx, `${nm}:  Q = ${fmt(d.Q)} ${U.Q},  Δh = ${fmt(d.dh)} ${L},  β = ${fmt(d.D2 / d.D1)}`, 14, 18, { bold: true, mono: true, size: 12 });
        return;
      }
      if (d.kind === 'nozzle') {
        const down = d.dzN > 1e-9, up = d.dzN < -1e-9, r1 = clamp(H * 0.08, 14, 30), r2 = Math.max(5, r1 * (d.D2 / d.D1));
        const vert = down || up, bx = vert ? W * 0.5 : W * 0.42, by = down ? H * 0.34 : up ? H * 0.74 : H * 0.42;
        const ax = vert ? 0 : 1, ay = down ? 1 : up ? -1 : 0, Ln = clamp(H * 0.2, 40, 90);
        // supply pipe from the left; for a vertical nozzle it ends in an elbow (closed end) and the nozzle leaves through the wall
        const x0 = W * 0.04, xe = vert ? bx + r1 : bx;
        ctx.fillStyle = C.water; ctx.globalAlpha = 0.35; ctx.fillRect(x0, by - r1, xe - x0, 2 * r1); ctx.globalAlpha = 1;
        stroke(ctx, [[x0, by - r1], [up ? bx - r1 : xe, by - r1]], C.wall, 3); stroke(ctx, [[x0, by + r1], [down ? bx - r1 : xe, by + r1]], C.wall, 3);
        if (vert) stroke(ctx, [[xe, by - r1], [xe, by + r1]], C.wall, 3);
        flowDots(ctx, A, 'np', vert ? [[x0, by], [bx, by], [bx, by + ay * r1]] : [[x0, by], [bx, by]], d.V1, T.pdt, C.part);
        // nozzle (trapezoid along the axis)
        const b0x = bx, b0y = by + ay * r1, nx = -ay, ny = ax, tipX = b0x + ax * Ln, tipY = b0y + ay * Ln;
        const quad = [[b0x + nx * r1, b0y + ny * r1], [tipX + nx * r2, tipY + ny * r2], [tipX - nx * r2, tipY - ny * r2], [b0x - nx * r1, b0y - ny * r1]];
        poly(ctx, quad, true); ctx.fillStyle = C.water; ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1;
        stroke(ctx, [quad[0], quad[1]], C.wall, 3); stroke(ctx, [quad[3], quad[2]], C.wall, 3);
        flange(ctx, b0x, b0y, Math.atan2(ay, ax), 2 * r1);
        // jet
        const g = U.g, jet = [], rj = r2 * Math.sqrt(d.Cc), Lc = (d.Vj * d.Vj) / g || 1, kpx = Math.min(W * 0.45, H * 0.5) / Lc, tc = d.Vj / g || 1;
        for (let k = 0; k <= 80; k++) { const t = (k / 40) * tc; const xw = d.Vj * ax * t, yw = d.Vj * -ay * t - 0.5 * g * t * t; const px = tipX + xw * kpx, py = tipY - yw * kpx; if (px > W - 4 || py > H - 4 || py < 4) break; jet.push([px, py]); if (up && t > tc) break; }
        if (jet.length > 1) { stroke(ctx, jet, C.water, Math.max(3, 2 * rj)); flowDots(ctx, A, 'jet', jet, d.Vj, T.pdt, C.part); }
        txt(ctx, `V_j = ${fmt(d.Vj)} ${U.v}`, tipX + 14, tipY + (down ? 20 : -18), { mono: true, size: 12, bold: true, bg: C.bg });
        // base gauge
        stroke(ctx, [[bx - r1 * 2.2, by - r1], [bx - r1 * 2.2, by - r1 - 22]], C.wall, 2); gauge(ctx, bx - r1 * 2.2, by - r1 - 33, 0.7, d.p1 < 0);
        txt(ctx, `p₁ = ${fmt(d.p1)} ${U.p}`, bx - r1 * 2.2 - 16, by - r1 - 33, { align: 'right', mono: true, size: 11, bg: C.bg });
        txt(ctx, `D₁ = ${mmOf(d.D1)}`, W * 0.14, by + r1 + 14, { align: 'center', mono: true, size: 11, bg: C.bg });
        txt(ctx, `tip ${mmOf(d.D2)}`, tipX + (down || up ? 14 : 0), tipY + (down || up ? 0 : r2 + 14), { align: down || up ? 'left' : 'center', mono: true, size: 11, bg: C.bg });
        if (vert) dimV(ctx, bx - r1 - 34, b0y, tipY, `Δz = ${fmt(Math.abs(d.dzN))} ${U.L}`, null, 'left');
        txt(ctx, `Nozzle: Q = ${fmt(d.Q)} ${U.Q},  p₁/γ = ${fmt(d.p1 / (I.Sg * U.gw))} ${U.L}`, 14, 18, { bold: true, mono: true, size: 12 });
        return;
      }
      // Bernoulli between sections 1 and 2
      const { z1, z2, E1, E2, V1, V2, gf } = d, g = U.g;
      const hv1 = (V1 * V1) / (2 * g), hv2 = (V2 * V2) / (2 * g), H1 = E1 - hv1, H2 = E2 - hv2;
      const vals = [z1, z2, E1, E2, H1, H2, 0, z1 - ((z2 - z1) * 14) / 64, z2 + ((z2 - z1) * 14) / 64]; let lo = Math.min(...vals), hi = Math.max(...vals); const rg = Math.max(hi - lo, 1); lo -= 0.25 * rg; hi += 0.15 * rg;
      const V = view({ x0: 0, x1: 100, y0: lo, y1: hi }, W, H, { l: 16, r: 16, t: 36, b: 16 }, false), X = V.X, Y = V.Y;
      if (lo < 0 && hi > 0) datum(ctx, 0, W, Y(0), 'Datum  z = 0');
      const xa = 18, xb = 82, xm = 50, Dm = Math.max(d.D1, d.D2), w1 = clamp(8 + 22 * (d.D1 / Dm), 8, 30), w2 = clamp(8 + 22 * (d.D2 / Dm), 8, 30);
      const zAt = (x) => z1 + ((z2 - z1) * (x - xa)) / (xb - xa), zm = zAt(xm);
      pipe3(ctx, X(4), Y(zAt(4)), X(xm - 4), Y(zAt(xm - 4)), w1); pipe3(ctx, X(xm + 4), Y(zAt(xm + 4)), X(96), Y(zAt(96)), w2);
      poly(ctx, [[X(xm - 4), Y(zAt(xm - 4)) - w1 / 2], [X(xm + 4), Y(zAt(xm + 4)) - w2 / 2], [X(xm + 4), Y(zAt(xm + 4)) + w2 / 2], [X(xm - 4), Y(zAt(xm - 4)) + w1 / 2]], true); ctx.fillStyle = shade(C.pipe, 1.1); ctx.fill();
      const vdt = T.pdt;
      flowDots(ctx, A, 'b1', [[X(4), Y(zAt(4))], [X(xm), Y(zm)]], V1, vdt, C.bg); flowDots(ctx, A, 'b2', [[X(xm), Y(zm)], [X(96), Y(zAt(96))]], V2, vdt, C.bg);
      [[xa, z1, H1, E1, d.p1, '1', w1], [xb, z2, H2, E2, d.p2, '2', w2]].forEach(([x, z, hg, e, p, n, w]) => {
        stroke(ctx, [[X(x), Y(z) - w / 2], [X(x), Y(z) + w / 2]], C.ink, 2);
        txt(ctx, n, X(x), Y(z) + w / 2 + 12, { align: 'center', bold: true, size: 13 });
        txt(ctx, `p${n === '1' ? '₁' : '₂'} = ${fmt(p)} ${U.p}`, X(x) - 4, H - 10, { align: 'left', mono: true, size: 11, bg: C.bg, color: p < 0 ? C.danger : C.ink });
        if (S.egl) { dimV(ctx, X(x) + 8, Y(z), Y(hg), `p/γ = ${fmt(hg - z)}`); dimV(ctx, X(x) + 8, Y(hg), Y(e), `V²/2g = ${fmt(e - hg)}`); }
        if (Math.abs(z) > 1e-9) dimV(ctx, X(x) - 10, Y(0), Y(z), `z = ${fmt(z)}`, null, 'left');
      });
      if (S.egl) {
        stroke(ctx, [[X(4), Y(E1)], [X(96), Y(E2)]], C.egl, 2); stroke(ctx, [[X(4), Y(H1)], [X(xm - 4), Y(H1 - (E1 - E2) * 0.42)], [X(xm + 4), Y(H2 + (E1 - E2) * 0.42)], [X(96), Y(H2)]], C.hgl, 2, [7, 5]);
        txt(ctx, 'EGL', X(4), Y(E1) - 10, { color: C.egl, bold: true }); txt(ctx, 'HGL', X(4), Y(H1) + 12, { color: C.hgl, bold: true });
        if (d.hL > 0) txt(ctx, `h_L = ${fmt(d.hL)} ${U.L}`, X(96), Y(E2) - 10, { align: 'right', color: C.egl, mono: true, size: 11 });
      }
      txt(ctx, `Q = ${fmt(d.Q)} ${U.Q},  V₁ = ${fmt(V1)},  V₂ = ${fmt(V2)} ${U.v}`, 14, 18, { bold: true, mono: true, size: 12 });
    };
    MF.drawAux = function (ctx, W, H, R) {
      const d = R.data, U = S.U, I = S.I, g = U.g; bg(ctx, W, H);
      const rect = { x: 0, y: 0, w: W, h: H };
      if (d.kind === 'pitot') {
        const xs = [], ys = [], mx = Math.max(d.dh * 2, 1e-6); for (let i = 0; i <= 60; i++) { const h = (mx * i) / 60; xs.push(h); ys.push(I.Cp * Math.sqrt(2 * g * h)); }
        plot(ctx, rect, { title: `Velocity vs head difference (V = C√(2gΔh))`, xs, series: [{ ys, color: C.water_deep }], xlab: `Δh (${U.L} of flowing fluid)`, ylab: U.v, pts: [{ x: d.dh, y: d.V, color: C.egl, label: `${fmt(d.V)} ${U.v}` }] });
      } else if (d.kind === 'venturi') {
        const kb = 1 - Math.pow(d.D2 / d.D1, 4), A2 = (PI * d.D2 * d.D2) / 4, Cm = d.Q / (A2 * Math.sqrt((2 * g * d.dh) / kb));
        const xs = [], ys = [], mx = Math.max(d.dh * 2, 1e-6); for (let i = 0; i <= 60; i++) { const h = (mx * i) / 60; xs.push(h); ys.push(Cm * A2 * Math.sqrt((2 * g * h) / kb)); }
        plot(ctx, rect, { title: 'Meter calibration: Q vs piezometric head drop (Q ∝ √Δh)', xs, series: [{ ys, color: C.water_deep }], xlab: `Δh (${U.L})`, ylab: U.Q, pts: [{ x: d.dh, y: d.Q, color: C.egl, label: `${fmt(d.Q)} ${U.Q}` }] });
      } else if (d.kind === 'nozzle') {
        const gf = I.Sg * U.gw, Aj = d.Cc * (PI * d.D2 * d.D2) / 4, r = Math.pow(Aj / ((PI * d.D1 * d.D1) / 4), 2);
        const h0 = d.p1 / gf + d.dzN, xs = [], ys = [], mx = Math.max(h0 * 2, 1e-6);
        for (let i = 0; i <= 60; i++) { const h = (mx * i) / 60; xs.push(h); ys.push(Aj * Math.sqrt(Math.max(0, (2 * g * h) / (1 / (I.Cv * I.Cv) - r)))); }
        plot(ctx, rect, { title: 'Nozzle discharge vs head at the base (p₁/γ + Δz)', xs, series: [{ ys, color: C.water_deep }], xlab: `p₁/γ + Δz (${U.L})`, ylab: U.Q, pts: [{ x: h0, y: d.Q, color: C.egl, label: `${fmt(d.Q)} ${U.Q}` }] });
      } else {
        const hv = (v) => (v * v) / (2 * g), gf = d.gf;
        bars(ctx, W, H, `Energy at each section (${U.L} of fluid)`, [
          { name: 'Section 1', items: [['z', d.z1, C.wall], ['p/γ', d.p1 / gf, C.hgl], ['V²/2g', hv(d.V1), C.water_deep], ['E', d.E1, C.egl]] },
          { name: 'Section 2', items: [['z', d.z2, C.wall], ['p/γ', d.p2 / gf, C.hgl], ['V²/2g', hv(d.V2), C.water_deep], ['E', d.E2, C.egl]] }
        ], U.L);
      }
    };
    insertAfter('orifice', MF);

    /* ================================================================ Pipe design & networks */
    const NG = {}; ['1x1', '1x2', '1x3', '2x1', '2x2'].forEach((g) => (NG[g] = root.HP.netGrid(g)));
    const MAXP = 12, MAXN = 9;
    const single = (m) => m !== 'net';
    const sizeShown = (P, m) => single(m) && m !== 'D' && !(m === 'inv' && P.pinv === 'Dlam');
    const netP = [];
    for (let i = 1; i <= MAXP; i++) {
      const has = (P, m) => m === 'net' && NG[P.grid].pipes.length >= i;
      const nm = (P) => (NG[P.grid].pipes[i - 1] || {}).name || '';
      netP.push(
        { k: '_np' + i, type: 'head', label: '', labelFn: (P) => `Pipe ${nm(P)}`, show: has },
        { k: 'nL' + i, label: 'Length L', dim: 'len', min: 1, max: 50000, step: 1, def: i <= 6 ? 600 : 400, log: true, show: has },
        { k: 'nD' + i, label: 'Diameter D', dim: 'mm', min: 10, max: 5000, step: 1, def: i <= 6 ? 300 : 250, show: has },
        { k: 'nC' + i, label: 'Hazen-Williams C', min: 40, max: 160, step: 1, def: 120, show: (P, m) => has(P, m) && P.nform === 'hw' },
        { k: 'nF' + i, label: 'Darcy f', min: 0.005, max: 0.1, step: 0.0001, def: 0.02, show: (P, m) => has(P, m) && P.nform === 'darcy' },
        { k: 'nN' + i, label: 'Manning n', min: 0.008, max: 0.03, step: 0.0001, def: 0.012, show: (P, m) => has(P, m) && P.nform === 'manning' }
      );
    }
    const nodeP = [{ k: '_hq', type: 'head', label: 'Flow into each junction (+ in, − out)', modes: ['net'] }];
    for (let j = 1; j <= MAXN; j++) nodeP.push({ k: 'q' + j, label: '', labelFn: (P) => `Junction ${(NG[P.grid].nodes[j - 1] || {}).name}`, dim: 'Q', min: -100, max: 100, step: 0.0001, def: j === 1 ? 0.4 : j >= 5 && j <= 8 ? -0.1 : 0, show: (P, m) => m === 'net' && NG[P.grid].nodes.length >= j });
    const PD = {
      id: 'pdesign', tab: 'Pipe Design & Networks', title: 'Pipe Design: Head Loss, Discharge or Size of Pipes and Ducts, and Pipe Networks (Hardy Cross)', fn: 'pipeDesign',
      modes: [['hf', 'Head loss for a given Q'], ['Q', 'Discharge for a given head'], ['D', 'Size for a given head loss'], ['inv', 'Solve backwards: viscosity, critical velocity, laminar size, coefficients, length'], ['net', 'Pipe network (Hardy Cross)']],
      speed: {},
      modeDefaults: {},
      params: [
        { k: 'pinv', type: 'select', label: 'Find', def: 'nu', modes: ['inv'], options: [['nu', 'Viscosity for a given Reynolds number (e.g. laminar limit)'], ['Vcr', 'Critical velocity for a given Reynolds number'], ['Dlam', 'Pipe size at a given Reynolds number (laminar limit)'], ['mu', 'Viscosity from a measured laminar head loss'], ['coef', 'f, Hazen-Williams C and Manning n from a test'], ['L', 'Length for an allowable head loss']] },
        { k: 'Rec', label: 'Reynolds number Re (2000 = lower critical)', min: 1, max: 1e7, step: 1, def: 2000, log: true, modes: ['inv'], show: (P) => P.pinv === 'nu' || P.pinv === 'Vcr' || P.pinv === 'Dlam' },
        { k: 'byV', type: 'select', label: 'Flow given as', def: 'Q', modes: ['inv'], options: [['Q', 'Discharge Q'], ['V', 'Mean velocity V']], show: (P) => P.pinv === 'nu' || P.pinv === 'coef' || P.pinv === 'L' || P.pinv === 'mu' },
        { k: 'Vi', label: 'Mean velocity V', dim: 'vel', min: 0.0001, max: 100, step: 0.0001, def: 1, modes: ['inv'], show: (P) => P.byV === 'V' && P.pinv !== 'Vcr' && P.pinv !== 'Dlam' },
        { k: 'hBy', type: 'select', label: 'Measured loss given as', def: 'h', modes: ['inv'], options: [['h', 'Head loss h_f'], ['p', 'Pressure drop Δp']], show: (P) => P.pinv === 'mu' || P.pinv === 'coef' },
        { k: 'Hm', label: 'Measured head loss h_f', dim: 'len', min: 0.00001, max: 10000, step: 0.00001, def: 1, log: true, modes: ['inv'], show: (P) => (P.pinv === 'mu' || P.pinv === 'coef') && P.hBy !== 'p' },
        { k: 'dpm', label: 'Measured pressure drop Δp', dim: 'kPa', min: 0.00001, max: 100000, step: 0.00001, def: 10, log: true, modes: ['inv'], show: (P) => (P.pinv === 'mu' || P.pinv === 'coef') && P.hBy === 'p' },
        { k: 'pform', type: 'select', label: 'Friction formula', def: 'cole', options: [['cole', 'Darcy-Weisbach, f from Re (laminar 64/Re, Colebrook)'], ['darcy', 'Darcy-Weisbach, given f'], ['hw', 'Hazen-Williams C'], ['manning', 'Manning n']], show: single },
        { k: 'shape', type: 'select', label: 'Cross-section', def: 'circle', options: [['circle', 'Circular pipe'], ['square', 'Square duct'], ['rect', 'Rectangular duct'], ['annulus', 'Annulus (pipe inside a pipe)']], show: single },
        { k: 'D', label: 'Diameter D', labelFn: (P) => (P.shape === 'annulus' ? 'Outer diameter D' : 'Diameter D'), dim: 'mm', min: 2, max: 10000, step: 1, def: 300, show: (P, m) => sizeShown(P, m) && (P.shape === 'circle' || P.shape === 'annulus') },
        { k: 'a', label: 'Side a', labelFn: (P) => (P.shape === 'rect' ? 'Height a' : 'Side a'), dim: 'mm', min: 2, max: 10000, step: 1, def: 300, show: (P, m) => sizeShown(P, m) && (P.shape === 'square' || P.shape === 'rect') },
        { k: 'ar', label: 'Width ÷ height (width = ratio × a)', min: 0.05, max: 20, step: 0.01, def: 2, show: (P, m) => single(m) && P.shape === 'rect' },
        { k: 'Di', label: 'Inner pipe outside diameter', dim: 'mm', min: 1, max: 9000, step: 1, def: 100, show: (P, m) => single(m) && P.shape === 'annulus' },
        { k: 'L', label: 'Length L', dim: 'len', min: 0.1, max: 100000, step: 0.1, def: 1000, log: true, show: (P, m) => single(m) && !(m === 'inv' && P.pinv === 'L') },
        { k: 'Q', label: 'Discharge Q', dim: 'Q', min: 0.000001, max: 500, step: 0.000001, def: 0.1, log: true, show: (P, m) => single(m) && m !== 'Q' && !(m === 'inv' && (P.pinv === 'Vcr' || (P.byV === 'V' && P.pinv !== 'Dlam'))) },
        { k: 'H', label: 'Available head H', labelFn: (P, m) => (m === 'D' || m === 'inv' ? 'Allowable head loss H' : 'Available head H (all losses)'), dim: 'len', min: 0.0001, max: 1000, step: 0.0001, def: 5, log: true, show: (P, m) => m === 'Q' || m === 'D' || (m === 'inv' && P.pinv === 'L') },
        { k: 'K', label: 'Minor losses ΣK (entrance, bends, valves, exit)', min: 0, max: 100, step: 0.01, def: 0, show: single },
        { k: 'f', label: 'Darcy friction factor f', min: 0.005, max: 0.2, step: 0.0001, def: 0.02, show: (P, m) => single(m) && P.pform === 'darcy' },
        { k: 'eps', label: 'Wall roughness ε', dim: 'mm', min: 0, max: 10, step: 0.0001, def: 0.045, show: (P, m) => single(m) && P.pform === 'cole' },
        { k: 'C', label: 'Hazen-Williams C', min: 40, max: 160, step: 1, def: 120, show: (P, m) => single(m) && P.pform === 'hw' },
        { k: 'n', label: 'Manning n', min: 0.008, max: 0.04, step: 0.0001, def: 0.012, show: (P, m) => single(m) && P.pform === 'manning' },
        { k: 'nu', label: 'Kinematic viscosity ν', dim: 'nu', min: 0.01, max: 100000, step: 0.001, def: 1.003, log: true, show: (P, m) => single(m) && !(m === 'inv' && (P.pinv === 'nu' || P.pinv === 'mu' || P.pinv === 'coef')), chips: [['Water 20°C', 1.003], ['Water 10°C', 1.306], ['Air 20°C', 15.1]] },
        { k: 'Sg', label: 'Fluid specific gravity Sg', min: 0.0005, max: 13.6, step: 0.0001, def: 1, log: true, show: single, chips: [['Water', 1], ['Oil', 0.85], ['Air', 0.0012]] },
        { k: 'nform', type: 'select', label: 'Friction formula', def: 'hw', options: [['hw', 'Hazen-Williams C'], ['darcy', 'Darcy-Weisbach f'], ['manning', 'Manning n']], modes: ['net'] },
        { k: 'grid', type: 'select', label: 'Network layout (loops)', def: '1x3', options: [['1x1', '1 loop'], ['1x2', '2 loops side by side'], ['1x3', '3 loops side by side'], ['2x1', '2 loops stacked'], ['2x2', '4 loops (2 × 2)']], modes: ['net'] },
        { k: 'hA', label: 'HGL at junction A', dim: 'len', min: -1000, max: 5000, step: 0.01, def: 100, modes: ['net'] },
        { k: 'repN', type: 'select', label: 'Report pressure head at', def: '0', options: 'ABCDEFGHI'.split('').map((c, j) => [String(j), `Junction ${c}`]), modes: ['net'] },
        { k: 'zRep', label: 'Elevation of that junction', dim: 'len', min: -1000, max: 5000, step: 0.01, def: 0, modes: ['net'] },
        ...nodeP,
        ...netP
      ],
      prep: (I, P) => {
        if (I.mode !== 'net') return;
        const key = { hw: 'nC', darcy: 'nF', manning: 'nN' }[I.nform];
        for (let i = 1; i <= MAXP; i++) I['nc' + i] = I[key + i];
        const nN = NG[I.grid].nodes.length; for (let j = nN + 1; j <= MAXN; j++) I['q' + j] = 0;
        if (+I.repN >= nN) I.repN = '0';
      },
      post: (R, I) => {
        if (R.invalid || I.mode === 'net') return;
        const d = R.data, key = I.shape === 'circle' || I.shape === 'annulus' ? 'D' : 'a', qs = [], hs = [];
        for (let k = 1; k <= 40; k++) { const q = (2 * d.Q * k) / 40; const r = root.HP.pipeDesign(Object.assign({}, I, d.Iover || {}, { mode: 'hf', Q: q, [key]: d.s }), S.U); const t = r.results.find((x) => x.label === 'Total head loss'); qs.push(q); hs.push(t ? t.value : NaN); }
        d.curve = { qs, hs };
        const t = R.results.find((x) => x.label === 'Total head loss'); d.Htot = t ? t.value : NaN;
      },
      presets: [
        { name: 'Schaum 8.28 — 1 m cast iron pipe, C = 130, 845 m, h_f = 1.11 m: Q', mode: 'Q', set: { pform: 'hw', shape: 'circle', D: 1000, C: 130, L: 845, H: 1.11, K: 0 } },
        { name: 'Schaum 8.29 — the same pipe by Manning, n = 0.012', mode: 'Q', set: { pform: 'manning', shape: 'circle', D: 1000, n: 0.012, L: 845, H: 1.11, K: 0 } },
        { name: 'Schaum 8.32 (English) — 36 in, C = 120, 4000 ft, 12.7 ft of head: Q', mode: 'Q', units: 'EN', set: { pform: 'hw', shape: 'circle', D: 36, C: 120, L: 4000, H: 12.7, K: 0 } },
        { name: 'Schaum 8.36 — square concrete duct for 4 m³/s, C = 120, 45 m, h_f = 1.8 m', mode: 'D', set: { pform: 'hw', shape: 'square', C: 120, Q: 4, L: 45, H: 1.8, K: 0 } },
        { name: 'Schaum 8.52 — laminar oil, ν = 1.86 × 10⁻⁴ m²/s, 305 m, 0.089 m³/s, 0.161 m: size', mode: 'D', set: { pform: 'cole', shape: 'circle', nu: 186, L: 305, Q: 0.089, H: 0.161, K: 0, eps: 0 } },
        { name: 'Schaum 8.62 — 300 mm pipe, C = 110, 100 m, 0.177 m³/s: h_f', mode: 'hf', set: { pform: 'hw', shape: 'circle', D: 300, C: 110, L: 100, Q: 0.177, K: 0 } },
        { name: 'Schaum 8.70 — 250 mm, 915 m, C = 120, 0.142 m³/s: pressure drop', mode: 'hf', set: { pform: 'hw', shape: 'circle', D: 250, C: 120, L: 915, Q: 0.142, K: 0 } },
        { name: 'Commercial steel 300 mm, 1 km, 0.10 m³/s, f from the Moody chart', mode: 'hf', set: { pform: 'cole', shape: 'circle', D: 300, L: 1000, Q: 0.1, eps: 0.045, nu: 1.003, K: 0 } },
        { name: 'Air in a 400 × 200 mm duct, 2 m³/s over 50 m', mode: 'hf', set: { pform: 'cole', shape: 'rect', a: 200, ar: 2, L: 50, Q: 2, eps: 0.15, nu: 15.1, Sg: 0.0012, K: 0 } },
        { name: 'Pipe size for 0.2 m³/s with 10 m of head over 2 km (Colebrook, K = 1.5)', mode: 'D', set: { pform: 'cole', shape: 'circle', L: 2000, Q: 0.2, H: 10, eps: 0.045, nu: 1.003, K: 1.5 } },
        { name: 'Schaum 8.3 — laminar fuel oil, ν 6.09 × 10⁻⁶ m²/s, 0.0057 m³/s: pipe size (0.596 m)', mode: 'inv', set: { pinv: 'Dlam', shape: 'circle', Q: 0.0057, nu: 6.09, Rec: 2000, L: 1000, K: 0, pform: 'cole', eps: 0 } },
        { name: 'Schaum 8.10 — oil Sg 0.86, 300 m of 50 mm pipe, 0.00114 m³/s, Δp 200 kPa: μ (0.0896 Pa·s)', mode: 'inv', set: { pinv: 'mu', shape: 'circle', D: 50, L: 300, Q: 0.00114, Sg: 0.86, hBy: 'p', dpm: 200, byV: 'Q', K: 0, pform: 'cole', eps: 0 } },
        { name: 'Schaum 8.49 — least ν for laminar flow, 0.222 m³/s in a 300 mm pipe (0.00047 m²/s; book 0.00046)', mode: 'inv', set: { pinv: 'nu', shape: 'circle', D: 300, Q: 0.222, Rec: 2000, byV: 'Q', L: 914, K: 0, pform: 'cole', eps: 0.24 } },
        { name: 'Schaum 9.21 — three-loop network, C = 120, 0.4 m³/s in at A', mode: 'net', set: Object.assign({ nform: 'hw', grid: '1x3', hA: 100 }, (() => { const s = { q2: 0, q3: 0, q4: 0, q5: 0, q6: 0, q7: 0, q8: 0, q9: 0, q1: 0.4, q5: -0.1, q6: -0.1, q7: -0.1, q8: -0.1 }; for (let i = 1; i <= 10; i++) { s['nL' + i] = i <= 6 ? 600 : 400; s['nD' + i] = i <= 6 ? 300 : 250; s['nC' + i] = 120; } return s; })()) },
        { name: 'Two-loop network (Darcy f = 0.02), 120 L/s through A', mode: 'net', set: Object.assign({ nform: 'darcy', grid: '1x2', hA: 60, repN: '5', zRep: 20 }, (() => { const s = { q2: 0, q3: 0, q4: 0, q5: 0, q6: 0, q7: 0, q8: 0, q9: 0, q1: 0.12, q4: -0.03, q5: -0.05, q6: -0.04 }; for (let i = 1; i <= 7; i++) { s['nL' + i] = i <= 4 ? 500 : 300; s['nD' + i] = i <= 2 ? 300 : 200; s['nF' + i] = 0.02; } return s; })()) },
        { name: 'Four-loop grid (2 × 2), Hazen-Williams C = 100', mode: 'net', set: Object.assign({ nform: 'hw', grid: '2x2', hA: 80 }, (() => { const s = { q2: 0, q3: 0, q4: 0, q5: 0, q6: 0, q7: 0, q8: 0, q9: 0, q1: 0.25, q3: -0.05, q6: -0.06, q8: -0.05, q9: -0.09 }; for (let i = 1; i <= 12; i++) { s['nL' + i] = 400; s['nD' + i] = i <= 2 ? 300 : 200; s['nC' + i] = 100; } return s; })()) }
      ],
      hint: 'Single pipe: the section is drawn to scale on the left, with the velocity profile (parabolic when laminar) on the right. Network: arrows show the final flow directions and junction labels give the HGL.'
    };
    PD.draw = function (ctx, W, H, R, A, T) {
      const d = R.data, U = S.U, I = S.I, L = U.L; bg(ctx, W, H);
      const vdt = T.pdt;
      if (d.kind === 'net') {
        const N = d.N, cp = W < 560, mx = cp ? 58 : 84, my = 62, gw = W - 2 * mx, gh = H - my - 58;
        const px = (n) => mx + (n.c / N.nc) * gw, py = (n) => my + (n.r / Math.max(N.nr, 1)) * gh;
        const Dm = Math.max(...N.pipes.map((p) => p.D));
        N.pipes.forEach((p, i) => {
          const a = N.nodes[p.a], b = N.nodes[p.b], q = d.Q[i], from = q >= 0 ? a : b, to = q >= 0 ? b : a, w = clamp(5 + 9 * (p.D / Dm), 5, 14);
          pipe3(ctx, px(a), py(a), px(b), py(b), w);
          const v = Math.abs(q) / ((PI * p.D * p.D) / 4);
          flowDots(ctx, A, 'n' + i, [[px(from), py(from)], [px(to), py(to)]], v, vdt, C.bg);
          const mxp = (px(a) + px(b)) / 2, myp = (py(a) + py(b)) / 2, dx = px(to) - px(from), dy = py(to) - py(from), l = Math.hypot(dx, dy) || 1;
          arrow(ctx, mxp - (dx / l) * 14, myp - (dy / l) * 14, mxp + (dx / l) * 14, myp + (dy / l) * 14, C.egl, 2.5, 8);
          const horiz = a.r === b.r, sg = horiz && a.r === N.nr && N.nr > 0 ? -1 : 1; // bottom row: labels above the pipe
          const lab = cp ? fmt(Math.abs(q), 3) : `${p.name}  ${fmt(Math.abs(q), 3)}`;
          if (horiz) { txt(ctx, lab, mxp, myp + sg * (w / 2 + 11), { align: 'center', mono: true, size: cp ? 10 : 11, bold: true, bg: C.bg }); if (!cp) txt(ctx, mmOf(p.D), mxp, myp + sg * (w / 2 + 25), { align: 'center', size: 10, color: C.muted, bg: C.bg }); }
          else { txt(ctx, lab, mxp + 9, myp + (cp ? 0 : -20), { align: 'left', mono: true, size: cp ? 10 : 11, bold: true, bg: C.bg }); if (!cp) txt(ctx, mmOf(p.D), mxp + 10, myp + 20, { align: 'left', size: 10, color: C.muted, bg: C.bg }); }
        });
        N.nodes.forEach((n, j) => {
          const x = px(n), y = py(n), q = d.q[j];
          ctx.beginPath(); ctx.arc(x, y, 9, 0, 2 * PI); ctx.fillStyle = C.wall; ctx.fill(); txt(ctx, n.name, x, y, { align: 'center', bold: true, size: 11, color: C.bg });
          const below = n.r === N.nr, right = n.c === N.nc;
          txt(ctx, cp ? fmt(d.hgl[j], 4) : `HGL ${fmt(d.hgl[j], 4)}`, x + (right ? -12 : 12), y + (below && N.nr > 0 ? 18 : -16), { align: right ? 'right' : 'left', mono: true, size: 10, color: C.hgl, bg: C.bg });
          if (Math.abs(q) > 1e-12) {
            const edgeR = n.r === 0 || n.r === N.nr, interior = !edgeR && n.c > 0 && !right;
            let ox = n.c === 0 ? -1 : right ? 1 : 0, oy = ox === 0 ? (n.r === 0 ? -1 : 1) : 0; if (interior) { ox = 0.7; oy = 0.7; }
            const Lx = cp ? 22 : 30;
            if (q > 0) arrow(ctx, x + ox * (Lx + 12), y + oy * (Lx + 12), x + ox * 12, y + oy * 12, C.water_deep, 2.5, 8);
            else arrow(ctx, x + ox * 12, y + oy * 12, x + ox * (Lx + 12), y + oy * (Lx + 12), C.danger, 2.5, 8);
            const side = Math.abs(ox) === 1 && cp; // narrow screens: label above the arrow instead of beyond it
            txt(ctx, `${q > 0 ? 'in' : 'out'} ${fmt(Math.abs(q), 3)}`, side ? x + ox * (Lx / 2 + 12) : x + ox * (Lx + 16), side ? y - 11 : y + oy * (Lx + 18), { align: side ? 'center' : ox < 0 ? 'right' : ox > 0 ? 'left' : 'center', mono: true, size: 10.5, color: q > 0 ? C.water_deep : C.danger, bg: C.bg });
          }
        });
        txt(ctx, `Hardy Cross: flows in ${U.Q}${cp ? '' : ', loops taken clockwise'}`, 14, 18, { bold: true, size: 12 });
        txt(ctx, cp ? 'purple: HGL at each junction' : `purple: HGL at each junction (${U.L})`, 14, 36, { size: 10.5, color: C.hgl });
        return;
      }
      // single pipe or duct
      const G = d.G, sx = Math.min(W * 0.3, H * 0.62), cx = 14 + sx / 2, cy = H * 0.56;
      // cross-section to scale
      const s = d.s, big = I.shape === 'rect' ? Math.max(s, s * I.ar) : s, k = (sx * 0.78) / big;
      ctx.save(); ctx.fillStyle = isAir(I.Sg) ? C.air : C.water; ctx.globalAlpha = isAir(I.Sg) ? 0.5 : 0.4; ctx.strokeStyle = C.wall; ctx.lineWidth = 3;
      if (I.shape === 'circle' || I.shape === 'annulus') {
        ctx.beginPath(); ctx.arc(cx, cy, (s * k) / 2, 0, 2 * PI); ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
        if (I.shape === 'annulus') { ctx.beginPath(); ctx.arc(cx, cy, (I.Di * k) / 2, 0, 2 * PI); ctx.fillStyle = shade(C.pipe, 1.0); ctx.fill(); ctx.stroke(); }
        ctx.restore();
        dimH(ctx, cx - (s * k) / 2, cx + (s * k) / 2, cy - (s * k) / 2 - 14, `${I.shape === 'annulus' ? 'D' : 'D'} = ${mmOf(s)}`);
        if (I.shape === 'annulus') txt(ctx, `inner ${mmOf(I.Di)}`, cx, cy, { align: 'center', mono: true, size: 10.5, bg: C.bg });
      } else {
        const hh = s * k, ww = (I.shape === 'rect' ? s * I.ar : s) * k;
        ctx.fillRect(cx - ww / 2, cy - hh / 2, ww, hh); ctx.globalAlpha = 1; ctx.strokeRect(cx - ww / 2, cy - hh / 2, ww, hh); ctx.restore();
        dimH(ctx, cx - ww / 2, cx + ww / 2, cy - hh / 2 - 14, `${I.shape === 'rect' ? 'b' : 'a'} = ${mmOf(ww / k)}`);
        if (I.shape === 'rect') txt(ctx, `a = ${mmOf(s)}`, cx, cy + hh / 2 + 14, { align: 'center', mono: true, size: 11, bg: C.bg });
      }
      txt(ctx, `A = ${fmt(G.A)} ${U.A}`, cx, H - 34, { align: 'center', mono: true, size: 11 });
      txt(ctx, `R = ${fmt(d.Dh / 4)},  D_h = ${fmt(d.Dh)} ${L}`, cx, H - 18, { align: 'center', mono: true, size: 11 });
      // longitudinal view with velocity profile
      const x0 = sx + 40, x1 = W - 16, yc = H * 0.6, r = clamp(H * 0.17, 26, 60), lam = d.Re < 2000;
      ctx.fillStyle = isAir(I.Sg) ? C.air : C.water; ctx.globalAlpha = 0.3; ctx.fillRect(x0, yc - r, x1 - x0, 2 * r); ctx.globalAlpha = 1;
      stroke(ctx, [[x0, yc - r], [x1, yc - r]], C.wall, 3); stroke(ctx, [[x0, yc + r], [x1, yc + r]], C.wall, 3);
      const uOf = (eta) => (lam ? 2 * (1 - eta * eta) : (60 / 49) * Math.pow(Math.max(0, 1 - Math.abs(eta)), 1 / 7)); // ÷ V
      for (let kk = -3; kk <= 3; kk++) flowDots(ctx, A, 'l' + kk, [[x0, yc + (kk / 4) * r], [x1, yc + (kk / 4) * r]], d.V * uOf(kk / 4), vdt, C.part);
      const xp = x0 + (x1 - x0) * 0.35, sc = Math.min((x1 - x0) * 0.22, 90) / 2;
      const prof = []; for (let i = 0; i <= 30; i++) { const eta = -1 + (2 * i) / 30; prof.push([xp + sc * uOf(eta), yc + eta * r]); }
      stroke(ctx, [[xp, yc - r], [xp, yc + r]], C.muted, 1); stroke(ctx, prof, C.egl, 2);
      for (let i = 1; i < 8; i++) { const eta = -1 + (2 * i) / 8; arrow(ctx, xp, yc + eta * r, xp + sc * uOf(eta), yc + eta * r, C.egl, 1.2, 5); }
      txt(ctx, lam ? `laminar: u_max = 2V = ${fmt(2 * d.V)} ${U.v}` : 'turbulent: flatter profile (1/7 power law)', x0, yc - r - 12, { size: 11, mono: true, bg: C.bg, align: 'left' });
      // energy line drop over the length
      if (S.egl) {
        const top = 46, e0 = top, e1 = yc - r - 30;
        stroke(ctx, [[x0, e0], [x1, e1]], C.egl, 2); txt(ctx, 'EGL', x0 + 4, e0 - 10, { color: C.egl, bold: true });
        dimV(ctx, x1 - 8, e0, e1, `h_f = ${fmt(d.hf)} ${L}`, null, 'left');
      }
      dimH(ctx, x0, x1, yc + r + 18, `L = ${fmt(d.L)} ${L}`);
      txt(ctx, `V = ${fmt(d.V)} ${U.v},  Re = ${fmt(d.Re)},  f = ${fmt(d.f)},  Q = ${fmt(d.Q)} ${U.Q}`, 14, 18, { bold: true, mono: true, size: 12 });
    };
    PD.drawAux = function (ctx, W, H, R) {
      const d = R.data, U = S.U; bg(ctx, W, H);
      if (d.kind === 'net') {
        const groups = [{ name: '', items: d.N.pipes.map((p, i) => [p.name, Math.abs(d.Q[i]), C.water_deep]) }];
        bars(ctx, W, H, `Final pipe flows (${U.Q})`, groups, U.Q); return;
      }
      if (!d.curve) return;
      plot(ctx, { x: 0, y: 0, w: W, h: H }, { title: 'Pipe system curve: total head loss vs discharge', xs: d.curve.qs, series: [{ ys: d.curve.hs, color: C.hgl }], xmin: 0, xlab: `Q (${U.Q})`, ylab: U.L, pts: [{ x: d.Q, y: d.Htot, color: C.egl, label: `${fmt(d.Htot)} ${U.L}` }] });
    };
    insertAfter('pipes', PD);
  });
})(window);
