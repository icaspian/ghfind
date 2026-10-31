const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Intl.NumberFormat('en', { notation: 'compact' }).format(n);
const ls = {
  g(k, d) { try { return JSON.parse(localStorage.getItem('ghf_'+k)) ?? d } catch { return d } },
  s(k, v) { localStorage.setItem('ghf_'+k, JSON.stringify(v)) }
};

const s = {
  q: '', p: 1, l: '', sr: '', st: '', ag: '',
  lic: '', mf: '', arch: 'exclude',
  bz: false, v: ls.g('v', 'grid'),
  tok: sessionStorage.getItem('ghf_tok') || '',
  favs: ls.g('favs', []), hist: ls.g('hist', []), cmp: [],
  focusIdx: -1
};

let ac, debT;

const LANG_COLORS = {
  'Lua':'#00ffcc','Python':'#a8f04a','Rust':'#ff5c3d','Go':'#00d4ff',
  'JavaScript':'#f7df1e','TypeScript':'#00a8ff','C':'#7a7a7a','C++':'#ff2e97',
  'Zig':'#ff9d00','Java':'#ff7a3d','Ruby':'#ff2e63','Haskell':'#b47aff',
  'Shell':'#4ade80','Vim script':'#7dff4d','Nix':'#7dc4ff'
};
const langColor = l => LANG_COLORS[l] || '#00ffcc';

/* ── toast queue ─────────────────────────────────────────────── */
const toastQ = [];
let toastBusy = false;
function toast(msg) {
  toastQ.push(msg);
  if (!toastBusy) nextToast();
}
function nextToast() {
  if (!toastQ.length) { toastBusy = false; return; }
  toastBusy = true;
  const t = $('#toast');
  t.textContent = toastQ.shift();
  t.classList.add('on');
  setTimeout(() => {
    t.classList.remove('on');
    setTimeout(nextToast, 220);
  }, 1900);
}

/* ── helpers ─────────────────────────────────────────────────── */
function setChip(sel, val) {
  $$(`${sel} .chip`).forEach(c => c.classList.toggle('on', c.dataset.v === val));
}

