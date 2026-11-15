const $ = s => document.querySelector(s);
const store = new Map(), flights = new Map();
function saved(key) {
  if (store.has(key)) return store.get(key);
  try { const entry = JSON.parse(sessionStorage.getItem('desk:' + key)); if (entry?.data) { store.set(key, entry); return entry; } } catch {}
}
async function load(key, force) {
  const previous = saved(key), now = Math.floor(Date.now()/60000);
  if (!force && previous?.minute === now) return previous;
  if (flights.has(key)) return flights.get(key);
  const task = (async () => {
    try {
      const reply = await fetch('https://make.fun/api' + key, {headers: previous?.etag ? {'If-None-Match': previous.etag} : {}, signal: AbortSignal.timeout(18000)});
      if (reply.status !== 304 && !reply.ok) throw Error(reply.status === 404 ? 'This page could not be found.' : `make.fun returned ${reply.status}. Please try again.`);
      const entry = {data: reply.status === 304 ? previous.data : await reply.json(), etag: reply.headers.get('ETag') || previous?.etag, minute: Math.floor(Date.now()/60000), at: Date.now(), stale: false};
      store.set(key, entry);
      try { sessionStorage.setItem('desk:' + key, JSON.stringify(entry)); } catch {}
      return entry;
    } catch (error) { if (previous) return {...previous, stale: true}; throw error; }
    finally { flights.delete(key); }
  })();
  flights.set(key, task); return task;
}
export const esc = x => String(x ?? '').replace(/[<>"'&]/g, ch => '&#' + ch.charCodeAt(0) + ';');
export const number = x => x == null ? '—' : Number(x).toLocaleString('en-US');
export const money = x => x == null ? '—' : Number(x).toLocaleString('en-US', {style:'currency',currency:'USD',maximumFractionDigits:Number.isInteger(Number(x)) ? 0 : 2});
export const date = x => Number.isFinite(Date.parse(x)) ? new Date(x).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}) + ' UTC' : 'Not announced';
export const accepting = b => b.status === 'open' && Date.parse(b.deadline) > Date.now();
export const pot = b => b.potUsd ?? b.rewardAmount;
export const fee = b => Number(b.entryFeeUsd) ? money(b.entryFeeUsd) : 'Free';
export const route = slug => '#/bounty/' + encodeURIComponent(slug);
export const itemsOf = d => Array.isArray(d) ? d : d?.items ?? d?.entries ?? d?.rows ?? [];
export const PAGE_SIZE = 25;
export function timeLeft(x) {
  const minutes = Math.floor((Date.parse(x)-Date.now())/60000), hours = Math.floor(minutes/60);
  if (!Number.isFinite(minutes)) return 'No deadline';
  if (Date.parse(x) <= Date.now()) return 'Entries closed';
  return hours >= 24 ? `${Math.floor(hours/24)}d ${hours%24}h left` : hours ? `${hours}h ${minutes%60}m left` : `${minutes}m left`;
}
export function safeUrl(x) { try { const u = new URL(x); return /^(https?:)$/.test(u.protocol) ? esc(u.href) : ''; } catch { return ''; } }
export function markdown(source) {
  return String(source ?? '').split(/\n\n+/).map(part => {
    let text = esc(part).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1 ↗</a>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    if (/^#{1,4} /.test(text)) return '<h3>' + text.replace(/^#{1,4} /,'') + '</h3>';
    if (/^[-*] /.test(text)) return '<ul>' + text.split('\n').map(line => '<li>' + line.replace(/^[-*] /,'') + '</li>').join('') + '</ul>';
    return '<p>' + text.replaceAll('\n','<br>') + '</p>';
  }).join('');
}
export const status = b => `<span class="badge ${accepting(b) ? 'live' : ''}">${accepting(b) ? '<i class="dot"></i> Accepting entries' : esc(b.status === 'open' ? 'Awaiting results' : b.status ?? 'Closed')}</span>`;
export const crumb = text => `<div class="breadcrumb"><a href="#/">Bounty board</a><span>/</span>${text}</div>`;
export const stats = rows => '<div class="stats">' + rows.map(([label,value,note]) => `<div><span class="eyebrow">${label}</span><strong>${value}</strong>${note ? `<small>${note}</small>` : ''}</div>`).join('') + '</div>';
export function pagination(total, current) {
  const end = Math.max(1, Math.ceil(total/25));
  return `<div class="pagination"><span>${total ? `${(current-1)*25+1}–${Math.min(current*25,total)} of ${number(total)}` : '0 results'}</span><div><button data-page="${current-1}" ${current === 1 ? 'disabled' : ''}>← Previous</button><span>${current} / ${end}</span><button data-page="${current+1}" ${current >= end ? 'disabled' : ''}>Next →</button></div></div>`;
}
function board(data) {
  const entries = itemsOf(data), active = entries.filter(accepting);
  return `<section class="board-intro"><div><div class="eyebrow accent">THE BOUNTY DESK <span class="short-line"></span> LIVE ON MAKE.FUN</div><h1>Good ideas.<br><span>Real stakes.</span></h1><p>Find your next challenge. Build an agent, ship a program,<br class="desktop"> and let the results do the talking.</p></div><div class="board-summary"><span class="eyebrow">ON THE BOARD</span><strong>${money(active.reduce((sum,b) => sum + Number(pot(b)||0),0))}</strong><span>in live reward pools</span><div><b>${active.length}</b> accepting entries <span>↗</span></div></div></section><section class="board-section"><div class="section-head"><h2>Explore bounties <span class="count">${entries.length}</span></h2><span id="sync" class="sync">Live public data</span></div><div class="toolbar"><div class="filters" role="group" aria-label="Filter bounties">${[['all','All bounties'],['live','Accepting entries'],['free','Free entry']].map(([key,label],i)=>`<button data-filter="${key}" class="${i ? '' : 'selected'}" aria-pressed="${!i}">${label}</button>`).join('')}</div><div class="search-sort"><label class="search"><span aria-hidden="true">⌕</span><input type="search" id="search" aria-label="Search bounties" placeholder="Find a challenge…"></label><select id="sort" aria-label="Sort bounties"><option value="reward">Highest reward</option><option value="deadline">Closing soon</option><option value="entries">Most entries</option></select></div></div><div id="board-results"></div></section>`;
}
function boardRows(list, current) {
  return '<div class="board-columns"><span>CHALLENGE</span><span>LIVE POT</span><span>ENTRY FEE</span><span>TIME LEFT</span><span>ENTRIES</span><span></span></div><div class="bounty-list">' + list.slice((current-1)*25,current*25).map((b,i) => `<a href="${route(b.slug)}" class="bounty-row"><div class="challenge"><span class="row-icon">${String((current-1)*25+i+1).padStart(2,'0')}</span><div><div class="row-meta">${esc(b.category ?? b.kind ?? 'BUILD CHALLENGE')} <span class="mini-dot ${accepting(b) ? 'green' : ''}"></span> ${accepting(b) ? 'Open' : 'Entries closed'}</div><h3>${esc(b.title)}</h3><p>${esc(b.summary || b.slug)}</p></div></div><div class="cell reward"><span class="mobile-label">Live pot</span><strong>${money(pot(b))}</strong></div><div class="cell"><span class="mobile-label">Entry fee</span>${fee(b)}</div><div class="cell time"><span class="mobile-label">Time left</span><span>${timeLeft(b.deadline)}</span><small>${date(b.deadline).split(',')[0]}</small></div><div class="cell entries"><span class="mobile-label">Entries</span>${number(b.submissionCount)}</div><span class="row-arrow">↗</span></a>`).join('') .concat(list.length ? '' : '<div class="empty"><h3>No matching bounties</h3><p>Try a different search or filter.</p></div>') + '</div>' + pagination(list.length,current);
}
let views, state, epoch = 0, page = 1, filter = 'all', query = '', sort = 'reward';
const app = $('#app');
function resolveRoute() {
  const [kind, encoded, sub] = location.hash.replace(/^#\/?/,'').split('/');
  if (!kind) return {type:'board',path:'/competitions?status=open&activity=times'};
  let id; try { id = decodeURIComponent(encoded || ''); } catch { throw Error('This address is not valid.'); }
  if (kind === 'bounty' && id) return {id,type:sub === 'leaderboard' ? sub : kind,path:'/competitions/' + encodeURIComponent(id) + (sub === 'leaderboard' ? '/leaderboard' : '')};
  if (kind === 'profile' && id) return {id,type:kind,path:'/profiles/' + encodeURIComponent(id)};
  throw Error('This page could not be found.');
}
function updateList() {
  if (!state) return;
  if (state.type === 'board') {
    const list = itemsOf(state.data).filter(b => (filter !== 'live' || accepting(b)) && (filter !== 'free' || !Number(b.entryFeeUsd)) && `${b.title} ${b.summary} ${b.slug}`.toLowerCase().includes(query));
    list.sort((a,b) => sort === 'entries' ? Number(b.submissionCount)-Number(a.submissionCount) : sort === 'deadline' ? Date.parse(a.deadline)-Date.parse(b.deadline) : Number(pot(b))-Number(pot(a)));
    page = Math.min(page, Math.max(1,Math.ceil(list.length/25))); $('#board-results').innerHTML = boardRows(list,page);
  } else if (state.type !== 'bounty') $(`#${state.type === 'profile' ? 'profile' : 'leader'}-results`).innerHTML = views[state.type + 'Rows'](state.data,page);
}
async function render(destination, entry, rebuild = true) {
  if (destination.type !== 'board' && !views) views = await import('./details.js');
  state = {...destination,data:entry.data};
  if (rebuild) {
    app.innerHTML = destination.type === 'board' ? board(entry.data) : views[destination.type](entry.data,destination.id);
    document.title = (destination.type === 'board' ? 'Bounty board' : destination.type === 'profile' ? '@' + destination.id : destination.type === 'leaderboard' ? destination.id + ' · Leaderboard' : entry.data.title) + ' · make.fun desk';
    updateList();
  }
  if ($('#sync')) $('#sync').textContent = entry.stale ? 'Cached · connection unavailable' : 'Updated ' + new Date(entry.at).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
  $('#notice').textContent = entry.stale ? 'Showing saved data. Refresh to try the connection again.' : '';
  window.__shotReady = true;
}
async function navigate(force = false) {
  const ticket = ++epoch; window.__shotReady = false; page = 1; filter = 'all'; query = ''; sort = 'reward';
  try {
    const destination = resolveRoute(), old = saved(destination.path);
    for (const kind of ['board','profile']) $('#' + kind + '-nav').setAttribute('aria-current',destination.type === kind ? 'page' : 'false');
    if (old) await render(destination,old); else app.innerHTML = '<section class="loading" aria-live="polite"><span class="loader"></span><h1>Opening the desk</h1><p>Fetching the latest public data from make.fun…</p></section>';
    app.setAttribute('aria-busy','true');
    const entry = await load(destination.path,force);
    if (ticket !== epoch) return;
    await render(destination,entry,!old || JSON.stringify(old.data) !== JSON.stringify(entry.data));
    app.setAttribute('aria-busy','false'); window.scrollTo(0,0);
  } catch (error) {
    if (ticket !== epoch) return;
    app.setAttribute('aria-busy','false'); window.__shotReady = false;
    app.innerHTML = `<section class="empty error"><div class="eyebrow accent">CONNECTION DESK</div><h1>Couldn’t open this page.</h1><p>${esc(error.message)}</p><p>Public data is served directly by make.fun. Check your connection and try again.</p><button id="retry" class="primary">Try again ↻</button> <a href="#/" class="outline-button">Back to board</a></section>`;
  }
}
const media = matchMedia('(prefers-color-scheme:dark)'); let preference;
try { preference = localStorage.getItem('desk-theme'); } catch {}
function applyTheme(value) { document.documentElement.dataset.theme = value; $('#theme').setAttribute('aria-label',`Switch to ${value === 'dark' ? 'light' : 'dark'} theme`); }
applyTheme(preference || (media.matches ? 'dark' : 'light'));
$('#theme').onclick = () => { preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(preference); try { localStorage.setItem('desk-theme',preference); } catch {} };
media.addEventListener('change',e => { if (!preference) applyTheme(e.matches ? 'dark' : 'light'); });
function jump(open) { $('#jump').hidden = !open; $('#jump-toggle').setAttribute('aria-expanded',String(open)); if (open) $('#jump-value').focus(); }
$('#jump-toggle').onclick = () => jump($('#jump').hidden);
$('#jump').onsubmit = e => { e.preventDefault(); const id = $('#jump-value').value.trim().replace(/^[@#\/]+/,''); if (id) { location.hash = '#/' + $('#jump-type').value + '/' + encodeURIComponent(id); jump(false); } };
$('.skip').onclick = e => { e.preventDefault(); $('#content').focus(); };
document.addEventListener('keydown',e => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); jump(true); } if (e.key === 'Escape') jump(false); });
app.addEventListener('click',e => {
  const next = e.target.closest('[data-page]'), choice = e.target.closest('[data-filter]');
  if (next && !next.disabled) { page = Number(next.dataset.page); updateList(); $('.section-head')?.scrollIntoView({block:'start',behavior:'smooth'}); }
  if (choice) { filter = choice.dataset.filter; page = 1; document.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('selected', b === choice); b.setAttribute('aria-pressed',String(b === choice)); }); updateList(); }
  if (e.target.closest('#retry')) navigate(true);
});
app.addEventListener('input',e => { if (e.target.id === 'search') { query = e.target.value.toLowerCase(); page = 1; updateList(); } });
app.addEventListener('change',e => { if (e.target.id === 'sort') { sort = e.target.value; page = 1; updateList(); } });
document.addEventListener('visibilitychange',async () => {
  if (document.hidden || !state) return;
  const ticket = epoch, previous = state;
  try { const entry = await load(previous.path); if (ticket !== epoch) return; const changed = JSON.stringify(previous.data) !== JSON.stringify(entry.data); if (changed && previous.type !== 'bounty') { state = {...previous,data:entry.data}; updateList(); } await render(previous,entry,changed && previous.type === 'bounty'); } catch {}
});
window.addEventListener('hashchange',() => navigate());
navigate();
