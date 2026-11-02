/* Explore page: three tabs (People, Places, Author) on one page.
   Needs d3, leaflet and the data in data/*.json.
   Addresses: explore.html#people | #places | #author | #JO (a person) | #PD (a place) | #ev-london (a timeline event). */

/* ---------------------------------------------------------------- shared helpers */

const Explore = (() => {
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);

    if (typeof attrs === 'string') {
      attrs = { class: attrs };
    } else if (attrs instanceof Node || Array.isArray(attrs)) {
      kids.unshift(attrs);
      attrs = null;
    }

    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;

      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }

    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false || kid === '') continue;
      n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }

    return n;
  };

  const fill = (container, ...parts) => {
    container.replaceChildren(
      ...parts.flat(Infinity)
        .filter(x => x != null && x !== false && x !== '')
        .map(x => x.nodeType ? x : document.createTextNode(String(x)))
    );
  };

  const loadJSON = async url => {
    const r = await fetch(url);

    if (!r.ok) {
      throw new Error(url + ' (' + r.status + ')');
    }

    return r.json();
  };

  const showError = (container, err) => {
    container.replaceChildren(
      el('div', { class: 'note-err' },
        el('p', {}, 'The data could not be loaded (' + err.message + ').'),
        el('p', {},
          'Browsers block ',
          el('code', {}, 'fetch()'),
          ' on files opened directly from disk. Serve the site through a web server, for example by running ',
          el('code', {}, 'python3 -m http.server'),
          ' in the site folder and opening ',
          el('code', {}, 'http://localhost:8000'),
          '.'
        )
      )
    );
  };

  // Edition filter buttons
  const editionFilter = (container, editions, onChange) => {
    const btns = [];

    const make = (id, label) => {
      const b = el('button', {
        type: 'button',
        'aria-pressed': id === null ? 'true' : 'false',
        onclick: () => {
          btns.forEach(x => {
            x.b.setAttribute(
              'aria-pressed',
              x.id === id ? 'true' : 'false'
            );
          });

          onChange(id);
        }
      }, label);

      btns.push({ id, b });
      container.append(b);
    };

    make(null, 'All editions');

    for (const [id, e] of Object.entries(editions)) {
      make(id, e.label);
    }
  };

  const appearances = (list, editions) => {
    const items = (list || []).map(a => {
      const ed = (editions && editions[a.edition]) || {
        label: a.edition
      };

      const name = ed.url
        ? el('a', { href: ed.url }, ed.label)
        : el('strong', {}, ed.label);

      return el(
        'li',
        {},
        name,
        (a.sections && a.sections.length)
          ? ': ' + a.sections.join('; ')
          : ''
      );
    });

    return items.length ? el('ul', {}, items) : null;
  };

  // A titled block; returns null when there is nothing to show
  const section = (title, node) => {
    if (node == null || node === false) return null;

    const f = document.createDocumentFragment();
    f.append(
      el('h3', {}, title),
      node
    );

    return f;
  };

  const linkList = links => {
    const ok = (links || []).filter(l => l && l.url);

    return ok.length
      ? el('ul', {},
        ok.map(l =>
          el('li', {},
            el('a', {
              href: l.url,
              target: '_blank',
              rel: 'noopener'
            }, l.label || l.url)
          )
        )
      )
      : null;
  };

  return {
    el,
    fill,
    loadJSON,
    showError,
    editionFilter,
    appearances,
    section,
    linkList
  };
})();


/* ---------------------------------------------------------------- application */

window.ExploreApp = {};

// Runs one module; if it fails, the reason is shown in the relevant container
async function safely(fn, containerId, what) {
  try {
    await fn();
  } catch (e) {
    console.error(what + ':', e);

    const box = document.getElementById(containerId);

    if (box) {
      const msg = document.createElement('div');
      msg.className = 'note-err';
      msg.textContent =
        'The ' + what + ' could not be shown (' + e.message + ').';

      box.replaceChildren(msg);
    }
  }
}


