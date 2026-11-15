// Node stdlib only. Run the dev server first: node serve.ts --port 8080
// Captures only after real API rendering; never replaces network data with fixtures.
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {homedir} from 'node:os';
const chrome=process.env.CHROME_BIN || `${homedir()}/.cache/ms-playwright/chromium-1187/chrome-linux/chrome`;
const root=new URL('../',import.meta.url);
const proxy=process.env.HTTPS_PROXY || process.env.https_proxy;
const browser=spawn(chrome,['--headless','--no-sandbox',...(proxy?[`--proxy-server=${proxy}`]:[]),'--disable-dev-shm-usage','--remote-debugging-port=9222','--user-data-dir=/tmp/makefun-desk-chrome','about:blank'],{stdio:['ignore','ignore','pipe']});
let browserLog='';browser.stderr.on('data',chunk=>browserLog+=chunk);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let socket;
try {
 let endpoint;
 for(let attempt=0;attempt<60;attempt++) {
  if(browser.exitCode!=null||browser.signalCode)throw Error(`Chromium exited (${browser.exitCode}): ${browserLog}`);
  try { const response=await fetch('http://127.0.0.1:9222/json/new?about:blank',{method:'PUT'});endpoint=(await response.json()).webSocketDebuggerUrl;if(endpoint)break; } catch {}
  await delay(250);
 }
 if(!endpoint)throw Error('CDP did not start: '+browserLog);
 socket=new WebSocket(endpoint);
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 let id=0;const pending=new Map();const errors=[];const network=[];
 socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const job=pending.get(message.id);if(job){pending.delete(message.id);message.error?job.reject(Error(JSON.stringify(message.error))):job.resolve(message.result);}}if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);};
 function send(method,params={}) {return new Promise((resolve,reject)=>{const current=++id;pending.set(current,{resolve,reject});socket.send(JSON.stringify({id:current,method,params}));setTimeout(()=>{if(pending.has(current)){pending.delete(current);reject(Error(`CDP timeout: ${method}`));}},25000).unref();});}
 async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
 socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.method==='Network.loadingFailed')network.push(message.params);if(message.method==='Network.responseReceived'){const {url,status}=message.params.response;if(url.startsWith('https://make.fun/api/')){network.push({url,status});if(status===429){console.error('HTTP 429: stopping immediately');socket.close();browser.kill();process.exitCode=29;}}}});
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 // The capture host's egress proxy works in Node but refuses Chromium CONNECT.
 // Forward each intercepted request to the live origin, without fixtures or saved answers.
 if(process.env.CAPTURE_NODE_EGRESS==='1') {
  socket.addEventListener('message',async event=>{
   const message=JSON.parse(event.data);if(message.method!=='Fetch.requestPaused')return;
   const {requestId,request}=message.params;
   try {
    const response=await fetch(request.url);
    if(response.status===429){console.error('HTTP 429: stopping immediately');browser.kill();process.exit(29);}
    const body=Buffer.from(await response.arrayBuffer()).toString('base64');
    const responseHeaders=[...response.headers].filter(([name])=>!['content-encoding','content-length','transfer-encoding'].includes(name)).map(([name,value])=>({name,value}));
    network.push({url:request.url,status:response.status,transport:'live Node egress'});
    await send('Fetch.fulfillRequest',{requestId,responseCode:response.status,responseHeaders,body});
   }catch(error){console.error(error);await send('Fetch.failRequest',{requestId,errorReason:'Failed'});}
  });
  await send('Fetch.enable',{patterns:[{urlPattern:'https://make.fun/api/*'}]});
 }
 async function open(path,width=1280,height=800) {
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
  await evaluate('window.__shotReady = false');
  await send('Page.navigate',{url:'http://127.0.0.1:8080/'+path});
  const until=Date.now()+25000;let ready=false;
  while(Date.now()<until){try{ready=await evaluate('window.__shotReady === true');}catch{}if(ready)break;await delay(150);}
  if(!ready)throw Error(`Route ${path} did not render live data: ${await evaluate('document.body.innerText')}\nNetwork: ${JSON.stringify(network)}`);
  await delay(300);
  const result=await evaluate(`({title:document.title,text:document.querySelector('#app').innerText,overflow:document.documentElement.scrollWidth>innerWidth,brokenImages:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src),rows:document.querySelectorAll('.bounty-row,.leader-table tbody tr,.profile-entry').length})`);
  if(result.overflow)throw Error('Horizontal overflow on '+path);
  if(errors.length)throw Error('Browser exceptions: '+JSON.stringify(errors));
  return result;
 }
 async function capture(file,format='jpeg') {const shot=await send('Page.captureScreenshot',{format,quality:format==='jpeg'?80:undefined,captureBeyondViewport:false});const bytes=Buffer.from(shot.data,'base64');if(format==='jpeg'&&bytes.length>262144)throw Error(`Screenshot exceeds cap: ${file} ${bytes.length}`);await writeFile(file,bytes);return bytes.length;}
 const shots=JSON.parse(await readFile(new URL('shots.json',root),'utf8'));
 await mkdir(new URL('screenshots/',root),{recursive:true});
 const report=[];
 for(const shot of shots){const result=await open(shot.path,shot.viewport.width,shot.viewport.height);const bytes=await capture(new URL('screenshots/'+shot.file,root));report.push({route:shot.path,bytes,...result});}
 report.push({route:'#/profile/0xk4njut',...await open('#/profile/0xk4njut')});
 for(const path of ['#/','#/bounty/makefun-frontend-01','#/bounty/makefun-frontend-01/leaderboard','#/profile/0xk4njut'])report.push({route:path+' (phone)',...await open(path,390,844)});
 await open('#/',390,844);
 // Verify both theme modes and local filter updates without navigation.
 await evaluate(`document.querySelector('#theme').click()`);
 report.push({check:'alternate-theme',theme:await evaluate('document.documentElement.dataset.theme'),overflow:await evaluate('document.documentElement.scrollWidth>innerWidth')});
 await evaluate(`document.querySelector('[data-filter="free"]').click()`);
 report.push({check:'filter',selected:await evaluate(`document.querySelector('[data-filter="free"]').getAttribute('aria-pressed')`)});
 await evaluate(`{document.querySelector('[data-filter="all"]').click();const input=document.querySelector('#search');input.value='radar';input.dispatchEvent(new Event('input',{bubbles:true}));}`);
 const search=await evaluate(`({rows:document.querySelectorAll('.bounty-row').length,text:document.querySelector('#board-results').innerText})`);
 if(!search.rows||!/radar/i.test(search.text))throw Error('Search did not return the matching live bounty');
 report.push({check:'search',rows:search.rows});
 await evaluate(`{const input=document.querySelector('#search');input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));const sort=document.querySelector('#sort');sort.value='entries';sort.dispatchEvent(new Event('change',{bubbles:true}));}`);
 const entries=await evaluate(`[...document.querySelectorAll('.cell.entries')].map(x=>Number(x.innerText.replace(/[^0-9]/g,'')))`);
 if(entries.some((n,i)=>i&&n>entries[i-1]))throw Error('Entry sorting is not descending');
 report.push({check:'sort',descending:true});
 await open('#/bounty/makefun-frontend-01/leaderboard');
 await evaluate(`document.querySelector('[data-page="2"]').click()`);
 const second=await evaluate(`document.querySelector('.pagination').innerText`);
 if(!second.includes('2 /'))throw Error('Leaderboard pagination did not advance');
 report.push({check:'pagination',page:second});
 report.push({check:'network',responses:network});
 await writeFile(new URL('verification.json',root),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
} finally {socket?.close();browser.kill();}
