/* =====================================================================
   physics4.js — 2026-11-25 book-coverage upgrade (Stage 3)
     HP.machine   pumps, turbines, fans and propellers
       char      machine constants: speed factor φ, unit speed / flow /
                 power, specific speed, efficiency, multistage pumps,
                 the same machine under another head; or design a machine
                 from N_s and φ
       homolog   homologous (geometrically similar) machines: any two of
                 D₂, N₂, H₂, Q₂, P₂ give the rest (affinity laws)
       pelton    impulse (Pelton) wheels: jet, wheel size, speed, jets
       impeller  centrifugal pump impeller velocity triangles (Euler head)
       operate   pump curve × system curve: operating point, pumps in
                 series or parallel, a homologous pump's curve
       cavit     cavitation: allowable suction lift (σ or NPSH)
       prop      propeller and fan coefficients, similar propellers
   Same conventions as physics.js: inputs in base units of the chosen
   system (SI: m, m³/s, kPa, kW, kN; EN: ft, ft³/s, psf, ft·lb/s, lb).
   ===================================================================== */
(function (root) {
  'use strict';
  const HP = root.HP;
  const PI = Math.PI, sqrt = Math.sqrt, abs = Math.abs, pow = Math.pow, DEG = PI / 180;
  const fmt = HP.fmt;
  function Out() { return { results: [], steps: [], warnings: [], data: {}, invalid: false }; }
  function R(o, label, value, unit, em) { o.results.push({ label, value, unit: unit || '', em: !!em }); }
  function S(o, t, f, s, r, n, table) { o.steps.push({ t, f, s, r, n, table }); }
  function W(o, text, lvl) { o.warnings.push({ lvl: lvl || 'warn', text }); }
  function fail(o, text) { W(o, text, 'err'); o.invalid = true; return o; }

  // conversions to the English units used by the classic machine constants (Schaum)
  function conv(U) {
    const SI = U.sys === 'SI';
    return {
      SI,
      ft: (L) => (SI ? L * 3.28084 : L), m: (L) => (SI ? L : L * 0.3048), inch: (L) => (SI ? L * 39.3701 : L * 12),
      cfs: (Q) => (SI ? Q * 35.3147 : Q), cms: (Q) => (SI ? Q : Q / 35.3147),
      hp: (raw) => (SI ? raw / 0.7457 : raw / 550), kW: (raw) => (SI ? raw : (raw / 550) * 0.7457),
      fromHp: (hp) => (SI ? hp * 0.7457 : hp * 550), fromKW: (kW) => (SI ? kW : (kW / 0.7457) * 550),
      fromIn: (d) => (SI ? d / 39.3701 : d / 12),
      rho: (Sg) => (SI ? Sg * 1000 : Sg * 1.94),
      F: (F) => (SI ? F * 1000 : F), P: (raw) => (SI ? raw * 1000 : raw), // to N, W (SI) / lb, ft·lb/s (EN)
      Fu: SI ? 'N' : 'lb', Tu: SI ? 'N·m' : 'lb·ft'
    };
  }
  const nsT = (N, Php, Hft) => (N * sqrt(Php)) / pow(Hft, 1.25);
  const nsP = (N, Q, H) => (N * sqrt(Q)) / pow(H, 0.75);

  // monotone piecewise cubic (Fritsch-Carlson) through (xs, ys); linear outside
  function pchip(xs, ys) {
    const n = xs.length, h = [], d = [], m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) { h.push(xs[i + 1] - xs[i]); d.push((ys[i + 1] - ys[i]) / h[i]); }
    if (n === 2) { m[0] = m[1] = d[0]; }
    else {
      m[0] = d[0]; m[n - 1] = d[n - 2];
      for (let i = 1; i < n - 1; i++) {
        if (d[i - 1] * d[i] <= 0) m[i] = 0;
        else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
      }
    }
    return function (x) {
      if (x <= xs[0]) return ys[0] + m[0] * (x - xs[0]);
      if (x >= xs[n - 1]) return ys[n - 1] + m[n - 1] * (x - xs[n - 1]);
      let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
      const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
    };
  }

  HP.machine = function (I, U) {
    const o = Out(), mode = I.mode;
    if (!(I.Sg > 0)) return fail(o, 'The specific gravity of the fluid must be positive.');
    const K = conv(U), gam = I.Sg * U.gw, g = U.g, L = U.L;
    o.data.mode = mode;
    if (mode === 'char') return charMode(o, I, U, K, gam, g, L);
    if (mode === 'homolog') return homolog(o, I, U, K);
    if (mode === 'pelton') return pelton(o, I, U, K, gam, g, L);
    if (mode === 'impeller') return impeller(o, I, U, K, gam, g, L);
    if (mode === 'operate') return operate(o, I, U, K, gam, g, L);
    if (mode === 'cavit') return cavit(o, I, U, K, gam, g, L);
    if (mode === 'prop') return prop(o, I, U, K);
    return fail(o, 'Unknown mode.');
  };

  /* ------------------------------------------------------------------ */
  /* Machine constants                                                   */
  /* ------------------------------------------------------------------ */
  function charMode(o, I, U, K, gam, g, L) {
    const turb = I.mtype === 'turbine', Pu = U.P1u;
    let H = I.H;
    if (I.Hby === 'gauge') {
      H = I.hp + (I.Vin * I.Vin) / (2 * g) + I.zt;
      S(o, 'Effective head on the turbine', 'H = p/γ + V²/2g + z', `H = ${fmt(I.hp)} + ${fmt(I.Vin)}²/(2 × ${fmt(g)}) + ${fmt(I.zt)}`, `${fmt(H)} ${L}`, 'Pressure head and velocity head at the inlet, plus the height of the inlet above the tailwater.');
    }
    if (!(H > 0)) return fail(o, 'The head must be positive.');
    const cH = sqrt(2 * g * H);
    // flow, power, efficiency
    let Q, P, eta;
    const wp = (q) => gam * q * H;
    if (I.flowBy === 'QP') {
      Q = I.Q; P = I.Pw; if (!(Q > 0 && P > 0)) return fail(o, 'Give a positive flow and power.');
      eta = turb ? P / wp(Q) : wp(Q) / P;
      S(o, 'Efficiency', turb ? 'η = P_shaft / γQH' : 'η = γQH / P_shaft', turb ? `η = ${fmt(U.P1(P))} / ${fmt(U.P1(wp(Q)))} ${Pu}` : `η = ${fmt(U.P1(wp(Q)))} / ${fmt(U.P1(P))} ${Pu}`, `${fmt(eta * 100)} %`, `Water power γQH = ${fmt(U.P1(wp(Q)))} ${Pu}.`);
      if (eta > 1) W(o, 'The efficiency comes out above 100 %: check the flow, head and power.');
    } else if (I.flowBy === 'Qe') {
      Q = I.Q; eta = I.eta; if (!(Q > 0 && eta > 0)) return fail(o, 'Give a positive flow and efficiency.');
      P = turb ? eta * wp(Q) : wp(Q) / eta;
      S(o, turb ? 'Shaft power delivered' : 'Shaft power required', turb ? 'P = η γQH' : 'P = γQH / η', `P = ${turb ? fmt(eta) + ' × ' : ''}${fmt(gam)} × ${fmt(Q)} × ${fmt(H)}${turb ? '' : ' / ' + fmt(eta)}`, `${fmt(U.P1(P))} ${Pu} = ${fmt(U.P2(P))} ${U.P2u}`, '');
    } else {
      P = I.Pw; eta = I.eta; if (!(P > 0 && eta > 0)) return fail(o, 'Give a positive power and efficiency.');
      Q = turb ? P / (eta * gam * H) : (P * eta) / (gam * H);
      S(o, 'Flow', turb ? 'Q = P / (η γ H)' : 'Q = η P / (γ H)', turb ? `Q = ${fmt(U.P1(P))} ${Pu} / (${fmt(eta)} × ${fmt(gam)} × ${fmt(H)})` : `Q = ${fmt(eta)} × ${fmt(U.P1(P))} ${Pu} / (${fmt(gam)} × ${fmt(H)})`, `${fmt(Q)} ${U.Q}`, U.sys === 'EN' ? '1 hp = 550 ft·lb/s.' : '');
    }
    const st = Math.max(1, Math.round(+I.stages || 1)), Hs = turb ? H : H / st;
    if (!turb && st > 1) S(o, 'Head per stage', 'H_stage = H / n', `${fmt(H)} / ${st}`, `${fmt(Hs)} ${L}`, `${st} identical impellers in series on one shaft.`);
    // speed
    let N = I.N;
    if (I.Nby === 'Ns') {
      if (turb) {
        const conv = I.nsconv === 'kW' ? { p: K.kW(P), h: K.m(H), t: 'N√P(kW) / H(m)^1.25' } : { p: K.hp(P), h: K.ft(H), t: 'N√P(hp) / H(ft)^1.25' };
        N = (I.Ns * pow(conv.h, 1.25)) / sqrt(conv.p);
        S(o, 'Speed from the specific speed', `N_s = ${conv.t}  →  N = N_s H^1.25 / √P`, `N = ${fmt(I.Ns)} × ${fmt(conv.h)}^1.25 / √${fmt(conv.p)}`, `${fmt(N)} rpm`, '');
      } else {
        const c = I.nsconv === 'gpm' ? { q: K.cfs(Q) * 448.831, h: K.ft(Hs), t: 'N√Q(gpm) / H(ft)^0.75' } : I.nsconv === 'cfs' ? { q: K.cfs(Q), h: K.ft(Hs), t: 'N√Q(cfs) / H(ft)^0.75' } : { q: K.cms(Q), h: K.m(Hs), t: 'N√Q(m³/s) / H(m)^0.75' };
        N = (I.Ns * pow(c.h, 0.75)) / sqrt(c.q);
        S(o, 'Speed from the specific speed', `N_s = ${c.t}  →  N = N_s H^0.75 / √Q`, `N = ${fmt(I.Ns)} × ${fmt(c.h)}^0.75 / √${fmt(c.q)}`, `${fmt(N)} rpm`, st > 1 ? 'H is the head per stage.' : '');
      }
    }
    if (!(N > 0)) return fail(o, 'The speed must be positive.');
    // size
    let D, u, phi;
    if (I.sizeBy === 'D') {
      D = I.D; if (!(D > 0)) return fail(o, 'The diameter must be positive.');
      u = (PI * D * N) / 60; phi = u / cH;
      S(o, 'Peripheral speed and speed factor', 'u = πDN/60,  φ = u / √(2gH)', `u = π × ${fmt(D)} × ${fmt(N)} / 60;  φ = ${fmt(u)} / √(2 × ${fmt(g)} × ${fmt(H)})`, `u = ${fmt(u)} ${U.v},  φ = ${fmt(phi)}`, '');
    } else if (I.sizeBy === 'phi') {
      phi = I.phi; if (!(phi > 0)) return fail(o, 'The speed factor must be positive.');
      u = phi * cH; D = (60 * u) / (PI * N);
      S(o, 'Diameter from the speed factor', 'u = φ√(2gH),  D = 60u / (πN)', `u = ${fmt(phi)} × ${fmt(cH)};  D = 60 × ${fmt(u)} / (π × ${fmt(N)})`, `u = ${fmt(u)} ${U.v},  D = ${fmt(D)} ${L} (${fmt(K.inch(D))} in)`, '');
    } else {
      const Din = (I.Nu * sqrt(K.ft(H))) / N; D = K.fromIn(Din); u = (PI * D * N) / 60; phi = u / cH;
      S(o, 'Diameter from the unit speed', 'N_u = N D(in) / √H(ft)  →  D = N_u √H / N', `D = ${fmt(I.Nu)} × √${fmt(K.ft(H))} / ${fmt(N)}`, `${fmt(Din)} in = ${fmt(D)} ${L}`, 'Schaum’s unit speed: a homologous wheel 1 in across under 1 ft of head.');
    }
    // constants
    const Din = K.inch(D), Hft = K.ft(H), sH = sqrt(Hft), Qc = K.cfs(Q), Php = K.hp(P);
    const Nu = (N * Din) / sH, Qu = Qc / (Din * Din * sH), Puu = Php / (Din * Din * pow(Hft, 1.5));
    S(o, 'Unit values (Schaum: D in inches, H in ft, Q in cfs, P in hp)', 'N_u = N D/√H,  Q_u = Q/(D²√H),  P_u = P/(D² H^1.5)', `D = ${fmt(Din)} in,  H = ${fmt(Hft)} ft,  Q = ${fmt(Qc)} cfs,  P = ${fmt(Php)} hp`, `N_u = ${fmt(Nu)},  Q_u = ${fmt(Qu)},  P_u = ${fmt(Puu)}`, 'Equal for every homologous machine running at the same point.');
    let NsA, NsB, NsC;
    if (turb) {
      NsA = nsT(N, Php, Hft); NsB = (N * sqrt(K.kW(P))) / pow(K.m(H), 1.25);
      S(o, 'Specific speed (turbine)', 'N_s = N√P / H^1.25', `N_s = ${fmt(N)} × √${fmt(Php)} / ${fmt(Hft)}^1.25 (hp, ft)`, `${fmt(NsA)} (hp, ft);  ${fmt(NsB)} (kW, m)`, NsA < 10 ? 'Low N_s: an impulse (Pelton) wheel suits.' : NsA < 100 ? 'Medium N_s: a Francis (reaction) turbine suits.' : 'High N_s: a propeller or Kaplan turbine suits.');
    } else {
      NsA = nsP(N, K.cms(Q), K.m(Hs)); NsB = nsP(N, Qc, K.ft(Hs)); NsC = nsP(N, Qc * 448.831, K.ft(Hs));
      S(o, 'Specific speed (pump)', 'N_s = N√Q / H^0.75', `N_s = ${fmt(N)} × √${fmt(Qc * 448.831)} / ${fmt(K.ft(Hs))}^0.75 (gpm, ft)`, `${fmt(NsC)} (gpm, ft);  ${fmt(NsB)} (cfs, ft);  ${fmt(NsA)} (m³/s, m)`, NsC < 4000 ? 'Radial-flow (centrifugal) impeller range.' : NsC < 9000 ? 'Mixed-flow impeller range.' : 'Axial-flow (propeller) pump range.');
      if (st > 1 || I.showStages) {
        const rows = [];
        for (let k = 1; k <= 6; k++) rows.push([k, fmt(H / k), fmt(nsP(N, Qc * 448.831, K.ft(H / k))), fmt(nsP(N, K.cms(Q), K.m(H / k)))]);
        S(o, 'Specific speed for different numbers of stages', 'N_s = N√Q / (H/n)^0.75', '', '', 'Pick the number of stages that puts N_s where the impeller type is efficient.', { head: ['Stages', `Head per stage (${L})`, 'N_s (gpm, ft)', 'N_s (m³/s, m)'], rows });
      }
    }
    R(o, turb ? 'Shaft power delivered' : 'Shaft power required', U.P1(P), Pu, I.flowBy !== 'QP'); R(o, turb ? 'Shaft power delivered' : 'Shaft power required', U.P2(P), U.P2u);
    R(o, 'Flow Q', Q, U.Q, I.flowBy === 'Pe'); R(o, 'Efficiency η', eta * 100, '%', I.flowBy === 'QP'); R(o, 'Water power γQH', U.P1(wp(Q)), Pu);
    if (I.Hby === 'gauge') R(o, 'Effective head H', H, L, true);
    R(o, 'Speed N', N, 'rpm', I.Nby === 'Ns'); R(o, 'Diameter D', D, L, I.sizeBy !== 'D'); R(o, 'Diameter D', Din, 'in');
    R(o, 'Peripheral speed u', u, U.v); R(o, 'Speed factor φ = u/√(2gH)', phi, '', I.sizeBy === 'D');
    R(o, 'Unit speed N_u (D in, H ft)', Nu, ''); R(o, 'Unit flow Q_u (cfs)', Qu, ''); R(o, 'Unit power P_u (hp)', Puu, '');
    if (turb) { R(o, 'Specific speed N_s (hp, ft)', NsA, '', true); R(o, 'Specific speed N_s (kW, m)', NsB, ''); }
    else { R(o, 'Specific speed N_s (gpm, ft)', NsC, '', true); R(o, 'Specific speed N_s (cfs, ft)', NsB, ''); R(o, 'Specific speed N_s (m³/s, m)', NsA, ''); }
    let H2 = 0, N2, Q2, P2;
    if (I.H2 > 0) {
      H2 = I.H2; const r = H2 / H; N2 = N * sqrt(r); Q2 = Q * sqrt(r); P2 = P * pow(r, 1.5);
      S(o, 'The same machine under another head', 'N ∝ √H,  Q ∝ √H,  P ∝ H^1.5 (same φ and efficiency)', `H₂/H = ${fmt(H2)} / ${fmt(H)} = ${fmt(r)}`, `N₂ = ${fmt(N2)} rpm,  Q₂ = ${fmt(Q2)} ${U.Q},  P₂ = ${fmt(U.P1(P2))} ${Pu}`, 'D is unchanged, so N D/√H, Q/(D²√H) and P/(D²H^1.5) stay constant.');
      R(o, 'Speed under H₂', N2, 'rpm', true); R(o, 'Flow under H₂', Q2, U.Q, true); R(o, 'Power under H₂', U.P1(P2), Pu, true);
    }
    Object.assign(o.data, { kind: 'char', turb, H, Q, P, eta, N, D, u, phi, Ns: turb ? NsA : NsC, stages: st, H2, N2, Q2, P2, cH });
    return o;
  }

  /* ------------------------------------------------------------------ */
  /* Homologous machines (affinity laws)                                 */
  /* ------------------------------------------------------------------ */
  function homolog(o, I, U, K) {
    const Pu = U.P1u, k = I.kn || 'DN', L = U.L;
    const one = { D: I.D1, N: I.N1, H: I.H1, Q: I.Q1, P: I.P1 }, two = { D: I.D2, N: I.N2, H: I.H2, Q: I.Q2, P: I.P2 };
    const rr = I.Sg2 / I.Sg; if (!(rr > 0)) return fail(o, 'Give both specific gravities.');
    const rows = { D: [0, 1], N: [1, 0], H: [2, 2], Q: [1, 3], P: [3, 5] };
    const ks = [k[0], k[1]];
    for (const c of ks) { if (!(one[c] > 0) || !(two[c] > 0)) return fail(o, `Give a positive ${c} for both machines.`); }
    const eq = ks.map((c) => [rows[c][0], rows[c][1], Math.log(two[c] / one[c]) - (c === 'P' ? Math.log(rr) : 0)]);
    const det = eq[0][0] * eq[1][1] - eq[0][1] * eq[1][0];
    if (abs(det) < 1e-12) return fail(o, 'These two quantities do not fix the second machine.');
    const n = (eq[0][2] * eq[1][1] - eq[0][1] * eq[1][2]) / det, d = (eq[0][0] * eq[1][2] - eq[0][2] * eq[1][0]) / det;
    const rN = Math.exp(n), rD = Math.exp(d), rH = rN * rN * rD * rD, rQ = rN * pow(rD, 3), rP = rr * pow(rN, 3) * pow(rD, 5);
    S(o, 'Affinity laws for homologous machines', 'Q ∝ N D³,   H ∝ N² D²,   P ∝ ρ N³ D⁵', `known: ${ks.map((c) => `${c}₂/${c}₁ = ${fmt(two[c] / one[c])}`).join(',  ')}${abs(rr - 1) > 1e-9 ? `;  ρ₂/ρ₁ = ${fmt(rr)}` : ''}`, `N₂/N₁ = ${fmt(rN)},  D₂/D₁ = ${fmt(rD)}`, 'Solved together in logarithms: each law is linear in ln N and ln D. Same φ, specific speed and efficiency for both.');
    const r = { D: rD, N: rN, H: rH, Q: rQ, P: rP }, v2 = {};
    Object.keys(r).forEach((c) => (v2[c] = one[c] > 0 ? one[c] * r[c] : NaN));
    const u = { D: L, N: 'rpm', H: L, Q: U.Q, P: Pu }, nm = { D: 'Diameter D₂', N: 'Speed N₂', H: 'Head H₂', Q: 'Flow Q₂', P: 'Power P₂' };
    S(o, 'Second machine', 'H₂ = H₁(N₂/N₁)²(D₂/D₁)²,  Q₂ = Q₁(N₂/N₁)(D₂/D₁)³,  P₂ = P₁(ρ₂/ρ₁)(N₂/N₁)³(D₂/D₁)⁵', `H₂/H₁ = ${fmt(rH)},  Q₂/Q₁ = ${fmt(rQ)},  P₂/P₁ = ${fmt(rP)}`, ['D', 'N', 'H', 'Q', 'P'].filter((c) => isFinite(v2[c])).map((c) => `${c}₂ = ${fmt(c === 'P' ? U.P1(v2[c]) : v2[c])} ${u[c]}`).join(',  '), '');
    ['D', 'N', 'H', 'Q', 'P'].forEach((c) => { if (isFinite(v2[c])) R(o, nm[c], c === 'P' ? U.P1(v2[c]) : v2[c], u[c], !ks.includes(c)); });
    R(o, 'D₂/D₁', rD, '', !ks.includes('D')); R(o, 'N₂/N₁', rN, ''); R(o, 'H₂/H₁', rH, ''); R(o, 'Q₂/Q₁', rQ, ''); R(o, 'P₂/P₁', rP, '');
    if (one.N > 0 && one.H > 0 && one.P > 0) R(o, 'Specific speed (turbine, hp ft) of both', nsT(one.N, K.hp(one.P), K.ft(one.H)), '');
    if (one.N > 0 && one.H > 0 && one.Q > 0) R(o, 'Specific speed (pump, gpm ft) of both', nsP(one.N, K.cfs(one.Q) * 448.831, K.ft(one.H)), '');
    Object.assign(o.data, { kind: 'homolog', one, two: v2, r, ks });
    return o;
  }

  /* ------------------------------------------------------------------ */
  /* Impulse (Pelton) wheel                                              */
  /* ------------------------------------------------------------------ */
  function pelton(o, I, U, K, gam, g, L) {
    const H = I.H, Pu = U.P1u, giv = I.pgiv;
    if (!(H > 0)) return fail(o, 'The effective head must be positive.');
    const cH = sqrt(2 * g * H), Vj = I.cv * cH, u = I.phi * cH;
    S(o, 'Jet velocity and bucket speed', 'V_j = c_v√(2gH),  u = φ√(2gH)', `√(2 × ${fmt(g)} × ${fmt(H)}) = ${fmt(cH)}`, `V_j = ${fmt(Vj)} ${U.v},  u = ${fmt(u)} ${U.v}`, `u/V_j = ${fmt(u / Vj)} (about 0.45–0.47 at best efficiency).`);
    let Q, P, eta = I.eta, N, D, d, nj = Math.max(1, Math.round(+I.nj || 1)), ratio;
    const Pfrom = (q) => eta * gam * q * H, Qfrom = (p) => p / (eta * gam * H);
    const dOf = (q, n) => sqrt((4 * (q / n)) / (PI * Vj));
    if (giv === 'dPr') {
      d = I.dj; ratio = I.ratio; if (!(d > 0 && ratio > 0 && I.Pw > 0)) return fail(o, 'Give the jet diameter, D/d and the power.');
      P = I.Pw; Q = nj * ((PI * d * d) / 4) * Vj; eta = P / (gam * Q * H);
      S(o, 'Flow from the jet', 'Q = n (πd²/4) V_j', `Q = ${nj} × π(${fmt(d)})²/4 × ${fmt(Vj)}`, `${fmt(Q)} ${U.Q}`, '');
      S(o, 'Efficiency', 'η = P / γQH', `η = ${fmt(U.P1(P))} / ${fmt(U.P1(gam * Q * H))} ${Pu}`, `${fmt(eta * 100)} %`, '');
      if (eta > 1) W(o, 'The efficiency comes out above 100 %: the jet is too small for this power.');
      D = ratio * d; N = (60 * u) / (PI * D);
    } else {
      if (giv === 'QN') { Q = I.Q; P = Pfrom(Q); S(o, 'Power delivered', 'P = η γ Q H', `P = ${fmt(eta)} × ${fmt(gam)} × ${fmt(Q)} × ${fmt(H)}`, `${fmt(U.P1(P))} ${Pu}`, ''); }
      else { P = I.Pw; Q = Qfrom(P); S(o, 'Flow needed', 'Q = P / (η γ H)', `Q = ${fmt(U.P1(P))} ${Pu} / (${fmt(eta)} × ${fmt(gam)} × ${fmt(H)})`, `${fmt(Q)} ${U.Q}`, U.sys === 'EN' ? '1 hp = 550 ft·lb/s.' : ''); }
      if (!(Q > 0 && P > 0)) return fail(o, 'Give a positive power or flow.');
      if (giv === 'Pr') {
        ratio = I.ratio; d = dOf(Q, nj); D = ratio * d; N = (60 * u) / (PI * D);
      } else {
        N = I.N; if (!(N > 0)) return fail(o, 'The speed must be positive.');
        D = (60 * u) / (PI * N);
        if (giv === 'PNr') {
          ratio = I.ratio; d = D / ratio; const qj = ((PI * d * d) / 4) * Vj, need = Q / qj; nj = Math.max(1, Math.ceil(need - 0.03));
          S(o, 'Number of jets', 'd = D / (D/d),  n = Q / [(πd²/4) V_j]', `d = ${fmt(D)} / ${fmt(ratio)} = ${fmt(d)};  n = ${fmt(Q)} / ${fmt(qj)}`, `${fmt(need)} → use ${nj} jet${nj > 1 ? 's' : ''}`, '');
        } else { d = dOf(Q, nj); ratio = D / d; }
      }
    }
    if (giv !== 'PNr' && giv !== 'dPr') S(o, 'Jet diameter', `d = √(4(Q/n) / (πV_j))`, `d = √(4 × ${fmt(Q / nj)} / (π × ${fmt(Vj)}))`, `${fmt(d)} ${L} = ${fmt(K.inch(d))} in`, nj > 1 ? `${nj} jets share the flow.` : '');
    S(o, 'Wheel diameter and speed', 'u = πDN/60', giv === 'PN' || giv === 'PNr' || giv === 'QN' ? `D = 60 × ${fmt(u)} / (π × ${fmt(N)})` : `D = ${fmt(ratio)} × ${fmt(d)};  N = 60 × ${fmt(u)} / (π × ${fmt(D)})`, `D = ${fmt(D)} ${L} (${fmt(K.inch(D))} in),  N = ${fmt(N)} rpm`, `D/d = ${fmt(D / d)} (usually 10 to 20 or more).`);
    const NsA = nsT(N, K.hp(P), K.ft(H)), NsJ = nsT(N, K.hp(P / nj), K.ft(H));
    S(o, 'Specific speed', 'N_s = N√P / H^1.25 (hp, ft)', `N_s = ${fmt(N)} × √${fmt(K.hp(P))} / ${fmt(K.ft(H))}^1.25`, `${fmt(NsA)}${nj > 1 ? ` (${fmt(NsJ)} per jet)` : ''}`, 'Impulse wheels work best near N_s = 2 to 6 per jet.');
    // synchronous speeds near N (60 Hz)
    const pairs = Math.max(1, Math.round(3600 / N)), sy = [pairs - 1, pairs, pairs + 1].filter((p) => p >= 1).map((p) => `${p} pairs: ${fmt(3600 / p)} rpm`);
    S(o, 'Nearest synchronous speeds (60 Hz generator)', 'N = 7200 / (2 × pole pairs)', '', sy.join(';  '), 'The wheel speed is usually matched to one of these, and D recomputed.');
    let pb;
    if (I.Db > 0) {
      const Vb = Q / nj / ((PI * I.Db * I.Db) / 4); pb = H - (Vb * Vb) / (2 * g);
      S(o, 'Pressure head at the nozzle base', 'H = p/γ + V²/2g  →  p/γ = H − V_b²/2g', `V_b = ${fmt(Q / nj)} / (π(${fmt(I.Db)})²/4) = ${fmt(Vb)};  p/γ = ${fmt(H)} − ${fmt((Vb * Vb) / (2 * g))}`, `${fmt(pb)} ${L}  (p = ${fmt(pb * gam)} ${U.p})`, 'The effective head is measured at the nozzle base.');
    }
    R(o, 'Flow Q', Q, U.Q, giv !== 'QN' && giv !== 'dPr'); R(o, 'Jet diameter d', d, L, giv !== 'dPr'); R(o, 'Jet diameter d', K.inch(d), 'in');
    R(o, 'Wheel diameter D', D, L, true); R(o, 'Wheel diameter D', K.inch(D), 'in'); R(o, 'Speed N', N, 'rpm', giv === 'Pr' || giv === 'dPr');
    if (giv === 'PNr') R(o, 'Number of jets', nj, '', true);
    R(o, 'Power delivered', U.P1(P), Pu, giv === 'QN'); R(o, 'Efficiency η', eta * 100, '%', giv === 'dPr');
    R(o, 'Jet velocity V_j', Vj, U.v); R(o, 'Bucket speed u', u, U.v); R(o, 'D/d', D / d, ''); R(o, 'Specific speed N_s (hp, ft)', NsA, '');
    if (pb !== undefined) R(o, 'Pressure head at the nozzle base', pb, L, true);
    Object.assign(o.data, { kind: 'pelton', D, d, N, u, Vj, nj, Q, P, H });
    return o;
  }

  /* ------------------------------------------------------------------ */
  /* Centrifugal pump impeller: velocity triangles                       */
  /* ------------------------------------------------------------------ */
  function impeller(o, I, U, K, gam, g, L) {
    const N = I.N, w = (2 * PI * N) / 60, r1 = I.D1 / 2, r2 = I.D2 / 2, u1 = w * r1, u2 = w * r2, rho = K.rho(I.Sg);
    if (!(N > 0 && I.D2 > 0)) return fail(o, 'Give the speed and the outer diameter.');
    if (!(I.D1 < I.D2)) return fail(o, 'The inner diameter must be smaller than the outer diameter.');
    const A1 = I.aBy === 'width' ? PI * I.D1 * I.b1 : I.A1, A2 = I.aBy === 'width' ? PI * I.D2 * I.b2 : I.A2;
    const b1 = I.beta1 * DEG, b2 = I.beta2 * DEG, a1 = I.alpha1 * DEG;
    S(o, 'Blade speeds', 'u = ωr = πDN/60', `u₁ = π × ${fmt(I.D1)} × ${fmt(N)}/60,  u₂ = π × ${fmt(I.D2)} × ${fmt(N)}/60`, `u₁ = ${fmt(u1)},  u₂ = ${fmt(u2)} ${U.v}`, I.aBy === 'width' ? `Flow areas A = πDb: A₁ = ${fmt(A1)}, A₂ = ${fmt(A2)} ${U.A}.` : '');
    let Q, Vr1, Vu1, v1;
    if (I.qBy === 'beta1') {
      if (!(A1 > 0)) return fail(o, 'Give the inlet flow area to find the flow from the inlet blade angle.');
      if (abs(I.alpha1 - 90) < 1e-6) { v1 = -u1 / Math.cos(b1); }
      else { const ta = Math.tan(a1); v1 = (u1 * ta) / (Math.sin(b1) - Math.cos(b1) * ta); }
      if (!(v1 > 0)) return fail(o, 'With this inlet blade angle the water cannot enter shock-free (radial entry needs β₁ above 90° in this convention).');
      Vr1 = v1 * Math.sin(b1); Vu1 = u1 + v1 * Math.cos(b1); Q = Vr1 * A1;
      S(o, 'Inlet triangle (flow follows the blade)', abs(I.alpha1 - 90) < 1e-6 ? 'radial entry: V₁ = V_r1,  v₁ cos β₁ = −u₁' : 'V_r1 = v₁ sin β₁,  V_u1 = u₁ + v₁ cos β₁,  V_r1 = V_u1 tan α₁', `v₁ = ${fmt(v1)} ${U.v}`, `V_r1 = ${fmt(Vr1)} ${U.v},  Q = V_r1 A₁ = ${fmt(Q)} ${U.Q}`, '');
    } else {
      Q = I.Q; if (!(Q > 0)) return fail(o, 'The flow must be positive.');
      if (A1 > 0) {
        Vr1 = Q / A1; Vu1 = abs(I.alpha1 - 90) < 1e-6 ? 0 : Vr1 / Math.tan(a1); v1 = Math.hypot(Vr1, Vu1 - u1);
        const bf = Math.atan2(Vr1, Vu1 - u1) / DEG;
        S(o, 'Inlet triangle', 'V_r1 = Q/A₁,  V_u1 = V_r1 / tan α₁,  v₁ = √(V_r1² + (u₁ − V_u1)²)', `V_r1 = ${fmt(Q)}/${fmt(A1)}`, `V_r1 = ${fmt(Vr1)},  v₁ = ${fmt(v1)} ${U.v},  relative flow angle ${fmt(bf)}°`, abs(bf - I.beta1) > 2 ? `The blade angle is ${fmt(I.beta1)}°: the water meets the blade with some shock.` : 'The water enters along the blade.');
      } else { Vr1 = 0; Vu1 = 0; v1 = NaN; }
    }
    let Vr2, v2;
    if (!(A2 > 0)) return fail(o, 'Give the exit flow area.');
    if (I.a2n) { v2 = Q / A2; Vr2 = v2 * Math.sin(b2); S(o, 'Exit: relative velocity', 'A₂ measured normal to v₂:  v₂ = Q/A₂', `v₂ = ${fmt(Q)}/${fmt(A2)}`, `${fmt(v2)} ${U.v}`, ''); }
    else { Vr2 = Q / A2; v2 = Vr2 / Math.sin(b2); S(o, 'Exit: radial and relative velocity', 'V_r2 = Q/A₂,  v₂ = V_r2 / sin β₂', `V_r2 = ${fmt(Q)}/${fmt(A2)}`, `V_r2 = ${fmt(Vr2)},  v₂ = ${fmt(v2)} ${U.v}`, ''); }
    const Vu2 = u2 + v2 * Math.cos(b2), V2 = Math.hypot(Vr2, Vu2), a2 = Math.atan2(Vr2, Vu2) / DEG;
    S(o, 'Exit triangle', 'V_u2 = u₂ + v₂ cos β₂,  V₂ = √(V_r2² + V_u2²)', `V_u2 = ${fmt(u2)} + ${fmt(v2)} × cos ${fmt(I.beta2)}°`, `V_u2 = ${fmt(Vu2)},  V₂ = ${fmt(V2)} ${U.v},  α₂ = ${fmt(a2)}°`, 'β measured from the direction of blade motion; β₂ > 90° is a backward-curved blade.');
    const Hi = (u2 * Vu2 - u1 * Vu1) / g;
    S(o, 'Head given to the water (Euler)', "H' = (u₂V_u2 − u₁V_u1) / g", `H' = (${fmt(u2)} × ${fmt(Vu2)} − ${fmt(u1)} × ${fmt(Vu1)}) / ${fmt(g)}`, `${fmt(Hi)} ${L}`, 'From the angular momentum of the flow (Schaum 14.1, 14.4).');
    const loss = (I.kv * v2 * v2) / (2 * g) + (I.kV * V2 * V2) / (2 * g), Hd = Hi - loss;
    if (loss > 0) S(o, 'Losses and head delivered', "H = H' − k_v v₂²/2g − k_V V₂²/2g", `H = ${fmt(Hi)} − ${fmt(I.kv)} × ${fmt((v2 * v2) / (2 * g))} − ${fmt(I.kV)} × ${fmt((V2 * V2) / (2 * g))}`, `${fmt(Hd)} ${L},  efficiency ${fmt((100 * Hd) / Hi)} %`, 'Impeller loss on the relative velocity, exit loss on the absolute velocity.');
    const Pin = gam * Q * Hi, T = rho * Q * (r2 * Vu2 - r1 * Vu1);
    S(o, 'Power and torque', "P = γQH',  T = ρQ(r₂V_u2 − r₁V_u1)", `P = ${fmt(gam)} × ${fmt(Q)} × ${fmt(Hi)}`, `${fmt(U.P1(Pin))} ${U.P1u} = ${fmt(U.P2(Pin))} ${U.P2u},  T = ${fmt(T)} ${K.Tu}`, '');
    R(o, "Euler head H'", Hi, L, true); if (loss > 0) { R(o, 'Head delivered H', Hd, L, true); R(o, 'Hydraulic efficiency', (100 * Hd) / Hi, '%', true); }
    R(o, 'Power given to the water', U.P1(Pin), U.P1u, true); R(o, 'Power given to the water', U.P2(Pin), U.P2u); R(o, 'Torque on the impeller', T, K.Tu);
    R(o, 'Flow Q', Q, U.Q, I.qBy === 'beta1'); R(o, 'u₁', u1, U.v); R(o, 'u₂', u2, U.v);
    if (isFinite(v1)) { R(o, 'Relative velocity at entrance v₁', v1, U.v, I.qBy === 'beta1'); R(o, 'Radial velocity V_r1', Vr1, U.v); }
    R(o, 'Relative velocity at exit v₂', v2, U.v, true); R(o, 'Absolute velocity at exit V₂', V2, U.v, true); R(o, 'Whirl component V_u2', Vu2, U.v); R(o, 'Radial component V_r2', Vr2, U.v); R(o, 'Exit flow angle α₂', a2, '°');
    // ideal head-flow line through Q
    const hq = (q) => (u2 * (u2 + v2 * (q / Q) * Math.cos(b2)) - u1 * Vu1 * (q / Q)) / g; // velocities scale with the flow
    const qs = [], hs = []; for (let i = 0; i <= 40; i++) { const q = (2 * Q * i) / 40; qs.push(q); hs.push(hq(q)); }
    Object.assign(o.data, { kind: 'impeller', u1, u2, Vr1, Vu1, v1, Vr2, Vu2, v2, V2, a2, b1: I.beta1, b2: I.beta2, D1: I.D1, D2: I.D2, Q, Hi, Hd, N, curve: { qs, hs } });
    return o;
  }

  /* ------------------------------------------------------------------ */
  /* Operating point: pump curve and system curve                        */
  /* ------------------------------------------------------------------ */
  function operate(o, I, U, K, gam, g, L) {
    const n = Math.max(2, Math.min(6, Math.round(+I.npts || 5)));
    const pts = []; for (let i = 1; i <= n; i++) pts.push([I['pq' + i], I['ph' + i], I['pe' + i]]);
    for (let i = 1; i < n; i++) if (!(pts[i][0] > pts[i - 1][0])) return fail(o, 'List the pump curve points with increasing flow.');
    if (pts.some((p) => !(p[0] >= 0) || !(p[1] >= 0))) return fail(o, 'Flows and heads on the pump curve must not be negative.');
    const rN = I.Nn / I.Nt, rD = I.rD; if (!(rN > 0 && rD > 0)) return fail(o, 'Give the test and running speeds and the diameter ratio.');
    const sq = rN * pow(rD, 3), sh = rN * rN * rD * rD;
    const qs = pts.map((p) => p[0] * sq), hs = pts.map((p) => p[1] * sh), hasE = pts.every((p, i) => p[2] > 0 || p[0] === 0), es = pts.map((p) => p[2] / 100);
    if (abs(sq - 1) > 1e-9 || abs(sh - 1) > 1e-9) S(o, 'Pump curve at the running speed and size', 'Q′ = Q (N₂/N₁)(D₂/D₁)³,  H′ = H (N₂/N₁)²(D₂/D₁)²,  η unchanged', `Q × ${fmt(sq)},  H × ${fmt(sh)}`, '', 'Each test point moves to its homologous point.', { head: [`Q test (${U.Q})`, `H test (${L})`, 'η', `Q′ (${U.Q})`, `H′ (${L})`], rows: pts.map((p, i) => [fmt(p[0]), fmt(p[1]), p[2] > 0 ? fmt(p[2]) + ' %' : '—', fmt(qs[i]), fmt(hs[i])]) });
    const Hp = pchip(qs, hs), Ep = hasE ? pchip(qs, es) : null;
    const np = Math.max(1, Math.round(+I.np || 1)), arr = np > 1 ? I.arr : 'single';
    const Hc = (q) => (arr === 'series' ? np * Hp(q) : arr === 'parallel' ? Hp(q / np) : Hp(q));
    const qOne = (q) => (arr === 'parallel' ? q / np : q), hOne = (h) => (arr === 'series' ? h / np : h);
    const qMaxC = (arr === 'parallel' ? np : 1) * qs[n - 1];
    let Hsys, sysTxt;
    if (I.sysBy === 'pipe') {
      const A = (PI * I.Dp * I.Dp) / 4, kk = (I.fp * I.Lp) / I.Dp + I.Km;
      if (!(A > 0)) return fail(o, 'Give the pipe diameter.');
      Hsys = (q) => I.Hs + (kk * q * q) / (2 * g * A * A);
      sysTxt = `H_sys = ${fmt(I.Hs)} + (${fmt(I.fp)} × ${fmt(I.Lp)}/${fmt(I.Dp)} + ${fmt(I.Km)}) Q²/(2gA²) = ${fmt(I.Hs)} + ${fmt(kk / (2 * g * A * A))} Q²`;
      S(o, 'System curve', 'H_sys = static lift + (fL/D + ΣK) V²/2g', `A = ${fmt(A)} ${U.A}`, sysTxt, 'Head the pump must give at each flow.');
    } else if (I.sysBy === 'k') {
      Hsys = (q) => I.Hs + I.ks * q * q; sysTxt = `H_sys = ${fmt(I.Hs)} + ${fmt(I.ks)} Q²`;
      S(o, 'System curve', 'H_sys = H_static + k Q²', '', sysTxt, '');
    }
    let Q, H;
    if (I.sysBy === 'Q') {
      Q = I.Qop; H = Hc(Q);
      S(o, 'Head at the given flow', 'read H off the pump curve', `Q = ${fmt(Q)} ${U.Q}`, `H = ${fmt(H)} ${L}`, 'Monotone cubic through the curve points.');
    } else {
      const f = (q) => Hc(q) - Hsys(q);
      if (f(0) <= 0) return fail(o, `At zero flow the pump${np > 1 ? 's give' : ' gives'} ${fmt(Hc(0))} ${L}, not more than the system needs (${fmt(Hsys(0))} ${L}): no flow.`);
      let hi = qMaxC; let k = 0; while (f(hi) > 0 && k < 20) { hi *= 1.5; k++; }
      if (f(hi) > 0) return fail(o, 'The pump and system curves do not cross.');
      let lo = 0; for (let it = 0; it < 200; it++) { const m = 0.5 * (lo + hi); if (f(m) > 0) lo = m; else hi = m; }
      Q = 0.5 * (lo + hi); H = Hsys(Q);
      S(o, 'Operating point', 'H_pump(Q) = H_sys(Q)', arr === 'single' ? '' : arr === 'series' ? `${np} pumps in series: heads add at the same flow` : `${np} pumps in parallel: flows add at the same head`, `Q = ${fmt(Q)} ${U.Q},  H = ${fmt(H)} ${L}`, 'Found by bisection where the curves cross.');
    }
    if (Q > qMaxC * 1.0001) W(o, 'The operating point lies beyond the last point of the pump curve: the curve was extended in a straight line.');
    const q1 = qOne(Q), h1 = hOne(H);
    let eta = Ep ? Ep(q1) : I.eta;
    if (!(eta > 0)) eta = I.eta;
    const Pw1 = (gam * q1 * h1) / eta, Pall = Pw1 * np;
    S(o, 'Power', 'P = γ Q H / η (each pump)', `P = ${fmt(gam)} × ${fmt(q1)} × ${fmt(h1)} / ${fmt(eta)}`, `${fmt(U.P1(Pw1))} ${U.P1u} each${np > 1 ? `, ${fmt(U.P1(Pall))} ${U.P1u} in all` : ''}`, Ep ? `η = ${fmt(eta * 100)} % read off the efficiency curve.` : `Efficiency taken as ${fmt(eta * 100)} %.`);
    R(o, 'Flow Q', Q, U.Q, true); R(o, 'Head H', H, L, true); R(o, 'Efficiency η', eta * 100, '%', !!Ep); R(o, 'Power, each pump', U.P1(Pw1), U.P1u, true);
    if (np > 1) { R(o, 'Power, all pumps', U.P1(Pall), U.P1u); R(o, 'Flow through each pump', q1, U.Q); R(o, 'Head of each pump', h1, L); }
    if (!K.SI) R(o, 'Flow Q', Q * 448.831, 'gpm'); else R(o, 'Flow Q', Q * 1000, 'L/s');
    const cq = [], ch = [], cs = [], ce = []; const qTop = Math.max(qMaxC, Q) * 1.1;
    for (let i = 0; i <= 60; i++) { const q = (qTop * i) / 60; cq.push(q); ch.push(Hc(q)); cs.push(Hsys ? Hsys(q) : NaN); ce.push(Ep ? 100 * Ep(qOne(q)) : NaN); }
    Object.assign(o.data, { kind: 'operate', Q, H, eta, np, arr, curve: { cq, ch, cs, ce }, pts: qs.map((q, i) => [q, hs[i]]), single: arr !== 'single' ? cq.map((q) => (q <= qs[n - 1] * 1.05 ? Hp(q) : NaN)) : null, Hs: I.sysBy === 'Q' ? null : Hsys(0) });
    return o;
  }

  /* ------------------------------------------------------------------ */
  /* Cavitation: allowable suction lift                                  */
  /* ------------------------------------------------------------------ */
  function cavit(o, I, U, K, gam, g, L) {
    const turb = I.mtype === 'turbine', ha = I.patm / gam, hv = I.pv / gam;
    S(o, 'Atmospheric and vapour pressure heads', 'h = p / γ', `${fmt(I.patm)} / ${fmt(gam)},  ${fmt(I.pv)} / ${fmt(gam)}`, `p_atm/γ = ${fmt(ha)} ${L},  p_v/γ = ${fmt(hv)} ${L}`, '');
    let need, txt;
    if (I.sigBy === 'sigma') { need = I.sigma * I.H; txt = `σ_c H = ${fmt(I.sigma)} × ${fmt(I.H)}`; }
    else { need = I.npsh; txt = `NPSH_R = ${fmt(I.npsh)}`; }
    const zmax = ha - hv - I.hLs - need;
    S(o, turb ? 'Highest runner setting above the tailwater' : 'Highest pump setting above the supply surface', turb ? 'z_max = p_atm/γ − p_v/γ − σ_c H (Thoma)' : 'z_max = p_atm/γ − p_v/γ − h_L,suction − NPSH_R', `z_max = ${fmt(ha)} − ${fmt(hv)} − ${fmt(I.hLs)} − ${fmt(need)}  (${txt})`, `${fmt(zmax)} ${L}`, zmax < 0 ? 'Negative: the machine must sit below the water surface.' : '');
    const npa = ha - hv - I.zs - I.hLs, sa = I.H > 0 ? npa / I.H : NaN;
    S(o, 'At the actual setting z_s', 'NPSH_A = p_atm/γ − p_v/γ − z_s − h_L,  σ = NPSH_A / H', `NPSH_A = ${fmt(ha)} − ${fmt(hv)} − ${fmt(I.zs)} − ${fmt(I.hLs)}`, `NPSH_A = ${fmt(npa)} ${L}${isFinite(sa) ? `,  σ = ${fmt(sa)}` : ''}`, npa >= need ? 'Enough margin: no cavitation expected.' : 'Too little margin: cavitation expected.');
    if (npa < need) W(o, `Cavitation: the available NPSH (${fmt(npa)} ${L}) is below the ${I.sigBy === 'sigma' ? 'critical σH' : 'required NPSH'} (${fmt(need)} ${L}). Lower the machine by at least ${fmt(need - npa)} ${L}.`, 'err');
    R(o, 'Highest setting z_max', zmax, L, true); R(o, 'NPSH available at z_s', npa, L, true); R(o, I.sigBy === 'sigma' ? 'σ_c H' : 'NPSH required', need, L);
    if (isFinite(sa)) R(o, 'Plant σ at z_s', sa, '');
    R(o, 'Margin', npa - need, L);
    Object.assign(o.data, { kind: 'cavit', turb, ha, hv, need, zmax, zs: I.zs, npa, hLs: I.hLs });
    return o;
  }

  /* ------------------------------------------------------------------ */
  /* Propeller and fan coefficients                                      */
  /* ------------------------------------------------------------------ */
  function prop(o, I, U, K) {
    const rho = K.rho(I.Sg), D = I.Dpr, n = I.N / 60, F = K.F(I.Fp), P = K.P(I.Pw), V = I.V;
    if (!(D > 0 && n > 0)) return fail(o, 'Give the diameter and the speed.');
    S(o, 'Density and speed in revolutions per second', 'ρ = Sg ρ_w,  n = N/60', '', `ρ = ${fmt(rho)} ${K.SI ? 'kg/m³' : 'slug/ft³'},  n = ${fmt(n)} rev/s`, '');
    const J = V / (n * D), CF = F / (rho * n * n * pow(D, 4)), CP = P / (rho * pow(n, 3) * pow(D, 5)), T = P > 0 ? P / (2 * PI * n) : 0, CT = T / (rho * n * n * pow(D, 5)), eta = P > 0 ? (F * V) / P : NaN;
    S(o, 'Coefficients', 'C_F = F/(ρn²D⁴),  C_P = P/(ρn³D⁵),  C_T = T/(ρn²D⁵),  J = V/(nD)', `C_F = ${fmt(F)} / (${fmt(rho)} × ${fmt(n)}² × ${fmt(D)}⁴)${P > 0 ? `;  C_P = ${fmt(P)} / (${fmt(rho)} × ${fmt(n)}³ × ${fmt(D)}⁵)` : ''}`, `C_F = ${fmt(CF)}${P > 0 ? `,  C_P = ${fmt(CP)},  C_T = ${fmt(CT)}` : ''},  J = ${fmt(J)}`, 'Dimensionless with n in rev/s (Schaum 14.19–14.21).');
    if (P > 0 && V > 0 && eta > 1) W(o, 'Thrust × speed is more than the power absorbed (η above 100 %): check the thrust, speed and power.');
    if (P > 0 && V > 0) S(o, 'Propeller efficiency', 'η = F V / P', `η = ${fmt(F)} × ${fmt(V)} / ${fmt(P)}`, `${fmt(eta * 100)} %`, '');
    R(o, 'Thrust coefficient C_F', CF, '', true); if (P > 0) { R(o, 'Power coefficient C_P', CP, '', true); R(o, 'Torque coefficient C_T', CT, ''); R(o, 'Torque T', T, K.Tu); }
    R(o, 'Advance ratio J = V/(nD)', J, ''); if (isFinite(eta) && V > 0) R(o, 'Efficiency η = FV/P', eta * 100, '%');
    let two = null;
    if (I.sim !== 'none') {
      const rho2 = K.rho(I.Sg2);
      let D2, n2, V2;
      if (I.sim === 'VF') {
        V2 = I.V2; const F2 = K.F(I.F2);
        if (!(V2 > 0 && F2 > 0 && V > 0 && F > 0)) return fail(o, 'Give V and F for both propellers.');
        D2 = D * (V / V2) * sqrt((F2 * rho) / (F * rho2)); n2 = V2 / (J * D2);
        S(o, 'Similar propeller from its speed and thrust', 'same J and C_F  →  F ∝ ρV²D²,  n = V/(JD)', `D₂ = ${fmt(D)} × (${fmt(V)}/${fmt(V2)}) × √(${fmt(F2)} ρ₁ / (${fmt(F)} ρ₂))`, `D₂ = ${fmt(D2)} ${U.L},  N₂ = ${fmt(n2 * 60)} rpm`, '');
      } else {
        D2 = I.D2p; n2 = I.N2 / 60; if (!(D2 > 0 && n2 > 0)) return fail(o, 'Give D and N for the second propeller.');
        V2 = J * n2 * D2;
        S(o, 'Similar propeller from its size and speed', 'same J:  V₂ = J n₂ D₂', `V₂ = ${fmt(J)} × ${fmt(n2)} × ${fmt(D2)}`, `${fmt(V2)} ${U.v}`, '');
      }
      const F2 = CF * rho2 * n2 * n2 * pow(D2, 4), P2 = CP * rho2 * pow(n2, 3) * pow(D2, 5);
      S(o, 'Thrust and power of the similar propeller', 'F₂ = C_F ρ₂ n₂² D₂⁴,  P₂ = C_P ρ₂ n₂³ D₂⁵', '', `F₂ = ${fmt(F2)} ${K.Fu}${P > 0 ? `,  P₂ = ${fmt(U.P1(K.SI ? P2 / 1000 : P2))} ${U.P1u}` : ''}`, '');
      R(o, 'Second propeller: diameter', D2, U.L, I.sim === 'VF'); R(o, 'Second propeller: speed', n2 * 60, 'rpm', I.sim === 'VF'); R(o, 'Second propeller: advance speed', V2, U.v, I.sim === 'DN');
      R(o, 'Second propeller: thrust', F2, K.Fu, I.sim === 'DN'); if (P > 0) R(o, 'Second propeller: power', U.P1(K.SI ? P2 / 1000 : P2), U.P1u, true);
      two = { D: D2, N: n2 * 60, V: V2, F: F2 };
    }
    Object.assign(o.data, { kind: 'prop', D, N: I.N, V, F, P, CF, CP, J, eta, two, Fu: K.Fu });
    return o;
  }
})(window);