/* ---------------------------------------------------------------- People */

async function initPeople() {
  return safely(buildPeople, 'p-graphwrap', 'graph');
}

async function buildPeople() {
  const {
    el,
    fill,
    loadJSON,
    showError,
    editionFilter,
    appearances,
    section,
    linkList
  } = Explore;

  const wrap = document.getElementById('p-graphwrap');
  const panel = document.getElementById('p-panel');
  const roster = document.getElementById('p-roster');
  const search = document.getElementById('p-search');

  let data;
  const places = {};

  try {
    data = await loadJSON('data/characters.json');
  } catch (e) {
    showError(wrap, e);
    return;
  }

  try {
    (await loadJSON('data/places.json')).places.forEach(p => {
      places[p.id] = p;
    });
  } catch (e) {
    // Places are optional for the People panel
  }

  data.characters = data.characters || [];
  data.editions = data.editions || {};

  const byId = Object.fromEntries(
    data.characters.map(c => [c.id, c])
  );

  // Skip relations that mention an unknown person
  const edges = (data.relations || [])
    .map(r => ({ ...r }))
    .filter(r => byId[r.source] && byId[r.target]);

  const deg = {};

  edges.forEach(e => {
    deg[e.source] = (deg[e.source] || 0) + 1;
    deg[e.target] = (deg[e.target] || 0) + 1;
  });

  const W = 800;
  const H = 560;

  const nodes = data.characters.map(c => ({
    id: c.id,
    r: Math.min(30, 13 + 3 * (deg[c.id] || 0))
  }));

  let selected = null;
  let activeEd = null;

  const svg = d3.select('#graph')
    .attr('viewBox', `0 0 ${W} ${H}`);

  const link = svg.append('g')
    .selectAll('line')
    .data(edges)
    .join('line')
    .attr('class', 'link');

  const lbl = svg.append('g')
    .selectAll('text')
    .data(edges)
    .join('text')
    .attr('class', 'linklabel')
    .text(d => d.label);

  const node = svg.append('g')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('class', d => 'node ' + byId[d.id].type)
    .attr('tabindex', 0)
    .attr('role', 'button')
    .attr('aria-label', d =>
      [byId[d.id].name, byId[d.id].role]
        .filter(Boolean)
        .join(', ')
    )
    .on('click', (ev, d) => select(d.id))
    .on('keydown', (ev, d) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        select(d.id);
      }
    });

  node.append('circle')
    .attr('r', d => d.r);

  node.append('text')
    .attr('y', d => d.r + 16)
    .text(d => byId[d.id].name);


  /* Force simulation */

  const sim = d3.forceSimulation(nodes)
    .force(
      'link',
      d3.forceLink(edges)
        .id(d => d.id)
        .distance(125)
    )
    .force(
      'charge',
      d3.forceManyBody().strength(-520)
    )
    .force(
      'center',
      d3.forceCenter(W / 2, H / 2)
    )
    .force(
      'collide',
      d3.forceCollide(d => d.r + 26)
    )
    .force(
      'x',
      d3.forceX(W / 2).strength(.04)
    )
    .force(
      'y',
      d3.forceY(H / 2).strength(.06)
    );

  const draw = () => {
    nodes.forEach(d => {
      d.x = Math.max(
        d.r + 30,
        Math.min(W - d.r - 30, d.x)
      );

      d.y = Math.max(
        d.r + 20,
        Math.min(H - d.r - 30, d.y)
      );
    });

    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    lbl
      .attr('x', d => (d.source.x + d.target.x) / 2)
      .attr('y', d => (d.source.y + d.target.y) / 2);

    node.attr(
      'transform',
      d => `translate(${d.x},${d.y})`
    );
  };

  sim.on('tick', draw);

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    sim.stop();
    sim.tick(300);
    draw();
  }

  node.call(
    d3.drag()
      .on('start', (ev, d) => {
        if (!ev.active) {
          sim.alphaTarget(.25).restart();
        }

        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (ev, d) => {
        d.fx = ev.x;
        d.fy = ev.y;
      })
      .on('end', (ev, d) => {
        if (!ev.active) {
          sim.alphaTarget(0);
        }

        d.fx = null;
        d.fy = null;
      })
  );


  /* Graph filtering and highlighting */

  const inEd = id =>
    !activeEd ||
    (byId[id].appearances || [])
      .some(a => a.edition === activeEd);

  const ends = e => [
    e.source.id || e.source,
    e.target.id || e.target
  ];

  const paint = () => {
    const nb = new Set(selected ? [selected] : []);

    if (selected) {
      edges.forEach(e => {
        const [a, b] = ends(e);

        if (a === selected) nb.add(b);
        if (b === selected) nb.add(a);
      });
    }

    node
      .classed('selected', d => d.id === selected)
      .classed('dim', d => !inEd(d.id))
      .classed(
        'faded',
        d => inEd(d.id) && selected && !nb.has(d.id)
      );

    link
      .classed(
        'active',
        e => selected && ends(e).includes(selected)
      )
      .classed(
        'dim',
        e => ends(e).some(id => !inEd(id))
      )
      .classed(
        'faded',
        e =>
          selected &&
          !ends(e).includes(selected) &&
          !ends(e).some(id => !inEd(id))
      );

    lbl.classed(
      'active',
      e =>
        selected &&
        ends(e).includes(selected) &&
        !ends(e).some(id => !inEd(id))
    );
  };


  /* Select a person */

  function select(id) {
    const c = byId[id];

    if (!c) return;

    selected = id;

    // Update selected item in the sidebar
    roster.querySelectorAll('button').forEach(button => {
      button.classList.toggle(
        'selected',
        button.dataset.id === id
      );
    });

    if (window.__setHash) {
      window.__setHash(id);
    }

    const conns = edges
      .filter(e => ends(e).includes(id))
      .map(e => {
        const [a, b] = ends(e);

        return {
          other: a === id ? b : a,
          label: e.label || ''
        };
      })
      .filter(k => byId[k.other]);

    const relPlaces = (c.related_places || [])
      .filter(p => places[p]);

    fill(
      panel,

      el('h2', {}, c.name || id),

      el(
        'div',
        { class: 'chips' },

        el(
          'span',
          { class: 'chip' },
          c.type === 'character'
            ? 'Character'
            : 'Mentioned figure'
        ),

        c.role
          ? el('span', { class: 'chip' }, c.role)
          : null
      ),

      c.description
        ? el('p', {}, c.description)
        : null,

      section(
        'Where it appears',
        appearances(c.appearances, data.editions)
      ),

      conns.length
        ? section(
          'Connections',
          el(
            'ul',
            {},
            conns.map(k =>
              el(
                'li',
                {},
                el(
                  'button',
                  {
                    class: 'inline',
                    type: 'button',
                    onclick: () => select(k.other)
                  },
                  byId[k.other].name
                ),
                k.label
                  ? ' — ' + k.label
                  : null
              )
            )
          )
        )
        : null,

      relPlaces.length
        ? section(
          'Places',
          el(
            'ul',
            {},
            relPlaces.map(p =>
              el(
                'li',
                {},
                el(
                  'a',
                  { href: '#' + p },
                  places[p].name
                )
              )
            )
          )
        )
        : null,

      section(
        'Authority records',
        linkList(c.links)
      )
    );

    paint();
  }


  /* Edition filters */

  editionFilter(
    document.getElementById('p-filters'),
    data.editions,
    id => {
      activeEd = id;
      paint();
      filterRoster();
    }
  );


  /* Sidebar list */

  data.characters.forEach(c => {
    roster.append(
      el(
        'button',
        {
          type: 'button',
          'data-id': c.id,
          onclick: () => select(c.id)
        },
        c.name,
        el('small', {}, c.role || '')
      )
    );
  });


  /* Search and edition filtering */

  function filterRoster() {
    const query = search.value
      .trim()
      .toLocaleLowerCase();

    roster.querySelectorAll('button').forEach(button => {
      const c = byId[button.dataset.id];

      const text = `${c.name || ''} ${c.role || ''}`
        .toLocaleLowerCase();

      const matchesSearch = text.includes(query);

      const matchesEdition =
        !activeEd ||
        (c.appearances || [])
          .some(a => a.edition === activeEd);

      button.hidden = !(matchesSearch && matchesEdition);
    });
  }

  search.addEventListener('input', filterRoster);
  filterRoster();


  /* Initial selection */

  window.ExploreApp.people = {
    select,
    byId
  };

  const start = location.hash.slice(1);

  select(
    byId[start]
      ? start
      : (byId.JO ? 'JO' : (data.characters[0] || {}).id)
  );
}


