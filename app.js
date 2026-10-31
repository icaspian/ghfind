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

/* ── modal ───────────────────────────────────────────────────── */
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

/* ── export ──────────────────────────────────────────────────── */
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
  { k: 'focus search',     i: '/', run: () => $('#q').focus() },
  { k: 'trending repos',   i: '⚡', run: () => $('#trending').click() },
  { k: 'random repo',      i: '⚄', run: () => $('#rand').click() },
  { k: 'favorites',        i: '★', run: () => $('#nav-favs').click() },
  { k: 'history',          i: '◷', run: () => $('#nav-hist').click() },
  { k: 'settings',         i: '⚙', run: () => $('#nav-settings').click() },
  { k: 'toggle theme',     i: '◐', run: () => $('#theme').click() },
  { k: 'toggle view',      i: '▦', run: () => $('#view').click() },
  { k: 'compare selected', i: '⊕', run: () => $('#cmp').click() },
  { k: 'toggle filters',   i: '⚙', run: () => $('#adv-btn').click() },
  { k: 'reset filters',    i: '✕', run: () => $('#reset').click() },
  { k: 'export data',      i: '↓', run: exportData },
];

let cmdkSel = 0;
let cmdkFiltered = CMDS;
function openCmdk() {
  $('#cmdk').hidden = false;
  $('#cmdk-input').value = '';
  cmdkSel = 0;
  cmdkFiltered = CMDS;
  renderCmds();
  setTimeout(() => $('#cmdk-input').focus(), 20);
}
function closeCmdk() { $('#cmdk').hidden = true; }
function renderCmds() {
  $('#cmdk-list').innerHTML = cmdkFiltered.map((c, i) => `
    <div class="cmd-item ${i === cmdkSel ? 'sel' : ''}" data-i="${i}">
      <span class="cmdk-ico">${c.i}</span>
      <span class="cmdk-lbl">${esc(c.k)}</span>
    </div>`).join('');
  $$('#cmdk-list .cmd-item').forEach(el => {
    el.onclick = () => { const c = cmdkFiltered[+el.dataset.i]; closeCmdk(); c.run(); };
  });
}
function filterCmds() {
  const q = $('#cmdk-input').value.toLowerCase();
  cmdkFiltered = CMDS.filter(c => c.k.toLowerCase().includes(q));
  if (cmdkSel >= cmdkFiltered.length) cmdkSel = Math.max(0, cmdkFiltered.length - 1);
  renderCmds();
}

/* ── compare ─────────────────────────────────────────────────── */
async function openCompare() {
  if (s.cmp.length < 2) return toast('select 2+ first');
  const chosen = s.cmp.slice(0, 4);
  const h = { Accept: 'application/vnd.github+json' };
  if (s.tok) h.Authorization = `Bearer ${s.tok}`;
  const datas = await Promise.all(chosen.map(n =>
    fetch(`https://api.github.com/repos/${n}`, { headers: h }).then(r => r.ok ? r.json() : null)
  ));

  const rows = [
    { l: '★ stars',  v: d => d?.stargazers_count, f: v => fmt(v), best: 'max' },
    { l: '⌥ forks',  v: d => d?.forks_count,      f: v => fmt(v), best: 'max' },
    { l: '! issues', v: d => d?.open_issues_count, f: v => fmt(v), best: 'min' },
    { l: 'lang',     f: d => d?.language || '—' },
    { l: 'license',  f: d => d?.license?.spdx_id || '—' },
    { l: 'updated',  f: d => d ? new Date(d.pushed_at).toLocaleDateString() : '—' }
  ];

  const html = `
    <table style="width:100%;border-collapse:collapse;font-size:.85rem;">
      <thead><tr>
        <th style="text-align:left;padding:.5rem;border-bottom:1px solid var(--bd)">metric</th>
        ${chosen.map(n => `<th style="padding:.5rem;border-bottom:1px solid var(--bd);font-family:var(--f-m);color:var(--ac)">${esc(n.split('/')[1])}</th>`).join('')}
      </tr></thead>
      <tbody>${rows.map(row => {
        let bestIdx = -1;
        if (row.best) {
          const vals = datas.map(row.v);
          const nums = vals.map(v => typeof v === 'number' ? v : -1);
          bestIdx = nums.indexOf(row.best === 'max' ? Math.max(...nums) : Math.min(...nums.filter(v => v >= 0)));
        }
        return `
        <tr>
          <td style="padding:.5rem;border-bottom:1px solid var(--bd);color:var(--mt)">${row.l}</td>
          ${datas.map((d, i) => {
            const cls = i === bestIdx ? 'cmp-win' : '';
            return `<td style="padding:.5rem;border-bottom:1px solid var(--bd);font-family:var(--f-m);" class="${cls}">${esc(row.f(d))}</td>`;
          }).join('')}
        </tr>`;
      }).join('')}
      </tbody>
    </table>`;

  $('#dtitle').textContent = 'COMPARE';
  $('#dactions').innerHTML = '<button class="mbtn" id="cmp-clear" style="color:var(--er);border-color:var(--er)">CLEAR</button>';
  $('#dbody').innerHTML = html;
  $('#dbody').querySelector('#cmp-clear').onclick = () => { clearSelection(); closeDrawer(); };
  $('#drawer').hidden = false;
  requestAnimationFrame(() => $('#drawer').classList.add('on'));
}

