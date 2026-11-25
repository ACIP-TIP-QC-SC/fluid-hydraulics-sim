/* =====================================================================
 * PHYSICS — kinematics and potential flow (2026-11-25 book-coverage upgrade)
 *   field   a velocity field given as u, v, w (Cartesian), v_r, v_θ (polar),
 *           a stream function ψ or a velocity potential φ: velocity,
 *           local + convective acceleration, dilatation, rotation, vorticity,
 *           shear strain, Bernoulli pressure at a second point, flow between
 *           two streamlines, circulation, particle paths (Lagrangian)
 *   sn      streamline coordinates: a_s = ∂V/∂t + V ∂V/∂s, a_n = V²/R
 *   super   superposed ideal flows: half-body, Rankine oval, cylinder with
 *           circulation (lift), free / forced / combined vortex (tornado),
 *           source, sink + vortex, and a custom combination
 * Expressions are parsed by a small safe parser (no eval): + − × / ^,
 * implicit products (2x, 3(x+1)), sin cos tan asin acos atan atan2 sinh cosh
 * tanh exp ln log sqrt abs, pi, e; variables x y z t r th (θ, rad) s.
 * Sources: Hibbeler Ch. 3 and 7; 2500 Solved Problems Ch. 7 and 25.
 * ===================================================================== */