/* ---------------------------------------------------------------- Places */

async function initPlaces() {
  return safely(buildPlaces, 'l-mapwrap', 'map');
}

async function buildPlaces() {
  const {
    el,
    fill,
    loadJSON,
    showError,
    editionFilter,
    appearances,
    section,
    linkList
  } = Explore;

  const wrap = document.getElementById('l-mapwrap');
  const panel = document.getElementById('l-panel');
  const roster = document.getElementById('l-roster');
  const search = document.getElementById('l-search');

  let data;
  const chars = {};

  try {
    data = await loadJSON('data/places.json');
  } catch (e) {
    showError(wrap, e);
    return;
  }

  try {
    (await loadJSON('data/characters.json'))
      .characters.forEach(c => {
        chars[c.id] = c;
      });
  } catch (e) {
    // Characters are optional for the Places panel
  }

  data.places = data.places || [];
  data.editions = data.editions || {};

  const byId = Object.fromEntries(
    data.places.map(p => [p.id, p])
  );

  // Places without coordinates are listed but not drawn
  const places = data.places.filter(p =>
    Number.isFinite(+p.lat) &&
    Number.isFinite(+p.lon)
  );

  const TYPE = {
    city: 'City',
    hills: 'Hills',
    country: 'Country'
  };

  const SAGE = '#8FA69B';
  const SLATE = '#6D8794';
  const INK = '#2E3A3F';

  if (typeof L === 'undefined') {
    throw new Error(
      'Leaflet did not load: check the Leaflet <link> and <script> tags in explore.html'
    );
  }

  const mapEl = document.getElementById('map');

  const map = L.map(mapEl, {
    zoomControl: true,
    scrollWheelZoom: false
  }).setView([43.5, 11.5], 6);

  L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
  ).addTo(map);


  /* Map markers */

  const style = (p, sel) => ({
    radius: sel ? 13 : 9,
    color: sel ? INK : SLATE,
    weight: sel ? 2.5 : 1.5,
    fillColor: sel ? SLATE : SAGE,
    fillOpacity: p.type === 'city' ? .9 : .35,
    dashArray: p.type === 'city' ? null : '4 3'
  });

  const markers = {};

  let selected = null;
  let activeEd = null;

  places.forEach(p => {
    const m = L.circleMarker(
      [+p.lat, +p.lon],
      style(p, false)
    )
      .bindTooltip(
        p.name || p.id,
        {
          direction: 'top',
          offset: [0, -8]
        }
      )
      .addTo(map);

    m.on('click', () => select(p.id));

    markers[p.id] = m;
  });


  /* Map filtering */

  const inEd = p =>
    !activeEd ||
    (p.appearances || [])
      .some(a => a.edition === activeEd);

  const refit = () => {
    map.invalidateSize();

    const vis = places
      .filter(inEd)
      .map(p => [+p.lat, +p.lon]);

    if (vis.length > 1) {
      map.fitBounds(vis, {
        padding: [50, 50]
      });
    } else if (vis.length) {
      map.setView(vis[0], 9);
    }
  };


  // Resize map when its tab becomes visible
  let sized = false;

  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      if (!mapEl.offsetWidth) return;

      map.invalidateSize();

      if (!sized) {
        sized = true;
        refit();
      }
    }).observe(mapEl);
  }


  const paint = () => {
    places.forEach(p => {
      const on = inEd(p);
      const m = markers[p.id];

      if (on && !map.hasLayer(m)) {
        m.addTo(map);
      }

      if (!on && map.hasLayer(m)) {
        map.removeLayer(m);
      }

      m.setStyle(style(p, p.id === selected));
    });

    if (
      selected &&
      markers[selected] &&
      map.hasLayer(markers[selected])
    ) {
      markers[selected].bringToFront();
    }
  };


  /* Select a place */

  function select(id, pan) {
    const p = byId[id];

    if (!p) return;

    selected = id;

    // Update selected item in the sidebar
    roster.querySelectorAll('button').forEach(button => {
      button.classList.toggle(
        'selected',
        button.dataset.id === id
      );
    });

    if (window.__setHash) {
      window.__setHash(id);
    }

    const rel = (p.related_characters || [])
      .filter(c => chars[c]);

    fill(
      panel,

      el('h2', {}, p.name || id),

      el(
        'div',
        { class: 'chips' },

        (TYPE[p.type] || p.type)
          ? el(
            'span',
            { class: 'chip' },
            TYPE[p.type] || p.type
          )
          : null,

        p.role
          ? el('span', { class: 'chip' }, p.role)
          : null
      ),

      p.description
        ? el('p', {}, p.description)
        : null,

      section(
        'Where it appears',
        appearances(p.appearances, data.editions)
      ),

      rel.length
        ? section(
          'Related people',
          el(
            'ul',
            {},
            rel.map(c =>
              el(
                'li',
                {},
                el(
                  'a',
                  { href: '#' + c },
                  chars[c].name
                )
              )
            )
          )
        )
        : null,

      section(
        'Authority records',
        linkList(p.links)
      )
    );

    paint();

    if (
      pan &&
      markers[id] &&
      map.hasLayer(markers[id])
    ) {
      map.panTo([+p.lat, +p.lon]);
    }
  }


  /* Edition filters */

  editionFilter(
    document.getElementById('l-filters'),
    data.editions,
    id => {
      activeEd = id;
      paint();
      refit();
      filterRoster();
    }
  );


  /* Sidebar list */

  data.places.forEach(p => {
    roster.append(
      el(
        'button',
        {
          type: 'button',
          'data-id': p.id,
          onclick: () => select(p.id, true)
        },
        p.name,
        el(
          'small',
          {},
          TYPE[p.type] || p.type || ''
        )
      )
    );
  });


  /* Search and edition filtering */

  function filterRoster() {
    const query = search.value
      .trim()
      .toLocaleLowerCase();

    roster.querySelectorAll('button').forEach(button => {
      const p = byId[button.dataset.id];

      const text =
        `${p.name || ''} ${p.role || ''} ${p.type || ''}`
          .toLocaleLowerCase();

      const matchesSearch = text.includes(query);

      const matchesEdition =
        !activeEd ||
        (p.appearances || [])
          .some(a => a.edition === activeEd);

      button.hidden = !(matchesSearch && matchesEdition);
    });
  }

  search.addEventListener('input', filterRoster);
  filterRoster();


  /* Initial map and selection */

  refit();

  window.ExploreApp.places = {
    select,
    byId,
    map,
    refit
  };

  const start = location.hash.slice(1);

  select(
    byId[start]
      ? start
      : (data.places[0] || {}).id
  );
}


