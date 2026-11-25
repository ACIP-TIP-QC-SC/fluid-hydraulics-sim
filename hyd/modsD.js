/* =====================================================================
   modsD.js — Hydraulics modules added in the 2026-11-25 book-coverage
   upgrade (Stage 4):
     Varied Flow Profiles      (HP.gvf)       step method, profile types,
                                              n or Q from two depths,
                                              reservoir-fed channels
     Surges & Flood Routing    (HP.unsteady)  flow start-up time, U-tube and
                                              tank oscillations, surge tanks,
                                              reservoir and Muskingum routing
   Registered through window.HYD_EXT; app.js hands over its helpers.
   ===================================================================== */
(function (root) {
  'use strict';
  const PI = Math.PI;
  (root.HYD_EXT = root.HYD_EXT || []).push(function (K) {
    const { MODS, S, C, fmt, clamp, txt, poly, stroke, arrow, dimV, dimH, plot, surfSym, pipe3, valveSym, flowDots } = K;
    const insertAfter = (id, m) => { const i = MODS.findIndex((x) => x.id === id); MODS.splice(i < 0 ? MODS.length : i + 1, 0, m); };
    const bg = (ctx, W, H) => { ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H); };
    const on = (...ms) => (P, m) => ms.includes(m);

    /* ================================================================ Varied flow profiles */
    const G = {
      id: 'gvf', tab: 'Varied Flow Profiles', title: 'Gradually Varied Flow: Step Method, Profile Types and Reservoir-fed Channels', fn: 'gvf',
      modes: [['profile', 'Distance between two depths (step method)'], ['n', 'Roughness n from two depths'], ['Q', 'Discharge from two depths'], ['res', 'Channel fed by a reservoir']],
      speed: {},
      modeDefaults: {},
      params: [
        { k: 'shape', type: 'select', label: 'Channel', def: 'rect', options: [['rect', 'Rectangular'], ['trap', 'Trapezoidal'], ['tri', 'Triangular'], ['wide', 'Wide rectangular (R = y)']] },
        { k: 'b', label: 'Bottom width b', dim: 'len', min: 0.01, max: 500, step: 0.01, def: 6, show: (P) => P.shape !== 'tri' },
        { k: 'z', label: 'Side slope z (horizontal : 1 vertical)', min: 0, max: 10, step: 0.01, def: 1.5, show: (P) => P.shape === 'trap' || P.shape === 'tri' },
        { k: 'Q', label: 'Discharge Q', dim: 'Q', min: 0.001, max: 50000, step: 0.001, def: 20, log: true, modes: ['profile', 'n'] },
        { k: 'n', label: 'Manning n', min: 0.008, max: 0.1, step: 0.0001, def: 0.013, modes: ['profile', 'Q', 'res'] },
        { k: 'S0', label: 'Bed slope S₀ (negative = adverse)', min: -0.05, max: 0.2, step: 0.000001, def: 0.0008 },
        { k: 'Hr', label: 'Reservoir level above the channel bed at the entrance', dim: 'len', min: 0.01, max: 100, step: 0.01, def: 3, modes: ['res'] },
        { k: 'ke', label: 'Entrance loss k (× V₁²/2g)', min: 0, max: 2, step: 0.01, def: 0.25, modes: ['res'] },
        { k: 'y1', label: 'Depth at section 1', dim: 'len', min: 0.001, max: 100, step: 0.001, def: 3, modes: ['profile', 'n', 'Q'] },
        { k: 'y2', label: 'Depth at section 2', labelFn: (P, m) => (m === 'profile' ? 'Depth at section 2 (0 = run to near y_n)' : m === 'res' ? 'Control depth at the downstream end' : 'Depth at section 2'), dim: 'len', min: 0, max: 100, step: 0.001, def: 2.5 },
        { k: 'Lr', label: 'Distance from 1 to 2 (downstream +)', labelFn: (P, m) => (m === 'res' ? 'Channel length' : 'Distance from 1 to 2 (downstream +)'), dim: 'len', min: -100000, max: 100000, step: 0.1, def: 500, modes: ['n', 'Q', 'res'] },
        { k: 'nst', label: 'Number of reaches', min: 1, max: 50, step: 1, def: 5, modes: ['profile', 'Q', 'res'] },
        { k: 'avg', type: 'select', label: 'Friction slope over a reach', def: 'VR', options: [['VR', 'From the mean V and R (Schaum, Hibbeler)'], ['S', 'Mean of the end slopes']] }
      ],
      presets: [
        { name: 'Schaum 10.47 — 6 ft flume, 66 cfs, n 0.013: 3.20 ft → 2.70 ft in one reach', mode: 'profile', units: 'EN', set: { shape: 'rect', b: 6, Q: 66, n: 0.013, S0: 0.0004, y1: 3.2, y2: 2.7, nst: 1, avg: 'VR' } },
        { name: 'Schaum 10.50 — backwater behind an obstruction, 126 m³/s, 4.55 m → 2.95 m in 10 reaches (4568 m)', mode: 'profile', set: { shape: 'rect', b: 12, Q: 126, n: 0.013, S0: 0.00086, y1: 4.55, y2: 2.95, nst: 10, avg: 'VR' } },
        { name: 'Hibbeler Example 12.13 — below a sluice gate, horizontal 1.5 m channel, 2 m³/s, 0.20 → 0.23 m (H3, 6.31 m)', mode: 'profile', set: { shape: 'rect', b: 1.5, Q: 2, n: 0.014, S0: 0, y1: 0.2, y2: 0.23, nst: 3, avg: 'VR' } },
        { name: 'M1 backwater in a trapezoidal canal, run to near the normal depth', mode: 'profile', set: { shape: 'trap', b: 6, z: 1.5, Q: 30, n: 0.015, S0: 0.0004, y1: 4, y2: 0, nst: 20, avg: 'VR' } },
        { name: 'S2 drawdown on a steep chute, from critical depth downstream', mode: 'profile', set: { shape: 'rect', b: 4, Q: 20, n: 0.014, S0: 0.02, y1: 1.36, y2: 0, nst: 15, avg: 'VR' } },
        { name: 'Schaum 10.48 — 40 ft channel, 900 cfs, 4.50 ft and 5.00 ft 300 ft apart: n (0.0288)', mode: 'n', units: 'EN', set: { shape: 'rect', b: 40, Q: 900, S0: 0.00283, y1: 4.5, y2: 5, Lr: 300, avg: 'VR' } },
        { name: 'Schaum 10.49 — 20 ft channel, n 0.011, 8.50 ft and 10.25 ft 2000 ft apart: Q (≈ 1050 cfs)', mode: 'Q', units: 'EN', set: { shape: 'rect', b: 20, n: 0.011, S0: 0.001, y1: 8.5, y2: 10.25, Lr: 2000, nst: 1, avg: 'VR' } },
        { name: 'Schaum 10.51 — reservoir-fed 15 ft flume, 800 ft, 4.12 ft at the weir (566 cfs)', mode: 'res', units: 'EN', set: { shape: 'rect', b: 15, n: 0.015, S0: 0.0009, Hr: 6.22, ke: 0.25, Lr: 800, y2: 4.12, nst: 1, avg: 'VR' } }
      ],
      hint: 'The bed slope is exaggerated. Blue: water surface from the step method; dashed lines: normal depth y_n (green) and critical depth y_c (red), drawn parallel to the bed.'
    };
    G.draw = function (ctx, W, H, R) {
      const d = R.data, U = S.U, I = S.I, L = U.L; bg(ctx, W, H);
      const rows = d.rows || [];
      const pts = [[0, d.y1]]; rows.forEach((r) => pts.push([r.x, r.yb]));
      const xs = pts.map((p) => p[0]), xmin = Math.min(...xs), xmax = Math.max(...xs), span = xmax - xmin || 1;
      const ys = pts.map((p) => p[1]).concat([d.yc]).concat(isFinite(d.yn) && d.yn < 4 * Math.max(...pts.map((p) => p[1])) ? [d.yn] : []);
      const ymax = Math.max(...ys) * 1.25;
      const resW = d.H ? Math.min(90, W * 0.16) : 0;
      const x0 = 30 + resW, x1 = W - 20, top = 46, bed0 = H - 50;
      const drop = clamp(I.S0 * span / ymax, -0.6, 0.6) * (bed0 - top) * 0.6; // exaggerated bed drop in px
      const X = (x) => x0 + ((x - xmin) / span) * (x1 - x0);
      const bedY = (x) => bed0 - drop / 2 + drop * ((x - xmin) / span);
      const sc = (bed0 - top - Math.abs(drop)) / ymax, Y = (x, y) => bedY(x) - y * sc;
      // water body
      const surf = pts.map((p) => [X(p[0]), Y(p[0], p[1])]).sort((a, b) => a[0] - b[0]);
      poly(ctx, surf.concat([[X(xmax), bedY(xmax)], [X(xmin), bedY(xmin)]]), true); ctx.fillStyle = C.water; ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1;
      stroke(ctx, surf, C.water_deep, 2.5);
      // bed
      ctx.fillStyle = C.soil || C.wall; ctx.globalAlpha = 0.25; poly(ctx, [[X(xmin), bedY(xmin)], [X(xmax), bedY(xmax)], [X(xmax), H], [X(xmin), H]], true); ctx.fill(); ctx.globalAlpha = 1;
      stroke(ctx, [[X(xmin), bedY(xmin)], [X(xmax), bedY(xmax)]], C.wall, 2.5);
      if (isFinite(d.yn) && d.yn * sc < bed0) stroke(ctx, [[X(xmin), Y(xmin, d.yn)], [X(xmax), Y(xmax, d.yn)]], C.ok, 1.5, [7, 5]);
      stroke(ctx, [[X(xmin), Y(xmin, d.yc)], [X(xmax), Y(xmax, d.yc)]], C.danger, 1.5, [3, 4]);
      const xn = xmin + 0.8 * (xmax - xmin); if (isFinite(d.yn) && d.yn * sc < bed0) txt(ctx, `y_n = ${fmt(d.yn)}`, X(xn), Y(xn, d.yn) - 9, { align: 'right', size: 10.5, mono: true, color: C.ok, bg: C.bg });
      const xc = xmin + 0.12 * (xmax - xmin); txt(ctx, `y_c = ${fmt(d.yc)}`, X(xc), Y(xc, d.yc) + 11, { size: 10.5, mono: true, color: C.danger, bg: C.bg });
      // stations
      pts.forEach((p, i) => { const xx = X(p[0]); stroke(ctx, [[xx, bedY(p[0])], [xx, Y(p[0], p[1])]], C.muted, 0.8, [2, 3]); if (i === 0 || i === pts.length - 1 || pts.length <= 6) txt(ctx, fmt(p[1], 3), xx, Y(p[0], p[1]) - 10, { align: 'center', mono: true, size: 10, bg: C.bg }); });
      if (d.H) {
        const xr0 = 10, xr1 = x0, yS = bedY(xmin) - d.H * sc;
        ctx.fillStyle = C.water; ctx.globalAlpha = 0.35; ctx.fillRect(xr0, yS, xr1 - xr0, bedY(xmin) - yS + 20); ctx.globalAlpha = 1;
        stroke(ctx, [[xr0, yS], [xr1, yS]], C.water_deep, 1.5); surfSym(ctx, (xr0 + xr1) / 2, yS);
        txt(ctx, `H = ${fmt(d.H)}`, (xr0 + xr1) / 2, yS - 22, { align: 'center', mono: true, size: 11, bg: C.bg });
      }
      arrow(ctx, X(xmin) + 10, top - 14, X(xmin) + 60, top - 14, C.water_deep, 2, 8); txt(ctx, 'flow', X(xmin) + 66, top - 14, { size: 11, color: C.water_deep });
      dimH(ctx, X(xmin), X(xmax), H - 18, `${fmt(span)} ${L}`);
      txt(ctx, `${d.type} profile,  Q = ${fmt(d.Q)} ${U.Q},  n = ${fmt(d.n)}`, W - 14, 16, { align: 'right', bold: true, mono: true, size: 12 });
    };
    G.drawAux = function (ctx, W, H, R) {
      const d = R.data, U = S.U, L = U.L; bg(ctx, W, H);
      const rows = d.rows || [], xs = [0].concat(rows.map((r) => r.x)), ys = [d.y1].concat(rows.map((r) => r.yb));
      const ord = xs.map((x, i) => [x, ys[i]]).sort((a, b) => a[0] - b[0]);
      const hm = [{ y: d.yc, label: 'y_c', color: C.danger }]; if (isFinite(d.yn)) hm.push({ y: d.yn, label: 'y_n', color: C.ok });
      plot(ctx, { x: 0, y: 0, w: W, h: H }, { title: `Depth along the channel (${L})`, xs: ord.map((p) => p[0]), series: [{ ys: ord.map((p) => p[1]), color: C.water_deep, fill: true }], ymin: 0, ymax: Math.max(...ys, isFinite(d.yn) ? d.yn : 0, d.yc) * 1.15, xlab: `x (${L}), from section 1`, ylab: L, hmarks: hm, pts: ord.map((p) => ({ x: p[0], y: p[1], color: C.water_deep, r: 3 })) });
    };
    insertAfter('manning', G);

    /* ================================================================ Surges & flood routing */
    const inP = [];
    for (let i = 1; i <= 20; i++) inP.push({ k: 'in' + i, label: '', labelFn: (P) => `Inflow at t = ${fmt(((i - 1) * P.dtr), 4)} h`, dim: 'Q', min: 0, max: 100000, step: 0.001, def: [10, 40, 120, 180, 150, 100, 60, 35, 20, 12, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10][i - 1], show: (P, m) => (m === 'pool' || m === 'musk') && +P.nI >= i });
    const tabP = [];
    for (let i = 1; i <= 10; i++) {
      const has = (P, m) => m === 'pool' && P.res === 'table' && +P.nT >= i;
      tabP.push(
        { k: '_t' + i, type: 'head', label: `Table row ${i}`, show: has },
        { k: 'te' + i, label: 'Elevation', dim: 'len', min: -1000, max: 10000, step: 0.01, def: 100 + i, show: has },
        { k: 'ts' + i, label: 'Storage', dim: 'vol', min: 0, max: 1e12, step: 1, def: (i - 1) * (i - 1) * 2e5, log: false, show: has },
        { k: 'to' + i, label: 'Outflow', dim: 'Q', min: 0, max: 100000, step: 0.001, def: i <= 3 ? 0 : (i - 3) * 30, show: has }
      );
    }
    const UF = {
      id: 'unsteady', tab: 'Surges & Flood Routing', title: 'Unsteady Flow: Start-up Time, Oscillations, Surge Tanks and Flood Routing', fn: 'unsteady',
      modes: [['establish', 'Flow start-up after a valve opens'], ['mass', 'Oscillation in U-tubes, shafts and standpipes'], ['surge', 'Surge tank'], ['pool', 'Reservoir (level-pool) routing'], ['musk', 'Muskingum channel routing']],
      speed: {},
      modeDefaults: { establish: { Lp: 1000, Dp: 500 }, mass: { Lp: 1000, Dp: 500 }, surge: { Lp: 10000, Dp: 3000 } },
      params: [
        // pipe (shared)
        { k: '_hp', type: 'head', label: 'Pipe or tunnel', modes: ['establish', 'mass', 'surge'] },
        { k: 'mkind', type: 'select', label: 'System', def: 'utube', options: [['utube', 'U-tube (liquid column)'], ['tanks', 'Two shafts, standpipes or reservoirs joined by a pipe']], modes: ['mass'] },
        { k: 'H', label: 'Head H driving the flow', dim: 'len', min: 0.01, max: 2000, step: 0.01, def: 20, modes: ['establish'] },
        { k: 'Lp', label: 'Length L', labelFn: (P, m) => (m === 'mass' && P.mkind === 'utube' ? 'Total length of the liquid column L' : 'Pipe length L'), dim: 'len', min: 0.01, max: 100000, step: 0.01, def: 1000, log: true, modes: ['establish', 'mass', 'surge'] },
        { k: 'Dp', label: 'Diameter D', dim: 'mm', min: 1, max: 20000, step: 0.1, def: 500, log: true, modes: ['establish', 'mass', 'surge'] },
        { k: 'fr', type: 'select', label: 'Friction', def: 'turb', options: [['turb', 'Turbulent (Darcy f)'], ['lam', 'Laminar (viscosity)'], ['none', 'None']], modes: ['mass'] },
        { k: 'fp', label: 'Darcy friction factor f', min: 0.005, max: 0.1, step: 0.0001, def: 0.02, show: (P, m) => m === 'establish' || m === 'surge' || (m === 'mass' && P.fr === 'turb') },
        { k: 'Km', label: 'Minor losses ΣK', min: 0, max: 200, step: 0.01, def: 0, show: (P, m) => m === 'establish' || m === 'surge' || (m === 'mass' && P.fr === 'turb') },
        { k: 'nu', label: 'Kinematic viscosity ν', dim: 'nu', min: 0.01, max: 100000, step: 0.01, def: 1, log: true, show: (P, m) => m === 'mass' && P.fr === 'lam' },
        { k: 'outlet', type: 'select', label: 'Outlet', def: 'free', options: [['free', 'All losses in ΣK (pipe exit included there)'], ['nozzle', 'Nozzle at the end (jet velocity head added)']], modes: ['establish'] },
        { k: 'dn', label: 'Nozzle diameter d', dim: 'mm', min: 1, max: 20000, step: 0.1, def: 200, show: (P, m) => m === 'establish' && P.outlet === 'nozzle' },
        { k: 'frac', label: 'Fraction of the final velocity', min: 0.01, max: 0.999, step: 0.001, def: 0.9, modes: ['establish'] },
        // mass oscillation
        { k: '_hm', type: 'head', label: 'Free surfaces and start', modes: ['mass'] },
        { k: 'mBy', type: 'select', label: 'Surfaces given by', def: 'D', options: [['D', 'Diameters'], ['A', 'Areas']], show: (P, m) => m === 'mass' && P.mkind === 'tanks' },
        { k: 'D1s', label: 'Diameter of surface 1', dim: 'len', min: 0.01, max: 1000, step: 0.01, def: 5, show: (P, m) => m === 'mass' && P.mkind === 'tanks' && P.mBy === 'D' },
        { k: 'D2s', label: 'Diameter of surface 2', dim: 'len', min: 0.01, max: 1000, step: 0.01, def: 5, show: (P, m) => m === 'mass' && P.mkind === 'tanks' && P.mBy === 'D' },
        { k: 'A1s', label: 'Area of surface 1', dim: 'area', min: 0.0001, max: 1e7, step: 0.0001, def: 20, log: true, show: (P, m) => m === 'mass' && P.mkind === 'tanks' && P.mBy === 'A' },
        { k: 'A2s', label: 'Area of surface 2', dim: 'area', min: 0.0001, max: 1e7, step: 0.0001, def: 30, log: true, show: (P, m) => m === 'mass' && P.mkind === 'tanks' && P.mBy === 'A' },
        { k: 'init', type: 'select', label: 'Start', def: 'z', options: [['z', 'Surface 1 displaced z₀ from the final level'], ['dh', 'Level difference Δh between the surfaces']], modes: ['mass'] },
        { k: 'z0', label: 'Displacement z₀ of surface 1', dim: 'len', min: -1000, max: 1000, step: 0.001, def: 6, show: (P, m) => m === 'mass' && P.init === 'z' },
        { k: 'dh', label: 'Level difference Δh (surface 1 higher)', dim: 'len', min: -1000, max: 1000, step: 0.001, def: 10, show: (P, m) => m === 'mass' && P.init === 'dh' },
        { k: 'V0', label: 'Initial velocity in the pipe (1 → 2)', dim: 'vel', min: -100, max: 100, step: 0.001, def: 0, modes: ['mass'] },
        { k: 'tmax', label: 'Time to simulate (0 = automatic)', dim: 's', min: 0, max: 100000, step: 0.1, def: 0, modes: ['mass', 'surge'] },
        // surge tank
        { k: '_hs', type: 'head', label: 'Reservoir, tank and turbines', modes: ['surge'] },
        { k: 'Zr', label: 'Reservoir level Z', dim: 'len', min: -1000, max: 5000, step: 0.01, def: 100, modes: ['surge'] },
        { k: 'sBy', type: 'select', label: 'Tank given by', def: 'A', options: [['A', 'Area'], ['D', 'Diameter']], modes: ['surge'] },
        { k: 'As', label: 'Tank area A_s', dim: 'area', min: 0.01, max: 1e6, step: 0.01, def: 75, log: true, show: (P, m) => m === 'surge' && P.sBy === 'A' },
        { k: 'Ds', label: 'Tank diameter', dim: 'len', min: 0.1, max: 500, step: 0.01, def: 10, show: (P, m) => m === 'surge' && P.sBy === 'D' },
        { k: 'Qm', label: 'Full turbine flow Q', dim: 'Q', min: 0.001, max: 10000, step: 0.001, def: 20, log: true, modes: ['surge'] },
        { k: 'event', type: 'select', label: 'Event', def: 'reject', options: [['reject', 'Load rejection (flow cut to zero)'], ['accept', 'Load acceptance (flow from zero to full)']], modes: ['surge'] },
        { k: 'Tc', label: 'Time for the turbine flow change', dim: 's', min: 0, max: 1000, step: 0.1, def: 4, modes: ['surge'] },
        { k: 'tankTop', label: 'Top of the tank (0 = skip the check)', dim: 'len', min: 0, max: 5000, step: 0.01, def: 0, modes: ['surge'] },
        { k: 'tankBot', label: 'Bottom of the tank (0 = skip the check)', dim: 'len', min: 0, max: 5000, step: 0.01, def: 0, modes: ['surge'] },
        // routing
        { k: '_hr', type: 'head', label: 'Reservoir', modes: ['pool'] },
        { k: 'res', type: 'select', label: 'Storage and outflow', def: 'weir', options: [['weir', 'Vertical banks with a spillway (S = A y, O = C L y^1.5)'], ['table', 'Elevation – storage – outflow table']], modes: ['pool'] },
        { k: 'Ares', label: 'Reservoir area at the crest', dim: 'ac', min: 0.01, max: 1e6, step: 0.01, def: 100, log: true, show: (P, m) => m === 'pool' && P.res === 'weir' },
        { k: 'Cw', label: 'Spillway coefficient C (current units)', min: 0.5, max: 5, step: 0.001, def: 2.0, show: (P, m) => m === 'pool' && P.res === 'weir' },
        { k: 'Lw', label: 'Spillway length L', dim: 'len', min: 0.1, max: 1000, step: 0.01, def: 10, show: (P, m) => m === 'pool' && P.res === 'weir' },
        { k: 'y0', label: 'Starting head on the crest', dim: 'len', min: 0, max: 100, step: 0.001, def: 0, show: (P, m) => m === 'pool' && P.res === 'weir' },
        { k: 'nT', type: 'select', label: 'Rows in the table', def: '6', options: [['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['7', '7'], ['8', '8'], ['9', '9'], ['10', '10']], show: (P, m) => m === 'pool' && P.res === 'table' },
        ...tabP,
        { k: 'e0', label: 'Starting pool elevation', dim: 'len', min: -1000, max: 10000, step: 0.01, def: 102, show: (P, m) => m === 'pool' && P.res === 'table' },
        { k: '_hk', type: 'head', label: 'River reach', modes: ['musk'] },
        { k: 'Kh', label: 'Storage constant K (hours)', min: 0.01, max: 1000, step: 0.01, def: 12, modes: ['musk'] },
        { k: 'xm', label: 'Weighting factor x', min: 0, max: 0.5, step: 0.001, def: 0.2, modes: ['musk'] },
        { k: 'O1', label: 'Starting outflow', dim: 'Q', min: 0, max: 100000, step: 0.001, def: 10, modes: ['musk'] },
        { k: '_hi', type: 'head', label: 'Inflow hydrograph', modes: ['pool', 'musk'] },
        { k: 'dtr', label: 'Routing period Δt', dim: 'hr', min: 0.01, max: 240, step: 0.01, def: 6, modes: ['pool', 'musk'] },
        { k: 'nI', type: 'select', label: 'Number of inflow values', def: '12', options: Array.from({ length: 19 }, (_, i) => [String(i + 2), String(i + 2)]), modes: ['pool', 'musk'] },
        ...inP
      ],
      prep: (I, P) => { I.dtrH = P.dtr; },
      presets: [
        // establishment
        { name: '2500 SP 19.6 — 3000 m of 2.4 m pipe under 20 m, ΣK 16: time to 90 % (61.0 s)', mode: 'establish', set: { H: 20, Lp: 3000, Dp: 2400, fp: 0.03, Km: 16, outlet: 'free', frac: 0.9 } },
        { name: '2500 SP 19.16 — globe valve opened on 2400 ft of 3.5 ft pipe, 85 ft: time to 85 % (16.3 s)', mode: 'establish', units: 'EN', set: { H: 85, Lp: 2400, Dp: 42, fp: 0.019, Km: 12, outlet: 'free', frac: 0.85 } },
        { name: '2500 SP 19.15 — 1270 m pipe with a 0.4 m nozzle, 8 m: time to 95 % (49.7 s)', mode: 'establish', set: { H: 8, Lp: 1270, Dp: 700, fp: 0.024, Km: 3, outlet: 'nozzle', dn: 400, frac: 0.95 } },
        { name: '2500 SP 19.26 — two reservoirs, 15 m of 10 cm pipe, 2 m apart: time to ¼, ½, ¾ of Q₀', mode: 'establish', set: { H: 2, Lp: 15, Dp: 100, fp: 0.02, Km: 0.5, outlet: 'nozzle', dn: 100, frac: 0.25 } },
        // oscillations
        { name: '2500 SP 19.3 — 500 mm U-tube, f 0.03, swing of 6 m (next: −4.84 m, 4.05 m)', mode: 'mass', set: { mkind: 'utube', fr: 'turb', Lp: 1000, Dp: 500, fp: 0.03, Km: 0, init: 'z', z0: 6, V0: 0, tmax: 0 } },
        { name: '2500 SP 19.11 — frictionless U-tube, 0.9 m column, 0.1 m swing (0.467 m/s, 1.35 s)', mode: 'mass', set: { mkind: 'utube', fr: 'none', Lp: 0.9, Dp: 10, init: 'z', z0: 0.1, V0: 0, tmax: 0 } },
        { name: '2500 SP 19.12 — laminar U-tube, 8 mm, 1.8 m/s at mid-swing: next level crossing (0.735 s, 0.287 m/s)', mode: 'mass', set: { mkind: 'utube', fr: 'lam', Lp: 0.8, Dp: 8, nu: 10, init: 'z', z0: 0, V0: 1.8, tmax: 0 } },
        { name: '2500 SP 19.21 — laminar oil U-tube, 10 mm, 2 m, 250 mm swing (−0.109 m, 0.0475 m)', mode: 'mass', set: { mkind: 'utube', fr: 'lam', Lp: 2, Dp: 10, nu: 5, init: 'z', z0: 0.25, V0: 0, tmax: 0 } },
        { name: '2500 SP 19.5 — reservoirs 200 and 300 ft², 2000 ft of 3 ft pipe, z₁ = 40 ft (−3.63 ft, 2.15 ft)', mode: 'mass', units: 'EN', set: { mkind: 'tanks', mBy: 'A', A1s: 200, A2s: 300, fr: 'turb', Lp: 2000, Dp: 36, fp: 0.024, Km: 3.5, init: 'z', z0: 40, V0: 0, tmax: 0 } },
        { name: '2500 SP 19.14 — 5 m standpipes 9.6 m apart, 965 m of 2 m pipe (8.52 m; the book prints 7.87 m after a slip in F(φ))', mode: 'mass', set: { mkind: 'tanks', mBy: 'D', D1s: 5, D2s: 5, fr: 'turb', Lp: 965, Dp: 2000, fp: 0.02, Km: 4.2, init: 'dh', dh: 9.6, V0: 0, tmax: 0 } },
        // surge tank
        { name: '2500 SP 19.24 — surge tank 75 m², 10 km of 3 m tunnel, 0 → 20 m³/s in 4 s (Y_min 69.44 m at 212 s)', mode: 'surge', set: { Zr: 100, Lp: 10000, Dp: 3000, fp: 0.016, Km: 0, sBy: 'A', As: 75, Qm: 20, event: 'accept', Tc: 4, tmax: 900, tankTop: 0, tankBot: 0 } },
        { name: 'The same plant rejecting full load in 4 s', mode: 'surge', set: { Zr: 100, Lp: 10000, Dp: 3000, fp: 0.016, Km: 0, sBy: 'A', As: 75, Qm: 20, event: 'reject', Tc: 4, tmax: 900, tankTop: 0, tankBot: 0 } },
        // routing
        { name: '2500 SP 15.6 — 295 acre reservoir, 16 ft spillway, C 3.75 (book reads ≈ 590 cfs and 4.59 ft off a graph)', mode: 'pool', units: 'EN', set: { res: 'weir', Ares: 295, Cw: 3.75, Lw: 16, y0: 0, dtr: 12, nI: '10', in1: 36, in2: 43, in3: 121, in4: 348, in5: 575, in6: 719, in7: 741, in8: 615, in9: 440, in10: 328 } },
        { name: '2500 SP 15.7 — small reservoir from an elevation–storage–discharge table, start 875 ft (≈ 450 cfs, 886.6 ft)', mode: 'pool', units: 'EN', set: { res: 'table', nT: '9', te1: 862, ts1: 0, to1: 0, te2: 865, ts2: 41, to2: 0, te3: 870, ts3: 202, to3: 0, te4: 875, ts4: 502, to4: 0, te5: 880, ts5: 1003, to5: 0, te6: 882, ts6: 1220, to6: 101, te7: 884, ts7: 1633, to7: 232, te8: 886, ts8: 2270, to8: 395, te9: 888, ts9: 3152, to9: 600, e0: 875, dtr: 12, nI: '12', in1: 36, in2: 43, in3: 121, in4: 348, in5: 575, in6: 719, in7: 741, in8: 615, in9: 440, in10: 328, in11: 255, in12: 196 } },
        { name: '2500 SP 15.11 — Muskingum, K 26 h, x 0.22, Δt 12 h (peak 584 m³/s)', mode: 'musk', set: { Kh: 26, xm: 0.22, O1: 60, dtr: 12, nI: '13', in1: 58, in2: 46, in3: 42, in4: 64, in5: 149, in6: 329, in7: 536, in8: 678, in9: 681, in10: 560, in11: 439, in12: 341, in13: 272 } },
        { name: '2500 SP 15.9 — Muskingum coefficients for K 25.9 h, x 0.25, Δt 24 h (0.176, 0.588, 0.236)', mode: 'musk', set: { Kh: 25.9, xm: 0.25, O1: 60, dtr: 24, nI: '13', in1: 58, in2: 46, in3: 42, in4: 64, in5: 149, in6: 329, in7: 536, in8: 678, in9: 681, in10: 560, in11: 439, in12: 341, in13: 272 } }
      ],
      hint: 'Oscillations and surge tanks are integrated in time; the picture replays the motion. Routing: blue is the inflow hydrograph, purple the routed outflow.'
    };
    const loopT = (A, T, tEnd, rate) => { A.tt = ((A.tt || 0) + (T.pdt || 0) * rate) % Math.max(tEnd, 1e-9); return A.tt; };
    const at = (ts, vs, t) => { if (t <= ts[0]) return vs[0]; for (let i = 1; i < ts.length; i++) if (t <= ts[i]) { const f = (t - ts[i - 1]) / (ts[i] - ts[i - 1] || 1); return vs[i - 1] + f * (vs[i] - vs[i - 1]); } return vs[vs.length - 1]; };
    UF.draw = function (ctx, W, H, R, A, T) {
      const d = R.data, U = S.U, I = S.I, L = U.L; bg(ctx, W, H);
      const cp = W < 560;
      if (d.kind === 'establish') {
        const t = loopT(A, T, d.ts[d.ts.length - 1] * 1.1, d.ts[d.ts.length - 1] / 6), V = at(d.ts, d.vs, t);
        const x0 = 20, x1 = cp ? W * 0.3 : W * 0.22, yS = H * 0.2, yB = H * 0.72, yp = H * 0.62;
        ctx.fillStyle = C.water; ctx.globalAlpha = 0.35; ctx.fillRect(x0, yS, x1 - x0, yB - yS); ctx.globalAlpha = 1; stroke(ctx, [[x0, yS - 10], [x0, yB], [x1, yB], [x1, yp + 10]], C.wall, 2.5); stroke(ctx, [[x1, yp - 10], [x1, yS - 10]], C.wall, 2.5);
        stroke(ctx, [[x0, yS], [x1, yS]], C.water_deep, 1.5); surfSym(ctx, (x0 + x1) / 2, yS);
        const xv = W - 40; pipe3(ctx, x1, yp, xv, yp, 18); valveSym(ctx, xv - 20, yp, 9, false);
        flowDots(ctx, A, 'p', [[x1, yp], [xv, yp]], V, T.pdt, C.part);
        dimV(ctx, (x1 + xv) / 2, yS, yp, `H = ${fmt(I.H)} ${L}`);
        stroke(ctx, [[x1, yS], [xv, yS]], C.muted, 1, [4, 4]);
        txt(ctx, `t = ${fmt(t, 3)} s,  V = ${fmt(V, 3)} ${U.v}  (${fmt((100 * V) / d.V0, 3)} % of V₀)`, 14, 16, { mono: true, bold: true, size: 12 });
        dimH(ctx, x1, xv, yp + 30, `L = ${fmt(I.Lp)} ${L}`);
        return;
      }
      if (d.kind === 'mass') {
        const tEnd = d.ts[d.ts.length - 1], t = loopT(A, T, tEnd, tEnd / 12);
        const z1 = at(d.ts, d.z1s, t), z2 = at(d.ts, d.z2s, t), V = at(d.ts, d.vs, t);
        const zmax = Math.max(...d.z1s.map(Math.abs), ...d.z2s.map(Math.abs), 1e-9);
        const mid = H * 0.42, amp = H * 0.26 / zmax, bot = H * 0.86;
        const w1 = d.utube ? 34 : clamp(34 * Math.sqrt(d.A1 / d.A), 26, W * 0.22), w2 = d.utube ? 34 : clamp(34 * Math.sqrt(d.A2 / d.A), 26, W * 0.22);
        const xa = W * 0.22, xb = W * 0.78, tw = d.utube ? 34 : 16;
        // legs
        const leg = (x, w, z) => { const ys = mid - z * amp; ctx.fillStyle = C.water; ctx.globalAlpha = 0.4; ctx.fillRect(x - w / 2, ys, w, bot - ys); ctx.globalAlpha = 1; stroke(ctx, [[x - w / 2, H * 0.08], [x - w / 2, bot]], C.wall, 2.5); stroke(ctx, [[x + w / 2, H * 0.08], [x + w / 2, bot - (d.utube ? 0 : tw)]], C.wall, 2.5); stroke(ctx, [[x - w / 2, ys], [x + w / 2, ys]], C.water_deep, 2); return ys; };
        const y1 = leg(xa, w1, z1), y2 = leg(xb, w2, z2);
        ctx.fillStyle = C.water; ctx.globalAlpha = 0.4; ctx.fillRect(xa - w1 / 2, bot, xb - xa + (w1 + w2) / 2, tw); ctx.globalAlpha = 1;
        stroke(ctx, [[xa - w1 / 2, bot], [xa - w1 / 2, bot + tw], [xb + w2 / 2, bot + tw], [xb + w2 / 2, bot]], C.wall, 2.5);
        if (!d.utube) stroke(ctx, [[xa + w1 / 2, bot], [xb - w2 / 2, bot]], C.wall, 2.5); else stroke(ctx, [[xa + w1 / 2, bot], [xb - w2 / 2, bot]], C.wall, 2.5);
        flowDots(ctx, A, 'm', V >= 0 ? [[xa, bot + tw / 2], [xb, bot + tw / 2]] : [[xb, bot + tw / 2], [xa, bot + tw / 2]], Math.abs(V), T.pdt, C.part);
        stroke(ctx, [[xa - w1, mid], [xb + w2, mid]], C.muted, 1, [6, 4]); txt(ctx, 'final level', (xa + xb) / 2, mid - 8, { align: 'center', size: 10.5, color: C.muted });
        txt(ctx, `z₁ = ${fmt(z1, 3)}`, xa + w1 / 2 + 6, y1, { mono: true, size: 11, bg: C.bg });
        txt(ctx, `z₂ = ${fmt(z2, 3)}`, xb - w2 / 2 - 6, y2, { mono: true, size: 11, align: 'right', bg: C.bg });
        txt(ctx, `t = ${fmt(t, 3)} s,  V = ${fmt(V, 3)} ${U.v}`, 14, 16, { mono: true, bold: true, size: 12 });
        return;
      }
      if (d.kind === 'surge') {
        const tEnd = d.ts[d.ts.length - 1], t = loopT(A, T, tEnd, tEnd / 12), Y = at(d.ts, d.ys, t), Q = at(d.ts, d.qs, t), Qt = at(d.ts, d.qts, t);
        const lo = Math.min(d.ymin, d.Z) - 0.15 * (d.ymax - d.ymin + 1), hi = Math.max(d.ymax, d.Z) + 0.15 * (d.ymax - d.ymin + 1);
        const top = 40, bot = H * 0.62, Yp = (z) => bot - ((z - lo) / (hi - lo)) * (bot - top);
        const xr1 = W * 0.18, xt = W * 0.62, tw2 = cp ? 26 : 36, yT = H * 0.8;
        ctx.fillStyle = C.water; ctx.globalAlpha = 0.35; ctx.fillRect(10, Yp(d.Z), xr1 - 10, yT - Yp(d.Z) + 10); ctx.globalAlpha = 1; stroke(ctx, [[10, Yp(d.Z)], [xr1, Yp(d.Z)]], C.water_deep, 1.5); surfSym(ctx, (10 + xr1) / 2, Yp(d.Z));
        txt(ctx, `Z = ${fmt(d.Z)}`, (10 + xr1) / 2, cp ? Yp(d.Z) + 18 : Yp(d.Z) - 22, { align: 'center', mono: true, size: 11, bg: C.bg });
        pipe3(ctx, xr1, yT, xt - tw2 / 2, yT, 14); flowDots(ctx, A, 'tun', [[xr1, yT], [xt - tw2 / 2, yT]], Q, T.pdt, C.part);
        ctx.fillStyle = C.water; ctx.globalAlpha = 0.4; ctx.fillRect(xt - tw2 / 2, Yp(Y), tw2, yT - Yp(Y)); ctx.globalAlpha = 1;
        stroke(ctx, [[xt - tw2 / 2, top - 10], [xt - tw2 / 2, yT - 7]], C.wall, 2.5); stroke(ctx, [[xt + tw2 / 2, top - 10], [xt + tw2 / 2, yT - 7]], C.wall, 2.5); stroke(ctx, [[xt - tw2 / 2, Yp(Y)], [xt + tw2 / 2, Yp(Y)]], C.water_deep, 2);
        pipe3(ctx, xt + tw2 / 2, yT, W - 30, H * 0.93, 12); ctx.beginPath(); ctx.arc(W - 30, H * 0.93, 10, 0, 2 * PI); ctx.fillStyle = C.wall; ctx.fill(); txt(ctx, 'T', W - 30, H * 0.93, { align: 'center', bold: true, color: C.bg, size: 11 });
        stroke(ctx, [[xt - 50, Yp(d.ymax)], [xt + 60, Yp(d.ymax)]], C.danger, 1.2, [5, 4]); txt(ctx, `Y_max ${fmt(d.ymax)}`, xt + 64, Yp(d.ymax), { mono: true, size: 10.5, color: C.danger, bg: C.bg });
        stroke(ctx, [[xt - 50, Yp(d.ymin)], [xt + 60, Yp(d.ymin)]], C.hgl, 1.2, [5, 4]); txt(ctx, `Y_min ${fmt(d.ymin)}`, xt + 64, Yp(d.ymin), { mono: true, size: 10.5, color: C.hgl, bg: C.bg });
        if (cp) { txt(ctx, `t = ${fmt(t, 4)} s,  Y = ${fmt(Y, 4)} ${L}`, 14, 16, { mono: true, bold: true, size: 10.5 }); txt(ctx, `Q tunnel ${fmt(Q, 3)},  turbine ${fmt(Qt, 3)} ${U.Q}`, 14, 31, { mono: true, size: 10.5 }); } else txt(ctx, `t = ${fmt(t, 4)} s,  Y = ${fmt(Y, 4)} ${L},  Q tunnel = ${fmt(Q, 3)} ${U.Q},  Q turbine = ${fmt(Qt, 3)} ${U.Q}`, 14, 16, { mono: true, bold: true, size: 12 });
        return;
      }
      if (d.kind === 'route') {
        const ts = d.Is.map((_, i) => i * d.hr);
        plot(ctx, { x: 0, y: 0, w: W, h: H }, { title: d.pool ? 'Reservoir routing: inflow and outflow' : 'Muskingum routing: inflow and outflow', xs: ts, series: [{ ys: d.Is, color: C.water_deep, fill: true }, { ys: d.Os, color: C.hgl, w: 2.5 }], xmin: 0, ymin: 0, xlab: 't (h)', ylab: U.Q, legend: [{ label: 'inflow I', color: C.water_deep }, { label: 'outflow O', color: C.hgl }], pts: (() => { const i = d.Os.indexOf(Math.max(...d.Os)); return [{ x: ts[i], y: d.Os[i], color: C.danger, label: `peak ${fmt(d.Os[i])}` }]; })() });
      }
    };
    UF.drawAux = function (ctx, W, H, R) {
      const d = R.data, U = S.U, L = U.L; bg(ctx, W, H);
      if (d.kind === 'establish') { plot(ctx, { x: 0, y: 0, w: W, h: H }, { title: 'Velocity build-up after the valve opens', xs: d.ts, series: [{ ys: d.vs, color: C.water_deep, fill: true }], xmin: 0, ymin: 0, xlab: 't (s)', ylab: U.v, hmarks: [{ y: d.V0, label: 'V₀', color: C.ok }], pts: [{ x: d.t, y: d.p * d.V0, color: C.danger, label: `${fmt(d.t)} s` }] }); return; }
      if (d.kind === 'mass') { plot(ctx, { x: 0, y: 0, w: W, h: H }, { title: 'Surface levels vs time (from the final level)', xs: d.ts, series: [{ ys: d.z1s, color: C.water_deep }, { ys: d.z2s, color: C.hgl, dash: [5, 4] }], xmin: 0, xlab: 't (s)', ylab: L, legend: [{ label: 'surface 1', color: C.water_deep }, { label: 'surface 2', color: C.hgl, dash: [5, 4] }], pts: d.ext.slice(0, 6).map((e) => ({ x: e[0], y: e[1], color: C.danger, r: 3.5 })) }); return; }
      if (d.kind === 'surge') { plot(ctx, { x: 0, y: 0, w: W, h: H }, { title: `Tank level Y (${L}) vs time`, xs: d.ts, series: [{ ys: d.ys, color: C.water_deep }], xmin: 0, xlab: 't (s)', ylab: L, hmarks: [{ y: d.Z, label: 'reservoir', color: C.muted }], pts: [{ x: d.tmaxY, y: d.ymax, color: C.danger, label: fmt(d.ymax) }, { x: d.tminY, y: d.ymin, color: C.hgl, label: fmt(d.ymin) }] }); return; }
      if (d.kind === 'route' && d.pool) { const ts = d.Es.map((_, i) => i * d.hr); plot(ctx, { x: 0, y: 0, w: W, h: H }, { title: `Pool level (${L}) vs time`, xs: ts, series: [{ ys: d.Es, color: C.water_deep, fill: true }], xmin: 0, ymin: Math.min(...d.Es) - 0.05 * (Math.max(...d.Es) - Math.min(...d.Es) + 1), ymax: Math.max(...d.Es) + 0.12 * (Math.max(...d.Es) - Math.min(...d.Es) + 1e-3), xlab: 't (h)', ylab: L }); return; }
      if (d.kind === 'route') { const ts = d.Is.map((_, i) => i * d.hr), st = []; let s = 0; for (let i = 0; i < ts.length; i++) { if (i) s += 0.5 * (d.Is[i] + d.Is[i - 1] - d.Os[i] - d.Os[i - 1]) * d.hr * 3600; st.push(s); } const big = Math.max(...st.map(Math.abs)) >= 1e5, sf = big ? 1e-6 : 1, vu = big ? `million ${U.Vol}` : U.Vol; plot(ctx, { x: 0, y: 0, w: W, h: H }, { title: `Water stored in the reach (${vu}), from the start`, xs: ts, series: [{ ys: st.map((v) => v * sf), color: C.water_deep, fill: true }], xmin: 0, xlab: 't (h)', ylab: big ? '×10⁶' : U.Vol }); }
    };
    insertAfter('hammer', UF);
  });
})(window);
