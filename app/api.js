// One GET per surface. Memory + sessionStorage cache; deduplicated requests and minute-bound ETag revalidation.
const API = 'https://make.fun/api';
const memory = new Map(), pending = new Map();
const minute = () => Math.floor(Date.now() / 60000);
export function cached(path) {
  if (memory.has(path)) return memory.get(path);
  try { const item = JSON.parse(sessionStorage.getItem('desk:' + path)); if (item?.data) { memory.set(path, item); return item; } } catch {}
  return null;
}
export function get(path, force = false) {
  const old = cached(path);
  if (!force && old?.minute === minute()) return Promise.resolve(old);
  if (pending.has(path)) return pending.get(path);
  const request = (async () => {
    const response = await fetch(API + path, { method: 'GET', headers: old?.etag ? { 'If-None-Match': old.etag } : {}, signal: AbortSignal.timeout(18000) });
    if (!response.ok && response.status !== 304) throw new Error(response.status === 404 ? 'This page could not be found.' : `make.fun returned ${response.status}. Please try again.`);
    const item = { data: response.status === 304 && old ? old.data : await response.json(), etag: response.headers.get('ETag') || old?.etag, minute: minute(), at: Date.now(), stale: false };
    memory.set(path, item);
    try { sessionStorage.setItem('desk:' + path, JSON.stringify(item)); } catch {}
    return item;
  })().catch(error => { if (old) return { ...old, stale: true }; throw error; }).finally(() => pending.delete(path));
  pending.set(path, request);
  return request;
}
export const boardPath = '/competitions?status=open&activity=times';
export const bountyPath = slug => `/competitions/${encodeURIComponent(slug)}`;
export const leaderboardPath = slug => `${bountyPath(slug)}/leaderboard`;
export const profilePath = handle => `/profiles/${encodeURIComponent(handle)}`;