/* ── boot ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  /* sidebar */
  $('#toggle-sb').onclick = () => $('#sb').classList.toggle('collapsed');

  /* search input */
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

  /* chips */
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

  /* favorites drawer */
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

  /* history drawer */
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

  /* settings drawer */
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

  /* help drawer */
  $('#nav-help').onclick = () => {
    const box = $('#dbody');
    $('#dactions').innerHTML = '';
    $('#dtitle').textContent = 'SHORTCUTS';
    box.innerHTML = [
      ['/', 'focus'], ['↵', 'search'], ['Esc', 'close'], ['Ctrl+K', 'command palette'],
      ['j / k', 'next / prev card'], ['g / G', 'first / last'], ['r', 'random'],
      ['t', 'trending'], ['f', 'favorites'], ['h', 'history'], ['s', 'settings'],
      ['v', 'view toggle'], ['c', 'compare']
    ].map(([k,v]) => `
      <div style="display:flex;justify-content:space-between;padding:.8rem 0;border-bottom:1px solid var(--bd);">
        <kbd>${k}</kbd><span class="rsub">${v}</span>
      </div>`).join('');
    $('#drawer').hidden = false;
    requestAnimationFrame(() => $('#drawer').classList.add('on'));
  };

  $('#drawer-close').onclick = closeDrawer;
  $('#drawer-back').onclick  = closeDrawer;
  $('#modal-close').onclick  = closeModal;
  $('#modal-back').onclick   = closeModal;

  /* random */
  $('#rand').onclick = async () => {
    $('#status').innerHTML = '<span class="mload">[ random ]</span>';
    try {
      const h = { Accept: 'application/vnd.github+json' }; if (s.tok) h.Authorization = `Bearer ${s.tok}`;
      const res = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(s.q || 'lua')}&per_page=12`, { headers: h });
      const d = await res.json();
      render([d.items[Math.floor(Math.random()*d.items.length)]]);
      $('#status').innerHTML = '<span class="ok">[ ok ] random</span>';
      $('#more').hidden = true;
    } catch(e) { $('#status').innerHTML = `<span class="err-mark" style="color:var(--er)">[ err ]</span> ${esc(e.message)}`; }
  };

  /* compare */
  $('#cmp').onclick = openCompare;

  /* bulk action bar */
  $('#bulk-open').onclick = () => {
    s.cmp.slice(0, 10).forEach(n => window.open(`https://github.com/${n}`, '_blank'));
    toast(`opened ${Math.min(s.cmp.length, 10)}`);
  };
  $('#bulk-copy').onclick = () => {
    navigator.clipboard.writeText(s.cmp.map(n => `https://github.com/${n}`).join('\n'));
    toast('urls copied');
  };
  $('#bulk-fav').onclick = () => {
    let n = 0;
    s.cmp.forEach(name => {
      if (!s.favs.some(f => f.full_name === name)) {
        const cardEl = document.querySelector(`.card[data-name="${name}"]`);
        const url = `https://github.com/${name}`;
        s.favs.unshift({ full_name: name, html_url: url, description: '', stars: 0, owner: '' });
        n++;
      }
    });
    ls.s('favs', s.favs);
    $('#fc').textContent = s.favs.length;
    toast(`★ ${n} added`);
  };
  $('#bulk-clear').onclick = () => { clearSelection(); toast('cleared'); };

  /* command palette */
  $('#cmdk-back').onclick = closeCmdk;
  $('#cmdk-input').addEventListener('input', filterCmds);
  $('#cmdk-input').addEventListener('keydown', e => {
    if (e.key === 'Escape') return closeCmdk();
    if (e.key === 'ArrowDown') { e.preventDefault(); cmdkSel = Math.min(cmdkSel + 1, cmdkFiltered.length - 1); renderCmds(); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); cmdkSel = Math.max(cmdkSel - 1, 0); renderCmds(); }
    if (e.key === 'Enter')     { e.preventDefault(); const c = cmdkFiltered[cmdkSel]; if (c) { closeCmdk(); c.run(); } }
  });

  /* keyboard shortcuts */
  document.addEventListener('keydown', e => {
    const inInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);

    /* command palette — global */
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); openCmdk(); return;
    }

    if (inInput) return;

    const k = e.key;

    /* card navigation */
    const cards = $$('.card:not(.skel)');
    if (k === 'j') {
      e.preventDefault();
      if (!cards.length) return;
      s.focusIdx = Math.min(s.focusIdx + 1, cards.length - 1);
      setCardFocus(cards);
      return;
    }
    if (k === 'k') {
      e.preventDefault();
      if (!cards.length) return;
      s.focusIdx = Math.max(s.focusIdx - 1, 0);
      setCardFocus(cards);
      return;
    }
    if (k === 'g') { if (cards.length) { s.focusIdx = 0; setCardFocus(cards); } return; }
    if (k === 'G') { if (cards.length) { s.focusIdx = cards.length - 1; setCardFocus(cards); } return; }
    if (k === 'Enter' && s.focusIdx >= 0 && cards[s.focusIdx]) {
      const info = cards[s.focusIdx].querySelector('.dt');
      if (info) info.click();
      return;
    }

    if (k === '/') { e.preventDefault(); $('#q').focus(); }
    if (k === 'Escape') { closeModal(); closeDrawer(); closeCmdk(); }
    if (k === 'r') $('#rand').click();
    if (k === 't') $('#trending').click();
    if (k === 'f') $('#nav-favs').click();
    if (k === 'h') $('#nav-hist').click();
    if (k === 's') $('#nav-settings').click();
    if (k === 'a') $('#nav-help').click();
    if (k === 'v') $('#view').click();
    if (k === 'c') $('#cmp').click();
  });

  function setCardFocus(cards) {
    cards.forEach(c => c.classList.remove('kbd-focus'));
    const c = cards[s.focusIdx];
    if (c) { c.classList.add('kbd-focus'); c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  }

  /* ticker */
  const TICK = ['NETWORK','ARCHIVE','SEARCH','OPEN SOURCE','GHFIND','ZERO DEPS'];
  $('#ticker').innerHTML = TICK.concat(TICK)
    .map(t => `<span><span class="dia">◇</span>${t}</span>`).join('');

  /* restore view + badge */
  $('#fc').textContent = s.favs.length;
  if (s.v === 'list') { $('#grid').classList.add('list'); $('#view').innerHTML = '☰ list'; }

  /* theme persistence */
  const savedTheme = ls.g('theme', '');
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;

  /* UTC clock */
  const tickUtc = () => {
    const n = new Date();
    const pad = v => String(v).padStart(2, '0');
    $('#utc').textContent = `${pad(n.getUTCHours())}:${pad(n.getUTCMinutes())}:${pad(n.getUTCSeconds())}`;
  };
  tickUtc();
  setInterval(tickUtc, 1000);

  /* restore URL hash */
  readHash();
  if (s.q) run(s.q);

  /* particle background */
  const cvs = $('#cv'), ctx = cvs.getContext('2d');
  let w, h, pts = [], mouse = { x: -1000, y: -1000 };
  const vp = $('#vp');

  const init = () => {
    w = cvs.width  = vp.clientWidth;
    h = cvs.height = vp.clientHeight;
    pts = Array.from({ length: 80 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - .5), vy: (Math.random() - .5),
      r: Math.random() * 1.5 + .5
    }));
  };
  window.addEventListener('resize', init);
  init();

  vp.addEventListener('mousemove', e => {
    const r = vp.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top + vp.scrollTop;
  });
  vp.addEventListener('mouseleave', () => { mouse.x = -1000; mouse.y = -1000; });

  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    pts.forEach((p, i) => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;

      for (let j = i + 1; j < pts.length; j++) {
        const q = pts[j];
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < 120) {
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = `rgba(0,255,204,${.15 * (1 - d / 120)})`;
          ctx.stroke();
        }
      }

      const d = Math.hypot(mouse.x - p.x, mouse.y - p.y);
      if (d < 150 && d > 0) {
        p.x -= (mouse.x - p.x) / d * 2;
        p.y -= (mouse.y - p.y) / d * 2;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,255,204,.7)';
      ctx.fill();
    });
    requestAnimationFrame(draw);
  };
  draw();
});
