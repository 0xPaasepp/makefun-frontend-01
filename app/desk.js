// The desk renders live public data with a deliberately small shared surface.
const $ = selector => document.querySelector(selector);
const sheet = document.createElement('link');
sheet.rel = 'stylesheet';
sheet.href = new URL('site.css',import.meta.url);
document.head.append(sheet);
await new Promise((resolve,reject) => {
  sheet.onload = resolve;
  sheet.onerror = () => reject(Error('Could not load page styles.'));
});

const cache = new Map();
const requests = new Map();
const ROW_HEIGHT = 68;
const PAGE_SIZE = 25;

function saved(key) {
  if (cache.has(key)) return cache.get(key);
  try {
    const value = JSON.parse(sessionStorage.getItem('desk:'+key));
    if (value?.data) {
      cache.set(key,value);
      return value;
    }
  } catch {}
}

async function load(key,force=false) {
  const previous = saved(key);
  const minute = Math.floor(Date.now()/60000);
  if (!force && previous?.minute === minute) return previous;
  if (requests.has(key)) return requests.get(key);
  const request = (async () => {
    try {
      const response = await (window.__apiFetch||fetch)('https://make.fun/api'+key,{
        headers: previous?.etag ? {'If-None-Match':previous.etag} : {},
        signal: AbortSignal.timeout(18000)
      });
      if (response.status !== 304 && !response.ok) {
        throw Error(response.status === 404 ? 'This page could not be found.' : `make.fun returned ${response.status}. Please try again.`);
      }
      const result = {
        data: response.status === 304 ? previous.data : await response.json(),
        etag: response.headers.get('ETag') || previous?.etag,
        minute: Math.floor(Date.now()/60000),
        at: Date.now(),
        stale: false
      };
      cache.set(key,result);
      try { sessionStorage.setItem('desk:'+key,JSON.stringify(result)); } catch {}
      return result;
    } catch (error) {
      if (previous) return {...previous,stale:true};
      throw error;
    } finally {
      requests.delete(key);
    }
  })();
  requests.set(key,request);
  return request;
}

export const esc = value => String(value ?? '').replace(/[<>"'&]/g,char => '&#'+char.charCodeAt(0)+';');
export const number = value => value == null ? '—' : Number(value).toLocaleString('en-US');
export const money = value => value == null ? '—' : Number(value).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:Number.isInteger(Number(value)) ? 0 : 2});
export const date = value => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'})+' UTC' : 'Not announced';
export const accepting = bounty => bounty.status === 'open' && Date.parse(bounty.deadline) > Date.now();
export const pot = bounty => bounty.potUsd ?? bounty.rewardAmount;
export const opportunity = bounty => { const value=Number(pot(bounty)), entries=Number(bounty.submissionCount); return Number.isFinite(value) && value >= 0 && Number.isFinite(entries) ? value/(entries+1) : null; };
export const fee = bounty => Number(bounty.entryFeeUsd) ? money(bounty.entryFeeUsd) : 'Free';
export const route = slug => '#/bounty/'+encodeURIComponent(slug);
export const itemsOf = data => Array.isArray(data) ? data : data?.items ?? data?.entries ?? data?.rows ?? [];

export function timeLeft(value) {
  const minutes = Math.floor((Date.parse(value)-Date.now())/60000);
  const hours = Math.floor(minutes/60);
  if (!Number.isFinite(minutes)) return 'No deadline';
  if (Date.parse(value) <= Date.now()) return 'Entries closed';
  return hours >= 24 ? `${Math.floor(hours/24)}d ${hours%24}h left` : hours ? `${hours}h ${minutes%60}m left` : `${minutes}m left`;
}

export function safeUrl(value) {
  try {
    const url = new URL(value);
    return /^(https?:)$/.test(url.protocol) ? esc(url.href) : '';
  } catch { return ''; }
}

