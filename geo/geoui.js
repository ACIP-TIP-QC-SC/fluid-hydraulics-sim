/* =====================================================================
 * Geotechnical UI kit (on top of ../fm/ui.js):
 *  - soil types, colours and SVG hatch patterns (shared by every module)
 *  - log-scale slider for permeability-type inputs
 *  - layer editor (cards with a soil type and numeric fields)
 *  - a small SVG chart for stress/depth, settlement/time and similar plots
 *  - 3D helpers for layered soil blocks
 * ===================================================================== */
(function (root) {
  'use strict';
  const { h, svgEl: s } = root.UI;
  const f = (x, n) => root.Physics.fmt(x, n);

  /* ------------------------------------------------------------------ */
  /* Soil types and hatching                                            */
  /* ------------------------------------------------------------------ */
  const SOILS = {
    sand: { name: 'Sand', fill: '#ecd8a0', ink: '#9c7a2c', c3d: '#e3c98a' },
    gravel: { name: 'Gravel', fill: '#ddd3bf', ink: '#7d6f57', c3d: '#cbbfa6' },
    silt: { name: 'Silt', fill: '#d9cfae', ink: '#7c7155', c3d: '#cdbf98' },
    clay: { name: 'Clay', fill: '#c7b39c', ink: '#6f5a45', c3d: '#b59a7e' },
    peat: { name: 'Peat / organic', fill: '#8f7c66', ink: '#3f3428', c3d: '#7d6a55' },
    fill: { name: 'Fill', fill: '#d8c7b0', ink: '#6d5d48', c3d: '#c5b298' },
    rock: { name: 'Rock', fill: '#b6bcc2', ink: '#5a6168', c3d: '#9ea5ac' },
  };
  const SOIL_OPTS = Object.keys(SOILS).map((k) => [k, SOILS[k].name]);

  /** Add the soil hatch patterns to an SVG created by UI.Draw2D. */
  function soilDefs(svg) {
    let defs = svg.querySelector('defs');
    if (!defs) defs = s('defs', {}, svg);
    if (defs.querySelector('#soil-sand')) return;
    const pat = (id, w, hgt, rot) => s('pattern', { id, width: w, height: hgt, patternUnits: 'userSpaceOnUse', patternTransform: rot ? `rotate(${rot})` : undefined }, defs);
    // sand: stippled dots
    let p = pat('soil-sand', 10, 10); s('rect', { width: 10, height: 10, fill: SOILS.sand.fill }, p);
    [[2, 2], [7, 4], [4, 8], [9, 9]].forEach(([x, y]) => s('circle', { cx: x, cy: y, r: 0.9, fill: SOILS.sand.ink }, p));
    // gravel: small rings
    p = pat('soil-gravel', 16, 14); s('rect', { width: 16, height: 14, fill: SOILS.gravel.fill }, p);
    [[4, 4, 2.4], [12, 9, 2], [5, 11, 1.4]].forEach(([x, y, r]) => s('circle', { cx: x, cy: y, r, fill: 'none', stroke: SOILS.gravel.ink, 'stroke-width': 0.9 }, p));
    // silt: dots and short dashes
    p = pat('soil-silt', 12, 8); s('rect', { width: 12, height: 8, fill: SOILS.silt.fill }, p);
    s('line', { x1: 1, y1: 2, x2: 6, y2: 2, stroke: SOILS.silt.ink, 'stroke-width': 0.9 }, p); s('circle', { cx: 9, cy: 6, r: 0.8, fill: SOILS.silt.ink }, p);
    // clay: horizontal dashes
    p = pat('soil-clay', 14, 7); s('rect', { width: 14, height: 7, fill: SOILS.clay.fill }, p);
    s('line', { x1: 1, y1: 2, x2: 8, y2: 2, stroke: SOILS.clay.ink, 'stroke-width': 1 }, p); s('line', { x1: 8, y1: 5.5, x2: 14, y2: 5.5, stroke: SOILS.clay.ink, 'stroke-width': 1 }, p); s('line', { x1: 0, y1: 5.5, x2: 1, y2: 5.5, stroke: SOILS.clay.ink, 'stroke-width': 1 }, p);
    // peat: tufts
    p = pat('soil-peat', 14, 10); s('rect', { width: 14, height: 10, fill: SOILS.peat.fill }, p);
    s('path', { d: 'M3 8 L5 4 L7 8 M5 8 L5 3', stroke: SOILS.peat.ink, 'stroke-width': 0.9, fill: 'none' }, p);
    // fill: diagonal cross
    p = pat('soil-fill', 12, 12); s('rect', { width: 12, height: 12, fill: SOILS.fill.fill }, p);
    s('path', { d: 'M0 12 L12 0 M0 0 L4 4', stroke: SOILS.fill.ink, 'stroke-width': 0.8, fill: 'none' }, p);
    // rock: brick-like
    p = pat('soil-rock', 18, 12); s('rect', { width: 18, height: 12, fill: SOILS.rock.fill }, p);
    s('path', { d: 'M0 0.5 H18 M0 6.5 H18 M6 0.5 V6.5 M15 6.5 V12', stroke: SOILS.rock.ink, 'stroke-width': 0.9, fill: 'none' }, p);
    // water over soil (saturated tint)
    p = pat('soil-sat', 8, 8); s('rect', { width: 8, height: 8, fill: '#4aa3df', 'fill-opacity': 0.0 }, p);
    // impervious base
    p = pat('impervious', 9, 9, 45); s('rect', { width: 9, height: 9, fill: '#cfd5db' }, p); s('line', { x1: 0, y1: 0, x2: 0, y2: 9, stroke: '#4b5560', 'stroke-width': 2 }, p);
    // concrete
    p = pat('concrete', 16, 16); s('rect', { width: 16, height: 16, fill: '#cfccc2' }, p);
    [[3, 4, 1.1], [11, 6, 0.8], [6, 12, 1.3], [13, 13, 0.7]].forEach(([x, y, r]) => s('circle', { cx: x, cy: y, r, fill: '#8d897d' }, p));
    s('path', { d: 'M8 2 l2 2 l-3 0 z', fill: '#9a968a' }, p);
  }
  const soilFill = (t) => `url(#soil-${SOILS[t] ? t : 'sand'})`;

  /** A soil band in a Draw2D context, with an optional blue tint for saturated soil. */
  function soilRect(D, x0, y0, x1, y1, type, o) {
    o = o || {};
    D.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], { fill: soilFill(type), stroke: o.stroke || '#6b5b45', sw: o.sw || 1 });
    if (o.sat) D.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], { fill: '#4aa3df', fop: 0.16 });
  }
  /** Water-table marker ▽ with label at world point p (uses Draw2D.fs). */
  function wt(D, p, label) { return D.fs(p, { label: label || 'GWT' }); }

  /* ------------------------------------------------------------------ */
  /* Controls                                                           */
  /* ------------------------------------------------------------------ */
  /** Log-scale slider: o = {label, min, max (positive), get, set, unit} */
  function logSlider(C, app, parent, o) {
    const unit = typeof o.unit === 'function' ? o.unit() : o.unit || '';
    const lmin = Math.log10(o.min), lmax = Math.log10(o.max);
    const val = o.get();
    const rng = h('input', { type: 'range', min: lmin, max: lmax, step: 0.01, value: Math.min(lmax, Math.max(lmin, Math.log10(val > 0 ? val : o.min))) });
    const num = h('input', { type: 'number', step: 'any', value: +Number(val).toPrecision(4), class: 'num' });
    const row = h('div', { class: 'ctl-row' },
      h('label', { class: 'ctl-label' }, h('span', null, o.label), h('span', { class: 'ctl-num' }, num, h('span', { class: 'unit' }, unit))),
      rng, h('div', { class: 'ctl-range' }, `log scale · ${f(o.min)} to ${f(o.max)}`));
    rng.addEventListener('input', () => { const v = +Math.pow(10, parseFloat(rng.value)).toPrecision(3); num.value = v; o.set(v); app.update(); });
    num.addEventListener('input', () => { const v = parseFloat(num.value); if (!(v > 0)) return; rng.value = Math.min(lmax, Math.max(lmin, Math.log10(v))); o.set(v); app.update(); });
    parent.append(row);
    return row;
  }

  /**
   * Layer editor. o = { layers, max, fields:[{k, label, step, unit, show?(layer)}], soil:true, make(), title(i) }
   * Each layer is a small card: soil type, remove button, and a 2-column grid of number fields.
   */
  function layerEditor(app, parent, o) {
    const wrap = h('div', { class: 'lyr-list' });
    o.layers.forEach((L, i) => {
      const head = h('div', { class: 'lyr-head' },
        h('span', { class: 'lyr-n', style: { background: (SOILS[L.soil] || SOILS.sand).fill } }, String(i + 1)),
        h('span', { class: 'lyr-t' }, o.title ? o.title(i, L) : `Layer ${i + 1}`));
      if (o.soil !== false) {
        const sel = h('select', { class: 'lyr-soil', 'aria-label': `Layer ${i + 1} soil type`, onchange: () => { L.soil = sel.value; if (o.onSoil) o.onSoil(L); app.rebuild(true); } },
          ...SOIL_OPTS.map(([v, t]) => h('option', { value: v, selected: L.soil === v }, t)));
        head.append(sel);
      }
      head.append(h('button', { type: 'button', class: 'btn small lyr-x', title: 'Remove layer', 'aria-label': `Remove layer ${i + 1}`, disabled: o.layers.length <= (o.min || 1), onclick: () => { o.layers.splice(i, 1); app.rebuild(true); } }, '×'));
      const grid = h('div', { class: 'lyr-grid' });
      o.fields.forEach((fd) => {
        if (fd.show && !fd.show(L, i)) return;
        const unit = typeof fd.unit === 'function' ? fd.unit() : fd.unit || '';
        const inp = h('input', { type: 'number', step: fd.step || 'any', min: fd.min, value: L[fd.k], class: 'num', 'aria-label': `Layer ${i + 1} ${fd.label}` });
        inp.addEventListener('input', () => { const v = parseFloat(inp.value); if (!isFinite(v)) return; L[fd.k] = v; app.update(); });
        if (fd.rebuild) inp.addEventListener('change', () => app.rebuild(true));
        grid.append(h('label', { class: 'lyr-f' }, h('span', { class: 'lyr-fl' }, fd.label), h('span', { class: 'lyr-fi' }, inp, h('span', { class: 'unit' }, unit))));
      });
      wrap.append(h('div', { class: 'lyr' }, head, grid));
    });
    if (o.layers.length < (o.max || 5)) wrap.append(h('button', { type: 'button', class: 'btn small', onclick: () => { o.layers.push(o.make(o.layers)); app.rebuild(true); } }, o.add || '+ Add layer'));
    parent.append(wrap);
    return wrap;
  }

  /* ------------------------------------------------------------------ */
  /* SVG chart                                                          */
  /* ------------------------------------------------------------------ */
  function niceStep(span, n) {
    const raw = span / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  }
  /**
   * Draw a chart into `svg` inside the pixel rectangle r = {x,y,w,h}.
   * o = { title, xlab, ylab, xmin,xmax,ymin,ymax, xlog, ydown (y grows downward, e.g. depth),
   *       series:[{pts:[[x,y]…], color, w, dash, fill, label}], marks:[{x,y,color,label,anchor}],
   *       vlines:[{x,color,label,dash}], hlines:[{y,color,label,dash}] }
   */
  function chart(svg, r, o) {
    const g = s('g', { class: 'chart' }, svg);
    const all = o.series.flatMap((q) => q.pts).filter((p) => isFinite(p[0]) && isFinite(p[1]));
    let xmin = o.xmin, xmax = o.xmax, ymin = o.ymin, ymax = o.ymax;
    if (xmin === undefined) xmin = Math.min(...all.map((p) => p[0]));
    if (xmax === undefined) xmax = Math.max(...all.map((p) => p[0]));
    if (ymin === undefined) ymin = Math.min(...all.map((p) => p[1]));
    if (ymax === undefined) ymax = Math.max(...all.map((p) => p[1]));
    if (!isFinite(xmin) || !isFinite(xmax)) { xmin = 0; xmax = 1; }
    if (!isFinite(ymin) || !isFinite(ymax)) { ymin = 0; ymax = 1; }
    if (xmax - xmin < 1e-12) { xmax += Math.abs(xmax) * 0.1 + 1; xmin -= o.xlog ? 0 : Math.abs(xmin) * 0.1; }
    if (ymax - ymin < 1e-12) { ymax += Math.abs(ymax) * 0.1 + 1; ymin -= Math.abs(ymin) * 0.1; }
    const L = r.x + 54, R = r.x + r.w - 14, T = r.y + (o.title ? 26 : 10), B = r.y + r.h - 34;
    const lx = (x) => (o.xlog ? Math.log10(Math.max(x, 1e-30)) : x);
    const X = (x) => L + ((lx(x) - lx(xmin)) / (lx(xmax) - lx(xmin))) * (R - L);
    const Y = (y) => (o.ydown ? T + ((y - ymin) / (ymax - ymin)) * (B - T) : B - ((y - ymin) / (ymax - ymin)) * (B - T));
    s('rect', { x: L, y: T, width: R - L, height: B - T, fill: '#ffffff', stroke: '#c4ced9' }, g);
    const txt = (x, y, t, a) => { const e = s('text', Object.assign({ x, y, 'font-size': 11, fill: '#5d6b7a', 'font-family': 'IBM Plex Sans, system-ui, sans-serif' }, a || {}), g); e.textContent = t; return e; };
    // grid & ticks
    if (o.xlog) {
      for (let d = Math.floor(Math.log10(xmin)); d <= Math.ceil(Math.log10(xmax)); d++) for (let m = 1; m <= 9; m++) {
        const v = m * Math.pow(10, d); if (v < xmin * 0.999 || v > xmax * 1.001) continue;
        s('line', { x1: X(v), y1: T, x2: X(v), y2: B, stroke: m === 1 ? '#c9d3dc' : '#eef2f5' }, g);
        if (m === 1 || (Math.log10(xmax / xmin) < 1.3 && (m === 2 || m === 5))) txt(X(v), B + 14, f(v, 3), { 'text-anchor': 'middle' });
      }
    } else {
      const sx = niceStep(xmax - xmin, Math.max(3, Math.floor((R - L) / 70)));
      for (let v = Math.ceil(xmin / sx - 1e-9) * sx; v <= xmax + 1e-9 * sx; v += sx) { s('line', { x1: X(v), y1: T, x2: X(v), y2: B, stroke: '#e6ebef' }, g); txt(X(v), B + 14, f(Math.abs(v) < sx * 1e-6 ? 0 : v, 4), { 'text-anchor': 'middle' }); }
    }
    const sy = niceStep(ymax - ymin, Math.max(3, Math.floor((B - T) / 40)));
    for (let v = Math.ceil(ymin / sy - 1e-9) * sy; v <= ymax + 1e-9 * sy; v += sy) { s('line', { x1: L, y1: Y(v), x2: R, y2: Y(v), stroke: '#e6ebef' }, g); txt(L - 6, Y(v) + 4, f(Math.abs(v) < sy * 1e-6 ? 0 : v, 4), { 'text-anchor': 'end' }); }
    if (o.title) txt(L, r.y + 16, o.title, { fill: '#1d2733', 'font-weight': 700, 'font-size': 12.5 });
    if (o.xlab) txt((L + R) / 2, B + 29, o.xlab, { 'text-anchor': 'middle', fill: '#34495e', 'font-weight': 600 });
    if (o.ylab) { const t = txt(r.x + 12, (T + B) / 2, o.ylab, { 'text-anchor': 'middle', fill: '#34495e', 'font-weight': 600 }); t.setAttribute('transform', `rotate(-90 ${r.x + 12} ${(T + B) / 2})`); }
    const clipId = 'c' + Math.random().toString(36).slice(2, 8);
    const cp = s('clipPath', { id: clipId }, g); s('rect', { x: L, y: T, width: R - L, height: B - T }, cp);
    const pg = s('g', { 'clip-path': `url(#${clipId})` }, g);
    (o.hlines || []).forEach((l) => { if (l.y < Math.min(ymin, ymax) || l.y > Math.max(ymin, ymax)) return; s('line', { x1: L, y1: Y(l.y), x2: R, y2: Y(l.y), stroke: l.color || '#7f8c8d', 'stroke-dasharray': l.dash || '5 4', 'stroke-width': 1.2 }, pg); if (l.label) txt(R - 4, Y(l.y) - 4, l.label, { 'text-anchor': 'end', fill: l.color || '#7f8c8d', 'font-weight': 600 }); });
    (o.vlines || []).forEach((l) => { if (l.x < xmin || l.x > xmax) return; s('line', { x1: X(l.x), y1: T, x2: X(l.x), y2: B, stroke: l.color || '#7f8c8d', 'stroke-dasharray': l.dash || '5 4', 'stroke-width': 1.2 }, pg); if (l.label) txt(X(l.x) + 4, T + 12, l.label, { fill: l.color || '#7f8c8d', 'font-weight': 600 }); });
    o.series.forEach((q) => {
      const pts = q.pts.filter((p) => isFinite(p[0]) && isFinite(p[1]) && (!o.xlog || p[0] > 0));
      if (pts.length < 2) return;
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
      if (q.fill) {
        const base = o.ydown ? `L${X(0).toFixed(1)},${Y(pts[pts.length - 1][1]).toFixed(1)}L${X(0).toFixed(1)},${Y(pts[0][1]).toFixed(1)}Z` : `L${X(pts[pts.length - 1][0]).toFixed(1)},${Y(Math.max(ymin, 0)).toFixed(1)}L${X(pts[0][0]).toFixed(1)},${Y(Math.max(ymin, 0)).toFixed(1)}Z`;
        s('path', { d: d + base, fill: q.color, 'fill-opacity': 0.14, stroke: 'none' }, pg);
      }
      s('path', { d, fill: 'none', stroke: q.color || '#2c3e50', 'stroke-width': q.w || 2, 'stroke-dasharray': q.dash, 'stroke-linejoin': 'round' }, pg);
    });
    (o.marks || []).forEach((m) => {
      if (!isFinite(m.x) || !isFinite(m.y)) return;
      s('circle', { cx: X(m.x), cy: Y(m.y), r: 4, fill: m.color || '#c0392b', stroke: '#fff', 'stroke-width': 1.5 }, g);
      if (m.label) { const e = txt(X(m.x) + (m.anchor === 'end' ? -7 : 7), Y(m.y) + (m.dy || -6), m.label, { fill: m.color || '#c0392b', 'font-weight': 700, 'text-anchor': m.anchor || 'start' }); e.setAttribute('class', 'lbl'); }
    });
    // legend
    const leg = o.series.filter((q) => q.label);
    leg.forEach((q, i) => {
      const yy = T + 14 + i * 15, xx = R - 8;
      const t = txt(xx, yy + 4, q.label, { 'text-anchor': 'end', fill: '#34495e' }); t.setAttribute('class', 'lbl');
      const tw = Math.min(300, q.label.length * 5.9);
      s('line', { x1: xx - tw - 26, y1: yy, x2: xx - tw - 6, y2: yy, stroke: q.color, 'stroke-width': q.w || 2, 'stroke-dasharray': q.dash }, g);
    });
    return { X, Y, L, R, T, B, g };
  }

  /** Prepare an SVG for charts: clears it and returns its pixel size. */
  function chartSurface(svg) {
    const W = svg.clientWidth || 800, H = svg.clientHeight || 300;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    return { W, H };
  }
  /** Split a surface into n side-by-side panels (stacks them when narrow). */
  function panels(W, H, n) {
    const out = [];
    if (W < 560 && n > 1) { for (let i = 0; i < n; i++) out.push({ x: 0, y: (H / n) * i, w: W, h: H / n }); }
    else for (let i = 0; i < n; i++) out.push({ x: (W / n) * i, y: 0, w: W / n, h: H });
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* 3D helpers                                                         */
  /* ------------------------------------------------------------------ */
  /** Layered block: bands [{y0,y1,soil,sat}] between x0..x1 and z0..z1. */
  function soilBlock3D(V, x0, x1, z0, z1, bands) {
    bands.forEach((b) => {
      const c = (SOILS[b.soil] || SOILS.sand).c3d;
      V.box(x0, b.y0, z0, x1, b.y1, z1, c, b.alpha || 0.95, '#6b5b45');
      if (b.sat) V.face([[x0, b.y0, z1 + 1e-4], [x1, b.y0, z1 + 1e-4], [x1, b.y1, z1 + 1e-4], [x0, b.y1, z1 + 1e-4]], '#4aa3df', 0.18, null);
    });
  }
  function arrow3D(V, a, b, col, lw, label, hsz) {
    V.line([a, b], col, lw || 2.4);
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(d[0], d[1], d[2]) || 1;
    const u = [d[0] / L, d[1] / L, d[2] / L];
    const hs = hsz || L * 0.18;
    // perpendicular in the x–y plane (or x–z if vertical-ish)
    let pz = [-u[1], u[0], 0]; if (Math.hypot(pz[0], pz[1]) < 0.2) pz = [0, -u[2], u[1]];
    const pl = Math.hypot(pz[0], pz[1], pz[2]) || 1; pz = pz.map((q) => q / pl);
    const p1 = [b[0] - u[0] * hs + pz[0] * hs * 0.45, b[1] - u[1] * hs + pz[1] * hs * 0.45, b[2] - u[2] * hs + pz[2] * hs * 0.45];
    const p2 = [b[0] - u[0] * hs - pz[0] * hs * 0.45, b[1] - u[1] * hs - pz[1] * hs * 0.45, b[2] - u[2] * hs - pz[2] * hs * 0.45];
    V.line([p1, b, p2], col, lw || 2.4);
    if (label) V.label(a, label, col);
  }

  root.GeoUI = { SOILS, SOIL_OPTS, soilDefs, soilFill, soilRect, wt, logSlider, layerEditor, chart, chartSurface, panels, soilBlock3D, arrow3D, niceStep };
})(window);
