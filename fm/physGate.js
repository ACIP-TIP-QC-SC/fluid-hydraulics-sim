/* =====================================================================
 * PHYSICS — gate and cylinder equilibrium (2026-11-25 book-coverage upgrade)
 *   gateEq : straight or bent (polyline) gates with a hinge or pivot,
 *            gate weight, counterweight, stop / strut / cable support,
 *            liquid on one or both sides. Solves the support force and
 *            hinge reactions, the liquid depth that opens the gate, the
 *            counterweight or gate weight for balance, lifting force in
 *            guides with friction, and the depth that puts the CP a set
 *            distance below the centroid.
 *   cylEq  : cylinder / log with liquid on one or two sides, resting on
 *            smooth contacts. Solves the contact reactions, the weight
 *            (or Sg) at which a contact unloads, or the liquid depth.
 * Frame: x to the right, y up, liquid 1 on the left. Moments are taken
 * counter-clockwise positive.
 * Result shape as physics.js: { ok, err, warn, status, out, steps, geo }
 * ===================================================================== */
(function (root) {
  'use strict';
  const P0 = root.Physics;
  const f = P0.fmt;
  const PI = Math.PI, DEG = PI / 180;
  function Steps() { const list = []; return { list, add(t, fo, s, r, n) { list.push({ t, f: fo, s, r, n }); } }; }
  const fail = (err, warn, steps) => ({ ok: false, err, warn: warn || [], steps: steps || [], out: [], geo: {} });
  const ok = (st, out, warn, status, geo) => ({ ok: true, err: [], warn: warn || [], steps: st.list, out, status, geo });
  const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const rot = (M) => (M >= 0 ? 'counter-clockwise' : 'clockwise');
  const pt = (q) => `(${f(q[0])}, ${f(q[1])})`;

  /* pressure-prism force on segment P→Q from a liquid with surface at yS.
     side +1: liquid on the left of P→Q (force along the right normal); −1: on the right. */
  function segLoad(P, Q, yS, gam, ps, b, side) {
    const d = sub(Q, P), len = Math.hypot(d[0], d[1]);
    if (!(len > 0)) return null;
    const pAt = (t) => { const y = P[1] + d[1] * t; return (ps || 0) + gam * Math.max(0, yS - y); };
    const ts = [0, 1];
    if (Math.abs(d[1]) > 1e-12) { const tc = (yS - P[1]) / d[1]; if (tc > 0 && tc < 1) ts.splice(1, 0, tc); }
    let F = 0, Mt = 0; // F = ∫p ds·b ; Mt = ∫p t ds·b
    for (let i = 0; i < ts.length - 1; i++) {
      const t0 = ts[i], t1 = ts[i + 1], p0 = pAt(t0), p1 = pAt(t1), L = (t1 - t0) * len;
      const Fi = 0.5 * (p0 + p1) * L * b;
      if (Fi > 0) { const tcI = t0 + ((t1 - t0) * (p0 + 2 * p1)) / (3 * (p0 + p1)); F += Fi; Mt += Fi * tcI; }
    }
    if (!(F > 0)) return { F: 0, len, pt: null, dir: [0, 0], pTop: 0, pBot: 0 };
    const tc = Mt / F, rn = [d[1] / len, -d[0] / len], dir = side > 0 ? rn : [-rn[0], -rn[1]];
    return { F, len, t: tc, pt: [P[0] + d[0] * tc, P[1] + d[1] * tc], dir, Fx: F * dir[0], Fy: F * dir[1], p0: pAt(0), p1: pAt(1) };
  }

  function parsePts(txt) {
    return String(txt || '').split(/\n|;/).map((l) => l.split(/[ ,\t]+/).filter(Boolean).map(Number)).filter((q) => q.length >= 2 && isFinite(q[0]) && isFinite(q[1])).map((q) => [q[0], q[1]]);
  }

  /* =================================================================== */
  function gateEq(p, U) {
    const st = Steps(), out = [], warn = [];
    const gw = p.gwG > 0 ? p.gwG : U.gw, gam = p.sgG * gw, gam2 = (p.sg2G || 0) * gw, b = p.bG;
    const Fu = U.force, Lu = U.len, Mu = U.mom;
    if (!(b > 0)) return fail(['Enter the gate width (perpendicular to the page).']);
    if (!(gam > 0)) return fail(['Enter the specific gravity of the liquid.']);
    const gs = p.gs, plate = p.gk !== 'poly' || gs === 'lift';

    /* ---- depth that puts the CP a given distance below the centroid ---- */
    if (gs === 'cpe') {
      const circ = p.cpShape === 'circ', Lg = circ ? p.Dcp : p.Lg, sn = Math.sin(p.thG * DEG), e = p.eCP;
      if (!(e > 0)) return fail(['Enter how far the centre of pressure is below the centroid (along the plate).']);
      if (!(Lg > 0)) return fail([circ ? 'Enter the diameter.' : 'Enter the gate length.']);
      const A = circ ? (PI * Lg * Lg) / 4 : b * Lg, I = circ ? (PI * Lg ** 4) / 64 : (b * Lg ** 3) / 12;
      const sbar = I / (A * e);
      st.add('Distance from the centre of pressure to the centroid', 'y_p − ȳ = I_c / (ȳ A)  →  ȳ = I_c / (A·e)', `ȳ = ${f(I)} / (${f(A)} × ${f(e)})  (${circ ? `I_c = πD⁴/64, A = πD²/4 with D = ${f(Lg)}` : `I_c = bL³/12 = ${f(b)} × ${f(Lg)}³/12`})`, `ȳ = ${f(sbar)} ${Lu} along the plate`, 'The gap between CP and centroid shrinks as the plate goes deeper. A gate pivoted that far below its centroid opens once the water is deeper than this.');
      const hbar = sbar * sn, top = (sbar - Lg / 2) * sn;
      st.add('Depth of the centroid and of the top edge', 'h̄ = ȳ sinθ,  h_top = (ȳ − L/2) sinθ', `h̄ = ${f(sbar)} × ${f(sn)},  h_top = (${f(sbar)} − ${f(Lg / 2)}) × ${f(sn)}`, `h̄ = ${f(hbar)} ${Lu},  h_top = ${f(top)} ${Lu}`, top < 0 ? 'The top edge would be above the surface: no plate this size can have that small a gap.' : '');
      if (top < -1e-9) warn.push('The top edge comes out above the free surface, so the plate cannot be fully submerged with that CP offset. Use a smaller offset.');
      const F = gam * hbar * A;
      st.add('Resultant force', 'F = γ h̄ A', `F = ${f(gam)} × ${f(hbar)} × ${f(A)}`, `F = ${f(F)} ${Fu}`, '');
      out.push({ k: 'Depth of the top edge', v: top, u: Lu, hl: true }, { k: 'Depth of the centroid h̄', v: hbar, u: Lu }, { k: 'Centroid distance along the plate ȳ', v: sbar, u: Lu }, { k: 'Resultant force F', v: F, u: Fu, hl: true });
      const th = p.thG * DEG, Lgx = Lg * Math.cos(th);
      return ok(st, out, warn, { cls: warn.length ? 'warn' : 'ok', text: `Top edge ${f(top)} ${Lu} deep, F = ${f(F)} ${Fu}` }, { pts: [[0, -top - Lg * sn], [Lgx, -top]], yS: 0, hinge: null, cpe: true, sbar, e, th });
    }

    /* ---- geometry ---- */
    let pts, hingeP, supP = null, supDir = null, yS, wPt = null, hingeDesc = '', supDesc = '';
    const th = p.thG * DEG, cs = Math.cos(th), sn = Math.sin(th);
    if (plate) {
      const Lg = p.Lg;
      if (!(Lg > 0)) return fail(['Enter the gate length.']);
      const B = [0, 0], T = p.lean === 'under' ? [-Lg * cs, Lg * sn] : [Lg * cs, Lg * sn];
      pts = [B, T];
      const at = (s) => [T[0] + ((B[0] - T[0]) * s) / Lg, T[1] + ((B[1] - T[1]) * s) / Lg];
      if (!(p.sH >= 0 && p.sH <= Lg)) return fail(['The hinge must be on the gate: 0 ≤ s_hinge ≤ L.']);
      hingeP = at(p.sH);
      hingeDesc = p.sH === 0 ? 'top edge' : Math.abs(p.sH - Lg) < 1e-9 ? 'bottom edge' : `${f(p.sH)} ${Lu} down from the top`;
      yS = p.hB;
      if (p.supK !== 'none' && gs === 'P') {
        if (!(p.sP >= 0 && p.sP <= Lg)) return fail(['The support must be on the gate: 0 ≤ s_P ≤ L.']);
        supP = at(p.sP);
        const dP = sub(T, B), ln = Math.hypot(dP[0], dP[1]), rn = [dP[1] / ln, -dP[0] / ln];
        supDir = p.supK === 'normal' ? [-rn[0], -rn[1]] : p.supK === 'horiz' ? [-1, 0] : p.supK === 'vert' ? [0, 1] : [Math.cos(p.phiP * DEG), Math.sin(p.phiP * DEG)];
        supDesc = `${p.sP === 0 ? 'top edge' : Math.abs(p.sP - Lg) < 1e-9 ? 'bottom edge' : f(p.sP) + ' ' + Lu + ' down from the top'}, ${p.supK === 'normal' ? 'normal to the gate' : p.supK === 'horiz' ? 'horizontal' : p.supK === 'vert' ? 'vertical' : 'at ' + f(p.phiP) + '° from the +x axis'}`;
      }
      st.add('Gate geometry', p.lean === 'under' ? 'Plate leaning over the liquid (liquid underneath)' : 'Plate with the liquid on top of / beside it', `L = ${f(Lg)} ${Lu},  θ = ${f(p.thG)}°,  bottom B ${pt(B)},  top T ${pt(T)}`, `hinge at the ${hingeDesc} ${pt(hingeP)}`, 'x to the right, y up from the bottom edge; liquid 1 is on the left.');
    } else {
      pts = parsePts(p.ptxt);
      if (pts.length < 2) return fail(['Enter at least two corners (x, y), one per line.']);
      hingeP = [p.xH, p.yH]; yS = p.hS;
      if (p.supK !== 'none' && gs === 'P') {
        supP = [p.xP, p.yP];
        supDir = p.supK === 'horiz' ? [-1, 0] : p.supK === 'vert' ? [0, 1] : [Math.cos(p.phiP * DEG), Math.sin(p.phiP * DEG)];
        supDesc = `at ${pt(supP)}, ${p.supK === 'horiz' ? 'horizontal' : p.supK === 'vert' ? 'vertical' : 'at ' + f(p.phiP) + '° from the +x axis'}`;
      }
      st.add('Gate geometry (corners in order, liquid 1 on the left as you walk along them)', 'polyline', pts.map(pt).join(' → '), `hinge ${pt(hingeP)}`, 'x to the right, y up; the free surface of liquid 1 is at y = h.');
    }
    // weight of the gate: uniform along its length
    let Ltot = 0, cx = 0, cy = 0;
    for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); Ltot += l; cx += l * (pts[i][0] + pts[i + 1][0]) / 2; cy += l * (pts[i][1] + pts[i + 1][1]) / 2; }
    wPt = [cx / Ltot, cy / Ltot];
    const cwPt = plate ? [hingeP[0] + (p.xC || 0), hingeP[1]] : [p.xC, p.yC];

    /* ---- loads for a given surface level ---- */
    const y2 = p.h2G > 0 && gam2 > 0 ? p.h2G : null; // elevation of the side-2 surface
    const loads = (ySv, Wg, Wc) => {
      const L = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = segLoad(pts[i], pts[i + 1], ySv, gam, p.psG || 0, b, 1);
        if (a && a.F > 0) L.push(Object.assign(a, { name: `Liquid 1 on ${pts.length > 2 ? 'segment ' + (i + 1) : 'the gate'}`, seg: i, liq: 1 }));
        if (y2 !== null) { const c = segLoad(pts[i], pts[i + 1], y2, gam2, 0, b, -1); if (c && c.F > 0) L.push(Object.assign(c, { name: `Liquid 2 on ${pts.length > 2 ? 'segment ' + (i + 1) : 'the gate'}`, seg: i, liq: 2 })); }
      }
      if (Wg) L.push({ name: 'Gate weight', F: Wg, Fx: 0, Fy: -Wg, pt: wPt, dir: [0, -1], w: true });
      if (Wc) L.push({ name: 'Counterweight', F: Wc, Fx: 0, Fy: -Wc, pt: cwPt, dir: [0, -1], w: true });
      L.forEach((l) => { l.M = cross(sub(l.pt, hingeP), [l.Fx, l.Fy]); });
      return L;
    };
    const sumM = (L) => L.reduce((a, l) => a + l.M, 0);
    let Wg = p.Wg || 0, Wc = p.Wc || 0;
    const supArm = supP ? cross(sub(supP, hingeP), supDir) : 0;

    if (gs === 'h') {
      // surface level at which the moment about the hinge (without the support) changes sign
      const ys = pts.map((q) => q[1]), ymin = Math.min(...ys), ymax = Math.max(...ys), span = Math.max(ymax - ymin, Math.max(...pts.map((q) => Math.abs(q[0] - hingeP[0]))), 1e-6);
      const Mof = (h) => sumM(loads(h, Wg, Wc));
      const N = 6000, hi = ymax + 60 * span, tiny = 1e-12 * (1 + Math.abs(Mof(ymax)));
      let a = null, Ma = 0, root = null;
      for (let i = 0; i <= N; i++) {
        const h = ymin + ((hi - ymin) * i) / N, Mh = Mof(h);
        if (Math.abs(Mh) <= tiny) continue;
        if (a !== null && Ma * Mh < 0) { let lo = a, up = h, fl = Ma; for (let k = 0; k < 200; k++) { const m = 0.5 * (lo + up), Mm = Mof(m); if (fl * Mm <= 0) up = m; else { lo = m; fl = Mm; } } root = 0.5 * (lo + up); break; }
        a = h; Ma = Mh;
      }
      if (root === null) return fail(['The moment about the hinge never changes sign as the liquid rises, so the gate does not open for any depth (or it is open already). Check the hinge, weights and liquid side.'], warn, st.list);
      yS = root;
      st.add('Depth at which the gate is about to open', 'Σ M_hinge = 0 with the support force = 0', `raise the surface until the liquid moment balances the weights${y2 !== null ? ' and liquid 2' : ''} (bisection)`, `h = ${f(yS)} ${Lu}${plate ? ' above the bottom edge' : ' (surface elevation)'}`, 'Below this depth the gate stays closed; above it, the liquid turns it open.');
    }

    let L = loads(yS, Wg, Wc);
    {
      const rows = L.map((l) => [l.name, f(l.F), f(l.Fx), f(l.Fy), pt(l.pt), f(l.M)]);
      L.filter((l) => !l.w).forEach((l) => {
        const gl = l.liq === 1 ? gam : gam2;
        st.add(`${l.name}: pressure prism`, 'F = ½(p₁ + p₂)·ℓ·b on the wetted length ℓ, acting through the centroid of the trapezoid', `p from ${f(l.p0)} to ${f(l.p1)} ${U.press} along the segment (γ = ${f(gl)} ${U.gamma})`, `F = ${f(l.F)} ${Fu} at ${pt(l.pt)},  F_x = ${f(l.Fx)},  F_y = ${f(l.Fy)}`, 'The force is normal to the plate.');
      });
      st.add('Moments about the hinge', 'M = (r × F)_z = Δx·F_y − Δy·F_x  (+ = counter-clockwise)', `hinge at ${pt(hingeP)}`, `Σ M = ${f(sumM(L))} ${Mu} (${rot(sumM(L))})`, 'Each load’s point of action is listed in the table.', { head: ['Load', `F (${Fu})`, 'F_x', 'F_y', 'Acts at (x, y)', `M (${Mu})`], rows });
    }
    const Mliq = L.filter((l) => !l.w).reduce((a, l) => a + l.M, 0), Mall = sumM(L);
    out.push({ k: 'Unbalanced moment of the liquid about the hinge', v: Math.abs(Mliq), u: `${Mu} ${rot(Mliq)}`, hl: gs === 'P' && !supP });
    L.filter((l) => !l.w).forEach((l) => out.push({ k: `${l.name}: force`, v: l.F, u: Fu }));

    let P = 0;
    if (gs === 'Wc' || gs === 'Wg') {
      const which = gs === 'Wc' ? 'Counterweight' : 'Gate weight', at = gs === 'Wc' ? cwPt : wPt;
      const arm = cross(sub(at, hingeP), [0, -1]);
      if (Math.abs(arm) < 1e-12) return fail([`The ${which.toLowerCase()} acts straight through the hinge, so it cannot balance the gate.`], warn, st.list);
      const others = sumM(L.filter((l) => l.name !== which));
      const Wn = -others / arm;
      st.add(`${which} for balance`, `Σ M_hinge = 0:  W·(lever arm) = moment of the other loads`, `W = ${f(-others)} / ${f(arm)}`, `W = ${f(Wn)} ${Fu}`, Wn < 0 ? 'Negative: the gate would need an upward pull there; a weight cannot do it.' : 'With this weight the support carries no load (gate about to open).');
      if (gs === 'Wc') Wc = Wn; else Wg = Wn;
      L = loads(yS, Wg, Wc);
      out.push({ k: `${which} needed W`, v: Wn, u: Fu, hl: true });
      if (Wn < 0) warn.push(`The ${which.toLowerCase()} comes out negative: the liquid alone already holds the gate shut in that direction.`);
    } else if (gs === 'P' || gs === 'lift') {
      if (gs === 'lift') {
        const dP = sub(pts[1], pts[0]), ln = Math.hypot(dP[0], dP[1]), rn = [dP[1] / ln, -dP[0] / ln];
        const Nl = L.filter((l) => !l.w).reduce((a, l) => a + l.Fx * rn[0] + l.Fy * rn[1], 0), Nw = Wg * (0 * rn[0] - rn[1]);
        const Ntot = Math.abs(Nl + Nw), along = Wg * sn, fr = p.mu * Ntot;
        st.add('Normal force pressing the gate on its guides', 'N = Σ liquid force normal to the gate + W cosθ component', `N = |${f(Nl)} + ${f(Nw)}|`, `N = ${f(Ntot)} ${Fu}`, 'Friction in the guides acts against the motion.');
        st.add('Force to raise the gate', 'T_up = W sinθ + μN', `T = ${f(along)} + ${f(p.mu)} × ${f(Ntot)}`, `T = ${f(along + fr)} ${Fu}`, 'Pulling along the guides; for a vertical gate sinθ = 1.');
        st.add('Force to hold it while lowering', 'T_down = W sinθ − μN', `T = ${f(along)} − ${f(fr)}`, `T = ${f(along - fr)} ${Fu}`, along - fr < 0 ? 'Negative: friction holds it, so it must be pushed down.' : '');
        out.push({ k: 'Force to raise the gate', v: along + fr, u: Fu, hl: true }, { k: 'Force while lowering', v: along - fr, u: Fu }, { k: 'Normal force on the guides N', v: Ntot, u: Fu }, { k: 'Friction force μN', v: fr, u: Fu });
        return ok(st, out, warn, { cls: 'ok', text: `Raise: ${f(along + fr)} ${Fu}` }, { pts, yS, y2, hinge: null, loads: L, sup: null, plate, lift: true, gam2 });
      }
      if (supP) {
        if (Math.abs(supArm) < 1e-12) return fail(['The support acts straight through the hinge, so it cannot take any moment. Move it or change its direction.'], warn, st.list);
        P = -Mall / supArm;
        st.add('Support force from Σ M_hinge = 0', 'P·(lever arm) + Σ M = 0  →  P = −Σ M / ((r_P − r_hinge) × û)', `P = −(${f(Mall)}) / ${f(supArm)}  (support ${supDesc})`, `P = ${f(P)} ${Fu}`, P < 0 ? 'Negative: the support must pull (tension) rather than push.' : 'Positive: it pushes in the direction shown.');
        out.push({ k: 'Support force P', v: P, u: Fu, hl: true });
        if (P < 0) warn.push('The support force is negative: a smooth stop cannot pull, so the gate would open unless the support is a tie.');
      }
    }
    // hinge reactions
    const SFx = L.reduce((a, l) => a + l.Fx, 0) + (supP ? P * supDir[0] : 0), SFy = L.reduce((a, l) => a + l.Fy, 0) + (supP ? P * supDir[1] : 0);
    const Rx = -SFx, Ry = -SFy;
    st.add('Hinge reactions from ΣF = 0', 'R_x = −Σ F_x,  R_y = −Σ F_y', `Σ F_x = ${f(SFx)},  Σ F_y = ${f(SFy)} ${Fu}`, `R_x = ${f(Rx)},  R_y = ${f(Ry)} ${Fu},  |R| = ${f(Math.hypot(Rx, Ry))} ${Fu}`, '+x to the right, +y up.');
    out.push({ k: 'Hinge reaction R_x (+ right)', v: Rx, u: Fu, hl: gs === 'P' }, { k: 'Hinge reaction R_y (+ up)', v: Ry, u: Fu, hl: gs === 'P' }, { k: 'Hinge reaction |R|', v: Math.hypot(Rx, Ry), u: Fu });
    if (gs === 'h') out.push({ k: plate ? 'Liquid depth above the bottom edge h' : 'Liquid surface elevation h', v: yS, u: Lu, hl: true });
    const text = gs === 'h' ? `Opens at h = ${f(yS)} ${Lu}` : gs === 'Wc' ? `Counterweight ${f(Wc)} ${Fu}` : gs === 'Wg' ? `Gate weight ${f(Wg)} ${Fu}` : supP ? `P = ${f(P)} ${Fu}` : `Unbalanced moment ${f(Math.abs(Mliq))} ${Mu} ${rot(Mliq)}`;
    return ok(st, out, warn, { cls: warn.length ? 'warn' : 'ok', text }, { pts, yS, y2, hinge: hingeP, loads: L, sup: supP ? { pt: supP, dir: supDir, P } : null, R: [Rx, Ry], plate, cw: Wc ? cwPt : null, gam2 });
  }

  /* =================================================================== */
  /* Cylinder / log resting on smooth contacts                             */
  /* centre at (0, R); contact angles measured CCW from +x at the centre.   */
  /* liquid 1 wets the arc a1..a2 (through the left), liquid 2 the right.   */
  /* =================================================================== */
  function arcLoad(R, Lc, yS, gam, a0, a1, side) {
    // integrate p·n over the arc (pressure acts toward the centre); side not needed (normal is radial)
    const N = 2000; let Fx = 0, Fy = 0;
    for (let i = 0; i < N; i++) {
      const a = a0 + ((a1 - a0) * (i + 0.5)) / N, y = R + R * Math.sin(a), pr = gam * Math.max(0, yS - y);
      const ds = (Math.abs(a1 - a0) * R) / N;
      Fx += -pr * Math.cos(a) * ds * Lc; Fy += -pr * Math.sin(a) * ds * Lc;
    }
    return { Fx, Fy };
  }
  function cylEq(p, U) {
    const st = Steps(), out = [], warn = [];
    const gw = p.gwC > 0 ? p.gwC : U.gw, R = p.Dc / 2, Lc = p.Lc, Fu = U.force, Lu = U.len;
    if (!(R > 0 && Lc > 0)) return fail(['Enter the cylinder diameter and length.']);
    const g1 = p.sg1C * gw, g2 = p.sg2C * gw, A = PI * R * R, V = A * Lc;
    const a1 = p.c1 * DEG, a2 = p.c2 * DEG;
    // liquid 1 wets from the bottom contact around the left side to the top; liquid 2 the right side
    const wet = (h1, h2) => {
      const L1 = h1 > 0 && g1 > 0 ? arcLoad(R, Lc, h1, g1, p.w1a * DEG, p.w1b * DEG) : { Fx: 0, Fy: 0 };
      const L2 = h2 > 0 && g2 > 0 ? arcLoad(R, Lc, h2, g2, p.w2a * DEG, p.w2b * DEG) : { Fx: 0, Fy: 0 };
      return { L1, L2 };
    };
    const solveR = (W, h1, h2) => {
      const { L1, L2 } = wet(h1, h2);
      const Fx = L1.Fx + L2.Fx, Fy = L1.Fy + L2.Fy - W;
      // reactions N1, N2 act toward the centre from the contact points: dir = −(cos a, sin a)
      const u1 = [-Math.cos(a1), -Math.sin(a1)], u2 = [-Math.cos(a2), -Math.sin(a2)];
      const det = u1[0] * u2[1] - u1[1] * u2[0];
      if (Math.abs(det) < 1e-9) return null;
      const N1 = (-Fx * u2[1] + Fy * u2[0]) / det, N2 = (-Fy * u1[0] + Fx * u1[1]) / det;
      return { L1, L2, N1, N2 };
    };
    let W = p.WbyC === 'sg' ? p.sgC * gw * V : p.WC;
    let h1 = p.h1C, h2 = p.h2C;
    st.add('Cylinder', 'A = πR²,  V = A·L', `R = ${f(R)} ${Lu},  L = ${f(Lc)} ${Lu}`, `V = ${f(V)} ${U.vol}`, 'Centre at (0, R); the floor is y = 0. Contact angles are measured counter-clockwise from +x at the centre.');
    if (p.WbyC === 'sg' && p.cs !== 'W') st.add('Weight of the cylinder', 'W = S_c·γ_w·V', `W = ${f(p.sgC)} × ${f(gw)} × ${f(V)}`, `W = ${f(W)} ${Fu}`, '');
    const k = p.zeroC === '2' ? 'N2' : 'N1';
    if (p.cs === 'W') {
      const r0 = solveR(0, h1, h2), r1 = solveR(1, h1, h2);
      if (!r0) return fail(['The two contacts push along the same line; choose two different contact points.']);
      const d = r1[k] - r0[k];
      if (Math.abs(d) < 1e-12) return fail(['The weight does not change the load on that contact.']);
      W = -r0[k] / d;
      st.add(`Weight at which contact ${p.zeroC} just unloads`, `N${p.zeroC}(W) = 0  (N is linear in W)`, `W = −N${p.zeroC}(0) / (dN/dW) = ${f(-r0[k])} / ${f(d)}`, `W = ${f(W)} ${Fu}`, 'Heavier than this, the cylinder stays seated on that contact.');
      out.push({ k: 'Weight W', v: W, u: Fu, hl: true }, { k: 'Specific gravity of the cylinder', v: W / (gw * V), u: '', hl: true });
    } else if (p.cs === 'h') {
      const fz = (h) => { const r = solveR(W, h, p.same2C ? h : h2); return r ? r[k] : NaN; };
      let lo = 0, Mlo = fz(1e-9), root = null; const hi = 4 * p.Dc + 2 * Math.abs(h2), N = 4000;
      for (let i = 1; i <= N; i++) { const h = (hi * i) / N, v = fz(h); if (Mlo * v <= 0) { let a = lo, c = h, fa = Mlo; for (let j = 0; j < 200; j++) { const m = 0.5 * (a + c), fm = fz(m); if (fa * fm <= 0) c = m; else { a = m; fa = fm; } } root = 0.5 * (a + c); break; } lo = h; Mlo = v; }
      if (root === null) return fail([`Contact ${p.zeroC} never unloads as liquid 1 rises.`]);
      h1 = root; if (p.same2C) h2 = root;
      st.add(`Depth of liquid 1 at which contact ${p.zeroC} unloads`, `N${p.zeroC}(h) = 0`, 'bisection on the depth', `h₁ = ${f(h1)} ${Lu}`, '');
      out.push({ k: 'Depth of liquid 1 h₁', v: h1, u: Lu, hl: true });
    }
    const r = solveR(W, h1, h2);
    if (!r) return fail(['The two contacts push along the same line; choose two different contact points.']);
    const { L1, L2, N1, N2 } = r;
    if (h1 > 0) st.add('Force of liquid 1 on the cylinder', 'F_H = ∫p cos dA (= force on the vertical projection),  F_V = ∫p sin dA (= weight of liquid above / displaced below)', `depth h₁ = ${f(h1)} ${Lu} above the floor, γ₁ = ${f(g1)}, wetted arc ${f(p.w1a)}° → ${f(p.w1b)}°`, `F_H = ${f(L1.Fx)},  F_V = ${f(L1.Fy)} ${Fu}`, '+ = to the right / upward. The resultant passes through the centre.');
    if (h2 > 0 && g2 > 0) st.add('Force of liquid 2 on the cylinder', 'F_H, F_V as for liquid 1', `depth h₂ = ${f(h2)} ${Lu}, γ₂ = ${f(g2)}, wetted arc ${f(p.w2a)}° → ${f(p.w2b)}°`, `F_H = ${f(L2.Fx)},  F_V = ${f(L2.Fy)} ${Fu}`, '');
    const Hn = L1.Fx + L2.Fx, Vn = L1.Fy + L2.Fy;
    st.add('Net liquid force', 'ΣF_H, ΣF_V', `F_H = ${f(L1.Fx)} + ${f(L2.Fx)},  F_V = ${f(L1.Fy)} + ${f(L2.Fy)}`, `F_H = ${f(Hn)},  F_V = ${f(Vn)} ${Fu}`, Hn > 0 ? 'Net push to the right.' : Hn < 0 ? 'Net push to the left.' : '');
    st.add('Contact reactions (smooth, through the centre)', 'ΣF_x = 0, ΣF_y = 0 with N₁, N₂ along the radii at the contacts', `contacts at ${f(p.c1)}° and ${f(p.c2)}°, W = ${f(W)} ${Fu}`, `N₁ = ${f(N1)},  N₂ = ${f(N2)} ${Fu}`, N1 < 0 || N2 < 0 ? 'A negative reaction means that contact would separate.' : 'All forces pass through the centre, so moments balance automatically.');
    if (N1 < -1e-9 || N2 < -1e-9) warn.push('A contact reaction is negative: the cylinder would lift off that contact (it would roll or float away).');
    out.push({ k: 'Horizontal liquid force (net) F_H', v: Hn, u: Fu, hl: true }, { k: 'Vertical liquid force (net) F_V', v: Vn, u: Fu, hl: true }, { k: `Reaction N₁ at ${f(p.c1)}°`, v: N1, u: Fu, hl: true }, { k: `Reaction N₂ at ${f(p.c2)}°`, v: N2, u: Fu, hl: true }, { k: 'Weight W', v: W, u: Fu }, { k: 'Liquid 1 F_H', v: L1.Fx, u: Fu }, { k: 'Liquid 1 F_V', v: L1.Fy, u: Fu });
    if (h2 > 0 && g2 > 0) out.push({ k: 'Liquid 2 F_H', v: L2.Fx, u: Fu }, { k: 'Liquid 2 F_V', v: L2.Fy, u: Fu });
    return ok(st, out, warn, { cls: warn.length ? 'warn' : 'ok', text: `N₁ = ${f(N1)}, N₂ = ${f(N2)} ${Fu}` }, { R, h1, h2: g2 > 0 ? h2 : 0, a1, a2, N1, N2, L1, L2, W, w1: [p.w1a, p.w1b], w2: [p.w2a, p.w2b] });
  }

  Object.assign(P0, { gateEq, cylEq });
})(window);