(function (root) {
  'use strict';
  const P0 = root.Physics;
  const f = P0.fmt;
  const PI = Math.PI, DEG = PI / 180, sqrt = Math.sqrt, abs = Math.abs, hyp = Math.hypot;
  function Steps() { const list = []; return { list, add(t, fo, s, r, n) { list.push({ t, f: fo, s, r, n }); } }; }
  const fail = (err, warn, steps) => ({ ok: false, err, warn: warn || [], steps: steps || [], out: [], geo: {} });
  const done = (st, out, warn, status, geo) => ({ ok: true, err: [], warn: warn || [], steps: st.list, out: out.filter((o) => typeof o.v === 'number' && isFinite(o.v)), status, geo });

  /* ------------------------------------------------------------------ */
  /* Safe expression parser                                              */
  /* ------------------------------------------------------------------ */
  const FUN = { sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, exp: Math.exp, ln: Math.log, log: Math.log10, sqrt: Math.sqrt, abs: Math.abs, cot: (a) => 1 / Math.tan(a), sec: (a) => 1 / Math.cos(a), csc: (a) => 1 / Math.sin(a) };
  const CONST = { pi: PI, e: Math.E };
  function parse(src, vars) {
    const s = String(src || '').replace(/\s+/g, '').replace(/θ/g, 'th').replace(/π/g, 'pi').replace(/[×·]/g, '*').replace(/[−–]/g, '-').replace(/\*\*/g, '^');
    if (!s) throw new Error('empty expression');
    let i = 0;
    const peek = () => s[i];
    const isD = (c) => c >= '0' && c <= '9' || c === '.';
    const isL = (c) => /[a-zA-Z_]/.test(c || '');
    function num() { const j = i; while (isD(s[i])) i++; if ((s[i] === 'E' || s[i] === 'e') && (/[0-9]/.test(s[i + 1] || '') || (/[+-]/.test(s[i + 1] || '') && /[0-9]/.test(s[i + 2] || '')))) { i++; if (s[i] === '+' || s[i] === '-') i++; while (isD(s[i])) i++; } const v = parseFloat(s.slice(j, i)); if (!isFinite(v)) throw new Error('bad number near "' + s.slice(j, j + 6) + '"'); return () => v; }
    function ident() {
      const j = i; while (isL(s[i])) i++;
      let name = s.slice(j, i);
      if (name === 'atan' && s[i] === '2' && s[i + 1] === '(') { i++; name = 'atan2'; }
      if (name === 'atan2') { if (s[i] !== '(') throw new Error('atan2 needs ( , )'); i++; const a = expr(); if (s[i] !== ',') throw new Error('atan2 needs two arguments'); i++; const b = expr(); if (s[i] !== ')') throw new Error('missing )'); i++; return (V) => Math.atan2(a(V), b(V)); }
      if (FUN[name] && s[i] === '(') { const fn = FUN[name]; i++; const a = expr(); if (s[i] !== ')') throw new Error('missing ) after ' + name); i++; return (V) => fn(a(V)); }
      // split a run of letters into known variables / constants (e.g. "xy", "pix")
      const parts = [];
      let k = 0;
      while (k < name.length) {
        const rest = name.slice(k);
        const m = ['pi', 'th'].concat(vars).concat(['e']).sort((a, b) => b.length - a.length).find((v) => rest.startsWith(v) && (vars.includes(v) || CONST[v] !== undefined));
        if (!m) {
          const fn = Object.keys(FUN).find((fn2) => rest === fn2);
          throw new Error(fn ? `${fn} needs brackets, e.g. ${fn}(x)` : `unknown name "${rest}" (variables: ${vars.join(', ')})`);
        }
        parts.push(m); k += m.length;
      }
      const fns = parts.map((p) => (CONST[p] !== undefined && !vars.includes(p) ? (() => CONST[p]) : ((V) => V[p])));
      return fns.length === 1 ? fns[0] : (V) => fns.reduce((a, g) => a * g(V), 1);
    }
    function atom() {
      const c = peek();
      if (c === '(') { i++; const a = expr(); if (s[i] !== ')') throw new Error('missing )'); i++; return a; }
      if (isD(c)) return num();
      if (isL(c)) return ident();
      throw new Error(c === undefined ? 'expression ends too early' : `unexpected "${c}"`);
    }
    function power() {
      let a = atom();
      if (s[i] === '^') { i++; const b = unary(); const a0 = a; a = (V) => Math.pow(a0(V), b(V)); }
      return a;
    }
    function unary() { if (s[i] === '-') { i++; const a = unary(); return (V) => -a(V); } if (s[i] === '+') { i++; return unary(); } return power(); }
    function term() {
      let a = unary();
      for (;;) {
        const c = s[i];
        if (c === '*' || c === '/') { i++; const b = unary(), a0 = a; a = c === '*' ? (V) => a0(V) * b(V) : (V) => a0(V) / b(V); }
        else if (c === '(' || isL(c) || isD(c)) { const b = power(), a0 = a; a = (V) => a0(V) * b(V); } // implicit product
        else break;
      }
      return a;
    }
    function expr() {
      let a = term();
      while (s[i] === '+' || s[i] === '-') { const c = s[i++]; const b = term(), a0 = a; a = c === '+' ? (V) => a0(V) + b(V) : (V) => a0(V) - b(V); }
      return a;
    }
    const fn = expr();
    if (i < s.length) throw new Error(`unexpected "${s[i]}"`);
    return fn;
  }
  function compile(src, vars, label) {
    try { return { fn: parse(src, vars) }; } catch (e) { return { err: `${label}: ${e.message}` }; }
  }

  const units = (U) => {
    const SI = U.id === 'SI';
    return { SI, g: U.g, L: SI ? 'm' : 'ft', V: SI ? 'm/s' : 'ft/s', a: SI ? 'm/s²' : 'ft/s²', p: SI ? 'kPa' : 'psi', pf: SI ? 1000 : 144, rho: SI ? 'kg/m³' : 'slug/ft³', q: SI ? 'm²/s' : 'ft²/s', F: SI ? 'N/m' : 'lb/ft', w: 'rad/s', inv: '1/s' };
  };

  /* ------------------------------------------------------------------ */
  /* Velocity field from the chosen description                          */
  /* ------------------------------------------------------------------ */
  function buildField(p) {
    const mode = p.mode, C = ['x', 'y', 'z', 't'], Pv = ['r', 'th', 'z', 't'];
    const pol = (fx) => (V) => fx({ r: hyp(V.x, V.y), th: Math.atan2(V.y, V.x), z: V.z, t: V.t, x: V.x, y: V.y });
    const hD = (x) => 1e-5 * (1 + abs(x));
    if (mode === 'cart') {
      const a = compile(p.eu, C, 'u'), b = compile(p.ev, C, 'v'), c = compile(p.ew || '0', C, 'w');
      const e = a.err || b.err || c.err; if (e) return { err: e };
      return { vel: (V) => [a.fn(V), b.fn(V), c.fn(V)], txt: `u = ${p.eu},  v = ${p.ev},  w = ${p.ew || '0'}`, threeD: String(p.ew || '0').trim() !== '0' };
    }
    if (mode === 'polar') {
      const a = compile(p.evr, Pv.concat(['x', 'y']), 'v_r'), b = compile(p.evt, Pv.concat(['x', 'y']), 'v_θ');
      const e = a.err || b.err; if (e) return { err: e };
      const vr = pol(a.fn), vt = pol(b.fn);
      return { vel: (V) => { const th = Math.atan2(V.y, V.x), r1 = vr(V), t1 = vt(V); return [r1 * Math.cos(th) - t1 * Math.sin(th), r1 * Math.sin(th) + t1 * Math.cos(th), 0]; }, txt: `v_r = ${p.evr},  v_θ = ${p.evt}`, polar: true };
    }
    if (mode === 'psi' || mode === 'phi') {
      const a = compile(mode === 'psi' ? p.epsi : p.ephi, C, mode === 'psi' ? 'ψ' : 'φ'); if (a.err) return { err: a.err };
      const F = a.fn;
      const dx = (V) => { const h = hD(V.x); return (F(Object.assign({}, V, { x: V.x + h })) - F(Object.assign({}, V, { x: V.x - h }))) / (2 * h); };
      const dy = (V) => { const h = hD(V.y); return (F(Object.assign({}, V, { y: V.y + h })) - F(Object.assign({}, V, { y: V.y - h }))) / (2 * h); };
      return { vel: mode === 'psi' ? (V) => [dy(V), -dx(V), 0] : (V) => [dx(V), dy(V), 0], F, txt: (mode === 'psi' ? 'ψ = ' + p.epsi : 'φ = ' + p.ephi), kind: mode };
    }
    if (mode === 'psiP' || mode === 'phiP') {
      const a = compile(mode === 'psiP' ? p.epsi : p.ephi, Pv.concat(['x', 'y']), mode === 'psiP' ? 'ψ' : 'φ'); if (a.err) return { err: a.err };
      const F = a.fn;
      const G = (r, th, V) => F({ r, th, x: r * Math.cos(th), y: r * Math.sin(th), z: V.z, t: V.t });
      const vel = (V) => {
        const r = hyp(V.x, V.y), th = Math.atan2(V.y, V.x), hr = 1e-5 * (1 + r), ht = 1e-6;
        const Fr = (G(r + hr, th, V) - G(r - hr, th, V)) / (2 * hr), Ft = (G(r, th + ht, V) - G(r, th - ht, V)) / (2 * ht);
        const vr = mode === 'psiP' ? Ft / r : Fr, vt = mode === 'psiP' ? -Fr : Ft / r;
        return [vr * Math.cos(th) - vt * Math.sin(th), vr * Math.sin(th) + vt * Math.cos(th), 0];
      };
      return { vel, F: (V) => G(hyp(V.x, V.y), Math.atan2(V.y, V.x), V), txt: (mode === 'psiP' ? 'ψ = ' + p.epsi : 'φ = ' + p.ephi), kind: mode === 'psiP' ? 'psi' : 'phi', polar: true };
    }
    return { err: 'Choose how the flow is described.' };
  }
  function grad(vel, V) {
    const J = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], dt = [0, 0, 0];
    ['x', 'y', 'z'].forEach((k, j) => {
      const h = 1e-3 * (1 + abs(V[k]));
      const a = vel(Object.assign({}, V, { [k]: V[k] + h })), b = vel(Object.assign({}, V, { [k]: V[k] - h }));
      const a2 = vel(Object.assign({}, V, { [k]: V[k] + h / 2 })), b2 = vel(Object.assign({}, V, { [k]: V[k] - h / 2 }));
      for (let c = 0; c < 3; c++) { const d1 = (a[c] - b[c]) / (2 * h), d2 = (a2[c] - b2[c]) / h; J[c][j] = (4 * d2 - d1) / 3; } // Richardson
    });
    const h = 1e-3 * (1 + abs(V.t));
    const a = vel(Object.assign({}, V, { t: V.t + h })), b = vel(Object.assign({}, V, { t: V.t - h })), a2 = vel(Object.assign({}, V, { t: V.t + h / 2 })), b2 = vel(Object.assign({}, V, { t: V.t - h / 2 }));
    for (let c = 0; c < 3; c++) dt[c] = (4 * ((a2[c] - b2[c]) / h) - (a[c] - b[c]) / (2 * h)) / 3;
    return { J, dt };
  }
  const clean = (x, ref) => (abs(x) < 1e-7 * Math.max(1, ref || 0) ? 0 : x);
  function rk4Path(vel, P, t0, stop, maxT) {
    // integrates dx/dt = V(x, t) from P at t0 until stop(state) or t − t0 = maxT
    let x = P.x, y = P.y, z = P.z, t = t0;
    const pts = [[x, y]];
    const N = 4000, dt0 = maxT / N;
    const F = (x1, y1, z1, t1) => vel({ x: x1, y: y1, z: z1, t: t1 });
    for (let i = 0; i < N; i++) {
      const dt = dt0;
      const k1 = F(x, y, z, t), k2 = F(x + (dt / 2) * k1[0], y + (dt / 2) * k1[1], z + (dt / 2) * k1[2], t + dt / 2);
      const k3 = F(x + (dt / 2) * k2[0], y + (dt / 2) * k2[1], z + (dt / 2) * k2[2], t + dt / 2), k4 = F(x + dt * k3[0], y + dt * k3[1], z + dt * k3[2], t + dt);
      const nx = x + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), ny = y + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]), nz = z + (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]), nt = t + dt;
      if (![nx, ny, nz].every(isFinite)) return { x, y, z, t, pts, bad: true };
      if (stop) {
        const s0 = stop({ x, y, z }), s1 = stop({ x: nx, y: ny, z: nz });
        if (s0 * s1 <= 0 && s1 !== s0) { const fr = s0 / (s0 - s1); x += fr * (nx - x); y += fr * (ny - y); z += fr * (nz - z); t += fr * dt; pts.push([x, y]); return { x, y, z, t, pts, hit: true }; }
      }
      x = nx; y = ny; z = nz; t = nt; if (i % 20 === 0) pts.push([x, y]);
    }
    pts.push([x, y]);
    return { x, y, z, t, pts };
  }
  // streamline through a point at a frozen instant (arc-length stepping both ways)
  function streamline(vel, P, t, span) {
    const step = span / 300, out = [];
    [1, -1].forEach((dir) => {
      let x = P.x, y = P.y; const pts = [[x, y]];
      for (let i = 0; i < 600; i++) {
        const F = (a, b) => { const v = vel({ x: a, y: b, z: P.z, t }), m = hyp(v[0], v[1]); return m > 1e-12 ? [(dir * v[0]) / m, (dir * v[1]) / m] : [0, 0]; };
        const k1 = F(x, y), k2 = F(x + (step / 2) * k1[0], y + (step / 2) * k1[1]), k3 = F(x + (step / 2) * k2[0], y + (step / 2) * k2[1]), k4 = F(x + step * k3[0], y + step * k3[1]);
        const nx = x + (step / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), ny = y + (step / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
        if (!isFinite(nx) || !isFinite(ny) || (nx === x && ny === y)) break;
        x = nx; y = ny; pts.push([x, y]);
        if (abs(x - P.x) > span || abs(y - P.y) > span) break;
      }
      out.push(pts);
    });
    return out[1].reverse().concat(out[0].slice(1));
  }

  /* ------------------------------------------------------------------ */
  function kinematics(p, U) {
    const u = units(U), st = Steps(), warn = [], out = [];
    const topic = p.topic;

    if (topic === 'sn') {
      const e = compile(p.eV, ['s', 't'], 'V(s, t)'); if (e.err) return fail([e.err]);
      const F = (s1, t1) => e.fn({ s: s1, t: t1 });
      const s0 = p.ss, t0 = p.st, V = F(s0, t0), hs = 1e-4 * (1 + abs(s0)), ht = 1e-4 * (1 + abs(t0));
      const dVds = (F(s0 + hs, t0) - F(s0 - hs, t0)) / (2 * hs), dVdt = (F(s0, t0 + ht) - F(s0, t0 - ht)) / (2 * ht);
      if (!isFinite(V)) return fail(['The speed cannot be evaluated at that point.']);
      const as = dVdt + V * dVds, an = (p.sR > 0 ? (V * V) / p.sR : 0) + (p.sAnt || 0), a = hyp(as, an);
      st.add('Speed at the point', 'V = V(s, t)', `V(${f(s0)}, ${f(t0)})`, `V = ${f(V)} ${u.V}`, '');
      st.add('Tangential acceleration', 'a_s = ∂V/∂t + V ∂V/∂s', `a_s = ${f(dVdt)} + ${f(V)} × ${f(dVds)}`, `a_s = ${f(as)} ${u.a}`, 'Local part + convective part.');
      st.add('Normal acceleration', 'a_n = (∂Vₙ/∂t) + V²/R', p.sR > 0 ? `a_n = ${f(p.sAnt || 0)} + ${f(V)}²/${f(p.sR)}` : 'straight streamline (R = ∞)', `a_n = ${f(an)} ${u.a}`, '');
      st.add('Magnitude', 'a = √(a_s² + a_n²)', '', `a = ${f(a)} ${u.a}`, '');
      out.push({ k: 'Speed V', v: V, u: u.V, hl: true }, { k: 'Local ∂V/∂t', v: dVdt, u: u.a }, { k: 'Convective V ∂V/∂s', v: V * dVds, u: u.a }, { k: 'Tangential a_s', v: as, u: u.a, hl: true }, { k: 'Normal a_n', v: an, u: u.a, hl: true }, { k: 'Acceleration a', v: a, u: u.a, hl: true });
      return done(st, out, warn, { cls: 'ok', text: `a = ${f(a)} ${u.a}` }, { topic, V, as, an, R: p.sR });
    }

    if (topic === 'field') {
      const fld = buildField(p);
      if (fld.err) return fail([fld.err]);
      const vel = (V) => fld.vel(V);
      const pol = fld.polar;
      const PA = pol ? { x: p.pr * Math.cos(p.pth * DEG), y: p.pr * Math.sin(p.pth * DEG), z: 0, t: p.pt } : { x: p.px, y: p.py, z: p.pz, t: p.pt };
      const v = vel(PA);
      if (!v.every(isFinite)) return fail(['The velocity cannot be evaluated at that point (division by zero or a log of a negative number?).']);
      const Vm = hyp(v[0], v[1], v[2]);
      const ptxt = pol ? `(r, θ) = (${f(p.pr)} ${u.L}, ${f(p.pth)}°)` : `(${f(PA.x)}, ${f(PA.y)}${fld.threeD ? ', ' + f(PA.z) : ''}) ${u.L}`;
      st.add('Velocity at the point', fld.txt, `at ${ptxt}, t = ${f(PA.t)} s` + (fld.kind === 'psi' ? ';  u = ∂ψ/∂y, v = −∂ψ/∂x' : fld.kind === 'phi' ? ';  u = ∂φ/∂x, v = ∂φ/∂y' : ''), `u = ${f(clean(v[0], Vm))},  v = ${f(clean(v[1], Vm))}${fld.threeD ? ',  w = ' + f(clean(v[2], Vm)) : ''};  V = ${f(Vm)} ${u.V}`, 'Derivatives are taken numerically (central differences).');
      const { J, dt } = grad(vel, PA);
      const conv = [0, 1, 2].map((c) => v[0] * J[c][0] + v[1] * J[c][1] + v[2] * J[c][2]);
      const acc = [0, 1, 2].map((c) => dt[c] + conv[c]);
      const am = hyp(acc[0], acc[1], acc[2]);
      const R = (x) => clean(x, Math.max(Vm, am, 1));
      st.add('Acceleration', 'a = ∂V/∂t + u ∂V/∂x + v ∂V/∂y + w ∂V/∂z', `local: (${f(R(dt[0]))}, ${f(R(dt[1]))}${fld.threeD ? ', ' + f(R(dt[2])) : ''});  convective: (${f(R(conv[0]))}, ${f(R(conv[1]))}${fld.threeD ? ', ' + f(R(conv[2])) : ''})`, `a_x = ${f(R(acc[0]))},  a_y = ${f(R(acc[1]))}${fld.threeD ? ',  a_z = ' + f(R(acc[2])) : ''};  a = ${f(am)} ${u.a}`, '');
      const div = R(J[0][0] + J[1][1] + J[2][2]);
      const wx = R(J[2][1] - J[1][2]), wy = R(J[0][2] - J[2][0]), wz = R(J[1][0] - J[0][1]);
      const gxy = R(J[1][0] + J[0][1]), gyz = R(J[2][1] + J[1][2]), gzx = R(J[0][2] + J[2][0]);
      st.add('Volumetric dilatation rate (continuity)', '∂u/∂x + ∂v/∂y + ∂w/∂z', `${f(R(J[0][0]))} + ${f(R(J[1][1]))} + ${f(R(J[2][2]))}`, `= ${f(div)} ${u.inv}` + (abs(div) < 1e-6 ? '  → incompressible (continuity satisfied)' : '  → not incompressible'), '');
      st.add('Rotation and vorticity', 'ω_z = ½(∂v/∂x − ∂u/∂y);  ζ = 2ω', `∂v/∂x = ${f(R(J[1][0]))},  ∂u/∂y = ${f(R(J[0][1]))}`, `ω_z = ${f(wz / 2)} rad/s,  ζ_z = ${f(wz)} ${u.inv}` + (Math.max(abs(wx), abs(wy), abs(wz)) < 1e-6 ? '  → irrotational' : '  → rotational'), '');
      st.add('Shear strain rate', 'γ̇_xy = ∂v/∂x + ∂u/∂y', '', `γ̇_xy = ${f(gxy)} ${u.inv}`, '');
      out.push({ k: 'u', v: R(v[0]), u: u.V, hl: true }, { k: 'v', v: R(v[1]), u: u.V, hl: true });
      if (fld.threeD) out.push({ k: 'w', v: R(v[2]), u: u.V, hl: true });
      out.push({ k: 'Speed V', v: Vm, u: u.V, hl: true }, { k: 'Direction of V from +x', v: Math.atan2(v[1], v[0]) / DEG, u: '°' });
      if (pol) { const th = Math.atan2(PA.y, PA.x); out.push({ k: 'v_r', v: R(v[0] * Math.cos(th) + v[1] * Math.sin(th)), u: u.V }, { k: 'v_θ', v: R(-v[0] * Math.sin(th) + v[1] * Math.cos(th)), u: u.V }); }
      out.push({ k: 'a_x', v: R(acc[0]), u: u.a, hl: true }, { k: 'a_y', v: R(acc[1]), u: u.a, hl: true });
      if (fld.threeD) out.push({ k: 'a_z', v: R(acc[2]), u: u.a, hl: true });
      out.push({ k: 'Acceleration a', v: am, u: u.a, hl: true }, { k: 'Local a_x, ∂u/∂t', v: R(dt[0]), u: u.a }, { k: 'Local a_y, ∂v/∂t', v: R(dt[1]), u: u.a }, { k: 'Convective a_x', v: R(conv[0]), u: u.a }, { k: 'Convective a_y', v: R(conv[1]), u: u.a },
        { k: 'Dilatation rate ∇·V', v: div, u: u.inv, hl: true }, { k: 'Rotation ω_z', v: wz / 2, u: 'rad/s', hl: true }, { k: 'Vorticity ζ_z', v: wz, u: u.inv });
      if (fld.threeD) out.push({ k: 'Rotation ω_x', v: wx / 2, u: 'rad/s' }, { k: 'Rotation ω_y', v: wy / 2, u: 'rad/s' }, { k: 'Shear strain γ̇_yz', v: gyz, u: u.inv }, { k: 'Shear strain γ̇_zx', v: gzx, u: u.inv });
      out.push({ k: 'Shear strain γ̇_xy', v: gxy, u: u.inv }, { k: '∂u/∂x', v: R(J[0][0]), u: u.inv }, { k: '∂u/∂y', v: R(J[0][1]), u: u.inv }, { k: '∂v/∂x', v: R(J[1][0]), u: u.inv }, { k: '∂v/∂y', v: R(J[1][1]), u: u.inv });
      if (fld.F) out.push({ k: fld.kind === 'psi' ? 'ψ at the point' : 'φ at the point', v: fld.F(pol ? { r: p.pr, th: p.pth * DEG, x: PA.x, y: PA.y, z: 0, t: PA.t } : PA), u: u.q });
      const irr = Math.max(abs(wx), abs(wy), abs(wz)) < 1e-6, inc = abs(div) < 1e-6;
      const oneD = p.mode === 'cart' && String(p.ev).trim() === '0' && String(p.ew || '0').trim() === '0';
      if (!inc) warn.push(oneD ? '∂u/∂x ≠ 0: a one-dimensional field like this describes flow along a streamline whose cross-section (or density) changes, so ∇·V = 0 is not expected.' : '∇·V ≠ 0: the flow does not satisfy continuity for an incompressible fluid.');
      // second point B
      let PB = null, vB = null;
      if (p.useB) {
        PB = pol ? { x: p.br * Math.cos(p.bth * DEG), y: p.br * Math.sin(p.bth * DEG), z: 0, t: PA.t } : { x: p.bx, y: p.by, z: p.bz, t: PA.t };
        vB = vel(PB);
        if (!vB.every(isFinite)) return fail(['The velocity cannot be evaluated at point B.'], warn, st.list);
        const VB = hyp(vB[0], vB[1], vB[2]);
        out.push({ k: 'Speed at B', v: VB, u: u.V, hl: true });
        if (p.pA !== undefined && p.rho > 0) {
          const zA = p.gAx === 'y' ? PA.y : p.gAx === 'z' ? PA.z : 0, zB = p.gAx === 'y' ? PB.y : p.gAx === 'z' ? PB.z : 0;
          const pa = p.pA * u.pf, pb = pa + 0.5 * p.rho * (Vm * Vm - VB * VB) + p.rho * u.g * (zA - zB);
          st.add('Bernoulli between A and B', 'p_A/ρ + V_A²/2 + g z_A = p_B/ρ + V_B²/2 + g z_B', `V_A = ${f(Vm)}, V_B = ${f(VB)} ${u.V}` + (p.gAx !== 'none' ? `;  z_A = ${f(zA)}, z_B = ${f(zB)} ${u.L}` : ';  same elevation'), `p_B = ${f(pb / u.pf)} ${u.p}`, irr ? 'The flow is irrotational, so A and B need not lie on the same streamline.' : 'The flow is rotational: this holds only if A and B are on the same streamline.');
          if (!irr) warn.push('The flow is rotational: Bernoulli between A and B holds only along one streamline.');
          if (fld.threeD) warn.push('Unsteady or 3-D effects are ignored in the Bernoulli step.');
          out.push({ k: 'Pressure at B', v: pb / u.pf, u: u.p, hl: true });
        }
        if (!fld.threeD) {
          let dpsi;
          if (fld.kind === 'psi') { const FA = fld.F(pol ? { r: p.pr, th: p.pth * DEG, z: 0, t: PA.t, x: PA.x, y: PA.y } : PA), FB = fld.F(pol ? { r: p.br, th: p.bth * DEG, z: 0, t: PA.t, x: PB.x, y: PB.y } : PB); dpsi = FB - FA; }
          else if (inc) {
            // q = ∫(u dy − v dx) along the straight line A → B (Simpson)
            const N = 400; let sum = 0;
            for (let i = 0; i <= N; i++) { const t = i / N, Q = { x: PA.x + t * (PB.x - PA.x), y: PA.y + t * (PB.y - PA.y), z: 0, t: PA.t }, w = vel(Q), c = i === 0 || i === N ? 1 : i % 2 ? 4 : 2; sum += c * (w[0] * (PB.y - PA.y) - w[1] * (PB.x - PA.x)); }
            dpsi = sum / (3 * N);
          }
          if (isFinite(dpsi)) { st.add('Flow between the streamlines through A and B', 'q = ψ_B − ψ_A = ∫(u dy − v dx)', '', `q = ${f(dpsi)} ${u.q} (per unit depth)`, 'Positive q crosses the line A → B from right to left.'); out.push({ k: 'Flow between A and B, ψ_B − ψ_A', v: dpsi, u: u.q, hl: true }); }
        }
      }
      // circulation around a circle centred on A
      if (p.circR > 0 && !fld.threeD) {
        const N = 720; let G = 0;
        for (let i = 0; i < N; i++) { const a = ((i + 0.5) / N) * 2 * PI, w = vel({ x: PA.x + p.circR * Math.cos(a), y: PA.y + p.circR * Math.sin(a), z: 0, t: PA.t }); G += (-w[0] * Math.sin(a) + w[1] * Math.cos(a)) * p.circR * ((2 * PI) / N); }
        st.add('Circulation around a circle centred on A', 'Γ = ∮ V · ds (counterclockwise)', `radius ${f(p.circR)} ${u.L}`, `Γ = ${f(clean(G, 1))} ${u.q}`, 'Stokes: Γ equals the vorticity flux through the circle.');
        out.push({ k: 'Circulation Γ', v: clean(G, 1), u: u.q, hl: true });
      }
      // particle path
      let path = null;
      if (p.track !== 'none') {
        const dur = p.track === 'time' ? p.tDur : Math.max(1e-6, p.tMax);
        if (!(dur > 0)) return fail(['Enter a positive tracking time.'], warn, st.list);
        const stop = p.track === 'x' ? (Q) => Q.x - p.tTo : p.track === 'y' ? (Q) => Q.y - p.tTo : null;
        path = rk4Path(vel, PA, PA.t, stop, dur);
        if (p.track !== 'time' && !path.hit) warn.push(`The particle did not reach ${p.track} = ${f(p.tTo)} within ${f(dur)} s.`);
        const vE = vel({ x: path.x, y: path.y, z: path.z, t: path.t });
        st.add('Particle path (Lagrangian)', 'dx/dt = u(x, y, z, t),  dy/dt = v,  dz/dt = w', `start ${ptxt} at t = ${f(PA.t)} s` + (p.track === 'time' ? `; for ${f(dur)} s` : `; until ${p.track} = ${f(p.tTo)}`), `reaches (${f(path.x)}, ${f(path.y)}${fld.threeD ? ', ' + f(path.z) : ''}) at t = ${f(path.t)} s with V = ${f(hyp(vE[0], vE[1], vE[2]))} ${u.V}`, 'Integrated numerically (4th-order Runge–Kutta).');
        out.push({ k: 'Particle x at the end', v: path.x, u: u.L, hl: true }, { k: 'Particle y at the end', v: path.y, u: u.L, hl: true });
        if (fld.threeD) out.push({ k: 'Particle z at the end', v: path.z, u: u.L });
        out.push({ k: 'Time at the end', v: path.t, u: 's', hl: true }, { k: 'Elapsed time', v: path.t - PA.t, u: 's' }, { k: 'Speed at the end', v: hyp(vE[0], vE[1], vE[2]), u: u.V, hl: true }, { k: 'u at the end', v: vE[0], u: u.V }, { k: 'v at the end', v: vE[1], u: u.V });
      }
      // streamline through A for the picture
      const span = 2.5 * Math.max(1, hyp(PA.x, PA.y), PB ? hyp(PB.x - PA.x, PB.y - PA.y) : 0);
      const sl = fld.threeD ? [] : streamline(vel, PA, PA.t, span);
      const slB = PB && !fld.threeD ? streamline(vel, PB, PA.t, span) : null;
      const status = (inc ? 'incompressible' : 'compressible / not continuous') + ', ' + (irr ? 'irrotational' : 'rotational');
      return done(st, out, warn, { cls: inc ? 'ok' : 'warn', text: `V = ${f(Vm)} ${u.V}, a = ${f(am)} ${u.a} — ${status}` }, { topic, PA, PB, v, vB, acc, sl, slB, path: path ? path.pts : null, span, vel, t: PA.t, threeD: fld.threeD });
    }

    if (topic === 'super') {
      const kind = p.sk;
      const els = []; // {t:'U',U,al} {t:'src',q,x,y} {t:'vtx',G,x,y} {t:'dbl',K,x,y} {t:'rv', w, rc} (forced core)
      const Uq = p.U, q = p.q, a = p.a, Ga = p.G, Rc = p.Rcyl;
      let geom = {};
      const rho = p.rho;
      if (kind === 'half') {
        if (!(Uq > 0 && q > 0)) return fail(['Enter U > 0 and a source strength q > 0.']);
        els.push({ t: 'U', U: Uq, al: 0 }, { t: 'src', q, x: 0, y: 0 });
        const xs = -q / (2 * PI * Uq), h = q / (2 * Uq);
        st.add('Half-body (uniform flow + source)', 'ψ = U r sin θ + qθ/(2π);  stagnation x_s = −q/(2πU);  half-width far downstream h = q/(2U)', `U = ${f(Uq)} ${u.V},  q = ${f(q)} ${u.q}`, `x_s = ${f(xs)} ${u.L},  h = ${f(h)} ${u.L},  half-width at the source = ${f(q / (4 * Uq))} ${u.L}`, 'Body surface: r = q(π − θ)/(2πU sin θ).');
        out.push({ k: 'Stagnation point x_s', v: xs, u: u.L, hl: true }, { k: 'Half-width far downstream h', v: h, u: u.L, hl: true }, { k: 'Half-width above the source', v: q / (4 * Uq), u: u.L }, { k: 'Total width 2h', v: 2 * h, u: u.L });
        geom = { body: 'half', q, U: Uq, xs, h };
      } else if (kind === 'oval') {
        if (!(Uq > 0 && q > 0 && a > 0)) return fail(['Enter U, q and the half spacing a, all positive.']);
        els.push({ t: 'U', U: Uq, al: 0 }, { t: 'src', q, x: -a, y: 0 }, { t: 'src', q: -q, x: a, y: 0 });
        const b = sqrt((q * a) / (PI * Uq) + a * a);
        const g = (hh) => Uq * hh - (q / (2 * PI)) * Math.atan2(2 * a * hh, hh * hh - a * a);
        let lo = 1e-9, hi = q / (2 * Uq);
        for (let i = 0; i < 200; i++) { const m = 0.5 * (lo + hi); if (g(m) < 0) lo = m; else hi = m; }
        const h = 0.5 * (lo + hi);
        st.add('Rankine oval (uniform flow + source at −a + sink at +a)', 'b = √(qa/(πU) + a²);  half-width h from h = [(h² − a²)/(2a)] tan(2πUh/q)', `U = ${f(Uq)},  q = ${f(q)},  a = ${f(a)}`, `b = ${f(b)} ${u.L},  h = ${f(h)} ${u.L}`, 'Body: ψ = Uy − (q/2π) tan⁻¹[2ay/(x² + y² − a²)] = 0.');
        out.push({ k: 'Stagnation points ±b', v: b, u: u.L, hl: true }, { k: 'Half-width h', v: h, u: u.L, hl: true }, { k: 'Length 2b', v: 2 * b, u: u.L }, { k: 'Width 2h', v: 2 * h, u: u.L });
        geom = { body: 'oval', q, U: Uq, a, b, h };
      } else if (kind === 'cyl') {
        if (!(Uq > 0 && Rc > 0)) return fail(['Enter U and the cylinder radius.']);
        els.push({ t: 'U', U: Uq, al: 0 }, { t: 'dbl', K: Uq * Rc * Rc, x: 0, y: 0 });
        if (Ga) els.push({ t: 'vtx', G: Ga, x: 0, y: 0 });
        const sn = Ga / (4 * PI * Uq * Rc);
        st.add('Cylinder (uniform flow + doublet' + (Ga ? ' + vortex' : '') + ')', 'v_θ on the surface = −2U sin θ − Γ/(2πa);  stagnation: sin θ = −Γ/(4πUa)', `U = ${f(Uq)},  a = ${f(Rc)},  Γ = ${f(Ga)} ${u.q} (clockwise +)`, abs(sn) <= 1 ? `θ_s = ${f(Math.asin(-sn) / DEG)}° and ${f(180 - Math.asin(-sn) / DEG)}°` : 'the stagnation point leaves the surface (|Γ| > 4πUa)', '');
        out.push({ k: 'Max surface speed (θ = ±90°)', v: Math.max(abs(2 * Uq + Ga / (2 * PI * Rc)), abs(-2 * Uq + Ga / (2 * PI * Rc))), u: u.V, hl: true });
        if (abs(sn) <= 1) out.push({ k: 'Stagnation angle θ₁', v: Math.asin(-sn) / DEG, u: '°', hl: true }, { k: 'Stagnation angle θ₂', v: 180 - Math.asin(-sn) / DEG, u: '°' });
        else { const rs = (Rc * (abs(sn) + sqrt(sn * sn - 1))); out.push({ k: 'Stagnation point below the cylinder at r', v: rs, u: u.L, hl: true }); }
        if (rho > 0) {
          const L = rho * Uq * Ga;
          st.add('Lift per unit length (Kutta–Joukowski)', 'F_L = ρUΓ', `F_L = ${f(rho)} × ${f(Uq)} × ${f(Ga)}`, `F_L = ${f(L)} ${u.F}`, 'Drag is zero in ideal flow (d’Alembert).');
          out.push({ k: 'Lift per unit length F_L', v: L, u: u.F, hl: true }, { k: 'Pressure coefficient at θ = 90° (no circulation)', v: -3, u: '' });
          if (p.Lcyl > 0) out.push({ k: 'Lift on the given length', v: L * p.Lcyl, u: u.SI ? 'N' : 'lb', hl: true });
          if (p.rpm > 0) { const w = (p.rpm * 2 * PI) / 60; st.add('Circulation of a spinning cylinder (no slip)', 'Γ = 2πa(ωa)', `ω = ${f(w)} rad/s`, `Γ = ${f(2 * PI * Rc * Rc * w)} ${u.q}`, 'Ideal-flow estimate; real rotors develop less lift.'); out.push({ k: 'Γ from the spin rate 2πωa²', v: 2 * PI * Rc * Rc * w, u: u.q }); }
        }
        geom = { body: 'cyl', U: Uq, R: Rc, G: Ga, sn };
      } else if (kind === 'vortex') {
        // free, forced or combined (Rankine) vortex
        const vt = p.vt, rc = p.rc;
        let k = NaN, w = NaN;
        if (vt === 'free') { k = p.kBy === 'G' ? Ga / (2 * PI) : p.kv; }
        else if (vt === 'forced') w = p.w;
        else { if (!(rc > 0)) return fail(['Enter the core radius.']); if (p.kBy === 'vmax') { w = p.vmax / rc; } else { k = p.kBy === 'G' ? Ga / (2 * PI) : p.kv; w = k / (rc * rc); } k = w * rc * rc; }
        const vAt = (r) => (vt === 'free' ? k / r : vt === 'forced' ? w * r : r <= rc ? w * r : k / r);
        const pAt = (r) => {
          if (!(rho > 0)) return NaN;
          if (vt === 'free') return -(rho * k * k) / (2 * r * r);
          if (vt === 'forced') return (rho * w * w * r * r) / 2;
          return r >= rc ? -(rho * k * k) / (2 * r * r) : -rho * w * w * rc * rc + (rho * w * w * r * r) / 2;
        };
        const rP = p.vr;
        if (!(rP > 0)) return fail(['Enter the radius where the flow is wanted.']);
        st.add(vt === 'free' ? 'Free vortex' : vt === 'forced' ? 'Forced vortex (rigid rotation)' : 'Combined (Rankine) vortex', vt === 'free' ? 'v_θ = k/r,  k = Γ/(2π);  p = p∞ − ρk²/(2r²)' : vt === 'forced' ? 'v_θ = ωr;  p = p₀ + ρω²r²/2 (p₀ at the centre)' : 'core r ≤ r₀: v_θ = ωr, p = p∞ − ρω²r₀² + ρω²r²/2;  outside: v_θ = k/r, k = ωr₀², p = p∞ − ρk²/(2r²)', vt === 'forced' ? `ω = ${f(w)} rad/s` : `k = ${f(k)} ${u.q}` + (vt === 'comb' ? `,  ω = ${f(w)} rad/s,  r₀ = ${f(rc)} ${u.L}` : ''), `at r = ${f(rP)} ${u.L}: v_θ = ${f(vAt(rP))} ${u.V}` + (rho > 0 ? `,  p = ${f(pAt(rP) / u.pf)} ${u.p} (gage)` : ''), vt === 'forced' ? 'Pressure relative to the centre; the flow is rotational.' : 'Pressure relative to the far field at the same elevation.');
        out.push({ k: 'Tangential speed v_θ', v: vAt(rP), u: u.V, hl: true }, { k: 'Pressure at r (gage)', v: pAt(rP) / u.pf, u: u.p, hl: true });
        if (vt !== 'forced') out.push({ k: 'Vortex constant k = Γ/2π', v: k, u: u.q }, { k: 'Circulation Γ outside the core', v: 2 * PI * k, u: u.q });
        if (vt !== 'free') out.push({ k: 'Angular velocity of the core ω', v: w, u: 'rad/s' });
        if (vt === 'comb') out.push({ k: 'Maximum speed (at r₀)', v: w * rc, u: u.V, hl: true }, { k: 'Pressure at the centre (gage)', v: pAt(0) / u.pf, u: u.p, hl: true }, { k: 'Pressure at r₀ (gage)', v: pAt(rc) / u.pf, u: u.p });
        if (rho > 0 && vt !== 'forced') out.push({ k: 'Pressure head drop at r (air/liquid column)', v: -pAt(rP) / (rho * u.g), u: u.L });
        geom = { body: 'vortex', vt, k, w, rc, rP, vAt, pAt };
        return done(st, out, warn, { cls: 'ok', text: `v_θ = ${f(vAt(rP))} ${u.V} at r = ${f(rP)} ${u.L}` }, Object.assign({ topic, kind }, geom));
      } else if (kind === 'source') {
        if (!q) return fail(['Enter the source (+) or sink (−) strength.']);
        els.push({ t: 'src', q, x: 0, y: 0 });
        if (Ga) els.push({ t: 'vtx', G: Ga, x: 0, y: 0 });
        st.add(Ga ? 'Source/sink with a vortex (spiral flow)' : 'Line source or sink', 'v_r = q/(2πr),  v_θ = −Γ/(2πr) (clockwise +)', `q = ${f(q)},  Γ = ${f(Ga)} ${u.q}`, '', 'Streamlines are rays (or log spirals with a vortex).');
        geom = { body: 'none' };
      } else {
        // custom combination
        if (p.U) els.push({ t: 'U', U: p.U, al: p.al * DEG });
        if (p.q1) els.push({ t: 'src', q: p.q1, x: p.x1, y: p.y1 });
        if (p.q2) els.push({ t: 'src', q: p.q2, x: p.x2, y: p.y2 });
        if (p.G) els.push({ t: 'vtx', G: p.G, x: p.xv, y: p.yv });
        if (p.K) els.push({ t: 'dbl', K: p.K, x: 0, y: 0 });
        if (!els.length) return fail(['Add at least one elementary flow.']);
        st.add('Superposed flow', 'ψ = Σψᵢ, φ = Σφᵢ, V = ΣVᵢ', els.map((e) => (e.t === 'U' ? `uniform U = ${f(e.U)} at ${f(e.al / DEG)}°` : e.t === 'src' ? `${e.q > 0 ? 'source' : 'sink'} ${f(abs(e.q))} at (${f(e.x)}, ${f(e.y)})` : e.t === 'vtx' ? `vortex Γ = ${f(e.G)} at (${f(e.x)}, ${f(e.y)})` : `doublet κ = ${f(e.K)} at the origin`)).join(';  '), '', '');
        geom = { body: 'none' };
      }
      // velocity of the superposed field
      const vel = (Q) => {
        let uu = 0, vv = 0;
        els.forEach((e) => {
          if (e.t === 'U') { uu += e.U * Math.cos(e.al); vv += e.U * Math.sin(e.al); return; }
          const dx = Q.x - e.x, dy = Q.y - e.y, r2 = dx * dx + dy * dy;
          if (e.t === 'src') { uu += (e.q / (2 * PI)) * (dx / r2); vv += (e.q / (2 * PI)) * (dy / r2); }
          else if (e.t === 'vtx') { uu += (e.G / (2 * PI)) * (dy / r2); vv += (-e.G / (2 * PI)) * (dx / r2); } // clockwise positive
          else if (e.t === 'dbl') { uu += -e.K * (dx * dx - dy * dy) / (r2 * r2); vv += -e.K * (2 * dx * dy) / (r2 * r2); }
        });
        return [uu, vv, 0];
      };
      const PA = p.ppol ? { x: p.pr * Math.cos(p.pth * DEG), y: p.pr * Math.sin(p.pth * DEG), z: 0, t: 0 } : { x: p.px, y: p.py, z: 0, t: 0 };
      const v = vel(PA), Vm = hyp(v[0], v[1]);
      if (!isFinite(Vm)) return fail(['The point sits on a singularity (source, sink, vortex or doublet).'], warn, st.list);
      const Uinf = els.filter((e) => e.t === 'U').reduce((s1, e) => s1 + e.U, 0);
      const th = Math.atan2(PA.y, PA.x);
      st.add('Velocity at the point', 'superpose the velocities of each part', `(x, y) = (${f(PA.x)}, ${f(PA.y)}) ${u.L}`, `u = ${f(clean(v[0], Vm))},  v = ${f(clean(v[1], Vm))},  V = ${f(Vm)} ${u.V}`, '');
      out.push({ k: 'u at the point', v: clean(v[0], Vm), u: u.V, hl: true }, { k: 'v at the point', v: clean(v[1], Vm), u: u.V, hl: true }, { k: 'Speed V at the point', v: Vm, u: u.V, hl: true }, { k: 'v_r at the point', v: clean(v[0] * Math.cos(th) + v[1] * Math.sin(th), Vm), u: u.V }, { k: 'v_θ at the point', v: clean(-v[0] * Math.sin(th) + v[1] * Math.cos(th), Vm), u: u.V });
      if (rho > 0 && Uinf > 0) {
        const pp = p.pinf * u.pf + 0.5 * rho * (Uinf * Uinf - Vm * Vm);
        st.add('Pressure at the point (Bernoulli from the free stream)', 'p = p∞ + ½ρ(U² − V²);  C_p = 1 − (V/U)²', `p∞ = ${f(p.pinf)} ${u.p},  ρ = ${f(rho)} ${u.rho}`, `p = ${f(pp / u.pf)} ${u.p},  C_p = ${f(1 - (Vm / Uinf) ** 2)}`, 'Same elevation; the flow is irrotational away from the singular points.');
        out.push({ k: 'Pressure at the point', v: pp / u.pf, u: u.p, hl: true }, { k: 'Pressure coefficient C_p', v: 1 - (Vm / Uinf) ** 2, u: '' });
      }
      return done(st, out, warn, { cls: 'ok', text: `V = ${f(Vm)} ${u.V} at the point` }, Object.assign({ topic, kind, vel, PA, v, els }, geom));
    }
    return fail(['Choose a topic.']);
  }

  Object.assign(P0, { kinematics, kinUnits: units, parseExpr: parse, kinStreamline: streamline });
})(window);