/* ---------------------------------------------------------------- Author: vertical timeline */

async function initAuthor() {
  const { loadJSON, showError } = Explore;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);

    if (cls) n.className = cls;
    if (text != null) n.textContent = text;

    return n;
  };

  const wrap = document.getElementById('a-wrap');

  let data;

  try {
    data = await loadJSON('data/timeline.json');
  } catch (e) {
    showError(wrap, e);
    return;
  }

  let placeNames = {};

  try {
    (await loadJSON('data/places.json'))
      .places.forEach(p => {
        placeNames[p.id] = p.name;
      });
  } catch (e) {
    // Links can still use the place ID
  }

  const filters = document.getElementById('a-filters');
  const list = document.getElementById('a-list');
  const progress = document.getElementById('a-progress');

  const items = [];


  /* Open and close timeline events */

  function setOpen(item, open) {
    item.head.setAttribute(
      'aria-expanded',
      String(open)
    );

    item.body.hidden = !open;
    item.li.classList.toggle('open', open);
  }


  /* Build timeline */

  (data.events || []).forEach(e => {
    const li = el(
      'li',
      'tl-item type-' + e.type
    );

    li.id = e.id;
    li.dataset.type = e.type;

    const year = el(
      'span',
      'tl-year',
      String(e.year)
    );

    const dot = el('span', 'tl-dot');
    dot.setAttribute('aria-hidden', 'true');

    const card = el('article', 'tl-card');

    const head = el('button', 'tl-head');

    head.type = 'button';
    head.setAttribute('aria-expanded', 'false');
    head.setAttribute(
      'aria-controls',
      e.id + '-body'
    );

    if (e.image) {
      const img = el('img', 'tl-thumb');

      img.src = e.image;
      img.alt = '';
      img.loading = 'lazy';

      head.append(img);
    }

    const txt = el('span', 'tl-txt');

    txt.append(
      el('span', 'tl-date', e.date),
      el('h3', null, e.title)
    );

    if (e.place) {
      txt.append(
        el('span', 'tl-place', e.place)
      );
    }

    head.append(
      txt,
      el('span', 'tl-chev', '›')
    );

    const body = el('div', 'tl-body');

    body.id = e.id + '-body';
    body.hidden = true;

    body.append(
      el('p', null, e.description)
    );

    const links = el('p', 'tl-links');

    (e.places || []).forEach(p => {
      const a = el(
        'a',
        'tl-link',
        'Show ' + (placeNames[p] || p) + ' on the map'
      );

      a.href = '#' + p;
      links.append(a);
    });

    if (e.edition) {
      const a = el(
        'a',
        'tl-link',
        'Read this edition →'
      );

      a.href = 'edition.html?ed=' + e.edition;
      links.append(a);
    }

    if (links.children.length) {
      body.append(links);
    }

    card.append(head, body);
    li.append(year, dot, card);
    list.append(li);

    const item = {
      li,
      head,
      body,
      data: e
    };

    head.addEventListener('click', () => {
      setOpen(item, body.hidden);
    });

    items.push(item);
  });


  /* Filter by type */

  const makeBtn = (id, label) => {
    const b = el('button', null, label);

    b.type = 'button';
    b.dataset.type = id;

    b.setAttribute(
      'aria-pressed',
      String(id === '')
    );

    b.addEventListener('click', () => {
      filters.querySelectorAll('button').forEach(x => {
        x.setAttribute(
          'aria-pressed',
          String(x === b)
        );
      });

      items.forEach(it => {
        it.li.hidden =
          id !== '' && it.data.type !== id;
      });

      measure();
    });

    filters.append(b);
  };

  makeBtn('', 'Everything');

  Object.entries(data.types || {}).forEach(([id, label]) => {
    makeBtn(id, label);
  });


  /* Reveal on scroll and timeline progress */

  const reduce = matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver(
      es => es.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      }),
      {
        rootMargin: '0px 0px -10% 0px'
      }
    );

    items.forEach(it => io.observe(it.li));
  } else {
    items.forEach(it => {
      it.li.classList.add('in');
    });
  }


  function measure() {
    const r = list.getBoundingClientRect();

    const done = Math.max(
      0,
      Math.min(
        r.height,
        window.innerHeight * 0.55 - r.top
      )
    );

    progress.style.height = done + 'px';
  }

  let ticking = false;

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;

      ticking = true;

      requestAnimationFrame(() => {
        ticking = false;
        measure();
      });
    },
    { passive: true }
  );

  window.addEventListener('resize', measure);

  measure();


  /* Open a specific event from its URL */

  window.ExploreApp.author = {
    open(id) {
      const it = items.find(x => x.data.id === id);

      if (!it) return;

      if (it.li.hidden) {
        filters.querySelector('button').click();
      }

      it.li.classList.add('in');

      setOpen(it, true);

      it.li.scrollIntoView({
        block: 'center',
        behavior: reduce ? 'auto' : 'smooth'
      });
    }
  };
}


