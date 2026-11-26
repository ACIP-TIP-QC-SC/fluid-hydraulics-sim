/* =====================================================================
 * HPGE Fluid Mechanics Lab — PHYSICS MODULE
 * ---------------------------------------------------------------------
 * Every formula used by the app lives in this file, separate from the UI,
 * so that it can be checked independently (run `node test.js`).
 *
 * Conventions
 *  - SI by default: γw = 9.81 kN/m³, g = 9.81 m/s². English: γw = 62.4 lb/ft³,
 *    g = 32.2 ft/s². All inputs/outputs are in the selected unit system.
 *  - Every solver returns:
 *      { ok, err:[], warn:[], status:{cls,text}, out:[{k,v,u,hl}], steps:[...], geo:{...} }
 *    `steps` are {t: title, n: one-line explanation, f: formula, s: substitution, r: result}.
 *    `geo` holds the geometry needed by the diagrams.
 * ===================================================================== */
(function (root, factory) {
  const P = factory();
  if (typeof module === 'object' && module.exports) module.exports = P;
  else root.Physics = P;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PI = Math.PI;
  const DEG = PI / 180;

  /* ------------------------------------------------------------------ */
  /* Units                                                              */
  /* ------------------------------------------------------------------ */
  const UNITS = {
    SI: {
      id: 'SI', gw: 9.81, g: 9.81, len: 'm', force: 'kN', press: 'kPa', gamma: 'kN/m³',
      vol: 'm³', area: 'm²', acc: 'm/s²', mom: 'kN·m', inertia: 'm⁴', fpl: 'kN/m',
      volSmall: 'L', volSmallFactor: 1000,
    },
    EN: {
      id: 'EN', gw: 62.4, g: 32.2, len: 'ft', force: 'lb', press: 'psf', gamma: 'lb/ft³',
      vol: 'ft³', area: 'ft²', acc: 'ft/s²', mom: 'lb·ft', inertia: 'ft⁴', fpl: 'lb/ft',
      volSmall: 'gal', volSmallFactor: 7.48052,
    },
  };

  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
  /* ------------------------------------------------------------------ */
  /** Round to `sig` significant figures (default 4) and return a string. */
  function fmt(x, sig) {
    sig = sig || 4;
    if (x === null || x === undefined || typeof x !== 'number' || !isFinite(x)) return '—';
    if (Math.abs(x) < 1e-12) return '0';
    const a = Math.abs(x);
    if (a >= 1e-5 && a < 1e10) return String(parseFloat(x.toPrecision(sig)));
    return x.toExponential(sig - 1);
  }
  const clamp = (x, a, b) => Math.min(Math.max(x, a), b);

  function Steps() {
    const list = [];
    return {
      list,
      add(t, f, s, r, n) { list.push({ t, f, s, r, n }); },
    };
  }

  /** Composite Simpson integration of f on [a,b]. */
  function simpson(f, a, b, n) {
    n = n || 400;
    if (!(b > a)) return 0;
    if (n % 2) n++;
    const h = (b - a) / n;
    let s = f(a) + f(b);
    for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
    return (s * h) / 3;
  }

  /** Bisection: find x in [lo,hi] with f(x)=target, f increasing. */
  function bisect(f, target, lo, hi, iters) {
    iters = iters || 200;
    for (let i = 0; i < iters; i++) {
      const m = 0.5 * (lo + hi);
      if (f(m) < target) lo = m; else hi = m;
      if (hi - lo < 1e-13 * Math.max(1, Math.abs(hi))) break;
    }
    return 0.5 * (lo + hi);
  }

  /**
   * ∫₀ᴸ clamp(c + s·x, 0, cap) dx  — area under a straight free-surface line
   * clipped by the tank floor (0) and the lid (cap, may be Infinity).
   * Used by both the linear-acceleration tank (x = length) and the rotating
   * cylinder (x = r², because dV = π·f·d(r²)).
   */
  function areaClamp(c, s, L, cap) {
    if (cap === undefined) cap = Infinity;
    const pts = [0, L];
    if (s !== 0) {
      const x0 = -c / s; if (x0 > 0 && x0 < L) pts.push(x0);
      if (isFinite(cap)) { const x1 = (cap - c) / s; if (x1 > 0 && x1 < L) pts.push(x1); }
    }
    pts.sort((a, b) => a - b);
    let A = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (b <= a) continue;
      const fm = c + s * 0.5 * (a + b);
      if (fm <= 0) continue;
      if (fm >= cap) A += cap * (b - a);
      else A += fm * (b - a);
    }
    return A;
  }

  /** Intercept c such that areaClamp(c, s, L, cap) = target. */
  function solveIntercept(target, s, L, cap) {
    const span = Math.abs(s) * L;
    const lo = -span - 1;
    const hi = (isFinite(cap) ? cap : target / L) + span + 1;
    return bisect((c) => areaClamp(c, s, L, cap), target, lo, hi, 300);
  }

  /* =================================================================== */
  /* MODULE 1 — HYDROSTATIC FORCES ON SURFACES                            */
  /* =================================================================== */

  /**
   * Geometric properties of a plane gate.
   * Local coordinates: s = distance DOWN the plate from the top edge,
   * u = horizontal distance across the plate from its centre line.
   * Returns Lp (extent along the plate), A, yc (centroid from top edge),
   * Ig (centroidal, about the axis parallel to the free surface), outline.
   */
  function gateGeom(shape, d, orient) {
    const f = fmt;
    switch (shape) {
      case 'rect': {
        const b = d.b, h = d.h;
        return {
          name: 'Rectangle', Lp: h, A: b * h, yc: h / 2, Ig: (b * h ** 3) / 12,
          fA: 'A = b·h', sA: `A = ${f(b)} × ${f(h)}`,
          fy: 'ȳc = h/2  (from the top edge)', sy: `ȳc = ${f(h)}/2`,
          fI: 'I_g = b·h³/12', sI: `I_g = ${f(b)} × ${f(h)}³ / 12`,
          outline: [[-b / 2, 0], [b / 2, 0], [b / 2, h], [-b / 2, h]],
        };
      }
      case 'tri': {
        const b = d.b, h = d.h, up = orient !== 'down';
        return {
          name: up ? 'Triangle (apex up)' : 'Triangle (apex down)',
          Lp: h, A: (b * h) / 2, yc: up ? (2 * h) / 3 : h / 3, Ig: (b * h ** 3) / 36,
          fA: 'A = b·h/2', sA: `A = ${f(b)} × ${f(h)} / 2`,
          fy: up ? 'ȳc = 2h/3 from the apex (top) = h/3 above the base'
            : 'ȳc = h/3 from the base (top edge)',
          sy: up ? `ȳc = 2 × ${f(h)}/3` : `ȳc = ${f(h)}/3`,
          fI: 'I_g = b·h³/36', sI: `I_g = ${f(b)} × ${f(h)}³ / 36`,
          outline: up ? [[0, 0], [b / 2, h], [-b / 2, h]] : [[-b / 2, 0], [b / 2, 0], [0, h]],
        };
      }
      case 'circle': {
        const D = d.D, r = D / 2;
        const out = [];
        for (let i = 0; i < 72; i++) { const t = (i / 72) * 2 * PI; out.push([r * Math.cos(t), r + r * Math.sin(t)]); }
        return {
          name: 'Circle', Lp: D, A: (PI * D * D) / 4, yc: D / 2, Ig: (PI * D ** 4) / 64,
          fA: 'A = πD²/4', sA: `A = π × ${f(D)}² / 4`,
          fy: 'ȳc = D/2', sy: `ȳc = ${f(D)}/2`,
          fI: 'I_g = πD⁴/64', sI: `I_g = π × ${f(D)}⁴ / 64`, outline: out,
        };
      }
      case 'semi': {
        const r = d.r, top = orient !== 'bottom';
        const c = (4 * r) / (3 * PI);
        const k = PI / 8 - 8 / (9 * PI);
        const out = [];
        for (let i = 0; i <= 48; i++) {
          const t = (i / 48) * PI;
          const u = r * Math.cos(t), v = r * Math.sin(t);
          out.push([u, top ? v : r - v]);
        }
        return {
          name: top ? 'Semicircle (diameter at top)' : 'Semicircle (diameter at bottom)',
          Lp: r, A: (PI * r * r) / 2, yc: top ? c : r - c, Ig: k * r ** 4,
          fA: 'A = πr²/2', sA: `A = π × ${f(r)}² / 2`,
          fy: top ? 'ȳc = 4r/(3π) below the diameter (top edge)' : 'ȳc = r − 4r/(3π) from the top (diameter at bottom)',
          sy: top ? `ȳc = 4 × ${f(r)} / (3π)` : `ȳc = ${f(r)} − 4 × ${f(r)}/(3π)`,
          fI: 'I_g = (π/8 − 8/(9π))·r⁴ = 0.1098 r⁴', sI: `I_g = 0.10976 × ${f(r)}⁴`, outline: out,
        };
      }
      case 'trap': {
        const a = d.a, b = d.b, h = d.h;
        const fromB = (h * (2 * a + b)) / (3 * (a + b));
        return {
          name: 'Trapezoid', Lp: h, A: ((a + b) * h) / 2, yc: h - fromB,
          Ig: (h ** 3 * (a * a + 4 * a * b + b * b)) / (36 * (a + b)),
          fA: 'A = (a + b)·h/2', sA: `A = (${f(a)} + ${f(b)}) × ${f(h)} / 2`,
          fy: 'ȳ from side b (bottom) = h(2a + b)/[3(a + b)];  ȳc from top = h − that',
          sy: `ȳ_b = ${f(h)}(2×${f(a)} + ${f(b)})/[3(${f(a)} + ${f(b)})] = ${f(fromB)} → ȳc = ${f(h)} − ${f(fromB)}`,
          fI: 'I_g = h³(a² + 4ab + b²)/[36(a + b)]',
          sI: `I_g = ${f(h)}³(${f(a)}² + 4×${f(a)}×${f(b)} + ${f(b)}²)/[36(${f(a)} + ${f(b)})]`,
          outline: [[-a / 2, 0], [a / 2, 0], [b / 2, h], [-b / 2, h]],
        };
      }
    }
    return null;
  }

  /**
   * Plane surface (vertical or inclined).
   * p = { sg, mode:'vertical'|'inclined', theta(deg), shape, dims, orient, h1, ps,
   *       both, sg2, h2, hinge:'none'|'top'|'bottom' }
   */
  function plane(p, U) {
    const st = Steps(), warn = [], err = [], out = [];
    const L = U.len, f = fmt;
    const gam = p.sg * U.gw;
    const vertical = p.mode !== 'inclined';
    const thDeg = vertical ? 90 : p.theta;
    const th = thDeg * DEG, sn = Math.sin(th), cs = Math.cos(th);
    const G = gateGeom(p.shape, p.dims, p.orient);

    if (!G || !(G.A > 0)) err.push('Gate dimensions must be positive.');
    if (!(p.sg > 0)) err.push('Specific gravity must be positive.');
    if (p.h1 < 0) err.push('Gate is partly ABOVE the free surface (h₁ < 0). F = γh̄A is only valid for a fully submerged plane — only the wetted part is loaded. Set h₁ ≥ 0.');
    if (!(thDeg > 0 && thDeg < 180)) err.push('Angle θ must be between 0° and 180° (measured from the +x axis; over 90° the gate leans over the liquid).');
    if (p.ps < 0) err.push('Surface pressure must be ≥ 0 (gauge).');
    if (p.both && p.h2 < 0) err.push('Gate is partly above the second free surface (h₂ < 0).');
    if (err.length) return { ok: false, err, warn, steps: [], out, geo: { G, thDeg, sn, cs } };

    st.add('Unit weight of the liquid', 'γ = Sg × γw', `γ = ${f(p.sg)} × ${f(U.gw)}`, `γ = ${f(gam)} ${U.gamma}`,
      'Converts the specific gravity into the unit weight of the liquid.');
    const heq = p.ps / gam;
    if (p.ps > 0) {
      st.add('Equivalent liquid height of the surface pressure', 'h_eq = p_s / γ', `h_eq = ${f(p.ps)} / ${f(gam)}`,
        `h_eq = ${f(heq)} ${L}`,
        'The gas pressure is replaced by an imaginary extra column of liquid; depths are then measured from this imaginary free surface.');
    }
    st.add(`Area of the gate — ${G.name}`, G.fA, G.sA, `A = ${f(G.A)} ${U.area}`, 'Wetted area of the plane surface.');
    st.add('Location of the centroid along the plate', G.fy, G.sy, `ȳc = ${f(G.yc)} ${L} below the top edge`,
      'Where the centroid (CG) sits measured down the plate from its top edge.');
    st.add('Centroidal moment of inertia', G.fI, G.sI, `I_g = ${f(G.Ig)} ${U.inertia}`,
      'Second moment of area about the centroidal axis parallel to the free surface.');

    const yTop = (p.h1 + heq) / sn;          // along the plane from the (equivalent) surface to the top edge
    const ybar = yTop + G.yc;
    const hbar = ybar * sn;
    if (vertical) {
      st.add('Depth of the centroid', 'h̄ = h₁ + (h_eq) + ȳc', `h̄ = ${f(p.h1)}${p.ps > 0 ? ' + ' + f(heq) : ''} + ${f(G.yc)}`,
        `h̄ = ȳ = ${f(hbar)} ${L}`, 'For a vertical plate the inclined distance ȳ equals the vertical depth h̄.');
    } else {
      st.add('Inclined distance from the free-surface line to the centroid', 'ȳ = (h₁ + h_eq)/sin θ + ȳc',
        `ȳ = (${f(p.h1)} + ${f(heq)})/sin ${f(thDeg)}° + ${f(G.yc)}`, `ȳ = ${f(ybar)} ${L}`,
        'Measured along the plate from where the plate (extended) meets the free surface.');
      st.add('Vertical depth of the centroid', 'h̄ = ȳ sin θ', `h̄ = ${f(ybar)} × sin ${f(thDeg)}°`, `h̄ = ${f(hbar)} ${L}`,
        'Pressure depends on vertical depth, so convert ȳ to h̄.');
    }
    const F = gam * hbar * G.A;
    st.add('Total hydrostatic force', 'F = γ h̄ A', `F = ${f(gam)} × ${f(hbar)} × ${f(G.A)}`, `F = ${f(F)} ${U.force}`,
      'The resultant force equals the pressure at the centroid times the area; it acts normal to the plate.');
    const e = G.Ig / (G.A * ybar);
    st.add('Eccentricity (CP below CG)', 'e = I_g / (A ȳ)', `e = ${f(G.Ig)} / (${f(G.A)} × ${f(ybar)})`, `e = ${f(e)} ${L}`,
      'The centre of pressure is always below the centroid because pressure increases with depth.');
    const yp = ybar + e;
    st.add('Centre of pressure along the plate', 'y_p = ȳ + I_g/(A ȳ)', `y_p = ${f(ybar)} + ${f(e)}`, `y_p = ${f(yp)} ${L}`,
      'Inclined distance from the free-surface line to the line of action of F.');
    const hp = yp * sn;
    const over = thDeg > 90 + 1e-9;
    if (!vertical && over) {
      st.add('Gate leans over the liquid (θ > 90°)', 'sin θ = sin(180° − θ)', `sin ${f(thDeg)}° = sin ${f(180 - thDeg)}°`, `sin θ = ${f(sn)}`,
        `The liquid is under the gate. Depths along the plate use the acute angle ${f(180 - thDeg)}° it makes with the free surface, so F and the CP come out the same way; only the direction of F changes (it pushes up and out on the gate).`);
    }
    if (!vertical) {
      st.add('Vertical depth of the centre of pressure', 'h_p = y_p sin θ', `h_p = ${f(yp)} × sin ${f(thDeg)}°`, `h_p = ${f(hp)} ${L}`,
        'Converts the inclined CP distance to a vertical depth.');
    }
    if (p.ps > 0) {
      st.add('CP depth below the ACTUAL liquid surface', 'h_p,actual = h_p − h_eq', `= ${f(hp)} − ${f(heq)}`,
        `h_p,actual = ${f(hp - heq)} ${L}`, 'Removes the imaginary column added for the surface pressure.');
    }
    const hBot = p.h1 + G.Lp * sn;
    const pTop = gam * p.h1 + p.ps, pBot = gam * hBot + p.ps;
    st.add('Pressure at the top and bottom edges', 'p = γh + p_s',
      `p_top = ${f(gam)}×${f(p.h1)}${p.ps ? ' + ' + f(p.ps) : ''};  p_bot = ${f(gam)}×${f(hBot)}${p.ps ? ' + ' + f(p.ps) : ''}`,
      `p_top = ${f(pTop)} ${U.press},  p_bot = ${f(pBot)} ${U.press}`, 'These are the ordinates of the pressure diagram (trapezoid / triangle).');

    // components of F (F acts normal to the plate, from the liquid onto it)
    const FH = F * sn, FV = F * Math.abs(cs);
    if (!vertical) {
      st.add('Horizontal component of F', 'F_H = F sin θ', `F_H = ${f(F)} × sin ${f(thDeg)}°`, `F_H = ${f(FH)} ${U.force}  (→, toward the dry side)`,
        'Equals the force on the vertical projection of the gate.');
      if (Math.abs(cs) > 1e-9) st.add('Vertical component of F', 'F_V = F |cos θ|', `F_V = ${f(F)} × |cos ${f(thDeg)}°|`,
        `F_V = ${f(FV)} ${U.force}  (${over ? '↑ upward' : '↓ downward'})`,
        over ? 'The liquid is under the gate, so F_V pushes up: it equals the weight of the IMAGINARY liquid between the gate and the free surface above it.'
          : 'The liquid is on top of the gate, so F_V pushes down: it equals the weight of the REAL liquid between the gate and the free surface.');
    }
    out.push({ k: 'γ', v: gam, u: U.gamma });
    out.push({ k: 'Area A', v: G.A, u: U.area });
    out.push({ k: 'I_g', v: G.Ig, u: U.inertia });
    if (!vertical) out.push({ k: 'ȳ (inclined)', v: ybar, u: L });
    out.push({ k: 'h̄ (depth of CG)', v: hbar, u: L });
    out.push({ k: 'Total force F', v: F, u: U.force, hl: true });
    out.push({ k: 'Eccentricity e', v: e, u: L });
    if (!vertical) out.push({ k: 'y_p (inclined)', v: yp, u: L, hl: true });
    if (!vertical) out.push({ k: 'F_H (horizontal, →)', v: FH, u: U.force });
    if (!vertical && Math.abs(cs) > 1e-9) out.push({ k: over ? 'F_V (vertical, ↑ up)' : 'F_V (vertical, ↓ down)', v: FV, u: U.force });
    out.push({ k: 'h_p (depth of CP)', v: hp, u: L, hl: true });
    if (p.ps > 0) out.push({ k: 'h_p below actual surface', v: hp - heq, u: L });
    out.push({ k: 'p at top edge', v: pTop, u: U.press });
    out.push({ k: 'p at bottom edge', v: pBot, u: U.press });

    // ---- liquid on both sides -------------------------------------
    let F2 = 0, yp2 = 0, yTop2 = 0, gam2 = 0, ybar2 = 0, hbar2 = 0, e2 = 0;
    const sCP1 = yp - yTop; // CP of side 1 measured from top edge along plate
    let Fnet = F, sR = sCP1;
    if (p.both) {
      gam2 = p.sg2 * U.gw;
      yTop2 = p.h2 / sn;
      ybar2 = yTop2 + G.yc; hbar2 = ybar2 * sn;
      F2 = gam2 * hbar2 * G.A;
      e2 = G.Ig / (G.A * ybar2);
      yp2 = ybar2 + e2;
      const sCP2 = yp2 - yTop2;
      st.add('Force from the liquid on the other side', 'F₂ = γ₂ h̄₂ A,  γ₂ = Sg₂ γw',
        `F₂ = (${f(p.sg2)}×${f(U.gw)}) × ${f(hbar2)} × ${f(G.A)}`, `F₂ = ${f(F2)} ${U.force}`,
        'The second liquid pushes on the opposite face, against F.');
      st.add('Centre of pressure of F₂', 'y_p2 = ȳ₂ + I_g/(A ȳ₂)', `y_p2 = ${f(ybar2)} + ${f(G.Ig)}/(${f(G.A)}×${f(ybar2)})`,
        `y_p2 = ${f(yp2)} ${L}  (${f(sCP2)} ${L} from the top edge)`, 'Located the same way as for side 1, from the second free surface.');
      Fnet = F - F2;
      if (Math.abs(Fnet) > 1e-9 * Math.max(F, F2)) {
        sR = (F * sCP1 - F2 * sCP2) / Fnet;
        st.add('Resultant of both forces', 'R = F₁ − F₂;  s_R = (F₁ s₁ − F₂ s₂)/R  (from top edge)',
          `R = ${f(F)} − ${f(F2)};  s_R = (${f(F)}×${f(sCP1)} − ${f(F2)}×${f(sCP2)})/${f(Fnet)}`,
          `R = ${f(Fnet)} ${U.force} at ${f(sR)} ${L} from the top edge`,
          'Moments of the two forces about the top edge locate the resultant.');
        if (sR < 0 || sR > G.Lp) warn.push('The resultant of the two forces falls outside the gate (the forces nearly cancel and leave a couple).');
      } else {
        sR = NaN;
        warn.push('F₁ = F₂: the resultant force is zero; the gate carries only a couple.');
      }
      out.push({ k: 'F₂ (other side)', v: F2, u: U.force });
      out.push({ k: 'Resultant R = F₁ − F₂', v: Fnet, u: U.force, hl: true });
      out.push({ k: 'R acts from top edge', v: sR, u: L });
    }

    // ---- hinge -----------------------------------------------------
    let hinge = null;
    if (p.hinge === 'top' || p.hinge === 'bottom') {
      const M = p.both ? (F * sCP1 - F2 * (yp2 - yTop2)) : F * sCP1; // moment about the top edge
      let Mh, arm, P;
      if (p.hinge === 'top') {
        Mh = M; arm = p.both ? sR : sCP1; P = Mh / G.Lp;
        st.add('Moment about the hinge at the top edge', 'M = F × (distance from hinge to CP)',
          p.both ? `M = F₁ s₁ − F₂ s₂ = ${f(F)}×${f(sCP1)} − ${f(F2)}×${f(yp2 - yTop2)}` : `M = ${f(F)} × ${f(sCP1)}`,
          `M = ${f(Mh)} ${U.mom}`, 'The hydrostatic force tends to rotate the gate about its hinge.');
        st.add('Force at the bottom edge to hold the gate (normal to it)', 'P × L_gate = M', `P = ${f(Mh)} / ${f(G.Lp)}`,
          `P = ${f(P)} ${U.force}`, 'Taking moments about the hinge: the holding force at the opposite edge balances M.');
      } else {
        const FF = p.both ? Fnet : F;
        Mh = FF * G.Lp - M; arm = G.Lp - (p.both ? sR : sCP1); P = Mh / G.Lp;
        st.add('Moment about the hinge at the bottom edge', 'M = F × (L_gate − s_CP)',
          p.both ? `M = R·L − (F₁s₁ − F₂s₂) = ${f(FF)}×${f(G.Lp)} − ${f(M)}` : `M = ${f(F)} × (${f(G.Lp)} − ${f(sCP1)})`,
          `M = ${f(Mh)} ${U.mom}`, 'Lever arm is measured up the plate from the bottom hinge to the CP.');
        st.add('Force at the top edge to hold the gate (normal to it)', 'P × L_gate = M', `P = ${f(Mh)} / ${f(G.Lp)}`,
          `P = ${f(P)} ${U.force}`, 'Moments about the bottom hinge.');
      }
      hinge = { at: p.hinge, M: Mh, P, arm };
      out.push({ k: 'Moment about hinge', v: Mh, u: U.mom, hl: true });
      out.push({ k: 'Holding force P (opposite edge)', v: P, u: U.force, hl: true });
      if (P < 0) warn.push('Holding force is negative: the gate tends to rotate toward the liquid side; the support must pull instead of push.');
    }

    return {
      ok: true, err, warn, steps: st.list, out,
      status: { cls: 'ok', text: `F = ${f(F)} ${U.force} at h_p = ${f(hp)} ${L}` },
      geo: {
        G, thDeg, sn, cs, gam, heq, yTop, ybar, hbar, F, FH, FV, over, e, yp, hp, sCP: sCP1, sCG: G.yc, pTop, pBot, hBot,
        both: p.both ? { gam2, F2, yp2, yTop2, sCP2: yp2 - yTop2, h2: p.h2, Fnet, sR } : null,
        hinge, h1: p.h1, ps: p.ps,
      },
    };
  }

  /**
   * Curved surface.
   * p = { sg, type:'quarter'|'semi'|'full', R, L, side:'concave'|'convex', hd }
   * Geometry (centre O at the origin, y up):
   *  quarter — arc in the lower-right quadrant from (R,0) to (0,−R); top of curve at y = 0
   *  semi    — right half of the circle, top (0,R) to bottom (0,−R)
   *  full    — cylinder, liquid on the left touching the left half
   */
  function curved(p, U) {
    const st = Steps(), warn = [], err = [], out = [];
    const f = fmt, L = U.len;
    const gam = p.sg * U.gw, R = p.R, W = p.L, hd = p.hd;
    if (!(R > 0 && W > 0)) err.push('Radius and length must be positive.');
    if (hd < 0) err.push('Liquid surface is below the top of the curved surface (depth < 0). Only fully covered curves are handled.');
    if (err.length) return { ok: false, err, warn, steps: [], out, geo: {} };
    const type = p.type;
    const side = type === 'full' ? 'convex' : p.side;
    let Hp, Av, xV, vDown, hRight, yTop;
    if (type === 'quarter') {
      Hp = R; yTop = 0; Av = R * hd + (PI * R * R) / 4;
      xV = ((R * R * hd) / 2 + R ** 3 / 3) / Av;
      vDown = side === 'concave'; hRight = side === 'concave';
    } else if (type === 'semi') {
      Hp = 2 * R; yTop = R; Av = (PI * R * R) / 2; xV = (4 * R) / (3 * PI);
      vDown = side === 'concave'; hRight = side === 'concave';
    } else {
      Hp = 2 * R; yTop = R; Av = (PI * R * R) / 2; xV = -(4 * R) / (3 * PI);
      vDown = false; hRight = true;
    }
    st.add('Unit weight of the liquid', 'γ = Sg × γw', `γ = ${f(p.sg)} × ${f(U.gw)}`, `γ = ${f(gam)} ${U.gamma}`,
      'Converts specific gravity into unit weight.');
    const Aproj = Hp * W;
    st.add('Vertical projection of the curved surface', 'A_proj = (projected height) × L',
      `A_proj = ${f(Hp)} × ${f(W)}`, `A_proj = ${f(Aproj)} ${U.area}`,
      'The horizontal force on a curved surface equals the force on its vertical projection.');
    const hbar = hd + Hp / 2;
    st.add('Depth of the centroid of the projection', 'h̄ = (depth to top of curve) + (projected height)/2',
      `h̄ = ${f(hd)} + ${f(Hp)}/2`, `h̄ = ${f(hbar)} ${L}`, 'Centroid of the vertical rectangle.');
    const FH = gam * hbar * Aproj;
    st.add('Horizontal component', 'F_H = γ h̄ A_proj', `F_H = ${f(gam)} × ${f(hbar)} × ${f(Aproj)}`, `F_H = ${f(FH)} ${U.force}  (${hRight ? '→' : '←'})`,
      'Acts horizontally toward the dry side.');
    const hpH = hbar + (Hp * Hp) / 12 / hbar;
    st.add('Line of action of F_H', 'h_p = h̄ + I_g/(A h̄) = h̄ + H²/(12 h̄)', `h_p = ${f(hbar)} + ${f(Hp)}²/(12 × ${f(hbar)})`,
      `h_p = ${f(hpH)} ${L} below the free surface`, 'Centre of pressure of the vertical projection.');

    let Vdesc;
    if (type === 'quarter') {
      Vdesc = `Area above the arc up to the free surface = R·h + πR²/4 = ${f(R)}×${f(hd)} + π×${f(R)}²/4`;
    } else if (type === 'semi') {
      const Adn = R * (hd + R) + (PI * R * R) / 4, Aup = R * (hd + R) - (PI * R * R) / 4;
      Vdesc = `Lower quarter: ${f(Adn)} (${side === 'concave' ? 'real ↓' : 'imag. ↑'}), upper quarter: ${f(Aup)} (${side === 'concave' ? 'imag. ↑' : 'real ↓'}) → net = πR²/2`;
    } else {
      Vdesc = 'Upper-left quarter pushes down, lower-left pushes up; net = half circle πR²/2 (upward)';
    }
    const Vv = Av * W;
    st.add('Volume of liquid (real or imaginary) vertically above the surface', 'V = (area of pressure prism) × L',
      `${Vdesc};  V = ${f(Av)} × ${f(W)}`, `V = ${f(Vv)} ${U.vol} — ${vDown ? 'REAL liquid above → F_V downward' : 'IMAGINARY liquid above → F_V upward'}`,
      'The vertical component equals the weight of the liquid (real or imaginary) between the curve and the free surface.');
    const FV = gam * Vv;
    st.add('Vertical component', 'F_V = γ V', `F_V = ${f(gam)} × ${f(Vv)}`, `F_V = ${f(FV)} ${U.force}  (${vDown ? '↓' : '↑'})`,
      'Weight of the pressure prism.');
    st.add('Line of action of F_V', type === 'quarter' ? 'x̄ = Σ(A x)/ΣA  (quarter circle: 4R/(3π); rectangle: R/2)' : 'x̄ = 4R/(3π) from the vertical diameter',
      type === 'quarter' ? `x̄ = (${f(R * hd)}×${f(R / 2)} + ${f((PI * R * R) / 4)}×${f((4 * R) / (3 * PI))})/${f(Av)}` : `x̄ = 4×${f(R)}/(3π)`,
      `x̄ = ${f(Math.abs(xV))} ${L} from the centre O`, 'Passes through the centroid of the shaded pressure-prism area.');
    const Rres = Math.hypot(FH, FV);
    const ang = Math.atan2(FV, FH) / DEG;
    st.add('Resultant', 'R = √(F_H² + F_V²)', `R = √(${f(FH)}² + ${f(FV)}²)`, `R = ${f(Rres)} ${U.force}`, 'Combine both components.');
    st.add('Direction of the resultant', 'θ = tan⁻¹(F_V / F_H)', `θ = tan⁻¹(${f(FV)} / ${f(FH)})`, `θ = ${f(ang)}° from the horizontal`,
      'For a circular arc every pressure acts through the centre, so R passes through the centre O.');

    out.push({ k: 'γ', v: gam, u: U.gamma });
    out.push({ k: 'F_H', v: FH, u: U.force, hl: true });
    out.push({ k: 'F_H acts at depth', v: hpH, u: L });
    out.push({ k: 'F_V', v: FV, u: U.force, hl: true });
    out.push({ k: 'F_V acts at x̄ from O', v: Math.abs(xV), u: L });
    out.push({ k: 'Resultant R', v: Rres, u: U.force, hl: true });
    out.push({ k: 'Angle θ', v: ang, u: '°' });
    return {
      ok: true, err, warn, steps: st.list, out,
      status: { cls: 'ok', text: `R = ${f(Rres)} ${U.force} at ${f(ang)}°` },
      geo: { type, side, R, W, hd, Hp, yTop, yFS: yTop + hd, FH, FV, Rres, ang, hpH, xV, vDown, hRight, Av, gam },
    };
  }

  /* =================================================================== */
  /* MODULE 2 — BUOYANCY AND FLOTATION                                   */
  /* =================================================================== */
  /*
   * Each body: H(d) total height; A(z,d) horizontal section area at height z
   * above the bottom; V(z,d) volume below height z (displaced volume at draft z);
   * I(z,d) second moment of the waterplane at z about the tilt axis;
   * inv(V,d) analytic draft from displaced volume (if it exists).
   */
  const sq = (x) => x * x;
  const segA = (r, z) => { z = clamp(z, 0, 2 * r); return r * r * Math.acos((r - z) / r) - (r - z) * Math.sqrt(Math.max(0, 2 * r * z - z * z)); };
  const capV = (r, z) => (PI * z * z * (3 * r - z)) / 3;
  const BODY = {
    box: {
      name: 'Rectangular block', group: 'Prismatic — vertical axis',
      dims: [{ k: 'L', label: 'Length L', def: 2 }, { k: 'B', label: 'Width B (section)', def: 1 }, { k: 'H', label: 'Height H', def: 1 }],
      H: (d) => d.H, A: (z, d) => d.L * d.B, V: (z, d) => d.L * d.B * z,
      I: (z, d) => (d.L * d.B ** 3) / 12, If: 'I = L·B³/12 (tilt about the axis parallel to L)',
      Vf: 'V_D = L·B·D', Vtf: 'V = L·B·H', inv: (V, d) => V / (d.L * d.B), invf: 'D = V_D / (L·B)', prism: true,
    },
    vcyl: {
      name: 'Vertical cylinder', group: 'Prismatic — vertical axis',
      dims: [{ k: 'Dc', label: 'Diameter Ø', def: 1 }, { k: 'H', label: 'Height H', def: 1.5 }],
      H: (d) => d.H, A: (z, d) => (PI * d.Dc ** 2) / 4, V: (z, d) => ((PI * d.Dc ** 2) / 4) * z,
      I: (z, d) => (PI * d.Dc ** 4) / 64, If: 'I = πØ⁴/64',
      Vf: 'V_D = (πØ²/4)·D', Vtf: 'V = (πØ²/4)·H', inv: (V, d) => V / ((PI * d.Dc ** 2) / 4), invf: 'D = V_D / (πØ²/4)', prism: true,
    },
    tri: {
      name: 'Triangular prism (vertical axis)', group: 'Prismatic — vertical axis',
      dims: [{ k: 'b', label: 'Triangle base b', def: 1.2 }, { k: 't', label: 'Triangle altitude t', def: 1 }, { k: 'H', label: 'Height H', def: 1 }],
      H: (d) => d.H, A: (z, d) => (d.b * d.t) / 2, V: (z, d) => ((d.b * d.t) / 2) * z,
      I: (z, d) => (d.t * d.b ** 3) / 48, If: 'I = t·b³/48 (about the axis of symmetry)',
      Vf: 'V_D = (b·t/2)·D', Vtf: 'V = (b·t/2)·H', inv: (V, d) => V / ((d.b * d.t) / 2), invf: 'D = V_D / (b·t/2)', prism: true,
    },
    custom: {
      name: 'Custom area A × H', group: 'Prismatic — vertical axis',
      dims: [{ k: 'A', label: 'Cross-section area A', def: 1, area: true, max: 50 }, { k: 'H', label: 'Height H', def: 1 }],
      H: (d) => d.H, A: (z, d) => d.A, V: (z, d) => d.A * z,
      I: (z, d) => (d.A * d.A) / 12, If: 'I = A²/12 (assumes a square section)',
      Vf: 'V_D = A·D', Vtf: 'V = A·H', inv: (V, d) => V / d.A, invf: 'D = V_D / A', prism: true,
    },
    hcyl: {
      name: 'Horizontal cylinder (log)', group: 'Prismatic — floating on its side',
      dims: [{ k: 'Dc', label: 'Diameter Ø', def: 1 }, { k: 'L', label: 'Length L', def: 3 }],
      H: (d) => d.Dc, A: (z, d) => d.L * 2 * Math.sqrt(Math.max(0, z * (d.Dc - z))),
      V: (z, d) => d.L * segA(d.Dc / 2, z),
      I: (z, d) => (d.L * (2 * Math.sqrt(Math.max(0, z * (d.Dc - z)))) ** 3) / 12, If: 'I = L·w³/12, w = 2√(D(Ø − D))',
      Vf: 'V_D = L[r² cos⁻¹((r − D)/r) − (r − D)√(2rD − D²)]', Vtf: 'V = πØ²L/4',
    },
    triside: {
      name: 'Triangular prism, apex down', group: 'Prismatic — floating on its side',
      dims: [{ k: 'b', label: 'Top width b', def: 1.2 }, { k: 'h', label: 'Depth h', def: 1 }, { k: 'L', label: 'Length L', def: 3 }],
      H: (d) => d.h, A: (z, d) => (d.L * d.b * z) / d.h, V: (z, d) => (d.L * d.b * z * z) / (2 * d.h),
      I: (z, d) => (d.L * ((d.b * z) / d.h) ** 3) / 12, If: 'I = L·w³/12, w = b·D/h',
      Vf: 'V_D = L·(b·D/h)·D/2 = V·(D/h)²', Vtf: 'V = b·h·L/2', inv: (V, d) => d.h * Math.sqrt(V / ((d.b * d.h * d.L) / 2)), invf: 'D = h·√(V_D / V)',
    },
    sphere: {
      name: 'Sphere', group: 'Non-prismatic',
      dims: [{ k: 'Ds', label: 'Diameter Ø', def: 1 }],
      H: (d) => d.Ds, A: (z, d) => PI * Math.max(0, z * (d.Ds - z)), V: (z, d) => capV(d.Ds / 2, z),
      I: (z, d) => (PI * sq(Math.max(0, z * (d.Ds - z)))) / 4, If: 'I = πa⁴/4, a² = D(Ø − D)',
      Vf: 'V_D = πD²(3r − D)/3  (spherical cap)', Vtf: 'V = πØ³/6',
    },
    coneDown: {
      name: 'Cone, apex down', group: 'Non-prismatic',
      dims: [{ k: 'Dc', label: 'Top diameter Ø', def: 1 }, { k: 'H', label: 'Height H', def: 1.2 }],
      H: (d) => d.H, A: (z, d) => PI * sq((d.Dc / 2) * (z / d.H)), V: (z, d) => (PI * sq(d.Dc / 2) * z ** 3) / (3 * d.H * d.H),
      I: (z, d) => (PI * ((d.Dc / 2) * (z / d.H)) ** 4) / 4, If: 'I = πr⁴/4, r = (Ø/2)(D/H)',
      Vf: 'V_D = V·(D/H)³', Vtf: 'V = πØ²H/12', inv: (V, d) => d.H * Math.cbrt(V / ((PI * sq(d.Dc / 2) * d.H) / 3)), invf: 'D = H·(V_D/V)^(1/3)',
    },
    coneUp: {
      name: 'Cone, apex up', group: 'Non-prismatic',
      dims: [{ k: 'Dc', label: 'Base diameter Ø', def: 1 }, { k: 'H', label: 'Height H', def: 1.2 }],
      H: (d) => d.H, A: (z, d) => PI * sq((d.Dc / 2) * (1 - z / d.H)),
      V: (z, d) => (PI * sq(d.Dc / 2) * d.H) / 3 - (PI * sq(d.Dc / 2) * (d.H - z) ** 3) / (3 * d.H * d.H),
      I: (z, d) => (PI * ((d.Dc / 2) * (1 - z / d.H)) ** 4) / 4, If: 'I = πr⁴/4, r = (Ø/2)(1 − D/H)',
      Vf: 'V_D = V[1 − ((H − D)/H)³]', Vtf: 'V = πØ²H/12',
      inv: (V, d) => d.H * (1 - Math.cbrt(Math.max(0, 1 - V / ((PI * sq(d.Dc / 2) * d.H) / 3)))), invf: 'D = H[1 − (1 − V_D/V)^(1/3)]',
    },
    pyramid: {
      name: 'Square pyramid, apex down', group: 'Non-prismatic',
      dims: [{ k: 'a', label: 'Top side a', def: 1 }, { k: 'H', label: 'Height H', def: 1.2 }],
      H: (d) => d.H, A: (z, d) => sq((d.a * z) / d.H), V: (z, d) => (d.a * d.a * z ** 3) / (3 * d.H * d.H),
      I: (z, d) => ((d.a * z) / d.H) ** 4 / 12, If: 'I = s⁴/12, s = a·D/H',
      Vf: 'V_D = V·(D/H)³', Vtf: 'V = a²H/3', inv: (V, d) => d.H * Math.cbrt(V / ((d.a * d.a * d.H) / 3)), invf: 'D = H·(V_D/V)^(1/3)',
    },
    frustum: {
      name: 'Frustum of a cone', group: 'Non-prismatic',
      dims: [{ k: 'D1', label: 'Top diameter Ø₁', def: 1.2 }, { k: 'D2', label: 'Bottom diameter Ø₂', def: 0.6 }, { k: 'H', label: 'Height H', def: 1 }],
      H: (d) => d.H,
      A: (z, d) => PI * sq(d.D2 / 2 + ((d.D1 - d.D2) / 2) * (z / d.H)),
      V: (z, d) => { const r2 = d.D2 / 2, r = r2 + ((d.D1 - d.D2) / 2) * (z / d.H); return (PI * z * (r2 * r2 + r2 * r + r * r)) / 3; },
      I: (z, d) => (PI * (d.D2 / 2 + ((d.D1 - d.D2) / 2) * (z / d.H)) ** 4) / 4, If: 'I = πr⁴/4 at the waterline',
      Vf: 'V_D = πD(r₂² + r₂r + r²)/3, r = r₂ + (r₁ − r₂)D/H', Vtf: 'V = πH(r₁² + r₁r₂ + r₂²)/3',
    },
    hemi: {
      name: 'Hemisphere (bowl, flat face up)', group: 'Non-prismatic',
      dims: [{ k: 'Ds', label: 'Diameter Ø', def: 1.2 }],
      H: (d) => d.Ds / 2, A: (z, d) => PI * Math.max(0, z * (d.Ds - z)), V: (z, d) => capV(d.Ds / 2, Math.min(z, d.Ds / 2)),
      I: (z, d) => (PI * sq(Math.max(0, z * (d.Ds - z)))) / 4, If: 'I = πa⁴/4, a² = D(Ø − D)',
      Vf: 'V_D = πD²(3r − D)/3  (spherical cap)', Vtf: 'V = πØ³/12',
    },
  };

  /**
   * p = { sgL, drive:'sg'|'W', sgB, W, shape, dims, mode:'auto'|'manual', draft, P,
   *       layer, sg2, t2, stab, zG (null → centroid), phi(deg) }
   * P = external vertical load, + downward (load/anchor), − upward (lift).
   */
  function buoyancy(p, U) {
    if (p.ballast && p.ballast.on) return ballastSolve(p, U);
    const st = Steps(), warn = [], err = [], out = [];
    const f = fmt, L = U.len, Fu = U.force;
    const B = BODY[p.shape], d = p.dims;
    const H = B.H(d);
    if (!(H > 0) || Object.values(d).some((v) => !(v > 0))) err.push('All body dimensions must be positive.');
    if (p.shape === 'frustum' && !(d.D1 > 0 && d.D2 > 0)) err.push('Frustum diameters must be positive.');
    if (!(p.sgL > 0)) err.push('Liquid Sg must be positive.');
    if (p.layer && !(p.t2 >= 0)) err.push('Upper layer thickness must be ≥ 0.');
    if (p.layer && p.layer3 && !(p.t3 >= 0)) err.push('Top layer thickness must be ≥ 0.');
    if (err.length) return { ok: false, err, warn, steps: [], out, geo: {} };

    const gL = p.sgL * U.gw;
    const three = !!(p.layer && p.layer3);
    const t2 = p.layer ? p.t2 : 0, g2 = p.layer ? p.sg2 * U.gw : gL;
    const t3 = three ? p.t3 : 0, g3 = three ? p.sg3 * U.gw : g2;
    if (p.layer && p.sg2 > p.sgL) warn.push('Upper layer is heavier than the lower liquid — the layers would overturn; results assume they stay layered.');
    if (three && p.sg3 > p.sg2) warn.push('Top layer is heavier than the middle layer — the layers would overturn; results assume they stay layered.');
    // liquid bands, measured as depth below the top free surface: [from, to)
    const bands = [];
    if (three) bands.push({ g: g3, a: 0, b: t3 });
    if (p.layer) bands.push({ g: g2, a: t3, b: t3 + t2 });
    bands.push({ g: gL, a: t3 + t2, b: Infinity });
    const zAt = (D, depth) => clamp(D - depth, 0, H);
    const Vt = B.V(H, d);
    st.add('Unit weight of the liquid', 'γ_L = Sg_L × γw', `γ_L = ${f(p.sgL)} × ${f(U.gw)}`, `γ_L = ${f(gL)} ${U.gamma}`, 'Unit weight of the supporting liquid.');
    st.add('Total volume of the body', B.Vtf, '', `V = ${f(Vt)} ${U.vol}`, 'Needed for the weight and for the maximum buoyant force.');
    let W, sgB;
    if (p.drive === 'W') {
      W = p.W; sgB = W / (U.gw * Vt);
      st.add('Specific gravity of the body (from its weight)', 'Sg_B = W / (γw V)', `Sg_B = ${f(W)} / (${f(U.gw)} × ${f(Vt)})`, `Sg_B = ${f(sgB)}`, 'Back-computed from the given weight.');
    } else {
      sgB = p.sgB; W = sgB * U.gw * Vt;
      st.add('Weight of the body', 'W = Sg_B × γw × V', `W = ${f(sgB)} × ${f(U.gw)} × ${f(Vt)}`, `W = ${f(W)} ${Fu}`, 'Weight from the body’s specific gravity.');
    }
    const Wreq = W + p.P;
    if (p.P !== 0) {
      st.add('Total downward load to be carried by buoyancy', 'ΣF_v = 0 → BF = W + P', `BF = ${f(W)} + (${f(p.P)})`, `BF = ${f(Wreq)} ${Fu}`,
        'P is the external vertical load (+ down, e.g. anchor tension or a load on top; − up, e.g. lifting).');
    }
    // Buoyant force as a function of draft D (depth of the body bottom below the top free surface)
    const zu = (D) => clamp(D, 0, H);
    const BF = (D) => bands.reduce((s, bd) => s + bd.g * (B.V(zAt(D, bd.a), d) - B.V(zAt(D, bd.b), d)), 0);
    const Dmax = H + t2 + t3;
    const BFmax = BF(Dmax);
    st.add('Maximum buoyant force (fully submerged)', p.layer ? 'BF_max = γ_L V' : 'BF_max = γ_L V', `BF_max = ${f(gL)} × ${f(Vt)}`,
      `BF_max = ${f(BFmax)} ${Fu}`, 'If the load exceeds this, the body cannot float.');

    let D, state, lift = 0;
    if (p.mode === 'manual') {
      D = clamp(p.draft, 0, Dmax);
      state = 'manual';
    } else if (Wreq <= 0) {
      err.push('Net external upward force exceeds the weight (W + P ≤ 0): the body is lifted completely out of the liquid.');
      return { ok: false, err, warn, steps: st.list, out, geo: {} };
    } else if (Wreq > BFmax * (1 + 1e-9)) {
      D = Dmax; state = 'sinks'; lift = Wreq - BFmax;
    } else if (Math.abs(Wreq - BFmax) <= 1e-9 * BFmax) {
      D = Dmax; state = 'neutral';
    } else {
      D = bisect(BF, Wreq, 0, Dmax, 300);
      state = 'floats';
    }

    const VD = B.V(zu(D), d); // volume below the top surface
    const BFD = BF(D);
    if (p.mode !== 'manual') {
      if (state === 'floats') {
        if (!p.layer) {
          const VDreq = Wreq / gL;
          st.add('Displaced volume for equilibrium', 'ΣF_v = 0:  γ_L V_D = W + P  →  V_D = (W + P)/γ_L', `V_D = ${f(Wreq)} / ${f(gL)}`,
            `V_D = ${f(VDreq)} ${U.vol}`, 'Archimedes: buoyant force = weight of displaced liquid.');
          if (B.inv) {
            st.add('Draft (depth of immersion)', `${B.Vf}  →  ${B.invf}`, '', `D = ${f(D)} ${L}`, 'Solve the displaced-volume expression for D.');
            if (B.prism && p.P === 0) {
              st.add('Check with the prismatic shortcut', 'D = (Sg_B / Sg_L) × H', `D = (${f(sgB)} / ${f(p.sgL)}) × ${f(H)}`,
                `D = ${f((sgB / p.sgL) * H)} ${L}`, 'For prismatic bodies the draft ratio equals the Sg ratio.');
            }
          } else {
            st.add('Draft (solved numerically)', `${B.Vf} = V_D`, `solve for D with V_D = ${f(VDreq)}`, `D = ${f(D)} ${L}`,
              'This equation has no simple closed form — solved by bisection.');
          }
        } else {
          st.add(three ? 'Draft with three liquid layers (solved numerically)' : 'Draft with two liquid layers (solved numerically)', three ? 'γ_L V_bottom + γ₂ V_middle + γ₃ V_top = W + P' : 'γ_L V_lower + γ₂ V_upper = W + P',
            `γ₂ = ${f(p.sg2)}×${f(U.gw)} = ${f(g2)},  t₂ = ${f(t2)} ${L}` + (three ? `;  γ₃ = ${f(p.sg3)}×${f(U.gw)} = ${f(g3)},  t₃ = ${f(t3)} ${L}` : ''), `D = ${f(D)} ${L} below the top surface`,
            'Each liquid contributes the weight of the volume it displaces.');
          bands.forEach((bd, i) => {
            const v = B.V(zAt(D, bd.a), d) - B.V(zAt(D, bd.b), d);
            if (v > 0) st.add(`Volume displaced in ${bd.b === Infinity ? 'the bottom liquid' : i === 0 && three ? 'the top layer' : 'the upper layer'}`, 'BF_i = γ_i V_i', `BF_i = ${f(bd.g)} × ${f(v)}`, `BF_i = ${f(bd.g * v)} ${Fu}`, '');
          });
        }
      } else if (state === 'sinks') {
        st.add('Flotation check — SINKS', 'W + P > BF_max', `${f(Wreq)} > ${f(BFmax)}`, `Required lifting / supporting force = ${f(lift)} ${Fu}`,
          'The body sinks; this force (anchor, cable or support) is needed to hold it.');
      } else {
        st.add('Flotation check — NEUTRALLY BUOYANT', 'W + P = BF_max', `${f(Wreq)} ≈ ${f(BFmax)}`, 'Body stays at any depth once fully submerged', 'Weight exactly equals maximum buoyancy.');
      }
    } else {
      st.add('Buoyant force at the chosen draft', B.Vf + ';  BF = γ_L V_D', `D = ${f(D)} → V_D = ${f(VD)};  BF = ${f(gL)} × ${f(VD)}`,
        `BF = ${f(BFD)} ${Fu}`, 'Manual mode: buoyancy at the draft you set.');
      const net = BFD - Wreq;
      st.add('Net vertical force', 'F_net = BF − (W + P)', `F_net = ${f(BFD)} − ${f(Wreq)}`, `F_net = ${f(net)} ${Fu} → ${net > 1e-9 ? 'body RISES' : net < -1e-9 ? 'body SINKS deeper' : 'equilibrium'}`,
        'Positive = upward imbalance.');
    }

    const BFeq = state === 'manual' ? BFD : Math.min(Wreq, BFmax);
    const free = H - Math.min(D, H);
    if (state === 'floats' || state === 'manual') {
      st.add('Freeboard', 'freeboard = H − D', `= ${f(H)} − ${f(Math.min(D, H))}`, `freeboard = ${f(free)} ${L}`, 'Height of the body above the liquid surface.');
      st.add('Percent of volume submerged', 'V_D / V × 100%', `= ${f(VD)} / ${f(Vt)} × 100%`, `${f((VD / Vt) * 100)} %`, 'Fraction of the body below the surface.');
    }

    // centre of buoyancy (γ-weighted centroid of displaced volumes)
    const Mz = (a, b) => simpson((z) => z * B.A(z, d), a, b, 400);
    let wsum = 0, msum = 0;
    bands.forEach((bd) => { const lo = zAt(D, bd.b), hi = zAt(D, bd.a); if (hi > lo) { wsum += bd.g * (B.V(hi, d) - B.V(lo, d)); msum += bd.g * Mz(lo, hi); } });
    const zB = wsum > 0 ? msum / wsum : 0;
    const zGc = Mz(0, H) / Vt;
    const zG = p.zG === null || p.zG === undefined || !isFinite(p.zG) ? zGc : p.zG;

    out.push({ k: 'γ_L', v: gL, u: U.gamma });
    out.push({ k: 'Total volume V', v: Vt, u: U.vol });
    out.push({ k: 'Weight W', v: W, u: Fu, hl: p.drive === 'W' ? false : true });
    out.push({ k: 'Sg of body', v: sgB, u: '' });
    if (p.P) out.push({ k: 'External load P', v: p.P, u: Fu });
    out.push({ k: 'Buoyant force BF', v: state === 'manual' ? BFD : BFeq, u: Fu, hl: true });
    out.push({ k: 'BF_max', v: BFmax, u: Fu });
    out.push({ k: 'Displaced volume V_D', v: VD, u: U.vol });
    out.push({ k: 'Draft D', v: D, u: L, hl: true });
    if (state === 'floats' || state === 'manual') {
      out.push({ k: 'Freeboard', v: free, u: L, hl: true });
      out.push({ k: '% submerged', v: (VD / Vt) * 100, u: '%' });
    }
    if (state === 'sinks') out.push({ k: 'Lifting force needed', v: lift, u: Fu, hl: true });
    out.push({ k: 'B above bottom (KB)', v: zB, u: L });

    let stab = null;
    if (p.stab) {
      if (p.layer) {
        warn.push('Stability panel is computed for a single liquid only — turn off the extra layers.');
      } else {
        const zw = Math.min(D, H);
        const I = D < H ? B.I(zw, d) : 0;
        const BM = VD > 0 ? I / VD : 0;
        const KM = zB + BM, GM = KM - zG, BG = zG - zB;
        const phi = (p.phi || 0) * DEG;
        const Wd = BFeq;
        const RM = Wd * GM * Math.sin(phi);
        st.add('Centre of gravity G', 'KG = height of G above the bottom', p.zG == null ? `geometric centroid of the body` : 'user value', `KG = ${f(zG)} ${L}`, 'Where the weight acts.');
        st.add('Centre of buoyancy B', 'KB = centroid of the displaced volume', '', `KB = ${f(zB)} ${L}`, 'Where the buoyant force acts.');
        st.add('Second moment of the waterplane area', B.If, `at D = ${f(zw)}`, `I = ${f(I)} ${U.inertia}`, D >= H ? 'Fully submerged: no waterplane, BM = 0.' : 'Area of the body cut by the free surface, about the tilt axis.');
        st.add('Metacentric radius', 'BM = I / V_D', `BM = ${f(I)} / ${f(VD)}`, `BM = ${f(BM)} ${L}`, 'Distance from B to the metacentre M.');
        st.add('Metacentric height', zG >= zB ? 'MG = BM − BG' : 'MG = BM + BG  (G below B)', zG >= zB ? `MG = ${f(BM)} − ${f(BG)}` : `MG = ${f(BM)} + ${f(-BG)}`,
          `MG = ${f(GM)} ${L} → ${GM > 1e-9 ? 'STABLE (M above G)' : GM < -1e-9 ? 'UNSTABLE (M below G)' : 'NEUTRAL'}`, 'Stable if the metacentre is above G.');
        if (p.phi > 0) st.add('Righting moment', 'RM = W × MG × sin φ', `RM = ${f(Wd)} × ${f(GM)} × sin ${f(p.phi)}°`, `RM = ${f(RM)} ${U.mom}`,
          GM > 0 ? 'Positive → the couple W–BF restores the body.' : 'Negative → overturning moment.');
        out.push({ k: 'KG', v: zG, u: L });
        out.push({ k: 'BM', v: BM, u: L });
        out.push({ k: 'MG', v: GM, u: L, hl: true });
        if (p.phi > 0) out.push({ k: 'Righting moment', v: RM, u: U.mom, hl: true });
        stab = { I, BM, KM, GM, RM, zG, phi: p.phi || 0 };
        if (GM < -1e-9) warn.push('UNSTABLE: the metacentre is below G — the body will capsize.');
      }
    }

    let status;
    if (state === 'floats') status = { cls: 'ok', text: `Floats — draft ${f(D)} ${L}, freeboard ${f(free)} ${L}` };
    else if (state === 'sinks') { status = { cls: 'bad', text: `SINKS — needs ${f(lift)} ${Fu} lifting force` }; warn.push(`Body sinks: W + P = ${f(Wreq)} ${Fu} exceeds BF_max = ${f(BFmax)} ${Fu}. Required anchor/lifting force = ${f(lift)} ${Fu}.`); }
    else if (state === 'neutral') status = { cls: 'warn', text: 'Neutrally buoyant (BF_max = W)' };
    else {
      const net = BFD - Wreq;
      status = { cls: Math.abs(net) < 1e-6 ? 'ok' : 'warn', text: `Net force ${f(net)} ${Fu} → ${net > 1e-9 ? 'rises ↑' : net < -1e-9 ? 'sinks ↓' : 'equilibrium'}` };
    }
    return {
      ok: true, err, warn, steps: st.list, out, status,
      geo: { H, D, Dmax, t2, t3, Vt, VD, W, Wreq, BF: state === 'manual' ? BFD : BFeq, net: BFD - Wreq, zB, zG, state, stab, sgB, lift },
    };
  }

  /**
   * ATTACHED BALLAST / ADDED LOAD (add-on to Module 2).
   * p.ballast = { on, bodyDef:'solid'|'hollow', Wbody, matDef:'sg'|'gamma', sgb, gb,
   *   place:'inside'|'outside'|'hang'|'above', solve:'findW'|'findD',
   *   targetBy:'draft'|'proj', target, givenBy:'W'|'m', Wb, mb }
   * Inside / above: ballast adds weight only.          W_body + W_b = γ_L V_D
   * Outside / hanging: ballast also displaces liquid.  W_body + W_b = γ_L V_D + γ_L V_b,  V_b = W_b/γ_b
   */
  function ballastSolve(p, U) {
    const st = Steps(), warn = [], err = [], out = [];
    const f = fmt, L = U.len, Fu = U.force, g = U.g;
    const b = p.ballast, Bd = BODY[p.shape], d = p.dims;
    const H = Bd.H(d);
    if (!(H > 0) || Object.values(d).some((v) => !(v > 0))) err.push('All body dimensions must be positive.');
    if (!(p.sgL > 0)) err.push('Liquid Sg must be positive.');
    const gL = p.sgL * U.gw;
    const gb = b.matDef === 'gamma' ? b.gb : b.sgb * U.gw;
    if (!(gb > 0)) err.push('Ballast unit weight must be positive.');
    if (err.length) return { ok: false, err, warn, steps: [], out, geo: {} };
    if (p.layer) warn.push('Ballast panel uses a single liquid — the second liquid layer is ignored.');
    const hollow = b.bodyDef === 'hollow';
    const Vt = Bd.V(H, d);
    const wet = b.place === 'outside' || b.place === 'hang';
    const k = wet ? gL / gb : 0;           // BF_b / W_b
    const massOf = (W) => (U.id === 'SI' ? (W * 1000) / g : W / g);
    const massU = U.id === 'SI' ? 'kg' : 'slug';
    const placeTxt = { inside: 'inside the body / on top of it', outside: 'attached outside, below the waterline', hang: 'hanging by a cord, fully submerged', above: 'placed above the waterline' }[b.place];

    st.add('Unit weight of the liquid', 'γ_L = Sg_L × γw', `γ_L = ${f(p.sgL)} × ${f(U.gw)}`, `γ_L = ${f(gL)} ${U.gamma}`, 'Unit weight of the supporting liquid.');
    st.add('Unit weight of the ballast', b.matDef === 'gamma' ? 'γ_b given' : 'γ_b = Sg_b × γw', b.matDef === 'gamma' ? '' : `γ_b = ${f(b.sgb)} × ${f(U.gw)}`, `γ_b = ${f(gb)} ${U.gamma}`, 'Needed to find the ballast volume V_b = W_b/γ_b.');
    let Wbody;
    if (hollow) {
      Wbody = b.Wbody;
      st.add('Weight of the hollow / open container', 'W_body (given)', '', `W_body = ${f(Wbody)} ${Fu}`, 'A hollow body is defined by its own weight; its displaced volume is the outer volume below the waterline.');
    } else if (p.drive === 'W') {
      Wbody = p.W;
      st.add('Weight of the body', 'W_body (given)', '', `W_body = ${f(Wbody)} ${Fu}`, 'Solid body defined by its weight.');
    } else {
      Wbody = p.sgB * U.gw * Vt;
      st.add('Weight of the solid body', 'W_body = Sg_B × γw × V', `W_body = ${f(p.sgB)} × ${f(U.gw)} × ${f(Vt)}`, `W_body = ${f(Wbody)} ${Fu}`, 'Body weight from its specific gravity and total volume.');
    }
    const P = p.P || 0;
    if (P) st.add('External load', 'P (+ down)', '', `P = ${f(P)} ${Fu}`, 'Added to the weight the liquid must support.');
    st.add('Ballast placement', wet ? 'W_body + W_b + P = γ_L V_D + γ_L V_b' : 'W_body + W_b + P = γ_L V_D', placeTxt,
      wet ? 'ballast displaces its own volume → extra buoyancy BF_b = γ_L V_b' : 'ballast adds weight only (no extra displacement)', 'Vertical equilibrium ΣF_v = 0 for body + ballast.');

    let D, Wb, state = 'floats';
    if (b.solve === 'findW') {
      D = b.targetBy === 'proj' ? H - b.target : b.target;
      if (D < 0 || D > H) {
        err.push(`Target ${b.targetBy === 'proj' ? 'projection' : 'draft'} is outside the body (draft must be between 0 and H = ${f(H)} ${L}).`);
        return { ok: false, err, warn, steps: st.list, out, geo: {} };
      }
      if (b.targetBy === 'proj') st.add('Draft from the projection above the surface', 'D = H − projection', `D = ${f(H)} − ${f(b.target)}`, `D = ${f(D)} ${L}`, 'The part below the waterline.');
      const VD = Bd.V(D, d);
      st.add('Displaced volume of the body at the target draft', Bd.Vf, `D = ${f(D)}`, `V_D = ${f(VD)} ${U.vol}`, 'Volume of the body below the waterline.');
      const net = gL * VD - Wbody - P;
      st.add('Buoyancy surplus of the body', 'γ_L V_D − W_body − P', `= ${f(gL)} × ${f(VD)} − ${f(Wbody)}${P ? ' − ' + f(P) : ''}`, `= ${f(net)} ${Fu}`, 'This surplus must be taken up by the ballast.');
      if (wet) {
        if (gb <= gL) {
          err.push('Ballast is not heavier than the liquid (γ_b ≤ γ_L): attached outside it adds no net weight, so no amount can produce this draft.');
          return { ok: false, err, warn, steps: st.list, out, geo: {} };
        }
        Wb = net / (1 - k);
        st.add('Ballast weight (outside / submerged)', 'W_b = (γ_L V_D − W_body) / (1 − γ_L/γ_b)', `W_b = ${f(net)} / (1 − ${f(gL)}/${f(gb)})`, `W_b = ${f(Wb)} ${Fu}`,
          'Each unit of ballast weight is partly cancelled by its own buoyancy, so more is needed.');
        const Win = net;
        st.add('Why outside ≠ inside', 'inside: W_b = γ_L V_D − W_body', `inside would need ${f(Win)} ${Fu}; outside needs ${f(Wb)} ${Fu}`,
          `difference = ${f(Wb - Win)} ${Fu} = buoyancy of the ballast γ_L V_b`, 'Ballast outside the body displaces its own volume of liquid, giving extra buoyancy — so you need more of it.');
      } else {
        Wb = net;
        st.add('Ballast weight (inside / above)', 'W_b = γ_L V_D − W_body', `W_b = ${f(gL)} × ${f(VD)} − ${f(Wbody)}${P ? ' − ' + f(P) : ''}`, `W_b = ${f(Wb)} ${Fu}`, 'Ballast inside adds weight only.');
        if (gb > gL) {
          const Wout = net / (1 - gL / gb);
          st.add('Why outside ≠ inside', 'outside: W_b = (γ_L V_D − W_body)/(1 − γ_L/γ_b)', `outside would need ${f(Wout)} ${Fu}; inside needs ${f(Wb)} ${Fu}`,
            `difference = ${f(Wout - Wb)} ${Fu}`, 'Ballast outside the body displaces its own volume of liquid, giving extra buoyancy — so you need more of it.');
        }
      }
      if (Wb < 0) {
        err.push(`Target draft is impossible: it needs NEGATIVE ballast (${f(Wb)} ${Fu}). The body alone already sinks deeper than this draft — it would need an upward force instead.`);
        return { ok: false, err, warn, steps: st.list, out, geo: {} };
      }
    } else {
      Wb = b.givenBy === 'm' ? (U.id === 'SI' ? (b.mb * g) / 1000 : b.mb * g) : b.Wb;
      if (b.givenBy === 'm') st.add('Ballast weight from its mass', U.id === 'SI' ? 'W_b = m_b g / 1000' : 'W_b = m_b g', `W_b = ${f(b.mb)} × ${f(g)}${U.id === 'SI' ? ' / 1000' : ''}`, `W_b = ${f(Wb)} ${Fu}`, 'Convert mass to weight.');
      if (wet && gb <= gL) warn.push('Ballast is lighter than the liquid: attached outside, it actually lifts the body.');
      const need = Wbody + Wb + P - k * Wb;
      st.add('Buoyancy the body must provide', wet ? 'γ_L V_D = W_body + W_b + P − γ_L V_b' : 'γ_L V_D = W_body + W_b + P', wet ? `= ${f(Wbody)} + ${f(Wb)}${P ? ' + ' + f(P) : ''} − ${f(k * Wb)}` : `= ${f(Wbody)} + ${f(Wb)}${P ? ' + ' + f(P) : ''}`,
        `γ_L V_D = ${f(need)} ${Fu}`, 'Equilibrium of body + ballast.');
      const BFmax = gL * Vt;
      if (need <= 0) {
        err.push('Net load is upward — the body would be lifted out of the liquid.');
        return { ok: false, err, warn, steps: st.list, out, geo: {} };
      }
      if (need > BFmax * (1 + 1e-9)) {
        D = H; state = hollow ? 'swamps' : 'sinks';
      } else {
        D = bisect((z) => gL * Bd.V(z, d), need, 0, H, 300);
        st.add('Draft', `${Bd.Vf} = ${f(need / gL)}`, Bd.inv ? Bd.invf : 'solved numerically', `D = ${f(D)} ${L}`, 'Solve the displaced-volume relation for the draft.');
      }
      if (gb > gL) {
        const other = wet ? Wbody + Wb + P : Wbody + Wb + P - (gL / gb) * Wb;
        st.add('Why the placement matters', wet ? 'inside: γ_L V_D = W_body + W_b' : 'outside: γ_L V_D = W_body + W_b − γ_L V_b', `the body would need ${f(other)} ${Fu} of buoyancy instead of ${f(need)}`,
          `ballast buoyancy γ_L V_b = ${f((gL / gb) * Wb)} ${Fu}`, 'Ballast outside the body displaces its own volume of liquid, giving extra buoyancy — so the same ballast sinks the body less.');
      }
    }
    const Vb = Wb / gb, BFb = k * Wb, T = Wb - gL * Vb;
    st.add('Ballast volume and mass', 'V_b = W_b / γ_b;  m_b = W_b / g', `V_b = ${f(Wb)} / ${f(gb)};  m_b = ${f(Wb)}${U.id === 'SI' ? ' × 1000' : ''} / ${f(g)}`,
      `V_b = ${f(Vb)} ${U.vol},  m_b = ${f(massOf(Wb))} ${massU}`, 'Size and mass of the ballast.');
    if (b.place === 'hang') st.add('Cord tension', 'T = W_b − γ_L V_b', `T = ${f(Wb)} − ${f(gL)} × ${f(Vb)}`, `T = ${f(T)} ${Fu}`, 'Submerged weight of the ballast, carried by the cord into the body.');
    const VD = Bd.V(Math.min(D, H), d), BFbody = gL * VD;
    if (state === 'floats') {
      st.add('Freeboard (projection above the surface)', 'H − D', `= ${f(H)} − ${f(D)}`, `${f(H - D)} ${L}`, 'Height above the liquid.');
      if (hollow && D >= H - 1e-9) state = 'swamps';
    }
    if (state === 'swamps') warn.push('The open container SWAMPS: the draft reaches the wall height, so liquid pours in over the rim.');
    if (state === 'sinks') warn.push(`Body + ballast SINK: required buoyancy exceeds γ_L V = ${f(gL * Vt)} ${Fu}.`);
    if (hollow && state === 'floats') st.add('Swamping check (open container)', 'D < H ?', `${f(D)} < ${f(H)}`, '✔ does not swamp', 'Draft must stay below the wall height.');

    out.push({ k: 'γ_L', v: gL, u: U.gamma });
    out.push({ k: 'γ_b (ballast)', v: gb, u: U.gamma });
    out.push({ k: 'W_body', v: Wbody, u: Fu });
    out.push({ k: 'Ballast weight W_b', v: Wb, u: Fu, hl: true });
    out.push({ k: 'Ballast mass m_b', v: massOf(Wb), u: massU, hl: true });
    out.push({ k: 'Ballast volume V_b', v: Vb, u: U.vol, hl: true });
    if (wet) out.push({ k: 'Ballast buoyancy BF_b', v: BFb, u: Fu });
    if (b.place === 'hang') out.push({ k: 'Cord tension T', v: T, u: Fu, hl: true });
    out.push({ k: 'Body buoyancy BF', v: BFbody, u: Fu });
    out.push({ k: 'Draft D', v: D, u: L, hl: true });
    out.push({ k: 'Projection above surface', v: H - D, u: L });

    const Mz = (a, c) => simpson((z) => z * Bd.A(z, d), a, c, 400);
    const zB = VD > 0 ? Mz(0, Math.min(D, H)) / VD : 0;
    const zG = Mz(0, H) / Vt;
    const status = state === 'floats' ? { cls: 'ok', text: `W_b = ${f(Wb)} ${Fu} (${f(massOf(Wb))} ${massU}), draft ${f(D)} ${L}` }
      : { cls: 'bad', text: state === 'swamps' ? 'Container SWAMPS' : 'SINKS with this ballast' };
    return {
      ok: true, err, warn, steps: st.list, out, status,
      geo: { H, D, Dmax: H, t2: 0, Vt, VD, W: Wbody, Wreq: Wbody + Wb + P, BF: BFbody, net: 0, zB, zG, state, stab: null, lift: 0,
        ballast: { Wb, Vb, BFb, T, place: b.place, hollow } },
    };
  }

  /* =================================================================== */
  /* MODULE 3A — RECTILINEAR ACCELERATION                               */
  /* =================================================================== */
  /*
   * Coordinates: work in the TANK frame (x' along the floor from the back wall,
   * y' normal to the floor). Effective gravity g_eff = g_vec − a. Rotating it into
   * the tank frame gives (g_x', −G_n). The free surface is y' = c + s·x' with
   * s = g_x'/G_n and the pressure is p = γ (G_n/g)(c + s x' − y') (+ p₀ for closed tanks).
   * For a horizontal tank this reduces to tan θ = a_h/(g + a_v), γ_eff = γ(1 + a_v/g).
   * p = { sg, L, B, H, d, a, dir:'h'|'up'|'down'|'incline', alpha, slope:'up'|'down',
   *       decel, closed, p0 }
   */
  function rectilinear(p, U) {
    const st = Steps(), warn = [], err = [], out = [];
    const f = fmt, Lu = U.len, g = U.g;
    const gam = p.sg * U.gw;
    const { L, B, H, d, a } = p;
    if (!(L > 0 && B > 0 && H > 0)) err.push('Tank dimensions must be positive.');
    if (d < 0 || d > H + 1e-12) err.push('Initial depth d must be between 0 and H.');
    let beta = 0, mv = [1, 0];
    if (p.dir === 'up') mv = [0, 1];
    else if (p.dir === 'down') mv = [0, -1];
    else if (p.dir === 'incline') { beta = (p.slope === 'up' ? 1 : -1) * p.alpha * DEG; mv = [Math.cos(beta), Math.sin(beta)]; }
    const sgn = p.decel ? -1 : 1;
    const ah = sgn * a * mv[0], av = sgn * a * mv[1];
    const Gw = g + av;
    const p0 = p.closed ? p.p0 : 0;

    const dirTxt = { h: 'horizontal', up: 'vertical (upward motion)', down: 'vertical (downward motion)', incline: `along a ${f(p.alpha)}° incline, moving ${p.slope} the slope` }[p.dir];
    st.add('Acceleration components', 'a_h = a cos α,  a_v = a sin α  (+ up)',
      `motion ${dirTxt}, ${p.decel ? 'decelerating (a opposite to motion)' : 'accelerating'}: a_h = ${f(ah)}, a_v = ${f(av)}`,
      `a_h = ${f(ah)} ${U.acc},  a_v = ${f(av)} ${U.acc}`, 'Resolve the acceleration into horizontal and vertical parts.');
    if (err.length) return { ok: false, err, warn, steps: st.list, out, geo: {} };
    if (Gw <= 1e-9) {
      if (Math.abs(Gw) <= 1e-9 && Math.abs(ah) < 1e-9) {
        st.add('Free fall', 'p = γh(1 − a_v/g)', `p = γh(1 − ${f(g)}/${f(g)})`, 'p = 0 everywhere', 'The liquid is weightless relative to the tank.');
        err.push('FREE FALL (a_v = −g): pressure is zero everywhere in the liquid — p = γh(1 − a/g) = 0. There is no defined free-surface slope.');
      } else err.push('Downward acceleration exceeds g: the liquid would leave the tank floor (g + a_v < 0). Results are not physical.');
      return { ok: false, err, warn, steps: st.list, out, geo: {} };
    }
    const cb = Math.cos(beta), sb = Math.sin(beta);
    const gx = -ah * cb - Gw * sb;
    const Gn = Gw * cb - ah * sb;
    if (Gn <= 1e-9) {
      err.push('Effective gravity no longer presses the liquid toward the tank floor — the liquid would slide out of the tank.');
      return { ok: false, err, warn, steps: st.list, out, geo: {} };
    }
    const s = gx / Gn;
    const tanT = ah / Gw, thDeg = Math.atan(tanT) / DEG;
    if (Math.abs(ah) < 1e-12) {
      st.add('Free surface for purely vertical acceleration', 'tan θ = 0;  p = γh(1 ± a_v/g)', `p = γh(1 + ${f(av)}/${f(g)})`,
        `free surface stays level; p = ${f(1 + av / g)}·γh`, 'Vertical acceleration only changes the apparent weight of the liquid.');
    } else {
      st.add('Slope of the free surface', 'tan θ = a_h / (g ± a_v)', `tan θ = ${f(ah)} / (${f(g)} ${av >= 0 ? '+' : '−'} ${f(Math.abs(av))})`,
        `tan θ = ${f(tanT)}`, 'The free surface is perpendicular to the effective gravity g − a.');
      st.add('Angle of the free surface', 'θ = tan⁻¹(tan θ)', `θ = tan⁻¹(${f(tanT)})`, `θ = ${f(thDeg)}°`,
        `Surface rises toward the ${ah > 0 ? 'back (rear) wall' : 'front wall'}.`);
    }
    if (beta !== 0) {
      st.add('Surface slope relative to the tank floor', 'tan θ\' = [a_h cos β + (g + a_v) sin β] / [(g + a_v) cos β − a_h sin β]',
        `β = ${f(beta / DEG)}°  →  tan θ' = ${f(-gx)} / ${f(Gn)}`, `tan θ' = ${f(-s)},  θ' = ${f(Math.atan(-s) / DEG)}°`,
        'The tank floor is inclined, so compare the surface with the floor (rise measured along the walls).');
    }

    const A0 = d * L;
    const capC = p.closed ? H : Infinity;
    let c, spill = false, full = false;
    if (p.closed && d >= H - 1e-12) { full = true; c = H - Math.min(0, s * L); }
    else c = solveIntercept(A0, s, L, capC);
    if (!p.closed) {
      const fmax = Math.max(c, c + s * L);
      if (fmax > H + 1e-12) { spill = true; c = s < 0 ? H : H - s * L; }
    }
    const Arem = areaClamp(c, s, L, capC);
    const Vrem = Arem * B, V0 = A0 * B, Vsp = spill ? V0 - Vrem : 0;
    const fb = c, ff = c + s * L; // surface ordinate at back and front walls (unclipped)
    const hb = clamp(fb, 0, H), hf = clamp(ff, 0, H);
    const dy = (L / 2) * Math.abs(s);
    if (Math.abs(s) > 1e-12) {
      st.add('Rise / fall of the surface at the walls (if nothing spills or dries)', 'Δy = (L/2) tan θ' + (beta ? '\'' : ''),
        `Δy = (${f(L)}/2) × ${f(Math.abs(s))}`, `Δy = ${f(dy)} ${Lu} → ${f(d + dy)} at the high wall, ${f(d - dy)} at the low wall`,
        'The surface pivots about the mid-length point, keeping the liquid volume constant.');
    }
    let exposed = false, dry = 0, lidWet = 0;
    if (Math.min(fb, ff) < -1e-12 && Math.abs(s) > 0) {
      exposed = true;
      const x0 = -c / s;
      dry = s < 0 ? L - x0 : x0;
    }
    if (p.closed && Math.max(fb, ff) > H + 1e-12 && Math.abs(s) > 0) {
      const x1 = (H - c) / s;
      lidWet = s < 0 ? clamp(x1, 0, L) : L - clamp(x1, 0, L);
    }
    if (spill) {
      st.add('Spilling check', 'd + Δy > H  →  liquid spills', `${f(d)} + ${f(dy)} = ${f(d + dy)} > ${f(H)}`,
        'Surface passes through the top of the high wall', 'The new free surface goes through the rim; the excess pours out.');
      if (exposed) st.add('Bottom exposed', 'surface meets the floor before the low wall', `dry length = ${f(dry)} ${Lu}`, 'Liquid section is a triangle', 'Part of the tank floor is dry.');
      st.add('Volume remaining and spilled', 'V_rem = (section area) × B;  V_spill = V₀ − V_rem',
        `V₀ = ${f(d)}×${f(L)}×${f(B)} = ${f(V0)};  V_rem = ${f(Arem)} × ${f(B)}`,
        `V_rem = ${f(Vrem)} ${U.vol},  V_spill = ${f(Vsp)} ${U.vol} = ${f(Vsp * U.volSmallFactor)} ${U.volSmall}`, 'Liquid lost over the rim.');
      warn.push(`Tank SPILLS: ${f(Vsp)} ${U.vol} (${f(Vsp * U.volSmallFactor)} ${U.volSmall}) is lost over the rim.`);
    } else if (exposed) {
      st.add('Bottom exposed', 'surface meets the floor before the low wall → triangular liquid section', `area conserved: ½ × (wet length) × (depth at high wall) = ${f(A0)}`,
        `dry length = ${f(dry)} ${Lu}, depth at high wall = ${f(Math.max(hb, hf))} ${Lu}`, 'Volume is conserved with the liquid section now a triangle.');
    }
    if (exposed) warn.push(`Tank floor is EXPOSED over a length of ${f(dry)} ${Lu}.`);
    if (p.closed) {
      if (full) {
        st.add('Closed tank completely full', 'imaginary free surface (pressure-head line)', 'assumed to pass through the top corner on the low-pressure side (p = p₀ there)',
          'Pressures referenced to that corner', 'With no air space the free surface is imaginary; it sets the pressure distribution.');
        warn.push('Closed full tank: the free surface is IMAGINARY (pressure-head line), assumed to pass through the top low-pressure corner.');
      } else if (lidWet > 0) {
        st.add('Liquid touches the lid', 'air volume conserved; surface line passes above the lid', `liquid contacts the lid over ${f(lidWet)} ${Lu}`,
          'Above the lid the surface is imaginary', 'Pressure on the lid is found from the imaginary surface.');
      }
    }
    st.add('Depths at the walls (measured along the walls)', 'h_back, h_front', '', `h_back = ${f(hb)} ${Lu},  h_front = ${f(hf)} ${Lu}`, 'Liquid heights at the rear and front walls.');

    const gEff = gam * (Gn / g);
    st.add('Effective unit weight', beta ? 'γ_eff = γ·g_n/g,  g_n = (g + a_v)cos β − a_h sin β' : 'γ_eff = γ(1 ± a_v/g)',
      beta ? `γ_eff = ${f(gam)} × ${f(Gn)}/${f(g)}` : `γ_eff = ${f(gam)} × (1 + ${f(av)}/${f(g)})`, `γ_eff = ${f(gEff)} ${U.gamma}`,
      'Vertical acceleration increases (up) or decreases (down) the pressure gradient.');

    const pAt = (x, y) => {
      if (x < -1e-9 || x > L + 1e-9 || y < -1e-9 || y > H + 1e-9) return null;
      const fx = c + s * x;
      if (y > fx + 1e-12) return p0; // air
      return gEff * (fx - y) + p0;
    };
    const corners = { backBottom: pAt(0, 0), frontBottom: pAt(L, 0), backTop: pAt(0, H), frontTop: pAt(L, H) };
    st.add('Pressures at the four corners', 'p = γ_eff × (depth below the free-surface line)' + (p.closed ? ' + p₀' : ''),
      `back-bottom: ${f(gEff)}×${f(Math.max(fb, 0))}${p.closed ? ' + ' + f(p0) : ''}`,
      `back-bottom ${f(corners.backBottom)}, front-bottom ${f(corners.frontBottom)}, back-top ${f(corners.backTop)}, front-top ${f(corners.frontTop)} ${U.press}`,
      'Points above the liquid are at the air pressure.');

    const wallF = (fx) => { const hw = clamp(fx, 0, H); return B * (gEff * (fx * hw - (hw * hw) / 2) + p0 * H); };
    const Fb = wallF(fb), Ff = wallF(ff);
    st.add('Force on the back (rear) wall', 'F = γ_eff h̄ A' + (p.closed ? ' (+ p₀ × wall area)' : ''),
      !p.closed && fb <= H ? `F = ${f(gEff)} × (${f(hb)}/2) × (${f(hb)}×${f(B)})` : `F = B∫p dy`, `F_back = ${f(Fb)} ${U.force}`, 'Resultant of the pressure on the rear wall.');
    st.add('Force on the front wall', 'F = γ_eff h̄ A' + (p.closed ? ' (+ p₀ × wall area)' : ''),
      !p.closed && ff <= H ? `F = ${f(gEff)} × (${f(hf)}/2) × (${f(hf)}×${f(B)})` : `F = B∫p dy`, `F_front = ${f(Ff)} ${U.force}`, 'Resultant of the pressure on the front wall.');
    const m = (gam * Vrem) / g;
    const rhs = m * (ah * cb + av * sb + g * sb);
    st.add('Check: Newton’s 2nd law along the tank', beta ? 'F_back − F_front = (W/g)(a_t + g sin β)' : 'F_back − F_front = (W/g) a_h',
      `${f(Fb)} − ${f(Ff)} = ${f(Fb - Ff)};  (${f(gam * Vrem)}/${f(g)}) × ${f(beta ? ah * cb + av * sb + g * sb : ah)} = ${f(rhs)}`,
      Math.abs(Fb - Ff - rhs) <= 1e-6 * Math.max(1, Math.abs(rhs), Fb) ? '✔ balanced' : '✘ mismatch', 'The unbalanced wall force is what accelerates the liquid.');
    const Fbot = B * (gEff * areaClamp(c, s, L, Infinity) + p0 * L);
    st.add('Force on the bottom', 'F_bottom = ∫ p dA', `F = ${f(B)} × [${f(gEff)} × ${f(areaClamp(c, s, L, Infinity))}${p.closed ? ' + ' + f(p0) + '×' + f(L) : ''}]`,
      `F_bottom = ${f(Fbot)} ${U.force}`, p.closed ? 'Includes the air pressure.' : 'Equals W(1 + a_v/g) for a horizontal tank.');

    out.push({ k: 'a_h', v: ah, u: U.acc });
    out.push({ k: 'a_v', v: av, u: U.acc });
    out.push({ k: 'tan θ', v: tanT, u: '', hl: true });
    out.push({ k: 'θ (from horizontal)', v: thDeg, u: '°', hl: true });
    if (beta) out.push({ k: 'θ\' (relative to floor)', v: Math.atan(-s) / DEG, u: '°' });
    out.push({ k: 'Δy = (L/2)tan θ', v: dy, u: Lu });
    out.push({ k: 'Depth at back wall', v: hb, u: Lu, hl: true });
    out.push({ k: 'Depth at front wall', v: hf, u: Lu, hl: true });
    if (spill) { out.push({ k: 'Volume spilled', v: Vsp, u: U.vol, hl: true }); out.push({ k: 'Volume spilled', v: Vsp * U.volSmallFactor, u: U.volSmall }); }
    out.push({ k: 'Volume remaining', v: Vrem, u: U.vol });
    if (exposed) out.push({ k: 'Dry floor length', v: dry, u: Lu, hl: true });
    out.push({ k: 'γ_eff', v: gEff, u: U.gamma });
    out.push({ k: 'F back wall', v: Fb, u: U.force });
    out.push({ k: 'F front wall', v: Ff, u: U.force });
    out.push({ k: 'F bottom', v: Fbot, u: U.force });

    // rest state (same tank tilt, a = 0) for the dashed "original" surface
    const s0 = -Math.tan(beta);
    const c0 = p.closed && d >= H - 1e-12 ? H - Math.min(0, s0 * L) : solveIntercept(A0, s0, L, capC);

    let status = { cls: 'ok', text: `θ = ${f(thDeg)}°, no spill` };
    if (spill) status = { cls: 'bad', text: `Spills ${f(Vsp)} ${U.vol}` };
    else if (exposed) status = { cls: 'warn', text: `Floor exposed over ${f(dry)} ${Lu}` };
    return {
      ok: true, err, warn, steps: st.list, out, status,
      geo: { L, B, H, d, c, s, c0, s0, beta, ah, av, thDeg, gEff, p0, closed: p.closed, spill, exposed, full, Vsp, Vrem, hb, hf, corners, mv, sgn },
      pAt,
    };
  }

  /* =================================================================== */
  /* MODULE 3B — ROTATING VESSELS                                        */
  /* =================================================================== */
  /*
   * Paraboloid: z = z_v + k r², k = ω²/(2g); height at the wall h = ω²R²/(2g).
   * Cylinder volume below the surface: V = π ∫₀^{R²} clamp(z_v + k u, 0, cap) du, u = r².
   * Cone (apex down) volume solved numerically.
   * p = { sg, shape:'open'|'closed'|'cone', R, H, d, omega, p0, targetSpill }
   */
  function coneVol(zv, k, R, H, cap) {
    const n = 1500, h = R / n;
    let V = 0;
    for (let i = 0; i < n; i++) {
      const r = (i + 0.5) * h;
      const top = Math.min(zv + k * r * r, cap), bot = (H * r) / R;
      if (top > bot) V += 2 * PI * r * (top - bot) * h;
    }
    return V;
  }

  /** Core solver: vertex height z_v, spill, etc. for a given ω (no text). */
  function rotState(shape, R, H, d, omega, g) {
    const k = (omega * omega) / (2 * g), h = k * R * R;
    let zv, spill = false, V0, Vrem;
    if (shape === 'cone') {
      V0 = (PI * R * R * d ** 3) / (3 * H * H);
      if (k === 0) zv = d;
      else {
        const lo = -Math.max(0, k * R * R - H) - 1;
        zv = bisect((z) => coneVol(z, k, R, H, Infinity), V0, lo, H + 1, 70);
      }
      if (zv + h > H + 1e-12) { spill = true; zv = H - h; }
      Vrem = k === 0 ? V0 : coneVol(zv, k, R, H, H);
      if (!spill) Vrem = V0;
    } else {
      V0 = PI * R * R * d;
      if (shape === 'open') {
        zv = d >= h / 2 ? d - h / 2 : Math.sqrt(2 * h * d) - h;
        if (zv + h > H + 1e-12) { spill = true; zv = H - h; }
        Vrem = PI * areaClamp(zv, k, R * R, Infinity);
      } else {
        if (d >= H - 1e-12) zv = H;
        else if (k === 0) zv = d;
        else zv = bisect((z) => PI * areaClamp(z, k, R * R, H), V0, -h - 1, H + 1, 300);
        Vrem = V0;
      }
    }
    return { k, h, zv, spill, V0, Vrem, Vsp: spill ? V0 - Vrem : 0 };
  }

  function critOmega(pred, wmax) {
    wmax = wmax || 2000;
    if (pred(0)) return 0;
    if (!pred(wmax)) return null;
    let lo = 0, hi = wmax;
    for (let i = 0; i < 45; i++) { const m = 0.5 * (lo + hi); if (pred(m)) hi = m; else lo = m; }
    return hi;
  }

  function rotating(p, U) {
    const st = Steps(), warn = [], err = [], out = [];
    const f = fmt, Lu = U.len, g = U.g;
    const gam = p.sg * U.gw;
    const { R, H, d, shape } = p;
    const w = p.omega;
    if (!(R > 0 && H > 0)) err.push('Radius and height must be positive.');
    if (d < 0 || d > H + 1e-12) err.push('Initial depth d must be between 0 and H.');
    if (w < 0) err.push('ω must be ≥ 0.');
    if (err.length) return { ok: false, err, warn, steps: [], out, geo: {} };
    const p0 = shape === 'closed' ? p.p0 : 0;
    const S0 = rotState(shape, R, H, d, w, g);
    const { k, h, zv, spill, V0, Vrem, Vsp } = S0;
    const N = (w * 60) / (2 * PI);
    st.add('Angular speed', 'ω = 2πN/60', `N = ${f(N)} rpm`, `ω = ${f(w)} rad/s`, 'rad/s and rpm are linked.');
    st.add('Height of the paraboloid at the wall', 'h = ω²R²/(2g)', `h = ${f(w)}² × ${f(R)}² / (2 × ${f(g)})`, `h = ${f(h)} ${Lu}`,
      'Vertical distance from the vertex to where the paraboloid meets the wall radius.');
    st.add('Equation of the free surface', 'y = ω²x²/(2g)  (from the vertex)', `y = ${f(k)} x²`, `vertex at ${f(zv)} ${Lu} above the bottom`, 'Paraboloid of revolution.');
    st.add('Volume of the paraboloid', 'V_par = ½ πR²h  (half the circumscribing cylinder)', `V_par = ½ × π × ${f(R)}² × ${f(h)}`, `V_par = ${f(0.5 * PI * R * R * h)} ${U.vol}`,
      'Key property used for volume bookkeeping.');

    let kase = 0, r0 = 0, rLid = null;
    const rim = zv + h;
    if (shape === 'open') {
      if (!spill && zv >= -1e-12) {
        kase = 1;
        st.add('CASE 1 — no spill, vertex above the bottom', 'rim = d + h/2 ≤ H,  vertex = d − h/2 ≥ 0',
          `rim = ${f(d)} + ${f(h / 2)} = ${f(d + h / 2)};  vertex = ${f(d)} − ${f(h / 2)} = ${f(d - h / 2)}`,
          `rise at wall = fall at centre = h/2 = ${f(h / 2)} ${Lu}`, 'The surface rises h/2 at the wall and drops h/2 at the axis.');
      } else if (spill && zv >= -1e-12) {
        kase = 2;
        st.add('CASE 2 — spilling, vertex above the bottom', 'd + h/2 > H → rim at H, vertex = H − h',
          `${f(d)} + ${f(h / 2)} = ${f(d + h / 2)} > ${f(H)};  vertex = ${f(H)} − ${f(h)}`, `vertex at ${f(zv)} ${Lu}`, 'The paraboloid passes through the rim.');
        st.add('Volume remaining and spilled', 'V_rem = πR²H − ½πR²h;  V_spill = V₀ − V_rem',
          `V_rem = π×${f(R)}²×${f(H)} − ½π×${f(R)}²×${f(h)};  V₀ = π×${f(R)}²×${f(d)} = ${f(V0)}`,
          `V_rem = ${f(Vrem)} ${U.vol},  V_spill = ${f(Vsp)} ${U.vol} = ${f(Vsp * U.volSmallFactor)} ${U.volSmall}`, 'Volume bookkeeping with the paraboloid.');
      } else {
        kase = 3;
        const y0 = -zv; r0 = Math.sqrt(y0 / k);
        if (!spill) {
          st.add('Vertex below the bottom WITHOUT spilling', 'πR²d = πR²[z_rim²/(2h)] → z_rim = √(2hd)', `z_rim = √(2 × ${f(h)} × ${f(d)})`,
            `z_rim = ${f(rim)} ${Lu} ≤ H`, 'Volume conservation with the bottom partly dry.');
        } else {
          st.add('CASE 3 — vertex below the bottom (bottom partly exposed)', 'rim at H, y₀ = h − H',
            `y₀ = ${f(h)} − ${f(H)}`, `y₀ = ${f(y0)} ${Lu}`, 'The imaginary vertex lies below the tank floor.');
        }
        st.add('Radius of the dry circle on the bottom', 'r₀ = √(2g y₀)/ω', `r₀ = √(2 × ${f(g)} × ${f(y0)}) / ${f(w)}`, `r₀ = ${f(r0)} ${Lu}`, 'Where the paraboloid cuts the floor.');
        st.add('Volume remaining', 'V_rem = πR²(rim) − [½πR²h − ½πr₀²y₀]',
          `= π×${f(R)}²×${f(Math.min(rim, H))} − [½π×${f(R)}²×${f(h)} − ½π×${f(r0)}²×${f(y0)}]`, `V_rem = ${f(Vrem)} ${U.vol}`, 'Subtract the air paraboloid, add back the part below the floor.');
        if (spill) st.add('Volume spilled', 'V_spill = V₀ − V_rem', `= ${f(V0)} − ${f(Vrem)}`, `V_spill = ${f(Vsp)} ${U.vol} = ${f(Vsp * U.volSmallFactor)} ${U.volSmall}`, 'Lost over the rim.');
      }
    } else if (shape === 'closed') {
      kase = 4;
      st.add('CASE 4 — closed cylinder', 'air volume is conserved: π∫clamp(z_v + k r², 0, H) d(r²) = πR²d',
        d >= H - 1e-12 ? 'completely full: imaginary paraboloid with vertex at the lid on the axis' : `solve for z_v`,
        `z_v = ${f(zv)} ${Lu}`, 'No liquid leaves a closed vessel.');
      if (rim > H + 1e-12 && zv < H) {
        rLid = Math.sqrt((H - zv) / k);
        st.add('Liquid meets the lid', 'z_v + k r² = H → r = √((H − z_v)/k)', `r = √((${f(H)} − ${f(zv)})/${f(k)})`, `r_lid = ${f(rLid)} ${Lu}`,
          'Beyond this radius the liquid presses on the lid.');
      }
      if (zv < -1e-12) {
        r0 = Math.sqrt(-zv / k);
        st.add('Bottom partly exposed', 'r₀ = √(−z_v / k)', `r₀ = √(${f(-zv)}/${f(k)})`, `r₀ = ${f(r0)} ${Lu}`, 'Dry circle on the floor.');
      }
      if (p0) st.add('Air pressure', 'air volume unchanged → air pressure unchanged', '', `p_air = ${f(p0)} ${U.press}`, 'Isothermal air with constant volume.');
    } else {
      st.add('Open cone (apex down)', 'V₀ = πR²d³/(3H²); conserve volume with z = z_v + k r² inside the cone', `V₀ = π×${f(R)}²×${f(d)}³/(3×${f(H)}²)`,
        `V₀ = ${f(V0)} ${U.vol}, z_v = ${f(zv)} ${Lu}`, 'Solved numerically (the cone wall makes the volume integral non-standard).');
      if (spill) st.add('Spill', 'paraboloid through the rim: z_v = H − h', `V_rem = ${f(Vrem)}`, `V_spill = ${f(Vsp)} ${U.vol} = ${f(Vsp * U.volSmallFactor)} ${U.volSmall}`, 'Liquid lost.');
      if (zv < 0) { warn.push('Apex region is dry (vertex below the apex).'); }
    }
    if (spill) warn.push(`Vessel SPILLS ${f(Vsp)} ${U.vol} (${f(Vsp * U.volSmallFactor)} ${U.volSmall}).`);
    if (zv < -1e-12 && shape !== 'cone') warn.push(`Vertex is BELOW the bottom — dry circle of radius ${f(r0)} ${Lu} at the centre.`);

    // pressures
    const pAt = (r, z) => {
      r = Math.abs(r);
      if (r > R + 1e-9 || z < -1e-9 || z > H + 1e-9) return null;
      if (shape === 'cone' && z < (H * r) / R - 1e-9) return null;
      const fs = zv + k * r * r;
      if (z > fs + 1e-12) return p0;
      return gam * (fs - z) + p0;
    };
    const pBC = shape === 'cone' ? (zv > 0 ? gam * zv : 0) : zv > 0 ? gam * zv + p0 : p0;
    const pBE = shape === 'cone' ? null : gam * Math.max(rim, 0) + p0;
    st.add('Pressure at any point', 'p = γ × (vertical distance below the paraboloid)' + (p0 ? ' + p_air' : ''), `p = ${f(gam)} [${f(zv)} + ${f(k)} r² − z]${p0 ? ' + ' + f(p0) : ''}`,
      shape === 'cone' ? `apex: p = ${f(pBC)} ${U.press}` : `bottom centre ${f(pBC)}, bottom edge ${f(pBE)} ${U.press}`, 'Click the diagram to probe any point.');
    let Fbot = null, Fside = null, Fhalf = null, Flid = null, pLidEdge = null;
    if (shape !== 'cone') {
      Fbot = PI * gam * areaClamp(zv, k, R * R, Infinity) + p0 * PI * R * R;
      st.add('Total pressure on the bottom', 'F = ∫p dA = γπ∫₀^{R²} max(z_v + k u, 0) du' + (p0 ? ' + p₀πR²' : ''), '', `F_bottom = ${f(Fbot)} ${U.force}`,
        shape === 'open' ? 'Equals the weight of the liquid remaining.' : 'Includes the lid reaction and air pressure.');
      const hw = clamp(rim, 0, H);
      const intp = gam * (rim * hw - (hw * hw) / 2) + p0 * H;
      Fside = 2 * PI * R * intp; Fhalf = 2 * R * intp;
      st.add('Pressure force on the side wall', 'per unit circumference ∫p dz;  half-cylinder: F = 2R∫p dz', `∫p dz = ${f(intp)} ${U.fpl}`,
        `F(half wall, projected) = ${f(Fhalf)} ${U.force};  Σ|p dA| = ${f(Fside)} ${U.force}`, 'The radial forces cancel overall; the half-wall value is the bursting force.');
      if (shape === 'closed') {
        Flid = PI * gam * areaClamp(zv - H, k, R * R, Infinity) + p0 * PI * R * R;
        pLidEdge = rim > H ? gam * (rim - H) + p0 : p0;
        st.add('Pressure at the lid edge and lid force', 'p = γ(z_v + kR² − H) + p₀ if wetted', `p_lid,edge = ${f(pLidEdge)} ${U.press}`, `F_lid = ${f(Flid)} ${U.force}`,
          'Upward force on the lid.');
      }
    } else {
      st.add('Weight of liquid remaining', 'W = γ V_rem', `W = ${f(gam)} × ${f(Vrem)}`, `W = ${f(gam * Vrem)} ${U.force}`, 'Carried by the cone walls.');
    }

    // critical speeds
    const pre = (pred) => critOmega((om) => pred(rotState(shape, R, H, d, om, g)));
    let wSpill = null, wExpose = null, wTarget = null;
    if (shape === 'open') {
      wSpill = d >= H ? 0 : Math.sqrt(4 * g * (H - d)) / R;
      const hE = d <= H / 2 ? 2 * d : H;
      wExpose = Math.sqrt(2 * g * hE) / R;
      st.add('Speed to spill the first drop', 'd + h/2 = H → ω = √(4g(H − d))/R', `ω = √(4 × ${f(g)} × (${f(H)} − ${f(d)}))/${f(R)}`, `ω = ${f(wSpill)} rad/s = ${f((wSpill * 60) / (2 * PI))} rpm`, 'Rim level reaches the top.');
      st.add('Speed to just expose the bottom centre', d <= H / 2 ? 'h/2 = d → ω = √(2g·2d)/R' : 'h = H (spilled) → ω = √(2gH)/R',
        `ω = √(2 × ${f(g)} × ${f(hE)})/${f(R)}`, `ω = ${f(wExpose)} rad/s = ${f((wExpose * 60) / (2 * PI))} rpm`, 'Vertex touches the floor.');
      const Vs = p.targetSpill || 0;
      if (Vs > 0) {
        const Vr = V0 - Vs;
        if (Vr <= 0) warn.push('Target spill volume is larger than the initial volume.');
        else {
          const hh = Vr >= (PI * R * R * H) / 2 ? 2 * (H - Vr / (PI * R * R)) : (PI * R * R * H * H) / (2 * Vr);
          if (hh < 2 * (H - d) - 1e-12) warn.push('Target spill is smaller than zero at first-spill speed.');
          wTarget = Math.sqrt((2 * g * hh)) / R;
          st.add('Speed to spill the target volume', Vr >= (PI * R * R * H) / 2 ? 'V_rem = πR²(H − h/2) → h = 2(H − V_rem/πR²)' : 'V_rem = πR²H²/(2h) → h = πR²H²/(2V_rem)',
            `V_rem = ${f(V0)} − ${f(Vs)} = ${f(Vr)} → h = ${f(hh)}`, `ω = √(2gh)/R = ${f(wTarget)} rad/s = ${f((wTarget * 60) / (2 * PI))} rpm`, 'Inverse problem.');
        }
      }
    } else if (shape === 'closed') {
      wSpill = d >= H ? 0 : pre((S) => S.zv + S.h > H + 1e-12);
      wExpose = pre((S) => S.zv < -1e-12);
      st.add('Speed when liquid first touches the lid at the wall', 'z_v + h = H (no bottom exposure → d + h/2 = H)', '',
        wSpill == null ? 'not reached' : `ω = ${f(wSpill)} rad/s = ${f((wSpill * 60) / (2 * PI))} rpm`, 'Solved from air-volume conservation.');
      st.add('Speed to expose the bottom centre', 'z_v = 0', '', wExpose == null ? 'never (full or not reached)' : `ω = ${f(wExpose)} rad/s = ${f((wExpose * 60) / (2 * PI))} rpm`, 'Solved numerically.');
    } else {
      wSpill = pre((S) => S.spill);
      wExpose = pre((S) => S.zv < -1e-12);
      st.add('Speed to spill the first drop (cone)', 'z_v + kR² = H with volume conserved', '', wSpill == null ? 'not reached' : `ω = ${f(wSpill)} rad/s`, 'Solved numerically.');
      st.add('Speed to expose the apex', 'z_v = 0', '', wExpose == null ? 'not reached' : `ω = ${f(wExpose)} rad/s`, 'Solved numerically.');
    }

    out.push({ k: 'ω', v: w, u: 'rad/s' });
    out.push({ k: 'N', v: N, u: 'rpm' });
    out.push({ k: 'h = ω²R²/2g', v: h, u: Lu, hl: true });
    out.push({ k: 'Vertex above bottom', v: zv, u: Lu, hl: true });
    out.push({ k: 'Surface at the wall', v: rim, u: Lu });
    if (shape === 'open' && kase === 1) out.push({ k: 'Rise / fall (h/2)', v: h / 2, u: Lu });
    out.push({ k: 'Initial volume V₀', v: V0, u: U.vol });
    out.push({ k: 'Volume remaining', v: Vrem, u: U.vol });
    if (spill) { out.push({ k: 'Volume spilled', v: Vsp, u: U.vol, hl: true }); out.push({ k: 'Volume spilled', v: Vsp * U.volSmallFactor, u: U.volSmall }); }
    if (r0 > 0) out.push({ k: 'Dry radius r₀', v: r0, u: Lu, hl: true });
    if (rLid) out.push({ k: 'Lid contact from r', v: rLid, u: Lu });
    out.push({ k: shape === 'cone' ? 'p at apex' : 'p bottom centre', v: pBC, u: U.press });
    if (pBE !== null) out.push({ k: 'p bottom edge', v: pBE, u: U.press });
    if (pLidEdge !== null) out.push({ k: 'p lid edge', v: pLidEdge, u: U.press });
    if (Fbot !== null) out.push({ k: 'F on bottom', v: Fbot, u: U.force });
    if (Fhalf !== null) out.push({ k: 'F on half side wall', v: Fhalf, u: U.force });
    if (Flid !== null) out.push({ k: 'F on lid', v: Flid, u: U.force });
    if (wSpill !== null) out.push({ k: shape === 'closed' ? 'ω to touch lid' : 'ω first spill', v: wSpill, u: 'rad/s' });
    if (wExpose !== null) out.push({ k: 'ω expose bottom', v: wExpose, u: 'rad/s' });
    if (wTarget !== null) out.push({ k: 'ω for target spill', v: wTarget, u: 'rad/s', hl: true });

    const caseTxt = { 1: 'Case 1: no spill, vertex above bottom', 2: 'Case 2: spilling, vertex above bottom', 3: 'Case 3: vertex below the bottom', 4: 'Case 4: closed cylinder', 0: 'Open cone' }[kase];
    let status = { cls: spill ? 'bad' : zv < 0 ? 'warn' : 'ok', text: caseTxt + (spill ? ` — spills ${f(Vsp)} ${U.vol}` : '') };
    return {
      ok: true, err, warn, steps: st.list, out, status,
      geo: { shape, R, H, d, k, h, zv, rim, spill, r0, rLid, p0, kase, Vsp, gam },
      pAt,
    };
  }

  return {
    UNITS, fmt, clamp, simpson, bisect, areaClamp, solveIntercept,
    gateGeom, plane, curved, BODY, buoyancy, rectilinear, rotating, rotState, coneVol,
  };
});