export function markdown(source) {
  return String(source ?? '').split(/\n\n+/).map(part => {
    const text = esc(part)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1 ↗</a>')
      .replace(/`([^`]+)`/g,'<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    if (/^#{1,4} /.test(text)) return '<h3>'+text.replace(/^#{1,4} /,'')+'</h3>';
    if (/^[-*] /.test(text)) return '<ul>'+text.split('\n').map(line => '<li>'+line.replace(/^[-*] /,'')+'</li>').join('')+'</ul>';
    return '<p>'+text.replaceAll('\n','<br>')+'</p>';
  }).join('');
}

export const status = bounty => `<span class="badge ${accepting(bounty) ? 'live' : ''}">${accepting(bounty) ? '<i class="dot"></i> Accepting entries' : esc(bounty.status === 'open' ? 'Awaiting results' : bounty.status ?? 'Closed')}</span>`;
export const crumb = label => `<div class="breadcrumb"><a href="#/">Bounty board</a><span>/</span>${label}</div>`;
export const stats = rows => '<div class="stats">'+rows.map(([label,value,note]) => `<div><span class="eyebrow">${label}</span><strong>${value}</strong>${note ? `<small>${note}</small>` : ''}</div>`).join('')+'</div>';

export function pagination(total,current) {
  const pages = Math.max(1,Math.ceil(total/PAGE_SIZE));
  const start = total ? (current-1)*PAGE_SIZE+1 : 0;
  const end = Math.min(current*PAGE_SIZE,total);
  return `<div class="pagination"><span>${total ? `${start}–${end} of ${number(total)}` : '0 results'}</span><div><button data-page="${current-1}" ${current === 1 ? 'disabled' : ''}>← Previous</button><span>${current} / ${pages}</span><button data-page="${current+1}" ${current >= pages ? 'disabled' : ''}>Next →</button></div></div>`;
}

function board(data) {
  const entries = itemsOf(data);
  const active = entries.filter(accepting);
  return `<section class="board-intro"><div><div class="eyebrow accent">THE BOUNTY DESK <span class="short-line"></span> LIVE ON MAKE.FUN</div><h1>Good ideas.<br><span>Real stakes.</span></h1><p>Find your next challenge. Build an agent, ship a program,<br class="desktop"> and let the results do the talking.</p></div><div class="board-summary"><span class="eyebrow">ON THE BOARD</span><strong>${money(active.reduce((sum,bounty) => sum+Number(pot(bounty)||0),0))}</strong><span>in live reward pools</span><div><b>${active.length}</b> accepting entries <span>↗</span></div></div></section><section class="board-section"><div class="section-head"><h2>Explore bounties <span class="count">${entries.length}</span></h2><span id="sync" class="sync">Live public data</span></div><div class="toolbar"><div class="filters" role="group" aria-label="Filter bounties">${[['all','All bounties'],['live','Accepting entries'],['free','Free entry']].map(([key,label],index) => `<button data-filter="${key}" class="${index ? '' : 'selected'}" aria-pressed="${!index}">${label}</button>`).join('')}</div><div class="search-sort"><label class="search"><span aria-hidden="true">⌕</span><input type="search" id="search" aria-label="Search bounties" placeholder="Find a challenge…" aria-describedby="search-hint"><kbd id="search-hint" class="search-hint">/</kbd></label><select id="sort" aria-label="Sort bounties"><option value="reward">Highest reward</option><option value="deadline">Closing soon</option><option value="entries">Most entries</option></select></div></div><div id="board-results"></div></section>`;
}

function boardRows(list,current) {
  const rows = list.slice((current-1)*PAGE_SIZE,current*PAGE_SIZE).map((bounty,index) => `<a href="${route(bounty.slug)}" data-bounty="${esc(bounty.slug)}" class="bounty-row ${selected===bounty.slug?'selected':''}"><div class="challenge"><span class="row-icon">${String((current-1)*PAGE_SIZE+index+1).padStart(2,'0')}</span><div><div class="row-meta">${esc(bounty.category ?? bounty.kind ?? 'BUILD CHALLENGE')} <span class="mini-dot ${accepting(bounty) ? 'green' : ''}"></span> ${accepting(bounty) ? 'Open' : 'Entries closed'}</div><h3>${esc(bounty.title)}</h3><p>${esc(bounty.summary || bounty.slug)}</p></div></div><div class="cell reward"><span class="mobile-label">Live pot</span><strong>${money(pot(bounty))}</strong><small class="opportunity">${opportunity(bounty)==null?'—':money(opportunity(bounty))} / entry</small></div><div class="cell"><span class="mobile-label">Entry fee</span>${fee(bounty)}</div><div class="cell time"><span class="mobile-label">Time left</span><span>${timeLeft(bounty.deadline)}</span><small>${date(bounty.deadline).split(',')[0]}</small></div><div class="cell entries"><span class="mobile-label">Entries</span>${number(bounty.submissionCount)}</div><span class="row-arrow">↗</span></a>`).join('');
  return '<div class="board-columns"><span>CHALLENGE</span><span>LIVE POT</span><span>ENTRY FEE</span><span>TIME LEFT</span><span>ENTRIES</span><span></span></div><div class="bounty-list">'+(rows || '<div class="empty"><h3>No matching bounties</h3><p>Try a different search or filter.</p></div>')+'</div>'+pagination(list.length,current);
}

let views, state, epoch = 0, page = 1, filter = 'all', query = '', sort = 'reward', leaderScroll = 0, selected;
const app = $('#app');

function leaderWindow(container) {
  const entries = itemsOf(state.data);
  const oldWrap = container.querySelector('.table-wrap');
  const viewport = oldWrap?.clientHeight || Math.max(320,Math.min(innerHeight*.68,620));
  const header = oldWrap?.querySelector('thead')?.getBoundingClientRect().height || 40;
  const maxScroll = Math.max(0,entries.length*ROW_HEIGHT+header-viewport);
  const top = Math.min(leaderScroll,maxScroll);
  const first = Math.max(0,Math.floor(top/ROW_HEIGHT)-4);
  const last = Math.min(entries.length,Math.floor(top/ROW_HEIGHT)+Math.ceil(viewport/ROW_HEIGHT)+4);
  const body = container.querySelector('tbody');
  if (body && Number(body.dataset.start) === first && Number(body.dataset.end) === last) return;
  container.innerHTML = views.leaderboardRows(state.data,page,{start:first,end:last,rowHeight:ROW_HEIGHT});
  container.querySelector('.table-wrap').scrollTop = top;
}

function resolveRoute() {
  const [kind,encoded,subroute] = location.hash.replace(/^#\/?/,'').split('/');
  if (!kind) return {type:'board',path:'/competitions?status=open&activity=times'};
  let id;
  try { id = decodeURIComponent(encoded || ''); } catch { throw Error('This address is not valid.'); }
  if (kind === 'bounty' && id) return {id,type:subroute === 'leaderboard' ? 'leaderboard' : kind,path:'/competitions/'+encodeURIComponent(id)+(subroute === 'leaderboard' ? '/leaderboard' : '')};
  if (kind === 'profile' && id) return {id,type:kind,path:'/profiles/'+encodeURIComponent(id)};
  throw Error('This page could not be found.');
}

function updateList() {
  if (!state) return;
  if (state.type === 'board') {
    const list = itemsOf(state.data).filter(bounty => (filter !== 'live' || accepting(bounty)) && (filter !== 'free' || !Number(bounty.entryFeeUsd)) && `${bounty.title} ${bounty.summary} ${bounty.slug}`.toLowerCase().includes(query));
    list.sort((a,b) => sort === 'entries' ? Number(b.submissionCount)-Number(a.submissionCount) : sort === 'deadline' ? Date.parse(a.deadline)-Date.parse(b.deadline) : Number(pot(b))-Number(pot(a)));
    page = Math.min(page,Math.max(1,Math.ceil(list.length/PAGE_SIZE)));
    if (!selected || !list.some(item=>item.slug===selected)) selected=window.innerWidth>760?list[0]?.slug:undefined;
    const chosen=itemsOf(state.data).find(item=>item.slug===selected);
    $('#board-results').innerHTML = `<div class="master-detail ${chosen?'has-selection':''}"><div class="master-list">${boardRows(list,page)}</div><aside class="detail-panel">${chosen ? `<button class="panel-back" data-close-detail>← Back to bounties</button>${views.bounty(chosen,true)}` : '<div class="empty">Select a bounty.</div>'}</aside></div>`;
  } else if (state.type === 'leaderboard') {
    leaderWindow($('#leader-results'));
  } else if (state.type !== 'bounty') {
    $(`#${state.type}-results`).innerHTML = views[state.type+'Rows'](state.data,page);
  }
}

