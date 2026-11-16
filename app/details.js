import {esc,money,number,date,timeLeft,pot,fee,opportunity,route,markdown,safeUrl,itemsOf,status,crumb,stats,pagination} from './desk.js';

const css = document.createElement('link');
css.rel = 'stylesheet';
css.href = new URL('details.css',import.meta.url).href;
await new Promise((resolve,reject) => {
  css.onload = resolve;
  css.onerror = () => reject(Error('Could not load page styles.'));
  document.head.appendChild(css);
});

const external = (url,label,className='') => `<a class="${className}" href="${url}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;

function tabs(slug,results) {
  return `<div class="tabs"><a class="${results ? '' : 'active'}" href="${route(slug)}">Overview</a><a class="${results ? 'active' : ''}" href="${route(slug)}/leaderboard">Leaderboard${results ? '' : ' <span>↗</span>'}</a></div>`;
}

function rewards(bounty) {
  const raw = bounty.rewards ?? bounty.prizes ?? bounty.rewardDistribution ?? [];
  const rows = Array.isArray(raw) ? raw : Object.entries(raw).map(([place,amount]) => ({place,amount}));
  const body = rows.map((reward,index) => {
    const value = reward.amountUsd ?? reward.amount ?? reward.rewardAmount;
    const display = value != null ? money(value) : reward.percentage != null ? esc(reward.percentage) + '%' : esc(reward.reward ?? reward);
    return `<tr><td>${esc(reward.place ?? reward.rank ?? index+1)}</td><td>${display}</td></tr>`;
  }).join('');
  return `<table class="rewards"><thead><tr><th>${rows.length ? 'Place' : 'Reward'}</th><th>${rows.length ? 'Reward' : 'USD'}</th></tr></thead><tbody>${body || `<tr><td>Base reward</td><td>${money(bounty.rewardAmount)}</td></tr><tr><td>Live pool</td><td>${money(pot(bounty))}</td></tr>`}</tbody></table>${rows.length ? '' : '<p class="fine">Award allocation is defined in the competition rules.</p>'}`;
}

export function bounty(data,compact=false) {
  const rules = typeof data.rules === 'string' ? data.rules : data.rules ? JSON.stringify(data.rules,null,2) : 'See the full competition rules on make.fun for eligibility, judging and submission requirements.';
  const figures = [
    ['LIVE REWARD POOL',money(pot(data)),'USD · including entry fees'],
    ['ENTRY FEE',fee(data),Number(data.entryFeeUsd) ? 'Per entry' : 'Open to every builder'],
    ['TIME LEFT',timeLeft(data.deadline),date(data.deadline)],
    ['ENTRIES',number(data.submissionCount),'Submitted to this bounty']
  ];
  const opp=opportunity(data);
  const hero=`<section class="detail-hero"><div>${status(data)}<h1>${esc(data.title)}</h1><p>${esc(data.summary)}</p><span class="opportunity-chip" title="Live reward pool divided by submissions plus one">Opportunity ${opp==null?'—':money(opp)} per entry</span></div><a href="${route(data.slug)}/leaderboard" class="outline-button">View leaderboard ↗</a></section>`;
  if(compact)return hero+stats(figures)+`<section class="panel compact-description"><h2>The challenge</h2>${markdown(data.description || data.summary)}<p class="fine">Opportunity = live pool ÷ (entries + 1): ${opp==null?'Unavailable':money(opp)} per entry.</p>${external('https://make.fun/competitions/'+encodeURIComponent(data.slug),'Full competition on make.fun','text-link')}</section>`;
  return crumb(esc(data.slug)) + hero + stats(figures) + tabs(data.slug,false) + `<div class="detail-grid"><article class="prose"><h2>The challenge</h2>${markdown(data.description || data.summary)}<h2 id="rules">Rules &amp; requirements</h2>${markdown(rules)}${external('https://make.fun/competitions/'+encodeURIComponent(data.slug),'Full competition on make.fun','text-link')}</article><aside><section class="panel"><div class="eyebrow">THE REWARD</div><h2 class="pot-total">${money(pot(data))}</h2><p class="muted">Live prize pool · USD</p>${rewards(data)}<p class="fine">Opportunity = live pool ÷ (entries + 1): ${opp==null?'Unavailable':money(opp)} per entry.</p></section><section class="panel dates"><h3>Competition timeline</h3><dl><dt>Opens</dt><dd>${date(data.opensAt ?? data.startDate ?? data.createdAt)}</dd><dt>Entry deadline</dt><dd>${date(data.deadline)}</dd><dt>Status</dt><dd>${status(data)}</dd></dl></section></aside></div>`;
}

export function leaderboard(data,slug) {
  const count = itemsOf(data).length;
  return crumb(`<a href="${route(slug)}">${esc(slug)}</a><span>/</span>Leaderboard`) + `<section class="detail-hero"><div><div class="eyebrow accent">THE RESULTS DESK</div><h1>Every entry.<br><span>Out in the open.</span></h1><p>${esc(data.title ?? data.competition?.title ?? slug)} · Live standings</p></div><div class="leader-count"><strong>${number(count)}</strong><span>ranked entries</span></div></section>` + tabs(slug,true) + '<div class="section-head"><h2>Live leaderboard</h2><span id="sync" class="sync">Live public data</span></div><p class="muted leaderboard-note">Development results are provisional. Open a builder’s profile to explore their record.</p><div id="leader-results"></div>';
}

function avatar(url,handle) {
  const source = safeUrl(url);
  const initials = String(handle || '?').slice(0,2).toUpperCase();
  return source ? `<img src="${source}" class="avatar" alt="" crossorigin="anonymous" loading="lazy">` : `<span aria-hidden="true" class="avatar initials">${esc(initials)}</span>`;
}

function score(value) {
  if (typeof value === 'number') return value.toLocaleString('en-US',{maximumFractionDigits:4});
  return esc((typeof value === 'object' ? value?.value : value) ?? '—');
}

export function leaderboardRows(data,page,windowing) {
  const rows = itemsOf(data), columns = data.columns ?? [];
  const start = windowing?.start ?? (page-1)*25;
  const end = windowing?.end ?? page*25;
  const rowHeight = windowing?.rowHeight ?? 68;
  const body = rows.slice(start,end).map((entry,index) => {
    const handle = entry.handle ?? entry.user?.handle ?? entry.profile?.handle ?? entry.owner?.handle;
    const rank = entry.rank ?? entry.place ?? start+index+1;
    const identity = handle ? `<a href="#/profile/${encodeURIComponent(handle)}">@${esc(handle)} ↗</a>` : `<strong>${esc(entry.name ?? entry.title ?? entry.submissionId ?? 'Entry')}</strong>`;
    const label = entry.title ?? entry.name ?? entry.submission_id ?? entry.id ?? '';
    const values = columns.length
      ? columns.map(column => `<td class="score">${score(entry.values?.[column.key] ?? entry.scores?.[column.key] ?? entry[column.key])}</td>`).join('')
      : `<td class="score">${score(entry.score ?? entry.rate ?? entry.winRate)}</td><td><span class="badge">${esc(entry.status ?? 'Ranked')}</span></td>`;
    return `<tr><td class="rank"><span class="rank-num ${Number(rank) <= 3 ? 'top' : ''}">${esc(rank)}</span></td><td><div class="builder">${avatar(entry.avatarUrl ?? entry.user?.avatarUrl,handle)}<div>${identity}<small>${esc(label)}</small></div></div></td>${values}</tr>`;
  }).join('');
  const columnCount = columns.length ? columns.length+2 : 4;
  const before = windowing && start ? `<tr class="virtual-spacer" aria-hidden="true"><td colspan="${columnCount}" style="height:${start*rowHeight}px"></td></tr>` : '';
  const after = windowing && end < rows.length ? `<tr class="virtual-spacer" aria-hidden="true"><td colspan="${columnCount}" style="height:${(rows.length-end)*rowHeight}px"></td></tr>` : '';
  const empty = '<tr><td colspan="12" class="empty">No ranked entries yet. Check back after the first results.</td></tr>';
  return `<div class="table-wrap"${windowing ? ' tabindex="0" aria-label="Leaderboard entries"' : ''}><table class="leader-table"${windowing ? ` aria-rowcount="${rows.length+1}"` : ''}><thead><tr><th class="rank">RANK</th><th>BUILDER / ENTRY</th>${columns.length ? columns.map(column=>`<th>${esc(column.label ?? column.name ?? column.key)}</th>`).join('') : '<th>SCORE</th><th>STATUS</th>'}</tr></thead><tbody${windowing ? ` data-start="${start}" data-end="${end}"` : ''}>${before}${body || empty}${after}</tbody></table></div>` + pagination(rows.length,page);
}

export function profile(data,handle) {
  const person = data.profile ?? data.user ?? data;
  const record = data.stats ?? data.record ?? person.stats ?? {};
  let links = Object.entries(person.links ?? {}).map(([label,url]) => safeUrl(url) ? external(safeUrl(url),esc(label)) : '').join('');
  if (safeUrl(person.website)) links += external(safeUrl(person.website),'Website');
  const figures = [
    ['ENTERED',number(record.entered ?? record.competitionsEntered ?? record.entries),'Competitions'],
    ['WON',number(record.won ?? record.wins),'First places'],
    ['PLACED',number(record.placed ?? record.placements),'Reward finishes'],
    ['PRIZE MONEY',money(record.prizeMoneyUsd ?? record.prizeMoney ?? record.totalPrizeUsd),'Lifetime rewards']
  ];
  return crumb('Builder profile') + `<section class="profile-hero">${avatar(person.avatarUrl ?? person.avatar_url,handle)}<div><div class="eyebrow accent">BUILDER PROFILE</div><h1>${esc(person.displayName ?? person.name ?? handle)}</h1><span class="muted">@${esc(person.handle ?? handle)}</span><p>${esc(person.bio ?? '')}</p><div class="profile-links">${links}</div></div></section>` + stats(figures) + '<div class="section-head"><h2>Entry history</h2><span id="sync" class="sync">Public builder record</span></div><div id="profile-results"></div>';
}

export function profileRows(data,page) {
  const entries = data.entries ?? data.submissions ?? [];
  const body = entries.slice((page-1)*25,page*25).map(entry => {
    const competition = entry.competition ?? entry.bounty ?? entry;
    const title = competition.title ?? entry.title ?? competition.slug;
    const label = entry.name ?? entry.submission_id ?? '';
    return `<a href="${route(competition.slug ?? entry.competitionSlug)}" class="profile-entry"><div><span class="eyebrow">${esc(entry.status ?? 'ENTRY')}</span><h3>${esc(title)}</h3><p>${esc(label)}</p></div><span>${entry.rank ? '#'+esc(entry.rank) : 'View bounty'} ↗</span></a>`;
  }).join('');
  return `<div class="profile-entries">${body || '<div class="empty">No public entries to show.</div>'}</div>` + pagination(entries.length,page);
}
