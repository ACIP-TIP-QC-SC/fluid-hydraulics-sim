/* =====================================================================
   modsC.js — Hydraulics module added in the 2026-11-25 book-coverage
   upgrade (Stage 3):
     Pumps & Turbines  (HP.machine)  machine constants and specific speed,
                                     homologous machines, Pelton wheels,
                                     impeller velocity triangles, pump and
                                     system curves, cavitation, propellers
   Registered through window.HYD_EXT; app.js hands over its helpers.
   ===================================================================== */
(function (root) {
  'use strict';
  const PI = Math.PI, DEG = PI / 180;
  (root.HYD_EXT = root.HYD_EXT || []).push(function (K) {
    const { MODS, S, C, fmt, clamp, txt, poly, stroke, arrow, dimV, dimH, plot } = K;
    const insertAfter = (id, m) => { const i = MODS.findIndex((x) => x.id === id); MODS.splice(i < 0 ? MODS.length : i + 1, 0, m); };
    const bg = (ctx, W, H) => { ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H); };
    const inOf = (D) => (S.U.sys === 'SI' ? `${fmt(D)} m` : `${fmt(D)} ft (${fmt(D * 12)} in)`);
    function bars(ctx, W, H, title, items, unit) {
      txt(ctx, title, 14, 14, { bold: true });
      const vals = items.map((i) => i[1]), mx = Math.max(...vals, 0), mn = Math.min(...vals, 0), rg = mx - mn || 1;
      const top = 40, bot = H - 34, Y = (v) => bot - ((v - mn) / rg) * (bot - top), n = items.length, bw = Math.min(70, (W - 40) / n - 10);
      stroke(ctx, [[14, Y(0)], [W - 10, Y(0)]], C.muted, 1);
      items.forEach((it, k) => {
        const x = 24 + k * (bw + 10), y0 = Y(0), y1 = Y(it[1]);
        ctx.fillStyle = it[2]; ctx.globalAlpha = 0.8; ctx.fillRect(x, Math.min(y0, y1), bw, Math.max(1, Math.abs(y1 - y0))); ctx.globalAlpha = 1;
        txt(ctx, fmt(it[1], 3), x + bw / 2, Math.min(y0, y1) - 8, { align: 'center', mono: true, size: 10.5 });
        txt(ctx, it[0], x + bw / 2, bot + 14, { align: 'center', size: 10.5, bold: true });
      });
      if (unit) txt(ctx, unit, W - 12, 14, { align: 'right', size: 11, color: C.muted });
    }
    // a wheel seen face-on: nb blades/buckets, rotating by angle th
    function wheel(ctx, cx, cy, R, th, nb, kind) {
      ctx.save();
      const Rd = kind === 'bucket' ? R * 0.86 : R;
      ctx.beginPath(); ctx.arc(cx, cy, Rd, 0, 2 * PI); ctx.fillStyle = C.pipe; ctx.globalAlpha = 0.18; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = C.wall; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.16, 0, 2 * PI); ctx.fillStyle = C.wall; ctx.fill();
      for (let i = 0; i < nb; i++) {
        const a = th + (2 * PI * i) / nb;
        if (kind === 'bucket') {
          const bx = cx + R * Math.cos(a), by = cy + R * Math.sin(a);
          ctx.beginPath(); ctx.arc(bx, by, R * 0.1, a + PI * 0.15, a + PI * 1.15); ctx.closePath(); ctx.fillStyle = C.pipe; ctx.fill(); ctx.strokeStyle = C.wall; ctx.lineWidth = 1.5; ctx.stroke();
          stroke(ctx, [[cx + R * 0.2 * Math.cos(a), cy + R * 0.2 * Math.sin(a)], [cx + R * 0.88 * Math.cos(a), cy + R * 0.88 * Math.sin(a)]], C.muted, 1.2);
        } else {
          // curved (backward) vane from hub to rim
          const pts = []; for (let k = 0; k <= 12; k++) { const r = R * (0.22 + (0.78 * k) / 12), b = a - 0.9 * (k / 12) * (k / 12); pts.push([cx + r * Math.cos(b), cy + r * Math.sin(b)]); }
          stroke(ctx, pts, C.wall, 2.4);
        }
      }
      ctx.restore();
    }
    function rotArrow(ctx, cx, cy, r, label, ccw) {
      const a0 = -PI * 0.75, a1 = -PI * 0.25; ctx.beginPath(); if (ccw) ctx.arc(cx, cy, r, a1, a0, true); else ctx.arc(cx, cy, r, a0, a1, false); ctx.strokeStyle = C.egl; ctx.lineWidth = 2; ctx.stroke();
      const ae = ccw ? a0 : a1, ex = cx + r * Math.cos(ae), ey = cy + r * Math.sin(ae), tx = -Math.sin(ae) * (ccw ? -1 : 1), ty = Math.cos(ae) * (ccw ? -1 : 1);
      K.arrow(ctx, ex - tx * 8, ey - ty * 8, ex + tx * 2, ey + ty * 2, C.egl, 2, 8);
      if (label) txt(ctx, label, cx, cy - r - 12, { align: 'center', mono: true, size: 11.5, bold: true, color: C.egl, bg: C.bg });
    }
    // log-scale band showing where a specific speed falls
    function nsScale(ctx, x0, x1, y, Ns, turb) {
      const bands = turb ? [[1, 10, 'impulse (Pelton)'], [10, 100, 'Francis'], [100, 300, 'propeller / Kaplan']] : [[400, 4000, 'radial'], [4000, 9000, 'mixed'], [9000, 20000, 'axial']];
      const lo = turb ? 1 : 400, hi = turb ? 300 : 20000, X = (v) => x0 + ((Math.log(clamp(v, lo, hi)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * (x1 - x0);
      const cols = [C.water, C.hgl, C.egl];
      bands.forEach((b, i) => { ctx.fillStyle = cols[i]; ctx.globalAlpha = 0.25; ctx.fillRect(X(b[0]), y, X(b[1]) - X(b[0]), 14); ctx.globalAlpha = 1; txt(ctx, b[2], (X(b[0]) + X(b[1])) / 2, y + 26, { align: 'center', size: 10, color: C.muted }); txt(ctx, fmt(b[0]), X(b[0]), y - 8, { align: 'center', size: 9.5, mono: true, color: C.muted }); });
      txt(ctx, fmt(bands[2][1]), X(bands[2][1]), y - 8, { align: 'center', size: 9.5, mono: true, color: C.muted });
      ctx.beginPath(); ctx.moveTo(X(Ns), y - 2); ctx.lineTo(X(Ns) - 6, y - 12); ctx.lineTo(X(Ns) + 6, y - 12); ctx.closePath(); ctx.fillStyle = C.danger; ctx.fill();
      stroke(ctx, [[X(Ns), y], [X(Ns), y + 14]], C.danger, 2);
      txt(ctx, `N_s = ${fmt(Ns, 3)} ${turb ? '(hp, ft)' : '(gpm, ft)'}`, X(Ns), y - 22, { align: 'center', mono: true, size: 11, bold: true, color: C.danger, bg: C.bg });
    }
    const spin = (A, T, rpm) => { A.th = ((A.th || 0) + (T.pdt || 0) * Math.min(rpm, 600) * 0.012) % (2 * PI); return A.th; };

    const M = ['char', 'homolog', 'pelton', 'impeller', 'operate', 'cavit', 'prop'];
    const on = (...ms) => (P, m) => ms.includes(m);
    const turbOnly = (P, m) => m === 'char' && P.mtype === 'turbine';
    const pumpOnly = (P, m) => m === 'char' && P.mtype === 'pump';
    const pts = [];
    for (let i = 1; i <= 6; i++) {
      const has = (P, m) => m === 'operate' && +P.npts >= i;
      pts.push(
        { k: '_pp' + i, type: 'head', label: `Pump curve point ${i}`, show: has },
        { k: 'pq' + i, label: 'Flow Q', dim: 'Q', min: 0, max: 50, step: 0.0001, def: [0, 0.02, 0.04, 0.06, 0.08, 0.1][i - 1], show: has },
        { k: 'ph' + i, label: 'Head H', dim: 'len', min: 0, max: 2000, step: 0.01, def: [50, 49, 45, 38, 28, 15][i - 1], show: has },
        { k: 'pe' + i, label: 'Efficiency η (%, 0 if unknown)', min: 0, max: 100, step: 0.1, def: [0, 50, 68, 75, 70, 55][i - 1], show: has }
      );
    }
    const MT = {
      id: 'machine', tab: 'Pumps & Turbines', title: 'Pumps, Turbines, Fans and Propellers: Specific Speed, Similarity, Pelton Wheels, Impellers and Operating Points', fn: 'machine',
      modes: [['char', 'Machine constants and specific speed'], ['homolog', 'Similar (homologous) machines'], ['pelton', 'Impulse (Pelton) wheel'], ['impeller', 'Centrifugal impeller velocity triangles'], ['operate', 'Pump and system curves'], ['cavit', 'Cavitation and suction lift'], ['prop', 'Propeller and fan coefficients']],
      speed: {},
      modeDefaults: { char: { H: 30 }, pelton: { H: 200, N: 500, Pw: 1000, eta: 0.85 }, cavit: { H: 40 }, impeller: { N: 1450, Q: 0.05 }, prop: { Sg: 0.00122, N: 1200, Pw: 50 } },
      params: [
        { k: 'Sg', label: 'Fluid specific gravity Sg', labelFn: (P, m) => (m === 'homolog' ? 'Fluid Sg, machine 1' : 'Fluid specific gravity Sg'), min: 0.0005, max: 13.6, step: 0.00001, def: 1, log: true, chips: [['Water', 1], ['Air', 0.00122], ['Oil', 0.85]] },
        { k: 'mtype', type: 'select', label: 'Machine', def: 'turbine', options: [['turbine', 'Turbine (water drives the shaft)'], ['pump', 'Pump, fan or blower (shaft drives the fluid)']], modes: ['char', 'cavit'] },
        // ---- machine constants
        { k: '_hh', type: 'head', label: 'Head', modes: ['char'] },
        { k: 'Hby', type: 'select', label: 'Head given as', def: 'H', options: [['H', 'Net (effective) head H'], ['gauge', 'Pressure head, velocity and height at the inlet']], show: turbOnly },
        { k: 'H', label: 'Head H', labelFn: (P, m) => (m === 'pelton' ? 'Effective head H (at the nozzle base)' : m === 'cavit' ? 'Machine head H' : P.mtype === 'pump' ? 'Total head H' : 'Net head H'), dim: 'len', min: 0.1, max: 2000, step: 0.01, def: 30, log: true, show: (P, m) => m === 'pelton' || m === 'cavit' || (m === 'char' && !(P.mtype === 'turbine' && P.Hby === 'gauge')) },
        { k: 'hp', label: 'Pressure head at the inlet p/γ', dim: 'len', min: -20, max: 2000, step: 0.01, def: 28, show: (P, m) => turbOnly(P, m) && P.Hby === 'gauge' },
        { k: 'Vin', label: 'Velocity at the inlet', dim: 'vel', min: 0, max: 50, step: 0.01, def: 3.7, show: (P, m) => turbOnly(P, m) && P.Hby === 'gauge' },
        { k: 'zt', label: 'Inlet height above the tailwater', dim: 'len', min: -20, max: 100, step: 0.01, def: 1.9, show: (P, m) => turbOnly(P, m) && P.Hby === 'gauge' },
        { k: '_hf', type: 'head', label: 'Flow and power', modes: ['char'] },
        { k: 'flowBy', type: 'select', label: 'Known', def: 'Qe', options: [['QP', 'Flow and shaft power (find η)'], ['Qe', 'Flow and efficiency'], ['Pe', 'Shaft power and efficiency']], modes: ['char'] },
        { k: 'pgiv', type: 'select', label: 'Known', def: 'PN', options: [['PN', 'Power and speed'], ['PNr', 'Power, speed and D/d (find the number of jets)'], ['Pr', 'Power and D/d (find the speed)'], ['dPr', 'Jet size, power and D/d (find η and speed)'], ['QN', 'Flow and speed']], modes: ['pelton'] },
        { k: 'Q', label: 'Flow Q', dim: 'Q', min: 0.0001, max: 5000, step: 0.0001, def: 1, log: true, show: (P, m) => (m === 'char' && P.flowBy !== 'Pe') || (m === 'pelton' && P.pgiv === 'QN') || (m === 'impeller' && P.qBy === 'Q') },
        { k: 'Pw', label: 'Shaft power P', labelFn: (P, m) => (m === 'prop' ? 'Power absorbed P (0 if unknown)' : m === 'pelton' ? 'Power delivered P' : P.mtype === 'pump' ? 'Shaft power input P' : 'Shaft power output P'), dim: 'pow', min: 0, max: 1e6, step: 0.001, def: 250, log: true, show: (P, m) => (m === 'char' && P.flowBy !== 'Qe') || (m === 'pelton' && P.pgiv !== 'QN') || m === 'prop' },
        { k: 'eta', label: 'Efficiency η', min: 0.05, max: 1, step: 0.001, def: 0.85, show: (P, m) => (m === 'char' && P.flowBy !== 'QP') || (m === 'pelton' && P.pgiv !== 'dPr') || m === 'operate' },
        { k: 'stages', label: 'Number of stages', min: 1, max: 12, step: 1, def: 1, show: pumpOnly },
        { k: 'showStages', type: 'check', label: 'Table of N_s for 1 to 6 stages', def: false, show: pumpOnly },
        { k: '_hn', type: 'head', label: 'Speed and size', modes: ['char'] },
        { k: 'Nby', type: 'select', label: 'Speed', def: 'N', options: [['N', 'Speed N given'], ['Ns', 'From a chosen specific speed N_s']], modes: ['char'] },
        { k: 'N', label: 'Speed N', dim: 'rpm', min: 1, max: 20000, step: 0.1, def: 600, log: true, show: (P, m) => (m === 'char' && P.Nby === 'N') || (m === 'pelton' && P.pgiv !== 'Pr' && P.pgiv !== 'dPr') || m === 'impeller' || m === 'prop' },
        { k: 'Ns', label: 'Specific speed N_s', min: 0.1, max: 30000, step: 0.01, def: 50, log: true, show: (P, m) => m === 'char' && P.Nby === 'Ns' },
        { k: 'nsT', type: 'select', label: 'N_s units', def: 'hp', options: [['hp', 'N√P(hp) / H(ft)^1.25 (Schaum, US)'], ['kW', 'N√P(kW) / H(m)^1.25']], show: (P, m) => turbOnly(P, m) && P.Nby === 'Ns' },
        { k: 'nsP', type: 'select', label: 'N_s units', def: 'gpm', options: [['gpm', 'N√Q(gpm) / H(ft)^0.75 (US)'], ['cfs', 'N√Q(cfs) / H(ft)^0.75 (Schaum)'], ['si', 'N√Q(m³/s) / H(m)^0.75']], show: (P, m) => pumpOnly(P, m) && P.Nby === 'Ns' },
        { k: 'sizeBy', type: 'select', label: 'Size', def: 'D', options: [['D', 'Diameter D given'], ['phi', 'From the speed factor φ'], ['Nu', 'From the unit speed N_u = N D(in)/√H(ft)']], modes: ['char'] },
        { k: 'D', label: 'Runner / impeller diameter D', dim: 'len', min: 0.01, max: 20, step: 0.001, def: 1, log: true, show: (P, m) => m === 'char' && P.sizeBy === 'D' },
        { k: 'phi', label: 'Speed factor φ = u/√(2gH)', min: 0.05, max: 3, step: 0.001, def: 0.46, show: (P, m) => (m === 'char' && P.sizeBy === 'phi') || m === 'pelton' },
        { k: 'Nu', label: 'Unit speed N_u (D in inches, H in ft)', min: 10, max: 50000, step: 1, def: 1450, log: true, show: (P, m) => m === 'char' && P.sizeBy === 'Nu' },
        { k: 'H2', label: 'Same machine under another head H₂ (0 = skip)', dim: 'len', min: 0, max: 2000, step: 0.01, def: 0, modes: ['char'] },
        // ---- homologous machines
        { k: '_m1', type: 'head', label: 'Machine 1 (tested or existing)', modes: ['homolog'] },
        { k: 'mD1', label: 'Diameter D₁', dim: 'len', min: 0.001, max: 50, step: 0.001, def: 0.32, log: true, modes: ['homolog'] },
        { k: 'mN1', label: 'Speed N₁', dim: 'rpm', min: 1, max: 20000, step: 0.1, def: 1500, log: true, modes: ['homolog'] },
        { k: 'mH1', label: 'Head H₁', dim: 'len', min: 0, max: 2000, step: 0.01, def: 16.8, modes: ['homolog'] },
        { k: 'mQ1', label: 'Flow Q₁ (0 if not needed)', dim: 'Q', min: 0, max: 5000, step: 0.0001, def: 0.019, modes: ['homolog'] },
        { k: 'mP1', label: 'Power P₁ (0 if not needed)', dim: 'pow', min: 0, max: 1e6, step: 0.001, def: 4.5, modes: ['homolog'] },
        { k: '_m2', type: 'head', label: 'Machine 2 (homologous)', modes: ['homolog'] },
        { k: 'kn', type: 'select', label: 'Known for machine 2', def: 'DN', options: [['DN', 'Diameter and speed'], ['DH', 'Diameter and head'], ['DQ', 'Diameter and flow'], ['DP', 'Diameter and power'], ['NH', 'Speed and head'], ['NQ', 'Speed and flow'], ['NP', 'Speed and power'], ['HQ', 'Head and flow'], ['HP', 'Head and power'], ['QP', 'Flow and power']], modes: ['homolog'] },
        { k: 'mD2', label: 'Diameter D₂', dim: 'len', min: 0.001, max: 50, step: 0.001, def: 0.38, log: true, show: (P, m) => m === 'homolog' && P.kn.includes('D') },
        { k: 'mN2', label: 'Speed N₂', dim: 'rpm', min: 1, max: 20000, step: 0.1, def: 1750, log: true, show: (P, m) => m === 'homolog' && P.kn.includes('N') },
        { k: 'mH2', label: 'Head H₂', dim: 'len', min: 0.001, max: 2000, step: 0.01, def: 20, show: (P, m) => m === 'homolog' && P.kn.includes('H') },
        { k: 'mQ2', label: 'Flow Q₂', dim: 'Q', min: 0.0001, max: 5000, step: 0.0001, def: 0.03, show: (P, m) => m === 'homolog' && P.kn.includes('Q') },
        { k: 'mP2', label: 'Power P₂', dim: 'pow', min: 0.001, max: 1e6, step: 0.001, def: 10, show: (P, m) => m === 'homolog' && P.kn.includes('P') },
        { k: 'Sg2', label: 'Fluid Sg, machine 2', min: 0.0005, max: 13.6, step: 0.00001, def: 1, log: true, chips: [['Water', 1], ['Air', 0.00122], ['Oil', 0.85]], show: (P, m) => m === 'homolog' || (m === 'prop' && P.sim !== 'none') },
        // ---- Pelton
        { k: '_hp', type: 'head', label: 'Wheel and nozzle', modes: ['pelton'] },
        { k: 'cv', label: 'Nozzle velocity coefficient c_v', min: 0.8, max: 1, step: 0.001, def: 0.98, modes: ['pelton'] },
        { k: 'ratio', label: 'Wheel-to-jet diameter ratio D/d', min: 4, max: 40, step: 0.01, def: 12, show: (P, m) => m === 'pelton' && ['PNr', 'Pr', 'dPr'].includes(P.pgiv) },
        { k: 'dj', label: 'Jet diameter d', dim: 'mm', min: 5, max: 1000, step: 0.1, def: 100, show: (P, m) => m === 'pelton' && P.pgiv === 'dPr' },
        { k: 'nj', label: 'Number of jets', min: 1, max: 6, step: 1, def: 1, show: (P, m) => m === 'pelton' && P.pgiv !== 'PNr' },
        { k: 'Db', label: 'Nozzle base diameter (0 = skip)', dim: 'mm', min: 0, max: 3000, step: 1, def: 0, modes: ['pelton'] },
        // ---- impeller
        { k: '_hi', type: 'head', label: 'Impeller', modes: ['impeller'] },
        { k: 'iD1', label: 'Inner (eye) diameter D₁', dim: 'mm', min: 5, max: 5000, step: 1, def: 150, modes: ['impeller'] },
        { k: 'iD2', label: 'Outer diameter D₂', dim: 'mm', min: 10, max: 10000, step: 1, def: 350, modes: ['impeller'] },
        { k: 'aBy', type: 'select', label: 'Flow areas from', def: 'width', options: [['width', 'Blade widths b (A = πDb)'], ['area', 'Areas given']], modes: ['impeller'] },
        { k: 'b1', label: 'Width at inlet b₁', dim: 'mm', min: 1, max: 2000, step: 0.1, def: 40, show: (P, m) => m === 'impeller' && P.aBy === 'width' },
        { k: 'b2', label: 'Width at outlet b₂', dim: 'mm', min: 1, max: 2000, step: 0.1, def: 20, show: (P, m) => m === 'impeller' && P.aBy === 'width' },
        { k: 'A1', label: 'Inlet flow area A₁ (0 = skip the inlet)', dim: 'area', min: 0, max: 50, step: 0.00001, def: 0.02, show: (P, m) => m === 'impeller' && P.aBy === 'area' },
        { k: 'A2', label: 'Outlet flow area A₂', dim: 'area', min: 0.00001, max: 50, step: 0.00001, def: 0.02, show: (P, m) => m === 'impeller' && P.aBy === 'area' },
        { k: 'a2n', type: 'check', label: 'A₂ is measured normal to the relative velocity', def: false, show: (P, m) => m === 'impeller' && P.aBy === 'area' },
        { k: 'qBy', type: 'select', label: 'Flow', def: 'Q', options: [['Q', 'Flow Q given'], ['beta1', 'Set by the inlet blade angle (shock-free entry)']], modes: ['impeller'] },
        { k: 'beta1', label: 'Inlet blade angle β₁ (from the blade motion)', dim: 'deg', min: 1, max: 179, step: 0.1, def: 160, modes: ['impeller'] },
        { k: 'beta2', label: 'Outlet blade angle β₂ (from the blade motion)', dim: 'deg', min: 1, max: 179, step: 0.1, def: 155, modes: ['impeller'] },
        { k: 'alpha1', label: 'Inlet flow angle α₁ (90° = radial, no prewhirl)', dim: 'deg', min: 10, max: 170, step: 0.1, def: 90, modes: ['impeller'] },
        { k: 'kv', label: 'Impeller loss k (× v₂²/2g)', min: 0, max: 10, step: 0.01, def: 0, modes: ['impeller'] },
        { k: 'kV', label: 'Exit loss k (× V₂²/2g)', min: 0, max: 2, step: 0.01, def: 0, modes: ['impeller'] },
        // ---- operating point
        { k: '_ho', type: 'head', label: 'Pump curve (from a test)', modes: ['operate'] },
        { k: 'npts', type: 'select', label: 'Number of points', def: '6', options: [['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']], modes: ['operate'] },
        ...pts,
        { k: '_hs', type: 'head', label: 'Running speed, size and pumps', modes: ['operate'] },
        { k: 'Nt', label: 'Test speed', dim: 'rpm', min: 1, max: 20000, step: 1, def: 1450, modes: ['operate'] },
        { k: 'Nn', label: 'Running speed', dim: 'rpm', min: 1, max: 20000, step: 1, def: 1450, modes: ['operate'] },
        { k: 'rD', label: 'Diameter ratio D (running) / D (test)', min: 0.1, max: 10, step: 0.0001, def: 1, modes: ['operate'] },
        { k: 'np', label: 'Number of identical pumps', min: 1, max: 6, step: 1, def: 1, modes: ['operate'] },
        { k: 'arr', type: 'select', label: 'Arrangement', def: 'parallel', options: [['parallel', 'In parallel (flows add)'], ['series', 'In series (heads add)']], show: (P, m) => m === 'operate' && +P.np > 1 },
        { k: '_hy', type: 'head', label: 'System', modes: ['operate'] },
        { k: 'sysBy', type: 'select', label: 'System curve', def: 'pipe', options: [['pipe', 'Static lift + one pipe (Darcy)'], ['k', 'Static lift + k Q²'], ['Q', 'No system: read the curve at a flow']], modes: ['operate'] },
        { k: 'Hs', label: 'Static lift', dim: 'len', min: -100, max: 2000, step: 0.01, def: 20, show: (P, m) => m === 'operate' && P.sysBy !== 'Q' },
        { k: 'Lp', label: 'Pipe length L', dim: 'len', min: 0.1, max: 100000, step: 0.1, def: 300, log: true, show: (P, m) => m === 'operate' && P.sysBy === 'pipe' },
        { k: 'Dp', label: 'Pipe diameter D', dim: 'mm', min: 5, max: 5000, step: 1, def: 200, show: (P, m) => m === 'operate' && P.sysBy === 'pipe' },
        { k: 'fp', label: 'Darcy friction factor f', min: 0.005, max: 0.1, step: 0.0001, def: 0.02, show: (P, m) => m === 'operate' && P.sysBy === 'pipe' },
        { k: 'Km', label: 'Minor losses ΣK', min: 0, max: 100, step: 0.01, def: 2, show: (P, m) => m === 'operate' && P.sysBy === 'pipe' },
        { k: 'ks', label: 'k in H = H_static + k Q² (current units)', min: 0, max: 1e7, step: 0.0001, def: 2000, log: true, show: (P, m) => m === 'operate' && P.sysBy === 'k' },
        { k: 'Qop', label: 'Flow Q', dim: 'Q', min: 0, max: 5000, step: 0.0001, def: 0.05, show: (P, m) => m === 'operate' && P.sysBy === 'Q' },
        // ---- cavitation
        { k: '_hc', type: 'head', label: 'Suction side', modes: ['cavit'] },
        { k: 'patm', label: 'Atmospheric pressure', dim: 'kPa', min: 50, max: 110, step: 0.001, def: 101.325, modes: ['cavit'] },
        { k: 'pv', label: 'Vapour pressure', dim: 'kPa', min: 0, max: 100, step: 0.001, def: 2.34, modes: ['cavit'] },
        { k: 'sigBy', type: 'select', label: 'Limit given as', def: 'npsh', options: [['npsh', 'Required NPSH'], ['sigma', 'Critical Thoma σ_c']], modes: ['cavit'] },
        { k: 'npsh', label: 'Required NPSH', dim: 'len', min: 0, max: 100, step: 0.01, def: 4, show: (P, m) => m === 'cavit' && P.sigBy === 'npsh' },
        { k: 'sigma', label: 'Critical σ_c', min: 0, max: 5, step: 0.001, def: 0.1, show: (P, m) => m === 'cavit' && P.sigBy === 'sigma' },
        { k: 'hLs', label: 'Suction-side loss h_L (or draft-tube exit head)', dim: 'len', min: 0, max: 50, step: 0.01, def: 0.5, modes: ['cavit'] },
        { k: 'zs', label: 'Actual setting z_s above the water surface', dim: 'len', min: -50, max: 50, step: 0.01, def: 3, modes: ['cavit'] },
        // ---- propeller
        { k: '_hr', type: 'head', label: 'Propeller or fan', modes: ['prop'] },
        { k: 'Dpr', label: 'Diameter D', dim: 'len', min: 0.01, max: 100, step: 0.001, def: 2, log: true, modes: ['prop'] },
        { k: 'V', label: 'Advance (or air) speed V', dim: 'vel', min: 0, max: 500, step: 0.01, def: 40, modes: ['prop'] },
        { k: 'Fp', label: 'Thrust F', dim: 'kN', min: 0, max: 1e5, step: 0.0001, def: 2, log: true, modes: ['prop'] },
        { k: 'sim', type: 'select', label: 'Similar propeller', def: 'none', options: [['none', 'None'], ['VF', 'From its speed V₂ and thrust F₂'], ['DN', 'From its diameter D₂ and speed N₂']], modes: ['prop'] },
        { k: 'V2', label: 'Advance speed V₂', dim: 'vel', min: 0.01, max: 500, step: 0.01, def: 10, show: (P, m) => m === 'prop' && P.sim === 'VF' },
        { k: 'F2', label: 'Thrust F₂', dim: 'kN', min: 0.0001, max: 1e5, step: 0.0001, def: 10, log: true, show: (P, m) => m === 'prop' && P.sim === 'VF' },
        { k: 'D2p', label: 'Diameter D₂', dim: 'len', min: 0.01, max: 100, step: 0.001, def: 4, show: (P, m) => m === 'prop' && P.sim === 'DN' },
        { k: 'N2', label: 'Speed N₂', dim: 'rpm', min: 1, max: 20000, step: 0.1, def: 600, show: (P, m) => m === 'prop' && P.sim === 'DN' }
      ],
      prep: (I) => {
        I.nsconv = I.mtype === 'turbine' ? I.nsT : I.nsP;
        ['D1', 'N1', 'H1', 'Q1', 'P1', 'D2', 'N2', 'H2', 'Q2', 'P2'].forEach((k) => { if (I.mode === 'homolog') I[k] = I['m' + k]; });
        if (I.mode === 'impeller') { I.D1 = I.iD1; I.D2 = I.iD2; }
      },
      presets: [
        // machine constants
        { name: 'Schaum 14.10 — Hoover Dam turbine: 115 000 hp, 180 rpm, 487 ft, 11 ft, 2350 cfs', mode: 'char', units: 'EN', set: { mtype: 'turbine', Hby: 'H', H: 487, flowBy: 'QP', Q: 2350, Pw: 115000, Nby: 'N', N: 180, sizeBy: 'D', D: 11, H2: 0 } },
        { name: 'Schaum 14.36 — turbine test: 22.5 hp, 16 ft, 140 rpm, 36 in, 14 cfs (88.5 %, φ 0.685, N_s 20.8)', mode: 'char', units: 'EN', set: { mtype: 'turbine', Hby: 'H', H: 16, flowBy: 'QP', Q: 14, Pw: 22.5, Nby: 'N', N: 140, sizeBy: 'D', D: 3, H2: 0 } },
        { name: 'Schaum 14.32 — reaction turbine 34 bhp, 620 rpm, 100 ft, η 70 %, φ 0.75; then 196 ft (22.3 in, 4.28 cfs, 93.3 hp)', mode: 'char', units: 'EN', set: { mtype: 'turbine', Hby: 'H', H: 100, flowBy: 'Pe', Pw: 34, eta: 0.7, Nby: 'N', N: 620, sizeBy: 'phi', phi: 0.75, H2: 196 } },
        { name: 'Schaum 14.6 — tangential wheel 7200 hp, 200 rpm, 790 ft, η 82 %, φ 0.46; then 529 ft', mode: 'char', units: 'EN', set: { mtype: 'turbine', Hby: 'H', H: 790, flowBy: 'Pe', Pw: 7200, eta: 0.82, Nby: 'N', N: 200, sizeBy: 'phi', phi: 0.46, H2: 529 } },
        { name: 'Schaum 14.35 — design: φ 0.70, N_s 20, 1864 kW under 98.8 m (D = 1.07 m)', mode: 'char', set: { mtype: 'turbine', Hby: 'H', H: 98.8, flowBy: 'Pe', Pw: 1864, eta: 0.9, Nby: 'Ns', Ns: 20, nsT: 'hp', sizeBy: 'phi', phi: 0.7, H2: 0 } },
        { name: 'Schaum 14.15 — reaction turbine from inlet readings, 195 kW at 600 rpm; then 68.6 m', mode: 'char', set: { mtype: 'turbine', Hby: 'gauge', hp: 27.9, Vin: 3.66, zt: 1.91, flowBy: 'QP', Q: 0.74, Pw: 195, Nby: 'N', N: 600, sizeBy: 'D', D: 0.5, H2: 68.6 } },
        { name: 'Schaum 14.19 — 324 gpm against 420 ft at 3600 rpm: how many stages?', mode: 'char', units: 'EN', set: { mtype: 'pump', H: 420, flowBy: 'Qe', Q: 0.72187, eta: 0.7, Nby: 'N', N: 3600, sizeBy: 'D', D: 0.5, stages: 4, showStages: true, H2: 0 } },
        { name: 'Schaum 14.38 — pump for 0.255 m³/s, 11 m, 730 rpm with N_u = 1450 (305 mm)', mode: 'char', set: { mtype: 'pump', H: 11, flowBy: 'Qe', Q: 0.255, eta: 0.8, Nby: 'N', N: 730, sizeBy: 'Nu', Nu: 1450, stages: 1, showStages: false, H2: 0 } },
        // homologous
        { name: 'Schaum 14.17 — pump 320 mm at 1500 rpm → 380 mm at 1750 rpm', mode: 'homolog', set: { Sg: 1, Sg2: 1, mD1: 0.32, mN1: 1500, mH1: 16.8, mQ1: 0.019, mP1: 4.5, kn: 'DN', mD2: 0.38, mN2: 1750 } },
        { name: 'Schaum 14.39 — the same pump slowed from 1450 to 1200 rpm (0.059 m³/s, 5.2 m, 3.8 kW)', mode: 'homolog', set: { Sg: 1, Sg2: 1, mD1: 0.3, mN1: 1450, mH1: 7.6, mQ1: 0.071, mP1: 6.7, kn: 'DN', mD2: 0.3, mN2: 1200 } },
        { name: 'Schaum 14.14 — model turbine 380 mm → 1.9 m under 14.9 m', mode: 'homolog', set: { Sg: 1, Sg2: 1, mD1: 0.38, mN1: 1500, mH1: 7.6, mQ1: 0, mP1: 9, kn: 'DH', mD2: 1.9, mH2: 14.9 } },
        { name: 'Schaum 14.33 — 1.27 m turbine → homologous 0.64 m under 7.62 m (245 rpm, 120 kW)', mode: 'homolog', set: { Sg: 1, Sg2: 1, mD1: 1.27, mN1: 95, mH1: 4.57, mQ1: 0, mP1: 224, kn: 'DH', mD2: 0.64, mH2: 7.62 } },
        { name: 'Schaum 14.30 — 1:5 model, 4.25 bhp at 400 rpm, 6 ft → full size under 30 ft (179 rpm, 1190 hp)', mode: 'homolog', units: 'EN', set: { Sg: 1, Sg2: 1, mD1: 1, mN1: 400, mH1: 6, mQ1: 0, mP1: 4.25, kn: 'DH', mD2: 5, mH2: 30 } },
        { name: 'Schaum 14.13 — Pickwick turbine 48 000 hp → similar unit for 36 000 hp under 36 ft', mode: 'homolog', units: 'EN', set: { Sg: 1, Sg2: 1, mD1: 24.358, mN1: 81.8, mH1: 43, mQ1: 0, mP1: 48000, kn: 'HP', mH2: 36, mP2: 36000 } },
        { name: 'Schaum 14.34 — 60 in wheel, 625 bhp at 360 rpm → 2500 bhp at the same speed (697 ft, 79.2 in)', mode: 'homolog', units: 'EN', set: { Sg: 1, Sg2: 1, mD1: 5, mN1: 360, mH1: 400, mQ1: 0, mP1: 625, kn: 'NP', mN2: 360, mP2: 2500 } },
        { name: 'Schaum 14.8 — the same impulse wheel, 64 m → 88 m (+17.3 % speed, 150 kW)', mode: 'homolog', set: { Sg: 1, Sg2: 1, mD1: 1, mN1: 300, mH1: 64, mQ1: 0, mP1: 93, kn: 'DH', mD2: 1, mH2: 88 } },
        { name: 'Schaum 14.20 — oil pump (37 W, 1800 rpm) modelled in air (186 W, 600 rpm): model 10 × larger', mode: 'homolog', set: { Sg: 0.912, Sg2: 0.00123, mD1: 0.1, mN1: 1800, mH1: 0, mQ1: 0, mP1: 0.037, kn: 'NP', mN2: 600, mP2: 0.186 } },
        { name: 'Schaum 14.43 — wind-tunnel fan 1200 → 1750 rpm (air speed 109.4 ft/s, 10.1 hp)', mode: 'homolog', units: 'EN', set: { Sg: 0.00122, Sg2: 0.00122, mD1: 4, mN1: 1200, mH1: 0, mQ1: 75, mP1: 3.25, kn: 'DN', mD2: 4, mN2: 1750 } },
        // Pelton
        { name: 'Schaum 14.11 — impulse wheel 90 bhp, 400 rpm, 196 ft (4.88 cfs, 2.87 in jet, 193 ft at the 8 in base)', mode: 'pelton', units: 'EN', set: { pgiv: 'PN', H: 196, Pw: 90, N: 400, phi: 0.46, cv: 0.97, eta: 0.83, nj: 1, Db: 8 } },
        { name: 'Schaum 14.12 — Pelton 4470 kW, 122 m, 200 rpm, d/D = 1/9: wheel and number of jets (2)', mode: 'pelton', set: { pgiv: 'PNr', H: 122, Pw: 4470, N: 200, phi: 0.46, cv: 0.98, eta: 0.88, ratio: 9, Db: 0 } },
        { name: 'Schaum 14.29 — 2500 hp, 900 ft, 5 in nozzle, D/d = 10 (76.3 %, 508 rpm)', mode: 'pelton', units: 'EN', set: { pgiv: 'dPr', H: 900, Pw: 2500, dj: 5, phi: 0.46, cv: 0.98, ratio: 10, nj: 1, Db: 0 } },
        { name: 'Schaum 14.31 — 3580 kW, 395 m, D/d = 12: wheel size and speed (1.55 m, 500 rpm)', mode: 'pelton', set: { pgiv: 'Pr', H: 395, Pw: 3580, phi: 0.46, cv: 0.98, eta: 0.82, ratio: 12, nj: 1, Db: 0 } },
        { name: 'Schaum 14.9 — 0.95 cfs under 220 ft at a synchronous 514 rpm (1.23 in jet, 24.5 in wheel)', mode: 'pelton', units: 'EN', set: { pgiv: 'QN', H: 220, Q: 0.95, N: 514, phi: 0.46, cv: 0.975, eta: 0.85, nj: 1, Db: 0 } },
        // impeller
        { name: 'Schaum 14.16 — 12 in impeller, 5.25 cfs, 1200 rpm, β₂ 160°, A₂ 0.25 ft² (efficiency 63.8 %)', mode: 'impeller', units: 'EN', set: { N: 1200, iD1: 6, iD2: 12, aBy: 'area', A1: 0, A2: 0.25, a2n: true, qBy: 'Q', Q: 5.25, beta1: 150, beta2: 160, alpha1: 90, kv: 2.8, kV: 0.38 } },
        { name: 'Schaum 14.37 — 600 rpm, r 2 in → 8 in, β 135° and 120°, radial entry (14.8, 4.83 ft/s, 16.0 hp)', mode: 'impeller', units: 'EN', set: { N: 600, iD1: 4, iD2: 16, aBy: 'area', A1: 0.261799, A2: 0.654498, a2n: false, qBy: 'beta1', beta1: 135, beta2: 120, alpha1: 90, kv: 0, kV: 0 } },
        { name: 'Backward-curved impeller 350 mm, 1450 rpm, 50 L/s (blade widths given)', mode: 'impeller', set: { N: 1450, iD1: 150, iD2: 350, aBy: 'width', b1: 40, b2: 20, qBy: 'Q', Q: 0.05, beta1: 160, beta2: 155, alpha1: 90, kv: 0.5, kV: 0.3 } },
        // operating point
        { name: 'Schaum 14.18 — 6 in pump curve at 1750 rpm → 8 in at 1450 rpm, 1800 gpm (≈ 130 ft, 67 %)', mode: 'operate', units: 'EN', set: { npts: '6', pq1: 0, ph1: 124, pe1: 0, pq2: 1.11401, ph2: 119, pe2: 54, pq3: 1.78241, ph3: 112, pe3: 64, pq4: 2.22801, ph4: 104, pe4: 68, pq5: 2.89641, ph5: 90, pe5: 70, pq6: 3.56481, ph6: 66, pe6: 67, Nt: 1750, Nn: 1450, rD: 1.333333, np: 1, sysBy: 'Q', Qop: 4.01042, eta: 0.7 } },
        { name: 'Same 6 in pump: 40 ft lift through 1500 ft of 6 in pipe, f = 0.025', mode: 'operate', units: 'EN', set: { npts: '6', pq1: 0, ph1: 124, pe1: 0, pq2: 1.11401, ph2: 119, pe2: 54, pq3: 1.78241, ph3: 112, pe3: 64, pq4: 2.22801, ph4: 104, pe4: 68, pq5: 2.89641, ph5: 90, pe5: 70, pq6: 3.56481, ph6: 66, pe6: 67, Nt: 1750, Nn: 1750, rD: 1, np: 1, sysBy: 'pipe', Hs: 40, Lp: 1500, Dp: 6, fp: 0.025, Km: 0, eta: 0.7 } },
        { name: 'Two pumps in parallel against 20 m of lift and 300 m of 200 mm pipe', mode: 'operate', set: { npts: '6', pq1: 0, ph1: 50, pe1: 0, pq2: 0.02, ph2: 49, pe2: 50, pq3: 0.04, ph3: 45, pe3: 68, pq4: 0.06, ph4: 38, pe4: 75, pq5: 0.08, ph5: 28, pe5: 70, pq6: 0.1, ph6: 15, pe6: 55, Nt: 1450, Nn: 1450, rD: 1, np: 2, arr: 'parallel', sysBy: 'pipe', Hs: 20, Lp: 300, Dp: 200, fp: 0.02, Km: 2, eta: 0.7 } },
        { name: 'Two pumps in series against 70 m of lift', mode: 'operate', set: { npts: '6', pq1: 0, ph1: 50, pe1: 0, pq2: 0.02, ph2: 49, pe2: 50, pq3: 0.04, ph3: 45, pe3: 68, pq4: 0.06, ph4: 38, pe4: 75, pq5: 0.08, ph5: 28, pe5: 70, pq6: 0.1, ph6: 15, pe6: 55, Nt: 1450, Nn: 1450, rD: 1, np: 2, arr: 'series', sysBy: 'pipe', Hs: 70, Lp: 300, Dp: 200, fp: 0.02, Km: 2, eta: 0.7 } },
        // cavitation
        { name: 'Pump with NPSH_R 4 m set 3 m above the sump', mode: 'cavit', set: { mtype: 'pump', H: 40, patm: 101.325, pv: 2.34, sigBy: 'npsh', npsh: 4, hLs: 0.6, zs: 3 } },
        { name: 'Francis turbine, σ_c = 0.10 under 40 m: highest runner setting', mode: 'cavit', set: { mtype: 'turbine', H: 40, patm: 101.325, pv: 2.34, sigBy: 'sigma', sigma: 0.1, hLs: 0, zs: 4 } },
        { name: 'Hot water (80 °C, p_v 47.4 kPa): the same pump cavitates', mode: 'cavit', set: { mtype: 'pump', Sg: 0.972, H: 40, patm: 101.325, pv: 47.4, sigBy: 'npsh', npsh: 4, hLs: 0.6, zs: 3 } },
        // propellers
        { name: 'Schaum 14.40 — 80 in propeller, 1200 rpm, 132 ft/s, 720 lb, 220 hp (C_F 0.383, C_P 0.483)', mode: 'prop', units: 'EN', set: { Sg: 0.0012216, Dpr: 6.66667, N: 1200, V: 132, Fp: 720, Pw: 220, sim: 'none' } },
        { name: 'Schaum 14.42 — 200 mm model, 71.2 N at 140 rpm → ship at 7.32 m/s, 178 kN (5.0 m, 11.2 rpm; book 5.08 m)', mode: 'prop', set: { Sg: 1, Sg2: 1, Dpr: 0.2, N: 140, V: 3.66, Fp: 0.0712, Pw: 0, sim: 'VF', V2: 7.32, F2: 178 } }
      ],
      hint: 'The wheel turns at a speed scaled from N. Machine constants: the band at the bottom shows which type of machine suits the specific speed. Impeller: velocity triangles are drawn to scale. Pump curves: the dot is the operating point.'
    };

    MT.draw = function (ctx, W, H, R, A, T) {
      const d = R.data, U = S.U, I = S.I, L = U.L; bg(ctx, W, H);
      const cp = W < 560;
      if (d.kind === 'char') {
        const cx = cp ? W * 0.66 : W * 0.3, cy = cp ? H * 0.5 : H * 0.42, Rw = cp ? Math.min(W * 0.2, H * 0.17) : Math.min(W * 0.2, H * 0.26), th = spin(A, T, d.N);
        wheel(ctx, cx, cy, Rw, th, d.turb ? 13 : 7, 'vane');
        rotArrow(ctx, cx, cy, Rw + 16, `N = ${fmt(d.N)} rpm`, d.turb);
        dimH(ctx, cx - Rw, cx + Rw, cy + Rw + 22, `D = ${inOf(d.D)}`);
        const ux = cp ? cx - Rw - 6 : cx + Rw + 6, ud = (d.turb ? -1 : 1) * (cp ? -1 : 1);
        arrow(ctx, ux, cy, ux, cy + ud * 40, C.danger, 2.2, 8);
        txt(ctx, `u = ${fmt(d.u)} ${U.v}`, cp ? ux - 8 : ux + 8, cy + ud * 22, { align: cp ? 'right' : 'left', mono: true, size: 11, color: C.danger, bg: C.bg });
        const lines = [
          `${d.turb ? 'Turbine' : 'Pump'}${d.stages > 1 ? `, ${d.stages} stages` : ''}`,
          `H = ${fmt(d.H)} ${L},  Q = ${fmt(d.Q)} ${U.Q}`,
          `P = ${fmt(U.P1(d.P))} ${U.P1u},  η = ${fmt(d.eta * 100)} %`,
          `φ = u/√(2gH) = ${fmt(d.phi)}`
        ];
        if (d.H2 > 0) lines.push(`under ${fmt(d.H2)} ${L}: N ${fmt(d.N2)} rpm, Q ${fmt(d.Q2)}, P ${fmt(U.P1(d.P2))} ${U.P1u}`);
        const tx = cp ? 14 : W * 0.6; lines.forEach((s, i) => txt(ctx, s, tx, (cp ? 18 : H * 0.2) + i * 18, { mono: true, size: cp ? 10.5 : 12, bold: i === 0 }));
        nsScale(ctx, 40, W - 40, H - (cp ? 38 : 52), d.Ns, d.turb);
        return;
      }
      if (d.kind === 'homolog') {
        const one = d.one, two = d.two, D1 = one.D, D2 = two.D, Rm = Math.min(W * 0.2, H * 0.22);
        const ra = D1 >= D2 ? Rm : Rm * (D1 / D2), rb = D2 >= D1 ? Rm : Rm * (D2 / D1);
        const c1 = [W * 0.27, H * 0.33], c2 = [W * 0.73, H * 0.33];
        const th = spin(A, T, 200);
        wheel(ctx, c1[0], c1[1], Math.max(ra, 10), th * (one.N / Math.max(one.N, two.N || 1)), 7, 'vane');
        wheel(ctx, c2[0], c2[1], Math.max(rb, 10), th * ((two.N || 0) / Math.max(one.N, two.N || 1)), 7, 'vane');
        arrow(ctx, W * 0.43, H * 0.33, W * 0.57, H * 0.33, C.muted, 2, 9);
        if (!cp) txt(ctx, 'homologous', W / 2, H * 0.33 - 14, { align: 'center', size: 11, color: C.muted });
        const lab = (c, v, nm) => {
          const ls = [nm, `D = ${fmt(v.D)} ${L}`, `N = ${fmt(v.N)} rpm`]; if (isFinite(v.H) && v.H > 0) ls.push(`H = ${fmt(v.H)} ${L}`); if (isFinite(v.Q) && v.Q > 0) ls.push(`Q = ${fmt(v.Q)} ${U.Q}`); if (isFinite(v.P) && v.P > 0) ls.push(`P = ${fmt(U.P1(v.P))} ${U.P1u}`);
          ls.forEach((s, i) => txt(ctx, s, c[0], H * 0.33 + Rm + 20 + i * (cp ? 14 : 16), { align: 'center', mono: true, size: cp ? 10.5 : 12, bold: i === 0 }));
        };
        lab(c1, one, 'Machine 1'); lab(c2, two, 'Machine 2');
        txt(ctx, 'Q ∝ ND³,  H ∝ N²D²,  P ∝ ρN³D⁵', W / 2, 18, { align: 'center', mono: true, size: 12, bold: true });
        return;
      }
      if (d.kind === 'pelton') {
        const cx = W * (cp ? 0.58 : 0.5), cy = H * (cp ? 0.45 : 0.42), Rw = cp ? Math.min(W * 0.22, H * 0.25) : Math.min(W * 0.26, H * 0.3), th = spin(A, T, d.N);
        wheel(ctx, cx, cy, Rw, th, 16, 'bucket');
        rotArrow(ctx, cx, cy, Rw * 0.55, `N = ${fmt(d.N)} rpm`, true);
        const yj = cy + Rw, hw = clamp((d.d / d.D) * Rw, 3, 14);
        // nozzle and jet
        poly(ctx, [[14, yj - hw * 2.2], [cx - Rw * 0.9, yj - hw], [cx - Rw * 0.9, yj + hw], [14, yj + hw * 2.2]], true); ctx.fillStyle = C.pipe; ctx.fill(); ctx.strokeStyle = C.wall; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = C.water; ctx.globalAlpha = 0.6; ctx.fillRect(cx - Rw * 0.9, yj - hw, Rw * 0.9, 2 * hw); ctx.globalAlpha = 1;
        K.flowDots(ctx, A, 'jet', [[cx - Rw * 0.9, yj], [cx, yj]], d.Vj, T.pdt, C.part);
        arrow(ctx, cx - Rw * 0.85, yj + hw + 16, cx - Rw * 0.4, yj + hw + 16, C.water_deep, 2, 8);
        txt(ctx, `V_j = ${fmt(d.Vj)} ${U.v}`, cx - Rw * 0.85, yj + hw + 32, { mono: true, size: 11, color: C.water_deep });
        arrow(ctx, cx + 4, yj + 10, cx + 50, yj + 10, C.danger, 2, 8); txt(ctx, `u = ${fmt(d.u)} ${U.v}`, cx + 56, yj + 10, { mono: true, size: 11, color: C.danger, bg: C.bg });
        dimH(ctx, cx - Rw, cx + Rw, cy - Rw - (cp ? 18 : 24), `D = ${inOf(d.D)}`);
        txt(ctx, `${d.nj > 1 ? d.nj + ' jets, ' : ''}d = ${fmt(d.d)} ${L} (${fmt(S.U.sys === 'SI' ? d.d * 1000 : d.d * 12)} ${S.U.sys === 'SI' ? 'mm' : 'in'})`, 14, cp ? 16 : yj - hw * 2.2 - 12, { mono: true, size: 11, bg: C.bg });
        txt(ctx, `Q = ${fmt(d.Q)} ${U.Q},  P = ${fmt(U.P1(d.P))} ${U.P1u}`, 14, H - 16, { mono: true, size: 12, bold: true });
        return;
      }
      if (d.kind === 'impeller') {
        const cx = cp ? W * 0.5 : W * 0.24, cy = cp ? H * 0.3 : H * 0.53, R2 = Math.min(cp ? W * 0.2 : W * 0.18, (cp ? H * 0.14 : H * 0.32)), R1 = R2 * (d.D1 / d.D2), th = spin(A, T, d.N);
        ctx.beginPath(); ctx.arc(cx, cy, R2, 0, 2 * PI); ctx.fillStyle = C.water; ctx.globalAlpha = 0.25; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = C.wall; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, R1, 0, 2 * PI); ctx.strokeStyle = C.muted; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
        const nb = 7, b2 = d.b2 * DEG;
        for (let i = 0; i < nb; i++) {
          const a0 = th + (2 * PI * i) / nb, pts = [];
          // blade drawn so its exit makes angle β₂ with the (counter-clockwise) blade motion
          const sweep = -(PI - b2) * 0.9 * (1 - R1 / R2) * 1.4;
          for (let k = 0; k <= 14; k++) { const t = k / 14, r = R1 + (R2 - R1) * t, a = a0 + sweep * t; pts.push([cx + r * Math.cos(a), cy - r * Math.sin(a)]); }
          stroke(ctx, pts, C.wall, 2.4);
        }
        rotArrow(ctx, cx, cy, R2 + 10, '', true);
        const dLab = `D₂ = ${fmt(S.U.sys === 'SI' ? d.D2 * 1000 : d.D2 * 12)} ${S.U.sys === 'SI' ? 'mm' : 'in'},  N = ${fmt(d.N)} rpm`;
        if (!cp) txt(ctx, dLab, cx, cy + R2 + 18, { align: 'center', mono: true, size: 11, bg: C.bg });
        // velocity triangles
        const tri = (ox, oy, u, vr, vu, lab, sc) => {
          const P0 = [ox, oy], Pu = [ox + u * sc, oy], Pv = [ox + vu * sc, oy - vr * sc];
          arrow(ctx, P0[0], P0[1], Pu[0], Pu[1], C.danger, 2.2, 8); arrow(ctx, P0[0], P0[1], Pv[0], Pv[1], C.water_deep, 2.4, 8); arrow(ctx, Pu[0], Pu[1], Pv[0], Pv[1], C.hgl, 2, 8);
          txt(ctx, `u${lab} = ${fmt(u, 3)}`, (P0[0] + Pu[0]) / 2, oy + 13, { align: 'center', mono: true, size: 10.5, color: C.danger, bg: C.bg });
          txt(ctx, `V${lab} = ${fmt(Math.hypot(vr, vu), 3)}`, (P0[0] + Pv[0]) / 2 - 6, (P0[1] + Pv[1]) / 2 - 8, { align: 'right', mono: true, size: 10.5, color: C.water_deep, bg: C.bg });
          txt(ctx, `v${lab} = ${fmt(Math.hypot(vr, vu - u), 3)}`, (Pu[0] + Pv[0]) / 2 + 6, (Pu[1] + Pv[1]) / 2 - 2, { mono: true, size: 10.5, color: C.hgl, bg: C.bg });
        };
        const x0 = cp ? 30 : W * 0.5, wAvail = (cp ? W - 110 : W * 0.36);
        const minX = Math.min(0, d.Vu2, d.Vu1 || 0), span = Math.max(d.u2, d.Vu2) - minX || 1;
        const sc = Math.min(wAvail / span, (cp ? H * 0.11 : H * 0.3) / Math.max(d.Vr2, d.Vr1 || 0, 1e-9));
        const ox = x0 - minX * sc;
        tri(ox, cp ? H * 0.68 : H * 0.42, d.u2, d.Vr2, d.Vu2, '₂', sc);
        txt(ctx, `Exit (β₂ = ${fmt(d.b2)}°, α₂ = ${fmt(d.a2)}°)`, x0, (cp ? H * 0.68 : H * 0.42) - (d.Vr2 * sc) - 18, { size: 11, bold: true });
        if (isFinite(d.v1) && d.Vr1 > 0) {
          const oy = cp ? H * 0.94 : H * 0.86;
          tri(ox, oy, d.u1, d.Vr1, d.Vu1, '₁', sc);
          txt(ctx, `Inlet (β₁ = ${fmt(d.b1)}°)`, x0, oy - d.Vr1 * sc - 16, { size: 11, bold: true });
        }
        txt(ctx, `H' = ${fmt(d.Hi)} ${L}${d.Hd < d.Hi - 1e-9 ? `,  H = ${fmt(d.Hd)} ${L}` : ''},  Q = ${fmt(d.Q)} ${U.Q}`, 14, 18, { mono: true, size: 12, bold: true });
        txt(ctx, cp ? dLab : `velocities in ${U.v}; red u blade, blue V absolute, purple v relative`, 14, 36, { size: 10.5, color: C.muted });
        return;
      }
      if (d.kind === 'operate') {
        const cv = d.curve, series = [{ xs: cv.cq, ys: cv.ch, color: C.water_deep, w: 2.5 }];
        if (d.single) series.push({ xs: cv.cq, ys: d.single, color: C.water_deep, w: 1.2, dash: [5, 4] });
        if (cv.cs.some(isFinite)) series.push({ xs: cv.cq, ys: cv.cs, color: C.hgl, w: 2.2 });
        const leg = [{ label: d.np > 1 ? `${d.np} pumps (${d.arr})` : 'pump curve', color: C.water_deep }];
        if (d.single) leg.push({ label: 'one pump', color: C.water_deep, dash: [5, 4] });
        if (cv.cs.some(isFinite)) leg.push({ label: 'system curve', color: C.hgl });
        plot(ctx, { x: 0, y: 0, w: W, h: H }, { title: 'Head vs flow', xs: cv.cq, series, xmin: 0, ymin: 0, xlab: `Q (${U.Q})`, ylab: L, legend: leg, pts: d.pts.map((p) => ({ x: p[0], y: p[1], color: C.muted, r: 3 })).concat([{ x: d.Q, y: d.H, color: C.danger, r: 6, label: `Q = ${fmt(d.Q)}, H = ${fmt(d.H)}` }]) });
        return;
      }
      if (d.kind === 'cavit') {
        const top = 50, bot = H - 40, ymax = Math.max(d.ha - d.hv, d.zs, d.zmax, 1) * 1.15, ymin = Math.min(0, d.zs, d.zmax) - 1, Y = (z) => bot - ((z - ymin) / (ymax - ymin)) * (bot - top);
        const xw = cp ? W * 0.12 : W * 0.15, x1 = cp ? W * 0.6 : W * 0.5;
        ctx.fillStyle = C.water; ctx.globalAlpha = 0.35; ctx.fillRect(xw - 10, Y(0), x1 - xw + 40, bot - Y(0) + 30); ctx.globalAlpha = 1; stroke(ctx, [[xw - 10, Y(0)], [x1 + 30, Y(0)]], C.water_deep, 2);
        txt(ctx, d.turb ? 'tailwater' : 'supply surface', xw - 6, Y(0) + 14, { size: 11, color: C.water_deep });
        // machine at z_s
        const mx = x1 - 30, my = Y(d.zs);
        stroke(ctx, [[mx, my], [mx, Y(0) + 26]], C.pipe, 10);
        ctx.beginPath(); ctx.arc(mx, my, 18, 0, 2 * PI); ctx.fillStyle = d.npa >= d.need ? C.ok : C.danger; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = C.wall; ctx.lineWidth = 2; ctx.stroke();
        txt(ctx, d.turb ? 'T' : 'P', mx, my, { align: 'center', bold: true, color: C.bg });
        dimV(ctx, mx - 40, Y(0), my, `z_s = ${fmt(d.zs)} ${L}`, null, 'left');
        stroke(ctx, [[xw, Y(d.zmax)], [x1 + 40, Y(d.zmax)]], C.danger, 1.5, [6, 4]); txt(ctx, `z_max = ${fmt(d.zmax)} ${L}`, cp ? xw : x1 + 44, Y(d.zmax) - (cp ? 10 : 0), { mono: true, size: 11, color: C.danger, bg: C.bg });
        stroke(ctx, [[xw, Y(d.ha - d.hv)], [x1 + 40, Y(d.ha - d.hv)]], C.egl, 1.2, [3, 3]); txt(ctx, `(p_atm − p_v)/γ = ${fmt(d.ha - d.hv)} ${L}`, cp ? xw : x1 + 44, Y(d.ha - d.hv) - (cp ? 10 : 0), { mono: true, size: 11, color: C.egl, bg: C.bg });
        txt(ctx, d.npa >= d.need ? `NPSH_A ${fmt(d.npa)} ≥ ${fmt(d.need)} ${L}: no cavitation` : `NPSH_A ${fmt(d.npa)} < ${fmt(d.need)} ${L}: cavitation`, 14, 18, { mono: true, bold: true, size: 12, color: d.npa >= d.need ? C.ok : C.danger });
        return;
      }
      if (d.kind === 'prop') {
        const cx = W * (cp ? 0.75 : 0.35), cy = H * (cp ? 0.58 : 0.48), Rr = cp ? Math.min(W * 0.2, H * 0.24) : Math.min(W * 0.22, H * 0.32), th = spin(A, T, d.N);
        for (let i = 0; i < 3; i++) { const a = th + (2 * PI * i) / 3; ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(Rr * 0.5, 0, Rr * 0.5, Rr * 0.12, 0, 0, 2 * PI); ctx.fillStyle = C.pipe; ctx.fill(); ctx.strokeStyle = C.wall; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); }
        ctx.beginPath(); ctx.arc(cx, cy, Rr * 0.1, 0, 2 * PI); ctx.fillStyle = C.wall; ctx.fill();
        ctx.beginPath(); ctx.arc(cx, cy, Rr, 0, 2 * PI); ctx.strokeStyle = C.muted; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
        dimH(ctx, cx - Rr, cx + Rr, cy + Rr + 18, `D = ${fmt(d.D)} ${L}`);
        rotArrow(ctx, cx, cy, Rr + 10, `N = ${fmt(d.N)} rpm`, false);
        const lines = [`V = ${fmt(d.V)} ${U.v}`, `F = ${fmt(d.F)} ${d.Fu}`, `C_F = ${fmt(d.CF)}`, d.P > 0 ? `C_P = ${fmt(d.CP)}` : '', `J = V/(nD) = ${fmt(d.J)}`, d.P > 0 && d.V > 0 ? `η = ${fmt(d.eta * 100)} %` : ''].filter(Boolean);
        if (d.two) lines.push('', 'Similar propeller:', `D₂ = ${fmt(d.two.D)} ${L}, N₂ = ${fmt(d.two.N)} rpm`, `V₂ = ${fmt(d.two.V)} ${U.v}, F₂ = ${fmt(d.two.F)} ${d.Fu}`);
        const tx = cp ? 14 : W * 0.64; lines.forEach((s, i) => txt(ctx, s, tx, (cp ? 16 : H * 0.18) + i * 18, { mono: true, size: cp ? 10.5 : 12, bold: s.endsWith(':') }));
        return;
      }
    };
    MT.drawAux = function (ctx, W, H, R) {
      const d = R.data, U = S.U, L = U.L; bg(ctx, W, H);
      if (d.kind === 'char') {
        const xs = [], N = [], Q = [], P = []; for (let i = 0; i <= 40; i++) { const h = d.H * (0.25 + (1.75 * i) / 40), r = h / d.H; xs.push(h); N.push(d.N * Math.sqrt(r)); Q.push(d.Q * Math.sqrt(r)); P.push(U.P1(d.P * Math.pow(r, 1.5))); }
        const w2 = W / 2;
        plot(ctx, { x: 0, y: 0, w: w2, h: H }, { title: 'Same machine: speed vs head', xs, series: [{ ys: N, color: C.egl }], xlab: `H (${L})`, ylab: 'rpm', pts: [{ x: d.H, y: d.N, color: C.danger }] });
        plot(ctx, { x: w2, y: 0, w: w2, h: H }, { title: `Power (${U.P1u}) vs head`, xs, series: [{ ys: P, color: C.hgl }], xlab: `H (${L})`, ylab: U.P1u, pts: [{ x: d.H, y: U.P1(d.P), color: C.danger }] });
        return;
      }
      if (d.kind === 'homolog') { bars(ctx, W, H, 'Ratios machine 2 ÷ machine 1', [['D', d.r.D, C.wall], ['N', d.r.N, C.egl], ['H', d.r.H, C.water_deep], ['Q', d.r.Q, C.water], ['P', d.r.P, C.hgl]], ''); return; }
      if (d.kind === 'pelton') {
        const xs = [], ys = []; for (let i = 0; i <= 50; i++) { const r = i / 50; xs.push(r); ys.push(100 * 2 * r * (1 - r) * (1 + Math.cos(15 * DEG))); }
        plot(ctx, { x: 0, y: 0, w: W, h: H }, { title: 'Ideal bucket efficiency vs u/V_j (165° buckets, no friction)', xs, series: [{ ys, color: C.water_deep, fill: true }], xlab: 'u / V_j', ylab: '%', ymin: 0, pts: [{ x: d.u / d.Vj, y: 100 * 2 * (d.u / d.Vj) * (1 - d.u / d.Vj) * (1 + Math.cos(15 * DEG)), color: C.danger, label: `u/V_j = ${fmt(d.u / d.Vj, 3)}` }] });
        return;
      }
      if (d.kind === 'impeller') {
        plot(ctx, { x: 0, y: 0, w: W, h: H }, { title: "Ideal (Euler) head vs flow at this speed", xs: d.curve.qs, series: [{ ys: d.curve.hs, color: C.water_deep }], xmin: 0, xlab: `Q (${U.Q})`, ylab: L, pts: [{ x: d.Q, y: d.Hi, color: C.danger, label: `${fmt(d.Hi)} ${L}` }] });
        return;
      }
      if (d.kind === 'operate') {
        if (d.curve.ce.some(isFinite)) plot(ctx, { x: 0, y: 0, w: W, h: H }, { title: 'Pump efficiency vs total flow', xs: d.curve.cq, series: [{ ys: d.curve.ce, color: C.ok }], xmin: 0, ymin: 0, xlab: `Q (${U.Q})`, ylab: '%', pts: [{ x: d.Q, y: d.eta * 100, color: C.danger, label: `${fmt(d.eta * 100)} %` }] });
        else txt(ctx, 'Enter efficiencies with the curve points to see the efficiency curve.', 14, 20, { size: 12, color: C.muted });
        return;
      }
      if (d.kind === 'cavit') { bars(ctx, W, H, `Suction heads (${L})`, [['p_atm/γ', d.ha, C.egl], ['p_v/γ', d.hv, C.danger], ['z_s', d.zs, C.wall], ['h_L', d.hLs, C.muted], ['NPSH_A', d.npa, C.water_deep], [d.turb ? 'σ_c H' : 'NPSH_R', d.need, C.hgl]], L); return; }
      if (d.kind === 'prop') { const it = [['C_F', d.CF, C.water_deep]]; if (d.P > 0) it.push(['C_P', d.CP, C.hgl]); it.push(['J', d.J, C.egl]); bars(ctx, W, H, 'Propeller coefficients (n in rev/s)', it, ''); }
    };
    insertAfter('energy', MT);
  });
})(window);