async function render(destination,entry,rebuild=true) {
  if (!views) views = await import('./details.js');
  state = {...destination,data:entry.data};
  if (rebuild) {
    app.innerHTML = destination.type === 'board' ? board(entry.data) : views[destination.type](entry.data,destination.id);
    document.title = (destination.type === 'board' ? 'Bounty board' : destination.type === 'profile' ? '@'+destination.id : destination.type === 'leaderboard' ? destination.id+' · Leaderboard' : entry.data.title)+' · make.fun desk';
    updateList();
  }
  if ($('#sync')) $('#sync').textContent = entry.stale ? 'Cached · connection unavailable' : 'Updated '+new Date(entry.at).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
  $('#notice').textContent = entry.stale ? 'Showing saved data. Refresh to try the connection again.' : '';
  window.__shotReady = true;
}

export async function navigate(force=false) {
  const ticket = ++epoch;
  window.__shotReady = false;
  page = 1;
  filter = 'all';
  query = '';
  sort = 'reward';
  leaderScroll = 0;
  try {
    const destination = resolveRoute();
    const old = saved(destination.path);
    for (const kind of ['board','profile']) $('#'+kind+'-nav').setAttribute('aria-current',destination.type === kind ? 'page' : 'false');
    if (old) await render(destination,old);
    else app.innerHTML = '<section class="loading" aria-live="polite"><span class="loader"></span><h1>Opening the desk</h1><p>Fetching the latest public data from make.fun…</p></section>';
    app.setAttribute('aria-busy','true');
    const entry = await load(destination.path,force);
    if (ticket !== epoch) return;
    await render(destination,entry,!old || JSON.stringify(old.data) !== JSON.stringify(entry.data));
    app.setAttribute('aria-busy','false');
    window.scrollTo(0,0);
  } catch (error) {
    if (ticket !== epoch) return;
    app.setAttribute('aria-busy','false');
    window.__shotReady = false;
    app.innerHTML = `<section class="empty error"><div class="eyebrow accent">CONNECTION DESK</div><h1>Couldn’t open this page.</h1><p>${esc(error.message)}</p><p>Public data is served directly by make.fun. Check your connection and try again.</p><button id="retry" class="primary">Try again ↻</button> <a href="#/" class="outline-button">Back to board</a></section>`;
  }
}

