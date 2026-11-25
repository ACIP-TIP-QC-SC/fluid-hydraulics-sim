/* =====================================================================
 * App shell: tabs, global toggles, render loop, results & solution panel.
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Physics, UI } = root;
  const { h } = UI;
  const $ = (id) => document.getElementById(id);

  const App = {
    units: 'SI', view: '2d', showP: true, active: 'mf', res: null,
    modules: { mf: root.MF, mv: root.MV, mp: root.MP, m1: root.M1, md: root.MD, m2: root.M2, m3: root.M3, mj: root.MJ },
    U() { return Physics.UNITS[this.units]; },
    mod() { return this.modules[this.active]; },
  };
  root.App = App;
  const view3d = new root.View3D($('cv3d'));
  const C = UI.Controls(App);

  function buildTabs() {
    const t = $('tabs'); t.innerHTML = '';
    Object.values(App.modules).forEach((m, i) => {
      t.append(h('button', { type: 'button', role: 'tab', 'aria-selected': App.active === m.id ? 'true' : 'false', onclick: () => { App.active = m.id; buildTabs(); App.rebuild(); } }, h('span', { class: 'n' }, String(i + 1)), m.title));
      if (App.active === m.id) $('modTitle').textContent = `${i + 1}. ${m.title}`;
    });
  }
  function buildExamples() {
    const sel = $('examples'); sel.innerHTML = '';
    sel.append(h('option', { value: '' }, 'Load example / test case…'));
    App.mod().presets.forEach((p, i) => sel.append(h('option', { value: i }, p.name)));
  }
  $('examples').addEventListener('change', (e) => {
    const i = e.target.value;
    if (i === '') return;
    const pr = App.mod().presets[+i];
    pr.apply(App.mod().state);
    App.units = pr.units || 'SI'; syncUnits();
    App.rebuild(true);
    e.target.value = i;
  });

  App.rebuild = function (keepExample) {
    const c = $('controls');
    const scroll = $('controlsPanel').scrollTop;
    c.innerHTML = '';
    App.mod().controls(c, C);
    if (!keepExample) { buildExamples(); }
    $('controlsPanel').scrollTop = scroll;
    App.update();
  };

  App.update = function () {
    const U = App.U(), m = App.mod();
    let res;
    try { res = m.compute(U); } catch (e) { console.error(e); res = { ok: false, err: ['Computation error: ' + e.message], warn: [], steps: [], out: [] }; }
    App.res = res;
    renderResults(res, U);
    renderDiagram();
  };

  function renderDiagram() {
    const m = App.mod(), U = App.U(), res = App.res;
    const svg = $('svg2d'), cv = $('cv3d');
    if (App.view === '2d') {
      svg.removeAttribute('hidden'); cv.setAttribute('hidden', '');
      $('resetIso').hidden = true;
      svg.style.cursor = '';
      m.draw2D(svg, res, U, { showP: App.showP });
    } else {
      svg.setAttribute('hidden', ''); cv.removeAttribute('hidden');
      $('resetIso').hidden = false;
      view3d.clear();
      if (res.ok) m.draw3D(view3d, res, U);
      view3d.render();
    }
  }

  function renderResults(res, U) {
    const pill = $('statusPill');
    pill.className = 'pill ' + (res.ok ? (res.status ? res.status.cls : 'ok') : 'bad');
    pill.textContent = res.ok ? (res.status ? res.status.text : 'OK') : '⚠ Invalid state';
    const msgs = $('msgs'); msgs.innerHTML = '';
    (res.err || []).forEach((e) => msgs.append(h('div', { class: 'msg err' }, '⛔ ' + e)));
    (res.warn || []).forEach((w) => msgs.append(h('div', { class: 'msg warn' }, '⚠ ' + w)));
    const t = $('results'); t.innerHTML = '';
    (res.out || []).forEach((o) => t.append(h('tr', { class: o.hl ? 'hl' : '' }, h('td', null, o.k), h('td', { class: 'v' }, Physics.fmt(o.v)), h('td', { class: 'u' }, o.u))));
    const ol = $('steps'); ol.innerHTML = '';
    (res.steps || []).forEach((s) => {
      ol.append(h('li', null,
        h('div', { class: 'st-t' }, s.t),
        s.n ? h('div', { class: 'st-n' }, s.n) : null,
        s.f ? h('div', { class: 'st-f' }, s.f) : null,
        s.s ? h('div', { class: 'st-s' }, s.s) : null,
        s.r ? h('div', { class: 'st-r' }, '⇒ ' + s.r) : null));
    });
  }

  $('copySol').addEventListener('click', async () => {
    const res = App.res; if (!res) return;
    const m = App.mod(), U = App.U();
    let txt = `Hydraulics and Principles of Geotechnical Engineering (HPGE) Calculator by CEM Jumawan — Fluid Mechanics: ${m.title} (${U.id} units)\n\n`;
    (res.err || []).forEach((e) => (txt += `ERROR: ${e}\n`));
    (res.warn || []).forEach((e) => (txt += `WARNING: ${e}\n`));
    txt += 'RESULTS\n';
    (res.out || []).forEach((o) => (txt += `  ${o.k}: ${Physics.fmt(o.v)} ${o.u}\n`));
    txt += '\nSOLUTION\n';
    (res.steps || []).forEach((s, i) => {
      txt += `${i + 1}. ${s.t}\n`;
      if (s.n) txt += `   (${s.n})\n`;
      if (s.f) txt += `   ${s.f}\n`;
      if (s.s) txt += `   ${s.s}\n`;
      if (s.r) txt += `   => ${s.r}\n`;
    });
    const btn = $('copySol');
    try { await navigator.clipboard.writeText(txt); btn.textContent = 'Copied ✓'; }
    catch (e) {
      const ta = h('textarea', { style: { position: 'fixed', opacity: 0 } }); ta.value = txt; document.body.append(ta); ta.select();
      try { document.execCommand('copy'); btn.textContent = 'Copied ✓'; } catch (e2) { btn.textContent = 'Copy failed'; }
      ta.remove();
    }
    setTimeout(() => (btn.textContent = 'Copy solution'), 1500);
  });

  function syncUnits() { $('uSI').setAttribute('aria-pressed', App.units === 'SI'); $('uEN').setAttribute('aria-pressed', App.units === 'EN'); }
  $('uSI').addEventListener('click', () => { App.units = 'SI'; syncUnits(); App.rebuild(true); });
  $('uEN').addEventListener('click', () => { App.units = 'EN'; syncUnits(); App.rebuild(true); });
  $('showP').addEventListener('change', (e) => { App.showP = e.target.checked; renderDiagram(); });
  $('viewSeg').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    App.view = b.dataset.v;
    $('viewSeg').querySelectorAll('button').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    renderDiagram();
  }));
  $('resetIso').addEventListener('click', () => view3d.reset());
  $('svg2d').addEventListener('click', (e) => {
    const m = App.mod(), svg = $('svg2d');
    if (!m.onClick || !svg._inv) return;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
    if (m.onClick(svg._inv(loc.x, loc.y), App.res)) renderDiagram();
  });
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(renderDiagram, 80); });

  // PDF of the current solution
  root.SolutionPDF && root.SolutionPDF.wire($('pdfSol'), async () => {
    const res = App.res || {}, m = App.mod(), U = App.U();
    // Snapshot both views in one go (nothing repaints in between), then put the viewer's view back.
    const was = App.view;
    let p2d, p3d;
    try {
      App.view = '2d'; renderDiagram(); p2d = root.SolutionPDF.svgToPng($('svg2d'));
      // Draw the 3D view at 4x pixel density for print, then return to the screen density.
      App.view = '3d';
      let hi = false;
      try { Object.defineProperty(root, 'devicePixelRatio', { value: 4, configurable: true }); hi = true; } catch (e) { hi = false; }
      try { renderDiagram(); p3d = root.SolutionPDF.canvasToPng($('cv3d')); }
      finally { if (hi) { try { delete root.devicePixelRatio; } catch (e) {} } }
    } finally { App.view = was; renderDiagram(); }
    const images = [{ cap: '2D section', src: await p2d }, { cap: '3D isometric view', src: p3d }];
    return {
      app: 'Fluid Mechanics', module: m.title, mode: $('statusPill').textContent, units: U.id === 'SI' ? 'SI units' : 'English units',
      images,
      warnings: (res.err || []).map((e) => ({ lvl: 'err', text: e })).concat((res.warn || []).map((w) => ({ lvl: 'warn', text: w }))),
      results: (res.out || []).map((o) => ({ k: o.k, v: Physics.fmt(o.v), u: o.u, em: o.hl })),
      steps: (res.steps || []).map((s) => ({ t: s.t, f: s.f, s: s.s, r: s.r, n: s.n, rPrefix: '⇒ ' })),
      filename: `fluid-mechanics-${root.SolutionPDF.slug(m.title)}.pdf`,
    };
  });

  buildTabs();
  App.rebuild();
})(window);
