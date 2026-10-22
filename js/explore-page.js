/* Explore page: three tabs (People, Places, Author) on one page.
   Needs js/explore.js (helpers), d3, leaflet and the data in data/*.json.
   Addresses: explore.html#people | #places | #author | #JO (a person) | #PD (a place) | #ev-london (a timeline event). */
window.ExploreApp = {};

async function initPeople() {
  const { el, loadJSON, showError, editionFilter, appearances, section, linkList } = Explore;
  const wrap = document.getElementById('p-graphwrap'), panel = document.getElementById('p-panel');
  let data; const places = {};
  try { data = await loadJSON('data/characters.json'); } catch (e) { showError(wrap, e); return; }
  try { (await loadJSON('data/places.json')).places.forEach(p => places[p.id] = p); } catch (e) { }

  const byId = Object.fromEntries(data.characters.map(c => [c.id, c]));
  const edges = data.relations.map(r => ({ ...r }));
  const deg = {}; edges.forEach(e => { deg[e.source] = (deg[e.source] || 0) + 1; deg[e.target] = (deg[e.target] || 0) + 1; });
  const W = 800, H = 560;
  const nodes = data.characters.map(c => ({ id: c.id, r: Math.min(30, 13 + 3 * (deg[c.id] || 0)) }));
  let selected = null, activeEd = null;

  const svg = d3.select('#graph').attr('viewBox', `0 0 ${W} ${H}`);
  const link = svg.append('g').selectAll('line').data(edges).join('line').attr('class', 'link');
  const lbl = svg.append('g').selectAll('text').data(edges).join('text').attr('class', 'linklabel').text(d => d.label);
  const node = svg.append('g').selectAll('g').data(nodes).join('g')
    .attr('class', d => 'node ' + byId[d.id].type)
    .attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', d => byId[d.id].name + ', ' + byId[d.id].role)
    .on('click', (ev, d) => select(d.id))
    .on('keydown', (ev, d) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(d.id); } });
  node.append('circle').attr('r', d => d.r);
  node.append('text').attr('y', d => d.r + 16).text(d => byId[d.id].name);

  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(edges).id(d => d.id).distance(125))
    .force('charge', d3.forceManyBody().strength(-520))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collide', d3.forceCollide(d => d.r + 26))
    .force('x', d3.forceX(W / 2).strength(.04)).force('y', d3.forceY(H / 2).strength(.06));
  const draw = () => {
    nodes.forEach(d => { d.x = Math.max(d.r + 30, Math.min(W - d.r - 30, d.x)); d.y = Math.max(d.r + 20, Math.min(H - d.r - 30, d.y)); });
    link.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    lbl.attr('x', d => (d.source.x + d.target.x) / 2).attr('y', d => (d.source.y + d.target.y) / 2);
    node.attr('transform', d => `translate(${d.x},${d.y})`);
  };
  sim.on('tick', draw);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { sim.stop(); sim.tick(300); draw(); }
  node.call(d3.drag()
    .on('start', (ev, d) => { if (!ev.active) sim.alphaTarget(.25).restart(); d.fx = d.x; d.fy = d.y; })
    .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
    .on('end', (ev, d) => { if (!ev.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

  const inEd = (id) => !activeEd || byId[id].appearances.some(a => a.edition === activeEd);
  const ends = e => [e.source.id || e.source, e.target.id || e.target];
  const paint = () => {
    const nb = new Set(selected ? [selected] : []);
    if (selected) edges.forEach(e => { const [a, b] = ends(e); if (a === selected) nb.add(b); if (b === selected) nb.add(a); });
    node.classed('selected', d => d.id === selected)
      .classed('dim', d => !inEd(d.id))
      .classed('faded', d => inEd(d.id) && selected && !nb.has(d.id));
    link.classed('active', e => selected && ends(e).includes(selected))
      .classed('dim', e => ends(e).some(id => !inEd(id)))
      .classed('faded', e => selected && !ends(e).includes(selected) && !ends(e).some(id => !inEd(id)));
    lbl.classed('active', e => selected && ends(e).includes(selected) && !ends(e).some(id => !inEd(id)));
  };

  function select(id) {
    const c = byId[id]; if (!c) return; selected = id;
    if (window.__setHash) window.__setHash(id);
    const conns = edges.filter(e => ends(e).includes(id)).map(e => {
      const [a, b] = ends(e); const other = a === id ? b : a;
      const text = a === id ? e.label : e.label; return { other, label: e.label, out: a === id };
    });
    const relPlaces = (c.related_places || []).filter(p => places[p]);
    panel.replaceChildren(
      ...[
        el('h2', {}, c.name),
        el('div', { class: 'chips' }, el('span', { class: 'chip' }, c.type === 'character' ? 'Character' : 'Mentioned figure'), el('span', { class: 'chip' }, c.role)),
        el('p', {}, c.description),
        section('Where it appears', appearances(c.appearances, data.editions)),
        conns.length ? section('Connections', el('ul', {}, conns.map(k => el('li', {},
          el('button', { class: 'inline', type: 'button', onclick: () => select(k.other) }, byId[k.other].name),
          ' — ', k.out ? k.label : k.label)))) : null,
        relPlaces.length ? section('Places', el('ul', {}, relPlaces.map(p => el('li', {}, el('a', { href: '#' + p }, places[p].name))))) : null,
        (c.links && c.links.length) ? section('Authority records', linkList(c.links)) : null].filter(Boolean)
    );
    paint();
  }

  editionFilter(document.getElementById('p-filters'), data.editions, id => { activeEd = id; paint(); });
  const roster = document.getElementById('p-roster');
  data.characters.forEach(c => roster.append(el('button', { type: 'button', onclick: () => { select(c.id); panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } }, c.name, el('small', {}, c.role))));
  window.ExploreApp.people = { select, byId };
  const start = location.hash.slice(1);
  select(byId[start] ? start : 'JO');
}

async function initPlaces() {
  const { el, loadJSON, showError, editionFilter, appearances, section, linkList } = Explore;
  const wrap = document.getElementById('l-mapwrap'), panel = document.getElementById('l-panel');
  let data; const chars = {};
  try { data = await loadJSON('data/places.json'); } catch (e) { showError(wrap, e); return; }
  try { (await loadJSON('data/characters.json')).characters.forEach(c => chars[c.id] = c); } catch (e) { }

  const byId = Object.fromEntries(data.places.map(p => [p.id, p]));
  const TYPE = { city: 'City', hills: 'Hills', country: 'Country' };
  const SAGE = '#8FA69B', SLATE = '#6D8794', INK = '#2E3A3F';
  const map = L.map('map', { zoomControl: true, scrollWheelZoom: false });
  map.on('click', () => { });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  const style = (p, sel) => ({ radius: sel ? 13 : 9, color: sel ? INK : SLATE, weight: sel ? 2.5 : 1.5, fillColor: sel ? SLATE : SAGE, fillOpacity: p.type === 'city' ? .9 : .35, dashArray: p.type === 'city' ? null : '4 3' });
  const markers = {}; let selected = null, activeEd = null;
  data.places.forEach(p => {
    const m = L.circleMarker([p.lat, p.lon], style(p, false)).bindTooltip(p.name, { direction: 'top', offset: [0, -8] }).addTo(map);
    m.on('click', () => select(p.id)); markers[p.id] = m;
  });
  const inEd = p => !activeEd || p.appearances.some(a => a.edition === activeEd);
  const refit = () => {
    const vis = data.places.filter(inEd).map(p => [p.lat, p.lon]);
    if (vis.length > 1) map.fitBounds(vis, { padding: [50, 50] }); else if (vis.length) map.setView(vis[0], 9);
  };
  const paint = () => {
    data.places.forEach(p => {
      const on = inEd(p);
      if (on && !map.hasLayer(markers[p.id])) markers[p.id].addTo(map);
      if (!on && map.hasLayer(markers[p.id])) map.removeLayer(markers[p.id]);
      markers[p.id].setStyle(style(p, p.id === selected));
    });
    if (selected && markers[selected] && map.hasLayer(markers[selected])) markers[selected].bringToFront();
  };

  function select(id, pan) {
    const p = byId[id]; if (!p) return; selected = id;
    if (window.__setHash) window.__setHash(id);
    const rel = (p.related_characters || []).filter(c => chars[c]);
    panel.replaceChildren(...[
      el('h2', {}, p.name),
      el('div', { class: 'chips' }, el('span', { class: 'chip' }, TYPE[p.type] || p.type), el('span', { class: 'chip' }, p.role)),
      el('p', {}, p.description),
      section('Where it appears', appearances(p.appearances, data.editions)),
      rel.length ? section('Related people', el('ul', {}, rel.map(c => el('li', {}, el('a', { href: '#' + c }, chars[c].name))))) : null,
      (p.links && p.links.length) ? section('Authority records', linkList(p.links)) : null].filter(Boolean)
    );
    paint();
    if (pan && map.hasLayer(markers[id])) map.panTo([p.lat, p.lon]);
  }

  editionFilter(document.getElementById('l-filters'), data.editions, id => { activeEd = id; paint(); refit(); });
  const roster = document.getElementById('l-roster');
  data.places.forEach(p => roster.append(el('button', { type: 'button', onclick: () => { select(p.id, true); panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } }, p.name, el('small', {}, TYPE[p.type] || p.type))));
  refit();
  window.ExploreApp.places = { select, byId, map, refit };
  const start = location.hash.slice(1);
  select(byId[start] ? start : data.places[0].id);
}

/* ---------------------------------------------------------------- Author: vertical timeline */
async function initAuthor() {
  const { loadJSON, showError } = Explore;
  const el = (tag, cls, text) => {            // (the helper in explore.js takes an attributes object instead)
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const wrap = document.getElementById('a-wrap');
  let data;
  try { data = await loadJSON('data/timeline.json'); } catch (e) { showError(wrap, e); return; }
  let placeNames = {};
  try { (await loadJSON('data/places.json')).places.forEach((p) => { placeNames[p.id] = p.name; }); } catch (e) { /* the links just use the id */ }

  const filters = document.getElementById('a-filters');
  const list = document.getElementById('a-list');
  const progress = document.getElementById('a-progress');
  const items = [];

  function setOpen(item, open) {
    item.head.setAttribute('aria-expanded', String(open));
    item.body.hidden = !open;
    item.li.classList.toggle('open', open);
  }
  data.events.forEach((e) => {
    const li = el('li', 'tl-item type-' + e.type);
    li.id = e.id;
    li.dataset.type = e.type;
    const year = el('span', 'tl-year', String(e.year));
    const dot = el('span', 'tl-dot');
    dot.setAttribute('aria-hidden', 'true');
    const card = el('article', 'tl-card');
    const head = el('button', 'tl-head');
    head.type = 'button';
    head.setAttribute('aria-expanded', 'false');
    head.setAttribute('aria-controls', e.id + '-body');
    if (e.image) {
      const img = el('img', 'tl-thumb');
      img.src = e.image; img.alt = ''; img.loading = 'lazy';
      head.append(img);
    }
    const txt = el('span', 'tl-txt');
    txt.append(el('span', 'tl-date', e.date), el('h3', null, e.title));
    if (e.place) txt.append(el('span', 'tl-place', e.place));
    head.append(txt, el('span', 'tl-chev', '\u203A'));
    const body = el('div', 'tl-body');
    body.id = e.id + '-body';
    body.hidden = true;
    body.append(el('p', null, e.description));
    const links = el('p', 'tl-links');
    (e.places || []).forEach((p) => {
      const a = el('a', 'tl-link', 'Show ' + (placeNames[p] || p) + ' on the map');
      a.href = '#' + p;
      links.append(a);
    });
    if (e.edition) {
      const a = el('a', 'tl-link', 'Read this edition \u2192');
      a.href = 'edition.html?ed=' + e.edition;
      links.append(a);
    }
    if (links.children.length) body.append(links);
    card.append(head, body);
    li.append(year, dot, card);
    list.append(li);
    const item = { li, head, body, data: e };
    head.addEventListener('click', () => setOpen(item, body.hidden));
    items.push(item);
  });

  /* filter by type */
  const makeBtn = (id, label) => {
    const b = el('button', null, label);
    b.type = 'button';
    b.dataset.type = id;
    b.setAttribute('aria-pressed', String(id === ''));
    b.addEventListener('click', () => {
      filters.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      items.forEach((it) => { it.li.hidden = id !== '' && it.data.type !== id; });
      measure();
    });
    filters.append(b);
  };
  makeBtn('', 'Everything');
  Object.entries(data.types).forEach(([id, label]) => makeBtn(id, label));

  /* reveal on scroll, and the coloured part of the line */
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((es) => es.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -10% 0px' });
    items.forEach((it) => io.observe(it.li));
  } else items.forEach((it) => it.li.classList.add('in'));

  function measure() {
    const r = list.getBoundingClientRect();
    const done = Math.max(0, Math.min(r.height, window.innerHeight * 0.55 - r.top));
    progress.style.height = done + 'px';
  }
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; measure(); });
  }, { passive: true });
  window.addEventListener('resize', measure);
  measure();

  window.ExploreApp.author = {
    open(id) {
      const it = items.find((x) => x.data.id === id);
      if (!it) return;
      if (it.li.hidden) filters.querySelector('button').click();
      it.li.classList.add('in');
      setOpen(it, true);
      it.li.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }
  };
}