const media = matchMedia('(prefers-color-scheme:dark)');
let preference;
try { preference = localStorage.getItem('desk-theme'); } catch {}
function applyTheme(value) {
  document.documentElement.dataset.theme = value;
  $('#theme').setAttribute('aria-label',`Switch to ${value === 'dark' ? 'light' : 'dark'} theme`);
}
applyTheme(preference || (media.matches ? 'dark' : 'light'));
$('#theme').onclick = () => {
  preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(preference);
  try { localStorage.setItem('desk-theme',preference); } catch {}
};
media.addEventListener('change',event => { if (!preference) applyTheme(event.matches ? 'dark' : 'light'); });

function jump(open) {
  $('#jump').hidden = !open;
  $('#jump-toggle').setAttribute('aria-expanded',String(open));
  if (open) $('#jump-value').focus();
}
$('#jump-toggle').onclick = () => jump($('#jump').hidden);
$('#jump').onsubmit = event => {
  event.preventDefault();
  const id = $('#jump-value').value.trim().replace(/^[@#\/]+/,'');
  if (id) {
    location.hash = '#/'+$('#jump-type').value+'/'+encodeURIComponent(id);
    jump(false);
  }
};
$('.skip').onclick = event => { event.preventDefault(); $('#content').focus(); };
document.addEventListener('keydown',event => {
  if (event.key === '/' && state?.type === 'board' && $('#search')) { event.preventDefault(); $('#search').focus(); }
  if (event.key === 'Escape') jump(false);
});

app.addEventListener('click',event => {
  const next = event.target.closest('[data-page]');
  const choice = event.target.closest('[data-filter]');
  if (next && !next.disabled) {
    page = Number(next.dataset.page);
    if (state?.type === 'leaderboard') leaderScroll = (page-1)*PAGE_SIZE*ROW_HEIGHT;
    updateList();
    $('.section-head')?.scrollIntoView({block:'start',behavior:'smooth'});
  }
  if (choice) {
    filter = choice.dataset.filter;
    page = 1;
    document.querySelectorAll('[data-filter]').forEach(button => {
      button.classList.toggle('selected',button === choice);
      button.setAttribute('aria-pressed',String(button === choice));
    });
    updateList();
  }
  const row=event.target.closest('[data-bounty]');
  if (row && state?.type==='board') { event.preventDefault(); selected=row.dataset.bounty; updateList(); }
  if (event.target.closest('[data-close-detail]')) { selected=undefined; updateList(); }
  if (event.target.closest('#retry')) navigate(true);
});
app.addEventListener('scroll',event => {
  if (state?.type === 'leaderboard' && event.target.matches('.table-wrap')) {
    leaderScroll = event.target.scrollTop;
    leaderWindow($('#leader-results'));
  }
},true);
app.addEventListener('input',event => {
  if (event.target.id === 'search') {
    query = event.target.value.toLowerCase();
    page = 1;
    updateList();
  }
});
app.addEventListener('change',event => {
  if (event.target.id === 'sort') {
    sort = event.target.value;
    page = 1;
    updateList();
  }
});

document.addEventListener('visibilitychange',async () => {
  if (document.hidden || !state) return;
  const ticket = epoch;
  const previous = state;
  try {
    const entry = await load(previous.path);
    if (ticket !== epoch) return;
    const changed = JSON.stringify(previous.data) !== JSON.stringify(entry.data);
    if (changed && previous.type !== 'bounty') {
      state = {...previous,data:entry.data};
      updateList();
    }
    await render(previous,entry,changed && previous.type === 'bounty');
  } catch {}
});

export function boot(entry) {
  window.addEventListener('hashchange',() => navigate());
  render({type:'board',path:'/competitions?status=open&activity=times'},entry);
}
