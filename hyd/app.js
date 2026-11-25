/* app.js — UI, diagrams and animation for the hydraulics simulator.
   All engineering formulas are in physics.js (global HP). */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const fmt = HP.fmt;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const PI = Math.PI;

  /* ------------------------------------------------------------------
     Unit dimensions. Inputs are stored in SI display units; [unit, factor]
     SI: factor converts SI display → SI base. EN: [unit, SI display → EN display, EN display → EN base]
     ------------------------------------------------------------------ */
  const DIMS = {
    none: { si: ['', 1], en: ['', 1, 1] }, hv: { si: ['H:V', 1], en: ['H:V', 1, 1] },
    len: { si: ['m', 1], en: ['ft', 3.28084, 1] }, mm: { si: ['mm', 0.001], en: ['in', 0.0393701, 1 / 12] },
    area: { si: ['m²', 1], en: ['ft²', 10.7639, 1] }, Q: { si: ['m³/s', 1], en: ['ft³/s', 35.3147, 1] },
    q: { si: ['m²/s', 1], en: ['ft²/s', 10.7639, 1] }, kPa: { si: ['kPa', 1], en: ['psi', 0.145038, 144] },
    vel: { si: ['m/s', 1], en: ['ft/s', 3.28084, 1] }, GPa: { si: ['GPa', 1e9], en: ['ksi', 145.038, 144000] },
    MPa: { si: ['MPa', 1e6], en: ['ksi', 0.145038, 144000] }, rho: { si: ['kg/m³', 1], en: ['slug/ft³', 0.00194032, 1] },
    nu: { si: ['mm²/s', 1e-6], en: ['×10⁻⁵ ft²/s', 1.07639, 1e-5] }, s: { si: ['s', 1], en: ['s', 1, 1] }, deg: { si: ['°', 1], en: ['°', 1, 1] },
    pow: { si: ['kW', 1], en: ['hp', 1 / 0.7457, 550] }, kN: { si: ['kN', 1], en: ['lb', 224.809, 1] }, rpm: { si: ['rpm', 1], en: ['rpm', 1, 1] },
    hr: { si: ['h', 3600], en: ['h', 1, 3600] }, vol: { si: ['m³', 1], en: ['acre-ft', 1 / 1233.48, 43560] }, ac: { si: ['ha', 1e4], en: ['acre', 2.47105, 43560] }
  };
  const S = { mi: 0, units: 'SI', view: '3d', egl: true, playing: true, speed: 1, simT: 0, P: {}, mode: {}, click: null, R: null, I: null, U: HP.units('SI'), A: {} };
  const dimOf = (p) => DIMS[p.dim || 'none'];
  const unitOf = (p) => (S.units === 'SI' ? dimOf(p).si[0] : dimOf(p).en[0]);
  const toDisp = (p, v) => (S.units === 'SI' ? v : v * dimOf(p).en[1]);
  const fromDisp = (p, v) => (S.units === 'SI' ? v : v / dimOf(p).en[1]);
  const toBase = (p, v) => { const d = dimOf(p); return S.units === 'SI' ? v * d.si[1] : v * d.en[1] * d.en[2]; };
  function niceStep(x) { const e = Math.pow(10, Math.floor(Math.log10(x))); const m = x / e; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * e; }
  function decimals(step) { return Math.max(0, Math.min(8, -Math.floor(Math.log10(step) + 1e-9))); }

  /* ------------------------------------------------------------------ colors */
  let C = {};
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    ['bg', 'grid', 'ink', 'muted', 'water', 'water-deep', 'part', 'foam', 'egl', 'hgl', 'danger', 'ok', 'soil', 'wall', 'air', 'pipe'].forEach((k) => (C[k.replace('-', '_')] = cs.getPropertyValue('--c-' + k).trim()));
  }

  /* ------------------------------------------------------------------ drawing helpers */
  const FONT = '"IBM Plex Sans", system-ui, sans-serif';
  const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
  function txt(ctx, s, x, y, o) {
    o = o || {};
    ctx.font = (o.bold ? '600 ' : '') + (o.size || 12) + 'px ' + (o.mono ? MONO : FONT);
    ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'middle';
    if (o.bg) { const w = ctx.measureText(s).width, h = (o.size || 12) + 4; let x0 = x - (ctx.textAlign === 'center' ? w / 2 : ctx.textAlign === 'right' ? w : 0); ctx.fillStyle = o.bg; ctx.globalAlpha = 0.85; ctx.fillRect(x0 - 3, y - h / 2, w + 6, h); ctx.globalAlpha = 1; }
    ctx.fillStyle = o.color || C.ink; ctx.fillText(s, x, y);
  }
  function poly(ctx, pts, close) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); if (close) ctx.closePath(); }
  function stroke(ctx, pts, color, w, dash) { poly(ctx, pts); ctx.strokeStyle = color; ctx.lineWidth = w || 1; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]); }
  function head(ctx, x1, y1, x2, y2, sz, color) { const a = Math.atan2(y2 - y1, x2 - x1); ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - sz * Math.cos(a - 0.4), y2 - sz * Math.sin(a - 0.4)); ctx.lineTo(x2 - sz * Math.cos(a + 0.4), y2 - sz * Math.sin(a + 0.4)); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); }
  function arrow(ctx, x1, y1, x2, y2, color, w, sz) { stroke(ctx, [[x1, y1], [x2, y2]], color, w || 1.5); head(ctx, x1, y1, x2, y2, sz || 7, color); }
  function dimV(ctx, x, ya, yb, label, color, side) {
    color = color || C.muted; if (Math.abs(yb - ya) < 2) return;
    stroke(ctx, [[x, ya], [x, yb]], color, 1); head(ctx, x, (ya + yb) / 2, x, ya, 6, color); head(ctx, x, (ya + yb) / 2, x, yb, 6, color);
    stroke(ctx, [[x - 5, ya], [x + 5, ya]], color, 1); stroke(ctx, [[x - 5, yb], [x + 5, yb]], color, 1);
    txt(ctx, label, x + (side === 'left' ? -6 : 6), (ya + yb) / 2, { align: side === 'left' ? 'right' : 'left', mono: true, size: 11, color: C.ink, bg: C.bg });
  }
  function dimH(ctx, xa, xb, y, label, color) {
    color = color || C.muted; if (Math.abs(xb - xa) < 2) return;
    stroke(ctx, [[xa, y], [xb, y]], color, 1); head(ctx, (xa + xb) / 2, y, xa, y, 6, color); head(ctx, (xa + xb) / 2, y, xb, y, 6, color);
    stroke(ctx, [[xa, y - 5], [xa, y + 5]], color, 1); stroke(ctx, [[xb, y - 5], [xb, y + 5]], color, 1);
    txt(ctx, label, (xa + xb) / 2, y - 9, { align: 'center', mono: true, size: 11, color: C.ink, bg: C.bg });
  }
  function surfSym(ctx, x, y, color) {
    color = color || C.water_deep;
    ctx.beginPath(); ctx.moveTo(x - 6, y - 11); ctx.lineTo(x + 6, y - 11); ctx.lineTo(x, y - 2); ctx.closePath(); ctx.strokeStyle = color; ctx.lineWidth = 1.3; ctx.stroke();
    stroke(ctx, [[x - 7, y + 3], [x + 7, y + 3]], color, 1); stroke(ctx, [[x - 4, y + 6], [x + 4, y + 6]], color, 1);
  }
  function ground(ctx, x1, x2, y, h) {
    ctx.fillStyle = C.soil; ctx.globalAlpha = 0.45; ctx.fillRect(x1, y, x2 - x1, h || 10); ctx.globalAlpha = 1;
    stroke(ctx, [[x1, y], [x2, y]], C.wall, 1.5);
    ctx.strokeStyle = C.wall; ctx.lineWidth = 0.7; ctx.beginPath();
    for (let x = x1 + 4; x < x2; x += 10) { ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 7); } ctx.stroke();
  }
  function datum(ctx, x1, x2, y, label) { stroke(ctx, [[x1, y], [x2, y]], C.muted, 1, [8, 4, 2, 4]); txt(ctx, label || 'Datum', x1 + 4, y - 8, { size: 11, color: C.muted }); }
  function velScale(ctx, x, y, pxPerUnit, unit) {
    if (!(pxPerUnit > 0) || !isFinite(pxPerUnit)) return;
    let v = niceStep(70 / pxPerUnit); let L = v * pxPerUnit; if (L > 130) { v /= 2; L /= 2; }
    ctx.fillStyle = C.bg; ctx.globalAlpha = 0.85; ctx.fillRect(x - 6, y - 24, 190, 34); ctx.globalAlpha = 1;
    arrow(ctx, x, y, x + L, y, C.ink, 2, 6);
    txt(ctx, `${fmt(v)} ${unit}`, x + L + 6, y, { mono: true, size: 11 });
    txt(ctx, 'velocity scale (travel in 1 s at 1×)', x, y - 14, { size: 10.5, color: C.muted });
  }
  function niceTicks(a, b, n) {
    if (!(b > a)) b = a + 1; const st = niceStep((b - a) / (n || 5)); const out = [];
    for (let v = Math.ceil(a / st - 1e-9) * st; v <= b + st * 1e-6; v += st) out.push(Math.abs(v) < st * 1e-9 ? 0 : v);
    return out;
  }
  // 2D plot with axes, grid, series, cursor and markers
  function plot(ctx, r, o) {
    const m = { l: 52, r: 12, t: 22, b: 32 };
    const x0 = r.x + m.l, x1 = r.x + r.w - m.r, y0 = r.y + r.h - m.b, y1 = r.y + m.t;
    let xmin = o.xmin, xmax = o.xmax, ymin = o.ymin, ymax = o.ymax;
    const allY = []; o.series.forEach((s) => s.ys.forEach((v) => isFinite(v) && allY.push(v)));
    if (ymin === undefined) ymin = Math.min(0, ...allY); if (ymax === undefined) ymax = Math.max(...allY, ymin + 1e-9) * 1.08;
    if (!(ymax > ymin)) ymax = ymin + 1;
    if (xmin === undefined) xmin = o.xs[0]; if (xmax === undefined) xmax = o.xs[o.xs.length - 1]; if (!(xmax > xmin)) xmax = xmin + 1;
    const X = (x) => x0 + ((x - xmin) / (xmax - xmin)) * (x1 - x0), Y = (y) => y0 - ((y - ymin) / (ymax - ymin)) * (y0 - y1);
    ctx.save();
    niceTicks(ymin, ymax, 4).forEach((v) => { stroke(ctx, [[x0, Y(v)], [x1, Y(v)]], C.grid, 1); txt(ctx, fmt(v, 3), x0 - 5, Y(v), { align: 'right', mono: true, size: 10, color: C.muted }); });
    niceTicks(xmin, xmax, Math.max(2, Math.floor((x1 - x0) / 70))).forEach((v) => { stroke(ctx, [[X(v), y0], [X(v), y0 + 4]], C.muted, 1); txt(ctx, fmt(v, 3), X(v), y0 + 13, { align: 'center', mono: true, size: 10, color: C.muted }); });
    stroke(ctx, [[x0, y1], [x0, y0], [x1, y0]], C.muted, 1);
    txt(ctx, o.title || '', x0, r.y + 9, { bold: true, size: 12 });
    txt(ctx, o.xlab || '', x1, y0 + 26, { align: 'right', size: 11, color: C.muted, base: 'bottom' });
    (o.vmarks || []).forEach((mk) => { if (mk.x < xmin || mk.x > xmax) return; stroke(ctx, [[X(mk.x), y0], [X(mk.x), y1]], mk.color || C.muted, 1, [4, 4]); txt(ctx, mk.label, X(mk.x) + 3, y1 + 6, { size: 10, color: mk.color || C.muted }); });
    (o.hmarks || []).forEach((mk) => { stroke(ctx, [[x0, Y(mk.y)], [x1, Y(mk.y)]], mk.color || C.muted, 1, [4, 4]); txt(ctx, mk.label, x1 - 3, Y(mk.y) - 7, { size: 10, align: 'right', color: mk.color || C.muted }); });
    ctx.beginPath(); ctx.rect(x0, y1 - 2, x1 - x0, y0 - y1 + 4); ctx.clip();
    o.series.forEach((s) => {
      const xs = s.xs || o.xs; const pts = []; for (let i = 0; i < xs.length; i++) if (isFinite(s.ys[i])) pts.push([X(xs[i]), Y(s.ys[i])]);
      if (s.fill) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.lineTo(pts[pts.length - 1][0], Y(Math.max(ymin, 0))); ctx.lineTo(pts[0][0], Y(Math.max(ymin, 0))); ctx.closePath(); ctx.fillStyle = s.color; ctx.globalAlpha = 0.12; ctx.fill(); ctx.globalAlpha = 1; }
      stroke(ctx, pts, s.color, s.w || 2, s.dash);
    });
    if (o.cursor !== undefined && isFinite(o.cursor)) { const cx = X(clamp(o.cursor, xmin, xmax)); stroke(ctx, [[cx, y0], [cx, y1]], C.egl, 1.5); }
    ctx.restore();
    (o.pts || []).forEach((p) => { if (!isFinite(p.x) || !isFinite(p.y)) return; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), p.r || 5, 0, 2 * PI); ctx.fillStyle = p.color; ctx.fill(); ctx.strokeStyle = C.bg; ctx.lineWidth = 1.5; ctx.stroke(); if (p.label) txt(ctx, p.label, X(p.x) + 8, Y(p.y) - 8, { size: 11, mono: true, bg: C.bg }); });
    (o.legend || []).forEach((l, i) => { const lx = x1 - 150, ly = y1 + 10 + i * 15; stroke(ctx, [[lx, ly], [lx + 18, ly]], l.color, 2, l.dash); txt(ctx, l.label, lx + 24, ly, { size: 11 }); });
    txt(ctx, o.ylab || '', r.x + 4, r.y + 9, { size: 11, color: C.muted, align: 'left' });
    if (o.title) txt(ctx, o.ylab || '', r.x + 4, r.y + 9, { size: 11, color: C.muted });
    return { X, Y, x0, x1, y0, y1, xmin, xmax, ymin, ymax };
  }
  // world → screen view with optional independent scales
  function view(b, W, H, pad, uniform) {
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    let sx = pw / (b.x1 - b.x0), sy = ph / (b.y1 - b.y0);
    if (uniform) { const s = Math.min(sx, sy); sx = sy = s; }
    const ox = pad.l + (pw - sx * (b.x1 - b.x0)) / 2, oy = pad.t + (ph - sy * (b.y1 - b.y0)) / 2;
    return { sx, sy, X: (x) => ox + (x - b.x0) * sx, Y: (y) => oy + (b.y1 - y) * sy, ix: (X) => b.x0 + (X - ox) / sx, iy: (Y) => b.y1 - (Y - oy) / sy };
  }
  // exponential smoothing so the picture glides when sliders move
  function sm(A, key, target, dt, rate) {
    if (!isFinite(target)) return target;
    if (A[key] === undefined || !isFinite(A[key]) || dt <= 0 && A[key] === undefined) A[key] = target;
    else A[key] += (target - A[key]) * (1 - Math.exp(-(dt || 0) * (rate || 7)));
    return A[key];
  }
  function smB(A, key, b, dt) { return { x0: sm(A, key + 'x0', b.x0, dt), x1: sm(A, key + 'x1', b.x1, dt), y0: sm(A, key + 'y0', b.y0, dt), y1: sm(A, key + 'y1', b.y1, dt) }; }
  const rnd = Math.random;

  /* ==================================================================
     MODULE DEFINITIONS
     ================================================================== */
  const SG_CHIPS = [['Water', 1], ['Seawater', 1.03], ['Oil', 0.8], ['Mercury', 13.6]];
  const LSG_CHIPS = [['Water', 1], ['Oil', 0.8], ['Kerosene', 0.82], ['Gasoline', 0.68], ['Glycerin', 1.26]];
  const nLayOf = (P, m) => (m === 'steady' || m === 'drain' ? +P.nLay || 1 : 1);
  // liquid layers: colour by layer number (layer 1 = bottom, at the orifice)
  const layCol = (j) => (j === 0 ? C.water : ['#e0a526', '#3fae7a', '#9b6bd1'][(j - 1) % 3]);
  // world-height bands [z0, z1] of each layer when the surface is at h above the orifice (zb = tank bottom)
  function layerBands(d, h, zb) {
    if (!d.layers) return null;
    let tops;
    if (d.layZ) tops = d.layZ(Math.max(0, h));
    else { let z = 0; tops = d.layers.map((l) => (z += l.t)); tops[tops.length - 1] = h; }
    return d.layers.map((l, j) => ({ j, sg: l.sg, z0: j === 0 ? zb : Math.max(0, tops[j - 1]), z1: j === 0 ? Math.max(zb, tops[0]) : Math.max(0, tops[j]) })).filter((b) => b.z1 - b.z0 > 1e-9);
  }
  function layerLegend(ctx, d, h, xr, y) {
    const b = layerBands(d, h, 0) || [], k = d.layerAt ? d.layerAt(Math.max(0, h)) : 0, L = S.U.L;
    const rows = d.layers.map((l, j) => { const bb = b.find((q) => q.j === j); return { j, txt: `Layer ${j + 1}: Sg ${fmt(l.sg)}, t = ${fmt(bb ? bb.z1 - bb.z0 : 0)} ${L}${j === k && h > 1e-6 ? ' (outflow)' : ''}` }; }).reverse();
    ctx.font = '11px ' + MONO; const w = Math.max(...rows.map((r) => ctx.measureText(r.txt).width)) + 34, x = xr - w; // right-aligned under the velocity scale
    ctx.fillStyle = C.bg; ctx.globalAlpha = 0.85; ctx.fillRect(x - 6, y - 10, w, rows.length * 17 + 6); ctx.globalAlpha = 1;
    rows.forEach((r, i) => { const yy = y + i * 17; ctx.fillStyle = layCol(r.j); ctx.globalAlpha = 0.6; ctx.fillRect(x, yy - 6, 16, 12); ctx.globalAlpha = 1; ctx.strokeStyle = layCol(r.j); ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, yy - 5.5, 15, 11); txt(ctx, r.txt, x + 22, yy, { size: 11, mono: true, color: C.ink }); });
  }
  const MODS = [];

  /* ---------------------------------------------------------------- M1 */
  const M1 = {
    id: 'orifice', tab: 'Orifices & Tanks', title: 'Orifices, Tubes and Tank Draining', fn: 'orifice',
    modes: [['steady', 'Steady flow (constant head)'], ['drain', 'Tank draining through an orifice'], ['twotank', 'Two connected tanks'], ['inflow', 'Draining with inflow Q_in']],
    speed: { steady: 1, drain: 20, twotank: 20, inflow: 20 },
    modeDefaults: { inflow: { Qin: 0.004 }, twotank: { shape: 'vcyl' } },
    stopAtEnd: true,
    params: [
      { k: 'H', label: 'Head on the orifice H', labelFn: (P, m) => (nLayOf(P, m) > 1 ? (m === 'steady' ? 'Total liquid depth above the orifice H' : 'Initial total depth H₁') : m === 'steady' ? 'Head on the orifice H' : m === 'twotank' ? 'Initial head difference H₁' : 'Initial head H₁'), dim: 'len', min: 0.05, max: 20, step: 0.01, def: 4 },
      { k: 'H2', label: 'Final head H₂', labelFn: (P, m) => (m === 'twotank' ? 'Final head difference H₂' : 'Final head H₂'), dim: 'len', min: 0, max: 20, step: 0.01, def: 1, modes: ['drain', 'twotank', 'inflow'], maxFn: (P, m) => (m === 'inflow' ? 20 : P.H) },
      { k: 'tq', label: 'Solve for head after time t', dim: 's', min: 0, max: 100000, step: 1, def: 600, modes: ['drain', 'twotank', 'inflow'] },
      { k: 'd', label: 'Orifice diameter d', dim: 'mm', min: 5, max: 500, step: 1, def: 50 },
      { k: 'mouth', type: 'select', label: 'Mouthpiece preset', def: 'custom', options: [['custom', 'Custom coefficients'], ['sharp', 'Sharp-edged orifice (Cd 0.61)'], ['short', 'Standard short tube (Cd 0.82)'], ['borda', 'Borda re-entrant tube (Cd 0.52)'], ['nozzle', 'Well-rounded nozzle (Cd 0.98)']],
        onSet: (P) => { const m = { sharp: [0.61, 0.98], short: [0.82, 0.82], borda: [0.52, 0.98], nozzle: [0.98, 0.98] }[P.mouth]; if (m) { P.Cd = m[0]; P.Cv = m[1]; P.Cc = +(m[0] / m[1]).toFixed(4); } } },
      { k: 'Cd', label: 'Coefficient of discharge Cd', min: 0.5, max: 1, step: 0.001, def: 0.6, onSet: (P) => { P.Cc = clamp(+(P.Cd / P.Cv).toFixed(4), 0.5, 1); P.mouth = 'custom'; } },
      { k: 'Cv', label: 'Coefficient of velocity Cv', min: 0.8, max: 1, step: 0.001, def: 0.98, onSet: (P) => { P.Cc = clamp(+(P.Cd / P.Cv).toFixed(4), 0.5, 1); P.mouth = 'custom'; } },
      { k: 'Cc', label: 'Coefficient of contraction Cc', min: 0.5, max: 1, step: 0.001, def: 0.612, onSet: (P) => { P.Cd = clamp(+(P.Cc * P.Cv).toFixed(4), 0.5, 1); P.mouth = 'custom'; } },
      { k: 'ps', label: 'Gauge pressure on the surface p_s', dim: 'kPa', min: -80, max: 500, step: 0.1, def: 0, modes: ['steady', 'drain', 'inflow'] },
      { k: 'Sg', label: 'Liquid specific gravity Sg', labelFn: (P, m) => (nLayOf(P, m) > 1 ? 'Layer 1 (bottom) specific gravity Sg₁' : 'Liquid specific gravity Sg'), min: 0.5, max: 13.6, step: 0.01, def: 1, chips: SG_CHIPS },
      { k: 'nLay', type: 'select', label: 'Liquid layers in the tank', def: '1', options: [['1', 'One liquid'], ['2', '2 layers'], ['3', '3 layers'], ['4', '4 layers']], modes: ['steady', 'drain'] },
      { k: 't2', label: 'Layer 2 thickness t₂', dim: 'len', min: 0.01, max: 20, step: 0.01, def: 1, show: (P, m) => nLayOf(P, m) >= 2 },
      { k: 'sg2', label: 'Layer 2 specific gravity Sg₂', min: 0.5, max: 13.6, step: 0.01, def: 0.8, chips: LSG_CHIPS, show: (P, m) => nLayOf(P, m) >= 2 },
      { k: 't3', label: 'Layer 3 thickness t₃', dim: 'len', min: 0.01, max: 20, step: 0.01, def: 0.5, show: (P, m) => nLayOf(P, m) >= 3 },
      { k: 'sg3', label: 'Layer 3 specific gravity Sg₃', min: 0.5, max: 13.6, step: 0.01, def: 0.68, chips: LSG_CHIPS, show: (P, m) => nLayOf(P, m) >= 3 },
      { k: 't4', label: 'Layer 4 thickness t₄ (top)', dim: 'len', min: 0.01, max: 20, step: 0.01, def: 0.3, show: (P, m) => nLayOf(P, m) >= 4 },
      { k: 'sg4', label: 'Layer 4 specific gravity Sg₄', min: 0.5, max: 13.6, step: 0.01, def: 0.6, chips: LSG_CHIPS, show: (P, m) => nLayOf(P, m) >= 4 },
      { k: 'y', label: 'Orifice height above ground y', dim: 'len', min: 0, max: 20, step: 0.01, def: 1.5, modes: ['steady', 'drain', 'inflow'] },
      { k: 'jby', type: 'select', label: 'Jet direction given by', def: 'ang', modes: ['steady', 'drain', 'inflow'], options: [['ang', 'Angle θ'], ['slope', 'Slope of the tank wall (jet normal to it)']], show: (P, m) => m === 'steady' || P.shape === 'vcyl' || P.shape === 'rect' },
      { k: 'jang', label: 'Jet angle θ above the horizontal (− = pointing down)', dim: 'deg', min: -89, max: 89, step: 0.1, def: 0, modes: ['steady', 'drain', 'inflow'], show: (P, m) => (m === 'steady' || P.shape === 'vcyl' || P.shape === 'rect') && P.jby !== 'slope' },
      { k: 'zw', label: 'Wall slope z (z H : 1 V)', min: 0, max: 20, step: 0.01, def: 1, modes: ['steady', 'drain', 'inflow'], show: (P, m) => (m === 'steady' || P.shape === 'vcyl' || P.shape === 'rect') && P.jby === 'slope' },
      { k: 'jdir', type: 'select', label: 'Jet points', def: 'up', modes: ['steady', 'drain', 'inflow'], options: [['up', 'Upward (wall leans back)'], ['down', 'Downward (wall overhangs)']], show: (P, m) => (m === 'steady' || P.shape === 'vcyl' || P.shape === 'rect') && P.jby === 'slope' },
      { k: 'jfind', type: 'select', label: 'Jet question', def: 'land', modes: ['steady'], options: [['land', 'Where the jet lands'], ['pt', 'Height of the jet at a distance x_p'], ['cv', 'Coefficients from a measured point on the jet'], ['H', 'Head needed for the jet to pass a point']] },
      { k: 'xq', label: 'Horizontal distance x_p', dim: 'len', min: 0, max: 100, step: 0.001, def: 2, modes: ['steady'], show: (P) => P.jfind === 'pt' },
      { k: 'xm', label: 'Measured point: horizontal distance x', dim: 'len', min: 0.001, max: 100, step: 0.001, def: 1.52, modes: ['steady'], show: (P) => P.jfind === 'cv' || P.jfind === 'H' },
      { k: 'ym', label: 'Measured point: drop y below the orifice centre', dim: 'len', min: -50, max: 100, step: 0.001, def: 0.119, modes: ['steady'], show: (P) => P.jfind === 'cv' || P.jfind === 'H' },
      { k: 'Qm', label: 'Measured discharge Q (0 = not measured)', dim: 'Q', min: 0, max: 10, step: 0.00001, def: 0, modes: ['steady'], show: (P) => P.jfind === 'cv' },
      { k: 'shape', type: 'select', label: 'Tank shape', def: 'vcyl', modes: ['drain', 'twotank', 'inflow'], options: [['vcyl', 'Vertical cylinder'], ['rect', 'Rectangular'], ['cone', 'Cone (apex down)'], ['sphere', 'Sphere'], ['hcyl', 'Horizontal cylinder'], ['frustum', 'Frustum']] },
      { k: 'D', label: 'Tank diameter D', dim: 'len', min: 0.1, max: 20, step: 0.01, def: 2, show: (P, m) => m !== 'steady' && P.shape === 'vcyl' },
      { k: 'Lt', label: 'Tank length L', dim: 'len', min: 0.1, max: 20, step: 0.01, def: 2, show: (P, m) => m !== 'steady' && P.shape === 'rect' },
      { k: 'Bt', label: 'Tank width B', dim: 'len', min: 0.1, max: 20, step: 0.01, def: 1.5, show: (P, m) => m !== 'steady' && P.shape === 'rect' },
      { k: 'Dc', label: 'Cone top diameter', dim: 'len', min: 0.1, max: 20, step: 0.01, def: 3, show: (P, m) => m !== 'steady' && m !== 'twotank' && P.shape === 'cone' },
      { k: 'Hc', label: 'Cone height H_c', dim: 'len', min: 0.1, max: 20, step: 0.01, def: 5, show: (P, m) => m !== 'steady' && m !== 'twotank' && P.shape === 'cone' },
      { k: 'Ds', label: 'Sphere diameter', dim: 'len', min: 0.1, max: 20, step: 0.01, def: 5, show: (P, m) => m !== 'steady' && m !== 'twotank' && P.shape === 'sphere' },
      { k: 'Dh', label: 'Horizontal cylinder diameter', dim: 'len', min: 0.1, max: 20, step: 0.01, def: 5, show: (P, m) => m !== 'steady' && m !== 'twotank' && P.shape === 'hcyl' },
      { k: 'Lh', label: 'Horizontal cylinder length', dim: 'len', min: 0.1, max: 20, step: 0.01, def: 6, show: (P, m) => m !== 'steady' && m !== 'twotank' && P.shape === 'hcyl' },
      { k: 'Db', label: 'Frustum bottom diameter', dim: 'len', min: 0.1, max: 20, step: 0.01, def: 1, show: (P, m) => m !== 'steady' && m !== 'twotank' && P.shape === 'frustum' },
      { k: 'Dt', label: 'Frustum top diameter', dim: 'len', min: 0.1, max: 20, step: 0.01, def: 3, show: (P, m) => m !== 'steady' && m !== 'twotank' && P.shape === 'frustum' },
      { k: 'Hf', label: 'Frustum height', dim: 'len', min: 0.1, max: 20, step: 0.01, def: 5, show: (P, m) => m !== 'steady' && m !== 'twotank' && P.shape === 'frustum' },
      { k: 'Qin', label: 'Inflow Q_in', dim: 'Q', min: 0, max: 1, step: 0.0001, def: 0, modes: ['inflow'] },
      { k: 'A2', label: 'Second tank area A₂', dim: 'area', min: 0.1, max: 100, step: 0.01, def: 2, modes: ['twotank'] }
    ],
    presets: [
      { name: 'Test 1 — steady orifice, H = 4 m, d = 50 mm, Cd = 0.60', mode: 'steady', set: { H: 4, d: 50, Cd: 0.6, Cv: 0.98, Cc: 0.612 } },
      { name: 'Test 2 — jet trajectory, Cv = 0.98, y = 1.5 m', mode: 'steady', set: { H: 4, d: 50, Cd: 0.6, Cv: 0.98, Cc: 0.612, y: 1.5 } },
      { name: 'Test 3 — cylinder D = 2 m drains 4 m → 1 m', mode: 'drain', set: { H: 4, H2: 1, d: 50, Cd: 0.6, shape: 'vcyl', D: 2 } },
      { name: 'Cone tank (apex down) drains 4 m → 0', mode: 'drain', set: { H: 4, H2: 0, d: 50, shape: 'cone', Dc: 3, Hc: 5 } },
      { name: 'Spherical tank drains 4 m → 0.5 m', mode: 'drain', set: { H: 4, H2: 0.5, d: 75, shape: 'sphere', Ds: 5 } },
      { name: 'Two tanks, A₁ = π m², A₂ = 2 m²', mode: 'twotank', set: { H: 4, H2: 0.5, shape: 'vcyl', D: 2, A2: 2 } },
      { name: 'Inflow 4 L/s while draining', mode: 'inflow', set: { H: 4, H2: 1, Qin: 0.004 } },
      { name: 'Closed tank, 50 kPa on the surface', mode: 'steady', set: { H: 2, ps: 50 } },
      { name: 'Steady orifice under 1 m of oil (Sg 0.8) on 3 m of water', mode: 'steady', set: { H: 4, d: 50, Cd: 0.6, Cv: 0.98, Cc: 0.612, nLay: '2', t2: 1, sg2: 0.8 } },
      { name: 'Oil over water: cylinder D = 2 m drains 4 m → 0', mode: 'drain', set: { H: 4, H2: 0, d: 50, Cd: 0.6, shape: 'vcyl', D: 2, nLay: '2', t2: 1, sg2: 0.8 } },
      { name: 'Three liquids in a spherical tank, 4 m → 0.5 m', mode: 'drain', set: { H: 4, H2: 0.5, d: 75, shape: 'sphere', Ds: 5, nLay: '3', t2: 1, sg2: 0.8, t3: 0.5, sg3: 0.68 } },
      { name: 'Schaum 12.11 — oil, 25 mm orifice, H 5.49 m, Q 3.14 L/s, jet drops 0.119 m in 1.52 m (Cv 0.940, Cd 0.616, Cc 0.655)', mode: 'steady', set: { H: 5.49, d: 25, Sg: 0.8, ps: 0, y: 1.5, jang: 0, jfind: 'cv', xm: 1.52, ym: 0.119, Qm: 0.00314, Cc: 0.62 } },
      { name: 'Schaum 12.56 — 1 in orifice, Cv 0.98, Cc 0.62, jet drops 3.08 ft in 8.19 ft (H 5.66 ft, 0.0632 cfs)', units: 'EN', mode: 'steady', set: { d: 1, Cd: 0.6076, Cv: 0.98, Cc: 0.62, ps: 0, y: 4, jang: 0, jfind: 'H', xm: 8.19, ym: 3.08 } },
      { name: 'Hibbeler 5-58 — 60 psi air over 4 ft of water, hole 2 ft above the ground (95.8 ft/s, 33.8 ft)', units: 'EN', mode: 'steady', set: { H: 4, d: 1, Cd: 1, Cv: 1, Cc: 1, ps: 60, y: 2, jang: 0, jfind: 'land' } },
      { name: 'CE Board 6-16 — side sloping 1H:1V, H 3 m, orifice 3.7 + 1.2 m above the ground, Cv 1 (7.672 m/s, 1.5 m rise, x 9.20 m; book 9.18 after rounding 0.1667 to 0.167)', mode: 'steady', set: { H: 3, d: 50, Cd: 1, Cv: 1, Cc: 1, ps: 0, y: 4.9, jby: 'slope', zw: 1, jdir: 'up', jfind: 'land' } },
      { name: 'Slanted nozzle 30° up, H 4 m, 1.5 m above the ground', mode: 'steady', set: { H: 4, d: 50, Cd: 0.6, Cv: 0.98, Cc: 0.612, ps: 0, y: 1.5, jang: 30, jfind: 'land' } },
      { name: 'Slanted jet 20° down: height where it meets a wall 2 m away', mode: 'steady', set: { H: 4, d: 50, Cd: 0.6, Cv: 0.98, Cc: 0.612, ps: 0, y: 3, jang: -20, jfind: 'pt', xq: 2 } }
    ]
  };
  MODS.push(M1);

  // free jet leaving a side orifice at θ above the horizontal (world units, origin at the orifice x)
  const jetT = (v, th, yo, g) => { const vy = v * Math.sin(th); return (vy + Math.sqrt(vy * vy + 2 * g * Math.max(yo, 1e-4))) / g; };
  const jetPt = (v, th, yo, g, t) => [v * Math.cos(th) * t, yo + v * Math.sin(th) * t - (g * t * t) / 2];
  // tank geometry used for drawing (world units, h measured up from the orifice)
  function tankGeom(I, mode) {
    const sh = mode === 'steady' ? 'vcyl' : I.shape;
    let Wt, Ht, hw, side = sh === 'vcyl' || sh === 'rect';
    if (mode === 'steady') { Wt = Math.max(0.6, 0.45 * I.H); Ht = I.H * 1.25; hw = () => Wt / 2; }
    else if (sh === 'vcyl') { Wt = I.D; Ht = Math.max(I.H, I.H2 || 0) * 1.2 + 0.1; hw = () => Wt / 2; }
    else if (sh === 'rect') { Wt = I.Lt; Ht = Math.max(I.H, I.H2 || 0) * 1.2 + 0.1; hw = () => Wt / 2; }
    else if (sh === 'cone') { Wt = I.Dc; Ht = I.Hc; hw = (h) => (I.Dc / 2) * clamp(h / I.Hc, 0, 1); }
    else if (sh === 'sphere') { Wt = I.Ds; Ht = I.Ds; hw = (h) => Math.sqrt(Math.max(0, h * (I.Ds - h))); }
    else if (sh === 'hcyl') { Wt = I.Dh; Ht = I.Dh; hw = (h) => Math.sqrt(Math.max(0, h * (I.Dh - h))); }
    else { Wt = Math.max(I.Db, I.Dt); Ht = I.Hf; hw = (h) => I.Db / 2 + ((I.Dt - I.Db) / 2) * clamp(h / I.Hf, 0, 1); }
    return { sh, Wt, Ht, hw, side };
  }
  function tankPath(ctx, V, G, cx, yo, fl) {
    const X = V.X, Y = V.Y, top = yo + G.Ht;
    ctx.beginPath();
    if (G.side) { ctx.rect(X(-G.Wt), Y(top), G.Wt * V.sx, (G.Ht + fl) * V.sy); }
    else if (G.sh === 'cone') { ctx.moveTo(X(cx - G.Wt / 2), Y(top)); ctx.lineTo(X(cx), Y(yo)); ctx.lineTo(X(cx + G.Wt / 2), Y(top)); ctx.closePath(); }
    else if (G.sh === 'sphere' || G.sh === 'hcyl') { ctx.arc(X(cx), Y(yo + G.Wt / 2), (G.Wt / 2) * V.sx, 0, 2 * PI); }
    else { const rb = G.hw(0), rt = G.hw(G.Ht); ctx.moveTo(X(cx - rt), Y(top)); ctx.lineTo(X(cx - rb), Y(yo)); ctx.lineTo(X(cx + rb), Y(yo)); ctx.lineTo(X(cx + rt), Y(top)); ctx.closePath(); }
  }
  M1.draw = function (ctx, W, H, R, A, T) {
    const d = R.data, I = d.Iover ? Object.assign({}, S.I, d.Iover) : S.I, mode = d.mode, g = S.U.g, L = S.U.L, th = d.th || 0;
    if (mode === 'twotank') return drawTwoTank(ctx, W, H, R, A, T);
    const G = tankGeom(I, mode);
    let hT = mode === 'steady' ? I.H : d.hAt ? d.hAt(S.simT) : I.H;
    const h = sm(A, 'h', hT, T.rdt, 14);
    const hp = d.hp || 0, heqNow = d.layers ? (d.heqOf ? d.heqOf(Math.max(0, h)) : d.H1 + hp) : h + hp, v = d.Cv * Math.sqrt(2 * g * Math.max(0, heqNow));
    const jetCol = d.layers ? layCol(d.layerAt ? d.layerAt(Math.max(0, h)) : 0) : C.water;
    const yo = I.y, fl = Math.max((I.d / 2) * 1.6, 0.03 * G.Ht);
    const cx = G.side ? -G.Wt / 2 : 0;
    const xLand0 = G.side ? (th ? d.x || 0 : 2 * d.Cv * Math.sqrt(Math.max(0, d.H1 + hp) * yo)) : 0;
    const span = Math.max(G.Wt + xLand0, yo + G.Ht, 1), ztop = Math.max(yo + G.Ht, G.side && d.zmax ? yo + d.zmax : 0);
    const b = smB(A, 'b', { x0: (G.side ? -G.Wt : -G.Wt / 2) - 0.22 * span, x1: Math.max(xLand0, G.side ? 0.3 * G.Wt : G.Wt / 2) + 0.12 * span + (d.layers && !G.side ? 0.65 * span : 0), y0: -0.07 * span, y1: ztop + 0.08 * span }, T.rdt);
    const V = view(b, W, H, { l: 20, r: 20, t: 26, b: 26 }, true);
    const X = V.X, Y = V.Y;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    ground(ctx, 0, W, Y(0), H - Y(0));
    // stand / legs
    const bottomY = G.side ? yo - fl : yo;
    if (bottomY > 0.001) { ctx.fillStyle = C.wall; ctx.globalAlpha = 0.25; const lx = G.side ? [-G.Wt * 0.9, -G.Wt * 0.1] : [cx - G.Wt * 0.35, cx + G.Wt * 0.35]; lx.forEach((x) => ctx.fillRect(X(x) - 3, Y(G.side ? bottomY : yo + (G.sh === 'cone' ? G.Ht * 0.4 : G.sh === 'frustum' ? 0 : G.Wt * 0.2)), 6, Y(0) - Y(G.side ? bottomY : yo + (G.sh === 'cone' ? G.Ht * 0.4 : G.sh === 'frustum' ? 0 : G.Wt * 0.2)))); ctx.globalAlpha = 1; }
    datum(ctx, 0, W, Y(yo), 'Datum (orifice ℄)');
    // water
    const lvl = yo + Math.max(0, h);
    ctx.save(); tankPath(ctx, V, G, cx, yo, fl); ctx.clip();
    const bands = layerBands(d, h, -fl - 1);
    if (bands) bands.forEach((q) => { ctx.fillStyle = layCol(q.j); ctx.globalAlpha = 0.36; ctx.fillRect(0, Y(yo + q.z1), W, Y(yo + q.z0) - Y(yo + q.z1)); ctx.globalAlpha = 1; });
    else { ctx.fillStyle = C.water; ctx.globalAlpha = 0.33; ctx.fillRect(0, Y(lvl), W, Y(yo - fl - 1) - Y(lvl)); ctx.globalAlpha = 1; }
    ctx.restore();
    if (bands) bands.forEach((q) => { const zi = q.z1; if (zi <= 1e-9 || zi >= h - 1e-9) return; const hw = G.hw(zi); stroke(ctx, [[X(cx - hw), Y(yo + zi)], [X(cx + hw), Y(yo + zi)]], layCol(q.j), 1.5, [6, 3]); });
    // outline
    tankPath(ctx, V, G, cx, yo, fl); ctx.strokeStyle = C.wall; ctx.lineWidth = 3; ctx.stroke();
    if (G.side) { ctx.fillStyle = C.bg; const ro = Math.max(2, (I.d / 2) * V.sy); ctx.fillRect(X(0) - 3, Y(yo) - ro, 6, 2 * ro); }
    if (hp !== 0 && G.side) { stroke(ctx, [[X(-G.Wt), Y(yo + G.Ht)], [X(0), Y(yo + G.Ht)]], C.wall, 4); txt(ctx, `p_s = ${fmt(I.ps)} ${S.U.p} (closed)`, X(-G.Wt / 2), Y(yo + G.Ht) - 12, { align: 'center', size: 11, mono: true, bg: C.bg }); }
    // free surface symbol and level
    const hwL = G.hw(Math.max(0, h));
    if (h > 0.001) { stroke(ctx, [[X(cx - hwL), Y(lvl)], [X(cx + hwL), Y(lvl)]], C.water_deep, 1.5); surfSym(ctx, X(cx + hwL * 0.45), Y(lvl)); }
    // dimensions
    const dimX = X((G.side ? -G.Wt : cx - G.Wt / 2)) - 18;
    dimV(ctx, dimX, Y(yo), Y(lvl), `${mode === 'steady' ? 'H' : 'h'} = ${fmt(h)} ${L}`, null, 'left');
    if (mode !== 'steady' && I.H2 >= 0 && (mode !== 'inflow' || true)) { const y2 = Y(yo + I.H2); stroke(ctx, [[X(cx - G.hw(I.H2)) - 6, y2], [X(cx + G.hw(I.H2)) + 6, y2]], C.egl, 1, [5, 4]); txt(ctx, 'H₂', X(cx + G.hw(I.H2)) + 8, y2, { size: 11, color: C.egl, mono: true }); }
    if (mode === 'inflow' && isFinite(d.heq) && d.heq > 0 && d.heq < G.Ht) { const ye = Y(yo + d.heq); stroke(ctx, [[X(cx - G.hw(d.heq)), ye], [X(cx + G.hw(d.heq)), ye]], C.ok, 1, [2, 3]); txt(ctx, 'h_eq', X(cx - G.hw(d.heq)) + 4, ye - 8, { size: 11, color: C.ok, mono: true }); }
    if (yo > 0.01) dimV(ctx, dimX - (G.side ? 0 : 0) - 0, Y(0), Y(yo) - 0, `y = ${fmt(yo)} ${L}`, null, 'left');
    // inflow pipe
    if (mode === 'inflow' && d.Qin > 0) { const xp = X(cx - G.hw(G.Ht) * 0.5), yp = Y(yo + G.Ht + 0.05 * span); stroke(ctx, [[xp - 40, yp], [xp, yp], [xp, yp + 8]], C.pipe, 6); txt(ctx, `Q_in = ${fmt(d.Qin)} ${S.U.Q}`, xp - 40, yp - 12, { size: 11, mono: true }); }
    // jet
    const dj = Math.sqrt(d.Cc) * I.d;
    const jet = [];
    if (v > 1e-6) {
      if (G.side) { const tL = jetT(v, th, yo, g); for (let i = 0; i <= 40; i++) jet.push(jetPt(v, th, yo, g, (tL * i) / 40)); }
      else { const tL = (-v + Math.sqrt(v * v + 2 * g * Math.max(yo, 1e-4))) / g; for (let i = 0; i <= 20; i++) { const t = (tL * i) / 20; jet.push([0, yo - v * t - (g * t * t) / 2]); } }
      const wpx = Math.max(2.5, dj * V.sx);
      ctx.strokeStyle = jetCol; ctx.globalAlpha = 0.55; ctx.lineCap = 'round'; ctx.lineWidth = wpx; poly(ctx, jet.map((p) => [X(p[0]), Y(p[1])])); ctx.stroke(); ctx.globalAlpha = 1; ctx.lineCap = 'butt';
      // vena contracta (narrowing just outside the opening)
      if (G.side) { ctx.save(); ctx.translate(X(0), Y(yo)); ctx.rotate(-th); ctx.translate(-X(0), -Y(yo)); const x0 = X(0), r0 = Math.max(2, (I.d / 2) * V.sy), r1 = Math.max(1.3, (dj / 2) * V.sy), lx = Math.max(8, I.d * 0.6 * V.sx); ctx.beginPath(); ctx.moveTo(x0, Y(yo) - r0); ctx.quadraticCurveTo(x0 + lx * 0.4, Y(yo) - r1, x0 + lx, Y(yo) - r1); ctx.lineTo(x0 + lx, Y(yo) + r1); ctx.quadraticCurveTo(x0 + lx * 0.4, Y(yo) + r1, x0, Y(yo) + r0); ctx.closePath(); ctx.fillStyle = C.water_deep; ctx.globalAlpha = 0.6; ctx.fill(); ctx.globalAlpha = 1; txt(ctx, 'vena contracta', x0 + lx + 4, Y(yo) - r0 - 8, { size: 10, color: C.muted }); ctx.restore(); }
      const end = jet[jet.length - 1];
      if (G.side) { ctx.beginPath(); ctx.arc(X(end[0]), Y(0), 4, 0, 2 * PI); ctx.fillStyle = C.egl; ctx.fill(); dimH(ctx, X(0), X(end[0]), Y(0) + 18, `x = ${fmt(end[0])} ${L}`); }
      if (G.side && th) txt(ctx, `θ = ${fmt(th * 180 / PI)}°`, X(0) + 14, Y(yo) + (th > 0 ? 32 : -16), { size: 11, mono: true, color: C.egl, bg: C.bg });
      if (G.side && d.zmax) { const zt = Y(yo + d.zmax), xt = X(d.xz); stroke(ctx, [[X(0), zt], [xt + 30, zt]], C.muted, 1, [3, 3]); dimV(ctx, X(d.xz), Y(yo), zt, `z_max = ${fmt(d.zmax)} ${L}`, null, 'right'); }
      const mk = (wx, wy, lab) => { ctx.beginPath(); ctx.arc(X(wx), Y(wy), 5, 0, 2 * PI); ctx.strokeStyle = C.egl; ctx.lineWidth = 2; ctx.stroke(); txt(ctx, lab, X(wx) + 8, Y(wy) - 10, { size: 11, mono: true, color: C.egl, bg: C.bg }); };
      if (G.side && mode === 'steady' && I.jfind === 'pt' && isFinite(d.zq)) { stroke(ctx, [[X(d.xq), Y(0)], [X(d.xq), Y(Math.max(yo, yo + d.zq) + 0.3 * span * 0.3)]], C.wall, 3); mk(d.xq, yo + d.zq, `z = ${fmt(d.zq)} ${L} at x_p`); }
      if (G.side && mode === 'steady' && (I.jfind === 'cv' || I.jfind === 'H')) mk(I.xm, yo - I.ym, `measured (${fmt(I.xm)}, −${fmt(I.ym)})`);
    }
    // particles
    A.parts = A.parts || [];
    const dt = T.pdt;
    const v0 = d.v0 || 1;
    if (dt > 0 && v > 1e-6) { let n = dt * 70 * clamp(v / v0, 0.15, 1.5); while (n > 0 && A.parts.length < 480) { if (rnd() < n) A.parts.push({ k: 'j', t: 0, v, o: (rnd() - 0.5) * dj }); n -= 1; } }
    if (dt > 0 && A.parts.filter((p) => p.k === 't').length < 130 && h > 0.01) for (let i = 0; i < 3; i++) { const hh = rnd() * h; A.parts.push({ k: 't', x: cx + (rnd() * 2 - 1) * G.hw(hh) * 0.95, y: yo + hh }); }
    ctx.fillStyle = C.part;
    const keep = [];
    for (const p of A.parts) {
      if (p.k === 'j') {
        p.t += dt; let x, y;
        if (G.side) { const q = jetPt(p.v, th, yo, g, p.t); x = q[0]; y = q[1] + p.o; } else { x = p.o; y = yo - p.v * p.t - (g * p.t * p.t) / 2; }
        if (y < 0) continue; keep.push(p); ctx.fillRect(X(x) - 1.5, Y(y) - 1.5, 3, 3);
      } else {
        const ox = G.side ? 0 : 0, dx = ox - p.x, dy = yo - p.y, r = Math.hypot(dx, dy) + 1e-9;
        const spd = (0.04 + 0.5 * Math.exp(-r / (0.25 * G.Wt + 0.05))) * v * 0.25;
        p.x += (dx / r) * spd * dt; p.y += (dy / r) * spd * dt;
        if (r < Math.max(I.d, 0.02 * G.Wt) || p.y > lvl || Math.abs(p.x - cx) > G.hw(p.y - yo) + 1e-6) continue;
        keep.push(p); ctx.globalAlpha = 0.55; ctx.fillRect(X(p.x) - 1, Y(p.y) - 1, 2.5, 2.5); ctx.globalAlpha = 1;
      }
    }
    A.parts = keep;
    txt(ctx, `v = ${fmt(v)} ${S.U.v}`, G.side ? X(0) + 10 : X(0) + 12, Y(yo) + 14, { size: 11, mono: true, bg: C.bg });
    velScale(ctx, W - 210, 40, V.sx, S.U.v);
    if (d.layers) layerLegend(ctx, d, h, W - 12, 78);
    if (mode !== 'steady' && S.simT >= d.tEnd - 1e-9) txt(ctx, isFinite(d.tEnd) ? 'H₂ reached — press Reset to run again' : '', W / 2, 18, { align: 'center', bold: true, color: C.egl });
  };
  function drawTwoTank(ctx, W, H, R, A, T) {
    const d = R.data, I = S.I, g = S.U.g, L = S.U.L;
    const z = sm(A, 'z', d.hAt(S.simT), T.rdt, 14), H1 = I.H;
    const base = 0.3 * H1, A1 = d.A1, A2 = d.A2, dl = H1 - z;
    const e1 = base + H1 - (dl * A2) / (A1 + A2), e2 = base + (dl * A1) / (A1 + A2);
    const w1 = Math.sqrt(A1), w2 = Math.sqrt(A2), top = base + H1 * 1.25;
    const b = smB(A, 'b', { x0: -w1 - 0.35 * H1, x1: w2 + 0.2 * H1, y0: -0.15 * H1, y1: top + 0.1 * H1 }, T.rdt);
    const V = view(b, W, H, { l: 30, r: 20, t: 30, b: 20 }, true), X = V.X, Y = V.Y;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    ground(ctx, 0, W, Y(-0.08 * H1), H);
    ctx.fillStyle = C.water; ctx.globalAlpha = 0.33; ctx.fillRect(X(-w1), Y(e1), w1 * V.sx, Y(-0.05 * H1) - Y(e1)); ctx.fillRect(X(0), Y(e2), w2 * V.sx, Y(-0.05 * H1) - Y(e2)); ctx.globalAlpha = 1;
    ctx.strokeStyle = C.wall; ctx.lineWidth = 3; ctx.strokeRect(X(-w1), Y(top), w1 * V.sx, Y(-0.05 * H1) - Y(top)); ctx.strokeRect(X(0), Y(top), w2 * V.sx, Y(-0.05 * H1) - Y(top));
    const ro = Math.max(2.5, (I.d / 2) * V.sy); ctx.fillStyle = C.water; ctx.globalAlpha = 0.5; ctx.fillRect(X(0) - 3, Y(0) - ro, 6, 2 * ro); ctx.globalAlpha = 1;
    datum(ctx, 0, W, Y(0), 'orifice ℄');
    surfSym(ctx, X(-w1 / 2), Y(e1)); surfSym(ctx, X(w2 / 2), Y(e2));
    stroke(ctx, [[X(-w1), Y(e1)], [X(0), Y(e1)]], C.water_deep, 1.5); stroke(ctx, [[X(0), Y(e2)], [X(w2), Y(e2)]], C.water_deep, 1.5);
    stroke(ctx, [[X(0), Y(e1)], [X(w2 * 0.85), Y(e1)]], C.muted, 1, [3, 3]);
    dimV(ctx, X(w2 * 0.8), Y(e2), Y(e1), `ΔH = ${fmt(z)} ${L}`);
    txt(ctx, `Tank 1, A₁ = ${fmt(A1)} ${S.U.A}`, X(0) - 8, Y(top) - 12, { align: 'right', size: 12, bold: true }); // labels sit either side of the shared wall so they never overlap
    txt(ctx, `Tank 2, A₂ = ${fmt(A2)} ${S.U.A}`, X(0) + 8, Y(top) - 12, { align: 'left', size: 12, bold: true });
    const v = d.Cv * Math.sqrt(2 * g * Math.max(0, z));
    A.parts = A.parts || []; const dt = T.pdt;
    if (dt > 0 && v > 1e-4) { let n = dt * 60 * clamp(v / (d.v0 || 1), 0.2, 1); while (n > 0 && A.parts.length < 400) { if (rnd() < n) A.parts.push({ k: 'j', x: 0, y: (rnd() - 0.5) * ro / V.sy * 2, vx: v, vy: (rnd() - 0.5) * 0.3 * v, life: 0 }); n -= 1; } }
    if (dt > 0 && A.parts.filter((p) => p.k === 't').length < 100) for (let i = 0; i < 2; i++) A.parts.push({ k: 't', x: -rnd() * w1, y: rnd() * e1 - 0.03 * H1 });
    const keep = []; ctx.fillStyle = C.part;
    for (const p of A.parts) {
      if (p.k === 'j') { p.life += dt; p.vx *= Math.exp(-dt * 2.2); p.x += p.vx * dt; p.y += p.vy * dt; if (p.life > 1.6 || p.x > w2 || p.y > e2) continue; ctx.globalAlpha = 1 - p.life / 1.6; }
      else { const dx = -p.x, dy = -p.y, r = Math.hypot(dx, dy) + 1e-9, spd = (0.04 + 0.6 * Math.exp(-r / (0.3 * w1))) * v * 0.25; p.x += (dx / r) * spd * dt; p.y += (dy / r) * spd * dt; if (r < 0.03 * w1 || p.y > e1 || p.x < -w1) continue; ctx.globalAlpha = 0.55; }
      keep.push(p); ctx.fillRect(X(p.x) - 1.2, Y(p.y) - 1.2, 2.5, 2.5);
    }
    ctx.globalAlpha = 1; A.parts = keep;
    velScale(ctx, W - 210, 40, V.sx, S.U.v);
    if (S.simT >= d.tEnd - 1e-9) txt(ctx, 'H₂ reached — press Reset to run again', W / 2, 16, { align: 'center', bold: true, color: C.egl });
  }
  M1.drawAux = function (ctx, W, H, R) {
    const d = R.data, U = S.U;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    if (d.mode === 'steady') {
      const hs = [], qs = [], xh = d.layers || d.Iover ? d.H1 : S.I.H; const Hm = Math.max(xh * 2, 1);
      for (let i = 0; i <= 80; i++) { const h = (Hm * i) / 80; hs.push(h); qs.push(d.K * Math.sqrt(Math.max(0, h + d.hp))); }
      plot(ctx, { x: 0, y: 0, w: W, h: H }, { title: d.layers ? 'Discharge vs equivalent head of layer 1 (Q = Cd·A_o·√(2g·H_eq))' : 'Discharge vs head (Q = Cd·A_o·√(2gH))', xs: hs, series: [{ ys: qs, color: C.water_deep, fill: true }], xlab: `${d.layers ? 'H_eq' : 'H'} (${U.L})`, ylab: '', ymin: 0, pts: [{ x: xh, y: d.Q0, color: C.egl, label: `Q = ${fmt(d.Q0)} ${U.Q}` }] });
      return;
    }
    const tb = d.table; if (!tb) return;
    const w2 = W / 2, tUnitMin = tb.ts[tb.ts.length - 1] > 600; const sc = tUnitMin ? 1 / 60 : 1;
    const xs = tb.ts.map((t) => t * sc), cur = S.simT * sc, tl = tUnitMin ? 't (min)' : 't (s)';
    plot(ctx, { x: 0, y: 0, w: w2, h: H }, { title: d.mode === 'twotank' ? `Head difference ΔH (${U.L}) vs t` : `Head h (${U.L}) vs t`, xs, series: [{ ys: tb.hs, color: C.water_deep, fill: true }], xlab: tl, ymin: 0, cursor: cur, hmarks: d.mode === 'inflow' && isFinite(d.heq) ? [{ y: d.heq, label: 'h_eq', color: C.ok }] : [], pts: [{ x: cur, y: HP.interp(tb.ts, tb.hs, S.simT), color: C.egl }] });
    plot(ctx, { x: w2, y: 0, w: w2, h: H }, { title: `Outflow Q (${U.Q}) vs t`, xs, series: [{ ys: tb.qs, color: C.hgl, fill: true }], xlab: tl, ymin: 0, cursor: cur, hmarks: d.mode === 'inflow' ? [{ y: d.Qin, label: 'Q_in', color: C.ok }] : [], pts: [{ x: cur, y: HP.interp(tb.ts, tb.qs, S.simT), color: C.egl }] });
  };
  M1.tEnd = (R) => R.data.tEnd;
  M1.hint = 'Switch between the 3D isometric and 2D side views above the diagram. Use 20× or 100× to watch a tank drain in screen time.';

  /* ---------------------------------------------------------------- M2 */
  const SUB = ['₀', '₁', '₂', '₃', '₄', '₅'];
  const cntP = (P, m) => (m === 'single' ? 1 : m === 'three' ? 3 : +P.np);
  const isSer = (m) => m === 'single' || m === 'series';
  const parRes = (P, m) => m === 'parallel' && (P.known === 'H' || P.pres);
  const pipeParams = [];
  [[1000, 300], [800, 250], [1200, 350], [900, 200], [1100, 400]].forEach((dv, j) => {
    const i = j + 1, vis = (P, m) => i <= cntP(P, m), cf = (P) => P.formula;
    pipeParams.push(
      { k: '_h' + i, type: 'head', labelFn: (P, m) => (m === 'parallel' ? `Branch ${i}` : m === 'three' ? `Pipe ${i} (to reservoir ${'ABC'[j]})` : `Pipe ${i}`), show: vis },
      { k: 'open' + i, type: 'check', label: 'Branch open (valve)', def: true, show: (P, m) => m === 'parallel' && vis(P, m) },
      { k: 'L' + i, label: `Length L${SUB[i]}`, dim: 'len', min: 1, max: 10000, step: 1, def: dv[0], log: true, show: vis },
      { k: 'D' + i, label: `Diameter D${SUB[i]}`, dim: 'mm', min: 25, max: 2000, step: 1, def: dv[1], show: vis },
      { k: 'f' + i, label: `Darcy f${SUB[i]}`, min: 0.008, max: 0.08, step: 0.0001, def: 0.02, show: (P, m) => vis(P, m) && cf(P) === 'darcy' && !P.cole },
      { k: 'n' + i, label: `Manning n${SUB[i]}`, min: 0.009, max: 0.025, step: 0.0001, def: 0.012, show: (P, m) => vis(P, m) && cf(P) === 'manning' },
      { k: 'C' + i, label: `Hazen-Williams C${SUB[i]}`, min: 60, max: 150, step: 1, def: 120, show: (P, m) => vis(P, m) && cf(P) === 'hw' },
      { k: 'K' + i, label: 'Valves + fittings ΣK', min: 0, max: 50, step: 0.1, def: 0, show: (P, m) => m === 'parallel' && vis(P, m) },
      { k: 'zn' + i, label: `Elevation at the end of pipe ${i}`, dim: 'len', min: -200, max: 500, step: 0.1, def: 0, show: (P, m) => isSer(m) && vis(P, m) }
    );
  });
  const extPipe = (tag, name, flag) => [
    { k: '_h' + tag, type: 'head', label: name, show: (P, m) => m === 'parallel' && P[flag] },
    { k: 'L' + tag, label: `Length L`, dim: 'len', min: 1, max: 10000, step: 1, def: 500, log: true, show: (P, m) => m === 'parallel' && P[flag] },
    { k: 'D' + tag, label: `Diameter D`, dim: 'mm', min: 25, max: 2000, step: 1, def: 400, show: (P, m) => m === 'parallel' && P[flag] },
    { k: 'f' + tag, label: 'Darcy f', min: 0.008, max: 0.08, step: 0.0001, def: 0.02, show: (P, m) => m === 'parallel' && P[flag] && P.formula === 'darcy' && !P.cole },
    { k: 'n' + tag, label: 'Manning n', min: 0.009, max: 0.025, step: 0.0001, def: 0.012, show: (P, m) => m === 'parallel' && P[flag] && P.formula === 'manning' },
    { k: 'C' + tag, label: 'Hazen-Williams C', min: 60, max: 150, step: 1, def: 120, show: (P, m) => m === 'parallel' && P[flag] && P.formula === 'hw' }
  ];
  const M2 = {
    id: 'pipes', tab: 'Pipe Systems', title: 'Pipe Flow: Head Losses, Series, Parallel and Reservoir Systems', fn: 'pipes',
    modes: [['single', 'Single pipe (head loss)'], ['series', 'Pipes in series'], ['parallel', 'Pipes in parallel'], ['three', 'Three-reservoir problem'], ['equiv', 'Equivalent pipe']],
    speed: {},
    modeDefaults: { single: { ends: 'res' }, series: { ends: 'nodes', np: '3' }, parallel: { np: '3' } },
    params: [
      { k: 'formula', type: 'select', label: 'Friction formula', def: 'darcy', options: [['darcy', 'Darcy-Weisbach (f)'], ['manning', 'Manning (n)'], ['hw', 'Hazen-Williams (C)']] },
      { k: 'cole', type: 'check', label: 'Compute f from Re (Colebrook)', def: false, show: (P) => P.formula === 'darcy' },
      { k: 'nu', label: 'Kinematic viscosity ν', dim: 'nu', min: 0.1, max: 10, step: 0.001, def: 1.003, show: (P) => P.formula === 'darcy' && P.cole },
      { k: 'eps', label: 'Roughness ε', dim: 'mm', min: 0, max: 5, step: 0.001, def: 0.045, show: (P) => P.formula === 'darcy' && P.cole },
      { k: '_hsys', type: 'head', label: 'System', show: (P, m) => m !== 'three' },
      { k: 'ends', type: 'select', label: 'Pipe system ends', def: 'res', options: [['nodes', 'Point A → point B (pipeline)'], ['res', 'Reservoir → reservoir'], ['free', 'Reservoir → free outlet (jet)']], modes: ['single', 'series'] },
      { k: 'np', type: 'select', label: 'Number of pipes', labelFn: (P, m) => (m === 'parallel' ? 'Number of branches' : 'Number of pipes'), def: '2', options: [['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']], modes: ['series', 'parallel', 'equiv'] },
      { k: 'sys', type: 'select', label: 'System to replace', def: 'series', options: [['series', 'Pipes in series'], ['parallel', 'Pipes in parallel']], modes: ['equiv'] },
      { k: 'known', type: 'select', label: 'Known quantity', def: 'Q', options: [['Q', 'Total flow Q'], ['H', 'Head H between two reservoirs'], ['hf', 'Head loss across the loop'], ['Qb', 'Flow in one branch']], modes: ['parallel'] },
      { k: 'Q', label: 'Flow Q', dim: 'Q', min: 0.001, max: 5, step: 0.001, def: 0.1, log: true, show: (P, m) => m !== 'three' && (m !== 'parallel' || P.known === 'Q') },
      { k: 'Ht', label: 'Head between reservoir surfaces H', dim: 'len', min: 0.1, max: 500, step: 0.01, def: 30, show: (P, m) => m === 'parallel' && P.known === 'H' },
      { k: 'hk', label: 'Head loss across the loop hf', dim: 'len', min: 0.01, max: 200, step: 0.01, def: 5, show: (P, m) => m === 'parallel' && P.known === 'hf' },
      { k: 'jb', type: 'select', label: 'Branch with the known flow', def: '1', options: [['1', 'Branch 1'], ['2', 'Branch 2'], ['3', 'Branch 3'], ['4', 'Branch 4'], ['5', 'Branch 5']], show: (P, m) => m === 'parallel' && P.known === 'Qb' },
      { k: 'Qb', label: 'Flow in that branch', dim: 'Q', min: 0.0001, max: 5, step: 0.0001, def: 0.05, log: true, show: (P, m) => m === 'parallel' && P.known === 'Qb' },
      { k: 'pres', type: 'check', label: 'Reservoirs at both ends', def: false, show: (P, m) => m === 'parallel' && P.known !== 'H' },
      { k: 'feed', type: 'check', label: 'Feeder pipe before the loop', def: false, modes: ['parallel'] },
      { k: 'outl', type: 'check', label: 'Outlet pipe after the loop', def: false, modes: ['parallel'] },
      { k: 'pA', label: 'Pressure at A (start)', dim: 'kPa', min: -100, max: 2000, step: 0.1, def: 300, show: (P, m) => isSer(m) && P.ends === 'nodes' },
      { k: 'zR', label: 'Downstream reservoir surface', dim: 'len', min: -200, max: 500, step: 0.1, def: 5, show: (P, m) => isSer(m) && P.ends === 'res' },
      { k: 'zn0', label: 'Elevation at the start (node 0)', dim: 'len', min: -200, max: 500, step: 0.1, def: 0, show: (P, m) => isSer(m) },
      { k: 'Kent', label: 'Entrance loss K_ent', min: 0, max: 10, step: 0.01, def: 0.5, show: (P, m) => (isSer(m) && P.ends !== 'nodes') || (parRes(P, m) && P.feed) },
      { k: 'Kexit', label: 'Exit loss K_exit', min: 0, max: 10, step: 0.01, def: 1, show: (P, m) => (isSer(m) && P.ends === 'res') || (parRes(P, m) && P.outl) },
      { k: 'Kfit', label: 'Bends + valves ΣK (pipe 1)', min: 0, max: 10, step: 0.01, def: 0, modes: ['single', 'series'] },
      ...extPipe('F', 'Feeder pipe (before the loop)', 'feed'),
      ...pipeParams,
      ...extPipe('O', 'Outlet pipe (after the loop)', 'outl'),
      { k: '_hres', type: 'head', label: 'Reservoirs', modes: ['three'] },
      { k: 'zA', label: 'Reservoir A elevation', dim: 'len', min: 0, max: 500, step: 0.01, def: 100, modes: ['three'] },
      { k: 'zB', label: 'Reservoir B elevation', dim: 'len', min: 0, max: 500, step: 0.01, def: 80, modes: ['three'] },
      { k: 'zC', label: 'Reservoir C elevation', dim: 'len', min: 0, max: 500, step: 0.01, def: 50, modes: ['three'] },
      { k: '_heq', type: 'head', label: 'Equivalent pipe', modes: ['equiv'] },
      { k: 'solveFor', type: 'select', label: 'Solve for', def: 'L', options: [['L', 'Equivalent length (given D)'], ['D', 'Equivalent diameter (given L)']], modes: ['equiv'] },
      { k: 'De', label: 'Equivalent pipe diameter D_e', dim: 'mm', min: 25, max: 2000, step: 1, def: 300, show: (P, m) => m === 'equiv' && P.solveFor === 'L' },
      { k: 'Le', label: 'Equivalent pipe length L_e', dim: 'len', min: 1, max: 10000, step: 1, def: 1000, log: true, show: (P, m) => m === 'equiv' && P.solveFor === 'D' },
      { k: 'fe', label: 'Equivalent pipe f', min: 0.008, max: 0.08, step: 0.0001, def: 0.02, show: (P, m) => m === 'equiv' && P.formula === 'darcy' },
      { k: 'ne', label: 'Equivalent pipe n', min: 0.009, max: 0.025, step: 0.0001, def: 0.012, show: (P, m) => m === 'equiv' && P.formula === 'manning' },
      { k: 'Ce', label: 'Equivalent pipe C', min: 60, max: 150, step: 1, def: 120, show: (P, m) => m === 'equiv' && P.formula === 'hw' }
    ],
    presets: [
      { name: 'Test 4 — Darcy hf: L = 1000 m, D = 300 mm, f = 0.02, Q = 0.10', mode: 'single', set: { ends: 'res', L1: 1000, D1: 300, f1: 0.02, Q: 0.1, Kent: 0, Kexit: 0 } },
      { name: 'Test 5 — three reservoirs A 100 / B 80 / C 50 m', mode: 'three', set: { zA: 100, zB: 80, zC: 50, L1: 1000, D1: 300, L2: 800, D2: 250, L3: 1200, D3: 350 } },
      { name: 'Series pipeline A → B: 300 kPa at A, rising 15 m', mode: 'series', set: { ends: 'nodes', np: '3', pA: 300, Q: 0.08, D1: 300, D2: 250, D3: 300, zn0: 0, zn1: 5, zn2: 10, zn3: 15 } },
      { name: 'Series, reservoir → reservoir: 300 mm then 200 mm', mode: 'series', set: { ends: 'res', np: '2', L1: 600, D1: 300, L2: 400, D2: 200, Q: 0.08, zn0: -3, zn1: -3, zn2: -3, zR: 0 } },
      { name: 'Series, reservoir → free jet through 3 pipes', mode: 'series', set: { ends: 'free', np: '3', Q: 0.06, D1: 300, D2: 250, D3: 200, L3: 300, zn0: 0, zn1: -4, zn2: -8, zn3: -10 } },
      { name: 'Parallel: three branches share Q = 0.30', mode: 'parallel', set: { np: '3', known: 'Q', Q: 0.3 } },
      { name: 'Reservoir → feeder → 2 branches → outlet → reservoir, H = 30 m', mode: 'parallel', set: { np: '2', known: 'H', Ht: 30, feed: true, outl: true } },
      { name: 'Parallel: branch 2 throttled by a valve (K = 20)', mode: 'parallel', set: { np: '3', known: 'Q', Q: 0.3, K2: 20 } },
      { name: 'Parallel: branch 3 closed, flow redistributes', mode: 'parallel', set: { np: '3', known: 'Q', Q: 0.3, open3: false } },
      { name: 'Parallel: flow in branch 1 known = 0.05 m³/s', mode: 'parallel', set: { np: '3', known: 'Qb', jb: '1', Qb: 0.05 } },
      { name: 'Parallel: five branches, 5 m head loss across the loop', mode: 'parallel', set: { np: '5', known: 'hf', hk: 5 } },
      { name: 'Equivalent length of two series pipes (D = 300 mm)', mode: 'equiv', set: { np: '2', sys: 'series', solveFor: 'L', De: 300 } },
      { name: 'Hazen-Williams, C = 120, Q = 0.10', mode: 'single', set: { formula: 'hw', Q: 0.1 } }
    ]
  };
  MODS.push(M2);
  function pipeWidth(D, Dmax) { return clamp(4 + 12 * (D / Dmax), 4, 16); }
  // shaded round pipe segment (light along the top, dark underneath)
  function pipe3(ctx, x1, y1, x2, y2, w, alpha) {
    const a = Math.atan2(y2 - y1, x2 - x1), nx = (-Math.sin(a) * w) / 2, ny = (Math.cos(a) * w) / 2;
    const gr = ctx.createLinearGradient(x1 + nx, y1 + ny, x1 - nx, y1 - ny);
    gr.addColorStop(0, shade(C.pipe, 0.6)); gr.addColorStop(0.62, shade(C.pipe, 1.35)); gr.addColorStop(1, shade(C.pipe, 0.82));
    ctx.globalAlpha = alpha === undefined ? 1 : alpha; poly(ctx, [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]], true);
    ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = shade(C.pipe, 0.5); ctx.lineWidth = 0.8; ctx.stroke(); ctx.globalAlpha = 1;
  }
  function pipePath(ctx, pts, w, alpha) { for (let i = 1; i < pts.length; i++) pipe3(ctx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], w, alpha); for (let i = 1; i < pts.length - 1; i++) { ctx.globalAlpha = alpha === undefined ? 1 : alpha; ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], w / 2, 0, 2 * PI); ctx.fillStyle = shade(C.pipe, 1.05); ctx.fill(); ctx.globalAlpha = 1; } }
  function flange(ctx, x, y, ang, w) { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = C.wall; ctx.fillRect(-2.5, -w / 2 - 4, 5, w + 8); ctx.restore(); }
  function gauge(ctx, x, y, frac, neg) {
    ctx.beginPath(); ctx.arc(x, y, 11, 0, 2 * PI); ctx.fillStyle = C.bg; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.stroke();
    for (let i = 0; i <= 6; i++) { const t = -PI * 1.25 + (i / 6) * PI * 1.5; stroke(ctx, [[x + 8 * Math.cos(t), y + 8 * Math.sin(t)], [x + 10 * Math.cos(t), y + 10 * Math.sin(t)]], C.muted, 1); }
    const t = -PI * 1.25 + clamp(frac, 0, 1) * PI * 1.5; stroke(ctx, [[x, y], [x + 8 * Math.cos(t), y + 8 * Math.sin(t)]], neg ? C.danger : C.egl, 2);
    ctx.beginPath(); ctx.arc(x, y, 1.8, 0, 2 * PI); ctx.fillStyle = C.ink; ctx.fill();
  }
  function valveSym(ctx, x, y, s, closed) {
    ctx.beginPath(); ctx.moveTo(x - s, y - s * 0.8); ctx.lineTo(x + s, y + s * 0.8); ctx.lineTo(x + s, y - s * 0.8); ctx.lineTo(x - s, y + s * 0.8); ctx.closePath();
    ctx.fillStyle = closed ? C.danger : C.wall; ctx.fill(); stroke(ctx, [[x, y], [x, y - s * 1.6]], C.wall, 2); stroke(ctx, [[x - s * 0.7, y - s * 1.6], [x + s * 0.7, y - s * 1.6]], C.wall, 2.5);
  }
  function flowDots(ctx, A, key, pts, v, dt, color) {
    // moving dots along a polyline (speed ∝ v)
    const segs = []; let tot = 0; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); tot += l; }
    if (tot < 1) return; A.off = A.off || {}; A.off[key] = ((A.off[key] || 0) + v * 30 * dt) % 18;
    ctx.fillStyle = color || C.part;
    for (let s = A.off[key] < 0 ? A.off[key] + 18 : A.off[key]; s < tot; s += 18) {
      let r = s, i = 0; while (i < segs.length && r > segs[i]) { r -= segs[i]; i++; } if (i >= segs.length) break;
      const t = r / segs[i]; ctx.fillRect(lerp(pts[i][0], pts[i + 1][0], t) - 1.5, lerp(pts[i][1], pts[i + 1][1], t) - 1.5, 3, 3);
    }
  }
  function reservoir(ctx, x0, x1, ys, yb, label) {
    ctx.fillStyle = C.water; ctx.globalAlpha = 0.33; ctx.fillRect(x0, ys, x1 - x0, yb - ys); ctx.globalAlpha = 1;
    stroke(ctx, [[x0, ys - 14], [x0, yb], [x1, yb], [x1, ys - 14]], C.wall, 2.5);
    stroke(ctx, [[x0, ys], [x1, ys]], C.water_deep, 1.5); surfSym(ctx, (x0 + x1) / 2, ys);
    if (label) txt(ctx, label, (x0 + x1) / 2, ys - 26, { align: 'center', size: 12, bold: true });
  }
  M2.draw = function (ctx, W, H, R, A, T) {
    const d = R.data, U = S.U, L = U.L, mode = d.mode, P = d.pipes;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const Dmax = Math.max(...P.map((p) => p.D));
    if (mode === 'single' || mode === 'series') {
      const n = P.length, nodes = d.nodes, ends = d.ends;
      const xA = ends === 'nodes' ? 9 : 15, xB = ends === 'free' ? 74 : ends === 'nodes' ? 91 : 85;
      const totL = P.reduce((s, p) => s + p.L, 0), xs = [xA];
      P.forEach((p) => xs.push(xs[xs.length - 1] + (xB - xA) * (0.3 / n + (0.7 * p.L) / totL)));
      const vals = []; nodes.forEach((nd, i) => { vals.push(nd.z, nd.Eup, nd.Edn, nd.Eup - P[Math.max(0, i - 1)].hv); });
      if (isFinite(d.zUp)) vals.push(d.zUp); if (isFinite(d.zDown)) vals.push(d.zDown);
      let lo = Math.min(...vals), hi = Math.max(...vals); const rg = Math.max(hi - lo, 1);
      lo -= 0.22 * rg; hi += 0.18 * rg;
      const V = view({ x0: 0, x1: 100, y0: lo, y1: hi }, W, H, { l: 16, r: 16, t: 34, b: 20 }, false), X = V.X, Y = V.Y;
      const zAt = (i, s) => lerp(nodes[i].z, nodes[i + 1].z, s);
      if (lo < 0 && hi > 0) datum(ctx, 0, W, Y(0), 'Datum  z = 0');
      // reservoirs or inlet/outlet markers
      if (ends !== 'nodes') { const bt = Math.min(nodes[0].z, d.zUp) - 0.1 * rg; reservoir(ctx, X(1), X(xA), Y(d.zUp), Y(bt), `Supply  ${fmt(d.zUp)} ${L}`); }
      if (ends === 'res') { const bt = Math.min(nodes[n].z, d.zDown) - 0.1 * rg; reservoir(ctx, X(xB), X(99), Y(d.zDown), Y(bt), `${fmt(d.zDown)} ${L}`); }
      // negative pressure shading
      P.forEach((p, i) => { const N = 30; for (let k = 0; k < N; k++) { const s0 = k / N, s1 = (k + 1) / N, h0 = lerp(nodes[i].Edn, nodes[i + 1].Eup, s0) - p.hv, h1 = lerp(nodes[i].Edn, nodes[i + 1].Eup, s1) - p.hv, z0 = zAt(i, s0), z1 = zAt(i, s1); if (h0 < z0 || h1 < z1) { const xa = X(lerp(xs[i], xs[i + 1], s0)), xb = X(lerp(xs[i], xs[i + 1], s1)); poly(ctx, [[xa, Y(z0)], [xb, Y(z1)], [xb, Y(Math.min(h1, z1))], [xa, Y(Math.min(h0, z0))]], true); ctx.fillStyle = C.danger; ctx.globalAlpha = 0.2; ctx.fill(); ctx.globalAlpha = 1; } } });
      // pipes
      const Dm = Math.max(...P.map((p) => p.D)), wOf = (p) => clamp(6 + 14 * (p.D / Dm), 6, 20);
      P.forEach((p, i) => { const a = [X(xs[i]), Y(nodes[i].z)], b = [X(xs[i + 1]), Y(nodes[i + 1].z)]; pipe3(ctx, a[0], a[1], b[0], b[1], wOf(p)); flowDots(ctx, A, 'p' + i, [a, b], p.v, T.pdt, C.part); });
      if (ends === 'free') { const p = P[n - 1], x0 = X(xs[n]), z0 = nodes[n].z, jet = []; for (let k = 0; k <= 40; k++) { const t = k * 0.04, xx = x0 + p.v * t * 22, yy = Y(z0 - 0.5 * S.U.g * t * t); if (xx > W - 8 || yy > H - 4) break; jet.push([xx, yy]); } stroke(ctx, jet, C.water, Math.max(3, wOf(p) * 0.6)); flowDots(ctx, A, 'jet', jet, p.v, T.pdt, C.part); txt(ctx, `free jet, v = ${fmt(p.v)} ${S.U.v}`, x0 + 10, Y(z0) - 18, { size: 11, mono: true, bg: C.bg }); }
      if (ends === 'nodes') { arrow(ctx, X(1), Y(nodes[0].z), X(xA) - 6, Y(nodes[0].z), C.ink, 2); arrow(ctx, X(xB) + 6, Y(nodes[n].z), X(99), Y(nodes[n].z), C.ink, 2); txt(ctx, 'A', X(2), Y(nodes[0].z) + 16, { bold: true, size: 13 }); txt(ctx, 'B', X(97), Y(nodes[n].z) + 16, { bold: true, size: 13 }); }
      // joints: flanges and node numbers
      nodes.forEach((nd, i) => { const p = P[Math.min(i, n - 1)], q = P[Math.max(i - 1, 0)]; const ang = Math.atan2(Y(nodes[Math.min(i + 1, n)].z) - Y(nodes[Math.max(i - 1, 0)].z), X(xs[Math.min(i + 1, n)]) - X(xs[Math.max(i - 1, 0)])); flange(ctx, X(xs[i]), Y(nd.z), ang, Math.max(wOf(p), wOf(q))); });
      // gauges
      const ps = nodes.map((nd) => nd.p), pmx = Math.max(...ps, 1e-9), pmn = Math.min(...ps, 0);
      nodes.forEach((nd, i) => { const x = X(xs[i]), y = Y(nd.z), w = wOf(P[Math.min(i, n - 1)]); stroke(ctx, [[x, y - w / 2 - 4], [x, y - w / 2 - 20]], C.wall, 2); gauge(ctx, x, y - w / 2 - 31, (nd.p - pmn) / (pmx - pmn || 1), nd.p < 0); txt(ctx, `p${SUB[i] || i} = ${fmt(nd.p)} ${S.U.p}`, x, y - w / 2 - 52, { align: 'center', size: 11, mono: true, bg: C.bg, color: nd.p < 0 ? C.danger : C.ink }); ctx.beginPath(); ctx.arc(x, y + w / 2 + 14, 8, 0, 2 * PI); ctx.fillStyle = C.wall; ctx.fill(); txt(ctx, String(i), x, y + w / 2 + 14, { align: 'center', size: 10, bold: true, color: C.bg }); });
      // pipe tags
      P.forEach((p, i) => { const xm = X((xs[i] + xs[i + 1]) / 2), ym = Y((nodes[i].z + nodes[i + 1].z) / 2), w = wOf(p); txt(ctx, `Pipe ${p.i}: ${fmt(p.L)} ${L}, Ø${fmt(S.U.sys === 'SI' ? p.D * 1000 : p.D * 12)} ${S.U.sys === 'SI' ? 'mm' : 'in'}`, xm, ym + w / 2 + 34, { align: 'center', size: 11, bold: true, bg: C.bg }); txt(ctx, `v ${fmt(p.v)} · hf ${fmt(p.hf)} ${L}`, xm, ym + w / 2 + 49, { align: 'center', size: 11, mono: true, color: C.muted, bg: C.bg }); });
      if (S.egl) {
        const egl = []; if (ends !== 'nodes') egl.push([X(6), Y(d.zUp)], [X(xA), Y(d.zUp)]);
        nodes.forEach((nd, i) => { egl.push([X(xs[i]), Y(nd.Eup)]); egl.push([X(xs[i]), Y(nd.Edn)]); });
        if (ends === 'res') egl.push([X(xs[n]), Y(d.zDown)], [X(94), Y(d.zDown)]); else if (ends === 'free') egl.push([X(xs[n]) + 60, Y(nodes[n].Eup)]);
        stroke(ctx, egl, C.egl, 2);
        P.forEach((p, i) => stroke(ctx, [[X(xs[i]), Y(nodes[i].Edn - p.hv)], [X(xs[i + 1]), Y(nodes[i + 1].Eup - p.hv)]], C.hgl, 2, [7, 5]));
        txt(ctx, 'EGL', X(xs[0]) + 6, Y(nodes[0].Edn) - 10, { color: C.egl, bold: true }); txt(ctx, 'HGL', X(xs[0]) + 6, Y(nodes[0].Edn - P[0].hv) + 12, { color: C.hgl, bold: true });
      }
      txt(ctx, ends === 'nodes' ? `Pipeline A → B,  Q = ${fmt(d.Q)} ${S.U.Q},  HL = ${fmt(d.HL)} ${L}` : `Q = ${fmt(d.Q)} ${S.U.Q},  H = ${fmt(d.Ht)} ${L}`, 16, 18, { bold: true, mono: true, size: 12 });
    } else if (mode === 'parallel') {
      const n = P.length, Qt = d.Q, res = d.res, fd = d.fd, ot = d.ot, U = S.U;
      const SX = (x) => 16 + ((W - 32) * x) / 100;
      const xs0 = res ? 12 : 6, xe0 = res ? 88 : 94;
      const xJ1 = fd ? 32 : xs0 + 8, xJ2 = ot ? 68 : xe0 - 8;
      const top = 122, bot = H - 26, yc = (top + bot) / 2, gap = n > 1 ? Math.min(82, (bot - top - 20) / (n - 1)) : 0;
      const Dm = Math.max(...P.map((p) => p.D), fd ? fd.D : 0, ot ? ot.D : 0), wOf = (D) => clamp(5 + 13 * (D / Dm), 5, 18);
      // ends
      if (res) { reservoir(ctx, SX(1), SX(xs0), yc - 46, yc + 34, 'Upper'); reservoir(ctx, SX(xe0), SX(99), yc - 10, yc + 34, 'Lower'); }
      else { arrow(ctx, SX(1), yc, SX(xs0) - 4, yc, C.ink, 2); arrow(ctx, SX(xe0) + 4, yc, SX(99), yc, C.ink, 2); txt(ctx, `Q = ${fmt(Qt)} ${U.Q}`, SX(1), yc - 14, { size: 12, mono: true, bold: true }); }
      // feeder / outlet / stubs
      const vQ = (D) => Qt / ((PI * D * D) / 4);
      const fPts = [[SX(xs0), yc + (res ? 20 : 0)], [SX(xJ1), yc]], oPts = [[SX(xJ2), yc], [SX(xe0), yc + (res ? 20 : 0)]];
      pipePath(ctx, fPts, wOf(fd ? fd.D : Dm * 0.8)); flowDots(ctx, A, 'fd', fPts, vQ(fd ? fd.D : Dm), T.pdt, C.part);
      pipePath(ctx, oPts, wOf(ot ? ot.D : Dm * 0.8)); flowDots(ctx, A, 'ot', oPts, vQ(ot ? ot.D : Dm), T.pdt, C.part);
      if (fd) txt(ctx, `Feeder ${fmt(fd.L)} ${L}, Ø${fmt(U.sys === 'SI' ? fd.D * 1000 : fd.D * 12)} · hf ${fmt(fd.hf)}`, SX((xs0 + xJ1) / 2), top - 8, { align: 'center', size: 11, mono: true, bg: C.bg }); stroke(ctx, [[SX((xs0 + xJ1) / 2), top], [SX((xs0 + xJ1) / 2), yc - 6]], C.muted, 1, [2, 3]);
      if (ot) txt(ctx, `Outlet ${fmt(ot.L)} ${L}, Ø${fmt(U.sys === 'SI' ? ot.D * 1000 : ot.D * 12)} · hf ${fmt(ot.hf)}`, SX((xJ2 + xe0) / 2), top - 8, { align: 'center', size: 11, mono: true, bg: C.bg }); stroke(ctx, [[SX((xJ2 + xe0) / 2), top], [SX((xJ2 + xe0) / 2), yc - 6]], C.muted, 1, [2, 3]);
      // branches
      const lead = 5;
      P.forEach((p, i) => {
        const yl = yc + (i - (n - 1) / 2) * gap, pts = [[SX(xJ1), yc], [SX(xJ1 + lead), yl], [SX(xJ2 - lead), yl], [SX(xJ2), yc]];
        const w = wOf(p.D), al = p.open ? 1 : 0.35;
        pipePath(ctx, pts, w, al);
        if (p.open) flowDots(ctx, A, 'b' + i, pts, p.v, T.pdt, C.part);
        const xv = SX(xJ1 + lead + 6);
        if (!p.open || p.K > 0) { valveSym(ctx, xv, yl, 7, !p.open); txt(ctx, p.open ? `K = ${fmt(p.K)}` : 'closed', xv + 12, yl - 14, { size: 10.5, mono: true, color: p.open ? C.ink : C.danger, bg: C.bg }); }
        txt(ctx, `Branch ${p.i}: ${fmt(p.L)} ${L}, Ø${fmt(U.sys === 'SI' ? p.D * 1000 : p.D * 12)} ${U.sys === 'SI' ? 'mm' : 'in'}`, SX((xJ1 + xJ2) / 2), yl - w / 2 - 9, { align: 'center', size: 11, bold: true, bg: C.bg });
        if (p.open) { const sh = p.Q / Qt, xa = SX((xJ1 + xJ2) / 2 + 8); arrow(ctx, xa, yl + w / 2 + 12, xa + 18 + 50 * sh, yl + w / 2 + 12, C.water_deep, 1 + 4 * sh, 6 + 3 * sh); txt(ctx, `Q${SUB[p.i]} = ${fmt(p.Q)} (${fmt(100 * sh, 3)}%) · v ${fmt(p.v)}`, xa - 6, yl + w / 2 + 12, { align: 'right', size: 11, mono: true, bg: C.bg }); }
      });
      [xJ1, xJ2].forEach((x, i) => { ctx.beginPath(); ctx.arc(SX(x), yc, 8, 0, 2 * PI); ctx.fillStyle = C.wall; ctx.fill(); txt(ctx, i ? 'J₂' : 'J₁', SX(x), yc + 20, { align: 'center', bold: true, bg: C.bg }); });
      // schematic energy grade line band
      if (S.egl) {
        const Et = (d.Hsys || d.hf) || 1, Yb = (e) => 34 + (1 - e / Et) * 58;
        let e = Et; const pts = [[SX(res ? 3 : 1), Yb(e)]];
        pts.push([SX(xs0), Yb(e)]); e -= d.hEnt || 0; pts.push([SX(xs0), Yb(e)]);
        e -= fd ? fd.hf : 0; pts.push([SX(xJ1), Yb(e)]); const e1 = e; e -= d.hf; pts.push([SX(xJ2), Yb(e)]); const e2 = e;
        e -= ot ? ot.hf : 0; pts.push([SX(xe0), Yb(e)]); e -= d.hEx || 0; pts.push([SX(xe0), Yb(e)], [SX(99), Yb(e)]);
        stroke(ctx, pts, C.egl, 2); txt(ctx, 'EGL (schematic)', SX(1), 22, { color: C.egl, bold: true, size: 11 });
        dimV(ctx, SX((xJ1 + xJ2) / 2), Yb(e1), Yb(e2), `loop hf = ${fmt(d.hf)} ${L}`);
        if (res || fd || ot) txt(ctx, `${res ? 'H between reservoirs' : 'total loss'} = ${fmt(d.Hsys)} ${L}`, SX(99), 22, { align: 'right', color: C.egl, bold: true, size: 11, mono: true });
      }
    } else if (mode === 'three') {
      const z = d.z, Pj = d.Pj, zmin = Math.min(...z), zmax = Math.max(...z), rg = Math.max(zmax - zmin, 1), zj = zmin - 0.45 * rg;
      const V = view({ x0: 0, x1: 100, y0: zj - 0.15 * rg, y1: zmax + 0.25 * rg }, W, H, { l: 20, r: 20, t: 30, b: 16 }, false), X = V.X, Y = V.Y;
      const rx = [[2, 18], [42, 58], [82, 98]], names = ['A', 'B', 'C'], jx = 50;
      const dres = 0.12 * rg;
      P.forEach((p, i) => {
        const cx = (rx[i][0] + rx[i][1]) / 2; reservoir(ctx, X(rx[i][0]), X(rx[i][1]), Y(z[i]), Y(z[i] - dres), `${names[i]}  z = ${fmt(z[i])} ${L}`);
        const pts = i === 1 ? [[X(cx), Y(z[i] - dres)], [X(jx), Y(zj)]] : [[X(i === 0 ? rx[0][1] : rx[2][0]), Y(z[i] - dres * 0.6)], [X(jx), Y(zj)]];
        const w = pipeWidth(p.D, Dmax); stroke(ctx, pts, C.pipe, w);
        flowDots(ctx, A, 't' + i, p.Q >= 0 ? pts : [pts[1], pts[0]], p.v, T.pdt, C.bg);
        const mx = (pts[0][0] + pts[1][0]) / 2, my = (pts[0][1] + pts[1][1]) / 2;
        txt(ctx, `Q${p.i} = ${fmt(Math.abs(p.Q))} ${p.Q >= 0 ? '→ J' : '→ ' + names[i]}`, mx + (i === 2 ? 10 : i === 1 ? 10 : -10), my, { align: i === 0 ? 'right' : 'left', size: 11, mono: true, bg: C.bg });
        if (S.egl) stroke(ctx, [[X(cx), Y(z[i])], [X(jx), Y(Pj)]], C.egl, 1.6);
      });
      ctx.beginPath(); ctx.arc(X(jx), Y(zj), 8, 0, 2 * PI); ctx.fillStyle = C.wall; ctx.fill(); txt(ctx, 'J', X(jx), Y(zj) + 20, { align: 'center', bold: true });
      stroke(ctx, [[X(30), Y(Pj)], [X(70), Y(Pj)]], C.egl, 1.2, [6, 4]); ctx.beginPath(); ctx.arc(X(jx), Y(Pj), 5, 0, 2 * PI); ctx.fillStyle = C.egl; ctx.fill();
      txt(ctx, `P = ${fmt(Pj)} ${L} (energy at J)`, X(jx) + 10, Y(Pj) - 10, { size: 12, mono: true, color: C.egl, bold: true, bg: C.bg });
      stroke(ctx, [[X(jx), Y(Pj)], [X(jx), Y(zj)]], C.muted, 1, [2, 3]);
    } else {
      // equivalent pipe: system on top, equivalent below
      const n = P.length, y1 = H * 0.32, y2 = H * 0.78, x0 = 40, x1 = W - 40;
      txt(ctx, d.sys === 'series' ? 'Pipes in series' : 'Pipes in parallel', x0, 22, { bold: true, size: 13 });
      if (d.sys === 'series') { let x = x0; const tot = P.reduce((s, p) => s + p.L, 0); P.forEach((p, i) => { const w = (x1 - x0) * (p.L / tot); stroke(ctx, [[x, y1], [x + w, y1]], C.pipe, pipeWidth(p.D, Dmax)); txt(ctx, `${p.i}: ${fmt(p.L)} ${L}, k = ${fmt(p.k)}`, x + w / 2, y1 - 16, { align: 'center', size: 11, mono: true }); flowDots(ctx, A, 's' + i, [[x, y1], [x + w, y1]], p.v, T.pdt, C.bg); x += w; }); }
      else P.forEach((p, i) => { const yo = y1 + (i - (n - 1) / 2) * 34, pts = [[x0, y1], [x0 + 40, yo], [x1 - 40, yo], [x1, y1]]; stroke(ctx, pts, C.pipe, pipeWidth(p.D, Dmax)); flowDots(ctx, A, 'q' + i, pts, p.v, T.pdt, C.bg); txt(ctx, `${p.i}: k = ${fmt(p.k)}`, x0 + 60, yo - 12, { size: 11, mono: true }); });
      txt(ctx, '≡  same hf at the same Q', W / 2, (y1 + y2) / 2 + 6, { align: 'center', bold: true, size: 14, color: C.egl });
      stroke(ctx, [[x0, y2], [x1, y2]], C.pipe, pipeWidth(d.De, Math.max(Dmax, d.De)));
      flowDots(ctx, A, 'eq', [[x0, y2], [x1, y2]], d.Q / ((PI * d.De * d.De) / 4), T.pdt, C.bg);
      txt(ctx, `Equivalent pipe: L_e = ${fmt(d.Le)} ${L},  D_e = ${fmt(U.sys === 'SI' ? d.De * 1000 : d.De * 12)} ${U.sys === 'SI' ? 'mm' : 'in'},  k_eq = ${fmt(d.keq)}`, W / 2, y2 - 20, { align: 'center', size: 12, mono: true });
    }
  };
  M2.drawAux = function (ctx, W, H, R) {
    const d = R.data, U = S.U; ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    if (d.mode === 'three') {
      const z = d.z, ps = [], qs = []; const a = Math.min(...z), b = Math.max(...z);
      for (let i = 0; i <= 120; i++) { const Pe = a + ((b - a) * i) / 120; ps.push(Pe); qs.push(d.pipes.reduce((s, p, j) => s + Math.sign(z[j] - Pe) * Math.pow(Math.abs(z[j] - Pe) / p.k, 1 / p.m), 0)); }
      plot(ctx, { x: 0, y: 0, w: W, h: H }, { title: 'Net flow into the junction ΣQ vs assumed P (root gives P)', xs: ps, series: [{ ys: qs, color: C.hgl }], xlab: `P (${U.L})`, ymin: Math.min(...qs), ymax: Math.max(...qs), hmarks: [{ y: 0, label: 'ΣQ = 0' }], pts: [{ x: d.Pj, y: 0, color: C.egl, label: `P = ${fmt(d.Pj)}` }] });
      return;
    }
    let items;
    if (d.mode === 'parallel') items = d.pipes.map((p) => [`Q${p.i}`, p.Q, C.water_deep]);
    else if (d.mode === 'equiv') items = d.pipes.map((p) => [`k${p.i}`, p.k, C.water_deep]).concat([['k_eq', d.keq, C.egl]]);
    else { items = []; d.events.filter((e) => e.label === 'entrance' && e.dh > 0).forEach((e) => items.push(['entrance', e.dh, C.hgl])); d.pipes.forEach((p, i) => { items.push([`hf${p.i}`, p.hf, C.water_deep]); const tr = d.events.find((e) => e.at === i + 1 && e.label === 'transition'); if (tr && tr.dh > 0) items.push([`trans ${p.i}→${p.i + 1}`, tr.dh, C.hgl]); }); const fit = d.events.find((e) => e.label === 'bends/valves'); if (fit) items.push(['fittings', fit.dh, C.hgl]); const ex = d.events.find((e) => e.label === 'exit' || e.label === 'outlet v²/2g'); if (ex && ex.dh > 0) items.push([ex.label === 'exit' ? 'exit' : 'jet v²/2g', ex.dh, C.egl]); }
    const title = d.mode === 'parallel' ? `Flow split (${U.Q})` : d.mode === 'equiv' ? 'Pipe constants k (hf = kQ^m)' : `Head loss breakdown (${U.L})`;
    txt(ctx, title, 52, 12, { bold: true });
    const mx = Math.max(...items.map((it) => it[1]), 1e-12), bw = Math.min(80, (W - 80) / items.length - 10), y0 = H - 30, hh = H - 70;
    items.forEach((it, i) => { const x = 60 + i * (bw + 10), h = (hh * it[1]) / mx; ctx.fillStyle = it[2]; ctx.globalAlpha = 0.8; ctx.fillRect(x, y0 - h, bw, h); ctx.globalAlpha = 1; txt(ctx, fmt(it[1]), x + bw / 2, y0 - h - 9, { align: 'center', size: 11, mono: true }); txt(ctx, it[0], x + bw / 2, y0 + 12, { align: 'center', size: 11 }); });
    stroke(ctx, [[50, y0], [W - 10, y0]], C.muted, 1);
  };
  M2.hint = 'Pipe thickness is drawn in proportion to D. EGL is solid, HGL is dashed. Gauges show the pressure at every joint; red shading means pressure below atmospheric.';

  /* ---------------------------------------------------------------- M3 */
  const M3 = {
    id: 'jump', tab: 'Specific Energy & Jump', title: 'Specific Energy and Hydraulic Jump', fn: 'specific',
    modes: [['curve', 'Specific energy curve'], ['jump', 'Hydraulic jump'], ['gate', 'Sluice gate + jump']], speed: {},
    params: [
      { k: 'shape', type: 'select', label: 'Channel shape', def: 'rect', options: [['rect', 'Rectangular'], ['trap', 'Trapezoidal'], ['tri', 'Triangular'], ['circ', 'Circular'], ['semi', 'Semicircular']], modes: ['curve'], onSet: (P) => { if ((P.shape === 'tri' || P.shape === 'trap') && !(P.z > 0)) P.z = 1; if (P.shape === 'semi' && P.y > P.Dc / 2) P.y = +(0.3 * P.Dc).toFixed(3); } },
      { k: 'b', label: 'Width b (bottom width)', dim: 'len', min: 0.1, max: 50, step: 0.01, def: 3, show: (P, m) => m !== 'curve' || P.shape === 'rect' || P.shape === 'trap' },
      { k: 'z', label: 'Side slope z (H:V)', dim: 'hv', min: 0, max: 4, step: 0.01, def: 0, show: (P, m) => m === 'curve' && (P.shape === 'trap' || P.shape === 'tri') },
      { k: 'Dc', label: 'Conduit diameter D', labelFn: (P) => (P.shape === 'semi' ? 'Diameter D (= 2r, top width when full)' : 'Conduit diameter D'), dim: 'len', min: 0.1, max: 10, step: 0.01, def: 2, show: (P, m) => m === 'curve' && (P.shape === 'circ' || P.shape === 'semi') },
      { k: 'qmode', type: 'select', label: 'Flow given as', def: 'q', options: [['q', 'Unit discharge q'], ['Q', 'Discharge Q']], show: (P, m) => m !== 'curve' || P.shape === 'rect' },
      { k: 'q', label: 'Unit discharge q', dim: 'q', min: 0.01, max: 200, step: 0.01, def: 3, log: true, show: (P, m) => (m !== 'curve' || P.shape === 'rect') && P.qmode === 'q' },
      { k: 'Q', label: 'Discharge Q', dim: 'Q', min: 0.01, max: 200, step: 0.01, def: 9, log: true, show: (P, m) => !((m !== 'curve' || P.shape === 'rect') && P.qmode === 'q') },
      { k: 'y', label: 'Depth y', labelFn: (P, m) => (m === 'jump' ? 'Upstream depth y₁' : 'Depth y'), dim: 'len', min: 0.01, max: 10, step: 0.001, def: 0.5, modes: ['curve', 'jump'] },
      { k: 'dz', label: 'Step rise Δz', dim: 'len', min: -2, max: 2, step: 0.01, def: 0, modes: ['curve'] },
      { k: 'b2', label: 'Width after contraction b₂', dim: 'len', min: 0.1, max: 50, step: 0.01, def: 3, show: (P, m) => m === 'curve' && (P.shape === 'rect' || P.shape === 'trap') },
      { k: 'a', label: 'Gate opening a', dim: 'len', min: 0.05, max: 5, step: 0.01, def: 0.6, modes: ['gate'] },
      { k: 'Cc', label: 'Contraction coefficient Cc', min: 0.55, max: 0.75, step: 0.001, def: 0.61, modes: ['gate'] }
    ],
    presets: [
      { name: 'Test 6 — jump: q = 3 m²/s, y₁ = 0.5 m', mode: 'jump', set: { q: 3, y: 0.5, qmode: 'q' } },
      { name: 'Sluice gate: q = 3 m²/s, a = 0.6 m, Cc = 0.61', mode: 'gate', set: { q: 3, a: 0.6, Cc: 0.61 } },
      { name: 'Subcritical flow over a 0.2 m step (q = 3, y = 2)', mode: 'curve', set: { shape: 'rect', q: 3, y: 2, dz: 0.2 } },
      { name: 'Step of 0.6 m, just under choking (q = 3, y = 2, Δz_max = 0.657 m)', mode: 'curve', set: { shape: 'rect', q: 3, y: 2, dz: 0.6 } },
      { name: 'Choking at a 0.8 m step (q = 3, y = 2): critical depth over the step', mode: 'curve', set: { shape: 'rect', q: 3, y: 2, dz: 0.8 } },
      { name: 'Trapezoidal channel, Q = 9 m³/s, z = 1', mode: 'curve', set: { shape: 'trap', qmode: 'Q', Q: 9, z: 1, y: 1 } },
      { name: 'Semicircular channel D = 3 m (r = 1.5 m), Q = 4 m³/s, y = 1.2 m', mode: 'curve', set: { shape: 'semi', qmode: 'Q', Q: 4, Dc: 3, y: 1.2 } }
    ]
  };
  MODS.push(M3);
  function m3Profile(R) {
    const d = R.data, mode = d.mode;
    const sec = (y) => (d.shape === 'rect' ? d.G.b * y : HP.section(d.shape, d.G, y).A);
    if (mode === 'curve') {
      const st = d.step; const y1 = st ? st.y1n : d.y, y2 = st ? st.y2 : d.y, dz = st ? st.dz : 0;
      return { kind: 'curve', y1, y2, dz, X: Math.max(14 * Math.max(d.E, y1, y2), 1), A: sec, choke: st && st.choke, yc2: st && st.yc2, contr: st && Math.abs(st.b2 - d.G.b) > 1e-9 };
    }
    const Lj = d.Lj, y1 = d.y1, y2 = d.y2;
    if (mode === 'jump') { const X = Math.max(Lj * 2.6, 8 * y2); return { kind: 'jump', y1, y2, Lj, xj: 0.3 * X, X, A: sec }; }
    const a = d.a, X = (4 * a + 1.9 * Lj + 2 * y2) / 0.8; const xg = 0.18 * X;
    return { kind: 'gate', y0: d.y0, y1, y2, a, Lj, xg, xj: xg + Math.max(4 * a, 0.08 * X), X, A: sec };
  }
  function m3Depth(G, x, t) {
    if (G.kind === 'curve') { const u = sstep((x - 0.46 * G.X) / (0.08 * G.X)); return { bed: G.dz * u, y: lerp(G.y1, G.y2, u) }; }
    if (G.kind === 'jump' || x > G.xg + 0.0001) {
      let y;
      if (G.kind === 'gate' && x < G.xj) y = G.y1 + (G.a - G.y1) * Math.exp(-(x - G.xg) / (0.35 * G.a));
      else if (x < G.xj) y = G.y1;
      else { const s = (x - G.xj) / G.Lj; y = s > 1 ? G.y2 : G.y1 + (G.y2 - G.y1) * (1 - Math.pow(1 - s, 2.4)); if (s > 0 && s < 0.6) y += (G.y2 - G.y1) * 0.06 * Math.sin(x * 9 / G.Lj + t * 7) * Math.sin(PI * s / 0.6); }
      return { bed: 0, y };
    }
    return { bed: 0, y: G.y0 };
  }
  M3.draw = function (ctx, W, H, R, A, T) {
    const d = R.data, U = S.U, L = U.L;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const G0 = m3Profile(R); const G = {}; for (const k in G0) G[k] = typeof G0[k] === 'number' ? sm(A, 'g' + k, G0[k], T.rdt, 6) : G0[k];
    const t = A.clock = (A.clock || 0) + T.pdt;
    const ymax = Math.max(G.y0 || 0, G.y1, G.y2, (G.dz || 0) + G.y2) * 1.25 + (S.egl ? 0.25 * (d.E || d.E1 || 1) : 0);
    const eTop = S.egl ? Math.max(d.E || 0, d.E1 || 0, (d.E || 0)) : 0;
    const yTop = Math.max(ymax, eTop * 1.1);
    const padL = 24, padR = 20, ph = H - 60;
    const sx = (W - padL - padR) / G.X, sy = Math.min(ph / yTop, sx * 12);
    const X = (x) => padL + x * sx, Yb = H - 26 - Math.max(0, -(G.dz || 0)) * sy, Y = (y) => Yb - y * sy;
    // water
    const N = 160, top = [], bot = [];
    for (let i = 0; i <= N; i++) { const x = (G.X * i) / N, p = m3Depth(G, x, t); top.push([X(x), Y(p.bed + p.y)]); bot.push([X(x), Y(p.bed)]); }
    ctx.beginPath(); top.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); for (let i = N; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]); ctx.closePath(); ctx.fillStyle = C.water; ctx.globalAlpha = 0.33; ctx.fill(); ctx.globalAlpha = 1;
    stroke(ctx, top, C.water_deep, 1.6);
    // bed
    ctx.beginPath(); bot.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.lineTo(X(G.X), H); ctx.lineTo(X(0), H); ctx.closePath(); ctx.fillStyle = C.soil; ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1; stroke(ctx, bot, C.wall, 2);
    // energy line
    if (S.egl) {
      const pts = []; for (let i = 0; i <= N; i++) { const x = (G.X * i) / N, p = m3Depth(G, x, 0), A_ = G.A(Math.max(p.y, 1e-4)), v = d.Q / A_; pts.push([X(x), Y(p.bed + p.y + (v * v) / (2 * U.g))]); }
      if (G.kind !== 'curve') for (let i = 0; i <= N; i++) { const x = (G.X * i) / N; if (x > G.xj && x < G.xj + G.Lj) { const s = (x - G.xj) / G.Lj; pts[i][1] = lerp(Y(d.E1), Y(d.E2), sstep(s)); } }
      stroke(ctx, pts, C.egl, 1.6, [8, 5]); txt(ctx, 'EGL', pts[2][0], pts[2][1] - 10, { color: C.egl, bold: true, size: 12 });
    }
    // gate
    if (G.kind === 'gate') { ctx.fillStyle = C.wall; ctx.fillRect(X(G.xg) - 4, Y(yTop * 0.98), 8, Y(G.a) - Y(yTop * 0.98)); txt(ctx, 'gate', X(G.xg) + 8, Y(yTop * 0.9), { size: 11, color: C.muted }); dimV(ctx, X(G.xg) + 14, Y(0), Y(G.a), `a = ${fmt(d.a)}`); dimV(ctx, X(G.xg * 0.4), Y(0), Y(G.y0), `y₀ = ${fmt(d.y0)} ${L}`); surfSym(ctx, X(G.xg * 0.6), Y(G.y0)); }
    // particles
    A.parts = A.parts || []; const dt = T.pdt;
    const umax = d.Q / G.A(Math.max(1e-4, Math.min(G.y1, G.y2)));
    const vis = sm(A, 'vis', clamp(170 / (umax * sx), 1, 30), T.rdt, 3);
    while (A.parts.length < 360) A.parts.push({ x: rnd() * G.X, s: rnd(), ph: rnd() * 6.28 });
    ctx.lineCap = 'round';
    for (const p of A.parts) {
      const dp = m3Depth(G, p.x, t); const u = d.Q / G.A(Math.max(dp.y, 1e-4));
      let ue = u * (0.75 + 0.35 * Math.pow(p.s, 0.3));
      const inRoller = G.kind !== 'curve' && p.x > G.xj && p.x < G.xj + 0.6 * G.Lj;
      if (inRoller && p.s > 0.35) { ue = u * (1 - 2.6 * (p.s - 0.35) / 0.65); p.s = clamp(p.s + (Math.sin(p.ph + t * 5) * 1.2 + (rnd() - 0.5) * 3) * dt, 0.02, 0.99); }
      if (G.kind === 'gate' && p.x < G.xg && p.x > G.xg - 3 * G.y0) p.s = lerp(p.s, Math.min(p.s, (G.a / G.y0) * 0.95), dt * 2);
      p.x += ue * vis * dt;
      if (p.x > G.X) { p.x = 0; p.s = rnd(); } if (p.x < 0) p.x = G.X;
      const sx_ = X(p.x), sy_ = Y(dp.bed + p.s * dp.y * 0.97);
      const len = clamp(ue * vis * sx * 0.06, -10, 18);
      ctx.strokeStyle = C.part; ctx.globalAlpha = 0.75; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(sx_ - len, sy_); ctx.lineTo(sx_ + 0.5, sy_); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.lineCap = 'butt';
    // foam in the roller
    if (G.kind !== 'curve') { ctx.fillStyle = C.foam; for (let i = 0; i < 70; i++) { const x = G.xj + rnd() * 0.6 * G.Lj, p = m3Depth(G, x, t); ctx.globalAlpha = 0.5 + rnd() * 0.5; ctx.beginPath(); ctx.arc(X(x), Y(p.y) + rnd() * 8, 1 + rnd() * 2, 0, 2 * PI); ctx.fill(); } ctx.globalAlpha = 1; }
    // annotations
    if (G.kind === 'curve') {
      dimV(ctx, X(0.12 * G.X), Y(0), Y(G.y1), `y${d.step ? '₁' : ''} = ${fmt(G0.y1)} ${L}`); surfSym(ctx, X(0.2 * G.X), Y(G.y1));
      if (d.step) { dimV(ctx, X(0.8 * G.X), Y(G.dz), Y(G.dz + G.y2), `y₂ = ${fmt(G0.y2)} ${L}`); if (Math.abs(G.dz) > 1e-6) dimV(ctx, X(0.62 * G.X), Y(0), Y(G.dz), `Δz = ${fmt(d.step.dz)}`); if (G.contr) txt(ctx, `width contracts ${fmt(d.G.b)} → ${fmt(d.step.b2)} ${L} (plan view)`, X(0.5 * G.X), 18, { align: 'center', size: 11, color: C.muted }); if (G.choke) txt(ctx, 'CHOKED — critical depth at the transition', X(0.5 * G.X), 36, { align: 'center', bold: true, color: C.danger }); }
      txt(ctx, `F = ${fmt(d.Fr)} (${d.Fr < 1 ? 'subcritical' : 'supercritical'})   v = ${fmt(d.v)} ${U.v}`, padL, 18, { size: 12, mono: true });
      arrow(ctx, X(0.03 * G.X), Y(G.y1 * 0.5), X(0.03 * G.X) + 40, Y(G.y1 * 0.5), C.ink, 1.5);
    } else {
      dimV(ctx, X(G.xj - 0.06 * G.X), Y(0), Y(G.y1), `y₁ = ${fmt(d.y1)} ${L}`, null, 'left');
      dimV(ctx, X(Math.min(G.X * 0.97, G.xj + G.Lj * 1.15)), Y(0), Y(G.y2), `y₂ = ${fmt(d.y2)} ${L}`, null, 'left');
      surfSym(ctx, X(Math.min(G.X * 0.94, G.xj + G.Lj * 1.25)), Y(G.y2));
      dimH(ctx, X(G.xj), X(G.xj + G.Lj), Y(G.y2) - 26, `L ≈ ${fmt(d.Lj)} ${L}`);
      txt(ctx, 'roller', X(G.xj + 0.3 * G.Lj), Y(G.y2) - 48, { align: 'center', size: 11, color: C.muted });
      txt(ctx, `F₁ = ${fmt(d.F1)}  v₁ = ${fmt(d.v1)} ${U.v}  →  v₂ = ${fmt(d.v2)} ${U.v}   ΔE = ${fmt(d.dE)} ${L}`, padL, 18, { size: 12, mono: true });
    }
    velScale(ctx, W - 210, 44, vis * sx, U.v);
  };
  M3.drawAux = function (ctx, W, H, R, A) {
    const d = R.data, U = S.U, L = U.L, g = U.g; ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const two = d.mode !== 'curve', w = two ? W * 0.55 : W;
    const Ef = HP.Efun(d.shape, d.G, d.Q, g);
    const yA = [d.y, d.y1, d.y2, d.y0, d.other, d.yc].filter((v) => isFinite(v));
    const ymaxP = Math.max(...yA, d.yc * 2.4) * 1.15;
    const ys = [], Es = []; for (let i = 0; i <= 260; i++) { const y = d.yc * 0.12 + ((ymaxP - d.yc * 0.12) * i) / 260; ys.push(y); Es.push(Ef(y)); }
    const Emax = Math.max(ymaxP * 1.05, (d.E || d.E1 || 0) * 1.15);
    // plot with E on x and y on y: draw manually using plot() with swapped arrays
    const series = [{ xs: Es, ys, color: C.water_deep, w: 2.2 }, { xs: [0, Emax], ys: [0, Emax], color: C.muted, dash: [5, 4], w: 1 }];
    const pts = [{ x: d.Emin, y: d.yc, color: C.ok, label: `y_c = ${fmt(d.yc)}` }];
    if (d.mode === 'curve') { pts.push({ x: d.E, y: d.y, color: C.egl, r: 7, label: `y = ${fmt(d.y)}` }, { x: d.E, y: d.other, color: C.hgl, label: `alt ${fmt(d.other)}` }); if (d.step) { const st = d.step; if (Math.abs(st.b2 - d.G.b) > 1e-9) { const E2f = HP.Efun(d.shape, { b: st.b2, z: d.G.z, D: d.G.D }, d.Q, g); const e2 = ys.map(E2f); series.push({ xs: e2, ys, color: C.water_deep, dash: [3, 3], w: 1.5 }); } pts.push({ x: st.choke ? st.Emin2 : st.E2, y: st.y2, color: C.danger, label: `y₂ = ${fmt(st.y2)}` }); } }
    else { pts.push({ x: d.E1, y: d.y1, color: C.egl, r: 7, label: `y₁` }, { x: d.E2, y: d.y2, color: C.hgl, r: 6, label: `y₂` }); }
    const vm = d.mode === 'curve' && d.step ? [{ x: d.step.E2, label: 'E₂', color: C.danger }] : d.mode !== 'curve' ? [{ x: d.E1, label: 'E₁', color: C.egl }, { x: d.E2, label: 'E₂', color: C.hgl }] : [];
    const pr = plot(ctx, { x: 0, y: 0, w, h: H }, { title: 'Specific energy diagram (drag the orange dot)', xs: Es, series, xmin: 0, xmax: Emax, ymin: 0, ymax: ymaxP, xlab: `E (${L})`, pts, vmarks: vm });
    A.ey = { pr, w };
    txt(ctx, `y (${L})`, 6, 26, { size: 11, color: C.muted });
    if (two) {
      const q = d.q, M = (y) => (q * q) / (g * y) + (y * y) / 2;
      const Ms = ys.map(M); const Mx = Math.max(d.M1 * 1.8, M(ymaxP));
      plot(ctx, { x: w, y: 0, w: W - w, h: H }, { title: 'Momentum function M = q²/(gy) + y²/2', xs: Ms, series: [{ xs: Ms, ys, color: C.water_deep, w: 2.2 }, { xs: [d.M1, d.M1], ys: [d.y1, d.y2], color: C.egl, dash: [4, 3], w: 1.5 }], xmin: 0, xmax: Mx, ymin: 0, ymax: ymaxP, xlab: `M (${L}²)`, pts: [{ x: d.M1, y: d.y1, color: C.egl, label: 'y₁' }, { x: d.M2, y: d.y2, color: C.hgl, label: 'y₂  (M₁ = M₂)' }] });
    }
  };
  M3.onAuxPointer = function (x, y, A, type) {
    const m = S.mode[M3.id]; if (m === 'gate' || !A.ey) return false;
    const pr = A.ey.pr; if (x > A.ey.w) return false;
    if (type === 'down' && !(x >= pr.x0 && x <= pr.x1 && y >= pr.y1 && y <= pr.y0)) return false;
    const yv = pr.ymin + ((pr.y0 - y) / (pr.y0 - pr.y1)) * (pr.ymax - pr.ymin);
    const prm = M3.params.find((q) => q.k === 'y'); setParam(M3, 'y', clamp(fromDisp(prm, yv), 0.01, 10)); return true;
  };
  M3.hint = 'Drag the orange dot on the E–y diagram to change the depth. Streak length shows speed.';

  /* ---------------------------------------------------------------- M4 */
  const M4 = {
    id: 'energy', tab: 'Pumps & Siphons', title: 'Energy Equation with Pumps, Turbines and Siphons', fn: 'energy',
    modes: [['pump', 'Pipe with a pump'], ['turbine', 'Pipe with a turbine'], ['siphon', 'Siphon'], ['nozzle', 'Nozzle at the end of a pipe']], speed: {},
    modeDefaults: { pump: { z1: 0, z2: 30, zp: 1, L1: 50, L2: 50 }, turbine: { z1: 100, z2: 20, zp: 25, L1: 500, L2: 50, D1: 300, Q: 0.15 }, siphon: { z1: 10, z2: 0, zs: 14, L1: 20, L2: 40, D1: 150 }, nozzle: { z1: 60, z2: 0, L1: 300, D1: 200, dn: 75 } },
    params: [
      { k: 'z1', label: 'Elevation z₁ (supply surface)', dim: 'len', min: -50, max: 500, step: 0.01, def: 0 },
      { k: 'z2', label: 'Elevation z₂', labelFn: (P, m) => (m === 'nozzle' ? 'Nozzle elevation z₂' : 'Elevation z₂ (receiving surface)'), dim: 'len', min: -50, max: 500, step: 0.01, def: 30 },
      { k: 'zs', label: 'Summit elevation z_s', dim: 'len', min: -50, max: 500, step: 0.01, def: 14, modes: ['siphon'] },
      { k: 'zp', label: 'Machine elevation z_p', dim: 'len', min: -50, max: 500, step: 0.01, def: 1, modes: ['pump', 'turbine'] },
      { k: 'p1', label: 'Pressure p₁ (gauge, closed tank)', dim: 'kPa', min: -100, max: 2000, step: 0.1, def: 0, modes: ['pump', 'turbine', 'nozzle'] },
      { k: 'p2', label: 'Pressure p₂ (gauge, closed tank)', dim: 'kPa', min: -100, max: 2000, step: 0.1, def: 0, modes: ['pump', 'turbine'] },
      { k: 'L1', label: 'Pipe 1 length L₁', labelFn: (P, m) => (m === 'siphon' ? 'Length inlet → summit L₁' : m === 'nozzle' ? 'Pipe length L' : 'Suction pipe length L₁'), dim: 'len', min: 1, max: 10000, step: 1, def: 50, log: true },
      { k: 'D1', label: 'Pipe 1 diameter D₁', labelFn: (P, m) => (m === 'siphon' || m === 'nozzle' ? 'Pipe diameter D' : 'Suction pipe diameter D₁'), dim: 'mm', min: 25, max: 2000, step: 1, def: 300 },
      { k: 'f1', label: 'Pipe 1 friction f₁', labelFn: (P, m) => (m === 'siphon' || m === 'nozzle' ? 'Friction factor f' : 'Suction pipe f₁'), min: 0.008, max: 0.08, step: 0.0001, def: 0.02 },
      { k: 'L2', label: 'Discharge pipe length L₂', labelFn: (P, m) => (m === 'siphon' ? 'Length summit → outlet L₂' : 'Discharge pipe length L₂'), dim: 'len', min: 1, max: 10000, step: 1, def: 50, log: true, modes: ['pump', 'turbine', 'siphon'] },
      { k: 'D2', label: 'Discharge pipe diameter D₂', dim: 'mm', min: 25, max: 2000, step: 1, def: 300, modes: ['pump', 'turbine'] },
      { k: 'f2', label: 'Discharge pipe f₂', min: 0.008, max: 0.08, step: 0.0001, def: 0.02, modes: ['pump', 'turbine'] },
      { k: 'friction', type: 'check', label: 'Include pipe losses', def: true, modes: ['pump', 'turbine'] },
      { k: 'Kent', label: 'Entrance loss K_ent', min: 0, max: 10, step: 0.01, def: 0.5 },
      { k: 'Kexit', label: 'Exit loss K_exit', min: 0, max: 10, step: 0.01, def: 1, modes: ['pump', 'turbine', 'siphon'] },
      { k: 'Q', label: 'Flow Q', dim: 'Q', min: 0.001, max: 5, step: 0.001, def: 0.05, log: true, modes: ['pump', 'turbine'] },
      { k: 'eta', label: 'Efficiency η', min: 0.3, max: 1, step: 0.01, def: 0.75, modes: ['pump', 'turbine'] },
      { k: 'Sg', label: 'Liquid specific gravity Sg', min: 0.5, max: 13.6, step: 0.01, def: 1, chips: SG_CHIPS },
      { k: 'patm', label: 'Atmospheric pressure', dim: 'kPa', min: 80, max: 105, step: 0.001, def: 101.325, modes: ['pump', 'siphon'] },
      { k: 'pvap', label: 'Vapor pressure', dim: 'kPa', min: 0, max: 50, step: 0.01, def: 2.34, modes: ['pump', 'siphon'] },
      { k: 'dn', label: 'Nozzle tip diameter', dim: 'mm', min: 10, max: 500, step: 1, def: 75, modes: ['nozzle'] },
      { k: 'Cvn', label: 'Nozzle Cv', min: 0.9, max: 1, step: 0.001, def: 0.97, modes: ['nozzle'] }
    ],
    presets: [
      { name: 'Test 7 — pump: Q = 0.05, H_A = 30 m, η = 0.75 (no losses)', mode: 'pump', set: { z1: 0, z2: 30, Q: 0.05, eta: 0.75, friction: false } },
      { name: 'Pump with losses, 50 m + 50 m of 300 mm pipe', mode: 'pump', set: { z1: 0, z2: 30, zp: 1, Q: 0.05, eta: 0.75 } },
      { name: 'Turbine: 80 m drop, Q = 0.15', mode: 'turbine', set: { z1: 100, z2: 20, zp: 25, L1: 500, L2: 50, Q: 0.15, eta: 0.85 } },
      { name: 'Siphon, summit 4 m above supply', mode: 'siphon', set: { z1: 10, z2: 0, zs: 14, L1: 20, L2: 40, D1: 150 } },
      { name: 'Siphon that cavitates (summit 9 m above supply)', mode: 'siphon', set: { z1: 10, z2: 0, zs: 19, L1: 20, L2: 40, D1: 150 } },
      { name: 'Nozzle: 60 m head, 300 m of 200 mm pipe, 75 mm tip', mode: 'nozzle', set: { z1: 60, z2: 0, L1: 300, D1: 200, dn: 75 } }
    ]
  };
  MODS.push(M4);
  // geometry of the energy profile (shared by drawing and point-pressure clicks)
  function m4Geom(R, I) {
    const d = R.data, mode = d.mode, g = d.g;
    const hv = (v) => (v * v) / (2 * g);
    const zs = [I.z1, I.z2]; if (mode === 'siphon') zs.push(I.zs); if (mode === 'pump' || mode === 'turbine') zs.push(I.zp);
    const lo = Math.min(...zs), hi = Math.max(...zs), rg = Math.max(hi - lo, 2), dres = 0.12 * rg;
    const pipes = [];
    if (mode === 'pump' || mode === 'turbine') {
      const E0 = I.z1 + d.p1h, Ea = E0 - d.Kent * hv(d.v1), Eb = E0 - d.HL1, Ec = Eb + (mode === 'pump' ? d.HA : -d.HE), Ed = Ec - (d.HL2 - d.Kexit * hv(d.v2));
      pipes.push({ pts: [[22, I.z1 - 0.7 * dres], [46, I.zp]], v: d.v1, D: I.D1, E: [Ea, Eb] }, { pts: [[46, I.zp], [78, I.z2 - 0.7 * dres]], v: d.v2, D: I.D2, E: [Ec, Ed] });
    } else if (mode === 'siphon') {
      const E0 = I.z1, Ea = E0 - d.Kent * hv(d.v1), Eb = E0 - d.HL1, Ec = I.z2 + d.Kexit * hv(d.v1);
      pipes.push({ pts: [[22, I.z1 - 0.6 * dres], [32, I.zs], [40, I.zs]], v: d.v1, D: I.D1, E: [Ea, Eb] }, { pts: [[40, I.zs], [48, I.zs], [78, I.z2 - 0.6 * dres]], v: d.v1, D: I.D1, E: [Eb, Ec] });
    } else {
      const E0 = I.z1 + d.p1h, Ea = E0 - d.Kent * hv(d.v1), Eb = E0 - d.HL1;
      pipes.push({ pts: [[22, I.z1 - 0.6 * dres], [68, I.z2]], v: d.v1, D: I.D1, E: [Ea, Eb] });
    }
    pipes.forEach((p) => { let tot = 0; p.seg = []; for (let i = 1; i < p.pts.length; i++) { const l = Math.hypot(p.pts[i][0] - p.pts[i - 1][0], (p.pts[i][1] - p.pts[i - 1][1]) * 0.1); p.seg.push(l); tot += l; } p.tot = tot; });
    const at = (p, s) => { let r = s * p.tot, i = 0; while (i < p.seg.length - 1 && r > p.seg[i]) { r -= p.seg[i]; i++; } const t = clamp(r / p.seg[i], 0, 1); return [lerp(p.pts[i][0], p.pts[i + 1][0], t), lerp(p.pts[i][1], p.pts[i + 1][1], t)]; };
    const egl = (p, s) => lerp(p.E[0], p.E[1], s);
    const Es = [I.z1 + (d.p1h || 0), I.z2 + (d.p2h || 0)]; pipes.forEach((p) => Es.push(p.E[0], p.E[1], p.E[0] - hv(p.v), p.E[1] - hv(p.v)));
    if (mode === 'nozzle') Es.push(I.z2 + hv(d.vj));
    return { pipes, at, egl, hv, lo: Math.min(lo - dres, ...Es), hi: Math.max(hi, ...Es), dres };
  }
  M4.post = function (R, I) {
    if (R.invalid || !S.click) return;
    const G = m4Geom(R, I); const p = G.pipes[S.click.pipe]; if (!p) return;
    const pos = G.at(p, S.click.s), E = G.egl(p, S.click.s), pp = HP.pointPressure(E, pos[1], p.v, R.data.gam, S.U.g);
    R.steps.push({ t: 'Pressure at the clicked point', f: 'p/γ = EGL − z − v²/(2g)', s: `p/γ = ${fmt(E)} − ${fmt(pos[1])} − ${fmt(pp.hv)}`, r: `${fmt(pp.ph)} ${S.U.L} → p = ${fmt(pp.p)} ${S.U.p}`, n: 'Energy equation from point 1 to the clicked point.' });
    R.results.push({ label: 'Clicked point: elevation z', value: pos[1], unit: S.U.L }, { label: 'Clicked point: pressure p', value: pp.p, unit: S.U.p, em: true }, { label: 'Clicked point: pressure head', value: pp.ph, unit: S.U.L });
    S.clickInfo = { z: pos[1], ph: pp.ph, hv: pp.hv };
  };
  M4.draw = function (ctx, W, H, R, A, T) {
    const d = R.data, I = S.I, U = S.U, L = U.L, mode = d.mode;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const G = m4Geom(R, I); const rg = G.hi - G.lo;
    const V = view({ x0: 0, x1: 100, y0: G.lo - 0.08 * rg, y1: G.hi + 0.14 * rg }, W, H, { l: 16, r: 16, t: 24, b: 16 }, false), X = V.X, Y = V.Y;
    A.view = V; A.geom = G;
    reservoir(ctx, X(2), X(22), Y(I.z1), Y(I.z1 - G.dres), `1  z₁ = ${fmt(I.z1)} ${L}`);
    if (mode !== 'nozzle') reservoir(ctx, X(78), X(98), Y(I.z2), Y(I.z2 - G.dres), `2  z₂ = ${fmt(I.z2)} ${L}`);
    if (d.p1h) txt(ctx, `p₁ = ${fmt(I.p1)} ${U.p}`, X(12), Y(I.z1) + 14, { align: 'center', size: 11, mono: true });
    if (d.p2h) txt(ctx, `p₂ = ${fmt(I.p2)} ${U.p}`, X(88), Y(I.z2) + 14, { align: 'center', size: 11, mono: true });
    const Dm = Math.max(I.D1, I.D2 || 0);
    // negative pressure shading
    G.pipes.forEach((p) => {
      const N = 60; for (let i = 0; i < N; i++) {
        const s0 = i / N, s1 = (i + 1) / N, a = G.at(p, s0), b = G.at(p, s1), h0 = G.egl(p, s0) - G.hv(p.v), h1 = G.egl(p, s1) - G.hv(p.v);
        if (h0 < a[1] || h1 < b[1]) { ctx.beginPath(); ctx.moveTo(X(a[0]), Y(a[1])); ctx.lineTo(X(b[0]), Y(b[1])); ctx.lineTo(X(b[0]), Y(Math.min(h1, b[1]))); ctx.lineTo(X(a[0]), Y(Math.min(h0, a[1]))); ctx.closePath(); ctx.fillStyle = C.danger; ctx.globalAlpha = 0.18; ctx.fill(); ctx.globalAlpha = 1; }
      }
    });
    G.pipes.forEach((p, i) => { const pts = p.pts.map((q) => [X(q[0]), Y(q[1])]); ctx.lineJoin = 'round'; stroke(ctx, pts, C.pipe, pipeWidth(p.D, Dm)); ctx.lineJoin = 'miter'; flowDots(ctx, A, 'e' + i, pts, p.v, T.pdt, C.bg); });
    if (mode === 'pump' || mode === 'turbine') {
      const x = X(46), y = Y(I.zp); ctx.beginPath(); ctx.arc(x, y, 14, 0, 2 * PI); ctx.fillStyle = C.bg; ctx.fill(); ctx.strokeStyle = C.wall; ctx.lineWidth = 2.5; ctx.stroke();
      if (mode === 'pump') { ctx.beginPath(); ctx.moveTo(x - 6, y + 7); ctx.lineTo(x + 8, y); ctx.lineTo(x - 6, y - 7); ctx.closePath(); ctx.fillStyle = C.wall; ctx.fill(); }
      else { ctx.save(); ctx.translate(x, y); ctx.rotate((A.rot = (A.rot || 0) + T.pdt * 4)); for (let k = 0; k < 4; k++) { ctx.rotate(PI / 2); stroke(ctx, [[0, 0], [10, 4]], C.wall, 2.5); } ctx.restore(); }
      txt(ctx, mode === 'pump' ? 'Pump' : 'Turbine', x, y + 26, { align: 'center', bold: true, size: 12 });
    }
    if (mode === 'nozzle') {
      const x = X(68), y = Y(I.z2); ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 14, y - 3); ctx.lineTo(x + 14, y + 3); ctx.lineTo(x, y + 7); ctx.closePath(); ctx.fillStyle = C.wall; ctx.fill();
      const vj = d.vj, jet = []; for (let i = 0; i <= 30; i++) { const t = i * 0.03; const xx = x + 14 + vj * t * 6, yy = y + 0.5 * U.g * t * t * 6; if (xx > W - 10) break; jet.push([xx, yy]); }
      stroke(ctx, jet, C.water, 4); flowDots(ctx, A, 'jet', jet, vj / 4, T.pdt, C.part);
      txt(ctx, `jet v = ${fmt(vj)} ${U.v}`, x + 20, y - 16, { size: 11, mono: true });
    }
    if (mode === 'siphon') { txt(ctx, `summit z_s = ${fmt(I.zs)} ${L}`, X(36), Y(I.zs) - 16, { align: 'center', size: 11, mono: true, bg: C.bg }); if (d.cav) txt(ctx, 'CAVITATION — the siphon will not run', W / 2, 16, { align: 'center', bold: true, color: C.danger }); }
    if (S.egl) {
      G.pipes.forEach((p, i) => {
        const a = G.at(p, 0), b = G.at(p, 1);
        stroke(ctx, [[X(a[0]), Y(p.E[0])], [X(b[0]), Y(p.E[1])]], C.egl, 2);
        stroke(ctx, [[X(a[0]), Y(p.E[0] - G.hv(p.v))], [X(b[0]), Y(p.E[1] - G.hv(p.v))]], C.hgl, 2, [7, 5]);
        if (i === 0) { txt(ctx, 'EGL', X(a[0]) + 4, Y(p.E[0]) - 10, { color: C.egl, bold: true }); txt(ctx, 'HGL', X(a[0]) + 4, Y(p.E[0] - G.hv(p.v)) + 12, { color: C.hgl, bold: true }); stroke(ctx, [[X(12), Y(I.z1 + d.p1h)], [X(a[0]), Y(I.z1 + d.p1h)], [X(a[0]), Y(p.E[0])]], C.egl, 1.2); }
      });
      const P = G.pipes;
      if (P.length > 1) stroke(ctx, [[X(G.at(P[0], 1)[0]), Y(P[0].E[1])], [X(G.at(P[1], 0)[0]), Y(P[1].E[0])]], C.egl, 2);
      if (mode === 'pump' || mode === 'turbine') { const x = X(46) + 22; arrow(ctx, x, Y(P[0].E[1]), x, Y(P[1].E[0]), C.egl, 1.5); txt(ctx, mode === 'pump' ? `H_A = ${fmt(d.HA)} ${L}` : `H_E = ${fmt(d.HE)} ${L}`, x + 6, (Y(P[0].E[1]) + Y(P[1].E[0])) / 2, { color: C.egl, bold: true, mono: true, size: 12, bg: C.bg }); }
      const last = P[P.length - 1], e = G.at(last, 1);
      if (mode !== 'nozzle') stroke(ctx, [[X(e[0]), Y(last.E[1])], [X(e[0]), Y(I.z2 + (d.p2h || 0))], [X(88), Y(I.z2 + (d.p2h || 0))]], C.egl, 1.2);
      else stroke(ctx, [[X(e[0]), Y(last.E[1])], [X(e[0]) + 16, Y(I.z2 + G.hv(d.vj))], [W - 20, Y(I.z2 + G.hv(d.vj))]], C.egl, 1.5);
    }
    if (S.click && G.pipes[S.click.pipe] && S.clickInfo) { const p = G.pipes[S.click.pipe], q = G.at(p, S.click.s); ctx.beginPath(); ctx.arc(X(q[0]), Y(q[1]), 6, 0, 2 * PI); ctx.fillStyle = C.egl; ctx.fill(); txt(ctx, `p/γ = ${fmt(S.clickInfo.ph)} ${L}`, X(q[0]) + 10, Y(q[1]) + 16, { mono: true, size: 11, bg: C.bg }); }
    txt(ctx, 'Click on a pipe to read the pressure there. Red shading = pressure below atmospheric.', 16, H - 10, { size: 11, color: C.muted });
  };
  M4.onMainPointer = function (x, y, A) {
    if (!A.view || !A.geom) return false; let best = null;
    A.geom.pipes.forEach((p, i) => { for (let k = 0; k <= 200; k++) { const s = k / 200, q = A.geom.at(p, s), dx = A.view.X(q[0]) - x, dy = A.view.Y(q[1]) - y, dd = dx * dx + dy * dy; if (!best || dd < best.dd) best = { dd, pipe: i, s }; } });
    if (best && best.dd < 30 * 30) { S.click = { pipe: best.pipe, s: best.s }; recompute(); return true; }
    return false;
  };
  M4.drawAux = function (ctx, W, H, R) {
    const d = R.data, I = S.I, U = S.U; ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const g = U.g, pts = [{ n: 'Point 1', z: I.z1, p: d.p1h || 0, v: 0 }];
    if (d.mode === 'nozzle') pts.push({ n: 'Jet (2)', z: I.z2, p: 0, v: (d.vj * d.vj) / (2 * g) });
    else pts.push({ n: 'Point 2', z: I.z2, p: d.p2h || 0, v: 0 });
    if (S.click && S.clickInfo) pts.push({ n: 'Clicked', z: S.clickInfo.z, p: S.clickInfo.ph, v: S.clickInfo.hv });
    const vals = pts.flatMap((p) => [p.z, p.p, p.v, p.z + p.p + p.v]); const mx = Math.max(...vals, 0), mn = Math.min(...vals, 0);
    const y0 = 34, y1 = H - 40, Y = (v) => y1 - ((v - mn) / (mx - mn || 1)) * (y1 - y0);
    txt(ctx, `Energy terms (${U.L}) — elevation, pressure head, velocity head`, 16, 14, { bold: true });
    const gw = (W - 80) / pts.length, bw = Math.min(46, gw / 4.5);
    stroke(ctx, [[50, Y(0)], [W - 10, Y(0)]], C.muted, 1);
    niceTicks(mn, mx, 4).forEach((v) => txt(ctx, fmt(v, 3), 44, Y(v), { align: 'right', size: 10, mono: true, color: C.muted }));
    pts.forEach((p, i) => {
      const x0 = 60 + i * gw; [[p.z, C.wall, 'z'], [p.p, C.hgl, 'p/γ'], [p.v, C.egl, 'v²/2g']].forEach((b, j) => { const x = x0 + j * (bw + 6); ctx.fillStyle = b[1]; ctx.globalAlpha = 0.8; ctx.fillRect(x, Math.min(Y(0), Y(b[0])), bw, Math.abs(Y(b[0]) - Y(0))); ctx.globalAlpha = 1; txt(ctx, fmt(b[0], 3), x + bw / 2, b[0] >= 0 ? Y(b[0]) - 8 : Y(b[0]) + 9, { align: 'center', size: 10, mono: true }); txt(ctx, b[2], x + bw / 2, y1 + 12, { align: 'center', size: 10, color: C.muted }); });
      const tot = p.z + p.p + p.v; stroke(ctx, [[x0 - 4, Y(tot)], [x0 + 3 * (bw + 6), Y(tot)]], C.ink, 1.5, [4, 3]);
      txt(ctx, `${p.n}: total ${fmt(tot)}`, x0, H - 12, { size: 11, bold: true });
    });
  };
  M4.hint = 'The EGL jumps up by H_A at a pump and drops by H_E at a turbine.';

  /* ---------------------------------------------------------------- M5 */
  const M5 = {
    id: 'weir', tab: 'Weirs', title: 'Weirs', fn: 'weir',
    modes: [['rect', 'Rectangular weir'], ['vnotch', 'Triangular (V-notch)'], ['trap', 'Trapezoidal / Cipolletti'], ['broad', 'Broad-crested weir'], ['unsteady', 'Lowering a reservoir over a weir']],
    speed: { unsteady: 100 }, stopAtEnd: true,
    params: [
      { k: 'L', label: 'Crest length L', dim: 'len', min: 0.1, max: 50, step: 0.01, def: 3, modes: ['rect', 'trap', 'broad', 'unsteady'] },
      { k: 'solveFor', type: 'select', label: 'Solve for', def: 'Q', options: [['Q', 'Discharge Q (head H given)'], ['H', 'Head H (discharge Q given)']], modes: ['rect', 'vnotch', 'trap', 'broad'] },
      { k: 'H', label: 'Head over the crest H', dim: 'len', min: 0.01, max: 3, step: 0.001, def: 0.4, modes: ['rect', 'vnotch', 'trap', 'broad'], show: (P) => P.solveFor !== 'H' },
      { k: 'Qw', label: 'Discharge Q', dim: 'Q', min: 0.0001, max: 100, step: 0.0001, def: 1.396, log: true, modes: ['rect', 'vnotch', 'trap', 'broad'], show: (P) => P.solveFor === 'H' },
      { k: 'n', type: 'select', label: 'End contractions n', def: '0', options: [['0', 'n = 0 (suppressed)'], ['1', 'n = 1'], ['2', 'n = 2']], modes: ['rect'] },
      { k: 'P', label: 'Weir height P', dim: 'len', min: 0, max: 10, step: 0.01, def: 1 },
      { k: 'b', label: 'Channel width b (≥ L)', dim: 'len', min: 0.1, max: 50, step: 0.01, def: 3, modes: ['rect', 'vnotch', 'trap', 'broad'] },
      { k: 'approach', type: 'check', label: 'Include velocity of approach', def: false, modes: ['rect'] },
      { k: 'useCd', type: 'check', label: 'Use Cd instead of the formula constant', def: false, modes: ['rect', 'vnotch', 'trap', 'unsteady'] },
      { k: 'Cd', label: 'Coefficient of discharge Cd', min: 0.55, max: 0.7, step: 0.001, def: 0.62, show: (P, m) => P.useCd || (m === 'trap' && Math.abs(P.zs - 0.25) > 1e-9) },
      { k: 'theta', label: 'Notch angle θ', dim: 'deg', min: 10, max: 120, step: 0.5, def: 90, modes: ['vnotch'] },
      { k: 'zs', label: 'Side slope z (Cipolletti = 0.25)', dim: 'hv', min: 0, max: 2, step: 0.01, def: 0.25, modes: ['trap'] },
      { k: 'As', label: 'Reservoir surface area A_s', dim: 'area', min: 1, max: 1000000, step: 1, def: 10000, log: true, modes: ['unsteady'] },
      { k: 'H1', label: 'Initial head H₁', dim: 'len', min: 0.01, max: 3, step: 0.001, def: 0.8, modes: ['unsteady'] },
      { k: 'H2', label: 'Final head H₂', dim: 'len', min: 0.01, max: 3, step: 0.001, def: 0.4, modes: ['unsteady'], maxFn: (P) => P.H1 },
      { k: 'ht', label: 'Tailwater above the crest', dim: 'len', min: -3, max: 3, step: 0.01, def: -0.5, modes: ['rect', 'vnotch', 'trap', 'broad'] },
      { k: 'villemonte', type: 'check', label: 'Apply Villemonte correction if submerged', def: true, modes: ['rect', 'vnotch', 'trap', 'broad'] }
    ],
    presets: [
      { name: 'Test 8a — suppressed, L = 3 m, H = 0.4 m', mode: 'rect', set: { L: 3, H: 0.4, n: '0' } },
      { name: 'Test 8b — two end contractions', mode: 'rect', set: { L: 3, H: 0.4, n: '2', b: 4 } },
      { name: 'Test 8c — Cipolletti, L = 3 m, H = 0.4 m', mode: 'trap', set: { L: 3, H: 0.4, zs: 0.25 } },
      { name: 'Test 9 — 90° V-notch, H = 0.3 m', mode: 'vnotch', set: { H: 0.3, theta: 90 } },
      { name: 'Velocity of approach, P = 0.5 m', mode: 'rect', set: { L: 3, H: 0.4, P: 0.5, approach: true } },
      { name: 'Broad-crested, L = 3 m, H = 0.4 m', mode: 'broad', set: { L: 3, H: 0.4 } },
      { name: 'Submerged weir, tailwater 0.15 m above crest', mode: 'rect', set: { H: 0.4, ht: 0.15 } },
      { name: 'Find H — suppressed, L = 3 m, Q = 1.396 m³/s', mode: 'rect', set: { solveFor: 'H', L: 3, Qw: 1.396, n: '0' } },
      { name: 'Find H — two end contractions, Q = 1.3 m³/s', mode: 'rect', set: { solveFor: 'H', L: 3, Qw: 1.3, n: '2', b: 4 } },
      { name: 'Find H — velocity of approach, Q = 1.5 m³/s', mode: 'rect', set: { solveFor: 'H', L: 3, Qw: 1.5, P: 0.5, approach: true } },
      { name: 'Find H — 90° V-notch, Q = 0.069 m³/s', mode: 'vnotch', set: { solveFor: 'H', Qw: 0.069, theta: 90 } },
      { name: 'Find H — Cipolletti, L = 3 m, Q = 1.4 m³/s', mode: 'trap', set: { solveFor: 'H', L: 3, Qw: 1.4, zs: 0.25 } },
      { name: 'Find H — trapezoid z = 0.5, Q = 1.5 m³/s', mode: 'trap', set: { solveFor: 'H', L: 3, Qw: 1.5, zs: 0.5 } },
      { name: 'Find H — broad-crested, L = 3 m, Q = 1.3 m³/s', mode: 'broad', set: { solveFor: 'H', L: 3, Qw: 1.3 } },
      { name: 'Find H — submerged, tailwater 0.15 m, Q = 1.2 m³/s', mode: 'rect', set: { solveFor: 'H', L: 3, Qw: 1.2, ht: 0.15 } },
      { name: 'Lower a 10,000 m² reservoir 0.8 → 0.4 m', mode: 'unsteady', set: { As: 10000, H1: 0.8, H2: 0.4, L: 3 } }
    ]
  };
  MODS.push(M5);
  M5.tEnd = (R) => (R.data.mode === 'unsteady' ? R.data.tEnd : Infinity);
  M5.draw = function (ctx, W, H, R, A, T) {
    const d = R.data, I = S.I, U = S.U, L = U.L, g = U.g, mode = d.mode;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const Hh = sm(A, 'H', mode === 'unsteady' ? d.hAt(S.simT) : d.H, T.rdt, 10);
    const P = sm(A, 'P', I.P, T.rdt, 6), ht = mode === 'unsteady' ? -0.5 * Math.max(P, 0.2) : sm(A, 'ht', I.ht, T.rdt, 6);
    const Q = mode === 'unsteady' ? d.m * d.Lw * Math.pow(Hh, 1.5) : d.Q;
    const broad = mode === 'broad', Lb = broad ? 3 * Hh : 0;
    const ycr = broad ? (2 * Hh) / 3 : 0.85 * Hh;
    const ul = broad ? Math.sqrt(g * ycr) : 0.5757 * Math.sqrt(g * Hh), vy0 = broad ? 0 : Math.sqrt(0.22 * g * Hh);
    const pool = Math.max(0.1 * (P + Hh), P + ht);
    const lower = (t) => [Lb + ul * t, P + vy0 * t - 0.5 * g * t * t], upper = (t) => [Lb + ul * 0.95 * t, P + ycr - 0.5 * g * t * t];
    const tLand = (y0, vy) => (vy + Math.sqrt(vy * vy + 2 * g * Math.max(0, y0 - pool))) / g;
    const tl = tLand(P, vy0), tu = tLand(P + ycr, 0);
    const xLand = Math.max(lower(tl)[0], upper(tu)[0]);
    const Hs = Math.max(Hh, 0.05), Lu = Math.max(5 * Hs, 1.2 * P, 0.6);
    const b = smB(A, 'b', { x0: -Lu, x1: Math.max(xLand * 1.7, Lb + 3 * Hs, 0.8), y0: -0.08 * (P + Hs), y1: (P + Hs) * 1.3 }, T.rdt);
    const V = view(b, W, H, { l: 16, r: 16, t: 30, b: 16 }, true), X = V.X, Y = V.Y;
    const surf = (x) => P + Hh - (Hh - ycr) * Math.exp(x / (broad ? 1.5 * Hh : Hh));
    // upstream water
    ctx.beginPath(); ctx.moveTo(X(b.x0), Y(0)); for (let i = 0; i <= 60; i++) { const x = b.x0 + ((0 - b.x0) * i) / 60; ctx.lineTo(X(x), Y(surf(x))); } if (broad) ctx.lineTo(X(Lb), Y(P + ycr)); ctx.lineTo(X(broad ? Lb : 0), Y(P)); ctx.lineTo(X(0), Y(P)); ctx.lineTo(X(0), Y(0)); ctx.closePath(); ctx.fillStyle = C.water; ctx.globalAlpha = 0.33; ctx.fill(); ctx.globalAlpha = 1;
    // pool
    ctx.fillStyle = C.water; ctx.globalAlpha = 0.33; ctx.fillRect(X(broad ? Lb : 0), Y(pool), X(b.x1) - X(broad ? Lb : 0), Y(0) - Y(pool)); ctx.globalAlpha = 1;
    // aerated pocket under the nappe
    if (pool < P) { ctx.beginPath(); ctx.moveTo(X(Lb), Y(P)); for (let i = 0; i <= 30; i++) { const q = lower((tl * i) / 30); ctx.lineTo(X(q[0]), Y(q[1])); } ctx.lineTo(X(Lb), Y(pool)); ctx.closePath(); ctx.fillStyle = C.air; ctx.fill(); txt(ctx, 'air', X(Lb + lower(tl)[0] * 0.25) + 4, Y((P + pool) / 2), { size: 11, color: C.muted }); }
    // nappe
    ctx.beginPath(); for (let i = 0; i <= 30; i++) { const q = upper((tu * i) / 30); i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1])); } for (let i = 30; i >= 0; i--) { const q = lower((tl * i) / 30); ctx.lineTo(X(q[0]), Y(q[1])); } ctx.closePath(); ctx.fillStyle = C.water; ctx.globalAlpha = 0.45; ctx.fill(); ctx.globalAlpha = 1;
    // weir body
    ctx.fillStyle = C.wall; if (broad) ctx.fillRect(X(0), Y(P), X(Lb) - X(0), Y(0) - Y(P)); else { ctx.beginPath(); ctx.moveTo(X(0) - 7, Y(0)); ctx.lineTo(X(0) - 7, Y(P) + 6); ctx.lineTo(X(0), Y(P)); ctx.lineTo(X(0) + 1, Y(0)); ctx.closePath(); ctx.fill(); }
    ground(ctx, 0, W, Y(0), H - Y(0));
    // surface symbols, dims
    surfSym(ctx, X(b.x0 * 0.75), Y(surf(b.x0 * 0.75)));
    stroke(ctx, [[X(b.x0 * 0.95), Y(P)], [X(0), Y(P)]], C.muted, 1, [4, 4]);
    dimV(ctx, X(b.x0 * 0.55), Y(P), Y(P + Hh), `H = ${fmt(Hh)} ${L}`);
    dimV(ctx, X(b.x0 * 0.3), Y(0), Y(P), `P = ${fmt(P)} ${L}`);
    if (ht > -P) { stroke(ctx, [[X(xLand), Y(pool)], [X(b.x1), Y(pool)]], C.water_deep, 1.5); surfSym(ctx, X((xLand + b.x1) / 2 + 0.1 * (b.x1 - xLand)), Y(pool)); }
    if (ht > 0) txt(ctx, 'SUBMERGED — tailwater above the crest', W / 2, 16, { align: 'center', bold: true, color: C.danger });
    if (broad) txt(ctx, `y_c = 2H/3 = ${fmt(ycr)} ${L}`, X(Lb / 2), Y(P + ycr) - 14, { align: 'center', size: 11, mono: true, bg: C.bg });
    txt(ctx, `Q = ${fmt(Q)} ${U.Q}`, 16, 18, { size: 13, bold: true, mono: true });
    // particles
    A.parts = A.parts || []; const dt = T.pdt, bw = d.b || d.Lw;
    while (A.parts.filter((p) => p.k === 'u').length < 220) A.parts.push({ k: 'u', x: b.x0 + rnd() * (0 - b.x0), s: rnd() });
    const keep = [];
    for (const p of A.parts) {
      if (p.k === 'u') {
        if (p.x < b.x0) { p.x = b.x0 + rnd() * -b.x0; p.s = rnd(); }
        const lb = P * sstep((p.x - b.x0 * 0.55) / (-b.x0 * 0.55)), top = surf(Math.min(p.x, 0)), depth = Math.max(top - lb, 1e-3);
        const u = Q / (bw * depth); p.x += u * dt;
        if (p.x >= (broad ? Lb : 0)) { if (broad && p.x < Lb) { } else { p.k = 'n'; p.t = 0; } }
        if (broad && p.x > 0 && p.x < Lb) { const y = P + p.s * lerp(surf(0), ycr, p.x / Lb) * 0 + p.s * (lerp(surf(0) - P, ycr, p.x / Lb)); ctx.fillStyle = C.part; ctx.fillRect(X(p.x) - 1.3, Y(y) - 1.3, 2.6, 2.6); keep.push(p); continue; }
        if (p.k === 'u') { ctx.fillStyle = C.part; ctx.globalAlpha = 0.7; ctx.fillRect(X(p.x) - 1.2, Y(lb + p.s * depth * 0.97) - 1.2, 2.5, 2.5); ctx.globalAlpha = 1; }
        keep.push(p);
      } else if (p.k === 'n') {
        p.t += dt; const a = lower(p.t), c = upper(p.t), x = lerp(a[0], c[0], p.s), y = lerp(a[1], c[1], p.s);
        if (y <= pool) { p.k = 's'; p.x = x; p.y = pool; p.vx = (rnd() - 0.2) * ul * 0.6; p.vy = rnd() * Math.sqrt(2 * g * Math.max(0.01, P + Hh - pool)) * 0.35; p.life = 0; }
        else { ctx.fillStyle = C.part; ctx.fillRect(X(x) - 1.3, Y(y) - 1.3, 2.6, 2.6); }
        keep.push(p);
      } else {
        p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= g * dt;
        if (p.y < pool && p.vy < 0) { p.vy = 0; p.y = pool - rnd() * 0.3 * pool; p.vx = Math.max(0.05, Q / (bw * Math.max(pool, 0.05))); }
        if (p.life > 2.5 || p.x > b.x1) continue;
        ctx.fillStyle = p.life < 0.5 ? C.foam : C.part; ctx.globalAlpha = clamp(1 - p.life / 2.5, 0, 1); ctx.fillRect(X(p.x) - 1.3, Y(p.y) - 1.3, 2.6, 2.6); ctx.globalAlpha = 1; keep.push(p);
      }
    }
    A.parts = keep.slice(-480);
    velScale(ctx, W - 210, 46, V.sx, U.v);
    if (mode === 'unsteady' && S.simT >= d.tEnd - 1e-9) txt(ctx, 'H₂ reached — press Reset to run again', W / 2, 36, { align: 'center', bold: true, color: C.egl });
  };
  M5.drawAux = function (ctx, W, H, R, A) {
    const d = R.data, I = S.I, U = S.U, L = U.L, mode = d.mode;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const fw = mode === 'unsteady' ? W * 0.34 : W;
    const Hh = A.H || d.H, P = I.P, bch = mode === 'vnotch' ? Math.max(2 * Math.tan((I.theta * PI) / 360) * Hh * 1.6, 0.3) : Math.max(d.b || I.L, I.L);
    const Ht = P + Hh * 1.5;
    const V = view({ x0: -bch / 2 - 0.05 * bch, x1: bch / 2 + 0.05 * bch, y0: -0.05 * Ht, y1: Ht * 1.08 }, fw, H, { l: 40, r: 40, t: 28, b: 14 }, true), X = V.X, Y = V.Y;
    txt(ctx, 'Front view (looking downstream)', 12, 14, { bold: true });
    // notch polygon (opening)
    let notch;
    const n = +I.n, Lw = I.L;
    if (mode === 'vnotch') { const hw = Math.tan((I.theta * PI) / 360) * Hh * 1.5; notch = [[-hw, P + Hh * 1.5], [0, P], [hw, P + Hh * 1.5]]; }
    else if (mode === 'trap') { const z = I.zs; notch = [[-Lw / 2 - z * Hh * 1.5, P + Hh * 1.5], [-Lw / 2, P], [Lw / 2, P], [Lw / 2 + z * Hh * 1.5, P + Hh * 1.5]]; }
    else if (mode === 'rect' && n > 0) { const x0 = n === 2 ? -Lw / 2 : -bch / 2, x1 = x0 + Lw; notch = [[x0, P + Hh * 1.5], [x0, P], [x1, P], [x1, P + Hh * 1.5]]; }
    else notch = [[-bch / 2, P + Hh * 1.5], [-bch / 2, P], [bch / 2, P], [bch / 2, P + Hh * 1.5]];
    // plate
    ctx.beginPath(); ctx.rect(X(-bch / 2), Y(Ht), (bch) * V.sx, Y(0) - Y(Ht)); notch.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.closePath(); ctx.fillStyle = C.wall; ctx.globalAlpha = 0.85; ctx.fill('evenodd'); ctx.globalAlpha = 1;
    // water through the notch
    ctx.save(); poly(ctx, notch.map((p) => [X(p[0]), Y(p[1])]), true); ctx.clip(); ctx.fillStyle = C.water; ctx.globalAlpha = 0.55; ctx.fillRect(X(-bch), Y(P + Hh), 2 * bch * V.sx, Y(P) - Y(P + Hh)); ctx.globalAlpha = 1; ctx.restore();
    stroke(ctx, [[X(-bch / 2), Y(P + Hh)], [X(bch / 2), Y(P + Hh)]], C.water_deep, 1.5, [5, 3]); surfSym(ctx, X(-bch / 2 + bch * 0.12), Y(P + Hh));
    dimV(ctx, X(bch / 2) + 14, Y(P), Y(P + Hh), `H = ${fmt(Hh)} ${L}`);
    if (mode !== 'vnotch') dimH(ctx, X(notch[1][0]), X(notch[2][0]), Y(P) + 16, `L = ${fmt(Lw)} ${L}`);
    else txt(ctx, `θ = ${fmt(I.theta)}°`, X(0), Y(P) + 14, { align: 'center', mono: true, size: 11 });
    if (mode === 'rect') txt(ctx, n ? `${n} end contraction${n > 1 ? 's' : ''}, L′ = ${fmt(d.Lp)} ${L}` : 'suppressed (no end contractions)', X(0), Y(Ht) - 10, { align: 'center', size: 11, color: C.muted, bg: C.bg });
    if (mode === 'trap') txt(ctx, Math.abs(I.zs - 0.25) < 1e-9 ? 'Cipolletti: sides 1H : 4V' : `sides ${fmt(I.zs)}H : 1V`, X(0), Y(Ht) - 10, { align: 'center', size: 11, color: C.muted, bg: C.bg });
    if (mode === 'unsteady' && d.table) {
      const tb = d.table, hrs = tb.ts[tb.ts.length - 1] > 7200, sc = hrs ? 1 / 3600 : 1 / 60, xs = tb.ts.map((t) => t * sc), cur = S.simT * sc, tl = hrs ? 't (h)' : 't (min)';
      const w = (W - fw) / 2;
      plot(ctx, { x: fw, y: 0, w, h: H }, { title: `Head H (${L}) vs t`, xs, series: [{ ys: tb.hs, color: C.water_deep, fill: true }], xlab: tl, ymin: 0, cursor: cur, pts: [{ x: cur, y: d.hAt(S.simT), color: C.egl }] });
      plot(ctx, { x: fw + w, y: 0, w, h: H }, { title: `Outflow Q (${U.Q}) vs t`, xs, series: [{ ys: tb.qs, color: C.hgl, fill: true }], xlab: tl, ymin: 0, cursor: cur, pts: [{ x: cur, y: d.m * d.Lw * Math.pow(d.hAt(S.simT), 1.5), color: C.egl }] });
    }
  };
  M5.hint = 'The nappe springs clear of the sharp crest; the air pocket underneath must stay ventilated.';

  /* ---------------------------------------------------------------- M6 */
  const N_CHIPS = [['Smooth concrete', 0.012], ['Finished concrete', 0.013], ['Brick', 0.015], ['Earth, clean', 0.022], ['Earth, weeds', 0.03], ['Natural stream', 0.035]];
  const M6 = {
    id: 'manning', tab: 'Open Channels', title: 'Open Channel Uniform Flow (Manning)', fn: 'manning',
    modes: [['solveQ', 'Solve for Q (given depth)'], ['solveY', 'Solve for normal depth y_n'], ['solveSn', 'Solve for slope S or roughness n'], ['efficient', 'Most efficient section'], ['circular', 'Circular conduit, partly full']], speed: {},
    modeDefaults: { circular: { y: 0.6, D: 1 } },
    params: [
      { k: 'section', type: 'select', label: 'Section', def: 'rect', options: [['rect', 'Rectangular'], ['trap', 'Trapezoidal'], ['tri', 'Triangular'], ['circ', 'Circular'], ['semi', 'Semicircular']], show: (P, m) => m !== 'circular', onSet: (P) => { if ((P.section === 'tri' || P.section === 'trap') && !(P.z > 0)) P.z = 1; if (P.section === 'circ' && P.y > P.D) P.y = +(0.6 * P.D).toFixed(3); if (P.section === 'semi' && P.y > P.D / 2) P.y = +(0.35 * P.D).toFixed(3); } },
      { k: 'b', label: 'Bottom width b', dim: 'len', min: 0.1, max: 50, step: 0.01, def: 3, show: (P, m) => m !== 'circular' && (P.section === 'rect' || P.section === 'trap') },
      { k: 'z', label: 'Side slope z (H:V)', dim: 'hv', min: 0, max: 4, step: 0.01, def: 0, show: (P, m) => m !== 'circular' && (P.section === 'trap' || P.section === 'tri') },
      { k: 'D', label: 'Diameter D', labelFn: (P, m) => (m !== 'circular' && P.section === 'semi' ? 'Diameter D (= 2r, top width when full)' : 'Diameter D'), dim: 'len', min: 0.1, max: 10, step: 0.01, def: 1, show: (P, m) => m === 'circular' || P.section === 'circ' || P.section === 'semi' },
      { k: 'y', label: 'Depth y', dim: 'len', min: 0.01, max: 10, step: 0.001, def: 1.5, modes: ['solveQ', 'solveSn', 'circular'], maxFn: (P, m) => (m === 'circular' || P.section === 'circ' ? P.D : P.section === 'semi' ? P.D / 2 : 10) },
      { k: 'n', label: 'Manning n', min: 0.009, max: 0.06, step: 0.0001, def: 0.013, chips: N_CHIPS, show: (P, m) => !(m === 'solveSn' && P.solveFor === 'n') },
      { k: 'S', label: 'Bed slope S', min: 0.00001, max: 0.1, step: 0.00001, def: 0.001, log: true, show: (P, m) => !(m === 'solveSn' && P.solveFor === 'S') },
      { k: 'Q', label: 'Discharge Q', dim: 'Q', min: 0.01, max: 500, step: 0.01, def: 10, log: true, modes: ['solveY', 'solveSn', 'efficient'] },
      { k: 'solveFor', type: 'select', label: 'Solve for', def: 'S', options: [['S', 'Slope S'], ['n', 'Roughness n']], modes: ['solveSn'] }
    ],
    presets: [
      { name: 'Test 10 — rectangle b = 3, y = 1.5, n = 0.013, S = 0.001', mode: 'solveQ', set: { section: 'rect', b: 3, y: 1.5, n: 0.013, S: 0.001 } },
      { name: 'Normal depth for Q = 10 m³/s (rectangle b = 3)', mode: 'solveY', set: { section: 'rect', b: 3, Q: 10 } },
      { name: 'Trapezoid b = 3, z = 2, Q = 20 m³/s, earth', mode: 'solveY', set: { section: 'trap', b: 3, z: 2, Q: 20, n: 0.022, S: 0.0005 } },
      { name: 'Best trapezoid for Q = 10 m³/s', mode: 'efficient', set: { section: 'trap', b: 3, z: 1, Q: 10 } },
      { name: 'Best rectangle for Q = 10 m³/s', mode: 'efficient', set: { section: 'rect', b: 3, Q: 10 } },
      { name: 'Sewer D = 1 m flowing 60% full', mode: 'circular', set: { D: 1, y: 0.6, n: 0.013, S: 0.001 } },
      { name: 'Steep concrete chute, S = 0.02', mode: 'solveQ', set: { section: 'rect', b: 3, y: 0.5, S: 0.02 } },
      { name: 'Test — semicircle r = 1 m flowing full: R = r/2 = 0.5 m, Q = 2.407 m³/s', mode: 'solveQ', set: { section: 'semi', D: 2, y: 1, n: 0.013, S: 0.001 } },
      { name: 'Semicircular channel D = 2 m, depth 0.6 m', mode: 'solveQ', set: { section: 'semi', D: 2, y: 0.6, n: 0.013, S: 0.001 } },
      { name: 'Normal depth in a semicircular flume D = 1.5 m, Q = 1 m³/s', mode: 'solveY', set: { section: 'semi', D: 1.5, Q: 1, n: 0.012, S: 0.002 } },
      { name: 'Slope for a semicircular channel D = 3 m, y = 1.2 m, Q = 5 m³/s', mode: 'solveSn', set: { section: 'semi', D: 3, y: 1.2, Q: 5, n: 0.013, solveFor: 'S' } },
      { name: 'Best section: semicircle flowing full for Q = 10 m³/s (vs D = 4 m)', mode: 'efficient', set: { section: 'semi', D: 4, Q: 10 } }
    ]
  };
  MODS.push(M6);
  M6.draw = function (ctx, W, H, R, A, T) {
    const d = R.data, U = S.U, L = U.L, I = S.I;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const y = d.y, v = sm(A, 'v', d.v, T.rdt, 4);
    const ang = ((2 + (10 * (Math.log10(Math.max(d.S || I.S, 1e-5)) + 5)) / 4) * PI) / 180;
    const pad = 30, depthPx = sm(A, 'dpx', clamp(H * 0.32 * (y / Math.max(y, d.yc || y, 0.5) ), 26, H * 0.36), T.rdt, 5);
    const x0 = pad, y0 = 70 + (depthPx); const angC = Math.min(ang, Math.atan(Math.max(10, H - y0 - 24) / (W - 2 * pad))), Lpx = (W - 2 * pad) / Math.cos(angC); const dir = [Math.cos(angC), Math.sin(angC)], nrm = [Math.sin(angC), -Math.cos(angC)];
    const Pt = (xi, eta) => [x0 + dir[0] * xi + nrm[0] * eta, y0 + dir[1] * xi + nrm[1] * eta];
    // bed
    ctx.beginPath(); const a = Pt(0, 0), b = Pt(Lpx, 0); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(b[0], H); ctx.lineTo(a[0], H); ctx.closePath(); ctx.fillStyle = C.soil; ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1; stroke(ctx, [a, b], C.wall, 2.5);
    // water
    const c = Pt(Lpx, depthPx), e = Pt(0, depthPx); poly(ctx, [a, b, c, e], true); ctx.fillStyle = C.water; ctx.globalAlpha = 0.33; ctx.fill(); ctx.globalAlpha = 1; stroke(ctx, [e, c], C.water_deep, 1.5);
    surfSym(ctx, Pt(Lpx * 0.15, depthPx)[0], Pt(Lpx * 0.15, depthPx)[1]);
    if (S.egl) { const hvpx = clamp(((v * v) / (2 * U.g) / Math.max(y, 1e-3)) * depthPx, 6, 120); const p1 = Pt(0, depthPx + hvpx), p2 = Pt(Lpx, depthPx + hvpx); stroke(ctx, [p1, p2], C.egl, 1.6, [8, 5]); txt(ctx, `EGL (parallel to bed in uniform flow), v²/2g = ${fmt((v * v) / (2 * U.g))} ${L}`, p1[0] + 10, p1[1] - 10, { color: C.egl, size: 11, bold: true }); }
    const dm = Pt(Lpx * 0.5, 0), dm2 = Pt(Lpx * 0.5, depthPx); dimV(ctx, dm[0], dm[1], dm2[1], `y = ${fmt(y)} ${L}`);
    // particles
    A.parts = A.parts || []; const dt = T.pdt, K = 45;
    while (A.parts.length < 380) A.parts.push({ xi: rnd() * Lpx, s: rnd(), w: rnd() * 2 - 1 });
    ctx.lineCap = 'round';
    for (const p of A.parts) {
      const u = v * (8 / 7) * Math.pow(Math.max(p.s, 0.02), 1 / 7) * ((1 - 0.35 * p.w * p.w) / 0.8833);
      p.xi += u * K * dt; if (p.xi > Lpx) { p.xi -= Lpx; p.s = rnd(); p.w = rnd() * 2 - 1; }
      const q = Pt(p.xi, p.s * depthPx * 0.96 + 1), len = clamp(u * K * 0.12, 1, 16);
      ctx.strokeStyle = C.part; ctx.globalAlpha = 0.85 - 0.5 * Math.abs(p.w); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(q[0] - dir[0] * len, q[1] - dir[1] * len); ctx.lineTo(q[0], q[1]); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.lineCap = 'butt';
    // velocity profile sketch
    const px = Pt(Lpx * 0.82, 0); const prof = []; for (let i = 0; i <= 20; i++) { const s = i / 20; const u = v * (8 / 7) * Math.pow(Math.max(s, 0.01), 1 / 7); const q = Pt(Lpx * 0.82, s * depthPx); prof.push([q[0] + dir[0] * u * 18, q[1] + dir[1] * u * 18]); }
    stroke(ctx, [px, Pt(Lpx * 0.82, depthPx)], C.muted, 1); stroke(ctx, prof, C.ink, 1.5); txt(ctx, 'velocity profile', prof[20][0] + 6, prof[20][1] - 8, { size: 10.5, color: C.muted });
    txt(ctx, `v = ${fmt(d.v)} ${U.v}   Q = ${fmt(d.Q)} ${U.Q}   S = ${fmt(d.S || I.S)}   n = ${fmt(d.n || I.n)}` + (isFinite(d.Fr) ? `   F = ${fmt(d.Fr)}` : ''), 16, 18, { size: 12, mono: true, bold: true });
    txt(ctx, 'slope drawn exaggerated', W - 16, H - 12, { align: 'right', size: 10.5, color: C.muted });
    velScale(ctx, W - 210, 50, K, U.v);
  };
  // section geometry exactly as the formulas use it: a triangle has no bottom width, a rectangle has vertical sides
  function chanG(shape, I) { return shape === 'circ' || shape === 'semi' ? { D: I.D } : shape === 'tri' ? { b: 0, z: I.z, D: 1 } : shape === 'rect' ? { b: I.b, z: 0, D: 1 } : { b: I.b, z: I.z, D: 1 }; }
  function drawSection(ctx, r, shape, G, y, o) {
    o = o || {};
    const D = G.D, b = G.b || 0, z = G.z || 0;
    const yTop = shape === 'circ' ? D : shape === 'semi' ? D / 2 : Math.max(y * 1.35, y + 0.2 * y);
    const Ttop = shape === 'circ' || shape === 'semi' ? D : b + 2 * z * yTop;
    const V = view({ x0: -Ttop / 2 - 0.08 * Ttop - 0.1, x1: Ttop / 2 + 0.08 * Ttop + 0.1, y0: -0.12 * yTop, y1: yTop * (shape === 'semi' ? 1.3 : 1.12) }, r.w, r.h, { l: 34 + r.x, r: 40 + (o.rpad || 0), t: 34 + r.y, b: 26 }, true);
    const X = (x) => V.X(x) + 0, Y = V.Y;
    // channel outline
    let wall, water, wet;
    if (shape === 'circ') {
      const R = D / 2, cy = R; ctx.beginPath(); ctx.arc(X(0), Y(cy), R * V.sx, 0, 2 * PI); ctx.strokeStyle = C.wall; ctx.lineWidth = 3; ctx.stroke();
      const th = 2 * Math.acos(1 - (2 * Math.min(y, D)) / D);
      ctx.save(); ctx.beginPath(); ctx.arc(X(0), Y(cy), R * V.sx, 0, 2 * PI); ctx.clip(); ctx.fillStyle = C.water; ctx.globalAlpha = 0.4; ctx.fillRect(X(-R), Y(y), D * V.sx, Y(0) - Y(y) + 2); ctx.globalAlpha = 1; ctx.restore();
      ctx.beginPath(); ctx.arc(X(0), Y(cy), R * V.sx, PI / 2 - th / 2, PI / 2 + th / 2); ctx.strokeStyle = C.egl; ctx.lineWidth = 4; ctx.stroke();
      const T = D * Math.sin(th / 2); if (y > 0) { stroke(ctx, [[X(-T / 2), Y(y)], [X(T / 2), Y(y)]], C.water_deep, 1.5); dimH(ctx, X(-T / 2), X(T / 2), Y(y) - 14, `T = ${fmt(T)}`); }
      dimV(ctx, X(R) + 14, Y(0), Y(y), `y = ${fmt(y)}`); dimV(ctx, X(-R) - 14, Y(0), Y(D), `D = ${fmt(D)}`, null, 'left');
    } else if (shape === 'semi') {
      // open semicircular channel: centre on the rim line (y = r), wetted arc below the surface
      const R = D / 2, yw = Math.min(Math.max(y, 0), R), cx = X(0), cy = Y(R), rp = R * V.sx, yb = Y(-0.12 * yTop);
      ctx.beginPath(); ctx.moveTo(X(-R) - 30, cy); ctx.lineTo(X(-R), cy); ctx.arc(cx, cy, rp, PI, 0, true); ctx.lineTo(X(R) + 30, cy); ctx.lineTo(X(R) + 30, yb); ctx.lineTo(X(-R) - 30, yb); ctx.closePath();
      ctx.fillStyle = C.soil; ctx.globalAlpha = 0.45; ctx.fill(); ctx.globalAlpha = 1;
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, rp, 0, PI); ctx.closePath(); ctx.clip(); ctx.fillStyle = C.water; ctx.globalAlpha = 0.4; ctx.fillRect(X(-R), Y(yw), D * V.sx, Y(0) - Y(yw) + 2); ctx.globalAlpha = 1; ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cy, rp, 0, PI); ctx.strokeStyle = C.wall; ctx.lineWidth = 2.5; ctx.stroke();
      const th = 2 * Math.acos(1 - (2 * yw) / D), T = D * Math.sin(th / 2);
      ctx.beginPath(); ctx.arc(cx, cy, rp, PI / 2 - th / 2, PI / 2 + th / 2); ctx.strokeStyle = C.egl; ctx.lineWidth = 4; ctx.stroke();
      if (yw > 0) { stroke(ctx, [[X(-T / 2), Y(yw)], [X(T / 2), Y(yw)]], C.water_deep, 1.5); surfSym(ctx, X(-T / 4), Y(yw)); dimH(ctx, X(-T / 2), X(T / 2), Y(yw) - 14, `T = ${fmt(T)}`); }
      { const a = 0.8 * PI, ex = cx + rp * Math.cos(a), ey = cy + rp * Math.sin(a); stroke(ctx, [[cx, cy], [ex, ey]], C.muted, 1, [3, 3]); txt(ctx, 'r', (cx + ex) / 2 - 4, (cy + ey) / 2 - 6, { size: 11, color: C.muted, bold: true }); }
      dimV(ctx, X(R) + 14, Y(0), Y(yw), `y = ${fmt(yw)}`); dimH(ctx, X(-R), X(R), Y(0) + 18, `D = 2r = ${fmt(D)}  (r = ${fmt(R)})`);
    } else {
      const xb = b / 2, xt = b / 2 + z * yTop;
      wall = [[-xt, yTop], [-xb, 0], [xb, 0], [xt, yTop]];
      const xw = b / 2 + z * y; water = [[-xw, y], [-xb, 0], [xb, 0], [xw, y]];
      ctx.beginPath(); poly(ctx, [[X(-xt) - 30, Y(yTop)], ...wall.map((p) => [X(p[0]), Y(p[1])]), [X(xt) + 30, Y(yTop)], [X(xt) + 30, Y(-0.12 * yTop)], [X(-xt) - 30, Y(-0.12 * yTop)]], true); ctx.fillStyle = C.soil; ctx.globalAlpha = 0.45; ctx.fill(); ctx.globalAlpha = 1;
      poly(ctx, water.map((p) => [X(p[0]), Y(p[1])]), true); ctx.fillStyle = C.water; ctx.globalAlpha = 0.4; ctx.fill(); ctx.globalAlpha = 1;
      stroke(ctx, wall.map((p) => [X(p[0]), Y(p[1])]), C.wall, 2.5);
      stroke(ctx, water.map((p) => [X(p[0]), Y(p[1])]), C.egl, 4);
      stroke(ctx, [[X(-xw), Y(y)], [X(xw), Y(y)]], C.water_deep, 1.5); surfSym(ctx, X(-xw * 0.5), Y(y));
      dimH(ctx, X(-xw), X(xw), Y(y) - 16, `T = ${fmt(b + 2 * z * y)}`);
      if (b > 0) dimH(ctx, X(-xb), X(xb), Y(0) + 16, `b = ${fmt(b)}`);
      dimV(ctx, X(xt) + 12, Y(0), Y(y), `y = ${fmt(y)}`);
      if (z > 0) { const sx = X(-xt + z * yTop * 0.25), sy = Y(yTop * 0.75); stroke(ctx, [[sx - 26 * Math.min(z, 2), sy], [sx, sy], [sx, sy + 26 / 1]], C.muted, 1); txt(ctx, `${fmt(z, 3)}`, sx - 13 * Math.min(z, 2), sy - 8, { size: 10, align: 'center', color: C.muted }); txt(ctx, '1', sx + 5, sy + 13, { size: 10, color: C.muted }); }
    }
    if (o.title) txt(ctx, o.title, r.x + 12, r.y + 14, { bold: true });
    if (o.sub) txt(ctx, o.sub, r.x + 12, r.y + 30, { size: 11, mono: true, color: C.muted });
  }
  M6.drawAux = function (ctx, W, H, R, A, T) {
    const d = R.data, U = S.U, I = S.I; ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    if (d.mode === 'efficient') {
      A.mt = (A.mt || 0) + T.rdt; const cyc = 7, ph = A.mt % cyc, f = ph < 1.5 ? 0 : ph < 3.5 ? sstep((ph - 1.5) / 2) : ph < 5 ? 1 : 1 - sstep((ph - 5) / 2);
      const from = d.morphFrom, to = d.morphTo;
      let G, y, lab;
      if (d.shape === 'circ' || !isFinite(from.y)) { G = to.G; y = to.y; lab = 'Optimum'; }
      else if (d.shape === 'semi') { G = { D: lerp(from.G.D, to.G.D, f) }; y = lerp(from.y, to.y, f); lab = f < 0.02 ? 'Your section (same Q)' : f > 0.98 ? 'Optimum section (full semicircle)' : 'Morphing…'; }
      else { G = { b: lerp(from.G.b, to.G.b, f), z: lerp(from.G.z, to.G.z, f), D: 1 }; y = lerp(from.y, to.y, f); lab = f < 0.02 ? 'Your section (same Q)' : f > 0.98 ? 'Optimum section' : 'Morphing…'; }
      const s = HP.section(d.shape, G, y);
      drawSection(ctx, { x: 0, y: 0, w: W, h: H }, d.shape, G, y, { title: `${lab}`, sub: `A = ${fmt(s.A)}  P = ${fmt(s.P)}  R = ${fmt(s.R)} ${U.L}`, rpad: 170 });
      const x = W - 200; txt(ctx, 'Compare (same Q)', x, 20, { bold: true });
      if (d.scur) { txt(ctx, `Yours:   P = ${fmt(d.scur.P)}  R = ${fmt(d.scur.R)}`, x, 42, { mono: true, size: 11 }); }
      txt(ctx, `Optimum: P = ${fmt(d.so.P)}  R = ${fmt(d.so.R)}`, x, 60, { mono: true, size: 11, color: C.egl });
      txt(ctx, 'orange = wetted perimeter', x, 80, { size: 10.5, color: C.muted });
      return;
    }
    if (d.mode === 'circular') {
      const w = W * 0.4; drawSection(ctx, { x: 0, y: 0, w, h: H }, 'circ', { D: I.D }, d.y, { title: 'Cross-section' });
      const yd = [], qr = [], vr = []; const sf = HP.section('circ', { D: 1 }, 1), kf = sf.A * Math.pow(sf.R, 2 / 3);
      for (let i = 1; i <= 100; i++) { const r = i / 100, s = HP.section('circ', { D: 1 }, r); yd.push(r); qr.push((s.A * Math.pow(s.R, 2 / 3)) / kf); vr.push(Math.pow(s.R / sf.R, 2 / 3)); }
      // plot y/D (vertical) against ratios (horizontal)
      plot(ctx, { x: w, y: 0, w: W - w, h: H }, { title: 'Partly full: ratios vs y/D', xs: qr, series: [{ xs: qr, ys: yd, color: C.water_deep }, { xs: vr, ys: yd, color: C.hgl, dash: [6, 4] }], xmin: 0, xmax: 1.2, ymin: 0, ymax: 1, xlab: 'Q/Q_full (solid), v/v_full (dashed)', hmarks: [{ y: 0.938, label: 'max Q 0.938D' }, { y: 0.81, label: 'max v 0.81D' }], pts: [{ x: d.Q / d.Qf, y: d.y / I.D, color: C.egl, label: `y/D = ${fmt(d.y / I.D, 3)}` }, { x: d.v / d.vf, y: d.y / I.D, color: C.hgl }] });
      return;
    }
    drawSection(ctx, { x: 0, y: 0, w: W, h: H }, d.shape, chanG(d.shape, I), d.y, { title: 'Cross-section (orange = wetted perimeter)', sub: `A = ${fmt(d.s.A)} ${U.A}   P = ${fmt(d.s.P)} ${U.L}   R = ${fmt(d.s.R)} ${U.L}` });
  };
  M6.hint = 'Particles near the surface move faster (1/7-power velocity profile). Raise S or lower n to speed the flow up.';

  /* ---------------------------------------------------------------- M7 */
  const MAT = [['rigid', 'Rigid pipe (E = ∞)', Infinity], ['steel', 'Steel (200 GPa)', 200], ['ci', 'Cast iron (100 GPa)', 100], ['concrete', 'Concrete (20 GPa)', 20], ['pvc', 'PVC (3 GPa)', 3], ['custom', 'Custom E', null]];
  const M7 = {
    id: 'hammer', tab: 'Water Hammer', title: 'Water Hammer', fn: 'hammer', modes: [['main', 'Valve closure']], speed: { main: 0.25 }, loop: true,
    params: [
      { k: 'Lp', label: 'Pipe length L', dim: 'len', min: 10, max: 10000, step: 1, def: 1500, log: true },
      { k: 'Dp', label: 'Diameter D', dim: 'mm', min: 25, max: 3000, step: 1, def: 600 },
      { k: 'tw', label: 'Wall thickness t', dim: 'mm', min: 1, max: 50, step: 0.1, def: 10 },
      { k: 'mat', type: 'select', label: 'Pipe material', def: 'rigid', options: MAT.map((m) => [m[0], m[1]]), onSet: (P) => { const m = MAT.find((q) => q[0] === P.mat); if (m && isFinite(m[2])) P.E = m[2]; } },
      { k: 'E', label: 'Pipe modulus E', dim: 'GPa', min: 1, max: 250, step: 0.1, def: 200, show: (P) => P.mat === 'custom' },
      { k: 'Eb', label: 'Bulk modulus of liquid E_b', dim: 'GPa', min: 1, max: 2.5, step: 0.01, def: 2.2 },
      { k: 'rho', label: 'Liquid density ρ', dim: 'rho', min: 500, max: 1500, step: 1, def: 1000 },
      { k: 'v', label: 'Initial velocity v', dim: 'vel', min: 0.1, max: 10, step: 0.01, def: 2 },
      { k: 'tc', label: 'Valve closure time t_c', dim: 's', min: 0, max: 60, step: 0.01, def: 0 },
      { k: 'vf', label: 'Final velocity v_f (partial closure)', dim: 'vel', min: 0, max: 10, step: 0.01, def: 0, maxFn: (P) => P.v },
      { k: 'p0', label: 'Static pressure at the valve', dim: 'kPa', min: 0, max: 3000, step: 1, def: 300 },
      { k: 'sall', label: 'Allowable hoop stress (0 = skip)', dim: 'MPa', min: 0, max: 500, step: 1, def: 120 }
    ],
    presets: [
      { name: 'Test 11a — rigid pipe, v = 2 m/s, instant closure', mode: 'main', set: { mat: 'rigid', v: 2, tc: 0, Lp: 1500 } },
      { name: 'Test 11b — slow closure t_c = 5 s', mode: 'main', set: { mat: 'rigid', v: 2, tc: 5, Lp: 1500 } },
      { name: 'Test 11c — steel pipe D = 600 mm, t = 10 mm', mode: 'main', set: { mat: 'steel', E: 200, Dp: 600, tw: 10, v: 2, tc: 0 } },
      { name: 'PVC pipe, partial closure to 0.5 m/s', mode: 'main', set: { mat: 'pvc', E: 3, Dp: 300, tw: 15, v: 2, vf: 0.5, tc: 0, sall: 12 } }
    ]
  };
  MODS.push(M7);
  M7.prep = (I, P) => { const m = MAT.find((q) => q[0] === P.mat); if (m && !isFinite(m[2])) I.E = Infinity; I.L = I.Lp; I.D = I.Dp; I.t = I.tw; I.p0 = I.p0 * S.U.p0toBase; };
  M7.tEnd = (R) => R.data.moc.Tsim;
  function pColor(f) {
    // f in [-1, 1]: purple (low) ← blue (normal) → red (high)
    const blue = [58, 144, 204], red = [214, 48, 49], pur = [134, 76, 199];
    const c = f >= 0 ? blue.map((b, i) => lerp(b, red[i], clamp(f, 0, 1))) : blue.map((b, i) => lerp(b, pur[i], clamp(-f, 0, 1)));
    return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  }
  M7.draw = function (ctx, W, H, R, A, T) {
    const d = R.data, U = S.U, m = d.moc, np = m.N + 1;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const k = clamp(Math.floor(S.simT / m.dt), 0, m.steps), fr = clamp(S.simT / m.dt - k, 0, 1), k2 = Math.min(k + 1, m.steps);
    const pk = (i) => lerp(m.P[k * np + i], m.P[k2 * np + i], fr), vk = (i) => lerp(m.V[k * np + i], m.V[k2 * np + i], fr);
    let pmax = 1e-9; for (let i = 0; i < m.P.length; i++) pmax = Math.max(pmax, Math.abs(m.P[i]));
    const x0 = W * 0.17, x1 = W - 70, yc = H * 0.52, ph = 30;
    // reservoir
    const rt = Math.max(84, H * 0.2); ctx.fillStyle = C.water; ctx.globalAlpha = 0.33; ctx.fillRect(16, rt + 14, x0 - 16, yc + ph / 2 + 20 - rt - 14); ctx.globalAlpha = 1; stroke(ctx, [[16, rt], [16, yc + ph / 2 + 20], [x0, yc + ph / 2 + 20], [x0, yc + ph / 2]], C.wall, 2.5); stroke(ctx, [[x0, yc - ph / 2], [x0, rt]], C.wall, 2.5); surfSym(ctx, (16 + x0) / 2, rt + 14); txt(ctx, 'Reservoir', (16 + x0) / 2, rt - 12, { align: 'center', bold: true });
    // pipe colored by pressure
    const N = m.N; for (let i = 0; i < N; i++) { const p = (pk(i) + pk(i + 1)) / 2; ctx.fillStyle = pColor(p / pmax); ctx.fillRect(x0 + ((x1 - x0) * i) / N, yc - ph / 2, (x1 - x0) / N + 1, ph); }
    stroke(ctx, [[x0, yc - ph / 2], [x1, yc - ph / 2]], C.wall, 2); stroke(ctx, [[x0, yc + ph / 2], [x1, yc + ph / 2]], C.wall, 2);
    // velocity arrows
    for (let i = 1; i < N; i += Math.max(1, Math.floor(N / 10))) { const v = vk(i), x = x0 + ((x1 - x0) * i) / N, l = clamp((v / d.v0) * 16, -16, 16); if (Math.abs(l) > 1.5) arrow(ctx, x - l / 2, yc, x + l / 2, yc, '#ffffff', 1.5, 5); }
    // valve
    const clos = (d.tc <= 0 ? (S.simT > 0 ? 1 : 0) : clamp(S.simT / d.tc, 0, 1)) * (1 - d.vf / d.v0);
    ctx.fillStyle = C.wall; ctx.beginPath(); ctx.moveTo(x1, yc - ph / 2 - 10); ctx.lineTo(x1 + 30, yc + ph / 2 + 10); ctx.lineTo(x1 + 30, yc - ph / 2 - 10); ctx.lineTo(x1, yc + ph / 2 + 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.danger; ctx.fillRect(x1 + 12, yc - ph / 2, 6, ph * clos); stroke(ctx, [[x1 + 15, yc - ph / 2 - 10], [x1 + 15, yc - ph / 2 - 26]], C.wall, 3);
    txt(ctx, `valve ${Math.round(clos * 100)}% closed`, x1 + 15, yc + ph / 2 + 26, { align: 'center', size: 11 });
    // labels
    const pv = pk(N), pDisp = (pv + d.p0) / U.phDiv;
    txt(ctx, `t = ${fmt(S.simT)} s   p at valve = ${fmt(pDisp)} ${U.ph}  (Δp = ${fmt(pv / U.phDiv)} ${U.ph})`, 16, 18, { mono: true, bold: true, size: 12 });
    txt(ctx, `c = ${fmt(d.c)} ${U.v}   2L/c = ${fmt(d.Tc)} s   4L/c = ${fmt(2 * d.Tc)} s`, 16, 38, { mono: true, size: 12, color: C.muted });
    if (d.rapid) {
      const ph4 = (S.simT % (2 * d.Tc)) / (d.Tc / 2); const msg = ['High-pressure wave travels from the valve to the reservoir (fluid stops behind it)', 'Wave reflects: pressure returns to normal, flow reverses toward the reservoir', 'Low-pressure wave travels from the valve to the reservoir', 'Pressure recovers and flow returns toward the valve; the cycle repeats'][Math.min(3, Math.floor(ph4))];
      txt(ctx, msg, W / 2, H - 46, { align: 'center', size: 12 });
    } else txt(ctx, `Slow closure: t_c = ${fmt(d.tc)} s > 2L/c, so reflected waves cut the peak`, W / 2, H - 46, { align: 'center', size: 12 });
    // legend
    const lx = W / 2 - 150, ly = H - 22; for (let i = 0; i <= 100; i++) { ctx.fillStyle = pColor(i / 50 - 1); ctx.fillRect(lx + i * 3, ly - 6, 3, 12); }
    txt(ctx, 'low', lx - 6, ly, { align: 'right', size: 11 }); txt(ctx, 'high', lx + 306, ly, { size: 11 }); txt(ctx, 'normal', lx + 150, ly - 14, { align: 'center', size: 10, color: C.muted });
    dimH(ctx, x0, x1, yc - ph / 2 - 26, `L = ${fmt(d.Lp)} ${U.L}`);
  };
  M7.drawAux = function (ctx, W, H, R) {
    const d = R.data, U = S.U, m = d.moc, np = m.N + 1;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const xs = [], ys = [], st = Math.max(1, Math.floor(m.steps / 800));
    for (let k = 0; k <= m.steps; k += st) { xs.push(k * m.dt); ys.push(m.P[k * np + m.N] / U.phDiv); }
    const vm = []; for (let j = 1; j * d.Tc <= m.Tsim && j <= 12; j++) vm.push({ x: j * d.Tc, label: j === 1 ? '2L/c' : `${2 * j}L/c` });
    if (d.tc > 0) vm.push({ x: d.tc, label: 't_c', color: C.danger });
    const mn = Math.min(...ys), mx = Math.max(...ys);
    plot(ctx, { x: 0, y: 0, w: W, h: H }, { title: `Pressure rise at the valve Δp (${U.ph}) vs time`, xs, series: [{ ys, color: C.danger, w: 2 }], xlab: 't (s)', ymin: Math.min(mn * 1.1, -0.05 * mx), ymax: mx * 1.15 + 1e-9, cursor: S.simT, vmarks: vm, hmarks: [{ y: d.dP / U.phDiv, label: `formula ΔP = ${fmt(d.dP / U.phDiv)}`, color: C.egl }, { y: 0, label: '' }] });
  };
  M7.hint = 'Watch at 0.25×: the colored front is the pressure wave moving at speed c.';

  /* ==================================================================
     ISOMETRIC 3D VIEWS (Modules 1, 5, 6)
     World axes: x = flow / jet direction, y = across, z = up.
     Classic isometric projection; the viewer looks along (−1, −1, −1).
     ================================================================== */
  const C30 = Math.cos(PI / 6);
  const isoXY = (x, y, z) => [(x - y) * C30, (x + y) * 0.5 - z];
  function isoFit(A, key, pts3, W, H, pad, dt) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pts3.forEach((p) => { const q = isoXY(p[0], p[1], p[2]); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
    const b = smB(A, key, { x0, x1, y0, y1 }, dt);
    const s = Math.min((W - 2 * pad) / (b.x1 - b.x0 || 1), (H - 2 * pad - 30) / (b.y1 - b.y0 || 1));
    const ox = W / 2 - (s * (b.x0 + b.x1)) / 2, oy = 30 + (H - 30) / 2 - (s * (b.y0 + b.y1)) / 2;
    return { s, P: (x, y, z) => { const q = isoXY(x, y, z); return [ox + q[0] * s, oy + q[1] * s]; } };
  }
  function hull(pts) {
    const p = pts.filter((q) => isFinite(q[0]) && isFinite(q[1])).slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (p.length < 3) return p;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function shade(hex, f) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim()); if (!m) return hex;
    const n = parseInt(m[1], 16); let c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    c = c.map((v) => (f >= 1 ? v + (255 - v) * (f - 1) : v * f));
    return `rgb(${c.map((v) => clamp(Math.round(v), 0, 255)).join(',')})`;
  }
  function fillPoly(ctx, pts, color, alpha, sc, lw) {
    if (!pts || pts.length < 2) return;
    poly(ctx, pts, true); ctx.globalAlpha = alpha === undefined ? 1 : alpha; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1;
    if (sc) { ctx.strokeStyle = sc; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function loop(ctx, pts, color, w, alpha, dash) { if (!pts || pts.length < 2) return; ctx.globalAlpha = alpha === undefined ? 1 : alpha; poly(ctx, pts, true); ctx.strokeStyle = color; ctx.lineWidth = w || 1; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
  function dim3(ctx, a, b, label, color) {
    color = color || C.muted; const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L < 3) return;
    stroke(ctx, [a, b], color, 1); head(ctx, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, a[0], a[1], 6, color); head(ctx, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, b[0], b[1], 6, color);
    txt(ctx, label, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 13, { align: 'center', mono: true, size: 11, color: C.ink, bg: C.bg });
  }
  function groundGrid(ctx, P, x0, x1, y0, y1, z) {
    z = z || 0;
    fillPoly(ctx, [P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)], C.soil, 0.22);
    const st = niceStep(Math.max(x1 - x0, y1 - y0) / 10);
    ctx.globalAlpha = 0.35;
    for (let x = Math.ceil(x0 / st) * st; x <= x1; x += st) stroke(ctx, [P(x, y0, z), P(x, y1, z)], C.muted, 0.6);
    for (let y = Math.ceil(y0 / st) * st; y <= y1; y += st) stroke(ctx, [P(x0, y, z), P(x1, y, z)], C.muted, 0.6);
    ctx.globalAlpha = 1;
    txt(ctx, `grid ${fmt(st)} ${S.U.L}`, P(x1, y1, z)[0] + 6, P(x1, y1, z)[1] + 4, { size: 10, color: C.muted });
  }
  // glass tank: ring(z) gives plan points; draws back shell, water body and surface; returns a finisher for the front outline
  function glassTank(ctx, P, ring, zs, level, bands) {
    const proj = (z) => ring(z).map((p) => P(p[0], p[1], z));
    const shell = hull(zs.flatMap(proj));
    fillPoly(ctx, shell, C.wall, 0.07);
    loop(ctx, proj(zs[zs.length - 1]), C.wall, 1, 0.45);
    if (bands && bands.length) {
      // colour-coded liquid layers, bottom first; each band is its own solid between two planes
      bands.forEach((b, i) => {
        const bz = [b.z0].concat(zs.filter((z) => z > b.z0 && z < b.z1), [b.z1]);
        fillPoly(ctx, hull(bz.flatMap(proj)), b.col, 0.3);
        const top = proj(b.z1);
        if (i === bands.length - 1) { fillPoly(ctx, top, b.col, 0.3); loop(ctx, top, b.col, 1.5); } else loop(ctx, top, b.col, 1.3, 0.95, [6, 3]);
      });
    } else if (level > zs[0] + 1e-9) {
      const wz = zs.filter((z) => z < level).concat([level]);
      fillPoly(ctx, hull(wz.flatMap(proj)), C.water, 0.3);
      const top = proj(level); fillPoly(ctx, top, C.water, 0.3); loop(ctx, top, C.water_deep, 1.5);
    }
    return () => { loop(ctx, shell, C.wall, 2.2); loop(ctx, proj(zs[zs.length - 1]), C.wall, 1.5); loop(ctx, proj(zs[0]), C.wall, 1, 0.4); };
  }
  function circleRing(cx, cy, r, n) { const o = []; n = n || 40; for (let i = 0; i < n; i++) { const t = (2 * PI * i) / n; o.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } return o; }
  function insideRing(ring, x, y) {
    if (ring.length === 4) return x >= ring[0][0] - 1e-9 && x <= ring[1][0] + 1e-9 && y >= ring[0][1] - 1e-9 && y <= ring[2][1] + 1e-9;
    return Math.hypot(x, y) <= Math.hypot(ring[0][0], ring[0][1]) + 1e-9;
  }
  function inRing(ring) {
    // random plan point inside a convex ring (circle or quad)
    if (ring.length === 4) return [lerp(ring[0][0], ring[1][0], rnd()), lerp(ring[0][1], ring[2][1], rnd())];
    let cx = 0, cy = 0; ring.forEach((p) => { cx += p[0]; cy += p[1]; }); cx /= ring.length; cy /= ring.length;
    const r = Math.hypot(ring[0][0] - cx, ring[0][1] - cy) * Math.sqrt(rnd()) * 0.92, a = rnd() * 2 * PI;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  /* ---------------- Module 1: tank and orifice in 3D ---------------- */
  function tankRing(G, I, mode, zr) {
    if (G.sh === 'rect' && mode !== 'steady') { const a = I.Lt / 2, b = I.Bt / 2; return [[-a, -b], [a, -b], [a, b], [-a, b]]; }
    if (G.sh === 'hcyl') { const a = G.hw(zr), b = I.Lh / 2; return [[-a, -b], [a, -b], [a, b], [-a, b]]; }
    return circleRing(0, 0, G.side ? G.Wt / 2 : G.hw(zr));
  }
  M1.drawIso = function (ctx, W, H, R, A, T) {
    const d = R.data, I = d.Iover ? Object.assign({}, S.I, d.Iover) : S.I, th = d.th || 0, mode = d.mode, g = S.U.g, U = S.U, L = U.L;
    if (mode === 'twotank') return drawTwoTankIso(ctx, W, H, R, A, T);
    const G = tankGeom(I, mode);
    const h = sm(A, 'h', mode === 'steady' ? I.H : d.hAt(S.simT), T.rdt, 14);
    const hp = d.hp || 0, heqNow = d.layers ? (d.heqOf ? d.heqOf(Math.max(0, h)) : d.H1 + hp) : h + hp, v = d.Cv * Math.sqrt(2 * g * Math.max(0, heqNow));
    const jetCol = d.layers ? layCol(d.layerAt ? d.layerAt(Math.max(0, h)) : 0) : C.water;
    const yo = I.y, fl = G.side ? Math.max((I.d / 2) * 1.6, 0.03 * G.Ht) : 0, zb = -fl;
    const xo = G.side ? G.Wt / 2 : 0;
    const zs = (a, b) => { if (G.side) return [a, b]; const o = []; for (let i = 0; i <= 24; i++) o.push(a + ((b - a) * i) / 24); return o; };
    const ring = (zr) => tankRing(G, I, mode, zr);
    const ringW = (zw) => ring(zw - yo);
    const xL0 = G.side ? (th ? d.x || 0 : 2 * d.Cv * Math.sqrt(Math.max(0, d.H1 + hp) * yo)) : 0;
    const Rt = Math.max(G.Wt / 2, G.sh === 'rect' && mode !== 'steady' ? I.Bt / 2 : 0, G.sh === 'hcyl' ? I.Lh / 2 : 0);
    const gx0 = -Rt * 1.5, gx1 = xo + xL0 + Math.max(0.4, Rt * 0.6), gy0 = -Rt * 1.5, gy1 = Rt * 1.5;
    const { P, s } = isoFit(A, 'ib', [[gx0, gy0, 0], [gx1, gy0, 0], [gx1, gy1, 0], [gx0, gy1, 0], [-Rt, Rt, yo + G.Ht], [Rt, -Rt, yo + G.Ht], [-Rt, -Rt, yo + G.Ht]].concat(d.layers && !G.side ? [[Rt * 3.2, -Rt * 1.5, yo + G.Ht]] : []).concat(G.side && d.zmax ? [[xo + d.xz, 0, yo + d.zmax]] : []), W, H, 34, T.rdt);
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    groundGrid(ctx, P, gx0, gx1, gy0, gy1);
    // shadows
    fillPoly(ctx, hull(ring(G.side ? 0 : G.Ht / 2).map((p) => P(p[0], p[1], 0))), C.wall, 0.12);
    // legs
    const zl = G.side ? zb : G.sh === 'cone' ? 0.35 * G.Ht : G.sh === 'frustum' ? 0 : 0.25 * G.Ht;
    if (yo + zl > 1e-3) { const rl = ring(zl), idx = rl.length === 4 ? [0, 1, 2, 3] : [5, 15, 25, 35]; idx.forEach((i) => stroke(ctx, [P(rl[i][0] * 0.85, rl[i][1] * 0.85, 0), P(rl[i][0] * 0.85, rl[i][1] * 0.85, yo + zl)], C.wall, 3)); }
    const bands3 = layerBands(d, h, zb);
    const finish = glassTank(ctx, P, ringW, zs(yo + zb, yo + G.Ht), yo + Math.max(h, zb + 1e-6), bands3 && bands3.map((q) => ({ z0: yo + q.z0, z1: yo + q.z1, col: layCol(q.j) })));
    // target levels
    if (mode !== 'steady' && I.H2 >= 0 && I.H2 <= G.Ht) loop(ctx, ring(I.H2).map((p) => P(p[0], p[1], yo + I.H2)), C.egl, 1.2, 0.9, [5, 4]);
    if (mode === 'inflow' && isFinite(d.heq) && d.heq > 0 && d.heq < G.Ht) loop(ctx, ring(d.heq).map((p) => P(p[0], p[1], yo + d.heq)), C.ok, 1.2, 0.9, [2, 3]);
    // particles
    A.ip = A.ip || []; const dt = T.pdt, dj = Math.sqrt(d.Cc) * I.d, v0 = d.v0 || 1;
    if (dt > 0 && v > 1e-6) { let n = dt * 70 * clamp(v / v0, 0.15, 1.5); while (n > 0 && A.ip.length < 480) { if (rnd() < n) A.ip.push({ k: 'j', t: 0, v, o: (rnd() - 0.5) * dj, oz: (rnd() - 0.5) * dj }); n -= 1; } }
    if (dt > 0 && h > 0.01 && A.ip.filter((p) => p.k === 't').length < 140) for (let i = 0; i < 3; i++) { const zr = rnd() * h, q = inRing(ring(zr)); A.ip.push({ k: 't', x: q[0], y: q[1], z: yo + zr }); }
    const keep = []; ctx.fillStyle = C.part;
    for (const p of A.ip) {
      if (p.k === 'j') continue;
      const ox = xo - p.x, oy = -p.y, oz = yo - p.z, r = Math.hypot(ox, oy, oz) + 1e-9, spd = (0.04 + 0.5 * Math.exp(-r / (0.25 * G.Wt + 0.05))) * v * 0.25;
      p.x += (ox / r) * spd * dt; p.y += (oy / r) * spd * dt; p.z += (oz / r) * spd * dt;
      if (r < Math.max(I.d, 0.03 * G.Wt) || p.z > yo + h || !insideRing(ring(clamp(p.z - yo, 0, G.Ht)), p.x, p.y)) continue;
      keep.push(p); const q = P(p.x, p.y, p.z); ctx.globalAlpha = 0.6; ctx.fillRect(q[0] - 1.2, q[1] - 1.2, 2.5, 2.5);
    }
    ctx.globalAlpha = 1;
    finish();
    if (h > 0.001) { const c = P(0, 0, yo + h); surfSym(ctx, c[0], c[1]); }
    if (hp !== 0) { fillPoly(ctx, ring(G.Ht).map((p) => P(p[0], p[1], yo + G.Ht)), C.wall, 0.35, C.wall, 2); const c = P(0, 0, yo + G.Ht); txt(ctx, `closed: p_s = ${fmt(I.ps)} ${U.p}`, c[0], c[1] - 14, { align: 'center', size: 11, mono: true, bg: C.bg }); }
    if (mode === 'inflow' && d.Qin > 0) { const a = P(-G.Wt * 0.2, 0, yo + G.Ht + 0.25 * G.Ht), b = P(-G.Wt * 0.2, 0, yo + h); stroke(ctx, [a, b], C.water, 4); stroke(ctx, [[a[0] - 30, a[1]], a], C.pipe, 7); txt(ctx, `Q_in = ${fmt(d.Qin)} ${U.Q}`, a[0] - 30, a[1] - 14, { size: 11, mono: true }); }
    // orifice opening
    const ro = Math.max(I.d / 2, 2 / s);
    if (G.side) fillPoly(ctx, circleRing(0, 0, ro, 20).map((q) => P(xo, q[0], yo + q[1])), C.bg, 1, C.wall, 1.5);
    else fillPoly(ctx, circleRing(0, 0, ro, 20).map((q) => P(q[0], q[1], yo)), C.bg, 1, C.wall, 1.5);
    // jet tube + shadow
    if (v > 1e-6) {
      const jet = [], shd = [];
      if (G.side) { const tL = jetT(v, th, yo, g); for (let i = 0; i <= 40; i++) { const q = jetPt(v, th, yo, g, (tL * i) / 40); jet.push(P(xo + q[0], 0, q[1])); shd.push(P(xo + q[0], 0, 0)); } }
      else { const tL = (-v + Math.sqrt(v * v + 2 * g * Math.max(yo, 1e-4))) / g; for (let i = 0; i <= 20; i++) { const t = (tL * i) / 20; jet.push(P(0, 0, yo - v * t - (g * t * t) / 2)); } }
      if (shd.length) stroke(ctx, shd, C.wall, 2, [4, 4]);
      ctx.lineCap = 'round'; ctx.globalAlpha = 0.55; poly(ctx, jet); ctx.strokeStyle = jetCol; ctx.lineWidth = Math.max(2.5, dj * s); ctx.stroke(); ctx.globalAlpha = 1; ctx.lineCap = 'butt';
      const end = jet[jet.length - 1]; ctx.beginPath(); ctx.ellipse(end[0], end[1], 9, 4.5, 0, 0, 2 * PI); ctx.fillStyle = C.egl; ctx.globalAlpha = 0.8; ctx.fill(); ctx.globalAlpha = 1;
      if (G.side) { const xl = jetPt(v, th, yo, g, jetT(v, th, yo, g))[0]; dim3(ctx, P(xo, Rt * 0.9, 0), P(xo + xl, Rt * 0.9, 0), `x = ${fmt(xl)} ${L}`); }
      const mk3 = (wx, wz, lab) => { const q = P(xo + wx, 0, wz); ctx.beginPath(); ctx.arc(q[0], q[1], 5, 0, 2 * PI); ctx.strokeStyle = C.egl; ctx.lineWidth = 2; ctx.stroke(); txt(ctx, lab, q[0] + 8, q[1] - 10, { size: 11, mono: true, color: C.egl, bg: C.bg }); };
      if (G.side && mode === 'steady' && I.jfind === 'pt' && isFinite(d.zq)) mk3(d.xq, yo + d.zq, `z = ${fmt(d.zq)} ${L} at x_p`);
      if (G.side && mode === 'steady' && (I.jfind === 'cv' || I.jfind === 'H')) mk3(I.xm, yo - I.ym, `measured (${fmt(I.xm)}, −${fmt(I.ym)})`);
      if (G.side && th) { const q = P(xo, 0, yo); txt(ctx, `θ = ${fmt(th * 180 / PI)}°`, q[0] + 14, q[1] + 18, { size: 11, mono: true, color: C.egl, bg: C.bg }); }
    }
    for (const p of A.ip) {
      if (p.k !== 'j') continue;
      p.t += dt; let x, y, z;
      if (G.side) { const q = jetPt(p.v, th, yo, g, p.t); x = xo + q[0]; y = p.o; z = q[1] + p.oz; } else { x = p.o; y = p.oz; z = yo - p.v * p.t - (g * p.t * p.t) / 2; }
      if (z < 0) continue; keep.push(p); const q = P(x, y, z); ctx.fillStyle = C.part; ctx.fillRect(q[0] - 1.5, q[1] - 1.5, 3, 3);
    }
    A.ip = keep;
    // dimensions on the left and right silhouettes
    const pl = [-Rt / Math.SQRT2 - 0.12 * Rt, Rt / Math.SQRT2 + 0.12 * Rt];
    const a = P(pl[0], pl[1], yo), b = P(pl[0], pl[1], yo + h); dimV(ctx, a[0] - 8, a[1], b[1], `${mode === 'steady' ? 'H' : 'h'} = ${fmt(h)} ${L}`, null, 'left');
    if (yo > 0.01) { const c0 = P(pl[0], pl[1], 0); dimV(ctx, a[0] - 8, c0[1], a[1], `y = ${fmt(yo)} ${L}`, null, 'left'); }
    const vt = P(xo, 0, yo); txt(ctx, `v = ${fmt(v)} ${U.v}`, vt[0] + 12, vt[1] - 14, { size: 11, mono: true, bg: C.bg });
    velScale(ctx, W - 210, 40, s, U.v);
    txt(ctx, 'Isometric 3D view', 16, 18, { bold: true, size: 12, color: C.muted });
    if (d.layers) layerLegend(ctx, d, h, W - 12, 78);
    if (mode !== 'steady' && S.simT >= d.tEnd - 1e-9) txt(ctx, 'H₂ reached — press Reset to run again', W / 2, 18, { align: 'center', bold: true, color: C.egl });
  };
  function drawTwoTankIso(ctx, W, H, R, A, T) {
    const d = R.data, I = S.I, g = S.U.g, U = S.U, L = U.L, H1 = I.H;
    const z = sm(A, 'z', d.hAt(S.simT), T.rdt, 14), dl = H1 - z, base = 0.3 * H1;
    const e1 = base + H1 - (dl * d.A2) / (d.A1 + d.A2), e2 = base + (dl * d.A1) / (d.A1 + d.A2), top = base + H1 * 1.25, zf = -0.08 * H1;
    const isRect = I.shape === 'rect', r1 = isRect ? I.Lt / 2 : I.D / 2, r2 = Math.sqrt(d.A2 / PI), gap = 0.25 * Math.max(r1, r2);
    const c1 = -(r1 + gap), c2 = r2 + gap;
    const ring1 = () => (isRect ? [[c1 - I.Lt / 2, -I.Bt / 2], [c1 + I.Lt / 2, -I.Bt / 2], [c1 + I.Lt / 2, I.Bt / 2], [c1 - I.Lt / 2, I.Bt / 2]] : circleRing(c1, 0, r1));
    const ring2 = () => circleRing(c2, 0, r2);
    const Rm = Math.max(r1, r2, isRect ? I.Bt / 2 : 0);
    const { P, s } = isoFit(A, 'ib2', [[c1 - r1 * 1.4, -Rm * 1.4, zf], [c2 + r2 * 1.4, Rm * 1.4, zf], [c1 - r1, Rm, top], [c2 + r2, -Rm, top], [c1 - r1, -Rm, top]], W, H, 34, T.rdt);
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    groundGrid(ctx, P, c1 - r1 * 1.4, c2 + r2 * 1.4, -Rm * 1.4, Rm * 1.4, zf);
    const f1 = glassTank(ctx, P, ring1, [zf, top], e1); f1();
    const pr = Math.max(I.d / 2, 1.5 / s);
    stroke(ctx, [P(c1 + r1 * (isRect ? 1 : 0.98), 0, 0), P(c2 - r2 * 0.98, 0, 0)], C.pipe, Math.max(5, 2 * pr * s + 3));
    const f2 = glassTank(ctx, P, ring2, [zf, top], e2);
    const v = d.Cv * Math.sqrt(2 * g * Math.max(0, z)); A.ip = A.ip || []; const dt = T.pdt;
    if (dt > 0 && v > 1e-4) { let n = dt * 60 * clamp(v / (d.v0 || 1), 0.2, 1); while (n > 0 && A.ip.length < 400) { if (rnd() < n) A.ip.push({ x: c1 + r1, y: (rnd() - 0.5) * pr, z: (rnd() - 0.5) * pr, vx: v, vy: (rnd() - 0.5) * 0.3 * v, vz: (rnd() - 0.5) * 0.3 * v, life: 0 }); n -= 1; } }
    const keep = []; ctx.fillStyle = C.part;
    for (const p of A.ip) { p.life += dt; if (p.x > c2 - r2) { p.vx *= Math.exp(-dt * 2.2); p.y += p.vy * dt; p.z += p.vz * dt; } p.x += p.vx * dt; if (p.life > 2 || p.x > c2 + r2 || p.z > e2) continue; keep.push(p); const q = P(p.x, p.y, p.z); ctx.globalAlpha = clamp(1 - p.life / 2, 0, 1); ctx.fillRect(q[0] - 1.3, q[1] - 1.3, 2.6, 2.6); }
    ctx.globalAlpha = 1; A.ip = keep; f2();
    const s1 = P(c1, 0, e1), s2 = P(c2, 0, e2); surfSym(ctx, s1[0], s1[1]); surfSym(ctx, s2[0], s2[1]);
    const t1 = P(c1, 0, top), t2 = P(c2, 0, top);
    txt(ctx, `Tank 1, A₁ = ${fmt(d.A1)} ${U.A}`, t1[0], t1[1] - 26, { align: 'center', bold: true, size: 12, bg: C.bg });
    txt(ctx, `Tank 2, A₂ = ${fmt(d.A2)} ${U.A}`, t2[0], t2[1] - 26, { align: 'center', bold: true, size: 12, bg: C.bg });
    const xm = P(0, -Rm, 0)[0]; dimV(ctx, xm, P(0, -Rm, e2)[1], P(0, -Rm, e1)[1], `ΔH = ${fmt(z)} ${L}`);
    velScale(ctx, W - 210, 40, s, U.v);
    txt(ctx, 'Isometric 3D view', 16, 18, { bold: true, size: 12, color: C.muted });
    if (S.simT >= d.tEnd - 1e-9) txt(ctx, 'H₂ reached — press Reset to run again', W / 2, 18, { align: 'center', bold: true, color: C.egl });
  }

  /* ---------------- Module 5: weir in a channel, 3D ---------------- */
  M5.drawIso = function (ctx, W, H, R, A, T) {
    const d = R.data, I = S.I, U = S.U, L = U.L, g = U.g, mode = d.mode;
    const Hh = sm(A, 'H', mode === 'unsteady' ? d.hAt(S.simT) : d.H, T.rdt, 10);
    const Pw = sm(A, 'P', I.P, T.rdt, 6), ht = mode === 'unsteady' ? -0.5 * Math.max(Pw, 0.2) : sm(A, 'ht', I.ht, T.rdt, 6);
    const Q = mode === 'unsteady' ? d.m * d.Lw * Math.pow(Hh, 1.5) : d.Q;
    const broad = mode === 'broad', Lb = broad ? 3 * Hh : 0;
    const tn = Math.tan(((I.theta || 90) * PI) / 360);
    const b = mode === 'vnotch' ? Math.max(2 * tn * Hh * 1.6, 0.3) : Math.max(d.b || I.L, I.L), bh = b / 2;
    const Lw = I.L, n = +I.n;
    // crest elevation across the channel (notch bottom); Infinity where the plate blocks
    const zb = (y) => {
      if (mode === 'vnotch') return Pw + Math.abs(y) / tn;
      if (mode === 'trap') { const a = Math.abs(y) - Lw / 2; return a <= 0 ? Pw : I.zs > 0 ? Pw + a / I.zs : Infinity; }
      if (mode === 'rect' && n > 0) { const y0 = n === 2 ? -Lw / 2 : -bh; return y >= y0 && y <= y0 + Lw ? Pw : Infinity; }
      return Pw;
    };
    const ycrF = broad ? 2 / 3 : 0.85;
    const surf = (x) => Pw + Hh - Hh * (1 - ycrF) * Math.exp(x / (broad ? 1.5 * Hh : Hh));
    const pool = Math.max(0.1 * (Pw + Hh), Pw + ht), Hch = (Pw + Hh) * 1.3;
    const traj = (y, t, upper) => {
      const hl = Math.max(0, Pw + Hh - zb(y)), ul = broad ? Math.sqrt(g * ycrF * hl) : 0.5757 * Math.sqrt(g * hl), vy = broad || upper ? 0 : Math.sqrt(0.22 * g * hl);
      return upper ? [Lb + 0.95 * ul * t, zb(y) + ycrF * hl - 0.5 * g * t * t] : [Lb + ul * t, zb(y) + vy * t - 0.5 * g * t * t];
    };
    const tEnd = (y, upper) => { const hl = Math.max(0, Pw + Hh - zb(y)); const z0 = upper ? zb(y) + ycrF * hl : zb(y), vy = broad || upper ? 0 : Math.sqrt(0.22 * g * hl); return (vy + Math.sqrt(vy * vy + 2 * g * Math.max(0, z0 - pool))) / g; };
    const xLand = traj(0, tEnd(0, false), false)[0];
    const Hs = Math.max(Hh, 0.05), Lu = Math.max(4 * Hs, Pw, 0.6, 0.6 * b), Ld = Math.max(xLand * 1.7, Lb + 2.5 * Hs, 0.6, 0.6 * b);
    const { P, s } = isoFit(A, 'wb', [[-Lu, -bh, 0], [Ld, -bh, 0], [Ld, bh, 0], [-Lu, bh, 0], [-Lu, -bh, Hch], [Ld, -bh, Hch], [-Lu, bh, Hch]], W, H, 30, T.rdt);
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    // floor and back wall
    fillPoly(ctx, [P(-Lu, -bh, 0), P(Ld, -bh, 0), P(Ld, bh, 0), P(-Lu, bh, 0)], shade(C.soil, 1.05), 0.6, C.wall, 1);
    fillPoly(ctx, [P(-Lu, -bh, 0), P(Ld, -bh, 0), P(Ld, -bh, Hch), P(-Lu, -bh, Hch)], C.wall, 0.12, C.wall, 1);
    // upstream water (top surface + near face)
    const N = 30, xsU = []; for (let i = 0; i <= N; i++) xsU.push(-Lu + (Lu * i) / N);
    fillPoly(ctx, xsU.map((x) => P(x, -bh, surf(x))).concat(xsU.slice().reverse().map((x) => P(x, bh, surf(x)))), C.water, 0.4);
    fillPoly(ctx, [P(-Lu, bh, 0)].concat(xsU.map((x) => P(x, bh, surf(x)))).concat([P(0, bh, 0)]), C.water, 0.28);
    stroke(ctx, xsU.map((x) => P(x, bh, surf(x))), C.water_deep, 1.5);
    // upstream particles
    A.wp = A.wp || []; const dt = T.pdt;
    while (A.wp.filter((p) => p.k === 'u').length < 220) A.wp.push({ k: 'u', x: -Lu + rnd() * Lu, fy: rnd() * 2 - 1, s: rnd() });
    const hlOK = (y) => Pw + Hh - zb(y) > 0.004;
    const keep = [];
    const drawPt = (q, col, a) => { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(q[0] - 1.2, q[1] - 1.2, 2.5, 2.5); ctx.globalAlpha = 1; };
    for (const p of A.wp) {
      if (p.k !== 'u') continue;
      if (p.fy === undefined) p.fy = clamp(p.y / bh, -1, 1);
      p.y = p.fy * bh * 0.96;
      if (p.x < -Lu || p.x > Math.max(Lb, 0) + 1e-9) { p.x = -Lu + rnd() * Lu; p.s = rnd(); }
      const lb = Pw * sstep((p.x + Lu * 0.55) / (Lu * 0.55)), top = surf(Math.min(p.x, 0)), depth = Math.max(top - lb, 1e-3), z = lb + p.s * depth * 0.97;
      p.x += (Q / (b * depth)) * dt;
      if (p.x >= 0 && !broad) { if (z > zb(p.y) && hlOK(p.y)) { p.k = 'n'; p.t = 0; p.s = clamp((z - zb(p.y)) / (ycrF * (Pw + Hh - zb(p.y))), 0, 1); keep.push(p); continue; } p.x = -Lu; }
      if (broad && p.x >= Lb) { p.k = 'n'; p.t = 0; keep.push(p); continue; }
      if (p.x > 0) { if (p.x < Lb) { const zc = Pw + p.s * lerp(surf(0) - Pw, ycrF * Hh, p.x / Lb); keep.push(p); p.zc = zc; continue; } }
      keep.push(p); drawPt(P(p.x, p.y, z), C.part, 0.7);
    }
    // weir: plate with notch, or broad crest block
    const notch = mode === 'vnotch' ? [[-Math.min(bh, (Hch - Pw) * tn), Pw + Math.min(bh, (Hch - Pw) * tn) / tn], [0, Pw], [Math.min(bh, (Hch - Pw) * tn), Pw + Math.min(bh, (Hch - Pw) * tn) / tn]]
      : mode === 'trap' ? [[-Lw / 2 - I.zs * (Hch - Pw), Hch], [-Lw / 2, Pw], [Lw / 2, Pw], [Lw / 2 + I.zs * (Hch - Pw), Hch]].map((q) => [clamp(q[0], -bh, bh), q[1]])
        : mode === 'rect' && n > 0 ? (() => { const y0 = n === 2 ? -Lw / 2 : -bh; return [[y0, Hch], [y0, Pw], [y0 + Lw, Pw], [y0 + Lw, Hch]]; })()
          : [[-bh, Hch], [-bh, Pw], [bh, Pw], [bh, Hch]];
    if (!broad) {
      ctx.beginPath(); [[-bh, 0], [bh, 0], [bh, Hch], [-bh, Hch]].forEach((q, i) => { const r = P(0, q[0], q[1]); i ? ctx.lineTo(r[0], r[1]) : ctx.moveTo(r[0], r[1]); }); ctx.closePath();
      notch.forEach((q, i) => { const r = P(0, q[0], q[1]); i ? ctx.lineTo(r[0], r[1]) : ctx.moveTo(r[0], r[1]); }); ctx.closePath();
      ctx.fillStyle = shade(C.wall, 1.0); ctx.globalAlpha = 0.85; ctx.fill('evenodd'); ctx.globalAlpha = 1; ctx.strokeStyle = C.wall; ctx.lineWidth = 1.2; ctx.stroke();
      // water section in the notch
      const zw = Pw + ycrF * Hh, ys = []; for (let i = 0; i <= 80; i++) { const y = -bh + (b * i) / 80; if (zb(y) < zw) ys.push(y); }
      if (ys.length > 1) fillPoly(ctx, ys.map((y) => P(0, y, zb(y))).concat(ys.slice().reverse().map((y) => P(0, y, zw))), C.water, 0.5);
    } else {
      fillPoly(ctx, [P(0, -bh, Pw), P(Lb, -bh, Pw), P(Lb, bh, Pw), P(0, bh, Pw)], shade(C.wall, 1.25), 0.9, C.wall, 1);
      fillPoly(ctx, [P(0, bh, 0), P(Lb, bh, 0), P(Lb, bh, Pw), P(0, bh, Pw)], shade(C.wall, 0.85), 0.9, C.wall, 1);
      fillPoly(ctx, [P(Lb, -bh, 0), P(Lb, bh, 0), P(Lb, bh, Pw), P(Lb, -bh, Pw)], C.wall, 0.95, C.wall, 1);
      const xs = []; for (let i = 0; i <= 12; i++) xs.push((Lb * i) / 12);
      const zc = (x) => Pw + lerp(surf(0) - Pw, ycrF * Hh, x / Lb);
      fillPoly(ctx, xs.map((x) => P(x, -bh, zc(x))).concat(xs.slice().reverse().map((x) => P(x, bh, zc(x)))), C.water, 0.4);
      fillPoly(ctx, [P(0, bh, Pw)].concat(xs.map((x) => P(x, bh, zc(x)))).concat([P(Lb, bh, Pw)]), C.water, 0.3);
      for (const p of A.wp) if (p.k === 'u' && p.x > 0 && p.x < Lb) drawPt(P(p.x, p.y, p.zc || Pw), C.part, 0.8);
    }
    // downstream pool
    const xs0 = broad ? Lb : 0;
    fillPoly(ctx, [P(xs0, -bh, pool), P(Ld, -bh, pool), P(Ld, bh, pool), P(xs0, bh, pool)], C.water, 0.38, C.water_deep, 1);
    fillPoly(ctx, [P(xs0, bh, 0), P(Ld, bh, 0), P(Ld, bh, pool), P(xs0, bh, pool)], C.water, 0.25);
    fillPoly(ctx, [P(Ld, -bh, 0), P(Ld, bh, 0), P(Ld, bh, pool), P(Ld, -bh, pool)], C.water, 0.3);
    // aerated pocket at the centre slice
    if (pool < Pw && !broad && hlOK(0)) { const tl = tEnd(0, false), pts = [P(0, 0, Pw)]; for (let i = 0; i <= 20; i++) { const q = traj(0, (tl * i) / 20, false); pts.push(P(q[0], 0, q[1])); } pts.push(P(0, 0, pool)); fillPoly(ctx, pts, C.air, 0.85); const c = P(traj(0, tl * 0.3, false)[0] * 0.4, 0, (Pw + pool) / 2); txt(ctx, 'air', c[0], c[1], { size: 10, color: C.muted, align: 'center' }); }
    // nappe as thin translucent slices across the opening
    const NS = 28;
    for (let i = 0; i <= NS; i++) {
      const y = -bh + (b * i) / NS; if (!hlOK(y)) continue;
      const tu = tEnd(y, true), tl = tEnd(y, false), up = [], lo = [];
      for (let k = 0; k <= 16; k++) { const a = traj(y, (tu * k) / 16, true), c = traj(y, (tl * k) / 16, false); up.push(P(a[0], y, a[1])); lo.push(P(c[0], y, c[1])); }
      fillPoly(ctx, up.concat(lo.reverse()), C.water, 0.13); stroke(ctx, up, C.water_deep, 0.8, null); ctx.globalAlpha = 1;
    }
    // nappe and splash particles
    for (const p of A.wp) {
      if (p.k === 'u') continue;
      if (p.k === 'n') {
        p.y = (p.fy === undefined ? clamp(p.y / bh, -1, 1) : p.fy) * bh * 0.96;
        p.t += dt; const a = traj(p.y, p.t, false), c = traj(p.y, p.t, true), x = lerp(a[0], c[0], p.s), z = lerp(a[1], c[1], p.s);
        if (z <= pool) { p.k = 's'; p.x = x; p.z = pool; p.vx = (rnd() - 0.2) * 0.6 * Math.sqrt(g * Hh); p.vz = rnd() * Math.sqrt(2 * g * Math.max(0.01, Pw + Hh - pool)) * 0.35; p.vy = (rnd() - 0.5) * 0.3; p.life = 0; }
        else drawPt(P(x, p.y, z), C.part, 1);
        keep.push(p);
      } else {
        p.life += dt; p.x += p.vx * dt; p.y = clamp(p.y + p.vy * dt, -bh, bh); p.z += p.vz * dt; p.vz -= g * dt;
        if (p.z < pool && p.vz < 0) { p.vz = 0; p.z = pool * (1 - 0.3 * rnd()); p.vx = Math.max(0.05, Q / (b * Math.max(pool, 0.05))); p.vy = 0; }
        if (p.life > 2.5 || p.x > Ld || p.x < 0) continue;
        drawPt(P(p.x, p.y, p.z), p.life < 0.5 ? C.foam : C.part, clamp(1 - p.life / 2.5, 0, 1)); keep.push(p);
      }
    }
    A.wp = keep.slice(-480);
    // near glass wall + labels
    fillPoly(ctx, [P(-Lu, bh, 0), P(Ld, bh, 0), P(Ld, bh, Hch), P(-Lu, bh, Hch)], C.wall, 0.04, C.wall, 1.2);
    const s0 = P(-Lu * 0.6, bh, surf(-Lu * 0.6)); surfSym(ctx, s0[0], s0[1]);
    const dx = P(-Lu * 0.25, bh, 0)[0];
    dimV(ctx, dx, P(-Lu * 0.25, bh, Pw)[1], P(-Lu * 0.25, bh, Pw + Hh)[1], `H = ${fmt(Hh)} ${L}`);
    if (Pw > 0.01) dimV(ctx, dx, P(-Lu * 0.25, bh, 0)[1], P(-Lu * 0.25, bh, Pw)[1], `P = ${fmt(Pw)} ${L}`);
    if (mode !== 'vnotch') dim3(ctx, P(-Lu, -bh, Hch * 1.02), P(-Lu, bh, Hch * 1.02), `b = ${fmt(b)} ${L}`); // the V-notch view is drawn narrower than the channel, so it gets no width label
    if (ht > 0) txt(ctx, 'SUBMERGED — tailwater above the crest', W / 2, 18, { align: 'center', bold: true, color: C.danger });
    txt(ctx, `Q = ${fmt(Q)} ${U.Q}`, 16, 40, { size: 13, bold: true, mono: true });
    txt(ctx, 'Isometric 3D view', 16, 18, { bold: true, size: 12, color: C.muted });
    velScale(ctx, W - 210, 46, s, U.v);
    if (mode === 'unsteady' && S.simT >= d.tEnd - 1e-9) txt(ctx, 'H₂ reached — press Reset to run again', W / 2, 36, { align: 'center', bold: true, color: C.egl });
  };

  /* ---------------- Module 6: open channel reach, 3D ---------------- */
  function m6State(R, A) {
    const d = R.data, I = S.I;
    if (d.mode === 'efficient') {
      const ph = (A.mt || 0) % 7, f = ph < 1.5 ? 0 : ph < 3.5 ? sstep((ph - 1.5) / 2) : ph < 5 ? 1 : 1 - sstep((ph - 5) / 2);
      const from = d.morphFrom, to = d.morphTo;
      if (d.shape === 'circ' || !isFinite(from.y)) return { shape: d.shape, G: to.G, y: to.y };
      if (d.shape === 'semi') return { shape: d.shape, G: { D: lerp(from.G.D, to.G.D, f) }, y: lerp(from.y, to.y, f) };
      return { shape: d.shape, G: { b: lerp(from.G.b, to.G.b, f), z: lerp(from.G.z, to.G.z, f), D: 1 }, y: lerp(from.y, to.y, f) };
    }
    return { shape: d.shape, G: chanG(d.shape, I), y: d.y };
  }
  M6.drawIso = function (ctx, W, H, R, A, T) {
    const d = R.data, U = S.U, L = U.L, I = S.I;
    const st = m6State(R, A), shape = st.shape, y = sm(A, 'iy', st.y, T.rdt, 6), v = sm(A, 'v', d.v, T.rdt, 4);
    const Sbed = d.S || I.S, ang = ((2 + (10 * (Math.log10(Math.max(Sbed, 1e-5)) + 5)) / 4) * PI) / 180, Sv = Math.tan(ang) * 0.8;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const circ = shape === 'circ', semi = shape === 'semi', round = circ || semi, D = st.G.D, b = round ? 0 : sm(A, 'ib', st.G.b, T.rdt, 6), z = round ? 0 : sm(A, 'iz', st.G.z, T.rdt, 6);
    const yTop = circ ? D : semi ? D / 2 : Math.max(1.35 * y, 0.05), Tt = round ? D : b + 2 * z * yTop;
    const Tw = round ? D * Math.sin(Math.acos(1 - (2 * Math.min(y, yTop)) / D)) : b + 2 * z * y;
    const Yo = Tt / 2 + 0.3 * Math.max(Tt, y), zB = circ ? -0.15 * D : -0.35 * yTop, Lx = Math.max(2.2 * Tt, 5 * y);
    const { P: P0, s } = isoFit(A, 'cb', [[0, -Yo, zB], [Lx, -Yo, zB - Sv * Lx], [Lx, Yo, zB - Sv * Lx], [0, Yo, zB], [0, -Yo, yTop], [0, Yo, yTop], [Lx, Yo, yTop - Sv * Lx]], W, H, 30, T.rdt);
    const P = (x, yy, zz) => P0(x, yy, zz - Sv * x);
    const halfW = (zz) => (round ? Math.sqrt(Math.max(0, zz * (D - zz))) : b / 2 + z * zz);
    // particles (positions in channel coordinates)
    A.cp = A.cp || []; const dt = T.pdt, vis = 45 / s;
    while (A.cp.length < 360) A.cp.push({ x: rnd() * Lx, s: rnd(), w: rnd() * 2 - 1 });
    const drawParticles = () => {
      ctx.lineCap = 'round';
      for (const p of A.cp) {
        const u = v * (8 / 7) * Math.pow(Math.max(p.s, 0.02), 1 / 7) * ((1 - 0.35 * p.w * p.w) / 0.8833);
        p.x += u * vis * dt; if (p.x > Lx) { p.x -= Lx; p.s = rnd(); p.w = rnd() * 2 - 1; }
        const zz = p.s * y * 0.97, yy = p.w * halfW(zz) * 0.95, a = P(p.x, yy, zz), len = clamp(u * vis * 0.12, 0.002 * Lx, 0.05 * Lx), c = P(p.x - len, yy, zz);
        ctx.strokeStyle = C.part; ctx.globalAlpha = (0.35 + 0.55 * p.s) * (1 - 0.4 * Math.abs(p.w)); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(a[0], a[1]); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.lineCap = 'butt';
    };
    const egl = () => { if (!S.egl) return; const hv = (v * v) / (2 * U.g); stroke(ctx, [P(0, 0, y + hv), P(Lx, 0, y + hv)], C.egl, 1.6, [8, 5]); let fq = 0; while (fq < 0.6 && P(fq * Lx, 0, y + hv)[1] < 74) fq += 0.05; const q = P(fq * Lx, 0, y + hv); txt(ctx, `EGL  v²/2g = ${fmt(hv)} ${L}`, q[0] + 8, q[1] - 10, { color: C.egl, size: 11, bold: true, bg: C.bg }); };
    if (circ) {
      const R2 = D / 2, ring = (x) => circleRing(0, R2, R2, 48).map((q) => P(x, q[0], q[1]));
      const seg = (x) => { const o = []; circleRing(0, R2, R2, 96).forEach((q) => { if (q[1] <= y) o.push(P(x, q[0], q[1])); }); o.push(P(x, -Tw / 2, y), P(x, Tw / 2, y)); return o; };
      groundGrid(ctx, P0, -0.1 * Lx, Lx * 1.05, -Yo, Yo, zB);
      // saddle supports: a block from the ground up to the pipe, its top shaped to the pipe
      [0.18, 0.82].forEach((f) => {
        const x0 = f * Lx - 0.035 * Lx, x1 = f * Lx + 0.035 * Lx, ys = 0.75 * R2, cradle = [];
        for (let i = 0; i <= 12; i++) { const yy = -ys + (2 * ys * i) / 12; cradle.push([yy, R2 - Math.sqrt(Math.max(0, R2 * R2 - yy * yy))]); }
        fillPoly(ctx, [P(x0, ys, zB), P(x1, ys, zB), P(x1, ys, cradle[12][1]), P(x0, ys, cradle[12][1])], shade(C.wall, 1.25), 0.85, C.wall, 0.8);
        fillPoly(ctx, [[-ys, zB], ...cradle, [ys, zB]].map((q) => P(x1, q[0], q[1])), shade(C.wall, 1.05), 0.85, C.wall, 0.8);
      });
      const shell = hull(ring(0).concat(ring(Lx))); fillPoly(ctx, shell, C.pipe, 0.16);
      if (y > 1e-4) { fillPoly(ctx, hull(seg(0).concat(seg(Lx))), C.water, 0.32); fillPoly(ctx, [P(0, -Tw / 2, y), P(Lx, -Tw / 2, y), P(Lx, Tw / 2, y), P(0, Tw / 2, y)], C.water, 0.35, C.water_deep, 1); }
      drawParticles();
      loop(ctx, shell, C.wall, 2); loop(ctx, ring(Lx), C.wall, 3);
      if (y > 1e-4) { fillPoly(ctx, hull(seg(Lx)), C.water, 0.5); const th = 2 * Math.acos(1 - (2 * Math.min(y, D)) / D), arc = []; for (let i = 0; i <= 40; i++) { const t = -PI / 2 - th / 2 + (th * i) / 40; arc.push(P(Lx, R2 * Math.cos(t), R2 + R2 * Math.sin(t))); } stroke(ctx, arc, C.egl, 3.5); }
      egl();
      dimV(ctx, P(Lx, -R2 * 1.25, 0)[0], P(Lx, -R2 * 1.25, 0)[1], P(Lx, -R2 * 1.25, y)[1], `y = ${fmt(y)} ${L}`, null, 'left');
      dim3(ctx, P(Lx, R2 * 1.4, 0), P(Lx, R2 * 1.4, D), `D = ${fmt(D)} ${L}`);
    } else {
      const R2 = D / 2, arcPts = (zMax) => { const o = []; for (let i = 0; i <= 48; i++) { const t = PI + (PI * i) / 48, q = [R2 * Math.cos(t), R2 + R2 * Math.sin(t)]; if (q[1] <= zMax + 1e-9) o.push(q); } return o; };
      const prof = semi ? arcPts(R2) : b > 1e-6 ? [[-Tt / 2, yTop], [-b / 2, 0], [b / 2, 0], [Tt / 2, yTop]] : [[-Tt / 2, yTop], [0, 0], [Tt / 2, yTop]];
      const quad = (y0, z0, y1, z1) => [P(0, y0, z0), P(Lx, y0, z0), P(Lx, y1, z1), P(0, y1, z1)];
      fillPoly(ctx, quad(-Yo, yTop, -Tt / 2, yTop), shade(C.soil, 1.12), 1, C.wall, 0.8);
      const lined = (d.n || I.n) < 0.0165, base = lined ? C.pipe : C.soil;
      for (let i = 0; i < prof.length - 1; i++) {
        const a = prof[i], c = prof[i + 1], dy = c[0] - a[0], dz = c[1] - a[1], ln = Math.hypot(dy, dz) || 1, ny = -dz / ln, nz = dy / ln;
        if (ny + nz <= 0.001) continue;
        fillPoly(ctx, quad(a[0], a[1], c[0], c[1]), shade(base, 0.75 + 0.35 * nz), 1, semi ? null : C.wall, 0.8); // a curved bed has no facet edges
      }
      if (y > 1e-4) fillPoly(ctx, [P(0, -Tw / 2, y), P(Lx, -Tw / 2, y), P(Lx, Tw / 2, y), P(0, Tw / 2, y)], C.water, 0.42, C.water_deep, 1);
      drawParticles();
      fillPoly(ctx, quad(Tt / 2, yTop, Yo, yTop), shade(C.soil, 1.12), 1, C.wall, 0.8);
      fillPoly(ctx, [P(0, Yo, zB), P(Lx, Yo, zB), P(Lx, Yo, yTop), P(0, Yo, yTop)], shade(C.soil, 0.85), 1, C.wall, 0.8);
      // end face (cut section) at x = Lx
      const face = [[-Yo, yTop], ...prof, [Yo, yTop], [Yo, zB], [-Yo, zB]].map((q) => P(Lx, q[0], q[1]));
      fillPoly(ctx, face, shade(C.soil, 0.7), 1, C.wall, 1.2);
      stroke(ctx, prof.map((q) => P(Lx, q[0], q[1])), lined ? C.pipe : C.wall, lined ? 4 : 1.5);
      if (y > 1e-4) {
        const ws = semi ? [[-Tw / 2, y], ...arcPts(y), [Tw / 2, y]] : b > 1e-6 ? [[-Tw / 2, y], [-b / 2, 0], [b / 2, 0], [Tw / 2, y]] : [[-Tw / 2, y], [0, 0], [Tw / 2, y]];
        fillPoly(ctx, ws.map((q) => P(Lx, q[0], q[1])), C.water, 0.55);
        stroke(ctx, ws.map((q) => P(Lx, q[0], q[1])), C.egl, 3.5);
        stroke(ctx, [P(Lx, -Tw / 2, y), P(Lx, Tw / 2, y)], C.water_deep, 1.5);
      }
      egl();
      const dy = Tt / 2 + 0.55 * (Yo - Tt / 2); dimV(ctx, P(Lx, dy, 0)[0], P(Lx, dy, 0)[1], P(Lx, dy, y)[1], `y = ${fmt(y)} ${L}`, null, 'left');
      dim3(ctx, P(Lx, -Tw / 2, y + 0.12 * yTop), P(Lx, Tw / 2, y + 0.12 * yTop), `T = ${fmt(Tw)} ${L}`);
      if (b > 1e-6) dim3(ctx, P(Lx, -b / 2, zB * 0.55), P(Lx, b / 2, zB * 0.55), `b = ${fmt(b)} ${L}`);
      if (semi) dim3(ctx, P(Lx, -R2, zB * 0.55), P(Lx, R2, zB * 0.55), `D = 2r = ${fmt(D)} ${L}`);
      const sf = P(Lx * 0.3, 0, y); surfSym(ctx, sf[0], sf[1]);
    }
    const dlab = d.mode === 'efficient' ? `Optimum vs your section (morphing), Q = ${fmt(d.Q)} ${U.Q}` : `v = ${fmt(d.v)} ${U.v}   Q = ${fmt(d.Q)} ${U.Q}   S = ${fmt(Sbed)}   n = ${fmt(d.n || I.n)}` + (isFinite(d.Fr) ? `   F = ${fmt(d.Fr)}` : '');
    txt(ctx, dlab, 16, 40, { size: 12, mono: true, bold: true });
    txt(ctx, 'Isometric 3D view', 16, 18, { bold: true, size: 12, color: C.muted });
    txt(ctx, 'slope drawn exaggerated · end face is a cut section · orange = wetted perimeter', W - 16, H - 12, { align: 'right', size: 10.5, color: C.muted });
    velScale(ctx, W - 210, 74, 45, U.v);
  };

  /* ------------------------------------------------------------------
     Extension modules (modsB.js …): each registers itself through
     window.HYD_EXT and may splice its module in after an existing one.
     ------------------------------------------------------------------ */
  (window.HYD_EXT || []).forEach((fn) => {
    try { fn({ MODS, S, C, fmt, clamp, lerp, sstep, txt, poly, stroke, head, arrow, dimV, dimH, surfSym, ground, datum, velScale, plot, view, sm, smB, pipe3, pipePath, flange, gauge, valveSym, flowDots, reservoir, shade, niceStep, niceTicks, SG_CHIPS, LSG_CHIPS, SUB, FONT, MONO }); } catch (e) { console.error(e); }
  });

  /* ==================================================================
     UI
     ================================================================== */
  const cur = () => MODS[S.mi];
  const curMode = () => S.mode[cur().id];
  function defaults(m) { const P = {}; m.params.forEach((p) => (P[p.k] = p.def)); return P; }
  MODS.forEach((m) => { S.P[m.id] = defaults(m); S.mode[m.id] = m.modes[0][0]; S.A[m.id] = {}; });
  const visible = (m, p, P, mode) => (!p.modes || p.modes.includes(mode)) && (!p.show || p.show(P, mode));

  function buildTabs() {
    const nav = $('#tabs'); nav.innerHTML = '';
    MODS.forEach((m, i) => { const b = document.createElement('button'); b.setAttribute('role', 'tab'); b.id = 'tab-' + m.id; b.innerHTML = `<span class="n">${i + 1}</span>${m.tab}`; b.onclick = () => selectModule(i); nav.appendChild(b); });
  }
  function selectModule(i) {
    S.mi = i; S.click = null; S.clickInfo = null;
    document.querySelectorAll('#tabs button').forEach((b, j) => b.setAttribute('aria-selected', j === i ? 'true' : 'false'));
    $('#modTitle').textContent = `${i + 1}. ${cur().title}`;
    const sel = $('#presetSel'); sel.innerHTML = '<option value="">Load example…</option>' + cur().presets.map((p, j) => `<option value="${j}">${p.name}</option>`).join('');
    setSpeed(cur().speed[curMode()] || 1);
    resetSim(); renderControls(); recompute();
    $('#viewSeg').hidden = !cur().drawIso; updView();
    $('#hint').textContent = cur().hint || '';
  }
  function setMode(mode, applyDefaults) {
    const m = cur(); S.mode[m.id] = mode; S.click = null; S.clickInfo = null;
    if (applyDefaults && m.modeDefaults && m.modeDefaults[mode]) Object.assign(S.P[m.id], m.modeDefaults[mode]);
    setSpeed(m.speed[mode] || 1); resetSim(); renderControls(); recompute();
  }
  function resetSim() { S.simT = 0; const A = S.A[cur().id]; for (const k in A) delete A[k]; S.playing = true; updPlay(); }
  function updPlay() { const b = $('#playBtn'); b.textContent = S.playing ? 'Pause' : 'Play'; }
  function setSpeed(v) { S.speed = v; $('#speedSel').value = String(v); }

  function renderControls() {
    const m = cur(), P = S.P[m.id], mode = curMode(), el = $('#left');
    let h = '';
    if (m.modes.length > 1) { h += '<div class="ph">Mode</div><div class="modes" role="group" aria-label="Sub-mode">' + m.modes.map((md) => `<button data-mode="${md[0]}" aria-pressed="${md[0] === mode}">${md[1]}</button>`).join('') + '</div>'; }
    h += '<div class="ph">Inputs</div>';
    m.params.forEach((p) => {
      if (!visible(m, p, P, mode)) return;
      const label = p.labelFn ? p.labelFn(P, mode) : p.label;
      if (p.type === 'head') { h += `<div class="grp">${label}</div>`; return; }
      if (p.type === 'select') { h += `<div class="prm"><div class="prm-h"><label for="p-${p.k}">${label}</label></div><select id="p-${p.k}" data-k="${p.k}">${p.options.map((o) => `<option value="${o[0]}"${String(P[p.k]) === String(o[0]) ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></div>`; return; }
      if (p.type === 'check') { h += `<div class="prm check"><label><input type="checkbox" id="p-${p.k}" data-k="${p.k}"${P[p.k] ? ' checked' : ''}> ${label}</label></div>`; return; }
      const u = unitOf(p), mn = toDisp(p, p.min), mxv = toDisp(p, p.maxFn ? Math.min(p.max, p.maxFn(P, mode)) : p.max), st = S.units === 'SI' ? p.step : niceStep(p.step * dimOf(p).en[1]);
      h += `<div class="prm"><div class="prm-h"><label for="p-${p.k}">${label}</label><span class="u">${u}</span></div>
        <div class="prm-c"><input type="range" id="r-${p.k}" data-k="${p.k}" aria-label="${label} slider" min="0" max="1000" step="1"><input type="number" id="p-${p.k}" data-k="${p.k}" step="${st}" min="${+mn.toPrecision(6)}" max="${+mxv.toPrecision(6)}"></div>
        <div class="prm-r" id="rg-${p.k}">${fmt(mn)} – ${fmt(mxv)} ${u} · step ${fmt(st)}${p.log ? ' · log slider' : ''}</div>
        ${p.chips ? `<div class="chips">${p.chips.map((c) => `<button data-chip="${p.k}" data-v="${c[1]}">${c[0]} ${c[1]}</button>`).join('')}</div>` : ''}</div>`;
    });
    el.innerHTML = h;
    el.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => setMode(b.dataset.mode, true)));
    el.querySelectorAll('select[data-k]').forEach((s) => (s.onchange = () => { const p = m.params.find((q) => q.k === s.dataset.k); P[p.k] = s.value; p.onSet && p.onSet(P); S.click = null; renderControls(); recompute(true); }));
    el.querySelectorAll('input[type=checkbox][data-k]').forEach((s) => (s.onchange = () => { const p = m.params.find((q) => q.k === s.dataset.k); P[p.k] = s.checked; p.onSet && p.onSet(P); renderControls(); recompute(true); }));
    el.querySelectorAll('input[type=range]').forEach((r) => (r.oninput = () => { const p = m.params.find((q) => q.k === r.dataset.k); setParam(m, p.k, sliderToVal(p, P, +r.value), 'range'); }));
    el.querySelectorAll('input[type=number]').forEach((r) => {
      r.oninput = () => { const v = parseFloat(r.value); if (!isFinite(v)) return; const p = m.params.find((q) => q.k === r.dataset.k); setParam(m, p.k, fromDisp(p, v), 'number'); };
      r.onchange = () => syncControls();
    });
    el.querySelectorAll('[data-chip]').forEach((b) => (b.onclick = () => setParam(m, b.dataset.chip, +b.dataset.v)));
    syncControls();
  }
  function range(p, P) { return [p.min, p.maxFn ? Math.max(p.min, Math.min(p.max, p.maxFn(P, curMode()))) : p.max]; }
  function sliderToVal(p, P, r) { const [a, b] = range(p, P); let v = p.log && a > 0 ? a * Math.pow(b / a, r / 1000) : a + ((b - a) * r) / 1000; const st = p.step; v = Math.round(v / st) * st; return clamp(+v.toFixed(10), a, b); }
  function valToSlider(p, P, v) { const [a, b] = range(p, P); return p.log && a > 0 ? (1000 * Math.log(clamp(v, a, b) / a)) / Math.log(b / a) : (1000 * (clamp(v, a, b) - a)) / (b - a || 1); }
  function setParam(m, k, v, src) {
    const P = S.P[m.id], p = m.params.find((q) => q.k === k); if (!p) return;
    const [a, b] = range(p, P); P[k] = p.type ? v : clamp(v, a, b);
    p.onSet && p.onSet(P);
    if (m.id === 'energy') { S.click = S.click; }
    syncControls(src === 'number' ? k : null); scheduleRecompute();
  }
  function syncControls(skipNumber) {
    const m = cur(), P = S.P[m.id], mode = curMode();
    m.params.forEach((p) => {
      const n = document.getElementById('p-' + p.k), r = document.getElementById('r-' + p.k); if (!n) return;
      if (p.type === 'select') { n.value = String(P[p.k]); return; } if (p.type === 'check') { n.checked = !!P[p.k]; return; }
      const [a, b] = range(p, P); if (P[p.k] > b) P[p.k] = b; if (P[p.k] < a) P[p.k] = a;
      if (r) r.value = valToSlider(p, P, P[p.k]);
      if (p.k !== skipNumber) { const st = S.units === 'SI' ? p.step : niceStep(p.step * dimOf(p).en[1]); n.value = (+toDisp(p, P[p.k]).toFixed(decimals(st) + 1)).toString(); }
      if (p.maxFn) { const g = document.getElementById('rg-' + p.k); const u = unitOf(p); if (g) g.textContent = `${fmt(toDisp(p, a))} – ${fmt(toDisp(p, b))} ${u} · step ${fmt(S.units === 'SI' ? p.step : niceStep(p.step * dimOf(p).en[1]))}`; }
    });
  }
  let rcPending = false;
  function scheduleRecompute() { if (rcPending) return; rcPending = true; requestAnimationFrame(() => { rcPending = false; recompute(); }); }
  function recompute(resetTime) {
    const m = cur(), P = S.P[m.id], mode = curMode();
    S.U = HP.units(S.units);
    const I = { mode };
    m.params.forEach((p) => { I[p.k] = p.type ? (p.type === 'select' && !isNaN(+P[p.k]) && p.k !== 'n' ? P[p.k] : P[p.k]) : toBase(p, P[p.k]); });
    m.prep && m.prep(I, P);
    let R;
    try { R = HP[m.fn](I, S.U); } catch (e) { console.error(e); R = { results: [], steps: [], warnings: [{ lvl: 'err', text: 'Calculation error: ' + e.message }], data: {}, invalid: true }; }
    S.I = I; S.R = R;
    if (m.post) m.post(R, I);
    const te = m.tEnd ? m.tEnd(R) : Infinity;
    if (resetTime || (isFinite(te) && S.simT > te)) S.simT = Math.min(S.simT, isFinite(te) ? te : S.simT);
    renderResults(R);
  }
  function fmtHTML(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\^\(([^()]*)\)/g, '<sup>$1</sup>').replace(/\^([0-9.−\-]+)/g, '<sup>$1</sup>'); }
  function renderResults(R) {
    $('#warns').innerHTML = R.warnings.map((w) => `<div class="w ${w.lvl}" role="${w.lvl === 'err' ? 'alert' : 'status'}">${w.lvl === 'err' ? '<b>Check: </b>' : ''}${fmtHTML(w.text)}</div>`).join('');
    $('#results').innerHTML = R.invalid ? '<tr><td>Results are withheld until the input problem above is fixed.</td></tr>' : R.results.map((r) => `<tr class="${r.em ? 'em' : ''}"><td>${fmtHTML(r.label)}</td><td class="v">${typeof r.value === 'number' ? fmt(r.value) : r.value}</td><td class="u">${r.unit}</td></tr>`).join('');
    $('#steps').innerHTML = R.steps.map((s) => `<li><div class="st-t">${fmtHTML(s.t)}</div>${s.f ? `<div class="st-f">${fmtHTML(s.f)}</div>` : ''}${s.s ? `<div class="st-s">${fmtHTML(s.s)}</div>` : ''}${s.r ? `<div class="st-r">= ${fmtHTML(s.r)}</div>` : ''}${s.table ? `<div class="st-tab"><table><tr>${s.table.head.map((h) => `<th>${h}</th>`).join('')}</tr>${s.table.rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table></div>` : ''}${s.n ? `<div class="st-n">${fmtHTML(s.n)}</div>` : ''}</li>`).join('');
  }
  function solutionText() {
    const R = S.R, m = cur(); let t = `${m.title} — ${m.modes.find((x) => x[0] === curMode())[1]} (${S.units === 'SI' ? 'SI' : 'English'} units)\n\n`;
    R.warnings.forEach((w) => (t += `[${w.lvl.toUpperCase()}] ${w.text}\n`));
    if (!R.invalid) { t += '\nRESULTS\n'; R.results.forEach((r) => (t += `  ${r.label}: ${typeof r.value === 'number' ? fmt(r.value) : r.value} ${r.unit}\n`)); }
    t += '\nSOLUTION\n'; R.steps.forEach((s, i) => { t += `${i + 1}. ${s.t}\n   ${s.f || ''}\n   ${s.s || ''}\n   = ${s.r || ''}\n   (${s.n || ''})\n`; if (s.table) { t += '   ' + s.table.head.join(' | ') + '\n'; s.table.rows.forEach((r) => (t += '   ' + r.join(' | ') + '\n')); } });
    return t + '\nHydraulics and Principles of Geotechnical Engineering (HPGE) Calculator by CEM Jumawan — ACI Philippines T.I.P. QC Student Chapter\n';
  }

  /* ------------------------------------------------------------------ canvases & loop */
  const cvM = $('#cvMain'), cvA = $('#cvAux'), ctxM = cvM.getContext('2d'), ctxA = cvA.getContext('2d');
  function fit(cv, ctx, ratio, minH, maxH) {
    const w = cv.clientWidth || 600, h = Math.round(clamp(w * ratio, minH, maxH)), dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px'; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { W: w, H: h };
  }
  let last = performance.now();
  function frame(now) {
    const rdt = Math.min(0.05, (now - last) / 1000); last = now;
    const m = cur(), R = S.R, A = S.A[m.id];
    let sdt = 0;
    if (S.playing && R && !R.invalid) {
      sdt = rdt * S.speed; S.simT += sdt;
      const te = m.tEnd ? m.tEnd(R) : Infinity;
      if (isFinite(te) && S.simT >= te) { if (m.loop) S.simT = S.simT % te; else { S.simT = te; if (m.stopAtEnd) { S.playing = false; updPlay(); } } }
    }
    const T = { rdt, sdt, pdt: S.playing ? Math.min(sdt, rdt * 2) : 0 };
    const a = fit(cvM, ctxM, 0.56, 300, 540), b = fit(cvA, ctxA, 0.32, 210, 300);
    try {
      if (!R || R.invalid) { [[ctxM, a], [ctxA, b]].forEach(([c, s]) => { c.fillStyle = C.bg; c.fillRect(0, 0, s.W, s.H); }); txt(ctxM, 'Fix the input flagged on the right to see the diagram.', a.W / 2, a.H / 2, { align: 'center', size: 14, color: C.danger, bold: true }); }
      else { (m.drawIso && S.view === '3d' ? m.drawIso : m.draw)(ctxM, a.W, a.H, R, A, T); m.drawAux(ctxA, b.W, b.H, R, A, T); }
    } catch (e) { console.error(e); }
    const t = S.simT; $('#clock').textContent = `simulated t = ${t.toFixed(2).padStart(7)} s (${(t / 60).toFixed(2).padStart(6)} min) · ${(S.speed + '×').padEnd(5)}`; // fixed decimals + padding: the text keeps one width, so nothing around it moves
    requestAnimationFrame(frame);
  }
  function pointer(cv, handler) {
    let down = false;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', (e) => { const m = cur(); if (!m[handler]) return; const [x, y] = pos(e); if (m[handler](x, y, S.A[m.id], 'down')) { down = true; cv.setPointerCapture(e.pointerId); } });
    cv.addEventListener('pointermove', (e) => { if (!down) return; const m = cur(); const [x, y] = pos(e); m[handler](x, y, S.A[m.id], 'move'); });
    cv.addEventListener('pointerup', () => (down = false)); cv.addEventListener('pointercancel', () => (down = false));
  }

  /* ------------------------------------------------------------------ wiring */
  $('#playBtn').onclick = () => { const m = cur(), te = m.tEnd ? m.tEnd(S.R) : Infinity; if (!S.playing && isFinite(te) && S.simT >= te && !m.loop) S.simT = 0; S.playing = !S.playing; updPlay(); };
  $('#resetBtn').onclick = () => resetSim();
  function updView() { $('#v2d').setAttribute('aria-pressed', S.view === '2d'); $('#v3d').setAttribute('aria-pressed', S.view === '3d'); }
  $('#v2d').onclick = () => { S.view = '2d'; updView(); };
  $('#v3d').onclick = () => { S.view = '3d'; updView(); };
  $('#speedSel').onchange = (e) => (S.speed = +e.target.value);
  $('#eglTog').onchange = (e) => (S.egl = e.target.checked);
  function setUnits(u) { S.units = u; $('#uSI').setAttribute('aria-pressed', u === 'SI'); $('#uEN').setAttribute('aria-pressed', u === 'EN'); renderControls(); recompute(); }
  $('#uSI').onclick = () => setUnits('SI'); $('#uEN').onclick = () => setUnits('EN');
  $('#presetSel').onchange = (e) => {
    const v = e.target.value; if (v === '') return; const m = cur(), pr = m.presets[+v];
    const set = Object.assign({}, pr.set);
    // English-unit presets give their numbers in English display units; inputs are stored in SI display units
    if (pr.units === 'EN') m.params.forEach((p) => { if (!p.type && typeof set[p.k] === 'number') set[p.k] = set[p.k] / dimOf(p).en[1]; });
    S.P[m.id] = Object.assign(defaults(m), set); S.mode[m.id] = pr.mode; S.click = null; S.clickInfo = null;
    const pu = pr.units === 'EN' ? 'EN' : 'SI';
    if (S.units !== pu) { S.units = pu; $('#uSI').setAttribute('aria-pressed', String(pu === 'SI')); $('#uEN').setAttribute('aria-pressed', String(pu === 'EN')); }
    setSpeed(m.speed[pr.mode] || 1); resetSim(); renderControls(); recompute(); e.target.value = '';
  };
  $('#copyBtn').onclick = () => {
    const t = solutionText(), btn = $('#copyBtn');
    const done = () => { btn.textContent = 'Copied'; setTimeout(() => (btn.textContent = 'Copy solution'), 1500); };
    const fallback = () => { const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { btn.textContent = 'Select & copy manually'; } ta.remove(); };
    try { navigator.clipboard.writeText(t).then(done, fallback); } catch (e) { fallback(); }
  };
  // Draw one view of the current module onto a fresh canvas (2x), for the PDF.
  function snap(fn, W, H) {
    try {
      const c = document.createElement('canvas'); c.width = W * 4; c.height = H * 4;
      const x = c.getContext('2d'); x.setTransform(4, 0, 0, 4, 0, 0); x.fillStyle = C.bg; x.fillRect(0, 0, W, H);
      fn(x, W, H, S.R, S.A[cur().id], { rdt: 0, sdt: 0, pdt: 0 });
      return c.toDataURL('image/png');
    } catch (e) { console.error(e); return null; }
  }
  function pdfImages() {
    const m = cur(), R = S.R;
    const mw = cvM.clientWidth || 800, mh = Math.round(clamp(mw * 0.56, 300, 540));
    const aw = cvA.clientWidth || 800, ah = Math.round(clamp(aw * 0.32, 210, 300));
    if (!R || R.invalid) return [{ cap: 'Diagram', src: window.SolutionPDF.canvasToPng(cvM) }];
    // Print on the light palette even when the viewer uses dark mode.
    const de = document.documentElement, th = de.getAttribute('data-theme');
    de.setAttribute('data-theme', 'light'); readColors();
    try {
      const out = [{ cap: m.drawIso ? '2D section' : 'Diagram', src: snap(m.draw, mw, mh) }];
      if (m.drawIso) out.push({ cap: '3D isometric view', src: snap(m.drawIso, mw, mh) });
      out.push({ cap: 'Plots', src: snap(m.drawAux, aw, ah) });
      return out;
    } finally { if (th === null) de.removeAttribute('data-theme'); else de.setAttribute('data-theme', th); readColors(); }
  }
  if (window.SolutionPDF) window.SolutionPDF.wire($('#pdfBtn'), async () => {
    const R = S.R, m = cur(), plain = (x) => String(x).replace(/\^\(([^()]*)\)/g, '^$1');
    return {
      app: 'Hydraulics Engineering', module: `${S.mi + 1}. ${m.title}`, mode: (m.modes.find((x) => x[0] === curMode()) || [])[1], units: S.units === 'SI' ? 'SI units' : 'English units',
      images: pdfImages(),
      warnings: R.warnings.map((w) => ({ lvl: w.lvl, text: plain(w.text) })),
      results: R.invalid ? [] : R.results.map((r) => ({ k: plain(r.label), v: typeof r.value === 'number' ? fmt(r.value) : String(r.value), u: r.unit, em: r.em })),
      steps: R.steps.map((s) => ({ t: plain(s.t), f: s.f && plain(s.f), s: s.s && plain(s.s), r: s.r && plain(s.r), n: s.n && plain(s.n), table: s.table })),
      filename: `hydraulics-${window.SolutionPDF.slug(m.title)}.pdf`,
    };
  });
  pointer(cvA, 'onAuxPointer'); pointer(cvM, 'onMainPointer');
  readColors();
  try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors); } catch (e) { }
  new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
  buildTabs(); selectModule(0);
  requestAnimationFrame(frame);
})();
