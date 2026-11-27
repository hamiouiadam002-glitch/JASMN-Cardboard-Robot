// JASMN provider-failover tests: Groq + Gemini only (no xAI key anywhere).
// Usage: node JASMN_tests.js JASMN_Phase1_2.html
// Deterministic: a virtual clock replaces setTimeout/Date, so nothing is timing-dependent and no real timers are left running.
// Drives the real ask() / startRequest() / provider-manager code extracted from the HTML file; fetch is mocked.
const fs = require('fs'), vm = require('vm');
const file = process.argv[2] || 'JASMN_Phase1_2.html';
const s = fs.readFileSync(file, 'utf8');
const between = (a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i); if (i < 0 || j < 0) throw new Error('marker missing: ' + a); return s.slice(i, j); };
const code = between('// ==== ROUTING-BEGIN', '// ==== ROUTING-END') + between('// ==== BRAIN-CORE-BEGIN', '// ==== BRAIN-CORE-END')
  + between('// ==== JOBS-BEGIN', '// ==== JOBS-END') + between('  var HARD =', '  var reqId') + between('  function ask(q, opts) {', "  chat.addEventListener('submit'");

let vnow = Date.UTC(2026, 10, 27, 12, 0, 0), tid = 0; const timers = [];
class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(vnow); } static now() { return vnow; } }
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r)); };
const sb = {
  console: { info: x => console.log(x), warn() {}, log() {}, error: console.error },
  Promise, Intl, JSON, Math, Object, Array, String, parseFloat, parseInt, isFinite, Error, RegExp, Number, Date: FakeDate,
  setTimeout: (f, ms) => { const id = ++tid; timers.push({ id, at: vnow + (ms || 0), f }); return id; },
  clearTimeout: id => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); },
  __timers: () => timers.length,
  __adv: async ms => { const target = vnow + ms; await settle(); for (;;) { timers.sort((a, b) => a.at - b.at || a.id - b.id); const t = timers[0]; if (!t || t.at > target) break; timers.shift(); vnow = Math.max(vnow, t.at); t.f(); await settle(); } vnow = target; await settle(); },
  __log: [], process
};
sb.__src = s; vm.createContext(sb);
const env = `
var window={speechSynthesis:{cancel:function(){}}}, LS={}, STORE_FAIL=false, store=function(k,v){if(v===undefined)return LS[k]===undefined?null:LS[k];if(!STORE_FAIL)LS[k]=v;return null}, hist=[], provider='groq', apiKey='GKEY12345678', model='openai/gpt-oss-120b',
 GEMINI='https://generativelanguage.googleapis.com/v1beta/', WEB_ON=true, WEB_MODEL='openai/gpt-oss-20b', FAST_MODEL='openai/gpt-oss-20b', PERSONA='JASMN persona', AIMOODS=['smile','happy','curious','sympathy'], ACTIONS=['none','wave'],
 PROVIDERS={groq:{name:'Groq',base:'https://api.groq.com/openai/v1/',def:'openai/gpt-oss-120b'},xai:{name:'xAI Grok',base:'https://api.x.ai/v1/',def:'grok-4'},gemini:{name:'Google',base:GEMINI,def:'models/gemini-flash-lite-latest'}},
 norm=function(q){return q.toLowerCase().replace(/[^\\p{L}\\p{N} ]/gu,' ').replace(/\\s+/g,' ').trim()},
 busy=false, talking=false, talkId=0, reqId=0, thinkT=0, calmT=0, lastReply='', demo=false, demoBtn={setAttribute:function(){}}, out=[], warns=[], Q={groq:[],gemini:[]}, calls=[], unexpected=0,
 wake=function(){}, stopRec=function(){}, quickReply=function(){return null}, showSub=function(){}, fadeSub=function(){}, setMood=function(){}, sendAction=function(a){out.push({action:a})},
 cleanSpoken=function(t){return String(t||'').trim()}, speak=function(t,m,l){busy=false;out.push({say:t,mood:m,lang:l})}, fail=function(m){busy=false;out.push({fail:m})};
console.warn=function(){warns.push([].slice.call(arguments).join(' '))};
function resp(st,body,h){h=h||{};return {ok:st<400,status:st,headers:{get:function(k){return h[k.toLowerCase()]===undefined?null:h[k.toLowerCase()]}},json:async function(){return body},text:async function(){return typeof body==='string'?body:JSON.stringify(body)}}}
fetch=async function(url,o){var pv=/groq/.test(url)?'groq':/generativelanguage/.test(url)?'gemini':'OTHER',b=JSON.parse(o.body);
  calls.push({pv:pv,t:Date.now(),model:b.model||url.split('/').pop().split(':')[0],tools:b.tools,body:b});
  var f=(Q[pv]||[]).shift();if(!f){unexpected++;return resp(500,'unexpected call')}return f(b)};
`;
const tests = `
var R=function(j){return JSON.stringify(Object.assign({mood:'smile',lang:'en',action:'none'},j))};
var G=function(j){return function(){return resp(200,{choices:[{message:{content:R(j)}}]})}}, M=function(j){return function(){return resp(200,{candidates:[{content:{parts:[{text:R(j)}]}}]})}};
var GS=function(){return resp(200,{choices:[{message:{content:'Groq found: Story A, B, C.',executed_tools:[{search_results:{results:[{title:'Hespress',url:'https://hespress.com/1'}]}}]}}]})};
var MS=function(){return resp(200,{candidates:[{content:{parts:[{text:'Gemini found: Story X, Y.'}]},groundingMetadata:{groundingChunks:[{web:{uri:'https://g.co/r1',title:'le360.ma'}}],webSearchQueries:['news']}}]})};
var gRl=function(h,msg){return function(){return resp(429,{error:{message:msg||'Rate limit reached for model x. Tokens per minute (TPM): Limit 8000, Used 7976, Requested 1036. Please try again in 2s.'}},h||{'retry-after':'2'})}};
var mRl=function(details,msg){return function(){return resp(429,{error:{code:429,status:'RESOURCE_EXHAUSTED',message:msg||'Quota exceeded. Please retry in 5s.',details:details||[]}})}};
var DAILY_M=[{'@type':'type.googleapis.com/google.rpc.QuotaFailure',violations:[{quotaId:'GenerateRequestsPerDayPerProjectPerModel-FreeTier'}]}];
var L=function(n){return 'please explain to me in a simple way how thing number '+n+' works'};   // long + "explain" => not the small fast path
var W='search the web for the latest news in morocco today';
function reset(){PS.cool={};PS.fails={};PS.authBad={};PS.lastOk=null;webCache={};notices={};hist=[];out=[];warns=[];calls.length=0;unexpected=0;Q.groq=[];Q.gemini=[];
 LS={'key.gemini':'MKEY12345678'};apiKey='GKEY12345678';provider='groq';model='openai/gpt-oss-120b';pending=null;lastJob=null;clearTimeout(pendT);busy=false;window.JASMN_PENDING=null;STORE_FAIL=false}
var says=function(){return out.filter(function(o){return o.say!==undefined}).map(function(o){return o.say})};
async function until(c,ms){var t=0;while(!c()&&t<(ms||60000)){await __adv(50);t+=50}return c()}
async function ask1(q){var n=out.length;ask(q);await until(function(){return out.length>n});return out.slice(n)}
var seq=function(){return calls.map(function(c){return c.pv}).join()};
var P=0,F=0,fails=[];function ok(c,m){if(c)P++;else{F++;fails.push(m)}__log.push((c?'PASS ':'FAIL ')+m)}
(async function(){
 // ===== xAI is absent =====
 reset();
 ok(providerOrder().join()==='groq,gemini','two providers: only Groq and Gemini are in the rotation (xAI ignored without a key)');
 ok(window.JASMN_STATUS().keysSaved.join()==='groq,gemini','JASMN_STATUS lists no xAI');
 // ===== 1 ordinary conversation =====
 reset();Q.groq=[G({reply:'Hi, I am here.'})];await ask1(L(1));
 ok(seq()==='groq'&&says()[0]==='Hi, I am here.'&&hist.length===2,'1  Groq answers, no switching, history written once');
 // ===== 2 Groq rate limit -> Gemini; next question stays on Gemini while Groq cools; then back to Groq =====
 reset();Q.groq=[gRl({'retry-after':'8'})];Q.gemini=[M({reply:'Gemini here',mood:'happy'}),M({reply:'Gemini again'})];
 var r=await ask1(L(2));
 ok(seq()==='groq,gemini'&&r[0].say==='Gemini here'&&r[0].mood==='happy','2a Groq TPM 429 -> Gemini answers, mood kept');
 calls.length=0;await ask1(L(3));ok(seq()==='gemini','2b Groq is not called again while it is cooling down');
 await __adv(9000);calls.length=0;Q.groq=[G({reply:'Groq is back'})];r=await ask1(L(4));
 ok(seq()==='groq'&&r[0].say==='Groq is back','2c Groq recovered -> JASMN returns to Groq automatically');
 // ===== 3 Gemini limited, Groq recovers -> Groq answers (pending kept in between) =====
 reset();Q.groq=[gRl({'retry-after':'5'})];Q.gemini=[M({reply:'Gemini one'}),mRl([],'Quota exceeded. Please retry in 30s.')];
 await ask1(L(5));var t0=Date.now();
 await __adv(1000);Q.groq.push(G({reply:'Groq answers after recovery'}));r=await ask1(L(6));
 ok(/All my brains are busy/.test(r[0].say)&&window.JASMN_PENDING===L(6)&&hist.length===2,'3a Groq cooling + Gemini limited -> pending message, question kept, history untouched');
 await until(function(){return says().some(function(t){return /after recovery/.test(t)})});
 ok(says().pop()==='Groq answers after recovery'&&hist.length===4&&hist[2].parts[0].text===L(6)&&Date.now()-t0>=5000&&Date.now()-t0<9000,'3b retried automatically when Groq recovered (~'+Math.round((Date.now()-t0)/1000)+'s), answered once, history not duplicated');
 // ===== 4 both limited, retry ordinary conversation =====
 reset();Q.groq=[gRl({'retry-after':'3'}),G({reply:'Back on Groq'})];Q.gemini=[mRl([],'Quota exceeded. Please retry in 10s.')];
 r=await ask1(L(7));await until(function(){return says().some(function(t){return t==='Back on Groq'})});
 ok(calls.length===3&&seq()==='groq,gemini,groq'&&!pending&&hist.length===2,'4  both limited -> waits for the first cooldown, retries once, resumes ('+seq()+')');
 // ===== 5 Gemini becomes available again when needed =====
 reset();Q.groq=[gRl({'retry-after':'60'}),gRl({'retry-after':'60'})];Q.gemini=[mRl([],'Quota exceeded. Please retry in 4s.'),mRl([],'Quota exceeded. Please retry in 4s.')];
 // groq limited for 60s; gemini limited for 4s then healthy
 await ask1(L(8));await until(function(){return !pending&&says().length>=2},20000);
 reset();Q.groq=[gRl({'retry-after':'40'})];Q.gemini=[M({reply:'Gemini one'}),mRl([],'Quota exceeded. Please retry in 5s.'),M({reply:'Gemini is usable again'})];
 await ask1(L(9));await __adv(500);ask(L(10));await until(function(){return says().some(function(t){return /busy/.test(t)})});
 await until(function(){return says().some(function(t){return t==='Gemini is usable again'})},30000);
 ok(says().pop()==='Gemini is usable again'&&PS.cool['groq|openai/gpt-oss-120b'].until>Date.now(),'5  Gemini limit expired while Groq still cooling -> Gemini used again');
 // ===== 6 web search with two providers =====
 reset();Q.groq=[gRl({'retry-after':'20'}),G({reply:'Three stories today.',mood:'curious',action:'wave'})];Q.gemini=[MS];
 r=await ask1(W);var sc=calls.map(function(c){return c.pv+':'+(c.tools?Object.keys(c.tools[0]).join()+'/'+(c.tools[0].type||''):'chat')});
 ok(sc.join(' | ')==='groq:type/browser_search | gemini:google_search/ | groq:chat','6a Groq search 429 -> Gemini google_search -> formatted by Groq ('+sc.join(' | ')+')');
 ok(window.JASMN_LAST_SEARCH.provider==='gemini'&&window.JASMN_LAST_SEARCH.sources[0].url==='https://g.co/r1'&&r[0].mood==='curious'&&r[1].action==='wave','6b Gemini sources kept; mood and action still applied');
  reset();Q.groq=[gRl({'retry-after':'6'})];Q.gemini=[MS,mRl([],'Quota exceeded. Please retry in 30s.')];
  await ask1(W);webCache={};out=[];                              // the first request's own "busy" message is cleared so it cannot satisfy the wait below
  ask('search the web for the latest football results');
  await until(function(){return window.JASMN_PENDING==='search the web for the latest football results'&&says().some(function(t){return /busy/.test(t)})});
  ok(window.JASMN_PENDING==='search the web for the latest football results'&&says().length===1,'6c search: Groq cooling + Gemini limited -> pending, question kept (waited for this request, not the old one)');
 Q.groq.push(GS,G({reply:'Football results are in.'}));await until(function(){return says().some(function(t){return /Football results are in/.test(t)})},30000);
 ok(window.JASMN_LAST_SEARCH.provider==='groq'&&says().pop()==='Football results are in.','6d search: Groq recovered -> Groq Browser Search performs the retried search');
 reset();Q.groq=[gRl({'retry-after':'2'})];Q.gemini=[mRl([],'Quota exceeded. Please retry in 3s.'),MS,M({reply:'Gemini search worked'})];
 await ask1(W);await until(function(){return says().some(function(t){return t==='Gemini search worked'})},30000);
 ok(window.JASMN_LAST_SEARCH.provider==='gemini'&&!pending,'6e both search providers limited -> pending retry -> whichever recovers does the search');
  // ===== 7 daily quotas: one saved retry at the reset time =====
  reset();Q.groq=[gRl({}, 'Rate limit reached for model x on tokens per day (TPD): Limit 200000. Please try again in 14m2s.')];Q.gemini=[mRl(DAILY_M)];
  r=await ask1(L(11));var gm=PS.cool['gemini|models/gemini-flash-lite-latest'],gq=PS.cool['groq|openai/gpt-oss-120b'];
  ok(/daily limits/.test(r[0].say)&&/14 minutes|15 minutes/.test(r[0].say)&&/only while this page stays open/.test(r[0].say)&&/can't run anything in the background/.test(r[0].say)&&!!pending&&pending.daily===true&&window.JASMN_PENDING===L(11),'7a both daily-limited -> question kept, one retry scheduled, honest about closed pages (\"'+r[0].say.slice(0,70)+'...\")');
  ok(gm.why==='rate-daily'&&gm.until-Date.now()<=86400000&&gm.until-Date.now()>0&&gq.why==='rate-daily'&&Math.abs((gq.until-Date.now())/1000-842)<3,'7b Gemini reset = next Pacific midnight; Groq reset = \"try again in 14m2s\"');
  var nc=calls.length,sv=JSON.parse(LS.daily);
  ok(__timers()===1&&sv.q===L(11)&&sv.v===1&&sv.expires>sv.at&&sv.at-Date.now()>=842000&&sv.at-Date.now()<=842000+25000,'7c exactly ONE timer, saved with question + expiry (reset + 10-20 s margin)');
  await __adv(600000);ok(calls.length===nc&&__timers()===1,'7d no polling: 10 virtual minutes pass with zero traffic and still just one timer');
  r=await ask1('try again');ok(calls.length===nc&&/daily limits/.test(r[0].say)&&__timers()===1&&!!LS.daily,'7e \"try again\" before the reset sends nothing, keeps the same single timer');
  Q.groq=[G({reply:'Answered after the reset'})];calls.length=0;await __adv(900000);await until(function(){return says().some(function(t){return t==='Answered after the reset'})},60000);
  ok(says().pop()==='Answered after the reset'&&calls.length===1&&calls[0].pv==='groq'&&calls[0].body.messages.slice(-1)[0].content===L(11)&&hist.length===2&&!pending&&!LS.daily&&__timers()===0,'7f at the reset the SAVED question is retried once automatically; answered; saved entry removed; no timers left');
  // ===== 7g-7m daily retry details =====
  // 7g preferred provider first, then the other one. Clock moved to 14 min before Pacific midnight so Gemini and Groq reset together.
  reset();await __adv((msToPacificMidnight()-14*60000+86400000)%86400000);Q.groq=[gRl({}, 'Rate limit reached for model x on tokens per day (TPD): Limit 200000. Please try again in 14m2s.')];Q.gemini=[mRl(DAILY_M)];
  hist=[{role:'user',parts:[{text:'earlier question'}]},{role:'model',parts:[{text:R({reply:'earlier answer'})}]}];
  await ask1(L(30));calls.length=0;Q.groq=[function(){return resp(500,'server down')}];Q.gemini=[M({reply:'Gemini took over after the reset'})];
  await __adv(900000);await until(function(){return says().some(function(t){return /took over/.test(t)})},60000);
  ok(calls.length===2&&calls[0].pv==='groq'&&calls[1].pv==='gemini'&&says().pop()==='Gemini took over after the reset'&&hist.length===4&&hist[0].parts[0].text==='earlier question'&&hist[2].parts[0].text===L(30)&&JSON.stringify(calls[1].body.contents).match(new RegExp(L(30),'g')).length===1,'7g retry tries the preferred provider (Groq) first, then Gemini; original question sent once with the earlier history');
  // 7h cancel
  reset();Q.groq=[gRl({}, 'tokens per day (TPD). Please try again in 14m2s.')];Q.gemini=[mRl(DAILY_M)];await ask1(L(31));var n7=calls.length;
  r=await ask1('cancel');await __adv(90000000);
  ok(/cancelled/.test(r[0].say)&&calls.length===n7&&__timers()===0&&!LS.daily&&!pending&&window.JASMN_PENDING===null,'7h \"cancel\" removes the timer and the saved entry; nothing is sent at the reset time');
  // 7i replace with a new question
  reset();Q.groq=[gRl({}, 'tokens per day (TPD). Please try again in 14m2s.')];Q.gemini=[mRl(DAILY_M)];await ask1(L(32));
  r=await ask1(L(33));                                                   // providers are still locked: the NEW question becomes the saved one
  ok(JSON.parse(LS.daily).q===L(33)&&window.JASMN_PENDING===L(33)&&__timers()===1&&calls.length===2,'7i a new question replaces the saved one: only the new question is stored, one timer, no network traffic');
  Q.groq=[G({reply:'New question answered'})];calls.length=0;await __adv(900000);await until(function(){return !pending});
  ok(calls.length===1&&calls[0].body.messages.slice(-1)[0].content===L(33)&&hist.length===2&&hist[0].parts[0].text===L(33)&&!LS.daily,'7j at the reset only the replacement question is retried; the old one is gone from history and storage');
  // 7k reopening the page restores it (state wiped, storage kept)
  reset();Q.groq=[gRl({}, 'tokens per day (TPD). Please try again in 14m2s.')];Q.gemini=[mRl(DAILY_M)];
  hist=[{role:'user',parts:[{text:'before'}]},{role:'model',parts:[{text:R({reply:'ok before'})}]}];await ask1(L(34));
  var kept=LS.daily;clearTimeout(pendT);pending=null;hist=[];out=[];PS.cool={};PS.fails={};window.JASMN_PENDING=null;busy=false;LS={'key.gemini':'MKEY12345678',daily:kept};calls.length=0;   // = closing and reopening the page
  ok(restoreDaily()===true&&pending&&pending.q===L(34)&&hist.length===2&&hist[0].parts[0].text==='before'&&__timers()===1&&calls.length===0,'7k reopening restores the question, the history and one timer, with no traffic yet');
  Q.groq=[G({reply:'Restored and answered'})];await __adv(900000);await until(function(){return says().some(function(t){return /Restored and answered/.test(t)})},60000);
  ok(says().pop()==='Restored and answered'&&hist.length===4&&!LS.daily&&__timers()===0&&calls.length===1,'7l the restored request is retried at the reset, answered once, entry removed');
  // 7m reopening after the reset time but within the grace window -> one quick retry; after expiry -> discarded
  reset();Q.groq=[gRl({}, 'tokens per day (TPD). Please try again in 14m2s.')];Q.gemini=[mRl(DAILY_M)];await ask1(L(35));kept=LS.daily;
  clearTimeout(pendT);pending=null;hist=[];out=[];PS.cool={};window.JASMN_PENDING=null;busy=false;await __adv(30*60000);LS={'key.gemini':'MKEY12345678',daily:kept};calls.length=0;Q.groq=[G({reply:'Late reopen answered'})];
  ok(restoreDaily()===true&&pending.at-Date.now()<=3000,'7m reopened 30 min after the reset -> retries within seconds');
  await __adv(5000);await until(function(){return !pending});ok(says().pop()==='Late reopen answered'&&calls.length===1,'7n late reopen: answered once');
  reset();LS.daily=JSON.stringify({v:1,q:L(36),prompt:L(36),web:false,fast:false,until:Date.now()-20*3600000,at:Date.now()-20*3600000,expires:Date.now()-60000,waits:1,hist:[]});
  ok(restoreDaily()===false&&!pending&&!LS.daily&&__timers()===0,'7o an expired saved request is discarded, not retried');
  reset();LS.daily='{not json';ok(restoreDaily()===false&&!LS.daily,'7p corrupt saved data is ignored and cleared');
  reset();LS.daily=JSON.stringify({v:1,q:'x',prompt:'x',until:Date.now()+1000,expires:Date.now()+5000,waits:1,hist:[{role:'evil',parts:[{text:'x'}]}]});
  ok(restoreDaily()===false&&!pending&&!LS.daily,'7q tampered history entries are rejected');
  // 7r reset passed but providers still reject -> stop, never loop (clock placed so that BOTH providers reset together and are both retried)
 reset();await __adv((msToPacificMidnight()-14*60000+86400000)%86400000);Q.groq=[gRl({}, 'tokens per day (TPD). Please try again in 14m2s.')];Q.gemini=[mRl(DAILY_M)];await ask1(L(37));
 Q.groq=[gRl({}, 'tokens per day (TPD). Please try again in 14m2s.')];Q.gemini=[mRl(DAILY_M)];calls.length=0;out=[];
 await __adv(900000);await until(function(){return says().some(function(t){return /still being refused/.test(t)})},60000);var after=calls.length,sq=seq();
 await __adv(3*86400000);
 ok(after===2&&sq==='groq,gemini'&&calls.length===2&&__timers()===0&&!pending&&!LS.daily&&/won't keep trying/.test(says().pop()),'7r reset passed but both still reject -> exactly one extra round (groq then gemini = 2 calls), honest message, no timers, no endless loop over 3 more virtual days');
 Q.groq=[G({reply:'Manual retry works'})];r=await ask1('try again');ok(r[0].say==='Manual retry works'&&hist.length===2,'7s after giving up, the user can still say \"try again\" and the original question is re-sent');
  // 7t closing/interruptions: barge-in (reqId bump) does not kill the wait
  reset();Q.groq=[gRl({}, 'tokens per day (TPD). Please try again in 14m2s.')];Q.gemini=[mRl(DAILY_M)];await ask1(L(38));reqId++;
  Q.groq=[G({reply:'Survived barge-in'})];await __adv(900000);await until(function(){return !pending});
  ok(says().pop()==='Survived barge-in','7t an interruption while she was speaking the notice does not cancel the daily wait');
  // 7u storage unavailable -> honest wording, still works while the page is open
  reset();STORE_FAIL=true;Q.groq=[gRl({}, 'tokens per day (TPD). Please try again in 14m2s.')];Q.gemini=[mRl(DAILY_M)];r=await ask1(L(39));
  ok(/couldn't save it on this device/.test(r[0].say)&&!/reopen me/.test(r[0].say)&&!!pending,'7u storage refused -> she says it only lives while the page is open (no false promise)');
  Q.groq=[G({reply:'Worked without storage'})];await __adv(900000);await until(function(){return !pending});ok(says().pop()==='Worked without storage','7v retry still works in memory when storage is unavailable');
  // 7w non-daily long waits keep the old behaviour (no scheduled retry)
  reset();PS.cool['groq|*']={until:Date.now()+1800000,why:'perm'};PS.cool['gemini|*']={until:Date.now()+1800000,why:'perm'};r=await ask1(L(40));
  ok(/hit their limits/.test(r[0].say)&&!pending&&!LS.daily&&__timers()===0,'7w a long non-daily outage (e.g. permission) is NOT auto-retried: old \"ask me again\" message, nothing saved');
 // ===== 20 reset-time estimates: only real information is ever used =====
 var DAYQ='Rate limit reached for model x on requests per day (RPD): Limit 1000, Used 1000, Requested 1.';
 var TPDQ='Rate limit reached for model x on tokens per day (TPD): Limit 200000, Used 199990, Requested 5000.';
 var far=async function(){await __adv((msToPacificMidnight()-20*3600000+86400000)%86400000)};   // put the clock 20 h before Gemini's Pacific-midnight reset, so Groq's reset is the earliest
 // 20a daily limit + valid Groq reset header (x-ratelimit-reset-requests = the daily request reset)
 reset();await far();Q.groq=[gRl({'x-ratelimit-reset-requests':'2h30m'},DAYQ)];Q.gemini=[mRl(DAILY_M)];
 r=await ask1(L(60));gq=PS.cool['groq|openai/gpt-oss-120b'];
 ok(gq.why==='rate-daily'&&!gq.unknown&&Math.abs((gq.until-Date.now())/1000-9000)<3&&warns.some(function(w){return /wait 9000s via x-ratelimit-reset-requests/.test(w)})&&!!pending&&pending.daily===true&&Math.abs((pending.at-Date.now())/1000-9000)<30&&/daily limits/.test(r[0].say),'20a daily limit with a valid Groq reset header -> that header is the reset (9000 s), one daily retry scheduled for it');
 reset();await far();Q.groq=[gRl({'retry-after':'7200','x-ratelimit-reset-tokens':'2s'},TPDQ)];Q.gemini=[mRl(DAILY_M)];
 r=await ask1(L(61));gq=PS.cool['groq|openai/gpt-oss-120b'];
 ok(gq.why==='rate-daily'&&Math.abs((gq.until-Date.now())/1000-7200)<3&&warns.some(function(w){return /wait 7200s via retry-after/.test(w)})&&!!pending&&pending.daily===true,'20b daily limit with Groq retry-after -> used (7200 s); the per-minute token reset header (2 s) is NOT used');
 // 20c explicit duration in the error message
 reset();await far();Q.groq=[gRl({},TPDQ.replace('5000.','5000. Please try again in 2h3m10s.'))];Q.gemini=[mRl(DAILY_M)];
 r=await ask1(L(62));gq=PS.cool['groq|openai/gpt-oss-120b'];
 ok(gq.why==='rate-daily'&&Math.abs((gq.until-Date.now())/1000-7390)<3&&warns.some(function(w){return /wait 7390s via message/.test(w)})&&!!pending&&pending.daily===true,'20c daily limit with an explicit reset duration in the message -> parsed (2h3m10s = 7390 s)');
 // 20d daily limit, no reliable reset: nothing scheduled, honest message, question kept for manual retry
 reset();LS['key.gemini']='';Q.groq=[gRl({'x-ratelimit-reset-tokens':'3s','x-ratelimit-reset-requests':'20h'},TPDQ)];
 r=await ask1(L(63));gq=PS.cool['groq|openai/gpt-oss-120b'];
 ok(gq.why==='rate-daily'&&gq.unknown===true&&/didn't tell me when they reset/.test(r[0].say)&&!/in about/.test(r[0].say)&&!pending&&__timers()===0&&!LS.daily&&!!lastJob&&lastJob.q===L(63)&&window.JASMN_PENDING===L(63)&&hist.length===0&&calls.length===1&&warns.some(function(w){return /wait 60s via unknown/.test(w)}),'20d daily limit, no reliable reset (only per-minute token / daily request headers) -> reset marked unknown, NO timer, nothing saved, question kept, honest message');
 var n20=calls.length;r=await ask1('try again');
 ok(calls.length===n20&&/didn't tell me when they reset/.test(r[0].say)&&__timers()===0,'20e manual try again right away sends nothing (60 s anti-hammer pause only), still no timer');
 await __adv(61000);Q.groq=[G({reply:'Manual retry after unknown reset'})];r=await ask1('try again');
 ok(r[0].say==='Manual retry after unknown reset'&&calls[calls.length-1].body.messages.slice(-1)[0].content===L(63)&&hist.length===2&&__timers()===0,'20f after the pause, manual try again re-sends the SAVED question and it is answered');
 reset();LS['key.gemini']='';Q.groq=[gRl({'x-ratelimit-reset-requests':'20h'},TPDQ)];await ask1(L(64));var n20b=calls.length;await __adv(3*86400000);
 ok(calls.length===n20b&&__timers()===0,'20g unknown reset: three virtual days later still zero background traffic and zero timers');
 // 20h mixed: Groq reset unknown, Gemini reset known (Pacific midnight) -> the known one is used, the unknown one is never turned into a guess
 reset();await far();Q.groq=[gRl({},TPDQ)];Q.gemini=[mRl(DAILY_M)];r=await ask1(L(65));
 ok(!!pending&&pending.daily===true&&Math.abs((pending.at-Date.now())/3600000-20)<0.1&&/daily limits/.test(r[0].say),'20h one reset unknown + one known -> retry scheduled only for the known Gemini midnight reset');
 // 20i TPM limit must not become a daily lockout, even with a 24 h daily-request header present
 reset();Q.groq=[gRl({'x-ratelimit-reset-tokens':'2s','x-ratelimit-reset-requests':'23h50m'},'Rate limit reached for model x on tokens per minute (TPM): Limit 8000, Used 7976, Requested 1036.'),G({reply:'TPM retry worked'})];Q.gemini=[mRl([],'Quota exceeded. Please retry in 3s.')];
 r=await ask1(L(66));gq=PS.cool['groq|openai/gpt-oss-120b'];
 ok(gq.why==='rate-minute'&&!gq.unknown&&Math.abs((gq.until-Date.now())/1000-2)<1.5&&/busy/.test(r[0].say)&&!!pending&&!pending.daily&&!LS.daily,'20i Groq TPM limit stays a short limit: waits 2 s (tokens-reset header), the 23h50m request header is ignored, no daily save');
 await until(function(){return says().some(function(t){return t==='TPM retry worked'})},30000);ok(says().pop()==='TPM retry worked'&&!pending&&__timers()===0,'20j the TPM limit is retried after seconds and answered (existing bounded short-retry path)');
 // 20k Gemini per-minute violation whose text mentions the word daily
 reset();Q.groq=[gRl({'retry-after':'2'}),G({reply:'Back after minute limit'})];
 Q.gemini=[mRl([{'@type':'type.googleapis.com/google.rpc.QuotaFailure',violations:[{quotaId:'GenerateContentInputTokensPerMinutePerProjectPerModel-FreeTier'}]}],'Quota exceeded for input tokens. See your daily usage dashboard. Please retry in 6s.')];
 r=await ask1(L(67));gm=PS.cool['gemini|models/gemini-flash-lite-latest'];
 ok(gm.why==='rate-minute'&&Math.abs((gm.until-Date.now())/1000-6)<1.5&&!LS.daily,'20k Gemini per-minute quota whose message says daily is NOT treated as a daily lockout');
 await until(function(){return !pending});
 // 20l Gemini daily violation listed together with a minute one -> daily (exhausted daily quota)
 reset();await far();Q.groq=[gRl({'retry-after':'100000'},TPDQ)];Q.gemini=[mRl([{'@type':'type.googleapis.com/google.rpc.QuotaFailure',violations:[{quotaId:'GenerateRequestsPerMinutePerProjectPerModel-FreeTier'},{quotaId:'GenerateRequestsPerDayPerProjectPerModel-FreeTier'}]}])];
 r=await ask1(L(68));gm=PS.cool['gemini|models/gemini-flash-lite-latest'];gq=PS.cool['groq|openai/gpt-oss-120b'];
 ok(gm.why==='rate-daily'&&gq.unknown===true&&!!pending&&pending.daily===true,'20l Gemini minute+day violations -> daily (Pacific midnight); an implausible 25 h+ Groq reset (100000 s) is not believed -> unknown');

 // ===== 21 Gemini free tier: Search grounding unsupported, normal chat works =====
 var FREE0=function(){return resp(429,{error:{code:429,status:'RESOURCE_EXHAUSTED',message:'You exceeded your current quota, please check your plan and billing details. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-flash-lite-latest. Please retry in 40s.',details:[{'@type':'type.googleapis.com/google.rpc.QuotaFailure',violations:[{quotaMetric:'generativelanguage.googleapis.com/generate_content_free_tier_requests',quotaId:'GenerateRequestsPerDayPerProjectPerModel-FreeTier',quotaValue:'0'}]}]}})};
 var GMODEL='gemini|models/gemini-flash-lite-latest';
 // 21a Groq search limited -> Gemini Search refused (free tier, limit 0) -> classified as search-tool unavailable -> Groq Search used when it recovers
 reset();Q.groq=[gRl({'retry-after':'20'}),GS,G({reply:'Football via Groq.'})];Q.gemini=[FREE0];
 ask(W);await until(function(){return says().some(function(t){return t==='Football via Groq.'})},60000);
 var gsr=PS.cool[GMODEL+'|search'];
 ok(seq()==='groq,gemini,groq,groq'&&!!gsr&&gsr.why==='tool'&&gsr.until-Date.now()>11*3600000&&!PS.cool[GMODEL]&&!PS.cool['gemini|*']&&Object.keys(PS.authBad).length===0&&window.JASMN_LAST_SEARCH.provider==='groq','21a Gemini Search refused on free tier -> search tool marked unavailable (12 h), NOT rate-limit, NOT invalid key; Groq Search answered ('+seq()+')');
 // 21b normal Gemini chat still works
 PS.cool['groq|openai/gpt-oss-120b']={until:Date.now()+600000,why:'rate-minute'};Q.gemini=[M({reply:'Gemini chat is fine'})];calls.length=0;r=await ask1(L(70));
 ok(says().pop()==='Gemini chat is fine'&&seq()==='gemini'&&!calls[0].tools,'21b normal Gemini conversation keeps working while its Search tool is unsupported');
 // 21c the next search question does not call Gemini Search again
 Q.groq=[GS];Q.gemini=[M({reply:'Formatted by Gemini'})];webCache={};calls.length=0;r=await ask1('search the web for the latest tennis results');
 ok(says().pop()==='Formatted by Gemini'&&calls.every(function(c){return !(c.pv==='gemini'&&c.tools)})&&seq()==='groq,gemini','21c later searches skip Gemini Search (Groq searches, Gemini only formats the answer) ('+seq()+')');
 // 21d Gemini is the only provider: honest message, never answered from memory, chat still fine, no repeated failing calls
 reset();apiKey='MKEY12345678';provider='gemini';model='models/gemini-flash-lite-latest';Q.gemini=[FREE0,M({reply:'Gemini chat works'})];
 r=await ask1(W);
 ok(/Web search isn't available/.test(r[0].say)&&/won't guess/.test(r[0].say)&&calls.length===1&&hist.length===0&&!says().some(function(t){return /Memory|Ungrounded/.test(t)}),'21d Gemini-only + free tier: honest search-unavailable message, no answer from memory, history untouched');
 calls.length=0;r=await ask1(L(71));
 ok(says().pop()==='Gemini chat works'&&calls.length===1&&!calls[0].tools,'21e same session: normal Gemini chat still works');
 calls.length=0;r=await ask1('search the web for the weather in rabat today');
 ok(/Web search isn't available/.test(r[0].say)&&calls.length===0,'21f next search question: honest message again, zero network calls (no repeated failing probes)');
 // 21g other ways Gemini can say search is not allowed: 400 / 403 are search-tool unavailability, never a bad key or a Gemini outage
 reset();apiKey='MKEY12345678';provider='gemini';model='models/gemini-flash-lite-latest';Q.gemini=[function(){return resp(400,{error:{code:400,status:'INVALID_ARGUMENT',message:'Search Grounding is not supported for this model.'}})}];
 r=await ask1(W);ok(!!PS.cool[GMODEL+'|search']&&PS.cool[GMODEL+'|search'].why==='tool'&&!PS.cool[GMODEL]&&Object.keys(PS.authBad).length===0&&/Web search isn't available/.test(r[0].say),'21g HTTP 400 "search not supported" -> search tool unavailable (not auth, chat untouched)');
 reset();apiKey='MKEY12345678';provider='gemini';model='models/gemini-flash-lite-latest';Q.gemini=[function(){return resp(403,{error:{code:403,status:'PERMISSION_DENIED',message:'Google Search grounding is only available on the paid tier.'}})}];
 r=await ask1(W);ok(!!PS.cool[GMODEL+'|search']&&!PS.cool['gemini|*']&&Object.keys(PS.authBad).length===0,'21h HTTP 403 "search only on paid tier" -> search tool unavailable (NOT a permission block on all of Gemini)');
 reset();apiKey='MKEY12345678';provider='gemini';model='models/gemini-flash-lite-latest';Q.gemini=[function(){return resp(400,{error:{code:400,status:'INVALID_ARGUMENT',message:'API key not valid. Please pass a valid API key.'}})}];
 r=await ask1(W);ok(Object.keys(PS.authBad).join()==='gemini'&&!PS.cool[GMODEL+'|search']&&/key was rejected/.test(r[0].say),'21i a genuinely invalid key during a search is still reported as an invalid key');
 // 21j Gemini grounding quota with a non-zero limit is also search-only (chat keeps working)
 reset();apiKey='MKEY12345678';provider='gemini';model='models/gemini-flash-lite-latest';Q.gemini=[mRl([{'@type':'type.googleapis.com/google.rpc.QuotaFailure',violations:[{quotaMetric:'generativelanguage.googleapis.com/grounding_requests',quotaId:'GroundingRequestsPerDayPerProject',quotaValue:'500'}]}],'Quota exceeded for grounding requests. Please retry in 30s.')];
 r=await ask1(W);ok(!!PS.cool[GMODEL+'|search']&&PS.cool[GMODEL+'|search'].why==='tool'&&!PS.cool[GMODEL],'21j an exhausted Gemini grounding quota only disables Gemini Search, not Gemini chat');
 // 21k the model Gemini really used is reported
 reset();Q.groq=[gRl({'retry-after':'60'})];Q.gemini=[function(){return resp(200,{candidates:[{content:{parts:[{text:R({reply:'hi'})}]}}],modelVersion:'gemini-test-resolved'})}];await ask1(L(72));
 ok(window.JASMN_STATUS().geminiResolvedModel==='gemini-test-resolved','21k JASMN_STATUS shows which concrete model the Gemini alias resolved to');

 // ===== 22 final corrections: never invent a daily reset; neutral search-unavailable wording =====
  await __adv(200000);
 var RealIntl=Intl, DOW=function(){return {formatToParts:function(){throw new Error('tz fail')}}};
 reset();LS['key.gemini']='';Q.groq=[gRl({},TPDQ)];Q.gemini=[];
 Intl={DateTimeFormat:function(){return {formatToParts:function(){throw new Error('tz fail')}}}};
 ok(msToPacificMidnight()===null,'22a Pacific timezone calculation failure -> null (no guessed delay)');
 Intl={DateTimeFormat:function(){return {formatToParts:function(){return [{type:'hour',value:'xx'},{type:'minute',value:'1'},{type:'second',value:'1'}]}}}};
 ok(msToPacificMidnight()===null,'22b invalid Pacific calculation (NaN) -> null');
 Intl={DateTimeFormat:function(){return {formatToParts:function(){return [{type:'hour',value:'30'},{type:'minute',value:'0'},{type:'second',value:'0'}]}}}};
 ok(msToPacificMidnight()===null,'22b2 out-of-range Pacific calculation -> null');
 // Gemini daily limit while the Pacific calculation is broken (Groq not available)
 reset();apiKey='MKEY12345678';provider='gemini';model='models/gemini-flash-lite-latest';Q.gemini=[mRl(DAILY_M)];
 Intl={DateTimeFormat:function(){return {formatToParts:function(){throw new Error('tz fail')}}}};
 r=await ask1(L(80));gm=PS.cool['gemini|models/gemini-flash-lite-latest'];
 ok(!!gm&&gm.why==='rate-daily'&&gm.unknown===true&&!pending&&__timers()===0&&!LS.daily&&!!lastJob&&lastJob.q===L(80)&&window.JASMN_PENDING===L(80)&&hist.length===0&&warns.some(function(w){return /wait 60s via unknown/.test(w)}),'22c unknown Pacific reset -> no timer, nothing persisted, original question kept, 60 s pause only');
 var n22=calls.length;r=await ask1('try again');
 ok(calls.length===n22&&__timers()===0,'22d manual retry before 60 s sends nothing');
 await __adv(61000);Q.gemini=[M({reply:'Gemini manual retry ok'})];r=await ask1('try again');
 ok(r[0].say==='Gemini manual retry ok'&&calls[calls.length-1].body.contents.slice(-1)[0].parts[0].text.indexOf(L(80))>=0,'22e after 60 s manual retry re-sends the ORIGINAL question and is answered');
 await __adv(3*86400000);ok(__timers()===0,'22f no background timers afterwards');
 Intl=RealIntl;
 // valid Gemini midnight still works
 reset();await far();Q.groq=[gRl({},TPDQ)];Q.gemini=[mRl(DAILY_M)];r=await ask1(L(81));
 ok(!!pending&&pending.daily===true&&Math.abs((pending.at-Date.now())/3600000-20)<0.1,'22g valid Gemini Pacific midnight reset unchanged');
 // neutral wording, no blanket free-tier claim
 reset();apiKey='MKEY12345678';provider='gemini';model='models/gemini-flash-lite-latest';Q.gemini=[FREE0,M({reply:'Gemini chat fine'})];
 r=await ask1(W);var all22=r.map(function(o){return o.say||''}).join(' ');
 ok(/Web search isn't available with my current keys and models/.test(all22)&&!/free tier/i.test(all22),'22h English notool message is neutral');
 var src22=__src;
 ok(!/free tier does not include|offre gratuite de Gemini n'inclut|الخطة المجانية من Gemini لا تشمل/.test(src22)&&/La recherche sur internet n'est pas disponible avec mes clés et modèles actuels, donc/.test(src22)&&/غير متاح مع مفاتيحي ونماذجي الحالية، لذلك/.test(src22),'22i French and Arabic notool messages are neutral');
 // regression: normal Gemini chat and Groq search fallback
 r=await ask1(L(82));ok(r[0].say==='Gemini chat fine','22j normal Gemini conversation still works');
 reset();Q.groq=[GS];Q.gemini=[function(){return resp(400,{error:{message:'Search grounding is not supported for this model'}})},M({reply:'ok'})];
 r=await ask1(W);ok(/Groq found/.test(r.map(function(o){return o.say||''}).join(' '))||calls.some(function(c){return c.pv==='groq'}),'22k Groq Search still works');

 // ===== 8 new question replaces a pending one (deterministic) =====
 reset();Q.groq=[gRl({'retry-after':'2'}),G({reply:'Answer to the NEW question'})];Q.gemini=[mRl([],'Please retry in 2s.')];
 await ask1(L(12));await __adv(100);ask(L(13));await until(function(){return says().some(function(t){return /NEW question/.test(t)})},20000);await __adv(5000);
 ok(hist.length===2&&hist[0].parts[0].text===L(13)&&calls.length===3&&!pending,'8a asking a new question while one is pending replaces it; the old one is never retried or duplicated');
 reset();Q.groq=[gRl({'retry-after':'2'}),G({reply:'Old question answered'})];Q.gemini=[mRl([],'Please retry in 2s.')];
 await ask1(L(14));await until(function(){return says().some(function(t){return /Old question answered/.test(t)})},20000);
 ok(hist.length===2&&hist[0].parts[0].text===L(14),'8b if nothing is asked, the pending question is retried and answered exactly once');
 // ===== 9 cancel =====
 reset();Q.groq=[gRl({'retry-after':'2'})];Q.gemini=[mRl([],'Please retry in 2s.')];await ask1(L(15));var n9=calls.length;
 r=await ask1('cancel');await __adv(20000);ok(/cancelled/.test(r[0].say)&&calls.length===n9&&__timers()===0,'9  "cancel" stops the pending request; no background retry, no timers left');
 // ===== 10 rapid questions =====
 reset();Q.groq=[G({reply:'one'}),G({reply:'two'}),G({reply:'three'})];ask(L(16));ask(L(17));ask(L(18));await until(function(){return says().length>=1});await __adv(2000);
 ok(says().length===1&&hist.length===2&&hist[0].parts[0].text===L(18)&&calls.length<=3,'10 rapid questions: only the newest is answered, history written once ('+calls.length+' calls)');
 // ===== bounded retries =====
 reset();for(var i=0;i<30;i++){Q.groq.push(gRl({'retry-after':'1'}));Q.gemini.push(mRl([],'Please retry in 1s.'))}
 await ask1(L(19));await until(function(){return !pending},700000);
 ok(calls.length<=2*(MAX_TRIES+1)&&!pending&&hist.length===0&&/couldn't get through/.test(says().pop()),'11 persistent short limits stop after bounded retries ('+calls.length+' calls), honest message');
 // ===== invalid keys =====
 reset();Q.groq=[function(){return resp(401,{error:{message:'Invalid API Key'}})}];Q.gemini=[M({reply:'Gemini helps'}),M({reply:'Gemini 2'})];
 await ask1(L(20));calls.length=0;await ask1(L(21));
 ok(says()[0]==='Gemini helps'&&seq()==='gemini','12a invalid Groq key -> Gemini answers; the bad key is not tried again');
 reset();Q.groq=[function(){return resp(401,{error:{message:'Invalid API Key'}})}];Q.gemini=[function(){return resp(400,{error:{code:400,status:'INVALID_ARGUMENT',message:'API key not valid. Please pass a valid API key.'}})}];
 r=await ask1(L(22));calls.length=0;await ask1(L(23));
 ok(/Groq and Google rejected my key/.test(r[0].fail)&&calls.length===0,'12b both keys invalid -> clear Settings message, nothing is sent with bad keys');
 reset();LS['key.gemini']='';Q.groq=[gRl({'retry-after':'2'}),G({reply:'Only Groq configured'})];
 r=await ask1(L(24));await until(function(){return says().some(function(t){return /Only Groq/.test(t)})},20000);
 ok(calls.every(function(c){return c.pv==='groq'})&&/Only Groq/.test(says().pop()),'12c Groq only (no Gemini key): limit -> waits and retries Groq, never errors about Gemini');
 // ===== context across a switch =====
  reset();hist=[{role:'user',parts:[{text:'My favourite colour is green'}]},{role:'model',parts:[{text:R({reply:'Nice, green it is'})}]}];
  Q.groq=[gRl(),gRl()];Q.gemini=[M({reply:'You like green'})];      // short question: Groq tries its fast 20B model, then its 120B model, before Gemini
  var q13='what colour do I like, please remind me';
  ok(!needsWeb(q13),'13a the history question is ordinary conversation (no web routing)');
  await ask1(q13);
  var gc=calls.filter(function(c){return c.pv==='gemini'})[0], txt=gc?JSON.stringify(gc.body.contents):'';   // the Gemini call is found by provider, not by position
  ok(!!gc&&calls.every(function(c){return c.pv==='groq'||c===gc})&&/favourite colour is green/.test(txt)&&(txt.match(/what colour do I like/g)||[]).length===1&&/JASMN persona/.test(JSON.stringify(gc.body.systemInstruction))&&hist.length===4&&says()[0]==='You like green','13b history + persona carried to Gemini; question sent once ('+seq()+')');
 // ===== all searches fail honestly =====
 reset();Q.groq=[function(){return resp(200,{choices:[{message:{content:'Memory answer'}}]})}];Q.gemini=[function(){return resp(200,{candidates:[{content:{parts:[{text:'Ungrounded guess'}]}}]})}];
 r=await ask1(W);ok(/won't guess/.test(r[0].say)&&calls.length===2&&hist.length===0&&!says().some(function(t){return /Memory answer|Ungrounded/.test(t)}),'14 both searches unverified -> "could not verify", no invented answer, no ordinary chat call');
 // ===== routing =====
 ok(!needsWeb('Hello JASMN.')&&!needsWeb('Explain what machine learning is.')&&!needsWeb('Write me a short poem.')&&needsWeb('What are the latest news stories in Morocco today?')&&needsWeb(W),'15 routing: hello/explain/poem no search; news/search -> search');
 // ===== xAI never involved, keys never leaked, timers clean =====
 ok(unexpected===0,'16 no unexpected network calls');
 ok(!warns.concat(out.map(function(o){return o.fail||o.say||''})).some(function(w){return /xai|grok/i.test(w)}),'17 no xAI/Grok mention or error anywhere');
 reset();Q.groq=[function(){return resp(401,{error:{message:'Incorrect API key provided: GKEY12345678'}})}];Q.gemini=[M({reply:'x'})];await ask1(L(25));
 ok(!warns.join(' ').includes('GKEY12345678')&&!warns.join(' ').includes('MKEY12345678'),'18 API keys never appear in logs (even when an API error echoes one)');
 reset();await __adv(3600000);ok(__timers()===0,'19 no timers left running');
 __log.push('TOTAL pass='+P+' fail='+F);
 fails.forEach(function(f){__log.push('  failed: '+f)});
})()
`;
const watchdog = setTimeout(() => { console.log('WATCHDOG: tests did not finish'); process.exit(2); }, 120000); watchdog.unref();
vm.runInContext(env + code + tests, sb);
const iv = setInterval(() => {}, 1e9);          // keep the event loop alive until the async test body is done
(async () => { for (let i = 0; i < 4000 && !sb.__log.some(l => /^TOTAL/.test(l)); i++) await new Promise(r => setTimeout(r, 10));
  clearInterval(iv); sb.__log.forEach(l => console.log(l)); process.exitCode = sb.__log.some(l => /^FAIL/.test(l)) || !sb.__log.some(l => /^TOTAL/.test(l)) ? 1 : 0; })();
