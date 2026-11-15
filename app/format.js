export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
export const money = value => value == null ? '—' : Number(value).toLocaleString('en-US', { style:'currency', currency:'USD', maximumFractionDigits:Number.isInteger(Number(value)) ? 0 : 2 });
export const number = value => value == null ? '—' : Number(value).toLocaleString('en-US');
export const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-US', {dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}) + ' UTC' : 'Not announced';
export const accepting = b => b.status === 'open' && Date.parse(b.deadline) > Date.now();
export function timeLeft(value) { const ms = Date.parse(value) - Date.now(); if (!Number.isFinite(ms)) return 'No deadline'; if (ms <= 0) return 'Entries closed'; const h = Math.floor(ms/3600000), m = Math.floor(ms/60000); return h >= 24 ? `${Math.floor(h/24)}d ${h%24}h left` : h ? `${h}h ${m%60}m left` : `${m}m left`; }
export const pot = b => b.potUsd ?? b.rewardAmount;
export const fee = b => Number(b.entryFeeUsd) ? money(b.entryFeeUsd) : 'Free';
export const route = slug => '#/bounty/' + encodeURIComponent(slug);
export function safeUrl(value) { try { const u = new URL(value); return ['https:','http:'].includes(u.protocol) ? esc(u.href) : ''; } catch { return ''; } }
// A small safe Markdown reader: escape first, then format. No HTML from API data is executed.
export function markdown(value) {
  return String(value ?? '').split(/\n{2,}/).map(block => {
    const text = esc(block).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1 ↗</a>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    if (/^#{1,4} /.test(text)) return `<h3>${text.replace(/^#{1,4} /,'')}</h3>`;
    if (/^[-*] /.test(text)) return '<ul>'+text.split('\n').map(l=>`<li>${l.replace(/^[-*] /,'')}</li>`).join('')+'</ul>';
    return `<p>${text.replace(/\n/g,'<br>')}</p>`;
  }).join('');
}
