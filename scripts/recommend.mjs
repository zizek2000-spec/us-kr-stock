import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {collectSec} from '../lib/recommendations/sec.js';
import {makeReport,POLICY} from '../lib/recommendations/engine.js';
import {backtest} from '../lib/recommendations/backtest.js';
import {prices} from '../lib/recommendations/prices.js';
import {sendTelegram} from '../lib/recommendations/telegram.js';
const base='public/data/recommendations',now=Date.now();
async function read(path,fallback){try{return JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code==='ENOENT')return fallback;throw e}}
async function save(path,obj){await writeFile(path,JSON.stringify(obj,null,2)+'\n')}
function slotAt(){
 const et=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(now);const get=k=>et.find(p=>p.type===k)?.value;
 const kst=new Date(now+9*3600000);
 if(process.env.GITHUB_EVENT_NAME==='schedule'){
  if(kst.getUTCHours()===8&&kst.getUTCDay()>=1&&kst.getUTCDay()<=5)return 'kr_preopen';
  if(get('hour')==='16'&&!['Sat','Sun'].includes(get('weekday')))return 'us_close';
  return null;
 }
 return process.argv.includes('--test-telegram')?'telegram_test':'manual';
}
const slot=slotAt();if(!slot){console.log('Outside intended local session; no duplicate DST report');process.exit(0)}
await mkdir(base+'/history',{recursive:true});
const previous=await read(base+'/sec-state.json',{filings:{},events:[]});
const collected=await collectSec({previous,now});await save(base+'/sec-state.json',collected.state);
// Provider imports stay disconnected until terms and source facts are reviewed.
const imports=await read('config/reviewed-evidence.json',{events:[],approvals:{}});
const evidence=[...collected.state.events];const coverage={insider:collected.coverage};
for(const kind of ['politician','option']){
 const a=imports.approvals?.[kind];
 if(!a||a.enabled!==true||a.redistributionAllowed!==true||!a.reviewedBy||!a.termsUrl){coverage[kind]={status:'not_connected',message:kind==='option'?'체결·호가·미결제약정·이용권한이 검증된 데이터 미연결. 결제 및 가상 신호 없음.':'공식 공시와 소유자·금액구간을 대조한 정치인 데이터 미연결.'};continue}
 const records=(imports.events||[]).filter(e=>e.kind===kind&&e.reviewedBy&&e.sourceSha256&&e.verified===true);
 evidence.push(...records);coverage[kind]={status:'reviewed_import',message:'운영자가 원문 대조한 승인 자료; 실시간 수집 아님',count:records.length};
}
const corpus=await read(base+'/bars.json',{bars:{}});
const quotes={};const symbols=[...new Set(['SPY',...evidence.map(e=>e.symbol),...Object.keys(corpus.bars)])].slice(0,100);
for(let i=0;i<symbols.length;i+=4)await Promise.all(symbols.slice(i,i+4).map(async s=>{try{quotes[s]=await prices(s);if(quotes[s].bar){corpus.bars[s]=[...new Map([...(corpus.bars[s]||[]),quotes[s].bar].map(b=>[b.openAt,b])).values()].sort((a,b)=>Date.parse(a.openAt)-Date.parse(b.openAt)).slice(-300)}}catch{}}));
await save(base+'/bars.json',corpus);
coverage.prices={status:Object.keys(quotes).length===symbols.length?'ok':'partial',requested:symbols.length,received:Object.keys(quotes).length,message:'Yahoo Finance 비공식 지연 시세. 한국 종목 자동 연결 없음.'};
if(slot==='kr_preopen'){
 try{const r=await fetch('https://us-kr-market-radar.vercel.app/api/market',{signal:AbortSignal.timeout(55000)});if(!r.ok)throw Error();const d=await r.json();const date=new Date(now+9*3600000).toISOString().slice(0,10).replaceAll('-','');coverage.calendar={status:d.calendar?.date===date&&d.calendar?.open===true?'ok':'closed_or_unknown',message:'기존 KIS 한국장 개장일 검증'};}catch{coverage.calendar={status:'unavailable',message:'한국장 개장일 미확인'}}
}
const snapshot={policyVersion:POLICY.version,generatedAt:new Date(now).toISOString(),events:evidence,quotes,coverage};
await save(base+'/history/'+new Date(now).toISOString().replaceAll(':','-')+'.json',snapshot);
const snapshots=[];for(const f of (await readdir(base+'/history')).filter(f=>f.endsWith('.json')).sort())snapshots.push(await read(base+'/history/'+f,{}));
const result=backtest({snapshots,bars:corpus.bars,benchmark:corpus.bars.SPY||[],now});
const report=makeReport({events:evidence,quotes,backtest:result,coverage,slot,now});
if(slot==='kr_preopen'&&coverage.calendar?.status!=='ok'){report.candidates=[];report.status='withheld';report.blockers.push('한국장 개장일 미확인 또는 휴장');report.message='추천 보류 — 한국장 개장일 검증 미통과';}
if(slot==='us_close'){
 const day=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(t);
 if(!Object.values(quotes).some(q=>q.completed&&day(Date.parse(q.asOf))===day(now))){report.candidates=[];report.status='withheld';report.blockers.push('오늘 미국 정규장 종가 미확인 또는 휴장');report.message='추천 보류 — 오늘 미국장 마감 검증 미통과';}
}
const deliveryPath=base+'/delivery.json',delivery=await read(deliveryPath,{sent:{}});
const day=new Date(now+9*3600000).toISOString().slice(0,10),key=slot==='telegram_test'?`test:${process.env.GITHUB_RUN_ID||now}`:`${day}:${slot}`;
if(delivery.sent[key])report.telegram={status:'already_sent',sentAt:delivery.sent[key]};
else{report.telegram=await sendTelegram(report);if(report.telegram.status==='sent'){delivery.sent[key]=report.telegram.sentAt;await save(deliveryPath,delivery)}}
await save('public/data/recommendations.json',report);
console.log(JSON.stringify({status:report.status,candidates:report.candidates.length,insider:coverage.insider.status,backtest:result.status,telegram:report.telegram.status}));
if(report.telegram.status==='failed')process.exitCode=1;
