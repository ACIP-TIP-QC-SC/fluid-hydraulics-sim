/* =====================================================================
 * Geotechnical Engineering — app shell: module tabs, units, render loop,
 * results & worked solution, charts panel, Copy solution and Print PDF.
 * (Same layout and behaviour as the Fluid Mechanics solver.)
 * ===================================================================== */
(function (root) {
  'use strict';
  const { Physics, UI } = root;
  const { h } = UI;
  const $ = (id) => document.getElementById(id);
  const APP_NAME = 'Geotechnical Engineering';

  const App = {
    units: 'SI', view: '2d', showP: true, active: null, res: null,
    modules: {},
    U() { return Physics.UNITS[this.units]; },
    mod() { return this.modules[this.active]; },
  };
  root.App = App;
  ['GSeep', 'GES', 'GStress', 'GCons', 'GShear', 'GLat', 'GSlope'].forEach((n) => { if (root[n]) App.modules[root[n].id] = root[n]; });
  App.active = Object.keys(App.modules)[0];
  try { const t = localStorage.getItem('geo.tab'); if (t && App.modules[t]) App.active = t; } catch (e) {}

  const view3d = new root.View3D($('cv3d'));
  const C = UI.Controls(App);
  C.log = (parent, o) => root.GeoUI.logSlider(C, App, parent, o);
  C.layers = (parent, o) => root.GeoUI.layerEditor(App, parent, o);

  function buildTabs() {
    const t = $('tabs'); t.innerHTML = '';
    Object.values(App.modules).forEach((m, i) => {
      t.append(h('button', { type: 'button', role: 'tab', 'aria-selected': App.active === m.id ? 'true' : 'false', onclick: () => { App.active = m.id; try { localStorage.setItem('geo.tab', m.id); } catch (e) {} buildTabs(); App.rebuild(); } }, h('span', { class: 'n' }, String(i + 1)), m.title));
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
    App.loadPreset(+i);
    e.target.value = i;
  });
  App.loadPreset = function (i) {
    const pr = App.mod().presets[i];
    pr.apply(App.mod().state);
    App.units = pr.units || 'SI'; syncUnits();
    App.rebuild(true);
  };

  function syncChrome() {
    const m = App.mod();
    const tg = m.toggle ? (typeof m.toggle === 'function' ? m.toggle() : m.toggle) : null;
    $('showPWrap').hidden = !tg;
    if (tg) $('showPLabel').textContent = tg;
    const lg = $('legend'); lg.innerHTML = '';
    const items = typeof m.legend === 'function' ? m.legend() : (m.legend || []);
    items.forEach(([c, t, k]) => lg.append(h('span', null, h('i', { class: k || '', style: { background: c } }), t)));
    lg.hidden = !items.length;
    $('hint').textContent = (m.hint ? (typeof m.hint === 'function' ? m.hint() : m.hint) + ' ' : '') + '3D view: drag to rotate, scroll to zoom. Values are rounded to 4 significant figures.';
  }

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
    syncChrome();
    renderResults(res, U);
    renderDiagram();
  };

  function renderPlot() {
    const m = App.mod(), U = App.U(), res = App.res, pp = $('plotPanel'), svg = $('svgPlot');
    let any = false;
    if (m.plot && res && res.ok) {
      pp.hidden = false;
      try { any = !!m.plot(svg, res, U); } catch (e) { console.error(e); any = false; }
    }
    pp.hidden = !any;
    return any;
  }

  function renderDiagram() {
    const m = App.mod(), U = App.U(), res = App.res;
    const svg = $('svg2d'), cv = $('cv3d');
    if (App.view === '2d') {
      svg.removeAttribute('hidden'); cv.setAttribute('hidden', '');
      $('resetIso').hidden = true;
      svg.style.cursor = m.onClick ? 'crosshair' : '';
      if (!res.ok) emptyMsg(svg, res);
      else { m.draw2D(svg, res, U, { showP: App.showP }); if (!m.noDeclutter && root.UI.declutter) root.UI.declutter(svg); }
    } else {
      svg.setAttribute('hidden', ''); cv.removeAttribute('hidden');
      $('resetIso').hidden = false;
      view3d.clear();
      if (res.ok) m.draw3D(view3d, res, U, { showP: App.showP });
      view3d.render();
    }
    renderPlot();
  }
  function emptyMsg(svg, res) {
    const D = UI.Draw2D(svg, { xmin: 0, xmax: 1, ymin: 0, ymax: 1 });
    D.text([D.W / 2, D.H / 2], '⚠ ' + (res.err && res.err[0] ? res.err[0].slice(0, 110) : 'Invalid input'), { px: true, anchor: 'middle', color: '#c0392b', size: 14 });
  }
  App.emptyMsg = emptyMsg;

  function renderResults(res, U) {
    const pill = $('statusPill');
    pill.className = 'pill ' + (res.ok ? (res.status ? res.status.cls : 'ok') : 'bad');
    pill.textContent = res.ok ? (res.status ? res.status.text : 'OK') : '⚠ Invalid state';
    const msgs = $('msgs'); msgs.innerHTML = '';
    (res.err || []).forEach((e) => msgs.append(h('div', { class: 'msg err' }, '⛔ ' + e)));
    (res.warn || []).forEach((w) => msgs.append(h('div', { class: 'msg warn' }, '⚠ ' + w)));
    const t = $('results'); t.innerHTML = '';
    (res.out || []).forEach((o) => t.append(h('tr', { class: o.hl ? 'hl' : '' }, h('td', null, o.k), h('td', { class: 'v' }, typeof o.v === 'string' ? o.v : Physics.fmt(o.v)), h('td', { class: 'u' }, o.u))));
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
    let txt = `Hydraulics and Principles of Geotechnical Engineering (HPGE) Calculator by CEM Jumawan — ${APP_NAME}: ${m.title} (${U.id} units)\n\n`;
    (res.err || []).forEach((e) => (txt += `ERROR: ${e}\n`));
    (res.warn || []).forEach((e) => (txt += `WARNING: ${e}\n`));
    txt += 'RESULTS\n';
    (res.out || []).forEach((o) => (txt += `  ${o.k}: ${typeof o.v === 'string' ? o.v : Physics.fmt(o.v)} ${o.u}\n`));
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
  // Shared data (e.g. the soil profile) is converted when the viewer switches units.
  function setUnits(u) {
    if (u === App.units) return;
    const from = App.units; App.units = u;
    if (root.GeoProfile) root.GeoProfile.convert(from, u);
    Object.values(App.modules).forEach((m) => { if (m.onUnits) m.onUnits(from, u); });
    syncUnits(); App.rebuild(true);
  }
  $('uSI').addEventListener('click', () => setUnits('SI'));
  $('uEN').addEventListener('click', () => setUnits('EN'));
  $('showP').addEventListener('change', (e) => { App.showP = e.target.checked; renderDiagram(); });
  $('viewSeg').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    App.view = b.dataset.v;
    $('viewSeg').querySelectorAll('button').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    renderDiagram();
  }));
  $('resetIso').addEventListener('click', () => view3d.reset());
  $('svg2d').addEventListener('click', (e) => {
    const m = App.mod(), svg = $('svg2d');
    if (!m.onClick || !svg._inv || !App.res || !App.res.ok) return;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
    if (m.onClick(svg._inv(loc.x, loc.y), App.res)) App.rebuild(true);
  });
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(renderDiagram, 80); });

  // PDF of the current solution
  root.SolutionPDF && root.SolutionPDF.wire($('pdfSol'), async () => {
    const res = App.res || {}, m = App.mod(), U = App.U();
    const was = App.view;
    let p2d, p3d, pPlot = null;
    try {
      App.view = '2d'; renderDiagram(); p2d = root.SolutionPDF.svgToPng($('svg2d'));
      if (!$('plotPanel').hidden) pPlot = root.SolutionPDF.svgToPng($('svgPlot'));
      App.view = '3d';
      let hi = false;
      try { Object.defineProperty(root, 'devicePixelRatio', { value: 4, configurable: true }); hi = true; } catch (e) { hi = false; }
      try { renderDiagram(); p3d = root.SolutionPDF.canvasToPng($('cv3d')); }
      finally { if (hi) { try { delete root.devicePixelRatio; } catch (e) {} } }
    } finally { App.view = was; renderDiagram(); }
    const images = [{ cap: '2D section', src: await p2d }];
    if (pPlot) images.push({ cap: (typeof m.plotCaption === 'function' ? m.plotCaption() : m.plotCaption) || 'Charts', src: await pPlot });
    images.push({ cap: '3D isometric view', src: p3d });
    return {
      app: APP_NAME, module: m.title, mode: $('statusPill').textContent, units: U.id === 'SI' ? 'SI units' : 'English units',
      images,
      warnings: (res.err || []).map((e) => ({ lvl: 'err', text: e })).concat((res.warn || []).map((w) => ({ lvl: 'warn', text: w }))),
      results: (res.out || []).map((o) => ({ k: o.k, v: typeof o.v === 'string' ? o.v : Physics.fmt(o.v), u: o.u, em: o.hl })),
      steps: (res.steps || []).map((s) => ({ t: s.t, f: s.f, s: s.s, r: s.r, n: s.n, rPrefix: '⇒ ' })),
      filename: `geotechnical-${root.SolutionPDF.slug(m.title)}.pdf`,
    };
  });

  syncUnits();
  buildTabs();
  App.rebuild();
})(window);
