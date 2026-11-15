import {esc,money,number,date,timeLeft,pot,fee,route,markdown,safeUrl,itemsOf,status,crumb,stats,pagination} from './main.js';
const css = document.createElement('link');
css.rel = 'stylesheet'; css.href = new URL('details.css',import.meta.url).href;
await new Promise((ok,fail) => { css.onload = ok; css.onerror = () => fail(Error('Could not load page styles.')); document.head.appendChild(css); });
const external = (url,text,cls='') => `<a class="${cls}" href="${url}" target="_blank" rel="noopener noreferrer">${text} ↗</a>`;
function tabs(slug,results) {
  return `<div class="tabs"><a class="${results ? '' : 'active'}" href="${route(slug)}">Overview</a><a class="${results ? 'active' : ''}" href="${route(slug)}/leaderboard">Leaderboard${results ? '' : ' <span>↗</span>'}</a></div>`;
}
function rewards(b) {
  const raw = b.rewards ?? b.prizes ?? b.rewardDistribution ?? [], list = Array.isArray(raw) ? raw : Object.entries(raw).map(([place,amount]) => ({place,amount}));
  const rows = list.map((r,i) => {
    const value = r.amountUsd ?? r.amount ?? r.rewardAmount;
    return `<tr><td>${esc(r.place ?? r.rank ?? i+1)}</td><td>${value != null ? money(value) : r.percentage != null ? esc(r.percentage) + '%' : esc(r.reward ?? r)}</td></tr>`;
  });
  return `<table class="rewards"><thead><tr><th>${list.length ? 'Place' : 'Reward'}</th><th>${list.length ? 'Reward' : 'USD'}</th></tr></thead><tbody>${list.length ? rows.join('') : `<tr><td>Base reward</td><td>${money(b.rewardAmount)}</td></tr><tr><td>Live pool</td><td>${money(pot(b))}</td></tr>`}</tbody></table>${list.length ? '' : '<p class="fine">Award allocation is defined in the competition rules.</p>'}`;
}
export function bounty(b) {
  const rules = typeof b.rules === 'string' ? b.rules : b.rules ? JSON.stringify(b.rules,null,2) : 'See the full competition rules on make.fun for eligibility,judging and submission requirements.';
  const figures = [['LIVE REWARD POOL',money(pot(b)),'USD · including entry fees'],['ENTRY FEE',fee(b),Number(b.entryFeeUsd) ? 'Per entry' : 'Open to every builder'],['TIME LEFT',timeLeft(b.deadline),date(b.deadline)],['ENTRIES',number(b.submissionCount),'Submitted to this bounty']];
  return crumb(esc(b.slug)) + `<section class="detail-hero"><div>${status(b)}<h1>${esc(b.title)}</h1><p>${esc(b.summary)}</p></div><a href="${route(b.slug)}/leaderboard" class="outline-button">View leaderboard ↗</a></section>` + stats(figures) + tabs(b.slug,false) + `<div class="detail-grid"><article class="prose"><h2>The challenge</h2>${markdown(b.description || b.summary)}<h2 id="rules">Rules & requirements</h2>${markdown(rules)}${external('https://make.fun/competitions/'+encodeURIComponent(b.slug),'Full competition on make.fun','text-link')}</article><aside><section class="panel"><div class="eyebrow">THE REWARD</div><h2 class="pot-total">${money(pot(b))}</h2><p class="muted">Live prize pool · USD</p>${rewards(b)}<p class="fine">The live pool may grow with paid entries. Final awards follow this bounty’s rules.</p></section><section class="panel dates"><h3>Competition timeline</h3><dl><dt>Opens</dt><dd>${date(b.opensAt ?? b.startDate ?? b.createdAt)}</dd><dt>Entry deadline</dt><dd>${date(b.deadline)}</dd><dt>Status</dt><dd>${status(b)}</dd></dl></section></aside></div>`;
}
export function leaderboard(data,slug) {
  return crumb(`<a href="${route(slug)}">${esc(slug)}</a><span>/</span>Leaderboard`) + `<section class="detail-hero"><div><div class="eyebrow accent">THE RESULTS DESK</div><h1>Every entry.<br><span>Out in the open.</span></h1><p>${esc(data.title ?? data.competition?.title ?? slug)} · Live standings</p></div><div class="leader-count"><strong>${itemsOf(data).length}</strong><span>ranked entries</span></div></section>` + tabs(slug,true) + '<div class="section-head"><h2>Live leaderboard</h2><span id="sync" class="sync">Live public data</span></div><p class="muted leaderboard-note">Development results are provisional. Open a builder’s profile to explore their record.</p><div id="leader-results"></div>';
}
function avatar(url,handle) {
  const src = safeUrl(url), initials = String(handle || '?').slice(0,2).toUpperCase();
  return src ? `<img src="${src}" class="avatar" alt="" crossorigin="anonymous" loading="lazy">` : `<span aria-hidden="true" class="avatar initials">${esc(initials)}</span>`;
}
function score(value) {
  if (typeof value === 'number') return value.toLocaleString('en-US',{maximumFractionDigits:4});
  return esc((typeof value === 'object' ? value?.value : value) ?? '—');
}
export function leaderboardRows(data,page) {
  const rows = itemsOf(data), columns = data.columns ?? [];
  const body = rows.slice((page-1)*25,page*25).map((entry,index) => {
    const handle = entry.handle ?? entry.user?.handle ?? entry.profile?.handle ?? entry.owner?.handle;
    const rank = entry.rank ?? entry.place ?? (page-1)*25+index+1;
    const name = handle ? `<a href="#/profile/${encodeURIComponent(handle)}">@${esc(handle)} ↗</a>` : `<strong>${esc(entry.name ?? entry.title ?? entry.submissionId ?? 'Entry')}</strong>`;
    const values = columns.length ? columns.map(c => `<td class="score">${score(entry.values?.[c.key] ?? entry.scores?.[c.key] ?? entry[c.key])}</td>`).join('') : `<td class="score">${score(entry.score ?? entry.rate ?? entry.winRate)}</td><td><span class="badge">${esc(entry.status ?? 'Ranked')}</span></td>`;
    return `<tr><td class="rank"><span class="rank-num ${Number(rank) <= 3 ? 'top' : ''}">${esc(rank)}</span></td><td><div class="builder">${avatar(entry.avatarUrl ?? entry.user?.avatarUrl,handle)}<div>${name}<small>${esc(entry.title ?? entry.name ?? entry.submission_id ?? entry.id ?? '')}</small></div></div></td>${values}</tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="leader-table"><thead><tr><th class="rank">RANK</th><th>BUILDER / ENTRY</th>${columns.length ? columns.map(c=>`<th>${esc(c.label ?? c.name ?? c.key)}</th>`).join('') : '<th>SCORE</th><th>STATUS</th>'}</tr></thead><tbody>${body || '<tr><td colspan="12" class="empty">No ranked entries yet. Check back after the first results.</td></tr>'}</tbody></table></div>` + pagination(rows.length,page);
}
export function profile(data,handle) {
  const person = data.profile ?? data.user ?? data, record = data.stats ?? data.record ?? person.stats ?? {};
  let links = Object.entries(person.links ?? {}).map(([label,url]) => safeUrl(url) ? external(safeUrl(url),esc(label)) : '').join('');
  if (safeUrl(person.website)) links += external(safeUrl(person.website),'Website');
  return crumb('Builder profile') + `<section class="profile-hero">${avatar(person.avatarUrl ?? person.avatar_url,handle)}<div><div class="eyebrow accent">BUILDER PROFILE</div><h1>${esc(person.displayName ?? person.name ?? handle)}</h1><span class="muted">@${esc(person.handle ?? handle)}</span><p>${esc(person.bio ?? '')}</p><div class="profile-links">${links}</div></div></section>` + stats([['ENTERED',number(record.entered ?? record.competitionsEntered ?? record.entries),'Competitions'],['WON',number(record.won ?? record.wins),'First places'],['PLACED',number(record.placed ?? record.placements),'Reward finishes'],['PRIZE MONEY',money(record.prizeMoneyUsd ?? record.prizeMoney ?? record.totalPrizeUsd),'Lifetime rewards']]) + '<div class="section-head"><h2>Entry history</h2><span id="sync" class="sync">Public builder record</span></div><div id="profile-results"></div>';
}
export function profileRows(data,page) {
  const entries = data.entries ?? data.submissions ?? [];
  const body = entries.slice((page-1)*25,page*25).map(entry => {
    const competition = entry.competition ?? entry.bounty ?? entry;
    return `<a href="${route(competition.slug ?? entry.competitionSlug)}" class="profile-entry"><div><span class="eyebrow">${esc(entry.status ?? 'ENTRY')}</span><h3>${esc(competition.title ?? entry.title ?? competition.slug)}</h3><p>${esc(entry.name ?? entry.submission_id ?? '')}</p></div><span>${entry.rank ? '#' + esc(entry.rank) : 'View bounty'} ↗</span></a>`;
  }).join('');
  return `<div class="profile-entries">${body || '<div class="empty">No public entries to show.</div>'}</div>` + pagination(entries.length,page);
}
