import {createHash} from 'node:crypto';
const decode=s=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/<[^>]*>/g,'').trim();
const block=(x,t)=>x.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`,'i'))?.[1]||'';
const val=(x,t)=>decode(block(x,t));
export function parseForm4(xml,{id,sourceUrl,publishedAt,observedAt}){
 if(!/<ownershipDocument[\s>]/.test(xml)||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Unsupported ownership XML');
 const symbol=val(xml,'issuerTradingSymbol').toUpperCase();
 if(!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol))return [];
 const owners=[...xml.matchAll(/<reportingOwner>([\s\S]*?)<\/reportingOwner>/g)].map(m=>({id:val(m[1],'rptOwnerCik'),name:val(m[1],'rptOwnerName')}));
 const planned=/^(1|true)$/i.test(val(xml,'aff10b5One'));
 return [...xml.matchAll(/<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/g)].map((m,i)=>{
  const x=m[1],shares=Number(val(block(x,'transactionShares'),'value')),price=Number(val(block(x,'transactionPricePerShare'),'value'));
  return {id:`${id}:${i}`,kind:'insider',market:'US',symbol,actorId:owners.map(o=>o.id).sort().join('+'),actor:owners.map(o=>o.name).join(' / '),security:val(block(x,'securityTitle'),'value'),securityType:'nonDerivative',code:val(x,'transactionCode'),direction:val(block(x,'transactionAcquiredDisposedCode'),'value'),shares,price,amountUSD:shares*price,occurredAt:val(block(x,'transactionDate'),'value'),occurredPrecision:'date',publishedAt,observedAt,source:'SEC EDGAR Form 4',sourceUrl,sourceSha256:createHash('sha256').update(xml).digest('hex'),verified:true,planned,amended:val(xml,'documentType')!=='4',footnoteUnresolved:owners.length!==1||/<footnoteId\b/.test(x),note:'P 코드는 장내 또는 사적 매수. 거래 시각은 원문에 없으면 날짜만 표시.'};
 });
}
export async function collectSec({previous={filings:{},events:[]},agent=process.env.SEC_USER_AGENT,now=Date.now(),fetcher=fetch}={}){
 const observedAt=new Date(now).toISOString();
 if(!agent||!/@/.test(agent))return {state:previous,coverage:{status:'not_configured',message:'실제 연락 이메일을 포함한 SEC_USER_AGENT 필요'}};
 let last=0;
 async function get(url){const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='www.sec.gov'||u.username||u.password)throw Error('Invalid SEC URL');const wait=250-(Date.now()-last);if(wait>0)await new Promise(r=>setTimeout(r,wait));last=Date.now();const r=await fetcher(url,{redirect:'error',headers:{'User-Agent':agent,Accept:'application/xml,application/json,text/html'},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('SEC HTTP '+r.status);const text=await r.text();if(text.length>3000000)throw Error('SEC response too large');return text}
 const state={filings:{...previous.filings},events:[...previous.events]};let attempted=0,parsed=0,failed=0;
 try{
 const feed=await get('https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&owner=only&count=100&output=atom');
 const entries=[...feed.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)].map(m=>({id:val(m[1],'id'),publishedAt:val(m[1],'updated'),url:m[1].match(/<link\b[^>]*href="([^"]+)"/)?.[1]?.replace(/&amp;/g,'&')})).filter(e=>e.id&&e.url);
 if(!entries.length)throw Error('SEC feed empty or format changed');
 for(const e of entries){
  if(state.filings[e.id])continue;attempted++;
  try{
   const base=e.url.slice(0,e.url.lastIndexOf('/')+1);if(!base.startsWith('https://www.sec.gov/Archives/edgar/data/'))throw Error('Invalid archive');
   const index=JSON.parse(await get(base+'index.json'));const files=(index.directory?.item||[]).filter(f=>/\.xml$/i.test(f.name)&&!f.name.includes('/')&&!f.name.includes('..'));
   let xml=null,url=null;
   for(const f of files.slice(0,5)){const body=await get(base+encodeURIComponent(f.name));if(/<ownershipDocument[\s>]/.test(body)){xml=body;url=base+encodeURIComponent(f.name);break}}
   if(!xml)throw Error('Ownership document absent');
   const events=parseForm4(xml,{...e,sourceUrl:url,observedAt});state.events.push(...events);state.filings[e.id]=observedAt;parsed++;
  }catch{failed++}
 }
 state.events=[...new Map(state.events.map(e=>[e.id,e])).values()].filter(e=>now-Date.parse(e.publishedAt)<30*86400000);
 return {state,coverage:{status:failed?'partial':'ok',asOf:observedAt,attempted,parsed,failed,message:'SEC 최신 최대 100개 제출의 원문 분석. 전체 시장 전수 수집 아님. 주석·정정·계획매매는 자동 추천 제외.'}};
 }catch{return {state:previous,coverage:{status:'unavailable',asOf:observedAt,message:'SEC 조회 실패. 기존 기록은 보존하고 새 추천은 보류합니다.'}}}
}