/* ---------------------------------------------------------------- tabs and addresses */

(() => {
  const NAMES = [
    'people',
    'places',
    'author'
  ];

  const tabs = NAMES.map(n =>
    document.getElementById('tab-' + n)
  );

  const panels = NAMES.map(n =>
    document.getElementById('panel-' + n)
  );

  const peopleReady = initPeople();

  let placesReady = null;
  let authorReady = null;

  const ensurePlaces = () =>
    placesReady || (placesReady = initPlaces());

  const ensureAuthor = () =>
    authorReady || (authorReady = initAuthor());


  /* Collect IDs for URL navigation */

  const placeIds = new Set();
  const eventIds = new Set();

  const idsReady = Promise.all([
    Explore.loadJSON('data/places.json')
      .then(d => {
        d.places.forEach(p => placeIds.add(p.id));
      })
      .catch(() => { }),

    Explore.loadJSON('data/timeline.json')
      .then(d => {
        d.events.forEach(e => eventIds.add(e.id));
      })
      .catch(() => { })
  ]);


  /* Switch tabs */

  async function showTab(name, focus) {
    NAMES.forEach((n, i) => {
      const on = n === name;

      tabs[i].setAttribute(
        'aria-selected',
        String(on)
      );

      tabs[i].tabIndex = on ? 0 : -1;
      panels[i].hidden = !on;
    });

    if (focus) {
      tabs[NAMES.indexOf(name)].focus();
    }

    if (name === 'places') {
      // Let the browser lay out the tab before measuring the map
      await new Promise(r =>
        requestAnimationFrame(r)
      );

      if (!window.ExploreApp.places) {
        placesReady = null;
      }

      await ensurePlaces();

      const a = window.ExploreApp.places;

      if (a) {
        a.map.invalidateSize();
        a.refit();
      }
    }

    if (name === 'author') {
      ensureAuthor();
    }
  }


  /* Navigate according to the URL hash */

  async function route() {
    let h = '';

    try {
      h = decodeURIComponent(
        location.hash.slice(1)
      );
    } catch (e) {
      // A malformed address is treated as empty
    }

    await idsReady;

    if (NAMES.includes(h)) {
      await showTab(h);
      return;
    }

    if (placeIds.has(h)) {
      await showTab('places');

      const a = window.ExploreApp.places;

      if (a) {
        a.select(h, true);
      }

      return;
    }

    if (eventIds.has(h)) {
      await showTab('author');
      await ensureAuthor();

      window.ExploreApp.author.open(h);

      return;
    }

    await showTab('people');
    await peopleReady;

    const a = window.ExploreApp.people;

    if (a && a.byId[h]) {
      a.select(h);
    }
  }


  /* Tab interaction */

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => {
      history.replaceState(
        null,
        '',
        '#' + NAMES[i]
      );

      showTab(NAMES[i]);
    });

    t.addEventListener('keydown', e => {
      if (
        e.key !== 'ArrowRight' &&
        e.key !== 'ArrowLeft'
      ) {
        return;
      }

      const next = (
        i +
        (e.key === 'ArrowRight'
          ? 1
          : NAMES.length - 1)
      ) % NAMES.length;

      history.replaceState(
        null,
        '',
        '#' + NAMES[next]
      );

      showTab(NAMES[next], true);
    });
  });


  /* Hash changes */

  window.addEventListener(
    'hashchange',
    () => route().catch(console.error)
  );

  route()
    .catch(console.error)
    .then(() => {
      window.__setHash = id => {
        history.replaceState(
          null,
          '',
          '#' + id
        );
      };
    });

})();