/* ---------------------------------------------------------------- tabs and addresses */
(() => {
  const NAMES = ['people', 'places', 'author'];
  const tabs = NAMES.map((n) => document.getElementById('tab-' + n));
  const panels = NAMES.map((n) => document.getElementById('panel-' + n));
  const peopleReady = initPeople();
  let placesReady = null, authorReady = null;
  const ensurePlaces = () => placesReady || (placesReady = initPlaces());
  const ensureAuthor = () => authorReady || (authorReady = initAuthor());
  const placeIds = new Set();
  const eventIds = new Set();
  const idsReady = Promise.all([
    Explore.loadJSON('data/places.json').then((d) => d.places.forEach((p) => placeIds.add(p.id))).catch(() => { }),
    Explore.loadJSON('data/timeline.json').then((d) => d.events.forEach((e) => eventIds.add(e.id))).catch(() => { })
  ]);

  async function showTab(name, focus) {
    NAMES.forEach((n, i) => {
      const on = n === name;
      tabs[i].setAttribute('aria-selected', String(on));
      tabs[i].tabIndex = on ? 0 : -1;
      panels[i].hidden = !on;
    });
    if (focus) tabs[NAMES.indexOf(name)].focus();
    if (name === 'places') {
      await ensurePlaces();
      const a = window.ExploreApp.places;
      if (a) { a.map.invalidateSize(); a.refit(); }
    }
    if (name === 'author') ensureAuthor();
  }

  async function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    await idsReady;
    if (NAMES.includes(h)) { await showTab(h); return; }
    if (placeIds.has(h)) { await showTab('places'); const a = window.ExploreApp.places; if (a) a.select(h, true); return; }
    if (eventIds.has(h)) { await showTab('author'); await ensureAuthor(); window.ExploreApp.author.open(h); return; }
    await showTab('people');
    await peopleReady;
    const a = window.ExploreApp.people;
    if (a && a.byId[h]) a.select(h);
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => { history.replaceState(null, '', '#' + NAMES[i]); showTab(NAMES[i]); });
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = (i + (e.key === 'ArrowRight' ? 1 : NAMES.length - 1)) % NAMES.length;
      history.replaceState(null, '', '#' + NAMES[next]);
      showTab(NAMES[next], true);
    });
  });
  window.addEventListener('hashchange', route);
  route().then(() => { window.__setHash = (id) => history.replaceState(null, '', '#' + id); });
})();
