/* Shared helpers for characters.html and places.html */
const Explore = (() => {
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) { if (kid == null) continue; n.append(kid.nodeType ? kid : document.createTextNode(kid)); }
    return n;
  };
  const loadJSON = async url => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ' (' + r.status + ')');
    return r.json();
  };
  const showError = (container, err) => {
    container.replaceChildren(el('div', { class: 'note-err' },
      el('p', {}, 'The data could not be loaded (' + err.message + ').'),
      el('p', {}, 'Browsers block ', el('code', {}, 'fetch()'), ' on files opened directly from disk. Serve the site through a web server, for example by running ', el('code', {}, 'python3 -m http.server'), ' in the site folder and opening ', el('code', {}, 'http://localhost:8000'), '.')));
  };
  // edition filter buttons; onChange(editionIdOrNull)
  const editionFilter = (container, editions, onChange) => {
    const btns = [];
    const make = (id, label) => {
      const b = el('button', {
        type: 'button', 'aria-pressed': id === null ? 'true' : 'false', onclick: () => {
          btns.forEach(x => x.b.setAttribute('aria-pressed', x.id === id ? 'true' : 'false')); onChange(id);
        }
      }, label);
      btns.push({ id, b }); container.append(b);
    };
    make(null, 'All editions');
    for (const [id, e] of Object.entries(editions)) make(id, e.label);
  };
  const appearances = (list, editions) => el('ul', {}, list.map(a => {
    const ed = editions[a.edition] || { label: a.edition };
    const name = ed.url ? el('a', { href: ed.url }, ed.label) : el('strong', {}, ed.label);
    return el('li', {}, name, ': ', a.sections.join('; '));
  }));
  const section = (title, node) =>
    el('section', {}, el('h3', {}, title), node);
  const linkList = links => el('ul', {}, links.map(l => el('li', {}, el('a', { href: l.url, target: '_blank', rel: 'noopener' }, l.label))));
  return { el, loadJSON, showError, editionFilter, appearances, section, linkList };
})();