function safeMd(src) {
  if (!src) return '';
  let o = esc(src);
  o = o.replace(/^### (.*$)/gm, '<h3 style="margin:1rem 0 .5rem;font-family:var(--f-d)">$1</h3>');
  o = o.replace(/^## (.*$)/gm,  '<h2 style="margin:1rem 0 .5rem;font-family:var(--f-d)">$1</h2>');
  o = o.replace(/^# (.*$)/gm,   '<h1 style="margin:1rem 0 .5rem;font-family:var(--f-d)">$1</h1>');
  o = o.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  o = o.replace(/\*(.*?)\*/g,    '<em>$1</em>');
  o = o.replace(/`([^`]+)`/g, '<code style="background:#ffffff1a;padding:2px 4px;border-radius:4px;font-family:var(--f-m);font-size:.85rem;">$1</code>');
  o = o.replace(/\n/g, '<br>');
  return o;
}

/* ── seen cache ──────────────────────────────────────────────── */
function isSeen(name) { return !!ls.g('seen', {})[name]; }
function markSeen(name) {
  const seen = ls.g('seen', {});
  if (seen[name]) return;
  seen[name] = 1;
  const keys = Object.keys(seen);
  if (keys.length > 2000) delete seen[keys[0]];
  ls.s('seen', seen);
}

/* ── query builder ───────────────────────────────────────────── */
function buildQuery() {
  let qq = s.q;
  if (s.l)   qq += ` language:${s.l}`;
  if (s.st)  qq += ` stars:>=${s.st}`;
  if (s.ag)  { const d = new Date(); d.setDate(d.getDate() - +s.ag); qq += ` pushed:>${d.toISOString().slice(0,10)}`; }
  if (s.lic) qq += ` license:${s.lic}`;
  if (s.mf)  qq += ` forks:>=${s.mf}`;
  if (s.arch === 'only')         qq += ` archived:true`;
  else if (s.arch === 'exclude') qq += ` archived:false`;
  return qq.trim();
}

/* ── URL hash sync ───────────────────────────────────────────── */
function syncHash() {
  const p = new URLSearchParams();
  if (s.q)   p.set('q', s.q);
  if (s.l)   p.set('l', s.l);
  if (s.sr)  p.set('sr', s.sr);
  if (s.st)  p.set('st', s.st);
  if (s.ag)  p.set('ag', s.ag);
  if (s.lic) p.set('lic', s.lic);
  if (s.mf)  p.set('mf', s.mf);
  if (s.arch !== 'exclude') p.set('arch', s.arch);
  const h = p.toString();
  history.replaceState(null, '', h ? '#' + h : location.pathname);
}

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  s.q   = p.get('q')   || '';
  s.l   = p.get('l')   || '';
  s.sr  = p.get('sr')  || '';
  s.st  = p.get('st')  || '';
  s.ag  = p.get('ag')  || '';
  s.lic = p.get('lic') || '';
  s.mf  = p.get('mf')  || '';
  s.arch = p.get('arch') || 'exclude';

  $('#q').value = s.q;
  setChip('#langs', s.l);
  setChip('#sorts', s.sr);
  setChip('#stars', s.st);
  setChip('#age',   s.ag);
  setChip('#lic',   s.lic);
  setChip('#forks', s.mf);
  setChip('#arch',  s.arch);
}

/* ── skeleton loader ─────────────────────────────────────────── */
function renderSkeleton(n = 6) {
  const grid = $('#grid');
  grid.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'card skel';
    el.innerHTML = `
      <div class="ch"><div class="sk-av"></div><div class="sk-line" style="flex:1"></div></div>
      <div class="sk-line" style="width:90%"></div>
      <div class="sk-line" style="width:70%"></div>
      <div class="sk-line" style="width:50%;margin-top:1rem"></div>`;
    grid.appendChild(el);
  }
}

/* ── search ──────────────────────────────────────────────────── */
async function run(q, p = 1) {
  if (!q.trim() || s.bz) return;
  s.bz = true; s.q = q; s.p = p; s.focusIdx = -1;

  if (p === 1) renderSkeleton();
  if (ac) ac.abort();
  ac = new AbortController();

  const qq = buildQuery();
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(qq)}&per_page=12&page=${p}${s.sr ? `&sort=${s.sr}&order=desc` : ''}`;
  const h = { Accept: 'application/vnd.github+json' };
  if (s.tok) h.Authorization = `Bearer ${s.tok}`;

  $('#proto').textContent = `ghfind://search?q=${encodeURIComponent(q)}`;
  $('#status').innerHTML = '<span class="mload">[ searching ]</span>';

  try {
    const res = await fetch(url, { signal: ac.signal, headers: h });
    if (res.headers.has('X-RateLimit-Remaining')) {
      $('#rate').textContent = `${res.headers.get('X-RateLimit-Remaining')}/${res.headers.get('X-RateLimit-Limit')}`;
    }
    if (!res.ok) throw new Error((await res.json()).message || res.statusText);
    const d = await res.json();

    $('#status').innerHTML = `<span class="ok">[ ok ]</span> ${fmt(d.total_count)} repos`;
    render(d.items || [], p > 1);
    $('#more').hidden = (d.items||[]).length < 12 || p * 12 >= Math.min(d.total_count, 1000);

    if (p === 1) {
      s.hist = [q, ...s.hist.filter(x => x !== q)].slice(0, 50);
      ls.s('hist', s.hist);
    }
    syncHash();
    $('#vp').scrollTo({ top: $('#search').offsetTop - 20, behavior: 'smooth' });
  } catch (e) {
    if (e.name !== 'AbortError')
      $('#status').innerHTML = `<span class="err-mark" style="color:var(--er)">[ err ]</span> ${esc(e.message)}`;
  } finally {
    s.bz = false;
  }
}

function render(items, append = false) {
  const grid = $('#grid');
  if (!append) grid.innerHTML = '';
  if (!items.length && !append) {
    grid.innerHTML = '<p class="empty">// no results</p>';
    $('#stats').hidden = true;
    return;
  }
  items.forEach((r, i) => grid.appendChild(card(r, i)));
  if (!append) {
    const counts = {};
    items.forEach(r => { const l = r.language || 'Other'; counts[l] = (counts[l] || 0) + 1; });
    const bar = $('#stats');
    if (items.length > 1) {
      bar.innerHTML = '<span class="stat"><b>// lang</b></span>';
      Object.entries(counts).sort((a,b) => b[1]-a[1]).forEach(([l, n]) => {
        const el = document.createElement('span');
        el.className = 'stat';
        el.innerHTML = `<span class="sw" style="background:${langColor(l)}"></span>${esc(l)} <b>${n}</b>`;
        el.onclick = () => { s.l = l.toLowerCase(); setChip('#langs', s.l); if (s.q) run(s.q); };
        bar.appendChild(el);
      });
      bar.hidden = false;
    } else bar.hidden = true;
  }
}

function card(r, i) {
  const c = document.createElement('article');
  c.className = 'card';
  c.style.animationDelay = `${i * 30}ms`;
  c.dataset.name = r.full_name;
  const fav = s.favs.some(f => f.full_name === r.full_name);
  const inC = s.cmp.includes(r.full_name);
  const fresh = !isSeen(r.full_name);

  c.innerHTML = `
    <div class="ch">
      <img class="av" src="${esc(r.owner?.avatar_url || '')}" loading="lazy">
      <a class="repo" href="${esc(r.html_url)}" target="_blank">${esc(r.full_name)}</a>
      ${fresh ? '<span class="new-dot" title="new"></span>' : ''}
      <button class="fav ${fav?'on':''}">${fav?'★':'☆'}</button>
      <button class="cmp ${inC?'on':''}">⊕</button>
    </div>
    <p class="desc">${esc(r.description || '—')}</p>
    ${r.topics?.length ? `<div class="topics">${r.topics.slice(0,4).map(t => `<span class="topic">#${esc(t)}</span>`).join('')}</div>` : ''}
    <div class="cf">
      ${r.language ? `<span class="pill" style="--lc:${langColor(r.language)}">${esc(r.language)}</span>` : ''}
      <span class="metric">★ ${fmt(r.stargazers_count)}</span>
      <span class="metric">⌥ ${fmt(r.forks_count)}</span>
      <span class="metric">! ${fmt(r.open_issues_count)}</span>
    </div>
    <div class="ca">
      <a class="act" href="${esc(r.html_url)}" target="_blank">OPEN ↗</a>
      <button class="act cp">COPY</button>
      <button class="act cl">CLONE</button>
      <button class="act dt">INFO</button>
    </div>`;

  c.addEventListener('mousemove', e => {
    const rect = c.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    c.style.setProperty('--mx', `${x}px`);
    c.style.setProperty('--my', `${y}px`);
    const cx = rect.width / 2, cy = rect.height / 2;
    c.style.transform = `perspective(1000px) rotateX(${((y - cy) / cy) * -3}deg) rotateY(${((x - cx) / cx) * 3}deg) scale3d(1.01,1.01,1.01)`;
  });
  c.addEventListener('mouseleave', () => c.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1,1,1)');

  c.querySelector('.fav').onclick = e => {
    markSeen(r.full_name);
    const idx = s.favs.findIndex(f => f.full_name === r.full_name);
    if (idx >= 0) s.favs.splice(idx, 1);
    else s.favs.unshift({ full_name: r.full_name, html_url: r.html_url, description: r.description, stars: r.stargazers_count, owner: r.owner?.avatar_url });
    ls.s('favs', s.favs);
    $('#fc').textContent = s.favs.length;
    e.target.classList.toggle('on');
    e.target.textContent = e.target.classList.contains('on') ? '★' : '☆';
    toast(idx >= 0 ? 'removed' : '★ saved');
  };
  c.querySelector('.cmp').onclick = e => {
    const idx = s.cmp.indexOf(r.full_name);
    if (idx >= 0) s.cmp.splice(idx, 1);
    else s.cmp.push(r.full_name);
    e.target.classList.toggle('on');
    updateBulk();
    toast(`${s.cmp.length} selected`);
  };
  c.querySelector('.cp').onclick = () => { markSeen(r.full_name); navigator.clipboard.writeText(r.html_url); toast('url copied'); };
  c.querySelector('.cl').onclick = () => { markSeen(r.full_name); navigator.clipboard.writeText(`git clone ${r.clone_url || r.html_url + '.git'}`); toast('clone cmd copied'); };
  c.querySelector('.dt').onclick = () => { markSeen(r.full_name); openModal(r); };

  return c;
}

/* ── modal (with extra data) ─────────────────────────────────── */
async function openModal(r) {
  const m = $('#modal'), b = $('#mbody');
  const h = { Accept: 'application/vnd.github+json' };
  if (s.tok) h.Authorization = `Bearer ${s.tok}`;

  b.innerHTML = `
    <div class="mh">
      <img class="mav" src="${esc(r.owner?.avatar_url||'')}">
      <div style="flex:1">
        <h3 class="mtitle">${esc(r.full_name)}</h3>
        <div class="mowner">// ${esc(r.owner?.login||'')}</div>
        <p>${esc(r.description||'—')}</p>
      </div>
    </div>
    <div class="mstats">
      <div class="mstat"><div class="v">${fmt(r.stargazers_count)}</div><div class="l">stars</div></div>
      <div class="mstat"><div class="v">${fmt(r.forks_count)}</div><div class="l">forks</div></div>
      <div class="mstat"><div class="v">${fmt(r.open_issues_count)}</div><div class="l">issues</div></div>
    </div>
    <div id="mextra"></div>
    <div id="mreadme" class="mreadme"><div class="mload">loading...</div></div>
    <div class="macts">
      <a class="mbtn primary" href="${esc(r.html_url)}" target="_blank">OPEN ↗</a>
      <button class="mbtn" id="m-fav">${s.favs.some(f=>f.full_name===r.full_name) ? '★ UNFAV' : '☆ FAV'}</button>
      <button class="mbtn" id="m-cp">COPY URL</button>
      <button class="mbtn" id="m-cl">COPY CLONE</button>
    </div>`;

  m.hidden = false; requestAnimationFrame(() => m.classList.add('on'));

  b.querySelector('#m-fav').onclick = e => {
    const idx = s.favs.findIndex(f => f.full_name === r.full_name);
    if (idx >= 0) s.favs.splice(idx, 1);
    else s.favs.unshift({ full_name: r.full_name, html_url: r.html_url, description: r.description, stars: r.stargazers_count, owner: r.owner?.avatar_url });
    ls.s('favs', s.favs); $('#fc').textContent = s.favs.length;
    e.target.textContent = idx >= 0 ? '☆ FAV' : '★ UNFAV';
  };
  b.querySelector('#m-cp').onclick = () => { navigator.clipboard.writeText(r.html_url); toast('copied'); };
  b.querySelector('#m-cl').onclick = () => { navigator.clipboard.writeText(`git clone ${r.clone_url || r.html_url + '.git'}`); toast('copied'); };

  const [readmeRes, relsRes, contribsRes, langsRes] = await Promise.allSettled([
    fetch(`https://api.github.com/repos/${r.full_name}/readme`, { headers: { ...h, Accept: 'application/vnd.github.raw' } }).then(res => res.ok ? res.text() : ''),
    fetch(`https://api.github.com/repos/${r.full_name}/releases?per_page=3`, { headers: h }).then(res => res.ok ? res.json() : []),
    fetch(`https://api.github.com/repos/${r.full_name}/contributors?per_page=5`, { headers: h }).then(res => res.ok ? res.json() : []),
    fetch(`https://api.github.com/repos/${r.full_name}/languages`, { headers: h }).then(res => res.ok ? res.json() : {})
  ]);

  const extra = b.querySelector('#mextra');

  if (langsRes.status === 'fulfilled' && Object.keys(langsRes.value).length) {
    const total = Object.values(langsRes.value).reduce((a,c) => a+c, 0);
    let langHtml = '<div style="margin-top:1.5rem"><div class="mload" style="margin-bottom:.5rem">// LANGUAGES</div><div style="display:flex;height:8px;border-radius:4px;overflow:hidden;gap:2px;">';
    Object.entries(langsRes.value).sort((a,c) => c[1]-a[1]).forEach(([l, v]) => {
      langHtml += `<div style="width:${(v/total)*100}%;background:${langColor(l)}" title="${l}"></div>`;
    });
    langHtml += '</div><div style="display:flex;gap:1rem;margin-top:.5rem;font-size:.8rem;color:var(--mt)">';
    Object.entries(langsRes.value).sort((a,c) => c[1]-a[1]).slice(0,3).forEach(([l, v]) => {
      langHtml += `<span><span style="color:${langColor(l)}">●</span> ${l} ${((v/total)*100).toFixed(1)}%</span>`;
    });
    langHtml += '</div></div>';
    extra.innerHTML += langHtml;
  }

  if (relsRes.status === 'fulfilled' && relsRes.value.length) {
    extra.innerHTML += `<div style="margin-top:2rem"><div class="mload" style="margin-bottom:.5rem">// RELEASES</div>${relsRes.value.map(rel => `
      <div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--bd);font-size:.9rem;">
        <span style="color:var(--ac);font-weight:bold">${esc(rel.tag_name)}</span>
        <span style="flex:1;margin-left:1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(rel.name || '')}</span>
      </div>`).join('')}</div>`;
  }

  if (contribsRes.status === 'fulfilled' && contribsRes.value.length) {
    extra.innerHTML += `<div style="margin-top:2rem"><div class="mload" style="margin-bottom:.5rem">// CONTRIBUTORS</div><div style="display:flex;gap:.5rem;flex-wrap:wrap;">${contribsRes.value.map(c => `
      <a href="${esc(c.html_url)}" target="_blank" style="display:flex;align-items:center;gap:.5rem;background:#ffffff08;padding:.2rem .6rem .2rem .2rem;border-radius:99px;font-size:.8rem;font-family:var(--f-m);border:1px solid var(--bd);">
        <img src="${esc(c.avatar_url)}" style="width:20px;height:20px;border-radius:50%;"><span>${esc(c.login)}</span>
      </a>`).join('')}</div></div>`;
  }

  const readmeEl = b.querySelector('#mreadme');
  if (readmeRes.status === 'fulfilled' && readmeRes.value) {
    readmeEl.innerHTML = `<div style="line-height:1.6;font-size:.95rem">${safeMd(readmeRes.value.slice(0, 10000))}</div>`;
  } else {
    readmeEl.innerHTML = '<div class="mload">// no readme</div>';
  }
}

function closeModal() {
  const m = $('#modal');
  m.classList.remove('on');
  setTimeout(() => m.hidden = true, 300);
}
function closeDrawer() {
  const d = $('#drawer');
  d.classList.remove('on');
  setTimeout(() => d.hidden = true, 300);
}

/* ── bulk action bar ────────────────────────────────────────── */
function updateBulk() {
  const bar = $('#bulkbar');
  if (!s.cmp.length) { bar.hidden = true; return; }
  bar.hidden = false;
  $('#bulkcount').textContent = `${s.cmp.length} selected`;
}
function clearSelection() {
  s.cmp = [];
  $$('.card .cmp.on').forEach(b => b.classList.remove('on'));
  updateBulk();
}

/* ── export / import ────────────────────────────────────────── */
function exportData() {
  const data = {
    version: 1,
    exported: new Date().toISOString(),
    favs: s.favs, hist: s.hist,
    seen: ls.g('seen', {}),
    view: s.v
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ghfind-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast('exported');
}

/* ── command palette ────────────────────────────────────────── */
const CMDS = [
  { k: 'focus search',       i: '/', run: () => $('#q').focus() },
  { k: 'trending repos',     i: '⚡', run: () => $('#trending').click() },
  { k: 'random repo',        i: '⚄', run: () => $('#rand').click() },
  { k: 'favorites',          i: '★', run: () => $('#nav-favs').click() },
  { k: 'history',            i: '◷', run: () => $('#nav-hist').click() },
  { k: 'settings',           i: '⚙', run: () => $('#nav-settings').click() },
  { k: 'toggle theme',       i: '◐', run: () => $('#theme').click() },
  { k: 'toggle view',        i: '▦', run: () => $('#view').click() },
  { k: 'compare selected',   i: '⊕', run: () => $('#cmp').click() },
  { k: 'toggle filters',     i: '⚙', run: () => $('#adv-btn').click() },
  { k: 'reset filters',      i: '✕', run: () => $('#reset').click() },
  { k: 'export data',        i: '↓', run: exportData },
  { k: 'set token',          i: '🔑', run: () => $('#nav-settings').click() },
];

let cmdkSel = 0;
function openCmdk() {
  $('#cmdk').hidden = false;
  $('#cmdk-input').value = '';
  cmdkSel = 0;
  renderCmds(CMDS);
  setTimeout(() => $('#cmdk-input').focus(), 20);
}
function closeCmdk() { $('#cmdk').hidden = true; }
function renderCmds(cmds) {
  $('#cmdk-list').innerHTML = cmds.map((c, i) => `
    <div class="cmd-item ${i === cmdkSel ? 'sel' : ''}" data-i="${i}">
      <span class="cmdk-ico">${c.i}</span>
      <span class="cmdk-lbl">${esc(c.k)}</span>
    </div>`).join('');
  $$('#cmdk-list .cmd-item').forEach(el => {
    el.onclick = () => { const c = cmds[+el.dataset.i]; closeCmdk(); c.run(); };
  });
}
function filterCmds() {
  const q = $('#cmdk-input').value.toLowerCase();
  return CMDS.filter(c => c.k.toLowerCase().includes(q));
}

/* ── keyboard nav on cards ──────────────────────────────────── */
function setFocus(cards) {
  cards.forEach(c => c.classList.remove('kbd-focus'));
  const c = cards[s.focusIdx];
  if (c) { c.classList.add('kbd-focus'); c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
}

/* ── boot ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  $('#toggle-sb').onclick = () => $('#sb').classList.toggle('collapsed');

  $('#q').onkeydown = e => {
    if (e.key === 'Enter') { clearTimeout(debT); run($('#q').value); }
  };
  $('#q').addEventListener('input', () => {
    clearTimeout(debT);
    const v = $('#q').value.trim();
    if (v.length < 2) return;
    debT = setTimeout(() => run(v), 500);
  });
  $('#go').onclick = () => { clearTimeout(debT); run($('#q').value); };
  $('#more').onclick = () => { s.p++; run(s.q, s.p); };

  $$('#langs .chip').forEach(c => c.onclick = () => { s.l  = c.dataset.v; setChip('#langs',  s.l);  if(s.q) run(s.q); });
  $$('#sorts .chip').forEach(c => c.onclick = () => { s.sr = c.dataset.v; setChip('#sorts',  s.sr); if(s.q) run(s.q); });
  $$('#stars .chip').forEach(c => c.onclick = () => { s.st = c.dataset.v; setChip('#stars',  s.st); if(s.q) run(s.q); });
  $$('#age   .chip').forEach(c => c.onclick = () => { s.ag = c.dataset.v; setChip('#age',    s.ag); if(s.q) run(s.q); });
  $$('#lic   .chip').forEach(c => c.onclick = () => { s.lic = c.dataset.v; setChip('#lic',   s.lic); if(s.q) run(s.q); });
  $$('#forks .chip').forEach(c => c.onclick = () => { s.mf  = c.dataset.v; setChip('#forks', s.mf);  if(s.q) run(s.q); });
  $$('#arch  .chip').forEach(c => c.onclick = () => { s.arch = c.dataset.v; setChip('#arch', s.arch); if(s.q) run(s.q); });

  $('#reset').onclick = () => {
    s.l = s.sr = s.st = s.ag = s.lic = s.mf = '';
    s.arch = 'exclude';
    ['#langs','#sorts','#stars','#age','#lic','#forks'].forEach(sel => setChip(sel, ''));
    setChip('#arch', 'exclude');
    if (s.q) run(s.q);
  };

  $('#adv-btn').onclick = () => {
    const bar = $('#adv-bar');
    bar.hidden = !bar.hidden;
    $('#adv-btn').classList.toggle('on', !bar.hidden);
  };

  $('#trending').onclick = () => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    const iso = d.toISOString().slice(0,10);
    $('#q').value = `created:>${iso} stars:>50`;
    clearTimeout(debT);
    run($('#q').value);
  };

  $('#view').onclick = () => {
    s.v = s.v === 'grid' ? 'list' : 'grid';
    ls.s('v', s.v);
    $('#grid').classList.toggle('list', s.v === 'list');
    $('#view').innerHTML = s.v === 'grid' ? '▦ grid' : '☰ list';
  };

  $('#theme').onclick = () => {
    const d = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = d === 'dark' ? 'light' : 'dark';
    ls.s('theme', document.documentElement.dataset.theme);
  };

  /* ── favorites ─────────────────────────────────────────────── */
  $('#nav-favs').onclick = () => {
    const box = $('#dbody'), act = $('#dactions');
    $('#dtitle').textContent = `FAVORITES [${s.favs.length}]`;
    box.innerHTML = s.favs.length ? '' : '<p class="empty">// empty</p>';
    act.innerHTML = s.favs.length ? '<button class="mbtn" id="fc-clear" style="color:var(--er);border-color:var(--er)">CLEAR</button>' : '';
    s.favs.forEach(f => {
      const d = document.createElement('div');
      d.className = 'ricol';
      d.innerHTML = `<a class="ri" href="${esc(f.html_url)}" target="_blank"><img class="av" src="${esc(f.owner||'')}"><div style="flex:1"><div class="rtitle">${esc(f.full_name)}</div><div class="rsub">${esc(f.description||'')}</div></div></a>
        <div class="rtools"><button class="rm" style="color:var(--er)">REMOVE</button></div>`;
      d.querySelector('.rm').onclick = () => {
        s.favs = s.favs.filter(x => x.full_name !== f.full_name);
        ls.s('favs', s.favs); $('#fc').textContent = s.favs.length; $('#nav-favs').click();
      };
      box.appendChild(d);
    });
    if (s.favs.length) act.querySelector('#fc-clear').onclick = () => {
      if(confirm('clear all?')) { s.favs = []; ls.s('favs', []); $('#fc').textContent = 0; closeDrawer(); }
    };
    $('#drawer').hidden = false;
    requestAnimationFrame(() => $('#drawer').classList.add('on'));
  };

  /* ── history ───────────────────────────────────────────────── */
  $('#nav-hist').onclick = () => {
    const box = $('#dbody');
    $('#dactions').innerHTML = '';
    $('#dtitle').textContent = `HISTORY [${s.hist.length}]`;
    box.innerHTML = s.hist.length ? '' : '<p class="empty">// empty</p>';
    s.hist.forEach(h => {
      const b = document.createElement('button');
      b.className = 'sl';
      b.style.width = '100%'; b.style.padding = '1rem 0'; b.style.border = 'none'; b.style.borderBottom = '1px solid var(--bd)';
      b.innerHTML = `<span style="color:var(--ac)">◇</span> ${esc(h)}`;
      b.onclick = () => { $('#q').value = h; closeDrawer(); run(h); };
      box.appendChild(b);
    });
    $('#drawer').hidden = false;
    requestAnimationFrame(() => $('#drawer').classList.add('on'));
  };

  /* ── settings ──────────────────────────────────────────────── */
  $('#nav-settings').onclick = () => {
    const box = $('#dbody');
    $('#dactions').innerHTML = '';
    $('#dtitle').textContent = 'SETTINGS';
    box.innerHTML = `
      <div style="padding:1rem 0;border-bottom:1px solid var(--bd);display:flex;justify-content:space-between;align-items:center;">
        <div><div class="rsub">GITHUB TOKEN</div><div class="rtitle">${s.tok ? s.tok.slice(0,8)+'…' : '—'}</div></div>
        <button class="mbtn" id="set-tok">${s.tok ? 'CHANGE' : 'ADD'}</button>
      </div>
      <div style="padding:1rem 0;border-bottom:1px solid var(--bd);display:flex;justify-content:space-between;align-items:center;">
        <div><div class="rsub">SEEN CACHE</div><div class="rtitle">${Object.keys(ls.g('seen', {})).length}</div></div>
        <button class="mbtn" id="set-clear-seen">CLEAR</button>
      </div>
      <div style="padding:1rem 0;border-bottom:1px solid var(--bd);display:flex;justify-content:space-between;align-items:center;">
        <div><div class="rsub">BACKUP</div><div class="rtitle">favs · hist · seen</div></div>
        <div style="display:flex;gap:.4rem">
          <button class="mbtn" id="set-export">EXPORT</button>
          <button class="mbtn" id="set-import">IMPORT</button>
        </div>
      </div>
      <div style="padding:1rem 0;display:flex;justify-content:space-between;align-items:center;">
        <div><div class="rsub">ALL DATA</div><div class="rtitle">favs · hist · seen</div></div>
        <button class="mbtn" id="set-reset" style="color:var(--er);border-color:var(--er)">RESET</button>
      </div>`;

    box.querySelector('#set-tok').onclick = () => {
      const t = prompt('paste token', s.tok ? '••••' : '');
      if (t !== null) { s.tok = t.trim(); sessionStorage.setItem('ghf_tok', s.tok); toast('saved'); closeDrawer(); }
    };
    box.querySelector('#set-clear-seen').onclick = () => { ls.s('seen', {}); toast('cleared'); closeDrawer(); };
    box.querySelector('#set-export').onclick = exportData;
    box.querySelector('#set-import').onclick = () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'application/json';
      inp.onchange = async e => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          const data = JSON.parse(await f.text());
          if (Array.isArray(data.favs)) { s.favs = data.favs; ls.s('favs', s.favs); }
          if (Array.isArray(data.hist)) { s.hist = data.hist; ls.s('hist', s.hist); }
          if (data.seen && typeof data.seen === 'object') ls.s('seen', data.seen);
          $('#fc').textContent = s.favs.length;
          toast('imported');
          closeDrawer();
        } catch { toast('invalid file'); }
      };
      inp.click();
    };
    box.querySelector('#set-reset').onclick = () => { if(confirm('reset all?')) { localStorage.clear(); location.reload(); } };
    $('#drawer').hidden = false;
    requestAnimationFrame(() => $('#drawer').classList.add('on'));
  };

  /* ── help ─────────────────
