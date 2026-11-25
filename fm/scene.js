/* =====================================================================
 * Shared scene kit for the newer Fluid Mechanics modules.
 * A module builds ONE list of items in world coordinates (x right, y up);
 * Scene.draw2D renders it as an SVG diagram and Scene.draw3D extrudes /
 * revolves the same items in the isometric 3D view.
 *
 * Items
 *  {t:'poly',  pts, o:{fill,stroke,sw,dash,fop}, d3:{z0,z1,fill,alpha}|false}
 *  {t:'circle',c, r, o, d3:'sphere'|'disc'|false, fill3}
 *  {t:'lathe', prof:[[r,y]…], cx, fill, alpha}            (3D only)
 *  {t:'line',  a, b, o}      {t:'pline', pts, o}
 *  {t:'arrow', a, b, o:{color,label,…}}   {t:'force', at, dir, len, o}
 *  {t:'dim',   a, b, s, off, o, o3}       {t:'dot', p, c, s, o}
 *  {t:'text',  p, s, o:{…, in3}}          {t:'fs', p, o}
 *  Any item may carry only2d / only3d.
 * ===================================================================== */
(function (root) {
  'use strict';

  function Scene() {
    const items = [];
    const S = {
      items, bounds: null, depth: 1, padR: 60,
      add(it) { items.push(it); return it; },
      poly(pts, o, d3) { return S.add({ t: 'poly', pts, o: o || {}, d3: d3 === undefined ? {} : d3 }); },
      rect(x0, y0, x1, y1, o, d3) { return S.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], o, d3); },
      circle(c, r, o, d3, fill3) { return S.add({ t: 'circle', c, r, o: o || {}, d3: d3 || false, fill3 }); },
      lathe(prof, cx, fill, alpha) { return S.add({ t: 'lathe', prof, cx: cx || 0, fill, alpha: alpha === undefined ? 0.8 : alpha, only3d: true }); },
      line(a, b, o) { return S.add({ t: 'line', a, b, o: o || {} }); },
      pline(pts, o) { return S.add({ t: 'pline', pts, o: o || {} }); },
      arrow(a, b, o) { return S.add({ t: 'arrow', a, b, o: o || {} }); },
      dim(a, b, s, off, o, o3) { return S.add({ t: 'dim', a, b, s, off: off || 20, o: o || {}, o3 }); },
      dot(p, c, s, o) { return S.add({ t: 'dot', p, c, s, o: o || {} }); },
      text(p, s, o) { return S.add({ t: 'text', p, s, o: o || {} }); },
      fs(p, o) { return S.add({ t: 'fs', p, o: o || {} }); },
      autoBounds(padFrac) {
        const mn = [Infinity, Infinity], mx = [-Infinity, -Infinity];
        const up = (p) => { if (!p || !isFinite(p[0]) || !isFinite(p[1])) return; mn[0] = Math.min(mn[0], p[0]); mn[1] = Math.min(mn[1], p[1]); mx[0] = Math.max(mx[0], p[0]); mx[1] = Math.max(mx[1], p[1]); };
        items.forEach((it) => {
          if (it.only3d) return;
          if (it.pts) it.pts.forEach(up);
          if (it.a) up(it.a); if (it.b) up(it.b); if (it.p) up(it.p);
          if (it.t === 'circle') { up([it.c[0] - it.r, it.c[1] - it.r]); up([it.c[0] + it.r, it.c[1] + it.r]); }
        });
        if (!isFinite(mn[0])) { mn[0] = 0; mn[1] = 0; mx[0] = 1; mx[1] = 1; }
        const pf = padFrac === undefined ? 0.08 : padFrac;
        const dx = Math.max(mx[0] - mn[0], 1e-6), dy = Math.max(mx[1] - mn[1], 1e-6), m = Math.max(dx, dy) * pf;
        S.bounds = { xmin: mn[0] - m, xmax: mx[0] + m, ymin: mn[1] - m, ymax: mx[1] + m };
        return S.bounds;
      },
    };
    return S;
  }

  function draw2D(svg, sc) {
    if (!sc.bounds) sc.autoBounds();
    const D = root.UI.Draw2D(svg, sc.bounds, { pad: sc.pad || 50, padR: sc.padR || 60, padT: sc.padT || 0, padB: sc.padB || 0 });
    sc.items.forEach((it) => {
      if (it.only3d) return;
      switch (it.t) {
        case 'poly': D.poly(it.pts, it.o); break;
        case 'circle': D.circle(it.c, it.r, it.o); break;
        case 'line': D.line(it.a, it.b, it.o); break;
        case 'pline': D.pline(it.pts, it.o); break;
        case 'arrow': D.arrow(it.a, it.b, it.o); break;
        case 'dim': D.dim(it.a, it.b, it.s, it.off, it.o); break;
        case 'dot': D.dot(it.p, it.c, it.s, it.o); break;
        case 'text': D.text(it.p, it.s, it.o); break;
        case 'fs': D.fs(it.p, it.o); break;
        default: break;
      }
    });
    return D;
  }

  const solidOf = (o) => {
    const f = (o && o.fill) || '#cccccc';
    return f.startsWith('url') ? '#9aa3ad' : f;
  };

  function draw3D(V, sc) {
    const dep = sc.depth || 1;
    sc.items.forEach((it) => {
      if (it.only2d) return;
      const d3 = it.d3;
      switch (it.t) {
        case 'poly': {
          if (d3 === false || !it.pts || it.pts.length < 3) {
            if (it.pts && it.pts.length >= 2 && d3 !== false && it.o.stroke) V.line(it.pts.map((p) => [p[0], p[1], 0]), it.o.stroke, 1.2);
            break;
          }
          const z0 = d3.z0 === undefined ? -dep / 2 : d3.z0, z1 = d3.z1 === undefined ? dep / 2 : d3.z1;
          V.extrude(it.pts, z0, z1, d3.fill || solidOf(it.o), d3.alpha === undefined ? (it.o.fop !== undefined ? Math.max(0.25, it.o.fop) : 0.8) : d3.alpha, d3.stroke === undefined ? null : d3.stroke);
          break;
        }
        case 'circle': {
          if (it.d3 === 'sphere') {
            const prof = []; const n = 16;
            for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (Math.PI * i) / n; prof.push([it.r * Math.cos(a), it.c[1] + it.r * Math.sin(a)]); }
            V.lathe(prof, it.fill3 || solidOf(it.o), it.o.fop !== undefined ? Math.max(0.35, it.o.fop) : 0.85, null, 32, it.c[0], 0, { open: true });
          } else if (it.d3 === 'disc') {
            const pts = []; for (let i = 0; i < 40; i++) { const a = (2 * Math.PI * i) / 40; pts.push([it.c[0] + it.r * Math.cos(a), it.c[1] + it.r * Math.sin(a)]); }
            V.extrude(pts, -dep / 2, dep / 2, it.fill3 || solidOf(it.o), 0.8, null);
          }
          break;
        }
        case 'lathe': V.lathe(it.prof, it.fill, it.alpha, null, 36, it.cx, 0); break;
        case 'line': if (!it.o.no3) V.line([[it.a[0], it.a[1], 0], [it.b[0], it.b[1], 0]], it.o.stroke || '#555', it.o.sw || 1.2); break;
        case 'pline': if (!it.o.no3) V.line(it.pts.map((p) => [p[0], p[1], 0]), it.o.stroke || '#555', it.o.sw || 1.4); break;
        case 'arrow': {
          const c = it.o.color || '#c0392b';
          V.line([[it.a[0], it.a[1], 0], [it.b[0], it.b[1], 0]], c, 3);
          if (it.o.label) V.label([it.b[0], it.b[1], 0], it.o.label, c);
          break;
        }
        case 'dim': V.dim([it.a[0], it.a[1], dep / 2], [it.b[0], it.b[1], dep / 2], it.s, it.o3 || [0, 0, dep * 0.5]); break;
        case 'dot': if (it.s) V.label([it.p[0], it.p[1], 0], it.s, it.c); break;
        case 'text': if (it.o.in3) V.label([it.p[0], it.p[1], 0], it.s, it.o.color || '#1d2733'); break;
        default: break;
      }
    });
    V.autoBounds();
  }

  /** Small line chart drawn in pixel space inside an existing Draw2D (for property curves etc.). */
  function chart(D, box, series, o) {
    o = o || {};
    const [x0, y0, w, h] = box; // pixel box (left, top, width, height)
    const all = series.flatMap((s) => s.pts);
    if (!all.length) return;
    let xmin = o.xmin !== undefined ? o.xmin : Math.min(...all.map((p) => p[0])), xmax = o.xmax !== undefined ? o.xmax : Math.max(...all.map((p) => p[0]));
    let ymin = o.ymin !== undefined ? o.ymin : Math.min(...all.map((p) => p[1])), ymax = o.ymax !== undefined ? o.ymax : Math.max(...all.map((p) => p[1]));
    if (xmax - xmin < 1e-12) xmax = xmin + 1; if (ymax - ymin < 1e-12) ymax = ymin + 1;
    const X = (x) => x0 + ((x - xmin) / (xmax - xmin)) * w, Y = (y) => y0 + h - ((y - ymin) / (ymax - ymin)) * h;
    const el = D.el;
    el('rect', { x: x0, y: y0, width: w, height: h, fill: 'none', stroke: '#9aa7b4', 'stroke-width': 1 });
    for (let i = 1; i < 4; i++) {
      el('line', { x1: x0, x2: x0 + w, y1: y0 + (h * i) / 4, y2: y0 + (h * i) / 4, stroke: '#d5dbe1', 'stroke-width': 0.7 });
      el('line', { y1: y0, y2: y0 + h, x1: x0 + (w * i) / 4, x2: x0 + (w * i) / 4, stroke: '#d5dbe1', 'stroke-width': 0.7 });
    }
    const f = root.Physics.fmt;
    D.text([x0, y0 + h + 14], f(xmin, 3), { px: true, size: 10, color: '#52606d', weight: 500 });
    D.text([x0 + w, y0 + h + 14], f(xmax, 3), { px: true, size: 10, color: '#52606d', anchor: 'end', weight: 500 });
    D.text([x0 - 4, y0 + h], f(ymin, 3), { px: true, size: 10, color: '#52606d', anchor: 'end', weight: 500 });
    D.text([x0 - 4, y0 + 8], f(ymax, 3), { px: true, size: 10, color: '#52606d', anchor: 'end', weight: 500 });
    if (o.xl) D.text([x0 + w / 2, y0 + h + 26], o.xl, { px: true, size: 11, anchor: 'middle', color: '#34495e' });
    if (o.yl) D.text([x0, y0 - 8], o.yl, { px: true, size: 11, color: '#34495e' });
    series.forEach((s) => {
      if (s.pts.length > 1) el('polyline', { points: s.pts.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' '), fill: 'none', stroke: s.color || '#1F5FA8', 'stroke-width': s.w || 2, 'stroke-dasharray': s.dash });
      (s.marks || []).forEach((m) => {
        el('circle', { cx: X(m[0]), cy: Y(m[1]), r: 4.5, fill: m[3] || s.color || '#c0392b', stroke: '#fff', 'stroke-width': 1.2 });
        if (m[2]) { const px = X(m[0]), py = Y(m[1]), right = px > x0 + w * 0.6, below = py < y0 + 28 || (right && py < y0 + h - 28); D.text([px + (right ? -8 : 8), py + (below ? 17 : -8)], m[2], { px: true, size: 11, color: m[3] || s.color || '#c0392b', anchor: right ? 'end' : 'start' }); }
      });
    });
    return { X, Y };
  }

  root.Scene = { Scene, draw2D, draw3D, chart };
})(window);
