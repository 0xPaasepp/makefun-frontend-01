import {get,cached,boardPath,bountyPath,leaderboardPath,profilePath} from './api.js';
import {board,boardRows,bounty,leaderboard,leaderboardRows,profile,profileRows,itemsOf,PAGE_SIZE} from './views.js';
import {esc,accepting,pot} from './format.js';
const app=document.querySelector('#app'), theme=document.querySelector('#theme');
document.querySelector('.skip').onclick=event=>{event.preventDefault();document.querySelector('#content').focus();};
let generation=0, state=null, requestPath='', page=1, filter='all', query='', sort='reward';
const systemTheme=matchMedia('(prefers-color-scheme: dark)');
let preference; try { preference=localStorage.getItem('desk-theme'); } catch {}
function setTheme(value) { document.documentElement.dataset.theme=value; theme.setAttribute('aria-label',`Switch to ${value==='dark'?'light':'dark'} theme`); }
setTheme(preference || (systemTheme.matches?'dark':'light'));
theme.onclick=()=>{preference=document.documentElement.dataset.theme==='dark'?'light':'dark';setTheme(preference);try{localStorage.setItem('desk-theme',preference);}catch{}};
systemTheme.addEventListener('change',event=>{if(!preference)setTheme(event.matches?'dark':'light');});
const jump=document.querySelector('#jump'), jumpToggle=document.querySelector('#jump-toggle');
function toggleJump(open) { jump.hidden=!open;jumpToggle.setAttribute('aria-expanded',String(open));if(open)document.querySelector('#jump-value').focus(); }
jumpToggle.onclick=()=>toggleJump(jump.hidden);
jump.onsubmit=event=>{event.preventDefault();const value=document.querySelector('#jump-value').value.trim().replace(/^[@#\/]+/,'');if(value){location.hash=`#/${document.querySelector('#jump-type').value}/${encodeURIComponent(value)}`;toggleJump(false);}};
document.addEventListener('keydown',event=>{if(event.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){event.preventDefault();toggleJump(true);}if(event.key==='Escape')toggleJump(false);});
function parseRoute() { const parts=location.hash.replace(/^#\/?/,'').split('/');if(!parts[0])return {type:'board',path:boardPath};let id;try{id=decodeURIComponent(parts[1]||'');}catch{throw Error('This address is not valid.');}if(parts[0]==='bounty'&&id)return {type:parts[2]==='leaderboard'?'leaderboard':'bounty',id,path:parts[2]==='leaderboard'?leaderboardPath(id):bountyPath(id)};if(parts[0]==='profile'&&id)return {type:'profile',id,path:profilePath(id)};throw Error('This page could not be found.'); }
function updateList() {
 if(!state)return;
 const {type,data}=state;
 if(type==='board') {
  const all=itemsOf(data).filter(b=>(filter!=='live'||accepting(b))&&(filter!=='free'||!Number(b.entryFeeUsd))&&`${b.title} ${b.summary} ${b.slug}`.toLowerCase().includes(query));
  all.sort((a,b)=>sort==='deadline'?Date.parse(a.deadline)-Date.parse(b.deadline):sort==='entries'?Number(b.submissionCount)-Number(a.submissionCount):Number(pot(b))-Number(pot(a)));
  page=Math.min(page,Math.max(1,Math.ceil(all.length/PAGE_SIZE)));
  document.querySelector('#board-results').innerHTML=boardRows(all,page);
 } else if(type==='leaderboard')document.querySelector('#leader-results').innerHTML=leaderboardRows(data,page);
 else if(type==='profile')document.querySelector('#profile-results').innerHTML=profileRows(data,page);
}
function showData(route,item,initial=true) {
 const data=item.data;
 state={...route,data};
 if(initial) {
  app.innerHTML=route.type==='board'?board(data):route.type==='bounty'?bounty(data):route.type==='leaderboard'?leaderboard(data,route.id):profile(data,route.id);
  document.title=(route.type==='board'?'Bounty board':route.type==='profile'?`@${route.id}`:route.type==='leaderboard'?`${route.id} · Leaderboard`:data.title)+' · make.fun desk';
  updateList();
 }
 const sync=document.querySelector('#sync');if(sync)sync.textContent=item.stale?'Cached · connection unavailable':`Updated ${new Date(item.at).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}`;
 document.querySelector('#notice').textContent=item.stale?'Showing saved data. Refresh to try the connection again.':'';
 window.__shotReady=true;
}
async function navigate(force=false) {
 const ticket=++generation;window.__shotReady=false;page=1;filter='all';query='';sort='reward';
 let route;
 try {
  route=parseRoute();requestPath=route.path;
  document.querySelector('#board-nav').setAttribute('aria-current',route.type==='board'?'page':'false');
  document.querySelector('#profile-nav').setAttribute('aria-current',route.type==='profile'?'page':'false');
  const old=cached(route.path);
  if(old)showData(route,old);
  else app.innerHTML='<section class="loading" aria-live="polite"><span class="loader"></span><h1>Opening the desk</h1><p>Fetching the latest public data from make.fun…</p></section>';
  app.setAttribute('aria-busy','true');
  const item=await get(route.path,force);if(ticket!==generation)return;
  // Cached data paints immediately; only the route's content changes when the answer changes. Header, navigation and theme persist.
  if(!old||JSON.stringify(old.data)!==JSON.stringify(item.data))showData(route,item);else showData(route,item,false);
  app.setAttribute('aria-busy','false');
  window.scrollTo(0,0);
 }catch(error){if(ticket!==generation)return;app.setAttribute('aria-busy','false');app.innerHTML=`<section class="empty error"><div class="eyebrow accent">CONNECTION DESK</div><h1>Couldn’t open this page.</h1><p>${esc(error.message)}</p><p>Public data is served directly by make.fun. Check your connection and try again.</p><button class="primary" id="retry">Try again ↻</button> <a class="outline-button" href="#/">Back to board</a></section>`;window.__shotReady=false;}
}
app.addEventListener('click',event=>{
 const next=event.target.closest('[data-page]'), choice=event.target.closest('[data-filter]');
 if(next&&!next.disabled){page=Number(next.dataset.page);updateList();document.querySelector('.section-head')?.scrollIntoView({block:'start',behavior:'smooth'});}
 if(choice){filter=choice.dataset.filter;page=1;document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('selected',b===choice);b.setAttribute('aria-pressed',String(b===choice));});updateList();}
 if(event.target.closest('#retry'))navigate(true);
});
app.addEventListener('input',event=>{if(event.target.id==='search'){query=event.target.value.toLowerCase();page=1;updateList();}});
app.addEventListener('change',event=>{if(event.target.id==='sort'){sort=event.target.value;page=1;updateList();}});
// One revalidation when returning to a visible tab; no polling while the page is hidden.
document.addEventListener('visibilitychange',async()=>{if(document.hidden||!state)return;const ticket=generation, old=state;try{const item=await get(requestPath);if(ticket!==generation)return;if(JSON.stringify(old.data)!==JSON.stringify(item.data)) {if(old.type==='board'||old.type==='leaderboard'||old.type==='profile'){state={...old,data:item.data};updateList();showData(state,item,false);}else showData(old,item);}else showData(old,item,false);}catch{}});
window.addEventListener('hashchange',()=>navigate());
navigate();
