/* Loads one of the TEI editions, transforms it with edition.xsl and wires up the interface:
   witness view, filters, apparatus panel (right) and the small windows for people and places.
   Paths are relative to edition.html. The keys of EDITIONS are used in the URL (edition.html?ed=lon-1817)
   and must match the "edition" ids used in characters.json and places.json. */
(() => {
  const EDITIONS = {
    'bolo-1798': { label: 'Bologna 1798', xml: 'data/ortis_bolognese.xml', title: 'Ultime Lettere di Jacopo Ortis [Prima edizione bolognese] [1798]', author: 'Source: "Edizione nazionale delle opere di Ugo Foscolo: Ultime lettere di Jacopo Ortis." Ed. critica a cura di Giovanni Gambarin. 1970', about: '' },
    'mil-1802': { label: 'Milan 1802', xml: 'data/ortis_milanese_1802.xml', title: 'Ultime Lettere di Jacopo Ortis, Tratte dagli autografi [1802]', author: 'Source: "Edizione nazionale delle opere di Ugo Foscolo: Ultime lettere di Jacopo Ortis." Ed. critica a cura di Giovanni Gambarin. 1970', about: '' },
    'lon-1817': { label: 'London 1817', xml: 'data/ortis_1817.xml', title: 'Ultime Lettere di Jacopo Ortis, Tratte dagli autografi [1817]', author: 'Source: "Edizione nazionale delle opere di Ugo Foscolo: Ultime lettere di Jacopo Ortis." Ed. critica a cura di Giovanni Gambarin. 1970', about: '' },
  };
  const DEFAULT = 'bolo-1798';
  const XSL = 'data/edition.xsl';
  const CHARACTERS_JSON = 'data/characters.json';
  const PLACES_JSON = 'data/places.json';
  const EXPLORE = 'explore.html';

  const root = document.getElementById('ed-root');
  const switcher = document.getElementById('ed-switch');
  let currentEd = DEFAULT;
  let teardown = null;

  /* ---------------------------------------------------- helpers */
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const get = async (url) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ' (' + r.status + ')');
    return r.text();
  };
  const parse = (text) => {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('XML parse error');
    return doc;
  };

  /* ---------------------------------------------------- people and places: data and small window */
  let entities = null;
  function loadEntities() {
    if (!entities) {
      const json = (url) => get(url).then(JSON.parse).catch(() => null);
      entities = Promise.all([json(CHARACTERS_JSON), json(PLACES_JSON)]).then(([c, p]) => {
        const map = { person: {}, place: {} };
        if (c && c.characters) c.characters.forEach((x) => { map.person[x.id] = x; });
        if (p && p.places) p.places.forEach((x) => { map.place[x.id] = x; });
        return map;
      });
    }
    return entities;
  }
  const KIND = { character: 'Character', mentioned: 'Mentioned figure', city: 'City', hills: 'Hills', country: 'Country' };

  let pop = null, popTrigger = null;
  function ensurePop() {
    if (pop) return pop;
    pop = el('div', 'ent-pop');
    pop.id = 'ent-pop';
    pop.hidden = true;
    pop.tabIndex = -1;
    pop.setAttribute('role', 'dialog');
    document.body.appendChild(pop);
    return pop;
  }
  function closePop(refocus) {
    if (!pop || pop.hidden) return;
    pop.hidden = true;
    if (popTrigger) {
      popTrigger.setAttribute('aria-expanded', 'false');
      if (refocus) popTrigger.focus();
      popTrigger = null;
    }
  }
  function popContent(a, item) {
    const box = el('div', 'ep-body');
    const close = el('button', 'ep-close', '\u00D7');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', () => closePop(true));
    box.append(close, el('h4', 'ep-name', item ? item.name : a.dataset.name));
    if (item) {
      const chips = el('div', 'ep-chips');
      const k = KIND[item.type] || item.type;
      if (k) chips.append(el('span', 'ep-chip', k));
      if (item.role) chips.append(el('span', 'ep-chip', item.role));
      box.append(chips);
      if (item.description) box.append(el('p', 'ep-desc', item.description));
      const here = (item.appearances || []).find((x) => x.edition === currentEd);
      if (here) {
        const w = el('p', 'ep-where');
        w.append(el('strong', null, 'In this edition: '), document.createTextNode(here.sections.join('; ')));
        box.append(w);
      }
    }
    const link = el('a', 'ep-link', (a.dataset.kind === 'person' ? 'Open in People' : 'Open in Places') + ' \u2192');
    link.href = a.getAttribute('href');
    box.append(link);
    return box;
  }
  function placePop(p, a) {
    p.style.visibility = 'hidden';
    p.style.left = '0px';
    p.style.top = '0px';
    const r = a.getBoundingClientRect();
    const w = p.offsetWidth, h = p.offsetHeight;
    const sx = window.scrollX, sy = window.scrollY, vw = document.documentElement.clientWidth;
    const left = Math.min(Math.max(r.left + sx, sx + 12), sx + vw - w - 12);
    let top = r.bottom + sy + 8;
    if (r.bottom + h + 16 > window.innerHeight && r.top - h - 16 > 0) top = r.top + sy - h - 8;
    p.style.left = left + 'px';
    p.style.top = top + 'px';
    p.style.visibility = '';
  }
  async function openPop(a, viaKeyboard) {
    const p = ensurePop();
    if (popTrigger === a && !p.hidden) { closePop(false); return; }
    if (popTrigger) popTrigger.setAttribute('aria-expanded', 'false');
    popTrigger = a;
    a.setAttribute('aria-expanded', 'true');
    const data = await loadEntities();
    if (popTrigger !== a) return;               // another name was selected meanwhile
    const item = data[a.dataset.kind] && data[a.dataset.kind][a.dataset.id];
    p.replaceChildren(popContent(a, item));
    p.setAttribute('aria-label', a.dataset.name);
    p.hidden = false;
    placePop(p, a);
    if (viaKeyboard) p.focus();
  }
  document.addEventListener('click', (e) => {
    if (pop && !pop.hidden && !e.target.closest('#ent-pop') && !e.target.closest('a.ent')) closePop(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePop(true); });
  window.addEventListener('resize', () => closePop(false));

  /* ---------------------------------------------------- interface wiring */
  function initEdition(box) {
    if (teardown) teardown();
    const $ = (sel) => box.querySelector(sel);
    const $$ = (sel) => Array.from(box.querySelectorAll(sel));
    const kids = (e, cls) => Array.from(e.children).filter((c) => c.classList.contains(cls));
    const visible = (n) => n.getClientRects().length > 0;
    const MAX_PANES = 4;

    const layout = $('.ed-layout');
    const textEl = $('.ed-text');
    const source = $('#wit-source');
    const addBtn = $('#add-pane'), syncBox = $('#tg-sync');
    const panel = $('.ed-apparatus'), toggle = $('.ap-toggle');
    const groups = $$('.app-group');
    const empty = $('.ap-empty'), hint = $('.ap-hint'), secLabel = $('.ap-sec');
    const links = $$('.ed-toc a');
    let currentId = null;

    /* ---- windows (panes): each shows the text of one witness ---- */
    textEl.querySelectorAll('p, .sec-label').forEach((n, i) => { n.dataset.i = i; });   // anchors for synchronised scrolling
    const pristine = textEl.cloneNode(true);
    const wrap = el('div', 'ed-panes single');
    layout.insertBefore(wrap, textEl);
    const panes = [];
    let driver = null, driverTimer = null;

    function decorate(node) {
      node.querySelectorAll('a.ent[data-id]').forEach((a) => {
        a.setAttribute('aria-haspopup', 'dialog');
        a.setAttribute('aria-expanded', 'false');
        a.setAttribute('href', EXPLORE + '#' + a.dataset.id);   // e.g. explore.html#JO or explore.html#PD
      });
    }
    function applyWitness(p) {
      const w = p.select.value;
      let hits = 0;
      p.body.querySelectorAll('.app').forEach((app) => {
        const rs = kids(app, 'reading');
        let chosen = rs.find((r) => r.classList.contains('lem')) || rs[0];
        if (w) {
          const hit = rs.find((r) => r.dataset.wit.indexOf(' ' + w + ' ') > -1);
          if (hit) { chosen = hit; hits++; }
        }
        rs.forEach((r) => {
          r.hidden = r !== chosen;
          r.classList.toggle('alt', r === chosen && !r.classList.contains('lem'));
        });
      });
      p.note.hidden = !(w && hits === 0);
      p.note.textContent = 'Witness ' + w + ' is not recorded in the apparatus, so the edited text is shown.';
    }
    function makePane(node, wit) {
      const pane = el('div', 'pane');
      const head = el('div', 'pane-head');
      const select = el('select', 'pane-select');
      select.setAttribute('aria-label', 'Reading text shown in this window');
      Array.from(source.options).forEach((o) => select.add(new Option(o.textContent, o.value)));
      select.value = wit || '';
      const rm = el('button', 'pane-close', '\u00D7');
      rm.type = 'button';
      rm.setAttribute('aria-label', 'Close this window');
      head.append(select, rm);
      const note = el('p', 'pane-note');
      note.hidden = true;
      const body = el('div', 'pane-body');
      body.appendChild(node);
      pane.append(head, note, body);
      const p = { el: pane, body, select, rm, note };
      select.addEventListener('change', () => applyWitness(p));
      rm.addEventListener('click', () => removePane(p));
      body.addEventListener('scroll', () => onPaneScroll(p), { passive: true });
      return p;
    }
    function refreshLayout() {
      const multi = panes.length > 1;
      wrap.classList.toggle('single', !multi);
      wrap.classList.toggle('multi', multi);
      layout.classList.toggle('multi', multi);
      panes.forEach((p) => { p.rm.hidden = !multi; });
      addBtn.disabled = panes.length >= MAX_PANES;
    }
    function addPane() {
      if (panes.length >= MAX_PANES) return;
      const used = new Set(panes.map((p) => p.select.value));
      const wit = Array.from(source.options).map((o) => o.value).find((v) => !used.has(v));
      const node = pristine.cloneNode(true);
      node.removeAttribute('id');
      node.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));   // ids stay unique: only the first window keeps them
      decorate(node);
      const p = makePane(node, wit === undefined ? '' : wit);
      panes.push(p);
      wrap.appendChild(p.el);
      applyWitness(p);
      applyTypes();
      refreshLayout();
      requestAnimationFrame(() => jumpTo(currentId, true));
    }
    function removePane(p) {
      if (panes.length < 2) return;
      panes.splice(panes.indexOf(p), 1);
      p.el.remove();
      refreshLayout();
      requestAnimationFrame(() => jumpTo(currentId, true));
    }

    /* ---- scrolling: sections, anchors, synchronisation ---- */
    function alignTo(src, dst) {
      const sTop = src.body.getBoundingClientRect().top;
      const anchors = Array.from(src.body.querySelectorAll('[data-i]')).filter(visible);
      if (!anchors.length) return;
      let k = 0;
      for (let i = 0; i < anchors.length; i++) {
        if (anchors[i].getBoundingClientRect().top <= sTop + 1) k = i; else break;
      }
      for (let j = k; j >= 0; j--) {
        const a = anchors[j];
        const t = dst.body.querySelector('[data-i="' + a.dataset.i + '"]');
        if (t && visible(t)) {
          const off = a.getBoundingClientRect().top - sTop;
          dst.body.scrollTop += (t.getBoundingClientRect().top - dst.body.getBoundingClientRect().top) - off;
          return;
        }
      }
    }
    function sectionAt(body, line) {
      const secs = Array.from(body.querySelectorAll('.ed-section'));
      let cur = secs[0];
      for (const s of secs) { if (s.getBoundingClientRect().top <= line) cur = s; else break; }
      return cur;
    }
    function onPaneScroll(src) {
      if (panes.length < 2) return;
      closePop(false);
      if (driver && driver !== src) return;
      driver = src;
      clearTimeout(driverTimer);
      driverTimer = setTimeout(() => { driver = null; }, 150);
      if (syncBox.checked) panes.forEach((o) => { if (o !== src) alignTo(src, o); });
      const sec = sectionAt(src.body, src.body.getBoundingClientRect().top + src.body.clientHeight * 0.3);
      if (sec && sec.dataset.sec !== currentId) setCurrent(sec.dataset.sec);
    }
    let ticking = false;
    function onWindowScroll() {
      if (panes.length > 1 || ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const sec = sectionAt(panes[0].body, window.innerHeight * 0.3);
        if (sec && sec.dataset.sec !== currentId) setCurrent(sec.dataset.sec);
      });
    }
    window.addEventListener('scroll', onWindowScroll, { passive: true });
    teardown = () => window.removeEventListener('scroll', onWindowScroll);

    function jumpTo(id, instant) {
      if (!id) return;
      const multi = panes.length > 1;
      panes.forEach((p) => {
        const t = p.body.querySelector('.ed-section[data-sec="' + id + '"]');
        if (!t) return;
        if (multi) {
          driver = p;
          clearTimeout(driverTimer);
          driverTimer = setTimeout(() => { driver = null; }, 200);
          p.body.scrollTop += t.getBoundingClientRect().top - p.body.getBoundingClientRect().top - 8;
        } else {
          t.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'start' });
        }
      });
      setCurrent(id);
    }

    /* ---- apparatus panel (right): follows the section being read ---- */
    function setCurrent(id) {
      currentId = id;
      let any = false;
      groups.forEach((g) => {
        const on = g.dataset.section === id;
        g.classList.toggle('current', on);
        if (on) any = true;
      });
      empty.hidden = any;
      hint.hidden = !any;
      const link = box.querySelector('.ed-toc a[href="#' + id + '"]');
      secLabel.textContent = link ? link.textContent : '';
      links.forEach((l) => l.classList.toggle('active', l.hash === '#' + id));
    }
    function expand(open) {
      panel.classList.toggle('collapsed', !open);
      toggle.setAttribute('aria-expanded', String(open));
    }
    toggle.addEventListener('click', () => expand(panel.classList.contains('collapsed')));

    function selectApp(n) {
      $$('.app.active').forEach((a) => a.classList.remove('active'));
      $$('.app-list li.selected').forEach((li) => li.classList.remove('selected'));
      const apps = $$('.app[data-n="' + n + '"]'), li = box.querySelector('#app-entry-' + n);
      if (!apps.length || !li) return;
      apps.forEach((a) => a.classList.add('active'));
      li.classList.add('selected');
      const sec = apps[0].closest('.ed-section');
      if (sec && sec.dataset.sec !== currentId) setCurrent(sec.dataset.sec);
      expand(true);
      li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    function goToText(n) {
      selectApp(n);
      const multi = panes.length > 1;
      $$('.app[data-n="' + n + '"]').forEach((a) => {
        const p = panes.find((x) => x.body.contains(a));
        if (multi && p) {
          p.body.scrollTop += a.getBoundingClientRect().top - p.body.getBoundingClientRect().top - p.body.clientHeight / 2;
        } else {
          a.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        a.classList.add('flash');
        setTimeout(() => a.classList.remove('flash'), 1800);
      });
    }
    $$('.app-list li').forEach((li) => { li.tabIndex = 0; });

    /* ---- toggles and filters ---- */
    const tv = $('#tg-variants'), ta = $('#tg-apparatus');
    tv.addEventListener('change', () => box.classList.toggle('show-variants', tv.checked));
    ta.addEventListener('change', () => box.classList.toggle('no-apparatus', !ta.checked));
    syncBox.addEventListener('change', () => {
      if (syncBox.checked && panes.length > 1) panes.slice(1).forEach((o) => alignTo(panes[0], o));
    });
    addBtn.addEventListener('click', addPane);

    const typeBoxes = $$('.tg-type');
    function applyTypes() {
      const off = new Set(typeBoxes.filter((b) => !b.checked).map((b) => b.value));
      $$('[data-type]').forEach((x) => x.classList.toggle('type-off', off.has(x.dataset.type)));
    }
    typeBoxes.forEach((b) => b.addEventListener('change', applyTypes));

    /* ---- clicks inside the edition ---- */
    box.addEventListener('click', (e) => {
      const mark = e.target.closest('.app-mark');
      if (mark) { selectApp(mark.closest('.app').dataset.n); return; }
      const item = e.target.closest('.app-list li');
      if (item) { e.preventDefault(); goToText(item.dataset.n); return; }
      const toc = e.target.closest('.ed-toc a');
      if (toc) { e.preventDefault(); jumpTo(toc.hash.slice(1)); return; }
      const fn = e.target.closest('a.fn-ref, a.fn-back');
      if (fn) {
        e.preventDefault();
        const scope = fn.closest('.pane-body') || box, n = fn.dataset.fn;
        const target = fn.classList.contains('fn-ref')
          ? scope.querySelector('.fn[data-n="' + n + '"]')
          : scope.querySelector('a.fn-ref[data-fn="' + n + '"]');
        if (target) {
          target.scrollIntoView({ block: 'center', behavior: 'smooth' });
          target.classList.add('flash');
          setTimeout(() => target.classList.remove('flash'), 1800);
        }
        return;
      }
      const ent = e.target.closest('a.ent[data-id]');
      if (ent) {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;   // let the link open normally
        e.preventDefault();
        openPop(ent, e.detail === 0);
      }
    });
    box.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.app-list li')) {
        e.preventDefault();
        goToText(e.target.dataset.n);
      }
    });

    /* ---- start: one window with the edited text ---- */
    const first = makePane(textEl, '');
    panes.push(first);
    wrap.appendChild(first.el);
    decorate(textEl);
    applyWitness(first);
    refreshLayout();
    const sec0 = box.querySelector('.ed-section');
    if (sec0) setCurrent(sec0.dataset.sec);
  }

  /* ---------------------------------------------------- loading and transforming */
  let processor = null;
  async function getProcessor() {
    if (!processor) {
      processor = new XSLTProcessor();
      processor.importStylesheet(parse(await get(XSL)));
    }
    return processor;
  }


  function customize(id, box) {
    const ed = EDITIONS[id];
    const t = box.querySelector('.ed-title');
    if (t && ed.title) t.textContent = ed.title;
    const a = box.querySelector('.ed-author');
    if (a && ed.author !== undefined) { if (ed.author) a.textContent = ed.author; else a.remove(); }
    const body = box.querySelector('.ed-about-body');
    if (body && ed.about) body.innerHTML = ed.about;
  }

  async function show(id, push) {
    if (!EDITIONS[id]) id = DEFAULT;
    currentEd = id;
    closePop(false);
    Array.from(switcher.querySelectorAll('button')).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ed === id)));
    root.setAttribute('aria-busy', 'true');
    try {
      const [proc, xml] = await Promise.all([getProcessor(), get(EDITIONS[id].xml).then(parse)]);
      const frag = proc.transformToFragment(xml, document);
      root.replaceChildren(frag);
      initEdition(root.firstElementChild);
      customize(id, root.firstElementChild);
      document.title = EDITIONS[id].label + ' \u2013 Digital Edition';
      if (push) history.pushState({ ed: id }, '', '?ed=' + id);
    } catch (err) {
      root.innerHTML = '<div class="note-err"><p>The edition could not be loaded (' + err.message + ').</p>' +
        '<p>Browsers block <code>fetch()</code> on files opened from disk. Serve the site through a web server, for example ' +
        'with Live Server in VS Code or <code>py -m http.server 8000</code>.</p></div>';
    }
    root.removeAttribute('aria-busy');
  }

  window.OpenOrtisEdition = { init: initEdition, setEdition: (id) => { currentEd = id; }, EDITIONS };

  if (root && switcher && typeof XSLTProcessor !== 'undefined') {
    switcher.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-ed]');
      if (b) show(b.dataset.ed, true);
    });
    window.addEventListener('popstate', () => show(new URLSearchParams(location.search).get('ed'), false));
    show(new URLSearchParams(location.search).get('ed') || DEFAULT, false);
  }
})();